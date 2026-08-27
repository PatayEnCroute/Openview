import { describe, expect, it } from 'vitest';
import type { Expression } from '../../expression/expression.js';
import { type DocumentNode, DocumentNodeSchema } from '../nodes.js';
import { childrenOf, collectDataPaths, findNodeById, nodeReads, walk } from '../traverse.js';
import { DISCOUNT_TREE, RECIPE_TABLE, RECIPE_TEMPLATE } from './fixtures.js';

describe('nodeReads', () => {
  it('reports the expression a loop evaluates and the alias it binds', () => {
    const loop = findNodeById(DISCOUNT_TREE, 'lines');
    if (loop?.type !== 'loop') {
      throw new Error('the fixture should carry a loop');
    }

    expect(nodeReads(loop)).toStrictEqual({ reads: [loop.each], binds: 'line' });
  });

  it('reports only the binding runs of a text block', () => {
    const label = findNodeById(DISCOUNT_TREE, 'label');
    if (label?.type !== 'text') {
      throw new Error('the fixture should carry a text node');
    }

    expect(nodeReads(label)).toStrictEqual({
      reads: [{ kind: 'path', path: 'line.discount' }],
      binds: undefined,
    });
  });

  it('reports nothing for a node that reads no data', () => {
    expect(nodeReads({ type: 'image', id: 'i', src: 'logo.png' })).toStrictEqual({
      reads: [],
      binds: undefined,
    });
  });
});

describe('childrenOf', () => {
  it('reports no children for leaves', () => {
    expect(childrenOf({ type: 'text', id: 't', content: [] })).toStrictEqual([]);
    expect(childrenOf({ type: 'image', id: 'i', src: 's' })).toStrictEqual([]);
  });

  it('reports the direct children of every container kind', () => {
    expect(childrenOf(DISCOUNT_TREE).map((child) => child.id)).toStrictEqual(['title', 'lines']);
  });

  it('reports the three sections of a table in flow order', () => {
    expect(childrenOf(RECIPE_TABLE).map((child) => `${child.type}:${child.id}`)).toStrictEqual([
      'tableRow:entete',
      'tableRowGroup:corps',
      'tableRow:ligne-total',
    ]);
  });

  it('reports the rows of a group as the STORED reference, and computes the rest', () => {
    const group = RECIPE_TABLE.body[0];
    if (group?.type !== 'tableRowGroup') {
      throw new Error('the recipe body should carry a row group');
    }

    // The stored array when the node keeps its children in a single run, a fresh one otherwise --
    // so the split follows the shape of the node, not its kind. A consumer that memoised on the
    // identity of the result would be wrong wherever a node holds more than one run, and
    // `childrenOf(text) === childrenOf(text)` is what says so.
    expect(childrenOf(group)).toBe(group.rows);
    expect(childrenOf(RECIPE_TABLE)).not.toBe(RECIPE_TABLE.header);
    const leaf = RECIPE_TABLE.header[0]?.cells[0]?.children[0];
    if (leaf === undefined) {
      throw new Error('the recipe header should carry a cell holding a block');
    }
    expect(childrenOf(leaf)).not.toBe(childrenOf(leaf));
  });

  it('hands back the stored array for a row of one cell, and a fresh one past that', () => {
    // The case the rule turns on: a row holds one run of children per cell, so the SAME kind
    // answers with the stored array at one cell and with a fresh array at two.
    const cell = { columnId: 'c', children: [{ type: 'text' as const, id: 'only', content: [] }] };
    const single: DocumentNode = { type: 'tableRow', id: 'one', cells: [cell] };
    const double: DocumentNode = { type: 'tableRow', id: 'two', cells: [cell, cell] };

    expect(childrenOf(single)).toBe(cell.children);
    expect(childrenOf(double)).not.toBe(cell.children);
    expect(childrenOf(double).map((child) => child.id)).toStrictEqual(['only', 'only']);
  });

  it('flattens the cells of a row, so every block of a table is reachable', () => {
    const group = RECIPE_TABLE.body[0];
    if (group?.type !== 'tableRowGroup') {
      throw new Error('the recipe body should carry a row group');
    }
    const detail = group.rows[0];
    if (detail === undefined) {
      throw new Error('the group should carry a detail row');
    }

    // Five cells, one block each, flattened: the column boundary is erased on purpose, and
    // attributing a node to a column goes through the table node instead.
    expect(childrenOf(detail).map((child) => child.id)).toStrictEqual([
      'td-designation',
      'td-quantite',
      'td-prix',
      'td-remise',
      'td-montant',
    ]);
    const total = RECIPE_TABLE.footer[0];
    expect(childrenOf(total ?? detail).map((child) => child.id)).toStrictEqual([
      'tf-libelle',
      'tf-montant',
    ]);
  });
});

describe('walk', () => {
  it('yields parents before children, depth first', () => {
    expect([...walk(DISCOUNT_TREE)].map((node) => node.id)).toStrictEqual([
      'root',
      'title',
      'lines',
      'thumb',
      'discounted',
      'label',
    ]);
  });

  it('yields a lone leaf', () => {
    expect([...walk({ type: 'text', id: 'solo', content: [] })].map((n) => n.id)).toStrictEqual([
      'solo',
    ]);
  });
});

describe('findNodeById', () => {
  it('finds a deeply nested node', () => {
    expect(findNodeById(DISCOUNT_TREE, 'label')?.type).toBe('text');
  });

  it('returns undefined rather than throwing when the id is absent', () => {
    expect(findNodeById(DISCOUNT_TREE, 'nope')).toBeUndefined();
  });

  it('reaches every node of the table through childrenOf, cells included', () => {
    // Un sous-arbre que `childrenOf` ne rend pas est invisible pour `walk`, `findNodeById` et
    // `collectDataPaths` -- sans erreur nulle part. C'est l'assertion qui l'interdit.
    // 17 = le tableau (1) + l'en-tête et ses cinq textes (6) + le groupe, sa ligne et ses
    // cinq textes (7) + la ligne de pied et ses deux textes (3). 19 pour la racine du
    // modèle : les deux de plus sont la racine et le titre.
    expect([...walk(RECIPE_TABLE)]).toHaveLength(17);
    expect([...walk(RECIPE_TEMPLATE.root)]).toHaveLength(19);
    expect(findNodeById(RECIPE_TABLE, 'td-montant')?.type).toBe('text');
    // Sans cette seconde assertion, un `childrenOf` qui oublierait la section `footer`
    // passerait la première.
    expect(findNodeById(RECIPE_TABLE, 'tf-montant')?.type).toBe('text');
  });
});

describe('collectDataPaths', () => {
  it('reports the caller keys and not the loop alias', () => {
    // Before ADR 0002 this returned ['invoice.lines', 'line.discount'], and
    // `line` is a name the caller never supplies -- an integrator handing over
    // { invoice } was told a key was missing when nothing was. `line.discount`
    // appears twice in the tree here, in the condition and in the binding, and
    // neither occurrence may leak out.
    expect(collectDataPaths(DISCOUNT_TREE)).toStrictEqual(['invoice.lines']);
  });

  it('reaches inside compound expressions, not just top-level paths', () => {
    // `invoice.total` sits two levels down inside a compare node. A string
    // language would have needed parsing to find it; the structured form makes
    // this exact.
    const guarded: DocumentNode = {
      type: 'condition',
      id: 'c',
      when: {
        kind: 'compare',
        op: 'gt',
        left: { kind: 'path', path: 'invoice.total' },
        right: { kind: 'literal', value: 0 },
      },
      children: [],
    };
    expect(collectDataPaths(guarded)).toStrictEqual(['invoice.total']);
  });

  it('collects what a text binding prints', () => {
    // The other half of the old bug: every value a document actually printed was
    // invisible to this function, because no node could print one.
    const paragraph: DocumentNode = {
      type: 'text',
      id: 't',
      content: [
        { kind: 'literal', text: 'Total due: ' },
        { kind: 'binding', value: { kind: 'path', path: 'invoice.total' } },
      ],
    };
    expect(collectDataPaths(paragraph)).toStrictEqual(['invoice.total']);
  });

  it('sees through nested loops without reporting either alias', () => {
    const nested: DocumentNode = {
      type: 'loop',
      id: 'outer',
      each: { kind: 'path', path: 'invoice.groups' },
      as: 'group',
      children: [
        {
          type: 'loop',
          id: 'inner',
          // Rooted at the outer alias: internal, so it must not be reported
          // either, even though it is a loop source.
          each: { kind: 'path', path: 'group.lines' },
          as: 'line',
          children: [
            {
              type: 'text',
              id: 't',
              content: [
                { kind: 'binding', value: { kind: 'path', path: 'line.sku' } },
                { kind: 'binding', value: { kind: 'path', path: 'group.label' } },
                { kind: 'binding', value: { kind: 'path', path: 'company.name' } },
              ],
            },
          ],
        },
      ],
    };

    expect(collectDataPaths(nested)).toStrictEqual(['invoice.groups', 'company.name']);
  });

  it('asks the integrator for two keys, and for no per-item field', () => {
    // La garantie de l'ADR 0002, sur la forme qui la met le plus à l'épreuve : HUIT lectures
    // enracinées sur `ligne` sont écrites dans ce modèle, six dans le corps et deux sous
    // l'agrégat du pied, et aucune ne sort. Deux mécanismes distincts les filtrent -- les six
    // du corps parce que `nodeReads(group)` déclare `binds: 'ligne'`, les deux du pied parce
    // que `pathsOf` porte son PROPRE contexte d'alias -- et si l'un tombait, l'autre ne
    // rattraperait rien.
    expect(collectDataPaths(RECIPE_TEMPLATE.root)).toStrictEqual([
      'facture.numero',
      'facture.lignes',
    ]);
    // Le tableau seul : il ne lit rien de son côté, `nodeReads(table)` ne rend aucune lecture.
    expect(collectDataPaths(RECIPE_TABLE)).toStrictEqual(['facture.lignes']);
  });

  it('reports a group alias used outside its group as a caller key', () => {
    // La contre-épreuve, et c'est le vrai test : si le TABLEAU liait l'alias -- la forme que
    // le plan écarte --, cette lecture serait filtrée en silence et l'intégrateur ne serait
    // jamais interrogé sur une donnée que le document lit réellement. C'est exactement le
    // défaut que l'ADR 0002 a corrigé pour les boucles.
    const leaky: DocumentNode = {
      ...RECIPE_TABLE,
      footer: [
        {
          type: 'tableRow',
          id: 'fuite',
          cells: [
            {
              columnId: 'montant',
              children: [
                {
                  type: 'text',
                  id: 'tf-fuite',
                  content: [{ kind: 'binding', value: { kind: 'path', path: 'ligne.montant' } }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collectDataPaths(leaky)).toStrictEqual(['facture.lignes', 'ligne.montant']);
  });

  it('reports an alias-rooted path used outside its loop', () => {
    // The scope boundary, pinned: `item` is not bound after the loop closes, so
    // there the caller really would have to supply it.
    const afterLoop: DocumentNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'loop', id: 'l', each: { kind: 'path', path: 'items' }, as: 'item', children: [] },
        {
          type: 'text',
          id: 't',
          content: [{ kind: 'binding', value: { kind: 'path', path: 'item.sku' } }],
        },
      ],
    };

    expect(collectDataPaths(afterLoop)).toStrictEqual(['items', 'item.sku']);
  });

  it('excludes a bare alias, not only an alias-rooted field', () => {
    // A loop over a list of strings, whose child prints the item itself with no
    // field access. `invoice.tags` is the caller's key; `tag` never is.
    const bareAlias: DocumentNode = {
      type: 'loop',
      id: 'l',
      each: { kind: 'path', path: 'invoice.tags' },
      as: 'tag',
      children: [
        {
          type: 'text',
          id: 't',
          content: [{ kind: 'binding', value: { kind: 'path', path: 'tag' } }],
        },
      ],
    };

    expect(collectDataPaths(bareAlias)).toStrictEqual(['invoice.tags']);
  });

  it('de-duplicates repeated paths', () => {
    const repeated: DocumentNode = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'loop', id: 'a', each: { kind: 'path', path: 'items' }, as: 'x', children: [] },
        { type: 'loop', id: 'b', each: { kind: 'path', path: 'items' }, as: 'y', children: [] },
      ],
    };
    expect(collectDataPaths(repeated)).toStrictEqual(['items']);
  });

  it('returns nothing for a tree with no dynamic bindings', () => {
    expect(
      collectDataPaths({ type: 'text', id: 't', content: [{ kind: 'literal', text: 'static' }] }),
    ).toStrictEqual([]);
  });

  it('returns nothing for an image, which reads no data yet', () => {
    expect(collectDataPaths({ type: 'image', id: 'i', src: 'logo.png' })).toStrictEqual([]);
  });

  it('demands NOTHING for a page marker, which is what sinks the reserved-key mechanism', () => {
    // The alternative that cost the contract nothing -- injecting `{ page: { numero, total } }`
    // into the scope -- would have made this function report `page.numero` to the integrator,
    // a key no integrator can supply and which the playground displays on screen. A segment
    // resolved by the paginator reads no data, so the branch yields `[]`.
    const numbered: DocumentNode = {
      type: 'text',
      id: 'ftr',
      content: [
        { kind: 'literal', text: 'Page ' },
        { kind: 'pageField', field: 'number' },
        { kind: 'literal', text: ' / ' },
        { kind: 'pageField', field: 'count' },
      ],
    };

    expect(collectDataPaths(numbered)).toStrictEqual([]);
    expect(nodeReads(numbered)).toStrictEqual({ reads: [], binds: undefined });
  });
});

/**
 * One tree, written once, produced with and without the mark on EVERY node.
 *
 * A factory rather than two literals: "the same tree, marked" has to be a fact of the code and not
 * a claim, or the invariance below would be asserted against a shape that quietly diverged. It
 * carries all eight kinds, so no kind is invariant only by absence.
 */
const hasDiscount: Expression = {
  kind: 'compare',
  op: 'gt',
  left: { kind: 'path', path: 'invoice.discount' },
  right: { kind: 'literal', value: 0 },
};

/**
 * The mark as a spreadable object: nothing at all when unmarked.
 *
 * Spread rather than assigned, because Zod keeps an own `keepTogether: undefined` key while a
 * document written before version 8 has no key at all -- and absence is the shape to traverse.
 */
const markOf = (keepTogether: true | undefined): { readonly keepTogether?: true } =>
  keepTogether === undefined ? {} : { keepTogether };

const treeWith = (keepTogether: true | undefined): unknown => ({
  type: 'container',
  id: 'root',
  ...markOf(keepTogether),
  children: [
    {
      type: 'text',
      id: 'title',
      ...markOf(keepTogether),
      content: [{ kind: 'literal', text: 'Invoice' }],
    },
    { type: 'image', id: 'logo', ...markOf(keepTogether), src: 'logo.png' },
    {
      type: 'condition',
      id: 'discounted',
      ...markOf(keepTogether),
      when: hasDiscount,
      children: [
        {
          type: 'loop',
          id: 'lines',
          ...markOf(keepTogether),
          each: { kind: 'path', path: 'invoice.lines' },
          as: 'line',
          children: [
            {
              type: 'text',
              id: 'label',
              ...markOf(keepTogether),
              content: [{ kind: 'binding', value: { kind: 'path', path: 'line.discount' } }],
            },
          ],
        },
      ],
    },
    {
      type: 'table',
      id: 'rows',
      ...markOf(keepTogether),
      columns: [{ id: 'amount', width: 1, align: 'end' }],
      header: [
        {
          type: 'tableRow',
          id: 'head',
          ...markOf(keepTogether),
          cells: [
            {
              columnId: 'amount',
              children: [
                {
                  type: 'text',
                  id: 'th',
                  ...markOf(keepTogether),
                  content: [{ kind: 'literal', text: 'A' }],
                },
              ],
            },
          ],
        },
      ],
      body: [
        {
          type: 'tableRowGroup',
          id: 'group',
          ...markOf(keepTogether),
          each: { kind: 'path', path: 'invoice.rows' },
          as: 'row',
          rows: [
            {
              type: 'tableRow',
              id: 'detail',
              ...markOf(keepTogether),
              cells: [
                {
                  columnId: 'amount',
                  children: [
                    {
                      type: 'text',
                      id: 'td',
                      ...markOf(keepTogether),
                      content: [{ kind: 'binding', value: { kind: 'path', path: 'row.amount' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      footer: [],
    },
  ],
});

/**
 * Parsed inside each test, never in a `describe` body.
 *
 * A parse at collection time turns a fixture or schema drift into a file-level collection error,
 * which reports every other test in this file as not-run rather than failing the one at fault.
 */
const parsedTree = (keepTogether: true | undefined): DocumentNode =>
  DocumentNodeSchema.parse(treeWith(keepTogether));

describe('keepTogether', () => {
  it('adds no child, so the traversal is the same tree in the same order', () => {
    // The boundary this protects: a page policy must not become a NODE. Were the mark ever
    // reified as a child, `walk` would yield it and every consumer counting nodes would drift.
    const bare = parsedTree(undefined);
    const marked = parsedTree(true);

    expect([...walk(marked)].map((node) => node.id)).toStrictEqual(
      [...walk(bare)].map((node) => node.id),
    );
    expect([...walk(marked)].map((node) => node.type)).toStrictEqual(
      [...walk(bare)].map((node) => node.type),
    );
    expect([...walk(marked)].every((node) => node.keepTogether === true)).toBe(true);
    expect([...walk(bare)].every((node) => node.keepTogether === undefined)).toBe(true);
  });

  it('changes neither the children of a node nor the id lookup', () => {
    const bare = parsedTree(undefined);
    const marked = parsedTree(true);

    for (const node of walk(bare)) {
      expect(childrenOf(node).map((child) => child.id)).toStrictEqual(
        childrenOf(findNodeById(marked, node.id) ?? node).map((child) => child.id),
      );
      expect(findNodeById(marked, node.id)?.type).toBe(node.type);
    }
    expect(findNodeById(marked, 'nope')).toBeUndefined();
  });

  it('reads no data, so it demands nothing of the integrator', () => {
    // The other boundary: a page policy must not become a KEY the caller has to supply. The mark
    // carries no expression, so `nodeReads` gains nothing and the collected paths are unchanged.
    const bare = parsedTree(undefined);
    const marked = parsedTree(true);

    expect(collectDataPaths(marked)).toStrictEqual(collectDataPaths(bare));
    expect(collectDataPaths(marked)).toStrictEqual([
      'invoice.discount',
      'invoice.lines',
      'invoice.rows',
    ]);
    for (const node of walk(bare)) {
      expect(nodeReads(findNodeById(marked, node.id) ?? node)).toStrictEqual(nodeReads(node));
    }
  });
});

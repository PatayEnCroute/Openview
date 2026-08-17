import { describe, expect, it } from 'vitest';
import type { Expression } from '../../expression/expression.js';
import type { DocumentNode, TextSegment } from '../nodes.js';
import {
  childrenOf,
  collectDataPaths,
  findNodeById,
  nodeReads,
  visitNode,
  visitSegment,
  walk,
} from '../visitor.js';
import { RECIPE_TABLE, RECIPE_TEMPLATE } from './fixtures.js';

const discountApplies: Expression = {
  kind: 'compare',
  op: 'gt',
  left: { kind: 'path', path: 'line.discount' },
  right: { kind: 'literal', value: 0 },
};

const tree: DocumentNode = {
  type: 'container',
  id: 'root',
  children: [
    { type: 'text', id: 'title', content: [{ kind: 'literal', text: 'Invoice' }] },
    {
      type: 'loop',
      id: 'lines',
      each: { kind: 'path', path: 'invoice.lines' },
      as: 'line',
      children: [
        { type: 'image', id: 'thumb', src: 'thumb.png' },
        {
          type: 'condition',
          id: 'discounted',
          when: discountApplies,
          children: [
            {
              type: 'text',
              id: 'label',
              content: [
                { kind: 'literal', text: 'Discount: ' },
                { kind: 'binding', value: { kind: 'path', path: 'line.discount' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('visitNode', () => {
  it('dispatches each node type to its own branch', () => {
    const describeNode = (node: DocumentNode): string =>
      visitNode(node, {
        text: (n) => `text:${n.content.map((segment) => segment.kind).join('+')}`,
        image: (n) => `image:${n.src}`,
        container: (n) => `container:${n.children.length}`,
        loop: (n) => `loop:${n.each.kind}`,
        condition: (n) => `condition:${n.when.kind}`,
        table: (n) => `table:${n.columns.length}`,
        tableRowGroup: (n) => `tableRowGroup:${n.as}`,
        tableRow: (n) => `tableRow:${n.cells.length}`,
      });

    expect(describeNode(tree)).toBe('container:2');
    expect([...walk(tree)].map(describeNode)).toStrictEqual([
      'container:2',
      'text:literal',
      'loop:path',
      'image:thumb.png',
      'condition:compare',
      'text:literal+binding',
    ]);
  });

  it('throws on a node type it does not know', () => {
    // Reaching the defensive branch requires a value that bypassed validation,
    // which is exactly the real scenario: data read straight from storage.
    // JSON.parse is the honest way in -- no cast, no `any` annotation.
    const smuggled: DocumentNode = JSON.parse('{"type":"barcode","id":"b1"}');

    expect(() =>
      visitNode(smuggled, {
        text: () => 'x',
        image: () => 'x',
        container: () => 'x',
        loop: () => 'x',
        condition: () => 'x',
        table: () => 'x',
        tableRowGroup: () => 'x',
        tableRow: () => 'x',
      }),
    ).toThrow(TypeError);
  });
});

describe('visitSegment', () => {
  it('dispatches each segment kind to its own branch', () => {
    const describeSegment = (segment: TextSegment): string =>
      visitSegment(segment, {
        literal: (s) => `literal:${s.text}`,
        binding: (s) => `binding:${s.value.kind}`,
      });

    expect(describeSegment({ kind: 'literal', text: 'Total' })).toBe('literal:Total');
    expect(describeSegment({ kind: 'binding', value: { kind: 'path', path: 'a.b' } })).toBe(
      'binding:path',
    );
  });

  it('throws on a segment kind it does not know', () => {
    // The guarantee visitNode gives for node types, now given for runs: a third
    // kind added to the union breaks compilation at this single site instead of
    // being silently skipped wherever segments are walked.
    const smuggled: TextSegment = JSON.parse('{"kind":"mark","text":"x"}');

    expect(() => visitSegment(smuggled, { literal: () => 'x', binding: () => 'x' })).toThrow(
      TypeError,
    );
  });
});

describe('nodeReads', () => {
  it('reports the expression a loop evaluates and the alias it binds', () => {
    const loop = findNodeById(tree, 'lines');
    if (loop?.type !== 'loop') {
      throw new Error('the fixture should carry a loop');
    }

    expect(nodeReads(loop)).toStrictEqual({ reads: [loop.each], binds: 'line' });
  });

  it('reports only the binding runs of a text block', () => {
    const label = findNodeById(tree, 'label');
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
    expect(childrenOf(tree).map((child) => child.id)).toStrictEqual(['title', 'lines']);
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

    // Four of the eight branches hand back the stored array; the four others allocate. A
    // consumer that memoised on the identity of the result would be wrong six times out of
    // eight, and `childrenOf(text) === childrenOf(text)` is what says so.
    expect(childrenOf(group)).toBe(group.rows);
    expect(childrenOf(RECIPE_TABLE)).not.toBe(RECIPE_TABLE.header);
    const leaf = RECIPE_TABLE.header[0]?.cells[0]?.children[0];
    if (leaf === undefined) {
      throw new Error('the recipe header should carry a cell holding a block');
    }
    expect(childrenOf(leaf)).not.toBe(childrenOf(leaf));
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
    expect([...walk(tree)].map((node) => node.id)).toStrictEqual([
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
    expect(findNodeById(tree, 'label')?.type).toBe('text');
  });

  it('returns undefined rather than throwing when the id is absent', () => {
    expect(findNodeById(tree, 'nope')).toBeUndefined();
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
    expect(collectDataPaths(tree)).toStrictEqual(['invoice.lines']);
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
    // Le tableau seul : il ne lit rien de son côté, `nodeReads(table)` est NO_READS.
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
});

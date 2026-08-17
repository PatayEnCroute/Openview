import { describe, expect, it } from 'vitest';
import { TemplateShapeError } from '../../errors.js';
import { parseBlockNode } from '../../template/guard.js';
import { parseTemplate } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION, TemplateSchema } from '../../template/template.js';
import {
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  TABLE_COLUMN_ALIGNMENTS,
  type TableColumn,
  TableNodeSchema,
} from '../nodes.js';
import { RECIPE_TABLE, RECIPE_TEMPLATE } from './fixtures.js';

/**
 * The SOLE fault of a table, as a `(path, message)` pair, or `undefined` when it parsed.
 *
 * Asserts the issue COUNT rather than reading `issues[0]` off an arbitrarily long list, and
 * that is the correction of a real defect: every caller below claims to pin one refusal, and
 * four of them were feeding a table broken in thirteen independent ways. Reading position 0
 * was green either way, so the property this file cares about most -- one fault, one message
 * for lot C8 -- went unmeasured on exactly the inputs where it broke. It also removes a
 * dependency on zod's issue ORDER, which is not contractual.
 */
const soleIssueOf = (raw: unknown): { path: string; message: string } | undefined => {
  const result = TableNodeSchema.safeParse(raw);
  if (result.success) {
    return undefined;
  }
  const issues = result.error.issues;
  if (issues.length !== 1) {
    throw new Error(
      `expected exactly one issue, got ${issues.length}: ${issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  const issue = issues[0];
  return issue === undefined ? undefined : { path: issue.path.join('.'), message: issue.message };
};

/**
 * The recipe table with ONE column and NO rows -- the shape every width refusal takes.
 *
 * The rows are cleared, and they have to be: keeping the recipe's twelve cells while replacing
 * five columns with one leaves eleven of them naming columns that no longer exist, so a width
 * test measured a table with twelve extra orphan faults. The fault under test is the width.
 */
const withColumn = (column: unknown): unknown => ({
  ...RECIPE_TABLE,
  columns: [column],
  header: [],
  body: [],
  footer: [],
});

describe('TableNodeSchema', () => {
  it('refuses a table that declares no column', () => {
    expect(soleIssueOf({ ...RECIPE_TABLE, columns: [] })).toStrictEqual({
      path: 'columns',
      message: 'A table needs at least one column',
    });
  });

  it('refuses a column without an id', () => {
    expect(soleIssueOf(withColumn({ id: '', width: 1, align: 'start' }))).toStrictEqual({
      path: 'columns.0.id',
      message: 'A table column id is required',
    });
  });

  it('refuses two columns sharing an id', () => {
    // Le message est CONSTANT : il n'interpole pas le contenu du modèle, parce qu'un
    // `columnId` est choisi par l'auteur du modèle, c'est-à-dire par l'attaquant du modèle de
    // menace (ADR 0003:417). C'est le `path` qui désigne la faute.
    expect(
      soleIssueOf({
        ...RECIPE_TABLE,
        columns: [
          { id: 'designation', width: 8, align: 'start' },
          { id: 'designation', width: 2, align: 'end' },
        ],
      }),
    ).toStrictEqual({
      path: 'columns.1.id',
      message:
        'Two columns of this table share an id. A cell names its column, so the ids have to be unique within a table.',
    });
  });

  it('refuses a fractional width', () => {
    expect(soleIssueOf(withColumn({ id: 'a', width: 1.5, align: 'start' }))).toStrictEqual({
      path: 'columns.0.width',
      message: 'A column width is a whole number of weight units, not a length',
    });
  });

  it.each([0, -3])('refuses the width %i, below the window', (width) => {
    // Cinq entrées fautives pour QUATRE messages : `0` et `-3` rendent le même `too_small`,
    // et écrire un `it` par entrée en ferait deux qui épinglent la même chaîne -- un test
    // tautologique au sens d'AGENTS.md §5.
    expect(soleIssueOf(withColumn({ id: 'a', width, align: 'start' }))).toStrictEqual({
      path: 'columns.0.width',
      message: `A column width may not go below ${MIN_COLUMN_WIDTH}`,
    });
  });

  it('refuses a width above the window', () => {
    expect(
      soleIssueOf(withColumn({ id: 'a', width: MAX_COLUMN_WIDTH + 1, align: 'start' })),
    ).toStrictEqual({
      path: 'columns.0.width',
      message: `A column width may not exceed ${MAX_COLUMN_WIDTH}`,
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('refuses the non-finite width %p', (width) => {
    // `z.number()` n'accepte que le fini, donc un `.finite()` ne tirerait jamais, et les deux
    // entrées rendent le MÊME message -- celui de l'option `error` du champ.
    expect(soleIssueOf(withColumn({ id: 'a', width, align: 'start' }))).toStrictEqual({
      path: 'columns.0.width',
      message: 'A column width is a finite whole number of weight units',
    });
  });

  it('refuses an alignment it does not know', () => {
    expect(soleIssueOf(withColumn({ id: 'a', width: 1, align: 'left' }))).toStrictEqual({
      path: 'columns.0.align',
      message: 'Invalid option: expected one of "start"|"center"|"end"',
    });
  });

  it('refuses a cell naming a column the table does not declare', () => {
    expect(
      soleIssueOf({
        ...RECIPE_TABLE,
        footer: [
          {
            type: 'tableRow',
            id: 'ligne-total',
            cells: [
              { columnId: 'designation', children: [] },
              { columnId: 'tva', children: [] },
            ],
          },
        ],
      }),
    ).toStrictEqual({
      path: 'footer.0.cells.1.columnId',
      message:
        'This cell names a column the table does not declare. Add that column, or point the cell at one of the declared ids.',
    });
  });

  it('refuses two cells of one row filling the same column', () => {
    expect(
      soleIssueOf({
        ...RECIPE_TABLE,
        body: [
          {
            type: 'tableRow',
            id: 'doublon',
            cells: [
              { columnId: 'quantite', children: [] },
              { columnId: 'quantite', children: [] },
            ],
          },
        ],
      }),
    ).toStrictEqual({
      path: 'body.0.cells.1.columnId',
      message: 'This row already fills this column. A row fills a column at most once.',
    });
  });

  it('refuses a row group carrying no row', () => {
    expect(
      soleIssueOf({
        ...RECIPE_TABLE,
        body: [
          {
            type: 'tableRowGroup',
            id: 'vide',
            each: { kind: 'path', path: 'facture.lignes' },
            as: 'ligne',
            rows: [],
          },
        ],
      }),
    ).toStrictEqual({
      path: 'body.0.rows',
      message: 'A table row group needs at least one row',
    });
  });

  it('refuses a forbidden alias on a group, through the aliasSchema that predates this lot', () => {
    expect(
      soleIssueOf({
        ...RECIPE_TABLE,
        body: [
          {
            type: 'tableRowGroup',
            id: 'g',
            each: { kind: 'path', path: 'facture.lignes' },
            as: '__proto__',
            rows: [{ type: 'tableRow', id: 'r', cells: [] }],
          },
        ],
      }),
    ).toStrictEqual({
      path: 'body.0.as',
      message:
        'An alias must be a single identifier, and may not be __proto__, constructor or prototype',
    });
  });

  it('ACCEPTS a short row: one cell for five columns', () => {
    // Le pendant positif, obligatoire. Sans lui, rien ne distingue « la ligne courte est
    // licite » d'un refus qu'on aurait oublié d'écrire -- et c'est la forme même de la ligne
    // de total.
    const result = TableNodeSchema.safeParse({
      ...RECIPE_TABLE,
      footer: [{ type: 'tableRow', id: 'court', cells: [{ columnId: 'montant', children: [] }] }],
    });

    expect(result.success).toBe(true);
  });

  it('names ONE fault when a table declares no column, whatever its rows hold', () => {
    // Le garde `declared.size === 0` de `checkTableWiring` est ce qui tient ce compte à 1.
    // MESURÉ en le retirant du `dist` compilé, tout le reste inchangé : la même entrée rend 13
    // issues -- une par cellule du tableau, plus celle de `columns`. Un auteur qui a oublié de
    // déclarer ses colonnes a UNE chose à corriger, et C8 doit le lui dire une fois.
    const result = TableNodeSchema.safeParse({ ...RECIPE_TABLE, columns: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.path).toStrictEqual(['columns']);
      expect(result.error.issues[0]?.message).toBe('A table needs at least one column');
    }
  });

  it('lets a BOUND fault and a wiring fault be reported together, and a TYPE fault mask it', () => {
    // La dépendance de ce lot au comportement de zod 4, épinglée plutôt que supposée : un
    // `superRefine` est sauté sur `invalid_type` / `invalid_value`, jamais sur `too_small`.
    // A rejouer a chaque montee de zod, comme l'ADR 0004 le fait pour la regle nursery de Biome.
    const withOrphan = (column: TableColumn): unknown => ({
      type: 'table',
      id: 't',
      columns: [column],
      header: [],
      body: [],
      footer: [{ type: 'tableRow', id: 'f', cells: [{ columnId: 'tva', children: [] }] }],
    });

    const bound = TableNodeSchema.safeParse(withOrphan({ id: 'a', width: 0, align: 'start' }));
    const masked = TableNodeSchema.safeParse(withOrphan({ id: 'a', width: 1.5, align: 'start' }));

    expect(bound.success).toBe(false);
    expect(masked.success).toBe(false);
    // `too_small` est continuable : la borne ET le câblage sont rapportés.
    if (!bound.success) expect(bound.error.issues).toHaveLength(2);
    // `invalid_type` abandonne : la cellule orpheline reste invisible jusqu'à correction.
    if (!masked.success) expect(masked.error.issues).toHaveLength(1);
  });
});

describe('the block flow', () => {
  it('refuses a bare row in a document flow, on the path of the flow', () => {
    const strayRow = {
      ...RECIPE_TEMPLATE,
      root: {
        type: 'container',
        id: 'racine',
        children: [...RECIPE_TEMPLATE.root.children, { type: 'tableRow', id: 'nue', cells: [] }],
      },
    };

    // Le bon endroit : le FLUX DE BLOCS, et non « quelque part dans un tableau ». L'assertion
    // porte sur le CHEMIN et le CODE, pas sur le message : `toThrow(/Invalid input/)` restait
    // vert si `RECIPE_TEMPLATE` se mettait à être refusé pour une raison sans rapport.
    const result = TemplateSchema.safeParse(strayRow);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.path).toStrictEqual(['root', 'children', 2, 'type']);
      expect(issue?.code).toBe('invalid_union');
    }
    expect(() => parseTemplate(strayRow)).toThrow();
  });

  it('bounds what the bare block union does not', () => {
    // La porte bornée est ce que `core` doit à ses appelants : un `TemplateShapeError`
    // `too-deep` plutôt qu'un `RangeError` nu. C'est la seule moitié du contrat qui soit à nous.
    //
    // La seconde jambe -- `expect(() => BlockNodeSchema.parse(deep)).toThrow(RangeError)` --
    // est RETIRÉE, et son motif s'écrit plutôt que de se perdre : elle épinglait le MOTEUR et
    // non le code. Mesuré dans ce dépôt, la profondeur à laquelle la récursion de Zod cède
    // dépend de la pile ET du JIT : 937 niveaux sur le pool `forks` par défaut, 3 750 dans un
    // worker à pile de 4 Mo, et **5 000 passe sans lever** une fois le JIT chauffé par quelques
    // parses profonds dans le même worker. `vitest.config.ts` ne fixe aucun `pool`, donc un
    // simple changement de pool ou une image de CI différente suffit à déplacer le seuil : la
    // jambe rougirait pour une raison entièrement extérieure à `core`. C'est exactement ce que
    // `value-type.test.ts:103-118` a dû faire quand Node 26 a cessé de récurser, et le
    // commentaire de ce test annonçait déjà ce retrait -- il fallait l'exécuter.
    //
    // La borne, elle, ne dépend d'aucun moteur : `maxDepth` vaut 64 et le refus est typé.
    const nestedContainers = (depth: number): unknown => {
      let node: unknown = { type: 'text', id: 'leaf', content: [] };
      for (let level = 0; level < depth; level += 1) {
        node = { type: 'container', id: `c${level}`, children: [node] };
      }
      return node;
    };

    expect(() => parseBlockNode(nestedContainers(5_000))).toThrow(TemplateShapeError);
  });

  it('refines a table through parseTemplate, not only through its own schema', () => {
    // La dépendance n° 1 du lot au comportement de zod, réellement REJOUÉE : « un
    // `z.object().superRefine()` reste un `ZodObject`, donc `TableNodeSchema` demeure membre
    // légal des deux unions discriminées, `lazy` comprises ». Toutes les autres assertions de
    // câblage appellent `TableNodeSchema.safeParse` sur un tableau NU, si bien qu'une montée de
    // zod qui dispatcherait vers l'objet interne plutôt que vers le schéma raffiné les
    // laisserait toutes vertes -- et `parseTemplate` accepterait une cellule orpheline, c'est-à
    // -dire du contenu que rien n'affichera jamais, persisté par `onSave`.
    const orphelin = {
      ...RECIPE_TEMPLATE,
      root: {
        type: 'container',
        id: 'racine',
        children: [
          {
            ...RECIPE_TABLE,
            footer: [
              {
                type: 'tableRow',
                id: 'ligne-total',
                cells: [{ columnId: 'tva', children: [] }],
              },
            ],
          },
        ],
      },
    };

    const result = TemplateSchema.safeParse(orphelin);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toStrictEqual([
        'root',
        'children',
        0,
        'footer',
        0,
        'cells',
        0,
        'columnId',
      ]);
    }
    expect(() => parseTemplate(orphelin)).toThrow();
  });
});

describe('the recipe criterion', () => {
  it('describes the recipe table in a stored template, header included', () => {
    const parsed = parseTemplate(RECIPE_TEMPLATE);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // L'aller-retour JSON est ce qui prouve que le modèle est STOCKABLE, pas seulement
    // constructible : un champ que le schéma laisse tomber se voit ici et nulle part ailleurs.
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(RECIPE_TEMPLATE);
  });

  it('leaves the last row a SHORT row carrying an expression of the model', () => {
    const total = RECIPE_TABLE.footer[0];

    expect(total?.cells).toHaveLength(2);
    expect(RECIPE_TABLE.columns).toHaveLength(5);
    // Le nœud tableau porte exactement ces six clés, et la ligne de total ne porte AUCUNE clé
    // de plus qu'une ligne ordinaire. Ce que cette assertion attrape : un champ REQUIS ajouté
    // à `TableNode` ou à `TableColumn`. Ce qu'elle N'attrape PAS, et c'est le cas probable :
    // un `total?:` optionnel, qui n'apparaîtrait pas dans la fixture. Le refus de l'auto-somme
    // est structurel AU SENS DU TYPE pour le pied -- `readonly TableRowNode[]` n'a nulle part
    // où poser un agrégat -- et doctrinal, adossé à un grep, pour la colonne.
    expect(Object.keys(RECIPE_TABLE)).toStrictEqual([
      'type',
      'id',
      'columns',
      'header',
      'body',
      'footer',
    ]);
    for (const column of RECIPE_TABLE.columns) {
      expect(Object.keys(column)).toStrictEqual(['id', 'width', 'align']);
    }
  });

  it('gives every column a whole-number weight inside the window, and an alignment', () => {
    for (const column of RECIPE_TABLE.columns) {
      expect(Number.isInteger(column.width)).toBe(true);
      expect(column.width).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
      expect(column.width).toBeLessThanOrEqual(MAX_COLUMN_WIDTH);
      expect(TABLE_COLUMN_ALIGNMENTS).toContain(column.align);
    }
    // « libellés à gauche, montants à droite » -- le membre du critère que l'alignement sert,
    // et la raison pour laquelle il vit dans C3 et pas dans C5.
    expect(RECIPE_TABLE.columns.map((column) => column.align)).toStrictEqual([
      'start',
      'end',
      'end',
      'end',
      'end',
    ]);
  });
});

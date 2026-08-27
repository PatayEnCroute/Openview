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
 * The sole issue of a table as a `(path, message)` pair, or `undefined` when parsing succeeds.
 *
 * Asserts that exactly one validation issue is raised, ensuring precise fault isolation
 * without relying on non-contractual issue ordering.
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
    // The error message is constant and does not interpolate template content, because columnId
    // is user-supplied (threat model ADR 0003). The path indicates the faulty field.
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
    // Both 0 and -3 yield the same too_small error; testing them with each avoids redundant tests.
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
    // Non-finite numbers are rejected with the schema custom error message.
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
    // Verifies that a short row is valid, which is the structure used for total rows.
    const result = TableNodeSchema.safeParse({
      ...RECIPE_TABLE,
      footer: [{ type: 'tableRow', id: 'court', cells: [{ columnId: 'montant', children: [] }] }],
    });

    expect(result.success).toBe(true);
  });

  it('names ONE fault when a table declares no column, whatever its rows hold', () => {
    // The declared.size === 0 guard ensures exactly one error is emitted when no columns are declared.
    const result = TableNodeSchema.safeParse({ ...RECIPE_TABLE, columns: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.path).toStrictEqual(['columns']);
      expect(result.error.issues[0]?.message).toBe('A table needs at least one column');
    }
  });

  it('lets a BOUND fault and a wiring fault be reported together, and a TYPE fault mask it', () => {
    // Zod continues refinement on bounds (too_small) but halts on invalid_type.
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
    // `too_small` is continuable: both bound and wiring are reported.
    if (!bound.success) expect(bound.error.issues).toHaveLength(2);
    // `invalid_type` halts: orphan cell remains unreached until fixed.
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

    // Asserts that stray rows in container flow are refused with a typed invalid_union error on path.
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
    // Bounded parseBlockNode rejects deep tree hierarchies with a typed TemplateShapeError.
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
    // Confirms that TableNodeSchema refinements apply when parsed as part of a full Template.
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
    // JSON round-trip verifies the model is serializable.
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(RECIPE_TEMPLATE);
  });

  it('leaves the last row a SHORT row carrying an expression of the model', () => {
    const total = RECIPE_TABLE.footer[0];

    expect(total?.cells).toHaveLength(2);
    expect(RECIPE_TABLE.columns).toHaveLength(5);
    // Asserts exact expected keys on table and columns without auto-aggregation fields.
    expect(Object.keys(RECIPE_TABLE)).toStrictEqual([
      'type',
      'id',
      'box',
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
    // Column alignments: labels to the start, amounts to the end.
    expect(RECIPE_TABLE.columns.map((column) => column.align)).toStrictEqual([
      'start',
      'end',
      'end',
      'end',
      'end',
    ]);
  });
});

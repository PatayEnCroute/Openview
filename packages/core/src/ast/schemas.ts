import { z } from 'zod/v4';
import {
  aliasSchema,
  ExpressionSchema,
  PrintableExpressionSchema,
} from '../expression/expression.js';
import {
  type BlockNode,
  type DocumentNode,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  TABLE_COLUMN_ALIGNMENTS,
  type TableCell,
  type TableNode,
} from './types.js';

const nodeIdSchema = z.string().min(1, 'A node id is required');

export const TextLiteralSegmentSchema = z.object({
  kind: z.literal('literal'),
  text: z.string(),
});

export const TextBindingSegmentSchema = z.object({
  kind: z.literal('binding'),
  value: PrintableExpressionSchema,
});

/**
 * No `z.ZodType<TextSegment>` annotation, and `DocumentNodeSchema`'s explicit
 * binding below does **not** police this union in its place: zod declares
 * `ZodType<out Output, ...>`, so it is covariant in its output and a schema that
 * produces *less* than `TextSegment` stays assignable and still compiles. The
 * real guard is the mutual-assignability assertion in nodes.test.ts, which fails
 * in both directions.
 */
export const TextSegmentSchema = z.discriminatedUnion('kind', [
  TextLiteralSegmentSchema,
  TextBindingSegmentSchema,
]);

export const TextNodeSchema = z.object({
  type: z.literal('text'),
  id: nodeIdSchema,
  content: z.array(TextSegmentSchema),
});

export const ImageNodeSchema = z.object({
  type: z.literal('image'),
  id: nodeIdSchema,
  src: z.string().min(1, 'An image src is required'),
  alt: z.string().optional(),
});

/**
 * The members of each family, as functions for the reason `expression/schemas.ts` already
 * gives: they are called from inside a `z.lazy` body, where the temporal dead zone has
 * closed. The two unions below are BUILT from these lists rather than restated, so they
 * cannot drift from each other.
 *
 * What no compiler catches is a member missing from BOTH -- `z.ZodType` is covariant in its
 * output, so a union producing less than its annotation still compiles, and a
 * mutual-assignability assertion on an ANNOTATED schema is tautological. Only a runtime
 * parsing test catches that, and that is why there is one per node type.
 */
function blockMembers() {
  return [
    TextNodeSchema,
    ImageNodeSchema,
    ContainerNodeSchema,
    LoopNodeSchema,
    ConditionNodeSchema,
    TableNodeSchema,
  ] as const;
}

function rowMembers() {
  return [TableRowNodeSchema, TableRowGroupNodeSchema] as const;
}

/**
 * The recursive binding for a block flow. `z.lazy` defers resolution so the schemas below
 * can reference it before they are initialised, and the explicit `z.ZodType<BlockNode>`
 * annotation keeps the inferred type from collapsing.
 *
 * **`.parse` on this schema bounds nothing.** A deep enough payload raises a bare
 * `RangeError` from Zod's own recursion rather than a typed refusal; use `parseBlockNode`
 * from `template/guard.ts` for the bounded door.
 */
export const BlockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion('type', blockMembers()),
);

/**
 * Every node type, rows included. A row is only ever reached through its table when a
 * template is parsed; this union exists for `parseDocumentNode`, for a Designer validating a
 * subtree it holds in hand, and so `DocumentNode` has one schema.
 */
export const DocumentNodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion('type', [...blockMembers(), ...rowMembers()]),
);

export const ContainerNodeSchema = z.object({
  type: z.literal('container'),
  id: nodeIdSchema,
  children: z.array(BlockNodeSchema),
});

export const LoopNodeSchema = z.object({
  type: z.literal('loop'),
  id: nodeIdSchema,
  each: ExpressionSchema,
  as: aliasSchema,
  children: z.array(BlockNodeSchema),
});

export const ConditionNodeSchema = z.object({
  type: z.literal('condition'),
  id: nodeIdSchema,
  when: ExpressionSchema,
  children: z.array(BlockNodeSchema),
});

/**
 * `z.number()` accepts finite values only, so `Infinity` and `NaN` are already refused and a
 * `.finite()` check would never fire. Everything a column can get wrong is decidable without
 * any data, so it is refused when the template is SAVED and adds no entry to the error
 * catalogue lot C8 enumerates.
 */
export const TableColumnSchema = z.object({
  id: z.string().min(1, 'A table column id is required'),
  width: z
    .number({ error: 'A column width is a finite whole number of weight units' })
    .int('A column width is a whole number of weight units, not a length')
    .min(MIN_COLUMN_WIDTH, `A column width may not go below ${MIN_COLUMN_WIDTH}`)
    .max(MAX_COLUMN_WIDTH, `A column width may not exceed ${MAX_COLUMN_WIDTH}`),
  align: z.enum(TABLE_COLUMN_ALIGNMENTS),
});

export const TableCellSchema = z.object({
  columnId: z.string().min(1, 'A table cell must name the column it fills'),
  children: z.array(BlockNodeSchema),
});

export const TableRowNodeSchema = z.object({
  type: z.literal('tableRow'),
  id: nodeIdSchema,
  cells: z.array(TableCellSchema),
});

export const TableRowGroupNodeSchema = z.object({
  type: z.literal('tableRowGroup'),
  id: nodeIdSchema,
  each: ExpressionSchema,
  as: aliasSchema,
  rows: z.array(TableRowNodeSchema).min(1, 'A table row group needs at least one row'),
});

/**
 * Not lazy, and therefore declared AFTER its two members: `rowMembers()` is called here at
 * module-initialisation time, so the temporal dead zone is still open above this line.
 */
export const TableBodyNodeSchema = z.discriminatedUnion('type', rowMembers());

/**
 * The two faults a row can have against its table, and the asymmetry between them is
 * deliberate.
 *
 * A row that fills FEWER columns than the table declares is legal: the columns it does not
 * fill receive no content from this row, and that is exactly the shape of a totals row. A
 * cell naming a column that does not exist is refused -- it is content that would never be
 * shown, so accepting it would be a silent loss, the one thing the versioning doctrine of
 * this package exists to prevent. Two cells for one column in one row is refused for the
 * same reason: the second would be dropped.
 *
 * Checked on the TABLE, which is the one node that can see both sides, and one level deep
 * only: a nested table validates its own rows against its own columns. Iteration goes
 * through `entries()`, so nothing here meets `T | undefined` and nothing needs a non-null
 * assertion.
 *
 * No message interpolates the document. The `path` designates the fault exactly -- e.g.
 * `['footer', 0, 'cells', 1, 'columnId']` -- and displaying the offending id is the editor's
 * job: it holds the tree, and it reads it at the path this reports.
 */
function checkCells(
  cells: readonly TableCell[],
  declared: ReadonlySet<string>,
  at: readonly (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const filled = new Set<string>();
  for (const [index, cell] of cells.entries()) {
    const path = [...at, 'cells', index, 'columnId'];
    if (!declared.has(cell.columnId)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path],
        message:
          'This cell names a column the table does not declare. Add that column, or point the cell at one of the declared ids.',
      });
      // Not recorded as filled: a second cell naming the same absent column has the same
      // fault as the first, and reporting the second as a duplicate would name the wrong one.
      continue;
    }
    if (filled.has(cell.columnId)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path],
        message: 'This row already fills this column. A row fills a column at most once.',
      });
    }
    filled.add(cell.columnId);
  }
}

function checkTableWiring(table: TableNode, ctx: z.RefinementCtx): void {
  const declared = new Set<string>();
  for (const [index, column] of table.columns.entries()) {
    if (declared.has(column.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['columns', index, 'id'],
        message:
          'Two columns of this table share an id. A cell names its column, so the ids have to be unique within a table.',
      });
    }
    declared.add(column.id);
  }

  if (declared.size === 0) {
    // `columns.min(1)` has already named the one fault -- and it does NOT stop this function
    // from running, because `too_small` is a continuable issue in zod 4. Walking the rows now
    // would report every cell in the table as an orphan and bury that one fault: measured, 13
    // issues instead of 1 on a twelve-cell table. An author who forgot to declare the columns
    // has ONE thing to fix, and lot C8 has to say it once.
    return;
  }

  for (const [index, row] of table.header.entries()) {
    checkCells(row.cells, declared, ['header', index], ctx);
  }
  for (const [index, entry] of table.body.entries()) {
    // Not a second `switch (node.type)`, and not a traversal: this descends into no child,
    // it reads one node's own two-member body union, and Zod has already discriminated it.
    // Routing it through `visitNode` would make this module depend on the traversal module in
    // order to dispatch two cases.
    //
    // What holds this branch to the union is NOT this line: measured, a third member carrying
    // `rows: readonly TableRowNode[]` compiles here at exit 0 and is silently absorbed by the
    // `else`. `TABLE_BODY_MEMBERS_IN_STEP` in `ast/__tests__/nodes.test.ts` is what fails to
    // compile the day the union gains any third member at all.
    if (entry.type === 'tableRow') {
      checkCells(entry.cells, declared, ['body', index], ctx);
    } else {
      for (const [rowIndex, row] of entry.rows.entries()) {
        checkCells(row.cells, declared, ['body', index, 'rows', rowIndex], ctx);
      }
    }
  }
  for (const [index, row] of table.footer.entries()) {
    checkCells(row.cells, declared, ['footer', index], ctx);
  }
}

/**
 * A refined object stays a `ZodObject` in zod 4 -- refinements live inside the schema rather
 * than wrapping it -- so this remains a legal member of the discriminated unions above, lazy
 * ones included. That is a dependency on library behaviour, it is measured, and it is to be
 * replayed on every zod upgrade.
 */
export const TableNodeSchema = z
  .object({
    type: z.literal('table'),
    id: nodeIdSchema,
    columns: z.array(TableColumnSchema).min(1, 'A table needs at least one column'),
    header: z.array(TableRowNodeSchema),
    body: z.array(TableBodyNodeSchema),
    footer: z.array(TableRowNodeSchema),
  })
  .superRefine(checkTableWiring);

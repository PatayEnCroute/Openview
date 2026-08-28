import { z } from 'zod/v4';
import {
  aliasSchema,
  ExpressionSchema,
  PrintableExpressionSchema,
  ROUND_MODES,
  RoundingPositionSchema,
} from '../expression/expression.js';
import { MAX_SHEET_MM } from '../page/types.js';
import { BoxStyleSchema, TypographySchema } from '../style/style.js';
import {
  COLUMN_WIDTH_TYPE_MESSAGE,
  KEEP_TOGETHER_VALUE_MESSAGE,
  PAGE_FIELD_NAME_MESSAGE,
  PRESENTATION_FORMAT_KIND_MESSAGE,
  PRESENTATION_FORMAT_PROFILE_MESSAGE,
} from '../validation-messages.js';
import {
  type BlockNode,
  type DocumentNode,
  type GridItem,
  type GridNode,
  MAX_COLUMN_WIDTH,
  MAX_GRID_TRACKS,
  MIN_COLUMN_WIDTH,
  MIN_GRID_TRACKS,
  PAGE_FIELDS,
  type PageField,
  PRESENTATION_FORMAT_KINDS,
  type PresentationFormatKind,
  TABLE_COLUMN_ALIGNMENTS,
  type TableCell,
  type TableNode,
  type TableRowNode,
  TEXT_ALIGNMENTS,
} from './types.js';

const nodeIdSchema = z.string().min(1, 'A node id is required');
/**
 * Accepts `true`, and `undefined` whether written or omitted -- a written `undefined` is kept in
 * memory but drops at serialisation, so `true` and the absent key are the only persisted spellings.
 */
const keepTogetherField = z
  .literal(true, {
    error: KEEP_TOGETHER_VALUE_MESSAGE,
  })
  .optional();
const boxField = BoxStyleSchema.optional();
const typographyField = TypographySchema.optional();

/** Schemes an image source can never denote. */
const DANGEROUS_URI_SCHEME = /^(?:javascript|vbscript|file|data(?!:image\/)):/i;

/**
 * Drops what an HTML or URL parser discards before it reads a scheme -- ASCII whitespace,
 * C0 controls and DEL -- so a tab spliced into `javascript:` cannot slip past the check.
 */
function withoutIgnorableChars(value: string): string {
  return [...value]
    .filter((char) => {
      const code = char.codePointAt(0);
      return code !== undefined && code > 0x20 && code !== 0x7f;
    })
    .join('');
}

/**
 * An image source. Refuses code-bearing and host-local schemes, and imposes no URL grammar
 * otherwise: a src may be an asset key the host application resolves under its own naming.
 * Outbound request policy -- private ranges, cloud metadata -- stays the renderer's, since no
 * hostname pattern survives a DNS rebind.
 */
const imageSourceSchema = z
  .string()
  .min(1, 'An image src is required')
  .refine(
    (src) => !DANGEROUS_URI_SCHEME.test(withoutIgnorableChars(src)),
    'An image src may not carry the javascript:, vbscript:, file: or a non-image data: scheme. Use an http(s) URL, a data:image/... URI, or a path the host application resolves.',
  );

/** A profile is the author's own name for a writing role: non-empty, and reserved by nobody. */
const formatProfileSchema = z.string().min(1, PRESENTATION_FORMAT_PROFILE_MESSAGE);

/** The two numeric functions, spelt from the closed list so a fourth kind cannot be forgotten. */
const NUMERIC_FORMAT_KINDS = PRESENTATION_FORMAT_KINDS.filter(
  (kind): kind is Exclude<PresentationFormatKind, 'date'> => kind !== 'date',
);

export const PresentationFormatSchema = z.object({
  kind: z.enum(PRESENTATION_FORMAT_KINDS, PRESENTATION_FORMAT_KIND_MESSAGE),
  profile: formatProfileSchema,
});

export const NumericPresentationFormatSchema = z.object({
  kind: z.enum(NUMERIC_FORMAT_KINDS, PRESENTATION_FORMAT_KIND_MESSAGE),
  profile: formatProfileSchema,
});

export const DecimalPresentationFormatSchema = z.object({
  kind: z.literal('decimal', PRESENTATION_FORMAT_KIND_MESSAGE),
  profile: formatProfileSchema,
});

export const TextLiteralSegmentSchema = z.object({
  kind: z.literal('literal'),
  text: z.string(),
  typography: typographyField,
});

export const TextBindingSegmentSchema = z.object({
  kind: z.literal('binding'),
  value: PrintableExpressionSchema,
  format: PresentationFormatSchema.optional(),
  typography: typographyField,
});

/** The two counting fields, spelt from the closed list so a new field cannot be forgotten here. */
const COUNTING_FIELDS = PAGE_FIELDS.filter(
  (field): field is Exclude<PageField, 'report'> => field !== 'report',
);

export const TextPageCountSegmentSchema = z.object({
  kind: z.literal('pageField'),
  field: z.enum(COUNTING_FIELDS),
  format: DecimalPresentationFormatSchema.optional(),
  typography: typographyField,
});

export const TextPageReportSegmentSchema = z.object({
  kind: z.literal('pageField'),
  field: z.literal('report'),
  decimals: RoundingPositionSchema,
  mode: z.enum(ROUND_MODES),
  format: NumericPresentationFormatSchema.optional(),
  typography: typographyField,
});

/**
 * A page marker, discriminated a second time on the field it names.
 *
 * A report declares the rounding it is written at and the counters declare nothing, so one flat
 * object would have to accept a report with no rounding or a counter carrying one.
 */
export const TextPageFieldSegmentSchema = z.discriminatedUnion(
  'field',
  [TextPageCountSegmentSchema, TextPageReportSegmentSchema],
  /* Without it a field outside the list reads "Invalid input": a nested union reports a missing
     discriminator, not the options an enum would have listed. */
  { error: PAGE_FIELD_NAME_MESSAGE },
);

export const TextSegmentSchema = z.discriminatedUnion('kind', [
  TextLiteralSegmentSchema,
  TextBindingSegmentSchema,
  TextPageFieldSegmentSchema,
]);

export const TextNodeSchema = z.object({
  type: z.literal('text'),
  id: nodeIdSchema,
  keepTogether: keepTogetherField,
  content: z.array(TextSegmentSchema),
  box: boxField,
  typography: typographyField,
  align: z.enum(TEXT_ALIGNMENTS).optional(),
});

export const ImageNodeSchema = z.object({
  type: z.literal('image'),
  id: nodeIdSchema,
  keepTogether: keepTogetherField,
  src: imageSourceSchema,
  alt: z.string().optional(),
  box: boxField,
});

function blockMembers() {
  return [
    TextNodeSchema,
    ImageNodeSchema,
    ContainerNodeSchema,
    LoopNodeSchema,
    ConditionNodeSchema,
    TableNodeSchema,
    GridNodeSchema,
  ] as const;
}

function rowMembers() {
  return [TableRowNodeSchema, TableRowGroupNodeSchema] as const;
}

/** Zod schema for block nodes in the document flow. */
export const BlockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion('type', blockMembers()),
);

/** Zod schema for any document AST node (including table rows and row groups). */
export const DocumentNodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.discriminatedUnion('type', [...blockMembers(), ...rowMembers()]),
);

export const ContainerNodeSchema = z.object({
  type: z.literal('container'),
  id: nodeIdSchema,
  keepTogether: keepTogetherField,
  children: z.array(BlockNodeSchema),
  box: boxField,
});

export const LoopNodeSchema = z.object({
  type: z.literal('loop'),
  id: nodeIdSchema,
  keepTogether: keepTogetherField,
  each: ExpressionSchema,
  as: aliasSchema,
  children: z.array(BlockNodeSchema),
});

export const ConditionNodeSchema = z.object({
  type: z.literal('condition'),
  id: nodeIdSchema,
  keepTogether: keepTogetherField,
  when: ExpressionSchema,
  children: z.array(BlockNodeSchema),
});

export const TableColumnSchema = z.object({
  id: z.string().min(1, 'A table column id is required'),
  width: z
    .number({ error: COLUMN_WIDTH_TYPE_MESSAGE })
    .int('A column width is a whole number of weight units, not a length')
    .min(MIN_COLUMN_WIDTH, `A column width may not go below ${MIN_COLUMN_WIDTH}`)
    .max(MAX_COLUMN_WIDTH, `A column width may not exceed ${MAX_COLUMN_WIDTH}`),
  align: z.enum(TABLE_COLUMN_ALIGNMENTS),
});

export const TableCellSchema = z.object({
  columnId: z.string().min(1, 'A table cell must name the column it fills'),
  children: z.array(BlockNodeSchema),
});

export const PageReportContributionSchema = z.object({
  value: PrintableExpressionSchema,
});

export const TableRowNodeSchema = z.object({
  type: z.literal('tableRow'),
  id: nodeIdSchema,
  keepTogether: keepTogetherField,
  cells: z.array(TableCellSchema),
  pageReport: PageReportContributionSchema.optional(),
  box: boxField,
});

export const TableRowGroupNodeSchema = z.object({
  type: z.literal('tableRowGroup'),
  id: nodeIdSchema,
  keepTogether: keepTogetherField,
  each: ExpressionSchema,
  as: aliasSchema,
  rows: z.array(TableRowNodeSchema).min(1, 'A table row group needs at least one row'),
});

export const TableBodyNodeSchema = z.discriminatedUnion('type', rowMembers());

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

/**
 * Refuses a contribution declared where it has no single occurrence to be counted on.
 *
 * A header repeats on every page a table continues onto, and a footer closes the table rather than
 * detailing it. Both are refused where the position is still known, rather than left to a renderer
 * that would have to invent a rule for them.
 */
function checkNoContribution(
  row: TableRowNode,
  at: readonly (string | number)[],
  ctx: z.RefinementCtx,
): void {
  if (row.pageReport === undefined) {
    return;
  }
  ctx.addIssue({
    code: 'custom',
    path: [...at, 'pageReport'],
    message:
      'Only a body row contributes to a page report. A header row is repeated on every page and a footer row closes the table, so neither has one occurrence to count.',
  });
}

function checkTableWiring(table: TableNode, ctx: z.RefinementCtx): void {
  const declared = new Set<string>();
  let columnsAreSound = table.columns.length > 0;
  for (const [index, column] of table.columns.entries()) {
    if (declared.has(column.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['columns', index, 'id'],
        message:
          'Two columns of this table share an id. A cell names its column, so the ids have to be unique within a table.',
      });
      columnsAreSound = false;
    }
    if (column.id === '') {
      columnsAreSound = false;
    }
    declared.add(column.id);
  }

  if (!columnsAreSound) {
    return;
  }

  for (const [index, row] of table.header.entries()) {
    checkCells(row.cells, declared, ['header', index], ctx);
    checkNoContribution(row, ['header', index], ctx);
  }
  for (const [index, entry] of table.body.entries()) {
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
    checkNoContribution(row, ['footer', index], ctx);
  }
}

/** Zod schema for table nodes with structural validation of column and cell wiring. */
export const TableNodeSchema = z
  .object({
    type: z.literal('table'),
    id: nodeIdSchema,
    keepTogether: keepTogetherField,
    columns: z.array(TableColumnSchema).min(1, 'A table needs at least one column'),
    header: z.array(TableRowNodeSchema),
    body: z.array(TableBodyNodeSchema),
    footer: z.array(TableRowNodeSchema),
    box: boxField,
  })
  .check(z.superRefine(checkTableWiring));

const gridTrackCountSchema = z
  .number()
  .int('A grid axis declares a whole number of tracks')
  .min(MIN_GRID_TRACKS, `A grid declares at least ${MIN_GRID_TRACKS} track on each axis`)
  .max(MAX_GRID_TRACKS, `A grid declares at most ${MAX_GRID_TRACKS} tracks on each axis`);

const gridCoordinateSchema = z
  .number()
  .int('A grid coordinate is a whole track number')
  .min(1, 'A grid coordinate starts at 1');

const gridSpanSchema = z
  .number()
  .int('A grid span is a whole number of tracks')
  .min(2, 'A span of one is the absence of the field; omit it')
  .optional();

const gridStepSchema = z
  .number()
  .gt(0, 'A grid step is strictly positive')
  .max(MAX_SHEET_MM, `A grid step is at most ${MAX_SHEET_MM} mm`);

export const GridItemSchema = z.object({
  row: gridCoordinateSchema,
  column: gridCoordinateSchema,
  rowSpan: gridSpanSchema,
  columnSpan: gridSpanSchema,
  content: ContainerNodeSchema,
});

/** Whether a coordinate passed its own local bounds, so the cross-check must not cascade on it. */
function isCoordinate(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** Whether a span passed its own local bounds: absent, or a whole number of at least two tracks. */
function isSpan(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value >= 2);
}

/** Whether a track count passed its own local bounds, so the cross-check may run against it. */
function isAxisCount(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_GRID_TRACKS && value <= MAX_GRID_TRACKS;
}

/** Whether every local bound of a zone held, so the cross-check must not cascade on it. */
function isZoneLocallySound(item: GridItem): boolean {
  return (
    isCoordinate(item.row) &&
    isCoordinate(item.column) &&
    isSpan(item.rowSpan) &&
    isSpan(item.columnSpan)
  );
}

/** A zone whose local bounds held, with each absent span resolved to the one track it means. */
interface ResolvedZone {
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
}

/** Reads a locally sound zone with its spans resolved. */
function resolveZone(item: GridItem): ResolvedZone {
  return {
    row: item.row,
    column: item.column,
    rowSpan: item.rowSpan ?? 1,
    columnSpan: item.columnSpan ?? 1,
  };
}

/** Reports the axis a zone runs past, and answers whether it stays inside the grid. */
function checkZoneFits(
  zone: ResolvedZone,
  grid: GridNode,
  index: number,
  ctx: z.RefinementCtx,
): boolean {
  if (zone.row + zone.rowSpan - 1 > grid.rows) {
    ctx.addIssue({
      code: 'custom',
      path: ['items', index, 'row'],
      message:
        'This zone reaches past the last row of the grid. Lower its row or its rowSpan, or declare more rows.',
    });
    return false;
  }
  if (zone.column + zone.columnSpan - 1 > grid.columns) {
    ctx.addIssue({
      code: 'custom',
      path: ['items', index, 'column'],
      message:
        'This zone reaches past the last column of the grid. Lower its column or its columnSpan, or declare more columns.',
    });
    return false;
  }
  return true;
}

/**
 * Marks every cell a zone covers, and answers whether one was already taken.
 *
 * Occupancy uses `(row - 1) * columns + column - 1`: both axes are bounded by
 * {@link MAX_GRID_TRACKS}, so no key exceeds 999999 and no two coordinates collide. The scan stops
 * at the first shared cell, so a hostile pile of zones cannot turn the check quadratic.
 */
function claimZoneCells(zone: ResolvedZone, columns: number, occupied: Set<number>): boolean {
  for (let row = zone.row; row < zone.row + zone.rowSpan; row += 1) {
    for (let column = zone.column; column < zone.column + zone.columnSpan; column += 1) {
      const key = (row - 1) * columns + column - 1;
      if (occupied.has(key)) {
        return true;
      }
      occupied.add(key);
    }
  }
  return false;
}

/** Refuses zones that leave the grid and zones that share a coordinate. */
function checkGridZones(grid: GridNode, ctx: z.RefinementCtx): void {
  if (!isAxisCount(grid.rows) || !isAxisCount(grid.columns)) {
    return;
  }
  const occupied = new Set<number>();
  for (const [index, item] of grid.items.entries()) {
    if (!isZoneLocallySound(item)) {
      continue;
    }
    const zone = resolveZone(item);
    if (!checkZoneFits(zone, grid, index, ctx)) {
      continue;
    }
    if (claimZoneCells(zone, grid.columns, occupied)) {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index],
        message:
          'This zone shares a coordinate with an earlier zone of the grid. Two zones never overlap; depth belongs to page layers.',
      });
    }
  }
}

/** Zod schema for grid nodes with cross-validation of zone bounds and overlap. */
export const GridNodeSchema = z
  .object({
    type: z.literal('grid'),
    id: nodeIdSchema,
    keepTogether: keepTogetherField,
    columns: gridTrackCountSchema,
    rows: gridTrackCountSchema,
    step: gridStepSchema,
    items: z.array(GridItemSchema),
    box: boxField,
  })
  .check(z.superRefine(checkGridZones));

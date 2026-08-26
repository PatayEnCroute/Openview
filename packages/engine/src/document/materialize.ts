import {
  type ConditionNode,
  childScope,
  createBudget,
  type DocumentNode,
  type EvaluationBudget,
  type EvaluationLimits,
  type EvaluationScope,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  type ImageNode,
  type LoopNode,
  type PageBand,
  type PageBandOccurrence,
  printableAreaOf,
  resolveTextAlign,
  type TableColumn,
  type TableColumnAlignment,
  type TableNode,
  type TableRowGroupNode,
  type TableRowNode,
  type Template,
  type TextNode,
  type TextSegment,
  type Typography,
  valueTypeOf,
  visitNode,
  visitSegment,
} from '@openview/core';
import { type DocumentRegion, refusal, refusalOf } from '../errors.js';
import { printableText } from './printable.js';
import type {
  MaterialBlock,
  MaterialCell,
  MaterialContainer,
  MaterialDocument,
  MaterialPageBand,
  MaterialPageReport,
  MaterialRow,
  MaterialRowGroupOccurrence,
  MaterialRun,
  MaterialText,
  OccurrenceKey,
  ResolvedTypography,
} from './types.js';
import { resolveRunTypography } from './typography.js';

const EXPRESSION_REFUSED =
  'A formula of this template could not be evaluated against the supplied data. Read `details.diagnostics` for the operand or the bound that stopped it.';

const CONTRIBUTION_NOT_A_NUMBER =
  'A row declares what it contributes to the page report, and the formula produced something other than a finite number. Read `details.actualType` for what arrived; the value itself is deliberately not repeated.';

const CONTRIBUTION_IN_A_BAND =
  'A row inside a page band declares a contribution to the page report. A band is painted on every page its domain names, so the occurrence it would be counted on does not exist. Read `details.nodeId` for the row.';

/** Alignment used when neither the block nor its column declares one. */
const DEFAULT_ALIGN = 'start';

/**
 * Hands out one key per measurable occurrence of a single render.
 *
 * A counter, not a clock and not a random source: the same template and the same data produce the
 * same keys twice, which is what lets a measurement be replayed and compared.
 */
export interface KeySource {
  next(): OccurrenceKey;
  /**
   * The materialisation rank of one page-report contribution, zero-based.
   *
   * Kept beside the keys because it has the same lifetime and the same guarantee: a counter, so
   * the same template and the same data rank the same contributions the same way twice.
   */
  nextReportOrder(): number;
}

export function createKeySource(): KeySource {
  let issued = 0;
  let ranked = 0;
  return {
    next(): OccurrenceKey {
      issued += 1;
      return `o${issued}`;
    },
    nextReportOrder(): number {
      const rank = ranked;
      ranked += 1;
      return rank;
    },
  };
}

/** Everything a traversal step needs beyond the node itself. Internal to this package. */
export interface MaterializeContext {
  readonly scope: EvaluationScope;
  readonly budget: EvaluationBudget;
  readonly keys: KeySource;
  readonly region: DocumentRegion;
  /** Alignment of the enclosing table column, which a block alignment overrides. */
  readonly column: TableColumnAlignment | undefined;
  readonly path: readonly (string | number)[];
}

type Context = MaterializeContext;

function rejectAsBlock(node: DocumentNode): never {
  throw refusal(
    'A table row reached the block flow, where only blocks belong. Rows are reachable through their table alone.',
    'template-refused',
    { nodeId: node.id },
  );
}

function rejectAsRow(node: DocumentNode): never {
  throw refusal(
    'A block reached the body of a table, where only rows and row groups belong.',
    'template-refused',
    { nodeId: node.id },
  );
}

function within<TResult>(nodeId: string, context: Context, evaluate: () => TResult): TResult {
  try {
    return evaluate();
  } catch (error) {
    throw refusalOf(error, EXPRESSION_REFUSED, 'expression-refused', {
      nodeId,
      path: context.path,
      region: context.region,
    });
  }
}

function runOf(
  segment: TextSegment,
  block: TextNode,
  index: number,
  context: Context,
): MaterialRun {
  const complete = (run: Typography | undefined): ResolvedTypography =>
    resolveRunTypography(run, block.typography);
  const at = [...context.path, 'content', index];
  return visitSegment<MaterialRun>(segment, {
    literal: (literal) => ({
      kind: 'text',
      text: literal.text,
      typography: complete(literal.typography),
    }),
    binding: (binding) => ({
      kind: 'text',
      text: printableText(
        within(block.id, { ...context, path: at }, () =>
          evaluateExpression(binding.value, context.scope, { budget: context.budget }),
        ),
        { nodeId: block.id, path: at, region: context.region },
      ),
      typography: complete(binding.typography),
    }),
    /* No digits here: which page holds this run, and which rows ended before it, are decided by
       the cuts. The marker travels as itself and page composition writes its value. */
    pageField: (field) =>
      field.field === 'report'
        ? {
            kind: 'pageField',
            field: 'report',
            decimals: field.decimals,
            mode: field.mode,
            typography: complete(field.typography),
          }
        : {
            kind: 'pageField',
            field: field.field,
            typography: complete(field.typography),
          },
  });
}

function materializeText(node: TextNode, context: Context): MaterialText {
  return {
    kind: 'text',
    key: context.keys.next(),
    nodeId: node.id,
    path: context.path,
    box: node.box,
    keepTogether: node.keepTogether === true,
    align: resolveTextAlign({ text: node.align, column: context.column }) ?? DEFAULT_ALIGN,
    runs: node.content.map((segment, index) => runOf(segment, node, index, context)),
  };
}

function materializeImage(node: ImageNode, context: Context): MaterialBlock {
  return {
    kind: 'image',
    key: context.keys.next(),
    nodeId: node.id,
    path: context.path,
    box: node.box,
    keepTogether: node.keepTogether === true,
    src: node.src,
    alt: node.alt,
  };
}

function materializeChildren(
  children: readonly DocumentNode[],
  context: Context,
): readonly MaterialBlock[] {
  return children.flatMap((child, index) =>
    materializeNode(child, { ...context, path: [...context.path, 'children', index] }),
  );
}

/**
 * Wraps one occurrence of a marked loop or condition so the paginator has something to keep whole.
 *
 * The wrapper carries no box and no style, and Chromium gives the flow inside it exactly the widths
 * and heights the flattened flow had. It exists only when the mark asks for it: an unmarked node
 * still flattens, so no document pays for a boundary nothing reads.
 */
function transparentGroup(
  nodeId: string,
  children: readonly MaterialBlock[],
  context: Context,
): MaterialContainer {
  return {
    kind: 'container',
    key: context.keys.next(),
    nodeId,
    path: context.path,
    box: undefined,
    keepTogether: true,
    children,
  };
}

function materializeLoop(node: LoopNode, context: Context): readonly MaterialBlock[] {
  const items = within(node.id, context, () =>
    evaluateSequence(node.each, context.scope, { budget: context.budget, caller: 'loop' }),
  );
  /* One group per item, never one around all of them: a marked loop asks for each iteration to
     stay whole, and a single group of sixty would be a block no page could hold. */
  return items.flatMap((item, index) => {
    const inner: Context = {
      ...context,
      scope: childScope(context.scope, node.as, item),
      path: [...context.path, index],
    };
    const children = materializeChildren(node.children, inner);
    return node.keepTogether === true ? [transparentGroup(node.id, children, inner)] : children;
  });
}

function materializeCondition(node: ConditionNode, context: Context): readonly MaterialBlock[] {
  const holds = within(node.id, context, () =>
    evaluatePredicate(node.when, context.scope, { budget: context.budget, caller: 'condition' }),
  );
  if (!holds) {
    /* A branch that does not hold produces no occurrence, so there is nothing for a mark to keep. */
    return [];
  }
  const children = materializeChildren(node.children, context);
  return node.keepTogether === true ? [transparentGroup(node.id, children, context)] : children;
}

function materializeCell(
  row: TableRowNode,
  column: TableColumn,
  index: number,
  context: Context,
): MaterialCell {
  const declared = row.cells.find((candidate) => candidate.columnId === column.id);
  return {
    key: context.keys.next(),
    columnId: column.id,
    children:
      declared === undefined
        ? []
        : materializeChildren(declared.children, {
            ...context,
            column: column.align,
            path: [...context.path, 'cells', index],
          }),
  };
}

/**
 * Evaluates what one occurrence of a row contributes, in that occurrence's own scope.
 *
 * Once per occurrence and on the shared budget: sixty repetitions cost sixty evaluations, never one
 * per page and never one per settling round. A value that is not a finite number is refused with
 * the category of what arrived and nothing of the value itself.
 */
function contributionOf(
  row: TableRowNode,
  key: OccurrenceKey,
  context: Context,
): MaterialPageReport | undefined {
  const declared = row.pageReport;
  if (declared === undefined) {
    return undefined;
  }
  if (context.region !== 'root') {
    throw refusal(CONTRIBUTION_IN_A_BAND, 'page-report-refused', {
      nodeId: row.id,
      path: context.path,
      region: context.region,
    });
  }
  const at = [...context.path, 'pageReport', 'value'];
  const raw = within(row.id, { ...context, path: at }, () =>
    evaluateExpression(declared.value, context.scope, { budget: context.budget }),
  );
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw refusal(CONTRIBUTION_NOT_A_NUMBER, 'page-report-refused', {
      nodeId: row.id,
      path: at,
      region: context.region,
      actualType: valueTypeOf(raw),
    });
  }
  return { key, order: context.keys.nextReportOrder(), value: raw };
}

function materializeRow(
  row: TableRowNode,
  columns: readonly TableColumn[],
  context: Context,
  keptGroup: MaterialRowGroupOccurrence | undefined = undefined,
): MaterialRow {
  const key = context.keys.next();
  return {
    key,
    nodeId: row.id,
    path: context.path,
    box: row.box,
    keepTogether: row.keepTogether === true,
    pageReport: contributionOf(row, key, context),
    keptGroup,
    cells: columns.map((column, index) => materializeCell(row, column, index, context)),
  };
}

/**
 * Second exhaustive traversal site: what a table body may hold.
 *
 * Takes any node rather than the body union so that the six refusing handlers are reachable and
 * provable, instead of being defensive branches no call can enter.
 */
/**
 * The rows one item of a marked group produced, each pointing at the occurrence they form.
 *
 * The boundary is a reference on the rows and nothing in the markup: `tbody` keeps holding `tr` and
 * only `tr`, so the columns, the rules and the height of the table are the ones it already had.
 */
function groupOccurrenceOf(
  group: TableRowGroupNode,
  index: number,
  firstRow: number,
  context: Context,
): MaterialRowGroupOccurrence | undefined {
  if (group.keepTogether !== true) {
    return undefined;
  }
  return {
    key: context.keys.next(),
    nodeId: group.id,
    path: [...context.path, index],
    firstRow,
    rowCount: group.rows.length,
  };
}

export function materializeBodyEntry(
  entry: DocumentNode,
  columns: readonly TableColumn[],
  context: Context,
  firstRow = 0,
): readonly MaterialRow[] {
  return visitNode<readonly MaterialRow[]>(entry, {
    tableRow: (row) => [materializeRow(row, columns, context)],
    tableRowGroup: (group) => {
      const items = within(group.id, context, () =>
        evaluateSequence(group.each, context.scope, {
          budget: context.budget,
          caller: 'tableRowGroup',
        }),
      );
      /* Per item, exactly as a marked loop: several rows declared in one group are kept together
         for each item, never for the whole sequence. */
      return items.flatMap((item, index) => {
        const at = firstRow + index * group.rows.length;
        const occurrence = groupOccurrenceOf(group, index, at, context);
        return group.rows.map((row, rowIndex) =>
          materializeRow(
            row,
            columns,
            {
              ...context,
              scope: childScope(context.scope, group.as, item),
              path: [...context.path, index, 'rows', rowIndex],
            },
            occurrence,
          ),
        );
      });
    },
    text: rejectAsRow,
    image: rejectAsRow,
    container: rejectAsRow,
    loop: rejectAsRow,
    condition: rejectAsRow,
    table: rejectAsRow,
  });
}

/**
 * The body of a table, flattened while keeping each group occurrence's position in the sequence.
 *
 * Accumulated rather than mapped, because a group occurrence has to know where its first row lands
 * in the whole body: that index is what lets the paginator recognise the start of the occurrence.
 */
function bodyRows(
  node: TableNode,
  section: (name: 'header' | 'body' | 'footer', index: number) => Context,
): readonly MaterialRow[] {
  const rows: MaterialRow[] = [];
  for (const [index, entry] of node.body.entries()) {
    rows.push(...materializeBodyEntry(entry, node.columns, section('body', index), rows.length));
  }
  return rows;
}

function materializeTable(node: TableNode, context: Context): MaterialBlock {
  const key = context.keys.next();
  const section = (name: 'header' | 'body' | 'footer', index: number): Context => ({
    ...context,
    column: undefined,
    path: [...context.path, name, index],
  });
  return {
    kind: 'table',
    key,
    nodeId: node.id,
    path: context.path,
    box: node.box,
    keepTogether: node.keepTogether === true,
    columns: node.columns,
    header: node.header.map((row, index) =>
      materializeRow(row, node.columns, section('header', index)),
    ),
    body: bodyRows(node, section),
    footer: node.footer.map((row, index) =>
      materializeRow(row, node.columns, section('footer', index)),
    ),
  };
}

/**
 * First exhaustive traversal site: what a block flow may hold. A ninth node kind breaks the
 * compilation here and in {@link materializeBodyEntry}, and nowhere else.
 *
 * A loop yields one occurrence per item, a false condition yields nothing, and every other kind
 * yields exactly one block.
 */
export function materializeNode(node: DocumentNode, context: Context): readonly MaterialBlock[] {
  return visitNode<readonly MaterialBlock[]>(node, {
    text: (text) => [materializeText(text, context)],
    image: (image) => [materializeImage(image, context)],
    container: (container) => [
      {
        kind: 'container',
        key: context.keys.next(),
        nodeId: container.id,
        path: context.path,
        box: container.box,
        keepTogether: container.keepTogether === true,
        children: materializeChildren(container.children, context),
      },
    ],
    loop: (loop) => materializeLoop(loop, context),
    condition: (condition) => materializeCondition(condition, context),
    table: (table) => [materializeTable(table, context)],
    tableRow: rejectAsBlock,
    tableRowGroup: rejectAsBlock,
  });
}

function bandContainer(
  band: PageBand,
  region: DocumentRegion,
  context: Context,
): MaterialContainer {
  const [content] = materializeNode(band.content, {
    ...context,
    region,
    column: undefined,
    path: ['page', region, band.on, 'content'],
  });
  if (content === undefined || content.kind !== 'container') {
    throw refusal(
      'A page band did not materialise into a container, which is the only shape a band declares.',
      'template-refused',
      { nodeId: band.content.id, region },
    );
  }
  return content;
}

/**
 * Binds the bands of one side whose domain can still be reached, and only those.
 *
 * A band the run of pages never reaches is not evaluated: an `exceptFirst` footer of a document that
 * turns out to hold one page is painted nowhere, and a formula it carries must not run at all.
 */
export function materializeBands(
  bands: readonly PageBand[],
  reachable: ReadonlySet<PageBandOccurrence>,
  region: DocumentRegion,
  context: Context,
): readonly MaterialPageBand[] {
  return bands
    .filter((band) => reachable.has(band.on))
    .map((band) => ({ on: band.on, content: bandContainer(band, region, context) }));
}

/** What one materialisation carries beyond the document, so a later pass can widen it. */
export interface MaterializedDocument {
  readonly document: MaterialDocument;
  readonly budget: EvaluationBudget;
  readonly keys: KeySource;
  /** The domains whose bands are already bound, so a second pass binds only the new ones. */
  readonly bound: ReadonlySet<PageBandOccurrence>;
}

/**
 * Turns a validated template and the host's data into a document with no expression left to run.
 *
 * One budget is created here and threaded through the applicable bands and the root flow: a bound
 * spent by a band is a bound the flow no longer has, which is what makes the ceiling a property of
 * the document rather than of a position in it.
 *
 * @param reachable the band domains the caller knows can appear, widened at most once by
 * {@link extendBands} when a document paginated as one page turns out to need several
 */
export function materializeDocument(
  template: Template,
  data: EvaluationScope,
  reachable: ReadonlySet<PageBandOccurrence>,
  evaluationLimits?: Partial<EvaluationLimits>,
): MaterializedDocument {
  const budget = createBudget(evaluationLimits);
  const keys = createKeySource();
  const shared = { scope: data, budget, keys, column: undefined, path: [] };
  const headerBands = materializeBands(template.page.header, reachable, 'header', {
    ...shared,
    region: 'header',
  });
  const root = materializeNode(template.root, {
    ...shared,
    region: 'root',
    path: ['root'],
  });
  const footerBands = materializeBands(template.page.footer, reachable, 'footer', {
    ...shared,
    region: 'footer',
  });
  return {
    budget,
    keys,
    bound: new Set(reachable),
    document: {
      sheet: template.page.sheet,
      margins: template.page.margins,
      printable: printableAreaOf(template.page),
      headerBands,
      root,
      footerBands,
    },
  };
}

/**
 * Binds the bands a widened domain set adds, on the same budget and the same key counter.
 *
 * The flow is never rebound: an occurrence is evaluated once per render whatever the page count, so
 * only the domains that were unreachable a moment ago are visited here.
 */
export function extendBands(
  template: Template,
  data: EvaluationScope,
  previous: MaterializedDocument,
  reachable: ReadonlySet<PageBandOccurrence>,
): MaterializedDocument {
  const added = new Set([...reachable].filter((occurrence) => !previous.bound.has(occurrence)));
  const shared = {
    scope: data,
    budget: previous.budget,
    keys: previous.keys,
    column: undefined,
    path: [],
  };
  const header = materializeBands(template.page.header, added, 'header', {
    ...shared,
    region: 'header',
  });
  const footer = materializeBands(template.page.footer, added, 'footer', {
    ...shared,
    region: 'footer',
  });
  return {
    budget: previous.budget,
    keys: previous.keys,
    bound: new Set([...previous.bound, ...added]),
    document: {
      ...previous.document,
      headerBands: [...previous.document.headerBands, ...header],
      footerBands: [...previous.document.footerBands, ...footer],
    },
  };
}

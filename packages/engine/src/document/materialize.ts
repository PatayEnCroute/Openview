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
  type TableRowNode,
  type Template,
  type TextNode,
  type TextSegment,
  type Typography,
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
  MaterialRow,
  MaterialRun,
  MaterialText,
  OccurrenceKey,
  ResolvedTypography,
} from './types.js';
import { resolveRunTypography } from './typography.js';

const EXPRESSION_REFUSED =
  'A formula of this template could not be evaluated against the supplied data. Read `details.diagnostics` for the operand or the bound that stopped it.';

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
}

export function createKeySource(): KeySource {
  let issued = 0;
  return {
    next(): OccurrenceKey {
      issued += 1;
      return `o${issued}`;
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
    /* No digits here: which page holds this run is decided by the cuts, and the cuts are decided
       after binding. The marker travels as itself and page composition writes its value. */
    pageField: (field) => ({
      kind: 'pageField',
      field: field.field,
      typography: complete(field.typography),
    }),
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

function materializeLoop(node: LoopNode, context: Context): readonly MaterialBlock[] {
  const items = within(node.id, context, () =>
    evaluateSequence(node.each, context.scope, { budget: context.budget, caller: 'loop' }),
  );
  return items.flatMap((item, index) =>
    materializeChildren(node.children, {
      ...context,
      scope: childScope(context.scope, node.as, item),
      path: [...context.path, index],
    }),
  );
}

function materializeCondition(node: ConditionNode, context: Context): readonly MaterialBlock[] {
  const holds = within(node.id, context, () =>
    evaluatePredicate(node.when, context.scope, { budget: context.budget, caller: 'condition' }),
  );
  return holds ? materializeChildren(node.children, context) : [];
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

function materializeRow(
  row: TableRowNode,
  columns: readonly TableColumn[],
  context: Context,
): MaterialRow {
  return {
    key: context.keys.next(),
    nodeId: row.id,
    path: context.path,
    box: row.box,
    keepTogether: row.keepTogether === true,
    cells: columns.map((column, index) => materializeCell(row, column, index, context)),
  };
}

/**
 * Second exhaustive traversal site: what a table body may hold.
 *
 * Takes any node rather than the body union so that the six refusing handlers are reachable and
 * provable, instead of being defensive branches no call can enter.
 */
export function materializeBodyEntry(
  entry: DocumentNode,
  columns: readonly TableColumn[],
  context: Context,
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
      return items.flatMap((item, index) =>
        group.rows.map((row, rowIndex) =>
          materializeRow(row, columns, {
            ...context,
            scope: childScope(context.scope, group.as, item),
            path: [...context.path, index, 'rows', rowIndex],
          }),
        ),
      );
    },
    text: rejectAsRow,
    image: rejectAsRow,
    container: rejectAsRow,
    loop: rejectAsRow,
    condition: rejectAsRow,
    table: rejectAsRow,
  });
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
    body: node.body.flatMap((entry, index) =>
      materializeBodyEntry(entry, node.columns, section('body', index)),
    ),
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

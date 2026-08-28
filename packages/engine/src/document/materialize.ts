import {
  type ConditionNode,
  childScope,
  createBudget,
  type DocumentNode,
  type DocumentNodeType,
  type EvaluationBudget,
  type EvaluationLimits,
  type EvaluationScope,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  type GridNode,
  type ImageNode,
  type IterationAddress,
  type LoopNode,
  type OccurrenceReference,
  type PageBand,
  type PageBandOccurrence,
  type PageLayer,
  type PageLayerPlane,
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
import {
  type DocumentArea,
  type DocumentRegion,
  type DocumentRenderErrorDetails,
  refusal,
  refusalOf,
} from '../errors.js';
import { assertCoveredText } from './fonts/index.js';
import {
  createPresentationSession,
  type PresentationSelection,
  type PresentationSession,
  writeValue,
} from './presentation.js';
import { printableText } from './printable.js';
import type {
  MaterialBlock,
  MaterialCell,
  MaterialContainer,
  MaterialDocument,
  MaterialGrid,
  MaterialPageBand,
  MaterialPageLayer,
  MaterialPageReport,
  MaterialRow,
  MaterialRowGroupOccurrence,
  MaterialRun,
  MaterialText,
  MaterialTextRun,
  ResolvedTypography,
} from './types.js';
import { resolveRunTypography } from './typography.js';

const EXPRESSION_REFUSED =
  'A formula of this template could not be evaluated against the supplied data. Read `details.diagnostics` for the operand or the bound that stopped it.';

const CONTRIBUTION_NOT_A_NUMBER =
  'A row declares what it contributes to the page report, and the formula produced something other than a finite number. Read `details.actualType` for what arrived; the value itself is deliberately not repeated.';

const CONTRIBUTION_IN_A_BAND =
  'A row inside a page band declares a contribution to the page report. A band is painted on every page its domain names, so the occurrence it would be counted on does not exist. Read `details.nodeId` for the row.';

const CONTRIBUTION_IN_A_LAYER =
  'A row inside a page layer declares a contribution to the page report. A layer is repeated identically on every page, so the occurrence it would be counted on does not exist. Read `details.nodeId` for the row.';

/** Default text alignment. */
const DEFAULT_ALIGN = 'start';

/** Key generator for distinct measurable occurrences within a single render pass. */
export interface KeySource {
  next(): string;
  /** Returns the next sequential order rank for a page-report contribution. */
  nextReportOrder(): number;
}

export function createKeySource(): KeySource {
  let issued = 0;
  let ranked = 0;
  return {
    next(): string {
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

/** Contextual state carried through the materialization traversal. */
export interface MaterializeContext {
  readonly scope: EvaluationScope;
  readonly budget: EvaluationBudget;
  readonly keys: KeySource;
  /** Resolved presentation session for this render. */
  readonly presentations: PresentationSession;
  readonly region: DocumentArea;
  /** Alignment of the enclosing table column, overridden by block alignment. */
  readonly column: TableColumnAlignment | undefined;
  /** Path in the template declaration tree to the current node. */
  readonly declarationPath: readonly (string | number)[];
  /** Ancestor iteration ranks, outermost first. */
  readonly iterations: readonly IterationAddress[];
}

type Context = MaterializeContext;

function iterationDetail(context: Context): Pick<DocumentRenderErrorDetails, 'occurrence'> {
  if (context.iterations.length === 0) {
    return {};
  }
  return {
    occurrence: {
      declarationPath: context.declarationPath,
      iterations: context.iterations,
    },
  };
}

function addressOf(
  nodeId: string,
  nodeType: DocumentNodeType,
  context: Context,
): OccurrenceReference {
  return {
    nodeId,
    nodeType,
    declarationPath: context.declarationPath,
    iterations: context.iterations,
  };
}

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

/** Evaluates an expression while catching and attributing errors to the template node site. */
function within<TResult>(
  nodeId: string,
  at: readonly (string | number)[],
  context: Context,
  evaluate: () => TResult,
): TResult {
  try {
    return evaluate();
  } catch (error) {
    throw refusalOf(error, EXPRESSION_REFUSED, 'expression-refused', {
      nodeId,
      path: at,
      region: context.region,
      ...iterationDetail(context),
    });
  }
}

function runOf(
  segment: TextSegment,
  block: TextNode,
  index: number,
  context: Context,
): MaterialRun {
  const at = [...context.declarationPath, 'content', index];
  const details = {
    nodeId: block.id,
    path: at,
    region: context.region,
    ...iterationDetail(context),
  };
  const complete = (run: Typography | undefined): ResolvedTypography =>
    resolveRunTypography(run, block.typography, details);
  /* Checked here rather than at paint time: the face is known, the site is known, and a character
     the face cannot draw would otherwise be handed to a browser that would borrow a glyph. */
  const printed = (text: string, typography: ResolvedTypography): MaterialTextRun => {
    assertCoveredText(text, typography.face, details);
    return { kind: 'text', text, typography };
  };
  return visitSegment<MaterialRun>(segment, {
    literal: (literal) => printed(literal.text, complete(literal.typography)),
    binding: (binding) => {
      const value = within(block.id, at, context, () =>
        evaluateExpression(binding.value, context.scope, { budget: context.budget }),
      );
      const format = binding.format;
      return printed(
        format === undefined
          ? printableText(value, details)
          : writeValue(
              format,
              context.presentations.resolve(format, details).presentation,
              value,
              details,
            ),
        complete(binding.typography),
      );
    },
    /* No digits here: which page holds this run, and which rows ended before it, are decided by
       the cuts. The marker travels as itself, carrying the writing it resolved, and page
       composition writes its value. */
    pageField: (field) =>
      field.field === 'report'
        ? {
            kind: 'pageField',
            field: 'report',
            site: details,
            decimals: field.decimals,
            mode: field.mode,
            ...(field.format === undefined
              ? {}
              : {
                  writing: context.presentations.resolveReport(
                    field.format,
                    field.decimals,
                    details,
                  ),
                }),
            typography: complete(field.typography),
          }
        : {
            kind: 'pageField',
            field: field.field,
            site: details,
            ...(field.format === undefined
              ? {}
              : { writing: context.presentations.resolveCounter(field.format, details) }),
            typography: complete(field.typography),
          },
  });
}

function materializeText(node: TextNode, context: Context): MaterialText {
  return {
    kind: 'text',
    key: context.keys.next(),
    ...addressOf(node.id, 'text', context),
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
    ...addressOf(node.id, 'image', context),
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
    materializeNode(child, {
      ...context,
      declarationPath: [...context.declarationPath, 'children', index],
    }),
  );
}

/** Wraps children into a keep-together container for marked loops and conditions. */
function transparentGroup(
  node: LoopNode | ConditionNode,
  children: readonly MaterialBlock[],
  context: Context,
): MaterialContainer {
  return {
    kind: 'container',
    key: context.keys.next(),
    ...addressOf(node.id, node.type, context),
    box: undefined,
    keepTogether: true,
    children,
  };
}

function materializeLoop(node: LoopNode, context: Context): readonly MaterialBlock[] {
  const items = within(node.id, context.declarationPath, context, () =>
    evaluateSequence(node.each, context.scope, { budget: context.budget, caller: 'loop' }),
  );
  return items.flatMap((item, index) => {
    const inner: Context = {
      ...context,
      scope: childScope(context.scope, node.as, item),
      iterations: [...context.iterations, { declarationPath: context.declarationPath, index }],
    };
    const children = materializeChildren(node.children, inner);
    return node.keepTogether === true ? [transparentGroup(node, children, inner)] : children;
  });
}

function materializeCondition(node: ConditionNode, context: Context): readonly MaterialBlock[] {
  const holds = within(node.id, context.declarationPath, context, () =>
    evaluatePredicate(node.when, context.scope, { budget: context.budget, caller: 'condition' }),
  );
  if (!holds) {
    return [];
  }
  const children = materializeChildren(node.children, context);
  return node.keepTogether === true ? [transparentGroup(node, children, context)] : children;
}

function materializeCell(row: TableRowNode, column: TableColumn, context: Context): MaterialCell {
  const at = row.cells.findIndex((candidate) => candidate.columnId === column.id);
  const declared = row.cells[at];
  return {
    key: context.keys.next(),
    columnId: column.id,
    children:
      declared === undefined
        ? []
        : materializeChildren(declared.children, {
            ...context,
            column: column.align,
            declarationPath: [...context.declarationPath, 'cells', at],
          }),
  };
}

/** Evaluates the page report contribution formula declared on a row. */
function contributionOf(
  row: TableRowNode,
  key: string,
  context: Context,
): MaterialPageReport | undefined {
  const declared = row.pageReport;
  if (declared === undefined) {
    return undefined;
  }
  if (context.region !== 'root') {
    const inLayer = context.region === 'background' || context.region === 'foreground';
    throw refusal(
      inLayer ? CONTRIBUTION_IN_A_LAYER : CONTRIBUTION_IN_A_BAND,
      'page-report-refused',
      {
        nodeId: row.id,
        path: context.declarationPath,
        region: context.region,
        ...iterationDetail(context),
      },
    );
  }
  const at = [...context.declarationPath, 'pageReport', 'value'];
  const raw = within(row.id, at, context, () =>
    evaluateExpression(declared.value, context.scope, { budget: context.budget }),
  );
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw refusal(CONTRIBUTION_NOT_A_NUMBER, 'page-report-refused', {
      nodeId: row.id,
      path: at,
      region: context.region,
      actualType: valueTypeOf(raw),
      ...iterationDetail(context),
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
    ...addressOf(row.id, 'tableRow', context),
    box: row.box,
    keepTogether: row.keepTogether === true,
    pageReport: contributionOf(row, key, context),
    keptGroup,
    cells: columns.map((column) => materializeCell(row, column, context)),
  };
}

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
    ...addressOf(group.id, 'tableRowGroup', {
      ...context,
      iterations: [...context.iterations, { declarationPath: context.declarationPath, index }],
    }),
    firstRow,
    rowCount: group.rows.length,
  };
}

/** Materializes a table body entry (row or iterated row group) into rows. */
export function materializeBodyEntry(
  entry: DocumentNode,
  columns: readonly TableColumn[],
  context: Context,
  firstRow = 0,
): readonly MaterialRow[] {
  return visitNode<readonly MaterialRow[]>(entry, {
    tableRow: (row) => [materializeRow(row, columns, context)],
    tableRowGroup: (group) => {
      const items = within(group.id, context.declarationPath, context, () =>
        evaluateSequence(group.each, context.scope, {
          budget: context.budget,
          caller: 'tableRowGroup',
        }),
      );
      return items.flatMap((item, index) => {
        const at = firstRow + index * group.rows.length;
        const occurrence = groupOccurrenceOf(group, index, at, context);
        const iterations = [
          ...context.iterations,
          { declarationPath: context.declarationPath, index },
        ];
        return group.rows.map((row, rowIndex) =>
          materializeRow(
            row,
            columns,
            {
              ...context,
              scope: childScope(context.scope, group.as, item),
              declarationPath: [...context.declarationPath, 'rows', rowIndex],
              iterations,
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
    grid: rejectAsRow,
  });
}

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
    declarationPath: [...context.declarationPath, name, index],
  });
  return {
    kind: 'table',
    key,
    ...addressOf(node.id, 'table', context),
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

function materializeGrid(node: GridNode, context: Context): MaterialGrid {
  return {
    kind: 'grid',
    key: context.keys.next(),
    ...addressOf(node.id, 'grid', context),
    box: node.box,
    keepTogether: node.keepTogether === true,
    columns: node.columns,
    rows: node.rows,
    step: node.step,
    items: node.items.map((item, index) => {
      const at = [...context.declarationPath, 'items', index, 'content'];
      const [content] = materializeNode(item.content, { ...context, declarationPath: at });
      if (content?.kind !== 'container') {
        throw refusal(
          'A grid zone did not materialise into a container, which is the only shape a zone declares.',
          'template-refused',
          {
            nodeId: item.content.id,
            path: at,
            region: context.region,
            ...iterationDetail(context),
          },
        );
      }
      return {
        row: item.row,
        column: item.column,
        rowSpan: item.rowSpan ?? 1,
        columnSpan: item.columnSpan ?? 1,
        content,
      };
    }),
  };
}

/** Materializes an AST document node into one or more material blocks. */
export function materializeNode(node: DocumentNode, context: Context): readonly MaterialBlock[] {
  return visitNode<readonly MaterialBlock[]>(node, {
    text: (text) => [materializeText(text, context)],
    image: (image) => [materializeImage(image, context)],
    container: (container) => [
      {
        kind: 'container',
        key: context.keys.next(),
        ...addressOf(container.id, 'container', context),
        box: container.box,
        keepTogether: container.keepTogether === true,
        children: materializeChildren(container.children, context),
      },
    ],
    loop: (loop) => materializeLoop(loop, context),
    condition: (condition) => materializeCondition(condition, context),
    table: (table) => [materializeTable(table, context)],
    grid: (grid) => [materializeGrid(grid, context)],
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
    declarationPath: ['page', region, band.on, 'content'],
  });
  if (content?.kind !== 'container') {
    throw refusal(
      'A page band did not materialise into a container, which is the only shape a band declares.',
      'template-refused',
      { nodeId: band.content.id, region },
    );
  }
  return content;
}

/** Materializes reachable page bands for a region. */
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

function materializeLayers(
  layers: readonly PageLayer[] | undefined,
  plane: PageLayerPlane,
  context: Context,
): readonly MaterialPageLayer[] {
  return (layers ?? [])
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => layer.plane === plane)
    .map(({ layer, index }) => {
      const at = ['page', 'layers', index, 'content'];
      const [content] = materializeNode(layer.content, {
        ...context,
        region: plane,
        column: undefined,
        declarationPath: at,
      });
      if (content?.kind !== 'container') {
        throw refusal(
          'A page layer did not materialise into a container, which is the only shape a layer declares.',
          'template-refused',
          { nodeId: layer.content.id, region: plane },
        );
      }
      return { plane, opacity: layer.opacity, content };
    });
}

/** Result of a document materialization pass. */
export interface MaterializedDocument {
  readonly document: MaterialDocument;
  readonly budget: EvaluationBudget;
  readonly keys: KeySource;
  /** Resolved presentations session for this render. */
  readonly presentations: PresentationSession;
  /** Set of band occurrences already materialized. */
  readonly bound: ReadonlySet<PageBandOccurrence>;
}

/**
 * Materializes a template into a bound document hierarchy.
 */
export function materializeDocument(
  template: Template,
  data: EvaluationScope,
  reachable: ReadonlySet<PageBandOccurrence>,
  evaluationLimits?: Partial<EvaluationLimits>,
  selection?: PresentationSelection | undefined,
): MaterializedDocument {
  const budget = createBudget(evaluationLimits);
  const keys = createKeySource();
  const presentations = createPresentationSession(template.presentations, selection);
  const shared = {
    scope: data,
    budget,
    keys,
    presentations,
    column: undefined,
    declarationPath: [],
    iterations: [],
  };
  const backgroundLayers = materializeLayers(template.page.layers, 'background', {
    ...shared,
    region: 'background',
  });
  const headerBands = materializeBands(template.page.header, reachable, 'header', {
    ...shared,
    region: 'header',
  });
  const root = materializeNode(template.root, {
    ...shared,
    region: 'root',
    declarationPath: ['root'],
  });
  const footerBands = materializeBands(template.page.footer, reachable, 'footer', {
    ...shared,
    region: 'footer',
  });
  const foregroundLayers = materializeLayers(template.page.layers, 'foreground', {
    ...shared,
    region: 'foreground',
  });
  return {
    budget,
    keys,
    presentations,
    bound: new Set(reachable),
    document: {
      sheet: template.page.sheet,
      margins: template.page.margins,
      printable: printableAreaOf(template.page),
      backgroundLayers,
      headerBands,
      root,
      footerBands,
      foregroundLayers,
    },
  };
}

/**
 * Materializes newly reachable page bands when page count increases during pagination.
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
    presentations: previous.presentations,
    column: undefined,
    declarationPath: [],
    iterations: [],
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
    presentations: previous.presentations,
    bound: new Set([...previous.bound, ...added]),
    document: {
      ...previous.document,
      headerBands: [...previous.document.headerBands, ...header],
      footerBands: [...previous.document.footerBands, ...footer],
    },
  };
}

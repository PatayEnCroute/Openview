import type { DocumentNode } from '../ast/nodes.js';
import { type NodeVisitor, visitNode, visitSegment } from '../ast/visitor.js';
import type { DataCompatibilityDiagnostic } from '../diagnostics/types.js';
import {
  type Expression,
  type ExpressionVisitor,
  rootSegment,
  visitExpression,
} from '../expression/expression.js';
import type { PageBand } from '../page/page.js';
import type { Template } from '../template/template.js';
import { acceptedKindsOf, satisfies } from './expectations.js';
import type {
  DataCatalogue,
  DataExpectation,
  DataField,
  DataObjectType,
  DataScopeWarning,
  DataType,
  TemplateDataRead,
} from './types.js';
import { visitDataType } from './visitor.js';

const UNDECLARED_MESSAGE =
  'This model reads a path the catalogue does not declare. Either the host declares the field, or the model stops asking for it.';
const INCOMPATIBLE_MESSAGE =
  'This model reads a declared path where its declared nature is not accepted. The accepted natures and the declared one are reported as separate fields.';
const SHADOWS_ROOT_MESSAGE =
  'This alias carries the name of a catalogue root and masks it inside its scope. The runtime meaning is defined -- the alias wins -- but a reader may expect the declared field.';
const SHADOWS_ALIAS_MESSAGE =
  'This alias carries the name of an alias already in scope and masks it. The innermost binding wins, so the outer item is unreachable here.';

/** What one call found, in the order the traversal produced it: flow first, then header, then footer. */
export interface TemplateDataCompatibility {
  readonly compatible: boolean;
  readonly reads: readonly TemplateDataRead[];
  readonly diagnostics: readonly DataCompatibilityDiagnostic[];
  readonly scopeWarnings: readonly DataScopeWarning[];
}

/** A declared type reached by a route, with the chains that led there. */
interface Located {
  readonly type: DataType;
  readonly keyPath: readonly string[];
  readonly labelPath: readonly string[];
}

/**
 * What an alias stands for: the element of a resolved list, or nothing analysable.
 *
 * A binding is blocked when its source resolved to no list. Its readings are reported as suspended
 * rather than unknown, because their base was never established.
 */
type Binding = { readonly blocked: false; readonly item: Located } | { readonly blocked: true };

interface Scope {
  readonly alias: string;
  readonly binding: Binding;
}

/** Everything one call accumulates, plus the ephemeral index its resolution reads. */
interface Analysis {
  readonly roots: ReadonlyMap<string, DataField>;
  readonly members: Map<DataObjectType, ReadonlyMap<string, DataField>>;
  readonly scopes: Scope[];
  readonly reads: TemplateDataRead[];
  readonly diagnostics: DataCompatibilityDiagnostic[];
  readonly scopeWarnings: DataScopeWarning[];
}

/** Where a reading sits in the model, for a consumer that has to point at it. */
interface Site {
  readonly path: readonly (string | number)[];
  readonly nodeId: string | undefined;
}

/**
 * Indexes fields by key, first spelling winning.
 *
 * The schema refuses sibling duplicates, so first-wins only decides for a catalogue that was never
 * parsed -- and it decides the same way a reader would.
 */
function indexFields(fields: readonly DataField[]): ReadonlyMap<string, DataField> {
  const found = new Map<string, DataField>();
  for (const field of fields) {
    if (!found.has(field.key)) {
      found.set(field.key, field);
    }
  }
  return found;
}

/** Members of one record, indexed on first use and kept for the length of this call only. */
function membersOf(analysis: Analysis, type: DataObjectType): ReadonlyMap<string, DataField> {
  const cached = analysis.members.get(type);
  if (cached !== undefined) {
    return cached;
  }
  const built = indexFields(type.fields);
  analysis.members.set(type, built);
  return built;
}

/** The innermost binding of a name, or nothing when no alias carries it. */
function lookupAlias(analysis: Analysis, name: string): Binding | undefined {
  for (let index = analysis.scopes.length - 1; index >= 0; index -= 1) {
    const scope = analysis.scopes[index];
    if (scope !== undefined && scope.alias === name) {
      return scope.binding;
    }
  }
  return undefined;
}

/** Reads a member of a declared type. A scalar has none, and a list is never traversed implicitly. */
function memberOf(analysis: Analysis, type: DataType, key: string): DataField | undefined {
  return visitDataType<DataField | undefined, undefined>(
    type,
    {
      scalar: () => undefined,
      object: (record) => membersOf(analysis, record).get(key),
      list: () => undefined,
    },
    undefined,
  );
}

function rootOf(analysis: Analysis, key: string): Located | undefined {
  const field = analysis.roots.get(key);
  return field === undefined
    ? undefined
    : { type: field.type, keyPath: [field.key], labelPath: [field.label] };
}

/** Walks the segments after the root, refusing every implicit traversal. */
function descend(
  analysis: Analysis,
  from: Located,
  segments: readonly string[],
): Located | undefined {
  let current: Located = from;
  for (const segment of segments) {
    const field = memberOf(analysis, current.type, segment);
    if (field === undefined) {
      return undefined;
    }
    current = {
      type: field.type,
      keyPath: [...current.keyPath, field.key],
      labelPath: [...current.labelPath, field.label],
    };
  }
  return current;
}

function suspend(
  analysis: Analysis,
  writtenPath: string,
  expectation: DataExpectation,
  site: Site,
): undefined {
  analysis.reads.push({
    writtenPath,
    cataloguePath: undefined,
    labels: [],
    actualKind: undefined,
    expectation,
    status: 'blocked',
    path: site.path,
    nodeId: site.nodeId,
  });
  return undefined;
}

function refuseUndeclared(
  analysis: Analysis,
  writtenPath: string,
  expectation: DataExpectation,
  site: Site,
): undefined {
  analysis.reads.push({
    writtenPath,
    cataloguePath: undefined,
    labels: [],
    actualKind: undefined,
    expectation,
    status: 'undeclared',
    path: site.path,
    nodeId: site.nodeId,
  });
  analysis.diagnostics.push({
    source: 'data-compatibility',
    code: 'undeclared-data-path',
    message: UNDECLARED_MESSAGE,
    dataPath: writtenPath,
    path: site.path,
    nodeId: site.nodeId,
  });
  return undefined;
}

/**
 * Resolves one written path in its scope and records the reading it is.
 *
 * Returns where the path landed, so a sequence source can bind its element, and nothing whenever
 * the catalogue cannot say -- undeclared, incompatible, or rooted in a blocked alias alike.
 */
function readPath(
  analysis: Analysis,
  writtenPath: string,
  expectation: DataExpectation,
  site: Site,
): Located | undefined {
  const root = rootSegment(writtenPath);
  const bound = lookupAlias(analysis, root);
  if (bound?.blocked === true) {
    return suspend(analysis, writtenPath, expectation, site);
  }

  const base = bound === undefined ? rootOf(analysis, root) : bound.item;
  const rest = writtenPath.split('.').slice(1);
  const found = base === undefined ? undefined : descend(analysis, base, rest);
  if (found === undefined) {
    return refuseUndeclared(analysis, writtenPath, expectation, site);
  }

  const actualKind = found.type.kind;
  if (!satisfies(expectation, actualKind)) {
    analysis.reads.push({
      writtenPath,
      cataloguePath: found.keyPath,
      labels: found.labelPath,
      actualKind,
      expectation,
      status: 'incompatible',
      path: site.path,
      nodeId: site.nodeId,
    });
    analysis.diagnostics.push({
      source: 'data-compatibility',
      code: 'incompatible-data-kind',
      message: INCOMPATIBLE_MESSAGE,
      dataPath: writtenPath,
      expectedKinds: acceptedKindsOf(expectation),
      actualKind,
      path: site.path,
      nodeId: site.nodeId,
    });
    return undefined;
  }

  analysis.reads.push({
    writtenPath,
    cataloguePath: found.keyPath,
    labels: found.labelPath,
    actualKind,
    expectation,
    status: 'available',
    path: site.path,
    nodeId: site.nodeId,
  });
  return found;
}

/** Binds the element of a resolved list, or blocks the alias when there is no list to bind. */
function elementBinding(source: Located | undefined): Binding {
  if (source === undefined || source.type.kind !== 'list') {
    return { blocked: true };
  }
  return {
    blocked: false,
    item: { type: source.type.items, keyPath: source.keyPath, labelPath: source.labelPath },
  };
}

/** Pushes an alias, reporting the masking it causes without ever refusing it. */
function bind(analysis: Analysis, alias: string, source: Located | undefined, site: Site): void {
  if (analysis.roots.has(alias)) {
    analysis.scopeWarnings.push({
      code: 'alias-shadows-catalogue-root',
      alias,
      message: SHADOWS_ROOT_MESSAGE,
      path: site.path,
      nodeId: site.nodeId,
    });
  }
  if (lookupAlias(analysis, alias) !== undefined) {
    analysis.scopeWarnings.push({
      code: 'alias-shadows-alias',
      alias,
      message: SHADOWS_ALIAS_MESSAGE,
      path: site.path,
      nodeId: site.nodeId,
    });
  }
  analysis.scopes.push({ alias, binding: elementBinding(source) });
}

/** An expression being analysed: where it sits, what its position requires, and what it may read. */
interface ReadingContext {
  readonly analysis: Analysis;
  readonly expectation: DataExpectation;
  readonly site: Site;
}

function at(context: ReadingContext, ...segments: readonly (string | number)[]): Site {
  return { path: [...context.site.path, ...segments], nodeId: context.site.nodeId };
}

/** Descends into a sub-expression at a position, under the expectation that position imposes. */
function read(
  context: ReadingContext,
  expression: Expression,
  expectation: DataExpectation,
  ...segments: readonly (string | number)[]
): Located | undefined {
  return visitExpression(expression, READING_VISITOR, {
    analysis: context.analysis,
    expectation,
    site: at(context, ...segments),
  });
}

/**
 * Analyses an alias-binding branch: the source under a `list` expectation, then the body with the
 * element bound, then the scope popped at the exact end of its extent.
 */
function withElement(
  context: ReadingContext,
  source: Expression,
  alias: string,
  body: Expression,
  bodyExpectation: DataExpectation,
  bodySegment: string,
): Located | undefined {
  const resolved = read(context, source, 'list', 'source');
  bind(context.analysis, alias, resolved, at(context, 'as'));
  read(context, body, bodyExpectation, bodySegment);
  context.analysis.scopes.pop();
  return resolved;
}

/**
 * Records every path an expression reads, under the expectation of its exact position.
 *
 * The return value is the minimum a sequence source needs -- where a list came from -- and not a
 * general inference: everything that is not a resolved path answers with nothing.
 */
const READING_VISITOR: ExpressionVisitor<Located | undefined, ReadingContext> = {
  literal: () => undefined,
  path: (expression, context) =>
    readPath(context.analysis, expression.path, context.expectation, context.site),
  arithmetic: (expression, context) => {
    read(context, expression.left, 'number', 'left');
    read(context, expression.right, 'number', 'right');
    return undefined;
  },
  percentOf: (expression, context) => {
    read(context, expression.base, 'number', 'base');
    read(context, expression.rate, 'number', 'rate');
    return undefined;
  },
  round: (expression, context) => {
    read(context, expression.value, 'number', 'value');
    return undefined;
  },
  concat: (expression, context) => {
    for (const [index, part] of expression.parts.entries()) {
      read(context, part, 'text', 'parts', index);
    }
    return undefined;
  },
  text: (expression, context) => {
    read(context, expression.value, 'printable', 'value');
    return undefined;
  },
  textCase: (expression, context) => {
    read(context, expression.text, 'text', 'text');
    return undefined;
  },
  dateAdd: (expression, context) => {
    read(context, expression.date, 'civil-date', 'date');
    read(context, expression.days, 'number', 'days');
    return undefined;
  },
  dateDiff: (expression, context) => {
    read(context, expression.from, 'civil-date', 'from');
    read(context, expression.to, 'civil-date', 'to');
    return undefined;
  },
  endOfMonth: (expression, context) => {
    read(context, expression.date, 'civil-date', 'date');
    return undefined;
  },
  aggregate: (expression, context) => {
    withElement(context, expression.source, expression.as, expression.value, 'number', 'value');
    return undefined;
  },
  count: (expression, context) => {
    read(context, expression.source, 'list', 'source');
    return undefined;
  },
  /* A filter yields its source unchanged, so a loop or a nested filter can still bind its element. */
  filter: (expression, context) =>
    withElement(context, expression.source, expression.as, expression.where, 'boolean', 'where'),
  if: (expression, context) => {
    read(context, expression.when, 'boolean', 'when');
    read(context, expression.whenTrue, context.expectation, 'whenTrue');
    read(context, expression.whenFalse, context.expectation, 'whenFalse');
    return undefined;
  },
  compare: (expression, context) => {
    const operand: DataExpectation =
      expression.op === 'eq' || expression.op === 'neq' ? 'primitive' : 'orderable';
    read(context, expression.left, operand, 'left');
    read(context, expression.right, operand, 'right');
    return undefined;
  },
  logical: (expression, context) => {
    for (const [index, operand] of expression.operands.entries()) {
      read(context, operand, 'boolean', 'operands', index);
    }
    return undefined;
  },
  not: (expression, context) => {
    read(context, expression.operand, 'boolean', 'operand');
    return undefined;
  },
  isEmpty: (expression, context) => {
    read(context, expression.operand, 'any', 'operand');
    return undefined;
  },
};

/** One expression a node reads, at the position and under the expectation the node gives it. */
interface NodeReading {
  readonly expression: Expression;
  readonly expectation: DataExpectation;
  readonly at: readonly (string | number)[];
}

/** A child and where it hangs from its parent. */
interface NodeChild {
  readonly node: DocumentNode;
  readonly at: readonly (string | number)[];
}

/** A sequence a node repeats and the alias it binds for its children. */
interface NodeBinding {
  readonly source: Expression;
  readonly alias: string;
  readonly at: readonly (string | number)[];
}

/** What the traversal needs of a node: its readings, the alias it opens, and its children. */
interface NodeShape {
  readonly readings: readonly NodeReading[];
  readonly binding: NodeBinding | undefined;
  readonly children: readonly NodeChild[];
}

const NO_BINDING = undefined;

function blockChildren(children: readonly DocumentNode[]): readonly NodeChild[] {
  return children.map((node, index) => ({ node, at: ['children', index] }));
}

const SHAPE: NodeVisitor<NodeShape> = {
  text: (node) => ({
    readings: node.content.flatMap((segment, index) =>
      visitSegment<readonly NodeReading[]>(segment, {
        literal: () => [],
        binding: (bound) => [
          { expression: bound.value, expectation: 'printable', at: ['content', index, 'value'] },
        ],
        pageField: () => [],
      }),
    ),
    binding: NO_BINDING,
    children: [],
  }),
  image: () => ({ readings: [], binding: NO_BINDING, children: [] }),
  container: (node) => ({
    readings: [],
    binding: NO_BINDING,
    children: blockChildren(node.children),
  }),
  loop: (node) => ({
    readings: [],
    binding: { source: node.each, alias: node.as, at: ['each'] },
    children: blockChildren(node.children),
  }),
  condition: (node) => ({
    readings: [{ expression: node.when, expectation: 'boolean', at: ['when'] }],
    binding: NO_BINDING,
    children: blockChildren(node.children),
  }),
  table: (node) => ({
    readings: [],
    binding: NO_BINDING,
    children: [
      ...node.header.map((row, index) => ({ node: row, at: ['header', index] })),
      ...node.body.map((entry, index) => ({ node: entry, at: ['body', index] })),
      ...node.footer.map((row, index) => ({ node: row, at: ['footer', index] })),
    ],
  }),
  tableRowGroup: (node) => ({
    readings: [],
    binding: { source: node.each, alias: node.as, at: ['each'] },
    children: node.rows.map((row, index) => ({ node: row, at: ['rows', index] })),
  }),
  tableRow: (node) => ({
    readings:
      node.pageReport === undefined
        ? []
        : [
            {
              expression: node.pageReport.value,
              expectation: 'number',
              at: ['pageReport', 'value'],
            },
          ],
    binding: NO_BINDING,
    children: node.cells.flatMap((cell, cellIndex) =>
      cell.children.map((child, childIndex) => ({
        node: child,
        at: ['cells', cellIndex, 'children', childIndex],
      })),
    ),
  }),
};

/**
 * Analyses one node and its subtree.
 *
 * An alias opened here reaches the children of this node and nothing else: a band, a sibling
 * branch and the rest of the flow all resume from the scope this node was entered with.
 */
function analyseNode(
  analysis: Analysis,
  node: DocumentNode,
  path: readonly (string | number)[],
): void {
  const shape = visitNode(node, SHAPE);
  const site: Site = { path, nodeId: node.id };

  for (const reading of shape.readings) {
    visitExpression(reading.expression, READING_VISITOR, {
      analysis,
      expectation: reading.expectation,
      site: { path: [...path, ...reading.at], nodeId: node.id },
    });
  }

  if (shape.binding !== undefined) {
    const resolved = visitExpression(shape.binding.source, READING_VISITOR, {
      analysis,
      expectation: 'list',
      site: { path: [...path, ...shape.binding.at], nodeId: node.id },
    });
    bind(analysis, shape.binding.alias, resolved, {
      path: [...path, 'as'],
      nodeId: site.nodeId,
    });
  }

  for (const child of shape.children) {
    analyseNode(analysis, child.node, [...path, ...child.at]);
  }

  if (shape.binding !== undefined) {
    analysis.scopes.pop();
  }
}

function analyseBands(
  analysis: Analysis,
  bands: readonly PageBand[],
  side: 'header' | 'footer',
): void {
  for (const [index, band] of bands.entries()) {
    analyseNode(analysis, band.content, ['page', side, index, 'content']);
  }
}

/**
 * Checks a parsed template against a host catalogue: every reading, in its own scope, at its own
 * position.
 *
 * Pure and synchronous. It needs no dataset, reads none, and answers what the host allows a model
 * to read -- never what a given render contains.
 */
export function checkTemplateDataCompatibility(
  template: Template,
  catalogue: DataCatalogue,
): TemplateDataCompatibility {
  const analysis: Analysis = {
    roots: indexFields(catalogue.fields),
    members: new Map<DataObjectType, ReadonlyMap<string, DataField>>(),
    scopes: [],
    reads: [],
    diagnostics: [],
    scopeWarnings: [],
  };

  analyseNode(analysis, template.root, ['root']);
  analyseBands(analysis, template.page.header, 'header');
  analyseBands(analysis, template.page.footer, 'footer');

  return {
    compatible: analysis.diagnostics.length === 0,
    reads: analysis.reads,
    diagnostics: analysis.diagnostics,
    scopeWarnings: analysis.scopeWarnings,
  };
}

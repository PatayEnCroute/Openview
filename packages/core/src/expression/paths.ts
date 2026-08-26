import type { Expression } from './types.js';
import { type ExpressionVisitor, visitExpression } from './visitor.js';

/**
 * Returns the first segment of a dotted path.
 */
export function rootSegment(dataPath: string): string {
  const dot = dataPath.indexOf('.');
  return dot === -1 ? dataPath : dataPath.slice(0, dot);
}

const NO_ALIASES: ReadonlySet<string> = new Set<string>();

function withAlias(aliases: ReadonlySet<string>, alias: string): ReadonlySet<string> {
  return new Set(aliases).add(alias);
}

/** The alias names masked at this depth, and the accumulator every branch adds to. */
interface PathCollectionContext {
  readonly aliases: ReadonlySet<string>;
  readonly into: Set<string>;
}

function collectPaths(expression: Expression, context: PathCollectionContext): void {
  visitExpression(expression, PATH_VISITOR, context);
}

function boundIn(context: PathCollectionContext, alias: string): PathCollectionContext {
  return { aliases: withAlias(context.aliases, alias), into: context.into };
}

const PATH_VISITOR: ExpressionVisitor<void, PathCollectionContext> = {
  literal: () => undefined,
  path: (expression, { aliases, into }) => {
    if (!aliases.has(rootSegment(expression.path))) {
      into.add(expression.path);
    }
  },
  compare: (expression, context) => {
    collectPaths(expression.left, context);
    collectPaths(expression.right, context);
  },
  arithmetic: (expression, context) => {
    collectPaths(expression.left, context);
    collectPaths(expression.right, context);
  },
  percentOf: (expression, context) => {
    collectPaths(expression.base, context);
    collectPaths(expression.rate, context);
  },
  if: (expression, context) => {
    collectPaths(expression.when, context);
    collectPaths(expression.whenTrue, context);
    collectPaths(expression.whenFalse, context);
  },
  count: (expression, context) => {
    collectPaths(expression.source, context);
  },
  aggregate: (expression, context) => {
    collectPaths(expression.source, context);
    collectPaths(expression.value, boundIn(context, expression.as));
  },
  filter: (expression, context) => {
    collectPaths(expression.source, context);
    collectPaths(expression.where, boundIn(context, expression.as));
  },
  concat: (expression, context) => {
    for (const part of expression.parts) {
      collectPaths(part, context);
    }
  },
  text: (expression, context) => {
    collectPaths(expression.value, context);
  },
  round: (expression, context) => {
    collectPaths(expression.value, context);
  },
  textCase: (expression, context) => {
    collectPaths(expression.text, context);
  },
  dateAdd: (expression, context) => {
    collectPaths(expression.date, context);
    collectPaths(expression.days, context);
  },
  dateDiff: (expression, context) => {
    collectPaths(expression.from, context);
    collectPaths(expression.to, context);
  },
  endOfMonth: (expression, context) => {
    collectPaths(expression.date, context);
  },
  logical: (expression, context) => {
    for (const operand of expression.operands) {
      collectPaths(operand, context);
    }
  },
  not: (expression, context) => {
    collectPaths(expression.operand, context);
  },
  isEmpty: (expression, context) => {
    collectPaths(expression.operand, context);
  },
};

/**
 * Collects all external data paths read by an expression tree into a Set.
 */
export function pathsOf(expression: Expression, into: Set<string> = new Set()): Set<string> {
  collectPaths(expression, { aliases: NO_ALIASES, into });
  return into;
}

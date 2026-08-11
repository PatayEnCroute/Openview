import { z } from 'zod/v4';

/**
 * Structured expressions (ADR 0001, option C).
 *
 * An expression is a validated tree, never a string to parse. Two consequences
 * drive the whole design:
 *
 * - There is no parser, so there is no injection surface. Zod validates the
 *   shape and nothing is ever evaluated as code.
 * - @openview/designer edits this representation directly. A field picker, an
 *   operator, a value -- what the UI manipulates is exactly what gets stored,
 *   with no text round-trip to keep in sync.
 *
 * The operator set is deliberately small. Arithmetic, function calls and dynamic
 * indexing stay out until a real use case demands them (AGENTS.md 3).
 */

export type LiteralValue = string | number | boolean | null;

/** Strict comparisons only: see ./evaluate.ts for why coercion is refused. */
export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface LiteralExpression {
  readonly kind: 'literal';
  readonly value: LiteralValue;
}

/** Dotted path into the render data, e.g. `invoice.customer.name`. */
export interface PathExpression {
  readonly kind: 'path';
  readonly path: string;
}

export interface CompareExpression {
  readonly kind: 'compare';
  readonly op: ComparisonOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export interface LogicalExpression {
  readonly kind: 'logical';
  readonly op: 'and' | 'or';
  readonly operands: readonly Expression[];
}

export interface NotExpression {
  readonly kind: 'not';
  readonly operand: Expression;
}

/** True for null, undefined, empty string, empty array and empty object. */
export interface IsEmptyExpression {
  readonly kind: 'isEmpty';
  readonly operand: Expression;
}

export type Expression =
  | LiteralExpression
  | PathExpression
  | CompareExpression
  | LogicalExpression
  | NotExpression
  | IsEmptyExpression;

export type ExpressionKind = Expression['kind'];

const literalValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const LiteralExpressionSchema = z.object({
  kind: z.literal('literal'),
  value: literalValueSchema,
});

/**
 * Segments that must never be traversed. Paths come from user-authored
 * templates, so `constructor` would hand a template access to `Function` and
 * `__proto__` to the prototype chain -- the usual first step of a sandbox
 * escape. Rejected at save time rather than at render time, so a malicious
 * template never reaches storage.
 */
const FORBIDDEN_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

export const PathExpressionSchema = z.object({
  kind: z.literal('path'),
  // Validated here rather than at evaluation time, so a malformed path fails
  // when the template is saved instead of when a document renders.
  path: z
    .string()
    .min(1, 'A path expression needs a path')
    .regex(
      /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/,
      'A path must be dot-separated identifiers, e.g. invoice.customer.name',
    )
    .refine(
      (path) => path.split('.').every((segment) => !FORBIDDEN_PATH_SEGMENTS.has(segment)),
      'A path may not traverse __proto__, constructor or prototype',
    ),
});

/** The single recursive binding, same pattern as DocumentNodeSchema. */
export const ExpressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    LiteralExpressionSchema,
    PathExpressionSchema,
    CompareExpressionSchema,
    LogicalExpressionSchema,
    NotExpressionSchema,
    IsEmptyExpressionSchema,
  ]),
);

export const CompareExpressionSchema = z.object({
  kind: z.literal('compare'),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
  left: ExpressionSchema,
  right: ExpressionSchema,
});

export const LogicalExpressionSchema = z.object({
  kind: z.literal('logical'),
  op: z.enum(['and', 'or']),
  operands: z.array(ExpressionSchema).min(1, 'A logical expression needs at least one operand'),
});

export const NotExpressionSchema = z.object({
  kind: z.literal('not'),
  operand: ExpressionSchema,
});

export const IsEmptyExpressionSchema = z.object({
  kind: z.literal('isEmpty'),
  operand: ExpressionSchema,
});

/** Every data path an expression tree reads, in traversal order, de-duplicated. */
export function pathsOf(expression: Expression, into: Set<string> = new Set()): Set<string> {
  switch (expression.kind) {
    case 'literal':
      break;
    case 'path':
      into.add(expression.path);
      break;
    case 'compare':
      pathsOf(expression.left, into);
      pathsOf(expression.right, into);
      break;
    case 'logical':
      for (const operand of expression.operands) {
        pathsOf(operand, into);
      }
      break;
    case 'not':
    case 'isEmpty':
      pathsOf(expression.operand, into);
      break;
    default: {
      const exhaustive: never = expression;
      throw new TypeError(`Unhandled expression: ${JSON.stringify(exhaustive)}`);
    }
  }
  return into;
}

import { z } from 'zod/v4';
import { dayNumberOf } from './civil-date.js';
import { aliasSchema, FORBIDDEN_IDENTIFIERS, PATH_PATTERN } from './identifiers.js';
import {
  AGGREGATE_OPERATORS,
  ARITHMETIC_OPERATORS,
  type Expression,
  type PrintableExpression,
  TEXT_CASE_OPERATORS,
} from './types.js';

const literalValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * The member schemas of each sub-algebra.
 *
 * Functions rather than arrays, so nothing here is read at module-initialisation time --
 * they are called from inside a `z.lazy` body, which is exactly where the temporal dead
 * zone has already closed. Function declarations are hoisted, so their position in the
 * file does not matter.
 *
 * One list per sub-algebra, and the two unions below are BUILT from them: that is what
 * keeps `PrintableExpressionSchema` and `ExpressionSchema` from drifting apart. Drift
 * against the hand-written types is what the tests catch; drift between the two bodies is
 * now impossible by construction, and it mirrors the type level, where `Expression` is
 * written as the union of its sub-algebras.
 */
function printableMembers() {
  return [
    LiteralExpressionSchema,
    PathExpressionSchema,
    ArithmeticExpressionSchema,
    PercentOfExpressionSchema,
    AggregateExpressionSchema,
    CountExpressionSchema,
    ConditionalExpressionSchema,
    ConcatExpressionSchema,
    TextExpressionSchema,
    TextCaseExpressionSchema,
    DateAddExpressionSchema,
    DateDiffExpressionSchema,
    EndOfMonthExpressionSchema,
  ] as const;
}

function predicateMembers() {
  return [
    CompareExpressionSchema,
    LogicalExpressionSchema,
    NotExpressionSchema,
    IsEmptyExpressionSchema,
  ] as const;
}

/** List-valued, so refused wherever a document prints. One member so far. */
function listMembers() {
  return [FilterExpressionSchema] as const;
}

export const ExpressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion('kind', [...printableMembers(), ...predicateMembers(), ...listMembers()]),
);

/**
 * The printable sub-algebra, and the only position of the stored contract that accepts
 * a subset of {@link ExpressionSchema}.
 */
export const PrintableExpressionSchema: z.ZodType<PrintableExpression> = z.lazy(() =>
  z.discriminatedUnion('kind', printableMembers()),
);

export const LiteralExpressionSchema = z.object({
  kind: z.literal('literal'),
  value: literalValueSchema,
});

export const PathExpressionSchema = z.object({
  kind: z.literal('path'),
  // Validated here rather than at evaluation time, so a malformed path fails
  // when the template is saved instead of when a document renders. One regex for
  // the shape, one split for the forbidden names: two passes, two messages.
  path: z
    .string()
    .min(1, 'A path expression needs a path')
    // A NARROWING, and the only kind ADR 0003 introduces at parse time: a path of 591
    // characters used to be accepted. The pattern itself is not vulnerable to
    // backtracking (measured linear over 200 002 characters); the cost is that
    // `resolvePath` splits the path again on every read, and aggregations take that
    // count from O(1) to O(n) or worse.
    .max(256, 'A path may not exceed 256 characters')
    .regex(PATH_PATTERN, 'A path must be dot-separated identifiers, e.g. section.item.field')
    .refine(
      (path) => path.split('.').every((segment) => !FORBIDDEN_IDENTIFIERS.has(segment)),
      'A path segment may not name an inherited member such as __proto__, constructor or toString',
    ),
});

export const ArithmeticExpressionSchema = z.object({
  kind: z.literal('arithmetic'),
  op: z.enum(ARITHMETIC_OPERATORS),
  left: PrintableExpressionSchema,
  right: PrintableExpressionSchema,
});

export const PercentOfExpressionSchema = z.object({
  kind: z.literal('percentOf'),
  base: PrintableExpressionSchema,
  rate: PrintableExpressionSchema,
});

/**
 * A date operand, checked at SAVE TIME when it is written as a literal string.
 *
 * "Shape validation cannot move up to parse time" was a non-sequitur: that a `path` cannot
 * be verified when a template is saved says nothing about a `literal`, and the repository's
 * doctrine is explicit at exactly this point -- `PathExpressionSchema` exists so that "a
 * malformed path fails when the template is saved instead of when a document renders". So
 * the refinement says something about a literal string and stays silent about everything
 * else.
 */
const dateOperandSchema: z.ZodType<PrintableExpression> = PrintableExpressionSchema.refine(
  (operand) =>
    operand.kind !== 'literal' ||
    typeof operand.value !== 'string' ||
    dayNumberOf(operand.value) !== undefined,
  'A literal date must be written YYYY-MM-DD, between 0001-01-01 and 9999-12-31',
);

/**
 * A day-count operand, checked at SAVE TIME when it is written as a literal.
 *
 * The sibling of {@link dateOperandSchema}, and it was missing: a literal `'30'` or `1.5` in
 * a `days` position parsed cleanly and failed only when a document rendered, though the
 * argument for checking a literal date applies word for word to a literal day count.
 *
 * **Where both refinements stop.** Each inspects only the operand AT ITS OWN LEVEL, so
 * `endOfMonth(if(cond, '2026-02-30', ...))` still parses -- the bad literal sits inside a
 * conditional, not in the date position. Save-time validation reaches literals in the
 * position itself and nothing further; the evaluator is what catches the rest.
 */
const dayCountOperandSchema: z.ZodType<PrintableExpression> = PrintableExpressionSchema.refine(
  (operand) =>
    operand.kind !== 'literal' ||
    (typeof operand.value === 'number' && Number.isInteger(operand.value)) ||
    operand.value === null,
  'A literal date shift must be a whole number of days',
);

export const ConcatExpressionSchema = z.object({
  kind: z.literal('concat'),
  parts: z.array(PrintableExpressionSchema).min(2, 'A concat needs at least two parts'),
});

export const TextExpressionSchema = z.object({
  kind: z.literal('text'),
  value: PrintableExpressionSchema,
});

export const TextCaseExpressionSchema = z.object({
  kind: z.literal('textCase'),
  op: z.enum(TEXT_CASE_OPERATORS),
  text: PrintableExpressionSchema,
});

export const DateAddExpressionSchema = z.object({
  kind: z.literal('dateAdd'),
  date: dateOperandSchema,
  days: dayCountOperandSchema,
});

export const DateDiffExpressionSchema = z.object({
  kind: z.literal('dateDiff'),
  from: dateOperandSchema,
  to: dateOperandSchema,
});

export const EndOfMonthExpressionSchema = z.object({
  kind: z.literal('endOfMonth'),
  date: dateOperandSchema,
});

export const AggregateExpressionSchema = z.object({
  kind: z.literal('aggregate'),
  op: z.enum(AGGREGATE_OPERATORS),
  source: ExpressionSchema,
  as: aliasSchema,
  value: PrintableExpressionSchema,
});

export const CountExpressionSchema = z.object({
  kind: z.literal('count'),
  source: ExpressionSchema,
});

export const FilterExpressionSchema = z.object({
  kind: z.literal('filter'),
  source: ExpressionSchema,
  as: aliasSchema,
  where: ExpressionSchema,
});

export const ConditionalExpressionSchema = z.object({
  kind: z.literal('if'),
  when: ExpressionSchema,
  whenTrue: PrintableExpressionSchema,
  whenFalse: PrintableExpressionSchema,
});

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

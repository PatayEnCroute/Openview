import { z } from 'zod/v4';
import { ROUNDING_POSITION_TYPE_MESSAGE } from '../validation-messages.js';
import { dayNumberOf } from './civil-date.js';
import { aliasSchema, FORBIDDEN_IDENTIFIERS, PATH_PATTERN } from './identifiers.js';
import {
  AGGREGATE_OPERATORS,
  ARITHMETIC_OPERATORS,
  type Expression,
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  type PrintableExpression,
  ROUND_MODES,
  TEXT_CASE_OPERATORS,
} from './types.js';

const literalValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

function printableMembers() {
  return [
    LiteralExpressionSchema,
    PathExpressionSchema,
    ArithmeticExpressionSchema,
    PercentOfExpressionSchema,
    RoundExpressionSchema,
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

function listMembers() {
  return [FilterExpressionSchema] as const;
}

/** Zod schema for any algebraic expression. */
export const ExpressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion('kind', [...printableMembers(), ...predicateMembers(), ...listMembers()]),
);

/** Zod schema for printable expressions usable in text bindings. */
export const PrintableExpressionSchema: z.ZodType<PrintableExpression> = z.lazy(() =>
  z.discriminatedUnion('kind', printableMembers()),
);

export const LiteralExpressionSchema = z.object({
  kind: z.literal('literal'),
  value: literalValueSchema,
});

export const PathExpressionSchema = z.object({
  kind: z.literal('path'),
  path: z
    .string()
    .min(1, 'A path expression needs a path')
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
 * The decimal position a rounding is declared at, with the bounds and messages of the operation.
 *
 * Shared rather than repeated: every site that rounds accepts exactly the same positions, so a
 * second spelling would be a second policy able to drift from this one.
 */
export const RoundingPositionSchema = z
  .number({ error: ROUNDING_POSITION_TYPE_MESSAGE })
  .int('A rounding position is a whole number of decimal places')
  .min(MIN_ROUND_DECIMALS, `A rounding position may not go below ${MIN_ROUND_DECIMALS}`)
  .max(MAX_ROUND_DECIMALS, `A rounding position may not exceed ${MAX_ROUND_DECIMALS}`);

export const RoundExpressionSchema = z.object({
  kind: z.literal('round'),
  value: PrintableExpressionSchema,
  decimals: RoundingPositionSchema,
  mode: z.enum(ROUND_MODES),
});

const dateOperandSchema: z.ZodType<PrintableExpression> = PrintableExpressionSchema.refine(
  (operand) =>
    operand.kind !== 'literal' ||
    typeof operand.value !== 'string' ||
    dayNumberOf(operand.value) !== undefined,
  'A literal date must be written YYYY-MM-DD, between 0001-01-01 and 9999-12-31',
);

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

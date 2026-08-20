/**
 * Types and operator definitions for structured expressions.
 */

export type LiteralValue = string | number | boolean | null;

/** Strict comparison operators. */
export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

/** Standard arithmetic operators. */
export const ARITHMETIC_OPERATORS = ['add', 'sub', 'mul', 'div'] as const;

export type ArithmeticOperator = (typeof ARITHMETIC_OPERATORS)[number];

/** Numeric list aggregation operators. */
export const AGGREGATE_OPERATORS = ['sum', 'avg', 'min', 'max'] as const;

export type AggregateOperator = (typeof AGGREGATE_OPERATORS)[number];

/** Text case folding operators. */
export const TEXT_CASE_OPERATORS = ['upper', 'lower'] as const;

export type TextCaseOperator = (typeof TEXT_CASE_OPERATORS)[number];

/** Supported rounding modes (ECMA-402 names). */
export const ROUND_MODES = ['halfExpand', 'halfEven'] as const;

export type RoundMode = (typeof ROUND_MODES)[number];

/** Rounding decimal bounds (powers of ten from -15 to +15). */
export const MIN_ROUND_DECIMALS = -15;
export const MAX_ROUND_DECIMALS = 15;

/** Raw literal value expression. */
export interface LiteralExpression {
  readonly kind: 'literal';
  readonly value: LiteralValue;
}

/** Dotted path expression accessing host render data (e.g., `invoice.total`). */
export interface PathExpression {
  readonly kind: 'path';
  readonly path: string;
}

/** Binary comparison expression. */
export interface CompareExpression {
  readonly kind: 'compare';
  readonly op: ComparisonOperator;
  readonly left: Expression;
  readonly right: Expression;
}

/** N-ary logical `and` or `or` expression. */
export interface LogicalExpression {
  readonly kind: 'logical';
  readonly op: 'and' | 'or';
  readonly operands: readonly Expression[];
}

/** Logical negation expression. */
export interface NotExpression {
  readonly kind: 'not';
  readonly operand: Expression;
}

/** Emptiness check (null, undefined, empty string/array/object). */
export interface IsEmptyExpression {
  readonly kind: 'isEmpty';
  readonly operand: Expression;
}

/** Binary arithmetic operation expression. */
export interface ArithmeticExpression {
  readonly kind: 'arithmetic';
  readonly op: ArithmeticOperator;
  readonly left: PrintableExpression;
  readonly right: PrintableExpression;
}

/** Percentage calculation expression: `base * rate / 100`. */
export interface PercentOfExpression {
  readonly kind: 'percentOf';
  readonly base: PrintableExpression;
  readonly rate: PrintableExpression;
}

/** Explicit numerical rounding expression. */
export interface RoundExpression {
  readonly kind: 'round';
  readonly value: PrintableExpression;
  readonly decimals: number;
  readonly mode: RoundMode;
}

/** Inline conditional expression (ternary if). */
export interface ConditionalExpression {
  readonly kind: 'if';
  readonly when: Expression;
  readonly whenTrue: PrintableExpression;
  readonly whenFalse: PrintableExpression;
}

/** List reduction expression using an aggregation operator. */
export interface AggregateExpression {
  readonly kind: 'aggregate';
  readonly op: AggregateOperator;
  readonly source: Expression;
  readonly as: string;
  readonly value: PrintableExpression;
}

/** List element count expression. */
export interface CountExpression {
  readonly kind: 'count';
  readonly source: Expression;
}

/** List filter expression yielding elements that satisfy a predicate. */
export interface FilterExpression {
  readonly kind: 'filter';
  readonly source: Expression;
  readonly as: string;
  readonly where: Expression;
}

/** Text concatenation expression. */
export interface ConcatExpression {
  readonly kind: 'concat';
  readonly parts: readonly PrintableExpression[];
}

/** Explicit canonical string conversion expression. */
export interface TextExpression {
  readonly kind: 'text';
  readonly value: PrintableExpression;
}

/** Text case folding expression. */
export interface TextCaseExpression {
  readonly kind: 'textCase';
  readonly op: TextCaseOperator;
  readonly text: PrintableExpression;
}

/** Date addition expression adding an integer number of days to an ISO civil date (`YYYY-MM-DD`). */
export interface DateAddExpression {
  readonly kind: 'dateAdd';
  readonly date: PrintableExpression;
  readonly days: PrintableExpression;
}

/** Date difference expression calculating the number of days between two ISO civil dates (`to - from`). */
export interface DateDiffExpression {
  readonly kind: 'dateDiff';
  readonly from: PrintableExpression;
  readonly to: PrintableExpression;
}

/** End of month expression yielding the last day of the month for an ISO civil date. */
export interface EndOfMonthExpression {
  readonly kind: 'endOfMonth';
  readonly date: PrintableExpression;
}

/** Printable sub-algebra usable in text binding segments. */
export type PrintableExpression =
  | LiteralExpression
  | PathExpression
  | ArithmeticExpression
  | PercentOfExpression
  | RoundExpression
  | AggregateExpression
  | CountExpression
  | ConditionalExpression
  | ConcatExpression
  | TextExpression
  | TextCaseExpression
  | DateAddExpression
  | DateDiffExpression
  | EndOfMonthExpression;

/** Predicate sub-algebra evaluating to a boolean. */
export type PredicateExpression =
  | CompareExpression
  | LogicalExpression
  | NotExpression
  | IsEmptyExpression;

/** Complete expression union. */
export type Expression = PrintableExpression | PredicateExpression | FilterExpression;

export type ExpressionKind = Expression['kind'];

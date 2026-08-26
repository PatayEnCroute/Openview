/**
 * Structured expressions (ADR 0001, option C; widened by ADR 0003).
 *
 * Facade module re-exporting expression types, schemas, identifier validations,
 * and static path analysis.
 */

export {
  aliasSchema,
  FORBIDDEN_IDENTIFIERS,
  IDENTIFIER_PATTERN,
  IDENTIFIER_SOURCE,
  isIdentifier,
  PATH_PATTERN,
} from './identifiers.js';
export {
  pathsOf,
  rootSegment,
} from './paths.js';
export {
  AggregateExpressionSchema,
  ArithmeticExpressionSchema,
  CompareExpressionSchema,
  ConcatExpressionSchema,
  ConditionalExpressionSchema,
  CountExpressionSchema,
  DateAddExpressionSchema,
  DateDiffExpressionSchema,
  EndOfMonthExpressionSchema,
  ExpressionSchema,
  FilterExpressionSchema,
  IsEmptyExpressionSchema,
  LiteralExpressionSchema,
  LogicalExpressionSchema,
  NotExpressionSchema,
  PathExpressionSchema,
  PercentOfExpressionSchema,
  PrintableExpressionSchema,
  RoundExpressionSchema,
  RoundingPositionSchema,
  TextCaseExpressionSchema,
  TextExpressionSchema,
} from './schemas.js';
export type {
  AggregateExpression,
  AggregateOperator,
  ArithmeticExpression,
  ArithmeticOperator,
  CompareExpression,
  ComparisonOperator,
  ConcatExpression,
  ConditionalExpression,
  CountExpression,
  DateAddExpression,
  DateDiffExpression,
  EndOfMonthExpression,
  Expression,
  ExpressionKind,
  FilterExpression,
  IsEmptyExpression,
  LiteralExpression,
  LiteralValue,
  LogicalExpression,
  NotExpression,
  PathExpression,
  PercentOfExpression,
  PredicateExpression,
  PrintableExpression,
  RoundExpression,
  RoundMode,
  TextCaseExpression,
  TextCaseOperator,
  TextExpression,
} from './types.js';
export {
  AGGREGATE_OPERATORS,
  ARITHMETIC_OPERATORS,
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  ROUND_MODES,
  TEXT_CASE_OPERATORS,
} from './types.js';
export type { ExpressionVisitor } from './visitor.js';
export { visitExpression } from './visitor.js';

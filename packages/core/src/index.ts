/**
 * @openview/core -- template contracts, AST, expressions and ports.
 *
 * Pure TypeScript and Zod: no React, no Node, no browser API. That constraint is
 * enforced by this package's `lib`/`types` and by `noRestrictedImports`, not by
 * good intentions.
 */

export type {
  ConditionNode,
  ContainerNode,
  DocumentNode,
  DocumentNodeType,
  ImageNode,
  LoopNode,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextSegment,
} from './ast/nodes.js';
export {
  ConditionNodeSchema,
  ContainerNodeSchema,
  DocumentNodeSchema,
  ImageNodeSchema,
  LoopNodeSchema,
  TextBindingSegmentSchema,
  TextLiteralSegmentSchema,
  TextNodeSchema,
  TextSegmentSchema,
} from './ast/nodes.js';
export type { NodeReads, NodeVisitor, SegmentVisitor } from './ast/visitor.js';
export {
  childrenOf,
  collectDataPaths,
  findNodeById,
  nodeReads,
  visitNode,
  visitSegment,
  walk,
} from './ast/visitor.js';

export type {
  ExpressionErrorCode,
  ExpressionErrorDetails,
  ExpressionErrorSite,
  LimitErrorCode,
  OperandErrorCode,
  ShapeErrorCode,
} from './errors.js';
export {
  EXPRESSION_ERROR_CODES,
  ExpressionEvaluationError,
  InvalidEvaluationLimitsError,
  InvalidShapeLimitsError,
  LIMIT_ERROR_CODES,
  OPERAND_ERROR_CODES,
  OpenviewError,
  SHAPE_ERROR_CODES,
  TemplateMigrationError,
  TemplateShapeError,
} from './errors.js';
export {
  civilDateOf,
  dayNumberOf,
  endOfMonthOf,
  shiftDay,
} from './expression/civil-date.js';
export type {
  AttributedEvaluationOptions,
  EvaluationOptions,
  EvaluationScope,
} from './expression/evaluate.js';
export {
  childScope,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
} from './expression/evaluate.js';
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
  TextCaseExpression,
  TextCaseOperator,
  TextExpression,
} from './expression/expression.js';
export {
  AGGREGATE_OPERATORS,
  AggregateExpressionSchema,
  ARITHMETIC_OPERATORS,
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
  pathsOf,
  TEXT_CASE_OPERATORS,
  TextCaseExpressionSchema,
  TextExpressionSchema,
} from './expression/expression.js';
export type { EvaluationBudget, EvaluationLimits } from './expression/limits.js';
export {
  createBudget,
  DEFAULT_EVALUATION_LIMITS,
  resolveEvaluationLimits,
} from './expression/limits.js';
export type { ExpressionValueType } from './expression/value-type.js';
export { EXPRESSION_VALUE_TYPES, kindOf, valueTypeOf } from './expression/value-type.js';

export type { RenderFormat, RenderPort, RenderRequest, RenderResult } from './ports/render.js';
export type { TemplateStoragePort } from './ports/storage.js';
export type { ShapeLimits } from './template/guard.js';
export {
  assertBoundedShape,
  DEFAULT_SHAPE_LIMITS,
  parseDocumentNode,
  parseExpression,
  resolveShapeLimits,
} from './template/guard.js';
export type { TemplateMigration } from './template/migrate.js';
export { migrateToCurrent, parseTemplate, TEMPLATE_MIGRATIONS } from './template/migrate.js';
export type { Template, TemplateSummary } from './template/template.js';
export { CURRENT_SCHEMA_VERSION, TemplateSchema } from './template/template.js';

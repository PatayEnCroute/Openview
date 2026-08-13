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
} from './errors.js';
export {
  EXPRESSION_ERROR_CODES,
  ExpressionEvaluationError,
  LIMIT_ERROR_CODES,
  OPERAND_ERROR_CODES,
  OpenviewError,
  TemplateMigrationError,
} from './errors.js';

export type { EvaluationOptions, EvaluationScope } from './expression/evaluate.js';
export {
  childScope,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
} from './expression/evaluate.js';
export type {
  CompareExpression,
  ComparisonOperator,
  Expression,
  ExpressionKind,
  IsEmptyExpression,
  LiteralExpression,
  LiteralValue,
  LogicalExpression,
  NotExpression,
  PathExpression,
  PredicateExpression,
  PrintableExpression,
} from './expression/expression.js';
export {
  CompareExpressionSchema,
  ExpressionSchema,
  IsEmptyExpressionSchema,
  LiteralExpressionSchema,
  LogicalExpressionSchema,
  NotExpressionSchema,
  PathExpressionSchema,
  PrintableExpressionSchema,
  pathsOf,
} from './expression/expression.js';
export type { ExpressionValueType } from './expression/value-type.js';
export { EXPRESSION_VALUE_TYPES, valueTypeOf } from './expression/value-type.js';

export type { RenderFormat, RenderPort, RenderRequest, RenderResult } from './ports/render.js';
export type { TemplateStoragePort } from './ports/storage.js';
export type { TemplateMigration } from './template/migrate.js';
export { migrateToCurrent, parseTemplate, TEMPLATE_MIGRATIONS } from './template/migrate.js';
export type { Template, TemplateSummary } from './template/template.js';
export { CURRENT_SCHEMA_VERSION, TemplateSchema } from './template/template.js';

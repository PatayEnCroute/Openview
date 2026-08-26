/**
 * @openview/core -- template contracts, AST, expressions and ports.
 *
 * Pure TypeScript and Zod: no React, no Node, no browser API. That constraint is
 * enforced by this package's `lib`/`types` and by `noRestrictedImports`, not by
 * good intentions.
 */

export type {
  BlockNode,
  BlockNodeType,
  ConditionNode,
  ContainerNode,
  DocumentNode,
  DocumentNodeType,
  ImageNode,
  LoopNode,
  PageField,
  PageReportContribution,
  TableBodyNode,
  TableCell,
  TableColumn,
  TableColumnAlignment,
  TableNode,
  TableRowGroupNode,
  TableRowNode,
  TextAlignment,
  TextBindingSegment,
  TextLiteralSegment,
  TextNode,
  TextPageCountSegment,
  TextPageFieldSegment,
  TextPageReportSegment,
  TextSegment,
} from './ast/nodes.js';
export {
  BlockNodeSchema,
  ConditionNodeSchema,
  ContainerNodeSchema,
  DocumentNodeSchema,
  ImageNodeSchema,
  LoopNodeSchema,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  PAGE_FIELDS,
  PageReportContributionSchema,
  TABLE_COLUMN_ALIGNMENTS,
  TableBodyNodeSchema,
  TableCellSchema,
  TableColumnSchema,
  TableNodeSchema,
  TableRowGroupNodeSchema,
  TableRowNodeSchema,
  TEXT_ALIGNMENTS,
  TextBindingSegmentSchema,
  TextLiteralSegmentSchema,
  TextNodeSchema,
  TextPageCountSegmentSchema,
  TextPageFieldSegmentSchema,
  TextPageReportSegmentSchema,
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
  ConfigurationDiagnostic,
  ConfigurationDiagnosticCode,
  DiagnosticContext,
  DiagnosticSource,
  ExpressionEvaluationDiagnostic,
  OpenviewDiagnostic,
  PresentationResolutionDiagnostic,
  TemplateMigrationDiagnostic,
  TemplateShapeDiagnostic,
  TemplateValidationCode,
  TemplateValidationDiagnostic,
} from './diagnostics/diagnostics.js';
export {
  CONFIGURATION_DIAGNOSTIC_CODES,
  DIAGNOSTIC_SOURCES,
  diagnosticOfPresentationRefusal,
  diagnosticsOf,
  TEMPLATE_VALIDATION_CODES,
} from './diagnostics/diagnostics.js';
export type {
  ExpressionErrorCode,
  ExpressionErrorDetails,
  ExpressionErrorSite,
  LimitErrorCode,
  OperandErrorCode,
  ShapeErrorCode,
  TemplateMigrationErrorCode,
  TemplateMigrationErrorOptions,
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
  TEMPLATE_MIGRATION_ERROR_CODES,
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
  roundDecimal,
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
  RoundExpression,
  RoundMode,
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
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  NotExpressionSchema,
  PathExpressionSchema,
  PercentOfExpressionSchema,
  PrintableExpressionSchema,
  pathsOf,
  ROUND_MODES,
  RoundExpressionSchema,
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

export type {
  PageBand,
  PageBandOccurrence,
  PageMargins,
  PageSetup,
  PrintableArea,
  Sheet,
  StandardSheetName,
} from './page/page.js';
export {
  MAX_BANDS_PER_SIDE,
  MAX_SHEET_MM,
  MIN_SHEET_MM,
  PAGE_BAND_OCCURRENCES,
  PageBandSchema,
  PageBandsSchema,
  PageMarginsSchema,
  PageSetupSchema,
  printableAreaOf,
  SheetSchema,
  STANDARD_SHEETS_MM,
} from './page/page.js';
export type { RenderFormat, RenderPort, RenderRequest, RenderResult } from './ports/render.js';
export type { TemplateStoragePort } from './ports/storage.js';
export type {
  DateStyle,
  Presentation,
  PresentationRefusal,
  PresentationResolution,
  PresentationTable,
} from './presentation/presentation.js';
export {
  DATE_STYLES,
  formatDate,
  formatDecimal,
  formatMoney,
  MAX_FRACTION_DIGITS,
  MIN_FRACTION_DIGITS,
  PRESENTATION_REFUSALS,
  PresentationSchema,
  PresentationTableSchema,
  resolvePresentation,
} from './presentation/presentation.js';
export type {
  BorderEdge,
  BoxBorder,
  BoxSpacing,
  BoxStyle,
  Color,
  TextAlignSources,
  Typography,
  TypographySources,
} from './style/style.js';
export {
  BorderEdgeSchema,
  BoxBorderSchema,
  BoxSpacingSchema,
  BoxStyleSchema,
  ColorSchema,
  MAX_FONT_SIZE_PT,
  MIN_FONT_SIZE_PT,
  mmFromPt,
  ptFromMm,
  resolveTextAlign,
  resolveTypography,
  TypographySchema,
} from './style/style.js';
export type { ShapeLimits } from './template/guard.js';
export {
  assertBoundedShape,
  DEFAULT_SHAPE_LIMITS,
  parseBlockNode,
  parseDocumentNode,
  parseExpression,
  parsePageSetup,
  resolveShapeLimits,
} from './template/guard.js';
export type { TemplateMigration } from './template/migrate.js';
export { migrateToCurrent, parseTemplate, TEMPLATE_MIGRATIONS } from './template/migrate.js';
export { collectTemplateDataPaths } from './template/paths.js';
export type { Template, TemplateSummary } from './template/template.js';
export { CURRENT_SCHEMA_VERSION, TemplateSchema } from './template/template.js';

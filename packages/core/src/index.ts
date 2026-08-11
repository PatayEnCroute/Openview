/**
 * @openview/core -- data contracts, AST and ports.
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
  ExpressionSource,
  ImageNode,
  LoopNode,
  TextNode,
} from './ast/nodes.js';
export {
  ConditionNodeSchema,
  ContainerNodeSchema,
  DocumentNodeSchema,
  ImageNodeSchema,
  LoopNodeSchema,
  TextNodeSchema,
} from './ast/nodes.js';
export type { NodeVisitor } from './ast/visitor.js';
export { childrenOf, collectExpressions, findNodeById, visitNode, walk } from './ast/visitor.js';

export { OpenviewError, TemplateMigrationError } from './errors.js';
export type { RenderFormat, RenderPort, RenderRequest, RenderResult } from './ports/render.js';
export type { TemplateStoragePort } from './ports/storage.js';
export type { TemplateMigration } from './template/migrate.js';
export { migrateToCurrent, parseTemplate, TEMPLATE_MIGRATIONS } from './template/migrate.js';
export type { Template, TemplateSummary } from './template/template.js';
export { CURRENT_SCHEMA_VERSION, TemplateSchema } from './template/template.js';

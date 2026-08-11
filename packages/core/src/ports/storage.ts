import type { Template, TemplateSummary } from '../template/template.js';

/**
 * Hexagonal port for template persistence.
 *
 * This one earns its abstraction: "decoupled from storage" is the product's
 * headless promise, so integrators are expected to supply their own adapter
 * (filesystem, S3, Postgres, an existing CMS). @openview/core never learns where
 * a template lives.
 *
 * Implementations live outside core. Anything that returns `undefined` here
 * means "absent", never "failed": a failure must throw so callers cannot
 * silently treat an outage as a missing template.
 */
export interface TemplateStoragePort {
  load(id: string): Promise<Template | undefined>;
  save(template: Template): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<readonly TemplateSummary[]>;
}

import type { Template, TemplateSummary } from '../template/template.js';

/** Hexagonal port for template persistence. */
export interface TemplateStoragePort {
  load(id: string): Promise<Template | undefined>;
  save(template: Template): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<readonly TemplateSummary[]>;
}

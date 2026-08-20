import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';
import { PageSetupSchema } from '../page/page.js';

export const CURRENT_SCHEMA_VERSION = 6;

/**
 * Zod schema for validating a complete document template at CURRENT_SCHEMA_VERSION.
 */
export const TemplateSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1, 'A template id is required'),
  name: z.string().min(1, 'A template name is required'),
  version: z.string().default('1.0.0'),
  page: PageSetupSchema,
  root: ContainerNodeSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Template = z.infer<typeof TemplateSchema>;

/** Identifying fields for template listings. */
export type TemplateSummary = Pick<Template, 'id' | 'name' | 'version' | 'updatedAt'>;

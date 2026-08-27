import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';
import { PageSetupSchema } from '../page/page.js';
import { PresentationTableSchema } from '../presentation/presentation.js';

/**
 * Current format version of the stored document schema.
 *
 * Distinct from {@link Template.version}, which is the author-facing document revision.
 * @see docs/adr/0009-les-blocs-insecables.md
 */
export const CURRENT_SCHEMA_VERSION = 11;

/**
 * Zod schema for validating a complete document template at CURRENT_SCHEMA_VERSION.
 */
export const TemplateSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1, 'A template id is required'),
  name: z.string().min(1, 'A template name is required'),
  version: z.string().default('1.0.0'),
  page: PageSetupSchema,
  /** Optional presentations mapping declared by the template author. */
  presentations: PresentationTableSchema.optional(),
  root: ContainerNodeSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Template = z.infer<typeof TemplateSchema>;

/** Identifying fields for template listings. */
export type TemplateSummary = Pick<Template, 'id' | 'name' | 'version' | 'updatedAt'>;

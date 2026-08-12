import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';

/**
 * Format version of the template document, distinct from {@link Template.version}
 * which is the author-facing revision of a given template.
 *
 * Bump this whenever the stored shape changes, and add the matching entry to
 * TEMPLATE_MIGRATIONS in ./migrate.ts in the same commit. A template saved by an
 * older release must stay renderable: this is the one decision that cannot be
 * revisited once a real user has saved a document.
 *
 * "Whenever" includes adding a purely OPTIONAL field, which needs no migration
 * step but still needs the bump. Zod strips unknown keys, so a document written by
 * a newer release and opened by an older one loses the new field silently -- and
 * an editor then re-saves the loss. The version is what makes migrateToCurrent
 * refuse the document instead ("written by a newer release; upgrade before
 * opening it").
 */
export const CURRENT_SCHEMA_VERSION = 1;

export const TemplateSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1, 'A template id is required'),
  name: z.string().min(1, 'A template name is required'),
  /** Author-facing revision, free-form. Never drives migrations. */
  version: z.string().default('1.0.0'),
  root: ContainerNodeSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Template = z.infer<typeof TemplateSchema>;

/** Identifying fields only, for listing templates without loading their trees. */
export type TemplateSummary = Pick<Template, 'id' | 'name' | 'version' | 'updatedAt'>;

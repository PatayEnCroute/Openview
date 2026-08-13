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
 * "Whenever" covers two incompatibilities, and NEITHER of them produces a legible
 * error without the bump. Both are measured, not supposed.
 *
 * SILENT LOSS -- adding a purely OPTIONAL field. Zod strips unknown keys, so a
 * document written by a newer release and opened by an older one loses the new
 * field with no error at all, and an editor then re-saves the loss.
 *
 * ILLEGIBLE REFUSAL -- WIDENING a union, which is what ADR 0003 did to the
 * expression algebra. An older build meets a kind it has no member for, and Zod
 * reports `"note": "No matching discriminator"`, `"message": "Invalid input"` on a
 * path like `root.children.0.content.1.value.kind`: not an OpenviewError, not a
 * TemplateMigrationError, no mention of a version, and no remedy for whoever reads
 * it. With the bump, the same document yields
 * `TemplateMigrationError: Template uses schema version 2 but this build
 * understands at most 1. It was written by a newer release of Openview; upgrade
 * before opening it.` -- which is the message lot C8 is being built to produce.
 *
 * A migration that only stamps the version is therefore NOT a phantom migration:
 * the stamp is the entire mechanism behind that second message.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Note what a Template does NOT carry: any description of the data it expects.
 * The catalogue of available fields belongs to the integrating application (see
 * `EvaluationScope`, and `dataCatalogue` on the Designer's props). A template records
 * what it READS -- `collectDataPaths` recovers exactly that -- never what the
 * caller must supply. Adding a data schema to the stored document would move the
 * ownership of the data from the host application to Openview.
 */
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

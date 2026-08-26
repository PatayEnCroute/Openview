import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';
import { PageSetupSchema } from '../page/page.js';
import { PresentationTableSchema } from '../presentation/presentation.js';

/**
 * Format version of the stored document, distinct from {@link Template.version}, which is the
 * author-facing revision.
 *
 * Bump it whenever the stored shape changes, and register the matching entry in
 * `TEMPLATE_MIGRATIONS` in the SAME commit. Without the bump, an older build opening a newer
 * document either strips the unknown field with no error at all, or refuses it with a message
 * naming no version and offering no remedy.
 *
 * Version 10 widens the block union with a `grid` node and adds one optional field, `layers`, to
 * the page setup. Both classes of change need the bump: the widened union is refused by an older
 * build with no version named, and the optional field is stripped by it in silence.
 *
 * @see docs/adr/0009-les-blocs-insecables.md
 */
export const CURRENT_SCHEMA_VERSION = 10;

/**
 * Zod schema for validating a complete document template at CURRENT_SCHEMA_VERSION.
 */
export const TemplateSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1, 'A template id is required'),
  name: z.string().min(1, 'A template name is required'),
  version: z.string().default('1.0.0'),
  page: PageSetupSchema,
  /**
   * The writings this model declares, by the name its author chose.
   *
   * Optional and with no schema default: an absent table means "this model declares no writing",
   * which is what every document written before version 7 says, and requiring it would oblige the
   * 6 -> 7 migration to invent a language and a money. An EMPTY table is a different statement from
   * an absent one, and both are accepted.
   *
   * Being optional is not what protects an older build from it -- only
   * {@link CURRENT_SCHEMA_VERSION} does that.
   */
  presentations: PresentationTableSchema.optional(),
  root: ContainerNodeSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Template = z.infer<typeof TemplateSchema>;

/** Identifying fields for template listings. */
export type TemplateSummary = Pick<Template, 'id' | 'name' | 'version' | 'updatedAt'>;

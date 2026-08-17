import { z } from 'zod/v4';
import { ContainerNodeSchema } from '../ast/nodes.js';
import { PageSetupSchema } from '../page/page.js';

/**
 * Format version of the template document, distinct from {@link Template.version}
 * which is the author-facing revision of a given template.
 *
 * ## What version 2 means
 *
 * Version 2 is **the complete C1 algebra**: the 18 expression kinds of ADR 0003 --
 * arithmetic and percentage, aggregation, count and filter, the in-formula conditional,
 * concatenation, explicit stringification, case folding, and the three civil-date
 * operations -- plus `TextBindingSegment.value` widened from `literal | path` to the whole
 * printable sub-algebra.
 *
 * It is stamped ONCE, after the last persisted shape of the lot, and not once per
 * increment. Four stamps and four identity migrations for one functional lot would make the
 * number designate a commit rather than a contract. The consequence was a rule of conduct
 * while the lot was in flight: no commit before this one was publishable, because a build
 * taken mid-lot reads a lower version and would answer `Invalid input` to a document written
 * by a later one -- exactly the defect the bump exists to fix.
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
 *
 * ## What version 3 means
 *
 * Version 3 is version 2 plus ONE stored shape: the `round` kind -- a printable wrapper
 * carrying a literal position in [-15, 15] and one of two tie-breaking modes. Nineteen
 * expression kinds. That widens `PrintableExpressionSchema`, hence
 * `TextBindingSegment.value`, hence every operand position of the algebra.
 *
 * It is the ILLEGIBLE REFUSAL case described above, unchanged: a version 2 build meeting
 * `{ kind: 'round', ... }` answers `"No matching discriminator"` / `"Invalid input"` on a
 * path like `root.children.0.content.1.value.kind`, with no version named and no remedy.
 * "Purely additive" is not an argument against the bump, it is the argument FOR it.
 *
 * Stamped ONCE, after the last persisted shape of the lot. No commit of C2 before that one
 * is publishable, for the reason version 2 already records.
 *
 * ## What version 4 means
 *
 * Version 4 is version 3 plus lot C3, the table of lines: THREE stored node types --
 * `table`, `tableRowGroup` and `tableRow` -- a declared column list carrying an id, a
 * whole-number width weight and an alignment, and cells keyed by column id. Eight document
 * node types. It also SPLITS the node union in two: the children of a container, of a loop,
 * of a condition and of a table cell are BLOCKS, so a bare row cannot stand in a document
 * flow.
 *
 * It is the ILLEGIBLE REFUSAL case described above, a third time and unchanged: a version 3
 * build meeting `{ type: 'table', ... }` answers `"No matching discriminator"` / `"Invalid
 * input"` on a path like `root.children.0.type`, with no version named and no remedy.
 * "Purely additive" is once more the argument FOR the bump, not against it.
 *
 * Stamped ONCE, after the last persisted shape of the lot. No commit of C3 before that one
 * is publishable, for the reason version 2 already records.
 */
export const CURRENT_SCHEMA_VERSION = 4;

/**
 * **`.parse` on this schema bounds nothing**, and it is the shortest way around the shape
 * guard: `TemplateSchema.parse(raw)` is exactly `parseTemplate`'s body minus its guard, so a
 * deep enough document raises a bare `RangeError` from Zod instead of a typed
 * `TemplateShapeError`. Use `parseTemplate` unless you specifically need the schema as a
 * value -- for `z.infer`, for composition, or for the partial validation a Designer does.
 *
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
  /**
   * The sheet, its margins and its repeated bands.
   *
   * REQUIRED, with no schema default, for two reasons and NOT for a third that looks like
   * one. The recipe criterion says a template IMPOSES its format, and an optional field
   * imposes nothing -- it permits. And an absent page forces the engine to invent a sheet,
   * which moves a layout decision into a render file, with nothing checking that the viewer
   * invents the same one.
   *
   * NOT because required-ness prevents silent loss: it does not. An older build strips a key
   * it does not know whether the newer schema calls it required or optional -- only the schema
   * version protects against that, see {@link CURRENT_SCHEMA_VERSION}.
   *
   * A `z.default()` would be worse than optional, and that IS measured: a document with no
   * page parses and comes out carrying a sheet Openview chose, at every parse, silently.
   *
   * The compatibility sheet exists all the same -- but it is written ONCE, by the 4 -> 5
   * migration, where it is visible and dated.
   *
   * Written before `root` because the geometry precedes the content in a document's reading
   * order, and because a field appended at the end blends into the optional timestamps.
   */
  page: PageSetupSchema,
  root: ContainerNodeSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Template = z.infer<typeof TemplateSchema>;

/** Identifying fields only, for listing templates without loading their trees. */
export type TemplateSummary = Pick<Template, 'id' | 'name' | 'version' | 'updatedAt'>;

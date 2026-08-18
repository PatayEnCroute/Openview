import { z } from 'zod/v4';
import { TemplateMigrationError } from '../errors.js';
import type { PageSetup } from '../page/page.js';
import { assertBoundedShape, type ShapeLimits } from './guard.js';
import { CURRENT_SCHEMA_VERSION, type Template, TemplateSchema } from './template.js';

/**
 * The sheet the 4 -> 5 migration writes on a document that has none: A4 portrait, 20 mm all
 * round, no band. Not a default -- see the migration's own docstring for why the distinction
 * is measurable rather than rhetorical.
 *
 * A FUNCTION, not a constant, and the difference is a defect that was measured rather than
 * imagined. As a module-level object it was written into every migrated document BY
 * REFERENCE: `migrateToCurrent(a).page === migrateToCurrent(b).page` was `true`, down to
 * `sheet` and the two band arrays. That door is public and hands back a
 * `Record<string, unknown>`, so `readonly` is erased at the boundary and nothing stops a
 * caller from normalising the record it was just told to handle -- after which
 * `a.page.sheet.width = 999` made a LATER, unrelated `parseTemplate` return `width: 999`,
 * and an impossible margin made it refuse a document whose author had written no page at
 * all. That is precisely the failure this file's docstrings exist to prevent: a message
 * accusing the document while the fault is upstream. `parseTemplate` was safe only by
 * accident, because zod clones on output.
 *
 * The RETURN TYPE is annotated, and the annotation is the only thing that checks it.
 * `TemplateMigration.migrate` is typed `(input: Record<string, unknown>) =>
 * Record<string, unknown>`, so whatever is written into `page` arrives as `unknown` and the
 * registry verifies nothing. Measured: with the annotation, a page missing its `footer` is
 * `TS2741` at gate 2; without it, the same incomplete page passes every gate in silence and
 * the migration produces something the parse refuses AFTERWARDS.
 */
function compatibilityPage(): PageSetup {
  return {
    sheet: { width: 210, height: 297 },
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    header: [],
    footer: [],
  };
}

/**
 * One step of the upgrade chain. Steps are applied in sequence until the document
 * reaches CURRENT_SCHEMA_VERSION, so a v1 document opened by a v12 release walks
 * v1 -> v2 -> ... -> v12 rather than needing a direct v1 -> v12 converter.
 *
 * `migrate` MUST set `schemaVersion` to `to` on its output; the runner verifies
 * this and refuses to loop otherwise.
 */
export interface TemplateMigration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (input: Record<string, unknown>) => Record<string, unknown>;
}

export const TEMPLATE_MIGRATIONS: readonly TemplateMigration[] = [
  {
    from: 1,
    to: 2,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point.
     *
     * A v1 document is STRUCTURALLY a v2 document: ADR 0003 only WIDENED unions, so there is
     * nothing to transform. What the stamp buys is at the other end. Measured, on a document
     * carrying a C1 kind opened by an earlier build:
     *
     * - version 1 kept: a `ZodError` -- `"note": "No matching discriminator"`, `"message":
     *   "Invalid input"`, on a path like `root.children.0.content.1.value.kind`. Not an
     *   `OpenviewError`, not a `TemplateMigrationError`, no mention of a version, and no
     *   remedy for whoever reads it.
     * - version 2: `TemplateMigrationError: Template uses schema version 2 but this build
     *   understands at most 1. It was written by a newer release of Openview; upgrade before
     *   opening it.`
     *
     * That second message is produced by code that was ALREADY in the repository -- the guard
     * in `migrateToCurrent` -- so no coordination was required. It is exactly the message lot
     * C8 is being built to produce, and C1 is the lot C8 depends on.
     *
     * A migration that only stamps is therefore not a phantom migration. Two further beliefs
     * fell to measurement: that such an increment would pass the four gates in silence (it
     * does not -- `migrate.test.ts` reddens, in both cases, so the versioning was already
     * tooled), and that C1 was purely additive (it is not: three value bounds narrow it).
     *
     * ## What this does NOT catch, and the example used to say the opposite of the rule
     *
     * The version guard reads the STAMP, not the content -- that proposition is right, and
     * the migration really does stamp without validating. What an earlier version of this
     * paragraph got wrong is the consequence it drew: it claimed a document stamped `1` but
     * carrying a C1 kind was still refused with `Invalid input` by a build that knows the
     * kind. Measured, that document parses cleanly and comes out AT THE CURRENT STAMP --
     * whatever that is on the build reading this, since the chain walks it all the way up.
     *
     * The reason is in the pipeline: `parseTemplate` bounds the shape, MIGRATES, then
     * validates against the CURRENT schema -- never against the schema of the stamp it read.
     * So an UNDER-stamped document is not refused, it is silently accepted. The guard
     * protects against a document written by a NEWER build and against nothing in the other
     * direction; it never was a guard on content.
     *
     * And the three narrowings of ADR 0003 decision 2 are NOT retrofitted here: truncating a
     * 591-character path or flattening a 101-level tree would corrupt the document. They rest
     * on the pre-v1.0 assumption, which is the one place in this lot where that argument is
     * the right one.
     */
    migrate: (input) => ({ ...input, schemaVersion: 2 }),
  },
  {
    from: 2,
    to: 3,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point, for the second
     * time and for exactly the reason the 1 -> 2 entry states.
     *
     * A v2 document is STRUCTURALLY a v3 document: lot C2 only WIDENED a union, so there is
     * nothing to transform, and the shape it yields is bounded because it changes neither
     * depth nor value count -- which is what the repository owes itself since the guard runs
     * twice.
     *
     * The reserve transposes word for word, INCLUDING the correction the entry above
     * carries: a document stamped `2` but already holding a `round` node -- hand-made, or
     * written by an unstamped mid-lot build -- is not refused. It parses, and comes out
     * `schemaVersion: 3`. The stamp only ever guards upward.
     *
     * And the `decimals` window is NOT retrofitted here, because there is nothing to
     * retrofit: no v2 document can carry a `decimals` field at all. That is the whole
     * difference between adding a kind and tightening an existing one -- the narrowings of
     * ADR 0003 decision 2 rested on the pre-v1.0 assumption, this one does not have to.
     */
    migrate: (input) => ({ ...input, schemaVersion: 3 }),
  },
  {
    from: 3,
    to: 4,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point, for the third
     * time and for exactly the reason the 1 -> 2 entry states.
     *
     * A v3 document is STRUCTURALLY a v4 document: lot C3 only WIDENED the node union, so
     * there is nothing to transform, and the shape it yields is bounded because it changes
     * neither depth nor value count -- which is what the repository owes itself since the
     * guard runs twice.
     *
     * The narrowing that comes with it -- a block flow no longer accepting a bare row --
     * cannot bite an existing document either, since no v3 document can carry a row at all.
     * Nor is the column width window retrofitted, for the same reason the `decimals` window
     * was not: there is nothing to retrofit. That is the whole difference between adding a
     * shape and tightening an existing one, and it is why lot C3 adds no fifth value
     * narrowing to the four the pre-v1.0 assumption already carries.
     *
     * The reserve of the two entries above transposes word for word: the version guard reads
     * the STAMP, not the content. A document stamped `3` but already holding a `table` node
     * -- hand-made, or written by an unstamped mid-lot build -- is not refused. It parses,
     * and comes out `schemaVersion: 4`.
     */
    migrate: (input) => ({ ...input, schemaVersion: 4 }),
  },
  {
    from: 4,
    to: 5,
    /**
     * The first TRANSFORMING migration of this repository, and the reason `parseTemplate`
     * guards the shape twice.
     *
     * `Template.page` is required, so a v4 document carries nothing that satisfies it.
     * Stamping alone would refuse every v4 document with `Invalid input: expected object,
     * received undefined` on the path `page` -- a fifth narrowing on the pre-v1.0
     * assumption, and the first one that is not vacuous: the four existing ones refuse
     * values no document could hold, this one would refuse EVERY document.
     *
     * So it writes a compatibility page. Openview therefore CHOOSES a sheet, once, for
     * documents written before the question existed, and that has to be said in those
     * terms:
     *
     * - it is NOT an environment read -- A4 is a constant of this file, not the machine's
     *   locale, and the difference is exactly what makes it deterministic. The other half
     *   has to be conceded too: A4 is the format of PART of the world, so writing it here
     *   is a locale disguised as a constant, and no tool will ever see that. It is a
     *   product decision, taken by the product owner on 2026-08-18, not a deduction;
     * - it is NOT a schema default -- a `z.default()` would rewrite the document at every
     *   parse, in silence, forever; this writes it once, on a document stamped 4, and the
     *   result is visible in what gets saved;
     * - it is NOT a de-facto default for new templates -- no template written after this
     *   lot goes through this migration, because the field is required and its author
     *   fills it in. What WILL be copied is the page of the delivered template of designer
     *   lot D9, and that choice belongs to that lot.
     *
     * The explicit test is not defensive noise, and it is not replaceable by a spread
     * order. A hand-made document stamped 4 may already carry a page -- the stamp only ever
     * guards upward, see the 1 -> 2 entry -- and MEASURED, the two spellings do opposite
     * things: `{ ...input, page: DEFAULT }` OVERWRITES the author's page, while
     * `{ page: DEFAULT, ...input }` preserves it. The second one happens to be right, which
     * is worse than being wrong: it is correct BY KEY ORDER, so the next reader who reorders
     * the object for tidiness silently destroys layouts. The explicit test says what it
     * means, and a test pins it.
     *
     * It tests the VALUE and not the KEY, and that correction matters. Written
     * `'page' in input`, a record carrying `page: null` -- a nullable column serialised
     * straight out -- or `page: undefined` -- `{ ...template, page: undefined }` from an
     * editor clearing the field, or a deserialiser that materialises optional keys -- took
     * the "the author already has a page" branch and passed the empty value straight
     * through. MEASURED, the parse then answered a bare `ZodError`, "Invalid input: expected
     * object, received null" on path `page`: the untyped refusal these entry points exist to
     * remove, on exactly the documents this migration exists to rescue. A key with no usable
     * value is a document with no page, so it gets the compatibility one.
     *
     * Measured: a v4 document of 7 JSON levels and 16 values comes out at 7 levels and 27
     * values. The page adds eleven values and NO level, because `page.margins` is exactly as
     * deep as `root.children`. So the rule this repository owes itself -- a migration never
     * yields an out-of-bounds shape -- holds for this entry, and the SECOND pass of the
     * guard in `parseTemplate` verifies it at runtime rather than on trust. This is the lot
     * where that second pass finally earns its place.
     */
    migrate: (input) => ({
      ...input,
      page: input.page ?? compatibilityPage(),
      schemaVersion: 5,
    }),
  },
  {
    from: 5,
    to: 6,
    /**
     * Identity, except for the stamp -- and the stamp is the entire point, for the fourth time
     * and for exactly the reason the 1 -> 2 entry states.
     *
     * A v5 document is STRUCTURALLY a v6 document: lot C5 adds nine OPTIONAL fields and widens
     * no union, so there is nothing to transform, and the shape it yields is bounded because it
     * changes neither depth nor value count -- MEASURED, delta exactly 0 on `RECIPE_TEMPLATE`.
     *
     * ## Why this one is a stamp and NOT a transformation, which was a real question
     *
     * Writing a baseline typography into every existing document is the alternative, and it is
     * refused on two counts. It would oblige this file to TRAVERSE THE AST -- it has no traversal
     * today, and the traversal would be the first code here that knows the shape of a node -- and
     * MEASURED, it costs +324 values (+59.1 %) on the playground model against +8 for a single
     * document-level baseline. And a baseline needs a PRODUCT MANDATE: the compatibility page of
     * the entry above is "une décision produit, prise par le propriétaire du produit le
     * 2026-08-18, not a deduction", and a compatibility FONT is a notch worse than A4. A4 is
     * wrong for part of the world but it EXISTS everywhere; a family name designates a resource
     * that may not exist on the rendering machine, and resolving it is reading the machine --
     * refused and tooled.
     *
     * So no document written before this lot carries any appearance, and that is the honest
     * outcome: the five typographic values of a run that declares none are decided by the
     * engine, and ADR 0007 names them as a debt with their owners rather than letting each
     * renderer invent them in silence.
     *
     * The reserve of the four entries above transposes word for word: the version guard reads
     * the STAMP, not the content. A document stamped `5` but already carrying a `box` --
     * hand-made, or written by an unstamped mid-lot build -- is not refused. It parses, and comes
     * out `schemaVersion: 6`, keeping its box, because the current schema knows the field.
     */
    migrate: (input) => ({ ...input, schemaVersion: 6 }),
  },
];

const recordSchema = z.record(z.string(), z.unknown());
const versionedSchema = z.object({ schemaVersion: z.number().int().nonnegative() });

function readSchemaVersion(candidate: unknown, context: string): number {
  const parsed = versionedSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new TemplateMigrationError(
      `${context}: expected a numeric "schemaVersion" field. A stored template without one cannot be migrated safely.`,
      Number.NaN,
      { cause: parsed.error },
    );
  }
  return parsed.data.schemaVersion;
}

/** What the chain produced, and whether it produced it by running anything. */
interface MigrationRun {
  readonly current: Record<string, unknown>;
  readonly applied: number;
}

/**
 * Walks a stored document up to the current schema version. Returns the raw
 * object: validation is {@link parseTemplate}'s job, because a mid-chain document
 * is not expected to satisfy the current schema.
 */
export function migrateToCurrent(
  raw: unknown,
  migrations: readonly TemplateMigration[] = TEMPLATE_MIGRATIONS,
): Record<string, unknown> {
  return runMigrations(raw, migrations).current;
}

function runMigrations(raw: unknown, migrations: readonly TemplateMigration[]): MigrationRun {
  const asRecord = recordSchema.safeParse(raw);
  if (!asRecord.success) {
    throw new TemplateMigrationError(
      'Expected a template object, received a non-object value.',
      Number.NaN,
      { cause: asRecord.error },
    );
  }

  let current: Record<string, unknown> = asRecord.data;
  let applied = 0;
  let version = readSchemaVersion(current, 'Stored template');

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new TemplateMigrationError(
      `Template uses schema version ${version} but this build understands at most ${CURRENT_SCHEMA_VERSION}. It was written by a newer release of Openview; upgrade before opening it.`,
      version,
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations.find((candidate) => candidate.from === version);
    if (step === undefined) {
      throw new TemplateMigrationError(
        `No migration registered from schema version ${version}. The upgrade chain to ${CURRENT_SCHEMA_VERSION} is broken.`,
        version,
      );
    }

    current = step.migrate(current);
    applied += 1;
    const next = readSchemaVersion(current, `Migration ${step.from} -> ${step.to}`);
    if (next <= version) {
      // Without this the loop would spin forever on a migration that forgets to
      // stamp its own version -- the easiest mistake to make when writing one.
      throw new TemplateMigrationError(
        `Migration ${step.from} -> ${step.to} left schemaVersion at ${next}; it must advance past ${version}.`,
        version,
      );
    }
    version = next;
  }

  return { current, applied };
}

/**
 * The entry point every consumer should use: bound the shape, migrate, then validate.
 * Never trust a stored document straight from disk (AGENTS.md 1.2).
 *
 * ## Why the guard runs twice
 *
 * The first call protects `migrateToCurrent` **and** Zod, for as long as the chain is
 * empty or identity-only. But a future migration TRANSFORMS -- wrapping a node, splitting
 * a field -- so it can PRODUCE an out-of-bounds shape from a conforming input, and it
 * would be Zod that met the over-deep tree, with the bare `RangeError` this whole guard
 * exists to prevent. Hence: guard the raw input, then guard the chain's output whenever at
 * least one step ran.
 *
 * The cost is nil in the common case -- a document already stamped at the current version
 * migrates through nothing, so it is scanned once -- and the counterpart is a rule this
 * repository now owes itself: **a migration never yields an out-of-bounds shape.**
 */
export function parseTemplate(
  raw: unknown,
  migrations: readonly TemplateMigration[] = TEMPLATE_MIGRATIONS,
  limits?: Partial<ShapeLimits>,
): Template {
  assertBoundedShape(raw, limits);
  const { current, applied } = runMigrations(raw, migrations);
  if (applied > 0) {
    assertBoundedShape(current, limits);
  }
  return TemplateSchema.parse(current);
}

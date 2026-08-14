import { z } from 'zod/v4';
import { TemplateMigrationError } from '../errors.js';
import { assertBoundedShape, type ShapeLimits } from './guard.js';
import { CURRENT_SCHEMA_VERSION, type Template, TemplateSchema } from './template.js';

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
     * ## What this does NOT catch, and it belongs to C8
     *
     * The version guard reads the STAMP, not the content. A document stamped `1` but carrying
     * a C1 kind -- hand-made, or written by a third-party tool -- still falls back to `Invalid
     * input`, even from a v2 build. The migration stamps; it does not validate.
     *
     * And the three narrowings of ADR 0003 decision 2 are NOT retrofitted here: truncating a
     * 591-character path or flattening a 101-level tree would corrupt the document. They rest
     * on the pre-v1.0 assumption, which is the one place in this lot where that argument is
     * the right one.
     */
    migrate: (input) => ({ ...input, schemaVersion: 2 }),
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

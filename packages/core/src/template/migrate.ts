import { z } from 'zod/v4';
import { TemplateMigrationError } from '../errors.js';
import type { PageSetup } from '../page/page.js';
import { assertBoundedShape, type ShapeLimits } from './guard.js';
import { CURRENT_SCHEMA_VERSION, type Template, TemplateSchema } from './template.js';

function compatibilityPage(): PageSetup {
  return {
    sheet: { width: 210, height: 297 },
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    header: [],
    footer: [],
  };
}

/**
 * Migration step in the sequential version upgrade chain.
 */
export interface TemplateMigration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (input: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Ordered sequence of template migrations from v1 to current schema version.
 */
export const TEMPLATE_MIGRATIONS: readonly TemplateMigration[] = [
  {
    from: 1,
    to: 2,
    migrate: (input) => ({ ...input, schemaVersion: 2 }),
  },
  {
    from: 2,
    to: 3,
    migrate: (input) => ({ ...input, schemaVersion: 3 }),
  },
  {
    from: 3,
    to: 4,
    migrate: (input) => ({ ...input, schemaVersion: 4 }),
  },
  {
    from: 4,
    to: 5,
    migrate: (input) => ({
      ...input,
      page: input.page ?? compatibilityPage(),
      schemaVersion: 5,
    }),
  },
  {
    from: 5,
    to: 6,
    migrate: (input) => ({ ...input, schemaVersion: 6 }),
  },
  {
    from: 6,
    to: 7,
    /**
     * Identity, except for the stamp -- and the stamp is the whole point: it is what turns a silent
     * loss of the new table into a legible refusal.
     *
     * A compatibility writing is refused rather than written, and on a stronger ground than the
     * compatibility sheet of the 4 -> 5 entry: A4 is wrong for part of the world but exists
     * everywhere, whereas a writing would have to name a language and a money, and there is no
     * currency that exists everywhere. So no pre-existing document declares any writing, which is
     * what it already declared.
     *
     * The version guard reads the stamp and not the content, so a document stamped 6 that already
     * carries a table parses and comes out stamped 7 with its table intact.
     */
    migrate: (input) => ({ ...input, schemaVersion: 7 }),
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

interface MigrationRun {
  readonly current: Record<string, unknown>;
  readonly applied: number;
}

/**
 * Migrates a raw template object up to the current schema version without schema parsing.
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
 * Primary entry point: asserts bounded shape, migrates to current schema version, and validates.
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

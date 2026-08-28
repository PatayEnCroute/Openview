import { z } from 'zod/v4';
import {
  markAsProgrammingFault,
  TemplateMigrationError,
  type TemplateMigrationErrorCode,
} from '../errors.js';
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
 *
 * Both bounds are executed, not decorative: a selected step runs only on a document stamped
 * `from`, and its output must carry exactly `to`. An injected chain may declare any destination,
 * including a direct one, provided it announces the version it really produces.
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
    /** Stamping migration from schema version 6 to 7. */
    migrate: (input) => ({ ...input, schemaVersion: 7 }),
  },
  {
    from: 7,
    to: 8,
    // Stamp only. A v7 document declares no fragmentation policy, which is what it already said.
    migrate: (input) => ({ ...input, schemaVersion: 8 }),
  },
  {
    from: 8,
    to: 9,
    /**
     * Stamp only. A v8 document contributes to no page report and names no report marker, which is
     * what it already said; there is no accounting value a migration could invent for it.
     *
     * The stamp is the whole work here: without it, a v9 document opened by a v8 build loses its
     * contributions in silence, or is refused on an unknown discriminator with no version named.
     */
    migrate: (input) => ({ ...input, schemaVersion: 9 }),
  },
  {
    from: 9,
    to: 10,
    /**
     * Stamp only. A v9 document declared exactly "no grid and no page layer", which is what it
     * already said; adding empty structures would invent a second canonical spelling of absence.
     */
    migrate: (input) => ({ ...input, schemaVersion: 10 }),
  },
  {
    from: 10,
    to: 11,
    /**
     * Stamp only. A v10 site asks for no writing, which is exactly the canonical form it already
     * printed; inventing a profile would name a writing its author never chose.
     *
     * The stamp is the whole work: the three `format` fields are optional, so a v10 build opening a
     * v11 document would drop them in silence and an `onSave` would persist the loss.
     */
    migrate: (input) => ({ ...input, schemaVersion: 11 }),
  },
];

const recordSchema = z.record(z.string(), z.unknown());
const versionedSchema = z.object({ schemaVersion: z.number().int().nonnegative() });

function readSchemaVersion(
  candidate: unknown,
  context: string,
  code: TemplateMigrationErrorCode,
): number {
  const parsed = versionedSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new TemplateMigrationError(
      `${context}: expected a numeric "schemaVersion" field. A stored template without one cannot be migrated safely.`,
      Number.NaN,
      { cause: parsed.error, code },
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
      { cause: asRecord.error, code: 'invalid-template' },
    );
  }

  let current: Record<string, unknown> = asRecord.data;
  let applied = 0;
  let version = readSchemaVersion(current, 'Stored template', 'missing-schema-version');

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new TemplateMigrationError(
      `Template uses schema version ${version} but this build understands at most ${CURRENT_SCHEMA_VERSION}. It was written by a newer release of Openview; upgrade before opening it.`,
      version,
      { code: 'newer-schema-version' },
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations.find((candidate) => candidate.from === version);
    if (step === undefined) {
      throw new TemplateMigrationError(
        `No migration registered from schema version ${version}. The upgrade chain to ${CURRENT_SCHEMA_VERSION} is broken.`,
        version,
        { code: 'missing-migration' },
      );
    }

    try {
      current = step.migrate(current);
    } catch (error) {
      markAsProgrammingFault(error);
      throw error;
    }
    applied += 1;
    const next = readSchemaVersion(
      current,
      `Migration ${step.from} -> ${step.to}`,
      'invalid-migration-result',
    );
    if (next !== step.to) {
      throw new TemplateMigrationError(
        `Migration ${step.from} -> ${step.to} produced schemaVersion ${next}; a step must produce exactly the version it declares.`,
        version,
        { code: 'invalid-migration-result' },
      );
    }
    if (next <= version) {
      throw new TemplateMigrationError(
        `Migration ${step.from} -> ${step.to} left schemaVersion at ${next}; it must advance past ${version}.`,
        version,
        { code: 'invalid-migration-result' },
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

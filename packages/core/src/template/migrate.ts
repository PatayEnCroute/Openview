import { z } from 'zod/v4';
import { TemplateMigrationError } from '../errors.js';
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

/**
 * Empty by design: schema version 1 is the first published shape, so nothing
 * predates it. The mechanism is built now rather than later because retrofitting
 * migrations after users have saved documents is not possible.
 */
export const TEMPLATE_MIGRATIONS: readonly TemplateMigration[] = [];

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

/**
 * Walks a stored document up to the current schema version. Returns the raw
 * object: validation is {@link parseTemplate}'s job, because a mid-chain document
 * is not expected to satisfy the current schema.
 */
export function migrateToCurrent(
  raw: unknown,
  migrations: readonly TemplateMigration[] = TEMPLATE_MIGRATIONS,
): Record<string, unknown> {
  const asRecord = recordSchema.safeParse(raw);
  if (!asRecord.success) {
    throw new TemplateMigrationError(
      'Expected a template object, received a non-object value.',
      Number.NaN,
      { cause: asRecord.error },
    );
  }

  let current: Record<string, unknown> = asRecord.data;
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

  return current;
}

/**
 * The entry point every consumer should use: migrate, then validate. Never trust
 * a stored document straight from disk (AGENTS.md 1.2).
 */
export function parseTemplate(
  raw: unknown,
  migrations: readonly TemplateMigration[] = TEMPLATE_MIGRATIONS,
): Template {
  return TemplateSchema.parse(migrateToCurrent(raw, migrations));
}

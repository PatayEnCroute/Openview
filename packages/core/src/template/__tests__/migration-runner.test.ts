import { describe, expect, it } from 'vitest';
import { TemplateMigrationError } from '../../errors.js';
import { migrateToCurrent, TEMPLATE_MIGRATIONS, type TemplateMigration } from '../migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../template.js';
import { validTemplate } from './compatibility-fixtures.js';

describe('migrateToCurrent', () => {
  it('walks a document up the chain one step at a time', () => {
    // The synthetic step is COMPOSED WITH THE REAL REGISTRY, and that composition is the point:
    // the synthetic chain alone stops at version 1 and the run refuses a broken chain.
    const chain: readonly TemplateMigration[] = [
      {
        from: 0,
        to: 1,
        migrate: (input) => ({ ...input, schemaVersion: 1, name: `${String(input.name)} (v1)` }),
      },
      ...TEMPLATE_MIGRATIONS,
    ];

    const migrated = migrateToCurrent({ ...validTemplate, schemaVersion: 0 }, chain);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.name).toBe('Invoice (v1)');
  });

  it('walks a v1 document up to the current stamp and changes nothing else', () => {
    const stored = { ...validTemplate, schemaVersion: 1 };

    const migrated = migrateToCurrent(stored);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // Pinned by exclusion: the stamp is the ONLY difference.
    const { schemaVersion: _stamped, ...restOfMigrated } = migrated;
    const { schemaVersion: _stored, ...restOfStored } = stored;
    expect(restOfMigrated).toStrictEqual(restOfStored);
  });

  it('leaves an up-to-date document untouched', () => {
    expect(migrateToCurrent(validTemplate)).toStrictEqual(validTemplate);
  });

  it('stamps a hand-made v9 already carrying a grid and layers without touching either', () => {
    // The version guard reads the stamp, never the content: a document stamped 9 that already
    // carries the version 10 capabilities comes out stamped current with both intact.
    const early = {
      ...validTemplate,
      schemaVersion: 9,
      page: {
        ...validTemplate.page,
        layers: [
          { plane: 'background', content: { type: 'container', id: 'paper', children: [] } },
        ],
      },
      root: {
        type: 'container',
        id: 'root',
        children: [{ type: 'grid', id: 'g', columns: 2, rows: 2, step: 5, items: [] }],
      },
    };

    const migrated = migrateToCurrent(early);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const { schemaVersion: _stamped, ...restOfMigrated } = migrated;
    const { schemaVersion: _stored, ...restOfStored } = early;
    expect(restOfMigrated).toStrictEqual(restOfStored);
  });

  it('refuses a document written by a newer release', () => {
    expect(() =>
      migrateToCurrent({ ...validTemplate, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    ).toThrow(TemplateMigrationError);
  });

  it('refuses when no migration covers the stored version', () => {
    expect(() => migrateToCurrent({ ...validTemplate, schemaVersion: 0 }, [])).toThrow(
      /No migration registered from schema version 0/,
    );
  });

  it('refuses a migration that forgets to stamp its own version', () => {
    // Left unguarded this spins forever, and it is the easiest mistake to make when writing a
    // migration.
    const forgetful: readonly TemplateMigration[] = [
      { from: 0, to: 1, migrate: (input) => ({ ...input }) },
    ];

    expect(() => migrateToCurrent({ ...validTemplate, schemaVersion: 0 }, forgetful)).toThrow(
      /produced schemaVersion 0/,
    );
  });

  it('refuses a migration whose output lost its schemaVersion entirely', () => {
    const destructive: readonly TemplateMigration[] = [
      { from: 0, to: 1, migrate: () => ({ id: 'orphan' }) },
    ];

    expect(() => migrateToCurrent({ ...validTemplate, schemaVersion: 0 }, destructive)).toThrow(
      /Migration 0 -> 1/,
    );
  });

  it('refuses a document with no schemaVersion', () => {
    const { schemaVersion: _dropped, ...unversioned } = validTemplate;
    expect(() => migrateToCurrent(unversioned)).toThrow(/numeric "schemaVersion" field/);
  });

  it('refuses a non-object payload', () => {
    expect(() => migrateToCurrent('not a template')).toThrow(/non-object value/);
  });

  it('carries the offending version on the error for callers to branch on', () => {
    try {
      migrateToCurrent({ ...validTemplate, schemaVersion: 99 });
      expect.unreachable('migrateToCurrent should have thrown');
    } catch (error) {
      // `instanceof` narrowing rather than a cast: the rule this repository enforces applies to
      // its own tests too.
      expect(error).toBeInstanceOf(TemplateMigrationError);
      if (error instanceof TemplateMigrationError) {
        expect(error.fromVersion).toBe(99);
      }
    }
  });
});

describe('the version a step declares it produces', () => {
  const DECLARED_FROM = 1;
  const DECLARED_TO = 5;

  /** An injected DIRECT converter: the runner never imposes a unit step on a supplied chain. */
  function producing(version: unknown): readonly TemplateMigration[] {
    return [
      {
        from: DECLARED_FROM,
        to: DECLARED_TO,
        migrate: (input) => ({ ...input, schemaVersion: version }),
      },
    ];
  }

  const stored = { ...validTemplate, schemaVersion: DECLARED_FROM };

  it('accepts an injected converter that jumps straight to the version it announces', () => {
    // The tightening is on truthfulness, not on step size: a chain may cross several versions at
    // once as long as it says where it lands.
    const chain: readonly TemplateMigration[] = [
      ...producing(DECLARED_TO),
      ...TEMPLATE_MIGRATIONS.filter((step) => step.from >= DECLARED_TO),
    ];

    expect(migrateToCurrent(stored, chain).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it.each([
    ['stays at its own start version', DECLARED_FROM],
    ['goes backwards', DECLARED_FROM - 1],
    ['stops short of what it declares', DECLARED_TO - 1],
    ['overshoots what it declares', DECLARED_TO + 1],
  ])('refuses a step whose output %s', (_label, produced) => {
    // Without this, `to` is decorative in the generic part of the API: a step announcing 1 -> 5
    // could land anywhere above its start and the runner would carry on.
    try {
      migrateToCurrent(stored, producing(produced));
      expect.unreachable('migrateToCurrent should have refused a step that missed its own target');
    } catch (error) {
      expect(error).toBeInstanceOf(TemplateMigrationError);
      if (error instanceof TemplateMigrationError) {
        expect(error.code).toBe('invalid-migration-result');
        // Names the declared step and the version actually produced, and nothing of the model:
        // the diagnostic facade narrates this, and a stored value must never reach a message.
        expect(error.message).toContain(`Migration ${DECLARED_FROM} -> ${DECLARED_TO}`);
        expect(error.message).toContain(`produced schemaVersion ${produced}`);
        expect(error.message).not.toContain(validTemplate.id);
        expect(error.message).not.toContain(validTemplate.name);
        // The start version of the FAULTY step, so a caller can say which link broke.
        expect(error.fromVersion).toBe(DECLARED_FROM);
      }
    }
  });

  it('refuses a step that declares no progress at all', () => {
    // A step honestly announcing `to` equal to `from` would satisfy the rule above and then be
    // selected again on the next turn of the loop. What guarantees termination is that the run
    // also requires the version to advance.
    const standingStill: readonly TemplateMigration[] = [
      { from: DECLARED_FROM, to: DECLARED_FROM, migrate: (input) => ({ ...input }) },
    ];

    expect(() => migrateToCurrent(stored, standingStill)).toThrow(
      new RegExp(`must advance past ${DECLARED_FROM}`),
    );
  });

  it('lets an arbitrary throw from a supplied step travel out untouched', () => {
    // An injected function is trusted code. A programming fault in it is not a refusal an author
    // could act on, so it crosses the runner with its own type and its own stack.
    const boom = new RangeError('a migration crashed');
    const exploding: readonly TemplateMigration[] = [
      {
        from: DECLARED_FROM,
        to: DECLARED_TO,
        migrate: () => {
          throw boom;
        },
      },
    ];

    expect(() => migrateToCurrent(stored, exploding)).toThrow(boom);
  });
});

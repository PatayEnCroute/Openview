import { describe, expect, it } from 'vitest';
import { TemplateMigrationError, TemplateShapeError } from '../errors.js';
import { DEFAULT_SHAPE_LIMITS } from './guard.js';
import { migrateToCurrent, parseTemplate, type TemplateMigration } from './migrate.js';
import { CURRENT_SCHEMA_VERSION } from './template.js';

const validTemplate = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'tpl_123',
  name: 'Invoice',
  version: '1.0.0',
  root: { type: 'container', id: 'root', children: [] },
};

describe('parseTemplate', () => {
  it('accepts a template already at the current schema version', () => {
    const parsed = parseTemplate(validTemplate);
    expect(parsed.id).toBe('tpl_123');
    expect(parsed.root.type).toBe('container');
  });

  it('defaults the author-facing version when it is omitted', () => {
    const { version: _omitted, ...withoutVersion } = validTemplate;
    expect(parseTemplate(withoutVersion).version).toBe('1.0.0');
  });

  it('rejects a template whose root is not a container', () => {
    expect(() =>
      // Valid as a text node, so the only reason this is rejected is that a root
      // must be a container.
      parseTemplate({ ...validTemplate, root: { type: 'text', id: 'r', content: [] } }),
    ).toThrow();
  });

  it('rejects an empty template id', () => {
    expect(() => parseTemplate({ ...validTemplate, id: '' })).toThrow();
  });

  it('bounds the raw input before anything reads it', () => {
    let deep: unknown = 'leaf';
    for (let level = 0; level < DEFAULT_SHAPE_LIMITS.maxDepth + 5; level += 1) {
      deep = { child: deep };
    }

    // Without the guard the first failure is a RangeError from Zod at ~1 874 levels,
    // crossing parseTemplate unwrapped: not an OpenviewError, no mention of a version, no
    // remedy. "Maximum call stack size exceeded" is not a message a gestionnaire corrects.
    expect(() => parseTemplate({ ...validTemplate, root: deep })).toThrow(TemplateShapeError);
  });

  it('bounds the CHAIN OUTPUT when a migration ran, not just the input', () => {
    // A migration transforms -- wrapping a node, splitting a field -- so it can PRODUCE an
    // out-of-bounds shape from a conforming input, and then it is Zod that meets the
    // over-deep tree. The guard therefore runs again whenever at least one step applied,
    // and the counterpart is a rule this repository owes itself: a migration never yields
    // an out-of-bounds shape.
    const deepening: readonly TemplateMigration[] = [
      {
        from: 0,
        to: CURRENT_SCHEMA_VERSION,
        migrate: (input) => {
          let deep: unknown = input.root;
          for (let level = 0; level < DEFAULT_SHAPE_LIMITS.maxDepth + 5; level += 1) {
            deep = { child: deep };
          }
          return { ...input, schemaVersion: CURRENT_SCHEMA_VERSION, root: deep };
        },
      },
    ];

    expect(() => parseTemplate({ ...validTemplate, schemaVersion: 0 }, deepening)).toThrow(
      TemplateShapeError,
    );
  });

  it('scans only once when nothing migrated', () => {
    // The cost of the second pass is nil in the common case: a document already stamped at
    // the current version migrates through nothing. Proven by the accessor refusal, which
    // fires on the first pass -- the second would never be reached.
    const alive = { ...validTemplate };
    Object.defineProperty(alive, 'name', { get: () => 'Invoice', enumerable: true });

    expect(() => parseTemplate(alive)).toThrow(TemplateShapeError);
  });

  it('honours injected shape limits', () => {
    expect(() => parseTemplate(validTemplate, undefined, { maxDepth: 2 })).toThrow(
      TemplateShapeError,
    );
  });
});

describe('migrateToCurrent', () => {
  it('walks a document up the chain one step at a time', () => {
    // Synthetic chain: the real registry is empty because v1 is the first
    // published shape. The mechanism still has to be proven before anyone
    // depends on it.
    const chain: readonly TemplateMigration[] = [
      {
        from: 0,
        to: 1,
        migrate: (input) => ({ ...input, schemaVersion: 1, name: `${String(input.name)} (v1)` }),
      },
    ];

    const migrated = migrateToCurrent({ ...validTemplate, schemaVersion: 0 }, chain);

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.name).toBe('Invoice (v1)');
  });

  it('leaves an up-to-date document untouched', () => {
    expect(migrateToCurrent(validTemplate)).toStrictEqual(validTemplate);
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
    // Left unguarded this spins forever, and it is the easiest mistake to make
    // when writing a migration.
    const forgetful: readonly TemplateMigration[] = [
      { from: 0, to: 1, migrate: (input) => ({ ...input }) },
    ];

    expect(() => migrateToCurrent({ ...validTemplate, schemaVersion: 0 }, forgetful)).toThrow(
      /must advance past 0/,
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
      // `instanceof` narrowing rather than a cast: the rule this repo enforces
      // applies to its own tests too.
      expect(error).toBeInstanceOf(TemplateMigrationError);
      if (error instanceof TemplateMigrationError) {
        expect(error.fromVersion).toBe(99);
      }
    }
  });
});

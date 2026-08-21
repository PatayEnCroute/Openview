import { describe, expect, it } from 'vitest';
import { TemplateMigrationError, TemplateShapeError } from '../../errors.js';
import { assertBoundedShape, DEFAULT_SHAPE_LIMITS } from '../guard.js';
import { parseTemplate, type TemplateMigration } from '../migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../template.js';
import { validTemplate } from './compatibility-fixtures.js';

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
      // Valid as a text node, so the only reason this is rejected is that a root must be a
      // container.
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

    // Without the guard the first failure is a RangeError from Zod, crossing parseTemplate
    // unwrapped: not an OpenviewError, no version named, no remedy.
    expect(() => parseTemplate({ ...validTemplate, root: deep })).toThrow(TemplateShapeError);
  });

  it('bounds the CHAIN OUTPUT when a migration ran, not just the input', () => {
    // A migration transforms, so it can PRODUCE an out-of-bounds shape from a conforming input,
    // and then it is Zod that meets the over-deep tree. The guard therefore runs again whenever
    // at least one step applied.
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
    // A document already at the current stamp migrates through nothing, so the second pass costs
    // nothing. Proven by the accessor refusal, which fires on the first pass.
    const alive = { ...validTemplate };
    Object.defineProperty(alive, 'name', { get: () => 'Invoice', enumerable: true });

    expect(() => parseTemplate(alive)).toThrow(TemplateShapeError);
  });

  it('honours injected shape limits', () => {
    expect(() => parseTemplate(validTemplate, undefined, { maxDepth: 2 })).toThrow(
      TemplateShapeError,
    );
  });

  it('keeps the migrated shape BOUNDED, which is why the guard runs twice', () => {
    // The 4 -> 5 step is the transforming one, so it is where the second pass earns its place:
    // the page it writes adds values without adding a level, which is the rule a migration owes
    // this repository.
    const { page: _none, ...pageless } = {
      ...validTemplate,
      schemaVersion: 4,
      root: {
        type: 'container',
        id: 'root',
        children: [{ type: 'text', id: 't', content: [{ kind: 'literal', text: 'a' }] }],
      },
    };

    expect(() => parseTemplate(pageless)).not.toThrow();

    // The counter-proof that the SECOND pass is the one that fires: under this ceiling the input
    // passes the guard outright and only the migrated output is refused.
    expect(() => assertBoundedShape(pageless, { maxNodes: 20 })).not.toThrow();
    expect(() => parseTemplate(pageless, undefined, { maxNodes: 20 })).toThrow(TemplateShapeError);
    // No level is added, so a depth ceiling admitting the input admits the output too.
    expect(() => parseTemplate(pageless, undefined, { maxDepth: 7 })).not.toThrow();
  });

  it('ACCEPTS an under-stamped document, because the guard only bites upward', () => {
    // The pipeline bounds the shape, migrates, then validates against the CURRENT schema, never
    // against the schema of the stamp it read. A document stamped 2 that already carries a
    // `round` -- hand-made, or written by an unstamped mid-lot build -- is therefore accepted.
    const understamped = {
      ...validTemplate,
      schemaVersion: 2,
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'text',
            id: 'total',
            content: [
              {
                kind: 'binding',
                value: {
                  kind: 'round',
                  value: { kind: 'path', path: 'payload.total' },
                  decimals: 2,
                  mode: 'halfEven',
                },
              },
            ],
          },
        ],
      },
    };

    expect(parseTemplate(understamped).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('refuses a document whose kind is unknown at the CURRENT stamp', () => {
    // The other half of the pair above: the discriminated union still bites, and that refusal
    // depends on no stamp at all.
    expect(() =>
      parseTemplate({
        ...validTemplate,
        root: {
          type: 'container',
          id: 'root',
          children: [
            {
              type: 'text',
              id: 'total',
              content: [{ kind: 'binding', value: { kind: 'roundTo', value: 1, step: 0.05 } }],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('refuses a document written by a newer release, naming both versions', () => {
    // The message every stamping migration exists to produce. Without the stamp an earlier build
    // answers `Invalid input` on a discriminant path, naming no version and offering no remedy.
    try {
      parseTemplate({ ...validTemplate, schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
      expect.unreachable('parseTemplate should have refused a newer document');
    } catch (error) {
      expect(error).toBeInstanceOf(TemplateMigrationError);
      if (error instanceof TemplateMigrationError) {
        expect(error.message).toContain(`schema version ${CURRENT_SCHEMA_VERSION + 1}`);
        expect(error.message).toContain(`at most ${CURRENT_SCHEMA_VERSION}`);
        expect(error.message).toContain('upgrade before opening it');
        expect(error.fromVersion).toBe(CURRENT_SCHEMA_VERSION + 1);
        // The whole sentence, character for character, because the diagnostic facade narrates it
        // and three `toContain` let a reformulation between the fragments through. Written
        // against the constant: a literal would test nothing on the day it becomes current.
        expect(error.message).toBe(
          `Template uses schema version ${CURRENT_SCHEMA_VERSION + 1} but this build understands at most ${CURRENT_SCHEMA_VERSION}. It was written by a newer release of Openview; upgrade before opening it.`,
        );
      }
    }
  });
});

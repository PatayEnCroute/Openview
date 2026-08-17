import { describe, expect, it } from 'vitest';
import { TemplateMigrationError, TemplateShapeError } from '../errors.js';
import { DEFAULT_SHAPE_LIMITS } from './guard.js';
import {
  migrateToCurrent,
  parseTemplate,
  TEMPLATE_MIGRATIONS,
  type TemplateMigration,
} from './migrate.js';
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

  it('brings a template written before C1 up to the current stamp', () => {
    // The promise of lot C9, made concrete: a model written before this lot still parses --
    // now THROUGH the 1 -> 2 migration, and not "with no migration at all" as an earlier plan
    // for this lot claimed.
    const beforeC1 = {
      schemaVersion: 1,
      id: 'tpl_legacy',
      name: 'Invoice',
      version: '1.0.0',
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'loop',
            id: 'lines',
            each: { kind: 'path', path: 'invoice.lines' },
            as: 'line',
            children: [
              {
                type: 'text',
                id: 'label',
                content: [
                  { kind: 'literal', text: 'Total: ' },
                  { kind: 'binding', value: { kind: 'path', path: 'line.total' } },
                ],
              },
            ],
          },
        ],
      },
    };

    const parsed = parseTemplate(beforeC1);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.root.children).toHaveLength(1);
  });

  it('walks the chain ONE STEP AT A TIME rather than by a direct converter', () => {
    // The assertion that proves `1 -> 2` was not merged into a `1 -> 3` when C2 stamped.
    // A direct converter would still bring the document above to the current stamp, so the
    // test right above cannot tell the difference; only the registry's shape can.
    expect(TEMPLATE_MIGRATIONS.map((step) => [step.from, step.to])).toStrictEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
    expect(TEMPLATE_MIGRATIONS).toHaveLength(CURRENT_SCHEMA_VERSION - 1);
  });

  it('brings a document written before C3 up to the current stamp, table or no table', () => {
    // La moitié du contrat que « purement additif » recouvre : rien de ce qui existait ne
    // devient irrecevable. Ce document ne porte aucun tableau, et il sort estampillé 4.
    const beforeC3 = {
      ...validTemplate,
      schemaVersion: CURRENT_SCHEMA_VERSION - 1,
      root: {
        type: 'container',
        id: 'root',
        children: [{ type: 'text', id: 'titre', content: [{ kind: 'literal', text: 'Facture' }] }],
      },
    };

    expect(parseTemplate(beforeC3).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('parses a C3 table nested where a document really carries one', () => {
    // Le tableau au bout du chemin où un document réel le porte -- dans le flux de blocs de la
    // racine -- et non à la racine, qui reste un conteneur : le changement de type de
    // `ContainerNode.children` suffit à faire entrer un tableau dans un document, sans toucher
    // une ligne du schéma de `Template`.
    const withTable = {
      ...validTemplate,
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'table',
            id: 'lignes',
            columns: [{ id: 'montant', width: 1, align: 'end' }],
            header: [],
            body: [
              {
                type: 'tableRowGroup',
                id: 'corps',
                each: { kind: 'path', path: 'facture.lignes' },
                as: 'ligne',
                rows: [
                  {
                    type: 'tableRow',
                    id: 'detail',
                    cells: [
                      {
                        columnId: 'montant',
                        children: [
                          {
                            type: 'text',
                            id: 'td',
                            content: [
                              { kind: 'binding', value: { kind: 'path', path: 'ligne.montant' } },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            footer: [],
          },
        ],
      },
    };

    expect(parseTemplate(withTable).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('parses a current-stamp document carrying a C1 kind', () => {
    const computed = {
      ...validTemplate,
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
                  kind: 'aggregate',
                  op: 'sum',
                  source: { kind: 'path', path: 'invoice.lines' },
                  as: 'line',
                  value: {
                    kind: 'arithmetic',
                    op: 'mul',
                    left: { kind: 'path', path: 'line.quantity' },
                    right: { kind: 'path', path: 'line.unitPrice' },
                  },
                },
              },
            ],
          },
        ],
      },
    };

    expect(parseTemplate(computed).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('parses a C2 rounding nested where a document really carries one', () => {
    // `aggregate.value` under a `TextBindingSegment.value`: the deepest position the lot
    // widened, and the one that pays for the bump. A build one version behind answers
    // `No matching discriminator` on `root.children.0.content.0.value.kind` -- no version
    // named, no remedy.
    const rounded = {
      ...validTemplate,
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
                  value: {
                    kind: 'aggregate',
                    op: 'sum',
                    source: { kind: 'path', path: 'facture.lignes' },
                    as: 'l',
                    value: {
                      kind: 'round',
                      value: {
                        kind: 'arithmetic',
                        op: 'mul',
                        left: { kind: 'path', path: 'l.q' },
                        right: { kind: 'path', path: 'l.p' },
                      },
                      decimals: 2,
                      mode: 'halfExpand',
                    },
                  },
                  decimals: 2,
                  mode: 'halfExpand',
                },
              },
            ],
          },
        ],
      },
    };

    expect(parseTemplate(rounded).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('ACCEPTS an under-stamped document, because the guard only bites upward', () => {
    // Counter-intuitive enough to need saying: a document stamped `2` that already carries a
    // `round` -- hand-made, or written by an unstamped mid-lot build -- is NOT refused. The
    // pipeline bounds the shape, migrates, then validates against the CURRENT schema, never
    // against the schema of the stamp it read, so the v3 schema recognises the kind and the
    // document goes through.
    //
    // An earlier version of this contract demanded the opposite, on the strength of a
    // sentence that was in the repository and measurably false. What the stamp guards is a
    // document written by a NEWER build (the test below); it guards nothing in this
    // direction, and it never was designed to.
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
                  value: { kind: 'path', path: 'facture.total' },
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
    // The other half of the pair above, and it is what proves the discriminated union still
    // bites: a document stamped at the current version carrying a kind no member covers is
    // refused by Zod. That refusal depends on no stamp at all.
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
    // The message this whole bump exists to produce, and the reason a stamping migration is
    // not a phantom one. Without the bump an earlier build answers `Invalid input` on a
    // discriminant path, with no mention of a version and no remedy.
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
      }
    }
  });
});

describe('migrateToCurrent', () => {
  it('walks a document up the chain one step at a time', () => {
    // The synthetic step is COMPOSED WITH THE REAL REGISTRY, and that composition is not a
    // detail: with the synthetic chain alone this test reddens with `No migration registered
    // from schema version 1. The upgrade chain to 2 is broken.` -- measured, and in both
    // cases, with the real migration and without. That is not collateral damage, it is the
    // proof that the versioning was already tooled; the test does its job, it just has to be
    // given the real chain.
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
    // Pinned by exclusion: the stamp is the ONLY difference. A migration that quietly
    // reshaped a document would be the hardest kind of bug to notice.
    const { schemaVersion: _stamped, ...restOfMigrated } = migrated;
    const { schemaVersion: _stored, ...restOfStored } = stored;
    expect(restOfMigrated).toStrictEqual(restOfStored);
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

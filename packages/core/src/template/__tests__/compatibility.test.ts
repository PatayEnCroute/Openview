import { describe, expect, it } from 'vitest';
import type { ConditionNode, DocumentNode, LoopNode, TextNode } from '../../ast/nodes.js';
import { findNodeById, visitSegment, walk } from '../../ast/visitor.js';
import {
  childScope,
  type EvaluationScope,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
} from '../../expression/evaluate.js';
import * as core from '../../index.js';
import { migrateToCurrent, parseTemplate, TEMPLATE_MIGRATIONS } from '../migrate.js';
import { collectTemplateDataPaths } from '../paths.js';
import { CURRENT_SCHEMA_VERSION } from '../template.js';
import {
  authoredPage,
  COMPATIBILITY_PAGE,
  HISTORICAL_FIXTURES,
  type HistoricalFixture,
  tokensAbsentFromSource,
  V1_DATA,
  V1_DOCUMENT,
  validTemplate,
} from './compatibility-fixtures.js';

/**
 * The oldest stored version this build still opens. Spelt once rather than as a literal in every
 * expectation, so the day it stops being 1 the topology below says so.
 */
const INITIAL_SCHEMA_VERSION = 1;

/** A serialisable snapshot, used to compare whole documents and to prove non-mutation. */
function snapshotOf(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** The complete form a stored document must take once the chain has run. */
function expectedFormOf(fixture: HistoricalFixture): unknown {
  const page = fixture.receivesCompatibilityPage ? { page: COMPATIBILITY_PAGE } : {};
  return snapshotOf({ ...fixture.document, ...page, schemaVersion: CURRENT_SCHEMA_VERSION });
}

/**
 * Every key carried by an AST node or an inline segment, every `type` and `kind` discriminant, and
 * every key of the document itself.
 *
 * Keys are gathered from discriminated objects only, so `align` on a table column -- part of the
 * table contract, not of the appearance one -- is not confused with `align` on a text node.
 */
function tokensOf(document: Record<string, unknown>): ReadonlySet<string> {
  const found = new Set<string>(Object.keys(document));

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (typeof value !== 'object' || value === null) {
      return;
    }
    const entries = Object.entries(value);
    const discriminant = entries.find(([key]) => key === 'type' || key === 'kind')?.[1];
    for (const [key, nested] of entries) {
      if (typeof discriminant === 'string') {
        found.add(key);
      }
      visit(nested);
    }
    if (typeof discriminant === 'string') {
      found.add(discriminant);
    }
  };

  visit(document);
  return found;
}

describe('the official upgrade chain', () => {
  it('is continuous, ordered and complete from the initial version to the current one', () => {
    // The single owner of the whole chain. Its expectation is DERIVED from the two bounds rather
    // than copied as a list, so a version bumped without a step registered fails here and no
    // subsystem has to be edited when a later lot extends the chain.
    const steps = TEMPLATE_MIGRATIONS;
    const first = steps.at(0);
    const last = steps.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error('the official chain should carry at least one step');
    }

    // Origin, termination, and a length consistent with both.
    expect(first.from).toBe(INITIAL_SCHEMA_VERSION);
    expect(last.to).toBe(CURRENT_SCHEMA_VERSION);
    expect(steps).toHaveLength(CURRENT_SCHEMA_VERSION - INITIAL_SCHEMA_VERSION);

    // Unit step, and the exact seam between two consecutive entries.
    for (const [index, step] of steps.entries()) {
      expect(step.to).toBe(step.from + 1);
      expect(step.from).toBe(INITIAL_SCHEMA_VERSION + index);
    }

    // Strictly increasing and duplicate-free: a merged or reordered pair fails one of the two.
    expect(new Set(steps.map((step) => step.from)).size).toBe(steps.length);
    expect(new Set(steps.map((step) => step.to)).size).toBe(steps.length);
  });

  it('asks the integrator for no new symbol, parameter or type', () => {
    // The tightening on `to` applies an invariant `TemplateMigration` already declared; it is not
    // a new migration strategy, and it adds nothing to the public surface. Checked by name rather
    // than by total: a total breaks on every later feature and misses the one fault that costs an
    // integrator, which is a rename.
    const published = Object.keys(core);
    for (const symbol of [
      'parseTemplate',
      'migrateToCurrent',
      'TEMPLATE_MIGRATIONS',
      'CURRENT_SCHEMA_VERSION',
      'TemplateMigrationError',
      'TEMPLATE_MIGRATION_ERROR_CODES',
    ]) {
      expect(published).toContain(symbol);
    }
    // No historical schema and no second parsing gate: the chain migrates first and validates one
    // current form, and eight stored schemas would be eight sources of truth.
    for (const absent of ['TemplateV1Schema', 'parseStoredTemplate', 'STORED_TEMPLATE_SCHEMAS']) {
      expect(published).not.toContain(absent);
    }
    expect(core.TEMPLATE_MIGRATION_ERROR_CODES).toContain('invalid-migration-result');
  });

  it('covers every stored version with one historical witness', () => {
    // The corpus is closed against the chain rather than maintained by hand: the day a lot bumps
    // the version without adding its fixture, this is what says so.
    expect(HISTORICAL_FIXTURES.map((fixture) => fixture.version)).toStrictEqual(
      Array.from(
        { length: CURRENT_SCHEMA_VERSION - INITIAL_SCHEMA_VERSION + 1 },
        (_unused, index) => INITIAL_SCHEMA_VERSION + index,
      ),
    );
  });
});

describe('the historical corpus, version by version', () => {
  it.each(HISTORICAL_FIXTURES)(
    'brings the version $version document to the current stamp and parses it',
    (fixture) => {
      expect(migrateToCurrent(fixture.document).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(parseTemplate(fixture.document).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    },
  );

  it.each(HISTORICAL_FIXTURES)(
    'converts the version $version document into exactly the expected form',
    (fixture) => {
      // The WHOLE document, not the stamp and a spot check: a step that dropped a loop, reworded a
      // binding or added a field nobody asked for fails here and nowhere else.
      expect(snapshotOf(migrateToCurrent(fixture.document))).toStrictEqual(expectedFormOf(fixture));
    },
  );

  it.each(HISTORICAL_FIXTURES)(
    'leaves the stored version $version document untouched',
    (fixture) => {
      const before = snapshotOf(fixture.document);

      migrateToCurrent(fixture.document);
      parseTemplate(fixture.document);

      expect(snapshotOf(fixture.document)).toStrictEqual(before);
    },
  );

  it.each(HISTORICAL_FIXTURES)(
    'invents no later capability for the version $version document',
    (fixture) => {
      const stored = tokensOf(fixture.document);
      for (const token of tokensAbsentFromSource(fixture)) {
        expect(stored).not.toContain(token);
      }

      // The same list on the OUTPUT, minus the page the chain is expected to write: no writing, no
      // appearance and no fragmentation preference is ever invented for an older document.
      const migrated = tokensOf(migrateToCurrent(fixture.document));
      for (const token of fixture.futureTokens) {
        expect(migrated).not.toContain(token);
      }
    },
  );

  it.each(HISTORICAL_FIXTURES)(
    'converts the version $version document the same way twice',
    (fixture) => {
      const once = migrateToCurrent(fixture.document);
      const twice = migrateToCurrent(fixture.document);

      expect(snapshotOf(twice)).toStrictEqual(snapshotOf(once));
      // And converting an already-current result changes nothing more.
      expect(snapshotOf(migrateToCurrent(once))).toStrictEqual(snapshotOf(once));
    },
  );

  it.each(HISTORICAL_FIXTURES)(
    'survives a serialise, reload and parse round trip at version $version',
    (fixture) => {
      // What a stored template actually goes through: written to a column or a file, read back,
      // parsed. The reloaded form must be the same document, not merely a valid one.
      const parsed = parseTemplate(fixture.document);
      const reparsed = parseTemplate(snapshotOf(parsed));

      expect(snapshotOf(reparsed)).toStrictEqual(snapshotOf(parsed));
    },
  );

  it('gives two DIFFERENT documents their own compatibility page', () => {
    // Not the same fixture twice: two distinct stored documents must not end up sharing one page
    // object, nor its sheet, nor either band array.
    const pageless = HISTORICAL_FIXTURES.filter((fixture) => fixture.receivesCompatibilityPage);
    const first = pageless.at(0);
    const second = pageless.at(1);
    if (first === undefined || second === undefined) {
      throw new Error('the corpus should carry at least two documents that declare no page');
    }

    const left = migrateToCurrent(first.document).page;
    const right = migrateToCurrent(second.document).page;

    expect(left).not.toBe(right);
    expect(left).toStrictEqual(right);
    expect(left).toStrictEqual(COMPATIBILITY_PAGE);
  });

  it('distinguishes a fragmentation preference written true from one left unwritten', () => {
    // The version 8 witness carries two siblings and marks only one. The check is on the OWN
    // PROPERTY: a step writing `keepTogether: undefined` onto every node would survive a JSON
    // comparison while the key travelled into an `onSave` and cost one value of the node budget.
    const version8 = HISTORICAL_FIXTURES.at(-1);
    if (version8 === undefined) {
      throw new Error('the corpus should carry a witness at the current version');
    }

    const root = parseTemplate(version8.document).root;
    const [marked, unmarked] = root.children;

    expect(Object.hasOwn(root, 'keepTogether')).toBe(false);
    expect(marked?.keepTogether).toBe(true);
    expect(unmarked === undefined || Object.hasOwn(unmarked, 'keepTogether')).toBe(false);
  });
});

describe('the meaning of the version 1 document, replayed after migration', () => {
  /** Narrowing helpers: the repository forbids `!`, so each lookup states what it expects. */
  function textNode(root: DocumentNode, id: string): TextNode {
    const node = findNodeById(root, id);
    if (node?.type !== 'text') {
      throw new Error(`the version 1 document should carry a text node named ${id}`);
    }
    return node;
  }

  function loopNode(root: DocumentNode, id: string): LoopNode {
    const node = findNodeById(root, id);
    if (node?.type !== 'loop') {
      throw new Error(`the version 1 document should carry a loop named ${id}`);
    }
    return node;
  }

  function conditionNode(root: DocumentNode, id: string): ConditionNode {
    const node = findNodeById(root, id);
    if (node?.type !== 'condition') {
      throw new Error(`the version 1 document should carry a condition named ${id}`);
    }
    return node;
  }

  /** The printed form of a text node under one scope: literals in place, bindings evaluated. */
  function textOf(node: TextNode, scope: EvaluationScope): string {
    return node.content
      .map((segment) =>
        visitSegment(segment, {
          literal: (literal) => literal.text,
          binding: (binding) => String(evaluateExpression(binding.value, scope)),
          pageField: () => {
            throw new Error('the version 1 document declares no page field');
          },
        }),
      )
      .join('');
  }

  it('declares exactly the paths its author wrote, and no alias', () => {
    // The alias bound by the loop is local, so `entry.status` and `entry.label` are NOT asked of
    // the host application: an integrator reading this list sees only what it must supply.
    expect(collectTemplateDataPaths(parseTemplate(V1_DOCUMENT))).toStrictEqual([
      'payload.title',
      'payload.entries',
    ]);
  });

  it('keeps its nodes, and their order, through seven steps', () => {
    expect([...walk(parseTemplate(V1_DOCUMENT).root)].map((node) => node.id)).toStrictEqual([
      'root',
      'heading',
      'entries',
      'open-only',
      'entry-label',
    ]);
  });

  it('still prints what it meant, on a data set the fixture names itself', () => {
    // No renderer, no HTML and no pagination: the meaning is replayed with the public operations
    // that exist today. The visual half of this promise belongs to the engine's frozen corpus.
    const root = parseTemplate(V1_DOCUMENT).root;
    const loop = loopNode(root, 'entries');
    const condition = conditionNode(root, 'open-only');
    const label = textNode(root, 'entry-label');

    const items = evaluateSequence(loop.each, V1_DATA);
    expect(items).toHaveLength(2);

    const printed = [textOf(textNode(root, 'heading'), V1_DATA)];
    const branches: boolean[] = [];
    for (const item of items) {
      const scope = childScope(V1_DATA, loop.as, item);
      const taken = evaluatePredicate(condition.when, scope);
      branches.push(taken);
      if (taken) {
        printed.push(textOf(label, scope));
      }
    }

    // One entry matches and the other does not, so both branches of the condition are exercised.
    expect(branches).toStrictEqual([true, false]);
    expect(printed).toStrictEqual(['Report: Quarterly summary', '- First entry']);
  });

  it('binds its alias without letting it escape into the caller scope', () => {
    const root = parseTemplate(V1_DOCUMENT).root;
    const loop = loopNode(root, 'entries');
    const [firstItem] = evaluateSequence(loop.each, V1_DATA);

    expect(loop.as).toBe('entry');
    expect(Object.hasOwn(V1_DATA, loop.as)).toBe(false);
    expect(childScope(V1_DATA, loop.as, firstItem)[loop.as]).toStrictEqual({
      label: 'First entry',
      status: 'open',
    });
  });
});

describe('documents written before a stamping step', () => {
  it('brings a template written before C1 up to the current stamp', () => {
    const beforeC1 = {
      schemaVersion: 1,
      id: 'tpl_legacy',
      name: 'Invoice',
      version: '1.0.0',
      page: authoredPage,
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'loop',
            id: 'lines',
            each: { kind: 'path', path: 'payload.entries' },
            as: 'entry',
            children: [
              {
                type: 'text',
                id: 'label',
                content: [
                  { kind: 'literal', text: 'Total: ' },
                  { kind: 'binding', value: { kind: 'path', path: 'entry.total' } },
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

  it('stamps a v5 document to the current version without transforming one value of it', () => {
    // Compared by JSON round trip with the stamp put back, rather than field by field: that is
    // what makes "transforms NOTHING" an assertion instead of a claim about the fields someone
    // thought to check.
    const stampedFive = { ...validTemplate, schemaVersion: 5 };

    const parsed = parseTemplate(stampedFive);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(JSON.parse(JSON.stringify({ ...parsed, schemaVersion: 5 }))).toStrictEqual(
      JSON.parse(JSON.stringify(stampedFive)),
    );
  });

  it('carries an appearance through the stamp on a document that already had one', () => {
    // The version guard reads the STAMP, not the content. A document stamped 5 that already
    // carries a box parses and comes out at the current stamp with its box intact.
    const withBox = {
      ...validTemplate,
      schemaVersion: 5,
      root: { type: 'container', id: 'root', children: [], box: { background: '#1b3a6f' } },
    };

    const parsed = parseTemplate(withBox);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.root.box).toStrictEqual({ background: '#1b3a6f' });
  });

  it('stamps a v7 document to the current version and invents no fragmentation policy', () => {
    // The 7 -> 8 step does not walk the AST, so a document that declared nothing goes on
    // declaring nothing: the ABSENCE of the key is what it already said.
    const stampedSeven = {
      ...validTemplate,
      schemaVersion: 7,
      root: {
        type: 'container',
        id: 'root',
        children: [{ type: 'text', id: 'corps', content: [{ kind: 'literal', text: 'Total' }] }],
      },
    };

    const parsed = parseTemplate(stampedSeven);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // On the own property, not only on the value and not only on a round trip: `JSON.stringify`
    // drops an undefined-valued key from both sides, so a step writing `keepTogether: undefined`
    // onto every node would leave the two assertions below green.
    expect(Object.hasOwn(parsed.root, 'keepTogether')).toBe(false);
    expect(parsed.root.keepTogether).toBeUndefined();
    expect(JSON.parse(JSON.stringify({ ...parsed, schemaVersion: 7 }))).toStrictEqual(
      JSON.parse(JSON.stringify(stampedSeven)),
    );
  });

  it('carries a mark through the stamp on an UNDER-stamped document that already had one', () => {
    // Why the stamp is mandatory even though the field is optional: a build that did not know the
    // field would STRIP it with no error and an `onSave` would persist the loss.
    const marked = {
      ...validTemplate,
      schemaVersion: 7,
      root: {
        type: 'container',
        id: 'root',
        keepTogether: true,
        children: [
          {
            type: 'container',
            id: 'totaux',
            keepTogether: true,
            children: [{ type: 'text', id: 'tf', content: [{ kind: 'literal', text: 'Total' }] }],
          },
        ],
      },
    };

    const parsed = parseTemplate(marked);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.root.keepTogether).toBe(true);
    expect(parsed.root.children[0]?.keepTogether).toBe(true);
  });

  it('accepts a marked document already at the current stamp, with no migration at all', () => {
    const marked = {
      ...validTemplate,
      root: { type: 'container', id: 'root', keepTogether: true, children: [] },
    };

    expect(migrateToCurrent(marked)).toStrictEqual(marked);
    expect(parseTemplate(marked).root.keepTogether).toBe(true);
  });

  it('walks a MARKED v1 document up the whole chain without losing the mark', () => {
    // Seven steps, and the value the author wrote is still there at the other end.
    const beforeC1 = {
      ...validTemplate,
      schemaVersion: 1,
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'table',
            id: 'lignes',
            keepTogether: true,
            columns: [{ id: 'montant', width: 1, align: 'end' }],
            header: [],
            body: [
              {
                type: 'tableRow',
                id: 'ligne-total',
                keepTogether: true,
                cells: [
                  {
                    columnId: 'montant',
                    children: [{ type: 'text', id: 'tf', content: [] }],
                  },
                ],
              },
            ],
            footer: [],
          },
        ],
      },
    };

    const parsed = parseTemplate(beforeC1);
    const table = parsed.root.children[0];

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    if (table?.type !== 'table') {
      throw new Error('the fixture should carry a table');
    }
    expect(table.keepTogether).toBe(true);
    expect(table.body[0]?.keepTogether).toBe(true);
  });

  it('brings a document written before C3 up to the current stamp, table or no table', () => {
    // Half of what "purely additive" covers: nothing that existed becomes unacceptable. This
    // document carries no table at all.
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
    // The table sits in the root's block flow, where a real document carries one, and not at the
    // root, which stays a container.
    const withTable = {
      ...validTemplate,
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'table',
            id: 'lignes',
            columns: [{ id: 'valeur', width: 1, align: 'end' }],
            header: [],
            body: [
              {
                type: 'tableRowGroup',
                id: 'corps',
                each: { kind: 'path', path: 'payload.entries' },
                as: 'entry',
                rows: [
                  {
                    type: 'tableRow',
                    id: 'detail',
                    cells: [
                      {
                        columnId: 'valeur',
                        children: [
                          {
                            type: 'text',
                            id: 'td',
                            content: [
                              { kind: 'binding', value: { kind: 'path', path: 'entry.valeur' } },
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
                  source: { kind: 'path', path: 'payload.entries' },
                  as: 'entry',
                  value: {
                    kind: 'arithmetic',
                    op: 'mul',
                    left: { kind: 'path', path: 'entry.quantity' },
                    right: { kind: 'path', path: 'entry.unitPrice' },
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
    // `aggregate.value` under a `TextBindingSegment.value`: the deepest position the round kind
    // reaches, and the one that pays for the stamp.
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
                    source: { kind: 'path', path: 'payload.entries' },
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
});

describe('the compatibility page written when a stored document carries none', () => {
  it('fills in a page on a v4 document that has none, and fills it COMPLETELY', () => {
    // Compared field by field rather than tested for presence: a migration writing a PARTIAL page
    // would pass an existence check and then be refused by the parse, with a message accusing the
    // document while the fault is in the migration.
    const { page: _none, ...beforeC4 } = { ...validTemplate, schemaVersion: 4 };

    const parsed = parseTemplate(beforeC4);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.page).toStrictEqual({
      sheet: { width: 210, height: 297 },
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      header: [],
      footer: [],
    });
  });

  it('PRESERVES a page a v4 document already carries', () => {
    // The stamp only ever guards upward, so a hand-made document -- or one written by an
    // unstamped mid-lot build -- can be stamped 4 and already carry a page. The two spreads do
    // OPPOSITE things here: `{ ...input, page: DEFAULT }` overwrites the author's page, while
    // `{ page: DEFAULT, ...input }` preserves it by key order alone. This is what forbids both.
    const authored = { ...validTemplate, schemaVersion: 4 };

    const parsed = parseTemplate(authored);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.page).toStrictEqual(authoredPage);
    expect(parsed.page.margins.top).toBe(12);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('treats a `page` key holding %s as no page at all', (_label, empty) => {
    // The branch tests the VALUE, not the KEY. Written `'page' in input`, both of these take the
    // "the author already has a page" path and hand the empty value to the schema, producing a
    // bare `ZodError` on exactly the documents this migration exists to rescue.
    const emptied = { ...validTemplate, schemaVersion: 4, page: empty };

    const parsed = parseTemplate(emptied);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.page.margins.top).toBe(20);
  });

  it('gives every migrated document its OWN page, never one shared object', () => {
    // Written in by reference, the compatibility page would be shared down to `sheet` and both
    // band arrays. `migrateToCurrent` returns a `Record<string, unknown>`, so `readonly` is erased
    // at that boundary and a caller normalising the record it was handed would mutate the page a
    // LATER, unrelated `parseTemplate` hands back. `toStrictEqual` cannot see this, so the
    // assertions below are on IDENTITY.
    const { page: _none, ...pageless } = { ...validTemplate, schemaVersion: 4 };
    const first = migrateToCurrent({ ...pageless });
    const second = migrateToCurrent({ ...pageless });

    expect(first.page).not.toBe(second.page);
    expect(first.page).toStrictEqual(second.page);

    const mutated = first.page as { sheet: { width: number }; header: unknown[] };
    mutated.sheet.width = 999;
    mutated.header.push({ on: 'every', content: { type: 'container', id: 'x', children: [] } });

    expect(migrateToCurrent({ ...pageless }).page).toStrictEqual({
      sheet: { width: 210, height: 297 },
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      header: [],
      footer: [],
    });
    expect(parseTemplate({ ...pageless }).page.sheet.width).toBe(210);
  });
});

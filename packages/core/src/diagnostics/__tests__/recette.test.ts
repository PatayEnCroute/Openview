import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  diagnosticsOf,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  type LiteralExpression,
  migrateToCurrent,
  type OpenviewDiagnostic,
  type PathExpression,
  parseTemplate,
  TEMPLATE_MIGRATIONS,
} from '../../index.js';

const data = { invoice: { total: 1200, customer: 'Fabrique Martin' }, lines: [{ amount: 400 }] };
const literal = (value: string | number): LiteralExpression => ({ kind: 'literal', value });
const path = (value: string): PathExpression => ({ kind: 'path', path: value });

const validPage = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: [],
  footer: [],
};

function template(overrides: Record<string, unknown>): unknown {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'invoice',
    name: 'Invoice',
    version: '1.0.0',
    page: validPage,
    root: { type: 'container', id: 'root', children: [] },
    ...overrides,
  };
}

function nested(levels: number): Record<string, unknown> {
  let node: Record<string, unknown> = { type: 'container', id: 'leaf', children: [] };
  for (let level = 0; level < levels; level += 1) {
    node = { type: 'container', id: `c${level}`, children: [node] };
  }
  return node;
}

/**
 * A refusal exactly as a consumer sees it: whatever the call raises goes to the facade, and an
 * unrecognised error is rethrown rather than dressed up as a correction the author could apply.
 */
function refuse(
  act: () => unknown,
  context?: { nodeId?: string; pathPrefix?: readonly (string | number)[] },
): OpenviewDiagnostic {
  try {
    act();
  } catch (error) {
    const diagnostics = diagnosticsOf(error, context);
    if (diagnostics === undefined) {
      throw error;
    }
    const [first] = diagnostics;
    if (first === undefined) {
      throw new Error('A refusal produced no diagnostic.');
    }
    return first;
  }
  throw new Error('This case was expected to be refused.');
}

function at(
  act: () => unknown,
  path: readonly (string | number)[],
  context?: { nodeId?: string },
): OpenviewDiagnostic {
  try {
    act();
  } catch (error) {
    const diagnostics = diagnosticsOf(error, context);
    if (diagnostics === undefined) {
      throw error;
    }
    const found = diagnostics.find((one) => one.path.join(' ') === path.join(' '));
    if (found === undefined) {
      throw new Error(`No diagnostic at [${path.join(', ')}].`);
    }
    return found;
  }
  throw new Error('This case was expected to be refused.');
}

/** The five refusals of J1 that are not formulas. */
const CONTRACT_CASES = [
  {
    title: 'the fragmentation mark written with false',
    diagnostic: () =>
      at(
        () =>
          parseTemplate(
            template({
              root: {
                type: 'container',
                id: 'root',
                children: [{ type: 'text', id: 'legal-notice', keepTogether: false, content: [] }],
              },
            }),
          ),
        ['root', 'children', 0, 'keepTogether'],
        { nodeId: 'legal-notice' },
      ),
    source: 'template-validation',
    code: 'invalid-value',
    path: ['root', 'children', 0, 'keepTogether'],
    nodeId: 'legal-notice',
    message: 'This field must be true when present; omit it to allow the block to split.',
  },
  {
    title: 'a page field segment that names no field',
    diagnostic: () =>
      at(
        () =>
          parseTemplate(
            template({
              root: {
                type: 'container',
                id: 'root',
                children: [{ type: 'text', id: 'footer-text', content: [{ kind: 'pageField' }] }],
              },
            }),
          ),
        ['root', 'children', 0, 'content', 0, 'field'],
        { nodeId: 'footer-text' },
      ),
    source: 'template-validation',
    code: 'invalid-value',
    path: ['root', 'children', 0, 'content', 0, 'field'],
    nodeId: 'footer-text',
    message: 'This field must be one of "number" or "count".',
  },
  {
    title: 'a sheet width that is not finite',
    diagnostic: () =>
      at(
        () =>
          parseTemplate(
            template({
              page: { ...validPage, sheet: { width: Number.POSITIVE_INFINITY, height: 297 } },
            }),
          ),
        ['page', 'sheet', 'width'],
      ),
    source: 'template-validation',
    code: 'invalid-type',
    path: ['page', 'sheet', 'width'],
    nodeId: undefined,
    message: 'This field must be a finite number.',
  },
  {
    title: 'a template nested past the configured limit',
    diagnostic: () => refuse(() => parseTemplate(template({ root: nested(80) }))),
    source: 'template-shape',
    code: 'too-deep',
    path: [],
    nodeId: undefined,
    message: 'This template exceeds the configured nesting limit. Reduce its nesting.',
  },
  {
    title: 'a template stamped by the next schema version',
    diagnostic: () =>
      refuse(() => parseTemplate(template({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }))),
    source: 'template-migration',
    code: 'newer-schema-version',
    path: [],
    nodeId: undefined,
    message:
      'This template was created by a newer Openview schema version. Upgrade Openview before opening it.',
  },
] as const;

/** The five formula refusals of J1. */
const FORMULA_CASES = [
  {
    title: 'a division by an unguarded count',
    diagnostic: () =>
      refuse(
        () =>
          evaluateExpression(
            { kind: 'arithmetic', op: 'div', left: path('invoice.total'), right: literal(0) },
            data,
          ),
        { nodeId: 'total-block', pathPrefix: ['root', 'children', 3, 'when'] },
      ),
    source: 'expression-evaluation',
    code: 'division-by-zero',
    path: ['root', 'children', 3, 'when', 'right'],
    nodeId: 'total-block',
    message: 'This formula divides by zero. Guard the divisor with an "if" before dividing.',
  },
  {
    title: 'a text added to a number',
    diagnostic: () =>
      refuse(
        () =>
          evaluateExpression(
            { kind: 'arithmetic', op: 'add', left: path('invoice.customer'), right: literal(1) },
            data,
          ),
        { nodeId: 'total-block' },
      ),
    source: 'expression-evaluation',
    code: 'operand-type',
    path: ['left'],
    nodeId: 'total-block',
    message: 'This arithmetic formula needs numbers, but the highlighted operand is text.',
  },
  {
    title: 'a civil date that no calendar has',
    diagnostic: () =>
      refuse(() => evaluateExpression({ kind: 'endOfMonth', date: literal('2026-02-30') }, data), {
        nodeId: 'due-date',
      }),
    source: 'expression-evaluation',
    code: 'not-a-date',
    path: ['date'],
    nodeId: 'due-date',
    message:
      'This formula needs a valid date in YYYY-MM-DD form between 0001-01-01 and 9999-12-31.',
  },
  {
    title: 'a table body repeated over a number',
    diagnostic: () =>
      refuse(() => evaluateSequence(path('invoice.total'), data, { caller: 'tableRowGroup' }), {
        nodeId: 'lines-body',
        pathPrefix: ['root', 'children', 2, 'body', 0, 'each'],
      }),
    source: 'expression-evaluation',
    code: 'not-a-list',
    path: ['root', 'children', 2, 'body', 0, 'each'],
    nodeId: 'lines-body',
    message: 'This block needs a list to repeat, but the selected value is a number.',
  },
  {
    title: 'a condition that returns text',
    diagnostic: () =>
      refuse(() => evaluatePredicate(path('invoice.customer'), data), {
        nodeId: 'discount-block',
        pathPrefix: ['root', 'children', 1, 'when'],
      }),
    source: 'expression-evaluation',
    code: 'not-a-boolean',
    path: ['root', 'children', 1, 'when'],
    nodeId: 'discount-block',
    message:
      'This condition must return true or false, but it returns text. Add a comparison or use isEmpty.',
  },
] as const;

const RECETTE_CASES = [...CONTRACT_CASES, ...FORMULA_CASES];

describe('the ten recette cases of J1', () => {
  it('is five contract refusals and five formula refusals', () => {
    expect(CONTRACT_CASES).toHaveLength(5);
    expect(FORMULA_CASES).toHaveLength(5);
  });

  it.each(RECETTE_CASES.map((one) => [one.title, one] as const))(
    'reports %s',
    (_title, expected) => {
      const diagnostic = expected.diagnostic();
      expect(diagnostic.source).toBe(expected.source);
      expect(diagnostic.code).toBe(expected.code);
      expect(diagnostic.message).toBe(expected.message);
      expect(diagnostic.path).toEqual(expected.path);
      expect(diagnostic.nodeId).toBe(expected.nodeId);
    },
  );

  it('produces ten distinct sentences a reader can act on', () => {
    const messages = RECETTE_CASES.map((one) => one.diagnostic().message);
    expect(new Set(messages).size).toBe(10);
  });

  it('shows no render value, no model excerpt and no original cause', () => {
    const diagnostics = RECETTE_CASES.map((one) => one.diagnostic());
    const serialised = JSON.stringify(diagnostics);
    for (const forbidden of ['Fabrique Martin', 'cause', 'issues', '1200']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('never interpolates the node id or the path into the sentence', () => {
    // The two are separate fields precisely so a host renders them as text and escapes them. A
    // sentence that spliced them in would make that escaping impossible.
    for (const expected of RECETTE_CASES) {
      const diagnostic = expected.diagnostic();
      if (diagnostic.nodeId !== undefined) {
        expect(diagnostic.message).not.toContain(diagnostic.nodeId);
      }
      // The joined path, and only from two segments up. A single segment is often an ordinary
      // English word -- `field`, `date` -- so checking one would forbid the vocabulary the sentence
      // needs. A joined chain of two or more is not prose, and that is the shape an interpolation
      // would actually take.
      if (diagnostic.path.length >= 2) {
        expect(diagnostic.message).not.toContain(diagnostic.path.join('.'));
        expect(diagnostic.message).not.toContain(diagnostic.path.join(' '));
      }
    }
  });
});

describe('what C8 leaves exactly as C7 left it', () => {
  it('changes no stored format', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(8);
    expect(TEMPLATE_MIGRATIONS).toHaveLength(CURRENT_SCHEMA_VERSION - 1);
    expect(TEMPLATE_MIGRATIONS.map((step) => step.from)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('still walks a pre-C1 document all the way up', () => {
    const legacy = {
      schemaVersion: 1,
      id: 'old',
      name: 'Old',
      version: '1.0.0',
      root: { type: 'container', id: 'root', children: [] },
    };
    const migrated = migrateToCurrent(legacy);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(() => parseTemplate(legacy)).not.toThrow();
  });

  it('adds no code that would preempt the missing-data policy of a future data binding step', () => {
    // ADR 0001 stands: an absent value makes a condition false, a loop empty, and a scalar absent.
    // Naming that a refusal here would reverse it, and the choice belongs to whoever knows the
    // final print position.
    expect(evaluatePredicate(path('invoice.discount'), data)).toBe(false);
    expect(evaluateSequence(path('invoice.absent'), data)).toEqual([]);
    expect(
      evaluateExpression(
        { kind: 'arithmetic', op: 'add', left: path('invoice.absent'), right: literal(1) },
        data,
      ),
    ).toBeUndefined();
  });
});

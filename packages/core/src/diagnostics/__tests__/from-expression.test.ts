import { describe, expect, it } from 'vitest';
import {
  createBudget,
  diagnosticsOf,
  EXPRESSION_ERROR_CODES,
  type ExpressionErrorCode,
  type ExpressionEvaluationDiagnostic,
  ExpressionEvaluationError,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  type LiteralExpression,
  type OpenviewDiagnostic,
  type PathExpression,
} from '../../index.js';

const data = {
  invoice: { total: 1200, customer: 'Fabrique Martin', vatRate: 0.2 },
  lines: [{ amount: 400 }, { amount: 800 }],
  secret: { token: 'sk-live-DONOTLOG' },
};

const path = (value: string): PathExpression => ({ kind: 'path', path: value });
const literal = (value: string | number | boolean): LiteralExpression => ({
  kind: 'literal',
  value,
});

function diagnose(
  act: () => unknown,
  context?: { nodeId?: string; pathPrefix?: readonly (string | number)[] },
): ExpressionEvaluationDiagnostic {
  try {
    act();
  } catch (error) {
    const diagnostics = diagnosticsOf(error, context);
    if (diagnostics === undefined) {
      throw error;
    }
    const [first] = diagnostics;
    if (first === undefined || first.source !== 'expression-evaluation') {
      throw new Error(`Expected one expression diagnostic, got ${JSON.stringify(diagnostics)}.`);
    }
    return first;
  }
  throw new Error('This formula was expected to be refused.');
}

describe('the five formula acceptance examples', () => {
  it('says how to guard a division by zero', () => {
    const diagnostic = diagnose(
      () =>
        evaluateExpression(
          { kind: 'arithmetic', op: 'div', left: path('invoice.total'), right: literal(0) },
          data,
        ),
      { nodeId: 'total-block', pathPrefix: ['root', 'children', 3, 'content', 0, 'value'] },
    );
    expect(diagnostic).toEqual({
      source: 'expression-evaluation',
      code: 'division-by-zero',
      site: 'arithmetic',
      actualType: 'number',
      message: 'This formula divides by zero. Guard the divisor with an "if" before dividing.',
      path: ['root', 'children', 3, 'content', 0, 'value', 'right'],
      nodeId: 'total-block',
    });
  });

  it('says which operand is text in an arithmetic formula', () => {
    const diagnostic = diagnose(
      () =>
        evaluateExpression(
          { kind: 'arithmetic', op: 'add', left: path('invoice.customer'), right: literal(1) },
          data,
        ),
      { nodeId: 'total-block' },
    );
    expect(diagnostic.code).toBe('operand-type');
    expect(diagnostic.message).toBe(
      'This arithmetic formula needs numbers, but the highlighted operand is text.',
    );
    expect(diagnostic.path).toEqual(['left']);
  });

  it('says what a valid civil date looks like', () => {
    const diagnostic = diagnose(() =>
      evaluateExpression({ kind: 'endOfMonth', date: literal('2026-02-30') }, data),
    );
    expect(diagnostic.code).toBe('not-a-date');
    expect(diagnostic.message).toBe(
      'This formula needs a valid date in YYYY-MM-DD form between 0001-01-01 and 9999-12-31.',
    );
  });

  it.each(['loop', 'tableRowGroup'] as const)('says a %s block needs a list', (caller) => {
    const diagnostic = diagnose(() => evaluateSequence(path('invoice.total'), data, { caller }), {
      nodeId: 'lines-loop',
      pathPrefix: ['root', 'children', 2, 'each'],
    });
    expect(diagnostic.code).toBe('not-a-list');
    expect(diagnostic.site).toBe(caller);
    expect(diagnostic.message).toBe(
      'This block needs a list to repeat, but the selected value is a number.',
    );
    expect(diagnostic.path).toEqual(['root', 'children', 2, 'each']);
    expect(diagnostic.nodeId).toBe('lines-loop');
  });

  it('says how to turn a text-returning condition into a real condition', () => {
    const diagnostic = diagnose(() => evaluatePredicate(path('invoice.customer'), data), {
      pathPrefix: ['root', 'children', 1, 'when'],
    });
    expect(diagnostic.code).toBe('not-a-boolean');
    expect(diagnostic.message).toBe(
      'This condition must return true or false, but it returns text. Add a comparison or use isEmpty.',
    );
    expect(diagnostic.nodeId).toBeUndefined();
  });
});

describe('the branches of an expression diagnostic', () => {
  it('keeps actualType on an operand branch and never the value behind it', () => {
    const diagnostic = diagnose(() =>
      evaluateExpression(
        { kind: 'arithmetic', op: 'add', left: path('secret.token'), right: literal(1) },
        data,
      ),
    );
    if ('limit' in diagnostic) {
      throw new Error('An operand branch must not carry a limit.');
    }
    expect(diagnostic.actualType).toBe('string');
    expect(JSON.stringify(diagnostic)).not.toContain('DONOTLOG');
  });

  it('keeps limit on a bound branch and carries no actualType', () => {
    const diagnostic = diagnose(() =>
      evaluateExpression({ kind: 'not', operand: literal(true) }, data, {
        budget: createBudget({ maxSteps: 1 }),
      }),
    );
    if (!('limit' in diagnostic)) {
      throw new Error('A bound branch must carry a limit.');
    }
    expect(diagnostic.limit).toBe(1);
    expect('actualType' in diagnostic).toBe(false);
  });

  it.each([
    [
      'date shift',
      { kind: 'dateAdd', date: literal('2026-01-01'), days: literal('tomorrow') } as const,
      ['days'],
    ],
    [
      'rounding',
      {
        kind: 'round',
        value: literal('12.30'),
        decimals: 2,
        mode: 'halfExpand',
      } as const,
      ['value'],
    ],
  ])('does not call a %s formula arithmetic', (_label, expression, expectedPath) => {
    const diagnostic = diagnose(() => evaluateExpression(expression, data));
    expect(diagnostic.message).toBe(
      'This formula needs a number, but the highlighted value is text.',
    );
    expect(diagnostic.path).toEqual(expectedPath);
  });

  it('orders the path root first, prefix then position inside the formula', () => {
    const diagnostic = diagnose(
      () =>
        evaluateExpression(
          {
            kind: 'concat',
            parts: [literal('N '), { kind: 'textCase', op: 'upper', text: literal(3) }],
          },
          data,
        ),
      { pathPrefix: ['root', 'children', 0] },
    );
    expect(diagnostic.path).toEqual(['root', 'children', 0, 'parts', 1, 'text']);
  });

  it('reads the same error twice into equal but distinct arrays', () => {
    let caught: unknown;
    try {
      evaluateExpression(
        { kind: 'arithmetic', op: 'div', left: literal(1), right: literal(0) },
        data,
      );
    } catch (error) {
      caught = error;
    }
    if (!(caught instanceof ExpressionEvaluationError)) {
      throw new Error('A division by zero must raise a typed expression error.');
    }
    const first = diagnosticsOf(caught);
    const second = diagnosticsOf(caught);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first?.[0]?.path).not.toBe(second?.[0]?.path);
  });

  it('leaves the error untouched, so a later read still sees its own path', () => {
    let caught: unknown;
    try {
      evaluateExpression(
        { kind: 'arithmetic', op: 'div', left: literal(1), right: literal(0) },
        data,
      );
    } catch (error) {
      caught = error;
    }
    if (!(caught instanceof ExpressionEvaluationError)) {
      throw new Error('A division by zero must raise a typed expression error.');
    }
    const diagnostic = diagnosticsOf(caught, { pathPrefix: ['root'] })?.[0];
    expect(diagnostic?.path).toEqual(['root', 'right']);
    expect(caught.details.at).toEqual(['right']);
  });
});

describe('every expression code', () => {
  // Enumerated from EXPRESSION_ERROR_CODES itself, which stays the single source of truth: a code
  // added upstream without a scenario here fails this test rather than shipping undiagnosed.
  const scenarios: Readonly<Record<ExpressionErrorCode, () => unknown>> = {
    'operand-type': () =>
      evaluateExpression(
        { kind: 'arithmetic', op: 'add', left: path('invoice.customer'), right: literal(1) },
        data,
      ),
    'division-by-zero': () =>
      evaluateExpression(
        { kind: 'arithmetic', op: 'div', left: literal(1), right: literal(0) },
        data,
      ),
    'not-finite': () =>
      evaluateExpression(
        { kind: 'arithmetic', op: 'mul', left: literal(1e308), right: literal(1e308) },
        data,
      ),
    'not-a-whole-number': () =>
      evaluateExpression(
        { kind: 'dateAdd', date: literal('2026-01-31'), days: literal(1.5) },
        data,
      ),
    'not-a-list': () => evaluateSequence(path('invoice.total'), data),
    'not-a-boolean': () => evaluatePredicate(path('invoice.total'), data),
    'not-comparable': () =>
      evaluateExpression(
        { kind: 'compare', op: 'eq', left: path('lines'), right: literal(1) },
        data,
      ),
    'not-orderable': () =>
      evaluateExpression(
        { kind: 'compare', op: 'gt', left: path('invoice.customer'), right: literal(1) },
        data,
      ),
    'not-a-date': () =>
      evaluateExpression({ kind: 'endOfMonth', date: literal('2026-02-30') }, data),
    'step-limit-exceeded': () =>
      evaluateExpression({ kind: 'not', operand: literal(true) }, data, {
        budget: createBudget({ maxSteps: 1 }),
      }),
    'item-limit-exceeded': () =>
      evaluateSequence(path('lines'), data, { budget: createBudget({ maxItemsVisited: 1 }) }),
    'string-limit-exceeded': () =>
      evaluateExpression({ kind: 'concat', parts: [literal('abcdef'), literal('ghijkl')] }, data, {
        budget: createBudget({ maxStringLength: 4 }),
      }),
    'depth-limit-exceeded': () =>
      evaluateExpression({ kind: 'not', operand: { kind: 'not', operand: literal(true) } }, data, {
        budget: createBudget({ maxDepth: 1 }),
      }),
  };

  it.each([...EXPRESSION_ERROR_CODES])('is reachable and diagnosed: %s', (code) => {
    const diagnostic = diagnose(scenarios[code]);
    expect(diagnostic.code).toBe(code);
    expect(diagnostic.source).toBe('expression-evaluation');
    expect(diagnostic.message.length).toBeGreaterThan(0);
  });

  it('never leaks a render value into any of them', () => {
    const leaked: readonly OpenviewDiagnostic[] = EXPRESSION_ERROR_CODES.map((code) =>
      diagnose(scenarios[code]),
    );
    expect(JSON.stringify(leaked)).not.toContain('DONOTLOG');
    expect(JSON.stringify(leaked)).not.toContain('Fabrique Martin');
  });
});

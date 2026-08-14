import { describe, expect, it } from 'vitest';
import { type ExpressionErrorDetails, ExpressionEvaluationError } from '../../../errors.js';
import { createBudget } from '../../limits.js';
import type {
  AggregateExpression,
  AggregateOperator,
  ArithmeticExpression,
  ArithmeticOperator,
  Expression,
  FilterExpression,
  LiteralExpression,
  PathExpression,
  PrintableExpression,
} from '../../types.js';
import { evaluateExpression, evaluateSequence } from '../evaluate.js';

const path = (p: string): PathExpression => ({ kind: 'path', path: p });
const literal = (value: string | number | boolean | null): LiteralExpression => ({
  kind: 'literal',
  value,
});
const arithmetic = (
  op: ArithmeticOperator,
  left: PrintableExpression,
  right: PrintableExpression,
): ArithmeticExpression => ({ kind: 'arithmetic', op, left, right });

function expectEvaluationError(run: () => unknown): ExpressionErrorDetails {
  try {
    run();
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      return error.details;
    }
    throw error;
  }
  return expect.unreachable('the expression should have failed');
}

describe('aggregations, filter and count', () => {
  const lines = {
    invoice: {
      lines: [
        { sku: 'A', quantity: 2, unitPrice: 10, discount: 0 },
        { sku: 'B', quantity: 1, unitPrice: 30, discount: 15 },
        { sku: 'C', quantity: 4, unitPrice: 2.5, discount: 5 },
      ],
      empty: [],
      total: 70,
    },
  };

  const lineAmount: PrintableExpression = arithmetic(
    'mul',
    path('line.quantity'),
    path('line.unitPrice'),
  );

  const reduce = (
    op: AggregateOperator,
    source: Expression,
    value: PrintableExpression,
  ): AggregateExpression => ({ kind: 'aggregate', op, source, as: 'line', value });

  const discounted: FilterExpression = {
    kind: 'filter',
    source: path('invoice.lines'),
    as: 'line',
    where: { kind: 'compare', op: 'gt', left: path('line.discount'), right: literal(0) },
  };

  it('reduces lines whose amount is ITSELF a calculation', () => {
    expect(evaluateExpression(reduce('sum', path('invoice.lines'), lineAmount), lines)).toBe(60);
    expect(evaluateExpression(reduce('avg', path('invoice.lines'), lineAmount), lines)).toBe(20);
    expect(evaluateExpression(reduce('min', path('invoice.lines'), lineAmount), lines)).toBe(10);
    expect(evaluateExpression(reduce('max', path('invoice.lines'), lineAmount), lines)).toBe(30);
  });

  it('treats an empty list as no fault, and each operator answers in its own way', () => {
    expect(evaluateExpression(reduce('sum', path('invoice.empty'), lineAmount), lines)).toBe(0);
    expect(evaluateExpression({ kind: 'count', source: path('invoice.empty') }, lines)).toBe(0);
    expect(
      evaluateExpression(reduce('avg', path('invoice.empty'), lineAmount), lines),
    ).toBeUndefined();
    expect(
      evaluateExpression(reduce('min', path('invoice.empty'), lineAmount), lines),
    ).toBeUndefined();
    expect(
      evaluateExpression(reduce('max', path('invoice.empty'), lineAmount), lines),
    ).toBeUndefined();
  });

  it('treats an absent source as an empty list', () => {
    expect(evaluateExpression(reduce('sum', path('invoice.missing'), lineAmount), lines)).toBe(0);
    expect(evaluateExpression({ kind: 'count', source: path('invoice.missing') }, lines)).toBe(0);
  });

  it('ignores an element whose value is absent, and avg divides by the PRESENT ones', () => {
    const partial = {
      invoice: { lines: [{ rebate: 10 }, { sku: 'no rebate' }, { rebate: 20 }] },
    };

    expect(
      evaluateExpression(reduce('sum', path('invoice.lines'), path('line.rebate')), partial),
    ).toBe(30);
    expect(
      evaluateExpression(reduce('avg', path('invoice.lines'), path('line.rebate')), partial),
    ).toBe(15);
    expect(
      evaluateExpression(reduce('avg', path('invoice.lines'), path('line.absent')), partial),
    ).toBeUndefined();
  });

  it('refuses a source that is present but not a list, IN THE CALLER VOCABULARY', () => {
    expect(() =>
      evaluateExpression(reduce('sum', path('invoice.total'), lineAmount), lines),
    ).toThrow(/An aggregation needs a list/);
    expect(() =>
      evaluateExpression({ kind: 'count', source: path('invoice.total') }, lines),
    ).toThrow(/A count needs a list/);
    expect(() =>
      evaluateExpression({ ...discounted, source: path('invoice.total') }, lines),
    ).toThrow(/A filter needs a list/);

    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.total'), lineAmount), lines),
      ),
    ).toStrictEqual({
      code: 'not-a-list',
      site: 'aggregate',
      at: ['source'],
      actualType: 'number',
    });
  });

  it('points at the offending element by INDEX, as a number and from the root', () => {
    const mistyped = { invoice: { lines: [{ total: 1 }, { total: 'two' }] } };

    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.lines'), path('line.total')), mistyped),
      ),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'aggregate',
      at: ['value', 1],
      actualType: 'string',
    });
  });

  it('refuses a non-finite element value, and a non-finite total', () => {
    const broken = { invoice: { lines: [{ total: Number.NaN }] } };
    const huge = { invoice: { lines: [{ total: 1e308 }, { total: 1e308 }] } };

    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.lines'), path('line.total')), broken),
      ),
    ).toStrictEqual({
      code: 'not-finite',
      site: 'aggregate',
      at: ['value', 0],
      actualType: 'not-finite',
    });
    expect(
      expectEvaluationError(() =>
        evaluateExpression(reduce('sum', path('invoice.lines'), path('line.total')), huge),
      ),
    ).toStrictEqual({
      code: 'not-finite',
      site: 'aggregate',
      at: [],
      actualType: 'not-finite',
    });
  });

  it('accumulates POSITIONALLY, and never reorders', () => {
    const unstable = { invoice: { lines: [{ v: 1e16 }, { v: 1 }, { v: -1e16 }] } };

    expect(evaluateExpression(reduce('sum', path('invoice.lines'), path('line.v')), unstable)).toBe(
      0,
    );
  });

  it('counts a filtered list, which is how "how many discounted lines" is written', () => {
    expect(evaluateExpression({ kind: 'count', source: discounted }, lines)).toBe(2);
    expect(evaluateExpression(reduce('sum', discounted, path('line.discount')), lines)).toBe(20);
  });

  it('refuses truthiness in a filter, like every other predicate position', () => {
    const truthy: FilterExpression = { ...discounted, where: path('line.discount') };

    expect(expectEvaluationError(() => evaluateExpression(truthy, lines))).toStrictEqual({
      code: 'not-a-boolean',
      site: 'filter',
      at: ['where', 0],
      actualType: 'number',
    });
  });

  it('drives a loop node from a filter, without the node having been retyped', () => {
    expect(evaluateSequence(discounted, lines)).toHaveLength(2);
  });

  it('handles 60 000 elements without a RangeError', () => {
    const many = { rows: Array.from({ length: 60_000 }, (_unused, index) => ({ v: index })) };

    expect(evaluateExpression(reduce('max', path('rows'), path('line.v')), many)).toBe(59_999);
    expect(evaluateExpression(reduce('min', path('rows'), path('line.v')), many)).toBe(0);
    expect(evaluateExpression({ kind: 'count', source: path('rows') }, many)).toBe(60_000);
  });

  it('bounds a triply nested aggregate in bounded TIME', () => {
    const rows = { rows: Array.from({ length: 30 }, (_unused, index) => ({ v: index })) };
    const innermost = reduce('sum', path('rows'), path('line.v'));
    const middle = reduce('sum', path('rows'), innermost);
    const outermost = reduce('sum', path('rows'), middle);

    const details = expectEvaluationError(() =>
      evaluateExpression(outermost, rows, { budget: createBudget({ maxItemsVisited: 5_000 }) }),
    );

    expect(details.code).toBe('item-limit-exceeded');
    if (details.code === 'item-limit-exceeded') {
      expect(details.limit).toBe(5_000);
    }
  });

  it('lets an alias shadow a caller key, which is a defined outcome and a documented hole', () => {
    const shadowing: AggregateExpression = {
      kind: 'aggregate',
      op: 'sum',
      source: path('invoice.lines'),
      as: 'invoice',
      value: path('invoice.quantity'),
    };

    expect(evaluateExpression(shadowing, lines)).toBe(7);
  });
});

describe('evaluateSequence', () => {
  const scope = {
    invoice: {
      total: 0,
      lines: [{ sku: 'A' }, { sku: 'B' }],
      missing: undefined,
    },
  };

  it('iterates a list', () => {
    expect(evaluateSequence(path('invoice.lines'), scope)).toHaveLength(2);
  });

  it('yields no iterations for absent data', () => {
    expect(evaluateSequence(path('invoice.missing'), scope)).toStrictEqual([]);
  });

  it('refuses a value that is present but not a list', () => {
    expect(() => evaluateSequence(path('invoice.total'), scope)).toThrow(/needs a list/);
  });

  it('keeps the loop wording verbatim when no caller is named', () => {
    expect(() => evaluateSequence(path('invoice.total'), scope)).toThrow(
      'A loop needs a list to iterate over, got a number.',
    );
  });

  it('falls back to a neutral subject for a caller that has no wording', () => {
    expect(() => evaluateSequence(path('invoice.total'), scope, { caller: 'condition' })).toThrow(
      /An expression needs a list/,
    );
  });
});

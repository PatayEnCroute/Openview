import { describe, expect, it } from 'vitest';
import { type ExpressionErrorDetails, ExpressionEvaluationError } from '../../../errors.js';
import type {
  DateAddExpression,
  DateDiffExpression,
  EndOfMonthExpression,
  LiteralExpression,
  PathExpression,
  PrintableExpression,
} from '../../types.js';
import { evaluateExpression } from '../evaluate.js';

const path = (p: string): PathExpression => ({ kind: 'path', path: p });
const literal = (value: string | number | boolean | null): LiteralExpression => ({
  kind: 'literal',
  value,
});
const dateAdd = (date: PrintableExpression, days: PrintableExpression): DateAddExpression => ({
  kind: 'dateAdd',
  date,
  days,
});
const dateDiff = (from: PrintableExpression, to: PrintableExpression): DateDiffExpression => ({
  kind: 'dateDiff',
  from,
  to,
});
const endOfMonth = (date: PrintableExpression): EndOfMonthExpression => ({
  kind: 'endOfMonth',
  date,
});

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

describe('civil dates in the algebra', () => {
  const dates = {
    invoice: { issuedOn: '2026-01-31', dueOn: '2026-03-02', bad: '2026-02-30', term: 30 },
    company: { processedOn: '2026-03-10' },
  };

  it('adds days without inventing a month convention', () => {
    expect(evaluateExpression(dateAdd(literal('2026-01-31'), literal(30)), dates)).toBe(
      '2026-03-02',
    );
    expect(evaluateExpression(dateAdd(literal('2024-01-31'), literal(30)), dates)).toBe(
      '2024-03-01',
    );
    expect(evaluateExpression(dateAdd(path('invoice.issuedOn'), path('invoice.term')), dates)).toBe(
      '2026-03-02',
    );
  });

  it('counts days in both directions', () => {
    expect(evaluateExpression(dateDiff(literal('2026-01-01'), literal('2026-03-01')), dates)).toBe(
      59,
    );
    expect(evaluateExpression(dateDiff(literal('2026-03-01'), literal('2026-01-01')), dates)).toBe(
      -59,
    );
    expect(evaluateExpression(dateDiff(literal('2026-01-01'), literal('2026-01-01')), dates)).toBe(
      0,
    );
  });

  it('composes "45 days end of month"', () => {
    expect(evaluateExpression(endOfMonth(dateAdd(literal('2026-01-20'), literal(45))), dates)).toBe(
      '2026-03-31',
    );
    expect(evaluateExpression(endOfMonth(literal('2024-02-05')), dates)).toBe('2024-02-29');
  });

  it('reads the render date as a KEY OF THE SCOPE, under a name Openview never chose', () => {
    const overdue = dateDiff(path('invoice.dueOn'), path('company.processedOn'));

    expect(evaluateExpression(overdue, dates)).toBe(8);
    expect(evaluateExpression(overdue, { ...dates, company: { processedOn: '2026-03-20' } })).toBe(
      18,
    );
    expect(evaluateExpression(overdue, { invoice: dates.invoice, company: {} })).toBeUndefined();
  });

  it('names the CALLING operator on a bad date, not always dateAdd', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateAdd(path('invoice.bad'), literal(1)), dates),
      ),
    ).toStrictEqual({ code: 'not-a-date', site: 'dateAdd', at: ['date'], actualType: 'string' });
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateDiff(literal('2026-01-01'), path('invoice.bad')), dates),
      ),
    ).toStrictEqual({ code: 'not-a-date', site: 'dateDiff', at: ['to'], actualType: 'string' });
    expect(
      expectEvaluationError(() => evaluateExpression(endOfMonth(path('invoice.bad')), dates)),
    ).toStrictEqual({ code: 'not-a-date', site: 'endOfMonth', at: ['date'], actualType: 'string' });
  });

  it('refuses a date that is not text at all', () => {
    expect(
      expectEvaluationError(() => evaluateExpression(endOfMonth(literal(20_260_131)), dates)),
    ).toStrictEqual({
      code: 'operand-type',
      site: 'endOfMonth',
      at: ['date'],
      actualType: 'number',
    });
  });

  it('refuses a shift that is not a whole number of days, with a code of its own', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateAdd(literal('2026-01-31'), literal(1.5)), dates),
      ),
    ).toStrictEqual({
      code: 'not-a-whole-number',
      site: 'dateAdd',
      at: ['days'],
      actualType: 'number',
    });
  });

  it('refuses a shift that leaves the supported range', () => {
    expect(
      expectEvaluationError(() =>
        evaluateExpression(dateAdd(literal('9999-12-31'), literal(1)), dates),
      ),
    ).toStrictEqual({
      code: 'not-a-date',
      site: 'dateAdd',
      at: ['days'],
      actualType: 'number',
    });
  });

  it('propagates absence rather than aborting', () => {
    expect(
      evaluateExpression(dateAdd(path('invoice.missing'), literal(30)), dates),
    ).toBeUndefined();
    expect(
      evaluateExpression(dateAdd(literal('2026-01-31'), path('invoice.missing')), dates),
    ).toBeUndefined();
    expect(evaluateExpression(endOfMonth(path('invoice.missing')), dates)).toBeUndefined();
  });

  it('yields ISO, which is an EXCHANGE form and not a display format', () => {
    expect(evaluateExpression(dateAdd(literal('2026-01-31'), literal(0)), dates)).toBe(
      '2026-01-31',
    );
  });
});

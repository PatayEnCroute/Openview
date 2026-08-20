import { civilDateOf, endOfMonthOf, shiftDay } from '../../civil-date.js';
import { fail } from '../context.js';
import { requireDate, requireDays } from '../guards.js';

/** Evaluates date addition (`date + days`). */
export function evaluateDateAdd(dateRaw: unknown, daysRaw: unknown): string | undefined {
  const from = requireDate(dateRaw, 'dateAdd', ['date']);
  const days = requireDays(daysRaw, 'dateAdd', ['days']);
  if (from === undefined || days === undefined) {
    return undefined;
  }
  const shifted = shiftDay(from, days);
  if (shifted === undefined) {
    return fail(
      { code: 'not-a-date', site: 'dateAdd', at: ['days'], actualType: 'number' },
      'This shift lands outside 0001-01-01 … 9999-12-31, which is the whole range a civil date covers here.',
    );
  }
  return civilDateOf(shifted);
}

/** Evaluates date difference in days (`to - from`). */
export function evaluateDateDiff(fromRaw: unknown, toRaw: unknown): number | undefined {
  const from = requireDate(fromRaw, 'dateDiff', ['from']);
  const to = requireDate(toRaw, 'dateDiff', ['to']);
  return from === undefined || to === undefined ? undefined : to - from;
}

/** Evaluates the last day of the month for an ISO civil date. */
export function evaluateEndOfMonth(dateRaw: unknown): string | undefined {
  const date = requireDate(dateRaw, 'endOfMonth', ['date']);
  return date === undefined ? undefined : civilDateOf(endOfMonthOf(date));
}

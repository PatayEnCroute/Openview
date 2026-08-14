import { describe, expect, it } from 'vitest';
import { civilDateOf, dayNumberOf, endOfMonthOf, shiftDay } from '../civil-date.js';

/**
 * The module is tested for itself and not only through the evaluator, and that is measured
 * rather than a preference: covered only through the evaluator it falls to 91.3% of
 * branches -- one branch of margin above the 90% floor -- and `shiftDay` exercises neither
 * a false `Number.isSafeInteger` nor a range overflow.
 */
function requireDayNumber(value: string): number {
  const dayNumber = dayNumberOf(value);
  if (dayNumber === undefined) {
    throw new Error(`the fixture date ${value} should be valid`);
  }
  return dayNumber;
}

describe('the round trip', () => {
  it('holds for EVERY day number in the supported range', () => {
    // Exhaustive, not sampled. An earlier version stepped by 97 -- about 1% of the range --
    // while its name and its comment both claimed a property, and credited that stride with
    // catching the one real bug in this file: the last term of the year-of-era formula
    // divides by the last day INDEX of an era, not by its length, so reusing the era length
    // was off by one exactly once per era. A fixed stride can miss a once-per-era defect
    // entirely, depending on phase, so the claim was writing a cheque the test could not
    // cash. All 3.65 M day numbers cost well under a second.
    const first = requireDayNumber('0001-01-01');
    const last = requireDayNumber('9999-12-31');
    const mismatches: string[] = [];

    for (let dayNumber = first; dayNumber <= last; dayNumber += 1) {
      const formatted = civilDateOf(dayNumber);
      if (formatted === undefined || dayNumberOf(formatted) !== dayNumber) {
        mismatches.push(`${dayNumber}`);
        if (mismatches.length > 4) {
          break;
        }
      }
    }

    expect(mismatches).toStrictEqual([]);
  }, 30_000);

  it('anchors the origin where the algorithm expects it', () => {
    expect(requireDayNumber('1970-01-01')).toBe(0);
  });

  it('keeps consecutive days one apart, across a month and a year boundary', () => {
    expect(requireDayNumber('2026-03-01') - requireDayNumber('2026-02-28')).toBe(1);
    expect(requireDayNumber('2027-01-01') - requireDayNumber('2026-12-31')).toBe(1);
  });
});

describe('leap years', () => {
  it.each([
    ['2024-02-29', true],
    ['2000-02-29', true],
    ['2025-02-29', false],
    ['1900-02-29', false],
  ])('decides %s as %s without a rule written by hand', (value, valid) => {
    // No leap-year rule and no month-length table live in this file: the March-based year
    // plus the round trip decide all four cases, so there is not one line here that could
    // encode the rule wrongly.
    expect(dayNumberOf(value) !== undefined).toBe(valid);
  });

  it('gives February 29 days in 2024 and 28 in 2025', () => {
    expect(requireDayNumber('2024-03-01') - requireDayNumber('2024-02-01')).toBe(29);
    expect(requireDayNumber('2025-03-01') - requireDayNumber('2025-02-01')).toBe(28);
  });
});

describe('the supported range', () => {
  it('accepts both bounds', () => {
    expect(civilDateOf(requireDayNumber('0001-01-01'))).toBe('0001-01-01');
    expect(civilDateOf(requireDayNumber('9999-12-31'))).toBe('9999-12-31');
  });

  it('pads a year below 1000 rather than emitting three digits', () => {
    expect(civilDateOf(requireDayNumber('0999-03-04'))).toBe('0999-03-04');
    expect(civilDateOf(requireDayNumber('0042-01-09'))).toBe('0042-01-09');
  });

  it('refuses a day number outside the range, or one that is not a whole number', () => {
    expect(civilDateOf(requireDayNumber('0001-01-01') - 1)).toBeUndefined();
    expect(civilDateOf(requireDayNumber('9999-12-31') + 1)).toBeUndefined();
    expect(civilDateOf(0.5)).toBeUndefined();
    expect(civilDateOf(Number.NaN)).toBeUndefined();
  });
});

describe('dayNumberOf', () => {
  it.each([
    '2026-13-01',
    '2026-02-30',
    '2026-1-5',
    '20260105',
    ' 2026-01-05',
    '2026-01-05T00:00:00Z',
    '0000-01-01',
    '',
    '2026-00-15',
    '2026-01-32',
    '2026-01-05 ',
    '+2026-01-05',
  ])('refuses %o', (value) => {
    expect(dayNumberOf(value)).toBeUndefined();
  });

  it('checks the year bound BEFORE converting', () => {
    // The one bound that is not a round trip: both conversions assume a non-negative
    // shifted year, which `0000-01-01` would break -- and `0000-02-01` shifts to -1.
    expect(dayNumberOf('0000-01-01')).toBeUndefined();
    expect(dayNumberOf('0000-02-01')).toBeUndefined();
    expect(dayNumberOf('0000-12-31')).toBeUndefined();
  });
});

describe('shiftDay', () => {
  it('adds and subtracts whole days', () => {
    expect(civilDateOf(requireDayNumber('2026-01-31') + 30)).toBe('2026-03-02');
    expect(shiftDay(requireDayNumber('2026-01-31'), 30)).toBe(requireDayNumber('2026-03-02'));
    expect(shiftDay(requireDayNumber('2024-01-31'), 30)).toBe(requireDayNumber('2024-03-01'));
    expect(shiftDay(requireDayNumber('2026-03-02'), -30)).toBe(requireDayNumber('2026-01-31'));
    expect(shiftDay(requireDayNumber('2026-01-05'), 0)).toBe(requireDayNumber('2026-01-05'));
  });

  it('refuses a shift that is not a whole number of days', () => {
    const start = requireDayNumber('2026-01-05');
    expect(shiftDay(start, 1.5)).toBeUndefined();
    expect(shiftDay(start, Number.NaN)).toBeUndefined();
    expect(shiftDay(start, Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(shiftDay(start, 2 ** 53)).toBeUndefined();
  });

  it('refuses a shift that leaves the supported range at either end', () => {
    expect(shiftDay(requireDayNumber('0001-01-01'), -1)).toBeUndefined();
    expect(shiftDay(requireDayNumber('9999-12-31'), 1)).toBeUndefined();
    expect(shiftDay(requireDayNumber('2026-01-05'), 4_000_000)).toBeUndefined();
  });

  it('refuses an unusable DAY NUMBER, not just an unusable shift', () => {
    // These are public barrel exports, so an integrator can reach them, and an earlier
    // version validated only `days`: `NaN < MIN` and `NaN > MAX` are both false, so the range
    // test was inert and `shiftDay(NaN, 0)` returned `NaN`.
    expect(shiftDay(Number.NaN, 0)).toBeUndefined();
    expect(shiftDay(0.5, 1)).toBeUndefined();
    expect(shiftDay(Number.POSITIVE_INFINITY, 0)).toBeUndefined();
    expect(shiftDay(requireDayNumber('9999-12-31') + 1, 0)).toBeUndefined();
  });
});

describe('endOfMonthOf', () => {
  it('finds the last day of a month, leap February included', () => {
    const endOf = (value: string): string | undefined =>
      civilDateOf(endOfMonthOf(requireDayNumber(value)));

    expect(endOf('2024-02-05')).toBe('2024-02-29');
    expect(endOf('2025-02-05')).toBe('2025-02-28');
    expect(endOf('2026-04-01')).toBe('2026-04-30');
    expect(endOf('2026-01-31')).toBe('2026-01-31');
  });

  it('rolls the year over in DECEMBER', () => {
    // The branch that stays uncovered when the module is only exercised through the
    // evaluator: December is the one month whose successor is in the next year.
    expect(civilDateOf(endOfMonthOf(requireDayNumber('2026-12-05')))).toBe('2026-12-31');
    expect(civilDateOf(endOfMonthOf(requireDayNumber('2026-12-31')))).toBe('2026-12-31');
  });

  it('stays inside the range at the very last month it supports', () => {
    expect(civilDateOf(endOfMonthOf(requireDayNumber('9999-12-01')))).toBe('9999-12-31');
  });

  it('refuses an unusable day number instead of FABRICATING a date', () => {
    // The worst of the two symptoms this closes. Unvalidated, `endOfMonthOf(0.5)` returned 30,
    // which formats as '1970-01-31' -- a real, plausible date silently derived from a nonsense
    // input, which an integrator would have printed.
    expect(endOfMonthOf(0.5)).toBeUndefined();
    expect(endOfMonthOf(0.9)).toBeUndefined();
    expect(endOfMonthOf(-0.5)).toBeUndefined();
    expect(endOfMonthOf(Number.NaN)).toBeUndefined();
    expect(endOfMonthOf(requireDayNumber('9999-12-31') + 1)).toBeUndefined();
    // And the composition stays safe end to end.
    expect(civilDateOf(endOfMonthOf(0.5))).toBeUndefined();
  });

  it('composes with a shift, which is how "45 days end of month" is written', () => {
    // The usage that made `addMonths` unnecessary: "31 January + 1 month" is a convention,
    // "end of the month of X" is a calculation.
    const shifted = shiftDay(requireDayNumber('2026-01-20'), 45);
    if (shifted === undefined) {
      throw new Error('the shift should have stayed in range');
    }
    expect(civilDateOf(endOfMonthOf(shifted))).toBe('2026-03-31');
  });
});

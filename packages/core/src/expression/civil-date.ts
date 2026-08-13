/**
 * Civil-date arithmetic, on integers, with no `Date` and no `Intl` anywhere in sight.
 *
 * ## Why a module rather than three calls to `Date`
 *
 * The benefit is not performance -- it is that "core reads nothing from its environment"
 * becomes VERIFIABLE instead of being entrusted to a reviewer's vigilance. Three classic
 * traps are not avoided here, they are made **unreachable**:
 *
 * - `new Date(y, m, d)` builds in the HOST time zone, so the same three numbers denote two
 *   different instants in Auckland and in Los Angeles;
 * - `Intl` and the local `Date` getters depend on the engine's ICU version and on the host
 *   zone;
 * - `new Date(someString)` is only specified for the ISO form; anywhere else the result is
 *   engine-dependent.
 *
 * A render that reads the machine cannot produce the same document twice (roadmap E6), and
 * that is the whole reason this file exists.
 *
 * ## What a date IS here
 *
 * A string `YYYY-MM-DD`, proleptic Gregorian, no time and no zone, bounded
 * `0001-01-01 … 9999-12-31`. It is a representation of EXCHANGE, not a display format: a
 * template that prints it prints ISO, and turning that into `31/03/2026` belongs to lot
 * C6, at the same seam as the stringification of numbers.
 *
 * ## The validation IS the round trip
 *
 * `daysFromCivil` then `civilFromDays`, then compare the three components. `2026-02-30`,
 * `2025-02-29`, `2026-13-01` and `2026-02-00` all fall there -- **with no month-length
 * table and no leap-year rule written by hand**, therefore with not one line that could be
 * wrong. The algorithm is Howard Hinnant's *days_from_civil* / *civil_from_days*.
 */

/** Days since 1970-01-01. The epoch is an arbitrary origin here, not a clock. */
const EPOCH_SHIFT = 719_468;

/** Days in a 400-year era: 400 * 365 + 97 leap days. */
const DAYS_PER_ERA = 146_097;

/**
 * `DAYS_PER_ERA - 1`, and it is NOT interchangeable with it.
 *
 * The last term of the year-of-era formula divides by the LAST DAY INDEX of an era, not by
 * its length. Reusing `DAYS_PER_ERA` there is off by one exactly once per era -- caught in
 * this file's development by `2000-02-29`, a legal leap day (divisible by 400) that came
 * back rejected, and by one mismatch in a round-trip sweep of the whole supported range.
 * Both symptoms are silent everywhere else, which is why the constant is named rather than
 * inlined.
 */
const LAST_DAY_OF_ERA = DAYS_PER_ERA - 1;

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

/**
 * Integer division, truncating.
 *
 * Hinnant's C++ guards the negative case (`y >= 0 ? y : y - 399`). That branch is
 * unreachable here and deliberately absent: the year is bounded at 1 before either
 * conversion runs, so the shifted year is never negative -- and an unreachable branch in a
 * calendar routine is a branch nobody can test.
 */
function div(numerator: number, denominator: number): number {
  return Math.floor(numerator / denominator);
}

function daysFromCivil(year: number, month: number, day: number): number {
  // March-based year: February's length stops being a special case, which is the whole
  // trick that removes the leap-year rule from this file.
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = div(shiftedYear, 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = div(153 * (month + (month > 2 ? -3 : 9)) + 2, 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + div(yearOfEra, 4) - div(yearOfEra, 100) + dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - EPOCH_SHIFT;
}

interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function civilFromDays(dayNumber: number): CivilDate {
  const shifted = dayNumber + EPOCH_SHIFT;
  const era = div(shifted, DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = div(
    dayOfEra - div(dayOfEra, 1460) + div(dayOfEra, 36_524) - div(dayOfEra, LAST_DAY_OF_ERA),
    365,
  );
  const shiftedYear = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + div(yearOfEra, 4) - div(yearOfEra, 100));
  const marchMonth = div(5 * dayOfYear + 2, 153);
  const day = dayOfYear - div(153 * marchMonth + 2, 5) + 1;
  const month = marchMonth + (marchMonth < 10 ? 3 : -9);
  return { year: month <= 2 ? shiftedYear + 1 : shiftedYear, month, day };
}

const MIN_DAY_NUMBER = daysFromCivil(MIN_YEAR, 1, 1);
const MAX_DAY_NUMBER = daysFromCivil(MAX_YEAR, 12, 31);

/**
 * Exactly ten digits and two hyphens.
 *
 * `slice` rather than capture groups, and that is a coverage decision as much as a style
 * one: under `noUncheckedIndexedAccess`, `matched[1]` is `string | undefined`, so reading a
 * group needs a guard that never fires at runtime -- a dead branch that would drag the
 * branch-coverage floor down.
 */
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The day number of a `YYYY-MM-DD` string, or `undefined` if it is not one.
 *
 * `undefined` rather than a throw, because the two callers want different things from a
 * refusal: the Zod refinement wants a boolean at save time, and the evaluator wants to
 * raise its own typed error at render time.
 */
export function dayNumberOf(value: string): number | undefined {
  if (!CIVIL_DATE_PATTERN.test(value)) {
    return undefined;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  // Checked BEFORE the conversion, and it is the one bound that is not a round trip: the
  // conversions assume a non-negative shifted year, which `0000-01-01` would break.
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return undefined;
  }

  const dayNumber = daysFromCivil(year, month, day);
  const roundTrip = civilFromDays(dayNumber);
  if (roundTrip.year !== year || roundTrip.month !== month || roundTrip.day !== day) {
    return undefined;
  }
  return dayNumber;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * A day number this module will act on: a whole number inside the supported range.
 *
 * Every public function validates its day-number argument through this, and that is a fix
 * rather than a flourish. `shiftDay` used to check only `days`, and `endOfMonthOf` checked
 * nothing, so a fractional day number did not merely produce `NaN` -- it TRUNCATED into a
 * plausible wrong date: `endOfMonthOf(0.5)` returned 30, which formats as `'1970-01-31'`.
 * `NaN` slipped through too, because `NaN < MIN` and `NaN > MAX` are both false, leaving
 * the range test inert. The evaluator never reaches those paths, since `requireDate` only
 * ever yields an in-range safe integer -- which is exactly why the tests, which only varied
 * `days`, missed them. These are public barrel exports; an integrator can reach them.
 */
function isDayNumber(dayNumber: number | undefined): dayNumber is number {
  return (
    dayNumber !== undefined &&
    Number.isSafeInteger(dayNumber) &&
    dayNumber >= MIN_DAY_NUMBER &&
    dayNumber <= MAX_DAY_NUMBER
  );
}

/**
 * The `YYYY-MM-DD` form of a day number, or `undefined` outside the supported range.
 *
 * Accepts `undefined` so it composes with the functions below without every caller needing
 * its own guard: an absent day number has no civil form either.
 */
export function civilDateOf(dayNumber: number | undefined): string | undefined {
  if (!isDayNumber(dayNumber)) {
    return undefined;
  }
  const { year, month, day } = civilFromDays(dayNumber);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * A whole number of days later, or `undefined` if either argument is not a whole number of
 * days or the result lands outside the supported range.
 */
export function shiftDay(dayNumber: number, days: number): number | undefined {
  if (!isDayNumber(dayNumber) || !Number.isSafeInteger(days)) {
    return undefined;
  }
  const shifted = dayNumber + days;
  return shifted < MIN_DAY_NUMBER || shifted > MAX_DAY_NUMBER ? undefined : shifted;
}

/**
 * The last day of the month a day number falls in.
 *
 * Computed as "the first of the next month, minus one day", so February's length and the
 * leap-year rule stay out of this file. It is also the whole reason `addMonths` is refused
 * by the algebra: "31 January + 1 month" is a CONVENTION -- 28? 29? 3 March? -- while "end
 * of the month of X" is a calculation. `endOfMonth(dateAdd(d, 45))` covers "45 days end of
 * month" without ever opening that door.
 */
export function endOfMonthOf(dayNumber: number): number | undefined {
  if (!isDayNumber(dayNumber)) {
    return undefined;
  }
  const { year, month } = civilFromDays(dayNumber);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return daysFromCivil(nextYear, nextMonth, 1) - 1;
}

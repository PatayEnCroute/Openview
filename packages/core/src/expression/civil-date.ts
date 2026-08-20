/**
 * Pure integer civil-date arithmetic for ISO dates (YYYY-MM-DD) without Date/Intl environment reads.
 * Based on Howard Hinnant's civil_from_days / days_from_civil algorithm.
 */

const EPOCH_SHIFT = 719_468;
const DAYS_PER_ERA = 146_097;
const LAST_DAY_OF_ERA = DAYS_PER_ERA - 1;

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

function div(numerator: number, denominator: number): number {
  return Math.floor(numerator / denominator);
}

function daysFromCivil(year: number, month: number, day: number): number {
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

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the epoch day number for a valid YYYY-MM-DD string, or undefined otherwise.
 */
export function dayNumberOf(value: string): number | undefined {
  if (!CIVIL_DATE_PATTERN.test(value)) {
    return undefined;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

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

function isDayNumber(dayNumber: number | undefined): dayNumber is number {
  return (
    dayNumber !== undefined &&
    Number.isSafeInteger(dayNumber) &&
    dayNumber >= MIN_DAY_NUMBER &&
    dayNumber <= MAX_DAY_NUMBER
  );
}

/**
 * Converts an epoch day number into an ISO YYYY-MM-DD string, or undefined if out of range.
 */
export function civilDateOf(dayNumber: number | undefined): string | undefined {
  if (!isDayNumber(dayNumber)) {
    return undefined;
  }
  const { year, month, day } = civilFromDays(dayNumber);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * Shifts a day number by an integer number of days, returning undefined if out of range.
 */
export function shiftDay(dayNumber: number, days: number): number | undefined {
  if (!isDayNumber(dayNumber) || !Number.isSafeInteger(days)) {
    return undefined;
  }
  const shifted = dayNumber + days;
  return shifted < MIN_DAY_NUMBER || shifted > MAX_DAY_NUMBER ? undefined : shifted;
}

/**
 * Returns the day number corresponding to the end of the month for the given day number.
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

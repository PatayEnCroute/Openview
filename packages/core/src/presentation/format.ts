import { dayNumberOf } from '../expression/civil-date.js';
import type { Presentation } from './types.js';

const MS_PER_DAY = 86_400_000;

function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Formats a finite numeric amount as currency using the declared presentation writing.
 * Returns undefined if value is not finite.
 */
export function formatMoney(value: number, writing: Presentation): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return new Intl.NumberFormat(writing.locale, {
    style: 'currency',
    currency: writing.currency,
    numberingSystem: 'latn',
    minimumFractionDigits: writing.minFractionDigits,
    maximumFractionDigits: writing.maxFractionDigits,
  }).format(withoutNegativeZero(value));
}

/**
 * Formats a finite numeric amount as a plain decimal quantity using the declared presentation writing.
 * Returns undefined if value is not finite.
 */
export function formatDecimal(value: number, writing: Presentation): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return new Intl.NumberFormat(writing.locale, {
    numberingSystem: 'latn',
    minimumFractionDigits: writing.minFractionDigits,
    maximumFractionDigits: writing.maxFractionDigits,
  }).format(withoutNegativeZero(value));
}

/**
 * Formats an ISO civil date (YYYY-MM-DD) according to the declared presentation dateStyle.
 * Returns undefined if the value is not a valid ISO civil date.
 */
export function formatDate(value: string, writing: Presentation): string | undefined {
  const dayNumber = dayNumberOf(value);
  if (dayNumber === undefined) {
    return undefined;
  }
  return new Intl.DateTimeFormat(writing.locale, {
    timeZone: 'UTC',
    calendar: 'gregory',
    numberingSystem: 'latn',
    dateStyle: writing.dateStyle,
  }).format(dayNumber * MS_PER_DAY);
}

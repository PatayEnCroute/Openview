import type { RoundMode } from '../../types.js';
import { requireFiniteResult, requireNumber } from '../guards.js';

function digitAt(text: string, index: number): number {
  return Number(text[index]);
}

function increment(digits: string): string {
  let cursor = digits.length;
  while (cursor > 0 && digits[cursor - 1] === '9') {
    cursor -= 1;
  }
  if (cursor === 0) {
    return `1${'0'.repeat(digits.length)}`;
  }
  const raised = digitAt(digits, cursor - 1) + 1;
  return `${digits.slice(0, cursor - 1)}${raised}${'0'.repeat(digits.length - cursor)}`;
}

function hasNonZero(digits: string, from: number): boolean {
  for (let index = from; index < digits.length; index += 1) {
    if (digits[index] !== '0') {
      return true;
    }
  }
  return false;
}

function exponentOf(shortest: string, marker: number): number {
  const negative = shortest[marker + 1] === '-';
  let magnitude = 0;
  for (let index = marker + 2; index < shortest.length; index += 1) {
    magnitude = magnitude * 10 + digitAt(shortest, index);
  }
  return negative ? -magnitude : magnitude;
}

function goesUp(mode: RoundMode, first: number, restNonZero: boolean, lastKept: number): boolean {
  if (first !== 5) {
    return first > 5;
  }
  if (restNonZero) {
    return true;
  }
  switch (mode) {
    case 'halfExpand':
      return true;
    case 'halfEven':
      return lastKept % 2 === 1;
    default: {
      const exhaustive: never = mode;
      throw new TypeError(`Unhandled rounding mode: ${String(exhaustive)}`);
    }
  }
}

function keptDigits(digits: string, drop: number, mode: RoundMode): string {
  if (drop >= digits.length) {
    const adjacent = drop === digits.length;
    const first = adjacent ? digitAt(digits, 0) : 0;
    const restNonZero = adjacent ? hasNonZero(digits, 1) : true;
    return goesUp(mode, first, restNonZero, 0) ? '1' : '0';
  }
  const cut = digits.length - drop;
  const kept = digits.slice(0, cut);
  const up = goesUp(
    mode,
    digitAt(digits, cut),
    hasNonZero(digits, cut + 1),
    digitAt(digits, cut - 1),
  );
  return up ? increment(kept) : kept;
}

/**
 * Rounds a numeric value at the declared decimal position using the specified mode,
 * operating on the shortest canonical decimal representation.
 */
export function roundDecimal(value: number, decimals: number, mode: RoundMode): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value === 0) {
    return 0;
  }
  if (decimals >= 0 && Number.isInteger(value)) {
    return value;
  }
  const shortest = Math.abs(value).toExponential();
  const marker = shortest.indexOf('e');
  const digitCount = shortest[1] === '.' ? marker - 1 : marker;
  const drop = digitCount - 1 - exponentOf(shortest, marker) - decimals;
  if (drop <= 0) {
    return value;
  }
  const digits = shortest.slice(0, marker).replace('.', '');
  const sign = value < 0 ? '-' : '';
  const rounded = Number(`${sign}${keptDigits(digits, drop, mode)}e${-decimals}`);
  return rounded === 0 ? 0 : rounded;
}

/**
 * Evaluates a rounding operation on a raw operand, validating numeric type and result finiteness.
 */
export function evaluateRound(raw: unknown, decimals: number, mode: RoundMode): number | undefined {
  const value = requireNumber(raw, 'round', ['value']);
  if (value === undefined) {
    return undefined;
  }
  return requireFiniteResult(roundDecimal(value, decimals, mode), 'round', []);
}

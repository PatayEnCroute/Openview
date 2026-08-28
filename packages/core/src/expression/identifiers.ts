import { z } from 'zod/v4';

/** Regular expression source for JavaScript identifier validation. */
export const IDENTIFIER_SOURCE = String.raw`[A-Za-z_$][\w$]*`;

/** Regular expression pattern matching a single valid identifier. */
export const IDENTIFIER_PATTERN = new RegExp(`^${IDENTIFIER_SOURCE}$`);

/** Regular expression pattern matching a dotted property path. */
export const PATH_PATTERN = new RegExp(String.raw`^${IDENTIFIER_SOURCE}(\.${IDENTIFIER_SOURCE})*$`);

/** Set of identifiers forbidden due to Object.prototype pollution risks. */
export const FORBIDDEN_IDENTIFIERS: ReadonlySet<string> = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  'prototype',
]);

/** Validates that a string is a valid identifier and does not collide with Object prototype properties. */
export function isIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value) && !FORBIDDEN_IDENTIFIERS.has(value);
}

/** Zod schema for scope alias names (in loops, filters, and aggregations). */
export const aliasSchema = z
  .string()
  .refine(
    isIdentifier,
    'An alias must be a single identifier, and may not be __proto__, constructor or prototype',
  );

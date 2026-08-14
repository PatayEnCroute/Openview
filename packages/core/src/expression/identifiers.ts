import { z } from 'zod/v4';

/**
 * A single identifier: the atom a dotted path is built from, and the shape an alias
 * must take as well (ADR 0002, ADR 0003). One rule, now THREE call sites -- a loop's
 * alias, an aggregation's and a filter's -- and a second copy of the list below would
 * eventually drift from this one, with the copy that forgot a name being the hole.
 *
 * The character classes live in a string so the whole-path pattern can be
 * composed from the same source rather than restating them. That keeps one rule
 * for both call sites and validates a path with one regex pass over the whole
 * string, rather than one per segment.
 *
 * The forbidden set is **derived** from `Object.prototype` instead of listed, so
 * it cannot fall behind: a three-name list left `toString`, `valueOf`,
 * `hasOwnProperty` and the rest accepted. Note what does and does not make this
 * a security boundary -- the prototype chain is closed off by `resolvePath`,
 * which reads own enumerable properties only, not by this set. Two reasons
 * remain to reject the names at save time:
 *
 * - a path segment naming an inherited member (`invoice.toString`) is a template
 *   bug, and saying so when the template is saved beats resolving to nothing when
 *   a document renders;
 * - an alias becomes a key of the evaluation scope, so an alias named `toString`
 *   would install data over a method every JavaScript consumer assumes exists, and
 *   `String(scope)` would throw.
 */
export const IDENTIFIER_SOURCE = String.raw`[A-Za-z_$][\w$]*`;
export const IDENTIFIER_PATTERN = new RegExp(`^${IDENTIFIER_SOURCE}$`);
export const PATH_PATTERN = new RegExp(String.raw`^${IDENTIFIER_SOURCE}(\.${IDENTIFIER_SOURCE})*$`);

export const FORBIDDEN_IDENTIFIERS: ReadonlySet<string> = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  'prototype',
]);

/** The rule every alias obeys too, so no schema can drift from it. */
export function isIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value) && !FORBIDDEN_IDENTIFIERS.has(value);
}

/**
 * The shape of a scope-binding name, hoisted out of `nodes.ts` because ADR 0003 gives
 * it two more call sites. This is the moment the rule factors out, or else it diverges.
 *
 * Not re-exported from the package barrel, for the reason ADR 0002 already gave about
 * `isIdentifier`: `LoopNodeSchema.shape.as` is what a Designer validates a keystroke
 * against, so a second export would serve nobody.
 */
export const aliasSchema = z
  .string()
  .refine(
    isIdentifier,
    'An alias must be a single identifier, and may not be __proto__, constructor or prototype',
  );

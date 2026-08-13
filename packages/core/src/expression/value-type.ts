/**
 * The closed vocabulary an error says a value WAS, without ever saying WHICH value
 * it was (ADR 0003, decision 7).
 *
 * An earlier design carried the offending value itself, truncated, in a `sample`
 * field, and closed the obvious objection with a clause about who reads it -- "the
 * Designer displays it, and its reader is the template author". That is false in this
 * package's own threat model: the template author *is* the attacker, and the data
 * belongs to the host application.
 *
 * The criterion that replaced it is not "the error channel leaks" either. An author
 * who can write `dateAdd(customer.apiToken, 0)` can just as well print
 * `customer.apiToken` in a text binding. What separates the two is WHERE they go: an
 * error payload travels to the operator, to the log the engine owes (roadmap E8) and
 * to the render service's HTTP response -- three places the document never reaches.
 * Hence the rule:
 *
 *   **An error payload must stay safe to log even when the document is not.**
 *
 * Every tag below is derived from the value's SHAPE -- nullness, `Array.isArray`,
 * `typeof`, finiteness -- and never from its contents. That turns the rule from
 * something a reviewer must watch into something the type enforces: `describe()`
 * takes an `ExpressionValueType`, so a render value cannot reach a message even by
 * accident. A second problem falls out for free -- a message can no longer be 10 MB
 * because the datum was.
 *
 * `not-finite` is a tag of its own rather than a flavour of `number`, and that
 * distinction is load-bearing: the arithmetic policy raises `not-finite` where it
 * raises `operand-type` for a wrong *shape*, so a payload whose code is `not-finite`
 * would otherwise contradict its own `actualType`.
 */
export const EXPRESSION_VALUE_TYPES = [
  'absent',
  'string',
  'number',
  'not-finite',
  'boolean',
  'list',
  'object',
  'function',
  'unsupported',
] as const;

export type ExpressionValueType = (typeof EXPRESSION_VALUE_TYPES)[number];

/**
 * Reads a value's tag. Total by construction, and it never touches the value's
 * contents -- no key is enumerated, no element is read, no accessor is invoked.
 *
 * `unsupported` covers `bigint` and `symbol`. Neither survives `JSON.parse`, but a
 * `structuredClone` carries a BigInt and a hand-built scope can carry either, so the
 * function has to name them rather than fall through. Naming them separately would
 * add two constants that no message distinguishes usefully: the algebra has no
 * operation for either, and that is the whole of what an author needs to be told.
 */
export function valueTypeOf(value: unknown): ExpressionValueType {
  if (value === null || value === undefined) {
    return 'absent';
  }
  // Before the `typeof` switch: an array reports `object`, and a template author who
  // is told "an object" when they passed a list learns nothing.
  if (Array.isArray(value)) {
    return 'list';
  }
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      // The one tag that is not a `typeof`: NaN and the infinities are numbers to
      // JavaScript and faults to a document engine.
      return Number.isFinite(value) ? 'number' : 'not-finite';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    case 'function':
      return 'function';
    default:
      return 'unsupported';
  }
}

/**
 * Names the discriminant of a value that reached an exhaustiveness branch, for the
 * `TypeError` those branches raise.
 *
 * It replaces `JSON.stringify(exhaustive)`, which turned the exhaustiveness guard into a
 * SECOND crash: measured, `JSON.stringify` overflows the stack around 8 000 levels of
 * nesting, so the deep payload that reached the branch would blow up while being
 * described.
 *
 * This one function is allowed to read a property where {@link valueTypeOf} is not, and
 * the distinction is worth stating. `valueTypeOf` feeds an error payload that travels to
 * logs, so it must never touch render data. This reads exactly one property -- the
 * discriminant of a TEMPLATE node -- and feeds a `TypeError` about template structure. A
 * kind is what the operator is called, not what the document is about.
 */
export function kindOf(value: unknown, discriminant: string): string {
  if (value === null || typeof value !== 'object') {
    return valueTypeOf(value);
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, discriminant);
  if (descriptor === undefined || !('value' in descriptor)) {
    // No own data property under that name -- including the accessor case, which must not
    // be invoked here any more than in the shape guard.
    return valueTypeOf(value);
  }
  const found: unknown = descriptor.value;
  return typeof found === 'string' ? found : valueTypeOf(found);
}

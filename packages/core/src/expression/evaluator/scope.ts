/**
 * The data a template is rendered against: the integrating application's own
 * dataset, under the names it chose.
 *
 * `Record<string, unknown>` is the contract, not a placeholder for a schema still
 * to be written. Openview reserves no key here and expects no particular shape --
 * a template reads the paths its author picked, and nothing in core knows what
 * they mean. The one name Openview ever adds to this namespace is an alias declared
 * by the template -- a loop's (see {@link childScope}) or, since ADR 0003, an
 * aggregation's or a filter's -- never one the engine invents.
 *
 * Nothing is injected either: no `now`, no *system* locale, no ambient context.
 * "Today" is a datum like any other, supplied by the caller under whatever name it
 * likes -- language and currency, by contrast, are declared by the template (C6).
 * That is not a naming convention -- it falls out of the determinism the engine
 * owes (roadmap engine, E6): an evaluator that reads the clock cannot render the
 * same document twice.
 */
export type EvaluationScope = Readonly<Record<string, unknown>>;

/**
 * Resolves a dotted path, returning `undefined` for anything absent along the way.
 *
 * Whether a missing value renders blank or aborts the document is deliberately
 * NOT decided here: @openview/core reports absence, and the render pipeline
 * applies policy. See the open question in ADR 0001.
 *
 * **Own enumerable properties only**, which is exactly the set {@link childScope}
 * copies. `Reflect.get` on its own walks the prototype chain and ignores
 * enumerability, and that had two consequences: `invoice.toString` resolved to a
 * function, which a text binding would print into a document; and a scope key
 * that was inherited or non-enumerable resolved outside a loop and vanished
 * inside one, because the resolver and the scope builder disagreed on what "in
 * scope" means. They now agree. A getter is still honoured -- it is an own
 * enumerable property when declared as one.
 */
export function resolvePath(path: string, scope: EvaluationScope): unknown {
  let current: unknown = scope;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(current, segment);
    if (descriptor === undefined || !descriptor.enumerable) {
      return undefined;
    }
    // Read through Reflect.get rather than descriptor.value: an accessor has to
    // be invoked, and Reflect.get keeps `current` typed as `object` without an
    // assertion.
    current = Reflect.get(current, segment);
  }
  return current;
}

/**
 * The scope a loop's children -- or an aggregation's value expression -- are evaluated
 * in: the enclosing scope, plus the current item bound to the declared alias (ADR
 * 0002, option B1).
 *
 * The counterpart of `evaluateSequence` -- that one yields the items, this
 * one makes an item readable. Without it a loop could iterate and its children
 * could see nothing, which is where @openview/core stood before ADR 0002. ADR 0003
 * reuses it unchanged for `aggregate` and `filter`: no second scope primitive, no
 * reserved name, and no new shadowing *mechanism*.
 *
 * Shadowing is lexical and the innermost binding wins; it falls out of the spread.
 * Two nested loops sharing an alias therefore produce a *defined* result rather
 * than an ambiguous one, which is why no validation pass forbids the collision.
 *
 * The derived scope carries the parent's own enumerable keys plus the alias --
 * exactly the set `resolvePath` reads, which is what keeps the two in agreement.
 * Note that the spread *invokes* any accessor among those keys, once per
 * iteration: a scope built from getters pays for all of them at every loop entry,
 * and a getter that throws aborts at loop entry rather than at the read site. Pass
 * plain data if that matters. `Object.create(parent)` would be O(1) but would
 * resolve the parent's keys through the prototype chain, which `resolvePath`
 * deliberately refuses to read.
 */
export function childScope(parent: EvaluationScope, alias: string, item: unknown): EvaluationScope {
  // A computed key defines an own property, unlike the literal `{ __proto__: x }`
  // form, so an alias cannot reassign the prototype even if one slipped through.
  return { ...parent, [alias]: item };
}

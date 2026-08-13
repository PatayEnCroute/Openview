import {
  type ExpressionErrorDetails,
  type ExpressionErrorSite,
  ExpressionEvaluationError,
} from '../errors.js';
import type { ComparisonOperator, Expression } from './expression.js';
import { type ExpressionValueType, valueTypeOf } from './value-type.js';

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
 * Options every entry point accepts.
 *
 * An options bag rather than a third positional parameter, because `evaluatePredicate`
 * and `evaluateSequence` need a second thing (`caller`) and three functions whose
 * third parameter has three different shapes is the asymmetry a caller fills in wrong.
 * Both fields are optional, so existing two-argument calls keep compiling.
 */
export interface EvaluationOptions {
  /**
   * The site to report when this call itself fails, for the two positions that carry
   * an expression without being one. Defaults to `'condition'` for a predicate and
   * `'loop'` for a sequence -- the node positions those entry points were written
   * for.
   */
  readonly caller?: ExpressionErrorSite | undefined;
}

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
function resolvePath(path: string, scope: EvaluationScope): unknown {
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

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Prose for a value's tag, and it takes the TAG rather than the value on purpose:
 * that is what makes "no message ever contains render data" a property of the type
 * instead of a rule a reviewer has to remember (ADR 0003, decision 7).
 *
 * A total `Record` rather than a `switch`: TypeScript then refuses a missing tag, and
 * there is no branch to cover for a mapping that has no logic.
 *
 * Two wordings changed with ADR 0003, both deliberate and neither asserted by a test:
 * a list is `a list` and no longer `an array`, and `NaN` stops being described as
 * `a number`.
 */
const VALUE_DESCRIPTIONS: Readonly<Record<ExpressionValueType, string>> = {
  absent: 'nothing',
  string: 'a string',
  number: 'a number',
  'not-finite': 'a number that is not finite',
  boolean: 'a boolean',
  list: 'a list',
  object: 'an object',
  function: 'a function',
  unsupported: 'an unsupported value',
};

function describe(type: ExpressionValueType): string {
  return VALUE_DESCRIPTIONS[type];
}

/**
 * The one place this module raises an {@link ExpressionEvaluationError}.
 *
 * Everything that could throw funnels through here, and that is a structural claim
 * rather than a tidiness one: the machine payload has two required fields, `site` and
 * `at`, that only the evaluator knows. A helper that raised on its own -- a budget
 * counter, say -- would either invent them or throw a different error class, which the
 * descent wrapper below rethrows without ever prefixing its path. So counters return a
 * boolean and their caller comes here.
 *
 * The `never` branches of the two `switch` statements are the one exception, and they
 * are a different failure: a `TypeError` for a value that bypassed Zod entirely, not a
 * template that asked for something impossible.
 */
function fail(details: ExpressionErrorDetails, message: string): never {
  throw new ExpressionEvaluationError(message, details);
}

/**
 * Prefixes the path of a propagating failure with the position that was descended
 * into, and rethrows the same object.
 *
 * Wrapping only the "binding" forms was considered and rejected: it leaves
 * `add(mul(a, b), c)` ambiguous, because both multiplications sit at the same reported
 * position.
 */
function prefixing<TResult>(at: readonly (string | number)[], descend: () => TResult): TResult {
  try {
    return descend();
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      // Innermost segment first, so the accumulated path stays reversed: `at` is
      // read back-to-front for that reason, through a copy rather than an index,
      // which `noUncheckedIndexedAccess` would type as possibly undefined.
      for (const segment of [...at].reverse()) {
        error.prefix(segment);
      }
    }
    // Enriching a typed error and rethrowing it is not swallowing it (AGENTS.md 1.3):
    // nothing is caught and dropped, and the original object reaches the caller.
    throw error;
  }
}

/**
 * The single point every descent into a sub-expression goes through.
 *
 * One wrapper rather than a `try` per branch, and it is also where the evaluation
 * budget will be spent (ADR 0003, decision 8): a depth that rises on the way in and
 * falls on the way out has to be counted somewhere that every descent passes.
 */
function evaluateWithin(
  expression: Expression,
  at: readonly (string | number)[],
  scope: EvaluationScope,
): unknown {
  return prefixing(at, () => evaluateExpression(expression, scope));
}

/**
 * The boolean check, without the descent -- so an operand of `logical` can be
 * evaluated at its own position and then checked at that same position.
 *
 * JavaScript truthiness is refused on purpose: it would make `{ path: 'total' }` false
 * for a total of 0, and an invoice silently dropping a zero line is exactly the class
 * of bug a document engine must not have.
 *
 * Absent data is the one exception: null and undefined read as false, so a condition
 * on a field that was never supplied hides its branch instead of aborting the render.
 */
function requireBoolean(
  value: unknown,
  site: ExpressionErrorSite,
  at: readonly (string | number)[],
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) {
    return false;
  }
  return fail(
    { code: 'not-a-boolean', site, at, actualType: valueTypeOf(value) },
    `A condition must evaluate to a boolean, got ${describe(valueTypeOf(value))}. Wrap it in isEmpty, not, or a comparison instead of relying on truthiness.`,
  );
}

function compare(
  op: ComparisonOperator,
  left: unknown,
  right: unknown,
  site: ExpressionErrorSite,
): boolean {
  if (op === 'eq' || op === 'neq') {
    // Objects and arrays would compare by reference, which is never what a
    // template author means.
    if (!isPrimitive(left) || !isPrimitive(right)) {
      // The path names the first operand that is at fault, which is the one an
      // author has to look at first.
      const culprit = isPrimitive(left) ? 'right' : 'left';
      return fail(
        {
          code: 'not-comparable',
          site,
          at: [culprit],
          actualType: valueTypeOf(culprit === 'left' ? left : right),
        },
        `Cannot compare ${describe(valueTypeOf(left))} with ${describe(valueTypeOf(right))}: eq/neq operate on primitives.`,
      );
    }
    const equal = left === right;
    return op === 'eq' ? equal : !equal;
  }

  // Absent data orders as false, like eq/neq already treat it and like
  // evaluatePredicate documents. Throwing here meant one invoice line missing an
  // optional `discount` aborted the whole document -- and until loops could bind
  // an item, no condition was ever evaluated against per-item data, so the cost
  // was invisible. A value that is PRESENT and of the wrong type still throws
  // below: that is a data-shape bug, not absence.
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  // Ordering refuses coercion on purpose. JavaScript would happily evaluate
  // '10' < '9' as true, and a template comparing a numeric string to a number
  // is a data-shape bug that must surface rather than silently mis-render.
  if (typeof left === 'number' && typeof right === 'number') {
    return order(op, left, right);
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return order(op, left, right);
  }
  // Here the PAIR is at fault, not one side: two booleans are each fine and still
  // unorderable. The path anchors on `left` -- the message names both shapes, and a
  // payload has to point somewhere.
  return fail(
    { code: 'not-orderable', site, at: ['left'], actualType: valueTypeOf(left) },
    `Cannot order ${describe(valueTypeOf(left))} against ${describe(valueTypeOf(right))}: ${op} needs two numbers or two strings.`,
  );
}

function order<TComparable extends number | string>(
  op: Exclude<ComparisonOperator, 'eq' | 'neq'>,
  left: TComparable,
  right: TComparable,
): boolean {
  switch (op) {
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    default:
      return left <= right;
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

/** Evaluates an expression to a raw value. */
export function evaluateExpression(expression: Expression, scope: EvaluationScope): unknown {
  switch (expression.kind) {
    case 'literal':
      return expression.value;
    case 'path':
      return resolvePath(expression.path, scope);
    case 'compare':
      return compare(
        expression.op,
        evaluateWithin(expression.left, ['left'], scope),
        evaluateWithin(expression.right, ['right'], scope),
        'compare',
      );
    case 'logical': {
      // Short-circuits, so `and(hasCustomer, customer.age > 18)` never evaluates
      // the right-hand side against missing data.
      const decide = (operand: Expression, index: number): boolean =>
        requireBoolean(evaluateWithin(operand, ['operands', index], scope), 'logical', [
          'operands',
          index,
        ]);
      if (expression.op === 'and') {
        return expression.operands.every(decide);
      }
      return expression.operands.some(decide);
    }
    case 'not':
      return !requireBoolean(evaluateWithin(expression.operand, ['operand'], scope), 'not', [
        'operand',
      ]);
    case 'isEmpty':
      return isEmptyValue(evaluateWithin(expression.operand, ['operand'], scope));
    default: {
      const exhaustive: never = expression;
      throw new TypeError(`Unhandled expression: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Evaluates a condition.
 *
 * See {@link requireBoolean} for the truthiness policy this enforces. `caller` names
 * the position for the error payload, and defaults to `'condition'`: a top-level
 * predicate call is a `ConditionNode.when`.
 */
export function evaluatePredicate(
  expression: Expression,
  scope: EvaluationScope,
  options?: EvaluationOptions | undefined,
): boolean {
  return requireBoolean(evaluateExpression(expression, scope), options?.caller ?? 'condition', []);
}

/**
 * How a message names the operator that asked for a list.
 *
 * `evaluateSequence` is not reusable "as is", and this table is why: its message was
 * hard-coded to `A loop needs a list to iterate over`. Wired to the list-reducing
 * expression kinds ADR 0003 adds, it would say **loop** to whoever wrote a sum -- a
 * direct C8 miss, in the lot C8 depends on. The article belongs to each entry because
 * `A loop` and `An aggregation` do not share one.
 *
 * Deliberately partial, and it grows with the algebra: each kind adds its own wording
 * in the increment that adds the kind, because a wording for a kind that does not exist
 * yet does not type-check. Anything unlisted gets a neutral subject rather than a wrong
 * one.
 */
const LIST_CALLER_SUBJECTS: Readonly<Partial<Record<ExpressionErrorSite, string>>> = {
  loop: 'A loop',
};

/**
 * Evaluates a list source, for a loop node or for one of the three expression kinds
 * that reduce a list.
 *
 * Missing data yields no iterations rather than throwing: a loop over a section
 * the caller did not supply should render nothing, not abort the document. A
 * value that is present but not a list is a genuine template/data mismatch and
 * does throw.
 */
export function evaluateSequence(
  expression: Expression,
  scope: EvaluationScope,
  options?: EvaluationOptions | undefined,
): readonly unknown[] {
  const value = evaluateExpression(expression, scope);
  if (value === null || value === undefined) {
    return [];
  }
  const site = options?.caller ?? 'loop';
  if (!Array.isArray(value)) {
    return fail(
      { code: 'not-a-list', site, at: [], actualType: valueTypeOf(value) },
      `${LIST_CALLER_SUBJECTS[site] ?? 'An expression'} needs a list to iterate over, got ${describe(valueTypeOf(value))}.`,
    );
  }
  return value;
}

/**
 * The scope a loop's children -- or an aggregation's value expression -- are evaluated
 * in: the enclosing scope, plus the current item bound to the declared alias (ADR
 * 0002, option B1).
 *
 * The counterpart of {@link evaluateSequence} -- that one yields the items, this
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

import { ExpressionEvaluationError } from '../errors.js';
import type { ComparisonOperator, Expression } from './expression.js';

/** The data a template is rendered against. */
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

function describe(value: unknown): string {
  return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

function compare(op: ComparisonOperator, left: unknown, right: unknown): boolean {
  if (op === 'eq' || op === 'neq') {
    // Objects and arrays would compare by reference, which is never what a
    // template author means.
    if (!isPrimitive(left) || !isPrimitive(right)) {
      throw new ExpressionEvaluationError(
        `Cannot compare ${describe(left)} with ${describe(right)}: eq/neq operate on primitives.`,
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
  throw new ExpressionEvaluationError(
    `Cannot order ${describe(left)} against ${describe(right)}: ${op} needs two numbers or two strings.`,
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
        evaluateExpression(expression.left, scope),
        evaluateExpression(expression.right, scope),
      );
    case 'logical': {
      // Short-circuits, so `and(hasCustomer, customer.age > 18)` never evaluates
      // the right-hand side against missing data.
      if (expression.op === 'and') {
        return expression.operands.every((operand) => evaluatePredicate(operand, scope));
      }
      return expression.operands.some((operand) => evaluatePredicate(operand, scope));
    }
    case 'not':
      return !evaluatePredicate(expression.operand, scope);
    case 'isEmpty':
      return isEmptyValue(evaluateExpression(expression.operand, scope));
    default: {
      const exhaustive: never = expression;
      throw new TypeError(`Unhandled expression: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Evaluates a condition.
 *
 * JavaScript truthiness is refused on purpose: it would make `{ path: 'total' }`
 * false for a total of 0, and an invoice silently dropping a zero line is
 * exactly the class of bug a document engine must not have. A condition must be
 * an actual predicate -- use `isEmpty`, `not` or a comparison.
 *
 * Absent data is the one exception: null and undefined read as false, so a
 * condition on a field that was never supplied hides its branch instead of
 * aborting the render.
 */
export function evaluatePredicate(expression: Expression, scope: EvaluationScope): boolean {
  const value = evaluateExpression(expression, scope);
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) {
    return false;
  }
  throw new ExpressionEvaluationError(
    `A condition must evaluate to a boolean, got ${describe(value)}. Wrap it in isEmpty, not, or a comparison instead of relying on truthiness.`,
  );
}

/**
 * Evaluates a loop source.
 *
 * Missing data yields no iterations rather than throwing: a loop over a section
 * the caller did not supply should render nothing, not abort the document. A
 * value that is present but not a list is a genuine template/data mismatch and
 * does throw.
 */
export function evaluateSequence(
  expression: Expression,
  scope: EvaluationScope,
): readonly unknown[] {
  const value = evaluateExpression(expression, scope);
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ExpressionEvaluationError(
      `A loop needs a list to iterate over, got ${describe(value)}.`,
    );
  }
  return value;
}

/**
 * The scope a loop's children are evaluated in: the enclosing scope, plus the
 * current item bound to the loop's alias (ADR 0002, option B1).
 *
 * The counterpart of {@link evaluateSequence} -- that one yields the items, this
 * one makes an item readable. Without it a loop could iterate and its children
 * could see nothing, which is where @openview/core stood before ADR 0002.
 *
 * Shadowing is lexical and the innermost loop wins; it falls out of the spread.
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

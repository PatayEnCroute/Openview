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
 */
function resolvePath(path: string, scope: EvaluationScope): unknown {
  let current: unknown = scope;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    // Reflect.get keeps `current` typed as `object` without an assertion; the
    // schema already rejected __proto__, constructor and prototype segments.
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

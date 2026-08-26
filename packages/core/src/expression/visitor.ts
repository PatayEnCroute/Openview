import type { Expression, ExpressionKind } from './types.js';
import { kindOf } from './value-type.js';

/** The single member of the algebra carrying a given discriminant. */
type ExpressionOfKind<TKind extends ExpressionKind> = Extract<Expression, { readonly kind: TKind }>;

/**
 * Exhaustive visitor over the expression algebra, one branch per kind.
 *
 * Written as a mapped type so a new kind breaks every visitor at compile time rather than at the
 * first traversal that happens to meet it. `TContext` travels down unchanged; a branch that binds
 * an alias derives its own before descending, exactly as the evaluator derives a child scope.
 */
export type ExpressionVisitor<TResult, TContext> = {
  readonly [TKind in ExpressionKind]: (
    expression: ExpressionOfKind<TKind>,
    context: TContext,
  ) => TResult;
};

/**
 * Dispatches an expression to its visitor branch.
 *
 * The only `switch (expression.kind)` the algebra owns: evaluation, path collection and data
 * compatibility all route through it.
 */
export function visitExpression<TResult, TContext>(
  expression: Expression,
  visitor: ExpressionVisitor<TResult, TContext>,
  context: TContext,
): TResult {
  switch (expression.kind) {
    case 'literal':
      return visitor.literal(expression, context);
    case 'path':
      return visitor.path(expression, context);
    case 'arithmetic':
      return visitor.arithmetic(expression, context);
    case 'percentOf':
      return visitor.percentOf(expression, context);
    case 'round':
      return visitor.round(expression, context);
    case 'concat':
      return visitor.concat(expression, context);
    case 'text':
      return visitor.text(expression, context);
    case 'textCase':
      return visitor.textCase(expression, context);
    case 'dateAdd':
      return visitor.dateAdd(expression, context);
    case 'dateDiff':
      return visitor.dateDiff(expression, context);
    case 'endOfMonth':
      return visitor.endOfMonth(expression, context);
    case 'aggregate':
      return visitor.aggregate(expression, context);
    case 'count':
      return visitor.count(expression, context);
    case 'filter':
      return visitor.filter(expression, context);
    case 'if':
      return visitor.if(expression, context);
    case 'compare':
      return visitor.compare(expression, context);
    case 'logical':
      return visitor.logical(expression, context);
    case 'not':
      return visitor.not(expression, context);
    case 'isEmpty':
      return visitor.isEmpty(expression, context);
    default: {
      const exhaustive: never = expression;
      throw new TypeError(`Unhandled expression: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

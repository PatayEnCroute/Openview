/**
 * Expression evaluation entry points.
 *
 * Facade module re-exporting evaluation options, scope management,
 * and public evaluation functions.
 */

export type {
  AttributedEvaluationOptions,
  EvaluationOptions,
  EvaluationScope,
} from './evaluator/index.js';
export {
  childScope,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  resolvePath,
  roundDecimal,
} from './evaluator/index.js';

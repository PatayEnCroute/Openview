export type {
  AttributedEvaluationOptions,
  EvaluationOptions,
} from './context.js';
export {
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
} from './evaluate.js';
export { roundDecimal } from './operations/round.js';
export type { EvaluationScope } from './scope.js';
export { childScope, resolvePath } from './scope.js';

export type {
  AttributedEvaluationOptions,
  EvaluationOptions,
} from './context.js';
export {
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
} from './evaluate.js';
export type { EvaluationScope } from './scope.js';
export { childScope, resolvePath } from './scope.js';

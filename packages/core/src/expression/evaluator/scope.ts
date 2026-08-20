/**
 * Evaluation data scope provided by the host application.
 */
export type EvaluationScope = Readonly<Record<string, unknown>>;

/**
 * Resolves a dotted path (e.g. `customer.address.city`) in the evaluation scope.
 * Reads own enumerable properties only.
 */
export function resolvePath(path: string, scope: EvaluationScope): unknown {
  let current: unknown = scope;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    if (Object.getOwnPropertyDescriptor(current, segment)?.enumerable !== true) {
      return undefined;
    }
    current = Reflect.get(current, segment);
  }
  return current;
}

/**
 * Creates a derived child scope bound with the specified loop/aggregate alias.
 */
export function childScope(parent: EvaluationScope, alias: string, item: unknown): EvaluationScope {
  return { ...parent, [alias]: item };
}

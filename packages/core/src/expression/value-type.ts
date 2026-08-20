/**
 * Closed vocabulary describing the shape of a value for logging and error reporting without data leakage.
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

/** Categorizes the runtime type of a value without touching its contents. */
export function valueTypeOf(value: unknown): ExpressionValueType {
  if (value === null || value === undefined) {
    return 'absent';
  }
  if (Array.isArray(value)) {
    return 'list';
  }
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
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

/** Extracts the string discriminant of an AST node object for exhaustiveness error messages. */
export function kindOf(value: unknown, discriminant: string): string {
  if (value === null || typeof value !== 'object') {
    return valueTypeOf(value);
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, discriminant);
  if (descriptor === undefined || !('value' in descriptor)) {
    return valueTypeOf(value);
  }
  const found: unknown = descriptor.value;
  return typeof found === 'string' ? found : valueTypeOf(found);
}

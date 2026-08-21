import type { z } from 'zod/v4';
import { UNNAMEABLE_LOCATION_MESSAGE } from './messages.js';
import { joinPath, nameableSegments } from './paths.js';
import type {
  DiagnosticContext,
  TemplateValidationCode,
  TemplateValidationDiagnostic,
} from './types.js';

type ZodIssue = z.core.$ZodIssue;
type ZodTypeName = z.core.$ZodTypeDef['type'];
type ZodPrimitive = string | number | symbol | bigint | boolean | null | undefined;

/**
 * Total by construction: a validator release that adds an issue code fails to compile here rather
 * than falling into a silent default.
 */
const VALIDATION_CODE_BY_ISSUE: Readonly<Record<ZodIssue['code'], TemplateValidationCode>> = {
  invalid_type: 'invalid-type',
  invalid_value: 'invalid-value',
  invalid_format: 'invalid-format',
  too_small: 'out-of-range',
  too_big: 'out-of-range',
  not_multiple_of: 'out-of-range',
  invalid_union: 'invalid-structure',
  invalid_key: 'invalid-structure',
  invalid_element: 'invalid-structure',
  unrecognized_keys: 'invalid-structure',
  custom: 'invalid-relation',
};

/**
 * The validator's own openers for the two codes C8 rephrases. A schema that writes its own message
 * names the field's vocabulary and is kept; these two say nothing a model author can act on.
 */
const GENERIC_OPENERS = ['Invalid input', 'Invalid option'] as const;

function isGeneric(message: string): boolean {
  return GENERIC_OPENERS.some((opener) => message.startsWith(opener));
}

/**
 * Nouns naming what a schema demands, article included. Partial on purpose: a type Openview never
 * declares falls back to its own name, which is schema vocabulary and never input data.
 */
const EXPECTED_NOUNS: Readonly<Partial<Record<ZodTypeName, string>>> = {
  string: 'text',
  number: 'a finite number',
  int: 'a whole number',
  boolean: 'true or false',
  object: 'an object',
  record: 'an object',
  array: 'a list',
  tuple: 'a list',
  enum: 'one of the declared choices',
  literal: 'the declared value',
  union: 'one of the supported shapes',
  date: 'a date',
  null: 'null',
  undefined: 'nothing',
  never: 'nothing',
  nonoptional: 'a value',
};

/** Sentences for the structural codes: which shape is wrong, without repeating the input. */
const STRUCTURE_MESSAGES: Readonly<
  Record<'invalid_union' | 'invalid_key' | 'invalid_element' | 'unrecognized_keys', string>
> = {
  invalid_union:
    'This value matches none of the supported shapes. Check the "type" or "kind" that names it.',
  invalid_key: 'This object carries a key of an unsupported shape.',
  invalid_element: 'This collection carries an element of an unsupported shape.',
  unrecognized_keys: 'This object carries keys the schema does not define. Remove them.',
};

function quoted(value: ZodPrimitive): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function acceptedValues(values: readonly ZodPrimitive[]): string {
  const parts = values.map(quoted);
  const last = parts.at(-1);
  if (last === undefined) {
    return 'This field accepts no value.';
  }
  if (parts.length === 1) {
    return `This field must be ${last}.`;
  }
  return `This field must be one of ${parts.slice(0, -1).join(', ')} or ${last}.`;
}

/**
 * The sentence an issue becomes. Bounds, formats and cross-field relations keep the words the
 * schema wrote; the validator's generic type and value refusals are rephrased.
 */
function messageOf(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return isGeneric(issue.message)
        ? `This field must be ${EXPECTED_NOUNS[issue.expected] ?? `a ${issue.expected}`}.`
        : issue.message;
    case 'invalid_value':
      return isGeneric(issue.message) ? acceptedValues(issue.values) : issue.message;
    case 'invalid_union':
    case 'invalid_key':
    case 'invalid_element':
    case 'unrecognized_keys':
      return STRUCTURE_MESSAGES[issue.code];
    default:
      return issue.message;
  }
}

function diagnosticOfIssue(
  issue: ZodIssue,
  context: DiagnosticContext | undefined,
): TemplateValidationDiagnostic {
  const { segments, complete } = nameableSegments(issue.path);
  return {
    source: 'template-validation',
    code: complete ? VALIDATION_CODE_BY_ISSUE[issue.code] : 'invalid-structure',
    message: complete ? messageOf(issue) : UNNAMEABLE_LOCATION_MESSAGE,
    path: joinPath(context?.pathPrefix, segments),
    nodeId: context?.nodeId,
  };
}

/**
 * One diagnostic per issue, in the validator's order. Two independent faults stay two corrections:
 * they are never merged, and no consumer should rely on their order.
 */
export function diagnosticsOfZodError(
  error: z.core.$ZodError,
  context: DiagnosticContext | undefined,
): readonly TemplateValidationDiagnostic[] {
  return error.issues.map((issue) => diagnosticOfIssue(issue, context));
}

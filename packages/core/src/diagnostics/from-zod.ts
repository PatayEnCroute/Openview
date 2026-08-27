import type { z } from 'zod/v4';
import { SAFE_SCHEMA_MESSAGES } from '../validation-messages.js';
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
const VALIDATION_CODE_BY_ISSUE = {
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
} as const satisfies Readonly<Record<ZodIssue['code'], TemplateValidationCode>>;

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
  Record<'invalid_key' | 'invalid_element' | 'unrecognized_keys', string>
> = {
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

function invalidUnionMessage(issue: Extract<ZodIssue, { readonly code: 'invalid_union' }>): string {
  /* A union that named its own discriminator keeps its words, exactly as a bound or a format does:
     the generic sentence below names "type" or "kind", which is wrong for any other one. */
  if (SAFE_SCHEMA_MESSAGES.has(issue.message)) {
    return issue.message;
  }
  return issue.errors.length === 0
    ? 'This value matches none of the supported shapes. Check the "type" or "kind" that names it.'
    : 'This value matches none of the supported forms.';
}

/** The sentence a type refusal becomes, naming the shape the schema expected. */
function expectedTypeMessage(expected: ZodTypeName): string {
  const noun = EXPECTED_NOUNS[expected] ?? `a ${expected}`;
  return `This field must be ${noun}.`;
}

/**
 * The sentence an issue becomes. Bounds, formats and cross-field relations keep the words the
 * schema wrote; the validator's generic type and value refusals are rephrased.
 */
function messageOf(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return SAFE_SCHEMA_MESSAGES.has(issue.message)
        ? issue.message
        : expectedTypeMessage(issue.expected);
    case 'invalid_value':
      return SAFE_SCHEMA_MESSAGES.has(issue.message) ? issue.message : acceptedValues(issue.values);
    case 'invalid_union':
      return invalidUnionMessage(issue);
    case 'invalid_format':
      return SAFE_SCHEMA_MESSAGES.has(issue.message)
        ? issue.message
        : `This field must use the ${issue.format} format.`;
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
  const common = {
    source: 'template-validation',
    path: joinPath(context?.pathPrefix, segments),
    nodeId: context?.nodeId,
  } as const;
  if (!complete) {
    return {
      ...common,
      code: 'invalid-structure',
      message: UNNAMEABLE_LOCATION_MESSAGE,
    };
  }
  if (issue.code === 'invalid_type') {
    return {
      ...common,
      code: 'invalid-type',
      message: messageOf(issue),
      expected: issue.expected,
    };
  }
  if (issue.code === 'invalid_value') {
    return {
      ...common,
      code: 'invalid-value',
      message: messageOf(issue),
      acceptedValues: issue.values.map(quoted),
    };
  }
  return {
    ...common,
    code: VALIDATION_CODE_BY_ISSUE[issue.code],
    message: messageOf(issue),
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

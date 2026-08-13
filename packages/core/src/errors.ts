import type { ExpressionKind } from './expression/expression.js';
import type { ExpressionValueType } from './expression/value-type.js';

/**
 * Typed errors. AGENTS.md 1.3 forbids swallowing an exception, which is only
 * workable if there is something specific to rethrow: a bare `throw new Error`
 * gives a caller nothing to branch on.
 */
export class OpenviewError extends Error {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'OpenviewError';
  }
}

/**
 * Codes naming an OPERAND fault: a value exists and is wrong, so there is a SHAPE to
 * report.
 *
 * `not-orderable` stays distinct from `not-comparable` because the evaluator already
 * distinguishes "cannot compare" from "cannot order" in prose; merging them would
 * throw away a distinction the repository had already written down.
 */
export const OPERAND_ERROR_CODES = [
  'operand-type',
  'division-by-zero',
  'not-finite',
  'not-a-list',
  'not-a-boolean',
  'not-comparable',
  'not-orderable',
  'not-a-date',
] as const;

/**
 * Codes naming a BOUND: no value is at fault, but a ceiling was hit.
 *
 * Four of them, and deliberately not one `limit-exceeded` catch-all: lot C8 has to
 * tell an author WHAT to reduce -- the number of operations, the size of the lists,
 * the length of a text, or the depth of the formula. A single code would be
 * unactionable, which is the one thing a refusal must not be.
 */
export const LIMIT_ERROR_CODES = [
  'step-limit-exceeded',
  'item-limit-exceeded',
  'string-limit-exceeded',
  'depth-limit-exceeded',
] as const;

/**
 * The catalogue lot C8 enumerates. A tuple rather than a bare union type, because a
 * type cannot be iterated and C8 has to pair every code with a message.
 *
 * The partition into operand and bound codes stays INSIDE one catalogue: two rival
 * exported lists would be two things to keep in step.
 */
export const EXPRESSION_ERROR_CODES = [...OPERAND_ERROR_CODES, ...LIMIT_ERROR_CODES] as const;

export type OperandErrorCode = (typeof OPERAND_ERROR_CODES)[number];
export type LimitErrorCode = (typeof LIMIT_ERROR_CODES)[number];
export type ExpressionErrorCode = (typeof EXPRESSION_ERROR_CODES)[number];

/**
 * Where the failure happened.
 *
 * `ExpressionKind` alone does not cover it: `LoopNode.each` and `ConditionNode.when`
 * carry an expression without BEING one, so a failure evaluating a loop source has no
 * expression kind to report. The field is called `site` and not `kind` for that
 * reason.
 */
export type ExpressionErrorSite = ExpressionKind | 'loop' | 'condition';

/** What EVERY expression failure carries, whichever branch it is on. */
interface ExpressionErrorLocation {
  /** Typed rather than `string`, so a typo in a `fail()` call breaks the build. */
  readonly site: ExpressionErrorSite;
  /** Path from the ROOT of the expression, e.g. `['value', 3, 'right']`. */
  readonly at: readonly (string | number)[];
}

/**
 * A discriminated union, not four required fields -- and that is a correction worth
 * keeping.
 *
 * Making `actualType` mandatory for every code sounds tidier until a bound is hit: a
 * step-limit overrun has no offending value at all. The three ways out were all bad --
 * invent a lying `ExpressionValueType` (the tag of the last value seen), add a tenth
 * `'none'` constant that would pollute `describe()`, or make the field optional, which
 * `exactOptionalPropertyTypes` and the "every field required" doctrine of ADR 0003
 * refuse alike.
 *
 * The partition already exists in the design: **an operand failure names a value, a
 * bound failure names a ceiling.** `limit` is the exact counterpart of `actualType` --
 * the only actionable fact on its branch, and safe to log by construction, since it
 * comes from `EvaluationLimits` and never from the data.
 *
 * Narrowing is the repository's usual kind: `if (details.code === 'step-limit-exceeded')`
 * yields `limit`, never `actualType`. No cast, so no conflict with AGENTS.md 1.1.
 */
export type ExpressionErrorDetails =
  | (ExpressionErrorLocation & {
      readonly code: OperandErrorCode;
      /** The SHAPE of the offending value, never the value. Closed list. */
      readonly actualType: ExpressionValueType;
    })
  | (ExpressionErrorLocation & {
      readonly code: LimitErrorCode;
      /** The ceiling that was reached -- a CONFIGURED number, never render data. */
      readonly limit: number;
    });

/**
 * An expression could not be evaluated against the supplied render data.
 *
 * The payload exists so that lot C8 can turn a failure into a sentence an author
 * corrects on their own: which code, which operator, which position in the tree.
 * Adding it now costs nothing -- this API has no consumer yet; retrofitting it after
 * the engine and the Designer would cost a rewrite of every call site.
 *
 * ## Why `at` is mutable inside and immutable outside
 *
 * `at` runs from the ROOT of the expression, because a local path cannot describe
 * `aggregate.value[3].arithmetic.right`: keep the site `arithmetic` and the row index
 * is lost, take the site `aggregate` and the operand is. Yet threading a path down
 * every descent would touch every evaluation branch for a fact only the failing path
 * needs.
 *
 * So the evaluator writes a LOCAL path in `fail()`, and one wrapper prefixes a segment
 * per level on the way out, rethrowing the SAME error object. That is O(depth), and
 * only on the error path. It also means the path is built after construction -- which
 * a `readonly` array cannot express, and forcing it would need exactly the cast
 * AGENTS.md 1.1 forbids. The mutable state is therefore PRIVATE to this class and the
 * public contract stays immutable: `details` hands out a fresh reversed copy.
 *
 * Segments accumulate innermost-first so `prefix` is O(1) instead of an unshift, and
 * only the read pays for the reversal.
 *
 * The rejected alternative was a new error per level chained through `cause`: it piles
 * up N errors for one fault, and `cause` is reserved for the core/engine boundary --
 * `DataBindingStep` wraps this error to add the block id core honestly does not know.
 */
export class ExpressionEvaluationError extends OpenviewError {
  readonly #details: ExpressionErrorDetails;
  readonly #reversedPath: (string | number)[];

  constructor(
    message: string,
    details: ExpressionErrorDetails,
    options?: ErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'ExpressionEvaluationError';
    this.#details = details;
    this.#reversedPath = [...details.at].reverse();
  }

  /**
   * Prepends one segment to the path. Called by the evaluator's descent wrapper only,
   * and only while an error is propagating.
   */
  prefix(segment: string | number): void {
    this.#reversedPath.push(segment);
  }

  /** Root-to-leaf, freshly built on every read so a later `prefix` cannot alter it. */
  get details(): ExpressionErrorDetails {
    return { ...this.#details, at: [...this.#reversedPath].reverse() };
  }
}

/** A stored template could not be brought up to the current schema version. */
export class TemplateMigrationError extends OpenviewError {
  constructor(
    message: string,
    readonly fromVersion: number,
    options?: ErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'TemplateMigrationError';
  }
}

/**
 * Why a raw payload was refused before any schema looked at it.
 *
 * A separate catalogue from {@link EXPRESSION_ERROR_CODES}, and separate because the
 * shape guard runs at PARSE time on plain `unknown`: no node exists yet, so there is no
 * `ExpressionErrorSite` to report and nothing an `at` path could point into.
 */
export const SHAPE_ERROR_CODES = ['too-deep', 'too-many-nodes', 'not-plain-data'] as const;

export type ShapeErrorCode = (typeof SHAPE_ERROR_CODES)[number];

/**
 * A raw payload was refused for its SHAPE, before validation.
 *
 * On the pattern of {@link TemplateMigrationError}: the machine facts sit as readonly
 * fields rather than in a nested payload, because there are three codes and no consumer
 * has to branch further. `limit` is `undefined` for `not-plain-data`, which genuinely has
 * no ceiling -- an explicit "there is none" rather than an invented number.
 */
export class TemplateShapeError extends OpenviewError {
  constructor(
    message: string,
    readonly code: ShapeErrorCode,
    readonly limit: number | undefined,
    options?: ErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'TemplateShapeError';
  }
}

/**
 * A caller supplied an evaluation limit that cannot bound anything.
 *
 * Loud on purpose, and never a silent fallback: `createBudget({ maxSteps: 0 })` would
 * otherwise disable the protection by accident, and a caller who passed `NaN` would get
 * a budget that never refuses.
 */
export class InvalidEvaluationLimitsError extends OpenviewError {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'InvalidEvaluationLimitsError';
  }
}

/**
 * A caller supplied a shape limit that cannot bound anything.
 *
 * The symmetric counterpart of {@link InvalidEvaluationLimitsError}, and the asymmetry
 * had no justification: `{ maxDepth: 0 }` neutralises the shape guard in silence, and
 * `{ maxNodes: NaN }` makes it never terminate -- the exact failure `maxNodes` exists to
 * prevent.
 */
export class InvalidShapeLimitsError extends OpenviewError {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'InvalidShapeLimitsError';
  }
}

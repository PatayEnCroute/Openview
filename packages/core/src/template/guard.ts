import { z } from 'zod/v4';
import { type DocumentNode, DocumentNodeSchema } from '../ast/nodes.js';
import { InvalidShapeLimitsError, TemplateShapeError } from '../errors.js';
import { type Expression, ExpressionSchema } from '../expression/expression.js';

/**
 * The shape guard, and the bounded doors that were missing beside it (ADR 0003,
 * decision 8).
 *
 * ## The measurement this exists for
 *
 * A stack overflow does not strike at evaluation, it strikes at PARSING. On a chain of
 * `{ kind: 'not', operand: ... }` posted as JSON, Node 24 holds past 100 000 in
 * `JSON.parse` -- V8 parses iteratively -- but **Zod falls over around 1 874**,
 * `JSON.stringify` around 8 000, and `evaluateExpression` around 20 000. So the first
 * failure is a `RangeError` FROM ZOD, on a model of some 35-50 kB, and it crosses
 * `parseTemplate` unwrapped: not an `OpenviewError`, not a `TemplateMigrationError`.
 * That breaks AGENTS.md 1.3 outright, and "Maximum call stack size exceeded" is not a
 * message a template author corrects. Nor can the engine inspect the document first --
 * you have to parse to look, and parsing is what falls over.
 *
 * With `maxDepth = 64` everything above becomes unreachable BY CONSTRUCTION: Zod never
 * sees 1 874, the evaluator never sees 20 000, `JSON.stringify` never sees 8 000. One
 * guardrail, four holes closed, and the refusal is typed so lot C8 can narrate it.
 *
 * ## What this guard promises, and what it does not
 *
 * It promises that **no declared getter runs**. It does NOT promise that no caller code
 * runs: on a `Proxy`, `getOwnPropertyDescriptors` and `ownKeys` are themselves traps, so
 * the check-then-parse window reopens in full. A `Proxy` handed to a parse entry point is
 * out of the threat model, in writing (ADR 0003, assumption 2).
 */
export interface ShapeLimits {
  /**
   * JSON levels, **not** document nodes. Measured on a realistic model: 10 levels, and 12
   * with an `aggregate(filter(...))`. 64 leaves a fivefold margin. The unit has to be
   * written down -- a reader who thinks these are blocks will pick an absurd value.
   */
  readonly maxDepth: number;
  /**
   * Total values discovered. **This is the termination condition, not a comfort.** A tree
   * of depth 40 with SHARED SUBTREES -- the same object referenced twice per level --
   * produces 5 000 000 visits in 846 ms without ever reaching `maxDepth`: the depth is
   * bounded and the work is not. A scan bounded on depth alone does not terminate.
   */
  readonly maxNodes: number;
}

export const DEFAULT_SHAPE_LIMITS: ShapeLimits = { maxDepth: 64, maxNodes: 100_000 };

const HARD_CEILING = 1_000_000_000;

const shapeLimitsSchema = z.object({
  maxDepth: z.number().int().min(1).max(HARD_CEILING),
  maxNodes: z.number().int().min(1).max(HARD_CEILING),
});

/**
 * Validated exactly like {@link EvaluationLimits}, and for the same reason: without it,
 * `assertBoundedShape(raw, { maxDepth: 0 })` neutralises the guard in silence, and
 * `{ maxNodes: NaN }` makes it never terminate.
 */
export function resolveShapeLimits(limits?: Partial<ShapeLimits>): ShapeLimits {
  if (limits === undefined) {
    return DEFAULT_SHAPE_LIMITS;
  }
  const parsed = shapeLimitsSchema.safeParse({ ...DEFAULT_SHAPE_LIMITS, ...limits });
  if (!parsed.success) {
    throw new InvalidShapeLimitsError(
      'A shape limit must be a whole number between 1 and 1 000 000 000. Omit a field to take its default; a present but unusable value is refused rather than replaced, because `maxDepth: 0` disables the guard and `maxNodes: NaN` makes it run forever.',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

/**
 * One frame of the explicit stack, as a linked list.
 *
 * A linked list rather than an array, for two reasons. **Every frame carries its own
 * depth**, which is what makes a cyclic payload terminate: a cycle exceeds any finite
 * depth, so `maxDepth` catches it -- but only while the depth travels with the frame. That
 * is a property of this implementation and not of the concept, so it is written here and
 * pinned by a test; the first refactor that hoists the depth out of the frame would make
 * the guard spin forever. Second, `pop()` and `array[i]` are both
 * `T | undefined` under `noUncheckedIndexedAccess`, so an array stack would need a guard
 * that never fires at runtime -- a dead branch in the middle of a safety check.
 */
interface Frame {
  readonly value: unknown;
  readonly depth: number;
  readonly next: Frame | undefined;
}

/**
 * Refuses a raw payload whose SHAPE is out of bounds, before any schema looks at it.
 *
 * Iterative by construction, so the guard is itself insensitive to the depth it measures.
 * Values are counted as they are DISCOVERED rather than as they are visited, which also
 * bounds how large the pending stack can grow.
 *
 * The guard cannot live inside the schema: a `.superRefine` at the head of a `z.lazy`
 * body would re-run at every level of the recursion.
 */
export function assertBoundedShape(raw: unknown, limits?: Partial<ShapeLimits>): void {
  const { maxDepth, maxNodes } = resolveShapeLimits(limits);
  let discovered = 1;
  let top: Frame | undefined = { value: raw, depth: 1, next: undefined };

  while (top !== undefined) {
    // Annotated rather than destructured straight off `top`: without the annotation, the
    // narrowed type of `top` and the inferred type of `next` each depend on the other and
    // tsc reports TS7022 (implicitly `any`, referenced in its own initializer).
    const frame: Frame = top;
    top = frame.next;
    const { value, depth } = frame;

    if (depth > maxDepth) {
      throw new TemplateShapeError(
        `A template may not nest more than ${maxDepth} levels deep. A cyclic payload lands here too, because a cycle exceeds every finite depth.`,
        'too-deep',
        maxDepth,
      );
    }

    if (value === null || typeof value !== 'object') {
      continue;
    }

    // `getOwnPropertyDescriptors` in one call rather than a key loop with a lookup per
    // key: the descriptors are all this needs, and reading them by descriptor is what
    // keeps a getter from running. Own NON-enumerable properties are included on purpose,
    // because Zod reads a field of its shape whether or not it is enumerable.
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (!('value' in descriptor)) {
        // Measured: a naive scan INVOKES a getter, so caller code would run before any
        // validation -- and with a check-then-parse window in which the getter can hand
        // one value to the guard and another to Zod. `parseTemplate` expects data, not a
        // live object.
        throw new TemplateShapeError(
          "A template must be plain data. A property defined by a getter or setter is refused: reading it would run the caller's code before validation, and it could return one value to the guard and another to the schema.",
          'not-plain-data',
          undefined,
        );
      }

      discovered += 1;
      if (discovered > maxNodes) {
        throw new TemplateShapeError(
          `A template may not carry more than ${maxNodes} values. Shared subtrees count every time they are reached, which is what makes this bound the guard's termination condition rather than a comfort.`,
          'too-many-nodes',
          maxNodes,
        );
      }

      const child: unknown = descriptor.value;
      top = { value: child, depth: depth + 1, next: top };
    }
  }
}

/**
 * Parses a standalone expression WHILE BOUNDING IT.
 *
 * `ExpressionSchema.parse` bounds nothing, and it stays exported: a Zod schema is the
 * attachment point for `z.infer`, for composition (`z.array(DocumentNodeSchema)`) and for
 * the partial validation a Designer needs -- three uses no `parse*` function replaces.
 * De-exporting it would force consumers to redeclare the contract, which is worse than
 * the unbounded door it would close.
 *
 * The residual risk is therefore named instead of disguised, and a measurement is what
 * makes it acceptable: Zod's own recursion gives out around 1 874 levels, so the
 * unbounded door does not open the depth -- it opens the UNWRAPPED `RangeError`, the one
 * thing these entry points avoid. A test pins exactly that difference.
 */
export function parseExpression(raw: unknown, limits?: Partial<ShapeLimits>): Expression {
  assertBoundedShape(raw, limits);
  return ExpressionSchema.parse(raw);
}

/** Parses a standalone document node WHILE BOUNDING IT. See {@link parseExpression}. */
export function parseDocumentNode(raw: unknown, limits?: Partial<ShapeLimits>): DocumentNode {
  assertBoundedShape(raw, limits);
  return DocumentNodeSchema.parse(raw);
}

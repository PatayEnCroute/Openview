import { z } from 'zod/v4';
import {
  type BlockNode,
  BlockNodeSchema,
  type DocumentNode,
  DocumentNodeSchema,
} from '../ast/nodes.js';
import { InvalidShapeLimitsError, TemplateShapeError } from '../errors.js';
import { type Expression, ExpressionSchema } from '../expression/expression.js';
import { limitSchema, resolveLimits } from '../expression/limits.js';

/**
 * The shape guard, and the bounded doors that were missing beside it (ADR 0003,
 * decision 8).
 *
 * ## The measurement this exists for
 *
 * A stack overflow does not strike at evaluation, it strikes at PARSING. On a chain of
 * `{ kind: 'not', operand: ... }` posted as JSON, Node 24 holds past 100 000 in
 * `JSON.parse` -- V8 parses iteratively -- but **Zod falls over somewhere in the low
 * thousands** (1 874 and 1 269 measured on two machines: the figure is stack-size dependent,
 * so treat every number here as an order of magnitude and not a threshold),
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
   * JSON levels, **not** document nodes. Measured on a realistic model: 10 levels, 12 with
   * an `aggregate(filter(...))`, and 18 for the five-column table of lot C3 with its header
   * and a `round(sum(round(mul)))` footer. 64 leaves a threefold margin, and nine nested
   * tables are accepted before `too-deep`. The unit has to be written down -- a reader who
   * thinks these are blocks will pick an absurd value.
   */
  readonly maxDepth: number;
  /**
   * Total values discovered -- one per element of an array and one per own property of an
   * object, plus the root. An array's own `length` is NOT counted: it is not a value the
   * document contains, and counting it made the ceiling drift with how many arrays a
   * payload held.
   *
   * **This is the termination condition, not a comfort.** A tree of depth 40 with SHARED
   * SUBTREES -- the same object referenced twice per level -- produces 5 000 000 visits in
   * 846 ms without ever reaching `maxDepth`: the depth is bounded and the work is not. A
   * scan bounded on depth alone does not terminate.
   */
  readonly maxNodes: number;
}

/**
 * The same schema and the same ceiling as {@link EvaluationLimits}, imported rather than
 * restated: two copies of one bound drift, and raising it in one file would leave the other
 * refusing values the first accepts.
 */
const shapeLimitsSchema = z.object({ maxDepth: limitSchema, maxNodes: limitSchema });

/** Parsed at module load, for the reason given on {@link DEFAULT_EVALUATION_LIMITS}. */
export const DEFAULT_SHAPE_LIMITS: ShapeLimits = shapeLimitsSchema.parse({
  maxDepth: 64,
  maxNodes: 100_000,
});

/**
 * Validated exactly like {@link EvaluationLimits}, and for the same reason: without it,
 * `assertBoundedShape(raw, { maxDepth: 0 })` neutralises the guard in silence, and
 * `{ maxNodes: NaN }` makes it never terminate.
 */
export function resolveShapeLimits(limits?: Partial<ShapeLimits>): ShapeLimits {
  return resolveLimits(
    DEFAULT_SHAPE_LIMITS,
    shapeLimitsSchema,
    limits,
    (cause) =>
      new InvalidShapeLimitsError(
        'A shape limit must be a whole number between 1 and 1 000 000 000. Omit a field to take its default; a present but unusable value is refused rather than replaced, because `maxDepth: 0` disables the guard and `maxNodes: NaN` makes it run forever.',
        { cause },
      ),
  );
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

function tooManyNodes(maxNodes: number): TemplateShapeError {
  return new TemplateShapeError(
    `A template may not carry more than ${maxNodes} values. Shared subtrees count every time they are reached, which is what makes this bound the guard's termination condition rather than a comfort.`,
    'too-many-nodes',
    maxNodes,
  );
}

const NOT_PLAIN_DATA =
  "A template must be plain data. A property defined by a getter or setter is refused: reading it would run the caller's code before validation, and it could return one value to the guard and another to the schema.";

/**
 * Refuses a raw payload whose SHAPE is out of bounds, before any schema looks at it.
 *
 * Iterative by construction, so the guard is itself insensitive to the depth it measures.
 *
 * What a single value directly contains is {@link childValuesOf}, and the order it works in
 * -- width first, descriptors one at a time -- is load-bearing for the reason written there.
 * Kept out of this loop so the traversal reads as what it is: pop a frame, bound its depth,
 * push its children.
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

    for (const child of childValuesOf(value, maxNodes - discovered, maxNodes)) {
      discovered += 1;
      top = { value: child, depth: depth + 1, next: top };
    }
  }
}

/**
 * The values one object or array directly contains, yielded one at a time.
 *
 * ## Why the width of a single value is checked BEFORE its properties are read
 *
 * An earlier version fetched every descriptor of a value in one
 * `Object.getOwnPropertyDescriptors` call and counted them inside the loop that followed.
 * That bounded the loop body and not the snapshot the loop walked, so the guard's own cost
 * scaled with the payload rather than with `maxNodes`: measured, `{ root: new Array(n) }`
 * still refused with `too-many-nodes`, but took 342 ms and +69 MB at n = 1 000 000 and
 * 2 401 ms and +831 MB at n = 5 000 000, against a ceiling of 100 000. A 3.8 MB request
 * body parsed in 15 ms and then spent 798 ms in here. That is the denial of service the
 * guard exists to prevent, performed by the guard.
 *
 * So the width is tested first, against the budget that remains, and descriptors are
 * fetched ONE AT A TIME afterwards. An array is the shape that matters -- its width is
 * known in O(1) and it is what a hostile payload uses -- and it now costs O(1) to refuse.
 * An object still pays for its own key array, which is the price of reading own
 * non-enumerable keys at all, but never for a descriptor beyond the ceiling.
 *
 * A generator, and not a list of children: returning an array would materialise a second
 * copy of every width this function exists to refuse paying for, and it would read every
 * descriptor of a value before the caller saw the first one. Yielding keeps "one descriptor
 * at a time" literally true.
 */
function* childValuesOf(
  value: object,
  remaining: number,
  maxNodes: number,
): Generator<unknown, void, undefined> {
  // Own NON-enumerable string keys are included on purpose, because Zod reads a field of
  // its shape whether or not it is enumerable. Symbol keys are excluded: nothing
  // downstream reads one, so a value hidden under a symbol key is neither validated nor
  // measured, and no getter under one is ever invoked.
  const keys: readonly (string | number)[] = Array.isArray(value)
    ? // Length first, so a hostile array is refused without one property being touched.
      indicesOf(value.length, remaining, maxNodes)
    : Object.getOwnPropertyNames(value);

  if (keys.length > remaining) {
    throw tooManyNodes(maxNodes);
  }

  for (const key of keys) {
    // One descriptor at a time, and by descriptor rather than by read: measured, a naive
    // scan INVOKES a getter, so caller code would run before any validation -- with a
    // check-then-parse window in which the getter can hand one value to the guard and
    // another to Zod. `parseTemplate` expects data, not a live object.
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      // A hole in a sparse array. There is no value there to measure.
      continue;
    }
    if (!('value' in descriptor)) {
      throw new TemplateShapeError(NOT_PLAIN_DATA, 'not-plain-data', undefined);
    }

    const child: unknown = descriptor.value;
    yield child;
  }
}

/**
 * The indices of an array, or a refusal if there are more of them than the budget allows.
 *
 * Separated so the length test happens before the index array is built: materialising five
 * million index strings to then refuse them is the same mistake as materialising five
 * million descriptors.
 *
 * The test sizes the array by `length`, which OVER-counts a sparse one -- a hole contributes
 * no value, but `length` counts it. Conservative on purpose: it refuses early rather than
 * late, and `JSON.parse` never produces a hole anyway.
 */
function indicesOf(length: number, remaining: number, maxNodes: number): readonly number[] {
  if (length > remaining) {
    throw tooManyNodes(maxNodes);
  }
  return Array.from({ length }, (_unused, index) => index);
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

/** Parses a standalone BLOCK node WHILE BOUNDING IT. See {@link parseExpression}. */
export function parseBlockNode(raw: unknown, limits?: Partial<ShapeLimits>): BlockNode {
  assertBoundedShape(raw, limits);
  return BlockNodeSchema.parse(raw);
}

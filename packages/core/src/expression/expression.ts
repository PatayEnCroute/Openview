import { z } from 'zod/v4';

/**
 * Structured expressions (ADR 0001, option C; widened by ADR 0003).
 *
 * An expression is a validated tree, never a string to parse. Two consequences
 * drive the whole design:
 *
 * - There is no parser, so there is no injection surface. Zod validates the
 *   shape and nothing is ever evaluated as code.
 * - @openview/designer edits this representation directly. A field picker, an
 *   operator, a value -- what the UI manipulates is exactly what gets stored,
 *   with no text round-trip to keep in sync.
 *
 * The operator set is closed and every operator has NAMED fields of fixed arity.
 * There is no `{ fn, args }` node and there never will be: a generic namespace fills
 * up and never empties, needs an arity table maintained beside the schema, forces a
 * guard on `args[0]` at every evaluation under `noUncheckedIndexedAccess`, degrades a
 * refusal from "the `days` field is missing" to "expected 2 elements, got 1", and
 * reopens the place where `tva()` eventually gets written (ADR 0003, decision 1).
 *
 * ## The three sub-algebras
 *
 * `Expression` is partitioned by the KIND OF VALUE an operator yields, because that is
 * what decides where it may appear:
 *
 * - {@link PrintableExpression} yields something a document can print, and is what a
 *   text binding accepts;
 * - {@link PredicateExpression} yields a boolean, refused in a print position;
 * - a list-valued sub-algebra joins them when `filter` lands.
 *
 * No position of the contract accepts LESS than it did before ADR 0003:
 * `compare.left/right`, `logical.operands`, `not.operand`, `isEmpty.operand`,
 * `LoopNode.each` and `ConditionNode.when` all keep the full `Expression`. The
 * partition narrows one position only -- `TextBindingSegment.value` -- and that one
 * *widened* from `literal | path` to the whole printable sub-algebra.
 */

export type LiteralValue = string | number | boolean | null;

/** Strict comparisons only: see ./evaluate.ts for why coercion is refused. */
export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface LiteralExpression {
  readonly kind: 'literal';
  readonly value: LiteralValue;
}

/**
 * Dotted path into the caller's render data, e.g. `invoice.customer.name`.
 * The segments are names the caller chose; core knows none of them.
 */
export interface PathExpression {
  readonly kind: 'path';
  readonly path: string;
}

export interface CompareExpression {
  readonly kind: 'compare';
  readonly op: ComparisonOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export interface LogicalExpression {
  readonly kind: 'logical';
  readonly op: 'and' | 'or';
  readonly operands: readonly Expression[];
}

export interface NotExpression {
  readonly kind: 'not';
  readonly operand: Expression;
}

/** True for null, undefined, empty string, empty array and empty object. */
export interface IsEmptyExpression {
  readonly kind: 'isEmpty';
  readonly operand: Expression;
}

/**
 * What yields a value a document can print, and therefore what a text binding
 * accepts.
 *
 * The guarantee has to be stated carefully, because a plausible version of it is
 * false: a print position refuses the **operators** that yield a boolean or a list; it
 * has never forbidden a boolean **literal**, and cannot without removing `boolean`
 * from {@link LiteralValue} -- which would be a narrowing of the stored contract.
 * `{ kind: 'binding', value: { kind: 'literal', value: true } }` parses, and a test
 * pins that, so the next reading of this docstring does not restate the wrong claim.
 */
export type PrintableExpression = LiteralExpression | PathExpression;

/**
 * What yields a boolean. Refused in a print position AT PARSE TIME, where the refusal
 * costs no migration -- unlike the two sibling positions, which enforce their result
 * kind at evaluation (`evaluatePredicate` refuses a non-boolean, `evaluateSequence` a
 * non-list).
 */
export type PredicateExpression =
  | CompareExpression
  | LogicalExpression
  | NotExpression
  | IsEmptyExpression;

/**
 * Written as the union of the sub-algebras rather than a flat list, so the partition
 * is structural: a kind added to neither side fails to compile here instead of
 * quietly belonging to nothing.
 */
export type Expression = PrintableExpression | PredicateExpression;

export type ExpressionKind = Expression['kind'];

const literalValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * A single identifier: the atom a dotted path is built from, and the shape an alias
 * must take as well (ADR 0002, ADR 0003). One rule, now THREE call sites -- a loop's
 * alias, an aggregation's and a filter's -- and a second copy of the list below would
 * eventually drift from this one, with the copy that forgot a name being the hole.
 *
 * The character classes live in a string so the whole-path pattern can be
 * composed from the same source rather than restating them. That keeps one rule
 * for both call sites and validates a path with one regex pass over the whole
 * string, rather than one per segment.
 *
 * The forbidden set is **derived** from `Object.prototype` instead of listed, so
 * it cannot fall behind: a three-name list left `toString`, `valueOf`,
 * `hasOwnProperty` and the rest accepted. Note what does and does not make this
 * a security boundary -- the prototype chain is closed off by `resolvePath`,
 * which reads own enumerable properties only, not by this set. Two reasons
 * remain to reject the names at save time:
 *
 * - a path segment naming an inherited member (`invoice.toString`) is a template
 *   bug, and saying so when the template is saved beats resolving to nothing when
 *   a document renders;
 * - an alias becomes a key of the evaluation scope, so an alias named `toString`
 *   would install data over a method every JavaScript consumer assumes exists, and
 *   `String(scope)` would throw.
 */
const IDENTIFIER_SOURCE = '[A-Za-z_$][\\w$]*';
const IDENTIFIER_PATTERN = new RegExp(`^${IDENTIFIER_SOURCE}$`);
const PATH_PATTERN = new RegExp(`^${IDENTIFIER_SOURCE}(\\.${IDENTIFIER_SOURCE})*$`);

const FORBIDDEN_IDENTIFIERS: ReadonlySet<string> = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  'prototype',
]);

/** The rule every alias obeys too, so no schema can drift from it. */
export function isIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value) && !FORBIDDEN_IDENTIFIERS.has(value);
}

/**
 * The shape of a scope-binding name, hoisted out of `nodes.ts` because ADR 0003 gives
 * it two more call sites. This is the moment the rule factors out, or else it diverges.
 *
 * Not re-exported from the package barrel, for the reason ADR 0002 already gave about
 * `isIdentifier`: `LoopNodeSchema.shape.as` is what a Designer validates a keystroke
 * against, so a second export would serve nobody.
 */
export const aliasSchema = z
  .string()
  .refine(
    isIdentifier,
    'An alias must be a single identifier, and may not be __proto__, constructor or prototype',
  );

/**
 * The two recursive bindings, DECLARED BEFORE EVERY MEMBER SCHEMA.
 *
 * That order is a constraint no tool checks. A member schema placed above them
 * references a `const` that is still in its temporal dead zone, so importing the module
 * raises a `ReferenceError` -- not a type error, not a lint error. Only `vitest` breaks,
 * and only at import time.
 *
 * `z.lazy` defers resolution so a member can reference the union it belongs to, and the
 * explicit `z.ZodType<T>` annotation keeps the inferred type from collapsing. The
 * concrete member schemas need no annotation: their own inference is fine once the
 * recursive fields resolve through these.
 *
 * ## The one thing in this file with no automatic signal
 *
 * `zod` declares `ZodType<out Output, ...>`, so it is COVARIANT in its output: a
 * `z.lazy` body that omits a member stays assignable to the annotation and compiles
 * without a word -- verified by removing one. Neither `tsc` nor Biome says anything.
 * The guard is a runtime one, in expression.test.ts: a sample per kind, held in a
 * MAPPED type so that a wrong sample for the right key cannot pass either.
 */
export const ExpressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    LiteralExpressionSchema,
    PathExpressionSchema,
    CompareExpressionSchema,
    LogicalExpressionSchema,
    NotExpressionSchema,
    IsEmptyExpressionSchema,
  ]),
);

/**
 * The printable sub-algebra, and the only position of the stored contract that accepts
 * a subset of {@link ExpressionSchema}.
 *
 * Lazy from the start even though today's two members are leaves: the arithmetic and
 * aggregation kinds take printable operands, so this binding becomes genuinely
 * recursive the moment they land. Making it lazy now is what keeps those increments
 * additive.
 */
export const PrintableExpressionSchema: z.ZodType<PrintableExpression> = z.lazy(() =>
  z.discriminatedUnion('kind', [LiteralExpressionSchema, PathExpressionSchema]),
);

export const LiteralExpressionSchema = z.object({
  kind: z.literal('literal'),
  value: literalValueSchema,
});

export const PathExpressionSchema = z.object({
  kind: z.literal('path'),
  // Validated here rather than at evaluation time, so a malformed path fails
  // when the template is saved instead of when a document renders. One regex for
  // the shape, one split for the forbidden names: two passes, two messages.
  path: z
    .string()
    .min(1, 'A path expression needs a path')
    // A NARROWING, and the only kind ADR 0003 introduces at parse time: a path of 591
    // characters used to be accepted. The pattern itself is not vulnerable to
    // backtracking (measured linear over 200 002 characters); the cost is that
    // `resolvePath` splits the path again on every read, and aggregations take that
    // count from O(1) to O(n) or worse.
    .max(256, 'A path may not exceed 256 characters')
    .regex(PATH_PATTERN, 'A path must be dot-separated identifiers, e.g. section.item.field')
    .refine(
      (path) => path.split('.').every((segment) => !FORBIDDEN_IDENTIFIERS.has(segment)),
      'A path segment may not name an inherited member such as __proto__, constructor or toString',
    ),
});

export const CompareExpressionSchema = z.object({
  kind: z.literal('compare'),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
  left: ExpressionSchema,
  right: ExpressionSchema,
});

export const LogicalExpressionSchema = z.object({
  kind: z.literal('logical'),
  op: z.enum(['and', 'or']),
  operands: z.array(ExpressionSchema).min(1, 'A logical expression needs at least one operand'),
});

export const NotExpressionSchema = z.object({
  kind: z.literal('not'),
  operand: ExpressionSchema,
});

export const IsEmptyExpressionSchema = z.object({
  kind: z.literal('isEmpty'),
  operand: ExpressionSchema,
});

/**
 * The first segment of a dotted path -- the only part that can name an alias.
 *
 * Extracted from `visitor.ts`, where it was inline, because two filters now need the
 * same rule: the node-level one that skips a loop alias, and the expression-level one
 * below that skips an alias bound INSIDE an expression. `indexOf`/`slice` rather than
 * `split`, since only the root decides and this runs once per path of a whole tree.
 */
export function rootSegment(dataPath: string): string {
  const dot = dataPath.indexOf('.');
  return dot === -1 ? dataPath : dataPath.slice(0, dot);
}

const NO_ALIASES: ReadonlySet<string> = new Set<string>();

/**
 * Records the paths an expression reads, skipping those rooted at an alias the
 * expression itself binds.
 *
 * The node-level filter in `visitor.ts` cannot do this job: it works one node at a
 * time and never sees an alias buried inside an expression. Without this pass,
 * `sum(invoice.lines, l, l.total)` would make `collectDataPaths` demand a key `l` from
 * the integrator that no integrator will ever supply -- precisely the bug ADR 0002
 * fixed for loops, reintroduced by aggregations.
 */
function collectPaths(
  expression: Expression,
  aliases: ReadonlySet<string>,
  into: Set<string>,
): void {
  switch (expression.kind) {
    case 'literal':
      break;
    case 'path':
      if (!aliases.has(rootSegment(expression.path))) {
        into.add(expression.path);
      }
      break;
    case 'compare':
      collectPaths(expression.left, aliases, into);
      collectPaths(expression.right, aliases, into);
      break;
    case 'logical':
      for (const operand of expression.operands) {
        collectPaths(operand, aliases, into);
      }
      break;
    case 'not':
    case 'isEmpty':
      collectPaths(expression.operand, aliases, into);
      break;
    default: {
      const exhaustive: never = expression;
      throw new TypeError(`Unhandled expression: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Every data path an expression tree reads, in traversal order, de-duplicated.
 *
 * The signature is unchanged: the alias context is internal, so no caller has to know
 * that expressions can bind names now.
 */
export function pathsOf(expression: Expression, into: Set<string> = new Set()): Set<string> {
  collectPaths(expression, NO_ALIASES, into);
  return into;
}

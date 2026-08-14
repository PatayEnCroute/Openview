/**
 * Structured expressions types and operator definitions (ADR 0001, option C; widened by ADR 0003).
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
 */

export type LiteralValue = string | number | boolean | null;

/** Strict comparisons only: see evaluator for why coercion is refused. */
export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

/**
 * The four operations, and nothing else.
 *
 * `Math.pow`, `Math.sqrt` and the transcendental functions are deliberately absent, and
 * the reason is determinism rather than taste: the four operations are *correctly
 * rounded* by IEEE-754 and their result is imposed by ECMA-262, so `a + b` yields the
 * same bit on two machines. The transcendentals are under no such obligation. None is in
 * scope, and that is one more reason not to put them there (ADR 0003, decision 4).
 */
export const ARITHMETIC_OPERATORS = ['add', 'sub', 'mul', 'div'] as const;

export type ArithmeticOperator = (typeof ARITHMETIC_OPERATORS)[number];

/**
 * The four reductions, all homogeneous in return type: a number, or nothing.
 *
 * `count` is deliberately NOT one of them. It is a kind of its own with a single field,
 * because "how many discounted lines" is `count(filter(...))` and adding it here would
 * make the operator list inhomogeneous -- a `count` needs no `value` expression, and a
 * `sum` cannot do without one.
 *
 * `min`/`max` are NUMERIC. Letting them order strings would put a lexicographic order on
 * dates, which `civil-date.ts` exists precisely to make unreachable.
 */
export const AGGREGATE_OPERATORS = ['sum', 'avg', 'min', 'max'] as const;

export type AggregateOperator = (typeof AGGREGATE_OPERATORS)[number];

/**
 * Case folding, and **the one place in this whole lot where determinism holds by convention
 * rather than by specification** (ADR 0003).
 *
 * `toUpperCase`/`toLowerCase` are specified, but INDEXED ON THE ENGINE'S UNICODE VERSION.
 * Measured: `'ß'.toUpperCase()` yields `"SS"` -- one character becomes two, **the length
 * changes**, therefore the layout changes, therefore the pagination changes. That is not a
 * laboratory case; one German company name is enough.
 *
 * The locale variants (`toLocaleUpperCase`) are refused outright: they depend on ICU and
 * break determinism for good. The residual reserve is tooled by FROZEN TEST VECTORS -- `ß`,
 * `ﬀ`, `İ`, plus accented Latin -- whose expectations are hard-coded, so the day a Node
 * upgrade changes a result, it is the test that says so and not an invoice.
 */
export const TEXT_CASE_OPERATORS = ['upper', 'lower'] as const;

export type TextCaseOperator = (typeof TEXT_CASE_OPERATORS)[number];

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
 * Binary, like `compare`, and for the same two reasons: `sub` and `div` are not
 * associative, so a flat operand list would not say what it means; and two NAMED fields
 * need no guard under `noUncheckedIndexedAccess`, where `args[0]` would.
 *
 * **Parentheses are free.** Nesting *is* the parenthesis -- there is no precedence and no
 * parser, so `(a + b) * c` is a `mul` whose left operand is an `add`, and nothing about
 * that can be misread.
 */
export interface ArithmeticExpression {
  readonly kind: 'arithmetic';
  readonly op: ArithmeticOperator;
  readonly left: PrintableExpression;
  readonly right: PrintableExpression;
}

/**
 * `base * rate / 100`, with the rate expressed in POINTS: `percentOf(1500, 20)` is 300.
 *
 * No rounding, here or anywhere: a default rounding would be a rounding position *de
 * facto*, therefore a rule, and Openview answers for no rule. `div(1, 3)` yields
 * `0.3333333333333333`, and a test pins that so nobody "tidies up" the division later.
 * How an amount rounds is declared by the template, in lot C2, through a `round` wrapper
 * kind -- not through a `precision?` field on every intermediate node that nobody fills
 * in.
 */
export interface PercentOfExpression {
  readonly kind: 'percentOf';
  readonly base: PrintableExpression;
  readonly rate: PrintableExpression;
}

/**
 * "If ... then ... else" INSIDE a formula, rather than only around a block.
 *
 * It earns its place from the absence policy: `sub(total, discount)` with no discount
 * yields nothing, which is honest and sometimes not what an author wants. The fallback is
 * then theirs to write -- `sub(total, if(isEmpty(discount), 0, discount))` -- and never a
 * fallback the evaluator guessed.
 *
 * ## Two field names, and one of them is not the obvious one
 *
 * `whenTrue`/`whenFalse`, **not** `then`. Verified by running the real gate: `biome check`
 * reports `This object defines a then property` on any object LITERAL carrying that
 * field -- so on the Zod schema, on every test sample and on every playground formula.
 * `lint/suspicious/noThenProperty` is an error in the `recommended` preset this repo
 * enables, so `pnpm run lint` fails and the CI with it. A `biome-ignore` is no way out:
 * AGENTS.md 1.1 forbids it without written justification, and it would have to be placed
 * at every literal site. The rename costs nothing today -- and a migration after v1.0.
 *
 * Both branches are REQUIRED. An optional `whenFalse` would decide the absence policy on
 * the author's behalf, which is the one thing this kind exists to avoid.
 */
export interface ConditionalExpression {
  readonly kind: 'if';
  /** The full algebra, like every other predicate position: nothing is narrowed here. */
  readonly when: Expression;
  readonly whenTrue: PrintableExpression;
  readonly whenFalse: PrintableExpression;
}

/**
 * A reduction over a list: `sum(invoice.lines, line, line.total)`.
 *
 * ## Exactly the shape of a LoopNode
 *
 * `source`/`as`/`value` against `each`/`as`/`children`, and that is the most important
 * result of this lot rather than a coincidence. The Designer reuses the loop widget, the
 * scope is explicit so a formula bar can SHOW where it applies (lot D7), and the
 * evaluation reuses `evaluateSequence` and `childScope` **without modifying either**: the
 * machinery ADR 0002 delivered turns out to be exactly what the heaviest lot of the
 * contract needed. No second scope primitive, no reserved name, and no new shadowing
 * *mechanism*.
 *
 * The formula is "no new mechanism", not "no new shadowing": `aggregate.as` and
 * `filter.as` are two new SITES where an alias can shadow a caller key, and
 * `sum(invoice.lines, invoice, invoice.total)` is writable. What does not change is the
 * resolution RULE, which `childScope` already carried for `LoopNode.as`. The consequence
 * is documented as a third limit on `collectDataPaths` -- writing "no new shadowing" would
 * do exactly what ADR 0002 reproached the old docstring for: promise, and lie.
 */
export interface AggregateExpression {
  readonly kind: 'aggregate';
  readonly op: AggregateOperator;
  /** A path, or a `filter` -- anything list-valued. Evaluated in the ENCLOSING scope. */
  readonly source: Expression;
  readonly as: string;
  readonly value: PrintableExpression;
}

/** How many elements a list has. One field, because `count(filter(...))` is the composition. */
export interface CountExpression {
  readonly kind: 'count';
  readonly source: Expression;
}

/**
 * The elements of a list that satisfy a predicate. LIST-VALUED, therefore outside the
 * printable sub-algebra and refused in a print position.
 *
 * ## Why a kind, and not a `where?` on the aggregate
 *
 * A `where?` drags an `as?` along with it -- a `count` without a `where` needs no alias,
 * with one it does -- which is two-storey conditional optionality under
 * `exactOptionalPropertyTypes`, and a Zod message of the form "required unless..." that
 * lot C8 could not render legibly. Composition replaces optionality, and **every field
 * stays required everywhere**.
 *
 * An unbilled benefit: `LoopNode.each` is already typed `Expression`, so "repeat only the
 * lines that were not cancelled" becomes expressible **without touching the loop node**.
 */
export interface FilterExpression {
  readonly kind: 'filter';
  readonly source: Expression;
  readonly as: string;
  readonly where: Expression;
}

/**
 * Joins texts. At least two parts -- one part is the part itself, and zero is nothing.
 *
 * `concat` refuses a NUMBER, like the whole algebra has refused coercion since ADR 0001.
 * Wrap it in {@link TextExpression} instead. It is also the only kind that PRODUCES data
 * rather than reducing it, which is why it carries its own bound: measured on a balanced
 * `concat(x, x)` tree over a 1 kB string, depth 12 gives a 237 kB model and a 4 MB string,
 * and depth 18 gives a 15 MB model and a **268 MB** string with 858 MB of RSS. The
 * amplification is 2^depth times the longest string in the data.
 */
export interface ConcatExpression {
  readonly kind: 'concat';
  readonly parts: readonly PrintableExpression[];
}

/**
 * EXPLICIT stringification: the canonical form of a value, never a display format.
 *
 * The canonical case -- gluing a label to a number the integrator supplies as a number --
 * has to stay writable: `concat('N° ', text(cmd.numero))`. One field, and it makes the exact
 * place a value becomes text visible **in the tree**. Without it the whole "Texts" family
 * would be unusable as soon as the datum is numeric; with implicit stringification there
 * would be an operator that adds or concatenates depending on the data, which is
 * uninterpretable in a formula bar.
 *
 * It yields `String(value)` for a finite number and the string unchanged for a string --
 * **no thousands separator, no currency symbol, no locale**. Formatting belongs to lot C6;
 * doing it here would be a format position *de facto*, the same mistake as the implicit
 * rounding refused for `percentOf`. A boolean, a list and an object are REFUSED:
 * `text(true)` would print `true` into a document, exactly what a print position has
 * forbidden since ADR 0002. An absent value propagates absence, like everywhere else.
 */
export interface TextExpression {
  readonly kind: 'text';
  readonly value: PrintableExpression;
}

export interface TextCaseExpression {
  readonly kind: 'textCase';
  readonly op: TextCaseOperator;
  readonly text: PrintableExpression;
}

/**
 * "Due date = invoice date + 30 days". No convention to choose, so it passes the
 * admissibility test of ADR 0003 decision 5.
 *
 * The date is a `YYYY-MM-DD` string and the shift a whole number of days. A literal date is
 * validated AT PARSE TIME: a path cannot be checked when a template is saved, but a literal
 * can, and the repository's doctrine is explicit at exactly that point.
 */
export interface DateAddExpression {
  readonly kind: 'dateAdd';
  readonly date: PrintableExpression;
  readonly days: PrintableExpression;
}

/**
 * The number of days between two dates the caller SUPPLIED.
 *
 * "Days overdue" is `dateDiff(cmd.echeance, X)` where `X` is a datum the integrator provides
 * under whatever name it likes -- exactly like the total or the number. There is no `today`
 * to reserve and nothing to reserve it for: the only rule left is technical, and it is that
 * the engine does not read the clock (roadmap E6).
 */
export interface DateDiffExpression {
  readonly kind: 'dateDiff';
  readonly from: PrintableExpression;
  readonly to: PrintableExpression;
}

/** "45 days end of month" is `endOfMonth(dateAdd(d, 45))`. See `civil-date.ts`. */
export interface EndOfMonthExpression {
  readonly kind: 'endOfMonth';
  readonly date: PrintableExpression;
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
export type PrintableExpression =
  | LiteralExpression
  | PathExpression
  | ArithmeticExpression
  | PercentOfExpression
  | AggregateExpression
  | CountExpression
  | ConditionalExpression
  | ConcatExpression
  | TextExpression
  | TextCaseExpression
  | DateAddExpression
  | DateDiffExpression
  | EndOfMonthExpression;

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
 * is structural: a kind added to none of them fails to compile here instead of
 * quietly belonging to nothing.
 */
export type Expression = PrintableExpression | PredicateExpression | FilterExpression;

export type ExpressionKind = Expression['kind'];

import type { Typography } from './types.js';

/**
 * The two places a run's typography can be declared, and NOWHERE ELSE.
 *
 * `run` is the text segment that carries the characters; `block` is the text node that holds
 * it. There is no third term -- no `Template` baseline, no ancestor, no inheritance -- and the
 * absence is a decision, not an omission.
 */
export interface TypographySources {
  readonly run?: Typography | undefined;
  readonly block?: Typography | undefined;
}

/**
 * Merges the two declared sources PROPERTY BY PROPERTY, the run winning each one.
 *
 * ## What it returns, and why the name does not say "resolved"
 *
 * A {@link Typography}, whose five fields stay optional. An earlier draft returned a
 * `ResolvedTypography` defined by mapping every key of `Typography` to a required one, and that
 * type RESOLVES NOTHING: making a KEY required does not make its VALUE defined, and the value
 * type already contains `undefined` because `exactOptionalPropertyTypes` demands it. MEASURED,
 * twice and independently, five diagnostics:
 *
 *     error TS2322: Type 'string | undefined' is not assignable to type 'string'.
 *
 * A consumer calling something named `resolve` and receiving something named `Resolved` would
 * still have to invent five values. A NAME THAT PROMISES WHAT THE TYPE DOES NOT DELIVER IS
 * WORSE THAN NO NAME -- the same reproach this lot levels at a `Color` that is a bare `string`,
 * and the remedy is symmetrical: say the truth in the name and in the docstring.
 *
 * The five missing values are named as a DEBT in ADR 0007, with their owners (lots E1 and V1),
 * because an expectation of the engine belongs in an ADR and never in a docstring.
 *
 * ## Why two terms and not one -- the figure IS the argument
 *
 * MEASURED on the playground model. "One font, one size, for the whole invoice" -- the most
 * banal declaration an invoice template makes -- costs, written per SEGMENT (41 sites),
 * +123 values (+22.4 %); written per TEXT NODE (20 sites), +60 values (+10.9 %); written in a
 * single document baseline, +3 values (+0.5 %). A contract refusing BOTH the node and the
 * baseline offers no way to say "this invoice is in Helvetica 10" other than writing it 41
 * times. The second term halves the cost with no product mandate; a third would divide it by 41
 * WITH one, and that is an open arbitration.
 *
 * ## Why exported, and NOT on the `printableAreaOf` argument
 *
 * A nullish fallback has no floating-point representation: two implementations of "the run's
 * family, else the block's" cannot diverge, so the `printableAreaOf` motive -- measured,
 * `215.9 - (25.4 + 25.4)` is `165.10000000000002` where `(215.9 - 25.4) - 25.4` is `165.1` --
 * DOES NOT APPLY here, and citing it would be invoking a precedent that does not hold. The
 * motive that does hold is `Template.page`'s: A CONVENTION WRITTEN ONCE IN `core` BEATS A
 * CONVENTION REINVENTED BY EVERY RENDERER, "with nothing checking that the viewer invents the
 * same one". What is exported is an ORDER OF RESOLUTION, not an arithmetic.
 *
 * The objection that this is the cascade ADR 0004 decision 8 declared irreversible is answered
 * and the answer is narrow: that decision refused an override, then an ancestor, then a
 * document field -- THREE terms, one of them a stored DOCUMENT field whose removal would need a
 * transforming migration. Here there are two, neither is on the document, and a structural
 * one-level inheritance already exists unchallenged in this contract (`TableColumn.align`,
 * "Inherited by every cell of this column"). What would reopen the objection is a third term.
 */
export function resolveTypography(sources: TypographySources): Typography {
  const { run, block } = sources;
  return {
    family: run?.family ?? block?.family,
    sizePt: run?.sizePt ?? block?.sizePt,
    bold: run?.bold ?? block?.bold,
    italic: run?.italic ?? block?.italic,
    color: run?.color ?? block?.color,
  };
}

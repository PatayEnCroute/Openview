import type { TableColumnAlignment, TextAlignment } from '../ast/types.js';
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

/**
 * The two places the alignment of ONE TEXT BLOCK can come from: the block, or its column.
 *
 * VALUES and not objects, unlike {@link TypographySources}, and the asymmetry has a reason: a
 * per-property merge needs the objects, a single property does not. What the named object buys
 * is that the two terms cannot be passed in the wrong order -- which is the whole risk in a
 * function whose body is one nullish fallback.
 *
 * ## The two fields have DIFFERENT TYPES, and that is the contract, not an oversight
 *
 * `text` is a `TextAlignment`: four members, `justify` included. `column` is a
 * `TableColumnAlignment`: three, and a column cannot declare `justify` because a column
 * justifies nothing -- it states a default, and it is the run that gets stretched. The second
 * type being a STRICT SUBSET of the first is what lets the body stay a bare fallback with no
 * widening and no assertion, and it is structural: the tuples are derived one from the other.
 *
 * `column` is not optional at its source -- `TableColumn.align` is REQUIRED. It is optional here
 * because a text block outside any table has no column at all.
 */
export interface TextAlignSources {
  readonly text?: TextAlignment | undefined;
  readonly column?: TableColumnAlignment | undefined;
}

/**
 * Says WHERE A TEXT BLOCK'S ALIGNMENT COMES FROM when it sits in a table cell: itself, then its
 * column.
 *
 * ## What this is NOT: a precedence between two declarations of one fact
 *
 * An earlier draft called it that, and it was wrong. A column's alignment and a block's are two
 * DIFFERENT facts that happen to share three value names. The column states the default for the
 * TEXT BLOCKS of its cells; the block distributes ITS OWN runs. A cell holding an image has the
 * first and not the second -- there is no run to align -- and a cell holding two paragraphs has
 * one column default and TWO block alignments, which may differ. Calling that a rivalry made a
 * degenerate case (one cell, one paragraph, where the two coincide) look like the general one.
 *
 * ## Why this function has to exist anyway
 *
 * Because the DEFAULT still has to be resolved somewhere, and a rule of precedence written in
 * prose gets reimplemented twice -- once in the engine, once in the viewer -- with the right to
 * diverge. What is exported is an ORDER, not an arithmetic: a nullish fallback has no
 * floating-point representation, so the `printableAreaOf` motive does not apply here and citing
 * it would be invoking a precedent that does not hold. The motive that does hold is
 * `Template.page`'s: a convention written once in `core` beats one reinvented by every renderer.
 *
 * The block wins because it is the MORE LOCAL declaration and the one an editor Command can
 * address: a cell is not a node, it has no id. The column keeps its meaning unchanged -- ADR
 * 0005 fixed that form twice over: an override "s'ajoute, elle ne déplace pas le champ de
 * colonne", and "la porte reste ouverte dans le seul sens qui ne coûte rien".
 *
 * Returns `undefined` when neither is declared. Which alignment a renderer then applies, how it
 * honours `justify` (last line to `start`, slack between words), and against WHICH WRITING
 * DIRECTION it resolves `start` and `end`, are expectations named in ADR 0007 -- the second site
 * at which this repository inherits that last open question.
 */
export function resolveTextAlign(sources: TextAlignSources): TextAlignment | undefined {
  const { text, column } = sources;
  return text ?? column;
}

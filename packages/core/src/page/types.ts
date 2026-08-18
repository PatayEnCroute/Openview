import type { ContainerNode } from '../ast/nodes.js';

/**
 * The sheet a template prints on, in millimetres.
 *
 * Millimetres, and FRACTIONAL ones, for a measured reason: US Letter is 215.9 mm by
 * 279.4 mm, so whole millimetres would make it inexpressible -- in a product whose
 * decision 11 requires two languages and two currencies. And no decimal-place bound
 * polices those values either: `279.4 * 100` is `27939.999999999996` in IEEE-754, so
 * the obvious "at most two decimals" check REFUSES a standard paper size. Finiteness
 * is already covered -- `z.number()` refuses `NaN` and `Infinity` on its own.
 *
 * Orientation is NOT a field: a landscape A4 is `{ width: 297, height: 210 }`. A
 * separate flag would be a second source of truth for one fact, hence an invariant to
 * police for a state that should not be expressible at all.
 */
export interface Sheet {
  readonly width: number;
  readonly height: number;
}

/**
 * The four edges, in millimetres, all four required.
 *
 * No shorthand (`margins: 20`), no pair (`{ vertical, horizontal }`), no inheritance: a
 * second spelling of one fact means two stored shapes, two refusal paths and a
 * `printableAreaOf` that starts by normalising. Zero is legal -- a full-bleed label, or
 * a template that manages its own gutter -- because refusing it would be a rule of
 * typography, and this contract states no rules.
 */
export interface PageMargins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Which pages a band appears on.
 *
 * Five values, and they form a system rather than a menu: `every` alone, or the pair
 * `firstOnly` + `exceptFirst`, or the pair `exceptLast` + `lastOnly`. Without `exceptLast`, a
 * template wanting a different last-page footer would get BOTH bands on that page, because
 * `every` includes the last one; `exceptFirst` is the same argument at the other end of the
 * document. The order of this tuple is reading order -- all, then the opening pair, then the
 * closing one -- and it is what `z.enum` prints in a refusal.
 *
 * THERE IS NO THIRD PAIR, and that is measured rather than intended: of the twenty-five
 * couples, exactly TWO are compatible, and since they share no member A SIDE CAN NEVER CARRY
 * MORE THAN TWO BANDS. It is also why the occurrence is a tuple and not a set of booleans:
 * booleans would make the incompatible combinations expressible.
 *
 * The system is ENFORCED, not merely described: `PageSetupSchema` refuses two bands on one
 * side whose page domains can overlap -- see BAND_OCCURRENCE_CONFLICTS. Refusing only
 * DUPLICATE occurrences would leave `every` + `lastOnly` expressible, which is two bands on
 * the last page: the very ambiguity the refusal exists to remove.
 *
 * ON A ONE-PAGE DOCUMENT, THE LAST PAGE IS ALSO THE FIRST. A template whose running footer is
 * `exceptLast` prints no running footer at all on a single-page invoice, because `exceptLast`
 * applies to no page; symmetrically, `exceptFirst` never appears. That is the correct
 * behaviour -- the page IS both -- and refusing it would be a layout rule, which this contract
 * does not state. It is written here because the author of the first delivered template must
 * not discover it in a PDF. The same fact is why `firstOnly` + `lastOnly` IS refused: an empty
 * domain is benign, two domains meeting on one sheet is ambiguous.
 *
 * `firstOnly` and `exceptFirst` are DECIDABLE WITHOUT PAGINATING -- page 1 is known before any
 * layout -- so unlike the closing pair they add no oscillation hazard for the engine.
 */
export const PAGE_BAND_OCCURRENCES = [
  'every',
  'firstOnly',
  'exceptFirst',
  'exceptLast',
  'lastOnly',
] as const;

export type PageBandOccurrence = (typeof PAGE_BAND_OCCURRENCES)[number];

/**
 * A repeated region of the sheet, and a document fragment exactly like
 * `Template.root` -- which is why `content` is a `ContainerNode` and not a bare block
 * list. The container brings three things for free: a stable id, so an editor Command
 * can address a band without a field of its own; compatibility with every existing
 * traversal, all of which already accept a `ContainerNode`; and the `BlockNode` cut of
 * lot C3, so a bare `tableRow` inside a band is refused without one line of this lot.
 *
 * The band says WHERE it goes and ON WHICH pages. It says nothing about how the engine
 * repeats it, nor what happens when it does not fit: that belongs to E2 and E3, and
 * writing engine behaviour into the contract is the mistake lot C3 had to undo in its
 * own docstrings.
 *
 * NOTHING BOUNDS WHAT A BAND CONTAINS, and its height can therefore depend on the data: the
 * children of `content` are the whole `BlockNode` union, `loop` and `table` included. That is
 * not an oversight -- refusing it would take a recursive walk of every band, and a header
 * repeating two or three customer references is legitimate. No field of this contract could
 * catch it either, because catching it would mean MEASURING. What follows for a renderer is
 * recorded in ADR 0006, which is where an expectation of the engine belongs: writing engine
 * behaviour into the contract is the mistake lot C3 had to undo in its own docstrings.
 */
export interface PageBand {
  readonly on: PageBandOccurrence;
  readonly content: ContainerNode;
}

/**
 * Everything a template says about the paper.
 *
 * Not a node. A sheet has no position in the flow, no siblings and no rank, so it is a
 * field of the document rather than a member of `DocumentNode` -- which also spares
 * `visitNode` a member that could only ever appear at the root, a positional rule this
 * contract has nowhere else and that no `switch` could enforce.
 *
 * Both band lists are REQUIRED and may be empty, and NOT because of the "silent loss" case
 * of `template/template.ts` -- that one is about a key an OLDER build strips, which happens
 * whether the key is optional or required in the newer one. They are required because an
 * empty list and an absent list would be two spellings of one fact: two shapes to store, two
 * refusal paths, and a consumer that starts by normalising.
 */
export interface PageSetup {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly header: readonly PageBand[];
  readonly footer: readonly PageBand[];
}

/** What `printableAreaOf` returns: two lengths in millimetres, and no origin. */
export interface PrintableArea {
  readonly width: number;
  readonly height: number;
}

/** Below this, a sheet has no printable area at all; `> 0` would admit 0.0001 mm. */
export const MIN_SHEET_MM = 1;

/**
 * 200 inches, and it is an OPENVIEW INTEROPERABILITY BOUND -- not a limit of the PDF format.
 *
 * Saying "the largest page a PDF reader is required to handle" would be wrong, and an
 * earlier draft of this file said it: 200 inches is the historical ceiling of PDF's default
 * user space (14 400 units at 1/72 inch), but PDF 1.6 added the `UserUnit` scale factor,
 * which makes larger pages expressible. So this is a bound this product chooses, at a value
 * borrowed from what readers have historically accepted without scaling.
 *
 * EXTERNAL KNOWLEDGE, not verified in this repository: no engine exists yet, so nothing here
 * confirms the figure, and lot E1 owes it a throwaway probe -- against the PDF adapter
 * actually chosen, not against a specification. What the bound protects is independent of
 * its exact value: without a ceiling, `1e308` mm is a valid document whose printable area is
 * infinite.
 */
export const MAX_SHEET_MM = 5080;

/**
 * Standard sheets, in millimetres, as a CONVENIENCE and never as a stored shape.
 *
 * A designer writes `{ ...STANDARD_SHEETS_MM.a4 }` into a template; the template stores
 * two numbers. That is the whole point: a size added here costs nothing, where a stored
 * `format: 'a4' | 'a5'` enum would cost a schema version and a migration for every paper
 * size ever asked for -- and would make an unlisted size inexpressible.
 *
 * Openview reserves no name here either: this table is read by whoever wants it and
 * ignored by the contract.
 *
 * `as const satisfies` rather than an annotation, and the reason is measured: annotated
 * `Readonly<Record<string, Sheet>>`, `STANDARD_SHEETS_MM.a4` is `Sheet | undefined` under
 * `noUncheckedIndexedAccess` -- so every consumer, the recipe fixture included, would have
 * to handle an absent A4. `satisfies` keeps the literal keys and still checks every entry
 * against `Sheet`.
 */
export const STANDARD_SHEETS_MM = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
  tabloid: { width: 279.4, height: 431.8 },
} as const satisfies Readonly<Record<string, Sheet>>;

/** The names of the convenience table, for a picker. Never a stored value. */
export type StandardSheetName = keyof typeof STANDARD_SHEETS_MM;

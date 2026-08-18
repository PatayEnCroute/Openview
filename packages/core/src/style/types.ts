import { MAX_SHEET_MM } from '../page/types.js';
import { ptFromMm } from './units.js';

/**
 * A colour, as six hexadecimal digits behind a hash: `#1b3a6f`.
 *
 * ## This alias is DOCUMENTATION. It forbids nothing, and that is measured
 *
 * `const notAColour: Color = 'Total TTC'` compiles. So does `''`, so does `'EB Garamond'`
 * passed where a colour is expected -- MEASURED at exit 0, five misuses, none refused. The
 * entire guarantee is {@link ColorSchema} at runtime. Written that way the alias is honest;
 * left unsaid it advertises a guard that does not exist, which is the reproach this lot levels
 * at a type called `ResolvedTypography` that resolved nothing.
 *
 * A BRANDED type would make it real, and it is refused for a mechanical reason rather than a
 * stylistic one: constructing a branded value takes an assertion, and AGENTS.md 1.1 forbids
 * both spellings of one (`as unknown as`, and the angle-bracket form the linter cannot even
 * see).
 *
 * ## The six digits are interpreted in sRGB, and the contract SAYS so
 *
 * `#1b3a6f` is a triplet of bytes; it is not a COLOUR until it is referred to a colour space.
 * A PDF engine may write `DeviceRGB` (whose interpretation is left to the reader), an ICC sRGB
 * profile, or convert to CMYK; a browser viewer renders sRGB. That is three colours for one
 * triplet, in a product whose decision 7 promises identity and whose `docs/qa/README.md`
 * hardens it to "to the pixel". MEASURED: a search for a colour space over `packages apps
 * docs` yielded ZERO occurrences, so this contract is the first place the question can be
 * settled -- and it settles it by TAKING the convention, exactly as it takes the millimetre.
 *
 * ## Both cases, no short form, no alpha channel
 *
 * `#FFAA00` and `#ffaa00` are both accepted, because `#FFAA00` is what every design tool
 * emits and refusing the most ordinary copy-paste of the trade is hostile. This CONTRADICTS a
 * precedent of this repository and the contradiction is named rather than hidden:
 * `page/types.ts` refuses `margins: 20` beside four edges as "a second spelling of one fact".
 * The difference is measurable -- a shorthand and a quadruplet are two shapes a consumer must
 * NORMALISE, whereas two letter cases are one shape read by one regular expression, with no
 * expansion. `#fa0` would need an expansion: refused.
 *
 * WHAT THE DOUBLE CASE COSTS, and a consumer has to know it: an EQUALITY COMPARISON between
 * `#FFAA00` and `#ffaa00` fails. Sixty-four spellings are storable for a six-digit alphabetic
 * colour (two to the sixth, measured), so an editor that highlights "every block of the same
 * colour", or a V3 parity check, FOLDS THE CASE before comparing. Nothing in this contract
 * folds it for them, because normalising on parse would rewrite the author's document.
 *
 * No alpha channel: `#1b3a6fff` is refused (measured), and the reason is ownership rather than
 * taste. COMPOSITION is a rendering model, hence the layers of lot C11 / decision 10. A
 * refusal nobody wrote down is a refusal that reopens with the first client.
 */
export type Color = string;

/**
 * The form of the characters. Five declarations, all optional, none of them content.
 *
 * ## Why five fields and not six, and where the sixth went
 *
 * `core.md` lists ten attributes in six groups; this type carries five of them -- "polices et
 * tailles", "graisse et italique", "couleurs de texte". What is NOT here and would look like
 * it belongs: a LINE HEIGHT (a line has a height only once it has a font, hence font metrics,
 * hence reading the machine -- and it is the field the two-decimal trap really bites, `1.15`
 * measured), a LETTER SPACING (same argument, and measured: the word appears nowhere in this
 * repository, so no text promises it), a FALLBACK STACK (a fallback is a POLICY, lot E6's),
 * and a `textTransform` (it changes the CHARACTERS a reader reads, and the algebra already
 * carries `textCase` -- two spellings of one fact).
 *
 * ## Why `bold` is a boolean and not a numeric scale
 *
 * MEASURED, on the numeric window a previous draft of this contract proposed: an integer
 * window from 100 to 900 admits 801 values, 792 of them not multiples of 100, and
 * `weight: 450` is ACCEPTED. A font carries a FINITE, DISCRETE set of faces; `450` designates
 * none of them, so honouring it obliges an engine to CHOOSE -- nearest face? the one below?
 * synthetic emboldening? -- and that choice is a policy this contract does not state. Two
 * engines that choose differently produce two documents, against decision 7. A boolean is what
 * the roadmap literally writes, "graisse et italique" side by side, two symmetrical booleans;
 * and widening to a scale later is a WIDENED UNION, hence a stamp, which is the cheapest class
 * of change.
 *
 * ## Why all five are optional, and what that costs
 *
 * Because nothing else in this contract decides them: there is no cascade, no document
 * baseline and no schema default. `resolveTypography` therefore returns five `T | undefined`,
 * and WHO decides the missing five is an expectation named in ADR 0007 -- never in a docstring,
 * which is the mistake lot C3 had to undo in its own.
 *
 * ## An empty object is REFUSED, and the canonical spelling of "no typography" is the absent
 * field
 *
 * The schema refuses it on every one of these three shapes -- this one, {@link BoxStyle} and
 * {@link BoxBorder} -- and only once nothing else about the object has gone wrong, which is the
 * cut-off rule `checkTableWiring` already states.
 *
 * An earlier draft accepted an empty object and declared it "equivalent to absence", on the
 * ground that `typography?.family` yields `undefined` either way. That is true OF A VALUE READ
 * and false of everything else: a diff reports a change where nothing changed, a dirty-state
 * flag marks a document an author only looked at, a content hash gives one document two
 * fingerprints, an undo/redo history records a Command that did nothing, and `JSON.stringify`
 * keeps an empty object while dropping `undefined` -- so two "equal" trees are not equal. Four
 * of those five consumers are already planned, and NOT ONE OF THEM READS A VALUE.
 *
 * This is the rule `page/types.ts` states for its band lists, applied here: "an empty list and
 * an absent list would be two spellings of one fact: two shapes to store, two refusal paths,
 * and a consumer that starts by normalising". That file removes the second spelling by making
 * the field REQUIRED; this one cannot, so it removes it by refusing it. The normalising stays,
 * but it moves to the PRODUCER -- an editor drops a `box` it emptied -- and one producer that
 * normalises beats N consumers that do.
 *
 * The predicate is on VALUES and not on `Object.keys`. Under `exactOptionalPropertyTypes` an
 * in-memory object can carry a key whose value is `undefined`: the key is there, the value is
 * not, and a key count yields one. That would be a THIRD spelling, introduced by the very
 * guard meant to leave one.
 */
export interface Typography {
  /**
   * A family name, and this contract stores NOTHING ELSE -- not a stack, not a URL, not a
   * metric.
   *
   * It is the ONE named exception to this lot's membership criterion: an engine cannot honour
   * it without resolving a resource, which is measuring. It enters anyway on two mechanical
   * arguments -- `core.md` puts "polices" at the head of this lot's scope, and the boundary is
   * already drawn INSIDE the subject by `engine.md`, which distinguishes DESIGNATING a
   * resource from LOADING it. This contract designates.
   *
   * ## The hazard, recorded rather than hidden
   *
   * A family name is a DECLARATION, and this contract does not police what the name resolves
   * to. MEASURED, ten values that a non-empty-string check accepts and that name no font at
   * all but whatever THE HOST MACHINE has installed: `system-ui`, the five CSS generic
   * families, `-apple-system`, `BlinkMacSystemFont`, `ui-rounded`, `emoji`, `math`,
   * `fangsong`. A template storing one of them renders differently on two machines -- which is
   * what lot E6 forbids and what lot E8 must bound.
   *
   * The schema does not refuse them, and that is a decision with a reason: refusing the string
   * `serif` would refuse a font genuinely called "Serif", and refusing a LIST of values would
   * freeze a blacklist of CSS conventions inside a contract that publishes none. So the hazard
   * is written here -- the one place an integrator reads -- and named as a debt in ADR 0007,
   * which is the treatment `TABLE_COLUMN_ALIGNMENTS` already gives to writing direction.
   */
  readonly family?: string | undefined;
  /**
   * A size in POINTS, and the field carries its unit because it is the exception.
   *
   * Points and not millimetres, and the argument that refused points for a MARGIN does not
   * transpose: ADR 0006 discarded them as "illisibles pour l'auteur (« marge de 57 points »)",
   * and "a 10 point font" is the most legible form that exists for a size -- it is the only
   * unit an invoice author uses spontaneously. MEASURED, 10 pt is NOT representable in
   * millimetres: `mmFromPt(10)` is `3.5277777777777777`. The point is also the unit of PDF
   * user space, so a size crosses the engine without conversion.
   *
   * The window is {@link MIN_FONT_SIZE_PT} to {@link MAX_FONT_SIZE_PT} and there is NO
   * decimal-place bound, on the precedent `page/schemas.ts` applies rather than argues:
   * finiteness and two bounds suffice, `z.number()` already refusing `NaN` and `Infinity`.
   * ADR 0006 warns the next lot that "la même formule paraîtra tentante en C5 pour une taille
   * de police" -- the warning is right in principle and WRONG in its example, measured: of the
   * half-points from 6 to 72 pt, a two-decimal integrality check refuses NONE. It bites a RULE
   * WIDTH of 0.28 mm, which is 0.8 pt, a standard editorial thickness.
   */
  readonly sizePt?: number | undefined;
  /** The bold face of the declared family. See the type docstring for why this is not a scale. */
  readonly bold?: boolean | undefined;
  /** The italic face. Symmetrical with `bold`, which is how the roadmap words the pair. */
  readonly italic?: boolean | undefined;
  /** The colour of the characters. Six hexadecimal digits in sRGB -- see {@link Color}. */
  readonly color?: Color | undefined;
}

/**
 * One edge of a box border: a thickness and a colour, both required.
 *
 * Both required, because an edge with no colour is not a lighter declaration, it is an
 * incomplete one -- the engine would have to invent the colour, and inventing is what this
 * contract pushes out of render files. Absence is spelt by the edge not being there at all,
 * which is what makes the four fields of {@link BoxBorder} optional.
 *
 * ## A positive width and NOT a floor of zero -- a CANONICAL FORM rule, not a rule of
 * typography
 *
 * A zero thickness would be a SECOND SPELLING of "no rule", and the first one already exists:
 * the edge not being there. So the schema refuses zero, and the message carries its own
 * remedy: "A rule has a positive width; omit the edge to declare no rule".
 *
 * The precedent that seems to forbid this does NOT transpose, and the reason is one line above
 * it in `page/types.ts`: "The four edges, in millimetres, ALL FOUR REQUIRED." A margin cannot
 * be absent, so `top: 0` is the ONLY way to write "no margin at the top", and refusing it would
 * indeed "be a rule of typography" -- it would forbid a legitimate document. {@link BoxBorder}
 * has the opposite shape: its four edges are OPTIONAL. The precedent says "do not refuse the
 * only available spelling"; here it is not the only one.
 *
 * The second objection -- "a positive-width check admits 0.0001 mm, and MEASURED, `5e-324`
 * passes" -- does not discriminate, and an earlier draft of this contract used it to settle a
 * question it does not answer. A floor of zero ADMITS 0.0001 mm too. That objection opposes
 * "greater than zero" to "at least one", which is the `MIN_SHEET_MM` question, and says nothing
 * about "greater than zero" against "at least zero". Sub-pixel widths stay representable here
 * as they do on the six other lengths of this contract: this contract bounds WINDOWS, it does
 * not judge the usefulness of a value inside one.
 *
 * A NAMED floor -- `MIN_RULE_WIDTH_MM` -- was the other defensible way out, on the
 * representability argument: one screen pixel at 96 dpi is 0.26458 mm, one press pixel at
 * 300 dpi is 0.08467 mm, so a rule below that is not a rule. It is refused twice over. 96 dpi
 * is a property of the MACHINE, not of the document, so the bound would be an environment read
 * disguised as a constant; and ADR 0006 already discarded a bound that "ne se justifie par
 * aucune mesure".
 *
 * Refusing this today is VACUOUS -- no stored document carries a border edge yet, because the
 * field is born in this lot. Refusing it after the stamp would be a non-vacuous narrowing, i.e.
 * impossible. The question is settled now or never.
 */
export interface BorderEdge {
  readonly width: number;
  readonly color: Color;
}

/**
 * The four edges of a box border, EACH OPTIONAL -- unlike {@link BoxSpacing}.
 *
 * The asymmetry is deliberate and it is the difference between a rule and a length. One edge
 * alone is a RULE ("a line under the total"), which is the most ordinary thing an invoice
 * draws; four edges are a BORDER. A quadruplet of required edges would make a single rule cost
 * three zero-width edges plus three colours nobody chose. A spacing has no such use: a padding
 * with three edges is an author who forgot one, which is why that type requires all four.
 *
 * An empty object is REFUSED, for the reason {@link Typography} states: the absent field is the
 * one spelling of "no border", and a second one costs a diff, a hash and an undo.
 *
 * ## The measured hole this shape opens, and the only net that closes it
 *
 * Because all four are optional, AN ENTIRE EDGE CAN VANISH FROM THE SCHEMA WITHOUT ONE
 * COMPILER DIAGNOSTIC. MEASURED, `top` removed from `BoxBorderSchema`: every type assertion of
 * an earlier draft passed, exit 0, and at runtime the top rule was silently dropped by the
 * parse. The amputated object stays mutually assignable, and `keyof BoxStyle` does not move
 * because `border` is still there. Coverage catches nothing either -- a field absent from the
 * schema is not an uncovered branch, it is a branch that does not exist.
 *
 * The remedy is the one `ast/schemas.ts` already writes twice: "Only a runtime parsing test
 * catches that, and that is why there is one per node type." Read here: ONE PER STYLE FIELD.
 */
export interface BoxBorder {
  readonly top?: BorderEdge | undefined;
  readonly right?: BorderEdge | undefined;
  readonly bottom?: BorderEdge | undefined;
  readonly left?: BorderEdge | undefined;
}

/**
 * Four lengths in millimetres, ALL FOUR REQUIRED, on the exact shape `page/types.ts` imposes.
 *
 * That file states the rule and this lot reproduces it trait for trait, floor of zero
 * included, unsuffixed field names included: "No shorthand (`margins: 20`), no pair
 * (`{ vertical, horizontal }`), no inheritance: a second spelling of one fact means two stored
 * shapes, two refusal paths and a `printableAreaOf` that starts by normalising."
 *
 * Diverging here would have cost more than a convention: a `topMm` beside `PageMargins.top`
 * would be two names for one kind of fact in one contract.
 */
export interface BoxSpacing {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * What a box declares about itself: a background, four border edges, an inner inset.
 *
 * ## Three fields, and the criterion says why there are exactly three
 *
 * A declaration belongs on a box if and only if: (1) it is BLIND TO CONTENT; (2) it changes
 * only what a reader SEES, never the CHARACTERS he reads; (3) an engine can honour it without
 * MEASURING and without INVENTING a policy; (4) ITS VALUE HAS A MEANING ON EVERY CARRIER THE
 * CONTRACT ALLOWS IT ON. Background, border and padding pass all four on all five carriers.
 *
 * Condition 4 is the one that did the work here, and two fields fell to it:
 *
 * - a GAP is OUT. It has no subject at all on an `image` (no children), it means inter-letter
 *   spacing on a `text` (whose children are inline runs), and on a `table` or a `tableRow` it
 *   means a border spacing -- a table layout model. Worse than empty: it would insert into the
 *   PUBLISHED definition of `TableColumn.width` ("A column receives `width / (sum of the
 *   widths of its table)` of whatever width the table itself is given") a subtraction that
 *   formula does not have. This lot cannot obtain by a side door what the column criterion
 *   refuses it to its face.
 * - an ALIGNMENT is OUT, and it lives on `TextNode` alone. It describes how INLINE RUNS sit in
 *   a box, and only a text node has runs. Leaving it here made four of the five carriers
 *   meaningless AND left `TableColumn.align` with a rival and no rule of precedence.
 *
 * A MARGIN is not here either, and that one is a REFUSAL WITH A COST rather than an empty
 * state: two adjacent margins either add up or collapse -- CSS collapses, several PDF engines
 * add -- and CHOOSING is a rendering policy, condition 3. This contract could TAKE the
 * convention, as it takes sRGB, but it would then owe the sum in writing. Without it, a
 * non-uniform vertical rhythm costs one `ContainerNode` per amount of air, counted by
 * `assertBoundedShape`.
 *
 * ## What is NOT expressible through this type, and who owns each refusal
 *
 * No opacity, no shadow, no gradient -- a composition model, hence the layers of lot C11 /
 * decision 10. No collapsing of table borders -- a table layout model. No width and no height,
 * on ANY node: this lot declares no dimension anywhere, which is what keeps `printableAreaOf`
 * the only geometry of the contract. No page background, watermark or paper colour -- ADR 0006
 * ranges those under layers, and the same ADR attributing "la couleur du papier" to this lot
 * elsewhere is a contradiction ADR 0007 records.
 *
 * An empty object is REFUSED, for the reason {@link Typography} states. An editor that opens a
 * style panel and sets nothing legitimately BUILDS one; what it must not do is SAVE one, and
 * dropping it is one line in the producer against four broken consumers downstream.
 *
 * ## What a `padding` means on each of the five carriers -- written, because a stored value
 * whose meaning is not stated is not a contract
 *
 * A box is its given width, less `padding.left + padding.right`; that remainder is its CONTENT
 * WIDTH, and a child occupies it. Two carriers need this spelt out because a table has a
 * published width formula and this field could silently change it:
 *
 * - on a `table`, the column weights resolve against the table's CONTENT width. This completes
 *   `TableColumn.width`'s "of whatever width the table itself is given" rather than
 *   contradicting it: what the table is given is its parent's content width; what it shares is
 *   its own;
 * - on a `tableRow`, the padding insets THE CONTENT OF EACH CELL of that row, identically, and
 *   MOVES NO COLUMN BOUNDARY. Insetting the band instead would shift, for that row alone, the
 *   origin and width the weights resolve against, so the heading columns would no longer line
 *   up with the body's -- the exact defect this lot exists to prevent. It is also the argument
 *   that removed a gap from this carrier, and it does not care which name the field has.
 */
export interface BoxStyle {
  readonly background?: Color | undefined;
  readonly border?: BoxBorder | undefined;
  readonly padding?: BoxSpacing | undefined;
}

/**
 * The floor of the font-size window, and it is `MIN_SHEET_MM`'s argument transposed.
 *
 * A size of zero is not "no text": the characters are still declared, and they would be stored
 * and never shown -- a silent loss, which is what `ast/schemas.ts` refuses for a cell naming
 * an undeclared column. So zero is refused here, where a zero BORDER WIDTH is accepted: an
 * absent rule is a legitimate intent, absent characters are not. And a bare "greater than
 * zero" would admit `5e-324`, which is the written reason `MIN_SHEET_MM` is one.
 *
 * The value is borrowed from that constant along with its reason, not invented here.
 */
export const MIN_FONT_SIZE_PT = 1;

/**
 * The ceiling of the font-size window: `MAX_SHEET_MM` EXPRESSED IN POINTS, and DERIVED from it.
 *
 * ## Why derived and not written down
 *
 * MEASURED, in both directions and in binary64: five thousand and eighty millimetres is exactly
 * fourteen thousand four hundred points, and the conversion back is exact too. So the ceiling
 * of this lot IS the interoperability bound of lot C4, in the other unit -- not a different
 * bound that happens to coincide. An earlier draft of this contract declared its own maximum
 * style length at the same number, which is `MAX_SHEET_MM` under a second name with no link
 * between them.
 *
 * `template/guard.ts` already wrote the rule this repository follows: "The same schema and the
 * same ceiling as `EvaluationLimits`, IMPORTED RATHER THAN RESTATED: two copies of one bound
 * drift, and raising it in one file would leave the other refusing values the first accepts."
 * Three copies of one maximum length is drift guaranteed at the first adjustment.
 *
 * A test pins BOTH halves -- the exact number, and the round trip back to `MAX_SHEET_MM`.
 * Pinning an exact number here is a service and not a redundancy: it is what stops someone
 * from "tidying" the conversion into the pre-computed factor, which yields
 * `5079.999999999999`.
 *
 * ## Why this file imports `../page/types.js` and NOT the `page/page.js` barrel
 *
 * `page/page.ts` asks consumers to come through the barrel. This import does not, and the
 * reason is a MEASURED ESM initialisation failure rather than a preference. `ast/schemas.ts`
 * imports the style schemas as VALUES; the style schemas need this bound at module-evaluation
 * time; and the barrel pulls in `page/schemas.js`, which imports `ContainerNodeSchema` from
 * `ast/schemas.js` -- the module the chain started in. MEASURED, on the emitted JavaScript:
 *
 *     ReferenceError: Cannot access 'ContainerNodeSchema' before initialization
 *
 * `page/types.js` has NO runtime import of its own -- its only import is a type -- so it can
 * never close a cycle. This is exactly the configuration `page/page.ts` warns about in its own
 * docstring, "which is the configuration where ESM initialisation order starts to matter",
 * arriving from the other side. ADR 0007 records the deviation with this measurement.
 */
export const MAX_FONT_SIZE_PT = ptFromMm(MAX_SHEET_MM);

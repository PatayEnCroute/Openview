import type { Expression, PrintableExpression } from '../expression/expression.js';
import type { BoxStyle, Typography } from '../style/style.js';

/**
 * Composite pattern. Containers and leaves are manipulated uniformly through
 * {@link DocumentNode}; traversal lives in ./visitor.ts rather than in a
 * `switch` repeated at every call site.
 *
 * Types are hand-written and bound to their schema with `z.ZodType<T>` on
 * purpose. Letting `z.infer` derive a recursive union is where inference breaks
 * down, and the usual "fix" is a cast that AGENTS.md 1.1 forbids.
 *
 * Every field is `readonly`: the Command history in @openview/designer replaces
 * subtrees instead of mutating them, which is what makes undo/redo deterministic
 * under React 19 concurrent rendering.
 */
interface NodeBase {
  /** Stable across edits. Commands address nodes by id, never by position. */
  readonly id: string;
}

/**
 * A run inside a text block: either fixed characters, or a value read from the
 * render data (ADR 0002, option A1).
 *
 * The discriminant is `kind`, not `type`: `type` belongs to document nodes, and a
 * segment is not a node -- it is the inline content of one. That distinction is
 * the whole point. A binding expressed as a sibling *node* could not say that
 * "Total: " and the value belong on the same line, because the Composite is a
 * tree of blocks with no notion of inline flow.
 */
export interface TextLiteralSegment {
  readonly kind: 'literal';
  readonly text: string;
  /** The form of THIS run's characters. Overrides {@link TextNode.typography} field by field. */
  readonly typography?: Typography | undefined;
}

export interface TextBindingSegment {
  readonly kind: 'binding';
  /**
   * The printable sub-algebra, not the whole of it. `compare`, `logical`, `not` and
   * `isEmpty` are predicates, and a print position that accepted them would let a
   * template print `true` into an invoice. The two sibling expression positions each
   * enforce their own result kind at evaluation (`evaluatePredicate` refuses a
   * non-boolean, `evaluateSequence` a non-list); this one enforces it at save time,
   * where the narrowing costs no migration.
   *
   * ADR 0003 WIDENED this position from `literal | path` to every printable kind, so a
   * binding can now carry a computed amount. What it refuses is unchanged -- see
   * {@link PrintableExpression} for the guarantee, and for the reason a boolean
   * *literal* was never covered by it.
   */
  readonly value: PrintableExpression;
  /** The form of THIS run's characters. Overrides {@link TextNode.typography} field by field. */
  readonly typography?: Typography | undefined;
}

/** The two page facts a template can print. Exported as a tuple: a type cannot be iterated. */
export const PAGE_FIELDS = ['number', 'count'] as const;

export type PageField = (typeof PAGE_FIELDS)[number];

/**
 * A page fact only a paginator knows: which page this is, or how many there are.
 *
 * NOT an expression, and that distinction carries the whole decision. A segment is
 * resolved by the render pipeline, never by `evaluateExpression`, so `core` gains no
 * third evaluation input, no page-aware operand and no reserved key in the caller's
 * data. `nodes.ts` already writes the underlying rule: "a segment is not a node -- it
 * is the inline content of one".
 *
 * The consequence to accept: a page field is NOT readable by a predicate. "Only on the
 * last page" stays a declared region rather than a derived condition -- and that is a
 * property, not a limitation. A page number a predicate can read lets content depend on
 * pagination, which depends on content: `if(eq(page, pages), mentions, nothing)` changes
 * what fits on the last page, hence the total, hence the condition. There is no fixed
 * point to converge to, and the symptom is a pagination that oscillates -- a
 * non-deterministic render from an engine that reads neither clock nor randomness. E6 is
 * one of the four things the roadmap never sacrifices.
 *
 * One kind carrying a closed field rather than two kinds, because that is this
 * repository's idiom: a kind names a NATURE, a closed tuple names the instance --
 * `arithmetic` carries `op`, `textCase` carries `op`, `round` carries `mode`.
 *
 * Legal ANYWHERE a text segment is legal, not only inside a page band. Restricting it
 * would require knowing a segment's ANCESTORS, which no local Zod schema can do: it
 * would take a template-wide walk at save time, and it would be the contract's first
 * positional rule. Printing "page 3" inside the flow is legitimate; the engine
 * substitutes the number of the page the segment lands on.
 *
 * What this contract does NOT carry, and who does: the VALUE (the paginator, lots E2 and
 * E3), the display FORMAT of that value -- language, digits, "sur" against "of" (lot
 * C6), the POSITION on the sheet (a page band already says where), and any starting
 * number, reset or per-section numbering (there are no sections in this contract).
 */
export interface TextPageFieldSegment {
  readonly kind: 'pageField';
  readonly field: PageField;
  /**
   * The form of the substituted number's characters. A page number has a font.
   *
   * Carrying a STYLE here is coherent; carrying an EXPRESSION would reopen the feedback loop
   * this kind exists to close, and no style position of this contract accepts one.
   */
  readonly typography?: Typography | undefined;
}

export type TextSegment = TextLiteralSegment | TextBindingSegment | TextPageFieldSegment;

export interface TextNode extends NodeBase {
  readonly type: 'text';
  /** An empty run list is legal: a blank paragraph is a layout intent. */
  readonly content: readonly TextSegment[];
  /** The box this block occupies: background, rules, inner inset. See {@link BoxStyle}. */
  readonly box?: BoxStyle | undefined;
  /**
   * The form of the characters of every run that declares none of its own.
   *
   * The SECOND of the two terms `resolveTypography` merges, and the last: there is no third.
   * "This invoice is in Helvetica 10" written here costs +60 values (+10.9 %) on the playground
   * model, against +123 (+22.4 %) written on all 41 segments -- measured, and it is the whole
   * argument for this field existing beside the segment one.
   */
  readonly typography?: Typography | undefined;
  /**
   * How this block's INLINE RUNS are distributed inside its own box, and THE ONLY NODE THAT
   * CARRIES IT.
   *
   * Nowhere else, because nowhere else has runs: on an `image` it would be a cropping policy;
   * on a `container` the cross-alignment of block children, a layout model; on a `table` there
   * is nothing to align, since a table occupies its parent's content width; on a `tableRow` it
   * would be EXACTLY {@link TableColumn.align} under a second name.
   *
   * ## This is NOT the same fact as {@link TableColumn.align}, and the type says so
   *
   * That field is the DEFAULT of this one for the text blocks of a column's cells. It does not
   * move an image, a container or a box -- nothing in this lot declares a block width, so every
   * block fills its cell's content width and there is nothing to move. `resolveTextAlign` is
   * the one spelling of where the default comes from, and the column field is untouched: an
   * override "s'ajoute, elle ne déplace pas le champ de colonne" (ADR 0005).
   *
   * ## Its own tuple, and `TABLE_COLUMN_ALIGNMENTS` is a STRICT SUBSET of it
   *
   * {@link TEXT_ALIGNMENTS} adds `justify`, which a COLUMN cannot declare and a text block can.
   * The subset relation is structural -- the tuple is derived by spread -- so the contract
   * cannot drift into two unrelated vocabularies, and resolving one against the other compiles
   * with no widening and no assertion.
   */
  readonly align?: TextAlignment | undefined;
}

export interface ImageNode extends NodeBase {
  readonly type: 'image';
  readonly src: string;
  readonly alt?: string | undefined;
  /**
   * The box this block occupies: background, rules, inner inset. See {@link BoxStyle}.
   *
   * And NO dimension, here or anywhere: this lot STORES no width and no height on any node,
   * which is what keeps `printableAreaOf` the only geometry of the contract. A width is not
   * absent from the product, it is DERIVED -- an image occupies its parent's content width --
   * so shaping a logo is a container and its `padding`, to the millimetre, with no field here.
   *
   * What that leaves to an engine is the HEIGHT, which follows the resource's intrinsic ratio;
   * that ratio is a measurement OF THE RESOURCE, which is the whole reason a width alone
   * cannot be stored. Named as an expectation in ADR 0007, not decided here.
   */
  readonly box?: BoxStyle | undefined;
}

export interface ContainerNode extends NodeBase {
  readonly type: 'container';
  readonly children: readonly BlockNode[];
  /**
   * The box this block occupies: background, rules, inner inset. See {@link BoxStyle}.
   *
   * This one field is what gives a PAGE BAND its appearance for free: `PageBand.content` IS a
   * `ContainerNode`, so not one line of `page/` changes. It is also the workaround for the two
   * spacings this lot refuses -- a container per amount of air, and a container around a loop
   * or a condition, which is how "a background per iteration" and "a background around all the
   * iterations" stay DISTINCTLY expressible with no field on those nodes.
   *
   * NO `typography` here, and it is the same refusal from the other side: a container holds no
   * characters, so the only meaning a family could have on it is "it descends" -- a cascade,
   * which this contract makes INEXPRESSIBLE rather than merely forbidding.
   */
  readonly box?: BoxStyle | undefined;
}

/** Repeats its children once per item yielded by {@link LoopNode.each}. */
export interface LoopNode extends NodeBase {
  readonly type: 'loop';
  readonly each: Expression;
  /**
   * The name children read the current item under (ADR 0002, option B1).
   *
   * Declared by the template rather than fixed by the engine, for two reasons:
   * nested loops each name their own item instead of the inner one making the
   * outer unreachable, and a template stops depending on its host application to
   * invent the same name -- which is what `evaluatePredicate(when, { line })` in
   * the playground was doing.
   */
  readonly as: string;
  readonly children: readonly BlockNode[];
}

/**
 * Renders its children only when {@link ConditionNode.when} evaluates to true.
 * Strictly true: see evaluatePredicate, which refuses JavaScript truthiness.
 */
export interface ConditionNode extends NodeBase {
  readonly type: 'condition';
  readonly when: Expression;
  readonly children: readonly BlockNode[];
}

/**
 * How the cells of one column sit inside their column box (lot C3).
 *
 * `start | center | end` rather than `left | center | right`, and **nothing is resolved
 * here.** A column that stores `left` has already decided the writing direction of every
 * language the template will ever be rendered in; `start` DEFERS that decision instead of
 * taking it. Wherever the direction is left-to-right, `start` IS `left`, so the choice
 * costs nothing today, and it avoids a reversal that would be transforming AND undecidable
 * -- from a stored `left`, nobody can tell whether the author meant "left" or "start".
 *
 * WHO declares the direction a renderer resolves this against is not settled by this
 * package, and lot C3 holds no information with which to settle it: the question is
 * recorded as open in ADR 0005, with its options and without a recommendation. One
 * interdiction is already settled and is not reopened by it -- no engine derives that
 * direction from the machine it runs on (lot E6).
 *
 * Three members and no `justify`: justification stretches inter-word space, which is
 * typography, and typography is lot C5.
 */
export const TABLE_COLUMN_ALIGNMENTS = ['start', 'center', 'end'] as const;

export type TableColumnAlignment = (typeof TABLE_COLUMN_ALIGNMENTS)[number];

/**
 * How the inline runs of a {@link TextNode} are distributed inside its own box.
 *
 * DERIVED from {@link TABLE_COLUMN_ALIGNMENTS} rather than declared flat, and the spread is the
 * point: it makes "a column alignment is always a legal text alignment" a fact THE COMPILER
 * HOLDS, not a comment two files apart can drift from. `resolveTextAlign` returns the block's
 * alignment else the column's, with no widening and no assertion, because of this one line.
 *
 * It lives HERE and not in `style/`, beside the tuple it is a superset of, and that is a
 * mechanical choice rather than a tidy one: deriving it by spread needs the VALUE of the other
 * tuple, and importing that value from `style/` would add a runtime edge `style/ -> ast/` to a
 * graph where `ast/ -> style/` already exists -- exactly the ESM initialisation configuration
 * this lot measured on the `page/` barrel. Declared in the same file, it derives with no edge.
 *
 * The fourth member is the one a column cannot have. Justifying distributes inter-word space,
 * which is something a RUN does and a column merely defaults; and it costs this contract two
 * conventions, taken rather than left open, in ADR 0007: the last line of a justified paragraph
 * aligns to `start`, and the slack is distributed between WORDS, never between letters.
 *
 * Nothing here resolves `start` and `end` against a writing direction -- that question is
 * inherited from lot C3, recorded in ADR 0005, and it is settled by no engine reading the
 * machine it runs on (lot E6).
 */
export const TEXT_ALIGNMENTS = [...TABLE_COLUMN_ALIGNMENTS, 'justify'] as const;

export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/**
 * The window a column weight lives in, and the bounds are load-bearing rather than
 * decorative.
 *
 * {@link TableColumn.width} is a whole number, so the sum of a table's weights is EXACT in
 * binary64 and a column's share is ONE correctly-rounded division -- the same number in the
 * on-screen preview and in the PDF, on any conforming engine, which is what product
 * decision 7 promises and what a floating weight could only approximate.
 *
 * ## The proof, and what it does NOT rest on
 *
 * It does not rest on a default. `limitSchema` caps `maxNodes` at
 * `LIMIT_HARD_CEILING = 1_000_000_000`, and a column `{ id, width, align }` costs FOUR
 * values, so a template that goes through the shape guard carries at most 2.5e8 columns and
 * the sum of its weights is at most `2.5e8 * 1e3 = 2.5e11 < 2**53`. Outside the guard --
 * `TableNodeSchema.parse` does not run it -- the maximum length of a JavaScript array,
 * `2**32 - 1`, bounds the sum to `4.3e12 < 2**53`. The sum is exact in every representable
 * case, whatever `DEFAULT_SHAPE_LIMITS` is set to on the day this is read.
 *
 * Both bounds are refused when the template is SAVED, never at render. Narrowing a field
 * that no stored document can carry yet costs nothing -- that is what the 2 -> 3 migration
 * records for `decimals`, word for word.
 */
export const MIN_COLUMN_WIDTH = 1;
export const MAX_COLUMN_WIDTH = 1000;

/**
 * One column of a {@link TableNode}: an identity, and the geometry its cells share.
 *
 * ## Three fields, and the test that says why there are exactly three
 *
 * A declaration belongs on a column if and only if: (1) it is SHARED by the N cells of that
 * column; (2) it is INEXPRESSIBLE outside a column -- remove the notion of a column and the
 * attribute has no site left to be written on; (3) it can change neither a `compare` nor a
 * `sum` nor a `dateAdd`; (4) it asks the integrator to name no field of their data.
 *
 * Identity and width pass all four. A font, a rule, a background, a spacing fail the SECOND
 * -- they are written on any block whatsoever, and lot C5 defines them there. A number
 * format, a separator, a currency symbol, a display scale fail it too, and are lot C6's. A
 * total, a subtotal, an aggregation operator fail the THIRD. A header derived from a data
 * key, columns derived from the keys of the data, an alignment derived from the type of the
 * value fail the FOURTH.
 *
 * `align` FAILS the second, and it is here anyway. It is a NAMED EXCEPTION, carried by two
 * mechanical arguments rather than by the criterion: the roadmap writes "un alignement par
 * colonne" under lot C3, and lot C5 reads "Dépend de : C3" -- so a property lot C3's own
 * acceptance criterion needs cannot live in the lot that comes after it.
 *
 * ## Why a column carries no label
 *
 * Because the header is a ROW, and a heading is a cell of it like any other -- see
 * {@link TableNode.header}. A `label: string` here would give lot C6 a second content
 * position to translate beside {@link TextNode.content}, and replacing it later is a
 * transforming migration on every template written in between.
 */
export interface TableColumn {
  /**
   * Unique within its table, checked when the template is saved. A cell names this;
   * nothing in the contract is matched by position.
   *
   * A column is not a {@link DocumentNode} -- it holds no content and lives in no scope --
   * so `findNodeById` does not reach it, and an editor addresses it as
   * (table id, column id).
   */
  readonly id: string;
  /**
   * A relative WEIGHT, deliberately unitless: a column of weight 3 beside one of weight 1
   * is three times as wide. A column receives `width / (sum of the widths of its table)`
   * of whatever width the table itself is given. **How wide the table is is not declared
   * here, and lot C3 declares it nowhere.**
   *
   * Not millimetres: the geometry of the sheet -- format, orientation, margins -- is lot
   * C4's, and free positioning to the millimetre is out of scope for v1, so an absolute
   * length here would duplicate one and reintroduce the other. Not a percentage: a
   * percentage only behaves if the values sum to a hundred, so either the contract polices
   * that sum -- a rule, and a refusal nobody asked for -- or appending a sixth column
   * invalidates the five others. Not `auto`: a width resolved by measuring content needs
   * font metrics, which is reading the machine, and it would make the preview and the PDF
   * agree only insofar as two layout engines measure identically.
   *
   * A weight normalises totally, needs no sum rule, and survives a change of paper format
   * without one edit to the table.
   */
  readonly width: number;
  /** Inherited by every cell of this column. A per-cell override belongs to lot C5. */
  readonly align: TableColumnAlignment;
}

/**
 * What one row puts in one column.
 *
 * A cell NAMES its column instead of being matched to it by position, and that single
 * choice settles three things at once. A row that fills only some columns is a natural
 * shape rather than a run of placeholders -- and the last row of an invoice, a label and an
 * amount, is exactly that shape. Reordering the columns of a table is one array edit rather
 * than one permutation per row that all have to agree in the same order. And nothing in any
 * traversal indexes one array with another's index, which under `noUncheckedIndexedAccess`
 * would yield `T | undefined` at every single pairing, with `!` forbidden to dereference it.
 *
 * The one state keyed pairing leaves representable -- a cell naming a column the table does
 * not declare -- is refused when the template is saved, on the table node that can see both.
 * See {@link TableNode}.
 */
export interface TableCell {
  readonly columnId: string;
  /**
   * Ordinary blocks, so a cell inherits everything the Composite already does: a paragraph,
   * two paragraphs, an image, a condition, a nested loop.
   *
   * A nested table is representable and is not refused. Refusing it one level down would be
   * a fence with a gate, since a `container` placed in the cell would carry one anyway; what
   * bounds nesting is `assertBoundedShape`, which bounds it already and answers `too-deep`,
   * a typed refusal lot C8 can narrate.
   */
  readonly children: readonly BlockNode[];
}

/**
 * One row: a set of cells, and no repetition of its own.
 *
 * A row is a NODE so that it has an id. Lot C7 marks a block as unbreakable, an engine cuts
 * a page between two rows, and lot E5 reports which row landed on which page: all three need
 * something to point at, and a row that were an inert record would give them nothing.
 */
export interface TableRowNode extends NodeBase {
  readonly type: 'tableRow';
  readonly cells: readonly TableCell[];
  /**
   * The horizontal band this row occupies: background, rules, and a per-cell inset.
   *
   * The most debatable of the five carriers, so the argument is written. A row IS a band:
   * `background` paints it, `border.top`/`border.bottom` draw rules across it,
   * `border.left`/`border.right` close it at both ends. A table's heading band is the SECOND
   * differentiating device of an invoice (measured: `background` is one of only two fields whose
   * removal breaks the recipe criterion), and without a carrier here painting one would take a
   * `ContainerNode` PER CELL -- five nodes for a five-column heading.
   *
   * ## What `padding` does here, and it is NOT what it does on the four other carriers
   *
   * It insets THE CONTENT OF EACH CELL of this row, identically, and MOVES NO COLUMN BOUNDARY.
   *
   * The other reading -- insetting the band as a whole -- is representable and is refused,
   * because it would shift, for this row alone, the origin and the width the column weights
   * resolve against: the heading columns would stop lining up with the body's. It would also
   * insert into the published formula of {@link TableColumn.width} a per-row subtraction that
   * formula does not have -- WHICH IS EXACTLY THE ARGUMENT THAT REMOVED A GAP FROM THIS CARRIER,
   * and that argument does not care which name the field is given. Written as above, `padding`
   * touches no boundary and leaves the formula intact.
   *
   * What was REMOVED so that every field of {@link BoxStyle} has a meaning here: a gap, which on
   * a row means inter-cell spacing and has no reading that leaves the formula alone; and an
   * alignment, which here would be {@link TableColumn.align} under a second name.
   */
  readonly box?: BoxStyle | undefined;
}

/**
 * Rows repeated once per item of {@link TableRowGroupNode.each}.
 *
 * ## Why the repetition is here, and not on the table
 *
 * `NodeReads` has exactly two buckets -- expressions read in the ENCLOSING scope, and the
 * children the alias is in scope for -- and no third. So one node cannot both read a list
 * and hold the header that must not see it. Binding on the table would put the row alias in
 * scope for the header and the footer as well, and a heading or a total that mentioned it
 * would be treated as an internal reference: `collectDataPaths` would quietly stop asking
 * the integrator for a key the document really does read, which is the defect ADR 0002
 * fixed for loops.
 *
 * ## Why not a plain LoopNode
 *
 * A loop repeats {@link BlockNode}s, and a row is not a block -- a row outside a table means
 * nothing, which is precisely what the two unions at the bottom of this file say. The shape
 * is otherwise the one this repository already writes twice, `each`/`as` against
 * `source`/`as` on an aggregation, so the Designer reuses the loop widget and the evaluation
 * reuses `evaluateSequence` and `childScope` untouched: no second scope primitive, no
 * reserved name, no new shadowing MECHANISM. It is, in exchange, a FOURTH SITE at which an
 * alias can shadow a caller key, and `collectDataPaths` says so rather than promising
 * otherwise.
 *
 * `each` takes any expression, so "only the lines that were not cancelled" is `filter(...)`
 * and needs no field here. The table adds no sort, no filter and no grouping of its own:
 * they exist in the algebra, and a second spelling would drift.
 */
export interface TableRowGroupNode extends NodeBase {
  readonly type: 'tableRowGroup';
  /** The list to repeat. Evaluated in the ENCLOSING scope, before `as` is bound. */
  readonly each: Expression;
  /** Same rule, and the same `aliasSchema`, as {@link LoopNode.as}. */
  readonly as: string;
  /** At least one. A group of no rows repeats nothing and describes no intent. */
  readonly rows: readonly TableRowNode[];
}

/** What a table body may hold: a fixed row, or repeated ones. */
export type TableBodyNode = TableRowNode | TableRowGroupNode;

/**
 * A table of lines: a declared geometry, and three NAMED sections.
 *
 * ## Why the sections are fields and not a role flag
 *
 * Because a consumer must be able to tell them apart without inferring anything, and the
 * field name is what makes that free. A flag on a row -- `role: 'header' | 'body'` -- would
 * need an ordering rule ("all the headers come first") and a refusal to police it. A pattern
 * -- "a container holding a loop holding containers" -- would need a heuristic, and a
 * heuristic is exactly what a named field removes. What each section is FOR at render time
 * is not decided here, and this contract does not describe it: this brick describes, it
 * produces nothing.
 *
 * ## What the footer CANNOT do, said by the type rather than by a docstring
 *
 * `footer` accepts `TableRowNode` and nothing else: no repetition of rows, no row alias, and
 * above all no AGGREGATION FIELD -- there is nowhere on this node to put one. A table
 * therefore cannot sum its own columns, and the last line of an invoice is what the roadmap
 * says it is -- an EXPRESSION OF THE MODEL, `round(sum(...), d, m)`, written by the author
 * and standing in the tree where a reviewer, lot D7's formula bar and a refusal can all
 * point at it. A total computed by the structure would round somewhere no reviewer looks,
 * outside the tree, which ADR 0004 decision 8 refuses.
 *
 * What stays possible INSIDE a footer cell, as inside any cell, is an ordinary block --
 * `loop` included, with its own `each` and its own alias. That is content, not a total the
 * table computed. The structural refusal bears on the FIELD, not on the presence of
 * expressions or aliases in the footer.
 *
 * ## What it does not carry, and who does
 *
 * No border, no shading, no font, no spacing, no per-cell alignment override (lot C5). No
 * page format, no margins (lot C4). No "repeat the header on every page", no widow or orphan
 * policy, no page numbering VALUE and no carry-forward (lots E2 and E3 compute those; lot C4
 * lets a template PLACE a page number, with a `pageField` segment inside a page band -- see
 * page/). No number format, no currency, no display scale, no column type (lot C6). No
 * rounding default and no per-subtree rounding inheritance (ADR 0004 decision 8).
 */
export interface TableNode extends NodeBase {
  readonly type: 'table';
  /** At least one, ids unique within the table. Array order IS display order. */
  readonly columns: readonly TableColumn[];
  /**
   * The heading rows, identified as such so a consumer does not have to guess which they
   * are. An empty list is a table with no heading; several heading rows are legal and cost
   * nothing.
   */
  readonly header: readonly TableRowNode[];
  /** The content rows: fixed, repeated, or both, in flow order. */
  readonly body: readonly TableBodyNode[];
  /** The closing rows. `TableRowNode` only, on purpose -- see above. */
  readonly footer: readonly TableRowNode[];
  /**
   * The box the whole table occupies: background, rules, inner inset. See {@link BoxStyle}.
   *
   * ## Where the column weights resolve, which this field makes it necessary to state
   *
   * A table occupies its parent's CONTENT width, and its own `padding` is subtracted from that
   * before {@link TableColumn.width} shares what remains. This COMPLETES the published formula
   * rather than contradicting it: "of whatever width the table itself is given" -- what it is
   * given is the parent's content width, what it shares is its own.
   *
   * That sentence is the reason lot C3 could leave the width undeclared and this lot cannot: a
   * `padding` here that did not say what it subtracts from would be a stored value with no
   * stated meaning. The whole chain is arithmetic on declared millimetres -- `printableAreaOf`,
   * then one subtraction per ancestor box, then ONE correctly-rounded division on integer
   * weights -- so no term of it is a measurement, and decision 7's "same number in the preview
   * and in the PDF" is checkable rather than merely promised.
   */
  readonly box?: BoxStyle | undefined;
}

/**
 * What may appear in a BLOCK FLOW: the children of a container, of a loop, of a condition,
 * of a table cell, and the root of a template.
 *
 * A row and a row group are document nodes -- they have ids, they are walked, they report
 * what they read -- but they mean nothing outside a table. Splitting the union is how that
 * is said to the compiler and to Zod at once, with no semantic validation pass and no
 * refusal to write: a stray `tableRow` under a container simply has no member to match. It
 * narrows three stored positions, and narrows nothing that exists: no version 3 document can
 * carry a row at all.
 */
export type BlockNode = TextNode | ImageNode | ContainerNode | LoopNode | ConditionNode | TableNode;

/** Every node type, rows included. */
export type DocumentNode = BlockNode | TableRowNode | TableRowGroupNode;

/**
 * What a user may INSERT in a block flow -- this, and NOT {@link DocumentNodeType}, is what
 * a block Registry validates against.
 */
export type BlockNodeType = BlockNode['type'];

/**
 * Every discriminant, rows included: the Visitor's domain, and `walk`'s. Not the Registry's.
 */
export type DocumentNodeType = DocumentNode['type'];

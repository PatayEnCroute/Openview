/**
 * The only element names the engine may emit. A name is never taken from the template, so no
 * document can introduce a tag this list does not hold.
 */
export const HTML_ELEMENTS = [
  'div',
  'span',
  'img',
  'table',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
] as const;

export type HtmlElementName = (typeof HTML_ELEMENTS)[number];

/** Elements written without a closing tag. */
export const VOID_ELEMENTS: ReadonlySet<HtmlElementName> = new Set(['img', 'col']);

/**
 * The only attributes the engine may set, so an attribute name can never come from the template.
 * Every value is escaped as an attribute at serialisation time.
 */
export interface HtmlAttributes {
  readonly class?: string | undefined;
  readonly style?: string | undefined;
  readonly src?: string | undefined;
  readonly alt?: string | undefined;
  /** Declaration id, for measurement selectors and for pointing a refusal at a node. */
  readonly 'data-openview-node'?: string | undefined;
  /** Occurrence key, which is what a measurement answer is filed under. */
  readonly 'data-openview-key'?: string | undefined;
  /** Rank of a run inside its text block, so a line end can be read back as a cursor. */
  readonly 'data-openview-run'?: string | undefined;
  /** Which of the three vertical regions a box belongs to. */
  readonly 'data-openview-region'?: string | undefined;
  /** One-based rank of a page, chosen by the engine and never read from the data. */
  readonly 'data-openview-page'?: string | undefined;
}

export interface HtmlElement {
  readonly kind: 'element';
  readonly name: HtmlElementName;
  readonly attributes: HtmlAttributes;
  readonly children: readonly HtmlNode[];
}

/** A run of characters. Escaped as text at serialisation time, never as markup. */
export interface HtmlText {
  readonly kind: 'text';
  readonly text: string;
}

export type HtmlNode = HtmlElement | HtmlText;

/** The tree and the stylesheet that go together, before serialisation. */
export interface HtmlTree {
  readonly css: string;
  readonly body: readonly HtmlNode[];
}

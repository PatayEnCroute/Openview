/** Allowed HTML element names emitted by the engine. */
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

/** HTML element attributes managed and serialized by the engine. */
export interface HtmlAttributes {
  readonly class?: string | undefined;
  readonly style?: string | undefined;
  readonly src?: string | undefined;
  readonly alt?: string | undefined;
  /** Template node ID attribute. */
  readonly 'data-openview-node'?: string | undefined;
  /** Occurrence key attribute. */
  readonly 'data-openview-key'?: string | undefined;
  /** Run index attribute within a text block. */
  readonly 'data-openview-run'?: string | undefined;
  /** Vertical document region identifier. */
  readonly 'data-openview-region'?: string | undefined;
  /** Grid zone container ID attribute. */
  readonly 'data-openview-grid-item'?: string | undefined;
  /** Page number attribute. */
  readonly 'data-openview-page'?: string | undefined;
}

export interface HtmlElement {
  readonly kind: 'element';
  readonly name: HtmlElementName;
  readonly attributes: HtmlAttributes;
  readonly children: readonly HtmlNode[];
}

/** Plain text HTML DOM node. */
export interface HtmlText {
  readonly kind: 'text';
  readonly text: string;
}

export type HtmlNode = HtmlElement | HtmlText;

/** Structured HTML representation pairing CSS stylesheet and body elements. */
export interface HtmlTree {
  readonly css: string;
  readonly body: readonly HtmlNode[];
}

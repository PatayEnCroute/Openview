/**
 * What the page hands back: rectangles and lengths as the browser reported them.
 *
 * Nothing here is a decision. The arithmetic that turns these numbers into line ends, overflows
 * and content heights lives in `derive.ts`, which runs in Node and is therefore measurable.
 */

/** A rectangle as the browser reported it, in css pixels. */
export interface ObservedRect {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** What the padding and the rules of a box take off each of its edges, in css pixels. */
export interface ObservedInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * One measured unit of a text block: the ink of the range that ends at this cursor.
 *
 * A character is one unit and a page marker is one unit, because a marker is atomic and the digits
 * it happens to show are not the value the printed page will carry.
 */
export interface ObservedUnit {
  readonly run: number;
  readonly offset: number;
  readonly rect: ObservedRect;
}

/** One annotated box, with the insets and the units a line derivation needs. */
export interface ObservedBox {
  readonly key: string;
  readonly rect: ObservedRect;
  readonly insets: ObservedInsets;
  readonly units: readonly ObservedUnit[];
}

/**
 * One vertical region of a page.
 *
 * `contentBottom` is the lowest edge any visible descendant reached, or the region's own top when
 * it has none -- an extremum, not a height, so the subtraction that could hide a sub-pixel overflow
 * happens where a test can reach it.
 */
export interface ObservedRegion {
  readonly region: 'header' | 'root' | 'footer';
  readonly rect: ObservedRect;
  readonly contentBottom: number;
}

export interface ObservedPage {
  readonly rect: ObservedRect;
  readonly printable: ObservedRect;
  readonly regions: readonly ObservedRegion[];
}

/** One painted declaration and the sheet it was painted on. */
export interface ObservedNode {
  readonly nodeId: string;
  readonly rect: ObservedRect;
  readonly sheet: ObservedRect;
}

/**
 * One grid zone wrapper, with the union of its visible descendants.
 *
 * The union is enough: a descendant escapes the content box exactly when one of the four extremes
 * does, so the comparison stays exact while the payload stays bounded.
 */
export interface ObservedGridItem {
  readonly nodeId: string;
  readonly rect: ObservedRect;
  readonly insets: ObservedInsets;
  readonly descendants: ObservedRect | undefined;
}

/** One page marker box: what it would need, against what it was given. */
export interface ObservedMarker {
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

/** One image, already an observation: nothing about it is derived. */
export interface ObservedImage {
  readonly nodeId: string;
  readonly decoded: boolean;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly renderedWidth: number;
  readonly renderedHeight: number;
}

/** Everything one measurement pass read out of the page, before any of it is interpreted. */
export interface LayoutObservation {
  readonly pages: readonly ObservedPage[];
  readonly boxes: readonly ObservedBox[];
  readonly images: readonly ObservedImage[];
  readonly nodes: readonly ObservedNode[];
  readonly gridItems: readonly ObservedGridItem[];
  readonly markers: readonly ObservedMarker[];
}

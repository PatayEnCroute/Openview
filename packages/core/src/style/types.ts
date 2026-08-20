import { MAX_SHEET_MM } from '../page/types.js';
import { ptFromMm } from './units.js';

/**
 * Color value formatted as a 6-digit hex string (#RRGGBB).
 */
export type Color = string; // NOSONAR -- documentation-only alias

/**
 * Typographic attributes applicable to text nodes and inline runs.
 */
export interface Typography {
  /** Font family name. */
  readonly family?: string | undefined;
  /** Font size in points (pt), bounded by MIN_FONT_SIZE_PT and MAX_FONT_SIZE_PT. */
  readonly sizePt?: number | undefined;
  /** Bold font weight. */
  readonly bold?: boolean | undefined;
  /** Italic font style. */
  readonly italic?: boolean | undefined;
  /** Text color formatted as #RRGGBB. */
  readonly color?: Color | undefined;
}

/**
 * Single edge of a box border (width in millimeters and color).
 */
export interface BorderEdge {
  readonly width: number;
  readonly color: Color;
}

/**
 * Border configuration for all four box edges (each optional).
 */
export interface BoxBorder {
  readonly top?: BorderEdge | undefined;
  readonly right?: BorderEdge | undefined;
  readonly bottom?: BorderEdge | undefined;
  readonly left?: BorderEdge | undefined;
}

/**
 * Box padding in millimeters on all four sides (all required).
 */
export interface BoxSpacing {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Box visual styling for blocks and containers (background, border, padding).
 */
export interface BoxStyle {
  readonly background?: Color | undefined;
  readonly border?: BoxBorder | undefined;
  readonly padding?: BoxSpacing | undefined;
}

/** Minimum allowed font size in points (1 pt). */
export const MIN_FONT_SIZE_PT = 1;

/**
 * Maximum allowed font size in points, derived from MAX_SHEET_MM.
 */
export const MAX_FONT_SIZE_PT = ptFromMm(MAX_SHEET_MM);

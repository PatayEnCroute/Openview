import {
  type BorderEdge,
  type BoxBorder,
  type BoxSpacing,
  type BoxStyle,
  mmFromPt,
  type TableColumn,
  type TextAlignment,
} from '@openview/core';
import type { MaterialDocument, ResolvedTypography } from '../document/types.js';
import { cssFontFamily } from './escape.js';

/** Class names the engine puts on the boxes it builds. */
export const CSS_CLASSES = {
  page: 'ov-page',
  printable: 'ov-printable',
  band: 'ov-band',
  flow: 'ov-flow',
  text: 'ov-text',
  image: 'ov-image',
  container: 'ov-container',
  table: 'ov-table',
  cell: 'ov-cell',
} as const;

/**
 * Writes a number for css.
 *
 * Only guards the exponent form, which no valid declaration accepts. It is not a rounding: a value
 * that already writes as a decimal passes through untouched, so a column weight keeps every digit
 * its division produced.
 */
function cssNumber(value: number): string {
  const written = String(value);
  return written.includes('e') ? value.toFixed(9) : written;
}

const mm = (value: number): string => `${cssNumber(value)}mm`;

/** Percentage of the table's content width a column takes, from its weight alone. */
export function columnWidths(columns: readonly TableColumn[]): readonly string[] {
  let total = 0;
  for (const column of columns) {
    total += column.width;
  }
  return columns.map((column) => `${cssNumber((column.width / total) * 100)}%`);
}

/**
 * The document stylesheet. Every value in it comes from the validated page setup or is a literal,
 * so no text of the template ever enters a style block.
 *
 * `overflow: hidden` on the sheet is a last barrier against a second page, never the guard: the
 * adapter measures and refuses before printing.
 */
export function documentCss(document: MaterialDocument): string {
  const { sheet, margins, printable } = document;
  return [
    `@page{size:${mm(sheet.width)} ${mm(sheet.height)};margin:0}`,
    'html,body{margin:0;padding:0}',
    'html{print-color-adjust:exact;-webkit-print-color-adjust:exact}',
    '*{box-sizing:border-box}',
    `.${CSS_CLASSES.page}{position:relative;width:${mm(sheet.width)};height:${mm(sheet.height)};overflow:hidden}`,
    `.${CSS_CLASSES.printable}{position:absolute;top:${mm(margins.top)};left:${mm(margins.left)};` +
      `width:${mm(printable.width)};height:${mm(printable.height)};display:flex;flex-direction:column}`,
    `.${CSS_CLASSES.band}{flex:0 0 auto}`,
    `.${CSS_CLASSES.flow}{flex:1 1 auto;min-height:0}`,
    `.${CSS_CLASSES.text}{white-space:pre-wrap}`,
    `.${CSS_CLASSES.image}{display:block;width:100%;height:auto}`,
    `.${CSS_CLASSES.table}{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0}`,
    `.${CSS_CLASSES.cell}{padding:0;vertical-align:top}`,
  ].join('');
}

/**
 * Paints a rule as an inset shadow rather than a css border.
 *
 * A css border joins the width formula, which the box model reserves for `padding` alone, and two
 * bordered neighbours add their widths. An inset band paints inside the box, consumes no layout and
 * cannot add to the band of the box next to it.
 */
function insetBands(edges: BoxBorder | undefined): readonly string[] {
  const band = (offsetX: string, offsetY: string, edge: BorderEdge | undefined) =>
    edge === undefined ? undefined : `inset ${offsetX} ${offsetY} 0 0 ${edge.color}`;
  return [
    band('0', mm(edges?.top?.width ?? 0), edges?.top),
    band(`-${mm(edges?.right?.width ?? 0)}`, '0', edges?.right),
    band('0', `-${mm(edges?.bottom?.width ?? 0)}`, edges?.bottom),
    band(mm(edges?.left?.width ?? 0), '0', edges?.left),
  ].filter((declaration): declaration is string => declaration !== undefined);
}

const paddingCss = (padding: BoxSpacing): string =>
  `padding:${mm(padding.top)} ${mm(padding.right)} ${mm(padding.bottom)} ${mm(padding.left)}`;

/**
 * Inline declarations for a box: its background, its padding and the rules it may paint.
 *
 * `border` overrides the box's own edges, which is how a table cell paints the rules its row was
 * assigned rather than the four its row declared.
 */
export function boxCss(
  box: BoxStyle | undefined,
  border?: BoxBorder | undefined,
): string | undefined {
  const declarations: string[] = [];
  if (box?.background !== undefined) {
    declarations.push(`background:${box.background}`);
  }
  if (box?.padding !== undefined) {
    declarations.push(paddingCss(box.padding));
  }
  const bands = insetBands(border ?? box?.border);
  if (bands.length > 0) {
    declarations.push(`box-shadow:${bands.join(',')}`);
  }
  return declarations.length > 0 ? declarations.join(';') : undefined;
}

/** Inline declarations for one run. Every property is present, so nothing cascades in by accident. */
export function runCss(typography: ResolvedTypography): string {
  return [
    `font-family:${cssFontFamily(typography.family)}`,
    `font-size:${mm(mmFromPt(typography.sizePt))}`,
    `font-weight:${typography.bold ? 700 : 400}`,
    `font-style:${typography.italic ? 'italic' : 'normal'}`,
    `color:${typography.color}`,
  ].join(';');
}

/** Inline declarations for a text block: its resolved alignment, plus its box. */
export function textCss(align: TextAlignment, box: BoxStyle | undefined): string {
  const boxDeclarations = boxCss(box);
  const alignment = `text-align:${align}`;
  return boxDeclarations === undefined ? alignment : `${alignment};${boxDeclarations}`;
}

import {
  type BorderEdge,
  type BoxBorder,
  type BoxSpacing,
  type BoxStyle,
  mmFromPt,
  type PageMargins,
  type PrintableArea,
  type Sheet,
  type TableColumn,
  type TextAlignment,
} from '@openview/core';
import type { ResolvedTypography } from '../document/types.js';
import { cssFontFamily } from './escape.js';

/** Class names the engine puts on the boxes it builds. */
export const CSS_CLASSES = {
  page: 'ov-page',
  printable: 'ov-printable',
  band: 'ov-band',
  headerSlot: 'ov-top',
  footerSlot: 'ov-bottom',
  flow: 'ov-flow',
  text: 'ov-text',
  image: 'ov-image',
  container: 'ov-container',
  table: 'ov-table',
  cell: 'ov-cell',
  marker: 'ov-marker',
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

const px = (value: number): string => `${cssNumber(value)}px`;

/** Percentage of the table's content width a column takes, from its weight alone. */
export function columnWidths(columns: readonly TableColumn[]): readonly string[] {
  let total = 0;
  for (const column of columns) {
    total += column.width;
  }
  return columns.map((column) => `${cssNumber((column.width / total) * 100)}%`);
}

/** The geometry every sheet of one document shares. */
export interface PageGeometry {
  readonly sheet: Sheet;
  readonly margins: PageMargins;
  readonly printable: PrintableArea;
  /** Height of the top slot on every page, in millimetres. */
  readonly headerReserve: number;
  readonly footerReserve: number;
}

const COMMON = [
  'html,body{margin:0;padding:0}',
  'html{print-color-adjust:exact;-webkit-print-color-adjust:exact}',
  '*{box-sizing:border-box}',
  `.${CSS_CLASSES.text}{white-space:pre-wrap}`,
  `.${CSS_CLASSES.image}{display:block;width:100%;height:auto}`,
  `.${CSS_CLASSES.table}{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0}`,
  `.${CSS_CLASSES.cell}{padding:0;vertical-align:top}`,
  /* Kerning off and no ligature, so the width of a marker is the sum of its digit advances and the
     reserve measured on one digit is a real bound. */
  `.${CSS_CLASSES.marker}{display:inline-block;font-kerning:none;font-variant-ligatures:none;overflow:hidden;vertical-align:baseline}`,
];

/**
 * The stylesheet of the printed document: several sheets, each with three slots of fixed height.
 *
 * Every value comes from the validated page setup or from a measurement, so no text of the template
 * ever enters a style block. `break-after` on every sheet but the last is what makes one box print
 * as one page and adds no blank one after the end.
 *
 * `overflow: hidden` stays a last barrier against a page that grew, never the guard: the session
 * measures the whole sequence and refuses before anything is printed.
 */
export function documentCss(geometry: PageGeometry): string {
  const { sheet, margins, printable, headerReserve, footerReserve } = geometry;
  return [
    `@page{size:${mm(sheet.width)} ${mm(sheet.height)};margin:0}`,
    ...COMMON,
    `.${CSS_CLASSES.page}{position:relative;width:${mm(sheet.width)};height:${mm(sheet.height)};overflow:hidden;break-after:page}`,
    `.${CSS_CLASSES.page}:last-child{break-after:auto}`,
    `.${CSS_CLASSES.printable}{position:absolute;top:${mm(margins.top)};left:${mm(margins.left)};` +
      `width:${mm(printable.width)};height:${mm(printable.height)};display:flex;flex-direction:column}`,
    `.${CSS_CLASSES.band}{flex:0 0 auto;overflow:hidden;display:flex;flex-direction:column}`,
    `.${CSS_CLASSES.headerSlot}{height:${mm(headerReserve)};justify-content:flex-start}`,
    `.${CSS_CLASSES.footerSlot}{height:${mm(footerReserve)};justify-content:flex-end}`,
    `.${CSS_CLASSES.flow}{flex:1 1 auto;min-height:0}`,
  ].join('');
}

/**
 * The stylesheet of a probe: the same widths, and no height anywhere.
 *
 * A probe exists to be measured, so nothing in it may clip or stretch a box. The sheet width and
 * the printable width are the real ones, which is what makes a measured line break the line break
 * the printed page will have.
 */
export function probeCss(geometry: Omit<PageGeometry, 'headerReserve' | 'footerReserve'>): string {
  const { sheet, margins, printable } = geometry;
  return [
    `@page{size:${mm(sheet.width)} ${mm(sheet.height)};margin:0}`,
    ...COMMON,
    `.${CSS_CLASSES.page}{position:relative;width:${mm(sheet.width)};height:auto;overflow:visible}`,
    `.${CSS_CLASSES.printable}{position:relative;margin:0 0 0 ${mm(margins.left)};` +
      `width:${mm(printable.width)};height:auto}`,
    `.${CSS_CLASSES.band}{overflow:visible}`,
    `.${CSS_CLASSES.flow}{min-height:0}`,
  ].join('');
}

/** Width one page marker reserves, whatever digits it ends up showing. */
export function markerCss(typography: ResolvedTypography, width: number): string {
  return `${runCss(typography)};width:${px(width)}`;
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

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
  grid: 'ov-grid',
  gridItem: 'ov-grid-item',
  layer: 'ov-layer',
} as const;

/** Formats a numeric value for CSS, avoiding exponential notation. */
function cssNumber(value: number): string {
  const written = String(value);
  return written.includes('e') ? value.toFixed(9) : written;
}

const mm = (value: number): string => `${cssNumber(value)}mm`;

const px = (value: number): string => `${cssNumber(value)}px`;

/** Percentage of table content width allocated to each column based on width weights. */
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
  `.${CSS_CLASSES.marker}{display:inline-block;font-kerning:none;font-variant-ligatures:none;overflow:hidden;vertical-align:baseline}`,
  `.${CSS_CLASSES.grid}{display:grid}`,
  `.${CSS_CLASSES.gridItem}{min-width:0;min-height:0;position:relative}`,
  `.${CSS_CLASSES.layer}{position:absolute;top:0;left:0;width:100%;height:100%}`,
  `.${CSS_CLASSES.layer}>.${CSS_CLASSES.container}{height:100%}`,
];

/**
 * Generates the stylesheet for the paginated document based on page geometry.
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
 * Generates stylesheet for measurement probe pages without height constraints.
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

/** Returns CSS inline styles for a fixed-width marker container. */
export function markerCss(typography: ResolvedTypography, width: number): string {
  return `${runCss(typography)};width:${px(width)}`;
}

/** Generates inset box-shadow rules representing border edges. */
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

/** Generates inline CSS declarations for box background, padding, and border shadows. */
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

/** Generates inline CSS declarations for typography. */
export function runCss(typography: ResolvedTypography): string {
  const face = typography.face;
  return [
    /* One family, quoted, and no stack behind it: the browser cannot prefer a local installation
       of the same typeface and cannot continue past the face this build embedded. */
    `font-family:"${face.cssFamily}"`,
    `font-size:${mm(mmFromPt(typography.sizePt))}`,
    `font-weight:${face.weight}`,
    `font-style:${face.style}`,
    /* No invented boldness and no invented slant: all four faces of a family are embedded, so a
       synthesised one would be a shape this build never measured. */
    'font-synthesis:none',
    `color:${typography.color}`,
  ].join(';');
}

/** Generates inline CSS declarations for a grid container. */
export function gridCss(
  columns: number,
  rows: number,
  step: number,
  box: BoxStyle | undefined,
): string {
  const tracks =
    `grid-template-columns:repeat(${cssNumber(columns)},minmax(0,1fr));` +
    `grid-template-rows:repeat(${cssNumber(rows)},${mm(step)})`;
  const boxDeclarations = boxCss(box);
  return boxDeclarations === undefined ? tracks : `${tracks};${boxDeclarations}`;
}

/** Generates inline CSS declarations for positioning a grid item. */
export function gridItemCss(
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number,
): string {
  return (
    `grid-row:${cssNumber(row)}/span ${cssNumber(rowSpan)};` +
    `grid-column:${cssNumber(column)}/span ${cssNumber(columnSpan)}`
  );
}

/** Generates inline CSS opacity declaration for a layer wrapper. */
export function layerCss(opacity: number | undefined): string | undefined {
  return opacity === undefined ? undefined : `opacity:${cssNumber(opacity)}`;
}

/** Generates inline CSS declarations for a text block. */
export function textCss(align: TextAlignment, box: BoxStyle | undefined): string {
  const boxDeclarations = boxCss(box);
  const alignment = `text-align:${align}`;
  return boxDeclarations === undefined ? alignment : `${alignment};${boxDeclarations}`;
}

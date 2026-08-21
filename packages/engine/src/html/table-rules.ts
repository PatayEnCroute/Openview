import type { BorderEdge, BoxBorder } from '@openview/core';

/** The four rules a row is entitled to paint on its own cells, after conflicts are settled. */
export interface RowRules {
  readonly top: BorderEdge | undefined;
  readonly right: BorderEdge | undefined;
  readonly bottom: BorderEdge | undefined;
  readonly left: BorderEdge | undefined;
}

const widthOf = (edge: BorderEdge | undefined): number => edge?.width ?? 0;

/** The following row's rule takes an internal boundary on a tie. */
const takesBoundary = (own: BorderEdge | undefined, other: BorderEdge | undefined) =>
  widthOf(own) >= widthOf(other) ? own : undefined;

/** Its neighbour therefore needs a strict win to keep the same boundary. */
const yieldsBoundary = (own: BorderEdge | undefined, other: BorderEdge | undefined) =>
  widthOf(own) > widthOf(other) ? own : undefined;

/**
 * Assigns every rule of a table to exactly one box, so two adjacent rules overlap instead of
 * adding up.
 *
 * The wider rule is the visible one. On an exact tie the boundary between two rows goes to the
 * following row's `top`, and a boundary shared with the table's own edge goes to the table. The
 * table paints its four declared edges unconditionally: its bands run the whole length of the
 * table, and a row that beat one of them paints a strictly wider band over it.
 *
 * @param borders the rows' borders in visual order -- header, then body, then footer
 */
export function resolveRowRules(
  borders: readonly (BoxBorder | undefined)[],
  table: BoxBorder | undefined,
): readonly RowRules[] {
  const last = borders.length - 1;
  return borders.map((border, index) => ({
    top:
      index === 0
        ? yieldsBoundary(border?.top, table?.top)
        : takesBoundary(border?.top, borders[index - 1]?.bottom),
    bottom:
      index === last
        ? yieldsBoundary(border?.bottom, table?.bottom)
        : yieldsBoundary(border?.bottom, borders[index + 1]?.top),
    left: yieldsBoundary(border?.left, table?.left),
    right: yieldsBoundary(border?.right, table?.right),
  }));
}

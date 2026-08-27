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
 * Resolves overlapping border rules between adjacent table rows and table edges.
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

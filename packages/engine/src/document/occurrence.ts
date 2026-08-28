import type { OccurrenceReference } from '@openview/core';

/**
 * The public reference of one materialised occurrence, and nothing else of it.
 *
 * Rebuilt field by field rather than passed through: a materialised node also carries its
 * measurement key, its box and its children, and none of those may reach a caller.
 */
export function occurrenceOf(source: OccurrenceReference): OccurrenceReference {
  return {
    nodeId: source.nodeId,
    nodeType: source.nodeType,
    declarationPath: source.declarationPath,
    iterations: source.iterations,
  };
}

/**
 * A key that tells two occurrences of one render apart, for grouping and de-duplication.
 *
 * Local to a projection: derived from the address, never published and never stored. Serialised
 * rather than joined on a separator, so a declaration name holding that separator cannot collide
 * with a path that really has one more segment.
 */
export function addressKey(source: OccurrenceReference): string {
  return JSON.stringify([
    source.declarationPath,
    source.iterations.map((iteration) => [iteration.declarationPath, iteration.index]),
  ]);
}

import type { OccurrenceReference } from '@openview/core';

/**
 * Extracts public occurrence reference fields from an internal materialized node.
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
 * Generates a serialized unique key for occurrence grouping and deduplication.
 */
export function addressKey(source: OccurrenceReference): string {
  return JSON.stringify([
    source.declarationPath,
    source.iterations.map((iteration) => [iteration.declarationPath, iteration.index]),
  ]);
}

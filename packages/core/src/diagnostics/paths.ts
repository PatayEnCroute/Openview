/** A location segment: an object key or an array index. */
export type PathSegment = string | number;

function isPathSegment(segment: PropertyKey): segment is PathSegment {
  return typeof segment === 'string' || typeof segment === 'number';
}

/**
 * Copies `prefix` then `segments` into a fresh array, root first. Every diagnostic gets its own
 * array, so mutating a returned path cannot reach the error it came from nor a later read.
 */
export function joinPath(
  prefix: readonly PathSegment[] | undefined,
  segments: readonly PathSegment[],
): readonly PathSegment[] {
  return [...(prefix ?? []), ...segments];
}

/**
 * Narrows a validator path to the segments Openview can name. A segment of any other type -- a
 * symbol key -- stops the walk: the accepted prefix is kept and the value itself never surfaces.
 */
export function nameableSegments(path: readonly PropertyKey[]): {
  readonly segments: readonly PathSegment[];
  readonly complete: boolean;
} {
  const segments: PathSegment[] = [];
  for (const segment of path) {
    if (!isPathSegment(segment)) {
      return { segments, complete: false };
    }
    segments.push(segment);
  }
  return { segments, complete: true };
}

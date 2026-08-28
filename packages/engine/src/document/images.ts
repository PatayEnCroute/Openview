import { walkDocument } from './traverse.js';
import type { MaterialDocument } from './types.js';

/** One image the document references, named by the declaration it came from. */
export interface DocumentImage {
  readonly nodeId: string;
  readonly path: readonly (string | number)[];
  readonly src: string;
}

/**
 * Every image the document references, in paint order.
 *
 * A print backend supports a subset of what an `ImageNode` may declare, and the subset is a
 * capability of that backend rather than a rule of the contract. Handing the list over is what lets
 * a strategy refuse a source it cannot print before it loads anything.
 */
export function documentImages(document: MaterialDocument): readonly DocumentImage[] {
  const found: DocumentImage[] = [];
  for (const block of walkDocument(document)) {
    if (block.kind === 'image') {
      found.push({ nodeId: block.nodeId, path: block.declarationPath, src: block.src });
    }
  }
  return found;
}

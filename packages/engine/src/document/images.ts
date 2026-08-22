import { kindOf } from '@openview/core';
import type { MaterialBlock, MaterialDocument } from './types.js';

/** One image the document references, named by the declaration it came from. */
export interface DocumentImage {
  readonly nodeId: string;
  readonly path: readonly (string | number)[];
  readonly src: string;
}

function collect(blocks: readonly MaterialBlock[], into: DocumentImage[]): void {
  for (const block of blocks) {
    switch (block.kind) {
      case 'image':
        into.push({ nodeId: block.nodeId, path: block.path, src: block.src });
        break;
      case 'container':
        collect(block.children, into);
        break;
      case 'table':
        for (const row of [...block.header, ...block.body, ...block.footer]) {
          for (const cell of row.cells) {
            collect(cell.children, into);
          }
        }
        break;
      case 'text':
        break;
      default: {
        const exhaustive: never = block;
        throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
      }
    }
  }
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
  collect(document.header, found);
  collect(document.root, found);
  collect(document.footer, found);
  return found;
}

import { kindOf } from '@openview/core';
import type {
  ContainerFragment,
  GridFragment,
  ImageFragment,
  MaterialFragment,
  TableFragment,
  TextFragment,
} from './types.js';

/** Visitor pattern interface for exhaustive dispatch over MaterialFragment variants. */
export interface FragmentVisitor<TResult> {
  readonly text: (fragment: TextFragment) => TResult;
  readonly image: (fragment: ImageFragment) => TResult;
  readonly container: (fragment: ContainerFragment) => TResult;
  readonly table: (fragment: TableFragment) => TResult;
  readonly grid: (fragment: GridFragment) => TResult;
}

/**
 * Dispatches a material fragment to the matching visitor handler.
 */
export function visitFragment<TResult>(
  fragment: MaterialFragment,
  visitor: FragmentVisitor<TResult>,
): TResult {
  switch (fragment.kind) {
    case 'text':
      return visitor.text(fragment);
    case 'image':
      return visitor.image(fragment);
    case 'container':
      return visitor.container(fragment);
    case 'table':
      return visitor.table(fragment);
    case 'grid':
      return visitor.grid(fragment);
    default: {
      const exhaustive: never = fragment;
      throw new TypeError(`Unhandled page fragment: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

import { kindOf } from '@openview/core';
import type {
  ContainerFragment,
  GridFragment,
  ImageFragment,
  MaterialFragment,
  TableFragment,
  TextFragment,
} from './types.js';

/** Dispatch over the fragment Composite: one exhaustive entry point for every painted kind. */
export interface FragmentVisitor<TResult> {
  readonly text: (fragment: TextFragment) => TResult;
  readonly image: (fragment: ImageFragment) => TResult;
  readonly container: (fragment: ContainerFragment) => TResult;
  readonly table: (fragment: TableFragment) => TResult;
  readonly grid: (fragment: GridFragment) => TResult;
}

/**
 * Dispatches one page fragment to the matching handler, with a compile-time exhaustiveness check.
 *
 * A sixth painted kind breaks this compilation and the visitors below it, rather than being missed
 * by a traversal that silently descends nothing.
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

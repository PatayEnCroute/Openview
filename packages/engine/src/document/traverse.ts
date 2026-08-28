/**
 * Dispatch and traversal over the materialised Composite.
 *
 * One exhaustive site for the five block kinds, and pure walks derived from it. A sixth kind breaks
 * this compilation rather than being silently skipped by a fold that descends nothing.
 */
import { kindOf } from '@openview/core';
import type { DocumentArea } from '../errors.js';
import type {
  MaterialBlock,
  MaterialContainer,
  MaterialDocument,
  MaterialGrid,
  MaterialImage,
  MaterialRow,
  MaterialTable,
  MaterialText,
} from './types.js';

/** Dispatch over the materialised block Composite: one handler per painted kind. */
export interface MaterialBlockVisitor<TResult> {
  readonly text: (block: MaterialText) => TResult;
  readonly image: (block: MaterialImage) => TResult;
  readonly container: (block: MaterialContainer) => TResult;
  readonly table: (block: MaterialTable) => TResult;
  readonly grid: (block: MaterialGrid) => TResult;
}

/**
 * Dispatches one materialised block to the matching handler, with a compile-time exhaustiveness
 * check. The only place in the engine that reads a block's discriminant.
 */
export function visitBlock<TResult>(
  block: MaterialBlock,
  visitor: MaterialBlockVisitor<TResult>,
): TResult {
  switch (block.kind) {
    case 'text':
      return visitor.text(block);
    case 'image':
      return visitor.image(block);
    case 'container':
      return visitor.container(block);
    case 'table':
      return visitor.table(block);
    case 'grid':
      return visitor.grid(block);
    default: {
      /* `kindOf` reads the discriminant and nothing else: a message must not be able to carry the
         text a block holds. */
      const exhaustive: never = block;
      throw new TypeError(`Unhandled materialised block: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

const NO_BLOCKS: readonly MaterialBlock[] = [];

/**
 * The blocks one block carries, in paint order.
 *
 * A table answers the children of its cells, header then body then footer, because a fold over the
 * document wants the blocks and not the shape that holds them; {@link rowsOf} answers the rows.
 */
export function childBlocksOf(block: MaterialBlock): readonly MaterialBlock[] {
  return visitBlock<readonly MaterialBlock[]>(block, {
    text: () => NO_BLOCKS,
    image: () => NO_BLOCKS,
    container: (container) => container.children,
    table: (table) => rowsOf(table).flatMap((row) => row.cells.flatMap((cell) => cell.children)),
    grid: (grid) => grid.items.map((item) => item.content),
  });
}

/** The rows one block declares, header then body then footer. Empty for every other kind. */
export function rowsOf(block: MaterialBlock): readonly MaterialRow[] {
  return visitBlock<readonly MaterialRow[]>(block, {
    text: () => [],
    image: () => [],
    container: () => [],
    table: (table) => [...table.header, ...table.body, ...table.footer],
    grid: () => [],
  });
}

/** Every block of a subtree, itself included, in paint order. */
export function* walkBlocks(blocks: readonly MaterialBlock[]): Generator<MaterialBlock> {
  for (const block of blocks) {
    yield block;
    yield* walkBlocks(childBlocksOf(block));
  }
}

/** One painted area of a document: which of the five it is, and the blocks it holds. */
export interface MaterialArea {
  readonly area: DocumentArea;
  readonly blocks: readonly MaterialBlock[];
}

/**
 * The painted areas of a document, in paint order: the layers behind, the three vertical regions,
 * then the layers in front. Written once here rather than at each site that walks a document.
 */
export function documentAreas(document: MaterialDocument): readonly MaterialArea[] {
  return [
    ...document.backgroundLayers.map((layer) => ({
      area: 'background' as const,
      blocks: [layer.content],
    })),
    ...document.headerBands.map((band) => ({ area: 'header' as const, blocks: [band.content] })),
    { area: 'root' as const, blocks: document.root },
    ...document.footerBands.map((band) => ({ area: 'footer' as const, blocks: [band.content] })),
    ...document.foregroundLayers.map((layer) => ({
      area: 'foreground' as const,
      blocks: [layer.content],
    })),
  ];
}

/** Every block the document paints, across its five areas, in paint order. */
export function* walkDocument(document: MaterialDocument): Generator<MaterialBlock> {
  for (const { blocks } of documentAreas(document)) {
    yield* walkBlocks(blocks);
  }
}

/**
 * The blocks of the flow: the two bands and the root.
 *
 * Layers are excluded on purpose -- they are painted on every page, out of the flow, so nothing
 * they hold advances a cursor or bounds how many pages a document needs.
 */
export function flowBlocks(document: MaterialDocument): readonly MaterialBlock[] {
  return documentAreas(document)
    .filter(({ area }) => area !== 'background' && area !== 'foreground')
    .flatMap(({ blocks }) => blocks);
}

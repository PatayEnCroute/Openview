import { visitBlock } from '../document/traverse.js';
import type { MaterialBlock, MaterialContainer, MaterialText } from '../document/types.js';
import { refusal } from '../errors.js';
import { decideKeepTogether } from './keep-together.js';
import { placeTable } from './table.js';
import { sliceText } from './text.js';
import type {
  BlockCursor,
  FlowCursor,
  MaterialFragment,
  Metrics,
  Placement,
  TableBlockCursor,
} from './types.js';
import { boxPaddingPx, FLOW_START, fragmentEdge } from './types.js';
import { wholeFragment } from './whole.js';

const MISMATCHED_CURSOR =
  'A pagination cursor named a position of a kind the block it points at does not have, so no fragment of it can be built.';

const IMAGE_TOO_TALL =
  'An image is taller than the flow a page can offer once its bands are reserved, so no page can hold it. An image is atomic: it is not cut and not scaled down to fit.';

const GRID_TOO_TALL =
  'A grid is taller than the flow a page can offer once its bands are reserved, so no page can hold it. A grid is atomic: it is not cut between its rows and not scaled down to fit.';

const NO_ROOM_INSIDE =
  'A container holds content and is left no height to print it in, once the bands of the page and its own padding have taken theirs. Read `details.nodeId` for the declaration.';

const BOX_TOO_TALL =
  'A block that cannot be cut is taller than the flow a page can offer. Read `details.nodeId` for the declaration.';

function textLineOf(inner: BlockCursor | undefined): number {
  if (inner === undefined) {
    return 0;
  }
  if (inner.kind === 'text') {
    return inner.line;
  }
  throw refusal(MISMATCHED_CURSOR, 'pagination-impossible');
}

function containerFlowOf(inner: BlockCursor | undefined): FlowCursor {
  if (inner === undefined) {
    return FLOW_START;
  }
  if (inner.kind === 'container') {
    return inner.flow;
  }
  throw refusal(MISMATCHED_CURSOR, 'pagination-impossible');
}

function tableCursorOf(inner: BlockCursor | undefined): TableBlockCursor | undefined {
  if (inner === undefined) {
    return undefined;
  }
  if (inner.kind === 'table') {
    return inner;
  }
  throw refusal(MISMATCHED_CURSOR, 'pagination-impossible');
}

/** Result of placing a single block on a page. */
interface BlockPlacement {
  readonly fragment: MaterialFragment;
  readonly height: number;
  readonly remaining: BlockCursor | undefined;
}

const spent = (cursor: FlowCursor, blocks: number): boolean =>
  cursor.index >= blocks && cursor.inner === undefined;

/** Verdict of a keep-together evaluation. */
type KeepTogetherVerdict =
  | { readonly settled: true; readonly placement: BlockPlacement | undefined }
  | { readonly settled: false };

/** Evaluates keep-together constraint on a block before attempting splitting. */
function settleKeepTogether(
  block: MaterialBlock,
  inner: BlockCursor | undefined,
  available: number,
  fresh: number,
  metrics: Metrics,
): KeepTogetherVerdict {
  if (!block.keepTogether || inner !== undefined) {
    return { settled: false };
  }
  const whole = metrics.height(block.key);
  const decision = decideKeepTogether(whole, available, fresh);
  if (decision === 'whole') {
    return {
      settled: true,
      placement: { fragment: wholeFragment(block), height: whole, remaining: undefined },
    };
  }
  if (decision === 'defer') {
    return { settled: true, placement: undefined };
  }
  return { settled: false };
}

function placeText(
  block: MaterialText,
  line: number,
  available: number,
  fresh: number,
  metrics: Metrics,
): BlockPlacement | undefined {
  const placed = sliceText(block, line, available, fresh, metrics);
  if (placed === undefined) {
    return undefined;
  }
  return {
    fragment: placed.fragment,
    height: placed.height,
    remaining: placed.nextLine === undefined ? undefined : { kind: 'text', line: placed.nextLine },
  };
}

function placeAtomic(
  block: MaterialBlock,
  available: number,
  fresh: number,
  metrics: Metrics,
  tooTall: string,
  code: 'oversized-atomic-resource' | 'pagination-impossible',
): BlockPlacement | undefined {
  const height = metrics.height(block.key);
  if (height > fresh) {
    throw refusal(tooTall, code, { nodeId: block.nodeId, path: block.declarationPath });
  }
  if (height > available) {
    return undefined;
  }
  return { fragment: wholeFragment(block), height, remaining: undefined };
}

function placeContainer(
  block: MaterialContainer,
  inner: BlockCursor | undefined,
  available: number,
  fresh: number,
  metrics: Metrics,
): BlockPlacement | undefined {
  const padding = boxPaddingPx(block.box, metrics.pxPerMm);
  if (block.children.length === 0) {
    return placeAtomic(block, available, fresh, metrics, BOX_TOO_TALL, 'pagination-impossible');
  }
  if (fresh - padding <= 0) {
    throw refusal(NO_ROOM_INSIDE, 'pagination-impossible', {
      nodeId: block.nodeId,
      path: block.declarationPath,
    });
  }
  const from = containerFlowOf(inner);
  const placed = fillFlow(block.children, from, available - padding, fresh - padding, metrics);
  if (placed.fragments.length === 0) {
    return undefined;
  }
  const done = spent(placed.cursor, block.children.length);
  const first = from.index === 0 && from.inner === undefined;
  return {
    height: padding + placed.height,
    remaining: done ? undefined : { kind: 'container', flow: placed.cursor },
    fragment: {
      kind: 'container',
      source: block,
      children: placed.fragments,
      edge: fragmentEdge(first, done),
    },
  };
}

function placeBlock(
  block: MaterialBlock,
  inner: BlockCursor | undefined,
  available: number,
  fresh: number,
  metrics: Metrics,
): BlockPlacement | undefined {
  const kept = settleKeepTogether(block, inner, available, fresh, metrics);
  if (kept.settled) {
    return kept.placement;
  }
  return visitBlock<BlockPlacement | undefined>(block, {
    text: (text) => placeText(text, textLineOf(inner), available, fresh, metrics),
    image: (image) =>
      placeAtomic(image, available, fresh, metrics, IMAGE_TOO_TALL, 'oversized-atomic-resource'),
    container: (container) => placeContainer(container, inner, available, fresh, metrics),
    table: (table) => {
      const placed = placeTable(table, tableCursorOf(inner), available, fresh, metrics, fillFlow);
      return placed === undefined
        ? undefined
        : { fragment: placed.fragment, height: placed.height, remaining: placed.remaining };
    },
    grid: (grid) =>
      placeAtomic(grid, available, fresh, metrics, GRID_TOO_TALL, 'oversized-atomic-resource'),
  });
}

/**
 * Fills available vertical height with a sequence of blocks starting at a flow cursor.
 */
export function fillFlow(
  blocks: readonly MaterialBlock[],
  cursor: FlowCursor,
  available: number,
  fresh: number,
  metrics: Metrics,
): Placement {
  const fragments: MaterialFragment[] = [];
  let used = 0;
  let index = cursor.index;
  let inner = cursor.inner;

  while (index < blocks.length) {
    const block = blocks[index];
    if (block === undefined) {
      break;
    }
    const placed = placeBlock(block, inner, available - used, fresh, metrics);
    if (placed === undefined) {
      break;
    }
    fragments.push(placed.fragment);
    used += placed.height;
    if (placed.remaining !== undefined) {
      return { fragments, height: used, cursor: { index, inner: placed.remaining } };
    }
    index += 1;
    inner = undefined;
  }

  return { fragments, height: used, cursor: { index, inner } };
}

import type { LayoutObservation } from './observation.js';

/**
 * Runs inside Chromium. Self-contained on purpose: the function is serialised and evaluated in the
 * page, so it can close over nothing from this module.
 *
 * Collection only. It reads rectangles, insets and lengths under the keys the engine annotated and
 * hands them back untouched; `deriveMeasurement` decides what they mean. No bound text, no markup
 * and no style ever travels back.
 */
export async function collectInPage(): Promise<LayoutObservation> {
  const need = (root: ParentNode, selector: string): Element => {
    const found = root.querySelector(selector);
    if (found === null) {
      throw new Error(`the rendered document has no ${selector}`);
    }
    return found;
  };

  const rectOf = (element: Element): LayoutObservation['pages'][number]['rect'] => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  };

  const rectOfRange = (range: Range): LayoutObservation['pages'][number]['rect'] => {
    const rect = range.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  };

  /** What the padding and the rules of a box take off each of its edges. */
  const insetsOf = (element: Element): LayoutObservation['boxes'][number]['insets'] => {
    const style = getComputedStyle(element);
    return {
      top: Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth),
      right: Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderRightWidth),
      bottom: Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth),
      left: Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth),
    };
  };

  /** The lowest edge any visible descendant reached, or the element's own top when it has none. */
  const contentBottomOf = (element: Element): number => {
    let bottom = element.getBoundingClientRect().top;
    for (const descendant of element.querySelectorAll('*')) {
      const rect = descendant.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    return bottom;
  };

  /** The union of every visible descendant box, or nothing when the element has none. */
  const spreadOf = (element: Element): LayoutObservation['gridItems'][number]['descendants'] => {
    let found: { left: number; top: number; right: number; bottom: number } | undefined;
    for (const descendant of element.querySelectorAll('*')) {
      const rect = descendant.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      found =
        found === undefined
          ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
          : {
              left: Math.min(found.left, rect.left),
              top: Math.min(found.top, rect.top),
              right: Math.max(found.right, rect.right),
              bottom: Math.max(found.bottom, rect.bottom),
            };
    }
    return found === undefined
      ? undefined
      : {
          ...found,
          width: found.right - found.left,
          height: found.bottom - found.top,
        };
  };

  interface Position {
    node: Node;
    offset: number;
  }

  /**
   * Every position a cut could land on, in document order, with the cursor that names it.
   *
   * A marker is one position rather than the digits it happens to show: it is atomic, and its
   * placeholder is not the value the printed page will carry.
   */
  const positionsOf = (
    block: Element,
  ): { positions: Position[]; cursors: { run: number; offset: number }[] } => {
    const positions: Position[] = [];
    const cursors: { run: number; offset: number }[] = [];
    /* Direct children only: a container box also has runs under it, but they belong to the text
       blocks inside it and their ranks restart at zero in each one. */
    for (const span of block.querySelectorAll(':scope > [data-openview-run]')) {
      const run = Number(span.getAttribute('data-openview-run'));
      if (span.classList.contains('ov-marker')) {
        const parent = span.parentNode;
        if (parent === null) {
          continue;
        }
        const at = [...parent.childNodes].indexOf(span);
        if (positions.length === 0) {
          positions.push({ node: parent, offset: at });
        }
        positions.push({ node: parent, offset: at + 1 });
        cursors.push({ run, offset: 1 });
        continue;
      }
      const text = span.firstChild;
      if (text === null || text.nodeType !== Node.TEXT_NODE) {
        continue;
      }
      const length = text.textContent?.length ?? 0;
      if (positions.length === 0) {
        positions.push({ node: text, offset: 0 });
      }
      for (let offset = 1; offset <= length; offset += 1) {
        positions.push({ node: text, offset });
        cursors.push({ run, offset });
      }
    }
    return { positions, cursors };
  };

  const range = document.createRange();
  const boxes: LayoutObservation['boxes'][number][] = [];
  for (const box of document.querySelectorAll('[data-openview-key]')) {
    const { positions, cursors } = positionsOf(box);
    const units: LayoutObservation['boxes'][number]['units'][number][] = [];
    for (let at = 1; at < positions.length; at += 1) {
      const from = positions[at - 1];
      const to = positions[at];
      const cursor = cursors[at - 1];
      if (from === undefined || to === undefined || cursor === undefined) {
        continue;
      }
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      units.push({ run: cursor.run, offset: cursor.offset, rect: rectOfRange(range) });
    }
    boxes.push({
      key: box.getAttribute('data-openview-key') ?? '',
      rect: rectOf(box),
      insets: insetsOf(box),
      units,
    });
  }

  const pages = [...document.querySelectorAll('.ov-page')].map((page) => ({
    rect: rectOf(page),
    printable: rectOf(need(page, '.ov-printable')),
    regions: (['header', 'root', 'footer'] as const).map((region) => {
      const element = need(page, `[data-openview-region="${region}"]`);
      return { region, rect: rectOf(element), contentBottom: contentBottomOf(element) };
    }),
  }));

  const images: LayoutObservation['images'][number][] = [];
  for (const image of document.querySelectorAll('img')) {
    let decoded = true;
    try {
      await image.decode();
    } catch (_error: unknown) {
      /* A failed decode is the layout observation, not an uncaught exception: `complete` is true
         either way, so the rejection and the natural sizes are the recorded evidence. */
      decoded = false;
    }
    const rect = image.getBoundingClientRect();
    images.push({
      nodeId: image.closest('[data-openview-node]')?.getAttribute('data-openview-node') ?? '',
      decoded,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
    });
  }

  const nodes: LayoutObservation['nodes'][number][] = [];
  for (const node of document.querySelectorAll('[data-openview-node]')) {
    const sheet = node.closest('.ov-page');
    if (sheet === null) {
      continue;
    }
    nodes.push({
      nodeId: node.getAttribute('data-openview-node') ?? '',
      rect: rectOf(node),
      sheet: rectOf(sheet),
    });
  }

  const gridItems = [...document.querySelectorAll('[data-openview-grid-item]')].map((wrapper) => ({
    nodeId: wrapper.getAttribute('data-openview-grid-item') ?? '',
    rect: rectOf(wrapper),
    insets: insetsOf(wrapper),
    descendants: spreadOf(wrapper),
  }));

  const markers = [...document.querySelectorAll('.ov-marker')].map((marker) => ({
    scrollWidth: marker.scrollWidth,
    clientWidth: marker.clientWidth,
  }));

  return { pages, boxes, images, nodes, gridItems, markers };
}

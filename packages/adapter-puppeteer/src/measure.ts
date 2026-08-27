import type { PdfLayoutMeasurement } from '@openview/engine';

/**
 * Runs inside Chromium. Self-contained on purpose: the function is serialised and evaluated in the
 * page, so it can close over nothing from this module.
 *
 * It reports boxes under the keys the engine annotated and line ends as cursors into the runs the
 * engine already holds. No bound text, no markup and no style ever travels back.
 */
export async function measureInPage(): Promise<PdfLayoutMeasurement> {
  const tolerance = 0.5;
  const need = (root: ParentNode, selector: string): Element => {
    const found = root.querySelector(selector);
    if (found === null) {
      throw new Error(`the rendered document has no ${selector}`);
    }
    return found;
  };

  /* Measured from descendant edges rather than scrollHeight, which is an integer and would make a
     sub-pixel layout look like an overflow. */
  const contentHeightOf = (element: Element): number => {
    const own = element.getBoundingClientRect();
    let bottom = own.top;
    for (const descendant of element.querySelectorAll('*')) {
      const rect = descendant.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    return bottom - own.top;
  };

  /** The content box of an element: what its own padding and rules leave inside it. */
  const contentBoxOf = (element: Element): { top: number; height: number } => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const top = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth);
    const bottom =
      Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth);
    return { top: rect.top + top, height: rect.height - top - bottom };
  };

  interface Boundary {
    node: Node;
    offset: number;
  }

  /**
   * Every position a cut could land on, in document order, with the cursor that names it.
   *
   * A marker is one position rather than the digits it happens to show: it is atomic, and its
   * placeholder is not the value the printed page will carry.
   */
  const boundariesOf = (
    block: Element,
  ): { positions: Boundary[]; cursors: { run: number; offset: number }[] } => {
    const positions: Boundary[] = [];
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

  const lines: PdfLayoutMeasurement['lines'][number][] = [];
  const boxes: PdfLayoutMeasurement['boxes'][number][] = [];
  const range = document.createRange();

  for (const box of document.querySelectorAll('[data-openview-key]')) {
    const key = box.getAttribute('data-openview-key') ?? '';
    const rect = box.getBoundingClientRect();
    boxes.push({ key, width: rect.width, height: rect.height });

    const { positions, cursors } = boundariesOf(box);
    const first = positions[0];
    const total = positions.length - 1;
    if (first === undefined || total <= 0) {
      continue;
    }
    const content = contentBoxOf(box);
    const rectAt = (at: number): DOMRect | undefined => {
      const from = positions[at - 1];
      const to = positions[at];
      if (from === undefined || to === undefined) {
        return undefined;
      }
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      return range.getBoundingClientRect();
    };

    /* A unit opens a new visual line when its own box starts at or below everything already on the
       current one. Comparing whole prefixes instead would split a line that mixes two font sizes,
       and would merge a blank line into the one after it. */
    let bottom: number | undefined;
    let ending: { run: number; offset: number } | undefined;
    let index = 0;
    const close = (): void => {
      if (bottom === undefined || ending === undefined) {
        return;
      }
      lines.push({ key, index, ...ending, height: bottom - content.top });
      index += 1;
      bottom = undefined;
    };
    for (let at = 1; at <= total; at += 1) {
      const rect = rectAt(at);
      if (rect === undefined || (rect.width === 0 && rect.height === 0)) {
        continue;
      }
      if (bottom !== undefined && rect.top >= bottom - tolerance) {
        close();
      }
      bottom = bottom === undefined ? rect.bottom : Math.max(bottom, rect.bottom);
      ending = cursors[at - 1];
    }
    close();

    /* The last line closes the content box: a browser reports the ink of a range, and the sum of
       the fragments has to be the whole box the paginator was told about. */
    const last = lines.at(-1);
    if (last !== undefined && last.key === key) {
      lines[lines.length - 1] = { ...last, height: Math.max(last.height, content.height) };
    }
  }

  const pages = [...document.querySelectorAll('.ov-page')].map((page) => {
    const pageBox = page.getBoundingClientRect();
    const printableBox = need(page, '.ov-printable').getBoundingClientRect();
    return {
      page: { width: pageBox.width, height: pageBox.height },
      printable: { width: printableBox.width, height: printableBox.height },
      regions: (['header', 'root', 'footer'] as const).map((region) => {
        const element = need(page, `[data-openview-region="${region}"]`);
        return {
          region,
          height: element.getBoundingClientRect().height,
          contentHeight: contentHeightOf(element),
        };
      }),
    };
  });
  if (pages.length === 0) {
    throw new Error('the rendered document has no .ov-page');
  }

  const images: PdfLayoutMeasurement['images'][number][] = [];
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

  const escaping: string[] = [];
  for (const node of document.querySelectorAll('[data-openview-node]')) {
    const sheet = node.closest('.ov-page');
    if (sheet === null) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }
    const bounds = sheet.getBoundingClientRect();
    const outside =
      rect.left < bounds.left - tolerance ||
      rect.top < bounds.top - tolerance ||
      rect.right > bounds.right + tolerance ||
      rect.bottom > bounds.bottom + tolerance;
    if (outside) {
      escaping.push(node.getAttribute('data-openview-node') ?? '');
    }
  }

  /* A grid zone is never clipped, so content past its content box is visible only here. Compared
     on both axes against the wrapper's content box; only the zone container's id travels back. */
  const overflowingGridItems: string[] = [];
  for (const wrapper of document.querySelectorAll('[data-openview-grid-item]')) {
    const style = getComputedStyle(wrapper);
    const rect = wrapper.getBoundingClientRect();
    const content = {
      left:
        rect.left + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth),
      top: rect.top + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth),
      right:
        rect.right -
        Number.parseFloat(style.paddingRight) -
        Number.parseFloat(style.borderRightWidth),
      bottom:
        rect.bottom -
        Number.parseFloat(style.paddingBottom) -
        Number.parseFloat(style.borderBottomWidth),
    };
    let escapes = false;
    for (const descendant of wrapper.querySelectorAll('*')) {
      const box = descendant.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        continue;
      }
      if (
        box.left < content.left - tolerance ||
        box.top < content.top - tolerance ||
        box.right > content.right + tolerance ||
        box.bottom > content.bottom + tolerance
      ) {
        escapes = true;
        break;
      }
    }
    if (escapes) {
      overflowingGridItems.push(wrapper.getAttribute('data-openview-grid-item') ?? '');
    }
  }

  /* A marker box is a fixed width with `overflow: hidden`, so a value one character too wide is
     invisible in the paint and visible only here. Counted, never read: the digits are render data. */
  let clippedMarkerCount = 0;
  for (const marker of document.querySelectorAll('.ov-marker')) {
    if (marker.scrollWidth > marker.clientWidth + tolerance) {
      clippedMarkerCount += 1;
    }
  }

  return { pages, boxes, lines, images, escaping, overflowingGridItems, clippedMarkerCount };
}

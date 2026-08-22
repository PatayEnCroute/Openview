import {
  CURRENT_SCHEMA_VERSION,
  type EvaluationScope,
  parseTemplate,
  STANDARD_SHEETS_MM,
  type Template,
} from '@openview/core';
import { reachableOccurrences } from '../document/bands.js';
import { materializeDocument } from '../document/materialize.js';
import type { MaterialDocument } from '../document/types.js';
import { DocumentRenderError } from '../errors.js';
import { buildPagedTree, buildProbeTree } from '../html/build-page.js';
import { serializeHtml } from '../html/serialize.js';
import { paginate } from '../pagination/paginate.js';
import type { MarkerReserve, MaterialFragment, PaginatedDocument } from '../pagination/types.js';
import { GRID, type GridLayout, gridMetrics } from './metrics.js';
/** A valid 4x2 navy png, so an image test measures a real decode rather than a placeholder. */
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGOQtsqHIwZkDgBNGgYhi5XcagAAAABJRU5ErkJggg==';

/** A valid 120x40 navy png, sized like a small logo. */
export const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAIAAAC6iKlyAAAAZklEQVR4nO3QQQkAIADAQHvYxFL2/9lCYR4swLgx19aFxvODTwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag24FGnQr0KBbgQbdCjToVqBBtwINuhVo0K1Ag251AEd4W9Pz3UCaAAAAAElFTkSuQmCC';

/** Stored template shape, before validation, so a test can feed a hostile or historic payload. */
export function storedTemplate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'tpl_test',
    name: 'Test template',
    version: '1.0.0',
    page: {
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      header: [],
      footer: [],
    },
    root: { type: 'container', id: 'root', children: [] },
    ...overrides,
  };
}

/** The same payload, validated. */
export function templateOf(overrides: Record<string, unknown> = {}): Template {
  return parseTemplate(storedTemplate(overrides));
}

/**
 * A template that satisfies the static type and fails the schema: an empty id is a `string`.
 *
 * This is the shape a JavaScript caller reaches the port with, and the reason the pipeline validates
 * a value the compiler already called a `Template`.
 */
export function unvalidatableTemplate(): Template {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: '',
    name: 'Refused',
    version: '1.0.0',
    page: {
      sheet: { ...STANDARD_SHEETS_MM.a4 },
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      header: [],
      footer: [],
    },
    root: { type: 'container', id: 'root', children: [] },
  };
}

/** A short host dataset. Its names belong to this fixture, not to Openview. */
export const SAMPLE_DATA: EvaluationScope = {
  sample: {
    reference: 42,
    label: 'acme',
    items: [
      { sku: 'A-1', count: 2, unitPrice: 10, rebate: 0 },
      { sku: 'B-2', count: 1, unitPrice: 30, rebate: 15 },
    ],
  },
  issuer: { notice: 'no early-payment discount' },
};

/** The document bound under the one-page hypothesis, which is what a first probe measures. */
export function materializedOf(
  overrides: Record<string, unknown> = {},
  data: EvaluationScope = SAMPLE_DATA,
): MaterialDocument {
  return materializeDocument(templateOf(overrides), data, reachableOccurrences(1)).document;
}

/** The same, with every band domain a run of pages can reach already bound. */
export function multiPageOf(
  overrides: Record<string, unknown> = {},
  data: EvaluationScope = SAMPLE_DATA,
): MaterialDocument {
  return materializeDocument(templateOf(overrides), data, reachableOccurrences(2)).document;
}

/** A marker reserve that answers the same width for every typography. */
export const constantMarkers = (digits = 1, width = 8): MarkerReserve => ({
  digits,
  widthOf: () => width * digits,
});

/** Cuts a document on squared paper, with no session and no browser. */
export function paginateOnGrid(
  document: MaterialDocument,
  grid: Partial<GridLayout> = {},
  markers: MarkerReserve = constantMarkers(),
): PaginatedDocument {
  const metrics = gridMetrics(document, grid);
  return paginate(document, {
    metrics,
    markers,
    printableHeight: document.printable.height * metrics.pxPerMm,
    slack: new Map(),
  });
}

/** The printed html of a document cut on squared paper. */
export function pagedHtmlOf(
  overrides: Record<string, unknown> = {},
  data: EvaluationScope = SAMPLE_DATA,
  grid: Partial<GridLayout> = {},
): string {
  return serializeHtml(buildPagedTree(paginateOnGrid(materializedOf(overrides, data), grid)));
}

/** The html of the measuring probe, which is the tree every occurrence key is annotated on. */
export function probeHtmlOf(
  overrides: Record<string, unknown> = {},
  data: EvaluationScope = SAMPLE_DATA,
): string {
  return serializeHtml(buildProbeTree(materializedOf(overrides, data), constantMarkers()).tree);
}

/** A sheet whose printable flow is exactly `lines` grid lines tall, with no margin to subtract. */
export function gridPage(
  lines: number,
  bands: { header?: readonly unknown[]; footer?: readonly unknown[] } = {},
): Record<string, unknown> {
  return {
    sheet: { width: 100, height: (lines * GRID.lineHeight) / GRID.pxPerMm },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    header: bands.header ?? [],
    footer: bands.footer ?? [],
  };
}

/** A text block of literal characters, which the grid wraps every twenty of them. */
export const literalText = (id: string, text: string): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'literal', text }],
});

/** The declaration ids painted on each page, in order, however deeply they are nested. */
export function idsPerPage(paginated: PaginatedDocument): readonly (readonly string[])[] {
  const walk = (fragments: readonly MaterialFragment[], into: string[]): void => {
    for (const fragment of fragments) {
      into.push(fragment.source.nodeId);
      if (fragment.kind === 'container') {
        walk(fragment.children, into);
      }
      if (fragment.kind === 'table') {
        for (const row of [...fragment.header, ...fragment.rows]) {
          into.push(row.source.nodeId);
          for (const cell of row.cells) {
            walk(cell.children, into);
          }
        }
      }
    }
  };
  return paginated.pages.map((page) => {
    const found: string[] = [];
    walk(page.root, found);
    return found;
  });
}

/** The characters each page prints for one text declaration, in page order. */
export function textPerPage(paginated: PaginatedDocument, nodeId: string): readonly string[] {
  const collect = (fragments: readonly MaterialFragment[], into: string[]): void => {
    for (const fragment of fragments) {
      if (fragment.kind === 'text' && fragment.source.nodeId === nodeId) {
        into.push(
          fragment.runs.map((run) => (run.kind === 'text' ? run.text : `<${run.field}>`)).join(''),
        );
      }
      if (fragment.kind === 'container') {
        collect(fragment.children, into);
      }
      if (fragment.kind === 'table') {
        for (const row of [...fragment.header, ...fragment.rows]) {
          for (const cell of row.cells) {
            collect(cell.children, into);
          }
        }
      }
    }
  };
  return paginated.pages.flatMap((page) => {
    const found: string[] = [];
    collect(page.root, found);
    return found;
  });
}

/** The refusal a pagination raised, or a failure saying it was accepted. */
export function refusalOfCut(run: () => unknown): DocumentRenderError {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the document was paginated');
}

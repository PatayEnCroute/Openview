import type { DocumentNodeType } from '../../ast/nodes.js';
import type { Sheet } from '../../page/page.js';
import type { RenderRequest } from '../render.js';

/** One repetition an occurrence sits under: the repeatable declaration, and its zero-based rank. */
export interface IterationAddress {
  readonly declarationPath: readonly (string | number)[];
  readonly index: number;
}

/**
 * Where one painted occurrence comes from: its declaration, and the repetitions above it.
 *
 * `iterations` is ordered outermost first. Ranks move when a template or a sequence gains an entry,
 * so an address addresses one render and is never a durable business identifier to store.
 */
export interface OccurrenceAddress {
  readonly declarationPath: readonly (string | number)[];
  readonly iterations: readonly IterationAddress[];
}

/**
 * One occurrence, named by its address and labelled by the declaration it repeats.
 *
 * `nodeId` is a label: a loop repeats it, so it is never the key two occurrences are told apart by.
 */
export interface OccurrenceReference extends OccurrenceAddress {
  readonly nodeId: string;
  readonly nodeType: DocumentNodeType;
}

/** The five areas of a page, in paint order. */
export const PAGINATION_REGIONS = ['background', 'header', 'root', 'footer', 'foreground'] as const;

export type PaginationRegion = (typeof PAGINATION_REGIONS)[number];

/**
 * Why one occurrence is painted where it is.
 *
 * A band and a layer keep their own role throughout their content; inside the flow, a repeated
 * table header is told apart from the body rows it precedes.
 */
export const PLACEMENT_ROLES = ['flow', 'page-band', 'table-header', 'page-layer'] as const;

export type PlacementRole = (typeof PLACEMENT_ROLES)[number];

/** Which part of its whole a placement carries. */
export const FRAGMENT_STATES = ['whole', 'first', 'middle', 'last'] as const;

export type FragmentState = (typeof FRAGMENT_STATES)[number];

/** One occurrence painted on one page, with the region, the role and the part it carries. */
export interface PagePlacement {
  readonly occurrence: OccurrenceReference;
  readonly region: PaginationRegion;
  readonly role: PlacementRole;
  readonly fragment: FragmentState;
}

/**
 * What the pages before this one carry into it, and which rows closed the boundary.
 *
 * `incoming` is the raw, unrounded cumulative sum every report marker of the page is written from;
 * each marker applies the rounding its own site declared. A row cut across pages is listed once,
 * on the page holding its last fragment.
 */
export interface PageReportResult {
  readonly incoming: number;
  readonly completedBy: readonly OccurrenceReference[];
}

/**
 * An occurrence that asked to stay whole, could not, and took the ordinary policy instead.
 *
 * Observed on the accepted sequence: no page new enough could hold it entire, so it was spread over
 * `pages`. Neither an error nor a warning stored in the template.
 */
export interface KeepTogetherFallbackNotice {
  readonly code: 'keep-together-fallback';
  readonly occurrence: OccurrenceReference;
  readonly pages: readonly number[];
}

export type PaginationNotice = KeepTogetherFallbackNotice;

export const PAGINATION_NOTICE_CODES = ['keep-together-fallback'] as const;

export type PaginationNoticeCode = (typeof PAGINATION_NOTICE_CODES)[number];

/** One composed page: its rank, what it paints in paint order, and its report boundary. */
export interface PaginationPageResult {
  readonly number: number;
  readonly placements: readonly PagePlacement[];
  readonly report: PageReportResult;
}

/**
 * The cuts an engine chose, and the standalone html those cuts composed.
 *
 * `html` is the composition a pdf of the same request would be printed from, and it is opaque: its
 * markup, classes and attribute order are not an integration contract. It carries rendered data, so
 * it is as sensitive as the pdf and belongs in an isolated, script-free document context.
 */
export interface PaginationResult {
  readonly sheet: Sheet;
  readonly html: string;
  readonly pages: readonly PaginationPageResult[];
  readonly notices: readonly PaginationNotice[];
}

/** Hexagonal port for engines that can compose a document's pages without exporting it. */
export interface PaginationPort {
  paginate(request: RenderRequest): Promise<PaginationResult>;
}

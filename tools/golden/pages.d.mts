/**
 * Types for the page-level diagnosis of E7.
 *
 * The tool itself stays plain JavaScript so the ci job runs it with `node` and no build step; these
 * declarations exist so the tests that exercise it are type-checked like every other.
 */
import type { PaginationResult } from '../../packages/core/dist/index.js';

/** Bumped whenever the bytes an unchanged page extracts to could change. */
export declare const PAGE_EXTRACTOR_VERSION: number;

/** How many pages a pdf really holds. */
export declare function pageCountOf(bytes: Uint8Array): Promise<number>;

/**
 * The single-page document of one rank, canonicalised the way a delivered document is.
 *
 * Throws a `RangeError` naming the rank when it is not one of the pages of the document.
 */
export declare function extractPage(bytes: Uint8Array, number: number): Promise<Uint8Array>;

/** The E5 certificate of one page: its page result and the notices that name it. */
export declare function certificateOf(pagination: PaginationResult, number: number): string;

/** The sheet the whole document was composed on. */
export declare function sheetCertificateOf(pagination: PaginationResult): string;

/** Every notice of the document, in the order the engine emitted them. */
export declare function noticesCertificateOf(pagination: PaginationResult): string;

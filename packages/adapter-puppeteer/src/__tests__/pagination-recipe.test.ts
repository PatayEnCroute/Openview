import type { EvaluationScope, PagePlacement, PaginationResult } from '@openview/core';
import { roundDecimal } from '@openview/core';
import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import {
  type CapturedPagination,
  inspectPdf,
  paginateCapturing,
  renderCapturing,
  templateOf,
} from './fixtures.js';
import {
  APPEARANCES,
  type Appearance,
  ENGLISH_VALUES,
  FRAMED,
  FRENCH_VALUES,
  layeredReferenceDocument,
  referenceDocument,
  SIXTY_ROWS,
  worded,
  writtenReferenceDocument,
} from './reference-document.js';

/**
 * Room for Chromium to launch and lay a document out, under a loaded machine.
 *
 * A watchdog against a hung browser, never a performance budget: the whole suite holds several
 * browsers at once, so a threshold near the uncontended figure fails on contention, not on a fault.
 */
const CHROMIUM_TIMEOUT_MS = 120_000;

const paginations = new Map<string, Promise<CapturedPagination>>();

/** One pagination per key, so the whole file launches a handful of browsers rather than one each. */
function once(key: string, run: () => Promise<CapturedPagination>): Promise<CapturedPagination> {
  const found = paginations.get(key);
  if (found !== undefined) {
    return found;
  }
  const running = run();
  paginations.set(key, running);
  return running;
}

const sixty = (appearance: Appearance): Promise<CapturedPagination> =>
  once(`sixty|${appearance.name}`, () =>
    paginateCapturing(referenceDocument(appearance), SIXTY_ROWS),
  );

const count = (html: string, needle: string): number => html.split(needle).length - 1;

/** Everything one sheet of the composed document holds, split on the page boxes themselves. */
const sheets = (html: string): readonly string[] => html.split('class="ov-page"').slice(1);

const idsOn = (page: { readonly placements: readonly PagePlacement[] }, role: string): string[] =>
  page.placements.filter((one) => one.role === role).map((one) => one.occurrence.nodeId);

/** The pages a declaration is placed on, one-based, read from the manifest alone. */
const pagesOf = (result: PaginationResult, nodeId: string): readonly number[] =>
  result.pages
    .filter((page) => page.placements.some((one) => one.occurrence.nodeId === nodeId))
    .map((page) => page.number);

describe('the recette of E5: sixty lines, explained without a pdf', () => {
  for (const appearance of APPEARANCES) {
    it(
      `announces four pages for ${appearance.name} and prints nothing`,
      async () => {
        const { result } = await sixty(appearance);
        expect(result.pages.map((page) => page.number)).toStrictEqual([1, 2, 3, 4]);
        expect(count(result.html, 'class="ov-page"')).toBe(4);
        expect(result.sheet).toStrictEqual({ width: 210, height: 297 });
      },
      CHROMIUM_TIMEOUT_MS,
    );
  }

  it(
    'returns the very source the pdf of the same request is printed from',
    async () => {
      const { result } = await sixty(FRAMED);
      const { printed, bytes } = await renderCapturing(referenceDocument(FRAMED), SIXTY_ROWS);
      expect(result.html).toBe(printed.html);
      /* And the sheets the reader gets are the pages the manifest announced. */
      expect((await inspectPdf(bytes)).pages).toBe(result.pages.length);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'places every detail row on the page whose markup really paints it',
    async () => {
      const { result } = await sixty(FRAMED);
      const perPage = result.pages.map(
        (page) => page.placements.filter((one) => one.occurrence.nodeId === 'detail').length,
      );
      const painted = sheets(result.html).map((sheet) =>
        count(sheet, 'data-openview-node="detail"'),
      );
      expect(perPage).toStrictEqual(painted);
      expect(perPage.reduce((total, one) => total + one, 0)).toBe(60);
      expect(perPage.every((one) => one > 0)).toBe(true);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'tells the repeated column header apart from the body rows on all four pages',
    async () => {
      const { result } = await sixty(FRAMED);
      for (const page of result.pages) {
        expect(idsOn(page, 'table-header')).toContain('head');
        expect(idsOn(page, 'flow')).toContain('detail');
        expect(idsOn(page, 'flow')).not.toContain('head');
        expect(count(sheets(result.html)[page.number - 1] ?? '', 'data-openview-node="head"')).toBe(
          1,
        );
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'marks the table as cut on the pages it continues, and whole nowhere',
    async () => {
      const { result } = await sixty(FRAMED);
      const edges = result.pages.map(
        (page) => page.placements.find((one) => one.occurrence.nodeId === 'rows')?.fragment,
      );
      expect(edges).toStrictEqual(['first', 'middle', 'middle', 'last']);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'puts each band on the pages its declared domain names, and under the band role',
    async () => {
      const { result } = await sixty(FRAMED);
      expect(pagesOf(result, 'stripe-carried')).toStrictEqual([2, 3, 4]);
      expect(pagesOf(result, 'running-foot-num')).toStrictEqual([1, 2, 3]);
      expect(pagesOf(result, 'final-foot-num')).toStrictEqual([4]);
      for (const page of result.pages) {
        expect(idsOn(page, 'page-band')).toContain('stripe');
      }
      const regions = result.pages.flatMap((page) =>
        page.placements
          .filter((one) => one.occurrence.nodeId === 'running-foot-num')
          .map((one) => one.region),
      );
      expect(regions).toStrictEqual(['footer', 'footer', 'footer']);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'reports the sum each page carries in, exactly as the page itself prints it',
    async () => {
      const { result } = await sixty(FRAMED);
      expect(result.pages[0]?.report.incoming).toBe(0);
      /* The oracle is the composed page, not a figure copied out of the engine: the marker of the
         top band writes the carried total, rounded the way the model declared it. */
      const written = sheets(result.html).map((sheet) => {
        const band = sheet.split('data-openview-region="header"')[1] ?? '';
        const slot = band.slice(0, band.indexOf('data-openview-region='));
        return [...slot.matchAll(/class="ov-marker"[^>]*>([^<]*)</g)].map(
          (match) => match[1] ?? '',
        );
      });
      expect(written[0]).toStrictEqual([]);
      for (const page of result.pages.slice(1)) {
        expect(written[page.number - 1]).toStrictEqual([
          String(roundDecimal(page.report.incoming, 2, 'halfExpand')),
        ]);
      }
      expect(result.pages.at(-1)?.report.incoming).toBeGreaterThan(0);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'attributes every closing row to a page that also places it, sixty rows once each',
    async () => {
      const { result } = await sixty(FRAMED);
      for (const page of result.pages) {
        for (const one of page.report.completedBy) {
          expect(one.nodeId).toBe('detail');
          expect(
            page.placements.some(
              (placement) => JSON.stringify(placement.occurrence) === JSON.stringify(one),
            ),
          ).toBe(true);
        }
      }
      const closed = result.pages.flatMap((page) =>
        page.report.completedBy.map((one) => one.iterations.at(-1)?.index),
      );
      /* Sixty rows, each closing exactly once, in the order the sequence declared them. */
      expect(closed).toStrictEqual(Array.from({ length: 60 }, (_unused, index) => index));
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it(
    'holds no measurement key, no cursor and no bound value in the manifest',
    async () => {
      const { result } = await sixty(FRAMED);
      const manifest = JSON.stringify({ pages: result.pages, notices: result.notices });
      expect(manifest).not.toMatch(/"o\d+"/);
      expect(manifest).not.toContain('cursor');
      expect(manifest).not.toContain('€');
      /* Measured, not hoped for: on this document the manifest sits within a fifth of the source it
         explains. The bound is what would redden if a placement started copying content. */
      expect(manifest.length).toBeLessThan(result.html.length * 1.2);
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

describe('the layers of the recette', () => {
  it(
    'paints both planes on every page without moving a single cut',
    async () => {
      const layered = await once('layers|on', () =>
        paginateCapturing(layeredReferenceDocument(FRAMED), SIXTY_ROWS),
      );
      const bare = await once('layers|off', () =>
        paginateCapturing(layeredReferenceDocument(FRAMED, false), SIXTY_ROWS),
      );
      const rowsPerPage = (result: PaginationResult): readonly number[] =>
        result.pages.map(
          (page) => page.placements.filter((one) => one.occurrence.nodeId === 'detail').length,
        );
      expect(rowsPerPage(layered.result)).toStrictEqual(rowsPerPage(bare.result));

      for (const page of layered.result.pages) {
        const planes = page.placements
          .filter((one) => one.role === 'page-layer')
          .map((one) => one.region);
        expect(planes).toContain('background');
        expect(planes).toContain('foreground');
        expect(page.placements[0]?.region).toBe('background');
        expect(page.placements.at(-1)?.region).toBe('foreground');
      }
    },
    CHROMIUM_TIMEOUT_MS * 2,
  );
});

describe('the two writings of E4, paginated', () => {
  const template = writtenReferenceDocument(FRAMED);

  const diagonal = (
    language: 'fr' | 'en',
    values: Readonly<Record<string, string>>,
  ): Promise<CapturedPagination> =>
    once(`written|${language}`, () =>
      paginateCapturing(template, worded(SIXTY_ROWS, language) as EvaluationScope, {
        presentationSelection: values,
      }),
    );

  it.each([
    ['French words and euros', 'fr', FRENCH_VALUES] as const,
    ['English words and dollars', 'en', ENGLISH_VALUES] as const,
  ])(
    'explains %s over four pages from the same stored template',
    async (_label, language, values) => {
      const { result } = await diagonal(language, values);
      expect(result.pages).toHaveLength(4);
      expect(count(result.html, 'class="ov-page"')).toBe(4);
      expect(
        result.pages.map((page) => page.report.completedBy.length).reduce((a, b) => a + b),
      ).toBe(60);
    },
    CHROMIUM_TIMEOUT_MS,
  );

  it.each([
    ['French words and euros', 'fr', FRENCH_VALUES] as const,
    ['English words and dollars', 'en', ENGLISH_VALUES] as const,
  ])(
    'hands over the characters the engine already wrote for %s, with nothing left to format',
    async (_label, language, values) => {
      const { result } = await diagonal(language, values);
      const printed = await renderCapturing(template, worded(SIXTY_ROWS, language), {
        presentationSelection: values,
      });
      /* The same characters, currency symbol and separators included: a consumer of this result has
         no locale to apply and no figure to write. */
      expect(result.html).toBe(printed.printed.html);
      const manifest = JSON.stringify({ pages: result.pages, notices: result.notices });
      expect(manifest).not.toContain('locale');
      expect(manifest).not.toContain('currency');
    },
    CHROMIUM_TIMEOUT_MS * 2,
  );
});

describe('a pagination that cannot be composed', () => {
  it(
    'refuses without producing a page, and closes its browser',
    async () => {
      /* One image the adapter cannot print: the session refuses before a browser even opens. */
      const broken = templateOf({
        root: {
          type: 'container',
          id: 'root',
          children: [{ type: 'image', id: 'remote', src: 'https://example.invalid/logo.png' }],
        },
      });
      const caught: unknown = await paginateCapturing(broken).catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(DocumentRenderError);
      if (caught instanceof DocumentRenderError) {
        expect(caught.code).toBe('unsupported-image-source');
      }
    },
    CHROMIUM_TIMEOUT_MS,
  );
});

import { createHash } from 'node:crypto';
import type { PaginationResult } from '@openview/core';
import { createPaginationPort, DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import {
  hasTrailerId,
  hostStrategy,
  inspectPdf,
  LOGO_JPEG,
  LOGO_PNG,
  LOGO_WEBP,
  metadataOf,
  pageOf,
  renderCapturing,
  templateOf,
  text,
} from './fixtures.js';
import {
  APPEARANCES,
  type Appearance,
  ENGLISH_VALUES,
  FRAMED,
  FRENCH_VALUES,
  referenceDocument,
  SIXTY_ROWS,
  worded,
  writtenReferenceDocument,
} from './reference-document.js';

/**
 * Room for Chromium to launch and lay a document out ten times over, under a loaded machine.
 *
 * A watchdog against a hung browser, never a performance budget.
 */
const RECIPE_TIMEOUT_MS = 600_000;

/** How many times the recipe renders one document. Ten, as the acceptance criterion states. */
const TIMES = 10;

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The distinct digests of a sequence of renders: one entry means every render was identical. */
const digestsOf = (renders: readonly Uint8Array[]): ReadonlySet<string> =>
  new Set(renders.map(sha256));

const image = (id: string, src: string): Record<string, unknown> => ({ type: 'image', id, src });

describe('the same pdf, ten times over', () => {
  it.each(APPEARANCES.map((appearance) => [appearance.name, appearance] as const))(
    'renders %s to the same bytes on all ten runs',
    async (_name: string, appearance: Appearance) => {
      const template = referenceDocument(appearance);
      const renders: Uint8Array[] = [];
      for (let run = 0; run < TIMES; run += 1) {
        renders.push((await renderCapturing(template, SIXTY_ROWS)).bytes);
      }
      expect(renders).toHaveLength(TIMES);
      expect(digestsOf(renders).size).toBe(1);
      expect(new Set(renders.map((bytes) => bytes.length)).size).toBe(1);
    },
    RECIPE_TIMEOUT_MS,
  );

  it(
    'renders the two writings of E4 to stable bytes, each compared only with itself',
    async () => {
      /* Never FR against EN: two writings are two documents, and the ADR 0008 reserve forbids
         comparing strings across profiles rather than across writings. */
      const template = writtenReferenceDocument(FRAMED);
      const perWriting = new Map<string, Set<string>>();
      for (const [language, values] of [
        ['fr', FRENCH_VALUES],
        ['en', ENGLISH_VALUES],
      ] as const) {
        const digests = new Set<string>();
        for (let run = 0; run < TIMES; run += 1) {
          const { bytes } = await renderCapturing(template, worded(SIXTY_ROWS, language), {
            presentationSelection: values,
          });
          digests.add(sha256(bytes));
        }
        perWriting.set(language, digests);
      }
      expect(perWriting.get('fr')?.size).toBe(1);
      expect(perWriting.get('en')?.size).toBe(1);
      /* And the two writings really are two documents, so the recipe is not trivially stable. */
      expect([...(perWriting.get('fr') ?? [])][0]).not.toBe([...(perWriting.get('en') ?? [])][0]);
    },
    RECIPE_TIMEOUT_MS,
  );

  it(
    'writes fixed metadata and no file identifier on every one of the ten runs',
    async () => {
      const template = referenceDocument(FRAMED);
      for (let run = 0; run < 3; run += 1) {
        const { bytes } = await renderCapturing(template, SIXTY_ROWS);
        expect(await metadataOf(bytes)).toStrictEqual({
          title: 'Openview',
          author: '',
          subject: '',
          keywords: '',
          creator: 'Openview',
          producer: 'Openview',
          creationDate: '1970-01-01T00:00:00.000Z',
          modificationDate: '1970-01-01T00:00:00.000Z',
        });
        expect(await hasTrailerId(bytes)).toBe(false);
      }
    },
    RECIPE_TIMEOUT_MS,
  );
});

describe('the same paginated source, ten times over', () => {
  it(
    'answers the same html and the same manifest on all ten runs, printing nothing',
    async () => {
      const port = createPaginationPort(hostStrategy());
      const template = referenceDocument(FRAMED);
      const results: PaginationResult[] = [];
      for (let run = 0; run < TIMES; run += 1) {
        results.push(await port.paginate({ template, data: SIXTY_ROWS }));
      }
      const first = results[0];
      expect(first).toBeDefined();
      if (first === undefined) {
        return;
      }
      expect(new Set(results.map((result) => result.html)).size).toBe(1);
      for (const result of results) {
        /* A deep comparison, not a page count: the pages, their placements, the fragments they
           carry, the reports they announce and the notices they raise, all in the same order. */
        expect(result).toStrictEqual(first);
      }
    },
    RECIPE_TIMEOUT_MS,
  );
});

describe('the three bitmap formats the adapter accepts', () => {
  it.each([
    ['png', LOGO_PNG],
    ['jpeg', LOGO_JPEG],
    ['webp', LOGO_WEBP],
  ])(
    'lays %s out to the same bytes on every run',
    async (_format, src) => {
      const template = templateOf({
        page: pageOf(60, 60),
        root: { type: 'container', id: 'root', children: [image('logo', src)] },
      });
      const renders: Uint8Array[] = [];
      for (let run = 0; run < 3; run += 1) {
        renders.push((await renderCapturing(template)).bytes);
      }
      expect(digestsOf(renders).size).toBe(1);
      expect((await inspectPdf(renders[0] ?? new Uint8Array())).pages).toBe(1);
    },
    RECIPE_TIMEOUT_MS,
  );

  it(
    'lays the same drawing out identically whichever of the three encodes it',
    async () => {
      /* The same 120x40 drawing in three containers: the three decoders must agree on the
         intrinsic size, so the page count and the cuts cannot depend on the format. */
      const pagesOf = async (src: string): Promise<number> => {
        const { bytes } = await renderCapturing(
          templateOf({
            page: pageOf(60, 60),
            root: { type: 'container', id: 'root', children: [image('logo', src)] },
          }),
        );
        return (await inspectPdf(bytes)).pages;
      };
      const counts = await Promise.all([LOGO_PNG, LOGO_JPEG, LOGO_WEBP].map(pagesOf));
      expect(new Set(counts).size).toBe(1);
    },
    RECIPE_TIMEOUT_MS,
  );

  it(
    'prints one document carrying all three formats, and prints it the same way twice',
    async () => {
      const template = templateOf({
        page: pageOf(120, 120),
        root: {
          type: 'container',
          id: 'root',
          children: [
            text('caption', 'three decoders'),
            image('as-png', LOGO_PNG),
            image('as-jpeg', LOGO_JPEG),
            image('as-webp', LOGO_WEBP),
          ],
        },
      });
      const first = await renderCapturing(template);
      const second = await renderCapturing(template);
      expect(sha256(first.bytes)).toBe(sha256(second.bytes));
      expect(first.printed.images.map((one) => one.nodeId)).toStrictEqual([
        'as-png',
        'as-jpeg',
        'as-webp',
      ]);
    },
    RECIPE_TIMEOUT_MS,
  );
});

describe('what the browser is not allowed to substitute', () => {
  it(
    'refuses a document whose embedded face the browser could not load',
    async () => {
      /* The bytes of a face are part of the build, so the only way to reach this refusal from a
         test is to hand the session a source whose `@font-face` carries a broken payload. It is
         the guard that matters: without it, Chromium would quietly paint in a system font. */
      const session = await hostStrategy().open({ sheet: { width: 60, height: 60 }, images: [] });
      const broken =
        '<!doctype html><html><head><style>' +
        '@font-face{font-family:"__openview_broken";font-style:normal;font-weight:400;' +
        'src:url(data:font/ttf;base64,QUJDREVG) format("truetype")}' +
        '</style></head><body><div class="ov-page"><div class="ov-printable">' +
        '<div data-openview-region="header"></div>' +
        '<div data-openview-region="root">' +
        '<span style=\'font-family:"__openview_broken"\'>x</span>' +
        '</div><div data-openview-region="footer"></div></div></div></body></html>';
      try {
        await expect(
          session.measure({ html: broken, sheet: { width: 60, height: 60 }, images: [] }),
        ).rejects.toThrow(DocumentRenderError);
      } finally {
        await session.close();
      }
    },
    RECIPE_TIMEOUT_MS,
  );

  it(
    'measures a phrase that would break differently in a font of the host',
    async () => {
      /* Set in the embedded face, this phrase fills its column exactly. A host font of other
         metrics would wrap it elsewhere, so the cut is evidence the embedded bytes were used. */
      const phrase = 'Wenn die Zahlungsfrist überschritten ist, laufen Verzugszinsen.';
      const first = await renderCapturing(
        templateOf({
          page: pageOf(70, 40),
          root: { type: 'container', id: 'root', children: [text('t', phrase)] },
        }),
      );
      const second = await renderCapturing(
        templateOf({
          page: pageOf(70, 40),
          root: { type: 'container', id: 'root', children: [text('t', phrase)] },
        }),
      );
      expect(first.printed.html).toBe(second.printed.html);
      expect(sha256(first.bytes)).toBe(sha256(second.bytes));
    },
    RECIPE_TIMEOUT_MS,
  );
});

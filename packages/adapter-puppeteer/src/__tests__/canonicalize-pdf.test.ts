import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { canonicalizePdf } from '../canonicalize-pdf.js';
import { hasTrailerId, inspectPdf, metadataOf } from './fixtures.js';

const CANONICAL_METADATA = {
  title: 'Openview',
  author: '',
  subject: '',
  keywords: '',
  creator: 'Openview',
  producer: 'Openview',
  creationDate: '1970-01-01T00:00:00.000Z',
  modificationDate: '1970-01-01T00:00:00.000Z',
};

/** What the info dictionary of the file really holds, keys included, read back from the bytes. */
async function infoKeysOf(bytes: Uint8Array): Promise<readonly string[]> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const info = pdf.context.lookup(pdf.context.trailerInfo.Info);
  const keys =
    info !== undefined && 'keys' in info && typeof info.keys === 'function' ? info.keys() : [];
  return [...keys].map((key) => String(key)).sort();
}

/**
 * A document shaped like one a browser hands over: pages, an info dictionary carrying the moment of
 * printing and the name of the engine that produced it, and a trailer identifier.
 */
async function printedLike(options: {
  readonly pages?: readonly (readonly [number, number])[];
  readonly stamped: string;
  readonly creator?: string;
  readonly extra?: Readonly<Record<string, string>>;
  readonly identified?: boolean;
}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (const [width, height] of options.pages ?? [[595, 842]]) {
    document.addPage([width, height]);
  }
  document.setTitle('about:blank');
  document.setCreator(options.creator ?? 'Chromium');
  document.setProducer('Skia/PDF m152');
  const info = document.context.lookup(document.context.trailerInfo.Info);
  if (info !== undefined && 'set' in info && typeof info.set === 'function') {
    info.set(PDFName.of('CreationDate'), PDFString.of(options.stamped));
    info.set(PDFName.of('ModDate'), PDFString.of(options.stamped));
    for (const [key, value] of Object.entries(options.extra ?? {})) {
      info.set(PDFName.of(key), PDFString.of(value));
    }
  }
  if (options.identified === true) {
    document.context.trailerInfo.ID = document.context.obj([
      PDFHexString.of(options.stamped.padEnd(32, '0').slice(0, 32)),
      PDFHexString.of(options.stamped.padEnd(32, '0').slice(0, 32)),
    ]);
  }
  return await document.save({ useObjectStreams: false });
}

describe('the canonical form of a printed pdf', () => {
  it('erases the difference between two prints a second apart', async () => {
    const first = await canonicalizePdf(await printedLike({ stamped: 'D:20260828190000Z' }));
    const second = await canonicalizePdf(await printedLike({ stamped: 'D:20260828190001Z' }));
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(first.length).toBe(second.length);
  });

  it('erases the name of the browser that happened to print it', async () => {
    const chromium = await canonicalizePdf(
      await printedLike({ stamped: 'D:20260828190000Z', creator: 'Chromium 152' }),
    );
    const other = await canonicalizePdf(
      await printedLike({ stamped: 'D:20260828190000Z', creator: 'Some other build' }),
    );
    expect(Buffer.from(chromium).equals(Buffer.from(other))).toBe(true);
  });

  it('writes the same fixed metadata whatever the file arrived with', async () => {
    const bytes = await canonicalizePdf(await printedLike({ stamped: 'D:20260828190000Z' }));
    expect(await metadataOf(bytes)).toStrictEqual(CANONICAL_METADATA);
  });

  it('removes an entry the browser invented, and keeps the eight canonical ones', async () => {
    const bytes = await canonicalizePdf(
      await printedLike({
        stamped: 'D:20260828190000Z',
        extra: { GTS_PDFXVersion: 'PDF/X-4', UserAgent: 'Mozilla/5.0' },
      }),
    );
    expect(await infoKeysOf(bytes)).toStrictEqual([
      '/Author',
      '/CreationDate',
      '/Creator',
      '/Keywords',
      '/ModDate',
      '/Producer',
      '/Subject',
      '/Title',
    ]);
  });

  it('drops a trailer identifier, which is drawn afresh at every print', async () => {
    const printed = await printedLike({ stamped: 'D:20260828190000Z', identified: true });
    expect(await hasTrailerId(printed)).toBe(true);
    expect(await hasTrailerId(await canonicalizePdf(printed))).toBe(false);
  });

  it('carries every page through at its own size', async () => {
    const bytes = await canonicalizePdf(
      await printedLike({
        stamped: 'D:20260828190000Z',
        pages: [
          [595, 842],
          [842, 595],
          [200, 200],
        ],
      }),
    );
    const { pages, sizes } = await inspectPdf(bytes);
    expect(pages).toBe(3);
    expect(sizes).toStrictEqual([
      { width: 595, height: 842 },
      { width: 842, height: 595 },
      { width: 200, height: 200 },
    ]);
  });

  it('is a fixed point: canonicalising a canonical file changes nothing', async () => {
    const once = await canonicalizePdf(await printedLike({ stamped: 'D:20260828190000Z' }));
    const twice = await canonicalizePdf(once);
    expect(Buffer.from(twice).equals(Buffer.from(once))).toBe(true);
  });

  it('depends on the bytes it was given and not on the moment it was called', async () => {
    const printed = await printedLike({ stamped: 'D:20260828190000Z' });
    const early = await canonicalizePdf(printed);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const late = await canonicalizePdf(printed);
    expect(Buffer.from(late).equals(Buffer.from(early))).toBe(true);
  });

  it('still parses as a pdf, and says so in its own header', async () => {
    const bytes = await canonicalizePdf(await printedLike({ stamped: 'D:20260828190000Z' }));
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });
});

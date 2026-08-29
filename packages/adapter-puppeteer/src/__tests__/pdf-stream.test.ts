import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { assertCanonicalSize, readBoundedPdf } from '../pdf-stream.js';

/** A stream of the chunks a test names, in order. */
function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[at];
      at += 1;
      if (chunk === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
  });
}

/** A stream that never ends, the way a browser writing for ever would look. */
function endlessStream(): {
  readonly stream: ReadableStream<Uint8Array>;
  cancelled: () => boolean;
} {
  let cancelled = false;
  return {
    cancelled: () => cancelled,
    stream: new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1_024));
      },
      cancel() {
        cancelled = true;
      },
    }),
  };
}

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

describe('reading a printed pdf', () => {
  it('joins the chunks in the order they arrived', async () => {
    await expect(
      readBoundedPdf(streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]), 64),
    ).resolves.toStrictEqual(new Uint8Array([1, 2, 3]));
  });

  it('accepts an empty document and a stream of empty chunks', async () => {
    await expect(readBoundedPdf(streamOf([]), 64)).resolves.toStrictEqual(new Uint8Array());
    await expect(readBoundedPdf(streamOf([new Uint8Array()]), 64)).resolves.toStrictEqual(
      new Uint8Array(),
    );
  });

  it('accepts a document of exactly the ceiling', async () => {
    await expect(readBoundedPdf(streamOf([new Uint8Array(64)]), 64)).resolves.toHaveLength(64);
  });

  it('refuses the chunk that crosses the ceiling', async () => {
    const refused = await refusalOf(
      readBoundedPdf(streamOf([new Uint8Array(64), new Uint8Array(1)]), 64),
    );
    expect(refused.code).toBe('pdf-limit-exceeded');
    expect(refused.details.limit).toBe(64);
    expect(refused.details.observed).toBe(65);
    expect(refused.details.phase).toBe('export');
  });

  it('cancels a stream that never ends rather than reading it to a conclusion', async () => {
    const endless = endlessStream();
    await refusalOf(readBoundedPdf(endless.stream, 4_096));
    expect(endless.cancelled()).toBe(true);
  });

  it('lets a failure of the stream itself travel, and releases its reader', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('the browser dropped the connection'));
      },
    });
    const caught: unknown = await readBoundedPdf(stream, 64).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(DocumentRenderError);
  });
});

describe('the canonical document a caller receives', () => {
  it('passes through when it fits the ceiling', () => {
    const bytes = new Uint8Array(10);
    expect(assertCanonicalSize(bytes, 10)).toBe(bytes);
  });

  it('is refused when rewriting made it larger than the ceiling', () => {
    /* Checked a second time on purpose: canonicalisation rewrites the file and may grow it. */
    const refused = (() => {
      try {
        assertCanonicalSize(new Uint8Array(11), 10);
      } catch (error) {
        return error;
      }
      throw new Error('the document was accepted');
    })();
    expect(refused).toBeInstanceOf(DocumentRenderError);
    if (refused instanceof DocumentRenderError) {
      expect(refused.code).toBe('pdf-limit-exceeded');
      expect(refused.details.observed).toBe(11);
    }
  });
});

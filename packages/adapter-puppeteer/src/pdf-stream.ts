import { DocumentRenderError } from '@openview/engine';

const TOO_LARGE =
  'This document produced more pdf bytes than one render may hold. Read `details.limit` for the ceiling and `details.observed` for what had already arrived; the stream was cancelled rather than buffered to its end.';

const CANONICAL_TOO_LARGE =
  'The canonical form of this document is larger than one render may return. Read `details.limit` for the ceiling in bytes.';

/**
 * Reads a printed pdf under a byte ceiling.
 *
 * A stream announces no length, so the count is on the chunks that really arrive.
 */
export async function readBoundedPdf(
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value === undefined) {
        continue;
      }
      total += value.byteLength;
      if (total > limit) {
        /* Cancelled rather than drained: a browser that keeps writing would otherwise be read to
           its end only for the result to be thrown away. Deliberately not awaited: a source is free
           to answer its cancellation slowly or not at all, and this refusal must not wait on it nor
           be replaced by whatever the cancellation itself rejects with. */
        void reader.cancel().then(undefined, () => undefined);
        throw new DocumentRenderError(TOO_LARGE, 'pdf-limit-exceeded', {
          phase: 'export',
          limit,
          observed: total,
        });
      }
      chunks.push(value);
    }
  } finally {
    /* Released on every path, refusal included: a reader still locked keeps the stream and the
       browser handle behind it alive. */
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/** Refuses a canonical document larger than the caller may receive. */
export function assertCanonicalSize(bytes: Uint8Array, limit: number): Uint8Array {
  if (bytes.byteLength > limit) {
    throw new DocumentRenderError(CANONICAL_TOO_LARGE, 'pdf-limit-exceeded', {
      phase: 'export',
      limit,
      observed: bytes.byteLength,
    });
  }
  return bytes;
}

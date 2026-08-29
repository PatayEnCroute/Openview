import { createHash } from 'node:crypto';
import type {
  AddressResolver,
  PinnedRequest,
  RemoteResponse,
  RemoteTransport,
  ResolvedAddress,
} from '../fetch.js';

/** A valid four-by-two navy png, small enough to write down and real enough to decode. */
export const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGOQtsqHIwZkDgBNGgYhi5XcagAAAABJRU5ErkJggg==';

export const TINY_PNG_BYTES = new Uint8Array(Buffer.from(TINY_PNG_BASE64, 'base64'));

export const TINY_PNG_SOURCE = `data:image/png;base64,${TINY_PNG_BASE64}`;

/** A png header announcing whatever surface a test wants, without carrying one. */
export function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** A jpeg reduced to the one segment that carries its dimensions. */
export function jpegHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(13);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(7, height);
  view.setUint16(9, width);
  bytes[11] = 3;
  return bytes;
}

/** A lossy webp container reduced to its `VP8 ` frame header. */
export function webpHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  const ascii = (text: string, at: number): void => {
    for (const [index, character] of [...text].entries()) {
      bytes[at + index] = character.charCodeAt(0);
    }
  };
  ascii('RIFF', 0);
  ascii('WEBP', 8);
  ascii('VP8 ', 12);
  const view = new DataView(bytes.buffer);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
}

/** A lossless webp container, whose dimensions are packed into one little-endian word. */
export function webpLosslessHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  const ascii = (text: string, at: number): void => {
    for (const [index, character] of [...text].entries()) {
      bytes[at + index] = character.charCodeAt(0);
    }
  };
  ascii('RIFF', 0);
  ascii('WEBP', 8);
  ascii('VP8L', 12);
  /* The signature byte a real lossless frame opens on, so this fixture is one. */
  bytes[20] = 0x2f;
  const packed = (width - 1) | ((height - 1) << 14);
  new DataView(bytes.buffer).setUint32(21, packed >>> 0, true);
  return bytes;
}

/** An extended webp container, whose dimensions are two little-endian triplets. */
export function webpExtendedHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  const ascii = (text: string, at: number): void => {
    for (const [index, character] of [...text].entries()) {
      bytes[at + index] = character.charCodeAt(0);
    }
  };
  ascii('RIFF', 0);
  ascii('WEBP', 8);
  ascii('VP8X', 12);
  const write24 = (value: number, at: number): void => {
    bytes[at] = value & 0xff;
    bytes[at + 1] = (value >> 8) & 0xff;
    bytes[at + 2] = (value >> 16) & 0xff;
  };
  write24(width - 1, 24);
  write24(height - 1, 27);
  return bytes;
}

/** The digest a manifest entry has to declare for these bytes. */
export const digestOf = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/** One canned answer a fake host gives for one request. */
export interface CannedResponse {
  readonly status: number;
  readonly location?: string | undefined;
  readonly contentLength?: number | undefined;
  readonly chunks: readonly Uint8Array[];
  /** Whether the body never ends, to prove a ceiling cancels rather than drains. */
  readonly endless?: boolean | undefined;
  /** Whether each chunk waits a turn of the event loop, the way a socket does. */
  readonly slow?: boolean | undefined;
}

/** A transport that answers from a table and records every address it was pointed at. */
export function fakeTransport(answers: ReadonlyMap<string, CannedResponse>): {
  readonly transport: RemoteTransport;
  readonly requested: PinnedRequest[];
} {
  const requested: PinnedRequest[] = [];
  return {
    requested,
    transport: {
      request(pinned: PinnedRequest, signal: AbortSignal): Promise<RemoteResponse> {
        requested.push(pinned);
        const answer = answers.get(pinned.url);
        if (answer === undefined) {
          return Promise.reject(new Error(`no canned answer for ${pinned.url}`));
        }
        return Promise.resolve({
          status: answer.status,
          location: answer.location,
          contentLength: answer.contentLength,
          body: bodyOf(answer, signal),
        });
      },
    },
  };
}

async function* bodyOf(answer: CannedResponse, signal: AbortSignal): AsyncGenerator<Uint8Array> {
  /* A body that only ever resolves microtasks starves the timers a deadline is made of, which no
     real socket does: `slow` restores the turn of the event loop a read really costs. */
  const turn = async (): Promise<void> => {
    if (answer.slow === true) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
      });
    }
    if (signal.aborted) {
      /* A destroyed socket makes the read throw, and the reader is expected to name what really
         stopped it rather than to see a short body. */
      throw new Error('the stream was destroyed');
    }
  };
  for (const chunk of answer.chunks) {
    await turn();
    yield chunk;
  }
  while (answer.endless === true) {
    await turn();
    yield new Uint8Array(1024);
  }
}

/** A resolver that answers from a table, so no test ever depends on a name server. */
export function fakeResolver(
  answers: ReadonlyMap<string, readonly ResolvedAddress[]>,
): AddressResolver {
  return {
    resolve(hostname: string): Promise<readonly ResolvedAddress[]> {
      const found = answers.get(hostname);
      if (found === undefined) {
        return Promise.reject(new Error(`no canned answer for ${hostname}`));
      }
      return Promise.resolve(found);
    },
  };
}

/** The public address every accepted fixture host resolves to. */
export const PUBLIC_V4: ResolvedAddress = { address: '93.184.216.34', family: 4 };

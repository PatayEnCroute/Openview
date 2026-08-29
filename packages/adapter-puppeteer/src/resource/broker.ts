import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type DocumentImage,
  DocumentRenderError,
  type ResolvedDocumentImage,
} from '@openview/engine';
import { embeddedSourceOf, readEmbeddedImage } from './embedded.js';
import { loadRemoteImage, type RemoteLoadPorts } from './fetch.js';
import { inspectImage } from './image.js';
import type {
  ProtectedImageAsset,
  ProtectedImageManifest,
  ProtectedResourceLimits,
} from './types.js';

const NOT_AUTHORISED =
  'This document reaches an image source the runtime does not authorise. Only a source named exactly in the manifest, or a self-contained `data:` bitmap, may be loaded. Read `details.nodeId` for the declaration involved.';

const TOO_MANY_IMAGES =
  'This document reaches more distinct image sources than one render may load. Read `details.limit` for the ceiling.';

const TOTAL_BYTES =
  'The images of this document weigh more than one render may load in total. Read `details.limit` for the ceiling in bytes.';

const TOTAL_PIXELS =
  'The images of this document cover more pixels than one render may decode in total. Read `details.limit` for the ceiling.';

const INTEGRITY =
  'The bytes obtained for an authorised source do not match the digest the manifest declares. Neither the source nor either digest is repeated here, and nothing was handed to the browser.';

/** Resolution of one render's images, under one manifest and one set of ceilings. */
export interface ImageBroker {
  resolve(images: readonly DocumentImage[]): Promise<readonly ResolvedDocumentImage[]>;
}

/** Everything a broker needs beyond its policy. */
export interface ImageBrokerPorts extends RemoteLoadPorts {
  readonly signal: AbortSignal;
}

function refuse(
  message: string,
  detail: { readonly nodeId?: string | undefined; readonly limit?: number | undefined },
  remote: boolean,
): never {
  throw new DocumentRenderError(message, 'resource-policy-refused', {
    phase: 'resource',
    resourceKind: remote ? 'remote-image' : 'embedded-image',
    ...(detail.nodeId === undefined ? {} : { nodeId: detail.nodeId }),
    ...(detail.limit === undefined ? {} : { limit: detail.limit }),
  });
}

/** Compares two digests without letting the comparison time say how far they agreed. */
function sameDigest(expected: string, bytes: Uint8Array): boolean {
  const actual = createHash('sha256').update(bytes).digest();
  const declared = Buffer.from(expected, 'hex');
  return declared.length === actual.length && timingSafeEqual(declared, actual);
}

/**
 * Creates the resolution of one render.
 *
 * The state is per render on purpose: cumulative bytes and pixels have to be forgotten between two
 * documents, and a byte cached across renders would be shared state between two callers. Inside one
 * render it is remembered across calls, because the same occurrences are asked about more than
 * once and a source loaded twice would be fetched twice and charged twice.
 */
export function createImageBroker(
  manifest: ProtectedImageManifest,
  limits: ProtectedResourceLimits,
  ports: ImageBrokerPorts,
): ImageBroker {
  const authorised = new Map<string, ProtectedImageAsset>(
    manifest.map((asset) => [asset.source, asset]),
  );
  /**
   * What each source of this render resolved to.
   *
   * Held for the whole render, not for one call: the browser side resolves the reached occurrences
   * before it opens a context, and the engine then asks about the same ones again. A map rebuilt
   * per call would download every remote source twice and spend every cumulative ceiling twice.
   */
  const bySource = new Map<string, string>();
  let distinct = 0;
  let totalBytes = 0;
  let totalPixels = 0;

  const account = (bytes: number, pixels: number, nodeId: string, remote: boolean): void => {
    totalBytes += bytes;
    if (totalBytes > limits.maxTotalImageBytes) {
      refuse(TOTAL_BYTES, { nodeId, limit: limits.maxTotalImageBytes }, remote);
    }
    totalPixels += pixels;
    if (totalPixels > limits.maxTotalImagePixels) {
      refuse(TOTAL_PIXELS, { nodeId, limit: limits.maxTotalImagePixels }, remote);
    }
  };

  const bytesOf = async (asset: ProtectedImageAsset): Promise<Uint8Array> => {
    if (asset.kind === 'bytes') {
      return asset.bytes;
    }
    return await loadRemoteImage(asset.source, limits, ports, ports.signal);
  };

  return {
    async resolve(images: readonly DocumentImage[]): Promise<readonly ResolvedDocumentImage[]> {
      /* One source reached by several occurrences is loaded once and counted once, and every
         occurrence of it still gets its own entry in the answer. */
      const resolved: ResolvedDocumentImage[] = [];
      for (const image of images) {
        const known = bySource.get(image.src);
        if (known !== undefined) {
          resolved.push({ key: image.key, src: known });
          continue;
        }
        distinct += 1;
        if (distinct > limits.maxDistinctImages) {
          refuse(TOO_MANY_IMAGES, { nodeId: image.nodeId, limit: limits.maxDistinctImages }, false);
        }
        const embedded = readEmbeddedImage(image.src, limits);
        if (embedded !== undefined) {
          const inspected = inspectImage(embedded.mediaType, embedded.bytes, limits);
          account(inspected.bytes.byteLength, inspected.pixels, image.nodeId, false);
          bySource.set(image.src, image.src);
          resolved.push({ key: image.key, src: image.src });
          continue;
        }
        const asset = authorised.get(image.src);
        if (asset === undefined) {
          refuse(NOT_AUTHORISED, { nodeId: image.nodeId }, false);
        }
        const bytes = await bytesOf(asset);
        if (!sameDigest(asset.sha256, bytes)) {
          throw new DocumentRenderError(INTEGRITY, 'resource-integrity-failed', {
            phase: 'resource',
            resourceKind: asset.kind === 'https' ? 'remote-image' : 'embedded-image',
            nodeId: image.nodeId,
          });
        }
        const inspected = inspectImage(asset.mediaType, bytes, limits);
        account(inspected.bytes.byteLength, inspected.pixels, image.nodeId, asset.kind === 'https');
        /* Turned into inline bytes here, before anything is measured: the browser is never given a
           url, authorised or not, so the network policy is enforced by Node and not by Chromium. */
        const src = embeddedSourceOf(inspected.mediaType, inspected.bytes);
        bySource.set(image.src, src);
        resolved.push({ key: image.key, src });
      }
      return resolved;
    },
  };
}

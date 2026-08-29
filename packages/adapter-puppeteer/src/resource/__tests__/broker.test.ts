import { type DocumentImage, DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { createImageBroker, type ImageBrokerPorts } from '../broker.js';
import { embeddedSourceOf } from '../embedded.js';
import type {
  ProtectedImageAsset,
  ProtectedImageManifest,
  ProtectedResourceLimits,
} from '../types.js';
import { DEFAULT_RESOURCE_LIMITS } from '../types.js';
import {
  type CannedResponse,
  digestOf,
  fakeResolver,
  fakeTransport,
  PUBLIC_V4,
  pngHeader,
  TINY_PNG_BYTES,
  TINY_PNG_SOURCE,
} from './fixtures.js';

const REMOTE = 'https://assets.example.com/logo.png';

const limits = (overrides: Partial<ProtectedResourceLimits> = {}): ProtectedResourceLimits => ({
  ...DEFAULT_RESOURCE_LIMITS,
  ...overrides,
});

const occurrence = (key: string, src: string): DocumentImage => ({
  key,
  nodeId: `n-${key}`,
  path: ['root', 'children', 0],
  src,
});

function ports(
  manifest: ProtectedImageManifest,
  answers: ReadonlyMap<string, CannedResponse> = new Map(),
): { readonly ports: ImageBrokerPorts; readonly requested: { readonly url: string }[] } {
  const { transport, requested } = fakeTransport(answers);
  return {
    requested,
    ports: {
      transport,
      resolver: fakeResolver(new Map([['assets.example.com', [PUBLIC_V4]]])),
      authorises: (url) => manifest.some((asset) => asset.source === url),
      signal: new AbortController().signal,
    },
  };
}

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

describe('an inline source', () => {
  it('is printed as it stands, once its bytes have been checked', async () => {
    const broker = createImageBroker([], limits(), ports([]).ports);
    await expect(broker.resolve([occurrence('o1', TINY_PNG_SOURCE)])).resolves.toStrictEqual([
      { key: 'o1', src: TINY_PNG_SOURCE },
    ]);
  });

  it('is refused when its header announces a surface no render may decode', async () => {
    const bomb = embeddedSourceOf('image/png', pngHeader(200_000, 200_000));
    const broker = createImageBroker([], limits(), ports([]).ports);
    const refused = await refusalOf(broker.resolve([occurrence('o1', bomb)]));
    expect(refused.code).toBe('resource-policy-refused');
    expect(refused.details.limit).toBe(DEFAULT_RESOURCE_LIMITS.maxImagePixels);
  });

  it('is refused when it is not a source this runtime authorises at all', async () => {
    const broker = createImageBroker([], limits(), ports([]).ports);
    const refused = await refusalOf(broker.resolve([occurrence('o1', 'asset:logo')]));
    expect(refused.code).toBe('resource-policy-refused');
    expect(refused.details.nodeId).toBe('n-o1');
    expect(refused.message).not.toContain('asset:logo');
  });
});

describe('a source the manifest names by its bytes', () => {
  const bytesEntry = (overrides: Partial<ProtectedImageAsset> = {}): ProtectedImageManifest => [
    {
      kind: 'bytes',
      source: 'asset:logo',
      mediaType: 'image/png',
      bytes: TINY_PNG_BYTES,
      sha256: digestOf(TINY_PNG_BYTES),
      ...overrides,
    },
  ];
  const manifest = bytesEntry();

  it('is embedded before anything can be painted', async () => {
    const broker = createImageBroker(manifest, limits(), ports(manifest).ports);
    const [resolved] = await broker.resolve([occurrence('o1', 'asset:logo')]);
    expect(resolved?.src).toBe(TINY_PNG_SOURCE);
  });

  it('is refused when its digest does not match its bytes', async () => {
    const wrong = bytesEntry({ sha256: '0'.repeat(64) });
    const broker = createImageBroker(wrong, limits(), ports(wrong).ports);
    const refused = await refusalOf(broker.resolve([occurrence('o1', 'asset:logo')]));
    expect(refused.code).toBe('resource-integrity-failed');
    expect(refused.message).not.toContain('asset:logo');
    expect(refused.message).not.toContain('0000');
  });

  it('is refused when its declared media type contradicts its bytes', async () => {
    const lying = bytesEntry({ mediaType: 'image/jpeg' });
    const broker = createImageBroker(lying, limits(), ports(lying).ports);
    expect((await refusalOf(broker.resolve([occurrence('o1', 'asset:logo')]))).code).toBe(
      'resource-policy-refused',
    );
  });

  it('is loaded once for every occurrence that reaches it', async () => {
    const broker = createImageBroker(
      manifest,
      limits({ maxDistinctImages: 1 }),
      ports(manifest).ports,
    );
    const resolved = await broker.resolve([
      occurrence('o1', 'asset:logo'),
      occurrence('o2', 'asset:logo'),
    ]);
    expect(resolved.map((one) => one.key)).toStrictEqual(['o1', 'o2']);
    expect(new Set(resolved.map((one) => one.src)).size).toBe(1);
  });

  it('leaves an entry no occurrence reaches entirely alone', async () => {
    const { ports: unused, requested } = ports(manifest);
    const broker = createImageBroker(manifest, limits(), unused);
    await expect(broker.resolve([])).resolves.toStrictEqual([]);
    expect(requested).toHaveLength(0);
  });
});

describe('a source the manifest names as https', () => {
  const manifest: ProtectedImageManifest = [
    {
      kind: 'https',
      source: REMOTE,
      mediaType: 'image/png',
      sha256: digestOf(TINY_PNG_BYTES),
    },
  ];

  it('produces the same document its bytes would have', async () => {
    const answers = new Map([[REMOTE, { status: 200, chunks: [TINY_PNG_BYTES] }]]);
    const broker = createImageBroker(manifest, limits(), ports(manifest, answers).ports);
    const [resolved] = await broker.resolve([occurrence('o1', REMOTE)]);
    expect(resolved?.src).toBe(TINY_PNG_SOURCE);
  });

  it('is refused when the host substitutes the asset behind the url', async () => {
    const substituted = new Uint8Array([...TINY_PNG_BYTES]);
    substituted[substituted.length - 1] = 0;
    const answers = new Map([[REMOTE, { status: 200, chunks: [substituted] }]]);
    const broker = createImageBroker(manifest, limits(), ports(manifest, answers).ports);
    expect((await refusalOf(broker.resolve([occurrence('o1', REMOTE)]))).code).toBe(
      'resource-integrity-failed',
    );
  });

  it('refuses a url the manifest does not name, whatever digest it would have', async () => {
    /* A digest authorises nothing on its own: the name is half the authorisation. */
    const answers = new Map([
      ['https://assets.example.com/other.png', { status: 200, chunks: [] }],
    ]);
    const broker = createImageBroker(manifest, limits(), ports(manifest, answers).ports);
    expect(
      (await refusalOf(broker.resolve([occurrence('o1', 'https://assets.example.com/other.png')])))
        .code,
    ).toBe('resource-policy-refused');
  });
});

describe('what every image of one render costs together', () => {
  const manifest: ProtectedImageManifest = [];

  it('refuses more distinct sources than one render may load', async () => {
    const broker = createImageBroker(manifest, limits({ maxDistinctImages: 1 }), ports([]).ports);
    const second = embeddedSourceOf('image/png', pngHeader(2, 2));
    const refused = await refusalOf(
      broker.resolve([occurrence('o1', TINY_PNG_SOURCE), occurrence('o2', second)]),
    );
    expect(refused.details.limit).toBe(1);
  });

  it('refuses a total weight past the ceiling, even with each image under it', async () => {
    const broker = createImageBroker(
      manifest,
      limits({ maxTotalImageBytes: TINY_PNG_BYTES.byteLength }),
      ports([]).ports,
    );
    const second = embeddedSourceOf('image/png', pngHeader(2, 2));
    const refused = await refusalOf(
      broker.resolve([occurrence('o1', TINY_PNG_SOURCE), occurrence('o2', second)]),
    );
    expect(refused.details.limit).toBe(TINY_PNG_BYTES.byteLength);
  });

  it('refuses a total surface past the ceiling, even with each image under it', async () => {
    const broker = createImageBroker(manifest, limits({ maxTotalImagePixels: 8 }), ports([]).ports);
    const second = embeddedSourceOf('image/png', pngHeader(4, 2));
    const refused = await refusalOf(
      broker.resolve([occurrence('o1', TINY_PNG_SOURCE), occurrence('o2', second)]),
    );
    expect(refused.details.limit).toBe(8);
  });

  it('forgets its totals between two renders, because each has its own broker', async () => {
    const build = (): ReturnType<typeof createImageBroker> =>
      createImageBroker(manifest, limits({ maxTotalImagePixels: 8 }), ports([]).ports);
    await expect(build().resolve([occurrence('o1', TINY_PNG_SOURCE)])).resolves.toHaveLength(1);
    await expect(build().resolve([occurrence('o1', TINY_PNG_SOURCE)])).resolves.toHaveLength(1);
  });
});

describe('the same occurrences asked about twice', () => {
  it('loads nothing a second time, and charges nothing a second time', async () => {
    /* The browser side resolves the reached occurrences before it opens a context, and the engine
       then asks about the same ones again: a broker that forgot between the two calls would fetch
       every remote source twice and halve every cumulative ceiling it publishes. */
    const manifest: ProtectedImageManifest = [
      { kind: 'https', source: REMOTE, mediaType: 'image/png', sha256: digestOf(TINY_PNG_BYTES) },
    ];
    const answers = new Map([[REMOTE, { status: 200, chunks: [TINY_PNG_BYTES] }]]);
    const wired = ports(manifest, answers);
    const broker = createImageBroker(
      manifest,
      limits({ maxDistinctImages: 1, maxTotalImagePixels: 8 }),
      wired.ports,
    );
    const asked = [occurrence('o1', REMOTE)];
    const first = await broker.resolve(asked);
    const second = await broker.resolve(asked);
    expect(second).toStrictEqual(first);
    expect(wired.requested).toHaveLength(1);
  });

  it('counts an inline source once, however many times it is asked about', async () => {
    const broker = createImageBroker([], limits({ maxDistinctImages: 1 }), ports([]).ports);
    const asked = [occurrence('o1', TINY_PNG_SOURCE)];
    await broker.resolve(asked);
    await expect(broker.resolve(asked)).resolves.toStrictEqual([
      { key: 'o1', src: TINY_PNG_SOURCE },
    ]);
  });
});

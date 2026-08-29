import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { loadRemoteImage, type RemoteLoadPorts, type ResolvedAddress } from '../fetch.js';
import { DEFAULT_RESOURCE_LIMITS, type ProtectedResourceLimits } from '../types.js';
import { type CannedResponse, fakeResolver, fakeTransport, PUBLIC_V4 } from './fixtures.js';

const SOURCE = 'https://assets.example.com/logo.png';
const OTHER = 'https://mirror.example.com/logo.png';

const limits = (overrides: Partial<ProtectedResourceLimits> = {}): ProtectedResourceLimits => ({
  ...DEFAULT_RESOURCE_LIMITS,
  ...overrides,
});

const ok = (chunks: readonly Uint8Array[]): CannedResponse => ({ status: 200, chunks });

interface Harness {
  readonly ports: RemoteLoadPorts;
  readonly requested: { readonly address: string; readonly url: string }[];
}

function harness(
  answers: ReadonlyMap<string, CannedResponse>,
  names: ReadonlyMap<string, readonly ResolvedAddress[]>,
  authorised: readonly string[] = [SOURCE],
): Harness {
  const { transport, requested } = fakeTransport(answers);
  return {
    requested,
    ports: {
      transport,
      resolver: fakeResolver(names),
      authorises: (url) => authorised.includes(url),
    },
  };
}

const NAMES = new Map([
  ['assets.example.com', [PUBLIC_V4]],
  ['mirror.example.com', [PUBLIC_V4]],
]);

const signal = (): AbortSignal => new AbortController().signal;

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

describe('loading an authorised remote source', () => {
  it('returns the bytes the host answered', async () => {
    const { ports } = harness(new Map([[SOURCE, ok([new Uint8Array([1, 2, 3])])]]), NAMES);
    await expect(loadRemoteImage(SOURCE, limits(), ports, signal())).resolves.toStrictEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it('joins the chunks in the order they arrived', async () => {
    const { ports } = harness(
      new Map([[SOURCE, ok([new Uint8Array([1]), new Uint8Array([2, 3])])]]),
      NAMES,
    );
    await expect(loadRemoteImage(SOURCE, limits(), ports, signal())).resolves.toStrictEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it('opens the socket on the address the policy examined, not on the name again', async () => {
    const { ports, requested } = harness(new Map([[SOURCE, ok([new Uint8Array([1])])]]), NAMES);
    await loadRemoteImage(SOURCE, limits(), ports, signal());
    expect(requested[0]?.address).toBe(PUBLIC_V4.address);
    expect(requested[0]?.url).toBe(SOURCE);
  });
});

describe('what a document may never make this process open', () => {
  it('refuses a source the manifest does not authorise, without resolving it', async () => {
    const { ports, requested } = harness(new Map(), NAMES, []);
    expect((await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()))).code).toBe(
      'resource-policy-refused',
    );
    expect(requested).toHaveLength(0);
  });

  it('refuses http, file and a source with credentials before any socket', async () => {
    for (const source of [
      'http://assets.example.com/logo.png',
      'file:///etc/passwd',
      'https://user:pass@assets.example.com/logo.png',
    ]) {
      const { ports, requested } = harness(new Map(), NAMES, [source]);
      const refused = await refusalOf(loadRemoteImage(source, limits(), ports, signal()));
      expect(refused.details.resourceKind).toBe('remote-image');
      expect(requested).toHaveLength(0);
    }
  });

  it('refuses a name that answers a private address, and opens nothing', async () => {
    for (const address of ['127.0.0.1', '169.254.169.254', '10.1.2.3', '::1']) {
      const family = address.includes(':') ? (6 as const) : (4 as const);
      const { ports, requested } = harness(
        new Map([[SOURCE, ok([new Uint8Array([1])])]]),
        new Map([['assets.example.com', [{ address, family }]]]),
      );
      await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()));
      expect(requested).toHaveLength(0);
    }
  });

  it('refuses a name that answers one public and one private address', async () => {
    /* The shape a rebinding attack takes: picking the acceptable answer is what makes it work. */
    const { ports, requested } = harness(
      new Map([[SOURCE, ok([new Uint8Array([1])])]]),
      new Map([['assets.example.com', [PUBLIC_V4, { address: '127.0.0.1', family: 4 }]]]),
    );
    await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()));
    expect(requested).toHaveLength(0);
  });

  it('refuses a name that resolves to nothing, or whose resolution fails', async () => {
    const empty = harness(new Map(), new Map([['assets.example.com', []]]));
    await refusalOf(loadRemoteImage(SOURCE, limits(), empty.ports, signal()));
    const broken = harness(new Map(), new Map());
    await refusalOf(loadRemoteImage(SOURCE, limits(), broken.ports, signal()));
  });
});

describe('a redirect', () => {
  it('is followed only to a target the manifest also authorises', async () => {
    const { ports, requested } = harness(
      new Map([
        [SOURCE, { status: 302, location: OTHER, chunks: [] }],
        [OTHER, ok([new Uint8Array([7])])],
      ]),
      NAMES,
      [SOURCE, OTHER],
    );
    await expect(loadRemoteImage(SOURCE, limits(), ports, signal())).resolves.toStrictEqual(
      new Uint8Array([7]),
    );
    expect(requested.map((one) => one.url)).toStrictEqual([SOURCE, OTHER]);
  });

  it('is refused when its target is not authorised, even from an authorised source', async () => {
    const { ports, requested } = harness(
      new Map([
        [SOURCE, { status: 302, location: OTHER, chunks: [] }],
        [OTHER, ok([new Uint8Array([7])])],
      ]),
      NAMES,
      [SOURCE],
    );
    await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()));
    expect(requested.map((one) => one.url)).toStrictEqual([SOURCE]);
  });

  it('is refused when its target resolves to a private address', async () => {
    /* Validating only the first url leaves the one that actually answers unexamined. */
    const { ports, requested } = harness(
      new Map([
        [SOURCE, { status: 302, location: OTHER, chunks: [] }],
        [OTHER, ok([new Uint8Array([7])])],
      ]),
      new Map([
        ['assets.example.com', [PUBLIC_V4]],
        ['mirror.example.com', [{ address: '192.168.0.9', family: 4 as const }]],
      ]),
      [SOURCE, OTHER],
    );
    await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()));
    expect(requested.map((one) => one.url)).toStrictEqual([SOURCE]);
  });

  it('stops after the hops one render may follow', async () => {
    const { ports, requested } = harness(
      new Map([
        [SOURCE, { status: 301, location: OTHER, chunks: [] }],
        [OTHER, { status: 301, location: SOURCE, chunks: [] }],
      ]),
      NAMES,
      [SOURCE, OTHER],
    );
    const refused = await refusalOf(
      loadRemoteImage(SOURCE, limits({ maxRedirects: 2 }), ports, signal()),
    );
    expect(refused.details.limit).toBe(2);
    expect(requested).toHaveLength(3);
  });

  it('is refused when the host answers a status that is neither success nor redirect', async () => {
    const { ports } = harness(new Map([[SOURCE, { status: 500, chunks: [] }]]), NAMES);
    expect((await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()))).code).toBe(
      'resource-policy-refused',
    );
  });

  it('is refused when it announces no target at all', async () => {
    const { ports } = harness(new Map([[SOURCE, { status: 302, chunks: [] }]]), NAMES);
    await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()));
  });
});

describe('the size of what a host sends', () => {
  it('is refused on the announced length, before a byte is read', async () => {
    const { ports } = harness(
      new Map([[SOURCE, { status: 200, contentLength: 5_000, chunks: [] }]]),
      NAMES,
    );
    const refused = await refusalOf(
      loadRemoteImage(SOURCE, limits({ maxImageBytes: 100 }), ports, signal()),
    );
    expect(refused.details.limit).toBe(100);
  });

  it('is refused on the chunks even when the announced length was a lie', async () => {
    /* A host that under-reports its length gains nothing: the count is on what arrives. */
    const { ports } = harness(
      new Map([[SOURCE, { status: 200, contentLength: 1, chunks: [new Uint8Array(4_096)] }]]),
      NAMES,
    );
    expect(
      (await refusalOf(loadRemoteImage(SOURCE, limits({ maxImageBytes: 100 }), ports, signal())))
        .code,
    ).toBe('resource-policy-refused');
  });

  it('cancels a body that never ends rather than reading it to a conclusion', async () => {
    const { ports } = harness(
      new Map([[SOURCE, { status: 200, chunks: [new Uint8Array(64)], endless: true }]]),
      NAMES,
    );
    await refusalOf(loadRemoteImage(SOURCE, limits({ maxImageBytes: 4_096 }), ports, signal()));
  });

  it('accepts a body of exactly the ceiling', async () => {
    const { ports } = harness(new Map([[SOURCE, ok([new Uint8Array(100)])]]), NAMES);
    await expect(
      loadRemoteImage(SOURCE, limits({ maxImageBytes: 100 }), ports, signal()),
    ).resolves.toHaveLength(100);
  });
});

describe('the time one remote source may take', () => {
  it('refuses a host that answers one byte at a time past the deadline', async () => {
    /* Under the size ceiling for ever: only a deadline of its own stops this transfer, and the
       render's own deadline would let it spend the whole budget first. */
    const { ports } = harness(
      new Map([[SOURCE, { status: 200, chunks: [new Uint8Array(1)], endless: true, slow: true }]]),
      NAMES,
    );
    const refused = await refusalOf(
      loadRemoteImage(SOURCE, limits({ resourceTimeoutMs: 20 }), ports, signal()),
    );
    expect(refused.details.limit).toBe(20);
  });

  it('opens nothing at all for a render that is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const { ports } = harness(new Map([[SOURCE, ok([new Uint8Array([1])])]]), NAMES);
    /* A listener added to a signal that has already fired never runs: the state has to be read. */
    const refused = await refusalOf(loadRemoteImage(SOURCE, limits(), ports, controller.signal));
    expect(refused.code).toBe('resource-policy-refused');
  });

  it('names a transport failure as a load failure, not as a policy refusal', async () => {
    const failing = {
      transport: {
        request: (): Promise<never> => Promise.reject(new Error('the host at 1.2.3.4 hung up')),
      },
      resolver: fakeResolver(NAMES),
      authorises: (url: string): boolean => url === SOURCE,
    };
    const refused = await refusalOf(loadRemoteImage(SOURCE, limits(), failing, signal()));
    expect(refused.code).toBe('resource-load-failed');
    /* The message of the transport is written by whatever was dialled. */
    expect(refused.message).not.toContain('1.2.3.4');
  });
});

describe('a host that stops answering mid-body', () => {
  it('is named a refused resource, not an unreadable failure of the runtime', async () => {
    /* The shape of a slow loris: the transfer never crosses the size ceiling, and the deadline
       destroys the socket. What the reader then sees must still be classified. */
    const { ports } = harness(
      new Map([[SOURCE, { status: 200, chunks: [new Uint8Array(4)], endless: true, slow: true }]]),
      NAMES,
    );
    const refused = await refusalOf(
      loadRemoteImage(SOURCE, limits({ resourceTimeoutMs: 15 }), ports, signal()),
    );
    expect(refused.code).toBe('resource-policy-refused');
    expect(refused.details.limit).toBe(15);
  });

  it('is named a cancellation when it was the render that stopped', async () => {
    const controller = new AbortController();
    const { ports } = harness(
      new Map([[SOURCE, { status: 200, chunks: [new Uint8Array(4)], endless: true, slow: true }]]),
      NAMES,
    );
    const running = refusalOf(
      loadRemoteImage(SOURCE, limits({ resourceTimeoutMs: 60_000 }), ports, controller.signal),
    );
    controller.abort();
    const refused = await running;
    expect(refused.code).toBe('resource-policy-refused');
    /* A cancellation is not a deadline: no limit is named, because none was crossed. */
    expect(refused.details.limit).toBeUndefined();
  });

  it('refuses a redirect target that is not even a url', async () => {
    const { ports } = harness(
      new Map([[SOURCE, { status: 302, location: 'https://[', chunks: [] }]]),
      NAMES,
    );
    expect((await refusalOf(loadRemoteImage(SOURCE, limits(), ports, signal()))).code).toBe(
      'resource-policy-refused',
    );
  });
});

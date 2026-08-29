import { Resolver } from 'node:dns/promises';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import type {
  AddressResolver,
  PinnedRequest,
  RemoteResponse,
  RemoteTransport,
  ResolvedAddress,
} from './fetch.js';

/** The only headers a rendered document's resource request ever carries. */
const HEADERS: Readonly<Record<string, string>> = {
  /* No compression: a compressed body would let a small transfer expand past the byte ceiling
     after it has already been accepted. */
  'accept-encoding': 'identity',
  accept: 'image/png,image/jpeg,image/webp',
};

/**
 * Request options bound to one already-validated address.
 *
 * The `lookup` hook is the whole point: without it `https.request` resolves the name a second time,
 * and the address the policy examined is not necessarily the address the socket opens. Sni,
 * certificate and `Host` keep the original hostname, so pinning changes who is dialled and not who
 * is authenticated.
 */
export interface PinnedRequestOptions extends RequestOptions {
  readonly servername: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly agent: false;
  readonly lookup: NonNullable<RequestOptions['lookup']>;
}

export function pinnedRequestOptions(pinned: PinnedRequest): PinnedRequestOptions {
  return {
    servername: pinned.hostname,
    headers: { ...HEADERS, host: pinned.hostname },
    /* A fresh socket per request: a pooled connection would carry state between two renders. */
    agent: false,
    lookup: (_hostname, options, callback): void => {
      /* Node asks for every address at once whenever it selects a family itself, and then expects
         a list back. Answering the single-address form there fails the connection outright, which
         would make an authorised source unloadable rather than merely unpinned. */
      if (options.all === true) {
        callback(null, [{ address: pinned.address, family: pinned.family }]);
        return;
      }
      callback(null, pinned.address, pinned.family);
    },
  };
}

const headerValue = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.[0];

/** The two headers this policy reads, plus the status, from what a host actually answered. */
export function readAnswer(answer: {
  readonly statusCode?: number | undefined;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: AsyncIterable<Uint8Array>;
}): RemoteResponse {
  const length = headerValue(answer.headers['content-length']);
  const parsed = length === undefined ? Number.NaN : Number.parseInt(length, 10);
  return {
    status: answer.statusCode ?? 0,
    location: headerValue(answer.headers.location),
    /* A length that is absent, empty or not a number is simply no claim at all: the chunks are
       counted either way. */
    contentLength: Number.isFinite(parsed) ? parsed : undefined,
    body: answer.body,
  };
}

/** The https client this backend uses when the caller does not supply its own. */
export function createNodeTransport(): RemoteTransport {
  return {
    request(pinned: PinnedRequest, signal: AbortSignal): Promise<RemoteResponse> {
      return new Promise<RemoteResponse>((resolve, reject) => {
        const call = httpsRequest(
          pinned.url,
          { ...pinnedRequestOptions(pinned), signal },
          (response) => {
            resolve(
              readAnswer({
                statusCode: response.statusCode,
                headers: response.headers,
                body: response,
              }),
            );
          },
        );
        call.on('error', reject);
        call.end();
      });
    },
  };
}

/**
 * The part of a dns resolver this policy uses, which Node's `Resolver` satisfies.
 *
 * Named so a test can answer without a name server: a suite whose result depends on the machine's
 * resolver is a suite that goes red on a train.
 */
export interface NameLookup {
  resolve4(hostname: string): Promise<readonly string[]>;
  resolve6(hostname: string): Promise<readonly string[]>;
  cancel(): void;
}

/**
 * Name resolution over the system resolver, cancelled with the render.
 *
 * A `Resolver` instance rather than the module functions: it is the only shape that can be
 * cancelled, and a lookup left running would outlive the render that asked for it.
 */
export function createNodeResolver(open: () => NameLookup = () => new Resolver()): AddressResolver {
  return {
    async resolve(hostname: string, signal: AbortSignal): Promise<readonly ResolvedAddress[]> {
      /* Read before anything is dialled: a listener added to a signal that has already fired never
         runs, and both queries would then outlive the render that wanted them. */
      signal.throwIfAborted();
      const resolver = open();
      const stop = (): void => {
        resolver.cancel();
      };
      signal.addEventListener('abort', stop, { once: true });
      try {
        const [v4, v6] = await Promise.allSettled([
          resolver.resolve4(hostname),
          resolver.resolve6(hostname),
        ]);
        return [...familyOf(v4, 4), ...familyOf(v6, 6)];
      } finally {
        signal.removeEventListener('abort', stop);
      }
    },
  };
}

/** The resolver codes that mean "this name holds no address of that family", and nothing worse. */
const NO_RECORD_OF_THAT_FAMILY: ReadonlySet<string> = new Set(['ENODATA', 'ENOTFOUND']);

function isMissingRecord(reason: unknown): boolean {
  return (
    typeof reason === 'object' &&
    reason !== null &&
    'code' in reason &&
    typeof reason.code === 'string' &&
    NO_RECORD_OF_THAT_FAMILY.has(reason.code)
  );
}

/**
 * The addresses of one family, or none when the name simply holds none.
 *
 * Any other failure is re-thrown rather than read as an empty answer: a resolution an attacker can
 * make fail would leave the surviving family deciding alone, and the policy refuses a name only
 * once it has seen every address that name really has.
 */
function familyOf(
  settled: PromiseSettledResult<readonly string[]>,
  family: 4 | 6,
): readonly ResolvedAddress[] {
  if (settled.status === 'fulfilled') {
    return settled.value.map((address) => ({ address, family }));
  }
  if (isMissingRecord(settled.reason)) {
    return [];
  }
  throw settled.reason instanceof Error ? settled.reason : new Error(String(settled.reason));
}

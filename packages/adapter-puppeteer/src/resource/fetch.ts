import { DocumentRenderError } from '@openview/engine';
import { classifyAddress, normalizeHttpsUrl } from './address.js';
import type { ProtectedResourceLimits } from './types.js';

const REFUSED_TARGET =
  'This source is not an https url this backend may open. Read `details.resourceKind`; the url itself is deliberately not repeated, and no connection was attempted.';

const REFUSED_ADDRESS =
  'The name of this source resolves to an address a rendered document may never reach, or to none at all. No socket was opened, so a name that answers a public address once and a private one next time gains nothing.';

const TOO_MANY_HOPS =
  'This source redirects further than one render may follow. Read `details.limit` for the number of hops allowed; each one is revalidated in full.';

const REFUSED_STATUS =
  'The host did not answer this source with a document. A body is read only for a plain success, and a redirect is followed only when it names a target the manifest already authorises.';

const TOO_LARGE =
  'This remote source is larger than one render may load. Read `details.limit` for the ceiling in bytes; the transfer was cancelled rather than buffered.';

const TOO_SLOW =
  'This remote source did not answer within the time one may spend on it. Read `details.limit` for the deadline in milliseconds; the transfer was cancelled rather than left to hold a slot.';

const CANCELLED =
  'This render was cancelled before its remote sources could be obtained, so none of them was dialled.';

const LOAD_FAILED =
  'This remote source could not be obtained. The failure of the transport is deliberately not summarised here: its message is written by the host that was dialled.';

/** One address a name resolved to, kept with the family the socket must open. */
export interface ResolvedAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

/** Name resolution, injected so a test never depends on a resolver it does not own. */
export interface AddressResolver {
  resolve(hostname: string, signal: AbortSignal): Promise<readonly ResolvedAddress[]>;
}

/** One request, already bound to the exact address the policy validated. */
export interface PinnedRequest {
  readonly url: string;
  readonly hostname: string;
  readonly address: string;
  readonly family: 4 | 6;
}

/** What a host answered: a status, the two headers this policy reads, and the body. */
export interface RemoteResponse {
  readonly status: number;
  readonly location: string | undefined;
  readonly contentLength: number | undefined;
  readonly body: AsyncIterable<Uint8Array>;
}

/** The socket layer, injected so the policy is testable without a network. */
export interface RemoteTransport {
  request(pinned: PinnedRequest, signal: AbortSignal): Promise<RemoteResponse>;
}

/** Decides whether a url is one the manifest names, applied again at every redirect. */
export type TargetAuthority = (url: string) => boolean;

function refuse(message: string, limit?: number | undefined): never {
  throw new DocumentRenderError(message, 'resource-policy-refused', {
    phase: 'resource',
    resourceKind: 'remote-image',
    ...(limit === undefined ? {} : { limit }),
  });
}

/**
 * One deadline of its own for one resource, folded together with the render's cancellation.
 *
 * The render's own deadline is not enough: a host that answers slowly would otherwise spend the
 * whole render budget, and a source that is already cancelled must not be dialled at all.
 */
function attempt(
  signal: AbortSignal,
  timeoutMs: number,
): { readonly controller: AbortController; release(): void } {
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  if (signal.aborted) {
    controller.abort();
  } else {
    signal.addEventListener('abort', stop, { once: true });
  }
  const timer = setTimeout(stop, timeoutMs);
  timer.unref();
  return {
    controller,
    release(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
    },
  };
}

/**
 * The address the socket must use, chosen from every address the name gave.
 *
 * A single refused answer refuses the whole name: a resolver that returns one public address and
 * one loopback address is exactly the shape a rebinding attack takes, and picking the acceptable
 * one would make the attack succeed on the next lookup.
 */
async function pinnedAddress(
  hostname: string,
  resolver: AddressResolver,
  signal: AbortSignal,
): Promise<ResolvedAddress> {
  let answers: readonly ResolvedAddress[];
  try {
    answers = await resolver.resolve(hostname, signal);
  } catch {
    /* Re-thrown as the one refusal this policy has, rather than forwarded: a resolver's own
       message quotes the name it failed on, and that name came from the document. */
    refuse(REFUSED_ADDRESS);
  }
  if (answers.length === 0) {
    refuse(REFUSED_ADDRESS);
  }
  for (const answer of answers) {
    if (classifyAddress(answer.address) !== 'public') {
      refuse(REFUSED_ADDRESS);
    }
  }
  const sorted = [...answers].sort(
    (left, right) => left.family - right.family || left.address.localeCompare(right.address),
  );
  const first = sorted[0];
  if (first === undefined) {
    refuse(REFUSED_ADDRESS);
  }
  return first;
}

/**
 * The absolute target a redirect names, or a refusal.
 *
 * The header comes from a host, so it may be anything at all; a url that cannot even be built is a
 * target this policy refuses rather than an exception nobody typed.
 */
function targetOf(location: string, from: URL): string {
  try {
    return new URL(location, from).href;
  } catch {
    refuse(REFUSED_TARGET);
  }
}

/**
 * Names what really stopped one attempt.
 *
 * A body that freezes is destroyed by the deadline rather than refused by it, so the abort has to
 * be read back here: without this, a slow-loris would surface as an untyped failure of the runtime
 * instead of the resource refusal it is.
 */
function failureOf(
  error: unknown,
  controller: AbortController,
  signal: AbortSignal,
  timeoutMs: number,
): Error {
  if (error instanceof DocumentRenderError) {
    return error;
  }
  if (controller.signal.aborted) {
    return signal.aborted
      ? new DocumentRenderError(CANCELLED, 'resource-policy-refused', {
          phase: 'resource',
          resourceKind: 'remote-image',
        })
      : new DocumentRenderError(TOO_SLOW, 'resource-policy-refused', {
          phase: 'resource',
          resourceKind: 'remote-image',
          limit: timeoutMs,
        });
  }
  return new DocumentRenderError(
    LOAD_FAILED,
    'resource-load-failed',
    { phase: 'resource', resourceKind: 'remote-image' },
    { cause: error },
  );
}

/** Reads a body chunk by chunk, refusing the moment it passes the ceiling. */
async function readBounded(
  body: AsyncIterable<Uint8Array>,
  limit: number,
  controller: AbortController,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > limit) {
      /* Cancelled rather than drained: an endless body would otherwise be read to its end just to
         learn it was too large. */
      controller.abort();
      refuse(TOO_LARGE, limit);
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/** Everything the broker injects into one remote load. */
export interface RemoteLoadPorts {
  readonly transport: RemoteTransport;
  readonly resolver: AddressResolver;
  /** Whether a url is one the manifest authorises, applied again at every hop. */
  readonly authorises: TargetAuthority;
}

/**
 * Loads one authorised https source under the full policy, hop by hop.
 *
 * Every redirect repeats the whole check -- manifest, canonical form, name resolution, address
 * class -- because validating only the first url leaves the last one unexamined, and the last one
 * is the one that answers.
 */
export async function loadRemoteImage(
  source: string,
  limits: ProtectedResourceLimits,
  ports: RemoteLoadPorts,
  signal: AbortSignal,
): Promise<Uint8Array> {
  let current = source;
  for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
    if (!ports.authorises(current)) {
      refuse(REFUSED_TARGET);
    }
    const url = normalizeHttpsUrl(current);
    if (url === undefined) {
      refuse(REFUSED_TARGET);
    }
    /* Armed before the name is even resolved: a resolver that never answers would otherwise spend
       the whole render budget outside any deadline of its own. */
    const { controller, release } = attempt(signal, limits.resourceTimeoutMs);
    try {
      if (signal.aborted) {
        refuse(CANCELLED);
      }
      try {
        const pinned = await pinnedAddress(url.hostname, ports.resolver, controller.signal);
        const response = await ports.transport.request(
          {
            url: url.href,
            hostname: url.hostname,
            address: pinned.address,
            family: pinned.family,
          },
          controller.signal,
        );
        if (response.status === 200) {
          if (
            response.contentLength !== undefined &&
            response.contentLength > limits.maxImageBytes
          ) {
            controller.abort();
            refuse(TOO_LARGE, limits.maxImageBytes);
          }
          /* The announced length is a claim: the chunks are counted anyway, so a host that lies low
             still meets the same ceiling. */
          return await readBounded(response.body, limits.maxImageBytes, controller);
        }
        if (response.status >= 301 && response.status <= 308 && response.location !== undefined) {
          controller.abort();
          current = targetOf(response.location, url);
          continue;
        }
        controller.abort();
        refuse(REFUSED_STATUS);
      } catch (error) {
        throw failureOf(error, controller, signal, limits.resourceTimeoutMs);
      }
    } finally {
      release();
    }
  }
  refuse(TOO_MANY_HOPS, limits.maxRedirects);
}

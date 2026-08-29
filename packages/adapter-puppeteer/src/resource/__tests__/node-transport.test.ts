import { describe, expect, it } from 'vitest';
import {
  createNodeResolver,
  createNodeTransport,
  pinnedRequestOptions,
  readAnswer,
} from '../node-transport.js';

const PINNED = {
  url: 'https://assets.example.com/logo.png',
  hostname: 'assets.example.com',
  address: '93.184.216.34',
  family: 4 as const,
};

describe('the request one authorised source is opened with', () => {
  it('dials the address the policy examined, through the lookup hook', () => {
    /* Without the hook, `https.request` resolves the name a second time and the address the policy
       examined is not necessarily the one the socket opens. */
    const options = pinnedRequestOptions(PINNED);
    let answered: readonly unknown[] = [];
    options.lookup('assets.example.com', {}, (...args: readonly unknown[]) => {
      answered = args;
    });
    expect(answered).toStrictEqual([null, '93.184.216.34', 4]);
  });

  it('keeps the original hostname for sni, for the certificate and in the header', () => {
    const options = pinnedRequestOptions(PINNED);
    expect(options.servername).toBe('assets.example.com');
    expect(options.headers.host).toBe('assets.example.com');
  });

  it('asks for no compression, so a small transfer cannot expand past the ceiling', () => {
    expect(pinnedRequestOptions(PINNED).headers['accept-encoding']).toBe('identity');
  });

  it('carries no cookie, no authorization and no header of the document', () => {
    const headers = pinnedRequestOptions(PINNED).headers;
    expect(Object.keys(headers).sort()).toStrictEqual(['accept', 'accept-encoding', 'host']);
  });

  it('opens a fresh socket rather than reusing one between two renders', () => {
    expect(pinnedRequestOptions(PINNED).agent).toBe(false);
  });
});

describe('the resolver a real runtime uses', () => {
  it('answers nothing for a name that does not resolve, rather than failing', async () => {
    /* Both families are asked; a name that answers neither is simply a name with no address, and
       the policy above refuses it without opening a socket. */
    const resolver = createNodeResolver();
    await expect(
      resolver.resolve('invalid.invalid', new AbortController().signal),
    ).resolves.toStrictEqual([]);
  });

  it('stops resolving when the render is cancelled, and says so', async () => {
    /* A cancellation is not an empty answer: the policy above must not read it as "this name has
       no address" and go on to some other conclusion. */
    const controller = new AbortController();
    const resolver = createNodeResolver();
    const running = resolver.resolve('invalid.invalid', controller.signal);
    controller.abort();
    await expect(running).rejects.toBeInstanceOf(Error);
  });
});

describe('what a host answered, as the policy reads it', () => {
  const body = (async function* empty(): AsyncGenerator<Uint8Array> {
    /* Deliberately empty: this reader is about the headers, not about the bytes. */
  })();

  it('reads the status, the redirect target and the announced length', () => {
    const answer = readAnswer({
      statusCode: 302,
      headers: { location: 'https://mirror.example.com/x.png', 'content-length': '42' },
      body,
    });
    expect(answer).toStrictEqual({
      status: 302,
      location: 'https://mirror.example.com/x.png',
      contentLength: 42,
      body,
    });
  });

  it('reads a header a host repeated as its first value', () => {
    expect(readAnswer({ statusCode: 200, headers: { location: ['a', 'b'] }, body }).location).toBe(
      'a',
    );
  });

  it('treats a missing or unreadable length as no claim at all', () => {
    expect(readAnswer({ statusCode: 200, headers: {}, body }).contentLength).toBeUndefined();
    expect(
      readAnswer({ statusCode: 200, headers: { 'content-length': 'plenty' }, body }).contentLength,
    ).toBeUndefined();
  });

  it('reads a missing status as none rather than as a success', () => {
    expect(readAnswer({ headers: {}, body }).status).toBe(0);
  });
});

describe('the https client of a real runtime', () => {
  it('fails the request rather than hanging when the render is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createNodeTransport().request(PINNED, controller.signal)).rejects.toBeInstanceOf(
      Error,
    );
  });
});

describe('the lookup hook a pinned request installs', () => {
  it('answers the list form Node asks for when it selects a family itself', () => {
    /* `autoSelectFamily` is on by default since Node 20: the hook is called with `all: true` and
       the single-address form fails the connection outright, which would make every authorised
       remote source unloadable. */
    const options = pinnedRequestOptions(PINNED);
    let answered: readonly unknown[] = [];
    options.lookup('assets.example.com', { all: true }, (...args: readonly unknown[]) => {
      answered = args;
    });
    expect(answered).toStrictEqual([null, [{ address: '93.184.216.34', family: 4 }]]);
  });
});

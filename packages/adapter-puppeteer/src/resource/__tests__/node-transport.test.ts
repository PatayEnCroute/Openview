import { describe, expect, it } from 'vitest';
import {
  createNodeResolver,
  createNodeTransport,
  type NameLookup,
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
  /** A name server that answers from what a test names, so no suite depends on the machine's. */
  const lookup = (
    answers: Partial<Record<'v4' | 'v6', readonly string[] | { readonly code: string }>>,
  ): { readonly open: () => NameLookup; cancelled: () => number } => {
    let cancelled = 0;
    const answer = async (
      of: readonly string[] | { readonly code: string } | undefined,
    ): Promise<readonly string[]> => {
      if (of === undefined || Array.isArray(of)) {
        return (of ?? []) as readonly string[];
      }
      throw Object.assign(new Error('the resolver refused'), of);
    };
    return {
      cancelled: () => cancelled,
      open: () => ({
        resolve4: async () => await answer(answers.v4),
        resolve6: async () => await answer(answers.v6),
        cancel: () => {
          cancelled += 1;
        },
      }),
    };
  };

  const signal = (): AbortSignal => new AbortController().signal;

  it('joins the two families, in the order the policy sorts them', async () => {
    const names = lookup({ v4: ['93.184.216.34'], v6: ['2606:4700::1111'] });
    await expect(
      createNodeResolver(names.open).resolve('assets.example.com', signal()),
    ).resolves.toStrictEqual([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700::1111', family: 6 },
    ]);
  });

  it('reads "no record of that family" as no address, and nothing worse', async () => {
    const names = lookup({ v4: ['93.184.216.34'], v6: { code: 'ENODATA' } });
    await expect(
      createNodeResolver(names.open).resolve('assets.example.com', signal()),
    ).resolves.toStrictEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  it('answers nothing at all for a name that holds neither family', async () => {
    const names = lookup({ v4: { code: 'ENOTFOUND' }, v6: { code: 'ENOTFOUND' } });
    await expect(
      createNodeResolver(names.open).resolve('nowhere.invalid', signal()),
    ).resolves.toStrictEqual([]);
  });

  it('re-throws a failure that is not "no record", rather than reading it as one', async () => {
    /* A resolution an attacker can make fail would otherwise leave the surviving family deciding
       alone, and the policy refuses a name only once it has seen every address it has. */
    const names = lookup({ v4: ['93.184.216.34'], v6: { code: 'EAI_AGAIN' } });
    await expect(
      createNodeResolver(names.open).resolve('assets.example.com', signal()),
    ).rejects.toBeInstanceOf(Error);
  });

  it('cancels the resolution when the render is cancelled', async () => {
    const names = lookup({ v4: ['93.184.216.34'] });
    const controller = new AbortController();
    const running = createNodeResolver(names.open).resolve('assets.example.com', controller.signal);
    controller.abort();
    await running.catch(() => undefined);
    expect(names.cancelled()).toBe(1);
  });

  it('dials nothing at all when the render was already cancelled', async () => {
    /* A listener added to a signal that has already fired never runs, so both queries would leave
       and outlive the render that wanted them. */
    const names = lookup({ v4: ['93.184.216.34'] });
    const controller = new AbortController();
    controller.abort();
    await expect(
      createNodeResolver(names.open).resolve('assets.example.com', controller.signal),
    ).rejects.toBeInstanceOf(Error);
    expect(names.cancelled()).toBe(0);
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

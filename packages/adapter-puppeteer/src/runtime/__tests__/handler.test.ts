import { DocumentRenderError, type PdfRenderSession } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { type CallChannel, createProxyStrategy, engineOptionsOf, runTask } from '../handler.js';
import type { SessionCall } from '../protocol.js';
import { SMALL_DATA } from './fixtures.js';

/** A channel that answers from a table and records what it was asked. */
function channelOf(answers: Partial<Record<SessionCall['op'], unknown>>): {
  readonly channel: CallChannel;
  readonly asked: SessionCall[];
} {
  const asked: SessionCall[] = [];
  return {
    asked,
    channel: {
      call(call: SessionCall): Promise<unknown> {
        asked.push(call);
        return Promise.resolve(answers[call.op]);
      },
    },
  };
}

const OPEN = { sheet: { width: 210, height: 297 }, images: [] };

async function refusalOf(run: Promise<unknown>): Promise<DocumentRenderError> {
  const caught: unknown = await run.catch((error: unknown) => error);
  if (caught instanceof DocumentRenderError) {
    return caught;
  }
  throw new Error(`expected a refusal, got ${String(caught)}`);
}

const sessionOf = async (
  answers: Partial<Record<SessionCall['op'], unknown>>,
): Promise<{
  readonly session: PdfRenderSession;
  readonly asked: SessionCall[];
}> => {
  const { channel, asked } = channelOf(answers);
  const session = await createProxyStrategy(channel).open(OPEN);
  return { session, asked };
};

const SOURCE = {
  html: '<!doctype html>',
  sheet: { width: 210, height: 297 },
  images: [{ key: 'o1', src: 'data:image/png;base64,AAAA' }],
};

describe('the strategy the engine runs against inside a worker', () => {
  it('opens by asking the parent, and carries the sheet and the reached images', async () => {
    const { asked } = await sessionOf({});
    expect(asked).toStrictEqual([{ op: 'open', sheet: OPEN.sheet, images: [] }]);
  });

  it('asks the parent to resolve each occurrence, and returns what it answered', async () => {
    const { session, asked } = await sessionOf({ resolve: [{ key: 'o1', src: 'data:x' }] });
    await expect(
      session.resolveImages([{ key: 'o1', nodeId: 'logo', path: ['root'], src: 'asset:logo' }]),
    ).resolves.toStrictEqual([{ key: 'o1', src: 'data:x' }]);
    expect(asked[1]).toStrictEqual({
      op: 'resolve',
      images: [{ key: 'o1', nodeId: 'logo', path: ['root'], src: 'asset:logo' }],
    });
  });

  it('refuses a resolution of the wrong shape rather than painting from it', async () => {
    const { session } = await sessionOf({ resolve: [{ key: 'o1' }] });
    expect((await refusalOf(session.resolveImages([]))).code).toBe('render-worker-failed');
  });

  it('refuses a measurement of the wrong shape', async () => {
    const { session } = await sessionOf({ measure: { pages: [] } });
    expect((await refusalOf(session.measure(SOURCE))).code).toBe('render-worker-failed');
  });

  it('refuses a printed document that is not bytes at all', async () => {
    const { session } = await sessionOf({ print: 'not bytes' });
    expect((await refusalOf(session.print(SOURCE))).code).toBe('render-worker-failed');
  });

  it('returns the printed bytes untouched', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { session } = await sessionOf({ print: bytes });
    await expect(session.print(SOURCE)).resolves.toBe(bytes);
  });

  it('closes by asking the parent, and sends nothing else', async () => {
    const { session, asked } = await sessionOf({});
    await session.close();
    expect(asked[1]).toStrictEqual({ op: 'close' });
  });

  it('sends a plain copy of the document, sharing nothing with the engine', async () => {
    const { session, asked } = await sessionOf({ print: new Uint8Array() });
    await session.print(SOURCE);
    const sent = asked[1];
    expect(sent?.op).toBe('print');
    if (sent?.op === 'print') {
      expect(sent.document).toStrictEqual(SOURCE);
      expect(sent.document.images).not.toBe(SOURCE.images);
    }
  });
});

describe('the options a task carries into the engine', () => {
  it('is an empty configuration when the caller named none', () => {
    expect(engineOptionsOf(undefined)).toStrictEqual({});
  });

  it('keeps only the fields the caller really set', () => {
    expect(
      engineOptionsOf({
        shapeLimits: { maxDepth: 8, maxNodes: undefined },
        safetyLimits: { maxPages: 2 },
      }),
    ).toStrictEqual({ shapeLimits: { maxDepth: 8 }, safetyLimits: { maxPages: 2 } });
  });

  it('carries the writing selection of the template unchanged', () => {
    expect(engineOptionsOf({ presentationSelection: { amount: 'fr' } })).toStrictEqual({
      presentationSelection: { amount: 'fr' },
    });
  });

  it('carries the evaluation ceilings the caller set', () => {
    expect(engineOptionsOf({ evaluationLimits: { maxSteps: 10 } })).toStrictEqual({
      evaluationLimits: { maxSteps: 10 },
    });
  });
});

describe('a task whose template is not one', () => {
  it('is refused inside the isolate, and reported as a projected failure', async () => {
    const { channel } = channelOf({});
    const outcome = await runTask(
      { format: 'pdf', template: { nonsense: true }, data: SMALL_DATA, options: undefined },
      channel,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('render-worker-failed');
    }
  });

  it('is refused by the shape guard before it is parsed at all', async () => {
    const { channel } = channelOf({});
    const deep: Record<string, unknown> = {};
    let node = deep;
    for (let at = 0; at < 40; at += 1) {
      const next: Record<string, unknown> = {};
      node.child = next;
      node = next;
    }
    const outcome = await runTask(
      {
        format: 'pdf',
        template: deep,
        data: {},
        options: { shapeLimits: { maxDepth: 4 } },
      },
      channel,
    );
    expect(outcome.ok).toBe(false);
  });
});

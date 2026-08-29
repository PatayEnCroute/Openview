import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import {
  errorFrom,
  parseParentMessage,
  parseWorkerMessage,
  safeErrorOf,
  WORKER_PROTOCOL_VERSION,
} from '../protocol.js';

const SECRET = 'the customer is Acme, owing 1 234,56';

describe('a failure crossing the thread boundary', () => {
  it('keeps the code and the safe details of a refusal the engine typed', () => {
    const safe = safeErrorOf(
      new DocumentRenderError('refused', 'page-limit-exceeded', {
        nodeId: 'rows',
        path: ['root', 0],
        limit: 100,
        observed: 101,
        pageNumber: 101,
        phase: 'pagination',
        region: 'root',
      }),
    );
    expect(safe.code).toBe('page-limit-exceeded');
    expect(safe.details).toStrictEqual({
      nodeId: 'rows',
      path: ['root', 0],
      limit: 100,
      observed: 101,
      pageNumber: 101,
      phase: 'pagination',
      region: 'root',
    });
  });

  it('drops the diagnostics and the occurrence address, which quote the data', () => {
    const safe = safeErrorOf(
      new DocumentRenderError('refused', 'expression-refused', {
        nodeId: 'total',
        diagnostics: [
          {
            source: 'expression-evaluation',
            code: 'operand-type',
            actualType: 'string',
            site: 'loop',
            message: SECRET,
            path: [],
            nodeId: 'total',
          },
        ],
        occurrence: { declarationPath: ['root'], iterations: [{ declarationPath: [], index: 7 }] },
      }),
    );
    expect(JSON.stringify(safe)).not.toContain('Acme');
    expect(safe.details).toStrictEqual({ nodeId: 'total' });
  });

  it('turns anything else into one constant sentence, with no message of its own', () => {
    const safe = safeErrorOf(new Error(SECRET));
    expect(safe.code).toBe('render-worker-failed');
    expect(safe.message).not.toContain('Acme');
    expect(safe.details).toStrictEqual({});
  });

  it('carries neither a stack nor a cause', () => {
    const safe = safeErrorOf(
      new DocumentRenderError('refused', 'pdf-export-failed', {}, { cause: new Error(SECRET) }),
    );
    const written = JSON.stringify(safe);
    expect(written).not.toContain('Acme');
    expect(written).not.toContain('stack');
  });

  it('is rebuilt on the other side as a refusal with no cause at all', () => {
    const rebuilt = errorFrom(
      safeErrorOf(new DocumentRenderError('refused', 'render-timeout', {})),
    );
    expect(rebuilt).toBeInstanceOf(DocumentRenderError);
    expect(rebuilt.code).toBe('render-timeout');
    expect(rebuilt.cause).toBeUndefined();
  });
});

describe('the messages the two sides exchange', () => {
  const envelope = { formatVersion: WORKER_PROTOCOL_VERSION, generation: 0 };

  it('accepts every shape the protocol declares', () => {
    expect(parseWorkerMessage({ ...envelope, kind: 'ready' })?.kind).toBe('ready');
    expect(
      parseWorkerMessage({
        ...envelope,
        kind: 'call',
        renderId: 'r1',
        sequence: 1,
        call: { op: 'close' },
      })?.kind,
    ).toBe('call');
    expect(parseParentMessage({ ...envelope, kind: 'shutdown' })?.kind).toBe('shutdown');
  });

  it('refuses a message of another protocol version', () => {
    expect(parseWorkerMessage({ formatVersion: 99, generation: 0, kind: 'ready' })).toBeUndefined();
  });

  it('refuses a discriminant it does not know, and a field it did not declare', () => {
    expect(parseWorkerMessage({ ...envelope, kind: 'whatever' })).toBeUndefined();
    expect(parseWorkerMessage({ ...envelope, kind: 'ready', extra: 1 })).toBeUndefined();
    expect(parseParentMessage({ ...envelope, kind: 'reply' })).toBeUndefined();
  });

  it('refuses a session operation outside the closed list', () => {
    expect(
      parseWorkerMessage({
        ...envelope,
        kind: 'call',
        renderId: 'r1',
        sequence: 1,
        call: { op: 'exec', code: '1' },
      }),
    ).toBeUndefined();
  });

  it('refuses a generation that is not a whole count', () => {
    expect(
      parseWorkerMessage({ formatVersion: WORKER_PROTOCOL_VERSION, generation: -1, kind: 'ready' }),
    ).toBeUndefined();
  });

  it('refuses a task whose data set is not an object of the caller', () => {
    expect(
      parseParentMessage({
        ...envelope,
        kind: 'start',
        renderId: 'r1',
        task: { format: 'pdf', template: {}, data: 'not a scope', options: undefined },
      }),
    ).toBeUndefined();
  });

  it('accepts a task whose data set uses whatever names the caller chose', () => {
    const parsed = parseParentMessage({
      ...envelope,
      kind: 'start',
      renderId: 'r1',
      task: {
        format: 'pdf',
        template: {},
        data: { whateverTheHostCallsIt: [1, 2, 3] },
        options: undefined,
      },
    });
    expect(parsed?.kind).toBe('start');
  });

  it('refuses an engine option it did not declare', () => {
    expect(
      parseParentMessage({
        ...envelope,
        kind: 'start',
        renderId: 'r1',
        task: { format: 'pdf', template: {}, data: {}, options: { invented: 1 } },
      }),
    ).toBeUndefined();
  });
});

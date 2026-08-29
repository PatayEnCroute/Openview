import { DocumentRenderError } from '@openview/engine';
import { describe, expect, it } from 'vitest';
import { snapshotValue, type TransportLimits } from '../snapshot.js';

const LIMITS: TransportLimits = { maxValues: 10_000, maxStringLength: 100_000 };

const refusalOf = (run: () => unknown): DocumentRenderError => {
  try {
    run();
  } catch (error) {
    if (error instanceof DocumentRenderError) {
      return error;
    }
    throw error;
  }
  throw new Error('the request was admitted');
};

describe('the copy one request is admitted under', () => {
  it('keeps plain data exactly as the caller wrote it', () => {
    const data = {
      whateverTheHostCallsIt: { lines: [{ ref: 'A-1', qty: 2 }], total: 42.5, flagged: true },
      nothing: null,
    };
    expect(snapshotValue(data, LIMITS)).toStrictEqual(data);
  });

  it('reserves no key and interprets no name of the caller', () => {
    /* The whole point: a data set belongs to the integrator, and none of its names is ours. */
    const data = { template: 1, data: 2, schemaVersion: 3, __proto__value: 4 };
    expect(snapshotValue(data, LIMITS)).toStrictEqual(data);
  });

  it('shares no reference with the caller, so a later mutation changes nothing', () => {
    const lines = [{ ref: 'A-1' }];
    const copied = snapshotValue({ lines }, LIMITS);
    lines[0] = { ref: 'changed' };
    expect(copied).toStrictEqual({ lines: [{ ref: 'A-1' }] });
  });

  it('never runs an accessor of the caller', () => {
    let read = 0;
    const data = {
      get trap(): string {
        read += 1;
        return 'ran';
      },
    };
    expect(refusalOf(() => snapshotValue(data, LIMITS)).code).toBe('template-refused');
    expect(read).toBe(0);
  });

  it('drops a property the caller made non-enumerable', () => {
    const data: Record<string, unknown> = { kept: 1 };
    Object.defineProperty(data, 'hidden', { value: 2, enumerable: false });
    expect(snapshotValue(data, LIMITS)).toStrictEqual({ kept: 1 });
  });

  it('refuses a function, a symbol and a symbol-keyed property', () => {
    expect(refusalOf(() => snapshotValue({ run: () => 1 }, LIMITS)).code).toBe('template-refused');
    expect(refusalOf(() => snapshotValue({ tag: Symbol('x') }, LIMITS)).code).toBe(
      'template-refused',
    );
    expect(refusalOf(() => snapshotValue({ [Symbol('x')]: 1 }, LIMITS)).code).toBe(
      'template-refused',
    );
  });

  it('refuses an instance of a class, which carries behaviour a copy would drop', () => {
    expect(refusalOf(() => snapshotValue({ when: new Map() }, LIMITS)).code).toBe(
      'template-refused',
    );
  });

  it('refuses a cycle rather than following it for ever', () => {
    const data: Record<string, unknown> = {};
    data.itself = data;
    expect(refusalOf(() => snapshotValue(data, LIMITS)).code).toBe('template-refused');
  });

  it('copies a subtree shared twice as two subtrees, and charges for both', () => {
    /* Sharing is ordinary in json-shaped data; only a cycle is refused. Each occurrence is copied
       and counted, so the budget stays an upper bound on what really crosses the boundary. */
    const shared = { ref: 'A-1' };
    expect(snapshotValue({ a: shared, b: shared }, LIMITS)).toStrictEqual({
      a: { ref: 'A-1' },
      b: { ref: 'A-1' },
    });
    expect(
      refusalOf(() => snapshotValue({ a: shared, b: shared }, { ...LIMITS, maxValues: 4 })).code,
    ).toBe('template-refused');
  });

  it('counts every value, and refuses one past the ceiling', () => {
    const rows = Array.from({ length: 40 }, (_, at) => ({ at }));
    expect(() => snapshotValue(rows, { ...LIMITS, maxValues: 81 })).not.toThrow();
    const refused = refusalOf(() => snapshotValue(rows, { ...LIMITS, maxValues: 80 }));
    expect(refused.details.limit).toBe(80);
    expect(refused.details.phase).toBe('transport');
  });

  it('counts the strings together, and names no key when it refuses', () => {
    const refused = refusalOf(() =>
      snapshotValue({ a: 'xxxx', b: 'yyyy' }, { ...LIMITS, maxStringLength: 7 }),
    );
    expect(refused.details.limit).toBe(7);
    expect(refused.message).not.toContain('xxxx');
    expect(refused.details.nodeId).toBeUndefined();
  });

  it('copies the primitives a json document really carries', () => {
    expect(snapshotValue([1, 'two', true, null, undefined], LIMITS)).toStrictEqual([
      1,
      'two',
      true,
      null,
      undefined,
    ]);
  });

  it('copies an object with a null prototype, which is still plain data', () => {
    const bare = Object.assign(Object.create(null), { ref: 'A-1' });
    expect(snapshotValue(bare, LIMITS)).toStrictEqual({ ref: 'A-1' });
  });
});

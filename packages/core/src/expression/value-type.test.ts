import { describe, expect, it } from 'vitest';
import {
  EXPRESSION_VALUE_TYPES,
  type ExpressionValueType,
  kindOf,
  valueTypeOf,
} from './value-type.js';

describe('valueTypeOf', () => {
  it.each<readonly [unknown, ExpressionValueType]>([
    [null, 'absent'],
    [undefined, 'absent'],
    ['', 'string'],
    ['ACME', 'string'],
    [0, 'number'],
    [-1.5, 'number'],
    [Number.NaN, 'not-finite'],
    [Number.POSITIVE_INFINITY, 'not-finite'],
    [Number.NEGATIVE_INFINITY, 'not-finite'],
    [false, 'boolean'],
    [[], 'list'],
    [[1, 2], 'list'],
    [{}, 'object'],
    [new Map(), 'object'],
    [(): number => 1, 'function'],
    [10n, 'unsupported'],
    [Symbol('s'), 'unsupported'],
  ])('tags %o as %s', (value, expected) => {
    expect(valueTypeOf(value)).toBe(expected);
  });

  it('separates a non-finite number from a number', () => {
    // Not cosmetic: the arithmetic policy raises `not-finite` where it raises
    // `operand-type` for a wrong shape, so a payload reporting `not-finite` with an
    // `actualType` of `number` would contradict itself.
    expect(valueTypeOf(Number.NaN)).not.toBe(valueTypeOf(1));
  });

  it('tags an array before falling through to object', () => {
    // `typeof [] === 'object'`, so the order of the two checks is the whole test: an
    // author told "an object" when they passed a list learns nothing.
    expect(valueTypeOf([1])).toBe('list');
  });

  it('reads the shape without touching the contents', () => {
    // The rule the payload rests on: a tag is derived from nullness, Array.isArray,
    // typeof and finiteness -- never from a key, an element or an accessor.
    let reads = 0;
    const watched = {
      get secret(): string {
        reads += 1;
        return 'token';
      },
    };

    expect(valueTypeOf(watched)).toBe('object');
    expect(reads).toBe(0);
  });

  it('declares no tag twice', () => {
    // Distinctness is a contract: two entries with the same spelling would make one of them
    // unreachable and `describe()` silently lose a case. The count is NOT a contract -- an
    // assertion that the tuple has nine entries only fails when someone edits the tuple, in
    // which case they edit the number beside it (AGENTS.md 5, no tautological tests).
    expect(new Set(EXPRESSION_VALUE_TYPES).size).toBe(EXPRESSION_VALUE_TYPES.length);
  });
});

describe('kindOf', () => {
  it('names the discriminant of a smuggled member', () => {
    expect(kindOf({ kind: 'regex', pattern: '.*' }, 'kind')).toBe('regex');
    expect(kindOf({ type: 'barcode', id: 'b1' }, 'type')).toBe('barcode');
  });

  it('describes a payload that has no such property, rather than saying undefined', () => {
    expect(kindOf({ id: 'b1' }, 'kind')).toBe('object');
    expect(kindOf([1, 2], 'kind')).toBe('list');
    expect(kindOf('bare', 'kind')).toBe('string');
    expect(kindOf(null, 'kind')).toBe('absent');
  });

  it('describes a discriminant that is not a string', () => {
    expect(kindOf({ kind: 7 }, 'kind')).toBe('number');
    expect(kindOf({ kind: null }, 'kind')).toBe('absent');
  });

  it('does not invoke a discriminant defined by a getter', () => {
    // The same rule as the shape guard: describing a failure must not run the caller's
    // code. A payload that reached an exhaustiveness branch is by definition one that
    // bypassed validation, so nothing about it can be trusted.
    let reads = 0;
    const alive = {
      get kind(): string {
        reads += 1;
        return 'regex';
      },
    };

    expect(kindOf(alive, 'kind')).toBe('object');
    expect(reads).toBe(0);
  });

  it('survives a payload too deep for JSON.stringify', () => {
    // The reason this function exists. `JSON.stringify` overflows the stack around 8 000
    // levels, so describing the payload used to crash the exhaustiveness guard on exactly
    // the inputs it was written to report.
    let deep: Record<string, unknown> = { kind: 'regex' };
    for (let level = 0; level < 20_000; level += 1) {
      deep = { child: deep, kind: 'regex' };
    }

    expect(() => JSON.stringify(deep)).toThrow(RangeError);
    expect(kindOf(deep, 'kind')).toBe('regex');
  });
});

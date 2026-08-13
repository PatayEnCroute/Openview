import { describe, expect, it } from 'vitest';
import { EXPRESSION_VALUE_TYPES, type ExpressionValueType, valueTypeOf } from './value-type.js';

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

  it('declares nine tags, all distinct', () => {
    expect(EXPRESSION_VALUE_TYPES).toHaveLength(9);
    expect(new Set(EXPRESSION_VALUE_TYPES).size).toBe(9);
  });
});

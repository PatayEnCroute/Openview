import { describe, expect, it } from 'vitest';
import type { DataType } from '../types.js';
import { type DataTypeVisitor, visitDataType } from '../visitor.js';

const NAMING: DataTypeVisitor<string, undefined> = {
  scalar: (type) => `scalar:${type.kind}`,
  object: (type) => `object:${String(type.fields.length)}`,
  list: (type) => `list:${type.items.kind}`,
};

const SAMPLES: readonly [DataType, string][] = [
  [{ kind: 'string' }, 'scalar:string'],
  [{ kind: 'number' }, 'scalar:number'],
  [{ kind: 'boolean' }, 'scalar:boolean'],
  [{ kind: 'civil-date' }, 'scalar:civil-date'],
  [{ kind: 'object', fields: [] }, 'object:0'],
  [{ kind: 'list', items: { kind: 'number' } }, 'list:number'],
];

describe('visitDataType', () => {
  it.each(SAMPLES)('routes %o to its own branch', (type, expected) => {
    expect(visitDataType(type, NAMING, undefined)).toBe(expected);
  });

  it('passes the context through untouched', () => {
    const context = { marker: Symbol('context') };
    const echo: DataTypeVisitor<unknown, typeof context> = {
      scalar: (_type, given) => given,
      object: (_type, given) => given,
      list: (_type, given) => given,
    };
    for (const [type] of SAMPLES) {
      expect(visitDataType(type, echo, context)).toBe(context);
    }
  });

  it('throws on a nature it does not know', () => {
    // The guarantee the four terminal kinds share one branch does not weaken: a seventh kind added
    // to the union breaks compilation at this single site instead of being read as a scalar.
    const smuggled: DataType = JSON.parse('{"kind":"money","currency":"EUR"}');
    expect(() => visitDataType(smuggled, NAMING, undefined)).toThrow(TypeError);
  });
});

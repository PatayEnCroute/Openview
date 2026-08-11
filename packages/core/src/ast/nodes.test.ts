import { describe, expect, it } from 'vitest';
import { type DocumentNode, DocumentNodeSchema } from './nodes.js';

describe('DocumentNodeSchema', () => {
  it('parses a tree nested several levels deep', () => {
    const raw = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'title', content: 'Invoice' },
        {
          type: 'loop',
          id: 'lines',
          each: { kind: 'path', path: 'invoice.lines' },
          children: [
            {
              type: 'condition',
              id: 'discounted',
              when: {
                kind: 'compare',
                op: 'gt',
                left: { kind: 'path', path: 'line.discount' },
                right: { kind: 'literal', value: 0 },
              },
              children: [{ type: 'text', id: 'label', content: 'Discount applied' }],
            },
          ],
        },
      ],
    };

    const parsed: DocumentNode = DocumentNodeSchema.parse(raw);

    expect(parsed.type).toBe('container');
    // Recursion has to survive three levels, which is where a broken z.lazy
    // binding would silently degrade to `unknown`.
    expect(JSON.parse(JSON.stringify(parsed))).toStrictEqual(raw);
  });

  it('accepts an image without an alt attribute', () => {
    const parsed = DocumentNodeSchema.parse({ type: 'image', id: 'logo', src: 'logo.png' });
    expect(parsed).toStrictEqual({ type: 'image', id: 'logo', src: 'logo.png' });
  });

  it('rejects an unknown node type', () => {
    expect(() => DocumentNodeSchema.parse({ type: 'barcode', id: 'b1' })).toThrow();
  });

  it('rejects an empty node id', () => {
    expect(() => DocumentNodeSchema.parse({ type: 'text', id: '', content: 'x' })).toThrow();
  });

  it('rejects a loop whose source is not a valid expression', () => {
    expect(() =>
      DocumentNodeSchema.parse({ type: 'loop', id: 'l1', each: 'invoice.lines', children: [] }),
    ).toThrow();
  });

  it('rejects a condition carrying a malformed expression', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'condition',
        id: 'c1',
        when: { kind: 'compare', op: 'gt', left: { kind: 'path', path: 'a' } },
        children: [],
      }),
    ).toThrow();
  });

  it('rejects an invalid node nested inside a valid parent', () => {
    // The failure that matters: a malformed leaf must not be waved through
    // because its container looks fine.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'container',
        id: 'root',
        children: [
          { type: 'text', id: 'ok', content: 'fine' },
          { type: 'text', id: 'broken' },
        ],
      }),
    ).toThrow();
  });
});

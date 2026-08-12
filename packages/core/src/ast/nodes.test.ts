import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';
import {
  type DocumentNode,
  DocumentNodeSchema,
  TextNodeSchema,
  type TextSegment,
  type TextSegmentSchema,
} from './nodes.js';

/** True only when each type accepts the other; `false` otherwise, which fails to assign. */
type MutuallyAssignable<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? true
    : false
  : false;

describe('DocumentNodeSchema', () => {
  it('parses a tree nested several levels deep', () => {
    const raw = {
      type: 'container',
      id: 'root',
      children: [
        { type: 'text', id: 'title', content: [{ kind: 'literal', text: 'Invoice' }] },
        {
          type: 'loop',
          id: 'lines',
          each: { kind: 'path', path: 'invoice.lines' },
          as: 'line',
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
              children: [
                {
                  type: 'text',
                  id: 'label',
                  content: [{ kind: 'literal', text: 'Discount applied' }],
                },
              ],
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

  it('parses a paragraph mixing fixed text and a binding', () => {
    const parsed = TextNodeSchema.parse({
      type: 'text',
      id: 't1',
      content: [
        { kind: 'literal', text: 'Total due: ' },
        { kind: 'binding', value: { kind: 'path', path: 'invoice.total' } },
      ],
    });

    const segments: readonly TextSegment[] = parsed.content;

    expect(segments).toHaveLength(2);
    expect(segments[1]?.kind).toBe('binding');
  });

  it('keeps the segment schema and the hand-written union in step', () => {
    // A compile-time assertion wearing a runtime expectation, and the only guard
    // that works here. `z.ZodType` is covariant in its output, so neither
    // DocumentNodeSchema's explicit binding nor the assignment above can catch a
    // schema that drifted -- both accept one producing LESS than TextSegment.
    // This fails to compile in both directions.
    const inStep: MutuallyAssignable<z.infer<typeof TextSegmentSchema>, TextSegment> = true;

    expect(inStep).toBe(true);
  });

  it('rejects a predicate expression in a print position', () => {
    // `isEmpty` yields a boolean, so accepting it here would let a template print
    // `true` into an invoice. The sibling positions enforce their result kind at
    // evaluation; this one enforces it at save time.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'text',
        id: 't',
        content: [
          { kind: 'binding', value: { kind: 'isEmpty', operand: { kind: 'path', path: 'a' } } },
        ],
      }),
    ).toThrow();
  });

  it('accepts an empty paragraph', () => {
    expect(TextNodeSchema.parse({ type: 'text', id: 't', content: [] }).content).toStrictEqual([]);
  });

  it('rejects a text node whose content is still a bare string', () => {
    // The pre-ADR-0002 shape. Worth pinning: it must fail loudly rather than
    // parse into something that renders empty.
    expect(() => DocumentNodeSchema.parse({ type: 'text', id: 't', content: 'Invoice' })).toThrow();
  });

  it('rejects a segment kind it does not know', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'text',
        id: 't',
        content: [{ kind: 'html', text: '<b>x</b>' }],
      }),
    ).toThrow();
  });

  it('rejects a binding carrying a malformed expression', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'text',
        id: 't',
        content: [{ kind: 'binding', value: { kind: 'path', path: '1nope' } }],
      }),
    ).toThrow();
  });

  it('accepts an image without an alt attribute', () => {
    const parsed = DocumentNodeSchema.parse({ type: 'image', id: 'logo', src: 'logo.png' });
    expect(parsed).toStrictEqual({ type: 'image', id: 'logo', src: 'logo.png' });
  });

  it('rejects an unknown node type', () => {
    expect(() => DocumentNodeSchema.parse({ type: 'barcode', id: 'b1' })).toThrow();
  });

  it('rejects an empty node id', () => {
    expect(() => DocumentNodeSchema.parse({ type: 'text', id: '', content: [] })).toThrow();
  });

  it('rejects a loop whose source is not a valid expression', () => {
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'loop',
        id: 'l1',
        each: 'invoice.lines',
        as: 'line',
        children: [],
      }),
    ).toThrow();
  });

  it('rejects a loop that declares no alias', () => {
    // Without one, children have no name for the current item -- the state this
    // package was in before ADR 0002.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'loop',
        id: 'l1',
        each: { kind: 'path', path: 'items' },
        children: [],
      }),
    ).toThrow();
  });

  it.each([
    '',
    'line.total',
    'my line',
    '1st',
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'hasOwnProperty',
  ])('rejects %o as a loop alias', (alias) => {
    // The alias becomes a key of the evaluation scope, so it obeys exactly the
    // rule a path obeys -- every member of Object.prototype included, because
    // `as: 'toString'` would install data over a method and make String(scope)
    // throw.
    expect(() =>
      DocumentNodeSchema.parse({
        type: 'loop',
        id: 'l1',
        each: { kind: 'path', path: 'items' },
        as: alias,
        children: [],
      }),
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
          { type: 'text', id: 'ok', content: [{ kind: 'literal', text: 'fine' }] },
          { type: 'text', id: 'broken' },
        ],
      }),
    ).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { InvalidShapeLimitsError, TemplateShapeError } from '../errors.js';
import {
  assertBoundedShape,
  DEFAULT_SHAPE_LIMITS,
  parseDocumentNode,
  parseExpression,
  resolveShapeLimits,
} from './guard.js';

/** A chain of `levels` nested objects, so the innermost value sits at that depth. */
function nest(levels: number): unknown {
  let built: unknown = 'leaf';
  for (let remaining = levels - 1; remaining > 0; remaining -= 1) {
    built = { child: built };
  }
  return built;
}

/** A tree whose depth is small and whose VISIT COUNT is 2^levels. */
function shared(levels: number): unknown {
  let built: unknown = 'leaf';
  for (let remaining = 0; remaining < levels; remaining += 1) {
    built = { left: built, right: built };
  }
  return built;
}

function shapeErrorOf(run: () => void): TemplateShapeError {
  try {
    run();
  } catch (error) {
    if (error instanceof TemplateShapeError) {
      return error;
    }
    throw error;
  }
  return expect.unreachable('the shape guard should have refused');
}

describe('assertBoundedShape', () => {
  it('accepts a payload exactly at the depth ceiling', () => {
    expect(() => assertBoundedShape(nest(DEFAULT_SHAPE_LIMITS.maxDepth))).not.toThrow();
  });

  it('refuses one level past the ceiling, with a typed error', () => {
    // The refusal lot C8 can narrate. Without this guard the first failure is a
    // RangeError from Zod at ~1 874 levels, crossing parseTemplate unwrapped.
    const error = shapeErrorOf(() => {
      assertBoundedShape(nest(DEFAULT_SHAPE_LIMITS.maxDepth + 1));
    });

    expect(error.code).toBe('too-deep');
    expect(error.limit).toBe(DEFAULT_SHAPE_LIMITS.maxDepth);
  });

  it('is itself insensitive to the depth it measures', () => {
    // The scan is iterative with an explicit stack, so 100 000 levels cost no JavaScript
    // stack at all. A recursive guard would be the thing it was written to prevent.
    expect(() =>
      assertBoundedShape(nest(100_000), { maxDepth: 200_000, maxNodes: 200_000 }),
    ).not.toThrow();
  });

  it('terminates on a shared-subtree tree whose depth is legal', () => {
    // Measured: depth 40 with the same object referenced twice per level is 5 000 000
    // visits in 846 ms and never reaches maxDepth. The depth is bounded, the work is not,
    // so `maxNodes` is the termination condition rather than a comfort.
    const error = shapeErrorOf(() => {
      assertBoundedShape(shared(40));
    });

    expect(error.code).toBe('too-many-nodes');
    expect(error.limit).toBe(DEFAULT_SHAPE_LIMITS.maxNodes);
  });

  it('refuses an accessor WITHOUT invoking it', () => {
    // Measured: a naive scan invokes a getter, so caller code runs before validation --
    // and the getter can hand one value to the guard and another to Zod.
    let reads = 0;
    const alive = {
      id: 'tpl_1',
      get name(): string {
        reads += 1;
        return 'Invoice';
      },
    };

    const error = shapeErrorOf(() => {
      assertBoundedShape(alive);
    });

    expect(error.code).toBe('not-plain-data');
    expect(error.limit).toBeUndefined();
    expect(reads).toBe(0);
  });

  it('refuses an accessor buried inside the payload', () => {
    const buried: Record<string, unknown> = { root: { children: [{}] } };
    const leaf = { id: 'n1' };
    Object.defineProperty(leaf, 'src', { get: () => 'logo.png', enumerable: true });
    buried.leaf = leaf;

    expect(shapeErrorOf(() => assertBoundedShape(buried)).code).toBe('not-plain-data');
  });

  it('refuses a non-enumerable accessor too, because Zod would still read it', () => {
    // Zod reads a field of its shape whether or not the property is enumerable, so the
    // scan enumerates own property descriptors rather than own enumerable keys.
    const hidden = { id: 'tpl' };
    Object.defineProperty(hidden, 'name', { get: () => 'Invoice', enumerable: false });

    expect(shapeErrorOf(() => assertBoundedShape(hidden)).code).toBe('not-plain-data');
  });

  it('terminates on a cyclic payload rather than looping forever', () => {
    // A cycle exceeds every finite depth, so maxDepth catches it -- but ONLY because each
    // stack frame carries its own depth. That is a property of the implementation, not of
    // the concept: the first refactor that hoists the depth out of the frame makes this
    // spin forever, and this test is what says so.
    const cyclic: Record<string, unknown> = { id: 'tpl' };
    cyclic.self = cyclic;

    expect(shapeErrorOf(() => assertBoundedShape(cyclic)).code).toBe('too-deep');
  });

  it('accepts the primitives and the empty containers a document is made of', () => {
    expect(() =>
      assertBoundedShape({
        schemaVersion: 2,
        id: 'tpl',
        name: 'Invoice',
        flag: true,
        nothing: null,
        empties: [{}, []],
      }),
    ).not.toThrow();
  });

  it.each([
    [{ maxDepth: 0 }],
    [{ maxDepth: -1 }],
    [{ maxNodes: Number.NaN }],
    [{ maxNodes: Number.POSITIVE_INFINITY }],
    [{ maxDepth: 1.5 }],
    [{ maxNodes: 2_000_000_000 }],
  ])('refuses the unusable limits %o loudly', (limits) => {
    // Never a silent fallback: `{ maxDepth: 0 }` would neutralise the guard, and
    // `{ maxNodes: NaN }` would make it run forever -- the exact failure maxNodes exists
    // to prevent.
    expect(() => assertBoundedShape({}, limits)).toThrow(InvalidShapeLimitsError);
  });

  it('takes the default for an omitted field', () => {
    expect(resolveShapeLimits({ maxDepth: 8 })).toStrictEqual({
      maxDepth: 8,
      maxNodes: DEFAULT_SHAPE_LIMITS.maxNodes,
    });
    expect(resolveShapeLimits()).toStrictEqual(DEFAULT_SHAPE_LIMITS);
  });
});

describe('the bounded entry points', () => {
  it('parses an expression and a node', () => {
    expect(parseExpression({ kind: 'path', path: 'invoice.total' })).toStrictEqual({
      kind: 'path',
      path: 'invoice.total',
    });
    expect(parseDocumentNode({ type: 'text', id: 't', content: [] })).toStrictEqual({
      type: 'text',
      id: 't',
      content: [],
    });
  });

  it('bounds what the bare schemas do not', () => {
    // The residual risk, named rather than disguised: `ExpressionSchema.parse` stays
    // exported because a Zod schema is the attachment point for z.infer, composition and
    // the partial validation a Designer needs. What it does not do is bound -- so the
    // difference between the two doors is pinned here rather than assumed.
    expect(() => parseExpression(nest(200))).toThrow(TemplateShapeError);
  });

  it('refuses a malformed expression after the shape passes', () => {
    expect(() => parseExpression({ kind: 'path', path: '1nope' })).toThrow();
    expect(() => parseDocumentNode({ type: 'barcode', id: 'b' })).toThrow();
  });
});

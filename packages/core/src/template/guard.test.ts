import { describe, expect, it } from 'vitest';
import { InvalidShapeLimitsError, TemplateShapeError } from '../errors.js';
import { ExpressionSchema } from '../expression/expression.js';
import { RECIPE_PAGE } from '../page/__tests__/fixtures.js';
import {
  assertBoundedShape,
  DEFAULT_SHAPE_LIMITS,
  parseBlockNode,
  parseDocumentNode,
  parseExpression,
  parsePageSetup,
  resolveShapeLimits,
} from './guard.js';
import { parseTemplate } from './migrate.js';
import { CURRENT_SCHEMA_VERSION, type Template } from './template.js';

/** A chain of `levels` nested objects, so the innermost value sits at that depth. */
function nest(levels: number): unknown {
  let built: unknown = 'leaf';
  for (let remaining = levels - 1; remaining > 0; remaining -= 1) {
    built = { child: built };
  }
  return built;
}

/**
 * A chain of `levels` nested `not` nodes: a VALID expression, so the bare schema recurses
 * into it instead of refusing the top level on a missing discriminant.
 */
function nestedNot(levels: number): unknown {
  let built: unknown = { kind: 'literal', value: true };
  for (let remaining = 1; remaining < levels; remaining += 1) {
    built = { kind: 'not', operand: built };
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

  it('tests a WIDE value against the budget BEFORE reading any of its properties', () => {
    // The same payload is scanned under two ceilings to verify node counting before descriptor fetch.
    const wide: unknown[] = [1, 2, 3, 4];
    Object.defineProperty(wide, 0, { get: () => 1, enumerable: true, configurable: true });

    expect(shapeErrorOf(() => assertBoundedShape({ root: wide }, { maxNodes: 3 })).code).toBe(
      'too-many-nodes',
    );
    expect(shapeErrorOf(() => assertBoundedShape({ root: wide }, { maxNodes: 50 })).code).toBe(
      'not-plain-data',
    );
  });

  it('does not count an array length as a value the document contains', () => {
    // `{ a: [1, 2, 3] }` holds five values: the root, `a`, and three elements. Enumerating
    // descriptors used to add the array's own `length`, so it needed a ceiling of 6 and the
    // documented meaning of `maxNodes` drifted with how many arrays a payload held.
    expect(() => assertBoundedShape({ a: [1, 2, 3] }, { maxNodes: 5 })).not.toThrow();
    expect(shapeErrorOf(() => assertBoundedShape({ a: [1, 2, 3] }, { maxNodes: 4 })).code).toBe(
      'too-many-nodes',
    );
  });

  it('steps over a hole in a sparse array', () => {
    // `JSON.parse` never produces one, but a hand-built payload can, and a hole has no
    // descriptor at all -- so the guard must skip it rather than mistake the absence for an
    // accessor. The width pre-check still sizes the array by `length`, which over-counts a
    // sparse one: conservative, and documented on the guard.
    const sparse: unknown[] = [1, 2, 3];
    delete sparse[1];

    expect(() => assertBoundedShape({ a: sparse }, { maxNodes: 5 })).not.toThrow();
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

  it('bounds an expression the bare schema does not, on the SAME input', () => {
    // Both parse methods receive the same deep payload to prove boundedness.
    const deep = nestedNot(5_000);

    expect(() => parseExpression(deep)).toThrow(TemplateShapeError);
    expect(() => ExpressionSchema.parse(deep)).toThrow(RangeError);
  });

  it('refuses a malformed expression after the shape passes', () => {
    expect(() => parseExpression({ kind: 'path', path: '1nope' })).toThrow();
    expect(() => parseDocumentNode({ type: 'barcode', id: 'b' })).toThrow();
  });

  it('parses a block node, and the two node doors differ on a bare row', () => {
    // `parseBlockNode`'s SUCCESS path had no test at all: its only caller passed a
    // 5 000-deep payload, which `assertBoundedShape` refuses first, so `BlockNodeSchema.parse`
    // never ran. A `DocumentNodeSchema.parse` there -- a plausible copy-paste from the sibling
    // three lines above -- would have made the block-only door accept a bare row with all four
    // gates green. That is what the first assertion here exists for.
    expect(parseBlockNode({ type: 'text', id: 't', content: [] })).toStrictEqual({
      type: 'text',
      id: 't',
      content: [],
    });

    // Asserts that parseDocumentNode accepts any document node, while parseBlockNode enforces block types.
    const bareRow = { type: 'tableRow', id: 'r', cells: [] };

    expect(parseDocumentNode(bareRow)).toStrictEqual(bareRow);
    expect(() => parseBlockNode(bareRow)).toThrow();
  });

  it('parses a standalone page, and refuses a malformed one', () => {
    expect(parsePageSetup(RECIPE_PAGE)).toStrictEqual(RECIPE_PAGE);
    expect(() => parsePageSetup({ ...RECIPE_PAGE, sheet: { width: 0, height: 297 } })).toThrow();
  });

  it('bounds a band the bare page schema does not, on the SAME input', () => {
    const nestedContainers = (depth: number): unknown => {
      let node: unknown = { type: 'text', id: 'leaf', content: [] };
      for (let level = 0; level < depth; level += 1) {
        node = { type: 'container', id: `c${level}`, children: [node] };
      }
      return node;
    };

    const deepBandPage: unknown = {
      sheet: { width: 210, height: 297 },
      margins: { top: 20, right: 15, bottom: 25, left: 15 },
      header: [{ on: 'every', content: nestedContainers(5_000) }],
      footer: [],
    };

    expect(() => parsePageSetup(deepBandPage)).toThrow(TemplateShapeError);
  });

  it('agrees with `parseTemplate` on where the depth ceiling falls', () => {
    // The door charges the fragment for the level `page` occupies inside a `Template`, and
    // this is the `it` that pins it. Measured before the fix: a band of 28 nested containers
    // passed `parsePageSetup` and was then refused `too-deep` by `parseTemplate` carrying the
    // very same page -- so the documented pre-storage check said yes and the store call said
    // no, which is the divergence a bounded door exists to close rather than open.
    //
    // Written as a SEARCH for the boundary rather than against a hard-coded 28, because the
    // figure moves with `maxDepth` and a literal would rot silently the day it changes.
    const nestedContainers = (depth: number): unknown => {
      let node: unknown = { type: 'text', id: 'leaf', content: [] };
      for (let level = 0; level < depth; level += 1) {
        node = { type: 'container', id: `c${level}`, children: [node] };
      }
      return node;
    };
    const pageOfDepth = (depth: number): unknown => ({
      ...RECIPE_PAGE,
      header: [],
      footer: [{ on: 'every', content: nestedContainers(depth) }],
    });
    const accepts = (parse: () => unknown): boolean => {
      try {
        parse();
        return true;
      } catch (error) {
        if (error instanceof TemplateShapeError) {
          return false;
        }
        throw error;
      }
    };

    for (let depth = 1; depth <= 40; depth += 1) {
      const page = pageOfDepth(depth);
      const viaFragment = accepts(() => parsePageSetup(page));
      const viaTemplate = accepts(() =>
        parseTemplate({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          id: 'tpl_depth',
          name: 'Profondeur',
          version: '1.0.0',
          page,
          root: { type: 'container', id: 'racine', children: [] },
        }),
      );

      expect({ depth, viaFragment }).toStrictEqual({ depth, viaFragment: viaTemplate });
    }
  });

  it('returns a page that can be written straight back into a Template', () => {
    const stored: Template = parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'tpl_compose',
      name: 'Composition',
      version: '1.0.0',
      page: RECIPE_PAGE,
      root: { type: 'container', id: 'racine', children: [] },
    });
    const page: Template['page'] = parsePageSetup(RECIPE_PAGE);
    const updated: Template = { ...stored, page };

    expect(updated.page).toStrictEqual(stored.page);
  });

  it('strips an unknown key, so none of the four doors is a persistence boundary', () => {
    expect(Object.keys(parsePageSetup({ ...RECIPE_PAGE, bleed: 3 }))).toStrictEqual([
      'sheet',
      'margins',
      'header',
      'footer',
    ]);
  });
});

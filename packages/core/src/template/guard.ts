import { z } from 'zod/v4';
import {
  type BlockNode,
  BlockNodeSchema,
  type DocumentNode,
  DocumentNodeSchema,
} from '../ast/nodes.js';
import { InvalidShapeLimitsError, TemplateShapeError } from '../errors.js';
import { type Expression, ExpressionSchema } from '../expression/expression.js';
import { limitSchema, resolveLimits } from '../expression/limits.js';
import { PageSetupSchema } from '../page/page.js';

/**
 * Structural bounds for raw, untrusted JSON payloads before parsing.
 */
export interface ShapeLimits {
  /** Maximum nesting depth in JSON levels. */
  readonly maxDepth: number;
  /** Maximum total discovered values / nodes. */
  readonly maxNodes: number;
}

const shapeLimitsSchema = z.object({ maxDepth: limitSchema, maxNodes: limitSchema });

/** Default shape limits. */
export const DEFAULT_SHAPE_LIMITS: ShapeLimits = shapeLimitsSchema.parse({
  maxDepth: 64,
  maxNodes: 100_000,
});

/** Validates and resolves shape limits against defaults. */
export function resolveShapeLimits(limits?: Partial<ShapeLimits>): ShapeLimits {
  return resolveLimits(
    DEFAULT_SHAPE_LIMITS,
    shapeLimitsSchema,
    limits,
    (cause) =>
      new InvalidShapeLimitsError(
        'A shape limit must be a whole number between 1 and 1 000 000 000. Omit a field to take its default; a present but unusable value is refused rather than replaced, because `maxDepth: 0` disables the guard and `maxNodes: NaN` makes it run forever.',
        { cause },
      ),
  );
}

interface Frame {
  readonly value: unknown;
  readonly depth: number;
  readonly next: Frame | undefined;
}

function tooManyNodes(maxNodes: number): TemplateShapeError {
  return new TemplateShapeError(
    `A template may not carry more than ${maxNodes} values. Shared subtrees count every time they are reached, which is what makes this bound the guard's termination condition rather than a comfort.`,
    'too-many-nodes',
    maxNodes,
  );
}

const NOT_PLAIN_DATA =
  "A template must be plain data. A property defined by a getter or setter is refused: reading it would run the caller's code before validation, and it could return one value to the guard and another to the schema.";

/**
 * Iteratively asserts that a raw input payload stays within structural depth and node count bounds.
 * Prevents stack overflows and denial-of-service before running schema parsers.
 */
export function assertBoundedShape(raw: unknown, limits?: Partial<ShapeLimits>): void {
  const { maxDepth, maxNodes } = resolveShapeLimits(limits);
  let discovered = 1;
  let top: Frame | undefined = { value: raw, depth: 1, next: undefined };

  while (top !== undefined) {
    const frame: Frame = top;
    top = frame.next;
    const { value, depth } = frame;

    if (depth > maxDepth) {
      throw new TemplateShapeError(
        `A template may not nest more than ${maxDepth} levels deep. A cyclic payload lands here too, because a cycle exceeds every finite depth.`,
        'too-deep',
        maxDepth,
      );
    }

    if (value === null || typeof value !== 'object') {
      continue;
    }

    for (const child of childValuesOf(value, maxNodes - discovered, maxNodes)) {
      discovered += 1;
      top = { value: child, depth: depth + 1, next: top };
    }
  }
}

function* childValuesOf(
  value: object,
  remaining: number,
  maxNodes: number,
): Generator<unknown, void, undefined> {
  const keys: readonly (string | number)[] = Array.isArray(value)
    ? indicesOf(value.length, remaining, maxNodes)
    : Object.getOwnPropertyNames(value);

  if (keys.length > remaining) {
    throw tooManyNodes(maxNodes);
  }

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      continue;
    }
    if (!('value' in descriptor)) {
      throw new TemplateShapeError(NOT_PLAIN_DATA, 'not-plain-data', undefined);
    }

    const child: unknown = descriptor.value;
    yield child;
  }
}

function indicesOf(length: number, remaining: number, maxNodes: number): readonly number[] {
  if (length > remaining) {
    throw tooManyNodes(maxNodes);
  }
  return Array.from({ length }, (_unused, index) => index);
}

/** Parses and validates a standalone expression within safety shape bounds. */
export function parseExpression(raw: unknown, limits?: Partial<ShapeLimits>): Expression {
  assertBoundedShape(raw, limits);
  return ExpressionSchema.parse(raw);
}

/** Parses and validates a standalone document node within safety shape bounds. */
export function parseDocumentNode(raw: unknown, limits?: Partial<ShapeLimits>): DocumentNode {
  assertBoundedShape(raw, limits);
  return DocumentNodeSchema.parse(raw);
}

/** Parses and validates a standalone block node within safety shape bounds. */
export function parseBlockNode(raw: unknown, limits?: Partial<ShapeLimits>): BlockNode {
  assertBoundedShape(raw, limits);
  return BlockNodeSchema.parse(raw);
}

/** Parses and validates a standalone page setup within safety shape bounds. */
export function parsePageSetup(
  raw: unknown,
  limits?: Partial<ShapeLimits>,
): z.infer<typeof PageSetupSchema> {
  assertBoundedShape({ page: raw }, limits);
  return PageSetupSchema.parse(raw);
}

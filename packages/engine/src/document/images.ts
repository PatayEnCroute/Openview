import { z } from 'zod/v4';
import { refusal } from '../errors.js';
import { walkDocument } from './traverse.js';
import type { MaterialDocument } from './types.js';

/** One image the document references, named by the occurrence that reached it. */
export interface DocumentImage {
  /** Occurrence key of the block, unique inside one render. */
  readonly key: string;
  readonly nodeId: string;
  readonly path: readonly (string | number)[];
  /** Source exactly as the template declared it, never rewritten here. */
  readonly src: string;
}

/** What a session decided one occurrence should really load. */
export interface ResolvedDocumentImage {
  readonly key: string;
  readonly src: string;
}

/**
 * What a backend is allowed to answer an image resolution with.
 *
 * The type of `resolveImages` exists only at compile time, and the adapter behind it is somebody
 * else's code: a malformed answer has to become a refusal of this engine, not a `TypeError` from
 * the middle of a loop.
 */
const AnsweredImagesSchema: z.ZodType<readonly ResolvedDocumentImage[]> = z
  .array(z.strictObject({ key: z.string(), src: z.string() }).readonly())
  .readonly();

const MALFORMED =
  'The print backend answered the image resolution with something other than a list of resolved occurrences. The answer is refused whole rather than read in part.';

const MISSING =
  'The print backend answered the image resolution without an entry for an occurrence the document reaches. Read `details.nodeId` for the declaration left unresolved.';

const UNKNOWN =
  'The print backend answered the image resolution with an entry for an occurrence this document does not hold, or answered the same one twice. The table is refused whole rather than used in part.';

/**
 * Every image the document references, in paint order.
 *
 * A print backend supports a subset of what an `ImageNode` may declare, and the subset is a
 * capability of that backend rather than a rule of the contract. Handing the list over is what lets
 * a strategy refuse a source it cannot print before it loads anything.
 */
export function documentImages(document: MaterialDocument): readonly DocumentImage[] {
  const found: DocumentImage[] = [];
  for (const block of walkDocument(document)) {
    if (block.kind === 'image') {
      found.push({
        key: block.key,
        nodeId: block.nodeId,
        path: block.declarationPath,
        src: block.src,
      });
    }
  }
  return found;
}

/**
 * Turns a backend's answer into the table the html builders read.
 *
 * Checked whole before a single source is used: a missing, duplicated or foreign key would
 * otherwise become an image silently painted from the stored source, which is the one thing
 * resolving them was meant to prevent.
 *
 * `answered` is `unknown` because the type of `resolveImages` exists only at compile time and the
 * backend behind it is somebody else's code: this is the frontier where that answer becomes data
 * this engine has parsed.
 */
export function resolvedImageTable(
  asked: readonly DocumentImage[],
  answered: unknown,
): ReadonlyMap<string, string> {
  const parsed = AnsweredImagesSchema.safeParse(answered);
  if (!parsed.success) {
    throw refusal(MALFORMED, 'resource-policy-refused', { phase: 'resource' });
  }
  const table = new Map<string, string>();
  const wanted = new Map(asked.map((image) => [image.key, image]));
  for (const resolved of parsed.data) {
    if (!wanted.has(resolved.key) || table.has(resolved.key)) {
      throw refusal(UNKNOWN, 'resource-policy-refused', { phase: 'resource' });
    }
    table.set(resolved.key, resolved.src);
  }
  for (const image of asked) {
    if (!table.has(image.key)) {
      throw refusal(MISSING, 'resource-policy-refused', {
        phase: 'resource',
        nodeId: image.nodeId,
        path: image.path,
      });
    }
  }
  return table;
}

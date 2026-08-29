import {
  DOCUMENT_AREAS,
  DOCUMENT_REGIONS,
  DOCUMENT_RENDER_ERROR_CODES,
  DOCUMENT_RENDER_PHASES,
  DOCUMENT_RESOURCE_KINDS,
  DocumentRenderError,
  type DocumentRenderErrorDetails,
  type PdfLayoutMeasurement,
} from '@openview/engine';
import { z } from 'zod/v4';

/**
 * Version of the messages one worker and its parent exchange.
 *
 * Its own version, unrelated to the schema version of a stored document: a thread protocol changes
 * when the two sides of one build change, never when a template on disk does.
 */
export const WORKER_PROTOCOL_VERSION = 1;

const WORKER_FAILED =
  'The isolated worker of this render did not answer with a result this runtime understands. The original failure is deliberately not carried across the boundary: a message, a stack or a cause of unknown origin can hold the document or the data set.';

/**
 * The fields of a refusal that may cross the hostile boundary.
 *
 * `diagnostics`, `occurrence`, `cause` and `stack` stay behind on purpose. A diagnostic quotes the
 * operand that stopped an expression, an occurrence address counts iterations, and both would carry
 * the caller's data out of the isolate that was meant to contain it.
 */
const SafeDetailsSchema = z
  .strictObject({
    nodeId: z.string().optional(),
    path: z.array(z.union([z.string(), z.number()])).optional(),
    region: z.enum(DOCUMENT_AREAS).optional(),
    limit: z.number().optional(),
    observed: z.number().optional(),
    pageNumber: z.number().optional(),
    phase: z.enum(DOCUMENT_RENDER_PHASES).optional(),
    resourceKind: z.enum(DOCUMENT_RESOURCE_KINDS).optional(),
  })
  .readonly();

export type SafeErrorDetails = z.infer<typeof SafeDetailsSchema>;

const SafeErrorSchema = z
  .strictObject({
    code: z.enum(DOCUMENT_RENDER_ERROR_CODES),
    message: z.string(),
    details: SafeDetailsSchema,
  })
  .readonly();

export type SafeError = z.infer<typeof SafeErrorSchema>;

/**
 * Projects any failure onto the closed shape a message may carry.
 *
 * A refusal the engine typed keeps its code and its safe details. Anything else becomes one
 * constant sentence: an unknown error's message is written by whatever threw it, which on this
 * boundary means it may be written by the document.
 */
export function safeErrorOf(error: unknown): SafeError {
  if (!(error instanceof DocumentRenderError)) {
    return { code: 'render-worker-failed', message: WORKER_FAILED, details: {} };
  }
  const parsed = SafeDetailsSchema.safeParse(pickSafe(error.details));
  return {
    code: error.code,
    message: error.message,
    details: parsed.success ? parsed.data : {},
  };
}

function pickSafe(details: DocumentRenderErrorDetails): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  const keep = [
    'nodeId',
    'path',
    'region',
    'limit',
    'observed',
    'pageNumber',
    'phase',
    'resourceKind',
  ] as const;
  for (const key of keep) {
    const value = details[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  return picked;
}

/** Rebuilds a refusal on the parent side, with no cause to leak and no stack of the worker's. */
export function errorFrom(safe: SafeError): DocumentRenderError {
  return new DocumentRenderError(safe.message, safe.code, { ...safe.details });
}

const SheetSchema = z.strictObject({ width: z.number(), height: z.number() }).readonly();

const DocumentImageSchema = z
  .strictObject({
    key: z.string(),
    nodeId: z.string(),
    path: z.array(z.union([z.string(), z.number()])).readonly(),
    src: z.string(),
  })
  .readonly();

const ResolvedImageSchema = z.strictObject({ key: z.string(), src: z.string() }).readonly();

const SourceDocumentSchema = z
  .strictObject({
    html: z.string(),
    sheet: SheetSchema,
    images: z.array(ResolvedImageSchema).readonly(),
  })
  .readonly();

const BoxSchema = z.strictObject({ width: z.number(), height: z.number() }).readonly();

/**
 * The measurement one browser answers with, spelt out rather than trusted.
 *
 * The annotation is the check: a field the engine adds and this schema forgets stops compiling,
 * instead of arriving on the other side of the thread as `undefined`.
 */
export const LayoutMeasurementSchema: z.ZodType<PdfLayoutMeasurement> = z
  .strictObject({
    pages: z.array(
      z
        .strictObject({
          page: BoxSchema,
          printable: BoxSchema,
          regions: z.array(
            z
              .strictObject({
                region: z.enum(DOCUMENT_REGIONS),
                height: z.number(),
                contentHeight: z.number(),
              })
              .readonly(),
          ),
        })
        .readonly(),
    ),
    boxes: z.array(
      z.strictObject({ key: z.string(), width: z.number(), height: z.number() }).readonly(),
    ),
    lines: z.array(
      z
        .strictObject({
          key: z.string(),
          index: z.number(),
          run: z.number(),
          offset: z.number(),
          height: z.number(),
        })
        .readonly(),
    ),
    images: z.array(
      z
        .strictObject({
          nodeId: z.string(),
          decoded: z.boolean(),
          naturalWidth: z.number(),
          naturalHeight: z.number(),
          renderedWidth: z.number(),
          renderedHeight: z.number(),
        })
        .readonly(),
    ),
    escaping: z.array(z.string()),
    overflowingGridItems: z.array(z.string()),
    clippedMarkerCount: z.number(),
  })
  .readonly();

/** One operation the worker asks the browser side to perform, in the order a render needs them. */
export const SessionCallSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('open'),
    sheet: SheetSchema,
    images: z.array(DocumentImageSchema).readonly(),
  }),
  z.strictObject({ op: z.literal('resolve'), images: z.array(DocumentImageSchema).readonly() }),
  z.strictObject({ op: z.literal('measure'), document: SourceDocumentSchema }),
  z.strictObject({ op: z.literal('print'), document: SourceDocumentSchema }),
  z.strictObject({ op: z.literal('close') }),
]);

export type SessionCall = z.infer<typeof SessionCallSchema>;

const SessionReplySchema = z.union([
  z.strictObject({ ok: z.literal(true), value: z.unknown() }),
  z.strictObject({ ok: z.literal(false), error: SafeErrorSchema }),
]);

export type SessionReply = z.infer<typeof SessionReplySchema>;

const positive = z.number().int().positive();

/**
 * The engine options a hardened render may carry.
 *
 * Written out field by field rather than as an open record: an option the caller invents would
 * otherwise reach the engine unexamined, and the ceilings are the whole point of this boundary.
 */
export const WorkerEngineOptionsSchema = z
  .strictObject({
    shapeLimits: z
      .strictObject({ maxDepth: positive.optional(), maxNodes: positive.optional() })
      .optional(),
    evaluationLimits: z
      .strictObject({
        maxSteps: positive.optional(),
        maxDepth: positive.optional(),
        maxItemsVisited: positive.optional(),
        maxStringLength: positive.optional(),
      })
      .optional(),
    safetyLimits: z
      .strictObject({
        maxMaterializedUnits: positive.optional(),
        maxPages: positive.optional(),
        maxHtmlBytes: positive.optional(),
      })
      .optional(),
    presentationSelection: z.record(z.string(), z.string()).optional(),
  })
  .optional();

export type WorkerEngineOptions = z.infer<typeof WorkerEngineOptionsSchema>;

const TaskSchema = z.discriminatedUnion('format', [
  z.strictObject({
    format: z.literal('pdf'),
    template: z.unknown(),
    data: z.record(z.string(), z.unknown()),
    options: WorkerEngineOptionsSchema,
  }),
  z.strictObject({
    format: z.literal('pagination'),
    template: z.unknown(),
    data: z.record(z.string(), z.unknown()),
    options: WorkerEngineOptionsSchema,
  }),
]);

export type WorkerTask = z.infer<typeof TaskSchema>;

const envelope = <TShape extends z.ZodRawShape>(shape: TShape) =>
  z.strictObject({
    formatVersion: z.literal(WORKER_PROTOCOL_VERSION),
    generation: z.number().int().nonnegative(),
    ...shape,
  });

/** Messages the parent sends into a worker. */
export const ParentMessageSchema = z.discriminatedUnion('kind', [
  envelope({ kind: z.literal('start'), renderId: z.string(), task: TaskSchema }),
  envelope({
    kind: z.literal('reply'),
    renderId: z.string(),
    sequence: z.number().int().nonnegative(),
    reply: SessionReplySchema,
  }),
  envelope({ kind: z.literal('shutdown') }),
]);

export type ParentMessage = z.infer<typeof ParentMessageSchema>;

const OutcomeSchema = z.union([
  z.strictObject({ ok: z.literal(true), value: z.unknown() }),
  z.strictObject({ ok: z.literal(false), error: SafeErrorSchema }),
]);

export type WorkerOutcome = z.infer<typeof OutcomeSchema>;

/** Messages a worker sends back to its parent. */
export const WorkerMessageSchema = z.discriminatedUnion('kind', [
  envelope({ kind: z.literal('ready') }),
  envelope({
    kind: z.literal('call'),
    renderId: z.string(),
    sequence: z.number().int().nonnegative(),
    call: SessionCallSchema,
  }),
  envelope({ kind: z.literal('done'), renderId: z.string(), outcome: OutcomeSchema }),
]);

export type WorkerMessage = z.infer<typeof WorkerMessageSchema>;

/** Reads a message from the other side of the boundary, refusing anything unexpected. */
export function parseWorkerMessage(raw: unknown): WorkerMessage | undefined {
  const parsed = WorkerMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** Reads a parent message inside the worker, refusing anything unexpected. */
export function parseParentMessage(raw: unknown): ParentMessage | undefined {
  const parsed = ParentMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

import { assertBoundedShape, type EvaluationScope, parseTemplate } from '@openview/core';
import {
  createPaginationPort,
  createPdfRenderPort,
  type DocumentImage,
  DocumentRenderError,
  type DocumentRenderPhase,
  type PdfLayoutMeasurement,
  type PdfRenderResources,
  type PdfRenderSession,
  type PdfRenderStrategy,
  type PdfSourceDocument,
  type RenderEngineOptions,
  type ResolvedDocumentImage,
} from '@openview/engine';
import { z } from 'zod/v4';
import {
  errorFrom,
  LayoutMeasurementSchema,
  type SessionCall,
  safeErrorOf,
  type WorkerEngineOptions,
  type WorkerOutcome,
  type WorkerTask,
} from './protocol.js';

const BAD_REPLY =
  'The browser side of this render answered an operation with a value of the wrong shape. A measurement, a document or a resolution that cannot be read is a failure of the runtime, not of the document.';

/** The parent side of the boundary, as the worker sees it. */
export interface CallChannel {
  /** Sends one operation and resolves with what the parent answered. */
  call(call: SessionCall): Promise<unknown>;
}

const ResolvedSchema = z.array(z.strictObject({ key: z.string(), src: z.string() }));

function badReply(phase: DocumentRenderPhase): never {
  throw new DocumentRenderError(BAD_REPLY, 'render-worker-failed', { phase });
}

/**
 * The strategy the engine runs against inside a worker.
 *
 * Every operation a session performs is a message: the worker owns no browser, so a thread that is
 * terminated leaves no Chromium process behind for the parent to find.
 */
export function createProxyStrategy(channel: CallChannel): PdfRenderStrategy {
  return {
    format: 'pdf',
    async open(resources: PdfRenderResources): Promise<PdfRenderSession> {
      await channel.call({
        op: 'open',
        sheet: resources.sheet,
        images: resources.images.map(plainImage),
      });
      return {
        async resolveImages(
          images: readonly DocumentImage[],
        ): Promise<readonly ResolvedDocumentImage[]> {
          const answered = ResolvedSchema.safeParse(
            await channel.call({ op: 'resolve', images: images.map(plainImage) }),
          );
          if (!answered.success) {
            badReply('resource');
          }
          return answered.data;
        },
        async measure(document: PdfSourceDocument): Promise<PdfLayoutMeasurement> {
          const answered = LayoutMeasurementSchema.safeParse(
            await channel.call({ op: 'measure', document: plainDocument(document) }),
          );
          if (!answered.success) {
            badReply('measurement');
          }
          return answered.data;
        },
        async print(document: PdfSourceDocument): Promise<Uint8Array> {
          const answered = await channel.call({ op: 'print', document: plainDocument(document) });
          if (!(answered instanceof Uint8Array)) {
            badReply('export');
          }
          return answered;
        },
        async close(): Promise<void> {
          await channel.call({ op: 'close' });
        },
      };
    },
  };
}

const plainImage = (image: DocumentImage): DocumentImage => ({
  key: image.key,
  nodeId: image.nodeId,
  path: [...image.path],
  src: image.src,
});

const plainDocument = (document: PdfSourceDocument): PdfSourceDocument => ({
  html: document.html,
  sheet: { width: document.sheet.width, height: document.sheet.height },
  images: document.images.map((image) => ({ key: image.key, src: image.src })),
});

/** Drops the fields a caller left unset, which `exactOptionalPropertyTypes` distinguishes. */
function present(source: Readonly<Record<string, number | undefined>>): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      kept[key] = value;
    }
  }
  return kept;
}

/** Reads the validated options back into the shape the engine ports declare. */
export function engineOptionsOf(declared: WorkerEngineOptions): RenderEngineOptions {
  if (declared === undefined) {
    return {};
  }
  return {
    ...(declared.shapeLimits === undefined ? {} : { shapeLimits: present(declared.shapeLimits) }),
    ...(declared.evaluationLimits === undefined
      ? {}
      : { evaluationLimits: present(declared.evaluationLimits) }),
    ...(declared.safetyLimits === undefined
      ? {}
      : { safetyLimits: present(declared.safetyLimits) }),
    ...(declared.presentationSelection === undefined
      ? {}
      : { presentationSelection: declared.presentationSelection }),
  };
}

/**
 * Runs one task to its end and projects the result onto the closed outcome a message may carry.
 *
 * The template is bounded and parsed here, inside the isolate: a payload deep enough to exhaust a
 * stack takes the worker down rather than the runtime, and the parent replaces it.
 */
export async function runTask(task: WorkerTask, channel: CallChannel): Promise<WorkerOutcome> {
  try {
    const options = engineOptionsOf(task.options);
    assertBoundedShape(task.template, options.shapeLimits);
    const template = parseTemplate(task.template);
    const data: EvaluationScope = task.data;
    const strategy = createProxyStrategy(channel);
    if (task.format === 'pdf') {
      const result = await createPdfRenderPort(strategy, options).render({ template, data });
      return { ok: true, value: result.bytes };
    }
    const result = await createPaginationPort(strategy, options).paginate({ template, data });
    return { ok: true, value: result };
  } catch (error) {
    return { ok: false, error: safeErrorOf(error) };
  }
}

/** Rebuilds, on the worker side, a refusal the parent reported for one operation. */
export function replyFailure(error: unknown): DocumentRenderError {
  return error instanceof DocumentRenderError ? error : errorFrom(safeErrorOf(error));
}

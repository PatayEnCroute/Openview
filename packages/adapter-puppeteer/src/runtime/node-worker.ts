import { Worker } from 'node:worker_threads';
import type { ParentMessage } from './protocol.js';
import type { WorkerFactory, WorkerHandle, WorkerListeners } from './slot.js';

/** Where the compiled worker entry lives, next to this module in the published package. */
export const WORKER_ENTRY = new URL('./worker.js', import.meta.url);

/** What a worker thread is allowed to allocate. */
export interface WorkerResourceLimits {
  readonly oldSpaceMb: number;
  readonly stackMb: number;
}

/**
 * Wraps one Node worker thread behind the handle a slot uses.
 *
 * The listeners are replaced wholesale rather than added to: an accumulating listener would let a
 * previous render's handler be woken by the message of the next one, which is the failure the
 * generation counter exists to make impossible.
 */
function handleOf(worker: Worker): WorkerHandle {
  let listeners: WorkerListeners | undefined;
  worker.on('message', (raw: unknown) => {
    listeners?.onMessage(raw);
  });
  worker.on('error', (error: unknown) => {
    listeners?.onError(error);
  });
  worker.on('exit', (code: number) => {
    listeners?.onExit(code);
  });
  return {
    post(message: ParentMessage): void {
      worker.postMessage(message);
    },
    listen(next: WorkerListeners): void {
      listeners = next;
    },
    async terminate(): Promise<void> {
      /* Awaited, not fired and forgotten: a thread spinning in a synchronous loop is only really
         gone once this resolves, and a slot returned before that is capacity that does not exist. */
      await worker.terminate();
    },
  };
}

/**
 * Creates the worker factory of a real runtime.
 *
 * `resourceLimits` bounds the old generation of one v8 isolate. Node documents that it covers
 * neither array buffers nor external allocations, and it cannot cover Chromium at all, which is why
 * every other ceiling in this package is structural rather than a memory reading.
 */
export function createNodeWorkerFactory(
  limits: WorkerResourceLimits,
  entry: URL = WORKER_ENTRY,
): WorkerFactory {
  return {
    create(): Promise<WorkerHandle> {
      const worker = new Worker(entry, {
        resourceLimits: {
          maxOldGenerationSizeMb: limits.oldSpaceMb,
          stackSizeMb: limits.stackMb,
        },
      });
      return Promise.resolve(handleOf(worker));
    },
  };
}

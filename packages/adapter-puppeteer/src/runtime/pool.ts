import { AsyncResource } from 'node:async_hooks';
import {
  DocumentRenderError,
  type DocumentRenderErrorCode,
  type DocumentRenderPhase,
} from '@openview/engine';
import { type ProtectedRenderOutcome, publishRenderAudit } from './audit.js';
import type { WorkerTask } from './protocol.js';
import {
  type BrowserFactory,
  createRenderSlot,
  type RenderSlot,
  type WorkerFactory,
} from './slot.js';

const OVERLOADED =
  'This runtime has no free slot and no room left in its queue, so the render was refused at once rather than held. Read `details.limit` for the depth of the queue.';

const QUEUE_TIMEOUT =
  'This render waited for a slot longer than one request may. Read `details.limit` for the wait in milliseconds; no worker was ever woken for it.';

const CLOSED =
  'This runtime is closed. A closed runtime admits nothing and finishes only what it had already started.';

const NO_CAPACITY =
  'This runtime has lost every slot it owned: each of them failed to rebuild after a fault, and none can take a render. Nothing is held in the hope that one comes back, because none will.';

const CANCELLED =
  'This render was cancelled by its caller while it waited for a slot, so no worker was ever woken for it.';

/** Bounds on admission, waiting and execution. */
export interface PoolLimits {
  readonly slots: number;
  readonly queueDepth: number;
  readonly queueTimeoutMs: number;
  readonly renderTimeoutMs: number;
  readonly maxRendersPerWorker: number;
}

/** A task submitted to the pool. */
export interface PoolJob {
  readonly task: WorkerTask;
  readonly signal: AbortSignal | undefined;
}

/** The pool of slots one runtime owns. */
export interface RenderPool {
  submit(job: PoolJob): Promise<unknown>;
  close(): Promise<void>;
}

/** Milliseconds on a monotonic clock: a duration, never a date, and never the machine's calendar. */
const elapsed = (): number => Number(process.hrtime.bigint() / 1_000_000n);

function refusal(
  message: string,
  code: DocumentRenderErrorCode,
  limit?: number | undefined,
): DocumentRenderError {
  return new DocumentRenderError(message, code, {
    phase: 'admission',
    ...(limit === undefined ? {} : { limit }),
  });
}

function outcomeOf(error: unknown): ProtectedRenderOutcome {
  if (!(error instanceof DocumentRenderError)) {
    return 'failed';
  }
  switch (error.code) {
    case 'render-timeout':
      return 'timed-out';
    case 'render-cancelled':
      return 'cancelled';
    case 'render-worker-failed':
      return 'failed';
    default:
      return 'refused';
  }
}

const phaseOf = (error: unknown): DocumentRenderPhase =>
  error instanceof DocumentRenderError ? (error.details.phase ?? 'admission') : 'admission';

const codeOf = (error: unknown): DocumentRenderErrorCode | undefined =>
  error instanceof DocumentRenderError ? error.code : undefined;

interface Entry {
  readonly renderId: string;
  readonly job: PoolJob;
  readonly queuedAt: number;
  readonly resource: AsyncResource;
  settled: boolean;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  /** Drops the queue deadline and the abort listener this entry installed. */
  release(): void;
}

/**
 * Creates the pool of a runtime, with every slot already answering.
 *
 * The pool never launches a browser per incoming promise: a burst finds a bounded number of slots,
 * a bounded queue, and an immediate refusal past both. A queued entry holds only the copy the
 * runtime made of its input, never the caller's own object.
 */
export async function createRenderPool(
  workers: WorkerFactory,
  browsers: BrowserFactory,
  limits: PoolLimits,
): Promise<RenderPool> {
  const slots: RenderSlot[] = [];
  try {
    for (let at = 0; at < limits.slots; at += 1) {
      slots.push(
        await createRenderSlot(workers, browsers, {
          renderTimeoutMs: limits.renderTimeoutMs,
          maxRendersPerWorker: limits.maxRendersPerWorker,
        }),
      );
    }
  } catch (error) {
    /* A partially built pool owns threads and browsers nobody would ever close. */
    await Promise.all(slots.map(async (slot) => await slot.close()));
    throw error;
  }

  const free: RenderSlot[] = [...slots];
  /** The slots that are still capacity; a slot leaves this list when its rebuild failed. */
  const live = new Set<RenderSlot>(slots);
  const queue: Entry[] = [];
  const running = new Set<Promise<void>>();
  let issued = 0;
  let closing = false;
  /** Why the last slot was lost, carried as the cause of the refusals that follow it. */
  let lastFault: Error | undefined;

  /** The refusal a runtime with no slot left answers, with the failure that cost it the last one. */
  const exhausted = (): DocumentRenderError =>
    new DocumentRenderError(
      NO_CAPACITY,
      'render-capacity-exceeded',
      { phase: 'admission' },
      lastFault === undefined ? undefined : { cause: lastFault },
    );

  const audit = (
    entry: Entry,
    startedAt: number | undefined,
    outcome: ProtectedRenderOutcome,
    phase: DocumentRenderPhase,
    code: DocumentRenderErrorCode | undefined,
  ): void => {
    const ended = elapsed();
    publishRenderAudit({
      renderId: entry.renderId,
      outcome,
      phase,
      code,
      queueMs: (startedAt ?? ended) - entry.queuedAt,
      renderMs: startedAt === undefined ? 0 : ended - startedAt,
    });
  };

  const refuse = (entry: Entry, error: DocumentRenderError): void => {
    if (entry.settled) {
      return;
    }
    entry.settled = true;
    entry.release();
    audit(entry, undefined, outcomeOf(error), phaseOf(error), error.code);
    entry.reject(error);
  };

  const runOn = async (slot: RenderSlot, entry: Entry): Promise<void> => {
    const startedAt = elapsed();
    try {
      const value = await slot.run({
        renderId: entry.renderId,
        task: entry.job.task,
        signal: entry.job.signal,
      });
      audit(entry, startedAt, 'succeeded', 'export', undefined);
      entry.resolve(value);
    } catch (error) {
      audit(entry, startedAt, outcomeOf(error), phaseOf(error), codeOf(error));
      entry.reject(error);
    } finally {
      /* The caller has already been answered; the slot comes back only once its own cleanup is
         attested, and not at all when that cleanup could not be completed. */
      await slot.whenIdle();
      if (slot.usable) {
        free.push(slot);
      } else {
        live.delete(slot);
        lastFault = slot.fault ?? lastFault;
        /* A runtime with nothing left to run on says so at once rather than holding requests for
           a capacity that will not come back. */
        if (live.size === 0) {
          for (const waiting of queue.splice(0)) {
            refuse(waiting, exhausted());
          }
        }
      }
      pump();
    }
  };

  function start(slot: RenderSlot, entry: Entry): void {
    entry.settled = true;
    entry.release();
    const task = runOn(slot, entry);
    running.add(task);
    /* Deliberately not awaited: `submit` answers through the entry, not through this promise.
       `runOn` reports every outcome itself, and the `catch` is there so a fault of the pool's own
       bookkeeping cannot become an unhandled rejection. */
    void task
      .catch(() => undefined)
      .finally(() => {
        running.delete(task);
      });
  }

  function pump(): void {
    for (;;) {
      const slot = free[0];
      if (slot === undefined) {
        return;
      }
      const next = queue.shift();
      if (next === undefined) {
        return;
      }
      if (next.settled) {
        /* Refused while it waited: its place is simply given up, and the slot stays free. */
        continue;
      }
      free.shift();
      start(slot, next);
    }
  }

  return {
    submit(job: PoolJob): Promise<unknown> {
      issued += 1;
      const renderId = `r${issued}`;
      const queuedAt = elapsed();
      const resource = new AsyncResource('OpenviewProtectedRender');
      return new Promise<unknown>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const entry: Entry = {
          renderId,
          job,
          queuedAt,
          resource,
          settled: false,
          /* The caller's continuation runs in the context it submitted from, so a host tracing a
             request keeps its correlation across the pool without this package inventing one. */
          resolve: (value) => {
            resource.runInAsyncScope(resolve, undefined, value);
            resource.emitDestroy();
          },
          reject: (error) => {
            resource.runInAsyncScope(reject, undefined, error);
            resource.emitDestroy();
          },
          release: () => {
            if (timer !== undefined) {
              clearTimeout(timer);
              timer = undefined;
            }
            job.signal?.removeEventListener('abort', onAbort);
          },
        };

        function onAbort(): void {
          refuse(entry, refusal(CANCELLED, 'render-cancelled'));
        }

        if (closing) {
          refuse(entry, refusal(CLOSED, 'runtime-closed'));
          return;
        }
        if (job.signal?.aborted === true) {
          refuse(entry, refusal(CANCELLED, 'render-cancelled'));
          return;
        }
        const slot = free.shift();
        if (slot !== undefined) {
          start(slot, entry);
          return;
        }
        if (live.size === 0) {
          refuse(entry, exhausted());
          return;
        }
        if (queue.length >= limits.queueDepth) {
          refuse(entry, refusal(OVERLOADED, 'render-capacity-exceeded', limits.queueDepth));
          return;
        }
        timer = setTimeout(() => {
          refuse(entry, refusal(QUEUE_TIMEOUT, 'render-timeout', limits.queueTimeoutMs));
        }, limits.queueTimeoutMs);
        timer.unref();
        job.signal?.addEventListener('abort', onAbort, { once: true });
        queue.push(entry);
      });
    },
    async close(): Promise<void> {
      closing = true;
      /* Waiting entries are refused rather than started: a runtime that kept draining its queue
         after `close()` would never be finished. */
      for (const entry of [...queue]) {
        refuse(entry, refusal(CLOSED, 'runtime-closed'));
      }
      queue.length = 0;
      /* Active renders keep the deadline they were already given, and the handles are released
         only once every one of them has ended. */
      await Promise.allSettled([...running]);
      await Promise.all(slots.map(async (slot) => await slot.close()));
    },
  };
}

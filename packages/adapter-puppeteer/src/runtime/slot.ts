import {
  DocumentRenderError,
  type DocumentRenderErrorCode,
  type DocumentRenderPhase,
  type PdfRenderResources,
  type PdfRenderSession,
} from '@openview/engine';
import {
  errorFrom,
  type ParentMessage,
  parseWorkerMessage,
  type SessionCall,
  safeErrorOf,
  WORKER_PROTOCOL_VERSION,
  type WorkerTask,
} from './protocol.js';

const TIMED_OUT =
  'This render did not finish within the time one document may hold a slot. The worker was terminated and its browser context destroyed; read `details.limit` for the deadline in milliseconds and `details.phase` for where it stood.';

const CANCELLED =
  'This render was cancelled by its caller. The worker was terminated and its browser context destroyed, so nothing of it survives into the next render.';

const OUT_OF_MEMORY =
  'The isolated worker of this render exhausted the heap it was given. That ceiling bounds the old generation of one v8 isolate and neither array buffers nor the browser, so a host exposing this runtime still needs a process or container limit of its own.';

const WORKER_GONE =
  'The isolated worker of this render stopped before answering. Its slot is rebuilt before anything else is admitted to it.';

const PROTOCOL =
  'The isolated worker of this render answered outside the protocol, or from a generation this runtime has already replaced. The slot is destroyed rather than trusted.';

const NO_SESSION =
  'The isolated worker asked for an operation on a session that was never opened, or that this render had already closed.';

const SLOT_CLOSED = 'This runtime is closed, so the slot cannot take another render.';

/** The listeners a slot keeps on its worker; setting them replaces whatever was there. */
export interface WorkerListeners {
  readonly onMessage: (raw: unknown) => void;
  readonly onExit: (code: number) => void;
  readonly onError: (error: unknown) => void;
}

/** One live worker thread, as the slot uses it. */
export interface WorkerHandle {
  post(message: ParentMessage): void;
  /** Replaces every listener at once, so no round of a slot can be woken by the previous one. */
  listen(listeners: WorkerListeners): void;
  terminate(): Promise<void>;
}

/** Creates worker threads, injected so a fixture may answer in place of a real one. */
export interface WorkerFactory {
  create(): Promise<WorkerHandle>;
}

/** One live browser, as the slot uses it. */
export interface SlotBrowser {
  openContext(resources: PdfRenderResources): Promise<PdfRenderSession>;
  /** Closes the browser, reporting whether the shutdown could be proved. */
  close(): Promise<boolean>;
}

/** Creates browsers, injected for the same reason. */
export interface BrowserFactory {
  create(): Promise<SlotBrowser>;
}

/** Deadlines and recycling rules one slot lives under. */
export interface SlotLimits {
  readonly renderTimeoutMs: number;
  readonly maxRendersPerWorker: number;
}

/** What a slot was asked to do, and the identity it audits under. */
export interface SlotTask {
  readonly renderId: string;
  readonly task: WorkerTask;
  readonly signal: AbortSignal | undefined;
}

/** One worker, one browser, at most one render at a time. */
export interface RenderSlot {
  run(job: SlotTask): Promise<unknown>;
  close(): Promise<void>;
  /** How many times the worker, and possibly the browser, had to be rebuilt. */
  readonly generation: number;
  /**
   * Whether this slot is still capacity.
   *
   * A slot whose rebuild failed owns nothing it can prove; a pool that kept handing it work would
   * be advertising a capacity that does not exist.
   */
  readonly usable: boolean;
  /** What stopped this slot from rebuilding, when something did. */
  readonly fault: Error | undefined;
  /**
   * Resolves once the slot really is free again.
   *
   * A refused render is answered as soon as its cleanup is engaged, but its slot is still
   * rebuilding: a pool that counted it as capacity before this settles would be advertising a
   * place that is not there yet.
   */
  whenIdle(): Promise<void>;
}

function refusal(
  message: string,
  code: DocumentRenderErrorCode,
  phase: DocumentRenderPhase,
  limit?: number | undefined,
): DocumentRenderError {
  return new DocumentRenderError(message, code, {
    phase,
    ...(limit === undefined ? {} : { limit }),
  });
}

/** Node reports an exhausted worker heap through the error it emits, not through an exit code. */
function isOutOfMemory(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_WORKER_OUT_OF_MEMORY'
  );
}

function sessionOf(session: PdfRenderSession | undefined): PdfRenderSession {
  if (session === undefined) {
    throw refusal(NO_SESSION, 'render-worker-failed', 'cleanup');
  }
  return session;
}

/** Starts a worker and waits for its first message, so a slot is never handed out half-built. */
async function startWorker(workers: WorkerFactory): Promise<WorkerHandle> {
  const handle = await workers.create();
  await new Promise<void>((resolve, reject) => {
    handle.listen({
      onMessage: (raw) => {
        if (parseWorkerMessage(raw)?.kind === 'ready') {
          resolve();
        }
      },
      onError: (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
      onExit: () => {
        reject(refusal(WORKER_GONE, 'render-worker-failed', 'admission'));
      },
    });
  });
  return handle;
}

/**
 * Asks a worker to stop, then makes sure it has.
 *
 * The message is the graceful half: a worker that reads it closes its port and stops accepting
 * anything. `terminate` is the half that works on a thread which no longer reads its port at all,
 * and it is awaited because a slot returned before it is capacity that does not exist.
 */
async function stopWorker(handle: WorkerHandle): Promise<void> {
  handle.post({
    formatVersion: WORKER_PROTOCOL_VERSION,
    generation: 0,
    kind: 'shutdown',
  });
  await handle.terminate();
}

type Settled =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: Error };

/**
 * Creates one slot, with its worker and its browser already answering.
 *
 * A slot that cannot be built fails here rather than at its first client, which is why the whole
 * runtime is created asynchronously.
 */
export async function createRenderSlot(
  workers: WorkerFactory,
  browsers: BrowserFactory,
  limits: SlotLimits,
): Promise<RenderSlot> {
  let generation = 0;
  let renders = 0;
  let worker = await startWorker(workers);
  let browser = await browsers.create();
  let closed = false;
  /**
   * The rebuild in flight, if any.
   *
   * A refused render is answered as soon as its cleanup is engaged, so the promise the caller holds
   * does not wait on a browser relaunch. The slot itself is not free until this settles, which is
   * what `run` and `close` await.
   */
  let rebuilding: Promise<void> = Promise.resolve();
  /** Kept rather than swallowed: without it, a pool refusing for lack of capacity says only that. */
  let fault: Error | undefined;

  /**
   * Rebuilds whatever could not be proved, and only returns once the slot answers again.
   *
   * The worker is terminated rather than abandoned: a thread spinning in a synchronous loop keeps
   * its slot for ever otherwise, and a rejected promise is not a freed capacity.
   */
  const replace = async (browserToo: boolean): Promise<void> => {
    generation += 1;
    renders = 0;
    await stopWorker(worker);
    if (browserToo) {
      await browser.close();
      browser = await browsers.create();
    }
    worker = await startWorker(workers);
  };

  /** Releases everything this slot still owns, whatever state its rebuild reached. */
  const dispose = async (reason: unknown): Promise<void> => {
    closed = true;
    fault = reason instanceof Error ? reason : new Error(String(reason));
    /* Both are attempted, and a failure of one does not keep the other from being released. */
    await stopWorker(worker).catch(() => undefined);
    await browser.close().catch(() => undefined);
  };

  const runOne = async (job: SlotTask): Promise<unknown> => {
    const current = worker;
    const round = generation;
    let session: PdfRenderSession | undefined;
    /* Held separately from `session`: a deadline that fires while a context is still opening would
       otherwise leave that context orphaned in a browser this process keeps. */
    let opening: Promise<PdfRenderSession> | undefined;
    let phase: DocumentRenderPhase = 'transport';
    let broken = false;
    let browserSuspect = false;

    const perform = async (call: SessionCall): Promise<unknown> => {
      switch (call.op) {
        case 'open': {
          phase = 'resource';
          opening = browser.openContext({ sheet: call.sheet, images: call.images });
          session = await opening;
          opening = undefined;
          return undefined;
        }
        case 'resolve':
          phase = 'resource';
          return await sessionOf(session).resolveImages(call.images);
        case 'measure':
          phase = 'measurement';
          return await sessionOf(session).measure(call.document);
        case 'print':
          phase = 'export';
          return await sessionOf(session).print(call.document);
        case 'close': {
          phase = 'cleanup';
          const open = sessionOf(session);
          session = undefined;
          try {
            await open.close();
          } catch (error) {
            /* A context that will not close leaves the browser unprovable, whoever asked. */
            browserSuspect = true;
            throw error;
          }
          return undefined;
        }
        default: {
          const exhaustive: never = call;
          throw new TypeError(`Unhandled session call: ${String(exhaustive)}`);
        }
      }
    };

    let settle: ((result: Settled) => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = (): void => {
      broken = true;
      browserSuspect = true;
      settle?.({ ok: false, error: refusal(CANCELLED, 'render-cancelled', phase) });
    };

    const outcome = await new Promise<Settled>((resolve) => {
      let done = false;
      settle = (result: Settled): void => {
        if (done) {
          return;
        }
        done = true;
        resolve(result);
      };

      timer = setTimeout(() => {
        broken = true;
        browserSuspect = true;
        settle?.({
          ok: false,
          error: refusal(TIMED_OUT, 'render-timeout', phase, limits.renderTimeoutMs),
        });
      }, limits.renderTimeoutMs);
      timer.unref();
      job.signal?.addEventListener('abort', onAbort, { once: true });
      if (job.signal?.aborted === true) {
        /* A signal that fired while the slot was still being handed the task never reaches a
           listener registered after it, and the render would then run to its deadline. */
        onAbort();
      }

      current.listen({
        onExit: () => {
          broken = true;
          settle?.({ ok: false, error: refusal(WORKER_GONE, 'render-worker-failed', phase) });
        },
        onError: (error) => {
          broken = true;
          settle?.({
            ok: false,
            error: isOutOfMemory(error)
              ? refusal(OUT_OF_MEMORY, 'render-memory-limit-exceeded', phase)
              : refusal(WORKER_GONE, 'render-worker-failed', phase),
          });
        },
        onMessage: (raw) => {
          const message = parseWorkerMessage(raw);
          if (message?.kind === 'ready') {
            /* A fresh worker announces itself before it has been told which generation it serves,
               and the announcement terminates nothing, so it is simply not a round's business. */
            return;
          }
          if (message === undefined || message.generation !== round) {
            /* A message from a generation this runtime has replaced can no longer terminate
               anything: it would otherwise resolve the promise of whichever render took the slot
               next. */
            broken = true;
            settle?.({ ok: false, error: refusal(PROTOCOL, 'render-worker-failed', phase) });
            return;
          }
          if (message.kind === 'done') {
            settle?.(
              message.outcome.ok
                ? { ok: true, value: message.outcome.value }
                : { ok: false, error: errorFrom(message.outcome.error) },
            );
            return;
          }
          if (done) {
            /* The round is over: performing this would open a context after the cleanup that was
               meant to close it, and leave it in a browser this process keeps. A worker that
               answers late is terminated, not obeyed. */
            return;
          }
          const reply = (payload: ParentMessage): void => {
            if (!done) {
              current.post(payload);
            }
          };
          /* Deliberately not awaited: the listener stays synchronous, and the reply travels back as
             its own message on either path. */
          void perform(message.call).then(
            (value) => {
              reply({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation: round,
                kind: 'reply',
                renderId: job.renderId,
                sequence: message.sequence,
                reply: { ok: true, value },
              });
            },
            (error: unknown) => {
              reply({
                formatVersion: WORKER_PROTOCOL_VERSION,
                generation: round,
                kind: 'reply',
                renderId: job.renderId,
                sequence: message.sequence,
                reply: { ok: false, error: safeErrorOf(error) },
              });
            },
          );
        },
      });

      current.post({
        formatVersion: WORKER_PROTOCOL_VERSION,
        generation: round,
        kind: 'start',
        renderId: job.renderId,
        task: job.task,
      });
    });

    if (timer !== undefined) {
      clearTimeout(timer);
    }
    job.signal?.removeEventListener('abort', onAbort);

    if (session === undefined && opening !== undefined) {
      /* The deadline beat the opening: the context still has to be found and closed. */
      session = await opening.then(
        (open) => open,
        () => undefined,
      );
    }
    if (session !== undefined) {
      /* The context belongs to this process, so a terminated worker still leaves it closable. A
         cleanup that will not answer makes the browser unprovable, and it is replaced. */
      const orphan = session;
      session = undefined;
      const cleaned = await orphan.close().then(
        () => true,
        () => false,
      );
      browserSuspect = browserSuspect || !cleaned;
    }
    renders += 1;
    if (broken || browserSuspect || renders >= limits.maxRendersPerWorker) {
      rebuilding = replace(browserSuspect).catch(async (error: unknown) => {
        /* A slot that cannot be rebuilt is not a slot: it releases what it still owns and stops
           taking work, rather than leaving a browser nobody will ever close. The reason is kept on
           the slot, so a pool that runs out of capacity can say why. */
        await dispose(error);
      });
      if (outcome.ok) {
        /* A successful render waits for the slot it used to be whole again; a refusal does not,
           because its caller has already been kept waiting by the deadline that caused it. */
        await rebuilding;
      }
    }
    if (outcome.ok) {
      return outcome.value;
    }
    throw outcome.error;
  };

  return {
    get generation(): number {
      return generation;
    },
    get usable(): boolean {
      return !closed;
    },
    get fault(): Error | undefined {
      return fault;
    },
    async whenIdle(): Promise<void> {
      await rebuilding;
    },
    async run(job: SlotTask): Promise<unknown> {
      /* A slot whose previous render ended in a rebuild only takes work once that rebuild is
         attested, however the pool scheduled it. */
      await rebuilding;
      if (closed) {
        throw refusal(SLOT_CLOSED, 'runtime-closed', 'admission');
      }
      return await runOne(job);
    },
    async close(): Promise<void> {
      await rebuilding;
      if (closed) {
        return;
      }
      closed = true;
      await stopWorker(worker);
      await browser.close();
    },
  };
}

import { type CallChannel, replyFailure, runTask } from './handler.js';
import {
  errorFrom,
  parseParentMessage,
  type SessionCall,
  safeErrorOf,
  WORKER_PROTOCOL_VERSION,
  type WorkerOutcome,
} from './protocol.js';

/** The side of a message port this wiring needs, so a test may hand it a plain channel. */
export interface WorkerPort {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (raw: unknown) => void): void;
  close(): void;
}

/**
 * Wires one worker thread to its parent, and announces itself.
 *
 * Every session operation leaves as a `call` and comes back as a `reply`, so the thread owns no
 * browser at all: terminating it leaves nothing behind for the parent to find.
 */
export function attachWorker(port: WorkerPort): void {
  let generation = 0;
  let sequence = 0;
  const pending = new Map<number, (value: unknown) => void>();
  const failures = new Map<number, (error: unknown) => void>();

  const channelFor = (renderId: string): CallChannel => ({
    call(call: SessionCall): Promise<unknown> {
      sequence += 1;
      const at = sequence;
      return new Promise<unknown>((resolve, reject) => {
        pending.set(at, resolve);
        failures.set(at, reject);
        port.postMessage({
          formatVersion: WORKER_PROTOCOL_VERSION,
          generation,
          kind: 'call',
          renderId,
          sequence: at,
          call,
        });
      });
    },
  });

  port.on('message', (raw: unknown) => {
    const message = parseParentMessage(raw);
    if (message === undefined) {
      return;
    }
    if (message.kind === 'shutdown') {
      port.close();
      return;
    }
    if (message.kind === 'reply') {
      const resolve = pending.get(message.sequence);
      const reject = failures.get(message.sequence);
      pending.delete(message.sequence);
      failures.delete(message.sequence);
      if (message.reply.ok) {
        resolve?.(message.reply.value);
      } else {
        reject?.(replyFailure(errorFrom(message.reply.error)));
      }
      return;
    }
    generation = message.generation;
    const answer = (outcome: WorkerOutcome): void => {
      port.postMessage({
        formatVersion: WORKER_PROTOCOL_VERSION,
        generation,
        kind: 'done',
        renderId: message.renderId,
        outcome,
      });
    };
    /* Deliberately not awaited: the message handler stays synchronous, and the task reports its own
       outcome through `done`. Both settlements are answered, so a thread that failed where nothing
       expected it to still ends its render rather than going silent. */
    void runTask(message.task, channelFor(message.renderId)).then(answer, (error: unknown) => {
      answer({ ok: false, error: safeErrorOf(error) });
    });
  });

  port.postMessage({ formatVersion: WORKER_PROTOCOL_VERSION, generation: 0, kind: 'ready' });
}

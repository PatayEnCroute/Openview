import { parentPort } from 'node:worker_threads';
import { attachWorker } from './attach.js';

/**
 * The entry point of one isolated render thread.
 *
 * Nothing but the handshake with `worker_threads` lives here: the wiring is in `attach.ts` and the
 * engine in `handler.ts`, both of which run in process and can be measured. A thread cannot be
 * instrumented from the one that spawned it, so this file is kept to what a spawn really needs.
 */
if (parentPort === null) {
  throw new Error('This module is the entry point of a worker thread and has no main-thread use.');
}

attachWorker(parentPort);

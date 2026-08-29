import { parentPort } from 'node:worker_threads';

/**
 * A worker that answers `ready` and then never answers anything else.
 *
 * It blocks the thread synchronously, the way a costly expression would, so a parent that only
 * raced a promise would leave this thread running for ever while reporting a timeout.
 */
parentPort?.on('message', () => {
  for (;;) {
    /* Deliberately empty: the point is that this thread never yields to its event loop again. */
  }
});

parentPort?.postMessage({ formatVersion: 1, generation: 0, kind: 'ready' });

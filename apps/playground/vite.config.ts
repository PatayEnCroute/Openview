import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The port the tooling assigned, or none.
 *
 * `.claude/launch.json` sets `autoPort`, which hands the dev server a free port
 * through `PORT` -- and Vite does not read that variable on its own, so without
 * this the assignment is silently ignored and the preview points at a port
 * nothing is listening on.
 *
 * `strictPort` goes with it deliberately: Vite's default is to walk up from a
 * busy port, which would put the server somewhere the caller was never told
 * about. When a port has been assigned, failing loudly beats drifting quietly.
 *
 * Reading the environment is fine HERE and nowhere near `core` or `engine`: this
 * is build tooling, and the `no-environment-read` plugin is scoped to those two
 * packages precisely because they must produce the same document twice.
 */
const assignedPort = Number(process.env.PORT);
const server =
  Number.isInteger(assignedPort) && assignedPort > 0
    ? { port: assignedPort, strictPort: true }
    : {};

export default defineConfig({
  plugins: [react()],
  server,
});

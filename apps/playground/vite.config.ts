import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {
  type BridgeResponse,
  CATALOG_ROUTE,
  catalogResponse,
  RENDER_ROUTE,
  renderResponse,
} from './dev/render-bridge.js';

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

/**
 * Mounts the two local render routes on the DEV server only.
 *
 * `apply: 'serve'` is what keeps `vite build` free of the engine, the adapter and Chromium: the
 * plugin -- and therefore the only import of `@openview/adapter-puppeteer` in this app -- exists
 * during `pnpm dev` and nowhere else. The logic itself lives in `dev/render-bridge.ts`, which has
 * its own TypeScript pass, so this config never becomes an untested server.
 */
function openviewRenderBridge(): Plugin {
  return {
    name: 'openview-render-bridge',
    apply: 'serve',
    configureServer(vite) {
      vite.middlewares.use(CATALOG_ROUTE, (_request, response) => {
        send(response, catalogResponse());
      });
      vite.middlewares.use(RENDER_ROUTE, (request, response) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', () => {
          /* Deliberately not awaited: a Node request handler returns nothing, and the promise
             settles by writing the response itself. */
          void renderResponse(request.method ?? 'GET', Buffer.concat(chunks).toString('utf8'))
            .then((result) => {
              send(response, result);
            })
            .catch((error: unknown) => {
              console.error('[openview] the render bridge threw outside its own handler', error);
              send(response, {
                status: 500,
                headers: { 'content-type': 'application/json; charset=utf-8' },
                body: '{"code":"unexpected","message":"The render failed."}',
              });
            });
        });
      });
    },
  };
}

function send(
  response: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (body: string | Uint8Array) => void;
  },
  result: BridgeResponse,
): void {
  response.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) {
    response.setHeader(name, value);
  }
  response.end(result.body);
}

export default defineConfig({
  plugins: [react(), openviewRenderBridge()],
  server,
});

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {
  type BridgeResponse,
  CATALOG_ROUTE,
  catalogResponse,
  RENDER_ROUTE,
  renderResponse,
} from './dev/render-bridge.js';

/** Port assigned from environment variables if defined. */
const port = process.env.PORT ? Number(process.env.PORT) : undefined;
const server = port && Number.isInteger(port) && port > 0 ? { port: port, strictPort: true } : {};

/**
 * Mounts the two local render routes on the DEV server only.
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

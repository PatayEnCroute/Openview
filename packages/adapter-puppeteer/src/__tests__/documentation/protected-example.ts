/**
 * The hardened-path example the guide quotes, compiled and run like the direct one.
 *
 * Separate module rather than a second region of `example.ts`: an example a reader copies has to
 * carry its own imports.
 */

// #region untrusted
import {
  createPuppeteerRenderRuntime,
  type PuppeteerRenderRuntimeOptions,
} from '@openview/adapter-puppeteer';
import type { RenderRequest } from '@openview/core';

/** A service builds one runtime and keeps it; the three gestures are shown here in order. */
export async function renderUntrusted(
  options: PuppeteerRenderRuntimeOptions,
  request: RenderRequest,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const runtime = await createPuppeteerRenderRuntime(options);
  try {
    const { bytes } = await runtime.pdf.render(request, { signal });
    return bytes;
  } finally {
    await runtime.close();
  }
}
// #endregion untrusted

import puppeteer, { type Browser } from 'puppeteer';

/** Launch settings a host may need to pin, shared by the direct path and the hardened runtime. */
export interface PuppeteerLaunchOptions {
  /** Chromium executable, when the host pins its own build instead of the downloaded one. */
  readonly executablePath?: string | undefined;
  /** Extra launch arguments, for a sandbox a container needs configured differently. */
  readonly args?: readonly string[] | undefined;
}

/** Launches a headless browser under the caller's pinned settings. */
export async function launchBrowser(
  options?: PuppeteerLaunchOptions | undefined,
): Promise<Browser> {
  return await puppeteer.launch({
    headless: true,
    ...(options?.executablePath === undefined ? {} : { executablePath: options.executablePath }),
    ...(options?.args === undefined ? {} : { args: [...options.args] }),
  });
}

/**
 * The part of a browser a shutdown needs, which Puppeteer's `Browser` satisfies.
 *
 * Named rather than assumed, so the shutdown itself can be measured without a Chromium.
 */
export interface ClosableBrowser {
  close(): Promise<void>;
  process(): { kill(signal?: NodeJS.Signals): boolean } | null;
}

/** Resolves to `false` once `ms` have passed, without holding the process open. */
function deadline(ms: number): { readonly reached: Promise<false>; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reached = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, ms);
    timer.unref();
  });
  return {
    reached,
    cancel(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Closes a browser, and kills it when the close does not answer in time.
 *
 * Reports whether the graceful close succeeded. A shutdown that hangs is not a shutdown: leaving it
 * would keep a Chromium process, its sockets and its profile directory alive for the lifetime of
 * the host, so the caller must treat a `false` as a slot it can no longer prove.
 */
export async function closeBrowser(browser: ClosableBrowser, shutdownMs: number): Promise<boolean> {
  const timeout = deadline(shutdownMs);
  const closed = await Promise.race([
    browser
      .close()
      .then(() => true)
      /* The failure itself is the answer the caller acts on: a browser that refused to close is
         replaced rather than reused. */
      .catch(() => false),
    timeout.reached,
  ]);
  timeout.cancel();
  if (closed) {
    return true;
  }
  /* Last resort, and the reason the graceful path has a deadline at all. `kill` reports a failure
     rather than throwing when the process is already gone, which is the outcome this wanted. */
  browser.process()?.kill('SIGKILL');
  return false;
}

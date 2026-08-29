import { describe, expect, it } from 'vitest';
import { type ClosableBrowser, closeBrowser } from '../browser.js';

/** A browser whose shutdown behaves the way a test names, without a Chromium behind it. */
function fakeBrowser(behaviour: {
  readonly close: 'resolves' | 'rejects' | 'hangs';
  readonly gone?: boolean | undefined;
}): { readonly browser: ClosableBrowser; killed: () => number } {
  let killed = 0;
  return {
    killed: () => killed,
    browser: {
      close(): Promise<void> {
        if (behaviour.close === 'rejects') {
          return Promise.reject(new Error('the browser will not close'));
        }
        if (behaviour.close === 'hangs') {
          return new Promise<void>(() => undefined);
        }
        return Promise.resolve();
      },
      process(): { kill(): boolean } | null {
        if (behaviour.gone === true) {
          return null;
        }
        return {
          kill(): boolean {
            killed += 1;
            return true;
          },
        };
      },
    },
  };
}

describe('closing a browser this process owns', () => {
  it('reports a graceful shutdown, and kills nothing', async () => {
    const fake = fakeBrowser({ close: 'resolves' });
    await expect(closeBrowser(fake.browser, 1_000)).resolves.toBe(true);
    expect(fake.killed()).toBe(0);
  });

  it('kills the process when the shutdown refuses', async () => {
    const fake = fakeBrowser({ close: 'rejects' });
    /* The failure is the answer: a browser that refused to close is replaced, not reused. */
    await expect(closeBrowser(fake.browser, 1_000)).resolves.toBe(false);
    expect(fake.killed()).toBe(1);
  });

  it('kills the process when the shutdown never answers', async () => {
    const fake = fakeBrowser({ close: 'hangs' });
    /* A shutdown that hangs is not a shutdown: the process, its sockets and its profile directory
       would outlive the render that made them. */
    await expect(closeBrowser(fake.browser, 20)).resolves.toBe(false);
    expect(fake.killed()).toBe(1);
  });

  it('reports the failure even when the process is already gone', async () => {
    const fake = fakeBrowser({ close: 'rejects', gone: true });
    await expect(closeBrowser(fake.browser, 1_000)).resolves.toBe(false);
    expect(fake.killed()).toBe(0);
  });
});

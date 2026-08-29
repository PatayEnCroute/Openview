import { describe, expect, it } from 'vitest';

describe('the worker entry, loaded outside a thread', () => {
  it('refuses to run rather than attaching to nothing', async () => {
    /* A module that silently did nothing here would make a misconfigured pool look healthy until
       its first render never answered. */
    await expect(import('../worker.js')).rejects.toThrow('worker thread');
  });
});

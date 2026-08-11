import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index.js';

describe('@openview/engine public surface', () => {
  it('exposes its version as a semver string', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

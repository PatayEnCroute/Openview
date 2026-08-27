/**
 * Removes build artifacts (dist and tsconfig.tsbuildinfo) for a workspace package.
 */
import { rmSync } from 'node:fs';

for (const target of ['dist', 'tsconfig.tsbuildinfo']) {
  rmSync(target, { recursive: true, force: true });
}

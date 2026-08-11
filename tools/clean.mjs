/**
 * Removes a package's build output. Invoked as `node ../../tools/clean.mjs` from
 * each workspace package, all of which sit exactly two levels below the root.
 *
 * tsconfig.tsbuildinfo matters as much as dist/: it lives beside the config, not
 * inside outDir, so deleting only dist/ leaves tsc believing it is up to date.
 * It then emits nothing on the next build and exits 0, producing an empty dist
 * that fails downstream resolution with no visible error.
 */
import { rmSync } from 'node:fs';

for (const target of ['dist', 'tsconfig.tsbuildinfo']) {
  rmSync(target, { recursive: true, force: true });
}

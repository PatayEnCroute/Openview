/**
 * The single Vitest config for the monorepo.
 *
 * It deliberately lives at the root rather than one per package, because the LCOV
 * report is only usable from here. A per-package run writes `SF:src/index.ts`
 * paths, relative to that package; Sonar resolves `SF` against `sonar.projectBaseDir`
 * -- the repository root -- so it looked for `<root>/src/index.ts`, found nothing,
 * and recorded 0% for every file while the scan stayed green. Worse, core and engine
 * both emitted the identical `SF:src/index.ts`, so even a suffix match was ambiguous.
 * Running once from here emits `SF:packages/core/src/index.ts`, which resolves.
 *
 * Being a real `vitest.config.ts` also puts this object under the compiler. The
 * previous shared config was a plain literal in `tools/`, exported from a file where
 * `vitest` was not resolvable and included in no tsconfig, so `thresholds` misspelt
 * as `threshold` type-checked clean and silently disabled the coverage gate with
 * every CI gate still green. `tsconfig.tooling.json` now type-checks this file, and
 * `defineConfig` rejects an unknown key.
 */
import { defineConfig } from 'vitest/config';

/** 90% on every metric. Spelt once, applied globally and per package below. */
const THRESHOLD = { lines: 90, functions: 90, branches: 90, statements: 90 };

export default defineConfig({
  test: {
    // A glob, not a list: a new package is picked up without editing this file.
    projects: ['packages/*'],
    // `.tsx` matters. The previous glob ended in `.ts`, so a `Widget.test.tsx` in
    // the two React packages was silently never collected -- and `coverage.include`
    // had the same gap, so `.tsx` sources were never instrumented either. Both
    // spellings of both extensions are covered here and in the coverage globs.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      // Without `include`, v8 only instruments files a test imported, so a package
      // with one tested function and ten untested ones still reported 100%.
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['packages/*/src/**/*.{test,spec}.{ts,tsx}', 'packages/*/src/**/*.d.ts'],
      thresholds: {
        // The global floor alone is not enough: core carries ~150 statements at
        // 100%, which is sufficient to hold the aggregate above 90% no matter how
        // much untested code lands in a sibling. AGENTS.md 5 requires a test per
        // function in core and engine, so those two are gated individually.
        ...THRESHOLD,
        'packages/core/src/**': THRESHOLD,
        'packages/engine/src/**': THRESHOLD,
      },
    },
  },
});

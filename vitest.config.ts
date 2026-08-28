/**
 * Central Vitest configuration for the Openview monorepo.
 *
 * Configures cross-package test execution and enforces the strict 90% coverage threshold.
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
      exclude: [
        'packages/*/src/**/*.{test,spec}.{ts,tsx}',
        'packages/*/src/**/*.d.ts',
        // `measure.ts` is serialised and evaluated inside Chromium, so v8 running
        // in Node cannot instrument it and never will: it reported 0% by
        // construction, and left the whole adapter under any floor worth setting.
        // It is excluded only because it now holds nothing but DOM collection --
        // every decision it used to make about line boundaries, overflow and the
        // sub-pixel tolerance moved to `derive.ts`, which is gated below. Moving
        // arithmetic back into it would put that arithmetic beyond measurement
        // again; that, and not the exclusion, is what a reviewer must refuse.
        'packages/adapter-puppeteer/src/measure.ts',
      ],
      thresholds: {
        // The global floor alone is not enough: core carries ~150 statements at
        // 100%, which is sufficient to hold the aggregate above 90% no matter how
        // much untested code lands in a sibling. AGENTS.md 5 requires a test per
        // function in core and engine, so those two are gated individually.
        ...THRESHOLD,
        'packages/core/src/**': THRESHOLD,
        'packages/engine/src/**': THRESHOLD,
        // The adapter carries the arithmetic that decides where pages are cut.
        // It had no floor while that arithmetic was unreachable from Node.
        'packages/adapter-puppeteer/src/**': THRESHOLD,
      },
    },
  },
});

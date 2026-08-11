/**
 * Shared Vitest settings for every Openview package.
 *
 * Exported as a plain object rather than through `defineConfig` on purpose: this
 * file lives outside any workspace package, so `vitest` is not resolvable from
 * here. Each package wraps it with its own `defineConfig`.
 *
 * `coverage.include` is the important line. Without it the v8 provider only
 * instruments files a test actually imported, so a package with one tested
 * function and ten untested ones still reports 100%.
 */
export const baseTestConfig = {
  test: {
    // Both suffixes, and they must stay in sync with `coverage.exclude` below.
    // Matching only `.test.ts` meant a `.spec.ts` file was never executed while
    // still being counted as uncovered production code.
    include: ['src/**/*.{test,spec}.ts'],
    // Packages whose implementation has not landed yet must not break CI. Coverage
    // thresholds below start biting the moment a first test file appears.
    passWithNoTests: true,
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
};

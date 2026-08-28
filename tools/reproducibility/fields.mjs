/**
 * The fields a reproducibility profile must carry. A manifest missing one attests nothing.
 *
 * Its own module, importing nothing, because the comparator must run on a checkout that was never
 * installed and never built: its whole job is to read two JSON files. Reaching the catalogue from
 * here would drag `packages/engine/dist` into a job that has no reason to build it.
 */
export const PROFILE_FIELDS = [
  'platform',
  'architecture',
  'node',
  'v8',
  'icu',
  'unicode',
  'engine',
  'adapter',
  'puppeteer',
  'chromium',
  'fonts',
  'pdfCanonicalizer',
  'launchArguments',
];

/**
 * The reproducibility profile: everything two renders must share before their bytes are comparable.
 *
 * Two builds carrying two ICU versions can write two different space characters, so comparing
 * their output would say nothing about the engine. The comparator therefore refuses two different
 * profiles before it looks at a single digest.
 *
 * This file observes the environment on purpose -- it decides whether two runs are comparable --
 * and lives outside `core` and `engine`, which are forbidden from reading any of it.
 */
import { createRequire } from 'node:module';
import { BUNDLED_FACES } from '../../packages/engine/dist/document/fonts/catalogue.js';

/* Re-exported for the producer, which needs both halves; the comparator imports the list straight
   from `fields.mjs` so it never reaches the built catalogue above. */
export { PROFILE_FIELDS } from './fields.mjs';

/* Anchored at the adapter rather than at this file: `tools/` is not a workspace package, so pnpm
   installs nothing beside it and a bare specifier would not resolve here. */
export const fromAdapter = createRequire(
  new URL('../../packages/adapter-puppeteer/package.json', import.meta.url),
);

const require = fromAdapter;

/** Version of the pdf canonicaliser this build ships. Bumped whenever its output changes. */
const PDF_CANONICALIZER = 1;

const versionOf = (name) => require(`${name}/package.json`).version;

/**
 * Builds the profile of the machine and the build this process is running.
 *
 * `chromium` is asked of the browser itself rather than guessed from a pin: what matters is the
 * engine that laid the document out, not the version a manifest claims it should have been.
 */
export async function profileOf(browser, launchArguments) {
  return {
    platform: process.platform,
    architecture: process.arch,
    node: process.versions.node,
    v8: process.versions.v8,
    icu: process.versions.icu ?? 'none',
    unicode: process.versions.unicode ?? 'none',
    engine: versionOf('@openview/engine'),
    adapter: versionOf('@openview/adapter-puppeteer'),
    puppeteer: versionOf('puppeteer'),
    chromium: await browser.version(),
    fonts: BUNDLED_FACES.map((face) => ({
      id: `${face.family} ${face.weight} ${face.style}`,
      sha256: face.sha256,
    })),
    pdfCanonicalizer: PDF_CANONICALIZER,
    launchArguments: [...launchArguments].sort(),
  };
}

/**
 * The profile written with its keys in a fixed order.
 *
 * Insertion order would make two equal profiles serialise to two different strings, and the
 * comparator would then reject a pair of runs that were in fact comparable.
 */
export function serializeProfile(profile) {
  return JSON.stringify(
    {
      platform: profile.platform,
      architecture: profile.architecture,
      node: profile.node,
      v8: profile.v8,
      icu: profile.icu,
      unicode: profile.unicode,
      engine: profile.engine,
      adapter: profile.adapter,
      puppeteer: profile.puppeteer,
      chromium: profile.chromium,
      fonts: profile.fonts.map((font) => ({ id: font.id, sha256: font.sha256 })),
      pdfCanonicalizer: profile.pdfCanonicalizer,
      launchArguments: profile.launchArguments,
    },
    null,
    2,
  );
}

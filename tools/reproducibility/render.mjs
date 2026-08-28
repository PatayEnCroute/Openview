/**
 * Renders the reference statement ten times and writes a manifest of what came out.
 *
 * Usage: node tools/reproducibility/render.mjs <output.json> [--no-sandbox]
 *
 * The manifest carries the profile and, per render, a length and a SHA-256 -- never a pdf and never
 * a byte of the data set. Two of these files, produced on two machines, are what `compare.mjs`
 * reads: publishing the documents themselves would leak a recipe into a build artefact for nothing.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  APPEARANCES,
  referenceDocument,
  SIXTY_ROWS,
} from '../../packages/adapter-puppeteer/dist/__tests__/reference-document.js';
import { createPuppeteerPdfStrategy } from '../../packages/adapter-puppeteer/dist/index.js';
import { createPaginationPort, createPdfRenderPort } from '../../packages/engine/dist/index.js';
import { fromAdapter, profileOf, serializeProfile } from './profile.mjs';

const puppeteer = fromAdapter('puppeteer').default ?? fromAdapter('puppeteer');

/** Ten, as the acceptance criterion of the lot states. */
const TIMES = 10;

const [output, ...flags] = process.argv.slice(2);
if (output === undefined) {
  throw new Error('usage: node tools/reproducibility/render.mjs <output.json> [--no-sandbox]');
}

/**
 * The launch arguments this run really used.
 *
 * Production passes none. A container may need `--no-sandbox`, and both legs of a comparison must
 * then carry exactly the same list -- which is why it travels in the profile.
 */
const launchArguments = flags.filter((flag) => flag.startsWith('--'));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/* The official profile launches the browser Puppeteer downloaded: no `executablePath` is passed,
   because Puppeteer only warrants its own build and a local Chrome is not what E6 attests. */
const options = launchArguments.length === 0 ? {} : { args: launchArguments };

const probe = await puppeteer.launch({ headless: true, ...options });
let profile;
try {
  profile = await profileOf(probe, launchArguments);
} finally {
  await probe.close();
}

const strategy = createPuppeteerPdfStrategy(options);
const engine = createPdfRenderPort(strategy);
const pagination = createPaginationPort(strategy);

const renders = [];
for (const appearance of APPEARANCES) {
  const template = referenceDocument(appearance);
  const pdf = [];
  for (let run = 0; run < TIMES; run += 1) {
    const result = await engine.render({ template, data: SIXTY_ROWS });
    pdf.push({ bytes: result.bytes.length, sha256: sha256(result.bytes) });
  }
  /* The published source is compared too: E6 stabilises what the viewer is handed, not only what
     the printer produces. */
  const paginated = await pagination.paginate({ template, data: SIXTY_ROWS });
  renders.push({
    document: appearance.name,
    pages: paginated.pages.length,
    html: { bytes: Buffer.byteLength(paginated.html, 'utf8'), sha256: sha256(paginated.html) },
    pdf,
  });
}

writeFileSync(
  output,
  `${JSON.stringify({ profile: JSON.parse(serializeProfile(profile)), renders }, null, 2)}\n`,
  'utf8',
);

for (const render of renders) {
  const digests = new Set(render.pdf.map((one) => one.sha256));
  console.log(
    `${render.document}: ${render.pages} pages, ${render.pdf.length} renders, ${digests.size} distinct digest(s)`,
  );
  if (digests.size !== 1) {
    throw new Error(`${render.document} did not render identically ${TIMES} times in this process`);
  }
}
console.log(`profile: node ${profile.node}, icu ${profile.icu}, ${profile.chromium}`);
console.log(`wrote ${output}`);

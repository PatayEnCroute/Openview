/**
 * Renders the six E7 scenarios into a candidate batch.
 *
 * Usage: node tools/golden/render.mjs <directory> [--no-sandbox]
 *
 * Writes nothing but into the directory it was given, and only when the whole batch came out. A
 * generator that left six files behind after failing on the fourth would let a partial batch be
 * mistaken for a reference, which is the one thing the tracked corpus must never become.
 *
 * Both public facades are called, in this order and one document at a time: the pagination port for
 * the html and the E5 certificates, then the pdf port for the document a client receives. Two
 * sessions per scenario is the honest price of testing two contracts; pooling belongs to E8.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createPuppeteerPdfStrategy } from '../../packages/adapter-puppeteer/dist/index.js';
import {
  createPaginationPort,
  createPdfRenderPort,
  DocumentRenderError,
} from '../../packages/engine/dist/index.js';
import { fromAdapter, profileOf } from '../reproducibility/profile.mjs';
import { recordOf, textRecordOf } from './canonical-json.mjs';
import { CORPUS, inputDigestOf, storedTemplateDigestOf } from './corpus.mjs';
import {
  FORMAT_VERSION,
  GENERATOR_VERSION,
  MANIFEST_FILENAME,
  REFERENCES_DIRECTORY,
  serializeManifest,
} from './manifest.mjs';
import {
  certificateOf,
  extractPage,
  noticesCertificateOf,
  PAGE_EXTRACTOR_VERSION,
  pageCountOf,
  sheetCertificateOf,
} from './pages.mjs';

const puppeteer = fromAdapter('puppeteer').default ?? fromAdapter('puppeteer');

const USAGE = 'usage: node tools/golden/render.mjs <directory> [--no-sandbox]';

/** The name the failure report goes by, beside the candidate it explains the absence of. */
const REPORT_FILENAME = 'report.json';

/**
 * Resolves and clears the way to the output directory, or refuses.
 *
 * An absent directory is created and an empty one accepted; anything else is refused. Writing into
 * a directory that already holds files is how a candidate would silently inherit a stale document,
 * and writing into the tracked references is how a batch would be blessed without ever being read.
 */
function prepareOutputDirectory(target) {
  const output = resolve(target);
  const inside = relative(REFERENCES_DIRECTORY, output);
  if (inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))) {
    throw new Error(
      `${output} is the tracked reference directory: a candidate is generated elsewhere and promoted by tools/golden/accept.mjs`,
    );
  }
  if (!existsSync(output)) {
    mkdirSync(output, { recursive: true });
    return output;
  }
  if (!statSync(output).isDirectory()) {
    throw new Error(`${output} is not a directory`);
  }
  const entries = readdirSync(output);
  if (entries.length > 0) {
    throw new Error(
      `${output} already holds ${entries.length} file(s): a candidate is written into an empty directory, never beside a stale one`,
    );
  }
  return output;
}

/**
 * Renders one scenario through both facades and answers its manifest record and its bytes.
 *
 * The page count is checked three ways -- what the pdf holds, what the pagination announced and
 * what the register expects -- because a batch that froze a document of the wrong length would
 * freeze the defect along with it.
 */
async function renderScenario(scenario, strategy) {
  const request = { template: scenario.template, data: scenario.data };
  const pagination = await createPaginationPort(strategy, scenario.options).paginate(request);
  const rendered = await createPdfRenderPort(strategy, scenario.options).render(request);
  const bytes = rendered.bytes;

  const printed = await pageCountOf(bytes);
  if (printed !== pagination.pages.length || printed !== scenario.expectedPages) {
    throw new Error(
      `${scenario.id}: the pdf holds ${printed} pages, the pagination announced ${pagination.pages.length} and the register expects ${scenario.expectedPages}`,
    );
  }

  const pages = [];
  for (const page of pagination.pages) {
    const isolated = await extractPage(bytes, page.number);
    pages.push({
      number: page.number,
      pdf: recordOf(isolated),
      pagination: textRecordOf(certificateOf(pagination, page.number)),
    });
  }

  const stored = storedTemplateDigestOf(scenario);
  return {
    bytes,
    record: {
      id: scenario.id,
      recipeVersion: scenario.recipeVersion,
      filename: scenario.filename,
      inputSha256: inputDigestOf(scenario),
      ...(stored === undefined ? {} : { storedTemplateSha256: stored }),
      pdf: recordOf(bytes),
      html: textRecordOf(pagination.html),
      sheet: textRecordOf(sheetCertificateOf(pagination)),
      notices: textRecordOf(noticesCertificateOf(pagination)),
      pages,
    },
  };
}

/** What a failed run leaves behind: an id, a code when the engine typed one, and nothing else. */
function failureReport(scenario, error) {
  return {
    status: 'render-failed',
    scenario: scenario === undefined ? null : scenario.id,
    /* The typed code travels; the message does not. A `DocumentRenderError` names the region and
       the page it refused on, and this report is published as a ci artefact. */
    code: error instanceof DocumentRenderError ? error.code : null,
    documents: [],
  };
}

const [target, ...flags] = process.argv.slice(2);
if (target === undefined) {
  throw new Error(USAGE);
}
const stray = flags.filter((flag) => !flag.startsWith('--'));
if (stray.length > 0) {
  /* Refused rather than dropped, exactly as the E6 producer refuses it: `-no-sandbox` for
     `--no-sandbox` would launch a browser the operator believed was configured otherwise. */
  throw new Error(`unrecognised launch argument: ${stray.join(', ')}`);
}
const launchArguments = [...flags];
const output = prepareOutputDirectory(target);

/* The official profile launches the browser Puppeteer downloaded: no `executablePath`, because
   Puppeteer warrants only its own build and a local Chrome is not what the profile attests. */
const options = launchArguments.length === 0 ? {} : { args: launchArguments };

/* Probed once, before the corpus: the profile describes the run, and launching a browser per
   scenario to ask it again would only add ways for the answer to differ from itself. */
const probe = await puppeteer.launch({ headless: true, ...options });
let profile;
try {
  profile = await profileOf(probe, launchArguments);
} finally {
  await probe.close();
}

const strategy = createPuppeteerPdfStrategy(options);
const rendered = [];
let current;
try {
  for (const scenario of CORPUS) {
    current = scenario;
    rendered.push({ scenario, ...(await renderScenario(scenario, strategy)) });
  }
} catch (error) {
  writeFileSync(
    join(output, REPORT_FILENAME),
    `${JSON.stringify(failureReport(current, error), null, 2)}\n`,
    'utf8',
  );
  const named = current === undefined ? 'the corpus' : current.id;
  console.error(`E7 ${named}: no candidate was written.`);
  console.error(`candidate report: ${join(output, REPORT_FILENAME)}`);
  throw error;
}

/* Written only here: every scenario came out, so the batch either exists whole or not at all. */
const manifest = {
  formatVersion: FORMAT_VERSION,
  generatorVersion: GENERATOR_VERSION,
  pageExtractorVersion: PAGE_EXTRACTOR_VERSION,
  profile,
  documents: rendered.map((one) => one.record),
};
for (const one of rendered) {
  writeFileSync(join(output, one.scenario.filename), one.bytes);
}
writeFileSync(join(output, MANIFEST_FILENAME), serializeManifest(manifest), 'utf8');

let total = 0;
for (const one of rendered) {
  total += one.record.pdf.bytes;
  console.log(
    `${one.record.id}: ${one.record.pages.length} pages, ${one.record.pdf.bytes} bytes, ${one.record.pdf.sha256}`,
  );
}
console.log(`profile: node ${profile.node}, icu ${profile.icu}, ${profile.chromium}`);
console.log(`${rendered.length} documents, ${total} bytes of pdf, wrote ${output}`);

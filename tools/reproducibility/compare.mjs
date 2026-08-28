/**
 * Compares two manifests produced by `render.mjs` on two machines.
 *
 * Usage: node tools/reproducibility/compare.mjs <first.json> <second.json>
 *
 * The profile is compared first and the digests only afterwards. Two runs carrying two ICU builds
 * may legitimately produce two different space characters, so reporting that as a document defect
 * would be a lie: a profile mismatch is reported as a profile mismatch.
 */
import { readFileSync } from 'node:fs';
import { PROFILE_FIELDS } from './profile.mjs';

const [left, right] = process.argv.slice(2);
if (left === undefined || right === undefined) {
  throw new Error('usage: node tools/reproducibility/compare.mjs <first.json> <second.json>');
}

const read = (path) => {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  for (const field of PROFILE_FIELDS) {
    if (manifest.profile?.[field] === undefined) {
      throw new Error(`${path} carries no profile field ${field}, so it attests nothing`);
    }
  }
  if (!Array.isArray(manifest.renders) || manifest.renders.length === 0) {
    throw new Error(`${path} carries no render`);
  }
  return manifest;
};

const first = read(left);
const second = read(right);

const failures = [];

/** The catalogue as a map, so a mismatch can name the face rather than dump twelve digests. */
const facesOf = (profile) => new Map(profile.fonts.map((font) => [font.id, font.sha256]));

/* Compared field by field rather than as two blobs, so a mismatch names what differs: told that
   the icu builds differ, a reader knows the two runs were never comparable in the first place. */
for (const field of PROFILE_FIELDS) {
  if (field === 'fonts') {
    const a = facesOf(first.profile);
    const b = facesOf(second.profile);
    for (const [id, digest] of a) {
      const other = b.get(id);
      if (other === undefined) {
        failures.push(`profile.fonts: "${id}" is embedded by one build and not by the other`);
      } else if (other !== digest) {
        failures.push(`profile.fonts: "${id}" is ${digest} against ${other}`);
      }
    }
    for (const id of b.keys()) {
      if (!a.has(id)) {
        failures.push(`profile.fonts: "${id}" is embedded by one build and not by the other`);
      }
    }
    continue;
  }
  const a = JSON.stringify(first.profile[field]);
  const b = JSON.stringify(second.profile[field]);
  if (a !== b) {
    failures.push(`profile.${field} differs: ${a} vs ${b}`);
  }
}

if (failures.length > 0) {
  console.error('The two runs do not share a reproducibility profile, so their bytes say nothing:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  const named = (manifest) => new Map(manifest.renders.map((render) => [render.document, render]));
  const a = named(first);
  const b = named(second);
  if (a.size !== b.size) {
    failures.push(`one manifest carries ${a.size} documents and the other ${b.size}`);
  }
  for (const [document, render] of a) {
    const other = b.get(document);
    if (other === undefined) {
      failures.push(`"${document}" is missing from ${right}`);
      continue;
    }
    if (render.pages !== other.pages) {
      failures.push(`"${document}": ${render.pages} pages against ${other.pages}`);
    }
    if (render.html.sha256 !== other.html.sha256) {
      failures.push(
        `"${document}": published html ${render.html.sha256} against ${other.html.sha256}`,
      );
    }
    const digests = new Set([...render.pdf, ...other.pdf].map((one) => one.sha256));
    const lengths = new Set([...render.pdf, ...other.pdf].map((one) => one.bytes));
    if (digests.size !== 1 || lengths.size !== 1) {
      failures.push(
        `"${document}": ${render.pdf.length + other.pdf.length} renders produced ${digests.size} distinct digests`,
      );
    } else {
      console.log(
        `"${document}": ${render.pdf.length + other.pdf.length} renders, one digest ${[...digests][0]}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('The two runs share a profile but did not produce the same document:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `profile: node ${first.profile.node}, icu ${first.profile.icu}, ${first.profile.chromium}`,
    );
    console.log('Both machines produced the same bytes.');
  }
}

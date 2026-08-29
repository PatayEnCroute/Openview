/**
 * The documentation gate: parity, budget, quoted snippets, links and published facts.
 *
 * Plain JavaScript with no dependency, like the rest of `tools/`, so the suite that drives it needs
 * no build step of its own. The rules are pure: `checkDocumentation` reads nothing from disk, and
 * every fact it compares against arrives in its input. That is what lets a test feed it a faulty
 * page and prove the rule bites.
 *
 * Run through `packages/adapter-puppeteer/src/__tests__/documentation.test.ts`.
 */

/** The two language trees, and the guide root they live under. */
export const LANGUAGES = ['en', 'fr'];

export const GUIDE_ROOT = 'docs/engine';

/** The guide, in reading order, with the line ceiling each page may not exceed. */
export const GUIDE_PAGES = [
  { name: '00-contents.md', maxLines: 40 },
  { name: '01-first-pdf.md', maxLines: 150 },
  { name: '02-template-and-data.md', maxLines: 150 },
  { name: '03-when-it-fails.md', maxLines: 220 },
  { name: '04-untrusted-documents.md', maxLines: 150 },
  { name: '05-guarantees-and-limits.md', maxLines: 120 },
];

/** The language `README.md` itself is written in: every other one carries its tag. */
export const PUBLISHED_LANGUAGE = 'en';

/** The packages with a landing page, whose english half is what npm shows. */
export const READMES = [
  { directory: 'packages/engine', maxLines: 120 },
  { directory: 'packages/adapter-puppeteer', maxLines: 80 },
];

/** Where the landing page of one package, in one language, lives. */
export function readmeOf(directory, language) {
  const name = language === PUBLISHED_LANGUAGE ? 'README.md' : `README.${language}.md`;
  return `${directory}/${name}`;
}

/** Longest line a documentation file may carry, matching the formatter's width. */
export const MAX_WIDTH = 100;

/** Deepest heading level a page may reach: below it, a page is a manual. */
export const MAX_HEADING_DEPTH = 3;

/** The repository url whose `blob` links must designate an existing file. */
const REPOSITORY_BLOB = 'https://github.com/PatayEnCroute/Openview/blob/main/';

/** The file list one language tree must hold, guide pages and readmes together. */
export function filesOf(language) {
  const guide = GUIDE_PAGES.map((page) => ({
    path: `${GUIDE_ROOT}/${language}/${page.name}`,
    maxLines: page.maxLines,
  }));
  const readmes = READMES.map((readme) => ({
    path: readmeOf(readme.directory, language),
    maxLines: readme.maxLines,
  }));
  return [...guide, ...readmes];
}

/** Sum of the ceilings of one language: the budget a whole translation lives under. */
export const TOTAL_PER_LANGUAGE = filesOf('en').reduce((sum, file) => sum + file.maxLines, 0);

/**
 * The named regions of a source module, indentation removed.
 *
 * A region opens on `// #region <name>` and closes on `// #endregion`, the spelling editors fold.
 * Nested regions are not supported: a quoted example is a contiguous slice or it is two examples.
 */
export function regionsOf(source) {
  const regions = new Map();
  let name;
  let lines = [];
  for (const line of source.split('\n')) {
    const opening = /^\s*\/\/ #region (\S+)\s*$/.exec(line);
    if (opening !== null) {
      name = opening[1];
      lines = [];
      continue;
    }
    if (/^\s*\/\/ #endregion(\s.*)?$/.test(line)) {
      if (name !== undefined) {
        regions.set(name, dedent(lines).join('\n').trim());
      }
      name = undefined;
      continue;
    }
    if (name !== undefined) {
      lines.push(line);
    }
  }
  return regions;
}

/**
 * The names a barrel exports, whether they carry a value or only a type.
 *
 * Read from the source barrel rather than from a built `.d.ts`: both spell the same names, and the
 * source is what a reviewer edits when the surface changes.
 */
export function exportedNamesOf(source) {
  const names = [];
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const entry of match[1].split(',')) {
      const name = entry
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .at(-1);
      if (name !== undefined && name !== '') {
        names.push(name);
      }
    }
  }
  for (const match of source.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|function|class|interface|type)\s+([A-Za-z0-9_$]+)/g,
  )) {
    names.push(match[1]);
  }
  return names;
}

/** Removes the common leading indentation of a block, ignoring its blank lines. */
function dedent(lines) {
  const widths = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.length - line.trimStart().length);
  const shift = widths.length === 0 ? 0 : Math.min(...widths);
  return lines.map((line) => line.slice(shift));
}

/** One violation: where it is, which rule saw it, and what it saw. */
function violation(file, line, rule, message) {
  return { file, line, rule, message };
}

/**
 * The fenced code blocks of a page, with the annotation that immediately precedes each.
 *
 * A fence left open is reported rather than dropped: a block nobody closed is a block no rule
 * compares, and a gate that goes quiet on a broken page is worse than no gate.
 */
function blocksOf(text) {
  const lines = text.split('\n');
  const blocks = [];
  let open;
  lines.forEach((line, index) => {
    const fence = /^```(\S*)\s*$/.exec(line);
    if (fence === null) {
      if (open !== undefined) {
        open.lines.push(line);
      }
      return;
    }
    if (open === undefined) {
      open = {
        language: fence[1],
        line: index + 1,
        lines: [],
        annotation: annotationAbove(lines, index),
      };
      return;
    }
    blocks.push({ ...open, content: open.lines.join('\n') });
    open = undefined;
  });
  return { blocks, unclosed: open?.line };
}

/** The `docs-*` annotation immediately above a line, blank lines aside. */
function annotationAbove(lines, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = lines[cursor].trim();
    if (line === '') {
      continue;
    }
    return annotationOf(line);
  }
  return undefined;
}

/** Parses `<!-- docs-kind: payload -->`, and nothing else. */
function annotationOf(line) {
  const parsed = /^<!--\s*docs-(region|api|vocabulary|defaults|value):\s*(.+?)\s*-->$/.exec(line);
  return parsed === null ? undefined : { kind: parsed[1], payload: parsed[2] };
}

/** Every annotation of a page, with the line it sits on. */
function annotationsOf(text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    const annotation = annotationOf(line.trim());
    if (annotation !== undefined) {
      found.push({ ...annotation, line: index + 1 });
    }
  });
  return found;
}

/** The headings of a page, code blocks excluded, as `{ depth, line }`. */
function headingsOf(text) {
  const headings = [];
  let inside = false;
  text.split('\n').forEach((line, index) => {
    if (/^```/.test(line)) {
      inside = !inside;
      return;
    }
    const heading = /^(#{1,6})\s+\S/.exec(line);
    if (!inside && heading !== null) {
      headings.push({ depth: heading[1].length, line: index + 1 });
    }
  });
  return headings;
}

/** The link targets of a page, code blocks excluded. */
function linksOf(text) {
  const links = [];
  let inside = false;
  text.split('\n').forEach((line, index) => {
    if (/^```/.test(line)) {
      inside = !inside;
      return;
    }
    if (inside) {
      return;
    }
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      links.push({ target: match[1], line: index + 1 });
    }
  });
  return links;
}

/** The rows of the markdown table that follows a line, header and separator dropped. */
function tableAfter(lines, start) {
  const rows = [];
  let seen = 0;
  for (let cursor = start; cursor < lines.length; cursor += 1) {
    const line = lines[cursor].trim();
    if (line === '') {
      if (rows.length > 0 || seen > 0) {
        break;
      }
      continue;
    }
    if (!line.startsWith('|')) {
      break;
    }
    seen += 1;
    if (seen <= 2) {
      continue;
    }
    rows.push(
      line
        .slice(1, line.endsWith('|') ? -1 : undefined)
        .split('|')
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

/** The bullet items of the list that follows a line. */
function listAfter(lines, start) {
  const items = [];
  for (let cursor = start; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.trim() === '') {
      if (items.length > 0) {
        break;
      }
      continue;
    }
    if (/^\s+\S/.test(line) && items.length > 0) {
      continue;
    }
    if (!line.startsWith('- ')) {
      break;
    }
    items.push(line.slice(2).trim());
  }
  return items;
}

/** The first inline-code word of a cell or a bullet, which is the term it names. */
function termOf(entry) {
  const code = /`([^`]+)`/.exec(entry);
  return code === null ? entry : code[1];
}

/** Digits as a page writes them, thin spaces and underscores aside. */
function normalizeNumber(written) {
  return written.replaceAll(/[\s_  ]/gu, '');
}

/** Same files in both trees (G1). */
function checkParity(input, violations) {
  for (const language of LANGUAGES) {
    for (const file of filesOf(language)) {
      if (!input.files.has(file.path)) {
        violations.push(
          violation(file.path, 0, 'G1', 'the page is missing from its language tree'),
        );
      }
    }
  }
}

/** The pages of the two trees, paired by name. */
function pairsOf(input) {
  const english = filesOf('en');
  const french = filesOf('fr');
  return english
    .map((file, index) => ({ en: file.path, fr: french[index].path }))
    .filter((pair) => input.files.has(pair.en) && input.files.has(pair.fr));
}

/** Same headings, same order, same levels (G2). */
function checkHeadings(input, violations) {
  for (const pair of pairsOf(input)) {
    const english = headingsOf(input.files.get(pair.en)).map((heading) => heading.depth);
    const french = headingsOf(input.files.get(pair.fr)).map((heading) => heading.depth);
    if (english.join(',') !== french.join(',')) {
      violations.push(violation(pair.fr, 0, 'G2', `heading outline differs from ${pair.en}`));
    }
  }
}

/** Byte-for-byte identical code blocks across languages (G3). */
function checkCodeBlocks(input, violations) {
  for (const pair of pairsOf(input)) {
    const english = blocksOf(input.files.get(pair.en)).blocks;
    const french = blocksOf(input.files.get(pair.fr)).blocks;
    if (english.length !== french.length) {
      violations.push(
        violation(
          pair.fr,
          0,
          'G3',
          `has ${french.length} code blocks, ${pair.en} has ${english.length}`,
        ),
      );
      continue;
    }
    english.forEach((block, index) => {
      if (block.content !== french[index].content || block.language !== french[index].language) {
        violations.push(
          violation(
            pair.fr,
            french[index].line,
            'G3',
            `code block ${index + 1} differs from ${pair.en}`,
          ),
        );
      }
    });
  }
}

/** Every `ts` block quotes a region of a compiled module, verbatim (G4). */
function checkRegions(input, violations) {
  for (const [path, text] of input.files) {
    const { blocks, unclosed } = blocksOf(text);
    if (unclosed !== undefined) {
      violations.push(violation(path, unclosed, 'G4', 'a code fence is never closed'));
    }
    for (const block of blocks) {
      if (block.language !== 'ts') {
        continue;
      }
      if (block.annotation?.kind !== 'region') {
        violations.push(
          violation(path, block.line, 'G4', 'a ts block without a docs-region annotation'),
        );
        continue;
      }
      const region = input.regions.get(block.annotation.payload);
      if (region === undefined) {
        violations.push(
          violation(path, block.line, 'G4', `unknown region ${block.annotation.payload}`),
        );
        continue;
      }
      if (region !== block.content.trim()) {
        violations.push(
          violation(
            path,
            block.line,
            'G4',
            `the block no longer matches ${block.annotation.payload}`,
          ),
        );
      }
    }
  }
}

/** Line ceilings, line width, heading depth and a single h1 (G5). */
function checkBudget(input, violations) {
  for (const language of LANGUAGES) {
    let total = 0;
    for (const file of filesOf(language)) {
      const text = input.files.get(file.path);
      if (text === undefined) {
        continue;
      }
      const lines = text.replace(/\n$/, '').split('\n');
      total += lines.length;
      if (lines.length > file.maxLines) {
        violations.push(
          violation(
            file.path,
            lines.length,
            'G5',
            `${lines.length} lines, ceiling is ${file.maxLines}`,
          ),
        );
      }
      lines.forEach((line, index) => {
        if (line.length > MAX_WIDTH) {
          violations.push(
            violation(
              file.path,
              index + 1,
              'G5',
              `${line.length} columns, ceiling is ${MAX_WIDTH}`,
            ),
          );
        }
      });
      const headings = headingsOf(text);
      const tops = headings.filter((heading) => heading.depth === 1);
      if (tops.length !== 1) {
        violations.push(
          violation(
            file.path,
            tops[1]?.line ?? 0,
            'G5',
            `${tops.length} level-one headings, exactly one is allowed`,
          ),
        );
      }
      for (const heading of headings) {
        if (heading.depth > MAX_HEADING_DEPTH) {
          violations.push(
            violation(
              file.path,
              heading.line,
              'G5',
              `heading depth ${heading.depth}, ceiling is ${MAX_HEADING_DEPTH}`,
            ),
          );
        }
      }
    }
    if (total > TOTAL_PER_LANGUAGE) {
      violations.push(
        violation(
          `${GUIDE_ROOT}/${language}`,
          0,
          'G5',
          `${total} lines in this language, budget is ${TOTAL_PER_LANGUAGE}`,
        ),
      );
    }
  }
}

/** Relative links resolve, and repository urls designate a file (G6). */
function checkLinks(input, violations) {
  for (const [path, text] of input.files) {
    const directory = path.split('/').slice(0, -1);
    for (const link of linksOf(text)) {
      if (link.target.startsWith('/')) {
        /* Root-absolute is broken for both readers: github reads it as a path of the site, npm as
           a path of the registry. Refused by name rather than resolved from the repository root,
           which would let a link nobody can follow pass the gate. */
        violations.push(
          violation(
            path,
            link.line,
            'G6',
            `${link.target} is root-absolute, so no reader resolves it`,
          ),
        );
        continue;
      }
      const target = resolvedTarget(link.target, directory);
      if (target === undefined || input.exists(target)) {
        continue;
      }
      violations.push(
        violation(path, link.line, 'G6', `link to ${link.target} resolves to nothing`),
      );
    }
  }
}

/** The repository-relative path a link designates, or nothing when it is not ours to check. */
function resolvedTarget(target, directory) {
  if (target.startsWith(REPOSITORY_BLOB)) {
    return target.slice(REPOSITORY_BLOB.length).split('#')[0];
  }
  if (/^[a-z]+:/i.test(target) || target.startsWith('#')) {
    return undefined;
  }
  const segments = [...directory];
  for (const segment of target.split('#')[0].split('/')) {
    if (segment === '.' || segment === '') {
      continue;
    }
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

/** Named exports exist, and closed vocabularies are complete and ordered (G7). */
function checkApi(input, violations) {
  for (const [path, text] of input.files) {
    const lines = text.split('\n');
    for (const annotation of annotationsOf(text)) {
      if (annotation.kind === 'api') {
        checkApiManifest(path, annotation, input, violations);
      }
      if (annotation.kind === 'vocabulary') {
        checkVocabulary(path, annotation, lines, input, violations);
      }
    }
  }
}

/** Each name of a `docs-api` manifest is exported by the package it names. */
function checkApiManifest(path, annotation, input, violations) {
  const [packageName, ...names] = annotation.payload.split(/\s+/);
  const surface = input.exports.get(packageName);
  if (surface === undefined) {
    violations.push(violation(path, annotation.line, 'G7', `unknown package ${packageName}`));
    return;
  }
  for (const name of names) {
    if (!surface.includes(name)) {
      violations.push(
        violation(path, annotation.line, 'G7', `${packageName} does not export ${name}`),
      );
    }
  }
}

/** The list or table under a `docs-vocabulary` equals its source, in source order. */
function checkVocabulary(path, annotation, lines, input, violations) {
  const source = input.vocabularies.get(annotation.payload);
  if (source === undefined) {
    violations.push(
      violation(path, annotation.line, 'G7', `unknown vocabulary ${annotation.payload}`),
    );
    return;
  }
  const rows = tableAfter(lines, annotation.line);
  const written =
    rows.length > 0
      ? rows.map((row) => termOf(row[0]))
      : listAfter(lines, annotation.line).map(termOf);
  if (written.join('\n') !== source.join('\n')) {
    violations.push(
      violation(
        path,
        annotation.line,
        'G7',
        `${annotation.payload} is written as ${written.length} entries, source has ${source.length} in another order or spelling`,
      ),
    );
  }
}

/** Default tables are exhaustive both ways, and published facts equal their source (G8). */
function checkFacts(input, violations) {
  for (const [path, text] of input.files) {
    const lines = text.split('\n');
    for (const annotation of annotationsOf(text)) {
      if (annotation.kind === 'defaults') {
        checkDefaults(path, annotation, lines, input, violations);
      }
      if (annotation.kind === 'value') {
        checkValue(path, annotation, input, violations);
      }
    }
  }
}

/** Same keys, same values, in both directions. */
function checkDefaults(path, annotation, lines, input, violations) {
  const source = input.defaults.get(annotation.payload);
  if (source === undefined) {
    violations.push(
      violation(path, annotation.line, 'G8', `unknown defaults ${annotation.payload}`),
    );
    return;
  }
  const written = new Map(
    tableAfter(lines, annotation.line).map((row) => [
      termOf(row[0]),
      normalizeNumber(termOf(row[1] ?? '')),
    ]),
  );
  for (const [key, value] of Object.entries(source)) {
    const found = written.get(key);
    if (found === undefined) {
      violations.push(
        violation(path, annotation.line, 'G8', `${annotation.payload}.${key} is not published`),
      );
      continue;
    }
    if (found !== normalizeNumber(String(value))) {
      violations.push(
        violation(
          path,
          annotation.line,
          'G8',
          `${annotation.payload}.${key} is published as ${found}, source says ${value}`,
        ),
      );
    }
  }
  for (const key of written.keys()) {
    if (!Object.hasOwn(source, key)) {
      violations.push(
        violation(path, annotation.line, 'G8', `${annotation.payload} has no ${key}`),
      );
    }
  }
}

/** A `docs-value` annotation states a fact, and the fact is the one the source holds. */
function checkValue(path, annotation, input, violations) {
  const separator = annotation.payload.indexOf('=');
  const name = annotation.payload.slice(0, separator);
  const written = annotation.payload.slice(separator + 1);
  const source = input.values.get(name);
  if (separator < 0 || source === undefined) {
    violations.push(violation(path, annotation.line, 'G8', `unknown fact ${annotation.payload}`));
    return;
  }
  if (normalizeNumber(written) !== normalizeNumber(String(source))) {
    violations.push(
      violation(
        path,
        annotation.line,
        'G8',
        `${name} is published as ${written}, source says ${source}`,
      ),
    );
  }
}

/**
 * Every rule, over one set of pages and the facts they claim.
 *
 * @param input.files pages by repository-relative path
 * @param input.regions quotable regions by `path#name`
 * @param input.exports named exports by package name
 * @param input.vocabularies closed lists by constant name
 * @param input.defaults default objects by constant name
 * @param input.values single facts by name
 * @param input.exists whether a repository-relative path exists
 * @returns every violation found, in rule order
 */
export function checkDocumentation(input) {
  const violations = [];
  checkParity(input, violations);
  checkHeadings(input, violations);
  checkCodeBlocks(input, violations);
  checkRegions(input, violations);
  checkBudget(input, violations);
  checkLinks(input, violations);
  checkApi(input, violations);
  checkFacts(input, violations);
  return violations;
}

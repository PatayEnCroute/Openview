import { describe, expect, it } from 'vitest';
import {
  constantMarkers,
  literalText,
  materializedOf,
  NO_IMAGES,
  paginateOnGrid,
  SAMPLE_DATA,
} from '../../../__tests__/fixtures.js';
import {
  buildMarkerProbe,
  buildPagedTree,
  buildProbeTree,
  documentFontCss,
} from '../../../html/build-page.js';
import { CONTENT_SECURITY_POLICY, serializeHtml } from '../../../html/serialize.js';
import { DEFAULT_RENDER_SAFETY_LIMITS } from '../../../limits/types.js';
import { markerSignatures } from '../../../pagination/markers.js';
import { BUNDLED_FACES } from '../catalogue.js';
import { usedFaces } from '../collect.js';
import { fontFaceCss } from '../css.js';

const container = (id: string, children: unknown[] = []): Record<string, unknown> => ({
  type: 'container',
  id,
  children,
});

const styled = (id: string, text: string, typography: Record<string, unknown>) => ({
  type: 'text',
  id,
  typography,
  content: [{ kind: 'literal', text }],
});

/** Every `@font-face` rule of a stylesheet, in the order it wrote them. */
const rulesOf = (css: string): readonly string[] =>
  [...css.matchAll(/@font-face\{[^}]*\}/g)].map((match) => match[0]);

/** The css families a stylesheet declares faces for, in order. */
const declaredIn = (css: string): readonly string[] =>
  rulesOf(css).map((rule) => rule.match(/font-family:"([^"]+)"/)?.[1] ?? '');

const ONE_FACE = () => materializedOf({ root: container('root', [literalText('t', 'plain')]) }, {});

const TWO_FAMILIES = () =>
  materializedOf(
    {
      root: container('root', [
        styled('a', 'sans', { family: 'Noto Sans' }),
        styled('b', 'serif', { family: 'Noto Serif' }),
      ]),
    },
    {},
  );

describe('the faces a document embeds', () => {
  it('embeds only the faces its runs really reach', () => {
    const faces = usedFaces(ONE_FACE());
    expect(faces).toHaveLength(1);
    expect(faces[0]?.family).toBe('noto-sans-2.015');
    expect(faces[0]?.weight).toBe(400);
    expect(faces[0]?.style).toBe('normal');
  });

  it('embeds one face per weight and slant a document actually paints', () => {
    const document = materializedOf(
      {
        root: container('root', [
          styled('plain', 'plain', { family: 'Noto Sans' }),
          styled('bold', 'bold', { family: 'Noto Sans', bold: true }),
          styled('italic', 'italic', { family: 'Noto Sans', italic: true }),
          styled('both', 'both', { family: 'Noto Sans', bold: true, italic: true }),
        ]),
      },
      {},
    );
    expect(usedFaces(document).map((face) => `${face.weight} ${face.style}`)).toStrictEqual([
      '400 normal',
      '700 normal',
      '400 italic',
      '700 italic',
    ]);
  });

  it('leaves the eleven unused faces out of a single-face document', () => {
    const css = documentFontCss(ONE_FACE());
    expect(rulesOf(css)).toHaveLength(1);
    expect(css.length).toBeLessThan(fontFaceCss(BUNDLED_FACES).length / 5);
  });

  it('orders the faces by the catalogue rather than by the order the walk met them', () => {
    const serifFirst = materializedOf(
      {
        root: container('root', [
          styled('b', 'serif', { family: 'Noto Serif' }),
          styled('a', 'sans', { family: 'Noto Sans' }),
        ]),
      },
      {},
    );
    expect(usedFaces(serifFirst).map((face) => face.family)).toStrictEqual(
      usedFaces(TWO_FAMILIES()).map((face) => face.family),
    );
  });

  it('reaches a run inside a band and inside a page layer, not just the flow', () => {
    const document = materializedOf(
      {
        page: {
          sheet: { width: 210, height: 297 },
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          header: [
            { on: 'every', content: container('head', [styled('h', 'h', { family: 'Inter' })]) },
          ],
          footer: [],
          layers: [
            {
              plane: 'background',
              content: container('back', [styled('w', 'w', { family: 'Noto Serif' })]),
            },
          ],
        },
        root: container('root', [literalText('t', 'body')]),
      },
      {},
    );
    expect(usedFaces(document).map((face) => face.family)).toStrictEqual([
      'inter-4.1',
      'noto-sans-2.015',
      'noto-serif-2.015',
    ]);
  });
});

describe('the stylesheet those faces produce', () => {
  const css = documentFontCss(TWO_FAMILIES());

  it('serves every face as an embedded data uri and never as a url', () => {
    for (const rule of rulesOf(css)) {
      expect(rule).toContain('src:url(data:font/ttf;base64,');
      expect(rule).not.toMatch(/url\((?!data:)/);
    }
    expect(css).not.toContain('http');
    expect(css).not.toContain('file:');
  });

  it('declares the weight and the slant of each face, so none is ever synthesised', () => {
    expect(declaredIn(css)).toStrictEqual([
      '__openview_noto_sans_2_015',
      '__openview_noto_serif_2_015',
    ]);
    for (const rule of rulesOf(css)) {
      expect(rule).toMatch(/font-style:(normal|italic);/);
      expect(rule).toMatch(/font-weight:(400|700);/);
      expect(rule).toContain('font-display:block');
    }
  });

  it('names no family a template could have declared', () => {
    for (const declared of declaredIn(css)) {
      expect(declared).toMatch(/^__openview_/);
    }
    expect(css).not.toContain('"Noto Sans"');
    expect(css).not.toContain('"Noto Serif"');
  });
});

describe('the three trees one render builds', () => {
  it('carry the same face rules, in the same order', () => {
    const document = TWO_FAMILIES();
    const fonts = documentFontCss(document);
    const markers = constantMarkers();
    const paged = buildPagedTree(paginateOnGrid(document), fonts, NO_IMAGES);
    const probe = buildProbeTree(document, markers, fonts, NO_IMAGES);
    const glyphs = buildMarkerProbe(
      document,
      markerSignatures(document, { pages: 1, report: 0 }),
      fonts,
    );

    const faces = rulesOf(paged.css);
    expect(faces).toHaveLength(2);
    expect(rulesOf(probe.tree.css)).toStrictEqual(faces);
    expect(rulesOf(glyphs.tree.css)).toStrictEqual(faces);
    /* Each stylesheet opens with the faces: a rule that arrived after a use would let the browser
       lay one box out before the face it needed was available. */
    for (const tree of [paged, probe.tree, glyphs.tree]) {
      expect(tree.css.startsWith('@font-face{')).toBe(true);
    }
  });

  it('write one internal family per run, with no stack behind it', () => {
    const document = TWO_FAMILIES();
    const html = serializeHtml(
      buildPagedTree(paginateOnGrid(document), documentFontCss(document), NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    expect(html).toContain('font-family:"__openview_noto_sans_2_015"');
    expect(html).toContain('font-family:"__openview_noto_serif_2_015"');
    /* No stack behind any family, in either spelling the document uses: the stylesheet writes
       `font-family:"..."` and an inline style writes it escaped, and a comma after the closing
       quote in either would let the browser finish the document in whatever the machine has. */
    expect(html).not.toMatch(/font-family:&quot;[^&]*&quot;\s*,/);
    expect(html).not.toMatch(/font-family:"[^"]*"\s*,/);
    expect(html).not.toMatch(/font-family:\s*[a-z-]+\s*[,;"]/);
    for (const generic of ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui']) {
      expect(html).not.toContain(`font-family:${generic}`);
    }
  });

  it('forbid a synthesised weight or slant on every run', () => {
    const document = TWO_FAMILIES();
    const html = serializeHtml(
      buildPagedTree(paginateOnGrid(document), documentFontCss(document), NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    /* Read in the escaped form the serialiser really writes: an inline style is an attribute
       value, so the quotes around the family come out as entities. */
    const runs = [...html.matchAll(/font-family:&quot;__openview[^&]+&quot;.*?color:/g)];
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) {
      expect(run[0]).toContain('font-synthesis:none');
    }
  });

  it('let the document carry its own font policy, opened to embedded bytes alone', () => {
    expect(CONTENT_SECURITY_POLICY).toContain('font-src data:');
    expect(CONTENT_SECURITY_POLICY).not.toContain("font-src 'none'");
    const html = serializeHtml(
      buildPagedTree(paginateOnGrid(ONE_FACE()), documentFontCss(ONE_FACE()), NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    expect(html).toContain('font-src data:');
  });

  it('publish a source that carries its typography on its own', () => {
    /* The whole point of the embedded bytes: the html E5 hands to a viewer needs nothing from the
       machine that opens it to be set in the same faces as the pdf. */
    const document = materializedOf(
      { root: container('root', [styled('t', 'body', { family: 'Inter', bold: true })]) },
      SAMPLE_DATA,
    );
    const html = serializeHtml(
      buildPagedTree(paginateOnGrid(document), documentFontCss(document), NO_IMAGES),
      DEFAULT_RENDER_SAFETY_LIMITS.maxHtmlBytes,
    );
    const embedded = BUNDLED_FACES.find(
      (face) => face.family === 'inter-4.1' && face.weight === 700 && face.style === 'normal',
    );
    expect(embedded).toBeDefined();
    expect(html).toContain(embedded?.data.slice(0, 64) ?? 'missing');
  });
});

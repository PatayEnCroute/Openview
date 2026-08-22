import {
  type BorderEdge,
  type EvaluationScope,
  mmFromPt,
  printableAreaOf,
  STANDARD_SHEETS_MM,
} from '@openview/core';
import { describe, expect, it } from 'vitest';
import { columnWidths, documentCss } from '../html/css.js';
import { cssFontFamily, cssString, escapeAttribute, escapeText } from '../html/escape.js';
import { CONTENT_SECURITY_POLICY } from '../html/serialize.js';
import { resolveRowRules } from '../html/table-rules.js';
import { materializedOf, pagedHtmlOf, SAMPLE_DATA, TINY_PNG } from './fixtures.js';

function htmlOf(overrides: Record<string, unknown>, data: EvaluationScope = SAMPLE_DATA): string {
  return pagedHtmlOf(overrides, data);
}

/** The stylesheet of the printed document, with no band reserved on either side. */
function cssOf(overrides: Record<string, unknown> = {}): string {
  return documentCss({ ...materializedOf(overrides, {}), headerReserve: 0, footerReserve: 0 });
}

const flow = (children: readonly Record<string, unknown>[]): Record<string, unknown> => ({
  root: { type: 'container', id: 'root', children },
});

const literal = (id: string, text: string): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'literal', text }],
});

describe('escaping', () => {
  it('escapes the five markup characters in character data', () => {
    expect(escapeText(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes the same characters in an attribute value', () => {
    expect(escapeAttribute(`a"b`)).toBe('a&quot;b');
  });

  it('leaves ordinary characters untouched', () => {
    expect(escapeText('Total HT — 1 200')).toBe('Total HT — 1 200');
  });

  it('hex-escapes everything a css string could use to escape its own value', () => {
    expect(cssString('a;b')).toBe('"a\\3b b"');
    expect(cssString('a"b')).toBe('"a\\22 b"');
    expect(cssString('a\\b')).toBe('"a\\5c b"');
    expect(cssString('</style>')).toBe('"\\3c \\2f style\\3e "');
  });

  it('keeps a generic family as a keyword and quotes every other name', () => {
    expect(cssFontFamily('sans-serif')).toBe('sans-serif');
    expect(cssFontFamily('serif')).toBe('serif');
    expect(cssFontFamily('Georgia')).toBe('"Georgia"');
    /* Quoted, so it names a family nothing matches instead of the keyword that reads the host. */
    expect(cssFontFamily('system-ui')).toBe('"system-ui"');
  });
});

describe('injection', () => {
  const hostile = `</span><script>alert(1)</script>`;

  it('never lets template text close an element or open a script', () => {
    const html = htmlOf(flow([literal('t', hostile)]));
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;/span&gt;&lt;script&gt;');
  });

  it('escapes text bound from the data as well', () => {
    const html = htmlOf(
      flow([
        {
          type: 'text',
          id: 'b',
          content: [{ kind: 'binding', value: { kind: 'path', path: 'hostile' } }],
        },
      ]),
      { hostile },
    );
    expect(html).not.toContain('<script');
  });

  it('escapes an image alternative text into its attribute', () => {
    const html = htmlOf(flow([{ type: 'image', id: 'i', src: TINY_PNG, alt: `" onload="x` }]));
    expect(html).toContain('alt="&quot; onload=&quot;x"');
    expect(html).not.toContain('onload="x"');
  });

  it('never puts template text into a style block', () => {
    const html = htmlOf(
      flow([
        {
          type: 'text',
          id: 'font',
          typography: { family: `X;position:absolute;background:url(http://evil)` },
          content: [{ kind: 'literal', text: 'x' }],
        },
      ]),
    );
    const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(style).not.toContain('evil');
    /* The separator that would open a second declaration is hex-escaped, so the whole hostile
       string stays one family name inside one quoted value. */
    expect(html).toContain('\\3b position\\3a absolute');
    expect(html).not.toMatch(/;position:absolute/);
    expect(html).not.toContain('url(http');
  });

  it('emits no event handler, frame, or network reference', () => {
    const html = htmlOf(flow([literal('t', 'plain'), { type: 'image', id: 'i', src: TINY_PNG }]));
    expect(html).not.toMatch(/\son[a-z]+=/);
    expect(html).not.toContain('<iframe');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('file:');
  });

  it('carries a policy that admits inline style and embedded images only', () => {
    const html = htmlOf(flow([]));
    expect(html).toContain(`content="${escapeAttribute(CONTENT_SECURITY_POLICY)}"`);
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain('img-src data:');
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-src 'none'");
  });
});

describe('the sheet and its printable area', () => {
  it('takes the sheet, the margins and the printable area from the contract', () => {
    const page = {
      sheet: { ...STANDARD_SHEETS_MM.letter },
      margins: { top: 12.7, right: 19.05, bottom: 12.7, left: 19.05 },
      header: [],
      footer: [],
    };
    const css = cssOf({ page });
    const printable = printableAreaOf(page);
    expect(css).toContain('@page{size:215.9mm 279.4mm;margin:0}');
    expect(css).toContain(`width:${printable.width}mm;height:${printable.height}mm`);
    expect(css).toContain('top:12.7mm;left:19.05mm');
  });

  it('declares no sheet of its own', () => {
    const css = cssOf({
      page: {
        sheet: { width: 100, height: 100 },
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        header: [],
        footer: [],
      },
    });
    expect(css).toContain('size:100mm 100mm');
    expect(css).not.toContain('210mm');
    expect(css).not.toContain('a4');
  });

  it('emits the three regions even when a band does not apply', () => {
    const html = htmlOf(flow([]));
    expect(html).toContain('data-openview-region="header"');
    expect(html).toContain('data-openview-region="root"');
    expect(html).toContain('data-openview-region="footer"');
  });

  it('forces exact print colours and leaves no browser margin', () => {
    const css = cssOf();
    expect(css).toContain('print-color-adjust:exact');
    expect(css).toContain('-webkit-print-color-adjust:exact');
    expect(css).toContain('html,body{margin:0;padding:0}');
  });
});

describe('the box model', () => {
  it('converts a font size through mmFromPt and not through a second constant', () => {
    /* 7.5 pt is a witness size: `(7.5 * 25.4) / 72` and `7.5 * (25.4 / 72)` are different doubles,
       so a second spelling of the same conversion cannot pass this assertion. At 9.5 pt the two
       agree, which is exactly why the size is chosen rather than convenient. */
    const witness = 7.5;
    expect((witness * 25.4) / 72).not.toBe(witness * (25.4 / 72));
    const html = htmlOf(
      flow([
        {
          type: 'text',
          id: 't',
          typography: { sizePt: witness },
          content: [{ kind: 'literal', text: 'x' }],
        },
      ]),
    );
    expect(html).toContain(`font-size:${mmFromPt(witness)}mm`);
  });

  it('writes the box of a text block beside its alignment', () => {
    const html = htmlOf(
      flow([
        {
          type: 'text',
          id: 'boxed',
          align: 'end',
          box: { background: '#eef2f9', padding: { top: 1, right: 2, bottom: 3, left: 4 } },
          content: [{ kind: 'literal', text: 'x' }],
        },
      ]),
    );
    expect(html).toContain('style="text-align:end;background:#eef2f9;padding:1mm 2mm 3mm 4mm"');
  });

  it('emits padding in millimetres and no border in the width formula', () => {
    const html = htmlOf(
      flow([
        {
          type: 'container',
          id: 'framed',
          box: {
            background: '#ffffff',
            padding: { top: 4, right: 3, bottom: 2, left: 1 },
            border: { top: { width: 0.4, color: '#1b3a6f' } },
          },
          children: [],
        },
      ]),
    );
    expect(html).toContain('padding:4mm 3mm 2mm 1mm');
    expect(html).toContain('box-shadow:inset 0 0.4mm 0 0 #1b3a6f');
    expect(html).not.toContain('border:');
    expect(html).not.toContain('border-top');
  });

  it('shares the content width by weight, with no rounding and no floor', () => {
    expect(columnWidths([{ id: 'a', width: 1, align: 'start' }])).toStrictEqual(['100%']);
    expect(
      columnWidths([
        { id: 'a', width: 1, align: 'start' },
        { id: 'b', width: 2, align: 'start' },
      ]),
    ).toStrictEqual([`${(1 / 3) * 100}%`, `${(2 / 3) * 100}%`]);
  });

  it('keeps a very narrow column away from zero', () => {
    const [narrow] = columnWidths([
      { id: 'a', width: 1, align: 'start' },
      { id: 'b', width: 1000, align: 'start' },
    ]);
    expect(narrow).toBe(`${(1 / 1001) * 100}%`);
    expect(Number.parseFloat(narrow ?? '0')).toBeGreaterThan(0);
  });

  it('applies a row padding to every cell and moves no column boundary', () => {
    const html = htmlOf(
      flow([
        {
          type: 'table',
          id: 't',
          columns: [
            { id: 'a', width: 1, align: 'start' },
            { id: 'b', width: 1, align: 'end' },
          ],
          header: [],
          body: [
            {
              type: 'tableRow',
              id: 'r',
              box: { padding: { top: 1.2, right: 1.2, bottom: 1.2, left: 1.2 } },
              cells: [{ columnId: 'a', children: [literal('c', 'x')] }],
            },
          ],
          footer: [],
        },
      ]),
    );
    const paddings = html.match(/padding:1\.2mm 1\.2mm 1\.2mm 1\.2mm/g) ?? [];
    expect(paddings).toHaveLength(2);
    expect(html).toContain('<col style="width:50%">');
  });

  it('gives an image the full width of its parent and an automatic height', () => {
    const css = cssOf();
    expect(css).toContain('.ov-image{display:block;width:100%;height:auto}');
    const html = htmlOf(flow([{ type: 'image', id: 'i', src: TINY_PNG }]));
    expect(html).toContain(`<img class="ov-image" src="${TINY_PNG}">`);
  });

  it('emits justify without a last-line rule and without letter spacing', () => {
    const html = htmlOf(
      flow([
        { type: 'text', id: 'j', align: 'justify', content: [{ kind: 'literal', text: 'x' }] },
      ]),
    );
    expect(html).toContain('text-align:justify');
    expect(html).not.toContain('text-align-last');
    expect(html).not.toContain('letter-spacing');
  });
});

describe('adjacent table rules', () => {
  const edge = (width: number, color: string): BorderEdge => ({ width, color });

  it('gives an internal boundary to the following row on a tie', () => {
    const rules = resolveRowRules(
      [{ bottom: edge(0.4, '#000000') }, { top: edge(0.4, '#ff0000') }],
      undefined,
    );
    expect(rules[0]?.bottom).toBeUndefined();
    expect(rules[1]?.top).toStrictEqual(edge(0.4, '#ff0000'));
  });

  it('gives an internal boundary to the wider rule, whichever side declared it', () => {
    const wider = resolveRowRules(
      [{ bottom: edge(1.2, '#000000') }, { top: edge(0.4, '#ff0000') }],
      undefined,
    );
    expect(wider[0]?.bottom).toStrictEqual(edge(1.2, '#000000'));
    expect(wider[1]?.top).toBeUndefined();

    const narrower = resolveRowRules(
      [{ bottom: edge(0.4, '#000000') }, { top: edge(1.2, '#ff0000') }],
      undefined,
    );
    expect(narrower[0]?.bottom).toBeUndefined();
    expect(narrower[1]?.top).toStrictEqual(edge(1.2, '#ff0000'));
  });

  it('never assigns one boundary to both of its sides', () => {
    for (const [first, second] of [
      [0.1, 0.1],
      [0.1, 5],
      [5, 0.1],
      [0, 0.3],
      [0.3, 0],
    ] as const) {
      const rules = resolveRowRules(
        [
          first === 0 ? {} : { bottom: edge(first, '#000000') },
          second === 0 ? {} : { top: edge(second, '#ff0000') },
        ],
        undefined,
      );
      const painted = [rules[0]?.bottom, rules[1]?.top].filter(
        (candidate) => candidate !== undefined,
      );
      expect(painted.length).toBeLessThanOrEqual(1);
    }
  });

  it('gives the perimeter to the table on a tie and to a strictly wider row', () => {
    const table = {
      top: edge(0.4, '#0000ff'),
      bottom: edge(0.4, '#0000ff'),
      left: edge(0.4, '#0000ff'),
      right: edge(0.4, '#0000ff'),
    };
    const [tie] = resolveRowRules(
      [{ top: edge(0.4, '#ff0000'), left: edge(0.4, '#ff0000') }],
      table,
    );
    expect(tie?.top).toBeUndefined();
    expect(tie?.left).toBeUndefined();
    const [wins] = resolveRowRules(
      [{ top: edge(1.2, '#ff0000'), left: edge(1.2, '#ff0000') }],
      table,
    );
    expect(wins?.top).toStrictEqual(edge(1.2, '#ff0000'));
    expect(wins?.left).toStrictEqual(edge(1.2, '#ff0000'));
  });

  it('paints a row rule on the outermost cell only, and never adds two widths', () => {
    const html = htmlOf(
      flow([
        {
          type: 'table',
          id: 't',
          columns: [
            { id: 'a', width: 1, align: 'start' },
            { id: 'b', width: 1, align: 'start' },
          ],
          header: [],
          body: [
            {
              type: 'tableRow',
              id: 'one',
              box: { border: { bottom: { width: 0.28, color: '#000000' } } },
              cells: [{ columnId: 'a', children: [literal('c1', 'x')] }],
            },
            {
              type: 'tableRow',
              id: 'two',
              box: { border: { top: { width: 1.2, color: '#8c3a1b' } } },
              cells: [{ columnId: 'a', children: [literal('c2', 'y')] }],
            },
          ],
          footer: [],
        },
      ]),
    );
    /* The wider rule took the boundary, and it belongs to the following row, so it is painted as
       that row's top band on each of its cells. The narrower one paints nowhere: 0.28 and 1.2 are
       never added into 1.48. */
    const bands = html.match(/inset 0 1\.2mm 0 0 #8c3a1b/g) ?? [];
    expect(bands).toHaveLength(2);
    expect(html).not.toContain('0.28mm');
    expect(html).not.toContain('1.48mm');
    expect(html).not.toMatch(/inset [^;"]*#000000/);
  });
});

describe('serialisation', () => {
  it('produces the same bytes twice for the same materialised document', () => {
    const overrides = flow([literal('t', 'x')]);
    expect(pagedHtmlOf(overrides, {})).toBe(pagedHtmlOf(overrides, {}));
  });

  it('writes attributes in a fixed order regardless of the construction site', () => {
    const html = htmlOf(flow([literal('t', 'x')]));
    expect(html).toMatch(/<div class="ov-text" style="text-align:start" data-openview-node="t">/);
  });

  it('writes a void element without a closing tag', () => {
    const html = htmlOf(flow([{ type: 'image', id: 'i', src: TINY_PNG }]));
    expect(html).not.toContain('</img>');
    expect(html).not.toContain('</col>');
  });

  it('opens with a doctype and closes the document', () => {
    const html = htmlOf(flow([]));
    expect(html.startsWith('<!doctype html><html><head>')).toBe(true);
    expect(html.endsWith('</body></html>')).toBe(true);
  });
});

import { STANDARD_SHEETS_MM } from '@openview/core';
import { describe, expect, it } from 'vitest';
import { documentImages } from '../document/images.js';
import { materializeDocument } from '../document/materialize.js';
import { buildHtmlTree } from '../html/build.js';
import { serializeHtml } from '../html/serialize.js';
import { SAMPLE_DATA, TINY_PNG, templateOf } from './fixtures.js';

const image = (id: string): Record<string, unknown> => ({ type: 'image', id, src: TINY_PNG });

const text = (id: string): Record<string, unknown> => ({
  type: 'text',
  id,
  content: [{ kind: 'literal', text: id }],
});

describe('the image manifest a strategy is handed', () => {
  it('finds an image nested in containers, in a loop and in a condition', () => {
    const document = materializeDocument(
      templateOf({
        root: {
          type: 'container',
          id: 'root',
          children: [
            text('before'),
            { type: 'container', id: 'wrap', children: [image('nested')] },
            {
              type: 'loop',
              id: 'each',
              each: { kind: 'path', path: 'sample.items' },
              as: 'item',
              children: [image('repeated')],
            },
            {
              type: 'condition',
              id: 'when',
              when: { kind: 'literal', value: true },
              children: [image('conditional')],
            },
          ],
        },
      }),
      SAMPLE_DATA,
    );
    expect(documentImages(document).map((found) => found.nodeId)).toStrictEqual([
      'nested',
      'repeated',
      'repeated',
      'conditional',
    ]);
  });

  it('finds an image in every section of a table, and none in a text block', () => {
    const row = (id: string, cellId: string): Record<string, unknown> => ({
      type: 'tableRow',
      id,
      cells: [{ columnId: 'c', children: [image(cellId)] }],
    });
    const document = materializeDocument(
      templateOf({
        root: {
          type: 'container',
          id: 'root',
          children: [
            {
              type: 'table',
              id: 'grid',
              columns: [{ id: 'c', width: 1, align: 'start' }],
              header: [row('head', 'in-header')],
              body: [
                {
                  type: 'tableRowGroup',
                  id: 'group',
                  each: { kind: 'path', path: 'sample.items' },
                  as: 'item',
                  rows: [row('detail', 'in-body')],
                },
              ],
              footer: [row('foot', 'in-footer')],
            },
            text('after'),
          ],
        },
      }),
      SAMPLE_DATA,
    );
    expect(documentImages(document).map((found) => found.nodeId)).toStrictEqual([
      'in-header',
      'in-body',
      'in-body',
      'in-footer',
    ]);
  });

  it('collects the bands too, in paint order', () => {
    const band = (id: string) => ({
      type: 'container',
      id,
      children: [image(`${id}-mark`)],
    });
    const document = materializeDocument(
      templateOf({
        page: {
          sheet: { ...STANDARD_SHEETS_MM.a4 },
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          header: [{ on: 'every', content: band('head') }],
          footer: [{ on: 'lastOnly', content: band('foot') }],
        },
        root: { type: 'container', id: 'root', children: [image('body-mark')] },
      }),
      {},
    );
    expect(documentImages(document).map((found) => found.nodeId)).toStrictEqual([
      'head-mark',
      'body-mark',
      'foot-mark',
    ]);
  });

  it('names the declaration and its path, and nothing of the data', () => {
    const document = materializeDocument(
      templateOf({
        root: {
          type: 'container',
          id: 'root',
          children: [{ type: 'container', id: 'wrap', children: [image('logo')] }],
        },
      }),
      {},
    );
    expect(documentImages(document)).toStrictEqual([
      {
        nodeId: 'logo',
        path: ['root', 'children', 0, 'children', 0],
        src: TINY_PNG,
      },
    ]);
  });

  it('is empty for a document with no image', () => {
    const document = materializeDocument(
      templateOf({ root: { type: 'container', id: 'root', children: [text('only')] } }),
      {},
    );
    expect(documentImages(document)).toStrictEqual([]);
  });
});

describe('a length small enough to write itself as an exponent', () => {
  it('is emitted as a decimal, because no css declaration accepts an exponent', () => {
    /* The contract bounds a padding to [0, MAX_SHEET_MM] and nothing more, so 1e-7 mm is a legal
       padding -- and `String(1e-7)` is `"1e-7"`, which no browser parses. */
    const html = serializeHtml(
      buildHtmlTree(
        materializeDocument(
          templateOf({
            root: {
              type: 'container',
              id: 'root',
              box: { padding: { top: 1e-7, right: 0, bottom: 0, left: 0 } },
              children: [],
            },
          }),
          {},
        ),
      ),
    );
    expect(html).not.toContain('1e-7');
    expect(html).toContain('padding:0.000000100mm 0mm 0mm 0mm');
  });
});

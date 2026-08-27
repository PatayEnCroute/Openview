/**
 * Page setup test fixtures used across core tests.
 */

import type {
  BlockNode,
  ContainerNode,
  TextNode,
  TextPageCountSegment,
  TextSegment,
} from '../../ast/nodes.js';

/** The counting markers this page declares; a report marker also carries its rounding. */
type CountingField = TextPageCountSegment['field'];

import type { PathExpression, PrintableExpression } from '../../expression/expression.js';
import type { PageSetup } from '../page.js';

const lit = (text: string): TextSegment => ({ kind: 'literal', text });
const bind = (value: PrintableExpression): TextSegment => ({ kind: 'binding', value });
const pageField = (field: CountingField): TextSegment => ({ kind: 'pageField', field });
const p = (path: string): PathExpression => ({ kind: 'path', path });
const text = (id: string, content: readonly TextSegment[]): TextNode => ({
  type: 'text',
  id,
  content,
});
const container = (id: string, children: readonly BlockNode[]): ContainerNode => ({
  type: 'container',
  id,
  children,
});

/**
 * Standard A4 recipe page fixture with headers and non-overlapping footers.
 */
export const RECIPE_PAGE: PageSetup = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 15, bottom: 25, left: 15 },
  header: [
    {
      on: 'every',
      content: container('hdr', [
        text('hdr-title', [lit('Facture n° '), bind(p('facture.numero'))]),
      ]),
    },
  ],
  footer: [
    {
      on: 'exceptLast',
      content: container('ftr', [
        text('ftr-num', [lit('Page '), pageField('number'), lit(' / '), pageField('count')]),
      ]),
    },
    {
      on: 'lastOnly',
      content: container('ftr-last', [
        text('ftr-last-num', [lit('Page '), pageField('number'), lit(' / '), pageField('count')]),
        text('ftr-last-note', [bind(p('facture.mentions'))]),
      ]),
    },
  ],
};

/**
 * The recipe page of lot C4, shared by `page.test.ts`, `template/__tests__/paths.test.ts` and
 * `ast/__tests__/fixtures.ts` -- one page, several files, no copy.
 *
 * **This file carries constants and the factories that build them, and nothing else.** It is
 * not a test file: it holds no `it`, so Vitest does not collect it. But it IS instrumented by
 * coverage and it IS compiled into `dist/` and shipped in the tarball -- the two regimes lot
 * C3 discovered for `ast/__tests__/fixtures.ts`. Two rules follow, each with a mechanical
 * criterion in the plan's §6.4:
 *
 * - **No exported factory goes uncalled.** It would be instrumented, never covered, and
 *   `noUnusedLocals` does not see an export -- so it would lower `core`'s function coverage
 *   without one test going red. Every factory below is therefore LOCAL.
 * - **Nothing is imported from `vitest`.** That is the one real accident for a module embedded
 *   in the published package.
 */

import type { BlockNode, ContainerNode, TextNode, TextSegment } from '../../ast/nodes.js';
import type { PathExpression, PrintableExpression } from '../../expression/expression.js';
import type { PageSetup } from '../page.js';

const lit = (text: string): TextSegment => ({ kind: 'literal', text });
const bind = (value: PrintableExpression): TextSegment => ({ kind: 'binding', value });
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
 * The page the recipe criterion of lot C4 asks for, word for word: a template that IMPOSES
 * its format and its margins, DECLARES what repeats at the top and at the bottom of every
 * page, and what appears on the LAST one only.
 *
 * Annotated `PageSetup` rather than inferred, and that annotation is a gate: a required field
 * added to the type makes gate 3 redden here, which is the only place it would.
 *
 * A4 portrait. The dimensions are written by the AUTHOR of the template: Openview imposes no
 * format and reserves no name for one. `STANDARD_SHEETS_MM.a4` is a writing convenience, not
 * a value of the contract.
 *
 * The running footer is `exceptLast` and NOT `every`, and that is not a matter of style: this
 * page also carries a last-page footer, and since `every` overlaps everything the pair
 * `every` + `lastOnly` is REFUSED by the schema. `exceptLast` + `lastOnly` is the only legal
 * spelling of this model -- which is exactly why the third occurrence exists.
 *
 * The one-page trap, written here because a fixture is what gets copied: on a single-page
 * invoice -- lot E1's case -- this model renders the `lastOnly` footer and NOT the
 * `exceptLast` one, because the only page IS the last. That is correct, and it is why BOTH
 * footers carry the numbering.
 *
 * It deliberately does NOT use `firstOnly` / `exceptFirst`, though the lot delivers them: the
 * criterion says "what repeats at the top of EVERY page", so the header has to be `every` to
 * demonstrate it. The opening pair is covered by the invariant tests instead.
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
      content: container('ftr', [text('ftr-num', [lit('Page ')])]),
    },
    {
      on: 'lastOnly',
      content: container('ftr-last', [
        text('ftr-last-num', [lit('Page ')]),
        text('ftr-last-note', [bind(p('facture.mentions'))]),
      ]),
    },
  ],
};

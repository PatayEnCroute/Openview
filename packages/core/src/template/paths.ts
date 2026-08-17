import { collectDataPaths } from '../ast/visitor.js';
import type { PageBand } from '../page/page.js';
import type { Template } from './template.js';

/**
 * Every data path a TEMPLATE reads from the caller's data -- the flow AND the page bands --
 * in traversal order and de-duplicated.
 *
 * `collectDataPaths` takes a NODE, and lot C4 put the repeated bands outside `root`. Without
 * this function, a binding in a header is invisible to every analysis, and the symptom is
 * not an error but a blank: the caller was told to supply `facture.numero`, was never told
 * about `client.nom`, and the header prints empty. Two docstrings in production promise
 * otherwise -- `ports/render.ts` ("collectDataPaths tells the caller which ones") and
 * `template.ts` ("collectDataPaths recovers exactly that") -- so leaving the hole would put
 * two texts of this repository in contradiction.
 *
 * A function of its own rather than a widened signature: `collectDataPaths(DocumentNode |
 * Template)` would have to tell a `Template` from a `ContainerNode` at runtime -- both are
 * objects -- so it would test a property (`'root' in value`), which is a shape check inside
 * an analysis function, and the most-read function of the package would change contract for
 * every caller it already has.
 *
 * Order is `root`, then `header`, then `footer`, and it is written down because a test that
 * compares an ordered list pins a choice, and an unwritten choice changes by accident. The
 * `Set` is SEEDED by the first call rather than filled from a concatenation: seeding keeps
 * `root`'s insertion order and never materialises an intermediate array of every path,
 * duplicates included.
 *
 * It lives in `template/` rather than in `ast/` because it takes a `Template`: the
 * dependency runs template -> ast, never the other way.
 *
 * The three limits `collectDataPaths` documents are inherited UNCHANGED: a per-item field
 * is invisible, an alias that shadows a caller key is not reported, and an alias bound
 * inside an expression is not either. This lot fixes none and adds none. And it returns
 * nothing for a page-field marker, because that segment reads no data -- which is one of
 * the three arguments that sink the "reserved scope key" mechanism for page numbering.
 *
 * ONE HOLE IT DOES NOT CLOSE, and it is a different one: node id UNIQUENESS. Until this lot
 * a template had one root; it now has one root per band plus `root`, so two nodes of two
 * different bands may carry the same id with no schema complaining, and
 * `findNodeById(template.root, id)` will never reach a header node. No uniqueness rule is
 * added here -- the migration writes EMPTY bands, so it creates no ids -- but the day the
 * editor addresses a node by id across a whole model, it will need either a
 * `findNodeInTemplate` or that rule, and that is a designer lot rather than a repair of C4.
 */
export function collectTemplateDataPaths(template: Template): readonly string[] {
  const found = new Set<string>(collectDataPaths(template.root));
  const bands: readonly PageBand[] = [...template.page.header, ...template.page.footer];
  for (const band of bands) {
    for (const dataPath of collectDataPaths(band.content)) {
      found.add(dataPath);
    }
  }
  return [...found];
}

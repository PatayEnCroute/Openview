import { collectDataPaths } from '../ast/visitor.js';
import type { PageBand } from '../page/page.js';
import type { Template } from './template.js';

/**
 * Collects every unique data path read by a template across its flow and page bands in traversal order.
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

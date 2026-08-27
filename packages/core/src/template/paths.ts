import { collectDataPaths } from '../ast/traverse.js';
import type { PageBand } from '../page/page.js';
import type { Template } from './template.js';

/**
 * Collects every unique data path read by a template across its flow, page bands and page layers,
 * in traversal order: flow, header, footer, then layers in stored order.
 */
export function collectTemplateDataPaths(template: Template): readonly string[] {
  const found = new Set<string>(collectDataPaths(template.root));
  const bands: readonly PageBand[] = [...template.page.header, ...template.page.footer];
  for (const band of bands) {
    for (const dataPath of collectDataPaths(band.content)) {
      found.add(dataPath);
    }
  }
  for (const layer of template.page.layers ?? []) {
    for (const dataPath of collectDataPaths(layer.content)) {
      found.add(dataPath);
    }
  }
  return [...found];
}

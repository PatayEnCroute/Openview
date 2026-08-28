import { kindOf } from '@openview/core';
import { escapeAttribute, escapeText } from './escape.js';
import { type HtmlElement, type HtmlNode, type HtmlTree, VOID_ELEMENTS } from './types.js';

/** Content Security Policy applied to rendered HTML documents. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  'img-src data:',
  "style-src 'unsafe-inline'",
  "script-src 'none'",
  "connect-src 'none'",
  'font-src data:',
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Deterministic attribute serialization order. */
const ATTRIBUTE_ORDER = [
  'class',
  'style',
  'src',
  'alt',
  'data-openview-node',
  'data-openview-key',
  'data-openview-run',
  'data-openview-region',
  'data-openview-grid-item',
  'data-openview-page',
] as const;

function serializeElement(node: HtmlElement): string {
  let attributes = '';
  for (const name of ATTRIBUTE_ORDER) {
    const value = node.attributes[name];
    if (value !== undefined) {
      attributes += ` ${name}="${escapeAttribute(value)}"`;
    }
  }
  const open = `<${node.name}${attributes}>`;
  if (VOID_ELEMENTS.has(node.name)) {
    return open;
  }
  return `${open}${node.children.map(serializeNode).join('')}</${node.name}>`;
}

function serializeNode(node: HtmlNode): string {
  switch (node.kind) {
    case 'text':
      return escapeText(node.text);
    case 'element':
      return serializeElement(node);
    default: {
      const exhaustive: never = node;
      throw new TypeError(`Unhandled html node: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

/**
 * Serializes an HTML tree into a standalone HTML5 document string.
 */
export function serializeHtml(tree: HtmlTree): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(CONTENT_SECURITY_POLICY)}">` +
    `<style>${tree.css}</style></head><body>${tree.body.map(serializeNode).join('')}</body></html>`
  );
}

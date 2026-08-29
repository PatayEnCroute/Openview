import { kindOf } from '@openview/core';
import { escapeAttribute, escapeText } from './escape.js';
import { type HtmlElement, type HtmlNode, type HtmlTree, VOID_ELEMENTS } from './types.js';
import { createHtmlWriter, type HtmlWriter } from './writer.js';

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

function writeElement(node: HtmlElement, out: HtmlWriter): void {
  /* Written piece by piece rather than assembled first: an attribute value can be an inline image
     of several mebibytes, and escaping it whole would allocate the expanded copy before anything
     had a chance to refuse it. */
  out.write(`<${node.name}`);
  for (const name of ATTRIBUTE_ORDER) {
    const value = node.attributes[name];
    if (value !== undefined) {
      out.write(` ${name}="`);
      out.writeEscaped(value, escapeAttribute);
      out.write('"');
    }
  }
  out.write('>');
  if (VOID_ELEMENTS.has(node.name)) {
    return;
  }
  for (const child of node.children) {
    writeNode(child, out);
  }
  out.write(`</${node.name}>`);
}

function writeNode(node: HtmlNode, out: HtmlWriter): void {
  switch (node.kind) {
    case 'text':
      out.writeEscaped(node.text, escapeText);
      return;
    case 'element':
      writeElement(node, out);
      return;
    default: {
      const exhaustive: never = node;
      throw new TypeError(`Unhandled html node: ${kindOf(exhaustive, 'kind')}`);
    }
  }
}

/**
 * Serializes an HTML tree into a standalone HTML5 document string, under a byte ceiling.
 *
 * Fragments are counted as they are appended, so a document over the ceiling is refused before the
 * oversized string exists. Under the ceiling the bytes are exactly what a plain concatenation of
 * the same tree produces.
 */
export function serializeHtml(tree: HtmlTree, limit: number): string {
  const out = createHtmlWriter(limit);
  out.write('<!doctype html><html><head><meta charset="utf-8">');
  out.write(
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(CONTENT_SECURITY_POLICY)}">`,
  );
  out.write('<style>');
  out.write(tree.css);
  out.write('</style></head><body>');
  for (const node of tree.body) {
    writeNode(node, out);
  }
  out.write('</body></html>');
  return out.toString();
}

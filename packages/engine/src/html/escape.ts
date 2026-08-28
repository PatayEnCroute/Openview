const TEXT_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text content for safe inclusion in HTML. */
export function escapeText(text: string): string {
  return text.replace(/[&<>"']/g, (char) => TEXT_ESCAPES[char] ?? char);
}

/** Escapes attribute values for safe inclusion in HTML elements. */
export function escapeAttribute(value: string): string {
  return escapeText(value);
}

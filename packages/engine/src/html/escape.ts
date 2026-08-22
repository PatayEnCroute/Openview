const TEXT_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes character data. Quotes are escaped too, although text position does not require it: one
 * table for both positions removes the class of bug where the wrong helper is called.
 */
export function escapeText(text: string): string {
  return text.replace(/[&<>"']/g, (char) => TEXT_ESCAPES[char] ?? char);
}

/** Escapes an attribute value. Same table, and the result is always written inside double quotes. */
export function escapeAttribute(value: string): string {
  return escapeText(value);
}

/** Characters kept verbatim inside a css string: everything else becomes a hex escape. */
const CSS_SAFE = /^[\w \-.]$/;

/**
 * Writes a css string literal.
 *
 * Everything outside letters, digits, underscore, space, hyphen and dot becomes a `\hh ` escape, so
 * a family name can carry neither a `;` that would open a second declaration nor a `"` that would
 * close the value. The trailing space terminates the hex escape and is consumed by the parser.
 */
export function cssString(value: string): string {
  let escaped = '';
  for (const char of value) {
    if (CSS_SAFE.test(char)) {
      escaped += char;
      continue;
    }
    escaped += `\\${(char.codePointAt(0) ?? 0).toString(16)} `;
  }
  return `"${escaped}"`;
}

/**
 * The generic families that must stay unquoted to keep their keyword meaning.
 *
 * `system-ui` is deliberately absent: it resolves to the host's interface font, which is the machine
 * speaking rather than the template. A template naming it gets a quoted family name that matches
 * nothing, and the browser falls back.
 */
const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
]);

/** Writes a font family: a generic keyword as itself, any other name as an escaped css string. */
export function cssFontFamily(family: string): string {
  return GENERIC_FAMILIES.has(family) ? family : cssString(family);
}

import type { TableColumnAlignment, TextAlignment } from '../ast/types.js';
import type { Typography } from './types.js';

/**
 * Sources for resolving typography on a text segment: inline run and enclosing block.
 */
export interface TypographySources {
  readonly run?: Typography | undefined;
  readonly block?: Typography | undefined;
}

/**
 * Merges typography attributes property by property with run-level precedence over block-level.
 * Returns undefined if no attribute is defined.
 */
export function resolveTypography(sources: TypographySources): Typography | undefined {
  const { run, block } = sources;
  const typography: Typography = {
    family: run?.family ?? block?.family,
    sizePt: run?.sizePt ?? block?.sizePt,
    bold: run?.bold ?? block?.bold,
    italic: run?.italic ?? block?.italic,
    color: run?.color ?? block?.color,
  };
  return Object.values(typography).some((value) => value !== undefined) ? typography : undefined;
}

/**
 * Sources for resolving text alignment: explicit block alignment and inherited table column alignment.
 */
export interface TextAlignSources {
  readonly text?: TextAlignment | undefined;
  readonly column?: TableColumnAlignment | undefined;
}

/**
 * Resolves text alignment with block-level alignment taking precedence over column-level alignment.
 */
export function resolveTextAlign(sources: TextAlignSources): TextAlignment | undefined {
  const { text, column } = sources;
  return text ?? column;
}

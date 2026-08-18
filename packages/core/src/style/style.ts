/**
 * The appearance contract: what a template says about how a block and its characters LOOK.
 *
 * Barrel by design -- consumers import from here, never from ./types.js, ./schemas.js,
 * ./units.js or ./resolve.js, so the split inside this folder stays free to change. Lot C3 had
 * to pay for that split after the fact, in a dedicated increment; `page/` was born divided, and
 * so is this folder.
 *
 * ONE DEVIATION FROM THAT RULE IS MEASURED AND DELIBERATE, in the other direction: ./types.ts
 * imports `MAX_SHEET_MM` from `../page/types.js` rather than from the `page/page.js` barrel,
 * because `ast/schemas.ts` imports the schemas below as VALUES and the barrel closes an ESM
 * cycle through `page/schemas.js` -> `ast/nodes.js` -> `ast/schemas.js`. See
 * {@link MAX_FONT_SIZE_PT} for the measurement and the exact `ReferenceError`.
 *
 * What is NOT here, and it is not an oversight: the ACCRUAL SITES. `box`, `typography` and
 * `align` are fields of node types, so they live in `ast/`, beside the nodes that carry them --
 * the same rule that keeps `PAGE_FIELDS` in `ast/` and out of `page/`. This folder declares the
 * shapes and validates them; it names no carrier.
 *
 * The lines below are sorted BY MODULE PATH, and that is not a choice this file makes: Biome's
 * `organizeImports` assist enforces it, and `pnpm run lint` fails otherwise. It is worth knowing
 * why that is safe here, because the re-exports of an ESM module ARE evaluated in writing order:
 * `style/resolve.js` has no runtime import at all -- verified on the emitted JavaScript -- so
 * none of these four modules can observe another's initialisation. THE DAY ONE OF THEM IMPORTS A
 * VALUE FROM A SIBLING, the order would become load-bearing and this file could not express it,
 * because the assist would keep sorting it: the fix then is to break the dependency, not to
 * reorder the barrel.
 *
 * What this barrel deliberately does NOT export: the internal millimetre length schema
 * (exporting it would publish a fourth length vocabulary), any `*_IN_STEP` assertion (they live
 * in `__tests__/`), any second name for `MAX_SHEET_MM`, any font-weight table, any
 * `ResolvedTypography`, and no bounded door of its own -- a style is never a standalone
 * fragment, it always lives in a node, and `parseBlockNode` validates it already.
 */
export type { TextAlignSources, TypographySources } from './resolve.js';
export { resolveTextAlign, resolveTypography } from './resolve.js';
export {
  BorderEdgeSchema,
  BoxBorderSchema,
  BoxSpacingSchema,
  BoxStyleSchema,
  ColorSchema,
  TypographySchema,
} from './schemas.js';
export type { BorderEdge, BoxBorder, BoxSpacing, BoxStyle, Color, Typography } from './types.js';
export { MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from './types.js';
export { mmFromPt, ptFromMm } from './units.js';

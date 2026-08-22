/**
 * @openview/adapter-puppeteer
 * Chromium print backend for the pdf port of `@openview/engine`.
 *
 * Its own package because Puppeteer downloads a browser: an integrator who installs the engine
 * alone never pays for one.
 */

export { HONOURED_SHEET_MM, SHEET_TOLERANCE_PT } from './capability.js';
export { ACCEPTED_IMAGE_PREFIXES } from './image-source.js';
export type { PuppeteerPdfStrategyOptions } from './puppeteer-pdf-strategy.js';
export { createPuppeteerPdfStrategy } from './puppeteer-pdf-strategy.js';

/**
 * @openview/adapter-puppeteer
 * Chromium print backend for the pdf port of `@openview/engine`.
 *
 * Its own package because Puppeteer downloads a browser: an integrator who installs the engine
 * alone never pays for one.
 *
 * Two façades. `createPuppeteerPdfStrategy` is the direct path, for an integrator that controls its
 * own templates and data. `createPuppeteerRenderRuntime` is the hardened one, and it is the only
 * one a service may point at a document it does not control: it alone bounds time, memory,
 * concurrency and every byte a document can make this process load.
 */

export type { PuppeteerLaunchOptions } from './browser.js';
export { closeBrowser, launchBrowser } from './browser.js';
export { HONOURED_SHEET_MM, SHEET_TOLERANCE_PT } from './capability.js';
export { ACCEPTED_IMAGE_PREFIXES } from './image-source.js';
export { assertCanonicalSize, readBoundedPdf } from './pdf-stream.js';
export type { PuppeteerPdfStrategyOptions } from './puppeteer-pdf-strategy.js';
export { createPuppeteerPdfStrategy } from './puppeteer-pdf-strategy.js';
export { classifyAddress, normalizeHttpsUrl } from './resource/address.js';
export type { ImageBroker } from './resource/broker.js';
export { createImageBroker } from './resource/broker.js';
export { InvalidProtectedConfigurationError } from './resource/errors.js';
export type {
  AddressResolver,
  PinnedRequest,
  RemoteResponse,
  RemoteTransport,
  ResolvedAddress,
} from './resource/fetch.js';
export {
  ProtectedImageManifestSchema,
  ProtectedResourceLimitsSchema,
  resolveImageManifest,
  resolveResourceLimits,
} from './resource/schemas.js';
export type {
  ProtectedImageAsset,
  ProtectedImageManifest,
  ProtectedMediaType,
  ProtectedResourceLimits,
  ProtectedResourceLimitsOverrides,
} from './resource/types.js';
export {
  DEFAULT_RESOURCE_LIMITS,
  PROTECTED_MEDIA_TYPES,
  RESOURCE_HARD_CEILINGS,
} from './resource/types.js';
export type { ProtectedRenderAuditEvent, ProtectedRenderOutcome } from './runtime/audit.js';
export { RENDER_AUDIT_CHANNEL, RENDER_OUTCOMES } from './runtime/audit.js';
export type {
  ProtectedRuntimeLimits,
  ProtectedRuntimeLimitsOverrides,
} from './runtime/limits.js';
export {
  DEFAULT_RUNTIME_LIMITS,
  ProtectedRuntimeLimitsSchema,
  RUNTIME_HARD_CEILINGS,
  resolveRuntimeLimits,
} from './runtime/limits.js';
export type {
  ProtectedPaginationPort,
  ProtectedPdfRenderPort,
  ProtectedRenderCallOptions,
  PuppeteerRenderRuntime,
  PuppeteerRenderRuntimeOptions,
} from './runtime/runtime.js';
export { createPuppeteerRenderRuntime } from './runtime/runtime.js';
export type { SessionImagePolicy } from './session.js';
export { PDF_OPTIONS } from './session.js';

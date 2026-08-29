import {
  type PaginationPort,
  type PaginationResult,
  PaginationResultSchema,
  type RenderPort,
  type RenderRequest,
  type RenderResult,
} from '@openview/core';
import {
  DocumentRenderError,
  PDF_CONTENT_TYPE,
  type PdfRenderResources,
  type PdfRenderSession,
} from '@openview/engine';
import { closeBrowser, launchBrowser, type PuppeteerLaunchOptions } from '../browser.js';
import { normalizeHttpsUrl } from '../resource/address.js';
import { createImageBroker } from '../resource/broker.js';
import type { AddressResolver, RemoteTransport } from '../resource/fetch.js';
import { createNodeResolver, createNodeTransport } from '../resource/node-transport.js';
import { resolveImageManifest, resolveResourceLimits } from '../resource/schemas.js';
import type {
  ProtectedImageManifest,
  ProtectedResourceLimits,
  ProtectedResourceLimitsOverrides,
} from '../resource/types.js';
import { openContextSession } from '../session.js';
import {
  type ProtectedRuntimeLimits,
  type ProtectedRuntimeLimitsOverrides,
  resolveRuntimeLimits,
} from './limits.js';
import { createNodeWorkerFactory } from './node-worker.js';
import { createRenderPool, type RenderPool } from './pool.js';
import type { WorkerEngineOptions } from './protocol.js';
import type { BrowserFactory, SlotBrowser, WorkerFactory } from './slot.js';
import { createTransportBudget, snapshotValue, type TransportLimits } from './snapshot.js';

const NOT_A_DATA_SET =
  "The data set of this request is not a set of named values. Its names are the caller's own and none of them is reserved here, but a request has to carry an object for the model to read anything from it at all.";

const BAD_RESULT =
  'The isolated worker of this render answered with a value this runtime cannot read as a document. The slot is treated as unprovable rather than the value as usable.';

/** What a caller may say about one call, beyond the request itself. */
export interface ProtectedRenderCallOptions {
  readonly signal?: AbortSignal | undefined;
}

/** The pdf port of a hardened runtime, still assignable to the plain one. */
export interface ProtectedPdfRenderPort extends RenderPort {
  render(
    request: RenderRequest,
    options?: ProtectedRenderCallOptions | undefined,
  ): Promise<RenderResult>;
}

/** The pagination port of a hardened runtime, still assignable to the plain one. */
export interface ProtectedPaginationPort extends PaginationPort {
  paginate(
    request: RenderRequest,
    options?: ProtectedRenderCallOptions | undefined,
  ): Promise<PaginationResult>;
}

/** A hardened runtime the caller owns, and must close. */
export interface PuppeteerRenderRuntime {
  readonly pdf: ProtectedPdfRenderPort;
  readonly pagination: ProtectedPaginationPort;
  close(): Promise<void>;
}

/** Everything a hardened runtime is configured with. */
export interface PuppeteerRenderRuntimeOptions {
  readonly limits?: ProtectedRuntimeLimitsOverrides | undefined;
  readonly resourceLimits?: ProtectedResourceLimitsOverrides | undefined;
  /** Engine ceilings and presentation selection, forwarded to every render. */
  readonly engine?: WorkerEngineOptions | undefined;
  /** The exact sources this runtime may load, with their expected digests. */
  readonly imageManifest?: ProtectedImageManifest | undefined;
  readonly launch?: PuppeteerLaunchOptions | undefined;
  /** Https client, injected by a test or a host that owns its own egress. */
  readonly transport?: RemoteTransport | undefined;
  /** Name resolution, injected for the same reason. */
  readonly resolver?: AddressResolver | undefined;
  /** Worker factory, injected so a fixture thread can stand in for a real one. */
  readonly workers?: WorkerFactory | undefined;
  /** Browser factory, injected for the same reason. */
  readonly browsers?: BrowserFactory | undefined;
}

/**
 * Whether a url is one the manifest names as a remote source, applied again at every redirect.
 *
 * An entry that carries its own bytes authorises no connection at all: it is the file itself, and
 * reading its source as a reachable target would widen the policy for nothing.
 */
export function manifestAuthorises(manifest: ProtectedImageManifest): (url: string) => boolean {
  return (url: string): boolean =>
    normalizeHttpsUrl(url) !== undefined &&
    manifest.some((asset) => asset.kind === 'https' && asset.source === url);
}

/**
 * The browser factory of a real runtime: one browser per slot, one context per render.
 *
 * The broker is built per render, so cumulative bytes and pixels are forgotten between two
 * documents and no byte of one caller's asset survives into another's.
 */
function puppeteerBrowsers(
  manifest: ProtectedImageManifest,
  limits: ProtectedResourceLimits,
  runtime: ProtectedRuntimeLimits,
  ports: { readonly transport: RemoteTransport; readonly resolver: AddressResolver },
  launch: PuppeteerLaunchOptions | undefined,
): BrowserFactory {
  const authorises = manifestAuthorises(manifest);
  return {
    async create(): Promise<SlotBrowser> {
      const browser = await launchBrowser(launch);
      return {
        async openContext(resources: PdfRenderResources): Promise<PdfRenderSession> {
          const controller = new AbortController();
          const broker = createImageBroker(manifest, limits, {
            transport: ports.transport,
            resolver: ports.resolver,
            authorises,
            signal: controller.signal,
          });
          /* Resolved before a context exists, which is what "refused before loading" has to mean:
             a document that names a source this runtime does not authorise never reaches Chromium.
             The engine asks again for the same occurrences, and the broker answers them from what
             it already loaded rather than fetching anything twice. */
          try {
            await broker.resolve(resources.images);
          } catch (error) {
            controller.abort();
            throw error;
          }
          let session: PdfRenderSession;
          try {
            session = await openContextSession(browser, resources, { images: broker, limits });
          } catch (error) {
            /* Nothing will call `close()` on a session that was never returned, and a resource
               still in flight belongs to this render and to nothing else. */
            controller.abort();
            throw error;
          }
          return {
            resolveImages: session.resolveImages.bind(session),
            measure: session.measure.bind(session),
            print: session.print.bind(session),
            async close(): Promise<void> {
              /* Any resource still in flight belongs to this render and to nothing else. */
              controller.abort();
              await session.close();
            },
          };
        },
        close(): Promise<boolean> {
          return closeBrowser(browser, runtime.shutdownTimeoutMs);
        },
      };
    },
  };
}

/** One request copied into plain data, ready to cross the thread boundary. */
export interface AdmittedRequest {
  readonly template: unknown;
  readonly data: Record<string, unknown>;
}

/**
 * Copies one request under the transport budget, and refuses what is not a request.
 *
 * Takes `unknown` because that is what a service really receives: the caller of a hardened runtime
 * is often json a compiler never saw, and a data set silently replaced by an empty one would render
 * a document of blanks instead of saying the request was not one.
 */
export function admitRequest(
  template: unknown,
  data: unknown,
  transport: TransportLimits,
): AdmittedRequest {
  /* One budget for the two copies: a request is a template and a data set together, and a counter
     opened twice would let it carry twice what its ceilings name. */
  const budget = createTransportBudget(transport);
  const copiedTemplate = snapshotValue(template, budget);
  const copied = snapshotValue(data, budget);
  if (copied === null || typeof copied !== 'object' || Array.isArray(copied)) {
    throw new DocumentRenderError(NOT_A_DATA_SET, 'template-refused', { phase: 'transport' });
  }
  return { template: copiedTemplate, data: { ...copied } };
}

function badResult(): never {
  throw new DocumentRenderError(BAD_RESULT, 'render-worker-failed', { phase: 'export' });
}

/**
 * Creates the hardened façade a service exposes to documents it does not control.
 *
 * Asynchronous because a runtime whose worker or browser cannot answer must fail here, not at its
 * first client. The caller owns it and must `close()` it: the threads, the browsers and the queue
 * are handles, and nothing here reclaims them on its own.
 */
export async function createPuppeteerRenderRuntime(
  options: PuppeteerRenderRuntimeOptions = {},
): Promise<PuppeteerRenderRuntime> {
  const limits = resolveRuntimeLimits(options.limits);
  const resources = resolveResourceLimits(options.resourceLimits);
  const manifest = resolveImageManifest(options.imageManifest);
  const workers =
    options.workers ??
    createNodeWorkerFactory({
      oldSpaceMb: limits.workerOldSpaceMb,
      stackMb: limits.workerStackMb,
    });
  const browsers =
    options.browsers ??
    puppeteerBrowsers(
      manifest,
      resources,
      limits,
      {
        transport: options.transport ?? createNodeTransport(),
        resolver: options.resolver ?? createNodeResolver(),
      },
      options.launch,
    );

  const pool: RenderPool = await createRenderPool(workers, browsers, {
    slots: limits.slots,
    queueDepth: limits.queueDepth,
    queueTimeoutMs: limits.queueTimeoutMs,
    renderTimeoutMs: limits.renderTimeoutMs,
    maxRendersPerWorker: limits.maxRendersPerWorker,
    workerStartTimeoutMs: limits.workerStartTimeoutMs,
  });

  const transport = {
    maxValues: limits.maxTransportValues,
    maxStringLength: limits.maxTransportStringLength,
  };

  const admitted = (request: RenderRequest): AdmittedRequest =>
    admitRequest(request.template, request.data, transport);

  return {
    pdf: {
      format: 'pdf',
      async render(
        request: RenderRequest,
        call?: ProtectedRenderCallOptions | undefined,
      ): Promise<RenderResult> {
        const { template, data } = admitted(request);
        const value = await pool.submit({
          task: { format: 'pdf', template, data, options: options.engine },
          signal: call?.signal,
        });
        if (!(value instanceof Uint8Array)) {
          badResult();
        }
        return { format: 'pdf', bytes: value, contentType: PDF_CONTENT_TYPE };
      },
    },
    pagination: {
      async paginate(
        request: RenderRequest,
        call?: ProtectedRenderCallOptions | undefined,
      ): Promise<PaginationResult> {
        const { template, data } = admitted(request);
        const value = await pool.submit({
          task: { format: 'pagination', template, data, options: options.engine },
          signal: call?.signal,
        });
        const parsed = PaginationResultSchema.safeParse(value);
        if (!parsed.success) {
          badResult();
        }
        return parsed.data;
      },
    },
    async close(): Promise<void> {
      await pool.close();
    },
  };
}

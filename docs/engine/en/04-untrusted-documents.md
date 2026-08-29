# Documents you do not control

This page is for the case where the template, or the data set, can come from someone else.
Rendering a document is running the instructions it carries, so the question is not how big it is.

## One question decides

Who wrote the template, and who wrote the data set? If either can come from a third party — a
tenant, a customer, an upload — the direct path is the wrong tool. Use the hardened runtime.

<!-- docs-api: @openview/adapter-puppeteer createPuppeteerRenderRuntime -->
<!-- docs-api: @openview/adapter-puppeteer PuppeteerRenderRuntimeOptions -->
<!-- docs-region: protected-example.ts#untrusted -->

```ts
import {
  createPuppeteerRenderRuntime,
  type PuppeteerRenderRuntimeOptions,
} from '@openview/adapter-puppeteer';
import type { RenderRequest } from '@openview/core';

/** A service builds one runtime and keeps it; the three gestures are shown here in order. */
export async function renderUntrusted(
  options: PuppeteerRenderRuntimeOptions,
  request: RenderRequest,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const runtime = await createPuppeteerRenderRuntime(options);
  try {
    const { bytes } = await runtime.pdf.render(request, { signal });
    return bytes;
  } finally {
    await runtime.close();
  }
}
```

The runtime owns worker threads and browsers, so a service builds one and keeps it, then closes it
on shutdown. `signal` is yours: an abandoned HTTP request should not keep a slot.

## What crosses the isolate, and what stays behind

The render runs in a worker with its own heap and its own browser context. Only eight fields of a
refusal cross back: `nodeId`, `path`, `region`, `limit`, `observed`, `pageNumber`, `phase` and
`resourceKind`. Diagnostics, causes and stacks stay on the other side, because they are the ones
that can quote document content.

## The defaults

Everything below is configurable, and every ceiling has a hard maximum a caller cannot exceed.
What a document may build, cut and serialise:

<!-- docs-defaults: DEFAULT_RENDER_SAFETY_LIMITS -->

| Key | Default | Unit |
| :-- | ------: | :--- |
| `maxMaterializedUnits` | 250 000 | objects |
| `maxPages` | 100 | pages |
| `maxHtmlBytes` | 33 554 432 | bytes (32 MiB) |

What one runtime allows itself in isolation, waiting and recycling:

<!-- docs-defaults: DEFAULT_RUNTIME_LIMITS -->

| Key | Default | Unit |
| :-- | ------: | :--- |
| `slots` | 1 | concurrent renders |
| `queueDepth` | 4 | held requests |
| `queueTimeoutMs` | 5 000 | ms |
| `renderTimeoutMs` | 30 000 | ms |
| `shutdownTimeoutMs` | 5 000 | ms |
| `workerStartTimeoutMs` | 5 000 | ms |
| `workerOldSpaceMb` | 256 | MiB |
| `workerStackMb` | 4 | MiB |
| `maxRendersPerWorker` | 100 | renders before recycling |
| `maxTransportValues` | 500 000 | values per request |
| `maxTransportStringLength` | 67 108 864 | utf-16 code units |

What one render may load, decode and print:

<!-- docs-defaults: DEFAULT_RESOURCE_LIMITS -->

| Key | Default | Unit |
| :-- | ------: | :--- |
| `maxDistinctImages` | 64 | sources |
| `maxSourceLength` | 16 777 216 | characters |
| `maxImageBytes` | 8 388 608 | bytes (8 MiB) |
| `maxTotalImageBytes` | 33 554 432 | bytes (32 MiB) |
| `maxImagePixels` | 25 000 000 | pixels |
| `maxTotalImagePixels` | 100 000 000 | pixels |
| `resourceTimeoutMs` | 10 000 | ms |
| `maxRedirects` | 3 | hops |
| `maxRawPdfBytes` | 67 108 864 | bytes (64 MiB) |
| `maxCanonicalPdfBytes` | 67 108 864 | bytes (64 MiB) |

The single default slot is not a modest guess: a runtime whose capacity depended on the host would
refuse differently on two machines, and reading the machine is what this engine refuses everywhere.

## Images: nothing is fetched that is not pinned

<!-- docs-api: @openview/adapter-puppeteer ProtectedImageManifest -->

The hardened runtime loads a remote image only if the manifest names that exact source **and** the
digest of the bytes matches the SHA-256 the manifest declares. An origin alone gives neither
integrity nor a reproducible document. Self-contained `data:` bitmaps need no entry; everything
else is refused with `resource-policy-refused`.

## Watching it work

<!-- docs-api: @openview/adapter-puppeteer RENDER_AUDIT_CHANNEL -->

Every render publishes one terminal event on the `node:diagnostics_channel` named
`openview.render.audit`: a runtime-local id, the outcome, the phase, the code when there is one,
and the two durations. Nothing else — no template, no data, no URL, no digest, no stack. Subscribe
and add your own request identity.

<!-- docs-vocabulary: RENDER_OUTCOMES -->

- `succeeded` — a document came out.
- `refused` — the engine said no, and the code says why.
- `timed-out` — the render outlived its slot.
- `cancelled` — the caller aborted it.
- `failed` — something broke that is not a refusal.

## What this runtime does not do

Say it plainly, because a security page that promises more than it delivers is worse than none:

- **The memory of the process is not bounded.** `workerOldSpaceMb` bounds the old generation of one
  V8 isolate. It covers neither array buffers nor Chromium, which lives in its own processes. A
  host exposing this runtime still needs a container or cgroup limit.
- **The hostile corpus and its CI job are not delivered.** Refusals and recovery are proven by unit
  suites and by a test that kills a really blocked thread; there is no executable attack registry.
- **The 60-page / 60 000-line measurement has not been run.** No performance figure is claimed.
- **No TLS socket is ever opened in this repository.** The remote policy — manifest, canonical
  form, pinned DNS, address class, redirects, ceilings, digest — is proven against an injected
  transport. An integrator who enables an `https` entry is the first to exercise that path for real.

These are the reservations of
[ADR 0021](../../adr/0021-le-moteur-survit-a-un-document-hostile.md), copied without softening.

Next: [what is guaranteed, and what is not](./05-guarantees-and-limits.md).

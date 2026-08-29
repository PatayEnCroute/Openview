import { channel } from 'node:diagnostics_channel';
import type { DocumentRenderErrorCode, DocumentRenderPhase } from '@openview/engine';

/** The channel every terminal render outcome is published on. */
export const RENDER_AUDIT_CHANNEL = 'openview.render.audit';

/** How one render ended. */
export const RENDER_OUTCOMES = [
  'succeeded',
  'refused',
  'timed-out',
  'cancelled',
  'failed',
] as const;

export type ProtectedRenderOutcome = (typeof RENDER_OUTCOMES)[number];

/**
 * What one render publishes when it ends, and the whole of it.
 *
 * Deliberately without a logger, a callback or a transport: a rendering engine that owned a logging
 * port would start deciding what a host's journal looks like. A subscriber adds its own request
 * identity; nothing here can carry a template, a data set, html, a url, a digest or a stack.
 */
export interface ProtectedRenderAuditEvent {
  /** Counter local to the runtime, not a global identifier. */
  readonly renderId: string;
  readonly outcome: ProtectedRenderOutcome;
  readonly phase: DocumentRenderPhase;
  readonly code: DocumentRenderErrorCode | undefined;
  /** Milliseconds spent waiting for a slot. */
  readonly queueMs: number;
  /** Milliseconds spent holding one. */
  readonly renderMs: number;
}

const audit = channel(RENDER_AUDIT_CHANNEL);

/** Publishes one terminal event, and does nothing at all when no one subscribes. */
export function publishRenderAudit(event: ProtectedRenderAuditEvent): void {
  if (audit.hasSubscribers) {
    audit.publish(event);
  }
}

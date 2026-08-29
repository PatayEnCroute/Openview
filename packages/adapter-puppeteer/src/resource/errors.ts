import { OpenviewError } from '@openview/core';

/**
 * Error raised when the configuration of a hardened runtime is unusable.
 *
 * Distinct from a `DocumentRenderError`: nothing was rendered and no resource was refused. The
 * fault is in what the host declared, and it stops the runtime before a first client exists.
 */
export class InvalidProtectedConfigurationError extends OpenviewError {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'InvalidProtectedConfigurationError';
  }
}

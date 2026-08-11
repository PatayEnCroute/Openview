/**
 * Typed errors. AGENTS.md 1.3 forbids swallowing an exception, which is only
 * workable if there is something specific to rethrow: a bare `throw new Error`
 * gives a caller nothing to branch on.
 */
export class OpenviewError extends Error {
  constructor(message: string, options?: ErrorOptions | undefined) {
    super(message, options);
    this.name = 'OpenviewError';
  }
}

/** A stored template could not be brought up to the current schema version. */
export class TemplateMigrationError extends OpenviewError {
  constructor(
    message: string,
    readonly fromVersion: number,
    options?: ErrorOptions | undefined,
  ) {
    super(message, options);
    this.name = 'TemplateMigrationError';
  }
}

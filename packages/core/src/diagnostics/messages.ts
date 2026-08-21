import type { ShapeErrorCode, TemplateMigrationErrorCode } from '../errors.js';
import type { PresentationRefusal } from '../presentation/types.js';
import type { ConfigurationDiagnosticCode } from './types.js';

/** Emitted when a refusal points at a location that is not a chain of string and number segments. */
export const UNNAMEABLE_LOCATION_MESSAGE =
  'Openview cannot name the location of this refusal. Report it as a defect.';

/**
 * Migration sentences. They name no version: the stored number travels in `fromVersion`, and the
 * remedy -- upgrade Openview, or repair the stored file -- does not depend on it.
 */
export const MIGRATION_MESSAGES: Readonly<Record<TemplateMigrationErrorCode, string>> = {
  'invalid-template': 'This is not a stored template object. Openview can only open a template.',
  'missing-schema-version':
    'This template declares no usable "schemaVersion". Openview cannot tell which format it was written in.',
  'newer-schema-version':
    'This template was created by a newer Openview schema version. Upgrade Openview before opening it.',
  'missing-migration':
    'This build has no upgrade step for the schema version this template declares. Its upgrade chain is incomplete.',
  'invalid-migration-result':
    'An upgrade step failed to produce a usable later schema version. Its upgrade chain is faulty.',
};

/** Shape sentences. The bound itself travels in `limit`, so a host may show it or withhold it. */
export const SHAPE_MESSAGES: Readonly<Record<ShapeErrorCode, string>> = {
  'too-deep': 'This template exceeds the configured nesting limit. Reduce its nesting.',
  'too-many-nodes':
    'This template exceeds the configured limit on how many values it may carry. Reduce its size.',
  'not-plain-data':
    'This template must be plain data. Remove the property defined by a getter or a setter.',
};

/** Configuration sentences. They address the integrating application, never the model author. */
export const CONFIGURATION_MESSAGES: Readonly<Record<ConfigurationDiagnosticCode, string>> = {
  'invalid-evaluation-limits':
    'The evaluation limits given to Openview are unusable. Each limit is a whole number between 1 and 1 000 000 000, and an omitted limit takes its default.',
  'invalid-shape-limits':
    'The shape limits given to Openview are unusable. Each limit is a whole number between 1 and 1 000 000 000, and an omitted limit takes its default.',
};

/**
 * Presentation sentences. Three distinct causes, and the third blames neither the author nor the
 * caller: a well-formed tag this engine cannot honour is a property of the reading machine.
 */
export const PRESENTATION_MESSAGES: Readonly<Record<PresentationRefusal, string>> = {
  'unknown-writing':
    'This template declares no writing under that name. Add it to the presentations table, or point at a declared one.',
  'invalid-writing':
    'This writing is unusable. Check its language, currency, fraction digits and date style.',
  'unhonoured-locale':
    'The language this writing names cannot be honoured here. Choose a language this renderer supports.',
};

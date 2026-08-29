/**
 * Types for the E7 acceptance command.
 *
 * The tool itself stays plain JavaScript so a maintainer runs it with `node` and no build step;
 * these declarations exist so the tests that exercise it are type-checked like every other.
 */

/**
 * Promotes a validated candidate batch into a target directory, atomically over the whole batch.
 *
 * Answers the names it wrote. Throws, naming every objection at once, when the candidate is
 * incomplete, was produced anywhere but the official host, or does not match the register. On a
 * failed write the previous batch is put back whole.
 */
export declare function acceptInto(
  candidateDirectory: string,
  targetDirectory: string,
): readonly string[];

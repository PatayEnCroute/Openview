import { describe, expect, it } from 'vitest';
import { parseTemplate, TEMPLATE_MIGRATIONS } from '../../template/migrate.js';
import { CURRENT_SCHEMA_VERSION } from '../../template/template.js';
import { checkTemplateDataCompatibility } from '../compatibility.js';
import { listDataCatalogueEntries } from '../list.js';
import { DataCatalogueSchema } from '../schemas.js';
import type { DataCatalogue, DataField } from '../types.js';
import {
  catalogueWithoutPrice,
  catalogueWithRowsAsRecord,
  proofCatalogue,
  proofTemplate,
} from './fixtures.js';

/**
 * Renames every key and every label of a declaration, and the paths a model writes with them.
 *
 * The proof is what survives: the same mechanism, on a vocabulary Openview has never seen.
 */
function renameFields(fields: readonly DataField[]): readonly DataField[] {
  return fields.map((field) => ({
    key: `x${field.key}`,
    label: `[${field.label}]`,
    type:
      field.type.kind === 'object'
        ? { kind: 'object' as const, fields: renameFields(field.type.fields) }
        : field.type.kind === 'list' && field.type.items.kind === 'object'
          ? {
              kind: 'list' as const,
              items: { kind: 'object' as const, fields: renameFields(field.type.items.fields) },
            }
          : field.type,
  }));
}

function renameCatalogue(catalogue: DataCatalogue): DataCatalogue {
  return { fields: renameFields(catalogue.fields) };
}

/** Rewrites every path of a model, segment by segment, under the same renaming. */
function renamePaths(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(renamePaths);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const source: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  const rewritten: Record<string, unknown> = {};
  for (const [key, held] of Object.entries(source)) {
    if (key === 'path' && typeof held === 'string') {
      rewritten[key] = held
        .split('.')
        .map((segment) => `x${segment}`)
        .join('.');
      continue;
    }
    if (key === 'as' && typeof held === 'string') {
      rewritten[key] = `x${held}`;
      continue;
    }
    rewritten[key] = renamePaths(held);
  }
  return rewritten;
}

describe('the proof declaration', () => {
  it('parses as a catalogue', () => {
    expect(DataCatalogueSchema.safeParse(proofCatalogue()).success).toBe(true);
  });

  it('lists its labels in the order the host declared them', () => {
    expect(
      listDataCatalogueEntries(proofCatalogue()).map((entry) => entry.labelPath.join(' / ')),
    ).toEqual([
      'Document',
      'Document / Numéro',
      'Document / Émis le',
      'Document / Délai en jours',
      'Destinataire',
      'Destinataire / Nom',
      'Destinataire / Ville',
      'Lignes',
      'Lignes / Libellé',
      'Lignes / Quantité',
      'Lignes / Prix unitaire',
      'Lignes / Remise',
      'Lignes / Mentions',
      'Acquitté',
    ]);
  });
});

describe('the complete declaration accepts the proof model', () => {
  const result = checkTemplateDataCompatibility(proofTemplate(), proofCatalogue());

  it('finds the model compatible, with no refusal', () => {
    expect(result.compatible).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('leaves every reading available', () => {
    expect(result.reads.every((read) => read.status === 'available')).toBe(true);
  });

  it('reads the flow, the header and the footer alike', () => {
    const written = result.reads.map((read) => read.writtenPath);
    expect(written).toContain('destinataire.nom');
    expect(written).toContain('document.numero');
    expect(written).toContain('destinataire.ville');
  });

  it('points every alias reading at a member of the element, never at an invented root', () => {
    const aliased = result.reads.filter((read) => read.writtenPath.includes('.'));
    const scoped = aliased.filter((read) => read.writtenPath.startsWith('ligne.'));
    expect(scoped.length).toBeGreaterThan(0);
    for (const read of scoped) {
      expect(read.cataloguePath?.slice(0, 1)).toEqual(['lignes']);
      expect(read.labels[0]).toBe('Lignes');
    }
  });

  it('needs no dataset: the call takes a model and a declaration, and nothing else', () => {
    expect(checkTemplateDataCompatibility.length).toBe(2);
  });
});

describe('removing the price makes the same model incompatible, at each occurrence', () => {
  const result = checkTemplateDataCompatibility(proofTemplate(), catalogueWithoutPrice());

  it('refuses the model', () => {
    expect(result.compatible).toBe(false);
  });

  it('refuses every occurrence that reads the price, and only those', () => {
    expect(result.diagnostics.map((d) => [d.code, d.dataPath])).toEqual([
      ['undeclared-data-path', 'ligne.prix'],
      ['undeclared-data-path', 'agregee.prix'],
    ]);
  });

  it('places each refusal at the position of its own occurrence', () => {
    const positions = result.diagnostics.map((d) => d.path.join('.'));
    expect(new Set(positions).size).toBe(2);
  });

  it('leaves the other readings available', () => {
    const others = result.reads.filter((read) => !read.writtenPath.endsWith('.prix'));
    expect(others.every((read) => read.status === 'available')).toBe(true);
  });
});

describe('turning the list into a record blocks what it used to bind', () => {
  const result = checkTemplateDataCompatibility(proofTemplate(), catalogueWithRowsAsRecord());

  it('refuses the sources that needed a list', () => {
    const kinds = result.diagnostics.filter((d) => d.code === 'incompatible-data-kind');
    expect(kinds.length).toBeGreaterThan(0);
    for (const diagnostic of kinds) {
      expect(diagnostic).toMatchObject({ dataPath: 'lignes', actualKind: 'object' });
    }
  });

  it('suspends the readings under the alias instead of calling their keys unknown roots', () => {
    const suspended = result.reads.filter((read) => read.status === 'blocked');
    expect(suspended.map((read) => read.writtenPath)).toEqual([
      'ligne.quantite',
      'ligne.prix',
      'ligne.libelle',
      'remisee.remise',
      'gardee.libelle',
      'agregee.quantite',
      'agregee.prix',
    ]);
    expect(result.diagnostics.some((d) => d.dataPath.startsWith('ligne.'))).toBe(false);
  });
});

describe('the mechanism owes nothing to the words the host chose', () => {
  it('answers the same way once catalogue and model are renamed together', () => {
    const original = checkTemplateDataCompatibility(proofTemplate(), proofCatalogue());
    const renamed = checkTemplateDataCompatibility(
      parseTemplate(renamePaths(proofTemplate())),
      DataCatalogueSchema.parse(renameCatalogue(proofCatalogue())),
    );
    expect(renamed.compatible).toBe(original.compatible);
    expect(renamed.reads.map((read) => [read.status, read.expectation])).toEqual(
      original.reads.map((read) => [read.status, read.expectation]),
    );
    expect(renamed.reads.map((read) => read.writtenPath)).not.toEqual(
      original.reads.map((read) => read.writtenPath),
    );
  });
});

describe('C10 stores nothing in the document', () => {
  it('registered no migration step of its own', () => {
    // The catalogue lives on the host side, so C10 changed no stored shape. Asserted on the chain
    // rather than on the current version, which later lots keep moving: no step's migration is
    // owned by the catalogue, and the 8 -> 9 seam is immediately followed by the C11 stamp.
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(9);
    expect(TEMPLATE_MIGRATIONS.filter((step) => step.from === 9)).toHaveLength(
      CURRENT_SCHEMA_VERSION > 9 ? 1 : 0,
    );
  });
});

import {
  type DataCatalogue,
  DataCatalogueSchema,
  type DataField,
  type DataType,
} from '@openview/core';

// Data catalogue for the reference invoice declared by the host application.

const champ = (key: string, label: string, type: DataType): DataField => ({ key, label, type });
const objet = (fields: readonly DataField[]): DataType => ({ kind: 'object', fields });
const liste = (items: DataType): DataType => ({ kind: 'list', items });

/** The fields of a line item, shared across order and rounding tables. */
const ligne = (): DataType =>
  objet([
    champ('sku', 'Référence', { kind: 'string' }),
    champ('quantite', 'Quantité', { kind: 'number' }),
    champ('prixUnitaire', 'Prix unitaire', { kind: 'number' }),
    champ('discount', 'Remise de la ligne', { kind: 'number' }),
  ]);

/** Declared data catalogue as provided by the host application. */
export const catalogueFacture: DataCatalogue = {
  fields: [
    champ('rendu', 'Rendu', objet([champ('langue', 'Langue des libellés', { kind: 'string' })])),
    champ(
      'commande',
      'Commande',
      objet([
        champ('numero', 'Numéro', { kind: 'number' }),
        champ('client', 'Client', { kind: 'string' }),
        champ('dateEmission', "Date d'émission", { kind: 'civil-date' }),
        champ('delaiPaiement', 'Délai de paiement en jours', { kind: 'number' }),
        champ('tauxRemise', 'Taux de remise', { kind: 'number' }),
        champ('lignes', 'Lignes', liste(ligne())),
      ]),
    ),
    champ('arrondi', "Démonstration d'arrondi", objet([champ('lignes', 'Lignes', liste(ligne()))])),
    champ(
      'traitement',
      'Traitement',
      objet([champ('effectueLe', 'Effectué le', { kind: 'civil-date' })]),
    ),
    champ(
      'societe',
      'Société',
      objet([
        champ('mentionsLegales', 'Mentions légales', { kind: 'string' }),
        champ('reglement', 'Règlement', { kind: 'string' }),
        champ('coordonnees', 'Coordonnées', { kind: 'string' }),
        champ('conditions', 'Conditions', { kind: 'string' }),
      ]),
    ),
  ],
};

/** Catalogue variant lacking the prixUnitaire field for testing schema validation. */
export const catalogueSansPrix: DataCatalogue = {
  fields: catalogueFacture.fields.map((racine) =>
    racine.key !== 'commande' || racine.type.kind !== 'object'
      ? racine
      : {
          ...racine,
          type: {
            kind: 'object',
            fields: racine.type.fields.map((membre) =>
              membre.key !== 'lignes' ||
              membre.type.kind !== 'list' ||
              membre.type.items.kind !== 'object'
                ? membre
                : {
                    ...membre,
                    type: {
                      kind: 'list',
                      items: {
                        kind: 'object',
                        fields: membre.type.items.fields.filter(
                          (colonne) => colonne.key !== 'prixUnitaire',
                        ),
                      },
                    },
                  },
            ),
          },
        },
  ),
};

/** Validates catalogue schema once at load time. */
export const catalogueValide = DataCatalogueSchema.safeParse(catalogueFacture).success;

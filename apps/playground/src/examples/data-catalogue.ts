import {
  type DataCatalogue,
  DataCatalogueSchema,
  type DataField,
  type DataType,
} from '@openview/core';

// Le catalogue de la facture de référence : ce que l'application hôte DÉCLARE lisible.
//
// Il vit ici, à côté du jeu de données et du modèle, parce qu'il appartient au même
// propriétaire : l'intégrateur. `@openview/core` ne connaît aucune de ces clés, aucun de
// ces libellés, et n'en réserve aucun — c'est vérifiable au grep sur `packages/`.
//
// Il décrit des CAPACITÉS, jamais un contenu : `commande.lignes` est déclarée « liste de
// lignes », et rien ici ne dit combien il y en a dans tel rendu. C'est exactement la
// frontière du lot C10 — « qu'est-ce que l'hôte permet de lire ? », jamais « que contient
// ce rendu ? ».

const champ = (key: string, label: string, type: DataType): DataField => ({ key, label, type });
const objet = (fields: readonly DataField[]): DataType => ({ kind: 'object', fields });
const liste = (items: DataType): DataType => ({ kind: 'list', items });

/** Les cinq champs d'une ligne, partagés par `commande.lignes` et par `arrondi.lignes`. */
const ligne = (): DataType =>
  objet([
    champ('sku', 'Référence', { kind: 'string' }),
    champ('quantite', 'Quantité', { kind: 'number' }),
    champ('prixUnitaire', 'Prix unitaire', { kind: 'number' }),
    champ('discount', 'Remise de la ligne', { kind: 'number' }),
  ]);

/**
 * Le catalogue déclaré, tel qu'un hôte le passerait au Designer.
 *
 * `dateEmission` et `traitement.effectueLe` sont des `civil-date` : le moteur n'a pas
 * d'horloge, et « aujourd'hui » est une clé que l'intégrateur nomme. `arrondi.lignes`
 * porte les mêmes champs que `commande.lignes` sans `discount` — deux listes distinctes,
 * deux déclarations distinctes, aucune structure imposée.
 */
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

/**
 * La MÊME déclaration, privée du prix unitaire des lignes de commande.
 *
 * Rien d'autre ne change. Le modèle, lui, ne bouge pas d'une ligne : ce sont les
 * occurrences qui le lisent qui deviennent incompatibles, chacune à sa position.
 */
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

/**
 * La frontière, jouée une fois au chargement du module et jamais dans une boucle.
 *
 * C'est ce que le futur composant Designer devra faire de la prop `dataCatalogue` : un
 * `safeParse` à la réception, pas à chaque rendu React.
 */
export const catalogueValide = DataCatalogueSchema.safeParse(catalogueFacture).success;

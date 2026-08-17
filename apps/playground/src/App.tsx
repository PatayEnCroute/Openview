import {
  type BlockNode,
  CURRENT_SCHEMA_VERSION,
  childScope,
  collectDataPaths,
  createBudget,
  type DocumentNode,
  type EvaluationBudget,
  type EvaluationScope,
  type Expression,
  ExpressionEvaluationError,
  ExpressionSchema,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  findNodeById,
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  type PrintableExpression,
  parseTemplate,
  ROUND_MODES,
  type RoundExpression,
  RoundExpressionSchema,
  type RoundMode,
  type TableCell,
  type TableColumn,
  type TableNode,
  type TableRowNode,
  type Template,
  type TextNode,
  type TextSegment,
  visitNode,
  visitSegment,
  walk,
} from '@openview/core';

// Exercises the core contract end to end: recursive parsing, Visitor traversal,
// static path analysis, expression evaluation, loop scoping, the C1 algebra and the
// error payload lot C8 will turn into sentences. If @openview/core breaks its
// contract, this page stops rendering -- which is the point of the playground, and
// the reason nothing below falls back to a default.
//
// It is also the ONLY real consumer of the package barrel, so it is what reveals an
// export forgotten in index.ts -- a blind spot of all four gates on the core side.

const discountApplies: Expression = {
  kind: 'compare',
  op: 'gt',
  left: { kind: 'path', path: 'line.discount' },
  right: { kind: 'literal', value: 0 },
};

/** `quantite * prixUnitaire` -- no line amount is supplied by the data. That is the point. */
const lineAmount: PrintableExpression = {
  kind: 'arithmetic',
  op: 'mul',
  left: { kind: 'path', path: 'line.quantite' },
  right: { kind: 'path', path: 'line.prixUnitaire' },
};

/** The sum of the computed line amounts. Same shape as a loop: source, alias, value. */
const totalHT: PrintableExpression = {
  kind: 'aggregate',
  op: 'sum',
  source: { kind: 'path', path: 'commande.lignes' },
  as: 'line',
  value: lineAmount,
};

/**
 * A percentage of the total, in points, and NOT rounded here.
 *
 * Rounding is a `round` node the template writes where it wants one -- see the three
 * models further down. Rounding this amount by default would be a rounding position *de
 * facto*, therefore a rule, and Openview answers for no rule.
 */
const remise: PrintableExpression = {
  kind: 'percentOf',
  base: totalHT,
  rate: { kind: 'path', path: 'commande.tauxRemise' },
};

const restePayer: PrintableExpression = {
  kind: 'arithmetic',
  op: 'sub',
  left: totalHT,
  right: remise,
};

/**
 * A guarded division: the `if` short-circuits, so a zero count never divides.
 *
 * Written "naturally" -- evaluate both branches, then choose -- this prints an error
 * instead of a price.
 */
const prixMoyen: PrintableExpression = {
  kind: 'if',
  when: {
    kind: 'compare',
    op: 'gt',
    left: { kind: 'count', source: { kind: 'path', path: 'commande.lignes' } },
    right: { kind: 'literal', value: 0 },
  },
  whenTrue: {
    kind: 'arithmetic',
    op: 'div',
    left: totalHT,
    right: { kind: 'count', source: { kind: 'path', path: 'commande.lignes' } },
  },
  whenFalse: { kind: 'literal', value: 0 },
};

const echeance: PrintableExpression = {
  kind: 'dateAdd',
  date: { kind: 'path', path: 'commande.dateEmission' },
  days: { kind: 'path', path: 'commande.delaiPaiement' },
};

/** "45 days end of month" -- composed, so no month convention is ever chosen. */
const echeanceFinDeMois: PrintableExpression = {
  kind: 'endOfMonth',
  date: {
    kind: 'dateAdd',
    date: { kind: 'path', path: 'commande.dateEmission' },
    days: { kind: 'literal', value: 45 },
  },
};

/**
 * Days overdue, between two dates the HOST supplies.
 *
 * `traitement.effectueLe` is a name the integrating application chose. Openview reserves
 * no name for "today" and has no clock to read: that is what makes two renders of one
 * model produce the same document.
 */
const joursRetard: PrintableExpression = {
  kind: 'dateDiff',
  from: echeance,
  to: { kind: 'path', path: 'traitement.effectueLe' },
};

/** How many discounted lines: `count(filter(...))`, and not an optional `where`. */
const lignesRemisees: PrintableExpression = {
  kind: 'count',
  source: {
    kind: 'filter',
    source: { kind: 'path', path: 'commande.lignes' },
    as: 'line',
    where: discountApplies,
  },
};

/** Un bloc texte d'un seul segment littéral — un intitulé de colonne, un libellé de total. */
const txt = (id: string, text: string): TextNode => ({
  type: 'text',
  id,
  content: [{ kind: 'literal', text }],
});

/** Explicit stringification: `concat` refuses a number, and `text()` is where one becomes text. */
const titre: PrintableExpression = {
  kind: 'concat',
  parts: [
    { kind: 'literal', value: 'N° ' },
    { kind: 'text', value: { kind: 'path', path: 'commande.numero' } },
    { kind: 'literal', value: ' — ' },
    { kind: 'textCase', op: 'upper', text: { kind: 'path', path: 'commande.client' } },
  ],
};

// Le modèle s'appelle « Facture Exemple » parce que la facture est le document de
// référence du projet — celui qui concentre les contraintes les plus dures — et
// non le périmètre du produit. Les noms de champs ci-dessous (`commande`, `lignes`,
// `prixUnitaire`) sont ceux qu'une application intégratrice aurait choisis : Openview
// n'en réserve aucun et n'en attend aucun. Le même moteur rend un relevé, un bon de
// livraison ou un courrier avec un tout autre vocabulaire.
const sampleTemplate = parseTemplate({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'tpl_demo_1',
  name: 'Facture Exemple',
  version: '1.0.0',
  // La feuille, ses marges et ses bandes — lot C4. Les dimensions ci-dessous sont celles
  // d'une A4 PARCE QUE L'AUTEUR DU MODÈLE L'A ÉCRIT : Openview n'impose aucun format, n'en
  // réserve aucun nom et n'en déduit aucun d'une locale. `STANDARD_SHEETS_MM` est une
  // commodité d'écriture, et le document, lui, n'enregistre que deux nombres.
  page: {
    sheet: { width: 210, height: 297 },
    margins: { top: 18, right: 15, bottom: 18, left: 15 },
    header: [
      {
        on: 'every',
        content: {
          type: 'container',
          id: 'bandeau',
          children: [
            {
              type: 'text',
              id: 'bandeau-titre',
              content: [
                { kind: 'literal', text: 'Commande ' },
                { kind: 'binding', value: { kind: 'path', path: 'commande.numero' } },
              ],
            },
          ],
        },
      },
    ],
    // Un pied COURANT et un pied de DERNIÈRE page. `every` + `lastOnly` serait refusé par le
    // schéma — les deux tomberaient sur la dernière feuille —, donc le pied courant est
    // `exceptLast`. C'est la seule écriture licite de cette intention, et c'est la raison
    // d'exister de la troisième occurrence.
    footer: [
      {
        on: 'exceptLast',
        content: {
          type: 'container',
          id: 'pied',
          children: [
            { type: 'text', id: 'pied-num', content: [{ kind: 'literal', text: 'Page ' }] },
          ],
        },
      },
      {
        on: 'lastOnly',
        content: {
          type: 'container',
          id: 'pied-dernier',
          children: [
            { type: 'text', id: 'pied-dernier-num', content: [{ kind: 'literal', text: 'Page ' }] },
            {
              type: 'text',
              id: 'pied-mentions',
              content: [{ kind: 'literal', text: 'Escompte pour paiement anticipé : néant.' }],
            },
          ],
        },
      },
    ],
  },
  root: {
    type: 'container',
    id: 'root',
    children: [
      { type: 'text', id: 'title', content: [{ kind: 'binding', value: titre }] },
      // Les cinq identifiants de colonne ci-dessous — `sku`, `quantite`, `prixUnitaire`,
      // `montant`, `remise` — appellent le même avertissement que les noms de champs plus
      // haut, adapté : ce sont un JEU D'ÉPREUVE, choisis par l'auteur du modèle. Openview
      // n'impose aucun identifiant de colonne, et le premier tableau réellement décrit est
      // celui qui sera recopié — le dépôt nomme déjà ce mécanisme, « position par défaut de
      // fait ». Un relevé bancaire ou un bordereau se décrivent avec un tout autre
      // vocabulaire, et le contrat est le même.
      //
      // Avant le lot C3, une ligne entière de facture était UN SEUL nœud texte dont les
      // segments mimaient des colonnes (`line-label`). Rien ne disait qu'il y avait des
      // colonnes, aucune largeur, aucun alignement, et l'en-tête n'existait pas.
      {
        type: 'table',
        id: 'lignes',
        columns: [
          { id: 'sku', width: 6, align: 'start' },
          { id: 'quantite', width: 2, align: 'end' },
          { id: 'prixUnitaire', width: 3, align: 'end' },
          { id: 'montant', width: 3, align: 'end' },
          { id: 'remise', width: 4, align: 'start' },
        ],
        header: [
          {
            type: 'tableRow',
            id: 'entete',
            cells: [
              { columnId: 'sku', children: [txt('th-sku', 'Référence')] },
              { columnId: 'quantite', children: [txt('th-quantite', 'Qté')] },
              { columnId: 'prixUnitaire', children: [txt('th-prix', 'Prix unitaire')] },
              { columnId: 'montant', children: [txt('th-montant', 'Montant')] },
              { columnId: 'remise', children: [txt('th-remise', 'Remise')] },
            ],
          },
        ],
        body: [
          {
            type: 'tableRowGroup',
            id: 'corps',
            each: { kind: 'path', path: 'commande.lignes' },
            as: 'line',
            rows: [
              {
                type: 'tableRow',
                id: 'ligne-detail',
                cells: [
                  {
                    columnId: 'sku',
                    children: [
                      {
                        type: 'text',
                        id: 'td-sku',
                        content: [{ kind: 'binding', value: { kind: 'path', path: 'line.sku' } }],
                      },
                    ],
                  },
                  {
                    columnId: 'quantite',
                    children: [
                      {
                        type: 'text',
                        id: 'td-quantite',
                        content: [
                          { kind: 'binding', value: { kind: 'path', path: 'line.quantite' } },
                        ],
                      },
                    ],
                  },
                  {
                    columnId: 'prixUnitaire',
                    children: [
                      {
                        type: 'text',
                        id: 'td-prix',
                        content: [
                          { kind: 'binding', value: { kind: 'path', path: 'line.prixUnitaire' } },
                        ],
                      },
                    ],
                  },
                  {
                    columnId: 'montant',
                    children: [
                      {
                        type: 'text',
                        id: 'td-montant',
                        content: [{ kind: 'binding', value: lineAmount }],
                      },
                    ],
                  },
                  // Une cellule contient des BLOCS, pas des segments : la condition qui
                  // portait la note de remise vit désormais DANS la cellule, et le parcours
                  // l'atteint quand même — `childrenOf` aplatit la frontière de cellule.
                  {
                    columnId: 'remise',
                    children: [
                      {
                        type: 'condition',
                        id: 'discounted',
                        when: discountApplies,
                        children: [
                          {
                            type: 'text',
                            id: 'discount-note',
                            content: [
                              { kind: 'literal', text: 'Remise appliquée : ' },
                              {
                                kind: 'binding',
                                value: { kind: 'path', path: 'line.discount' },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        footer: [
          // UNE LIGNE COURTE : deux cellules pour cinq colonnes. Licite par construction, et
          // c'est exactement la forme d'une ligne de total — l'appariement positionnel que ce
          // contrat a refusé aurait exigé trois cellules de remplissage vides ici.
          //
          // Le total est une EXPRESSION DU MODÈLE, visible dans l'arbre. Le tableau ne somme
          // rien : son `footer` n'a nulle part où poser un agrégat.
          {
            type: 'tableRow',
            id: 'ligne-total',
            cells: [
              { columnId: 'sku', children: [txt('tf-libelle', 'Total HT')] },
              {
                columnId: 'montant',
                children: [
                  {
                    type: 'text',
                    id: 'tf-montant',
                    content: [{ kind: 'binding', value: totalHT }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'text',
        id: 'totals',
        content: [
          { kind: 'literal', text: 'Total HT ' },
          { kind: 'binding', value: totalHT },
          { kind: 'literal', text: ' — remise ' },
          { kind: 'binding', value: remise },
          { kind: 'literal', text: ' — reste à payer ' },
          { kind: 'binding', value: restePayer },
          { kind: 'literal', text: ' — prix moyen ' },
          { kind: 'binding', value: prixMoyen },
        ],
      },
      {
        type: 'text',
        id: 'dates',
        content: [
          { kind: 'literal', text: 'Échéance ' },
          { kind: 'binding', value: echeance },
          { kind: 'literal', text: ' — 45 jours fin de mois ' },
          { kind: 'binding', value: echeanceFinDeMois },
          { kind: 'literal', text: ' — jours de retard ' },
          { kind: 'binding', value: joursRetard },
        ],
      },
      {
        type: 'text',
        id: 'discount-count',
        content: [
          { kind: 'literal', text: 'Lignes remisées ' },
          { kind: 'binding', value: lignesRemisees },
        ],
      },
    ],
  },
});

// Le jeu de données de l'application hôte. Sa structure et ses noms de champs lui
// appartiennent ; `core` ne les connaît pas et ne les valide pas. AUCUN MONTANT n'y
// figure : tous ceux affichés plus bas sont calculés par le modèle.
const renderData = {
  commande: {
    numero: 20_260_014,
    client: 'acme sàrl',
    dateEmission: '2026-01-20',
    delaiPaiement: 30,
    tauxRemise: 10,
    lignes: [
      { sku: 'A-1', quantite: 2, prixUnitaire: 10, discount: 0 },
      { sku: 'B-2', quantite: 1, prixUnitaire: 30, discount: 15 },
      { sku: 'C-3', quantite: 4, prixUnitaire: 2.5, discount: 5 },
    ],
  },
  // Un SECOND jeu de lignes, dédié à la démonstration d'arrondi. La facture ci-dessus
  // n'est pas touchée : ses quatre montants (60 / 6 / 54 / 20) sont cités nommément par
  // l'ADR 0003, et les étendre aurait périmé quatre chiffres d'un document qui fait foi.
  //
  // Deux de ces cinq lignes portent des valeurs DYADIQUES — 0,125 vaut 2⁻³ et 0,375 vaut
  // 3·2⁻³, et leurs produits par 17 et par 3 le sont aussi. Le demi y est donc LE demi, et
  // non un artefact de représentation : c'est la seule façon de montrer que le mode décide
  // quelque chose. Comme au-dessus, aucune ligne ne porte de montant — seulement une
  // quantité et un prix unitaire.
  arrondi: {
    lignes: [
      { sku: 'A-1', quantite: 2, prixUnitaire: 10 },
      { sku: 'B-2', quantite: 1, prixUnitaire: 30 },
      { sku: 'C-3', quantite: 4, prixUnitaire: 2.5 },
      { sku: 'D-4', quantite: 17, prixUnitaire: 0.125 },
      { sku: 'E-5', quantite: 3, prixUnitaire: 0.375 },
    ],
  },
  // « Aujourd'hui » est une donnée, sous un nom que l'intégrateur choisit.
  traitement: { effectueLe: '2026-03-10' },
};

/**
 * Le budget de CE document, créé une fois — comme le fera le pipeline.
 *
 * Deux erreurs symétriques, et la page les évite toutes les deux. Un budget par *appel* se
 * réinitialiserait à chaque liaison, et un document de 500 liaisons obtiendrait 500 fois
 * l'allocation : la borne serait décorative. Un budget par *page* ferait dépendre le
 * compteur d'un document de ce qu'un autre a déjà consommé, donc de l'ordre de la
 * démonstration. L'unité juste est le DOCUMENT : les trois modèles d'arrondi plus bas
 * partagent le jeu de données et portent chacun le sien.
 */
const budgetFacture: EvaluationBudget = createBudget();

/**
 * Valeurs brutes, volontairement : transformer une liaison en texte imprimable
 * est le travail de `DataBindingStep` (étape 2), et l'ADR 0001 laisse ouverte la
 * politique de la valeur absente. Le playground ne la tranche pas à sa place.
 *
 * Cela vaut aussi pour les dates : `YYYY-MM-DD` est une représentation d'ÉCHANGE, pas
 * un format d'affichage. Les rendre en `31/03/2026` appartient au lot C6, au même
 * endroit que la mise en forme des nombres.
 *
 * Le parcours passe par `visitSegment` : c'est la deuxième traversée de segments
 * du dépôt, et une nouvelle sorte de segment doit casser la compilation ici.
 */
function rawSegments(
  segments: readonly TextSegment[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): readonly string[] {
  return segments.map((segment) =>
    visitSegment(segment, {
      literal: (literal) => JSON.stringify(literal.text),
      binding: (binding) => {
        const value = evaluateExpression(binding.value, scope, { budget });
        return value === undefined ? '(absent)' : JSON.stringify(value);
      },
    }),
  );
}

/**
 * Tombe plutôt que de dégrader. Chaque nœud lu ci-dessous figure dans le littéral
 * de template au-dessus : s'il manque, c'est le contrat de core qui est cassé, et
 * une section vide le dirait beaucoup moins bien qu'une exception.
 */
function requireNode(root: DocumentNode, id: string): DocumentNode {
  const node = findNodeById(root, id);
  if (node === undefined) {
    throw new Error(`Nœud « ${id} » absent du document validé : contrat de core cassé.`);
  }
  return node;
}

function requireTextNode(root: DocumentNode, id: string): readonly TextSegment[] {
  const node = requireNode(root, id);
  if (node.type !== 'text') {
    throw new Error(`« ${id} » devrait être un texte, pas un ${node.type}.`);
  }
  return node.content;
}

/**
 * La même discipline, pour un tableau — et le TYPE DE RETOUR compte.
 *
 * Un `const` module dont on rétrécit le type par un `if` ne reste pas rétréci dans le corps
 * du composant : une fermeture ne porte pas le flux de contrôle du module. Une fonction qui
 * rend `TableNode` le fait, elle.
 */
function requireTableNode(root: DocumentNode, id: string): TableNode {
  const node = requireNode(root, id);
  if (node.type !== 'table') {
    throw new Error(`« ${id} » devrait être un tableau, pas un ${node.type}.`);
  }
  return node;
}

const nodeIds = [...walk(sampleTemplate.root)].map((node) => `${node.id} (${node.type})`);
const dataPaths = collectDataPaths(sampleTemplate.root);

// Tout ce qui suit se lit sur le document validé : l'alias sur le nœud de groupe, la
// condition sur le nœud de condition. Les expressions déclarées plus haut ne servent qu'à
// construire le template ; l'évaluation ci-dessous n'y touche pas.
//
// Ce `requireNode` vaut une démonstration à lui seul : `discounted` vit désormais DANS une
// cellule du tableau, et `findNodeById` l'atteint quand même. `childrenOf` aplatit la
// frontière de cellule, donc rien de ce qu'un tableau contient n'est invisible au parcours —
// un sous-arbre que le parcours ne rendrait pas serait invisible à `walk`, à `findNodeById` et
// à `collectDataPaths` SANS erreur nulle part.
const conditionNode = requireNode(sampleTemplate.root, 'discounted');
if (conditionNode.type !== 'condition') {
  throw new Error(`« discounted » devrait être une condition, pas un ${conditionNode.type}.`);
}

const root = sampleTemplate.root;
const titleSegments = rawSegments(requireTextNode(root, 'title'), renderData, budgetFacture);
const totalSegments = rawSegments(requireTextNode(root, 'totals'), renderData, budgetFacture);
const dateSegments = rawSegments(requireTextNode(root, 'dates'), renderData, budgetFacture);
const countSegments = rawSegments(
  requireTextNode(root, 'discount-count'),
  renderData,
  budgetFacture,
);

/* ------------------------------------------------------------------------------------- *
 * La section facture, décrite par un vrai tableau
 * ------------------------------------------------------------------------------------- */

/**
 * Une part de largeur, `width / Σ width`, en pourcentage.
 *
 * Le poids est un ENTIER, donc la somme est exacte en binary64 et la part est UNE division
 * correctement arrondie — le même nombre à l'écran et dans le PDF. C3 ne déclare nulle part
 * la largeur du tableau lui-même : seul le RAPPORT inter-colonnes est déclaré, et c'est le
 * conteneur qui donne la largeur.
 *
 * **Aucun second arrondi ici, et c'est le point.** Un `.toFixed(2)` appliqué à la part
 * détruirait l'exactitude que le poids entier existe pour donner : trois colonnes de poids 1
 * rendraient `33.33 % × 3 = 99.99 %`, et une colonne légale de poids 1 à côté de vingt et une
 * de poids 1 000 rendrait `0.00 %` — une largeur déclarée non nulle affichée à zéro. La
 * division est émise telle quelle ; c'est au moteur de rendu, et non à ce calcul, de décider
 * d'une précision d'affichage.
 */
function partsDeLargeur(columns: readonly TableColumn[]): readonly string[] {
  const total = columns.reduce((somme, column) => somme + column.width, 0);
  return columns.map((column) => `${(column.width / total) * 100}%`);
}

/**
 * Les segments d'un bloc texte, en TEXTE D'AFFICHAGE.
 *
 * Distinct de `rawSegments`, et la distinction est la correction d'un vrai défaut : celui-ci
 * est une sonde de diagnostic qui passe chaque run par `JSON.stringify` et les joint par
 * ` + `, ce qui est juste dans un `<code>` et faux dans une cellule — l'en-tête rendait
 * `"Référence"`, guillemets compris, sous une phrase affirmant qu'aucune information n'est
 * inventée en chemin.
 *
 * Les segments d'UN nœud texte sont des runs EN LIGNE : ils se concatènent sans séparateur.
 * C'est exactement ce que dit la docstring de `TextSegment` — « "Total: " et la valeur
 * appartiennent à la même ligne » —, et tout séparateur ajouté ici serait inventé.
 */
function texteDeSegments(
  segments: readonly TextSegment[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): string {
  return segments
    .map((segment) =>
      visitSegment(segment, {
        literal: (literal) => literal.text,
        binding: (binding) => {
          const value = evaluateExpression(binding.value, scope, { budget });
          // Une donnée absente rend une cellule vide. L'ADR 0001 laisse la politique de la
          // valeur absente ouverte, et une cellule de tableau n'est pas l'endroit où la
          // trancher : `rawSegments` garde le `(absent)` explicite pour les sections de dump.
          return value === undefined ? '' : String(value);
        },
      }),
    )
    .join('');
}

/**
 * Ce qu'un bloc affiche, dans la portée qu'on lui donne.
 *
 * **Le parcours passe par `visitNode`, et les huit branches sont nommées.** C'est la règle
 * qu'`AGENTS.md` §3.B pose et que ce fichier applique déjà aux segments (`rawSegments`) :
 * un neuvième type de bloc casse la compilation ICI, à un site unique, au lieu de se
 * découvrir à l'exécution.
 *
 * Aucune branche ne lève et aucune ne rend le vide en silence, et les deux moitiés de cette
 * phrase ont été des défauts. Un `throw` était atteint depuis la portée de MODULE — les
 * constantes ci-dessous sont évaluées avant que React existe —, si bien qu'une image dans une
 * cellule rendait une page BLANCHE plutôt qu'une section dégradée. Et la branche `condition`
 * rendait `''` pour tout enfant non textuel, exactement ce que la docstring promettait de ne
 * pas faire. Les trois blocs que cette démonstration ne sait pas mettre en page rendent
 * désormais un MARQUEUR VISIBLE : ni exception, ni silence.
 */
function texteDeBloc(block: BlockNode, scope: EvaluationScope, budget: EvaluationBudget): string {
  const descendre = (blocs: readonly BlockNode[]): string =>
    blocs
      .map((enfant) => texteDeBloc(enfant, scope, budget))
      .filter((texte) => texte !== '')
      .join(' ');

  return visitNode<string>(block, {
    text: (texte) => texteDeSegments(texte.content, scope, budget),
    image: (image) => image.alt ?? `[image ${image.src}]`,
    container: (conteneur) => descendre(conteneur.children),
    // Récursive, et c'est la correction : un `container`, une seconde condition ou une image
    // sous une condition descendent par le même chemin que partout ailleurs.
    condition: (condition) =>
      evaluatePredicate(condition.when, scope, { budget }) ? descendre(condition.children) : '',
    loop: (boucle) => `[loop ${boucle.as} non mis en page par cette démonstration]`,
    table: (imbrique) => `[tableau imbriqué ${imbrique.id} non mis en page ici]`,
    tableRow: (ligne) => `[ligne ${ligne.id} hors d'un tableau]`,
    tableRowGroup: (groupe) => `[groupe ${groupe.id} hors d'un tableau]`,
  });
}

function texteDeCellule(cell: TableCell, scope: EvaluationScope, budget: EvaluationBudget): string {
  return cell.children
    .map((block) => texteDeBloc(block, scope, budget))
    .filter((text) => text !== '')
    .join(' ');
}

/** Une case prête à afficher : sa COLONNE et son texte, appariés une seule fois. */
interface CaseAffichee {
  readonly column: TableColumn;
  readonly texte: string;
}

/**
 * Une ligne prête à afficher : une case par colonne déclarée, vide là où la ligne est courte.
 *
 * Rend la **colonne avec son texte** plutôt qu'un texte seul, et ce n'est pas une commodité :
 * en ne rendant que des chaînes, l'affichage devait retrouver la colonne PAR POSITION —
 * `columns[index]?.align ?? 'start'`, six fois — c'est-à-dire recroiser deux tableaux par
 * index, exactement ce que la docstring de `TableCell` dit que l'appariement par clé a
 * supprimé. Le `?? 'start'` inventait de surcroît un alignement que le modèle n'a pas déclaré,
 * dans une section qui affirme que rien n'est inventé en chemin.
 */
function casesDeLigne(
  row: TableRowNode,
  columns: readonly TableColumn[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): readonly CaseAffichee[] {
  // La cellule NOMME sa colonne : on cherche par `columnId`, jamais par position. C'est ce qui
  // rend une ligne courte naturelle au lieu d'une suite de remplissages.
  return columns.map((column) => {
    const cell = row.cells.find((candidate) => candidate.columnId === column.id);
    return { column, texte: cell === undefined ? '' : texteDeCellule(cell, scope, budget) };
  });
}

const tableauLignes = requireTableNode(root, 'lignes');
const largeurs = partsDeLargeur(tableauLignes.columns);

const lignesEntete = tableauLignes.header.map((row) => ({
  id: row.id,
  cases: casesDeLigne(row, tableauLignes.columns, renderData, budgetFacture),
}));

// Le corps : une portée dérivée par élément, exactement comme une boucle, et l'alias est
// déclaré par le GROUPE. L'en-tête et le pied ne le voient pas — c'est la raison pour laquelle
// la répétition vit sur `tableRowGroup` et non sur le tableau.
const lignesCorps = tableauLignes.body.flatMap((entry) => {
  if (entry.type === 'tableRow') {
    return [
      {
        id: entry.id,
        cases: casesDeLigne(entry, tableauLignes.columns, renderData, budgetFacture),
      },
    ];
  }
  return evaluateSequence(entry.each, renderData, {
    budget: budgetFacture,
    caller: 'tableRowGroup',
  }).flatMap((item) => {
    const itemScope = childScope(renderData, entry.as, item);
    return entry.rows.map((row) => ({
      id: row.id,
      cases: casesDeLigne(row, tableauLignes.columns, itemScope, budgetFacture),
    }));
  });
});

const lignesPied = tableauLignes.footer.map((row) => ({
  id: row.id,
  cases: casesDeLigne(row, tableauLignes.columns, renderData, budgetFacture),
}));

/* ------------------------------------------------------------------------------------- *
 * Trois modèles, un jeu de données, trois totaux
 * ------------------------------------------------------------------------------------- */

/** `quantite * prixUnitaire` sur le second jeu de lignes. Aucun montant n'est fourni. */
const montantLigne: PrintableExpression = {
  kind: 'arithmetic',
  op: 'mul',
  left: { kind: 'path', path: 'l.quantite' },
  right: { kind: 'path', path: 'l.prixUnitaire' },
};

/** Le kind du lot C2 : trois champs requis, et la POSITION dans l'arbre est la déclaration. */
const arrondir = (value: PrintableExpression, mode: RoundMode): RoundExpression => ({
  kind: 'round',
  value,
  decimals: 2,
  mode,
});

const sommeDes = (value: PrintableExpression): PrintableExpression => ({
  kind: 'aggregate',
  op: 'sum',
  source: { kind: 'path', path: 'arrondi.lignes' },
  as: 'l',
  value,
});

interface ModeleArrondi {
  readonly cle: string;
  readonly libelle: string;
  readonly template: Template;
  readonly budget: EvaluationBudget;
}

/**
 * Un modèle complet par variante, PARSÉ — pas une expression évaluée à la volée.
 *
 * Chacun porte son propre budget, et c'est le contrat : « le budget de travail du rendu
 * ENTIER, créé une fois par le pipeline et partagé par toute expression du DOCUMENT ».
 * Trois modèles sont trois documents. Un budget commun ferait dépendre le compteur affiché
 * sous B de ce que A a déjà dépensé, donc de l'ordre de la démonstration — et un
 * intégrateur qui recopie cette page câblerait un budget de rendu sur une session.
 */
function modeleArrondi(
  cle: string,
  libelle: string,
  parLigne: PrintableExpression,
  mode: RoundMode,
): ModeleArrondi {
  // Le total est DÉRIVÉ de l'expression de ligne, jamais réécrit à côté d'elle : c'est ce
  // qui garantit que la colonne d'un modèle et son total somment bien la même chose. Épelé
  // deux fois, rien n'obligerait les deux copies à rester identiques, et les désaccorder
  // rendrait la démonstration silencieusement fausse — aucune porte ne lit ce fichier.
  const total = arrondir(sommeDes(parLigne), mode);
  return {
    cle,
    libelle,
    template: parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: `tpl_arrondi_${cle}`,
      name: `Arrondi ${cle}`,
      version: '1.0.0',
      // Une page nue : ces trois modèles démontrent l'arrondi, pas la feuille. Le champ est
      // requis, donc leur auteur l'écrit — et c'est exactement ce que « impose » veut dire.
      page: {
        sheet: { width: 210, height: 297 },
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        header: [],
        footer: [],
      },
      root: {
        type: 'container',
        id: 'root',
        children: [
          {
            type: 'loop',
            id: 'lignes',
            each: { kind: 'path', path: 'arrondi.lignes' },
            as: 'l',
            children: [
              { type: 'text', id: 'montant', content: [{ kind: 'binding', value: parLigne }] },
            ],
          },
          { type: 'text', id: 'total', content: [{ kind: 'binding', value: total }] },
        ],
      },
    }),
    budget: createBudget(),
  };
}

const modeles: readonly ModeleArrondi[] = [
  modeleArrondi(
    'A',
    'lignes arrondies, puis le total — halfExpand',
    arrondir(montantLigne, 'halfExpand'),
    'halfExpand',
  ),
  modeleArrondi(
    'B',
    'lignes arrondies, puis le total — halfEven',
    arrondir(montantLigne, 'halfEven'),
    'halfEven',
  ),
  modeleArrondi(
    'A′',
    'lignes exactes, total seul arrondi — halfExpand',
    montantLigne,
    'halfExpand',
  ),
];

/** La liaison d'un nœud de texte à une seule liaison. Tombe plutôt que de dégrader. */
function premiereLiaison(segments: readonly TextSegment[], quoi: string): PrintableExpression {
  const segment = segments[0];
  if (segment?.kind !== 'binding') {
    throw new Error(`« ${quoi} » devrait porter une liaison : contrat de core cassé.`);
  }
  return segment.value;
}

function nombre(value: unknown, quoi: string): number {
  if (typeof value !== 'number') {
    // `TypeError` plutôt qu'`Error` : ce qui échoue ici est un contrôle de type, et la classe
    // le dit à qui inspecte l'erreur — comme `goesUp` le fait dans `core`.
    throw new TypeError(`« ${quoi} » aurait dû être un nombre : contrat de core cassé.`);
  }
  return value;
}

interface LectureArrondi {
  readonly modele: ModeleArrondi;
  readonly montants: readonly number[];
  readonly total: number;
}

/** Tout se lit sur le document VALIDÉ, comme partout ailleurs sur cette page. */
function lireModele(modele: ModeleArrondi): LectureArrondi {
  const documentRoot = modele.template.root;
  const boucle = requireNode(documentRoot, 'lignes');
  if (boucle.type !== 'loop') {
    throw new Error(`« lignes » devrait être une boucle, pas un ${boucle.type}.`);
  }
  const liaisonMontant = premiereLiaison(requireTextNode(documentRoot, 'montant'), 'montant');
  const liaisonTotal = premiereLiaison(requireTextNode(documentRoot, 'total'), 'total');
  const options = { budget: modele.budget };

  return {
    modele,
    montants: evaluateSequence(boucle.each, renderData, options).map((item) =>
      nombre(
        evaluateExpression(liaisonMontant, childScope(renderData, boucle.as, item), options),
        `montant du modèle ${modele.cle}`,
      ),
    ),
    total: nombre(
      evaluateExpression(liaisonTotal, renderData, options),
      `total du modèle ${modele.cle}`,
    ),
  };
}

const lectures: readonly LectureArrondi[] = modeles.map(lireModele);

/**
 * La prose ci-dessous NOMME des chiffres ; elle les lit donc, elle ne les recopie pas.
 *
 * Écrits en dur à côté d'un tableau calculé en direct, ils se périment au premier coup d'œil
 * de quelqu'un qui édite les cinq lignes de démonstration — et aucune porte ne relit ce
 * fichier, `apps/*` étant hors du glob de Vitest. La page enseignerait alors une conclusion
 * que son propre tableau contredit.
 */
function lectureDe(cle: string): LectureArrondi {
  const lecture = lectures.find((candidate) => candidate.modele.cle === cle);
  if (lecture === undefined) {
    throw new Error(`Modèle « ${cle} » absent : la démonstration ne dit plus ce qu'elle annonce.`);
  }
  return lecture;
}

const lectureA = lectureDe('A');
const lectureB = lectureDe('B');
const lectureAPrime = lectureDe('A′');

/**
 * Les lignes que l'arrondi change réellement — c'est-à-dire celles dont le montant exact
 * n'est pas déjà au centime. Dérivées plutôt que listées : c'est exactement le point
 * pédagogique, et une ligne ajoutée au jeu de données entre d'elle-même dans la phrase.
 */
const lignesDyadiques = lectureAPrime.montants.filter(
  (montant, index) => montant !== lectureA.montants[index],
);

/** L'écriture française d'un nombre calculé, pour que la prose et le tableau concordent. */
const fr = (value: number): string => String(value).replace('.', ',');

/** Les lignes du second jeu, telles que la page les affiche à gauche du tableau. */
const lignesArrondi = renderData.arrondi.lignes;

/**
 * Un refus au SAVE TIME, qui n'a rien à voir avec un refus au rendu.
 *
 * Il lui faut son propre véhicule : `reportRefusal` ne capture qu'une
 * `ExpressionEvaluationError` et relance tout le reste, or un `ZodError` ne porte ni
 * `code`, ni `site`, ni `at`. Et l'argument fautif ne se construirait même pas —
 * `{ mode: 'halfUp' }` ne type-checke pas comme `Expression`, ce qui est exactement le
 * garde-fou attendu côté TypeScript. D'où un `unknown` et un `safeParse`.
 */
interface ParseRefusalReport {
  readonly title: string;
  readonly path: string;
  readonly message: string;
}

function reportParseRefusal(title: string, raw: unknown): ParseRefusalReport {
  const result = ExpressionSchema.safeParse(raw);
  if (result.success) {
    throw new Error(`« ${title} » aurait dû être refusée au parse : contrat de core cassé.`);
  }
  const issue = result.error.issues[0];
  if (issue === undefined) {
    throw new Error(`« ${title} » a été refusée sans motif : contrat de core cassé.`);
  }
  return { title, path: issue.path.join(' → '), message: issue.message };
}

const arrondiValide = { kind: 'round', value: { kind: 'path', path: 'arrondi.total' } };

const parseRefusals: readonly ParseRefusalReport[] = [
  reportParseRefusal('Un mode qui n’existe pas', { ...arrondiValide, decimals: 2, mode: 'halfUp' }),
  reportParseRefusal('Un nom de règle plutôt qu’une opération', {
    ...arrondiValide,
    decimals: 2,
    mode: 'bankers',
  }),
  reportParseRefusal('Une position fractionnaire', {
    ...arrondiValide,
    decimals: 2.5,
    mode: 'halfEven',
  }),
  reportParseRefusal('Une position hors de la fenêtre', {
    ...arrondiValide,
    decimals: MIN_ROUND_DECIMALS - 1,
    mode: 'halfEven',
  }),
];

/**
 * Le même contrôle, du point de vue de l'INTÉGRATEUR.
 *
 * Il construit un nœud par programme et veut le valider avant de le stocker, sans passer
 * par le template entier : c'est ce consommateur — immédiat, et hors du dépôt — qui
 * justifie que le kind exporte son schéma membre et les deux bornes de sa fenêtre.
 */
const horsFenetre = RoundExpressionSchema.safeParse({
  ...arrondiValide,
  decimals: MAX_ROUND_DECIMALS + 1,
  mode: 'halfExpand',
});
const messageHorsFenetre = horsFenetre.success
  ? '(acceptée — ce que le contrat interdit)'
  : (horsFenetre.error.issues[0]?.message ?? '(refusée sans motif)');

/**
 * Un avant-goût du lot C8 : la charge machine qu'une formule fautive rend.
 *
 * Le `catch` EST la démonstration ici — c'est la seule section où il ne s'agit pas de
 * dégrader. Il est narrowé par `instanceof`, jamais par un cast, et il affiche
 * `details.code`, `details.site` et `details.at`. Le champ s'appelle `site` et non
 * `kind` parce que `LoopNode.each` et `ConditionNode.when` portent une expression sans
 * en être : `ExpressionKind` ne suffisait pas.
 *
 * Rien de la charge ne vient des DONNÉES : `actualType` est le *tag* d'une valeur, pas
 * la valeur. C'est ce qui rend un refus sûr à journaliser même quand le document ne
 * l'est pas.
 */
interface RefusalReport {
  readonly title: string;
  readonly code: string;
  readonly site: string;
  readonly at: string;
  readonly detail: string;
  readonly message: string;
}

/**
 * Le budget des démonstrations de refus, et il est SÉPARÉ de celui de la facture.
 *
 * Ces quatre formules fautives n'appartiennent à aucun document : les charger au budget de
 * la facture gonflait le compteur que la section « Budget du rendu » affiche sous son nom —
 * mesuré, 145 opérations affichées pour 124 réelles. La page enseigne qu'un compteur partagé
 * au-delà d'un document est l'erreur ; elle n'a pas le droit de la commettre en la montrant.
 */
const budgetDemonstrations: EvaluationBudget = createBudget();

function reportRefusal(title: string, expression: Expression): RefusalReport {
  try {
    evaluateExpression(expression, renderData, { budget: budgetDemonstrations });
  } catch (error) {
    if (error instanceof ExpressionEvaluationError) {
      const details = error.details;
      return {
        title,
        code: details.code,
        site: details.site,
        at: details.at.length === 0 ? '(racine)' : details.at.join(' → '),
        detail:
          'actualType' in details
            ? `actualType : ${details.actualType}`
            : `limit : ${details.limit}`,
        message: error.message,
      };
    }
    throw error;
  }
  throw new Error(`« ${title} » aurait dû être refusée : contrat de core cassé.`);
}

const refusals: readonly RefusalReport[] = [
  reportRefusal('Diviser par un nombre de lignes non gardé', {
    kind: 'arithmetic',
    op: 'div',
    left: totalHT,
    right: { kind: 'literal', value: 0 },
  }),
  reportRefusal('Additionner un texte à un nombre', {
    kind: 'arithmetic',
    op: 'add',
    left: { kind: 'path', path: 'commande.client' },
    right: { kind: 'literal', value: 1 },
  }),
  reportRefusal('Coller un nombre sans passer par text()', {
    kind: 'concat',
    parts: [
      { kind: 'literal', value: 'N° ' },
      { kind: 'path', path: 'commande.numero' },
    ],
  }),
  reportRefusal('Une date qui n’existe pas au calendrier', {
    kind: 'endOfMonth',
    date: { kind: 'literal', value: '2026-02-30' },
  }),
];

const codeStyle = {
  background: '#f4f4f4',
  padding: '1rem',
  borderRadius: '4px',
  overflowX: 'auto',
} as const;

const refusalStyle = {
  background: '#fff4f4',
  border: '1px solid #f0c0c0',
  padding: '0.75rem',
  borderRadius: '4px',
  marginBottom: '0.75rem',
} as const;

/**
 * Une couleur distincte : un refus au save time n'est pas un refus au rendu.
 *
 * Dérivé, pas recopié — les deux sortes de cartes se lisent en séquence sur la même page, et
 * la phrase ci-dessus ne reste vraie que si la géométrie a UNE source.
 */
const parseRefusalStyle = {
  ...refusalStyle,
  background: '#fffaf0',
  border: '1px solid #e8d5a0',
} as const;

const tableStyle = { borderCollapse: 'collapse', marginBottom: '1rem' } as const;

const cellStyle = {
  border: '1px solid #ddd',
  padding: '0.35rem 0.75rem',
  textAlign: 'left',
} as const;

/** L'écart d'un centime se lit sur cette ligne : elle est mise en évidence pour cela. */
const totalCellStyle = { ...cellStyle, background: '#f0f6ff', fontWeight: 'bold' } as const;

/**
 * Le pied du tableau de lignes, et il ne réutilise PAS `totalCellStyle`.
 *
 * Celui-ci existe pour une raison nommée — « l'écart d'un centime se lit sur cette ligne » —
 * et l'emprunter pour une ligne de total ordinaire rendrait ce commentaire faux. Deux raisons,
 * deux constantes.
 */
const pieceDePiedStyle = { ...cellStyle, fontWeight: 'bold' } as const;

/**
 * Le style du tableau de lignes, et il est SÉPARÉ de `tableStyle` pour deux raisons.
 *
 * `tableLayout: 'fixed'` plus une largeur définie sont ce qui rend les pourcentages de
 * `<colgroup>` **autoritaires**. Sans eux, l'algorithme de table automatique traite une
 * largeur de colonne en pourcentage comme une simple suggestion et la fait perdre contre le
 * minimum de contenu : mesuré, un conteneur contraint rendait 24,79 / 14,10 / 19,06 / 21,59 /
 * 20,47 % là où le modèle déclare 33,33 / 11,11 / 16,67 / 16,67 / 22,22 %. La section affirme
 * que les largeurs sont `width / Σ width` ; il faut donc que ce soit vrai, et pas seulement
 * dans une fenêtre assez large pour que le tableau puisse grandir.
 *
 * Et c'est une constante distincte parce que le `<table>` comparatif des trois arrondis
 * partage `tableStyle` et doit rester inchangé — il agrège trois documents et porte un
 * `colSpan` que le contrat ne décrit pas.
 */
const tableauLignesStyle = { ...tableStyle, width: '100%', tableLayout: 'fixed' } as const;

export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>🚀 Openview Playground</h1>
      <p>
        Template <strong>{sampleTemplate.name}</strong> validé au schéma v
        {sampleTemplate.schemaVersion}.
      </p>

      <h2>Parcours de l'AST (Visiteur, profondeur d'abord)</h2>
      <ol>
        {nodeIds.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ol>

      <h2>Données requises (analyse statique des expressions)</h2>
      <p>
        Aucun alias n'y figure : <code>line</code> est déclaré par le template, qu'il soit lié par
        le groupe de lignes du tableau, par l'agrégat ou par le filtre — <strong>quatre</strong>{' '}
        sites d'alias depuis le lot C3, et le quatrième ne fuit pas plus que les trois autres. Les
        autres chemins sont les noms choisis par l'application intégratrice — c'est la liste que le
        moteur <em>rend</em> à l'appelant, pas une liste qu'il lui <em>impose</em>. Remarquez qu'
        <code>traitement.effectueLe</code> y figure comme n'importe quelle autre clé : « aujourd'hui
        » est une donnée, pas une horloge.
      </p>
      <ul>
        {dataPaths.map((dataPath) => (
          <li key={dataPath}>
            <code>{dataPath}</code>
          </li>
        ))}
      </ul>

      <h2>Titre : concaténation, mise en chaîne explicite et majuscules</h2>
      <p>
        <code>{titleSegments.join(' + ')}</code>
      </p>

      <h2>Tableau de lignes : trois sections nommées, et rien de deviné</h2>
      <p>
        Le <code>&lt;table&gt;</code> ci-dessous est <strong>intégralement dérivé</strong> du nœud{' '}
        <code>table</code> du modèle validé : le <code>&lt;thead&gt;</code> depuis{' '}
        <code>header</code>, le <code>&lt;tbody&gt;</code> depuis <code>body</code>, le{' '}
        <code>&lt;tfoot&gt;</code> depuis <code>footer</code>, les largeurs en{' '}
        <code>width / Σ width</code> et les alignements lus sur <code>align</code>. Aucune cellule
        n'est écrite à la main, et <em>aucune information n'est inventée en chemin</em> — c'est
        exactement ce que cette démonstration doit prouver, et qu'aucun test de <code>core</code> ne
        peut prouver, puisque <code>core</code> ne rend rien.
      </p>
      <p>
        Aucun montant de ligne n'est fourni par le jeu de données : chacun est le produit d'une
        quantité par un prix unitaire, calculé par le modèle. La dernière ligne est une{' '}
        <strong>ligne courte</strong> — deux cellules pour cinq colonnes — et son total est une{' '}
        <em>expression du modèle</em>, pas une somme que le tableau saurait faire : son{' '}
        <code>footer</code> n'a nulle part où poser un agrégat.
      </p>
      <table style={tableauLignesStyle}>
        <colgroup>
          {tableauLignes.columns.map((column, index) => (
            <col key={column.id} style={{ width: largeurs[index] }} />
          ))}
        </colgroup>
        {/*
          Une clé de ligne est positionnelle par nature, et c'est vrai des TROIS sections. Les
          lignes ne sont jamais réordonnées, deux lignes identiques doivent rester deux entrées
          distinctes, et une clé dérivée du contenu les confondrait. `row.id` n'est PAS une clé
          valide : `nodeIdSchema` est un simple `z.string().min(1)`, rien dans `core` n'impose
          l'unicité des ids de nœud, et `TableNode.header` déclare explicitement que plusieurs
          lignes d'en-tête sont licites — deux lignes portant le même id passent le schéma et
          donneraient à React deux clés identiques.
        */}
        <thead>
          {lignesEntete.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée (AGENTS.md §1.1)
            <tr key={rowIndex /* NOSONAR : même justification, cf. le commentaire ci-dessus */}>
              {row.cases.map(({ column, texte }) => (
                <th key={column.id} style={{ ...cellStyle, textAlign: column.align }}>
                  {texte}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {lignesCorps.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée (AGENTS.md §1.1)
            <tr key={rowIndex /* NOSONAR : même justification, cf. le commentaire ci-dessus */}>
              {row.cases.map(({ column, texte }) => (
                <td key={column.id} style={{ ...cellStyle, textAlign: column.align }}>
                  {texte}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {lignesPied.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée (AGENTS.md §1.1)
            <tr key={rowIndex /* NOSONAR : même justification, cf. le commentaire ci-dessus */}>
              {row.cases.map(({ column, texte }) => (
                <td key={column.id} style={{ ...pieceDePiedStyle, textAlign: column.align }}>
                  {texte}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>

      <h2>Les quatre montants, tous calculés par le modèle</h2>
      <p>
        <code>{totalSegments.join(' + ')}</code>
      </p>
      <p>
        Le prix moyen passe par un <code>if</code> qui court-circuite : la division n'est évaluée
        que si le nombre de lignes est strictement positif. Aucun arrondi n'est appliqué ici, et
        c'est délibéré : l'arrondi est un nœud <code>round</code> que le modèle écrit là où il en
        veut un. La section suivante montre ce que cette liberté coûte et ce qu'elle rend.
      </p>

      <h2>Trois modèles, un jeu de données, trois totaux</h2>
      <p>
        Les trois modèles ci-dessous lisent <strong>les mêmes cinq lignes</strong> et rendent trois
        totaux différents. Aucun n'est faux : chacun déclare autre chose. C'est le point exact où
        naît le fameux « écart d'un centime », et Openview le rend <em>visible dans l'arbre</em> au
        lieu de le décider à la place de l'auteur.
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={cellStyle}>Ligne</th>
            <th style={cellStyle}>Quantité</th>
            <th style={cellStyle}>Prix unitaire</th>
            {lectures.map((lecture) => (
              <th key={lecture.modele.cle} style={cellStyle}>
                {lecture.modele.cle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignesArrondi.map((ligne, index) => (
            <tr key={ligne.sku}>
              <td style={cellStyle}>{ligne.sku}</td>
              <td style={cellStyle}>{ligne.quantite}</td>
              <td style={cellStyle}>{ligne.prixUnitaire}</td>
              {lectures.map((lecture) => (
                <td key={lecture.modele.cle} style={cellStyle}>
                  <code>{lecture.montants[index]}</code>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th colSpan={3} style={cellStyle}>
              Total
            </th>
            {lectures.map((lecture) => (
              <td key={lecture.modele.cle} style={totalCellStyle}>
                <code>{lecture.total}</code>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ul>
        {lectures.map((lecture) => (
          <li key={lecture.modele.cle}>
            <strong>{lecture.modele.cle}</strong> — {lecture.modele.libelle}
          </li>
        ))}
      </ul>
      <p>
        <strong>
          Les deux causes de l'écart sont distinctes, et les confondre fait écrire le mauvais
          modèle.
        </strong>
      </p>
      <ul>
        <li>
          <strong>
            {fr(lectureA.total)} contre {fr(lectureB.total)}, c'est le MODE.
          </strong>{' '}
          Même position d'arrondi, même ordre : seules les lignes dyadiques —{' '}
          {lignesDyadiques.map((montant) => fr(montant)).join(' et ')} — sont des égalités exactes,
          et <code>halfEven</code> les renvoie vers le chiffre pair là où <code>halfExpand</code>{' '}
          les éloigne de zéro. Le jeu est fermé à ces deux modes :{' '}
          <code>{ROUND_MODES.join(' | ')}</code>.
        </li>
        <li>
          <strong>
            {fr(lectureAPrime.total)}, c'est la POSITION de la déclaration dans l'arbre.
          </strong>{' '}
          Aucune ligne n'est arrondie ; l'arrondi porte sur le total. Les deux modes rendent ici le{' '}
          <em>même</em> chiffre, ce qui prouve que l'écart précédent ne venait pas d'eux. Un champ{' '}
          <code>precision?</code> posé sur chaque nœud n'aurait pas su exprimer ce cas : il n'y a
          aucun nœud intermédiaire où l'accrocher.
        </li>
      </ul>
      <p>
        Le premier jeu de lignes, plus haut, dit la moitié complémentaire : sur des montants déjà
        exacts au centime, <code>round</code> est l'<strong>identité</strong>. L'arrondi n'apparaît
        que là où le modèle l'écrit, et il ne change une valeur que lorsqu'il y a quelque chose à
        changer.
      </p>
      <p>
        La position se déclare comme un entier littéral, dans une fenêtre fermée de{' '}
        <code>{MIN_ROUND_DECIMALS}</code> à <code>{MAX_ROUND_DECIMALS}</code> : « ce total
        arrondit-il comme les lignes au-dessus ? » se répond alors en comparant deux entiers dans
        l'arbre, <em>sans données et sans rendu</em>.
      </p>

      <h2>Refus à la SAUVEGARDE du modèle (et non au rendu)</h2>
      <p>
        Les refus de la section suivante se produisent au <em>rendu</em> ; ceux-ci se produisent
        quand le modèle est <em>enregistré</em>. La distinction n'est pas cosmétique : ce que le
        schéma tranche au save time est ce que le lot C2 n'a eu besoin d'aucun code d'erreur nouveau
        pour dire. La charge n'a donc ni <code>code</code>, ni <code>site</code> — elle a un chemin
        et une phrase.
      </p>
      <p>
        Les deux premiers rendent <em>la même</em> phrase, et c'est voulu : un nom à consonance
        réglementaire n'obtient aucun traitement de faveur. Un nom désigne une <em>opération</em>,
        jamais une règle — <code>halfEven</code> est le nom de « l'arrondi du banquier » quand on le
        décrit au lieu de l'invoquer.
      </p>
      {parseRefusals.map((refusal) => (
        <div key={refusal.title} style={parseRefusalStyle}>
          <strong>{refusal.title}</strong>
          <ul>
            <li>
              <code>issue.path</code> : <code>{refusal.path}</code>
            </li>
            <li>{refusal.message}</li>
          </ul>
        </div>
      ))}
      <p>
        Et le même contrôle vu de l'application intégratrice, qui construit un nœud par programme et
        le valide avant de le stocker — sans passer par le template entier :{' '}
        <code>RoundExpressionSchema.safeParse</code> d'une position à{' '}
        <code>{MAX_ROUND_DECIMALS + 1}</code> rend « {messageHorsFenetre} ».
      </p>

      <h2>Dates : échéance, « 45 jours fin de mois » et jours de retard</h2>
      <p>
        <code>{dateSegments.join(' + ')}</code>
      </p>
      <p>
        Valeurs brutes en <code>YYYY-MM-DD</code>, qui est une représentation d'<em>échange</em> et
        non un format d'affichage : les rendre en <code>31/03/2026</code> appartient au lot C6. Les
        jours de retard se comptent entre deux dates <em>fournies</em> — le moteur ne lit jamais
        l'horloge, sinon deux rendus du même modèle ne pourraient pas donner le même document.
      </p>

      <h2>
        Compter une liste filtrée : <code>count(filter(…))</code>
      </h2>
      <p>
        <code>{countSegments.join(' + ')}</code>
      </p>

      <h2>Refus compréhensible (avant-goût du lot C8)</h2>
      <p>
        Chaque formule ci-dessous est fautive <em>volontairement</em>. Ce que core rend est un code,
        un opérateur et un chemin depuis la racine de la formule ; il ne rend jamais la valeur
        fautive, seulement sa <em>forme</em>. C'est ce qui rend un refus sûr à journaliser même
        quand le document ne l'est pas.
      </p>
      {refusals.map((refusal) => (
        <div key={refusal.code + refusal.at} style={refusalStyle}>
          <strong>{refusal.title}</strong>
          <ul>
            <li>
              <code>details.code</code> : <code>{refusal.code}</code>
            </li>
            <li>
              <code>details.site</code> : <code>{refusal.site}</code>
            </li>
            <li>
              <code>details.at</code> : <code>{refusal.at}</code>
            </li>
            <li>
              <code>{refusal.detail}</code>
            </li>
          </ul>
          <p>{refusal.message}</p>
        </div>
      ))}

      <h2>Budget du rendu — un par DOCUMENT</h2>
      <p>
        Un budget par <em>appel</em> se réinitialiserait à chaque liaison, et un document de 500
        liaisons obtiendrait 500 fois l'allocation : la borne serait décorative. Mais un budget par{' '}
        <em>page</em> serait faux dans l'autre sens — le compteur d'un document dépendrait de ce
        qu'un autre a déjà consommé, donc de l'ordre de la démonstration. L'unité est le{' '}
        <strong>document</strong>, et cette page en rend quatre : la facture et les trois modèles
        d'arrondi, qui partagent le jeu de données et rien d'autre.
      </p>
      <ul>
        <li>
          <strong>Facture Exemple</strong> — <code>{budgetFacture.spent.steps}</code> opérations et{' '}
          <code>{budgetFacture.spent.itemsVisited}</code> éléments de liste traversés, sur{' '}
          <code>{budgetFacture.limits.maxSteps}</code> et{' '}
          <code>{budgetFacture.limits.maxItemsVisited}</code> autorisés.
        </li>
        {lectures.map((lecture) => (
          <li key={lecture.modele.cle}>
            <strong>Arrondi {lecture.modele.cle}</strong> —{' '}
            <code>{lecture.modele.budget.spent.steps}</code> opérations et{' '}
            <code>{lecture.modele.budget.spent.itemsVisited}</code> éléments de liste traversés. Un
            nœud <code>round</code> dépense <em>un</em> pas, comme tout autre nœud à opérande
            unique.
          </li>
        ))}
      </ul>
      <p>
        Les formules fautives des deux sections de refus n'appartiennent, elles, à aucun document :
        elles portent leur propre compteur — <code>{budgetDemonstrations.spent.steps}</code>{' '}
        opérations et <code>{budgetDemonstrations.spent.itemsVisited}</code> éléments — plutôt que
        de gonfler celui de la facture. C'est la même règle appliquée au cas limite : ce qui n'est
        pas un document n'a pas à peser sur le budget d'un document.
      </p>

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}

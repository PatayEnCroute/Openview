import {
  CURRENT_SCHEMA_VERSION,
  childScope,
  collectDataPaths,
  createBudget,
  type DocumentNode,
  type EvaluationBudget,
  type EvaluationScope,
  type Expression,
  ExpressionEvaluationError,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  findNodeById,
  type PrintableExpression,
  parseTemplate,
  type TextSegment,
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

/** A percentage of the total, in points, with no rounding: the model declares that in C2. */
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
  root: {
    type: 'container',
    id: 'root',
    children: [
      { type: 'text', id: 'title', content: [{ kind: 'binding', value: titre }] },
      {
        type: 'loop',
        id: 'lines',
        each: { kind: 'path', path: 'commande.lignes' },
        as: 'line',
        children: [
          {
            type: 'text',
            id: 'line-label',
            content: [
              { kind: 'binding', value: { kind: 'path', path: 'line.sku' } },
              { kind: 'literal', text: ' — montant ' },
              { kind: 'binding', value: lineAmount },
              { kind: 'literal', text: ' — remise ' },
              { kind: 'binding', value: { kind: 'path', path: 'line.discount' } },
            ],
          },
          {
            type: 'condition',
            id: 'discounted',
            when: discountApplies,
            children: [
              {
                type: 'text',
                id: 'discount-note',
                content: [{ kind: 'literal', text: 'Remise appliquée' }],
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
  // « Aujourd'hui » est une donnée, sous un nom que l'intégrateur choisit.
  traitement: { effectueLe: '2026-03-10' },
};

/**
 * Un seul budget pour tout le rendu, créé une fois — comme le fera le pipeline.
 *
 * Un budget par appel se réinitialiserait à chaque liaison, et un document de 500
 * liaisons obtiendrait 500 fois l'allocation : la borne serait décorative.
 */
const budget: EvaluationBudget = createBudget();

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
function rawSegments(segments: readonly TextSegment[], scope: EvaluationScope): readonly string[] {
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
function requireNode(id: string): DocumentNode {
  const node = findNodeById(sampleTemplate.root, id);
  if (node === undefined) {
    throw new Error(`Nœud « ${id} » absent du document validé : contrat de core cassé.`);
  }
  return node;
}

function requireTextNode(id: string): readonly TextSegment[] {
  const node = requireNode(id);
  if (node.type !== 'text') {
    throw new Error(`« ${id} » devrait être un texte, pas un ${node.type}.`);
  }
  return node.content;
}

const nodeIds = [...walk(sampleTemplate.root)].map((node) => `${node.id} (${node.type})`);
const dataPaths = collectDataPaths(sampleTemplate.root);

// Tout ce qui suit se lit sur le document validé : l'alias sur le nœud de boucle,
// la condition sur le nœud de condition. Les expressions déclarées plus haut ne
// servent qu'à construire le template ; l'évaluation ci-dessous n'y touche pas.
const loopNode = requireNode('lines');
if (loopNode.type !== 'loop') {
  throw new Error(`« lines » devrait être une boucle, pas un ${loopNode.type}.`);
}

const conditionNode = requireNode('discounted');
if (conditionNode.type !== 'condition') {
  throw new Error(`« discounted » devrait être une condition, pas un ${conditionNode.type}.`);
}

const titleSegments = rawSegments(requireTextNode('title'), renderData);
const totalSegments = rawSegments(requireTextNode('totals'), renderData);
const dateSegments = rawSegments(requireTextNode('dates'), renderData);
const countSegments = rawSegments(requireTextNode('discount-count'), renderData);

const lineLabelContent = requireTextNode('line-label');
const lineRows = evaluateSequence(loopNode.each, renderData, { budget }).map((item) => {
  const lineScope = childScope(renderData, loopNode.as, item);
  return {
    label: rawSegments(lineLabelContent, lineScope).join(' + '),
    discounted: evaluatePredicate(conditionNode.when, lineScope, { budget }),
  };
});

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

function reportRefusal(title: string, expression: Expression): RefusalReport {
  try {
    evaluateExpression(expression, renderData, { budget });
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
        la boucle, par l'agrégat ou par le filtre. Les autres chemins sont les noms choisis par
        l'application intégratrice — c'est la liste que le moteur <em>rend</em> à l'appelant, pas
        une liste qu'il lui <em>impose</em>. Remarquez qu'<code>traitement.effectueLe</code> y
        figure comme n'importe quelle autre clé : « aujourd'hui » est une donnée, pas une horloge.
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

      <h2>Boucle : une portée dérivée par élément, et un montant calculé</h2>
      <p>
        Aucun montant de ligne n'est fourni par le jeu de données : chacun est le produit d'une
        quantité par un prix unitaire, calculé par le modèle.
      </p>
      <ol>
        {/*
          Les lignes d'une boucle sont positionnelles : elles ne sont jamais
          réordonnées, et deux lignes de facture identiques doivent rester deux
          entrées distinctes. L'index est donc ici la clé juste — une clé dérivée du
          contenu les confondrait, et la composer avec l'index ne fait que sortir du
          champ de vision de la règle sans la satisfaire.
        */}
        {lineRows.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée (AGENTS.md §1.1)
          <li key={index /* NOSONAR : même justification, cf. le commentaire ci-dessus */}>
            <code>{row.label}</code> — remise {row.discounted ? 'appliquée' : 'absente'}
          </li>
        ))}
      </ol>

      <h2>Les quatre montants, tous calculés par le modèle</h2>
      <p>
        <code>{totalSegments.join(' + ')}</code>
      </p>
      <p>
        Le prix moyen passe par un <code>if</code> qui court-circuite : la division n'est évaluée
        que si le nombre de lignes est strictement positif. Aucun arrondi n'est appliqué — c'est le
        modèle qui le déclarera, au lot C2.
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

      <h2>Budget du rendu</h2>
      <p>
        Un seul budget pour tout ce qui précède, créé une fois comme le fera le pipeline :{' '}
        <code>{budget.spent.steps}</code> opérations et <code>{budget.spent.itemsVisited}</code>{' '}
        éléments de liste traversés, sur <code>{budget.limits.maxSteps}</code> et{' '}
        <code>{budget.limits.maxItemsVisited}</code> autorisés. Un budget par appel se
        réinitialiserait à chaque liaison, et la borne deviendrait décorative.
      </p>

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}

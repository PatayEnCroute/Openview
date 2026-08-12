import {
  CURRENT_SCHEMA_VERSION,
  childScope,
  collectDataPaths,
  type DocumentNode,
  type EvaluationScope,
  type Expression,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  findNodeById,
  parseTemplate,
  walk,
} from '@openview/core';

// Exercises the core contract end to end: recursive parsing, Visitor traversal,
// static path analysis, expression evaluation and loop scoping. If
// @openview/core breaks its contract, this page stops rendering -- which is the
// point of the playground.

const discountApplies: Expression = {
  kind: 'compare',
  op: 'gt',
  left: { kind: 'path', path: 'line.discount' },
  right: { kind: 'literal', value: 0 },
};

const sampleTemplate = parseTemplate({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'tpl_demo_1',
  name: 'Facture Exemple',
  version: '1.0.0',
  root: {
    type: 'container',
    id: 'root',
    children: [
      {
        type: 'text',
        id: 'title',
        content: [
          { kind: 'literal', text: 'Facture ' },
          { kind: 'binding', value: { kind: 'path', path: 'invoice.number' } },
        ],
      },
      {
        type: 'loop',
        id: 'lines',
        each: { kind: 'path', path: 'invoice.lines' },
        as: 'line',
        children: [
          {
            type: 'text',
            id: 'line-label',
            content: [
              { kind: 'binding', value: { kind: 'path', path: 'line.sku' } },
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
    ],
  },
});

const renderData = {
  invoice: {
    number: 'F-2026-014',
    lines: [
      { sku: 'A-1', discount: 0 },
      { sku: 'B-2', discount: 15 },
    ],
  },
};

/**
 * Valeurs brutes, volontairement : transformer une liaison en texte imprimable
 * est le travail de `DataBindingStep` (étape 2), et l'ADR 0001 laisse ouverte la
 * politique de la valeur absente. Le playground ne la tranche pas à sa place.
 */
function rawSegments(node: DocumentNode | undefined, scope: EvaluationScope): readonly string[] {
  if (node === undefined || node.type !== 'text') {
    return [];
  }
  return node.content.map((segment) => {
    if (segment.kind === 'literal') {
      return JSON.stringify(segment.text);
    }
    const value = evaluateExpression(segment.value, scope);
    return value === undefined ? '(absent)' : JSON.stringify(value);
  });
}

const nodeIds = [...walk(sampleTemplate.root)].map((node) => `${node.id} (${node.type})`);
const dataPaths = collectDataPaths(sampleTemplate.root);

// Tout ce qui suit se lit sur le document validé : l'alias sur le nœud de boucle,
// la condition sur le nœud de condition. `discountApplies` plus haut ne sert qu'à
// construire le template ; l'évaluation ci-dessous n'y touche pas.
const loopNode = findNodeById(sampleTemplate.root, 'lines');
const conditionNode = findNodeById(sampleTemplate.root, 'discounted');
const discountCondition = conditionNode?.type === 'condition' ? conditionNode.when : undefined;

const lineScopes =
  loopNode?.type === 'loop'
    ? evaluateSequence(loopNode.each, renderData).map((item) =>
        childScope(renderData, loopNode.as, item),
      )
    : [];

const titleSegments = rawSegments(findNodeById(sampleTemplate.root, 'title'), renderData);
const lineLabelNode = findNodeById(sampleTemplate.root, 'line-label');

// Évalué hors du rendu. La clé combine la position et le contenu : deux lignes de
// facture identiques restent distinctes, là où le contenu seul les aurait
// confondues.
const lineRows = lineScopes.map((lineScope, index) => {
  const label = rawSegments(lineLabelNode, lineScope).join(' + ');
  return {
    key: `${index}-${label}`,
    label,
    discounted: discountCondition !== undefined && evaluatePredicate(discountCondition, lineScope),
  };
});

const codeStyle = {
  background: '#f4f4f4',
  padding: '1rem',
  borderRadius: '4px',
  overflowX: 'auto',
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
        Les alias de boucle n'y figurent pas : <code>line</code> est déclaré par le template, ce
        n'est pas une clé que l'appelant fournit.
      </p>
      <ul>
        {dataPaths.map((dataPath) => (
          <li key={dataPath}>
            <code>{dataPath}</code>
          </li>
        ))}
      </ul>

      <h2>Liaisons du titre (valeurs brutes)</h2>
      <p>
        <code>{titleSegments.join(' + ')}</code>
      </p>

      <h2>Boucle : une portée dérivée par élément</h2>
      <ol>
        {lineRows.map((row) => (
          <li key={row.key}>
            <code>{row.label}</code> — remise {row.discounted ? 'appliquée' : 'absente'}
          </li>
        ))}
      </ol>

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}

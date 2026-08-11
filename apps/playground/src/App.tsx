import {
  CURRENT_SCHEMA_VERSION,
  collectDataPaths,
  type Expression,
  evaluatePredicate,
  evaluateSequence,
  parseTemplate,
  walk,
} from '@openview/core';

// Exercises the core contract end to end: recursive parsing, Visitor traversal,
// static path analysis and expression evaluation. If @openview/core breaks its
// contract, this page stops rendering -- which is the point of the playground.

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
      { type: 'text', id: 'title', content: 'Facture' },
      {
        type: 'loop',
        id: 'lines',
        each: { kind: 'path', path: 'invoice.lines' },
        children: [
          { type: 'text', id: 'line-label', content: 'Ligne' },
          {
            type: 'condition',
            id: 'discounted',
            when: discountApplies,
            children: [{ type: 'text', id: 'discount-note', content: 'Remise appliquée' }],
          },
        ],
      },
    ],
  },
});

const renderData = {
  invoice: {
    lines: [
      { sku: 'A-1', discount: 0 },
      { sku: 'B-2', discount: 15 },
    ],
  },
};

const nodeIds = [...walk(sampleTemplate.root)].map((node) => `${node.id} (${node.type})`);
const dataPaths = collectDataPaths(sampleTemplate.root);
const lines = evaluateSequence({ kind: 'path', path: 'invoice.lines' }, renderData);
const discountPerLine = lines.map((line) => evaluatePredicate(discountApplies, { line }));

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
      <ul>
        {dataPaths.map((dataPath) => (
          <li key={dataPath}>
            <code>{dataPath}</code>
          </li>
        ))}
      </ul>

      <h2>Évaluation de la condition, ligne par ligne</h2>
      <ul>
        {discountPerLine.map((applies, index) => (
          <li key={nodeIds[index] ?? index}>
            Ligne {index + 1} : remise {applies ? 'appliquée' : 'absente'}
          </li>
        ))}
      </ul>

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}

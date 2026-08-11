import { CURRENT_SCHEMA_VERSION, collectExpressions, parseTemplate, walk } from '@openview/core';

// Exercises the core contract end to end: recursive parsing, Visitor traversal
// and static expression collection. If @openview/core breaks its contract, this
// page stops rendering -- which is the point of the playground.
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
        each: 'invoice.lines',
        children: [
          { type: 'text', id: 'line-label', content: 'Ligne' },
          {
            type: 'condition',
            id: 'discounted',
            when: 'line.discount > 0',
            children: [{ type: 'text', id: 'discount-note', content: 'Remise appliquée' }],
          },
        ],
      },
    ],
  },
});

const nodeIds = [...walk(sampleTemplate.root)].map((node) => `${node.id} (${node.type})`);
const expressions = collectExpressions(sampleTemplate.root);

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

      <h2>Expressions requises par le template</h2>
      {expressions.length === 0 ? (
        <p>Aucune liaison dynamique.</p>
      ) : (
        <ul>
          {expressions.map((expression) => (
            <li key={expression}>
              <code>{expression}</code>
            </li>
          ))}
        </ul>
      )}

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}

import { parseTemplateSchema } from '@openview/core';

export default function App() {
  const sampleTemplate = parseTemplateSchema({
    id: 'tpl_demo_1',
    name: 'Facture Exemple',
    version: '1.0.0',
  });

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>🚀 Openview Playground</h1>
      <p>Application de test locale de bout en bout.</p>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px' }}>
        {JSON.stringify(sampleTemplate, null, 2)}
      </pre>
    </div>
  );
}

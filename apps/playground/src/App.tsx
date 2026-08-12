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
  type TextSegment,
  visitSegment,
  walk,
} from '@openview/core';

// Exercises the core contract end to end: recursive parsing, Visitor traversal,
// static path analysis, expression evaluation and loop scoping. If
// @openview/core breaks its contract, this page stops rendering -- which is the
// point of the playground, and the reason nothing below falls back to a default.

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
 *
 * Le parcours passe par `visitSegment` : c'est la deuxième traversée de segments
 * du dépôt, et une nouvelle sorte de segment doit casser la compilation ici.
 */
function rawSegments(segments: readonly TextSegment[], scope: EvaluationScope): readonly string[] {
  return segments.map((segment) =>
    visitSegment(segment, {
      literal: (literal) => JSON.stringify(literal.text),
      binding: (binding) => {
        const value = evaluateExpression(binding.value, scope);
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

const nodeIds = [...walk(sampleTemplate.root)].map((node) => `${node.id} (${node.type})`);
const dataPaths = collectDataPaths(sampleTemplate.root);

// Tout ce qui suit se lit sur le document validé : l'alias sur le nœud de boucle,
// la condition sur le nœud de condition. `discountApplies` plus haut ne sert qu'à
// construire le template ; l'évaluation ci-dessous n'y touche pas.
const titleNode = requireNode('title');
if (titleNode.type !== 'text') {
  throw new Error(`« title » devrait être un texte, pas un ${titleNode.type}.`);
}

const loopNode = requireNode('lines');
if (loopNode.type !== 'loop') {
  throw new Error(`« lines » devrait être une boucle, pas un ${loopNode.type}.`);
}

const lineLabelNode = requireNode('line-label');
if (lineLabelNode.type !== 'text') {
  throw new Error(`« line-label » devrait être un texte, pas un ${lineLabelNode.type}.`);
}

const conditionNode = requireNode('discounted');
if (conditionNode.type !== 'condition') {
  throw new Error(`« discounted » devrait être une condition, pas un ${conditionNode.type}.`);
}

const titleSegments = rawSegments(titleNode.content, renderData);

const lineRows = evaluateSequence(loopNode.each, renderData).map((item) => {
  const lineScope = childScope(renderData, loopNode.as, item);
  return {
    label: rawSegments(lineLabelNode.content, lineScope).join(' + '),
    discounted: evaluatePredicate(conditionNode.when, lineScope),
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
        {lineRows.map((row, index) => (
          // Les lignes d'une boucle sont positionnelles : elles ne sont jamais
          // réordonnées, et deux lignes de facture identiques doivent rester deux
          // entrées distinctes. L'index est donc ici la clé juste — une clé dérivée
          // du contenu les confondrait, et la composer avec l'index ne fait que
          // sortir du champ de vision de la règle sans la satisfaire.
          // biome-ignore lint/suspicious/noArrayIndexKey: clé positionnelle assumée, cf. ci-dessus (AGENTS.md §1.1)
          <li key={index}>
            <code>{row.label}</code> — remise {row.discounted ? 'appliquée' : 'absente'}
          </li>
        ))}
      </ol>

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}

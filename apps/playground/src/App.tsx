import {
  type BlockNode,
  type BorderEdge,
  type BoxStyle,
  CURRENT_SCHEMA_VERSION,
  checkTemplateDataCompatibility,
  childScope,
  collectTemplateDataPaths,
  createBudget,
  type DataCatalogueEntry,
  type DiagnosticContext,
  type DocumentNode,
  diagnosticOfPresentationRefusal,
  diagnosticsOf,
  type EvaluationBudget,
  type EvaluationScope,
  evaluateExpression,
  evaluatePredicate,
  evaluateSequence,
  findNodeById,
  formatDate,
  formatDecimal,
  formatMoney,
  listDataCatalogueEntries,
  MAX_ROUND_DECIMALS,
  MIN_ROUND_DECIMALS,
  mmFromPt,
  type OpenviewDiagnostic,
  type PageBand,
  type PageBandOccurrence,
  type PageLayerPlane,
  type PageSetup,
  type Presentation,
  type PrintableExpression,
  parseTemplate,
  printableAreaOf,
  ROUND_MODES,
  type RoundExpression,
  RoundExpressionSchema,
  type RoundMode,
  resolvePresentation,
  resolveTextAlign,
  resolveTypography,
  type TableCell,
  type TableColumn,
  type TableColumnAlignment,
  type TableNode,
  type TableRowNode,
  type Template,
  type TextAlignment,
  type TextSegment,
  type Typography,
  visitNode,
  visitSegment,
  walk,
} from '@openview/core';
import type { CSSProperties, ReactNode } from 'react';
import { catalogueFacture, catalogueSansPrix, catalogueValide } from './examples/data-catalogue.js';

// Exercises the core contract end to end: recursive parsing, Visitor traversal,
// static path analysis, expression evaluation, loop scoping, the C1 algebra and the
// diagnostics that turn a refusal into a sentence. If @openview/core breaks its
// contract, this page stops rendering -- which is the point of the playground, and
// the reason nothing below falls back to a default.
//
// It is also the ONLY real consumer of the package barrel, so it is what reveals an
// export forgotten in index.ts -- a blind spot of all four gates on the core side.

// The reference invoice lives in its own module: this page consumes it.
import {
  APPARENCE_A,
  APPARENCE_B,
  factureVariante,
  remise,
  renderData,
  sampleTemplate,
  titre,
  totalHT,
} from './examples/reference-invoice.js';
import { RenderDownloadPanel } from './rendering/RenderDownloadPanel.js';

/** Document evaluation budget for the reference invoice template. */
const budgetFacture: EvaluationBudget = createBudget();

/** Evaluates text segments into raw string representations. */
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
      // Placeholder for page number marker before backend pagination.
      pageField: (marker) => `⟨${marker.field}⟩`,
    }),
  );
}

/** Finds a node by id in the AST or throws if missing. */
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

/** Requires and narrows a TableNode by id. */
function requireTableNode(root: DocumentNode, id: string): TableNode {
  const node = requireNode(root, id);
  if (node.type !== 'table') {
    throw new Error(`« ${id} » devrait être un tableau, pas un ${node.type}.`);
  }
  return node;
}

/** Document roots including page band contents. */
const racines: readonly DocumentNode[] = [
  sampleTemplate.root,
  ...sampleTemplate.page.header.map((bande) => bande.content),
  ...sampleTemplate.page.footer.map((bande) => bande.content),
];

const nodeIds = racines.flatMap((racine) =>
  [...walk(racine)].map((node) => `${node.id} (${node.type})`),
);

/** Data paths collected from the complete template. */
const dataPaths = collectTemplateDataPaths(sampleTemplate);

/** Data catalogue entries and compatibility checks for template demonstration. */
const champsDeclares: readonly DataCatalogueEntry[] = listDataCatalogueEntries(catalogueFacture);
const compatibiliteComplete = checkTemplateDataCompatibility(sampleTemplate, catalogueFacture);
const compatibiliteSansPrix = checkTemplateDataCompatibility(sampleTemplate, catalogueSansPrix);

// Evaluates node bindings directly on the validated AST structure.
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
 * Invoice table rendering demonstration
 * ------------------------------------------------------------------------------------- */

/** Computes percentage column width from relative integer weights. */
function partsDeLargeur(columns: readonly TableColumn[]): readonly string[] {
  const total = columns.reduce((somme, column) => somme + column.width, 0);
  return columns.map((column) => `${(column.width / total) * 100}%`);
}

/** Resolves text block segments into display text strings. */
function texteDeSegments(
  segments: readonly TextSegment[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): string {
  return runsDeSegments(segments, scope, budget, undefined)
    .map((run) => run.texte)
    .join('');
}

/** Paintable run containing text and resolved typography. */
interface RunAffiche {
  readonly texte: string;
  readonly typographie: Typography | undefined;
}

/** Resolves text runs with their merged typography styles. */
function runsDeSegments(
  segments: readonly TextSegment[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
  bloc: Typography | undefined,
): readonly RunAffiche[] {
  return segments.map((segment) => {
    const texte = visitSegment(segment, {
      literal: (literal) => literal.text,
      binding: (binding) => {
        const value = evaluateExpression(binding.value, scope, { budget });
        // If missing data, render an empty cell.
        if (value === undefined) {
          return '';
        }
        // Type narrowing to convert scalar values to string safely.
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          typeof value === 'bigint'
        ) {
          return String(value);
        }
        return JSON.stringify(value);
      },
      // Placeholder value for page number before pagination engine execution.
      pageField: () => '1',
    });
    const typographie = resolveTypography({
      run: visitSegment<Typography | undefined>(segment, {
        literal: (literal) => literal.typography,
        binding: (binding) => binding.typography,
        pageField: (marqueur) => marqueur.typography,
      }),
      block: bloc,
    });
    return { texte, typographie };
  });
}

/** Scale factor for document rendering in pixels per millimeter. */
const PX_PAR_MM = 2.6;

/** Quotes font family names safely for CSS properties. */
function familleDePoliceCss(famille: string | undefined): string | undefined {
  if (famille === undefined) {
    return undefined;
  }

  const morceaux: string[] = [];
  for (const caractere of famille) {
    const pointDeCode = caractere.codePointAt(0);
    if (pointDeCode === undefined) {
      continue;
    }
    if (caractere === '"' || caractere === '\\') {
      morceaux.push(`\\${caractere}`);
    } else if (pointDeCode <= 0x1f || pointDeCode === 0x7f) {
      morceaux.push(`\\${pointDeCode.toString(16)} `);
    } else {
      morceaux.push(caractere);
    }
  }
  return `"${morceaux.join('')}"`;
}

const filetCss = (arete: BorderEdge | undefined): string | undefined =>
  arete === undefined ? undefined : `${arete.width * PX_PAR_MM}px solid ${arete.color}`;

function graisseCss(gras: boolean | undefined): CSSProperties['fontWeight'] {
  if (gras === undefined) {
    return undefined;
  }
  return gras ? 700 : 400;
}

function inclinaisonCss(italique: boolean | undefined): CSSProperties['fontStyle'] {
  if (italique === undefined) {
    return undefined;
  }
  return italique ? 'italic' : 'normal';
}

/** Converts node BoxStyle and Typography declarations to React CSSProperties. */
function styleCssDe(box: BoxStyle | undefined, typo: Typography | undefined): CSSProperties {
  const mm = (valeur: number): string => `${valeur * PX_PAR_MM}px`;

  return {
    backgroundColor: box?.background,
    borderTop: filetCss(box?.border?.top),
    borderRight: filetCss(box?.border?.right),
    borderBottom: filetCss(box?.border?.bottom),
    borderLeft: filetCss(box?.border?.left),
    paddingTop: box?.padding === undefined ? undefined : mm(box.padding.top),
    paddingRight: box?.padding === undefined ? undefined : mm(box.padding.right),
    paddingBottom: box?.padding === undefined ? undefined : mm(box.padding.bottom),
    paddingLeft: box?.padding === undefined ? undefined : mm(box.padding.left),
    fontFamily: familleDePoliceCss(typo?.family),
    // Converts points to millimeters, then millimeters to pixels.
    fontSize: typo?.sizePt === undefined ? undefined : mm(mmFromPt(typo.sizePt)),
    fontWeight: graisseCss(typo?.bold),
    fontStyle: inclinaisonCss(typo?.italic),
    color: typo?.color,
  };
}

/** Map TextAlignment to CSS text-align property value. */
const alignementCss = (align: TextAlignment | undefined): CSSProperties['textAlign'] => align;

/** Generates stable item keys for list rendering. */
const avecCle = <T,>(
  items: readonly T[],
  nom: (item: T) => string,
): readonly { readonly cle: string; readonly item: T }[] =>
  items.map((item, index) => ({ cle: `${nom(item)}#${index}`, item }));

/** Renders a block node to React JSX matching core styling and conditions. */
function Bloc({
  bloc,
  scope,
  budget,
  colonne,
}: {
  readonly bloc: BlockNode;
  readonly scope: EvaluationScope;
  readonly budget: EvaluationBudget;
  readonly colonne?: TableColumnAlignment | undefined;
}) {
  const enfants = (blocs: readonly BlockNode[], portee: EvaluationScope = scope) =>
    avecCle(blocs, (enfant) => enfant.id).map(({ cle, item }) => (
      <Bloc key={cle} bloc={item} scope={portee} budget={budget} />
    ));

  return visitNode<ReactNode>(bloc, {
    text: (texte) => (
      <div
        style={{
          ...styleCssDe(texte.box, undefined),
          // Resolve text alignment following core hierarchy.
          textAlign: alignementCss(resolveTextAlign({ text: texte.align, column: colonne })),
        }}
      >
        {/* Render span per text run with resolved typography styles */}
        {avecCle(
          runsDeSegments(texte.content, scope, budget, texte.typography),
          (run) => run.texte,
        ).map(({ cle, item }) => (
          <span key={cle} style={styleCssDe(undefined, item.typographie)}>
            {item.texte}
          </span>
        ))}
      </div>
    ),
    image: (image) => <div style={styleCssDe(image.box, undefined)}>{image.alt ?? image.src}</div>,
    container: (conteneur) => (
      <div style={styleCssDe(conteneur.box, undefined)}>{enfants(conteneur.children)}</div>
    ),
    // Null return when condition evaluates to false.
    condition: (condition) =>
      evaluatePredicate(condition.when, scope, { budget }) ? enfants(condition.children) : null,
    loop: (boucle) =>
      avecCle(evaluateSequence(boucle.each, scope, { budget }), () => boucle.as).map(
        ({ cle, item }) => (
          // Create iteration scope using childScope from core.
          <div key={cle}>{enfants(boucle.children, childScope(scope, boucle.as, item))}</div>
        ),
      ),
    table: (tableau) => <Tableau tableau={tableau} scope={scope} budget={budget} />,
    // Grid track sizes derived from core validation rules.
    grid: (grille) => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${grille.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${grille.rows}, ${grille.step * PX_PAR_MM}px)`,
          ...styleCssDe(grille.box, undefined),
        }}
      >
        {avecCle(grille.items, (item) => item.content.id).map(({ cle, item }) => (
          <div
            key={cle}
            style={{
              gridRow: `${item.row} / span ${item.rowSpan ?? 1}`,
              gridColumn: `${item.column} / span ${item.columnSpan ?? 1}`,
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <Bloc bloc={item.content} scope={scope} budget={budget} />
          </div>
        ))}
      </div>
    ),
    tableRow: (ligne) => <div>[ligne {ligne.id} hors d'un tableau]</div>,
    tableRowGroup: (groupe) => <div>[groupe {groupe.id} hors d'un tableau]</div>,
  });
}

/**
 * Renders a table node with column widths, borders, and rows.
 */
function Tableau({
  tableau,
  scope,
  budget,
}: {
  readonly tableau: TableNode;
  readonly scope: EvaluationScope;
  readonly budget: EvaluationBudget;
}) {
  const parts = partsDeLargeur(tableau.columns);
  const ligne = (row: TableRowNode, portee: EvaluationScope, cle: string) => (
    <tr key={cle} style={{ backgroundColor: row.box?.background }}>
      {tableau.columns.map((column, index) => {
        // Cells map to columns by column identifier.
        const cellule = row.cells.find((candidate) => candidate.columnId === column.id);
        return (
          <td
            key={column.id}
            style={{
              width: parts[index],
              verticalAlign: 'top',
              // Line padding insets each cell content without moving column boundaries.
              ...styleCssDe(
                row.box?.padding === undefined ? undefined : { padding: row.box.padding },
                undefined,
              ),
              borderTop: filetCss(row.box?.border?.top),
              borderRight:
                index === tableau.columns.length - 1 ? filetCss(row.box?.border?.right) : undefined,
              borderBottom: filetCss(row.box?.border?.bottom),
              borderLeft: index === 0 ? filetCss(row.box?.border?.left) : undefined,
              textAlign: alignementCss(column.align),
            }}
          >
            {avecCle(cellule?.children ?? [], (enfant) => enfant.id).map(({ cle, item }) => (
              <Bloc key={cle} bloc={item} scope={portee} budget={budget} colonne={column.align} />
            ))}
          </td>
        );
      })}
    </tr>
  );

  return (
    <table
      style={{
        // Column widths resolve against table content width.
        boxSizing: 'border-box',
        width: '100%',
        borderCollapse: 'collapse',
        ...styleCssDe(tableau.box, undefined),
      }}
    >
      <thead>{tableau.header.map((row) => ligne(row, scope, `h-${row.id}`))}</thead>
      <tbody>
        {tableau.body.flatMap((entree) =>
          entree.type === 'tableRow'
            ? [ligne(entree, scope, `b-${entree.id}`)]
            : avecCle(evaluateSequence(entree.each, scope, { budget }), () => entree.id).flatMap(
                ({ cle, item }) =>
                  entree.rows.map((row) =>
                    ligne(row, childScope(scope, entree.as, item), `b-${cle}-${row.id}`),
                  ),
              ),
        )}
      </tbody>
      <tfoot>{tableau.footer.map((row) => ligne(row, scope, `f-${row.id}`))}</tfoot>
    </table>
  );
}

/** Data paths comparison across templates. */
const cheminsA = collectTemplateDataPaths(sampleTemplate);
const cheminsB = collectTemplateDataPaths(factureVariante);
const cheminsIdentiques =
  cheminsA.length === cheminsB.length && cheminsA.every((chemin, i) => chemin === cheminsB[i]);

/** Renders block content into text representation within the given scope. */
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
    // Recursive block rendering.
    condition: (condition) =>
      evaluatePredicate(condition.when, scope, { budget }) ? descendre(condition.children) : '',
    loop: (boucle) => `[loop ${boucle.as} non mis en page par cette démonstration]`,
    table: (imbrique) => `[tableau imbriqué ${imbrique.id} non mis en page ici]`,
    grid: (grille) => descendre(grille.items.map((item) => item.content)),
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

/** Table cell display descriptor with matched column and text. */
interface CaseAffichee {
  readonly column: TableColumn;
  readonly texte: string;
}

/** Table row display descriptor with matched cells per column. */
function casesDeLigne(
  row: TableRowNode,
  columns: readonly TableColumn[],
  scope: EvaluationScope,
  budget: EvaluationBudget,
): readonly CaseAffichee[] {
  // Cell names its column by columnId.
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

// Table body evaluates iteration scopes per row.
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
 * Rounding comparison models: A (raw), B (per line), A' (per line half-even)
 * ------------------------------------------------------------------------------------- */

/** Line amount formula (units * rate) evaluated for rounding comparison. */
const montantLigne: PrintableExpression = {
  kind: 'arithmetic',
  op: 'mul',
  left: { kind: 'path', path: 'l.quantite' },
  right: { kind: 'path', path: 'l.prixUnitaire' },
};

/** Round expression builder for comparison models. */
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

/** Creates a valid parsed template for a specific rounding mode. */
function modeleArrondi(
  cle: string,
  libelle: string,
  parLigne: PrintableExpression,
  mode: RoundMode,
): ModeleArrondi {
  // Total expression derived directly from line amount formula.
  const total = arrondir(sommeDes(parLigne), mode);
  return {
    cle,
    libelle,
    template: parseTemplate({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: `tpl_arrondi_${cle}`,
      name: `Arrondi ${cle}`,
      version: '1.0.0',
      // Minimal page configuration for rounding models.
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

/** Reads single binding expression path from a text node. */
function premiereLiaison(segments: readonly TextSegment[], quoi: string): PrintableExpression {
  const segment = segments[0];
  if (segment?.kind !== 'binding') {
    throw new Error(`« ${quoi} » devrait porter une liaison : contrat de core cassé.`);
  }
  return segment.value;
}

function nombre(value: unknown, quoi: string): number {
  if (typeof value !== 'number') {
    // Throw TypeError when evaluated value is not a number.
    throw new TypeError(`« ${quoi} » aurait dû être un nombre : contrat de core cassé.`);
  }
  return value;
}

interface LectureArrondi {
  readonly modele: ModeleArrondi;
  readonly montants: readonly number[];
  readonly total: number;
}

/** Validated rounding model readouts. */
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

/** Finds rounding readout by key or throws if missing. */
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

/** Lines where rounding produces a non-zero difference. */
const lignesDyadiques = lectureAPrime.montants.filter(
  (montant, index) => montant !== lectureA.montants[index],
);

/** French decimal formatting helper using resolved presentations from template. */
const ecritureFrancaise = resolvePresentation(sampleTemplate.presentations, 'fr-eur');
const fr = (value: number): string =>
  (ecritureFrancaise.ok ? formatDecimal(value, ecritureFrancaise.writing) : undefined) ?? '';

/** Lines of second dataset displayed in comparison table. */
const lignesArrondi = renderData.arrondi.lignes;

/** Separate budget for diagnostic examples that belong to no rendered document. */
const budgetDemonstrations: EvaluationBudget = createBudget();

/**
 * Converts a recognised refusal and rethrows programming faults unchanged.
 * The caller supplies location facts it already owns.
 */
function diagnostiquer(
  titre: string,
  agir: () => unknown,
  contexte?: DiagnosticContext,
): readonly OpenviewDiagnostic[] {
  try {
    agir();
  } catch (error) {
    const diagnostics = diagnosticsOf(error, contexte);
    if (diagnostics === undefined) {
      throw error;
    }
    return diagnostics;
  }
  throw new Error(`« ${titre} » aurait dû être refusée : contrat de core cassé.`);
}

/** Diagnostic card shown to a template author. */
interface CarteRecette {
  readonly titre: string;
  readonly diagnostic: OpenviewDiagnostic;
}

/** Selects a diagnostic by path because issue order is not part of the contract. */
function carte(
  titre: string,
  diagnostics: readonly OpenviewDiagnostic[],
  chemin: readonly (string | number)[],
): CarteRecette {
  const trouve = diagnostics.find(
    (diagnostic) =>
      diagnostic.path.length === chemin.length &&
      diagnostic.path.every((segment, index) => segment === chemin[index]),
  );
  if (trouve === undefined) {
    throw new Error(`« ${titre} » n'a rien dit sur [${chemin.join(', ')}] : contrat cassé.`);
  }
  return { titre, diagnostic: trouve };
}

const pageValide = {
  sheet: { width: 210, height: 297 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  header: [],
  footer: [],
};

/** Minimal stored template where each scenario breaks one contract. */
function modeleStocke(remplacements: Record<string, unknown>): unknown {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'facture-recette',
    name: 'Facture (recette diagnostics)',
    version: '1.0.0',
    page: pageValide,
    root: { type: 'container', id: 'racine', children: [] },
    ...remplacements,
  };
}

function conteneurImbrique(niveaux: number): Record<string, unknown> {
  let noeud: Record<string, unknown> = { type: 'container', id: 'feuille', children: [] };
  for (let niveau = 0; niveau < niveaux; niveau += 1) {
    noeud = { type: 'container', id: `c${niveau}`, children: [noeud] };
  }
  return noeud;
}

/** Contract refusals raised while saving a template, using version-relative fixtures. */
const refusDeContrat: readonly CarteRecette[] = [
  carte(
    'La marque d’insécabilité écrite avec false',
    diagnostiquer(
      'La marque d’insécabilité écrite avec false',
      () =>
        parseTemplate(
          modeleStocke({
            root: {
              type: 'container',
              id: 'racine',
              children: [
                { type: 'text', id: 'mentions-legales', keepTogether: false, content: [] },
              ],
            },
          }),
        ),
      { nodeId: 'mentions-legales' },
    ),
    ['root', 'children', 0, 'keepTogether'],
  ),
  carte(
    'Un segment de pagination qui ne nomme aucun champ',
    diagnostiquer(
      'Un segment de pagination qui ne nomme aucun champ',
      () =>
        parseTemplate(
          modeleStocke({
            root: {
              type: 'container',
              id: 'racine',
              children: [{ type: 'text', id: 'pied-de-page', content: [{ kind: 'pageField' }] }],
            },
          }),
        ),
      { nodeId: 'pied-de-page' },
    ),
    ['root', 'children', 0, 'content', 0, 'field'],
  ),
  carte(
    'Une largeur de feuille infinie',
    diagnostiquer('Une largeur de feuille infinie', () =>
      parseTemplate(
        modeleStocke({
          page: { ...pageValide, sheet: { width: Number.POSITIVE_INFINITY, height: 297 } },
        }),
      ),
    ),
    ['page', 'sheet', 'width'],
  ),
  carte(
    'Un modèle au-delà de la limite de profondeur',
    diagnostiquer('Un modèle au-delà de la limite de profondeur', () =>
      parseTemplate(modeleStocke({ root: conteneurImbrique(80) })),
    ),
    [],
  ),
  carte(
    'Un modèle estampillé par la version suivante',
    diagnostiquer('Un modèle estampillé par la version suivante', () =>
      parseTemplate(modeleStocke({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })),
    ),
    [],
  ),
];

/** Formula refusals raised during rendering; diagnostics expose value types, never values. */
const refusDeFormule: readonly CarteRecette[] = [
  carte(
    'Diviser par un nombre de lignes non gardé',
    diagnostiquer(
      'Diviser par un nombre de lignes non gardé',
      () =>
        evaluateExpression(
          { kind: 'arithmetic', op: 'div', left: totalHT, right: { kind: 'literal', value: 0 } },
          renderData,
          { budget: budgetDemonstrations },
        ),
      { nodeId: 'bloc-total', pathPrefix: ['root', 'children', 3] },
    ),
    ['root', 'children', 3, 'right'],
  ),
  carte(
    'Additionner un texte à un nombre',
    diagnostiquer(
      'Additionner un texte à un nombre',
      () =>
        evaluateExpression(
          {
            kind: 'arithmetic',
            op: 'add',
            left: { kind: 'path', path: 'commande.client' },
            right: { kind: 'literal', value: 1 },
          },
          renderData,
          { budget: budgetDemonstrations },
        ),
      { nodeId: 'bloc-total' },
    ),
    ['left'],
  ),
  carte(
    'Une date qui n’existe pas au calendrier',
    diagnostiquer(
      'Une date qui n’existe pas au calendrier',
      () =>
        evaluateExpression(
          { kind: 'endOfMonth', date: { kind: 'literal', value: '2026-02-30' } },
          renderData,
          { budget: budgetDemonstrations },
        ),
      { nodeId: 'bloc-echeance' },
    ),
    ['date'],
  ),
  carte(
    'Répéter un corps de tableau sur un nombre',
    diagnostiquer(
      'Répéter un corps de tableau sur un nombre',
      () =>
        evaluateSequence({ kind: 'path', path: 'commande.numero' }, renderData, {
          budget: budgetDemonstrations,
          caller: 'tableRowGroup',
        }),
      { nodeId: 'corps-des-lignes', pathPrefix: ['root', 'children', 2, 'body', 0, 'each'] },
    ),
    ['root', 'children', 2, 'body', 0, 'each'],
  ),
  carte(
    'Une condition qui produit du texte',
    diagnostiquer(
      'Une condition qui produit du texte',
      () =>
        evaluatePredicate({ kind: 'path', path: 'commande.client' }, renderData, {
          budget: budgetDemonstrations,
        }),
      { nodeId: 'bloc-remise', pathPrefix: ['root', 'children', 1, 'when'] },
    ),
    ['root', 'children', 1, 'when'],
  ),
];

/** Contract refusals followed by formula refusals. */
const cartesRecette: readonly CarteRecette[] = [...refusDeContrat, ...refusDeFormule];

/**
 * Demonstrates standalone member-schema validation for an integrating application.
 * The same diagnostic facade handles the resulting refusal.
 */
const arrondiValide = { kind: 'round', value: { kind: 'path', path: 'arrondi.total' } };
const horsFenetre = RoundExpressionSchema.safeParse({
  ...arrondiValide,
  decimals: MAX_ROUND_DECIMALS + 1,
  mode: 'halfExpand',
});
const messageHorsFenetre = horsFenetre.success
  ? '(acceptée — ce que le contrat interdit)'
  : (diagnosticsOf(horsFenetre.error)?.[0]?.message ?? '(refusée sans motif)');

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

/** Refusal diagnostic card container style. */
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

/** Highlight style for highlighting precision comparison differences. */
const totalCellStyle = { ...cellStyle, background: '#f0f6ff', fontWeight: 'bold' } as const;

/** Table footer cell style for the line items comparison table. */
const pieceDePiedStyle = { ...cellStyle, fontWeight: 'bold' } as const;

/** Table styling for fixed layout percentage columns. */
const tableauLignesStyle = { ...tableStyle, width: '100%', tableLayout: 'fixed' } as const;

/* ------------------------------------------------------------------------------------- *
 * Page layout and sheet scale preview
 * ------------------------------------------------------------------------------------- */

/** Validated template page setup. */
const pageModele: PageSetup = sampleTemplate.page;

/** Printable area computed via printableAreaOf helper. */
const aireImprimable = printableAreaOf(pageModele);

/** Scale factor for sheet drawing preview. */
const ECHELLE = 320 / pageModele.sheet.width;

/** Human-readable labels for page band occurrences. */
const LIBELLE_OCCURRENCE: Readonly<Record<PageBandOccurrence, string>> = {
  every: 'sur toutes les pages',
  firstOnly: 'première page seulement',
  exceptFirst: 'sauf la première',
  exceptLast: 'sauf la dernière',
  lastOnly: 'dernière page seulement',
};

/** Band preview item properties. */
interface BandeAffichee {
  readonly cle: string;
  readonly occurrence: string;
  readonly texte: string;
}

function bandesAffichees(cote: 'header' | 'footer'): readonly BandeAffichee[] {
  return pageModele[cote].map((bande: PageBand, index: number) => ({
    cle: `${cote}-${index}`,
    occurrence: LIBELLE_OCCURRENCE[bande.on],
    texte: texteDeBloc(bande.content, renderData, budgetFacture),
  }));
}

const bandesHaut = bandesAffichees('header');
const bandesBas = bandesAffichees('footer');

const feuilleStyle = {
  position: 'relative',
  width: `${pageModele.sheet.width * ECHELLE}px`,
  height: `${pageModele.sheet.height * ECHELLE}px`,
  border: '1px solid #999',
  background: '#fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
} as const;

/** Layer preview item properties. */
interface CalqueDessine {
  readonly cle: string;
  readonly libelle: string;
  readonly style: CSSProperties;
}

/** Preview layers rendered in stored plane order. */
function calquesDe(plan: PageLayerPlane): readonly CalqueDessine[] {
  return (pageModele.layers ?? [])
    .filter((calque) => calque.plane === plan)
    .map((calque, index) => ({
      cle: `${plan}-${index}`,
      libelle: `${calque.content.id}${calque.opacity === undefined ? '' : ` (opacité ${calque.opacity})`}`,
      style: {
        position: 'absolute',
        inset: 0,
        background: calque.content.box?.background,
        opacity: calque.opacity,
        pointerEvents: 'none',
      },
    }));
}

/** Printable area preview box. */
const zoneImprimableStyle = {
  position: 'absolute',
  left: `${pageModele.margins.left * ECHELLE}px`,
  top: `${pageModele.margins.top * ECHELLE}px`,
  width: `${aireImprimable.width * ECHELLE}px`,
  height: `${aireImprimable.height * ECHELLE}px`,
  border: '1px dashed #6a9fd4',
  background: '#f6faff',
} as const;

const bandeStyle = {
  background: '#fff8e6',
  border: '1px solid #e8d5a0',
  borderRadius: '4px',
  padding: '0.4rem 0.6rem',
  marginBottom: '0.4rem',
  fontSize: '0.85rem',
} as const;

/* ------------------------------------------------------------------------------------------- *
 * Presentations and localized values demonstration
 * ------------------------------------------------------------------------------------------- */

/** Independent configuration switches for content language vs presentation formatting. */
const LANGUES = ['fr', 'en'] as const;
const ECRITURES = ['fr-eur', 'en-usd'] as const;

/** Manual binding wiring for presentation values demonstration. */
interface SiteEcrit {
  readonly libelle: string;
  readonly fonction: string;
  readonly rendu: (writing: Presentation) => string | undefined;
}

const sitesEcrits: readonly SiteEcrit[] = [
  {
    libelle: 'commande.numero',
    fonction: 'aucune — brut',
    // Order number is rendered as plain text rather than formatted currency.
    rendu: () => String(renderData.commande.numero),
  },
  {
    libelle: 'total HT (calculé)',
    fonction: 'formatMoney',
    rendu: (writing) => {
      const valeur = evaluateExpression(totalHT, renderData, { budget: createBudget() });
      return typeof valeur === 'number' ? formatMoney(valeur, writing) : undefined;
    },
  },
  {
    libelle: 'remise (calculée)',
    fonction: 'formatMoney',
    rendu: (writing) => {
      const valeur = evaluateExpression(remise, renderData, { budget: createBudget() });
      return typeof valeur === 'number' ? formatMoney(valeur, writing) : undefined;
    },
  },
  {
    libelle: 'quantité de la 3ᵉ ligne',
    fonction: 'formatDecimal',
    rendu: (writing) => formatDecimal(renderData.commande.lignes[2]?.prixUnitaire ?? 0, writing),
  },
  {
    libelle: 'commande.dateEmission',
    fonction: 'formatDate',
    rendu: (writing) => formatDate(renderData.commande.dateEmission, writing),
  },
];

/** Title expression evaluated against both language settings. */
const titreDansLaLangue = (langue: string): string => {
  const valeur = evaluateExpression(
    titre,
    { ...renderData, rendu: { langue } },
    { budget: createBudget() },
  );
  return typeof valeur === 'string' ? valeur : '';
};

/** Pre-resolved presentation combinations. */
const combinaisons = LANGUES.flatMap((langue) =>
  ECRITURES.map((nom) => ({
    langue,
    nom,
    croisee: (langue === 'fr') !== (nom === 'fr-eur'),
    titre: titreDansLaLangue(langue),
    resolution: resolvePresentation(sampleTemplate.presentations, nom),
  })),
);

/** Diagnostic preview for undeclared presentation identifier refusal. */
const refusInconnu = resolvePresentation(sampleTemplate.presentations, 'de-chf');

/** Diagnostic preview for unsupported locale refusal. */
const refusNonHonore = resolvePresentation(
  {
    zz: {
      locale: 'zz',
      currency: 'EUR',
      minFractionDigits: 2,
      maxFractionDigits: 2,
      dateStyle: 'long',
    },
  },
  'zz',
);

export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>🚀 Openview Playground</h1>
      <p>
        Template <strong>{sampleTemplate.name}</strong> validé au schéma v
        {sampleTemplate.schemaVersion}.
      </p>

      <RenderDownloadPanel />

      <h2>Parcours de l'AST (Visiteur, profondeur d'abord)</h2>
      <ol>
        {avecCle(nodeIds, (label) => label).map(({ cle, item }) => (
          <li key={cle}>{item}</li>
        ))}
      </ol>

      <h2>Données requises (analyse statique des expressions)</h2>
      <p>
        Aucun alias n'y figure : <code>line</code> est déclaré par le template, qu'il soit lié par
        le groupe de lignes du tableau, par l'agrégat ou par le filtre — <strong>quatre</strong>{' '}
        sites d'alias depuis le lot C3, et le quatrième ne fuit pas plus que les trois autres. Les
        autres chemins sont les noms choisis par l'application intégratrice — c'est la liste que le
        moteur <em>rend</em> à l'appelant, pas une liste qu'il lui <em>impose</em>. Remarquez que{' '}
        <code>traitement.effectueLe</code> y figure comme n'importe quelle autre clé : « aujourd'hui
        » est une donnée, pas une horloge.
      </p>
      <p>
        Depuis le lot C4, cette liste vient de <code>collectTemplateDataPaths</code> et non de{' '}
        <code>collectDataPaths(root)</code> : les bandes de page vivent <em>hors</em> de{' '}
        <code>root</code>, donc la seconde forme omettrait <code>societe.mentionsLegales</code> — lu
        par le pied de dernière page et par lui seul. Le symptôme ne serait pas une erreur mais un{' '}
        <strong>blanc</strong> : on aurait dit à l'appelant de fournir les{' '}
        <strong>{dataPaths.length - 1}</strong> premières clés de cette liste, jamais la{' '}
        <strong>{dataPaths.length}</strong>
        <sup>e</sup>, et le pied s'imprimerait vide. Les deux nombres sont <em>calculés</em> sur la
        liste affichée juste dessous : une prose qui les écrit en dur finit par la contredire.
      </p>
      <ul>
        {dataPaths.map((dataPath) => (
          <li key={dataPath}>
            <code>{dataPath}</code>
          </li>
        ))}
      </ul>

      <h2>Le catalogue de l'intégrateur (C10)</h2>
      <p>
        La section précédente dit ce que le modèle <em>lit</em>. Celle-ci dit ce que l'application
        hôte <em>déclare lisible</em>, avec ses libellés métier —{' '}
        <strong>{champsDeclares.length}</strong> champs, dans l'ordre que l'hôte a choisi, rendu par{' '}
        <code>listDataCatalogueEntries</code>. Le catalogue vit dans{' '}
        <code>apps/playground/src/examples/data-catalogue.ts</code> : aucune de ces clés et aucun de
        ces libellés n'existe dans <code>packages/</code>. Sa validation à la frontière est jouée
        une fois au chargement —{' '}
        <strong>
          {catalogueValide ? 'catalogue accepté' : 'CATALOGUE REFUSÉ, ce qui est un défaut'}
        </strong>
        .
      </p>
      <p>
        <strong>Cette carte n'est pas le sélecteur de champs.</strong> Elle montre le critère de
        recette du lot ; l'interface d'insertion appartient au Designer (D1/D4), qui n'existe pas
        encore. Et rien ici ne reçoit de jeu de données :{' '}
        <code>checkTemplateDataCompatibility</code> prend un modèle et une déclaration, point.
      </p>
      <ul>
        {champsDeclares.map((entree) => (
          <li key={entree.keyPath.join('.')}>
            {entree.labelPath.join(' › ')} — <code>{entree.keyPath.join('.')}</code>{' '}
            <em>({entree.type.kind})</em>
          </li>
        ))}
      </ul>
      <p>
        Avec le catalogue complet, la facture de référence est{' '}
        <strong>
          {compatibiliteComplete.compatible ? 'compatible' : 'INCOMPATIBLE, ce qui est un défaut'}
        </strong>{' '}
        : <strong>{compatibiliteComplete.reads.length}</strong> lectures localisées,{' '}
        <strong>{compatibiliteComplete.diagnostics.length}</strong> refus.
      </p>
      <p>
        On retire alors <code>prixUnitaire</code> des lignes de commande, et{' '}
        <strong>rien d'autre</strong>. Le modèle ne bouge pas ; ce sont les{' '}
        <strong>{compatibiliteSansPrix.diagnostics.length}</strong> occurrences qui le lisent qui
        deviennent incompatibles, chacune à sa position. Le chemin fautif reste dans{' '}
        <code>dataPath</code> et n'entre jamais dans la phrase : c'est un nom que l'hôte a choisi,
        et c'est l'hôte qui l'échappe.
      </p>
      {compatibiliteSansPrix.diagnostics.map((refus) => (
        <div key={`${refus.code}-${refus.path.join('.')}-${refus.dataPath}`} style={refusalStyle}>
          <code>{refus.code}</code> · <code>{refus.dataPath}</code> ·{' '}
          <code>{refus.path.join(' › ')}</code>
          <br />
          {refus.message}
        </div>
      ))}
      <p>
        Les lectures suspendues valent d'être vues : si l'on remplaçait la liste par un objet, la
        source recevrait <strong>un</strong> refus et ses descendants le statut <code>blocked</code>{' '}
        — pas dix symptômes pour une seule cause.
      </p>

      <h2>La page : une feuille, des marges, et ce qui se répète</h2>
      <p>
        Le rectangle ci-dessous est <strong>dessiné à l'échelle</strong> depuis{' '}
        <code>page.sheet</code> et <code>page.margins</code> du modèle validé, et la zone en
        pointillés est obtenue de <code>printableAreaOf</code> — <em>jamais recalculée ici</em>.
        Cette page est donc le <strong>troisième consommateur</strong> de cette fonction, après le
        moteur et le viewer, et c'est tout son argument rendu visible :{' '}
        <code>largeur − gauche − droite</code> n'est pas <em>une</em> opération.{' '}
        <code>215,9 − (25,4 + 25,4)</code> vaut <code>165.10000000000002</code> quand{' '}
        <code>(215,9 − 25,4) − 25,4</code> vaut <code>165.1</code> : deux implémentations qui
        écrivent la soustraction chacune de leur côté n'écrivent pas la même formule.
      </p>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={feuilleStyle}>
          {/* Background layers rendered under printable area */}
          {calquesDe('background').map((calque) => (
            <div key={calque.cle} style={calque.style} title={calque.libelle} />
          ))}
          <div style={zoneImprimableStyle} />
          {calquesDe('foreground').map((calque) => (
            <div key={calque.cle} style={calque.style} title={calque.libelle} />
          ))}
        </div>
        <div style={{ flex: '1 1 20rem' }}>
          <p style={{ marginTop: 0 }}>
            Feuille <code>{pageModele.sheet.width}</code> × <code>{pageModele.sheet.height}</code>{' '}
            mm — marges <code>{pageModele.margins.top}</code> /{' '}
            <code>{pageModele.margins.right}</code> / <code>{pageModele.margins.bottom}</code> /{' '}
            <code>{pageModele.margins.left}</code> mm — zone imprimable{' '}
            <code>{aireImprimable.width}</code> × <code>{aireImprimable.height}</code> mm.
          </p>
          <p>
            <strong>En haut</strong>
          </p>
          {bandesHaut.map((bande) => (
            <div key={bande.cle} style={bandeStyle}>
              <em>{bande.occurrence}</em> — {bande.texte}
            </div>
          ))}
          <p>
            <strong>En bas</strong>
          </p>
          {bandesBas.map((bande) => (
            <div key={bande.cle} style={bandeStyle}>
              <em>{bande.occurrence}</em> — {bande.texte}
            </div>
          ))}
          <p>
            <strong>Calques</strong> — répétés sur toutes les pages, hors flux (lot C11)
          </p>
          {avecCle(pageModele.layers ?? [], (calque) => `calque-${calque.content.id}`).map(
            ({ cle, item: calque }, index) => (
              <div key={cle} style={bandeStyle}>
                <em>
                  {calque.plane === 'background' ? 'arrière-plan' : 'avant-plan'} #{index + 1}
                </em>{' '}
                — <code>{calque.content.id}</code>
                {calque.opacity === undefined ? '' : ` — opacité ${calque.opacity}`}
              </div>
            ),
          )}
        </div>
      </div>
      <p>
        Le pied courant est <code>exceptLast</code> et non <code>every</code>, et ce n'est pas un
        choix de style : ce modèle porte <em>aussi</em> un pied de dernière page, et{' '}
        <code>every</code> recoupant tout, la paire <code>every</code> + <code>lastOnly</code> est{' '}
        <strong>refusée par le schéma</strong> — elle poserait deux bandes sur la dernière feuille.
        Sur les vingt-cinq couples d'occurrences, <strong>deux seulement</strong> sont compatibles :{' '}
        <code>firstOnly</code> + <code>exceptFirst</code> et <code>exceptLast</code> +{' '}
        <code>lastOnly</code>. Comme elles ne partagent aucun membre, un côté ne peut jamais porter
        plus de deux bandes.
      </p>
      <p>
        Le <code>1 / 1</code> des pieds est un <strong>espace réservé</strong>.{' '}
        <em>Cette page n'a pas de paginateur</em> : elle ne coupe rien, donc elle ne connaît ni le
        rang d'une page ni leur nombre. Ce que le modèle déclare est un <strong>marqueur</strong> —{' '}
        <code>pageField</code>, un emplacement — et la valeur viendra du moteur (lot E2), la langue
        autour de C6. Rien n'est calculé ici, et <code>collectTemplateDataPaths</code> le confirme :
        les quatre marqueurs de ce modèle ne réclament <em>aucune</em> clé à l'application
        intégratrice.
      </p>
      <p>
        Et ce que cette démonstration <strong>ne peut pas</strong> montrer, dit franchement : la
        répétition (il n'y a qu'une page), la dernière page (il n'y en a pas d'autre), le
        débordement, le report et la moindre coupure. Après C4,{' '}
        <strong>aucun document ne sort sur deux pages</strong> : le lot livre les faits qu'un
        paginateur devra respecter, et le paginateur est le lot E2. Un visiteur qui voudrait voir
        une bande se répéter devra l'attendre.
      </p>

      <h2>L'apparence : deux factures très différentes, un seul jeu de données (lot C5)</h2>
      <p>
        Les deux documents ci-dessous sortent de <strong>la même fonction</strong>,{' '}
        <code>factureAvecApparence</code>, appelée avec deux <code>Apparence</code> différentes.
        Même structure, <strong>mêmes identifiants</strong>, mêmes liaisons, même{' '}
        <code>renderData</code> — et la seule chose qui varie est ce que le lot C5 a ajouté au
        contrat : <code>box</code> sur cinq types de nœud, <code>typography</code> sur le nœud texte
        et sur les trois kinds de segment, <code>align</code> sur le nœud texte.
      </p>
      <p>
        Une <strong>fonction</strong> et non deux littéraux écrits à la main, et ce n'est pas une
        commodité : deux littéraux satisferaient le critère <em>à l'œil</em> en ne prouvant rien —
        rien ne garantirait que la structure et les liaisons soient identiques. Paramétrer le modèle
        rend l'identité structurelle <strong>mécanique</strong>, et fait de l'égalité des deux
        listes de <code>collectTemplateDataPaths</code> un <em>résultat</em> plutôt qu'une
        coïncidence.
      </p>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {[
          { apparence: APPARENCE_A, modele: sampleTemplate },
          { apparence: APPARENCE_B, modele: factureVariante },
        ].map(({ apparence, modele }) => (
          <div key={apparence.nom} style={{ flex: '1 1 340px', minWidth: '320px' }}>
            <p>
              <strong>{apparence.nom}</strong>
            </p>
            <div
              style={{
                border: '1px solid #d0d4da',
                background: '#fff',
                padding: '8px',
                overflowX: 'auto',
              }}
            >
              <Bloc bloc={modele.root} scope={renderData} budget={createBudget()} />
            </div>
          </div>
        ))}
      </div>
      <p>
        Ce que ces deux vues <strong>dérivent</strong> du document, et rien d'autre : le fond, les
        quatre arêtes et l'inset de chaque boîte ; la famille, la taille, la graisse, l'italique et
        la couleur de chaque run ; l'alignement de chaque bloc de texte. Une propriété dont le champ
        est <strong>absent</strong> reste absente du CSS — <em>aucun défaut n'est inventé ici</em>,
        et c'est très exactement la dette que l'ADR 0007 nomme : les cinq valeurs typographiques
        d'un run qui n'en déclare aucune appartiennent au moteur, pas à cette page.
      </p>
      <p>
        La taille de caractère est la <strong>seule longueur en points</strong> du contrat ; tout le
        reste est en millimètres. Elle passe donc par <code>mmFromPt</code>{' '}
        <strong>du contrat</strong>, jamais par une division réécrite ici, avant d'être multipliée
        par l'échelle déclarée de <code>{PX_PAR_MM}</code> px/mm. Le motif est mesuré :{' '}
        <code>(pt * 25.4) / 72</code> et <code>pt * (25.4 / 72)</code> rendent{' '}
        <strong>deux doubles différents pour 31,5 % des tailles entières</strong>, et la décision
        produit 7 promet un aperçu identique au PDF. Cette page est le premier consommateur nommé de
        cette fonction.
      </p>
      <p>
        Et l'alignement passe par <code>resolveTextAlign</code>, pour la même raison de forme : la
        colonne fournit un <strong>défaut</strong>, le bloc tranche. Ce ne sont pas deux
        déclarations d'un même fait — une cellule qui contient une image a le premier et pas le
        second, et une cellule qui contient deux paragraphes a un défaut et <strong>deux</strong>{' '}
        alignements, qui peuvent différer. <code>justify</code> n'existe que sur le tuple du texte :
        une <strong>colonne ne justifie rien</strong>, et l'apparence B le montre sur ses mentions.
      </p>
      <p>
        Les deux clés de données réclamées à l'application intégratrice, côte à côte :{' '}
        <code>{cheminsA.join(', ')}</code> contre <code>{cheminsB.join(', ')}</code> —{' '}
        <strong>{cheminsIdentiques ? 'identiques' : 'DIFFÉRENTES, ce qui est un défaut'}</strong>.
        C'est la moitié <strong>mécaniquement vérifiable</strong> du critère de recette : une
        apparence ne change pas ce qu'un document lit. L'autre moitié — « visuellement très
        différentes » — est une <strong>revue humaine</strong>, et aucune assertion ne peut en tenir
        lieu ; cette page se contente de la rendre possible.
      </p>
      <p>
        Ce que cette démonstration <strong>ne peut pas</strong> montrer, dit franchement : le
        comportement d'une boîte au point de coupe (il n'y a qu'une page), la rencontre de deux
        filets adjacents, la résolution d'un nom de police absent, et la place d'une image sans
        dimension déclarée. Ce sont quatre des <strong>huit attentes envers le moteur</strong> que
        l'ADR 0007 nomme, avec leur propriétaire — elles ne seront vérifiables qu'au lot E2.
      </p>

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
        {/* Positional row keys are used for immutable sequence presentation rows. */}
        <thead>
          {lignesEntete.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Positional index key used by design in playground preview list
            <tr key={rowIndex /* NOSONAR: positional key */}>
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
            // biome-ignore lint/suspicious/noArrayIndexKey: Positional index key used by design in playground preview list
            <tr key={rowIndex /* NOSONAR: positional key */}>
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
            // biome-ignore lint/suspicious/noArrayIndexKey: Positional index key used by design in playground preview list
            <tr key={rowIndex /* NOSONAR: positional key */}>
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

      <h2>Un refus compréhensible — dix cas de recette</h2>
      <p>
        Chacun des dix cas ci-dessous est fautif <em>volontairement</em>. Ce que la page affiche
        n'est plus un rapport qu'elle rebâtit : c'est le <strong>diagnostic</strong> que{' '}
        <code>diagnosticsOf</code> rend, tel quel. La page ne lit plus ni{' '}
        <code>ZodError.issues</code>, ni <code>ExpressionEvaluationError.details</code> — elle passe
        l'erreur à la façade et <strong>relance</strong> ce que la façade ne reconnaît pas, parce
        qu'une faute de programmation ne doit jamais devenir une phrase qu'un auteur essaierait de
        corriger.
      </p>
      <p>
        <code>source</code> et <code>code</code> choisissent la branche de traduction, complétée par
        les détails structurés — jamais par l'analyse de la phrase. <code>nodeId</code> et{' '}
        <code>path</code> sont des champs <strong>séparés</strong> de <code>message</code> et ne
        sont jamais interpolés dedans — c'est ce qui permet à une interface de les échapper. Et
        aucune valeur de rendu n'apparaît nulle part : <code>actualType</code> est le <em>tag</em>{' '}
        d'une valeur, pas la valeur.
      </p>
      <p>
        Les cinq premiers refus se produisent quand le modèle est <strong>enregistré</strong>, les
        cinq suivants au <strong>rendu</strong>. La distinction n'est pas cosmétique, et les deux
        couleurs de carte la portent.
      </p>
      {cartesRecette.map(({ titre, diagnostic }, index) => (
        <div key={titre} style={index < refusDeContrat.length ? parseRefusalStyle : refusalStyle}>
          <strong>
            {index + 1}. {titre}
          </strong>
          <ul>
            <li>
              <code>source</code> : <code>{diagnostic.source}</code> — <code>code</code> :{' '}
              <code>{diagnostic.code}</code>
            </li>
            <li>
              <code>path</code> :{' '}
              <code>
                {diagnostic.path.length === 0 ? '(racine du modèle)' : diagnostic.path.join(' → ')}
              </code>
            </li>
            <li>
              <code>nodeId</code> :{' '}
              <code>{diagnostic.nodeId ?? '(non fourni par le consommateur)'}</code>
            </li>
            {'site' in diagnostic ? (
              <li>
                <code>site</code> : <code>{diagnostic.site}</code>
              </li>
            ) : undefined}
            {'actualType' in diagnostic ? (
              <li>
                <code>actualType</code> : <code>{diagnostic.actualType}</code>
              </li>
            ) : undefined}
            {'expected' in diagnostic ? (
              <li>
                <code>expected</code> : <code>{diagnostic.expected}</code>
              </li>
            ) : undefined}
            {'acceptedValues' in diagnostic ? (
              <li>
                <code>acceptedValues</code> : <code>{diagnostic.acceptedValues.join(', ')}</code>
              </li>
            ) : undefined}
            {'limit' in diagnostic && diagnostic.limit !== undefined ? (
              <li>
                <code>limit</code> : <code>{diagnostic.limit}</code>
              </li>
            ) : undefined}
            {'fromVersion' in diagnostic && diagnostic.fromVersion !== undefined ? (
              <li>
                <code>fromVersion</code> : <code>{diagnostic.fromVersion}</code>
              </li>
            ) : undefined}
          </ul>
          <p>{diagnostic.message}</p>
        </div>
      ))}
      <p>
        Et le même contrôle vu de l'application intégratrice, qui construit un nœud par programme et
        le valide avant de le stocker — sans passer par le template entier :{' '}
        <code>RoundExpressionSchema.safeParse</code> d'une position à{' '}
        <code>{MAX_ROUND_DECIMALS + 1}</code> rend « {messageHorsFenetre} », par la même façade.
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

      <h2>Langue, devise et formats — lot C6</h2>
      <p>
        Pour la première fois du projet, un critère est visible <strong>sans moteur</strong> : C1 à
        C5 ne pouvaient montrer qu'une <em>description</em> — un arbre, des chemins, des refus — et
        laissaient le rendu à une fonction React écrite ici. <code>formatMoney</code>,{' '}
        <code>formatDecimal</code> et <code>formatDate</code> sont, elles,{' '}
        <strong>du contrat</strong>, et ce que vous lisez ci-dessous est une vraie chaîne qu'elles
        ont produite.
      </p>
      <p>
        La mesure la plus courte de ce que le lot apporte tient en une ligne supprimée. Cette page
        portait <code>const fr = (v) =&gt; String(v).replace('.', ',')</code> — une fonction de
        trois lignes qui prétendait connaître le français, appelée trois fois. Elle est remplacée
        par une écriture que <strong>l'auteur du modèle déclare</strong> et que le contrat honore.
      </p>

      <h3>La table d'écritures est dans le DOCUMENT, pas dans ce code</h3>
      <p>
        Un seul <code>Template</code>, estampillé v{sampleTemplate.schemaVersion}, portant deux
        écritures. Les noms de clés appartiennent à l'auteur : Openview n'en réserve aucun — pas de{' '}
        <code>default</code>, pas de <code>fr</code>, aucune convention liant une clé à une langue.
      </p>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate.presentations, null, 2)}</pre>

      <h3>Deux commutateurs, et ils sont indépendants par conception</h3>
      <table style={{ borderCollapse: 'collapse', marginBottom: '12px' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Commutateur</th>
            <th style={cellStyle}>Ce qu'il est</th>
            <th style={cellStyle}>Par quel mécanisme</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cellStyle}>① la langue des MOTS</td>
            <td style={cellStyle}>
              une <strong>donnée</strong>, <code>rendu.langue</code>
            </td>
            <td style={cellStyle}>lue par le `if` du titre — lot C1, C6 n'y ajoute rien</td>
          </tr>
          <tr>
            <td style={cellStyle}>② l'écriture des VALEURS</td>
            <td style={cellStyle}>
              un <strong>argument</strong>, le nom passé au résolveur
            </td>
            <td style={cellStyle}>ce lot — jamais une clé réservée, jamais la machine</td>
          </tr>
        </tbody>
      </table>
      <p>
        Les <strong>quatre</strong> combinaisons sont donc atteignables, et les deux{' '}
        <strong>croisées</strong> sont affichées comme telles. Elles ne sont ni un bug de cette page
        ni un bug du contrat : les coudre <em>interdirait un document correct</em> — anglais et
        euros pour un client britannique d'une société française est une facture légitime. Les tenir
        cohérents appartient à l'intégrateur, et aucune porte d'Openview ne le voit : le parse
        accepte les deux déclarations séparément, le rendu réussit les deux.
      </p>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {combinaisons.map((combinaison) => {
          // Resolution bound to a local constant to preserve narrowing in closures.
          const { resolution } = combinaison;
          return (
            <div
              key={`${combinaison.langue}-${combinaison.nom}`}
              style={{
                flex: '1 1 300px',
                minWidth: '290px',
                border: combinaison.croisee ? '2px dashed #b8860b' : '1px solid #d0d4da',
                background: '#fff',
                padding: '10px',
              }}
            >
              <p style={{ margin: '0 0 6px' }}>
                <strong>
                  ① {combinaison.langue} + ② {combinaison.nom}
                </strong>
                {combinaison.croisee ? (
                  <em style={{ color: '#8a6300' }}> — combinaison croisée</em>
                ) : null}
              </p>
              <p style={{ margin: '0 0 8px', fontStyle: 'italic' }}>{combinaison.titre}</p>
              {resolution.ok ? (
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={cellStyle}>Site</th>
                      <th style={cellStyle}>Fonction</th>
                      <th style={cellStyle}>Rendu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sitesEcrits.map((site) => (
                      <tr key={site.libelle}>
                        <td style={cellStyle}>{site.libelle}</td>
                        <td style={cellStyle}>
                          <code>{site.fonction}</code>
                        </td>
                        <td style={{ ...cellStyle, fontWeight: 'bold' }}>
                          {/* Render formatted presentation value */}
                          {site.rendu(resolution.writing) ?? '(absent)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>{diagnosticOfPresentationRefusal(resolution.refusal).message}</p>
              )}
            </div>
          );
        })}
      </div>
      <p>
        Ce qui ne change <strong>jamais</strong> d'une case à l'autre, et qu'il faut constater : le{' '}
        <strong>modèle</strong>, le <strong>jeu de données</strong> (à la seule clé{' '}
        <code>rendu.langue</code> près), le <strong>code de rendu</strong> et le{' '}
        <strong>navigateur</strong>. Chaque case résout son écriture <strong>une fois</strong>, et
        jamais une fois par valeur : le résolveur construit deux formateurs de contrôle pour
        vérifier que ce moteur honore le tag.
      </p>

      <h3>⚠️ Le câblage est fait ICI, à la main — et le contrat ne sait pas le faire</h3>
      <p>
        La colonne du milieu ci-dessus est <strong>une décision de cette page</strong>, valeur par
        valeur. Rien dans le document stocké ne distingue <code>commande.numero</code> d'un total,
        et <strong>il ne le doit pas</strong> : reconnaître un total exigerait de réserver un nom de
        champ, ce que la règle de périmètre refuse. La première ligne du tableau le montre —{' '}
        <code>{String(renderData.commande.numero)}</code> reste <strong>brut</strong>, parce qu'une
        écriture appliquée à tous les nombres l'imprimerait <code>20 260 014</code>, qui désigne une
        autre commande.
      </p>
      <p>
        <strong>
          C6 remet au moteur tout ce qu'il faut pour écrire une valeur, et ne lui dit pas quelles
          valeurs écrire.
        </strong>{' '}
        C'est le lot E4 qui le tranchera, devant une vraie facture. Une vitrine qui le tairait
        ferait croire la question résolue.
      </p>

      <h3>Les données requises sont les mêmes — l'écriture n'en ajoute aucune</h3>
      <p>
        Une écriture ne porte <strong>aucune</strong> <code>Expression</code> et n'est traversée par
        aucun parcours de l'AST, donc déclarer une table de deux écritures ne change pas d'une clé
        ce que le modèle <em>lit</em>. C'est la traduction vérifiable de « sans duplication du
        modèle », et c'est la partie du critère qu'un lecteur ne peut pas vérifier à l'œil.
      </p>
      <p>
        <code>collectTemplateDataPaths</code> rend <strong>{cheminsA.length}</strong> chemins sur
        l'apparence A et <strong>{cheminsB.length}</strong> sur l'apparence B —{' '}
        <strong>
          {cheminsA.join('|') === cheminsB.join('|')
            ? 'même liste, même ordre'
            : '⛔ LES DEUX LISTES DIVERGENT'}
        </strong>
        .
      </p>
      <pre style={codeStyle}>{cheminsA.join('\n')}</pre>

      <h3>Les refus portent leur cause, et les deux portes ne sont pas au même endroit</h3>
      <p>
        Une locale est jugée <strong>deux fois</strong>. Le <strong>parse</strong> ne juge que la
        grammaire, parce que son verdict doit être le même sur tout build d'ICU — c'est la propriété
        qu'un champ <em>stocké</em> doit avoir. Le <strong>rendu</strong> demande si <em>ce</em>{' '}
        moteur honore le tag, et ce verdict-là dépend des données CLDR de la machine qui lit.
      </p>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Ce qu'on demande</th>
            <th style={cellStyle}>Refus rendu</th>
            <th style={cellStyle}>Diagnostic</th>
            <th style={cellStyle}>Qui est en faute</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cellStyle}>un nom que personne n'a déclaré</td>
            <td style={cellStyle}>
              <code>{refusInconnu.ok ? 'ok' : refusInconnu.refusal}</code>
            </td>
            <td style={cellStyle}>
              {refusInconnu.ok
                ? '(résolue)'
                : diagnosticOfPresentationRefusal(refusInconnu.refusal).message}
            </td>
            <td style={cellStyle}>l'APPEL est faux</td>
          </tr>
          <tr>
            <td style={cellStyle}>
              <code>locale: 'zz'</code>, bien formée, inconnue de ce moteur
            </td>
            <td style={cellStyle}>
              <code>{refusNonHonore.ok ? 'ok' : refusNonHonore.refusal}</code>
            </td>
            <td style={cellStyle}>
              {refusNonHonore.ok
                ? '(résolue)'
                : diagnosticOfPresentationRefusal(refusNonHonore.refusal).message}
            </td>
            <td style={cellStyle}>
              ni l'un ni l'autre n'est faux — un Designer ne doit PAS en accuser l'auteur
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Sans cette seconde porte, <code>zz</code> retomberait <strong>en silence</strong> sur la
        langue de la machine de rendu : pas d'erreur, pas d'avertissement, un document plausible,
        imprimable, et faux d'une façon que rien en aval ne peut détecter. C'est le défaut que tout
        ce lot existe pour supprimer.
      </p>

      <h3>Ce que cette page ne peut pas montrer, et ce n'est pas un manque du lot</h3>
      <ul>
        <li>
          <strong>Aucun PDF.</strong> Le critère de <code>core</code> dit <em>décrit</em>, pas{' '}
          <em>rendu</em> — le moteur est le lot E4.
        </li>
        <li>
          <strong>Aucune preuve que le moteur fera pareil.</strong> Une vitrine qui honore les
          attentes ne prouve rien sur un moteur qui ne les honorerait pas.
        </li>
        <li>
          <strong>Aucune garantie de version d'ICU.</strong> L'ICU du navigateur n'est pas celui de
          Node, et la promesse d'aperçu identique au PDF en dépend.
        </li>
        <li>
          <strong>Aucun choix automatique des sites.</strong> C'est la limite structurante du lot,
          et cette page la met en scène plutôt que de la masquer.
        </li>
        <li>
          <strong>Aucun système de chiffres non latin.</strong> <code>numberingSystem: 'latn'</code>{' '}
          est épinglé en dur : une facture en <code>ar-EG</code> sort en chiffres latins. C'est
          défendable, ce n'est pas neutre, et c'est une décision produit.
        </li>
        <li>
          <strong>Aucune facture « correcte »</strong> au sens fort : la conformité appartient à
          l'intégrateur, et deux factures ne diffèrent pas seulement par les mots et les formats.
        </li>
      </ul>

      <h2>Document validé</h2>
      <pre style={codeStyle}>{JSON.stringify(sampleTemplate, null, 2)}</pre>
    </div>
  );
}

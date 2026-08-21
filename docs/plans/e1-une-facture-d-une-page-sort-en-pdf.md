# Plan d'implémentation — `@openview/engine` lot E1 : une facture d'une page sort en PDF

> **Statut :** prêt à exécuter, non livré.
>
> **Baseline relevée le 2026-08-21 :** la vague 1 de `@openview/core` est close au
> `schemaVersion` **8** ; `@openview/engine` ne contient qu'une constante de version et son test ;
> aucun adaptateur Chromium n'existe ; le playground démontre le contrat dans React mais ne produit
> aucun document. La dernière décision d'architecture est l'ADR 0011 : l'ADR d'exécution d'E1
> prendra donc le prochain numéro libre, **0012 si la baseline n'a pas changé**.
>
> **Date :** 2026-08-21 · **Brique principale :** `@openview/engine` · **Jalon visé :** J2

---

## 0. Résultat attendu

La [roadmap moteur](../roadmap/engine.md#e1-une-facture-dune-page-sort-en-pdf) demande le premier
document réel d'Openview : un modèle court et un jeu de données fourni par l'hôte deviennent un PDF
présentable d'une page. Le lot est livré lorsque les cinq faits suivants sont vrais ensemble :

1. `@openview/engine` expose une façade PDF qui implémente le `RenderPort` public de `core` ;
2. le moteur valide le modèle, matérialise les boucles et conditions, partage un budget
   d'évaluation sur tout le document, évalue les formules du modèle et construit un document sûr ;
3. un paquet adaptateur distinct imprime ce document avec Chromium sans faire de Puppeteer une
   dépendance de `@openview/engine` ;
4. une facture de référence tient sur la feuille déclarée, montre son tableau, ses calculs, son
   logo, ses bandes applicables et son apparence, puis sort en **un seul** PDF ;
5. dans le playground local, l'utilisateur choisit un modèle, choisit un jeu de données et
   télécharge le résultat, sans écrire de code.

E1 n'est pas un faux renderer de démonstration. Le même pipeline et le même adaptateur deviennent
la fondation d'E2 à E9. En revanche, E1 reste volontairement mono-page : un contenu qui ne tient pas
est **refusé proprement**, jamais tronqué, réduit arbitrairement ou laissé à Chromium sous la forme
d'une deuxième page silencieuse.

---

## 1. État du dépôt et écart à combler

### 1.1 Ce que `core` livre déjà au moteur

E1 consomme la vague 1 ; il ne réécrit aucune de ses décisions.

| Besoin d'E1 | Contrat déjà livré | Règle de consommation |
| :--- | :--- | :--- |
| Modèle courant ou historique | `parseTemplate`, migrations 1→8, garde de forme, `TemplateSchema` | parser une fois à l'entrée du pipeline ; jamais dans la boucle de rendu |
| Jeu de données hôte | `EvaluationScope`, `RenderRequest.data` | aucune validation Zod, aucun nom réservé, aucune copie métier |
| Expressions | `evaluateExpression`, `evaluatePredicate`, `evaluateSequence`, `childScope` | un `createBudget()` par document, partagé par toutes les positions |
| AST | Composite + `visitNode` / `visitSegment` | un visiteur central, pas un nouveau `switch` par étape |
| Tableau | colonnes pondérées, en-tête, corps, pied, lignes et groupes répétés | le tableau ne calcule rien ; les totaux restent des expressions du modèle |
| Page | feuille et marges en mm, bandes, marqueurs, `printableAreaOf` | la feuille vient du modèle ; aucune A4 ou Letter décidée par le moteur |
| Apparence | boîtes, typographies, alignements, `resolveTypography`, `resolveTextAlign`, `mmFromPt` | réutiliser les résolveurs et conversions exportés, sans formule parallèle |
| Refus du contrat | `diagnosticsOf` et diagnostics structurés | enrichir au site connu ; ne jamais inclure une valeur de rendu dans un message |
| Sortie | `RenderPort`, `RenderRequest`, `RenderResult` | retourner `format: 'pdf'`, `contentType: 'application/pdf'` et des octets |

La version stockée reste **8**. E1 n'ajoute ni champ, ni kind, ni valeur persistée : il n'existe donc
aucune migration 8→9 à créer pour « marquer » le lot.

### 1.2 Les dettes aval transmises explicitement à E1

Les ADR de `core` ont laissé plusieurs décisions au premier moteur réel. E1 doit les fermer ou les
borner ; les ignorer ferait du PDF un comportement implicite.

| Dette transmise | Source | Réponse d'E1 |
| :--- | :--- | :--- |
| Évaluer totaux, agrégations, échéance et arrondis déclarés | ADR 0003 et 0004 | matérialisation avec le budget commun de `core` ; aucun calcul de facture interne |
| Décider la valeur textuelle absente et la valeur non imprimable | ADR 0001, question 2 | refus typé au site de liaison visible ; condition absente = `false`, boucle absente = zéro occurrence restent inchangées |
| Éprouver `MAX_SHEET_MM` contre l'adaptateur réel | ADR 0006 | sonde Chromium bloquante avant de figer l'adaptateur |
| Première page = dernière page | ADR 0006 | appliquer `every`, `firstOnly` et `lastOnly` selon leur domaine ; ne pas appliquer `exceptFirst` ni `exceptLast` sur l'unique page |
| Valeurs typographiques absentes | ADR 0007, attente 3 | défauts explicites du moteur, appliqués run par run et écrits dans l'ADR E1 |
| sRGB et couleurs d'impression exactes | ADR 0007, attente 4 | CSS sRGB exact, impression des fonds et sonde du PDF réel |
| Conversion pt → unité de rendu | ADR 0007, attente 5 | `mmFromPt`, jamais une seconde constante `25.4 / 72` |
| Rencontre de filets adjacents | ADR 0007, attente 6 | règle unique de conflit des bordures de tableau, vérifiée dans Chromium |
| Justification | ADR 0007, attente 7 | convention CSS explicitement testée : dernière ligne à `start`, espace réparti entre mots |
| Image sans dimension | ADR 0007, attente 8 | largeur du contenu parent, hauteur issue du ratio intrinsèque ; échec si l'image ne tient pas |
| Ressource atomique surdimensionnée | ADR 0009, E1/E2-5 | refus `oversized-atomic-resource`, sans découpe ni boucle |

### 1.3 Ce qui manque aujourd'hui

- aucune façade de rendu n'implémente `RenderPort` ;
- aucune représentation matérialisée ne distingue encore déclaration, occurrence et contenu lié ;
- aucune politique n'existe pour transformer une valeur `unknown` en texte imprimé ;
- aucune feuille HTML sûre n'est produite depuis l'AST ;
- aucun contrôle ne prouve qu'un contenu tient sur une page ;
- aucun navigateur headless n'est isolé derrière une stratégie ;
- aucun test ne lit les octets d'un PDF réel ;
- le playground n'a ni endpoint local de rendu, ni panneau de téléchargement.

---

## 2. Périmètre fermé

### 2.1 Inclus dans E1

- parsing/migration du modèle à la frontière ;
- matérialisation de `text`, `image`, `container`, `loop`, `condition`, `table`, `tableRowGroup` et
  `tableRow` ;
- évaluation des expressions de texte, de condition, de boucle et de groupe de lignes ;
- partage du budget sur le document entier, bandes incluses ;
- substitution fixe des marqueurs `number` et `count` par `1` ;
- sélection correcte des bandes applicables à une page qui est à la fois première et dernière ;
- feuille et marges déclarées en millimètres ;
- modèle de boîte C5, colonnes pondérées, alignements, typographies, couleurs, fonds et filets ;
- image bitmap embarquée, ratio intrinsèque et contrôle de chargement ;
- sérialisation HTML fermée et échappée, CSP restrictive et absence de requête réseau ;
- impression PDF en mémoire avec Chromium ;
- contrôle avant impression qu'aucun contenu ne déborde ;
- erreur typée, sûre à journaliser, avec chemin et id de nœud lorsque le site est connu ;
- facture de recette, tests unitaires, test d'intégration Chromium et parcours du playground.

### 2.2 Exclus, avec leur propriétaire

| Exclu d'E1 | Motif | Propriétaire |
| :--- | :--- | :--- |
| seconde page, découpe de texte ou de tableau, répétition d'en-tête | le lot doit refuser tout débordement | E2 |
| reports, dernière page métier, repli effectif de `keepTogether` | nécessitent une pagination réelle | E3 |
| choix d'une écriture et formatage de sites monétaires/décimaux/date | `core` a livré les verbes, pas les sites | E4 |
| résultat de pagination et identité d'occurrence stable | aucun consommateur E1 ne le demande | E5 |
| polices embarquées, octets identiques, suppression des métadonnées temporelles | déterminisme multi-machine | E6 |
| golden masters PDF et fixture historique v1 | corpus figé de non-régression | E7 |
| réseau sous liste blanche, DNS rebinding, timeouts métier, mémoire et concurrence | document hostile | E8 |
| guide public « PDF en dix lignes » | publication de la brique | E9 |
| HTML ou PNG comme résultat public | hors périmètre v1 de la roadmap | hors v1 |
| endpoint public, comptes, stockage ou file de rendu | `engine` est une bibliothèque | service de rendu |

`keepTogether` reste accepté et conservé dans la représentation matérialisée, mais n'ajoute aucun
comportement observable en mono-page : ce qui tient est déjà entier ; ce qui ne tient pas est refusé
par la politique E1. E3 reste le seul propriétaire du report et du repli ordonné.

---

## 3. Décisions d'architecture

### D1 — Deux paquets, une dépendance dans un seul sens

E1 ajoute un paquet adaptateur distinct, nommé dans ce plan
`@openview/adapter-puppeteer` :

```text
@openview/core
      ↑
@openview/engine  ←  @openview/adapter-puppeteer
      ↑                         ↑
      └──────── apps/playground ┘
```

- `@openview/engine` dépend uniquement de `@openview/core` ;
- l'adaptateur dépend de `@openview/engine` et de Puppeteer ;
- le playground dépend des deux pour son serveur local de développement ;
- `designer` et `viewer` n'importent ni `engine`, ni l'adaptateur ;
- aucun type Puppeteer, Chromium ou DOM ne traverse le barrel de `engine`.

Le paquet adaptateur est le coût explicite de l'architecture hexagonale imposée par
[ARCHITECTURE.md](../../ARCHITECTURE.md). Installer `@openview/engine` seul ne télécharge donc pas
Chromium. Aucun paquet fictif Playwright ou Canvas n'est créé en E1.

### D2 — Une façade PDF qui implémente le port existant

La surface publique visée est conceptuellement :

```ts
export interface PdfSourceDocument {
  readonly html: string;
  readonly sheet: Sheet;
}

export interface PdfRenderStrategy {
  readonly format: 'pdf';
  render(document: PdfSourceDocument): Promise<Uint8Array>;
}

export interface RenderEngineOptions {
  readonly shapeLimits?: Partial<ShapeLimits> | undefined;
  readonly evaluationLimits?: Partial<EvaluationLimits> | undefined;
}

export function createPdfRenderPort(
  strategy: PdfRenderStrategy,
  options?: RenderEngineOptions | undefined,
): RenderPort;
```

La façade porte le nom `createPdfRenderPort`. INC-0 ne le rouvre que si la baseline a déjà livré un
symbole concurrent ; les responsabilités restent dans tous les cas non négociables :

- l'appelant fournit le modèle et les données dans le `RenderRequest` existant ;
- la stratégie ne reçoit jamais les données hôte ni l'AST brut ;
- la stratégie reçoit seulement un document HTML déjà fermé, échappé et accompagné de la feuille ;
- la façade assemble `RenderResult` et garantit le couple `pdf` / `application/pdf` ;
- les limites sont de la configuration du moteur, pas un troisième champ métier dans
  `RenderRequest`.

Il n'y a ni registre multi-format, ni `HtmlRenderStrategy` vide, ni `ImageRenderStrategy` vide. Le
point de stratégie est justifié aujourd'hui par le second paquet réel et par la nécessité de tenir
Puppeteer hors du moteur ; les autres formats seront des implémentations, pas des classes d'attente.

### D3 — Un Pipeline, cinq transformations obligatoires

Chaque rendu exécute, dans cet ordre, toutes les étapes :

```text
RenderRequest
   │
   ├─ ValidationStep       → modèle courant validé
   ├─ DataBindingStep      → document matérialisé, sans expression exécutable
   ├─ DomBuildStep         → arbre HTML fermé, sans chaîne utilisateur interprétée
   ├─ SanitizeStep         → HTML sérialisé et échappé + CSP
   └─ PdfExportStep        → stratégie PDF → RenderResult
```

Une étape ne possède pas de `next()` et ne décide pas d'arrêter silencieusement la chaîne. Un refus
est une exception typée ; un succès a traversé les cinq transformations. Les étapes restent des
fonctions ou petites classes directes, testables isolément : E1 n'introduit pas de conteneur
d'injection, de factory abstraite ni de bus d'événements.

### D4 — La liaison produit une représentation matérialisée, jamais du HTML

`DataBindingStep` transforme les déclarations de `core` en une union interne pure :

- les `loop` disparaissent au profit de leurs occurrences ordonnées ;
- les `condition` fausses ne produisent aucune occurrence ;
- les `tableRowGroup` deviennent leurs lignes matérialisées ;
- un bloc texte porte des runs `{ text, typography }` déjà résolus ;
- un marqueur de page porte déjà la chaîne `'1'` ;
- une image garde sa source validée, son texte alternatif, son style et l'id de déclaration ;
- les boîtes, colonnes et lignes gardent uniquement les faits nécessaires à la peinture ;
- chaque occurrence garde un chemin d'exécution local pour les diagnostics, mais E1 ne publie pas
  encore l'identité d'occurrence d'E5.

Cette représentation vit sous `packages/engine/src/document/` avec `types.ts` séparé de la logique.
Elle ne devient pas un contrat Zod : elle n'entre jamais depuis l'extérieur, n'est ni stockée ni
exportée comme donnée d'intégration, et elle est construite exclusivement depuis un `Template`
validé.

Le moteur parcourt l'AST par `visitNode` et les segments par `visitSegment`. Ajouter un neuvième
type de nœud ou un quatrième type de segment doit casser la compilation à un petit nombre de sites
exhaustifs.

### D5 — Une validation et un budget par document

`ValidationStep` appelle `parseTemplate(request.template, ..., shapeLimits)` une fois, même si le
type statique annonce déjà `Template`. Cela protège l'appel JavaScript, accepte un modèle historique
réel et applique la garde de forme avant toute récursion du moteur.

`RenderRequest.data` reste exactement le sac opaque du contrat :

- aucun `RenderDataSchema` ;
- aucune clé requise à l'échelle du jeu de données ;
- aucune recherche de « client », « total », « aujourd'hui » ou « lignes » ;
- aucune sérialisation globale du scope ;
- seules les expressions écrites par le modèle lisent les propriétés qu'elles nomment.

Après validation, `createBudget(evaluationLimits)` est appelé **une fois**. Le même budget traverse,
dans un ordre déterministe, l'en-tête applicable, le flux racine puis le pied applicable. Il est
passé à chaque évaluation de liaison, condition, boucle et groupe de lignes. Une fonction qui recrée
un budget dans une branche est une régression bloquante.

### D6 — Une liaison visible absente ou non imprimable fait échouer le rendu

E1 ferme la question laissée à `DataBindingStep` par l'ADR 0001.

| Valeur évaluée dans un `TextBindingSegment` | Comportement E1 |
| :--- | :--- |
| `string` | imprimée telle quelle |
| nombre fini | forme canonique `String(value)`, sans locale ni arrondi implicite |
| `null` ou `undefined` | refus `missing-binding-value` |
| booléen | refus `non-printable-binding-value` |
| nombre non fini | refus `non-printable-binding-value` |
| liste, objet, fonction, symbole ou bigint | refus `non-printable-binding-value` |

Le refus porte le `nodeId`, le chemin du segment et un `actualType` fermé obtenu par les utilitaires
de `core`, jamais la valeur. Le moteur n'imprime donc ni `'undefined'`, ni `'[object Object]'`, ni un
JSON inventé.

Ce choix ne rend pas les données optionnelles inexprimables : l'auteur utilise une condition
`isEmpty`, un `if` qui produit une chaîne vide ou une branche conditionnelle. Les deux politiques
déjà tranchées restent inchangées : une condition absente vaut faux et une boucle absente produit
zéro occurrence.

E1 n'applique aucune écriture C6 automatiquement. Un nombre de commande et un total sont tous deux
des nombres pour le moteur ; reconnaître le second réserverait un sens métier. Les sites de
formatage appartiennent à E4.

### D7 — Une vraie feuille mono-page, pas un flux que Chromium pagine

Le document HTML contient une seule boîte `.ov-page` aux dimensions exactes de
`Template.page.sheet`. `@page` reprend ces dimensions et met les marges d'impression Chromium à
zéro. Une boîte `.ov-printable` est positionnée avec les quatre marges du modèle et dimensionnée à
partir de `printableAreaOf(template.page)` — jamais avec une soustraction réécrite.

La zone imprimable contient trois régions verticales :

1. bande haute applicable, hauteur mesurée sur son contenu ;
2. flux racine, dans l'espace restant ;
3. bande basse applicable, hauteur mesurée sur son contenu.

Les bandes occupent donc l'aire imprimable ; elles ne sont ni les `headerTemplate` et
`footerTemplate` de Puppeteer, ni des marges du navigateur. Le schéma garantit qu'au plus une bande
par côté est applicable à une page donnée.

Pour `page = 1` et `count = 1` :

| `PageBandOccurrence` | Applicable |
| :--- | :--- |
| `every` | oui |
| `firstOnly` | oui |
| `exceptFirst` | non |
| `exceptLast` | non |
| `lastOnly` | oui |

La disjonction validée par `core` empêche deux « oui » de coexister sur le même côté dans un modèle
valide. Tous les `TextPageFieldSegment`, y compris dans le flux racine, rendent `1`.

Après chargement des images et des fontes, l'adaptateur mesure les trois régions et leurs contenus.
Il refuse avant `page.pdf()` si :

- une bande dépasse à elle seule l'aire imprimable ;
- le flux dépasse l'espace laissé par les bandes ;
- un descendant peint en dehors de la feuille ;
- une image atomique dépasse l'espace disponible ;
- une largeur ou hauteur de feuille n'est pas honorée par Chromium.

La page utilise `overflow: hidden` seulement comme dernière barrière contre une seconde page ; le
contrôle de mesure doit avoir réussi avant. Un test structurel lit ensuite le PDF et épingle une
page unique, afin qu'un arrondi CSS ne transforme pas le garde en promesse théorique.

### D8 — La sémantique de chaque nœud est fermée en E1

| Nœud | Matérialisation et peinture mono-page |
| :--- | :--- |
| `text` | un bloc, un `<span>` par run, concaténation sans séparateur inventé |
| `image` | image atomique, largeur du contenu parent, hauteur automatique selon le ratio |
| `container` | boîte pleine largeur, enfants dans l'ordre du modèle |
| `loop` | une occurrence de ses enfants par élément, scope créé par `childScope` |
| `condition` | enfants présents uniquement si `evaluatePredicate` vaut vrai |
| `table` | une table pleine largeur avec en-tête, corps et pied dans cet ordre |
| `tableRowGroup` | pour chaque élément, toutes ses lignes dans leur ordre et leur scope enfant |
| `tableRow` | une cellule rendue par colonne déclarée ; colonne sans cellule = cellule vide |

Une cellule retrouve sa colonne par `columnId`, jamais par position. Elle peut contenir n'importe
quel `BlockNode`, y compris un conteneur, une condition, une image ou un tableau imbriqué. Une ligne
courte ne reçoit aucun faux contenu de remplissage : seules les cellules HTML structurelles vides
sont créées pour conserver la géométrie des colonnes.

### D9 — Des défauts typographiques explicites, sans cascade de modèle

Pour chaque run, le moteur appelle `resolveTypography({ run, block })`, puis remplit les propriétés
encore absentes avec les défauts E1 suivants :

| Propriété | Défaut E1 |
| :--- | :--- |
| famille | `sans-serif` |
| taille | `10 pt`, convertis par `mmFromPt(10)` |
| graisse | `400` |
| style | `normal` |
| couleur | `#000000`, interprété en sRGB |
| alignement sans bloc ni colonne | `start` |

Les défauts sont appliqués sur chaque run sérialisé, pas hérités accidentellement d'un conteneur
DOM. Une typographie de segment garde la précédence sur celle du bloc ; l'alignement du bloc garde
la précédence sur celui de la colonne par `resolveTextAlign`.

Le générique `sans-serif` reste une dette de déterminisme explicitement transmise à E6 : E1 prouve
un PDF présentable sur l'environnement courant, pas l'identité de glyphes entre deux machines. Si
le modèle nomme une famille absente, Chromium emploie son repli ; E6 fixera le catalogue de fontes,
leur chargement et le refus associé.

`justify` est émis comme `text-align: justify` sans `text-align-last: justify`. La dernière ligne
reste donc à `start`, et aucun `letter-spacing` n'est ajouté : le résidu est réparti entre les
espaces inter-mots, conformément à l'ADR 0007. Une sonde de styles calculés et une capture ciblée
confirment cette hypothèse sur la version Chromium retenue.

### D10 — Le modèle de boîte de C5 est appliqué sans nouvelle unité

- un bloc reçoit la largeur de contenu de son parent ;
- le `padding` en millimètres retranche cette largeur et cette hauteur ;
- les fonds et filets peignent la boîte sans créer une marge entre frères ;
- aucune marge CSS de navigateur n'est laissée sur `html`, `body`, paragraphes ou tables ;
- la taille de police passe de pt à mm via `mmFromPt` ;
- toutes les autres longueurs sont déjà en mm et traversent sans conversion intermédiaire ;
- `box-sizing` et les enveloppes de peinture sont écrits de façon à ne pas faire entrer une bordure
  dans la formule de largeur que l'ADR 0007 réserve au `padding`.

Pour une table, la largeur de contenu est partagée selon
`column.width / sum(table.columns.width)`. La division est faite une fois, sans `toFixed`, sans
plancher de pourcentage et sans normalisation à deux décimales. Le `padding` de table est retranché
avant le partage ; le `padding` de ligne est appliqué identiquement au contenu de chaque cellule et
ne déplace aucune frontière de colonne.

### D11 — Les filets de tableau se recouvrent ; le plus large gagne

E1 retient une règle déterministe pour la rencontre de filets adjacents :

1. les filets qui occupent la même frontière se **recouvrent**, ils ne s'additionnent pas ;
2. le filet de largeur la plus grande est visible ;
3. à largeur égale, la priorité va à la boîte la plus locale (`row` avant `table`) ;
4. entre la fin de la ligne précédente et le début de la suivante, le filet `top` de la ligne
   suivante gagne l'égalité ;
5. au périmètre, le filet explicite de la table gagne l'égalité.

Le premier choix d'implémentation est `border-collapse: collapse` avec uniquement des styles
`solid`. INC-0 compare son comportement réel à la règle ci-dessus sur toutes les égalités. Si
Chromium ne la reproduit pas, `DomBuildStep` synthétise une frontière unique ; la règle ne change
pas pour s'adapter au navigateur.

Cette décision est écrite dans l'ADR E1 afin que V1 reproduise la même convention et que V3 puisse
la comparer. E2 étendra la même règle aux frontières créées par une coupe ; il ne la redécidera pas.

### D12 — E1 accepte uniquement des images bitmap embarquées

Le modèle `ImageNode` reste plus large : `core` accepte HTTP(S), clé d'actif hôte et plusieurs URI
image. La première stratégie PDF adopte volontairement un sous-ensemble sûr jusqu'à E8 :

- accepté : `data:image/png;base64`, `data:image/jpeg;base64`, `data:image/webp;base64` ;
- refusé en E1 : HTTP(S), chemins, clés d'actif, `file:`, SVG et tout autre type MIME ;
- aucune requête sortante n'est autorisée par la page ;
- une image qui ne décode pas ou dont `naturalWidth`/`naturalHeight` est nul fait échouer le rendu ;
- `alt` ne remplace jamais silencieusement un logo absent dans le PDF ;
- largeur = largeur de contenu du parent, `height: auto`, ratio intrinsèque conservé ;
- aucune image n'est étirée indépendamment sur les deux axes ;
- si sa hauteur ne tient pas, refus `oversized-atomic-resource`.

La facture de recette embarque donc un petit logo PNG. Cette restriction ne modifie pas le schéma
et ne prétend pas qu'une URL valide pour `core` est déjà supportée par tous les renderers. E8
introduira la résolution hôte et la liste blanche de ressources avec les bornes de taille, de temps
et de réseau requises ; E1 ne crée pas un Port d'actifs spéculatif.

### D13 — La sûreté vient d'un vocabulaire HTML fermé

`DomBuildStep` ne concatène jamais une valeur utilisateur dans du markup arbitraire. Il produit un
petit arbre interne dont :

- les noms d'éléments appartiennent à une union fermée (`div`, `span`, `img`, `table`, `thead`,
  `tbody`, `tfoot`, `tr`, `td`, `colgroup`, `col`) ;
- les attributs sont choisis par le moteur ;
- le texte et les attributs sont échappés séparément ;
- une famille de police passe par un échappement CSS dédié ;
- couleurs, alignements, booléens et longueurs viennent de champs déjà validés ;
- aucun texte du modèle n'entre dans `<style>` ou dans un nom d'attribut ;
- les ids de nœud ne servent qu'à un `data-openview-node` échappé pour la mesure et le diagnostic.

`SanitizeStep` sérialise cet arbre et ajoute une CSP au document : aucun script, aucune navigation,
aucun frame, aucune connexion et aucune ressource distante ; les styles inline du moteur et les
images `data:` autorisées sont les seules exceptions. JavaScript est désactivé dans la page
Puppeteer avant le chargement.

Cette construction rend inutile une dépendance DOMPurify dans E1 : Openview ne reçoit aucun HTML
libre et ne doit pas construire une chaîne dangereuse pour la nettoyer ensuite. Les tests injectent
`<script>`, guillemets, fermetures de balise et séquences CSS dans tous les sites textuels afin de
prouver l'échappement.

### D14 — L'adaptateur Puppeteer applique des options explicites

L'adaptateur charge le HTML en mémoire et appelle `page.pdf()` avec au minimum :

- `preferCSSPageSize: true` pour donner priorité à la taille `@page` ;
- `printBackground: true` pour conserver fonds et filets ;
- `displayHeaderFooter: false` car les bandes appartiennent au modèle ;
- `scale: 1` ;
- `waitForFonts: true` ;
- aucune `path`, afin de retourner les octets sans fichier temporaire ;
- aucune `format: 'a4'` ou autre format décidé par l'adaptateur.

Le CSS porte `print-color-adjust: exact` et `-webkit-print-color-adjust: exact`. La documentation
officielle de Puppeteer confirme que `preferCSSPageSize` donne priorité à `@page`, que
`printBackground` est nécessaire aux fonds et que `page.pdf()` modifie autrement les couleurs
d'impression : [PDFOptions](https://pptr.dev/api/puppeteer.pdfoptions) et
[Page.pdf](https://pptr.dev/api/puppeteer.page.pdf).

Une interception est installée avant `setContent`. Toute requête réseau non déjà traitée est
avortée ; le handler reste synchrone et vérifie `isInterceptResolutionHandled`, conformément au
guide officiel [Request interception](https://pptr.dev/guides/network-interception). Les URI
`data:` ne produisent pas de requête réseau.

E1 lance un navigateur isolé par rendu et attend explicitement la fermeture de la page, du contexte
et du navigateur dans un `finally`. Ce choix privilégie l'absence de fuite et une sémantique simple
au débit ; le partage de processus, la concurrence, les files et les délais appartiennent à E8.

E1 ne promet pas encore l'égalité binaire de deux PDF : Chromium peut écrire des métadonnées ou
résoudre une police selon l'hôte. E6 possédera cette preuve. En revanche, aucune lecture de
`Date`, `Math.random`, `process.env`, `performance`, locale ou fuseau n'entre dans le code de
`engine`.

### D15 — Des erreurs typées, sans fuite de données

`@openview/engine` expose une classe `DocumentRenderError` et un tuple fermé de codes E1. La liste
exacte est arrêtée dans l'ADR, avec au minimum :

```text
template-refused
expression-refused
missing-binding-value
non-printable-binding-value
unsupported-image-source
image-load-failed
oversized-atomic-resource
single-page-overflow
pdf-export-failed
adapter-capability-mismatch
```

Chaque erreur porte seulement les détails sûrs qui ont un sens : `nodeId`, chemin dans le modèle,
`actualType`, côté de bande ou limite déclarée. Aucun message ne contient le texte lié, la source
de l'image, le modèle sérialisé, les données, le HTML généré ou la cause sérialisée.

Lorsqu'un appel de `core` échoue, le moteur demande `diagnosticsOf(error, context)` au site où le
nœud et le chemin sont connus :

- diagnostics reconnus → `DocumentRenderError` avec les diagnostics structurés en lecture seule ;
- erreur inconnue ou faute de programmation → erreur typée `pdf-export-failed` ou
  `expression-refused` avec `cause`, mais message constant et sans aplatissement de la cause ;
- aucune capture vide, aucun `console.log` de données, aucune promesse détachée.

Le playground transforme seulement `code` et `message` sûrs en réponse JSON locale. E9 documentera
la surface publique et les remèdes ; E1 doit déjà rendre les refus testables.

### D16 — Le playground utilise un pont local, pas un service public caché

Une application Vite exécutée dans le navigateur ne peut pas lancer Chromium. E1 ajoute donc au
serveur **de développement** du playground un endpoint local privé, monté par un petit plugin Vite :

- `GET /__openview/render-catalog` → ids et libellés des exemples ;
- `POST /__openview/render-pdf` → ids choisis, jamais modèle/données arbitraires ;
- succès → octets PDF et `Content-Disposition: attachment` ;
- refus connu → JSON sûr avec code/message, sans cause ;
- autre méthode, id inconnu ou corps mal formé → 400/404 sans lancer le moteur.

Le catalogue typé vit dans un module du playground et possède deux modèles d'apparence et deux jeux
de données courts compatibles. Il réutilise la facture de référence déjà démontrée par l'application
au lieu de créer un second vocabulaire de facture. Le modèle gagne un logo PNG embarqué et reste un
contrat `Template` obtenu par `parseTemplate`.

Le client ajoute un composant isolé — pas 200 lignes de plus dans `App.tsx` — avec deux sélecteurs,
un bouton, un état de chargement, un refus lisible et la révocation de l'URL objet après le
téléchargement. L'endpoint n'est ni construit dans `vite build`, ni publié comme service de rendu ;
le critère de recette s'exécute par `pnpm dev`.

### D17 — Deux dépendances justifiées, aucune autre

E1 planifie :

- `puppeteer` en dépendance d'exécution de `@openview/adapter-puppeteer`, car il fournit le navigateur
  et `Page.pdf()` ;
- `pdf-lib` en dépendance de développement de l'adaptateur, uniquement pour lire le nombre de pages
  et les dimensions du PDF dans les tests structurels.

La version stable réellement installée est relevée à INC-0, verrouillée dans `pnpm-lock.yaml` et
inscrite dans l'ADR avec la version Chromium correspondante. Le PR justifie le téléchargement du
binaire et la surface supply-chain. Si `pnpm add` écrit une entrée
`minimumReleaseAgeExclude`, elle n'est jamais acceptée silencieusement : employer une version ayant
passé la fenêtre de refroidissement est préféré ; toute dérogation restante est nommée dans le PR.

Aucune dépendance de sanitization, de serveur HTTP, de templating, de CSS-in-JS, de formatage ou de
logging n'est ajoutée. Les `package.json` et le lockfile ne sont modifiés qu'au moment de l'exécution
d'E1, avec le mandat du lot et le diff supply-chain explicitement relu.

---

## 4. Organisation cible des fichiers

La structure exacte peut varier à la marge, mais les responsabilités restent séparées :

```text
packages/engine/src/
├── errors.ts
├── index.ts
├── document/
│   ├── types.ts
│   └── materialize.ts
├── html/
│   ├── types.ts
│   ├── build.ts
│   ├── css.ts
│   ├── escape.ts
│   └── serialize.ts
├── pipeline/
│   ├── validate.ts
│   └── render-pdf.ts
├── strategy/
│   └── pdf.ts
└── __tests__/
    ├── fixtures.ts
    ├── materialize.test.ts
    ├── html.test.ts
    ├── errors.test.ts
    └── render-pdf.test.ts

packages/adapter-puppeteer/
├── package.json
├── tsconfig.json
├── tsconfig.typecheck.json
└── src/
    ├── index.ts
    ├── puppeteer-pdf-strategy.ts
    ├── measure.ts
    └── __tests__/
        ├── puppeteer-pdf-strategy.test.ts
        └── fixtures.ts

apps/playground/src/
├── examples/
│   └── reference-invoice.ts
└── rendering/
    ├── RenderDownloadPanel.tsx
    └── client.ts
```

Le pont Vite reste mince dans `apps/playground/vite.config.ts` et délègue le rendu à la surface
typée des deux paquets. Si son volume dépasse une trentaine de lignes de logique, extraire un module
Node local à l'application et lui donner son propre passage TypeScript devient une condition de
livraison ; le config ne doit pas devenir un serveur non testé.

Le barrel de `engine` exporte uniquement la façade, les types de stratégie, options et erreurs
nécessaires à un intégrateur. Les unions matérialisées, nœuds HTML, helpers CSS et sélecteurs de
mesure restent internes.

Tous les commentaires ajoutés dans les fichiers TypeScript sont en anglais, contractuels et courts.
Les arbitrages détaillés vivent dans l'ADR 0012 et dans le présent plan, pas dans les JSDoc.

---

## 5. Facture de référence et oracles

### 5.1 Un modèle générique malgré le document de recette

La fixture est une facture parce que la roadmap l'a choisie comme document d'exigence, pas parce que
le moteur la reconnaît. Ses noms (`commande`, `lignes`, `societe`, etc.) sont ceux de l'application
exemple. Aucun de ces noms n'apparaît dans `packages/engine` ou dans l'adaptateur.

Le modèle de recette doit porter au minimum :

- une feuille A4 **déclarée par le modèle** et des marges explicites ;
- une bande haute applicable avec logo bitmap et référence ;
- une bande `lastOnly` contenant marqueurs `1 / 1` et mention issue des données ;
- un titre calculé ;
- un tableau à cinq colonnes avec en-tête, groupe de lignes répété et pied ;
- une condition dans une cellule ;
- un total agrégé, une remise en pourcentage, un reste à payer ;
- une échéance calculée et un `endOfMonth` ;
- au moins un `round` avec mode et décimales déclarés ;
- boîte racine, fonds, filets, paddings, typographies de bloc et de run, alignements `start`, `end`
  et `justify` ;
- une paire de filets adjacents de largeurs différentes pour exercer D11 ;
- `keepTogether: true` sur au moins une ligne ou un cadre, sans prétendre tester E3.

Les données ne contiennent aucun total prêt à l'emploi. Elles fournissent uniquement les faits que
le modèle a choisi de lire. Une seconde donnée courte fait varier nombre de lignes, condition et
résultats sans dépasser la page. Les deux apparences emploient la même structure et les mêmes ids ;
seules les propriétés d'apparence changent.

### 5.2 Oracles mécaniques

Le test ne se contente pas de « ne lève pas » :

- les octets commencent par une signature PDF valide ;
- `RenderResult` annonce `pdf` et `application/pdf` ;
- `pdf-lib` lit exactement une page ;
- la page a les dimensions déclarées, dans la tolérance de conversion PDF documentée ;
- le HTML préparé contient les résultats calculés attendus et ne contient plus aucun nœud
  d'expression, alias de boucle ou texte non échappé ;
- le nombre de lignes matérialisées égale la donnée sélectionnée ;
- condition fausse et boucle absente ne produisent aucun bloc ;
- les marqueurs rendent `1` et la bonne bande de dernière page est présente ;
- aucune requête réseau n'est observée ;
- aucune donnée source ni aucun template n'est muté.

E1 n'ajoute pas encore un golden PDF figé : Chromium, les fontes et les métadonnées ne sont pas
stabilisés avant E6/E7. Le test structurel et les assertions de représentation sont les preuves
automatiques proportionnées à ce lot.

### 5.3 Oracle humain

Un PDF « présentable » reste un jugement visuel. La recette manuelle consigne :

- logo net et ratio respecté ;
- aucun texte coupé, chevauché ou sorti des marges ;
- colonnes alignées entre en-tête, corps et pied ;
- fonds et couleurs proches des valeurs sRGB déclarées ;
- typographies et emphases visibles ;
- filets adjacents conformes à D11 ;
- facture lisible à 100 % dans un lecteur PDF courant ;
- les deux apparences sont nettement distinctes ;
- le téléchargement porte un nom de fichier explicite.

Cette validation produit un petit compte rendu dans l'ADR E1. Le PDF local peut être joint à la PR
comme artefact de CI ou de revue, mais il ne devient pas le golden master E7.

---

## 6. Stratégie de tests

### 6.1 `@openview/engine` — tests sans navigateur

#### Validation et façade

- modèle v8 valide accepté ;
- modèle v1 réellement historique migré avant rendu ;
- modèle futur ou invalide rendu en `template-refused` avec diagnostics C8 ;
- scope conservé opaque et non muté ;
- stratégie appelée une fois après les quatre premières étapes ;
- stratégie jamais appelée si une étape refuse ;
- `RenderResult` exact ;
- erreur arbitraire de stratégie encapsulée avec cause, sans message de cause exposé.

#### Budget et évaluation

- un budget partagé entre bande haute, racine et bande basse ;
- total, agrégation, pourcentage, date et arrondi évalués avec les fonctions de `core` ;
- dépassement de pas, profondeur, items et longueur rendu en refus structuré ;
- aucune mémoïsation qui transformerait le coût déclaré ;
- scope d'une boucle et d'un groupe de lignes créé par `childScope` ;
- boucles imbriquées gardant la bonne portée ;
- condition absente fausse, séquence absente vide.

#### Politique d'impression

- chaîne et nombre fini imprimés ;
- `null`, `undefined`, booléen, non-fini, liste, objet, fonction, symbole et bigint refusés ;
- aucune valeur n'apparaît dans l'erreur ;
- chemin et `nodeId` désignent exactement la liaison fautive ;
- segment littéral, liaison et marqueur gardent l'ordre sans séparateur ajouté ;
- typographie de run prioritaire, puis bloc, puis défaut E1.

#### AST et table

- les huit types de nœud exercés ;
- ligne statique, groupe répété, en-tête et pied dans l'ordre ;
- colonne manquante dans une ligne rendue vide ;
- cellule retrouvée par id malgré un ordre différent ;
- contenu bloc imbriqué dans une cellule ;
- poids très dissymétriques non arrondis à zéro ;
- padding de table et de ligne conforme à D10 ;
- les modèles et tableaux d'entrée restent inchangés.

#### Page mono-page

- matrice complète des cinq occurrences sur `page=1/count=1` ;
- en-tête, racine, pied évalués dans l'ordre publié ;
- marqueurs dans les trois régions remplacés par `1` ;
- `printableAreaOf` appelé comme dépendance, avec un test Letter à marges décimales ;
- aucune A4 implicite dans le moteur ;
- `keepTogether` ne change pas un succès mono-page.

#### HTML et sécurité

- échappement texte et attribut de `& < > " '` ;
- famille de police avec guillemet, barre oblique et contrôle CSS ;
- couleur et longueurs seulement depuis le contrat validé ;
- aucune chaîne du modèle dans un nom d'élément, un nom d'attribut ou un bloc de style ;
- CSP attendue ;
- absence de balise `script`, handler `on*`, iframe, URL réseau et HTML brut ;
- serializer déterministe pour la même représentation en mémoire.

### 6.2 Adaptateur Puppeteer — tests avec Chromium réel

- document minimal → PDF lisible d'une page ;
- dimensions A4, Letter paysage par dimensions inversées et feuille personnalisée ;
- fonds/couleurs présents avec `printBackground` et ajustement exact ;
- page sans en-tête/pied Chromium ajouté ;
- PNG/JPEG/WebP embarqués décodés ;
- image corrompue refusée ;
- HTTP, `file`, SVG et clé d'actif refusés avant chargement ;
- requête injectée dans une ressource secondaire avortée ;
- débordement du flux, bande surdimensionnée et image trop haute refusés ;
- PDF jamais produit avec deux pages ;
- options `@page` prioritaires sur le défaut Letter de Chromium ;
- navigateur fermé après succès et après chaque famille d'échec ;
- aucune promesse Puppeteer non attendue.

Le lancement de Chromium est partagé à l'intérieur d'un fichier de test si cela réduit le temps,
mais le comportement public « isolation par rendu » reste couvert au moins une fois. Les tests qui
dépendent du binaire ne sont pas sautés silencieusement en CI ; une absence de Chromium est un échec
d'installation explicite.

### 6.3 Playground

- catalogue sans données sensibles et ids stables ;
- id modèle/donnée inconnu refusé avant le moteur ;
- réponse PDF avec headers corrects ;
- réponse d'erreur sans `cause`, HTML, modèle ou données ;
- helper client révoquant l'URL objet ;
- vérification manuelle du parcours complet sous `pnpm dev`.

Un vrai E2E multi-navigateur reste dans la trajectoire QA du playground ; E1 n'ajoute pas Playwright
uniquement pour cliquer sur deux sélecteurs. Le test d'intégration le plus risqué est le PDF
Chromium lui-même, déjà exercé dans l'adaptateur.

### 6.4 Couverture et quatre portes

`vitest.config.ts` découvre déjà `packages/*` : le paquet adaptateur entre dans le run sans
modification de configuration. E1 ne baisse aucun seuil et n'ajoute aucune exclusion. Toute fonction
de `core` ou `engine` reste couverte à au moins 90 % sur statements, branches, fonctions et lignes ;
l'adaptateur vise la même discipline même si le seuil par paquet n'est pas encore individualisé.

À la fin de chaque incrément publiable, puis une dernière fois :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Aucun `tsconfig`, `biome.jsonc`, workflow, `turbo.json`, configuration Vitest ou seuil n'est modifié
pour faire passer E1. Une règle qui bloque révèle un défaut du code ou un besoin de mandat distinct.

---

## 7. Incréments d'exécution

### INC-0 — Baseline, dépendances et sondes bloquantes

1. relever `CURRENT_SCHEMA_VERSION`, dernier numéro d'ADR, état de `engine`, exports du port et état
   du worktree ;
2. confirmer que la vague 1 de `core` est réellement livrée et que le playground compile ;
3. choisir une version stable de Puppeteer ayant passé la fenêtre supply-chain, relever son
   Chromium et créer temporairement le paquet adaptateur minimal ;
4. lancer les sondes sur le vrai `page.pdf()` : dimensions min/max, A4/Letter, fonds, sRGB,
   justification, filets adjacents, image intrinsèque, seconde page et fermeture de processus ;
5. vérifier `MAX_SHEET_MM = 5080` dans les deux axes et aux quatre combinaisons min/max utiles ;
6. écrire les résultats, versions et corrections dans le brouillon ADR 0012 ;
7. supprimer les scripts jetables ou transformer seulement une sonde durable en test de contrat.

**Porte de décision :** si Chromium ne peut pas honorer une feuille valide à `MAX_SHEET_MM`, ne pas
clamp, réduire ou mettre à l'échelle silencieusement. Arrêter l'incrément et rouvrir explicitement la
borne C4 avec le propriétaire du produit ; un moteur qui accepte le modèle puis change sa feuille
est incorrect.

**Sortie :** architecture confirmée sur le binaire réel, dépendances justifiées, aucun code de
production important encore engagé sur une hypothèse externe.

### INC-1 — Port PDF, erreurs et pipeline avec stratégie factice

1. créer les types `PdfSourceDocument`, `PdfRenderStrategy`, options et erreurs ;
2. implémenter `ValidationStep` avec `parseTemplate` ;
3. implémenter la façade `createPdfRenderPort` et l'assemblage du `RenderResult` ;
4. employer une stratégie factice dans les tests pour prouver ordre, appel unique et refus ;
5. exporter la surface minimale depuis `packages/engine/src/index.ts` ;
6. conserver `ENGINE_VERSION` si elle fait encore partie de la surface, sans en faire un second
   mécanisme de version du document.

**Sortie :** un port PDF complet du point de vue orchestration, sans Puppeteer dans `engine`.

### INC-2 — Matérialisation complète de l'AST

1. créer les types internes séparés ;
2. implémenter le visiteur de blocs et de segments ;
3. partager le budget dans l'ordre bande haute → racine → bande basse ;
4. appliquer les politiques de liaison D6 ;
5. matérialiser boucles, conditions, tables et groupes de lignes ;
6. sélectionner les bandes mono-page et substituer les marqueurs ;
7. propager chemin et `nodeId` vers les erreurs ;
8. couvrir les huit nœuds et les valeurs hostiles sans inspecter leur contenu.

**Sortie :** une représentation sans expression exécutable, indépendante de tout navigateur.

### INC-3 — DOM fermé, styles et sanitization

1. créer le vocabulaire HTML interne ;
2. construire feuille, aire imprimable, bandes, flux et tables ;
3. appliquer défauts typographiques, résolveurs et conversions de `core` ;
4. implémenter le modèle de boîte et la politique de filets ;
5. sérialiser avec échappements de texte, attribut et CSS ;
6. ajouter CSP, reset d'impression et `@page` ;
7. tester les injections, les largeurs et les styles sans navigateur ;
8. faire de `PdfSourceDocument` la seule sortie publique de cette chaîne vers la stratégie.

**Sortie :** un document autoportant, sûr et mesurable, sans Puppeteer.

### INC-4 — Adaptateur Chromium réel

1. finaliser `@openview/adapter-puppeteer` et ses manifests/tsconfigs sans toucher les configs
   protégées du dépôt ;
2. désactiver JavaScript, installer l'interception et charger le document ;
3. attendre fontes et décodage des images ;
4. mesurer bandes, flux, images et feuille ;
5. lever les refus de capacité et de débordement avant impression ;
6. appeler `page.pdf()` avec toutes les options explicites de D14 ;
7. fermer toutes les ressources avec `await` ;
8. lire le PDF avec `pdf-lib` et couvrir taille/page unique.

**Sortie :** un vrai `Uint8Array` PDF issu du moteur, avec aucune requête sortante.

### INC-5 — Facture de référence de bout en bout

1. extraire proprement l'exemple de facture du monolithe du playground sans dupliquer ses
   expressions ;
2. traduire en anglais les commentaires TypeScript déplacés et les raccourcir ;
3. ajouter le logo bitmap, le `round` témoin et les deux données courtes ;
4. vérifier que les deux apparences gardent structure, ids et chemins de données identiques ;
5. rendre chaque combinaison modèle/donnée dans le test d'intégration ;
6. épingler résultats calculés, une page, dimensions et absence de mutation ;
7. tester les mutations d'échec : donnée manquante, objet lié, image corrompue, corps trop long.

**Sortie :** le critère métier de la roadmap est exercé par une fixture réelle, sans règle métier
dans le moteur.

### INC-6 — Parcours de téléchargement du playground

1. monter les deux routes locales dans Vite ;
2. exposer seulement ids et libellés du catalogue ;
3. ajouter le panneau React isolé et le client de téléchargement ;
4. montrer l'état en cours et les refus sûrs ;
5. choisir un modèle et une donnée, télécharger puis ouvrir le PDF ;
6. vérifier les quatre combinaisons ;
7. confirmer que `vite build` n'embarque ni Puppeteer ni Chromium dans le bundle client.

**Sortie :** la phrase « choisir un modèle, choisir un jeu de données, télécharger le PDF » est
vraie dans le playground local.

### INC-7 — ADR, recette visuelle et clôture

1. finaliser l'ADR 0012 avec résultats des sondes, décisions corrigées par l'exécution et limites ;
2. consigner la version Puppeteer/Chromium et la politique sRGB effectivement observée ;
3. exécuter la recette humaine des deux apparences ;
4. rejouer les preuves d'ablation du §8 ;
5. passer les quatre portes dans l'ordre exact ;
6. mettre à jour la roadmap moteur et le jalon J2 seulement si toutes les preuves sont vertes ;
7. marquer ce plan périmé avec un lien vers l'ADR livrée et les corrections réelles.

**Sortie :** E1 livré, J2 démontré, E2 peut commencer sur un pipeline réel.

---

## 8. Preuves d'ablation

Avant clôture, appliquer puis restaurer chaque mutation locale. Un test précis doit rougir :

| Mutation temporaire | Échec attendu |
| :--- | :--- |
| recréer un budget pour chaque liaison | test cumulatif de limite entre bande et racine |
| remplacer `parseTemplate` par une confiance dans le type | fixture v1 ou modèle brut invalide |
| sérialiser `undefined` en chaîne vide | test `missing-binding-value` |
| faire `JSON.stringify` d'un objet lié | test `non-printable-binding-value` |
| rendre `exceptLast` sur l'unique page | assertion de bande `lastOnly` et mention légale |
| recalculer l'aire imprimable localement dans le moteur | cas Letter décimal comparé à `printableAreaOf` |
| employer `pt * 25.4 / 72` au lieu de `mmFromPt` | valeur témoin dont les doubles divergent |
| arrondir une largeur de colonne à deux décimales | colonne légale très étroite devenue zéro ou somme 99,99 % |
| additionner deux filets adjacents | sonde de conflit D11 |
| retirer l'échappement d'un texte `</span><script>` | test de sérialisation et absence de script |
| autoriser une URL HTTP | test d'interception et source non supportée |
| omettre `printBackground` | test de fond/couleur sur PDF réel |
| omettre `preferCSSPageSize` | dimension personnalisée remplacée par Letter |
| masquer le débordement sans le mesurer | fixture trop longue acceptée ou PDF tronqué |
| ne pas attendre le décodage de l'image | test image corrompue ou dimensions nulles |
| retirer un `await` de fermeture | test de processus/ressource encore vivant |
| importer l'adaptateur depuis `engine` | lint d'architecture ou inspection du graphe/package |
| envoyer le modèle brut du navigateur au pont Vite | test de protocole limité aux ids |

Chaque mutation est restaurée immédiatement et suivie d'un `git diff` ciblé. Aucun reset, nettoyage
global ou écrasement de changements utilisateur n'entre dans ce protocole.

---

## 9. Définition de fini

E1 est livré seulement lorsque toutes les affirmations suivantes sont vraies :

- `@openview/engine` implémente un `RenderPort` PDF public et ne dépend pas de Puppeteer ;
- Puppeteer vit dans `@openview/adapter-puppeteer`, paquet distinct et optionnel ;
- le pipeline exécute validation, liaison, DOM, sanitization et export dans cet ordre ;
- le modèle est borné, migré et validé une fois à l'entrée ;
- `RenderRequest.data` n'a aucun schéma Openview et aucun nom réservé ;
- un budget d'évaluation unique couvre bandes et racine ;
- les huit nœuds et les trois segments sont traités exhaustivement ;
- totaux, agrégations, dates et arrondis viennent exclusivement des expressions du modèle ;
- une liaison visible absente ou non imprimable est refusée avec chemin/id et sans fuite ;
- la première page est traitée aussi comme dernière, avec la bonne bande et des marqueurs à `1` ;
- feuille, marges et aire imprimable viennent du contrat, `MAX_SHEET_MM` ayant été sondé ;
- les défauts typographiques, le sRGB, la justification, les filets et l'image ont une politique
  écrite et testée ;
- le logo bitmap est rendu à la largeur de son parent, avec son ratio intrinsèque ;
- aucun HTML libre, script, URL réseau ou fichier local n'est exécutable ;
- un contenu trop long, une bande trop haute ou une image surdimensionnée échoue sans troncature ni
  boucle ;
- `page.pdf()` reçoit une taille CSS prioritaire, imprime les fonds et ne décide aucun format ;
- le résultat est un PDF lisible d'exactement une page et aux dimensions déclarées ;
- succès comme échec ferment page, contexte et navigateur avec des promesses attendues ;
- les deux apparences et les deux données de recette passent automatiquement ;
- le playground permet réellement sélection puis téléchargement sous `pnpm dev` ;
- le bundle client du playground ne contient ni Puppeteer ni Chromium ;
- aucune version 9, migration, clé de données, règle métier, formatage E4 ou pagination E2 n'a été
  ajouté par glissement ;
- les dépendances et éventuelles dérogations supply-chain sont justifiées ;
- l'ADR d'E1 fait foi, la roadmap marque J2 atteint et le présent plan est marqué périmé ;
- lint, build, type-check et couverture passent dans l'ordre de la CI.

---

## 10. Risques et arbitrages différés

### Le plafond de feuille peut être incompatible avec Chromium

C'est le seul risque capable de rouvrir un contrat `core` avant tout code métier du moteur. Le plan
ne préjuge pas du résultat : il exige la sonde sur la version retenue et interdit tout clamp
silencieux. Une incompatibilité devient un arbitrage produit explicite sur `MAX_SHEET_MM`.

### `sans-serif` n'est pas une fonte déterministe

Le défaut rend E1 utilisable mais peut changer de glyphes selon la machine. E6 doit embarquer ou
résoudre un corpus de polices déterministe et fixer les noms absents. E1 ne masque pas cette limite
avec une assertion d'égalité binaire qu'il ne peut pas tenir.

### Chromium reste une surface complexe avant E8

E1 réduit la surface à du HTML fermé, JavaScript désactivé, images bitmap `data:` et zéro réseau.
Cela rend la facture locale raisonnable, pas le service public. E8 reste obligatoire avant J5 pour
les ressources distantes, DNS, timeouts, mémoire, concurrence et documents hostiles.

### La restriction d'image est plus étroite que le contrat

Un `ImageNode` HTTP ou une clé d'actif peut être valide dans `core` et refusé par cet adaptateur E1.
C'est une capacité d'adaptateur, pas une invalidité du modèle. E8 devra introduire le canal de
résolution sans ajouter de clé au jeu de données ni de troisième champ métier au `RenderRequest`.

### La couleur PDF dépend du chemin Chromium

Le CSS est sRGB, les ajustements d'impression sont forcés, mais le profil ou l'espace réellement
écrit dans le PDF doit être observé. L'ADR E1 consigne le résultat de la sonde et la limite de chaîne
d'impression ; V3 vérifiera la parité raster, E6 la reproductibilité.

### Une représentation HTML n'est pas un format de sortie HTML

`PdfSourceDocument` est un contrat entre moteur et adaptateur, pas un `RenderResult` HTML. Le rendre
public comme document final contournerait sanitization, pagination et la décision PDF-only. Un
futur format HTML devra avoir son propre critère et sa propre stratégie.

### Le pont Vite n'est pas le service de rendu

Il connaît un catalogue local fermé, ne reçoit que deux ids et n'existe que sous `pnpm dev`. Le
faire accepter des modèles arbitraires ou le déployer transformerait E1 en service non durci et
violerait l'ordre E8 → S1.

### La politique de valeur absente est un rétrécissement de rendu, pas de schéma

Un modèle peut rester valide tout en échouant sur un jeu de données incomplet. C'est voulu pour une
position visible : un blanc plausible dans un montant est plus dangereux qu'un refus. Le
contournement explicite par `isEmpty`, `if` ou `condition` reste disponible et doit être documenté
dans l'ADR puis dans E9.

---

## 11. Contrôle de périmètre avant exécution

Avant INC-0 :

1. vérifier le worktree et préserver tous les changements utilisateur sans rapport ;
2. confirmer que `CURRENT_SCHEMA_VERSION` vaut toujours 8 et que l'ADR 0012 est libre ;
3. confirmer que `packages/engine` est encore une coquille et qu'aucun adaptateur concurrent n'a
   été ajouté ;
4. relire les éventuels amendements récents des ADR 0003, 0004, 0006, 0007, 0009 et 0011 ;
5. confirmer que la roadmap n'a pas déplacé HTML, image, formatage ou pagination dans E1 ;
6. relever la version Node/pnpm et la version stable de Puppeteer disponible ;
7. inspecter le lockfile et la fenêtre `minimumReleaseAge` avant toute installation ;
8. vérifier que la fixture du playground compile et que ses deux apparences sont toujours la source
   de référence ;
9. confirmer qu'aucune modification de `tsconfig*`, Biome, Turbo, Vitest, CI ou seuil n'est
   nécessaire ;
10. si une forme persistée de `core` a changé, arrêter, recalculer migrations, fixtures et surface
    avant toute écriture E1 ;
11. si un autre adaptateur est déjà planifié/livré, réévaluer le nom du port et éviter deux
    abstractions concurrentes ;
12. n'ouvrir l'implémentation qu'une fois les sondes de capacité décrites à INC-0 reproductibles.

Ce contrôle protège la nature d'E1 : le premier PDF doit être une consommation fidèle du contrat
livré, pas l'endroit où le moteur réécrit silencieusement ce qu'il aurait préféré recevoir.

# ADR 0012 — Une facture d'une page sort en PDF

- **Statut :** 🟢 **Accepté** (2026-08-21), implémenté dans `@openview/engine` et
  `@openview/adapter-puppeteer`
- **Date :** 2026-08-21
- **Impact :** `@openview/core` (**intact** : aucun champ, aucun kind, aucune migration ;
  `CURRENT_SCHEMA_VERSION` reste **8** et `TEMPLATE_MIGRATIONS` reste à **sept** entrées),
  `@openview/engine` (le pipeline complet, la façade `createPdfRenderPort`, le vocabulaire HTML
  fermé, `DocumentRenderError` et ses **dix** codes), `@openview/adapter-puppeteer`
  (**paquet nouveau**, Chromium derrière la stratégie), `apps/playground` (la facture extraite du
  monolithe, un pont de développement et un panneau de téléchargement),
  `@openview/designer` et `@openview/viewer` (**intacts**)
- **Ferme :** [ADR 0001](0001-expression-language.md) question 2 (la valeur absente et la valeur
  non imprimable à une position visible) ; [ADR 0006](0006-la-page.md) sur la première page qui est
  aussi la dernière, et son plafond `MAX_SHEET_MM` désormais **sondé** ;
  [ADR 0007](0007-l-apparence.md) attentes 3 à 8 (défauts typographiques, sRGB, conversion pt,
  rencontre de filets, justification, image sans dimension) ; [ADR 0009](0009-les-blocs-insecables.md)
  pour le refus `oversized-atomic-resource`
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, les `tsconfig.base.json`, `biome.jsonc`,
  les plugins GritQL, `turbo.json`, `sonar-project.properties`, les workflows et la configuration
  Vitest sortent du lot **inchangés** — y compris les seuils de couverture. Trois fichiers de
  gouvernance changent, et chacun pour enregistrer le paquet nouveau : `tsconfig.json` racine
  (une référence de projet), `pnpm-workspace.yaml` (`allowBuilds: puppeteer`) et
  `apps/playground/package.json` (une dépendance et un second passage TypeScript).
- **Plan d'implémentation :**
  [docs/plans/e1-une-facture-d-une-page-sort-en-pdf.md](../plans/e1-une-facture-d-une-page-sort-en-pdf.md)
  — **périmé** une fois le lot livré. C'est cette ADR qui fait foi, et elle **corrige** son plan
  sur six points nommés au [§ Ce que l'exécution a corrigé du plan](#ce-que-lexécution-a-corrigé-du-plan).
- **Implémentation :**
  [`engine/src/pipeline/render-pdf.ts`](../../packages/engine/src/pipeline/render-pdf.ts) (la
  façade et l'ordre des cinq étapes),
  [`engine/src/pipeline/validate.ts`](../../packages/engine/src/pipeline/validate.ts),
  [`engine/src/document/`](../../packages/engine/src/document/) (matérialisation, politique
  d'impression, bandes, typographie, images),
  [`engine/src/html/`](../../packages/engine/src/html/) (vocabulaire fermé, échappements, CSS,
  conflit de filets, sérialisation),
  [`engine/src/errors.ts`](../../packages/engine/src/errors.ts),
  [`adapter-puppeteer/src/`](../../packages/adapter-puppeteer/src/) (capacités, sources d'image,
  mesure, stratégie),
  [`playground/src/examples/reference-invoice.ts`](../../apps/playground/src/examples/reference-invoice.ts),
  [`playground/dev/render-bridge.ts`](../../apps/playground/dev/render-bridge.ts)

---

## Contexte

La vague 1 de `@openview/core` a livré huit contrats — expressions, liaisons, tableau, page,
apparence, écritures, blocs insécables, refus lisibles — et **aucun document**. `@openview/engine`
ne contenait qu'une constante de version. Le playground démontrait le contrat dans React, ce qui
prouve qu'il est consommable, jamais qu'il est imprimable.

Ce lot produit le premier document réel, et il a une propriété que les huit précédents n'avaient
pas : il **dépend d'un logiciel externe**. Chromium honore ou non une feuille, additionne ou non
deux filets adjacents, imprime ou non un fond. Une décision de conception prise sans le mesurer
serait une hypothèse déguisée en contrat, et c'est pourquoi ce lot a commencé par des sondes
bloquantes plutôt que par du code de production.

Trois de ces sondes ont **contredit le plan**. Elles sont consignées telles quelles ci-dessous :
c'est le seul intérêt d'une porte de décision.

---

## Ce que le lot n'est pas

- **Ce n'est pas une pagination.** Un contenu qui ne tient pas sur la feuille déclarée est
  **refusé**, jamais tronqué, jamais réduit à l'échelle, jamais laissé à Chromium sous la forme
  d'une seconde page silencieuse. La seconde page appartient au lot suivant.
- **Ce n'est pas un formatage.** Un nombre s'imprime dans sa forme canonique — `String(value)` —
  sans locale et sans arrondi implicite. Reconnaître un total comme de l'argent réserverait un sens
  métier ; les sites de mise en forme appartiennent au lot qui les possède.
- **Ce n'est pas une promesse de déterminisme binaire.** Chromium écrit son propre titre, son agent
  utilisateur et **deux horodatages** dans le dictionnaire d'information du PDF, et `sans-serif`
  désigne une police de l'hôte. Le lot le mesure et l'écrit ici plutôt que de l'assurer.
- **Ce n'est pas un service de rendu.** Le pont du playground connaît un catalogue fermé, ne reçoit
  que deux identifiants et n'existe que sous `pnpm dev`.
- **Ce n'est pas un durcissement.** Zéro requête sortante, JavaScript désactivé et images `data:`
  uniquement rendent une facture locale raisonnable, pas un service exposé.

---

## Les sondes de capacité, et ce qu'elles ont dit

Toutes sur **puppeteer 25.6.0** (publié le 2026-08-11) et **Chromium 151.0.7922.77**. Les scripts
étaient jetables et ont été supprimés ; seules leurs conclusions survivent, et chacune est
désormais tenue par un test.

### La porte `MAX_SHEET_MM` : passée

| Feuille déclarée (mm) | Attendu (pt) | Obtenu (pt) | Écart (pt) |
| :--- | :--- | :--- | :--- |
| 210 × 297 | 595,276 × 841,890 | 594,960 × 841,920 | −0,3156 / +0,0302 |
| 215,9 × 279,4 | 612,000 × 792,000 | 612,000 × 792,000 | 0 / 0 |
| 279,4 × 215,9 | 792,000 × 612,000 | 792,000 × 612,000 | 0 / 0 |
| **5080 × 5080** | 14400 × 14400 | **14400,000 × 14400,000** | **0 / 0** |
| **1 × 1** | 2,835 × 2,835 | 3,120 × 3,120 | +0,2854 / +0,2854 |
| 1 × 5080 | 2,835 × 14400 | 3,120 × 14400,000 | +0,2854 / 0 |
| 5080 × 1 | 14400 × 2,835 | 14400,000 × 3,120 | 0 / +0,2854 |
| 123,45 × 234,56 | 349,937 × 664,894 | 349,920 × 665,040 | −0,0170 / +0,1455 |

Chromium honore **toute** l'étendue que le contrat autorise, aux quatre combinaisons des deux
bornes. La borne C4 n'avait donc pas à être rouverte, et aucun clamp silencieux n'a été introduit.

**Ce que la table apprend en plus :** la boîte de page PDF est **quantifiée à 0,24 pt, soit 1/300
de pouce** — les huit résultats sont des multiples exacts de 0,24. L'écart maximal observé est
**0,3156 pt ≈ 0,11 mm**. La tolérance retenue pour les tests structurels est **0,5 pt**, et elle
est nommée `SHEET_TOLERANCE_PT` dans l'adaptateur plutôt que recopiée dans chaque assertion.

`preferCSSPageSize: false` sur une feuille de 123,45 × 234,56 mm produit **612 × 792 pt**, soit du
Letter. L'option n'est pas une précaution : sans elle l'adaptateur déciderait un format.

### Le filet adjacent : `border-collapse: collapse` ne reproduit pas la règle

| Cas | Règle attendue | Chromium 151 |
| :--- | :--- | :--- |
| recouvrement, jamais addition | les boîtes voisines ne s'écartent pas | ✅ écart mesuré 0 px |
| le plus large gagne (0,4 vs 1,2, dans les deux sens) | le large est peint | ✅ |
| égalité rangée / rangée | la rangée **suivante** gagne | ❌ **la précédente gagne** |
| égalité table / rangée au périmètre | la **table** gagne | ❌ **la cellule gagne** |

Chromium applique la résolution CSS 2.1 : le plus large, puis la boîte la plus **locale**, puis
l'ordre du document. Deux des cinq règles voulues ne sont donc pas reproductibles par `collapse`.
Le plan avait prévu ce cas et sa réponse : le DOM **synthétise** la frontière, la règle ne plie pas.
C'est la décision D-4 ci-dessous.

### `printBackground` n'est pas la seule ligne de défense

- `printBackground: true` + `#1b3a6f` → `.1059 .2275 .4353 rg` dans le flux de contenu, en
  **DeviceRGB nu** : les composantes sRGB traversent inchangées et **aucun profil ICC** n'est
  écrit dans le PDF.
- `printBackground: false` **sans** `print-color-adjust` → le fond **disparaît**.
- `printBackground: false` **avec** `print-color-adjust: exact` → le fond **reste**.

Les deux mécanismes sont donc chacun suffisants sous Chromium 151. L'option reste passée parce
qu'elle est le commutateur documenté, mais elle n'est pas ce qui garantit le fond, et cette ADR le
dit plutôt que de laisser croire à une redondance protectrice. La preuve d'ablation
correspondante porte donc sur **l'objet d'options**, pas sur un pixel.

### Le reste, sans surprise

- **Justification :** `text-align: justify` donne `text-align-last: auto`, `letter-spacing: normal`,
  une première ligne à la largeur exacte de la boîte et une dernière ligne plus courte. La dernière
  ligne reste à `start` et le résidu est réparti entre les mots, comme l'ADR 0007 le voulait.
- **Image :** un PNG 4 × 2 réel donne `naturalWidth/Height = 4 × 2` et un rendu dont le ratio
  s'écarte de **2,07 × 10⁻⁴** — l'arrondi sous-pixel, rien de plus.
- **Image corrompue :** `complete` vaut **`true`** dans les deux cas. Seuls `naturalWidth`,
  `naturalHeight` et le rejet de `img.decode()` distinguent un décodage manqué. Le contrôle porte
  donc sur les dimensions, jamais sur `complete`.
- **Script et mesure :** avec `setJavaScriptEnabled(false)`, un `<script>` du document **ne
  s'exécute pas** et `page.evaluate` **fonctionne quand même**. Le document reste inerte pendant que
  l'adaptateur le mesure — ces deux exigences ne s'opposent pas.
- **Réseau :** une requête `http://169.254.169.254/...` est vue puis avortée ; une URI `data:` ne
  produit aucune requête.
- **Fermeture :** après `browser.close()`, `browser.connected` vaut `false`.
- **Typographie par défaut mesurée :** `sans-serif`, `10 pt` → `13,3333 px`, poids `400`.

---

## Les décisions

### D-1 — Deux paquets, une dépendance dans un seul sens

```text
@openview/core
      ↑
@openview/engine  ←  @openview/adapter-puppeteer
      ↑                         ↑
      └──────── apps/playground ┘
```

`@openview/engine` ne dépend que de `@openview/core`. Puppeteer vit dans
`@openview/adapter-puppeteer`, seul paquet à télécharger un navigateur. Aucun type Puppeteer,
Chromium ou DOM ne traverse le barrel de `engine`, et `noRestrictedImports` le tient : la mutation
qui importe Puppeteer depuis `engine/src/index.ts` est refusée par `pnpm run lint`.

**Le DOM est typé dans l'adaptateur, et là seulement.** C'est le seul paquet qui exécute du code
*dans* Chromium par `page.evaluate`, donc `lib: ["ES2022", "DOM"]` y est correct. `core` et
`engine` n'en déclarent aucun, et c'est cela — non un commentaire — qui garde le navigateur hors du
pipeline.

### D-2 — Une façade PDF, et une stratégie qui ne voit ni données ni AST

```ts
export function createPdfRenderPort(
  strategy: PdfRenderStrategy,
  options?: RenderEngineOptions | undefined,
): RenderPort;
```

La stratégie reçoit un `PdfSourceDocument` et rien d'autre. Le plan le décrivait comme
`{ html, sheet }` ; l'exécution a dû lui ajouter **un troisième champ**, et c'est la première
correction de cette ADR :

```ts
export interface PdfSourceDocument {
  readonly html: string;
  readonly sheet: Sheet;
  readonly images: readonly DocumentImage[];
}
```

**Pourquoi.** Le plan exige que les sources d'image non supportées soient « refusées **avant**
chargement ». Une stratégie qui ne reçoit qu'une chaîne HTML devrait la parser pour connaître ses
`<img>`, ou attendre le chargement pour constater l'échec — c'est-à-dire refuser trop tard. Le
manifeste d'images est la donnée minimale qui rend le refus possible au bon moment. Il ne porte
aucune valeur de l'hôte : un `nodeId`, un chemin de modèle, une source. Ce que le plan interdisait —
les données, le modèle, l'AST — reste dehors.

Il n'y a ni registre multi-format, ni `HtmlRenderStrategy` vide, ni `ImageRenderStrategy` vide. Le
point de stratégie se justifie par le second paquet réel, pas par une symétrie à venir.

### D-3 — Un Pipeline, cinq transformations, aucune interruption silencieuse

```text
RenderRequest → ValidationStep → DataBindingStep → DomBuildStep → SanitizeStep → PdfExportStep
```

Les cinq étapes s'exécutent à chaque rendu. Aucune ne porte de `next()` et aucune ne décide
d'arrêter la chaîne : un refus est une exception typée, un succès a traversé les cinq. Un test
prouve que la stratégie est appelée **exactement une fois** et jamais quand une étape antérieure
refuse.

`ValidationStep` appelle `parseTemplate` même quand le type statique annonce déjà un `Template` :
le type est une promesse faite au compilateur, pas à un appelant JavaScript. La preuve d'ablation
« faire confiance au type » rougit sur la fixture v1.

### D-4 — Le filet est résolu par le moteur, jamais par le navigateur

Chromium ne reproduisant pas deux des cinq règles, `DomBuildStep` **assigne chaque frontière à une
seule boîte** et la peint là. La table est en `border-collapse: separate; border-spacing: 0`, et la
résolution est la suivante — les rangées d'un tableau formant **une seule séquence** ordonnée à
travers l'en-tête, le corps et le pied :

| Frontière | Qui la peint |
| :--- | :--- |
| entre deux rangées | le `bottom` de la précédente si **strictement** plus large, sinon le `top` de la **suivante** |
| haut / bas du périmètre | le filet de la rangée extrême **seulement s'il est strictement plus large** que celui de la table |
| gauche / droite du périmètre | idem, par rangée, sur la première et la dernière cellule |

Les deux fonctions sont **complémentaires par construction** : `>= ` d'un côté, `>` de l'autre.
Exactement une des deux boîtes d'une frontière peint, jamais zéro ni deux, et un test balaie les
cinq combinaisons de largeurs pour le prouver. La table peint ses quatre arêtes déclarées sans
condition : ses bandes courent sur toute sa longueur, et une rangée qui l'a battue peint par-dessus
une bande **strictement** plus large.

**Le plan portait une contradiction, et cette ADR la tranche.** Sa règle 3 donnait l'égalité à la
boîte la plus locale (« `row` avant `table` ») et sa règle 5 la donnait à la table au périmètre.
Dans le contrat livré, la seule paire concrète au périmètre est précisément *table contre rangée* :
les deux règles s'y contredisent. La règle **spécifique** l'emporte — au périmètre, la table gagne
l'égalité — et la règle 3 reste l'énoncé général pour une paire qu'un contrat futur introduirait.

### D-5 — Un filet se peint à l'intérieur de la boîte, en ombre insérée

Le modèle de boîte de l'ADR 0007 réserve la formule de largeur au `padding`. Une bordure CSS y
entre, et deux bordures voisines s'additionnent. Tous les `BoxStyle.border` sont donc peints en
`box-shadow: inset`, ce que la sonde a validé sur trois points : l'ombre atteint le PDF, elle ne
consomme **aucune place** (hauteur extérieure 33,094 px avec, 33,094 px sans, contre 41,094 px pour
une bordure CSS de même largeur), et deux bandes voisines ne s'additionnent pas.

**La conséquence, mesurée puis assumée :** une bande insérée est peinte **dans** la boîte, donc une
boîte qui déclare un filet et **aucun padding** peint son filet par-dessus sa propre dernière ligne
de texte. La recette visuelle l'a trouvé sur la bande d'en-tête de l'apparence B, et la fixture
déclare désormais son padding. L'alternative — réserver la place du filet — ferait entrer la bordure
dans la formule de largeur, ce que l'ADR 0007 refuse. La règle est donc : **une boîte qui déclare un
filet déclare aussi son padding.**

### D-6 — Une liaison visible absente ou non imprimable fait échouer le rendu

| Valeur évaluée | Comportement |
| :--- | :--- |
| `string` | imprimée telle quelle |
| nombre fini | `String(value)`, sans locale ni arrondi |
| `null` / `undefined` | refus **`missing-binding-value`** |
| booléen, non fini, liste, objet, fonction, symbole, `bigint` | refus **`non-printable-binding-value`** |

Le refus porte le `nodeId`, le **chemin exact du segment** et un `actualType` du vocabulaire fermé
de `core` — jamais la valeur. Le moteur n'imprime donc ni `undefined`, ni `[object Object]`, ni un
JSON inventé. Les deux politiques déjà tranchées par `core` restent inchangées et ne sont pas
réimplémentées : une condition absente vaut faux par `requireBoolean`, une séquence absente donne
zéro occurrence par `evaluateSequence`.

C'est un **rétrécissement de rendu, pas de schéma** : un modèle reste valide et peut échouer sur un
jeu de données incomplet. C'est voulu à une position visible — un blanc plausible dans un montant
est plus dangereux qu'un refus — et le contournement explicite (`isEmpty`, un `if` produisant une
chaîne vide, une `condition` autour du bloc) est nommé dans le message du refus lui-même.

### D-7 — Une feuille mono-page, pas un flux que Chromium pagine

Une seule boîte `.ov-page` aux dimensions exactes de `Template.page.sheet`, `@page` aux mêmes
dimensions et marges d'impression du navigateur à zéro. Une boîte `.ov-printable` positionnée aux
quatre marges du modèle et dimensionnée par **`printableAreaOf`** — jamais par une soustraction
réécrite. Trois régions verticales : bande haute, flux racine, bande basse.

Pour `page = 1` et `count = 1` :

| Occurrence | Applicable |
| :--- | :--- |
| `every` | oui |
| `firstOnly` | oui |
| `exceptFirst` | **non** |
| `exceptLast` | **non** |
| `lastOnly` | oui |

Tous les `pageField` rendent `1`, dans les trois régions. `overflow: hidden` sur la feuille est une
**dernière** barrière contre une seconde page, jamais le garde : la mesure a réussi avant.

### D-8 — Des défauts typographiques explicites, sans cascade

| Propriété | Défaut |
| :--- | :--- |
| famille | `sans-serif` |
| taille | `10 pt`, convertis par `mmFromPt` |
| graisse | `400` |
| style | `normal` |
| couleur | `#000000` |
| alignement sans bloc ni colonne | `start` |

Appliqués **run par run** sur le segment sérialisé, jamais hérités d'un conteneur du DOM. Un run
garde la précédence sur son bloc ; l'alignement du bloc garde la précédence sur celui de la colonne,
par `resolveTextAlign`.

`system-ui` est délibérément **absent** de la liste des familles génériques : il désigne la police
d'interface de l'hôte, c'est-à-dire la machine. Un modèle qui le nomme obtient un nom de famille
entre guillemets, que rien ne satisfait, et le navigateur replie.

Le générique `sans-serif` reste une **dette de déterminisme** : il rend un document imprimable, pas
identique entre deux machines.

### D-9 — Ce que l'adaptateur accepte, et ce qu'il refuse avant de lancer un navigateur

Accepté : `data:image/png;base64`, `data:image/jpeg;base64`, `data:image/webp;base64`.
Refusé : HTTP(S), chemin, clé d'actif, `file:`, SVG, tout autre type MIME — et la feuille hors de
l'étendue sondée, par `adapter-capability-mismatch`.

Ces deux refus surviennent **avant** `puppeteer.launch`, et un test le prouve en observant que
`launch` n'est pas appelé. C'est une **capacité d'adaptateur**, pas une invalidité du modèle : un
`ImageNode` HTTP reste valide pour `core` et le restera.

### D-10 — La sûreté vient d'un vocabulaire fermé, pas d'un nettoyage

Onze noms d'élément (`div`, `span`, `img`, `table`, `colgroup`, `col`, `thead`, `tbody`, `tfoot`,
`tr`, `td`), six noms d'attribut, tous choisis par le moteur. Le texte et les attributs sont
échappés séparément ; une famille de police passe par un échappement CSS qui remplace tout ce qui
n'est ni lettre, ni chiffre, ni `_ - . ` ou espace par une séquence `\hh `, de sorte qu'un `;` ne
peut pas ouvrir une seconde déclaration ni un `"` fermer la valeur. **Aucun texte du modèle n'entre
dans un bloc `<style>`**, ni dans un nom d'élément, ni dans un nom d'attribut.

La CSP du document : `default-src 'none'` ; `img-src data:` ; `style-src 'unsafe-inline'` ; et
`script-src`, `connect-src`, `font-src`, `media-src`, `object-src`, `frame-src`, `base-uri`,
`form-action` explicitement à `'none'`. `'unsafe-inline'` sur les styles est la seule exception, et
elle n'est pas une concession : le moteur construit chaque déclaration depuis des champs validés, et
un document statique ne peut garder aucun nonce secret.

Aucune dépendance de nettoyage n'a été ajoutée : Openview ne reçoit aucun HTML libre et n'a donc pas
à construire une chaîne dangereuse pour la laver ensuite.

### D-11 — Des erreurs typées, sans fuite

Dix codes : `template-refused`, `expression-refused`, `missing-binding-value`,
`non-printable-binding-value`, `unsupported-image-source`, `image-load-failed`,
`oversized-atomic-resource`, `single-page-overflow`, `pdf-export-failed`,
`adapter-capability-mismatch`.

Chaque refus porte les seuls détails sûrs qui ont un sens : `nodeId`, chemin, `actualType`, région,
limite, et les diagnostics structurés de `core` quand `diagnosticsOf` les reconnaît. Le message est
**constant par site**. Une erreur inconnue voyage en `cause` et n'est jamais résumée dans le
message : un test l'exerce avec une cause contenant un montant et vérifie que le montant n'apparaît
nulle part.

### D-12 — Un navigateur par rendu, fermé dans un `finally`

Page, contexte et navigateur sont fermés avec un `await` explicite, à chaque succès et à chaque
famille d'échec. Ce choix privilégie l'absence de fuite et une sémantique sans état partagé au
débit ; la mise en commun, la concurrence et les délais appartiennent au durcissement.

Les options d'impression sont **toutes** énoncées : `preferCSSPageSize: true`,
`printBackground: true`, `displayHeaderFooter: false`, `scale: 1`, `waitForFonts: true`. Ni `path`,
ni `format`. L'interception réseau est installée **avant** `setContent`, son handler reste
synchrone et vérifie `isInterceptResolutionHandled`.

### D-13 — Le pont du playground n'est pas un service de rendu

`GET /__openview/render-catalog` rend des identifiants et des libellés.
`POST /__openview/render-pdf` accepte **deux identifiants** et rien d'autre. Une méthode
inattendue, un corps illisible ou un identifiant inconnu sont refusés **avant** que le moteur soit
appelé : vérifié en direct, un corps portant un modèle brut ressort en **404**. Un refus connu
ressort en JSON avec son `code` et son `message`, jamais avec la cause, le HTML, le modèle, les
données ni `details`.

Le plugin est monté avec `apply: 'serve'`. C'est ce qui garantit qu'aucun code de l'adaptateur
n'entre dans le bundle client : le seul import de `@openview/adapter-puppeteer` de l'application
vit dans la configuration du serveur de développement. La logique elle-même vit dans
`dev/render-bridge.ts`, avec **son propre passage TypeScript** — un pont que rien ne compile est
exactement le serveur non testé que le plan refusait.

---

## Ce que le lot mesure

**1 053 tests** passent, dont 98 pour `@openview/engine` et 48 pour l'adaptateur, ces derniers
contre un **Chromium réel** — jamais sautés en silence : l'absence du binaire est un échec
d'installation explicite.

### Sans navigateur (`@openview/engine`)

- **Façade :** format du port, `RenderResult` exact, stratégie appelée une seule fois et après les
  quatre premières étapes, jamais appelée si une étape refuse, erreur arbitraire encapsulée avec sa
  cause et sans son message, refus déjà nommé transmis inchangé, bornes de forme et d'évaluation
  appliquées comme options du moteur.
- **Validation :** modèle courant accepté, modèle v1 réellement historique migré et contenu
  conservé, version future refusée avec un diagnostic de migration, champ invalide refusé avec un
  diagnostic par problème, garde de forme appliquée avant toute récursion, aucun contenu de modèle
  dans le message.
- **Budget :** un seul budget traverse bande haute → racine → bande basse, et la borne franchie
  dans la bande basse le prouve.
- **Impression :** texte et nombre fini imprimés, huit familles de valeurs refusées, chemin et
  `nodeId` désignant exactement la liaison fautive, aucune valeur dans le refus, ordre des segments
  sans séparateur inventé.
- **AST :** les huit types de nœud exercés, boucles imbriquées gardant leur portée, condition
  absente et séquence absente ne produisant rien, ligne courte rendue vide sans remplissage,
  cellule retrouvée par `columnId` malgré un ordre différent, bloc imbriqué dans une cellule,
  poids dissymétriques non arrondis à zéro, modèle et données non mutés.
- **Page :** la matrice complète des cinq occurrences, les marqueurs à `1` dans les trois régions,
  `printableAreaOf` comme dépendance sur un cas Letter décimal **et asymétrique**, aucune A4
  implicite, `keepTogether` sans effet sur un succès mono-page.
- **HTML :** échappement des cinq caractères de balisage en texte comme en attribut, famille de
  police hostile réduite à une chaîne CSS, absence de `<script>`, de handler `on*`, d'iframe et de
  toute URL réseau, CSP attendue, sérialiseur déterministe et ordre d'attributs fixe.

### Avec Chromium (`@openview/adapter-puppeteer`)

Document minimal en un PDF lisible d'une page ; A4, Letter paysage par dimensions inversées et
feuille personnalisée honorées à moins de 0,5 pt ; fond `#1b3a6f` retrouvé dans le flux de contenu ;
options d'impression épinglées ; bitmap embarqué décodé ; image corrompue, image trop haute,
débordement du flux, bande surdimensionnée et bloc peignant hors feuille tous refusés avec leur
code propre ; jamais de seconde page ; sept familles de sources d'image refusées avant tout
lancement ; script du document inerte ; requête injectée avortée ; navigateur fermé après succès
**et** après refus.

### La facture de recette, de bout en bout

Le document d'acceptation est rendu dans **les quatre combinaisons** de ses deux apparences et de
ses deux jeux de données, et chacune sort en **une page A4** aux dimensions déclarées. Les
oracles : les figures calculées (`60`, `6`, `54`, `2026-02-19`, `2026-02-28`) présentes et aucun
nœud d'expression ni alias de boucle restant ; une rangée matérialisée par élément du jeu choisi ;
la condition fausse ne produisant aucun bloc ; les marqueurs à `1` et la bonne bande de dernière
page ; les filets adjacents comptés **exactement** (15 bandes de 1,2 mm dans un sens, 5 et 10 dans
l'autre, et jamais 1,48 mm) ; le titre basculant sur une donnée ; le logo comme seule image et
embarqué ; ni modèle ni données mutés. Puis les mutations d'échec : donnée manquante, objet lié,
logo corrompu, corps trop long.

**Deux vocabulaires, et c'est voulu.** La facture du playground porte les noms d'une application
intégratrice (`commande`, `lignes`, `societe`) ; le document d'acceptation automatisé porte les
siens (`order`, `rows`, `issuer`). Aucun nom du premier n'apparaît dans `packages/engine` ni dans
l'adaptateur, et c'est vérifiable au `grep` — ce qui est précisément la propriété que le plan
exigeait.

---

## La recette visuelle

Exécutée sur les quatre combinaisons, en rastérisant la page préparée à l'échelle A4.

| Point | Résultat |
| :--- | :--- |
| logo net, ratio respecté | ✅ |
| aucun texte coupé, chevauché ou sorti des marges | ✅ après correction de la fixture |
| colonnes alignées entre en-tête, corps et pied | ✅ |
| fonds et couleurs proches des valeurs sRGB déclarées | ✅ |
| typographies et emphases visibles | ✅ après correction de la fixture |
| filets adjacents conformes à D-4 | ✅ un seul trait, le plus large |
| facture lisible à 100 % | ✅ |
| les deux apparences nettement distinctes | ✅ cadre marine serif contre filets rouille sans-serif |
| nom de fichier explicite au téléchargement | ✅ `openview-apparence-a-trois-lignes.pdf` |

**La recette a trouvé trois défauts, tous dans la fixture et aucun dans le moteur.**

1. **Le logo occupait un tiers de la page.** Le comportement est correct — une image sans dimension
   déclarée prend la largeur de contenu de son parent — mais **le contrat d'apparence ne porte
   aucune largeur de boîte**, donc la seule façon d'en contraindre une aujourd'hui est un **poids
   de colonne**. La bande porte désormais un tableau à deux colonnes, ce qui est la réponse d'un
   auteur de modèle. Le manque d'une largeur sur une boîte est consigné plus bas comme ouvert.
2. **Le filet de la bande recouvrait sa propre dernière ligne de texte** — la conséquence de D-5,
   corrigée par un padding déclaré.
3. **Deux colonnes voisines se touchaient** et les libellés du tableau sortaient dans le défaut du
   moteur, visiblement différents du corps. Les deux sont ce que la fixture déclarait ; elle
   déclare maintenant un padding de ligne et une typographie explicite.

Le parcours complet a été vérifié sous `pnpm dev` : les deux sélecteurs, l'état de chargement, le
téléchargement, et les quatre combinaisons rendues avec `Content-Type: application/pdf` et un
`Content-Disposition` nommé. `vite build` produit un bundle client de 340 ko dont la seule
occurrence du mot « Chromium » est la phrase explicative du panneau.

---

## Les preuves d'ablation

Chaque mutation a été appliquée puis restaurée, et le test visé devait rougir.

| Mutation | Test qui rougit |
| :--- | :--- |
| recréer un budget pour chaque liaison | la borne cumulée entre bande et racine |
| faire confiance au type au lieu de parser | la fixture v1 réellement historique |
| sérialiser `undefined` en chaîne vide | `missing-binding-value` |
| `JSON.stringify` d'un objet lié | `non-printable-binding-value` |
| rendre `exceptLast` sur l'unique page | la matrice des occurrences |
| recalculer l'aire imprimable localement | le cas Letter décimal et asymétrique |
| écrire `pt * (25.4 / 72)` au lieu de `mmFromPt` | la taille témoin de 7,5 pt |
| arrondir une largeur de colonne à deux décimales | la colonne légale très étroite |
| additionner deux filets adjacents | l'exclusivité des frontières |
| retirer l'échappement d'un texte `</span><script>` | la sérialisation et l'absence de script |
| autoriser une URL HTTP | les sept sources refusées avant chargement |
| omettre `printBackground` | l'objet d'options épinglé |
| omettre `preferCSSPageSize` | la feuille personnalisée devenue Letter |
| masquer le débordement sans le mesurer | le flux trop long accepté |
| ne pas attendre le décodage de l'image | l'image corrompue acceptée |
| retirer l'`await` de fermeture | le navigateur encore connecté |
| importer Puppeteer depuis `engine` | `pnpm run lint` |
| envoyer le modèle brut au pont | le protocole limité aux identifiants (vérifié en direct) |

**Deux mutations sont d'abord restées vertes, et c'est le résultat le plus utile du protocole.**

- Le cas de l'aire imprimable utilisait des marges **symétriques** : `width − (left + right)` et
  `width − left × 2` y donnent le même nombre, et l'assertion ne prouvait rien. La fixture est
  désormais décimale **et** asymétrique sur les deux axes.
- Le cas de la conversion pt → mm utilisait **9,5 pt**, taille pour laquelle
  `(9,5 × 25,4) / 72` et `9,5 × (25,4 / 72)` sont le **même** double. La taille témoin est
  maintenant **7,5 pt**, où les deux divergent, et le test épingle cette divergence avant de
  vérifier le rendu.

Sans le protocole, deux assertions décoratives auraient été livrées comme des gardes.

---

## Conséquences

- **Le premier document réel existe**, et le même pipeline et le même adaptateur portent les lots
  suivants. Ce n'est pas un renderer de démonstration.
- **La façade `RenderPort` est publique et Puppeteer n'est pas une dépendance du moteur.** Un
  intégrateur qui n'imprime pas ne télécharge pas Chromium.
- **La représentation matérialisée est interne et ne porte aucun schéma Zod** : elle n'entre jamais
  de l'extérieur, n'est ni stockée ni exportée, et est construite exclusivement depuis un `Template`
  validé. Aucune version de document n'a donc à bouger.
- **`RenderRequest.data` reste un sac opaque.** Aucun `RenderDataSchema`, aucune clé réservée,
  aucune recherche de « client », « total » ou « aujourd'hui ».
- **Trois fichiers de gouvernance changent, chacun pour enregistrer le paquet nouveau** : une
  référence de projet dans le `tsconfig.json` racine, `allowBuilds: puppeteer: true` dans
  `pnpm-workspace.yaml` — l'entrée est commentée avec ce que le script fait et pourquoi il est
  requis — et une dépendance plus un second passage TypeScript dans le manifeste du playground.
  **Aucune entrée `minimumReleaseAgeExclude` n'a été écrite** : les deux versions installées
  avaient passé la fenêtre de refroidissement, et c'est pour cela qu'elles ont été choisies.
- **Deux dépendances, et deux seulement :** `puppeteer` en exécution de l'adaptateur, `pdf-lib` en
  développement de l'adaptateur pour lire nombre de pages et dimensions. Aucune dépendance de
  nettoyage, de serveur HTTP, de templating, de CSS-in-JS, de formatage ou de journalisation.
- **La couverture reste au-dessus de 90 %** sur les quatre métriques, sans exclusion nouvelle et
  sans seuil abaissé.

---

## Ce que l'exécution a corrigé du plan

1. **`PdfSourceDocument` porte un troisième champ.** Sans le manifeste d'images, « refusé avant
   chargement » était irréalisable pour une stratégie qui ne reçoit qu'une chaîne HTML (D-2).
2. **`border-collapse: collapse` a été abandonné.** Chromium 151 donne l'égalité rangée/rangée à la
   rangée **précédente** et l'égalité du périmètre à la **cellule** — deux des cinq règles voulues.
   Le DOM synthétise donc la frontière, comme le plan l'avait prévu en second recours (D-4).
3. **La contradiction interne du plan sur le périmètre est tranchée** : la règle spécifique
   l'emporte sur la règle générale, la table gagne l'égalité au périmètre (D-4).
4. **Les filets sont peints en ombres insérées, pas en bordures CSS.** C'est la seule écriture qui
   tienne à la fois « le `padding` seul retranche » et « deux filets se recouvrent sans
   s'additionner ». Sa conséquence — un filet sans padding recouvre son propre texte — est une
   règle d'écriture de modèle, écrite ici (D-5).
5. **La preuve d'ablation sur `printBackground` ne pouvait pas porter sur un pixel.** Avec
   `print-color-adjust: exact` hérité de la racine, l'option est inerte sous Chromium 151 pour un
   fond. Elle est donc épinglée sur l'objet d'options, et la redondance est nommée plutôt que
   présentée comme une protection.
6. **Le lot a livré deux vocabulaires de facture au lieu d'un.** Le plan demandait à la fois que la
   fixture porte les noms de l'application exemple et qu'aucun de ces noms n'apparaisse dans le
   moteur ou l'adaptateur : les deux exigences imposent deux documents. Le playground porte le
   vocabulaire de l'intégrateur et la recette humaine ; l'adaptateur porte le sien et les oracles
   mécaniques.

---

## Ce qui reste ouvert

- **Une boîte ne porte aucune largeur.** La recette visuelle l'a rendu concret : la seule façon de
  contraindre la largeur d'une image aujourd'hui est un poids de colonne. C'est utilisable, ce n'est
  pas ce qu'un concepteur visuel attendra.
- **`sans-serif` n'est pas une police déterministe**, et le PDF ne porte aucun profil ICC : les
  couleurs sont écrites en DeviceRGB nu. La parité raster et la reproductibilité restent à établir.
- **Chromium écrit son titre, son agent utilisateur et deux horodatages** dans le dictionnaire
  d'information du PDF. Un test épingle ces trois faits pour qu'ils ne soient pas découverts deux
  fois ; les retirer reste à faire.
- **Une source d'image distante reste refusée.** Le canal de résolution, la liste blanche, les
  bornes de taille, de temps, de mémoire et de concurrence appartiennent au durcissement, et
  celui-ci reste obligatoire avant toute exposition réelle.
- **Le rendu est mono-page.** Report, découpe, répétition d'en-tête et repli effectif de
  `keepTogether` — conservé dans la représentation, sans comportement observable ici — attendent une
  pagination réelle.
- **Un navigateur par rendu.** La mise en commun des processus, les files et les plafonds ne sont
  pas là, et le pont du playground ne doit pas être déployé.

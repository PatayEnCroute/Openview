# ADR 0006 — La page

- **Statut :** 🟢 **Accepté** (2026-08-18), implémentée dans `@openview/core`
- **Date :** 2026-08-18
- **Impact :** `@openview/core` (contrat de feuille, marqueur de numéro, estampille 5 et la
  **première migration transformante** du dépôt), `@openview/engine` (E1 reçoit la géométrie qui
  lui manquait ; E2 et E3 héritent des bandes et d'une **attente d'oscillation** écrite plus bas),
  `@openview/viewer` (V1 dessine une feuille sans attendre un moteur),
  `@openview/core` lot **C7** — le seul lot du contrat qui « **Dépend de :** C4 »
  (`core.md:223`)
- **Complète :** [ADR 0005](0005-le-tableau-de-lignes.md) — le contenu d'une bande est un
  `ContainerNode`, donc la coupure `BlockNode` du lot C3 s'y applique **sans une ligne de ce
  lot** ; et [ADR 0002](0002-data-binding-and-loop-scope.md), dont la promesse « le modèle dit ce
  qu'il lit » est étendue aux bandes par une fonction nouvelle plutôt que rompue en silence.
- **Précise, sans la contredire, une docstring publiée par le lot C3.**
  `ast/types.ts` attribuait « *no page numbering* » à E2 et E3 sans distinguer la **valeur** de
  l'**emplacement**. La valeur reste à E2 ; l'emplacement est un segment de C4. La ligne est
  corrigée dans le lot, et le geste est écrit ici parce qu'un plan qui renverse la consigne d'un
  lot antérieur le fait **explicitement ou pas du tout**.
- **N'amende aucune règle de gouvernance.** `AGENTS.md` sort du lot **inchangé**, et le contrôle
  est négatif et rejouable — `git diff --exit-code "$(git merge-base origin/main HEAD)" HEAD --
  AGENTS.md`, exit 0. Même chose, et c'est plus rare, pour `packages/core/src/errors.ts` : **zéro
  code d'erreur nouveau, zéro site nouveau**, le fichier sort du lot octet pour octet.
- **Plan d'implémentation :** [docs/plans/c4-la-page.md](../plans/c4-la-page.md) — **périmé** une
  fois le lot livré, comme le dit son propre en-tête. C'est cette ADR qui fait foi.
- **Implémentation :**
  [`src/page/types.ts`](../../packages/core/src/page/types.ts) (`Sheet`, `PageMargins`,
  `PAGE_BAND_OCCURRENCES`, `PageBandOccurrence`, `PageBand`, `PageSetup`, `PrintableArea`,
  `MIN_SHEET_MM`, `MAX_SHEET_MM`, `STANDARD_SHEETS_MM`, `StandardSheetName`),
  [`src/page/schemas.ts`](../../packages/core/src/page/schemas.ts) (les quatre schémas,
  `BAND_OCCURRENCE_CONFLICTS` et les trois contrôles croisés),
  [`src/page/area.ts`](../../packages/core/src/page/area.ts) (`printableAreaOf`),
  [`src/page/page.ts`](../../packages/core/src/page/page.ts) (la façade),
  [`src/ast/types.ts`](../../packages/core/src/ast/types.ts) et
  [`src/ast/schemas.ts`](../../packages/core/src/ast/schemas.ts) (`PAGE_FIELDS`, `PageField`,
  `TextPageFieldSegment` et le troisième membre de `TextSegment`),
  [`src/ast/visitor.ts`](../../packages/core/src/ast/visitor.ts) (un membre de `SegmentVisitor`,
  un `case`, une branche de `SEGMENT_EXPRESSIONS`),
  [`src/template/template.ts`](../../packages/core/src/template/template.ts) (le champ `page`,
  l'estampille 5),
  [`src/template/guard.ts`](../../packages/core/src/template/guard.ts) (`parsePageSetup`),
  [`src/template/paths.ts`](../../packages/core/src/template/paths.ts)
  (`collectTemplateDataPaths`),
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (`COMPATIBILITY_PAGE`
  et l'entrée `4 → 5`)

---

## Contexte

Avant ce lot, le contrat ne connaissait **aucun** vocabulaire de page. Relevé sur `main` avant
livraison : `git grep -niE '\b(page|sheet|margin|orientation|portrait|landscape|a4|letter|footer|header)\b'`
sur `packages/core/src`, hors tests, rendait **trois** lignes, et aucune ne parlait d'une feuille —
`evaluate.ts`, `limits.ts` et `guard.ts` employaient le mot `margin` au sens de *marge de sécurité*
d'un plafond. `Template` portait sept champs, et pas un ne concernait le support.

Ce que cet écart interdisait tient en une phrase : **le lot E1 du moteur ne pouvait pas
commencer.** Son périmètre est « une facture courte, un tableau qui tient sur la page […] »
(`engine.md:33-36`), et *« qui tient sur la page »* n'a aucun sens tant qu'aucune page n'est
déclarée. Un moteur qui devrait inventer la feuille choisirait A4 ou Letter à la place de l'auteur,
et le premier PDF sortirait d'une décision prise dans un fichier de rendu.

**Ce que le lot ne fait pas, et c'est la moitié de la décision.** Il ne pagine rien. Un lot de
page est l'endroit le plus glissant de la vague 1 précisément parce qu'une page *ressemble* à un
objet de rendu — elle a une taille, des marges, un haut, un bas, un numéro — et donne l'illusion
qu'en la décrivant on décide de la mise en page. `core.md:283-286` dit l'inverse sans détour :
« elle **décrit**, elle ne **produit** rien ». Après C4, **aucun document ne sort sur deux
pages** : le lot livre l'ensemble des faits sans lesquels E2 et E3 n'auraient rien à respecter, et
rien d'autre.

---

## Le critère d'appartenance, écrit AVANT la liste des champs

Cette section vient en premier délibérément, et elle a **trois** conditions là où l'ADR 0005 en
avait une seule — parce que C4 touche un objet que C3 ne touchait pas : **le rendu**.

Un fait entre dans le contrat de page **si et seulement si** :

1. **Il est inexprimable hors d'une feuille.** Pas « il concerne la mise en page » — *inexprimable
   ailleurs*. Une marge n'a de sens que par rapport à un bord de papier ; une couleur de fond, un
   espacement, un filet s'écrivent sur n'importe quel bloc, donc ils appartiennent à C5. C'est la
   forme corrigée du critère de C3, transposée à la feuille.
2. **Il est décidé par l'auteur du modèle, pas calculé par un moteur.** Une taille de feuille est
   un choix ; un numéro de page est un résultat. Le premier est un champ, le second ne peut être
   qu'un **emplacement**.
3. **Il est décidable sans données et sans pagination.** Tout ce que le contrat déclare doit
   pouvoir être refusé au *save time*, sur le seul document, sans jeu de données et sans savoir
   combien de pages sortiront.

**Aucune des trois n'est décorative, et l'on peut le montrer par ce que chacune écarte seule.**
Sans la condition 2, `numbering: { position: 'footer-center' }` passe la condition 1 — une position
sur la feuille est bien inexprimable ailleurs — alors que c'est une règle de mise en page. Sans la
condition 3, `keepTogether` passe les conditions 1 et 2 — l'auteur le décide, et cela ne se dit que
par rapport à une coupure de page — alors que c'est C7 et E3.

| Champ retenu | (1) inexprimable ailleurs | (2) décidé par l'auteur | (3) décidable sans données |
| :--- | :--- | :--- | :--- |
| `sheet.width`, `sheet.height` | oui — c'est le papier | oui | oui |
| `margins.{top,right,bottom,left}` | oui — un bord de papier | oui | oui |
| `header[]`, `footer[]` | oui — « en haut de chaque page » n'existe pas hors d'une page | oui | oui |
| `PageBand.on` | oui — un rang de page | oui | oui |
| `TextPageFieldSegment` | oui — un numéro de page | **l'emplacement, oui ; la valeur, non** | oui *(l'emplacement)* |

**La cinquième ligne est une EXCEPTION, et elle est nommée plutôt que dissimulée.** Le marqueur de
numéro échoue à la lecture naïve de la condition 2 : sa *valeur* est calculée par le moteur. Il
entre quand même, parce que ce que le contrat déclare n'est pas la valeur mais **la place où elle
s'imprime** — et cette place, personne d'autre que l'auteur ne peut la choisir. C'est la même
forme d'exception que l'ADR 0005 a dû écrire pour `align`. Une exception écrite est une exception
qu'on peut discuter ; une exception tacite est une brèche.

---

## Les treize décisions

### D1 — Le critère d'appartenance gouverne la liste, et non l'inverse

Énoncé ci-dessus. **Écarté :** un critère en une condition (« tout ce qui concerne la feuille »),
qui admet la couleur du papier, la hauteur des bandes et la politique de coupe — c'est-à-dire C5,
E2 et C7 ; le critère de C3 recopié tel quel, dont la condition unique ne dit rien du rendu ; et
l'absence de critère avec une liste de champs justifiés un par un, qui est la forme qui laisse
entrer le champ de trop, parce qu'un champ isolé se justifie toujours.

**Réversibilité :** sans objet — c'est une méthode, pas une forme.

---

### D2 — `Template.page` est un champ REQUIS : ni paramètre de rendu, ni nœud de l'arbre

`Template` gagne **un** champ, `page: PageSetup`, requis, au premier niveau. Ce n'est pas un nœud,
ce n'est pas un argument de `RenderRequest`, et ce n'est pas un champ optionnel muni d'un défaut de
schéma.

**Pourquoi requis.** Le critère de recette emploie le verbe **imposer** — « un modèle **impose**
son format et ses marges » — et un champ optionnel n'impose rien, il autorise. Et une page absente
oblige le moteur à inventer une feuille : c'est le déplacement que le refus du paramètre de rendu
écarte, revenu par la porte du champ facultatif, avec cette aggravation que rien ne vérifierait que
le viewer invente la même.

> ⚠️ **Ce n'est PAS la perte silencieuse qui décide du caractère requis, et une première rédaction
> du plan faisait reposer une décision juste sur un motif faux.** La perte silencieuse — mesurée :
> un document portant `page` parsé par un schéma qui l'ignore ressort avec les clés
> `schemaVersion,id,name,version,root`, la page supprimée sans une seule issue — est le fait d'un
> **build antérieur** devant une clé **inconnue**. Elle se produirait à l'identique si `page` était
> optionnelle chez son successeur. **Ce qui protège de cette perte, et la seule chose qui en
> protège, c'est l'estampille** (D11). La conflation apparaissait quatre fois dans le plan ; elle
> est corrigée partout, et `page` reste requis, pour le motif juste.

**Pourquoi pas un défaut de schéma.** **Mesuré :** avec `page: PageSetupSchema.default(PAGE_A4)`,
un document **sans** page parse sans erreur et ressort en portant une feuille qu'Openview a
choisie — dans un document que son auteur n'a jamais vu, et **à chaque parse**. C'est le pire des
deux mondes : optionnel en pratique, requis dans le type. La feuille de compatibilité existe malgré
tout, mais elle est écrite **une fois, par la migration**, où elle est visible et datée (D11).

**Pourquoi un champ de premier niveau et non un nœud.** Une feuille n'a **pas de position dans le
flux** : un nœud a des frères et un rang, une feuille n'en a pas. Un `PageNode` obligerait
`visitNode` à traiter un membre qui ne peut apparaître qu'à la racine — une règle **positionnelle**
que le contrat n'a nulle part ailleurs, et qu'aucun `switch` ne peut faire respecter. Et
`childrenOf` devrait décider si les bandes sont des « enfants » : si oui, `collectDataPaths(root)`
les visiterait *par accident* et la portée d'alias deviendrait fausse ; si non, le nœud serait un
conteneur qui ment sur ses enfants. Le champ de premier niveau supprime la question — et la
remplace par une autre, honnête et traitée en D10.

**Ce que « requis » coûte, et ce que ça ne coûte pas.** Cela casse tout document v4 qui ne
migrerait pas — **mesuré**, `invalid_type` sur le chemin `page`, *Invalid input: expected object,
received undefined*. **Ce n'est pas un rétrécissement pour autant**, parce que la migration
transformante de D11 remplit le champ : aucun document v4 ne devient irrecevable, et C4 n'ajoute
**aucun cinquième rétrécissement** à la liste que porte l'hypothèse pré-v1.0.

**Écarté.** (a) `page?: PageSetup | undefined` — le moteur devrait inventer une feuille. (b) Un
défaut de schéma — mesuré, il réécrit le document à chaque parse. (c) `PageNode` à la racine —
règle positionnelle non outillable, `childrenOf` piégé. (d) `root` devenant un `PageNode` portant
`header`/`body`/`footer` — cela réécrit le champ `root` de tous les documents pour ranger trois
listes dans un nœud qui ne participe à aucun parcours. (e) Un champ `pages: readonly PageSetup[]`
pour un document à formats mixtes — personne ne l'a demandé, et une page par section suppose des
**sections** que le contrat n'a pas. *Signal de réouverture :* un modèle livré dont une annexe doit
sortir en paysage.

**Irréversible** — forme stockée de premier niveau.

---

### D3 — La feuille est DEUX LONGUEURS EN MILLIMÈTRES ; aucun nom de format dans la forme stockée

`sheet: { width, height }`, en millimètres, dans `[MIN_SHEET_MM, MAX_SHEET_MM] = [1, 5080]`,
**fractionnaires autorisés**. Aucun champ `format`, aucun champ `orientation`. Un tableau de
commodité `STANDARD_SHEETS_MM` — sept entrées — est **exporté** pour que l'éditeur et le playground
**écrivent** des dimensions, mais il ne fait **pas** partie de la forme stockée.

**Pourquoi des dimensions et non un nom : parce qu'un nom se paie en estampilles.** Une énumération
fermée de formats est une forme **stockée**. Y ajouter `a3` plus tard élargit une union stockée,
donc exige `CURRENT_SCHEMA_VERSION + 1` et sa migration — pour un format de papier. Avec des
dimensions, l'ensemble des feuilles exprimables est **infini** et aucune estampille n'est jamais
due. Le tableau de commodité, lui, grandit d'une ligne sans toucher au contrat : c'est exactement
la différence entre une donnée du **document** et une donnée du **paquet**.

**Pourquoi les millimètres, et pourquoi FRACTIONNAIRES : la mesure est décisive et
contre-intuitive.** Les formats normalisés ne sont pas tous entiers en millimètres — Letter vaut
**215,9 × 279,4**, Legal 215,9 × 355,6, Tabloid 279,4 × 431,8. Une longueur entière rendrait donc
**US Letter inexprimable**, dans un produit dont la décision 11 impose le multi-langue et dont le
critère de recette du moteur nomme « anglais/dollars ». Le fractionnaire n'est pas un confort, c'est
une **condition d'existence**.

**Et la borne « au plus deux décimales », qui semble raisonnable, est un piège MESURÉ.** Écrite de
la manière évidente — `Number.isInteger(value * 100)` — elle **refuse Letter** :
`279.4 * 100` vaut `27939.999999999996`. Une hauteur de page normalisée sur quatre échoue au
contrôle censé la protéger. Le lot n'écrit donc **aucune contrainte de décimales** : la finitude et
les deux bornes suffisent. *À ne pas recopier :* la même formule paraîtra tentante en C5 pour une
taille de police.

**Ce que la finitude coûte : rien, c'est déjà acquis.** `z.number()` refuse déjà `Infinity` et
`NaN`. Réserve honnête à verser à C8 : le message rendu pour l'infini est *Invalid input: expected
number, received number*, littéralement inexploitable pour un auteur. Ce n'est pas un défaut de ce
lot — il préexiste sur toutes les positions numériques du contrat — mais le donner à C8 est moins
cher que de le laisser trouver.

**Pourquoi aucun champ `orientation`, alors que la roadmap le nomme.** Parce que la paire le dit
déjà : un A4 paysage est `{ width: 297, height: 210 }`. Un champ séparé serait une **seconde source
de vérité** sur le même fait, donc un invariant à faire respecter et un refus de plus pour une
incohérence qui ne devrait pas être exprimable. La roadmap énumère des notions manquantes en prose,
elle ne prescrit pas de champs : la **capacité** « décrire une page en paysage » est livrée,
entière. C'était l'arbitrage n° 3, tranché en A.

**Les deux bornes.** `MIN_SHEET_MM = 1` : une feuille de zéro millimètre n'a pas d'aire imprimable,
et `gt(0)` laisserait passer `0,0001` mm. `MAX_SHEET_MM = 5080` = 200 pouces.

> ⚠️ **La qualification de cette borne est une BORNE PRODUIT, pas une limite du format PDF, et une
> première rédaction du plan disait le contraire.** Les 200 pouces sont le plafond historique de
> l'espace utilisateur par défaut — 14 400 unités à 1/72 de pouce — mais PDF 1.6 a introduit le
> facteur d'échelle `UserUnit`, qui rend des pages plus grandes **exprimables**. « La plus grande
> page qu'un lecteur PDF est *tenu* de traiter » ne décrit donc aucune obligation générale du
> format. **Connaissance externe, non vérifiée dans ce dépôt** : aucun moteur n'existe, donc rien
> ici ne la confirme, et **la sonde appartient à E1**, qui devra l'éprouver contre l'adaptateur
> réellement retenu plutôt que contre une spécification. Ce que la borne protège est indépendant de
> sa valeur : sans plafond, `1e308` mm est un document valide dont l'aire imprimable est infinie.

**Écarté.** (a) Format nommé seul — chaque format nouveau coûte une estampille, et un format non
listé devient inexprimable. (b) Une union `{ kind: 'named' } | { kind: 'custom' }` — les deux coûts
additionnés, et le second membre rend le premier inutile. (c) Millimètres entiers — mesuré, refuse
Letter. (d) **Dixièmes de millimètre entiers** (`2159` pour Letter) : exact pour tous les formats
**et** entier, et c'est la seule option écartée qui n'ait aucun défaut technique. Écartée sur la
**lisibilité** — le contrat est lu par un intégrateur et écrit, à terme, par une interface pour
non-développeur, et `2159` n'est le nom de rien. (e) Points typographiques — illisibles pour
l'auteur (« marge de 57 points »). (f) Pixels CSS — un pixel dans un contrat de papier est un
contresens durable. (g) Un objet `{ value, unit }` — deux modèles deviennent incomparables sans
conversion. (h) Marges et formats nommés (`étroite`, `normale`) — Openview déciderait alors des
valeurs, c'est-à-dire une position par défaut de fait.

> **L'option (i) attaquait le problème à la racine et elle a été portée en arbitrage plutôt que
> tranchée discrètement.** Une **unité entière commensurable** — le pas de 1/914400 pouce d'OOXML,
> dit *EMU* — divise exactement le millimètre, le point, le pouce et le pixel CSS. Toute longueur
> devient un entier, toute conversion devient exacte, et le défaut mesuré qui porte D5
> **disparaît**. Ce qu'elle coûte est réel : `{ width: 7560000, height: 10692000 }` dans un JSON
> n'est le nom de rien, et l'ergonomie dépendrait de fabriques que rien n'oblige un intégrateur à
> utiliser — il peut écrire l'entier à la main et se tromper d'un facteur mille sans qu'aucune
> borne ne le voie. Le choix était entre **un contrat lisible dont une soustraction se fait en un
> seul endroit** et **un contrat exact que personne ne lit**. Arbitrage n° 2, tranché en **A** :
> le premier. *Signal de réouverture :* une divergence mesurée entre l'aperçu et le PDF imputée à
> l'arrondi d'une longueur fractionnaire.

**Irréversible** pour la forme stockée. `STANDARD_SHEETS_MM` est **réversible à volonté** : c'est
du code, pas un document.

---

### D4 — Quatre marges, et l'invariant croisé DANS LE SCHÉMA, avec son garde

`margins: { top, right, bottom, left }`, en millimètres, `>= 0`, plafonnées comme la feuille.
Quatre champs **requis** : aucun raccourci, aucune valeur par défaut, aucun héritage. Deux
invariants croisés vivent dans un `superRefine` de `PageSetupSchema` — les marges horizontales
laissent une largeur imprimable **strictement positive**, les verticales une hauteur strictement
positive — et le refinement porte un **garde** qui sort tôt quand la feuille est elle-même invalide.

**Pourquoi l'invariant est dans le schéma.** Parce que `PageSetupSchema` est exporté par le barrel,
et qu'un intégrateur qui valide sa page avant de la stocker doit obtenir le **même** refus que
`parseTemplate`. C'est le raisonnement de C3 pour `checkTableWiring`, et il repose sur une propriété
de zod qu'il faut **re-vérifier à chaque montée** : **mesuré**, un `superRefine` laisse un
`ZodObject` — `.shape` et `.extend` restent disponibles, et `TemplateSchema.extend({ page })` est
lui-même encore un `ZodObject`.

**Les deux messages et le chemin qu'ils désignent.** Le chemin s'arrête à `page.margins` et **ne
désigne pas un champ** : c'est délibéré, parce qu'aucun des quatre n'est fautif isolément — c'est
leur somme, rapportée à la feuille, qui ne tient pas. Désigner `margins.left` accuserait un champ
que l'auteur a peut-être écrit juste. Et les messages sont **constants** : aucune interpolation du
contenu du modèle, conformément à la règle de l'ADR 0003 sur la charge d'erreur sûre à journaliser.

**Le garde, et la mesure qui le justifie.** Sans garde, une feuille de largeur `0` produit **deux**
issues au lieu d'une : le `too_small` de la largeur, **puis** le `custom` des marges horizontales,
parce que `30 >= 0` est vrai. **Mesuré : 2 issues sans le garde, 1 avec.** La seconde est un
**dommage collatéral** de la première, et la promesse faite à C8 est « un message à la fois, jamais
une cascade ». Le garde est **atteint** par toute feuille mal dimensionnée, donc couvert par un
`it` — jamais du code mort.

**Et ce que le garde ne rattrape pas**, parce que la règle de zod est plus subtile qu'un « les
refus s'additionnent » : un refus **abandonnant** saute le `superRefine`, un refus **continuable**
le laisse tourner. La formule juste est *un refus de type masque le croisé, un refus de borne ne le
masque pas*. Conséquence pour ce lot : comme D3 refuse toute contrainte de décimales, **aucun
`invalid_type` n'est atteignable sur une marge numérique** hors `NaN`, `Infinity` et une valeur non
numérique — l'invariant croisé est donc rendu dans tous les cas qui comptent.

**Pourquoi `>= 0` et non `> 0`.** Une marge nulle est un choix légitime — une étiquette à fond
perdu, un modèle qui gère lui-même sa gouttière — et un document à quatre marges nulles est
**accepté**. Refuser zéro serait poser une règle de typographie, ce que la condition 2 du critère
interdit.

**Écarté.** (a) L'invariant dans `parseTemplate` seul — l'intégrateur qui valide le schéma
directement ne l'obtiendrait pas. (b) Aucun invariant croisé — le refus serait reporté au rendu, là
où il n'y a plus de chemin Zod pour le dire, donc là où il faudrait un code d'erreur (D9). (c) Un
invariant exigeant une aire imprimable *utile* (« au moins 10 mm ») — c'est une règle de
typographie, et 10 mm ne se justifie par aucune mesure. (d) Des marges nommées — voir D3 (h). (e)
Une marge de reliure, des marges en vis-à-vis — refusé en D13.

**Irréversible** pour les quatre champs ; **réversible** pour les deux invariants — les retirer
n'invaliderait aucun document déjà écrit, alors que les ajouter plus tard serait un rétrécissement.

---

### D5 — L'aire imprimable est calculée UNE FOIS, dans `core`, et exportée

`core` exporte `printableAreaOf(page: PageSetup): PrintableArea`, avec
`PrintableArea = { width, height }`, en millimètres. Ce n'est pas une forme stockée : c'est une
**fonction**, la seule du lot, et la soustraction s'écrit **une** fois dans le dépôt.

**Pourquoi une fonction dans un paquet qui ne produit rien.** Parce que le contraire est un accord
entre deux implémentations, et que le dépôt a déjà refusé exactement cela. La garantie de la
décision 7 est un aperçu **identique** au PDF ; le moteur et le viewer doivent donc obtenir la même
zone de texte à partir de la même page. Or `largeur − gauche − droite` n'est pas une opération
unique — **MESURÉ**, sur US Letter à marges d'un pouce :

```
215.9 - (25.4 + 25.4)  ->  165.10000000000002
(215.9 - 25.4) - 25.4  ->  165.1
```

Deux auteurs qui écrivent la soustraction chacun de leur côté n'écrivent pas la même formule, et
l'écart apparaît **exactement sur la feuille dont le projet a besoin pour son critère
anglais/dollars** tout en restant invisible sur A4 à marges entières, où les deux rendent 180.
Exporter la fonction est la parade la moins chère : cinq lignes, un test, et l'accord devient une
**dépendance**. Le précédent est écrit dans le dépôt et il est exactement de cette forme —
`nodeReads` existe parce que « *this primitive is what they can share* ».

**La forme parenthésée est retenue pour une PROPRIÉTÉ, pas une préférence :** `left + right` égale
`right + left` **exactement**, donc le résultat ne peut pas dépendre de la marge qu'un
implémenteur nomme en premier. La forme séquentielle n'a pas cette propriété — **mesuré**,
`(229.61 − 38.59) − 33.3` vaut `157.72000000000003` et `(229.61 − 33.3) − 38.59` vaut `157.72`.

**Ce que la fonction ne promet pas.** Elle rend un nombre exact **au sens IEEE-754** et rien de
plus. Deux consommateurs qui **quantifient** ensuite ce nombre différemment — au pixel de l'écran,
au point du PDF — peuvent encore différer : l'identité au pixel ne découle pas de l'identité du
nombre, et c'est **V3** qui vérifie la décision 7 elle-même. Elle ne rend ni origine, ni décalage,
ni rectangle : `{ x, y }` supposerait une convention d'origine que rien dans le contrat ne fixe et
que C11 pourrait vouloir fixer autrement. Et elle ne soustrait pas la hauteur des bandes — le
contrat ne les mesure pas (D8), et une aire qui prétendrait tenir compte de l'en-tête serait fausse.

**Ce n'est pas de la sur-ingénierie, et voici le test.** La règle anti-sur-ingénierie porte sur les
**abstractions spéculatives**. `printableAreaOf` n'abstrait rien : c'est un calcul concret, dont
deux consommateurs sont nommés dans la roadmap (E1, V1) et dont le troisième **existe déjà** — le
playground, qui dessine la page à l'échelle et dont la zone imprimable mesure, vérifié dans le
navigateur, 180 × 261 mm.

**Écarté.** (a) Ne rien exporter — la garantie de la décision 7 reposerait sur deux formules
qu'aucun test ne compare. (b) Un rectangle `{ x, y, width, height }` — impose une convention
d'origine hors mandat. (c) Des méthodes sur un objet page — le contrat est de la donnée plate, et
une classe rendrait `Template` non sérialisable. (d) La calculer dans le moteur et la publier dans
son résultat de pagination (E5) — trop tard pour le viewer, qui doit dessiner une page avant qu'un
moteur existe.

**Réversible** — du code sans forme stockée.

---

### D6 — Deux listes de bandes, CINQ occurrences, et une seule bande applicable par page

`header: readonly PageBand[]` et `footer: readonly PageBand[]`, deux listes **requises** et
éventuellement vides. Une bande est `{ on, content }` — **deux** champs, pas trois : elle ne porte
pas d'identifiant propre, parce que son conteneur en a un.
`PAGE_BAND_OCCURRENCES = ['every', 'firstOnly', 'exceptFirst', 'exceptLast', 'lastOnly']`, tuple
fermé de **cinq** membres, dans l'ordre de **lecture d'un document** — tout, puis la paire du
début, puis celle de la fin — qui est l'ordre que `z.enum` rend dans un refus.

**Pourquoi une liste et non un champ unique.** Le critère de recette demande deux choses à la
fois : « ce qui se répète en haut et en bas de **chaque** page » **et** « ce qui n'apparaît que sur
la **dernière** ». Avec un `footer?: PageBand` unique il faudrait deux champs, puis un troisième le
jour où la première page diffère, puis un quatrième — c'est-à-dire une énumération de cas déguisée
en champs. La liste porte l'énumération **une** fois, dans un tuple fermé que C8 peut lire.

**Pourquoi `content: ContainerNode`.** Parce qu'une bande est un **fragment de document**,
exactement comme `Template.root`. Le conteneur apporte trois choses gratuites : un `id` stable, donc
une bande adressable par une `Command` de l'éditeur sans champ nouveau ; la compatibilité immédiate
avec **tous** les parcours existants ; et l'héritage automatique de la coupure `BlockNode` de C3 —
**mesuré**, une `tableRow` nue dans une bande est refusée sur
`page.footer.0.content.children.1.type`, sans qu'une ligne de C4 s'en occupe.

**Pourquoi exactement cinq valeurs.** `every` livre la première moitié du critère de recette.
`lastOnly` livre la seconde, littéralement. `exceptLast` n'est pas une commodité : sans elle, un
modèle qui veut un pied différent sur la dernière page obtient les **deux** bandes sur cette page,
puisque `every` inclut la dernière. Et `firstOnly` / `exceptFirst` sont la même paire à l'autre bout
du document.

> 🗳️ **Les deux membres de première page entrent par décision du propriétaire du produit,
> 2026-08-18, arbitrage n° 6 tranché en B contre la recommandation du plan.** Le motif retenu est
> celui de l'objection la plus sérieuse du lot : `engine.md:59` exige de E3 « le total reporté de
> page en page », or un report est un montant **entrant**, donc imprimé en **haut**, et **il
> n'existe pas en page 1**. Sans `exceptFirst`, un modèle qui pose un report dans son en-tête
> imprime « Report : 0,00 € » sur la première page — exactement l'anomalie qu'un comptable relève,
> alors que E3 est « prêt quand un utilisateur métier ne relève aucune anomalie ». Le plan
> recommandait d'attendre, au motif que C4 ne livre **aucun marqueur de report** et que le lot qui
> livrerait le report livrerait l'occurrence. La décision est de livrer l'occurrence maintenant, et
> **le marqueur de report reste hors du lot** : E3 trouvera la moitié du mécanisme en place, pas le
> tout.

**L'invariant est une DISJONCTION, pas une unicité.**

> ⚠️ **Une rédaction antérieure écrivait l'un en croyant écrire l'autre, et le défaut était réel.**
> Le texte annonçait un système fermé, mais l'invariant rédigé ne refusait que deux occurrences
> **identiques**. Il acceptait donc `every` + `lastOnly`, qui pose **deux bandes sur la dernière
> page**, et `every` + `exceptLast`, qui en pose deux sur toutes les autres : précisément l'état
> ambigu que l'invariant existait pour supprimer, laissé exprimable par l'invariant lui-même. Un
> invariant qui ne couvre pas le cas de son propre motif ne protège rien ; il documente une
> intention.

Ce que l'invariant refuse, énoncé sur les **pages** et non sur les valeurs : deux bandes du même
côté dont les **domaines d'application se recoupent**. Avec cinq occurrences, les contenus
admissibles d'un côté sont exactement **huit**, et le compte est **mesuré** sur les trente-et-un cas
de zéro, une et deux bandes — **dix acceptés, vingt-et-un refusés** :

| Contenu d'un côté | Verdict | Pourquoi |
| :--- | :--- | :--- |
| `[]` | **accepté** | un modèle sans bande est légitime |
| `[every]` | **accepté** | ce qui se répète sur **chaque** page |
| `[firstOnly]`, `[exceptFirst]`, `[exceptLast]`, `[lastOnly]` | **accepté** | une seule bande, aucun recoupement possible |
| `[firstOnly, exceptFirst]` | **accepté** | **partition** : page 1 d'un côté, le reste de l'autre — vraie à tout `n`, la seconde étant vide à `n = 1` |
| `[exceptLast, lastOnly]` | **accepté** | **partition** symétrique, la première étant vide à `n = 1` |
| `[every, *]` | **refusé** | `every` recoupe tout, par construction |
| `[firstOnly, exceptLast]` | **refusé** | dès deux pages, les deux tombent sur la page 1 |
| `[exceptFirst, lastOnly]` | **refusé** | dès deux pages, les deux tombent sur la dernière |
| `[exceptFirst, exceptLast]` | **refusé** | dès **trois** pages, les deux tombent sur les pages du milieu |
| `[firstOnly, lastOnly]` | **refusé** | sur un document d'**une** page, la première **est** la dernière |
| deux fois la même occurrence | **refusé** | cas dégénéré du même refus |

**La disjonction est DÉCLARÉE, pas calculée, et c'est la contrainte de conception à retenir.** Le
contrat ne connaît pas le nombre de pages : c'est le moteur qui le découvre. Un contrôle qui
intersecterait des ensembles de rangs supposerait donc un `n` que le *save time* n'a pas.
L'invariant s'écrit ainsi comme une **table de compatibilité sur le tuple**, indépendante de `n`.
**Deux propriétés la tiennent, toutes deux mesurées et toutes deux couvertes par un `it`** : elle
est **symétrique** — sans quoi `[a, b]` et `[b, a]` ne rendraient pas le même verdict, puisque le
contrôle compare chaque bande aux **précédentes** en lisant la ligne de la bande **courante** — et
elle **coïncide avec la dérivation depuis les domaines de rangs** pour `n = 1` à `8`, ce qui rend
« déclarée, pas calculée » un raccourci plutôt qu'une autre règle.

**Il n'existe aucune troisième paire, et c'est un fait mesuré, pas une intention :** sur les
vingt-cinq couples, **deux seulement** sont compatibles, et comme elles ne partagent aucun membre,
**un côté ne peut jamais porter plus de deux bandes**.

> ⚠️ **Le refus de `[firstOnly, lastOnly]` est le seul qui coûte une capacité réelle.** Sur un
> document de deux pages ou plus, « un en-tête particulier en première page **et** un autre en
> dernière » est un besoin sensé, et ces deux domaines sont bien disjoints — **sauf sur un document
> d'une page**, où ils désignent la même feuille. Accepter la paire ferait dépendre la validité du
> **nombre de pages**, c'est-à-dire d'une information que le *save time* n'a pas : ce serait
> abandonner la condition 3 du critère d'appartenance et rendre un document licite chez un client
> et ambigu chez un autre. **Le refus est forcé par le critère, pas choisi.** Le contournement est
> honnête : placer l'une des deux bandes de l'autre côté de la feuille, ou fusionner les deux
> intentions dans une `exceptFirst`. *Signal de réouverture :* un modèle livré qui a besoin des
> deux bouts du **même** côté — et ce jour-là, la réponse n'est pas d'assouplir l'invariant, c'est
> de décider ce que le contrat dit d'un document d'une seule page.

**Pourquoi refuser plutôt que définir l'empilement.** Définir l'empilement demanderait trois choses
que le contrat ne peut pas porter : un **ordre**, une **hauteur cumulée** — donc une mesure, que D8
refuse — et une règle de résolution qu'aucun type n'exprime, donc que deux implémentations
écriront différemment. Et le refus ne retire **presque** aucune capacité : un pied courant plus une
bande de dernière page s'écrit `exceptLast` + `lastOnly`, un papier à en-tête plus un rappel
s'écrit `firstOnly` + `exceptFirst`. Le contenu commun est recopié dans le document, ce qui est le
prix visible et assumé. Le mot « presque » désigne exactement le cas de l'encadré ci-dessus.

**Deux pièges que le contrat autorise et que seul un test peut épingler.**

**(1) Sur un document d'une seule page, la dernière page EST la première.** Un modèle dont le pied
`exceptLast` porte la numérotation et dont le pied `lastOnly` porte les mentions produit, sur une
facture d'une page, un document **sans numérotation**. Et E1 — « une facture d'une page sort en
PDF » — est exactement ce cas. **Le comportement est le bon** : la page est la dernière, la bande de
dernière page s'applique. Ce qui serait faux serait de le *refuser* : ce serait une règle de mise en
page. Ce qui est dû, c'est un test qui l'épingle et une phrase dans la docstring de
`PageBandOccurrence` — et c'est pourquoi les **deux** pieds de la fixture de recette portent la
numérotation. Le piège existe **symétriquement** depuis que la paire de première page entre dans le
lot.

**(2) Rien ne borne ce qu'une bande contient, et son contenu peut dépendre des données.** Un
`loop invoice.lines as line` dans un en-tête est **accepté**, et sa hauteur dépend du jeu de
données. Refuser demanderait un parcours récursif du contenu de chaque bande, et un en-tête qui
répète deux ou trois références client est légitime. **Le mode de défaillance réel est nommé et
confié à E2/E3** : une bande dont la hauteur mesurée dépasse la zone imprimable rend la pagination
impossible, et le moteur doit **refuser proprement** plutôt que boucler. Aucun champ du contrat ne
peut l'attraper au *save time*, puisque cela demande de mesurer. *Signal de réouverture :* le
premier modèle livré dont un en-tête porte une boucle.

**Écarté.** (a) `header?: PageBand` + `lastPageFooter?: PageBand` — l'énumération des cas devient
une liste de champs, et chaque cas nouveau est une estampille. (b) Une seule liste avec un champ
`side` — l'invariant devient un contrôle sur deux dimensions et le moteur doit trier pour savoir ce
qu'il dessine en haut. (c) Une occurrence exprimée par une `ConditionNode` autour du contenu —
élégant sur le papier, et c'est le mécanisme qui exige que le numéro de page soit lisible par un
prédicat, donc la porte du point fixe grande ouverte (D7). (d) Un ordre implicite (« la bande la
plus spécifique gagne ») — une règle de résolution non écrite dans le type ; le recoupement étant
refusé, il n'y a rien à résoudre. (e) Une bande avec un `id` propre — le conteneur en a un, et le
premier `findNodeById` qui en rencontrerait deux devrait choisir.

**Irréversible** pour les deux listes, pour le champ `on` et pour les cinq membres du tuple. Le
tuple reste **élargissable** au prix d'une estampille, et l'élargir demande **aussi** d'étendre la
table de compatibilité : coût de rédaction, jamais de migration, et **l'oubli est impossible à
compiler** — mesuré, `TS2741`, parce que `Record` sur l'union exige une ligne par membre. *Signal de
réouverture :* une occurrence dont le domaine ne serait ni « tout », ni un bord — les pages paires,
une section — et ce jour-là c'est la notion de **section** qu'il faut trancher, pas un membre de
tuple.

---

### D7 — La numérotation est un SEGMENT MARQUEUR, jamais une expression

Un troisième membre de `TextSegment` : `{ kind: 'pageField'; field: PageField }` avec
`PAGE_FIELDS = ['number', 'count']`. Le contrat déclare **où** le numéro s'imprime ; il ne le
calcule pas, ne l'évalue pas, ne le formate pas. `core` ne gagne **aucune** entrée d'évaluation,
**aucun** kind d'expression, **aucun** nom réservé dans le jeu de données.

**Ce sujet était le seul arbitrage réellement ouvert du lot.** La roadmap le nomme **deux fois, des
deux côtés de la frontière** : `core.md:177` met la numérotation dans le *pourquoi* de C4,
`engine.md:47` met « numéroter page 2 / 4 » dans E2. Et le critère de recette de C4 **ne la reprend
pas** — de sorte qu'un lecteur de bonne foi pouvait livrer C4 sans une ligne de numérotation et se
croire conforme. La phrase qui devrait trancher, « elle décrit, elle ne produit rien », ne tranche
que la moitié facile : elle interdit à `core` de **calculer** le numéro, elle ne dit pas si `core`
doit permettre de le **placer**. **Arbitrage n° 1, tranché en A** : il doit, parce que `core.md:3-5`
est plus fort que le silence — « tout ce que le contrat ne sait pas exprimer est impossible à rendre
**et impossible à éditer** », et un numéro de page que le contrat ne sait pas placer est un numéro
que l'utilisateur ne pourra ni déplacer, ni traduire, ni supprimer.

**Le critère qui départage les sept mécanismes ne dépend d'aucun goût : le POINT FIXE.** Dès que le
numéro de page devient lisible par un **prédicat**, le contenu peut dépendre de la pagination, qui
dépend du contenu. `if(eq(page.numero, page.total), mentions, rien)` change ce qui tient sur la
dernière page, donc peut changer le total, donc peut changer la condition. Il n'existe aucune
garantie de point fixe : le symptôme est une pagination qui **oscille**, c'est-à-dire un rendu non
déterministe produit par un moteur qui ne lit pourtant ni horloge ni aléa. **E6 figure parmi les
quatre choses qui ne se sacrifient jamais.**

| Mécanisme | Coût au contrat | Exige de l'évaluateur | Point fixe ? | Réserve un nom ? | Traduisible par C6 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** — kind d'expression `pageNumber` | union élargie + estampille | **une troisième entrée** | **oui** | non | oui |
| **B** — kind de segment *(retenu)* | union élargie + estampille | **rien** | **non** | non | **oui, gratuitement** |
| **C** — nœud dédié `PageNumberNode` | union élargie + estampille | rien | non | non | non — c'est un bloc, pas de l'inline |
| **D** — clé réservée injectée | **zéro** | rien | non | **oui — interdit** | oui |
| **E** — portée enfant sous un alias déclaré | un champ + estampille | rien | **oui** | non | oui |
| **F** — rien dans le contrat (compteurs CSS) | zéro | rien | non | non | **non** |
| **G** — champ déclaratif `numbering: { pattern }` | un champ + estampille | un **parseur** | non | non | non — doublon de C6 |

**A est le piège le plus séduisant.** Il rendrait `lastOnly` *dérivable* au lieu de déclaré, ce qui
supprimerait un champ — un vrai gain. Il le paie trois fois : il élargit l'algèbre, donc **toutes**
les positions d'opérande ; il exige une troisième entrée à `evaluateExpression`, alors que
`ports/render.ts` écrit « *There is no third field on purpose* » et que `scope.ts` écrit que le seul
nom ajouté à la portée est « *an alias declared by the template … never one the engine invents* » —
deux docstrings à réécrire pour dire le contraire de ce qu'elles promettent ; et il ouvre le point
fixe.

**B ne demande rien à l'évaluateur, et le dépôt explique déjà pourquoi** : « *a segment is not a
node — it is the inline content of one* ». La branche que B ajoute à `SEGMENT_EXPRESSIONS` rend
`[]`, donc **aucun chemin de données inventé**. Et le `const exhaustive: never` de `visitSegment`
**force** la branche à exister. **B offre C6 gratuitement**, et c'est l'argument qui achève A et G :
« Page », « / », « sur », « of » sont des `literal` du **même** `TextNode`, donc C6 se branche sur
`TextNode.content` et sur rien d'autre.

**D est interdit, et c'est le seul mécanisme dont l'exclusion ne se discute pas.** Injecter
`{ page: { numero, total } }` dans la portée coûte **zéro** au contrat — c'est ce qui le rend
tentant. Il viole frontalement la règle de périmètre d'`AGENTS.md`, il contredit `scope.ts` dans le
**code** et non seulement dans un document, et il produit deux défauts **mesurables** : un
intégrateur dont le jeu de données porte déjà `page` voit sa donnée masquée selon l'ordre du spread,
et `collectDataPaths` **réclamerait `page.numero` à l'appelant** — le playground l'affiche à
l'écran, donc le défaut serait visible à la première démonstration.

**E** respecte l'interdiction de réserver un nom et ne demande rien à l'évaluateur : c'est le
meilleur candidat après B. Il tombe sur le point fixe — un `compare` sur l'alias est immédiatement
écrivable — et sur un quatrième site de masquage d'alias. **F** tombe sur `core.md:3-5`
(inéditable), sur la décision 11 pour ce libellé précis, et sur `viewer.md:35-39`, qui dit
l'inverse. Il faut noter honnêtement le seul texte du dépôt qui le soutient : l'ADR 0002 écrit que
« la numérotation se traite souvent en CSS côté rendu » — mais elle parle des **lignes** d'une
boucle, pas des pages, et C4 apporte l'élément nouveau qui manquait : **une page n'est pas une
ligne**. **G** est un parseur déguisé : `pattern: 'Page {n} / {total}'` réintroduit exactement ce
que l'ADR 0001 a fermé et que `expression/types.ts` écrit comme une propriété du dépôt — « *an
expression is a validated tree, **never a string to parse*** ».

**Ce que B coûte, écrit sans l'atténuer.** Trois choses. **(1)** Une union stockée élargie, donc
l'estampille. **(2)** Une **troisième nature** de contenu inline : littéral, liaison, et maintenant
marqueur. C'est le seul reproche doctrinal formulable, et il est réel — le lecteur de `TextSegment`
doit désormais savoir que tout segment n'est pas résoluble à partir des données. **(3)** Une
conséquence de mise en page que le contrat ne peut pas traiter : la largeur de « 2 » n'est pas celle
de « 10 », donc un pied peut changer de hauteur entre la page 9 et la page 10 — voir l'attente
adressée à E3 plus bas.

**Pourquoi `field: 'number' | 'count'` et non deux kinds.** C'est l'idiome du dépôt : un kind nomme
une **nature**, un champ fermé nomme l'**instance** — `arithmetic` porte `op`, `textCase` porte
`op`, `round` porte `mode`. Deux kinds diraient qu'un numéro et un compte sont deux natures de
contenu ; ils sont la même — un fait que seul le paginateur connaît — et le tuple laisse à un lot
ultérieur la possibilité d'en ajouter un troisième sans ajouter un membre d'union.

**Pourquoi le marqueur est licite PARTOUT, et pas seulement dans une bande.** Le restreindre
exigerait de connaître les **ancêtres** d'un segment, ce qu'aucun schéma Zod local ne peut faire :
il faudrait un contrôle au niveau du `Template`, donc un parcours de l'arbre au *save time*, donc un
refus qui n'est pas décidable localement — et ce serait la **première règle positionnelle** du
contrat. Le confinement obtenu ne serait d'ailleurs pas une propriété du **type** mais d'un **point
d'entrée** : `TextNodeSchema` seul continuerait d'accepter le marqueur. Pour quel gain ? Imprimer
« page 3 » dans le flux d'un document paginé est licite et utile. *Signal de réouverture :* un
modèle livré où un marqueur s'est glissé au milieu d'une phrase.

**Écarté**, outre les six mécanismes : **ne rien livrer et laisser E2 inventer l'emplacement** —
c'est l'option que le silence du critère de recette rendait possible, et elle est refusée par
`core.md:3-5` ; et **livrer aussi un marqueur de report de page** — le report appelle **le même**
mécanisme, et c'est précisément pourquoi il n'est pas livré ici : sa **valeur** est un montant, donc
une échelle et un arrondi, donc l'ADR 0004 décision 12, et son libellé est C6. Le refuser maintenant
coûte une estampille plus tard ; le livrer maintenant coûterait une décision d'arrondi prise en
passant. *Signal de réouverture :* le lot E3, qui trouvera le mécanisme déjà là, en un `field` de
plus.

**Irréversible** — forme stockée. Le tuple `PAGE_FIELDS` est élargissable au prix d'une estampille.

---

### D8 — Aucune hauteur de bande, aucune politique de coupe, aucun saut de page

Le contrat ne déclare **ni** la hauteur d'une bande, **ni** la réserve verticale qu'elle consomme,
**ni** un saut de page, **ni** l'insécabilité d'un bloc, **ni** une politique de veuve ou
d'orpheline.

**Pourquoi aucune hauteur, alors que le moteur en a besoin : parce que le contrat n'en déclare nulle
part.** C'est l'argument décisif, et il est vérifiable — **aucun nœud du contrat ne porte de
dimension**. Un `TextNode` n'a pas de hauteur, un `ContainerNode` non plus, une `TableColumn` porte
un **poids** sans dénominateur, et « la largeur du tableau lui-même n'est pas déclarée par C3 ».
Introduire une hauteur pour la seule bande de page ne serait pas la continuation de ce que fait le
dépôt, ce serait une **exception** — et elle créerait une classe de faute que rien ne peut
trancher : une hauteur déclarée trop petite pour son contenu. Que fait le moteur alors ? Il coupe,
il déborde, ou il refuse : trois politiques, aucune dans le contrat, et le champ n'aurait servi qu'à
créer le désaccord.

**Pourquoi aucun saut de page.** Il passe les conditions 1 et 2 du critère et échoue à la 3 : il
n'est pas décidable sans pagination, puisque son effet **est** la pagination. Il tombe par ailleurs
sous un refus que C3 a déjà écrit nommément.

**Pourquoi l'insécabilité n'est pas dans ce lot alors qu'elle en dépend.** `core.md:223` :
« **C7 — Dépend de : C4** ». C7 est **après**. Livrer `keepTogether` ici préempterait le seul lot
que C4 débloque, exactement comme C3 s'est retenu de le faire. Le lot suivant a besoin de trouver
sa place vide.

**Écarté.** (a) Une hauteur de bande **optionnelle** — un champ optionnel sur une forme stockée,
pour un champ dont le moteur n'a pas besoin. (b) Une réserve exprimée en **lignes de texte** — une
ligne n'a de hauteur qu'avec une police, donc C5, donc une métrique de police, donc une lecture de
la machine, refusée et outillée. (c) `avoidBreak: boolean` sur une bande — une bande ne se coupe
pas ; pour un bloc du flux, c'est C7.

**Réversible** — ce sont des champs non écrits.

---

### D9 — ZÉRO code d'erreur nouveau, ZÉRO site nouveau

`OPERAND_ERROR_CODES`, `LIMIT_ERROR_CODES`, `SHAPE_ERROR_CODES` et `ExpressionErrorSite` sortent du
lot **octet pour octet**. `errors.ts` **n'est pas modifié par C4** — pas même d'une ligne de type,
contrairement à C3.

**Pourquoi c'est possible : les dix-neuf fautes du lot sont décidables au save time.** C'est la
condition 3 du critère, et elle a été écrite pour obtenir ce résultat. Elles se répartissent ainsi :
une page absente ; six sur les dimensions de la feuille ; quatre sur les marges ; trois sur les
bandes ; deux héritées de C3 sans une ligne de code ; une sur le marqueur ; deux sur la forme,
rendues par le garde existant. **Aucune n'a besoin d'un jeu de données, aucune n'a besoin de savoir
combien de pages sortiront.**

**Pourquoi aucun site, alors que C3 en a ajouté un.** Un `ExpressionErrorSite` existe pour nommer
une **position qui porte une expression sans en être une**. `PageSetup` n'en porte aucune : la
feuille et les marges sont des nombres, l'occurrence est une énumération, et le contenu d'une bande
est un `ContainerNode` dont les expressions internes sont déjà couvertes par les sites existants —
une condition dans un pied de page échoue au site `condition`, ce qui est exact. Et le marqueur
n'est pas une expression : il ne s'évalue pas, donc il n'échoue pas.

**Une réserve à écrire, parce qu'elle est réelle et qu'elle n'est pas de ce lot.** Deux messages que
le lot fait apparaître sont mauvais, et aucun ne vient de C4 : *Invalid input: expected number,
received number* pour une dimension infinie, et la cascade de **deux** issues pour un contenu de
bande qui n'est pas un conteneur — `invalid_value` sur `…content.type` **et** `invalid_type` sur
`…content.children`, parce que `ContainerNodeSchema` est un objet et non une union discriminée. **Un
troisième, propre à ce lot et à consigner :** un `field` ou un `on` **absent** rend le message des
options invalides et non « champ requis », parce que `z.enum` traite `undefined` comme une option
inconnue — exact, et trompeur. Les trois sont écrits ici pour que C8 les trouve ; les corriger
demanderait de remplacer les énumérations par des unions de littéraux, ce qui changerait aussi les
messages de valeur inconnue.

**Écarté.** (a) Un code `page-geometry` pour l'invariant croisé — la faute est refusée par Zod au
save time, avec un chemin et un message constants. (b) Un site `page` — rien dans `PageSetup`
n'évalue une expression. (c) Un code `no-page-context` pour un marqueur rendu hors pagination — il
n'existerait que si le marqueur était une expression, et il ne l'est pas : c'est l'un des bénéfices
de D7 qu'il faut compter.

**Sans objet** en réversibilité : rien n'est ajouté.

---

### D10 — `collectTemplateDataPaths` : la promesse « le modèle dit ce qu'il lit » couvre les bandes

`core` exporte `collectTemplateDataPaths(template: Template): readonly string[]`, qui réunit les
chemins lus par `template.root` **et** par le contenu de chaque bande. `collectDataPaths` n'est
**pas** modifié.

**Pourquoi c'est obligatoire, et pas une commodité.** Parce que sans cette fonction, C4 **casse une
promesse écrite**, en silence, dans **deux fichiers de production** : `ports/render.ts` dit que le
jeu de données appartient à l'appelant et que « *`collectDataPaths` tells the caller which ones* » ;
`template.ts` dit qu'un `Template` enregistre ce qu'il **lit** et que « *`collectDataPaths` recovers
exactly that* ». Après D2, les bandes vivent hors de `root` : une liaison dans un en-tête devient
**invisible** pour toute analyse. **Le symptôme n'est pas une erreur, c'est un blanc.**

**Et le défaut est visible à l'écran**, ce qui rend la démonstration non décorative : le playground
affiche la liste des chemins. Il lit désormais `societe.mentionsLegales` **dans le pied de dernière
page et nulle part ailleurs** — vérifié dans le navigateur : la clé figure dans la liste, et elle
n'y figure que parce que l'analyse descend dans les bandes.

**Pourquoi une fonction nouvelle et pas une signature élargie.** Élargir `collectDataPaths` à
`DocumentNode | Template` obligerait à discriminer un `Template` d'un `ContainerNode` **à
l'exécution** — les deux sont des objets — donc à tester une propriété, c'est-à-dire à écrire un
contrôle de forme dans une fonction d'analyse ; et la fonction la plus regardée du paquet changerait
de contrat pour tous ses appelants actuels. Semer l'ensemble d'alias depuis l'extérieur ne résout
rien : le problème n'est pas la portée mais le **périmètre du parcours**. Une fonction de niveau
document laisse le contrat de nœud intact, et **aucune règle de portée n'est dupliquée** — la
descente reste écrite une seule fois, dans `collectFrom`, ce qu'un `it` vérifie : une boucle dans
une bande rapporte sa source et pas son alias.

**Ce que la fonction ne fait pas**, écrit pour ne pas rejouer le défaut que l'ADR 0002 reproche à
une ancienne docstring — *elle promettait, et elle mentait*. Elle **dé-duplique** entre les bandes et
le flux. Elle n'ordonne rien de garanti au-delà de « ordre de parcours », et le parcours retenu est
**`root`, puis `header`, puis `footer`** — écrit ici parce qu'un test qui compare une liste ordonnée
épingle un choix, et qu'un choix non écrit se change par accident. Elle hérite des **trois limites**
que `collectDataPaths` consigne déjà, et C4 n'en corrige aucune et n'en ajoute aucune. Et elle ne
rend **rien** pour un marqueur de numéro.

> ⚠️ **Un second trou s'ouvre avec les bandes, il n'est pas celui-ci, et C4 ne le referme pas :
> l'UNICITÉ des identifiants de nœud.** Jusqu'ici un modèle avait **une** racine, `root`, et
> `findNodeById(root, id)` voyait tout. Avec les bandes, un document a **une racine par bande, plus
> `root`** : deux nœuds de deux bandes différentes peuvent porter le même `id` sans qu'aucun schéma
> ne s'en plaigne, et `findNodeById(template.root, id)` ne trouvera jamais un nœud d'en-tête. Le
> motif de ne pas le refermer est **mécanique plutôt que doctrinal** : une règle d'unicité
> inter-racines devrait vivre dans un `superRefine` de niveau `Template`, et la migration de D11
> écrit des bandes **vides** — donc aucun identifiant — mais le jour où une migration ultérieure
> injecterait une bande garnie, elle produirait un document que son propre parse pourrait refuser.
> *Signal de réouverture, et il est daté :* le jour où l'éditeur adresse un nœud par identifiant à
> travers tout le modèle, il lui faudra soit un `findNodeInTemplate`, soit cette règle — et ce sera
> un lot de designer, pas un rattrapage de C4.

**Écarté.** (a) Ne rien livrer et documenter le trou — refusé parce que la promesse est écrite dans
deux fichiers de **production** et affichée dans le playground ; un trou documenté qui contredit une
docstring existante n'est pas de la transparence, c'est deux textes qui se contredisent.
(a′) Exporter la **liste des racines** (`documentRootsOf`) plutôt qu'un collecteur : l'idée est
meilleure sur un point — toute traversée future deviendrait complète **par construction** — et perd
sur un autre : **personne ne l'appelle aujourd'hui**. *Signal de réouverture, et il est proche :* le
**deuxième** consommateur — le premier `findNodeInTemplate`, ou le validateur d'unicité ci-dessus.
Ce jour-là, `collectTemplateDataPaths` se réécrit **au-dessus** de `documentRootsOf`, et c'est trois
lignes. (b) Livrer aussi un `findNodeInTemplate` — personne ne l'appelle. (c) Masquer
`collectDataPaths` — l'éditeur analysera des fragments, donc les deux ont un appelant.

**Réversible** — du code sans forme stockée.

---

### D11 — `CURRENT_SCHEMA_VERSION` passe à 5, et c'est la PREMIÈRE MIGRATION TRANSFORMANTE du dépôt

L'entrée `{ from: 4, to: 5 }` est **ajoutée** à `TEMPLATE_MIGRATIONS`, jamais fusionnée avec les
trois précédentes, et son `migrate` **transforme** : il écrit une page de compatibilité sur tout
document qui n'en a pas, puis estampille.

**Deux formes stockées changent, dans les deux directions, et une seule estampille les couvre.**
Vers le large, `TextSegment` accueille `pageField` : un build v4 rend `invalid_union` / « No
matching discriminator » sur un chemin qui désigne un `kind` **correctement orthographié**. Vers
l'étroit, `Template` exige `page` : un build v4 ignore le champ et le **supprime** sans une issue. Le
second cas est le plus dangereux parce qu'il est **silencieux** — un éditeur qui ouvre puis
enregistre efface la page.

> ⚠️ **Le chemin de démonstration doit être dans `root`, et une première rédaction du plan le
> plaçait sous `page.footer…` — c'était impossible, et la mesure a été rejouée.** Un `z.object` v4
> ne connaît pas la clé `page`, donc il la **supprime sans regarder dedans** : rien de ce qui vit
> sous `page` n'est validé par un build antérieur, donc rien de ce qui vit sous `page` ne peut
> produire d'issue. **L'erreur n'affaiblit pas l'argument, elle le durcit** : le marqueur est licite
> **partout** où un `TextNode` existe, `root` compris, donc l'élargissement est bien détectable là
> où les modèles réels l'écriront le plus souvent ; et là où il ne l'est pas — sous `page` — c'est
> parce que la **seconde** incompatibilité, silencieuse, l'a déjà avalé.

**Pourquoi la migration transforme, alors que les trois précédentes se contentent d'estampiller.**
Parce que `page` est **requis** et qu'une migration identité laisserait tout document v4
irrecevable. Ce serait un **rétrécissement** réel, le cinquième de la liste que porte l'hypothèse
pré-v1.0, et **le premier qui ne soit pas vide en extension** : les quatre existants refusent des
valeurs qu'aucun document ne pouvait porter, celui-ci refuserait **tous** les documents v4. La
migration transformante supprime le rétrécissement, et c'est la propriété qu'elle achète.

**Ce que la migration écrit, et pourquoi c'est assumé plutôt que caché.** Un A4 portrait à marges de
20 mm, sans bande. **Openview choisit donc une feuille**, une fois, pour des documents écrits avant
que la question existe.

1. **Ce n'est pas une lecture de l'environnement — mais c'est un défaut culturel, et aucun outil ne
   le verra.** A4 est une **constante** du code : ni locale, ni fuseau, ni horloge, donc le plugin
   `no-environment-read` est muet et il a raison de l'être. Il faut néanmoins concéder l'autre
   moitié : **A4 est le format d'une partie du monde**, et l'écrire dans une migration est une
   **locale déguisée en constante**. C'est pourquoi ce choix n'a pas été *déduit* : c'est
   l'arbitrage n° 4, **tranché en A par le propriétaire du produit le 2026-08-18, feuille de
   compatibilité explicitement validée**.
2. **Ce n'est pas un défaut de schéma.** Un `z.default()` réécrit le document **à chaque parse**, en
   silence, pour toujours ; la migration l'écrit **une fois**, sur un document estampillé 4, et le
   résultat est visible dans le document enregistré. La première forme est une règle cachée, la
   seconde une conversion datée.
3. **Ce n'est pas une position par défaut de fait pour les nouveaux modèles.** Aucun modèle écrit
   après C4 ne passe par cette migration : le champ étant requis, son auteur l'écrit. Ce qui se
   recopiera, c'est la page du **modèle livré** de D9 du designer, et ce choix-là appartient à ce
   lot-là.

**Le test `'page' in input` n'est pas du bruit défensif et ne se remplace pas par un ordre de
spread.** Un document hand-made estampillé 4 peut déjà porter une page — l'estampille ne garde que
vers le haut — et **mesuré**, les deux écritures font des choses **opposées** :
`{ ...input, page: DEFAUT }` **écrase** la page de l'auteur, `{ page: DEFAUT, ...input }` la
préserve. La seconde se trouve être juste, ce qui est **pire que faux** : elle est correcte **par
ordre de clé**, donc le prochain lecteur qui range l'objet par souci de propreté détruit des mises
en page en silence. Le test explicite dit ce qu'il veut dire, et un `it` l'épingle.

**`COMPATIBILITY_PAGE` est ANNOTÉE `PageSetup`, et l'annotation est la seule chose qui la
contrôle.** `TemplateMigration.migrate` est typé `(input: Record<string, unknown>) =>
Record<string, unknown>`, donc la valeur écrite dans `page` est reçue comme `unknown` et le registre
ne vérifie rien. **Vérifié par ablation à la livraison** : privée de son `footer`, la constante
annotée rend `TS2741` à la porte 2 ; sans annotation, la même constante incomplète passe les quatre
portes en silence et la migration produit une page que le parse refuse **ensuite**, avec un message
qui accuse le document alors que la faute est dans la migration.

**Le double garde de `parseTemplate` sert enfin à quelque chose, et c'est mesuré.** `migrate.ts`
explique que le garde tourne deux fois parce qu'« une future migration TRANSFORME […] donc elle peut
PRODUIRE une forme hors bornes à partir d'une entrée conforme ». **C4 est cette migration, la
première.** Mesuré par bissection : un document v4 de **7 niveaux et 16 valeurs** ressort à **7
niveaux et 27 valeurs** — la page ajoute **onze valeurs et aucun niveau**, parce que `page.margins`
est aussi profond que `root.children`. La règle que le dépôt s'était donnée est donc tenue par cette
entrée, et un `it` en fait la contre-épreuve : sous un plafond de **20** valeurs, l'entrée passe le
**premier** garde et seule la **sortie** est refusée.

**Écarté.** (a) Ne pas estampiller au motif que l'ajout est additif — il ne l'est pas, et
`AGENTS.md` §1.2 ferme la porte d'une phrase : « il n'y a pas de dérogation pré-v1.0 au
versionnement ». (b) Fusionner avec `{ from: 3, to: 4 }` — rompt le contrat pas-à-pas et fait mentir
le test de composition. (c) Une migration identité plus un rétrécissement assumé — ajoute un
cinquième rétrécissement pour économiser quatre lignes. (d) Une migration qui **déduirait** la
feuille du contenu (« ce modèle a un tableau large, donc paysage ») — une migration qui devine une
intention **corrompt**. (e) Deux estampilles, une par forme stockée — le numéro désignerait un état
de branche, jamais une forme.

**Irréversible.**

> ⚠️ **La conséquence à ne pas perdre de vue : presque rien de mécanique n'exige ce bump.** Comme
> pour C3, le seul test qui rougit sur l'estampille elle-même est celui qui énumère la chaîne —
> l'attendu littéral passe de `[[1,2],[2,3],[3,4]]` à `[[1,2],[2,3],[3,4],[4,5]]`. Aucun
> compilateur, aucun lint, aucune couverture ne réclame l'incrément. **En revanche, et c'est nouveau
> par rapport à C3, la transformation a bien un filet** : `page` étant requis, un document v4 non
> transformé échoue au parse, donc tout test qui charge un document v4 rougit si le `migrate` oublie
> d'écrire la page.

**La règle de conduite du lot, et elle est plus stricte que celle des trois lots précédents.**
INC-1, INC-2 et INC-3 sont **non publiables** ; le premier commit publiable est INC-4. Les trois
estampilles précédentes couvraient des lots **purement élargissants** : un build de mi-lot lisait
encore **tous** les documents existants. INC-1 **rétrécit** — `page` devient requis avant que la
migration existe — donc un build pris entre INC-1 et INC-4 **refuse tout document v4**, fixtures du
dépôt comprises. Deux conséquences opérationnelles : **le lot atterrit en une seule PR**, jamais par
fusions successives sur `main`, et **aucun artefact intermédiaire ne quitte la branche**. Rien de
mécanique ne l'applique : c'est une règle de la septième colonne du tableau d'`AGENTS.md`, « revue
humaine uniquement ».

---

### D12 — Aucun plafond nouveau, et les mesures qui l'autorisent

Ni plafond de bandes, ni plafond de profondeur propre à une bande, ni champ nouveau
d'`EvaluationLimits`. `DEFAULT_SHAPE_LIMITS` reste `{ maxDepth: 64, maxNodes: 100_000 }`. Trois
bornes de bonne formation seulement, toutes sur des champs **neufs** : une dimension de feuille dans
`[1, 5080]`, une marge dans `[0, 5080]`, et au plus une bande applicable par page et par côté.

**Une bande coûte exactement trois niveaux JSON** — `page`, la liste, l'indice, moins celui que
`root` coûtait déjà — mesuré par bissection dans les deux positions. La marge sous `maxDepth` reste
large sur le modèle de recette combiné, parce que le chemin le plus profond passe par le **tableau**
et non par la page.

> ✅ **Le défaut C-13 du plan C3 ne se rejoue pas, et c'est vérifié plutôt que supposé.** C3 a dû
> réécrire la docstring de `ShapeLimits.maxDepth` parce que son modèle de recette rendait fausse la
> mesure qu'elle annonce. La question se pose donc à l'identique ici. **Réponse mesurée : non.** La
> docstring dit « *18 for the five-column table of lot C3 […] 64 leaves a threefold margin* », et le
> modèle de recette combiné pèse **18** — la phrase reste vraie **au mot**. Le seul cas qui la
> dépasse est un **tableau placé dans une bande**, à 21 niveaux — un modèle que personne n'écrit — et
> qui laisse encore un rapport de 3,05×. **`guard.ts` n'est donc pas touché par C4 sur ce point**, et
> ce non-geste est écrit ici parce que les deux lots précédents ont chacun dû faire le geste.

**Pourquoi aucun plafond de bandes.** Parce que `maxNodes` borne déjà, indirectement et mieux :
**mesuré**, plus de six mille bandes sont acceptées sous le défaut avant que `too-many-nodes` ne
réponde. Un `MAX_PAGE_BANDS` serait une seconde chose à tenir en phase avec la première, pour un cas
qu'aucune mesure ne montre — un modèle réel en porte deux ou trois — et il constituerait un
rétrécissement pour un besoin inexistant.

**Côté évaluation, aucun chiffre de budget n'est avancé, et il faut dire pourquoi.** Le contenu
d'une bande est évalué **une fois par page** par un moteur qui n'existe pas encore, donc le budget
d'un document paginé n'est pas mesurable dans ce dépôt. Ce que l'on peut dire sans mesure abusive
est une **forme** : le coût est linéaire en nombre de **pages**, et le nombre de pages n'est pas une
donnée du modèle. C'est **E8** qui remettra la mesure, et le contre-exemple à surveiller est nommé —
une bande dont le contenu porte une agrégation, réévaluée à chaque page.

**Écarté.** (a) Un `MAX_PAGE_BANDS` — mesuré inutile. (b) Un plafond de **pages** — le nombre de
pages n'est pas dans le modèle, il est produit par le moteur ; le borner demanderait un champ
d'`EvaluationLimits`, donc une méthode de budget, donc un code de refus, les trois refusés. (c)
Relever `maxDepth` parce qu'une bande coûte trois niveaux — relever un défaut parce qu'un lot neuf
s'en approche est la manière ordinaire dont un garde devient décoratif. (d) Refuser un tableau dans
une bande — irréalisable sans refuser aussi les conteneurs, et `too-deep` répond déjà avec un code
typé qui existe.

**Réversible dans un seul sens**, et il faut le nommer : ne rien borner ne coûte rien à défaire côté
code, mais l'ajouter plus tard serait un rétrécissement sans migration possible.

---

### D13 — Ce que le lot refuse, par écrit : DIX-NEUF refus

Un refus qu'on n'écrit pas est un refus qui sera demandé, accordé, et découvert trop tard.

**Pagination — cinq refus.**

- **Le saut de page manuel** (`pageBreakBefore`, `breakAfter`). *Motif :* il échoue à la condition 3
  du critère — son effet **est** la pagination — et C3 l'a déjà refusé nommément.
  ⚠️ **Et il faut ajouter ce que C4 découvre en le refusant : ce besoin n'a AUCUN propriétaire dans
  le dépôt.** Vérifié — aucun lot de `core.md` ni d'`engine.md` ne nomme le saut de page explicite ;
  C7 ne couvre que l'insécabilité. Le refuser ici est juste, mais le refuser **sans le signaler**
  laisserait un besoin orphelin qu'on accorderait un jour en catastrophe. **Un propriétaire doit
  être désigné, ou le besoin passer explicitement hors v1.**
- **L'insécabilité** (`keepTogether`, `breakInside`). *Motif :* « C7 — Dépend de : C4 ». C7 est
  après, et C4 ne préempte pas le seul lot qu'il débloque.
- **La veuve, l'orpheline, le point de coupe.** *Motif :* `engine.md:44-50` les attribue au moteur.
- **La hauteur ou la réserve verticale d'une bande.** *Motif :* D8.
- **Le report de page et son libellé.** *Motif :* « le seul calcul que le moteur décide lui-même » ;
  sa valeur est un montant, donc une échelle et un arrondi, donc l'ADR 0004 décision 12. *Signal :*
  le lot E3, qui trouvera le mécanisme de D7 déjà en place — un `field` de plus, pas une invention.

**Format et unité — trois refus.** Tout **nom de format stocké** ; un champ **`orientation`** ; une
**unité déclarée par le document** (`{ value, unit }`, `'210mm'`).

**Apparence — deux refus.** Le **fond de page, le filigrane, le cachet, la couleur du papier** —
périmètre de C11 et de D10 du designer, et ce sont explicitement des **calques**. ⚠️ **Une bande ne
peut pas les récupérer, et il faut le dire parce que la tentation viendra :** une bande **occupe de
la place** en haut ou en bas de la feuille, un filigrane est **derrière le flux, au milieu** — ce ne
sont pas deux réglages du même objet. Point de vigilance : l'ordre de sacrifice fait des calques le
**deuxième candidat à la coupe**, et si les calques sortent du v1, le filigrane perd son porteur ; ce
ne sera toujours pas à C4 de le reprendre. Et **toute police, filet, couleur, espacement ou
alignement dans `PageSetup`** — périmètre de C5, et la condition 1 les tue tous.

**Numérotation — trois refus.** Tout **motif formaté** (`'Page {n} / {total}'`) — c'est un parseur,
avec son échappement et sa surface d'injection. Toute **position déclarée**
(`position: 'footer-center'`) — les bandes disent déjà **où**. Un **numéro de départ, une remise à
zéro, des chiffres romains, une numérotation par section** — les sections n'existent pas dans le
contrat, et la forme des chiffres est C6.

**Données — deux refus, irréversibles au sens fort.** Toute **clé réservée** dans le jeu de données
ou dans la portée. Et **toute feuille déduite de quelque chose** — du jeu de données, de la locale
de la machine, d'un en-tête HTTP, d'une préférence système : outillé par Biome dans `core` et
`engine`, et E6 en dépend. A4 dans la migration est une **constante assumée**, jamais une
adaptation.

**Structure — quatre refus.** Plusieurs pages ou sections aux **formats différents** ; le
**recto-verso, les pages en vis-à-vis, la marge de reliure, le fond perdu, les repères de coupe** —
ce n'est pas un refus de conception, c'est un **silence** que ce lot décide de ne pas rompre ; les
**colonnes de texte** sur la page — périmètre de C11 ; et **tout plafond nouveau** — D12.

> 🗳️ **Un vingtième refus a été RETIRÉ par la décision du 2026-08-18, et c'est le seul.** Une
> rédaction antérieure refusait « les variantes de première page » au motif que le critère de
> recette nomme la dernière page et jamais la première, en le qualifiant de « refus le plus fragile
> de la liste ». L'arbitrage n° 6 a été tranché en **B** : les deux membres entrent dans le lot. Le
> retrait n'ouvre ni le saut de page, ni la hauteur de bande, ni la numérotation par section, et il
> **ne livre pas le report**.

**Les trois qui seront demandés dès la première vraie facture.** Ce ne sont pas les plus
discutables, ce sont les plus **prévisibles**.

1. **La page de garde non numérotée** — et elle remplace, dans cette liste, « la variante de
   première page » que la décision vient de livrer. **C'est précisément parce que `firstOnly` existe
   qu'elle devient prévisible :** dès qu'un modèle peut donner une allure propre à sa première page,
   la demande suivante est « et ne la numérote pas », puis « et compte à partir de la deuxième ».
   *Contournement d'aujourd'hui :* poser la numérotation dans une bande `exceptFirst`, ce qui
   supprime le numéro de la page 1 — **et ne renumérote rien** : le marqueur `number` rendra `2` sur
   la deuxième page. Le contournement couvre donc **la moitié** du besoin, et la moitié qu'il ne
   couvre pas est un **numéro de départ**, refusé ci-dessus.
2. **Le saut de page manuel**, demandé par la première annexe. *Contournement :* aucun. **Ce qu'il
   faut refuser en attendant :** un `PageSetup.breakBefore: string[]` listant des identifiants de
   nœuds — une référence croisée dans un contrat qui n'en a aucune, et un identifiant devenu
   orphelin par une simple suppression de bloc.
3. **Une hauteur d'en-tête**, demandée par le premier en-tête qui déborde. *Contournement :* aucun
   dans le contrat. **Ce qu'il faut refuser en attendant :** la version « inoffensive » du champ,
   `minHeight`, qui est le même champ avec un nom qui promet moins.

**Irréversible pour les deux refus de la famille Données** ; **réversible pour les autres** au prix,
chaque fois, d'un champ neuf et d'une estampille — jamais d'une migration transformante, ce qui est
précisément la propriété que cette liste protège.

---

## Conséquences

### Attentes envers `@openview/engine`, et l'une d'elles décide de la convergence de la pagination

Le contrat déclare **où** une bande se place et **sur quelles pages**. Il ne dit ni comment le
moteur la répète, ni ce qu'il fait si elle ne tient pas — écrire dans le contrat ce que le moteur
décidera est la faute que C3 a dû réparer dans ses propres docstrings. Ces attentes vivent donc
**ici** et non dans le code.

> ⚠️ **Attente envers E3 : la hauteur réservée pour une bande ne doit pas dépendre de la bande
> effectivement dessinée.** Si le moteur réserve la hauteur de la bande `lastOnly` seulement sur la
> page qu'il croit dernière, il crée une **boucle** : une bande de dernière page plus haute que la
> courante réduit la zone de texte de cette page, ce qui peut renvoyer du contenu sur une page
> suivante, qui devient alors la dernière — et la page précédente doit reprendre le pied courant, ce
> qui lui rend de la place, ce qui rappelle le contenu. **La pagination oscille**, sans qu'aucune
> horloge ni aucun aléa ne soit en cause, et le déterminisme de E6 tombe sur un document
> parfaitement licite. **La parade connue est de réserver, sur chaque page, la hauteur de la plus
> haute bande applicable de ce côté**, donc de rendre la zone de texte indépendante du rang. Le
> contrat ne peut pas l'imposer — il ne mesure aucune hauteur — mais il peut l'écrire pour que E3 ne
> le redécouvre pas dans un PDF qui vacille.

**Et il faut reconnaître une SECONDE boucle, que ce lot ouvre lui-même en refusant la hauteur
déclarée.** Le marqueur de numéro est substitué **par page** : « 9 » et « 10 » n'ont pas la même
largeur, donc un pied peut passer d'une ligne à deux entre la page 9 et la page 10, donc la hauteur
utile change, donc la pagination peut changer. Elle est **d'une autre nature** que la première :
elle ne dépend d'aucune écriture de l'auteur, elle est bornée, et elle n'a pas de point fixe à
chercher dans un espace de conditions — seulement une hauteur à réserver. La parade est la même, en
tenant compte du plus large numéro possible. **Le contrat ne permet pas de calculer cette réserve ;
il oblige à la prendre.**

**La paire de première page n'ajoute aucun risque d'oscillation**, et c'est une propriété qui vaut
d'être écrite : la page 1 est connue **avant** la moindre mise en page, alors que « la dernière » ne
se sait qu'à la fin. L'attente ci-dessus ne porte donc que sur les bandes de fin.

**E1** reçoit la feuille, ses marges et la zone imprimable, et n'a plus rien à inventer. **E2**
reçoit les bandes à répéter et le marqueur à substituer. **E5** reçoit la géométrie qui rend une
découpe calculable et comparable. Et **E1 doit une sonde** : la valeur de `MAX_SHEET_MM`, jouée
contre l'adaptateur PDF réellement retenu et non contre une spécification.

### Pour `@openview/viewer`

V1 peut dessiner une feuille sans attendre un moteur, et il doit obtenir sa zone de texte de
`printableAreaOf` plutôt que de la recalculer — c'est la seule chose qui transforme l'accord de la
décision 7 en **dépendance**. Le playground le fait déjà, ce qui donne à la fonction ses trois
consommateurs.

### Pour `@openview/designer`

`packages/designer/src/types.ts` sort du lot **inchangé**, et c'est un résultat plutôt qu'un oubli :
C4 n'ajoute **aucun type de nœud**. Le marqueur est un *segment*, la page est un *champ de
document* : ni l'un ni l'autre n'est un bloc que l'utilisateur insère, donc `BlockType` — dérivé de
`BlockNode['type']` depuis C3 — n'a pas à bouger. **Le lot ne modifie qu'un seul paquet de
production.**

Ce qui viendra plus tard : un panneau « mise en page » (choisir une feuille dans
`STANDARD_SHEETS_MM`, régler quatre marges, éditer les bandes) et un moyen d'insérer un marqueur.
C'est D2 et D4 de l'éditeur, après la vague 2. Rien à faire aujourd'hui, et rien à réserver.

### Pour C5, C6 et C7

**C5** reçoit une zone imprimable dans laquelle régler des espacements et des filets : c'est la
raison pour laquelle C4 passe avant lui, alors que la roadmap ne déclare pas ce lien — rien
n'empêcherait mécaniquement de les inverser, et l'inversion coûterait une reprise de C5. **C6**
reçoit un marqueur à formater et jamais une chaîne déjà formatée, et il se branche sur
`TextNode.content` sans position de contenu nouvelle. **C7** trouve sa place vide, délibérément.

---

## Ce qui reste ouvert

**Une seule question, et elle n'est attribuée à personne : qui déclare qu'un document change de
format en cours de route ?** Une annexe en paysage au milieu d'une facture A4 n'est pas exprimable,
et ce lot n'a aucune information pour trancher — les options (un champ `pages`, une notion de
section, un second document) supposent toutes une décision de produit que rien n'appelle
aujourd'hui. C'est le traitement que l'ADR 0005 a réservé à la direction d'écriture : consignée,
sans recommandation.

---

## Huit signalements, qui ne sont pas des décisions

Ceux-là ne demandaient pas de choisir : ils demandaient d'**inscrire quelque part** un fait que ce
lot a mis au jour. Quatre appellent une action qui n'est pas de C4.

| # | Ce que le lot a mis au jour | Ce qu'il faut en faire |
| :--- | :--- | :--- |
| **A** | **Le poids réel est L**, la roadmap écrit **M** (`core.md:184`). Et C3, coté M par la même roadmap, est sorti à L — 20 fichiers, +2 312/−275. La conclusion utile n'est pas « C4 est sous-estimé » mais « **les deux lots que la roadmap cote M sortent à L** » | Information sur l'**échelle du tableau des poids**, pas sur ce lot. Au propriétaire du produit de corriger la roadmap ou d'assumer l'écart par écrit — la roadmap n'est PAS corrigée ici, ce serait rouvrir l'ordonnancement de la vague 1 en passant |
| **B** | « **C4 ne débloque aucun lot en aval** » (`c1, §1`, repris par `c2, §1`) est **faux** : `core.md:223` donne « C7 — Dépend de : C4 », et C8 dépend de « C1 à C7 » | Les deux lignes sont nommées ici, **sans réécrire** les plans périmés — la forme que C3 a retenue pour la moitié « C3 » de la même phrase |
| **C** | `ast/types.ts`, docstring **publiée**, attribuait la numérotation à E2/E3 sans distinguer valeur et emplacement | **Fait** — corrigée dans le lot, dans l'incrément qui rendait la phrase trompeuse |
| **D** | Le **saut de page explicite** n'a **aucun propriétaire** — vérifié sur `core.md` et `engine.md` | Désigner un lot, ou l'inscrire hors v1 (D13) |
| **E** | Le **filigrane** dépend des calques, et les calques sont le **deuxième candidat à la coupe** de l'ordre de sacrifice | Arbitrer **hors de C4** : une bande ne peut pas les porter (D13) |
| **F** | L'**unicité des identifiants** de nœud n'est plus garantie : un document passe d'une racine à une racine par bande | Accepté par écrit, avec son signal daté (D10) |
| **G** | Le **critère de couverture par fichier** de l'ADR 0005 devient **ambigu** : sa sonde cherche « le premier chemin finissant par `fixtures.ts` » avec `find`, et C4 en crée un **second** — elle mesurerait alors un fichier au hasard de l'ordre des clés, **en restant verte** | **Reformuler la sonde** : filtrer au lieu de chercher, et échouer bruyamment si le compte n'est pas celui attendu. Ce n'est pas une correction de l'ADR 0005 — elle fait foi sur ses décisions — c'est un avis, et la forme corrigée est dans le plan §6.4 |
| **H** | **Aucune des quatre portes bornées publiques n'est une frontière de persistance**, et rien ne le disait. `parseExpression`, `parseDocumentNode`, `parseBlockNode` et `parsePageSetup` rendent un objet dont les clés inconnues ont été **supprimées** — mesuré. Un intégrateur qui parse un fragment puis l'enregistre efface un champ d'une version future, sans erreur | **La frontière est écrite ici : seul le `Template` estampillé est persistable.** La docstring de `parsePageSetup` le dit ; **les trois autres restent à compléter, hors de C4**, parce que ce lot ne touche pas à leurs lignes. C4 ajoute la **quatrième instance** d'une propriété du dépôt, pas la première |

---

## Le relevé des sept arbitrages, tranchés le 2026-08-18

Sept questions que le plan ne pouvait pas trancher seul, parce qu'aucune ne se lit dans un texte du
dépôt. **Le propriétaire du produit les a tranchées le 2026-08-18.** Les branches non retenues sont
consignées : une ADR qui ne garderait que les options gagnantes ferait passer sept décisions de
produit pour des évidences de conception, et le prochain lot qui voudra rouvrir l'une d'elles
n'aurait ni le motif ni le coût sous les yeux.

| # | Question | Décidé | Écart avec la recommandation du plan |
| :-- | :--- | :--- | :--- |
| 1 | La numérotation entre-t-elle dans C4 ? | **A** — le marqueur `pageField`, sans expression ni clé réservée | aucun |
| 2 | Comment la feuille est-elle exprimée ? | **A** — millimètres fractionnaires ; l'option **EMU** (unité entière commensurable) est écartée sur la lisibilité seule | aucun |
| 3 | `orientation` est-il un champ ? | **A** — non ; question **dérivée** du n° 2, pas un arbitrage autonome | aucun |
| 4 | Que fait la migration `4 → 5` d'un document sans page ? | **A** — transformante, feuille de compatibilité **A4 portrait 20 mm explicitement validée** | aucun — et le mandat que D11 réclamait est **levé** |
| 5 | `collectTemplateDataPaths` entre-t-il dans le lot ? | **A** — oui ; il tient un contrat **déjà publié**, ce n'est pas une décision produit | aucun |
| 6 | Les variantes de **première** page entrent-elles ? | **B — `firstOnly` et `exceptFirst` MAINTENANT** | ⚠️ **la décision écarte la recommandation A** |
| 7 | `printableAreaOf` entre-t-elle dans le lot ? | **A** — oui, sur le motif de la **centralisation du calcul**, pas d'une garantie au pixel | motif reformulé, pas verdict |

**Ce que le n° 6 a changé, et ce qu'il n'a pas changé.** Il a fait passer `PAGE_BAND_OCCURRENCES` de
trois à **cinq** membres, la table de compatibilité de trois à cinq lignes, ajouté quatre couples
refusés et retiré un refus de D13. Il n'a changé **ni le nombre d'incréments, ni l'estampille, ni un
seul export du barrel** — les 22 noms sont inchangés, parce que les deux membres entrent dans un
tuple déjà exporté. **Et c'est l'arbitrage qui a le plus profité d'être tranché avant l'exécution :**
la correction de l'invariant de bandes est passée à cinq occurrences dans le même geste, là où la
découvrir *après* l'ajout de `firstOnly` aurait signifié quatre couples fautifs de plus,
silencieusement acceptés.

---

## Le protocole des mesures

Les chiffres marqués **MESURÉ** dans ce document viennent de deux campagnes, et la distinction est
écrite parce qu'elles n'ont pas la même autorité.

**Les mesures de conception**, prises pendant la rédaction du plan : bac à sable **hors du dépôt**
(`git status` identique avant et après), `tsconfig` étendant `tsconfig.base.json` et reprenant les
options de `packages/core/tsconfig.json` — donc `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, NodeNext —, jonction vers le `zod@3.25.76` du dépôt importé via
`zod/v4`, `tsc` 7.0.2 du dépôt, Node v24.11.1, et les mesures d'exécution jouées contre un build de
`main`. Les bornes de profondeur et de valeurs ont été obtenues par **bissection**. Deux contrôles de
calibrage rendaient ces chiffres comparables à ceux du plan C3 : `RECIPE_TEMPLATE` mesuré à 18
niveaux / 231 valeurs, et 56 `round` imbriqués acceptés sous un texte de `root` — les deux chiffres
exacts que C3 annonce.

**Les mesures rejouées à la livraison**, sur le dépôt lui-même : les **quatre portes vertes à chaque
incrément** ; la couverture à **100 % de branches et de fonctions** sur `packages/core/src` ;
l'exhaustivité des **31 combinaisons de bandes** — dix acceptées, vingt-et-une refusées — la
**symétrie** de la table sur les vingt-cinq couples et sa **coïncidence avec la dérivation par rangs**
pour `n = 1..8`, toutes trois portées par des `it` plutôt que par une campagne ; les chiffres de
`printableAreaOf` sur Letter, `165.10000000000002` et `228.59999999999997`, épinglés par un test ;
la **bissection de la migration**, 7 niveaux / 16 valeurs → 7 niveaux / 27 valeurs, avec sa
contre-épreuve à 20 valeurs ; **deux ablations** — retirer `TextPageFieldSegmentSchema` de l'union,
retirer un champ de `COMPATIBILITY_PAGE` — et le décompte des exports du barrel, **+13 valeurs**
d'exécution et **9 types** vérifiés par une sonde jetable contre les déclarations émises ; enfin le
rendu de la page dans le navigateur — zone imprimable dessinée à **180 × 261 mm** pour une A4 à
marges 18/15/18/15, et `societe.mentionsLegales` présent dans la liste des données requises **parce
que** l'analyse descend dans les bandes.

**Une prédiction du plan a été corrigée par la livraison.** Il annonçait que retirer
`TextPageFieldSegmentSchema` de l'union laisserait la porte 3 **verte** et ne ferait rougir que la
porte 4. **Mesuré : les portes 3 ET 4 rougissent.** `tsconfig.typecheck.json` couvre les fichiers de
test, donc l'assertion d'assignabilité mutuelle de `nodes.test.ts` — que sa propre docstring décrit
comme exécutée par `pnpm run type-check` — mord une porte **plus tôt** que le plan ne le prévoyait.
Le filet est meilleur qu'annoncé, et c'est le tableau du plan qui était faux, pas le dépôt.

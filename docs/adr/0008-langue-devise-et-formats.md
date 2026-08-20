# ADR 0008 — Langue, devise et formats

- **Statut :** 🟡 **Proposé** (2026-08-20), implémenté dans `@openview/core` — ⛔ **trois
  arbitrages restent ouverts et appartiennent au propriétaire du produit**, cf. [§ Ce qui reste
  ouvert]. Le **code** est livré et mesuré ; c'est l'**acceptation doctrinale** qui attend.
- **Date :** 2026-08-20
- **Impact :** `@openview/core` (une forme stockée, `Presentation` ; **un** site d'accrochage,
  `Template.presentations` ; deux schémas ; deux prédicats de locale non exportés ; quatre
  fonctions pures ; l'**estampille 7**), `@openview/engine` (le lot **E4** hérite de **onze**
  attentes nommées, dont une qu'aucune porte ne tient), `@openview/designer` (le lot **D** hérite
  d'une obligation neuve : une locale n'est plus refusée à la frappe, elle doit être **avertie
  depuis le résolveur**), `@openview/viewer` (la promesse d'aperçu identique au PDF devient une
  contrainte de **version d'ICU**, pas seulement de mise en page).
- **Complète :** [ADR 0004](0004-les-arrondis-declares-par-le-modele.md), dont la décision 16 — les
  arrondis sont déclarés par le modèle — est ce qui **oblige** les deux bornes de fraction à être
  requises : sans elles, une table CLDR que personne n'a déclarée déciderait de l'arithmétique.
  Et [ADR 0003](0003-formules-agregations-et-dates-civiles.md), dont `civil-date.ts` fixe ce
  qu'**est** une date dans ce paquet et annonce que « *la transformer en `31/03/2026` appartient au
  lot C6* ». C'est ce lot, et il n'élargit pas le datum qu'on lui a remis.
- **⛔ Contredit une position de doctrine publiée, et le dit ici plutôt qu'en silence.**
  L'[ADR 0003](0003-formules-agregations-et-dates-civiles.md) écrit qu'une opération de l'algèbre
  « *ne lit rien de l'environnement — ni horloge, ni fuseau, ni locale, ni ICU* ». Ce lot n'ajoute
  **aucune** opération à l'algèbre — le critère `git grep -c "case 'round':" --
  packages/core/src/expression` reste à **2** — mais `presentation/format.ts` **dépend d'ICU**.
  L'amendement rédigé est au [§ Ce qui reste ouvert], et il appartient au propriétaire du produit :
  **un lot n'amende pas lui-même une ADR acceptée.**
- **N'amende aucune règle de gouvernance.** `AGENTS.md` sort du lot **inchangé** en ce qui concerne
  ce lot, et le contrôle est négatif et rejouable. `packages/core/src/errors.ts` sort du lot **octet
  pour octet** : **zéro code d'erreur nouveau, zéro classe nouvelle, zéro site nouveau**.
  `ast/visitor.ts`, `template/paths.ts` et `template/guard.ts` ne bougent pas non plus — une
  écriture n'est pas un nœud, ne porte aucune `Expression`, et n'est traversée par aucun des six
  parcours.
- **Plan d'implémentation :**
  [docs/plans/c6-langue-devise-et-formats.md](../plans/c6-langue-devise-et-formats.md) — **périmé**
  une fois le lot livré, comme le dit son propre en-tête. C'est cette ADR qui fait foi, et elle
  **corrige** son plan sur trois points nommés au [§ Ce que l'exécution a corrigé du plan].
- **Implémentation :**
  [`src/presentation/types.ts`](../../packages/core/src/presentation/types.ts) (`Presentation`,
  `PresentationTable`, `PresentationRefusal`, `PresentationResolution`, `DateStyle`, `DATE_STYLES`,
  `MIN_FRACTION_DIGITS`, `MAX_FRACTION_DIGITS`),
  [`src/presentation/locale.ts`](../../packages/core/src/presentation/locale.ts)
  (`wellFormedLocale`, `honouredLocale` — **ni l'un ni l'autre exporté**),
  [`src/presentation/schemas.ts`](../../packages/core/src/presentation/schemas.ts)
  (`PresentationSchema`, `PresentationTableSchema`, les deux prédicats à coupure),
  [`src/presentation/resolve.ts`](../../packages/core/src/presentation/resolve.ts)
  (`resolvePresentation`),
  [`src/presentation/format.ts`](../../packages/core/src/presentation/format.ts) (`formatMoney`,
  `formatDecimal`, `formatDate`),
  [`src/presentation/presentation.ts`](../../packages/core/src/presentation/presentation.ts) (la
  façade),
  [`src/template/template.ts`](../../packages/core/src/template/template.ts) (le champ et
  l'estampille 7),
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (l'entrée 6 → 7),
  [`src/index.ts`](../../packages/core/src/index.ts) (neuf valeurs, cinq types),
  [`apps/playground/src/App.tsx`](../../apps/playground/src/App.tsx) (la démonstration).

---

## Le contexte, et l'écart qu'il faut mesurer avant de le combler

Le critère de recette de la brique nomme cinq choses : « *les montants, les dates, les séparateurs
de milliers, la position du symbole monétaire, et les libellés fixes du modèle* ».

**La cinquième était déjà livrée, et il faut le dire en premier.** Un `Template` unique imprime
`Facture` ou `Invoice` depuis un `if(eq(path('rendu.langue'), 'fr'), …, …)`, mécanisme du lot C1.
Le conditionnel n'est pas un contournement : il **réordonne** aussi, ce qu'une table de traductions
ne sait pas faire — la vitrine le montre, `Facture n° 20260014 — ACME SÀRL` contre
`ACME SÀRL — Invoice no. 20260014`.

**Ce lot porte donc les quatre autres, et toutes les quatre sont l'écriture d'une VALEUR.** Il
n'ajoute aucun mécanisme de libellé, aucun catalogue de messages, aucune table de traduction — un
catalogue devrait réserver des noms de clés, ce que la règle de périmètre refuse d'emblée.

L'écart était visible à l'écran, et il était mesuré : la vitrine portait

```ts
const fr = (value: number): string => String(value).replace('.', ',');
```

une locale française **codée à la main**, appelée trois fois. C'est la mesure la plus courte de ce
que le lot apporte : une fonction de trois lignes qui prétendait connaître le français est
remplacée par une **déclaration que l'auteur du modèle possède**.

---

## Les trois questions, et qui répond à chacune

C'est la séparation qui gouverne tout le reste du document.

| Question | Qui répond | Mécanisme |
| :--- | :--- | :--- |
| **Ce que le document DIT** | le **modèle** | un `if` lisant une donnée — lot C1, déjà livré |
| **Comment une valeur est ÉCRITE** | le **modèle** | la table `presentations` — ce lot |
| **LAQUELLE des écritures déclarées** | l'**appelant** | un **argument** passé à `resolvePresentation` |
| — | **jamais la machine** | c'est tout l'objet du lot |

`ports/render.ts` publiait déjà les deux moitiés de la règle, et seule la seconde était honorée :
« *There is no third field on purpose. No clock, no system locale, no ambient context […] Language
and currency are a different matter entirely: the template declares them.* » Ce lot est ce qui rend
la moitié affirmative exacte, et il **n'ajoute aucun troisième champ** à `RenderRequest`.

---

## La décision, en vingt-deux points

### D-01 — La table d'écritures vit sur `Template`

Et non sur `RenderRequest`, ni dans un fichier voisin. Un modèle est donc **auto-suffisant à la
lecture** : rien de ce qui décrit *comment il écrit* ne doit voyager à côté de lui.

### D-02 — L'appelant sélectionne par un ARGUMENT

`resolvePresentation(table, nom)`. Pas une clé de `RenderRequest.data`, dont les noms appartiennent
à l'intégrateur et devraient donc être réservés ; pas un champ de `RenderRequest`, dont la docstring
dit qu'il n'y en aura pas de troisième ; pas une lecture de la machine.

### D-03 — L'espace de noms des clés appartient à l'AUTEUR du modèle

Openview n'y réserve **rien** : pas de `"default"`, pas de `"fr"`, aucune entrée de repli, aucune
convention liant une clé à une langue. Un modèle qui écrit montants, quantités et prix unitaires
dans deux langues déclare **six** entrées et les nomme comme il veut. Le test de périmètre
d'`AGENTS.md` est celui qui tranche : « *si une fonctionnalité oblige l'intégrateur à nommer un
champ comme Openview l'a décidé, elle est à refuser* ».

### D-04 — Les deux bornes de fraction sont TOUJOURS requises

Et c'est ce qui rend la table CLDR devise → unités mineures **inatteignable**. La mesure est au
[§ Les mesures qui décident] : par défaut, `1234.5678` en `fr-FR` s'imprime `1 235 JPY` (zéro
décimale) et `1 234,568 TND` (trois). **Des chiffres disparaissent.** ADR 0004 décision 16 donne
l'arithmétique au modèle, donc une table que personne n'a déclarée ne peut pas être celle qui
décide.

**Les deux, et pas seulement le maximum :** un minimum inférieur au maximum est une **politique de
zéro de remplissage** (`10,5` là où la ligne au-dessus lit `10,50`), et un document qui la décide
valeur par valeur l'a décidée par accident.

### D-05 — Le maximum est DÉCLARÉ et jamais dérivé

Aucun `scaleOf` n'est écrit — **pas écrit du tout**, pas seulement non exporté. L'échelle qui compte
est celle que l'auteur déclare, et non celle qu'on devinerait de la forme binaire d'une valeur.

### D-06 — La locale est validée par DEUX portes, et c'est la décision la plus travaillée du lot

**Le critère de coupure, énoncé une fois pour toutes :**

> **Un champ STOCKÉ ne peut être jugé que par un verdict identique sur toute machine.**

| | `wellFormedLocale` | `honouredLocale` |
| :--- | :--- | :--- |
| **Question** | ce tag est-il valide au sens d'ECMA-402, sans `-u-` ? | **ce build** honore-t-il le tag **tel quel** ? |
| **Nature de la réponse** | **grammaire**, spécifiée par la norme | **donnée**, portée par CLDR |
| **Porte** | **parse** (`PresentationSchema`) | **rendu** (`resolvePresentation`) |
| **Verdict stable entre ICU ?** | ✅ **oui** — 0 divergence sur 31 933 tags | ❌ **non** — 527 contre 525 |
| **Exportée du barrel ?** | non | non |

**Pourquoi la coupure est là et pas ailleurs.** Une première rédaction posait les **deux** questions
au parse. Elle rendait le document `en-FR` — le tag naturel de la moitié anglaise d'une facture
française, c'est-à-dire le cas d'usage du critère de recette lui-même — **inouvrable sur ICU 76.1 et
ouvrable sur ICU 77.1**. Pas une écriture manquante : un **document qui ne s'ouvre pas**, sur une
faute appartenant à l'ICU du lecteur, avec un message accusant l'auteur d'un tag parfaitement
correct. `AGENTS.md` §1.2 nomme cette classe — « le refus illisible » — et le remède qu'il y
prescrit, un incrément de `schemaVersion`, **ne peut pas s'appliquer** : le refus dépend de la
machine et non du document.

**Conséquence à porter :** `'zz'`, `'xx-YY'` et `'fr-XX'` **SE STOCKENT**, et sont refusés **au
rendu**. Rien n'est perdu — toute écriture que le moteur reçoit a passé l'honorat, parce que
`resolvePresentation` est ce qui en fabrique une.

### D-06a — « Honoré » est une POLITIQUE d'Openview, pas la capacité d'ICU

Et l'énoncé exact importe, parce que l'inexactitude était du côté sévère :

> Une écriture est honorée **si et seulement si les deux formateurs résolvent son tag vers
> lui-même.**

C'est **strictement plus strict** qu'ICU, et le coût est nommable : l'auteur doit écrire le tag
**minimisé** — `en` et non `en-Latn-US`, `ca-ES` et non `ca-ES-valencia`. Ce que la politique achète
en échange est la seule formulation où « le document dit ce qu'il imprime » reste vrai **caractère
pour caractère** — le même terrain sur lequel [D-07] refuse de **rogner** un `-u-`.

`Intl.NumberFormat.supportedLocalesOf` **ne peut pas** remplacer l'égalité, et c'est mesuré : sur un
balayage de 2 080 tags bien formés, il en accepte **2 080** contre **43** pour l'égalité — il répond
« oui » à `fr-US`, `fr-Latn` et `fr-419`, qui s'impriment tous en `fr`. Il teste que la **langue**
est connue, jamais que le **tag** est honoré.

### D-06b — Une locale n'est plus refusée à la frappe : le Designer AVERTIT

C'est le prix nommé de la coupure, et il tombe dans un manque que le lot reconnaît : **le Designer
n'a été instruit nulle part**. Depuis que le résolveur rend un refus **nommé**, l'avertissement peut
être écrit sans deviner la cause. Ce qui reste au Designer : distinguer « tag inconnu » de « tag
sur-spécifié dont la forme courte marcherait », par un `supportedLocalesOf` de trois lignes — `core`
ne le tranche pas.

### D-07 — Le `-u-` est refusé, jamais rogné — et le test porte sur la forme CANONIQUE

Rogner serait une troisième orthographe d'un même fait : l'auteur a écrit `-u-nu-thai`, les
formateurs épinglent `numberingSystem` de toute façon, et supprimer la demande en silence laisse un
modèle dont l'intention stockée et la sortie divergent, sans rien entre les deux pour le remarquer.

**Et le test porte sur la forme canonique, parce qu'un contre-exemple l'exige :** `'en-US-posix'` ne
porte **aucun** `-u-` et se canonicalise en `'en-US-u-va-posix'`, qui en porte un. Un test sur la
chaîne brute l'aurait laissé passer au parse **et** au rendu, et le contrat aurait remis à `Intl`
l'extension qu'il affirme refuser.

### D-08 — La devise est validée par la FORME et jamais contre un registre

`^[A-Z]{3}$`. Openview ne détient aucune liste de devises, pour la raison qu'il n'en détient aucune
de langues. Une devise bien formée qu'ICU ne connaît pas **s'imprime elle-même** — `'ZZZ'` rend
`1 234,50 ZZZ` —, donc une monnaie inconnue dégrade vers un document **lisible** plutôt que vers une
exception, et aucun compte d'unités mineures n'est hérité de nulle part puisque les deux bornes sont
déclarées.

La forme est **plus stricte** qu'ICU délibérément : ICU accepte `'eur'`, donc la minuscule serait
une seconde orthographe d'un même fait. Elle n'est **plus laxiste dans aucune direction** : `'zz'`,
`'ZZZZ'`, `'12A'` et `'ZZ1'` lèvent tous un `RangeError` chez ICU, et l'expression régulière les
refuse tous les quatre **avant** qu'ICU les voie.

**Ce n'est pas une conversion**, et la roadmap le dit dans sa propre réserve : afficher « $ » n'est
pas convertir des euros en dollars — un taux de change est une **donnée**, et son choix appartient à
l'intégrateur.

### D-09 — TROIS options sont épinglées, pas une

Et l'outillage n'en couvre qu'**une** : `AGENTS.md` n'outille que `timeZone`. Le silence du linter
sur les deux autres est un **angle mort**, pas une permission — et deux mesures suffisent à le
montrer :

```
th-TH  dateStyle 'long'  sans épingle  ->  "19 สิงหาคม 2569"   (année bouddhique)
fa-IR  dateStyle 'long'  sans épingle  ->  "۲۸ مرداد ۱۴۰۵"     (année persane, chiffres orientaux)
```

Une année fausse de **543** et une année fausse de **621**, depuis une date **correcte**, **sans
aucune erreur**. Avec `calendar: 'gregory'` et `numberingSystem: 'latn'`, les mêmes rendent
`"19 สิงหาคม ค.ศ. 2026"` et `"19 اوت 2026"`.

Et le système de chiffres **atteint les montants**, pas seulement les dates : `ar-EG` rend
`١٬٢٣٤٫٥٧` sur un nombre. C'est pourquoi `numberingSystem: 'latn'` est épinglé sur **les trois**
formateurs.

| Épingle | Statut | Réversibilité |
| :--- | :--- | :--- |
| `timeZone: 'UTC'` | **dur** | aucune — un autre fuseau exigerait un **instant**, et un instant est une horloge |
| `numberingSystem: 'latn'` | **dur pour ce lot** | ⚠️ réversible : un champ optionnel + une estampille, et un document qui l'omet garde la sortie d'aujourd'hui. Non exposé aujourd'hui parce qu'ICU **ignore en silence** un système inconnu (`'zzzz'` retombe sur `latn`), donc l'exposer obligerait à le valider structurellement |
| `calendar: 'gregory'` | **dur, et définitif** | ⛔ **aucune** — un changement de calendrier est une **conversion du datum** : `2026-08-19` et `2569-08-19` sont deux nombres différents, pas deux orthographes d'un même |

**L'objet d'options est écrit EN LIGNE, et c'est une contrainte subie, pas un style.** Le plugin
`no-environment-read` compare du **texte source** et exige le jeton `timeZone` dans la liste
d'arguments de **cet** appel : hisser les trois épingles dans une constante partagée serait refusé
par une règle juste pour une mauvaise raison. Et **aucun `biome-ignore` ne la sauve** — mesuré, la
suppression est inopérante sur un diagnostic de **plugin**.

### D-10 — `calendar` est épinglé EN DUR ; `numberingSystem` l'est *aujourd'hui*

La différence est celle du tableau ci-dessus, et elle mérite d'être nommée : le calendrier est un
refus **définitif**, le système de chiffres un refus **daté**. Le jour où une vraie facture arabe
existe, `numberingSystem` devient un champ optionnel — la classe de changement la moins chère du
dépôt. **C'est une décision produit**, pas une propriété testable, et elle n'est pas neutre.

### D-11 — Zéro code d'erreur nouveau, zéro site nouveau

`SHAPE_ERROR_CODES`, `OPERAND_ERROR_CODES` et `LIMIT_ERROR_CODES` sont **inchangés**, `errors.ts`
sort du lot octet pour octet, et **rien n'est jeté**. C'est la **double porte d'absence** qui le
permet : `resolvePresentation` rend `{ ok: false, refusal }` pour une faute de **modèle ou d'appel**,
un formateur rend `undefined` pour une faute de **valeur**.

⚠️ **Et il faut dire ce que le résultat discriminé ajoute quand même**, sinon la ligne est trop
belle : le lot publie un **troisième tuple de littéraux** (`PresentationRefusal`), à côté de
`DATE_STYLES` et `PAGE_FIELDS`. Ce n'est ni une classe d'erreur, ni une entrée de catalogue, ni un
`throw` — c'est une **réponse**, et c'est l'appelant qui décide si elle est fatale (question 2
d'ADR 0001, toujours ouverte).

### D-12 — Les deux prédicats de locale ne sont PAS exportés du barrel

Aucun consommateur hors du paquet ne les nomme, et la règle anti-sur-ingénierie refuse un export
dont la seule justification est qu'il **pourrait** servir. Les précédents sont exacts : `prefixPath`
dans `errors.ts` et `aliasSchema` dans `expression/identifiers.ts` sont tous deux délibérément
absents d'`index.ts`.

⛔ **Et scinder le prédicat en deux n'a rien ajouté à la surface publique** — 126 exports avant la
scission, 126 après. C'est précisément l'intérêt de ne pas les exporter, et c'est ce qui a permis
d'appliquer la coupure de [D-06] sans toucher au compte.

### D-13 — `presentations` est OPTIONNEL et sans défaut

Et c'est l'**inverse** de ce que la v5 a fait pour `page`, sans incohérence. Une **feuille** de
compatibilité était possible : l'A4 est faux pour une partie du monde, mais il **existe partout**.
Une **écriture** de compatibilité devrait nommer une **langue** et une **monnaie**, et Openview ne
détient aucun référentiel. **Il n'existe pas de devise qui existe partout.**

Absent signifie « ce modèle ne déclare aucune écriture », ce que déclarait tout document écrit avant
ce lot. Une table **vide** est un énoncé **différent** — l'auteur a ouvert la question et n'a rien
déclaré encore — et les deux sont acceptés, pour la raison qu'un modèle en construction est un
modèle légitime.

**Aucun `z.default()`**, et le motif est mesuré sur `page` : un document sans table sortirait en
portant une écriture qu'**Openview** a choisie, à chaque parse, en silence.

### D-14 — `CURRENT_SCHEMA_VERSION` passe de 6 à 7 par une ESTAMPILLE SEULE

Et **l'estampille EST tout le mécanisme.** Un champ **optionnel** ajouté à `Template` est le cas
**PERTE SILENCIEUSE** d'`AGENTS.md` §1.2, pas le refus illisible : aucune union ne s'élargit, donc
aucun build antérieur ne rencontre de discriminant inconnu. C'est la classe **dangereuse** — un
build v6 ouvrant un document v7 l'**accepte sans aucune erreur** et **dépouille toute la table**,
après quoi un `onSave` persiste la perte et chaque montant retombe à la mise en chaîne nue.

Avec l'estampille, le même document rend :

```
TemplateMigrationError: Template uses schema version 8 but this build understands at most 7.
It was written by a newer release of Openview; upgrade before opening it.
```

**L'asymétrie est mesurée dans les deux sens**, et c'est ce qui fait de l'estampille la seule
décision irréversible du lot :

| Oubli | Ce qui se passe |
| :--- | :--- |
| l'**entrée** de migration oubliée, estampille posée | ⚡ **bruyant** — `No migration registered from schema version 6. The upgrade chain to 7 is broken.` |
| l'**estampille** oubliée, champ ajouté | 🔇 **totalement silencieux** — et c'est la perte de données |

> **Une migration qui ne transforme rien n'est pas une migration fantôme.** Elle **estampille**, et
> l'estampille est *tout* ce qui produit le message ci-dessus. Écrire
> `migrate: (input) => ({ ...input, schemaVersion: 7 })` est un travail **complet**.

**La réserve des cinq entrées précédentes transpose mot pour mot :** le garde de version lit
l'**estampille**, pas le contenu. Un document estampillé `6` portant **déjà** une table — fait à la
main, ou écrit par un build de mi-lot non estampillé — **n'est pas refusé** : il parse et ressort en
`schemaVersion: 7` **en gardant sa table**.

### D-15 — `Object.hasOwn` sur la lecture de la table, et ce n'est PAS de la programmation défensive

`z.record` **écarte** une clé `__proto__` de son **entrée** — donc ce champ ne peut pas polluer un
prototype — mais l'objet qu'il **rend** hérite de `Object.prototype` malgré tout. Mesuré : sur une
table parsée depuis `{"montant-fr": {…}, "__proto__": {…}}`, `Object.keys` rend `['montant-fr']`
tandis que `table['constructor']` rend une **fonction**.

Écrite `presentations[writing]`, la lecture répondrait donc un non-`undefined` **pour au moins onze
noms que personne n'a déclarés**, dont le `.locale` vaut `undefined` — c'est-à-dire
`Intl.NumberFormat(undefined, opts)`, **l'appel d'arité zéro qu'`AGENTS.md` liste parmi les angles
morts déclarés du linter**, et que tout ce lot existe pour rendre inatteignable.

La garde est sur la **lecture** et non sur la **clé**, parce que les noms appartiennent à l'auteur :
une écriture légitimement appelée `"constructor"` est saugrenue, elle n'est pas illégale.

### D-16 — Deux prédicats d'objet, tous deux À COUPURE

`if (payload.issues.length > 0) return;`. Le défaut que cette règle évite est mécanique et vaut pour
tout invariant croisé écrit naïvement : une faute **continuable** sur un des deux champs (`too_big`,
`too_small`, `invalid_type` sur un non-entier) laisse ce champ **hors** de la valeur du payload, donc
un prédicat qui le lit voit `undefined`, le compare, et **ajoute une seconde issue pour la même
faute**.

Le remède n'est pas un prédicat de plus, c'est la coupure — « *un auteur qui a une chose à corriger
doit se l'entendre dire une fois* ».

| Forme | Peut exprimer la coupure ? | Employée ici ? |
| :--- | :--- | :--- |
| `.refine(fn)` sur l'**objet** | ❌ ne voit pas les issues déjà présentes | non |
| `.superRefine(fn)` nu | ❌ **déprécié** en zod 4 | non |
| `.check(z.superRefine(fn))` | ❌ le contexte ne porte pas `issues` | non — c'est la forme **juste ailleurs** (`ast/`, `page/`), parce que ces gardes n'ont pas de coupure à exprimer |
| **`.check(payload => …)`** | ✅ le payload porte `issues` **à côté de** `value` | **oui, les deux** |

Mesuré : **toutes** les entrées du tableau de refus rendent exactement **1** issue.

⚠️ **Le chemin est `['maxFractionDigits']`, jamais le chemin vide.** Une issue à chemin vide nomme
l'**objet** et non le **champ** : un éditeur n'a rien où poser un marqueur.

⚠️ **Et `refuseUnnamedWriting` existe parce que l'orthographe évidente est mauvaise, et c'est
mesuré.** `z.record(z.string().min(1), …)` rend `code: 'invalid_key'`, `path: []` et le message **de
zod** (`"Invalid key in record"`) — pas celui passé à `.min(1)`. Écrit à la main, le même défaut rend
un `custom` **dont le chemin EST la clé fautive**, donc une ligne qu'un Designer peut surligner.

### D-17 — `MAX_FRACTION_DIGITS` est IMPORTÉ de `MAX_ROUND_DECIMALS`, jamais réénoncé

Ce n'est pas une commodité : une écriture plus fine que le plus fin arrondi qu'un modèle peut
**déclarer** est une écriture qu'aucun arrondi déclaré ne peut alimenter. Les chiffres au-delà du
quinzième ne pourraient venir que d'une valeur que personne n'a arrondie — du **bruit IEEE-754,
imprimé**.

**Et ce n'est PAS le plafond d'ICU** : mesuré, `maximumFractionDigits: 100` passe et `101` lève.
Publier le plafond d'ICU dans une forme **stockée** serait publier une propriété du **moteur** —
ES2020 garantissait 20, ES2023 est monté à 100 — et un document n'est pas reparsé quand l'hôte monte
de version. **Quinze est une propriété de ce contrat.**

Le test épingle **les deux moitiés** (`=== MAX_ROUND_DECIMALS` **et** `=== 15`), pour qu'aucune ne
puisse dériver seule.

### D-18 — Aucune annotation `z.ZodType<T>` sur aucun schéma de ce dossier

Le patron obligatoire d'`AGENTS.md` §1.2 vise l'**AST récursif** et lui seul. Rien ici n'est
récursif, et le lot C5 a mesuré ce que l'annotation coûte : annoter un schéma puis **amputer** un
champ de l'objet **compile à exit 0**, parce que `z.infer` d'un schéma annoté rend
l'**annotation**. Le vrai garde est la paire d'assertions de clés du fichier de test.

### D-19 — Le zéro négatif est replié, et SEULEMENT l'exact

Mesuré : `Intl.NumberFormat('fr-FR', {min:2,max:2}).format(-0)` rend `"-0,00"`. Un `-0` est ce que
produisent `0 * -1` et une remise de rien, et `-0,00 €` sur une ligne de total est un défaut qu'un
lecteur signale.

Il est replié **ici et pas dans l'algèbre**, parce que le `-0` de l'algèbre est **arithmétiquement
correct** : c'est son **écriture** qui est fausse, et l'écriture est le sujet de ce dossier.

**Et seulement l'exact :** `-0.001` écrit à deux décimales rend toujours `-0,00`, et ce n'est **pas**
un bug à corriger — la valeur est réellement négative, l'écriture a réellement été déclarée à deux
places, et masquer le signe serait **inventer un nombre**.

### D-20 — Aucun `roundingMode` n'est passé à ICU, et le refus est mesuré

Le défaut d'ICU est `halfExpand`. Sur **200 000** tirages monétaires à trois décimales écrits à deux
places, arrondir avec le `roundDecimal` du dépôt en `halfExpand` **avant** de formater est d'accord
avec le formatage seul sur **100,0000 %** des cas ; en `halfEven`, les deux divergent sur
**4,9275 %**.

Passer un mode ici serait donc une **seconde orthographe** du mode qu'une expression `round` déclare
déjà — et deux orthographes d'un arrondi, c'est ainsi que deux moteurs produisent deux documents.
L'obligation qui en découle — **arrondir d'abord, formater ensuite** — appartient au moteur, et elle
est nommée `E4-2` plus bas.

### D-21 — Pas UN SEUL objet `Date` n'est construit

Et `Date.UTC` est refusé **bien qu'`AGENTS.md` l'autorise** :

| Écriture | Verdict |
| :--- | :--- |
| `new Date(y, m, d)` | ⛔ construit **dans le fuseau de l'hôte** — et le constructeur est banni à **toute arité** par le plugin (porte 1) |
| `Date.UTC(y, m, d)` | ✅ **autorisé** par `AGENTS.md` — et **piégé** : mesuré, il projette les années **0 à 99 sur 1900 à 1999**, donc il déplacerait **en silence** `0042-01-01`, que `civil-date.ts` accepte |
| **`dayNumberOf(value) * 86 400 000`** | ✅ **retenu** — `civil-date.ts` rend un **numéro de jour**, `format()` accepte un **nombre de millisecondes**, et toute la conversion est **une multiplication** |

Mesuré aux deux bouts de la plage supportée, `dateStyle: 'long'` en `fr-FR` : `0001-01-01` rend
`1 janvier 1`, `9999-12-31` rend `31 décembre 9999`. **La plage acceptée est exactement celle de
l'algèbre**, sans une table de longueurs de mois ni une règle bissextile écrites à la main.

Et le piège de `Date.UTC` est **épinglé par un test** : `0042-01-01` et `1942-01-01` doivent
s'imprimer **différemment**. Avec `Date.UTC`, les deux rendent `1 janvier 1942`.

### D-22 — Le dossier s'appelle `presentation/`, et non `format/`

Il est nommé d'après **ce que le modèle déclare** — une table d'écritures, stockée, versionnée et
migrée — plutôt que d'après le **verbe** qui la consomme, exactement comme `style/` porte
`Typography` et ne s'appelle pas `paint/`.

---

## Les mesures qui décident

Cette section existe parce que la moitié des décisions ci-dessus reposent sur un comportement d'ICU
qu'il fallait **exécuter** plutôt que supposer. Environnement : Node v24.11.1 / ICU 77.1 / CLDR 47,
avec les balayages inter-versions rejoués contre ICU 76.1 / CLDR 46.

### ① Les deux bornes rendent la table CLDR devise → unités mineures INATTEIGNABLE

`1234.5678` en `fr-FR` :

| devise | par défaut | avec `min = max = 2` |
| :--- | :--- | :--- |
| `EUR` | `1 234,57 €` | `1 234,57 €` |
| `JPY` | **`1 235 JPY`** — zéro décimale | `1 234,57 JPY` |
| `TND` | **`1 234,568 TND`** — trois décimales | `1 234,57 TND` |
| `ZZZ` | `1 234,568 ZZZ` | `1 234,57 ZZZ` |

**Des chiffres disparaissent** dans la colonne du milieu, et c'est une **arithmétique** — pas une
typographie. Le test l'épingle par **comptage de chiffres**, en exigeant les quatre égaux.

### ② L'égalité contre la capacité — pourquoi l'honorat est une politique

```
tag              canonique         égalité   supportedLocalesOf   resolvedOptions().locale
en-Latn-US       en-Latn-US        REFUSÉ    supporté             en
ca-ES-valencia   ca-ES-valencia    REFUSÉ    supporté             ca-ES
fr-Latn-FR       fr-Latn-FR        REFUSÉ    supporté             fr
es-005           es-005            REFUSÉ    supporté             es
zz               zz                REFUSÉ    NON supporté         fr-FR  <- la locale de l'HÔTE
```

Trois faits, et ils ne disent pas la même chose : ICU **minimise** ; `supportedLocalesOf` teste la
**langue** et non le **tag** ; et lui seul isole exactement le repli sur l'**hôte**, qui est le
défaut central du lot. La distinction appartient à l'avertissement d'un Designer, pas à cette porte.

### ③ Le balayage inter-versions — la mesure qui a déplacé la coupure

| Grandeur | ICU 77.1 | ICU 76.1 | Divergences |
| :--- | --: | --: | --: |
| tags levant un `RangeError` (corpus de frontière, 161 tags) | 50 | 50 | **0** |
| verdict de l'extension `-u-`, sur 31 933 tags | — | — | **0** |
| tags **honorés** | **527** | **525** | ⛔ **2** — dont **`en-FR`** |
| dérives d'orthographe canonique | — | — | 2 (`cls`, `nbx`) |

Les deux tags qui bougent sont `'cls'` et — celui qui compte — **`'en-FR'`**, le tag qu'écrit
l'auteur de la moitié anglaise d'une facture française. **C'est cette ligne, et elle seule, qui a
fait descendre l'honorat au rendu.**

⚠️ **Une réserve de méthode, conservée parce qu'elle corrige le dossier lui-même.** Une première
preuve de stabilité syntaxique était **vide** : le corpus systématique de 31 772 tags (2 lettres, 3
lettres, 2 lettres + région) est **entièrement bien formé par construction** et ne touche jamais la
frontière qu'il prétendait mesurer — les deux ensembles de tags qui lèvent étaient identiques *parce
qu'ils étaient tous deux vides*. Un corpus de frontière de **161 tags** a donc été ajouté : les 26
tags *grandfathered* de BCP-47, 80 alias dépréciés, 51 malformations. **La conclusion était juste ;
l'argument ne l'établissait pas.**

### ④ `en-US-posix` décide où porte le test du `-u-`

```
en-US-posix  =>  en-US-u-va-posix
```

Un tag qui **ne porte aucun `-u-`** se canonicalise **en un tag qui en porte un**. La conception
d'origine avait raison de tester la forme canonique ; elle n'avait pas ce contre-exemple.

### ⑤ Le calendrier et le système de chiffres — trois années fausses sans une erreur

```
th-TH  'short'  sans épingle  ->  "19/8/69"        (année bouddhique 2569)
fa-IR  'long'   sans épingle  ->  "۲۸ مرداد ۱۴۰۵"  (année persane 1405, chiffres orientaux)
ar-EG  montant  sans épingle  ->  "١٬٢٣٤٫٥٧ €"     (chiffres orientaux sur un MONTANT)
```

⚠️ **Le couplage qu'il faut écrire, parce qu'une simplification future le désarmerait en
silence :** l'assertion `toContain('2026')` n'est vraie que si le `dateStyle` de la fixture imprime
l'année sur **quatre** chiffres. Mesuré, `th-TH` + `short` rend `"19/8/26"` — la largeur de l'année
est une **décision de CLDR par locale**. Le test emploie donc `dateStyle: 'long'`, et ce n'est pas un
détail : c'est la seule assertion qui tue la mutation « `dateStyle` déclaré remplacé par `short` ».

### ⑥ L'asymétrie du garde-fou — la répartition est l'INVERSE de l'intuition

| Épinglage | Porte 1 (Biome) | Porte 4 (tests) |
| :--- | :-: | :-: |
| `timeZone: 'UTC'` | ✅ **seul garde** | ❌ muette — l'hôte étant `Europe/Paris`, minuit UTC reste le même jour civil |
| `calendar: 'gregory'` | ❌ muette | ✅ tuée par le test |
| `numberingSystem: 'latn'` | ❌ muette | ✅ tuée par le test |
| la locale réellement employée | ❌ muette | ✅ tuée par le test |

> ⛔ **Conséquence à porter en revue :** l'épinglage du fuseau est le **seul** des quatre dont la
> garantie repose **entièrement** sur une règle de plugin `.grit` — le fichier qu'`AGENTS.md` §7
> interdit de modifier sans mandat, voisin d'une règle *nursery* hors versionnement sémantique. Si le
> plugin est un jour assoupli, **plus rien** ne tient `timeZone`. Et cela **ne peut pas** être
> refermé par un test : un test qui prouverait le fuseau devrait **lire le fuseau**.

### ⑦ Le contrôle négatif du linter, rejoué — et la mesure la plus utile du lot

```
new Intl.NumberFormat()                          -> REFUSÉ (arité zéro)
new Intl.DateTimeFormat('fr-FR', optsHoisté)     -> REFUSÉ (faux positif connu et SUBI)
  le même, précédé d'un biome-ignore             -> REFUSÉ QUAND MÊME
```

⛔ **`biome-ignore` est INOPÉRANT sur un diagnostic de plugin GritQL.** Toute forme refusée par le
plugin doit donc être **réécrite**, jamais annotée — et le lot sort avec **zéro** directive de
suppression.

---

## ⛔ Les cinq familles de fautes qu'une écriture bâtie à la main atteint

**Cette section est la contrepartie obligatoire du choix de garder trois fonctions libres**, et elle
est recopiée ici — plutôt que laissée dans une docstring — précisément pour que l'obligation `E4-10`
soit **opposable** et non simplement documentée.

`Presentation` est un type **structurel** : `currency` est un `string`, les deux bornes sont des
`number`. Seul `dateStyle` est protégé par le type, parce que c'est une union littérale. **Trois
champs sur cinq ne sont donc protégés par rien**, et voici ce qu'une écriture bâtie à la main
atteint, mesuré sur les trois formateurs :

| écriture bâtie à la main | `formatMoney` | `formatDecimal` | `formatDate` |
| :--- | :--- | :--- | :--- |
| `locale: 'zz'` | 🔇 `"1 234,50 €"` **(hôte)** | 🔇 `"1 234,50"` **(hôte)** | 🔇 `"19 août 2026"` **(hôte)** |
| `locale: 'i-klingon'` ou `''` | ⚡ `RangeError` | ⚡ `RangeError` | ⚡ `RangeError` |
| `currency: 'AB'` | ⚡ `RangeError: Invalid currency code : AB` | `"1 234,50"` | `"19 août 2026"` |
| `min: 5, max: 2` | ⚡ `RangeError: maximumFractionDigits…` | ⚡ `RangeError` | `"19 août 2026"` |
| `min: -1` | ⚡ `RangeError: minimumFractionDigits…` | ⚡ `RangeError` | `"19 août 2026"` |
| `min: 2.5` | `"1 234,50 €"` — ICU **accepte**, le schéma **refuse** | idem | idem |
| **`locale: null`** | ⚡ **`TypeError`** relancé par `wellFormedLocale` | ⚡ idem | ⚡ idem |

**Cinq observations, et elles sont toutes portantes :**

1. **Quatre familles de `RangeError`, pas deux.** La locale **malformée** en est une, et une première
   analyse ne l'avait pas vue parce qu'elle n'avait testé que `'zz'`, qui est bien formé.
2. **`formatDate` lève aussi.** **Aucun des trois formateurs n'est exempt.**
3. **`min: 2.5` ne lève pas** — ICU accepte un non-entier, le schéma le refuse. La revalidation gagne
   donc un cas de plus que l'exception ne signalait.
4. ⛔ **La cinquième famille est un `TypeError`, et elle échappait à son remède.** Mesuré,
   `Intl.getCanonicalLocales(null)` lève un **`TypeError`**, que le `catch` de `wellFormedLocale`
   **relance** à dessein — avaler autre chose qu'un `RangeError` transformerait un défaut de moteur
   en document écrit dans une langue que personne n'a choisie. **C'est ce qui a inversé l'ordre des
   deux gestes dans le résolveur :** le `safeParse` court désormais **avant** toute lecture de champ.
5. **La première ligne est la pire**, parce qu'elle est **silencieuse** : un document plausible,
   imprimable, et faux d'une façon que rien en aval ne peut détecter.

**Aucune des cinq n'est atteignable à travers `resolvePresentation`**, qui parse les cinq champs et
court l'honorat avant de rendre une écriture. Le remède est donc écrit comme une **obligation** —
`E4-10` — et non comme un type.

### Ce qui a été pesé pour fermer ce trou par une signature, et REFUSÉ

Une porte existait, et il faut le dire : **que le résolveur rende un FORMATEUR** — un objet fermant
sur les trois fonctions et sur l'écriture qu'il a validée — de sorte qu'aucune surface publique ne
prenne une `Presentation` bâtie à la main. Elle a été **pesée puis refusée**, pas ignorée.

| | garder trois fonctions libres | rendre un formateur-objet |
| :--- | :--- | :--- |
| `E4-10` | reste une **obligation** documentaire | **fermée par la signature** |
| forme stockée | `Presentation` reste la forme stockée, lisible en JSON | inchangée aussi |
| coût | **zéro** | ⛔ invalide la campagne de mesure **déjà exécutée** — la suite de tests, la matrice de mutation, le compte d'exports |
| appelant réel de la garantie | **aucun aujourd'hui** — seule l'équipe qui écrit E4 | idem |

**Le motif du refus n'est pas l'élégance :** on paie pour la garantie qui a un **consommateur**, et
`E4-10` n'en a pas encore. Ce qui **a** été pris dans le même geste est le **résultat discriminé**,
parce que celui-là avait un consommateur immédiat — l'avertissement du Designer (`D-06b`) recevait un
`undefined` muet, il reçoit `'unhonoured-locale'`.

⛔ **Bénéfice qu'il faut nommer, parce qu'il ne se voit pas :** les quatre sorties du résolveur
étaient **indistinguables** — un même `undefined` pour trois causes plus une. Une mutation qui
échangeait deux refus était donc **invisible à tout test**. Avec le résultat discriminé, chacune est
assertable, et le test l'épingle par `new Set(refusals).size === 3`.

---

## Les onze attentes envers l'aval, chacune avec son propriétaire

Une dette vit dans l'ADR, jamais éparpillée dans les docstrings qui la créent. Le barrel n'en porte
qu'un rappel.

| # | Attente | Propriétaire | Vérifiable à |
| :-- | :--- | :--- | :--- |
| **E4-1** | ⛔ **Choisir les SITES** et la fonction, valeur par valeur. C'est la faiblesse structurelle du lot, et elle est écrite en tête plutôt qu'enterrée | **E4**, avec arbitrage produit s'il faut ouvrir un champ de segment | E4 |
| **E4-2** | **Arrondir PUIS formater**, jamais l'inverse — 4,9275 % de divergence en `halfEven`, 0,0000 % en `halfExpand` | **E4** | E4, sur une facture à `halfEven` |
| **E4-3** | Résoudre chaque écriture employée **au plus une fois par rendu**, jamais une fois par valeur. ⚠️ Un rendu peut légitimement en employer **plusieurs** — montants, quantités, prix unitaires — ce qui est proscrit est de résoudre **la même** deux fois | **E4** | E4 |
| **E4-4** | La clé d'écriture est un **argument** — jamais une lecture de machine, jamais une clé réservée dans `data` | **E4**, et l'intégrateur | E4 |
| **E4-5** | Une devise inconnue **mais bien formée s'imprime elle-même** ; **aucune table de secours** | **E4** | E4 |
| **E4-6** | **L'espace insécable et sa version CLDR** — `1 234,50 €` en `fr-FR` porte **U+202F** entre les chiffres et **U+00A0** avant le symbole, et le U+202F est arrivé avec **CLDR 42 / ICU 72**. Un moteur qui normalise les espaces, ou un test d'or qui fige la chaîne rendue, casse sur l'une des deux versions de Node de la CI | **E4** (rendu), **E2/E5** (mise en page), **QA** (tests d'or) | E2, E4 |
| **E4-7** | Le calendrier et le système de chiffres sont **épinglés par le contrat** : ne pas les repasser, ne pas les surcharger | **E4** | E4 |
| **E4-8** | Le résolveur rend `{ ok: false, refusal }` — **la cause survit** —, un formateur rend `undefined` (une cause). Reste à E4 : « blanc ou échec », question 2 d'ADR 0001, **toujours ouverte** ; et un `switch` clos par `const exhaustive: never` | **E4** / **E3** | E3 |
| **E4-9** | Le viewer et le moteur emploient le **même ICU**, ou la promesse d'aperçu identique au PDF tombe | **lots V**, **E5** | J4 |
| **E4-10** | ⛔ **Le moteur ne construit JAMAIS une `Presentation` à la main** — il n'emploie que la branche `ok: true` du résolveur. Les **cinq familles** de fautes atteignables autrement sont recopiées ci-dessus, **verbatim et exprès**, pour rendre cette obligation opposable | **E4** | E4 |
| **E4-11** | **Tenir cohérents les DEUX commutateurs** — les mots basculent par un `if` lisant une **donnée**, les valeurs par le **nom** passé au résolveur. Ils sont indépendants **par conception**, et rien dans Openview ne voit `rendu.langue = 'fr'` servi avec l'écriture `en-usd` : **libellés français, montants en dollars**, parse vert, rendu vert | **E4** + **intégrateur** ; avertissement **Designer** | E4 |
| **D-06b** | ⛔ **Une locale n'est plus refusée à la frappe** : le parse ne juge que la grammaire. Le Designer doit **avertir depuis le résolveur**, et depuis le résultat discriminé il en a les moyens. Ce qui lui reste : distinguer « tag inconnu » de « tag sur-spécifié dont la forme courte marcherait », par un `supportedLocalesOf` de trois lignes | **lots V / Designer** | V |

> ⚠️ **Les deux dernières lignes sont neuves, et elles sont le prix nommé des deux corrections
> structurantes du lot** — la coupure de la locale, et la revalidation complète. `D-06b` en
> particulier tombe dans un manque que le lot reconnaît : **le Designer n'a été instruit nulle part.**

### Pourquoi les DEUX commutateurs restent séparés

Les coudre **interdirait un document correct**, et c'est l'argument décisif : anglais + euros pour un
client britannique d'une société française, c'est-à-dire `en-FR` — précisément le tag dont la
mesure ③ montre qu'il est le cas d'usage du critère de recette.

Et cela ferait d'Openview l'arbitre de « ces deux déclarations se contredisent », **ce qui est une
règle métier** — refusée d'emblée par la règle de périmètre. La vitrine montre donc les **quatre**
combinaisons, les deux croisées **étiquetées comme telles**, avec la phrase qui va avec : *ces deux
commutateurs sont indépendants par conception ; les tenir cohérents appartient à l'intégrateur*.

Une vitrine qui ne proposerait que les deux diagonales laisserait croire à un couplage qui n'existe
pas.

---

## ⛔ La faiblesse structurelle du lot, écrite en tête plutôt qu'enterrée

**Le contrat livre un VERBE, et jamais la liste des SITES.**

Un modèle imprime un numéro de commande, une quantité et un total. Le document stocké **ne les
distingue pas**, et **il ne le doit pas** : reconnaître un total exigerait de réserver un nom de
champ. La mesure est celle de la vitrine — `commande.numero` vaut `20260014`, et une écriture
appliquée à tous les nombres imprimerait `20 260 014`, **qui désigne une autre commande**.

> **C6 remet au moteur tout ce qu'il faut pour écrire une valeur, et ne lui dit pas quelles valeurs
> écrire.**

Les deux mécanismes qui **exprimeraient** le lien site → écriture sont tous deux refusés, et les
refus n'ont pas le même coût :

| Mécanisme | Réversibilité | Verdict |
| :--- | :--- | :--- |
| **un kind d'expression** (`format(x, …)`) | ⛔ **irréversible** — un kind neuf élargit une union **stockée**, et une union élargie ne se rétrécit plus une fois qu'un client a enregistré un document | **refusé**, et le refus est **gratuit** : le motif avancé pour lui était qu'un `concat` aplatit ses parties avant qu'un segment existe, et le seul consommateur réel contient **zéro** `concat` enfouissant une valeur à formater |
| **un champ optionnel sur un segment** | ✅ **la classe la moins chère du dépôt** — c'est le cas *perte silencieuse*, donc une estampille et une migration d'identité | **différé**, coût **acté** : une seconde estampille à la charge d'E4 |

**Le différé est pris en connaissance de cause.** Livrer le champ aurait laissé le lot hors de
`ast/**` au prix de deux champs d'AST, deux paires de clés d'alignement, les fixtures **et le premier
invariant croisé du lot** — donc sa propre campagne de vérification, sur un lot déjà lourd. La
conséquence assumée : **E4 câble les sites à la main**, et `20260014` peut s'imprimer `20 260 014` si
personne n'y prend garde.

### La cardinalité, moins grave et plus visible

Un modèle bilingue qui écrit montants, quantités et prix unitaires déclare **six** entrées. C'est
**verbeux**, et c'est assumé : le lot livre le **mécanisme**, pas l'ergonomie. Un panneau d'édition
de table d'écritures, un sélecteur dans l'aperçu, et un avertissement quand un modèle déclare une
table que rien ne consomme appartiennent aux lots Designer.

---

## Ce que le lot n'est PAS — par familles, avec le propriétaire de chaque refus

### F0 — Ce que le lot ne PROMET pas

**La conformité.** « Deux documents *corrects* » n'a pas de juge, et c'est une décision de périmètre :
une facture américaine ne diffère pas d'une française que par les mots et les formats — bloc
d'adresse, *sales tax* contre TVA, mentions légales. **La conformité appartient à l'intégrateur.**

### F1 — Ce qui appartient à la DONNÉE et à l'INTÉGRATEUR

Le jeu de données, ses noms de champs, la **langue courante** (`rendu.langue` est un nom que
l'intégrateur a choisi, pas une clé réservée), le **taux de change** — afficher « $ » n'est pas
convertir des euros en dollars.

### F2 — Ce qui appartient au MOTEUR

Le choix des sites, l'ordre arrondi/formatage, la politique « blanc ou échec », la mise en page des
espaces insécables. Les onze attentes ci-dessus sont la liste complète.

### F3 — L'ENVIRONNEMENT : ce que le lot refuse de lire, y compris pour lui-même

Aucune horloge, aucun fuseau autre qu'`UTC` **épinglé**, aucune locale de machine, aucun aléa. **Pas
un seul objet `Date` construit.** Le seul appel qui interroge la machine est l'**honorat**, et il
interroge « ce build connaît-il *ce tag* », jamais « quelle est la langue de ce build ».

### F4 — Ce qui appartient à d'AUTRES LOTS

Le rendu (E4), l'ergonomie du Designer (lots D), la garantie de version d'ICU entre viewer et moteur
(J4), le lien déclaratif site → écriture (E4).

### F5 — Les refus de MÉTHODE

Aucun patron de date (`dd/MM/yyyy`) — il ferait du modèle le propriétaire de l'**ordre** des champs,
et c'est la duplication que le lot existe pour supprimer. Aucun cache de formateur — ce serait de
l'**état** dans `core`, et l'état est la façon dont deux rendus d'un document diffèrent. Aucune liste
close de locales ni de devises. Aucun catalogue de messages.

---

## Ce qui reste ouvert — trois arbitrages, et ils appartiennent au propriétaire du produit

**Le code est livré, mesuré et vert.** Ce qui suit ne bloque aucun commit : cela bloque le passage de
cette ADR de 🟡 **Proposé** à 🟢 **Accepté**, parce qu'**une ADR ne s'écrit pas contre une question
ouverte**.

### A-1 — Une locale inconnue de la machine qui OUVRE le document

**La question.** Un document déclarant `en-FR` s'ouvre sur un build d'ICU et pas sur un autre. Le lot
tranche pour **ouvrable avec une écriture non résolue**, refusée au rendu.

**Ce que l'autre branche coûterait**, et c'est pourquoi elle n'a pas été prise : refuser à l'ouverture
rendrait [D-06] irréversible de fait, et obligerait Openview à **publier une version d'ICU minimale**
— donc à détenir un référentiel, ce que [D-06] et [D-08] refusent tous les deux.

**Ce qui reste à trancher :** la branche retenue est-elle acceptée comme **politique produit** ? Elle
a une conséquence visible pour un utilisateur — un document qui s'ouvre et dont une écriture ne rend
rien — et cette conséquence appartient au produit, pas au contrat.

### A-2 — ⛔ Le critère de recette appartient à E4, et le texte de la roadmap ne le dit pas

**Le fait.** Le critère de recette de la brique est **mot pour mot** celui du lot moteur E4, et
`core` **ne rend rien**. Aucun contrat de `core` ne peut donc satisfaire le critère **tel qu'il est
écrit**.

**La recommandation :** `core` **déclare**, E4 **produit**. Ce qui suppose de réécrire le « prêt
quand » de la roadmap en deux moitiés :

- **`core` C6 est prêt quand** un `Template` unique **déclare** deux écritures, qu'un appelant en
  sélectionne une **par un argument**, que les trois fonctions rendent deux chaînes différentes
  portant les mêmes chiffres, et que `collectTemplateDataPaths` rende la **même liste** dans les deux
  cas. **Tout cela est livré et démontré** — par des `it` et par la vitrine.
- **`engine` E4 est prêt quand** une facture bilingue **sort** en PDF, dans les deux écritures, avec
  les sites correctement choisis.

⛔ **Sans cet arbitrage, le lot ne peut pas être déclaré fini** — non parce qu'il manque du code, mais
parce que le texte contre lequel on le mesure décrit le travail d'un autre lot.

### A-3 — ⛔ Ce contrat dépend d'ICU, et une ADR acceptée dit qu'il ne le doit pas

**La cible a été rectifiée**, et la rectification importe : l'[ADR 0003](0003-formules-agregations-et-dates-civiles.md)
énonce ses deux conditions dans le **critère d'admissibilité de l'algèbre d'expressions**, et le sujet
de la phrase est « *une opération de date* ». **Ce lot n'ajoute aucune opération à l'algèbre**, donc
l'ADR 0003 **n'interdit pas ce contrat** au sens strict. Le conflit réel est avec l'**énoncé de
déterminisme** que le lot moteur E6 hérite.

**L'amendement rédigé, en trois phrases opposables** — il reste à accepter, et il n'est **pas** porté
par ce lot :

> **Amendement C6.** Une fonction de `presentation/` peut appeler `Intl` **si et seulement si** la
> locale lui est **déclarée par le modèle**, **structurellement valide au sens d'ECMA-402**
> (`wellFormedLocale`, au parse) et **honorée telle quelle** par ce moteur (`honouredLocale`, au
> rendu), et si `timeZone`, `calendar` et `numberingSystem` sont **épinglés en littéral en ligne**.
>
> La garantie de déterminisme devient : *deux rendus du même document par le **même build**
> produisent la **même chaîne** ; deux builds portant deux versions d'ICU peuvent produire deux
> **caractères d'espace** différents.*
>
> Le second point est la contrainte que **E6 hérite**, et il est **mesuré** : `1 234,50 €` en `fr-FR`
> porte U+202F entre les chiffres et U+00A0 avant le symbole, et le U+202F est arrivé avec **CLDR 42
> / ICU 72**. La CI tourne deux majeures de Node, donc deux jeux CLDR.

**Ce qui reste vrai sans amendement, et il faut le dire d'abord :** aucune fonction d'expression ne
lit ICU après ce lot, et le critère `git grep -c "case 'round':" -- packages/core/src/expression`
reste à **2** — le lot n'écrit **aucun nouveau `switch`**.

**Propriétaire : le propriétaire du produit.** Un lot ne s'amende pas lui-même une ADR acceptée ;
l'incrément **porte** l'amendement, il ne le **décide** pas.

### Les mandats non bloquants, pour mémoire

| # | Mandat | Statut |
| :-- | :--- | :--- |
| **M-4** | `numberingSystem` doit-il devenir déclarable ? | **non déclenché** — épinglé aujourd'hui, réversible pour une estampille |
| **M-5** | Le poids annoncé du lot était sous-estimé | **constat**, pas une action : corriger l'ordonnancement rouvrirait la vague |
| **M-7** | L'énoncé d'E6 face à **deux** versions d'ICU | **lié à A-3** — c'est ce lot qui introduit la dépendance à CLDR, donc l'amendement d'A-3 est ce qui le règle |

---

## Ce que l'exécution a corrigé du plan

Le plan d'implémentation est **périmé**, et cette ADR fait foi. Trois points où l'exécution a
divergé, nommés plutôt que tus :

### ① Le plan prescrivait ses docstrings verbatim, et `AGENTS.md` §1.6 les a interdites

La règle §1.6 — *hygiène des commentaires et concision documentaire* — est apparue **pendant**
l'exécution du lot. Elle interdit dans le code les numéros de lot, les hachages de commit,
l'historique des brouillons rejetés, les dépôts de métriques et les passages en majuscules — c'est-à-
dire l'essentiel de la prose que le plan prescrivait mot pour mot dans son §3.

**Le contrat livré est celui du plan** — types, schémas, refus, signatures, estampille, tests. **La
prose ne l'est pas** : les mesures sont descendues dans les tests, et les arbitrages sont montés
**ici**. C'est exactement la séparation que §1.6 demande, et c'est pourquoi cette ADR est plus longue
que ses docstrings.

### ② Le nombre de tests existants qui rougissent : quatre, et pas douze

Mesuré à l'exécution, contre le dépôt réel :

| Fichier:ligne | Assertion | Avant | Après |
| :--- | :--- | :-: | :-: |
| `template/migrate.test.ts:158` | la liste littérale des paires `[from, to]` | 5 entrées | **6** |
| `template/migrate.test.ts:191` | `expect(parsed.schemaVersion).toBe(6)` | 6 | **7** |
| `template/migrate.test.ts:210` | `expect(parsed.schemaVersion).toBe(6)` | 6 | **7** |
| `style/__tests__/style.test.ts:134` | `expect(values).toHaveLength(117)` | 117 | **126** |

Tout le reste du dépôt passe par `CURRENT_SCHEMA_VERSION` et reste **vert**.

⚠️ **Et une assertion du dépôt paraît être un filet et n'en est pas un.**
`expect(TEMPLATE_MIGRATIONS).toHaveLength(CURRENT_SCHEMA_VERSION - 1)` reste **verte** au passage
6 → 7, parce que **les deux côtés bougent ensemble**. Elle attrape l'oubli d'une entrée **ou** celui
d'une estampille, jamais l'oubli **des deux à la fois** — qui est exactement la façon dont on se
trompe. Le seul filet mécanique sur la marche neuve est la **liste littérale**.

### ③ La vitrine montre les quatre combinaisons à la fois, plutôt que deux boutons

Le plan prescrivait **deux boutons** à état. La page est bâtie **entièrement de constantes de
module** — elle ne porte aucun `useState` — et un tableau 2×2 statique montre les **quatre**
combinaisons **simultanément**, ce qui est strictement plus démonstratif qu'un basculement qui n'en
montre qu'une. L'exigence de fond du plan est satisfaite et dépassée : les deux croisées sont
visibles **côte à côte** avec les deux diagonales, étiquetées comme telles.

---

## Les conséquences

### Pour `@openview/core`

Un dossier neuf de six fichiers, **une** forme stockée, **un** site d'accrochage, **une** estampille.
Aucun champ sur aucun nœud, donc `visitor.ts`, les unions `BlockNode` / `DocumentNode` et toutes les
paires de clés d'alignement sont **intactes**. Aucune expression nouvelle, aucun kind nouveau, aucun
`switch` neuf. Le compte du barrel public passe de **117** à **126** valeurs, mesuré par émission ESM
réelle puis import.

### Pour `@openview/engine`

**Onze** attentes nommées, dont **une qu'aucune porte ne tient** (`E4-10`) et dont le tableau des cinq
familles de fautes est recopié ici pour la rendre opposable. Et une obligation de méthode : **ne
jamais figer une chaîne formatée dans un test d'or**, parce que la CI tourne deux jeux CLDR.

### Pour `@openview/designer`

Une obligation neuve, `D-06b` : une locale n'est plus refusée à la frappe, elle doit être **avertie
depuis le résolveur**. C'est le prix nommé de la coupure de [D-06], et il tombe dans un manque que ce
lot reconnaît — **le Designer n'a été instruit nulle part**.

### Pour la migration, et pour la pérennité

Un document écrit **avant C1** traverse les six marches et ressort estampillé **7**, `presentations`
valant `undefined`, la feuille A4 inventée par la marche 4 → 5 **intacte**. La marche 6 → 7
**n'invente rien**, et c'est ce qui rend la pérennité gratuite ici.

### Ce qui reste non mesuré, et le dire est la moitié du travail

| Hors portée de toute porte | Propriétaire |
| :--- | :--- |
| Le rendu d'une facture bilingue — `core` **ne rend rien** | **E4** |
| La comparaison entre **deux** versions d'ICU dans un même processus — impossible, un processus n'en porte qu'une. La seule défense est de n'écrire **aucune** assertion sensible à CLDR | doctrine, **QA** |
| L'espace insécable dans le PDF | **E4** ; **E2/E5** |
| La conformité d'une facture | **intégrateur** |
| `numberingSystem: 'latn'` épinglé en dur — une facture `ar-EG` sort en chiffres latins. **Défendable, et pas neutre** | **propriétaire du produit** |
| La survie de la règle *nursery* et du plugin `.grit` à la prochaine montée de Biome — la sonde jetable doit être **rejouée à chaque montée** | **revue de dépendances** |
| L'ergonomie du Designer | **lots D** |

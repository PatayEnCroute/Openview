# ADR 0010 — Un refus compréhensible

- **Statut :** 🟢 **Accepté** (2026-08-21), implémenté dans `@openview/core`
- **Date :** 2026-08-21
- **Impact :** `@openview/core` (**un sous-système nouveau**, `src/diagnostics/`, une **union
  discriminée** de six familles, **deux fonctions publiques**, quatre catalogues fermés, un `code`
  requis sur `TemplateMigrationError` et **cinq messages d'expression reformulés** ; **aucun champ
  de modèle, aucune forme persistée, aucune migration**), `@openview/engine` (les enveloppes de
  téléchargement, de DOM, de pagination et de police restent à écrire, et **hors** de cette union),
  `@openview/designer` et `@openview/viewer` (leurs adaptateurs consommeront `source`, `code`,
  `path` et `nodeId` sans qu'aucun soit anticipé ici), `apps/playground` (le **seul consommateur
  réel**, qui remplace ses deux rapporteurs manuels par la façade et affiche les **dix cartes de
  recette** du jalon J1)
- **Complète :** [ADR 0001](0001-expression-language.md), dont la règle de la donnée absente est
  **confirmée et non préemptée** (D10, « Ce qui reste ouvert ») ; [ADR 0003](0003-formules-agregations-et-dates-civiles.md),
  dont la décision d'erreur prévoyait « *la formulation et la façade* » — c'est ce lot qui les livre,
  et sa garantie de non-fuite est **étendue** de la charge d'expression à toute la façade (D5) ;
  [ADR 0008](0008-langue-devise-et-formats.md), dont le refus typé de `resolvePresentation` devient
  **réellement itérable** (D9) ; [ADR 0009](0009-les-blocs-insecables.md), qui annonçait « *C8 hérite
  d'un chemin d'issue stable, `keepTogether`, et d'aucun message* » — le message existe désormais, et
  c'est le **schéma** qui le porte, pas la façade (D7).
- **N'amende aucune règle de gouvernance.** `AGENTS.md`, les `tsconfig*`, `biome.jsonc`, les plugins
  GritQL, `turbo.json`, `sonar-project.properties`, les workflows, `package.json` et
  `pnpm-workspace.yaml` sortent du lot **inchangés** : **zéro dépendance nouvelle**.
  `template/template.ts` et le contenu de `TEMPLATE_MIGRATIONS` sortent **octet pour octet** —
  `CURRENT_SCHEMA_VERSION` reste **8** et la chaîne reste à **sept** entrées (D8). Les trois paquets
  aval sortent intacts.
- **Plan d'implémentation :**
  [docs/plans/c8-un-refus-comprehensible.md](../plans/c8-un-refus-comprehensible.md) — **périmé**
  une fois le lot livré, comme le dit son propre en-tête. C'est cette ADR qui fait foi, et elle
  **corrige** son plan sur cinq points nommés au [§ Ce que l'exécution a corrigé du plan].
- **Implémentation :**
  [`src/diagnostics/types.ts`](../../packages/core/src/diagnostics/types.ts) (l'union et les
  catalogues),
  [`src/diagnostics/messages.ts`](../../packages/core/src/diagnostics/messages.ts) (les quatre
  tables de phrases),
  [`src/diagnostics/from-zod.ts`](../../packages/core/src/diagnostics/from-zod.ts) (la table totale
  des codes d'issue et la dérivation),
  [`src/diagnostics/from-error.ts`](../../packages/core/src/diagnostics/from-error.ts) (les
  adaptateurs des erreurs typées),
  [`src/diagnostics/paths.ts`](../../packages/core/src/diagnostics/paths.ts) (la copie et le
  préfixage des chemins),
  [`src/diagnostics/diagnose.ts`](../../packages/core/src/diagnostics/diagnose.ts) (les deux
  fonctions publiques),
  [`src/errors.ts`](../../packages/core/src/errors.ts) (les cinq codes de migration et le champ
  `code`),
  [`src/template/migrate.ts`](../../packages/core/src/template/migrate.ts) (l'attribution du code
  exact à chacun des cinq sites),
  [`src/presentation/types.ts`](../../packages/core/src/presentation/types.ts) (le tuple),
  [`src/validation-messages.ts`](../../packages/core/src/validation-messages.ts) (la liste fermée
  des phrases de schéma que la façade peut conserver),
  [`src/ast/schemas.ts`](../../packages/core/src/ast/schemas.ts) (la phrase de `keepTogether`),
  et les cinq sites de levée d'expression reformulés

---

## Contexte

La roadmap demande dix messages qu'un utilisateur corrige seul, dont cinq erreurs de formule. Ce
n'est pas une exigence de rédaction : c'est une exigence de **véhicule**. Avant ce lot, cinq refus
coexistaient dans `core` sans rien partager.

- Une validation de schéma laissait remonter une `ZodError` brute. Son `message` global est un
  **dump de toutes les issues**, et le playground en tirait la première par indice.
- Une erreur de formule portait déjà un code, un site et un chemin — mais **ne connaissait pas le
  bloc** qui contient l'expression, parce que ce fait n'appartient pas à l'évaluateur.
- Une erreur de forme ou de migration était typée mais n'employait **aucune structure commune** : la
  migration n'avait même pas de `code`, seulement une phrase et un `fromVersion`.
- `resolvePresentation` ne lève rien du tout et rend un **motif de refus** : un troisième dialecte.
- Et une faute de programmation — un `TypeError` dans une fonction de migration fournie par
  l'appelant — devait rester une faute de programmation, jamais devenir une phrase qu'un auteur de
  modèle essaierait de corriger.

Le playground était la preuve du problème. Il portait **deux** rapporteurs, écrits séparément parce
qu'aucun contrat commun n'existait : l'un ouvrait `ZodError.issues`, l'autre
`ExpressionEvaluationError.details`, et chacun rebâtissait localement un chemin, un code et une
phrase que rien n'obligeait à rester cohérents d'une section à l'autre. Un troisième affichait le
`refusal` de présentation **brut**, `unknown-writing`, à l'écran.

Une application intégratrice aurait dû écrire les trois. C'est ce que ce lot supprime.

---

## Le partage des responsabilités, écrit AVANT la première ligne

| Responsabilité | Propriétaire |
| :--- | :--- |
| Nommer la cause, le site et le chemin | `@openview/core`, ce lot |
| Fournir l'`id` du bloc qui évalue une formule | le consommateur qui possède ce bloc |
| Échapper et disposer les champs dans une interface | l'application hôte, le Designer, le playground |
| Traduire une phrase | l'application hôte, par `source` + `code` |
| Choisir la politique d'une donnée absente dans une liaison | le futur `DataBindingStep`, lot moteur |
| Identifier une **occurrence** matérialisée d'une boucle | le moteur, lot E5 |
| Diagnostiquer un téléchargement, un DOM, une pagination, une police | les lots moteur, dans leurs propres enveloppes |

La deuxième ligne est celle qui a le plus de conséquences. `core` **ne cherche pas** l'`id` du nœud
fautif : il ne reçoit ni le template brut, ni `RenderRequest.data`, ni une callback qui relirait
l'entrée. Chercher un `id` dans un objet **invalide** obligerait à déclencher des getters sur une
donnée que le garde de forme vient précisément de refuser.

---

## Les dix décisions

### D1 — Une union discriminée, jamais une grosse interface à champs optionnels

`OpenviewDiagnostic` est une union à six branches. Chaque branche porte toujours cinq champs —
`source`, `code`, `message`, `path`, `nodeId` — et **uniquement** les détails qui ont un sens pour
elle :

| Branche | Détails propres |
| :--- | :--- |
| `template-validation` | `expected` pour `invalid-type`, `acceptedValues` pour `invalid-value` |
| `template-migration` | `fromVersion: number \| undefined` |
| `template-shape` | `limit: number \| undefined` |
| `expression-evaluation` | `site`, puis `actualType` **ou** `limit` |
| `presentation-resolution` | aucun |
| `configuration` | aucun |

La branche d'expression **conserve le narrowing** de `ExpressionErrorDetails` : un code d'opérande
porte `actualType` et n'a pas de `limit`, un code de borne porte `limit` et n'a pas d'`actualType`.
Une seule interface avec `actualType?` et `limit?` aurait rendu les deux illisibles au type et
obligé chaque consommateur à écrire une garde que le compilateur n'aurait pas vérifiée.

Le sous-système est découpé selon la règle de modularité d'`AGENTS.md` §2 : les types purs dans
`types.ts`, les phrases dans `messages.ts`, une transformation par origine (`from-zod.ts`,
`from-error.ts`), les chemins dans `paths.ts`, la façade dans `diagnose.ts` et un barrel
`diagnostics.ts`. Il ne devient **pas** un second `errors.ts` : aucune classe n'y est levée.

### D2 — Le contexte est FOURNI par le consommateur, jamais deviné

`DiagnosticContext` ne porte que deux faits que l'appelant possède déjà :

```ts
export interface DiagnosticContext {
  readonly nodeId?: string | undefined;
  readonly pathPrefix?: readonly (string | number)[] | undefined;
}
```

Le chemin final est une **copie** de `pathPrefix` suivie d'une **copie** des segments propres au
refus. Pour une `ZodError` de `parseTemplate`, le chemin Zod est déjà absolu et l'appelant ne passe
normalement aucun préfixe ; pour une formule, le préfixe est ce qui situe l'expression dans le
modèle. Sans préfixe, le chemin reste **relatif à la racine de l'expression**, ce qui préserve les
usages autonomes d'`evaluateExpression`.

`path` est l'**identité canonique** de la déclaration. `nodeId` est un libellé pratique : les `id`
de nœuds ne sont **pas** garantis uniques dans tout le document ([ADR 0005](0005-le-tableau-de-lignes.md)),
et [ADR 0009](0009-les-blocs-insecables.md) D3 laisse l'identité d'**occurrence** à E5. Un
diagnostic localise une **déclaration**, pas une occurrence de rendu : sous une boucle, `nodeId` et
`path` désignent le nœud du modèle.

### D3 — Une erreur inconnue reste inconnue, et le patron consommateur est une relance

`diagnosticsOf(error)` rend `undefined` si l'erreur n'est ni une erreur de validation reconnue, ni
une erreur typée d'Openview. Il ne rend **jamais** un diagnostic générique :

```ts
const diagnostics = diagnosticsOf(error, context);
if (diagnostics === undefined) {
  throw error;
}
```

Un `OpenviewError` **nu** tombe dans ce cas, délibérément : la classe de base n'est pas une famille.
Une exception arbitraire levée par une fonction de migration fournie par l'appelant n'est **pas
reclassée** — elle traverse la façade et le patron ci-dessus la relance telle quelle, avec sa pile.
Le moteur marque cette identité dans un `WeakSet` interne avant de relancer : même une `ZodError`
émise par le code de migration reste donc une faute de l'appelant, sans mutation ni perte de pile.

Une erreur de validation peut porter **plusieurs** issues et rend alors plusieurs diagnostics. Ce
lot ne garde pas seulement la première, ne fusionne pas deux corrections indépendantes et **ne
promet aucun ordre** entre elles : tous ses tests les retrouvent par `source`, `code` et `path`,
jamais par indice. Le playground fait de même.

### D4 — Anglais par défaut, `source` + `code` pour la traduction

Le message par défaut est anglais, comme tous les messages et commentaires du code. `source` +
`code` choisit la **branche stable** de traduction ; `expected`, `acceptedValues`, `site`,
`actualType`, `limit` et `fromVersion` fournissent les paramètres nécessaires, jamais la phrase.

**La langue d'une `Presentation` n'est jamais consultée.** Une écriture décrit le **document
imprimé** ; un diagnostic adresse l'**outillage de l'auteur**. Ce sont deux publics, et le lot C6 a
déjà payé le prix de cette distinction. Aucune table de traduction publique, aucun registre, aucun
Port d'i18n n'est ajouté : la règle anti-sur-ingénierie d'`AGENTS.md` §3 l'exclut faute de second
adaptateur, et le besoin réel est un `switch` chez l'intégrateur.

### D5 — La localisation ne devient pas une fuite

`nodeId` et `path` sont des champs **séparés** de `message` et n'y sont **jamais interpolés**. Une
interface les rend comme du texte et les échappe elle-même ; une phrase qui les aurait épissés
rendrait cet échappement impossible.

Aucun diagnostic ne contient : la valeur fautive d'une donnée de rendu, un extrait du modèle ou de
son contenu textuel, la `cause` originale, une valeur reçue par le validateur, une locale, une
horloge ou une lecture d'environnement.

Les **seules** valeurs variables admises dans une phrase sont des limites de configuration, une
forme de valeur fermée (`text`, `a number`, `a list`…) et les **choix ou bornes déclarés par un
schéma**. La distinction est nette : `values: ["number", "count"]` vient du schéma, pas de l'entrée.

Le validateur retire `input` de l'issue finalisée, mais une `customError` globale peut l'avoir
interpolé dans `message` avant ce retrait. La façade ne traite donc jamais un message générique Zod
comme fiable : elle le reconstruit depuis les champs structurés et ne conserve que les phrases
exactes de la liste fermée `SAFE_SCHEMA_MESSAGES` ou les messages `custom` que les schémas
Openview écrivent eux-mêmes.

### D6 — Six familles ; `code` unique dans sa famille, et surtout pas de catalogue rival

`DIAGNOSTIC_SOURCES` énumère les six familles. `code` n'est unique qu'**à l'intérieur** de sa
famille : `invalid-type` sous `template-validation` et `too-deep` sous `template-shape` ne se
gênent pas.

Concaténer `source` et `code` dans une seconde constante — `'template-validation.invalid-type'` —
créerait un **catalogue rival** de la source de vérité, à maintenir en parallèle, et rien ne
forcerait les deux à rester d'accord. La clé de traduction est la **paire**, lue telle quelle.

Pour la même raison, `EXPRESSION_ERROR_CODES` et `SHAPE_ERROR_CODES` ne sont **ni copiés ni
fusionnés** dans une liste nouvelle. Les tests de ce lot les énumèrent directement : ajouter un
membre en amont sans scénario de diagnostic fait **échouer** la suite.

### D7 — Le vocabulaire des validations : dériver la phrase générique, garder la phrase écrite

`TEMPLATE_VALIDATION_CODES` est un tuple de six membres, indépendant des codes du validateur :

```ts
export const TEMPLATE_VALIDATION_CODES = [
  'invalid-type', 'invalid-value', 'invalid-format',
  'out-of-range', 'invalid-structure', 'invalid-relation',
] as const;
```

Le mapping depuis Zod 4 est **total par construction**, et c'est le point technique du lot :

```ts
const VALIDATION_CODE_BY_ISSUE: Readonly<Record<ZodIssue['code'], TemplateValidationCode>> = { … };
```

Un `Record` sur l'union des codes d'issue est plus fort qu'un `switch` avec `default`. Le jour où
une version de Zod ajoute un code, ce littéral **ne compile plus** — porte 2, avant tout test — et il
n'existe **aucune branche par défaut** à couvrir ni à oublier. C'est le même raisonnement que
l'amendement d'`AGENTS.md` §3.B sur `const exhaustive: never`, appliqué à une union qui n'est pas la
nôtre : on choisit le contrôle le plus fort disponible, pas le patron le plus attendu.

| Issue | Code | Phrase |
| :--- | :--- | :--- |
| `invalid_type` | `invalid-type` | nommer le type attendu |
| `invalid_value` | `invalid-value` | énumérer les valeurs **déclarées par le schéma** |
| `invalid_format` | `invalid-format` | conserver la raison de format écrite par le schéma |
| `too_small`, `too_big`, `not_multiple_of` | `out-of-range` | conserver la borne et son unité déclarées |
| `invalid_union`, `invalid_key`, `invalid_element`, `unrecognized_keys` | `invalid-structure` | demander une forme prise en charge |
| `custom` | `invalid-relation` | conserver le message de relation |

**Pour les deux premières lignes, aucun message global Zod n'est digne de confiance.** Une
application peut appeler `z.config()` avec une autre locale ou une `customError` qui interpole la
valeur reçue. `invalid_type` et `invalid_value` sont donc toujours reconstruits depuis `expected`
et `values`, sauf si leur phrase correspond exactement à `SAFE_SCHEMA_MESSAGES`. Cette liste
fermée contient les rares phrases qu'un schéma écrit parce qu'il connaît le vocabulaire du champ :
`A column width is a finite whole number of weight units` en dit plus que la phrase générique.

`TemplateValidationDiagnostic` conserve le narrowing correspondant : `invalid-type` porte
`expected`, `invalid-value` porte `acceptedValues`, et les quatre autres codes ne portent aucun de
ces deux champs. Une traduction peut ainsi garder l'action exacte sans analyser la phrase anglaise.
Deux tests configurent successivement une `customError` qui inclut une fausse clé secrète et la
locale française de Zod ; le diagnostic reste anglais et ne contient jamais la valeur.

`invalid_union` distingue enfin les unions discriminées des unions ordinaires. Une union sans
branche et avec la note « No matching discriminator » conseille de vérifier `type` ou `kind` ; une
union primitive, comme la valeur d'un littéral, demande seulement une forme prise en charge.

Conséquence directe et voulue : la phrase du cas de recette n° 1 vit dans **`ast/schemas.ts`**, pas
dans la façade. `keepTogether` est un `z.literal(true).optional()`, et seul le schéma sait que la
clé est **optionnelle** — d'où « *omit it to allow the block to split* », que rien dans une issue ne
permet de deviner. C'est aussi ce qui répond à [ADR 0009](0009-les-blocs-insecables.md) : le message
existe, et il n'a pas coûté un champ.

Enfin, les chemins sont **copiés**, et un segment qui n'est ni chaîne ni nombre — le validateur
déclare `PropertyKey[]`, donc un symbole est possible — **arrête** le chemin sur le préfixe accepté
et devient une structure invalide. Aucun cast n'est inventé, et la valeur du segment n'est jamais
exposée.

### D8 — Chaque migration nomme sa cause, et la phrase du diagnostic n'est PAS celle du journal

`TEMPLATE_MIGRATION_ERROR_CODES` compte cinq membres, et `TemplateMigrationError` porte désormais un
`code` **requis sur l'instance**. Son troisième paramètre reste **source-compatible** avec
`ErrorOptions` :

```ts
export interface TemplateMigrationErrorOptions extends ErrorOptions {
  readonly code?: TemplateMigrationErrorCode | undefined;
}
```

Un appel à deux arguments continue de compiler et reçoit `invalid-migration-result` ; les cinq sites
internes passent leur cause exacte.

| Site | Code |
| :--- | :--- |
| entrée non objet | `invalid-template` |
| `schemaVersion` absent, non numérique ou invalide dans l'entrée stockée | `missing-schema-version` |
| version supérieure à la version courante | `newer-schema-version` |
| aucune étape depuis la version lue | `missing-migration` |
| sortie sans version exploitable, ou étape qui n'avance pas | `invalid-migration-result` |

**Et la phrase du diagnostic n'est pas celle de l'erreur levée.** C'est une décision, pas un oubli.
La phrase levée par `migrate.ts` — « *Template uses schema version 9 but this build understands at
most 8…* » — s'adresse à un journal et à un développeur : elle nomme deux nombres, et `AGENTS.md`
§1.2 la cite comme la preuve que l'estampille sert à quelque chose. La phrase du **diagnostic**
s'adresse à un auteur de modèle qui n'a rien à faire de ces nombres, et le seul remède qu'il puisse
appliquer est de mettre Openview à jour :

> `This template was created by a newer Openview schema version. Upgrade Openview before opening it.`

Le nombre reste disponible dans `fromVersion`, où une interface peut le prendre ou l'ignorer. La même
séparation vaut pour `template-shape` : la limite voyage dans `limit`, la phrase dit « *exceeds the
configured nesting limit* ». Corollaire : **`migrate.ts` et `guard.ts` gardent leurs phrases**, et
`guard.ts` sort du lot inchangé.

La famille `expression-evaluation` est l'**exception**, et pour une raison nette : ses messages
nomment déjà l'attente **et** la correction, et ils sont produits au site de levée, qui est le seul
endroit connaissant l'opérande. C'est donc là que les cinq reformulations de D10 sont faites.

### D9 — Le tuple de présentation devient réel, et sa fonction reste séparée

`PresentationRefusal` était une union écrite à la main. Elle devient un tuple, dont le type est
dérivé :

```ts
export const PRESENTATION_REFUSALS = ['unknown-writing', 'invalid-writing', 'unhonoured-locale'] as const;
export type PresentationRefusal = (typeof PRESENTATION_REFUSALS)[number];
```

C'est ce que [ADR 0008](0008-langue-devise-et-formats.md) laissait à faire : une union ne s'énumère
pas à l'exécution, donc rien ne pouvait vérifier que les trois causes ont trois phrases distinctes.
Un test le vérifie maintenant, et il compte trois codes **et** trois messages.

`diagnosticOfPresentationRefusal()` reste une fonction **séparée** de `diagnosticsOf()`, et rend un
diagnostic **unique** plutôt qu'un tableau. Un `PresentationRefusal` est une **réponse normale** de
`resolvePresentation`, pas une exception : le passer à une façade dont le contrat est « rends
`undefined` si tu ne reconnais pas » serait un contresens — et `diagnosticsOf('unknown-writing')`
rend `undefined`, ce qu'un test épingle.

La troisième phrase n'accuse personne : une locale bien formée que **ce** moteur n'honore pas est une
propriété de la machine qui lit, ni la faute de l'auteur ni celle de l'appelant. C'est exactement ce
que l'ADR 0008 demandait qu'un Designer n'imprime pas de travers.

### D10 — Cinq reformulations de formule, et UN seul vocabulaire de forme

Les cinq phrases de la recette remplacent les formulations techniques **au site de levée** :

| Cause | Phrase |
| :--- | :--- |
| division par zéro | `This formula divides by zero. Guard the divisor with an "if" before dividing.` |
| texte additionné à un nombre | `This arithmetic formula needs numbers, but the highlighted operand is text.` |
| date civile invalide | `This formula needs a valid date in YYYY-MM-DD form between 0001-01-01 and 9999-12-31.` |
| boucle ou corps de tableau sur un nombre | `This block needs a list to repeat, but the selected value is a number.` |
| condition qui produit du texte | `This condition must return true or false, but it returns text. Add a comparison or use isEmpty.` |

Trois de ces phrases nomment une **forme** de valeur, et elles la prennent au **même** endroit :
`describe()`, la table de `VALUE_DESCRIPTIONS` qui existait déjà. Une seule entrée a changé —
`string` passe de `'a string'` à `'text'` —, et c'est ce qui rend les trois phrases dérivables sans
seconde table. Le mot est aussi le bon pour le public visé : un auteur de facture ne lit pas « *a
string* ».

Le contrôle a été fait sur les **sept** autres usages de `describe()` : aucun ne peut recevoir
`'text'` là où la phrase deviendrait absurde, parce que les gardes qui les précèdent laissent passer
les chaînes. « *A date is a text in the YYYY-MM-DD form, got text.* » n'est pas atteignable.

`LIST_CALLER_SUBJECTS` perd sa distinction entre `loop` et `tableRowGroup` : les deux disent « *This
block* », parce que les deux **sont** des blocs qu'un auteur voit sur la page. Ce qui les distingue
reste le champ `site`, qui est structuré et traduisible — et deux tests le vérifient séparément.
Les sites qui ne sont pas des blocs — `aggregate`, `count`, `filter` — gardent leur sujet.

**Les autres messages d'expression restent inchangés** lorsqu'ils nomment déjà l'attente et la
correction sans exposer de valeur. Les treize codes sont couverts par une matrice exhaustive, y
compris les huit que la recette ne sélectionne pas.

---

## Ce que le lot mesure

| Mesure | Avant | Après |
| :--- | :--- | :--- |
| valeurs exportées par le barrel ESM | 126 | **133** (+7) |
| types exportés | — | **+13** |
| `CURRENT_SCHEMA_VERSION` | 8 | **8** |
| entrées de `TEMPLATE_MIGRATIONS` | 7 | **7** |
| champs de modèle ajoutés | — | **0** |
| dépendances ajoutées | — | **0** |
| tests | 733 | **845** (+112) |
| couverture, statements | — | **99,69 %** |
| couverture, branches | — | **99,24 %** |
| couverture, functions | — | **100 %** |

Les sept valeurs nouvelles sont `diagnosticsOf`, `diagnosticOfPresentationRefusal`,
`DIAGNOSTIC_SOURCES`, `TEMPLATE_VALIDATION_CODES`, `CONFIGURATION_DIAGNOSTIC_CODES`,
`TEMPLATE_MIGRATION_ERROR_CODES` et `PRESENTATION_REFUSALS`.

**Les dix cas de recette rendent dix phrases distinctes**, et un test le compte comme un ensemble de
dix — pas comme dix assertions qui pourraient toutes viser la même phrase. Le playground les affiche
et se casse s'il en manque une : chaque carte est construite par une fonction qui **lève** si la
façade n'a rien dit sur le chemin visé.

---

## Conséquences

### Pour `@openview/engine`

La façade diagnostique les contrats de `core`. Un échec de téléchargement, un DOM refusé, une
pagination impossible, une police absente n'entrent **pas** dans cette union : ils appartiendront
aux lots moteur et à leurs propres enveloppes. Le jour où un lot moteur voudra les y verser, il
ajoutera une **famille**, pas un code fourre-tout dans une famille existante.

`DataBindingStep` hérite d'une dette **nommée** : la politique de la donnée absente (« blanc ou
échec ») lui appartient toujours, et ce lot n'a rien fait pour la préempter.

### Pour `@openview/designer` et `@openview/viewer`

Les deux consommeront `source`, `code`, `path` et `nodeId`. Le Designer possède l'`id` du bloc qu'il
édite : c'est **lui** qui remplit `DiagnosticContext`, et c'est la raison pour laquelle `core` ne
cherche pas cet `id`. Aucun composant, aucun Port et aucune table de traduction ne sont anticipés
ici.

### Pour C9 et la donnée absente

**C9 n'a rien à faire dans ce lot, et c'est le résultat qui compte.** Aucune forme persistée ne
change, donc aucune estampille n'est justifiée. Un modèle écrit avant C1 traverse la même chaîne
qu'après C7, et un test le rejoue de bout en bout.

`AGENTS.md` §1.2 est explicite : une migration qui n'estampille rien n'est pas une migration
fantôme. La réciproque l'est aussi — **une API qui n'est pas persistée n'ouvre pas droit à une
estampille**. Ajouter une entrée `8 → 9` ici aurait rendu illisibles tous les documents écrits par
ce build pour n'importe quel build antérieur, sans qu'aucune forme stockée ait bougé.

### Ce que le lot a corrigé dans les tests existants

Deux tests pré-existants assertaient le **nombre total** de valeurs exportées, `126` — l'un dans
`presentation/__tests__/presentation.test.ts`, l'autre dans `style/__tests__/style.test.ts`, la même
vérité épinglée deux fois. Le plan de ce lot l'interdit à C8 (« ni nombre total d'exports »), et ces
deux assertions cassaient à chaque lot pour une raison **sans rapport avec leur contrat**.

Elles sont converties en contrôles **par membre**, ce qui est à la fois moins fragile et **plus
fort** : un total ne voit pas un **renommage**, qui est la panne réelle pour un intégrateur, alors
qu'une liste de noms le voit. Ce que le total voyait et que la liste ne voit plus est un export
**supplémentaire** non intentionnel — or les commentaires de ces deux tests décrivent l'autre risque,
« *un symbole oublié dans `index.ts` compile et part manquant* », que les listes couvrent
intégralement. Le compte de 133 est mesuré dans cette ADR, pas asserté dans un test.

---

## Ce qui reste ouvert

**La donnée absente, et elle est laissée ouverte exprès.** La roadmap parlait de « pointer un champ
disparu ». Cela ne peut pas devenir un code `missing-data` dans `core` sans **renverser**
[ADR 0001](0001-expression-language.md) : une condition sur une valeur absente vaut `false`, une
boucle sur une valeur absente produit zéro itération, les opérations scalaires propagent `undefined`,
et `isEmpty(path)` **utilise** légitimement cette absence. Trois assertions de ce lot épinglent ces
comportements pour que la question 2 de l'ADR 0001 reste posée et non préemptée.

**La traduction n'a pas de mécanisme, et n'en aura pas ici.** `source` + `code` suffit à un `switch`
chez l'intégrateur. Un Port d'i18n exigerait un second adaptateur réel, qui n'existe pas.

**Deux codes d'issue du validateur ne sont pas atteignables par un schéma.** `invalid_key` et
`invalid_element` sont aplatis en refus de type par cette version de Zod. Ils restent mappés, parce
que l'union les déclare et que la table est totale sur elle ; leurs deux tests **construisent**
l'issue au lieu de la provoquer, et le disent.

**La conservation d'une phrase de schéma reste une liste fermée.** Une phrase absente de
`SAFE_SCHEMA_MESSAGES` retombe sur une formulation structurée sûre ; la dérive dégrade donc la
précision, jamais la confidentialité.

---

## Ce que l'exécution a corrigé du plan

1. **Le plan attribuait la phrase du refus `keepTogether` à la façade ; elle appartient au schéma.**
   « *This field must be true when present; omit it to allow the block to split.* » ne peut pas être
   dérivée d'une issue : rien n'y dit que la clé est optionnelle, et un `z.literal(true)` **requis**
   absent produit la même issue, où « *omit it* » serait un conseil faux. La phrase est donc écrite
   dans `ast/schemas.ts`, et la façade conserve les phrases écrites par un schéma (D7).

2. **Le plan laissait entendre que le diagnostic reprend la phrase de l'erreur ; c'est vrai d'une
   seule famille.** Deux cas de recette du plan — la profondeur et l'estampille suivante —
   demandent des phrases que `guard.ts` et `migrate.ts` ne portent pas et **ne doivent pas** porter
   (D8). Les familles `template-shape`, `template-migration`, `configuration` et
   `presentation-resolution` ont donc leurs propres tables, `guard.ts` sort inchangé, et
   `migrate.ts` ne change que pour attribuer un `code` — ce que le plan lui-même prescrivait.

3. **Le plan prescrivait un `switch` exhaustif sur les codes d'issue ; un `Record` total est plus
   fort.** Le plan demandait « *le `switch` exhaustif doit être adapté explicitement, jamais couvert
   par un `default` silencieux* ». Une table `Readonly<Record<ZodIssue['code'], …>>` supprime la
   question : il n'y a pas de `default`, la panne est un échec de **compilation**, et aucune branche
   morte ne pèse sur la couverture.

4. **Le plan supposait `LIST_CALLER_SUBJECTS` compatible avec une phrase unique ; il fallait le
   modifier.** La phrase de recette dit « *This block* » pour la boucle **et** pour le corps de
   tableau, là où la table disait « *A loop* » et « *A table body* ». Les deux entrées sont
   alignées, la distinction reste dans `site`, et les trois tests qui asseyaient l'ancienne phrase
   asseyent désormais le `site`.

5. **Le plan ne prévoyait pas que deux tests existants cassent sur un compte d'exports.** Ils
   cassent, et leur correction est décrite ci-dessus. C'est exactement la panne que le §1.3 du plan
   voulait éviter pour C8 — il ne l'avait pas vue **déjà installée** dans le dépôt.

---

## Le protocole des mesures

Toute mesure de cette ADR est rejouable, et voici comment.

| Mesure | Comment |
| :--- | :--- |
| le compte du barrel (126 → 133) | `Object.keys` sur l'import ESM réel de `packages/core/dist/index.js`, après `pnpm run build` |
| les +7 valeurs et +13 types | comparer les deux blocs `export` de `src/index.ts` à leur état d'avant le lot |
| les 112 tests, la couverture | `pnpm run test:coverage`, et le rapport `text` du répertoire `packages/core/src/diagnostics/**` pour le détail |
| les dix phrases distinctes | `npx vitest run packages/core/src/diagnostics/__tests__/recette.test.ts` |
| la totalité du mapping d'issues | retirer une entrée de `VALIDATION_CODE_BY_ISSUE`, jouer `pnpm run type-check`, restaurer |
| la source-compatibilité du constructeur de migration | appeler `new TemplateMigrationError('m', 1, { cause: e })` sans `code`, jouer `pnpm run type-check` |
| les dix cartes du playground | `pnpm --filter @openview/playground dev`, puis compter les cartes de la section « dix cas de recette » |
| la non-fuite | sérialiser les diagnostics sous une `customError` globale qui interpole l'entrée ; le test doit rester muet sur la fausse clé secrète |
| le format stocké inchangé | `git diff` sur `packages/core/src/template/template.ts` et sur `TEMPLATE_MIGRATIONS` : vide |

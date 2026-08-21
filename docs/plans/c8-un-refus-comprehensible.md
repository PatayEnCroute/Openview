# Plan d'implémentation — `@openview/core` lot C8 : un refus compréhensible

> **⛔ PÉRIMÉ — lot livré le 2026-08-21.**
> [ADR 0010 — Un refus compréhensible](../adr/0010-un-refus-comprehensible.md) fait foi, et elle
> **corrige ce plan sur cinq points** nommés à sa section « Ce que l'exécution a corrigé du plan » :
> la phrase de `keepTogether` vit dans le schéma et non dans la façade ; seule la famille
> `expression-evaluation` réutilise la phrase de l'erreur levée ; le mapping des codes d'issue est un
> `Record` total et non un `switch` ; `LIST_CALLER_SUBJECTS` a dû changer ; et deux tests existants
> assertaient déjà le compte d'exports que le §1.3 ci-dessous interdit.
>
> Ce fichier n'est conservé que comme trace du raisonnement d'avant-livraison. **Ne l'utilisez pas
> comme référence de contrat.**
>
> **Baseline post-C7 effectivement relevée au démarrage :** `BASE_SCHEMA_VERSION` = **8**,
> `NEXT_ADR` = **0010**, barrel public à **126** valeurs. Après livraison :
> `CURRENT_SCHEMA_VERSION` toujours **8**, barrel à **133**.
>
> **Date de rédaction :** 2026-08-20 · **Brique :** `@openview/core`, vague 1 · **Jalon atteint :** J1

---

## 0. Le résultat attendu : un diagnostic, pas une chaîne isolée

La [roadmap du contrat](../roadmap/core.md#c8-un-refus-compréhensible) demande de dire quel bloc,
quel champ et quelle correction sont attendus. Les refus actuels ne partagent pas de véhicule :

- une validation de schéma laisse remonter une `ZodError`, dont le `message` global est un dump de
  toutes les issues ;
- une erreur de formule porte déjà un code, un site et un chemin, mais elle ne connaît pas le bloc
  qui contient l'expression ;
- une erreur de forme ou de migration est typée, mais n'emploie pas une structure commune ;
- `resolvePresentation` ne lève rien et rend un motif de refus distinct ;
- une erreur inconnue doit rester inconnue, afin que l'appelant puisse la relancer.

C8 livre donc une façade de **diagnostics structurés**. Un diagnostic associe une phrase anglaise
prête à afficher à des champs stables que l'application hôte peut localiser ou traduire. `core` ne
choisit aucune UI, ne lit aucune locale d'interface et n'introduit aucun Port d'i18n.

| Responsabilité | Propriétaire |
| :--- | :--- |
| Nommer la cause, le site et le chemin | `@openview/core`, C8 |
| Fournir l'id du bloc qui évalue une formule | le consommateur qui possède ce bloc |
| Échapper et disposer les champs dans une interface | application hôte, Designer ou playground |
| Choisir la politique d'une donnée absente dans une liaison | futur `DataBindingStep` |
| Identifier une occurrence matérialisée d'une boucle | moteur, E5 |

---

## 1. Baseline post-C7 et valeurs volontairement symboliques

### 1.1 Relevé obligatoire avant le premier incrément

Une fois C7 clos, relever sans modifier le dépôt :

- `BASE_SCHEMA_VERSION` : valeur alors exportée par `CURRENT_SCHEMA_VERSION` ;
- `NEXT_ADR` : premier numéro libre sous `docs/adr/` ;
- les membres effectifs de `EXPRESSION_ERROR_CODES`, `SHAPE_ERROR_CODES` et
  `PresentationRefusal` ;
- les noms effectivement exportés par le barrel ESM de `@openview/core`.

Ces noms symboliques ne deviennent pas des constantes de production. Ils servent au contrôle de
périmètre et empêchent de copier dans C8 une version, un numéro d'ADR, un compte de tests ou un
compte d'exports observé pendant que C7 est encore en cours.

### 1.2 C8 ne change pas le format stocké

C8 ajoute des types, des codes et des fonctions de diagnostic, mais aucun champ de modèle et aucun
membre d'une union persistée. Par conséquent :

- `CURRENT_SCHEMA_VERSION` reste égal à `BASE_SCHEMA_VERSION` ;
- `TEMPLATE_MIGRATIONS` ne gagne aucune entrée ;
- un modèle écrit avant C1 traverse la même chaîne qu'après C7 ;
- aucune migration d'estampille n'est justifiée par une évolution d'API non persistée.

`template/migrate.ts` peut évoluer pour attribuer un code aux erreurs qu'il lève, mais sa liste de
migrations reste inchangée.

### 1.3 Aucun compte absolu

Les tests comparent des **membres** et des **deltas nommés** : ils n'assertent ni nombre total
d'exports, ni nombre total de tests, ni numéro de ligne. Si C7 ajoute ou retire légitimement un
membre avant sa livraison, C8 repart du tuple livré au lieu de conserver un chiffre périmé.

---

## 2. Contrat public

### D1 — Une union discriminée `OpenviewDiagnostic`

Créer un sous-système `packages/core/src/diagnostics/` qui sépare types purs, transformation et
messages. Le contrat public est conceptuellement :

```ts
export interface DiagnosticContext {
  readonly nodeId?: string | undefined;
  readonly pathPrefix?: readonly (string | number)[] | undefined;
}

export type OpenviewDiagnostic =
  | TemplateValidationDiagnostic
  | TemplateMigrationDiagnostic
  | TemplateShapeDiagnostic
  | ExpressionEvaluationDiagnostic
  | PresentationResolutionDiagnostic
  | ConfigurationDiagnostic;

export function diagnosticsOf(
  error: unknown,
  context?: DiagnosticContext,
): readonly OpenviewDiagnostic[] | undefined;

export function diagnosticOfPresentationRefusal(
  refusal: PresentationRefusal,
  context?: DiagnosticContext,
): OpenviewDiagnostic;
```

Chaque branche porte toujours :

- `source`, discriminant de la famille ;
- `code`, discriminant stable dans la famille ;
- `message`, phrase anglaise actionnable ;
- `path`, tableau copié de segments `string | number` ;
- `nodeId: string | undefined`, fourni par le consommateur et jamais deviné depuis les données.

Les branches ajoutent uniquement leurs détails sûrs :

- formule d'opérande : `site` et `actualType` ;
- formule de borne : `site` et `limit` ;
- forme : `limit: number | undefined` ;
- migration : `fromVersion: number | undefined` ;
- validation, présentation et configuration : aucun champ fourre-tout.

Une propriété dont toutes les branches n'ont pas le sens ne devient pas optionnelle sur une grosse
interface. L'union conserve le narrowing existant entre erreurs d'opérande et de borne.

### D2 — Le contexte enrichit sans lire le modèle ni les données

`DiagnosticContext` ne reçoit que deux faits déjà connus du consommateur :

- `nodeId`, l'id de la déclaration qui évaluait l'expression ;
- `pathPrefix`, le chemin de cette expression dans le modèle.

Pour une `ZodError` issue de `parseTemplate`, le chemin Zod est déjà absolu. Pour une formule, le
diagnostic concatène une copie de `pathPrefix` et une copie de `details.at`. Sans préfixe, le chemin
reste relatif à la racine de l'expression, ce qui préserve les usages autonomes de
`evaluateExpression`.

La façade ne reçoit ni le template brut, ni `RenderRequest.data`, ni une callback qui relirait
l'entrée. Elle ne cherche donc pas un id dans un objet invalide, ne déclenche aucun getter et
n'introduit aucune nouvelle hypothèse sur les Proxy. Le chemin reste l'identité canonique de la
déclaration ; `nodeId` est un libellé pratique, pas une clé globale — les ids ne sont pas garantis
uniques dans tout le document.

### D3 — Une erreur inconnue reste à relancer

`diagnosticsOf(error)` rend `undefined` si `error` n'est ni une `ZodError` reconnue, ni une erreur
typée d'Openview. Il ne rend jamais un diagnostic générique qui avalerait une faute de programmation.
Le patron consommateur est :

```ts
const diagnostics = diagnosticsOf(error, context);
if (diagnostics === undefined) {
  throw error;
}
```

Une erreur Zod peut porter plusieurs issues et rend alors plusieurs diagnostics. C8 ne garde pas
seulement la première, ne fusionne pas deux corrections indépendantes et ne promet aucun ordre
entre issues : les tests les retrouvent par `source`, `code` et `path`, jamais par indice.

### D4 — Anglais par défaut, codes pour la traduction

Le message par défaut est anglais, comme les messages et commentaires TypeScript existants. La
langue d'une `Presentation` décrit le document imprimé, pas l'interface de l'auteur : elle n'est
jamais consultée pour choisir la langue d'un diagnostic.

Une application qui traduit se branche sur `source`, `code`, `site` et les détails structurés. C8
n'introduit ni table de traduction publique, ni registre, ni Port d'i18n. Il ne réserve aucun nom
de champ métier.

### D5 — La localisation ne devient pas une fuite

`nodeId` et `path` sont des champs séparés : ils ne sont jamais interpolés dans `message`. Une UI
les rend comme du texte et les échappe. Aucun diagnostic ne contient :

- la valeur fautive d'une donnée de rendu ;
- un extrait du modèle ou de son contenu textuel ;
- la `cause` originale ;
- une valeur reçue par Zod ;
- une locale, une horloge ou une lecture d'environnement.

Les seules valeurs variables admises dans un message sont des limites de configuration, une
version de schéma, une forme de valeur fermée (`string`, `number`, `list`…) et les choix ou bornes
déclarés par un schéma. Cette règle prolonge la garantie de l'ADR 0003 : la charge reste sûre à
journaliser même quand les données ne le sont pas.

---

## 3. Catalogues et transformation

### D6 — Six familles publiques, sans code global ambigu

Les discriminants `source` sont :

- `template-validation` ;
- `template-migration` ;
- `template-shape` ;
- `expression-evaluation` ;
- `presentation-resolution` ;
- `configuration`.

`code` n'est unique qu'à l'intérieur de sa famille. `source + code` est la clé stable de
traduction ; concaténer ces deux champs dans une seconde constante créerait un catalogue rival.

### D7 — Le vocabulaire stable des validations Zod

Ajouter le tuple `TEMPLATE_VALIDATION_CODES` et en dériver `TemplateValidationCode` :

```ts
export const TEMPLATE_VALIDATION_CODES = [
  'invalid-type',
  'invalid-value',
  'invalid-format',
  'out-of-range',
  'invalid-structure',
  'invalid-relation',
] as const;
```

Le mapping depuis Zod est total sur les codes de Zod 4 :

| Issue Zod | Code C8 | Formulation |
| :--- | :--- | :--- |
| `invalid_type` | `invalid-type` | nommer le type attendu ; `NaN` et les infinis deviennent « finite number » |
| `invalid_value` | `invalid-value` | énumérer les valeurs déclarées par le schéma, jamais la valeur reçue |
| `invalid_format` | `invalid-format` | conserver la raison de format écrite par le schéma |
| `too_small`, `too_big`, `not_multiple_of` | `out-of-range` | conserver la borne et son unité déclarées |
| `invalid_union`, `invalid_key`, `invalid_element`, `unrecognized_keys` | `invalid-structure` | demander une forme prise en charge sans répéter l'entrée |
| `custom` | `invalid-relation` | conserver le message de relation locale ou croisée |

Les messages explicites des schémas existants restent la source pour les bornes et relations :
colonne orpheline, marges incompatibles, style vide, bornes fractionnaires inversées. Les messages
génériques « Invalid input » / « Invalid option » sont remplacés par la formulation ci-dessus.

Les chemins Zod sont copiés. Les schémas de modèle n'emploient que des segments chaîne ou nombre ;
le transformateur refuse d'inventer un cast pour un segment d'un autre type et le traite comme une
structure invalide sans exposer sa valeur.

### D8 — Chaque migration nomme sa cause

Ajouter `TEMPLATE_MIGRATION_ERROR_CODES` et `TemplateMigrationErrorCode` :

```ts
export const TEMPLATE_MIGRATION_ERROR_CODES = [
  'invalid-template',
  'missing-schema-version',
  'newer-schema-version',
  'missing-migration',
  'invalid-migration-result',
] as const;
```

`TemplateMigrationError` gagne un `code` requis sur l'instance. Son troisième paramètre reste
source-compatible avec `ErrorOptions` en acceptant une extension `code?: ... | undefined` ; le
constructeur emploie `invalid-migration-result` pour une instance construite sans code, tandis que
tous les sites internes passent leur cause exacte.

| Site | Code |
| :--- | :--- |
| entrée non objet | `invalid-template` |
| `schemaVersion` absent, non numérique ou invalide dans l'entrée stockée | `missing-schema-version` |
| version supérieure à la version courante | `newer-schema-version` |
| aucune étape depuis la version lue | `missing-migration` |
| sortie sans version exploitable ou étape qui n'avance pas | `invalid-migration-result` |

Une exception arbitraire levée par une fonction de migration n'est pas reclassée : elle reste une
erreur inconnue et traverse la façade.

### D9 — Le tuple de présentation devient réel

Remplacer l'union écrite à la main par :

```ts
export const PRESENTATION_REFUSALS = [
  'unknown-writing',
  'invalid-writing',
  'unhonoured-locale',
] as const;

export type PresentationRefusal = (typeof PRESENTATION_REFUSALS)[number];
```

`diagnosticOfPresentationRefusal()` fournit un message distinct pour les trois causes. Il reste une
fonction séparée parce qu'un `PresentationRefusal` est une réponse normale de
`resolvePresentation`, pas une exception à passer à `diagnosticsOf`.

### D10 — Les catalogues existants restent les sources de vérité

`EXPRESSION_ERROR_CODES` et `SHAPE_ERROR_CODES` ne sont ni copiés ni fusionnés dans une nouvelle
liste. Les tests C8 les énumèrent directement : ajouter un membre sans scénario de diagnostic fait
échouer la suite.

Une `ExpressionEvaluationError` produit un diagnostic en conservant :

- son `code` ;
- son `site` ;
- `actualType` pour un code d'opérande ou `limit` pour un code de borne ;
- son message anglais, après audit C8 ;
- le chemin préfixé sans mutation de l'erreur.

Une `TemplateShapeError` conserve son code et sa limite. Les deux classes de configuration sont
reconnues par leur classe et deviennent respectivement `invalid-evaluation-limits` et
`invalid-shape-limits` sous la source `configuration`.

---

## 4. Les dix cas de recette de J1

Le playground remplace ses rapports manuels de refus par les deux fonctions publiques C8 et affiche
exactement dix cartes de recette : cinq validations ou refus de contrat, puis cinq erreurs de
formule. Une carte montre `source`, `code`, `nodeId` lorsqu'il est fourni, `path` et `message`.

### 4.1 Cinq refus hors formule

| Cas | Localisation | Message anglais attendu |
| :--- | :--- | :--- |
| marque C7 écrite avec `false` | bloc marqué, champ `keepTogether` | `This field must be true when present; omit it to allow the block to split.` |
| `field` absent d'un segment `pageField` | id du nœud texte + chemin du segment | `This field must be one of "number" or "count".` |
| largeur de feuille infinie | `page.sheet.width` | `This field must be a finite number.` |
| modèle au-delà de la limite de profondeur | racine du modèle | `This template exceeds the configured nesting limit. Reduce its nesting.` |
| modèle estampillé par la version suivante | racine du modèle | `This template was created by a newer Openview schema version. Upgrade Openview before opening it.` |

Les fixtures emploient `CURRENT_SCHEMA_VERSION` et `CURRENT_SCHEMA_VERSION + 1`, jamais un numéro
post-C7 littéral.

### 4.2 Cinq erreurs de formule

| Cas | Localisation | Message anglais attendu |
| :--- | :--- | :--- |
| division par zéro | opérande droite du bloc de total | `This formula divides by zero. Guard the divisor with an "if" before dividing.` |
| addition d'un texte et d'un nombre | opérande fautif | `This arithmetic formula needs numbers, but the highlighted operand is text.` |
| date civile invalide | opérande de date | `This formula needs a valid date in YYYY-MM-DD form between 0001-01-01 and 9999-12-31.` |
| boucle ou corps de tableau appliqué à un nombre | `each` du bloc | `This block needs a list to repeat, but the selected value is a number.` |
| condition qui produit du texte | `when` du bloc | `This condition must return true or false, but it returns text. Add a comparison or use isEmpty.` |

Ces cinq phrases remplacent les formulations techniques correspondantes dans les sites de levée.
Les autres messages d'expression restent inchangés lorsqu'ils nomment déjà l'attente et la
correction sans exposer de valeur. Tous les codes hors de cette sélection restent couverts par la
matrice exhaustive de tests.

### 4.3 La donnée absente reste hors de C8

La phrase de roadmap « pointer un champ disparu » ne peut pas devenir un code `missing-data` dans
`core` sans renverser l'ADR 0001 :

- une condition sur une valeur absente vaut `false` ;
- une boucle sur une valeur absente produit zéro itération ;
- les opérations scalaires propagent `undefined` ;
- `isEmpty(path)` utilise légitimement cette absence.

La décision « blanc ou échec » d'une liaison textuelle appartient toujours au futur
`DataBindingStep`, seul endroit qui connaît la position finale d'impression. C8 documente cette
dette, mais ne modifie ni `evaluateExpression` ni `ExpressionErrorCode` pour la préempter.

---

## 5. Fichiers de la future implémentation

### 5.1 Production

| Sous-système | Changement |
| :--- | :--- |
| `packages/core/src/diagnostics/` | Nouveaux types, catalogues de validation, messages et adaptateurs. |
| `packages/core/src/errors.ts` | Codes de migration et propriété `TemplateMigrationError.code`, sans changer les autres catalogues. |
| `packages/core/src/template/migrate.ts` | Attribution du code exact à chaque erreur ; migrations inchangées. |
| `packages/core/src/presentation/types.ts` | `PRESENTATION_REFUSALS` et type dérivé. |
| `packages/core/src/index.ts` | Exports publics nommés de C8. |
| `apps/playground/src/App.tsx` | Consommateur réel et dix cartes de recette. |

Le dossier `diagnostics/` suit la règle de modularité : types purs dans `types.ts`, transformation
dans un module d'opérations et façade/barrel claire. Il ne devient pas un second fichier
`errors.ts` contenant les classes de levée.

### 5.2 Tests

Créer un dossier local `packages/core/src/diagnostics/__tests__/` dès le premier fichier de test.
Les tests des messages propres aux sites d'expression restent près de l'évaluateur lorsqu'ils
modifient une fonction existante ; les tests de conversion publique vivent dans le nouveau dossier.

### 5.3 Documentation

À la livraison :

- créer l'ADR C8 avec `NEXT_ADR`, déterminé après la clôture de C7 ;
- compléter l'ADR 0001 sur la donnée absente, sans fermer sa question 2 ;
- compléter l'ADR 0003 : C8 livre la formulation et la façade prévues par sa décision d'erreur ;
- compléter l'ADR 0008 : le tuple `PRESENTATION_REFUSALS` devient effectivement itérable ;
- compléter l'ADR C7 réellement livré, sans présumer ici de son numéro ;
- marquer C8 livré dans `docs/roadmap/core.md` ;
- marquer J1 atteint dans `docs/roadmap/README.md` ;
- marquer ce plan périmé en dernier.

### 5.4 Fichiers explicitement inchangés

- `packages/core/src/template/template.ts` et le contenu de `TEMPLATE_MIGRATIONS` : aucune forme
  persistée ;
- `packages/engine/**`, `packages/designer/**`, `packages/viewer/**` : leurs futurs adaptateurs
  consommeront le contrat sans être anticipés ;
- ports de rendu et de stockage : un diagnostic n'est pas un nouveau Port ;
- `package.json`, `pnpm-workspace.yaml`, les `tsconfig`, Biome, Turbo, Sonar et les workflows :
  aucune dépendance ni modification d'outillage ;
- schémas de données de rendu : il n'en existe pas et C8 n'en crée pas.

---

## 6. Découpage en quatre incréments

### INC-0 — Contrats, tuples et exhaustivité

**Contenu :**

- types de diagnostics et contexte ;
- tuples de validation et migration ;
- tuple réel de présentation ;
- type `PresentationRefusal` dérivé ;
- `TemplateMigrationError.code` et attribution aux sites internes ;
- exports publics ;
- tests d'assignabilité, de membres et de compatibilité du constructeur.

**Critère de sortie :** le build ESM expose exactement les nouveaux noms attendus, sans compte
global ; retirer un membre d'un tuple ou ajouter un code sans entrée de test fait échouer la suite.
Aucun format stocké ne change.

### INC-1 — Adaptateurs, chemins et absence de fuite

**Contenu :**

- `diagnosticsOf` pour Zod et les erreurs typées ;
- `diagnosticOfPresentationRefusal` ;
- mapping total Zod 4 vers les six codes de validation ;
- copie et préfixage des chemins ;
- `undefined` pour les erreurs inconnues ;
- tests de secret, d'immuabilité, d'erreur inconnue et de multiples issues.

**Critère de sortie :** sérialiser un diagnostic d'expression évaluée sur une donnée secrète ne
contient pas cette donnée ; modifier les tableaux retournés ne modifie ni l'erreur ni une lecture
ultérieure.

### INC-2 — Formulation et recette J1

**Contenu :**

- audit de toutes les formulations héritées ;
- cinq reformulations de formule définies en §4.2 ;
- dix cas de recette au playground ;
- tests exacts des dix messages ;
- matrice exhaustive de tous les codes existants.

**Critère de sortie :** les dix fautes rendent dix diagnostics distincts qu'un lecteur peut
corriger à partir de `nodeId`, `path` et `message`, sans voir une valeur de rendu.

### INC-3 — ADR, roadmaps et clôture

**Contenu :**

- ADR C8 sous le prochain numéro disponible ;
- compléments aux ADR amont ;
- mise à jour des roadmaps et du jalon J1 ;
- contrôle de surface, quatre portes et statut périmé du plan.

**Critère de sortie :** le dépôt ne promet plus « un avant-goût de C8 » : le playground consomme
la façade publique, la roadmap décrit ce qui est effectivement livré et les numéros sont ceux de la
baseline post-C7.

---

## 7. Plan de test complet

### 7.1 Exhaustivité des catalogues

- un `Readonly<Record<TemplateValidationCode, ...>>` couvre le tuple de validation ;
- un `Readonly<Record<TemplateMigrationErrorCode, ...>>` couvre le tuple de migration ;
- chaque `PresentationRefusal` produit une source, un code et un message distincts ;
- chaque `EXPRESSION_ERROR_CODES` possède un scénario de diagnostic ;
- chaque `SHAPE_ERROR_CODES` produit sa limite correcte ou `undefined` ;
- les comparaisons portent sur les membres triés, jamais sur une longueur observée pendant C7.

### 7.2 Zod

Couvrir au minimum :

- type absent ou faux ;
- choix invalide ;
- `NaN`, `Infinity` et `-Infinity` attendus comme nombres finis ;
- borne minimale et maximale ;
- format de chaîne ;
- discriminant inconnu ;
- relation `superRefine` ;
- deux issues indépendantes sur deux chemins ;
- chemin copié et non mutable ;
- absence de la valeur reçue dans le diagnostic sérialisé.

### 7.3 Migration, forme et configuration

- entrée non objet ;
- version absente ou non numérique ;
- version `CURRENT_SCHEMA_VERSION + 1` ;
- étape absente ;
- étape qui ne progresse pas ou perd l'estampille ;
- profondeur, nombre de valeurs et donnée non simple ;
- limites d'évaluation et de forme invalides ;
- exception arbitraire d'une migration rendue `undefined` par la façade puis relancée par le
  patron consommateur.

### 7.4 Expressions

- les cinq cas exacts de §4.2 avec `nodeId` et `pathPrefix` ;
- une branche d'opérande conserve `actualType` et n'expose pas la valeur ;
- une branche de borne conserve `limit` et ne possède pas `actualType` ;
- le chemin final vaut `pathPrefix + details.at` dans l'ordre racine vers feuille ;
- deux lectures de la même erreur rendent des tableaux égaux mais distincts ;
- les codes non choisis pour la recette restent tous atteignables.

### 7.5 Présentation

- écriture inconnue ;
- écriture invalide ;
- locale non honorée ;
- trois codes et trois messages distincts ;
- la locale déclarée n'influence jamais la langue du diagnostic.

### 7.6 Recette et compatibilité

- les dix cartes du playground passent par le barrel public ;
- le playground n'inspecte plus manuellement `ZodError.issues` ou
  `ExpressionEvaluationError.details` pour construire son propre contrat ;
- un document antérieur à C1 traverse toujours la chaîne post-C7 ;
- les fixtures C8 emploient `CURRENT_SCHEMA_VERSION`, jamais sa valeur numérique ;
- aucune nouvelle entrée de migration n'apparaît.

### 7.7 Quatre portes

À chaque incrément publiable :

```bash
pnpm run lint && pnpm run build && pnpm run type-check && pnpm run test:coverage
```

Couverture supérieure ou égale à 90 % sans exclusion, seuil ou configuration modifiés.

---

## 8. Définition de fini

- C7 est clos et toutes les références numériques de C8 proviennent de sa baseline livrée.
- `OpenviewDiagnostic` couvre validation, migration, forme, expression, présentation et
  configuration par une union discriminée.
- Une erreur inconnue n'est jamais transformée en refus utilisateur.
- Les dix cas de roadmap produisent dix diagnostics, dont cinq erreurs de formule.
- Chaque diagnostic désigne le champ par un chemin et peut recevoir l'id du bloc sans l'inclure
  dans son message.
- Tous les catalogues fermés sont énumérés depuis leur source de vérité.
- Aucun message ou payload ne contient une valeur de rendu, un extrait de contenu ou une lecture
  d'environnement.
- Les messages par défaut sont anglais ; aucun Port d'i18n et aucune lecture de la locale du modèle
  ne sont ajoutés.
- La politique de donnée absente reste explicitement au futur `DataBindingStep`.
- `CURRENT_SCHEMA_VERSION` et la liste des migrations restent ceux de C7.
- Aucun fichier d'outillage, dépendance ou paquet aval n'est modifié.
- Le playground démontre J1 par la façade publique plutôt que par un rapport local.
- L'ADR C8 emploie le premier numéro réellement disponible et ce plan est marqué périmé en dernier.

---

## 9. Hypothèses et limites

- C7 livre bien une marque positive `keepTogether` ou une capacité sémantiquement équivalente. Si
  son nom change avant livraison, seul le premier cas de recette et son chemin suivent le contrat
  livré ; aucun numéro ni compte de C8 n'en dépend.
- C8 localise une **déclaration**, pas une occurrence de rendu. Sous une boucle, `nodeId` et `path`
  désignent le nœud du modèle ; E5 reste propriétaire de l'identité d'occurrence.
- Les ids de nœuds ne sont pas globalement uniques. Le chemin est la localisation canonique et
  l'id un libellé fourni par le consommateur.
- Les auteurs du modèle peuvent être non développeurs, mais l'application intégratrice reste
  responsable de l'échappement et de la traduction des champs structurés.
- Un changement futur de Zod peut ajouter un code d'issue : le `switch` exhaustif doit alors être
  adapté explicitement, jamais couvert par un `default` silencieux.
- La façade diagnostique les contrats de `core`. Les erreurs de téléchargement, de DOM, de
  pagination, de police ou de rendu appartiendront aux lots moteur et à leurs propres enveloppes.

---

## 10. Contrôle de périmètre avant exécution

Avant INC-0 :

1. vérifier que C7 est livré et ne plus prendre ses modifications de travail comme baseline ;
2. relever `BASE_SCHEMA_VERSION`, `NEXT_ADR`, les tuples et les exports réels ;
3. vérifier qu'aucun sous-système de diagnostics équivalent n'a été ajouté entre-temps ;
4. conserver tous les changements utilisateur sans rapport et ne jamais réinitialiser la branche ;
5. vérifier que C8 n'ajoute aucun champ de modèle, code `missing-data`, Port d'i18n ou schéma du jeu
   de données ;
6. arrêter l'exécution si un ADR concurrent prend `NEXT_ADR`, puis recalculer le prochain numéro
   libre sans modifier le fond du plan.

Ce contrôle rend les nombres tardifs sans rendre les décisions tardives : le contrat de C8 est
fermé, seuls les identifiants séquentiels appartenant à C7 ou à l'historique du dépôt restent
calculés au moment où ils deviennent vrais.

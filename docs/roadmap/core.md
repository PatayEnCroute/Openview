# Roadmap — `@openview/core` (le contrat)

> **Rôle produit :** définir ce qu'un modèle de document *sait dire*. Tout ce que
> le contrat ne sait pas exprimer est impossible à rendre et impossible à éditer :
> cette brique est le plafond de verre des quatre autres.
>
> Les critères de recette de cette brique sont énoncés sur des factures. La facture
> est le **document de référence** du projet, c'est-à-dire le niveau d'exigence à
> atteindre, pas le périmètre : elle concentre les contraintes les plus dures, et
> une brique qui les tient rend les autres éditions accessibles sans lot
> supplémentaire.
>
> Retour à la [vue d'ensemble](README.md).

---

## Où on en est

C'est la seule brique déjà entamée, et ses fondations sont bonnes : un modèle sait
décrire du texte mêlant du fixe et des données, des images, des regroupements, des
**répétitions** (une ligne par article) et des **conditions** (afficher ce bloc
seulement si…). Un modèle porte un numéro de version et sait être converti d'une
version à l'autre — la promesse « un modèle enregistré aujourd'hui s'ouvre encore
dans dix ans » est déjà outillée.

**Ce qui manque pour une facture est plus important que ce qui existe.** Un modèle
sait aujourd'hui *comparer* deux valeurs ; il ne sait pas **calculer**. Il ne sait pas
non plus décrire une **page** (format, marges, en-tête répété), un **tableau** à
colonnes, ni la moindre **apparence** — pas une police, pas un filet, pas une couleur.
Ces quatre manques sont le contenu de la vague 1.

> ✅ **Vague 1 close le 2026-08-21**, **C10 livré le 2026-08-26**, et **C11 livré le
> 2026-08-26** — le contrat sait confronter un modèle au **catalogue déclaré par
> l'application hôte**, décrire une **grille** de mise en page (colonnes égales, pas
> vertical déclaré, zones avec spans) et des **calques de page** (fond de papier,
> filigrane, cachet) répétés sur toutes les pages. **La vague 2 est close.**
>
> ⚠️ **C10 et C11 ont été livrés sans que J3 soit atteint** — E4 et la relecture par un
> gestionnaire restent dus. Les écarts et leurs contreparties sont nommés en tête des
> [ADR 0015](../adr/0015-le-catalogue-de-donnees-de-l-integrateur.md) et
> [ADR 0016](../adr/0016-grille-colonnes-et-calques.md).

---

## Règle d'arbitrage : la capacité est à nous, la responsabilité est à l'intégrateur

> **Openview calcule ce qu'on lui demande. Il ne décide d'aucune règle fiscale ou
> légale, et ne garantit aucune conformité.** L'exactitude des montants relève de
> l'application intégratrice et de l'auteur du modèle.

La frontière ne porte donc **pas** sur la puissance de l'outil — formules et
agrégations sont pleinement dans le périmètre — mais sur qui répond des chiffres.

| Sujet | Position |
| :--- | :--- |
| Additionner, multiplier, agréger des lignes, poser une condition, calculer une échéance | **Openview le fait**, sur demande du modèle |
| Le **taux** de TVA applicable, la règle d'exigibilité, le régime d'exonération, les mentions obligatoires | **Jamais Openview.** Ce sont des données ou des choix de l'intégrateur |
| **Comment** un montant s'arrondit | **Le modèle le déclare** (lot C2) — la décision reste celle de son auteur |
| Le **report de page** (« report : 12 480,00 € ») | **Le [moteur](engine.md)** : seul lui sait où il coupe |
| La **conformité** du document produit — facture, relevé, contrat ou tout autre | **L'intégrateur.** Énoncé sans détour dans le README et la documentation |

**Comment cette limite est tenue :** par une **clause explicite** dans le README et la
documentation. C'est la seule mesure retenue.

> **Recommandation non retenue, notée ici pour mémoire :** interdire tout nom de
> fonction à consonance fiscale (`tva()`, `taxe()`, `arrondiLegal()`). Une fonction
> ainsi nommée déplace la responsabilité chez nous par sa seule existence, quoi qu'en
> dise la documentation. La mesure était quasi gratuite ; elle reste disponible si la
> question se pose. Voir le risque correspondant en
> [§6 de la vue d'ensemble](README.md#6-risques-assumés).

---

## Deux vagues, et pourquoi

L'ordre retenu est « brique par brique ». Une nuance s'impose pourtant ici :
une partie du contrat ne sert **qu'à l'éditeur** (la grille, les calques, le
catalogue de données). La décrire avant d'avoir vu une seule page sortir, c'est
concevoir à l'aveugle, puis la refaire.

> **Proposition :** la **vague 1** est terminée avant d'ouvrir le moteur ; la
> **vague 2** attend que la facture comptable soit sortie (J3), parce qu'à ce
> moment-là on saura ce que l'éditeur doit réellement produire.

---

## Vague 1 — de quoi décrire une facture (avant le moteur)

### C1. Formules et agrégations

**Pourquoi.** C'est ce qui rend un modèle autonome : il calcule au lieu de réclamer à
l'application hôte une donnée toute prête pour chaque case. Périmètre retenu, en
quatre familles :

| Famille | Contenu |
| :--- | :--- |
| **Nombres** | Les quatre opérations, les parenthèses, les pourcentages |
| **Agrégations** | Somme, compte, moyenne, minimum, maximum sur les lignes d'un tableau |
| **Conditions** | « si… alors… sinon » à l'intérieur d'une formule, et non seulement autour d'un bloc |
| **Textes et dates** | Coller deux champs, mettre en majuscules ; échéance = date de facture + 30 jours ; **nombre de jours entre deux dates fournies** (par exemple entre l'échéance et la date de traitement transmise par l'application hôte) |

**Prêt quand** une facture calcule elle-même son total de lignes, son montant de
remise, son reste à payer et sa date d'échéance, à partir de données brutes — et
qu'une formule fautive est refusée avec un message qui désigne l'erreur.

**Poids :** L — **Dépend de :** rien — *c'est le lot le plus lourd du contrat*

**Ce que ce lot n'est pas :**

- une **règle fiscale** : aucun taux, aucun régime, aucun arrondi « légal » n'est connu d'Openview ;
- des **fonctions définies par l'utilisateur** (macros, bibliothèque de formules réutilisables) ;
- des **références croisées** entre modèles, ou vers une valeur d'une autre page — le report de page est traité par le [moteur](engine.md) ;
- une **traçabilité** du calcul (« d'où vient ce montant ? »). Écartée du v1 ; c'est pourtant la meilleure défense le jour où un chiffre sera contesté, à rouvrir si cela arrive ;
- une **lecture de l'environnement** : ni horloge, ni fuseau, ni locale système, ni aucune source extérieure. Le jeu de données fourni est la seule entrée. « Aujourd'hui » est une donnée comme une autre, nommée par l'intégrateur ; c'est ce qui rend le déterminisme du lot E6 du [moteur](engine.md) possible.

> Le langage d'expressions actuel et ses limites sont consignés dans
> [ADR 0001](../adr/0001-expression-language.md). Ce lot l'élargit franchement :
> l'ADR devait être amendé dans le même mouvement, sinon la décision écrite et le code
> divergeaient dès le premier lot. ✅ **Fait le 2026-08-13** — l'ADR 0001 porte sa ligne
> « Amendé par », et l'[ADR 0003](../adr/0003-formules-agregations-et-dates-civiles.md)
> énonce les dix décisions du lot : l'algèbre passe à 18 kinds, l'arithmétique est en
> IEEE-754 sans arrondi implicite, les dates sont bornées à la « date civile pure », et
> le versionnement du schéma passe à 2 avec sa migration.
>
> Le *comment* de ce lot — découpage en incréments, contrat définitif, plan de
> test, arbitrages tranchés — vit dans
> [docs/plans/c1-formules-et-agregations.md](../plans/c1-formules-et-agregations.md).

### C2. Les arrondis, déclarés par le modèle

**Pourquoi.** C'est le point exact où naît le fameux « écart d'un centime », et la
décision retenue est cohérente avec la limite de responsabilité : **chaque montant
calculé déclare comment il s'arrondit** (précision, sens de l'arrondi). Openview
n'impose aucune règle par défaut qui pourrait être tenue pour une position fiscale.

**Prêt quand** deux modèles arrondissant différemment produisent deux résultats
différents et prévisibles sur le même jeu de données, et qu'aucun total ne diffère de
la somme des montants affichés au-dessus de lui.

**Poids :** S — **Dépend de :** C1 — *jamais reporté : des arrondis ajoutés après coup
faussent tous les modèles déjà écrits*

> ✅ **Livré le 2026-08-15.** Le kind `round` porte trois champs requis — `value`, un
> `decimals` **littéral** dans `[-15, 15]`, et un `mode` parmi `halfExpand` et `halfEven` —
> et **la position du nœud dans l'arbre EST la déclaration**. Le critère de recette est
> démontré sur un même jeu de cinq lignes : trois modèles légitimes rendent **63,26**,
> **63,24** et **63,25**, et les deux causes de l'écart sont distinctes — le *mode* pour les
> deux premiers, la *position* de la déclaration pour le troisième. `aggregate.ts` n'a pas
> changé d'une ligne : « aucun total ne diffère de la somme des montants affichés au-dessus
> de lui » est une propriété du **modèle**, obtenue en enveloppant aux deux niveaux, et
> Openview ne l'impose pas. Zéro code d'erreur nouveau, zéro plafond nouveau ;
> `CURRENT_SCHEMA_VERSION` passe à **3** avec sa migration d'estampille.
>
> Les douze décisions du lot vivent dans
> [ADR 0004](../adr/0004-les-arrondis-declares-par-le-modele.md), qui complète l'ADR 0003 et
> amende `AGENTS.md` §3.B sur la portée du Visitor obligatoire. Le *comment* — découpage en
> incréments, contrat définitif, plan de test — vit dans
> [docs/plans/c2-arrondis-declares-par-le-modele.md](../plans/c2-arrondis-declares-par-le-modele.md),
> périmé depuis la livraison comme le dit son propre en-tête.

### C3. Le tableau de lignes

**Pourquoi.** La répétition existe, la notion de **tableau** non : des colonnes,
une largeur par colonne, un en-tête de colonnes, un alignement par colonne
(libellés à gauche, montants à droite). C'est le cœur visuel d'une facture, et le
support des agrégations du lot C1.

**Prêt quand** un tableau à cinq colonnes typé (désignation, quantité, prix
unitaire, remise, montant) est décrit dans un modèle, en-tête compris, et que sa
dernière ligne peut être une somme de ce qui précède.

**Poids :** M — **Dépend de :** C1

> ✅ **Livré.** Les treize décisions du lot — les trois types de nœud, la coupure
> `BlockNode`, l'appariement de cellule **par clé**, l'en-tête comme section de
> lignes, le poids entier borné, l'alignement `start | center | end`, le refus
> structurel de l'auto-somme et l'estampille `schemaVersion` 4 — vivent dans
> [ADR 0005](../adr/0005-le-tableau-de-lignes.md), qui fait foi. Le mot « typé » du
> critère ci-dessus se lit « **décrit dans un contrat typé** » : les cinq colonnes
> sont un **jeu d'épreuve**, et aucune ne porte de type de donnée (arbitrage n° 1,
> tranché le 2026-08-17). Le *comment* — découpage en incréments, contrat définitif,
> plan de test — vit dans
> [docs/plans/c3-tableau-de-lignes.md](../plans/c3-tableau-de-lignes.md), périmé
> depuis la livraison comme le dit son propre en-tête.

### C4. La page

**Pourquoi.** Rien ne décrit aujourd'hui la feuille : format, orientation, marges,
en-tête et pied de page répétés, numérotation. Or l'exigence retenue est
**multi-pages comptable** : sans ces notions, le moteur n'a rien à respecter.

**Prêt quand** un modèle impose son format et ses marges, déclare ce qui se répète
en haut et en bas de chaque page, et ce qui n'apparaît que sur la dernière.

**Poids :** M — **Dépend de :** rien

> ✅ **Livré.** Les treize décisions du lot — la feuille en **deux longueurs
> fractionnaires en millimètres** (sans nom de format ni champ `orientation`), les
> quatre marges et leur invariant croisé, `printableAreaOf` exportée pour que la
> soustraction s'écrive **une** fois, deux listes de bandes à **cinq** occurrences
> régies par une table de compatibilité déclarée, le **marqueur** `pageField` qui
> place un numéro sans jamais le calculer, `collectTemplateDataPaths`, et
> l'estampille `schemaVersion` **5** avec la **première migration transformante**
> du dépôt — vivent dans [ADR 0006](../adr/0006-la-page.md), qui fait foi.
>
> Le lot livre **plus** que ce critère n'exige, et il faut le dire pour que le
> prochain lecteur ne croie pas le critère incomplet : la **numérotation** (nommée
> dans le *pourquoi* ci-dessus mais absente du « prêt quand », arbitrage n° 1) et
> les **variantes de première page** `firstOnly` / `exceptFirst` (arbitrage n° 6,
> tranché le 2026-08-18 contre la recommandation du plan, parce que le total
> reporté de E3 est un montant entrant qui n'existe pas en page 1).
>
> Ce qu'il ne livre **pas** : aucun document ne sort sur deux pages après C4 — il
> n'existe pas de moteur. Le *comment* — découpage en incréments, contrat définitif,
> plan de test — vit dans [docs/plans/c4-la-page.md](../plans/c4-la-page.md), périmé
> depuis la livraison comme le dit son propre en-tête.

### C5. L'apparence

**Pourquoi.** Un document sans police, sans couleur et sans filet ne convaincra
personne, quelle que soit la justesse des chiffres. Périmètre volontairement
resserré : polices et tailles, graisse et italique, couleurs de texte et de fond,
bordures et filets, alignements, espacements.

**Prêt quand** deux factures visuellement très différentes sont décrites sans
changer une seule donnée.

**Poids :** L — **Dépend de :** C3

> ✅ **Livré.** Les dix-huit décisions du lot — **deux** formes stockées et non un
> objet `style` unique (`BoxStyle` : un fond, quatre arêtes optionnelles, un inset
> de quatre arêtes requises ; `Typography` : une famille, une taille **en points**,
> gras, italique, une couleur), **neuf** sites d'accrochage, le tuple
> `TEXT_ALIGNMENTS` **dérivé par étalement** de celui des colonnes pour que
> `justify` entre sur le texte **sans** entrer sur une colonne, la conversion
> `mmFromPt` / `ptFromMm` écrite **une** fois, les deux résolutions à **deux**
> termes, la forme canonique d'un style absent qui est **l'absence**, le **modèle de
> boîte** écrit en quatre phrases (tableau et ligne compris), et l'estampille
> `schemaVersion` **6** par **estampille seule** — vivent dans
> [ADR 0007](../adr/0007-l-apparence.md), qui fait foi.
>
> Le critère est démontré dans la vitrine : **une seule fonction**,
> `factureAvecApparence`, appelée avec deux apparences, rend deux factures très
> différentes sur le **même** jeu de données, et `collectTemplateDataPaths` rend les
> **mêmes huit chemins** pour les deux. Paramétrer le modèle plutôt que d'écrire deux
> littéraux est ce qui rend cette égalité un **résultat** et non une coïncidence.
>
> Le lot livre **moins** que son nom ne le suggère, et il faut le dire : **zéro
> invariant croisé** là où C4 en portait deux, parce qu'un contrat dont chaque champ
> est facultatif n'a presque rien à refuser. Et il livre **plus** que le critère
> n'exige : deux champs suffiraient à le satisfaire littéralement, donc c'est
> l'énumération du *pourquoi* ci-dessus — dix attributs en six groupes — qui porte la
> charge de justification des neuf déclarations de champ, jamais le « prêt quand ».
>
> Ce qu'il ne livre **pas** : aucun pixel. Les **huit attentes envers le moteur** que
> le lot crée — le comportement d'une boîte au **point de coupe**, la résolution d'un
> nom de police, les cinq valeurs typographiques absentes, l'espace colorimétrique,
> la conversion pt → unité de rendu, la **rencontre de deux filets adjacents**, les
> deux conventions de justification, et la place d'une image sans dimension — sont
> nommées dans l'ADR **avec leur propriétaire**, et vérifiables au lot E2, pas avant.
> Le *comment* vit dans
> [docs/plans/c5-l-apparence.md](../plans/c5-l-apparence.md), périmé depuis la
> livraison comme le dit son propre en-tête.

### C6. Langue, devise et formats

**Pourquoi.** Décision structurante prise tôt : un même modèle doit produire une
facture en français/euros et en anglais/dollars. Cela concerne les montants, les
dates, les séparateurs de milliers, la position du symbole monétaire, et les libellés
fixes du modèle.

**Prêt quand** un unique modèle de facture **DÉCLARE** deux écritures — langue,
devise, bornes de décimales, forme de date —, qu'un appelant en sélectionne une **par
un argument**, que les trois fonctions de formatage rendent deux chaînes différentes
**portant les mêmes chiffres**, et que les données requises du modèle soient les
**mêmes** dans les deux cas.

⛔ **Ce critère a été SCINDÉ le 2026-08-20, et l'énoncé précédent est conservé ici
parce qu'il expliquait pourquoi.** Il disait : « *un unique modèle de facture produit
deux documents corrects dans deux langues et deux devises, sans duplication du
modèle* » — et il était **mot pour mot** celui du lot moteur
[E4](engine.md#e4-langue-et-devise-au-rendu), alors que `core` **ne rend rien**. Aucun
contrat de `core` ne pouvait donc le satisfaire. La coupe est celle que
[ADR 0008](../adr/0008-langue-devise-et-formats.md) argumente : **`core` déclare, E4
produit.** Ce qui reste à E4 est inchangé — la facture qui *sort*, dans les deux
écritures, avec les sites correctement choisis.

**Poids :** L annoncé — **XL réel**, et l'écart est acté plutôt que corrigé : le
rectifier rouvrirait l'ordonnancement de la vague. — **Dépend de :** C2, C5

> **Attention, ce lot ne fait pas de conversion.** Afficher « $ » n'est pas convertir
> des euros en dollars : un taux de change est une donnée, et son choix appartient à
> l'intégrateur — même règle que la TVA.

> ✅ **Livré le 2026-08-20.** Une écriture porte cinq champs **tous requis** — une
> locale, une devise, **deux** bornes de fraction et une forme de date —, et un
> `Template` en déclare une **table** dont les clés appartiennent à l'auteur du modèle.
> L'appelant sélectionne **par un argument** ; ni `RenderRequest`, ni une clé de la
> donnée, ni la machine n'y participent. **Estampille 7.**
>
> **La décision structurante est que la locale est jugée DEUX fois**, et le critère de la
> coupure est écrit une fois pour toutes : *un champ stocké ne peut être jugé que par un
> verdict identique sur toute machine.* La grammaire au **parse** (0 divergence sur
> 31 933 tags entre deux ICU), l'honorat au **rendu** (527 tags contre 525, `en-FR`
> parmi les deux qui bougent). Un tag bien formé mais inconnu **se stocke** et se
> refuse au rendu, en **nommant sa cause** — sans quoi le même document s'ouvrirait sur
> une machine et pas sur une autre, sur une faute appartenant à l'ICU du lecteur.
>
> **La moitié « libellés fixes » du Pourquoi était déjà livrée par C1**, et il faut le
> dire : un `if` lisant une donnée imprime `Facture` ou `Invoice`, et il **réordonne**,
> ce qu'une table de traductions ne sait pas faire. Ce lot porte les **quatre autres**
> items, tous l'écriture d'une **valeur**, et n'ajoute aucun mécanisme de libellé.
>
> **Ce que le lot ne referme PAS, nommé plutôt qu'enterré :** il livre un **verbe** et
> jamais la liste des **sites**. Rien dans un document stocké ne distingue un numéro de
> commande d'un total, et reconnaître un total exigerait de réserver un nom de champ —
> `20260014` s'imprimerait `20 260 014`, qui désigne une autre commande. C'est
> l'attente **E4-1**, l'une des **onze** que l'ADR 0008 nomme avec leur propriétaire.
>
> ✅ **E4-1 est tranchée le 2026-08-27** ([ADR 0017](../adr/0017-langue-et-devise-au-rendu.md)) :
> un site stocke `{ kind, profile }` — la fonction, et un profil logique que l'auteur du
> modèle possède — et l'appelant associe les profils aux clés de cette table **à la
> construction du port**. Le champ de segment que ce lot avait différé est donc ouvert,
> sous **estampille 11**, sur les bindings et sur les deux marqueurs de page. Un site qui
> ne déclare rien garde exactement sa forme canonique, ce qui est ce qui laisse
> `20260014` lisible.
>
> Zéro code d'erreur nouveau, zéro champ sur aucun nœud, aucun `switch` neuf ; le barrel
> public passe de **117** à **126** valeurs, mesuré par émission ESM réelle.

### C7. Les blocs insécables

**Pourquoi.** Exigence comptable : un bloc de mentions légales, un cadre de
totaux, une adresse ne se coupent pas en deux entre deux pages **dès lors qu'ils
peuvent tenir sur une page**. Le contrat doit permettre de le dire ; le moteur
devra l'honorer.

**Prêt quand** un modèle marque un bloc comme insécable et **laisse un autre sans
contrainte de fragmentation**, et que la distinction est lisible par le moteur
**sans heuristique**.

⛔ **L'énoncé précédent disait « et un autre comme sécable », et il demandait une
forme que ce lot refuse.** Aucun marquage « sécable » n'existe, et il n'en existera
pas : il faudrait un booléen, donc **deux écritures persistées pour le même sens**
— clé absente, et `false` — qu'aucun lecteur ne pourrait départager. L'absence de
la clé *permet* la coupe, elle ne la *commande* jamais.

**Poids :** S — **Dépend de :** C4

> ✅ **Livré le 2026-08-20.** Un champ optionnel, `keepTogether?: true`, sur la
> **base commune** des huit nœuds — donc huit sites, **zéro type nouveau, zéro
> export nouveau, zéro `switch`, zéro code d'erreur**. **Estampille 8**, migration
> d'estampille seule. Le barrel public reste à **126** valeurs.
> [ADR 0009](../adr/0009-les-blocs-insecables.md) fait foi.
>
> **Ce que le lot ne promet PAS, et c'est la moitié de la décision :** un bloc plus
> grand que toute page neuve **n'est pas** gardé entier. Le moteur essaie la page
> courante, puis une page neuve admissible, puis **applique le repli ordinaire de son
> kind** — un contenu fragmentable est coupé de façon déterministe, une ressource
> atomique garde la politique d'E1/E2. Sans cette troisième branche, `keepTogether`
> ajouterait un mode d'échec nouveau, ou un paginateur reportant éternellement le
> même bloc.
>
> **La sémantique est par occurrence matérialisée** : une boucle marquée ne rassemble
> pas ses soixante itérations en un bloc géant, elle en garde **chacune** entière.
> « Toute la séquence » reste exprimable en plaçant la boucle dans un conteneur
> marqué — d'où l'absence de second champ. Et une marque **imbriquée** survit au repli
> de son parent : un tableau trop grand se coupe entre ses lignes, mais la ligne de
> total marquée reste entière.
>
> **Ce que le lot laisse à l'aval, nommé plutôt qu'enterré :** l'**identité
> d'occurrence** n'est pas figée — `(id, rang local)` ne suffit pas sous des boucles
> imbriquées et les `id` ne sont pas globalement uniques, c'est à **E5** de la
> choisir. Le voisinage (`keepWithNext`), les veuves, les orphelines et le saut de
> page sont **refusés par écrit** : un champ de relation coûtera un lot `core` et une
> version.

### C8. Un refus compréhensible

**Pourquoi.** L'intégrateur et, plus tard, l'utilisateur final verront ces
messages. « Modèle invalide » n'aide personne : il faut dire *quel bloc*, *quel
champ*, et *ce qu'on attendait*. Avec le lot C1, ce sujet grandit : une formule peut
diviser par zéro, additionner un texte, ou pointer un champ disparu — et c'est un
non-développeur qui lira le message.

**Prêt quand** dix erreurs typiques — dont cinq erreurs de formule — produisent dix
messages qu'un utilisateur corrige seul.

**Poids :** M — **Dépend de :** C1 à C7

> ✅ **Livré le 2026-08-21.** Une **union discriminée** de six familles,
> `OpenviewDiagnostic`, et **deux** fonctions publiques : `diagnosticsOf(error, context)`
> pour ce qui est levé, `diagnosticOfPresentationRefusal(refusal, context)` pour ce qui
> est *rendu*. Chaque diagnostic porte `source`, `code`, `message`, `path` et `nodeId` ;
> `source` + `code` choisit la branche de traduction, complétée par les détails structurés
> (`expected`, `acceptedValues`, `site`, `actualType`, `limit`, `fromVersion`) ; la phrase
> par défaut est anglaise.
> **Zéro champ de modèle, zéro migration, zéro dépendance** : `CURRENT_SCHEMA_VERSION`
> reste à **8** et la chaîne à **sept** entrées. Le barrel public passe de **126** à
> **133** valeurs. [ADR 0010](../adr/0010-un-refus-comprehensible.md) fait foi.
>
> **Ce que le lot ne fait PAS, et c'est la moitié de la décision :** une erreur qu'il ne
> reconnaît pas rend `undefined`, jamais un refus générique — le patron consommateur la
> **relance**. Une faute de programmation dans une fonction de migration fournie par
> l'appelant traverse donc la façade intacte, avec sa pile, au lieu de devenir une phrase
> qu'un auteur de modèle essaierait de corriger.
>
> **Aucune valeur de rendu ne sort, nulle part.** Ni la donnée fautive, ni un extrait du
> modèle, ni la `cause`, ni une valeur reçue par le validateur. Les seules valeurs
> variables admises dans une phrase sont une limite de configuration, une **forme** de
> valeur fermée et les **choix ou bornes déclarés par un schéma**. `nodeId` et `path` sont
> des champs séparés de `message` et n'y sont jamais interpolés : c'est ce qui permet à
> une interface de les échapper.
>
> **Ce que le lot laisse à l'aval, nommé plutôt qu'enterré :** la politique de la **donnée
> absente** (« blanc ou échec ») reste au futur `DataBindingStep`, seul endroit qui
> connaisse la position finale d'impression — la nommer ici renverserait l'ADR 0001, et
> trois tests épinglent le comportement actuel pour l'empêcher. Les refus de
> téléchargement, de DOM, de pagination et de police appartiennent aux lots moteur et à
> leurs **propres** enveloppes, pas à un code fourre-tout de cette union.

### C9. La pérennité, à chaque ajout

**Pourquoi.** Les huit lots ci-dessus modifient le contrat. La mécanique de
conversion existe : la promesse ne tient que si **chaque** ajout est accompagné de
sa conversion, dans le même mouvement. Repoussée, elle ne se fait jamais.

**Prêt quand** un modèle écrit avant C1 s'ouvre et se rend correctement après C8.

**Poids :** S par lot, jamais reporté — **Dépend de :** chaque lot ci-dessus

> ✅ **Livré le 2026-08-21.** Un **corpus historique de huit fixtures** — une par version stockée,
> aucune typée comme le contrat courant — et **un seul test propriétaire de la chaîne**, dont
> l'attendu est dérivé de la version initiale et de la version courante au lieu d'être recopié.
> Un resserrement de production : **une étape doit produire exactement le `to` qu'elle annonce**,
> refusé par le code existant `invalid-migration-result`.
> **Zéro champ de modèle, zéro migration nouvelle, zéro dépendance, zéro export** :
> `CURRENT_SCHEMA_VERSION` reste **8**, la chaîne reste à **sept** entrées et le barrel reste à
> **133** valeurs. [ADR 0011](../adr/0011-la-perennite-a-chaque-ajout.md) fait foi.
>
> **Les deux moitiés de « s'ouvre et se rend », séparées explicitement.** Ce lot livre
> « **s'ouvre** » : la fixture v1 — sans `page`, donc traversant réellement la seule migration
> transformante — est migrée, validée, parcourue, ses chemins collectés, et sa boucle, son alias,
> sa condition et sa liaison **évalués** sur un jeu de données explicite avec le résultat attendu.
> « **Se rend** » appartient à **[E7](engine.md#e7-le-lot-de-documents-figés-de-non-régression)**,
> qui reçoit la même fixture comme document figé : `core` ne produit ni DOM, ni PDF, ni pixel, et
> un faux renderer de test aurait été à jeter dès E1.
>
> **Ce que le lot ne prétend PAS automatiser, dit plutôt qu'enterré :** le filet devient fort
> **après** que la version a été incrémentée. Détecter qu'un champ nouvellement ajouté *aurait dû*
> provoquer ce bump reste une **revue humaine** — aucun fingerprint des internes de Zod, aucun
> snapshot géant, aucune modification de CI n'a été ajouté pour faire semblant du contraire.
>
> **Ce que le lot laisse à l'aval :** le protocole en neuf étapes que tout futur lot persistant
> doit suivre est écrit dans l'ADR, pas dispersé dans les plans C1 à C9.

> 🏁 **Vague 1 close le 2026-08-21**, sans version 9 et sans moteur. Les neuf lots C1 à C9 ont livré
> le contrat de modèle ; la suite appartient à la vague E et, pour C10, au jalon J3 — **que C10 n'a
> pas attendu**, voir l'[ADR 0015](../adr/0015-le-catalogue-de-donnees-de-l-integrateur.md).

---

## Vague 2 — de quoi alimenter l'éditeur (après J3)

### C10. Le catalogue de données de l'intégrateur

**Pourquoi.** Décision retenue : l'application hôte déclare les données
disponibles, avec des libellés métier (« Nom du client », « Lignes de la
commande »). L'éditeur ne proposera que celles-là — c'est aussi ce qui permettra à la
barre de formule de proposer des champs plutôt que d'attendre des noms techniques.

**Prêt quand** un catalogue déclaré par une application hôte suffit à savoir, pour
un modèle donné, si toutes ses données existent — et à lister les libellés
proposables à l'utilisateur.

**Poids :** M — **Dépend de :** J3 atteint

> ✅ **Livré le 2026-08-26** par l'[ADR 0015](../adr/0015-le-catalogue-de-donnees-de-l-integrateur.md),
> qui fait foi. Le catalogue est un contrat **hôte transitoire** — il n'entre pas dans le modèle,
> `CURRENT_SCHEMA_VERSION` reste **9** — récursif, ordonné, et vide-possible. Quatre natures
> terminales (`string`, `number`, `boolean`, `civil-date`), un objet, une liste ; deux clés sœurs
> identiques sont refusées **à la position de la seconde**. `listDataCatalogueEntries()` rend les
> libellés dans l'ordre de l'hôte ; `checkTemplateDataCompatibility(template, catalogue)` rend
> **une entrée par occurrence** — flux puis en-tête puis pied — avec sa position, son `nodeId`,
> l'attente de son site et un statut parmi `available`, `undeclared`, `incompatible`, `blocked`.
>
> **Les trois dettes des ADR 0001 à 0003 tombent ensemble** : le typage des lectures, les lectures
> par élément (`ligne.montant` est vérifié contre le type d'élément de sa liste source), et l'alias
> qui masque une racine — désormais un avertissement localisé, jamais un refus, parce que la
> sémantique runtime est définie.
>
> **Ce que le lot refuse, et qui délimite la brique :** aucun schéma pour `RenderRequest.data`,
> aucune validation d'instance, aucune inférence depuis un exemple, aucun nom de métier en
> production. La fonction ne prend **pas** de jeu de données, et son arité est épinglée.
>
> **Ce qu'il a coûté à l'algèbre :** le troisième parcours d'expressions rend le Visitor
> obligatoire, comme [AGENTS.md §3.B](../../AGENTS.md) l'annonçait. L'évaluateur et `pathsOf()`
> passent désormais par un dispatcher unique, sans changement de comportement.
>
> ⚠️ **Livré hors gate.** Le plan gelait le lot jusqu'à J3, qui n'est pas atteint. Ce que le gate
> protégeait — la table d'attentes — a été vérifié garde par garde contre le runtime livré ; il
> reste dû de la relire quand E4 sortira.

### C11. Grille, colonnes et calques

**Pourquoi.** L'éditeur retenu repose sur une grille pas à pas qui facilite
l'alignement, des colonnes, et des calques pour la profondeur. Le contrat doit
savoir décrire ce que l'utilisateur construira, sinon l'éditeur produira des
modèles que le moteur ne saura pas rendre.

**Prêt quand** un modèle décrit un découpage en lignes et colonnes, un pas de
grille, et un fond de page (filigrane, cachet) placé sur un calque distinct.

**Poids :** L — **Dépend de :** C10, et des enseignements du moteur sur le
multi-pages. *C'est le lot le plus risqué du contrat : voir le risque « calques et
multi-pages » en [§6 de la vue d'ensemble](README.md#6-risques-assumés).*

> ✅ **Livré le 2026-08-26** — [ADR 0016](../adr/0016-grille-colonnes-et-calques.md),
> schéma **10**. Un `GridNode` rejoint le flux : colonnes égales dérivées du parent, lignes au
> pas déclaré (`step` en mm), zones 1-based avec spans (≥ 2), recouvrements et sorties refusés
> au parsing. `PageSetup.layers` porte des calques pleine feuille, `background`/`foreground`,
> répétés sur toutes les pages, hors flux, avec une opacité de calque strictement entre 0 et 1.
> Le moteur les consomme entièrement : grille **atomique** à la pagination, calques peints sans
> toucher une coupure, et un contenu de zone qui déborde est un refus mesuré
> (`grid-content-overflow`) avant impression — jamais un rognage. Poids réel : **XL**, comme le
> plan l'annonçait — tenir « un modèle accepté n'est jamais ignoré par le moteur » a coûté le
> moteur, l'adaptateur et la recette dans la même fenêtre.
>
> ⚠️ **Livré hors gate, comme C10** : J3 (E4 + relecture métier) n'était toujours pas atteint
> au 2026-08-26. L'écart est consigné dans l'ADR 0016.

---

## Ce que cette brique ne fait pas

Elle **décrit**, elle ne **produit** rien : aucune page, aucun pixel, aucun PDF.
Elle ne connaît ni écran, ni serveur, ni imprimante. Si une question commence par
« à quoi ça ressemble », elle appartient au [moteur](engine.md) ou au
[viewer](viewer.md).

Hors périmètre du contrat en v1 : règles fiscales et conversion de devises,
fonctions définies par l'utilisateur, traçabilité des calculs, graphiques, tables des
matières, signature, formulaires remplissables, positionnement libre au millimètre.

---

## La brique est finie quand

Une facture comptable réelle — trois pages, une soixantaine de lignes, totaux
calculés par le modèle, arrondis déclarés, échéance calculée, mentions légales, logo,
deux langues, deux devises — est **entièrement décrite** par un modèle, et qu'un
modèle ou une formule mal formés sont refusés avec un message que leur auteur comprend
seul.

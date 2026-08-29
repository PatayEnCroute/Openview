# Roadmap — `@openview/engine` (le moteur)

> **Rôle produit :** transformer un modèle et un jeu de données en **document
> final**. C'est la brique qui fait passer Openview de « projet bien structuré » à
> « quelque chose qui produit des documents ».
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

**Le document se pagine, et il se pagine en comptable.** Les lots **E1, E2 et E3 sont
livrés** : un modèle et un jeu de données donnent une facture en PDF à la feuille
déclarée, une facture de soixante lignes en sort sur quatre pages avec l'en-tête de
colonnes répété et « page n / N » exact, chaque page postérieure à la première porte le
**report** des lignes achevées avant elle, les blocs marqués restent entiers dès qu'une
page peut les porter, un texte coupé garde deux lignes de part et d'autre de la couture
chaque fois que c'est réalisable, et les mentions comme le cadre de paiement ne
paraissent que sur la dernière feuille.

Le jalon **J2 est atteint**. Le jalon **J3 ne l'est pas encore** : il exige aussi
français/euros puis anglais/dollars, propriété d'**E4**. Écritures, déterminisme, corpus
figé et durcissement restent devant.

Depuis le lot **C11** ([ADR 0016](../adr/0016-grille-colonnes-et-calques.md)), le moteur
rend aussi les **grilles** (atomiques à la pagination, un contenu de zone qui déborde est
refusé après mesure — `grid-content-overflow` — jamais rogné) et les **calques de page**
(peints pleine feuille sur chaque page, hors flux : les coupures sont prouvées identiques
avec et sans calques). Le contrat du port de mesure a gagné une observation,
`overflowingGridItems`, que l'adaptateur Puppeteer fournit.

Voir l'[ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md),
l'[ADR 0013](../adr/0013-le-tableau-deborde-proprement.md) et
l'[ADR 0014](../adr/0014-les-exigences-comptables.md) pour ce que les trois lots ont
tranché, ce que les sondes Chromium ont corrigé et ce qui reste ouvert.

Format retenu pour la première version : **le PDF, et lui seul**. HTML et image
sont écartés — mais on n'écrira rien qui interdise de les ajouter ensuite.

---

## Les lots, dans l'ordre

### E1. Une facture d'une page sort en PDF

**Pourquoi.** C'est le premier moment où Openview existe vraiment. Périmètre
volontairement pauvre : une facture courte, un tableau qui tient sur la page, les
**formules du modèle évaluées** (totaux, agrégations, échéance, arrondis déclarés), le
logo, l'apparence du modèle respectée.

**Prêt quand** le playground affiche : « choisir un modèle, choisir un jeu de
données, télécharger le PDF » — et que le PDF obtenu est présentable.

**Poids :** L — **Dépend de :** [core](core.md) vague 1 — **Jalon : J2** —
**✅ livré le 2026-08-21**, [ADR 0012](../adr/0012-une-facture-d-une-page-sort-en-pdf.md).
Puppeteer vit dans son propre paquet, `@openview/adapter-puppeteer` : installer le moteur
seul ne télécharge aucun navigateur. Un contenu qui ne tient pas est **refusé**, jamais
tronqué.

### E2. Le tableau déborde proprement

**Pourquoi.** Dès la deuxième facture réelle, les lignes ne tiennent plus sur une
page. Il faut alors : passer à la page suivante, **répéter l'en-tête des
colonnes**, répéter l'en-tête et le pied de page du modèle, et numéroter
« page 2 / 4 ».

**Prêt quand** une facture de soixante lignes produit quatre pages lisibles, dont
aucune ne commence par une ligne orpheline ou un tableau sans en-tête.

**Poids :** L — **Dépend de :** E1 —
**✅ livré le 2026-08-22**, [ADR 0013](../adr/0013-le-tableau-deborde-proprement.md).
La coupure appartient au moteur : Chromium mesure, il ne pagine pas. Une ligne qu'aucune
page ne peut contenir se fragmente par flux de cellules, ce qui rend paginable un tableau
imbriqué. Les veuves, les orphelines typographiques et le report de total sont livrés par
E3 ([ADR 0014](../adr/0014-les-exigences-comptables.md)).

### E3. Les exigences comptables

**Pourquoi.** C'est le niveau d'exigence retenu, et ce qui sépare une démo d'un
outil utilisable en gestion :

- le **total reporté** de page en page (« report : 12 480,00 € ») ;
- les **blocs insécables** non coupés **dès qu'ils peuvent tenir sur une page**
  (cadre de totaux, mentions, adresse) ;
- les **mentions légales** et le cadre de paiement **sur la dernière page uniquement**.

> **Le report est le seul calcul que le moteur décide lui-même** : il dépend de
> l'endroit où la page se coupe, que personne d'autre ne peut connaître. Tous les
> autres montants sont calculés par les **formules du modèle**, et leur exactitude
> appartient à l'auteur du modèle — voir la
> [règle d'arbitrage](core.md#règle-darbitrage--la-capacité-est-à-nous-la-responsabilité-est-à-lintégrateur).

> **L'insécabilité est DÉCLARÉE par le modèle et HONORÉE ici** — le contrat porte
> `keepTogether?: true` sur les huit nœuds depuis le lot
> [C7](core.md#c7-les-blocs-insécables) ([ADR 0009](../adr/0009-les-blocs-insecables.md)).
> Ce lot en est le seul propriétaire, et l'ordre de traitement lui est imposé, par
> occurrence marquée et **après** mesure :
>
> 1. **page courante** — si l'occurrence tient dans l'espace restant, elle y reste
>    entière ;
> 2. **page neuve admissible** — sinon, si elle tient dans l'aire disponible d'une
>    prochaine page compatible avec les bandes déclarées, elle y est reportée
>    entière ;
> 3. **repli ordinaire du kind** — si aucune page neuve ne peut la contenir, la
>    préférence **cesse de bloquer le placement** : un contenu fragmentable est coupé
>    de façon **déterministe**, une ressource atomique garde le comportement de
>    placement ou de refus d'**E1/E2**. Cette branche est ce qui **garantit la
>    terminaison** : sans elle, le paginateur reporte éternellement le même bloc.
>
> Trois précisions qui coûtent cher si elles sont découvertes tard. **Une marque
> descendante survit au repli de son parent** : un tableau trop grand se coupe entre
> ses lignes, et la ligne de total marquée reste entière si elle tient sur une page
> neuve. **La sémantique est par occurrence matérialisée** : une boucle ou un groupe de
> lignes marqué garde **chaque** itération entière, jamais toutes ensemble. **Une bande
> de page n'entre pas dans cet ordre** — elle n'est jamais reportée comme un bloc du
> flux, et si son contenu mesuré dépasse la zone imprimable, le
> [refus propre exigé par l'ADR 0006](../adr/0006-la-page.md) s'applique inchangé,
> qu'une marque soit portée par son conteneur ou non.
>
> ⛔ **Ce que C7 n'a PAS livré et qui vous revient :** l'**identité d'occurrence**
> capable de distinguer deux itérations sous des boucles imbriquées — `(id, rang
> local)` ne suffit pas et les `id` ne sont pas globalement uniques. C'est **E5** qui
> la choisit, et c'est aussi E5 qui rendra le repli **observable** dans son résultat de
> pagination : `core` n'ajoute aucun diagnostic.

**Prêt quand** un utilisateur métier lit une facture paginée produite par Openview et ne
relève aucune anomalie de mise en page.

**Poids :** XL — **Dépend de :** E2 — **Jalon : J3** —
**✅ livré le 2026-08-25**, [ADR 0014](../adr/0014-les-exigences-comptables.md).
Le report est le seul calcul que le moteur décide : le modèle désigne ce que chaque ligne
apporte, le moteur décide sur quelle page l'occurrence s'achève. La marque suit l'ordre
imposé par l'[ADR 0009](../adr/0009-les-blocs-insecables.md), sa troisième branche étant
la preuve de terminaison. La recette de soixante lignes sort sur **quatre** feuilles et
non trois — le nombre annoncé ici avant exécution : E2 en produisait déjà quatre, et E3
ajoute du contenu ; quatre feuilles éprouvent **trois** reports entrants au lieu de deux.

> ⚠️ **La lecture métier reste à faire.** La recette technique et la recette visuelle sont
> consignées dans l'ADR ; aucun gestionnaire ni comptable n'a encore relu le PDF. La phrase
> « un utilisateur métier ne relève aucune anomalie » n'est donc **pas** démontrée, et la
> séance prévue à J3 par la
> [question ouverte n° 1 de la vue d'ensemble](README.md) reste à planifier.

> C'était le lot le plus coûteux de toute la roadmap. Il était aussi celui qu'on ne
> pouvait pas sacrifier : une pagination comptable ajoutée après coup se paie deux fois.

### E4. Langue et devise au rendu

**Pourquoi.** Le contrat sait décrire un modèle bilingue (core C6) ; le moteur doit
l'honorer : montants, dates, séparateurs, symbole monétaire, libellés fixes.

**Ce que C6 a livré, et ce qu'il a laissé.** Le contrat est en place — une table
d'écritures sur le `Template`, une sélection par argument, trois fonctions de
formatage. Ce lot hérite de **onze attentes nommées**, chacune avec son propriétaire
et son point de vérification : elles sont énumérées dans
[ADR 0008](../adr/0008-langue-devise-et-formats.md), et il ne faut **pas** les
redécouvrir ici. Deux méritent d'être citées en tête :

- **E4-1 — choisir les SITES.** Le contrat livre un verbe et jamais la liste des
  sites : rien dans un document stocké ne distingue un numéro de commande d'un
  total, et reconnaître un total exigerait de réserver un nom de champ. C'est
  **ce lot** qui tranche, devant une vraie facture.
- **E4-10 — ne jamais construire une écriture à la main.** Aucune porte ne le tient,
  et l'ADR recopie les **cinq familles de fautes** atteignables autrement — quatre
  `RangeError` et un repli silencieux sur la langue de l'hôte — pour rendre
  l'obligation opposable.

**Prêt quand** le même modèle, appelé deux fois, **produit** une facture
français/euros et une facture anglais/dollars, toutes deux correctes — c'est-à-dire
un PDF qui sort, avec les sites correctement choisis.

✅ **Cet énoncé appartient désormais à ce lot SEUL.** Il était mot pour mot celui de
`core` C6, alors que `core` ne rend rien ; l'arbitrage **A-2** de
[ADR 0008](../adr/0008-langue-devise-et-formats.md) l'a **scindé** le 2026-08-20 —
`core` **déclare**, ce lot **produit**. La moitié déclarative est livrée.

**Poids :** M — **Dépend de :** E3 — **Jalon : J3** —
**✅ livré le 2026-08-27**, [ADR 0017](../adr/0017-langue-et-devise-au-rendu.md).
La même facture de soixante lignes sort en français/euros et en anglais/dollars depuis **un
seul objet template**, sur quatre feuilles A4 dans les deux cas. E4-1 est tranché : un site
stocke `{ kind, profile }` — quelle fonction écrit la position, et sous quel profil logique —
et l'appelant associe les profils aux écritures déclarées **à la construction du port**.
`20260016` reste `20260016`, parce qu'un identifiant ne déclare rien. E4-10 est tenu :
`resolvePresentation` est le seul chemin vers un formateur, et les deux tables sont lues avec
`Object.hasOwn`. Un report est arrondi **puis** écrit, et une écriture dont l'échelle
contredirait l'arrondi déclaré est refusée plutôt que corrigée.

> ⚠️ **J3 n'est pas atteint pour autant.** Les deux PDF existent et sont valides, mais la
> **relecture par un gestionnaire ou un comptable n'a pas eu lieu**. Le lot est techniquement
> livré ; le jalon reste ouvert sur cette seule condition.

> **Un défaut de la vitrine, trouvé pendant ce lot et corrigé avec lui :** l'apparence A refusait
> ses quatre combinaisons de soixante lignes en `grid-content-overflow`, sa zone de titre ne
> déclarant que deux rangs pour un titre qui en compose trois. Le moteur avait raison de refuser —
> une zone n'est ni rognée ni redimensionnée — et la correction est dans le modèle de démonstration,
> pas dans `engine`.

> ⛔ **Ce que E4 n'a PAS livré et qui revient à E5 / viewer :** l'attente **E4-9**, « le même
> ICU à l'aperçu et au rendu ». E4 vérifie le PDF avec l'ICU du processus qui construit
> l'HTML ; aucun aperçu public n'existe encore, donc l'égalité n'est pas déclarée livrée.
> **Depuis E5, la moitié moteur est tenue** — voir ci-dessous.

### E5. Le moteur sait dire où il coupe ✅

**Pourquoi.** La promesse retenue est un **aperçu identique au PDF, garanti**. Elle
n'est tenable que si le moteur ne se contente pas de produire un fichier, mais sait
aussi restituer la découpe qu'il a décidée — quelle ligne sur quelle page, où
tombent les reports. Sans ce lot, le [viewer](viewer.md) devra deviner, et la
garantie tombe.

**Prêt quand** le moteur peut répondre, pour une facture donnée, « voici les quatre
pages et ce que chacune contient », sans produire le PDF.

**Poids :** M — **Dépend de :** E3 — **Condition de : J4**

> ✅ **Livré le 2026-08-28** — [ADR 0018](../adr/0018-le-moteur-sait-dire-ou-il-coupe.md).
> `createPaginationPort(strategy, options)` rend un `PaginationResult` sans produire un octet de
> PDF. La surface exacte, dans `@openview/core` pour qu'un paquet navigateur l'importe **sans
> dépendre de `engine`** :
>
> - `sheet` et l'**HTML autonome**, celui-là même que le port PDF remet à l'imprimeur — égalité
>   octet pour octet, prouvée sur le fake et sur Chromium ;
> - `pages[]`, chacune avec la liste **plate et ordonnée** de ce qu'elle peint : occurrence,
>   région (`background`/`header`/`root`/`footer`/`foreground`), rôle (`flow`, `page-band`,
>   `table-header`, `page-layer`) et état du fragment (`whole`/`first`/`middle`/`last`) ;
> - `report` par page : le cumul **brut** entrant et les lignes contributrices qui s'y achèvent ;
> - `notices[]` : les replis `keepTogether` de la suite **acceptée**, un par occurrence.
>
> Une occurrence est adressée par un **chemin de déclaration** et une **ascendance d'itération**
> séparés : deux boucles imbriquées et des `id` dupliqués produisent des adresses distinctes, et
> deux rendus identiques les mêmes. Aucune clé de mesure, aucun curseur, aucune métrique et aucune
> valeur liée ne traversent le contrat.
>
> **Recette mesurée** : la facture de soixante lignes rend **quatre pages** dans les deux
> apparences et dans les deux diagonales E4 (fr/EUR, en/USD) ; chaque ligne de détail est attribuée
> à la page dont le `<tr>` la peint ; l'en-tête de table répété, les quatre domaines de bande et les
> deux plans de calque sont distingués ; un document hostile reste inerte et hors ligne dans un
> `iframe srcdoc sandbox=""` réel. Le manifeste pèse **1,01 fois** la source qu'il explique.
> **Quinze ablations jouées, quinze tuées.**

> ✅ **E4-9 est fermée côté moteur.** Les caractères ICU sont écrits une fois, avant la
> sérialisation, et le contrat ne transporte ni locale, ni clé d'écriture, ni valeur brute : il n'y
> a rien à reformater de l'autre côté. **La moitié viewer reste ouverte** jusqu'à ce que V1 affiche
> cette source sans la retoucher et que V3 la compare au PDF.

> ⚠️ **J4 n'est pas atteint.** E5 en est une *condition*. V1 à V3 restent propriétaires de
> l'encastrement, de la navigation et de la comparaison visuelle automatique.

### E6. Le même document, à chaque fois ✅

**Pourquoi.** Deux exécutions du même modèle sur deux machines **portant le même profil
de reproductibilité** doivent donner le même document, au caractère près : polices,
images, et surtout **résultats de formules** — un montant qui varie d'un centime selon
la machine ruinerait la confiance plus sûrement qu'un défaut de mise en page.

**Conséquence non négociable : le moteur ne lit ni l'horloge, ni le fuseau, ni la
locale de la machine.** Toute date, y compris « aujourd'hui », arrive dans le jeu de
données sous le nom que l'intégrateur lui a donné. Un moteur qui interroge son
environnement ne peut pas, par construction, produire deux fois le même document.

Les arrondis déclarés par le modèle
([core](core.md) C2) doivent être honorés à la lettre. Sans ce lot, ni contrôle
automatique, ni confiance possible.

**La garantie est profilée, et elle ne peut pas être absolue.** Deux builds d'ICU
différents n'écrivent pas les mêmes octets : dans `1 234,50 €` en `fr-FR`, le
séparateur de milliers est **U+202F** depuis CLDR 42 / ICU 72 et **U+00A0** sur les
builds antérieurs — c'est la réserve **E4-6** de
l'[ADR 0008](../adr/0008-langue-devise-et-formats.md), et elle vaut pour tout ce qui
décide de la forme des octets : Node, V8, ICU, Unicode, Chromium, cible
plateforme/architecture, catalogue de fontes, canonicaliseur, arguments de lancement.
D'où le **profil** : treize champs comparés d'abord, et un refus nommant le champ qui
diffère plutôt qu'une différence de documents maquillée.

**Prêt quand** la même facture produite dix fois, sur deux machines **du même profil**,
donne dix fichiers identiques octet pour octet.

**Poids :** M — **Dépend de :** E4

> ✅ **Livré le 2026-08-28** — [ADR 0019](../adr/0019-le-meme-document-a-chaque-fois.md).
> Trois familles incorporées (Inter, Noto Sans, Noto Serif — douze faces, SIL OFL 1.1), aucun
> générique CSS et aucune pile derrière la face : une famille hors catalogue ou un point de code
> absent du `cmap` est **refusé**, jamais replié sur une police de l'hôte. Chromium **prouve** le
> chargement de chaque face au lieu de l'attendre — `document.fonts.ready` se résout que les faces
> aient chargé ou échoué. Le PDF est réécrit par `pdf-lib` : métadonnées fixes, dates à l'époque
> Unix, identifiant de trailer supprimé.
>
> **La porte inter-machines est verte.** Deux runners `ubuntu-24.04` indépendants rendent chacun
> dix fois les deux apparences ; le comparateur exige treize champs de profil identiques **avant**
> de lire une empreinte, puis constate **une seule empreinte par document** sur les vingt rendus.

### E7. Le lot de documents figés de non-régression ✅

**Pourquoi.** C'est l'outil qui rend la suite tenable en solo à temps partiel : un
petit ensemble de documents figés auxquels toute évolution est comparée. Le premier
filet de sécurité du projet.

**En v1, ce lot ne contient que des factures** — une page, multi-pages, avec report,
deux langues, cas limites — parce qu'elles concentrent les contraintes les plus
dures et qu'un lot qu'on ne peut pas énumérer n'est pas un filet. D'autres types de
documents s'y ajouteront quand un besoin réel le justifiera, jamais par principe.

**Prêt quand** une modification volontairement fautive du moteur est signalée
automatiquement, en désignant la facture et la page concernées.

**Poids :** M — **Dépend de :** E6

> 📥 **Scénario transmis par [C9](core.md#c9-la-pérennité-à-chaque-ajout) (2026-08-21).** La
> fixture historique **v1** — celle qui ne déclare aucune `page` et traverse donc la seule
> migration transformante — rejoint ce corpus dès que le moteur existe : `parseTemplate` la migre,
> le moteur la rend, et son PDF devient une référence figée.
>
> C9 a livré la moitié « **s'ouvre** » de la promesse (le modèle est migré, validé, parcouru et
> **évalué** avec le résultat attendu) ; la moitié « **se rend** » est ce lot-ci, et personne
> d'autre ne peut la tenir. La fixture vit dans
> [`packages/core/src/template/__tests__/compatibility-fixtures.ts`](../../packages/core/src/template/__tests__/compatibility-fixtures.ts)
> et n'est typée par rien : si la représentation intermédiaire du moteur change, c'est
> l'adaptateur de test E7 qui évolue, jamais le document stocké.

> ✅ **Livré le 2026-08-29** — [ADR 0020](../adr/0020-le-lot-de-documents-figes-de-non-regression.md).
> Six scénarios fermés et énumérés (`tools/golden/corpus.mjs`), 21 pages, dont le témoin
> historique v1 que `parseTemplate` migre et que le moteur rend enfin. Quatre oracles : le PDF
> complet comparé **octet par octet**, un PDF mono-page dérivé par rang, le certificat de
> pagination E5 de cette page, et l'empreinte de l'HTML autonome. Un échec nomme la facture **et
> la ou les pages**. Le profil E6 accompagne le lot : une différence d'hôte est refusée avant
> qu'un octet soit lu, une différence de renderer échoue **et** montre les pages touchées.
> Vérifier et accepter sont deux commandes sans chemin commun, et aucun workflow n'appelle
> l'acceptation.
>
> **Le corpus est amorcé.** Les six PDF et leur manifeste, produits sous le profil officiel
> `ubuntu-24.04` / Node 24.11.1 puis acceptés, sont committés dans
> [`tests/golden/e7/references/`](../../tests/golden/e7/references/). Le job `Frozen Documents (E7)`
> les rejoue à chaque run dans un workspace propre : c'est ce run-là, et pas l'acceptation, qui est
> la preuve.
>
> **Deux mutations que le corpus ne tue pas, et c'est écrit** : un `keepTogether` ignoré et un
> report entrant décalé d'un fragment produisent des documents identiques, parce qu'aucun des six
> scénarios ne les rend contraignants. Les neuf tests fonctionnels qui les tuent, eux, sont
> toujours là — E7 fige une combinaison visible, il ne remplace aucun oracle métier.

### E8. Le moteur survit à un document hostile

**Pourquoi.** Rendre un modèle, c'est exécuter ce que quelqu'un d'autre a écrit. Un
modèle peut boucler à l'infini, réclamer une image de 400 Mo, ou tenter d'aller lire
des fichiers ou des adresses internes du serveur. **Les formules aggravent ce point :
une formule est du calcul, donc quelque chose qui peut tourner trop longtemps ou
grossir sans fin** — il faut la borner en temps comme en taille. Ce lot est
**obligatoire avant d'ouvrir le [service](service-de-rendu.md)** : sans lui, on publie
une porte d'entrée.

**Prêt quand** une petite collection de modèles délibérément hostiles est refusée
ou interrompue proprement, sans mettre le moteur à genoux, et que chaque refus est
journalisé.

**Poids :** L — **Dépend de :** E1 — **Condition de : J5**

> 🟡 **Livré en partie — [ADR 0021](../adr/0021-le-moteur-survit-a-un-document-hostile.md).**
>
> `@openview/engine` borne désormais ce dont il connaît la sémantique : **250 000 objets
> matérialisés**, **100 pages**, **32 Mio d'HTML** — comptés en octets UTF-8, réservés *avant*
> allocation, et partagés entre la première passe et l'extension des bandes.
> `@openview/adapter-puppeteer` borne le reste : **64 Mio de PDF** en entrée et en sortie,
> **8 Mio et 25 M de pixels par image**, **32 Mio et 100 M de pixels cumulés**, **64 images
> distinctes**, **1 slot**, **4 requêtes en file**, **5 s d'attente**, **30 s de rendu**,
> **256 Mio de vieux tas par worker**, **5 s pour qu'un worker s'annonce**, **100 rendus avant
> recyclage**. Un champ absent prend son
> défaut ; un champ présent mais invalide est refusé, et chaque plafond a lui-même un plafond de
> configuration pour que `1_000_000_000` ne devienne pas une manière documentée de tout désactiver.
>
> **La façade durcie est `createPuppeteerRenderRuntime()`**, et c'est la seule qu'un service peut
> pointer vers un document qu'il ne contrôle pas. Le chemin direct
> (`createPuppeteerPdfStrategy()`) reste disponible pour un intégrateur qui contrôle ses entrées :
> il prend les bornes logiques, mais **n'impose aucun délai mural** — rien dans `engine` ne peut
> interrompre une évaluation synchrone.
>
> **Une image distante n'est jamais donnée à Chromium.** Elle doit figurer au manifeste du runtime
> sous sa source exacte avec son SHA-256 ; Node la télécharge sous plafond, vérifie l'empreinte, la
> signature binaire et ses dimensions, puis l'incorpore en `data:`. La résolution DNS est épinglée
> jusqu'à la socket, chaque redirection repasse toute la politique, et un nom qui répond une seule
> adresse non publique est refusé en entier.
>
> **Réserve mémoire, écrite parce qu'elle compte :** `resourceLimits` borne le vieux tas d'un isolat
> V8 et **ni les `ArrayBuffer`, ni les allocations externes, ni Chromium**. Un hôte qui expose ce
> runtime a encore besoin d'une limite de processus ou de conteneur — c'est le travail de
> [S2](service-de-rendu.md), pas celui de ce lot.
>
> **Ce qui manque pour dire « livré » :** le corpus hostile outillé et son job CI bloquant, la
> mesure 60 pages / 60 000 lignes (le KPI de 2,0 s reste **non mesuré**), la parité octet pour octet
> du lot figé E7 par le chemin durci, et **un succès HTTPS de bout en bout** : la politique distante
> est prouvée contre un transport injecté, aucune socket TLS n'est ouverte nulle part dans ce dépôt.
>
> **Un changement pour l'intégrateur existant :** le chemin direct lit désormais son PDF en flux
> borné, donc un document au-dessus de 64 Mio est refusé là où il sortait auparavant. Le plafond est
> configurable et vaut douze fois le plus gros document du corpus.

### E9. La documentation du moteur ✅

**Pourquoi.** Publication groupée : chaque brique doit être installable et
utilisable par un développeur inconnu. Ici : comment obtenir un PDF en dix lignes,
et ce qui se passe quand ça échoue.

**Prêt quand** quelqu'un d'extérieur produit sa première facture sans nous écrire.

**Poids :** S annoncé, **M réalisé** — **Dépend de :** E7 — **Condition de : J7**

> ✅ **Livré le 2026-08-29** — [ADR 0022](../adr/0022-la-documentation-du-moteur.md).
> Seize pages, en anglais et en français : deux README de paquet, un sommaire, un premier PDF,
> modèles et données, les trente et un refus, les documents qu'on ne contrôle pas, garanties et
> limites. Tout extrait publié est une **région d'un module compilé et exécuté** — les deux
> façades rendent un vrai PDF sous Vitest —, et chaque fait volatil est comparé à sa source :
> codes, phases, issues d'audit, champs de profil, trois tables de défauts lues dans les deux sens.
> La porte `tools/docs/check.mjs` vit dans la suite de tests, avec huit fautes qu'elle refuse.
>
> **La répétition à froid a produit un PDF depuis un dossier vide hors du dépôt** : trois `.tgz`
> installés, les fichiers recopiés de la page, `tsc` puis `node`, 22 527 octets, une page — sans
> ouvrir un seul fichier de `packages/`.
>
> **Ce qui reste ouvert :** `@openview/core` n'a ni README ni documentation, et aucun lot ne la
> porte — sa page npm sera vide à J7. La parité de sens entre les deux langues n'est pas outillée,
> et la répétition à froid a été jouée par l'auteur des pages, faute d'un second lecteur.

---

## Ce que cette brique ne fait pas

- Elle ne **conserve** rien : ni modèle, ni document produit. C'est l'application hôte qui décide où tout cela vit.
- Elle ne **cherche** aucune donnée : elle reçoit un modèle et un jeu de données de son appelant, et n'interroge aucune base, aucun référentiel, aucune horloge. Openview n'est pas une source de données. Elle charge en revanche les ressources que le modèle désigne — images, polices : ce sont des requêtes sortantes, et c'est exactement la surface que le lot E8 doit borner par une liste blanche.
- Elle ne **corrige** pas un modèle invalide : elle le refuse, avec le message du [contrat](core.md).
- Elle n'affiche rien à l'écran : c'est le [viewer](viewer.md).
- Elle n'est pas un serveur : c'est le [service de rendu](service-de-rendu.md).

Hors périmètre v1 : HTML, image, graphiques, envoi par courriel, archivage, tampons
de signature, génération en lot de milliers de documents.

---

## La brique est finie quand

Une facture de trois pages et soixante lignes, avec reports, blocs insécables,
mentions sur la dernière page, sort en PDF dans deux langues et deux devises ; le
résultat est identique à chaque exécution ; toute régression est détectée
automatiquement ; et un modèle hostile ne fait pas tomber le moteur.

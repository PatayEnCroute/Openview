# Roadmap — le service de rendu (nouvelle brique)

> **Rôle produit :** permettre à une application d'obtenir un PDF **sans installer le
> moteur**. C'est la porte d'entrée la plus facile pour un intégrateur curieux.
>
> Retour à la [vue d'ensemble](README.md).

---

## Pourquoi cette brique a sa propre roadmap

Elle n'existe pas encore dans le dépôt : le monorepo compte quatre bibliothèques, et
celle-ci n'en est pas une. **C'est un produit à démarrer, à exploiter et à
sécuriser** — un objet de nature différente. La glisser dans la roadmap du
[moteur](engine.md) masquerait son vrai coût.

Périmètre retenu, volontairement étroit : **rendu à la demande uniquement**. Ni
comptes, ni droits, ni conservation des modèles. On lui envoie un modèle et des
données, il renvoie un PDF, il n'a rien retenu.

> **Conséquence à assumer :** ce service ne suffit pas à un usage multi-client réel.
> Il sert à essayer Openview en cinq minutes et à rendre des documents depuis une
> application qui ne veut pas embarquer le moteur. Il faut le dire clairement dans la
> documentation, sinon quelqu'un le mettra en production tel quel.

---

## Les lots, dans l'ordre

### S1. Envoyer, recevoir

**Pourquoi.** Le service minimal utile : on transmet un modèle et un jeu de données,
on récupère un PDF, on comprend immédiatement ce qui s'est passé en cas de refus.

**Prêt quand** une petite application d'exemple obtient sa facture sans avoir installé
le moteur.

**Poids :** M — **Dépend de :** [moteur](engine.md) E7 — **Jalon : J5**

### S2. Le service se protège

**Pourquoi.** Un service de rendu ouvert est une cible : documents trop gros,
rendus interminables, appels en rafale, modèles qui tentent d'aller lire des adresses
internes. Le [moteur](engine.md) traite le document hostile (lot E8) ; le service doit
en plus se protéger de l'**usage** hostile : plafonds de taille, de durée, de
fréquence, et un nombre maximal de rendus simultanés.

**Prêt quand** une rafale d'appels et un document démesuré sont refusés proprement,
sans que le service devienne indisponible pour les autres.

**Poids :** L — **Dépend de :** S1, moteur E8

> Non négociable. Publier ce service sans ce lot, c'est distribuer une porte ouverte
> sous licence Apache.

### S3. Démarrer et surveiller

**Pourquoi.** « Prêt à l'emploi » veut dire : une commande pour démarrer, une
configuration lisible, un journal exploitable quand un rendu échoue, et un moyen de
savoir si le service est en vie.

**Prêt quand** quelqu'un d'extérieur démarre le service, produit une facture, provoque
volontairement une erreur, et comprend ce qui s'est passé en lisant le journal.

**Poids :** M — **Dépend de :** S2

### S4. La documentation d'usage

**Pourquoi.** Deux choses à dire, dont une désagréable : comment l'appeler, et **où
ne pas le mettre**. Une phrase explicite sur le fait qu'il n'est pas conçu pour être
exposé directement sur Internet sans protection en amont.

**Prêt quand** la documentation permet un premier PDF en cinq minutes et énonce ses
limites sans détour.

**Poids :** S — **Dépend de :** S3 — **Condition de : J7**

---

## Ce que cette brique ne fait pas

- Elle ne **conserve** ni modèle, ni document produit, ni historique.
- Elle ne sait pas **qui** appelle : ni comptes, ni droits, ni cloisonnement entre clients.
- Elle ne gère pas la **charge** : pas de file d'attente, pas de répartition, pas de génération en lot.
- Elle n'apporte **aucune capacité de rendu supplémentaire** par rapport au [moteur](engine.md) : même documents, mêmes limites.

Ces quatre absences sont le prix du périmètre retenu. Elles constituent, à elles
seules, le contenu d'une éventuelle v2 de cette brique.

---

## La brique est finie quand

Une application tierce obtient une facture comptable conforme sans avoir installé le
moteur ; le service refuse proprement les abus ; il se démarre et se diagnostique en
lisant une seule page de documentation ; et cette page dit honnêtement ce qu'il n'est
pas.

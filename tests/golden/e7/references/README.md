# Références figées du lot E7

Ce dossier contient le lot de non-régression : `manifest.json` et un PDF canonique par scénario du
registre `tools/golden/corpus.mjs`. Ce sont les documents exacts qu'un client recevait, et la
mémoire à laquelle toute évolution du rendu est comparée.

## Un golden ne vient que du profil officiel

Un golden n'est une référence que s'il a été produit **sous le profil officiel** : `ubuntu-24.04`,
Node `24.11.1`, le Chromium téléchargé par Puppeteer, `--no-sandbox`. Un PDF rendu sur une autre
machine attesterait un autre ICU et un autre moteur de mise en page ; le comparateur le refuserait,
et l'accepter transformerait le premier filet de sécurité du projet en générateur de bruit.

Le lot est là depuis le 2026-08-29 : six PDF et leur manifeste, produits par le runner officiel.
Tant qu'une référence attendue manque, le job E7 de la CI est **rouge** et publie son candidat
Ubuntu comme artefact pendant sept jours — c'était le chemin d'amorçage, c'est désormais celui de
toute évolution volontaire du rendu.

## Accepter une nouvelle version du lot

1. Télécharger l'artefact `golden-candidate` du job E7.
2. Vérifier son `manifest.json` : profil, versions du harnais, longueurs, empreintes, pages.
3. Rasteriser les 21 pages (Poppler, hors dépôt) et les **lire** : marges, filets, images, en-têtes
   répétés, reports, totaux, mentions, français/euros, anglais/dollars, calques, document v1.
4. Promouvoir explicitement :

   ```bash
   node tools/golden/accept.mjs <dossier-du-candidat>
   ```

5. Relire le diff textuel de `manifest.json`, ouvrir les seuls PDF annoncés différents, puis
   committer PDF et manifeste dans un commit séparé du code du harnais.

L'acceptation refuse un candidat incomplet, un profil qui n'est pas l'hôte officiel, un manifeste
invalide, un PDF surnuméraire et toute cible autre que ce dossier. Elle n'appelle ni `git add`, ni
`git commit`, ni `git push` — et **aucun workflow ne l'appelle**.

La preuve finale n'est pas l'acceptation : c'est le run suivant, qui reconstruit le corpus dans un
workspace propre et le compare aux fichiers désormais suivis.

## Budget

Budget initial : **2 Mio** pour l'ensemble des PDF complets. Un dépassement ne déclenche ni
compression ni Git LFS : il oblige à nommer le scénario ou la ressource qui a grandi, et à le
justifier dans l'ADR ou la PR.

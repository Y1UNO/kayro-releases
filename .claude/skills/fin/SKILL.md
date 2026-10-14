---
name: fin
description: Fin de session — range les idées, met à jour Accueil / ROADMAP / DA-JOURNAL d'après la session, propose un message de commit (sans commiter).
disable-model-invocation: true
---

Fais, dans cet ordre, en restant court (ne relis que les passages à modifier) :

1. **Idées** : range chaque ligne de `docs/Idees.md` dans la liste « Plus tard » de `docs/ROADMAP.md`, sous le bloc d'étape qui convient (`- [ ] …`, 1 à 2 lignes). Pas de doublon : si l'idée y est déjà, ne l'ajoute pas. Vide ensuite `Idees.md` (garde le titre et la phrase d'usage). Ne supprime jamais une idée : si elle est écartée, déplace-la dans « Abandonné » avec la date et la raison.
2. **Où on en est** : mets à jour l'encadré de `docs/Accueil.md` (étape en cours, prochaine étape, état de la DA).
3. **ROADMAP** : coche ou complète ce qui s'est passé dans la session (étape terminée : case + 1 à 3 lignes de décisions / limites / chiffres réels ; ligne « Plus tard » faite : coche avec la date).
4. **DA-JOURNAL** : seulement si la DA a bougé, ajoute une ligne au tableau « Changements après le gel » (date, quoi, avant → après, jeton ou fichier, pourquoi, décidé par) et corrige `docs/DESIGN.md` dans le même passage. Sinon n'y touche pas.
5. **Commit** : lance `git status --short` et `git diff --stat`, puis PROPOSE un message au format habituel (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`), avec les fichiers à inclure. **Ne commite jamais toi-même** et n'utilise pas `git add`/`git commit`.

Termine par un récap de 5 lignes maximum : ce qui a été rangé / mis à jour, et le message de commit proposé. Pas de seconde liste « Plus tard », pas de second journal.

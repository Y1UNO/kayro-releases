# Kit Claude Code — Hub (lanceur Windows)

## Contenu

```
hub-kit/
├─ LISEZ-MOI.md        ← ce fichier (mode d'emploi)
├─ PROMPTS.md          ← les 19 étapes : modèle, effort, plan, prompt, critères
├─ RESSOURCES.md       ← ce que tu dois préparer (captures, fiche machine, briefs…)
└─ repo/               ← le dossier du projet, à copier tel quel
   ├─ CLAUDE.md        ← mémoire du projet (Claude Code le lit tout seul)
   ├─ docs/            ← ARCHITECTURE, DESIGN, ROADMAP, MACHINE (à remplir)
   └─ reference/       ← 8 maquettes HTML (valeurs exactes) + captures/ + briefs/
```
`PROMPTS.md` et `RESSOURCES.md` restent **chez toi** : ce sont tes aide-mémoire. Claude Code n'a pas besoin de les lire (ça économise du quota).

## 1. Installer les outils (une seule fois)

Dans PowerShell. Chaque ligne est indépendante ; redémarre le terminal après les installations.

```
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```
Puis, pour Claude Code (installeur officiel recommandé, sans droits administrateur) :
```
irm https://claude.ai/install.ps1 | iex
```
(Alternative : `winget install Anthropic.ClaudeCode`.)
- Les « Build Tools » (outils C++) sont lourds (plusieurs Go, 10 à 20 minutes) mais indispensables pour compiler la partie Rust de Tauri.
- WebView2 est déjà présent sur Windows 11 et la plupart des Windows 10 à jour.
- Si une commande échoue ou si Tauri demande autre chose, la liste officielle est sur la page « Prerequisites » de la documentation Tauri 2 ; Claude Code peut aussi t'aider (« vérifie que mon environnement est prêt pour Tauri 2 »).
- Claude Code : ferme puis rouvre PowerShell, tape `claude --version` (un numéro de version doit s'afficher), puis `claude` dans le dossier du projet et suis la connexion dans le navigateur avec ton compte Pro. Si `claude` est « introuvable », le problème vient du PATH : la page de dépannage de l'installation est sur code.claude.com/docs (Troubleshoot installation).

## 2. Mettre le projet en place

1. Copie le dossier `repo/` où tu veux (ex. `C:\Dev\hub`).
2. Ouvre PowerShell dedans, puis :
```
git init
git add -A
git commit -m "chore: kit de depart"
```
3. (Conseillé) Crée un dépôt **privé** sur GitHub et pousse-le : c'est ta sauvegarde gratuite.
4. Remplis `docs/MACHINE.md` et ajoute les captures dans `reference/captures/` (voir `RESSOURCES.md` §1–2).

## 3. Faire une étape (la boucle à répéter)

1. `git switch -c step-02-squelette` (une branche par étape).
2. `claude` dans le dossier du projet, puis le modèle et l'effort de la fiche : `/model sonnet` ou `/model opus`, puis `/effort high` (voir le tableau §4 pour les noms).
3. Fiche « Plan : Oui » → écris `/plan ` devant ton prompt (ou appuie sur Maj+Tab jusqu'à voir « plan mode on »), relis le plan, valide.
4. Colle le prompt de la fiche (il commence par « Lis CLAUDE.md… »).
5. Teste toi-même (la fiche dit comment). Corrige par petites demandes ciblées.
6. Étape OK : `git add -A`, `git commit -m "feat: …"`, `git tag v0.N`, puis `/clear` (ou ferme la session).

Commence par l'**étape 1** : c'est la seule qui ne crée aucun code, et elle verrouille les choix techniques (versions vérifiées dans la doc actuelle) avant de dépenser du quota.

## 4. Modèles et efforts, en bref

| Quand | Modèle | Effort |
|---|---|---|
| Plans, performance, ambiances sur mesure, audit | Opus 5.5 | Élevé ou **Extra** (étapes 1, 13, 17, 18) |
| Moteur visuel, palette, moteur d'ambiances | Opus 5.5 | Élevé (étapes 8, 14, 16) |
| Tout le reste (squelette, données, détection, UI, scènes, installeur) | **Sonnet 5.5** | Moyen ou Élevé |
| Micro-retouches (textes, réglages de pixels) | Haiku 5.5 | Faible |

Les efforts de Claude Code s'appellent `low` (Faible), `medium` (Moyen), `high` (Élevé), `xhigh` (Extra), `max`. Par défaut, Sonnet 5.5 et Opus 5.5 démarrent en `medium` : pense à régler `/effort` à chaque étape.

- **Max** : peu de gain ici pour un quota brûlé (la doc le décrit comme sujet au surréfléchissement).
- **Ultracode** (`/effort ultracode`) : Claude lance automatiquement des équipes d'agents sur chaque tâche. Chaque demande consomme bien plus de tokens, donc sur Pro tu atteins ta limite beaucoup plus vite. Ne l'active jamais en permanence ; à la rigueur une seule fois pour l'audit (étape 18), juste après un renouvellement de quota, puis `/effort ultracode off`.
- **`opusplan`** (`/model opusplan`) : Opus pour le plan, Sonnet pour l'exécution. Pratique pour les étapes Sonnet marquées « Plan : Oui » (2, 4, 5, 10, 12) si tu veux un meilleur plan sans payer Opus pour tout le code.

## 5. Ne pas gaspiller ton quota Pro

- **Sonnet par défaut.** Opus uniquement aux étapes qui le demandent ; un Opus lancé à la fin d'une fenêtre de quota sera coupé en plein milieu. Les étapes ●●●● (13, 17) se lancent **juste après un renouvellement de quota**.
- Une étape = une session. `/clear` entre deux étapes ; les décisions importantes sont dans `docs/ROADMAP.md`, pas dans la conversation.
- Mode plan sur les étapes risquées : corriger un plan coûte bien moins que défaire du code.
- Ne colle jamais de longs journaux : demande à Claude de résumer les sorties de commandes (c'est écrit dans `CLAUDE.md`).
- Une demande de correction = un seul problème, avec capture + « valeur attendue ». Plusieurs retouches visuelles à la fois : une seule demande groupée.
- Si le quota tombe en cours d'étape : commit en WIP, puis plus tard le prompt « Reprise » de `PROMPTS.md`.
- `/usage` affiche ta consommation et tes limites de forfait.
- Si Sonnet bloque deux fois sur le **même** problème, passe uniquement ce problème à Opus Élevé, puis reviens à Sonnet.

## 6. Rythme réaliste

Une à deux étapes par jour suffisent : le jalon A (étapes 1–6, « ça lance mes apps ») est atteint en quelques sessions, le jalon B (7–9, « ça ressemble à la maquette ») donne la première vraie satisfaction visuelle. Les ambiances sur mesure (étape 17) sont la partie « plaisir » : une par jeu, quand tu veux.

## 7. Choses à savoir

- **Rien n'est encore codé** : le kit contient le cahier des charges, les maquettes et les prompts. Le code commence à l'étape 2.
- Les maquettes HTML servent de **référence de valeurs** (tailles, couleurs, ombres). La version de production remplace les gros flous et le bruit SVG par des équivalents moins coûteux (détaillé dans `docs/DESIGN.md`).
- Le nom « Hub » est un nom de code : changer le nom se fait dans une seule constante (`APP_NAME`).
- Partage aux amis : l'installeur sera non signé (avertissement SmartScreen) ; un certificat de signature Windows est payant, et la clé de signature des mises à jour de Tauri, gratuite, est un autre sujet. Tout est expliqué à l'étape 19.
- Aucune IA dans l'application ; voix, mains et intégrations viennent après la v1.0 (extensions A à D de `PROMPTS.md`).

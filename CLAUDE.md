# Kayro — mémoire du projet

> **Kayro** est le nom définitif (anciennement « Hub », nom de code). Le nom affiché vit dans UNE seule constante (`APP_NAME`, source : `productName`). Restent figés : l'identifiant `fr.yiuno.hub`, le crate Rust `hub`, les extensions `.hubmood` / `.hubscene`. Données : `%APPDATA%/Kayro` (l'ancien `%APPDATA%/Hub` est copié une fois au premier lancement, jamais modifié ni supprimé).

## Vision
Lanceur d'applications pour Windows, très fluide et très réactif, avec un accent fort sur la **personnalisation** et le **visuel** :
thèmes de couleur au choix, verre liquide, lumière dynamique, couleurs qui s'adaptent à l'affiche du jeu, ambiances animées propres à certains jeux (braises, runes, brume…).
Projet privé pour l'instant, à partager plus tard avec des amis. Windows uniquement. Français par défaut.
**Pas de LLM ni d'assistant IA dans l'app.** Une IA locale et légère est permise quand elle est mesurée meilleure que le calcul classique (décision de l'utilisateur, 2026-11-03 : le rythme du mode musique, voir `docs/MODE-MUSIQUE.md`) : elle tourne sur le PC, rien n'est envoyé, et l'app marche sans elle. Tout est local et hors ligne par défaut.

## Règles de travail (à respecter à chaque session)
1. L'utilisateur te donne UNE étape. Ne commence jamais la suivante sans son accord.
2. Lis seulement ce qui sert à l'étape : ce fichier, puis le doc cité (`docs/ARCHITECTURE.md` pour données/modules/perf, `docs/DESIGN.md` pour le visuel et le mouvement, `docs/PLAN.md` pour les choix techniques vérifiés à l'étape 1 — il prime sur ARCHITECTURE.md pour les versions et les API, `docs/ROADMAP.md` pour l'état d'avancement, `docs/MACHINE.md` pour le PC de test). `reference/` contient les maquettes HTML : source de vérité des valeurs CSS (dimensions, couleurs, ombres). Elles ne s'affichent pas seules (il manque leur lanceur) : lis-les comme du code, ne les ouvre pas dans un navigateur. `reference/captures/` contient des captures PNG des maquettes : regarde-les pour juger le rendu.
3. Étape risquée (indiquée par l'utilisateur ou évidente) : propose d'abord un plan court (15 lignes max) et attends sa validation.
4. Économie de tokens : fichiers de moins de 400 lignes (découpe sinon) ; ne relis pas tout le dépôt, cherche avec Grep/Glob ; résume les sorties de commandes (`cargo test -q`, `tsc --noEmit`, `cargo clippy -q`) au lieu de les coller ; regroupe les modifications liées dans un seul passage.
5. Avant d'écrire du code qui dépend d'une API externe (Tauri 2, plugins, crates, API Windows), vérifie la doc ou les versions actuelles. Ne devine pas une signature.
6. Demande avant : installer une dépendance lourde ou globale, changer l'architecture, supprimer des fichiers de l'utilisateur, ajouter du réseau.
7. Ambiguïté de design ou de comportement : pose une question courte plutôt que deviner.
8. Fin d'étape : coche l'étape dans `docs/ROADMAP.md` (+ 1 à 3 lignes : décisions, limites, chiffres), puis rapport de 12 lignes maximum (fait / comment le tester / mesures de perf / limites connues / commit proposé) et stop. Ne fais pas de commit sans que je le demande.
9. Honnêteté des mesures : rapporte les chiffres réels, y compris les mauvais. Ne dis jamais « testé » pour ce que tu n'as pas exécuté ; dis « non testé » et pourquoi.
10. DA gelée le 2026-10-14 : `docs/DESIGN.md` est la référence ; tout changement de DA se note dans `docs/DA-JOURNAL.md` § « Gel de la DA » (à lire au début d'une session qui touche à la DA).
11. Après le gel de la DA, `docs/DESIGN.md` (DA officielle v1) prime sur `reference/`.

## Stack (à confirmer à l'étape 1)
- Tauri 2 (Rust) + React + TypeScript + Vite. Animation d'interface : Framer Motion (`motion`). État : Zustand. Styles : CSS Modules + variables CSS (pas de bibliothèque d'UI lourde).
- Polices embarquées en local (pas de CDN) : Cormorant Garamond (titres), Manrope (interface), via `@fontsource`.
- Rust : `serde`, `tracing`, `sysinfo`, crate `windows` (API Win32), parseur VDF pour Steam. Types partagés Rust ↔ TypeScript générés (`tauri-specta` ou `ts-rs`).
- Tests : `cargo test` (parseurs, moteur de scènes avec faux lanceur), `vitest` (palette, schémas), lint : `clippy`, `eslint`.

## Principes d'architecture (détails : docs/ARCHITECTURE.md)
- **Cœur en Rust, interface « bête »** : lancement, détection, scènes, surveillance des processus, performance, cache d'images vivent côté Rust. React affiche et envoie des commandes.
- **Moteur de scènes à étapes** (actions extensibles) : lancer, attendre un délai, attendre qu'une app soit prête, mettre au premier plan, fermer en douceur. Les futures intégrations (OBS, lumières, Discord) seront de nouveaux types d'actions.
- **Tout ce qui se personnalise est une donnée** : thèmes (`.json`), ambiances de jeu (`.hubmood`), scènes. Déclaratif, validé, sans script.
- **Couche d'effets derrière une interface** (`FxLayer`) : implémentations CSS et Canvas 2D maintenant, WebGL optionnel plus tard. L'interface ne dépend jamais d'une implémentation.
- **Qualité adaptative** : 4 niveaux (Éco, Équilibré, Élevé, Ultra) + repli automatique sûr.
- Données utilisateur dans `%APPDATA%/<AppName>/`, séparées du programme, JSON versionné (`schemaVersion`) avec migrations et écritures atomiques.

## Performance (prioritaire, non négociable)
- Animations basées sur le temps réel (delta time / `requestAnimationFrame`), jamais sur un nombre d'images fixe : suivre 60/120/144 Hz+.
- Animer `transform` et `opacity`. **Pas de `filter: blur()` sur de grandes surfaces** (voir DESIGN.md pour les équivalents en dégradés). `backdrop-filter` limité à 6 surfaces simultanées maximum. `will-change` seulement si mesuré utile.
- Veille douce : hub masqué, sans focus ou jeu au premier plan → fondu des effets puis arrêt complet des boucles, du micro et de la caméra. Au retour : reprise en fondu. Aucun timer qui tourne dans le vide.
- Le travail lourd (scan d'apps, extraction de palette, images, voix, vision) ne bloque JAMAIS le thread d'interface.
- Cibles à mesurer et à rapporter à chaque étape pertinente : apparition du hub < 150 ms sur raccourci (fenêtre déjà chargée), CPU au repos < 1 %, GPU à 0 % hub masqué, aucune image perdue en navigation normale.

## Sécurité et vie privée
- L'app ne lance QUE ce qui est dans sa configuration. La voix, les gestes et les fichiers importés ne peuvent jamais lancer une commande arbitraire.
- Scènes partagées : le fichier ne contient que des noms d'**emplacements** (slots), jamais de chemin ni de commande.
- Fichiers importés (`.hubmood`, thèmes, scènes) : validation stricte de schéma, limites de taille et de quantité, aucun script, chemins SVG assainis.
- Fermer une app = fermeture douce (message de fermeture de fenêtre) avec confirmation. Jamais de fermeture forcée sans demande explicite.
- Réseau : aucun par défaut. Toute fonction réseau future est optionnelle, désactivée par défaut et expliquée.
- Micro et caméra : traitement 100 % local, indicateur visible quand actifs, jamais en permanence.
- Permissions Tauri minimales (liste blanche), CSP stricte. Les images d'affiches viennent du dossier local de l'utilisateur : ne jamais les embarquer dans l'installeur ni les exporter dans un fichier partageable.

## Conventions
- Identifiants et commentaires de code en anglais, textes visibles en français via un catalogue de messages (prêt pour d'autres langues).
- Commits : `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`. Une branche par étape (`step-05-detection`), tag `v0.x` quand l'étape est validée.
- Logs : `tracing`, fichier tournant dans AppData, bouton « Exporter les logs » (pour les retours de tes amis plus tard).
- Accessibilité : contraste du texte ≥ 4,5:1, navigation complète au clavier, focus visible, respect de `prefers-reduced-motion`.

## Extensions prévues avant la v1.0 (décision du 2026-11-02)
Voix (étape 21), contrôle par les mains (22), intégrations OBS, Discord, lumières (23), moteur WebGL (24), puis l'audit final (18) et la v1.0 (`docs/ROADMAP.md`). Chacune seulement quand l'utilisateur donne son étape ; les règles de sécurité et de vie privée ci-dessus restent vraies (traitement local, ne lance que ce qui est configuré, indicateur visible ; l'exception « écoute permanente » de la voix se note dans ce fichier à l'étape 21).

## Hors périmètre pour l'instant (ne pas coder sans demande)
Salon d'amis, assistant IA (projet séparé de l'écosystème Kayro, voir `docs/ROADMAP.md` : Kayro reste sans assistant IA). Prévoir les points d'extension, sans implémenter.

**Moteur graphique (WebGL2 / shaders) : autorisé par l'utilisateur (étape 12b).** Toujours derrière `FxLayer`, avec repli CSS automatique (WebGL2 absent, contexte perdu, budget d'image dépassé) et coût mesuré.

## Notes et outils
- La doc est dans `docs/`, ouverte dans Obsidian ; `docs/Accueil.md` est l'index (avec l'encadré « Où on en est »).
- Une note par sujet : mettre à jour plutôt que dupliquer. Jamais de seconde liste « Plus tard » (celle de `docs/ROADMAP.md`) ni de second journal (`docs/DA-JOURNAL.md`).
- Ne lire que les notes utiles à l'étape en cours.
- Ne jamais supprimer une idée sans me demander : la déplacer dans « Abandonné » (`docs/ROADMAP.md`).
- Avant d'utiliser une API Tauri 2 ou React dont tu n'es pas sûr, vérifier avec Context7.
- Raccourcis : `/idee <texte>` (note une idée dans `docs/Idees.md`), `/fin` (range les idées, met à jour les notes, propose un commit).
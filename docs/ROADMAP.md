# Feuille de route

Une case cochée = étape validée par l'utilisateur et taguée. À la fin de chaque étape : coche la case et ajoute 1 à 3 lignes (décisions prises, limites connues, chiffres de perf). Ce fichier sert à reprendre une session sans tout relire.

| N° | Étape | Dépend de | Jalon |
|---|---|---|---|
| [x] 1 | Cadrage et plan technique (`docs/PLAN.md`) | — | A |
| [x] 2 | Squelette Tauri/React + instance unique + 4 spikes de fenêtres | 1 | A |
| [x] 3 | Design system : tokens, 5 thèmes, composants verre, catalogue | 2 | A |
| [x] 4 | Données, config versionnée, IPC typé, i18n | 2 | A |
| [x] 5 | Détection Steam / Epic / Menu Démarrer | 4 | A |
| [x] 6 | Lanceur unique + suivi des processus | 4 | A |
| [x] 7 | Accueil : titre, carrousel, onglets, Ctrl+K, grille | 3, 4, 6 | B |
| [x] 8 | Atmosphère dynamique (`FxLayer`, CSS + Canvas 2D) | 7 | B |
| [x] 9 | Ajout/édition d'apps, glisser-déposer, icônes | 5, 6, 7 | B |
| [x] 10 | Moteur de scènes (Rust) | 6 | C |
| [x] 11 | Éditeur de scènes (modes simple et avancé), dock, import/export `.hubscene` | 7, 10 | C |
| [x] 12 | Modes immersif/fenêtre/widget, raccourci, tray | 2, 7 | C |
| [x] 12b | Atelier de direction artistique (DA officielle v1), itératif, fini quand je dis « je fige la DA » | 8, 12 | C |
| [x] 13 | Performance : états, qualité adaptative, benchmark, réglages, sans échec | 6, 8, 12 | D |
| [x] 14 | Couleurs du jeu : art local, palette OKLab, modes | 5, 8 | E |
| [x] P | Prétest : installeur NSIS, « Exporter les logs », version visible, note `docs/PRETEST.md` | 14 | F |
| [x] 15 | Réglages · Apparence : thèmes, import/export, « suivre le soleil » | 3, 14 | E |
| [x] 16 | Moteur `.hubmood`, 6 packs, écran « Ambiance du jeu » | 8, 14 | E |
| [x] 17 | Ambiances sur mesure (une par jeu « pépite ») | 16 | E |
| [x] 17b | Sound design : moteur Web Audio, manifeste `sons.json`, réglages des sons, à définir à l'étape 17b, `docs/SONS.md` | 12b, 13 | E |
| [x] 18b | Mises à jour : rechercher et installer une nouvelle version depuis Kayro (réseau optionnel, voir « Plus tard ») | 18, installeur maison | F |
| [x] 19 | Installeur NSIS, assistant de premier lancement, doc pour les amis ; **démarrage** : choix des apps lancées avec Windows à l'installation, démarrage express sur le logo (voir « Plus tard ») | 18 | F |
| [x] 19b | **Scan intelligent et rangement fluide** (demandé le 2026-10-30) : un scan bien plus malin (filtres de bruit, doublons, lanceurs et outils à part, catégorie devinée, « Ignorer ») et plus simple à l'ajout d'apps ; changer une app de catégorie (et la réordonner) de façon fluide. Détails : « Plus tard » › Détection | 5, 19 | G |
| [x] 19c | **Finitions ajout et rangement** (2026-10-30) : scan avancé du PC, logos ronds, cartes aux couleurs du logo, renommer sur la carte, clic droit rangé, fil physique | 19b | G |
| [x] 20 | **Kysland** : le widget façon Dynamic Island (voir « Plus tard ») | 12, 19 | G |
| [x] 21 | **Voix** (extension A) : écoute active (mot d'éveil) ou push-to-talk, très bonne en français, 100 % locale (voir « Plus tard ») | 6, 10, 20 | H |
| [x] 22 | **Mains** (extension B) : gestes à la webcam, traitement local | 21 | H |
| [ ] 24 | **Moteur WebGL** (extension D) : suite du moteur graphique de l'étape 12b, derrière `FxLayer` | 8, 12b | H |
| [ ] 18 | **Audit final, juste avant la v1.0** (reporté à la fin le 2026-11-02 : l'app change encore) : perf, sécurité **et cybersécurité (test d'intrusion de Kayro)**, robustesse, accessibilité | 1–24 | I |

**DA gelée le 2026-10-14** : référence `docs/DESIGN.md` (DA officielle v1) ; tout changement après le gel est noté dans `docs/DA-JOURNAL.md` § « Gel de la DA ».

**Extensions avant la v1.0** (décision du 2026-11-02 : les amis testent l'app pendant ce temps) : A voix FR (21) · B mains, webcam (22) · D moteur WebGL (24). Puis l'audit final (18), puis la v1.0. L'extension C (intégrations OBS, Discord, lumières, ex-étape 23) sort de la route de la v1.0 le 2026-11-06 (« on le verra peut-être plus tard ») : voir « Plus tard » › Intégrations.

## Journal des étapes
(Une entrée par étape terminée : date, décisions, limites, chiffres.)
- **Étape 1 — 2026-10-09** : `docs/PLAN.md` écrit (versions vérifiées sur crates.io/npm/doc officielle : Tauri 2.12, tauri-specta =2.0.0-rc.25 épinglé avec ts-rs en plan B, TypeScript 6.0.3 car typescript-eslint exige < 6.1). Instance unique avancée de l'étape 12 à l'étape 2 ; 13 dépend aussi de 6. Constats sur ce PC : cache Steam en 2 formats (affiche parfois en 300×450), compteurs GPU par PID présents, aucun jeu Epic installé. Spikes : aucun encore exécuté. Les 8 questions du §6 ont été tranchées le jour même (widget Brume, Ctrl+Alt+Espace, canvas à 144 Hz, `fr.yiuno.hub`).
- **Étape 2 — 2026-10-09** : squelette Tauri 2.12 + React 19 + TS 6 (lint, tests, clippy OK ; `tauri build --no-bundle` OK, hub.exe 10,6 Mo ; hub.exe ≈ 43 Mo de RAM) et 5 spikes dans `spikes/`. Chiffres : affichage par raccourci p95 31 ms (budget 150), focus 20/20 ; tray à 45 ms et image à 0,8 s après CreateProcess (+0,65 s par ShellExecute) ; verre à 278 Hz : p95 3,7 ms, GPU 9 %, mais **CPU 8 % > budget 4 %**. Décisions : widget en CSS (acrylic/mica = rectangle), immersif en `set_position/size` + `shadow(false)` + `alwaysOnTop` temporaire (pas de `set_fullscreen`), fenêtre créée après l'icône. Alertes : WebView2 ne suspend pas la fenêtre cachée (rAF 280/s) ; rAF 278 Hz même sur l'écran 144 Hz ; Ctrl+Alt+Espace déjà pris sur ce PC. Non testé (→ étapes 12-13) : Windows 10, échelles 125/150 %, 60 Hz, Alt+Tab réel.
  - Décisions de clôture (2026-10-09) : raccourci par défaut **Ctrl+Alt+H** (libre sur ce PC) ; budget CPU visible **< 4 % Équilibré, < 8 % Élevé/Ultra**, à remesurer à l'étape 8.
- **Étape 3 — 2026-10-09** : `src/design/` (tokens CSS, 5 thèmes JSON + `parseTheme` strict, `ThemeProvider` avec fondu 0,9 s via `@property`, `Surface` verre + budget de 6 `backdrop-filter`, 9 composants, `Backdrop` dégradé/brume statique/vignette/grain 256 px), `scripts/make-noise.mjs` (PNG identique à chaque exécution), `/dev/catalogue` (dev seulement, absent du bundle de production). Polices : `@fontsource-variable/fraunces/opsz.css` contient bien l'axe `opsz` (point « à vérifier » de PLAN.md levé). **Écarts assumés avec DESIGN.md** pour tenir 4,5:1 : texte secondaire/tertiaire .75/.70 → .88/.84, voiles blancs des boutons/puces .14–.24 → .10–.18, teinte fumée `rgba(12,8,20,.30)` sous le verre, item de menu actif sur puits sombre (le pêche sur voile blanc donnait 2,5:1). Avec les valeurs exactes des maquettes, le texte secondaire sur verre tombait à 2,2–3,2:1. Contraste : 90 couples (18 × 5 thèmes) ≥ 4,5:1, pire cas 4,71:1 (Aurore boréale, texte actif sur puce choisie) ; modèle pessimiste mais le coin haut-gauche du verre (blanc .20) n'est pas couvert. Un test vérifie que `tokens.css` et le modèle ne divergent pas. Limites : Dialog sans animation de sortie, `Ultra` = `Élevé` tant que l'étape 13 n'existe pas, brume statique (animée à l'étape 8), aucun test de composant (pas de jsdom installé), fondu de thème et piège de focus vérifiés dans le navigateur du Code seulement (pas dans la fenêtre Tauri).
- **Étape 4 — 2026-10-09** : `src-tauri/src/config/` (écriture atomique tmp→rename, migrations v→v+1 sur JSON brut avec `.bak`, chargement **tolérant** pour `settings/apps/slots` : champ inconnu ignoré + log, champ invalide → défaut, entrée d'app invalide → `apps.json.rejected` seule ; **strict** pour thèmes/scènes importés ; fichier illisible, vide ou `schemaVersion` futur → `.corrupt[.N]` + défauts, jamais de plantage ; BOM UTF-8 accepté). IPC typé par **tauri-specta =2.0.0-rc.25** (compile avec Tauri 2.12.2, pas de plan B) : `apps_list/add/update/remove`, `settings_get/set`, événements `apps-changed` / `settings-changed`, `npm run gen:types` + test de dérive de `src/ipc/bindings.ts`. TS : `ipc/` (résultats explicites), store Zustand optimiste avec retour arrière, `i18n/fr.json` + `t()` typée, règle ESLint contre le texte en dur dans `src/**/*.tsx` (hors `src/dev`). Chiffres : 45 tests Rust + 141 vitest verts, clippy/eslint/tsc propres ; chargement de la config au démarrage 0,8 ms (fichiers absents) à 12,8 ms (avec écriture de `.rejected`) ; bundle JS 232 ko (73 ko gzip) avec zustand.
  - Limites : `apps_add/update/remove` non testés dans la vraie fenêtre (testés sur `ConfigState`, pas via le pont IPC ; lecture + thème + compteur vérifiés dans la fenêtre Tauri) ; émission des événements non testée automatiquement ; `.corrupt` et `.rejected` non purgés (rejected plafonné à 200) ; slots/scènes/thèmes chargés mais sans commandes IPC (étapes 9–11, 15) ; `build.rs` embarque un manifeste Windows commun (sinon les tests unitaires ne démarrent pas : STATUS_ENTRYPOINT_NOT_FOUND).
- **Étape 5 — 2026-10-09** : `src-tauri/src/detect/` (trait `DetectSource`, sources `steam`, `epic`, `startmenu`, filtres, orchestrateur `scan`), IPC `detect_scan` (async, hors thread UI, un scan à la fois, annulable) + `detect_cancel` + événement `detect-progress`, client TS `detect` / `onDetectProgress`. Le scan ne fait que *proposer* (`DetectedApp`, `alreadyAdded` comparé à `apps.json`) ; l'ajout reste l'étape 9. Steam : registre + `libraryfolders.vdf` + `appmanifest_*.acf`, affiches lues en place dans `librarycache` (deux dispositions, rien copié). Epic : manifestes `*.item`. Menu Démarrer : `.lnk` utilisateur + commun via `IShellLinkW`, lancement du `.lnk` lui-même. Dépendances ajoutées : `keyvalues-parser` 0.2.4, `windows` 0.62.2. UWP non détectées (décision).
  - Chiffres (build debug, ce PC, 3 passages) : scan complet 275–395 ms (Steam 22–41 ms, Menu Démarrer 282–394 ms, Epic 0 ms) ; 10 jeux Steam trouvés (11 manifestes − redistribuables), 96 raccourcis proposés, 107 écartés. 74 tests Rust (+ 1 test manuel ignoré : scan réel), 141 vitest, clippy/eslint/tsc propres.
  - Limites : **Epic non testé sur de vrais fichiers** (aucun jeu Epic installé : fixtures d'après le format documenté par la communauté ; l'URI `com.epicgames.launcher://apps/<AppName>?action=launch&silent=true` n'a pas pu être vérifiée ici, à confirmer à l'étape 6) ; raccourcis MSI « annoncés » sans cible et apps UWP non vus ; outils Windows (`C:\Windows\…`) volontairement écartés ; quelques faux positifs du Menu Démarrer restent (ex. « Python Module Docs », « Report a Problem with Unity »). `detect_scan` non appelé depuis la vraie fenêtre Tauri (testé via les sources et l'orchestrateur, pas via le pont IPC).
- **Étape 6 — 2026-10-09** : `launcher/` (trait `Launcher`, `SystemLauncher`, `FakeLauncher` de test, `launch_app` = seul chemin de lancement, revalide l'entrée avant tout), `procwatch/` (un thread, `recv_timeout`, rythme Actif 750 ms / Repos 2 s / Pause sans timer, événements aux changements seulement, `SetWinEventHook` sur un thread dédié + lecture du premier plan à chaque passe en repli), `platform/` (Win32 `unsafe` isolé). IPC : `app_launch`, `app_focus`, `apps_running`, événement `app-state-changed` ; erreurs typées `launchNotFound/launchDenied/elevationRequired/elevationCancelled/launchFailed` (+ textes FR). Côté interface : enveloppes, tranche `running` du store, page dev `/dev/launcher` (`npm run dev:launcher`). Dépendance ajoutée : `sysinfo` 0.39.6 (feature `system` seule).
  - Décisions : app déjà ouverte → mise au premier plan (sinon lancement normal, p. ex. app dans la zone de notification) ; exe non marqué admin → `CreateProcessW` (une app qui exige l'admin échoue en 740 sans UAC), `runas` seulement si `elevated: true` (écart assumé avec « via ShellExecuteEx » pour les exe) ; `.lnk`/`steam://`/`https://` via `ShellExecuteExW`. Spike (e) : voir PLAN.md §(e).
  - Chiffres (release, ce PC, 30 apps suivies, fenêtre visible, 60 s) : hub.exe **0,047 % de la machine** (12 threads, soit ≈ 0,56 % d'un cœur), arbre WebView2 compris 0,080 % ; une passe procwatch coûte en moyenne **12,8 ms** (100 passes, toutes les 2 s) : correct mais améliorable (Toolhelp au lieu de `sysinfo`) si besoin à l'étape 13. 96 tests Rust (+ 2 ignorés), 146 vitest, clippy/eslint/tsc propres.
  - Lancements essayés (via `spike_launch`, hors fenêtre Tauri) : exe, UWP (Calculatrice), `steam://open/main`, lien web, `.lnk`, chemin cassé (→ `NotFound`), exe admin sans config (→ `ElevationRequired`), premier plan + `WM_CLOSE` sur une fenêtre non élevée (`winver`) : OK. **Non testé** : jeu Steam/Epic réel (aucun jeu Epic installé), `runas` + UAC, premier plan/`WM_CLOSE` vers une fenêtre élevée, page `/dev/launcher` dans la fenêtre Tauri, Windows 10.
  - Limites : les apps `lnk`/`uri`/`uwp`/`url` sans `match.exe` (dont tous les jeux Steam détectés) ne sont pas suivies (absentes de `apps_running`) ; un protocole non installé n'est pas détecté (succès sans PID) ; la fenêtre d'une app UWP appartient à `ApplicationFrameHost`, donc premier plan/focus non fiables pour elles ; plein écran (spike c) → étape 13, fermeture douce `WM_CLOSE` + confirmation → étape 10 (`platform::window::post_close` existe déjà).
- **Étape 7 — 2026-10-09** : `src/features/home/` (barre en verre, titre animé, carrousel 5 visibles + vue grille, onglets, dock factice, palette Ctrl+K, état vide, notification d'erreur de lancement), `features/add-app/` (dialogue factice), page dev `/dev/home` (+ `npm run dev:home`, mesure intégrée). Dépendance ajoutée : `motion` 14.0.0 (bundle JS 232 → 339 ko, 73 → 110 ko gzip, avec `LazyMotion`/`m`). Clavier : flèches, Home/End, PageUp/PageDown (catégorie), Entrée, Échap, Ctrl+K ; liste = un seul arrêt de tabulation (`aria-activedescendant`, aucun `focus()` par touche). Clic sur une carte latérale = la sélectionner, clic sur la carte active = lancer (écart avec « clic = lancer » : à valider).
  - **Écarts assumés** : cartes 232×328 / 172×243 (maquette 324 / 246) car animées par `scale` seul ; dimming par voile (`opacity` de groupe sur chaque carte faisait saccader le défilement) ; plaque de nom sans `backdrop-filter` ; reflet toutes les 6 s mais balayage de 1,4 s (maquette 2,7 s) et lancé par un minuteur, pas par une animation CSS `infinite` (celle-ci coûtait 17 % d'un cœur au repos) ; pendant un défilement rapide (touche maintenue) seuls les glissements sont animés. Affiches : `art.ts` renvoie `null` tant que le protocole de fichiers n'est pas ouvert (étape 9) → monogramme partout, **affiche non testée**.
  - **Bug trouvé (étape 3)** : en build de production, le minifieur CSS fusionnait `backdrop-filter` et `-webkit-backdrop-filter` dans la seule forme préfixée, que Chromium ignore → plus aucun flou. Corrigé en retirant la ligne préfixée de `Surface.module.css`.
  - **Mesures** (vraie fenêtre Tauri/WebView2 154, 60 apps, React de production, PC de test à 279 Hz ; `npm run dev:home` + CDP) : repos 0,6 % de la machine (0,10 % sans le reflet), 3,6 ms/image au repos, 0,3 % d'images > 25 ms ; défilement touche maintenue 30/s : p50 7–8 ms, p95 27–65 ms, 6–19 % d'images > 25 ms ; frappes à 6/s : 4–8 %. **Cible « aucune image > 25 ms » non atteinte** en rafale ; référence sur ce PC : une page vide 2–3 %, 7 cartes à dégradé déplacées par `transform` seul 2–7 %. Non mesuré : GPU, 60 Hz, Windows 10, échelles 125/150 %.
- **Étape 8 — 2026-10-10** : `src/fx/` (interface `FxLayer`, composite `createFx` avec fondu 400 ms et vraie pause, boucle unique `loop.ts` à delta réel et plafond sur une grille commune, `budget.ts`, couche CSS brume/lueur basse/faisceau/halo, couche Canvas 2D poussière en `Float32Array` + rectangles sales, `<Atmosphere />`, `useFxTarget`). Réglage `atmosphereIntensity` (0,3–1, défaut 1) ajouté à settings.json (chargement tolérant, pas de migration). Pause branchée sur `visibilitychange` seulement (veille complète → étape 13). **Écarts** : brume statique en Éco (au lieu de « non ») ; dérive et balancement écrits par la boucle et non en keyframes CSS ; toutes les couches continues à **60 images/s** (Éco 30) au lieu de « natif / 144 » (PLAN.md §6.4) ; `screen` sur le groupe faisceau+halo (2 couches en mélange avec le grain).
  - **Mesures** (vraie fenêtre WebView2 2560×1440, React de production, CDP, 10 s rAF + 15 s CPU/GPU de l'arbre) — à 279 Hz : Éco/Équilibré p95 3,7 ms, CPU 1,1 %, GPU 0,5 % ; Élevé/Ultra p95 3,7 ms, 0 image perdue, CPU 3,8–3,9 %, GPU 3,5 % ; en pause CPU 1,1 %, GPU 0,4 % ; défilement Élevé 6 images perdues sur 2 788 (max 21 ms). À 60 Hz (écran principal passé à 60 Hz) : tout à 16,7/16,8 ms, 0 perdue ; Élevé CPU 2,7 %, GPU 3,2 % ; pause 0,3 % / 0,1 %. **Première version (keyframes CSS à 279 Hz) rejetée** : Élevé CPU 9,7 %, GPU 11 %, p95 7,1 ms et ~200 images perdues ; le balancement seul coûtait 6,9 % CPU. Cadence 144/s : 7,3 % CPU ; 30/s : 2,9 %.
  - Limites : rAF suit l'écran principal (281/s même sur l'écran à 60 Hz) ; à 60/s, le mouvement lent fait des pas de 0,3–0,5 px sur un écran à 279 Hz (à juger à l'œil) ; GPU = moteurs 3D via « GPU Engine » ; composition non agrandie en 2560×1440 (étape 12) ; faisceau à la couleur du thème (la capture 01 le teinte avec la couleur du jeu, étape 14) ; banc de mesure gardé hors dépôt.
- **Étape 9 — 2026-10-10** : dialogue « Ajouter des applications » (`src/features/add-app/` : Détectées avec filtres par source, catégorie suggérée par app, « Tout sélectionner » et « Tout ajouter » ; Glisser-déposer via l'événement Tauri + champ « coller un lien ou un chemin » ; Manuel), édition/retrait (bouton crayon sur la carte, clic droit / touche Menu / Maj+F10, F2), changement de catégorie en glissant une carte sur un onglet (événements pointeur : le dépôt de fichiers Tauri désactive le glisser-déposer HTML5 sous Windows). Cœur : `apps_add_many` (une seule écriture, refus signalés par position), `apps_inspect` (exe, lnk, http(s) ; lecture seule, 50 éléments max), `app_icon` (icône Shell 256 px réduite à 128 px, PNG en cache `cache/icons/`, envoyée en `data:` URL : pas de protocole de fichiers ouvert), `detect/category.rs` (suggestion par mots entiers), doublon = même cible (casse et `/` ignorés, arguments comptés) ou même app Steam/Epic, aussi à l'édition. Dépendance : `png` 0.18.1 (déjà dans l'arbre via Tauri) ; capacité `core:event:allow-listen/unlisten` ajoutée. Validation : mêmes règles côté TS (messages FR par champ, `validation.ts`) et côté Rust, qui décide.
  - **Mesures** (vraie fenêtre Tauri, données dans un dossier temporaire, ce PC) : scan vu depuis le dialogue 256 ms (73 apps : 10 Steam + 63 Menu Démarrer), 1,96 s à froid ; **73 apps ajoutées en un clic : 141 ms** ; extraction d'icône ≈ 100 ms par app à froid (12 en 1,2 s), instantanée ensuite. 123 tests Rust (nouveaux : doublons, `add_apps`, catégories, `inspect`, icônes, base64, icône réelle de notepad), 202 vitest (nouveaux : validation, brouillon, store), clippy/eslint/tsc propres, bundle JS 339 → 382 ko (123 ko gzip).
  - **Bug trouvé et corrigé** : en développement (StrictMode), `detect_cancel` doublait `detect_scan` et annulait le second scan → liste vide ; l'annulation est maintenant différée et un rapport « annulé » est redemandé.
  - Limites : **non testé** : dépôt réel d'un fichier depuis l'Explorateur (seul le chemin collé l'est ; l'événement natif n'a pas pu être simulé), URL glissée depuis un navigateur (Tauri ne transmet que des chemins : on colle le lien), `lnk` collé dont la cible est résolue (testé avec un faux résolveur), Windows 10, `runas` d'une app ajoutée à la main ; pas de bouton « Parcourir » (il faudrait le plugin dialog) ; icône seulement pour exe/lnk (liens, protocoles, UWP : monogramme) ; affiches Steam toujours non affichées (étape 14) ; la liste « Non ajoutés » ne garde que le dernier dépôt ; icônes mises en cache sans purge des apps retirées hors `apps_remove`.
- **Étape 10 — 2026-10-10** : `src-tauri/src/scenes/` (trait `Action` + 5 actions `launch`/`wait`/`waitReady`/`focus`/`close`, `exec` = machine d'état par étape, `clock` = horloge réelle ou simulée + `CancelToken`, `runner` = une scène à la fois sur son thread), `config/scene.rs` (étapes typées, fichier strict), `ipc_scenes.rs` (`scenes_list/save`, `slots_get/set`, `scene_run → runId`, `scene_cancel`, événement `scene_progress`), `ErrorCode::Busy`, journal `tracing` par étape et par run.
  - Décisions : exécuteur **synchrone sur un thread dédié** (pas de tokio) ; un échec n'arrête la scène que si l'étape est `required` ; slot non relié (ou app supprimée) → étape ignorée et signalée, même `required` ; `close` = `WM_CLOSE` seulement si `closeConfirmed: true` (sinon `confirmationRequired`), n’attend pas la fermeture, jamais de kill ; `slots_get/set` ajoutés (absents de l'IPC prévue) pour pouvoir relier des apps avant l'éditeur (étape 11).
  - Mesures : `cargo test` 136 OK (10 pour les scènes, dont annulation d'une attente de 10 min sur l'horloge **réelle** < 200 ms), clippy et `tsc` propres. **Non testé** : scène de 5 étapes sur de vraies apps et gel de l'interface (aucune UI de scène avant l'étape 11).
  - Limites : `waitReady`/`focus`/`close` sur une app non suivie (lnk/uri/Steam sans `match.exe`) → étape ignorée (`notFollowable`) au lieu d'attendre ; « prêt » = un processus de l'app existe (pas encore la fenêtre) ; `launch` bloqué par une invite UAC n'est annulable qu'après l'invite ; `scenes_delete`, raccourcis de scène, confirmation côté UI → étape 11.
- **Étape 11 — 2026-10-10** : `src/features/scenes/` (liste des scènes, éditeur, import), `src/store/sceneStore.ts` (scènes, slots, progression), dock réel dans `features/home/SceneDock.tsx`. Cœur : `config/share.rs` (format `.hubscene` : `format`, `schemaVersion`, `name`, `slots` = noms seulement, `steps` ; pas d'id, pas de raccourci, pas de chemin), `config/scene_ops.rs` (suppression, aperçu et import qui ne remplace jamais une scène), IPC `scenes_delete/new_id`, `scene_export` (écrit `exports/<id>.hubscene` sans écraser, l'affiche dans l'Explorateur), `scene_import_preview/import`.
  - **Deux modes** : *simple* (par défaut) = glisser des apps dans « Ma scène » (pointeur + clavier : Entrée pour ajouter, flèches sur la poignée pour déplacer), réglage « lancer puis attendre qu'elle soit prête » / « lancer seulement » par app, « l'une après l'autre » / « en même temps » global ; les étapes sont **générées** (`simple.ts`) : app suivie → `waitReady` 30 s ; non suivie → `wait` de 2 s, 8 s pour un lanceur lourd (Steam, Epic, Battle.net, GOG, Riot, Ubisoft, EA, Unity Hub…) ; pas d'attente d'un lanceur quand l'app suivante est l'un de ses jeux en `steam://` / `com.epicgames.launcher://` ; pas de `wait` après le tout dernier lancement ; app déjà ouverte = le `launch` la met au premier plan (le moteur le fait déjà). *Avancé* = la maquette (étapes numérotées, palette, emplacements, glisser-déposer + flèches, détails par étape). Simple → avancé sans perte (les étapes générées deviennent normales) ; avancé → simple seulement si regénérer donne exactement les mêmes étapes, sinon message. Une scène enregistrée s'ouvre en simple quand c'est le cas.
  - Décisions : slot = id d'app en mode simple (ou le slot déjà relié à l'app) ; en avancé le nom d'emplacement est un id (« Plateforme jeux » est son affichage, les accents sont perdus) ; « Tester » enregistre puis lance ; `close` : liste des apps + confirmation avant le lancement (dock, liste, éditeur) ; raccourci : champ « appuie sur les touches » (Ctrl/Alt/Maj + lettre/chiffre/F), stocké seulement (enregistrement global → étape 12), conflit signalé ; supprimer un emplacement supprime ses étapes et son lien (sauf s'il sert à une autre scène) ; import = glisser le fichier ou coller son chemin (pas de plugin dialog), écran de liaison des slots (pré-rempli si le slot est déjà relié), import possible avec des slots non reliés (avertissement). Aucune dépendance ajoutée.
  - Mesures : 157 tests Rust (nouveaux : fichiers `.hubscene` hostiles — chemin, commande, champ inconnu, nom/champ géant, trop d'étapes/slots, fichier > 256 Kio, JSON imbriqué 100 000 niveaux, BOM ; suppression, id, import/liaison, aucune écriture si refus), 248 vitest (nouveaux : génération simple — suivie / non suivie / Steam / déjà ouverte / ensemble vs l'une après l'autre, conversion simple ↔ avancé, brouillon, store, progression, zone de dépôt, raccourci), clippy/eslint/tsc propres. Vérifié dans le navigateur du Code (`/dev/scenes`, données factices, glisser-déposer réel par pointeur, test avec progression, refus du retour en simple, confirmation de fermeture, dock).
  - Limites : **non testé dans la vraie fenêtre Tauri** (IPC des scènes, export + Explorateur, dépôt de fichier `.hubscene`, scène de 5 étapes sur de vraies apps) ; critères « < 1 min » et « < 30 s » non chronométrés par un humain ; le carrousel de l'accueil n'est pas visible pendant l'édition (le glisser se fait depuis la liste « Mes apps ») ; pas de bouton « Parcourir » ; pas de réglage de séquence par app (global seulement) ; pas de renommage d'emplacement ; mesure des temps de démarrage réels (`launchTimings.json`) non faite → finitions.
- **Étape 12 — 2026-10-11** : `src-tauri/src/desktop/` (`mod.rs` états et affichage, `windows.rs` construction par mode, `geometry.rs` géométrie pure, `placement.rs`, `hotkeys.rs`, `shortcuts.rs`, `tray.rs` déplacé + menu Ouvrir / Mode / Scènes / Quitter), `platform/{own_window,startup}.rs`, `config/ui_state.rs` (`state.json` : placement par mode + 8 récents), `ipc_desktop.rs`. Plugins ajoutés : `tauri-plugin-global-shortcut` =2.4.0, `tauri-plugin-autostart` 2.7.0. Réglages ajoutés (chargement tolérant, sans migration) : `displayMode` (défaut immersif), `widgetStyle` (défaut brume), `hideOnEscape` (oui), `hideOnBlur` (non), `economyMode` (non). Interface : `features/widget/` (4 styles provisoires en variables `--w-*`, panneau déplié), `features/settings/DisplaySettings.tsx` (bouton engrenage de la barre du haut), `store/desktopStore.ts`.
  - **Décisions** : 2 fenêtres seulement (`main` pour immersif et fenêtre, reconfigurée sur place ; `widget` transparente, page `?w=widget`) ; vers/depuis le widget, la nouvelle fenêtre est montrée une fois peinte puis l'ancienne détruite ; toutes les fenêtres sont créées en Rust, après l'icône ; la croix et Échap (option) cachent, seul « Quitter » du menu quitte ; économe = fenêtre détruite au masquage (`RunEvent::ExitRequested` sans code est bloqué) ; zoom `clamp(hauteur/760, 1, 1,5)` en immersif ; widget placé à y = 12 px, seul l'x est mémorisé, taille = contenu (`widget_fit`, centre conservé) ; raccourci de scène : lancement direct, sauf scène avec `close` → fenêtre + confirmation ; bouton micro du widget omis ; Échap plie le panneau puis cache, perdre le focus plie le panneau. **Pièges trouvés** : (1) tao réécrit le style étendu à chaque `show` et remet `WS_EX_APPWINDOW` → le style `WS_EX_TOOLWINDOW` du widget est réappliqué après chaque affichage (sinon il reste dans Alt+Tab) ; (2) une commande **synchrone** qui construit une fenêtre bloque (`settings_set`, `window_hide`, `app_ready` sont `async`) ; (3) en économe la fenêtre est montrée ~600 ms après l'appui, Windows refuse le focus : `AttachThreadInput` puis tap Alt en secours (`force_foreground`) ; (4) le plugin autostart laisse une marque dans `StartupApproved\Run` à la désactivation : nettoyée par `forget_startup_approval`.
  - **Mesures** (release, ce PC, `scripts/measure-show.ps1`, 20 essais, raccourci → page peinte 2 images après) : Instantané fenêtre médiane 21 ms (pire 32), immersif 29 ms (pire 47), widget 19 ms (pire 22), focus 20/20 ; **économe 677 ms (pire 698)** dont 400–430 ms pour construire la fenêtre WebView2 et ~230 ms de chargement : la cible « ~400 ms » n'est **pas atteinte**. Une dernière série faite pendant qu'un jeu volait le focus donne 32–35 ms (pire 52). CPU masqué (Instantané) 0,69 % de la machine, visible 0,7–1,0 % ; RAM : arbre masqué 224–253 Mo en Instantané, **13 Mo en économe** (1 seul processus), arbre visible 254–323 Mo (budget PLAN §5 : 250 Mo, légèrement dépassé). Essai écarté : `SetIsVisible(false)` du contrôleur WebView2 au masquage ramène le CPU masqué à 0,07 % mais l'affichage passe à 62 ms avec des images blanches → à reprendre proprement à l'étape 13 (reprise en fondu). Widget : hors Alt+Tab et hors barre des tâches (style lu sur la vraie fenêtre : `WS_EX_TOOLWINDOW`, pas `WS_EX_APPWINDOW`, `topmost`) ; 2 écrans : position et écran retrouvés après redémarrage ; clavier/raccourci : conflit simulé avec un autre programme qui possède Ctrl+Alt+H → statut `conflict` + message ; démarrage avec Windows : clé `Run` = `"…\Kayro.exe" --silent` puis supprimée, `StartupApproved\Run` revenue à l'état d'origine. 173 tests Rust (nouveaux : géométrie ×7, raccourcis ×4, `state.json` ×3, réglages ×2), 256 vitest, clippy/eslint/tsc propres.
  - **Non testé** : Windows 10, échelles 125/150 % (géométrie testée à 150 % en tests unitaires seulement), clic réel sur le menu de la zone de notification (construction sans erreur, mais non cliqué), déplacement du widget à la souris (déplacé par `SetWindowPos`), Alt+Tab visuel (règle de Windows appliquée aux styles), scintillement mesuré seulement par échantillonnage de pixels blancs (~4 ms) sur 5 changements de mode : 0 image blanche, mais pas une capture image par image ; style du widget provisoire (DA en 12b).
- **Chore logo Kayro — 2026-10-10** (branche `chore-logo`, hors étapes) : `src/brand/` (`<Logo variant size />` en SVG inline, variables `--logo-top/bottom/glyph` lues dans `assets/brand/variantes.json`, `setLogoVariant(id)` = variables CSS + PNG 256 px par canvas + `setIcon` de la fenêtre), affiché dans la barre du haut. `src-tauri/icons/` regénéré (`tauri icon` depuis le 1024 ; ICO 16–256 dont 16/24/32/48/64 issus de `icone-app-petit.svg`), sources dans `icons/source/`. `src-tauri/src/tray.rs` : icône blanche/noire selon le thème Windows, taille 16/20/24/32 selon l'échelle ; clic gauche = afficher la fenêtre. Feature `image-png` de Tauri + permission `core:window:allow-set-icon`.
  - Écarts : la barre des tâches suit `SystemUsesLightTheme` (repli `AppsUseLightTheme`), pas seulement `AppsUseLightTheme` ; le rafraîchissement part des événements de thème/échelle de la fenêtre. **Non testé** dans une vraie fenêtre Tauri : le tray, `setIcon` et le changement de thème à chaud. Pas de menu de tray (Quitter) ni de réglage (étape 15).
- **Chore renommage Hub → Kayro — 2026-10-10** (branche `chore-kayro`) : `productName`/titre de fenêtre/`index.html`/thèmes/Cargo = Kayro ; `{app}` est un paramètre toujours rempli par `t()` (fr.json) ; exe `Kayro.exe` (`[[bin]]`), identifiant `fr.yiuno.hub` et crate `hub` inchangés. `src-tauri/src/legacy.rs` : si `%APPDATA%/Hub` existe et pas `Kayro`, copie dans `Kayro.migrating` puis renomme (jamais de `Kayro` à moitié copié), journalisée ; l'ancien dossier n'est ni modifié ni supprimé. Logs (`kayro.*.log`) et cache d'icônes vivent dans ce dossier. 4 tests dans un dossier temporaire.
- **Chore raccourci bureau — 2026-10-10** (branche `chore-raccourci`) : `scripts/build-local.ps1` (build `--no-bundle` → `target/release/Kayro.exe`, `Kayro.lnk` réécrit sur place avec icône `icon.ico` et dossier de travail de l'exe ; Kayro ouvert → question o/N, `-CloseRunning`, ou arrêt avec message ; fermeture douce seulement, jamais de kill). Testé : build, raccourci (cible/icône/dossier), démarrage par le raccourci, cas « ouvert » avec et sans `-CloseRunning`, pas de doublon.

- **Étape 13, séance de mesures en production — 2026-10-13** (avant le gel de la DA ; **étape cochée le 2026-10-14** : mesures et corrections faites, banc livré. Hors de cette étape : la qualité « Auto », reportée avant l'étape 19, ainsi que la machine d'états et les réglages de performance) : `docs/PERF-ETAPE13.md`. Budget p95 ≤ 5,4 ms tenu partout sauf l'onde de thème en Éco (Fondu : p95 jusqu'à 10,7 ms). Pulsation C : 0 image > 8 ms. Repos visible : 1,2–4,2 % de CPU (cible < 1 % non tenue) ; hub masqué : 0,05 % / 0 % de GPU. `--quit` : 11 sur 11 en 38–53 ms. Corrections proposées classées par gain, non appliquées.
  - **Corrections — 2026-10-14** (4 paquets, rendu identique ; remesure dans `docs/PERF-ETAPE13.md` § « Après corrections ») :
    - banc `npm run perf` (`scripts/perf/`) ;
    - plafonds de cadence du moteur en tokens et pointeur regroupé par image ;
    - Fondu Éco en View Transition (p95 10,7 → 3,7 ms) et thème appliqué en un seul recalcul ;
    - clics de liaison, retour et onglets allégés (1–2 images > 8 ms par occurrence en Élevée, aucune > 16 ms) et passages dont les grosses images tombent dans le noir ;
    - A10 retiré.
    - Restent : le CPU au repos du carrousel avec flottaison (3,3 %, audit de l'étape 18) et les pistes de l'étape 14 (journal).
- **Étape 12b — Atelier de DA, gel le 2026-10-14** (branche `step-12b-atelier-da`, rondes 1 à 5 + relecture finale, tags `da-r1` … `da-r5-fix-b`) : `docs/DESIGN.md` écrit (DA telle qu'elle est dans le code) ; nettoyage en deux paquets au rendu identique : atelier, préréglages, anciens bancs de dev, 5 anciens thèmes, polices Fraunces / DM Sans, `widgetStyle`, couches « croquis » de l'étape 8, anneau en tube, effets 2b non retenus (matière, particules éclairées, voile périodique) et options de comparaison retirés (récupérables au tag `perf-13-fix`). Gardés : le repli CSS complet, les affiches dans le verre (étape 14), le verre des barres (imbrication de la pastille).
  - Mesures (`npm run perf`, R1 / R2 / I1 / A2, Élevée et Éco) : p95 3,7 ms partout comme avant ; carrousel au repos ≈ −45 Mo de mémoire ; onde 2–3 images > 8 ms par changement en Élevée (3–6 avant). Tests : vitest 527, cargo 198.
- **Étape 14 — Couleurs du jeu, 2026-10-14 → 15** (branche `step-14-couleurs-du-jeu`, commits `182cf67` … `50aafe5`) : art local (cache Steam lu en place, variantes de langue, images déposées copiées dans `art/<appId>/`, protocole `kayro-art` id + rôle, CSP ouverte aux seules images), icônes UWP / Epic / Steam ; palettes OKLab côté Rust (k-means sur 64 × 64, `cache/palettes.json`, thread en arrière-plan, JPEG / PNG / WebP) ; planche V1–V10 (toutes les options recommandées) ; couleurs appliquées (moteur par la palette, marée sans View Transition, accents sur 3 conteneurs, Immersif avec nuit et héros, logo sur la carte active, faces aux couleurs de l'icône) ; réglages (Visuel + 7 variantes) et panneau « Apparence » par app.
  - Mesures (`docs/PERF-ETAPE14.md`) : p95 3,7 ms partout ; marée : 2 images > 8 ms par changement en Élevée (≤ 14,3 ms, acceptées le 15/10), 1 en Éco ; A/B avec l'exe d'avant l'étape : pas de régression sur l'onde et la liaison (les écarts avec le 14/10 viennent du fond) ; extraction : 2,6 ms par affiche, 8,8 ms par héros (hors thread d'interface). Tests : vitest 548, cargo 227. Dépendances : `image` (jpeg, png, webp → `zune-jpeg`, `image-webp`).
  - Limites : non testé sur un vrai jeu Epic ni GOG ; « Au lancement » non gardé après un redémarrage ; héros non dessiné en repli CSS ; une marée lancée pendant une autre fait sauter les bords à la couleur visée ; aucun retour visuel pendant le glisser d'une image.
- **Étape prétest — 2026-10-29** (branche `step-pretest`, version 0.14.0) : installeur NSIS par utilisateur, français, WebView2 `embedBootstrapper` → `Kayro_0.14.0_x64-setup.exe` **7,5 Mo** (`scripts/build-installer.ps1`) ; la case « supprimer les données » du désinstalleur ne vise que `fr.yiuno.hub` (modèle NSIS lu), jamais `%APPDATA%\Kayro`. « Exporter les logs » (zip `exports/kayro-logs-<date>.zip` + `infos.txt`, crate `zip` deflate seul) ; « Kayro 0.14 prétest » en bas de Réglages › Général (`APP_VERSION` lu dans `tauri.conf.json`). Premier lancement vide vérifié dans l'exe (APPDATA redirigé) : accueil vide, détection 76 apps, ajout, export, démarrage Windows non activé.
  - Limites : installeur ni installé ni désinstallé ici (SmartScreen non vu) ; le profil WebView2 (`%LOCALAPPDATA%\fr.yiuno.hub`) ne suit pas `LOCALAPPDATA` ; aucun assistant de premier lancement (l'utilisateur clique « + ») ; dates internes du zip à 1980. Tests : vitest 548, cargo 230.

- **Étape 15 — 2026-10-29** (branche `step-pretest`) : Réglages › Thèmes › « Mes thèmes » : créer un thème depuis 2 couleurs + un curseur de fond (`design/themes/derive.ts` rejoue la règle mesurée sur les 6 thèmes ; A et B bornés, lisibilité ≥ 4,5:1 vérifiée sur 279 combinaisons), le modifier, l'exporter (dossier `exports`, Explorateur), le supprimer ; import en déposant un `.json` sur la section (cœur `config/themes.rs` : schéma strict, couleurs hex/rgb seulement, ≤ 20, ≤ 64 Ko, id `perso-…` toujours neuf). Réglage Général « Écran d'ouverture » (dernier utilisé par défaut ; souris ou principal : la fenêtre y est déplacée à l'ouverture, pas le widget). Non vu dans l'exe, non mesuré (aucun effet sur la boucle d'images).
- **Revue Opus 5.5 — 2026-10-29** (branche `step-pretest`, commit `dee0ecf` ; note `docs/REVUE-OPUS55.md`) : revue des artefacts de motion (Kayro, Hades II, RAYKA) ; flottaison plus lisible (Visible 10 / 7 px + dérive), survol 3D à 6° avec le verre du moteur incliné (reprojection en perspective dans le shader), couleurs du jeu plus marquées (couleur qui parle pour l'affiche, nuit teintée en Léger), faces d'icônes plus sobres, tramage anti-bandes ; scan des apps affiné (`detect/relevance.rs` : aides, consoles, variantes et outils annexes d'une suite écartés ; « - Raccourci » retiré) : 58 propositions du menu Démarrer sur ce PC au lieu de 100 (scan réel, lecture seule). Exe vérifié par CDP (inclinaison de l'éventail et du carrousel, verre qui suit) ; A/B contre le prétest (4 passes) : p95 3,7 ms partout, + 0,2 à 0,4 point de CPU / GPU au repos et au survol, marée sans régression (chiffres dans la note). Après retours : changement d'onglet en ronde sur toute la scène (`fanDance.ts`, ≈ 1,4 s ; réglage `danceMs`) — non mesuré, non vu dans l'exe.
- **Étapes 16–17 — Ambiances, 2026-10-30** (branche `step-16-ambiances`, note `docs/AMBIANCES.md`) : emblèmes des cartes
  de catégorie (16a) ; `setFocusTarget` suit la carte affichée (16b) ; `.hubmood` strict côté Rust (`config/moods.rs`,
  import / export / suppression, `moodId` + `moodTune` par app), rendu dans le moteur WebGL2 (sprites réfractés, atlas
  de glyphes, repli Canvas 2D) et 6 packs (16c–16d) ; panneau « Ambiance du jeu » ; cartes spéciales (personnages,
  fond, logo, 17a) ; « Sceau de la sorcière » pour Hades II (17). Retouches du 30/10 : plaques de nom plus fines,
  petit nom au lieu du logo sur la carte active avec affiche, dialogue « Modifier » qui défile, **mode Immersif des
  couleurs du jeu retiré** (Désactivé · Stylisé). Tests : vitest 565, cargo 250, clippy / eslint / tsc
  propres. **Non mesuré** (CPU / GPU des ambiances : à faire en A/B avec `npm run perf -- --exe`, accord requis) ;
  non vu dans l'exe par moi ; carte spéciale sans repli CSS ; anneau de glyphes en partie derrière les cartes latérales.
- **Étape 19c — Finitions, 2026-10-30** (version 0.19.2) : **scan avancé** (`detect_deep`, lancé par l'utilisateur
  après explication) : dossiers de programmes et de jeux des disques fixes (Program Files, Games, Riot, Epic, GOG,
  Ubisoft, `%LOCALAPPDATA%\Programs`), programme principal choisi (pas d'installeur, d'aide ni d'outil console :
  en-tête PE), nom de l'app et non de l'éditeur, logo PNG du dossier → icône de l'app (rôle Icon désormais
  modifiable) ; sonde sur ce PC : 34 apps en 0,3–3,5 s, lecture seule. Logos ronds (listes, scènes, widget) ;
  cartes sans image : logo centré, couleurs du logo pleines (`ICON_FACE` strong / vivid). Renommer sur la carte
  (clic droit › Renommer : champ posé sur la plaque). Clic droit : icônes, Reculer/Avancer sur une ligne,
  « Déplacer vers › » en sous-menu, Retirer en rouge. Scènes : corde Verlet (12 segments) + cadre freiné par
  l'air, fil à trois traits lumineux, l'app sort de sa ligne et se transforme en cadre, « Mes apps » sans les
  apps déjà mises (les autres remontent avec un rebond). Retours du 30/10 au soir : clic droit partout (plus
  jamais le menu du navigateur), sous-menu qui ne se ferme plus en chemin, icônes recadrées sur leur dessin (une
  petite icône dans le coin d'un grand carré vide), champ de « Nouvelle scène » plus coupé, fil plus long (92 px)
  et plus épais, bien plus calme (un seul retour, posé en < 1,5 s, inclinaison ≤ 16°), la ligne s'étire d'abord
  dans « Mes apps » puis se décroche, et le cadre lâché devient la ligne de la scène (480 ms). Tests : vitest
  602, cargo 272. **Non vu dans l'exe** ;
  pas d'affiches pour les jeux hors Steam (les lanceurs les gardent dans des caches illisibles) ; pas de
  renommage par double-clic (un clic lance l'app). 0.19.3 : fil un peu élastique (`GIVE` 0,3 par passe, plafond
  ×1,25 ; repos +3,5 %, revient seul).
- **Étape 19b — Scan et rangement, 2026-10-30** (version 0.19.1) : scan (cœur) — doublons Steam / Epic ↔ menu
  Démarrer fusionnés, lanceurs à part, catégories devinées (≈ 100 motifs de plus), « Ignorer » retenu
  (`ignoredDetections`) ; onglet « Détectées » refait : logo de chaque app (`detect_icon` : icône Shell ou petite icône
  Steam), groupes par catégorie, recherche, vues Nouvelles / Déjà ajoutées / Ignorées, apps sûres cochées d'office.
  Rangement : clic droit « Déplacer vers » et « Avancer / Reculer » (Alt + flèches), glisser une carte à côté d'une
  autre (repère lumineux), cartes qui glissent à leur place (FLIP, grille) ; `apps_reorder`. Scènes : l'app glissée pend
  au curseur sur un fil de lumière (ressort amorti, `tether.ts`). Tests : vitest 599, cargo 264. **Non vu dans l'exe** ;
  le balancement du fil n'est vérifié que par les tests (aperçu en arrière-plan) ; quelques apps de la bibliothèque
  sans logo (ex. « 15 Bands Graphic EQ ») : cause non cherchée.
- **Étape 19 — Démarrage, 2026-10-30** (version 0.19.0) : crate partagé `crates/startup` (installeur + Kayro) qui
  coupe les apps lancées avec Windows comme le Gestionnaire des tâches (marque `StartupApproved`, jamais la clé `Run`
  ni le dossier Démarrage ; format non documenté par Microsoft, connu par l'usage) ; seulement les entrées du compte,
  jamais celles du PC, de Windows ni Kayro ; journal `startup-journal.json` → « Tout remettre comme avant » à l'octet
  près. Installeur : écran « Au démarrage du PC », **« Garder seulement Kayro » par défaut** avec avertissement rouge,
  « Choisir », « Ne rien changer ». Nouvel onglet Réglages › **Démarrage**. Démarrage express (`startupHome`, même
  entrée `--silent`) : ouverture figée sur le logo, clic / Entrée → la suite, **toujours en immersif** (le mode de
  l'utilisateur revient quand Kayro est caché ou qu'on change de mode). Tests : vitest
  592, cargo 258 + 7 + 4. **Non mesuré** (temps jusqu'au logo, journalisé `since_start`) ; non vu dans l'exe ;
  assistant de premier lancement non fait (→ « Plus tard »). Apps du Store : leur propre interrupteur (`State` de
  leur `StartupTask`, comme Paramètres › Applications › Démarrage), même journal ; celles de Windows verrouillées.
- **Étape 20 — Kysland, 2026-10-31** (branche `step-20-kysland`, 0.20.0) : le widget devient une île (`src/features/island/`, `src-tauri/src/desktop/island/`). Encoche noire collée au bord haut (centre ou coins), décrochage par traction, gestes pilotés par le cœur au rythme de la composition (`DwmFlush`), fenêtre fixe 720 × 420 découpée par région (les clics passent à côté), cadre Windows 11 coupé ; passage d'écran « Forcer » (bulles) ou « Glitch » (libre, pics sur une couche native transparente aux clics, `platform/overlay.rs`, rastériseur maison) ; teinte selon la clarté de l'écran (lecture GDI ponctuelle) ; musique via les contrôles multimédias de Windows (`media/`, Spotify d'abord) et rythme par écoute du son de sortie (WASAPI en boucle, 5 bandes, rien gardé) ; recherche au clavier (la fenêtre ne prend le focus qu'ouverte) ; sons propres (Forcer en notes, Glitch fabriqué échantillon par échantillon). 635 vitest, 302 tests Rust.
  - **Capri** (0.20.0 aussi) : l'effet « Glitch » s'appelle Capri ; module partagé `src/features/capri/` ; aperçu animé de Kysland dans l'installeur ; mises à jour et « Nouveautés » (une fois par version, `localStorage`) sur une page Capri ; l'île annonce une mise à jour. La page de mise à jour Capri ne s'appliquera qu'à partir de la mise à jour suivante (la 0.19 affiche l'ancienne).
  - **Non testé / non mesuré** : aucune mesure de perf (CPU pendant musique et glitch, fluidité du glisser) ; écrans à échelles différentes et empilés ; Windows 10. Les raccourcis de scène qui ferment des apps ne s'ouvrent pas en mode Widget (pas de confirmation dans l'île) ; l'ancien widget (`features/widget/`) n'est plus branché, ses réglages « Dépliage » et « Élasticité » ne servent plus.
- **Étape 18b — Mises à jour, 2026-10-30** (versions 0.18.0 et 0.18.1, note `docs/MISES-A-JOUR.md`) :
  `tauri-plugin-updater` 2.14.0 ; versions publiées sur le dépôt **public** `Y1UNO/kayro-releases` (installeurs,
  signature, `latest.json` ; jamais le code) par `scripts/publish-release.ps1` (`gh`) ; clé privée hors du dépôt
  (`%USERPROFILE%\.kayro`). Réglages › Général : « Rechercher une mise à jour » et « au démarrage » (`updateAuto`,
  désactivé par défaut côté Kayro) ; installeur maison : case cochée et expliquée (choix de l'utilisateur, exception
  assumée à « réseau désactivé par défaut ») → `install-choices.json`. **Essai réel** : 0.18.0 installée, 0.18.1
  publiée, trouvée au démarrage, téléchargée, signature vérifiée, installée, Kayro redémarré en 0.18.1 (~4 s).
  Trouvé à l'essai : l'annonce du démarrage partait avant que la page écoute → la page demande au cœur ce qu'il a
  trouvé (`update_pending`). Tests : vitest 587, cargo 256. Limites : une seule vérification par démarrage ; pas de
  retour en arrière ; le compte GitHub est **Y1UNO** (chiffre 1).
- **Étape 17b — Sons, 2026-10-30** (version 0.17.0, note `docs/SONS.md`) : sons **synthétisés** (Web Audio, aucun
  fichier) en trois styles — Premium (cloches de cristal, écho doux, par défaut), Rétro (synthé chaud filtré), 8-bit
  (carrés) — décrits par `src/sound/sons.json` (validé strictement) ; 7 moments (clic, carte, catégorie, validation,
  lancement, réussite, export) en 3 familles ; contexte audio suspendu après chaque son, rien quand Kayro est caché.
  Réglages › **Sons** : interrupteur, style, volume en forme d'onde (rendu hors ligne du son), familles ; Rust
  `config/sounds.rs` (volume 0–1 validé). Installeur : onglet **Patch notes** (frise des versions, `installer/ui/
  patchNotes.json`). 2ᵉ passe (même jour) : 20 moments, variantes, gamme pentatonique au survol et à la sélection,
  sons calés sur les animations (ronde → impact, mélodie d'ouverture lettre par lettre, final des scènes de
  lancement), Premium retravaillé, nouvelle ronde 8-bit. Tests : vitest 585, cargo 255, clippy / eslint / tsc
  propres. **Non entendu par moi** ;
  coût CPU non mesuré (étape 18).

## Plus tard (liste unique)
Seul endroit des choses à faire plus tard (regroupées au gel de la DA, le 2026-10-14). Elles viennent de l'ancienne liste
« Plus tard » et des « Petits ajustements » de ce fichier, de `docs/DA-JOURNAL.md` (« Plus tard hors ronde 5 »,
« À retenter plus tard », points ouverts), de `docs/PROPOSITIONS-DA.md` (« Idées pour plus tard »), de
`docs/RETOUCHES.md` et de `docs/PERF-ETAPE13.md`. Une ligne cochée = faite, avec la date. La passe de finition avant
l'étape 19 est décrite dans `_kit/PROMPTS.md`.

### Étape 14 — Couleurs du jeu
- [x] Affiches en production : `posterUrl` renvoie `null` hors dev ; dossier local d'affiches + ajout par glisser-déposer
  sur une carte — fait le 2026-10-14 (cache Steam en place + image déposée, protocole `kayro-art`). L'élément
  `posterGlass` (affiches dans le verre) reste éteint : la planche a retenu l'affiche plate (V9 c).
- [x] Icônes dans le carrousel pour les apps sans icône (Steam, Epic, UWP) et dans la palette — fait le 2026-10-14
  (UWP par le Shell, Epic par l'exe de son manifeste (non testé sur un vrai jeu), Steam : sa petite icône 32 px).
- [x] Pistes de perf du gel : thème / palette en un recalcul, pas de View Transition à chaque changement de jeu,
  couleurs du moteur par la palette — fait le 2026-10-14 (couleurs du jeu). La mesure « éventail prêt à 0 % » contre
  « recalcul allégé » passe à l'étape 18.
- [x] « Couleurs du jeu » (`color_mode`) : réafficher le réglage quand il aura un effet — fait le 2026-10-14 (Visuel,
  avec ses variantes en Personnalisation avancée et le choix par app).

### Étape 15 — Réglages · Apparence
- [x] « Créer mon thème », import / export de thèmes (la grille des 6 thèmes existe déjà, R5). — 2026-10-29
- [x] Réglage « Écran d'ouverture » : écran principal · écran de la souris · dernier utilisé (aujourd'hui, sans
  placement enregistré, l'app s'ouvre sur l'écran de la souris). — 2026-10-29

### Étapes 16–17 — Ambiances
- [x] Design propre à chaque carte de catégorie — 2026-10-30 (16a : emblème au trait par catégorie, mouvement unique
  au survol, `CategoryEmblem.tsx`).
- [x] `FxLayer.setFocusTarget` : point d'extension gardé (le faisceau de l'étape 8 a été retiré au gel) — 2026-10-30
  (16b : la cible suit la carte de l'app affichée, `gameColorsStore.focus`, sélection et redimensionnement ; la marée
  garde son origine).
- [x] Cartes spéciales avec art local fourni par moi — 2026-10-30 (17a : rôles `char-left` / `char-right`, couches
  dans le moteur, liste à fournir dans `docs/AMBIANCES.md`). Texte d'origine : (personnages détourés à gauche et à droite, logo, fond) : couches
  avec profondeur, personnages teintés par l'ambiance, bords fondus dans la brume, centre libre. Kayro n'embarque aucune
  image de jeu : un dossier d'images par carte, rempli par l'utilisateur. Références dans reference/ambiances/.

### Étape 18 — Audit (en dernier, juste avant la v1.0)
Reporté à la fin le 2026-11-02 : l'app va encore beaucoup changer (voix, extensions), l'audit se fait sur la version
finale. Ce qui est déjà fait ci-dessous (mesures, correctifs de l'île) reste acquis ; tout est à remesurer à la fin.
- **Ménage du 2026-11-02 (2e passe)** : 6 exports TS jamais utilisés retirés (`ExpandIcon`, `isPersonal`, `SHOULDER` côté page, `ThemesIpc`, `onDetectProgress`, `mixLab`) et 2 fonctions Rust jamais appelées (`ex_style`, `is_tool_window`) ; `target/debug` (78 Go de cache de débogage, inutile : on teste l'exe de production) et `spikes/*/gen` supprimés ; `.thumbnail` ignoré ; README à jour (plus de `spikes/`). Dossiers `reference/` tranchés : suivis = notes de DA R3–R5 et démos (`animations/`, sans `vendor/`), presets archivés, planches de l'étape 14, maquette `intro-hades-ii.html` ; ignorés = sons d'exemple mixkit, captures d'inspiration, affiches PNG des ambiances, copies de React. `hub-kit.zip` et `_kit/` laissés tels quels.

**Volet cybersécurité (demandé le 2026-11-02)** : un test d'intrusion de Kayro, en se mettant à la place de quelqu'un qui
veut le pirater pour lui faire lancer autre chose ou lui voler des données. Sur ce PC uniquement, contre notre propre
app. Chaque attaque réussie = un correctif + un test qui la rejoue. Rapport dans `docs/SECURITE.md`.
- [ ] **Fichiers piégés** : `.hubmood`, thèmes, `.hubscene` géants, mal formés, zip bombs, chemins `..\`, SVG avec
  script, champs inattendus ; images d'affiches corrompues (décodeur). But : planter Kayro ou lui faire lancer un exe.
- [ ] **Injection dans la page** : noms d'apps, titres de musique (Spotify et autres lecteurs), patch notes, noms de
  scènes avec du HTML / script → tenter d'exécuter du code dans la page, puis d'appeler les commandes Tauri.
- [ ] **Commandes Tauri (IPC)** : appeler chaque commande avec des valeurs hostiles (chemins, ids inconnus, tailles
  folles) ; vérifier que seul ce qui est configuré peut être lancé, et que la CSP et la liste blanche de permissions
  bloquent scripts externes et accès disque.
- [ ] **Mises à jour** : faux `latest.json`, installeur non signé ou mal signé, retour à une vieille version, réseau
  détourné → rien ne doit s'installer.
- [ ] **Sur le PC** : `settings.json` / config modifiés à la main pour pointer vers un autre exe, tâche planifiée de
  démarrage détournée, DLL posée à côté de l'exe, port de débogage (CDP 9222) ouvert dans l'exe de production ?
- [ ] **Fuites** : contenu des logs exportés (chemins, noms), aucune donnée envoyée sur le réseau hors mises à jour,
  affiches jamais exportées dans un fichier partagé.
- [ ] **Voix et extensions** (une fois faites) : une phrase dite ou un geste ne peut lancer que ce qui est configuré ;
  micro et caméra coupés et signalés comme prévu ; intégrations (OBS, Discord) sans jeton en clair.

- [x] **Mesures du 2026-10-31** (banc `npm run perf`, exe de production, ce PC 280 Hz, Steam ouvert en fond ; médianes de
  2 essais, CPU en % de la machine) — images : p95 3,7 ms et 0 image > 8 ms au repos partout.
  - Éventail R1 : 2,6–2,8 % (Élevée), 1,7–1,9 % (Éco) ; carrousel R2 : 2,1–2,6 % (Élevée, était 3,3 %), 3,1–3,3 % (Éco) ;
    mode fenêtre R7 : 3,7 % (Élevée), 2,7–3,2 % (Éco) ; hub masqué R10 : 0,08 %. Mémoire de l'arbre : 520–800 Mo
    (Élevée), 420–470 Mo (Éco) — au-delà du budget de 250 Mo du PLAN.
  - **Kysland** : accrochée sans musique R8 : 0,04–0,19 %, GPU 0 ; avec musique R11 : **4,5 % → 1,3 %** (GPU île
    2 → 0,26 %, dwm 6 → 1,55 %) après correction (le vinyle tournait en animation CSS et barres / respiration en
    transitions : l'île était redessinée à 280 i/s ; tout avance maintenant au rythme des niveaux, 30 i/s) ; à cheval
    en Capri au repos R12 (musique en pause) : 1,1 %, dwm 1,7 %. Mémoire ~260–290 Mo.
  - Ouverture (bloc L) : 3–4 images lentes (82–93 ms) au tout début, comme avant ; `--quit` 57–65 ms.
- [x] **Démarrage à la carte (0.20.1, 2026-10-31)** : Réglages › Démarrage, « Au démarrage de Windows » : Intro (défaut,
  le logo puis la cinématique) · Immersif · Kysland (passe en mode widget) · Caché ; « Après l'intro » : Immersif ·
  Kysland · Caché. `startupOpen` / `startupAfter` remplacent `startupHome` (migration réglages v2 → v3 : écran
  d'accueil → Intro, discret → Caché). Vérifié dans l'exe avec un `APPDATA` de test (7 cas, départ `--silent`).
- [x] **L'île toujours là, réveil rapide (0.20.2, 2026-10-31)** — signalé après la 0.20.1 :
  - Au redémarrage, Kayro ne s'ouvrait **pas** (une invite de commandes) : la clé `Run` lançait
    `target\debug\Kayro.exe` (0.18.1, avec console), trop vieux pour les réglages v3 qu'il a mis de côté
    (restaurés). Une version de développement n'inscrit plus jamais Kayro au démarrage.
  - « Démarrer avec Windows » passe par une **tâche planifiée à l'ouverture de session** (sans droits admin) au
    lieu de la clé `Run`, que Windows lit en dernier (mesuré : Kayro parti 24 s et 57 s après la connexion).
    Une ancienne entrée `Run` devient la tâche au lancement suivant ; une tâche qui vise un autre exe est repointée.
  - **Écran de réveil** : sur l'intro ou l'immersif, l'écran passe tout de suite au noir avec « Kayro · se réveille… »
    (voile natif, avant la page), qui s'efface quand Kayro est peint.
  - **Plus de mode Widget** : Kysland est là dès que Kayro est fermé (« Kysland toujours à l'écran », Général, activé
    par défaut), part quand il s'ouvre ; le raccourci ouvre ou ferme Kayro. « Caché » au démarrage : rien, l'île non
    plus, jusqu'à la première ouverture. Un ancien `displayMode: widget` se lit comme immersif.
  - Limites : gain de la tâche non mesuré (il faut redémarrer le PC) ; la désinstallation laisse la tâche (elle
    vise alors un exe absent et ne fait rien) — couper « Démarrer avec Windows » avant de désinstaller.
  - Mesuré au redémarrage du 31/10 : tâche lancée **2 s** après la connexion (24–57 s avec la clé `Run`), écran
    de réveil à 8,5 s (3,6 s après le lancement du processus, disque encore très occupé), Kayro peint à 12 s.
- [x] **Île : ouverture et relais (0.20.3, 2026-10-31)** : l'île disparaissait au clic (tao, qui la croyait cachée
  puisque le cœur la montre lui-même, la recachait en changeant « focusable » : l'activation passe maintenant par
  Win32) ; ouverte, elle fait 360 de large et la hauteur de ce qu'elle montre (recherche seule 66, musique 140,
  1 à 3 résultats 106–170 ; avant 420 × 180), la recherche prend le clavier ; une autre app qui passe devant Kayro
  le cache et l'île prend le relais (pas pendant le voile de lancement, ni 45 s après un démarrage avec Windows).
  Testé par l'utilisateur dans l'exe.
- [ ] CPU au repos encore au-dessus de 1 % : éventail, carrousel et mode fenêtre (2–3,7 %), musique de l'île (1,3 %).
- [ ] CPU au repos : carrousel avec flottaison « Visible » 3,2–3,3 % en Élevée (cible CLAUDE.md < 1 %).
- [ ] Mesures non faites à l'étape 13 : 60 Hz, Équilibré et Ultra, repli CSS (ouverture, moteur coupé), replis
  « budget » et « contexte perdu » en vrai, CPU / GPU pendant l'ouverture, instant exact des images lentes.
- [ ] Tests : Windows 10, mise à l'échelle 125 / 150 %, écran 60 Hz, premier lancement sans config.
- [x] `spikes/` (étape 2) et `src-tauri/examples/spike_launch.rs` : retirés le 2026-10-31 (tag `archive-avant-audit-18`) ; les mesures non suivies `spikes/*/captures` restent sur le disque.
- [x] (2026-10-31, `cargo fmt` et prettier passés ; ancien widget `features/widget/` et commandes `widget_fit` / `window_drag` retirés, `widgetModel.ts` gardé pour l'île) Écarts `cargo fmt` connus (`scene_ops.rs`, `share.rs`, `platform/mod.rs`) et prettier (`widgetModel.ts`,
  `passage.test.ts`) ; ligne `dist-bench/` de `.gitignore` (plus aucun build « bench »).
- [ ] Verre des barres, du dock et des boutons (`glassBars`, `glassDock`, `glassButtons`, éteints) : gardés au gel,
  car ils portent l'imbrication de la pastille de sélection ; à simplifier avec une mesure avant / après au pixel.
- [ ] Tuile de grain CSS non assombrie autour de l'anneau pendant la pulsation C (rien vu à l'œil).
- [ ] Liaison et onglets : mesurer « éventail prêt à 0 % » contre « recalcul allégé » (piste du gel, reportée de
  l'étape 14 ; `docs/DESIGN.md` § 7). Banc : `--exe` permet l'A/B de deux builds dans les mêmes conditions.

### Avant l'étape 19 — Fonctions et finitions
- [ ] Qualité « Auto » adaptative, pour les PC plus faibles : proposition chiffrée dans `docs/PERF-ETAPE13.md`
  § « Qualité Auto » (décision du 14/10 : pas maintenant).
- [x] Gestion des apps qui démarrent avec Windows au premier lancement (fait à l'étape 19, apps du Store comprises). **Précisé le 2026-10-30 (étape 19)** : à
  l'installation, trois choix — « Garder seulement Kayro » (les autres apps ne démarrent plus avec Windows), « Ne rien
  changer », ou **personnalisé** : la liste des apps lancées au démarrage, on coche celles qu'on veut **garder**.
  Réversible (ce qui a été retiré est noté pour pouvoir le remettre), jamais d'app système ni de pilote touchés.
- [ ] **Après la v1 — logos et affiches de façon concrète** (demandé le 2026-10-30) : certaines apps restent
  sans logo, et les jeux hors Steam (Fortnite, Epic, GOG, Riot…) sans affiche, même après le scan avancé (les
  lanceurs gardent leurs images dans des caches qu'on ne peut pas relier à un jeu). Piste : une source en ligne
  **optionnelle, désactivée par défaut et expliquée** (ex. SteamGridDB : logos, affiches, héros par nom de jeu),
  ou un bouton « Chercher une image » par app ; à décider avec l'utilisateur (réseau = règle CLAUDE.md).
- [ ] **Assistant de premier lancement** (reporté de l'étape 19) : Kayro vide au premier lancement, l'utilisateur
  clique « + » ; un petit assistant proposerait les apps détectées.
- [ ] Démarrage : mesurer « démarrage du PC → logo » (journal
  `since_start`) ; afficher le logo depuis `index.html` avant React si la mesure le justifie.
- [x] **Démarrage express** (2026-10-30, étape 19, fait ; temps jusqu'au logo encore à mesurer) : au démarrage du PC, Kayro s'ouvre le plus vite possible sur le
  logo KAYRO **immobile** ; un clic dessus ou Entrée lance l'animation d'ouverture actuelle, et on arrive sur le hub
  complet (Kayro devient l'écran d'accueil du PC). À mesurer : temps jusqu'au logo.
- [x] **Mises à jour** (2026-10-30, étape 18b, fait et publié depuis la 0.18.1, avant d'envoyer d'autres versions) : « Rechercher une mise à jour »
  dans Réglages et, au choix, une vérification automatique ; téléchargement puis installation par l'installeur
  maison (patch notes affichées). Seule fonction réseau de Kayro : **désactivée par défaut et expliquée** (CLAUDE.md
  › Réseau), source unique (ex. les « releases » GitHub du projet), fichiers **signés** et vérifiés avant de lancer
  quoi que ce soit (plugin updater de Tauri ou équivalent, à vérifier à l'étape). Demander à l'utilisateur où héberger.
- [x] **Kysland** (« Kayro Island », 2026-10-30, étape 20) : le widget refait façon Dynamic Island d'Apple, version
  Windows. On le **décroche** d'un geste avec une certaine résistance (il faut tirer, effet ressort), on le balade où
  on veut sur l'écran ; posé **en haut**, il s'aimante et s'intègre en île (forme pilule centrée, s'étire pour
  afficher une info, se rétracte). Animations et sons propres ; garder la veille douce et la règle « jamais devant un
  jeu en plein écran ».
- [x] Détection : filtres de bruit renforcés (fait avant l'étape 19b ; doublons entre sources à l'étape 19b) (désinstallateurs, aide/documentation, « Check For Updates », « About/Configure
  Java », « Module Docs », « Report a Problem », « Windows App Cert Kit », variantes mode compatibilité / sans échec,
  doublons de même nom et même cible).
- [x] Détection (étape 19b) : bouton « Ignorer » par app (`ignoredDetections` dans settings.json, case « Afficher les ignorées »).
- [x] Détection (étape 19b) : groupe « Lanceurs et outils » (Riot Client, Epic Games Launcher, Steam, Roblox Studio, Unity Hub, GOG
  Galaxy, Battle.net…) replié et décoché par défaut.
- [x] Détection (étape 19b) : meilleure suggestion de catégorie par liste de motifs locale.
- [x] Détection : **apps en paquet MSIX / Microsoft Store** (2026-11-04, `detect/packaged.rs`) : elles n'ont pas de
  `.lnk` ; lues dans `shell:AppsFolder` (ce que montre le menu Démarrer), lancées par leur AUMID. L'exe suivi vient
  du manifeste du paquet, sauf un simple lanceur (`GameLaunchHelper`, `SpotifyMigrator` : pas suivies). Outils de
  Windows écartés (Paramètres, Calculatrice, Photos…). Sur ce PC : 14 apps en plus (Claude, Spotify, WhatsApp,
  Celeste, Minecraft Launcher, XBOX, Teams, Terminal, TikTok, Skype, OneNote, Microsoft Store…).
- [x] **Scan avancé rendu utile** (2026-11-04, analyse : il ne trouvait que 2 apps vraiment absentes du menu
  Démarrer, et des logos faux) : le **Bureau** (le vrai, OneDrive compris, et le public : raccourcis et exe posés à la
  main, `detect/desktop.rs`) ; le **haut de chaque disque** (sans Windows, les utilisateurs, les bibliothèques Steam ni
  les dépôts de code) ; **logos** nommés comme l'app (ou juste « logo » / « icon »), 128 px au moins, jamais une variante
  de tuile, et jamais à la place d'une icône d'exe nette ; dossiers comparés avec séparateur (`git` ≠ `github cli`) ;
  même nom qu'une app du scan normal = doublon retiré (VALORANT) ; même nom dans la bibliothèque = déjà ajoutée ; Kayro
  ne se propose plus lui-même ; texte « quelques secondes ». Sonde sur ce PC : 9 apps en 0,15–0,17 s (scan normal
  0,85 s à part) : Godot 4, RAYKA, Repentogon, Modrinth App en plus de WizTree, REDlauncher, Revo Uninstaller.
- [ ] **Santé de la bibliothèque** (analyse du 2026-11-04, à vérifier) : ~13 apps sur ~113 pointeraient vers un fichier
  absent (Blockbench, 7-Zip, Unity Hub, Dead Cells, Noita…) ; les signaler, proposer de les retirer ou de les
  retrouver (~3 à 4 h).
- [ ] Scan normal, faux négatifs de ses filtres (2026-11-04) : « uninstall » dans le nom (Revo Uninstaller),
  « driver » (GAMAKAY Driver) ; donner leur dossier aux jeux Steam (~1 à 2 h). Manifestes GOG, Ubisoft, EA,
  Battle.net, itch pour les PC des amis (~1 h chacun, rien à tester ici).
- [ ] Fil lumineux (`GlideThread`) pendant « Recherche de vos applications… » et « Chargement de vos données… ».
- [ ] Scènes : mesurer en local le temps de démarrage réel de chaque app lors des tests de scène (`launchTimings.json`
  dans le dossier de données) pour proposer des délais calibrés sur la machine.
- [ ] Scènes : réglage de séquence par app, renommage d'un emplacement, glisser depuis le carrousel, accents conservés
  dans les noms d'emplacements, bouton « Parcourir » pour importer un `.hubscene`.
- [ ] Scènes : Échap dans l'éditeur (aujourd'hui seul « ‹ Scènes » revient).
- [ ] Bouton « Parcourir » pour choisir un exe (plugin dialog).
- [ ] Suivi des jeux Steam (processus sans `match.exe`) pour que `waitReady`, `focus` et `close` marchent aussi sur eux.
- [ ] Test d'Epic avec un vrai jeu installé (URI de lancement et `.item` réels ; icône par l'exe du manifeste, étape 14).
- [ ] Couleurs du jeu (limites de l'étape 14) : « Au lancement » gardé après un redémarrage ; une marée lancée pendant une autre repart de l'état visible (aujourd'hui, les bords sautent).
- [ ] Images d'app : retour visuel pendant le glisser d'une image sur une carte ou une case ; dossier `art/<id>` d'une
  app retirée (gardé aujourd'hui) ; jeux GOG (icône `goggame-*.ico`, images locales de Galaxy) à voir avec un vrai jeu.
- [ ] Menu « Quitter » du tray et rafraîchissement de l'icône quand seul le thème système Windows change.
- [ ] Comportement du clic carte (sélection puis lancement) à confirmer à l'usage.
- [ ] Message de lancement raté dans le widget (il faudrait agrandir sa fenêtre).
- [ ] Option « masquer les univers vides » dans l'éventail.
- [ ] Raccourcis clavier : G pour la grille, 1–9 pour les scènes du dock.
- [x] « Exporter les logs » dans les réglages (prévu par les conventions) — fait à l'étape prétest, le 2026-10-29.
- [ ] DA, détails non faits de la ronde 5 : petit texte secondaire unifié (`--fs-13`), carte vide 176 × 246 (aujourd'hui
  150 × 180), éventail descendu de 60 px, ligne d'aide « Entrée · ouvrir   Échap · dernière catégorie ».
- [ ] DA, retouches à l'œil (ex-`RETOUCHES.md`) : cadrage des titres de catégorie (comparer aux captures 01 à 11) ;
  verre plus sombre que les maquettes (écart de l'étape 3 pour le contraste), s'en rapprocher sans passer sous 4,5:1 ;
  mouvement lent de l'atmosphère à juger sur l'écran à ~280 Hz (cadence d'ambiance 30 i/s au repos depuis l'étape 13).
- [x] Texte du thème Lavande-pêche : sa description ne dit plus « Le thème par défaut » (c'est Bleu-gris depuis R5) — fait le 2026-10-14.
- [ ] À retenter : fenêtre d'ouverture transparente en environnement WebView2 partagé (4b-3.0 bis : +68 / +72 Mo à
  30 s pour une limite de 50) si une version de WebView2 libère mieux la mémoire du processus GPU ; même protocole.
- [x] Journal du renommage Hub → Kayro : dossier de données migré (`%APPDATA%/Hub` copié une fois vers `Kayro`),
  identifiant `fr.yiuno.hub` conservé (voir l'entrée « Chore renommage » du journal ci-dessus).
- [x] **Installeur maison** — 2026-10-30 : `Kayro_<v>_Installer.exe` (14,4 Mo), fenêtre au style de Kayro (crate
  `installer/`, page `installer/ui/`) qui porte l'installeur NSIS (5,6 Mo) et le lance invisible (`/S`) ; repli sur
  l'installeur classique sans WebView2 ou après une erreur ; Kayro ouvert → fermé en douceur (`--quit`) avec accord,
  car NSIS en mode invisible le **tue** ; version installée lue dans `HKCU\…\Uninstall\Kayro`. **Jamais `/NS`** : il
  retire aussi le raccourci du menu Démarrer ; sans raccourci bureau, celui de NSIS est enlevé ou l'ancien remis.
  Essais réels sur ce PC : installation, menu Démarrer, « Lancer Kayro », réinstallation avec Kayro ouvert,
  désinstallation (données gardées). Non essayé : mise à jour depuis une version plus ancienne, PC sans WebView2.
  Trouvé au passage : `gen_types.exe` était livré dans l'installeur → devenu un exemple cargo (`npm run gen:types`).
  Piège d'essai : lancé depuis l'app Claude (paquet MSIX), AppData est redirigé (`Packages\Claude_…\LocalCache`).
- [x] **Les scènes sur l'accueil** — 2026-11-04 (idée du jour) : sous l'éventail, « Scènes » en petites capitales et
  les 5 premières scènes en petites pastilles douces (celles du dock, `SceneButton` partagé) + « Toutes les scènes » ;
  sans verre ni boucle, posée par le chef de la liaison avec le titre (`FanScenes.tsx`). Rien sans scène.

### Kysland — suite (Notion « APP à faire », relu le 2026-11-02)
- [x] **Capri discret à l'accroche** (2026-11-02) : plus de pics qui jaillissent du bord au contact. En approchant
  du bord haut (transport et vol d'accroche), 4 fils fins rouge / vert cernés de violet poussent du bord et de
  l'île et se rejoignent (`threads.ts`, images tenues à 14/s, un fil manque parfois : ça grésille) ; au contact,
  l'île les écrase en étincelles le long de son haut (180 ms), puis plus rien. Le cœur donne aussi la proximité
  pendant le vol d'accroche (`physics.rs`). Le décrochage garde ses pics. Non testé à la souris.
  **Retouche (2026-11-02, après essai)** : 7 fils d'épaisseurs variées (0,6 à 2,2 px, parfois violets), chacun
  entier du bord à l'île (bouts fixes, seul le milieu grésille), qui apparaissent un à un en approchant. Le
  décrochage n'a plus de pics : les fils restent tendus pendant qu'on tire l'île, puis cassent (près de 83 px du
  bord ou après 1,2 s) et chaque bout se rétracte (220 ms). Le glissement le long du bord (« snapped ») garde ses pics.
- [x] **Zone de clic adaptative** (2026-11-02) : la page calcule la taille de l'île une fois ses ressorts posés
  (`clickRegion.ts`, via `shapeOf`), ancrée et flottante ; elle l'envoie tout de suite quand l'île grandit (+6 % de
  rebond), 450 ms après quand elle rétrécit. Rust ajoute épaules, ombre flottante (6/10/14 px) et 3 px de marge. Pas
  de boucle : un envoi par changement (survol, musique, étirement). Limite : le « jelly » d'un tap peut dépasser ~2 px.
  **Hitbox exacte (2026-11-02)** : ancrée (au repos et ouverte), la zone n'est plus un rectangle mais le contour de
  l'île (`outline.rs`, polygone `CreatePolygonRgn`) : bas arrondi, épaules courbes, 1 px autour (aucun au bord
  haut ni sur le côté collé d'un coin). Les coins vides à côté du bas arrondi laissent passer les clics. Flottante :
  inchangée (gélule + ombre, sinon l'ombre serait coupée). Les épaules prennent aussi la lueur de l'album au survol.
- [x] **Cacher l'île** (2026-11-02) : Réglages › Île dynamique, désactivée par défaut ; curseurs à crans « Se cache après »
  0–3 s (1,5) et « Ressort après » 0–1 s (0,1). Ancrée seulement ; ressortie (apparition, contact) : 1,2 s au moins ;
  ressort aussi le temps d'un lancement ou d'une annonce. Rentrée : région vide (aucun clic pris), boucles et écoute du
  rythme arrêtées ; un fil lit le curseur 10 fois/s, 60 à moins de 32 px du haut de sa place (`tuck.rs`), arrêté dès
  qu'elle ressort ou se cache. Limites : écran posé au-dessus (le curseur ne bute pas), barre des tâches en haut. Non
  testé dans l'exe, CPU non mesuré.
- [x] **Réglages triés** (2026-11-02) : deux catégories en plus. **Île dynamique** (tout Kysland : toujours à
  l'écran, Cacher l'île et ses délais, passage Forcer / Capri, renvoi vers Démarrage) et **Raccourcis clavier** (raccourci
  de Kayro sorti de Général, comment refaire sortir l'île, raccourcis des scènes en lecture seule). « Dépliage » et
  « Élasticité du widget » (ancien widget, sans effet) restent dans Visuel › Personnalisation avancée : à trancher.
- [x] **Animation de repos** de l'île (idle), vivante mais légère (2026-11-02, `islandIdle.ts`) : seule (fermée, sans
  musique ni lancement, ni survol, ni rentrée) depuis 4 s, un geste toutes les 8–15 s au hasard : respiration (+6 × 2 px),
  regard (penche ±3°, retour en gelée), reflet le long du bas (CSS, 0,9 s), rarement étirement (+13 px). Somnolente après
  2 min seule (30–60 s), endormie après 10 min jusqu'au survol (petit sursaut). Un minuteur à la fois, boucle seulement
  pendant le geste (≈ 1,5 s) ; rien en Éco ni avec « Réduire ». Zone de clic +16 × 5 px tant qu'elle peut bouger.
  « 2 min » se compte depuis la dernière fois qu'on l'a touchée (pas de suivi de la souris ailleurs). CPU non mesuré.
  **Barres plus vives** (même jour, `media/beat.rs`) : chaque bande saute avec ce qui est nouveau (attaque au-dessus de
  sa moyenne récente), un son tenu reste vers 45 % : les barres de droite (aigus) bougent autant que celles de gauche ;
  retombée plus rapide (0,72), même cadence (30/s).
- [x] **Mode musique** (2026-11-02 ; refait le 2026-11-03 d'après le labo `reference-labo.html` et sa spec, voir
  [[MODE-MUSIQUE]]) : interrupteur sous la musique dans l'île ouverte (`islandMusic`). **Île** : elle se tasse, et sur
  le kick suivant (600 ms au plus) une goutte part, tenue par un col de cinq boules qui s'amincit comme du miel et
  casse ; la boule tombe, s'écrase et devient le lecteur. Au retour, elle s'accroupit, saute sur le kick, l'île
  descend la chercher et la boule s'y refond. **Lecteur (Disque)** : la pochette tourne dans un disque de gelée d'un
  noir mat, celui de l'île ; la basse cogne la bulle (+12 % en deux images, contraction, rebond), la sub la fait respirer, la caisse
  claire la tord, le charleston fait onduler son bord, le crash : flash, ondes de choc, huit gouttes qui reviennent,
  titre éparpillé ; halo, rayons et traînées aux couleurs de la pochette ; titre en ola sur chaque kick. Changements
  demandés : les **cordes suivent la mélodie** (allumées par elle, la corde de son registre, un pincement doux à chaque
  note) ; l'encre du lecteur a **le noir mat de l'île** (les reflets du labo seulement si l'on monte « Brillance »,
  à 0 par défaut). **L'encre (Dancing) est retirée**, avec son sélecteur. Rendu WebGL2 en deux passes (lumière en demi-
  résolution avec traînées, image finale), fenêtre transparente, physique en pas de 1/480 s, résolution adaptative,
  repli 2D sans WebGL. **Son** : analyse du son joué (WASAPI loopback) côté Rust, flux spectral par bande, seuils
  adaptatifs, crash et drop, sub, mélodie. **Réglages** : Visuel › Mode musique (basse, crash, traînées, brillance à 0 ;
  Avancé : sensibilités, décalage son/image, qualité, mode démo, couleurs). Puis (même jour, avec Thomas) : un fil par
  source (sub, mélodie, voix trouvée par le stéréo) et **IA locale du rythme** (Beat This!, ONNX Runtime) : 2,5 fois
  moins d'erreurs sur la grille des temps que les kicks seuls (MUSDB18), environ 4 % d'un cœur ; l'IA « qui joue »
  (EfficientAT) a été essayée et écartée, moins bonne que le stéréo.
- [x] **Interrupteurs et curseurs en rectangle arrondi** (2026-11-02, Réglages) : même animation, forme changée
  (piste 9 px / 3 px, pouce carré arrondi 6 px).
- [x] **Écrire dans Kysland** (2026-11-04) : raccourci global (Ctrl+Alt+K par défaut, Réglages › Raccourcis
  clavier, retirable par Retour arrière) qui ouvre l'île comme un clic, curseur dans sa recherche. Kayro à l'écran :
  sa recherche (Ctrl+K) s'ouvre. Aucune île à l'écran (désactivée, ou jeu en plein écran) : Kayro vient, recherche
  ouverte. Limite : en mode économe, Kayro se construit et la recherche ne s'ouvre pas (Ctrl+K reste à faire).
- [x] **Disposition du clavier** (2026-11-04, Réglages › Raccourcis clavier) : Automatique / AZERTY / QWERTY.
  Windows déclenche un raccourci sur la touche qui tape sa lettre, mais l'enregistreur gardait la place de la touche
  en QWERTY (en AZERTY, A enregistré « Q », M refusé). Automatique : la lettre tapée, sinon celle de la disposition
  de Windows (Keyboard Map de WebView2), sinon AZERTY pour un Windows français. Les raccourcis déjà choisis gardent
  leur lettre.

### Intégrations (ex-étape 23, sortie de la route v1.0 le 2026-11-06)
- [ ] OBS, Discord, lumières en nouvelles actions de scène (changer de scène OBS, enregistrer ; activité Discord ;
  lumières aux couleurs de l'affiche). Pistes : WebSocket local d'OBS, canal local de Discord, pont Hue sur le réseau
  local (Hue Sync vu sur ce PC). Désactivé par défaut, réseau local à faire valider, aucun jeton en clair.

### Écosystème Kayro (très long terme, Notion 2026-11-02)
- [ ] **Reconnaissance vocale premium** qui comprend très bien le français (rejoint « Voix » ci-dessous).
- [ ] **Apps interconnectées** : chaque future app marche seule, mais installées ensemble elles se reconnaissent
  (une « clé » / un identifiant commun) et offrent des interactions et des raccourcis entre elles.
- [ ] **Assistant IA personnalisé**, app à part avec une connaissance de Kayro, qui part sans rien savoir de
  l'utilisateur et grandit avec ses connexions (Obsidian…), fluide et rapide, appel aux API gratuites des grands
  modèles quand il ne sait pas. ⚠ Contraire à la règle actuelle « Aucune IA/LLM dans l'app » (CLAUDE.md) et au
  « réseau désactivé par défaut » : à trancher par l'utilisateur, et sans doute un projet séparé.
  - **Orbe animé** façon « Rose » (vidéo TikTok vue le 2026-11-05) : il vit avec la voix (écoute, réfléchit,
    parle). Décision de l'utilisateur (2026-11-05) : pour cette app, plus tard, pas dans Kayro.
  - **Aussi pour cette app, pas des étapes de Kayro** (décision de l'utilisateur, 2026-11-05) : les **réponses
    parlées** de l'assistant (voix posée et grave, mesures et extraits plus bas), **notre propre modèle de voix**, la
    **vision de l'écran** (mesurée le 2026-11-04 : image + audio 0,35–0,5 s, juste une fois sur deux).

### Avant la v1.0 — Voix (extension A, étape 21 ; avancé le 2026-11-02)
- [ ] **Écoute active** (demandé le 2026-10-30) : lancer des apps, des scènes et d'autres actions à la voix, avec un
  mot d'éveil. **Décision de l'utilisateur (2026-10-30)** : les deux modes, au choix dans les réglages —
  **écoute active en permanence** (mot d'éveil) ou **push-to-talk** (raccourci / bouton). Le mode permanent est une
  exception voulue à la règle « micro jamais en permanence » (CLAUDE.md, à mettre à jour à ce moment-là) : indicateur
  visible quand le micro écoute, coupure facile, veille douce respectée (jeu au premier plan → à décider).
  Traitement 100 % local, ne lance que ce qui est configuré.
- **Plan validé le 2026-11-04** : moteur sherpa-onnx 2.0.1 (essai d'abord), transcription Parakeet TDT 0.6B v3
  (670 Mo) ou Canary 180M (207 Mo), mot d'éveil à vocabulaire ouvert, détection de parole Silero.
- **Demandes du 2026-11-04** :
  - le **mot d'éveil** se définit par l'utilisateur ; le **nom de l'assistant vocal** se personnalisera plus tard,
    chacun le sien (lien avec la future app d'IA agentique de l'écosystème, très compatible avec Kayro) ;
  - une **section de réglages à part « Assistant vocal et IA »** : chaque réglage avec le choix du modèle et une
    description pour bien choisir, ce qui vient plus tard marqué « Plus tard » ; téléchargement d'un modèle avec une
    **barre de progression stylisée** ; **désinstaller un modèle** simplement.
- **Essai du 2026-11-04** (`spikes/06-voix`, sa propre crate : `cargo test -p hub` ne compile pas sherpa-onnx) :
  sherpa-onnx statique (runtime C « MT ») se lie sans erreur avec hub_lib, et cohabite avec l'ONNX Runtime de
  Beat This! dans le même processus. Sur 14 phrases dites par la voix Hortense de Windows (une voix de synthèse,
  pas un vrai micro) : Parakeet juste partout sauf « Baldur's Gate 3 » (« baldure S GAT3 ») ; Canary entend
  « dix cordes » pour Discord. **Mot d'éveil** : échec des petits modèles anglais / chinois (0 sur 8, en lettres
  comme en phonèmes). Le **zipformer français en flux** (k2-fsa, Apache-2.0, encodeur int8 127 Mo) entend « Hé
  Kayro » comme « KERO » 7 fois sur 7 et « Kayro » seul comme « CAIRO » (une seconde de son avant la phrase est
  nécessaire, comme avec un vrai micro) ; utilisé comme détecteur de mot-clé, il est instable (7 sur 8 ou 0 sur 8
  selon la liste des mots), aucune fausse alerte. Piste retenue pour la suite : détection de parole, puis ce
  modèle en transcription continue, et le mot d'éveil cherché dans son texte (variantes apprises en le disant
  trois fois).
- **Mesures du 2026-11-04** (sonde `bench`, ce processus seul ; Comet lisait un film : 10 % de la machine, les
  durées peuvent être un peu meilleures PC au calme) — 14 phrases, 46 s de son :
  détection de parole 0,4 % d'un cœur, 28 Mo ; modèle français en flux (1 fil) 6,2 % d'un cœur pendant qu'on parle,
  191 Mo, chargé en 1,5 s ; Parakeet (4 fils) chargé en 2,4 s, ~730 Mo, une phrase en 266 ms (médiane, pire
  357 ms ; 2 fils : 347 / 401 ms) ; Canary (4 fils) chargé en 1,4 s, ~320 Mo, 269 ms (pire 332 ms).
- **Cœur Rust (2026-11-04)** : `src-tauri/src/voice/` (état et événements `VoiceStateChanged` / `VoiceHeard`,
  fil d'écoute, mot d'éveil par clé phonétique française, commandes, actions), micro `platform/mic.rs`,
  réglages `config/voice.rs` (`settings.voice` : mode **coupé par défaut**, mot d'éveil « Hé Kayro »,
  push-to-talk Ctrl+Alt+V enregistré seulement dans ce mode, modèle, `inGame`). Un fil, lancé à la première
  activation, endormi (ni micro ni boucle) quand la voix est coupée, en sourdine (« arrête d'écouter »), l'écran
  verrouillé ou, en écoute permanente, un programme en plein écran devant (sauf `inGame`) ; le push-to-talk
  reste actif en jeu. Une phrase ne donne qu'un id de la config ; « ferme X » demande seulement à la page.
  sherpa-onnx lié dans l'exe (bibliothèques vérifiées par `fetch-ai.ps1`). Limites : pas encore d'interface ni de
  téléchargement (modèles à poser dans `%APPDATA%\Kayro\voice\`), modèles gardés en mémoire tant que la voix est
  active, micro ouvert à l'appui du push-to-talk (première syllabe possiblement coupée), non testé dans l'exe.
- **Interface (2026-11-04)** : Réglages › **Assistant vocal et IA** (mode Coupée · En tenant une touche ·
  Permanente, état en direct, mot d'éveil, raccourci, « Écouter aussi en jeu », lignes « Plus tard » : nom de
  l'assistant, apprendre ma voix, modèle économe, assistant IA). **Modèles** : une carte chacun (description,
  taille, mémoire, licence), téléchargement à la demande depuis Hugging Face (fichier par fichier, empreinte
  SHA-256 épinglée, `.part` jusqu'à vérification, annulable, barre au dégradé du thème), désinstallation (refusée
  tant que la voix l'utilise) ; Parakeet ou Canary au choix. **Bouton micro** de la barre du haut et du dock (déjà
  prévu par la DA) : visible quand la voix est active, allumé quand le micro écoute, un clic coupe ou reprend.
  **Retours** dans Kayro : une note après chaque commande ; « ferme X » et un doute ouvrent Kayro et demandent
  (fermeture douce par `close_softly`). Réseau : uniquement ce téléchargement, au clic.
- **Retours de l'utilisateur et corrections (2026-11-04, soir)** : « Dis YUNA » ne réveillait rien. Le petit modèle
  entend « DIOUNOV » / « DIOUNO », Parakeet « Di Une » : comparaison refaite sur toute la phrase d'éveil, une voyelle
  comptant moitié moins qu'une consonne (« OU » → U) ; **apprentissage guidé** en 4 étapes (le mot seul, dans deux
  commandes, encore seul), ce que le modèle a entendu est gardé (`voice.wakeHeard`) ; secours sur le premier verbe
  de commande quand Parakeet écrit le mot autrement. Vérifié de bout en bout sur fichiers (`voice/phrase_tests.rs`,
  vrais modèles, voix Hortense) : 14 cas sur 14, plus « Dis Yuna » appris en une fois. **Bug** : l'écoute se mettait
  en pause devant Kayro lui-même en plein écran (Windows dit « un programme en plein écran » sans dire lequel) :
  seul un autre programme compte. **Choix du micro** (menu déroulant ; ce PC a 9 sorties Voicemeeter en plus du
  Blue Snowball), **aura de l'île** quand elle écoute (Auto : la plus claire des couleurs de la pochette, sinon le
  thème ; ou une couleur choisie), désinstallation possible même voix active (elle est coupée, après demande),
  modèles libérés pendant un jeu ou l'écran verrouillé (≈ 0,9 Go rendus), Réglages en **style Capri** aux couleurs
  du thème, cadres compacts, « Détails » sur chaque modèle. Vérifié dans l'exe (données de test, CDP) : état,
  modèles, micros, aura ; non vérifié avec une vraie voix au micro.
- **Deuxième retour (2026-11-04)** : « après l'apprentissage, rien ne marche ». Cause trouvée dans le journal :
  l'ajout de trois champs à `voice` rendait l'ancien bloc illisible, **les réglages de voix revenaient à zéro**
  (mode coupé, « Hé Kayro »). Corrigé dans la lecture tolérante (`config/store.rs`) : un groupe de réglages garde
  ses valeurs, seuls les champs nouveaux prennent leur défaut (testé). Aussi : la voix se met en pause devant un
  film en plein écran (Comet) tant que « Écouter aussi en jeu » est coupé ; le journal note maintenant chaque
  changement d'état de la voix (jamais la phrase). L'aura ne s'allume plus qu'une fois appelée (mot d'éveil
  entendu ou touche tenue). Menu du micro au-dessus du bloc suivant, à la largeur des noms.
- **Troisième retour, « GIGA complet » (2026-11-04)** : (1) « ferme X » ferme en douceur **sans confirmation**
  (décision de l'utilisateur, notée dans CLAUDE.md avec l'exception de l'écoute permanente) ; (2) **la musique à la voix** :
  mets la musique (Spotify lancé s'il est fermé), pause, suivante, précédente, plus fort, moins fort, coupe le son, mode
  musique allumé / éteint ; **« Votre musique »** : une playlist, un album ou un titre Spotify par un nom (« mets ma playlist
  chill » ; adresse `spotify:` vérifiée, une playlist s'ouvre seulement, Spotify ne la lance pas depuis une autre app) ;
  (3) **Parakeet orienté vers les mots de l'utilisateur** (hotwords : mot d'éveil, apps, scènes, musique, commandes ;
  beam search, +10-20 % de temps) : « Dis Yuna » juste au lieu de « Di Une » ; **double vérification** : le petit modèle
  donne l'alerte (sûre : aura et son tout de suite ; « peut-être » : on attend), Parakeet confirme, et relit aussi toute
  phrase courte que le petit modèle a ratée (dite vite, « Yuna » seul ; mot d'éveil exigé dans les deux premiers mots) ;
  le nom seul réveille, une voyelle entendue autrement aussi ; apprentissage guidé en 5 étapes (avec le nom seul) ;
  (4) **son « listen »** quand l'île entend ; fin de phrase repérée à 0,3 s au lieu de 0,35 ; (5) **« Kayro apprend de
  vous »** (idée de l'utilisateur, renforcement léger par règles, `voice/memory.rs`) : +1 quand une commande tombe juste,
  +2 quand on choisit dans un doute, −2 si l'on referme à la voix dans les 30 s ce qu'il vient d'ouvrir ; seulement vers
  les apps et scènes de la config ; Réglages : compteur et « Oublier ». **Mesuré** (vrais modèles, voix Hortense, normale
  et accélérée) : **28 sur 28** de bout en bout (14 sur 14 avant sur des phrases plus faciles ; les phrases rapides
  échouaient), aucun faux réveil sur 8 phrases pièges. **Essayé et écarté** : Nemotron 3.5 ASR streaming 0.6B
  (NVIDIA, juin 2026, français en flux) : perd le début des phrases, moins bon que le zipformer + Parakeet.
- **Quatrième passe, « au plus précis et au plus large » (2026-11-04)** : (0) **Calibrer ma voix** (`voice/calib.rs`,
  `calib/eval.rs`, `CalibGuide.tsx`) : ≈ 45 cartes en 7 chapitres tirées de la config de l'utilisateur (mot d'éveil, nom
  seul, commandes avec ses apps, plus vite, pièges, parole libre, avec musique), WAV 16 kHz gardés dans
  `voice/me/` (avec ce que jouaient les enceintes), supprimables ; l'évaluation rejoue tout le mode « toujours » et note
  (mot d'éveil, commandes, musique, pièges, voix, temps). Le score d'un ancien format n'efface plus les enregistrements
  (bug trouvé en test). (1) **Seulement ma voix** (`speaker.rs`) : CAM++ zh/en « advanced » (29 Mo, 9 ms par seconde de
  parole), choisi sur 5 modèles et 6 voix ; empreinte = moyenne des enregistrements, seuil = 10e score propre − 0,10, borné
  0,35–0,70 ; sur la synthèse : sa voix 28/28, les 5 autres rejetées (Julie, la plus proche, 0/8). (2) **Variantes du mot
  d'éveil apprises à l'évaluation**, jamais une qui réveille sur un piège ; une variante de moins de 4 sons ou bien plus
  longue que le mot d'éveil est ignorée (« ONA » de l'utilisateur aurait réveillé sur « on a gagné »). (3) **Annulation
  d'écho** (`echo.rs`, crate `aec3` 0.4.0, WebRTC AEC3 en Rust, référence par loopback WASAPI) : sortie linéaire seule (le
  suppresseur coupait la voix : 6/18 contre 11/18), active seulement quand les enceintes jouent, 0,5 % d'un cœur ; écho
  simulé 8 dB sous la voix : 1/18 → 12/18 commandes ; à 0 dB : 0 → 4/18. (4) **Mémoire** : reformulation apprise (une
  phrase qui n'aboutit pas puis une autre qui lance dans les 20 s), correction (refermer puis relancer), doute tranché par
  l'habitude du moment de la journée (≥ 4 lancements et 3 fois plus que les autres). (5) **Compréhension** : règles
  élargies (« tu peux ouvrir… », « je veux jouer à… », « s'il te plaît », « coupe / arrête X », sigles « OBS », « VS
  Code », « c'est trop fort », « change de musique »…) : **46 → 70 sur 70** phrases naturelles ; un modèle de sens
  (embeddings) n'apporterait rien de mesurable ici, donc pas ajouté (CLAUDE.md). Mot d'éveil redit (« Yuna… dis Yuna,
  ferme X ») sauté ; un verbe seul attend la suite. **Non fait, en attente** : un gros modèle sur la carte graphique
  (Canary-1B-v2 ou Whisper) : sherpa-onnx CUDA impose un processus à part et ≈ 0,5 Go + CUDA/cuDNN à télécharger ; à
  décider sur la mesure de la vraie voix. **Limites** : tout est mesuré sur des voix de synthèse ; la vraie voix
  (calibration) reste à enregistrer.
- **La vraie voix (calibration de l'utilisateur, 2026-11-04, 40 enregistrements « Dis Yuna »)** : mot d'éveil 28/32,
  commandes 11/20, musique 2/4, pièges 8/8, sa voix reconnue 40/40 (les 6 voix de synthèse ≤ 0,29 pour un seuil de
  0,60). Causes des ratés : les **hotwords** de ses 127 apps (« ouvre » → « Overwatch » ×3, un souffle → « Claude
  Claude… ») ; Parakeet qui passe à l'anglais (« firm », « cash ») ; des variantes apprises qui étaient des bouts de
  commande (« NA MONTE LE »). Corrigé : apps poussées à 0,5 (mesuré : 0,25 → 15, 0,5 → 15, 1 → 13, 1,5 → 12, aucun →
  10, mot d'éveil et verbes seuls → 12 commandes sur 20), mots de sa voix (« firm », « cash », « m'épose », « mont le
  son », « …bass le son »), variantes tirées des deux modèles, coupées avant la commande, ressemblantes au mot d'éveil
  (distance ≤ 4). **Résultat : commandes 11 → 16/20, musique 2 → 3/4**, mot d'éveil 26/32 (les bouts de commande en
  moins). Canary 180M forcé en français : 27 / 12 / 2, moins bon. **Bug corrigé** : Canary recevait des hotwords et
  faisait tomber Kayro (type `engine::Command`). Dans la vraie vie (journal) : « Dis ARYA » réveille, mais 4 « pas
  compris » et une mauvaise app lancée : la suite proposée est d'entendre mieux et de comprendre librement (GPU).
- **Le cerveau (2026-11-04, accord de l'utilisateur : CLAUDE.md, « interprète de commandes vocales »)** : banc d'essai
  sur sa voix (llama.cpp Vulkan b12110, carte graphique) : Voxtral Mini 3B 11/24 commandes ; Gemma 4 E4B en JSON
  22/24 à 1,4 s ; **Gemma 4 E4B + grammaire courte (« appel oui / ouvrir discord ecran 1 ») : 24/24, 32/32 appels,
  8/8 pièges, 0,16 s** ; E2B 20/24 et 3/8 pièges (écarté) ; une ligne de transcription en plus : +0,3 s (écartée).
  Intégré (`voice/brain/`, `think.rs`) : llama-server dans un processus à part (job object : il meurt avec Kayro,
  127.0.0.1, clé aléatoire), téléchargé à la demande (5,2 Go, empreintes épinglées), rendu en jeu, repli classique s'il
  manque ou échoue ; l'oreille passe en mode ouvert (toute phrase ≤ 8 s va au cerveau, qui juge l'appel) ; « Arya… »
  seul ouvre une suite de 8 s ; plusieurs actions par phrase ; « sur mon premier écran » (`platform/screens.rs`,
  numéros de Windows). **Mesuré par le vrai chemin (oreille + écho + cerveau)** : calibration « Dis Arya » 40/40
  (classique 34/40), « Dis Yuna » 39/40, 22 phrases libres de synthèse 21/22 (« mon jeu de course » → Forza, « le
  logiciel de montage » → DaVinci Resolve, « Blender sur le premier écran et Audacity sur le deuxième ») ; 0,19 s par
  phrase, chargement 4,4 s (35 s la toute première fois : shaders), ≈ 5 Go de mémoire graphique. Essayé et écarté : un
  contre-exemple dans la consigne (déplace les erreurs), une vérification par Parakeet des appels longs (fait rater la
  vraie voix). Limite : « Je vais lancer Steam ce soir avec Arya » est pris pour un appel. Le mot d'éveil entraîné prévu
  n'est plus utile (32/32 appels jugés par le cerveau) ; à refaire seulement si la vraie vie montre des ratés.
- **Suites sans redire le nom (2026-11-04, demande de l'utilisateur)** : après une commande, 15 s pendant lesquelles
  une phrase peut continuer la demande sans « Arya » (aura allumée ; le cerveau reçoit ce qu'il vient de faire et juge ;
  chaque suite comprise relance la fenêtre ; « merci » la ferme) ; après « Arya… » seul, 8 s où la phrase lui est
  adressée. Mesuré sur 12 suites de synthèse : 11/12 (« en fait, reviens à la précédente » après « musique suivante »,
  « mets-le sur le deuxième écran », « non, ferme-le » ; « je reviens dans deux minutes », « tu as vu le match » laissés ;
  « plutôt Valorant » après Forza ferme Forza puis ouvre Valorant). En vrai (journal) : Edge, Comet, musique, fenêtres
  posées sur l'écran 1 et 2, réponses en 0,17–0,5 s, cerveau prêt en 5 s.
- **Relecture et amélioration à deux avec Fable 5.1 en effort Extra (2026-11-04/05, demande de l'utilisateur ; Fable
  propose, Claude vérifie et résume, puis Fable applique)** : bugs corrigés (micro débranché : aura bloquée et écoute
  jamais relancée ; cerveau planté : relancé ; autre voix pendant une suite : aura éteinte à tort) ; cerveau chargé sur
  un fil à part (`brain/slot.rs` : la voie classique écoute pendant les 5 s) ; « Seulement ma voix » : score des 3 dires
  les plus proches (marge avec la voix de synthèse la plus proche 0,01 → 0,10 sur Arya, seuil 0,519 contre 0,417) et
  cohorte des voix de Windows à chaque évaluation (`platform/tts.rs`, `calib/impostors.rs`) ; « Enceintes à écouter »
  (Voicemeeter : les enceintes physiques) ; aura « je reste à l'écoute » (DA-JOURNAL) ; une note pour plusieurs actions ;
  consigne : « cacher Kayro » et « nom seulement mentionné : appel non » ; délai de secours 3 s ; fichiers découpés
  (`voice/events.rs`, `follow.rs`, `ear.rs`, `calib/variants.rs`, CSS en trois) ; +23 tests (401 Rust, 708 interface).
  Mesuré (Claude, après coup) : Arya 40/40, Yuna 40/40, libres 22/22, suites 11/12 et 12/12, ≈ 0,2 s. Écarté : n'envoyer
  au cerveau que ce où le petit modèle entend le nom (28/32 appels), bannir des jetons de contrôle (9/22). Trouvé : un
  bug de llama.cpp (erreur 500 sur 1 phrase de synthèse sur 22 : la voie classique répond). Non testé dans l'exe. Restent
  au-dessus de 400 lignes, déjà avant l'étape : `ipc.rs`, `config/schema.rs`, `desktop/mod.rs`.
- **Bien plus d'usages (2026-11-05, demande de l'utilisateur ; Fable propose, Claude vérifie)** : Edge s'ouvrait parce
  que la grammaire n'avait pas de « je ne sais pas » (11 demandes impossibles sur 15 forçaient une action) : ligne
  `inconnu` → note « Je ne sais pas encore faire ça. », rien lancé ; contexte à chaque phrase (fenêtre devant, apps
  ouvertes, hors du préfixe mis en cache). Nouveaux verbes : fenêtres (écran N sans relancer, plein, réduire,
  restaurer, devant, gauche, droite, fermer celle devant si c'est une app de la config), son (volume N %, son d'une app,
  micro), dernier jeu, Réglages par page, thème, Kysland, aléatoire / répéter / titre, verrouiller, bureau, minuteur,
  heure ; et, avec l'accord de l'utilisateur : capture (Win+Impr), recherche web (Google, requête encodée), dictée
  (SendInput Unicode, sans touche ni retour, 300 caractères, refusée dans les consoles et terminaux). Mesuré par Claude :
  Arya 40/40, Yuna 40/40, suites 12/12 et 12/12, impossibles 15/15, fenêtres 12/12, système 8/8, Kayro 5/5, jeux 2/2,
  son 6/8, musique 3/4, libres 21/22 (s19 « …avec Arya » revenu) ; ≈ 0,2–0,25 s. Vision de l'écran : mesurée (image +
  audio 0,35–0,5 s, juste 1 fois sur 2 sur « ferme cette fenêtre »), reportée (choix de l'utilisateur). Réponses
  parlées : l'utilisateur veut une voix d'IA (pas Windows) ; 5 échantillons locaux (Supertonic 3 MIT, direct dans
  sherpa-onnx ; Piper siwis/upmc/tom et Kokoro : phonémiseur à ajouter) envoyés pour qu'il choisisse. Non testé dans l'exe.
- **Affinages et voix « à ton » (2026-11-05)** : règle déterministe `tidy` (un mode aléatoire/répéter retire une lecture
  parasite, un niveau de son retire un plus/moins) : musique 3 → 4/4 ; contrepartie : « lance la musique en aléatoire »
  ne relance pas la lecture. Laissés, mesurés trop chers : « mets le volume à vingt », « remets le son de Spotify »
  (l'exemple qui les corrige fait Yuna 35/40, « tu as une minute ? » → minuteur), « …avec Arya » (seconde passe oui/non :
  sans effet, +250 ms). Mesuré par Claude : Arya 40/40, Yuna 40/40, suites 12/12 et 12/12, fenêtres 12/12, système 8/8,
  Kayro 5/5, jeux 2/2, impossibles 15/15, musique 4/4, son 6/8, libres 21/22. Voix : les 5 premiers échantillons ne
  plaisent pas ; l'utilisateur veut régler le son (décrit ou cloné d'un extrait qu'il fournit) et la façon de parler
  (réponses courtes formulées par le cerveau). Essais : Qwen3-TTS 1.7B (Apache-2.0 ; clonage par `llama-tts` Vulkan,
  sans Python, 7,7 s pour 3 s de son ; voix décrite en Python ≈ 13 s), Chatterbox Multilingual (MIT, Python, 3,6–5,3 s) ;
  personnalité par Gemma : ≈ +0,2 s, une ligne ≤ 90 caractères. Aucun < 1 s : 12 échantillons envoyés, rien intégré.
- **Voix posée et grave en direct (2026-11-05, mesuré par Fable, vérifié par Claude)** : voix retenue par l'utilisateur,
  conçue une fois (clip de 19 s par la voix décrite) puis clonée à chaque phrase par Qwen3-TTS 1.7B Base (`llama-tts`).
  Phrase entière (≈ 3 s de son) : 1,1–1,7 s en Vulkan, 0,6–1,0 s en CUDA 13.4 (NVIDIA seulement), hors chargement ; mais
  `llama-tts` recharge le modèle à chaque phrase (≈ 4 s Vulkan, 2,6 s CUDA) et `llama-server` b12110 n'a pas de voix :
  il faut un programme à nous, résident et en flux. Mémoire graphique : voix +6,5 Go par défaut (avec le cerveau
  11,2–11,7 Go sur 12,2 : trop juste), +2,9 Go avec `-c 2048 -b 256 -ub 256` à vitesse égale (ensemble non mesuré).
  Personnalités par Gemma (température 0, ≈ 0,2 s) : 9 premières réponses sur 20 ont une erreur (« J'ai lancée »,
  « la minute est écoulée » pour dix minutes…) → phrases écrites par préréglage. Pas de voix d'acteurs réels (JARVIS,
  Grand Sage) : leur esprit par une description.
- **Compréhension des apps (2026-11-05)** : le cerveau ne recevait que les noms des 127 apps (doublons, utilitaires).
  `brain/apps.rs` : une entrée par app (Voicemeeter ×3, Python, FL Studio 2024/2026, Roblox, Dead Cells… → la favorite,
  sinon la plus récente, sinon le nom le plus court ; les jeux Steam/Epic jamais regroupés), les utilitaires retirés
  de la voix (« Check For Updates », « Module Docs »…), et ce qu'est chaque app (« Comet (navigateur) »,
  « DaVinci Resolve (montage vidéo) »…) ; fermer, fenêtres et son prennent la copie qui tourne. Nouvelle série de
  40 phrases sur ses apps : 27 → 32/40. Laissés : « Voicemeeter », « Hue Sync », « WinRAR », « Edge » mal entendus
  par les voix Windows, « Chrome » (absent) → Comet, notes → OneNote, 3D → Blockbench. Séries : Arya 40/40, Yuna
  39/40 (« ferme CrystalDiskInfo » → ouvrir), le reste inchangé. Non testé dans l'exe.
- **Réglages de l'assistant plus simples et films (2026-11-05)** : introduction (le nom d'abord, 6 idées, puis la façon
  de lui parler, puis un seul bouton « Installer {nom} » à une barre, cerveau coché), carte au nom de l'assistant, quatre
  blocs numérotés, antisèche de phrases avec ses apps, avancé replié. Testé par Claude dans l'exe (CDP, données de
  test) : 2 parcours (rien d'installé / tout installé), 7 défauts trouvés et corrigés (nom en capitales « ARYA », deux
  boutons principaux, renvois « plus bas » vers des cartes repliées…). Un film en plein écran dans un navigateur ou un
  lecteur (Comet, Edge, Chrome, VLC…) ne met plus la voix en pause ni ne lâche le cerveau ; les jeux, si.
- **Page simple une fois installé (2026-11-05)** : la carte dit la place prise (« Arya prend 6 Go sur ce PC ») avec
  « Désinstaller Arya » (question avant, la calibration gardée) ; installé et à l'écoute, seules la carte et l'antisèche
  restent, le reste sous « Modifier les réglages ». Vérifié dans l'exe (CDP, données de test, désinstallation non validée).
- [ ] **Affiner les commandes vocales au fil de ses retours** (demande de l'utilisateur, 2026-11-05 : il ajoutera des
  détails au fur et à mesure ; chaque retour = une ligne ici, une phrase dans une série de test, la règle du cerveau).
  - [x] « Cache Discord » (le bouton « – ») cachait Kayro : le cerveau écrit `fenetre <app> cacher` (le même mot
    que la phrase : avec « reduire », « ferme Lossless Scaling » devenait « réduire ») ; « kayro cacher » seulement
    pour Kayro lui-même ; règles de secours pareil.
  - [x] « Lance play sur Comet » ouvrait Spotify : nouvelle action `musique-app <app> lecture | pause | suivante |
    precedente`, sur le lecteur de cette app dans Windows (Comet s'annonce « Comet.… », trouvé par son exe ou son nom).
  - [x] « Ouvre l'explorateur de fichiers » lançait 7-Zip File Manager : l'explorateur de Windows est dit au cerveau
    parmi les apps (`explorateur`, ouvert par Win+E, une chose fixe comme « bureau ») ; 0 → 12/12.
  - [x] « Elle arrête de marcher » : la voix restait en pause « jeu » 15 à 30 min après que Kayro se cache (journaux
    du 05/11 : pause dès le départ de Kayro, reprise à son retour). Windows disait « un programme plein écran tourne »
    pendant le fondu de Kayro lui-même. Seule la fenêtre de devant compte désormais (plus un jeu en plein écran
    exclusif). Vu aussi : « micro couper » à la voix coupe le micro Windows, et Arya ne t'entend plus ensuite.
  - [x] Micro coupé à la voix = voix sourde : son bouton micro s'éteint aussi, et le rallumer remet le micro Windows.
  - [x] Les playlists (« mets ma playlist Hyperpop ») donnaient « musique lecture » : le cerveau les voyait
    « l1, l2… ». Elles ont maintenant un id tiré de leur nom (`kiff-du-moment`) et un exemple avec la première
    playlist ; une playlist demandée retire le « play » et l'« ouvrir Spotify » en trop. Série 4 → 20/21 ; Arya
    40/40 avec ses playlists ; Yuna 38/40 (« Tu as une minute ? » → minuteur 1, nouveau).
  - [x] La playlist s'ouvrait sans jouer (Spotify ne lance une playlist venue de l'extérieur que sur un clic) :
    Kayro appuie sur son bouton « Lire : X » par l'accessibilité de Windows (`platform/spotify.rs`, sur le PC, le
    nom à une lettre près : « Kiffe »/« Kiff »). Essayé sur son Spotify : Hyperpop, Kiff du moment, Festival
    lancées en ≈ 0,7 s, aussi Spotify réduit. Non essayé : Spotify fermé (démarrage à froid, 12 s d'attente).
  - [x] Choisir une musique par son nom (« mets One More Time de Daft Punk ») : action `spotify <nom>` ; Kayro ouvre
    la recherche de Spotify (`spotify:search:`, c'est Spotify qui va en ligne, pas Kayro) et appuie sur le premier
    « Lire » de la zone principale, une fois les résultats stables (`platform/spotify_search.rs`). Essayé : Daft Punk,
    Basique, Tapa Toma, Thriller, Stromae justes en 2 à 5 s ; « orelsan » seul lance la « Radio Orelsan » de Spotify.
    Le cerveau écrit les noms comme il les entend (« deft pink », Spotify retrouve) ; « joue Around the World »
    part encore vers une app (dire « mets ») ; « tapa thomas » trompe Spotify.
  - Mesures (voix Windows) : série « cacher / play » 3 → 8/12, « … sur Comète » 12/12, « … sur Comet » 6 → 12/18
    (les voix françaises lisent « Komé ») ; ta voix : Arya 40/40, Yuna 39/40 ; fenêtres 12/12, son 6 → 7/8, le reste
    inchangé. Non testé dans l'exe avec ta voix.
- [ ] **Réponses parlées d'Arya** → app IA à part (voir « Écosystème Kayro ») : reportées (décision de l'utilisateur, 2026-11-05 : pas encore de modèle de voix
  français assez bon à son goût). À la reprise : la voix posée et grave et les mesures ci-dessus ; pour le timbre, ce
  qui marchait bien dans son projet Grand Sage (sessions Claude « The GREAT SAGE ») ; personnalités en phrases écrites ;
  un programme voix à nous, résident et en flux. Extraits gardés : `spikes/06-voix/voix-posee-grave/` (référence
  de 19 s, échantillon aimé, variantes majordome et analytique ; voix créées par description, aucune voix réelle).
- [ ] **Notre propre modèle** (idée de l'utilisateur, 2026-11-05) : un modèle fait par nous, optimisé pour l'usage de
  Kayro (voix en français d'abord, peut-être aussi la compréhension), quitte à ce que ce soit difficile, pour ne
  dépendre d'aucune limite d'un modèle tiers. Voie la plus réaliste : partir d'un modèle ouvert (Apache/MIT) et
  l'affiner sur des données dont on a le droit (ta voix, voix créées, jeux de données libres) ; un modèle partant de
  zéro demande beaucoup de données et de calcul. À étudier comme une étape à part.

### Avant la v1.0 — Mains (extension B, étape 22)
- **Plan validé le 2026-11-05** (demande de l'utilisateur) : une **souris dans l'air**, pour tout Windows, deux signes.
  Pouce et index écartés = main libre, le curseur suit la base de l'index (image en miroir) ; pincement pouce-index =
  clic gauche, tenu = bouton maintenu (glisser), deux rapides = double-clic ; pincement pouce-annulaire = clic droit.
  Caméra coupée par défaut, allumée par Ctrl+Alt+M, Kysland ou la voix ; éteinte seule sans main (2 min), en jeu,
  écran verrouillé ; témoin : lumière de la webcam + icône dans Kysland. Exception à noter dans `CLAUDE.md` (la main
  clique partout, comme la souris). Limite : Windows bloque les clics simulés vers les fenêtres administrateur.
- **Essai du 2026-11-05** (`spikes/07-mains`, sa propre crate, hors dépôt) : webcam « FHD Camera » par Media
  Foundation (crate `windows`, aucune nouvelle crate), 640×480 NV12 converti en BGRA ; MediaPipe Hands en ONNX
  (OpenCV zoo 2023-02, Apache-2.0 : paume 3,9 Mo + 21 points 4,1 Mo, SHA-256 notés) dans l'ONNX Runtime 1.31.1 déjà
  embarqué, 1 fil. **La webcam ralentit dans le noir** : 15 i/s pièce sombre (horloge de la caméra, tous formats ;
  exposition manuelle → 20), 24–25 i/s lumière allumée. Paume 8,5–9 ms, 21 points 4,7–5 ms ; main suivie 95–100 %
  des images (paume relancée 4 à 40 fois en 30–40 s). **Processeur 1,3–1,5 % de la machine** (cible 1 %), 2,0 % si la
  paume tourne à chaque image. Écarts (points en mètres) : pouce-index pincé 0,8–2,5 cm, libre 3–9 cm ; pouce-annulaire
  pincé 1,8–2,4 cm (suivi moins sûr, 0,5–0,9, 3 pertes), sinon ≥ 3,2 ; pouce-majeur jamais sous 2,5 → l'annulaire
  reste. Base de l'index immobile à 1–2 % près pendant un pincement. Non mesuré : délai caméra → écran.
- **Construit le 2026-11-05** (branche `step-22-mains`) : cœur `src-tauri/src/hands/` (un fil, parqué sans caméra quand
  c'est coupé ; caméra `cam.rs`, suivi `track.rs`, souris `pointer.rs` pure et testée : deux seuils 2,4 / 3 cm, curseur
  figé 0,15 s au pincement, clic droit seulement l'index ouvert, poing = rien, filtre One Euro ; `SendInput`
  `platform/mouse.rs` sur l'écran où est le curseur quand la main paraît ; lueur `glow.rs` sur la couche native de
  Kysland ; recherche de la main 5 fois par seconde au plus quand il n'y en a pas). Réglages `settings.hands`
  (coupé par défaut, Ctrl+Alt+M, amplitude, extinction 1–10 min, lueur, « en jeu »). Modèles téléchargés à la
  demande (téléchargeur de la voix rendu commun, `hands/models.rs`, commit et SHA-256 épinglés) dans
  `%APPDATA%\Kayro\hands\`. ONNX Runtime partagé avec le rythme. Réglages › Mains (Capri, comme la voix), bouton
  mains de la barre du haut (caché depuis la ronde 5) allumé quand la caméra tourne, message de l'île. Tests : cargo
  416 (+9), vitest 708. **Non testé dans l'exe** ; non fait : « mode mains » à la voix, molette.
- **Premier essai de l'utilisateur (2026-11-05)** : « grave cool », assez vif mais pas assez précis ni fluide, petits
  mouvements mal vus, aucun moyen de couper les mains sans le clavier. Repris le jour même : mouvement **relatif avec
  accélération** (comme une souris : lent = au pixel, rapide = loin ; gain 0,6 → 3,2 largeurs d'écran par largeur
  d'image entre 0,04 et 0,5 image/s), ancre au **centre de la paume** (5 points, ne bouge pas au pincement), filtre
  One Euro plus calme (0,8 Hz) ; **poing = soulever la souris** (repart à neuf en rouvrant) ; le curseur **glisse
  entre deux images** (`hands/glide.rs` : fil à part, pas de 4 ms, lissage 18 ms, parqué une fois arrivé, la vraie
  souris reprend la main ; la lueur suit sans être redessinée), le curseur peut changer d'écran ; **pouce levé
  1 s = couper les mains** ; à la voix, « active / coupe les mains » et « ouvre les réglages des mains » (règles et
  cerveau). « Amplitude » devient « Vitesse du curseur ». Cargo 417, vitest 708. Non testé dans l'exe.
- **Deuxième essai (2026-11-05)** : pouce levé et voix OK ; la tenue « saute », un clic reste parfois tenu, les gestes
  rapides font n'importe quoi. Journal : **main perdue toutes les 0,3–1 s** (souvent 1 image, parfois 0,5 s), chaque
  perte relâchait le bouton. Corrigé : **grâce de 0,3 s** (une perte courte ne relâche ni ne bouge rien), recherche de
  la paume **dans la même image** dès la perte, seuil de suivi 0,35 (nouvelle main 0,5), cadre suivant **avancé de
  80 % du dernier déplacement**, saut de plus de 0,12 image en une image = erreur du modèle ignorée, gain rapide
  2,8. Le journal note chaque clic (écarts en cm) et un résumé par session (images/s, % vu, pertes, clics). Cargo 418.
- **Retour au curseur absolu (2026-11-05)** : le mouvement relatif décalait main et curseur (« ultra perturbant », choix
  de l'utilisateur : main et curseur toujours alignés). Le curseur est là où est la paume : zone de 0,42 image de
  large au centre, **aux proportions de l'écran** (même finesse en haut-bas et gauche-droite), filtre One Euro plus
  fort au ralenti (0,6 Hz, β 6) ; le curseur glisse vers sa place (`glide.rs`), sur l'écran où il est quand la main
  paraît ; poing = curseur immobile ; « Vitesse du curseur » redevient « Amplitude ». Gardés : grâce 0,3 s, recherche
  immédiate, saut ignoré, pouce levé, journal. Cargo 418.
- **Troisième essai (vidéo du 2026-11-05)** : (1) OBS tenait la webcam, Kayro réessayait toutes les 0,1 s (210 fois en
  27 s) sans rien dire → nouvel essai toutes les 3 s, état « webcam prise » dit une fois par l'île ; (2) le pincement
  « normal » (index plié) ne cliquait pas, il exigeait l'index tendu → un pincement compte si le bout de l'index n'est
  pas replié dans la paume (`INDEX_OUT` 0,5), et la tenue glisse même index plié ; (3) le clic droit tenu clignotait
  (pouce–annulaire 2,0–3,5 cm) → relâche à 3,8 cm, et chaque relâche demande 2 images de suite (ou 1 cm de plus) ;
  (4) un seul écran atteignable → pousser la main au-delà du bord 0,3 s passe à l'écran voisin. Journal : `refused`
  (pincements refusés, pour régler `INDEX_OUT`). Cargo 422, vitest 708.
- **Validée le 2026-11-05** (« ça joue pas mal », webcam et éclairage modestes). Dernière session : 98 s, 23 i/s, main vue
  84 %, 53 clics, 25 pincements refusés (au plus 0,497 : juste sous `INDEX_OUT` 0,5, à baisser vers 0,4 si les clics
  ratent encore). Limites : un peu de bruit dans le noir ; pas de molette ; CPU de l'exe non mesuré.
- **Main 3D et doigt du clic droit (2026-11-05)** : après l'installation, une main 3D (canvas 2D, `handPose.ts` +
  `handDraw.ts`) montre les signes en boucle ; le clic droit se fait au choix pouce + annulaire ou pouce + majeur
  (`rightFinger`, Réglages › Mains). Vitest 711, cargo 422.
  Puis, sur sa référence (gravure / manga) : la main est ray-marchée en WebGL2 (`handInk.ts`, `handInkShader.ts`) à
  l'encre dans les couleurs du thème ; < 1 ms par image (30 images en 21 ms, page de test) ; repli 2D sans WebGL2.
  « Trop cubique » : paume en dôme (ellipsoïdes : paume, éminence du pouce, talon), poignet aplati, phalanges fondues
  avec un renflement aux articulations, doigts un peu pliés et écartés au repos, hachures qui entourent les formes.
  « Boudiné, articulations trop visibles » (3 passes capture + critique) : doigts fins et effilés d'un seul tube
  (rayons qui se rejoignent aux articulations, plus de sphères), peau entre les doigts, pouce plus fin et plus
  levé, poignet sans couture ; le trait devient une taille-douce (lignes parallèles courbées par la forme, épaisses
  dans l'ombre, rien côté lumière) au lieu des tirets le long des bords.
  Sur ses photos (14, plusieurs angles) : les doigts qui ne pincent pas restent levés et écartés ; paume plate
  presque carrée (plus large aux jointures qu'au poignet) ; les trois grandes lignes de la main (sans elles, la paume
  se lisait comme un dos de main, « à l'envers ») ; pouce plus court, plus levé, sorti de son coussinet.
- **Tutoriel des gestes (2026-11-05)** : DA Kayro (nuit du thème, lune, anneau, gravure de lumière, filet A → B) et
  anatomie revue (pouce à 2 phalanges visibles, solveur 2 os, proportions, ongles) ; 5 scènes en motion design avec un
  petit écran synchronisé (`tutorialScript.ts`, `HandTutorial.tsx`, `MiniScreen.tsx`). Vitest 715.
- **Vraie main (2026-11-05)** : modèle « generic hand » du W3C (`src/features/hands/model/`, licence W3C, embarqué en
  `?inline` : la CSP n'autorise aucun fetch) skinné en WebGL2 (`handModel.ts`, `handSkin.ts`) ; poses calées sur ses os ;
  caméra tournante par scène ; vérifié pose par pose en grand. Vitest 717.
- **Réglages rangés (2026-11-06)** : nouvelle catégorie **« Concept / Fun »** (les mains dedans, sous le titre
  « Mains » ; « ouvre les réglages des mains » y mène) ; « Assistant vocal et IA » devient **« Assistant vocal »**,
  allégé : la carte, comment l'appeler (tant qu'il n'écoute pas), les phrases, et tout le reste sous **« Détails »**.
  Vitest 717, tsc/eslint propres. Non vérifié dans l'exe.

## Abandonné
Idées écartées, gardées ici plutôt que supprimées (ne jamais effacer une idée sans l'accord de l'utilisateur : la déplacer ici, avec la date et la raison).
- 2026-10-30 — Mode Immersif des couleurs du jeu (héros flouté, puis carte des couleurs de l'affiche) et son repli CSS : retiré à la demande de l'utilisateur (« c'est moche »).

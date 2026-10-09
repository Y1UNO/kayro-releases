# PROMPTS — Hub (19 étapes + extensions)

Chaque étape = une session Claude Code **courte et ciblée**. Tu colles le prompt, tu valides, tu testes, tu commits, tu fais `/clear`. Le fichier `CLAUDE.md` du dépôt porte tout le contexte : les prompts n'ont donc pas à le répéter.

## Comment lire une fiche

| Champ | Sens |
|---|---|
| **Modèle** | `/model sonnet`, `/model opus` ou `/model haiku`. **Opus 5.5** = tâches difficiles ou très visuelles. **Sonnet 5.5** = le défaut (rapide, économe). **Haiku 5.5** = micro-retouches. |
| **Effort** | `/effort low` = Faible · `medium` = Moyen · `high` = Élevé · `xhigh` = Extra. Sonnet 5.5 et Opus 5.5 démarrent en `medium` par défaut : règle-le à chaque étape. (`max` : peu de gain pour un quota brûlé. `ultracode` : équipes d'agents automatiques, très gourmand sur Pro, voir LISEZ-MOI §4.) |
| **Plan** | « Oui » = écris `/plan ` devant le prompt (ou Maj+Tab jusqu'à « plan mode on ») : Claude propose, tu valides, puis il code. Les erreurs coûtent moins cher en plan qu'en code. |
| **Quota** | ● léger · ●● moyen · ●●● lourd · ●●●● très lourd (à lancer au début d'une fenêtre de quota fraîche). |
| **À fournir** | Fichiers/captures à mettre dans le dépôt (`reference/captures/…`) ou à tenir prêts. Détails dans `RESSOURCES.md`. |

## Vue d'ensemble

| N° | Étape | Modèle | Effort | Plan | Quota |
|---|---|---|---|---|---|
| 1 | Cadrage et plan technique | Opus 5.5 | Extra | Oui | ●●● |
| 2 | Squelette + spikes de fenêtres | Sonnet 5.5 | Élevé | Oui | ●● |
| 3 | Design system (thèmes, verre, composants) | Sonnet 5.5 | Élevé | Non | ●● |
| 4 | Données, config, IPC typé | Sonnet 5.5 | Élevé | Oui | ●● |
| 5 | Détection des apps (Steam, Epic, Menu Démarrer) | Sonnet 5.5 | Élevé | Oui | ●● |
| 6 | Lanceur + suivi des processus | Sonnet 5.5 | Élevé | Non | ●● |
| 7 | Écran d'accueil (carrousel, catégories, recherche) | Sonnet 5.5 | Élevé | Non | ●●● |
| 8 | Atmosphère dynamique (FxLayer) | Opus 5.5 | Élevé | Oui | ●●● |
| 9 | Ajout et édition d'apps + icônes | Sonnet 5.5 | Moyen | Non | ● |
| 10 | Moteur de scènes (Rust) | Sonnet 5.5 | Élevé | Oui | ●● |
| 11 | Éditeur de scènes + dock + partage | Sonnet 5.5 | Moyen | Non | ●● |
| 12 | Modes d'affichage, widget, raccourci, tray | Sonnet 5.5 | Élevé | Oui | ●● |
| 13 | Performance : veille, qualité adaptative, benchmark | **Opus 5.5** | **Extra** | Oui | ●●●● |
| 14 | Couleurs du jeu (palette automatique) | Opus 5.5 | Élevé | Oui | ●●● |
| 15 | Apparence et thèmes (interface) | Sonnet 5.5 | Moyen | Non | ● |
| 16 | Moteur d'ambiances `.hubmood` + packs + écran Jeu | Opus 5.5 | Élevé | Oui | ●●● |
| 17 | Ambiance sur mesure (1 jeu à la fois) | **Opus 5.5** | **Extra** | Non (brief) | ●●●● / jeu |
| 18 | Audit final (perf, sécurité, accessibilité) | Opus 5.5 | Extra | Oui | ●●● |
| 19 | Installeur et partage aux amis | Sonnet 5.5 | Moyen | Non | ●● |

Jalons : **A** (1–6) « ça lance mes apps » · **B** (7–9) « ça ressemble à la maquette » · **C** (10–12) « scènes et modes » · **D** (13) « c'est fluide » · **E** (14–17) « personnalisation signature » · **F** (18–19) « prêt pour les amis ».

Règle d'or du quota : **Sonnet par défaut**, Opus seulement quand la fiche le dit. Si une étape Sonnet bloque deux fois sur le même problème, passe ce problème précis à Opus Élevé, puis reviens à Sonnet.

---

## Modèle de démarrage de session (identique pour chaque étape)

1. `git switch -c step-NN-nom` (une branche par étape).
2. Lance `claude` dans le dossier du dépôt, puis `/model …` et `/effort …` comme dans la fiche.
3. Si « Plan : Oui », commence ton message par `/plan ` (ou Maj+Tab jusqu'à l'indicateur « plan mode on »).
4. Colle le prompt de la fiche. Relis le plan avant de valider.
5. Teste (la fiche dit comment), demande des corrections ciblées si besoin.
6. Quand c'est bon : `git add -A && git commit` (message en `feat:`/`fix:`…), `git tag v0.N`, puis `/clear`.

---

## ÉTAPE 1 — Cadrage et plan technique
**Modèle** Opus 5.5 · **Effort** Extra · **Plan** Oui · **Quota** ●●● · **À fournir** `docs/MACHINE.md` rempli (voir RESSOURCES.md §2)

```
Lis CLAUDE.md, docs/ARCHITECTURE.md, docs/DESIGN.md et docs/ROADMAP.md en entier, puis parcours reference/ (8 maquettes HTML : lis-les comme du code, ne les ouvre pas dans un navigateur) et docs/MACHINE.md.

ÉTAPE 1 — CADRAGE ET PLAN TECHNIQUE. Tu ne crées ni ne modifies aucun fichier hors de docs/. Tu produis docs/PLAN.md (< 350 lignes).

Contenu attendu :
1. Arborescence cible du dépôt (src-tauri/src/…, src/features/…, etc.), alignée sur ARCHITECTURE.md ; signale tout écart justifié.
2. Choix techniques VÉRIFIÉS dans la documentation actuelle (pas de mémoire) : version de Tauri 2 et plugins nécessaires (raccourcis globaux, instance unique, démarrage avec Windows, glisser-déposer, zone de notification), solution de types partagés Rust↔TS (tauri-specta vs ts-rs, avec recommandation), crate Windows et features nécessaires, parseur VDF, effets de fenêtre natifs (acrylique/Mica) pour un widget transparent, extraction d'icônes. Pour chaque choix : version, raison, alternative écartée.
3. Les 8 risques techniques les plus importants, chacun avec un spike de 30 minutes maximum (question, protocole minimal, critère de réussite, plan B). Doivent au moins couvrir : (a) affichage < 150 ms d'une fenêtre cachée via raccourci global ; (b) fenêtre transparente sans bordure (widget) sur Windows 10 et 11 — ATTENTION : backdrop-filter CSS ne floute que le contenu de la page, pas le bureau derrière la fenêtre ; (c) détection d'un jeu en plein écran ; (d) lecture du cache d'images Steam ; (e) lancement UWP/protocoles et apps « administrateur » ; (f) GPU par processus via compteurs de performance Windows ; (g) coût réel de backdrop-filter + dégradés animés dans WebView2 à haute fréquence ; (h) extraction d'icônes d'exécutables.
4. Confirme ou corrige le découpage de docs/ROADMAP.md (dépendances, tâches concrètes par étape en cases à cocher). Si tu déplaces une étape, explique pourquoi.
5. Budget de performance chiffré (CPU, RAM, temps d'image, démarrage, taille d'installeur) avec la méthode de mesure et en tenant compte de docs/MACHINE.md.
6. Questions bloquantes pour moi (max 8, classées) + hypothèses par défaut si je ne réponds pas.

Règles : si une information n'est pas vérifiable, écris « à vérifier » plutôt que d'inventer. Termine par le rapport de fin d'étape (12 lignes max).
```
**Critères** PLAN.md complet, versions sourcées, 8 spikes chiffrés, questions claires. Tu réponds aux questions bloquantes **dans la même session** (pas besoin de relancer).

---

## ÉTAPE 2 — Squelette et spikes de fenêtres
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●● · **À fournir** rien

```
Lis CLAUDE.md puis docs/PLAN.md (choix techniques + spikes (a), (b), (e partiel) liés aux fenêtres).

ÉTAPE 2 — SQUELETTE ET SPIKES DE FENÊTRES.
A. Squelette : projet Tauri 2 + React + TypeScript + Vite à la racine du dépôt (nom de code Hub ; APP_NAME dans UNE constante Rust et UNE constante TS). Scripts : dev, build, lint, test, typecheck. ESLint + Prettier, clippy, vitest, cargo test (un test trivial chacun). tracing initialisé (fichier tournant dans AppData). Polices Fraunces et DM Sans via @fontsource, chargées en local. CSP stricte, permissions Tauri minimales. .gitignore, README de 10 lignes.
B. Spikes (code jetable dans spikes/, un sous-dossier par spike, chacun avec RESULTATS.md : mesure chiffrée, verdict, plan B) :
  1. fenêtre cachée → affichée par raccourci global en < 150 ms (mesure : raccourci → premier rendu) ;
  2. fenêtre transparente sans bordure en haut d'écran (widget) sur MON Windows ; comparer verre natif (acrylique/Mica via crate dédiée) vs fond semi-opaque ; vérifier ombre, redimensionnement, clics à travers les zones transparentes ;
  3. zone de notification + instance unique + démarrage silencieux ;
  4. mode immersif sans bordure à la taille d'un écran choisi (pas de plein écran exclusif), Alt+Tab fluide, multi-écran.
C. Mets à jour docs/PLAN.md (section spikes) avec les verdicts et propose des ajustements d'architecture si un spike échoue.

Demande-moi avant d'installer toute dépendance lourde ou globale.
```
**Critères** `npm run tauri dev` ouvre une fenêtre ; build release OK ; 4 `RESULTATS.md` avec des chiffres.

---

## ÉTAPE 3 — Design system
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Non · **Quota** ●● · **À fournir** `reference/captures/01-accueil-crepuscule.png`, `…/04-apparence.png`

```
Lis CLAUDE.md, docs/DESIGN.md en entier, puis reference/Liquide.dc.html et reference/Apparence.dc.html (valeurs CSS exactes) et regarde mes captures dans reference/captures/.

ÉTAPE 3 — DESIGN SYSTEM, dans src/design/ :
1. Tokens (couleurs, rayons, espacements, typo, courbes et durées de mouvement) en variables CSS.
2. 5 thèmes intégrés en JSON (src/design/themes/*.json, champs de DESIGN.md) + ThemeProvider qui applique les variables, avec fondu de 0,9 s au changement de thème.
3. Composants : Surface verre (.lg ; variante Éco sans backdrop-filter pilotée par data-quality sur la racine), Button, IconButton, Pill, Chip, Toggle, Slider, SegmentedControl, Tooltip, Dialog (focus piégé, Échap).
4. Fond de base : dégradé du thème, vignette, grain par tuile PNG générée par un script déterministe (scripts/make-noise.mjs, 256 px).
5. Page /dev/catalogue (dev uniquement) : tous les composants sur les 5 thèmes avec un sélecteur de qualité Éco/Équilibré/Élevé.
Contraintes : aucune bibliothèque d'UI externe ; CSS Modules ; pas de filter: blur() sur grandes surfaces ; ≤ 6 backdrop-filter simultanés ; test vitest du contraste ≥ 4,5:1 sur les couples texte/surface des 5 thèmes ; focus visible ; prefers-reduced-motion respecté.
Vérification : compare ton rendu à mes captures (utilise Playwright seulement après m'avoir demandé l'autorisation de l'installer, sinon demande-moi une capture) et liste les écarts restants.
```
**Critères** le catalogue ressemble au style de la maquette (verre, reflet, ombres) sur les 5 thèmes ; tests de contraste verts.

---

## ÉTAPE 4 — Données, config, IPC typé
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●● · **À fournir** rien

```
Lis CLAUDE.md, docs/ARCHITECTURE.md §2 et §8, docs/PLAN.md (solution de types).

ÉTAPE 4 — DONNÉES, CONFIG, IPC TYPÉ.
Rust (src-tauri/src/config/) : dossier AppData/<APP_NAME> ; lecture/écriture JSON versionné (settings, apps, slots, scenes, themes) ; écriture atomique (temporaire puis renommage) ; sauvegarde .bak avant migration ; migrations v→v+1 testées ; fichier corrompu → renommé .corrupt + valeurs par défaut + log (jamais de plantage).
IPC : types Rust ↔ TypeScript générés (solution retenue dans PLAN.md), commandes apps_list/add/update/remove et settings_get/set avec validation côté Rust, événements typés.
TS : ipc/ (client typé), store Zustand (chargement au démarrage, mises à jour optimistes avec retour d'erreur), i18n/ (catalogue fr, t() typée, aucune chaîne en dur dans les composants).
Tests : migrations, fichier corrompu, écriture interrompue (simulée), validation des entrées IPC, test d'intégration ajouter/lire/supprimer une app.
```
**Critères** `cargo test`, `vitest`, `clippy` verts ; `npm run gen:types` régénère le TS ; rien ne plante si je corromps `apps.json` à la main.

---

## ÉTAPE 5 — Détection des applications
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●● · **À fournir** Steam/Epic installés ; chemin Steam si non standard (RESSOURCES.md §3)

```
Lis CLAUDE.md et docs/ARCHITECTURE.md §1 (detect) et §2.

ÉTAPE 5 — DÉTECTION DES APPLICATIONS.
D'abord, INSPECTE en lecture seule les vrais dossiers de ma machine (ne modifie rien) : dossier d'installation de Steam (libraryfolders.vdf, appmanifest_*.acf, arborescence réelle de appcache/librarycache sur 2 niveaux), manifestes Epic (ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item), Menu Démarrer (raccourcis .lnk utilisateur + commun). Dossier introuvable → dis-le et demande-moi le chemin. Résume ce que tu trouves en 15 lignes avant de coder.
Puis src-tauri/src/detect/ : un module par source (steam, epic, startmenu) derrière un trait commun ; DetectedApp {id stable, nom, source, launch (type + cible), icône/affiche si trouvée, déjà ajoutée ?}.
- Tolérance : champ inconnu ou format inattendu → ignorer l'entrée + log, jamais de plantage.
- Steam : toutes les bibliothèques ; ignorer outils/redistribuables (Proton, Steamworks Common Redistributables…) ; lancement par protocole steam://rungameid/<appid>.
- Epic : lancement par protocole du launcher (vérifie le format exact dans la doc et mes manifestes).
- Menu Démarrer : résoudre les .lnk (cible, arguments), dédoublonner, exclure désinstallateurs et fichiers « lisez-moi ».
Scan asynchrone, annulable, hors thread UI ; résultat par source (une source en échec n'empêche pas les autres). IPC : detect_scan + événement de progression.
Tests : fixtures ANONYMISÉES dans src-tauri/tests/fixtures/ construites à partir de mes fichiers réels (chemins/noms remplacés par des valeurs neutres) ; un test par parseur + cas dégradés (fichier vide, VDF tronqué, JSON invalide).
```
**Critères** scan < 2 s (chiffre rapporté) ; je vérifie 5 jeux au hasard dans la liste ; aucun fichier de ma machine n'a été modifié.

---

## ÉTAPE 6 — Lanceur et suivi des processus
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Non · **Quota** ●● · **À fournir** liste de tes apps réelles (RESSOURCES.md §4)

```
Lis CLAUDE.md et docs/ARCHITECTURE.md §1 (launcher, procwatch) et §8.

ÉTAPE 6 — LANCEUR ET SUIVI DES PROCESSUS.
launcher : un SEUL chemin de lancement pour toute l'app (scènes, recherche, widget l'utiliseront). Types exe, lnk, uri, uwp (AUMID / shell:AppsFolder), url, via ShellExecuteEx ; arguments et dossier de travail ; erreurs typées (introuvable, refusé, UAC annulé). App marquée « exige admin » → lancement élevé uniquement si configurée ainsi, jamais automatiquement. Trait Launcher + FakeLauncher pour les tests.
procwatch : liste des processus (sysinfo), rafraîchissement économe (lent au repos, plus vif pendant une scène) ; association app↔processus par exécutable (match.exe) avec repli par chemin ; fenêtre au premier plan (GetForegroundWindow → processus) ; événement app_state_changed {id, running, foreground}. Doit coûter < 0,5 % CPU au repos (mesure et rapporte).
IPC : app_launch, app_focus (ramener au premier plan une app déjà ouverte si possible), apps_running.
Tests : FakeLauncher, mapping processus↔app, erreurs. Test manuel guidé : propose-moi 8 lancements à essayer (exe, Steam, Epic, UWP, lien web, app admin, app déjà ouverte, chemin cassé) et note les résultats dans docs/ROADMAP.md.
```
**Critères** les 8 lancements se comportent ; CPU au repos chiffré.

---

## ÉTAPE 7 — Écran d'accueil
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Non · **Quota** ●●● · **À fournir** captures 01 à 03 (accueil sur 3 thèmes)

```
Lis CLAUDE.md, docs/DESIGN.md (Carrousel, Mouvement, Écrans) et reference/Liquide.dc.html (valeurs exactes), puis regarde mes captures dans reference/captures/.

ÉTAPE 7 — ÉCRAN D'ACCUEIL (features/home).
- Barre du haut en verre : APP_NAME, recherche, boutons modes/voix/mains présents mais désactivés.
- Grand titre de catégorie (Fraunces 92/300) avec transition ; onglets Jeux, Stream, Créativité, Logiciels, Autre.
- Carrousel (carte active 232×324, autres 172×246, écart 20, rayon 26, plaque de nom en verre, reflet toutes les 6 s). Beaucoup d'apps : défilement, 5 visibles, + vue grille (bascule).
- Dock de scènes : emplacement et style prêts, contenu factice jusqu'à l'étape 11.
- Recherche rapide Ctrl+K (palette de commandes : apps + catégories, filtre instantané, Entrée lance).
- Navigation 100 % clavier (flèches, Entrée, Échap, Tab) ; état vide soigné (« Ajouter des apps » ouvre le dialogue de l'étape 9, factice pour l'instant).
Données réelles via le store : affiche si dispo sinon monogramme (cf. AjoutApp.dc.html) ; pastille « ouvert » pour les apps en cours ; clic = app_launch.
Mouvement : ressorts Framer Motion (DESIGN.md), animer transform/opacity seulement, layout stable (aucun saut). Le fond reste STATIQUE (dégradé + vignette + grain) : l'atmosphère dynamique est l'étape 8.
Mesure : temps d'image pendant un défilement rapide avec 60 apps (cible : aucune image > 1,5× le budget à 60 Hz).
```
**Critères** à comparer aux captures sur les 5 thèmes ; aucun saut de layout ; fichiers < 400 lignes. *Si le rendu reste en dessous de la maquette après 2 retouches : une passe Opus Moyen « polish visuel » avec les captures côte à côte.*

---

## ÉTAPE 8 — Atmosphère dynamique (FxLayer)
**Modèle** Opus 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●●● · **À fournir** captures 01 à 03

```
Lis CLAUDE.md, docs/DESIGN.md (Atmosphère : maquette → production ; Mouvement), docs/ARCHITECTURE.md §5, reference/Liquide.dc.html (couches de lumière).

ÉTAPE 8 — ATMOSPHÈRE DYNAMIQUE.
Plan d'abord (15 lignes) : interface FxLayer, boucle unique, budget par niveau de qualité.
Implémente src/fx/ :
- Interface FxLayer {mount, setQuality, setPalette, setFocusTarget, pause, resume, dispose}. UNE boucle d'animation (requestAnimationFrame, delta réel) pour toute l'app.
- CSS : brume en radial-gradient animés par transform seulement ; faisceaux (linear-gradient + mask-image) ; halo sous la carte active qui glisse vers la sélection (0,8 s) ; balancement ±3° sur 12 s.
- Canvas 2D : poussière lumineuse (pool sans allocation par image, comptes par niveau).
- Couches fixes : vignette, grain.
- Pilotage par variables CSS (palette, intensité 0,3–1 venue des réglages). Niveaux Éco/Équilibré/Élevé/Ultra selon la matrice d'ARCHITECTURE.md §5 (Ultra = Élevé pour l'instant).
- pause() arrête réellement la boucle ET les animations CSS (animation-play-state) ; resume() reprend en fondu.
Interdit : filter: blur() sur grandes surfaces ; mix-blend-mode sur plus de 2 couches sans mesure ; animer des propriétés qui provoquent un layout.
MESURE OBLIGATOIRE dans le rapport : temps d'image p50/p95 sur 10 s à 60 Hz et à ma fréquence max, pour chaque niveau ; CPU et GPU du processus WebView2 ; verdict par couche (garder / alléger / retirer). Une couche trop chère est remplacée par une version plus légère, pas gardée lente.
```
**Critères** à Élevé : lumière qui balance, brume qui dérive, faisceau qui suit la carte (comme la maquette F) ; Éco = 0 animation continue ; pause → GPU ≈ 0 %.

---

## ÉTAPE 9 — Ajout et édition d'apps
**Modèle** Sonnet 5.5 · **Effort** Moyen · **Plan** Non · **Quota** ● · **À fournir** capture 09

```
Lis CLAUDE.md, reference/AjoutApp.dc.html (valeurs) et docs/ARCHITECTURE.md §2.

ÉTAPE 9 — AJOUT ET ÉDITION D'APPLICATIONS.
Dialogue « Ajouter des apps », 3 onglets : Détectées (résultats de detect_scan, filtres par source, cases à cocher, catégorie par app suggérée automatiquement, « tout ajouter ») · Glisser-déposer (exe, lnk, URL sur la fenêtre, événement de dépôt Tauri) · Manuel (nom, type, cible, arguments, catégorie, favori, « exige admin »).
Édition/suppression d'une app (clic droit ou bouton) ; changement de catégorie par glisser vers un onglet.
Icônes : extraction de l'icône d'un exe/lnk côté Rust (PNG redimensionné en cache), repli monogramme.
Validation de chaque champ, messages clairs. Aucune app n'est lancée pendant l'ajout.
Tests des validations.
```
**Critères** j'ajoute 20 apps détectées en < 1 minute ; un doublon est signalé.

---

## ÉTAPE 10 — Moteur de scènes (Rust)
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●● · **À fournir** idée de 2–3 scènes que tu veux vraiment

```
Lis CLAUDE.md et docs/ARCHITECTURE.md §3 et §8.

ÉTAPE 10 — MOTEUR DE SCÈNES (Rust, sans interface).
Plan d'abord (15 lignes) : trait Action, machine d'état, annulation.
src-tauri/src/scenes/ : trait Action extensible + actions launch, wait, waitReady, focus, close ; exécuteur asynchrone, ANNULABLE à tout moment ; état par étape (en attente / en cours / ok / échec / ignoré) émis via scene_progress ; champ required par étape ; waitReady = processus ou fenêtre de l'app liée au slot, avec timeout ; close = fermeture douce (message de fermeture de fenêtre), confirmation exigée côté interface AVANT l'envoi, jamais de kill ; slots (slots.json) → app ; slot non relié → étape ignorée et signalée. Journal d'exécution dans les logs. IPC : scenes_list/save/run/cancel.
Tests (FakeLauncher + horloge simulée) : ordre des étapes, annulation pendant une attente, timeout, échec non bloquant vs required, slot manquant, close sans confirmation refusé.
```
**Critères** une scène de 5 étapes tourne sur mes vraies apps (test manuel guidé) ; annulation < 200 ms ; l'interface ne gèle jamais.

---

## ÉTAPE 11 — Éditeur de scènes, dock, partage
**Modèle** Sonnet 5.5 · **Effort** Moyen · **Plan** Non · **Quota** ●● · **À fournir** capture 07

```
Lis CLAUDE.md, reference/Editeur.dc.html, docs/DESIGN.md (Écrans), docs/ARCHITECTURE.md §3.

ÉTAPE 11 — ÉDITEUR DE SCÈNES, DOCK, PARTAGE.
- Éditeur : étapes numérotées reliées par un trait ; ajout depuis la palette (Lancer, Attendre, Attendre prêt, Premier plan, Fermer ; « OBS, lumières, Discord — bientôt » grisé) ; réordonnancement par glisser-déposer ET au clavier ; panneau des slots ; Tester (progression en direct par étape + Annuler) ; Enregistrer.
- Dock de scènes sur l'accueil (remplace le factice) : lancement en un clic, progression discrète. Raccourci par scène : stocker seulement le champ hotkey (l'enregistrement global arrive à l'étape 12).
- Partage : exporter = fichier .hubscene avec NOMS DE SLOTS UNIQUEMENT (aucun chemin, aucune commande) ; importer = validation stricte + écran de liaison des slots à mes apps.
Tests : validation du schéma d'import avec fichiers hostiles (chemin, commande, champ géant, JSON profond).
```
**Critères** je crée « Soirée gaming » en < 1 minute, je la teste, l'exporte, supprime un slot, la réimporte et dois relier le slot.

---

## ÉTAPE 12 — Modes d'affichage, widget, raccourci, zone de notification
**Modèle** Sonnet 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●● · **À fournir** captures 10 et 11 (widget)

```
Lis CLAUDE.md, docs/ARCHITECTURE.md §4, docs/PLAN.md (résultats des spikes de fenêtres), reference/Widget.dc.html et reference/WidgetOuvert.dc.html.

ÉTAPE 12 — MODES D'AFFICHAGE.
Plan d'abord (réutilise les verdicts des spikes).
Implémente : 3 modes — Immersif (sans bordure, taille de l'écran choisi) · Fenêtre · Widget (barre en haut, sans bordure, toujours au premier plan, hors barre des tâches et hors Alt+Tab, panneau déployable) ; changement de mode sans clignotement ; raccourci global configurable (conflit détecté → message clair) qui affiche/cache ; zone de notification (Ouvrir, mode, Scènes, Quitter) ; instance unique (relancer l'exe ramène la fenêtre) ; démarrage avec Windows optionnel et silencieux ; mémorisation position/écran par mode ; Échap ou perte de focus cache (option) ; « Instantané » (fenêtre chargée, cachée) vs « Mode économe » (fenêtre détruite quand cachée).
Widget : 4 styles de barre d'après Widget.dc.html (le style est un réglage) ; panneau déplié d'après WidgetOuvert.dc.html (recherche, scènes, « en cours » avec « au premier plan », récents).
Active enfin l'enregistrement des raccourcis de scènes (champ hotkey de l'étape 11).
Mesure : temps raccourci→visible sur 20 essais (médiane + pire cas), cible < 150 ms en Instantané, ~400 ms en économe.
```
**Critères** le widget n'apparaît ni dans Alt+Tab ni dans la barre des tâches ; multi-écran correct ; aucun scintillement.

---

## ÉTAPE 13 — Performance : veille, qualité adaptative, benchmark, réglages
**Modèle** **Opus 5.5** · **Effort** **Extra** · **Plan** Oui · **Quota** ●●●● · **À fournir** `docs/MACHINE.md`, capture 08. *Lance-la au début d'une fenêtre de quota fraîche.*

```
Lis CLAUDE.md (section Performance), docs/ARCHITECTURE.md §5, reference/Reglages.dc.html, docs/PLAN.md (spikes GPU / jeu plein écran) et docs/MACHINE.md.

ÉTAPE 13 — PERFORMANCE.
Plan d'abord (20 lignes max) : machine d'états, sources de signaux, protocole de mesure. J'attends ma validation.
1. États Actif / Atténué / Veille (src-tauri/src/perf/) : signaux = hub masqué, perte de focus prolongée, jeu plein écran (SHQueryUserNotificationState + fenêtre au premier plan couvrant l'écran et qui n'est pas le hub), écran verrouillé. Transitions en fondu 400 ms. En Veille : FxLayer.pause(), arrêt des timers/boucles/micro/caméra, procwatch au rythme minimal. Reprise en fondu.
2. Qualité adaptative : l'interface envoie le temps par image (échantillonné) ; fenêtre glissante 2 s ; p95 > 1,5× le budget (1000/Hz de l'écran où se trouve la fenêtre) → baisse d'UN cran ; remontée après 30 s stables ; jamais d'Ultra automatique ; hystérésis anti-oscillation ; fréquence d'écran détectée et mise à jour au changement d'écran.
3. Benchmark au premier lancement (3 s, scène d'essai) → niveau recommandé (≤ Élevé) + choix de préréglage ; rejouable depuis les réglages.
4. Réglages · Performance d'après Reglages.dc.html : 5 préréglages (Éco / Équilibré / Élevé / Ultra / Personnalisé, « IDÉAL » sur le recommandé), interrupteurs détaillés, jauges en direct (FPS, CPU, RAM du hub ; GPU via compteurs de performance seulement si le spike l'a validé, sinon masqué avec explication), courbe du temps par image. « Moteur graphique expérimental » : présent mais désactivé tant que WebGL n'existe pas.
5. Mode sans échec : Maj au démarrage OU 2 plantages consécutifs (compteur écrit au démarrage, remis à zéro après 10 s saines).
6. Banc de mesure : `npm run perf:report` lance des scénarios (repos, navigation, hub masqué, jeu plein écran simulé) et sort un tableau CPU/RAM/GPU/temps d'image.
Rapporte les chiffres RÉELS, y compris les échecs.
```
**Critères** hub masqué ≈ 0 % CPU et 0 % GPU ; reprise < 150 ms ; repos visible < 1 % CPU hors animations ; descente de qualité testée en bridant ; aucune oscillation sur 10 min.

---

## ÉTAPE 14 — Couleurs du jeu (palette automatique)
**Modèle** Opus 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●●● · **À fournir** 5–8 jeux de test (RESSOURCES.md §5)

```
Lis CLAUDE.md, docs/ARCHITECTURE.md §6 et §1 (art), docs/DESIGN.md (Couleurs du jeu), docs/PLAN.md (spike cache Steam), reference/Liquide.dc.html (logique gmode) et reference/Apparence.dc.html (contrôle segmenté).

ÉTAPE 14 — COULEURS DU JEU.
Plan d'abord (20 lignes) : parseur du cache Steam tel qu'il est sur MA machine, algorithme de palette, invalidation.
1. art/ : localiser affiche verticale + héros de chaque jeu Steam (structure RÉELLE de mon cache, parseur tolérant, repli si absent) ; image fournie par l'utilisateur pour les autres apps ; copie redimensionnée en cache (webp), jamais d'upload ni d'export ; empreinte du fichier source.
2. Palette (Rust, thread de fond) : réduction ~64×64, quantification en OKLab, score population × chroma, rôles dominant/accent/dark, normalisation (bornes L et C, contraste ≥ 4,5:1), cache cache/palettes.json par empreinte. L'image change (saison, mise à jour Steam) → empreinte différente → recalcul automatique + événement palette_changed. Option « Suivre les mises à jour de l'affiche » (activée par défaut) ; verrouillage de la palette par jeu et réglage manuel (3 pastilles).
3. Interface : modes Désactivé / Léger / Immersif (défaut Léger) pilotant FxLayer et variables CSS comme dans Liquide.dc.html, fondu 0,9 s à chaque changement de carte sélectionnée. Immersif : héros flouté PRÉ-CALCULÉ une fois, en arrière-plan.
Tests : images synthétiques (couleurs connues → palette attendue), image grise / très sombre / très claire (repli sur le thème), contraste, invalidation par empreinte.
Mesure : extraction < 50 ms par image ; aucun impact sur le temps d'image pendant l'extraction.
```
**Critères** je passe de Hades II à Apex : la lumière change de façon crédible et lisible ; Désactivé → thème seul ; je remplace une image par une autre → la palette se met à jour seule.

---

## ÉTAPE 15 — Apparence et thèmes
**Modèle** Sonnet 5.5 · **Effort** Moyen · **Plan** Non · **Quota** ● · **À fournir** capture 04

```
Lis CLAUDE.md, reference/Apparence.dc.html, docs/DESIGN.md (Thèmes).

ÉTAPE 15 — APPARENCE ET THÈMES.
Écran Réglages · Apparence : grille des thèmes (5 + « Créer le mien »), aperçu en direct au survol ; « Couleurs du jeu » (Désactivé / Léger / Immersif) ; « Suivre le soleil » (l'angle et la chaleur de la lumière suivent l'heure du PC ; lever/coucher par défaut 7 h / 21 h, réglables ; AUCUN réseau, AUCUNE géolocalisation) ; curseur d'intensité 30–100 % ; import/export de thème (.hubtheme JSON : validation stricte, limites, couleurs valides, nom/auteur assainis). Thème perso : 3 couleurs choisies, le reste dérivé (contraste vérifié, sinon corrigé et signalé). Sauvegarde dans themes/.
Tests de validation (fichier hostile, couleur invalide, contraste insuffisant).
```
**Critères** je crée un thème, l'exporte, l'importe dans un second dossier de données.

---

## ÉTAPE 16 — Moteur d'ambiances `.hubmood`, packs de base, écran Jeu
**Modèle** Opus 5.5 · **Effort** Élevé · **Plan** Oui · **Quota** ●●● · **À fournir** captures 05 et 06 (écran Jeu)

```
Lis CLAUDE.md, docs/ARCHITECTURE.md §7, docs/DESIGN.md (Ambiances sur mesure), reference/Jeu.dc.html (écran + packs).

ÉTAPE 16 — AMBIANCES.
Plan d'abord (20 lignes) : schéma final avec LIMITES CHIFFRÉES, architecture du rendu, plan de tests.
1. Rust moods/ : schéma .hubmood versionné ; validation stricte (nombre de couches, comptes, longueur des chemins SVG, commandes de chemin autorisées M/L/C/Z seulement, tout le reste rejeté) ; assainissement ; import/export ; IPC moods_list/save/import/export.
2. Rendu src/fx/mood/ : une implémentation de FxLayer en Canvas 2D qui lit n'importe quelle ambiance — particules (ember, dot, star, line, rune, glyph), glyphRing, mist, beam, pulse (onFocus) ; rôles de couleur issus de la palette du jeu (étape 14) ; pool sans allocation ; comptes multipliés selon le niveau de qualité ; ignorée en Éco/Équilibré ; arrêtée en veille.
3. 6 packs de base écrits en .hubmood (Braises, Étoiles, Brume, Runes, Pluie, Aucune), formes ORIGINALES, rangés dans resources/moods/ (chemin à confirmer dans PLAN.md) et copiés dans AppData au premier lancement.
4. Écran d'après Jeu.dc.html : aperçu en direct sur l'affiche réelle, mode de couleurs, packs, densité/vitesse, palette modifiable, import/export, Enregistrer ; association jeu → ambiance (moodId dans apps.json).
Tests : fichiers hostiles (chemin géant, commandes interdites, 10 000 particules, JSON profond) rejetés sans plantage ; rendu sur canvas hors écran.
Mesure : coût de chaque pack par niveau (ms/image) ; budget ≤ 1,5 ms/image à Élevé sur ma machine.
```
**Critères** changer de jeu change l'ambiance en fondu ; densité/vitesse en direct ; un `.hubmood` exporté puis réimporté donne le même rendu.

---

## ÉTAPE 17 — Ambiance sur mesure (à répéter, UN JEU À LA FOIS)
**Modèle** **Opus 5.5** · **Effort** **Extra** · **Plan** Non (mais deux directions à valider) · **Quota** ●●●● par jeu · **À fournir** ton brief + 3 à 5 captures du jeu (RESSOURCES.md §6)

```
Lis CLAUDE.md, docs/ARCHITECTURE.md §7, docs/DESIGN.md (Ambiances sur mesure) et regarde mes captures dans reference/briefs/<jeu>/.

ÉTAPE 17 — AMBIANCE SUR MESURE : <NOM DU JEU>.
BRIEF : jeu · 3–5 mots d'ambiance · mouvement (lent / solennel / nerveux / …) · une phrase d'intention · palette (auto d'après l'affiche, sauf indication) · à éviter.
[ICI : colle ton brief]

Tâche : écrire resources/moods/<jeu>.hubmood (même dossier que les packs de base) avec le moteur de l'étape 16.
1. Analyse mes captures (formes, motifs, rythme, matières) et propose D'ABORD 2 directions (5 lignes chacune). Attends mon choix.
2. Dessine 3 à 8 glyphes/runes ORIGINAUX en chemins SVG, inspirés de l'ambiance et JAMAIS copiés (pas de logo, pas de symbole propriétaire, pas d'illustration du jeu), dans le jeu de commandes autorisé.
3. Compose les couches (particules, anneau de glyphes, brume, faisceaux, pulsation au focus) ; règle les rythmes.
4. Si le moteur manque d'une capacité, PROPOSE une extension minimale du schéma et attends mon accord avant de toucher au moteur.
5. Vérifie : rendu aux 4 niveaux de qualité, lisibilité du texte, coût par image dans le budget, validation du fichier.
Itère avec moi : tu me montres le rendu (capture ou description précise), je corrige, tu ajustes. Maximum 3 itérations dans cette session.
```
**Critères** validé à l'œil ; fichier < 8 Ko ; budget respecté ; aucun contenu officiel.

---

## ÉTAPE 18 — Audit final
**Modèle** Opus 5.5 · **Effort** Extra · **Plan** Oui · **Quota** ●●● · **À fournir** rien

```
Lis CLAUDE.md en entier et docs/PLAN.md.

ÉTAPE 18 — AUDIT FINAL.
Plan d'abord (liste des audits + méthode), puis dans cet ordre :
A. Performance : exécute perf:report sur tous les scénarios, compare aux cibles de CLAUDE.md, corrige les 5 plus gros écarts, rapporte avant/après.
B. Sécurité : revue de CHAQUE commande IPC et permission Tauri (liste blanche minimale), CSP, tous les points d'entrée de fichiers importés (.hubmood, .hubtheme, .hubscene, glisser-déposer), traversée de dossiers, lancement : démontre que rien d'importé ne peut déclencher une exécution arbitraire. Tableau menace → mitigation → test.
C. Robustesse : fuzz léger des parseurs (steam, epic, JSON importés), config corrompue, disque plein simulé, app source supprimée, écran débranché, changement de DPI, veille/réveil du PC, 2 plantages → mode sans échec.
D. Accessibilité : clavier de bout en bout, focus visible, contrastes ≥ 4,5:1 sur les 5 thèmes ET avec chaque mode de couleurs du jeu, prefers-reduced-motion, étiquettes lisibles par lecteur d'écran sur les contrôles principaux.
E. Dette : fichiers > 400 lignes, code mort, TODO, dépendances inutiles (taille du bundle et de l'installeur avant/après).
Livrable : docs/AUDIT.md (≤ 200 lignes) : constats, corrections faites, restes assumés. Tests verts. Aucun changement de comportement visible sans me le dire.
```

---

## ÉTAPE 19 — Installeur et partage aux amis
**Modèle** Sonnet 5.5 · **Effort** Moyen · **Plan** Non · **Quota** ●● · **À fournir** nom définitif + logo si tu en as (sinon Claude propose une icône simple)

```
Lis CLAUDE.md et docs/ARCHITECTURE.md §9.

ÉTAPE 19 — INSTALLEUR ET PARTAGE.
1. Build release + installeur NSIS (bundler Tauri), WebView2 installé si absent, icône et nom via APP_NAME, installation par utilisateur (sans droits admin si possible), désinstallation propre (garder ou supprimer les données au choix).
2. Premier lancement : assistant en 4 écrans (bienvenue → thème → benchmark/préréglage → ajout des apps détectées), puis accueil.
3. Bouton « Exporter les logs » (sans chemins personnels autant que possible) ; écran « À propos » (version, licences des dépendances et polices).
4. Mises à jour automatiques : NE PAS implémenter. Documente dans docs/RELEASING.md la marche à suivre (dépôt de releases public + signature de l'updater Tauri).
5. docs/AMIS.md : « Comment l'installer », 1 page en français simple, avec l'explication de l'avertissement SmartScreen (5 lignes).
```
**Critères** installation testée sur un compte Windows neuf ou une VM ; taille de l'installeur rapportée ; < 2 minutes de l'installation à l'accueil avec ses apps.

---

# Extensions (après la v1.0, une à la fois)

### A. Voix française, appui-pour-parler — Opus 5.5 · Élevé · Plan Oui
```
Lis CLAUDE.md. EXTENSION A — VOIX. Reconnaissance vocale 100 % locale, push-to-talk uniquement (touche configurable), module téléchargé à la demande (taille annoncée avant). Compare 2 options locales adaptées au français (modèle, latence, RAM, licence) et recommande-en une avant de coder. Grammaire FERMÉE : seules des commandes du type « ouvre <nom d'app> », « lance la scène <nom> », « ferme <app> » (avec confirmation), résolues UNIQUEMENT contre mes apps/scènes configurées (correspondance approchée). Aucune commande arbitraire, aucun envoi réseau. Indicateur visible quand le micro est actif ; micro coupé en Veille. Mesure : latence fin de phrase → action, CPU pendant l'écoute.
```
### B. Contrôle par les mains (webcam) — Opus 5.5 · Extra · Plan Oui
```
Lis CLAUDE.md. EXTENSION B — MAINS. Commence par un SPIKE d'une heure : suivi de mains local (compare les options, latence, CPU/GPU, taille), geste « pointer + pincer » pour déplacer le carrousel et valider. Traitement 100 % local, aucune image conservée, indicateur visible, caméra coupée en Veille et hors du hub. Gestes limités à : naviguer, valider, retour. Calibration en 20 s. Verdict honnête du spike avant d'aller plus loin (si la latence ou la conso est mauvaise, on arrête).
```
### C. Intégrations optionnelles (OBS, Discord, lumières) — Sonnet 5.5 · Élevé · Plan Oui
```
Lis CLAUDE.md. EXTENSION C — INTÉGRATIONS. Chaque intégration = un nouveau type d'Action du moteur de scènes (trait existant), désactivée par défaut, réseau limité à localhost/au réseau local, explication claire dans les réglages. Commence par OBS (WebSocket local : démarrer le stream, changer de scène, mettre en sourdine). Plan d'abord, puis une intégration à la fois.
```
### D. Moteur graphique WebGL (optionnel) — Opus 5.5 · Extra · Plan Oui
```
Lis CLAUDE.md et docs/ARCHITECTURE.md §5 et §7. EXTENSION D — WEBGL. Nouvelle implémentation de FxLayer derrière l'interface existante, activable seulement si le benchmark la juge soutenable, lisant les mêmes .hubmood et la même palette. Valeur ajoutée visée : verre réfractif sur les cartes et lumière volumétrique légère. Repli automatique sur CSS/Canvas en cas d'erreur de contexte. Plan chiffré d'abord (coût GPU attendu sur docs/MACHINE.md), prototype sur UN écran, mesure, puis décision avec moi.
```

---

# Prompts utilitaires

**Bug** (Sonnet 5.5 · Moyen)
```
Bug : <ce qui se passe> / attendu : <ce qui devrait se passer> / étapes pour reproduire : <…>. Cherche la cause racine avant de corriger (pas de pansement), ajoute un test qui échoue puis passe, et dis-moi en 3 lignes ce que c'était.
```
**Retouche visuelle** (Sonnet 5.5 · Moyen, ou Haiku 5.5 · Faible pour un simple réglage)
```
Écart visuel : <écran> — voir capture jointe vs reference/<fichier>. Corrige uniquement l'écart (valeurs exactes de la maquette), sans toucher au reste. Dis-moi les valeurs avant/après.
```
**Reprise après une coupure de quota** (Sonnet 5.5 · Moyen)
```
Reprends l'ÉTAPE <N> là où on s'est arrêtés. Lis CLAUDE.md, docs/ROADMAP.md, puis `git status` et `git diff --stat`. Dis-moi en 5 lignes ce qui est fait et ce qui reste, puis continue.
```
**Passe de polish Opus** (Opus 5.5 · Moyen)
```
Compare l'écran <X> à reference/<fichier> et à mes captures. Liste les 10 écarts les plus visibles (valeurs exactes), corrige-les, mesure le temps d'image avant/après.
```

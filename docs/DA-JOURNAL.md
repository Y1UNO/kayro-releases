# Journal de l'atelier de DA (étape 12b)

Historique de l'atelier de DA, puis suivi des changements après le gel (section suivante). Lu au début d'une session qui touche à la DA, avec `docs/DESIGN.md`.

## Gel de la DA (2026-10-14)
**La DA globale est la base de référence : `docs/DESIGN.md` (DA officielle v1), qui prime sur `reference/`.** Ce n'est
pas définitif : des détails peuvent encore bouger aux étapes suivantes, mais selon la règle ci-dessous.

**Règle des changements après le gel**
- Tout changement visuel ou de mouvement après le gel = **une ligne** dans le tableau ci-dessous : date, quoi,
  avant → après, jeton ou fichier, pourquoi, et qui l'a décidé. `docs/DESIGN.md` est corrigé dans le même passage.
- **Aucune signature ne change sans décision de l'utilisateur.** Signatures protégées : ouverture V1-A + pulsation C,
  liaison A, onde de changement de thème, déroulé de la Personnalisation avancée, widget déroulé, passages entre modes
  en fondu avec voile natif, flottaison (Aucune · Légère · Visible · Marquée), langage de mouvement « Vivant ».
- Un dosage passe par son jeton (jamais une valeur en dur) ; un nouvel effet passe par `FxLayer`, avec repli CSS et
  mesure `npm run perf` en Élevée et Éco.

**Ce que le gel a fait** (3 paquets, rendu identique vérifié dans l'exe à chaque arrêt) :
- **Paquet 1** : atelier retiré (écran, plugin Vite, scripts, raccourci, configuration `atelier-bench`), préréglages et
  historique (`src/design/presets/` ; 2 fichiers non suivis rangés dans `reference/archives/presets/`), anciens bancs
  de dev (`?bench`, `/dev/launcher`, `dev:home`), affiches de test, 5 anciens thèmes (migration des réglages gardée),
  polices Fraunces / DM Sans, `widgetStyle`, jetons et textes jamais lus ; `setThemeId` passe par `resolveTheme`.
  Pages `/dev/home`, `/dev/scenes`, `/dev/widget`, `/dev/motion`, `/dev/catalogue` gardées (vérification dans le volet).
- **Paquet 2** : couches « croquis » de l'étape 8 (brume, faisceau, lueur basse, halo, poussière, bande de lumière) et
  `useFxTarget`, anneau en tube `glassRing` (programme et texture en moins), effets 2b jamais retenus (`matter` et sa
  parallaxe, `particleLight`, `cardSheen` et son voile périodique), options `ringGrow`, `veilRender`, `pointerSheen`.
  **Ils existent encore au tag `perf-13-fix`** : pour en faire revenir un comme option, le reprendre depuis git.
  Gardés : le repli CSS complet, `posterGlass` (étape 14), le verre éteint des barres / dock / boutons (il porte
  l'imbrication de la pastille de sélection ; le retirer changerait son rendu).
  Vérification `npm run perf` (R1, R2, I1, A2, Élevée et Éco) : p95 3,7 ms partout ; carrousel au repos ≈ −45 Mo ;
  onde 2–3 images > 8 ms par changement en Élevée (3–6 avant).
- **Paquet 3** : `docs/DESIGN.md`, liste unique « Plus tard » dans `docs/ROADMAP.md`, cette section, `CLAUDE.md`.

**Changements après le gel**

| Date | Quoi | Avant → après | Jeton / fichier | Pourquoi | Décidé par |
|---|---|---|---|---|---|
| 2026-10-14 | Description du thème Lavande-pêche (sous sa carte, Réglages › Thèmes) | « Lavande et pêche du logo. Le thème par défaut. » → « Lavande et pêche du logo. » | `src/design/themes/lavande-peche.json` | Bleu-gris est le défaut depuis R5 | l'utilisateur |
| 2026-10-14 | Affiches sur les cartes d'apps (carrousel, grille) | toutes les cartes en face A → B + icône ou lettre → **affiche locale** quand l'app en a une (image déposée sur la carte, sinon cache Steam : 600 × 900 ou capsule 300 × 450, variante française d'abord), avec le rendu d'affiche déjà présent (`.poster` + `.posterShade`, opacité `--da-poster-opacity` dans le verre) ; sans image, face inchangée. Jeux Steam sans icône du Shell : petite icône Steam (32 px) au lieu de la lettre (scènes, palette, widget) | `src/features/home/art.ts`, `AppCardFace.module.css`, `useAppIcon.ts` | étape 14, paquet 1 (art local) ; le rendu de l'affiche (V9) sera tranché sur la planche | l'utilisateur (plan de l'étape 14) |
| 2026-10-14 | Couleurs du jeu (Léger par défaut) : ambiance du moteur et accents de l'accueil aux couleurs du jeu sélectionné | thème seul → A/B du jeu mêlés au thème (60 %) ; filet du titre, filets de survol, anneau de focus de l'accueil en `--game-a`/`--game-b` ; dialogues et Réglages au thème | `src/features/gameColors/`, `tokens.css` (`--game-a`, `--game-b`), `CategoryTitle.module.css`, `Rim.module.css`, `focusShadow` | planche V1 b, V2 b, V4 a, V5 a, V6 a | l'utilisateur |
| 2026-10-14 | Passage d'un jeu à l'autre : marée | (aucun) → cercle depuis la carte active, 700 ms `standard`, bande 0,55, après 180 ms de sélection posée ; retour au thème sur l'éventail par la même marée | `GAME_COLORS` (`tokens14.ts`), `paletteTween.ts`, `bgShader.ts` | planche V7 c, V8 b, V10 a | l'utilisateur |
| 2026-10-14 | Immersif : nuit et héros du jeu ; carte active : logo ; app sans image : couleurs de l'icône | nuit du thème → nuit du jeu + héros flouté (0,75, fondu 18–60 %) ; nom → logo du jeu (carte active avec affiche) ; face A → B du thème → de l'icône | `heroTexture.ts`, `AppCardFace.module.css` (`.logo`), `useIconFace.ts` | planche V3 b, V9 c, V10 b | l'utilisateur |
| 2026-10-14 | Réglages des couleurs du jeu ; panneau « Apparence » du dialogue de modification | « Couleurs du jeu » masqué → visible dans Visuel (Désactivé · Léger · Immersif) + 7 lignes en Personnalisation avancée ; dialogue : (rien) → images de l'app (3 cases à déposer) et ses couleurs (Automatiques · Choisies · Thème, pastilles A / B, aperçu) | `VisualSection.tsx`, `AdvancedSection.tsx`, `src/features/gameColors/AppArtTiles.tsx`, `AppColorsChoice.tsx`, `AppLook.module.css` | étape 14, paquet 5 : un maximum de personnalisation | l'utilisateur (plan de l'étape 14) |

**Étape 14 — décisions tranchées sur la planche (2026-10-14)** : planche locale `reference/planches-14/` (non suivie :
vrais thèmes, vraies affiches Steam de ce PC lues en place). L'utilisateur retient toutes les options recommandées :
- « Couleurs du jeu » : **Léger** par défaut ;
- V1 b : 60 % de la couleur du jeu mêlée au thème ;
- V2 b : en Léger, l'ambiance (lune, anneau, bokeh, braises, teinte du verre) et les accents (filet du titre, onglet
  actif, anneau de focus, filets de survol) ;
- V3 b : en Immersif, en plus, fond et brume aux couleurs du jeu, et héros flouté de Steam en haut, fondu dans la nuit ;
- V4 a : jamais teintés : texte, dialogues, Réglages ;
- V5 a : A = dominante, B = accent ; une image d'une seule couleur prend l'accent de l'autre image du jeu, sinon du thème ;
- V6 a : bornes des thèmes (L 0,72–0,85, C ≤ 0,12) ;
- V7 c : « marée » depuis la carte active, 700 ms, courbe `standard`, sans View Transition ;
- V8 b : 180 ms après que la sélection se pose, rien pendant un défilement rapide ;
- V9 c : affiche plate, nom sur l'ombre de pied ; logo du jeu à la place du nom sur la carte active ;
- V10 : en sortant des jeux, fondu vers le thème ; app sans image : couleurs de son icône.
Les lignes du tableau ci-dessus suivent au fil du code (paquets 4 et 5).

**Avant le gel** : tout ce qui suit est l'historique de l'atelier (rondes 1 à 5, relecture finale, étape 13). Les
fichiers de préréglages et l'atelier qu'il cite n'existent plus dans l'arbre (tag `perf-13-fix` pour les retrouver).

## Preset courant (avant le gel)
- Nom : **V4 Aéré lumineux** (`src/design/presets/v4-aere-lumineux.json`, thème Bleu-gris, ronde 2b) : base `v4-aere-bleu-gris` (2a) + fond aéré, particules éclairées, matière, voile brillant, affiches dans le verre, pastille « léger rebond ». `active.json` (défaut du catalogue) n'a pas été modifié : toujours V4 Verre liquide, lavande-pêche
- 2a : **V4 Verre liquide** : moteur WebGL2 sur les cartes et les pastilles de sélection seulement, anneau liquide
- Fichiers : `src/design/presets/v4-verre-liquide.json` ; comparaison : `v4-verre-liquide-complet.json` (tout en verre, anneau en tube : état du premier essai 2a), `v4-cristal.json` (V4 de la ronde 1, CSS, moteur coupé), `croquis-12.json` (étapes 3 à 12), `v4-cristal-gpu.json` (anneau seul dans le moteur, comme le spike)
- Branche / tags : `step-12b-atelier-da` / `da-r1`, `da-r2a` (2a commitée le 2026-10-11, avec `v4-aere-bleu-gris`), ronde 2b commitée (`e497060`). Ronde 3a commitée (`7bb5f30`) ; préréglage `v4-r3-signature.json` = V4 Aéré lumineux + ouverture. Ronde 3b : `da-r3b` ; ronde 4a : `da-r4a` ; ronde 4b : `da-r4b-1a`, `da-r4b-1b`, `da-r4b-2`, `da-r4b-2b`, `da-r4b-3` ; relecture : `da-fix-a`, `da-fix-b`, `da-fix-c` ; ronde 5 (dernière avant le gel) : `da-r5-1`, `da-r5-2`, `da-r5-3`

## Mode d'emploi de l'atelier (retiré au gel)
- `npm run dev` puis `http://localhost:1420/dev/atelier` (navigateur) : réglages à gauche (générés depuis `src/design/da/catalogue.ts`), écrans réels à droite (Accueil, grille, ajout d'apps, scènes, éditeur, composants), 11 thèmes, qualité, comparaison A/B, Enregistrer / Charger / Historique, Exporter (→ `active.json` = DA de l'app), Mesurer (10 s).
- **Tes tests à chaque arrêt** (depuis le 2026-10-12) : raccourci Bureau « Kayro — mettre à jour » (recompile la release et relance), puis « Kayro » (l'exe de production, tes données, ton mode). Plus d'atelier ni de `tauri dev` pour tes tests.
- Dans la vraie fenêtre : `npm run dev:atelier-bench` (pendant que `npm run dev` tourne) ouvre l'Accueil avec `?preset=<fichier>` ; le CPU/GPU du bouton « Mesurer » n'a de sens que si l'app Tauri tourne (`scripts/measure-cost.ps1`).

## Ronde 1 — 2026-10-11
**Demande** : outils de l'atelier d'abord ; direction « Velours lunaire + anneau cristal » (maquette `R2-Mix-V4-Accueil`) en CSS/Canvas ; spike WebGL limité à l'anneau, mesuré, avec repli CSS. 6 thèmes du logo ajoutés (les 5 anciens gardés jusqu'au gel). Cormorant Garamond + Manrope installés, Fraunces + DM Sans gardées en option comparable.
**Pistes proposées** : une seule direction (déjà choisie dans le brief) + le croquis pour comparer.
**Fait** :
- Catalogue data-driven (19 éléments : fond, halo de lune, voiles, anneau CSS, anneau GPU, braises, étoiles, cartes, survol, barres de verre, titre, typographies, mouvement + 6 éléments du croquis), validation stricte des préréglages, `active.json`.
- Effets : `src/fx/css/moonFx.ts` (halo + voiles), `css/ringFx.ts` (anneau, reflet tournant ~40 s, sans pulsation), `canvas/particles.ts` (braises + étoiles, 0–40 chacune), `gpu/ringGl.ts` (WebGL2 : réfraction du fond/halo/voiles, dispersion, reflet vers la souris, Fresnel ; repli CSS auto). Les éléments du croquis (brume, faisceau, lueur basse, halo, poussière, bande de lumière) sont des interrupteurs.
- Écrans : cartes 240×336 / 176 (rayon 30, bord, voisines assombries, bassin), survol (soulèvement, inclinaison ≤ 3° vers la souris, reflet qui suit, retour doux, coupé si « réduire les animations »), titre 96 px Cormorant 300 + filet dégradé, barres en pilule, fond radial.
**Gardé / Rejeté** : — (à remplir avec tes mots après ton retour)
**Mesures** (vraie fenêtre WebView2, Rust debug + React de dev, 1707×960 CSS à 150 % = 2560×1440, écran 279 Hz, 10 s sans saisie, CPU/GPU de l'arbre sur ~15 s, GPU = 2 échantillons seulement) :

| Preset | Qualité | p95 (budget 5,4 ms) | Images > 1,5× médiane | CPU (budget) | GPU 3D (< 15 %) |
|---|---|---|---|---|---|
| Croquis 12 | Élevée | 4,9 ms ✅ | 75 / 2 642 | 5,5 % ✅ (< 8) | 3,5 % ✅ |
| V4 Cristal (anneau CSS) | Élevée | 4,3 ms ✅ | 84 / 2 633 | 5,2 % ✅ (< 8) | 4,1 % ✅ |
| V4 Cristal GPU | Élevée | 4,0 ms ✅ | 27 / 2 741 | 4,1 % ✅ (< 8) | 3,0 % ✅ |
| V4 Cristal (anneau CSS) | Éco | 5,3 ms ✅ | 119 / 2 630 | 2,6 % ✅ (< 4) | 1,2 % ✅ |
| V4 Cristal GPU | Éco | 4,3 ms ✅ | 50 / 2 723 | 2,4 % ✅ (< 4) | 1,1 % ✅ |

Lecture : l'anneau WebGL coûte **moins** que l'anneau CSS (le flou de fond `frost` + le reflet tourné en CSS coûtent plus qu'un shader sur la seule boîte de l'anneau). Chiffres en build de dev (React de dev, Rust debug) : à refaire en production à l'étape 13 ; 60 Hz non testé. Repli forcé testé (WebGL2 absent → anneau CSS, raison notée sur `data-gpu-ring-fallback`) ; repli « budget dépassé » et « contexte perdu » non déclenchés (non testés).
**Limites connues** :
- Le shader recalcule le fond, le halo et les voiles derrière l'anneau (pas de capture du DOM) : les étoiles et braises ne sont pas réfractées, et la respiration du halo n'est pas reprise dans la réfraction.
- Changer de thème dans l'atelier recharge les aperçus ; charger un préréglage impose son thème aux deux côtés A/B.
- Aperçus non branchés : widget et réglages (ils demandent le cœur Tauri).
- `particles` en Éco/Équilibré = moitié des particules (le brief le demande) alors que l'étape 8 n'animait rien dans ces niveaux : à trancher à l'étape 13.
- L'anneau CSS ajoute un `backdrop-filter` (si `frost` > 0) hors du compteur des 6 surfaces.
- `reference/animations/` absent : aucune vidéo traitée (ffmpeg 9.0.2 présent).
**Prochaines pistes** : ton retour à l'œil sur V4 ; anneau GPU plus épais / plus de réfraction ; étendre le moteur GPU aux cartes et barres de verre si le spike te plaît ; animation d'ouverture, catégories qui se déplient, éditeur (chaîne), widget (douceur de B).

## Ronde 2a — 2026-10-11 (moteur de verre liquide)
**Demande** : aucun vrai liquid glass ressenti à la ronde 1 → tout le verre passe par le moteur WebGL2 ; fond riche réfracté (étoiles, braises comprises) ; anneau plus visible ; curseur lumineux ; atelier « Verre liquide » + interrupteur avec / sans moteur. Références : `reference/inspirations/` (Apple Liquid Glass). Décision : cartes en **verre teinté, teinte faible**, rebord épais en lentille, affiche un peu transparente (réglage par type de carte).
**Fait** :
- `src/fx/gpu/` : un seul canvas plein fenêtre sous l'UI. Passe 1 : fond (dégradé, lune, voiles, bandes de lumière, lumière du curseur, vignette) + sprites instanciés (braises, étoiles = mêmes graines que la ronde 1, bokeh) dans une texture. Passe 1b : anneau = tube de verre dessiné dans la texture sur sa seule boîte (il réfracte particules et bokeh ; les cartes réfractent l'anneau). Passe 2 : verre plein écran (≤ 24 formes, SDF de rectangles arrondis, union lisse « fusion » entre verres proches, verres imbriqués en 2e couche ; lentille sur l'épaisseur du rebord, centre neutre ; dispersion par canal ; flou par mips ; biseau, spéculaires nets, reflet du curseur, ombre douce, teinte).
- Registre DOM `src/design/glass/glassRegistry.ts` : `useGlass` / `<Surface glassKind>` / `<IconButton glass>` / cartes. Mesure `getBoundingClientRect` à chaque image dessinée (sans re-render React), opacité de la chaîne, découpe par le conteneur qui défile. Élément dessiné = `data-glass="gpu"` (son look CSS est retiré) ; sinon le CSS de la ronde 1 reste.
- Cadence : 60 i/s ambiant (30 en Éco), cadence écran (≤ 144) pendant qu'un verre ou la souris bouge, rien quand tout est immobile. Replis : WebGL2 absent / shader refusé / contexte perdu → CSS (`data-glass-fallback` sur <html>) ; images perdues (p95 > 2 × médiane deux fenêtres de suite) → résolution 75 %, puis CSS par type (boutons → dock → barres → cartes → anneau), puis global.
- Catalogue (`src/design/da/catalogueGlass.ts`) : `glassEngine` (on = avec moteur ; réfraction, épaisseur, dispersion, flou, biseau, reflets, ombre, fusion, résolution), `glassRing`, `glassCards` (+ opacité de l'affiche carrousel / grille, retrait), `glassBars`, `glassDock`, `glassButtons` (facteurs × du global + teinte) ; fond : `lightBands`, `bokeh`, `cursorLight` (moteur seulement). `ringGpu` et `ringGl.ts` retirés (champ ignoré dans les vieux préréglages).
- Captures avant / après (vraie fenêtre, même état) : `docs/captures/da-r2a-avant-apres.jpg` (+ les deux pleine taille).
**Gardé / Rejeté** : — (à remplir avec tes mots après ton test)
**Mesures** (vraie fenêtre WebView2, Rust debug + React de dev, 2560×1440, écran 278 Hz, bench « idle » 10 s ; p95 = intervalle entre images, pas le temps GPU ; CPU/GPU de l'arbre sur ~10 s, 3–4 échantillons GPU) :

| Preset | Qualité | p95 | Images perdues | CPU | GPU 3D |
|---|---|---|---|---|---|
| V4 Verre liquide (moteur) | Élevée | 3,7 ms ✅ | 0 et 2 / 2 800 (2 essais) | 1,5–1,7 % ✅ | 4,7–4,8 % ✅ |
| V4 Cristal (CSS, avant) | Élevée | 3,7 ms ✅ | 0–1 / 2 800 | 3,3 % (8,9 % sur un essai perturbé) | 3,8 % (8,7 %) |
| V4 Verre liquide (moteur) | Éco | 3,7 ms ✅ | 0 / 2 800 | 1,4 % ✅ | 1,2 % ✅ |
| V4 Cristal (CSS) | Éco | 3,7 ms ✅ | 0 / 2 799 | 1,4 % ✅ | 1,1 % ✅ |

Lecture : le moteur plein écran coûte ~1 point de GPU de plus que le CSS mais **moins de CPU** (plus de `backdrop-filter`). 60 Hz non testé ; build de production non mesuré (étape 13).
**Testé** : tsc, eslint, vitest 394/394 (+ budget, rayons, opacités, préréglages), build de prod sans code d'atelier (grep), repli « WebGL2 absent » et « contexte perdu » déclenchés dans le navigateur, interrupteur avec / sans moteur dans l'atelier. `cargo test` non relancé (aucun changement Rust).
**Non testé / limites** :
- Repli « budget dépassé » jamais déclenché en vrai (logique testée en unitaire seulement).
- Lumière du curseur et reflets qui suivent la souris : non vérifiés à l'œil (captures prises sans souris dans la fenêtre). « Réduire les animations » non testé avec le moteur.
- Les applis de test n'ont pas d'affiche : l'opacité de l'affiche n'apparaît pas sur les captures.
- Restent en CSS : étiquette du nom sur les cartes, pastille de l'onglet sélectionné, sélecteur Immersif / Fenêtre / Widget, recherche, dialogues. Inclinaison des cartes approximée par leur boîte (≤ 3°). Contraste du texte sur verre clair non mesuré.
- Moteur actif = couches du croquis (brume, faisceau, poussière…) masquées.
### Ronde 2a, ajustements après ton test — 2026-10-11
**Ton retour** : très beau, perfs OK ; mais (1) affiche bien visible derrière un verre fin, (2) moteur seulement sur les cartes et les pastilles de sélection, le reste en CSS, (3) anneau fin, diffus, liquide (rotations irrégulières, gouttes qui se décrochent puis se re-fondent), (4) rebord des cartes trop épais, le reflet du curseur ne doit pas l'élargir (capture annotée).
**Fait** :
- Cartes : affiche à opacité 1 par défaut (réglage gardé, carrousel et grille), retrait de 3 px : le verre n'est plus qu'un fin rebord autour. Rebord : épaisseur globale 26 → 14 px, cartes × 0,75 (≈ 10 px), biseau 0,75 → 0,55 ; nouveau réglage **Netteté des reflets** (exposant 30 → 300, défaut ≈ 230 au lieu de 70) ; reflet du curseur limité au bord (exposant lié à la netteté, liseré de 0,8 px au lieu d'un halo de 2 px).
- Où : par défaut `glassCards` + nouveau type **`glassPills`** (pastille de sélection : épaisseur, flou, teinte claire, durée du glissement, étirement liquide). `glassBars`, `glassDock`, `glassButtons` gardés, désactivés : barres, dock et boutons ronds reviennent au CSS de la ronde 1.
- Pastilles (`src/design/glass/SelectionPill.tsx`, `pillMotion.ts`) : un élément mesuré glisse sous l'onglet choisi (barre du bas, Immersif / Fenêtre / Widget) ; le bord avant part en premier, la pastille s'étire puis se resserre (≤ 12 % d'écrasement), boucle d'image commune, sans animation si « réduire les animations ». La barre reste en CSS : sa couche dépolie passe dans un pseudo-élément **percé à l'endroit de la pastille** (masque CSS qui suit la pastille), sinon le `backdrop-filter` de la barre floutait la pastille du moteur. Sans moteur : fond CSS « sélectionné » d'origine.
- Anneau : nouvel élément **`liquidRing`** dessiné dans le shader de fond (plus de passe à part) : SDF d'un cercle au rayon qui ondule (≤ 1 px), liseré fin + halo doux, deux reflets qui tournent à vitesse irrégulière et changent parfois de sens (`ringPhase`), une goutte de temps en temps (`dropAt` : gonfle, s'étire, se détache presque, se re-fond, 7 s, union lisse). Réglages : épaisseur, flou, intensité, vitesse, fréquence et ampleur des gouttes. L'anneau en tube (`glassRing`) reste disponible, désactivé.
- Page de dev : `/dev/home?posters=1` (une image de test sur chaque carte : aucune appli n'a encore d'affiche, `posterUrl` renvoie toujours null hors dev) et `?cycle=ms` (change d'onglet tout seul).
- Préréglages : `v4-verre-liquide.json` = ces choix ; `v4-verre-liquide-complet.json` = premier essai 2a ; `v4-cristal-gpu.json` sans pastilles ni anneau liquide.
- Captures (vraie fenêtre) : `docs/captures/da-r2a2-accueil.jpg`, `da-r2a2-affiches.jpg` (avec affiches de test), `da-r2a2-pastille-glissement.jpg` (10 images du glissement Jeux → Stream).
**Mesures** (vraie fenêtre WebView2, build de dev, 2560×1440, 278 Hz, 10 s sans saisie) : V4 Verre liquide, Élevée : p95 3,7 ms, 0 image perdue / 2 800, CPU 2,2 %, GPU 3,5 % (avant l'éclaircissement de la teinte des pastilles, sans effet sur le coût). **Éco non remesuré** : tu utilisais le PC (la fenêtre de test volait le focus).
**Testé** : tsc, eslint, prettier, vitest 399/399 (+ glissement de la pastille, rotation et gouttes de l'anneau, préréglages, échelle de repli avec « pastille »), build de prod sans atelier ni image de test (grep). **Non vérifié à l'œil** : les gouttes de l'anneau (pas visibles sur les rafales prises), la lumière du curseur sur le nouveau rebord fin, la pastille du sélecteur de mode en mouvement (seulement à l'arrêt : cliquer « Widget » change vraiment de mode).
**Ta question (le verre et les images des jeux)** : le moteur ne lit pas le HTML, mais une affiche est une image locale : il peut la charger comme texture (même URL que la balise `<img>`) et la réfracter / la refléter réellement dans le verre de la carte (reflet de l'affiche sur le rebord, couleur qui « bave » dans le verre). Coût : une texture par affiche visible (5 cartes). Proposé pour 2b avec le voile spéculaire, si tu veux.

**Reste à faire (2b, après ton accord)** : particules éclairées (halo additif, bloom léger, profondeur, parallaxe, lumière sur le verre proche), matière/atmosphère (brume, grain, poussière, faisceaux) au catalogue avec coût, voile spéculaire de la carte sélectionnée calculé par le moteur (au-dessus d'une affiche opaque : petite surcouche à trancher), animations en ressort (onglets, mode, dock, cartes) avec préréglages « net » / « léger rebond ».

## Ronde 2b — 2026-10-11 (atmosphère, matière, affiches, ressorts)
**Demande** : partir de `v4-aere-bleu-gris` (= `actif.json`, commité avec la 2a, tag `da-r2a`) ; fond plus aéré et lumineux sans le charger ; puis, un par un avec capture + mesure Élevée ET Éco : particules éclairées, matière, voile brillant, affiches en textures, ressorts.
**Préréglage de travail** : `v4-aere-lumineux.json` (la 2a reste `v4-aere-bleu-gris` pour comparer). Mesures : vraie fenêtre WebView2, build de dev, 2560×1440, 278 Hz, bench « idle » 10 s, `&theme=bleu-gris` (le paramètre `?preset=` n'applique pas le thème du préréglage).

| Point | Préréglage | Qualité | p95 | Images perdues | CPU | GPU 3D |
|---|---|---|---|---|---|---|
| 0 avant | v4-aere-bleu-gris | Élevée | 3,7 ms ✅ | 0 / 2 800 | 1,4 % | 3,5 % |
| 0 fond aéré | v4-aere-lumineux | Élevée | 3,7 ms ✅ | 0 / 2 800 | 2,3 % | 3,5 % |
| 0 fond aéré | v4-aere-lumineux | Éco | 3,7 ms ✅ | 0 / 2 800 | 0,9 % | 1,0 % |
| 1 sans (souris dans la fenêtre) | v4-aere-lumineux, particleLight off | Élevée | 3,7 ms ✅ | 0 / 2 800 | 2,2 % | 3,5 % |
| 1 particules éclairées | v4-aere-lumineux | Élevée | 3,7 ms ✅ | 0 / 2 800 | 1,7 % | 3,5 % |
| 1 particules éclairées | v4-aere-lumineux | Éco | 3,7 ms ✅ | 0 / 2 799 | 1,3 % | 1,0 % |
| 2 sans (souris) | v4-aere-lumineux, matter off | Élevée | 3,7 ms ✅ | 0 / 2 799 | 4,4 % ⚠️ | 8,1 % ⚠️ |
| 2 matière | v4-aere-lumineux | Élevée | 3,7 ms ✅ | 1 / 2 799 (max 7,3 ms) | 2,2 % | 3,5 % |
| 2 matière | v4-aere-lumineux | Éco | 3,7 ms ✅ | 0 / 2 800 | 1,3 % | 1,0 % |
| 3 voile (moteur) | v4-aere-lumineux | Élevée | 3,7 ms ✅ | 0 / 2 800 | 2,1 % | 3,6 % |
| 3 voile (moteur) | v4-aere-lumineux | Éco | 3,7 ms ✅ | 0 / 2 800 | 1,0 % | 1,0 % |
| 3 voile CSS sur affiches | v4-aere-lumineux + `posters=1` | Élevée | 3,7 ms ✅ | 1 / 2 796 (max 14,3 ms) | 3,0 % | 4,6 % |
| 4 affiches en textures, à l'arrêt | v4-aere-lumineux + `posters=1` | Élevée | 3,7 ms ✅ | 0 / 2 800 | 2,3 % | 3,6 % |
| 4 **2a** (réf.), onglets toutes les 1,5 s, sans affiches | v4-aere-bleu-gris + `cycle=1500` | Élevée | 7,2 ms ❌ | 211 / 2 439 | 6,2 % | 9,5 % |
| 4 **2a** (réf.), onglets + affiches DOM | v4-aere-bleu-gris + `posters=1&cycle=1500` | Élevée | 7,2 ms ❌ | 229 / 2 412 | 6,6 % | 9,3 % |
| 4 affiches DOM (posterGlass off), onglets | v4-aere-lumineux + `posters=1&cycle=1500` | Élevée | 7,2 ms ❌ | 223 / 2 425 | 6,1 % | 8,5 % |
| 4 affiches en textures, onglets | v4-aere-lumineux + `posters=1&cycle=1500` | Élevée | 7,2 ms ❌ | 214 / 2 426 (aucun repli) | 6,1 % | 7,8 % |
| 4 affiches en textures, onglets | v4-aere-lumineux + `posters=1&cycle=1500` | Éco | 7,1 ms ❌ | 176 / 2 524 (aucun repli) | 4,8 % | 3,4 % |
| 5 ressorts « léger », onglets | v4-aere-lumineux + `cycle=1500` | Élevée | 7,2 ms ❌ (comme 2a) | 211 / 2 423 | 6,3 % | 9,5 % |
| 5 ressorts « net », onglets | idem, spring net | Élevée | 7,2 ms ❌ (comme 2a) | 211 / 2 438 | 6,0 % | 9,1 % |
| 5 ressorts « léger », onglets | v4-aere-lumineux + `cycle=1500` | Éco | 7,1 ms ❌ (comme 2a) | 182 / 2 559 | 5,5 % | 4,8 % |
| 5 final, au repos | v4-aere-lumineux | Élevée | 3,7 ms ✅ | 0 / 2 799 | 2,3 % | 3,7 % |
| 5 final, au repos | v4-aere-lumineux | Éco | 3,7 ms ✅ | 0 / 2 800 | 1,2 % | 1,0 % |

- **0. Fond aéré** : nouveaux réglages `moonHalo.spread` (« Largeur de la lueur » : le coude du dégradé passe de 55 % à 70 % du rayon et de 35 % à 75 % de l'intensité, queue adoucie) et `backdrop.lift` (« Clarté du fond » : fond mêlé à un mélange clair du thème), dans le moteur (`bgShader.ts`) et dans le repli CSS (`Moon.module.css`, `Backdrop.module.css`). Défauts à 0 = rendu 2a inchangé. Valeurs de `v4-aere-lumineux` : lune 0,42 / 720 px / spread 0,35, voiles 0,21 / 0,18, vignette 0,45, clarté 0,06. Luminance moyenne de la capture 27 → 34 / 255. Capture : `docs/captures/da-r2b-0-avant-apres.jpg`. CPU de 1,4 à 2,3 % entre deux essais identiques en coût GPU : bruit de mesure (3 échantillons). Repli CSS du fond aéré : non vérifié à l'œil.
- **1. Particules éclairées** : nouvel élément `particleLight` (`src/design/da/catalogueAir.ts`, désactivé par défaut ; intensité 0,6, portée × 1, halo 0,35 dans `v4-aere-lumineux`). Calcul par particule dans le vertex shader des sprites (braises et étoiles, pas le bokeh) : lumière reçue de la lune, de l'anneau liquide et du curseur → plus claire (jusqu'à × 2,2), un peu plus grande, plus pâle. Moteur seulement (repli CSS = particules d'avant). Vérifié à l'œil dans le navigateur (A/B en direct) et en vraie fenêtre souris posée (`da-r2b-1-particules-eclairees.jpg`) : effet discret à 0,6. Coût non mesurable (GPU identique à 3,5 %). La lueur du curseur sur le fond reste peu visible sur les captures (intensité 0,3 de la 2a).
- **2. Matière** : nouvel élément `matter` (désactivé par défaut ; grain du rebord 0,35, profondeur du rebord 0,4, parallaxe 12 px dans `v4-aere-lumineux`), chaque valeur à 0 = partie coupée. Dans `glassShader.ts` : bruit de valeur sur une grille de 1,5 px, accroché au verre (coordonnées relatives au centre de la forme, il ne glisse pas quand la carte bouge), qui dépolit un peu le rebord (décalage de réfraction ± 2 px et lumière ± 0,09) ; profondeur = la paroi intérieure du rebord ombre l'intérieur (− 30 % × réglage, sur ~7 px) et son arête accroche un filet de lumière. Parallaxe : les particules suivent le curseur avec un retard doux (450 ms ; étoiles × 0,35, bokeh × 0,65, braises × 1), retour au centre quand la souris sort, coupée si « réduire les animations » ; images en plus seulement pendant ce glissement. **Écart au plan** : le grain du fond reste `backdrop.grain` (tuile CSS déjà dessinée au-dessus du canvas du moteur, coût déjà mesuré) au lieu d'un grain dans le shader. Capture `da-r2b-2-matiere-rebord.jpg` (zoom × 2) : épaisseur du rebord nette, grain du rebord à peine visible. Mesure « sans » perturbée (CPU 4,4 %, GPU 8,1 % sur ce seul essai, sans changement de code entre les essais) ; « avec » = 3,5 % de GPU comme au point 1. Tests : `src/fx/gpu/air.test.ts` (parallaxe, préréglages, éléments 2b désactivés par défaut).
- **3. Voile brillant** : nouvel élément `cardSheen` (désactivé par défaut ; intensité 0,3, glissement 1,8 s, largeur 28 %, angle 18°). Timing commun pur (`src/fx/gpu/sheen.ts`, testé) : la bande glisse (ease-in-out) puis se repose 70 % du cycle (cycle 6 s à 1,8 s). Moteur : bande douce + cœur plus net dans `glassShader.ts`, sur la carte sélectionnée dont le moteur dessine l'intérieur ; images en plus seulement pendant le glissement (aucune au repos). Au-dessus d'une affiche DOM ou sans moteur : `SheenVeil.tsx`, animation Web ponctuelle + un minuteur comme `Shine.tsx` (jamais d'animation CSS infinie : 17 % d'un cœur mesurés à l'étape 8). « Réduire les animations » : bande fixe à 38 %, × 0,6. Capture `da-r2b-3-voile-brillant.jpg` : voile moteur bien visible ; voile CSS sur affiche claire **très discret à 0,3** (présent, vérifié par différence d'images). Le passage « affiches » coûte +1 point de GPU et +1 point de CPU (affiches DOM + animation pendant le glissement) ; 1 image perdue (14,3 ms) sur cet essai. **Incident de mesure** : Vite n'avait pas pris la dernière écriture d'`AppCard.tsx` lors du premier passage « affiches » (refait après vérification dans le DOM).
- **4. Affiches dans le verre** : nouvel élément `posterGlass` (désactivé par défaut ; réfraction × 1, reflet 0,35, 6 textures au plus). `src/fx/gpu/posterTextures.ts` (testé avec un faux GL) : même URL que l'`<img>` (cache du navigateur, rien n'est copié ailleurs ni envoyé), décodage hors du fil principal (`createImageBitmap`, ≤ 512 × 720), une texture par affiche utilisée (dédoublonnée par URL), au plus une mise en GPU par image, libérée 30 images après que plus aucune carte visible ne l'utilise ; échec de chargement ou image refusée (CORS, `SecurityError`) → la carte garde son `<img>`. Cartes du carrousel seulement (`data-stage`) ; la grille garde ses affiches DOM. Shader : l'affiche est dessinée sous le verre de la carte (comme `object-fit: cover`), courbée par la lentille du rebord avec une frange par canal, reflétée en miroir flou sur le rebord ; teinte, reflets, profondeur et voile brillant passent dessus. L'`<img>` est masquée (`visibility: hidden`) seulement quand sa texture est dessinée dans la même image. Repli au budget : nouveau **premier barreau `poster`** de l'échelle (`budgetWatch.ts`) ; le dernier barreau pris s'affiche maintenant dans le résultat du bench de dev (`rung`). Page de dev : `?posters=1` répartit 3 images de `reference/inspirations/` sur les cartes (pour tester plusieurs textures et leur libération). **Correctif** : le halo de lumière sous la carte active (`.glow`, DOM au-dessus du canvas) voilait l'affiche du moteur (+20 de vert mesuré dans les violets) → percé à la forme de la carte (masque CSS, rayon venu du catalogue : `--da-card-hole`). Capture `da-r2b-4-affiche-texture.jpg`. **Mesures** : à l'arrêt, + 0,1 point de GPU. **Le changement d'onglet dépasse le budget (p95 7,2 ms, ~210 images perdues sur 10 s à un changement toutes les 1,5 s) dans tous les cas, 2a comprise** : ce n'est pas un effet de la 2b ; cause non cherchée (build de dev, re-rendu React du carrousel ?), à étudier à part. Mémoire GPU estimée (non mesurée) : ≤ 1,9 Mo par affiche avec mips, 3 affiches de test → ~6 Mo. **Limites / non testé** : affiches en production (`posterUrl` renvoie encore `null` hors dev ; le CORS du protocole asset de Tauri n'est pas vérifié : repli DOM automatique si refus) ; décalage éventuel d'une image entre l'affiche du moteur et le nom DOM pendant le glissement du carrousel (non vérifié à l'œil) ; carte soulevée au survol (4 px) : le trou du halo ne suit pas le soulèvement (fin liseré possible en bas). Repli « image refusée » testé en unitaire seulement.
- **5. Ressorts** : `glassPills.spring` = préréglage nommé « net » (sans rebond, courbe de la 2a, défaut) ou « leger » (dépasse sa cible de 5 % du trajet puis revient ; table `SPRINGS` dans `pillMotion.ts`, plafond `MAX_BOUNCE` = 8 % vérifié par test). Ressort amorti analytique (`springAt`, pur, testé : départ et arrivée exacts, `net` sans dépassement), l'étirement liquide reste ; barre du bas et Immersif / Fenêtre / Widget (même `SelectionPill`). « Réduire les animations » : saut direct (inchangé). Sans moteur, pas de pastille donc pas de ressort. Capture `da-r2b-5-ressorts-pastille.jpg` (Jeux → Stream, ~30 ms entre images) : ~5 px de dépassement sur ce trajet, discret. Coût : nul (identique à « net »). **Non vérifié à l'œil** : la pastille Immersif / Fenêtre / Widget en mouvement (cliquer change vraiment de mode) ; « réduire les animations » (voile fixe, pastille, parallaxe) non testé avec le réglage Windows.

**Testé (fin de 2b)** : tsc, eslint, prettier (fichiers touchés), vitest 410/410 (+ `air.test.ts` : préréglages, parallaxe, voile, ressorts ; `posterTextures.test.ts` : chargement, libération, plafond, refus), build de production sans code d'atelier ni image de test (grep). `cargo test` non relancé (aucun changement Rust).
**Gardé / Rejeté** : — (à remplir avec tes mots après ton test)

## Ronde 3 — 2026-10-11 (animations signature)
**Demande** : 3 sous-rondes avec arrêt et validation à l'œil entre chacune. Specs : `reference/animations/R3-*.txt` (les .txt font foi, « MES REMARQUES » vides ; maquettes HTML lues comme du code pour les valeurs exactes). Contraintes : p95 ≤ 5,4 ms en Élevée ET Éco en vraie fenêtre 2560×1440 ~278 Hz, au repos ET pendant la transition ; reduced motion = état final direct ; repli CSS sans WebGL ; transform/opacity seulement hors moteur ; anneau et verre par le moteur ; ressorts par `SPRINGS` (≤ 8 %) ; tout réglable dans l'atelier, couleurs du thème ; une transition à la fois (jeton) ; CSS < 400 lignes. Cette conversation : **3b-0 (diagnostic) + 3a seulement** ; 3b dans une nouvelle conversation qui repart de ce journal.

### Tes décisions (à appliquer en 3b)
- **Parcours** : au lancement de Kayro seulement : ouverture → **éventail** → (clic) liaison → carrousel. Rappel par Ctrl+Alt+H : directement le carrousel de la dernière catégorie (hub masqué sur l'éventail → remis sur le carrousel sans animation). Bouton « Toutes les catégories » dans la barre du haut → retour animé vers l'éventail. **Échap sur l'éventail** → carrousel de la dernière catégorie (animation inverse = liaison vers cette carte) ; Échap sur le carrousel garde son rôle.
- **Flottaison** : les 5 cartes flottent très légèrement (phase et amplitude propres, très lent), la survolée un peu plus + les filets ; amplitudes repos et survol réglables ; aucune en reduced motion ; boucle arrêtée dès que l'éventail n'est plus affiché (60 i/s, 30 en Éco).
- **Ouverture** : une fois par démarrage du programme, au premier affichage ; jamais au rappel par raccourci ; désactivable (`opening.on`).
- **3c** (éditeur « chaîne de points », dépliage du widget) : accepté en principe, **non implémenté** → prochaine petite ronde (voir « Reste à faire »).

### 3b-0 — diagnostic du changement d'onglet (p95 7,2 ms depuis la 2a)
**Méthode** : banc CDP sur la vraie fenêtre (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 npm run dev:atelier-bench`, puis navigation vers `/dev/home?preset=…&bench=…` ; scripts gardés hors dépôt), une variable à la fois, puis trace Chromium (`Tracing`).
**Cause** : ni le moteur (moteur coupé : 7,2 ms, 229 perdues), ni la pastille (coupée : 7,2 ms, 199). La trace montre, pendant ~450 ms après chaque clic, le fil GPU saturé (≈ 50 ms occupées sur 50) par des **repeints du document entier 2560×1440 à chaque image** : le ressort Framer Motion qui fait entrer la catégorie (`.layer` de `HomeScreen`, et le titre de `CategoryTitle`) est piloté en script, sur des éléments sans couche de composition propre → chaque image repeint la racine.
**Correctif** (2 lignes, mesuré utile) : `will-change: transform, opacity` sur `.layer` (`HomeScreen.module.css`) et `.title` (`CategoryTitle.module.css`).

| Changement d'onglet toutes les 1,5 s (`cycle=1500`) | Qualité | p95 | Images perdues / 10 s |
|---|---|---|---|
| avant (3 essais) | Élevée | 7,2 ms ❌ | 209 / 224 / 224 |
| après (4 essais) | Élevée | 3,7 ms ✅ | 83 / 34 / 48 / 38 |
| après | Éco | 3,7 ms ✅ | 28 |
| repos, après le correctif | Élevée / Éco | 3,7 / 3,7 ms ✅ | 0 / 0 |

Reste : le commit React de la nouvelle catégorie (11–17 ms en build de dev, une tâche par clic) et le repeint des boutons d'onglets (transition de couleur) ; la 3b remplace de toute façon ce remontage par le deck (mêmes cartes, pas de remontage). **Leçon pour la suite** : un élément animé depuis le script doit avoir sa propre couche (`will-change`) pendant l'animation.

### 3a — Ouverture V1-A « les lettres sortent du logo »
**Fait** :
- Séquence pure `src/features/opening/openingTimeline.ts` (`openingAt(t, réglages, géométrie)` → toutes les valeurs à l'instant t). Base V1 figée selon la spec (fond 700 ms ; halo 100/1 400 ; anneau 200/1 100 en 3 filets ; reflet 950/1 050 ; logo 950/800 ; éclat 1 450/900 ; anneau ×1,4 + fondu 1 750/850 ; filet 2 550/700 ; sous-titre 2 800/600 ; braises dès 2 500). V1-A : glissement du logo à 1 750, lettres toutes les 85 ms dès 2 000, opaques à 30 % du trajet. **Décalages des lettres et distance du glissement mesurés dans la page** (le logo part centré dans la fenêtre ; chaque lettre part du centre final du logo) : sur la maquette, la formule redonne K −127 … o −326 (test).
- Moteur (`bgShader.ts`, `uniforms.ts`, `engine.ts`) : fondu du fond depuis la couleur la plus sombre, halo centré, **anneau dessiné depuis le haut dans le sens horaire avec ses 3 filets** (A 1,6 px, B 1 px dedans, blanc 0,8 px dehors) et le reflet (arc de 70 px + lueur) ; braises / étoiles / bokeh en fondu (`uKind`) ; couches de l'accueil (lune, voiles, bandes, anneau liquide) à 0 pendant l'ouverture puis en fondu au passage. Le moteur échantillonne la séquence avec sa propre horloge (même grille d'images que le DOM) et ne redessine que si l'image change.
- DOM (`Opening.tsx` + `runOpening.ts` + `Opening.module.css`) : logo de la marque (tuile 132 px), éclat, 5 lettres (depuis `APP_NAME`), filet A→B, sous-titre (messages `opening.*`). **Flou sans filtre animé** : fondu enchaîné avec une copie floue fixe (logo 14 px, lettres `letterBlur`) ; Éco : pas de copie floue. Styles écrits seulement s'ils changent.
- Saut : clic ou touche → fin immédiate (la touche n'atteint pas l'accueil). Reduced motion : composition finale tout de suite, puis accueil après `max(1,2 s, tenue)` sans fondu. Sans moteur : fond, halo et anneau en CSS (l'anneau apparaît en fondu, sans tracé ni reflet), par-dessus l'atmosphère CSS jusqu'au passage.
- Passage à l'accueil échelonné : l'ouverture s'efface sur les 55 premiers % de `handoff`, l'accueil arrive sur les 70 derniers % (sinon le nom et les cartes se superposaient à mi-fondu).
- Quand : `useOpening.ts` + nouvelle commande Rust **`opening_due`** (`ipc_desktop.rs`, testée) : « now » une seule fois par processus quand la fenêtre est visible ; « later » si elle est cachée (démarrage silencieux : page sombre et accueil masqué jusqu'au premier affichage) ; « no » ensuite (le mode économie recrée la fenêtre à chaque rappel, la page ne peut pas s'en souvenir). Types régénérés (`npm run gen:types`).
- Option **`ringGrow`** (désactivée) : l'anneau grandit et se déplace jusqu'à l'anneau de l'accueil (`crystalRing`), puis passe la main à l'anneau liquide.
- Atelier : écran « Ouverture (rejouable) » + bouton **Rejouer** (message `replay`) ; élément `opening` (groupe Mouvement, `src/design/da/catalogueMotion.ts`, libellés `src/dev/atelier/labelsMotion.ts`) : vitesse générale, durée et courbe du glissement, délai entre lettres, durée / courbe / échelle / flou de départ des lettres, rayon de l'anneau, anneau → accueil, tenue, passage. Nouvelle courbe `vive` = `cubic-bezier(.16,1,.3,1)` dans `EASES`.
- Pages de dev : `/dev/home?opening=1` (`&seek=ms` fige un instant, `&loop=ms` rejoue, `&bench=transition` mesure).
- Valeurs finales = celles de la spec (aucune retouche sans ton œil) : vitesse 1, glissement 650 ms « premium », lettres 85 ms / 800 ms « vive » / 0,45 / 6 px, anneau 200 px, tenue 600 ms, passage 600 ms.

**Socle pour 3b** (déjà là, testé) :
- `src/design/motion/curve.ts` : `cubicBezier`, `curveOf("cubic-bezier(…)" | "ease"…)`, `seg(t, délai, durée, courbe)`, `lerp`. Le ressort de la spec liaison `(.34,1.32,.64,1)` dépasse de **3,4 %** (test) → à ajouter dans `SPRINGS` (ex. « liaison » 0,034) en 3b.
- `src/design/motion/choreo.ts` : `Choreo.play(durée, render, {eco, reduced, from})` / `seek` / `cancel` / `time(now)` ; plafond = `FX_MAX_FPS` (30 en Éco) sur la grille commune du `frameLoop` ; une séquence à la fois (la précédente se résout `false`) ; `activeSequences()` pour le banc. `render` écrit transform/opacity directement ; **les éléments animés doivent avoir `will-change` pendant la séquence**.
- `src/fx/gpu/cues.ts` : `setIntroCue(sampler)` (le moteur appelle `sampler(now)` à chaque image ; `sameIntro` évite les images inutiles) ; à étendre en 3b pour le survol (filets, étincelles) et les poses des cartes tournées.
- Banc : `BenchResult.during` = p95 / max / perdues des seules images où une séquence tourne (`?bench=transition`).

**Mesures 3a** (vraie fenêtre WebView2, build de dev, 2560×1440 = 1707×960 CSS à 150 %, 278 Hz ; ouverture rejouée toutes les 5 s pendant 10 s, donc ~95 % des images « pendant » ; le remontage React toutes les 5 s compte dans le max) :

| Ouverture | Qualité | p95 pendant | Images perdues pendant | Max |
|---|---|---|---|---|
| premier jet | Élevée | 5,0 ms ✅ (serré) | 74 | 24 ms |
| premier jet | Éco | 4,4 ms ✅ | 23 | 22 ms |
| final : styles écrits seulement s'ils changent (2 essais) | Élevée | **4,6 / 4,3 ms ✅** | 40 / 33 | 36 / 30 ms |
| final | Éco | **4,0 ms ✅** | 15 | 31 ms |
| repli CSS (moteur coupé), premier jet | Élevée | 5,3 ms ✅ | 101 | 36 ms |

Coût des copies floues ≈ 0,3 ms de p95 (`letterBlur` 0 : 4,7 ms au premier jet). Trace : 0 repeint pendant l'ouverture, GPU ~20 % occupé, le reste = fil principal (recalcul des couches, réduit par l'écriture conditionnelle). **Mesures écartées** : une dernière série (repos compris, à 5,3 ms) a été prise pendant qu'**Apex Legends tournait** (≈ 4 cœurs + GPU) et en même temps que le script PowerShell CPU/GPU ; elle n'est pas retenue. **CPU / GPU de l'ouverture : non mesurés proprement** (à refaire PC libre, script lancé seul). Repli CSS non remesuré après l'écriture conditionnelle. Build de production non mesuré (étape 13) ; 60 Hz non testé.

**Captures** : `docs/captures/da-r3a-ouverture-sequence.jpg` (0 → 3 400 ms puis l'accueil ; l'image « 5000 ms » = accueil après passage, prise avant l'échelonnage du passage), `da-r3a-ouverture-2100.jpg` (lettres qui sortent), `da-r3a-ouverture-finale.jpg`, `da-r3a-anneau-accueil-et-reduit.jpg` (option `ringGrow` à 2,3 s et 4,1 s ; reduced motion émulé), `da-r3a-repli-css.jpg` (sans moteur, 0,4 / 1,3 / 2,9 s). « Avant » = pas d'ouverture (l'app ouvrait directement l'accueil).

**Testé** : tsc, eslint, prettier (fichiers touchés), vitest **429/429** (+ `motion.test.ts` : courbes, ressort 3,4 %, choreo avec faux `frameLoop`, annulation, reduced, seek ; `opening.test.ts` : instants clés, lettres, décalages vs maquette, passage, vitesse, `ringGrow`, préréglages, uniformes neutres), `cargo test` 174 ✅, clippy ✅, build de production sans code d'atelier (grep). En vraie fenêtre (page de dev) : séquence, saut par touche (accueil à opacité 1, ouverture retirée), reduced motion (émulation CDP), repli CSS, `ringGrow`.
**Non testé** : le vrai démarrage de l'app (`App.tsx` → `opening_due` : lancement normal, démarrage silencieux puis premier raccourci, mode économie) — seule la page de dev a été vue ; lecteur d'écran sur le texte caché « appuie sur une touche… » ; 60 Hz / autre échelle.
**Limites connues** :
- Repli CSS : pas de tracé de l'anneau ni de reflet ; étoiles absentes pendant l'ouverture ; avec `ringGrow` l'anneau CSS ne se déplace pas.
- L'anneau d'ouverture est centré sur la position de départ du logo (la maquette le met 11 px plus bas).
- Le logo est celui de la marque (`brand/Logo`, coin 23,6 px pour une tuile de 132) et non la tuile de la maquette (coin 34 px).
- Une touche pressée pour sauter l'ouverture est consommée (Échap compris).

**Gardé / Rejeté** : — (à remplir avec tes mots après ton test)

### 3b-A — Liaison A « l'éventail pivote, puis le deck se déplie » (2026-10-11, non commitée)
**Décisions de cette session** : survol à filets / étincelles sur **l'éventail seulement** (le survol du carrousel reste celui de la ronde 1). Plan court validé (fichiers, ordre, risques).
**Fait** :
- **Séquences pures** `src/features/home/fan/fanTimeline.ts` : la maquette anime par transitions CSS entre 5 phases (`choose`, `turn`, `deck`, `spread`, `close`) ; on rejoue ce modèle en fonction pure du temps. Chaque piste (rotation d'une carte, x d'une app, opacité du titre…) reçoit à chaque étape une cible avec délai / durée / courbe ; la transition part de la valeur **courante** (sémantique CSS, une même cible n'est pas relancée). Donc une séquence lancée au milieu d'une autre part de là où sont les éléments (jeton d'annulation de `Choreo`, sans saut). Étapes : liaison 0 / `turnMs − 200` (650) / +420 (1 070) ; onglet 0 / `regroup` (380) ; retour 0 / 380. Valeurs de la spec : 7°/rang, pivot 1 300 px, sortie 15°/rang, rotation 850 ms `bascule` = `(.65,0,.35,1)`, autres cartes fondu + flou 500 ms départ 120 ms, carte choisie −30 px ×1,06 puis ×0,6 −14 px en fondu, deck ±7 px / ±4 px −10 / 3,5° par rang / ×0,55 (courbe `(.4,0,.2,1)`, 700 ms), ordre `(k·3 + mélange·2) mod 5`, dépliage 700 ms ressort **`SPRINGS.liaison` = 0,034** (= la courbe `(.34,1.32,.64,1)` de la spec), décalage 70 ms du centre vers les bords, retour décalé de 35 ms par rang, anneau +140 px ×0,9 transparent hors carrousel (0,9 s / 0,6 s).
- **Director DOM** `linkDirector.ts` : écrit transform / opacity directement (aucun rendu React par image), `will-change` seulement pendant la séquence, `data-seq` coupe les transitions CSS du carrousel ; à la fin, styles en ligne retirés et le CSS reprend aux mêmes valeurs (pas de saut). Même horloge que le moteur : `Choreo` passe maintenant **avant** le moteur dans la boucle d'images (`frameLoop.subscribe(…, first)`), le moteur mesure ce que l'image vient d'écrire.
- **Moteur** : nouveau cue `setStageCue` (`cues.ts`) = poses des cartes (centre, demi-taille, rayon, angle, douceur, ordre d'empilement) + anneau (décalage, échelle, opacité). Une forme posée n'est plus mesurée par `getBoundingClientRect` (boîte englobante d'une carte tournée). Nouveau tableau `uX[24]` (cos, sin, douceur, ordre) + `uNS` : les formes empilées (éventail, deck) viennent après les autres, de l'arrière vers l'avant, **jamais fusionnées** ; chacune est dessinée par-dessus l'image déjà composée (ombre comprise). Rotation dans le repère de la forme (affiche en texture comprise). Douceur = bord adouci + flou par mips (le « flou 6 px » des cartes qui sortent, sans filtre CSS). Budget : 168 vecteurs d'uniformes < 224 (test). `engine.ts` découpé (`glassPass.ts`).
- **Éventail** `CategoryFan.tsx` + `.module.css` : 5 cartes verre (moteur) 210×290 r24, dégradé du thème `--grad-a` → `--grad-b` par rang (`color-mix`, réglage « Opacité du dégradé » 0,85) dans le retrait de l'affiche, lettre 76/300, nom 19/700, « N apps ». Flou : copie floue **fixe** en fondu enchaîné (Éco : aucune). Titre « Choisis un univers / Que veux-tu lancer ? » (11/700 .32em, 64/300) en fondu avec le titre de catégorie.
- **Onglet sans remontage** : `deckKeys.ts` (pur, testé) donne aux nouvelles apps les clés React des anciennes à la même place → mêmes `AppCard`, seules les props changent ; plus de couche `AnimatePresence` par catégorie en carrousel (gardée pour grille / vide). Tinte du verre relue quand une carte change d'app. Dans le deck, seul le visage (lettre, nom) de la carte du dessus est visible (le texte DOM est au-dessus du canvas) ; les autres reviennent en sortant du deck. Crayon et halo de la carte masqués pendant la séquence.
- **Parcours** (`useCategoryLink.ts`, `HomeScreen.tsx`, `TopBar.tsx`, `useOpening.ts`, `App.tsx`) : au lancement (réponse `opening_due` ≠ « no », même ouverture coupée) → éventail ; clic / Entrée → liaison ; onglets et PageHaut/PageBas → regroupement + redépliage (grille : changement simple) ; bouton **« Toutes les catégories »** (barre du haut, à droite du logo) → retour animé ; **Échap sur l'éventail** → liaison vers la dernière catégorie ; flèches sur l'éventail = focus de carte en carte ; fenêtre masquée sur l'éventail → carrousel sans animation (rappel Ctrl+Alt+H). Onglets, dock et zone des cartes inertes sur l'éventail. « Réduire les animations » ou élément coupé → état final direct.
- **Atelier** : élément `categoryLink` (groupe Mouvement) : vitesse, angle, pivot, angle de sortie, durée et courbe de rotation, flou, durée du dépliage, ressort (`liaison` / `leger` / `net`), décalage, pause du deck, opacité du dégradé. Écran **« Catégories (rejouable) »** + Rejouer.
- **Pages de dev** : `/dev/home?fan=1` ; `?seq=link|tab|back&seek=ms` (instant figé) ; `?fan=1&loop=ms&seq=link|tab|back` (une sorte de séquence en boucle, pour le banc). `?preset=<nom sans .json>`.

**Testé** : tsc, eslint, prettier (fichiers touchés), vitest **446/446** (+ `fan.test.ts` : valeurs de la spec, étapes, phases, ordre du deck, carrousel au repos = fin du dépliage, ressort 3,4 %, reprise sans saut, vitesse, clés héritées ; `glassPose.test.ts` : formes posées, empilement trié, détection de changement, cue, budget d'uniformes). Dans le navigateur (volet de l'app, 1707×960) : éventail, liaison, deck empilé avec affiches en textures, dépliage, onglet (noms qui changent pendant le regroupement), retour, Échap, flèches, ouverture → éventail, réduit (préférence simulée), repli CSS (préréglage `v4-cristal`). `cargo test` non relancé (aucun changement Rust).
**Non testé / reporté** : **mesures (p95, images perdues) en vraie fenêtre, Élevée et Éco, et captures `da-r3b-*`** : VALORANT tournait (~4,6 cœurs) pendant toute la session, et la fenêtre de test aurait volé le focus ; les captures du volet du navigateur ne sont pas fiables (le moteur se met en veille quand la page n'a pas le focus, le canvas retarde). Build de production non relancé (grep du code de dev). Vrai démarrage de l'app (`opening_due` → éventail) et rappel Ctrl+Alt+H : non vus (page de dev seulement).
**Limites connues** : repli CSS : l'anneau CSS ne descend pas pendant l'éventail ; le texte DOM des cartes est toujours au-dessus du verre du moteur (d'où le visage masqué sous le deck) ; changement de z au début du dépliage (la carte centrale passe devant, comme la maquette) ; la flottaison et le survol (filets, étincelles) = partie B.

**Ton retour** : liaison A validée visuellement.

### 3b-B — Survol et flottaison de l'éventail (2026-10-11, non commitée)
**Fait** :
- `src/features/home/fan/fanFloat.ts` (pur, testé) : **flottaison** de chaque carte = deux sinus lents (période `floatPeriod` 7 s × 0,8–1,25 et × 1,7, phases fixes tirées d'une graine : même rythme à chaque démarrage), amplitude repos 2,5 px → survol 5 px, ±0,3 × amplitude en x, rotation ≤ 0,04° / px ; **survol** : niveau 0 → 1 en 350 ms `(.22,1,.36,1)` (spec), soulèvement 12 px, grossissement 3 %, inclinaison ≤ 3° vers le curseur (lissée, 120 ms) ; clavier : le focus d'une carte = survol. Éco : moitié des étincelles. « Réduire les animations » : ni flottaison, ni soulèvement, ni inclinaison, ni étincelles ; filets fixes.
- **Où c'est dessiné** : la carte (bouton) reste immobile = zone de survol stable (la souris ne la perd pas en la soulevant) ; son image intérieure (`.lift`) porte flottaison / soulèvement / inclinaison (transform). Le moteur reçoit la même pose (soulèvement, grossissement, flottaison) et creuse l'**ombre** de la carte survolée (`uHov`). La carte survolée passe **devant** ses voisines (z 15).
- **Écart au plan : filets et étincelles en DOM, pas dans le moteur.** Premier jet dans le shader (rebord, comètes A→B, étincelles additives) : invisible dès que les cartes se chevauchent, car le moteur dessine **sous** le DOM et le dégradé de la carte voisine recouvre le rebord (vérifié en vraie fenêtre). Donc : 2 filets × 10 traits courts le long d'un `offset-path: inset(0 round 24px)` (tête couleur A → queue B, `color-mix` du thème, halo fixe), en sens opposés (A part du haut dans le sens horaire, B en face dans l'autre sens) ; ≤ 12 étincelles (points 6 px) nées alternativement à la tête de chaque filet, qui s'écartent du bord, montent et s'éteignent en 0,9 s. Position par longueur d'arc (`pathPoint`, identique au chemin CSS à 0,5 px près, mesuré dans WebView2). Seulement transform / opacity / `offset-distance`, sans couche de composition en plus ; aucun filtre. Fonctionne aussi sans moteur (repli CSS = même rendu).
- **Boucle** : une seule (`frameLoop`, 60 i/s, 30 en Éco) tant que l'éventail est affiché et que quelque chose bouge ; arrêtée sinon (réglages de flottaison à 0 et rien de survolé, réduit, éventail démonté). Pendant une séquence, c'est la séquence qui dessine l'éventail (flottaison comprise, sans saut).
- Atelier : élément **`categoryHover`** (« Catégories : survol et flottaison ») : durée, soulèvement, inclinaison, grossissement, filets (oui / non, intensité, longueur, vitesse, épaisseur), étincelles (0–12), taille, flottaison repos / survol / période. Écran « Catégories (survol) » (`/dev/home?fan=1&hover=2`).
- Fichiers : `fanFloat.ts`, `fanRender.ts` (rendu de l'éventail, sorti du director), `linkEls.ts` (registre des éléments) ; director allégé (364 lignes). Correctif : le director n'écrit plus un style que s'il change (onglet en Élevée : 99 → 51 images perdues / 10 s).

**Mesures 3b complètes** (vraie fenêtre WebView2, build de dev, 2560×1440 = 1707×960 CSS à 150 %, 278 Hz, préréglage `actif.json` = ta DA courante, affiches de test sauf repos ; « pendant » = images où une séquence tourne ; aucun jeu lancé, vérifié avant) :

| Cas (10 s) | Qualité | p95 | p95 pendant | Images perdues (pendant) | Max |
|---|---|---|---|---|---|
| Carrousel au repos | Élevée / Éco | 3,7 / 3,7 ms ✅ | — | 0 / 1 | 3,9 / 7,0 ms |
| Éventail au repos (flottaison) | Élevée / Éco | 3,7 / 3,7 ms ✅ | — | 0 / 0 | 3,9 / 4,0 ms |
| Survol (carte 3, filets + 8 étincelles) | Élevée (2 essais) / Éco | 3,7 / 3,7 ms ✅ | — | 2 et 0 / 0 | 7,1 / 3,9 ms |
| Liaison (toutes les 4,4 s) | Élevée | 3,7 ms ✅ | 3,7 ms ✅ | 27 (17) | 21,4 ms |
| Liaison | Éco | 3,7 ms ✅ | 3,7 ms ✅ | 15 (8) | 17,8 ms |
| Onglet (toutes les 1,5 s) | Élevée (2 essais) | 3,7 ms ✅ | 3,7 ms ✅ | 51 (51) / 51 (50) | 21,3 ms |
| Onglet | Éco | 3,7 ms ✅ | 3,7 ms ✅ | 15 (14) | 10,7 ms |
| Retour (toutes les 4 s) | Élevée | 3,7 ms ✅ | 3,7 ms ✅ | 29 (19) | 21,4 ms |
| Retour | Éco (avant le correctif d'écriture) | 3,7 ms ✅ | 3,7 ms ✅ | 16 (12) | 21,5 ms |
| Liaison, repli CSS (`v4-cristal`) | Élevée | 3,7 ms ✅ | 3,7 ms ✅ | 34 (26) | 17,9 ms |

Lecture : budget 5,4 ms tenu partout, au repos et pendant. Les images perdues tombent surtout sur la première image de chaque séquence (rendu React du clic : nouvelle catégorie, titre, onglets ; 14–21 ms en build de dev), quelques-unes pendant le dépliage. Avant 3b (remontage du carrousel, 3b-0) : 34–83 perdues / 10 s pour le même rythme d'onglets, séquence 3× plus courte. Première série (avant le correctif d'écriture) : onglet Élevée 99 perdues, liaison 39, retour 18 pendant.
CPU / GPU de l'arbre (`measure-cost.ps1`, 10 s, 3–4 échantillons GPU) : carrousel au repos 2,8 % / 3,8 % ; éventail (flottaison) 3,3 % / 3,7 % ; survol 4,8 % / 4,2 % ; Éco : éventail 1,8 % / 1,0 %, survol 2,5 % / 1,2 %.

**Captures** (vraie fenêtre) : `docs/captures/da-r3b-liaison-sequence.jpg` (0 / 300 / 550 / 750 / 950 / 1 150 / 1 350 / 1 600 / 2 200 ms, affiches de test), `da-r3b-onglet-sequence.jpg` (0 / 120 / 300 / 450 / 650 / 1 300 ms), `da-r3b-retour-sequence.jpg` (0 / 200 / 450 / 700 / 1 000 / 1 700 ms), `da-r3b-repli-css.jpg` (sans moteur : 400 / 950 / 1 350 ms), `da-r3b-survol.jpg` (éventail, carte « Logiciels » survolée + 4 instants des filets à ~0,8 s d'écart), `da-r3b-survol-reduit.jpg` (réduit émulé : carte posée, filets fixes, sans étincelles).
**Testé** : tsc, eslint, prettier, vitest **452/452** (+ `fanFloat.test.ts` : réglages, Éco, réduit, flottaison bornée et propre à chaque carte, chemin du rebord = `offset-path`, filets opposés, étincelles ≤ 12, niveau de survol, inclinaison, arrêt de la boucle), build de production sans code de dev ni d'atelier (grep). En vraie fenêtre : survol (carte centrale et latérale), réduit (émulation CDP dans la même session), repli CSS. `cargo test` non relancé (aucun changement Rust).
**Non testé** : survol à la vraie souris (survol forcé par `?hover=` ; l'inclinaison vers le curseur n'a été vue qu'avec un pointeur simulé) ; focus clavier = survol (code seulement) ; vrai démarrage de l'app et Ctrl+Alt+H ; 60 Hz ; build de production mesuré (étape 13).
**Limites connues** : aux coins, les traits droits des filets coupent très légèrement l'arrondi (10 traits par filet) ; les filets restent discrets sur un thème pastel à l'intensité 0,9 (réglable jusqu'à 2) ; la fenêtre d'atelier que tu avais ouverte (21:12) a été fermée puis relancée avec le port de débogage 9222 pour les mesures.

**Gardé / Rejeté** : — (à remplir avec tes mots après ton test)

### 3b, ajustements après ton test — 2026-10-11
**Ton retour** : (1) la catégorie s'ouvre sur sa 1re app (3 cartes visibles) → l'ouvrir centrée, 5 cartes ; (2) « le filet » plus visible avec un petit effet → les deux : trait sous le titre et filets du survol ; (3) la lune / l'anneau ne se détache jamais comme un fluide (demandé en 2a).
**Fait** :
- (1) `initialHomeState(catégorie, nombres)` : chaque catégorie s'ouvre sur sa **3e app** (`VISIBLE_RADIUS`), moins d'apps → la dernière ; la sélection de chaque catégorie reste mémorisée ensuite. Vérifié : liaison vers Jeux → 5 cartes, « Steam » au centre.
- (2a) Trait sous le titre (`categoryTitle`) : nouveaux réglages **épaisseur** (1,5 px, avant 1 px), **lueur** (0,6 : halo de la couleur A), **reflet** (toutes les 7 s, 0 = aucun) ; centre éclairci vers le blanc ; le reflet = petit trait blanc qui glisse (animation Web ponctuelle de 1,1 s + un minuteur, jamais d'animation infinie, comme `Shine.tsx`), aussi à chaque changement de catégorie ; aucun en réduit ; une seule animation à la fois (elles ne s'empilent pas si la fenêtre ne dessine plus).
- (2b) Filets du survol : intensité 0,9 → 1,4, épaisseur 1,2 → 1,8 px, nouveau **halo à la tête** de chaque filet (22 px, qui respire 1,6 fois par seconde, réglage `threadGlow` 0,7, fixe en réduit).
- (3) **Gouttes de l'anneau** : ce n'était pas un bug mais un réglage trop discret. Avant : une goutte toutes les ~50 s (1,2 / min) qui ne faisait que gonfler de ~3 px sans jamais se détacher. Maintenant (`bgShader.ts`) : un renflement gonfle, s'étire, **le col casse**, la goutte flotte libre un peu plus loin (en dérivant légèrement de côté), revient, touche l'anneau et **s'y refond** (union lisse large tant qu'elle est attachée, nulle une fois détachée). Nouveaux défauts : 3 gouttes / min à des moments et des angles aléatoires (7 s chacune), distance 28 px, nouveau réglage **taille** 4 px. `actif.json` : seules `dripRate` 1,2 → 3 et `dripAmount` 16 → 28 modifiées (le reste de ton fichier intact).
**Testé** : tsc, eslint, prettier, vitest 453/453 (+ ouverture centrée), shader compilé (pas de repli). Navigateur : ouverture centrée, styles du trait.
**Non vérifié à l'œil / non remesuré** : gouttes et reflet en mouvement, halo des filets (ta fenêtre d'atelier était ouverte, la mienne ne pouvait pas démarrer : instance unique ; le volet du navigateur ne dessine pas sans focus). Coût attendu négligeable (une forme de plus dans le shader de l'anneau, 2 halos DOM, une animation de 1,1 s toutes les 7 s), mais pas mesuré.

### 3b, survol plus vif + ombre corrigée — 2026-10-11
**Ton retour** : survol plus « vif », réactif, un effet « magique » ; corriger l'ombre derrière la carte survolée (capture : une dalle sombre à bord net sous la carte).
**Cause de l'ombre** : la carte survolée avait une ombre plus large (décroissance 30 px, décalage 14 px), mais le shader cesse de dessiner une forme à 48 px de son bord : à cette distance l'ombre valait encore ~30 % → coupure nette. **Correctif** (`glassShader.ts`) : portée élargie pour la carte survolée (48 + 40 px) et ombre fondue jusqu'à zéro avant la coupure (pour toutes les formes : la petite marche à 7 % des autres cartes disparaît aussi) ; ombre du survol plus douce (décalage 12 px, × 1,4 au lieu de × 1,6). Vérifié dans le navigateur : plus de dalle.
**Survol plus vif** (`fanFloat.ts`, `fanRender.ts`, réglages `categoryHover`) :
- entrée en 240 ms (au lieu de 350) sur un **ressort léger** (`hoverSpring`, SPRINGS « léger » 5 % : la carte « saute » un peu puis se pose) ; sortie sans rebond ;
- **éclat à l'entrée** (`burst` 0,8) : le bord entier s'illumine un instant (lueur A, fond B), les filets **fouettent** un demi-tour (× éclat) avant leur course normale, plus lumineux, halos de tête renforcés, étincelles projetées plus loin ; s'éteint en ~1 s ;
- filets 2× plus rapides (0,22 → 0,4 tour/s), 12 étincelles (au lieu de 8 ; 6 en Éco), plus grosses (2,4 px), plus vives, vie 0,75 s ; inclinaison qui suit le curseur 2× plus vite (55 ms).
- Réduit : ni ressort ni éclat (inchangé : rien ne bouge).
**Testé** : tsc, eslint, prettier, vitest **454/454** (+ ressort ≤ 8 %, éclat qui s'éteint, fouet des filets, réduit). Navigateur : ombre, survol à la souris (soulèvement, passage devant, inclinaison). **Non vérifié à l'œil** : l'éclat et le fouet (moins d'une seconde, non capturables dans le volet) ; **non remesuré** (ta fenêtre d'atelier ouverte) ; coût attendu : 1 élément DOM en opacité de plus par carte, 4 étincelles de plus.

### 3b, flottaison au survol — 2026-10-11
**Ton retour** : la carte survolée doit tourner très légèrement gauche / droite en pivot, filets moins rapides, petit déplacement très léger : un vrai effet de flottaison.
**Fait** (`fanFloat.ts`, réglages `categoryHover`) : **pivot** lent autour d'un axe vertical (± 2°, période 3,6 s, phase propre à chaque carte ; réglages `sway`, `swayPeriod`), additionné à l'inclinaison vers le curseur et borné à 3° au total (spec) ; léger balancement dans le plan (± 0,3°) ; dérive latérale × 2,2 au survol ; flottaison au survol 5 → 6 px ; filets 0,4 → 0,25 tour/s (le fouet d'entrée reste). Le moteur suit le balancement et la dérive (pose) ; le pivot 3D reste DOM (≤ 3°, comme l'inclinaison). Réduit : rien.
**Testé** : tsc, eslint, vitest 455/455 (+ pivot borné à 3° et qui oscille vraiment, nul en réduit). **Non vérifié à l'œil, non remesuré** (ta fenêtre d'atelier ouverte : tu le vois en direct).

### 3b, correctif : verres décalés après une séquence — 2026-10-11
**Ton retour** (capture) : parfois les verres du carrousel ne sont plus sous les cartes (un verre vide à gauche, verres plus bas, la dernière carte sans verre).
**Cause** (bug de la 3b-A) : à la fin d'une séquence, le carrousel est rendu à son CSS, mais `release()` vidait la liste des cartes **avant** de retirer leurs poses du cue du moteur → le moteur gardait les poses de fin de séquence (positions et centre du plateau de ce moment-là). Masqué après la liaison depuis l'éventail (le démontage de l'éventail redessinait tout), visible après un changement d'onglet suivi d'un déplacement aux flèches ou d'un changement de mise en page. **Correctif** : poses retirées avant de vider la liste. **Second correctif** : le centre du plateau est relu à chaque image où les cartes sont posées (il pouvait bouger pendant la séquence : entrée du calque du carrousel, 14 px), au lieu d'une seule fois au début.
**Testé** : nouveau `linkDirector.test.ts` (faux DOM) : après un saut et après une séquence d'onglet, plus aucune pose chez le moteur, styles en ligne retirés ; il échouait avant le correctif. vitest 457/457, tsc, eslint, prettier. Navigateur : onglet Stream → Jeux → flèche : cue coupé, verres alignés.

### 3b, mesures finales du survol et de la flottaison — 2026-10-11
Survol validé à l'œil par toi. Vraie fenêtre WebView2, build de dev, 2560×1440 (1707×960 CSS à 150 %), 278 Hz, `actif.json`, PC libre (Get-Process : aucun jeu), état final du code (ressort d'entrée, éclat, pivot, filets 0,25 tour/s, 12 étincelles, ombre corrigée). « Survol continu » = carte centrale survolée tout le long ; « survols qui changent » = la carte survolée change toutes les 1,2 s (2 → 3 → 1 → aucune), donc ressort + éclat d'entrée répétés pendant la mesure.

| Cas (10 s) | Qualité | p95 | Images perdues | Max | CPU | GPU 3D |
|---|---|---|---|---|---|---|
| Éventail au repos (flottaison) | Élevée | 3,7 ms ✅ | 0 | 3,9 ms | 3,0 % | 3,5 % |
| Survol continu | Élevée | 3,7 ms ✅ | 2 | 7,3 ms | 4,9 % | 4,3 % |
| Survols qui changent | Élevée | 3,7 ms ✅ | 0 | 3,9 ms | 4,3 % | 4,5 % |
| Éventail au repos (flottaison) | Éco | 3,7 ms ✅ | 1 | 7,1 ms | 2,1 % | 1,0 % |
| Survol continu | Éco | 3,7 ms ✅ | 0 | 3,8 ms | 2,6 % | 1,2 % |
| Survols qui changent | Éco | 3,7 ms ✅ | 0 | 4,5 ms | 2,4 % | 1,2 % |

Lecture : budget de 5,4 ms tenu partout, avec de la marge ; le survol coûte ~+2 points de CPU et ~+1 de GPU en Élevée par rapport à l'éventail seul (+0,5 / +0,2 en Éco). CPU/GPU : `measure-cost.ps1`, 10 s, 3–4 échantillons GPU (ordre de grandeur). Build de production et 60 Hz non mesurés (étape 13).

## Ronde 4a — 2026-10-11 / 12 (langage de mouvement « Vivant intelligent », non commitée)
**Spec** : `reference/animations/R4a-Mouvement-FINAL-Vivant-intelligent.txt` (fait foi). Plan validé : table de jetons unique, niveaux 1 / 2 / 3, survol niveau 3 des cartes du carrousel, écran « Mouvement ». Signature R3 inchangée. **Tes décisions** : pas de nouvelle notification « … se lance » (mouvement seulement sur les notifications existantes) ; au survol d'une carte du carrousel, voile **et** filets attendent 120 ms de présence du curseur ; interrupteur d'atelier pour réactiver le reflet qui suit la souris (coupé par défaut en niveau 3). Deux arrêts : A (jetons, niveaux 1-2, focus, page `/dev/motion`) puis B (niveau 3, mesures).
**Arrêt A — fait** :
- Table `src/design/motion/tokens.ts` (pure, testée) : micro 140 / court 240 / moyen 360 / long 540 ms, sortie 0,7×, courbes apparition `vive`, disparition `sortie` (.7,0,.84,0), déplacement `liaison` (3,4 %), rebond `rebond` (.34,1.45,.64,1 = 6,6 %, ajouté à `SPRINGS`), cascade 45 ms, montée 14 px, montée au survol 1 px, appui ×0,94, panneau 0,96, anneau de focus, carte survolée 10 px / ×1,03 ; vitesse 0,7 / 1 / 1,5 (divise les durées) ; un interrupteur par niveau. Courbes nommées dans `src/design/motion/eases.ts` (ex-`EASES` de `catalogue.ts`, réexporté).
- Élément catalogue **`motion`** (remplace l'ancien `motion` « durée des cartes ») → variables `--m-*` ; `src/design/motion.css` (défauts identiques, testé) en dérive `--m1-*`, `--m2-*`, `--m3-*` = jeton × niveau × « réduire les animations » (0 = état final direct). `--dur-hover`, `--dur-panel`, `--dur-card`, `--ease` = alias de la table ; `cardHover` perd durée / courbe, `glassPills` perd durée / ressort (champs ignorés dans les vieux préréglages). `design/motion.ts` (Framer) ne sert plus qu'au titre de catégorie (signature) et au panneau du widget (3c).
- Niveau 1 : survol (court, apparition, montée 1 px ; onglet / segment sélectionné sans montée) et appui (propriété `scale`, ×0,94 en micro, relâché sur `liaison`) : Button (lueur du primaire = calque en opacité, plus de `filter` animé), IconButton, Chip, SegmentedControl, onglets, barre du haut, interrupteur, curseur, infobulle, menu contextuel (micro).
- Niveau 2 : pastille (`SelectionPill` : moyen + ressort de la courbe « déplacement ») ; interrupteur (court, `liaison`) ; `Dialog` (moyen, 0,96 → 1, +14 px ; sortie 0,7× sans cascade via `usePresence`, focus et `inert` rendus tout de suite, contenu figé pendant la sortie) ; recherche (`CommandPalette`, idem, lignes en cascade à l'ouverture seulement) ; lignes des réglages et cellules de la grille en cascade (`data-cascade`, 12 lignes au plus) ; notifications (erreur, scène, confirmation) : moyen, +14 px ; calque grille / vide de l'accueil : moyen sur `liaison`.
- Focus clavier : anneau global (`box-shadow` : 3 px fond, 5 px A, 7 px B à 50 %, halo 26 px A à 45 %), immédiat ; remplace les `outline` (10 feuilles) ; carte active du carrousel et de la grille ; pas sur les conteneurs de liste.
- Écran d'atelier **« Mouvement (jetons, niveaux) »** = `/dev/motion` (`src/dev/MotionLab.tsx`) : boutons, puces, champ, infobulle, onglets + pastille, sélecteur de mode, interrupteurs, panneau, recherche, notification, liste en cascade, carrousel d'apps de test ; `?cycle=panel|toggle|tab|notice:ms` et `?bench=idle` pour le banc.
**Testé (arrêt A)** : tsc, eslint, prettier, vitest **466/466** (+ `tokens.test.ts`). Navigateur (volet, 800 px) : variables résolues, panneau (360 ms, cascade 0/45/90/135, sortie 252 ms, `inert` retiré tout de suite), recherche, notification, anneau de focus, atelier. **Non testé** : « réduire les animations » réel, vraie fenêtre, mesures (arrêt B).
**Ton retour (arrêt A)** : validé visuellement.

**Arrêt B — niveau 3 des cartes du carrousel (2026-10-12)** :
- **Filets partagés** : le rendu des filets / têtes / étincelles / éclair de l'éventail (`domHover` de `fanRender.ts`) est sorti **sans changement** dans `src/features/home/rim/rimRender.ts` (`renderRim`, paramétré par la boîte de la carte) + `rim/Rim.module.css` (mêmes règles, rayon `--rim-r`, 24 px par défaut = éventail). L'éventail l'appelle comme avant (`fanRender.ts`, `CategoryFan.tsx`).
- **Survol** (`rim/cardHoverFx.ts`, `Carousel.tsx`, `Carousel.module.css`) : le **slot** se soulève de 10 px et grossit ×1,03 sur le rebond (6,6 %, « court ») : carte, filets, halo sous la carte et verre du moteur suivent ensemble (le trou du halo suit maintenant le soulèvement) ; retour sans rebond (0,7 × court, apparition). Après **120 ms** de présence du curseur (ta décision : rien pendant une traversée) : **un voile** (`SheenVeil`, `sheenGlide`, 800 ms) puis **les 2 filets** de l'éventail (réglages de `categoryHover`, sans éclat ni fouet) qui montent en « court », **4 étincelles** au plus. Un seul jeu de traits (DOM impératif, aucun rendu React) déplacé dans le slot de la carte survolée, à côté de la carte (non coupé par son `overflow`), même échelle et même inclinaison (`cardTilt.ts` la recopie). Boucle de 60 i/s seulement pendant que des filets sont allumés.
- **Coupures** (règle d'intelligence) : défilement (`data-fast`, molette < 300 ms), glisser-déposer (`dragging`), séquence de catégorie (`data-seq` : pas même le soulèvement), focus clavier (pointeur seulement), **mode fenêtre** = niveaux 1–2 (soulèvement sur `liaison`, ni voile, ni filets, ni éclat), **Éco** = soulèvement + voile, « réduire les animations » = rien (ni soulèvement), niveau 3 coupé dans l'atelier = rien. Voile du survol sauté si le voile périodique (2b) de la carte active glisse à ce moment (règle 1). La grille (> 8 cartes) n'a pas de niveau 3.
- **Reflet qui suit la souris** : masqué sur les cartes du carrousel quand le niveau 3 est actif (règle 1) ; interrupteur **`cardHover.pointerSheen`** (« Carrousel : garder le reflet qui suit la souris », désactivé) pour le réactiver.
- **Appui sur une carte** : ×0,94 en micro, relâché sur le rebond (carrousel) ou `liaison` (grille). **Lancement** (clic sur la carte centrale) : éclat du bord (anneau A + halo) 1,6 × long = 864 ms ; pas en Éco, ni en mode fenêtre, ni au clavier (Entrée).
- **Réglages** (`cardHover`) : `delay` 120 ms, `veilMs` 800 ms, `sparks` 0–4, `launchFlash` 1,6, `pointerSheen` ; `duration` / `ease` retirés (table de jetons). Le soulèvement de la grille reste `cardHover.lift` (niveau 1), celui du carrousel est `motion.cardLift` / `cardGrow`.
- Fichiers : `Shine.module.css` sorti d'`AppCard.module.css` (381 lignes).
**Testé (arrêt B)** : tsc, eslint, prettier, vitest **472/472** (+ `rim/cardHover.test.ts` : réglages par défaut, Éco, fenêtre, réduit, niveau 3 coupé, ≤ 4 étincelles, délai et fondu des filets, coupures, rendu partagé). Volet du navigateur : survol à la souris de la carte centrale → slot à −10 px / ×1,03 sur `cubic-bezier(.34,1.45,.64,1)`, calque des traits dans le bon slot (rayon 30 px), filets allumés, reflet qui suit la souris masqué.
**Non fait / reporté** : **mesures (p95, Élevée et Éco, repos / survol continu / survol qui change / onglets / panneau / interrupteur) et captures `da-r4a-*`** : BloonsTD6 tournait (~2 cœurs, vérifié avec Get-Process deux fois) ; banc CDP prêt hors dépôt (même méthode que 3b : `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 npm run dev:atelier-bench`, puis souris réelle par CDP). Non vérifié à l'œil : les filets du carrousel en mouvement et l'éclat au lancement (le volet du navigateur passe en arrière-plan et ne dessine plus : 0 image/s), l'éventail après l'extraction (même raison ; tests et rendu identiques par construction), « réduire les animations » réel, mode fenêtre réel.

**Ton retour (arrêt B)** : validé visuellement.

**Mesures de la 4a : reportées (ta décision, 2026-10-12)** à la vérification globale (revue + étape 13), **en build de production, jeu fermé** (vérifier avec Get-Process avant). Budget : p95 ≤ 5,4 ms en vraie fenêtre 2560×1440 ~278 Hz. Cas à mesurer, chacun en **Élevée ET Éco** (10 s, préréglage `actif.json`, thème `lavande-peche`) :
1. repos (carrousel, rien ne bouge) ;
2. survol continu (pointeur sur la carte centrale, qui bouge un peu) ;
3. survol qui change (carte survolée différente toutes les 1,2 s, puis aucune) ;
4. onglets (changement toutes les 1,5 s : pastille + regroupement) ;
5. panneau (ouverture / fermeture toutes les 1,5 s : entrée, cascade, sortie 0,7×) ;
6. interrupteur (bascule toutes les 1,5 s).
Outils : pages de dev `/dev/home?bench=idle` (cas 1–3, souris réelle par CDP), `/dev/home?cycle=1500&bench=transition` (cas 4), `/dev/motion?cycle=panel:1500&bench=idle` et `?cycle=toggle:1500` (cas 5–6) ; CPU / GPU avec `scripts/measure-cost.ps1`. Captures `docs/captures/da-r4a-*` à prendre au même moment. Aucune mesure 4a n'a encore été faite.

## Ronde 4b — 2026-10-12 (widget, chaîne de points, états, passages de modes, ouverture ; commitée par sous-étape, dernier tag `da-r4b-3`)
**Specs** (font foi) : `reference/animations/R4b-notes-4b/r4b-notes/R4b-3c-Widget.txt`, `R4b-3c-Editeur.txt`, `R4b-Etats.txt`, `R4b-Modes.txt`, `R4b-Ouverture-Transparente.txt` (+ R4a). Départ : tag `da-r4a`. Plan validé (copie : `C:\Users\tomca\.claude\plans\contexte-projet-kayro-bubbly-wigderson.md`).
**Découpage et arrêts** :
- 4b-1a : widget qui se déroule. **Arrêt.**
- 4b-1b : chaîne de points, états, nouvelle scène. **Arrêt.**
- 4b-2 : passages entre modes. Spike 4b-2.0 d'abord, avec **mesure obligatoire** (PC libre, jeux fermés) de l'immersif au repos, transparent contre opaque. Rapport, puis **arrêt**.
- 4b-3 : ouverture transparente C. Plan à reconfirmer avant de coder.

Pas de commit sans ta demande. Tag prévu : `da-r4b-1`, puis `-2`, `-3`. Exclusions : `reference/`, `src/design/presets/history/`, `SceneDock.module.css` (fins de ligne seulement).
**Tes décisions** :
- Les voiles 42 / 16 % n'existent **que pendant un passage**. À l'arrivée, rien ne change : immersif = fond opaque, fenêtre = vraie fenêtre Windows.
- Démarrage silencieux = **pas d'ouverture**. Fait en 4b-3 (`opening_due` répond `quiet`).
- Ctrl+Alt+H garde « afficher / masquer », même en widget.
- Halo du widget allumé tant que le panneau est déplié.
- Ouverture C = chronologie V1-A **à l'identique** (`openingTimeline.ts`), avec la pulsation (ringOut, onde, révélation) à l'instant exact du ringOut : 1 750 ms, 850 ms.
- Écarts acceptés : coins de 8 px (Windows 11) au lieu de 28 ; barre de titre native qui apparaît à l'arrivée d'un passage.
- « Économie » = qualité Éco.

**Ce que Tauri 2 permet** (sources tao 0.37.1 / tauri 2.12.2) :
- La transparence se choisit à la construction d'une fenêtre seulement.
- Les clics traversent seulement pour une fenêtre entière (`set_ignore_cursor_events`). Il n'y a pas de zones natives : on peut sonder la souris, ou utiliser `SetWindowRgn`.
- **Retenu** : le widget reste une petite fenêtre ajustée à son contenu. Les clics autour passent, sans minuteur. La fenêtre change de taille avant d'agrandir et après avoir rétréci, jamais pendant.

### 4b-1a — Widget : le verre se déroule
**Fait** :
- **Jetons** (`src/design/motion/tokens.ts`, toujours la seule table) :
  - Sous-tables `widget` (`WIDGET_UNROLL`, toutes les valeurs de la note), `chain`, `states` et `sober` (la première proposition 3c). Les durées sont divisées par la vitesse.
  - Les 6 ressorts `linear()` de la note sont dans `springCurves.ts` (données seulement ; table sœur de `SPRINGS`, plafond 8 %) :

    | Ressort | douce | normale (défaut) | forte |
    |---|---|---|---|
    | vertical, 680 ms | 3,5 % | **5 %** | 7 % |
    | horizontal, 560 ms | 1,5 % | **2,5 %** | 3,5 % |

  - `curveOf()` lit maintenant `linear(…)` (il la jouait comme une droite).
  - Nouvelles variables `--m-spring-v`, `--m-spring-h`, `--m-widget-chevron`, dans `motionCss()` et dans `motion.css`. `/* prettier-ignore */` les garde sur une ligne pour le test de parité.
- **Atelier** (élément `motion`) :
  - nouveaux réglages : `widgetMotion` (déroulé / sobre), `widgetSpring` (douce / normale / forte), `widgetHalo`, `widgetSheen` ; `emptyFloat` est préparé pour 4b-1b ;
  - nouvel écran « Widget (dépliage) » = `/dev/widget?open=1`.
- **Widget** (`src/features/widget/`) :
  - Framer Motion est retiré du widget.
  - Le panneau a deux couches : la **coque** (`hull` en `scaleX`, `hullInner` en `translateY` + `scaleY`, ancrées en haut au centre, qui portent le fond, le bord, l'ombre et le reflet) et le **contenu**, jamais mis à l'échelle.
  - `unroll.ts` (pur, testé) décrit chaque animation Web. `useUnroll.ts` la joue avec `element.animate()`, donc composée, sans script par image.
  - **Déplier** :

    | Instant | Ce qui bouge |
    |---|---|
    | 0 | coque, sur les deux ressorts (opacité en 60 ms) ; barre ×1,02 (460 ms) ; chevron 180° sur le ressort vertical en 520 ms (transition CSS) |
    | 80 ms | halo (700 ms), qui **reste allumé** jusqu'au repli |
    | 50 / 110 / 170 / 230 ms | lignes (recherche, scènes, en cours, récents) : −10 px sur le ressort 3,5 % en 520 ms, opacité 260 ms |
    | +50 ms, toutes les 35 ms | pastilles « Ouvert » et icônes des récents, ×0,7 → 1 |
    | 380 ms | reflet (950 ms) |

  - **Replier** : contenu en 100 ms ; coque à 70 ms pendant 240 ms (courbe de disparition) ; effacée sur les 90 dernières ms. Total 310 ms.
  - Un re-clic pendant le repli repart de l'état courant (styles calculés lus, puis animation depuis là).
  - **Fenêtre jamais redimensionnée pendant l'animation** :
    - à l'ouverture : le panneau monte invisible (`data-phase="pre"`), `fitNow()` attend la fin du redimensionnement (il attend aussi celui déjà en cours), une image, puis le déroulé ;
    - au repli : le panneau reste monté pendant 310 ms (`usePresence`), puis la fenêtre rétrécit (observateur de taille) ;
    - la marge basse passe à 28 px tant que le panneau est là, pour le halo.
  - Éco : ni halo ni reflet ; les ressorts restent. « Réduire les animations » ou niveau 2 coupé : état final direct.
  - `Widget.module.css` (553 lignes) est découpé en `Widget.module.css` (fenêtre et styles `--w-*`, 140 lignes), `WidgetBar.module.css` (157) et `WidgetPanel.module.css` (320).
- **Page de dev** `/dev/widget` (`src/dev/Widget.tsx`) : faux bureau en CSS, fausses données. Paramètres : `?theme=`, `?style=brume|aurore|sillage|orbe`, `?fx=eco`, `?open=1`, `?cycle=ms`.

**Testé** :
- tsc, eslint, prettier (fichiers touchés), vitest **483/483**. Nouveaux tests : `springCurves.test.ts` (pics = pourcentages annoncés, ≤ 8 %, lecture de `linear()`, jetons, vitesse) et `unroll.test.ts` (instants de la note, Éco, repli de 310 ms, reprise depuis l'état courant, sobre).
- Build de production : aucun code de dev (grep), ressorts présents.
- Volet du navigateur, animations figées à 0 / 30 / 150 / 330 / 500 / 700 / 1 400 ms (le volet masqué ne dessine pas) :

  | Instant | Coque (scaleX / scaleY / y / opacité) | Le reste |
  |---|---|---|
  | 0 ms | 0,86 / 0,04 / −12 px / 0 | — |
  | 150 ms | 0,96 / 0,80 / — / 1 | lignes 1-2 à 0,93 / 0,66 |
  | 330 ms | 1,003 / **1,044** (dépassement) / — / — | pastilles à 0,95 |
  | 700 ms | état final | reflet en cours |

- Éco vérifié : ni halo ni reflet, chevron sur `linear()` à 520 ms.

**Non testé** :
- **le vrai mode widget dans Tauri** (je n'ai pas lancé l'app : redimensionnement avant le déroulé, rendu de `linear()` dans WebView2, coins de la coque pendant le `scale`) ;
- l'atelier en direct ;
- « réduire les animations » réel ;
- les styles aurore, sillage et orbe en mouvement.

**Mesures** : **à mesurer** (aucune mesure en vraie fenêtre). Cases ajoutées à la vérification globale : « repos widget », « widget qui se déplie / se replie ».
**Limites connues** :
- le rayon des coins se déforme un peu pendant le `scale` (accepté par la note ; passer à `clip-path` si ça se voit) ;
- la marge basse de 28 px (halo) capte les clics tant que le panneau est déplié ;
- `widgetModel.ts` n'est pas au format prettier : c'est antérieur, je ne l'ai pas touché.

**Ton retour (4b-1a)** : widget validé à l'œil en vrai. Commité (`4c732c6`), tag `da-r4b-1a`.

### 4b-1b — Chaîne de points, états, nouvelle scène
**Fait** :
- **Chaîne de points** (éditeur avancé, niveau 2, `src/features/scenes/chain/`) :
  - Chaque étape a son **point** (le numéro) et son **segment** de fil vers la suivante. Ils remplacent la ligne fixe `.steps::before`.
  - Couleurs du thème : point rempli A→B ; en attente pendant un test = bord A à 70 % ; échec = `--fail` (#F08C8C, nouveau jeton de `tokens.css`).
  - `useListMotion.ts` (animations Web seulement, `transform` / `opacity` / `translate`) :

    | Geste | Animation |
    |---|---|
    | ajout | la carte monte de 14 px et apparaît (moyen, apparition) ; son point ×0,4 → 1 sur liaison (court) 120 ms après ; le segment précédent se prolonge (`scaleY`, moyen) |
    | retrait | la ligne retirée par React revient en « fantôme » à sa place et s'efface en 252 ms ; le segment se raccourcit ; les suivantes remontent |
    | changement de place | FLIP sur liaison (moyen), depuis la position **vue** (un glissement en cours compris) : réordonner, Alt+flèches, une étape qui ouvre ses réglages… |

  - Glisser-déposer : la carte saisie suit le pointeur (`translate`) et les voisines s'écartent d'une case (transition `translate`, moyen, liaison). Au relâchement, la carte se pose sur le même ressort. Plus de trait d'insertion ni de fantôme pour les étapes.
  - Clavier : **Alt + ↑ / ↓** depuis la ligne (pas dans ses champs) ; les flèches seules restent sur la poignée. Annonce « Étape 1 déplacée en position 2 sur 5. ».
  - Le mode simple a les mêmes ajout / retrait / changement de place, plus Alt + flèches.
- **Test de la chaîne** (`chainState.ts`, pur) : il suit les vrais événements `scene-progress`.
  - Point en cours : ×1,18, halo plus fort, bord de la carte éclairé.
  - Le fil se remplit jusqu'au point suivant quand l'étape suivante démarre, donc il s'arrête là où la scène s'arrête.
  - **Règle du moteur gardée** : seule une étape « obligatoire » qui échoue arrête la scène.
- **Plus de roue** : `RunMark` affiche un **fil lumineux qui glisse** (`GlideThread`). Nouveau `useAmbientLoop` : boucle d'images commune à 60 i/s, seulement pendant une étape en cours ; fixe en Éco et en réduit.
- **Catégorie vide** (`EmptyState`) :
  - titre et texte gardés, plus une carte pointillée de 150×180 « Ajouter une app » avec un « + » en dégradé A→B ;
  - flottaison de 4 px sur 5 s (`useAmbientLoop`, réglage d'atelier `emptyFloat`), coupée en Éco et en réduit ;
  - survol : bord plus clair (court) ; appui ×0,94.
- **Lancement qui échoue** :
  - `hubStore.failedApp` dit quelle app a échoué (`AppError` ne le porte pas).
  - La carte tremble **une fois** (5 puis 3 px, 240 ms, animation Web ajoutée au `transform` de la carte, donc l'échelle du carrousel reste), et son bord passe en rouge doux tant que le message est là. En réduit : le bord seulement.
  - Nouveau **message unique** (`home/Message.tsx`, utilisé par `LaunchToast` et `SceneToast`) : il monte de 14 px sur liaison en moyen, reste 6 s, sort en 252 ms ; le suivant le remplace.
  - Texte : « Steam ne s'est pas lancé. Le chemin n'existe plus. » avec **« Corriger »**, qui ouvre la fiche de l'app. Pas d'action pour un refus d'autorisation.
- **Nouvelle scène** (`NewSceneDialog`, panneau moyen, lignes en cascade de 45 ms) :
  - le champ du nom a le focus tout de suite (halo en micro) ;
  - trois départs : Vide / Depuis une scène existante (copie des étapes, nouvelles clés, sans raccourci : `seededDraft`) / Importer (le dialogue `.hubscene` existant) ;
  - « Créer » ouvre l'éditeur prérempli ;
  - chaîne vide : le bouton pointillé devient « Aucune étape · ajoute la première » ;
  - une scène qui apparaît pour la première fois dans le dock y entre sur liaison (animée dans `SceneDock.tsx` ; **`SceneDock.module.css` pas touché**).
- **Atelier** : `/dev/motion` gagne une section « 4b » (`src/dev/MotionLab4b.tsx`) : la vraie chaîne de l'éditeur avancé (Ajouter, Retirer, Échanger 2 et 3, Tester, Tester avec échec ; rythme 520 / 900 ms), la carte vide, et « Simuler l'échec de la carte centrale ». Nouveau `?cycle=fail:ms`. `/dev/scenes?fail=n` : l'étape n échoue pendant le faux test.

**Testé** :
- tsc, eslint, prettier (fichiers touchés), vitest **492/492**. Nouveaux tests : `chain.test.ts` (états des points, fil qui s'arrête, échec non obligatoire, lecture des décalages, jetons) ; `draft.test.ts` (nouvelle scène vide ou copiée) ; `hubStore.test.ts` (`failedApp`).
- Build de production : aucun code de dev (grep).
- Volet du navigateur :
  - test avec échec : point 1 rempli et fil rempli, point 2 rouge, 3 et 4 ignorés ;
  - animations relevées en les figeant : échange (FLIP ±86 px, liaison 360 ms), ajout (segment `scaleY`, montée de 14 px, point ×0,4 à +120 ms), retrait (fantôme 252 ms retiré à l'image suivante, segment qui se raccourcit) ;
  - échec de lancement : tremblement (240 ms, `composite: add`), bord rouge, message avec « Corriger » ;
  - nouvelle scène « Depuis une scène existante » : éditeur avec le nom et les 5 étapes ;
  - Alt+↓ : étape déplacée et annoncée ;
  - carte vide affichée.

**Non testé** :
- l'app réelle (Tauri) ;
- le glisser-déposer à la vraie souris (voisines qui s'écartent, pose sur ressort) ;
- le vrai « Tester » d'une scène ;
- l'entrée d'une scène dans le dock ;
- la flottaison et le fil qui glisse en mouvement (le volet masqué ne dessine pas) ;
- « réduire les animations » réel.

**Mesures** : **à mesurer** (étape 13). Cases ajoutées : « éditeur : réordonner / test de la chaîne », « catégorie vide (flottaison) ».
**Limites connues** :
- dans le mode simple, glisser garde le trait d'insertion (pas de voisines qui s'écartent) ;
- widget : un lancement raté n'y affiche pas de message (il faudrait agrandir sa fenêtre) ;
- le texte « Chargement de vos données… » reste du texte (pas de fil) ;
- page masquée : un fantôme de retrait reste jusqu'à l'image suivante.

**Ton retour (4b-1b)** : validé à l'œil. Commité (`445b3fe`), tag `da-r4b-1b`.

### 4b-2.0 — Spike : `main` transparente ? (2026-10-12, PC libre)
**Méthode** :
- Vraie fenêtre WebView2, build de dev, 2560×1440 (1707×960 CSS à 150 %), 278 Hz.
- `/dev/home?bench=idle&preset=actif&theme=lavande-peche`, 10 s sans saisie, en Élevée et en Éco.
- Comparaison : `main` construite **transparente** contre **opaque** (même code ; interrupteur de debug le temps du spike).
- Coût de l'app : `measure-cost.ps1`. GPU du **compositeur de Windows (dwm)** : nouveau relevé hors dépôt, 5 échantillons. C'est lui que la transparence charge, et l'app ne le voit pas.
- `Get-Process` : aucun jeu. Steam et le client Riot étaient ouverts mais au repos ; le navigateur Comet prenait ~19 % du CPU de la machine en fond, pareil dans les deux cas (mesures alternées).

| Repos, immersif | Qualité | p95 | Images perdues | CPU app | GPU 3D app | **GPU dwm** | GPU 3D machine |
|---|---|---|---|---|---|---|---|
| opaque (2-3 essais) | Élevée | 3,7 ms ✅ | 1 / 0 | 3,0 / 2,8 % | 4,5 / 4,4 % | **1,4–1,5 %** | 7,7–7,8 % |
| transparente (2-3 essais) | Élevée | 3,7 ms ✅ | 0 / 0 | 2,2 / 2,6 % | 4,6 / 4,5 % | **4,2 %** (×2,8) | 10,6–10,7 % |
| opaque | Éco | 3,7 ms ✅ | 0 / 0 | 1,6 / 1,3 % | 1,2 / 1,1 % | **0,8 %** | 3,6–3,7 % |
| transparente | Éco | 3,7 ms ✅ | 0 / 1 (7,2 ms) | 1,3 / 1,5 % | 1,3 / 1,3 % | **2,4 %** (×3) | 5,3–5,4 % |

**Lecture** :
- Le p95 ne bouge pas : 3,7 ms, l'intervalle d'une image à 278 Hz.
- Le coût de l'app non plus.
- En revanche, **dwm passe de 1,5 à 4,2 % en Élevée, et de 0,8 à 2,4 % en Éco**, soit +2,7 et +1,6 points, ou +39 à +44 % du GPU de toute la machine. Une fenêtre plein écran opaque est affichée directement par Windows (« flip » direct). Transparente, elle doit être recomposée à chaque image, **en permanence tant que Kayro est affiché**, pour un effet qui dure ~0,5 s par changement de mode.
- Valeurs très stables (relevés dwm répétés à ±0,06 point).

**S1 (captures plein écran, supprimées après la séance)** :
- Immersif transparent : identique à l'opaque à l'œil.
- Avec un découpage de la page en rectangle arrondi, le bureau se voit autour ; le fond fixe (Backdrop) et le canvas du moteur sont bien découpés avec la page (le `clip-path` sur `#root` les prend).
- Mode fenêtre transparent : barre de titre native, coins arrondis et liseré de Windows 11 corrects.
- En opaque, le même découpage montre un fond gris (contrôle).
- **Non vérifiés** : Alt+Tab et l'image du premier affichage.

**S3 (rafales de captures toutes les ~35–40 ms pendant le basculement immersif ↔ fenêtre actuel)** :
- Au redimensionnement de la fenêtre, **2 à 3 captures (~70–120 ms) montrent l'ancienne image**, rognée ou collée en haut à gauche sur un fond sombre, avant la nouvelle mise en page.
- **Pareil en opaque et en transparent** : le défaut existe déjà aujourd'hui (build de dev), il vient du redimensionnement lui-même.
- Pour les passages animés, il aurait fallu masquer ces ~100 ms (fenêtre « cloakée », donc un clignement du bureau) ou les cacher sous un contenu effacé.

**S4** (cadre + `zoom`) : non fait, devenu sans objet avec la décision.

**Décision (règle fixée avant la séance : GPU qui monte nettement → repli)** : **repli**.
- `main` reste **opaque** ; le code du spike est retiré (fenêtre et outil de dev Ctrl+Alt+F9).
- 4b-2 = **passages en fondu, sans bureau visible** :
  - le contenu s'efface sur le fond opaque, la fenêtre change de taille pendant qu'il est effacé (le défaut S3 se perd dans le noir), puis le contenu revient en cascade ;
  - le widget reste sa petite fenêtre transparente.
- 4b-3 = **ouverture opaque actuelle (V1-A)**.
- **Piste pour plus tard, non chiffrée** : une fenêtre transparente **dédiée et éphémère**, construite seulement le temps de l'ouverture ou d'un passage, puis détruite. Le coût dwm n'existerait que pendant l'animation, mais il faut une WebView de plus au démarrage (~0,4 s, mémoire).

**Mesures à ajouter à l'étape 13** : « repos fenêtre », « repos widget », « pendant un passage » ; le GPU de dwm en plus de celui de l'app.

**Ton accord (après le spike)** : repli pour les passages entre modes. 4b-2 se fait en fondu ; pour 4b-3, tu veux d'abord un plan chiffré de la piste « fenêtre transparente dédiée, le temps de l'ouverture » avant de décider.

### 4b-2 — Passages entre modes, en fondu (2026-10-12)
**Principe** :
- Les fenêtres restent **opaques**.
- Un passage efface toute la page sur son fond opaque. La fenêtre change ensuite de taille, ou de fenêtre, pendant que rien ne se voit : l'image figée de ~100 ms mesurée en S3 tombe dans le noir.
- Puis la page revient, et les cartes remontent en cascade.
- Le widget garde sa fenêtre transparente : quand il s'efface, on voit le bureau.
- Durées de la table de mouvement : sortie en micro (140 ms, courbe de disparition) ; retour en moyen (360 ms, apparition) ; cartes +14 px → 0 en cascade de 45 ms sur liaison (12 au plus) ; widget en court, ×0,96 → 1.
- « Réduire les animations », niveau 2 coupé ou qualité Éco : changement direct, comme avant.

**Rust** :
- `desktop/mod.rs` (413 lignes) est découpé en `modes.rs` (changements de mode et mode économie) et `passage.rs`. `mod.rs` fait maintenant 345 lignes.
- Protocole :
  - événement `ModePassage {id, step: out|in, label}` ;
  - commande `passage_faded(id)` ;
  - le cœur attend la page **600 ms au plus**, puis continue seul ;
  - un passage plus récent libère tout de suite le précédent.
- Immersif ⇄ fenêtre : « out » à `main` → reconfiguration (taille, cadre, zoom) → « in ». C'est le dernier mode demandé qui l'emporte.
- Avec le widget :
  - la nouvelle fenêtre est construite cachée avec `?enter=1` (sa page part effacée) ;
  - quand elle a peint, l'ancienne fenêtre reçoit « out » ; une fois effacée, la nouvelle est affichée et l'ancienne détruite (`swap_after_fade`, mécanisme `retire` existant) ;
  - la nouvelle page entre en fondu à son premier affichage.
- Fenêtre cachée : rien ne change.

**Page** :
- `src/features/modes/passage.ts` (plan pur, testé) et `usePassage.ts`, branchés dans `App.tsx` et `WidgetApp.tsx`. `main.tsx` met la page à opacité 0 si `?enter=1`.
- Le fondu porte sur `body` : la page entière, dialogues compris (ils sont rendus hors de `#root`).
- Sécurités :
  - après un « out », si le « in » n'arrive pas en 2,5 s, la page revient seule ;
  - une page construite pour un passage revient de même si elle n'est jamais affichée.
- **Bouton ↗ « Ouvrir en fenêtre »** dans la barre du widget (nouvelle icône `ExpandIcon`, texte `widget.toWindow`) : passage widget → fenêtre. Ctrl+Alt+H garde son rôle (ta décision).

**Testé** :
- tsc, eslint, prettier, vitest **496/496** (+ `passage.test.ts`) ; cargo test **177** (+ `passage.rs` : libération par son id, un passage récent libère l'ancien ; `windows.rs` : adresses `?enter=1`) ; clippy propre ; types régénérés ; build de production sans code de dev.
- En vraie fenêtre (app de banc, build de dev, PC sans jeu), mesuré **dans la page** à chaque image, sans capture d'écran :

  | Passage | Ce qui a été relevé |
  |---|---|
  | fenêtre → immersif | opacité 0 à **167 ms** ; changement de taille entre **228 et 260 ms**, page invisible (une largeur intermédiaire passe pendant le zoom) ; retour **274 → 512 ms** ; cartes remontées à **623 ms** |
  | immersif → fenêtre | même profil, fini à 620 ms |
  | immersif → widget | le widget est construit (~0,2 s), `main` s'efface, puis le widget est affiché et entre en fondu (0 → 1 en ~360 ms, de 0,84 à 1,2 s après le clic) ; `main` détruite |
  | widget → fenêtre (bouton ↗) | `main` construite cachée (~0,7 s en dev) ; le widget s'efface **de 707 à 847 ms** ; puis `main` est affichée et entre en fondu, cartes en cascade ; widget détruit |

- Ton réglage d'affichage a été remis sur « immersive » après les essais.

**Non testé** :
- **le rendu à l'œil** : je n'ai pas fait de captures, celles-ci n'étaient autorisées que pour S1 et S3 ;
- la zone de notification et le dialogue des réglages comme sources du changement (même chemin Rust, non lancés) ;
- le démarrage en mode widget suivi de ↗ (qui jouera l'ouverture, une fois par processus) ;
- 60 Hz et le build de production.

**Limites connues** :
- Le fondu se fait vers le fond **opaque** (sombre) : le bureau n'apparaît pas.
- Entre une fenêtre `main` et le widget, l'écran sombre de `main` laisse place au bureau d'un coup quand `main` est détruite.
- Changer de fenêtre garde sa latence actuelle : il faut construire la nouvelle fenêtre (~0,2 à 0,7 s en dev) avant que le fondu commence.
- Les zones découvertes par un agrandissement prennent un instant la couleur de fond native de la fenêtre (#171021), proche de `--bg-mid` sans être identique.
- `cargo fmt --check` signale des écarts antérieurs dans `scene_ops.rs`, `share.rs` et `platform/mod.rs` (fichiers non touchés).

**Mesures** : à faire à l'étape 13, « pendant un passage » (information seulement).

**Ton retour (4b-2)** : validé à l'œil. Commité (`0a3c8fd`), tag `da-r4b-2`.
**Tes décisions** :
- Option A (voile natif) pour main ↔ widget.
- Puis un spike mesuré de l'ouverture dans une fenêtre transparente dédiée. Critères :
  - premier affichage ≤ 1 s ;
  - aucune image > 8 ms pendant la relève ;
  - mémoire rendue en ≤ 5 s ;
  - relève sans saut visible.
- Captures plein écran autorisées pour la rafale de la relève (supprimées ensuite). Arrêt avant la séance de mesure. Si les critères échouent : ouverture opaque actuelle.

### 4b-2b — Voile natif entre `main` et le widget (option A, 2026-10-12)
**Le problème** : `main` est opaque. Après son fondu vers le sombre, l'écran sombre laissait place au bureau d'un coup.

**Fait** :
- `src-tauri/src/platform/veil.rs` : une fenêtre Win32 **sans WebView** (classe `KayroVeil`).
  - Une couleur unie ; opacité de toute la fenêtre réglée par Windows (`SetLayeredWindowAttributes`).
  - Laisse passer les clics, jamais activée, hors Alt+Tab et barre des tâches, au premier plan.
  - Coins arrondis de Windows 11 au-dessus d'une fenêtre à cadre.
  - Posée sur le **rectangle visible** de la fenêtre (bornes du cadre DWM, sans les bords invisibles).
  - Créée et détruite sur le fil de la boucle d'événements. Deux fonctions de plus de la crate `windows` (DWM, LibraryLoader), aucune nouvelle dépendance.
- `src-tauri/src/desktop/veil_play.rs` :
  - **main → widget** : `main` s'efface (comme en 4b-2) ; un voile de la même couleur la couvre à 100 % ; le widget s'affiche devant et `main` est détruite dessous ; le voile s'efface dans le bureau.
  - **widget → main** : le widget s'efface sur le bureau ; un voile monte de 0 à 100 % sur la place de `main` ; `main` s'affiche dessous ; le voile disparaît et la page de `main` entre.
  - L'opacité suit la courbe envoyée par la page, échantillonnée (17 points), par pas de 8 ms.
- La page qui s'efface envoie avec son `passage_faded(id, veil)` : la **couleur** vers laquelle elle s'est effacée (le fond de `main`, ou `--bg-mid` pour le widget), la **durée** et la **courbe**, toutes deux tirées de la table de mouvement (`veilFade`) :
  - `main` qui part : 0,7 × court = 168 ms, courbe de disparition ;
  - widget qui part : court = 240 ms, courbe d'apparition.
- « Réduire les animations », niveau 2 coupé ou Éco : pas de voile (changement direct). Immersif ⇄ fenêtre : pas de voile (même fenêtre).

**Testé** :
- vitest **499/499** (+ `veilFade`, `parseRgb`) ; cargo test **179** (+ courbe du voile et bornes des valeurs de la page) ; clippy propre ; types régénérés.
- En vraie fenêtre (app de banc), opacité du voile **lue par l'API Windows** toutes les ~5 ms, sans capture d'écran :

  | Passage | Voile relevé |
  |---|---|
  | immersif → widget | apparaît à 255 sur 2560×1440 à 847 ms ; s'efface **255 → 0 de 906 à 1 033 ms** (lent puis rapide) ; détruit à 1 066 ms |
  | widget → fenêtre (↗) | posé sur **1282×792** (la fenêtre avec sa barre de titre, sans bords invisibles) ; monte **0 → 255 de ~1 000 à 1 166 ms** (rapide puis lent) ; détruit à 1 292 ms, une fois `main` affichée (fenêtre 1280×760, page entrée) |
  | fenêtre → immersif | aucun voile |

- Réglage d'affichage remis sur « immersive ».

**Non testé** :
- **le rendu à l'œil** (pas de captures) : la couleur exacte du voile face au fond de `main`, les coins arrondis, l'ordre des fenêtres (widget devant le voile) ;
- multi-écrans ;
- une échelle autre que 150 %.

**Limites connues** :
- Le voile est d'une seule couleur : il rejoint exactement le fond uni de `main` effacée, pas son atmosphère.
- Pendant les ~170 ms du voile, les clics le traversent vers le bureau.

**Correctif du lanceur de l'atelier** (`scripts/Kayro-atelier.ps1`, ton erreur « op_Addition ») : quand le script démarrait Vite lui-même et que le serveur avait au moins deux processus enfants, `$p, $todo = $todo` faisait du reste de la liste un simple nombre, et le `+=` suivant échouait. Le parcours utilise maintenant une vraie file. `conhost.exe` (qui ne peut pas rejoindre le job et meurt avec sa console) est écarté, ce qui supprime un avertissement trompeur. Vérifié : erreur reproduite à l'identique dans Windows PowerShell 5.1, puis `-ServerOnly` deux fois : Vite démarre, répond, s'arrête, port libéré.

**Ton retour (voile)** : validé à l'œil. Commité (`cfde663`), tag `da-r4b-2b`.

### 4b-3.0 — Spike : l'ouverture dans une fenêtre transparente dédiée (préparé, non mesuré)
**Code temporaire, actif seulement avec `KAYRO_SPIKE_OPENING=1`** (l'app normale ne change pas) :
- `src-tauri/src/desktop/opening_window.rs` : au démarrage normal en immersif, la fenêtre `opening` est construite **en premier**. Elle est transparente, plein écran sur l'écran de l'immersif, au premier plan, hors barre des tâches.
- `main` est ensuite construite cachée, opaque comme aujourd'hui.
- Sans départ de l'ouverture en 1,5 s (6 s en debug), `opening` est abandonnée et `main` s'affiche comme aujourd'hui.
- Commandes temporaires `spike_opening_*` (départ, relève, fin, synchronisation, relevé).
- Page `?w=opening` (`src/features/opening/spike/OpeningWindow.tsx`) : chronologie V1-A à l'identique.
  - Voile de 0 → 42 % sur le bureau (sur le fondu du fond, 700 ms).
  - Fond de Kayro (moteur) visible seulement dans l'anneau (rayon + 16 px), puis révélé en cercle jusqu'à couvrir l'écran **sur le ringOut réel** (sa progression = ce que l'anneau perd d'opacité).
  - Onde de 400 → 2 240 px, pleine jusqu'à 80 % (pas en Éco).
- **Relève** quand le cercle couvre l'écran (2 600 ms) :
  - `main` s'affiche dessous et joue son ouverture opaque **à partir de la même heure de départ** (`runOpening` accepte maintenant une heure de départ et un rappel par image) ;
  - `opening` reste opaque 200 ms, s'efface en 150 ms, puis elle est détruite ;
  - Échap ou clic : relève immédiate, `main` passe directement à l'accueil.
- Mesures : `KAYRO_BENCH_OPENING=<fichier>` reçoit l'âge du processus à chaque étape, et les intervalles d'images des deux pages pendant la relève (pour `main`, à partir du moment où elle se voit).

**Essais à blanc (release, non comptés)** :
- premier affichage 1,23 s, puis **1,05 s** une fois `opening` construite avant `main` ;
- relève 2,6 s après le départ ;
- `main` une fois visible : max 3,8 ms ;
- `opening` pendant la relève : 1 image à 14,4 ms.

Tout est **à mesurer** dans la séance (PC libre). Plan :
- base actuelle (ouverture opaque) ×3, spike ×5 (affichage, images) ;
- mémoire ×2 spike et ×1 base (arbre de processus toutes les 500 ms, jamais en même temps qu'un relevé d'images) ;
- rafale de captures autour de la relève ×2 (supprimées ensuite).

**Séance de mesure (2026-10-12, PC libre)** :
- **Conditions.** Release (`tauri build --no-bundle`), 2560×1440 à 150 %, 278 Hz, tes données réelles, mode immersif.
  - `Get-Process` : aucun jeu. Comet (~22 % du processeur) et Steam encore ouverts : **fermés par moi avec ton accord**, fermeture propre (fenêtre de Comet, `steam -shutdown`). Charge de fond ensuite ~3 %.
  - Lancements alternés base / spike : 3 base (ouverture opaque d'aujourd'hui) et 5 spike pour les temps et les images ; mémoire à part (2 spike, 1 base) ; 2 rafales de captures (supprimées, conclusions ci-dessous seulement).
- **Premier affichage** (âge du processus au moment où la première fenêtre s'affiche) :
  - **base** (`main` affichée) : 733 / 770 / 774 ms, médiane **770**, pire **774** ;
  - **spike** (`opening` affichée) : 723 / 729 / 747 / 759 / 793 ms, médiane **747**, pire **793** → **≤ 1 s ✅**, et pas plus lent qu'aujourd'hui.
  - Départ de l'animation : médiane 780 ms, pire 828 ms.
  - `main` est prête ~60 ms plus tard qu'en base (787–852 ms), mais cachée.
- **Images pendant la relève** (5 essais propres, sans outil de mesure qui tourne en même temps) :
  - page `opening` (maintien 200 ms + fondu 150 ms) : max **3,8 / 7,2 / 10,6 / 10,7 / 14,2 ms**, médiane **10,6**, pire **14,2**. **Une image > 8 ms dans 3 essais sur 5, jamais plus d'une par essai.** Les 4 essais perturbés (mémoire, captures) la montrent aussi (10,4 à 17,9 ms).
  - `main`, dès qu'elle se voit : max 3,7–3,8 ms, médiane 3,8, pire 3,8, **aucune image > 8 ms** (9 essais sur 9).
- **Mémoire** (privée, arbre de processus entier, 2 essais spike contre 1 base) :
  - pic à la relève **1,19–1,20 Go** contre 0,58 Go en base ;
  - le processus de la fenêtre `opening` disparaît ~0,5 s après sa destruction (8 → 7 processus) ;
  - **5 s après** : 640–668 Mo contre ~450 Mo en base au même moment, **+190 à 220 Mo restants** ;
  - fin de la fenêtre de mesure (~12 s) : +75 Mo.
  - Réserve : `main` finit son ouverture ~2,6 s plus tard en spike, donc les deux courbes ne sont pas au même stade.
  - Critère « rendue en ≤ 5 s » : **non tenu**.
- **Relève à l'œil** (2 rafales de ~45 captures, toutes les ~30 ms) : **saut visible dans les 2**.
  - Juste après la relève (~2,62 s), une à deux captures montrent le logo et les lettres **nettement assombris**, et la **barre de l'accueil** qui transparaît en haut ; puis l'image redevient normale. Critère **non tenu**.
  - Cause probable : en immersif, `main` passe au premier plan dès qu'elle a le focus (règle de l'étape 12). Elle se met donc **au-dessus** de la fenêtre `opening` avant d'avoir dessiné son ouverture au bon instant : ses premières images ont le logo à l'instant 0, et le calque de l'accueil est visible une image.
  - Correctif possible, **non essayé** : montrer `main` sans focus et sous `opening`, attendre qu'elle signale « je suis à l'heure », puis effacer `opening` et donner le focus.

**Code du spike : toujours dans l'arbre de travail, non commité** (temporaire, `KAYRO_SPIKE_OPENING=1`). À retirer ou à finir selon ta décision.

### 4b-3.0 bis — Dernière tentative (ta règle stricte, 2026-10-12)
**Règle, sans exception** : un saut dans une rafale, **ou** plus de +50 Mo à **30 s** par rapport à l'ouverture opaque → abandon (tout le code du spike retiré, ouverture opaque). Sinon : rapport, puis 4b-3 pour de bon.

**Relève corrigée** :
- `main` est montrée **sans focus** (`ShowWindow` sans activation), donc sous la fenêtre `opening`, qui est au premier plan.
- Elle joue l'ouverture à la même heure de départ. Après **deux images peintes** au bon instant, elle signale « calée » (`spike_opening_caught_up` → événement `SpikeOpeningFade`).
- `opening` s'efface alors (150 ms ; sécurité : 1,5 s après la relève), libère son contexte WebGL, puis elle est détruite. **Seulement ensuite**, `main` reçoit le focus.
- Correctif en chemin : la fenêtre `opening` est ajoutée aux fenêtres de `capabilities/default.json`, mêmes droits que `main` et `widget`. Sans ça, sa page ne pouvait pas écouter l'événement.
- Essai à blanc : relève 3 600 ms → `main` derrière 3 607 → calée **3 674** → `opening` détruite 3 866 → focus de `main` 3 899.

**Mémoire, première analyse** (relevé par type de processus, essai à blanc, PC non libre) :
- c'est le **processus GPU partagé** de WebView2 qui garde la mémoire : ~960 Mo au pic, puis **~620 Mo après la destruction** de `opening` ;
- les processus de rendu : 66–103 Mo ; le navigateur : ~42 Mo.
- Variante préparée : `KAYRO_SPIKE_OPENING_ENV=own` donne à `opening` **son propre environnement WebView2** (son propre dossier de données, donc ses propres processus navigateur et GPU, qui disparaissent avec elle). Coût à mesurer : le premier affichage (un second navigateur à démarrer).

**Séance finale (2026-10-12, PC libre)** :
- **Conditions.** Release, tes données, immersif. `Get-Process` : aucun jeu. Comet encore ouvert (~22 % du processeur) : **fermé par moi avec ton accord**. Ta règle complétée : premier affichage ≤ 1 s avec la variante retenue.
- **Choix de la variante** : relevés mémoire de 32 s par type de processus, alternés.

| Cas (30 s après le lancement) | Total | Processus GPU | Premier affichage |
|---|---|---|---|
| ouverture opaque (base, 2 essais) | **368 / 369 Mo** | 235–236 Mo | `main` à 757 / 795 ms |
| spike, environnement partagé (2 essais) | **437 / 440 Mo** (+68 / +72) ❌ | 286–287 Mo | `opening` à 753 / 759 ms ✅ |
| spike, environnement propre (2 essais) | 422 / 423 Mo | 280–281 Mo | **jamais** : `opening` pas démarrée dans la limite de 1,5 s ; `main` affichée à **~2,0 s** ❌ |

- La relève corrigée a fonctionné sur les 2 essais en environnement partagé : `main` calée 32–37 ms après la relève ; images de `main` une fois visible : max 3,8 ms. Image lente de la fenêtre d'ouverture pendant la relève : 3,8 ms puis 17,8 ms.
- Lecture :
  - En environnement partagé, le surplus est dans le **processus GPU commun**, qui garde ~50 Mo de plus que la base à 30 s, malgré la libération explicite du contexte WebGL avant la destruction. La mémoire redescend encore lentement, mais la règle se lit à 30 s.
  - Un environnement propre libère tout, mais un second navigateur WebView2 démarre trop lentement, et il retarde aussi `main`.

**Décision (ta règle, sans exception) : abandon.**
- Ni les 5 lancements officiels ni les rafales n'ont été faits (aucune capture prise).
- **Tout le code du spike est retiré** : fichiers revenus à l'état de `cfde663` (`mod.rs`, `ipc.rs`, `ipc_desktop.rs`, `own_window.rs`, `capabilities/default.json`, `runOpening.ts`, `Opening.tsx`, `useOpening.ts`, `App.tsx`, `main.tsx`, `index.css`, liaisons IPC) ; `opening_window.rs` et `src/features/opening/spike/` supprimés.
- Le dossier WebView2 `%LOCALAPPDATA%\fr.yiuno.hub\opening-webview` (15 Mo, créé par la variante « environnement propre ») est supprimé, et le release reconstruit sans le spike.
- Vérifié : tsc, eslint, vitest 499/499, clippy, cargo test 179.
- **4b-3 garde l'ouverture opaque actuelle (V1-A).**
- Reste de 4b-3, **à faire seulement sur ton feu vert** : ta décision « démarrage silencieux = pas d'ouverture » (`opening_due`), indépendante de la transparence.
- Ton accord (2026-10-12) : abandon confirmé, « la règle est la règle ». Note ajoutée dans « À retenter plus tard » (plus bas).

### 4b-3 — Démarrage silencieux sans ouverture, essai de la pulsation C dans l'ouverture opaque (2026-10-12)
**1. Démarrage silencieux = pas d'ouverture** (ta décision) :
- `ipc_desktop.rs` : l'état « une fois par lancement » devient `OpeningOnce`, et `desktop::startup` le marque au démarrage silencieux. `opening_due` répond alors `quiet` dès la première question, même fenêtre cachée : la page n'attend plus le premier affichage dans le noir, l'accueil est prêt dessous.
- Ça reste le démarrage du programme : l'accueil s'ouvre sur l'éventail des catégories, comme avec l'ouverture désactivée. Mode économie + silencieux (fenêtre construite au premier affichage) : `quiet`, puis `no`.
- Côté page, rien à changer dans `useOpening.ts` (une réponse autre que `now` / `later` = pas d'ouverture ; autre que `no` = éventail) : commentaire mis à jour, liaisons IPC régénérées (`quiet`).
- Tests Rust : `a_silent_start_plays_no_opening` (nouveau), l'ancien adapté. **Non testé en vrai démarrage silencieux** (lancement avec `--silent`).

**2. Essai : la pulsation de la variante C dans l'ouverture opaque** (sans transparence ; à valider à l'œil) :
- Réglage de l'élément `opening` : `pulse` = « actuelle (V1-A) » (**défaut** : l'app ne change pas) ou « variante C » ; `veil` (42 %) et `wave` (intensité de l'onde, 0,55). Valeurs dans `tokens.ts` (`OPENING_C`).
- Avant le ringOut : le fond de Kayro n'est visible que dans l'anneau (cercle de 200 + 16 px, pour garder ses filets et son reflet dedans), avec un voile noir à 42 % autour, sur le fond actuel (moteur ou repli CSS). Le halo du moteur est donc assombri hors du cercle.
- Au ringOut (1 750 ms, 850 ms, `(.4,0,.2,1)`), avec la **même fonction** `ringOutAt` que l'anneau :
  - le cercle s'ouvre jusqu'au coin le plus loin de l'écran ;
  - l'onde (cercle de 400 px agrandi en `scale`, couleur A, seul son halo extérieur dessiné) roule sur le bord : pleine jusqu'à 80 %, puis elle s'efface ;
  - page entière à 2 600 ms. Rien d'autre ne change (instants de V1-A).
- Éco : pas d'onde. « Réduire les animations » : état final direct. Clic ou touche : saut à la fin, sans voile.
- Technique : deux calques DOM dans `Opening.tsx`, montés seulement en variante C, au-dessus du fond, du halo et de l'anneau, sous le logo et les lettres.
  - Le voile est un dégradé radial plein écran, repeint à chaque image pendant les 850 ms de la pulsation seulement.
  - L'onde ne change que `transform` et `opacity`.
  - Calcul pur et testé : `openingReveal.ts` (5 tests).
- Vérifié dans le volet du navigateur (1280×720, instants figés) :
  - jusqu'à 1 700 ms : voile 0,42, trou de 216 px ;
  - 2 050 ms : trou de 495 px, onde 0,55 ;
  - 2 500 ms : 761 px (l'écran est couvert à 766), onde 0,02 ;
  - 2 600 ms : plus de voile.
  - Aucune erreur dans la console. Le volet était masqué : je n'ai pas vu l'animation jouée en temps réel.
- **À mesurer** (PC libre) : coût d'image pendant la pulsation (cible ≤ 8 ms, note R4b), en Élevée et en Éco, dans la vraie fenêtre.
- Contrôles : tsc, eslint, prettier, vitest 504/504, clippy, cargo test 180.

**Tes décisions (2026-10-12)** :
- **Pulsation C validée à l'œil, et mise par défaut** (`pulse` = `c` dans le catalogue et dans `openingSettings`), avec les réglages par défaut : voile 42 %, onde 0,55. « actuelle (V1-A) » reste dans l'atelier pour comparer.
- Démarrage silencieux : l'accueil **reste sur l'éventail**, c'est l'accueil normal.
- **Mesures, étape 13** : case ajoutée, « coût par image pendant la pulsation C » (cible ≤ 8 ms, Élevée et Éco, vraie fenêtre, build de production).
- Commit `feat: DA ronde 4b-3 — …`, tag `da-r4b-3`, sans fusion dans `main`.

### Correctifs de relecture (rondes 3, 4a, 4b) — 2026-10-12
Relecture en lecture seule, corrigée en trois paquets (arrêt après chacun, pas de commit).

**Paquet A — bugs** :
- **A1 voile orphelin** (`veil_play.rs`) : `run_on_main_thread` ne garantit aucun délai (vérifié dans tauri-runtime-wry 2.12.1 : message à la boucle, exécuté plus tard ou jeté ; immédiat si on est déjà sur le fil principal). Le délai de 500 ms reste, mais une réponse tardive est détruite par le fil qui l'a créée (`answer_or_undo` : drapeau « abandonné » sous verrou + dernier `try_recv`). Plus de voile opaque au premier plan pour toujours.
- **A2 double changement de mode** (`modes.rs`, `ModeGate`) : pendant un passage qui construit une fenêtre, un autre changement (zone de notification, réglages) est **mémorisé**, puis appliqué quand la nouvelle fenêtre est à l'écran (`reveal` → `passage_ended`), depuis le mode réellement montré (widget, ou `main` avec / sans cadre). Passage resté en vol > 5 s : abandonné, journalisé. `reveal` ne détruit plus jamais la fenêtre qu'il montre.
- **A3 boucle du survol** (`cardHoverFx.ts`) : quitter une carte remet toujours la carte à zéro ; la boucle s'arrête quand plus rien n'est allumé ni en fondu, et `leave()` la libère aussi. Passage de A à B : les filets de A s'éteignent en 168 ms, B s'allume ensuite (au plus tôt à 120 ms). Boucle injectable pour les tests.
- **A4 passage demandé deux fois** : côté Rust, un passage remplacé (`Disconnected`) ne fait plus rien ; côté page, seul le « in » du dernier « out » compte, et un « in » arrivé après le filet de 2,5 s ne rejoue pas l'entrée.
- **A5 attente de taille** : `ModePassage.resized` (le cœur compare cadre et taille intérieure avant / après, vrai si doute). La page n'attend `resize` (≤ 300 ms) que si la taille change et n'est pas encore là ; l'écouteur est retiré dans tous les cas.
- **A6 widget puis ↗** : si l'ouverture va jouer (`openingOwnsEntrance`), la page construite pour le passage apparaît d'un coup, sans fondu ni cascade : l'ouverture fait l'entrée.
- **A7 classe du voile** (`veil.rs`) : seul un atome non nul est gardé ; un refus est journalisé (erreur Win32) et retenté au voile suivant.
- Refactor : la logique de `usePassage.ts` est dans `passageDriver.ts` (E/S injectées), le hook ne branche que le DOM et l'IPC.

**Testé** : vitest **514/514** (+ `cardHoverLife.test.ts` : 3 tests qui échouent sur l'ancien code ; `passageDriver.test.ts` : 7 tests) ; cargo test **189** (+ `answer_or_undo` ×3, `ModeGate` / double changement ×4, `awaited`, atome du voile) ; clippy propre ; tsc, eslint ; liaisons régénérées (`resized`). `cargo fmt --check` : seulement les trois écarts antérieurs.
**Non testé** : tout le paquet en vraie fenêtre (double changement depuis la zone de notification, widget puis ↗ avec ouverture, immersif ⇄ fenêtre deux fois vite) ; le survol en mouvement dans le volet du navigateur (`requestAnimationFrame` y est suspendu, volet masqué), vérifié seulement en unitaire. `src/features/modes/passage.test.ts` est signalé par prettier (antérieur, non touché).

**Exe de production pour tes tests (ta demande, 2026-10-12)** :
- Raccourcis du Bureau (`scripts/install-raccourcis.ps1`) : **« Kayro »** → `target\release\Kayro.exe` directement ; **« Kayro — mettre à jour »** → `scripts\Kayro.cmd -Force` : quitte Kayro doucement s'il est ouvert, recompile en release (sans installeur, ~1 min), relance l'exe ; « Kayro (atelier) » inchangé.
- Nouveau **`Kayro.exe --quit`** (`lib.rs`) : l'instance ouverte quitte comme « Quitter » (la croix ne fait que masquer) ; sans Kayro ouvert, l'exe s'arrête tout de suite. `build-local.ps1` et `Kayro.ps1` s'en servent (jamais de fermeture forcée). Mesuré : fermeture en 241 ms. Test Rust `only_the_quit_flag_asks_to_quit`.
- **Bug trouvé en vérifiant l'exe** (antérieur au paquet A, logique de la ronde 3) : au lancement normal, **écran sombre pour toujours**, ni ouverture ni accueil. La page s'annonce prête 2 images après son montage (~7 ms à 278 Hz) ; le cœur affichait la fenêtre avant que `useOpening` soit abonné à « fenêtre affichée » (il ne s'abonne qu'après la réponse « plus tard ») : événement perdu, accueil resté à opacité 0. Reproduit 3 fois, dont une sans aucun outil de mesure branché. Correctif (`useOpening.ts`) : une fois abonnée, la page redemande une fois ; seule la première réponse définitive compte.
- **Vérifié sur l'exe corrigé** (débogage WebView2 local pour ce seul lancement, aucune capture d'écran) : page `http://tauri.localhost/` (build de production, pas Vite) ; tes données `%APPDATA%\Kayro` (`displayMode` = immersive, 2 apps) ; fenêtre 2560×1440 en (0, 0), page 1707×960 à 150 % ; **ouverture à pulsation C jouée** : voile 0,42 et trou de 216 px dès 1,0 s, ringOut de 2,79 à 3,62 s (trou 216 → 1 021 px, onde 0,55 puis éteinte), accueil à ~5,6 s.

**Ton retour (paquet A)** : validé avec l'exe. Commit `ac6ee62`, tag `da-fix-a`.

**Paquet B — perf, accessibilité, cohérence** :
- **B1** `linkDirector.ts` : `promote(false)` dans `rest()` et `dispose()` (plus de `will-change` oublié sur le titre, les boutons, les onglets après une séquence coupée). Test.
- **B2** `src/app/windowVisible.ts` (`useWindowVisible`, un seul écouteur pour la page) : le reflet sous le titre, le voile brillant CSS et le reflet des cartes (`Shine`) coupent leur minuteur et leurs animations fenêtre masquée, et reprennent au retour.
- **B3** `useListMotion(list, état, layoutKey, frozen)` : plus aucune mesure à un simple rendu. Mesure quand la clé change (Avancé : clés des étapes + étape ouverte ; Simple : apps) ; un `ResizeObserver` remet les positions à jour quand une ligne change de taille (sans animation) ; `useDrag` a un `onEnd` qui prend un instantané juste avant le dépôt ou l'annulation (les lignes portent encore les décalages du glisser). La règle eslint `react-hooks/refs` interdit de mesurer pendant le rendu : d'où l'objet d'état stable (`ListMotionState`). **Écart** : une ligne qui change de hauteur (texte qui passe à la ligne) ne fait plus glisser les suivantes, elles se placent directement.
- **B4** `Carousel.module.css` : pas de soulèvement pendant le défilement rapide (`data-fast`).
- **B5** le voile périodique de la carte choisie suit le réglage `cardSheen` (champ modifiable de `CardHoverFx`).
- **B6** indication de l'ouverture en `role="status"` ; saut seulement sur clic, Échap, Entrée, Espace (Tab passe) ; texte « Échap, Entrée, Espace ou clic pour passer ». Test.
- **B7** `src/fx/useReducedMotion.ts` (abonné à `change`) : carrousel, éventail, titre, reflets. `cardTilt.ts` **inchangé** : il lisait déjà `.matches` en direct à chaque mouvement (sans allocation).
- **B8** `#root` inerte entre « out » et le retour (pilote de passage), libéré aussi par le filet et au démontage. Tests.
- **B9** (ta réponse : nouvelles entrées de la table) `eases.ts` : `glisse` (0.42, 0, 0.58, 1), `standard` (0.4, 0, 0.2, 1), `detente` (0, 0, 0.58, 1), libellés dans l'atelier. Flash au lancement → `detente` ; voile brillant CSS **et moteur** (`sheen.ts`, avant une quadratique proche) → `glisse` ; reflet du titre → `standard`, durées dans `TITLE_SHINE` (1 100 / 450 ms, divisées par la vitesse) ; filets du survol sur la courbe d'apparition de la table ; sortie du titre par `fmTransition` (niveau 2, court × 0,7 = 168 ms, courbe « sortie », au lieu de 200 ms « douce ») ; courbe de survol de l'éventail = `premium` (même valeur). Constantes de `fanFloat.ts` et `STILL_MS` documentées « non réglables ».
- **B10** `tokens4b.ts` (204 lignes) : widget, chaîne, états, ouverture C ; `tokens.ts` passe de 399 à 247 lignes (sens unique tokens → tokens4b).
- **B11** commentaire de `design/motion.ts` corrigé (Framer ne reste que pour l'entrée du titre) ; `EASE` supprimé (plus d'usage) ; `stepsEnd` déplacé dans `unroll.test.ts`.
- **B12** tests : pilote de passage (inert, filet de 2,5 s, « out » qui relance l'attente, démontage) et cycle de vie de `CardHoverFx` (rentrée sur la même carte, molette, `dispose` pendant un fondu, défilement rapide).

**Testé** : vitest **522/522** ; tsc, eslint, prettier (sur mes fichiers) ; volet du navigateur sans erreur (accueil, éditeur : ajouter une étape anime la nouvelle et fait glisser les voisines, ouvrir une étape fait glisser les suivantes ; atelier : les trois courbes dans les choix). **Exe reconstruit** (1 min 16 s) : ouverture C toujours jouée au lancement, `#root` non inerte ensuite, `will-change` vide sur le titre. Aucun changement Rust dans ce paquet.
**Non testé** : le rendu à l'œil (courbes, sortie du titre, reflets) ; « réduire les animations » basculé en direct dans Windows ; la pause des reflets fenêtre masquée mesurée (logique seulement) ; le glisser-déposer réel de l'éditeur dans l'exe.
**Ton retour (paquet B)** : validé avec l'exe. Commit `68f885f`, tag `da-fix-b`.

**Paquet C — le voile de la pulsation C dans le moteur** :
- Avant : un `radial-gradient` plein écran (2560×1440) repeint à chaque image pendant les 850 ms du ringOut.
- Maintenant : le cue d'ouverture porte `veil` = [centre x, y, rayon, opacité] (`IntroFrame`, comparé dans `sameIntro`) ; la passe de verre (`glassShader.ts`, uniforme `uIVeil`) assombrit en dernier tout ce que le moteur dessine (fond, halo, anneau, particules) hors du cercle, avec le même bord de 1 px que le dégradé : `col *= 1 − a · clamp(|p − c| − r, 0, 1)` en px CSS.
- Choix à chaque image (`engineDrawsVeil`) : moteur demandé **et** moteur actif → le calque CSS reste à 0 sans recevoir son trou (plus de repeinture) ; sinon (réglage « CSS », pas de moteur, contexte perdu en cours) le calque CSS d'avant.
- Atelier : `opening.veilRender` = « le moteur (WebGL2, CSS en repli) » (défaut) / « le CSS (dégradé repeint) », comparable en A/B sur l'écran « Ouverture (rejouable) ». L'onde reste en CSS (`transform` et `opacity` seulement).
- **Identité vérifiée au pixel** : le vrai shader de verre compilé dans WebGL2, fond gris 128 : 128 dans le trou, **101** à r + 0,5 px, **74** dehors ; le calque CSS donne 128 / 101 / 74 (noir à 42 %). Branchement vérifié dans la page de dev (instant figé 2 050 ms) : moteur → calque CSS à 0, cue [640 ; 299,5 ; 494,9 ; 0,42] ; « CSS » ou sans moteur → calque CSS 0,42, trou de 494,9 px.
- Écart possible à l'œil : la tuile de grain CSS (0,09, au-dessus du canvas) n'est plus assombrie hors du cercle. La vignette, elle, donne le même résultat (deux voiles noirs qui se multiplient).
- **Mesure du coût : non faite.** PC occupé (Hades II en cours, dernière saisie il y a 0 à 2 s). **À mesurer à l'étape 13** : intervalles d'images pendant le ringOut, CSS contre moteur, Élevée et Éco, exe de production.
- Testé : vitest **525/525** (+ choix moteur / CSS, uniforme, `sameIntro`), tsc, eslint, prettier, cargo test 190 ; exe reconstruit (en priorité basse, 1 min 33 s). **Non testé** : l'animation jouée en vrai (le volet du navigateur est masqué, et je n'ai pas lancé l'exe pendant ton jeu).

**Ton retour (paquet C)** : validé avec l'exe. Commit `perf: relecture DA paquet C — …`, tag `da-fix-c`.

**Fin des correctifs de relecture (2026-10-12)** : paquets A, B et C validés avec l'exe de production (tags `da-fix-a`, `da-fix-b`, `da-fix-c`), sans fusion dans `main`. Restent ouverts :
- la mesure du coût du voile (moteur contre CSS), à faire à l'étape 13 ;
- l'écart de la tuile de grain, qui n'est plus assombrie autour de l'anneau. Rien n'a été relevé au test à l'œil.

**Incident** : un `prettier --write` lancé sur des dossiers entiers a converti les fins de ligne de ~40 fichiers non touchés et reformaté `widgetModel.ts` (écart antérieur) : tout remis dans l'état du dépôt ; `SceneDock.module.css` laissé intact (son contenu égale le dépôt). Prettier ne passe plus que sur mes fichiers.

### Reste à faire
> Repris dans `docs/ROADMAP.md` § « Plus tard (liste unique) » au gel de la DA (2026-10-14) : c'est là qu'on le suit.
- **4a** : commit après ton feu vert, puis tag `da-r4a`. Mesures : voir ci-dessus (vérification globale).
- **4b** : voir la ronde 4b ci-dessus (4b-1a `da-r4b-1a`, 4b-1b `da-r4b-1b` ; spike 4b-2.0 fait → **repli** ; 4b-2 `da-r4b-2` ; voile `da-r4b-2b` ; ouverture transparente **abandonnée** après la dernière tentative (mémoire +68/+72 Mo à 30 s en environnement partagé, environnement propre trop lent) : code du spike retiré, 4b-3 garde l'ouverture opaque ; démarrage silencieux sans ouverture et pulsation C dans l'ouverture opaque **faits, validés** (`da-r4b-3`) ; coût par image de la pulsation **à mesurer** à l'étape 13). Ancienne note 3c, remplacée par R4b : éditeur « chaîne de points » (fil vertical A→B, point qui apparaît 0,6→1 en 250 ms, segment qui se trace en `scaleY` 300 ms, suivants qui glissent en ressort « net », perle lumineuse qui descend pendant l'exécution d'une scène ; DOM seul) ; dépliage du widget (fenêtre à sa taille finale tout de suite, contenu 0,94→1 + fondu 240 ms, lignes en cascade 30 ms, repli 180 ms ; CSS seul).
- Remesurer l'ouverture (CPU/GPU, repli CSS) PC libre, dont le voile de la pulsation C : moteur contre CSS (`opening.veilRender`), intervalles d'images pendant le ringOut, Élevée et Éco.

### À retenter plus tard
> Repris dans `docs/ROADMAP.md` § « Plus tard (liste unique) » au gel de la DA (2026-10-14) : c'est là qu'on le suit.
- **Fenêtre d'ouverture transparente, environnement WebView2 partagé** (4b-3.0 bis) : elle n'a échoué que de peu. Mémoire à 30 s : **+68 / +72 Mo**, pour une limite de 50 Mo. Le reste passait : premier affichage 753 / 759 ms, relève sans saut. Le surplus est dans le processus GPU commun de WebView2.
- **À remesurer à la finition**, si une version de WebView2 libère mieux la mémoire de ce processus. Même protocole : release, PC libre, 2 essais alternés avec la base opaque, mémoire par type de processus à 30 s. Le code du spike est à reprendre dans l'historique de la conversation : il n'a jamais été commité.

## Ronde 5 — 2026-10-13 (dernière avant le gel ; trois paquets, arrêt après chacun)
**Sources** (font foi) : `reference/animations/R5-notes/r5-notes/R5-Reglages-Themes.txt`, `R5-Flottaison.txt`, `R5-Personnalisation.txt` ; base : `docs/PROPOSITIONS-DA.md` (Fable). Plan validé (copie : `C:\Users\tomca\.claude\plans\r-ponds-moi-toujours-en-fran-ais-glowing-pixel.md`).
**Tes décisions** :
- Mouvement : **Vivant = l'actuel** (défaut) ; Complet = la magie aussi en mode fenêtre et au clavier ; Net = sans rebond ni magie.
- Atmosphère : Douce 0,6 · **Normale 1,0** (rendu actuel) · Forte 1,3.
- Sélecteur de mode : bouton rond + petit menu (paquet 2).
- « Sous-catégories » = les cartes d'apps du carrousel : même réglage de flottaison (±2 / ±5 / ±8 px).
- Grille des thèmes : Bleu-gris, Lavande-pêche, Encre, Sakura, Opale, Cuivre. Migration v2 : mauve → encre, les 5 anciens → bleu-gris.
- « Couleurs du jeu » masqué tant qu'il n'a aucun effet (valeur gardée dans le schéma).

### Paquet 1 — Réglages, thèmes, personnalisation (2026-10-13)
**Fait** :
- **Schéma Rust** (`config/schema.rs`, nouveau `config/visual.rs`) :
  - `Quality::Auto` ;
  - `motionStyle`, `followSystemMotion`, `cardFloat`, `openingStyle`, `themeTransition`, `widgetUnroll`, `widgetSpring`, `cardHover`, `bokeh`, `particles`, `cursorLight` ;
  - thème par défaut `bleu-gris` ; atmosphère bornée à 0,3–1,3.
  - **Migration v1 → v2** : mauve → encre, crepuscule / boreale / ocean / rose / graphite → bleu-gris, `.bak` écrit. Les champs absents prennent leur défaut.
  - Tests : `config/settings_r5_tests.rs` (5).
- **Réglages → DA** (`design/da/userDa.ts`, installé par `app/userPrefs.ts` dans les deux fenêtres) : chaque choix surcharge l'élément du catalogue concerné.
  - `opening.on/pulse`, `motion.widgetMotion/widgetSpring/style`, `categoryHover.float`, `cardHover.style`, `bokeh/embers/stars/cursorLight.on`.
  - Un réglage peut éteindre un élément, jamais l'allumer.
  - Ces sélecteurs sont marqués `user` et ne s'affichent plus dans l'atelier (pas de doublon).
- **Suivre Windows** : `fx/motionPref.ts` (surcharge + abonnement) ; les media queries de `motion.css` / `tokens.css` gardées par `:root:not([data-rm-ignore])` ; `MotionConfig` de l'accueil suit le hook.
- **Mouvement** :
  - Net : courbes « déplacement » et « rebond » = courbe d'apparition (`tokens.ts`), pas de niveau 3.
  - Complet : niveau 3 aussi en mode fenêtre, et la carte choisie au clavier s'allume.
  - Survol des cartes : Simple = soulèvement seul (ressort liaison), Aucun = rien (carrousel et grille).
- **Dialogue unique** (proposition 3) : jeton `--panel-bg` (bg-mid du thème à 92 %), plus de `backdrop-filter`, hauteur bornée, corps défilant, scrim 0,62, taille `settings` (1 040 × 720). Modèle de contraste mis à jour (+5 paires).
- **Réglages** (`features/settings/`) :
  - Général · Visuel · Thèmes en onglets verticaux (flèches, Début / Fin) ; le dernier onglet est retenu tant que l'app tourne.
  - Visuel : Qualité, Atmosphère, Mouvement, Suivre Windows, Affichage au lancement (+ écran), puis « Personnalisation avancée », puis « Revenir aux réglages par défaut ». Le bouton remet tout Visuel sauf l'affichage et l'écran, avec « Annuler » tant que le dialogue est ouvert.
  - Textes : `i18n/fr-settings.json`. Les scènes passent dans `fr-scenes.json` : `fr.json` 504 → 258 lignes.
- **Menu déroulant rebondissant** (`advancedUnroll.ts`, pur, testé) :
  - coque sur les ressorts du widget (vertical 5 % / 680 ms, latéral 2,5 % / 560 ms), chevron 180° sur le même ressort ;
  - lignes en cascade de 45 ms (−10 px, opacité 260 ms), halo sauf en Éco ;
  - ce qui suit glisse avec (FLIP) ;
  - fermeture en 220 ms sur la courbe de disparition ; réduire les animations = direct.
- **Thèmes** :
  - `encre.json` remplace `mauve.json` (valeurs de Fable) ; Bleu-gris en premier et par défaut (`themes/index.ts`, `tokens.css`, `schema.rs`) ; alias mauve → encre (`resolveTheme`).
  - Cartes 240 × 150 en CSS pur aux variables du thème (`ThemeCard.tsx`).
  - **Ombre de pied** sous le nom des cartes de l'éventail.
- **Onde de changement de thème** (`themeSwap.ts` pur + `useThemeSwap.ts`, jetons `THEME_SWAP` dans `tokens5.ts`) :
  - La carte elle-même :
    - survol ×1,03, appui ×1,05 ;
    - −8 px ×1,10, puis +2 px ×0,93 (impact à 380 ms), puis retour sur la liaison ;
    - profondeur en `drop-shadow` ; reflet à 60 ms ; lune à 370 ms ;
    - onde de choc (`box-shadow`) et 12 étincelles à 380 ms ;
    - cadre redessiné à 400 ms ; coche à 620 ms.
  - **View Transitions** lancées à l'impact seulement :
    - la carte est nommée avant la capture, son image ancienne masquée : une seule carte, vivante, rien posé dessus ;
    - nouvelle vue révélée en `clip-path: circle()` depuis la lune (850 ms, `standard`) ;
    - onde de la pulsation C dans son propre groupe, sous la carte, pleine jusqu'à 80 % ;
    - recul ×0,993 de la page centré sur la carte ;
    - moteur relu dans une micro-tâche (thème instantané, `ThemeProvider.setThemeId(id, {instant})`).
  - Fondu (réglage, Éco, pas d'API, moteur en repli) : la carte grandit et s'écrase, puis fondu de 0,9 s. Direct / réduire les animations : changement immédiat. Re-clic ignoré 1,25 s.
- **Flottaison** (`features/home/float/cardFloat.ts`, pur) : un sinus par carte, période × 0,90–1,07, départs décalés de 0,6–0,7 s, bascule alternée.
  - Niveaux (`FLOAT_LEVELS`) :

    | Niveau | Éventail | Carrousel | Bascule | Période |
    |---|---|---|---|---|
    | Légère (= les vraies valeurs d'avant) | 2,5 px | 2 px | 0,1° | 7 s |
    | Visible (défaut) | 7 px | 5 px | 0,8° | 4,4 s |
    | Marquée | 12 px | 8 px | 1,4° | 4,8 s |

  - Éventail : `fanFloat.ts` (dérive latérale au survol gardée).
  - **Carrousel** : `carouselFloat.ts` sur une nouvelle boîte `[data-float]` (carte + crayon) ; en pause (retour en douceur, 240 ms) au survol, molette, défilement rapide, glisser ; immédiate pendant une séquence ; boucle seulement si le niveau n'est pas « Aucune ».
  - **Ombre au sol** dans le moteur : la hauteur passe dans la partie fractionnaire de `uX.w` (aucun nouvel uniforme) ; l'ombre pâlit (× 0,58) et se resserre (× 0,9) à « Marquée » ; le cadre de verre d'une carte basculée est mesuré à sa vraie taille (`setGlassFloat`).

**Testé** :
- tsc, eslint, prettier (mes fichiers), clippy, `cargo fmt` (seulement les 3 écarts connus).
- **vitest 604/604** (+ `settings.test.ts`, `userDa.test.ts`, `cardFloat.test.ts`, `carouselFloat.test.ts`, verre basculé, contraste ≥ 4,5:1 des nouvelles paires sur les 11 thèmes).
- **cargo test 195**.
- Exe reconstruit (79 s).
- **Dans l'exe** (WebView2 en débogage local, pour ce seul lancement) :
  - tes réglages migrés en v2 (`.bak` présent, Lavande-pêche gardé) ;
  - onde vérifiée par captures CDP : ancien thème hors du cercle, nouveau dedans, onde à la couleur A du nouveau thème, thème appliqué vers 380–450 ms ;
  - ton thème Lavande-pêche remis, exe fermé par `--quit`.

**Non testé / limites** :
- **Une image anormale** : au tout premier changement de la session, l'ancienne vue est sortie **blanche** dans la capture CDP. Ce premier clic venait 0,9 s après l'ouverture de l'onglet Thèmes. Non reproduit sur les 2 changements suivants capturés, ni sur 7 transitions témoins ; cause non établie (première capture du canvas WebGL ? fenêtre derrière ta vidéo ? cascade de l'onglet encore en cours ?). Si tu la vois, le réglage « Fondu » l'évite.
- Pas de rafale à l'écran : ta vidéo était au premier plan, et je n'ai plus relancé l'exe par-dessus.
- **Mesures : à mesurer à l'étape 13**. Le PC était occupé (vidéo en lecture) ; or la flottaison du carrousel fait redessiner le moteur au repos (60 i/s, 30 en Éco), comme l'éventail déjà.
- Le volet du navigateur ne rend pas quand il est masqué : le menu déroulant et les cartes n'ont été vus qu'à l'arrêt.
- La grille de plus de 8 cartes n'a toujours pas de niveau 3, même en « Complet » (aucun niveau 3 n'existe dans la grille).
- L'onde garde le dessin de la pulsation C : son halo est de 5,5 % du rayon, pas un halo fixe de 40 px.
- « Couleurs du jeu » : masqué, sans effet. « Qualité Auto » = Élevé avec le repli existant du moteur. L'ombre au sol ne change pas sans moteur (repli CSS).
- Le trou du halo sous la carte active ne suit pas la flottaison : un fin liseré est possible, seulement avec une affiche en texture.

**Ton retour (paquet 1)** : validé dans l'exe. Deux suites avant le commit :
- **Cadence de la flottaison seule** :
  - quand seule la flottaison bouge (éventail ou carrousel au repos), ses boucles tournent à **30 i/s** au lieu de 60 ;
  - elles repassent à pleine cadence dès qu'autre chose bouge : survol, molette, pause qui s'amortit ; la liaison a sa propre boucle (`Choreo`) ;
  - code : `FanMotion.floatingOnly` + `LinkDirector.fpsFor`, `CarouselFloat` (`idleFps`) ; testé (`carouselFloat.test.ts`, `fanFloat.test.ts`).
  - **Pour la mesure de l'étape 13** : le moteur, lui, dessine encore à 60 i/s en Élevé et en Équilibré, parce que les braises et les étoiles sont animées à la cadence d'ambiance (60, depuis la 2a). Le gain n'apparaît donc que particules coupées (réglage « Particules : Non ») ; en Éco, tout était déjà à 30.
  - Cas à mesurer : éventail au repos et carrousel au repos, particules oui / non, Élevée et Éco, CPU et GPU.
- **Point ouvert, à reproduire à l'étape 13 : l'image blanche** au premier changement de thème.
  - **Constat** : une seule fois, dans la capture CDP à 472 ms du tout premier changement de la session, la zone hors du cercle (l'ancienne vue) était blanche. Non revue sur 2 changements capturés ensuite ni sur 7 transitions témoins ; tu ne l'as pas signalée dans l'exe.
  - **Hypothèse principale** : un artefact de ma mesure. C'est la seule fois où une capture CDP (`Page.captureScreenshot`, lancée à 331 ms) chevauchait l'instant où la View Transition capture l'ancienne vue (≈ 380–400 ms).
  - **Autres pistes** : première capture du canvas WebGL dans la vie de la page ; cascade de l'onglet Thèmes encore en cours (clic 0,9 s après l'onglet) ; fenêtre masquée par la vidéo.
  - **Protocole** : exe relancé, PC libre ; ouvrir Réglages › Thèmes, attendre 0,9 s puis 3 s, cliquer une carte. Une fois avec une rafale d'écran Windows seulement (aucune capture CDP), une fois avec une capture CDP à 330–400 ms. Si l'image blanche ne vient qu'avec la capture CDP, le point est clos.

**Commit** : `bc8a7a3`, tag `da-r5-1` (avec `docs/PROPOSITIONS-DA.md`).

### Paquet 2 — Cohérence visuelle (2026-10-13)
**Fait** :
- **1. Bokeh** (moteur seulement) :
  - sprite en disque doux + anneau fin : `a = .55·exp(−r²·2,2) + .45·smoothstep(.80, .93, r)·(1 − smoothstep(.95, 1, r))` (`bgShader.ts`) ;
  - couleur A→B éclaircie de 35 % vers le blanc (`scene.ts`) ;
  - défauts du catalogue : 7 × 120 px, intensité 0,09, zone 8 / 80 ; le bloc d'`actif.json` est aligné ;
  - Éco : 4 au plus ;
  - testé (`bokeh.test.ts`).
- **2. Rayons et petits titres** :
  - Quatre familles dans `tokens.css` : `--radius-pill`, `--radius-row` (16), `--radius-panel` (26), `--radius-card` (30, `cards.radius`) et `--radius-fan` (24 : éventail, carte vide). Tous les rayons de l'app y sont rangés : boutons, segments, interrupteurs, sélecteurs, badges et numéros ronds en pilule ; lignes, champs et tuiles en 16 ; dialogues, palette, menus, notifications, panneaux latéraux et étapes en 26.
  - Les anciens `xs` / `sm` / `lg` / `xl` / `3xl` / `4xl` ne sont plus utilisés dans l'app (gardés dans les jetons, pour l'atelier).
  - Restent hors familles : traits de 1–2 px, case à cocher, piste du curseur, logo de la marque (23,6), mini-cartes des cartes de thème.
  - **Jeton `--eyebrow`** (Manrope 12 / 700, `--eyebrow-tracking` 0,24 em, `--eyebrow-color` = `--text-soft`) pour CATÉGORIE, CHOISIS UN UNIVERS, les titres de l'éditeur (fini Cormorant), la légende de la nouvelle scène et les titres du widget. Le sous-titre de l'ouverture garde 0,32 em.
  - Paramètres `labelTracking` / `softLabel` et CSS mort `Editor.module.css .label` retirés.
  - Paires de contraste du libellé et du panneau passées à `--text-soft`.
- **5. Widget au thème** :
  - un seul style dérivé des jetons (`Widget.module.css`) : barre `bg-mid` 88 % en pilule, logo 22 px + « Kayro », onglet `--fill-tab-active`, bouton principal `--accent`, pastille « Ouvert » `--accent-light`, panneau `--panel-bg` en 26, lignes en 16, avatars en dégradé A→B ;
  - les 4 styles et leurs couleurs en dur sont retirés ;
  - `widgetStyle` est ignoré (gardé dans le schéma), `?style=` est retiré de `/dev/widget` ;
  - le mouvement (`unroll.ts`) est inchangé.
- **6. Barre et dock** :
  - micro et mains **cachés** derrière `app/features.ts` (`voice` / `hands` à `false`), code gardé ;
  - sélecteur de mode = bouton rond (nouvelle icône `DisplayModeIcon`) qui ouvre un petit menu (`PopMenu.tsx`, menu générique dont `AppMenu` se sert aussi : choix coché, flèches, Échap) ;
  - crayon : visible seulement au survol de la carte active ou au focus clavier du carrousel ;
  - bouton grille **dans** la pilule d'onglets, après un séparateur.
- **7. Cartes sans affiche** :
  - face = celle de l'éventail : A→B du thème, mélange tiré par app (`faceMixOf`, même tirage que `--k`), 0,85, retrait 3 px, ombre de pied, icône du cache sinon la lettre ;
  - styles de la face, de l'affiche, de l'icône et de la lettre sortis dans `AppCardFace.module.css` (`AppCard.module.css` : 392 → 322 lignes) ;
  - **filets** : cœur blanc à 55 %, largeur 2,2, intensité 1,8, halo 0,9, longueur 0,2 (éventail compris) ;
  - **bug corrigé** : la tête A des filets prenait la couleur B dans le carrousel (`--k` du slot) ;
  - nouvelle paire de contraste « plaque de nom sur une face », testée sur les 11 thèmes.

**Testé** :
- tsc, eslint, prettier, clippy, **vitest 630/630**, **cargo test 195**.
- Volet du navigateur, à l'arrêt :
  - accueil Lavande-pêche et Encre (faces A→B, barre, pilule avec la grille, dock sans micro, crayon caché, bokeh) ;
  - menu « mode » (aligné à droite, Immersif coché, Échap ferme) ;
  - widget Bleu-gris déplié ;
  - éditeur (titres en Manrope, badges en pilule, étapes en 26).
- Exe reconstruit.

**Non testé / limites** :
- Le rendu en mouvement (filets plus visibles, bokeh qui respire) : le volet ne dessine pas les animations.
- Les apps de Steam / Epic n'ont pas d'icône : elles gardent la lettre (« icônes dans le carrousel » : plus tard).
- La carte vide reste en 150 × 180 (hors liste).
- **Mesures** : à l'étape 13 (aucun coût par image attendu : un sprite, du CSS).

**Ton retour (paquet 2, capture)** : deux défauts.
- **Les filets du carrousel étaient dessinés à l'intérieur de la carte active.**
  - Cause : depuis la boîte de flottaison du paquet 1, la couche des filets n'est plus un enfant direct de l'emplacement. La règle `[data-active] > .layer` ne s'appliquait plus, donc la couche gardait l'échelle des cartes latérales (×0,74).
  - Correctif : la règle devient `[data-active] .layer` (`Rim.module.css`).
  - Le test du voile périodique, qui regardait le parent de la carte, cherche maintenant son emplacement (`closest("[data-app-id]")`).
- **À-coup de la flottaison quand on ouvre une catégorie.**
  - Cause : pendant la liaison, la flottaison du carrousel est coupée net (les cartes sont posées par la séquence), puis elle repartait en ~240 ms.
  - Correctif : elle s'arrête toujours vite (240 ms) mais repart lentement, en ~1,2 s (`FLOAT_RHYTHM.resumeMs`), au retour d'une pause comme d'un survol. Testé.

**Correctifs validés dans l'exe.** Puis :
- **Le carrousel descend de 22 px** (`--stage-drop` dans `tokens.css`).
  - Mesuré à 1707 × 960 sur le titre de 96 px : avant, la carte active soulevée au survol (10 px, ×1,03, valeurs inchangées) chevauchait de 8,6 px le jambage du « g » de « Logiciels » (27 px sous la ligne de base). Il reste maintenant **14,3 px** d'air (« Logiciels ») et 17,3 px (« Jeux »).
  - L'éventail descend avec lui : la liaison place les deux autour du même centre (409,9 px, vérifié), sa chronologie est intacte.
- **Régression de la boîte de flottaison corrigée** : l'anneau de focus clavier de la carte choisie (`[data-active] > button`, carrousel et grille) ne s'appliquait plus ; il vise maintenant la carte elle-même.

**Commit** : `4876751`, tag `da-r5-2`.

### Paquet 3 — Écrans et finitions des signatures (2026-10-13)
**Fait** :
- **4. Scènes et éditeur dans le langage de l'accueil** :
  - **Barre partagée** (`home/TopBarShell.tsx`) : même verre, même hauteur (58 px), même logo et mêmes marges (24 / 56) partout.
    - Accueil : inchangé (passe par la coquille).
    - Scènes : « ‹ Accueil », une recherche qui filtre les scènes, Importer, Nouvelle scène.
    - Éditeur : « ‹ Scènes », Simple / Avancé, Tester, Enregistrer.
  - **Colonne de 1 280 px centrée**, qui défile sous la barre (`scenes/Screens.module.css`).
  - **Titre-signature** (`ScreenTitle.tsx`) : eyebrow, serif de 48 px, filet A→B. Écran Scènes : « SCÈNES / Tes scènes ». Éditeur : « SCÈNE » + le nom de la scène, modifiable sur place, avec le raccourci dessous.
  - **Scènes en cartes** (`SceneCard.tsx`) :
    - 176 × 246, rayon de carte × 176/240, verre du moteur (CSS en repli) ;
    - face A→B tirée par scène ; icône ou lettre de la première app ; plaque nom + « N étapes » ;
    - raccourci en haut à droite ;
    - ▶ ✎ exporter supprimer au survol et au focus (toujours visibles pendant que la scène tourne) ;
    - un clic sur la carte ouvre l'éditeur ; grille centrée.
  - Étapes : la poignée est **à gauche** du numéro ; le fil de la chaîne est recalé (centre du point à 67 px, vérifié au pixel : 276,5 = 276,5).
  - **Retour de Scènes** : le carrousel quitté (catégorie, carte, vue mémorisées : `homeState.ts`), jamais l'éventail une seconde fois.
  - Le CSS de l'ancienne liste et de l'ancien en-tête est retiré d'`Editor.module.css` (243 → 117 lignes), ce qui supprime aussi le bug `stepSub` sans style.
  - Au passage : l'exemple de chemin de l'import (`C:UsersmoiDownloads…`) avait perdu ses barres obliques inverses avant la ronde ; rétabli.
- **8. Finitions** (chronologies inchangées) :
  - **Lettres** : `z-index` décroissant (K au-dessus, o dessous) et `clip-path: inset(-48px -48px -48px -30px)` fixe sur `.letters`. Rien d'une lettre ne se voit à gauche du bord du logo, elles en sortent vraiment. Vu figé à 2 350 ms.
  - **Étiquettes de l'éventail** : les cartes à droite du centre ont leur face en miroir (texte à droite, lumière du dégradé en haut à droite). « Logiciels » et « Autre » ne passent plus sous la carte de devant, et l'éventail est symétrique.
  - **Titres de la liaison** (`fanTimeline.ts`) : le titre qui part sort d'abord (0,7 × court = 168 ms, courbe de sortie, −20 / +14 px), celui qui arrive entre à +120 ms (moyen 360 ms, apparition). Jamais tous deux à moitié visibles, dans les deux sens (testé).
  - **Premier flash** :
    - **Non vérifié en rafale** : tu jouais (Roblox), je n'ai pas lancé l'exe.
    - Lecture du code : rien ne rend la page translucide au lancement. En revanche, la fenêtre immersive n'avait pas `DWMWA_TRANSITIONS_FORCEDISABLED`, donc Windows la montrait avec son propre fondu (~200 ms), ce qui laisse voir l'écran d'avant derrière un voile sombre. C'est le constat de Fable.
    - Correctifs : ce fondu système est coupé pour la fenêtre immersive (`own_window::set_show_animation`, gardé pour une fenêtre normale) ; un seul sombre de l'image 0 à l'ouverture (fenêtre native `#06060C`, `html` / `body` en `--bg-bottom`, la couleur dont l'ouverture fond).

**Testé** :
- tsc, eslint, prettier, clippy, `cargo fmt` (3 écarts connus seulement), **vitest 632/632**, **cargo test 195**.
- Volet du navigateur (1707 × 960) : écran Scènes (cartes, survol), éditeur (titre, poignée, chaîne), éventail (miroir), ouverture figée.
- Exe reconstruit (priorité basse, non lancé).

**Non testé** : le premier flash en rafale ; l'onde, les lettres et les titres en mouvement (le volet ne joue pas les animations) ; le retour de Scènes dans l'exe.

**Ton retour (paquet 3)** : validé dans l'exe (lancement, lettres, titres de la liaison, éventail, scènes). Commit `feat: DA ronde 5 paquet 3 — …`, tag `da-r5-3`, sans fusion dans `main`.

### Fin de la ronde 5 (2026-10-13)
Les trois paquets ont été validés dans l'exe de production et commités sur `step-12b-atelier-da`, sans fusion dans `main`.

| Paquet | Tag | Commit |
|---|---|---|
| 1. Réglages, thèmes, personnalisation | `da-r5-1` | `bc8a7a3` |
| 2. Cohérence visuelle | `da-r5-2` | `4876751` |
| 3. Écrans et finitions | `da-r5-3` | (celui-ci) |

Les choix protégés sont inchangés par défaut (ouverture V1-A + pulsation C, liaison A, langage Vivant, widget déroulé, passages en fondu, voile natif). Ils sont devenus réglables dans « Personnalisation avancée ».

**Points ouverts pour l'étape 13** (mesures en exe de production, PC libre, Élevée et Éco) :
- **Flottaison**, éventail et carrousel au repos, particules oui / non : les boucles passent à 30 i/s, mais le moteur reste à 60 i/s tant que braises et étoiles sont animées.
- **Coût de l'onde de changement de thème** : une image lente attendue à la capture, puis +0,5 à 1 ms par image.
- **Image blanche** au premier changement de thème : à reproduire avec le protocole du paquet 1 ; hypothèse principale, un artefact de la capture CDP.
- **Premier flash au lancement** : validé à l'œil ; rafale de captures toutes les 30 ms à faire pour confirmer.
- **Repris des rondes précédentes** : le coût de la pulsation C (voile moteur contre CSS) et les mesures de la 4a.

**Pour la suite** : le gel de la DA, quand tu le décides (« je fige la DA »). Il faudra alors écrire `docs/DESIGN.md` (DA officielle v1, qui primera sur `reference/`) et retirer ce qui reste en essai (5 anciens thèmes, éléments « historique » et « croquis » du catalogue, verre des barres / dock / boutons s'ils ne sont pas retenus).

### Plus tard (hors ronde 5, à ne pas faire dans cette ronde)
> Repris dans `docs/ROADMAP.md` § « Plus tard (liste unique) » au gel de la DA (2026-10-14) : c'est là qu'on le suit.
- Gestion des apps qui démarrent avec Windows au premier lancement.
- Design propre à chaque carte de catégorie.
- Affiches en production.
- Icônes dans le carrousel (extraction pour Steam, UWP, palette).
- Fil lumineux pendant la détection.
- Échap dans l'éditeur.
- « Créer mon thème » et import / export de thèmes.
- Hors liste des propositions, non faits : petit texte secondaire unifié (`--fs-13`), carte vide 176 × 246, éventail descendu de 60 px, ligne d'aide « Entrée · Échap ».

## Correctifs avant le gel — relecture finale de Fable (2026-10-13)
Liste de travail : `docs/RELECTURE-FINALE-DA.md` (A1–A11 à corriger, B1–B8 dosages) + A12 (`--quit`). Deux paquets, arrêt après chacun.

### Paquet A — corrections (2026-10-13)
**Fait** :
- **A1 Déroulé hors champ** : à l'ouverture, le corps des réglages défile (en douceur ; d'un coup avec « réduire les animations ») juste assez pour montrer « Revenir aux réglages par défaut », **sans jamais faire sortir l'en-tête** (ton choix) : calcul pur `revealScroll()` (`advancedUnroll.ts`), jetons `ADVANCED_UNROLL.revealPad` (24) / `revealTop` (8). Mesuré (volet, page de dev, 1707×960) : en-tête 741 → 207 px (8 px sous le haut du corps), défilement de 534 px ; « Revenir… » reste 191 px sous le bord (avec les ~1,5 dernières lignes), comme choisi.
- **A2 Impact rogné** : `.scroll { overflow-x: hidden }` ; onglet Thèmes sans conteneur qui coupe (`data-tab`, `@media (min-height: 600px) and (min-width: 1100px)`, sinon il garde le défilement). Écart à la relecture : `Dialog.module.css` coupait aussi (`.settings .body { overflow: hidden }`) → `visible` pour le seul dialogue Réglages. Les étincelles de la colonne de droite et du haut peuvent dépasser un peu du panneau (≤ 27 px, en fondu).
- **A3 Crayon** : `hoverCardOf()` (`carouselFloat.ts`) vise l'emplacement `[data-app-id]` puis sa carte : le crayon compte comme la carte (filets gardés, flottaison en pause).
- **A4a** : `Carousel` reçoit `floating={!onFan}` → `carouselFloatConfig(…, active)` met l'amplitude à 0 sous l'éventail (boucle arrêtée, reprise lente au retour). **A4b** : `busy()` de l'éventail ne compte plus `floatHover` au repos : à « Aucune », plus de boucle tant que rien n'est survolé.
- **A5 « Net »** : drapeau `crisp` dans `openSteps` (coque, chevron, lignes sur `vive`), `themeSwap.easing(name, crisp)` (liaison / rebond / ressort → `vive`, coche sans pic, recul sur `vive`), `hoverConfig(…, crisp)` (ressort, éclat, filets, étincelles coupés ; soulèvement, inclinaison, flottaison gardés), `linkConfig(…, crisp)` (deck sur `vive`, ne dépasse plus sa place). Aide : « … Net : sans rebond ni effet dans le hub ; le widget suit ses propres réglages. »
- **A6** : « Affichage au lancement » → **« Mode d'affichage »**, aide « Change tout de suite ; c'est aussi le mode au prochain lancement. … » (texte seul).
- **A7** : `data-hover-off` sur la grille des scènes, `.card:hover:not([data-hover-off] *)`.
- **A8** : `::view-transition { background: var(--bg-bottom) }` (`themeSwap.css`). Limite : couvre une image de l'ancienne vue **manquante** (transparente), pas une image capturée blanche.
- **A9** : l'annulation est oubliée dès qu'un réglage Visuel quitte le défaut (état dérivé pendant le rendu ; la remise à zéro est optimiste, donc appliquée dans le même rendu).
- **A10** : mécanisme prêt (`will-change` sur les boîtes de flottaison pendant que la boucle tourne, retiré à l'arrêt), **désactivé** par le jeton `FLOAT_RHYTHM.promote: false` : pas de mesure possible ici (tu jouais), et la règle veut une mesure. L'éventail garde ses `will-change` (ses cartes bougent aussi pendant la liaison).
- **A11** : `floatRest` / `floatPeriod` retirés d'`actif.json` ; `settings.themes.label` / `.active` retirés ; info-bulle native retirée de `ThemeCard` ; `rx="26"` ; `isEco(q)` (`design/quality.ts`, via `effectiveQuality`) remplace les 10 tests `quality === "eco"` des écrans : un seul endroit à changer quand « Auto » saura redescendre en Éco (étape 13).
- **A12 `--quit`** :
  - **Cause** : `app.exit(0)` ne quitte pas, il dépose une demande dans la file de la boucle d'événements (tao), lue seulement par la boucle principale quand elle est libre. Un fil principal retenu dans une boucle de messages imbriquée ne la lit jamais : le 13/10, deux « asked to quit » et `procwatch` journalisait encore 2 et 5 min après. Le journal ne permettait pas de voir où (aucune ligne après la demande, même quand la fermeture marche).
  - **Journal** : « quit: asking the event loop to end », « exit requested: the event loop ends », « exit: the event loop ended » ; la garde du journal est rangée (`logging.rs`) et vidée juste avant la sortie (avant, les dernières lignes pouvaient se perdre).
  - **Filet** (`desktop/quit.rs`, validé) : un fil attend 3 s ; si le processus vit encore → « quit: the event loop did not end, leaving directly », puis `cleanup_before_exit()` (icône retirée) et `std::process::exit(0)`, le repli que Tauri utilise déjà quand sa demande échoue. Rien n'est tué de l'extérieur ; les scripts gardent leur attente de 10 s.
  - **Aucun fichier coupé** (ta précision) : toutes les écritures passent par `write_atomic` (réglages, apps, scènes, état d'interface, icônes, partages). Verrou `WRITES` (`config/atomic.rs`) : avant toute sortie (boucle ou filet), la porte se ferme, les écritures déjà commencées finissent (2 s au plus), une écriture demandée après ne commence pas (le fichier garde son contenu, personne n'attend pour toujours), puis le journal est vidé. Une seule des deux sorties agit (`LEAVING`).
- **Hors liste** : `src/ipc/bindings.ts` avait été réécrit à 15:55 par l'ancien exe de débogage (`target/debug/Kayro.exe` du 12/10, d'avant la ronde 5) : types R5 perdus, `tsc` et donc la compilation de l'exe échouaient. Remis à la version commitée (identique à ce qu'exporte le Rust actuel) ; copie de l'ancien gardée hors du dépôt. **Après ton test** : `target\debug\Kayro.exe` (12/10) et `target\debug\hub.exe` (10/10, même écriture), avec leurs copies liées dans `deps\`, supprimés ; aucun raccourci (Bureau, menu Démarrer, Démarrage) ni démarrage automatique ne vise un exe de débogage ; l'export automatique des liaisons au démarrage d'un exe de débogage est retiré (`lib.rs`) : seul `npm run gen:types` écrit `bindings.ts`, et le test `committed_bindings_match_the_rust_types` échoue s'il n'est plus à jour.

**Protocole de l'image blanche (A8, étape 13)** : exe relancé, PC libre, thème connu. (1) Réglages › Thèmes, attendre 0,9 s, cliquer une carte : premier changement de la session. Une fois avec une rafale d'écran Windows seule (aucune capture CDP), une fois avec une capture CDP lancée à 330–400 ms. Recommencer en relançant l'exe à chaque fois (c'est le premier changement qui compte). (2) Preuve du filet : pendant un changement, masquer `::view-transition-old(root)` par une feuille injectée (CDP) et capturer vers 500 ms : hors du cercle, la nuit (`--bg-bottom`), pas du blanc. Si l'image blanche ne vient qu'avec la capture CDP : point clos.

**Testé** :
- tsc, eslint, prettier (mes fichiers), clippy, `cargo fmt` (3 écarts connus seulement), **vitest 641/641** (+ défilement A1, « Net » sur le déroulé / la carte de thème / l'éventail / le deck, crayon A3, flottaison sous l'éventail A4a, « Aucune » A4b, couches A10), **cargo test 198** (+ porte des écritures : une écriture lente retarde la fermeture puis aucune autre ne commence ; limite atteinte ; une seule sortie).
- Exe reconstruit (114 s, priorité basse, non lancé).
- Volet du navigateur (page de dev, 1707×960) : A1 (ci-dessus) ; A2 : onglet Thèmes `overflow: visible`, corps du dialogue `visible`, pendant l'impact d'une carte de la colonne de droite la hauteur visible reste à 616 px (avant : 610, la barre horizontale).

**Non testé** (tu jouais à Roblox : aucun lancement de l'exe) :
- **A12 en vrai** : `--quit` sur une instance normale, une instance en débogage avec CDP attaché, deux `--quit` de suite ; cause exacte du blocage du 13/10 non reproduite. Le filet et la porte des écritures sont testés en unitaire seulement.
- **A8** : protocole ci-dessus à faire (étape 13 ou PC libre) ; le filet n'est pas encore prouvé dans l'exe.
- **A10** : mesure p95 avec / sans couches → étape 13 (jeton `FLOAT_RHYTHM.promote`).
- A3, A4, A5, A7, A9 : vus seulement par les tests (A9 ne se teste pas dans le volet : sans le cœur, les réglages reviennent en arrière).
- **Mesures de performance** : aucune (étape 13).

**Ton retour (paquet A)** : validé dans l'exe. Commit `577feea`, tag `da-r5-fix-a` (avec `docs/RELECTURE-FINALE-DA.md`), sans fusion dans `main`.

### Paquet B — dosages (2026-10-13)
Huit affinages par les jetons, aucune signature validée changée. **Pour revenir sur un dosage, remettre la valeur « avant » à l'endroit indiqué** (un seul endroit chaque fois, sauf mention).

| N° | Où (jeton) | Avant | Après |
|---|---|---|---|
| B1 | `THEME_SWAP.wave.haloPx` (`tokens5.ts`) ; `waveBandFrames()` (`themeSwap.ts`), `@property --wave-band` (`themeSwap.css`) | halo de l'onde = 5,5 % du rayon (`OPENING_C.waveBand`, ≈ 55–70 px près des coins) | halo fixe de **40 px** à l'écran (bande = min(0,2 ; 40 / (200 × échelle)), 5 images-clés sur la courbe de l'onde). Revenir : retirer l'animation `band` dans `useThemeSwap.ts` (le `makeWave` reprend `OPENING_C.waveBand`) |
| B2 | `THEME_SWAP.shock` | halo 40, alpha 0,85 | halo **28**, alpha **0,7** |
| B3a | `FLOAT_RHYTHM.activeGain` | carte active du carrousel × 1 (5 px à « Visible ») | × **0,7** (3,5 px ; 5,6 à « Marquée », 1,4 à « Légère ») |
| B3b | catalogue `categoryHover.floatHoverGain` (remplace `floatHover`, px) ; `actif.json` | survol de l'éventail : max(repos, 6 px) → mort dès « Visible » ; 6 px même à « Aucune » | repos × **1,15** (8 px, 13,8, 2,9 ; 0 à « Aucune ») |
| B3c | `FLOAT_RHYTHM.fanHoverDrift` | dérive latérale au survol 3,96 px (0,66 × 6), à tous les niveaux | **4 px**, **0 à « Aucune »** |
| B4 | `ADVANCED_UNROLL.rowAt` / `rowStep` / `haloAlpha` | 50 / 45 ms (9 lignes : la dernière posée à 930 ms, 250 ms après la coque) ; halo 0,22 | **40 / 32 ms** (posée à 816 ms) ; halo **0,3** (l'opacité au repos lit maintenant le jeton ; la fermeture part de lui au lieu de 1) |
| B5 | `--face-foot` (`tokens.css`), lu par `AppCardFace`, `SceneCard`, `CategoryFan` | bout sombre des faces × 0,2 | × **0,28** |
| B6 | `.actions` de `SceneCard.module.css` (`--action-size`, `--action-gap`, `bottom`, `--action-rise`) | 34 px, écart 6, bas 74, fondu sec | **30 px**, écart **8** (16 px de marge sur 176), bas **80**, montée de **4 px** avec le fondu (`--m1-court`, coupée par « réduire les animations ») |
| B7 | `BOKEH_SPRITE` (`bgShader.ts`) | disque 0,55 / anneau 0,45 | disque **0,7** / anneau **0,3** ; intensité 0,09 inchangée |
| B8 | `.screen` de `Screens.module.css` | `gap: var(--space-4)` (16 px) | **0** |

**Au passage** :
- **B5, contraste** : le modèle de la relecture ne tenait plus. Avec 0,28, la teinte sous les noms remonte (0,30 → 0,37 sous la plaque des apps, 0,37 → 0,43 sous les noms de l'éventail), au-dessus du modèle, qui n'était plus pessimiste. Le modèle est maintenant dérivé du jeton (`contrast.ts` : `faceFoot`, position des noms dans le dégradé), et un test vérifie `--face-foot` = modèle. Pire ratio « face » sur les 11 thèmes : **7,10** (texte secondaire sur une carte de l'éventail, Graphite), pour 4,5 exigé.
- **B3b** : `floatHover` retiré du catalogue et d'`actif.json` (libellé de l'atelier « Flottaison au survol (×) »).

**Testé** :
- tsc, eslint, prettier (mes fichiers), **vitest 645/645** (+ halo de 40 px, carte active × 0,7, survol × 1,15 et dérive, cascade posée à 816 ms, poids du bokeh, jeton `--face-foot` = modèle).
- Volet du navigateur (pages de dev, 1707×960) : **B8** « SCÈNES » à 90 px = « CATÉGORIE » de l'accueil (avant : 16 px plus bas, le `gap` retiré ; non remesuré) ; **B6** 4 boutons de 30 px, écart 8, marges 16 / 16, décalés de +4 px au repos ; **B5** bout sombre calculé = 0,28 × la couleur.
- Exe reconstruit (priorité basse, non lancé : Roblox ouvert).

**Non testé** : tous les dosages en mouvement (onde, impact, flottaison, cascade, bokeh) ; aucune mesure de performance (étape 13 ; aucun coût par image attendu : des valeurs, un sprite, une propriété animée pendant l'onde).

**Ton retour (paquet B)** : validé dans l'exe, **les 8 dosages gardés**. Commit `feat: DA relecture finale paquet B — …`, tag `da-r5-fix-b`, sans fusion dans `main`.

### Fin des correctifs avant le gel (2026-10-13)
| Paquet | Tag | Commit |
|---|---|---|
| A. Corrections (A1–A12) | `da-r5-fix-a` | `577feea` |
| B. Dosages (B1–B8) | `da-r5-fix-b` | (celui-ci) |

**Restent pour l'étape 13** (exe de production, PC libre) : `--quit` en vrai (instance normale, instance en débogage avec CDP, deux demandes de suite) ; protocole de l'image blanche (A8, ci-dessus) ; mesure p95 avec et sans couches pour la flottaison du carrousel (A10, jeton `FLOAT_RHYTHM.promote`) ; coût de l'onde à halo fixe ; points ouverts de la ronde 5.

**Pour la suite** : le gel de la DA quand tu le décides (« je fige la DA ») : `docs/DESIGN.md` (DA officielle v1) et retrait de ce qui reste en essai.

## Étape 13 — séance de mesures en production (2026-10-13, avant le gel)
Rapport complet : **`docs/PERF-ETAPE13.md`**.

**Conditions** :
- Exe de production = HEAD `8c31414`, 2560×1440 à 280 Hz, Élevée et Éco, 2 ou 3 essais par case.
- Dossier de données de test (15 apps ; tes réglages copiés) ; tes fichiers jamais ouverts, empreintes identiques.
- Comet et Steam fermés avec ton accord.
- Modrinth s'est ouvert à 21:18 : les mesures touchées ont été refaites. Wallpaper Engine (~20 % du GPU, bureau visible) est noté.
- Aucun code modifié ; 230 captures supprimées.

**Cases fermées** (toutes celles du journal ; tableau dans le rapport) :
- Mesures 4a : repos, survol continu ou qui change, onglets, panneau, interrupteur.
- Repos fenêtre, widget et hub masqué ; GPU de dwm.
- Pendant un passage ; widget qui se déplie.
- Éditeur : réordonner ; catégorie vide.
- Coût par image de la pulsation C ; coût de l'onde à halo fixe.
- Flottaison avec et sans particules ; A10 ; `--quit` en vrai ; premier flash ; image blanche.

**Résultats clés** :
- Budget p95 ≤ 5,4 ms tenu partout **sauf l'onde en Éco** (« Fondu » : p95 7,2–10,7 ms, 30–36 images > 8 ms par changement, pic de 2,1 Go).
- Trop d'images > 8 ms (tolérance 1 par signature) en Élevée : liaison (3–4), retour (2–3), onde (5–9), onglets (4–10). Passages : 3–6 dans les deux qualités.
- Pulsation C : 0 image > 8 ms (7 lancements sur 7).
- Survol continu du carrousel en Élevée : 12,3 % de CPU, 15,9 % de GPU (le plus cher).
- Repos visible : 1,2–4,2 % de CPU (cible < 1 % non tenue). Hub masqué : 0,05 % de CPU, 0 % de GPU. Widget : 0,03 % / 0.
- A10 (`will-change`) : aucun gain → garder `promote: false`.
- Particules coupées : aucun gain (le moteur garde sa cadence d'ambiance).
- Carrousel, flottaison Visible contre Aucune : +1,2 pt de CPU et +2,6 pt de GPU en Élevée.
- `--quit` : 11 fermetures sur 11, en 38–53 ms par la boucle, filet jamais utilisé. Deux `--quit` simultanés : OK.
- Flash au lancement : aucun.
- Image blanche : non reproduite (4 premiers changements, dont 2 avec capture CDP). **Constat** : une capture CDP fausse l'image affichée à l'écran pendant 70–150 ms. Le point peut être clos selon la règle du protocole (ta décision).
- Preuve du filet A8 : **non faite** (masquer `::view-transition-old(root)` par une feuille injectée n'a rien changé à l'écran).

**En attente de ta décision** :
- Corrections proposées, classées par gain (rapport) :
  1. Fondu de thème en Éco ;
  2. plafonds de cadence du moteur ;
  3. onde en Élevée ;
  4. liaison et onglets ;
  5. survol qui change ;
  6. passages ;
  7. retrait d'A10 ;
  8. banc dans `scripts/perf/`.
- Proposition « Auto » adaptative (rapport).
- Clore l'image blanche ?
- Particules à moitié en Éco / Équilibré : rien ne justifie de les couper pour la perf (question de la ronde 1).

**Piste pour l'étape 14 (couleurs du jeu), trouvée au paquet 3 des corrections (14/10)** :
- **Ce qu'on a appris** : appliquer un thème coûtait **deux** recalculs complets du style (~6 ms chacun dans une page calme, ~20 ms dans la trace). Deux causes :
  - `applyTheme` coupait la transition de `:root`, forçait une lecture, puis la remettait ;
  - le moteur relisait les couleurs par `getComputedStyle`.
- **Corrigé, sans changer le rendu** :
  - la transition des couleurs n'est déclarée que pendant un vrai fondu de variables (`:root[data-theme-fade]`) ;
  - le moteur prend ses couleurs de fond dans la palette (`FxPalette.bg`).
  - Résultat : un seul recalcul, ~10–12 ms dans la trace au lieu de ~20.
- **Ce qui reste** : à l'impact de l'onde ou du fondu, 1 à 2 images de 15 à 25 ms, dues à la capture de la page par la View Transition. Acceptées pour cette signature : elles sont cachées sous la capture figée.
- **Règles pour les ambiances par jeu** (palette au changement de jeu, peut-être fréquent) :
  - changer les variables d'un seul coup, sans transition déclarée en permanence, et sans lecture forcée (`getComputedStyle`, `offsetHeight`) après l'écriture ;
  - donner les couleurs au moteur par la palette ;
  - éviter une View Transition à chaque changement de jeu : une capture plein écran coûte 1 à 2 images lentes ;
  - mesurer avec `npm run perf -- --trace … --invalidations`.

**Paquet 4 des corrections (14/10) : liaison, retour, onglets, passages.** Chiffres acceptés pour l'étape 13 : à l'œil, tout est fluide.
- **Fait, sans changer le rendu** :
  - plus aucun `getAnimations()` dans un clic : le titre, le reflet et le voile annulent leur propre animation ;
  - icônes déjà chargées rendues tout de suite ;
  - `matchMedia` gardé, au lieu d'être recréé à chaque appel ;
  - pas de seconde lecture de la scène au début d'une séquence ;
  - pastille des onglets qui n'écrit que des styles pendant son animation ;
  - éventail gardé monté et caché (`display: none`, aucune boucle) après la liaison ;
  - passages : retour de la page après 2 images sans redimensionnement, noir à 0,004 au lieu de 0, calque de la page gardé le temps du passage.
- **Restent** : 1 à 3 images > 8 ms par liaison, retour ou onglet, jusqu'à 14–21 ms, et 1 à 4 images lentes visibles au début du fondu d'entrée pour 3 passages.
  - Le gros du coût est la tâche du clic : environ 9 à 14 ms au profil CPU, surtout le recalcul et la mise en page de ce que React vient de changer.
  - En face de cette tâche, le traçage CDP gonfle les temps d'environ ×3 : prendre les profils CPU (`Profiler`) pour les ordres de grandeur.
- **Écartés** :
  - un calque de filets par emplacement : plus aucune image > 8 ms au survol qui change depuis le paquet 2, et ce calque alourdirait les changements de thème ;
  - les tampons du moteur à la taille de l'écran : le flou lit les mips de toute la texture, donc le rendu changerait.

**Piste pour l'étape 14 : liaison, retour, onglets.** Deux chemins s'opposent ; à trancher en mesurant les deux, avec les ambiances par jeu :
- **éventail prêt à 0 % d'opacité** plutôt qu'en `display: none` : le clic n'aurait plus à recalculer ni à disposer l'éventail. En revanche, chaque changement de thème (ou d'ambiance de jeu) recalculerait aussi ses ~150 éléments ;
- **ou alléger le recalcul au changement de thème ou de catégorie** : moins d'éléments touchés, moins de variables héritées, moins de travail React par onglet.

**Remesure de fin (14/10, exe de 18:08)** : détail dans `docs/PERF-ETAPE13.md`, section « Après corrections ».
- **Résultats** :
  - budget p95 ≤ 5,4 ms tenu partout ; le Fondu en Éco passe de 10,7 à 3,7 ms ;
  - liaison, retour, onglets : 1 à 2 images > 8 ms par occurrence en Élevée, 1 en Éco, aucune > 16 ms ;
  - onde : 2 à 6 en Élevée, 2 en Éco (34 avant) ;
  - repos : CPU de 1,5 à 3,3 %.
- **Points clos** :
  - image blanche (le filet `--bg-bottom` est gardé ; à rouvrir si elle se revoit) ;
  - `--quit` (P1) et flash (P3) ;
  - A10, retiré.
- **Reporté** : la qualité « Auto », avant l'étape 19 (ROADMAP).

**Point ouvert pour l'audit de l'étape 18** : le CPU au repos du carrousel est de 3,6 à 4,2 % en Élevée avec la flottaison « Visible » (R2), contre 1,4 % sans flottaison (R3). La cible CLAUDE.md est < 1 %.

## Éléments du catalogue
État au gel (2026-10-14). « Retenu » = dans la DA livrée (défauts du catalogue) ; « retiré » = encore au tag `perf-13-fix`.

| Élément | État au gel | Remarque |
|---|---|---|
| Fond radial + vignette + grain, halo de lune, deux voiles | retenu | moteur ; repli CSS (`MoonLayer`) |
| Anneau cristal (CSS) | retenu comme repli et géométrie | `crystalRing` |
| Anneau liquide | retenu | `liquidRing` |
| Anneau en tube (`glassRing`) | retiré | — |
| Moteur de verre liquide : cartes, pastilles de sélection | retenu | `glassEngine`, `glassCards`, `glassPills` |
| Verre : barres, dock, boutons ronds | gardé, éteint | porte l'imbrication de la pastille (ROADMAP, étape 18) |
| Bandes de lumière, bokeh, lumière du curseur, braises, étoiles | retenu | bokeh 7 × 120 px, disque 0,7 / anneau 0,3 |
| Brume, faisceau, lueur basse, halo sous la carte, poussière, bande de lumière (croquis) | retiré | — |
| Clarté du fond, largeur de la lueur de lune | retenu | — |
| Particules éclairées, matière et profondeur, voile brillant périodique | retiré | — |
| Affiches dans le verre (`posterGlass`) | gardé, éteint | étape 14 (art local) |
| Ouverture V1-A + pulsation C | retenu (signature) | « Classique » = V1-A, choix des Réglages |
| Jetons de mouvement, survol niveau 3, widget déroulé, chaîne de points, états | retenu | « Sobre » = choix des Réglages |
| Passages entre modes (fondu) + voile natif | retenu (signature) | — |
| Réglages Visuel → DA (`userDa.ts`), flottaison, onde de thème, 6 thèmes du logo | retenu | Bleu-gris par défaut ; 5 anciens thèmes retirés |

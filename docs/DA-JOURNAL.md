# Journal de l'atelier de DA (étape 12b)

Lu au début de chaque session de l'étape 12b. Permet de reprendre dans une conversation neuve sans rien perdre. Mis à jour à chaque tour.

## Preset courant
- Nom : **V4 Verre liquide** (défaut du catalogue = `src/design/da/active.json`, thème lavande-pêche) : moteur WebGL2 sur les cartes et les pastilles de sélection seulement, anneau liquide
- Fichiers : `src/design/presets/v4-verre-liquide.json` ; comparaison : `v4-verre-liquide-complet.json` (tout en verre, anneau en tube : état du premier essai 2a), `v4-cristal.json` (V4 de la ronde 1, CSS, moteur coupé), `croquis-12.json` (étapes 3 à 12), `v4-cristal-gpu.json` (anneau seul dans le moteur, comme le spike)
- Branche / tags : `step-12b-atelier-da` / `da-r1` (ronde 1 commitée). Ronde 2a : **non commitée**, en attente de ton test

## Mode d'emploi
- `npm run dev` puis `http://localhost:1420/dev/atelier` (navigateur) : réglages à gauche (générés depuis `src/design/da/catalogue.ts`), écrans réels à droite (Accueil, grille, ajout d'apps, scènes, éditeur, composants), 11 thèmes, qualité, comparaison A/B, Enregistrer / Charger / Historique, Exporter (→ `active.json` = DA de l'app), Mesurer (10 s).
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

## Éléments du catalogue
| Élément | État | Remarque |
|---|---|---|
| Fond radial + vignette + grain | à l'essai | V4 : radial, vignette 0,55 |
| Halo de lune | à l'essai | respiration 4 %, 9 s |
| Deux voiles | à l'essai | ±80 px, 30 / 36 s |
| Anneau cristal (CSS) | à l'essai | 680 px, bande 12, reflet 40 s, frost 5 px |
| Anneau cristal (GPU) | remplacé (2a) | devenu `glassRing` dans le moteur de verre |
| Moteur de verre liquide | à l'essai (2a) | défaut ; interrupteur = comparaison CSS |
| Verre : cartes, pastilles de sélection | à l'essai (2a) | activés par défaut |
| Verre : barres, dock, boutons ronds, anneau en tube | gardés, désactivés (2a) | à supprimer au gel si non retenus |
| Anneau liquide | à l'essai (2a) | remplace l'anneau en tube par défaut |
| Bandes de lumière, bokeh, lumière du curseur | à l'essai (2a) | moteur seulement |
| Braises / Étoiles | à l'essai | 20 / 24 |
| Cartes, survol, barres de verre, titre, typographies, mouvement | à l'essai | valeurs de la maquette V4 |
| Brume, faisceau, lueur basse, halo sous la carte, poussière, bande de lumière | croquis, désactivés | à supprimer au gel si non retenus |

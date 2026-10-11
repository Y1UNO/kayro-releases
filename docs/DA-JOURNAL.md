# Journal de l'atelier de DA (étape 12b)

Lu au début de chaque session de l'étape 12b. Permet de reprendre dans une conversation neuve sans rien perdre. Mis à jour à chaque tour.

## Preset courant
- Nom : **V4 Aéré lumineux** (`src/design/presets/v4-aere-lumineux.json`, thème Bleu-gris, ronde 2b) : base `v4-aere-bleu-gris` (2a) + fond aéré, particules éclairées, matière, voile brillant, affiches dans le verre, pastille « léger rebond ». `active.json` (défaut du catalogue) n'a pas été modifié : toujours V4 Verre liquide, lavande-pêche
- 2a : **V4 Verre liquide** : moteur WebGL2 sur les cartes et les pastilles de sélection seulement, anneau liquide
- Fichiers : `src/design/presets/v4-verre-liquide.json` ; comparaison : `v4-verre-liquide-complet.json` (tout en verre, anneau en tube : état du premier essai 2a), `v4-cristal.json` (V4 de la ronde 1, CSS, moteur coupé), `croquis-12.json` (étapes 3 à 12), `v4-cristal-gpu.json` (anneau seul dans le moteur, comme le spike)
- Branche / tags : `step-12b-atelier-da` / `da-r1`, `da-r2a` (2a commitée le 2026-10-11, avec `v4-aere-bleu-gris`). Ronde 2b : **non commitée**, en attente de ton test

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
| Clarté du fond, largeur de la lueur de lune | à l'essai (2b) | 0 = rendu 2a |
| Particules éclairées, matière et profondeur, voile brillant, affiches dans le verre | à l'essai (2b) | désactivés par défaut, activés dans `v4-aere-lumineux` |
| Ressort de la pastille (net / léger rebond) | à l'essai (2b) | défaut « net » |

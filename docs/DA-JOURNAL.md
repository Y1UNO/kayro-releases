# Journal de l'atelier de DA (étape 12b)

Lu au début de chaque session de l'étape 12b. Permet de reprendre dans une conversation neuve sans rien perdre. Mis à jour à chaque tour.

## Preset courant
- Nom : **V4 Aéré lumineux** (`src/design/presets/v4-aere-lumineux.json`, thème Bleu-gris, ronde 2b) : base `v4-aere-bleu-gris` (2a) + fond aéré, particules éclairées, matière, voile brillant, affiches dans le verre, pastille « léger rebond ». `active.json` (défaut du catalogue) n'a pas été modifié : toujours V4 Verre liquide, lavande-pêche
- 2a : **V4 Verre liquide** : moteur WebGL2 sur les cartes et les pastilles de sélection seulement, anneau liquide
- Fichiers : `src/design/presets/v4-verre-liquide.json` ; comparaison : `v4-verre-liquide-complet.json` (tout en verre, anneau en tube : état du premier essai 2a), `v4-cristal.json` (V4 de la ronde 1, CSS, moteur coupé), `croquis-12.json` (étapes 3 à 12), `v4-cristal-gpu.json` (anneau seul dans le moteur, comme le spike)
- Branche / tags : `step-12b-atelier-da` / `da-r1`, `da-r2a` (2a commitée le 2026-10-11, avec `v4-aere-bleu-gris`), ronde 2b commitée (`e497060`). Ronde 3a commitée (`7bb5f30`) ; préréglage `v4-r3-signature.json` = V4 Aéré lumineux + ouverture. Ronde 3b (A + B) : **non commitée** (tag prévu `da-r3b`)

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

## Ronde 4b — 2026-10-12 (widget, chaîne de points, états, passages de modes, ouverture transparente ; non commitée)
**Specs** (font foi) : `reference/animations/R4b-notes-4b/r4b-notes/R4b-3c-Widget.txt`, `R4b-3c-Editeur.txt`, `R4b-Etats.txt`, `R4b-Modes.txt`, `R4b-Ouverture-Transparente.txt` (+ R4a). Départ : tag `da-r4a`. Plan validé (copie : `C:\Users\tomca\.claude\plans\contexte-projet-kayro-bubbly-wigderson.md`).
**Découpage et arrêts** :
- 4b-1a : widget qui se déroule. **Arrêt.**
- 4b-1b : chaîne de points, états, nouvelle scène. **Arrêt.**
- 4b-2 : passages entre modes. Spike 4b-2.0 d'abord, avec **mesure obligatoire** (PC libre, jeux fermés) de l'immersif au repos, transparent contre opaque. Rapport, puis **arrêt**.
- 4b-3 : ouverture transparente C. Plan à reconfirmer avant de coder.

Pas de commit sans ta demande. Tag prévu : `da-r4b-1`, puis `-2`, `-3`. Exclusions : `reference/`, `src/design/presets/history/`, `SceneDock.module.css` (fins de ligne seulement).
**Tes décisions** :
- Les voiles 42 / 16 % n'existent **que pendant un passage**. À l'arrivée, rien ne change : immersif = fond opaque, fenêtre = vraie fenêtre Windows.
- Démarrage silencieux = **pas d'ouverture**. Aujourd'hui, l'ouverture joue au premier affichage : `opening_due` sera corrigé en 4b-3.
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

### Reste à faire
- **4a** : commit après ton feu vert, puis tag `da-r4a`. Mesures : voir ci-dessus (vérification globale).
- **4b** : voir la ronde 4b ci-dessus (4b-1a fait, arrêt ; ensuite 4b-1b, 4b-2, 4b-3). Ancienne note 3c, remplacée par R4b : éditeur « chaîne de points » (fil vertical A→B, point qui apparaît 0,6→1 en 250 ms, segment qui se trace en `scaleY` 300 ms, suivants qui glissent en ressort « net », perle lumineuse qui descend pendant l'exécution d'une scène ; DOM seul) ; dépliage du widget (fenêtre à sa taille finale tout de suite, contenu 0,94→1 + fondu 240 ms, lignes en cascade 30 ms, repli 180 ms ; CSS seul).
- Remesurer l'ouverture (CPU/GPU, repli CSS) PC libre.

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
| Ouverture V1-A (`opening`) | à l'essai (3a) | activée par défaut ; `ringGrow` désactivé |
| Jetons de mouvement (`motion`) | à l'essai (4a) | table unique, niveaux 1 / 2 / 3, vitesse ; remplace l'ancien `motion` |
| Survol niveau 3 du carrousel (`cardHover`) | à l'essai (4a) | voile + filets après 120 ms, 4 étincelles, éclat au lancement ; reflet souris coupé (`pointerSheen`) |
| Widget qui se déroule (`motion.widget*`) | à l'essai (4b-1a) | ressorts `linear()` normale 5 % / 2,5 %, halo allumé tant que déplié, reflet une fois ; « sobre » pour comparer |

# Journal de l'atelier de DA (étape 12b)

Lu au début de chaque session de l'étape 12b. Permet de reprendre dans une conversation neuve sans rien perdre. Mis à jour à chaque tour.

## Preset courant
- Nom : **V4 Cristal** (défaut du catalogue = `src/design/da/active.json`, thème lavande-pêche)
- Fichiers : `src/design/presets/v4-cristal.json` ; comparaison : `croquis-12.json` (l'état des étapes 3 à 12), `v4-cristal-gpu.json` (V4 + anneau WebGL)
- Branche / tag : `step-12b-atelier-da` / `da-r1` (pas encore commité ni tagué : en attente de ta validation)

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

## Éléments du catalogue
| Élément | État | Remarque |
|---|---|---|
| Fond radial + vignette + grain | à l'essai | V4 : radial, vignette 0,55 |
| Halo de lune | à l'essai | respiration 4 %, 9 s |
| Deux voiles | à l'essai | ±80 px, 30 / 36 s |
| Anneau cristal (CSS) | à l'essai | 680 px, bande 12, reflet 40 s, frost 5 px |
| Anneau cristal (GPU) | à l'essai (spike) | désactivé par défaut ; preset `v4-cristal-gpu` |
| Braises / Étoiles | à l'essai | 20 / 24 |
| Cartes, survol, barres de verre, titre, typographies, mouvement | à l'essai | valeurs de la maquette V4 |
| Brume, faisceau, lueur basse, halo sous la carte, poussière, bande de lumière | croquis, désactivés | à supprimer au gel si non retenus |

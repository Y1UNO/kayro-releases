# Mesures de l'étape 14 — couleurs du jeu

Séance du 14/10 au soir, exe de production du 14/10 à 22:11 (paquets 1 à 5), banc `npm run perf`
(`scripts/perf/`), Élevée et Éco, 2 ou 3 essais par case. Base de comparaison : les dernières mesures du 14/10
après-midi (exe de 18:08, `docs/PERF-ETAPE13.md` § « Après corrections »), rassemblées case par case.

## Conditions
- PC déclaré libre (aucune action pendant les séances), mais **fond bien plus chargé** que le 14/10 après-midi :
  CPU hors Kayro 13–18 % (5–8 % avant), GPU hors Kayro **13 %** (1,5–1,8 % avant), dwm × 2 à 3. Ouverts : Comet,
  Medal (encodeur), Wallpaper Engine, Discord, Voicemeeter, HueSync.
- Les coûts (CPU, GPU, dwm) ne sont donc **pas comparables** au 14/10 ; les images lentes le sont moins bien.

## Séance 1 — cases de comparaison (sans images : couleurs du jeu au thème)
p95 / images > 8 ms par fenêtre de 10 s (essais) / max (ms). Avant → après.

| Case | Élevée | Éco |
|---|---|---|
| R1 éventail au repos | 3,7 → 3,7 / 0 → 0 / 4,4 → 4,0 | 3,7 → 3,7 / 0 → 0 / 4,0 → 4,0 |
| R2 carrousel au repos | 3,7 → 3,7 / 0 → 0 / 4,0 → 7,2 | 3,7 → 3,7 / 0 → 0 / 3,9 → 7,1 |
| I3 survol qui change | 3,7 → 3,7 / 1,0 → 2,1 / 10,7 → 10,8 | — → 3,7 / — → 2,3 / — → 10,7 |
| I8 liaison + retour | 3,7 → 3,7 / 4–7 → 5–11 / 14,4 → **21,3** | 3,7 → 3,7 / 4 → 5 / 14,3 → **25,0** |
| I5 onglets | 3,7 → 3,7 / 4–7 → 8–14 / 14,3 → **21,4** | 3,7 → 3,7 / 1 → 4–7 / 10,7 → 14,3 |
| A2 onde de thème | 3,7 → 3,8 / 8–10 → 15–22 / 21,5 → 25,0 | 3,7 → 3,7 / 5–7 → 8–14 / 21,6 → 25,1 |

Par occurrence (pire nombre d'images > 8 ms / max) : liaison 2 / 14,2 (Élevée), 1 / 10,8 (Éco) ; retour 3 / 21,3,
1 / 25 ; onglet 3 / 21,4, 2 / 14,3 ; onde **5–7** / 25 (2–3 au 14/10), 2–4 / 25,1.

## Séance 2 — cases G (images générées sur l'onglet Stream)
| Case | Élevée : p95 / > 8 ms / max — par occurrence | Éco |
|---|---|---|
| G1 marée (flèches) | 3,7 / 5–8 / 21,4 — **2 par changement** | 3,7 / 3 / 10,8 — 1 par changement |
| G2 rafale | 3,7 / 4–10 / 21,4 — 2–3 par rafale | 3,7 / 2–5 / 25,0 — 1–2 |
| G3 liaison, Léger | 3,7 / 4–7 / 14,4 — 1–2 | 3,7 / 2–3 / 14,3 — 0–1 |
| G3-imm liaison, Immersif | 3,7 / 2–5 / **17,8** — 0–2 | 3,7 / 2–3 / 10,8 — 0–1 |
| G4 repos avec affiches | 3,7 / 0–1 / 10,6 | 3,7 / 0 / 4,0 |
| G5 survol avec affiches | 3,7 / 0–1 / 10,8 — 0 pendant le survol | 3,7 / 0 / 4,1 — 0 |

## Lecture
- **Tenu** : le budget p95 ≤ 5,4 ms, partout (3,7–3,8) ; le survol et le repos avec affiches ; en Éco, la marée
  (1 image > 8 ms par changement, max 10,8 ms) ; la liaison avec les couleurs reste dans la tolérance de l'étape 13
  (1–2 images de 10–14 ms) en Léger.
- **Non tenu** (tolérances acceptées le 14/10) :
  - la marée en Élevée : 2 images > 8 ms par changement, jusqu'à 21 ms (cible : 1) ;
  - l'onde de thème : 5–7 images > 8 ms par occurrence en Élevée (2–3 le 14/10) ;
  - onglets et retour : des images de 21–25 ms (cible : aucune > 16 ms) ; G3-imm : 17,8 ms.
- **Causes probables, dans le code de l'étape 14** (vérifiées dans le code, pas encore mesurées une à une) :
  1. l'accueil (`HomeScreen`) appelle les hooks des couleurs : il se re-rend **en entier** 180 ms après chaque
     sélection (en plein glissement du carrousel, de la liaison ou d'un onglet) et à chaque changement de thème
     (au moment de l'onde) ; avant l'étape 14, il ne dépendait ni du thème ni de ce store ;
  2. chaque carte (`AppCard`, via `useIconFace`) s'abonne au thème et à **tous** les réglages : toutes les cartes se
     re-rendent au changement de thème et à chaque réglage modifié ;
  3. la charge de fond de cette séance (point 2 des conditions).

## Correctifs
1. **Fait le 15/10** : les hooks des couleurs sortent de `HomeScreen` dans un composant feuille qui ne rend rien
   (`GameColorsBridge.tsx`, mémoïsé) ; une écriture d'accents identique à la précédente est sautée.
2. **Fait le 15/10** : la face aux couleurs de l'icône est un sous-composant (`IconFace.tsx`, mémoïsé) ; seules les
   cartes réellement teintables s'abonnent au thème, et les réglages sont lus valeur par valeur
   (`useColorSettings`), jamais l'objet entier.
   - Vérifié dans la page de dev : une seule écriture d'accents par changement (à ~400 ms), aucune pour une rafale
     qui revient à la même carte, retour au thème sur l'éventail ; 548 tests verts.
3. **Fait le 15/10** : remesure de I5, I8, A2, G1, G2 (section suivante).

## Remesure après correctifs (15/10, vers 00:25)
Exe recompilé le 15/10 à 00:23 (correctifs 1 et 2). Comet et Medal fermés ; restent un processus Wallpaper Engine (en
pause), Discord, Steam, Voicemeeter, HueSync. Fond hors Kayro : CPU 12–14 %, **GPU 4,4–5 %** (13 % la veille,
1,5–1,8 % le 14/10 après-midi), dwm encore ≈ 2 × le 14/10.

| Case | Élevée : > 8 ms par fenêtre / max — pire par occurrence | Éco |
|---|---|---|
| I8 liaison + retour | 6–7 / **21,5** — liaison 1–3 (max 17,9), retour 1–2 (max 21,5) | 4 / 17,9 — 1 et 1 |
| I5 onglets | 6–9 / 14,3 — 2–3 (14/10 : 1–2 ; la veille : max 21,4) | 3–5 / 10,8 — 1 |
| A2 onde de thème | 10–17 / 28,6 — **3–6** (14/10 : 2–3) | 8–10 / 25,1 — 2–3 (14/10 : 2) |
| G1 marée | 3–9 / **14,3** (la veille 21,4) — 2 par changement (un essai 5) | 1–3 / 14,3 — 1 |
| G2 rafale | 2–7 / **14,3** (la veille 21,4) — 2–3 | 1–2 / 10,7 (la veille 25) — 1 |

p95 : 3,7 ms partout.

**Lecture**
- Les correctifs ont un effet visible : plus aucune image > 16 ms pour la marée et les rafales (21 → 14 ms en
  Élevée, 25 → 11 ms en Éco), les onglets reviennent au niveau du 14/10 (max 14,3 ms).
- **Reste au-dessus des tolérances du 14/10** :
  - l'onde de thème : 3–6 images > 8 ms par occurrence en Élevée (2–3 le 14/10), jusqu'à 28,6 ms ;
  - le retour de l'éventail : une image de 21,5 ms en Élevée et 17,9 ms en Éco (cible : aucune > 16) ;
  - la marée en Élevée : 2 images > 8 ms par changement (cible : 1), mais toutes ≤ 14,3 ms.
- Le fond reste plus lourd que le 14/10 (dwm × 2, HueSync capture l'écran) : on ne peut pas dire quelle part de
  l'onde et du retour vient du code de l'étape 14 sans comparer, dans les mêmes conditions, l'exe d'avant l'étape
  (`ae097c6`) et celui d'aujourd'hui.

## A/B dans les mêmes conditions (15/10, 00:42–01:00)
Même PC, même fond (Discord, Steam, Voicemeeter, HueSync ouverts ; Wallpaper Engine en pause), banc
`npm run perf -- --cases A2,I8 --exe …` : l'exe d'**avant l'étape 14** (`ae097c6`, compilé à part) et l'exe
**actuel** (`1b419a3`), dans l'ordre ancien, actuel, actuel, ancien ; 2 ou 3 essais par case et par séance.
Valeurs par essai : images > 8 ms par fenêtre de 10 s · pire par occurrence · max (ms).

| Case | Avant l'étape 14 (6 ou 4 essais) | Actuel (6 ou 4 essais) |
|---|---|---|
| I8 Élevée | 3–8 · liaison 0–2, retour 1–2 · max 10,8–21,5 (3 essais avec une image > 16 ms) | 4–10 · liaison 1–3, retour 1–2 · max 14,2–21,4 (1 essai > 16 ms) |
| I8 Éco | 1–3 · retour 1 · max 10,7–14,4 | 2–4 · retour 1 · max 10,7–17,9 (1 essai > 16 ms) |
| A2 Élevée | 8–15 · onde 2–6 (médiane 3) · max 17,9–21,6 | 8–11 · onde 2–4 (médiane 3) · max 17,9–25,0 |
| A2 Éco | 6–13 · onde 2–4 · max 17,9–24,9 | 6–8 · onde 2–3 · max 17,9–21,5 |

p95 : 3,7 ms partout ; CPU, GPU de l'app et dwm identiques entre les deux exe (à ± 0,3 pt).

**Conclusion** : dans les mêmes conditions, l'exe actuel n'est **pas plus lent** que celui d'avant l'étape 14 sur
l'onde de thème et la liaison / le retour (couleurs du jeu actives, au thème faute d'images dans ces cases). Les écarts
avec le 14/10 après-midi (onde 3–6 images lentes, retour à 21 ms) se retrouvent **avec l'exe d'avant l'étape** :
ils viennent du fond de ces séances (dwm × 2–3, GPU hors Kayro 4,5 % au lieu de 1,5 %), pas du code de l'étape 14.
Ce qui reste propre à l'étape 14 : la marée en Élevée donne 2 images > 8 ms par changement (≤ 14,3 ms ; 1 en Éco).

## Non mesuré
- La piste du gel « éventail prêt à 0 % » contre « recalcul allégé » (il faut d'abord écrire les deux chemins).
- Trace `--invalidations` d'un changement de jeu (recalcul unique des accents) : à faire avec la remesure.
- 60 Hz, Équilibré, Ultra, repli CSS : comme à l'étape 13, hors séance.

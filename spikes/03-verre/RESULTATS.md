# Spike 03 — coût de `backdrop-filter` + dégradés animés (PLAN.md spike (g))

**Machine** : RTX 5070, écran 1 en 2560×1440 à 280 Hz (WebView2 : Chrome 154), échelle 100 %. Build release, fenêtre sans bordure couvrant l'écran 1 (`run.ps1`), 7 paliers de 10 s (2,5 s de chauffe) ; la page tourne en continu avec 3 brumes `radial-gradient` de 1400 px animées en `transform` sous les surfaces. Surfaces verre : 460×300 px, `blur(20px) saturate(190%)`. Canvas : plein écran, 26 particules.
CPU = tout l'arbre (spike + `msedgewebview2.exe`), en % de la machine (12 threads), échantillonné toutes les 500 ms avec `sysinfo`. GPU = moteurs 3D de l'arbre, compteurs « GPU Engine » (≈ 1 échantillon / 4 s : peu de points par palier, ordre de grandeur seulement).

## Résultats (passage complet de référence)
| Palier | rAF p50 / p95 / max (ms) | Images perdues sur ≈ 2 800 | CPU moyen / max | GPU 3D moyen |
|---|---|---|---|---|
| Animations en pause (référence) | 3,60 / 3,70 / 4,0 | 0 | 1,0 % / 2,5 % | 0,0 % |
| 0 surface | 3,60 / 3,70 / 4,1 | 0 | 3,9 % / 5,6 % | 2,5 % |
| 0 surface + canvas | 3,60 / 3,70 / 4,1 | 0 | 4,8 % / 6,1 % | 4,6 % |
| 3 surfaces | 3,60 / 3,70 / 4,0 | 0 | 5,5 % / 8,3 % | 5,9 % |
| 3 surfaces + canvas | 3,60 / 3,70 / 4,0 | 0 | 6,8 % / 9,6 % | 7,7 % |
| 6 surfaces | 3,60 / 3,70 / 4,0 | 0 | 6,6 % / 8,3 % | 7,2 % |
| 6 surfaces + canvas | 3,60 / 3,70 / 4,0 | 0 | 7,9 % / 10,5 % | 9,1 % |

Répétabilité (7 passages au total, GPU disponible seulement dans le dernier) : p50 = 3,6 ms et p95 = 3,7 ms à chaque fois ; CPU 6 surfaces + canvas entre 7,5 et 8,8 %, 0 surface entre 3,5 et 4,2 %. Images perdues (delta > 1,5 × 3,58 ms) : **0 dans 5 passages sur 7** ; un passage avait 1 image perdue (6 surfaces + canvas) et le premier en avait **2 (3 surfaces) et 13 (6 surfaces, max 10,8 ms)**. Les accrocs isolés existent donc, sans corrélation nette avec le nombre de surfaces.

## Verdict
- Temps par image : **réussi** (p95 3,7 ms ≤ 5,4 ms ; WebView2 tient bien ≈ 278 Hz, p50 3,60 ms).
- GPU : **réussi** (≤ 9,1 % avec 6 surfaces + canvas, < 15 %).
- « 0 image perdue en 10 s » : **réussi dans 5 passages sur 7**, raté dans 2 (1 image, puis jusqu'à 13 images perdues avec 6 surfaces). Le critère n'est pas garanti ; il faudra le re-mesurer à l'étape 8 avec la vraie scène.
- **CPU : le budget de PLAN.md §5 « CPU visible, niveau Élevé, sans interaction < 4 % » n'est pas tenu dans ce pire cas** (7,9 % avec 6 surfaces + canvas ; 3,9 % dès les seules brumes). Ordre de grandeur : référence en pause 1,0 %, brumes seules +2,9 points, canvas +0,9 à +1,2, chaque tranche de 3 surfaces verre +1,5 à +2,0. Cause probable : tout tourne à 278 Hz (compositeur + rAF). Non vérifié : l'effet d'un plafond à 144 Hz (décision §6.4 : le canvas seul est plafonné, pas les animations CSS).

## Plan B / ajustements proposés (à trancher avec toi, pas appliqués)
1. Garder la règle « ≤ 6 `backdrop-filter` » (coût GPU faible) mais **relever le budget CPU « visible, Élevé » de < 4 % à < 8 %** à 279 Hz, ou le garder à < 4 % avec les brumes en pause (veille douce) / au repos et le mesurer à l'étape 8.
2. Mettre en pause les brumes quand rien ne bouge (écran statique), car les brumes seules coûtent ≈ 3 points.
3. Pas de besoin de flou réduit (12 px) : le flou 20 px ne dégrade ni le temps par image ni le GPU.

## Non testé (à faire, étape 13)
- 60 Hz (réglage d'écran à changer) ; Hz plafonné à 144 ; 1 seul passage GPU avec peu d'échantillons ; machine modeste (niveau Éco).

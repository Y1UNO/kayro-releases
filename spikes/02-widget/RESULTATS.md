# Spike 02 — widget transparent sans bordure (PLAN.md spike (b))

**Machine** : Windows 11 25H2 (build 26200), RTX 5070, écran 1 en 2560×1440 à 280 Hz, échelle 100 %. Build release, 1 passage par variante (`run.ps1 -Variant css|acrylic|mica`).
**Fenêtre** : 560×64 px, `transparent` + `decorations:false` + `shadow:false` + `skipTaskbar` + `alwaysOnTop`, pilule CSS de rayon 32 px, placée à y = 12 px en haut de l'écran principal. Captures limitées à la zone du widget (+24 px), non versionnées.

## Mesures
| | CSS `rgba(30,20,38,.82)` | Acrylic | Mica |
|---|---|---|---|
| Aspect (capture) | pilule propre, bords nets, **aucune ombre carrée**, le bureau transparaît | **rectangle** flouté visible autour de la pilule (coins carrés) | **rectangle** gris visible autour de la pilule (coins carrés) |
| Dépliage 64 → 304 px, `set_size` Rust (6 essais) | 3,9–6,8 ms | 3,5–6,1 ms | 3,2–5,5 ms |
| Dépliage jusqu'à 2 images rendues (médiane) | 14,3 ms | 15,5 ms | 15,8 ms |
| Déplacement de 600 px en 1,5 s : rAF p95 / max / images > 1,5×médiane | 3,7 / 4,0 / 0 | 3,7 / 7,1 / 1 | 3,7 / 4,1 / 0 |
| Fenêtre au repos : rAF p95 / max | 3,7 / 3,8 ms | 3,7 / 3,9 ms | 3,7 / 12,2 ms (4 images) |

Les images tournent à 3,6 ms (≈ 278 Hz) dans la WebView2, pilule déplacée ou non.

**Clics dans les zones transparentes** (`WindowFromPoint`, sans clic réel) :
- dans le rectangle de la fenêtre (y compris les coins transparents de la pilule) → la fenêtre du spike reçoit le clic ;
- à 6 px à gauche du rectangle → une autre fenêtre (le clic passe).
- Surface concernée : 4 × r²(1 − π/4) ≈ 880 px² sur 35 840 px² (≈ 2,5 %) pour une pilule de rayon 32.

## Verdict
- **Variante 1 (CSS semi-opaque, sans flou du bureau) retenue**, conformément à la décision du §6.1 de PLAN.md. Les effets natifs ne s'appliquent qu'au rectangle de la fenêtre : visibles comme un cadre carré autour de la pilule (acrylic) ou d'un rectangle gris (mica). Ils restent exclus pour la pilule ; ils ne conviendraient qu'à un panneau déplié rectangulaire (plan B de PLAN.md).
- Pas de coût mesurable de l'acrylique au déplacement sur ce PC (un seul accroc à 7,1 ms) : le défaut connu de Win11 22000+ n'apparaît pas dans la mesure de rAF. Ce que voit l'œil (fluidité du déplacement à la souris) **n'est pas mesuré**.
- Dépliage : fenêtre et DOM changent dans la même image logique ; entre l'appel et la 2e image rendue il s'écoule ≈ 14 ms (≈ 4 images à 279 Hz). Le critère « ≤ 1 image de décalage » **n'est pas mesurable par cette méthode** ; aucun décalage visible sur les captures à l'état stable.
- Coins transparents qui bloquent les clics : négligeable (≈ 2,5 % de la surface). Plan B si cela gêne : région de fenêtre arrondie (`SetWindowRgn`) à l'étape 12.

## Non testé (à faire, étapes 12-13)
- Windows 10 (pas de machine), échelles Windows 125 % et 150 % (réglage système à changer).
- Présence ou non du widget dans Alt+Tab (`skipTaskbar`), ressenti du déplacement à la souris, déplacement entre les deux écrans.

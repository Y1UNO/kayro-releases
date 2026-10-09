# Spike 04 — mode immersif sans bordure, multi-écran, Alt+Tab (ROADMAP étape 2)

**Machine** : Windows 11 25H2 (build 26200). DISPLAY1 = principal, 2560×1440, **280 Hz** ; DISPLAY2 = à gauche (x = −2560), 2560×1440, **144 Hz** (mode lu par `EnumDisplaySettings`) ; échelle 100 % sur les deux. Build release, `run.ps1 -Monitor N [-Extra "--shadow|--topmost"]`. Fenêtre `decorations:false`, `resizable:false`, `skipTaskbar:false`, positionnée et dimensionnée par `set_position` / `set_size` sur le rectangle exact du moniteur (pas d'API plein écran).

## Mesures
| Mesure | Résultat |
|---|---|
| Taille de la fenêtre par défaut (`shadow` activé) | rectangle externe **2576×1449** pour un moniteur 2560×1440 (zone cliente correcte, 2560×1440) : la fenêtre **déborde de 16 px à droite et 9 px en bas** ; sur DISPLAY2 elle recouvre 16 px de DISPLAY1 |
| Avec `shadow(false)` | rectangle externe = moniteur exactement (2560×1440), position (0,0) ou (−2560,0), plus de débordement |
| Barre des tâches recouverte (bande de 6 px en bas de l'écran, 480 points de mesure) | **480/480 recouverts** quand la fenêtre est au premier plan, sur les deux écrans |
| Fenêtre non au premier plan (premier plan volé) | la barre des tâches (toujours au-dessus) **réapparaît** (0/480 recouverts) |
| Avec `alwaysOnTop` | premier plan et recouvrement **conservés** à travers le déplacement d'un écran à l'autre (4 étapes sur 5 : 480/480) |
| Retour de `set_fullscreen(false)` | barre des tâches visible de nouveau, même avec `alwaysOnTop` : **ne pas utiliser `set_fullscreen`**, rester sur `set_position`/`set_size` |
| Alt+Tab (lecture des styles Win32) | classe « Tauri Window », `WS_EX_APPWINDOW` présent, pas de `WS_EX_TOOLWINDOW`, pas de propriétaire → **éligible à Alt+Tab** (la fluidité réelle n'est pas mesurée) |
| Déplacement vers l'autre écran | `set_position` + `set_size` : 2,2–4,5 ms côté Rust, 6–15 ms jusqu'à 2 images rendues |
| `set_fullscreen(true)` pour comparaison | 5–21 ms côté Rust, 16–35 ms jusqu'à 2 images : plus lent et fragile (voir ligne précédente) |
| Création de la fenêtre → 2e image rendue (à froid) | 0,84–0,96 s après `main()` |
| rAF mesuré dans la page | **277,8 Hz sur les deux écrans**, y compris sur DISPLAY2 qui est à 144 Hz (p50 3,6 ms, p95 3,7 ms, max 3,8–8,9 ms) |

## Verdict
- **Immersif = fenêtre sans bordure, `shadow(false)`, taille exacte du moniteur, retenu.** Les deux écrans sont gérés ; la barre des tâches est recouverte tant que la fenêtre est au premier plan.
- **Ajustement d'architecture** : pour recouvrir la barre des tâches de façon fiable, utiliser `alwaysOnTop` **pendant le mode immersif seulement**, et le retirer dès que la fenêtre perd le focus (sinon elle masquerait le jeu qu'elle vient de lancer). À traiter à l'étape 12.
- **Ajustement important pour le budget de performance** : `requestAnimationFrame` **ne suit pas la fréquence de l'écran où se trouve la fenêtre** (278 Hz mesurés sur un écran à 144 Hz). La fréquence réelle doit venir du côté Rust (`EnumDisplaySettings` / API Windows), pas d'une mesure de rAF ; le plafond du canvas à `min(Hz, 144)` (PLAN.md §6.4) reste valable. Le §5 de PLAN.md (« le budget par image suit l'écran ») est à corriger.
- Plan B non nécessaire : aucun échec.

## Non testé (à faire, étapes 12-13)
- Deux écrans à **échelles différentes** (les deux sont à 100 % ici) ; Windows 10.
- Ressenti d'Alt+Tab (animation, ordre de la liste) ; interaction avec un vrai jeu en plein écran exclusif ; recouvrement de la barre des tâches quand elle est masquée automatiquement ou placée sur un autre bord.
- Les captures n'ont mesuré qu'une bande de 6 px en bas de l'écran (pas d'image complète).

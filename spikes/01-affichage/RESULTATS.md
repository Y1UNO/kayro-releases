# Spike 01 — fenêtre cachée affichée par raccourci global (PLAN.md spike (a))

**Machine** : Windows 11 25H2 (build 26200), RTX 5070, écran 1 à 280 Hz, échelle 100 %. Build release. Fenêtre 800×500, `visible:false`, `backgroundColor #171021`, cachée par `hide()` 0,9 s après chaque affichage.
**Protocole** : `run.ps1` injecte `Ctrl+Alt+F9` (`keybd_event`), échantillonne 70 pixels de la zone de la fenêtre 40 ms plus tard (détection d'un flash blanc), puis injecte `F24` (touche inoffensive) pour vérifier que le clavier arrive à la page. Rust note `Instant::now()` à `ShortcutState::Pressed` ; la page appelle `mark_painted` après 2 `requestAnimationFrame`.

## Résultats
| Essais | Raccourci → 1ère image peinte (p50 / p95 / max) | `show()` + `set_focus()` côté Rust | Focus clavier | Flash blanc |
|---|---|---|---|---|
| 20 essais, caché 5 s (2 passages) | **28,4 / 31,4 / 42,4 ms** (1er passage : 27,2 / 31,5 / 43,7) | p50 21,7 ms, max 33,6 ms | **20/20** (`document.hasFocus()`), `F24` reçu à chaque essai | **0/20** |
| 1 essai à froid, caché 180 s | **29,9 ms** | 20,9 ms | oui, `F24` reçu | non |

- Budget PLAN.md : p95 < 150 ms, objectif 80 ms → **tenu avec une grande marge** (p95 31 ms). Le coût est surtout `show()` + `set_focus()` (≈ 22 ms) ; la page peint ≈ 7 ms après.
- Le `F24` a été reçu 22 fois pour 20 essais (2 de plus, sans explication : probablement un doublon de touche enfoncée ; sans effet sur la mesure).

## Constats importants pour la suite
1. **WebView2 ne suspend pas une fenêtre cachée.** `document.visibilityState` reste `visible` et `visibilitychange` ne se déclenche **jamais** après `hide()` ; les `requestAnimationFrame` continuent à **≈ 280 par seconde** (1 447 images en 5,17 s ; 52 588 images en 187,8 s de masquage). Le hub devra donc arrêter lui-même ses boucles (veille douce, étape 13), sur un **événement envoyé par Rust** (masqué / affiché), pas sur `visibilitychange`.
2. **`Ctrl+Alt+Espace` est déjà pris sur ce PC** : `register()` échoue avec « HotKey already registered » (Windows refuse l'enregistrement, l'autre programme le garde). Le détenteur n'a pas été identifié (« à vérifier » : l'application Claude de bureau utilise ce raccourci par défaut, mais ce n'est pas confirmé). Mes premières injections de ce raccourci sont donc parties vers l'autre programme. Le spike mesure avec `Ctrl+Alt+F9`. **Le défaut du §6.2 de PLAN.md est à rediscuter** ; l'enregistrement doit gérer l'échec (message clair + raccourci à choisir dans les réglages).
3. Le focus clavier arrive sans astuce supplémentaire quand le raccourci a déclenché `show()` + `set_focus()`.

## Plan B
Non nécessaire pour la latence (le « cloaking » `DWMWA_CLOAK` reste une option si la veille douce exige de garder la fenêtre affichée).

## Non testé
- Plusieurs heures de masquage (seulement 3 min), fenêtre sur le 2e écran, échelles ≠ 100 %, Windows 10.
- L'étape 12 devra vérifier la gestion d'un raccourci déjà pris et d'un jeu en plein écran exclusif au premier plan (la fenêtre doit-elle prendre le focus ?).

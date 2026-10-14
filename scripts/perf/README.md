# Banc de performance de Kayro

Mesure l'exe de production (`target/release/Kayro.exe`) en vraie fenêtre. Né à l'étape 13 ; il resservira aux étapes 14 à 17 et à l'audit (18).

## Avant de lancer

- **Compiler l'exe** : `scripts/build-local.ps1`.
- **Quitter Kayro** : `Kayro.exe --quit`. Le banc refuse de démarrer si Kayro tourne.
- **Libérer le PC** : jeux et launchers fermés, et plus personne ne touche à la souris ni au clavier pendant la séance.
  - Kayro doit garder le premier plan : sans focus, la veille douce coupe ses boucles.
  - Un essai qui perd le focus est écarté puis refait, et le nom du processus fautif est noté.
- **Réglage de l'écran** : la machine garde ses réglages. Le banc ne change que l'état d'éveil (`SetThreadExecutionState`), et seulement le temps de la séance.

## Commandes

```
npm run perf                                   # toute la séance : bloc L (lancements) puis bloc M (cases)
npm run perf -- --cases A2,I8,I5               # une sélection de cases (bloc M), Élevée et Éco
npm run perf -- --cases R --quality eco        # « R » = toutes les cases R… ; une seule qualité
npm run perf -- --block L --launches 3         # l'ouverture et --quit seulement
npm run perf -- --cases A2 --compare <ancien results.jsonl>   # tableau « avant → après »
npm run perf -- --trace A2 --quality high      # trace d'une occurrence (fichier .json + résumé)
npm run perf -- --memory 10 --quality eco       # mémoire après 10 changements de thème, puis 20 s au repos
npm run perf -- --dry                          # essai à blanc : fenêtres de 2 s, un essai
npm run perf -- --cases G1,G2,G3,G4,G5         # étape 14 : couleurs du jeu et affiches (images générées)
```

Autres options : `--trials 2` (essais par case ; un 3e s'ajoute tout seul si les deux s'écartent), `--keep-data` (garde le dossier de test) et `--art` (images générées sans case G).

**Cases G (étape 14, `cases14.mjs`)** : elles se jouent sur l'onglet « Stream », dont les 4 apps de test reçoivent des images **générées** (affiche, héros, logo : dégradés de `data.mjs`, jamais l'art d'un jeu). Les images ne sont écrites que si une case G est demandée (ou `--art`) : les autres cases restent comparables aux mesures du 14/10.

- **G1** : flèches dans le carrousel, une marée par changement (fenêtre « marée » de 1,1 s après chaque touche).
- **G2** : rafales de 3 flèches à 40 ms : aucune marée pendant la rafale, une seule à la fin.
- **G3** / **G3-imm** : liaison éventail → Stream et retour, couleurs en Léger puis en Immersif (héros).
- **G4** : carrousel au repos avec affiches ; **G5** : survol qui change avec affiches.

## Ce qui est mesuré

- **Images** : une sonde `requestAnimationFrame` relève l'intervalle entre deux images pendant 10 s, et en tire le p95, le max et le nombre d'images au-delà de 8 et de 16 ms.
  - Pour les animations, elle compte aussi les images lentes de chaque occurrence. La « pire / occ. » se compare à la tolérance d'une image > 8 ms par animation signature.
- **Coût** : mesuré dans une fenêtre de 10 s **séparée**, sans la sonde.
  - CPU de l'arbre Kayro + WebView2, en % de la machine ;
  - GPU 3D de l'app, de dwm et de toute la machine ;
  - mémoire privée de l'arbre.
  - La charge de fond (machine moins Kayro) est notée à côté.
- **Bloc L** : à chaque lancement, les images de l'ouverture et de sa pulsation, puis la durée de `--quit` et le chemin de sortie (« boucle » ou « filet »).
- **I9** : survol rapide. Plus de 1 000 déplacements de souris par seconde sont envoyés par CDP ; le banc compte les événements envoyés et ceux reçus par la page.
- **A4** (passages) : relève l'opacité de la page à chaque image lente, pour savoir si elle tombe dans le noir.

## Règles

- **Aucune donnée personnelle** :
  - le dossier de test (`%TEMP%\kayro-perf\appdata`) est **recréé à chaque séance** (15 apps de test aux cibles inexistantes, réglages fixes de `data.mjs`), puis supprimé ;
  - le profil de l'utilisateur n'est jamais lu.
- **Aucune capture d'écran**, ni CDP ni Windows. Une capture CDP fausse l'image affichée à l'écran pendant 70 à 150 ms (constat de l'étape 13).
- Kayro est toujours quitté par `--quit`, jamais tué.
- **Résultats** : dans `%TEMP%\kayro-perf\<date>\`, avec `results.jsonl` (brut), `report.md` (médianes par case et par qualité) et les éventuelles traces.

## Fichiers

| Fichier       | Rôle                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `bench.mjs`   | options, blocs L et M, essais, trace                                                                     |
| `cases.mjs`   | les cases (bloc M), dans leur ordre de passage                                                           |
| `cases14.mjs` | les cases G de l'étape 14 (couleurs du jeu, affiches)                                                    |
| `png.mjs`     | écriture PNG minimale pour les images de test                                                            |
| `states.mjs`  | les états à atteindre (éventail, carrousel, réglages, éditeur, fenêtre, widget) et les scénarios communs |
| `lib.mjs`     | exe, CDP, sonde d'images, statistiques                                                                   |
| `report.mjs`  | médianes, tableau Markdown, avant / après                                                                |
| `trace.mjs`   | résumé d'une trace (tâches > 8 ms du fil principal)                                                      |
| `data.mjs`    | dossier de test                                                                                          |
| `win.ps1`     | premier plan, coût CPU / GPU / dwm, maintien d'éveil                                                     |

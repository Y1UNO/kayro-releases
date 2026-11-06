# Revue Opus 5.5 — note d'évolution (2026-10-29)

Passe faite d'un trait, après la revue des artefacts de motion (Kayro en mouvement, Kayro 15 secondes, Directions
visuelles, Ambiance et Intro Hades II, moteur RAYKA, Orage, Sakura, RAYKA recrute). Branche `step-pretest`,
**rien n'est commité**. Chaque changement de DA a sa ligne dans [[DA-JOURNAL]] § « Gel de la DA » ; [[DESIGN]] est à jour.

## Ce qui change pour toi

**Flottaison des éventails et des cartes, enfin visible**
- « Visible » (défaut) passe de 7 à **10 px** sur l'éventail, de 5 à **7 px** sur le carrousel, bascule 1,1°.
- Nouveau : la carte dérive aussi un peu de côté, sur un rythme plus lent. Elle décrit une petite boucle douce au
  lieu de monter et descendre comme un piston. Les trois niveaux sont plus francs (Légère 4 px, Marquée 15 px).

**Survol 3D net et premium**
- La carte survolée s'incline vers le curseur jusqu'à **6°** (avant 2,5° et 3°), sur l'éventail comme sur le carrousel.
- Le mouvement est lissé image par image : il suit le curseur sans à-coups et revient à plat en douceur.
- **Le verre suit la carte en 3D.** Jusqu'ici, la carte s'inclinait mais son verre (bord, reflets, affiche dessinés
  par le moteur) restait à plat dessous : c'était une des sources du rendu « croquis ». Le moteur reprojette
  maintenant le verre en perspective. Les reflets du bord glissent quand la carte tourne, et le côté qui vient vers
  toi prend une lumière douce.

**Couleurs du jeu qui changent vraiment**
- La couleur retenue est celle qui « parle » pour l'affiche, plus le gris ou le bleu nuit du ciel qui occupe le plus
  de place. Sur ce PC : Slay the Spire 2 prend son orange au lieu de son gris,
  Apex un bleu franc au lieu du bleu nuit, Hades II son vert ; Clair Obscur et PRAGMATA, vraiment gris, restent proches du thème.
- La deuxième couleur est toujours d'une autre teinte que la première.
- **2ᵉ passe, après ton retour sur Apex** : Kayro regarde maintenant comment les couleurs de l'affiche et de l'image
  de fond du jeu s'organisent. Il les groupe en familles de teintes (bleus, cyans, oranges…), en pondérant chaque
  couleur par sa surface et sa vivacité. La famille la plus forte donne la couleur principale, la suivante l'accent.
  Le mélange avec le thème suit le cercle des couleurs : avant, le cyan d'Apex et le pêche de ton thème se
  mélangeaient en gris. Le jeu compte maintenant pour 85 % au lieu de 60 %. Apex est donc bleu, avec un accent cyan.
- En **Léger** (défaut), la **nuit du fond prend aussi la teinte du jeu**, plus légèrement qu'en Immersif.
  En passant d'un jeu à l'autre, la marée change maintenant tout le décor.

**Moins de couleurs à l'écran**
- Les cartes sans affiche ne prennent plus franchement les couleurs de leur icône : le thème domine, l'icône reste
  en nuance. Avec beaucoup d'apps sans image, l'accueil ne fait plus arc-en-ciel.

**Rendu plus fini**
- Tramage invisible dans le fond et le verre : plus de bandes dans les dégradés sombres.
- **Changement d'onglet (après tes retours)** : plus de paquet au centre. Les cinq cartes partent en ronde sur un
  grand anneau vu en perspective, sur toute la largeur : celles qui passent au fond rapetissent et montent, celles de
  devant passent par-dessus. Elles font un tour ensemble, puis retombent à leur place, en vague de gauche à droite.
  Environ 1,4 s.

**Scan des apps : seulement ce qu'on lance**
- Écartés du menu Démarrer : aides (« Check for updates », « About Java », docs, « Report a problem »), consoles
  et runtimes (Python, IDLE, Node.js, Git Bash), variantes (« OpenGL », « x64 », « mode sans échec », « mode
  compatibilité »), outils annexes d'une suite (Voicemeeter garde Voicemeeter et Banana ; DaVinci garde Resolve),
  pilotes, services, installeurs, OneDrive, le Lecteur Windows Media hérité.
- Noms nettoyés : « spotify - Raccourci » devient « Spotify ».
- Sur ce PC : **58 propositions au lieu de 100** pour le menu Démarrer (scan réel en lecture seule). Steam et Epic ne
  changent pas, sauf qu'une bande-son, un serveur dédié ou un SDK n'est plus proposé comme jeu.
- Tout le reste s'ajoute toujours à la main, en déposant le fichier sur Kayro.

## Comment tester (dans l'exe)
1. « Kayro — mettre à jour », puis « Kayro ».
2. Éventail : regarder les cartes flotter, puis en survoler une et promener le curseur sur ses bords.
3. Carrousel des jeux : même chose. Passer d'un jeu à l'autre et regarder le fond changer de teinte.
   Passer de Jeux à Créativité (et retour) : les cartes doivent faire une ronde sur toute la scène, puis se reposer.
4. Ajouter des apps : la liste proposée doit être courte et propre.

## Vérifié dans l'exe (29/10 au soir)
- Ton exe datait de 18:26, avant l'inclinaison : c'est pour ça que tes cartes ne s'inclinaient pas. Reconstruit à
  19:31 (`build-local.ps1`). Par CDP : l'éventail s'incline (rotateX 3° au bord), la carte du carrousel aussi (4,8°),
  le verre du moteur suit (capture), et la projection du shader colle à la matrice CSS à 0,2 px près.
- Limite vue : le calque des filets (survol complet) suit l'inclinaison mais pas la flottaison ; on peut voir un
  liseré décalé de quelques px au coin le plus loin.

## Mesures A/B (29/10, 19:36–20:16, `npm run perf -- --exe`, ordre prétest, revue, revue, prétest)
Fond : Comet, Discord, HueSync, Medal (encodeur actif), Steam, Wallpaper Engine. Cases R1, I2, R2, R2-max, I3, G1,
Élevée et Éco, 2 essais. Résultats bruts : `%TEMP%\kayro-perf\2026-10-29-18-36-26` … `-19-06-12`.

| Case (Élevée) | p95 prétest → revue | > 8 ms (essais) | CPU % | GPU app % |
|---|---|---|---|---|
| R1 éventail au repos | 3,7 → 3,7 | 0 → 0 | 2,31 / 2,41 → 2,74 / 2,52 | 3,17 / 3,15 → 3,43 / 3,42 |
| I2 survol continu, éventail | 3,7 → 3,7 | 0 → 0 | 4,25 / 4,07 → 3,86 / 4,19 | 3,71 / 3,71 → 3,95 / 3,97 |
| R2 carrousel au repos | 3,7 → 3,7 | 0 → 0 | 4,07 / 4,39 → 4,64 / 4,54 | 6,06 / 6,02 → 6,36 / 6,32 |
| I3 survol qui change, carrousel | 3,7 → 3,7 | 0 et 1 → 0 | 9,06 / 8,77 → 9,00 / 8,99 | 8,78 / 8,75 → 9,11 / 9,14 |
| G1 marée (couleurs du jeu) | 3,7 → 3,7 | 11,8,8 et 9,8,5 → 5,5,10 et 4,6,5 | 9,32 / 9,28 → 9,55 / 9,77 | 7,31 / 7,35 → 7,48 / 7,54 |

- **p95 3,7 ms partout**, Élevée et Éco, les quatre passes (budget 5,4 ms).
- **Coût** : + 0,2 à 0,4 point de CPU et de GPU au repos et au survol (flottaison plus ample, verre incliné) ;
  mémoire + 10 à 40 Mo selon la case. La marée ne régresse pas (même nombre d'images lentes, max 17,8–21,4 ms
  contre 17,9–25 ms). Éco : mêmes écarts, plus petits (R1 1,63 / 1,54 → 1,69 / 1,63 % CPU).
- Vérifié aussi : 552 tests front, 236 tests Rust, `tsc`, `eslint`, `clippy`.

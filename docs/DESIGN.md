# DA officielle v1 de Kayro (gelée le 2026-10-14)

Référence de la direction artistique **telle qu'elle est dans le code**. Ce document prime sur `reference/` (maquettes
d'origine). Chaque valeur vient d'un fichier cité ; en cas d'écart, le code fait foi et ce document est corrigé.
Changements après le gel : une ligne dans `docs/DA-JOURNAL.md` § « Gel de la DA ». Aucune signature (§ 4) ne change
sans décision de l'utilisateur.

**Où vit la DA**
- Jetons CSS : `src/design/tokens.css` (couleurs, rayons, espacements, polices), `src/design/motion.css` (mouvement).
- Table de mouvement : `src/design/motion/tokens.ts` + `tokens4b.ts` + `tokens5.ts`, courbes `eases.ts`, ressorts
  `springCurves.ts` et `SPRINGS` (`src/design/glass/pillMotion.ts`).
- Catalogue des éléments visuels : `src/design/da/catalogue*.ts`. **Ses valeurs par défaut sont la DA livrée**
  (`src/design/da/active.json` ne contient aucune valeur). Les Réglages de l'utilisateur en surchargent une partie
  (`src/design/da/userDa.ts`) : un réglage peut éteindre un élément, jamais en allumer un.
- Thèmes : `src/design/themes/*.json` (6 fichiers). Moteur graphique : `src/fx/gpu/` (WebGL2), repli `src/fx/css/` + `src/fx/canvas/`.

---

## 1. Identité

**Direction** : sombre, doux, cinématographique. Une nuit à la couleur du thème, une **lune** (halo) en haut, un
**anneau liquide** de lumière, des cartes en **verre liquide** qui flottent, des titres serif. Une seule teinte à l'écran
(celle du thème). Jamais de néon « gamer ».

**Lune et anneau** (catalogue `moonHalo`, `crystalRing`, `liquidRing`) : l'anneau est un trait fin de lumière qui tourne
lentement et irrégulièrement ; de temps en temps une goutte s'en détache puis s'y refond (`liquidRing` : épaisseur 1,2 px,
flou 9 px, intensité 0,32, 0,5 tr/min, gouttes 3/min). `crystalRing` donne sa géométrie (680 px, `top` −230) et sert de
repli CSS (`src/fx/css/ringFx.ts`). Fond : bandes de lumière (3, intensité 0,1), bokeh (7 disques de 120 px, intensité
0,09, sprite disque 0,7 / anneau 0,3 : `BOKEH_SPRITE`), braises et étoiles, lumière du curseur (0,3, rayon 300 px).

**Typographies** (`--font-title`, `--font-ui`, embarquées par `@fontsource-variable`, aucun CDN) :
- titres : **Cormorant Garamond** ; titre de catégorie 96 px / 300, tracking −0,02 em (catalogue `categoryTitle`) ;
  titres d'écran 48 px (`--fs-title-lg`) ;
- interface : **Manrope** ; tailles `--fs-11` à `--fs-17`, `--fs-title-md` 26 px.

**Eyebrow** (petit titre en capitales : CATÉGORIE, CHOISIS UN UNIVERS, SCÈNES, titres de l'éditeur et du widget) :
`--eyebrow` = Manrope 12 / 700, `--eyebrow-tracking` 0,24 em, `--eyebrow-color` = `--text-soft`. Seule exception : le
sous-titre de l'ouverture garde 0,32 em (signature).

**Titre-signature** : eyebrow + serif + **filet A → B** dessous (`categoryTitle.underline`, 220 × 1,5 px, lueur 0,6,
un reflet glisse le long du filet toutes les 7 s : `TITLE_SHINE` 1 100 ms, courbe `standard`). Sur l'accueil, l'écran
Scènes et l'éditeur (`ScreenTitle.tsx`), l'eyebrow est à la même hauteur.

**Quatre familles de rayons** (`tokens.css`, rien d'autre dans l'app) :

| Jeton | Valeur | Pour |
|---|---|---|
| `--radius-pill` | 999 px | tout ce qui fait ≤ 46 px de haut : boutons, segments, interrupteurs, recherche, onglets, badges |
| `--radius-row` | 16 px | lignes, champs, tuiles, plaque de nom |
| `--radius-panel` | 26 px | dialogues, palette, menus, notifications, panneaux, étapes de l'éditeur, panneau du widget |
| `--radius-card` | 30 px (`cards.radius`) | cartes d'apps ; `--radius-fan` 24 px pour l'éventail et la carte vide |

Hors familles : traits de 1–2 px, case à cocher, piste du curseur, logo de la marque, mini-cartes des cartes de thème.

**Verre** :
- **moteur** (WebGL2, `src/fx/gpu/`) : seules les **cartes** (`glassCards`) et les **pastilles de sélection**
  (`glassPills`) sont en verre liquide : réfraction 0,6, épaisseur 14 px, dispersion 0,55, biseau 0,55, netteté 0,75,
  fusion 16 px (`glassEngine`) ; cartes × 0,75 d'épaisseur, teinte 0,14, affiche à opacité 1, retrait 3 px ; pastilles
  × 0,7, flou × 0,6, étirement 0,35 ;
- **CSS** (`.lg`, `src/design/glass/Surface.tsx`) pour les barres, le dock et les boutons ronds : `--glass-bg`,
  `--glass-filter` (`blur(20px) saturate(190%) brightness(1.06)`), `--glass-border`, `--glass-shadow`,
  `--glass-highlight`, teinte fumée `--glass-tint` (0,3) ; Éco : `--glass-bg-eco`, sans `backdrop-filter` ;
  6 `backdrop-filter` au plus à l'écran (`backdropBudget.ts`) ;
- **dialogues** : un seul panneau, `--panel-bg` (`--bg-mid` à 92 % + `--glass-highlight`), sans flou, scrim 0,62.

**Filets** (survol de l'éventail et des cartes du carrousel, `src/features/home/rim/`) : deux traits de lumière A → B qui
font le tour du bord en sens opposés, cœur blanc à 55 %, 2,2 px, intensité 1,8, longueur 0,2, halo 0,9, 0,25 tr/s,
12 étincelles au plus sur l'éventail, 4 sur le carrousel (catalogue `categoryHover`, `cardHover`).

**Affiches** (étape 14, `src/features/home/art.ts`) : une carte d'app montre l'affiche locale de l'app quand elle en a
une (image déposée sur la carte, copiée dans `%APPDATA%/Kayro/art/<appId>/`, sinon le cache Steam lu en place),
servie par le protocole `kayro-art` (id d'app + rôle, jamais un chemin) ; nom sur `.posterShade`. Sinon :

**Faces sans affiche** (cartes d'apps, de scènes, éventail) : dégradé A → B du thème tiré par carte, 0,85, bout sombre
× `--face-foot` 0,28, ombre de pied sous le nom, icône du programme sinon la lettre.

**Accessibilité** : contraste ≥ 4,5:1 vérifié par `src/design/contrast.test.ts` (25 paires × 6 thèmes) et
`contrast.drift.test.ts` (le modèle suit `tokens.css`). Anneau de focus clavier (§ 3), aires cliquables ≥ `--hit-min` 44 px.

---

## 2. Couleurs : les 6 thèmes

Un thème = un fichier JSON validé (`src/design/theme.ts`, `parseTheme`). Ordre de la grille et défaut :
`src/design/themes/index.ts` (premier = défaut). Texte commun : `--text` `#F6EFE8`, `--text-2` 0,88, `--text-3` 0,84,
texte sur accent `--text-on-accent` `#1A1020`, `--accent-light` = accent mêlé à 60 % de blanc, échec `--fail` `#F08C8C`.

| Thème (`id`) | `bg` haut → bas | `accent` | `gradient` A → B | `soft` | `glow` |
|---|---|---|---|---|---|
| **Bleu-gris** (`bleu-gris`, défaut) | #141A30 → #0B0F1E → #05070F | #A3B0DE | #A3B0DE → #7282BC | #D3DAF2 | rgba(114,130,188,.35) |
| Lavande-pêche (`lavande-peche`) | #15112B → #0C0A1A → #06050D | #B7A2F2 | #B7A2F2 → #F6A98A | #D9CEFA | rgba(246,169,138,.35) |
| Encre (`encre`) | #15151B → #0C0C10 → #060608 | #F6A98A | #F6A98A → #B7A2F2 | #F3DCCF | rgba(183,162,242,.30) |
| Sakura (`sakura`) | #24121E → #150A12 → #0B0509 | #F7B7C4 | #F7B7C4 → #D9708E | #FBD8DF | rgba(217,112,142,.35) |
| Opale (`opale`) | #10202A → #0A131A → #05090D | #9FD0E8 | #9FD0E8 → #F2A2B8 | #D2ECF6 | rgba(242,162,184,.35) |
| Cuivre (`cuivre`) | #24160F → #150D09 → #0A0605 | #D99A6C | #D99A6C → #B07A78 | #F0D2BC | rgba(176,122,120,.35) |

Chaque fichier porte aussi `fog` (3 couleurs), `card` et `beam` (rgb) : données du thème, gardées pour les couleurs du
jeu (étape 14) et les thèmes importés (étape 15). Anciens thèmes : la migration des réglages v1 → v2
(`src-tauri/src/config/visual.rs`) donne `mauve` → Encre, Crépuscule / Aurore boréale / Océan / Rose poudré / Graphite →
Bleu-gris ; côté page, un id inconnu ou retiré donne Bleu-gris (`resolveTheme`, aussi dans `setThemeId`).

**Jetons écrits par un thème** (`themeVariables`, `src/design/applyTheme.ts`) : `--bg-top`, `--bg-mid`, `--bg-bottom`,
`--accent`, `--glow`, `--card`, `--grad-a`, `--grad-b`, `--text-soft`. Les couleurs sont des `@property` (Bleu-gris en
valeur initiale : la première image n'attend pas le JS), `html` / `body` peints en `--bg-bottom` dès l'image 0.

**Comment un thème s'applique : un seul recalcul, sans lecture forcée** (étape 13) :
- les variables sont écrites d'un coup sur `<html>` ; la transition des couleurs n'est déclarée que pendant un vrai fondu
  de variables (`:root[data-theme-fade]`, `--dur-theme` 0,9 s) ; un changement instantané (onde, Fondu, Direct) ne
  recalcule donc la page qu'une fois ;
- aucune lecture forcée après l'écriture (`getComputedStyle`, `offsetHeight`) ;
- le moteur reçoit ses couleurs par la palette (`themePalette` → `FxPalette` : `a`, `b`, `bg`), jamais en relisant le CSS.

**Couleurs du jeu** (étape 14, décisions de la planche du 14/10 dans `DA-JOURNAL.md` ; `src/features/gameColors/`,
jetons `GAME_COLORS` dans `src/design/motion/tokens14.ts`) :
- **Calcul** (`derive.ts`) : la palette brute du cœur (OKLab, `palettes.json`) donne A = dominante, B = accent
  (une image d'une seule couleur prend l'accent de l'autre image du jeu, sinon du thème) ; bornées comme les thèmes
  (L 0,72–0,85, C ≤ 0,12) puis mêlées au thème à **60 %**. Contraste ≥ 4,5:1 testé sur les 6 thèmes.
- **Ce qui se teinte** (réglage `color_mode`, **Léger** par défaut) : l'ambiance du moteur (fond, lune, anneau, bokeh,
  braises, teinte du verre des cartes et des pastilles, prise dans la palette : `FxPalette.card`) et les accents de
  l'accueil (`--game-a`, `--game-b` : filet du titre, filets de survol ; anneau de focus réécrit avec eux), posés
  sur 3 conteneurs (`data-game-accents`), jamais sur `:root` : texte, dialogues et Réglages restent au thème.
  **Immersif** : en plus, la nuit aux couleurs du jeu (`FxPalette.bg`) et le héros flouté de Steam en haut
  (`FxPalette.hero`, texture du moteur, opacité 0,75, fondu dans la nuit de 18 à 60 % de la hauteur).
- **Passage d'un jeu à l'autre : la marée** (`paletteTween.ts`, shader du fond) : 180 ms après que la sélection se
  pose (rien pendant une rafale), les nouvelles couleurs partent de la carte active en cercle, **700 ms**, courbe
  `standard`, bord doux 90 px et bande de lumière (0,55, pleine jusqu'à 80 %) ; sans View Transition ; les accents
  changent une fois, quand le bord atteint le titre. Premier affichage, thème, réglage : changement direct.
  « Réduire les animations » : direct. Repli CSS : lune et anneau en fondu, nuit de l'Immersif sur `Backdrop`.
- **Sortie des jeux** (éventail, autre écran) : retour au thème par la même marée. **App sans image** : face et
  ambiance aux couleurs de son icône. **Carte active avec affiche** : le logo du jeu à la place du nom (fondu micro).
- **Variantes** (Personnalisation avancée, § 5) : intensité 35 / 60 / 100 %, caractère (comme le thème, fidèle,
  vive), couleur principale (dominante, la plus vive, accordée au thème), passage (marée, fondu 600 ms, direct),
  moment (sélection posée, tout de suite, au lancement seulement), image du jeu en Immersif, couleurs de l'icône.
- **Par app** (dialogue de modification, panneau « Apparence », enregistré tout de suite) : ses images (affiche,
  fond, logo : déposer une image sur une case, « Retirer » rend celle de Steam) et ses couleurs (Automatiques ·
  Choisies : A et B parmi les couleurs de ses images, bornées et mêlées comme les autres · Thème : jamais teintée).

---

## 3. Mouvement : langage « Vivant »

Tout est en temps réel (`frameLoop`, `Choreo`), jamais en nombre d'images. Une seule table de jetons ; les durées sont
divisées par la vitesse (0,7 / 1 / 1,5).

**Durées** (`MOTION_DEFAULTS`, `--m-micro` … `--m-long`) : micro **140 ms**, court **240**, moyen **360**, long **540** ;
une disparition dure **0,7 ×** (`outShare`). Cascade **45 ms** entre lignes (12 au plus), montée **14 px**, survol d'un
bouton +1 px, appui **× 0,94**, panneau **× 0,96 → 1**.

**Courbes** (`eases.ts`) : apparition `vive` (0.16, 1, 0.3, 1) ; disparition `sortie` (0.7, 0, 0.84, 0) ; déplacement
`liaison` (0.34, 1.32, 0.64, 1) = ressort qui dépasse de 3,4 % ; rebond `rebond` (0.34, 1.45, 0.64, 1) = 6,6 % ;
aussi `premium`, `bascule`, `standard`, `glisse`, `detente`, `douce`. Ressorts nommés (`SPRINGS`, plafond 8 %) : net 0,
léger 5 %, liaison 3,4 %, rebond 6,6 %. Ressorts du widget (`springCurves.ts`, `linear()`) : vertical 680 ms
douce 3,5 % · **normale 5 %** · forte 7 % ; latéral 560 ms 1,5 · **2,5** · 3,5 %.

**Trois niveaux** (`motion.css` : `--m1-*`, `--m2-*`, `--m3-*` = jeton × niveau × « réduire les animations ») :
1. **net** : survol et appui des boutons, onglets, champs ; court, sans rebond ;
2. **vivant** : pastille de sélection, interrupteurs, panneaux, notifications, listes ; ressort `liaison`, cascade ;
3. **magie** : cartes du carrousel ; soulèvement 10 px × 1,03 sur `rebond`, après **120 ms** de présence du curseur un
   voile (800 ms) puis les filets, éclat du bord au lancement (1,6 × long).

**Réglage « Mouvement »** (`MOTION_STYLES`) : **Vivant** (défaut, = la DA validée) · Complet (la magie aussi en mode
fenêtre et au clavier) · Net (plus aucun rebond ni magie dans le hub ; le widget garde ses propres réglages).
**« Suivre Windows »** (défaut oui) : « réduire les animations » de Windows = état final direct, sans balancement ni
particules (`src/fx/motionPref.ts`, `:root:not([data-rm-ignore])`).

**Anneau de focus clavier** (`focusShadow`, `--m-focus`) : 3 px de fond, 5 px A, 7 px B à 50 %, halo 26 px A à 45 % ;
immédiat ; sur la carte active du carrousel et de la grille.

**Règle 1** : un seul effet décoratif à la fois sur un même objet (le reflet qui suit le curseur est coupé au niveau 3,
le reflet du titre attend la fin de l'onde).

---

## 4. Signatures

Chaque signature : chronologie, valeurs clés, puis les cas **Éco**, **réduire** (« réduire les animations ») et **widget**.

### 4.1 Ouverture V1-A + pulsation C (`src/features/opening/`, catalogue `opening`, `OPENING_C`)
Une fois par démarrage du programme, au premier affichage ; jamais au rappel par raccourci ; pas au démarrage silencieux
(`opening_due` → `quiet`). Chronologie (`openingTimeline.ts`, ms) :
- 0 → 700 fond qui monte de la couleur la plus sombre ; 100 → 1 500 halo ; 200 → 1 300 l'anneau se trace depuis le
  haut en 3 filets (A 1,6 px, B 1 px, blanc 0,8 px) ; 950 → 2 000 reflet qui fait le tour ; 950 → 1 750 logo ;
- **1 750 → 2 600 ringOut** (courbe `standard`) : l'anneau grandit × 1,4 et s'efface. **Pulsation C** : avant le ringOut,
  tout est voilé à **42 %** sauf un cercle de 200 + 16 px ; au ringOut le cercle s'ouvre jusqu'au coin le plus loin et
  une **onde** (cercle de 400 px mis à l'échelle, halo extérieur, intensité **0,55**, pleine jusqu'à 80 %) roule sur son bord ;
- 1 750 glissement du logo (650 ms, `premium`) ; dès 2 000 les **lettres sortent du logo** toutes les 85 ms (800 ms,
  `vive`, × 0,45 → 1, flou 6 px par copie floue fixe), K au-dessus, masquées à gauche du logo ;
- 2 500 braises ; 2 550 filet A → B ; 2 800 sous-titre (0,32 em) ; repos à 3 400 ; tenue 600 ; passage 600 ms
  (l'ouverture s'efface sur les 55 premiers %, l'accueil arrive sur les 70 derniers %), puis l'**éventail**.
- Le voile est dessiné par le moteur (`uIVeil`) ; sans moteur, par le calque CSS (repli). Clic, Échap, Entrée, Espace : saut à la fin.
- **Éco** : pas d'onde, pas de copie floue. **Réduire** : composition finale tout de suite. **Widget** : sans objet.
  Réglage « Ouverture au lancement » : Pulsation (défaut) · Classique (V1-A sans pulsation) · Aucune.

### 4.2 Liaison A : « l'éventail pivote, puis le deck se déplie » (`src/features/home/fan/`, catalogue `categoryLink`)
Éventail de 5 cartes 210 × 290 (7° par rang, pivot 1 300 px, faces en miroir à droite du centre). Au clic :
rotation de sortie 15° / rang en **850 ms** `bascule` ; les autres cartes s'effacent et se floutent (500 ms, départ
120 ms) ; la carte choisie −30 px × 1,06 puis × 0,6 ; **deck** empilé (±7 / ±4 px, 3,5° par rang, × 0,55, 700 ms
`standard`) ; **dépliage** en carrousel en **700 ms** sur le ressort `liaison` (3,4 %), décalage 70 ms du centre vers
les bords. Étapes 0 / 650 / 1 070 ms. Onglets : regroupement 380 ms puis redépliage ; retour (« Toutes les catégories »)
décalé de 35 ms par rang. Titres : celui qui part sort d'abord (168 ms, `sortie`), l'autre entre à +120 ms (moyen,
`vive`). Échap sur l'éventail = liaison vers la dernière catégorie.
- **Éco** : moteur à 30 i/s, mêmes étapes. **Réduire** : état final direct. **Net** : deck sur `vive`, sans dépassement.
  **Widget** : sans objet.

### 4.3 Onde de changement de thème (`src/features/settings/themeSwap.ts`, `useThemeSwap.ts`, jetons `THEME_SWAP`)
La carte de thème (240 × 150, l'accueil en miniature en CSS) **grandit puis s'écrase** :
- survol × 1,03 (240 ms, `liaison`) ; appui × 1,05 (140 ms) ;
- montée −8 px × 1,10 (0 → 260 ms, `premium`), écrasement +2 px × 0,93 (260 → 380 ms) ; **impact à 380 ms** : onde de
  choc (étalement 18, halo 28, alpha 0,7), 12 étincelles (46 → 82 px), lune × 1,06, recul de la page × 0,993, cadre
  redessiné à 400 ms, coche à 620 ms (pic × 1,35, `rebond`) ; fin à 1 250 ms ;
- à l'impact, une **View Transition** : la nouvelle vue se révèle en cercle depuis la lune (**850 ms**, `standard`),
  l'onde de la pulsation C roule dessus avec un **halo fixe de 40 px** à l'écran (`wave.haloPx`, `--wave-band`).
  Filet de sécurité : `::view-transition { background: var(--bg-bottom) }` (`themeSwap.css`).
- Réglage « Changement de thème » : Onde (défaut) · Fondu · Direct ; re-clic ignoré 1,25 s.
- **Éco** et **Fondu** : la carte grandit et s'écrase, puis la nouvelle page apparaît en **fondu d'image** (View
  Transition en simple fondu, 900 ms, `standard` : `THEME_SWAP.fade`), plus de fondu des variables (`ecoWay: "fade"`).
  **Réduire** / **Direct** : changement immédiat, la coche change. **Widget** : reçoit le thème par les réglages, sans onde.

### 4.4 Déroulé de la Personnalisation avancée (`advancedUnroll.ts`, jetons `ADVANCED_UNROLL`)
Comme le verre du widget : la coque part de × 0,94 / × 0,04 et se déroule sur les ressorts « normale » (vertical 680 ms,
latéral 560 ms), chevron 180° sur le ressort vertical ; lignes à 40 ms puis toutes les **32 ms** (−10 px, opacité
260 ms) ; halo 0,3 ; ce qui suit glisse avec (FLIP) ; le panneau défile pour montrer la section sans faire sortir son
en-tête (`revealPad` 24, `revealTop` 8). Fermeture **220 ms** sur `sortie`, sans cascade.
- **Éco** : sans halo. **Réduire** : direct. **Net** : coque, chevron et lignes sur `vive`. **Widget** : sans objet.

### 4.5 Widget déroulé (`src/features/widget/unroll.ts`, jetons `WIDGET_UNROLL`)
Style unique « Kayro » dérivé du thème (barre `--bg-mid` 88 % en pilule, logo 22 px, panneau `--panel-bg` en 26 px).
Déplier : coque × 0,86 / × 0,04 / −12 px sur les deux ressorts (opacité 60 ms), barre × 1,02 (460 ms), chevron 520 ms ;
halo à 80 ms (700 ms, 0,3), **allumé tant que le panneau est ouvert** ; lignes à 50 / 110 / 170 / 230 ms (−10 px,
520 ms) ; pastilles et icônes × 0,7 → 1 toutes les 35 ms ; reflet à 380 ms (950 ms). Replier : contenu 100 ms, coque à
70 ms pendant 240 ms, effacée sur les 90 dernières ms (310 ms en tout). La fenêtre ne change jamais de taille pendant
l'animation.
- **Éco** : ni halo ni reflet, ressorts gardés. **Réduire** / niveau 2 coupé : direct. Réglages « Dépliage du widget »
  Déroulé (défaut) · Sobre (× 0,94 → 1 + fondu 240 ms, lignes à 30 ms, repli 180 ms) et « Élasticité du widget ».

### 4.6 Passages entre modes en fondu, voile natif (`src/features/modes/passage.ts`, `src-tauri/src/desktop/passage.rs`, `veil_play.rs`)
Fenêtres opaques ; un passage efface la page (**micro 140 ms**, `sortie`), le cœur change la fenêtre pendant le noir
(noir à 0,004, attente de la page 600 ms au plus), puis la page revient (**moyen 360 ms**, `vive`) et les cartes
remontent en cascade (45 ms, +14 px, 12 au plus) ; filet : la page revient seule après 2,5 s.
Entre `main` et le widget, un **voile natif** Win32 (`platform/veil.rs`, une couleur unie, pas de WebView) fait la
jonction : `main` → widget, voile de la couleur de `main` qui s'efface en 0,7 × court = **168 ms** ; widget → `main`,
voile qui monte en court = **240 ms**. Bouton ↗ « Ouvrir en fenêtre » dans le widget.
- **Éco**, **réduire**, niveau 2 coupé : changement direct, sans voile.

### 4.7 Flottaison (`src/features/home/float/`, `fanFloat.ts`, jetons `FLOAT_LEVELS`, `FLOAT_RHYTHM`)
Un sinus par carte (période × 0,90–1,07, départs décalés de 0,6–0,7 s), bascule alternée ; ombre au sol dans le moteur
qui pâlit et se resserre à la montée.

| Niveau | Éventail | Carrousel | Bascule | Période |
|---|---|---|---|---|
| Aucune | 0 | 0 | 0 | — |
| Légère | 2,5 px | 2 px | 0,1° | 7 s |
| **Visible** (défaut) | 7 px | 5 px | 0,8° | 4,4 s |
| Marquée | 12 px | 8 px | 1,4° | 4,8 s |

Carte active du carrousel × 0,7 (`activeGain`) ; survol de l'éventail × 1,15 (`floatHoverGain`) et dérive latérale 4 px.
Pause en 240 ms (survol, molette, défilement rapide, glisser), reprise lente en 1,2 s ; arrêtée sous l'éventail et hors
écran ; boucle à **30 i/s** quand seule la flottaison bouge. **Réduire** : aucune flottaison. **Widget** : sans objet.

### 4.8 Finitions (validées en ronde 5 et à la relecture finale)
- Lettres de l'ouverture : `z-index` décroissant et masque fixe à gauche du logo (`clip-path: inset(-48px -48px -48px -30px)`).
- Éventail en miroir (cartes à droite du centre : texte et lumière à droite), carrousel et éventail descendus de
  `--stage-drop` 22 px (14,3 px d'air sous « Logiciels » survolé).
- Titres de la liaison enchaînés (§ 4.2) ; crayon de la carte active visible seulement au survol ou au focus.
- Scènes en cartes 176 × 246 (comme les apps), quatre actions de 30 px à 8 px d'écart au survol (+4 px de montée),
  barre partagée `TopBarShell` (58 px, marges 24 / 56), colonne de 1 280 px, titre-signature.
- Sélecteur de mode = bouton rond + petit menu ; grille dans la pilule d'onglets ; micro et mains cachés (`app/features.ts`).
- Fondu système de Windows coupé à l'ouverture de la fenêtre immersive (`own_window::set_show_animation`).

---

## 5. Réglages

**Règle : les réglages qui comptent sont visibles ; le reste va dans « Personnalisation avancée ».** Dialogue unique,
onglets verticaux (`src/features/settings/`, textes `src/i18n/fr-settings.json`) :
- **Général** : raccourci (Ctrl+Alt+H), mode économe, Échap cache Kayro, cliquer ailleurs cache Kayro, démarrer avec Windows.
- **Visuel** : Qualité (Auto · Éco · **Équilibré** · Élevé · Ultra) ; Atmosphère (Douce 0,6 · **Normale 1** · Forte 1,3) ;
  Couleurs du jeu (Désactivé · **Léger** · Immersif) ; Mouvement (Complet · **Vivant** · Net) ; Suivre Windows ;
  Mode d'affichage (+ écran du mode immersif) ; puis **Personnalisation avancée** : Flottaison des cartes, Ouverture
  au lancement, Changement de thème, Dépliage et Élasticité du widget, Survol des cartes (**Complet** · Simple ·
  Aucun), Bokeh du fond, Particules, Lumière du curseur, puis les couleurs du jeu : Intensité (Douce · **Normale** ·
  Forte), Caractère (**Comme le thème** · Fidèle à l'affiche · Vive), Couleur principale (**Dominante** · La plus
  vive · Accordée au thème), Passage d'un jeu à l'autre (**Marée** · Fondu · Direct), Moment du changement
  (**Sélection posée** · Tout de suite · Au lancement), Image du jeu en fond (Immersif, **oui**), Apps sans image
  aux couleurs de leur icône (**oui**) ;
  enfin « Revenir aux réglages par défaut » (tout Visuel sauf l'affichage), avec « Annuler » tant qu'aucun réglage
  Visuel n'a été changé ensuite.
- **Thèmes** : grille des 6 cartes 240 × 150 ; un clic applique et joue l'onde.
Défauts : `VISUAL_DEFAULTS` (`settingsModel.ts`), les mêmes que `Settings::default` (`src-tauri/src/config/schema.rs`).

---

## 6. Performance

- **Budget** : p95 de l'intervalle entre images **≤ 5,4 ms**, en Élevée **et** en Éco, mesuré dans l'exe de production
  (2560 × 1440, écran à ~280 Hz). Tenu partout à la remesure du 14/10 (`docs/PERF-ETAPE13.md`) et à l'étape 14
  (`docs/PERF-ETAPE14.md` : 3,7 ms partout, couleurs du jeu comprises).
- **Tolérances acceptées à l'étape 13** (14/10) : au plus 1 image > 8 ms par occurrence d'une signature ; en Élevée, la
  liaison, le retour et les onglets gardent 1 à 2 images de 10 à 14 ms (la tâche du clic) ; l'onde garde 1 à 2 images
  de 15 à 25 ms à l'impact (capture de la View Transition, cachée sous l'image figée) ; aucune image > 16 ms pendant la
  liaison, le retour, les onglets ou le survol.
- **Accepté à l'étape 14** (15/10) : la marée garde 2 images > 8 ms par changement de jeu en Élevée (toutes ≤ 14,3 ms),
  1 en Éco. Ces chiffres dépendent du fond de la machine : une remesure se compare en A/B, avec `--exe`, à un exe
  plus ancien mesuré dans les mêmes conditions.
- **Cadence** (`CADENCE`, `src/fx/budget.ts`) : pointeur seul 60 i/s ; sous un dialogue 30 ; au repos (ambiance seule)
  30 en Élevée et Équilibré ; séquence 60 ; verre qui suit 60. Éco : tout à 30. **Ultra** : non plafonné (≤ 144),
  seul le plafond du dialogue s'applique.
- **Qualités** (`src/design/quality.ts`) : Éco · Équilibré · Élevé · Ultra ; « Auto » = Élevé avec le repli du moteur
  (la qualité Auto adaptative est pour plus tard). Repli du moteur (`budgetWatch.ts`) : affiches → résolution → verre
  par type → moteur entier (CSS). WebGL2 absent, shader refusé, contexte perdu → repli CSS automatique.
- **Banc** : `npm run perf` (`scripts/perf/`, mode d'emploi `scripts/perf/README.md`) sur l'exe de production, données
  de test recréées, `--compare` avant / après, `--trace` ; jamais de capture CDP pendant une mesure.
- Règles fixes : animer `transform` et `opacity` ; pas de `filter: blur()` sur de grandes surfaces ; `backdrop-filter`
  ≤ 6 ; `will-change` seulement si mesuré utile ; aucune boucle qui tourne dans le vide (hub masqué : 0 % de GPU).

---

## 7. Règles pour la suite

1. **Tout par jetons** : une valeur visuelle vit dans `tokens.css`, `motion.css`, la table de mouvement ou le catalogue,
   jamais en dur dans un écran. Une nouvelle courbe va dans `eases.ts`, un ressort dans `SPRINGS` / `springCurves.ts`.
2. **Fichiers < 400 lignes** (hors `src/ipc/bindings.ts`, généré).
3. **Aucune signature** (§ 4) ne change sans décision de l'utilisateur ; un dosage se change par son jeton et se note
   dans `DA-JOURNAL.md` (date, avant → après, jeton, pourquoi).
4. Tout nouvel effet : derrière `FxLayer`, avec repli CSS, coût mesuré par `npm run perf` en Élevée et Éco.
5. **Pistes notées pour l'étape 14** (couleurs du jeu, ambiances par jeu ; les trois premières sont appliquées aux
   couleurs du jeu, § 2 ; la mesure des deux chemins de la liaison passe à l'audit, étape 18) :
   - changer les couleurs **en un recalcul** : variables écrites d'un coup, sans transition déclarée en permanence, sans
     lecture forcée après l'écriture ;
   - **pas de View Transition à chaque changement de jeu** (une capture plein écran = 1 à 2 images lentes) ;
   - **couleurs du moteur par la palette** (`FxPalette`), jamais en relisant le CSS ;
   - liaison et onglets : mesurer les deux chemins (éventail prêt à 0 % d'opacité, ou recalcul allégé au changement
     de thème / catégorie) avec `npm run perf -- --trace … --invalidations` ;
   - les affiches dans le verre (`posterGlass`) : restent éteintes, la planche de l'étape 14 a retenu l'affiche plate
     (V9 c).

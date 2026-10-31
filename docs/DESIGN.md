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
servie par le protocole `kayro-art` (id d'app + rôle, jamais un chemin) ; nom sur `.posterShade`. **Plaque de nom**
(verre sans flou, 30/10) : marge `--plate-pad` 6 / 12 px (grille 5 / 10), bord 1 px, reflet haut 1 px. Sinon :

**Faces sans affiche** (cartes d'apps, de scènes, éventail) : dégradé A → B du thème tiré par carte, 0,85, bout sombre
× `--face-foot` 0,28, ombre de pied sous le nom, icône du programme sinon la lettre. Aux couleurs de l'icône : mêlées
au thème à 35 % seulement (`ICON_FACE`, revue du 29/10) : le thème domine, une seule teinte à l'écran.

**Tramage** (revue du 29/10) : le fond et le verre du moteur ajoutent un bruit fixe de ± ½ niveau 8 bits : plus de
bandes dans les dégradés sombres.

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

**Thèmes perso** (étape 15, `src/design/themes/derive.ts`, Réglages › Thèmes › « Mes thèmes ») : 2 couleurs + un
curseur de fond donnent un thème entier par la règle des 6 thèmes : accent, cartes, voile 1 = A ; faisceau, lueur,
voile 3 = B ; texte doux = A +0,12 de clarté, ½ chroma ; fonds à la teinte de A, L 0,215 / 0,165 / 0,127, chroma de
0,01 (Neutre, comme Encre) à 0,052 (Teinté). A borné L 0,72–0,84, C ≤ 0,12 ; B L 0,62–0,82, C ≤ 0,14 ; si une paire
de texte passe sous 4,5:1, la clarté de A (puis sa chroma) bouge vers la valeur lisible la plus proche. Fichiers
`themes/perso-*.json` (≤ 20), import par dépôt d'un `.json`, export dans le dossier `exports`.

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
- **Calcul** (`derive.ts`, `palettePick.ts`, revue du 29/10) : les couleurs brutes de l'affiche et du héros (OKLab,
  `palettes.json`) sont groupées en **familles de teintes** (écart ≤ 32°, poids = surface × chroma, héros × 0,5) ;
  A = la plus forte famille, B = la suivante si elle pèse ≥ 22 % de la première, sinon l'accent à 25° au moins de A
  (une image d'une seule couleur prend l'accent de l'autre image du jeu, sinon du thème) ; une affiche sans couleur
  prend la couleur qui parle pour elle (`characterOf`) ; bornées comme les thèmes
  (L 0,72–0,85, C ≤ 0,12) puis mêlées au thème à **85 %** sur le cercle des teintes (`mixLch` : jamais de gris
  entre deux teintes éloignées). Contraste ≥ 4,5:1 testé sur les 6 thèmes.
- **Ce qui se teinte** (réglage `color_mode`, **Stylisé** par défaut) : l'ambiance du moteur (fond, lune, anneau, bokeh,
  braises, teinte du verre des cartes et des pastilles, prise dans la palette : `FxPalette.card`) et les accents de
  l'accueil (`--game-a`, `--game-b` : filet du titre, filets de survol ; anneau de focus réécrit avec eux), posés
  sur 3 conteneurs (`data-game-accents`), jamais sur `:root` : texte, dialogues et Réglages restent au thème.
  Depuis la revue du 29/10, la nuit prend aussi la teinte du jeu (55 % de la pleine teinte, `LIGHT_NIGHT`).
  **Immersif retiré le 30/10** (décision de l'utilisateur : « c'est moche ») : le réglage n'a plus que Désactivé ·
  **Stylisé** (l'ancien « Léger »), un ancien `immersive` est lu comme Stylisé ; ni héros flouté ni carte des couleurs
  en fond (la texture du héros ne sert plus qu'au fond des cartes spéciales).
- **Passage d'un jeu à l'autre : la marée** (`paletteTween.ts`, shader du fond) : 180 ms après que la sélection se
  pose (rien pendant une rafale), les nouvelles couleurs partent de la carte active en cercle, **700 ms**, courbe
  `standard`, bord doux 90 px et bande de lumière (0,55, pleine jusqu'à 80 %) ; sans View Transition ; les accents
  changent une fois, quand le bord atteint le titre. Premier affichage, thème, réglage : changement direct.
  « Réduire les animations » : direct. Repli CSS : lune et anneau en fondu, nuit du jeu sur `Backdrop`.
- **Sortie des jeux** (éventail, autre écran) : retour au thème par la même marée. **App sans image** : face et
  ambiance aux couleurs de son icône. **Carte active avec affiche** : le nom en petit (13 px, centré) sans plaque, le
  verre de la plaque s'efface (fondu micro) ; le logo du jeu n'y est plus affiché depuis le 30/10 (il doublait le
  titre de l'affiche).
- **Variantes** (Personnalisation avancée, § 5) : intensité 35 / 60 / 100 %, caractère (comme le thème, fidèle,
  vive), couleur principale (dominante, la plus vive, accordée au thème), passage (marée, fondu 600 ms, direct),
  moment (sélection posée, tout de suite, au lancement seulement), couleurs de l'icône.
- **Par app** (dialogue de modification, panneau « Apparence », enregistré tout de suite) : ses images (affiche,
  fond, logo : déposer une image sur une case, « Retirer » rend celle de Steam) et ses couleurs (Automatiques ·
  Choisies : A et B parmi les couleurs de ses images, bornées et mêlées comme les autres · Thème : jamais teintée).

**Ambiances et cartes spéciales** (étapes 16–17, détail dans `docs/AMBIANCES.md`) : l'app sélectionnée peut porter
une ambiance `.hubmood` (6 packs, sur mesure, importées) que le moteur dessine avec ses sprites, derrière le verre, aux
couleurs A / B du jeu ; anneau de glyphes et pulsation autour de la carte active (`setFocusTarget`). Parts par qualité
`MOOD_SHARE` (Éco 0, Équilibré 0,6, Élevé 1, Ultra 1,25), fondu `MOOD_FADE` 350 / 650 ms. **Carte spéciale** (art
local de l'utilisateur) : fond flouté, personnages de part et d'autre de la carte active (centre libre), ombres
teintées par A, liseré de lumière B, pieds et bord extérieur fondus, logo sous la carte (`SPECIAL`). Rien avec
« Couleurs du jeu » désactivé ; « réduire » : image fixe ; moteur coupé : ambiance en Canvas 2D, pas de carte spéciale.
**Séquence de lancement** (30/10, `launch: "seal"` dans l'ambiance, `SEAL`) : le jeu est lancé tout de suite derrière
Kayro, qui reste devant tout (couverture, `desktop/cover.rs`) ; une scène WebGL2 joue pendant ce temps (encre, cercle de
runes au sol en perspective, sceau vertical, flammes en aplats 3 tons, braises, carte en 3D) jusqu'à l'arrivée de la
fenêtre du jeu (4,6 à 10 s), puis le final (feu, carte qui brûle, pilier, éclair, noir) et Kayro se cache ; un clic ou
une touche saute au final ; « réduire les animations » : lancement direct. Second style, `launch: "gommage"` (Clair
Obscur, `GOMMAGE`, palette `PAINT`, 3ᵉ version : la 1re améliorée) : clair-obscur (lumière dorée en rayons qui tombe
d'en haut sur la carte, poussière), cinq coups de pinceau à l'huile (brosse plate, fin effilochée en poils secs,
éclairés par le faisceau) dont un trait cramoisi derrière la carte, monolithe lointain à la tête brisée, « 33 » peint en
cramoisi et fines fissures dorées, coins dorés Art nouveau, pétales lumineux au vent (dorés dans le faisceau, quelques-uns
flous), nom en or gravé ; la carte s'efface en pétales. Fin de la couverture : quand une nouvelle grande fenêtre du jeu
apparaît (≥ 20 % de l'écran), mise au premier plan à la fin.

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

**Survol 3D** (revue du 29/10, `cardTilt.ts`, `CARD_TILT` et `FAN_TILT_MAX` dans `tokensReview.ts`) : la carte
s'incline vers le curseur jusqu'à **6°** (cartes et éventail ; plafond 8° avec le balancement de l'éventail, 2,5°),
lissée sur la boucle d'images (constante 90 ms en suivant, 190 ms au retour), sans transition CSS. Le moteur dessine
le verre, l'affiche et les lumières de la carte **inclinés de la même façon** (perspective 900 px, `uQ` / `untilt` /
`tiltN` dans `glassShader.ts`) ; le côté qui vient vers soi prend un reflet doux. Repli CSS : seul le DOM s'incline.

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
Éventail de 5 cartes 210 × 290 (7° par rang, pivot 1 300 px, faces en miroir à droite du centre). Chaque catégorie a
son **emblème** au trait fin (étape 16a, `CategoryEmblem.tsx` : manette et braises, mât et ondes, plume, deux fenêtres,
constellation ; `--fan-emblem` 66 px, copie géante à `--fan-mark-alpha` 0,09 vers le coin opposé), qui bouge une fois au
survol ou au focus (niveau 3, `transform` / `opacity`, rien au repos). Au clic :
rotation de sortie 15° / rang en **850 ms** `bascule` ; les autres cartes s'effacent et se floutent (500 ms, départ
120 ms) ; la carte choisie −30 px × 1,06 puis × 0,6 ; **deck** empilé (±7 / ±4 px, 3,5° par rang, × 0,55, 700 ms
`standard`) ; **dépliage** en carrousel en **700 ms** sur le ressort `liaison` (3,4 %), décalage 70 ms du centre vers
les bords. Étapes 0 / 650 / 1 070 ms. Onglets : **ronde** (`fanDance.ts`) : les cartes quittent leur place pour un anneau
en perspective large comme la scène (demi-largeur 92 % de la carte la plus éloignée, fond 92 px plus haut, × 0,84
devant, × 0,5 au fond, penchées de 5°), en font un tour ensemble en se croisant, et retombent à leur place ; vague de
45 ms de gauche à droite, 1 250 ms par carte (réglage `danceMs`, 0 = regroupement 380 ms puis redépliage) ; puis
**atterrissage** (30/10, `IMPACT`, `DANCE.lead`) : la carte du milieu quitte l'anneau 240 ms avant les autres, avance
× 1,09 / −12 px en descendant avec un tremblement de ±2 px (440 ms), s'écrase × 0,94 en arrivant (190 ms ; les couleurs
du jeu changent alors) et se pose (440 ms) pendant que les autres virevoltent encore, juste après la dernière (1,54 s) ; retour (« Toutes les catégories »)
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

### 4.5 b Kysland, l'île (étape 20 : `src/features/island/`, `src-tauri/src/desktop/island/`)
Remplace le widget (la barre et le panneau du 4.5 y reviendront avec les fonctions). Noir pur #000, sans verre.
**Sur le bord haut** (sous la barre des tâches si elle est en haut) : au centre, encoche 184 × 32, coins du haut carrés,
épaules concaves de 10 px ; **glissée** le long du bord (ressort 900 / 0,9, elle traîne en gelée, inclinaison ≤ 12°),
elle se range au centre ou dans un **coin haut** : à ras du bord haut et du bord de côté (épaule le long du bord haut et
le long du côté, seul le coin bas intérieur arrondi). Survol + 20 × 4 et filet de la teinte en bas. **Décrocher** : tirer
vers le bas (résistance, l'encoche s'étire en goutte) jusqu'à 56 px, gouttes qui tombent. **Flottante** : capsule
176 × 44, contour 1,5 px de la teinte, ombre courte (plus de lueur extérieure : coupée par la région de clic, elle faisait un voile carré) ; suit la main (ressort 1400 / 0,86),
penche (± 7°) et s'étire (≤ 7 %) avec la vitesse. **Teinte** : bleu neige (#D6ECFF) sur un écran sombre, bleu encre
(#1C3454) sur un écran clair, selon la clarté mesurée autour de l'île (une moyenne, rien n'est gardé). **Bord d'écran** :
elle s'y écrase sans jamais déborder sur l'écran voisin. **Passage d'un écran à l'autre** (réglage « Passage de
Kysland », aussi dans l'île ouverte) : **Forcer** (défaut) — poussée au-delà de 110 px, elle passe par le bord dans une
gerbe de bulles pleines de la teinte qui la suivent en partie (sillage, ≈ 1,3 s, fondu avant le bord de la fenêtre) ;
**Capri** (nom affiché ; valeur `glitch`) — aucune résistance, elle peut rester à cheval sur deux écrans, et le bord entre eux « glitche » autour
d'elle : pics dentelés (rouge #FF1F4D pailleté de blanc, vert néon #3DFF7A, noir cerné de violet #8B3DFF), fantômes
rouge et vert, tranches décalées, redessinés par images tenues (≈ 14 i/s), plus fort quand elle est centrée sur le bord.
Les pics vivent **sur le bord** : une couche native transparente aux clics (`platform/overlay.rs`, sans WebView) les
montre là où ils sont nés ; quand l'île s'en va, ils y restent et s'effacent (jamais coupés). Laissée à cheval, le bord
glitche encore doucement (niveau 0,3) avec un sursaut toutes les 1,4–4 s. En « Glitch », l'accroche, le décrochage et le
rangement dans un coin font aussi jaillir des pics du bord haut, vers le bas. **Sons** : ceux de Kysland, deux jeux
(Forcer : ronds, en verre ; Glitch : numériques, hachés, secs) ; les styles et familles de Réglages › Sons ne les
changent pas, seuls « Sons » et le volume s'appliquent. **Raccrocher** : lâchée à moins de 90 px du haut
(aimant : son haut se carre déjà), elle rejoint la place la plus proche (gauche, centre, droite), ressort 520 / 0,7 avec
un dépassement dans le bord, son « clac » et gouttes au contact. **Au repos** (`IslandRest.tsx`) : avec une musique, l'île s'élargit de 44 px — à gauche la pochette en petit disque
qui tourne (7 s par tour, à l'arrêt en pause, trou central), à droite 5 barres de la couleur d'accent de l'album qui
suivent le rythme (son de sortie écouté en direct, 5 bandes, ~30 i/s ; animation de secours si l'écoute est impossible) ;
l'île « respire » sur les basses (± 3 %) ; au survol, une lueur intérieure aux couleurs de l'album (rien hors de l'île). Une app qui démarre l'élargit de
130 px 2,4 s (logo et nom). Au survol, accrochée seulement, s'il y a des apps ouvertes, elle grandit de 26 px vers le bas : leurs logos
apparaissent un à un (un clic met l'app au premier plan). Nouveau morceau : la pochette arrive en glissant, petit sursaut
(un glitch en « Glitch »). **Ouverture** : un clic l'ouvre en panneau noir 420 × 180 (coins 28 px, à ras du bord et du
coin où elle est accrochée ; flottante près d'un bord, elle se décale pour tenir à l'écran), ressort 300 / 0,76, contenu
en fondu en fin de croissance : recherche (apps et scènes qui ne ferment rien, 3 résultats, flèches et Entrée), carte
musique (pochette 84 px — clic : lecture/pause —, titre, artiste, ligne de progression, triangles aux coins arrondis),
bouton rond « Passer en immersif » (4 flèches vers les coins) ; champ de recherche sans contour (il s'éclaircit). Ouverte, elle prend le clavier ; elle se referme sur Échap, en perdant le
focus, ou 0,7 s après que la souris l'a quittée (sauf recherche en cours). Fenêtre fixe 720 × 420, région de clic découpée à
l'île au repos, jamais de cadre de Windows. Aucune boucle au repos ; masquée devant un programme en plein écran sur son
écran. **Éco** : sans bulles, gouttes ni glitch. **Réduire** : ressorts sans dépassement, sans bulles ni glitch (aucun
clignotement).

### 4.5 c Capri hors de l'île (étape 20 : `src/features/capri/capri.ts`)
Le même dessin partout (pics : rouge #FF1F4D pailleté de blanc, vert #3DFF7A, noir #07070A cerné de violet #8B3DFF ;
images tenues 70 ms). **Installeur** : sur les écrans d'accueil et de démarrage, un petit écran 260 × 170 au bord noir
remplace l'éventail : l'île y sort du bord, joue la musique, éclate en Capri (3,6 s et 7 s), s'ouvre puis se referme
(boucle 9 s) ; « Kysland » se déchire en rouge et vert pendant les éclats. **Page de mise à jour** et **Nouveautés**
(`CapriSheet`) : carte noire 500 px, contour violet 1,5 px, éclat Capri de 0,9 s au bord haut à l'ouverture puis un
petit (0,42 s, vers le haut seulement) toutes les 2,6 s ; titre Cormorant 38 px déchiré pendant les éclats ; puces en
éclats rouges et verts ; bouton noir cerné de violet, rouge et déchiré au survol. **Réduire** : aucun éclat, aucune
déchirure.

### 4.6 Passages entre modes en fondu, écran de réveil (`src/features/modes/passage.ts`, `src-tauri/src/desktop/passage.rs`, `wake.rs`)
Fenêtres opaques ; un passage efface la page (**micro 140 ms**, `sortie`), le cœur change la fenêtre pendant le noir
(noir à 0,004, attente de la page 600 ms au plus), puis la page revient (**moyen 360 ms**, `vive`) et les cartes
remontent en cascade (45 ms, +14 px, 12 au plus) ; filet : la page revient seule après 2,5 s.
Depuis le 2026-10-31, plus de mode Widget : Kysland est à l'écran dès que Kayro est fermé et part quand il s'ouvre
(sans voile). Le **voile natif** Win32 (`platform/veil.rs`, une couleur unie, pas de WebView) sert d'**écran de
réveil** : démarré avec Windows sur l'intro ou l'immersif, l'écran passe au noir de `main` (#06060C) avec « Kayro »
(1/14 de la hauteur) et « se réveille… » (1/60), puis s'efface en **280 ms** (ease-in-out) une fois Kayro peint ;
il part de toute façon après 20 s.
- **Éco**, **réduire**, niveau 2 coupé : passage direct ; l'écran de réveil reste (un fondu d'opacité seul).

### 4.7 Flottaison (`src/features/home/float/`, `fanFloat.ts`, jetons `FLOAT_LEVELS`, `FLOAT_RHYTHM`)
Un sinus par carte (période × 0,90–1,07, départs décalés de 0,6–0,7 s), bascule alternée ; ombre au sol dans le moteur
qui pâlit et se resserre à la montée.

| Niveau | Éventail | Carrousel | Bascule | Période |
|---|---|---|---|---|
| Aucune | 0 | 0 | 0 | — |
| Légère | 4 px | 3 px | 0,4° | 6 s |
| **Visible** (défaut) | 10 px | 7 px | 1,1° | 4,6 s |
| Marquée | 15 px | 11 px | 1,8° | 5 s |

Dérive latérale (revue du 29/10) : 0,3 × l'amplitude, sur un sinus 1,63 fois plus lent (`FLOAT_RHYTHM.driftShare`,
`driftPeriod`) : chaque carte décrit une boucle douce. Ombre pleine à 30 px crête à crête.

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
- **Général** : raccourci (Ctrl+Alt+H), mode économe, Échap cache Kayro, cliquer ailleurs cache Kayro, démarrer avec Windows,
  puis (étape 18b) « Rechercher les mises à jour au démarrage » (**non** par défaut ; l'installeur maison le propose coché)
  et « Rechercher une mise à jour ». Fenêtre **« Mise à jour disponible »** : versions (l'ancienne en petit, → , la
  nouvelle en Cormorant), nouveautés dans un encart à puces ✦, barre au dégradé du logo pendant le téléchargement.
- **Visuel** : Qualité (Auto · Éco · **Équilibré** · Élevé · Ultra) ; Atmosphère (Douce 0,6 · **Normale 1** · Forte 1,3) ;
  Couleurs du jeu (Désactivé · **Stylisé**) ; Mouvement (Complet · **Vivant** · Net) ; Suivre Windows ;
  Mode d'affichage (+ écran du mode immersif) ; puis **Personnalisation avancée** : Flottaison des cartes, Ouverture
  au lancement, Changement de thème, Dépliage et Élasticité du widget, Survol des cartes (**Complet** · Simple ·
  Aucun), Bokeh du fond, Particules, Lumière du curseur, puis les couleurs du jeu : Intensité (Douce · **Normale** ·
  Forte), Caractère (**Comme le thème** · Fidèle à l'affiche · Vive), Couleur principale (**Dominante** · La plus
  vive · Accordée au thème), Passage d'un jeu à l'autre (**Marée** · Fondu · Direct), Moment du changement
  (**Sélection posée** · Tout de suite · Au lancement), Apps sans image
  aux couleurs de leur icône (**oui**) ;
  enfin « Revenir aux réglages par défaut » (tout Visuel sauf l'affichage), avec « Annuler » tant qu'aucun réglage
  Visuel n'a été changé ensuite.
- **Sons** (étape 17b, `SoundsSection.tsx`) : Sons de l'interface (**oui**), Style (**Premium** · Rétro · 8-bit),
  Volume (**40 %**) dessiné comme l'**onde** du son du style (44 barres arrondies dans un champ, éclairées au dégradé du
  logo jusqu'au volume, plus hautes avec lui ; une lumière traverse l'onde quand le son joue ; `VolumeWave.tsx`), puis
  « Quand en jouer » : Interface, Changement de catégorie, Lancement d'un jeu. Chaque choix se fait entendre.
- **Thèmes** : grille des 6 cartes 240 × 150 ; un clic applique et joue l'onde.
Défauts : `VISUAL_DEFAULTS`, `SOUND_DEFAULTS` (`settingsModel.ts`), les mêmes que `Settings::default` (`src-tauri/src/config/schema.rs`).

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

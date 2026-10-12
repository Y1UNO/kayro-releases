# Propositions avant le gel de la DA (passe du 2026-10-12)

Passe en lecture seule sur `step-12b-atelier-da` (dernier tag `da-fix-c`). Aucun code modifié, rien de commité.
Lu : `DA-JOURNAL.md`, `reference/animations/`, `tokens.ts`, `tokens4b.ts`, `tokens.css`, les CSS des écrans.
Vu dans l'exe de production (`target\release\Kayro.exe`, build 21:12, tes données : 2 apps, 1 scène, thème Lavande-pêche,
2560×1440 à 150 %, aucun jeu lancé) : ouverture, éventail, survol, liaison, carrousel, onglet, catégorie vide, recherche,
grille, réglages, ajout d'apps, écran Scènes, éditeur. Captures prises à ~3 images/s (une capture plein écran prend
~130 ms) : les instants cités sont approximatifs. Captures supprimées après la passe. **Non lancés** : le mode fenêtre et
le widget (ils réécrivent ton réglage d'affichage) ; le widget est jugé sur son CSS et la maquette.
Les choix protégés (ouverture V1-A + pulsation C, liaison A, « Vivant intelligent », widget déroulé, voile natif, 6 thèmes)
ne sont jamais remplacés ci-dessous, seulement affinés.

Budget image : p95 ≤ 5,4 ms. Aucune proposition n'ajoute de `filter`, de `backdrop-filter` ni de boucle au repos.

---

## 1. Le bokeh : des taches d'objectif à transformer en lumière

**Constat.** Sur tous les écrans (éventail, carrousel, Scènes, éditeur), 12 disques gris de 30 à 110 px flottent sur
le fond : disque plein, bord dur un peu plus clair, couleur désaturée. À l'œil ce sont des taches ou des bulles de savon
sales, pas des points de lumière hors foyer. C'est la première chose qu'on remarque sur une capture et ça fait « pas
fini ». Cause dans le code : `scene.ts` (mélange A→B à 0,14 d'intensité) et le sprite `kind 2` de `bgShader.ts`
(`a = smoothstep(1, .86, r) × (.55 + .45 × smoothstep(.55, .95, r))` = disque plat à anneau), dessiné en additif.

**Proposition** (élément `bokeh`, moteur seulement) :
- forme : disque doux + anneau fin, comme un vrai bokeh d'objectif :
  `a = 0.55 × exp(−r² × 2.2) + 0.45 × smoothstep(.80, .93, r) × (1 − smoothstep(.95, 1, r))` ;
- couleur : mélange A→B **éclairci de 35 % vers le blanc** (sinon l'additif à faible alpha vire au gris) ;
- réglages d'`actif.json` : `count` 12 → **7**, `size` 56 → **120**, `intensity` 0,14 → **0,09**, zone `18 / 60` →
  **`8 / 80`** (ils ne s'alignent plus sur une bande) ; respiration inchangée ;
- Éco : 4 bokeh (déjà « moitié des particules »).

**Pourquoi.** Le fond garde sa profondeur (grands disques flous derrière, étoiles nettes devant) sans que rien ne
ressemble à une salissure ; la parallaxe de la 2b devient lisible.

**Coût** : petit (un sprite, trois valeurs). **Perf** : nulle (même passe, 5 sprites de moins).

**Pour décider** : réglage à comparer dans l'exe après recompilation, avec `bokeh.on` à l'arrêt comme témoin ; ou
A/B dans l'atelier (élément `bokeh`), écran Accueil.

---

## 2. Une seule grille de rayons et un seul style de « petit titre »

**Constat.** `tokens.css` définit une gamme (10, 14, 16, 20, 22, 26, 30, 36, pilule), mais 41 déclarations en dur
vivent à côté : 12 (« Toutes les catégories », raccourci, éditeur), 13 (segments sm, interrupteur), 18 (bouton sm,
scène du widget), 19 (recherche, boutons ronds sm, segments md), 23 (champ de la palette, bouton md, panneau du
widget), 23,6 (logo), 24 (éventail, carte vide), 28 (bouton md, carte), 31 / 32 (barre et panneau du widget).
Dans la barre du haut, « Toutes les catégories » (r 12, bord) voisine la recherche (r 19) et les boutons (r 19) :
trois rayons pour trois objets de 38 px. Même chose pour les petits titres en capitales : **CATÉGORIE** 13 / 600 /
0,32 em accent, **CHOISIS UN UNIVERS** 11 / 700 / 0,32 em, sous-titre de l'ouverture 12 / 700 / 0,32 em,
**ÉTAPES · 6**, **AJOUTER UNE ACTION**, **EMPLACEMENTS DE LA SCÈNE** 12 / 700 / 0,16 em… rendus en **Cormorant**
(ce sont des `h2`, et `index.css` met `h1, h2, h3` en police de titre) alors que les autres sont en Manrope. Les titres
du widget sont encore une quatrième variante.

**Proposition.**
- Quatre familles de rayons, rien d'autre : **pilule** (`--radius-pill`) pour tout ce qui fait ≤ 46 px de haut
  (boutons, boutons ronds, segments, recherche, onglets, puces, raccourci, badges LANCER / ATTENDRE, « Toutes les
  catégories ») ; **rangée / champ** `--radius-md` 16 (lignes de liste, champs, plaque de nom, tuiles) ; **panneau**
  `--radius-2xl` 26 (dialogues, palette, panneaux latéraux, étapes de l'éditeur, panneau du widget) ; **carte** 30
  (`cards.radius`), 24 pour l'éventail (210 px de large) et la carte vide. Supprimer les valeurs en dur.
- Un jeton `--eyebrow` : Manrope **12 px / 700 / 0,24 em / capitales / `--text-soft`** (plus la ligne
  `font-family: inherit` sur ces `h2`). Appliqué partout ; seule exception, le sous-titre de l'ouverture garde
  0,32 em (signature).
- Une seule taille de petit texte secondaire : `--fs-13` `--text-2` (les « Aucune app », « 1 app », « Délai fixe »,
  « Catégorie » de la palette, aides des réglages).

**Pourquoi.** C'est ce qui fait « système » quand on passe d'un écran à l'autre : mêmes arrondis, mêmes petits
titres, l'œil ne recalibre pas à chaque dialogue.

**Coût** : petit (CSS seulement, ~45 lignes touchées). **Perf** : nulle.

**Pour décider** : une planche « grille des rayons et petits titres » (une colonne par famille, un exemple de chaque
écran), puis capture avant / après dans l'exe (pas de réglage d'atelier : c'est du CSS).

---

## 3. Dialogues : un verre qui se lit, une hauteur qui tient dans l'écran

**Constat.** Le dialogue « Affichage et raccourci » est en verre flouté : le titre « Jeux » (92 px) et la carte
passent sous « Affichage et raccourci » et « Mode d'affichage » (capture) : du texte sur du texte. Il est aussi trop
haut : « Démarrer avec Windows » touche le bord bas, le panneau chevauche la barre d'onglets. À côté, « Ajouter des
applications » (variante `wide`) est à 92 % opaque : deux matières pour un même composant (`Dialog.module.css`,
`.panel.wide` seul a `--_bg: rgba(18,13,28,.92)`).

**Proposition.**
- Un seul panneau de dialogue : `--_bg: var(--glass-highlight), rgba(18, 13, 28, .92)` pour **tous**, sans
  `backdrop-filter` (le flou reste pour les surfaces fines : barre du haut, onglets, dock, palette).
- `max-height: calc(100vh − 2 × var(--space-14))`, en-tête fixe, corps défilant (`overflow: auto`, barre fine).
- Scrim 0,55 → **0,62**.
- Entrée inchangée (niveau 2 : moyen, ×0,96 → 1, +14 px, sortie 0,7×).

**Pourquoi.** Le dialogue redevient un objet posé devant la scène, pas une vitre à travers laquelle on lit deux
choses à la fois ; plus aucun débordement quel que soit l'écran.

**Coût** : petit. **Perf** : un `backdrop-filter` de moins (gain).

**Pour décider** : capture avant / après dans l'exe, dialogue des réglages ouvert sur le carrousel.

---

## 4. Scènes et éditeur dans le langage de l'accueil (les scènes deviennent des cartes)

**Constat.** L'écran Scènes est une rangée de 1 900 px : nom à gauche, quatre boutons ronds à l'extrême droite, le
reste vide (capture). Sa barre du haut est une autre barre que celle de l'accueil (64 px, titre serif 30 px, sans logo,
sans recherche), avec des marges 28 / 40 au lieu de 24 / 56. L'éditeur étire chaque étape sur 1 430 px, poignée à
1 400 px du numéro ; la maquette `Editeur.dc.html` fait 1 049 px de large. Le retour depuis Scènes renvoie à
l'éventail, pas au carrousel qu'on vient de quitter.

**Proposition.**
- **Conteneur centré `max-width: 1280px`** pour Scènes, l'éditeur simple et l'éditeur avancé ; marges 24 / 56 comme
  l'accueil ; colonne latérale 380 px conservée.
- **Les scènes en cartes** : mêmes cartes que les apps (176 × 246, r 30 × 0,73 ≈ 22, verre du moteur, dégradé A→B par
  scène, lettre ou icône de la première app, plaque de nom, « 6 étapes » en `--fs-13`), en grille ; ▶, ✎, exporter,
  supprimer apparaissent au survol / focus comme le ✎ des apps. Le dock garde ses pilules.
- **Même barre du haut** (`TopBar`, 58 px) sur les sous-écrans : « ‹ Scènes » ou « ‹ Accueil » à la place de
  « Toutes les catégories », recherche conservée, boutons Tester / Enregistrer à droite ; le titre de la scène prend
  la place du titre de catégorie (eyebrow « SCÈNE », nom en 48 px `--fs-title-lg`, même filet A→B).
- Étapes : poignée **à gauche** du numéro, badges en pilule, carte à `--radius-2xl`.
- Retour de Scènes → le carrousel quitté (animation « in » de l'onglet), l'éventail seulement au lancement.

**Pourquoi.** Kayro traite ses scènes comme ses jeux : c'est la chose qu'aucun lanceur ordinaire ne fait, et c'est un
écran de moins à apprendre. Le titre-signature (eyebrow + serif + filet) devient le fil de tous les écrans.

**Coût** : moyen (cartes de scènes et barre partagée) ; petit pour le conteneur et les étapes. **Perf** : ≤ 8 cartes
verre visibles, sous le plafond de 24 formes du moteur ; aucune boucle.

**Pour décider** : planche « Scènes en cartes » (liste à 1, 3 et 8 scènes) + planche « éditeur centré » avec la barre
partagée.

---

## 5. Le widget au thème : un style Kayro au lieu de quatre identités

**Constat.** `Widget.module.css` est marqué « PROVISIONAL LOOK ». Les quatre styles ignorent les 6 thèmes du logo :
« Brume » = la pêche de l'ancien Crépuscule en dur (`#ffb98a`, `#ffd2b0`), « Sillage » = un vert `#3ddc97` plat et
carré (r 12), « Orbe » = noir `#07080b` et bleu `#8a98ff`, « Aurore » = `#9d92ff`. Trois d'entre eux remplacent
le logo par un carré ou une bille de couleur. Seul le halo du dépliage lit `--grad-a`. Sur Lavande-pêche, le widget est
donc orange sur un hub lavande ; sur Cuivre ou Opale il n'a rien à voir avec le reste. Les rayons (31, 32, 20, 18) sont
hors gamme (prop. 2).

**Proposition.** Un seul style « Kayro », dérivé du thème, qui garde tout le mouvement validé (déroulé, ressorts,
halo, reflet) :
- barre : fond `color-mix(in srgb, var(--bg-mid) 88%, transparent)` (fenêtre transparente : opaque à 88 %, pas de flou),
  bord `--glass-border`, ombre `0 6px 14px rgba(0,0,0,.32)`, rayon pilule, logo de la marque 22 px + « Kayro » en
  `--font-title` 26 / 500 ;
- onglet actif `--fill-tab-active`, bouton principal `--accent` / `--text-on-accent`, pastille « ouvert »
  `--accent-light` (mêmes jetons que l'accueil) ;
- panneau : `--w-panel-bg` = `var(--glass-highlight), color-mix(in srgb, var(--bg-mid) 92%, transparent)`, rayon
  `--radius-2xl`, rangées `--radius-md`, champ 46 px pilule ;
- le réglage « Style du widget » disparaît (ou garde « Kayro » seul, les autres revenant plus tard comme thèmes du
  widget tirés du même catalogue).

**Pourquoi.** Le widget est la face de Kayro quand le hub est caché : c'est là que la cohérence avec le thème se
voit le plus, et c'est la seule surface encore « d'avant » la DA.

**Coût** : petit à moyen (un bloc de variables, retrait d'un réglage). **Perf** : nulle.

**Pour décider** : planche « widget Kayro » (barre fermée + panneau déplié) sur trois thèmes : Lavande-pêche,
Bleu-gris, Cuivre.

---

## 6. Barre du haut et dock : retirer ce qui est mort, ranger ce qui est rare

**Constat.** Trois boutons grisés en permanence : micro et mains dans la barre du haut, micro dans le dock (voix et
mains sont hors périmètre). Le sélecteur Immersif / Fenêtre / Widget occupe le centre-droit de la barre pour une action
rare, déjà dans les réglages. Le crayon ✎ est affiché en permanence sur la carte active (seule tache d'interface sur la
carte). Le bouton « grille » est un rond isolé à 14 px de la pilule d'onglets.

**Proposition.**
- Retirer micro et mains de la barre et du dock (réapparaîtront derrière un réglage quand la fonction existera).
- Mode d'affichage : un seul bouton rond « mode » (icône de la fenêtre) qui ouvre un petit menu `Overlays.menu`
  (niveau 1, micro), ou rien dans la barre puisque les réglages l'ont. La barre garde : logo, « Toutes les
  catégories », recherche, +, réglages.
- ✎ : `opacity 0`, visible au survol de la carte active et au focus clavier (`--m1-court`, apparition) ; F2 inchangé.
- Bouton grille **dans** la pilule d'onglets, à droite, séparé par `--separator` comme le dock (même verre, même
  hauteur), icône qui bascule.

**Pourquoi.** Moins d'objets, tous vivants : la barre redevient logo · recherche · deux actions. Un lanceur « premium »
n'affiche pas ce qu'il ne sait pas encore faire.

**Coût** : petit. **Perf** : trois boutons verre de moins (gain).

**Pour décider** : planche barre du haut + dock, avant / après, carrousel en fond.

---

## 7. Cartes sans affiche : une vraie face, et des filets qu'on voit

**Constat.** En production `posterUrl` renvoie `null` : toutes tes cartes sont du verre nu avec une lettre, le fond et
l'anneau passent à travers (capture : l'anneau traverse la carte « Lossless Scaling »). Le cache d'icônes existe
(`%APPDATA%\Kayro\cache\icons`, ~90 PNG) mais le carrousel montre la lettre. Au survol, les filets A→B (1,8 px,
intensité 1,4) sont presque invisibles sur une carte lavande claire : sur la capture on ne voit que deux étincelles ;
la lumière du curseur (`cursorLight` 0,3 / 300 px) fait un rond blanc au centre de la carte comme une lampe torche.
La carte vide « Ajouter une app » (150 × 180, r 24) n'a la taille d'aucune autre carte.

**Proposition.**
- **Face sans affiche** = celle de l'éventail : dégradé du thème A→B par app (teinte `--k` existante), opacité 0,85,
  retrait 3 px dans le verre ; icône du programme 84 px (cache d'icônes) sinon la lettre ; le verre reste le rebord.
  L'anneau ne traverse plus la carte, la lumière du curseur ne s'y voit que sur le rebord (comme en 2a).
- **Filets** : cœur blanc à 55 % + halo couleur, largeur 1,8 → **2,2 px**, intensité 1,4 → **1,8**, `threadGlow`
  0,7 → **0,9**, longueur 0,14 → **0,2** ; mêmes réglages sur l'éventail.
- Carte vide : taille d'une carte latérale (176 × 246, r 22), dégradé en pointillé.

**Pourquoi.** 100 % des cartes aujourd'hui, et toutes celles de tes amis demain, sont « sans affiche » : c'est la face
qu'on voit le plus. Et le niveau 3 coûte des étincelles pour rien si on ne le voit pas.

**Coût** : petit (CSS de la face, 4 valeurs de `categoryHover`) ; moyen si on branche les icônes du cache dans le
carrousel. **Perf** : nulle (le dégradé DOM existe déjà en repli).

**Pour décider** : dans l'exe, `glassCards.tint` et `fill` ne suffisent pas → recompilation puis capture carrousel +
éventail ; planche « face sans affiche » à 3 apps (icône / lettre / affiche) pour choisir.

---

## 8. Finitions des signatures : première image, lettres, éventail, titres de la liaison

**Constat** (rafale sur l'exe).
- **Première image** : à ~700 ms après le lancement, une capture montre l'écran d'avant (une vidéo) sous un voile
  sombre, avec le halo de l'ouverture déjà dessus ; à 1 057 ms tout est opaque. La page fond son fond de 0 → 1 en
  700 ms sur une première image pas encore opaque : un flash de bureau, à confirmer en rafale à 30 ms.
- **Lettres** : les dernières lettres passent **devant** les premières (« y » sur « a » à 2 709 ms) et le petit « o »
  est visible à gauche du K avant d'avoir rejoint sa place : on voit le mécanisme au lieu de « le logo distribue le nom ».
- **Éventail** : à droite, « Logi|ciels » et « Aut|re » sont à moitié sous le bord de la carte de devant ; à gauche rien
  n'est masqué (capture au repos). L'éventail occupe le tiers haut (centre à 43 % de la hauteur), le tiers bas est vide,
  et rien ne dit « Entrée / Échap ».
- **Liaison** : à ~540 ms, « Que veux-tu lancer ? » et « Jeux » sont lisibles en même temps, CHOISIS UN UNIVERS et
  CATÉGORIE se chevauchent (fondu croisé pur).

**Proposition** (chronologies V1-A, C et liaison A inchangées).
- `body` opaque dès l'image 0 (`--bg-bottom`), seuls dégradé et halo fondent en 700 ms ; fenêtre montrée après la
  première image peinte (`visible: false` puis `show()` sur l'événement « prête » de la page, comme `opening_due`).
- Lettres : `z-index` décroissant (K au-dessus, o dessous), conteneur des lettres masqué à gauche du bord droit du logo
  (`clip-path: inset(0 0 0 X)` posé une fois, pas animé) : elles sortent vraiment de derrière.
- Éventail : étiquettes **en miroir** pour les rangs à droite du centre (`align-items: flex-end`, texte à droite),
  faces symétriques ; stage descendu de 60 px (centre à ~49 %) ; ligne d'aide `--fs-13` `--text-3`
  « Entrée · ouvrir   Échap · dernière catégorie » qui apparaît après 1,5 s d'inactivité (micro, apparition) et
  s'efface au premier mouvement.
- Liaison : le titre de l'éventail **sort d'abord** (0,7 × court = 168 ms, courbe sortie, −20 px), le titre de
  catégorie entre à +120 ms (moyen, apparition, +14 px) ; symétrique au retour. Deux pistes dans `fanTimeline.ts`
  (`ask.o`, `ask.y` et leurs jumelles), pas de nouveau jeton.

**Pourquoi.** Ce sont les quatre endroits où l'œil attrape une « couture » dans ce qui est par ailleurs la partie la
plus réussie de Kayro.

**Coût** : petit (quatre retouches indépendantes). **Perf** : nulle ; la première image en est même une de moins.

**Pour décider** : rafale à 30 ms sur l'exe (lancement, 2,6–3,0 s, liaison 0,4–0,7 s) avant / après ; l'éventail au
repos en capture. Les écrans rejouables de l'atelier (« Ouverture », « Catégories ») servent pour l'A/B si tu veux.

---

## Idées de fonctionnalités pour plus tard (hors DA)

- **Écran Apparence** : aucun sélecteur de thème dans l'app aujourd'hui (`themeId` n'est lu que dans `settings.json`) ;
  grille des 6 thèmes + importer / exporter, comme la maquette `04-apparence`. Retirer les 5 anciens thèmes au gel.
- **Affiches en production** : `posterUrl` renvoie `null` hors dev ; dossier local d'affiches + ajout par
  glisser-déposer sur une carte.
- **Icônes du cache dans le carrousel** et la palette (aujourd'hui la lettre).
- **Fil lumineux** (`GlideThread`, déjà écrit) pendant « Recherche de vos applications… » et « Chargement de vos
  données… » (règle R4b : jamais de texte seul au-delà de 400 ms).
- **Échap dans l'éditeur** ne fait rien ; retour « ‹ Scènes » seulement.
- **Catégories vides dans l'éventail** : option « masquer les univers vides » (3 cartes sur 5 disent « Aucune app »).
- **Message de lancement raté dans le widget** (limite notée en 4b-1b).
- **Raccourci clavier pour la grille** (G) et pour le dock (chiffres 1–9 → scènes).
- **Exporter les logs** depuis les réglages (prévu par les conventions, absent de l'écran).

## Méthode et limites de cette passe
- Rien mesuré : les coûts annoncés sont des estimations ; toute proposition retenue se mesure à l'étape 13.
- Captures à ~3 images/s : les instants d'animation sont à ±150 ms.
- Mode fenêtre et widget non vus en vrai (réglage utilisateur), jugés sur le code et les maquettes.
- Données de test : 2 apps sans affiche, 1 scène aux emplacements non reliés ; un dépôt plus garni montrerait d'autres
  états (deck à 5 cartes, grille pleine, dock long).

---

# Compléments (mêmes règles : lecture seule, rien de commité)

## A. Les six thèmes : le plus faible, un remplaçant, les contrastes

### Le plus faible : Mauve
- **Trop proche du défaut actuel** : accent 298° contre 256° pour Lavande-pêche, fonds presque identiques (260° / 248°,
  même valeur 10 %). Sur l'éventail et les cartes, les deux thèmes se lisent « violet sur nuit violette ».
- **Dégradé monochrome** : A `#C99ACB` (298°) → B `#9476C2` (264°) : les cinq cartes de l'éventail vont du mauve au
  violet, sans le second ton qui fait vivre les autres thèmes (Lavande → pêche, Opale → rose, Cuivre → vieux rose).
  C'est le seul thème dont le filet A→B sous le titre et l'onde de l'ouverture n'ont qu'une couleur.
- **Contrastes les plus bas de la série** (sans être sous le seuil) : accent sur fond 8,3:1, texte sur accent 7,9:1.
- Sakura est son voisin chaud (348°), Lavande son voisin froid : la gamme n'y perd rien.

### Remplaçant proposé : « Encre »
Le noir manquant à la série, tiré du logo : la pêche du logo comme accent, le dégradé du logo **inversé** (pêche → lavande)
sur un fond d'encre presque neutre, légèrement froid. Distinct de tout le reste (le seul fond sans teinte), et c'est le
thème « OLED » que des amis réclameront.

| Champ | Valeur |
|---|---|
| `id` / `name` | `encre` / **Encre** |
| `bg` | `["#15151B", "#0C0C10", "#060608"]` |
| `accent` | `#F6A98A` (pêche du logo) |
| `gradient` A → B | `["#F6A98A", "#B7A2F2"]` (logo inversé) |
| `soft` | `#F3DCCF` |
| `glow` | `rgba(183,162,242,.30)` (lune lavande) |
| `fog` A / B / C | `rgba(246,169,138,.26)`, `rgba(246,169,138,.12)`, `rgba(183,162,242,.14)` |
| `card` / `beam` | `[246,169,138]` / `[183,162,242]` |
| `description` | « Encre et pêche, le noir du logo. » |

Contrastes calculés (formule WCAG, même méthode que `contrast.test.ts`) : texte 17,0:1, texte doux 14,9:1, accent 10,2:1,
texte sur accent 9,6:1. Faces de l'éventail : 2,6 (A) et 3,0 (B), comme les autres thèmes (voir ci-dessous).
Défaut : **Bleu-gris**, comme demandé (`theme_id` par défaut dans `schema.rs`, `initial-value` des `@property` de
`tokens.css` et `DEFAULT_THEME` dans `themes/index.ts` à aligner tous les trois).

### Contraste du texte, thème par thème (texte `#f6efe8` ; seuil 4,5:1)

| Thème | texte / fond | doux / fond | accent / fond | accent clair / fond | texte sur accent | texte 2 sur verre | face A (blanc) | face B (blanc) |
|---|---|---|---|---|---|---|---|---|
| Lavande-pêche | 17,2 | 13,2 | 8,8 | 12,4 | 8,3 | 12,3 | **3,0** | **2,6** |
| Mauve | 17,0 | 13,1 | 8,3 | 11,9 | 7,9 | 12,3 | **3,1** | 4,8 |
| Sakura | 17,0 | 14,8 | 11,6 | 14,3 | 11,0 | 12,3 | **2,3** | **4,1** |
| Bleu-gris | 16,7 | 13,7 | 8,9 | 12,4 | 8,6 | 12,3 | **2,8** | 4,7 |
| Opale | 16,4 | 15,2 | 11,3 | 13,9 | 11,1 | 12,3 | **2,2** | **2,6** |
| Cuivre | 16,9 | 13,4 | 8,0 | 11,6 | 7,7 | 12,3 | **3,2** | 4,6 |
| Encre (proposé) | 17,0 | 14,9 | 10,2 | 14,7 | 9,6 | 12,3 | **2,6** | **3,0** |

Lecture : tout ce qui est couvert par `contrast.test.ts` tient largement sur les six. **Le seul point faible est commun
à tous** et n'est pas testé : le texte blanc des faces de l'éventail (nom 19 / 700, « Aucune app » 13 px) posé sur le
dégradé A à 0,85 : 2,2 à 3,2:1, sous le seuil, pire sur les thèmes clairs (Opale, Sakura). Même risque pour la face
sans affiche de la proposition 7. Correctif commun, sans toucher aux couleurs : une **ombre de pied** sur la face
(`linear-gradient(180deg, transparent 55%, rgba(8,5,12,.55))`, comme `posterShade` des cartes), qui remonte
le nom à ≥ 4,5:1 sur les six thèmes ; et ajouter la paire « nom sur face » à `contrastPairs`.

---

## B. Réglages « Visuel » et « Thèmes », et l'onde de changement de thème

### B1. Structure, à partir de ce qui existe
Réglages déjà dans `Settings` (`schema.rs`) : `theme_id`, `quality`, `color_mode`, `hotkey`, `language`,
`atmosphere_intensity` (0,3–1), `display_mode`, `widget_style`, `hide_on_escape`, `hide_on_blur`, `economy_mode`,
démarrage avec Windows. Aujourd'hui l'écran n'expose que mode, écran, style du widget, raccourci, économe, Échap, clic
ailleurs, démarrage : **qualité, couleurs du jeu, intensité et thème n'ont aucune interface.**

Un dialogue de réglages à colonne gauche (comme la maquette `04-apparence`), trois entrées : Général · Visuel · Thèmes.
Tu en voulais deux ; « Général » reçoit ce qui n'est ni visuel ni thème, sinon ça retombe dans « Visuel ».

**Visuel** (dans cet ordre, du plus utile au plus fin) :
1. *Qualité* — segments **Auto · Éco · Équilibré · Élevé · Ultra** (`quality` + le repli automatique de l'étape 13 ;
   « Auto » = Élevé avec repli). Aide : « Auto baisse d'un cran si l'image devient lente. »
2. *Mouvement* — segments **Complet · Vivant · Net** (= niveaux 3 / 2 / 1 de la table `motion`) ; interrupteur
   **Suivre « réduire les animations » de Windows** (activé par défaut ; désactivé = Kayro ignore le réglage système).
3. *Atmosphère* — curseur **Intensité** 30–100 % (`atmosphere_intensity`) ; segments **Particules : Aucune · Légères ·
   Normales** (braises / étoiles / bokeh à 0, ½, 1 des comptes du catalogue) ; interrupteur **Lumière du curseur**
   (`cursorLight.on`).
4. *Couleurs du jeu* — segments **Désactivé · Léger · Immersif** (`color_mode`, texte de la maquette).
5. *Affichage* — Mode d'affichage, Écran du mode immersif (déplacés depuis l'écran actuel ; style du widget retiré,
   proposition 5).

**Thèmes** :
- Grille de cartes **240 × 150** (16:10), rayon `--radius-2xl`, 3 colonnes ; une carte par thème, une carte pointillée
  « Créer le mien » (plus tard) ; sous la grille, **Importer un thème** / **Exporter le mien** (le format JSON existe déjà).
- La carte = l'accueil en miniature, **en CSS seulement** (pas de moteur, pas de flou) : les variables du thème sont
  posées sur la carte (`style={themeVariables(theme)}`), ses enfants lisent `var(--bg-*)`, `var(--grad-*)` :
  fond dégradé + halo radial en haut, trois mini-cartes A→B (30 × 42, la centrale 36 × 50 avec sa lueur), une pilule de
  barre en haut, un trait de titre, le filet A→B. Nom du thème 15 / 600 et description 13 / `--text-2` sous la vignette.
- Thème actif : coche dans un disque `--accent`, bord `--accent-light` ; focus clavier = anneau de la table.
- Un clic applique (pas de bouton « Appliquer »), et joue l'onde ci-dessous.

**Général** : raccourci, Échap cache, cliquer ailleurs cache, mode économe, démarrer avec Windows, langue (plus tard),
exporter les logs, à propos.

### B2. L'onde de changement de thème : valeurs
Tout vient des jetons existants ; la carte de thème est un moment de choix, donc elle emprunte au niveau 3 **pour le
relâché seulement** (comme la carte d'app).

| Instant | Quoi | Valeur |
|---|---|---|
| survol | la carte grandit | `scale` 1 → **1,03** (`--m-card-grow`), `--m2-court` 240 ms, courbe déplacement `liaison` (3,4 %) ; bord `--accent-light` ; sortie 168 ms, apparition |
| appui | impact | `scale` 1,03 → **0,94** (`--m-press`) en `--m1-micro` 140 ms, courbe apparition |
| relâché (t = 0) | rebond | 0,94 → **1** sur **`rebond`** (6,6 %) en `--m-court` 240 ms ; c'est la chute de 9 % puis le dépassement qui font l'« impact » |
| t = 0 | onde | cercle de **400 px** centré sur la carte, `scale` 1 → 2 × D / 400 (D = distance au coin le plus loin), **850 ms**, courbe **`standard`** `(.4, 0, .2, 1)` = le ringOut de la pulsation C ; pleine jusqu'à **80 %** puis s'efface ; bande 5,5 % de r, intensité **0,55**, couleur A du **nouveau** thème (`OPENING_C` tel quel) |
| t = 0 | révélation | cercle `r` de r₀ (demi-diagonale de la carte ≈ 142 px) → D, **mêmes 850 ms, même courbe** : l'onde roule sur le bord du cercle, comme dans C ; le nouveau thème est à l'intérieur |
| t = 850 ms | fin | page entière au nouveau thème ; la carte garde sa coche |

Durée totale après le clic : 850 ms (+ 140 ms d'appui avant). Pendant l'onde, pas d'autre effet décoratif (règle 1) :
le reflet du titre et le voile de la carte active attendent la fin.

### B3. Technique recommandée : View Transitions pour la page, le moteur bascule sa palette d'un coup
**Recommandation : `document.startViewTransition`** (Chromium ≥ 111, donc WebView2 evergreen ; à vérifier à l'exécution
par `"startViewTransition" in document`, sinon repli = fondu actuel). Le moteur WebGL ne dessine **pas** la révélation :
il reçoit la nouvelle palette instantanément et le navigateur fait le cercle sur toute la page, canvas compris.

Pourquoi pas le moteur seul : le cercle du paquet C (`uIVeil`) ne couvre que ce que le moteur dessine (fond, halo,
anneau, particules, verre). Barre du haut, onglets, boutons, textes, dégradés des cartes sont des couleurs CSS : ils
changeraient par le fondu croisé global de 0,9 s, pas au passage de l'onde, et la couture se verrait sur chaque pilule.
Pour que **tout** bascule au bord du cercle, il faut deux images de la page entière : c'est exactement ce que fournit
View Transitions (instantané de l'ancienne vue + nouvelle vue vivante), sans écrire deux DOM. Un mélange moteur +
View Transitions n'apporte rien de plus, puisque l'instantané contient déjà le canvas.

Déroulé :
1. Au relâché : `startViewTransition(() => { applyTheme(nouveau, instant = true); engine.setPalette(p) sans son
   minuteur de 1 s ; posture finale de l'onde })`. `instant = true` coupe les transitions de `:root` (sinon la
   nouvelle vue ferait **aussi** un fondu de 0,9 s).
2. Le navigateur fige l'ancienne vue (`::view-transition-old(root)`, image fixe, moteur compris) et compose la nouvelle
   (`::view-transition-new(root)`, vivante : le moteur continue d'y dessiner la nouvelle palette à sa cadence).
3. CSS : `::view-transition-old(root) { animation: none }`, `::view-transition-new(root) { animation: tv-circle 850ms
   cubic-bezier(.4,0,.2,1) }` avec `clip-path: circle(r₀ at X Y)` → `circle(D at X Y)` (X, Y, r₀, D posés en variables
   avant d'appeler la transition). Bord net, voulu : c'est l'onde qui le couvre.
4. L'onde est un `div` fixe persistant (opacité 0 au repos) portant `view-transition-name: theme-wave` : elle devient
   son propre groupe, **au-dessus et hors du cercle** (les groupes ne sont pas découpés par la racine). Ancien état :
   `scale(1)` sur la carte ; nouvel état : `scale(2D/400)` ; `::view-transition-group(theme-wave) { animation-duration:
   850ms; animation-timing-function: cubic-bezier(.4,0,.2,1) }`, image ancienne masquée, opacité par images-clés
   (1 jusqu'à 80 %, 0 à 100 %). Même dessin que `Opening.tsx` (halo extérieur seul, `transform` et `opacity`).
5. `transition.finished` : onde remise à 0, minuteur de relecture du thème inutile.

Le canvas pendant la transition : rien à faire de spécial. Il est dans l'instantané (ancienne vue) et continue sous
la nouvelle. Deux précautions : le moteur ne doit pas redimensionner son canvas pendant les 850 ms (pas de changement
de fenêtre à ce moment, déjà vrai) ; au bord du cercle, les particules de l'image figée et celles qui vivent ne
coïncident pas (quelques pixels), la bande de l'onde (5,5 % de r, jusqu'à ~70 px) couvre la couture. À vérifier le
premier jour : que l'instantané contient bien le WebGL dans WebView2 (sinon ancienne vue noire → repli fondu).

Effet de bord utile : pendant une View Transition la page ne reçoit pas de pointeur (850 ms) : pas de double clic.

### B4. Coût probable par image
- **Première image** (capture de l'ancienne vue 2560 × 1440 + mise en page) : une image lente, estimation 8–15 ms,
  acceptée par ta règle. C'est le seul pic.
- **Pendant** (850 ms) : composition de deux couches plein écran + `clip-path` (GPU, pas de repeinture) + un élément
  d'onde en `transform` / `opacity` + le moteur à son coût normal : **+0,5 à 1 ms** de GPU par image, fil principal
  inchangé. p95 attendu ≤ 4,5 ms, sous 5,4. Rien n'est repeint par image (contrairement au voile CSS du paquet C).
- Après : rien (plus de minuteur de 1 s pour relire le thème).
- À mesurer : `?bench=transition` avec un cycle de thèmes, Élevée et Éco, exe de production.

### B5. Éco, réduire les animations, widget
- **Éco** : pas de View Transition ; `applyTheme` normal = fondu croisé des variables de `:root` (0,9 s, existant),
  moteur relu après le fondu comme aujourd'hui. La carte garde survol et appui (coût nul), pas d'onde.
- **Réduire les animations** : changement **direct** (`applyTheme(instant)`), `--m-rm` = 0 donc ni survol agrandi
  ni rebond, seulement la coche qui change.
- **Mode widget** : le widget est une autre fenêtre ; il reçoit `themeId` par les réglages (`WidgetApp.tsx`) et fait
  son fondu de 0,9 s ; aucune onde (les cartes de thème ne sont pas dans le widget). En mode fenêtre, l'onde joue dans
  la fenêtre (D = ses coins).
- Repli : `startViewTransition` absent, moteur en repli CSS ou transition déjà en cours → fondu de 0,9 s.

# Relecture finale avant le gel de la DA (2026-10-13)

Passe en lecture seule sur `step-12b-atelier-da`, dernier tag `da-r5-3`. Aucun fichier de code modifié, rien de commité.

**Lu** : `docs/DA-JOURNAL.md` (ronde 5, correctifs, points ouverts), `docs/PROPOSITIONS-DA.md`, les trois notes
`reference/animations/R5-notes/r5-notes/R5-*.txt`, le diff complet `da-fix-c..da-r5-3` (154 fichiers).

**Vu dans l'exe de production** (`target\release\Kayro.exe`, build du 13/10 01:30, tes données : 1 app, 1 scène, thème
Lavande-pêche, 2560×1440 à 150 % = page 1707×960, aucun jeu lancé, débogage WebView2 local pour ce seul lancement) :
éventail au repos, carrousel, survol et crayon, anneau de focus clavier, Réglages Général · Visuel · Thèmes, deux
changements de thème (Encre puis Bleu-gris) en rafale de captures à ~100 ms, personnalisation avancée ouverte, écran
Scènes et retour, mode fenêtre (1280×760). Captures de la page Kayro seulement, supprimées à la fin. Thème remis à
Lavande-pêche et mode immersif remis par l'interface ; `settings.json` vérifié identique à l'original (empreinte SHA-256).
**Non vus en vrai** : le widget, Éco, « réduire les animations », « Net », l'éditeur, le mode fenêtre sous 1280×760 :
jugés sur le code. L'image blanche du premier changement de thème n'est pas apparue sur les 2 changements capturés.
**Incident de fin de passe (hors DA)** : `Kayro.exe --quit` n'a pas fermé l'instance lancée avec le débogage WebView2
(deux demandes reçues, journal « second instance: asked to quit », fenêtre et page toujours vivantes après 15 s). Pas de
fermeture forcée : Kayro est resté ouvert, à quitter par « Quitter » de la zone de notification. À revérifier sans
débogage (la mesure de 241 ms du 12/10 était sans).

---

## A. À corriger avant le gel

### A1. Le menu « Personnalisation avancée » se déroule hors champ
- **Où** : `src/features/settings/AdvancedSection.tsx:72-76` (lecture du `dy`, `play(openSteps(…))`),
  `src/features/settings/Settings.module.css:48-54` (`.scroll`).
- **Ce qui se passe** (mesuré dans l'exe, 1707×960) : l'en-tête est à 747–793 px, le corps défilant s'arrête à 815 px,
  la région dépliée occupe 805–1482 px et `scrollTop` reste à 0 : **667 px de la section sont sous le bord**. On voit le
  chevron tourner et la barre de défilement grandir, pas le déroulé rebondissant (c'est pourtant la seule animation de
  cet écran). Même chose en Éco et avec « réduire les animations ».
- **Correction** : juste après `play(openSteps(…))`, faire défiler le corps pour montrer la section et la ligne
  « Revenir aux réglages par défaut » : `below.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" })`
  (le panneau porte déjà `scroll-padding`? non : ajouter `scroll-padding-bottom: var(--space-6)` sur `.scroll`). À la
  fermeture, rien à faire (le FLIP remonte ce qui suit). Si on veut que le déroulé soit vu entier sans défiler, l'autre
  option est de placer « Personnalisation avancée » avant « Affichage au lancement » (la ligne la plus haute de
  Visuel), mais la note R5 met l'affichage en haut : je garde le défilement.

### A2. L'impact d'une carte de thème déborde du panneau : barre de défilement qui clignote, carte rognée
- **Où** : `Settings.module.css:48-54` (`.scroll` : `overflow-y: auto` rend `overflow-x` automatique aussi),
  `Settings.module.css:216-221` (`.themes`, 6 px de marge), `src/features/settings/ThemeCard.module.css:203-218`
  (`.sparks`), `src/design/motion/tokens5.ts:95` (étincelles 46–82 px).
- **Ce qui se passe** (mesuré) : au clic sur Encre (colonne de droite, 35 px d'air), la largeur défilable passe de 799 à
  **846 px** et la hauteur visible de 617 à **610 px** pendant ≈ 0,7 s : une barre horizontale apparaît sous la grille
  pendant la montée (×1,10 = +12 px) et les étincelles, puis disparaît. Colonne de gauche (8 px d'air) : la montée et son
  ombre portée (`drop-shadow` 28 px) sont **coupées net** sur le bord gauche pendant 260 ms (capture à 121 ms sur
  Bleu-gris). L'onde, elle, n'est pas rognée (groupe de View Transition).
- **Correction** : l'onglet Thèmes tient en hauteur (330 px sur 617) : il n'a pas besoin de défiler. Dans
  `SettingsDialog.tsx:88-93`, poser `data-tab={tab}` sur le corps, et dans `Settings.module.css` :
  `.scroll[data-tab="themes"] { overflow: visible; }`. Plus rien n'est coupé, aucune barre. Pour Général et Visuel,
  rien ne déborde horizontalement, mais par sûreté `.scroll { overflow-x: hidden; }` (une barre horizontale n'a jamais
  de sens ici).

### A3. Le crayon de la carte active relance la flottaison sous le pointeur et éteint les filets
- **Où** : `src/features/home/Carousel.tsx:211-219` (`onPointerOver` : `closest("[data-stage]")`).
- **Ce qui se passe** (mesuré) : le crayon est dans la boîte de flottaison, mais il n'est pas dans `[data-stage]` :
  survoler le crayon donne `card = null`, donc `fx.pointer(null)` (filets et voile s'éteignent) et `float.hover(null)`
  (la flottaison repart : **58 écritures de `transform` en 1 s** sur la boîte, −4,85 px mesurés). Le bouton qu'on vise
  se met à bouger avec la carte, et la carte perd son survol tant qu'on est sur le crayon.
- **Correction** : viser l'emplacement, pas le bouton :
  `const slot = (e.target as Element).closest<HTMLElement>("[data-app-id]"); const card = slot?.querySelector<HTMLElement>("[data-stage]") ?? null;`
  puis `fx.current?.pointer(card)` et `float.current?.hover(card)`. Test unitaire à ajouter dans `carouselFloat.test.ts`
  (survol d'un enfant de la boîte = survol de la carte).

### A4. Deux boucles qui tournent dans le vide (règle « aucun timer qui tourne dans le vide »)
- **a. La flottaison du carrousel tourne sous l'éventail.** `src/features/home/float/carouselFloat.ts:119-125` ne
  s'arrête que pendant une séquence (`data-seq`). En phase « choisis un univers », les emplacements du carrousel sont
  posés à opacité 0 par la liaison, et la boucle continue : **59 écritures en 2 s** mesurées sur un emplacement à
  `opacity: 0`, plus `setGlassFloat` et la mesure du cadre de verre par le moteur à chaque image.
  **Correction** : `useCarouselFloat(stage, dragging, active)` reçoit `active` = la page n'est pas sur l'éventail
  (`HomeScreen` le sait : `startOnFan` / phase de la liaison) et passe `amp: active ? level.carousel : 0` (la boucle
  s'arrête d'elle-même, `stop()` remet les boîtes à zéro). Variante sans prop : `LinkDirector.render` pose
  `stage.dataset.offstage = ""` en phase `choose` et l'enlève en `spread` ; `tick` le traite comme `seq` **et** coupe
  l'abonnement (`this.stop()`), `refresh()`/`hover()` le relancent.
- **b. L'éventail garde sa boucle avec « Flottaison : Aucune ».** `src/features/home/fan/fanFloat.ts:283`
  (`busy()` : `if (c.floatRest > 0 || c.floatHover > 0) return true;`). `floatHover` vaut 6 px par défaut
  (`actif.json`), donc `busy()` est vrai même à « Aucune » : la boucle de l'éventail tourne à 30 i/s tant que l'éventail
  est à l'écran, pour écrire cinq transformations identiques (`put` les ignore, le calcul reste).
  **Correction** : `if (c.floatRest > 0) return true;` et, dans la boucle sur les cartes,
  `if (tw.to > 0 && (c.threads || c.sparks > 0 || c.sway > 0 || c.floatHover > 0) && !c.reduced) return true;`.
  Test dans `fanFloat.test.ts` : `float: "none"`, aucune carte survolée → `busy()` faux.

### A5. « Mouvement : Net » promet « sans rebond ni effet », cinq endroits rebondissent encore
- **Où** : `src/design/motion/tokens.ts:131-139` (Net ne change que `ease.move` et `ease.bounce` de la table) ;
  `src/features/settings/advancedUnroll.ts:24-26` (ressorts `SPRING_V/H`, `ROW_SPRING` lus en direct) ;
  `src/features/settings/themeSwap.ts:35-37` (`easing()` lit `EASES` par nom : « liaison » pour la pose, « rebond »
  pour la coche et le recul) ; `src/features/home/fan/fanFloat.ts:79` (`hoverSpring` « léger » de l'éventail),
  `fanFloat.ts:80-91` (burst, filets, étincelles de l'éventail sans test de Net) ; `src/features/home/fan/fanTimeline.ts:68`
  (ressort « liaison » du deck) ; texte `src/i18n/fr-settings.json:48`.
- **Ce qui se passe** : en Net, le carrousel et la grille sont bien nets (`cardHoverFx.ts:72-74`), mais le menu
  déroulant des réglages rebondit (5 %), la carte de thème se pose avec 3,4 % de dépassement et sa coche saute (6,6 %),
  la page recule sur « rebond », les cartes de l'éventail gardent ressort, filets, étincelles et flash au survol, et le
  deck de la liaison rebondit. Le réglage se contredit lui-même sur l'écran qui sert à le choisir.
- **Correction** (un drapeau `crisp` passé là où la table ne va pas) :
  - `openSteps(rows, dy, eco, speed, crisp)` : si `crisp`, coque, chevron et lignes sur `EASES.vive` (apparition) ;
  - `themeSwap.easing(name, crisp)` : si `crisp`, « liaison » et « rebond » → `EASES.vive` ; `useThemeSwap` lit
    `currentMotion().style` ;
  - `hoverConfig(v, eco, reduced, crisp)` : si `crisp`, `bounce: 0`, `burst: 0`, `sparks: 0`, `threads: false`
    (soulèvement, inclinaison et flottaison restent) ;
  - `linkConfig(v, eco, crisp)` : `spring: crisp ? curveOf(EASES.vive) : (t) => springAt(t, bounce)` ;
  - le widget garde ses propres réglages (Dépliage, Élasticité) : l'écrire dans l'aide de « Mouvement »
    (« Net : sans rebond ni effet dans le hub ; le widget suit ses propres réglages »).

### A6. « Affichage au lancement » change le mode tout de suite
- **Où** : `src/features/settings/VisualSection.tsx:101-110`, `src/i18n/fr-settings.json:57-60`,
  `src-tauri/src/desktop/modes.rs:113-116` (`settings_changed` → `mode_changed` dès que `display_mode` change).
- **Ce qui se passe** : le libellé dit « au lancement », la fenêtre bascule à l'instant (c'est d'ailleurs pourquoi le
  bouton « Revenir aux réglages par défaut » l'exclut). Le bouton rond de la barre fait la même chose avec le bon nom
  (« Mode d'affichage »). Deux noms pour une seule action.
- **Correction** (texte seul) : libellé « Mode d'affichage », aide « Change tout de suite ; c'est aussi le mode au
  prochain lancement. Immersif : … ». Si tu veux vraiment un mode « au lancement » distinct, c'est un champ de plus dans
  `schema.rs` (`launch_mode`) : pas avant le gel.

### A7. Les cartes de scènes ignorent « Survol des cartes »
- **Où** : `src/features/scenes/SceneCard.module.css:54-56` (`.card:hover` soulève toujours), `ScenesScreen.tsx`
  (`<ul className={cards.grid}>`).
- **Ce qui se passe** : « Survol des cartes : Aucun » coupe le soulèvement du carrousel et de la grille
  (`data-hover-off`), pas celui des cartes de scènes, qui se présentent pourtant comme les cartes d'apps.
- **Correction** : dans `ScenesScreen`, `data-hover-off={useDa((s) => s.values.cardHover?.style === "none") || undefined}`
  sur le `ul`, et `.card:hover:not([data-hover-off] *)` dans `SceneCard.module.css` (même règle que `AppCard.module.css:93`).

### A8. Filet de sécurité pour l'image blanche du premier changement de thème
- **Où** : `src/design/themeSwap.css:9-13`.
- **Ce qui se passe** : point ouvert du paquet 1 (une capture CDP blanche hors du cercle, non reproduite ; pas revue sur
  mes 2 changements). Si l'instantané de l'ancienne vue manque une image, le pseudo-élément racine `::view-transition`
  n'a pas de fond : c'est blanc.
- **Correction** (sans coût, sans effet quand tout va bien) : `::view-transition { background: var(--bg-bottom); }`.
  Une image manquée devient une image de nuit, invisible derrière l'onde. Le protocole de l'étape 13 reste à faire.

### A9. « Annuler » après « Revenir aux réglages par défaut » écrase aussi ce qu'on a réglé ensuite
- **Où** : `src/features/settings/VisualSection.tsx:35`, `:55-59`, `:133-146`.
- **Ce qui se passe** : l'instantané pris au clic reste proposé tant que le dialogue est ouvert ; si on change la
  qualité après la remise à zéro puis qu'on clique « Annuler », ce changement part aussi.
- **Correction** : `useEffect(() => { if (undo && !isVisualDefault(settings)) setUndo(null); }, [settings, undo]);`
  (dès qu'un réglage Visuel quitte la valeur par défaut, l'annulation n'a plus de sens).

### A10. Risque de perf à mesurer à l'étape 13 : la flottaison du carrousel repeint la carte à chaque image
- **Où** : `src/features/home/AppCard.module.css:52-57` (`.float`, sans promotion), `carouselFloat.ts:155`
  (`transform` écrit par script à 30 i/s, 60 au survol).
- **Ce qui se passe** : un `transform` écrit par script sur un élément non composité fait réinvalider la peinture de la
  carte (dégradés, lettre, plaque) à chaque image ; l'éventail, lui, est promu (`CategoryFan.module.css:22, 42, 54`).
  Avec 5 cartes à l'écran c'est le premier candidat aux images perdues en navigation.
- **Correction** : `will-change: transform` sur `[data-float]` **seulement pendant que la boucle tourne** (posé par
  `CarouselFloat.start`, retiré par `stop()`/`rest()`), puis mesure p95 avec et sans (règle « `will-change` seulement si
  mesuré utile »). Symétriquement, l'éventail pourrait relâcher ses `will-change` quand `floatRest === 0` (« Aucune »).

### A11. Nettoyage avant le gel (sans effet visible, mais à faire avant d'écrire DESIGN.md)
- `src/design/presets/actif.json:281-283` : `floatRest` et `floatPeriod` n'existent plus dans le catalogue
  (`categoryHover.float` les remplace) ; `floatHover: 6` est mort à « Visible » et « Marquée » (6 < 7 et 12 : voir B3).
- `src/i18n/fr-settings.json:113-117` : `settings.themes.label` et `settings.themes.active` ne sont lus nulle part.
- `src/features/settings/ThemeCard.tsx:35` : `title={theme.description}` affiche l'info-bulle native de Windows (seul
  endroit de l'app hors `Tooltip`) ; la retirer, ou passer par `Tooltip`. `ThemeCard.tsx:57` : `rx="25"` pour un cadre
  de 26 − 1,2 + 1,5 ≈ 26,3 px : mettre 26.
- `AdvancedSection.tsx:39`, `useCarouselFloat.ts:20`, `useThemeSwap.ts:133` testent `settings.quality === "eco"` alors
  que le CSS lit `data-quality` : quand « Auto » saura redescendre en Éco (étape 13), ces trois tests ne le verront pas.
  Passer par `effectiveQuality()` ou lire `document.documentElement.dataset.quality` dès maintenant.
- Déjà listés dans le journal : 5 anciens thèmes et alias `mauve`, `widgetStyle` gardé dans le schéma, éléments
  « historique » et « croquis » du catalogue.

---

## B. Affinages de dosage (8, par les jetons ; aucune signature validée n'est changée par défaut)

### B1. L'onde du changement de thème : un halo fixe de 40 px, pas 5,5 % du rayon
- **Constat** (rafale Encre, 792 ms) : l'anneau est mis à l'échelle avec son halo ; près des coins (r ≈ 1 000 px) la
  bande fait ≈ 55–70 px et devient une traînée floue, alors que la note demande « trait fin + halo 40 px ». Le journal
  note l'écart.
- **Jetons** : `THEME_SWAP.wave` (`tokens5.ts:99`) + `haloPx: 40` ; `themeSwap.css` enregistre
  `@property --wave-band { syntax: "<number>"; inherits: false; initial-value: 0.055; }` ; dans `useThemeSwap.ts`
  (après `makeWave`), animer `--wave-band` sur l'élément `.wave` de `min(0.2, 0.2 / scale0)` à `0.2 / scale1` avec 5
  images-clés échantillonnées sur `curveOf(EASES.standard)` (la bande en px = 200 · scale · band ; 0,2 est le maximum
  que la boîte de 480 px peut montrer). Même durée, même courbe que l'onde. Le dessin de la pulsation C au lancement ne
  change pas (`OPENING_C.waveBand` intact).

### B2. L'impact : une onde de choc, pas une lueur
- **Constat** (rafale Encre, 428 ms) : au moment de l'impact la carte est entourée d'un halo orange plein ; avec la lune
  qui s'allume à 370 ms on lit un bloc lumineux plutôt qu'une onde qui part du bord.
- **Jetons** (`tokens5.ts:94`) : `shock: { spread: 18, halo: 40 → 28, alpha: 0.85 → 0.7 }`. Montée, écrasement,
  étincelles, cadre et coche inchangés.

### B3. Flottaison : la carte active du carrousel un peu moins que ses voisines, et un survol qui compte
- **Constat** : à « Visible », la carte active (celle qu'on lit, qui porte la plaque et le crayon) flotte autant que les
  latérales (5 px) ; et sur l'éventail `floatHover` (6 px absolu) ne fait plus rien dès « Visible » (7 px) : le survol
  n'ajoute plus de flottaison, seulement la dérive.
- **Jetons** : `FLOAT_RHYTHM.activeGain: 0.7` (`tokens5.ts`), appliqué dans `carouselFloat.ts:147-155`
  (`c.amp * b.gain * (b.slot.dataset.active !== undefined ? R.activeGain : 1)`) → 3,5 px à « Visible », 5,6 à
  « Marquée », 1,4 à « Légère ». Éventail : remplacer `floatHover` (px) par `floatHoverGain: 1.15` dans le catalogue
  (`catalogueMotion.ts:165`) → `amp = floatRest · lerp(1, 1.15, h)` : 8 px, 13,8 px, 2,9 px selon le niveau.

### B4. Le déroulé de la personnalisation avancée : une cascade qui finit avec la coque
- **Constat** : 9 lignes à 45 ms = la dernière part à 455 ms et se pose à ~975 ms, 300 ms après la coque (680 ms) ; le
  halo à 0,22 ne se voit pas sur la capture au repos.
- **Jetons** (`ADVANCED_UNROLL`, `tokens5.ts:65-81`) : `rowStep: 45 → 32`, `rowAt: 50 → 40` (dernière ligne posée à
  ≈ 816 ms), `haloAlpha: 0.22 → 0.3`. Fermeture 220 ms inchangée. (Avec A1, le déroulé se voit enfin.)

### B5. Cartes sans affiche et cartes de scènes : garder la teinte dans le bas de la face
- **Constat** (carrousel Bleu-gris et Lavande-pêche) : le dégradé va de la couleur A→B à 20 % de cette couleur à 85 %
  de la hauteur ; sous la plaque, la face vire au gris neutre et le thème se perd dans le tiers bas.
- **Jetons** : le facteur du bout sombre `0.2 → 0.28` aux trois endroits qui doivent rester identiques :
  `AppCardFace.module.css:13` (`--f2`), `SceneCard.module.css:72` (`--f2`), `CategoryFan.module.css:29` (`--c2`).
  Le modèle de contraste `appFaceAtPlate: 0.3` reste au-dessus (la plaque est à ~80 % de la hauteur) : relancer
  `contrast.drift.test.ts`.

### B6. Cartes de scènes : les quatre actions respirent
- **Constat** (capture au survol) : quatre boutons de 34 px à 6 px d'écart = 154 px sur une carte de 176 : 11 px de
  chaque côté, la rangée touche presque les bords et apparaît en fondu sec.
- **Jetons** (`SceneCard.module.css:156-187`) : `.action` 34 → **30 px**, `gap` 6 → **8 px** (144 px, 16 px de
  marge), `.actions` `bottom` 74 → **80 px** ; entrée `translateY(4px) → 0` avec l'opacité, sur `--m1-court` /
  `--m-ease-in` (le même micro-mouvement que le crayon des apps).

### B7. Bokeh : moins d'anneau, plus de disque
- **Constat** (carrousel et Scènes, Bleu-gris) : à 0,09 d'intensité le disque doux est presque invisible et l'anneau
  fin domine : les sept bokeh se lisent comme des bulles grises, surtout sur les thèmes froids.
- **Jetons** (`src/fx/gpu/bgShader.ts:288-290`) : `a = 0.7·exp(−r²·2.2) + 0.3·smoothstep(.80,.93,r)·(1 − smoothstep(.95,1,r))`
  (0,55 / 0,45 aujourd'hui) ; `intensity` 0,09 inchangé. Comparable en A/B dans l'atelier (élément `bokeh`).

### B8. Sous-écrans : le petit titre à la hauteur de celui de l'accueil
- **Constat** (mesuré à 1707×960) : « CATÉGORIE » est à y ≈ 97 px sur l'accueil, « SCÈNES » à y ≈ 113 px sur l'écran
  Scènes (et « SCÈNE » dans l'éditeur) : 16 px plus bas, soit le `gap` de `.screen`.
- **Jetons** (`src/features/scenes/Screens.module.css:12`) : `.screen { gap: 0 }` (le `.titleBlock` garde sa marge de
  `--space-2`) → eyebrow à 97 px sur les trois écrans. Rien d'autre ne bouge (la barre reste à 24 px).

---

## Tableau récapitulatif

| N° | Sujet | Gravité | Où | Correction |
|---|---|---|---|---|
| A1 | Déroulé de la personnalisation avancée hors champ (667 px cachés) | Haute | `AdvancedSection.tsx:72-76` | `scrollIntoView` de ce qui suit après l'ouverture |
| A2 | Impact de la carte de thème : barre de défilement qui clignote, carte rognée | Haute | `Settings.module.css:48-54, 216` | Thèmes sans conteneur défilant, `overflow-x: hidden` ailleurs |
| A3 | Crayon : la flottaison repart et les filets s'éteignent sous le pointeur | Haute | `Carousel.tsx:211-219` | Viser `[data-app-id]` → `[data-stage]` |
| A4a | Flottaison du carrousel active sous l'éventail (emplacements à opacité 0) | Moyenne (perf) | `carouselFloat.ts:119-125` | `amp: 0` hors carrousel, boucle coupée |
| A4b | Boucle de l'éventail à 30 i/s avec « Flottaison : Aucune » | Moyenne (perf) | `fanFloat.ts:283` | `busy()` sans `floatHover` au repos |
| A5 | « Net » rebondit encore : menu déroulant, carte de thème, éventail, deck | Moyenne | `advancedUnroll.ts:24`, `themeSwap.ts:36`, `fanFloat.ts:79`, `fanTimeline.ts:68` | Drapeau `crisp` → courbe d'apparition, magie coupée |
| A6 | « Affichage au lancement » s'applique tout de suite | Moyenne (texte) | `fr-settings.json:57-60`, `modes.rs:115` | Libellé « Mode d'affichage » + aide |
| A7 | Cartes de scènes hors « Survol des cartes » | Basse | `SceneCard.module.css:54` | `data-hover-off` sur la grille |
| A8 | Image blanche : fond de nuit sous la View Transition | Basse (sûreté) | `themeSwap.css` | `::view-transition { background: var(--bg-bottom) }` |
| A9 | « Annuler » après la remise à zéro écrase les réglages faits ensuite | Basse | `VisualSection.tsx:133-146` | Oublier l'annulation dès qu'un réglage change |
| A10 | Flottaison du carrousel : repeinture par image (à mesurer) | À mesurer | `AppCard.module.css:52-57` | `will-change` pendant la boucle seulement, mesure p95 |
| A11 | Nettoyage : clés mortes, info-bulle native, tests Éco, `rx` | Basse | `actif.json:281`, `fr-settings.json:113`, `ThemeCard.tsx:35,57` | Supprimer / aligner |
| B1 | Onde : halo fixe de 40 px | Dosage | `tokens5.ts:99`, `themeSwap.css` | `haloPx: 40`, `--wave-band` animé |
| B2 | Impact : lueur → onde de choc | Dosage | `tokens5.ts:94` | `halo 28`, `alpha 0.7` |
| B3 | Flottaison : carte active ×0,7 ; survol de l'éventail ×1,15 | Dosage | `tokens5.ts`, `carouselFloat.ts:147`, `catalogueMotion.ts:165` | `activeGain`, `floatHoverGain` |
| B4 | Déroulé : cascade 32 ms, halo 0,3 | Dosage | `tokens5.ts:65-81` | `rowStep 32`, `rowAt 40`, `haloAlpha 0.3` |
| B5 | Faces sans affiche : bout sombre 0,28 | Dosage | `AppCardFace.module.css:13`, `SceneCard.module.css:72`, `CategoryFan.module.css:29` | `0.2 → 0.28` |
| B6 | Cartes de scènes : actions 30 px / 8 px / +4 px | Dosage | `SceneCard.module.css:156-187` | tailles et micro-entrée |
| B7 | Bokeh : disque 0,7 / anneau 0,3 | Dosage | `bgShader.ts:288-290` | poids du sprite |
| B8 | Sous-écrans : eyebrow à 97 px comme l'accueil | Dosage | `Screens.module.css:12` | `.screen { gap: 0 }` |

## En dix lignes
1. La ronde 5 tient : filets à l'échelle 1 sur la carte active, anneau de focus, crayon au survol, cartes de scènes,
   retour vers le carrousel, mode fenêtre à 1280×760 (25 px d'air entre la scène et les onglets) : tout vérifié dans l'exe.
2. Trois vrais défauts à corriger avant le gel, tous vus dans l'exe : le déroulé de la personnalisation avancée se joue
   entièrement sous le bord du panneau (A1) ; l'impact d'une carte de thème fait clignoter une barre de défilement et
   rogne la colonne de gauche (A2) ; le crayon relance la flottaison et coupe les filets sous le pointeur (A3).
3. Deux boucles tournent dans le vide : la flottaison du carrousel sous l'éventail, et celle de l'éventail à « Aucune » (A4).
4. « Net » se contredit : menu déroulant, carte de thème, éventail et deck rebondissent encore (A5) ; un drapeau `crisp` suffit.
5. « Affichage au lancement » change le mode à l'instant : le renommer « Mode d'affichage » (A6).
6. Petites incohérences : cartes de scènes hors « Survol des cartes », « Annuler » trop large, info-bulle native,
   clés mortes, tests Éco qui ne verront pas le repli automatique (A7, A9, A11).
7. Un filet de sécurité gratuit contre l'image blanche : un fond de nuit sous la View Transition (A8).
8. À mesurer à l'étape 13 : la repeinture des cartes flottantes du carrousel, `will-change` pendant la boucle seulement (A10).
9. Dosages : halo de l'onde fixé à 40 px, impact moins lumineux, carte active qui flotte moins, cascade du déroulé plus
   courte, faces qui gardent leur teinte en bas, actions des scènes qui respirent, bokeh moins « bulle », titres des
   sous-écrans alignés sur l'accueil (B1–B8).
10. Rien ici ne touche une signature validée par défaut ; tout passe par les jetons ou par une ligne de CSS, et chaque
    point A a une correction d'une dizaine de lignes au plus.

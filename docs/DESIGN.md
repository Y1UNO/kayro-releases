# Design et mouvement

Les maquettes HTML dans `reference/` donnent les valeurs exactes (à lire comme du code). Ce fichier résume les règles et les **remplacements de production** : les maquettes utilisent de gros flous et un bruit SVG, trop coûteux en vrai.

## Direction
Sombre, doux, cinématographique : verre liquide, lumière chaude qui tombe sur la carte sélectionnée, grandes cartes façon affiche, titres en serif. **Une seule teinte à l'écran** (celle du thème) ; la couleur du jeu ne teinte que la lumière, la brume et le halo. Jamais de style gamer néon.

## Typographie
- Titres : **Fraunces** (poids 300 pour les très grands titres, 500 pour les titres moyens), `letter-spacing: -0.03em` au-delà de 60 px. Titre de catégorie : 92 px / 300.
- Interface : **DM Sans** 400–700. Tailles : 11–12 (libellés en capitales, `letter-spacing: .16em`), 13, 14, 15, 16, 17.
- Couleurs de texte : principal `#f6efe8` ; secondaire `rgba(246,239,232,.75)` ; tertiaire `rgba(246,239,232,.7)` ; texte sur accent `#1a1020`.

## Rayons, espacements
Rayons : 10, 14, 16, 20, 22, 26, 30, 36, pastille 999. Marges d'écran 24–56 px. Aires cliquables ≥ 44 px.

## Thèmes (5 intégrés, donnée JSON)
| Thème | Fond (haut → bas) | Accent | Brume A / B / C | Base des cartes (rgb) | Rayon (rgb) |
|---|---|---|---|---|---|
| Crépuscule (défaut) | #171021 → #0f0a16 → #09060d | #ffb98a | rgba(160,104,214,.42) / rgba(255,150,100,.3) / rgba(255,205,170,.14) | 190,120,170 | 255,190,140 |
| Aurore boréale | #0e1a1a → #0a1214 → #060b0c | #8fe3b8 | rgba(60,190,160,.4) / rgba(90,150,230,.28) / rgba(190,255,225,.12) | 90,190,170 | 140,235,200 |
| Océan | #0e1626 → #0a101c → #060a12 | #7fd0ff | rgba(60,120,220,.42) / rgba(60,190,210,.28) / rgba(170,220,255,.13) | 90,150,225 | 140,200,255 |
| Rose poudré | #1f1020 → #150a18 → #0b060d | #ff9ad0 | rgba(220,90,170,.4) / rgba(255,150,170,.3) / rgba(255,190,225,.14) | 225,120,175 | 255,170,210 |
| Graphite | #16161a → #0f0f12 → #08080a | #e8e4de | rgba(120,120,140,.35) / rgba(160,150,140,.22) / rgba(255,255,255,.08) | 150,150,165 | 220,220,235 |

Un thème = un fichier JSON avec ces champs (+ nom, auteur). Importable/exportable. Thème personnalisé : l'utilisateur choisit 3 couleurs, le reste est dérivé.

## Verre liquide (recette)
```css
.lg { position: relative;
  background: linear-gradient(135deg, rgba(255,255,255,.20), rgba(255,255,255,.05) 55%, rgba(255,255,255,.12));
  backdrop-filter: blur(20px) saturate(190%) brightness(1.06);
  border: 1px solid rgba(255,255,255,.22);
  box-shadow: inset 0 1.5px 0 rgba(255,255,255,.55), inset 0 -1.5px 0 rgba(255,255,255,.12),
              inset 1.5px 0 0 rgba(255,255,255,.18), inset -1.5px 0 0 rgba(255,255,255,.08),
              0 18px 40px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.25); }
.lg::before { content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background: radial-gradient(120% 95% at 18% 0%, rgba(255,255,255,.30), transparent 46%); }
```
Éco : même apparence sans `backdrop-filter` (fond `rgba(30,22,40,.82)`). Maximum 6 surfaces avec `backdrop-filter` à l'écran en même temps.

## Atmosphère : maquette → production
| Maquette | Production |
|---|---|
| Brume : grands ovales + `filter: blur(100px)` | `radial-gradient` ovale (mêmes couleurs/alpha), animé en `transform` seulement |
| Rayons : bande + `blur(40px)` + `mix-blend-mode: screen` | `linear-gradient` vertical + masque horizontal en dégradé (`mask-image`) pour les bords doux ; tester `screen`, sinon opacité |
| Halo sous la carte : ovale flouté | `radial-gradient` ovale |
| Poussière : divs CSS | un canvas 2D (voir ARCHITECTURE §7) |
| Grain : `feTurbulence` SVG | une tuile PNG de bruit 256 px répétée, `mix-blend-mode: overlay`, opacité .08–.10 |
| Vignette | `radial-gradient` fixe |
Sensation à conserver : lumière qui balance doucement (±3°, 12 s), brume qui dérive (26–38 s), faisceau et halo qui glissent vers la carte sélectionnée.

## Carrousel de cartes (écran d'accueil)
Carte active 232×324, autres 172×246, écart 20, rayon 26, autres à opacité .62. Lettre/affiche en haut, plaque de nom en verre en bas (rayon 16, padding 10×14, 16/600). Reflet qui traverse la carte active toutes les 6 s. Lueur sous la carte active `0 30px 80px rgba(couleur, .4)`.
Avec de nombreuses apps : le carrousel défile (5 visibles) ; une vue grille doit exister (bascule), la pile d'apps complète n'est jamais coupée.

## Mouvement
- Courbe de base : `cubic-bezier(.2,.8,.2,1)`. Durées : redimensionnement de carte .6 s ; déplacement du faisceau .8 s ; fondu de couleur .9 s ; survol .4 s ; ouverture de panneau .35 s.
- Ressorts Framer Motion pour les transitions d'écran et de panneaux (valeurs de départ : raideur 260, amortissement 28 ; à ajuster à l'œil).
- Tout est basé sur le temps réel ; `prefers-reduced-motion` : transitions courtes, plus de balancement ni de particules.
- Navigation clavier : flèches pour les cartes, Entrée pour lancer, Ctrl+K pour chercher, Échap pour fermer.

## Écrans (voir `reference/`)
- **Accueil** (`Liquide.dc.html`) : barre du haut en verre (nom, recherche, modes, voix, mains), titre de catégorie, carrousel, onglets de catégories, dock des scènes.
- **Éditeur de scène** (`Editeur.dc.html`) : liste d'étapes numérotées reliées par un trait, palette d'actions, emplacements de la scène, boutons Tester/Enregistrer.
- **Réglages · Performance** (`Reglages.dc.html`) : 5 préréglages, interrupteurs, jauges en direct, courbe du temps par image.
- **Réglages · Apparence** (`Apparence.dc.html`) : grille de thèmes, « Couleurs du jeu » (Désactivé/Léger/Immersif), intensité, importer/exporter un thème.
- **Ajout d'applications** (`AjoutApp.dc.html`) : détectées / glisser-déposer / manuel, cases à cocher, catégorie par app.
- **Widget** (`Widget.dc.html`, `WidgetOuvert.dc.html`) : barre compacte et panneau déplié (recherche, scènes, apps en cours avec « au premier plan », récents).
- **Ambiance d'un jeu** (`Jeu.dc.html`) : aperçu en direct, affiche source, palette, modes de couleur, packs d'animation, densité/vitesse, import/export `.hubmood`.

## Couleurs du jeu (rappel)
`Désactivé` = thème seul. `Léger` (défaut) = lumière, brume (calque C), halo teintés par la palette du jeu sélectionné. `Immersif` = en plus brume principale et fond aux couleurs du jeu, héros flouté en arrière-plan (flou fait une fois à l'import, mis en cache, pas à chaque image). Le texte et les boutons gardent les couleurs du thème.

## Ambiances sur mesure
Pour quelques jeux « pépites » : fichier `.hubmood` écrit à la main avec l'utilisateur (type de particules, glyphes/runes dessinés en chemins SVG originaux, rotation, pulsation, brume, rythme). Brief type : palette + 3 à 5 mots d'ambiance + mouvement (lent/solennel/nerveux) + une phrase d'intention.

# DA-BRIEF — Direction artistique de départ de Kayro (pour l'étape 12b)

Ce brief est le **point de départ**, pas la DA finale. L'utilisateur affinera dans l'atelier (`/dev/atelier`). Tant qu'il n'a pas dit « je fige la DA », rien n'est définitif. Les maquettes de `reference/da/` sont des **références visuelles** : on reprend l'esprit, les proportions, les couleurs et les mouvements, pas le code (les maquettes sont en HTML de démonstration).

## 1. Direction retenue
**Piste 3 « Velours lunaire » + anneau cristal (maquette `R2-Mix-V4-Accueil`) + particules de la piste 2 « Deux lumières ».**
Ambiance : nuit douce et précieuse. Un grand halo de lune en haut, deux voiles de couleur qui se croisent lentement, des braises qui montent et de petites étoiles qui scintillent. Net, premium, jamais criard.

Sources visuelles (dans `reference/da/`, export du projet Claude Design) :
- `R2-Mix-V4-Accueil` = la référence principale (anneau + particules + cartes + barre du bas).
- `R2-P3-Accueil` et `R2-P3-Ambiance` = le fond « velours lunaire » (halo, voiles).
- `R2-P2-Accueil` et `R2-P2-Ambiance` = les particules (braises, étoiles).
- `R2-Ouverture` = animation d'ouverture (logo qui apparaît puis glisse à gauche, le nom apparaît en fondu).
- `R2-Categories` = choix de catégorie en cartes qui se déplient.
- `R2-Themes` = les 6 thèmes colorés.
- `R2-Editeur` = éditeur de scène avec la chaîne de points de liaison (style de la DA B).
- `R2-Widget` = widget déplié, mouvement plus doux (style de la DA B).

## 2. Les 6 thèmes (tirés des couleurs du logo)
Chaque thème : A (haut du dégradé), B (bas du dégradé), fonds (du plus clair au plus sombre), texte doux.
- **lavande-pêche** : A #B7A2F2, B #F6A98A, fonds #15112B / #0C0A1A / #06050D, texte doux #D9CEFA
- **mauve** : A #C99ACB, B #9476C2, fonds #1A1228 / #100B1A / #08060D, texte doux #E6CCE8
- **sakura** : A #F7B7C4, B #D9708E, fonds #24121E / #150A12 / #0B0509, texte doux #FBD8DF
- **bleu-gris** : A #A3B0DE, B #7282BC, fonds #141A30 / #0B0F1E / #05070F, texte doux #D3DAF2
- **opale** : A #9FD0E8, B #F2A2B8, fonds #10202A / #0A131A / #05090D, texte doux #D2ECF6
- **cuivre** : A #D99A6C, B #B07A78, fonds #24160F / #150D09 / #0A0605, texte doux #F0D2BC
Thème par défaut : lavande-pêche. Tout est piloté par des variables : changer de thème change tout (halo, voiles, anneau, particules, boutons, bordures).

## 3. Typographies
- Titres : **Cormorant Garamond** (300 pour les grands titres, 500 pour le nom Kayro).
- Interface : **Manrope** (400 à 700).
Prévoir un repli système propre si les polices ne chargent pas (l'app doit marcher hors ligne : embarquer les polices dans l'app, pas de CDN).

## 4. Éléments à rendre réglables dans l'atelier (catalogue data-driven)
1. **Anneau cristal** : grand anneau fin et net (~680 px sur une composition 1280×760), bord clair, deux filets colorés aux couleurs du thème (un dehors, un dedans), léger reflet qui tourne très lentement (~40 s par tour). **Pas de pulsation, pas de flou diffus.** Réglages : diamètre, épaisseur, position, vitesse de rotation, intensité des reflets. La vraie réfraction (liquid glass) viendra du moteur graphique, pas du CSS : l'anneau CSS sert de repli et de référence.
2. **Halo de lune** et **deux voiles** colorés qui dérivent (intensité, vitesse, couleur).
3. **Particules** : braises montantes + étoiles scintillantes. Réglages : nombre (0 à ~40), taille, vitesse, couleur, zone. Respect du mode Éco (moins de particules, 30 images/s).
4. **Cartes** (jeux, catégories) : coins très arrondis (~30 px), dégradé d'après l'affiche du jeu, bord clair, carte au centre plus grande et plus nette, voisines à 60 % d'opacité, léger bassin de lumière sous la carte centrale.
5. **Survol des cartes** : effet très léger et premium. Soulèvement de quelques pixels, inclinaison 3D de 2 à 3° maximum vers le curseur, léger reflet qui suit la souris, retour doux. Réglages : intensité d'inclinaison, hauteur, durée/courbe, intensité du reflet. Respecte « réduire les animations ».
6. **Barres de verre** (barre du haut, onglets du bas, scènes) : coins en pilule, flou de fond léger, bord clair fin, ombre profonde.
7. **Titre de catégorie** : très grand (≈96 px), Cormorant 300, fin filet dégradé dessous.
8. **Animation d'ouverture** : le logo apparaît au centre puis glisse vers la gauche pendant que le nom « Kayro » apparaît en fondu. Doit être très fluide. Durée et courbe réglables.
9. **Choix de catégorie** : cartes qui se déplient de façon fluide (Jeux / Stream / Créativité / Logiciels / Autre).

## 4b. Moteur graphique : les vrais effets (priorité de l'utilisateur)
L'utilisateur veut de **vrais effets de verre liquide, de grande ampleur et bien meilleurs que les maquettes** (qui ne sont que du CSS de démonstration). Utiliser pour cela la partie moteur graphique prévue au plan (rendu GPU : WebGL / shaders dans la fenêtre, ou ce que PLAN.md a retenu), pas seulement des dégradés CSS :
- **Réfraction réelle** de ce qui est derrière l'anneau, les cartes et les barres de verre (déformation de l'arrière-plan, pas un simple flou), avec dispersion chromatique légère (franges colorées sur les bords), reflets spéculaires qui suivent la souris et la lumière.
- **Anneau cristal** : vrai tube de verre qui réfracte le halo, les voiles et les particules derrière lui.
- **Cartes** : léger effet de verre/relief sur les bords, reflet qui glisse au survol.
- Les maquettes CSS restent la référence de **composition, taille, couleurs et mouvement**. Le moteur doit les **dépasser en qualité**, tout en restant net et premium (jamais criard).
- Réglages exposés dans l'atelier : force de réfraction, dispersion, flou, intensité des reflets, qualité (Élevée / Équilibrée / Éco).
- Garde-fous : tenir 60 images/s (30 en Éco), repli CSS automatique si le GPU ou WebView2 ne suit pas, CPU masqué < 1 %, budget de l'étape 13. Mesurer et le dire honnêtement (« non testé » si non mesuré). Si un effet coûte trop cher, proposer une version allégée plutôt que de le supprimer en silence.

## 5. Animations de référence de l'utilisateur
Vidéos OBS dans `reference/animations/` avec notes `.txt`. Claude Code ne lit pas la vidéo : extraire des images clés avec ffmpeg (l'installer si absent), regarder les images, lire les notes, puis proposer une version **plus fluide** que les maquettes, avec curseurs de durée et de courbe. L'utilisateur juge à l'écran.

## 6. Contraintes
- Les maquettes ne montrent **pas** la réfraction réelle : ne pas pousser les effets de verre au maximum en CSS.
- Fluidité : effets à 60 images/s (30 en Éco), CPU masqué < 1 %, budget RAM de l'étape 13. Une DA plus belle mais qui saccade est refusée.
- Aucune IA dans l'app. Aucune dépendance exotique sans la justifier.
- Tout nouveau réglage visuel = une entrée du catalogue (pas de valeur en dur) et un préréglage nommé sauvegardable dans `src/design/presets/`.
- Journal : tenir `docs/DA-JOURNAL.md` à jour à chaque session (ce qui a été fait, ce qui reste, décisions de l'utilisateur) et `docs/RETOUCHES.md` pour les retouches signalées.
- La DA ne devient « officielle v1 » dans `DESIGN.md` que quand l'utilisateur dit « je fige la DA ».

## 7. Sons (étape à part, plus tard)
Voir `_kit/AJOUTS-KIT.md` (étape Sound design). Ne pas s'en occuper en 12b.

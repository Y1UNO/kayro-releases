# Ambiances et cartes spéciales (étapes 16–17)

Une ambiance = un fichier `.hubmood` (JSON déclaratif, aucun code). Elle anime le fond quand l'app est **sélectionnée
dans le carrousel**, avec « Couleurs du jeu » sur Stylisé, en qualité **Équilibré ou plus** (Éco : rien).
Choix par app : Modifier › Apparence › « Ambiance du jeu ».

## Où vit le code
- Schéma et contrôle : `src-tauri/src/config/moods.rs` (strict, `deny_unknown_fields`), import / suppression / export :
  `config/mood_store.rs`, IPC `moods_list`, `mood_import`, `mood_delete`, `mood_export`, événement `MoodsChanged`.
- Réglage par app : `AppEntry.moodId` (id de l'ambiance, absent = Aucune) et `moodTune` (densité, vitesse × 0,25–2).
- Page : `src/fx/mood/` (types, `packs.ts`, `custom.ts`, `moodSim.ts` = simulation sans DOM, `glyphAtlas.ts`,
  `moodCanvas.ts` = repli Canvas 2D), `src/features/moods/` (store, `AppMoodChoice`, `useShownLook`).
- Rendu : dans le moteur WebGL2 (`src/fx/gpu/scene.ts` → mêmes sprites que les braises du thème, donc **réfractés par le
  verre, derrière les cartes**), formes du shader de sprites (`bgShader.ts`, sortes 3 à 15). Moteur coupé : `moodCanvas.ts`.

## Format `.hubmood` (version 1)
```json
{ "schemaVersion": 1, "id": "runes", "name": "Runes", "gameHint": "Un jeu",
  "glyphs": { "stave": "M50 8 L50 92 M50 30 L76 14" },
  "layers": [
    { "type": "particles", "shape": "ember", "count": 30, "size": [1.5, 3], "speed": [30, 70],
      "direction": "up", "drift": 0.4, "life": [5, 10], "colorRole": "accent", "opacity": 0.85 },
    { "type": "glyphRing", "glyph": "stave", "count": 12, "radius": 0.4, "rotation": 5, "size": 30,
      "colorRole": "accent", "opacity": 0.75 },
    { "type": "mist", "count": 4, "colorRole": "dominant", "opacity": 0.3, "speed": 8 },
    { "type": "beam", "count": 2, "sway": 4, "colorRole": "accent", "opacity": 0.4 },
    { "type": "pulse", "period": 6, "colorRole": "dominant", "opacity": 0.4 } ] }
```
- Formes de particules : `ember`, `dot`, `star`, `line` (pluie), `glyph` (avec `glyph`). Directions : `up`, `down`,
  `left`, `right`, `none`. Rôles de couleur : `dominant` (A), `accent` (B), `dark` (nuit), `text` (blanc cassé).
- `glyphRing` : anneau autour de la carte affichée (rayon × hauteur de l'écran, vu en perspective), `pulse` : anneau
  de lumière qui respire autour d'elle. Les deux suivent `FxLayer.setFocusTarget` (étape 16b).
- Glyphes : tracés SVG dans une boîte **0–100**, dessinés au trait ; seuls les chiffres et les commandes de tracé
  passent (pas de balise, pas de `url(`), 8 glyphes, 1 500 caractères chacun au plus.
- Limites : 6 couches ; particules 1–80 (× 0,6 en Équilibré, × 1,25 en Ultra) ; anneau 1–24 ; brume 1–6 (opacité
  ≤ 0,6) ; faisceaux 1–4 ; fichier ≤ 64 Ko ; 40 ambiances importées ; id `perso-…` donné à l'import.
- Écarts avec `ARCHITECTURE.md` § 7 (non modifié ici, fichier en cours chez l'utilisateur) : pas de `palette`,
  `colorMode` ni `onFocus` dans le fichier (les couleurs viennent de « Couleurs du jeu », le `pulse` remplace
  `onFocus`) ; `glyphRing` a une taille (`size`) ; rendu dans le moteur WebGL2, Canvas 2D en repli seulement.

## Séquence de lancement
Champ facultatif `"launch": "seal"` : le jeu est lancé tout de suite derrière Kayro, qui reste devant (les fenêtres
du magasin ne passent pas devant), et Kayro joue le « Sceau » (scène 3D : encre, cercle de runes, sceau, flammes) jusqu'à
l'arrivée de la fenêtre du jeu (entre 4,6 et 10 s), puis le final et Kayro se cache. Un clic ou Entrée / Échap / Espace
saute au final.
Deuxième séquence : `"launch": "gommage"` (clair-obscur : lumière dorée d'en haut, coups de pinceau à l'huile,
monolithe au « 33 » peint, coins dorés, pétales lumineux ; la carte s'efface en pétales). Le jeu est « arrivé » quand une nouvelle grande fenêtre à lui
apparaît (au moins 20 % de l'écran : un écran de démarrage ne compte pas) ; à la fin, Kayro le met au premier plan. Seules les séquences codées dans Kayro existent (`LaunchStyle` : `seal`, `gommage`) : un fichier
ne peut rien jouer d'autre.

## Packs fournis
Aucune · Braises · Étoiles · Brume · Runes · Pluie (`packs.ts`). Sur mesure (étape 17, `custom.ts`) : « Sceau de la
sorcière » (Hades II : anneaux de sceaux, braises, croissants de lune, brume, pulsation ; lancement « Sceau ») et
« Pétales du Gommage » (Clair Obscur : Expedition 33 : pétales et poussière d'or au vent, brume, colonne de lumière ;
lancement « Gommage »). Formes originales seulement.

## Cartes spéciales (art local fourni par l'utilisateur)
Quand l'app affichée a au moins un **personnage** (gauche ou droit), le moteur dessine derrière le verre : le **fond**
(flouté par la profondeur), les personnages de part et d'autre de la carte active (centre libre,
ombres teintées par la couleur A, liseré de lumière B côté lune, pieds et bord extérieur fondus dans la brume,
respiration lente), et le **logo** sous la carte. Moteur coupé : pas de carte spéciale (repli CSS ordinaire).

**À fournir, par jeu** — glisser chaque image sur sa case dans Modifier › Apparence (copiée par Kayro), ou la poser
directement dans `%APPDATA%\Kayro\art\<id-de-l-app>\` :

| Case | Fichier | Format | Taille conseillée |
|---|---|---|---|
| Personnage gauche | `char-left.png` | PNG détouré, fond transparent propre (sans liseré blanc), tourné vers le centre | 1 600–2 000 px de haut ; le bas peut être coupé (fondu) |
| Personnage droit | `char-right.png` | idem | idem |
| Logo | `logo.png` | PNG transparent, marge fine | 1 200–1 600 px de large |
| Fond | `hero.jpg` / `.png` / `.webp` | image pleine, centre calme et sombre | 2 560 × 1 440 (1 920 × 1 080 au moins) |

16 Mo au plus par image. Sans logo ni fond à vous, Kayro prend ceux de Steam quand ils existent. Rien n'est embarqué
ni exporté : les images restent dans votre dossier de données.

Dosages : `SPECIAL` (`src/fx/gpu/specialShader.ts`) ; packs : `packs.ts` ; parts par qualité : `MOOD_SHARE`.

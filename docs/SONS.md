# Sons (étape 17b)

Les sons de l'interface sont **synthétisés** à la volée par Web Audio : aucun fichier audio, aucune connexion, des
sons originaux. Demande de l'utilisateur (30/10) : « des sons cristallins, doux, premium et légers », trois styles au
choix (Premium, Rétro, 8-bit) et un réglage du volume en forme d'onde.

## Où vivent-ils
- `src/sound/sons.json` — le manifeste (donnée validée strictement par `src/sound/manifest.ts`) :
  - `events` : chaque moment (`click`, `step`, `tab`, `confirm`, `launch`, `success`, `export`), sa famille
    (`interface`, `transitions`, `launch`), son volume, l'écart minimal entre deux lectures, une petite variation de
    hauteur (± 0–10 %, pas d'effet « disque rayé ») ;
  - `packs` : par style, ses effets (filtre passe-haut/bas, écho doux) et, par moment, ses notes (onde, fréquence,
    glissando, départ, durée, attaque, niveau, `bell` = harmoniques de cloche de cristal ×2,76 et ×5,4).
- `src/sound/synth.ts` — le synthétiseur (oscillateurs, enveloppes exponentielles, chaîne d'effets), utilisé en direct
  et hors ligne (`OfflineAudioContext`) pour dessiner l'onde des réglages.
- `src/sound/engine.ts` — le moteur : contexte audio créé à la première lecture, **suspendu ~0,3 s après le dernier
  son** (aucun fil audio au repos), rien de nouveau quand la fenêtre est cachée.
- `src/sound/index.ts` — suit les réglages et la fenêtre ; « réussite » quand une scène se termine.

## Quel son, quand
| Moment | Déclencheur |
|---|---|
| `click` | tout bouton `Button` (variante douce) |
| `confirm` | tout bouton `Button` principal (Ajouter, Enregistrer, Créer…) |
| `step` | autre carte sélectionnée sur l'accueil |
| `tab` | autre catégorie (la ronde des cartes) |
| `launch` | lancement d'un jeu (accueil, widget) |
| `success` | apps ajoutées, scène terminée |
| `export` | logs, thème, ambiance ou scène exportés |

## Réglages › Sons
Interrupteur (activé par défaut), **Style** Premium · Rétro · 8-bit (Premium par défaut), **Volume** (40 % par
défaut) dessiné comme l'onde du « réussite » du style (barres éclairées jusqu'au volume, plus hautes avec lui ; un
`input range` natif invisible par-dessus garde le clavier et les lecteurs d'écran ; relâcher fait entendre le son),
et trois familles à couper séparément. Rust : `soundsOn`, `soundPack`, `soundVolume` (0–1, validé),
`soundInterface`, `soundTransitions`, `soundLaunch` (`config/sounds.rs`).

## Limites
- Non entendus par Claude : les sons sont réglés à l'oreille par l'utilisateur dans l'exe (`sons.json` se retouche
  sans toucher au code).
- Les 9 fichiers de `reference/sons/` (Mixkit, Pixabay) ne sont plus utilisés : gardés comme référence.
- Coût CPU non mesuré (étape 18) ; au repos le contexte est suspendu.

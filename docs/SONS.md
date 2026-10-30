# Sons (étape 17b)

Les sons de l'interface sont **synthétisés** à la volée par Web Audio : aucun fichier audio, aucune connexion, des
sons originaux. Demande de l'utilisateur (30/10) : « des sons cristallins, doux, premium et légers », trois styles au
choix (Premium, Rétro, 8-bit) et un réglage du volume en forme d'onde.

## Où vivent-ils
- `src/sound/sons.json` — le manifeste (donnée validée strictement par `src/sound/manifest.ts`) :
  - `events` : chaque moment (20, tableau ci-dessous), sa famille
    (`interface`, `transitions`, `launch`), son volume, l'écart minimal entre deux lectures, une petite variation de
    hauteur (± 0–10 %, pas d'effet « disque rayé ») ;
  - `packs` : par style, ses effets (filtre passe-haut/bas, écho doux) et, par moment, ses notes (onde, fréquence,
    glissando, départ, durée, attaque, niveau, `bell` = harmoniques de cloche de cristal ×2,76 et ×5,4), ou 2 à 4
    **variantes** (une tirée au hasard, jamais deux fois la même).
- `src/sound/synth.ts` — le synthétiseur (oscillateurs, enveloppes exponentielles, chaîne d'effets), utilisé en direct
  et hors ligne (`OfflineAudioContext`) pour dessiner l'onde des réglages.
- `src/sound/engine.ts` — le moteur : contexte audio créé à la première lecture, **suspendu ~0,3 s après le dernier
  son** (aucun fil audio au repos), rien de nouveau quand la fenêtre est cachée.
- `src/sound/index.ts` — suit les réglages et la fenêtre ; « réussite » quand une scène se termine.

## Quel son, quand (2ᵉ passe du 30/10 : plus de moments, calés sur les animations)
| Moment | Déclencheur | Rythme |
|---|---|---|
| `click` | bouton doux (`Button`) | 2–3 variantes tirées au hasard |
| `confirm` | bouton principal (Ajouter, Enregistrer, Créer…) | arpège court |
| `select` | segment choisi (`SegmentedControl`) | note selon la position du segment |
| `toggle` | interrupteur (`Toggle`) | plus aigu en allumant |
| `hover` | survol d'une carte (carrousel, éventail) | **gamme pentatonique** selon la place de la carte |
| `step` | autre carte sélectionnée | gamme selon la carte : parcourir le carrousel joue une petite mélodie |
| `dialogOpen` / `dialogClose` | une fenêtre s'ouvre / se ferme (`Dialog`) | montée / descente |
| `tab` puis `land` | changement de catégorie (la ronde) | `tab` étiré jusqu'à l'impact, `land` **pile à l'écrasement** (`linkDirector.ts`) ; coupés si une autre ronde commence |
| `link` / `linkBack` | l'éventail se déplie / se replie | arpège montant / descendant |
| `theme` | changement de thème (l'onde) | glissando puis cloches |
| `open` | **mélodie d'ouverture de Kayro** (une fois par démarrage) | calée sur l'ouverture V1-A : nappe à l'anneau (0,2 s), cloche au logo (0,95 s), éclosion à la pulsation (1,75 s), **une note par lettre** (2,0 s, puis toutes les 85 ms), accord au trait (2,55 s) ; coupée si on passe l'ouverture |
| `launch` | lancement d'un jeu | petite mélodie montante puis accord |
| `launchFinale` | final des scènes Sceau / Gommage | glissando et éclat, au début du final |
| `progress` | chaque étape d'une scène qui se termine | une note de plus haut en plus haut |
| `success` | apps ajoutées, scène terminée | |
| `error` | lancement raté | deux notes douces vers le bas |
| `export` | logs, thème, ambiance ou scène exportés | |

Premium retravaillé (2ᵉ passe) : cloches de cristal en mi majeur, écho un peu plus long, petites harmoniques
aiguës sur les clics, impact « verre » au changement de catégorie. 8-bit : nouvelle ronde de catégorie (glissade puis
arpège rapide qui rebondit).

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

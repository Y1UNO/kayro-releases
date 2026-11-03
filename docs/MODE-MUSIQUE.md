# Mode musique de Kysland (refait le 2026-11-03)

Quand le mode musique est allumé (interrupteur sous la musique, dans l'île ouverte) et qu'une musique joue, l'île se
détache, tombe et devient un **lecteur** au milieu de l'écran, qui bouge avec le son. Référence : le labo validé par
l'utilisateur, rangé dans `reference/animations/Kysland-mode-musique-labo/` (`reference-labo.html` : son code fait foi ;
`SPEC.md` : les chiffres et les règles ; `PROMPT.md` : la mission). **Aucun pic ni épine**, nulle part (refus explicite).

Changements demandés par rapport au labo :
- les **cordes suivent la mélodie** (en douceur), la **basse cogne la bulle** ;
- l'encre du lecteur a **le noir mat de l'île** (#000), sans les reflets du labo (« Brillance », à 0 par défaut, les
  remet) ;
- la scène **Encre** du labo n'est pas faite, et l'ancienne encre « Dancing » est retirée avec son sélecteur ;
- avec Thomas (projet RAYKA), après l'essai sur l'exe : basse moins dominante face à la mélodie, fils qui bougent à
  chaque note (et sur la caisse claire et le charleston), lueur des fils fine, titre qui s'efface après 8 s, disque
  plus petit (0,19 de la hauteur), pochette qui tourne au tempo (un tour pour 8 temps, `tempo.ts`), jamais poussée
  par les coups.

## Ce qu'on voit
- **Départ** : l'île se tasse ; au kick suivant (600 ms au plus), une goutte part, tenue par un col de cinq boules qui
  s'amincit comme du miel et casse ; la boule tombe, s'étire, s'écrase et devient le lecteur.
- **Lecteur** : la pochette tourne dans la bulle noire. Le kick cogne la taille (+12 % en deux images, contraction,
  rebond), la sub la fait respirer, la caisse claire la tord, le charleston fait onduler son bord. Le crash : flash,
  ondes de choc, huit gouttes qui reviennent se fondre, titre éparpillé. Halo, rayons et traînées tournantes aux
  couleurs de la pochette. Trois cordes : la corde du registre de la mélodie s'allume (grave dedans, aigu dehors),
  chaque nouvelle note la pince. Le titre fait une ola à chaque kick.
- **Retour** (2 s de pause ou sans musique, interrupteur coupé, clic sur le lecteur) : la boule s'accroupit, saute au
  kick suivant, l'île descend la chercher, un pont liquide se forme ; l'île reprend sa largeur, exactement à sa place.
- **Réduire les animations** : fondus seulement.

## Où vit le code
Image (`src/features/island/stage/`) :
- `stageEngine.ts` — le chef d'orchestre : île, départ, lecteur, retour ; attente du kick ; pas de physique de
  1/480 s ; la région de la fenêtre (ce qu'on voit et ce qui prend les clics).
- `isle.ts`, `neck.ts` — l'île qui part et revient (le col qui casse, le pont liquide).
- `disc.ts`, `title.ts` — le lecteur (pochette, cordes, halo, gouttes du crash) et son titre en ola.
- `jelly.ts` — la gelée (`Body` : taille, modes 2 à 5, cisaillement, ondulation) et les effets (`Effects` : ondes de
  choc, flash, séparation des couleurs, secousse).
- `music.ts` — les enveloppes des coups (kick 0,11 s, caisse claire 0,13 s, charleston 0,05 s, crash 0,45 s) et les
  niveaux continus.
- `demo.ts`, `demoSound.ts` — le morceau de test du labo (116 BPM, 12 mesures) et son synthé Web Audio.
- `shaders.ts`, `renderer.ts` — WebGL2, deux passes : la lumière en demi-résolution avec ses traînées, puis l'image
  finale, transparente, limitée à la zone utile.
- `stageView.ts`, `fallback.ts` — résolution adaptative et qualité, repli 2D sans WebGL, l'île exacte peinte aux
  passages de relais.
- `palette.ts`, `cover.ts` — les couleurs (pochette ou thème Kayro).
- `useMusicStage.ts` — le crochet React qui démarre le moteur, le nourrit (`onMusicFrame`) et l'arrête.
- Tests : `stage.test.ts`.

Son (`src-tauri/src/media/`) : voir « Son analysé » ci-dessous.

Réglages : `src/features/settings/MusicModeRows.tsx` (Réglages › Visuel › Mode musique), lus par `stageLook.ts`.

## Son analysé
Côté Rust (`src-tauri/src/media/`), dans le fil d'écoute de l'île (`listen.rs`), seulement quand une musique joue, que
l'île est visible et que le mode musique est allumé (pas en mode démo). Rien n'est gardé ni envoyé.
- `spectrum.rs` — le son joué (WASAPI loopback), en mono, ramené vers 48 kHz ; une analyse toutes les 256 échantillons
  (5,3 ms) sur une fenêtre de Hann de 1 024 (la FFT de `beat.rs`).
- `onset.rs` — les coups par bande : kick 40–120 Hz, caisse claire 187–250 et 1 500–5 000 Hz, charleston 7–14 kHz,
  crash 4–16 kHz. Flux spectral (comparé au maximum des 4 analyses précédentes, comme SuperFlux), seuil adaptatif,
  vélocité.
- `continuous.rs` — les niveaux continus : sub (30–60 Hz), mélodie (250–2 000 Hz) et sa hauteur (centre de gravité du
  spectre entre 250 et 4 000 Hz, en échelle log).
- `form.rs` — la forme du morceau : montée, silence avant le drop, drop, section.
- `music.rs` — l'analyseur qui assemble le tout ; tests dans `music_tests.rs` et `music_sounds.rs` (sons de synthèse).
- L'événement `music-frame` (`MusicFrame`) : les coups depuis la trame précédente (une trame au plus toutes les 10 ms),
  et au moins toutes les 16 ms les niveaux (toutes les 250 ms quand rien ne bouge). Côté page : `onMusicFrame`
  (`src/ipc/events.ts`), puis `StageEngine.feed`, qui retarde l'image du « Décalage son/image ».
- Coût mesuré (release) : 29 µs par analyse, 0,5 % d'un cœur. Le kick est détecté environ 15 ms après son attaque.

## Régler la détection
Dans l'app : Réglages › Visuel › Mode musique › Avancé.
- « Sensibilité de détection » par instrument (×0,5 à ×2) : divise le seuil. Plus haut, les coups plus faibles
  comptent aussi (et les faux coups augmentent).
- « Décalage son/image » (0 à 250 ms) : retarde l'image, par exemple avec un casque Bluetooth.
- « Mode démo » : le morceau de test du labo, son compris, à la place du vrai son, pour comparer le rendu au labo.

Dans le code (constantes de `onset.rs`, `form.rs`, `continuous.rs`) :
- **Seuil** : médiane + (2,5 / sensibilité) × MAD sur 1 s ; planchers de flux 0,25 (kick) et 0,2 (les autres), et au
  moins 20 % des derniers coups de la bande (35 % pour le kick).
- **Un coup** : un pic local confirmé une analyse plus tard (5 ms), quand la bande monte d'au moins 2 dB ; le kick doit
  aussi être 1,4 fois plus fort que sa moyenne de la dernière seconde.
- **Périodes réfractaires** : kick 110 ms, caisse claire 110 ms, charleston 50 ms, crash 900 ms.
- **Vélocité** : le flux divisé par un gain automatique (le maximum des derniers coups, qui redescend à un dixième en
  8 s et ne monte que de ×1,25 par coup). Côté image (`music.ts`), le charleston est joué à ×0,6 et la caisse claire à
  ×0,9, comme dans le morceau de test.
- **Crash** : un pic 4–16 kHz pendant que la caisse claire et le charleston montent aussi, au moins
  (1 + 0,8 / sensibilité) fois la médiane de ses 8 derniers pics ; ou un **drop** : l'énergie des 300 dernières ms
  dépasse 1,8 fois celle des 4 s (et 1,3 fois le passage de 300 ms le plus fort de ces 4 s), crash de vélocité 1.
- Une caisse claire faible (< 0,5) qui tombe avec un kick est ignorée (c'est le clic du kick).
- **Sub** : attaque 10 ms, relâche 120 ms. **Mélodie** : médiane sur 9 analyses (48 ms), attaque 40 ms, relâche 300 ms.
- **Montée** : pas de kick depuis 2 s et des aigus qui montent d'au moins 2 dB en 2 s. **Silence avant le drop** :
  après une montée, l'énergie sur 50 ms passe sous 30 % de celle des 4 s pendant au moins 150 ms.

## Différences avec le labo, et pourquoi
- **Fenêtre transparente** : pas de fond, de vignettage ni de grain ; seule la lumière est déformée par les ondes (le
  vrai bureau ne peut pas l'être). Sortie prémultipliée : alpha = encre + luminance de la lumière.
- **La lumière s'éteint avant le bord de la région** de la fenêtre (sinon un rectangle net apparaît) : les grandes
  ondes du crash s'arrêtent avant le bord de l'écran.
- **La vraie île** : sa forme exacte (collée en haut, dans un coin ou flottante), fondue dans le bord par ses épaules ;
  au départ et à l'arrivée, l'île exacte est peinte en fondu enchaîné avec l'encre, pour un relais sans saut.
- **Cordes** : allumées par la mélodie au lieu des coups ; le mode démo a gagné une petite mélodie (arpège) pour les
  faire vivre.
- **Encre mate** du noir de l'île ; le flash du crash éclaire autour, jamais l'encre.
- **Décalage son/image de 0 à 250 ms** (au lieu de −100 à +100) : l'image ne peut pas précéder un son pas encore
  capté ; un casque Bluetooth retarde le son de 150 à 250 ms.
- **Qualité** : la qualité Éco de Kayro met le lecteur en basse résolution (sauf choix explicite).

## Pièges corrigés (2026-11-03, vus sur l'exe)
- **Barre gris clair en haut de l'écran** : la fenêtre de l'île gardait les styles de barre de titre de Windows,
  qui la peignait parfois sous la page (8–33 px du haut) ; visible là où la page est transparente et où la région
  touche le haut. L'île est maintenant une fenêtre simple (`platform/island.rs`, `no_caption`).
- **Halo le long de tout le bord haut** : les murs où l'île se fond s'arrêtent deux épaules après elle (`shaders.ts`).
- **Départ brutal** : l'analyse repart à froid quand l'île réapparaît ; les coups montent en 2,5 s et aucun crash ne
  compte avant (`music.ts`), la pochette reste cachée tant qu'elle charge (`stageView.ts`).
- **Essais depuis Claude** : un Kayro lancé par Claude tourne avec une vieille copie des données (paquet MSIX) ;
  le lancer par l'Explorateur.

## Limites connues
- La détection est réglée sur des sons de synthèse (kicks 32/32, caisses claires 16/16, charlestons 63/64 sur un
  morceau de 16 s) : pas encore essayée sur de la vraie musique.
- Une basse tenue aussi forte que le kick dans 40–120 Hz cache presque tous les kicks ; une basse forte en doubles
  croches (psytrance) donne des kicks en trop. La sensibilité du kick aide en partie.
- Rendu mesuré sur le banc d'essai seulement ; à mesurer sur l'exe.

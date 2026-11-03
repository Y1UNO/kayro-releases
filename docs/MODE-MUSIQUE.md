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
  plus petit (0,19 de la hauteur), pochette qui tourne au tempo (un tour pour 8 temps), jamais poussée par les coups ;
- **un fil par source** (sub dedans, mélodie, voix dehors), chacun visible seulement quand sa source joue (la voix
  trouvée par le stéréo, sans IA) ;
- **IA locale du rythme** (Beat This!, voir « IA du rythme ») : la grille des temps et des mesures ;
- **couleurs justes** : la teinte exacte de la pochette (moyenne fine des pixels, plus le centre d'une tranche de 15°),
  sa saturation et sa luminosité gardées (juste relevées pour briller), la seconde couleur une nuance accordée quand la
  pochette n'a qu'une teinte ; fils : sub = principale, mélodie = secondaire, voix = blanc teinté de la principale ;
- **deux grands moments de plus**, dans le style du crash (`moments.ts`) : l'**Éclosion** quand une voix arrive après
  3 s sans voix (huit gouttes nées sur le fil de la voix tournent en spirale et se fondent dans la bulle, flash doux,
  onde pâle), le **Souffle** quand la musique se pose après un drop ou une montée (au début de mesure suivant : la bulle
  gonfle lentement et se relâche, grande onde lente, gouttes qui flottent, traînées qui changent de sens). Un grand
  moment toutes les 6 s au plus, crash compris ; tous suivent « Intensité des grands moments » ;
- **notes piquantes ou rondes** : l'analyse mesure à quel point les notes sont attaquées sèchement (`sharp`, 0 tenu et
  doux, 1 haché) ; un pincement de fil de note hachée est étroit, rapide, court et vibre vite, celui d'une note douce
  large, lent et long ;
- **grosse basse saturée** : quand la sub écrase le son plus que d'habitude dans le morceau (`heavy`, sa part du son
  1,25 à 2 fois sa part habituelle), la bulle gronde (elle tremble ronde vers 9 Hz, respire plus fort), son halo et le
  fil de la sub s'épaississent ; un tiers de ce grondement sous une sub seulement forte et tenue.

## Ce qu'on voit
- **Départ** : l'île se tasse ; au kick suivant (600 ms au plus), une goutte part, tenue par un col de cinq boules qui
  s'amincit comme du miel et casse ; la boule tombe, s'étire, s'écrase et devient le lecteur.
- **Lecteur** : la pochette tourne dans la bulle noire. Le kick cogne la taille (+12 % en deux images, contraction,
  rebond), la sub la fait respirer, la caisse claire la tord, le charleston fait onduler son bord. Le crash : flash,
  ondes de choc, huit gouttes qui reviennent se fondre, titre éparpillé. Halo, rayons et traînées tournantes aux
  couleurs de la pochette. Trois fils, un par source (sub, mélodie, voix) : chacun n'apparaît que quand sa source
  joue, brille avec elle et se pince à chacune de ses notes ; sur la grille du rythme, ils s'éclairent à chaque temps et
  se pincent doucement à chaque début de mesure. Le titre fait une ola à chaque kick et s'efface après 8 s.
- **Retour** (2 s de pause ou sans musique, interrupteur coupé, clic sur le lecteur) : la boule s'accroupit, saute au
  kick suivant, l'île descend la chercher, un pont liquide se forme ; l'île reprend sa largeur, exactement à sa place.
- **Réduire les animations** : fondus seulement.

## Chaque animation et ce qui la lance (2026-11-03)
| Animation | Ce qu'elle fait | Ce qui la lance |
|---|---|---|
| Départ | l'île se tasse, une goutte part tenue par un col de 5 boules qui s'étire et casse, la boule tombe, s'écrase, la pochette apparaît après 0,55 s | mode musique allumé, musique qui joue, île visible et fermée ; part sur le kick suivant (au plus tôt 0,15 s, au plus tard 0,6 s) |
| Retour | la boule s'accroupit, saute, l'île descend la chercher, pont liquide, l'île reprend sa largeur avec un rebond | 2 s de pause ou plus de musique, interrupteur coupé, clic sur le lecteur ; saute sur le kick suivant (0,6 s au plus) |
| Rotation | la pochette fait un tour toutes les 8 temps | tempo de l'IA du rythme (sinon celui des kicks) ; jamais poussée par les coups |
| Respiration | la bulle grossit avec la sub (+3,5 %), le kick la « pompe » | la sub (30–60 Hz) en continu |
| Kick | taille +12 % en deux images, contraction, rebond ; petite onde ; ola du titre ; halo | un kick détecté (forces : v^1,4, −33 % sous une mélodie pleine, ×0,6 hors des temps de la grille, montée en 2,5 s au démarrage) |
| Caisse claire | la bulle se tord (cisaillement), le titre penche ; pendant une montée, elle pousse la taille | une caisse claire détectée |
| Charleston | une ondulation fine (16 lobes) passe sur le bord | un charleston détecté |
| Crash | flash, séparation des couleurs, secousse, deux grandes ondes, 8 gouttes lancées qui reviennent, titre éparpillé, traînées qui changent de sens | une cymbale crash (aigus qui montent avec la caisse claire et le charleston, nettement au-dessus de l'habitude) ou un drop (300 ms 1,8 fois plus forts que les 4 s) ; 0,9 s entre deux ; aucun dans les 2,5 premières s |
| Supernova (idée de Thomas) | la bulle s'effondre, plus petite (45 %) et étirée en ovale qui tourne, puis explose en 30 petites billes qui se baladent selon leur vitesse ; chacune revient en spirale de plus en plus serrée et rapide autour du disque, avalée par son trou noir (toutes, décalées) ; le disque regrossit à chaque bille (≈ 2,8 s) | le drop : la batterie qui revient après au moins 2 s sans kick (kick fort, ou basse présente ; jamais le tout premier kick), ou un crash juste après une montée ou un silence |
| Éclosion | 8 gouttes nées sur le fil de la voix tournent en spirale et se fondent (fleur à lobes ronds), flash doux, onde pâle, fil de la voix pincé fort | une voix (> 0,35) après au moins 3 s sans voix (< 0,12) |
| Souffle | la bulle gonfle lentement (≈ +14 % × intensité) et se relâche, grande onde lente, gouttes qui flottent, traînées qui changent de sens | la musique se pose (plus de kick depuis 2 s) juste après un drop ou une montée, au début de mesure suivant (2,5 s au plus) |
| Grondement et grésillement | la bulle tremble ronde (~9 Hz), respire plus fort, halo et fil de la sub plus épais ; ~30 fois/s : couleurs qui se séparent par éclairs, secousse de 1–3 px, bord qui frémit, fil de la sub qui crépite | la sub écrase le son plus que d'habitude (`heavy` : 1,25 à 2 fois sa part habituelle) ; un tiers sous une sub seulement forte et tenue |
| Montée | halo qui baisse, bulle et fils qui se resserrent (−15 % / −22 %) | la section « montée » (pas de kick depuis 2 s, aigus qui montent) |
| Silence avant le drop | halo presque éteint, fils à 20 % | un silence juste après une montée (150 ms au moins) |
| Fils | chaque fil monte à sa place quand sa source joue (0,25 s) et redescend se poser sur la bulle en contour quand elle se tait (0,8 s) ; pincé à chaque note (bosse étroite et vive si les notes sont hachées, large et lente si elles sont douces) ; s'éclaire à chaque temps, se pince doucement à chaque début de mesure | sub, mélodie, voix ; le tranchant des notes (`sharp`) ; la grille du rythme |
| Titre | ola sur les kicks, penche sur la caisse claire, éparpillé sur le crash ; s'efface après 8 s | chaque nouveau morceau le remontre |
| Changement de morceau : la Voie lactée | la bulle tourne vite et se décroche en 5 bras enroulés autour d'elle, chacun s'affinant en pointe, sortis puis rentrés sur un ressort à peine élastique (les bouts traînent un peu, comme de l'encre), puis refondus (≈ 1,8 s) ; la nouvelle pochette en fondu (0,4 s), onde douce, fils pincés, couleurs qui glissent (0,6 s) | un autre morceau pendant que le lecteur joue |

**Espacement des grands moments** (adaptatif, `moments.ts`) : compté en mesures de la grille du rythme (2 s tant
qu'elle manque) et selon leur rang (Supernova, puis crash, puis Éclosion et Souffle) : un plus grand peut suivre un plus
petit d'un quart de mesure, un égal attend 1 mesure, un plus petit 2 ; le même revient après 4 mesures (un crash après
1). Tous suivent « Intensité des grands moments » ; le grondement suit « Intensité de la basse ».

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
- `grid.ts` — la grille du rythme (les temps de l'IA prolongés entre deux analyses, la mémoire du tempo de chaque
  morceau) ; `tempo.ts` — le tempo tiré des kicks, quand la grille manque.
- `useMusicStage.ts` — le crochet React qui démarre le moteur, le nourrit (`onMusicFrame`, `onMusicBeats`) et l'arrête.
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
- `continuous.rs` — les niveaux continus : sub (30–60 Hz), voix et mélodie, et la hauteur de la mélodie (centre de
  gravité du spectre entre 250 et 4 000 Hz, en échelle log). Le son est lu en stéréo (`loopback.rs`) : la voix est ce
  qui est au milieu du mix dans 300–3 400 Hz (ce que les côtés n'expliquent pas), la mélodie le reste de 250–5 000 Hz ;
  un morceau mono n'a pas de voix (la mélodie comme avant).
- `rhythm.rs` — l'IA du rythme (voir ci-dessous).
- `form.rs` — la forme du morceau : montée, silence avant le drop, drop, section.
- `music.rs` — l'analyseur qui assemble le tout ; tests dans `music_tests.rs` et `music_sounds.rs` (sons de synthèse).
- L'événement `music-frame` (`MusicFrame`) : les coups depuis la trame précédente (une trame au plus toutes les 10 ms),
  et au moins toutes les 16 ms les niveaux (toutes les 250 ms quand rien ne bouge). Côté page : `onMusicFrame`
  (`src/ipc/events.ts`), puis `StageEngine.feed`, qui retarde l'image du « Décalage son/image ».
- Coût mesuré (release) : 29 µs par analyse, 0,5 % d'un cœur. Le kick est détecté environ 15 ms après son attaque.

## IA du rythme (2026-11-03)
**Beat This!** (CPJKU, ISMIR 2024, licence MIT), son petit modèle `small0` et son spectrogramme en ONNX, lancés en
local par ONNX Runtime 1.31.1 (Microsoft, MIT) : toutes les 8 s, il lit les 10 dernières secondes du son et trouve les
temps et les débuts de mesure (`rhythm.rs`, son propre fil d'exécution, seulement pendant le mode musique). La page
garde la grille et la prolonge (`grid.ts`) : la pochette tourne à son tempo, les fils battent les temps, un kick hors
des temps et des demi-temps compte à 60 % (une note de basse lue comme kick), et le tempo de chaque morceau est gardé
(`localStorage`, 300 morceaux) pour tourner juste dès la seconde écoute.
- **Mesure** (MUSDB18, 130 extraits avec une batterie régulière ; référence : Beat This! sur la batterie seule) :
  grille de Kayro tirée de ses kicks F = 0,37, Beat This! sur le mix F = 0,75 → **2,5 fois moins d'erreurs**, meilleur
  sur 76 % des morceaux. Limite : la référence vient du même modèle (sur la batterie seule), ce qui l'avantage un peu.
- **Écarté** : EfficientAT mn10 (étiquetage AudioSet) pour « qui joue » : sur les mêmes extraits, AUC voix 0,53,
  basse 0,49, instruments 0,28, contre 0,76 / 0,74 / 0,81 pour l'analyse de Kayro ; il étiquette un morceau entier
  (« Musique », « Reggae »), pas la voix instant par instant.
- **Coût** : environ 300 ms de calcul sur un cœur toutes les 8 s (≈ 4 % d'un cœur), le temps du mode musique.
- **Coupé** : « Qualité » à Basse (ou Auto dans le mode Éco de Kayro) ; sans ses fichiers, la grille manque et le
  tempo des kicks reste.
- **Fichiers** : `src-tauri/resources/ai/` (hors git), récupérés par `scripts/fetch-ai.ps1` (empreintes vérifiées,
  lancé par les builds s'ils manquent), installés dans `ai/` à côté de Kayro.
- **Mesurer à nouveau** : `scripts/ai-eval/` ; outils Rust `examples/music_probe.rs` (l'analyse de Kayro sur un fichier)
  et `examples/rhythm_probe.rs` (la grille de l'IA).

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

# Étape 13 — Mesures de performance en production (2026-10-13)

Séance unique avant le gel de la DA. Rien n'a été corrigé pendant la séance : ce document mesure, note et propose.
Fusion des deux listes : `_kit/PROMPTS.md` (étape 13) et toutes les cases « à mesurer à l'étape 13 » de `docs/DA-JOURNAL.md`.

## Verdict
> Corrections appliquées le 14/10, puis remesurées : voir **« Après corrections (2026-10-14) »** en fin de document.

- **Budget p95 ≤ 5,4 ms tenu dans toutes les cases, sauf une** : l'**onde de changement de thème en Éco** (le « Fondu » de 0,9 s). Son p95 vaut 7,2 à 10,7 ms, avec 94 à 136 images > 8 ms par 10 s.
- Hors budget p95, il y a **trop d'images > 8 ms** pendant :
  - la liaison, les onglets, l'onde, le survol qui change, le panneau, en Élevée ;
  - les passages entre modes, dans les deux qualités.
- **Pulsation C de l'ouverture : 0 image > 8 ms** sur 7 lancements (4 en Élevée, 3 en Éco). Cible ≤ 8 ms tenue.
- **Repos visible : CPU de 1,2 à 4,2 %**. La cible de CLAUDE.md (< 1 %) n'est pas tenue. Hub masqué et widget au repos : ≈ 0 % de CPU, 0 % de GPU de l'app.
- **Points ouverts** :
  - `--quit` : sain (11 fermetures sur 11, en 38 à 53 ms, par la boucle) ;
  - flash du lancement : aucun ;
  - image blanche : non reproduite. En revanche, une **capture CDP perturbe l'image affichée à l'écran** ;
  - A10 (`will-change`) : aucun gain ;
  - particules coupées : aucun gain.

## Conditions
- **Exe** : `target\release\Kayro.exe` du 13/10 18:18, identique à HEAD `8c31414` (tag `da-r5-fix-b`) : aucun source plus récent. Le WebView2 est en débogage local (port 9222) pour les lancements avec CDP.
- **Machine** : Ryzen 5 5600G, RTX 5070. Écran 1 en 2560×1440 à 280 Hz (API Windows), page de 1707×960 CSS, dpr 1,5. Les animations de Windows sont actives (rien à réduire).
- **Charge de fond** :
  - Comet et Steam ont été fermés proprement avec ton accord avant la séance.
  - Restaient ouverts : Discord, Voicemeeter, HueSync, Wallpaper Engine (`wallpaper64`), Medal et l'app Claude.
  - Fond CPU médian (machine moins Kayro) : **6,9 %**, outils de mesure compris (PowerShell, `Get-Counter`).
  - **Wallpaper Engine prend ≈ 20,5 % du GPU dès que le bureau se voit**, c'est-à-dire en mode fenêtre, en widget et hub masqué. Le GPU de dwm de ces cases l'inclut : sa base, hub masqué, est de **2,96 %**.
- **Données** : dossier de test (le `APPDATA` de l'exe pointe vers le scratchpad), avec ton `settings.json` et ton `state.json` copiés (Lavande-pêche, immersif) et 15 apps de test dont les cibles n'existent pas. Jeux : 6 apps, donc 5 cartes visibles ; Créativité est vide. Une scène de test.
- **Tes fichiers** (`%APPDATA%\Kayro`) : SHA-256 identiques avant et après. L'exe ne les a jamais ouverts.
- **Incident** : à 21:18, « Modrinth App » s'est ouvert et a pris le premier plan. La charge de fond est montée à 22–40 % du CPU et 26–43 % du GPU.
  - Toutes les mesures en Élevée de I3 à E1 prises à partir de là ont été **écartées et refaites** (21:29–21:38) après la fermeture propre de Modrinth.
  - Deux essais où Discord avait pris le focus (R5 et R6 en Élevée, essai 1) ont été écartés et remplacés.
  - Pendant la reprise, aucun essai n'a perdu le focus.
- **Captures** : fenêtre Kayro seulement, 230 au total, toutes supprimées en fin de séance.

## Méthode
- **Images** : une sonde `requestAnimationFrame` injectée par CDP mesure l'intervalle entre deux images, sur 10 s, comme dans les rondes précédentes. Elle donne le p95, le max et le nombre d'images > 8 ms.
  - « Pendant » une animation : images qui finissent dans la fenêtre qui suit chaque déclenchement. Les durées de ces fenêtres sont données dans le second tableau.
  - « Pire / occ. » : nombre maximal d'images > 8 ms pour une seule occurrence.
  - À 278 Hz, une image dure 3,6 ms : un p95 de 3,7 ms veut dire qu'aucune image n'est perdue.
- **Coût** : fenêtre de 10 s **séparée, sans la sonde**. On y relève :
  - le CPU de l'arbre Kayro + WebView2 (7 processus), en % de la machine (12 threads) ;
  - le GPU 3D de l'arbre, de dwm et de la machine (compteurs « GPU Engine », 8 échantillons) ;
  - la mémoire privée de l'arbre, à la fin de la fenêtre.
- **Essais** : 2 par case, et un 3e si les deux s'écartent (p95 > 0,3 ms, images > 8 ms à ±2, CPU ±30 %) ou si un budget saute. Les valeurs ci-dessous sont des médianes ; les nombres d'images > 8 ms sont donnés essai par essai.
- **Entrées** : vraies entrées souris et clavier par CDP. Les réglages passent par `settings_set`, le même chemin que l'interface. Avant chaque essai, `AppActivate`, plus le rattachement au fil du premier plan si besoin ; l'essai est écarté si Kayro n'est pas au premier plan au début ou à la fin.
- **Tolérance** (validée) : 1 image > 8 ms par occurrence d'une animation signature. Sont des signatures : l'ouverture, la liaison, l'onde de thème (impact compris), le déroulé avancé, le passage entre modes et le widget déroulé.

## Tableau par case — Élevée / Éco
p95 et max en ms ; « > 8 ms » = images par 10 s, par essai ; CPU, GPU, dwm en % ; mémoire en Mo.

| Case | p95 É / Éco | > 8 ms É / Éco | max É / Éco | CPU É / Éco | GPU app É / Éco | GPU dwm É / Éco | Mém. É / Éco | |
|---|---|---|---|---|---|---|---|---|
| R1 Éventail au repos (Visible) | 3,7 / 3,7 | 0,0 / 0,0 | 3,8 / 4,0 | 2,16 / 1,17 | 4,03 / 0,94 | 1,17 / 0,42 | 468 / 496 | ✅ |
| R5 Éventail, particules Non | 3,7 / 3,7 | 0,0 / 0,0 | 7,2 / 4,0 | 2,17 / 1,48 | 4,03 / 0,94 | 1,16 / 0,42 | 468 / 482 | ✅ |
| R2 Carrousel au repos, Visible | 3,7 / 3,7 | 0,1 / 0,0 | 17,7 / 3,9 | 3,65 / 2,82 | 7,09 / 2,65 | 1,23 / 0,59 | 604 / 564 | ✅ |
| R2-max Carrousel, Marquée + particules | 3,7 / 3,7 | 0,0 / 0,0 | 3,9 / 7,2 | 4,24 / 2,71 | 6,02 / 2,70 | 2,25 / 0,59 | 589 / 567 | ✅ |
| R3 Carrousel au repos, Aucune | 3,7 / 3,7 | 0,0 / 0,0,0 | 3,8 / 4,0 | 2,47 / 1,18 | 4,49 / 1,23 | 1,38 / 0,58 | 512 / 498 | ✅ |
| R4 A10 : R2 + `will-change` injecté | 3,7 / 3,7 | 1,0 / 0,0 | 10,7 / 7,3 | 3,92 / 2,89 | 7,00 / 2,78 | 1,25 / 0,71 | 584 / 564 | = R2 |
| R6 Carrousel, particules Non | 3,7 / 3,7 | 0,0 / 0,0 | 3,8 / 3,9 | 3,59 / 2,95 | 6,96 / 2,74 | 1,22 / 0,67 | 615 / 567 | ✅ |
| R9 Catégorie vide (carte qui flotte) | 3,7 / 3,7 | 0,0 / 0,0 | 3,9 / 3,8 | 3,46 / 1,28 | 3,66 / 1,17 | 1,25 / 0,70 | 568 / 504 | ✅ |
| R7 Mode fenêtre au repos | 3,7 / 3,7 | 0,0 / 0,0 | 3,9 / 3,9 | 3,68 / 2,42 | 3,59 / 2,13 | 5,09* / 4,26* | 471 / 618 | ✅ |
| R8 Widget au repos | 3,7 / 3,7 | 0,0 / 0,0 | 7,6 / 3,9 | 0,04 / 0,02 | 0 / 0 | 2,98* / 2,97* | 417 / 568 | ✅ |
| R10 Hub masqué (coût seul, Élevée) | — | — | — | 0,05 | 0 | 2,96* | 697 | ✅ |
| I2 Survol continu, éventail | 3,7 / 3,7 | 0,0 / 0,0 | 7,2 / 4,0 | 4,09 / 2,17 | 5,68 / 1,15 | 1,51 / 0,42 | 491 / 500 | ✅ |
| I4 Survol qui change, éventail | 3,7 / 3,7 | 0,0 / 0,0 | 7,2 / 3,9 | 3,99 / 2,01 | 5,26 / 1,16 | 1,40 / 0,41 | 505 / 504 | ✅ |
| I1 Survol continu, carrousel | 3,7 / 3,7 | 1,2 / 0,0 | 10,8 / 4,3 | **12,32** / 6,15 | **15,92** / 4,23 | 3,18 / 2,33 | 692 / 540 | ⚠ coût |
| I3 Survol qui change, carrousel | 3,7 / 3,7 | 8,7,8 / 0,0 | 14,3 / 3,8 | 8,46 / 4,24 | 9,90 / 3,64 | 2,02 / 1,54 | 792 / 621 | ⚠ É |
| I5 Changement d'onglet | 3,7 / 3,7 | 18,30,20 / 2,4 | 17,9 / 10,7 | 13,40 / 6,74 | 15,07 / 4,60 | 3,24 / 2,58 | 1 122 / 880 | ⚠ É |
| I6 Panneau Réglages (ouvre / ferme) | 3,7 / 3,7 | 10,4,4 / 0,0 | 17,8 / 7,1 | 7,41 / 5,32 | 11,35 / 6,31 | 2,57 / 2,18 | 940 / 797 | ⚠ É |
| I7 Interrupteur | 3,7 / 3,7 | 0,0 / 0,0 | 3,8 / 3,8 | 4,90 / 3,22 | 7,00 / 3,43 | 1,34 / 0,91 | 725 / 659 | ✅ |
| I8 Liaison éventail → carrousel (+ retour) | 3,7 / 3,7 | 13,11,12 / 5,2,2 | 21,5 / 21,4 | 8,09 / 3,44 | 9,00 / 1,71 | 1,94 / 0,76 | 1 012 / 911 | ⚠ É |
| A2 Onde de thème (Éco = Fondu) | 3,7 / **7,2–10,7** | 19,18,18 / **136,94,118** | 28,7 / **50,0** | 11,10 / 8,89 | 13,43 / 6,08 | 2,47 / 1,50 | 1 342 / 1 707 | ❌ Éco |
| A3 Déroulé « Personnalisation avancée » | 3,7 / 3,7 | 0,0 / 0,0 | 7,1 / 7,2 | 5,74 / 4,50 | 8,38 / 4,48 | 1,74 / 1,32 | 824 / 734 | ✅ |
| A4 Passage immersif ⇄ fenêtre (info) | 3,7 / 3,7 | 11,9,11 / 8,7,8 | 35,7 / 32,2 | 4,87 / 2,95 | 9,68 / 2,74 | 5,59* / 2,80* | 1 039 / 1 004 | ⚠ |
| A5 Widget déplie / replie (info) | 3,7 / 3,7 | 0,0 / 0,1 | 7,2 / 10,5 | 1,84 / 1,35 | 1,30 / 0,87 | 6,08* / 5,11* | 390 / 395 | ✅ |
| A6 Menu du mode (Élevée, info) | 3,7 | 1,0 | 10,7 | 4,26 | 6,50 | 1,38 | 776 | ✅ |
| E1 Éditeur : réordonner (Alt+↓, info) | 3,7 / 3,7 | 0,0 / 2,0 | 7,2 / 71,5 | 2,99 / 1,91 | 4,45 / 1,60 | 1,42 / 0,89 | 667 / 721 | ✅ (Éco : 1 image isolée de 71,5 ms) |

\* dwm avec le bureau visible, donc avec Wallpaper Engine : sa base est de 2,96 % (hub masqué). Ce que Kayro ajoute réellement :
- fenêtre ≈ +2,1 / +1,3 ;
- widget ≈ 0 ;
- widget qui se déplie ≈ +3,1 / +2,1 ;
- passages : on ne peut pas les interpréter, car ils mélangent des phases plein écran (fond d'écran en pause) et des phases en fenêtre.

### Pendant les animations (par occurrence)
| Animation | Fenêtre | Occurrences / 10 s | Pire / occ. É / Éco | Max pendant É / Éco | Tolérance (1) |
|---|---|---|---|---|---|
| Liaison (clic → carrousel) | 2 200 ms | 2 | 3–4 / 0–1 | 18,0 / 10,8 | ❌ É, ✅ Éco |
| Retour (« Toutes les catégories ») | 1 700 ms | 2 | 2–3 / 1 | 21,5 / 21,4 | ❌ É, ✅ Éco |
| Onde de thème, impact compris | 1 300 ms | 4 | 5–9 / **30–36** | 28,7 / 50,0 | ❌ / ❌ |
| Déroulé avancé (ouverture) | 1 000 ms | 2 | 0 / 0 | 7,1 / 7,2 | ✅ |
| Passage immersif ⇄ fenêtre | 700 ms | 3 | 3–6 / 3 | 35,7 / 32,2 | ❌ / ❌ |
| Widget déroulé | 800 ms | 3 | 0 / 0–1 | 7,2 / 10,5 | ✅ |
| Onglet (pas une signature) | 1 300 ms | 7 | 4–10 / 1 | 17,8 / 10,7 | — |
| Survol qui change, carrousel | 1 100 ms | 8 | 1–2 / 0 | 14,3 / 3,8 | — |
| Panneau, ouverture / fermeture | 600 / 400 ms | 6 / 6 | 1–2 / 0 | 17,8 / 7,1 | — |

### Ouverture, pulsation C (A1) — 7 lancements, CDP branché dès 0,70–0,77 s
| Lancement | Ouverture (bg présent) | Images > 8 ms dans l'ouverture (max) | Pulsation (900 ms, ringOut à 1,76–1,77 s) |
|---|---|---|---|
| L3–L6 Élevée | 4,61–4,62 s | 4 / 5 / 2 / 4 (24,9 / 35,7 / 21,5 / 39,2 ms) | **0 image > 8 ms** ×4, max 3,7–3,8 ms, p95 3,7 |
| L7–L9 Éco | 4,64–4,65 s | 2 / 2 / 2 (21,5 / 18,0 / 17,8 ms) | **0** ×3, max 3,7–3,8 ms (pas d'onde en Éco : même instant pris dans la chronologie) |

Les images lentes de l'ouverture tombent toutes hors de la pulsation, très probablement à son démarrage : montage, premier dessin du moteur. **À vérifier** : la sonde ne date pas chaque image lente dans la chronologie.

## Points ouverts
- **P1 `--quit` en vrai** : ✅
  - **11 fermetures sur 11** : 2 instances normales, 7 avec CDP branché, 2 en fin de bloc.
  - L'instance part en **38 à 53 ms**, toujours par la boucle : « quit: asking the event loop to end » → « exit requested » → « exit: the event loop ended ».
  - Le **filet de 3 s n'a jamais servi** (aucun « leaving directly »).
  - Deux `--quit` **simultanés** : l'instance part en 49 ms. Une seule demande est journalisée, la seconde se termine sans ligne ; les deux processus `--quit` finissent.
  - Le journal s'écrit bien. Le silence de ton journal depuis 02:09 vient donc de l'exe, qui n'a pas tourné sur ton profil depuis.
  - Le blocage du 13/10 (boucle de messages imbriquée) n'a pas été reproduit.
- **P2 image blanche (A8)** : **non reproduite**.
  - 4 premiers changements de thème de session, chacun 0,9 s après l'onglet Thèmes : 2 avec la rafale d'écran Windows seule, 2 avec une capture CDP à 349–350 ms en plus. Pixels blancs : 0,11–0,12 % dans chaque image, soit le texte, comme avant le clic.
  - **Constat nouveau** : pendant une capture CDP (`Page.captureScreenshot` avec cadrage), **l'écran montre 70 à 150 ms d'image fausse**. Le fond devient sombre, avec seulement le tiers haut-gauche de la page rendu. Vu sur 2 essais sur 2, et dans l'essai du filet avec CDP.
  - Conclusion : l'hypothèse « artefact de la capture CDP » est la plus solide, et la règle du protocole permet de **clore le point**. À toi de décider.
  - **Preuve du filet (A8) : non faite.** Une feuille injectée masquant `::view-transition-old(root)` n'a rien changé à l'écran : l'ancienne vue reste visible hors du cercle, en rafale Windows sans CDP. Je ne sais donc pas provoquer une « image ancienne manquante » de cette façon. Le filet n'est toujours pas prouvé dans l'exe.
- **P3 flash du lancement** : ✅ **aucun**, sur 2 lancements sans débogage.
  - Rafale de la fenêtre dès qu'elle est visible, toutes les ~30 ms. La première image est sombre (luminance 3,6–5,8 sur 255) et monte régulièrement jusqu'à 7 en 450 ms (fond de l'ouverture). Aucun pixel clair pendant les 1,3 premières secondes.
  - On ne voit ni le bureau ni le fondu de Windows à travers.
- **P4 A10 (`will-change` sur `[data-float]`)** : aucun gain, ni en p95, ni en CPU, ni en GPU.
  - Élevée : R2 → R4, CPU 3,65 → 3,92 %, GPU 7,09 → 7,00 %. Éco : CPU 2,82 → 2,89 %, GPU 2,65 → 2,78 %.
  - Garder `FLOAT_RHYTHM.promote: false`.
- **P5 flottaison à 30 i/s, particules coupées** : **aucun gain**.
  - Éventail : 2,16 → 2,17 % de CPU, 4,03 → 4,03 % de GPU. Carrousel : 3,65 → 3,59 % / 7,09 → 6,96 %.
  - Cause probable, par déduction (la cadence du moteur n'a pas été relevée) : le moteur reste à la cadence d'ambiance de 60 i/s pour d'autres raisons (bokeh qui respire, anneau et gouttes, lune). Couper les particules ne lui fait pas baisser sa cadence.
  - Ce qui coûte, c'est la **flottaison du carrousel** elle-même (Visible contre Aucune) : +1,2 pt de CPU et +2,6 pt de GPU en Élevée, +1,6 / +1,4 en Éco.
  - « Marquée » tient le budget : p95 3,7 ms, 0 image > 8 ms.
- **P6 qualité « Auto »** : voir la proposition plus bas.
- **Mémoire** (privée, tout l'arbre) :
  - de 0,47 à 0,62 Go au repos ;
  - 1,0–1,4 Go en Élevée pendant les liaisons, les onglets et l'onde ;
  - **jusqu'à 2,1 Go pendant le Fondu en Éco**, en hausse d'un essai à l'autre : 1,53 → 1,71 → 2,10 Go.
  - Elle redescend ensuite (0,70 Go à la case suivante).

## Ce qui dépasse : cause probable et correction proposée
1. **Onde de thème en Éco (« Fondu »)** : p95 7,2–10,7 ms ❌, 30–36 images > 8 ms par changement, max 50 ms, pic de 2,1 Go.
   - **Cause probable** : le Fondu passe par les transitions CSS de toutes les variables du thème, enregistrées en `@property`, sur `<html>`, pendant 0,9 s (`applyTheme`, `ThemeProvider`). À chaque image, le style de tout le document est recalculé et toute la page est repeinte.
   - **Correction** : un fondu d'image plutôt qu'un fondu de variables, par exemple une View Transition en simple fondu (une capture, puis de l'opacité sur le compositeur). Ou bien « Direct » par défaut en Éco.
2. **Onde de thème en Élevée** : 5–9 images > 8 ms par changement ❌ (tolérance 1), max 28,7 ms ; le p95 global tient.
   - **Causes probables, à séparer par une trace** :
     - la capture de la page à l'impact (1 ou 2 images, attendues) ;
     - l'animation de `--wave-band` (`@property`, sur le fil principal, ajoutée en B1) ;
     - le `clip-path: circle()` animé sur un calque plein écran.
   - **Correction** : profiler une occurrence. Pistes :
     - faire le halo fixe de B1 avec deux calques en opacité ;
     - révéler le cercle par un masque mis à l'échelle (`transform`).
3. **Liaison et onglets en Élevée** : liaison 3–4 images > 8 ms par occurrence ❌, retour 2–3 ❌, onglet 4–10 (18–30 par 10 s). En Éco : 0–1.
   - **Cause probable** (déjà vue en 3b) : le rendu React au clic (catégorie, titre, onglets), plus le moteur en cadence écran pendant la séquence. En Éco, il est à 30 i/s.
   - **Correction** :
     - différer ce qui ne se voit pas tout de suite (`startTransition`) ou préparer la catégorie suivante ;
     - plafonner le moteur à 60 i/s pendant une séquence.
4. **Survol continu du carrousel en Élevée** : c'est l'état stable le plus cher, avec **12,3 % de CPU et 15,9 % de GPU** (contre 4,1 / 5,7 pour l'éventail), et 1–2 images > 8 ms.
   - **Cause probable** : le pointeur bouge, donc le moteur passe en cadence écran (≤ 144 i/s) pour la lumière du curseur et les reflets ; la boucle des filets tourne en plus à 60 i/s.
   - **Correction** : un moteur ≤ 60 i/s quand seul le pointeur bouge.
5. **Panneau Réglages en Élevée** : 4–10 images > 8 ms par 10 s, 1–2 par occurrence ; 0 en Éco. GPU de l'app à 11,4 %.
   - **Cause probable** : le dialogue se monte et sa cascade joue pendant que le moteur dessine tout l'écran à pleine cadence, sous un voile de 0,62.
   - **Correction** : moteur à 30 i/s, ou figé, tant qu'un dialogue couvre la scène.
6. **Survol qui change, carrousel, en Élevée** : environ 1 image > 8 ms à chaque entrée (7–8 par 10 s), max 14,3 ms ; 0 en Éco.
   - **Cause probable** : à l'entrée du niveau 3, le calque des filets est déplacé dans l'emplacement survolé (déplacement dans le DOM, recalcul du style) et le voile démarre.
   - **Correction** : un calque de filets déjà en place par emplacement, ou créé d'avance.
7. **Passages immersif ⇄ fenêtre** : 3–6 images > 8 ms par passage, max 32–36 ms, **dans les deux qualités**.
   - **Cause probable** : le redimensionnement de la WebView (2560×1440 ⇄ 1280×760), donc un nouveau rendu de toute la page.
   - En Élevée, la page est effacée pendant ce temps : c'est probablement invisible, **non vérifié image par image**. En Éco (changement direct), c'est visible.
   - **Correction** : d'abord dater ces images par rapport à « out » et « in » ; rien à faire si elles tombent dans le noir.
8. **CPU au repos > 1 %** (cible de CLAUDE.md) :
   - Élevée : éventail 2,2 %, carrousel 3,7 %, carrousel sans flottaison 2,5 % ;
   - Éco : 1,2 / 2,8 / 1,2 %.
   - **Cause probable** : la boucle d'ambiance du moteur (60 i/s en Élevée, 30 en Éco) et la flottaison du carrousel. Les particules ne comptent pas.
   - **Correction** : ambiance à 30 i/s en Élevée aussi quand rien n'est interactif, ce qui fait enfin payer la flottaison à 30 i/s. Flottaison du carrousel dessinée par le moteur seul, sans `transform` DOM à chaque image (à évaluer).

## Corrections proposées, classées par gain
| Rang | Correction | Gain attendu (mesuré → visé) | Effort |
|---|---|---|---|
| 1 | Fondu de thème en Éco par image (View Transition en fondu) ou « Direct » en Éco | seul budget raté : p95 10,7 → ~3,7 ms ; 30–36 → ≤ 1 image lente par changement ; pic de 2,1 Go | faible |
| 2 | Plafonds de cadence du moteur : ≤ 60 i/s si seul le pointeur bouge ; 30 i/s ou figé sous un dialogue ; ambiance à 30 i/s en Élevée au repos | survol continu 12,3 % CPU / 15,9 % GPU ; panneau 4–10 images lentes ; repos 2,2–3,7 % → viser < 1–1,5 % (**estimation non mesurée**) | moyen |
| 3 | Onde en Élevée : trace, puis `--wave-band` et le cercle passés au compositeur | 5–9 → 1–2 images lentes par changement | moyen |
| 4 | Liaison et onglets : rendu au clic différé ou préparé ; moteur à 60 i/s pendant la séquence | liaison 3–4 → ≤ 1 ; onglet 4–10 → ≤ 2 par occurrence | moyen |
| 5 | Survol qui change : calque des filets en place par emplacement | ~1 image lente par entrée → 0 | faible |
| 6 | Passages : dater les images lentes (dans le noir ou non) | information ; rien si elles sont invisibles | faible |
| 7 | Retirer le mécanisme A10 dormant (`FLOAT_RHYTHM.promote`) | aucun gain de perf (simplification) | très faible |
| 8 | Outils : verser le banc dans `scripts/perf/` (`npm run perf:report`, item 6 de l'étape 13) ; jamais de capture CDP pendant une mesure | mesures rejouables ; pas d'artefact | faible |

## Qualité « Auto » : proposition (non codée)
Aujourd'hui, « Auto » vaut Élevé, avec le repli du moteur. Proposition, d'après les chiffres ci-dessus :
- **Signal** : intervalles d'images (rAF, déjà relevés par le moteur) sur une fenêtre glissante de 2 s. Budget = 1,5 × la période de l'écran où se trouve la fenêtre, soit 5,4 ms ici.
- **Images en signature masquées** : le chorégraphe sait quand une signature joue. Ces images comptent à part, avec 1 image > 8 ms tolérée par occurrence, et n'entrent pas dans la décision.
- **Descente d'un cran** :
  - si le p95 dépasse le budget sur 2 fenêtres de suite hors signature ;
  - ou s'il y a plus de 3 images > 8 ms en 2 s hors signature ;
  - ou, côté Rust (`sysinfo`), si le CPU de l'arbre dépasse 3 % pendant 30 s alors que l'interface est au repos.
  - **Remontée** après 30 s stables (p95 ≤ 1,1 × la période, 0 image > 8 ms).
  - **Hystérésis** : pas de remontée pendant 60 s après une descente ; 2 allers-retours en 10 min → niveau figé jusqu'au redémarrage. Jamais d'Ultra automatique.
- **Échelle, par coût mesuré**. Les réglages coûteux tombent avant le niveau entier :
  1. plafonds de cadence (correction 2) ;
  2. survol du carrousel Complet → Simple (12,3 % de CPU en survol, contre ~4 % au niveau de l'éventail) ;
  3. flottaison Visible → Légère / Aucune (−1,2 pt de CPU, −2,6 pt de GPU) ;
  4. Élevé → Éco : GPU de l'app ÷ 2,7 à 4,3, CPU ÷ 1,3 à 2,1 au repos, dwm ÷ 2,1 à 2,8.
  - Les particules ne sont **pas** un levier : aucun gain mesuré.
- **Prérequis** : réparer le Fondu en Éco (correction 1), ou forcer « Direct » en Éco quand Auto y descend. Sinon, descendre en Éco **dégrade** le changement de thème.
- **Machine** : sur batterie, Équilibré au plus. Le budget se recalcule quand la fréquence de l'écran change. Ici, le point faible est le **CPU au repos** (2–4 % pour une cible de 1 %), pas le GPU.
- **Banc au premier lancement** (3 s, carrousel + pointeur qui bouge) : Élevé si le p95 ≤ 1,1 × la période et 0 image > 8 ms, sinon le premier cran de l'échelle. Ce PC passerait en Élevé.

## Non mesuré (et pourquoi)
- **Voile CSS de la pulsation C** : variante d'atelier absente de l'exe (ton choix : moteur seul).
- **« Tester » une scène** : lancerait la chaîne (risque de dialogue Windows).
- **Repli CSS** (ouverture, moteur coupé), replis « budget » et « contexte perdu » : autre chemin, hors séance.
- **60 Hz** : il aurait fallu changer tes réglages d'affichage.
- **Équilibré et Ultra** : non demandés.
- **CPU et GPU de l'ouverture** : une fenêtre de coût de 10 s ne tient pas dans une ouverture de 4,6 s jouée une fois. Seules les images ont été mesurées.
- **Instant exact des images lentes** dans l'ouverture et dans les passages : la sonde ne donne que des comptes par fenêtre.
- **Cadence réelle du moteur** pour P5 : elle a été déduite du GPU, pas relevée.

## Après corrections (2026-10-14)
Séance de remesure en production, exe du 14/10 à 18:08, avec le banc `scripts/perf/` (`npm run perf -- --cases … --compare <13/10>`).
- **Conditions** : PC libre ; jeux, launchers, Comet et Modrinth fermés ; Wallpaper Engine en pause ; pas de capture CDP.
- **Essais** : 2 par case (3 pour I8, I5, A2 et A4), aucun écarté pour perte de focus.
- **Fond hors Kayro** : CPU 5–15 % de la machine, GPU 1,3–1,8 %.

**Ce qui a été corrigé**, en 4 paquets, avec un rendu identique à l'œil (validé par toi à chaque arrêt) :
1. **Banc `scripts/perf/`** : données de test recréées à chaque séance, une seule commande, comparaison avant / après, traces et profils sans capture. **A10 retiré.**
2. **Cadence** :
   - plafonds du moteur en tokens (`CADENCE`) : 60 i/s pour le pointeur seul, 30 au repos, 30 sous un dialogue, 60 pendant une séquence, 60 pour le verre qui suit. Ultra n'est plafonné que par le dialogue ;
   - travail du pointeur regroupé à une fois par image (inclinaison, éventail, glisser).
3. **Thème** :
   - le Fondu en Éco devient une View Transition en simple fondu (`THEME_SWAP.fade`) ;
   - un thème s'applique en **un** recalcul au lieu de deux (`:root[data-theme-fade]`, couleurs du moteur par la palette) ;
   - mémoire : pic de +300 à +750 Mo pendant 10 changements, puis retour à la base. C'est un pic, pas une fuite.
4. **Liaison, retour, onglets, passages** :
   - aucun `getAnimations()` ni second rendu React dans un clic ;
   - pastille des onglets qui n'écrit que des styles ;
   - éventail gardé monté et caché après la liaison ;
   - passages : retour de la page après la fin du redimensionnement, noir à 0,004, calque de la page gardé.

### Par case (Élevée, puis Éco) — 13/10 → 14/10
Images > 8 ms : par fenêtre de 10 s, plage des essais. Max : pire intervalle sur tous les essais.

| Case | p95 (ms) | > 8 ms | max (ms) | CPU % | GPU app % | dwm % | Mém. Mo |
|---|---|---|---|---|---|---|---|
| R1 éventail au repos | 3,7 → 3,7 | 0 → 0 | 3,8 → 3,9 | 2,16 → **1,69** | 4,03 → 3,18 | 1,17 → 1,22 | 468 → 480 |
| R2 carrousel au repos (Visible) | 3,7 → 3,7 | 0–1 → 0 | 17,7 → **3,9** | 3,65 → 3,32 | 7,09 → 5,84 | 1,23 → 1,34 | 604 → 570 |
| R2-max (Marquée + particules) | 3,7 → 3,7 | 0 → 0 | 3,9 → 7,1 | 4,24 → **2,83** | 6,02 → 3,81 | 2,25 → 0,72 | 589 → 577 |
| R3 carrousel (Aucune flottaison) | 3,7 → 3,7 | 0 → 0 | 3,8 → 4,0 | 2,47 → **1,53** | 4,49 → 2,33 | 1,38 → 0,67 | 512 → 530 |
| I1 survol continu, carrousel | 3,7 → 3,7 | 1–2 → 0 | 10,8 → **4,0** | 12,3 → 10,9 | 15,9 → **8,4** | 3,18 → 2,81 | 692 → 589 |
| I2 survol continu, éventail | 3,7 → 3,7 | 0 → 0 | 7,2 → 7,2 | 4,09 → 3,39 | 5,68 → 3,62 | 1,51 → 1,25 | 491 → 492 |
| I3 survol qui change, carrousel | 3,7 → 3,7 | 7–8 → **0–1** | 14,3 → 10,7 | 8,46 → 7,86 | 9,90 → 8,27 | 2,02 → 2,25 | 792 → 719 |
| I4 survol qui change, éventail | 3,7 → 3,7 | 0 → 0 | 7,2 → 7,2 | 3,99 → 3,32 | 5,26 → 3,69 | 1,40 → 1,23 | 505 → 520 |
| I9 survol rapide (nouveau) | — → 3,7 | — → 0–1 | — → 10,6 | — → 25,7 | — → 8,5 | — → 2,84 | — → 593 |
| I8 liaison + retour | 3,7 → 3,7 | 11–13 → **4–7** | 21,5 → **14,4** | 8,09 → 4,96 | 9,00 → 4,60 | 1,94 → 1,58 | 1012 → 944 |
| I5 onglets | 3,7 → 3,7 | 18–30 → **4–7** | 17,9 → 14,3 | 13,4 → 9,3 | 15,1 → 8,4 | 3,24 → 3,06 | 1122 → 1054 |
| A2 onde de thème | 3,7 → 3,7 | 18–19 → 9–13 | 28,7 → 25,1 | 11,1 → 9,9 | 13,4 → 11,9 | 2,47 → 2,43 | 1342 → 1229 |
| A4 passages | 3,7 → 3,7 | 9–11 → 11–14 | 35,7 → 42,8 | 4,87 → 4,72 | 9,68 → 8,12 | 5,59 → 4,34 | 1039 → 986 |
| **Éco** — I8 liaison + retour | 3,7 → 3,7 | 2–5 → 4 | 21,4 → 14,3 | 3,44 → 3,42 | 1,71 → 1,83 | 0,76 → 0,91 | 911 → 805 |
| **Éco** — I5 onglets | 3,7 → 3,7 | 2–4 → 1 | 10,7 → 10,7 | 6,74 → 6,45 | 4,60 → 4,77 | 2,58 → 2,91 | 880 → 850 |
| **Éco** — A2 Fondu de thème | **10,7 → 3,7** | **94–136 → 5–8** | **50 → 21,4** | 8,89 → 6,83 | 6,08 → 7,91 | 1,50 → 2,38 | **1707 → 1007** |
| **Éco** — A4 passages | 3,7 → 3,7 | 7–8 → 6–7 | 32,2 → 39,3 | 2,95 → 2,76 | 2,74 → 2,47 | 2,80 → 1,33 | 1004 → 865 |

I9 : 12 000 à 12 600 mouvements de souris envoyés par seconde, 2 200 à 2 400 reçus par la page, aucune image > 16 ms.

### Pendant les animations — pire nombre d'images > 8 ms par occurrence / max (ms)
| Animation | Élevée 13/10 | Élevée 14/10 | Éco 13/10 | Éco 14/10 |
|---|---|---|---|---|
| Liaison | 3–4 / 18 | **1–2 / 14,4** | 0–1 / 10,8 | 1 / 10,7 |
| Retour | 2–3 / 21,5 | **2 / 14,4** | 1 / 21,4 | **1 / 14,3** |
| Onglet | 4–10 / 17,8 | **1–2 / 14,3** | 1 / 10,7 | 1 / 10,7 |
| Survol qui change (carrousel) | 1–2 / 14,3 | **0–1 / 10,7** | 0 / 3,8 | non remesuré |
| Onde de thème | 5–9 / 28,7 | 3–6 / 25,1 | **30–36 / 50** | **2 / 21,4** |
| Passage (3 passages par essai) | 3–6 / 35,7 | 5–6 / 42,8 (images lentes visibles : 3–6 par essai, max 21,3) | 3 / 32,2 | 2–3 / 39,3 |

### Lecture
- **Tenu** :
  - le budget p95 ≤ 5,4 ms, partout, y compris le Fondu en Éco (p95 3,7 ms au lieu de 10,7) ;
  - aucune image > 16 ms pendant la liaison, le retour, les onglets ou le survol ;
  - l'objectif « au plus 1 image > 8 ms par occurrence » est tenu **en Éco** pour la liaison, le retour et les onglets, et en Élevée pour le survol qui change.
- **Accepté** (ta décision du 14/10, fluide à l'œil) :
  - en Élevée, la liaison, le retour et les onglets gardent **1 à 2 images de 10 à 14 ms**. C'est le clic lui-même : environ 9 à 14 ms au profil CPU, surtout le recalcul et la mise en page de ce que React vient de changer ;
  - l'onde garde **1 à 2 images de 15 à 25 ms** à l'impact. C'est la capture de la View Transition, cachée sous l'image figée ;
  - pistes notées dans `docs/DA-JOURNAL.md` pour l'étape 14.
- **Passages** :
  - les plus grosses images (jusqu'à 43 ms) viennent du redimensionnement de la fenêtre et du premier dessin à la nouvelle taille ; elles tombent maintenant **dans le noir** ;
  - en Élevée, il reste 1 à 2 images lentes visibles par passage au début du fondu d'entrée (max 21 ms au lieu de 36) ;
  - en Éco, le passage n'a pas de fondu : les images lentes sont le redimensionnement lui-même.
- **Repos** :
  - le CPU baisse partout (R1 1,7 %, R3 1,5 %, R2-max 2,8 %) ;
  - avec la flottaison Visible, le carrousel reste à **3,3 %**. La cible < 1 % n'est toujours pas tenue : point ouvert pour l'audit de l'étape 18.
- **Points clos** :
  - image blanche : close (filet `--bg-bottom` gardé ; à rouvrir si elle se revoit) ;
  - `--quit` (P1) et flash (P3) : clos ;
  - A10 : retiré ;
  - Qualité « Auto » : plus tard, avant l'étape 19 (ROADMAP).

## Reproduire
- **Depuis le 14/10** : `npm run perf` (banc `scripts/perf/`, mode d'emploi dans `scripts/perf/README.md`). Exemples :
  - `npm run perf -- --cases I8,I5 --quality high,eco --trials 2 --compare <ancien results.jsonl>` ;
  - `--trace I8 --invalidations` pour une trace.
  - Résultats dans `%TEMP%\kayro-perf\<date>\` (`results.jsonl`, `report.md`).
- **Séance du 13/10** : ses outils sont restés hors dépôt (scratchpad). Ses résultats bruts servent de base de comparaison (`baseline-2026-10-13/results.jsonl`, dans le même dossier temporaire).

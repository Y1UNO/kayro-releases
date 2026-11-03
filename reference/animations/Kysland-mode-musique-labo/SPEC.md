# Kysland, mode musique : spécification

Référence : `reference-labo.html`. **En cas de doute, c'est le code du labo qui fait foi.** Ce document explique l'architecture, les chiffres clés et ce qui change pour l'app.

---

## 1. Principes (ne pas les perdre au portage)

1. **Chaque son a son geste, jamais le même :**
   - kick : la taille (punch) ;
   - sub-basse : la respiration lente et le pompage ;
   - caisse claire : la torsion et le reflet ;
   - charleston : de petites ondes sur le bord et des cordes fines, jamais sur la taille ;
   - crash : un événement sur toute la scène.
2. **Réaction immédiate.** Le pic visuel arrive 1 à 2 images après l'attaque du son (moins de 30 ms). Les impulsions modifient directement la position et la vitesse des ressorts. Il n'y a pas d'enveloppe lissée entre le son et le mouvement.
3. **Mouvement cohérent.** Le kick pousse tout vers l'extérieur en même temps. Pas d'agitation aléatoire permanente : le calme entre les coups rend les coups visibles.
4. **Encre noire brillante.** Silhouette noire, reflets spéculaires et liseré coloré. Toute la lumière (halo, rayons, cordes, ondes) prend les couleurs de la pochette.
5. **Indépendant de la fréquence d'écran.**
   - La physique tourne en pas fixes de 1/480 s.
   - Les traînées sont corrigées par `pow(x, dt*60)`.
   - Le rendu est identique à 60, 144 et 240 Hz.
6. **Aucun pic ni épine.** C'est un refus explicite de Tom.

---

## 2. Architecture

```
signal musical  ->  scène (Disque | Encre | Île)  ->  uniforms  ->  2 passes WebGL2
(démo ou vrai son)   physique à 480 Hz                              lumière (demi-résolution, feedback)
                     + FX partagés (ondes, flash,                   image finale (pleine résolution)
                       aberration, tremblement)                     + calque 2D pour le titre
```

### Signal musical : le contrat entre l'audio et les visuels

```ts
type Hit = 'kick' | 'snare' | 'hat' | 'crash';
interface MusicFrame {
  t: number;        // secondes, monotone, calé sur ce qu'on ENTEND (latence de sortie compensée)
  kick: number;     // enveloppes 0..1
  snare: number;
  hat: number;
  crash: number;    // crash rapide
  tail: number;     // traîne de cymbale qui scintille
  sub: number;      // 0..1 continu, pompage inclus
  build: number;    // 0..1 tension de montée (0 si inconnue)
  gap: boolean;     // silence juste avant un drop
  section: 'drop' | 'break' | 'build' | 'unknown';
}
// + un flux d'événements : onHit(type, velocity 0..1)
```

Les enveloppes sont calculées à partir de l'heure du dernier coup (`age`, en secondes) et de sa vélocité `v` :

| Enveloppe | Formule |
|---|---|
| kick | `v · e^(−age/0.11)` |
| snare | `v · e^(−age/0.13)` |
| hat | `v · e^(−age/0.05)` |
| crash | `v · e^(−age/0.45)` |
| tail | `v · e^(−age/1.4) · (0.5 + 0.5·sin(88·age))` |
| sub (pompage) | `sub_brut · (1 − 0.85·e^(−age_kick/0.09))` |

### Physique

- Ressort amorti, intégration semi-implicite : `v += ((cible − x)·k − v·2z√k)·h ; x += v·h`, avec `h = 1/480`.
- Accumuler `dt` et faire au maximum 60 sous-pas par image.

### Corps de gelée (`Body`), partagé par le disque, la masse d'encre et la boule de l'île

| Élément | Ressort | Kick (g = vélocité × réglage Basse) | Caisse claire (v) | Crash (g) |
|---|---|---|---|---|
| Échelle S | k = 1300, z = 0.22 | `x += 0.045g`, `v += 4.6g` | (montée : `v += 2.4·v·build`) | `v += 10g` |
| Modes de bord n = 2..5 | k = 900 + 200n, z = 0.11 | mode 2 ou 3, phase au hasard, `v += 0.085g√k` | mode 4 ou 5, `v += 0.035v√k` | tous les modes, `v += 0.06g√k` |
| Cisaillement | k = 1300, z = 0.18 | – | `v += ±4.2v` | `v += ±3g` |
| Ondulations de bord | 16 lobes, τ = 0.09 s | – | – | – |

Pour le charleston, l'amplitude des ondulations passe à `max(amplitude, 0.014v)`.

Mesuré sur le disque :

- pic de +12 à +13 % aux images 1 et 2 ;
- contraction à −4 % vers 100 ms ;
- retour à +5 % vers 180 ms ;
- bord qui ondule jusqu'à 6 %.

### Rendu (deux passes, voir les shaders du labo)

- **Une seule fonction de distance (SDF) pour toute l'encre.**
  - Le noyau est un cercle déformé en coordonnées polaires (modes, ondulations, cisaillement).
  - L'île est une boîte arrondie collée au bord haut.
  - On ajoute jusqu'à 32 boules.
  - Tout est fusionné par `smin` (union lisse, `k = 0.045 à 0.055 × hauteur`, et un facteur par boule pour les filaments de gelée).
- **Passe lumière** (demi-résolution, texture RGBA16F en ping-pong) :
  - contenu : halo `exp(−d/w)`, rayons angulaires, ondes de choc, cordes ;
  - feedback : `max(précédent × decay, actuel)`, avec zoom et rotation autour du centre, ce qui donne les traînées hypnotiques ;
  - `decay = (0.8 + 0.17 × Traînées)^(dt·60)` ;
  - `zoom = (1.003 + 0.014·kick + 0.02·crash − 0.024·build)^(dt·60)`.
- **Passe finale** :
  - la normale vient de 3 évaluations de la SDF (profil en quart de cercle, largeur 0.055 × hauteur) ;
  - spéculaire Blinn (exposants 60 et 700), Fresnel, reflet d'environnement, liseré à la couleur du halo ;
  - pochette en texture dans le noyau, en rotation ;
  - aberration chromatique et flash au crash ;
  - mappage de tons `1 − e^(−1.25x)`.
- **Couleurs** : deux teintes vives extraites de la pochette (fonction `palette()` du labo). L'accent de l'interface suit la même couleur.

---

## 3. Les trois scènes

### Disque

**Disposition**
- Rayon `0.22 × hauteur`, centre `(W/2, 0.43 × hauteur)`.
- Pochette au centre, rayon `0.44 × R`, rotation de base 3.4 rad/s.
- Vitesse de rotation : +10g au kick, +50g au crash, 1.8 rad/s pendant le break.

**Réactions**
- Cible d'échelle : `1 + 0.035·sub − 0.15·build − 0.04·gap`.
- Kick : petite onde de choc (R → 1.9R en 0.55 s) et pincement de la corde 0.
- Caisse claire : pincement de la corde 1.
- Charleston : pincement de la corde 2.
- **Crash :**
  - flash, aberration, tremblement ;
  - deux ondes de choc (R → 3.9R, R → 2.9R décalée de 90 ms) ;
  - 8 gouttes éjectées qui reviennent se fondre dans le disque en environ 1,2 s ;
  - le titre s'éparpille.

**Cordes** (rayons 1.24, 1.44 et 1.64 × R)
- Corde 0 (couleur 1) : sub + kick.
- Corde 1 (couleur 2) : caisse claire et montée.
- Corde 2 (blanche) : charleston.
- Les pincements font courir une bosse dans les deux sens autour de la corde.

**Titre** (calque 2D, police Fredoka)
- Kick : ola de gauche à droite, 26 ms de décalage par lettre.
- Caisse claire : inclinaison.
- Crash : les lettres sautent et tournent.
- Étirement dans le sens de la vitesse.

### Encre

La figure dépend de la section :

| Moment | Figure |
|---|---|
| Drop, mesures 1 et 2 | Floraison |
| Drop, mesures 3 et 4 | Gelée |
| Drop, mesures 5 et 6 | Miroir |
| Drop, mesures 7 et 8 | Gelée |
| Break | Satellites |
| Montée | Tourbillon |
| Silence | Une petite boule serrée |

| Figure | Comportement |
|---|---|
| **Floraison** | Explosion radiale au crash du drop, puis couronne de 24 perles (tailles alternées) qui pulse au kick et tourne avec le charleston. |
| **Gelée** | Noyau qui pompe sur la sub (rayon × (1 + 0.12·sub)), punch et rebonds au kick. |
| **Miroir** | Au crash du milieu de phrase, deux masses symétriques. Elles s'écartent au kick et sautent à la caisse claire. |
| **Satellites** | 6 gouttes en orbite qui respirent toutes ensemble : la sub les attire et elles s'accrochent par des filaments. |
| **Tourbillon** | 8 gouttes en spirale qui accélèrent et se resserrent. La caisse claire fait trembler l'ensemble. |

Les éclaboussures de crash reviennent dans le noyau s'il y en a un. Sinon, elles s'éloignent en rétrécissant.

**Dans l'app, sans grille de mesures fiable :**
- un crash fort fait passer à la figure suivante (Floraison → Gelée → Miroir → Gelée → …) ;
- s'il n'y a pas de crash pendant 16 s, le changement se fait sur un kick fort ;
- pas de kick pendant plus de 2 s : Satellites ;
- montée détectée : Tourbillon ;
- silence détecté : boule serrée ;
- crash après une montée ou un silence : explosion en Floraison.

### Île (départ et retour)

- **Repos** : demi-largeur `0.19 × hauteur`, bas à `0.085 × hauteur`, collée au bord haut. Au kick, la largeur et la hauteur pompent, et le halo éclaire en dessous.
- **Départ, d'abord l'anticipation** : pendant une croche, l'île se tasse (bas × 0.7, largeur × 1.1).
- **Départ, sur le kick :**
  - une goutte part vers le bas (vitesse 2.6 × hauteur/s) ;
  - un col de 5 boules s'amincit au milieu ;
  - le col casse quand il atteint 1.05 × 0.3 × hauteur ;
  - les morceaux du haut remontent, ceux du bas rejoignent la boule ;
  - une petite goutte satellite retombe dans la boule ;
  - l'île remonte dans le bord.
- **Chute et lecture :**
  - pendant la chute, la boule s'étire dans le sens de la vitesse ;
  - à l'atterrissage, elle s'écrase (`v += 7` sur le mode 2) ;
  - la pochette apparaît après 0.55 s et la boule devient le lecteur.
- **Retour, d'abord l'anticipation** : la boule s'accroupit (+0.045 × hauteur, s'élargit de 22 %).
- **Retour, sur le kick :**
  - la boule saute (−3.4 × hauteur/s), étirée, et rétrécit ;
  - l'île redescend du bord pour la chercher ;
  - au contact, un pont liquide se forme, la boule se vide dans l'île ;
  - l'île reprend sa largeur avec un rebond (k = 150, z = 0.26).
- **Dans l'app** : le départ part à l'ouverture du mode musique, le retour à la fermeture. Dans les deux cas, on attend le prochain kick (600 ms maximum, sinon on part quand même).

---

## 4. Vrai son (ce qui remplace le morceau de test)

**Garder le mode démo** (morceau de test et synthé du labo) pour régler et comparer. L'activer dans Avancé.

### Capture (côté Rust)

- Ce qui sort des haut-parleurs, en WASAPI loopback (par exemple `cpal` en entrée sur le périphérique de sortie par défaut).
- Mono, 48 kHz.
- Analyse sur une fenêtre de 1024 échantillons avec un pas de 256 à 512 (une analyse toutes les 5 à 10 ms).
- FFT avec `realfft` ou équivalent.
- Envoyer au front des événements légers, horodatés, avec la latence de sortie compensée :
  - les coups ;
  - les niveaux continus.

### Bandes (Hz)

| Bande | Fréquences |
|---|---|
| sub | 30–60 |
| kick | 40–120 |
| caisse claire | 150–250 et 1 500–5 000 |
| charleston | 7 000–14 000 |
| crash | 4 000–16 000 |

### Détection des attaques (pas d'IA)

- **Flux spectral par bande** : somme des différences positives entre deux trames de `log(1 + C·magnitude)`.
- **Seuil adaptatif** : médiane glissante sur environ 1 s, plus `k × MAD` (k ≈ 2 à 3). Il faut aussi un pic local et une période réfractaire : kick 110 ms, caisse claire 110 ms, charleston 50 ms, crash 900 ms.
- **Vélocité** : normalisée par un gain automatique par bande (maximum glissant qui redescend en 6 à 10 s). Les morceaux calmes et les morceaux forts réagissent alors pareil.
- **Crash** : gros flux dans la bande 4–16 k, avec de l'énergie dans au moins 3 bandes. Ou bien détecteur de drop : énergie sur 300 ms supérieure à 1,8 × l'énergie sur 4 s, juste après un passage plus calme. Dans ce cas, crash de vélocité 1.
- **Sub continue** : énergie normalisée, attaque 10 ms, relâche 120 ms.
- **Montée** (optionnel) : énergie des aigus qui monte sans kick pendant au moins 2 mesures.
- **Silence** : l'énergie totale chute de plus de 70 % pendant plus de 150 ms après une montée.
- **Tempo** (optionnel, utile pour l'anticipation) : autocorrélation des attaques de kick.

**Synchro** : viser moins de 30 ms entre le son entendu et le pic visuel. Ajouter un réglage « Décalage son/image » (−100 à +100 ms) dans Avancé.

**Titre, artiste et pochette** : réutiliser ce que Kysland a déjà. Sinon, passer par les contrôles média de Windows (GlobalSystemMediaTransportControlsSessionManager, crate `windows`). Recalculer la palette à chaque changement de pochette.

---

## 5. Intégration à la fenêtre de l'île

- **Fond** : le fond « Sombre » ou « Bureau » du labo simule le bureau. Dans l'app, le canvas doit être **transparent** :
  - WebGL2 avec `alpha: true, premultipliedAlpha: true` ;
  - supprimer `background()`, le vignettage et le grain sur les zones vides ;
  - en sortie : alpha = couverture de l'encre, plus la luminance de la lumière (prémultipliée).
- **Déformation** : la réfraction des ondes ne peut pas déformer le vrai bureau. Ne déformer que le calque de lumière.
- **Fenêtre** : vérifier la fenêtre actuelle de Kysland (transparente, sans bordure, toujours au premier plan, clics qui traversent hors de l'île et du lecteur). Ne pas casser ce qui marche déjà.
- **Performance** :
  - garder la résolution adaptative du labo (baisse si une image dépasse 25 ms) ;
  - ajouter un préréglage de qualité ;
  - limiter la zone rendue à la région utile si la fenêtre couvre tout l'écran ;
  - mettre le rendu en pause quand le mode musique est fermé.

---

## 6. Réglages (Paramètres, catégorie Visuel, section Mode musique)

**Visibles**
- Scène : Disque ou Encre.
- Intensité basse (×0 à ×2).
- Intensité crash (×0 à ×2).
- Traînées (0 à 100 %).
- Brillance (0 à 100 %).

**Avancé** (petite liste déroulante)
- Sensibilité de détection par instrument.
- Décalage son/image.
- Qualité / résolution.
- Mode démo (morceau de test).
- Couleurs : pochette ou thème Kayro.

---

## 7. Critères de validation

1. **Mode démo** : comparé à `reference-labo.html` côte à côte, le mouvement, le timing et les couleurs sont identiques.
2. **Kick** : l'échelle prend +12 % (±3) au plus tard 2 images après l'événement, puis le rebond gelée est visible. À vérifier en loggant `S.x` image par image.
3. **Crash** : flash, ondes et gouttes, au maximum un crash par 0,9 s. Sur un vrai drop, le crash est détecté.
4. **Morceau calme et morceau très fort** : les deux réagissent visiblement, sans saturer en continu.
5. **Fluidité** : même rendu à 60 et 144 Hz. Aucune image au-dessus de 16 ms en 1080p sur la machine de Tom, sinon la résolution adaptative baisse.
6. **Aucun pic ni épine** nulle part.
7. **Validation finale** : testé sur le **.exe de production en plein écran**.

# Architecture

Toutes les versions de bibliothèques et signatures d'API sont à vérifier à l'étape 1 (la doc fait foi, pas ce fichier).

## 1. Modules Rust (`src-tauri/src/`)
| Module | Rôle |
|---|---|
| `config` | Lecture/écriture JSON versionné, migrations, écritures atomiques (fichier temporaire puis renommage), sauvegarde avant migration |
| `launcher` | Lancement par type : `exe`, `lnk`, `uri` (ex. protocole Steam/Epic), `uwp` (AUMID), `url`. Via ShellExecute pour gérer protocoles et raccourcis. Signale les apps qui exigent les droits admin |
| `detect` | Sources : Steam (`libraryfolders.vdf`, `appmanifest_*.acf`), Epic (manifestes `.item` JSON), Menu Démarrer. Chaque source est un module indépendant, tolérant aux formats inconnus (ignore, journalise, ne plante pas) |
| `art` | Affiches/héros locaux, cache d'images redimensionnées, empreinte (hash) des fichiers, extraction de palette |
| `procwatch` | Apps en cours (match par exécutable), fenêtre au premier plan, détection jeu plein écran, événements vers l'interface |
| `scenes` | Moteur d'exécution des scènes (voir §3), annulable, avec journal des étapes |
| `perf` | Moniteur (CPU/RAM du processus, temps par image reçu de l'interface), état Actif/Atténué/Veille, niveaux de qualité, benchmark |
| `moods` | Validation des fichiers d'ambiance (`.hubmood`), limites, assainissement des tracés |
| `windows` | Modes d'affichage (immersif / fenêtre / widget), zone de notification, raccourcis globaux, instance unique, mémorisation position/écran |
| `voice`, `hands` | Plus tard, modules optionnels téléchargés à la demande |

Interface (`src/`) : `features/` par écran (home, scenes, settings, add-app, widget, game-mood), `design/` (tokens, composants verre, thèmes), `fx/` (interface `FxLayer` + implémentations), `store/`, `ipc/` (commandes typées), `i18n/`.

## 2. Données (`%APPDATA%/<AppName>/`)
```
settings.json         # préférences, niveau de qualité, thème, mode de couleurs du jeu, raccourcis
apps.json             # applications
slots.json            # emplacements -> id d'app
scenes/<id>.json      # scènes
themes/<id>.json      # thèmes de couleur (intégrés + importés)
moods/<id>.hubmood    # ambiances de jeu
cache/art/            # images redimensionnées (jamais exportées)
cache/icons/          # icônes d'exe/lnk extraites par le Shell, PNG 128 px max (`<id>-<hash du chemin>.png`), reconstruites à la demande
cache/palettes.json   # { "<hash image>": { dominant, accent, dark } }
logs/
```
Tous les fichiers portent `"schemaVersion": N` + migration.

**apps.json (extrait)**
```json
{ "schemaVersion": 1, "apps": [{
  "id": "minecraft", "name": "Minecraft", "category": "jeux",
  "source": { "kind": "manual" },
  "launch": { "kind": "exe", "path": "C:\\...\\Minecraft.exe", "args": [], "cwd": null, "elevated": false },
  "match": { "exe": "javaw.exe" },
  "art": { "poster": "cache/art/minecraft.poster.webp", "hero": null },
  "moodId": null, "favorite": false
}]}
```
`source.kind` : `manual` | `steam` (+ `appId`) | `epic` (+ `appName`) | `startmenu`.

## 3. Moteur de scènes
```json
{ "schemaVersion": 1, "id": "soiree-gaming", "name": "Soirée gaming", "hotkey": "Ctrl+Alt+1",
  "steps": [
    { "type": "launch", "slot": "messagerie" },
    { "type": "wait", "ms": 2000 },
    { "type": "launch", "slot": "plateforme-jeux" },
    { "type": "waitReady", "slot": "plateforme-jeux", "timeoutMs": 30000 },
    { "type": "launch", "slot": "musique" }
  ]}
```
- Types d'étapes : `launch`, `wait`, `waitReady` (le processus ou la fenêtre de l'app liée au slot existe), `focus`, `close` (fermeture douce + confirmation). Le trait `Action` est extensible (OBS, lumières… plus tard).
- Exécution asynchrone, annulable, avec état par étape (en attente / en cours / ok / échec / ignoré). Un échec n'arrête pas la scène sauf si l'étape est marquée `required`.
- Le fichier partagé n'a que des noms de slots. À l'import, l'utilisateur relie chaque slot à une de ses apps.

## 4. Fenêtres et fonctionnement
- **Instant** : la fenêtre reste chargée, cachée, dans la zone de notification ; le raccourci l'affiche en moins de 150 ms. Option « Mode économe » : la fenêtre est détruite quand elle est cachée (moins de RAM, ouverture ~400 ms).
- **Immersif** : fenêtre sans bordure à la taille de l'écran choisi (pas de plein écran exclusif, pour garder Alt+Tab fluide). **Fenêtre** : classique. **Widget** : barre en haut de l'écran, sans bordure, toujours au premier plan, hors barre des tâches, déplie un panneau.
- Instance unique ; démarrage avec Windows en option, silencieux (directement dans la zone de notification).
- Fenêtre transparente (widget) : vérifier les cas limites Windows 10/11 (ombre, redimensionnement). Prototype à faire à l'étape 2.

## 5. Performance
**États** : `Actif` → `Atténué` (fondu 400 ms) → `Veille` (boucles d'animation, micro, caméra arrêtés ; aucune activité).
- Vers Atténué/Veille : hub masqué, perte de focus prolongée, jeu plein écran détecté (état de notification utilisateur de Windows, p. ex. `SHQueryUserNotificationState`, + fenêtre au premier plan couvrant l'écran et qui n'est pas le hub), écran verrouillé.
- Retour : reprise en fondu.

**Niveaux de qualité**
| Fonction | Éco | Équilibré | Élevé | Ultra |
|---|---|---|---|---|
| Verre (`backdrop-filter`) | non (surface opaque) | 3 surfaces | 6 surfaces | 6 surfaces |
| Brume en dégradés | non | oui, statique | oui, animée | oui, animée |
| Rayons de lumière dynamiques | non | non | oui | oui |
| Particules / ambiance de jeu | non | non | oui (comptes réduits) | oui (comptes pleins) |
| Verre réfractif / moteur graphique | non | non | non | oui (si disponible) |
| Limite d'images | 30 | Auto | Auto | Auto |

**Qualité adaptative** : mesurer le temps par image sur une fenêtre glissante de 2 s ; si le 95e centile dépasse 1,5× le budget (1000/Hz ms), descendre d'UN cran de façon progressive (fondu) ; remonter d'un cran après 30 s stables. Ne jamais passer en Ultra automatiquement.

**Benchmark au premier lancement** (3 s, scène d'essai) : mesure le temps par image, choisit le niveau maximal tenable (≤ Élevé), l'utilisateur peut tout changer. Rejouable depuis les réglages. Afficher FPS, CPU et RAM du hub en direct ; GPU par processus via les compteurs de performance Windows, en second temps.

**Mode sans échec** : maintenir Maj au démarrage, ou deux plantages d'affilée → niveau Éco et effets coupés, avec message clair.

## 6. Couleurs du jeu (palette)
1. Source : affiche verticale (cartes) et héros large (fond immersif) du dossier local Steam, ou image fournie par l'utilisateur. La structure du dossier de cache Steam a changé selon les versions du client : parseur tolérant, inspecter le dossier réel, repli propre si rien n'est trouvé.
2. Empreinte du fichier (hash) → clé de cache. Si l'image change (nouvelle saison, mise à jour Steam), l'empreinte change et la palette est recalculée seule.
3. Extraction hors thread UI : réduire à ~64×64, quantifier (k-means ou coupe médiane) dans un espace perceptuel (OKLab/OKLCH), scorer par population × chroma, retenir `dominant`, `accent`, `dark`.
4. Normaliser : borner luminosité et chroma, garantir le contraste du texte (≥ 4,5:1 sur les surfaces), mélanger avec le thème actif pour rester cohérent.
5. Modes : `off` (thème seul) · `leger` (teinte lumière, brume, halo de la carte) · `immersif` (fond et brume aux couleurs + héros flouté). Verrouillage manuel de la palette et réglage à la main possibles par jeu.
6. Transitions de couleur : fondu 0,9 s (variables CSS animées).

## 7. Ambiances de jeu (`.hubmood`)
Fichier JSON déclaratif, jamais de code :
```json
{ "schemaVersion": 1, "name": "Runes spectrales", "gameHint": "Hades II",
  "palette": { "mode": "auto" },
  "colorMode": "leger",
  "glyphs": { "rune-a": "M0 0 L10 0 L5 9 Z" },
  "layers": [
    { "type": "particles", "shape": "ember", "count": 26, "size": [3, 7], "speed": [20, 60], "direction": "up", "drift": 0.3, "life": [6, 12], "colorRole": "accent", "blend": "screen" },
    { "type": "glyphRing", "glyph": "rune-a", "count": 12, "radius": 0.34, "rotation": 4, "colorRole": "accent", "opacity": 0.5 },
    { "type": "mist", "count": 4, "colorRole": "dominant", "opacity": 0.25, "speed": 6 },
    { "type": "beam", "count": 2, "sway": 3, "colorRole": "accent" }
  ],
  "onFocus": "pulse" }
```
- Couches possibles : `particles` (`ember`, `dot`, `star`, `line`, `rune`, `glyph`), `glyphRing`, `mist`, `beam`, `pulse`. Rôles de couleur : `dominant`, `accent`, `dark`, `text`.
- Limites strictes (nombre de couches, comptes, taille des tracés) ; comptes multipliés par un facteur selon le niveau de qualité ; ignorés en Éco/Équilibré.
- Rendu : un seul canvas 2D, pool de particules sans allocation par image, boucle arrêtée en veille. Même fichier lu plus tard par un rendu WebGL.
- Paquets de base fournis : Braises, Étoiles, Brume, Runes, Pluie, Aucune. Ambiances sur mesure : voir étape « Ambiances sur mesure ».
- Ne jamais embarquer d'art officiel de jeu : formes originales inspirées de l'ambiance, pas de logos ni d'illustrations.

## 8. Commandes IPC (esquisse)
`apps_list/add/update/remove`, `app_launch`, `app_focus`, `apps_running`, `detect_scan`, `scenes_list/save/run/cancel`, `settings_get/set`, `perf_get/benchmark`, `art_get_palette`, `moods_list/save/import/export`. Événements : `app_state_changed` (changements seulement : `{id, running, foreground}`), `scene_progress`, `perf_state_changed`. Toutes typées et générées côté TypeScript.

## 9. Distribution (plus tard)
Installeur Windows (NSIS via le bundler Tauri), WebView2 installé par l'installeur si absent. L'avertissement SmartScreen restera sans certificat de signature Windows (payant), à expliquer aux amis. Mises à jour automatiques : la clé de signature de l'updater Tauri est gratuite ; attention, un dépôt GitHub privé ne sert pas directement de source de mises à jour, prévoir un dépôt de releases public ou un autre hébergement le moment venu.

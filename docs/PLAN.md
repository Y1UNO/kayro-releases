# Plan technique — étape 1

> Vérifié le 2026-10-09. Ce fichier **prime sur ARCHITECTURE.md** pour les versions et les API. « À vérifier » = non confirmé dans une source, à trancher dans le spike indiqué.

## 0. Sources
- **[S1]** API crates.io : versions, dates, dépendances (`https://crates.io/api/v1/crates/<nom>`).
- **[S2]** Registre npm : `latest` et `peerDependencies` (`https://registry.npmjs.org/<paquet>/latest`).
- **[S3]** Référence de configuration Tauri v2 : https://v2.tauri.app/reference/config/
- **[S4]** Plugins Tauri : https://v2.tauri.app/plugin/global-shortcut/ · /plugin/single-instance/ · /plugin/autostart/ · zone de notification : https://v2.tauri.app/learn/system-tray/
- **[S5]** README de window-vibrancy : https://github.com/tauri-apps/window-vibrancy
- **[S6]** tauri-specta : https://github.com/specta-rs/tauri-specta (`examples/app`) ; sur docs.rs, la construction de la doc 2.0.0-rc.25 a échoué.
- **[S7]** README de ts-rs : https://github.com/Aleph-Alpha/ts-rs
- **[S8]** Microsoft Learn : `QUERY_USER_NOTIFICATION_STATE`, `IShellItemImageFactory`, `IApplicationActivationManager::ActivateApplication` (paramètre de sortie `processId`).
- **[S9]** `Cargo.toml` de `windows` 0.62.2 (archive crates.io) et windows-docs-rs, pour les noms de features.
- **[S10]** docs.rs `image` 0.25.10 : `WebPEncoder` n'a que `new_lossless`.
- **[L]** Constat local sur ce PC (commande indiquée).

## 1. Arborescence cible
```
HUB/
├─ CLAUDE.md · docs/ · reference/ · _kit/
├─ package.json · vite.config.ts · tsconfig.json · eslint.config.js · index.html
├─ src/                         # interface « bête »
│  ├─ main.tsx · App.tsx
│  ├─ app/                      # amorçage, navigation entre écrans, APP_NAME (injecté par Vite)
│  ├─ features/                 # home/ scenes/ settings/ add-app/ widget/ game-mood/
│  ├─ design/                   # tokens.css, themes/*.json (5 intégrés), glass/, components/
│  ├─ fx/                       # FxLayer.ts (interface), css/, canvas/ ; features/ n'importe que fx/index.ts
│  ├─ store/                    # zustand : une tranche par domaine
│  ├─ ipc/                      # bindings.ts (GÉNÉRÉ, jamais édité), commands.ts, events.ts
│  ├─ i18n/                     # fr.json + t()
│  └─ lib/                      # couleur (OKLCH, contraste), temps (delta time), fonctions pures
└─ src-tauri/
   ├─ Cargo.toml · build.rs · tauri.conf.json · capabilities/default.json · icons/
   ├─ src/
   │  ├─ main.rs · lib.rs (Builder, plugins, specta) · error.rs · ipc.rs (liste des commandes)
   │  ├─ config/     schema.rs, migrate.rs, atomic.rs, paths.rs
   │  ├─ launcher/   exe.rs, lnk.rs, uri.rs, uwp.rs
   │  ├─ detect/     steam.rs, epic.rs, startmenu.rs, uwp_apps.rs
   │  ├─ art/        steam_cache.rs, cache.rs, hash.rs, palette.rs, icons.rs
   │  ├─ procwatch/  processes.rs, foreground.rs, fullscreen.rs
   │  ├─ scenes/     model.rs, engine.rs, actions/
   │  ├─ perf/       monitor.rs, state.rs, quality.rs, gpu.rs
   │  ├─ moods/      schema.rs, validate.rs, svg_path.rs
   │  ├─ desktop/    modes.rs, tray.rs, hotkeys.rs, single_instance.rs, placement.rs
   │  └─ platform/   shell.rs, com.rs, dwm.rs, pdh.rs, window.rs   # seul endroit avec `unsafe`
   └─ tests/fixtures/  steam/*.vdf|*.acf, epic/*.item, moods/*.hubmood
```
**Écarts justifiés vs ARCHITECTURE.md**
1. Module `windows` renommé **`desktop`** : un module `windows` masquerait la crate `windows` (`use windows::Win32…` deviendrait ambigu).
2. **`platform/`** ajouté : tout le code Win32 `unsafe` est isolé derrière des fonctions sûres, que `scenes` et `procwatch` remplacent par des faux (trait) dans les tests.
3. **`APP_NAME`** a une seule source : `productName` dans `tauri.conf.json`. Rust le lit via `package_info().name`, TypeScript le reçoit par `define` de Vite. Le dossier de données est une constante séparée et figée (`DATA_DIR = "Kayro"`, chemin `%APPDATA%/Kayro` ; l'ancien `%APPDATA%/Hub` est copié une fois par `legacy.rs`), calculé par nous : `app_data_dir()` de Tauri dépend de l'identifiant de bundle, et un renommage ne doit jamais déplacer les données.
4. Cache des affiches en **`.jpg`** (pas `.webp`), car l'encodeur WebP de `image` ne fait que du sans perte [S10]. Icônes en `.png` (transparence).

## 2. Choix techniques vérifiés
### Cœur Rust
| Domaine | Choix · version | Raison | Écarté | Src |
|---|---|---|---|---|
| Framework | `tauri` **2.12.x** (2.12.2 du 09/10/2026), feature `tray-icon` ; `protocol-asset` pour les affiches (à vérifier, étape 7) | branche stable ; Rust 1.99 installé, les plugins exigent ≥ 1.90 | Tauri 3.0.0-alpha.4 (alpha du 01/10/2026) | S1 S4 |
| Raccourcis globaux | `tauri-plugin-global-shortcut` 2.4.0 | gestion côté Rust (`with_handler`, `ShortcutState::Pressed`) | `RegisterHotKey` à la main | S1 S4 |
| Instance unique | `tauri-plugin-single-instance` 2.5.2 | « doit être le premier plugin enregistré » ; rappel `(app, args, cwd)` → afficher le hub | mutex nommé maison | S4 |
| Démarrage avec Windows | `tauri-plugin-autostart` 2.7.0, `init(MacosLauncher::LaunchAgent, Some(vec!["--silent"]))` | `--silent` → démarre directement dans la zone de notification. Mécanisme Windows (clé `Run` ?) : à vérifier | tâche planifiée | S4 |
| Zone de notification | natif Tauri (`tray-icon`, `TrayIconBuilder`, `on_tray_icon_event`) | pas de plugin nécessaire | — | S4 |
| Dépôt de fichiers | natif : `onDragDropEvent` (`dragDropEnabled: true`, valeur par défaut) | donne les vrais chemins des .exe, .lnk, .url | — | S3 |
| Réordonner (scènes) | événements pointeur (`Reorder` de motion) | sous Windows, `dragDropEnabled` **désactive le drag-and-drop HTML5** [S3]. `Reorder` n'utilise pas HTML5 : à vérifier à l'étape 11 | couper `dragDropEnabled` (on perdrait le dépôt de fichiers) | S3 |
| Boîtes de dialogue | `tauri-plugin-dialog` 2.8.1 | choisir un .exe, importer/exporter | — | S1 |
| Types Rust↔TS | **`tauri-specta` =2.0.0-rc.25** (étape 4 : compile avec Tauri 2.12.2, features `derive` + `typescript`, `tempfile` 3 en dev-dependency) + `specta` =2.0.0-rc.25 + `specta-typescript` 0.0.12, versions exactes épinglées | génère les commandes **et** les événements typés (`collect_commands!`, `collect_events!`, `#[derive(tauri_specta::Event)]`) ; dépôt actif (commit du 20/07/2026) | `ts-rs` 12.0.1 : stable, mais ne génère que les types ; les noms de commandes restent écrits à la main, donc peuvent diverger. C'est le **plan B** | S1 S6 S7 |
| API Windows | `windows` 0.62.2 (liste des features ci-dessous) | COM ergonomique (Shell, PDH) | `windows-sys` 0.61.2 (pas de COM ergonomique), `winapi` (n'est plus maintenu) | S1 S9 |
| VDF Steam | `keyvalues-parser` 0.2.4 (VDF texte) + lecture tolérante maison | on ne lit que les champs utiles ; un fichier invalide est ignoré et journalisé | `steamlocate` 2.1.1 (structures figées, moins de contrôle sur les erreurs). Le VDF binaire est inutile : on parcourt les dossiers | S1 L |
| Effets natifs | `windowEffects` de Tauri, qui s'appuie sur `window-vibrancy` 0.8.1 ; exige `transparent: true` | **Mica/Tabbed : Win11 seulement.** **Acrylic** : Win10/11, « bad performance when resizing/dragging » sur Win10 v1903+ et Win11 22000. **Blur** : Win10 et Win11 22H1, mêmes saccades sur Win11 22621+ | `backdrop-filter` CSS : ne floute que la page, jamais le bureau | S3 S5 |
| Icônes | `IShellItemImageFactory::GetImage` (256 px) dans un thread COM dédié → `GetDIBits` → PNG | gère .exe, .lnk et UWP via le Shell | `ExtractIconExW` (pas de 256 px fiable). Plan B : `SHGetImageList(SHIL_JUMBO)` | S8 |
| Images | `image` 0.25.10 (jpeg, png ; webp en lecture) | redimensionnement hors thread UI | — | S1 S10 |
| Processus | `sysinfo` 0.39.6 | CPU/RAM par processus, PID parent (pour l'arbre WebView2) | Toolhelp à la main | S1 |
| Logs | `tracing` 0.1.44 + `tracing-subscriber` + `tracing-appender` 0.2.5 (fichier tournant) | convention du projet | `tauri-plugin-log` 2.10.0 (basé sur `log`) | S1 |
| Divers | `serde` 1.0.229, `serde_json`, `thiserror` 2 | — | — | S1 |

**Features de `windows` 0.62.2** (noms vérifiés [S9]) :
- `Win32_Foundation`
- `Win32_UI_Shell` : ShellExecuteExW, SHQueryUserNotificationState, IShellItemImageFactory, IApplicationActivationManager, IShellLinkW
- `Win32_UI_Shell_PropertiesSystem` : AUMID des raccourcis
- `Win32_UI_WindowsAndMessaging` : EnumWindows, GetForegroundWindow, PostMessageW
- `Win32_UI_Accessibility` : SetWinEventHook
- `Win32_System_Threading` : OpenProcess, QueryFullProcessImageNameW
- `Win32_System_Com`
- `Win32_System_Performance` : PDH
- `Win32_System_Registry` : SteamPath
- `Win32_Graphics_Dwm` : DWMWA_CLOAK, coins
- `Win32_Graphics_Gdi` : MonitorFromWindow, GetMonitorInfoW, GetDIBits
- `Win32_Security` : élévation du jeton
- `Win32_Storage_FileSystem`

### Interface
| Domaine | Choix · version | Raison / contrainte | Écarté | Src |
|---|---|---|---|---|
| Socle | React 19.3.0, react-dom 19.3.0 | — | — | S2 |
| Build | Vite 8.3.4 + `@vitejs/plugin-react` 6.1.2 (exige vite ^8) | — | — | S2 |
| Langage | **TypeScript 6.0.3** | `typescript-eslint` 8.71.1 exige `typescript >=4.8.4 <6.1.0` | TypeScript 7.0.2 (`latest`, version native) : incompatible avec le lint pour l'instant | S2 |
| Animation | `motion` 14.0.0 (`motion/react`), compatible React 18/19 | ressorts, `Reorder`, `AnimatePresence` | — | S2 |
| État | `zustand` 5.0.15 (installé à l'étape 4, version exacte) | léger | Redux | S2 |
| Polices | `@fontsource-variable/fraunces` 5.3.0, `@fontsource-variable/dm-sans` 5.3.0 | les maquettes utilisent l'axe `opsz` de Fraunces (9..144) ; fichier qui contient cet axe : à vérifier à l'étape 3 | `@fontsource/*` statiques | S2 |
| Tests | `vitest` 5.0.3 (vite ^6.4 ‖ ^7 ‖ ^8 ; Node ^22.12 ‖ ^24) | fonctions pures (thèmes, contraste, delta time) | Jest | S2 |
| Lint | `eslint` 10.12.0 + `typescript-eslint` 8.71.1 + `eslint-plugin-react-hooks` 7.1.1 | — | — | S2 |
| Validation | côté Rust : serde `deny_unknown_fields` + limites explicites ; TS reçoit des types générés | c'est le cœur qui valide | `zod` 4.6.5 côté TS (doublon) | S2 |

**Outils déjà présents [L]** :
- Rust 1.99.0 (msvc), Node 24.20.0, npm 11.19.0. pnpm est absent : on utilise npm, rien à installer.
- Git 2.55, WebView2 Evergreen 154.0.4258.62, Visual Studio Installer présent (outils MSVC à confirmer à l'étape 2).

**Installeur** : `webviewInstallMode = embedBootstrapper` (+~1,8 Mo ; réseau nécessaire à l'installation seulement si WebView2 manque). `offlineInstaller` écarté (+~127 Mo) [S3].

**CSP** :
- `default-src 'self'` ; images depuis `'self'`, `data:` et `http://kayro-art.localhost` (étape 14 : protocole maison
  `kayro-art`, id d'app + rôle, fichiers limités au cache Steam et à `%APPDATA%/Kayro/art` ; pas d'`assetProtocol`).
- Aucune source distante. Polices locales.
- Capacités Tauri : liste blanche par fenêtre.

## 3. Les 8 risques et leurs spikes (30 min max chacun)

### (a) Fenêtre cachée affichée en < 150 ms par raccourci — étape 2
- **Question** : est-ce que `show()` + `set_focus()` depuis le raccourci global tient 150 ms jusqu'à la première image peinte, avec un contenu à jour et le focus clavier ?
- **Protocole** :
  - Rust note un `Instant` à `ShortcutState::Pressed`.
  - L'interface, sur `visibilitychange`, attend 2 `requestAnimationFrame` puis appelle `mark_painted` ; Rust calcule l'écart.
  - 20 essais avec la fenêtre cachée depuis 5 s, 5 essais cachée depuis 10 min : WebView2 suspend parfois une vue invisible, et `backgroundThrottling` n'est pas pris en charge sous Windows [S3].
- **Réussite** : p95 < 150 ms, aucun flash blanc (`backgroundColor` = #171021), focus clavier 20/20.
- **Plan B** : ne pas cacher la fenêtre mais la « cloaker » (`DwmSetWindowAttribute(DWMWA_CLOAK)`), avec arrêt des animations par la veille douce.
- ✅ **Verdict (étape 2, `spikes/01-affichage`)** : p50 28 ms, p95 31 ms, max 44 ms (20 essais à 5 s) ; 30 ms après 3 min caché (3 min, pas 10 : décision du 09/10) ; focus 20/20, flash blanc 0/20. Plan B inutile. **Constats** : WebView2 ne suspend pas la fenêtre cachée (`visibilitychange` ne se déclenche jamais, rAF continue à 280/s même après 3 min) → la veille douce doit être pilotée par un événement Rust. `Ctrl+Alt+Espace` est déjà pris sur ce PC (`register` échoue) → **remplacé par Ctrl+Alt+H**, voir §6.2.

### (b) Widget transparent sans bordure sur Windows 10 et 11 — étape 2
- **Question** : `transparent` + `decorations:false` + `shadow:false` + `skipTaskbar` + `alwaysOnTop` donnent-ils une pilule propre (pas de bord ni d'ombre carrée) ? Le flou natif est-il utilisable ?
- **Attention** : `backdrop-filter` ne floute que le contenu de la page. Derrière une fenêtre transparente il n'y a rien à flouter. Seul un effet natif floute le bureau, et il s'applique au **rectangle** de la fenêtre, pas à la pilule.
- **Protocole** :
  - Sur Win11 25H2, 3 variantes : (1) fenêtre transparente + surface CSS `rgba(30,20,38,.82)` ; (2) + `acrylic` ; (3) + `mica`.
  - Pour chacune : déplacer, déplier le panneau (redimensionnement), Alt+Tab, échelle Windows 100/125/150 %, clic dans les zones transparentes.
  - Win10 : machine virtuelle ou PC d'ami, sinon noter « non testé ».
- **Réussite** : aucun artefact de bord ; déplacement sans image perdue (variante 1) ; dépliage en ≤ 1 image de décalage ; les zones transparentes ne bloquent pas les clics hors de la pilule (fenêtre ajustée au contenu).
- **Plan B** : variante 1 (sans flou du bureau, aspect « Brume ») par défaut ; acrylique en option expérimentale Win11 ; panneau déplié dans une fenêtre rectangulaire.
- ✅ **Verdict (étape 2, `spikes/02-widget`)** : variante 1 (CSS) propre (pas d'ombre ni de bord carré) ; acrylic et mica montrent un **rectangle** autour de la pilule → plan B confirmé. Dépliage ≈ 14 ms jusqu'à 2 images ; déplacement : p95 3,7 ms, ≤ 1 accroc. Les coins transparents (≈ 2,5 % de la surface) captent les clics → `SetWindowRgn` si gênant. **Non testé : Windows 10, échelles 125/150 %, Alt+Tab du widget → étapes 12-13.**

### (c) Détection d'un jeu en plein écran — étape 6
- **Question** : peut-on distinguer jeu exclusif, jeu « fenêtré sans bordure », vidéo plein écran et bureau ?
- **Protocole** :
  - `SHQueryUserNotificationState` (QUNS_BUSY = 2, QUNS_RUNNING_D3D_FULL_SCREEN = 3, QUNS_PRESENTATION_MODE = 4) [S8].
  - En complément : rectangle de `GetForegroundWindow` comparé à `GetMonitorInfoW` de son écran, en excluant le hub, `Progman` et `WorkerW`.
  - Déclencheur : `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)`, sans boucle. Contrôle toutes les 2 s seulement tant qu'une fenêtre suspecte est au premier plan.
  - Tester 3 jeux installés (exclusif et sans bordure), une vidéo plein écran et le 2e écran.
- **Réussite** : 3/3 jeux détectés en < 1 s, 0 faux positif (bureau, explorateur), coût < 0,1 % CPU.
- **Plan B** : se limiter aux apps de la catégorie Jeux lancées par le hub (correspondance d'exe), + interrupteur manuel.

### (d) Lecture du cache d'images Steam — étape 5
- **Constat [L]** dans `appcache/librarycache` (428 dossiers) :
  - deux formats coexistent : `<appid>/library_600x900.jpg` (149 fichiers) et `<appid>/<sha1>/library_600x900.jpg` (31) ou `<appid>/<sha1>/library_capsule.jpg` (88, **300×450** seulement) ;
  - héros : `library_hero.jpg` (1920×620), avec `library_hero_blur.jpg` **déjà flouté par Steam** ;
  - aussi `logo.png`, `header.jpg` et des variantes `_french` ;
  - `assetcache.vdf` est en VDF **binaire** ;
  - bibliothèques : `C:\Program Files (x86)\Steam` et `E:\SteamLibrary` ; `SteamPath` est dans `HKCU\Software\Valve\Steam`.
- **Question** : peut-on trouver pour chaque appid la meilleure affiche verticale et le héros sans lire `assetcache.vdf` ?
- **Protocole** : parcours de `<appid>/**` (profondeur 2), priorité `library_600x900` > `library_capsule` > `header` ; héros = `library_hero` ; mesuré sur les 428 dossiers.
- **Réussite** : affiche trouvée pour ≥ 95 % des jeux installés, scan < 200 ms, aucun plantage sur un dossier vide ou un fichier illisible.
- **Plan B** : tuile lettre + image fournie par l'utilisateur ; pour `library_capsule` (300×450), indiquer « affiche basse définition ».

### (e) Lancement UWP, protocoles et apps « administrateur » — étape 6
- **Question** : peut-on lancer exe, lnk, url (`steam://`, `com.epicgames.launcher://`) et UWP en obtenant un PID ? Que se passe-t-il pour une app qui exige les droits admin ?
- **Protocole** :
  - exe, lnk et URI : `ShellExecuteExW` avec `SEE_MASK_NOCLOSEPROCESS`.
  - UWP : `IApplicationActivationManager::ActivateApplication(AUMID)`, qui renvoie `processId` [S8].
  - App de test avec manifeste `requireAdministrator` : UAC, puis `PostMessageW(WM_CLOSE)` et `SetForegroundWindow` depuis le hub non élevé.
- **Réussite** : les 5 types lancés, PID ou correspondance d'exe obtenu ; comportement admin documenté.
- ✅ **Verdict partiel (étape 6, `spikes/06-launch` + `src-tauri/examples/spike_launch.rs`, build debug, ce PC)** :
  - exe par `CreateProcessW` : PID, 8 ms ; chemin inexistant → erreur 2/3 (`NotFound`).
  - UWP (`ActivateApplication`, Calculatrice) : PID, 711 ms. `steam://open/main` : PID, 85 ms. Lien `https://` : PID du navigateur, 187 ms. `.lnk` (Audacity) : PID, 250 ms. **`ShellExecuteExW` renvoie donc un PID pour les 5 types** ; ce PID est celui du processus lancé par le shell, pas toujours celui de l'app (lanceur Steam, navigateur déjà ouvert) → la correspondance reste `match.exe`.
  - Exe dont le manifeste exige l'admin lancé par `CreateProcessW` : **erreur 740 immédiate (110 ms), aucun UAC** → `ElevationRequired`, comme voulu (pas d'élévation automatique).
  - Protocole non installé (`nonexistent-proto://`) : `ShellExecuteExW` avec `SEE_MASK_FLAG_NO_UI` répond **succès sans PID** (pas d'erreur 1155) : on ne peut pas détecter un lanceur absent. Sans effet pour la config (seuls `steam` et `com.epicgames.launcher` sont autorisés).
- **Plan B** :
  - URI sans PID → correspondance par `match.exe`.
  - App élevée : l'isolation des privilèges Windows (UIPI) bloque les messages d'un processus moins privilégié → bouton « Fermer » désactivé, avec explication. Jamais de fermeture forcée.

### (f) GPU par processus via les compteurs de performance — étape 13
- **Constat [L]** : `typeperf -qx "GPU Engine"` liste 537 instances au format `pid_1140_luid_0x…_phys_0_eng_0_engtype_3D`. Ce format n'a pas de doc officielle → lecture tolérante.
- **Question** : PDH est-il juste et peu coûteux pour mesurer « le hub » = hub.exe + ses processus `msedgewebview2.exe` (le rendu se fait dans le processus GPU de WebView2) ?
- **Protocole** : `PdhOpenQuery` + `PdhAddEnglishCounterW("\GPU Engine(*)\Utilization Percentage")` + `PdhGetFormattedCounterArrayW` toutes les secondes ; filtrer sur les PID de l'arbre ; comparer au Gestionnaire des tâches.
- **Réussite** : écart ≤ 2 points avec le Gestionnaire ; coût < 0,3 % CPU ; actif uniquement quand l'écran Performance est ouvert.
- **Plan B** : afficher « GPU : indisponible » et garder FPS, CPU et RAM.

### (g) Coût réel de backdrop-filter + dégradés animés dans WebView2 — étape 2
- **Question** : à 2560×1440, 279 Hz, sur la RTX 5070, combien coûtent 3 puis 6 surfaces `blur(20px) saturate(190%)` au-dessus de 3 brumes `radial-gradient` animées en `transform` et d'un canvas de 26 particules ?
- **Protocole** :
  - Page d'essai en 4 paliers : 0, 3 et 6 surfaces, avec ou sans canvas.
  - Mesures sur 10 s : temps par image en rAF (p50/p95/max), images perdues (delta > 1,5 × 3,58 ms), CPU de l'arbre WebView2, GPU.
  - Refaire à 60 Hz.
- **Réussite** : avec 6 surfaces, p95 ≤ 5,4 ms à 279 Hz, 0 image perdue en 10 s, GPU < 15 %.
- **Plan B** : 3 surfaces maximum en Élevé, flou réduit (12 px), rien d'animé sous un `backdrop-filter`, canvas plafonné à 144 Hz.
- ⚠️ **Verdict (étape 2, `spikes/03-verre`)** : 6 surfaces + 3 brumes animées + canvas à 278 Hz : p95 3,7 ms ✅, GPU 9 % ✅ ; 0 image perdue dans 5 passages sur 7 (jusqu'à 13 dans un passage) ⚠️ ; **CPU 7,5–8,8 % de la machine > budget 4 %** ❌ (brumes seules : 3,9 %). Plan B de flou ou de surfaces inutile ; budget CPU à rediscuter (voir §5). **60 Hz non testé → étape 13.**

### (h) Extraction d'icônes d'exécutables — étape 9
- **Question** : peut-on obtenir une icône nette en 256 px (transparence correcte) pour .exe, .lnk, .url et UWP, hors thread UI ?
- **Protocole** : thread dédié avec `CoInitializeEx(COINIT_APARTMENTTHREADED)` → `SHCreateItemFromParsingName` → `GetImage(256, SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK)` → `GetDIBits` en 32 bpp → PNG. Essai sur 20 apps variées (Steam, Discord, jeux, Calculatrice UWP).
- **Réussite** : 18/20 icônes nettes, < 30 ms par icône, nombre d'objets GDI stable sur 200 extractions (pas de fuite).
- **Plan B** : `SHGetImageList(SHIL_JUMBO)` ; à défaut, tuile lettre comme dans les maquettes.

### Spikes d'étape 2 hors de la liste des 8
- ✅ **Immersif (`spikes/04-immersif`)** : sans bordure, `shadow(false)`, rectangle exact du moniteur (avec l'ombre par défaut la fenêtre déborde de 16×9 px sur l'écran voisin). Barre des tâches recouverte tant que la fenêtre est au premier plan ; avec `alwaysOnTop` (seulement pendant l'immersif, retiré dès la perte du focus) elle le reste d'un écran à l'autre ; **pas de `set_fullscreen`** (la barre des tâches réapparaît au retour). Éligible à Alt+Tab (`WS_EX_APPWINDOW`). **rAF mesuré à 278 Hz sur l'écran à 144 Hz** : la fréquence doit venir de Rust (`EnumDisplaySettings`), pas de rAF. Non testé : échelles différentes, Windows 10.
- ✅ **Zone de notification + instance unique + `--silent` (`spikes/05-tray-instance`)** : fenêtre créée dans `setup` après l'icône → icône à 41–47 ms et première image à 0,8 s après `CreateProcess` ; lancement par ShellExecute : +0,65 s (exe non signé, cause non isolée). 2e instance : fin en ≈ 200 ms, fenêtre affichée 12–22 ms après. Autostart : valeur `Run` nommée d'après `productName` = `"<exe> --silent"`, supprimée par `disable` (vérifié, ainsi que `StartupApproved\Run`).

**Risques suivis sans spike dédié** :
- tauri-specta est en RC, et la doc de rc.25 ne s'est pas construite sur docs.rs → essai de 15 min à l'étape 4, plan B ts-rs.
- WebView2 ne permet pas de régler le ralentissement en arrière-plan → la veille douce est entièrement gérée par nous.
- À 279 Hz, le budget par image est de 3,58 ms ; la gigue de rAF peut provoquer de faux déclassements de qualité → fenêtre glissante + hystérésis, testées à l'étape 13.

## 4. Feuille de route : confirmation et tâches
L'ordre est **conservé**.
- **Un déplacement** : l'instance unique passe de l'étape 12 à l'étape 2. Quelques lignes suffisent, et cela évite que deux hubs se disputent le raccourci pendant les spikes.
- **Une dépendance ajoutée** : 13 ← 6, car la veille « jeu au premier plan » utilise procwatch.
- Les spikes sont placés là où le code qui en dépend est écrit.

**2 · Squelette + spikes de fenêtres**
- [ ] Tauri 2.12 + React/Vite/TS 6, eslint, vitest, clippy ; CSP stricte, capacités minimales
- [ ] Instance unique (déplacée ici) ; fenêtre cachée au démarrage, fond #171021
- [ ] Spikes (a) affichage < 150 ms, (b) widget transparent, (g) coût du verre
- [ ] Spike fenêtre immersive sans bordure sur l'écran choisi (2 écrans, échelles différentes), Alt+Tab fluide
- [ ] Chiffres des 4 spikes dans le journal

**3 · Design system**
- [ ] `tokens.css` (couleurs, rayons, espacements, durées, courbe) ; polices locales avec l'axe opsz
- [ ] 5 thèmes JSON → variables CSS
- [ ] Verre `.lg` + variante Éco opaque ; garde-fou ≤ 6 `backdrop-filter`
- [ ] Bouton, pastille, onglets, interrupteur, recherche, curseur ; catalogue de composants (dev) ; contraste ≥ 4,5:1

**4 · Données, config, IPC, i18n**
- [ ] `config/` : `%APPDATA%/Kayro`, écritures atomiques, `schemaVersion`, migrations + sauvegarde
- [ ] Essai tauri-specta (15 min) → `bindings.ts` généré (plan B ts-rs)
- [ ] Commandes `settings_*`, `apps_*` ; événements typés
- [ ] Logs tracing en fichier tournant + commande « Exporter les logs »
- [ ] Catalogue `fr` + `t()` ; `cargo test` sur les migrations

**5 · Détection**
- [ ] Spike (d) ; Steam : registre + `libraryfolders.vdf` + `appmanifest_*.acf` (fixtures)
- [ ] Epic : `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item`. Aucun jeu Epic installé ici [L] : fixtures seulement
- [ ] Menu Démarrer (.lnk/.url, utilisateur + commun) + apps UWP (`shell:AppsFolder`)
- [ ] Dédoublonnage, tolérance (ignorer et journaliser), scan hors thread UI < 500 ms

**6 · Lanceur + suivi des processus**
- [ ] Spike (e) ; `launcher` exe/lnk/uri/uwp/url ; refuse tout ce qui n'est pas en config
- [ ] `procwatch` : apps en cours (correspondance d'exe), premier plan (`SetWinEventHook`), action « au premier plan »
- [ ] Spike (c) plein écran ; événement `app_state_changed`
- [ ] Fermeture douce `WM_CLOSE` + confirmation ; cas admin expliqué ; tests avec faux lanceur

**7 · Accueil**
- [ ] Barre du haut, titre de catégorie, carrousel (232×324 / 172×246), onglets, dock des scènes
- [ ] Clavier (flèches, Entrée, Échap, Ctrl+K) ; défilement à 5 cartes visibles + bascule grille
- [ ] Tuiles lettre en attendant les affiches (étape 14)

**8 · Atmosphère (FxLayer)**
- [ ] Interface `FxLayer` + version CSS (brume en dégradés, rayons avec `mask-image`, halo, vignette, grain PNG)
- [ ] Version Canvas 2D (poussière, pool sans allocation, delta time) ; `prefers-reduced-motion`
- [ ] Faisceau et halo qui suivent la carte ; mesures à 279 Hz et 60 Hz

**9 · Ajout/édition d'apps**
- [ ] Écran « Ajouter » : détectées / glisser-déposer / manuel (dialog)
- [ ] Spike (h) icônes 256 px + cache PNG
- [ ] Édition (nom, catégorie, arguments, exe à surveiller, favori) ; suppression avec confirmation

**10 · Moteur de scènes (Rust)**
- [ ] Trait `Action` : launch, wait, waitReady, focus, close ; annulation ; état par étape ; `required`
- [ ] Événement `scene_progress` ; tests avec faux lanceur et fausse horloge

**11 · Éditeur de scènes, dock, partage**
- [ ] Éditeur (étapes reliées, palette d'actions, emplacements), réordonnancement avec `Reorder`
- [ ] Tester / Enregistrer ; dock de l'accueil
- [ ] Import/export `.hubscene` (slots seulement, validation stricte, liaison des slots à l'import)

**12 · Modes, widget, raccourci, zone de notification**
- [x] Immersif / fenêtre / widget (d'après les spikes de l'étape 2) ; position et écran mémorisés par mode
- [x] **Hérités de l'étape 2** : Alt+Tab du widget (style `WS_EX_TOOLWINDOW` réappliqué après chaque `show`, vérifié sur la vraie fenêtre), raccourci par défaut Ctrl+Alt+H avec échec d'enregistrement géré, fenêtre créée après l'icône, `alwaysOnTop` limité à l'immersif (retiré à la perte du focus). **Non testés** : Windows 10, échelles 125/150 % (reportés à la passe de finition)
- [x] Raccourci configurable, menu de la zone de notification, démarrage avec Windows `--silent`
- [x] Widget replié/déplié (recherche, scènes, en cours, récents) ; style en réglage (C · Brume par défaut) ; « Mode économe » (réouverture mesurée à ~680 ms, cible 400 ms non atteinte : voir ROADMAP)

**12b · Atelier de DA — précisions**
- [ ] Survol des cartes (soulèvement, inclinaison ≤ 3°, reflet suivant la souris, réglable) ; anneau cristallin fin sans pulsation (~680 px sur 1280×760) ; particules braises + étoiles (P2) ; animations de référence `reference/animations/` (images clés ffmpeg, version plus fluide à curseurs)

**13 · Performance**
- [ ] États Actif/Atténué/Veille (masqué, sans focus, plein écran, écran verrouillé = `QUNS_NOT_PRESENT`) ; zéro boucle en veille
- [ ] 4 niveaux + qualité adaptative (p95 sur 2 s, remontée après 30 s) ; benchmark de 3 s
- [ ] Réglages · Performance (jauges, courbe) ; spike (f) GPU ; mode sans échec (Maj, 2 plantages)
- [ ] **À faire hérité de l'étape 2** : refaire le spike du verre à 60 Hz et à 144 Hz plafonné ; fréquence d'écran lue côté Rust ; veille douce pilotée par événement Rust (WebView2 ne suspend pas) ; remesurer le budget CPU visible (4 % / 8 %, §5)
- [ ] Mesure de tout le §5

**14 · Couleurs du jeu**
- [ ] `art` : affiche/héros locaux, empreinte, cache JPEG redimensionné
- [ ] Palette OKLab (k-means sur 64×64) hors thread UI, `palettes.json`, tests
- [ ] Contraste ≥ 4,5:1, modes off/léger/immersif, fondu 0,9 s ; héros flouté = `library_hero_blur.jpg` quand il existe

**15 · Apparence**
- [ ] Grille des thèmes, thème personnalisé (3 couleurs → dérivées), import/export validé
- [ ] « Suivre le soleil » (heure locale, sans réseau), intensité

**16 · Moteur .hubmood**
- [ ] Schéma, limites, assainissement des tracés SVG (Rust) ; rendu dans un seul canvas
- [ ] 6 packs ; écran « Ambiance du jeu » (aperçu, palette, densité/vitesse, import/export)

**17 · Ambiances sur mesure** (répétable)
- [ ] Brief → `.hubmood` écrit à la main, formes originales, coût mesuré

**17b · Sound design**
- [ ] Moteur Web Audio (`AudioContext` partagé, buffers préchargés, gain maître), manifeste `sons.json` (événement → fichier, volume, jitter ±3 %), 10 événements
- [ ] Réglages (interrupteur, volume maître 20 % par défaut, groupes interface/scènes, survol on/off), onglet « Sons » de `/dev/atelier`, `docs/SONS.md` (noms attendus + licences) ; audio suspendu en veille (étape 13) ; latence < 50 ms mesurée

**18 · Audit**
- [ ] Perf (budgets du §5), sécurité (CSP, capacités, imports malveillants), robustesse (fichiers corrompus), accessibilité

**19 · Installeur**
- [ ] NSIS `embedBootstrapper`, taille mesurée ; assistant de premier lancement (détection + benchmark)
- [ ] Guide pour les amis (SmartScreen, export des logs)

## 5. Budget de performance
**Machine (MACHINE.md)** : Ryzen 5 5600G (6 cœurs / 12 threads), 32 Go, RTX 5070 (12 Go), écran 1 en 2560×1440 à **279 Hz** (budget par image 3,58 ms), écran 2 en 2560×1440 à 144 Hz (6,94 ms), échelle 100 % sur les deux. C'est un PC haut de gamme : les budgets sont volontairement serrés pour garder de la marge sur les PC des amis.

**Règle de mesure** : « le hub » = hub.exe **+ tous les `msedgewebview2.exe` de son arbre** (navigateur, rendu, GPU). Mesurer hub.exe seul sous-estime fortement la consommation.

| Mesure | Budget | Méthode |
|---|---|---|
| Affichage par raccourci (fenêtre déjà chargée) | p95 < 150 ms, objectif 80 ms | horodatage Rust → `mark_painted` après 2 rAF ; 20 essais |
| Démarrage → icône dans la zone de notification | < 1,0 s ; fenêtre peinte < 1,5 s | `Instant` dans `main()` → événements ; 5 essais |
| Mode économe : réouverture | < 400 ms | comme le spike (a) |
| CPU au repos (masqué ou en Veille) | < 1 % de la machine sur 60 s ; aucun réveil périodique > 1/s | sysinfo sur l'arbre ; Process Explorer (changements de contexte) |
| CPU visible, sans interaction | **Équilibré < 4 % ; Élevé et Ultra < 8 %** (hub visible seulement ; décision du 09/10, à remesurer à l'étape 8 avec les effets plafonnés à 144 Hz) | idem, sur 60 s |
| GPU hub masqué | 0,0 % sur 30 s | PDH (spike f) sur l'arbre |
| GPU visible, niveau Élevé, 1440p à 279 Hz | < 15 % | PDH + Gestionnaire des tâches |
| RAM | hub.exe < 60 Mo ; arbre complet < 250 Mo visible ; mode économe masqué < 60 Mo | sysinfo (mémoire privée) |
| Temps par image | p95 ≤ 1,5 × (1000/Hz) ; 0 image perdue sur 10 s de navigation dans le carrousel | anneau de 600 deltas rAF ; image perdue = delta > 1,5 × budget |
| Clavier → image | < 2 images | rAF après `keydown` |
| Aller-retour IPC | p95 < 2 ms | 1000 appels `ping` |
| Scan des apps (Steam + Menu Démarrer) | < 500 ms, hors thread UI | `Instant` dans `detect` |
| Palette | < 30 ms par image, hors thread UI | `Instant` dans les tests |
| Installeur NSIS | < 10 Mo (dont ~1,8 Mo de bootstrapper WebView2) | taille du fichier produit |

- **Niveau visé ici** : Élevé (à confirmer par le benchmark).
- **Éco** : approché avec 60 Hz + bridage CPU ×4 dans DevTools + `backdrop-filter` coupé. C'est une approximation : « non testé sur vrai matériel » tant qu'aucun PC modeste n'est disponible.
- **Deux fréquences d'écran** (279 et 144 Hz) : **mesuré à l'étape 2, rAF reste à 278 Hz sur l'écran à 144 Hz** ; le budget par image se déduit de la fréquence lue côté Rust, pas de rAF (spike 04).
- **Budget CPU « visible » — ✅ tranché le 09/10** : 7,5–8,8 % mesuré à 279 Hz avec la scène la plus chargée (spike 03) → **< 4 % en Équilibré, < 8 % en Élevé et Ultra**. À remesurer à l'étape 8 avec les effets plafonnés à 144 Hz.

## 6. Questions bloquantes — toutes tranchées le 2026-10-09
1. **Widget** — ✅ *Tranché* : surface « Brume » semi-opaque, sans flou du bureau ; style **C · Brume** par défaut, le style reste un **réglage**. Acrylique en option expérimentale Win11 seulement.
2. **Raccourci global** — ✅ *Retranché le 09/10 (étape 2)* : **Ctrl+Alt+H** par défaut, configurable à l'étape 12. Ctrl+Alt+Espace est déjà pris sur ce PC (`RegisterHotKey` : erreur Win32 1409) ; disponibilité testée sur ce PC : **Ctrl+Alt+H libre**, Ctrl+Alt+J libre, Ctrl+Alt+F9 libre (le premier libre est retenu). Ctrl+Espace reste écarté (VS Code, claviers asiatiques). L'échec d'enregistrement sur un autre PC doit être géré dans l'interface (message + choix d'un autre raccourci).
3. **Mise à l'échelle** — ✅ *Mesuré* : échelle Windows **100 %** sur les deux écrans (MACHINE.md). Hypothèse conservée : px CSS à l'échelle Windows ; en immersif, la composition 1280×760 est agrandie selon la hauteur de l'écran (1440/760 ≈ 1,9, plafonné à ×1,5), à ajuster à l'œil à l'étape 7.
4. **Cadence** — ✅ *Tranché* : canvas FxLayer limité à **144 Hz** (« Auto » = min(Hz, 144)) ; transitions et animations CSS de l'interface à la fréquence native de l'écran.
5. **Windows 10** — ✅ *Tranché* : pris en charge « au mieux », **sans Mica** ; Win11 reste la cible.
6. **Identifiant et dossier** — ✅ *Tranché* : identifiant **`fr.yiuno.hub`**, dossier de données **`%APPDATA%/Kayro`** (ex-`Hub`, copié à la migration), figé même si le nom affiché change.
7. **Types partagés** — ✅ *Tranché* : **tauri-specta** en versions exactes épinglées, **ts-rs** en plan B si l'essai de l'étape 4 échoue.
8. **Test du niveau Éco** — ✅ *Tranché* : bridage CPU ×4 (DevTools) + 60 Hz ; « non testé sur vrai matériel » écrit dans les rapports tant qu'aucun PC modeste n'est disponible.

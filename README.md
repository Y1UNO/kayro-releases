# Kayro

Lanceur d'applications pour Windows (anciennement nom de code « Hub »). Tauri 2 + React + TypeScript + Vite. Projet privé.

- Prérequis : Rust stable (MSVC), Node 24, WebView2.
- `npm install` puis `npm run tauri dev` : lance l'app (fenêtre cachée jusqu'au premier rendu).
- `npm run tauri build` : build release + installeur NSIS.
- `npm run lint` (eslint + clippy) · `npm run typecheck` · `npm test` (vitest + cargo test) · `npm run format`.
- Nom affiché : `productName` dans `src-tauri/tauri.conf.json` (source unique, repris côté TS par Vite).
- Données et logs : `%APPDATA%/Kayro/` (dossier figé ; l'ancien `%APPDATA%/Hub/` est copié une fois, jamais supprimé).
- Docs : `CLAUDE.md` (règles), `docs/PLAN.md` (choix techniques), `docs/ROADMAP.md` (avancement).
- `scripts/build-installer.ps1` puis `scripts/publish-release.ps1` : installeur signé et publication d'une version (voir `docs/MISES-A-JOUR.md`).
- `scripts/build-local.ps1` : compile en release et crée/met à jour le raccourci `Kayro.lnk` du bureau (`-CloseRunning` ferme Kayro doucement s'il est ouvert, `-NoBuild` ne met que le raccourci à jour).

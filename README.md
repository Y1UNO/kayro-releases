# Hub

Lanceur d'applications pour Windows (nom de code « Hub »). Tauri 2 + React + TypeScript + Vite. Projet privé.

- Prérequis : Rust stable (MSVC), Node 24, WebView2.
- `npm install` puis `npm run tauri dev` : lance l'app (fenêtre cachée jusqu'au premier rendu).
- `npm run tauri build` : build release + installeur NSIS.
- `npm run lint` (eslint + clippy) · `npm run typecheck` · `npm test` (vitest + cargo test) · `npm run format`.
- Nom affiché : `productName` dans `src-tauri/tauri.conf.json` (source unique, repris côté TS par Vite).
- Données et logs : `%APPDATA%/Hub/` (dossier figé, indépendant du nom affiché).
- Docs : `CLAUDE.md` (règles), `docs/PLAN.md` (choix techniques), `docs/ROADMAP.md` (avancement).
- `spikes/` : code jetable des essais de l'étape 2, un `RESULTATS.md` par dossier.

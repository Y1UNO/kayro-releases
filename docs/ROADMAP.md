# Feuille de route

Une case cochée = étape validée par l'utilisateur et taguée. À la fin de chaque étape : coche la case et ajoute 1 à 3 lignes (décisions prises, limites connues, chiffres de perf). Ce fichier sert à reprendre une session sans tout relire.

| N° | Étape | Dépend de | Jalon |
|---|---|---|---|
| [x] 1 | Cadrage et plan technique (`docs/PLAN.md`) | — | A |
| [ ] 2 | Squelette Tauri/React + instance unique + 4 spikes de fenêtres | 1 | A |
| [ ] 3 | Design system : tokens, 5 thèmes, composants verre, catalogue | 2 | A |
| [ ] 4 | Données, config versionnée, IPC typé, i18n | 2 | A |
| [ ] 5 | Détection Steam / Epic / Menu Démarrer | 4 | A |
| [ ] 6 | Lanceur unique + suivi des processus | 4 | A |
| [ ] 7 | Accueil : titre, carrousel, onglets, Ctrl+K, grille | 3, 4, 6 | B |
| [ ] 8 | Atmosphère dynamique (`FxLayer`, CSS + Canvas 2D) | 7 | B |
| [ ] 9 | Ajout/édition d'apps, glisser-déposer, icônes | 5, 6, 7 | B |
| [ ] 10 | Moteur de scènes (Rust) | 6 | C |
| [ ] 11 | Éditeur de scènes, dock, import/export `.hubscene` | 7, 10 | C |
| [ ] 12 | Modes immersif/fenêtre/widget, raccourci, tray | 2, 7 | C |
| [ ] 13 | Performance : états, qualité adaptative, benchmark, réglages, sans échec | 6, 8, 12 | D |
| [ ] 14 | Couleurs du jeu : art local, palette OKLab, modes | 5, 8 | E |
| [ ] 15 | Réglages · Apparence : thèmes, import/export, « suivre le soleil » | 3, 14 | E |
| [ ] 16 | Moteur `.hubmood`, 6 packs, écran « Ambiance du jeu » | 8, 14 | E |
| [ ] 17 | Ambiances sur mesure (une par jeu « pépite ») | 16 | E |
| [ ] 18 | Audit : perf, sécurité, robustesse, accessibilité | 1–16 | F |
| [ ] 19 | Installeur NSIS, assistant de premier lancement, doc pour les amis | 18 | F |

**Extensions après v1.0** : A voix FR · B mains (webcam) · C intégrations (OBS, Discord, lumières) · D moteur WebGL.

## Journal des étapes
(Une entrée par étape terminée : date, décisions, limites, chiffres.)
- **Étape 1 — 2026-10-09** : `docs/PLAN.md` écrit (versions vérifiées sur crates.io/npm/doc officielle : Tauri 2.12, tauri-specta =2.0.0-rc.25 épinglé avec ts-rs en plan B, TypeScript 6.0.3 car typescript-eslint exige < 6.1). Instance unique avancée de l'étape 12 à l'étape 2 ; 13 dépend aussi de 6. Constats sur ce PC : cache Steam en 2 formats (affiche parfois en 300×450), compteurs GPU par PID présents, aucun jeu Epic installé. Spikes : aucun encore exécuté. Les 8 questions du §6 ont été tranchées le jour même (widget Brume, Ctrl+Alt+Espace, canvas à 144 Hz, `fr.yiuno.hub`).

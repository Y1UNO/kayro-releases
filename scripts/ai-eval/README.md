# Mesurer l'analyse du mode musique (Kayro contre l'IA)

Outils de l'essai du 2026-11-03 (résultats et décision : `docs/MODE-MUSIQUE.md`). Rien n'est livré avec Kayro.

1. Un environnement Python à part : `python -m venv venv`, puis `venv\Scripts\python -m pip install onnxruntime numpy soundfile musdb` (ffmpeg doit être installé).
2. Les extraits de 7 s de MUSDB18 (150 morceaux, environ 155 Mo) : `venv\Scripts\python get_musdb.py <dossier>`.
3. Les outils Rust : `cargo build --release --example music_probe --example rhythm_probe` (dans `src-tauri`), et les fichiers de l'IA : `scripts\fetch-ai.ps1`.
4. Les mesures :
   - qui joue (voix, basse, batterie, instruments) : `eval_presence.py <musdb> <modèles> <music_probe.exe> <travail>`, puis `auc.py <travail>\presence.json` ;
   - la grille du rythme : `eval_beats.py <musdb> <modèles> <music_probe.exe> <travail>`.

`<modèles>` contient `efficientat-mn10-as.onnx` (EfficientAT mn10, Hugging Face `Chris-Kode/efficientat-mn10-as-onnx`, MIT ; seulement pour la mesure de « qui joue ») et les fichiers de `src-tauri\resources\ai`.

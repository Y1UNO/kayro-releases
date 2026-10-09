# Spike 05 — zone de notification, instance unique, démarrage silencieux (ROADMAP étape 2)

**Machine** : Windows 11 25H2. Build release (exe de 9,1 Mo, non signé). `run.ps1` : 5 démarrages `--silent`, puis une 2e instance à chaque fois ; pas de clavier.
Plugins : `tauri-plugin-single-instance` 2.5.2 (premier plugin), `tauri-plugin-autostart` 2.7.0 (`--silent`), icône native `TrayIconBuilder` (menu Afficher/Quitter, clic gauche = afficher).

## Mesures (5 démarrages, depuis la création du processus par `CreateProcess`)
| | Fenêtre déclarée dans la config (créée avant `setup`) | **Fenêtre créée dans `setup`, après l'icône** |
|---|---|---|
| `main()` → début de `setup` | 0,4 s | 14–18 ms |
| `main()` → icône prête | 440–540 ms | ≈ 35 ms |
| Processus → icône prête | ≈ 1,0 s (mesure par `Start-Process`, voir ci-dessous) | **41–47 ms** |
| Processus → première image peinte (fenêtre cachée) | ≈ 1,1–1,3 s (idem) | **0,79–0,88 s** |

**Lancement par `Start-Process` / double-clic (ShellExecute)** : ajoute ≈ **0,65 s avant `main()`** (656–738 ms mesurés ; un exécutable Rust trivial et ce spike lancés par `CreateProcess` démarrent en 10–22 ms). Cause non isolée (vérification de l'exécutable non signé par Windows ou l'antivirus : à vérifier). Avec ShellExecute : icône à 0,69–0,73 s, première image à 1,45–1,52 s.

**Instance unique** : le 2e processus se termine en **189–213 ms** (démarrage compris) ; la fenêtre du 1er est affichée **12–22 ms** après l'appel (`visible:true`, `focused:true` relevés). Dans les 5 essais : 3 petites fenêtres techniques de 16×16 px à l'état silencieux (aide de l'icône, aucune fenêtre visible), puis la fenêtre principale visible après la 2e instance.

**Démarrage silencieux `--silent`** : la fenêtre reste cachée, 5/5. L'interface ne l'affiche qu'après son premier rendu si `--silent` est absent.

**Démarrage avec Windows** : `enable` écrit `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, valeur nommée d'après `productName` (`Spike05`) = `"<exe> --silent"` ; `disable` la supprime. Vérifié : entrée absente après le test (voir fin de l'étape).

## Verdict
- **Réussi.** Budget PLAN.md « démarrage → icône < 1,0 s ; fenêtre peinte < 1,5 s » : tenu avec `CreateProcess` (0,04 s / 0,8 s) ; avec ShellExecute (non signé) l'icône est à ≈ 0,7 s et la première image à ≈ 1,5 s, **en limite du budget**.
- **Ajustement d'architecture** : créer la fenêtre principale **dans `setup`, après l'icône de notification**, plutôt que dans `tauri.conf.json` (l'icône apparaît ≈ 0,5 s plus tôt). Le squelette garde pour l'instant la fenêtre dans la config (pas d'icône à cette étape) ; à reprendre à l'étape 12.
- Signer l'exécutable (étape 19) pourrait réduire les 0,65 s de ShellExecute : à mesurer.

## Non testé
- Clic gauche / menu contextuel de l'icône (pas d'automatisation de l'interaction) ; comportement après redémarrage réel de Windows ; Windows 10.

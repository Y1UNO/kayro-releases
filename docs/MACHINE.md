# Machine de développement (à remplir par l'utilisateur)

Sert à fixer les budgets de performance (étapes 1, 8, 13) et à choisir les préréglages.

| Élément | Valeur |
|---|---|
| Windows (version + build, via `winver`) | Windows 11 Famille 25H2, build 26200 |
| Processeur (modèle) | AMD Ryzen 5 5600G with Radeon Graphics (6 cœurs / 12 threads) |
| Mémoire vive | 32 Go (31,9 Go détectés) |
| Carte graphique (modèle + pilote) | NVIDIA GeForce RTX 5070, pilote 32.0.16.1714 (VRAM : à compléter via dxdiag). Aussi : Meta Virtual Monitor (affichage virtuel casque VR) |
| Écran(s) : résolution · fréquence · mise à l'échelle | écran 1 : 2560×1440 · 279 Hz · échelle à compléter  écran 2 : 2560×1440 · fréquence à compléter · échelle à compléter |
| Disque du projet (SSD / HDD) | SSD (Samsung 980 500 Go, C:) ; un HDD Toshiba 1 To est aussi présent |
| Steam installé dans | C:\Program Files (x86)\Steam |
| Autres lanceurs (Epic, GOG, Battle.net…) | Epic Games détecté (C:\Program Files\Epic Games) ; GOG non détecté ; autres : à compléter |

## PC « type » des amis (pour tester le niveau Éco)
Portable ? Carte graphique intégrée ? Mémoire ? Fréquence d'écran ? — une ligne par ami concerné, ou « inconnu ».

## Comment remplir
PowerShell :
- `Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion`
- `Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors`
- `[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)`

Fréquence d'écran : Paramètres → Système → Affichage → Affichage avancé. (Pour la mémoire de la carte graphique, `dxdiag` est plus fiable que PowerShell.)

# Mises à jour (étape 18b)

Kayro se met à jour lui-même : plus besoin de renvoyer un installeur aux amis. C'est la **seule fonction réseau** de
Kayro : une vérification à la demande (Réglages › Général › « Rechercher une mise à jour »), ou au démarrage si
l'utilisateur l'a autorisé (case cochée dans l'installeur maison, réglage « Rechercher les mises à jour au
démarrage », `updateAuto`, désactivé par défaut côté Kayro). Rien ne s'installe sans un clic.

## Comment ça marche
1. `scripts/build-installer.ps1` fabrique l'installeur NSIS **signé** (`.exe.sig`, clé privée
   `%USERPROFILE%\.kayro\kayro-updater.key`, jamais dans le dépôt) et le dossier `target\release\publish\<version>\` :
   installeur maison, installeur NSIS, signature, `latest.json` (version, notes = la dernière entrée de
   `installer/ui/patchNotes.json`, adresse de l'installeur, signature).
2. `scripts/publish-release.ps1` (avec l'accord de l'utilisateur, c'est public) crée au besoin le dépôt public
   `kayro-releases` (installeurs seulement, jamais le code) et une « Release » `v<version>` avec ces fichiers (`gh`).
3. Kayro lit `https://github.com/<compte>/kayro-releases/releases/latest/download/latest.json` (plugin
   `tauri-plugin-updater` 2.14.0, `src-tauri/src/update.rs`). Plus récent → fenêtre « Mise à jour disponible »
   (nouveautés), puis téléchargement, **vérification de la signature** avec la clé publique intégrée
   (`tauri.conf.json` › `plugins.updater.pubkey`), installation NSIS en mode passif ; Kayro se ferme et redémarre.
   Réglages, apps et images restent (`%APPDATA%\Kayro`).
4. Choix de l'installeur maison : `%APPDATA%\Kayro\install-choices.json` (`{"updateAuto":true}`), appliqué au
   démarrage suivant puis supprimé.

## À ne pas perdre
- **La clé privée** `%USERPROFILE%\.kayro\kayro-updater.key` (sans mot de passe) : à sauvegarder hors du PC (clé USB,
  coffre de mots de passe). Perdue → les Kayro installés ne pourront plus se mettre à jour (il faudrait réinstaller
  à la main une version avec une nouvelle clé publique).
- Les amis en 0.17 ou avant installent **une dernière fois à la main** la 0.18 (la première qui sait se mettre à jour).

## Publier une version
1. Monter la version (package.json, tauri.conf.json, Cargo.toml, locks) et ajouter son entrée à `patchNotes.json`.
2. `powershell -File scripts/build-installer.ps1 -CloseRunning`
3. Accord de l'utilisateur, puis `powershell -File scripts/publish-release.ps1`.

## Limites
- Pas de vérification périodique pendant que Kayro tourne (une seule au démarrage) : pas de minuterie à vide.
- Pas de retour à une version plus ancienne.

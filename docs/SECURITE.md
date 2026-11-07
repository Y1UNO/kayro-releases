# Sécurité — audit avant la v1.0 (étape 18, 2026-11-07)

Test d'intrusion de Kayro **par son propre code et ses tests**, sur ce PC, contre notre app. Question posée à
chaque fois : peut-on faire lancer à Kayro autre chose que ce qui est configuré, ou lui voler des données ?
Chaque faille trouvée = un correctif + un test qui la rejoue.

## Verdict
Aucune faille permettant de lancer un programme non configuré ni de lire un fichier arbitraire. Deux défauts
corrigés : l'installation de la voix (modèles non figés) et le nom de session Windows dans les logs exportés.
Deux risques acceptés, expliqués plus bas.

## Ce qui a été attaqué

| Surface | Attaque | Résultat | Preuve |
|---|---|---|---|
| Page (injection) | HTML / script dans un nom d'app, une scène, un titre de musique, les patch notes | **Bloqué** : aucun `innerHTML`, `eval`, `new Function` dans `src/` ; React échappe le texte ; pochettes en `data:image/*` construites par le cœur (jamais SVG) | recherche dans le code |
| CSP | script extérieur, `eval`, styles injectés | **Bloqué** : production `default-src 'self'`, pas d'`unsafe-inline` ni d'`unsafe-eval` ; `withGlobalTauri` coupé | `tauri.conf.json` |
| Permissions Tauri | accès disque, shell, ouverture d'URL depuis la page | **Bloqué** : 3 permissions seulement (écouter / ne plus écouter les événements, icône de la fenêtre) | `capabilities/default.json` |
| Protocole des affiches `kayro-art` | `..\`, autre fichier du disque, fichier énorme, faux image | **Bloqué** : la page nomme une app et un rôle, jamais un fichier ; chemin canonique sous une racine d'affiches, ≤ 16 Mo, octets d'image | `art/tests.rs` (existant) |
| Fichiers importés | thème / `.hubmood` géants, imbrication profonde (30 000), zip, binaire, NUL, champs `exe` ou `..\`, dossier déguisé, vide | **Refusés**, rien n'est écrit | `config/import_attack_tests.rs` (**nouveau**) ; `.hubscene` : `config/share.rs` (existant) |
| Commandes (IPC) | lancer un id inconnu, un chemin, une commande | **Bloqué** : `app_launch` ne lance qu'une entrée de la config, revalidée ; aucune commande ne lance un chemin reçu de la page ; les imports lisent un fichier déposé et le valident sans rien exécuter | `launcher/`, `config/validate_tests.rs` |
| Mises à jour | faux `latest.json`, installeur non signé, retour à une vieille version | **Bloqué** : module officiel de Tauri, signature vérifiée avec notre clé publique, seulement une version plus récente, HTTPS | `update.rs`, `tauri.conf.json` |
| Modèles téléchargés | fichier remplacé en amont ou détourné | **Bloqué** : SHA-256 et taille vérifiés, fichier refusé effacé ; **corrigé** : adresses Hugging Face figées sur un commit (le 07/11, Parakeet republié cassait toute installation) ; un test refuse une adresse non figée | `voice/models.rs`, `hands/models.rs` |
| Cerveau (llama-server) | joindre le serveur depuis le réseau local | **Bloqué** : écoute sur `127.0.0.1`, port libre au hasard, clé aléatoire à chaque lancement | `voice/brain/mod.rs` |
| Voix | une phrase (ou une vidéo qui parle) fait lancer autre chose | **Bloqué** : le cerveau ne rend que des actions, revérifiées par le cœur contre la config ; « seulement ma voix » au choix | `voice/act`, tests de la voix |
| Mains | un geste lance une commande | **Sans objet** : la main n'est qu'une souris (mouvement et clics), jamais une commande | `hands/pointer.rs` |
| Réseau | données envoyées | **Rien** hors mises à jour (si autorisées) et modèles (à la demande) ; une recherche web dite à la voix ouvre le navigateur de l'utilisateur | recherche `reqwest` / `TcpStream` |
| Logs exportés | contenu partagé avec un ami | **Corrigé** : le dossier personnel (`C:\Users\<nom>`) devient `%USERPROFILE%` dans le zip, toutes casses et barres ; un nom ne mord jamais sur un autre (`Tom` / `Tommy`) | `logs_export.rs` (**nouveau test**) |
| Démarrage | tâche planifiée détournée vers un autre exe | **Bloqué** : une tâche qui vise un autre exe est repointée au lancement | `platform/logon_task.rs` (étape 19) |

## Risques acceptés
- **Port de débogage par variable d'environnement** (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`) : il ouvre la page
  de Kayro à un outil de débogage. Seul un programme qui tourne déjà **avec les droits de l'utilisateur** peut poser
  cette variable, et il pourrait alors lancer ce qu'il veut lui-même : aucune élévation. Les pages web ne peuvent
  pas s'y connecter (Chromium refuse les origines non autorisées). Gardé : c'est ainsi qu'on vérifie l'exe.
- **Fichiers de Kayro modifiables par l'utilisateur** (`%APPDATA%\Kayro\apps.json`, dossier d'installation par
  utilisateur, runtime du cerveau dans `voice\`) : quelqu'un qui écrit déjà là a les droits de l'utilisateur. La
  configuration *est* la liste de ce que Kayro peut lancer, par définition.

## Pas fait (et pourquoi)
- `freezePrototype` (Tauri) non activé : aucune entrée non fiable n'atteint le JavaScript ; à tester avant de
  l'allumer (risque de casser des bibliothèques).
- Pas de lecteur d'écran ni d'antivirus testés ici ; pas de fuzzing en continu (cas écrits à la main).

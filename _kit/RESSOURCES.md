# RESSOURCES — ce que TU dois fournir (et quand)

Tout se prépare **avant l'étape concernée**, pas avant tout le projet. L'ordre ci-dessous suit les étapes.

## Résumé

| § | Ressource | Étapes | Obligatoire ? |
|---|---|---|---|
| 1 | Captures PNG des maquettes | 3, 7, 8, 9, 11, 12, 13, 15, 16 | Oui (sans elles, Claude ne voit pas le rendu) |
| 2 | Fiche machine (`docs/MACHINE.md`) | 1, 8, 13 | Oui |
| 3 | Accès aux dossiers Steam/Epic (lecture seule) | 5, 14 | Oui |
| 4 | Liste de tes vraies apps | 6, 7, 9 | Oui |
| 5 | Jeux de test pour les couleurs | 14 | Oui |
| 6 | Briefs d'ambiances (par jeu « pépite ») | 17 | Oui, par jeu |
| 7 | Nom, logo | 19 | Non (nom de code « Hub » tant que tu n'as pas choisi) |
| 8 | Ce que tu ne dois PAS donner | tout | — |

---

## 1. Captures des maquettes (PNG)

Dans le canvas de maquettes : ouvre chaque planche, utilise l'icône de téléchargement/export de la planche pour l'enregistrer en PNG (sinon, capture d'écran Windows `Win+Maj+S` en plein cadre). Place les fichiers dans `repo/reference/captures/` avec ces noms :

| Fichier | Contenu | Servira à l'étape |
|---|---|---|
| `01-accueil-crepuscule.png` | Planche **Liquide** (accueil), thème Crépuscule | 3, 7, 8 |
| `02-accueil-boreale.png` | Liquide en thème Aurore boréale (réglage `theme`) | 7, 8 |
| `03-accueil-ocean.png` | Liquide en thème Océan | 7, 8 |
| `04-apparence.png` | Planche **Apparence** | 3, 15 |
| `05-jeu-generique.png` | Planche **Jeu** — mode Léger, pack Braises | 16 |
| `06-jeu-runes.png` | Planche **Jeu** — pack Runes, mode Immersif | 16 |
| `07-editeur.png` | Planche **Éditeur de scène** | 11 |
| `08-reglages-performance.png` | Planche **Réglages · Performance** | 13 |
| `09-ajout-apps.png` | Planche **Ajout d'apps** | 9 |
| `10-widget-styles.png` | Planche **Widget** (4 styles de barre) | 12 |
| `11-widget-ouvert.png` | Planche **Widget ouvert** | 12 |

Conseils : une capture par fichier, pas de recadrage serré, taille d'origine. Claude Code lit les images ; **il ne lit pas les vidéos**. Pour le mouvement (balancement de lumière, glissement du faisceau), il s'appuie sur les valeurs écrites dans `docs/DESIGN.md` et sur le code des maquettes. Si un mouvement te semble raté, décris-le en une phrase (« trop rapide », « le faisceau devrait arriver avant la carte »), c'est plus efficace qu'une vidéo.

## 2. Fiche machine

Remplis `repo/docs/MACHINE.md` (les commandes PowerShell sont dedans). Claude s'en sert pour fixer les budgets de performance et les niveaux de qualité. Ajoute une ligne sur le PC « le plus faible » d'un ami qui l'utilisera (portable ? carte graphique intégrée ?) : c'est lui qui sert à tester le niveau Éco.

## 3. Steam / Epic (étapes 5 et 14)

Claude Code tourne **sur ton PC** : à l'étape 5 il inspecte lui-même les dossiers en lecture seule (il te demandera la permission). Prépare juste :
- Steam installé et connecté au moins une fois, avec **ouvert au moins une fois la bibliothèque** (pour que les affiches soient dans le cache local).
- Le chemin d'installation si ce n'est pas `C:\Program Files (x86)\Steam`.
- Epic Games Launcher installé si tu l'utilises.

Si Claude Code n'arrive pas à lire un dossier, lance ces commandes dans PowerShell et colle-lui les résultats (adapte le chemin de Steam) :
```
Get-Content "C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf"
Get-ChildItem "C:\Program Files (x86)\Steam\steamapps" -Filter appmanifest_*.acf | Select-Object -First 1 | Get-Content
Get-ChildItem "C:\Program Files (x86)\Steam\appcache\librarycache" -Recurse -Depth 2 | Select-Object -First 80 FullName
Get-ChildItem "C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests" -Filter *.item | Select-Object -First 1 | Get-Content
```
Ces sorties contiennent des chemins de ton PC : ne les poste jamais en public (Claude les anonymise pour les fichiers de test du dépôt).

## 4. Liste de tes vraies apps (étapes 6, 7, 9)

Un tableau texte suffit, 15 à 30 lignes, avec de la variété :

| Nom | Catégorie | Origine (Steam / Epic / exe / UWP / site web) | Exige admin ? | Nom du processus (si tu le connais) |
|---|---|---|---|---|

Inclus volontairement des cas pénibles : une app qui demande les droits admin, une app du Microsoft Store (UWP), un lien web, un jeu qui passe par un autre lanceur, une app qui garde le même processus après relance. Ce sont eux qui font apparaître les vrais bugs.

## 5. Jeux de test pour les couleurs (étape 14)

Choisis 5 à 8 jeux : au moins un jeu **très coloré**, un **très sombre**, un à affiche **claire**, un **non Steam** (tu fourniras une image à la main), et un jeu dont l'affiche **change selon les saisons** (ex. Apex) pour tester la mise à jour automatique. Note les noms dans `docs/MACHINE.md` ou dans le prompt. Pour tester le changement de saison sans attendre : Claude simule la mise à jour en remplaçant l'image **dans le cache de l'app** (jamais dans les dossiers de Steam) par une autre image : l'empreinte change, la palette doit se recalculer seule.

## 6. Briefs d'ambiances sur mesure (étape 17)

**Un dossier par jeu** : `repo/reference/briefs/<jeu>/` avec `brief.md` et 3 à 5 captures.

Modèle de `brief.md` :
```
Jeu : 
3–5 mots d'ambiance : 
Mouvement : (lent / solennel / nerveux / flottant / pesant / …)
Une phrase d'intention : (ce que tu veux ressentir en sélectionnant ce jeu)
Palette : auto d'après l'affiche (par défaut) / ou : couleurs imposées
Éléments souhaités : (braises, runes, brume, étoiles, pluie, poussière, éclats…)
À éviter : 
Niveau d'intensité : discret / marqué / spectaculaire
```
Captures utiles : un écran de menu, une illustration clé, un moment d'ambiance en jeu, l'interface. Elles servent **d'inspiration** : Claude dessine des glyphes et des formes **originaux** (jamais de logo, de symbole propriétaire ou d'illustration copiée), et rien de l'art officiel n'entre dans l'app ni dans l'installeur.

Exemple de brief à adapter (à toi de le réécrire avec tes mots) :
```
Jeu : Hades II
3–5 mots d'ambiance : nuit, lune, braises, runes, sorcellerie
Mouvement : lent, solennel
Intention : « une forge qui veille sous la lune »
Palette : auto
Éléments souhaités : braises qui montent, anneau de runes qui tourne très lentement, brume basse
À éviter : couleurs néon, mouvement nerveux
Intensité : marqué
```
Commence par **un seul** jeu (ton préféré) : tu valides le moteur et ton goût avant d'en faire d'autres.

## 7. Nom et logo

Aucune urgence : tout passe par `APP_NAME`. Pistes évoquées : Lumen, Orbit, Drift, Prism, Aether. Vérifie qu'un nom n'existe pas déjà comme logiciel connu avant de le garder. À l'étape 19, si tu n'as pas de logo, Claude propose une icône simple et originale (SVG → `.ico`).

## 8. Ce que tu ne dois PAS donner à Claude Code

Mots de passe, jetons d'accès, clés d'API, informations bancaires, captures d'écran de tes comptes ou de ta messagerie. L'app n'en a pas besoin. Les captures que tu fournis ne doivent montrer que les maquettes et les jeux.

# Kayro 0.17 prétest — note pour les testeurs

Merci de tester Kayro ! C'est un lanceur d'applications pour Windows : un écran joli et rapide pour ouvrir tes jeux
et tes logiciels, qui apparaît avec un raccourci clavier. C'est une **version de test** : il y aura des bugs, et c'est
justement ce que je cherche.

Kayro marche **sans Internet** et n'envoie rien : tes réglages restent sur ton PC.

## 1. Installer

1. Lance `Kayro_0.17.0_Installer.exe`, puis clique sur **Installer** (la case « raccourci sur le bureau » est
   cochée par défaut). À la fin, **Lancer Kayro**. Si Kayro est déjà ouvert, l'installeur propose de le fermer
   proprement d'abord ; une ancienne version est mise à jour, tes réglages restent.
2. Windows affiche sûrement **« Windows a protégé votre ordinateur »** (SmartScreen). C'est normal : le programme
   n'est pas signé (un certificat coûte cher pour un projet perso). Clique sur **« Informations complémentaires »**,
   puis sur **« Exécuter quand même »**. Ton antivirus peut aussi poser la question.
3. L'installation se fait pour ton compte seulement, sans droits administrateur.
4. Si ton PC n'a pas WebView2 (le moteur d'affichage de Microsoft, presque toujours présent sur Windows 11),
   c'est l'installeur classique de Windows qui s'ouvre, et il le télécharge : il faut Internet **à ce moment-là
   seulement**.
5. En cas de souci, le dossier `secours` contient l'installeur classique (`Kayro_0.17.0_x64-setup.exe`) : il
   installe exactement la même chose, dans une fenêtre Windows ordinaire.

## 2. Utiliser

- **Au premier lancement**, Kayro est vide : clique sur **+** en haut à droite (« Ajouter des applications »).
  L'onglet **Détectées** liste ce qu'il a trouvé (Steam, Epic, menu Démarrer…) : coche ce que tu veux, puis
  **Ajouter**. Les onglets **Glisser-déposer** et **Manuel** servent pour le reste.
- **Ctrl + Alt + H** affiche ou cache Kayro. Si un autre programme utilise déjà ce raccourci, Kayro te le dit :
  choisis-en un autre dans **Réglages › Général**.
- La croix **cache** Kayro sans le fermer : il reste dans la zone de notification (près de l'horloge). Pour le
  fermer vraiment : clic droit sur son icône › **Quitter**.
- **Modes d'affichage** (bouton « Mode d'affichage » en haut) : **Fenêtre**, **Immersif** (plein écran) et
  **Widget** (petit panneau sur le bureau).
- Tu peux changer de thème, mettre des images à tes jeux (glisser une image sur une carte) et régler les
  couleurs du jeu dans **Réglages › Visuel**. Tu peux aussi créer tes propres thèmes (**Mes thèmes**), les
  exporter et les importer.
- **Sons** (nouveau en 0.17) : **Réglages › Sons** : style Premium (doux et cristallin), Rétro ou 8-bit, volume
  (curseur en forme d'onde), et ce qui fait du son (interface, changement de catégorie, lancement). Tout se coupe
  d'un clic. L'installeur a aussi un onglet **Patch notes** qui raconte toutes les versions.
- **Ambiances** (nouveau en 0.16) : clic droit sur un jeu › **Modifier…** › **Ambiance du jeu** : braises,
  étoiles, brume, runes, pluie… autour de la carte quand le jeu est sélectionné. Deux ambiances sur mesure ont
  une **animation de lancement** : « Sceau de la sorcière » (pour Hades II) et « Pétales du Gommage » (pour
  Clair Obscur : Expedition 33). Le jeu se lance derrière l'animation, qui s'arrête quand sa fenêtre arrive ;
  clic ou Échap pour passer. Les ambiances demandent « Couleurs du jeu » activé (Réglages › Visuel).

## 3. Si ça rame

- **Réglages › Visuel › Qualité › Éco** (la qualité « Auto » ne s'adapte pas encore toute seule).
- **Réglages › Visuel › Mouvement › Net** pour couper les rebonds et les effets.
- **Réglages › Général › Mode économe** si Kayro prend trop de mémoire (il met alors ~0,4 s à s'ouvrir).

## 4. M'envoyer tes retours

1. **Réglages › Général › Exporter les logs** : un fichier `kayro-logs-<date>.zip` est créé et l'Explorateur
   s'ouvre dessus.
2. Envoie-moi ce zip avec ton message. <!-- TODO : comment me l'envoyer (Discord, mail…) -->
   Il contient le journal de Kayro (ce qu'il a fait, les noms et chemins de tes applications, ta version de
   Windows). Aucune image, aucun mot de passe.
3. Dis-moi aussi : ta version de Windows (10 ou 11), ta taille d'écran, la mise à l'échelle (Paramètres ›
   Affichage › Échelle, par ex. 100 / 125 / 150 %), la fréquence de ton écran (60, 144 Hz…) et ta carte graphique.
4. La version testée est écrite en bas de **Réglages › Général** (« Kayro 0.17 prétest »).

Ce qui m'intéresse le plus : <!-- TODO : les 3 ou 4 choses à tester en priorité -->
- ce qui est lent, saccadé ou bizarre à l'écran ;
- les applications oubliées ou mal détectées (surtout Epic et GOG) ;
- ce que tu ne comprends pas sans explication.

## 5. Désinstaller

**Paramètres Windows › Applications › Applications installées › Kayro › Désinstaller.**

La case « supprimer les données de l'application » efface seulement le cache d'affichage. **Tes réglages, ta
liste d'apps et tes images restent** dans `%APPDATA%\Kayro` (colle ce chemin dans la barre de l'Explorateur) :
supprime ce dossier à la main si tu veux tout effacer.

## 6. Pas encore fait (inutile de le signaler)

- Pas encore testé sur Windows 10, en mise à l'échelle 125 / 150 %, à 60 Hz ni sur une carte graphique plus
  faible : **c'est là que tes retours comptent le plus**. Si les effets lourds ne marchent pas, Kayro passe tout
  seul à un rendu plus simple.
- Epic et GOG n'ont pas été essayés avec de vrais jeux installés.
- Pas de mises à jour automatiques : je t'enverrai les nouvelles versions (installe par-dessus, tes réglages
  restent).
- À venir : assistant de premier lancement.
- Les animations de lancement n'ont été essayées que sur mon PC : dis-moi si le jeu met du temps à passer devant
  ou si Kayro reste affiché trop longtemps.
- Pas de commande vocale, de gestes ni d'intégrations (Discord, OBS…) pour l'instant.
- La liste « Détectées » est plus courte qu'en 0.14 ; s'il reste un intrus, décoche-le.

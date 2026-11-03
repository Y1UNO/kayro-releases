# Mission : intégrer le nouveau mode musique de Kysland dans Kayro

**Durée : pas de limite.** Ça veut vraiment dire aucune limite : tu peux y passer la journée entière s'il le faut. Ne coupe rien pour aller vite. Va jusqu'au bout : port complet, branchement sur le vrai son, réglages, tests sur le .exe de production. Si une étape est longue, continue au lieu de t'arrêter à une version partielle.

## Ce que je te donne

Les trois fichiers sont dans le même dossier que ce prompt :

- `reference-labo.html` : le prototype validé. Ouvre-le dans un navigateur (Chrome ou Edge), clique « Lancer le son », puis « Plein écran ». **C'est la référence visuelle : le résultat dans Kayro doit être identique.** Son code fait foi pour tous les chiffres (ressorts, amplitudes, couleurs, shaders).
- `SPEC.md` : comment le prototype marche, ce qui doit changer pour l'app (vrai son, fenêtre transparente, réglages) et les critères de validation.
- `PROMPT.md` : ce fichier.

## Ce que je veux

Le mode musique de Kysland (l'île noire en haut de l'écran) doit devenir exactement ce qu'on voit dans le labo :

1. **Île** (départ et retour) : l'île se tasse, s'étire comme du miel, le col casse, la boule tombe au centre et devient le lecteur. Au retour, la boule s'accroupit, saute, l'île descend la chercher et la boule s'y refond. Dans l'app, ça se déclenche à l'ouverture et à la fermeture du mode musique, en attendant le prochain kick (600 ms maximum).
2. **Disque** : la pochette tourne dans un disque de gelée noire brillante, avec le halo, les rayons, les cordes, les ondes de choc, les gouttes au crash et le titre qui fait une ola sur chaque kick.
3. **Encre** : la masse d'encre qui change de figure (floraison, gelée, miroir, satellites, tourbillon, silence).

Les anciennes animations (A1, A2, D1 à D5, N1 à N6 de la première page de revue) sont remplacées par celles-ci.

**Interdit : les pics (épines, ferrofluide pointu).** Je les ai fait retirer, je les trouve moches. N'en remets nulle part, même au crash.

## Comment t'y prendre

1. **Lis d'abord** `SPEC.md` en entier, puis le code de `reference-labo.html`.
2. **Fais l'état des lieux du projet** (C:\HUB) avant de coder :
   - où est le code de Kysland et du mode musique actuel ;
   - comment l'app récupère déjà le titre, l'artiste et la pochette du morceau en cours, s'il y a quelque chose ;
   - comment la fenêtre de l'île est configurée (transparence, toujours au premier plan, clics qui traversent) ;
   - le kit `_kit/PROMPTS.md` et le vault Obsidian.

   Écris-moi un court résumé de ce que tu as trouvé et ton plan, puis enchaîne sans attendre.
3. **Porte le moteur en TypeScript** dans le style du projet. Copie les shaders GLSL tels quels (sans le code des pics, déjà retiré). Garde la physique en pas fixes de 1/480 s et les traînées indépendantes de la fréquence d'écran.
4. **Garde un mode démo** qui rejoue le morceau de test du labo (synthé WebAudio compris). Compare-le côte à côte avec `reference-labo.html` : mêmes mouvements, mêmes couleurs, même timing.
5. **Branche le vrai son** (voir `SPEC.md`, partie « Vrai son ») : capture de ce qui sort des haut-parleurs côté Rust, analyse, événements kick, caisse claire, charleston et crash vers l'interface. Pas d'IA, uniquement du traitement du signal.
6. **Ajoute les réglages** dans Paramètres, catégorie Visuel. Les principaux sont visibles, le reste va dans « Avancé » (liste dans `SPEC.md`).
7. **Teste sur le .exe de production, en plein écran normal.** Je n'utilise pas l'atelier de dev. Teste avec plusieurs morceaux : un morceau calme, un très fort, un avec un vrai drop.
8. **Mets à jour le vault Obsidian** de Kayro : ce qui a été fait, où est le code, comment régler la détection.
9. **Commits** comme d'habitude (pseudo YIUNO), un par étape logique.

## Quand c'est fini

Donne-moi :

- ce qui marche ;
- ce que tu as dû adapter par rapport au labo, et pourquoi ;
- les réglages de détection que tu as choisis ;
- comment je teste en 2 minutes sur le .exe.

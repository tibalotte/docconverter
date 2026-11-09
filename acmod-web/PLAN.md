# Plan de développement : éditeur web de pneus et suspensions (Assetto Corsa)

Application web **autonome** (pas d'intégration à Content Manager, pas de serveur) : l'utilisateur ouvre une page, choisit le dossier `data` d'une voiture, modifie les paramètres de **pneus** et de **suspensions**, puis enregistre directement dans ce dossier.

## Décisions techniques

- **Stack :** HTML + CSS + JavaScript (modules ES), sans framework ni étape de build au départ. Un simple dossier de fichiers statiques, ouvrable en local ou hébergeable sur n'importe quel hébergement statique.
- **Accès au dossier :** API *File System Access* (`showDirectoryPicker`). Elle permet de lire **et d'écrire en place** dans le dossier choisi, après autorisation de l'utilisateur.
  - Compatible : Chrome, Edge, Opera (et dérivés Chromium).
  - Non compatible : Firefox et Safari. **Mode de repli** prévu : import des fichiers (ou d'un zip du dossier `data`), puis téléchargement des fichiers modifiés.
- **Données :** tout reste dans le navigateur. Aucun fichier n'est envoyé nulle part.
- **Tests :** lanceur de tests intégré à Node (`node --test`), sans dépendance à installer.
- **Périmètre V1 :** dossier `data` déjà dépaqueté (via Content Manager ou autre). Les courbes `.lut` et la lecture directe de `data.acd` viennent plus tard.

## Règles de travail

1. Ne jamais écrire dans un fichier sans sauvegarde préalable.
2. Chaque phase se termine par des tests qui passent avant de continuer.
3. Un commit par phase terminée.
4. Cocher la case de l'étape ici dès qu'elle est finie.

---

## Phase 0 : Cadrage

- [ ] 0.1 Récupérer 2 ou 3 dossiers `data` de voitures différentes (une Kunos simple, une avec plusieurs composés de pneus, un mod) pour servir de jeux de test.
  - *Fixtures synthétiques en attendant (voir `fixtures/README.md`) : à remplacer par de vrais dossiers.*
- [ ] 0.2 Lire à la main `tyres.ini`, `suspensions.ini` et `setup.ini` : lister les sections et clés réellement présentes (elles varient d'une voiture à l'autre).
  - *Clés retenues d'après la structure connue des fichiers AC, pas encore vérifiées sur de vrais fichiers.*
- [x] 0.3 Écrire `docs/champs.md` : pour chaque clé retenue, nom, unité, plage plausible, effet.
  - *Généré depuis `js/params.js` (`node tools/gen-champs.mjs`). Plages à valider.*

**Critère de fin :** on sait exactement quelles clés la V1 expose.

## Phase 1 : Squelette du projet

- [x] 1.1 Structure :
  ```
  acmod-web/
    index.html
    css/style.css
    js/
      main.js          # point d'entrée, câblage de l'interface
      fs-access.js     # accès au dossier (File System Access + repli)
      ini.js           # parseur INI fidèle
      tyres.js         # modèle pneus
      suspension.js    # modèle suspensions
      setup.js         # lecture de setup.ini
      backup.js        # sauvegardes / restauration
      validate.js      # règles de validation
      ui/              # composants d'interface
    tests/
    fixtures/          # copies de fichiers AC pour les tests
    docs/champs.md
  ```
  - *Modules ajoutés : `encoding.js`, `params.js`, `workspace.js` (état d'édition sans DOM), `diff.js`, `zip.js`, `handle-store.js`.*
- [x] 1.2 `package.json` minimal (uniquement pour `npm test` → `node --test`), dépôt git, `.gitignore`.
- [x] 1.3 Copier les jeux de test dans `fixtures/`.

**Critère de fin :** `npm test` s'exécute (même avec un test vide) et `index.html` s'affiche.

## Phase 2 : Parseur INI fidèle (`ini.js`)

AC tolère des fichiers « sales » (commentaires `;` ou `//`, espaces variables, clés dupliquées, casse variable). Un parseur classique perd tout cela.

- [x] 2.1 Lecture ligne par ligne en conservant chaque ligne brute (commentaires, lignes vides, mise en forme, fins de ligne CRLF/LF).
- [x] 2.2 API : `get(section, key)`, `set(section, key, value)`, `sections()`, `keys(section)`. `set` ne modifie que la valeur, jamais le reste de la ligne (commentaire de fin compris).
- [x] 2.3 Test : relire puis réécrire chaque fixture sans modification doit donner un texte **identique caractère pour caractère**.
- [x] 2.4 Test : modifier une valeur ne change que cette ligne.
- [x] 2.5 Gérer l'encodage (UTF-8 / latin-1) à la lecture et à l'écriture.

**Critère de fin :** le test d'aller-retour identique passe sur toutes les fixtures.

## Phase 3 : Accès au dossier et sauvegardes

- [x] 3.1 `fs-access.js` : choisir le dossier `data` (`showDirectoryPicker({ mode: 'readwrite' })`), lire un fichier, écrire un fichier, lister le contenu.
- [x] 3.2 Vérifier le contenu du dossier : présence de `tyres.ini`, `suspensions.ini`, `setup.ini`. Message clair si le dossier ne contient pas ces fichiers (par exemple si c'est le dossier de la voiture avec un `data.acd` au lieu de `data/`).
- [x] 3.3 `backup.js` : avant la première écriture, copier les fichiers concernés dans un sous-dossier `.acmod_backup/<horodatage>/` du dossier choisi. Fonction `restore(backupId)`.
- [x] 3.4 **Mode de repli** (navigateurs sans File System Access) : import de fichiers ou d'un zip, export des fichiers modifiés en téléchargement.
- [x] 3.5 Mémoriser le dossier choisi (le handle peut être gardé dans IndexedDB) pour rouvrir plus vite à la visite suivante, avec redemande d'autorisation si nécessaire.
- [x] 3.6 Tests de la logique de sauvegarde avec un système de fichiers simulé (faux dossier en mémoire).

**Critère de fin :** on peut ouvrir un dossier, sauvegarder, modifier un fichier test et restaurer à l'identique.

## Phase 4 : Modèle de données pneus (`tyres.js`)

- [x] 4.1 Détecter les composés présents (`[FRONT]`, `[REAR]`, `[FRONT_1]`, `[REAR_1]`, etc.) et les sections thermiques associées (`[THERMAL_FRONT]`, …).
- [x] 4.2 Décrire chaque paramètre retenu (nom, unité, min/max indicatifs, description). Candidats : `WIDTH`, `RADIUS`, `RIM_RADIUS`, `FLEX`, `DX_REF`, `DY_REF`, `PRESSURE_IDEAL`, `PRESSURE_STATIC`, `FRICTION_LIMIT_ANGLE`, `CAMBER_GAIN`, `SPEED_SENSITIVITY`, rolling resistance.
- [x] 4.3 `loadTyres(files)` et `applyTyres(iniFile, model)` qui s'appuient sur `ini.js`.
- [x] 4.4 Tests sur plusieurs fixtures (un composé, plusieurs composés).

## Phase 5 : Modèle de données suspensions (`suspension.js`, `setup.js`)

- [x] 5.1 Lire `[FRONT]`, `[REAR]`, `[ARB]` de `suspensions.ini`. Candidats : `SPRING_RATE`, `PROGRESSIVE_SPRING_RATE`, `BUMP_STOP_RATE`, `PACKER_RANGE`, `DAMP_BUMP`, `DAMP_FAST_BUMP`, `DAMP_REBOUND`, `DAMP_FAST_REBOUND`, `STATIC_CAMBER`, `TOE_OUT`, `TRACK`, `BASEY`, barres antiroulis.
- [x] 5.2 Marquer les **points de géométrie** (`WBCAR_*`, `WBTYRE_*`, etc.) comme « avancé / lecture seule » en V1.
- [x] 5.3 Lire `setup.ini` : plages min/max/pas des réglages joueur, pour les afficher et les modifier.
- [x] 5.4 Tests d'aller-retour et de modification ciblée.

## Phase 6 : Validation (`validate.js`)

- [x] 6.1 Règles par paramètre : valeur numérique, positive si nécessaire, dans une plage plausible, cohérence avant/arrière.
- [x] 6.2 Deux niveaux : **erreur** (bloque l'écriture) et **avertissement** (ex. amortissement très éloigné de la valeur d'origine).
- [x] 6.3 Écart par rapport à l'original (valeur lue depuis la sauvegarde ou la copie chargée au départ).
- [x] 6.4 Tests unitaires de chaque règle.

## Phase 7 : Interface web (V1)

- [x] 7.1 Écran d'accueil : bouton « Ouvrir le dossier data », indication de compatibilité du navigateur, lien vers le mode de repli.
- [x] 7.2 Onglet **Pneus** : un bloc par composé, avant/arrière côte à côte, champs numériques bornés avec unités, surlignage des valeurs modifiées.
- [x] 7.3 Onglet **Suspensions** : même principe, plus la géométrie en lecture seule.
- [x] 7.4 Onglet **Réglages joueur** (`setup.ini`) : plages min/max/pas éditables.
- [x] 7.5 Barre d'actions : Enregistrer, Annuler les modifications, Restaurer l'original, Voir les différences.
- [x] 7.6 Affichage des erreurs et avertissements de validation en clair, indicateur de modifications non enregistrées.
- [x] 7.7 Interface adaptée aux écrans moyens et clavier (tabulation, flèches pour ajuster).
- [ ] 7.8 Test manuel complet avec un vrai dossier `data` dans Chrome ou Edge.
  - *Fait en automatique dans Chromium (`npm run e2e`, dossier simulé via OPFS + mode de repli). Reste à faire à la main avec un vrai dossier.*

**Critère de fin :** ouvrir → modifier → enregistrer → restaurer fonctionne sur un vrai dossier de voiture.

## Phase 8 : Extensions

- [ ] 8.1 **Fichiers `.lut`** : parseur, éditeur de courbe (points éditables avec aperçu graphique), vérifications (monotonie, plage).
- [ ] 8.2 **Presets** : export/import d'un jeu de paramètres en JSON, comparaison de deux presets.
- [ ] 8.3 **`data.acd` direct** : lecture et écriture du format ACD dans le navigateur, pour éviter le dépaquetage manuel (à valider sur les fixtures).
- [x] 8.4 Aide contextuelle : description de chaque paramètre issue de `docs/champs.md`.
  - *Description de chaque paramètre en infobulle (survol du nom ou du champ).*
- [ ] 8.5 Comparaison avec une autre voiture (deux dossiers `data` ouverts côte à côte).

## Phase 9 : Validation en jeu

- [ ] 9.1 Charger la voiture modifiée dans AC (session hors ligne) et vérifier qu'elle démarre sans erreur.
- [ ] 9.2 Vérifier dans l'écran de setup que les plages et valeurs correspondent.
- [ ] 9.3 Test de conduite : un paramètre à la fois, avec une modification volontairement marquée, pour confirmer l'effet attendu.
- [ ] 9.4 Noter les surprises dans `docs/champs.md` et corriger les plages de validation.

## Phase 10 : Finition et diffusion

- [x] 10.1 README : utilisation, navigateurs compatibles, mise en garde sur les checksums en ligne et sur les licences de contenu.
- [ ] 10.2 Hébergement statique (GitHub Pages ou équivalent) **ou** distribution en dossier à ouvrir localement. Noter que `showDirectoryPicker` exige un contexte sécurisé : `https://` ou `http://localhost`.
- [ ] 10.3 Numéro de version et journal des modifications.

---

## Risques et points d'attention

| Risque | Mesure |
|---|---|
| Firefox / Safari sans accès en écriture au dossier | Mode de repli import / export (phase 3) |
| Ouverture de la page en `file://` : le sélecteur de dossier peut être limité | Lancer un petit serveur local (`python -m http.server`) ou héberger en https (phase 10) |
| Perte des fichiers originaux | Sauvegarde automatique avant la première écriture (phase 3) |
| Valeurs de physique incohérentes | Validation à deux niveaux (phase 6) |
| Différences entre voitures (clés manquantes, sections en plus) | Tests sur plusieurs fixtures (phases 2, 4, 5) |
| Mods tiers avec géométrie complexe | Géométrie en lecture seule en V1 |
| Serveurs en ligne qui vérifient les fichiers | Avertissement dans l'interface et le README |

## Ordre de priorité si le temps manque

Phases 0 → 1 → 2 → 3 → 4 → 5 → 7. Cela donne un outil utilisable en V1 ; la validation avancée (6) peut être limitée au strict nécessaire au début. Les extensions (8) viennent après.

# acmod-web

Éditeur web **autonome** des pneus et suspensions d'une voiture **Assetto Corsa**.
On ouvre une page, on choisit le dossier `data` d'une voiture, on modifie `tyres.ini`,
`suspensions.ini` et `setup.ini`, puis on enregistre directement dans ce dossier.

- Aucun serveur, aucune dépendance, aucune étape de build : HTML + CSS + modules ES.
- Tout reste dans le navigateur : aucun fichier n'est envoyé nulle part.
- Les fichiers sont réécrits **à l'identique** sauf les valeurs modifiées (commentaires, espaces,
  fins de ligne CRLF/LF, encodage UTF-8 / Windows-1252 et BOM conservés).
- Une sauvegarde est faite **avant toute écriture** dans `data/.acmod_backup/<horodatage>/`.

## Utilisation

1. Dépaquetez les données de la voiture si elle n'a qu'un `data.acd`
   (Content Manager : clic droit sur la voiture → *Unpack data*).
2. Servez le dossier `acmod-web/` en local (l'API de dossier exige `https://` ou `http://localhost`) :

   ```bash
   cd acmod-web && python3 -m http.server 8080
   ```

   puis ouvrez <http://localhost:8080> dans Chrome, Edge ou Opera.
3. **Ouvrir le dossier data** → choisissez `assettocorsa/content/cars/<voiture>/data`
   (si vous choisissez le dossier de la voiture, l'outil descend tout seul dans `data/`).
4. Modifiez les valeurs. Clavier : Tab pour passer d'un champ à l'autre, ↑ ↓ pour ajuster
   (Maj : ×10, Alt : ÷10), Ctrl+S pour enregistrer.
5. **Voir les différences** montre les lignes modifiées ; **Restaurer l'original** remet les fichiers
   tels qu'ils étaient avant le premier enregistrement ; l'onglet **Sauvegardes** permet de revenir à
   n'importe quel enregistrement. Chaque restauration sauvegarde d'abord l'état actuel.

Code couleur des champs : jaune = modifié non enregistré, bleu = différent de l'original,
contour orange = avertissement, contour rouge = erreur (l'enregistrement est bloqué).

## Navigateurs

| Navigateur | Mode |
|---|---|
| Chrome, Edge, Opera (Chromium) | Lecture et écriture directes dans le dossier choisi. Le dossier est mémorisé pour la visite suivante. |
| Firefox, Safari | **Mode de repli** : import du dossier, de fichiers `.ini` ou d'un zip ; les fichiers enregistrés sont téléchargés, à recopier vous-même dans `data/`. |

## Mises en garde

- **Serveurs en ligne :** une voiture modifiée ne passe plus les vérifications de fichiers (checksums)
  des serveurs. Réservez ces modifications au jeu hors ligne ou à vos propres serveurs.
- **Licences :** respectez la licence des voitures que vous modifiez (Kunos ou mods tiers) et ne
  redistribuez pas de contenu sans autorisation.
- **Plages de validation :** les plages « habituelles » de `docs/champs.md` sont indicatives et n'ont
  pas encore été vérifiées en jeu.
- Si un `data.acd` est présent **à côté** du dossier `data/`, le jeu lit le `data.acd` : renommez-le.

## Développement

```bash
npm test         # tests unitaires (node --test, sans dépendance)
```

```bash
npm run e2e      # test de bout en bout dans Chromium (nécessite Playwright)
```

```bash
node tools/gen-champs.mjs    # régénère docs/champs.md depuis js/params.js
```

| Fichier | Rôle |
|---|---|
| `js/ini.js` | Parseur INI fidèle (aller-retour identique, `set` ne touche qu'à la valeur). |
| `js/encoding.js` | Détection et réencodage UTF-8 (± BOM) / Windows-1252. |
| `js/fs-access.js` | Dossier via File System Access (`HandleDir`) ou en mémoire (`MemoryDir`), vérification du dossier `data`. |
| `js/backup.js` | Sauvegardes `.acmod_backup/`, restauration. |
| `js/params.js` | Description des paramètres (libellé, unité, plages, aide). |
| `js/tyres.js`, `js/suspension.js`, `js/setup.js` | Modèles de données. |
| `js/validate.js` | Règles de validation (erreur / avertissement, règles croisées). |
| `js/workspace.js` | État d'édition : modifications, validation, enregistrement, restauration (sans DOM). |
| `js/main.js`, `js/ui/` | Interface. |
| `fixtures/` | Dossiers `data` synthétiques pour les tests. |

Voir `PLAN.md` pour l'avancement.

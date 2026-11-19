# Version « bouton » : Power Apps + Power Automate (SharePoint / Teams)

La secrétaire ouvre une **page SharePoint** ou un **onglet Teams** et voit :

- la liste des dossiers EX trouvés (EX01AM… EX25PM, avec le nombre de fichiers) ;
- pour chaque dossier, une **liste déroulante des élèves** (lue dans le fichier Excel) ;
- un bouton **Lancer la copie**, puis une fenêtre de confirmation
  « EX01AM → Tremblay Julie… ».

Rien à installer sur le poste. Aucun droit d'administrateur requis. Tous les
connecteurs utilisés sont **standard** (inclus dans Microsoft 365 Éducation / A1 / A3).

```
 Page SharePoint / onglet Teams
   └─ Application Power Apps
        ├─ au démarrage ──► Flux 1 « Examens - Préparer »  (liste dossiers EX + élèves Excel)
        └─ bouton ────────► Flux 2 « Examens - Copier »    (copie/déplace + renomme)
```

> ⚠️ Ce guide n'a pas pu être testé dans votre locataire Microsoft 365. Faire un
> premier essai avec 2 ou 3 dossiers EX fictifs.

---

## 0. Préparation

1. **Liste des élèves** : le fichier Excel doit se trouver dans SharePoint
   (par ex. dans les fichiers de l'équipe). Sélectionner les données →
   **Insérer → Tableau** (cocher « Mon tableau comporte des en-têtes »), puis
   **Création de tableau → Nom du tableau : `Eleves`**. Colonnes attendues : `Nom`, `Prénom`.
2. **Adresses** : dans Teams → onglet Fichiers → **Ouvrir dans SharePoint**. Noter :
   - l'adresse du site, ex. `https://monecole.sharepoint.com/sites/Equipe-Examens` ;
   - le chemin du dossier qui contient les EX, ex. `Shared Documents/General`
     (« Documents » s'appelle `Shared Documents` dans les adresses) ;
   - le chemin de « Correction », ex. `Shared Documents/General/Correction`.

Dans la suite : `SITE` = adresse du site, `DOSSIER_EX` = chemin des EX,
`DOSSIER_CORR` = chemin de Correction.

---

## 1. Flux 1 — « Examens - Préparer »

[make.powerautomate.com](https://make.powerautomate.com) → **Créer → Flux de cloud instantané** →
déclencheur **Lorsque Power Apps appelle un flux (V2)** (aucune entrée).

| # | Action | Réglages |
|---|---|---|
| 1 | **Initialiser une variable** | Nom `examens`, Type *Tableau*, Valeur `[]` |
| 2 | SharePoint – **Lister le dossier** | Site `SITE`, Identificateur de fichier : choisir `DOSSIER_EX` |
| 3 | **Filtrer un tableau** | De : *body* de l'étape 2. *Modifier en mode avancé* et coller l'expression ci-dessous |
| 4 | **Appliquer à chacun** (sur *body* de l'étape 3) contenant : | |
| 4a | SharePoint – **Lister le dossier** | Identificateur : expression `items('Appliquer_à_chacun')?['Id']` |
| 4b | **Ajouter à une variable de tableau** | `examens`, valeur : voir ci-dessous |
| 5 | Excel Online (Business) – **Lister les lignes présentes dans un tableau** | Emplacement `SITE`, bibliothèque, fichier de la liste, tableau `Eleves` |
| 6 | **Sélectionner** | De : *value* de l'étape 5. Cliquer l'icône « mode texte » et mettre l'expression ci-dessous |
| 7 | **Composer** | voir ci-dessous |
| 8 | **Répondre à une application ou un flux Power App** | Sortie *Texte* nommée `donnees` = `string(outputs('Composer'))` |

**Étape 3 – filtre (mode avancé) :**
```
@and(item()?['IsFolder'], equals(length(item()?['Name']), 6), startsWith(toUpper(item()?['Name']), 'EX'), or(endsWith(toUpper(item()?['Name']), 'AM'), endsWith(toUpper(item()?['Name']), 'PM')))
```

**Étape 4b – valeur :**
```json
{ "code": "@{toUpper(items('Appliquer_à_chacun')?['Name'])}", "fichiers": @{length(body('Lister_le_dossier_2'))} }
```

**Étape 6 – Sélectionner (mode texte) :**
```
trim(concat(item()?['Nom'], ' ', item()?['Prénom']))
```

**Étape 7 – Composer :**
```json
{ "examens": @{variables('examens')}, "eleves": @{body('Sélectionner')} }
```

> Les noms entre `'…'` (`Appliquer_à_chacun`, `Lister_le_dossier_2`, `Sélectionner`,
> `Composer`) doivent correspondre aux noms réels des actions (espaces → `_`).
> Le plus sûr : insérer via **Contenu dynamique**.

---

## 2. Flux 2 — « Examens - Copier »

Déclencheur **Lorsque Power Apps appelle un flux (V2)** avec deux entrées :
- *Texte* `affectations`
- *Oui/Non* `deplacer`

| # | Action | Réglages |
|---|---|---|
| 1 | **Initialiser une variable** | `resume`, *Chaîne*, vide |
| 2 | **Analyser JSON** | Contenu : `affectations`. Schéma ci-dessous |
| 3 | **Appliquer à chacun** (sur *body* de l'étape 2). Paramètres → Contrôle d'accès concurrentiel **désactivé** (un à la fois) | |
| 3a | **Composer** (renommer `NomDossier`) | expression ci-dessous (retire les caractères interdits) |
| 3b | **Étendue** (renommer `Essai`) contenant 3c et 3d | |
| 3c | SharePoint – **Envoyer une requête HTTP à SharePoint** | voir ci-dessous |
| 3d | **Condition** `deplacer` est égal à `true` → *Si oui* : SharePoint – **Créer un dossier** dans la bibliothèque, chemin `General/@{items('Appliquer_à_chacun')?['Code']}` (recrée le dossier EX vide pour le prochain examen) | |
| 3e | **Ajouter à une variable chaîne** `resume` : `✔ @{items('Appliquer_à_chacun')?['Code']} → @{outputs('NomDossier')}` + saut de ligne | *Configurer l'exécution après* : `Essai` **a réussi** |
| 3f | **Ajouter à une variable chaîne** `resume` : `✖ @{items('Appliquer_à_chacun')?['Code']} : erreur` + saut de ligne | *Configurer l'exécution après* : `Essai` **a échoué** |
| 4 | **Répondre à une application ou un flux Power App** | Sortie *Texte* `resume` = variable `resume` |

**Étape 2 – schéma :**
```json
{ "type": "array", "items": { "type": "object",
  "properties": { "Code": { "type": "string" }, "Eleve": { "type": "string" } } } }
```

**Étape 3a – nom de dossier valide :**
```
trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(items('Appliquer_à_chacun')?['Eleve'], '\', ' '), '/', ' '), ':', ' '), '*', ' '), '?', ' '), '"', ' '), '<', ' '), '>', ' '), '|', ' '))
```

**Étape 3c – requête HTTP** (copie le dossier ET le renomme en une seule opération) :

- Adresse du site : `SITE`
- Méthode : `POST`
- URI :
  ```
  _api/SP.MoveCopyUtil.@{if(triggerBody()?['boolean'], 'MoveFolderByPath', 'CopyFolderByPath')}
  ```
  (remplacer `triggerBody()?['boolean']` par le contenu dynamique `deplacer` si le nom diffère)
- En-têtes :
  ```
  Accept        application/json;odata=nometadata
  Content-Type  application/json;odata=nometadata
  ```
- Corps :
  ```json
  {
    "srcPath":  { "DecodedUrl": "SITE/DOSSIER_EX/@{items('Appliquer_à_chacun')?['Code']}" },
    "destPath": { "DecodedUrl": "SITE/DOSSIER_CORR/@{outputs('NomDossier')}" },
    "options":  { "KeepBoth": true, "ResetAuthorAndCreatedOnCopy": false, "ShouldBypassSharedLocks": true }
  }
  ```
  Exemple réel : `https://monecole.sharepoint.com/sites/Equipe-Examens/Shared Documents/General/EX01AM`.

`KeepBoth: true` : si `Correction/Tremblay Julie` existe déjà, SharePoint crée
`Tremblay Julie 1` au lieu d'écraser.

---

## 3. Application Power Apps

[make.powerapps.com](https://make.powerapps.com) → **Créer → Application canevas vide** (format tablette).
Volet **Power Automate** (icône ⚡) → **Ajouter un flux** → ajouter les deux flux.

### Écran — propriété `OnVisible`
```powerfx
Set(varChargement, true);
Set(varData, ParseJSON('Examens-Préparer'.Run().donnees));
ClearCollect(colEleves,
    Sort(ForAll(Table(varData.eleves), {Nom: Text(ThisRecord.Value)}), Nom));
ClearCollect(colExamens,
    SortByColumns(
        Filter(
            ForAll(Table(varData.examens), {
                Code: Text(ThisRecord.Value.code),
                Fichiers: Value(ThisRecord.Value.fichiers),
                Eleve: ""
            }),
            Fichiers > 0),
        Code));
Set(varChargement, false);
Set(varConfirmer, false);
Set(varResume, "")
```
(Le tri par `Code` donne EX01AM, EX01PM, EX02AM… Pour avoir tous les AM puis tous les PM,
ajouter une colonne `Tri: Right(Text(ThisRecord.Value.code),2) & Mid(Text(ThisRecord.Value.code),3,2)`
et trier sur `Tri`.)

### Galerie verticale `galExamens`
- `Items` : `colExamens`
- Dans le modèle :
  - Étiquette : `ThisItem.Code & "  (" & ThisItem.Fichiers & " fichiers)"`
  - Zone de liste déroulante `cbEleve` :
    - `Items` : `colEleves`
    - `DisplayFields` / `SearchFields` : `["Nom"]`
    - `SelectMultiple` : `false` ; `IsSearchable` : `true`
    - `OnChange` : `Patch(colExamens, ThisItem, {Eleve: cbEleve.Selected.Nom})`
  - Étiquette d'alerte (texte rouge) :
    - `Text` : `"Élève choisi plus d'une fois !"`
    - `Visible` : `!IsBlank(ThisItem.Eleve) && CountIf(colExamens, Eleve = ThisItem.Eleve) > 1`

### Interrupteur `tglDeplacer`
Libellé « Déplacer (vider les dossiers EX) », `Default` : `false`.

### Bouton « Lancer la copie » — `OnSelect`
```powerfx
With({choix: Filter(colExamens, !IsBlank(Eleve))},
    If(
        CountRows(choix) = 0,
            Notify("Aucun élève n'a été associé.", NotificationType.Warning),
        CountRows(choix) <> CountRows(Distinct(choix, Eleve)),
            Notify("Un élève est associé à plus d'un examen.", NotificationType.Error),
        Set(varConfirmer, true)
    ))
```

### Fenêtre de confirmation
Un rectangle semi-transparent + une étiquette + deux boutons, tous avec
`Visible` : `varConfirmer`.

- Étiquette `Text` :
  ```powerfx
  "Confirmer (" & If(tglDeplacer.Value, "DÉPLACER", "COPIER") & " vers Correction) :" & Char(10) & Char(10) &
  Concat(Filter(colExamens, !IsBlank(Eleve)), Code & "  →  " & Eleve, Char(10))
  ```
- Bouton **Confirmer** `OnSelect` :
  ```powerfx
  Set(varConfirmer, false);
  Set(varChargement, true);
  Set(varResume,
      'Examens-Copier'.Run(
          JSON(ShowColumns(Filter(colExamens, !IsBlank(Eleve)), Code, Eleve)),
          tglDeplacer.Value
      ).resume);
  Set(varChargement, false);
  Notify("Terminé.", NotificationType.Success)
  ```
- Bouton **Annuler** `OnSelect` : `Set(varConfirmer, false)`

### Résultat
Étiquette `Text` : `varResume`. Indicateur « En cours… » : `Visible` : `varChargement`.

**Enregistrer → Publier → Partager** l'application avec la secrétaire (et les collègues voulus).
Elle doit avoir accès en modification au site de l'équipe.

---

## 4. Mettre le bouton dans SharePoint ou Teams

- **Page SharePoint** : sur le site de l'équipe → **Nouveau → Page** →
  ➕ → composant **Power Apps** → coller le lien de l'application
  (Power Apps → ⋯ → Détails → *Lien web*) → **Publier**.
- **Onglet Teams** : dans le canal → **+** → **Power Apps** → choisir l'application.
  (Ou ajouter la page SharePoint ci-dessus en onglet **SharePoint**.)

---

## Bon à savoir

- **Connexions** : les flux appelés depuis Power Apps s'exécutent avec les
  connexions de leur créateur. La copie se fait donc avec les droits du créateur des flux.
- **Historique** : chaque exécution est consultable dans Power Automate → *Mes flux* →
  flux → *Historique* (qui a copié quoi, quand).
- **Limites** : le flux 1 vérifie chaque dossier EX (environ 50 appels) ; compter
  quelques secondes au chargement.
- **Alternative sans Power Apps** : flux déclenché depuis Teams (application
  *Workflows*) qui envoie à la secrétaire une carte adaptative par dossier EX
  (« Publier une carte adaptative et attendre une réponse ») avec la liste des
  élèves. Ça fonctionne, mais il faut répondre à environ 50 cartes une par une.
- **Alternative « développeur »** : composant SPFx déployé dans le catalogue
  d'applications du locataire. Ça demande l'intervention du service informatique.

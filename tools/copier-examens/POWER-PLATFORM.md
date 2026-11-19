# Salle d'évaluation : version Microsoft 365 (SharePoint + Power Apps + Power Automate)

Cette version remplace **le document Word « Tableau salle d'examen »**
(SALLE D'ÉVALUATION · MERCREDI PM · 18 NOVEMBRE 2026, postes 1 à 20 → élève,
liste des compétences) **et** la copie manuelle des dossiers EX.

## Principe

Le numéro de poste sur la feuille de salle **est** le code d'examen :
poste 7 en après-midi = compte et dossier **EX07PM**. Dès que la secrétaire remplit
la feuille de salle dans l'application, on sait à quel élève et à quelle compétence
correspond chaque dossier EX. Il n'y a plus rien à demander au moment de la copie.

```
 Onglet Teams / page SharePoint (personnel seulement)
   └─ Application « Salle d'évaluation »
        ├─ Écran Feuille de salle : date + AM/PM → postes 1 à 25 : élève + compétence + absent
        │      (enregistré dans la liste SharePoint « Passations »)
        ├─ Bouton Imprimer : remplace le document Word
        └─ Bouton Envoyer en correction ──► Flux « Examens - Envoyer en correction »
                 pour chaque passation de la séance (présent, statut Planifié) :
                 General/ex07pm  ──copie──►  General/Correction/<Compétence>/<Nom, Prénom>
                 (option) vide ex07pm (corbeille SharePoint), statut → « En correction »
```

Avantages par rapport au Word :
- historique de toutes les séances (qui a passé quoi, quand, sur quel poste) ;
- les enseignants voient **leurs copies à corriger** (vue « À corriger » groupée par compétence)
  et marquent « Corrigé » ;
- un élève placé sur deux postes ou un poste sans compétence est bloqué à l'enregistrement ;
- plus aucune erreur de recopie entre la feuille de salle et les dossiers.

Tous les connecteurs sont **standard** (inclus dans Microsoft 365 Éducation).
Aucun droit d'administrateur requis.

> 🔒 **Confidentialité (anonymat, Loi 25).** Les comptes EX01AM… EX25PM ne sont **pas**
> membres de l'équipe. Chacun n'a accès qu'à **son** dossier (autorisation directe sur
> `ex01am`, etc.). Les listes peuvent donc être créées dans le site de « RAVE-Salle d'examen ».
> Elles hériteront des accès Propriétaires, Membres et Visiteurs, sans les comptes EX.
> Vérifier quand même qu'aucun compte EX n'est dans le groupe **Visiteurs** du site.

> ⚠️ Guide non testé dans votre locataire : faire un premier essai avec une séance
> fictive et 2 ou 3 dossiers EX de test.

---

## 1. Les trois listes SharePoint (site du personnel)

Site → **Nouveau → Liste**.

### `Eleves`
| Colonne | Type | Note |
|---|---|---|
| Titre | (existante) | « Nom, Prénom » (ex. `Tremblay, Julie`) |
| NumeroFiche | Texte | facultatif |
| Groupe | Texte | facultatif |
| Actif | Oui/Non | défaut Oui (décocher les finissants) |

Création rapide : **Nouveau → Liste → À partir d'Excel**, avec la liste Excel actuelle
(prévoir une colonne « Nom, Prénom » : formule Excel `=A2&", "&B2`).

### `Competences`
| Colonne | Type | Note |
|---|---|---|
| Titre | (existante) | ex. `1-460-596 Opérations comptables` |
| Enseignant | Personne | facultatif : qui corrige |
| Actif | Oui/Non | défaut Oui |

Données de départ (tirées du document actuel) :
```
1-460-596 Opérations comptables
1-461-213 Système comptable
1-460-554 Gestion documentaire
1-460-644 Conception tableaux et graphiques
2-461-122 Production de paies
1-461-175 Coût d'un bien et d'un service
1-461-083 Gestion de l'encaisse
1-461-093 Législation des affaires
```

### `Passations` (une ligne = un élève sur un poste pour une séance)
| Colonne | Type | Note |
|---|---|---|
| Titre | (existante) | code EX, ex. `EX07PM` (rempli par l'appli) |
| Seance | Texte | ex. `2026-11-18 PM` (rempli par l'appli). **Colonne indexée** (Paramètres de la liste → Colonnes indexées) |
| DateExamen | Date | |
| Periode | Choix : `AM`, `PM` | |
| Poste | Nombre | 1 à 25 |
| EleveNom | Texte | |
| Competence | Texte | |
| Absent | Oui/Non | défaut Non |
| Statut | Choix : `Planifié` (défaut), `En correction`, `Corrigé` | |
| LienCorrection | Lien hypertexte | rempli par le flux |

Vues utiles :
- **À corriger** : filtre Statut = En correction, regrouper par Competence.
- **Par séance** : regrouper par Seance, trier par Poste.

---

## 2. Flux « Examens - Envoyer en correction »

[make.powerautomate.com](https://make.powerautomate.com) → **Créer → Flux de cloud instantané** →
**Lorsque Power Apps appelle un flux (V2)**, entrées :
- *Texte* `seance`
- *Oui/Non* `deplacer`

Valeurs utilisées ci-dessous (à adapter, voir « Ouvrir dans SharePoint » depuis Teams) :
- `SITE_EXAMEN` = `https://<école>.sharepoint.com/sites/RAVE-Salledexamen`
- `REL_EXAMEN` = `/sites/RAVE-Salledexamen` (même chose sans le domaine)
- les dossiers EX sont dans `Shared Documents/General/` (« Documents » = `Shared Documents` dans les adresses)

| # | Action | Réglages |
|---|---|---|
| 1 | **Initialiser une variable** | `resume`, *Chaîne*, vide |
| 2 | SharePoint – **Obtenir les éléments** | Site du personnel, liste `Passations`. Requête de filtre ci-dessous |
| 3 | **Appliquer à chacun** sur *value* de l'étape 2 (Paramètres : contrôle d'accès concurrentiel **désactivé**) | |
| 3a | **Composer** renommé `NomEleve` | expression *nettoyer* appliquée à `EleveNom` (ci-dessous) |
| 3b | **Composer** renommé `NomCompetence` | expression *nettoyer* appliquée à `Competence` |
| 3c | **Étendue** renommée `Essai`, contenant 3d → 3g | |
| 3d | SharePoint – **Créer un dossier** | Site `SITE_EXAMEN`, bibliothèque Documents, chemin `General/Correction/@{outputs('NomCompetence')}` |
| 3e | SharePoint – **Envoyer une requête HTTP à SharePoint** (copie + renommage) | voir « Copie » |
| 3f | **Condition** `deplacer` = `true` → *Si oui* : « Vider le dossier EX » (voir plus bas) | |
| 3g | SharePoint – **Mettre à jour l'élément** | liste `Passations`, ID = `ID` de l'élément, Statut = `En correction`, LienCorrection = `SITE_EXAMEN/Shared Documents/General/Correction/@{outputs('NomCompetence')}/@{outputs('NomEleve')}` |
| 3h | **Ajouter à une variable chaîne** `resume` | `✔ @{items('Appliquer_à_chacun')?['Title']} → @{outputs('NomEleve')}` + saut de ligne · *Configurer l'exécution après* : `Essai` **a réussi** |
| 3i | **Ajouter à une variable chaîne** `resume` | `✖ @{items('Appliquer_à_chacun')?['Title']} (@{items('Appliquer_à_chacun')?['EleveNom']}) : erreur` + saut de ligne · *exécution après* : `Essai` **a échoué** |
| 4 | **Répondre à une application ou un flux Power App** | Sortie *Texte* `resume` = variable `resume` |

**Étape 2 – requête de filtre :**
```
Seance eq '@{triggerBody()?['text']}' and Absent eq 0 and Statut eq 'Planifié'
```
(insérer `seance` par **Contenu dynamique** à la place de `triggerBody()?['text']`)

**Expression *nettoyer*** (retire les caractères interdits dans un nom de dossier ;
remplacer `X` par `items('Appliquer_à_chacun')?['EleveNom']` ou `?['Competence']`) :
```
trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(X, '\', ' '), '/', ' '), ':', ' '), '*', ' '), '?', ' '), '"', ' '), '<', ' '), '>', ' '), '|', ' '))
```

**Copie (étape 3e)** :
- Site : `SITE_EXAMEN` · Méthode : `POST` · URI : `_api/SP.MoveCopyUtil.CopyFolderByPath`
- En-têtes : `Accept` = `application/json;odata=nometadata` · `Content-Type` = `application/json;odata=nometadata`
- Corps :
  ```json
  {
    "srcPath":  { "DecodedUrl": "SITE_EXAMEN/Shared Documents/General/@{toLower(items('Appliquer_à_chacun')?['Title'])}" },
    "destPath": { "DecodedUrl": "SITE_EXAMEN/Shared Documents/General/Correction/@{outputs('NomCompetence')}/@{outputs('NomEleve')}" },
    "options":  { "KeepBoth": true, "ResetAuthorAndCreatedOnCopy": false, "ShouldBypassSharedLocks": true }
  }
  ```
  `KeepBoth` : en cas de reprise (même élève, même compétence), SharePoint crée
  `Tremblay, Julie 1` au lieu d'écraser.

**Vider le dossier EX (mode « déplacer »)**. Le dossier `ex07pm` est **conservé** avec
ses autorisations (celles du compte EX07PM) et sa colonne AM/PM. Seul son contenu part à la
**corbeille SharePoint**, donc récupérable pendant 93 jours.
1. **Envoyer une requête HTTP à SharePoint** (renommer `ContenuEX`) – `GET` –
   `_api/web/GetFolderByServerRelativePath(decodedurl='REL_EXAMEN/Shared Documents/General/@{toLower(items('Appliquer_à_chacun')?['Title'])}')?$expand=Files,Folders`
   (en-tête `Accept` = `application/json;odata=nometadata`)
2. **Appliquer à chacun** sur `body('ContenuEX')?['Files']` → requête HTTP `POST`
   `_api/web/GetFileByServerRelativePath(decodedurl='@{replace(items('Appliquer_à_chacun_2')?['ServerRelativeUrl'], '''', '''''')}')/recycle()`
3. **Appliquer à chacun** sur `body('ContenuEX')?['Folders']` → requête HTTP `POST`
   `_api/web/GetFolderByServerRelativePath(decodedurl='@{replace(items('Appliquer_à_chacun_3')?['ServerRelativeUrl'], '''', '''''')}')/recycle()`

> Les noms entre `'…'` (`Appliquer_à_chacun`, `ContenuEX`…) doivent correspondre aux
> noms réels des actions (espaces → `_`). Le plus sûr : passer par **Contenu dynamique**.

*Option :* ajouter **Publier un message dans une conversation ou un canal** (Teams)
pour prévenir l'enseignant de la compétence que des copies l'attendent.

---

## 3. Application « Salle d'évaluation » (Power Apps)

[make.powerapps.com](https://make.powerapps.com) → **Application canevas vide** (format tablette).
**Données** : ajouter les listes `Eleves`, `Competences`, `Passations`.
**Power Automate** (⚡) : ajouter le flux « Examens - Envoyer en correction ».

### App — `OnStart`
```powerfx
Set(varNbPostes, 25)
```

### Écran `scrSalle`

**En-tête**
- Sélecteur de date `dpDate` : `DefaultDate` = `Today()` ; `OnChange` = `Select(btnCharger)`
- Liste déroulante `ddPeriode` : `Items` = `["AM", "PM"]` ; `Default` = `If(Hour(Now()) < 12, "AM", "PM")` ; `OnChange` = `Select(btnCharger)`
- Bouton masqué `btnCharger` (`Visible` = `false`), `OnSelect` :
  ```powerfx
  Set(varSeance, Text(dpDate.SelectedDate, "yyyy-mm-dd") & " " & ddPeriode.Selected.Value);
  ClearCollect(colSeance, Filter(Passations, Seance = varSeance))
  ```
- Écran `OnVisible` : `Select(btnCharger); Set(varConfirmer, false); Set(varResume, "")`

**Galerie verticale `galPostes`** (une ligne par poste) — `Items` = `Sequence(varNbPostes)`
- Étiquette `lblCode` : `Text(ThisItem.Value) & ".   EX" & Text(ThisItem.Value, "00") & ddPeriode.Selected.Value`
- Zone de liste déroulante `cbEleve`
  - `Items` : `Sort(Filter(Eleves, Actif = true), Title)`
  - `DisplayFields` / `SearchFields` : `["Title"]` ; `SelectMultiple` : `false` ; `IsSearchable` : `true`
  - `DefaultSelectedItems` : `Filter(Eleves, Title = LookUp(colSeance, Poste = ThisItem.Value).EleveNom)`
  - `DisplayMode` : `If(LookUp(colSeance, Poste = ThisItem.Value).Statut.Value in ["En correction", "Corrigé"], DisplayMode.View, DisplayMode.Edit)`
- Zone de liste déroulante `cbComp` : même chose avec `Competences` et `.Competence`
- Case à cocher `chkAbsent` (texte « Absent ») : `Default` = `LookUp(colSeance, Poste = ThisItem.Value).Absent`
- Étiquette statut : `Coalesce(LookUp(colSeance, Poste = ThisItem.Value).Statut.Value, "")`

**Bouton « Enregistrer la feuille »** `btnEnregistrer` — `OnSelect` :
```powerfx
With({lignes: ForAll(galPostes.AllItems As r, {
        Poste: r.Value,
        Nom: r.cbEleve.Selected.Title,
        Comp: r.cbComp.Selected.Title,
        Absent: r.chkAbsent.Value})},
  With({remplies: Filter(lignes, !IsBlank(Nom))},
    If(
      CountRows(remplies) <> CountRows(Distinct(remplies, Nom)),
        Notify("Un élève est placé sur plus d'un poste.", NotificationType.Error),
      CountRows(Filter(remplies, IsBlank(Comp))) > 0,
        Notify("Choisir la compétence de chaque élève.", NotificationType.Warning),
      // sinon : enregistrer
      ForAll(lignes As l,
        With({ex: LookUp(colSeance, Poste = l.Poste)},
          If(IsBlank(l.Nom),
            If(!IsBlank(ex) && ex.Statut.Value = "Planifié",
               Remove(Passations, LookUp(Passations, ID = ex.ID))),
            Patch(Passations,
              If(IsBlank(ex), Defaults(Passations), LookUp(Passations, ID = ex.ID)),
              {
                Title: "EX" & Text(l.Poste, "00") & ddPeriode.Selected.Value,
                Seance: varSeance,
                DateExamen: dpDate.SelectedDate,
                Periode: {Value: ddPeriode.Selected.Value},
                Poste: l.Poste,
                EleveNom: l.Nom,
                Competence: l.Comp,
                Absent: l.Absent
              })
          )));
      Select(btnCharger);
      Notify("Feuille de salle enregistrée.", NotificationType.Success)
    )))
```

**Bouton « Imprimer la feuille »** : `Navigate(scrImpression)`

**Interrupteur `tglDeplacer`** : « Vider les dossiers EX après la copie » (`Default` = `true`,
pour que les postes soient prêts pour la séance suivante).

**Bouton « Envoyer en correction »** — `OnSelect` : `Select(btnEnregistrer); Set(varConfirmer, true)`

**Fenêtre de confirmation** (rectangle + étiquette + 2 boutons, `Visible` = `varConfirmer`)
- Étiquette :
  ```powerfx
  "Envoyer en correction — séance " & varSeance & " :" & Char(10) & Char(10) &
  Concat(SortByColumns(Filter(colSeance, !Absent && Statut.Value = "Planifié"), Poste),
         Title & "  →  " & EleveNom & "   (" & Competence & ")", Char(10)) &
  If(tglDeplacer.Value, Char(10) & Char(10) & "Les dossiers EX seront vidés (corbeille SharePoint).", "")
  ```
- **Confirmer** :
  ```powerfx
  Set(varConfirmer, false);
  Set(varEnCours, true);
  Set(varResume, 'Examens-EnvoyerenCorrection'.Run(varSeance, tglDeplacer.Value).resume);
  Set(varEnCours, false);
  Select(btnCharger);
  Notify("Envoi terminé.", NotificationType.Success)
  ```
  (le nom exact du flux s'affiche dans la saisie semi-automatique)
- **Annuler** : `Set(varConfirmer, false)`
- Étiquette résultat : `varResume` ; indicateur « En cours… » : `Visible` = `varEnCours`

### Écran `scrImpression` (remplace le Word)
- Image : logo de l'établissement (Médias → Ajouter)
- Étiquette titre :
  ```powerfx
  "SALLE D'ÉVALUATION" & Char(10) &
  Upper(Text(dpDate.SelectedDate, "dddd", "fr-CA")) & " " & ddPeriode.Selected.Value & Char(10) &
  Upper(Text(dpDate.SelectedDate, "d mmmm yyyy", "fr-CA"))
  ```
- Galerie (texte seulement), `Items` : `SortByColumns(colSeance, Poste)`. Étiquette :
  `ThisItem.Poste & ".  " & ThisItem.EleveNom & "  —  " & ThisItem.Competence & If(ThisItem.Absent, "  (absent)", "")`
- Étiquette « Compétences évaluées » :
  `Concat(Distinct(colSeance, Competence), Value, Char(10))`
- Bouton **Imprimer** : `Print()` ; bouton **Retour** : `Back()`

**Enregistrer → Publier → Partager** avec la secrétaire et les enseignants
(ils doivent avoir accès au site du personnel et au site de la salle d'examen).

---

## 4. Le bouton dans Teams ou SharePoint

- **Onglet Teams** (dans l'équipe du personnel) : **+** → **Power Apps** → « Salle d'évaluation ».
- **Page SharePoint** : Nouveau → Page → ➕ → composant **Power Apps** → lien de l'application.

## 4 bis. Autorisations : état actuel et effet du flux

| Élément | Accès constatés |
|---|---|
| `ex01am` (et autres EX) | **autorisations propres** : le compte EX01AM (Personnes · 1), Propriétaires, Visiteurs (consultation) |
| `Correction` | Propriétaires, **Membres** (consultation), **Rave-examen-ACI** = enseignants du secteur (consultation) |

Effet du flux sur ces autorisations :
- **Le dossier EX n'est jamais déplacé.** Le flux *copie* puis vide le contenu (corbeille).
  `ex01am` garde donc son autorisation pour le compte EX01AM et reste prêt pour la séance
  suivante. Ne **pas** remplacer la copie par `MoveFolderByPath`.
- **La copie dans Correction hérite des accès de Correction.** Le compte EX01AM **n'y a pas
  accès**, et les enseignants ACI voient les copies nominatives. À vérifier au premier test :
  Gérer l'accès sur `Correction/<Compétence>/<Nom, Prénom>` ne doit montrer aucune
  « Personnes » (aucun compte EX).
- **Écriture dans Correction** : seuls les propriétaires peuvent y écrire. Le flux doit
  donc être **créé par un propriétaire** de l'équipe, puisqu'il s'exécute avec ses droits.
  La secrétaire peut rester membre en consultation : c'est le flux qui copie.
- **Annotation des copies** : si les enseignants corrigent directement dans les fichiers,
  passer **Rave-examen-ACI** à « Peut modifier » sur `Correction` (Gérer l'accès → Groupes
  → Rave-examen-ACI → Peut modifier). Sinon, ils doivent télécharger les fichiers ou en
  faire une copie.
- **Statut « Corrigé »** dans la liste `Passations` : donner **Modification** à
  Rave-examen-ACI sur la liste (Paramètres de la liste → Autorisations), ou ajouter le
  groupe comme membre du site.

## 5. Mise en route

1. Créer les 3 listes et importer élèves et compétences.
2. Créer le flux, puis l'application ; publier ; ajouter l'onglet.
3. Test : séance fictive (date future), 2 postes, dossiers EX de test → vérifier
   `Correction/<Compétence>/<Nom, Prénom>` et le statut « En correction ».
4. Dans les vrais dossiers EX, faire un premier envoi **sans** « vider les dossiers EX ».

## Bon à savoir

- **Connexions** : le flux appelé depuis l'application s'exécute avec les connexions de son
  créateur. Le créateur doit avoir accès aux deux sites.
- **Historique** : la liste `Passations` garde l'historique de toutes les séances, et
  Power Automate → Historique garde le détail de chaque envoi.
- **Plus de 20 postes** : modifier `varNbPostes` (le flux suit, puisqu'il lit la liste).
- **Reprises** : le même élève et la même compétence lors d'une autre séance donnent un
  dossier `Nom, Prénom 1` dans Correction (rien n'est écrasé).

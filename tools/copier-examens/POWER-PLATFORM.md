# Passations d'examens : liste SharePoint + bouton « Envoyer en correction »

Solution Microsoft 365 pour la salle d'évaluation (formation individualisée).
Rien à installer, aucun droit d'administrateur, connecteurs **standard** seulement.
Elle remplace le document Word « Tableau salle d'examen » et la copie manuelle des dossiers EX.

## Déroulement

| # | Qui | Action | Statut |
|---|---|---|---|
| 1 | Enseignante | Dans la liste **Passations** : **+ Nouveau** → nom, prénom, matière, date, AM/PM | **Demandée** |
| 2 | Secrétaire aux examens | Vue « Demandes à planifier » : choisit le **code EX** (ex. `EX01AM`), dépose l'examen dans `ex01am`, régénère le mot de passe du compte EX01AM | **Planifiée** |
| 3 | Élève | Se connecte au poste avec EX01AM, fait l'examen dans `ex01am` | |
| 4 | Secrétaire | Clique **Envoyer en correction** sur la ligne de l'élève | **À corriger** (automatique) |
| 5 | Flux (automatique) | Copie `ex01am` → `Correction/2026-2027/2026-11-18 AM/Roy, Sophie`, vide `ex01am` (corbeille), avise l'enseignante dans Teams | |
| 6 | Enseignante | Corrige, puis met le statut à **Corrigée** | **Corrigée** |

Structure produite dans « Correction » :
```
Correction/
└── 2026-2027/                 ← année scolaire (bascule le 1er juillet)
    ├── 2026-11-18 AM/
    │   ├── Gagnon, Marc/
    │   └── Tremblay, Julie/
    └── 2026-11-18 PM/
        └── Roy, Sophie/
```

Restent **manuels** (comme aujourd'hui) : choisir et déposer l'examen dans le dossier EX, et
régénérer le mot de passe du compte EX. Ce dernier point demande des droits d'administrateur
Microsoft 365 (Entra ID).

> ⚠️ Guide non testé dans votre locataire : faire d'abord un essai avec `ex24pm` / `ex25pm`
> et des fichiers bidon.

---

## 1. Liste `Passations` (site RAVE-Salle d'examen)

Teams → l'équipe → Fichiers → ⋯ → **Ouvrir dans SharePoint** → **+ Nouveau → Liste → Liste vide**
→ nom **`Passations`**.

Colonnes (noms **exacts**, sans accent : le flux s'en sert) :

| Nom | Type | Réglages | Rempli par |
|---|---|---|---|
| Titre | (existante) | **renommer en « Nom »** (le nom interne reste `Title`) · obligatoire | enseignante |
| `Prenom` | Une ligne de texte | obligatoire | enseignante |
| `Matiere` | Une ligne de texte | obligatoire | enseignante |
| `DateExamen` | Date et heure | **sans l'heure** · obligatoire | enseignante |
| `Periode` | Choix | `AM`, `PM` · obligatoire | enseignante |
| `Remarques` | Plusieurs lignes de texte | mesures d'adaptation, durée… | enseignante |
| `CodeEX` | Choix | `EX01AM` … `EX25AM`, `EX01PM` … `EX25PM` (coller la liste ci-dessous) | secrétaire |
| `Statut` | Choix | `Demandée` (défaut), `Planifiée`, `À corriger`, `Corrigée`, `Annulée` | secrétaire / flux / enseignante |
| `LienCorrection` | Lien hypertexte | | flux |
| `Envoyer` | Une ligne de texte | sert seulement à afficher le bouton (section 3) · masquer dans le formulaire | — |

L'enseignante qui fait la demande est enregistrée automatiquement dans **Créé par**.

Valeurs de `CodeEX`, à coller dans la zone des choix :
```
EX01AM
EX02AM
EX03AM
EX04AM
EX05AM
EX06AM
EX07AM
EX08AM
EX09AM
EX10AM
EX11AM
EX12AM
EX13AM
EX14AM
EX15AM
EX16AM
EX17AM
EX18AM
EX19AM
EX20AM
EX21AM
EX22AM
EX23AM
EX24AM
EX25AM
EX01PM
EX02PM
EX03PM
EX04PM
EX05PM
EX06PM
EX07PM
EX08PM
EX09PM
EX10PM
EX11PM
EX12PM
EX13PM
EX14PM
EX15PM
EX16PM
EX17PM
EX18PM
EX19PM
EX20PM
EX21PM
EX22PM
EX23PM
EX24PM
EX25PM
```

**Validation** (facultatif, empêche un code AM sur une séance PM) : ⚙️ → Paramètres de la liste →
**Validation** → formule :
```
=OR(ISBLANK([CodeEX]),RIGHT([CodeEX],2)=[Periode])
```
Message : « Le code EX doit correspondre à la période (AM/PM). »

**Formulaire enseignante** : dans un nouvel élément → ✏️ **Modifier le formulaire** → décocher
`CodeEX`, `Statut`, `LienCorrection` et `Envoyer`. La secrétaire modifie ces champs dans la vue
de la liste (mode **Modifier dans la vue Grille**).

### Vues

| Vue | Filtre | Tri / regroupement | Pour |
|---|---|---|---|
| **Demandes à planifier** | Statut = Demandée | tri DateExamen | secrétaire |
| **Feuille de salle** | Statut = Planifiée | regrouper DateExamen puis Periode, tri CodeEX | secrétaire (remplace le Word, imprimable) |
| **À corriger** | Statut = À corriger | tri DateExamen | enseignantes |
| **Mes demandes** | Créé par = `[Moi]` | tri DateExamen décroissant | enseignante |

Colonnes conseillées pour « Feuille de salle » : CodeEX, Nom, Prenom, Matiere, Remarques, Envoyer.

### Autorisations de la liste
La liste hérite des accès du site : Propriétaires, Membres, Visiteurs. Les comptes EX n'y ont
pas accès.
- **Enseignantes (Rave-examen-ACI)** : elles doivent pouvoir créer des éléments.
  ⚙️ → Paramètres de la liste → **Autorisations pour cette liste** → *Arrêter l'héritage* →
  **Accorder des autorisations** → `Rave-examen-ACI` → **Modification**.
- Vérifier que le groupe **Visiteurs** ne contient aucun compte EX.

---

## 2. Flux « Envoyer en correction »

À créer par **un propriétaire de l'équipe**. Seuls les propriétaires peuvent écrire dans
« Correction », et le flux s'exécute avec ses connexions.

Depuis la liste : **Intégrer → Power Automate → Créer un flux**, ou
[make.powerautomate.com](https://make.powerautomate.com) → **Créer → Flux de cloud instantané** →
déclencheur SharePoint **Pour un élément sélectionné**
(site RAVE-Salle d'examen, liste `Passations`).
- Ajouter une entrée **Oui/Non** `Vider le dossier EX` (la secrétaire la voit au moment du clic).

Valeurs à adapter :
- `SITE` = `https://<école>.sharepoint.com/sites/RAVE-Salledexamen`
- `REL` = `/sites/RAVE-Salledexamen`
- dossiers : `Shared Documents/General/ex01am` et `Shared Documents/General/Correction`

### Actions

| # | Action | Réglages |
|---|---|---|
| 1 | SharePoint – **Obtenir l'élément** | liste `Passations`, Id = **ID** (déclencheur) |
| 2 | **Condition** | `Statut` (valeur) est égal à `Planifiée` **et** `CodeEX` (valeur) n'est pas vide. *Si non* : **Terminer** – Échec – « La passation doit être Planifiée et avoir un code EX. » |
| 3 | **Composer** → renommer `DateLocale` | `convertFromUtc(body('Obtenir_l''élément')?['DateExamen'], 'Eastern Standard Time', 'yyyy-MM-dd')` |
| 4 | **Composer** → `AnneeScolaire` | voir ci-dessous |
| 5 | **Composer** → `Seance` | `concat(outputs('DateLocale'), ' ', body('Obtenir_l''élément')?['Periode']?['Value'])` |
| 6 | **Composer** → `NomEleve` | voir ci-dessous |
| 7 | **Composer** → `CodeDossier` | `toLower(body('Obtenir_l''élément')?['CodeEX']?['Value'])` |
| 8 | **Étendue** → `Essai`, contenant 8a à 8e | |
| 8a | SharePoint – **Créer un dossier** | bibliothèque Documents, chemin `General/Correction/@{outputs('AnneeScolaire')}/@{outputs('Seance')}` (crée l'année et la séance au besoin) |
| 8b | SharePoint – **Envoyer une requête HTTP à SharePoint** → `Copie` | voir « Copie » |
| 8c | **Condition** `Vider le dossier EX` = `true` → *Si oui* : « Vider le dossier EX » (voir plus bas) | |
| 8d | SharePoint – **Mettre à jour l'élément** | Id = ID ; Statut = `À corriger` ; LienCorrection = `SITE/Shared Documents/General/Correction/@{outputs('AnneeScolaire')}/@{outputs('Seance')}/@{outputs('NomEleve')}` ; remettre Nom, Prenom, Matiere, DateExamen, Periode depuis l'étape 1 (champs obligatoires) |
| 8e | Teams – **Publier un message dans une conversation ou un canal** | Publier en tant que *Flow bot*, dans *Conversation avec le bot Flow*, destinataire = **Créé par Email** (étape 1). Message : « La copie de @{outputs('NomEleve')} (@{body('Obtenir_l''élément')?['Matiere']}, @{outputs('Seance')}) est prête à corriger : *lien* » |
| 9 | Teams – **Publier un message…** au destinataire = **Adresse e-mail de l'utilisateur** (déclencheur) : « ✖ Échec de l'envoi en correction de @{outputs('NomEleve')} ». *Configurer l'exécution après* : `Essai` **a échoué** | |

> Les noms entre `'…'` (`Obtenir_l''élément`, `DateLocale`…) doivent correspondre aux noms
> réels des actions (espaces → `_`, apostrophe doublée). Le plus sûr : insérer par **Contenu dynamique**.

**4 – AnneeScolaire** (juillet à juin) :
```
if(greaterOrEquals(int(substring(outputs('DateLocale'), 5, 2)), 7),
   concat(substring(outputs('DateLocale'), 0, 4), '-', string(add(int(substring(outputs('DateLocale'), 0, 4)), 1))),
   concat(string(sub(int(substring(outputs('DateLocale'), 0, 4)), 1)), '-', substring(outputs('DateLocale'), 0, 4)))
```
18 novembre 2026 → `2026-2027` ; 15 mars 2027 → `2026-2027`.

**6 – NomEleve** (`Roy, Sophie`, caractères interdits retirés) :
```
trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(
  concat(trim(body('Obtenir_l''élément')?['Title']), ', ', trim(body('Obtenir_l''élément')?['Prenom'])),
  '\', ' '), '/', ' '), ':', ' '), '*', ' '), '?', ' '), '"', ' '), '<', ' '), '>', ' '), '|', ' '))
```
(Power Automate accepte l'expression sur une seule ligne : retirer les sauts de ligne.)

**8b – Copie** :
- Méthode `POST` · URI `_api/SP.MoveCopyUtil.CopyFolderByPath`
- En-têtes : `Accept` = `application/json;odata=nometadata` ; `Content-Type` = `application/json;odata=nometadata`
- Corps :
  ```json
  {
    "srcPath":  { "DecodedUrl": "SITE/Shared Documents/General/@{outputs('CodeDossier')}" },
    "destPath": { "DecodedUrl": "SITE/Shared Documents/General/Correction/@{outputs('AnneeScolaire')}/@{outputs('Seance')}/@{outputs('NomEleve')}" },
    "options":  { "KeepBoth": true, "ResetAuthorAndCreatedOnCopy": false, "ShouldBypassSharedLocks": true }
  }
  ```
  `KeepBoth` : si l'élève passe deux examens dans la même séance, le 2ᵉ dossier s'appelle
  `Roy, Sophie 1`. Rien n'est écrasé.

**8c – Vider le dossier EX**. Le dossier `ex01am` est **conservé** avec son autorisation pour
le compte EX01AM. Seul son contenu part à la **corbeille SharePoint** (récupérable 93 jours).
1. **Envoyer une requête HTTP à SharePoint** → `ContenuEX` – `GET`
   `_api/web/GetFolderByServerRelativePath(decodedurl='REL/Shared Documents/General/@{outputs('CodeDossier')}')?$expand=Files,Folders`
   (en-tête `Accept` = `application/json;odata=nometadata`)
2. **Appliquer à chacun** sur `body('ContenuEX')?['Files']` → requête HTTP `POST`
   `_api/web/GetFileByServerRelativePath(decodedurl='@{replace(item()?['ServerRelativeUrl'], '''', '''''')}')/recycle()`
3. **Appliquer à chacun** sur `body('ContenuEX')?['Folders']` → requête HTTP `POST`
   `_api/web/GetFolderByServerRelativePath(decodedurl='@{replace(item()?['ServerRelativeUrl'], '''', '''''')}')/recycle()`

### Partager le flux avec la secrétaire
Flux → **Utilisateurs en exécution seule → Modifier** → ajouter la secrétaire (ou le groupe
Membres). Pour **SharePoint** et **Microsoft Teams**, choisir **Utiliser cette connexion**,
celle du propriétaire, et **pas** « Fournie par l'utilisateur en exécution seule ». La copie
se fait ainsi avec les droits du propriétaire.

---

## 3. Bouton « Envoyer en correction » sur chaque ligne

1. Copier l'**ID du flux** : Power Automate → ouvrir le flux. L'ID est dans l'adresse, après
   `/flows/` (ex. `3f1c…-…-…`).
2. Liste `Passations` → en-tête de la colonne **Envoyer** → **Paramètres de colonne → Mettre en
   forme cette colonne → Mode avancé** → coller (en remplaçant `ID_DU_FLUX`) :

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "button",
  "customRowAction": {
    "action": "executeFlow",
    "actionParams": "{\"id\": \"ID_DU_FLUX\"}"
  },
  "attributes": { "class": "ms-fontColor-themePrimary ms-fontColor-themeDarker--hover" },
  "style": {
    "display": "=if([$Statut] == 'Planifiée' && [$CodeEX] != '', 'flex', 'none')",
    "border": "none",
    "background-color": "transparent",
    "cursor": "pointer",
    "align-items": "center"
  },
  "children": [
    { "elmType": "span", "attributes": { "iconName": "Send" }, "style": { "padding-right": "6px" } },
    { "elmType": "span", "txtContent": "Envoyer en correction" }
  ]
}
```

Le bouton n'apparaît que sur les lignes **Planifiée** qui ont un code EX. Au premier clic,
Power Automate demande de confirmer les connexions : cliquer **Continuer**.

*Facultatif* : mettre en forme la colonne **Statut** en pastilles de couleur (Paramètres de
colonne → Mettre en forme → *Choix* → couleurs).

---

## 4. Accès Teams

Dans le canal Général → **+** → **SharePoint** (ou **Listes**) → `Passations`. L'onglet
« Passations » est le point d'entrée commun des enseignantes et de la secrétaire.

## 5. Autorisations : rappel

| Élément | Accès |
|---|---|
| `ex01am` … `ex25pm` | autorisations propres : le compte EX correspondant + Propriétaires + Visiteurs (consultation) |
| `Correction` | Propriétaires, Membres (consultation), Rave-examen-ACI (consultation) |
| Liste `Passations` | Propriétaires, Membres, Visiteurs (consultation), **Rave-examen-ACI (Modification)** |

- La copie dans `Correction/…/Roy, Sophie` **hérite** des accès de Correction : le compte
  EX01AM n'y a pas accès. À vérifier au premier test (Gérer l'accès : aucune « Personne »).
- Si les enseignantes annotent directement les fichiers : passer Rave-examen-ACI à
  **Peut modifier** sur `Correction`.
- Le flux ne déplace jamais le dossier EX : il copie puis vide. Les autorisations de `ex01am`
  restent intactes.

## 6. Mise en route

1. Créer la liste `Passations`, ses colonnes, ses vues et ses autorisations.
2. Créer le flux (propriétaire), puis le partager avec la secrétaire en exécution seule.
3. Ajouter le bouton (section 3) et l'onglet Teams.
4. Test : dossier `ex25pm` avec 2 fichiers bidon → demande fictive (« Test, Élève »),
   Planifiée, CodeEX `EX25PM` → **Envoyer en correction**, sans vider le dossier EX.
   Vérifier `Correction/2026-2027/<date> PM/Test, Élève`, le statut « À corriger », le lien,
   le message Teams et les accès du dossier copié.
5. Refaire le test avec « Vider le dossier EX » = Oui → `ex25pm` vide, fichiers dans la corbeille.

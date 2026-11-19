# Copie des examens vers « Correction »

Petit outil Windows (PowerShell + fenêtre graphique) pour la secrétaire :

1. repère les dossiers d'examen anonymisés **EX01AM → EX25AM** et **EX01PM → EX25PM** ;
2. pour chacun, demande **à quel élève** il correspond (liste déroulante remplie
   à partir de la liste Excel des élèves, recherche en tapant les premières lettres) ;
3. affiche un **récapitulatif à confirmer** (EX01AM → Tremblay Julie, …) ;
4. copie le contenu de chaque dossier EX dans `Correction\<Nom de l'élève>` ;
5. (option) **déplace** : vide le dossier EX une fois la copie vérifiée
   (le dossier EX vide est conservé pour le prochain examen) ;
6. enregistre un journal `Correction\_journal_copie_<date>.csv` (code ↔ élève).

## Installation (une seule fois, sur le poste de la secrétaire)

1. **Synchroniser les fichiers de l'équipe Teams** sur l'ordinateur :
   Teams → l'équipe → onglet **Fichiers** → **Synchroniser**
   (ou **Ajouter un raccourci à Mes fichiers**).
   Les dossiers apparaissent dans l'Explorateur Windows, par exemple
   `C:\Users\<nom>\<Établissement>\<Équipe> - Documents\General\`.
   OneDrive renvoie ensuite automatiquement les modifications vers Teams/SharePoint.
2. Copier `CopierExamens.ps1` et `Lancer-CopierExamens.bat` dans un même dossier
   (ex. Bureau). Excel doit être installé (sinon, utiliser une liste en CSV).

## Utilisation

Double-cliquer sur **`Lancer-CopierExamens.bat`**, puis :

| Champ | Choisir |
|---|---|
| Dossier des examens | le dossier synchronisé qui contient EX01AM, EX02AM… |
| Dossier « Correction » | `…\Correction` (proposé automatiquement s'il est à côté) |
| Liste des élèves | le fichier Excel (.xlsx) ou CSV |

Les chemins sont mémorisés pour la fois suivante
(`%APPDATA%\CopierExamens\config.json`).

Dans le tableau, choisir l'élève de chaque code, laisser **(ignorer)** pour un
dossier à ne pas traiter, puis **Lancer la copie**. Un même élève choisi deux fois
est signalé en rouge et bloque la copie.

## Format de la liste Excel

1re feuille du classeur. L'outil reconnaît les en-têtes (1re ligne) :

- colonnes **Nom** et **Prénom** → dossier « Nom Prénom » ;
- ou une seule colonne **Élève** / **Nom complet** / **Nom, prénom**.

Sans en-tête reconnu, la 1re colonne est utilisée telle quelle (1re ligne incluse).
Les homonymes reçoivent un suffixe « (2) ».

## Bon à savoir

- Si `Correction\<Élève>` existe déjà, le dossier créé s'appelle
  `<Élève> - EX01AM` (rien n'est écrasé).
- Caractères interdits dans les noms de dossiers (`\ / : * ? " < > |`) remplacés par un espace.
- Le mode « Déplacer » ne supprime les originaux qu'après avoir vérifié que tous
  les fichiers ont été copiés.
- Laisser OneDrive terminer la synchronisation (icône nuage) avant de fermer
  l'ordinateur.

## Version « bouton » dans SharePoint / Teams

Voir [POWER-PLATFORM.md](POWER-PLATFORM.md) : application Power Apps intégrée à une
page SharePoint ou à un onglet Teams, plus deux flux Power Automate. Rien à installer
sur le poste.

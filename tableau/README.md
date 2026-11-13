# Tableau interactif

Application de tableau blanc **en un seul fichier HTML** (`index.html`), pensée pour
les téléviseurs interactifs (écrans tactiles) des écoles. Aucune installation :
ouvrir le fichier dans Chrome ou Edge, ou le déposer sur un serveur web / SharePoint / Moodle.

## Fonctions

| Catégorie | Contenu |
|---|---|
| Écriture | Crayon (10 couleurs + couleur libre, 4 épaisseurs), surligneur, gomme, texte (police standard, scolaire *Andika*, serif) |
| Attirer l'attention | Flèche, double flèche, flèche courbe (courbure réglable), flèches rondes (horaire / antihoraire), pointeur laser |
| Formes | Rectangle, ellipse/cercle, triangle, triangle rectangle, losange, parallélogramme, trapèze, pentagone, hexagone, octogone, étoile, ligne — contour, rempli léger ou plein, pointillé |
| Tableau infini | Glisser le fond (outil Sélection ou Main), **Ctrl + glisser** ou Espace + glisser avec n'importe quel outil, 2 doigts pour déplacer/zoomer, molette pour zoomer |
| Pages | Ajouter, dupliquer, réordonner, supprimer; miniatures; chaque page garde son fond et sa position |
| Feuilles | Objets **redimensionnables**, au format **lettre 8,5 × 11** par défaut : feuille blanche, quadrillé, petits carreaux, millimétré, pointillé, ligné, interligné (primaire), plan cartésien gradué, **portée** (clé de sol, fa, ut 3e, ut 4e, percussion, aucune), portée de piano, tablature — papier blanc, crème, vert ou noir. En redimensionnant, la feuille « colle » magnétiquement au format lettre (portrait ou paysage; Alt pour ignorer). Ce qui est écrit ou déposé **sur** une feuille s'y attache et la suit; une autre feuille qui passe dessus ou dessous ne le récupère pas |
| Aimant 🧲 | Trait presque droit → ligne droite (0°, 45°, 90°…); formes et flèches qui s'accrochent aux sommets des autres formes et au quadrillage des feuilles |
| Formes 3D | **Atelier 3D** : cube/pavé, cylindre, sphère, cône, pyramide, prisme triangulaire, demi-sphère, tore, tube; plan cartésien 3D gradué en mm; dimensions, position et rotation en mm/degrés; formes **« trou »** soustraites au groupement, formes pleines additionnées (style Tinkercad); cotes, volume et aire; insertion sur le tableau et modification par double-clic |
| Sélection multiple | Outil **lasso** : entourer des objets pour les sélectionner; **Grouper / Dégrouper** (Ctrl+G / Ctrl+Maj+G); un groupe se sélectionne et se déplace d'un seul geste; Maj + clic ajoute à la sélection |
| Rapidité | Après une forme, une flèche, un texte ou un symbole, l'outil **Sélection** revient seul (double-clic sur un outil pour le garder actif). **Appui long** immobile sur le tableau : menu des **3 derniers outils utilisés** — un symbole (GN, Prédicat…) ou une forme y est posé directement |
| Symboles | Notes, silences, altérations, nuances, chiffrages de mesure; symboles mathématiques; étiquettes de grammaire (GN, GV, CD, CI, Attr. S…); tampons de correction |
| Documents | Image, **PDF** (chaque page devient une image annotable), **Word .docx** (converti en pages), capture d'écran, coller (Ctrl+V), glisser-déposer |
| Pages web | **Page web (lien)** affichée en direct sur le tableau (YouTube, GeoGebra, Desmos, PhET, Google Docs publiés…), avec un mode « interagir » pour cliquer et défiler; **Onglet ou fenêtre en direct** (partage d'écran) pour n'importe quel site ou logiciel; bouton **Figer** pour transformer la page en image annotable |
| Sauvegarde | Automatique dans le navigateur; fichier `.tableau` à enregistrer/ouvrir; export PNG; impression / PDF de toutes les pages |

Certains sites (Google, réseaux sociaux, banques…) refusent d'être affichés dans une autre
page : le cadre reste vide. Dans ce cas, ouvrez le site dans un autre onglet et utilisez
*Insérer → Onglet ou fenêtre en direct*. Les annotations restent fixes sur le tableau : si on
fait défiler la page web, elles ne suivent pas. Utilisez **Figer** avant d'annoter longuement.

Si la page reste vide ou affiche 🚫 : touchez le cadre (outil Sélection) puis le bouton **écran** —
le tableau ouvre le site dans un onglet et l'affiche en direct. Pour les sites connus pour refuser
(Google, YouTube hors vidéo, Microsoft 365, réseaux sociaux…), ce mode est proposé automatiquement.

Les documents PDF et Word insérés sont **verrouillés** : on écrit dessus sans les
déplacer par accident. Double-cliquer dessus avec l'outil Sélection pour les déplacer ou
les déverrouiller.

## Dépendances

Tout fonctionne hors ligne, sauf ce qui est chargé à la demande depuis Internet :

- PDF : `pdf.js` 3.11.174 (cdnjs)
- Word : `mammoth` 1.6.0 + `html2canvas` 1.4.1 (cdnjs)
- Atelier 3D : `three.js` r128 (cdnjs) + `OrbitControls` et `@jscad/modeling` 2.12.5 (jsDelivr)
- Polices *Noto Music* (clés et notes) et *Andika* (Google Fonts) — sinon, polices du système.

L'atelier 3D charge three.js (cdnjs) et @jscad/modeling (jsDelivr).

Si le réseau de l'école bloque `cdnjs.cloudflare.com`, l'import PDF/Word ne fonctionnera pas;
le reste du tableau, oui.

## Raccourcis

`V` sélection · `Q` lasso · `H` main · `P` crayon · `S` surligneur · `E` gomme · `R` formes · `F` flèches ·
`T` texte · `L` laser · `Ctrl+Z / Ctrl+Y` annuler / rétablir · `Suppr` supprimer ·
`Ctrl+D` dupliquer · `Ctrl+V` coller · `Page préc. / suiv.` pages · `0` tout afficher ·
`Ctrl+S` enregistrer.

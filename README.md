# DocConverter

Application web d'**authoring pédagogique** pour enseignants en formation
professionnelle (FP) au Québec. Fonctionne **100 % côté client** (HTML/JS/CSS,
Bootstrap 5), sur des machines de 4 à 8 Go de RAM.

S'inspire du modèle d'architecture du générateur SCORM **RÉCIT FAD SED v2.2** et
le dépasse en ajoutant un extracteur PPTX, un éditeur visuel de blocs et un
module de questions interactives Moodle.

## Statut

🚧 **En développement — un module à la fois.**

- ✅ **Cœur applicatif** : coquille (`app-shell`), état central (`state-store`),
  bus d'événements, schéma + migrations, store de médias (IndexedDB),
  persistance `.dcproj`.
- ✅ **Module 1 — Extracteur PPTX** : lecture slide par slide (JSZip), extraction
  textes/tableaux/positions/notes, médias → IndexedDB + zip téléchargeable,
  rastérisation des formes/groupes en PNG.
- ✅ **Module 2 — JSON enrichi + double prompt** : formulaire de métadonnées FP,
  génération du Prompt Phase 1 (création pédagogique HTML/Bootstrap, contrat
  `dc-*`) et Phase 2 (prescription technique : pont SCORM, resize iframe,
  nettoyage, Loi 25), JSON enrichi copiable/téléchargeable.
- ✅ **Module 3 — Éditeur de blocs + import HTML** : importe le HTML du LLM
  (coller/fichier) selon le contrat `dc-*`, fusionne par `stepId` (préserve
  notes et médias), nettoie le HTML, et édite les blocs par colonnes (1/2/3),
  réorganisation, animations CSS, conservation/suppression des formes.
- ✅ **Module 4 — Questions interactives Moodle** : choix multiple (unique/
  multiple), appariement, glisser-déposer sur texte, glisser-déposer sur image
  (éditeur visuel de zones), rétroaction par choix + « haut-parleur sur la
  pensée », aperçu interactif, agrégation pondérée des scores → `activityComplete`.
- ✅ **Module 5 — Navigation automatique** : menu de progression basé sur les
  titres, boutons Précédent/Suivant, indicateur de progression, et appels
  `activityProgress(stepId)` à chaque changement de diapositive. Rendu de slide
  partagé (`js/shared/slide-renderer.js`) réutilisé par l'export.
- ✅ **Module 6 — Validation + export** : validateur (SDK résiduel, hauteur fixe,
  SCORM direct, médias manquants…) avec prompts de correction copiables ;
  simulateur Moodle (fausse API SCORM + journal en temps réel) ; export ZIP
  **SCORM 1.2** (`imsmanifest.xml` + pont abstrait → `LMSSetValue`) ou **HTML
  simple** ; script resize iframe ; analyse de conformité **Loi 25**.

**Les 6 modules sont implémentés.** Le pipeline complet PPTX → prompts → édition
→ questions → navigation → validation → export SCORM est fonctionnel.

### Audio à écoute active

Pour les diaporamas où **chaque diapositive porte un audio** (théorie), un bloc
`audio` transforme l'écoute passive en activité : transcription **synchronisée**
(surlignage de la phrase en cours), **3 mots-clés**, **image** illustrative,
**chapitres** navigables, **points de contrôle** (l'audio se met en pause et
pose une question avant de continuer) et contrôle de vitesse.

Le Module 1 extrait l'audio de chaque diapositive. Deux niveaux :

- **Sans outil** : minutage proportionnel **100 % navigateur** ; texte pris des
  notes du présentateur.
- **Avec le script compagnon** [`tools/audio_to_transcript.py`](tools/audio_to_transcript.py)
  (réutilise le pipeline PPTX de l'utilisateur) : **transcription** Whisper +
  **reformulation** en moins de mots + **3 mots-clés** + **voix TTS** (l'audio
  lu correspond au texte affiché) + **image**. Il produit un `.zip` importé via
  *Module 1 → « Importer un transcript audio »*.

Détails : [`docs/audio-ecoute-active.md`](docs/audio-ecoute-active.md).

Le contrat HTML produit par le LLM (et réimporté par M3) est figé dans
[`docs/contrat-html-llm.md`](docs/contrat-html-llm.md).

### Lancer l'application

Servir le dossier en local (modules ES → nécessite HTTP, pas `file://`) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Modules

| # | Module | Rôle |
|---|--------|------|
| 1 | Extracteur PPTX | Analyse `.pptx` slide par slide (JSZip), extrait textes/tableaux/positions/notes/médias, rastérise les formes en PNG. |
| 2 | JSON enrichi + double prompt | Prompt de création pédagogique (phase 1) + prompt de prescription technique SCORM/Moodle/Loi 25 (phase 2). |
| 3 | Éditeur visuel de blocs | Importe le HTML/Bootstrap du LLM, éditeur de blocs structuré (1/2/3 colonnes, animations CSS). |
| 4 | Questions interactives Moodle | Choix multiple, appariement, glisser-déposer texte/image, rétroaction par choix. |
| 5 | Navigation automatique | Menu de progression, Précédent/Suivant, `activityProgress(stepId)`. |
| 6 | Validation + export SCORM 1.2 | Validateur, simulateur Moodle, export ZIP SCORM 1.2 / HTML simple, resize iframe, analyse Loi 25. |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — plan d'architecture technique complet.
- [`docs/schema-json-enrichi.md`](docs/schema-json-enrichi.md) — format du JSON enrichi (état central).
- [`docs/pont-scorm.md`](docs/pont-scorm.md) — contrat du pont SCORM abstrait.

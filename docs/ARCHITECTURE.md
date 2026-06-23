# Architecture technique — DocConverter

> Application web d'authoring pédagogique pour enseignants en **formation
> professionnelle (FP)** au Québec. 100 % côté client. S'inspire du générateur
> SCORM **RÉCIT FAD SED v2.2** et le dépasse (extracteur PPTX, éditeur de blocs,
> questions Moodle).

**Statut du document :** plan d'architecture initial. Aucun code applicatif
n'est encore écrit. Ce document est le contrat de référence pour le
développement « un module à la fois ».

---

## 1. Principes directeurs

| # | Principe | Conséquence concrète |
|---|----------|----------------------|
| 1 | **100 % client** | Aucun serveur, aucun appel réseau obligatoire. Tout traitement (PPTX, rastérisation, export) se fait dans le navigateur. Les fichiers ne quittent jamais la machine → atout pour la **Loi 25**. |
| 2 | **Contrainte mémoire 4–8 Go** | Traitement PPTX **slide par slide** (streaming), libération explicite des `ArrayBuffer`/`Blob`/`ObjectURL`, jamais tout le `.pptx` décompressé en mémoire d'un coup. |
| 3 | **Architecture modulaire** | 6 modules indépendants reliés par un **état central unique** (le JSON enrichi) et un **bus d'événements**. Un module ne connaît jamais l'implémentation d'un autre. |
| 4 | **Copier-coller manuel du prompt** | L'app ne contient **aucune clé API**. Elle génère des prompts texte que l'utilisateur colle dans le LLM de son choix (Claude, Gemini, ChatGPT, Copilot). |
| 5 | **Sans étape de build** | HTML/JS/CSS natifs + Bootstrap 5. Modules ES (`type="module"`). Aucun bundler requis pour fonctionner ; bibliothèques tierces (JSZip) vendorisées localement. |
| 6 | **Pont d'abstraction SCORM** | Le contenu pédagogique n'appelle **jamais** l'API SCORM directement. Il appelle `window.activityComplete(score)` / `window.activityProgress(stepId)`. Un pont traduit vers SCORM **ou** ne fait rien (export HTML simple). |

---

## 2. Pile technologique

| Couche | Choix | Justification |
|--------|-------|---------------|
| UI | **Bootstrap 5** (CSS + JS bundle) | Imposé par le contexte. Composants accessibles, responsive. |
| Langage | **JavaScript ES2020+ (modules natifs)** | Pas de transpilation. `import`/`export`. |
| Décompression PPTX | **JSZip** (vendorisé) | Lecture progressive d'entrées zip, support `async`. |
| Rastérisation formes | **Canvas 2D → `toBlob('image/png')`** | Formes et groupes de formes PPTX rendus en PNG. |
| Export SCORM/HTML | **JSZip** (réutilisé) | Génération du `.zip` SCORM 1.2 côté client. |
| Persistance locale | **IndexedDB** (gros médias) + **localStorage** (préférences) | IndexedDB pour stocker blobs médias volumineux sans saturer la RAM. |
| Tests | À définir (ex. modules de test natifs / Vitest si build introduit plus tard) | Hors périmètre du plan initial. |

> **Note :** aucune dépendance réseau n'est requise à l'exécution. Bootstrap et
> JSZip sont servis depuis `/js/vendor/` et `/css/vendor/`.

---

## 3. Arborescence des fichiers

```
docconverter/
├── index.html                      # Shell de l'application (coquille SPA légère)
├── css/
│   ├── app.css                     # Styles applicatifs (UI d'authoring)
│   ├── export-runtime.css          # Styles EMBARQUÉS dans le HTML exporté (vue apprenant)
│   ├── animations.css              # Animations CSS pures (activables par bloc)
│   └── vendor/
│       └── bootstrap.min.css
├── js/
│   ├── main.js                     # Point d'entrée : initialise le shell + modules
│   ├── core/
│   │   ├── app-shell.js            # Navigation entre modules, rendu de la coquille
│   │   ├── state-store.js          # Source de vérité : le « projet » (JSON enrichi)
│   │   ├── event-bus.js            # Pub/sub découplant les modules
│   │   ├── project-schema.js       # Schéma + validation du JSON enrichi (versionné)
│   │   ├── persistence.js          # Sauvegarde/chargement (IndexedDB + localStorage)
│   │   └── media-store.js          # Gestion mémoire des blobs médias (ObjectURL, GC)
│   ├── modules/
│   │   ├── m1-pptx-extractor/
│   │   │   ├── index.js            # API publique du module
│   │   │   ├── pptx-reader.js      # Lecture zip + parcours slide par slide (JSZip)
│   │   │   ├── slide-parser.js     # XML slide → blocs (texte, tableau, position, notes)
│   │   │   ├── shape-rasterizer.js # Formes/groupes → PNG (canvas)
│   │   │   ├── media-extractor.js  # Images/audio/vidéo → media-store + zip téléchargeable
│   │   │   └── ui.js               # Interface du module (dropzone, progression)
│   │   ├── m2-json-prompt/
│   │   │   ├── index.js
│   │   │   ├── metadata-fp.js      # Métadonnées FP : compétences FEQ, contexte métier
│   │   │   ├── prompt-phase1.js    # Prompt de création pédagogique
│   │   │   ├── prompt-phase2.js    # Prompt de prescription technique (SCORM/Moodle/Loi 25)
│   │   │   └── ui.js
│   │   ├── m3-block-editor/
│   │   │   ├── index.js
│   │   │   ├── html-importer.js    # Coller HTML / importer fichier conforme aux templates
│   │   │   ├── block-model.js      # Modèle de blocs (1/2/3 colonnes, types de contenu)
│   │   │   ├── block-editor-ui.js  # Éditeur de blocs structuré (réorg/suppr/modif)
│   │   │   └── ui.js
│   │   ├── m4-questions/
│   │   │   ├── index.js
│   │   │   ├── question-types/     # multiple-choice, matching, ddtext, ddimage
│   │   │   ├── hotspot-editor.js   # Éditeur visuel de zones (glisser-déposer image)
│   │   │   ├── feedback-model.js   # Rétroaction par choix + « haut-parleur sur la pensée »
│   │   │   ├── scoring.js          # Agrégation des scores → activityComplete
│   │   │   └── ui.js
│   │   ├── m5-navigation/
│   │   │   ├── index.js
│   │   │   ├── progress-menu.js    # Menu basé sur les titres de slides
│   │   │   └── nav-runtime.js      # Précédent/Suivant + activityProgress(stepId)
│   │   └── m6-validation-export/
│   │       ├── index.js
│   │       ├── validator.js        # Règles de détection (SDK résiduel, etc.)
│   │       ├── fix-prompts.js      # Prompts de correction ciblés copiables
│   │       ├── moodle-simulator.js # Fausse API SCORM + journal d'événements
│   │       ├── scorm-export.js     # ZIP SCORM 1.2 + imsmanifest.xml
│   │       ├── html-export.js      # Export HTML simple (sans SCORM)
│   │       └── ui.js
│   ├── shared/
│   │   ├── scorm-bridge.js         # Pont abstrait (modèle, injecté dans l'export)
│   │   ├── iframe-resize.js        # Script resize Moodle (aliases + ResizeObserver)
│   │   ├── loi25.js                # Analyse de conformité Loi 25
│   │   └── utils.js
│   └── vendor/
│       ├── jszip.min.js
│       └── bootstrap.bundle.min.js
├── templates/
│   ├── slide-layouts/              # Gabarits 1/2/3 colonnes (référence import/export)
│   ├── question-templates/         # Gabarits HTML des 4 types de questions
│   └── export-shell.html           # Coquille HTML du paquet exporté (vue apprenant)
├── docs/
│   ├── ARCHITECTURE.md             # CE document
│   ├── schema-json-enrichi.md      # Détail + exemple du JSON enrichi
│   └── pont-scorm.md               # Contrat du pont SCORM
└── README.md
```

> **Distinction clé :** `css/app.css` et les `ui.js` servent **l'app
> d'authoring**. `css/export-runtime.css`, `templates/export-shell.html`,
> `shared/scorm-bridge.js` et `shared/iframe-resize.js` sont **embarqués dans le
> paquet exporté** (vue apprenant Moodle). Ces deux mondes ne partagent aucun
> état à l'exécution.

---

## 4. Cœur applicatif (core)

### 4.1 État central — `state-store.js`

Source de vérité unique. Détient **un seul objet `project`** (le JSON enrichi,
§6). Les modules ne se parlent jamais directement : ils lisent/écrivent l'état
et émettent des événements.

API proposée :

```
store.getProject()                      → renvoie l'état courant (lecture seule)
store.update(path, value)               → mutation ciblée + émission d'événement
store.replaceProject(json)              → import complet (ex. ouverture projet)
store.subscribe(path, callback)         → réaction aux changements
store.snapshot() / store.restore(snap)  → undo/redo
```

### 4.2 Bus d'événements — `event-bus.js`

Pub/sub minimal découplant les modules. Événements normalisés :

| Événement | Émis par | Consommé par |
|-----------|----------|--------------|
| `pptx:slide-extracted` | M1 | M1 UI (progression), store |
| `pptx:extraction-complete` | M1 | M2 (active la génération de prompt) |
| `prompt:generated` | M2 | M2 UI (copier-coller) |
| `html:imported` | M3 | M3 (parse en blocs), store |
| `blocks:changed` | M3 | M5 (menu nav), M6 (revalidation) |
| `question:added` | M4 | M4 scoring, store |
| `project:changed` | store | M6 (revalidation à la volée) |
| `validation:done` | M6 | M6 UI (rapport + prompts de correction) |

### 4.3 Gestion mémoire — `media-store.js`

Point névralgique pour la contrainte 4–8 Go.

- Les médias volumineux (vidéos, audio, images) sont stockés en **IndexedDB**,
  jamais conservés simultanément en RAM.
- Les `ObjectURL` sont créés à la demande et **révoqués** dès que le bloc
  consommateur est démonté (`URL.revokeObjectURL`).
- Pendant l'extraction PPTX, on traite **une slide à la fois** ; les
  `ArrayBuffer` intermédiaires sont libérés avant de passer à la suivante.

---

## 5. Pipeline inter-modules (contrats)

Le flux nominal d'un projet :

```
 ┌────┐   pptx:extraction-complete   ┌────┐   prompt:generated   ┌─────┐
 │ M1 │ ───────────────────────────► │ M2 │ ───(copier/coller)──►│ LLM │
 └────┘                              └────┘                       └─────┘
   │ écrit project.slides[]            │ lit project.*                │
   ▼                                   ▼                              │ HTML retourné
 store ◄──────────────────────────────┘                              ▼
   ▲                                                              ┌────┐
   │ project.blocks / questions / nav                             │ M3 │ html:imported
   │                                                              └────┘
   ├──────────────── M4 (questions) ◄────────────────────────────────┤
   ├──────────────── M5 (navigation) ◄───────────────────────────────┤
   └──────────────── M6 (validation + export) ◄──────────────────────┘
```

**Contrats de données par module** (entrée → sortie sur l'état `project`) :

| Module | Lit | Écrit |
|--------|-----|-------|
| **M1** PPTX | fichier `.pptx` (hors état) | `project.source`, `project.slides[]` (textes, tableaux, positions, notes), `project.media[]` |
| **M2** JSON+Prompt | `project.slides`, `project.media`, `project.metadataFP` | rien sur le contenu ; **produit deux chaînes de prompt** (phase 1, phase 2) |
| **M3** Éditeur | HTML LLM (hors état) ou `project.slides` | `project.slides[].blocks[]`, `project.slides[].layout` |
| **M4** Questions | `project.slides` | `project.slides[].questions[]`, `project.scoring` |
| **M5** Navigation | `project.slides[].title` | `project.navigation` |
| **M6** Export | `project` complet | rapport de validation + paquets `.zip` / `.html` (hors état) |

---

## 6. Format du JSON enrichi

Schéma détaillé et exemple complet dans
[`docs/schema-json-enrichi.md`](schema-json-enrichi.md). Vue d'ensemble :

```jsonc
{
  "schemaVersion": "1.0",
  "id": "uuid",
  "title": "Titre du module pédagogique",
  "metadataFP": {
    "programme": "DEP Cuisine",
    "competenceFEQ": { "code": "5311", "enonce": "Préparer des fonds..." },
    "contexteMetier": "Brigade de cuisine en restauration collective",
    "publicCible": "Apprenants adultes en FP",
    "dureeEstimeeMin": 30
  },
  "source": {
    "type": "pptx",
    "fileName": "presentation.pptx",
    "slideCount": 12,
    "extractedAt": "2026-06-23T00:00:00Z"
  },
  "slides": [
    {
      "id": "slide-1",
      "index": 0,
      "title": "Introduction aux fonds de cuisine",
      "notes": "Notes du présentateur extraites...",
      "layout": "two-column",          // one-column | two-column | three-column
      "blocks": [ /* voir block-model */ ],
      "questions": [ /* voir module 4 */ ],
      "rasterizedShapes": [
        { "mediaRef": "media-7", "origin": "shape-group", "bbox": {"x":0,"y":0,"w":480,"h":270}, "keep": true }
      ]
    }
  ],
  "media": [
    { "id": "media-1", "type": "image", "mime": "image/png", "fileName": "image1.png", "storage": "indexeddb", "fromShape": false }
  ],
  "navigation": {
    "mode": "progress-menu",
    "showPrevNext": true,
    "showProgressBar": true
  },
  "scoring": {
    "maxScore": 100,
    "aggregation": "weighted",
    "reportOn": "activityComplete"
  },
  "exportSettings": {
    "target": "scorm12",            // scorm12 | html-simple
    "iframeResize": true,
    "loi25Notice": true
  }
}
```

**Modèle de bloc** (`block-model.js`) — types prévus :

| Type | Description |
|------|-------------|
| `text` | Titre/paragraphe (HTML Bootstrap restreint) |
| `image` | Référence à un média (`mediaRef`) |
| `rasterized` | Image issue d'une forme/groupe PPTX (avec drapeau `keep`) |
| `table` | Tableau extrait du PPTX |
| `callout` | Encadré pédagogique (note, attention, astuce) |
| `question` | Référence à une question du module 4 |
| `media` | Audio/vidéo |

Chaque bloc porte : `id`, `type`, `column` (1–3), `order`, `animation`
(`none` | nom d'animation CSS), `content` (spécifique au type).

---

## 7. Pont SCORM abstrait

Contrat complet dans [`docs/pont-scorm.md`](pont-scorm.md). Règle d'or : **le
contenu pédagogique n'appelle jamais l'API SCORM**. Il appelle :

```js
window.activityComplete(score)   // score 0–100 → fin d'activité
window.activityProgress(stepId)  // progression (changement de slide)
```

`shared/scorm-bridge.js` fournit deux implémentations interchangeables,
choisies à l'export :

| Cible d'export | `activityComplete(score)` | `activityProgress(stepId)` |
|----------------|---------------------------|----------------------------|
| **SCORM 1.2** | `LMSSetValue('cmi.core.score.raw', score)` + `cmi.core.lesson_status` + `LMSCommit` | `LMSSetValue('cmi.core.lesson_location', stepId)` |
| **HTML simple** | no-op (ou log console) | no-op |
| **Simulateur Moodle** (M6) | fausse API → journal d'événements | fausse API → journal d'événements |

Le pont expose une API stable peu importe l'implémentation sous-jacente, ce qui
permet au simulateur (M6) de rejouer exactement le comportement Moodle sans LMS.

---

## 8. Ordre de développement recommandé

Conforme à « un module à la fois ». Chaque module est livrable et testable seul.

1. **Core** (state-store, event-bus, schema, media-store) + shell minimal.
2. **M1 — Extracteur PPTX** (le plus risqué techniquement : mémoire, parsing).
3. **M2 — JSON + double prompt** (dépend du JSON produit par M1).
4. **M3 — Éditeur de blocs** (consomme le HTML LLM, structure les slides).
5. **M4 — Questions Moodle** (s'insère dans les slides de M3).
6. **M5 — Navigation** (dépend des titres/slides finalisés).
7. **M6 — Validation + export SCORM** (a besoin de tout l'amont).

`shared/scorm-bridge.js`, `shared/iframe-resize.js` et `shared/loi25.js` sont
développés en support de M6 mais leur **contrat est figé dès maintenant** (§7)
pour que M4/M5 puissent l'appeler sans attendre.

---

## 9. Risques et points de vigilance

| Risque | Atténuation |
|--------|-------------|
| Pic mémoire à l'extraction d'un PPTX volumineux | Streaming slide par slide, IndexedDB, révocation des ObjectURL, pas de décompression globale. |
| Rastérisation de formes complexes infidèle | Limiter explicitement au contenu **statique** ; documenter que animations/transitions/SmartArt ne sont pas reproduits. |
| HTML LLM non conforme aux templates | M3 valide à l'import contre `templates/` ; M6 détecte les écarts et génère des prompts de correction. |
| Artefacts de plateforme / SDK résiduel dans le HTML | Règle de validation dédiée dans M6 + prompt de prescription technique (M2 phase 2). |
| Hauteur fixe / iframe non redimensionnée dans Moodle | `iframe-resize.js` (aliases + ResizeObserver) injecté à l'export ; règle de validation M6. |
| Conformité Loi 25 | Tout reste client-side ; `loi25.js` produit l'avis de conformité ; aucune donnée apprenant exfiltrée. |

---

## 10. Décisions ouvertes (à trancher avant le code)

- **Persistance projet** : sérialisation `.json` téléchargeable seule, ou aussi
  un format `.dcproj` (zip JSON + médias) ? *(Recommandation : `.dcproj` pour
  rapatrier les médias.)*
- **Versionnage du schéma** : stratégie de migration si `schemaVersion` évolue.
- **Tests automatisés** : introduire un mini-runner natif ou attendre un
  éventuel build.
- **i18n** : interface FR uniquement, ou prévoir une couche de chaînes ?

---

*Document vivant — à mettre à jour à chaque module livré.*

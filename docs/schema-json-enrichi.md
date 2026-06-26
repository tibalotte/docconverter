# Schéma du JSON enrichi — DocConverter

Le JSON enrichi est l'**état central** de l'application (cf.
[`ARCHITECTURE.md`](ARCHITECTURE.md) §4.1 et §6). Il est produit par M1, enrichi
par M2, structuré par M3, complété par M4/M5, puis exporté par M6.

`schemaVersion` permet la migration. Toute évolution incompatible incrémente la
version majeure.

---

## 1. Racine `project`

| Champ | Type | Obligatoire | Écrit par | Description |
|-------|------|-------------|-----------|-------------|
| `schemaVersion` | string | oui | core | Version du schéma (ex. `"1.0"`). |
| `id` | string (uuid) | oui | core | Identifiant unique du projet. |
| `title` | string | oui | M2/M3 | Titre du module pédagogique. |
| `metadataFP` | object | oui | M2 | Métadonnées formation professionnelle (§2). |
| `source` | object | oui | M1 | Provenance du contenu (§3). |
| `slides` | array\<Slide\> | oui | M1→M5 | Slides/pages (§4). |
| `media` | array\<Media\> | oui | M1 | Médias extraits (§5). |
| `navigation` | object | oui | M5 | Config de navigation (§6). |
| `scoring` | object | oui | M4 | Agrégation des scores (§7). |
| `exportSettings` | object | oui | M6 | Options d'export (§8). |

---

## 2. `metadataFP` — métadonnées formation professionnelle

| Champ | Type | Description |
|-------|------|-------------|
| `programme` | string | Programme FP (ex. `"DEP Cuisine"`). |
| `competenceFEQ` | object | `{ code, enonce }` — compétence du Programme d'études (FEQ). |
| `contexteMetier` | string | Contextualisation métier (mise en situation). |
| `publicCible` | string | Description du public apprenant. |
| `dureeEstimeeMin` | number | Durée estimée en minutes. |

---

## 3. `source`

| Champ | Type | Description |
|-------|------|-------------|
| `type` | enum | `"pptx"` (extensible). |
| `fileName` | string | Nom du fichier source. |
| `slideCount` | number | Nombre de slides détectées. |
| `extractedAt` | string (ISO 8601) | Horodatage de l'extraction. |

---

## 4. `Slide`

| Champ | Type | Écrit par | Description |
|-------|------|-----------|-------------|
| `id` | string | M1 | Identifiant stable (`"slide-1"`). |
| `index` | number | M1 | Position 0-based. |
| `title` | string | M1/M3 | Titre (sert au menu de nav M5 et à `activityProgress`). |
| `notes` | string | M1 | Notes du présentateur extraites. |
| `layout` | enum | M3 | `one-column` \| `two-column` \| `three-column`. |
| `blocks` | array\<Block\> | M3 | Blocs de contenu (§4.1). |
| `questions` | array\<Question\> | M4 | Questions interactives (§4.2). |
| `rasterizedShapes` | array | M1 | Formes/groupes rastérisés (§4.3). |
| `stepId` | string | M5 | Identifiant passé à `activityProgress(stepId)`. |

### 4.1 `Block`

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant du bloc. |
| `type` | enum | `text` \| `image` \| `rasterized` \| `table` \| `callout` \| `question` \| `media` \| `audio`. |
| `column` | number | Colonne d'affichage (1–3, selon `layout`). |
| `order` | number | Ordre dans la colonne. |
| `animation` | string | `"none"` ou nom d'animation CSS pure (cf. `animations.css`). |
| `content` | object | Charge utile spécifique au type (§4.1.1). |

#### 4.1.1 `content` selon `type`

```jsonc
// text
{ "html": "<h2>Titre</h2><p>Paragraphe…</p>" }

// image / rasterized
{ "mediaRef": "media-7", "alt": "Texte alternatif", "keep": true }

// table
{ "rows": [["A","B"],["1","2"]], "header": true }

// callout
{ "variant": "info|warning|tip", "html": "…" }

// question
{ "questionRef": "q-3" }

// media
{ "mediaRef": "media-12", "kind": "audio|video", "controls": true }

// audio (écoute active — cf. docs/audio-ecoute-active.md)
{ "mediaRef": "media-3", "transcript": "Texte de la théorie…",
  "phrases": [ { "text": "…", "start_ms": 0, "end_ms": 2100 } ],
  "chapters": [ { "title": "Introduction", "start_ms": 0 } ],
  "checkpoints": [ { "at_ms": 45000, "questionRef": "q-2" } ],
  "autoTiming": true }
```

### 4.2 `Question` (résumé — détail au module 4)

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant (`"q-3"`). |
| `type` | enum | `multiple-choice` \| `matching` \| `ddtext` (glisser-déposer sur texte) \| `ddimage` (glisser-déposer sur image). |
| `prompt` | string (HTML) | Énoncé. |
| `weight` | number | Poids dans l'agrégation du score. |
| `choices`/`pairs`/`zones` | array | Données spécifiques au type. |
| `feedbackByChoice` | object | Rétroaction spécifique par choix. |
| `thoughtSpeaker` | object\|null | Rétroaction « haut-parleur sur la pensée » (pédagogie explicite). |

### 4.3 `rasterizedShapes`

| Champ | Type | Description |
|-------|------|-------------|
| `mediaRef` | string | Média PNG généré. |
| `origin` | enum | `shape` \| `shape-group`. |
| `bbox` | object | `{ x, y, w, h }` (position d'origine dans la slide). |
| `keep` | boolean | Conservée (true) ou supprimée (false) par l'utilisateur (M3). |

---

## 5. `Media`

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant (`"media-1"`). |
| `type` | enum | `image` \| `audio` \| `video`. |
| `mime` | string | Type MIME. |
| `fileName` | string | Nom dans le zip téléchargeable et le paquet exporté. |
| `storage` | enum | `indexeddb` (gros) \| `inline` (petit). |
| `fromShape` | boolean | `true` si issu d'une rastérisation de forme. |

> Les **données binaires** ne sont jamais dans le JSON : seules les références
> (`id`) y figurent. Les blobs vivent dans `media-store` (IndexedDB).

---

## 6. `navigation`

| Champ | Type | Description |
|-------|------|-------------|
| `mode` | enum | `progress-menu` (menu basé sur les titres). |
| `showPrevNext` | boolean | Boutons Précédent/Suivant. |
| `showProgressBar` | boolean | Indicateur de progression. |

---

## 7. `scoring`

| Champ | Type | Description |
|-------|------|-------------|
| `maxScore` | number | Score maximal (souvent 100). |
| `aggregation` | enum | `weighted` \| `equal`. |
| `reportOn` | enum | `activityComplete` (déclencheur du report final). |

---

## 8. `exportSettings`

| Champ | Type | Description |
|-------|------|-------------|
| `target` | enum | `scorm12` \| `html-simple`. |
| `iframeResize` | boolean | Injecter `iframe-resize.js`. |
| `loi25Notice` | boolean | Inclure l'avis de conformité Loi 25. |

---

## 9. Exemple complet (minimal)

```json
{
  "schemaVersion": "1.0",
  "id": "0d6c3b2a-1f4e-4c9a-9b1d-2e7f8a0c5d31",
  "title": "Les fonds de cuisine",
  "metadataFP": {
    "programme": "DEP Cuisine",
    "competenceFEQ": { "code": "5311", "enonce": "Préparer des fonds, des sauces et des potages" },
    "contexteMetier": "Brigade de cuisine en restauration collective",
    "publicCible": "Apprenants adultes en FP",
    "dureeEstimeeMin": 25
  },
  "source": { "type": "pptx", "fileName": "fonds.pptx", "slideCount": 2, "extractedAt": "2026-06-23T12:00:00Z" },
  "slides": [
    {
      "id": "slide-1", "index": 0, "title": "Introduction", "notes": "Présenter les 3 familles de fonds.",
      "layout": "one-column", "stepId": "step-1",
      "blocks": [
        { "id": "b1", "type": "text", "column": 1, "order": 0, "animation": "none",
          "content": { "html": "<h2>Les fonds de cuisine</h2><p>Base de nombreuses sauces.</p>" } }
      ],
      "questions": [], "rasterizedShapes": []
    },
    {
      "id": "slide-2", "index": 1, "title": "Vérification", "notes": "",
      "layout": "one-column", "stepId": "step-2",
      "blocks": [ { "id": "b2", "type": "question", "column": 1, "order": 0, "animation": "none", "content": { "questionRef": "q-1" } } ],
      "questions": [
        { "id": "q-1", "type": "multiple-choice", "prompt": "<p>Combien de familles de fonds ?</p>", "weight": 1,
          "choices": [ { "id": "c1", "text": "2", "correct": false }, { "id": "c2", "text": "3", "correct": true } ],
          "feedbackByChoice": { "c1": "Presque, il y en a une de plus.", "c2": "Exact : blancs, bruns, fumets." },
          "thoughtSpeaker": { "html": "Je me rappelle la règle des couleurs…" } }
      ],
      "rasterizedShapes": []
    }
  ],
  "media": [],
  "navigation": { "mode": "progress-menu", "showPrevNext": true, "showProgressBar": true },
  "scoring": { "maxScore": 100, "aggregation": "weighted", "reportOn": "activityComplete" },
  "exportSettings": { "target": "scorm12", "iframeResize": true, "loi25Notice": true }
}
```

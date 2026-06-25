# Contrat HTML du LLM — DocConverter

Ce document fige la **structure HTML/Bootstrap 5** que :

- le **prompt Phase 1** du Module 2 demande au LLM de produire, et que
- le **Module 3** (éditeur de blocs) sait réimporter et restructurer.

> Objectif : un HTML lisible, propre, **sans code SCORM ni JS de plateforme**
> (la couche technique est ajoutée en Phase 2 / à l'export par M6). Les classes
> `dc-*` et attributs `data-dc-*` servent de points d'ancrage stables pour
> l'éditeur ; le reste du balisage reste du Bootstrap 5 standard.

## 1. Une slide = une `<section>`

```html
<section class="dc-slide" data-dc-step="step-1" data-dc-layout="two-column">
  <h2 class="dc-slide-title">Titre de la diapositive</h2>
  <div class="row g-4">
    <div class="col-md-6 dc-col" data-dc-col="1">
      <!-- blocs de la colonne 1 -->
    </div>
    <div class="col-md-6 dc-col" data-dc-col="2">
      <!-- blocs de la colonne 2 -->
    </div>
  </div>
</section>
```

- `data-dc-step` : identifiant d'étape (= `slide.stepId`, sert à
  `activityProgress(stepId)` côté runtime).
- `data-dc-layout` : `one-column` | `two-column` | `three-column`.
- Le nombre de `.dc-col` correspond au layout (1, 2 ou 3). Classes de colonne
  Bootstrap : `col-12` (1), `col-md-6` (2), `col-md-4` (3).

## 2. Un bloc = un conteneur `data-dc-type`

```html
<div class="dc-block" data-dc-type="text">
  <p>Contenu pédagogique…</p>
</div>

<div class="dc-block" data-dc-type="image" data-dc-media="media-3">
  <!-- src laissé vide : l'image binaire est rattachée par M3 via data-dc-media -->
  <img class="img-fluid" alt="Description" data-dc-media="media-3">
</div>

<div class="dc-block" data-dc-type="callout">
  <div class="alert alert-info" role="alert">Astuce métier…</div>
</div>

<div class="dc-block" data-dc-type="table">
  <table class="table table-bordered">…</table>
</div>
```

Types reconnus : `text`, `image`, `rasterized`, `table`, `callout`, `media`,
`question` (cf. `docs/schema-json-enrichi.md` §4.1).

### Médias (important)

Le LLM **ne connaît pas** les binaires. Pour toute image/forme issue du PPTX, il
**conserve l'attribut `data-dc-media="media-N"`** et laisse `src` vide. M3
recolle le binaire depuis IndexedDB à l'import. Le LLM ne doit pas inventer
d'URL d'image ni de `src` en base64.

## 3. Animations CSS pures (optionnel)

Une animation se déclare en attribut, jamais en JS :

```html
<div class="dc-block" data-dc-type="text" data-dc-anim="fade-in">…</div>
```

M3 active/désactive les animations en ajoutant/retirant la classe correspondante
(`dc-anim-fade-in`, etc.) définie dans `css/animations.css`.

## 4. Interdits en Phase 1

- Aucun `<script>` (ni SCORM, ni resize, ni logique de question).
- Aucun appel `window.activityComplete` / `activityProgress` (ajouté en Phase 2).
- Aucun artefact d'éditeur ou de plateforme.
- Aucune hauteur fixe sur les conteneurs racine.

Ces éléments techniques sont introduits par le **prompt Phase 2** puis vérifiés
par le **Module 6**.

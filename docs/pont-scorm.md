# Contrat du pont SCORM abstrait — DocConverter

Le **pont SCORM** (`js/shared/scorm-bridge.js`) découple le contenu pédagogique
de la plateforme d'hébergement. Cf. [`ARCHITECTURE.md`](ARCHITECTURE.md) §7.

> **Règle d'or :** le contenu généré (HTML/JS des slides et questions) n'appelle
> **jamais** l'API SCORM (`API`, `LMSSetValue`, `cmi.*`) directement. Il appelle
> uniquement les deux fonctions de façade ci-dessous.

---

## 1. API de façade (appelée par le contenu)

```js
/**
 * Signale la fin de l'activité avec un score agrégé.
 * @param {number} score  Score sur l'échelle 0–100.
 */
window.activityComplete(score);

/**
 * Signale une progression (typiquement un changement de slide).
 * @param {string} stepId  Identifiant d'étape (cf. slide.stepId).
 */
window.activityProgress(stepId);
```

Ces fonctions sont **toujours présentes** dans le paquet exporté, quelle que
soit la cible. C'est l'implémentation derrière qui change.

---

## 2. Implémentations interchangeables

Choisies à l'export selon `project.exportSettings.target` (et utilisées telles
quelles par le simulateur du module 6).

### 2.1 Cible `scorm12`

| Façade | Traduction SCORM 1.2 |
|--------|----------------------|
| init (au chargement) | `API.LMSInitialize("")` ; lire `cmi.core.lesson_status`. |
| `activityProgress(stepId)` | `LMSSetValue("cmi.core.lesson_location", stepId)` puis `LMSCommit("")`. |
| `activityComplete(score)` | `LMSSetValue("cmi.core.score.raw", score)` ; `LMSSetValue("cmi.core.score.min", 0)` ; `LMSSetValue("cmi.core.score.max", 100)` ; `LMSSetValue("cmi.core.lesson_status", score >= seuil ? "passed" : "completed")` ; `LMSCommit("")`. |
| fin (déchargement) | `LMSFinish("")`. |

Le pont **recherche l'objet `API`** en remontant `window.parent`/`window.opener`
(comportement standard SCORM 1.2). S'il est introuvable, il bascule
silencieusement vers le mode no-op (§2.2) sans casser le contenu.

### 2.2 Cible `html-simple`

| Façade | Comportement |
|--------|--------------|
| `activityProgress(stepId)` | no-op (option : `console.debug`). |
| `activityComplete(score)` | no-op (option : `console.debug`). |

Aucune dépendance SCORM. Convient à une diffusion HTML hors LMS.

### 2.3 Simulateur Moodle (module 6)

Le simulateur fournit une **fausse API SCORM** (`window.API`) qui implémente
`LMSInitialize`, `LMSSetValue`, `LMSGetValue`, `LMSCommit`, `LMSFinish`,
`LMSGetLastError`. Chaque appel est **journalisé en temps réel** dans le
journal d'événements de M6. Cela permet de rejouer exactement le comportement
Moodle **sans LMS réel**, en réutilisant l'implémentation `scorm12` du pont.

---

## 3. Script de resize iframe Moodle

`js/shared/iframe-resize.js`, injecté à l'export si
`exportSettings.iframeResize === true`.

- Mesure la hauteur réelle du contenu et la transmet au parent Moodle.
- **Aliases multiples** : envoie le message sous les différents noms attendus
  selon les versions de Moodle (ex. variantes de `postMessage` / API
  d'auto-redimensionnement), pour maximiser la compatibilité.
- **`ResizeObserver`** sur le conteneur racine : recalcule la hauteur à chaque
  changement de contenu (ouverture de question, animation, etc.).
- Aucune hauteur fixe dans le contenu exporté (règle vérifiée par le validateur
  M6).

---

## 4. Mapping `cmi` de référence (SCORM 1.2)

| Donnée | Élément `cmi` |
|--------|---------------|
| Statut | `cmi.core.lesson_status` (`passed` / `completed` / `incomplete`) |
| Score brut | `cmi.core.score.raw` |
| Score min/max | `cmi.core.score.min` / `cmi.core.score.max` |
| Reprise/position | `cmi.core.lesson_location` |
| Session | `LMSInitialize` / `LMSFinish` |

---

## 5. `imsmanifest.xml` (export SCORM 1.2)

Généré par `js/modules/m6-validation-export/scorm-export.js`. Points clés :

- Schéma SCORM 1.2 (`ADL SCORM 1.2`).
- Une `<organization>` / un `<item>` pointant vers la ressource HTML de lancement.
- `<resource>` de type `webcontent`, `adlcp:scormtype="sco"`, listant tous les
  fichiers du paquet (HTML, CSS d'export, pont, resize, médias).
- Métadonnées minimales (titre = `project.title`).

---

## 6. Invariants vérifiés par le validateur (M6)

| Invariant | Détection si absent/incorrect |
|-----------|-------------------------------|
| Façade présente | `activityComplete` / `activityProgress` définis. |
| Pas d'appel SCORM direct dans le contenu | Aucun `LMSSetValue`/`cmi.` hors `scorm-bridge.js`. |
| Pas de SDK résiduel / artefact de plateforme | Aucun script d'éditeur tiers laissé dans le HTML. |
| Pas de hauteur fixe | Aucun `height` fixe sur le conteneur racine. |
| Script de resize présent | `iframe-resize.js` inclus si requis. |
| `activityComplete` atteignable | Au moins un chemin déclenche le report du score. |

Chaque violation produit un **prompt de correction ciblé copiable**
(`fix-prompts.js`) à coller dans le LLM.

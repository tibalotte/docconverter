/**
 * prompt-phase1.js — Prompt de CRÉATION PÉDAGOGIQUE (Phase 1).
 *
 * Demande au LLM de transformer le contenu extrait en HTML/Bootstrap 5
 * pédagogique, contextualisé FP, SANS aucun code SCORM/JS (couche technique
 * ajoutée en Phase 2). Conçu pour copier-coller manuel (Claude/Gemini/ChatGPT/
 * Copilot). Cf. docs/contrat-html-llm.md.
 */

import { buildMetadataSummary } from './metadata-fp.js';
import { buildContentDigest } from './content-digest.js';

export function buildPhase1Prompt(project) {
  const meta = buildMetadataSummary(project.metadataFP);
  const content = buildContentDigest(project);

  return `Tu es un concepteur pédagogique expert en formation professionnelle (FP) au Québec.
Tu maîtrises la pédagogie explicite et le modèle de conception du RÉCIT FAD SED.

# Mission
À partir du contenu extrait d'une présentation, produis un module d'apprentissage
en **HTML + Bootstrap 5**, pédagogiquement structuré et contextualisé pour le
métier visé. Tu ne produis QUE du contenu pédagogique : **aucun code SCORM,
aucun <script>, aucune logique de plateforme** (cela sera ajouté à une étape
ultérieure).

# Contexte de formation professionnelle
${meta}

# Principes pédagogiques à appliquer
- Pédagogie explicite : objectifs clairs, modelage, exemples travaillés, pratique guidée.
- Contextualisation métier : ancre chaque notion dans des situations authentiques du métier.
- Alignement sur la compétence visée ci-dessus (vocabulaire, gestes professionnels, normes).
- Langue : français québécois professionnel, clair et inclusif.
- Accessibilité : titres hiérarchisés, attributs alt pertinents, bon contraste.

# Contenu source (extrait du PPTX, une diapositive par section)
${content}

# Format de sortie EXIGÉ (contrat HTML)
Produis une suite de <section> Bootstrap, une par diapositive, en respectant
EXACTEMENT cette structure (points d'ancrage pour l'éditeur) :

\`\`\`html
<section class="dc-slide" data-dc-step="step-1" data-dc-layout="two-column">
  <h2 class="dc-slide-title">Titre</h2>
  <div class="row g-4">
    <div class="col-md-6 dc-col" data-dc-col="1">
      <div class="dc-block" data-dc-type="text"><p>…</p></div>
    </div>
    <div class="col-md-6 dc-col" data-dc-col="2">
      <div class="dc-block" data-dc-type="image" data-dc-media="media-3">
        <img class="img-fluid" alt="…" data-dc-media="media-3">
      </div>
    </div>
  </div>
</section>
\`\`\`

Règles du contrat :
- \`data-dc-step\` = l'identifiant "step" fourni pour chaque diapositive.
- \`data-dc-layout\` ∈ { one-column, two-column, three-column } ; choisis la
  disposition la plus pédagogique. Colonnes Bootstrap : col-12 (1), col-md-6 (2),
  col-md-4 (3), chacune avec class="dc-col" et data-dc-col="N".
- Chaque bloc est un \`<div class="dc-block" data-dc-type="…">\` ; types permis :
  text, image, rasterized, table, callout, media.
- **Médias** : pour chaque média listé, conserve \`data-dc-media="media-N"\` et
  laisse \`src\` VIDE. N'invente aucune URL ni image base64. Le binaire sera
  rattaché automatiquement plus tard.
- Encadrés pédagogiques : \`data-dc-type="callout"\` avec un \`.alert\` Bootstrap.
- Tu peux enrichir/reformuler le contenu pour la clarté pédagogique, mais reste
  fidèle aux faits du contenu source.

# Interdits (vérifiés à l'étape suivante)
- Aucun <script>, aucun appel window.activityComplete / activityProgress.
- Aucune balise/attribut de plateforme ou d'éditeur.
- Aucune hauteur fixe (height) sur les conteneurs racine.

Réponds uniquement avec le HTML, sans explication.`;
}

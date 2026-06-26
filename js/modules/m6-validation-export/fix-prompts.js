/**
 * fix-prompts.js — Prompts de correction ciblés (copiables).
 *
 * À partir des problèmes détectés par le validateur, génère un prompt clair à
 * coller dans le LLM pour corriger le HTML, puis réimporter via le Module 3.
 */

const FIX_TEXT = {
  'residual-script': 'Retire toutes les balises <script> du contenu pédagogique. La logique technique (pont SCORM, resize) est ajoutée séparément à l’export ; elle ne doit pas figurer dans les blocs.',
  'direct-scorm': 'Remplace tout appel direct à l’API SCORM (LMSSetValue, LMSGetValue, cmi.*) par les fonctions de façade window.activityComplete(score) et window.activityProgress(stepId).',
  'event-handler': 'Supprime les gestionnaires d’événements inline (attributs on…="…"). Le comportement interactif est géré par le runtime.',
  'fixed-height': 'Retire toute hauteur fixe en pixels (height/min-height: …px) sur les conteneurs racine afin que la hauteur suive le contenu (resize iframe Moodle).',
  'platform-artifact': 'Nettoie les artefacts d’éditeur ou de traitement de texte (contenteditable, data-gjs, classes ql-/Mso/WordSection, namespaces microsoft). Conserve uniquement du Bootstrap 5 propre et les classes/attributs dc-*.',
  'external-resource': 'Internalise ou retire toute ressource externe (CDN, polices Google, images distantes). Le module doit être 100 % local (conformité Loi 25).',
  'missing-media': 'Conserve les attributs data-dc-media="media-N" existants sans inventer de src ; ne référence que des médias réellement présents dans le projet.',
  'missing-step': 'Assure-toi que chaque <section class="dc-slide"> possède un attribut data-dc-step unique.',
  'duplicate-step': 'Rends chaque data-dc-step unique entre les diapositives.',
};

/** Construit un prompt de correction pour un sous-ensemble de problèmes. */
export function buildFixPrompt(issues) {
  const keys = [...new Set(issues.map((i) => i.fixKey))].filter((k) => FIX_TEXT[k]);
  if (!keys.length) return '';
  const consignes = keys.map((k, i) => `${i + 1}. ${FIX_TEXT[k]}`).join('\n');
  const slides = [...new Set(issues.filter((i) => i.slideTitle).map((i) => i.slideTitle))];
  return `Tu es un intégrateur HTML. Corrige le HTML/Bootstrap 5 du module pédagogique
en appliquant STRICTEMENT les consignes suivantes, sans changer le contenu pédagogique
ni la structure du contrat (classes dc-*, attributs data-dc-*) :

${consignes}
${slides.length ? `\nDiapositives concernées : ${slides.join(', ')}.` : ''}

Réponds uniquement avec le HTML corrigé complet (suite de <section class="dc-slide">…),
prêt à être réimporté.`;
}

/** Libellé lisible d'un fixKey (pour l'UI). */
export function fixLabel(fixKey) {
  return FIX_TEXT[fixKey] ? fixKey : fixKey;
}

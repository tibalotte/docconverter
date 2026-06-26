/**
 * validator.js — Validation automatique du contenu (cf. RÉCIT).
 *
 * Analyse les blocs HTML du projet pour détecter les problèmes courants avant
 * export : SDK/artefacts résiduels, appels SCORM directs, hauteur fixe,
 * gestionnaires d'événements, scripts résiduels, ainsi que des vérifications
 * structurelles (étapes, médias manquants, déclenchement du score).
 *
 * Chaque problème porte un `fixKey` exploité par fix-prompts.js.
 */

/** Concatène le HTML éditable d'une slide (texte + encadrés). */
function slideHtml(slide) {
  return (slide.blocks || [])
    .filter((b) => b.type === 'text' || b.type === 'callout')
    .map((b) => (b.content && b.content.html) || '')
    .join('\n');
}

const HTML_RULES = [
  { fixKey: 'residual-script', severity: 'error', re: /<script[\s>]/i,
    message: 'Balise <script> résiduelle dans le contenu (interdite en Phase 1).' },
  { fixKey: 'direct-scorm', severity: 'error', re: /LMSSetValue|LMSGetValue|\bcmi\.[a-z]/i,
    message: 'Appel SCORM direct (LMS*/cmi.*) : utilise le pont activityComplete/activityProgress.' },
  { fixKey: 'event-handler', severity: 'warning', re: /\son[a-z]+\s*=\s*["']/i,
    message: 'Gestionnaire d’événement inline (on…="") : à retirer.' },
  { fixKey: 'fixed-height', severity: 'warning', re: /(?:min-)?height\s*:\s*\d+px/i,
    message: 'Hauteur fixe en px : empêche le resize iframe Moodle.' },
  { fixKey: 'platform-artifact', severity: 'warning', re: /contenteditable|data-gjs|class="ql-|MsoNormal|WordSection|urn:schemas-microsoft/i,
    message: 'Artefact d’éditeur/plateforme résiduel (Word/PowerPoint/éditeur visuel).' },
  { fixKey: 'external-resource', severity: 'error', re: /https?:\/\/(?!localhost|127\.)[^\s"'<>]+\.(?:js|css|png|jpe?g|gif|svg|woff2?)/i,
    message: 'Ressource externe (CDN/police/image) : à internaliser (Loi 25).' },
];

/**
 * @param {object} project
 * @returns {{ issues:Array, errors:number, warnings:number, ok:boolean }}
 */
export function validateProject(project) {
  const issues = [];
  const slides = project.slides || [];
  const mediaIds = new Set((project.media || []).map((m) => m.id));

  // 1) Règles HTML par slide.
  for (const slide of slides) {
    const html = slideHtml(slide);
    for (const rule of HTML_RULES) {
      if (rule.re.test(html)) {
        issues.push({ fixKey: rule.fixKey, severity: rule.severity, slideId: slide.id,
          slideTitle: slide.title, message: rule.message });
      }
    }
    // Médias référencés manquants.
    for (const b of slide.blocks || []) {
      const ref = b.content && b.content.mediaRef;
      if (ref && !mediaIds.has(ref)) {
        issues.push({ fixKey: 'missing-media', severity: 'error', slideId: slide.id,
          slideTitle: slide.title, message: `Média référencé introuvable : ${ref}.` });
      }
    }
  }

  // 2) Vérifications structurelles globales.
  if (!slides.length) {
    issues.push({ fixKey: 'no-slides', severity: 'error', message: 'Aucune diapositive.' });
  }
  const stepIds = slides.map((s) => s.stepId).filter(Boolean);
  if (stepIds.length !== slides.length) {
    issues.push({ fixKey: 'missing-step', severity: 'warning',
      message: 'Des diapositives n’ont pas de stepId (activityProgress incomplet).' });
  }
  if (new Set(stepIds).size !== stepIds.length) {
    issues.push({ fixKey: 'duplicate-step', severity: 'warning',
      message: 'stepId en double : la progression peut être ambiguë.' });
  }

  // 3) Déclenchement du score : questions présentes OU complétion auto en fin.
  const totalQuestions = slides.reduce((n, s) => n + (s.questions || []).length, 0);
  if (totalQuestions === 0) {
    issues.push({ fixKey: 'no-activity-complete', severity: 'info',
      message: 'Aucune question : activityComplete(100) sera émis automatiquement à la dernière diapositive.' });
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  return { issues, errors, warnings, ok: errors === 0 };
}

/**
 * prompt-phase2.js — Prompt de PRESCRIPTION TECHNIQUE (Phase 2).
 *
 * À coller après la Phase 1 : demande au LLM d'ajouter au HTML pédagogique la
 * couche technique SCORM/Moodle — pont d'abstraction activityComplete /
 * activityProgress, resize iframe (aliases + ResizeObserver), suppression des
 * artefacts de plateforme, et analyse Loi 25. Cf. docs/pont-scorm.md.
 */

export function buildPhase2Prompt(project) {
  const steps = (project.slides || []).map((s) => s.stepId).filter(Boolean);
  const stepList = steps.length ? steps.join(', ') : '(aucune étape)';
  const scoring = project.scoring || {};
  const target = (project.exportSettings && project.exportSettings.target) || 'scorm12';

  return `Tu es un intégrateur technique spécialisé en contenus SCORM/Moodle.
On te fournit le HTML pédagogique produit à l'étape précédente (Phase 1).
Ta mission : y ajouter UNIQUEMENT la couche technique décrite ci-dessous, sans
modifier le contenu pédagogique ni casser la structure du contrat (classes dc-*,
attributs data-dc-*).

# 1. Pont d'abstraction (NE PAS appeler l'API SCORM directement)
Le contenu n'appelle JAMAIS l'API SCORM. Il appelle deux fonctions de façade :
  - window.activityComplete(score)   // score 0–100, fin d'activité
  - window.activityProgress(stepId)  // progression (changement de diapositive)

Ajoute, une seule fois, un pont par défaut tolérant (si l'hôte SCORM est absent,
les fonctions ne doivent rien casser) :

\`\`\`html
<script>
(function () {
  if (!window.activityComplete) window.activityComplete = function (s) { /* injecté à l'export */ };
  if (!window.activityProgress) window.activityProgress = function (id) { /* injecté à l'export */ };
})();
</script>
\`\`\`

# 2. Câblage de la progression
Appelle window.activityProgress(stepId) lorsqu'une diapositive devient visible.
Étapes attendues (dans l'ordre) : ${stepList}.

# 3. Câblage du score final
Cible d'export : ${target}. Agrégation : ${scoring.aggregation || 'weighted'} ;
score maximal : ${scoring.maxScore != null ? scoring.maxScore : 100}.
Appelle window.activityComplete(score) lorsque l'apprenant a terminé (ou validé
les questions). En l'absence de questions, déclenche-le à la dernière étape.

# 4. Resize iframe Moodle (aliases multiples + ResizeObserver)
Ajoute ce script pour que Moodle redimensionne l'iframe sans hauteur fixe :

\`\`\`html
<script>
(function () {
  function notify() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    // Aliases couvrant les conventions Moodle/H5P selon les versions :
    var msgs = [
      { subject: 'lmsibheight', height: h },
      { context: 'h5p', action: 'resize', scrollHeight: h },
      { type: 'dc-resize', height: h }
    ];
    msgs.forEach(function (m) { try { parent.postMessage(m, '*'); } catch (e) {} });
  }
  if (window.ResizeObserver) {
    new ResizeObserver(notify).observe(document.documentElement);
  }
  window.addEventListener('load', notify);
  window.addEventListener('resize', notify);
})();
</script>
\`\`\`

# 5. Nettoyage
- Supprime tout artefact d'éditeur ou de plateforme éventuellement présent.
- Aucune hauteur fixe (height/min-height en px) sur <html>, <body> ou le
  conteneur racine : la hauteur doit suivre le contenu.
- Conserve toutes les classes/attributs dc-* et data-dc-* intacts.

# 6. Analyse de conformité Loi 25 (Québec)
Après le HTML, ajoute une courte analyse (hors HTML) confirmant :
- qu'aucune donnée personnelle de l'apprenant n'est collectée ni transmise hors
  du LMS hôte (seuls les appels SCORM standards via le pont) ;
- qu'aucun appel réseau externe (CDN, polices, traceurs) n'est introduit ;
- toute réserve éventuelle à lever.

Réponds avec : (a) le HTML complet mis à jour, puis (b) l'analyse Loi 25.`;
}

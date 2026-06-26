/**
 * export-entry.js — Point d'entrée du PAQUET EXPORTÉ (vue apprenant).
 *
 * Exécuté dans Moodle (ou en HTML simple). Lit le projet et la config embarqués,
 * installe le pont SCORM + le resize iframe, puis monte la navigation (qui rend
 * slides et questions). Réutilise tel quel le runtime des modules 4 et 5.
 */

import { mountNavigation } from '../modules/m5-navigation/nav-runtime.js';
import { renderQuestion } from '../modules/m4-questions/runtime.js';
import { createScoreController } from '../modules/m4-questions/scoring.js';
import { installScormBridge } from '../shared/scorm-bridge.js';
import { installResize } from '../shared/iframe-resize.js';

function readJson(id) {
  const el = document.getElementById(id);
  return el ? JSON.parse(el.textContent) : null;
}

const project = readJson('dc-project');
const config = readJson('dc-config') || { target: 'scorm12', iframeResize: true };

// Médias : id → media/<fichier> (fichiers locaux du paquet).
const mediaMap = new Map((project.media || []).map((m) => [m.id, m.fileName]));
const resolveMediaUrl = (ref) => (mediaMap.has(ref) ? `media/${mediaMap.get(ref)}` : null);

// Pont SCORM + resize.
installScormBridge({ target: config.target, masteryScore: config.masteryScore || null });
if (config.iframeResize !== false) installResize();

// Agrégation des scores des questions.
const controller = createScoreController(project);
const totalQuestions = controller.total();

const root = document.getElementById('dc-root');
await mountNavigation(root, project, {
  resolveMediaUrl,
  renderQuestion,
  onScore: (qid, score) => controller.record(qid, score),
  onProgress: (stepId, index) => {
    // Sans question : complétion automatique à la dernière diapositive.
    if (totalQuestions === 0 && index === (project.slides.length - 1)) {
      if (window.activityComplete) window.activityComplete(100);
    }
  },
});

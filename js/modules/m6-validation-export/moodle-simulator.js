/**
 * moodle-simulator.js — Simulateur Moodle intégré.
 *
 * Fausse API SCORM 1.2 qui journalise chaque appel en temps réel, branchée au
 * pont réel (scorm-bridge) : on rejoue ainsi le comportement Moodle sans LMS.
 * Le runtime (navigation + questions) est monté tel quel.
 */

import { mediaStore } from '../../core/media-store.js';
import { installScormBridge } from '../../shared/scorm-bridge.js';
import { mountNavigation } from '../m5-navigation/nav-runtime.js';
import { renderQuestion } from '../m4-questions/runtime.js';
import { createScoreController } from '../m4-questions/scoring.js';

/** Fausse API SCORM 1.2 ; chaque appel est transmis à onCall(method, detail). */
export function createFakeScormApi(onCall) {
  const data = { 'cmi.core.lesson_status': 'not attempted' };
  return {
    LMSInitialize() { onCall('LMSInitialize', '""'); return 'true'; },
    LMSFinish() { onCall('LMSFinish', '""'); return 'true'; },
    LMSGetValue(k) { onCall('LMSGetValue', k); return data[k] || ''; },
    LMSSetValue(k, v) { data[k] = v; onCall('LMSSetValue', `${k} = "${v}"`); return 'true'; },
    LMSCommit() { onCall('LMSCommit', '""'); return 'true'; },
    LMSGetLastError() { return '0'; },
    LMSGetErrorString() { return 'No error'; },
    LMSGetDiagnostic() { return ''; },
    _data: data,
  };
}

/**
 * Monte le simulateur dans `host` et journalise via onCall.
 * @returns {Promise<{ api:object, nav:object }>}
 */
export async function mountSimulator(host, project, { onCall }) {
  const api = createFakeScormApi(onCall);
  installScormBridge({
    target: 'scorm12', api,
    masteryScore: (project.scoring && project.scoring.masteryScore) || null,
  });

  const controller = createScoreController(project);
  const total = controller.total();

  const nav = await mountNavigation(host, project, {
    resolveMediaUrl: (ref) => mediaStore.getUrl(ref),
    renderQuestion,
    onScore: (qid, score) => controller.record(qid, score),
    onProgress: (stepId, index) => {
      if (total === 0 && index === project.slides.length - 1 && window.activityComplete) {
        window.activityComplete(100);
      }
    },
  });
  return { api, nav };
}

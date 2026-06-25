/**
 * index.js — Module 2 : Générateur de JSON enrichi + double prompt.
 *
 * Enrichit le projet des métadonnées FP, expose le JSON enrichi (copie/
 * téléchargement) et génère les deux prompts (création pédagogique /
 * prescription technique) destinés au copier-coller manuel dans le LLM.
 */

import { store } from '../../core/state-store.js';
import { downloadBlob } from '../../core/persistence.js';
import { buildPhase1Prompt } from './prompt-phase1.js';
import { buildPhase2Prompt } from './prompt-phase2.js';
import { mountUi } from './ui.js';

/** JSON enrichi sérialisé (lisible). */
export function exportJson() {
  return JSON.stringify(store.getProject(), null, 2);
}

/** Télécharge le JSON enrichi. */
export function downloadJson() {
  const p = store.getProject();
  const name = `${(p.title || 'projet').replace(/[^\w\-]+/g, '_')}.json`;
  downloadBlob(new Blob([exportJson()], { type: 'application/json' }), name);
}

export function getPhase1() {
  return buildPhase1Prompt(store.getProject());
}
export function getPhase2() {
  return buildPhase2Prompt(store.getProject());
}

/** Contrat de module pour la coquille. */
export const module2 = {
  id: 'm2',
  label: '2 · JSON + double prompt',
  order: 2,
  enabled: () => store.getProject().slides.length > 0,
  mount(container) {
    mountUi(container, { exportJson, downloadJson, getPhase1, getPhase2 });
  },
};

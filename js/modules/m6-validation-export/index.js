/**
 * index.js — Module 6 : Validation automatique + Export SCORM 1.2 / HTML.
 *
 * Validateur (problèmes + prompts de correction), simulateur Moodle (fausse API
 * SCORM + journal), export ZIP SCORM 1.2 (imsmanifest + pont abstrait) ou HTML
 * simple, resize iframe, et analyse Loi 25.
 */

import { store } from '../../core/state-store.js';
import { mountUi } from './ui.js';

export { validateProject } from './validator.js';
export { buildFixPrompt } from './fix-prompts.js';
export { buildExportPackage, buildIndexHtml } from './export-builder.js';
export { buildManifest } from './scorm-export.js';
export { createFakeScormApi, mountSimulator } from './moodle-simulator.js';

export const module6 = {
  id: 'm6',
  label: '6 · Validation + export',
  order: 6,
  enabled: () => store.getProject().slides.length > 0,
  mount(container) { mountUi(container); },
  unmount() { /* ObjectURL révoqués au prochain montage */ },
};

/**
 * index.js — Module 3 : Éditeur visuel de blocs + importation HTML.
 *
 * Importe le HTML/Bootstrap du LLM (contrat dc-*), recolle les médias depuis
 * IndexedDB et offre un éditeur de blocs structuré (1/2/3 colonnes, animations,
 * réorganisation, conservation des formes rastérisées).
 */

import { store } from '../../core/state-store.js';
import { mountUi } from './ui.js';

export { importHtmlToProject, parseHtml } from './html-importer.js';

export const module3 = {
  id: 'm3',
  label: '3 · Éditeur de blocs',
  order: 3,
  enabled: () => store.getProject().slides.length > 0,
  mount(container) {
    mountUi(container);
  },
  unmount() {
    // Les ObjectURL de prévisualisation sont révoqués au prochain montage.
  },
};

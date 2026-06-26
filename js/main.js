/**
 * main.js — Point d'entrée de l'application d'authoring.
 *
 * Initialise la coquille, enregistre les modules disponibles et démarre l'UI.
 * Les modules à venir (M2…M6) s'enregistreront ici au fur et à mesure.
 */

import { shell } from './core/app-shell.js';
import { module1 } from './modules/m1-pptx-extractor/index.js';
import { module2 } from './modules/m2-json-prompt/index.js';
import { module3 } from './modules/m3-block-editor/index.js';
import { module4 } from './modules/m4-questions/index.js';
import { module5 } from './modules/m5-navigation/index.js';

// Placeholder d'onglets pour les modules non encore implémentés : ils
// apparaissent grisés tant que leur dépendance amont n'est pas satisfaite.
import { store } from './core/state-store.js';

function placeholder(id, label, order, ready) {
  return {
    id, label, order,
    enabled: ready,
    mount(container) {
      container.innerHTML = `
        <div class="text-center text-muted py-5">
          <h1 class="h4">${label}</h1>
          <p>Module à venir. Le contrat est défini dans <code>docs/ARCHITECTURE.md</code>.</p>
        </div>`;
    },
  };
}

const hasSlides = () => store.getProject().slides.length > 0;

shell
  .register(module1)
  .register(module2)
  .register(module3)
  .register(module4)
  .register(module5)
  .register(placeholder('m6', '6 · Validation + export', 6, hasSlides))
  .start('#app');

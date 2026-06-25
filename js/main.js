/**
 * main.js — Point d'entrée de l'application d'authoring.
 *
 * Initialise la coquille, enregistre les modules disponibles et démarre l'UI.
 * Les modules à venir (M2…M6) s'enregistreront ici au fur et à mesure.
 */

import { shell } from './core/app-shell.js';
import { module1 } from './modules/m1-pptx-extractor/index.js';

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
  .register(placeholder('m2', '2 · JSON + double prompt', 2, hasSlides))
  .register(placeholder('m3', '3 · Éditeur de blocs', 3, hasSlides))
  .register(placeholder('m4', '4 · Questions Moodle', 4, hasSlides))
  .register(placeholder('m5', '5 · Navigation', 5, hasSlides))
  .register(placeholder('m6', '6 · Validation + export', 6, hasSlides))
  .start('#app');

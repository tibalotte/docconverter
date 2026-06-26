/**
 * index.js — Module 5 : Navigation automatique.
 *
 * Menu de progression basé sur les titres, Précédent/Suivant, indicateur de
 * progression, et appels activityProgress(stepId) à chaque changement de
 * diapositive. Le runtime (nav-runtime) est réutilisé tel quel par l'export M6.
 */

import { store } from '../../core/state-store.js';
import { mountUi } from './ui.js';

export { mountNavigation } from './nav-runtime.js';
export { buildProgressMenu } from './progress-menu.js';

export const module5 = {
  id: 'm5',
  label: '5 · Navigation',
  order: 5,
  enabled: () => store.getProject().slides.length > 0,
  mount(container) { mountUi(container); },
  unmount() { /* ObjectURL révoqués au prochain montage */ },
};

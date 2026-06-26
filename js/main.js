/**
 * main.js — Point d'entrée de l'application d'authoring.
 *
 * Initialise la coquille et enregistre les six modules.
 */

import { shell } from './core/app-shell.js';
import { module1 } from './modules/m1-pptx-extractor/index.js';
import { module2 } from './modules/m2-json-prompt/index.js';
import { module3 } from './modules/m3-block-editor/index.js';
import { module4 } from './modules/m4-questions/index.js';
import { module5 } from './modules/m5-navigation/index.js';
import { module6 } from './modules/m6-validation-export/index.js';

shell
  .register(module1)
  .register(module2)
  .register(module3)
  .register(module4)
  .register(module5)
  .register(module6)
  .start('#app');

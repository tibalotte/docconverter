/**
 * export-builder.js — Assemble le paquet exporté (.zip).
 *
 * Stratégie sans étape de build : on récupère (fetch) les fichiers du runtime à
 * leur chemin d'origine et on les place tels quels dans le paquet — les imports
 * ES relatifs restent valides. On y joint le HTML de lancement (projet + config
 * embarqués), les CSS, les médias locaux et, pour SCORM, le imsmanifest.xml.
 */

import { mediaStore } from '../../core/media-store.js';
import { escapeHtml } from '../../shared/utils.js';
import { loi25NoticeHtml } from '../../shared/loi25.js';
import { buildManifest } from './scorm-export.js';

/* global JSZip */

/** Fichiers JS du runtime embarqué (chemins préservés pour que les imports résolvent). */
const RUNTIME_JS = [
  'js/shared/utils.js',
  'js/shared/slide-renderer.js',
  'js/shared/scorm-bridge.js',
  'js/shared/iframe-resize.js',
  'js/core/media-store.js',
  'js/modules/m3-block-editor/block-model.js',
  'js/modules/m4-questions/feedback-model.js',
  'js/modules/m4-questions/runtime.js',
  'js/modules/m4-questions/scoring.js',
  'js/modules/m4-questions/hotspot-editor.js',
  'js/modules/m4-questions/question-types/index.js',
  'js/modules/m4-questions/question-types/multiple-choice.js',
  'js/modules/m4-questions/question-types/matching.js',
  'js/modules/m4-questions/question-types/ddtext.js',
  'js/modules/m4-questions/question-types/ddimage.js',
  'js/modules/m5-navigation/nav-runtime.js',
  'js/modules/m5-navigation/progress-menu.js',
  'js/runtime/export-entry.js',
];

const CSS_FILES = [
  'css/vendor/bootstrap.min.css',
  'css/animations.css',
  'css/export-runtime.css',
];

function embedJson(obj) {
  // Empêche une fermeture prématurée du <script>.
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function buildIndexHtml(project, config = { target: 'scorm12', iframeResize: true }) {
  const title = escapeHtml(project.title || 'Module pédagogique');
  const notice = project.exportSettings && project.exportSettings.loi25Notice ? loi25NoticeHtml() : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="css/vendor/bootstrap.min.css">
  <link rel="stylesheet" href="css/animations.css">
  <link rel="stylesheet" href="css/export-runtime.css">
</head>
<body>
  <main class="container py-3">
    <div id="dc-root"></div>
    ${notice}
  </main>
  <script id="dc-project" type="application/json">${embedJson(project)}</script>
  <script id="dc-config" type="application/json">${embedJson(config)}</script>
  <script type="module" src="js/runtime/export-entry.js"></script>
</body>
</html>`;
}

/** Récupère un fichier source du runtime (relatif à la base de l'app). */
async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fichier introuvable : ${path} (${res.status})`);
  return res.text();
}

/**
 * Construit le paquet.
 * @param {object} project
 * @param {{ target:'scorm12'|'html-simple' }} opts
 * @returns {Promise<{ blob:Blob, fileName:string }>}
 */
export async function buildExportPackage(project, opts) {
  const target = opts.target;
  const config = {
    target,
    iframeResize: !(project.exportSettings && project.exportSettings.iframeResize === false),
    masteryScore: (project.scoring && project.scoring.masteryScore) || null,
  };

  const zip = new JSZip();
  const filePaths = [];

  // 1) Runtime JS + CSS (verbatim, chemins préservés).
  for (const path of [...RUNTIME_JS, ...CSS_FILES]) {
    zip.file(path, await fetchText(path));
    filePaths.push(path);
  }

  // 2) Médias locaux.
  const byId = new Map((project.media || []).map((m) => [m.id, m]));
  const entries = await mediaStore.entries();
  for (const { id, blob } of entries) {
    const d = byId.get(id);
    const name = d ? d.fileName : id;
    const path = `media/${name}`;
    zip.file(path, blob);
    filePaths.push(path);
  }

  // 3) HTML de lancement.
  const indexHtml = buildIndexHtml(project, config);
  zip.file('index.html', indexHtml);
  filePaths.push('index.html');

  // 4) Manifest SCORM.
  if (target === 'scorm12') {
    zip.file('imsmanifest.xml', buildManifest(project, filePaths));
    filePaths.push('imsmanifest.xml');
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const base = (project.title || 'module').replace(/[^\w\-]+/g, '_');
  return { blob, fileName: `${base}_${target === 'scorm12' ? 'SCORM12' : 'HTML'}.zip`, indexHtml };
}

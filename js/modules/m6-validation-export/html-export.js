/**
 * html-export.js — Export HTML simple (sans SCORM) pour Moodle.
 *
 * Même paquet que l'export SCORM mais avec le pont en mode no-op (aucun appel
 * LMS) ; convient à une diffusion HTML hors suivi SCORM. Le resize iframe reste
 * actif si configuré.
 */

import { buildExportPackage } from './export-builder.js';

export function buildHtmlPackage(project) {
  return buildExportPackage(project, { target: 'html-simple' });
}

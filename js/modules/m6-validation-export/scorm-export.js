/**
 * scorm-export.js — Génération du imsmanifest.xml (SCORM 1.2).
 *
 * Le pont d'abstraction (shared/scorm-bridge.js) traduit activityComplete/
 * activityProgress vers cmi.core.* ; ici on décrit le paquet pour le LMS.
 */

import { escapeHtml } from '../../shared/utils.js';

/**
 * @param {object} project
 * @param {string[]} filePaths  tous les fichiers du paquet (href relatifs)
 * @returns {string} contenu imsmanifest.xml
 */
export function buildManifest(project, filePaths) {
  const id = 'DC_' + (project.id || 'module').replace(/[^\w\-]/g, '');
  const title = escapeHtml(project.title || 'Module pédagogique');
  const files = filePaths
    .filter((p) => p !== 'imsmanifest.xml')
    .map((p) => `      <file href="${escapeHtml(p)}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${title}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files}
    </resource>
  </resources>
</manifest>`;
}

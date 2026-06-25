/**
 * metadata-fp.js — Métadonnées de formation professionnelle (FP) Québec.
 *
 * Modèle + helpers pour enrichir le projet de contexte FP (programme,
 * compétence du Programme d'études / FEQ, contextualisation métier). Le
 * formulaire vit dans ui.js mais s'appuie sur ces définitions.
 */

/** Champs du formulaire FP (libellé, chemin dans project.metadataFP, type). */
export const FP_FIELDS = [
  { key: 'programme', label: 'Programme (DEP/ASP/AEP)', type: 'text',
    placeholder: 'ex. DEP Cuisine (5311)', list: 'fp-programmes' },
  { key: 'competenceFEQ.code', label: 'Code de compétence', type: 'text',
    placeholder: 'ex. 5' },
  { key: 'competenceFEQ.enonce', label: 'Énoncé de la compétence', type: 'text',
    placeholder: 'ex. Préparer des fonds, des sauces et des potages' },
  { key: 'contexteMetier', label: 'Contextualisation métier', type: 'textarea',
    placeholder: 'Mise en situation professionnelle authentique…' },
  { key: 'publicCible', label: 'Public cible', type: 'text',
    placeholder: 'ex. Apprenants adultes en FP, première année' },
  { key: 'dureeEstimeeMin', label: 'Durée estimée (min)', type: 'number',
    placeholder: 'ex. 30' },
];

/** Suggestions de programmes (datalist) — liste indicative, non exhaustive. */
export const PROGRAMMES_SUGGERES = [
  'DEP Cuisine', 'DEP Pâtisserie', 'DEP Santé, assistance et soins infirmiers',
  'DEP Électricité', 'DEP Soudage-montage', 'DEP Mécanique automobile',
  'DEP Comptabilité', 'DEP Secrétariat', 'DEP Coiffure', 'DEP Esthétique',
  'DEP Plomberie et chauffage', 'DEP Charpenterie-menuiserie',
  'DEP Soutien informatique', 'DEP Vente-conseil', 'ASP Lancement d’une entreprise',
];

/** Lecture/écriture sûre d'une valeur imbriquée via "a.b". */
export function getField(meta, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), meta);
}
export function setField(meta, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  let cur = meta;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
}

/** Indique si les métadonnées FP minimales sont renseignées. */
export function isFpComplete(meta) {
  return Boolean(
    meta &&
    meta.programme &&
    meta.competenceFEQ &&
    meta.competenceFEQ.enonce &&
    meta.contexteMetier
  );
}

/** Résumé lisible des métadonnées FP, injecté dans les prompts. */
export function buildMetadataSummary(meta) {
  if (!meta) return '(métadonnées FP non renseignées)';
  const c = meta.competenceFEQ || {};
  const lines = [
    `- Programme : ${meta.programme || '(non précisé)'}`,
    `- Compétence visée : ${[c.code, c.enonce].filter(Boolean).join(' — ') || '(non précisée)'}`,
    `- Contexte métier : ${meta.contexteMetier || '(non précisé)'}`,
    `- Public cible : ${meta.publicCible || '(non précisé)'}`,
    `- Durée estimée : ${meta.dureeEstimeeMin ? meta.dureeEstimeeMin + ' min' : '(non précisée)'}`,
  ];
  return lines.join('\n');
}

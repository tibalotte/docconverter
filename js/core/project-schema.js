/**
 * project-schema.js — Schéma du JSON enrichi (état central).
 *
 * Référence : docs/schema-json-enrichi.md. Fournit la fabrique d'un projet
 * vide, une validation légère et le registre de migrations versionnées.
 */

export const SCHEMA_VERSION = '1.0';

/** Génère un identifiant unique (uuid v4 si dispo, fallback sinon). */
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Crée un projet vierge conforme au schéma. */
export function createEmptyProject() {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uuid(),
    title: 'Module sans titre',
    metadataFP: {
      programme: '',
      competenceFEQ: { code: '', enonce: '' },
      contexteMetier: '',
      publicCible: '',
      dureeEstimeeMin: 0,
    },
    source: null,
    slides: [],
    media: [],
    navigation: { mode: 'progress-menu', showPrevNext: true, showProgressBar: true },
    scoring: { maxScore: 100, aggregation: 'weighted', reportOn: 'activityComplete' },
    exportSettings: { target: 'scorm12', iframeResize: true, loi25Notice: true },
  };
}

const LAYOUTS = ['one-column', 'two-column', 'three-column'];

/**
 * Validation légère : renvoie { ok, errors }. Non bloquante côté UI, sert
 * surtout au module 6 et à l'import.
 */
export function validateProject(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return { ok: false, errors: ['projet absent ou invalide'] };
  if (!p.schemaVersion) errors.push('schemaVersion manquant');
  if (!Array.isArray(p.slides)) errors.push('slides doit être un tableau');
  if (!Array.isArray(p.media)) errors.push('media doit être un tableau');
  (p.slides || []).forEach((s, i) => {
    if (!s.id) errors.push(`slide #${i} sans id`);
    if (s.layout && !LAYOUTS.includes(s.layout)) {
      errors.push(`slide ${s.id || i} : layout inconnu "${s.layout}"`);
    }
  });
  return { ok: errors.length === 0, errors };
}

/**
 * Registre de migrations. Clé = version de départ → fonction qui renvoie le
 * projet migré vers la version suivante. Appliqué en chaîne au chargement.
 * @type {Record<string, (p: object) => object>}
 */
export const MIGRATIONS = {
  // '1.0': (p) => ({ ...p, schemaVersion: '1.1', /* … */ }),
};

/** Applique les migrations en chaîne jusqu'à SCHEMA_VERSION. */
export function migrateProject(p) {
  let cur = p;
  let guard = 0;
  while (cur.schemaVersion !== SCHEMA_VERSION && MIGRATIONS[cur.schemaVersion]) {
    cur = MIGRATIONS[cur.schemaVersion](cur);
    if (++guard > 50) throw new Error('Boucle de migration détectée');
  }
  return cur;
}

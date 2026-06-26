/**
 * block-model.js — Modèle de blocs et opérations d'édition (pures).
 *
 * Un bloc : { id, type, column (1..n), order, animation, content }.
 * (cf. docs/schema-json-enrichi.md §4.1). L'éditeur n'est pas un WYSIWYG libre :
 * il manipule cette structure de blocs par colonnes.
 */

let _seq = 0;
export function newBlockId() { return `b-${Date.now().toString(36)}-${++_seq}`; }

export const LAYOUTS = [
  { value: 'one-column', label: '1 colonne', cols: 1 },
  { value: 'two-column', label: '2 colonnes', cols: 2 },
  { value: 'three-column', label: '3 colonnes', cols: 3 },
];

export function layoutCols(layout) {
  return (LAYOUTS.find((l) => l.value === layout) || LAYOUTS[0]).cols;
}

export const BLOCK_TYPES = [
  { value: 'text', label: 'Texte', addable: true },
  { value: 'callout', label: 'Encadré', addable: true },
  { value: 'image', label: 'Image', addable: false },
  { value: 'rasterized', label: 'Forme (PNG)', addable: false },
  { value: 'table', label: 'Tableau', addable: false },
  { value: 'media', label: 'Audio/Vidéo', addable: false },
  { value: 'audio', label: 'Audio synchronisé', addable: false },
  { value: 'question', label: 'Question', addable: false },
];

export const ANIMATIONS = [
  { value: 'none', label: 'Aucune' },
  { value: 'fade-in', label: 'Apparition (fondu)' },
  { value: 'slide-up', label: 'Glissé vers le haut' },
  { value: 'slide-left', label: 'Glissé latéral' },
  { value: 'zoom-in', label: 'Zoom avant' },
];

export const CALLOUT_VARIANTS = [
  { value: 'info', label: 'Information' },
  { value: 'warning', label: 'Attention' },
  { value: 'tip', label: 'Astuce' },
];

/** Crée un bloc neuf d'un type donné dans une colonne. */
export function createBlock(type, column = 1) {
  const base = { id: newBlockId(), type, column, order: 0, animation: 'none', content: {} };
  if (type === 'text') base.content = { html: '<p>Nouveau texte…</p>' };
  else if (type === 'callout') base.content = { variant: 'info', html: 'Encadré pédagogique…' };
  else base.content = {};
  return base;
}

/** Regroupe les blocs par colonne (1..cols), triés par order. */
export function blocksByColumn(blocks, cols) {
  const out = Array.from({ length: cols }, () => []);
  for (const b of blocks) {
    const c = Math.min(Math.max(b.column || 1, 1), cols) - 1;
    out[c].push(b);
  }
  out.forEach((col) => col.sort((a, b) => (a.order || 0) - (b.order || 0)));
  return out;
}

/** Réassigne order séquentiellement par colonne (à appeler après mutation). */
export function normalizeOrders(blocks, cols) {
  const byCol = blocksByColumn(blocks, cols);
  byCol.forEach((col) => col.forEach((b, i) => { b.order = i; }));
}

/** Déplace un bloc vers le haut/bas dans sa colonne. dir ∈ {-1,+1}. */
export function moveWithinColumn(blocks, cols, blockId, dir) {
  const b = blocks.find((x) => x.id === blockId);
  if (!b) return;
  const col = blocksByColumn(blocks, cols)[b.column - 1];
  const i = col.findIndex((x) => x.id === blockId);
  const j = i + dir;
  if (j < 0 || j >= col.length) return;
  const tmp = col[i].order;
  col[i].order = col[j].order;
  col[j].order = tmp;
}

/** Change la colonne d'un bloc (placé en fin de colonne cible). */
export function moveToColumn(blocks, cols, blockId, targetCol) {
  const b = blocks.find((x) => x.id === blockId);
  if (!b || targetCol < 1 || targetCol > cols) return;
  b.column = targetCol;
  const col = blocksByColumn(blocks, cols)[targetCol - 1];
  b.order = col.length; // fin de colonne
  normalizeOrders(blocks, cols);
}

export function removeBlock(blocks, blockId) {
  const i = blocks.findIndex((x) => x.id === blockId);
  if (i >= 0) blocks.splice(i, 1);
}

/** Ajoute un bloc en fin de colonne. */
export function addBlockToSlide(slide, type, column, cols) {
  const block = createBlock(type, column);
  const col = blocksByColumn(slide.blocks, cols)[column - 1];
  block.order = col.length;
  slide.blocks.push(block);
  return block;
}

/** Recadre les colonnes après réduction de layout (ramène le surplus en 1). */
export function clampColumns(slide, cols) {
  for (const b of slide.blocks) {
    if ((b.column || 1) > cols) b.column = cols;
  }
  normalizeOrders(slide.blocks, cols);
}

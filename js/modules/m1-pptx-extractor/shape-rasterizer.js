/**
 * shape-rasterizer.js — Formes et groupes de formes PPTX → PNG (canvas).
 *
 * Rendu STATIQUE best-effort (docs/ARCHITECTURE.md §9) : géométries usuelles
 * (rectangle, arrondi, ellipse, triangle), remplissage uni, bordure et texte.
 * Les animations, dégradés complexes, effets et SmartArt ne sont pas reproduits.
 *
 * Les coordonnées PPTX sont en EMU (914400/pouce → 9525 EMU/px à 96 ppp).
 */

const EMU_PER_PX = 9525;
const MAX_DIM = 2000; // garde-fou mémoire pour des formes démesurées

function emuToPx(emu) {
  return Math.max(1, Math.round(emu / EMU_PER_PX));
}

/** Dessine la géométrie d'une forme dans le rectangle px donné. */
function drawGeometry(ctx, shape, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  switch (shape.geom) {
    case 'ellipse':
    case 'oval':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'roundRect': {
      const r = Math.min(w, h) * 0.12;
      roundedRect(ctx, x, y, w, h, r);
      break;
    }
    case 'triangle':
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    default:
      ctx.rect(x, y, w, h);
  }
  if (shape.fill) {
    ctx.fillStyle = shape.fill;
    ctx.fill();
  }
  if (shape.line) {
    ctx.strokeStyle = shape.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (!shape.fill) {
    // Sans fond ni bordure explicites, on trace un contour léger pour visibilité.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dessine le texte d'une forme, centré et passé à la ligne grossièrement. */
function drawText(ctx, text, x, y, w, h) {
  if (!text) return;
  ctx.save();
  const fontPx = Math.max(11, Math.min(20, Math.round(h * 0.18)));
  ctx.font = `${fontPx}px system-ui, Arial, sans-serif`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = text.replace(/\n/g, ' \n ').split(/\s+/);
  const lines = [];
  let line = '';
  for (const wd of words) {
    if (wd === '\n') { lines.push(line); line = ''; continue; }
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > w - 8 && line) {
      lines.push(line);
      line = wd;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineH = fontPx * 1.25;
  const totalH = lines.length * lineH;
  let cy = y + h / 2 - totalH / 2 + lineH / 2;
  for (const l of lines) {
    ctx.fillText(l, x + w / 2, cy);
    cy += lineH;
  }
  ctx.restore();
}

/**
 * Calcule l'échelle (px) et l'origine pour rendre une forme/groupe dans un
 * canvas dédié, avec garde-fou MAX_DIM.
 */
function computeScale(bbox) {
  let w = emuToPx(bbox.cx);
  let h = emuToPx(bbox.cy);
  let scale = 1;
  if (w > MAX_DIM || h > MAX_DIM) {
    scale = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  return { w, h, scale };
}

/** Rend les enfants d'un groupe en respectant le repère enfant (chOff/chExt). */
function renderGroupChildren(ctx, group, scale) {
  const sx = group.bbox.chCx ? group.bbox.cx / group.bbox.chCx : 1;
  const sy = group.bbox.chCy ? group.bbox.cy / group.bbox.chCy : 1;
  for (const ch of group.children) {
    if (!ch.bbox) continue;
    // Position de l'enfant dans le repère local du groupe, en px.
    const localX = (ch.bbox.x - group.bbox.chX) * sx;
    const localY = (ch.bbox.y - group.bbox.chY) * sy;
    const x = emuToPx(localX) * scale;
    const y = emuToPx(localY) * scale;
    const w = emuToPx(ch.bbox.cx * sx) * scale;
    const h = emuToPx(ch.bbox.cy * sy) * scale;
    if (ch.kind === 'group') {
      ctx.save();
      ctx.translate(x, y);
      renderGroupChildren(ctx, ch, scale);
      ctx.restore();
    } else if (ch.kind === 'sp') {
      drawGeometry(ctx, ch, x, y, w, h);
      drawText(ctx, ch.text, x, y, w, h);
    } else if (ch.kind === 'table' || ch.kind === 'pic') {
      // Représentation simplifiée : cadre marqueur (le contenu réel est extrait
      // ailleurs ; ici on préserve la composition visuelle du groupe).
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }
}

/** Rend une forme simple en canvas. */
export function rasterizeShape(shape) {
  if (!shape.bbox) return null;
  const { w, h } = computeScale(shape.bbox);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawGeometry(ctx, shape, 0, 0, w, h);
  drawText(ctx, shape.text, 0, 0, w, h);
  return canvas;
}

/** Rend un groupe de formes en canvas. */
export function rasterizeGroup(group) {
  if (!group.bbox) return null;
  const { w, h, scale } = computeScale(group.bbox);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  renderGroupChildren(ctx, group, scale);
  return canvas;
}

/** Canvas → Blob PNG. */
export function canvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * hotspot-editor.js — Éditeur visuel de zones (hotspots) sur une image.
 *
 * Utilisé par le type ddimage (glisser-déposer sur image). Permet de tracer des
 * rectangles à la souris sur l'image de fond ; les coordonnées sont stockées en
 * POURCENTAGES (0–100) pour rester valables quelle que soit la taille d'affichage.
 */

import { mediaStore } from '../../core/media-store.js';
import { escapeHtml } from '../../shared/utils.js';

let _seq = 0;
const zid = () => `z-${Date.now().toString(36)}-${++_seq}`;

/**
 * Monte l'éditeur de zones.
 * @param {HTMLElement} host
 * @param {{ mediaRef:string, zones:Array, onChange:(zones)=>void }} cfg
 */
export async function mountHotspotEditor(host, cfg) {
  host.innerHTML = '';
  const url = cfg.mediaRef ? await mediaStore.getUrl(cfg.mediaRef) : null;
  if (!url) {
    host.innerHTML = '<div class="alert alert-warning py-2 mb-0">Aucune image de fond. Choisis un média rastérisé/image pour cette question.</div>';
    return;
  }

  const stage = document.createElement('div');
  stage.className = 'dc-hotspot-stage position-relative d-inline-block border';
  stage.style.cssText = 'max-width:100%;touch-action:none;user-select:none';
  stage.innerHTML = `<img src="${url}" style="display:block;max-width:100%" draggable="false">`;
  host.appendChild(stage);

  const hint = document.createElement('div');
  hint.className = 'small text-muted mt-1';
  hint.textContent = 'Trace un rectangle sur l’image pour créer une zone de dépôt.';
  host.appendChild(hint);

  function pct(px, total) { return Math.max(0, Math.min(100, (px / total) * 100)); }

  function renderZones() {
    stage.querySelectorAll('.dc-zone').forEach((z) => z.remove());
    cfg.zones.forEach((z, i) => {
      const box = document.createElement('div');
      box.className = 'dc-zone position-absolute border border-primary';
      box.style.cssText = `left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;background:rgba(13,110,253,.15)`;
      box.innerHTML = `<span class="badge text-bg-primary position-absolute top-0 start-0">${i + 1}</span>
        <button class="btn btn-sm btn-danger position-absolute top-0 end-0 py-0 px-1" data-del="${z.id}" style="line-height:1">✕</button>`;
      box.querySelector('[data-del]').addEventListener('click', (e) => {
        e.stopPropagation();
        cfg.zones = cfg.zones.filter((x) => x.id !== z.id);
        cfg.onChange(cfg.zones);
        renderZones();
      });
      stage.appendChild(box);
    });
  }

  // Tracé d'une nouvelle zone.
  let start = null, ghost = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.dc-zone')) return; // édition existante
    const r = stage.getBoundingClientRect();
    start = { x: e.clientX - r.left, y: e.clientY - r.top, rect: r };
    ghost = document.createElement('div');
    ghost.className = 'position-absolute border border-success';
    ghost.style.cssText = 'background:rgba(25,135,84,.2)';
    stage.appendChild(ghost);
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!start) return;
    const r = start.rect;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const left = Math.min(start.x, x), top = Math.min(start.y, y);
    const w = Math.abs(x - start.x), h = Math.abs(y - start.y);
    ghost.style.cssText += `;left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
  });
  stage.addEventListener('pointerup', (e) => {
    if (!start) return;
    const r = start.rect;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const left = Math.min(start.x, x), top = Math.min(start.y, y);
    const w = Math.abs(x - start.x), h = Math.abs(y - start.y);
    if (ghost) ghost.remove();
    ghost = null;
    if (w > 8 && h > 8) {
      cfg.zones.push({
        id: zid(), label: '',
        x: +pct(left, r.width).toFixed(2), y: +pct(top, r.height).toFixed(2),
        w: +pct(w, r.width).toFixed(2), h: +pct(h, r.height).toFixed(2),
      });
      cfg.onChange(cfg.zones);
      renderZones();
    }
    start = null;
  });

  renderZones();
}

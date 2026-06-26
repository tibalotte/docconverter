/**
 * progress-menu.js — Menu de progression basé sur les titres des diapositives.
 *
 * Liste cliquable des titres avec mise en évidence de l'étape courante et
 * marquage des étapes visitées.
 */

import { escapeHtml } from '../../shared/utils.js';

/**
 * @param {Array} slides
 * @param {number} current  index courant
 * @param {Set<number>} visited  indices visités
 * @param {(index:number)=>void} onSelect
 * @returns {HTMLElement}
 */
export function buildProgressMenu(slides, current, visited, onSelect) {
  const nav = document.createElement('nav');
  nav.className = 'dc-progress-menu list-group';
  nav.setAttribute('aria-label', 'Progression du module');
  slides.forEach((s, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'list-group-item list-group-item-action d-flex align-items-center gap-2'
      + (i === current ? ' active' : '');
    const state = i === current ? '▸' : visited.has(i) ? '✓' : '○';
    item.innerHTML = `<span class="dc-menu-state">${state}</span>
      <span class="text-truncate">${escapeHtml(s.title || 'Diapositive ' + (i + 1))}</span>`;
    item.addEventListener('click', () => onSelect(i));
    nav.appendChild(item);
  });
  return nav;
}

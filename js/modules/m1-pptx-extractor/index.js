/**
 * index.js — Module 1 : Extracteur PPTX (orchestrateur + contrat de module).
 *
 * Relie lecture (pptx-reader), analyse (slide-parser), rastérisation
 * (shape-rasterizer) et médias (media-extractor). Traite SLIDE PAR SLIDE en
 * rendant la main au navigateur entre chaque, puis écrit dans le store et émet
 * les événements du pipeline (docs/ARCHITECTURE.md §4.2, §5).
 */

import { bus } from '../../core/event-bus.js';
import { store } from '../../core/state-store.js';
import { escapeHtml, yieldToBrowser } from '../../shared/utils.js';
import { PptxReader } from './pptx-reader.js';
import { parseSlide } from './slide-parser.js';
import { rasterizeShape, rasterizeGroup, canvasToPngBlob } from './shape-rasterizer.js';
import { MediaCollector, buildMediaZip } from './media-extractor.js';
import { mountUi } from './ui.js';

let _blockSeq = 0;
function blockId() { return `b-${++_blockSeq}`; }

const AUDIO_EXT = new Set(['mp3', 'm4a', 'wav', 'wma', 'aac', 'ogg', 'oga']);
const VIDEO_EXT = new Set(['mp4', 'mov', 'avi', 'wmv', 'm4v', 'webm']);

/** Paragraphes parsés → HTML Bootstrap simple et sûr. */
function paragraphsToHtml(paragraphs) {
  const nonEmpty = paragraphs.filter((p) => p.text.trim());
  if (!nonEmpty.length) return '';
  const looksLikeList = nonEmpty.length > 1 || nonEmpty.some((p) => p.level > 0);
  if (looksLikeList) {
    const items = nonEmpty
      .map((p) => `<li>${escapeHtml(p.text).replace(/\n/g, '<br>')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  }
  return `<p>${escapeHtml(nonEmpty[0].text).replace(/\n/g, '<br>')}</p>`;
}

/**
 * Lance l'extraction d'un fichier .pptx.
 * @param {File|Blob} file
 * @param {{ onProgress?: (info:{index:number,total:number,title:string})=>void }} opts
 * @returns {Promise<{ slides:number, media:number, mediaDescriptors:object[] }>}
 */
export async function extractPptx(file, { onProgress } = {}) {
  const reader = new PptxReader();
  const total = await reader.load(file);
  const slideSize = reader.slideSize;
  const collector = new MediaCollector();
  const slides = [];

  let index = 0;
  for await (const ctx of reader.slides()) {
    const parsed = parseSlide(ctx.xml, slideSize);
    const blocks = [];
    let order = 0;
    const rasterizedShapes = [];

    // 1) Textes (hors titre, déjà capté dans parsed.title).
    for (const tb of parsed.textBlocks) {
      if (tb.ph === 'title' || tb.ph === 'ctrTitle') continue;
      const html = paragraphsToHtml(tb.paragraphs);
      if (!html) continue;
      blocks.push({ id: blockId(), type: 'text', column: 1, order: order++, animation: 'none', content: { html } });
    }

    // 2) Tableaux.
    for (const tbl of parsed.tables) {
      blocks.push({
        id: blockId(), type: 'table', column: 1, order: order++, animation: 'none',
        content: { rows: tbl.rows, header: true },
      });
    }

    // 3) Images.
    for (const pic of parsed.pictures) {
      const blob = await ctx.getMediaBlob(pic.rId);
      const mediaId = await collector.addExtracted(blob, ctx.getMediaName(pic.rId));
      if (mediaId) {
        blocks.push({
          id: blockId(), type: 'image', column: 1, order: order++, animation: 'none',
          content: { mediaRef: mediaId, alt: pic.name || '', keep: true },
        });
      }
    }

    // 4) Autoshapes → PNG rastérisé.
    for (const sp of parsed.shapes) {
      const canvas = rasterizeShape(sp);
      if (!canvas) continue;
      const blob = await canvasToPngBlob(canvas);
      const mediaId = await collector.addRasterized(blob, sp.text ? sp.text.slice(0, 40) : 'forme');
      if (mediaId) {
        rasterizedShapes.push({ mediaRef: mediaId, origin: 'shape', bbox: bboxPx(sp.bbox), keep: true });
        blocks.push({
          id: blockId(), type: 'rasterized', column: 1, order: order++, animation: 'none',
          content: { mediaRef: mediaId, alt: sp.text || 'forme', keep: true },
        });
      }
    }

    // 5) Groupes de formes → PNG rastérisé (composite).
    for (const grp of parsed.groups) {
      const canvas = rasterizeGroup(grp);
      if (!canvas) continue;
      const blob = await canvasToPngBlob(canvas);
      const mediaId = await collector.addRasterized(blob, 'groupe');
      if (mediaId) {
        rasterizedShapes.push({ mediaRef: mediaId, origin: 'shape-group', bbox: bboxPx(grp.bbox), keep: true });
        blocks.push({
          id: blockId(), type: 'rasterized', column: 1, order: order++, animation: 'none',
          content: { mediaRef: mediaId, alt: 'groupe de formes', keep: true },
        });
      }
    }

    // 6) Audio (et vidéo) de la diapositive, via les relations de la slide.
    //    « un audio par diapositive » : on rattache un bloc « audio synchronisé »
    //    pré-rempli avec les notes du présentateur comme transcription candidate.
    const seenRel = new Set();
    for (const [rId, rel] of ctx.rels) {
      if (rel.external || seenRel.has(rId)) continue;
      const isAudioVideo = /\/(audio|video|media)$/.test(rel.type || '');
      if (!isAudioVideo) continue;
      const ext = (rel.target.split('.').pop() || '').toLowerCase();
      const kind = AUDIO_EXT.has(ext) ? 'audio' : VIDEO_EXT.has(ext) ? 'video' : null;
      if (!kind) continue; // ignore les médias non audio/vidéo (ex. icône)
      seenRel.add(rId);
      const blob = await ctx.getMediaBlob(rId);
      const mediaId = await collector.addExtracted(blob, ctx.getMediaName(rId));
      if (!mediaId) continue;
      if (kind === 'audio') {
        blocks.push({
          id: blockId(), type: 'audio', column: 1, order: order++, animation: 'none',
          content: {
            mediaRef: mediaId,
            transcript: ctx.notes || '',   // candidat : notes du présentateur
            phrases: [], chapters: [], checkpoints: [], autoTiming: true,
          },
        });
      } else {
        blocks.push({
          id: blockId(), type: 'media', column: 1, order: order++, animation: 'none',
          content: { mediaRef: mediaId, kind: 'video', controls: true },
        });
      }
    }

    const title = parsed.title || `Diapositive ${index + 1}`;
    slides.push({
      id: `slide-${index + 1}`,
      index,
      title,
      notes: ctx.notes || '',
      layout: 'one-column',
      blocks,
      questions: [],
      rasterizedShapes,
      stepId: `step-${index + 1}`,
    });

    index++;
    if (onProgress) onProgress({ index, total, title });
    bus.emit('pptx:slide-extracted', { index, total, title });

    // Rend la main : UI fluide + libération mémoire entre slides.
    await yieldToBrowser();
  }

  reader.dispose();

  // Écriture dans l'état central (source de vérité).
  store.mutate((p) => {
    p.source = {
      type: 'pptx',
      fileName: file.name || 'presentation.pptx',
      slideCount: slides.length,
      extractedAt: new Date().toISOString(),
    };
    p.slides = slides;
    p.media = collector.descriptors;
    if ((!p.title || p.title === 'Module sans titre') && slides[0]) {
      p.title = slides[0].title;
    }
  });

  bus.emit('pptx:extraction-complete', { slides: slides.length, media: collector.descriptors.length });
  return { slides: slides.length, media: collector.descriptors.length, mediaDescriptors: collector.descriptors };
}

function bboxPx(bbox) {
  if (!bbox) return { x: 0, y: 0, w: 0, h: 0 };
  const px = (emu) => Math.round(emu / 9525);
  return { x: px(bbox.x), y: px(bbox.y), w: px(bbox.cx), h: px(bbox.cy) };
}

/** Télécharge le .zip de tous les médias extraits. */
export async function downloadMediaZip() {
  const descriptors = store.getProject().media || [];
  const blob = await buildMediaZip(descriptors);
  const { downloadBlob } = await import('../../core/persistence.js');
  downloadBlob(blob, 'medias-pptx.zip');
}

/** Contrat de module pour la coquille (app-shell). */
export const module1 = {
  id: 'm1',
  label: '1 · Extracteur PPTX',
  order: 1,
  enabled: () => true,
  mount(container) {
    mountUi(container, { extractPptx, downloadMediaZip });
  },
  unmount() {
    // L'UI gère elle-même la révocation de ses ObjectURL de prévisualisation.
  },
};

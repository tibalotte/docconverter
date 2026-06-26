/**
 * transcript-importer.js — Importation d'un bundle « transcript audio ».
 *
 * Le bundle (.zip) est produit hors navigateur par tools/audio_to_transcript.py
 * (transcription Whisper + reformulation LLM + TTS + image). Il contient :
 *   transcript.json  { schema, language, slides:[{ index, stepId, title,
 *                      transcript, phrases, keywords, audioFile, image, imageAlt }] }
 *   media/…          fichiers audio (TTS) et images.
 *
 * On enregistre les médias dans IndexedDB et on remplit, par diapositive, le
 * bloc « audio » (transcription, phrases minutées, mots-clés, image, audio TTS).
 */

import { store } from '../../core/state-store.js';
import { mediaStore } from '../../core/media-store.js';

/* global JSZip */

const EXT_MIME = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
};
function mimeOf(name) { return EXT_MIME[(name.split('.').pop() || '').toLowerCase()] || 'application/octet-stream'; }
function kindOf(mime) { return mime.startsWith('audio') ? 'audio' : mime.startsWith('video') ? 'video' : 'image'; }

/**
 * @param {File|Blob} file  bundle .zip
 * @returns {Promise<{ updated:number, audios:number, images:number, missing:number, error?:string }>}
 */
export async function importTranscriptBundle(file) {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('transcript.json');
  if (!manifestFile) return { updated: 0, audios: 0, images: 0, missing: 0, error: 'transcript.json introuvable dans le .zip.' };

  const manifest = JSON.parse(await manifestFile.async('string'));
  const entries = manifest.slides || [];
  if (!entries.length) return { updated: 0, audios: 0, images: 0, missing: 0, error: 'Aucune diapositive dans transcript.json.' };

  // Compteur d'id média (suite des id existants).
  let seq = (store.getProject().media || []).length;
  const newMedia = [];

  // Enregistre un fichier du bundle dans le media-store, renvoie l'id média.
  async function register(relPath) {
    if (!relPath) return null;
    const f = zip.file(relPath);
    if (!f) return null;
    const blob = await f.async('blob');
    const fileName = relPath.split('/').pop();
    const mime = mimeOf(fileName);
    const id = `media-t${++seq}`;
    await mediaStore.put(id, blob);
    newMedia.push({ id, type: kindOf(mime), mime, fileName: id + '.' + (fileName.split('.').pop() || 'bin'),
      storage: 'indexeddb', fromShape: false, originalName: fileName });
    return id;
  }

  let updated = 0, audios = 0, images = 0, missing = 0;

  // On collecte les mutations hors store.mutate (register est async), puis on applique.
  const ops = [];
  for (const e of entries) {
    const audioId = e.audioFile ? await register(e.audioFile) : null;
    const imageId = e.image ? await register(e.image) : null;
    if (audioId) audios++;
    if (imageId) images++;
    ops.push({ entry: e, audioId, imageId });
  }

  store.mutate((p) => {
    p.media = (p.media || []).concat(newMedia);
    for (const { entry, audioId, imageId } of ops) {
      const slide = p.slides.find((s) => s.stepId === entry.stepId)
        || p.slides[entry.index];
      if (!slide) { missing++; continue; }

      // Trouve (ou crée) le bloc audio de la diapositive.
      let block = (slide.blocks || []).find((b) => b.type === 'audio');
      if (!block) {
        block = { id: 'b-audio-' + slide.id, type: 'audio', column: 1,
          order: (slide.blocks || []).length, animation: 'none', content: {} };
        slide.blocks.push(block);
      }
      const c = block.content || (block.content = {});
      if (audioId) c.mediaRef = audioId;          // remplace l'audio par la narration TTS
      c.transcript = entry.transcript || c.transcript || '';
      c.phrases = Array.isArray(entry.phrases) ? entry.phrases : (c.phrases || []);
      c.keywords = Array.isArray(entry.keywords) ? entry.keywords.slice(0, 3) : (c.keywords || []);
      c.autoTiming = !(c.phrases && c.phrases.length);
      if (imageId) { c.imageRef = imageId; c.imageAlt = entry.imageAlt || ''; }
      if (entry.title && (!slide.title || /^Diapositive\s/i.test(slide.title))) slide.title = entry.title;
      updated++;
    }
  }, 'slides');

  return { updated, audios, images, missing };
}

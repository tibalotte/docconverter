/**
 * audio-player.js — Lecteur audio à ÉCOUTE ACTIVE (aperçu + export).
 *
 * Rend un audio de diapositive de façon engageante :
 *  - transcription synchronisée (la phrase courante se surligne ; clic = saut)
 *  - chapitres navigables (contrôle du rythme — segmenting de Mayer)
 *  - points de contrôle : pause de l'audio + question (Module 4) avant de continuer
 *  - contrôle de vitesse
 *
 * 100 % côté client : HTML5 <audio> + timeupdate. Le minutage vient des phrases
 * pré-calculées (Whisper) ou est estimé proportionnellement à la durée réelle.
 */

import { escapeHtml } from './utils.js';
import { phrasesFromText, activePhraseIndex } from './audio-transcript.js';

const SPEEDS = [0.75, 1, 1.25, 1.5];

export async function renderAudioPlayer(block, slide, host, opts = {}) {
  const c = block.content || {};
  const url = opts.resolveMediaUrl ? await opts.resolveMediaUrl(c.mediaRef) : null;

  const imgUrl = c.imageRef && opts.resolveMediaUrl ? await opts.resolveMediaUrl(c.imageRef) : null;
  const keywords = Array.isArray(c.keywords) ? c.keywords.filter(Boolean) : [];

  host.classList.add('dc-audio');
  host.innerHTML = `
    ${url ? '' : '<div class="alert alert-warning py-2">Audio introuvable.</div>'}
    ${imgUrl || keywords.length ? `
      <div class="dc-audio-head row g-3 align-items-center mb-2">
        ${imgUrl ? `<div class="col-sm-4"><img class="img-fluid rounded" alt="${escapeHtml(c.imageAlt || '')}" src="${imgUrl}"></div>` : ''}
        ${keywords.length ? `<div class="col"><div class="dc-audio-keywords d-flex flex-wrap gap-2">
          ${keywords.map((k) => `<span class="badge text-bg-primary fs-6">${escapeHtml(k)}</span>`).join('')}
        </div></div>` : ''}
      </div>` : ''}
    <div class="dc-audio-bar d-flex align-items-center gap-2 mb-2">
      <audio class="flex-grow-1" controls ${url ? `src="${url}"` : ''} preload="metadata"></audio>
      <div class="btn-group btn-group-sm dc-audio-speed" role="group" aria-label="Vitesse"></div>
    </div>
    <div class="row g-2">
      <div class="col-md-4 dc-audio-chapters" data-role="chapters"></div>
      <div class="col-md-8">
        <div class="dc-audio-transcript border rounded p-2" data-role="transcript" style="max-height:240px;overflow:auto"></div>
      </div>
    </div>
    <div class="dc-audio-checkpoint mt-2" data-role="checkpoint" hidden></div>`;

  const audio = host.querySelector('audio');
  const speedBox = host.querySelector('.dc-audio-speed');
  const chaptersEl = host.querySelector('[data-role="chapters"]');
  const transcriptEl = host.querySelector('[data-role="transcript"]');
  const checkpointEl = host.querySelector('[data-role="checkpoint"]');

  // Vitesse de lecture.
  SPEEDS.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-outline-secondary' + (s === 1 ? ' active' : '');
    b.textContent = s + '×';
    b.addEventListener('click', () => {
      audio.playbackRate = s;
      speedBox.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    });
    speedBox.appendChild(b);
  });

  // Phrases : pré-calculées sinon estimées à partir de la durée réelle.
  let phrases = Array.isArray(c.phrases) && c.phrases.length ? c.phrases.slice() : null;
  const buildIfNeeded = () => {
    if (!phrases && c.transcript) {
      const durMs = (audio.duration && isFinite(audio.duration)) ? Math.round(audio.duration * 1000) : 0;
      phrases = phrasesFromText(c.transcript, durMs);
    }
    renderTranscript();
  };

  function renderTranscript() {
    transcriptEl.innerHTML = '';
    if (!phrases || !phrases.length) {
      transcriptEl.innerHTML = c.transcript
        ? `<p class="mb-0">${escapeHtml(c.transcript)}</p>`
        : '<p class="text-muted small mb-0">Aucune transcription.</p>';
      return;
    }
    phrases.forEach((p, i) => {
      const span = document.createElement('span');
      span.className = 'dc-phrase';
      span.dataset.i = String(i);
      span.textContent = p.text + ' ';
      span.addEventListener('click', () => { audio.currentTime = (p.start_ms || 0) / 1000; audio.play(); });
      transcriptEl.appendChild(span);
    });
  }

  // Chapitres.
  const chapters = Array.isArray(c.chapters) ? c.chapters : [];
  if (chapters.length) {
    const list = document.createElement('div');
    list.className = 'list-group list-group-flush';
    chapters.forEach((ch, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'list-group-item list-group-item-action py-1 px-2 small';
      b.innerHTML = `<span class="badge text-bg-light border me-1">${i + 1}</span>${escapeHtml(ch.title || 'Section ' + (i + 1))}`;
      b.addEventListener('click', () => { audio.currentTime = (ch.start_ms || 0) / 1000; audio.play(); });
      list.appendChild(b);
    });
    chaptersEl.appendChild(list);
  } else {
    chaptersEl.innerHTML = '<p class="text-muted small mb-0">Pas de chapitres.</p>';
  }

  // Points de contrôle (pause + question).
  const checkpoints = (Array.isArray(c.checkpoints) ? c.checkpoints : [])
    .slice().sort((a, b) => (a.at_ms || 0) - (b.at_ms || 0));
  const triggered = new Set();

  async function fireCheckpoint(cp) {
    audio.pause();
    const q = (slide.questions || []).find((x) => x.id === cp.questionRef);
    checkpointEl.hidden = false;
    checkpointEl.innerHTML = '<div class="alert alert-info py-1 px-2 small mb-2">⏸️ Point de contrôle — réponds pour continuer.</div>';
    const qHost = document.createElement('div');
    checkpointEl.appendChild(qHost);
    if (q && opts.renderQuestion) {
      await opts.renderQuestion(q, qHost, { onScore: opts.onScore, resolveMediaUrl: opts.resolveMediaUrl });
    }
    const cont = document.createElement('button');
    cont.className = 'btn btn-sm btn-primary mt-2';
    cont.textContent = 'Continuer ▶';
    cont.addEventListener('click', () => { checkpointEl.hidden = true; checkpointEl.innerHTML = ''; audio.play(); });
    checkpointEl.appendChild(cont);
  }

  audio.addEventListener('loadedmetadata', buildIfNeeded);
  audio.addEventListener('timeupdate', () => {
    const ms = audio.currentTime * 1000;
    // Surlignage de la phrase active.
    if (phrases && phrases.length) {
      const idx = activePhraseIndex(phrases, ms);
      transcriptEl.querySelectorAll('.dc-phrase.active').forEach((s) => s.classList.remove('active'));
      const cur = transcriptEl.querySelector(`.dc-phrase[data-i="${idx}"]`);
      if (cur) {
        cur.classList.add('active');
        if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
      }
    }
    // Déclenchement des points de contrôle.
    for (const cp of checkpoints) {
      if (!triggered.has(cp) && ms >= (cp.at_ms || 0)) {
        triggered.add(cp);
        fireCheckpoint(cp);
        break;
      }
    }
  });

  // Si la durée est déjà connue (cache), construire tout de suite.
  if (audio.readyState >= 1) buildIfNeeded(); else renderTranscript();
}

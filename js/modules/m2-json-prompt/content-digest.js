/**
 * content-digest.js — Sérialise le contenu extrait (project.slides) en texte
 * lisible, injecté dans le prompt Phase 1.
 *
 * On transmet au LLM le contenu pédagogique brut (titres, textes, tableaux,
 * notes) et la liste des médias par référence (data-dc-media), jamais les
 * binaires.
 */

/** Convertit un fragment HTML simple (issu de M1) en texte plat. */
function htmlToText(html) {
  return String(html || '')
    .replace(/<li>/gi, '\n  • ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tableToMarkdown(content) {
  const rows = content.rows || [];
  if (!rows.length) return '';
  const fmt = (r) => '| ' + r.map((c) => String(c).replace(/\n/g, ' ')).join(' | ') + ' |';
  const out = [fmt(rows[0])];
  if (content.header) out.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
  for (const r of rows.slice(content.header ? 1 : 0)) out.push(fmt(r));
  return out.join('\n');
}

/** Sérialise une slide en bloc texte. */
function digestSlide(slide) {
  const parts = [`### Diapositive ${slide.index + 1} — « ${slide.title} »`,
    `(step: ${slide.stepId}, layout actuel: ${slide.layout})`];

  const texts = slide.blocks.filter((b) => b.type === 'text');
  if (texts.length) {
    parts.push('\nTexte :');
    for (const b of texts) parts.push(htmlToText(b.content.html));
  }

  const tables = slide.blocks.filter((b) => b.type === 'table');
  for (const b of tables) {
    parts.push('\nTableau :');
    parts.push(tableToMarkdown(b.content));
  }

  const medias = slide.blocks.filter((b) => b.type === 'image' || b.type === 'rasterized');
  if (medias.length) {
    parts.push('\nMédias (à conserver via data-dc-media, src vide) :');
    for (const b of medias) {
      const kind = b.type === 'rasterized' ? 'forme rastérisée' : 'image';
      parts.push(`  - ${b.content.mediaRef} (${kind})${b.content.alt ? ' — alt : ' + b.content.alt : ''}`);
    }
  }

  if (slide.notes) {
    parts.push('\nNotes du présentateur (contexte pour l’enseignant, ne pas afficher tel quel) :');
    parts.push(slide.notes);
  }

  return parts.join('\n');
}

/** Digest complet de toutes les slides. */
export function buildContentDigest(project) {
  const slides = project.slides || [];
  if (!slides.length) return '(aucune diapositive extraite)';
  return slides.map(digestSlide).join('\n\n---\n\n');
}

/** Compteurs rapides pour l'aperçu UI. */
export function contentStats(project) {
  const slides = project.slides || [];
  let blocks = 0, medias = 0, tables = 0;
  for (const s of slides) {
    blocks += s.blocks.length;
    medias += s.blocks.filter((b) => b.type === 'image' || b.type === 'rasterized').length;
    tables += s.blocks.filter((b) => b.type === 'table').length;
  }
  return { slides: slides.length, blocks, medias, tables };
}

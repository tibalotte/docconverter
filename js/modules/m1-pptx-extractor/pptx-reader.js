/**
 * pptx-reader.js — Lecture du .pptx et parcours SLIDE PAR SLIDE.
 *
 * Contrainte 4–8 Go (docs/ARCHITECTURE.md §1, §4.3) : on ne décompresse jamais
 * tout le .pptx en RAM. JSZip conserve les entrées compressées ; on extrait le
 * XML d'une slide à la fois, on le parse, puis on passe à la suivante. Les
 * médias ne sont extraits qu'à la demande.
 */

/* global JSZip */

const NS_PRES = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const xmlParser = new DOMParser();

function parseXml(str) {
  const doc = xmlParser.parseFromString(str, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('XML PPTX illisible');
  }
  return doc;
}

/** Résout un chemin relatif d'une .rels vers un chemin absolu dans le zip. */
function resolvePath(baseDir, target) {
  // target peut être "../media/image1.png" relatif au dossier de la part.
  const parts = (baseDir + '/' + target).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

/** Lit une .rels et renvoie une map rId → { target (absolu), type }. */
function parseRels(relsXml, partDir) {
  const map = new Map();
  if (!relsXml) return map;
  const rels = relsXml.getElementsByTagNameNS(NS_REL, 'Relationship');
  for (const rel of rels) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    const type = rel.getAttribute('Type');
    const mode = rel.getAttribute('TargetMode');
    map.set(id, {
      type,
      external: mode === 'External',
      target: mode === 'External' ? target : resolvePath(partDir, target),
    });
  }
  return map;
}

export class PptxReader {
  constructor() {
    this._zip = null;
    this._slideParts = []; // chemins absolus des slides, dans l'ordre
    this._slideSize = { cx: 9144000, cy: 6858000 }; // défaut 4:3 (EMU)
  }

  get slideSize() {
    return this._slideSize;
  }

  get slideCount() {
    return this._slideParts.length;
  }

  /** Charge le .pptx (File/Blob/ArrayBuffer) et calcule l'ordre des slides. */
  async load(file) {
    this._zip = await JSZip.loadAsync(file);

    const presStr = await this._readText('ppt/presentation.xml');
    if (!presStr) throw new Error('Ce fichier ne ressemble pas à un .pptx (presentation.xml absent)');
    const pres = parseXml(presStr);

    const sldSz = pres.getElementsByTagNameNS(NS_PRES, 'sldSz')[0];
    if (sldSz) {
      this._slideSize = {
        cx: parseInt(sldSz.getAttribute('cx'), 10) || this._slideSize.cx,
        cy: parseInt(sldSz.getAttribute('cy'), 10) || this._slideSize.cy,
      };
    }

    // Ordre des slides : sldIdLst → r:id → presentation.xml.rels → cible.
    const presRelsStr = await this._readText('ppt/_rels/presentation.xml.rels');
    const presRels = parseRels(presRelsStr ? parseXml(presRelsStr) : null, 'ppt');

    const ids = pres.getElementsByTagNameNS(NS_PRES, 'sldId');
    this._slideParts = [];
    for (const sld of ids) {
      const rid = sld.getAttributeNS(NS_R, 'id') || sld.getAttribute('r:id');
      const rel = presRels.get(rid);
      if (rel && !rel.external) this._slideParts.push(rel.target);
    }
    // Repli : aucun ordre trouvé → tri naturel des slideN.xml présents.
    if (!this._slideParts.length) {
      this._slideParts = Object.keys(this._zip.files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
        .sort((a, b) => this._num(a) - this._num(b));
    }
    return this.slideCount;
  }

  _num(path) {
    const m = path.match(/(\d+)\.xml$/);
    return m ? parseInt(m[1], 10) : 0;
  }

  async _readText(path) {
    const f = this._zip.file(path);
    return f ? f.async('string') : null;
  }

  /**
   * Générateur asynchrone : produit un contexte par slide, traité puis libéré
   * avant la suivante. Chaque contexte expose le DOM de la slide, ses
   * relations, les notes, et un accès paresseux aux médias.
   */
  async *slides() {
    for (let i = 0; i < this._slideParts.length; i++) {
      const partPath = this._slideParts[i];
      const partDir = partPath.substring(0, partPath.lastIndexOf('/'));

      const xmlStr = await this._readText(partPath);
      if (!xmlStr) continue;
      const xml = parseXml(xmlStr);

      const relsPath = partDir + '/_rels/' + partPath.split('/').pop() + '.rels';
      const relsStr = await this._readText(relsPath);
      const rels = parseRels(relsStr ? parseXml(relsStr) : null, partDir);

      const notes = await this._readNotes(rels);

      const reader = this;
      yield {
        index: i,
        xml,
        rels,
        notes,
        /** Extrait le blob d'un média référencé par rId (paresseux). */
        async getMediaBlob(rId) {
          const rel = rels.get(rId);
          if (!rel || rel.external) return null;
          const f = reader._zip.file(rel.target);
          return f ? f.async('blob') : null;
        },
        /** Nom de fichier original du média (pour nommage). */
        getMediaName(rId) {
          const rel = rels.get(rId);
          return rel ? rel.target.split('/').pop() : null;
        },
      };

      // Aide le GC : on lâche les références lourdes de cette slide.
      // (xml/rels sortent de portée à l'itération suivante.)
    }
  }

  async _readNotes(rels) {
    let notesPart = null;
    for (const rel of rels.values()) {
      if (rel.type && rel.type.endsWith('/notesSlide')) {
        notesPart = rel.target;
        break;
      }
    }
    if (!notesPart) return '';
    const notesStr = await this._readText(notesPart);
    if (!notesStr) return '';
    const doc = parseXml(notesStr);
    // Le texte des notes vit dans les <a:t> du corps de notes.
    const ts = doc.getElementsByTagName('a:t');
    let out = [];
    for (const t of ts) out.push(t.textContent);
    return out.join('\n').trim();
  }

  /** Libère le zip (fin d'extraction). */
  dispose() {
    this._zip = null;
    this._slideParts = [];
  }
}

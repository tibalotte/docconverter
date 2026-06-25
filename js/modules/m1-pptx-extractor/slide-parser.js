/**
 * slide-parser.js — Slide XML (DOM) → représentation structurée.
 *
 * Parcourt l'arbre de formes (p:spTree) et classe chaque enfant :
 *  - texte (formes avec txBody)         → textBlocks
 *  - tableau (graphicFrame > a:tbl)     → tables
 *  - image (p:pic)                      → pictures (référence rId)
 *  - autoshape avec géométrie/fond      → shapes (candidates à rastériser)
 *  - groupe (p:grpSp)                   → groups (rastérisés en bloc)
 *
 * Rappel (docs) : animations, transitions et SmartArt ne sont PAS reproduits ;
 * seul le contenu statique est extrait. Positions en EMU.
 */

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function child(el, localName) {
  if (!el) return null;
  for (const c of el.children) if (c.localName === localName) return c;
  return null;
}
function children(el, localName) {
  if (!el) return [];
  return [...el.children].filter((c) => c.localName === localName);
}
function descendant(el, localName) {
  if (!el) return null;
  return el.getElementsByTagNameNS('*', localName)[0] || null;
}

/** Lit a:xfrm (off/ext) sous un spPr/grpSpPr/xfrm donné. */
function readXfrm(container) {
  const xfrm = descendant(container, 'xfrm');
  if (!xfrm) return null;
  const off = child(xfrm, 'off');
  const ext = child(xfrm, 'ext');
  const chOff = child(xfrm, 'chOff');
  const chExt = child(xfrm, 'chExt');
  const num = (el, a) => (el ? parseInt(el.getAttribute(a), 10) || 0 : 0);
  return {
    x: num(off, 'x'),
    y: num(off, 'y'),
    cx: num(ext, 'cx'),
    cy: num(ext, 'cy'),
    chX: chOff ? num(chOff, 'x') : 0,
    chY: chOff ? num(chOff, 'y') : 0,
    chCx: chExt ? num(chExt, 'cx') : 0,
    chCy: chExt ? num(chExt, 'cy') : 0,
    rot: parseInt(xfrm.getAttribute('rot') || '0', 10) / 60000, // en degrés
  };
}

/** Couleur de remplissage (solidFill srgbClr) sous un conteneur. */
function readSolidFill(container) {
  const fill = child(container, 'solidFill') || descendant(container, 'solidFill');
  if (!fill) return null;
  const srgb = child(fill, 'srgbClr');
  if (srgb) return '#' + srgb.getAttribute('val');
  // schemeClr : on ne mappe pas le thème ici → repli neutre.
  return null;
}

/** Extrait les paragraphes texte d'un txBody. */
function readTextBody(txBody) {
  if (!txBody) return [];
  const paras = [];
  for (const p of children(txBody, 'p')) {
    const pPr = child(p, 'pPr');
    const level = pPr ? parseInt(pPr.getAttribute('lvl') || '0', 10) : 0;
    const align = pPr ? pPr.getAttribute('algn') : null;
    let text = '';
    for (const node of p.children) {
      if (node.localName === 'r') {
        const t = child(node, 't');
        if (t) text += t.textContent;
      } else if (node.localName === 'br') {
        text += '\n';
      }
    }
    paras.push({ text, level, align });
  }
  return paras;
}

function placeholderType(sp) {
  const ph = descendant(sp, 'ph');
  return ph ? ph.getAttribute('type') || 'body' : null;
}

function geomPreset(spPr) {
  const prst = child(spPr, 'prstGeom');
  if (prst) return prst.getAttribute('prst') || 'rect';
  if (child(spPr, 'custGeom')) return 'custom';
  return null;
}

/** Parse une forme simple (p:sp). */
function parseSp(sp) {
  const spPr = child(sp, 'spPr');
  const xfrm = readXfrm(spPr);
  const txBody = child(sp, 'txBody');
  const paragraphs = readTextBody(txBody);
  const text = paragraphs.map((p) => p.text).join('\n').trim();
  return {
    kind: 'sp',
    ph: placeholderType(sp),
    geom: geomPreset(spPr),
    fill: readSolidFill(spPr),
    line: readSolidFill(child(spPr, 'ln')),
    paragraphs,
    text,
    bbox: xfrm,
  };
}

/** Parse une image (p:pic) → conserve le rId du blip. */
function parsePic(pic) {
  const spPr = child(pic, 'spPr');
  const blip = descendant(pic, 'blip');
  const rId = blip ? blip.getAttributeNS(NS_R, 'embed') || blip.getAttribute('r:embed') : null;
  const nv = descendant(pic, 'cNvPr');
  return {
    kind: 'pic',
    rId,
    name: nv ? nv.getAttribute('name') : '',
    bbox: readXfrm(spPr),
  };
}

/** Parse un graphicFrame : détecte un tableau a:tbl. */
function parseGraphicFrame(gf) {
  const tbl = descendant(gf, 'tbl');
  const xfrm = readXfrm(gf);
  if (!tbl) return { kind: 'graphic', bbox: xfrm, table: null };
  const rows = [];
  for (const tr of children(tbl, 'tr')) {
    const cells = [];
    for (const tc of children(tr, 'tc')) {
      const paras = readTextBody(child(tc, 'txBody'));
      cells.push(paras.map((p) => p.text).join('\n').trim());
    }
    rows.push(cells);
  }
  return { kind: 'table', bbox: xfrm, rows };
}

/** Parse un groupe (p:grpSp) récursivement. */
function parseGroup(grp) {
  const grpSpPr = child(grp, 'grpSpPr');
  const bbox = readXfrm(grpSpPr);
  const childrenShapes = [];
  for (const node of grp.children) {
    const parsed = parseTreeChild(node);
    if (parsed) childrenShapes.push(parsed);
  }
  return { kind: 'group', bbox, children: childrenShapes };
}

function parseTreeChild(node) {
  switch (node.localName) {
    case 'sp':
      return parseSp(node);
    case 'pic':
      return parsePic(node);
    case 'graphicFrame':
      return parseGraphicFrame(node);
    case 'grpSp':
      return parseGroup(node);
    default:
      return null;
  }
}

/**
 * Parse une slide entière (DOM) → objet structuré exploitable par index.js.
 * @param {Document} slideXml
 * @param {{cx:number,cy:number}} slideSize
 */
export function parseSlide(slideXml, slideSize) {
  const spTree = slideXml.getElementsByTagNameNS(NS_A, 'spTree')[0]
    || slideXml.querySelector('spTree')
    || slideXml.getElementsByTagName('p:spTree')[0];

  const result = {
    title: '',
    textBlocks: [],
    tables: [],
    pictures: [],
    shapes: [],   // autoshapes candidates à la rastérisation
    groups: [],   // groupes candidats à la rastérisation
    slideSize,
  };
  if (!spTree) return result;

  for (const node of spTree.children) {
    const parsed = parseTreeChild(node);
    if (!parsed) continue;

    if (parsed.kind === 'sp') {
      const isTitle = parsed.ph === 'title' || parsed.ph === 'ctrTitle';
      if (isTitle && parsed.text && !result.title) {
        result.title = parsed.text.replace(/\n/g, ' ').trim();
      }
      const hasGeomFill = parsed.geom && parsed.geom !== 'rect' || parsed.fill || parsed.line;
      if (parsed.text && (parsed.ph || !hasGeomFill)) {
        // Forme à vocation textuelle (placeholder ou simple zone de texte).
        result.textBlocks.push(parsed);
      } else {
        // Autoshape avec géométrie/fond → à rastériser (rendu statique).
        result.shapes.push(parsed);
      }
    } else if (parsed.kind === 'pic') {
      result.pictures.push(parsed);
    } else if (parsed.kind === 'table') {
      result.tables.push(parsed);
    } else if (parsed.kind === 'graphic') {
      // Graphique non tabulaire (diagramme/chart/SmartArt) → non reproduit.
      // On le laisse de côté volontairement (cf. limites documentées).
    } else if (parsed.kind === 'group') {
      result.groups.push(parsed);
    }
  }
  return result;
}

// Décodage / encodage des fichiers texte d'Assetto Corsa.
// Les fichiers sont en général en ASCII, parfois en UTF-8 (avec ou sans BOM),
// parfois en Windows-1252 (latin-1) quand un moddeur a mis des accents dans un
// commentaire. On détecte, on décode, et on réencode exactement pareil.

const CP1252_HIGH = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};
const CP1252_REVERSE = new Map(Object.entries(CP1252_HIGH).map(([b, c]) => [c, Number(b)]));

/**
 * @param {Uint8Array} bytes
 * @returns {{ text: string, encoding: 'utf-8'|'windows-1252', bom: boolean }}
 */
export function decodeText(bytes) {
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = bom ? bytes.subarray(3) : bytes;
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body);
    return { text, encoding: 'utf-8', bom };
  } catch {
    let text = '';
    for (const b of body) text += String.fromCharCode(CP1252_HIGH[b] ?? b);
    return { text, encoding: 'windows-1252', bom: false };
  }
}

/**
 * @param {string} text
 * @param {'utf-8'|'windows-1252'} encoding
 * @param {boolean} bom
 * @returns {Uint8Array}
 */
export function encodeText(text, encoding = 'utf-8', bom = false) {
  if (encoding === 'utf-8') {
    const body = new TextEncoder().encode(text);
    if (!bom) return body;
    const out = new Uint8Array(body.length + 3);
    out.set([0xef, 0xbb, 0xbf]);
    out.set(body, 3);
    return out;
  }
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const b = c < 0x80 || (c >= 0xa0 && c <= 0xff) || (c >= 0x80 && c <= 0x9f && !(c in CP1252_HIGH))
      ? c
      : CP1252_REVERSE.get(c);
    if (b === undefined) {
      throw new Error(`Caractère « ${text[i]} » impossible à écrire en Windows-1252`);
    }
    out[i] = b;
  }
  return out;
}

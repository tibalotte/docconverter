// Différences ligne à ligne (LCS) entre deux textes, pour « Voir les différences ».

function splitLines(text) {
  return text.split(/\r\n|\n|\r/);
}

/**
 * @returns {Array<{type:'same'|'del'|'add', text:string, a:number|null, b:number|null}>}
 */
export function lineDiff(aText, bText) {
  const a = splitLines(aText);
  const b = splitLines(bText);
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i], a: i + 1, b: j + 1 }); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) { out.push({ type: 'del', text: a[i], a: i + 1, b: null }); i++; }
    else { out.push({ type: 'add', text: b[j], a: null, b: j + 1 }); j++; }
  }
  while (i < n) { out.push({ type: 'del', text: a[i], a: i + 1, b: null }); i++; }
  while (j < m) { out.push({ type: 'add', text: b[j], a: null, b: j + 1 }); j++; }
  return out;
}

/** Ne garde que les lignes modifiées et `context` lignes autour ; insère des '…'. */
export function compactDiff(diff, context = 2) {
  const keep = new Array(diff.length).fill(false);
  diff.forEach((d, idx) => {
    if (d.type === 'same') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(diff.length - 1, idx + context); k++) keep[k] = true;
  });
  const out = [];
  let skipped = false;
  diff.forEach((d, idx) => {
    if (keep[idx]) { out.push(d); skipped = false; }
    else if (!skipped) { out.push({ type: 'skip', text: '…', a: null, b: null }); skipped = true; }
  });
  return out;
}

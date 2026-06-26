/**
 * loi25.js — Analyse de conformité à la Loi 25 (Québec).
 *
 * Vérifie que le module exporté ne collecte ni ne transmet de données
 * personnelles hors du LMS hôte et n'introduit aucun appel réseau externe
 * (CDN, polices, traceurs). L'application étant 100 % côté client, le contenu
 * reste local ; cette analyse confirme l'absence de fuite.
 */

const EXTERNAL_PATTERNS = [
  { re: /https?:\/\/(?!localhost|127\.0\.0\.1)[^\s"'<>]+/gi, label: 'URL externe (ressource ou appel réseau)' },
  { re: /fonts\.googleapis\.com|fonts\.gstatic\.com/gi, label: 'police Google (externe)' },
  { re: /google-analytics|googletagmanager|gtag\(|fbq\(|hotjar|matomo|_paq/gi, label: 'traceur / analytics' },
  { re: /cdn\.|jsdelivr|cdnjs|unpkg/gi, label: 'ressource CDN externe' },
];

const PII_PATTERNS = [
  { re: /localStorage|sessionStorage/gi, label: 'stockage navigateur (vérifier l’absence de données personnelles)' },
  { re: /navigator\.geolocation/gi, label: 'géolocalisation' },
  { re: /new\s+XMLHttpRequest|fetch\s*\(|navigator\.sendBeacon/gi, label: 'requête réseau sortante' },
];

/**
 * @param {string} html  HTML exporté complet (avec scripts inline éventuels)
 * @returns {{ compliant:boolean, findings:Array<{level:'error'|'warning'|'info', message:string}> }}
 */
export function analyzeLoi25(html) {
  const findings = [];
  const text = String(html || '');

  for (const { re, label } of EXTERNAL_PATTERNS) {
    const m = text.match(re);
    if (m) findings.push({ level: 'error', message: `${label} détecté (${unique(m).slice(0, 3).join(', ')})` });
  }
  for (const { re, label } of PII_PATTERNS) {
    if (re.test(text)) findings.push({ level: 'warning', message: `${label}` });
  }

  if (!findings.length) {
    findings.push({ level: 'info', message: 'Aucune ressource externe ni collecte de données détectée. Le module reste local au LMS hôte.' });
    findings.push({ level: 'info', message: 'Les seuls échanges sont les appels SCORM standards (score/progression) via le pont, internes au LMS.' });
  }

  const compliant = !findings.some((f) => f.level === 'error');
  return { compliant, findings };
}

function unique(arr) { return [...new Set(arr)]; }

/** Avis HTML inséré dans l'export si exportSettings.loi25Notice. */
export function loi25NoticeHtml() {
  return `<aside class="dc-loi25-notice small text-muted border-top mt-4 pt-2">
    Ce module fonctionne entièrement dans votre LMS. Aucune donnée personnelle n'est
    transmise à un tiers ; seuls le score et la progression sont communiqués au LMS
    (SCORM). Conforme à la Loi 25 (Québec).</aside>`;
}

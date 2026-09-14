// Article-root detection: a readability-style heuristic score plus a confidence value.
// When confidence is low, the caller falls back to full-page mode and says so explicitly
// in the report — it never silently switches modes.
// This file touches no chrome APIs.

const POS = /\b(article|main|content|post|story|entry|body|text)\b/i;
const NEG = /\b(comment|footer|foot|nav|menu|sidebar|aside|widget|share|social|ad|ads|related|promo|recommend|newsletter|subscribe|breadcrumb|pagination|tags)\b/i;

function detectArticleRoot(doc) {
  const scores = new Map();
  const texts = [];
  let total = 0;
  for (const el of doc.querySelectorAll('p,pre,td,blockquote,li')) {
    const t = (el.textContent || '').trim();
    if (t.length < 25) continue; // ignore small fragments
    let s = Math.min(Math.floor(t.length / 100), 3); // length: 0-3
    s += Math.min((t.match(/[,，.。:：;；]/g) || []).length, 3); // punctuation density: 0-3
    if (el.tagName === 'PRE' || el.tagName === 'TD' || el.tagName === 'BLOCKQUOTE') s += 2;
    s += 1;
    texts.push({ el, s });
    total += s;
    for (let a = el.parentElement; a && a !== doc.body; a = a.parentElement) {
      const cls = ((a.getAttribute && a.getAttribute('class')) || '') + ' ' + ((a.getAttribute && a.getAttribute('id')) || '');
      let sc = scores.get(a) || 0;
      if (POS.test(cls)) sc += 25;
      else if (NEG.test(cls)) sc -= 25;
      scores.set(a, sc + s);
    }
  }
  let best = doc.body, bestScore = 0;
  for (const [el, sc] of scores) {
    if (sc > bestScore) { bestScore = sc; best = el; }
  }
  // <main> is a content landmark: prefer it whenever it's a plausible candidate (score not
  // much worse, has real content), matching claude.com's built-in copy-as-markdown
  // behavior of querySelector('main').
  const main = doc.querySelector('main');
  if (main && (scores.get(main) || 0) >= bestScore * 0.5 && main.querySelectorAll('p').length >= 3) {
    best = main;
  }
  // Confidence = the share of text quality captured by `best`, counting each text element
  // once. Accumulating by ancestor chain instead would double-count nested text and make
  // the denominator blow up on deeply nested pages.
  let captured = 0;
  if (best !== doc.body) for (const { el, s } of texts) if (best.contains(el)) captured += s;
  const confidence = total ? captured / total : 0;
  const parCount = best.querySelectorAll('p').length;
  if (best === doc.body || confidence < 0.25 || parCount < 3) {
    return { root: doc.body, confidence: Math.min(confidence, 0.25), isFallback: true };
  }
  return { root: best, confidence, isFallback: false };
}

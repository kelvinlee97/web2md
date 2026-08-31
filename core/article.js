// 文章根节点检测:readability 式启发评分 + 置信度。
// 置信度低时调用方回退到整页转换并在报告中明确标出,绝不静默切换。
// 本文件不接触任何 chrome API。

const POS = /\b(article|main|content|post|story|entry|body|text)\b/i;
const NEG = /\b(comment|footer|foot|nav|menu|sidebar|aside|widget|share|social|ad|ads|related|promo|recommend|newsletter|subscribe|breadcrumb|pagination|tags)\b/i;

function detectArticleRoot(doc) {
  const scores = new Map();
  const texts = [];
  let total = 0;
  for (const el of doc.querySelectorAll('p,pre,td,blockquote,li')) {
    const t = (el.textContent || '').trim();
    if (t.length < 25) continue; // 忽略小碎片
    let s = Math.min(Math.floor(t.length / 100), 3); // 长度: 0-3
    s += Math.min((t.match(/[,，.。:：;；]/g) || []).length, 3); // 标点密度: 0-3
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
  // <main> 是内容地标:只要它是可信候选(得分不差、有正文),就优先选它,
  // 对齐 claude.com 内置 copy-as-markdown 的 querySelector('main') 行为。
  const main = doc.querySelector('main');
  if (main && (scores.get(main) || 0) >= bestScore * 0.5 && main.querySelectorAll('p').length >= 3) {
    best = main;
  }
  // 置信度 = 落入 best 的文本质量占比,每个文本元素只计一次。
  // 按祖先链累计会把同一文本按嵌套深度重复计数,深页面上分母无限膨胀。
  let captured = 0;
  if (best !== doc.body) for (const { el, s } of texts) if (best.contains(el)) captured += s;
  const confidence = total ? captured / total : 0;
  const parCount = best.querySelectorAll('p').length;
  if (best === doc.body || confidence < 0.25 || parCount < 3) {
    return { root: doc.body, confidence: Math.min(confidence, 0.25), isFallback: true };
  }
  return { root: best, confidence, isFallback: false };
}

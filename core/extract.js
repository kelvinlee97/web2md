// 共享的内容谓词与文本工具。
// 序列化(前置统计)和完整性解析(后置统计)都通过 stripInline() 派生纯文本,
// 两侧从同一构造出发,结构性不可能漂移。
// 本文件不接触任何 chrome API,可被 Safari Web Extension 直接复用。

function normalizeText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function isHidden(el) {
  // 只看是否真的不渲染。aria-hidden 不算:分字动画等常给可见文本标 aria-hidden
  // (如 Webflow hero 标题,每个词一个 span),跳过会把正文标题整段丢掉。
  if (el.hidden) return true;
  const cs = getComputedStyle(el);
  return cs.display === 'none' || cs.visibility === 'hidden';
}

// mode: 'article' | 'full'
// 跳过的元素同时从输出和前置统计中排除,永不产生假缺失。
function isSkipped(el, mode) {
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
      tag === 'TEMPLATE' || tag === 'IFRAME') return true;
  if (mode === 'article' &&
      (tag === 'NAV' || tag === 'ASIDE' || tag === 'FOOTER' || tag === 'FORM')) return true;
  // 类名形式的导航/页脚/菜单(常是 div,不在 <nav> 里),对齐 claude.com 内置转换的剥除行为。
  if (mode === 'article' && /(^|[\s_-])(nav|footer|menu|breadcrumb|pagination)[\s_-]/i.test(el.className || '')) return true;
  return isHidden(el);
}

// serialize.js 产出的 markdown 构造。解析器只认这些。
const IMG_RE = /!\[((?:[^\]\\]|\\.)*)\]\(((?:[^()]|\([^()]*\))*)\)/g;
const LINK_RE = /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g;

const normAlt = (s) => s.replace(/\\]/g, ']');
const normUrl = (s) => s.replace(/^<|>$/g, '');

// Markdown 行内语法 → 纯文本。完整性报告两侧共用。
function stripInline(s) {
  return s
    .replace(IMG_RE, '')
    .replace(LINK_RE, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/~~/g, '')
    .replace(/\*/g, '');
}

// 表格行按未转义管道拆分(单元格内的 \| 合并回来)。
function splitRow(line) {
  const parts = line.replace(/^\||\|$/g, '').split('|');
  const out = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].endsWith('\\')) out[out.length - 1] += '|' + p;
    else out.push(p);
  }
  return out.map((s) => s.replace(/\\\|/g, '|'));
}

// Shared predicates and text utilities.
// Both serialization (pre-stats) and integrity parsing (post-stats) derive plain text via
// stripInline(), so the two sides are structurally guaranteed not to drift apart.
// This file touches no chrome APIs and can be reused directly by a Safari Web Extension.

function normalizeText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function isHidden(el) {
  // Only counts as hidden if it genuinely doesn't render. aria-hidden alone doesn't count:
  // letter-by-letter title animations commonly mark visible text aria-hidden (e.g. Webflow
  // hero titles, one span per word) — skipping those would drop the whole heading.
  if (el.hidden) return true;
  const cs = getComputedStyle(el);
  return cs.display === 'none' || cs.visibility === 'hidden';
}

// mode: 'article' | 'full'
// Skipped elements are excluded from both the output and the pre-stats, so they never
// produce a false "missing" result.
function isSkipped(el, mode) {
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
      tag === 'TEMPLATE' || tag === 'IFRAME') return true;
  if (mode === 'article' &&
      (tag === 'NAV' || tag === 'ASIDE' || tag === 'FOOTER' || tag === 'FORM')) return true;
  // Class-name-based nav/footer/menu (often a div, not a <nav>) — matches claude.com's
  // built-in copy-as-markdown stripping behavior.
  if (mode === 'article' && /(^|[\s_-])(nav|footer|menu|breadcrumb|pagination)[\s_-]/i.test(el.className || '')) return true;
  return isHidden(el);
}

// The markdown constructs serialize.js emits. The parser only recognizes these.
const IMG_RE = /!\[((?:[^\]\\]|\\.)*)\]\(((?:[^()]|\([^()]*\))*)\)/g;
const LINK_RE = /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g;

const normAlt = (s) => s.replace(/\\]/g, ']');
const normUrl = (s) => s.replace(/^<|>$/g, '');

// Markdown inline syntax → plain text. Shared by both sides of the integrity report.
function stripInline(s) {
  return s
    .replace(IMG_RE, '')
    .replace(LINK_RE, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/~~/g, '')
    .replace(/\*/g, '');
}

// Split a table row on unescaped pipes (merging \| back into the cell).
function splitRow(line) {
  const parts = line.replace(/^\||\|$/g, '').split('|');
  const out = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].endsWith('\\')) out[out.length - 1] += '|' + p;
    else out.push(p);
  }
  return out.map((s) => s.replace(/\\\|/g, '|'));
}

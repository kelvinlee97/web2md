// DOM → Markdown. A single synchronous walk produces both the markdown and the pre-stats
// needed for the integrity report; both share extract.js's predicates, so the report can
// never contradict the output.
// This file touches no chrome APIs.

function escUrl(u) { return /[()]/.test(u) ? '<' + u + '>' : u; }
function escAlt(s) { return s.replace(/\]/g, '\\]'); }

// Escape with a backslash when a paragraph/loose text line starts with these markers, so the
// parser doesn't mistake it for a list/heading/quote/table.
const LEAD_ESCAPE = /^(\s*)([-*+>#|]|\d+\.)\s/;
const escapeLead = (s) => s.replace(LEAD_ESCAPE, '$1\\$2');

function domToMarkdown(root, mode) {
  const pre = {
    headings: [], paragraphs: [], listItems: [], links: [], images: [],
    figures: [], tables: [], codeBlocks: [], text: '',
  };
  const notes = [];
  let svgCount = 0;
  const addText = (s) => { if (s) pre.text += ' ' + s; };

  // Inline content → inline markdown. Insert a space between two adjacent element child
  // nodes, or <span>a</span><span>b</span> would glue into "ab" (common in metadata lists).
  function inline(el) {
    let out = '';
    let prevWasEl = false;
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.data.replace(/\s+/g, ' ');
        prevWasEl = false;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (isSkipped(node, mode)) continue;
        if (prevWasEl && out && !out.endsWith(' ')) out += ' ';
        out += inlineEl(node);
        prevWasEl = true;
      }
    }
    return out;
  }

  // Markdown for a single inline element. liText also routes through here when handling a
  // li's own children directly — otherwise A/IMG's own semantics would be skipped
  // (recursion would only yield plain text).
  function inlineEl(node) {
    const tag = node.tagName;
    if (tag === 'A') {
      const text = inline(node);
      const href = node.href || '';
      const plain = normalizeText(stripInline(text));
      if (plain && href && !/^javascript:/i.test(href)) {
        pre.links.push({ text: plain, url: href });
        return '[' + text.trim() + '](' + escUrl(href) + ')';
      }
      return text;
    }
    if (tag === 'IMG') {
      const src = node.currentSrc || node.src;
      if (src) {
        const alt = node.alt || '';
        pre.images.push({ alt: normAlt(alt), src });
        return '![' + escAlt(alt) + '](' + escUrl(src) + ')';
      }
      return '';
    }
    if (tag === 'STRONG' || tag === 'B') return '**' + inline(node) + '**';
    if (tag === 'EM' || tag === 'I') return '*' + inline(node) + '*';
    if (tag === 'DEL' || tag === 'S' || tag === 'STRIKE') return '~~' + inline(node) + '~~';
    if (tag === 'CODE') {
      const code = node.textContent;
      const run = (code.match(/`+/g) || ['']).reduce((m, s) => Math.max(m, s.length), 0);
      return '`'.repeat(run + 1) + code + '`'.repeat(run + 1);
    }
    if (tag === 'BR') return '  \n';
    return inline(node);
  }

  // The text portion of an li (excluding nested lists — those are appended with indentation in listToMd).
  function liText(li) {
    let out = '';
    let prevWasEl = false;
    for (const node of li.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.data.replace(/\s+/g, ' ');
        prevWasEl = false;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName;
        if (tag === 'UL' || tag === 'OL') continue;
        if (isSkipped(node, mode)) continue;
        if (prevWasEl && out && !out.endsWith(' ')) out += ' ';
        out += inlineEl(node);
        prevWasEl = true;
      }
    }
    return out.trim();
  }

  function listToMd(list) {
    const isOl = list.tagName === 'OL';
    let n = isOl && list.start ? +list.start : 1;
    const lines = [];
    for (const li of list.children) {
      if (li.tagName !== 'LI') continue;
      const box = li.querySelector(':scope > input[type="checkbox"]');
      const text = liText(li);
      pre.listItems.push(normalizeText(stripInline(text)));
      addText(normalizeText(stripInline(text)));
      lines.push((isOl ? n + '. ' : '- ') + (box ? (box.checked ? '[x] ' : '[ ] ') : '') + text);
      n++;
      for (const sub of li.children) {
        if (sub.tagName === 'UL' || sub.tagName === 'OL') {
          for (const sl of listToMd(sub)) lines.push('  ' + sl);
        }
      }
    }
    return lines;
  }

  function tableToMd(table) {
    const rows = Array.from(table.rows);
    if (!rows.length) return '';
    const width = (r) => Array.from(r.cells).reduce((w, c) => w + (c.colSpan || 1), 0);
    const ncols = Math.max(...rows.map(width));
    const pending = new Map(); // col → remaining rows still occupied by a rowspan
    const all = [];
    for (const r of rows) {
      const parts = new Array(ncols).fill('');
      for (const [col, sp] of pending) {
        if (--sp.rem <= 0) pending.delete(col);
      }
      let col = 0;
      for (const c of r.cells) {
        while (col < ncols && pending.has(col)) col++;
        if (col >= ncols) break;
        const text = normalizeText(stripInline(inline(c)).replace(/\|/g, ' '));
        parts[col] = text;
        addText(text);
        if ((c.rowSpan || 1) > 1) pending.set(col, { rem: c.rowSpan - 1 });
        col += (c.colSpan || 1);
      }
      all.push(parts);
    }
    pre.tables.push(rows.length);
    const escCell = (c) => c.replace(/\|/g, '\\|');
    const header = all[0].map(escCell).join(' | ');
    const body = all.slice(1).map((p) => p.map(escCell).join(' | '));
    return ['| ' + header + ' |',
            '| ' + all[0].map(() => '---').join(' | ') + ' |',
            ...body.map((b) => '| ' + b + ' |')].join('\n');
  }

  function walkBlock(el, blocks) {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.data.replace(/\s+/g, ' ').trim();
        if (t) {
          const md = escapeLead(t);
          pre.paragraphs.push(normalizeText(stripInline(md)));
          addText(normalizeText(stripInline(md)));
          blocks.push(md);
        }
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const e = node;
      if (isSkipped(e, mode)) {
        if (e.tagName === 'IFRAME') note('Page contains an iframe, not converted');
        if (e.tagName === 'VIDEO' || e.tagName === 'AUDIO' || e.tagName === 'CANVAS') {
          note('Page contains ' + e.tagName.toLowerCase() + ', not converted');
        }
        continue;
      }
      switch (e.tagName) {
        case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
          const lvl = +e.tagName[1];
          const md = inline(e).trim();
          const text = normalizeText(stripInline(md));
          if (text) {
            pre.headings.push({ lvl, text });
            addText(text);
            blocks.push('#'.repeat(lvl) + ' ' + md);
          }
          break;
        }
        case 'P': {
          const md = inline(e).trim();
          if (!md) break;
          const text = normalizeText(stripInline(md));
          if (text) { pre.paragraphs.push(text); addText(text); }
          blocks.push(escapeLead(md));
          break;
        }
        case 'UL': case 'OL':
          blocks.push(listToMd(e).join('\n'));
          break;
        case 'BLOCKQUOTE': {
          const inner = [];
          walkBlock(e, inner);
          if (inner.length) blocks.push(inner.join('\n\n').replace(/^/gm, '> '));
          break;
        }
        case 'PRE': {
          const code = (e.textContent || '').replace(/\n+$/, '');
          const codeEl = e.querySelector('code');
          const cls = codeEl ? (codeEl.getAttribute('class') || '') : '';
          const lang = (String(cls).match(/language-([\w-]+)/) || [])[1] || '';
          pre.codeBlocks.push(code);
          addText(code);
          blocks.push('```' + lang + '\n' + code + '\n```');
          break;
        }
        case 'TABLE': {
          const t = tableToMd(e);
          if (t) blocks.push(t);
          break;
        }
        case 'FIGURE': {
          const inner = [];
          for (const c of e.childNodes) {
            if (c.nodeType !== Node.ELEMENT_NODE || c.tagName === 'FIGCAPTION') continue;
            if (isSkipped(c, mode)) continue;
            if (c.tagName === 'IMG') {
              const src = c.currentSrc || c.src;
              if (src) {
                const alt = c.alt || '';
                pre.images.push({ alt: normAlt(alt), src });
                inner.push('![' + escAlt(alt) + '](' + escUrl(src) + ')');
              }
            } else {
              walkBlock(c, inner);
            }
          }
          const cap = e.querySelector('figcaption');
          const capText = cap ? normalizeText(stripInline(inline(cap))) : '';
          if (capText) { pre.figures.push(capText); addText(capText); }
          if (inner.length) blocks.push(inner.join('\n') + (capText ? '\n*' + capText + '*' : ''));
          break;
        }
        case 'svg': // Note: SVG namespace elements have a lowercase tagName.
          // Matches claude.com's built-in copy-as-markdown: inline SVG (icons/graphics)
          // doesn't get its raw source dumped into the output.
          svgCount++;
          break;
        case 'A': {
          // Block-level links (e.g. nav/CTA): counted and kept with their href just like
          // inline A, instead of degrading into a plain-text paragraph.
          const text = inline(e).trim();
          const href = e.href || '';
          const plain = normalizeText(stripInline(text));
          if (plain && href && !/^javascript:/i.test(href)) {
            pre.links.push({ text: plain, url: href });
            blocks.push('[' + text + '](' + escUrl(href) + ')');
          } else {
            walkBlock(e, blocks);
          }
          break;
        }
        case 'HR':
          blocks.push('---');
          break;
        case 'IMG': {
          const src = e.currentSrc || e.src;
          if (src) {
            const alt = e.alt || '';
            pre.images.push({ alt: normAlt(alt), src });
            blocks.push('![' + escAlt(alt) + '](' + escUrl(src) + ')');
          }
          break;
        }
        default:
          walkBlock(e, blocks);
      }
    }
  }

  function note(msg) {
    if (!notes.includes(msg)) notes.push(msg);
  }

  const blocks = [];
  walkBlock(root, blocks);
  if (svgCount) note('Page contains ' + svgCount + ' inline SVG(s) (icons/graphics), source omitted');
  return { md: blocks.join('\n\n') + '\n', pre, notes };
}

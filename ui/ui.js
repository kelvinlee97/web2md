// 结果页:读 storage.session → 渲染报告/预览 → 复制/下载。
// 预览的渲染/原文两个视图共用同一个 payload.md 变量,复制 == 预览结构性相等。
// 本页无内联脚本(满足 MV3 CSP),所有 JS 在外部文件。

(async () => {
  const tab = new URLSearchParams(location.search).get('tab');
  if (!tab) return showError('缺少标签页参数。');
  const { ['t' + tab]: payload } = await chrome.storage.session.get('t' + tab);
  if (!payload) return showError('结果已失效(扩展重载或浏览器重启后清空),请重新点击扩展图标转换。');
  if (payload.error) return showError(payload.error);
  render(payload);
})();

function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.classList.remove('hidden');
  document.getElementById('preview').classList.add('hidden');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render({ md, report, meta }) {
  document.getElementById('page-title').textContent = meta.title || '(无标题)';
  document.getElementById('page-url').textContent = meta.url || '';
  const chip = document.getElementById('scope-chip');
  chip.textContent = meta.mode === 'full'
    ? '整页' + (meta.fallback ? '(回退)' : '') + (meta.confidence ? ' · 置信度 ' + meta.confidence + '%' : '')
    : '文章' + (meta.confidence ? ' · 置信度 ' + meta.confidence + '%' : '');
  chip.classList.add(meta.fallback ? 'chip-warn' : 'chip-ok');

  const panel = document.getElementById('report');
  panel.classList.add(report.pass ? 'report-pass' : 'report-fail');
  document.getElementById('summary').textContent = report.summary;

  const missingBox = document.getElementById('missing');
  for (const c of report.checks.filter((x) => !x.ok)) {
    const h = document.createElement('div');
    h.className = 'check-name';
    h.textContent = c.label + ' ' + c.pre + '/' + c.post;
    missingBox.appendChild(h);
    const ul = document.createElement('ul');
    for (const m of c.missing) {
      const li = document.createElement('li');
      li.textContent = m;
      ul.appendChild(li);
    }
    missingBox.appendChild(ul);
  }
  for (const n of report.notes || []) {
    const d = document.createElement('div');
    d.className = 'note';
    d.textContent = '说明:' + n;
    missingBox.appendChild(d);
  }

  const rendered = document.getElementById('rendered');
  rendered.innerHTML = mdToHtml(md);
  document.getElementById('raw').textContent = md;

  const copyBtn = document.getElementById('copy-btn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.textContent = '已复制 ✓';
    setTimeout(() => { copyBtn.textContent = '复制 Markdown'; }, 2000);
  });

  document.getElementById('download-btn').addEventListener('click', () => {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = String(meta.title || 'page').replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) + '.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById('tab-rendered').addEventListener('click', () => {
    document.getElementById('tab-rendered').classList.add('active');
    document.getElementById('tab-raw').classList.remove('active');
    rendered.classList.remove('hidden');
    document.getElementById('raw').classList.add('hidden');
  });
  document.getElementById('tab-raw').addEventListener('click', () => {
    document.getElementById('tab-raw').classList.add('active');
    document.getElementById('tab-rendered').classList.remove('active');
    document.getElementById('raw').classList.remove('hidden');
    rendered.classList.add('hidden');
  });
}

// ---- 迷你 markdown → HTML 渲染器:只覆盖 serialize.js 会产出的构造 ----

const IMG = /!\[((?:[^\]\\]|\\.)*)\]\(((?:[^()]|\([^()]*\))*)\)/g;
const LINK = /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g;

function inlineHtml(raw) {
  let s = esc(raw);
  s = s.replace(IMG, (m, alt, src) =>
    /^(https?:|data:image\/)/i.test(src) ? '<img alt="' + alt + '" src="' + src + '">' : m);
  s = s.replace(LINK, (m, text, url) =>
    /^(https?:|mailto:|#|\/)/i.test(url) ? '<a href="' + url + '" target="_blank" rel="noreferrer">' + text + '</a>' : m);
  s = s.replace(/`([^`]*)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/  \n/g, '<br>\n');
  return s;
}

// SVG 栅栏注入前剥离 script 与事件属性(页面内容不可信;CSP 之外的双保险)。
const svgSafe = (s) =>
  s.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')
   .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

function mdToHtml(md) {
  const lines = md.split('\n');
  const h = [];
  let i = 0;

  const para = () => {
    const buf = [];
    while (i < lines.length && lines[i].trim() &&
           !/^```/.test(lines[i]) && !/^>/.test(lines[i]) && !/^\|/.test(lines[i]) &&
           !/^(#{1,6})\s/.test(lines[i]) && !/^---+\s*$/.test(lines[i]) &&
           !/^\s*([-*+]|\d+\.)\s/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length) h.push('<p>' + inlineHtml(buf.join('\n').replace(/  \n/g, '\n')) + '</p>');
  };

  const listHtml = (items, idx, indent) => {
    const isOl = /^\d/.test(items[idx][2]);
    let html = '<' + (isOl ? 'ol' : 'ul') + '>';
    while (idx < items.length && items[idx][0] === indent) {
      html += '<li>' + inlineHtml(items[idx][3]);
      if (idx + 1 < items.length && items[idx + 1][0] > indent) {
        const sub = listHtml(items, idx + 1, items[idx + 1][0]);
        html += sub[0];
        idx = sub[1];
      }
      html += '</li>';
      idx++;
    }
    return [html + '</' + (isOl ? 'ol' : 'ul') + '>', idx];
  };

  const list = () => {
    const items = [];
    while (i < lines.length) {
      const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?(.*)$/);
      if (!m) break;
      items.push([m[1].length, m[2], m[2], m[4]]);
      i++;
    }
    if (items.length) h.push(listHtml(items, 0, items[0][0])[0]);
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fm = line.match(/^```(\S*)\s*$/);
    if (fm) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      if (fm[1] === 'svg') {
        h.push('<div class="svg-block">' + svgSafe(buf.join('\n')) + '</div>');
      } else {
        h.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      }
      continue;
    }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i]); i++; }
      h.push('<blockquote>' + mdToHtml(buf.map((l) => l.replace(/^>\s?/, '')).join('\n')) + '</blockquote>');
      continue;
    }
    if (/^\|/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i])) { buf.push(lines[i]); i++; }
      const rows = buf.map((l) => splitRow(l).map((c) => c.trim()));
      const header = rows[0];
      const body = rows.slice(1).filter((r) => !r.every((c) => /^-+$/.test(c)));
      h.push('<table><thead><tr>' + header.map((c) => '<th>' + inlineHtml(c) + '</th>').join('') + '</tr></thead><tbody>' +
        body.map((r) => '<tr>' + r.map((c) => '<td>' + inlineHtml(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      const lvl = hm[1].length;
      h.push('<h' + lvl + '>' + inlineHtml(hm[2]) + '</h' + lvl + '>');
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) { h.push('<hr>'); i++; continue; }
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) { list(); continue; }
    para();
  }
  return h.join('\n');
}

// 表格行按未转义管道拆分(与 core 一致的迷你版,避免为它加载核心文件)。
function splitRow(line) {
  const parts = line.replace(/^\||\|$/, '').split('|');
  const out = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].endsWith('\\')) out[out.length - 1] += '|' + p;
    else out.push(p);
  }
  return out.map((s) => s.replace(/\\\|/g, '|'));
}

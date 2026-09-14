// Result page: read from storage.session → render the report/preview → copy/download.
// Both preview views (rendered/raw) share the same payload.md, so copy == preview by construction.
// No inline <script> on this page (required by the MV3 CSP) — all JS lives in external files.

(async () => {
  const tab = new URLSearchParams(location.search).get('tab');
  if (!tab) return showError('Missing tab parameter.');
  let payload;
  try {
    ({ ['t' + tab]: payload } = await chrome.storage.session.get('t' + tab));
  } catch {
    return showError('Could not read the conversion result. Go back to the page and click the extension icon again.');
  }
  if (!payload) return showError('This result is no longer available (cleared after an extension reload or browser restart). Click the extension icon again to convert.');
  if (payload.error) return showError(payload.error);
  render(payload);
})();

function showError(msg) {
  const box = document.getElementById('error-box');
  document.getElementById('page-title').textContent = 'Unable to show the conversion result';
  document.getElementById('actions').classList.add('hidden');
  document.getElementById('report').classList.add('hidden');
  box.textContent = msg;
  box.classList.remove('hidden');
  document.getElementById('preview').classList.add('hidden');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render({ md, report, meta }) {
  document.getElementById('page-title').textContent = meta.title || '(untitled)';
  document.getElementById('page-url').textContent = meta.url || '';
  const chip = document.getElementById('scope-chip');
  chip.textContent = meta.mode === 'full' ? 'Full page' : 'Article';
  if (meta.fallback) {
    chip.textContent = 'No clear article found · check the scope';
    chip.classList.add('chip-warn');
  }
  document.title = (meta.title || 'Conversion result') + ' · Web2MD';
  document.getElementById('preview').classList.remove('hidden');

  const panel = document.getElementById('report');
  panel.classList.remove('hidden');
  panel.classList.add(report.pass ? 'report-pass' : 'report-fail');
  document.getElementById('summary').textContent = report.summary;

  document.getElementById('report-details').open = !report.pass;
  const rows = document.getElementById('check-rows');
  for (const check of report.checks) {
    const row = document.createElement('tr');
    for (const value of [check.label, check.pre, check.post, check.ok ? 'Match' : 'Differs']) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    }
    rows.appendChild(row);
  }

  const missingBox = document.getElementById('missing');
  for (const c of report.checks.filter((x) => !x.ok)) {
    const h = document.createElement('div');
    h.className = 'check-name';
    h.textContent = c.label + ': before ' + c.pre + ' → after ' + c.post;
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
    d.textContent = 'Note: ' + n;
    missingBox.appendChild(d);
  }

  const rendered = document.getElementById('rendered');
  rendered.innerHTML = mdToHtml(md);
  document.getElementById('raw').textContent = md;

  const copyBtn = document.getElementById('copy-btn');
  copyBtn.disabled = false;
  document.getElementById('download-btn').disabled = false;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      ta.remove();
      if (!copied) {
        copyBtn.textContent = 'Copy failed — download the .md instead';
        return;
      }
    }
    copyBtn.textContent = 'Copied ✓';
    setTimeout(() => { copyBtn.textContent = 'Copy Markdown'; }, 2000);
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
    document.getElementById('tab-rendered').setAttribute('aria-pressed', 'true');
    document.getElementById('tab-raw').setAttribute('aria-pressed', 'false');
    rendered.classList.remove('hidden');
    document.getElementById('raw').classList.add('hidden');
  });
  document.getElementById('tab-raw').addEventListener('click', () => {
    document.getElementById('tab-raw').setAttribute('aria-pressed', 'true');
    document.getElementById('tab-rendered').setAttribute('aria-pressed', 'false');
    document.getElementById('raw').classList.remove('hidden');
    rendered.classList.add('hidden');
  });
}

// ---- Mini Markdown → HTML renderer: covers only the constructs serialize.js can emit ----

const IMG = /!\[((?:[^\]\\]|\\.)*)\]\(((?:[^()]|\([^()]*\))*)\)/g;
const LINK = /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g;

// raw has already been through esc() (&/</>), but attribute values also need quotes escaped —
// otherwise a value can break out of the attribute and inject markup.
const attrSafe = (s) => s.replace(/"/g, '&quot;');

function inlineHtml(raw) {
  let s = esc(raw);
  s = s.replace(IMG, (m, alt, src) =>
    /^(https?:|data:image\/)/i.test(src) ? '<img alt="' + attrSafe(alt) + '" src="' + attrSafe(src) + '">' : m);
  s = s.replace(LINK, (m, text, url) =>
    /^(https?:|mailto:|#|\/)/i.test(url) ? '<a href="' + attrSafe(url) + '" target="_blank" rel="noreferrer">' + text + '</a>' : m);
  s = s.replace(/`([^`]*)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/  \n/g, '<br>\n');
  return s;
}

// Strip <script> and event-handler attributes before injecting fenced SVG (page content is
// untrusted; this is a belt-and-suspenders check on top of CSP).
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

// Split a table row on unescaped pipes (mini version matching core, to avoid loading the core file for this).
function splitRow(line) {
  const parts = line.replace(/^\||\|$/, '').split('|');
  const out = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].endsWith('\\')) out[out.length - 1] += '|' + p;
    else out.push(p);
  }
  return out.map((s) => s.replace(/\\\|/g, '|'));
}

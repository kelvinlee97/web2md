// Independent verification: parse the Markdown that serialization produced back into stats,
// and compare against the pre-stats collected during serialization.
// Only recognizes constructs serialize.js actually emits. Text is always derived via
// stripInline(), so both sides are necessarily symmetric.
// This file touches no chrome APIs.

function parseMarkdown(md) {
  const post = {
    headings: [], paragraphs: [], listItems: [], links: [], images: [],
    figures: [], tables: [], codeBlocks: [], text: '',
  };
  const addText = (s) => { if (s) post.text += ' ' + s; };

  // Extract images/links from the raw line (images first, so links aren't swallowed by `![...]`).
  function scanInline(line) {
    const rest = line.replace(IMG_RE, (m, alt, src) => {
      post.images.push({ alt: normAlt(alt), src: normUrl(src) });
      return '';
    });
    for (const m of rest.matchAll(LINK_RE)) {
      post.links.push({ text: normalizeText(stripInline(m[1])), url: normUrl(m[2]) });
    }
  }

  function classify(lines) {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      const fm = line.match(/^```(\S*)\s*$/);
      if (fm) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        post.codeBlocks.push(buf.join('\n'));
        addText(buf.join(' '));
        continue;
      }

      if (/^>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i]); i++; }
        classify(buf.map((l) => l.replace(/^>\s?/, '')));
        continue;
      }

      if (/^\|/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\|/.test(lines[i])) { buf.push(lines[i]); i++; }
        post.tables.push(Math.max(0, buf.length - 1));
        for (const l of buf) {
          if (splitRow(l).every((c) => /^\s*-+\s*$/.test(c))) continue; // separator rows don't count toward text stats
          scanInline(l);
          for (const cell of splitRow(l)) addText(stripInline(cell).replace(/\|/g, ' '));
        }
        continue;
      }

      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        const text = normalizeText(stripInline(hm[2]));
        post.headings.push({ lvl: hm[1].length, text });
        addText(text);
        scanInline(hm[2]);
        i++;
        continue;
      }

      if (/^---+\s*$/.test(line)) { i++; continue; }

      const lm = line.match(/^\s*([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?(.*)$/);
      if (lm) {
        const text = normalizeText(stripInline(lm[3]));
        post.listItems.push(text);
        addText(text);
        scanInline(line);
        i++;
        continue;
      }

      // A pure image line (nothing left after stripping the image syntax).
      if (/^!\[/.test(line) && !stripInline(line).trim()) {
        scanInline(line);
        i++;
        continue;
      }

      // A pure link line (block-level <a>, e.g. nav/CTA) — a link block, not a paragraph.
      if (/^\[[^\]]+\]\([^)]*\)\s*$/.test(line)) {
        scanInline(line);
        i++;
        continue;
      }

      // A caption: *text* immediately following an image line.
      const cm = line.match(/^\*(.+)\*$/);
      if (cm && i > 0 && /^!\[/.test(lines[i - 1])) {
        const text = normalizeText(stripInline(cm[1]));
        post.figures.push(text);
        addText(text);
        scanInline(line);
        i++;
        continue;
      }

      // A paragraph: consecutive non-special lines (including GFM hard breaks).
      const buf = [];
      while (i < lines.length && lines[i].trim() &&
             !/^```/.test(lines[i]) && !/^>/.test(lines[i]) && !/^\|/.test(lines[i]) &&
             !/^(#{1,6})\s/.test(lines[i]) && !/^---+\s*$/.test(lines[i]) &&
             !/^\s*([-*+]|\d+\.)\s/.test(lines[i]) &&
             !(/^\*(.+)\*$/.test(lines[i]) && i > 0 && /^!\[/.test(lines[i - 1]))) {
        buf.push(lines[i]);
        i++;
      }
      const raw = buf.join(' ');
      const text = normalizeText(stripInline(raw));
      if (text) { post.paragraphs.push(text); addText(text); }
      scanInline(raw);
    }
  }

  classify(md.split('\n'));
  post.text = post.text.trim();
  return post;
}

function buildReport(pre, md, notes = []) {
  const post = parseMarkdown(md);
  const checks = [];
  const MAX_MISSING = 20;
  const trunc = (s, n = 48) => (s.length > n ? s.slice(0, n) + '…' : s);
  const textEq = (a, b) => normalizeText(a) === normalizeText(b);

  const seq = (name, label, preArr, postArr, fmt, eqFn) => {
    const missing = [];
    const n = Math.max(preArr.length, postArr.length);
    for (let i = 0; i < n; i++) {
      if (i >= postArr.length) missing.push(fmt(preArr[i]));
      else if (i < preArr.length && !eqFn(preArr[i], postArr[i])) missing.push(fmt(preArr[i]));
    }
    checks.push({ name, label, pre: preArr.length, post: postArr.length, ok: missing.length === 0, missing: missing.slice(0, MAX_MISSING) });
  };

  seq('headings', 'Headings', pre.headings, post.headings,
      (h) => '#'.repeat(h.lvl) + ' ' + trunc(h.text),
      (a, b) => a.lvl === b.lvl && textEq(a.text, b.text));
  seq('paragraphs', 'Paragraphs', pre.paragraphs, post.paragraphs, (p) => trunc(p), textEq);
  seq('listItems', 'List items', pre.listItems, post.listItems, (l) => trunc(l), textEq);
  seq('links', 'Links', pre.links, post.links,
      (l) => '[' + trunc(l.text, 24) + '](' + l.url + ')',
      (a, b) => textEq(a.text, b.text) && textEq(a.url, b.url));
  seq('images', 'Images', pre.images, post.images,
      (m) => '![' + trunc(m.alt, 24) + '](' + m.src + ')',
      (a, b) => textEq(a.alt, b.alt) && textEq(a.src, b.src));
  seq('figures', 'Captions', pre.figures, post.figures, (f) => '*' + trunc(f) + '*', textEq);
  seq('codeBlocks', 'Code blocks', pre.codeBlocks, post.codeBlocks, (c) => trunc(c), textEq);

  const cnt = (name, label, a, b) =>
    checks.push({ name, label, pre: a, post: b, ok: a === b, missing: [] });
  cnt('tables', 'Tables', pre.tables.length, post.tables.length);

  const textOk = normalizeText(pre.text) === normalizeText(post.text);
  checks.push({ name: 'text', label: 'Text characters', pre: pre.text.trim().length, post: post.text.trim().length, ok: textOk, missing: [] });

  const pass = checks.every((c) => c.ok);
  const failed = checks.filter((c) => !c.ok);
  const summary = pass
    ? 'Checked — no conversion differences found'
    : 'Conversion differences found, please check: ' + failed.map((c) => c.label).join(', ');

  return { pass, checks, summary, notes };
}

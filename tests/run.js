// Core pipeline self-test: open with file:// directly, no server, no extension needed.
// Assertions: fixture exact counts / full mode / root detection / truncation failure path /
// determinism / text symmetry.

const container = document.createElement('div');
container.innerHTML = FIXTURE_HTML;
document.body.appendChild(container);

const results = [];
const assert = (name, cond) => results.push([name, !!cond]);

const article = domToMarkdown(container, 'article');
const post = parseMarkdown(article.md);
const report = buildReport(article.pre, article.md, article.notes);

// 1. Article mode exact counts
assert('headings 3', article.pre.headings.length === 3);
assert('paragraphs 7', article.pre.paragraphs.length === 7);
assert('listItems 8', article.pre.listItems.length === 8);
assert('links 7 (nav excluded)', article.pre.links.length === 7);
assert('images 2', article.pre.images.length === 2);
assert('figures 1', article.pre.figures.length === 1);
assert('tables 1', article.pre.tables.length === 1);
assert('codeBlocks 1', article.pre.codeBlocks.length === 1);
assert('report.pass', report.pass === true);
assert('pass summary does not stack counts', report.summary === 'Checked — no conversion differences found');

// 2. Full page mode: nav/footer counted
const full = domToMarkdown(container, 'full');
const fullReport = buildReport(full.pre, full.md, full.notes);
assert('full links 8', full.pre.links.length === 8);
assert('full paragraphs 9', full.pre.paragraphs.length === 9);
assert('full report.pass', fullReport.pass === true);

// 3. Article root detection
const det = detectArticleRoot(document);
assert('root is #content', det.root.id === 'content');
assert('not a fallback', det.isFallback === false);

// 4. Failure path: truncated md → must report incomplete with specific missing items
const truncated = buildReport(article.pre, article.md.slice(0, -30), article.notes);
assert('truncated pass=false', truncated.pass === false);
assert('diff summary lists failed items', truncated.summary === 'Conversion differences found, please check: ' + truncated.checks.filter((c) => !c.ok).map((c) => c.label).join(', '));
assert('truncated has missing detail', truncated.checks.some((c) => c.missing.length > 0));

// 5. Determinism (the core guarantee behind copy == preview)
assert('two serializations produce identical bytes', domToMarkdown(container, 'article').md === article.md);

// 6. URL normalization for parenthesized URLs
const paren = article.pre.links.find((l) => l.url.includes('wikipedia'));
assert('parenthesized URL normalized', paren && paren.url === 'https://en.wikipedia.org/wiki/A_(film)');
const parenPost = post.links.find((l) => l.url.includes('wikipedia'));
assert('parenthesized URL consistent before/after', parenPost && parenPost.url === paren.url);

// 7. Text symmetry (the integrity safety net)
assert('text symmetry', normalizeText(article.pre.text) === normalizeText(post.text));

// 8. Heading order preserved (position-sensitive, catches "lost intro" bugs)
assert('heading order consistent', JSON.stringify(article.pre.headings) === JSON.stringify(post.headings));

// 9. Hidden content excluded on both sides
const mdNoHidden = !article.md.includes('Hidden attribute') && !article.md.includes('Display none');
assert('hidden content not output', mdNoHidden);

// 10. Inline SVG source not output, only a note left
assert('svg has a skip note', article.notes.some((n) => n.includes('SVG')));
assert('svg source not output', !article.md.includes('<rect'));

// 11. Class-name nav div excluded in article mode, kept in full mode
assert('class-nav excluded in article', !article.md.includes('Explore here'));
assert('class-nav kept in full', full.md.includes('Explore here'));

// 12. Space inserted between adjacent element child nodes (metadata doesn't run together)
const meta = article.pre.listItems.find((l) => l.includes('Category'));
assert('metadata item has a space', meta === 'Category Claude Code Agents');

// 13. Visible aria-hidden text kept (letter-by-letter animated titles must not be dropped)
assert('visible aria-hidden text kept', article.md.includes('Aria-hidden but visible paragraph'));

const list = document.getElementById('results');
for (const [name, ok] of results) {
  const li = document.createElement('li');
  li.textContent = name;
  li.className = ok ? 'pass' : 'fail';
  list.appendChild(li);
}
const failed = results.filter(([, ok]) => !ok).length;
const title = document.querySelector('h1');
title.textContent = failed ? failed + ' FAILED / ' + results.length : 'ALL PASS (' + results.length + ')';
title.className = failed ? 'bad' : 'good';
console.log(title.textContent, failed ? results.filter(([, ok]) => !ok) : '');

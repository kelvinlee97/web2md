// 核心管线自检:file:// 直接打开,无需服务器、无需扩展。
// 断言:夹具精确计数 / full 模式 / 根检测 / 截断失败路径 / 确定性 / 文本对称。

const container = document.createElement('div');
container.innerHTML = FIXTURE_HTML;
document.body.appendChild(container);

const results = [];
const assert = (name, cond) => results.push([name, !!cond]);

const article = domToMarkdown(container, 'article');
const post = parseMarkdown(article.md);
const report = buildReport(article.pre, article.md, article.notes);

// 1. Article 模式精确计数
assert('headings 3', article.pre.headings.length === 3);
assert('paragraphs 7', article.pre.paragraphs.length === 7);
assert('listItems 8', article.pre.listItems.length === 8);
assert('links 7(nav 排除)', article.pre.links.length === 7);
assert('images 2', article.pre.images.length === 2);
assert('figures 1', article.pre.figures.length === 1);
assert('tables 1', article.pre.tables.length === 1);
assert('codeBlocks 1', article.pre.codeBlocks.length === 1);
assert('report.pass', report.pass === true);

// 2. Full page 模式:nav/footer 计入
const full = domToMarkdown(container, 'full');
const fullReport = buildReport(full.pre, full.md, full.notes);
assert('full links 8', full.pre.links.length === 8);
assert('full paragraphs 9', full.pre.paragraphs.length === 9);
assert('full report.pass', fullReport.pass === true);

// 3. 文章根检测
const det = detectArticleRoot(document);
assert('root 是 #content', det.root.id === 'content');
assert('未回退', det.isFallback === false);

// 4. 失败路径:截断 md → 必须报不完整且有具体缺失项
const truncated = buildReport(article.pre, article.md.slice(0, -30), article.notes);
assert('截断后 pass=false', truncated.pass === false);
assert('截断后有 missing 明细', truncated.checks.some((c) => c.missing.length > 0));

// 5. 确定性(复制 == 预览的核心保证)
assert('两次序列化字节一致', domToMarkdown(container, 'article').md === article.md);

// 6. 含括号 URL 规范化
const paren = article.pre.links.find((l) => l.url.includes('wikipedia'));
assert('括号 URL 规范化', paren && paren.url === 'https://en.wikipedia.org/wiki/A_(film)');
const parenPost = post.links.find((l) => l.url.includes('wikipedia'));
assert('括号 URL 前后一致', parenPost && parenPost.url === paren.url);

// 7. 文本对称(完整性兜底网)
assert('文本对称', normalizeText(article.pre.text) === normalizeText(post.text));

// 8. 标题序列保序(位置敏感,抓"导语丢失"类问题)
assert('标题序列一致', JSON.stringify(article.pre.headings) === JSON.stringify(post.headings));

// 9. 隐藏内容两侧都不计
const mdNoHidden = !article.md.includes('Hidden attribute') && !article.md.includes('Display none');
assert('隐藏内容未输出', mdNoHidden);

// 10. 内联 SVG 不输出原始代码,只留说明
assert('svg 有跳过说明', article.notes.some((n) => n.includes('SVG')));
assert('svg 源码未输出', !article.md.includes('<rect'));

// 11. 类名导航 div 在 article 模式跳过,full 模式保留
assert('class-nav article 排除', !article.md.includes('Explore here'));
assert('class-nav full 保留', full.md.includes('Explore here'));

// 12. 相邻元素子节点之间补空格(元信息不粘连)
const meta = article.pre.listItems.find((l) => l.includes('Category'));
assert('元信息项有空格', meta === 'Category Claude Code Agents');

// 13. aria-hidden 但可见的文本保留(分字动画标题不能被丢)
assert('aria-hidden 可见文本保留', article.md.includes('Aria-hidden but visible paragraph'));

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

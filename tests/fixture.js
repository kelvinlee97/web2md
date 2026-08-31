// 夹具:覆盖标题/段落/列表(嵌套/checkbox/ol start)/引用/代码/表格/图片/figure 图注/
// SVG/隐藏内容/外围(nav/footer)的真实 HTML 片段,作为 JS 字符串由 run.html 注入文档。

const FIXTURE_HTML = `
<div id="wrap">
  <nav><a href="https://example.com/nav1">Nav one</a></nav>
  <div class="nav_dropdown_component">Explore here</div>
  <div id="content">
    <h1>Article Title</h1>
    <p>Lead paragraph with a <a href="https://example.com/link1">link one</a> and <strong>bold</strong> text.</p>
    <h2>Section One</h2>
    <p>Paragraph with <code>inline()</code> code, an image <img src="https://example.com/img1.png" alt="pic one">, and a [bracket] text.</p>
    <h3>Sub Section</h3>
    <p>Emphasis <em>italic</em> and <del>deleted</del> text, link with bold: <a href="https://example.com/link2"><strong>bold link</strong></a>, and a <a href="https://en.wikipedia.org/wiki/A_(film)">paren link</a>.</p>
    <figure>
      <img src="https://example.com/figure.png" alt="Figure image">
      <figcaption>Figure 1 caption</figcaption>
    </figure>
    <ul>
      <li>Item one</li>
      <li>Item two with <a href="https://example.com/link3">link three</a>
        <ul>
          <li>Nested one</li>
          <li>Nested two</li>
        </ul>
      </li>
      <li><input type="checkbox" checked> Done item</li>
      <li><div>Category</div><a href="https://example.com/cat1">Claude Code</a><a href="https://example.com/cat2">Agents</a></li>
    </ul>
    <ol start="3">
      <li>Third</li>
      <li>Fourth</li>
    </ol>
    <blockquote>
      <p>Quoted text with <a href="https://example.com/link4">link four</a>.</p>
      <p>Second quoted paragraph.</p>
    </blockquote>
    <pre><code class="language-js">const x = 1;
console.log(x);</code></pre>
    <table>
      <tr><th>Col A</th><th>Col B</th></tr>
      <tr><td>1</td><td>2</td></tr>
      <tr><td>3</td><td>4</td></tr>
    </table>
    <svg width="10" height="10"><rect width="10" height="10" fill="#fff"/></svg>
    <div hidden>Hidden attribute text</div>
    <div style="display:none">Display none text</div>
    <p><span aria-hidden="true">Aria-hidden but visible paragraph</span></p>
    <p>Trailing paragraph.</p>
  </div>
  <footer>Footer text</footer>
</div>`;

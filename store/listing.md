# Chrome Web Store listing copy (copy-paste ready)

## Name (en)
Web2MD — Web page to Markdown (with an integrity report)

## Short description (≤132 chars, en)
Convert the current page to clean Markdown in one click, and get an honest report on whether the conversion is complete — never silent data loss. Free, local-first, zero dependencies.

## Detailed description (en)
Web2MD converts the current page to Markdown with copy / download. Unlike ordinary
converters, it ships with an **integrity report**: headings, paragraphs, lists, links,
images, tables, code blocks and text characters are counted independently before and
after conversion and compared item by item. Any loss triggers a red warning with the
exact missing items — never a silent "success".

- Two modes: toolbar click converts the article (auto-detected scope, prefers <main>);
  context menu converts the full page
- Clean output: nav/footer/menu boilerplate stripped; inline SVG source is not dumped,
  just noted in the report
- Integrity report: any loss is reported honestly; content Markdown can't express
  (iframe/video/SVG, etc.) is listed as a note
- Result page: rendered preview + raw Markdown, copy / download .md
- Local-first: page data never leaves the browser; zero dependencies, zero remote code

Permissions, explained:
- `activeTab`: only gets access to the current tab when you click the icon or the
  right-click menu, to convert that page
- `scripting`: injects the conversion script into the current page (only when
  user-triggered)
- `storage`: holds the conversion result in browser session memory (`storage.session`)
  for the result page to read; cleared when the browser closes
- `contextMenus`: the two "Convert to Markdown" right-click menu entries

Privacy: no data is collected, transmitted, or sold. No accounts, no analytics, no
remote servers.

## Category
Productivity

## Store privacy form (checkboxes/fields)
- Single purpose: convert the current page to Markdown for the user to copy/download
- Data handling: no user data collected; permissions are used only to convert the
  current page on a user gesture
- Privacy policy URL: https://kelvinlee97.github.io/web2md/privacy.html
  (falls back to https://github.com/kelvinlee97/web2md/blob/main/PRIVACY.md if Pages isn't enabled yet)

---

## Localized listing: Chinese (Simplified) — zh-CN

*Kept here for populating the Chrome Web Store's zh-CN locale listing form; not part of the codebase's primary language.*

### 名称(zh-CN)
Web2MD — 网页转 Markdown(带完整性报告)

### 简短说明(≤132 字符,zh-CN)
一键把当前网页转成干净的 Markdown,并如实报告转换是否完整——绝不静默丢内容。免费、本地优先、零依赖。

### 详细说明(zh-CN)
Web2MD 把当前网页转成 Markdown,可直接复制或下载 .md。与普通转换器不同,
它自带**完整性报告**:转换前后独立统计标题、段落、列表、链接、图片、表格、
代码块、文本字符并逐项对比,任何缺失都会红色告警并列出具体缺失项,而不是显示
"成功"。

- 两种模式:点图标转换文章(自动识别正文范围、优先 <main>),右键菜单可转整页
- 干净输出:剥除导航/页脚/菜单等外围内容;内联 SVG 不倾倒原始代码,只在报告中说明
- 完整性报告:任何缺失如实告警,iframe/视频/SVG 等无法用 Markdown 表达的内容以说明列出
- 结果页:阅读预览 + Markdown 源码双视图,复制 / 下载 .md
- 本地优先:页面数据不出浏览器,零依赖、零构建、不加载任何远程代码

权限说明(逐项):
- activeTab:仅在用户点击图标或右键菜单时获取当前标签页访问权,用于转换该页
- scripting:向当前页注入转换脚本(仅用户触发时)
- storage:把转换结果暂存于浏览器会话内存(storage.session),打开结果页用,浏览器关闭即清空
- contextMenus:右键菜单"转换为 Markdown"两个入口

隐私:不收集、不传输、不出售任何数据;没有账号、没有分析、没有远程服务器。

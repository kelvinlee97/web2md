# Web2MD — 网页转 Markdown(带完整性报告)

免费、本地优先的 Chrome 扩展:一键把当前网页转成 Markdown,并**如实报告转换是否完整**——绝不静默丢内容。核心逻辑零依赖、零构建,不接触 chrome API,可复用于 Safari Web Extension。

## 安装(加载已解压的扩展)

1. 打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择本目录 `web2md/`

## 使用

- **点扩展图标** → 转换文章(Article 模式,自动识别正文范围)
- **右键菜单** → `Web2MD:转换文章为 Markdown` / `Web2MD:转换整页为 Markdown`
- 结果页:完整性报告 + 渲染/原文预览 + `复制 Markdown` / `下载 .md`

## 完整性报告

转换前后独立统计并逐项对比:标题、段落、列表项、链接、图片、图注、表格、代码块、规范化文本字符。任何一项缺失 → 红色警告 + 具体缺失清单(而不是显示"成功")。iframe / 视频 / 内联 SVG 等无法用 Markdown 表达的内容会以说明列出。

## 文章范围(对齐 claude.com 内置 copy-as-markdown 的干净度)

- 优先取 `<main>` 作为转换根(有可信候选时),否则用启发评分选文章容器
- 剥除 `<nav>`/`<aside>`/`<footer>`/`<form>` 及类名带 nav/footer/menu/breadcrumb/pagination 的容器
- 内联 SVG(图标/图形)不输出原始代码,报告里说明数量
- aria-hidden 但可见的文本保留(分字动画标题不会被误删)

## 测试

用 Chrome 直接打开 `tests/run.html`(file:// 即可,无需服务器):断言夹具的精确计数、full 模式、根检测、截断失败路径、序列化确定性。期望 `ALL PASS`。

## 已知边界

- `chrome://` 等内置页面无法注入(结果页会提示)
- `file://` 页面需在扩展详情页手动开启「允许访问文件网址」
- 懒加载图片未加载时无 src,会如实不计入并跳过
- canvas / iframe 内容 / 闭合 Shadow DOM / 登录后内容 / 内联 SVG 原始代码不转换,以说明列出
- 扩展重载或浏览器重启后,未打开的旧结果失效,需重新转换

# Web2MD 发布 Chrome Web Store 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 web2md 打包并发布到 Chrome Web Store(可见性由用户在提交时选择)。

**Architecture:** 扩展本体零代码改动(代码已可发布);新增图标与商店素材,准备商店文案与隐私声明,打 zip 包,最后用户在开发者控制台完成上传提交。任务 1-4 由 agent 在 worktree 执行并提交,任务 5-6 是必须用户亲自做的控制台操作(付款、上传、审核)。

**Tech Stack:** 纯 JS MV3 扩展 + 纯 Python(zlib/struct,stdlib)PNG 生成脚本 + Playwright 截图 + gh CLI 提交推送。

**Spec:** [README.md](../../README.md)(产品规格);本计划为发布流程补充。

## Global Constraints

- 核心零依赖、零构建、无远程代码(Web Store MV3 政策硬性要求)——不得引入 CDN/远程加载
- 权限仅 activeTab、scripting、storage、contextMenus,商店描述中须逐项说明用途(审核友好)
- 版本号保持 0.1.0(商店上传用)
- 图标必须 PNG:16/32/48/128 四档,manifest 里加 `icons` 与 `action.default_icon`
- zip 包只含运行时文件:manifest.json、background.js、content.js、core/、ui/、icons/
- 隐私:不收集任何数据,商店隐私表单声明 + 仓库内 PRIVACY.md 作为 URL
- 每个任务结束 commit;全部完成后 push 分支并开 PR 回 main

## File Structure

- Create: `icons/gen_icon.py` — 纯 stdlib 生成 4 档图标 PNG(绿底圆角方块 + 白色 # 号)
- Create: `icons/icon16.png` `icons/icon32.png` `icons/icon48.png` `icons/icon128.png`(脚本产物)
- Modify: `manifest.json` — 加 icons / action.default_icon
- Create: `store/listing.md` — 商店文案(zh-CN + en)+ 权限说明 + 隐私声明文案,供控制台粘贴
- Create: `store/screenshot-1.png` `store/screenshot-2.png` — 1280x800 商店截图
- Create: `PRIVACY.md` — 仓库内隐私政策(供商店隐私 URL 引用)
- Create: `store/package.sh` — 打 zip 包脚本
- Create: `web2md-0.1.0.zip`(产物,gitignore `*.zip`)

---

### Task 1: 图标 + manifest 更新

**Files:**
- Create: `icons/gen_icon.py`
- Create: `icons/icon16.png` `icons/icon32.png` `icons/icon48.png` `icons/icon128.png`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: 无
- Produces: `icons/*.png`(manifest 引用);manifest 新键:`"icons": {"16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png"}`、`"action": { "default_icon": { "16": "icons/icon16.png", "32": "icons/icon32.png" } }`

- [ ] **Step 1: 写图标生成脚本(纯 stdlib,无 Pillow 依赖)**

```python
# icons/gen_icon.py — 纯 stdlib 生成绿底圆角方块 + 白色 # 号图标
import struct, zlib, math, os

def make_png(size, path):
    bg = (26, 127, 55)      # 绿色 #1a7f37
    fg = (255, 255, 255)    # 白色 # 号
    r = size * 0.22         # 圆角半径
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            inside = True
            if dx < r and dy < r:  # 角落:距圆心 (r, r) 的距离判断
                if math.hypot(r - dx, r - dy) > r:
                    inside = False
            # # 号:两根竖条 + 两根横条(尺寸按 size 比例)
            u = size * 0.62
            v = size * 0.38
            bar = size * 0.09
            gap = size * 0.14
            g1 = v - gap / 2 - bar   # 横条1 顶
            g2 = v + gap / 2         # 横条2 顶
            h1 = u - gap / 2 - bar   # 竖条1 左
            h2 = u + gap / 2         # 竖条2 左
            on_v = h1 <= x < h1 + bar or h2 <= x < h2 + bar
            on_h = g1 <= y < g1 + bar or g2 <= y < g2 + bar
            if not inside:
                px = (0, 0, 0, 0)        # 透明
            elif on_v and on_h:
                px = fg + (255,)
            elif on_v or on_h:
                px = fg + (255,)
            else:
                px = bg + (255,)
            row += bytes(px)
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path, len(png), 'bytes')

base = os.path.dirname(os.path.abspath(__file__))
for s in (16, 32, 48, 128):
    make_png(s, os.path.join(base, f'icon{s}.png'))
```

- [ ] **Step 2: 运行生成并校验 PNG 头**

Run: `cd icons && python3 gen_icon.py && file icon16.png icon32.png icon48.png icon128.png`
Expected: 每个输出 `PNG image data, N x N, 8-bit/color RGBA, non-interlaced`

- [ ] **Step 3: 更新 manifest.json 加图标键**

```json
{
  "manifest_version": 3,
  "name": "Web2MD",
  "version": "0.1.0",
  "description": "把当前网页转成 Markdown,并如实报告转换是否完整。",
  "permissions": ["activeTab", "scripting", "storage", "contextMenus"],
  "background": { "service_worker": "background.js" },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": { "default_icon": { "16": "icons/icon16.png", "32": "icons/icon32.png" } }
}
```

- [ ] **Step 4: 校验 manifest JSON**

Run: `python3 -m json.tool manifest.json > /dev/null && echo valid`
Expected: `valid`

- [ ] **Step 5: Commit**

```bash
git add icons/ manifest.json
git commit -m "feat: 商店图标与 manifest icons 键"
```

---

### Task 2: 商店截图(1280x800)

**Files:**
- Create: `store/screenshot-1.png`(结果页整体)
- Create: `store/screenshot-2.png`(原文 Markdown 视图)

**Interfaces:**
- Consumes: Playwright MCP 浏览器(本机 http 服务器 + chrome.storage 桩演示法)
- Produces: 两张 1280x800 PNG,控制台商店上传用

- [ ] **Step 1: 起本地服务器并打开演示结果页(viewport 1280x800)**

```bash
nohup python3 -m http.server 8742 --bind 127.0.0.1 >/dev/null 2>&1 &
```
Playwright run_code_unsafe:
1. `page.goto('https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models', {waitUntil:'load'})`
2. 内联注入 core 四件套(https 页加载 http 脚本被混合内容拦截,必须 content 注入)
3. `page.evaluate` 跑管线拿 payload;`page.addInitScript` 注入 chrome.storage 桩
4. `page.setViewportSize({width:1280, height:800})`
5. `page.goto('http://127.0.0.1:8742/ui/ui.html?tab=1', {waitUntil:'load'})`

- [ ] **Step 2: 截第一张(渲染预览视图)**

Playwright: `take_screenshot` 工具保存到 `store/screenshot-1.png`
Expected: 1280x800 PNG,页面含绿色「完整性:通过」报告与渲染预览

- [ ] **Step 3: 切原文视图截第二张**

Playwright: 点击 `#tab-raw` 后 `take_screenshot` 保存 `store/screenshot-2.png`
Expected: 显示 Markdown 原文文本

- [ ] **Step 4: 校验尺寸**

Run: `file store/screenshot-1.png store/screenshot-2.png`
Expected: `PNG image data, 1280 x 800`

- [ ] **Step 5: Commit**

```bash
git add store/screenshot-1.png store/screenshot-2.png
git commit -m "feat: 商店截图 1280x800"
```

---

### Task 3: 商店文案 + 隐私

**Files:**
- Create: `store/listing.md`
- Create: `PRIVACY.md`

**Interfaces:**
- Consumes: 无
- Produces: 控制台粘贴用文案;PRIVACY.md 的 GitHub 原文 URL 填商店隐私 URL 字段

- [ ] **Step 1: 写 store/listing.md(zh-CN 主,附 en)**

```markdown
# Chrome Web Store 上架文案(复制粘贴用)

## 名称(zh-CN)
Web2MD — 网页转 Markdown(带完整性报告)

## 简短说明(≤132 字符,zh-CN)
一键把当前网页转成干净的 Markdown,并如实报告转换是否完整——绝不静默丢内容。免费、本地优先、零依赖。

## 详细说明(zh-CN)
Web2MD 把当前网页转成 Markdown,可直接复制或下载 .md。与普通转换器不同,
它自带**完整性报告**:转换前后独立统计标题、段落、列表、链接、图片、表格、
代码块、文本字符并逐项对比,任何缺失都会红色告警并列出具体缺失项,而不是显示
"成功"。

- 两种模式:点图标转换文章(自动识别正文范围、优先 <main>),右键菜单可转整页
- 干净输出:剥除导航/页脚/菜单等外围内容;内联 SVG 不倾倒原始代码,只在报告中说明
- 完整性报告:任何缺失如实告警,iframe/视频/SVG 等无法用 Markdown 表达的内容以说明列出
- 结果页:渲染预览 + Markdown 原文双视图,复制 / 下载 .md
- 本地优先:页面数据不出浏览器,零依赖、零构建、不加载任何远程代码

权限说明(逐项):
- activeTab:仅在用户点击图标或右键菜单时获取当前标签页访问权,用于转换该页
- scripting:向当前页注入转换脚本(仅用户触发时)
- storage:把转换结果暂存于浏览器会话内存(storage.session),打开结果页用,浏览器关闭即清空
- contextMenus:右键菜单"转换为 Markdown"两个入口

隐私:不收集、不传输、不出售任何数据;没有账号、没有分析、没有远程服务器。

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
- Local-first: page data never leaves the browser; zero dependencies, zero remote code
- Result page: rendered preview + raw Markdown, copy / download .md

Permissions: activeTab & scripting — convert the current tab only when you click the
icon or context menu; storage — session-scoped handoff of the result to the result
page, cleared when the browser closes; contextMenus — right-click entry points.

Privacy: no data collected, transmitted or sold. No accounts, no analytics, no servers.

## 分类
生产工具(Productivity)

## 商店隐私表单(勾选/填写)
- 单一用途:将当前网页转换为 Markdown 供用户复制/下载
- 数据处理:不收集任何用户数据;权限只用于按用户手势转换当前页
- 隐私政策 URL: https://github.com/kelvinlee97/web2md/blob/main/PRIVACY.md
```

- [ ] **Step 2: 写 PRIVACY.md(仓库根)**

```markdown
# Privacy Policy

Web2MD 不收集、存储或传输任何个人数据。

- 扩展在本地浏览器内完成全部转换,页面内容只写入浏览器会话内存
  (chrome.storage.session),浏览器关闭即清空。
- 无账号、无遥测、无分析、无广告、无远程服务器;扩展不加载任何远程代码。
- 权限用途:activeTab/scripting 用于在你点击图标或右键菜单时转换当前页面;
  storage 用于把结果暂存到结果页;contextMenus 用于右键菜单入口。

如有疑问,请通过 GitHub issue 联系:https://github.com/kelvinlee97/web2md/issues
```

- [ ] **Step 3: Commit**

```bash
git add store/listing.md PRIVACY.md
git commit -m "docs: 商店文案与隐私政策"
```

---

### Task 4: 打包 zip + 校验

**Files:**
- Create: `store/package.sh`
- Create: `web2md-0.1.0.zip`(gitignore `*.zip`)

**Interfaces:**
- Consumes: Task 1 的 icons/、manifest.json;现有 core/ ui/ background.js content.js
- Produces: 可直接上传控制台的 zip

- [ ] **Step 1: 写打包脚本**

```bash
#!/usr/bin/env bash
# store/package.sh — 只打运行时文件
cd "$(dirname "$0")/.."
rm -f web2md-0.1.0.zip
zip -r web2md-0.1.0.zip \
  manifest.json background.js content.js \
  core ui icons \
  -x "*.DS_Store" -x "icons/gen_icon.py"
unzip -l web2md-0.1.0.zip
```

- [ ] **Step 2: 运行打包**

Run: `chmod +x store/package.sh && ./store/package.sh`
Expected: 列表含 manifest.json、background.js、content.js、core/ 4 个 js、ui/ 3 个文件、icons/ 4 个 png,不含 tests/、store/、docs/

- [ ] **Step 3: 冒烟校验(如本机有 Chrome)**

Run: `command -v google-chrome >/dev/null && google-chrome --headless=new --load-extension="$PWD" --disable-gpu about:blank 2>&1 | head -5 || echo "no chrome, 跳过"`
Expected: 无 "Failed to load extension" 类错误;无 Chrome 则跳过(28 项测试已覆盖代码正确性)

- [ ] **Step 4: Commit(gitignore 加 *.zip)**

```bash
printf '*.zip\n' >> .gitignore
git add store/package.sh .gitignore
git commit -m "build: 商店打包脚本"
```

---

### Task 5: 控制台上传(仅用户可做,agent 提供逐步指引)

- [ ] **Step 1: 注册开发者账号(一次性 $5 费用)**
  打开 https://chrome.google.com/webstore/devconsole/register → 用 Google 账号登录 → 支付 $5 → 完成邮箱验证
- [ ] **Step 2: 新建条目**
  开发者控制台 → "新条目(New item)" → 上传 `web2md-0.1.0.zip`
- [ ] **Step 3: 填写商店信息**
  按 `store/listing.md` 粘贴:名称、简短说明、详细说明(zh-CN 主)、分类「生产工具」、上传 `store/screenshot-*.png`
- [ ] **Step 4: 隐私填写**
  隐私标签页:勾选「不收集任何用户数据」声明 + 填 PRIVACY.md URL;权限用途从 listing.md 逐项粘贴
- [ ] **Step 5: 提交审核**
  选择可见性(公开 / 不公开测试 / 私密)→「提交以供审核」;审核通常数天,结果邮件通知
- [ ] **Step 6: 发布**
  审核通过后点击「发布」;若被拒,按邮件原因修改后重新提交(常见:权限说明不清/截图不符)

---

### Task 6: 发布后维护(可选,后续)

- 更新版本号 manifest.json + 新 zip 上传同一条目
- 商店评分/评论回复
- 若有 Safari 计划:核心文件已 chrome-free,可复用打包 Safari Web Extension(README 已述)

## Self-Review

1. **Spec coverage:** README 全部功能已在仓库(28 项测试通过);本计划覆盖商店全流程:图标(商店硬性要求)、截图、文案、隐私(政策要求)、打包、上传、发布。无缺口。
2. **Placeholder scan:** 无 TBD/TODO;所有代码与文案均已给出完整内容。
3. **Type consistency:** manifest 图标路径与 icons/ 产物一致;zip 清单与 File Structure 一致;listing.md 引用的 PRIVACY.md 路径与 Task 3 产物一致。

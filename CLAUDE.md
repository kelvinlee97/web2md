# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Web2MD is a Chrome MV3 extension that converts the current page (article body or full page) to Markdown locally, then runs an independent integrity check to report whether the conversion is complete — with no build step and no dependencies.

## Commands

There is no build/lint tooling. To run the test suite:

- Open `tests/run.html` directly in Chrome (`file://.../tests/run.html`) — no server needed. The page should show **ALL PASS**.
- Tests are plain assertions in `tests/run.js` run against a fixture DOM (`tests/fixture.js`); add new assertions there when changing `core/*.js` behavior.

To load the extension for manual testing: `chrome://extensions` → enable Developer Mode → "Load unpacked" → select the repo root.

## Architecture

The codebase is split so the **core conversion logic has zero Chrome API dependencies** and can be reused outside the extension (e.g. a Safari Web Extension) or run standalone in `tests/run.html`. Only `background.js`, `content.js`, and `ui/ui.js` touch `chrome.*` APIs.

Pipeline: `background.js` (service worker) → injects `content.js` (isolated world) → `content.js` calls into `core/*.js` → posts result back to `background.js` → opens `ui/ui.html`.

- **`core/extract.js`** — shared predicates/text utilities (`isHidden`, `isSkipped`, `stripInline`, markdown regexes). `stripInline()` is the single source of truth used by both serialization and integrity parsing, so the two sides cannot structurally drift apart.
- **`core/article.js`** — `detectArticleRoot(doc)`: readability-style heuristic scoring of `<p>/<pre>/<td>/<blockquote>/<li>` ancestors, with class-name positive/negative keyword lists (`POS`/`NEG`). Trusts `<main>` when it's a plausible candidate. Returns a confidence score; low confidence means the caller should fall back to full-page mode and say so in the report — never silently switch modes.
- **`core/serialize.js`** — `domToMarkdown(root, mode)`: single synchronous DOM walk that produces both the Markdown string and "pre" stats (headings/paragraphs/links/images/etc. counts) used later for integrity comparison. `mode` is `'article'` (skips nav/aside/footer/form and nav-like class names) or `'full'`.
- **`core/integrity.js`** — `parseMarkdown(md)` re-parses the generated Markdown back into "post" stats using only constructs `serialize.js` actually emits, then `buildReport(pre, md, notes)` diffs pre vs. post and reports pass/fail plus specific missing items (not just counts).
- **`content.js`** — thin per-injection entry point: reads `globalThis.__WEB2MD_MODE`, runs `detectArticleRoot` (article mode only) then `domToMarkdown`, sends `{type: 'WEB2MD_RESULT', payload}` via `chrome.runtime.sendMessage`. Injection is idempotent — repeated clicks just rerun it.
- **`background.js`** — service worker. Because SW lifetime is unreliable, payloads go to `chrome.storage.session` (not kept in SW memory) keyed by tab id, then `ui/ui.html?tab=<id>` is opened to read it back. Mode is passed into the injected page via a separate `executeScript` call (`func`) before injecting the `files` array, since `func` and `files` can't be combined in one call. Context menu items are registered once in `onInstalled` (with `removeAll` first, for idempotent dev reloads).
- **`ui/ui.js`** — reads the payload from `chrome.storage.session`, renders the reading preview and the integrity report (`report.checks`, missing-items detail), and wires copy/download. No inline `<script>` (MV3 CSP requires external JS files only).

### Integrity check invariant

The report's "pre" stats (collected during serialization) and "post" stats (re-parsed from the emitted Markdown) are computed through the same predicates and the same `stripInline()` text normalization, from two different files (`serialize.js` and `integrity.js`). When extending Markdown output (new construct, new escaping rule), both sides must stay in sync — `integrity.js` only recognizes constructs `serialize.js` actually emits — or the self-check will produce false failures/passes.

# Chrome Web Store launch checklist

Status as of the `1.0.0` prep pass. Items already done in this repo vs. what
still requires the developer to act in the Chrome Web Store dashboard
(no API/tooling can do these from a repo).

## Done in this repo

- [x] `manifest.json` version bumped to `1.0.0`.
- [x] `store/package.sh` and CI package verification now derive the zip
      filename from `manifest.json` instead of a hardcoded version.
- [x] Automated test suite (`tests/run.html`) verified green under headless
      Chromium (matches what CI runs).
- [x] Core conversion pipeline (`detectArticleRoot` → `domToMarkdown` →
      `parseMarkdown` → `buildReport`) smoke-tested against real DOM fixtures
      in a real Chromium instance (not just the test harness), covering:
      article-mode extraction, full-page mode, nav/aside/footer stripping,
      tables, code blocks, links, images+captions.
      This session's network policy blocks arbitrary outbound HTTPS, so the
      smoke test ran against local fixtures (`docs/example.html` plus a
      synthetic full-page fixture) rather than live external sites —
      **do the live-site pass below before submitting**.
- [x] Found and documented a real edge case: a paragraph whose text is a lone
      `|` character causes a false "differences found" report (the reparser
      misreads it as a table row). Documented in README; not fixed in
      `core/*.js` since a proper fix touches the pre/post parity invariant
      described in `CLAUDE.md` and deserves its own dedicated change + tests,
      not a rushed one under a launch-readiness pass.
- [x] `docs/privacy.html` added — a hostable copy of `PRIVACY.md` — plus
      `.github/workflows/pages.yml` to publish `docs/` via GitHub Pages.
- [x] `store/listing.md` privacy policy URL updated to the future Pages URL
      (`https://kelvinlee97.github.io/web2md/privacy.html`), falling back to
      the raw `PRIVACY.md` link until Pages is enabled.

## Still required (Chrome Web Store dashboard / GitHub repo settings — not scriptable from here)

1. **Enable GitHub Pages**: repo Settings → Pages → Source: "GitHub Actions".
   The `pages.yml` workflow will then deploy `docs/` on every push to `main`
   that touches `docs/**`. Trigger it once manually (workflow_dispatch) after
   enabling, then confirm `https://kelvinlee97.github.io/web2md/privacy.html`
   loads.
2. **Chrome Web Store developer account**: register at
   https://chrome.google.com/webstore/devconsole (one-time $5 fee) if not
   already done.
3. **Live-site smoke test**: manually load the unpacked extension
   (`chrome://extensions` → Developer mode → Load unpacked) and run it
   against 2-3 real articles (a news site, a blog, a docs page) to confirm
   article detection and the integrity report behave as expected outside
   the test fixtures. This environment cannot reach the open internet, so
   this step must happen on a machine with normal network access.
4. **Fill the Store listing form** using `store/listing.md` — name,
   description, category, and the "Single purpose" / data-use disclosure
   fields (answer "no data collected" per `PRIVACY.md`). Paste the
   `activeTab`/`scripting`/`storage`/`contextMenus` justifications verbatim
   from the listing doc when asked to justify permissions.
5. **Upload assets**: `icons/icon128.png` (128×128, already correct) and
   `store/screenshot-1.png` (1280×800, already correct). Consider adding a
   second screenshot showing the full-page mode or a failed integrity
   report, since only one is currently prepared.
6. **Build and upload the package**: run `store/package.sh`, which now
   produces `web2md-1.0.0.zip`, and upload that zip to the dashboard.
7. **Submit for review.** MV3 extensions typically take 1-3 business days;
   `scripting`/`activeTab` may prompt reviewer questions — answer using the
   permission justifications already written in `store/listing.md`.

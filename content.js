// Thin entry point injected into the page's isolated world on demand: read the mode →
// run the core pipeline → send the result back.
// Injection itself is the trigger, and repeated clicks just idempotently rerun it.
// This is the only file besides background.js that touches any chrome.* API.

(() => {
  const mode = globalThis.__WEB2MD_MODE === 'full' ? 'full' : 'article';
  let root = document.body;
  let isFallback = false;
  let confidence = 1;
  if (mode === 'article') {
    const det = detectArticleRoot(document);
    root = det.root;
    isFallback = det.isFallback;
    confidence = det.confidence;
  }
  const { md, pre, notes } = domToMarkdown(root, mode);
  chrome.runtime.sendMessage({
    type: 'WEB2MD_RESULT',
    payload: {
      md,
      report: buildReport(pre, md, notes),
      meta: {
        title: document.title,
        url: location.href,
        mode,
        fallback: isFallback,
        confidence: Math.round(confidence * 100),
      },
    },
  });
})();

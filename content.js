// 按需注入页面隔离世界的薄入口:读模式 → 跑核心管线 → 回传结果。
// 注入即触发,重复点击幂等重跑。只此文件接触 chrome API。

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

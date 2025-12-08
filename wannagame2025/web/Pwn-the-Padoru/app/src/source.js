const lootManager = require('./lib/lootManager');
const db = require('./db');
const gameEngine = require('./game/gameEngine');

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getSource(req, res) {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: 'URL is required.' });
  }

  let inspectedUrl;
  try {
    inspectedUrl = new URL(url);
  } catch {
    return res.status(400).json({ message: 'Invalid URL provided.' });
  }

  if (!/^https?:$/.test(inspectedUrl.protocol)) {
    return res.status(400).json({ message: 'Only http and https targets are supported.' });
  }

  const dataDir = 'source';
  const userDir = req.user.user_dir;
  await lootManager.prepareRunSpace(userDir, dataDir);

  try {
    const response = await fetch(inspectedUrl.toString(), {
      signal: AbortSignal?.timeout ? AbortSignal.timeout(12000) : undefined
    });
    const html = await response.text();

    const escapedUrl = escapeHtml(inspectedUrl.toString());

    await lootManager.saveText(userDir, dataDir, 'source.html', html, 'text/html');
    const viewerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Captured Source | ${escapedUrl}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { color-scheme: dark; }
    body {
      margin:0;
      min-height:100vh;
      font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:#05060f;
      color:#f5f7ff;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:1.5rem;
      padding:2.5rem 1.5rem 3rem;
    }
    header {
      max-width:960px;
      text-align:center;
    }
    h1 {
      font-size:1.35rem;
      margin-bottom:0.35rem;
      letter-spacing:0.04em;
    }
    p {
      margin:0;
      color:#c8cfef;
      font-size:0.95rem;
    }
    .viewer {
      width:min(1024px, 95vw);
      height:70vh;
      border-radius:14px;
      overflow:hidden;
      border:1px solid rgba(125,146,255,0.35);
      box-shadow:0 16px 38px rgba(4,6,18,0.55);
      background:#0e1430;
    }
    iframe {
      width:100%;
      height:100%;
      border:0;
      background:#05060f;
    }
    .actions {
      display:flex;
      gap:1rem;
      justify-content:center;
      flex-wrap:wrap;
    }
    a {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:0.65rem 1.2rem;
      border-radius:999px;
      text-decoration:none;
      font-weight:600;
      color:#05060f;
      background:linear-gradient(135deg,#8aefff,#5a9dff);
      box-shadow:0 0 18px rgba(90,157,255,0.45);
    }
    a.secondary {
      background:linear-gradient(135deg,#ffe0f4,#ff9ac9);
      box-shadow:0 0 18px rgba(255,154,201,0.35);
    }
  </style>
</head>
<body>
  <header>
    <h1>Source captured</h1>
    <p>Target: ${escapedUrl}</p>
  </header>
  <div class="viewer">
    <iframe src="source.html" title="Captured source"></iframe>
  </div>
  <div class="actions">
    <a href="source.html" download>Download raw HTML</a>
    <a class="secondary" href="../../dashboard">Return to dashboard</a>
  </div>
</body>
</html>`;
    await lootManager.saveText(userDir, dataDir, 'index.html', viewerHtml, 'text/html');

    await db.saveCrawl({
      user_id: req.user.id,
      url: inspectedUrl.toString(),
      data_dir: dataDir,
      type: 'source',
      meta: { length: html.length }
    });
    await db.recordLootEvent({
      user_id: req.user.id,
      event_name: 'source_capture',
      metadata: { url: inspectedUrl.toString(), bytes: html.length }
    });
    await gameEngine.recordAction(req.user, 'sourceGrab');

    res.json({
      message: 'Source captured.',
      data_dir: dataDir,
      local_path: `/view/${dataDir}/`
    });
  } catch (error) {
    console.error('Source fetch failed:', error);
    res.status(500).json({ message: 'Failed to capture source.' });
  }
}

module.exports = {
  getSource
};

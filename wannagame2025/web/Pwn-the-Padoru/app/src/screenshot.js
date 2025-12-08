const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra');
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

async function takeScreenshot(req, res) {
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

  const dataDir = 'screenshot';
  const userDir = req.user.user_dir;
  const runRoot = await lootManager.prepareRunSpace(userDir, dataDir);
  const screenshotPath = path.join(runRoot, 'screenshot.png');
  const profileDir = path.join('/tmp', userDir, 'profiles', dataDir);
  await fs.ensureDir(profileDir);

  let browser;
  try {
    browser = await puppeteer.launch({
      userDataDir: profileDir,
      executablePath: process.env.CHROME_BIN || process.env.PUPPETEER_EXEC_PATH || '/usr/bin/google-chrome',
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', `--user-data-dir=${profileDir}`]
    });
    const page = await browser.newPage();
    await page.goto(inspectedUrl.toString(), { waitUntil: 'networkidle2', timeout: 15000 });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    //await new Promise(resolve => setTimeout(resolve, 10000));
    await browser.close();
    browser = null;

    const escapedUrl = escapeHtml(inspectedUrl.toString());
    const viewerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Screenshot | ${escapedUrl}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      min-height: 100vh;
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
      width: min(1024px, 98vw);
      border-radius:14px;
      background:#0e1430;
      border:1px solid rgba(125,146,255,0.35);
      padding:1.25rem;
      box-shadow:0 16px 38px rgba(4, 6, 18, 0.55);
    }
    img {
      width:100%;
      border-radius:10px;
      border:1px solid rgba(125,146,255,0.2);
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
    <h1>Screenshot captured</h1>
    <p>Target: ${escapedUrl}</p>
  </header>
  <div class="viewer">
    <img src="screenshot.png" alt="Screenshot of ${escapedUrl}">
  </div>
  <div class="actions">
    <a href="screenshot.png" download>Download image</a>
    <a class="secondary" href="../../dashboard">Return to dashboard</a>
  </div>
</body>
</html>`;
    await lootManager.saveText(userDir, dataDir, 'index.html', viewerHtml, 'text/html');

    await db.saveCrawl({
      user_id: req.user.id,
      url: inspectedUrl.toString(),
      data_dir: dataDir,
      type: 'screenshot',
      meta: { screenshot: 'screenshot.png' }
    });
    await db.recordLootEvent({
      user_id: req.user.id,
      event_name: 'screenshot',
      metadata: { url: inspectedUrl.toString(), path: 'screenshot.png' }
    });
    await gameEngine.recordAction(req.user, 'screenshot');

    res.json({
      message: 'Screenshot captured.',
      data_dir: dataDir,
      local_path: `/view/${dataDir}/`
    });
  } catch (error) {
    console.error('Screenshot failed:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ message: 'Failed to take screenshot.' });
  }
}

module.exports = {
  takeScreenshot
};

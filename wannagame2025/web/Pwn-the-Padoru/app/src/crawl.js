process.env.HOME = '/tmp';

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra');
const { URL } = require('url');
const db = require('./db');
const lootManager = require('./lib/lootManager');
const gameEngine = require('./game/gameEngine');

function randomElement(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function analyzeUrl(targetUrl) {
  const techStack = [
    'Node.js', 'Express', 'PostgreSQL', 'Redis',
    'Cloudflare Workers', 'Svelte', 'Rust', 'Go'
  ];
  const securityRatings = ['S', 'A+', 'A', 'B', 'C'];
  const loreSnippets = [
    'The server hums with cosmic energy.',
    'A hidden admin panel flickers into view briefly.',
    'Legacy JavaScript artifacts detected in the wild.',
    'An out-of-date service worker whispers tales of CSP misconfigurations.'
  ];

  return {
    seo_score: Math.floor(Math.random() * 40) + 60,
    security_rating: randomElement(securityRatings),
    technologies: Array.from({ length: 3 }, () => randomElement(techStack)),
    lore: randomElement(loreSnippets),
    preview: new URL(targetUrl).hostname
  };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crawlWebsite(req, res) {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: 'URL is required.' });
  }

  let inspectedUrl;
  try {
    inspectedUrl = new URL(url);
  } catch {
    return res.status(400).json({ message: 'Invalid URL supplied.' });
  }

  if (!/^https?:$/.test(inspectedUrl.protocol)) {
    return res.status(400).json({ message: 'Only http and https targets are supported.' });
  }

  const userId = req.user.id;
  const userDir = req.user.user_dir;
  const dataDir = 'crawl';
  const crawlRunPath = await lootManager.prepareRunSpace(userDir, dataDir);
  const profileDir = path.join('/tmp', userDir, 'profiles', dataDir);
  await fs.ensureDir(profileDir);

  let browser;
  try {
    const crawlMeta = {
      originalUrl: inspectedUrl.toString(),
      startedAt: new Date().toISOString()
    };

    browser = await puppeteer.launch({
      userDataDir: profileDir,
      executablePath: process.env.CHROME_BIN || process.env.PUPPETEER_EXEC_PATH || '/usr/bin/google-chrome',
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        `--user-data-dir=${profileDir}`
      ],
      ignoreDefaultArgs: ["--disable-client-side-phishing-detection", "--disable-component-update", "--force-color-profile=srgb"]
    });

    const page = await browser.newPage();
    await page.setUserAgent('AniCrawl-Arcade/2.0 (+https://anicrawl.example)');

    const collectedAssets = [];

    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const resourceType = request.resourceType();
      const requestUrl = request.url();

      if (['image', 'stylesheet', 'script'].includes(resourceType)) {
        let assetUrl;
        try {
          assetUrl = new URL(requestUrl);
        } catch {
          request.continue();
          return;
        }

        if (!/^https?:$/.test(assetUrl.protocol)) {
          request.continue();
          return;
        }

        try {
          const response = await fetch(requestUrl, {
            signal: AbortSignal?.timeout ? AbortSignal.timeout(5000) : undefined
          });
          if (response.ok) {
            const assetBuffer = Buffer.from(await response.arrayBuffer());
            const safePath = path.join(assetUrl.hostname, assetUrl.pathname);
            await lootManager.saveBinary(userDir, dataDir, safePath, assetBuffer);
            collectedAssets.push(safePath);
          }
        } catch (err) {
          console.warn(`Failed to archive asset ${requestUrl}: ${err.message}`);
        }

        request.continue();
        return;
      }

      request.continue();
    });

    const response = await page.goto(inspectedUrl.toString(), { waitUntil: 'networkidle2', timeout: 15000 });
    const pageContent = await page.content();
    const pageTitle = await page.title();

    await lootManager.saveText(userDir, dataDir, 'index.html', pageContent, 'text/html');
    await fs.writeJson(path.join(crawlRunPath, 'manifest.json'), {
      title: pageTitle,
      assets: collectedAssets,
      analyzed: await analyzeUrl(inspectedUrl.toString()),
      capturedAt: new Date().toISOString()
    }, { spaces: 2 });
    await sleep(3000);
    await browser.close();
    browser = null;

    await db.saveCrawl({
      user_id: userId,
      url: inspectedUrl.toString(),
      data_dir: dataDir,
      type: 'browser',
      meta: { title: pageTitle }
    });
    await db.recordLootEvent({
      user_id: userId,
      event_name: 'browser_crawl',
      metadata: { url: inspectedUrl.toString(), assets: collectedAssets.length }
    });
    await gameEngine.recordAction(req.user, 'browserCrawl');

    res.json({
      message: 'Arcade crawler finished its run.',
      title: pageTitle,
      data_dir: dataDir,
      local_path: `/view/${dataDir}/index.html`
    });
  } catch (err) {
    console.error('Crawling failed:', err);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ message: 'Crawling failed.' });
  }
}

module.exports = {
  crawlWebsite,
  analyzeUrl
};

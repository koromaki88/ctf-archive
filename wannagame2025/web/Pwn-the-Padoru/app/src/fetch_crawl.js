const path = require('path');
const fs = require('fs-extra');
const { URL } = require('url');
const { parse } = require('node-html-parser');
const db = require('./db');
const gameEngine = require('./game/gameEngine');

const LEGACY_SAFE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.css', '.js', '.svg', '.ico'];

function relaxedRelativePath(rawPath) {
  if (!rawPath) {
    return '';
  }
  const trimmed = rawPath.replace(/^\/+/, '');
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function isLikelyBinary(pathname) {
  const ext = path.extname(pathname).toLowerCase();
  return LEGACY_SAFE_EXTENSIONS.includes(ext);
}

function looksLikeText(buffer) {
  for (const b of buffer) {
    if (b === 0x00) return false;
    if (b < 0x09) return false;
    if (b >= 0x0E && b <= 0x1F) return false;
  }
  return true;
}

function filePath(candidate) {
  if (!candidate) return '';
  let s = String(candidate);
  s = s.replace(/[?#].*$/, '');
  s = s.replace(/^(?:(?:https?:)?\/\/[^/]+\/?)/i, '');
  if (s.startsWith('/')) s = s.slice(1);
  return s;
}

async function fetchCrawl(req, res) {
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

  const dataDir = 'fetch';
  const userDir = req.user.user_dir;
  const crawlRoot = path.join('/tmp', userDir, dataDir);

  try {
    await fs.emptyDir(crawlRoot);

    const pageResponse = await fetch(inspectedUrl.toString(), {
      signal: AbortSignal?.timeout ? AbortSignal.timeout(12000) : undefined
    });
    const rawHtml = await pageResponse.text();

    const root = parse(rawHtml);
    const resources = new Map();
    root.querySelectorAll('img, script, link[rel="stylesheet"]').forEach((element) => {
      const candidate = element.getAttribute('src') || element.getAttribute('href');
      if (!candidate) {
        return;
      }
      try {
        const assetUrl = new URL(candidate, inspectedUrl.toString());
        if (/^https?:$/.test(assetUrl.protocol)) {
          resources.set(assetUrl.toString(), candidate);
        }
      } catch {
        /* ignore */
      }
    });

    const downloaded = [];
    for (const [absoluteUrl, candidate] of resources) {
      try {
        const assetUrl = new URL(absoluteUrl);
        if (!/^https?:$/.test(assetUrl.protocol)) continue;

        const Path = filePath(candidate);
        const derivedRelative = relaxedRelativePath(Path);

        const destinationPath = path.join(crawlRoot, derivedRelative);
        await fs.ensureDir(path.dirname(destinationPath));

        const controller = AbortSignal?.timeout ? AbortSignal.timeout(7000) : undefined;
        const response = await fetch(absoluteUrl, { signal: controller });
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!looksLikeText(buffer)){
          console.warn(`Skipping non-text asset for legacy fetch crawler`);
          continue;
        }
        await fs.writeFile(destinationPath, buffer);

        if (isLikelyBinary(assetUrl.pathname)) {
          downloaded.push({ asset: assetUrl.pathname, bytes: buffer.length });
        }
      } catch (err) {
        console.warn(`Legacy asset download failed for ${absoluteUrl}: ${err.message}`);
      }
    }

    await fs.writeFile(path.join(crawlRoot, 'index.html'), rawHtml, 'utf8');

    await db.saveCrawl({
      user_id: req.user.id,
      url: inspectedUrl.toString(),
      data_dir: dataDir,
      type: 'fetch',
      meta: { resources: downloaded.length }
    });
    await db.recordLootEvent({
      user_id: req.user.id,
      event_name: 'fetch_crawl',
      metadata: { url: inspectedUrl.toString(), downloads: downloaded }
    });
    await gameEngine.recordAction(req.user, 'fetchCrawl');

    res.json({
      message: 'Legacy fetch crawler archived the page.',
      data_dir: dataDir,
      local_path: `/view/${dataDir}/index.html`,
      downloads: downloaded.length
    });
  } catch (err) {
    console.error('Fetch crawler crashed:', err);
    res.status(500).json({ message: 'Fetch crawler failed.' });
  }
}

module.exports = {
  fetchCrawl
};

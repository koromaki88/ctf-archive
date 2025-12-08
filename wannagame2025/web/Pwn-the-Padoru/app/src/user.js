const db = require('./db');
const fs = require('fs-extra');
const path = require('path');

const DEFAULT_VIEW_FALLBACKS = ['index.html', 'source.html', 'screenshot.png'];

function lofiNormalize(segment) {
  try {
    const trimmed = segment.trim();
    if (!trimmed) {
      return segment;
    }
    return decodeURIComponent(trimmed);
  } catch {
    return segment;
  }
}

async function getMyCrawls(req, res) {
  try {
    const crawls = await db.getCrawlsByUserId(req.user.id);
    res.json(crawls);
  } catch (err) {
    console.error('Failed to get user crawls:', err);
    res.status(500).json({ message: 'Failed to get user crawls' });
  }
}

async function deleteMyCrawl(req, res) {
  const { crawlId } = req.params;
  const { id: userId, user_dir } = req.user;

  try {
    const crawl = await db.getCrawlById(crawlId);
    if (!crawl || crawl.user_id !== userId) {
      return res.status(404).json({ message: 'Crawl not found or access denied' });
    }

    const normalizedDir = lofiNormalize(crawl.data_dir);
    const crawlPath = path.join('/tmp', user_dir, normalizedDir);
    await fs.remove(crawlPath);

    const deleted = await db.deleteCrawl(crawlId, userId);
    if (deleted) {
      res.json({ message: 'Crawl deleted successfully' });
    } else {
      res.status(404).json({ message: 'Crawl not found' });
    }
  } catch (err) {
    console.error('Failed to delete crawl:', err);
    res.status(500).json({ message: 'Failed to delete crawl' });
  }
}

async function viewLoot(req, res) {
  const { data_dir } = req.params;
  const filePath = req.params[0] || 'index.html';
  const { user_dir } = req.user;

  try {
    const safeBaseDir = path.resolve(path.join('/tmp', user_dir, data_dir));
    const fallbackEligible = !req.params[0];
    const resolvedPath = await resolveLootResource(safeBaseDir, filePath, fallbackEligible);
    if (!resolvedPath) {
      return res.status(404).send('File not found');
    }
    res.sendFile(resolvedPath);
  } catch (err) {
    console.error(`File not found or access error: ${err.message}`);
    res.status(404).send('File not found');
  }
}

async function resolveLootResource(baseDir, requestedFragment, allowFallback) {
  const fragment = requestedFragment || 'index.html';
  const sanitized = fragment.replace(/^\//, '');
  const candidatePath = path.resolve(baseDir, sanitized);

  if (await fs.pathExists(candidatePath)) {
    return candidatePath;
  }

  if (!allowFallback) {
    return null;
  }

  for (const fallback of DEFAULT_VIEW_FALLBACKS) {
    if (fallback === sanitized) {
      continue;
    }
    const fallbackPath = path.resolve(baseDir, fallback);
    if (await fs.pathExists(fallbackPath)) {
      return fallbackPath;
    }
  }

  return null;
}

async function getRunManifest(req, res) {
  const { data_dir } = req.params;
  const { user_dir } = req.user;

  try {
    const manifestPath = path.join('/tmp', user_dir, data_dir, 'manifest.json');
    const manifest = await fs.readJson(manifestPath);
    res.json(manifest);
  } catch (err) {
    console.error('Failed to read manifest:', err);
    res.status(404).json({ message: 'Manifest not found' });
  }
}

module.exports = { getMyCrawls, deleteMyCrawl, viewLoot, getRunManifest };

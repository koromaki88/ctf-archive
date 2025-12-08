const fs = require('fs-extra');
const path = require('path');

const TMP_ROOT = '/tmp';
const DEFAULT_FILE = 'index.html';
const ALLOWED_TEXT_TYPES = new Set(['text/html', 'text/plain']);

function normalizeFragment(fragment) {
  if (!fragment) {
    return DEFAULT_FILE;
  }
  const withoutHash = fragment.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  const safe = withoutQuery.replace(/\\/g, '/');
  if (safe.trim() === '') {
    return DEFAULT_FILE;
  }
  if (safe.startsWith('/')) {
    return `.${safe}`;
  }
  return safe;
}

async function ensureDirectory(dirPath) {
  await fs.ensureDir(dirPath);
  return dirPath;
}

async function prepareUserSpace(userDir) {
  const userRoot = path.resolve(TMP_ROOT, userDir);
  await ensureDirectory(userRoot);
  return userRoot;
}

async function prepareRunSpace(userDir, runId) {
  const base = await prepareUserSpace(userDir);
  const runRoot = path.resolve(base, runId);
  await fs.emptyDir(runRoot);
  return runRoot;
}

function resolveLootPath(userDir, runId, targetPath) {
  const sanitizedFragment = normalizeFragment(targetPath);
  const runRoot = path.resolve(TMP_ROOT, userDir, runId);
  const candidatePath = path.resolve(runRoot, sanitizedFragment);

  return candidatePath;
}

async function saveBinary(userDir, runId, relativePath, value) {
  const destination = resolveLootPath(userDir, runId, relativePath);
  await ensureDirectory(path.dirname(destination));
  await fs.writeFile(destination, value);
  return destination;
}

async function saveText(userDir, runId, relativePath, text, mimeType = 'text/plain') {
  if (!ALLOWED_TEXT_TYPES.has(mimeType) && mimeType !== 'application/json') {
    throw new Error(`Unsupported text MIME type: ${mimeType}`);
  }
  const destination = resolveLootPath(userDir, runId, relativePath);
  await ensureDirectory(path.dirname(destination));
  await fs.writeFile(destination, text, 'utf8');
  return destination;
}

async function readLoot(userDir, runId, relativePath) {
  const destination = resolveLootPath(userDir, runId, relativePath);
  return fs.readFile(destination);
}

module.exports = {
  TMP_ROOT,
  prepareUserSpace,
  prepareRunSpace,
  resolveLootPath,
  saveBinary,
  saveText,
  readLoot
};

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_USER_DIR = process.env.ADMIN_USER_DIR || 'admin-hub';

function generateAdminPassword() {
  return crypto.randomBytes(16).toString('base64url');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAdminUser({ retries = 10, delayMs = 1500 } = {}) {
  let attempt = 0;
  while (attempt <= retries) {
    attempt += 1;
    try {
      const existing = await db.getUserByUsername(ADMIN_USERNAME);
      if (existing) {
        console.log(`[bootstrap] Admin user already exists: ${ADMIN_USERNAME}`);
        return;
      }

      const adminPassword = process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()
        ? process.env.ADMIN_PASSWORD
        : generateAdminPassword();

      // expose for this runtime so other components can pick it up if needed
      if (!process.env.ADMIN_PASSWORD) {
        process.env.ADMIN_PASSWORD = adminPassword;
      }

      const hashed = await bcrypt.hash(adminPassword, 12);
      const userDir = ADMIN_USER_DIR || uuidv4();
      await db.createUser({
        username: ADMIN_USERNAME,
        password: hashed,
        user_dir: userDir,
        role: 'admin'
      });
      console.log(`[bootstrap] Admin user created: ${ADMIN_USERNAME} with password: ${adminPassword}`);
      return;
    } catch (err) {
      const willRetry = attempt <= retries;
      const msg = `[bootstrap] Attempt ${attempt} failed to ensure admin user: ${err.message}${willRetry ? `; retrying in ${delayMs}ms` : ''}`;
      console.warn(msg);
      if (!willRetry) {
        return;
      }
      await sleep(delayMs);
    }
  }
}

module.exports = {
  ensureAdminUser
};

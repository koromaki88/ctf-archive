const { Pool } = require('pg');

const DEFAULT_ROLE = 'player';

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || process.env.DB_HOST || 'postgres',
        port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
        database: process.env.PGDATABASE || process.env.DB_NAME || 'anicrawl'
      }
);

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function getUsers() {
  const { rows } = await query(
    `SELECT id, username, role, user_dir, created_at
     FROM users
     ORDER BY id ASC`
  );
  return rows;
}

async function getUserById(id) {
  const { rows } = await query(
    `SELECT id, username, password, role, user_dir, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getUserByUsername(username) {
  const { rows } = await query(
    `SELECT id, username, password, role, user_dir, created_at
     FROM users
     WHERE username = $1`,
    [username]
  );
  return rows[0] || null;
}

async function createUser({ username, password, user_dir, role = DEFAULT_ROLE }) {
  const { rows } = await query(
    `INSERT INTO users (username, password, user_dir, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, role, user_dir, created_at`,
    [username, password, user_dir, role]
  );
  return rows[0];
}

async function updateUserDirectory(userId, userDir) {
  const { rows } = await query(
    `UPDATE users
     SET user_dir = $2
     WHERE id = $1
     RETURNING id, username, role, user_dir, created_at`,
    [userId, userDir]
  );
  return rows[0] || null;
}

async function ensureUserDirectory(userId, fallbackDir) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (!user.user_dir) {
    const updated = await updateUserDirectory(userId, fallbackDir);
    return updated.user_dir;
  }
  return user.user_dir;
}

async function saveCrawl({ user_id, url, data_dir, type = 'browser', meta = null }) {
  const metaPayload = meta ? JSON.stringify(meta) : null;
  const existing = await query(
    `SELECT id
     FROM crawls
     WHERE user_id = $1 AND crawl_type = $2
     ORDER BY created_at DESC`,
    [user_id, type]
  );

  if (existing.rows.length) {
    const targetId = existing.rows[0].id;
    const { rows } = await query(
      `UPDATE crawls
       SET url = $1,
           data_dir = $2,
           meta = $3::jsonb,
           created_at = NOW()
       WHERE id = $4
       RETURNING id, user_id, url, data_dir, crawl_type, created_at`,
      [url, data_dir, metaPayload, targetId]
    );

    if (existing.rows.length > 1) {
      await query(
        `DELETE FROM crawls
         WHERE user_id = $1 AND crawl_type = $2 AND id <> $3`,
        [user_id, type, targetId]
      );
    }

    return rows[0];
  }

  const { rows } = await query(
    `INSERT INTO crawls (user_id, url, data_dir, crawl_type, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, user_id, url, data_dir, crawl_type, created_at`,
    [user_id, url, data_dir, type, metaPayload]
  );
  return rows[0];
}

async function getCrawlsByUserId(userId) {
  const { rows } = await query(
    `SELECT id, user_id, url, data_dir, crawl_type, created_at
     FROM (
       SELECT c.*,
              ROW_NUMBER() OVER (PARTITION BY c.crawl_type ORDER BY c.created_at DESC) AS rn
       FROM crawls c
       WHERE c.user_id = $1
     ) ranked
     WHERE rn = 1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function getAllCrawls() {
  const { rows } = await query(
    `SELECT id, user_id, url, data_dir, crawl_type, created_at
     FROM crawls
     ORDER BY created_at DESC`
  );
  return rows;
}

async function getCrawlById(crawlId) {
  const { rows } = await query(
    `SELECT id, user_id, url, data_dir, crawl_type, created_at
     FROM crawls
     WHERE id = $1`,
    [crawlId]
  );
  return rows[0] || null;
}

async function deleteCrawl(crawlId, userId) {
  const { rowCount } = await query(
    `DELETE FROM crawls
     WHERE id = $1 AND user_id = $2`,
    [crawlId, userId]
  );
  return rowCount > 0;
}

async function recordLootEvent({ user_id, event_name, metadata }) {
  const payload = typeof metadata === 'object' && metadata !== null ? JSON.stringify(metadata) : null;
  const { rows } = await query(
    `INSERT INTO loot_events (user_id, event_name, metadata)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, user_id, event_name, metadata, created_at`,
    [user_id, event_name, payload]
  );
  return rows[0];
}

async function getRecentLootEvents(limit = 20, { includeHttpTrace = false } = {}) {
  const { rows } = await query(
    `SELECT le.id,
            le.user_id,
            u.username,
            le.event_name,
            le.metadata,
            le.created_at
     FROM loot_events le
     JOIN users u ON u.id = le.user_id
     WHERE ($2::text IS NULL OR le.event_name <> $2)
     ORDER BY le.created_at DESC
     LIMIT $1`,
    [limit, includeHttpTrace ? null : 'http_trace']
  );
  return rows.map((row) => ({
    ...row,
    metadata: parseJson(row.metadata)
  }));
}

async function getLootEventsForUser(userId, limit = 20, { includeHttpTrace = false } = {}) {
  const { rows } = await query(
    `SELECT id, user_id, event_name, metadata, created_at
     FROM loot_events
     WHERE user_id = $1
       AND ($3::text IS NULL OR event_name <> $3)
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit, includeHttpTrace ? null : 'http_trace']
  );
  return rows.map((row) => ({
    ...row,
    metadata: parseJson(row.metadata)
  }));
}

async function getDashboardSnapshot(userId) {
  const [recentCrawls, totalCrawls, lastLoot] = await Promise.all([
    query(
      `SELECT id, url, created_at, crawl_type
       FROM crawls
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    ),
    query(
      `SELECT COUNT(*) AS total
       FROM crawls
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT event_name, created_at
       FROM loot_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )
  ]);

  return {
    recentCrawls: recentCrawls.rows,
    totalCrawls: Number(totalCrawls.rows[0]?.total || 0),
    lastLootEvent: lastLoot.rows[0] ? { ...lastLoot.rows[0], metadata: parseJson(lastLoot.rows[0].metadata) } : null
  };
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

module.exports = {
  query,
  getUsers,
  getUserById,
  getUserByUsername,
  createUser,
  ensureUserDirectory,
  saveCrawl,
  getCrawlsByUserId,
  getAllCrawls,
  getCrawlById,
  deleteCrawl,
  recordLootEvent,
  getRecentLootEvents,
  getLootEventsForUser,
  getDashboardSnapshot
};

const db = require('./db');

async function getAllUsers(req, res) {
  try {
    const users = await db.getUsers();
    // Never expose password hashes, even to admins.
    const sanitizedUsers = users.map(u => ({ id: u.id, username: u.username, role: u.role, user_dir: u.user_dir }));
    res.json(sanitizedUsers);
  } catch (err) {
    console.error('Failed to get all users:', err);
    res.status(500).json({ message: 'Failed to get all users' });
  }
}

async function getAllCrawls(req, res) {
  try {
    const crawls = await db.getAllCrawls();
    res.json(crawls);
  } catch (err) {
    console.error('Failed to get all crawls:', err);
    res.status(500).json({ message: 'Failed to get all crawls' });
  }
}

async function getEventLog(req, res) {
  try {
    const events = await db.getRecentLootEvents(50, { includeHttpTrace: true });
    res.json(events);
  } catch (err) {
    console.error('Failed to get loot events:', err);
    res.status(500).json({ message: 'Failed to get loot events' });
  }
}

module.exports = { getAllUsers, getAllCrawls, getEventLog };

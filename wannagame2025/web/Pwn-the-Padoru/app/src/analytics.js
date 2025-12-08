const db = require('./db');

async function getArcadeAnalytics(req, res) {
  try {
    const [recentRuns, lootLog, scoreboard] = await Promise.all([
      db.getCrawlsByUserId(req.user.id),
      db.getLootEventsForUser(req.user.id, 15),
      db.getRecentLootEvents(10)
    ]);

    res.json({
      runs: recentRuns.slice(0, 10),
      loot: lootLog,
      publicLoot: scoreboard
    });
  } catch (err) {
    console.error('Failed to compute analytics:', err);
    res.status(500).json({ message: 'Failed to compute analytics.' });
  }
}

module.exports = {
  getArcadeAnalytics
};

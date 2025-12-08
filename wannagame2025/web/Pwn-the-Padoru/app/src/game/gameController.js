const gameEngine = require('./gameEngine');
const db = require('../db');

async function getArcadeProfile(req, res) {
  try {
    const [profile, scoreboard, snapshot, lootLog] = await Promise.all([
      gameEngine.getProfile(req.user.id),
      gameEngine.getScoreboard(),
      db.getDashboardSnapshot(req.user.id),
      db.getLootEventsForUser(req.user.id, 10)
    ]);

    res.json({
      profile,
      scoreboard,
      snapshot,
      lootLog
    });
  } catch (err) {
    console.error('Failed to hydrate arcade profile:', err);
    res.status(500).json({ message: 'Failed to load arcade profile.' });
  }
}

async function listQuests(req, res) {
  try {
    const quests = await gameEngine.listQuests();
    res.json({ quests });
  } catch (err) {
    console.error('Failed to list quests:', err);
    res.status(500).json({ message: 'Failed to fetch quest list.' });
  }
}

async function startQuest(req, res) {
  const { questId } = req.body;
  if (!questId) {
    return res.status(400).json({ message: 'questId is required.' });
  }

  try {
    const result = await gameEngine.startQuest(req.user, questId);
    res.json({ message: 'Quest state updated.', result });
  } catch (err) {
    console.error('Failed to start quest:', err);
    res.status(500).json({ message: 'Could not start quest.' });
  }
}

async function completeQuest(req, res) {
  const { questId } = req.body;
  if (!questId) {
    return res.status(400).json({ message: 'questId is required.' });
  }

  try {
    const profile = await gameEngine.completeQuest(req.user, questId);
    res.json({ message: 'Quest marked complete.', profile });
  } catch (err) {
    console.error('Failed to complete quest:', err);
    res.status(500).json({ message: 'Could not complete quest.' });
  }
}

async function logExploit(req, res) {
  const { vulnId, note } = req.body;
  if (!vulnId || typeof vulnId !== 'string') {
    return res.status(400).json({ message: 'vulnId is required.' });
  }
  try {
    await db.recordLootEvent({
      user_id: req.user.id,
      event_name: 'exploit_log',
      metadata: { vulnId, note }
    });
    await gameEngine.recordAction(req.user, 'fetchCrawl', { exploitId: vulnId, secretFind: note });
    res.json({ message: 'Exploit log recorded.' });
  } catch (err) {
    console.error('Failed to log exploit:', err);
    res.status(500).json({ message: 'Could not log exploit.' });
  }
}

async function getLeaderboard(req, res) {
  try {
    const [scoreboard, recentLoot] = await Promise.all([
      gameEngine.getScoreboard(),
      db.getRecentLootEvents(25)
    ]);
    res.json({ scoreboard, recentLoot });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    res.status(500).json({ message: 'Failed to load leaderboard.' });
  }
}

module.exports = {
  getArcadeProfile,
  listQuests,
  startQuest,
  completeQuest,
  logExploit,
  getLeaderboard
};

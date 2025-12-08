const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const GAME_STATE_FILE = path.join('/tmp', 'anicrawl-game-state.json');

const ACTION_REWARDS = {
  register: 20,
  browserCrawl: 35,
  fetchCrawl: 15,
  screenshot: 10,
  sourceGrab: 12,
  questComplete: 40
};

const QUEST_ARCHIVE = [
  {
    id: 'tutorial',
    title: 'Boot Sequence',
    description: 'Complete your first crawl with the arcade browser.',
    requiredAction: 'browserCrawl',
    reward: 40
  },
  {
    id: 'resource-hoarder',
    title: 'Resource Hoarder',
    description: 'Use the fetch crawler to harvest at least three asset files.',
    requiredAction: 'fetchCrawl',
    reward: 55
  },
  {
    id: 'pixel-perfect',
    title: 'Pixel Perfect',
    description: 'Capture a screenshot of any target site.',
    requiredAction: 'screenshot',
    reward: 30
  },
  {
    id: 'source-diver',
    title: 'Source Diver',
    description: 'Save the raw source of a page using the source collector.',
    requiredAction: 'sourceGrab',
    reward: 25
  }
];

async function loadState() {
  try {
    const exists = await fs.pathExists(GAME_STATE_FILE);
    if (!exists) {
      const blank = { players: {} };
      await fs.writeJson(GAME_STATE_FILE, blank, { spaces: 2 });
      return blank;
    }
    const state = await fs.readJson(GAME_STATE_FILE);
    if (!state.players) {
      state.players = {};
    }
    return state;
  } catch (err) {
    console.error('Unable to read game state, regenerating baseline:', err);
    const fallback = { players: {} };
    await fs.writeJson(GAME_STATE_FILE, fallback, { spaces: 2 });
    return fallback;
  }
}

async function persistState(state) {
  await fs.writeJson(GAME_STATE_FILE, state, { spaces: 2 });
}

function computeLevel(xp) {
  if (xp <= 40) return 1;
  if (xp <= 120) return 2;
  if (xp <= 240) return 3;
  if (xp <= 400) return 4;
  if (xp <= 600) return 5;
  return 6 + Math.floor((xp - 600) / 300);
}

function computeAchievements(player) {
  const badges = new Set(player.achievements || []);
  if (player.stats.browserCrawl >= 5) {
    badges.add('scout');
  }
  if (player.stats.fetchCrawl >= 3 && player.stats.sourceGrab >= 3) {
    badges.add('researcher');
  }
  if (player.stats.screenshot >= 3) {
    badges.add('artist');
  }
  if (player.exploitsLogged && player.exploitsLogged.length >= 2) {
    badges.add('bug_hunter');
  }
  return [...badges];
}

async function ensurePlayer(user) {
  const state = await loadState();
  if (!state.players[user.id]) {
    state.players[user.id] = {
      playerId: user.id,
      username: user.username,
      xp: 0,
      level: 1,
      stats: {
        register: 0,
        browserCrawl: 0,
        fetchCrawl: 0,
        screenshot: 0,
        sourceGrab: 0,
        questComplete: 0
      },
      achievements: [],
      inventory: [],
      activeQuests: {},
      completedQuests: {},
      exploitNotes: [],
      exploitsLogged: [],
      lastActionAt: null,
      apiKeys: []
    };
  } else {
    state.players[user.id].username = user.username;
  }
  await persistState(state);
  return state.players[user.id];
}

async function registerPlayer(user) {
  const state = await loadState();
  const player = state.players[user.id] || await ensurePlayer(user);
  player.stats.register += 1;
  player.xp += ACTION_REWARDS.register;
  player.level = computeLevel(player.xp);
  player.lastActionAt = new Date().toISOString();
  await persistState(state);
  return player;
}

async function recordAction(user, action, metadata = {}) {
  const reward = ACTION_REWARDS[action];
  if (!reward) {
    return null;
  }
  const state = await loadState();
  const player = state.players[user.id] || await ensurePlayer(user);
  player.stats[action] = (player.stats[action] || 0) + 1;
  player.xp += reward;
  if (metadata.secretFind) {
    player.exploitNotes.push({
      id: uuidv4(),
      value: metadata.secretFind,
      timestamp: new Date().toISOString()
    });
  }
  if (metadata.exploitId && !player.exploitsLogged.includes(metadata.exploitId)) {
    player.exploitsLogged.push(metadata.exploitId);
  }
  player.achievements = computeAchievements(player);
  player.level = computeLevel(player.xp);
  player.lastActionAt = new Date().toISOString();
  await persistState(state);
  return player;
}

async function listQuests() {
  return QUEST_ARCHIVE.map((quest) => ({ ...quest }));
}

async function startQuest(user, questId) {
  const state = await loadState();
  const player = state.players[user.id] || await ensurePlayer(user);
  if (!QUEST_ARCHIVE.some((quest) => quest.id === questId)) {
    throw new Error('Unknown quest');
  }
  if (player.completedQuests[questId]) {
    return { status: 'complete' };
  }
  player.activeQuests[questId] = {
    questId,
    startedAt: new Date().toISOString()
  };
  await persistState(state);
  return { status: 'active' };
}

async function completeQuest(user, questId) {
  const quest = QUEST_ARCHIVE.find((q) => q.id === questId);
  if (!quest) {
    throw new Error('Unknown quest');
  }
  const state = await loadState();
  const player = state.players[user.id] || await ensurePlayer(user);
  if (player.completedQuests[questId]) {
    return player;
  }
  player.completedQuests[questId] = {
    questId,
    reward: quest.reward,
    completedAt: new Date().toISOString()
  };
  delete player.activeQuests[questId];
  player.stats.questComplete = (player.stats.questComplete || 0) + 1;
  player.xp += ACTION_REWARDS.questComplete + quest.reward;
  player.level = computeLevel(player.xp);
  player.achievements = computeAchievements(player);
  player.lastActionAt = new Date().toISOString();
  await persistState(state);
  return player;
}

async function getProfile(userId) {
  const state = await loadState();
  return state.players[userId] || null;
}

async function getScoreboard() {
  const state = await loadState();
  return Object.values(state.players)
    .map((player) => ({
      playerId: player.playerId,
      username: player.username,
      xp: player.xp,
      level: player.level,
      achievements: player.achievements || [],
      lastActionAt: player.lastActionAt,
      stats: player.stats
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 20);
}

module.exports = {
  ACTION_REWARDS,
  registerPlayer,
  ensurePlayer,
  recordAction,
  listQuests,
  startQuest,
  completeQuest,
  getProfile,
  getScoreboard
};

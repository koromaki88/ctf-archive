const statusBar = document.getElementById('statusBar');

function flash(message, tone = 'info') {
  if (!statusBar) return;
  statusBar.textContent = message;
  statusBar.dataset.tone = tone;
  statusBar.classList.add('visible');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => statusBar.classList.remove('visible'), 4200);
}

async function apiFetch(url, { method = 'GET', body, headers = {} } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { ...headers }
  };

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = payload?.message || res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clearElement(el) {
  if (!el) return;
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function addHint(container, text, tag = 'p') {
  if (!container) return;
  clearElement(container);
  const el = document.createElement(tag);
  el.className = 'hint';
  el.textContent = text;
  container.appendChild(el);
}

function isValidHttpUrl(candidate) {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function initSnow() {
  const canvas = document.getElementById('snow-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const flakes = [];
  let w = 0;
  let h = 0;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function spawnFlake() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.4 + 0.6,
      speedY: Math.random() * 0.7 + 0.6,
      drift: (Math.random() - 0.5) * 0.6,
      opacity: Math.random() * 0.6 + 0.4
    };
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const flake of flakes) {
      flake.y += flake.speedY;
      flake.x += flake.drift;
      if (flake.y > h + 4) {
        flake.y = -4;
        flake.x = Math.random() * w;
      }
      if (flake.x < -4) flake.x = w + 4;
      if (flake.x > w + 4) flake.x = -4;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${flake.opacity})`;
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  const flakeCount = Math.min(200, Math.floor((window.innerWidth * window.innerHeight) / 5000));
  for (let i = 0; i < flakeCount; i++) {
    flakes.push(spawnFlake());
  }
  draw();
}

async function handleLogout() {
  try {
    await apiFetch('/logout', { method: 'POST' });
  } catch {
    // ignore errors, we still redirect out
  }
  window.location.href = '/';
}

function wireLogoutButtons() {
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
}

async function initLanding() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const sessionPanel = document.getElementById('sessionPanel');
  const sessionUser = document.getElementById('sessionUser');

  async function checkSession() {
    try {
      const data = await apiFetch('/api/arcade/profile');
      if (data?.profile?.username) {
        sessionUser.textContent = data.profile.username;
        sessionPanel.hidden = false;
      }
    } catch {
      sessionPanel.hidden = true;
    }
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(loginForm);
    const body = {
      username: form.get('username'),
      password: form.get('password')
    };
    try {
      await apiFetch('/login', { method: 'POST', body });
      flash('Logged in — redirecting to dashboard', 'success');
      setTimeout(() => (window.location.href = '/dashboard'), 300);
    } catch (err) {
      flash(err.message || 'Login failed', 'error');
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(registerForm);
    const body = {
      username: form.get('username'),
      password: form.get('password')
    };
    try {
      await apiFetch('/register', { method: 'POST', body });
      flash('Account created', 'success');
      // window.location.href = '/dashboard';
    } catch (err) {
      flash(err.message || 'Registration failed', 'error');
    }
  });

  await checkSession();
}

function renderRuns(container, runs, { onManifest, onDelete } = {}) {
  if (!container) return;
  clearElement(container);
  if (!runs || !runs.length) {
    addHint(container, 'No crawls yet. Run one from the form above.');
    return;
  }
  runs.forEach((run) => {
    const div = document.createElement('div');
    div.className = 'item';

    const head = document.createElement('div');
    head.className = 'item-head';
    const strong = document.createElement('strong');
    strong.textContent = (run.crawl_type || '').toUpperCase();
    const badge = document.createElement('span');
    badge.className = 'badge subtle';
    badge.textContent = `#${run.id}`;
    head.appendChild(strong);
    head.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const urlSpan = document.createElement('span');
    urlSpan.textContent = run.url;
    const timeSpan = document.createElement('span');
    timeSpan.textContent = `Started: ${formatTime(run.created_at)}`;
    const link = document.createElement('a');
    link.href = `/view/${encodeURIComponent(run.data_dir)}/`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open archive';
    meta.append(urlSpan, timeSpan, link);

    const actions = document.createElement('div');
    actions.className = 'cta-row run-actions';
    const manifestBtn = document.createElement('button');
    manifestBtn.className = 'pill ghost';
    manifestBtn.dataset.action = 'manifest';
    manifestBtn.dataset.dir = encodeURIComponent(run.data_dir);
    manifestBtn.textContent = 'View manifest';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pill danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.id = run.id;
    deleteBtn.textContent = 'Delete';
    actions.append(manifestBtn, deleteBtn);

    const manifestView = document.createElement('pre');
    manifestView.className = 'manifest-view hint';
    manifestView.hidden = true;

    div.append(head, meta, actions, manifestView);
    container.appendChild(div);

    manifestBtn.addEventListener('click', () => onManifest?.(run, manifestView));
    deleteBtn.addEventListener('click', () => onDelete?.(run));
  });
}

function renderFeed(container, entries) {
  if (!container) return;
  const filtered = (entries || []).filter((entry) => entry.event_name !== 'http_trace');
  clearElement(container);
  if (!filtered.length) {
    addHint(container, 'No loot events yet.', 'li');
    return;
  }
  filtered.forEach((entry) => {
    const li = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = entry.event_name;
    const time = document.createElement('time');
    time.textContent = formatTime(entry.created_at);
    const meta = document.createElement('span');
    meta.textContent = typeof entry.metadata === 'object' && entry.metadata ? JSON.stringify(entry.metadata) : '';
    li.append(title, document.createElement('br'), time, document.createElement('br'), meta);
    container.appendChild(li);
  });
}

function renderMiniList(container, items, fallback) {
  if (!container) return;
  clearElement(container);
  if (!items || !items.length) {
    const hintTag = container.tagName && container.tagName.toLowerCase() === 'ul' ? 'li' : 'p';
    addHint(container, fallback, hintTag);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    container.appendChild(li);
  });
}

function setLoading(container, text) {
  if (!container) return;
  const tag = container.tagName ? container.tagName.toLowerCase() : '';
  const wrapper = tag === 'ul' || tag === 'ol' ? 'li' : 'p';
  addHint(container, text, wrapper);
}

async function initDashboard() {
  const runsContainer = document.getElementById('recentRuns');
  const lootFeed = document.getElementById('lootFeed');
  const scoreboardEl = document.getElementById('scoreboard');
  const questList = document.getElementById('questList');
  const analyticsRuns = document.getElementById('analyticsRuns');
  const publicLoot = document.getElementById('publicLoot');

  setLoading(runsContainer, 'Loading runs...');
  setLoading(lootFeed, 'Loading events...');
  setLoading(scoreboardEl, 'Loading leaderboard...');
  setLoading(questList, 'Loading quests...');
  setLoading(analyticsRuns, 'Loading analytics...');
  setLoading(publicLoot, 'Loading public loot...');

  const showManifest = async (run, viewEl) => {
    if (!viewEl) return;
    viewEl.hidden = false;
    viewEl.textContent = 'Loading manifest...';
    try {
      const manifest = await apiFetch(`/crawls/${encodeURIComponent(run.data_dir)}/manifest`);
      viewEl.textContent = JSON.stringify(manifest, null, 2);
    } catch (err) {
      viewEl.textContent = err.message || 'Manifest not available';
    }
  };

  const deleteRun = async (run) => {
    const confirmed = window.confirm(`Delete crawl ${run.crawl_type} (${run.url})?`);
    if (!confirmed) return;
    try {
      await apiFetch(`/crawls/${run.id}`, { method: 'DELETE' });
      flash('Crawl deleted', 'success');
      await loadRuns();
      await loadAnalytics();
    } catch (err) {
      flash(err.message || 'Delete failed', 'error');
    }
  };

  async function loadProfile() {
    try {
      const data = await apiFetch('/api/arcade/profile');
      const { profile, snapshot, lootLog, scoreboard } = data;
      if (!profile) {
        throw new Error('No profile loaded');
      }
      document.getElementById('welcomeName').textContent = profile.username || 'Pilot';
      document.getElementById('welcomeCopy').textContent = 'Arcade profile online. Start a run to earn more XP.';
      document.getElementById('levelValue').textContent = profile.level ?? '-';
      document.getElementById('xpValue').textContent = profile.xp ?? '-';
      document.getElementById('lastAction').textContent = formatTime(profile.lastActionAt);
      document.getElementById('totalCrawls').textContent = snapshot?.totalCrawls ?? '0';
      document.getElementById('recentLoot').textContent = snapshot?.lastLootEvent?.event_name || 'None yet';
      document.getElementById('achievements').textContent = profile.achievements?.length ? profile.achievements.join(', ') : 'Locked';
      const completed = Object.keys(profile.completedQuests || {}).length;
      document.getElementById('questProgress').textContent = `${completed} completed`;

      renderFeed(lootFeed, lootLog);

      if (Array.isArray(scoreboard)) {
        clearElement(scoreboardEl);
        scoreboard.forEach((player, idx) => {
          const li = document.createElement('li');
          li.textContent = `${idx + 1}. ${player.username} — ${player.xp} XP`;
          scoreboardEl.appendChild(li);
        });
      } else {
        setLoading(scoreboardEl, 'No leaderboard yet.');
      }
      await renderQuests(profile);
    } catch (err) {
      flash('Session expired — redirecting home', 'error');
      setTimeout(() => (window.location.href = '/'), 600);
      throw err;
    }
  }

  async function renderQuests(profile) {
    if (!questList) return;
    addHint(questList, 'Loading quests...');
    try {
      const { quests } = await apiFetch('/api/arcade/quests');
      clearElement(questList);
      if (!quests || !quests.length) {
        addHint(questList, 'No quests published yet.');
        return;
      }
      quests.forEach((quest) => {
        const card = document.createElement('div');
        card.className = 'quest-card';
        const active = profile.activeQuests && profile.activeQuests[quest.id];
        const done = profile.completedQuests && profile.completedQuests[quest.id];
        const titleRow = document.createElement('div');
        titleRow.className = 'title';
        const title = document.createElement('strong');
        title.textContent = quest.title;
        const xpChip = document.createElement('span');
        xpChip.className = 'chip';
        xpChip.textContent = `${quest.reward} XP`;
        titleRow.append(title, xpChip);

        const desc = document.createElement('p');
        desc.className = 'hint';
        desc.textContent = quest.description;

        const actions = document.createElement('div');
        actions.className = 'cta-row';
        if (done) {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = 'Completed';
          actions.appendChild(badge);
        }
        const btn = document.createElement('button');
        btn.className = 'pill ghost';
        btn.dataset.quest = quest.id;
        btn.dataset.state = active ? 'active' : 'idle';
        btn.textContent = done ? 'Done' : active ? 'Mark complete' : 'Start quest';
        actions.appendChild(btn);

        card.append(titleRow, desc, actions);
        questList.appendChild(card);
      });

      questList.querySelectorAll('button[data-quest]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const questId = btn.dataset.quest;
          const state = btn.dataset.state;
          const endpoint = state === 'active' ? '/api/arcade/quests/complete' : '/api/arcade/quests/start';
          try {
            await apiFetch(endpoint, { method: 'POST', body: { questId } });
            flash('Quest updated', 'success');
            await loadProfile();
          } catch (err) {
            flash(err.message || 'Quest update failed', 'error');
          }
        });
      });
    } catch (err) {
      addHint(questList, err.message || 'Could not load quests.');
    }
  }

  async function loadRuns() {
    try {
      const runs = await apiFetch('/crawls');
      renderRuns(runsContainer, runs, { onManifest: showManifest, onDelete: deleteRun });
    } catch (err) {
      renderRuns(runsContainer, [], { onManifest: showManifest, onDelete: deleteRun });
      flash(err.message || 'Could not load runs', 'error');
    }
  }

  async function loadAnalytics() {
    try {
      setLoading(analyticsRuns, 'Loading recent runs...');
      setLoading(publicLoot, 'Loading public events...');
      const data = await apiFetch('/api/arcade/analytics');
      const publicEvents = (data.publicLoot || []).filter((item) => item.event_name !== 'http_trace');
      renderMiniList(
        analyticsRuns,
        data.runs?.map((run) => `${run.crawl_type.toUpperCase()} — ${run.url} (${formatTime(run.created_at)})`),
        'No recent runs.'
      );
      renderMiniList(
        publicLoot,
        publicEvents.map((item) => `${item.username}: ${item.event_name} @ ${formatTime(item.created_at)}`),
        'No public loot yet.'
      );
    } catch (err) {
      renderMiniList(analyticsRuns, [], err.message);
      renderMiniList(publicLoot, [], err.message);
    }
  }

  async function runAction(action) {
    const urlInput = document.getElementById('targetUrl');
    const target = urlInput?.value?.trim();
    if (!target) {
      flash('Enter a target URL first', 'error');
      urlInput?.focus();
      return;
    }
    if (!isValidHttpUrl(target)) {
      flash('URL must start with http or https', 'error');
      urlInput?.focus();
      return;
    }
    const actionMap = {
      crawl: { endpoint: '/crawl', label: 'Arcade crawl' },
      fetch: { endpoint: '/fetch-crawl', label: 'Legacy fetch' },
      screenshot: { endpoint: '/screenshot', label: 'Screenshot' },
      source: { endpoint: '/source', label: 'Source capture' }
    };
    const details = actionMap[action];
    if (!details) return;
    const result = document.getElementById('actionResult');
    result.textContent = `Running ${details.label}...`;

    try {
      const data = await apiFetch(details.endpoint, { method: 'POST', body: { url: target } });
      result.textContent = data.message || 'Done';
      if (data.local_path) {
        const link = document.createElement('a');
        link.href = data.local_path;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open result';
        link.style.marginLeft = '8px';
        result.appendChild(link);
      }
      flash(`${details.label} completed`, 'success');
      await loadProfile();
      await loadRuns();
      await loadAnalytics();
    } catch (err) {
      result.textContent = err.message || 'Action failed';
      flash(err.message || 'Action failed', 'error');
    }
  }

  document.querySelectorAll('.action-buttons [data-action]').forEach((btn) => {
    btn.addEventListener('click', () => runAction(btn.dataset.action));
  });

  await loadProfile();
  await loadRuns();
  await loadAnalytics();
}

async function initAdmin() {
  async function refreshAdmin() {
    try {
      const [users, crawls, events] = await Promise.all([
        apiFetch('/admin/users'),
        apiFetch('/admin/crawls'),
        apiFetch('/admin/events')
      ]);

      renderMiniList(
        document.getElementById('adminUsers'),
        users.map((u) => `${u.username} (${u.role}) — dir: ${u.user_dir}`),
        'No users found.'
      );
      renderMiniList(
        document.getElementById('adminCrawls'),
        crawls.map((c) => `${c.crawl_type}: ${c.url} (${formatTime(c.created_at)})`),
        'No crawls yet.'
      );
      renderMiniList(
        document.getElementById('adminEvents'),
        events.map((e) => `${e.username}: ${e.event_name} (${formatTime(e.created_at)})`),
        'No events found.'
      );
    } catch (err) {
      const adminMessage = err.status === 403 ? 'Admin only — request elevated access.' : err.message || 'Admin access failed';
      flash(adminMessage, 'error');
      const fallback = err.status === 403 ? 'Admin only. Switch to an admin account.' : 'Access denied or no data.';
      renderMiniList(document.getElementById('adminUsers'), [], fallback);
      renderMiniList(document.getElementById('adminCrawls'), [], fallback);
      renderMiniList(document.getElementById('adminEvents'), [], fallback);
    }
  }

  document.querySelectorAll('[data-action="reload-admin"]').forEach((btn) =>
    btn.addEventListener('click', refreshAdmin)
  );

  await refreshAdmin();
}

document.addEventListener('DOMContentLoaded', () => {
  initSnow();
  wireLogoutButtons();
  const page = document.body.dataset.page;
  if (page === 'index') {
    initLanding();
  } else if (page === 'dashboard') {
    initDashboard();
  } else if (page === 'admin') {
    initAdmin();
  }
});

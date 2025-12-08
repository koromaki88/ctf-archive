const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const auth = require('./auth');
const crawl = require('./crawl');
const fetchCrawl = require('./fetch_crawl');
const secret = require('./secret');
const screenshot = require('./screenshot');
const source = require('./source');
const admin = require('./admin');
const user = require('./user');
const gameController = require('./game/gameController');
const analytics = require('./analytics');
const { auditTrail } = require('./middleware/auditLogger');
const { ensureAdminUser } = require('./bootstrap');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

const arcadeRouter = express.Router();
arcadeRouter.use(auditTrail);
arcadeRouter.get('/profile', gameController.getArcadeProfile);
arcadeRouter.get('/quests', gameController.listQuests);
arcadeRouter.post('/quests/start', gameController.startQuest);
arcadeRouter.post('/quests/complete', gameController.completeQuest);
arcadeRouter.post('/log-exploit', gameController.logExploit);
arcadeRouter.get('/leaderboard', gameController.getLeaderboard);
arcadeRouter.get('/analytics', analytics.getArcadeAnalytics);

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

app.get('/admin', (req, res) => {
  res.render('admin');
});

app.post('/register', auth.register);
app.post('/login', auth.login);
app.post('/logout', auth.logout);

app.post('/crawl', auth.authenticate, crawl.crawlWebsite);
app.post('/fetch-crawl', auth.authenticate, fetchCrawl.fetchCrawl);
app.post('/screenshot', auth.authenticate, screenshot.takeScreenshot);
app.post('/source', auth.authenticate, source.getSource);

app.get('/crawls', auth.authenticate, user.getMyCrawls);
app.get('/crawls/:data_dir/manifest', auth.authenticate, user.getRunManifest);
app.delete('/crawls/:crawlId', auth.authenticate, user.deleteMyCrawl);
app.get('/view/:data_dir/*', auth.authenticate, user.viewLoot);

app.get('/admin/users', auth.authenticate, auth.authenticateAdmin, admin.getAllUsers);
app.get('/admin/crawls', auth.authenticate, auth.authenticateAdmin, admin.getAllCrawls);
app.get('/admin/events', auth.authenticate, auth.authenticateAdmin, admin.getEventLog);
app.get('/secret', auth.authenticate, secret.getSecretData);

app.use('/api/arcade', auth.authenticate, arcadeRouter);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Bootstrap admin account on startup to avoid relying on init.sql seeding.
ensureAdminUser();

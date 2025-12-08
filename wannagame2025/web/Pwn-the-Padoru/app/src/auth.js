const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const db = require('./db');
const gameEngine = require('./game/gameEngine');

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET;
  }
  // Fall back to a per-process random secret to avoid predictable tokens.
  const generatedSecret = crypto.randomBytes(64).toString('hex');
  process.env.JWT_SECRET = generatedSecret;
  console.warn('JWT secret missing; generated random secret for this runtime.');
  return generatedSecret;
})();
const COOKIE_NAME = 'anicrawl_token';

async function ensureUserDirectory(userDir) {
  const targetDir = path.join('/tmp', userDir);
  await fs.ensureDir(targetDir);
  return targetDir;
}

async function register(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const existing = await db.getUserByUsername(username);
  if (existing) {
    return res.status(409).json({ message: 'User already exists.' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user_dir = uuidv4();

  try {
    await ensureUserDirectory(user_dir);
    const newUser = await db.createUser({ username, password: hashedPassword, user_dir });
    await gameEngine.registerPlayer({ id: newUser.id, username: newUser.username });
    res.status(200).json({ message: 'Registration successful.', profile: { username: newUser.username, role: newUser.role } });
  } catch (err) {
    console.error('Failed to complete registration:', err);
    res.status(500).json({ message: 'Registration failed.' });
  }
}

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = await db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  await ensureUserDirectory(user.user_dir);
  await gameEngine.ensurePlayer({ id: user.id, username: user.username });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, user_dir: user.user_dir },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
  });
  res.json({ message: 'Login successful.', profile: { username: user.username, role: user.role } });
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: 'Logged out successfully.' });
}

function authenticate(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. Missing token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.warn('Invalid token presented:', err.message);
    res.status(401).json({ message: 'Invalid token.' });
  }
}

function authenticateAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin only.' });
  }
  next();
}

module.exports = {
  register,
  login,
  logout,
  authenticate,
  authenticateAdmin
};

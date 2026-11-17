'use strict';
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');
const scrypt = promisify(crypto.scrypt);
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const COLLECTIONS = ['iydv_workout_logs', 'iydv_weight_logs', 'iydv_goals', 'iydv_skills', 'iydv_custom_drills', 'iydv_attendance', 'iydv_training_schedules'];
const PUBLIC_RANKS = ['Rookie', 'Regular', 'Veteran'];
const dateInManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const emptyState = () => Object.fromEntries(COLLECTIONS.map(key => [key, []]));

function createApp(options = {}) {
  if (process.env.VERCEL) throw new Error('OneUp needs a persistent Node.js host and DATA_DIR volume. Ephemeral serverless deployment is unsupported.');
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' };
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, '.data');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'oneup.sqlite'));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL, profile TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);`);
  const app = express();
  app.disable('x-powered-by');
  // Enable only behind a known, single trusted reverse proxy when deployed.
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'" });
    if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      // Browser cross-site mutations fail closed, including requests without Origin.
      const origin = req.get('origin');
      const expected = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
      if (!origin || origin !== expected || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Request origin is not allowed.' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'Use application/json.' });
    }
    next();
  });
  app.use(express.json({ limit: '2mb', strict: true }));
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ error: 'Provide a JSON object.' });
    next();
  });

  function fail(status, message) { const err = new Error(message); err.status = status; throw err; }
  function cleanString(value, max = 160) {
    if (typeof value !== 'string' || value.length > max || /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail(400, 'Invalid text value. Remove special markup and keep entries short.');
    return value.trim();
  }
  function profileFields(input, existing) {
    const result = { ...existing };
    for (const [key, max] of Object.entries({ FullName: 100, ProgramFocus: 60, ContactNumber: 30 })) {
      if (input[key] !== undefined) result[key] = cleanString(input[key], max);
    }
    if (!result.FullName) fail(400, 'Enter your full name.');
    for (const [key, min, max] of [['WeightKg', 0, 500], ['HeightCm', 0, 260]]) {
      if (input[key] !== undefined) {
        const value = Number(input[key]);
        if (!Number.isFinite(value) || value < min || value > max) fail(400, `Invalid ${key}.`);
        result[key] = value;
      }
    }
    if (input.Avatar !== undefined) {
      const avatar = input.Avatar;
      if (typeof avatar !== 'string' || avatar.length > 500000 || (avatar && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatar))) fail(400, 'Choose a PNG, JPEG, WebP or GIF image under 350 KB.');
      result.Avatar = avatar;
    }
    if (result.WeightKg && result.HeightCm) {
      result.BMI = +(result.WeightKg / ((result.HeightCm / 100) ** 2)).toFixed(1);
      result.BMICategory = result.BMI < 18.5 ? 'Underweight' : result.BMI < 25 ? 'Normal' : result.BMI < 30 ? 'Overweight' : 'Obese';
    } else { result.BMI = 0; result.BMICategory = '--'; }
    return result;
  }
  function issueSession(res, accountId) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    db.prepare('DELETE FROM sessions WHERE account_id = ? AND token NOT IN (SELECT token FROM sessions WHERE account_id = ? ORDER BY expires DESC LIMIT 9)').run(accountId, accountId);
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), accountId, Date.now() + SESSION_TTL);
    res.cookie('oneup_session', token, { ...cookieOptions, maxAge: SESSION_TTL });
  }
  function session(req, res, next) {
    const token = (req.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('oneup_session='))?.slice(14);
    const row = token && db.prepare('SELECT accounts.* FROM accounts JOIN sessions ON accounts.id = sessions.account_id WHERE sessions.token = ? AND sessions.expires > ?').get(digest(token), Date.now());
    if (!row) return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    req.account = row;
    req.sessionToken = digest(token);
    next();
  }
  function rateLimit(req, res, next) {
    const now = Date.now();
    db.prepare('DELETE FROM attempts WHERE reset < ?').run(now);
    const key = digest(req.ip || 'unknown');
    const attempt = db.prepare('SELECT * FROM attempts WHERE key = ?').get(key);
    if (attempt && attempt.count >= 20) { res.set('Retry-After', String(Math.ceil((attempt.reset - now) / 1000))); return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' }); }
    db.prepare('INSERT INTO attempts VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1').run(key, now + 15 * 60 * 1000);
    next();
  }
  const payload = row => ({ member: JSON.parse(row.profile), state: JSON.parse(row.state), revision: row.revision });
  app.get('/api/health', (req, res) => res.json({ status: 'ok', storage: 'sqlite' }));
  app.post('/api/auth/register', rateLimit, async (req, res, next) => {
    try {
      const input = req.body;
      const username = cleanString(input.Username || input.username || '', 40).toLowerCase();
      const email = cleanString(input.Email || input.email || '', 254).toLowerCase();
      const password = input.Password || input.password;
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) fail(400, 'Use 3–40 letters, numbers, dots, hyphens or underscores for your username.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
      if (typeof password !== 'string' || password.length < 12 || password.length > 128) fail(400, 'Use a password between 12 and 128 characters.');
      const rank = input.Rank || input.rank;
      const id = crypto.randomUUID();
      const profile = profileFields({ ...input, FullName: input.FullName || input.fullName, ContactNumber: input.ContactNumber || input.contact || '' }, { MemberID: id, Username: username, Email: email, Rank: PUBLIC_RANKS.includes(rank) ? rank : 'Rookie', ProgramFocus: 'Whole Body', DateJoined: dateInManila(), WeightKg: 0, HeightCm: 0, BMI: 0, BMICategory: '--', Status: 'Active', Avatar: '' });
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      try { db.prepare('INSERT INTO accounts (id, username, email, salt, password, profile, state) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, username, email, salt, hash, JSON.stringify(profile), JSON.stringify(emptyState())); }
      catch (err) { if (err.code?.startsWith('ERR_SQLITE') && /UNIQUE/.test(err.message)) fail(409, 'That username or email is already registered.'); throw err; }
      issueSession(res, id);
      res.status(201).json(payload(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)));
    } catch (err) { next(err); }
  });
  app.post('/api/auth/login', rateLimit, async (req, res, next) => {
    try {
      const identifier = cleanString(req.body.identifier || '', 254).toLowerCase();
      const password = req.body.password;
      if (typeof password !== 'string' || password.length > 128) fail(400, 'Enter your password.');
      const account = db.prepare('SELECT * FROM accounts WHERE username = ? OR email = ?').get(identifier, identifier);
      const hash = await scrypt(password, account?.salt || 'oneup-invalid-account', 64);
      if (!account || !crypto.timingSafeEqual(hash, Buffer.from(account.password, 'hex'))) fail(401, 'Username, email or password is incorrect.');
      issueSession(res, account.id);
      res.json(payload(account));
    } catch (err) { next(err); }
  });
  app.get('/api/auth/session', session, (req, res) => res.json(payload(req.account)));
  app.post('/api/auth/logout', session, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    res.clearCookie('oneup_session', cookieOptions);
    res.json({ ok: true });
  });
  function safeRecord(value, depth = 0) {
    if (depth > 5) fail(400, 'Record is too deeply nested.');
    if (typeof value === 'string') return cleanString(value, 2000);
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value) && value.length <= 100) return value.map(v => safeRecord(v, depth + 1));
    if (value && typeof value === 'object') {
      const result = {};
      if (Object.keys(value).length > 40) fail(400, 'Record has too many fields.');
      for (const [key, v] of Object.entries(value)) {
        if ((!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) && !['Set #', 'Weight (lbs)', 'RPE (1-10)'].includes(key)) || ['Password', 'password', '__proto__', 'constructor', 'prototype'].includes(key)) fail(400, 'Invalid record field.');
        result[key] = safeRecord(v, depth + 1);
      }
      return result;
    }
    fail(400, 'Invalid record value.');
  }
  app.put('/api/state', session, (req, res, next) => {
    try {
      const { member, state, revision } = req.body;
      if (!member || !state || typeof state !== 'object') fail(400, 'Missing account data.');
      const current = JSON.parse(req.account.profile);
      if (member.MemberID !== current.MemberID) fail(403, 'This tab belongs to another account. Reload before continuing.');
      const profile = profileFields(member, current);
      const previous = JSON.parse(req.account.state);
      const cleaned = emptyState();
      for (const key of COLLECTIONS) {
        if (!Array.isArray(state[key]) || state[key].length > 10000) fail(400, 'Invalid training records.');
        cleaned[key] = state[key].map(record => {
          if (!record || typeof record !== 'object' || Array.isArray(record)) fail(400, 'Invalid training record.');
          const row = safeRecord(record);
          for (const field of ['Exercise', 'Program', 'SkillName', 'Category', 'ProficiencyLevel', 'Coach', 'Name', 'Type', 'Notes', 'Description', 'GoalType', 'Metric', 'Status', 'SessionName', 'Venue', 'CallTime', 'Time', 'CreatedBy', 'AddedBy', 'FullName', 'ApprovedBy']) {
            if (row[field] !== undefined && typeof row[field] !== 'string') fail(400, `Invalid ${field}.`);
          }
          if (row.WhoNeeded !== undefined && (!Array.isArray(row.WhoNeeded) || row.WhoNeeded.some(value => typeof value !== 'string'))) fail(400, 'Invalid session participants.');
          for (const field of ['LogID', 'GoalID', 'SkillID', 'DrillID', 'ScheduleID']) {
            if (row[field] !== undefined && (typeof row[field] !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(row[field]))) fail(400, 'Invalid record identifier.');
          }
          for (const [field, min, max] of [['Reps', 0, 1000], ['Set #', 1, 1000], ['SetNum', 1, 1000], ['Weight (lbs)', 0, 2000], ['WeightLbs', 0, 2000], ['RPE (1-10)', 0, 10], ['RPE', 0, 10], ['WeightKg', 20, 350], ['StartValue', -1000000, 1000000], ['TargetValue', -1000000, 1000000], ['CurrentValue', -1000000, 1000000]]) {
            if (row[field] !== undefined && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < min || row[field] > max)) fail(400, `Invalid ${field}.`);
          }
          for (const field of ['Date', 'DateLearned', 'TargetDate']) {
            if (row[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(row[field]) || !Number.isFinite(Date.parse(row[field])) || new Date(row[field]).toISOString().slice(0, 10) !== row[field])) fail(400, 'Invalid record date.');
          }
          if (key === 'iydv_skills') row.Verified = false;
          if (row.MemberID && row.MemberID !== current.MemberID) fail(403, 'Records must belong to your account.');
          if (key !== 'iydv_custom_drills' && key !== 'iydv_training_schedules') row.MemberID = current.MemberID;
          if (key === 'iydv_attendance') {
            const original = previous[key].find(r => r.LogID === row.LogID);
            row.Status = original?.Status || 'Pending Approval'; row.ApprovedBy = original?.ApprovedBy || '';
          }
          return row;
        });
      }
      const result = db.prepare('UPDATE accounts SET profile = ?, state = ?, revision = revision + 1 WHERE id = ? AND revision = ?').run(JSON.stringify(profile), JSON.stringify(cleaned), req.account.id, revision);
      if (!result.changes) fail(409, 'Your account changed in another tab. Export unsaved changes, then reload before continuing.');
      res.json({ member: profile, revision: revision + 1 });
    } catch (err) { next(err); }
  });
  app.get('/api/account/export', session, (req, res) => {
    res.set('Content-Disposition', 'attachment; filename="oneup-data.json"');
    res.json({ exportedAt: new Date().toISOString(), ...payload(req.account) });
  });
  app.delete('/api/account', rateLimit, session, async (req, res, next) => {
    try {
      if (req.body.memberId !== req.account.id) fail(403, 'This tab belongs to another account. Reload before continuing.');
      if (typeof req.body.password !== 'string' || req.body.password.length > 128) fail(400, 'Enter your password to delete this account.');
      const hash = await scrypt(req.body.password, req.account.salt, 64);
      if (!crypto.timingSafeEqual(hash, Buffer.from(req.account.password, 'hex'))) fail(401, 'Password is incorrect.');
      db.prepare('DELETE FROM accounts WHERE id = ?').run(req.account.id);
      res.clearCookie('oneup_session', cookieOptions);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
  app.all('/api/egov-sso', (req, res) => res.status(503).json({ error: 'eGovPH sign-in is unavailable. Use your OneUp account.' }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  for (const dir of ['assets', 'css', 'js']) app.use(`/${dir}`, express.static(path.join(__dirname, dir), { dotfiles: 'deny', index: false, fallthrough: false }));
  app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.use((req, res) => res.status(404).type('text').send('Not found'));
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[OneUp server]', err.code || err.name);
    res.status(status).json({ error: status >= 500 ? 'Unable to complete your request. Please try again.' : err.message });
  });
  app.locals.db = db;
  return app;
}
if (require.main === module) {
  const app = createApp();
  const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log(`OneUp listening on port ${process.env.PORT || 3000}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => { app.locals.db.close(); process.exit(0); }));
}
module.exports = { createApp };

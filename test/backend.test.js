'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

test('private persisted accounts, authentication, validation, isolation and static boundaries', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oneup-test-'));
  const app = createApp({ dataDir });
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); app.locals.db.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  async function request(route, { method = 'GET', body, cookie, suppliedOrigin = origin } = {}) {
    const result = await fetch(origin + route, { method, headers: { Origin: suppliedOrigin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = await result.json().catch(() => ({}));
    return { status: result.status, data: json, cookie: result.headers.get('set-cookie'), headers: result.headers };
  }
  assert.equal((await request('/api/health')).data.status, 'ok');
  assert.equal((await request('/api/auth/session')).status, 401);
  assert.equal((await request('/api/auth/register', { method: 'POST', suppliedOrigin: 'https://evil.example', body: {} })).status, 403);
  const account = { Username: 'dancer', FullName: 'Test Dancer', Email: 'dancer@example.com', Password: 'test-passphrase-123', Rank: 'Alumni' };
  const first = await request('/api/auth/register', { method: 'POST', body: account });
  assert.equal(first.status, 201);
  assert.match(first.cookie, /HttpOnly/);
  assert.match(first.cookie, /SameSite=Strict/);
  assert.equal(first.data.member.Rank, 'Rookie', 'registration cannot grant administrator rights');
  assert.equal(first.data.member.Password, undefined);
  const cookie = first.cookie.split(';')[0];
  assert.equal((await request('/api/auth/register', { method: 'POST', body: account })).status, 409);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { identifier: 'dancer', password: 'incorrect-password' } })).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { identifier: 'dancer', password: account.Password } })).status, 200);
  const privateState = structuredClone(first.data.state);
  privateState.iydv_workout_logs.push({ LogID: 'workout1', MemberID: first.data.member.MemberID, Date: '2026-11-17', Exercise: 'Bench Press', 'Set #': 1, Reps: 8, 'Weight (lbs)': 100, 'RPE (1-10)': 8 });
  privateState.iydv_goals.push({ GoalID: 'goal1', MemberID: first.data.member.MemberID, Description: 'Practice more', StartValue: 0, CurrentValue: 1, TargetValue: 10 });
  const save = await request('/api/state', { method: 'PUT', cookie, body: { member: { ...first.data.member, Rank: 'Alumni' }, state: privateState, revision: 0 } });
  assert.equal(save.status, 200);
  assert.equal(save.data.member.Rank, 'Rookie');
  assert.equal((await request('/api/state', { method: 'PUT', cookie, body: { member: first.data.member, state: privateState, revision: 0 } })).status, 409, 'stale tab does not overwrite newer data');
  const badState = structuredClone(privateState);
  badState.iydv_weight_logs.push({ MemberID: first.data.member.MemberID, WeightKg: -10 });
  assert.equal((await request('/api/state', { method: 'PUT', cookie, body: { member: first.data.member, state: badState, revision: 1 } })).status, 400);
  const second = await request('/api/auth/register', { method: 'POST', body: { ...account, Username: 'other', Email: 'other@example.com' } });
  assert.equal(second.status, 201);
  assert.equal((await request('/api/state', { method: 'PUT', cookie: second.cookie.split(';')[0], body: { member: first.data.member, state: second.data.state, revision: 0 } })).status, 403, 'account switch in another tab cannot overwrite the new account profile');
  assert.deepEqual(second.data.state.iydv_goals, []);
  const secondCookie = second.cookie.split(';')[0];
  assert.equal((await request('/api/state', { method: 'PUT', cookie: secondCookie, body: { member: second.data.member, state: privateState, revision: 0 } })).status, 403, 'cross-account record IDs rejected');
  assert.equal((await request('/api/auth/session', { cookie })).data.state.iydv_goals.length, 1);
  assert.equal((await request('/api/account/export', { cookie })).data.state.iydv_goals.length, 1);
  const stored = app.locals.db.prepare('SELECT password, profile FROM accounts WHERE username = ?').get('dancer');
  assert.notEqual(stored.password, account.Password);
  assert.equal(stored.profile.includes(account.Password), false);
  for (const route of ['/server.js', '/package.json', '/.data/oneup.sqlite', '/IYDV_OneUp_Member_Database.xlsx', '/IYDV_OneUp_Development_Plan.docx', '/.git/config']) assert.equal((await request(route)).status, 404, route);
  assert.equal((await request('/api/egov-sso', { method: 'POST', body: {} })).status, 503);
  assert.equal((await request('/api/auth/logout', { method: 'POST', cookie, body: {} })).status, 200);
  assert.equal((await request('/api/auth/session', { cookie })).status, 401);
  for (let index = 0; index < 11; index++) assert.equal((await request('/api/auth/login', { method: 'POST', body: { identifier: 'dancer', password: account.Password } })).status, 200);
  assert.equal(app.locals.db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE account_id = ?').get(first.data.member.MemberID).count, 10, 'active sessions are bounded per account');
  assert.equal((await request('/api/account', { method: 'DELETE', cookie: secondCookie, body: { password: account.Password, memberId: first.data.member.MemberID } })).status, 403, 'account deletion is bound to the profile in this tab');
  assert.equal((await request('/api/account', { method: 'DELETE', cookie: secondCookie, body: { password: account.Password, memberId: second.data.member.MemberID } })).status, 200);
  assert.equal((await request('/api/auth/session', { cookie: secondCookie })).status, 401);
});

test('accounts, training records and valid sessions survive a server restart', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oneup-restart-'));
  let app;
  let server;
  async function start() {
    app = createApp({ dataDir });
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise(resolve => server.close(resolve)); app.locals.db.close(); }
  t.after(async () => { await stop(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  let origin = await start();
  const registration = await fetch(origin + '/api/auth/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ Username: 'persistent', FullName: 'Persistent Dancer', Email: 'persistent@example.com', Password: 'persistent-pass-123' }) });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  const data = await registration.json();
  data.state.iydv_skills.push({ SkillID: 'skill1', MemberID: data.member.MemberID, SkillName: 'Footwork', Category: 'Choreography', ProficiencyLevel: 'Intermediate', DateLearned: '2026-01-01' });
  const saved = await fetch(origin + '/api/state', { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(data) });
  assert.equal(saved.status, 200);
  await stop();
  origin = await start();
  const restored = await fetch(origin + '/api/auth/session', { headers: { Cookie: cookie } });
  assert.equal(restored.status, 200);
  const restoredData = await restored.json();
  assert.equal(restoredData.member.Username, 'persistent');
  assert.equal(restoredData.state.iydv_skills[0].SkillName, 'Footwork');
  assert.equal(restoredData.revision, 1);
});

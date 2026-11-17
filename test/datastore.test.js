'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');

test('account store preserves save ordering, retries failures and maintains dated weight history', async () => {
  const requests = [];
  let failNext = false;
  const context = vm.createContext({
    structuredClone, setTimeout, clearTimeout, AbortSignal, Intl, crypto: crypto.webcrypto,
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    window: { addEventListener() {}, dispatchEvent() {} },
    fetch: async (route, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      if (failNext) { failNext = false; throw new Error('offline'); }
      return { ok: true, json: async () => ({ member: body.member, revision: body.revision + 1 }) };
    }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../js/api.js'), 'utf8') + '\nglobalThis.testStore = store;', context);
  const store = context.testStore;
  const member = { MemberID: 'one', FullName: 'Dancer', HeightCm: 170, WeightKg: 0 };
  store.applySession({ member, state: {}, revision: 0 });
  store.addWeightLog('one', 70, '2026-01-02');
  store.addWeightLog('one', 68, '2026-01-01');
  store.addWeightLog('one', 71, '2026-01-02');
  assert.equal(store.getWeightLogs('one').length, 2, 'same-date entry updates rather than duplicates');
  assert.equal(store.getCurrentUser().WeightKg, 71, 'backdated entry does not replace latest weight');
  assert.equal(store.getWeightLogs('one')[0].ChangeKg, 3, 'changes follow chronological order');
  await store.flush();
  assert.equal(requests.length, 1, 'updates batch into one save');
  assert.equal(store.revision, 1);
  failNext = true;
  store.addWorkoutLog({ MemberID: 'one', Exercise: 'Squats' });
  await assert.rejects(store.flush(), /Cannot reach OneUp/);
  assert.equal(store.saveState, 'error');
  assert.notEqual(store.changeVersion, store.savedVersion, 'failed save remains dirty');
  await store.flush();
  assert.equal(store.saveState, 'saved');
  assert.equal(store.revision, 2);
  assert.equal(store.changeVersion, store.savedVersion);
  store.clearCurrentUser();
  assert.equal(store.getCurrentUser(), null);
  assert.equal(store.getWorkoutLogs().length, 0, 'signout clears private memory');
});

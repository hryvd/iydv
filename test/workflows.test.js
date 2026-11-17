const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function workflow(file) {
  let now = 0;
  const elements = Object.fromEntries(['jog-start-btn', 'jog-pause-btn', 'active-reps-input', 'active-weight-input'].map(id => [id, { style: {}, addEventListener() {}, value: '' }]));
  const logs = [];
  const messages = [];
  const context = vm.createContext({
    confirm: () => true, STORAGE_KEYS: {GOALS:'goals',SKILLS:'skills',TRAINING_SCHEDULES:'schedules'},
    console, crypto: require('node:crypto').webcrypto,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 10, 17)])); } static now() { return now; } },
    document: { readyState: 'complete', getElementById: id => elements[id] || null, addEventListener() {}, querySelectorAll: () => [] },
    window: { addEventListener() {} }, setInterval: () => 1, clearInterval() {},
    localDate: (date = new Date('2026-11-17T00:00:00Z')) => date.toISOString().slice(0, 10), escapeHTML: value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    store: { getCurrentUser: () => ({MemberID:'M1'}), addWorkoutLog: entry => logs.push(entry), addWorkoutLogsBatch: entries => logs.push(...entries) },
    app: { notify: (...args) => messages.push(args), renderPreviousWorkoutsList() {}, closeModal() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'), context);
  return { module: vm.runInContext(file + 'Module', context), context, logs, messages, elements, time: value => { now = value; } };
}

test('goal progress respects increasing and decreasing targets without rewarding movement away', () => {
  const {module: goals} = workflow('goals');
  assert.equal(goals.progress({StartValue: 80, TargetValue: 70, CurrentValue: 75}), 50);
  assert.equal(goals.progress({StartValue: 80, TargetValue: 70, CurrentValue: 85}), 0);
  assert.equal(goals.progress({StartValue: 0, TargetValue: 100, CurrentValue: 120}), 100);
  assert.equal(goals.progress({StartValue: 10, TargetValue: 10, CurrentValue: 15}), 0);
});

test('interval timer catches up after background time, excludes pause, and logs once on completion', () => {
  const timer = workflow('jogging');
  timer.module.startTimer();
  timer.time(571000);
  timer.module.tick();
  assert.equal(timer.module.currentPhaseIndex, 1);
  assert.equal(timer.module.phaseTimeRemaining, 29);
  timer.module.pauseTimer();
  timer.time(4000000);
  timer.module.startTimer();
  timer.time(4089000);
  timer.module.tick();
  assert.equal(timer.logs.length, 1);
  assert.equal(timer.logs[0].MemberID, 'M1');
  assert.equal(timer.module.elapsedSeconds, 0);
  assert.equal(timer.module.isRunning, false);
});

test('gym rejects invalid sets and stores completed sets with consistent numeric fields', () => {
  const gym = workflow('gym');
  gym.module.activeExercise = { name: 'Bench press' };
  gym.elements['active-reps-input'].value = '10';
  gym.elements['active-weight-input'].value = '-2';
  gym.module.logCurrentSet();
  assert.equal(gym.module.activeSetLogs.length, 0);
  gym.module.completedExercises = {'Bench press': [{reps:10,weight:95,rpe:8},{reps:8,weight:100,rpe:8}]};
  gym.module.renderExerciseList = () => {};
  gym.module.submitGymWorkoutBatch();
  assert.equal(gym.logs.length, 2);
  assert.equal(gym.logs[1].SetNum, 2);
  assert.equal(gym.logs[1].WeightLbs, 100);
  assert.equal(Object.keys(gym.module.completedExercises).length, 0);
});


test('reports filter the selected calendar period and quote formula-like CSV cells safely', () => {
  const reports = workflow('reports');
  reports.elements['report-period-select'] = {value: '7'};
  reports.context.store.getWorkoutLogs = () => [{Date:'2026-11-11'},{Date:'2026-11-17'},{Date:'2026-11-10'},{Date:'2026-11-18'}];
  reports.context.store.getWeightLogs = () => [];
  reports.context.store.getGoals = () => [];
  reports.context.store.getSkills = () => [];
  assert.equal(reports.module.getReportData().workouts.length, 2);
  assert.equal(reports.module.csvCell('=HYPERLINK("evil")'), '"\'=HYPERLINK(""evil"")"');
  assert.equal(reports.module.csvCell('A, B'), '"A, B"');
  assert.equal(reports.module.csvCell(-5), '"-5"');
});


test('removing mistaken goals and skills requires confirmation and preserves other records', () => {
  for (const [file, getter, idField, method, storageKey] of [
    ['goals', 'getGoals', 'GoalID', 'deleteGoal', 'goals'],
    ['skills', 'getSkills', 'SkillID', 'deleteSkill', 'skills']
  ]) {
    const state = workflow(file);
    let records = [{[idField]:'one',MemberID:'M1',Description:'Mistake',SkillName:'Mistake'}, {[idField]:'two',MemberID:'M1'}, {[idField]:'one',MemberID:'M2'}];
    state.context.store[getter] = memberId => records.filter(item => !memberId || item.MemberID === memberId);
    state.context.store.setItem = (key, value) => { assert.equal(key, storageKey); records = value; };
    state.context.confirm = () => false;
    state.module[method]('one');
    assert.equal(records.length, 3);
    state.context.confirm = () => true;
    state.module[method]('one');
    assert.equal(records.length, 2);
    assert.equal(records.some(item => item.MemberID === 'M2'), true);
  }
});

test('personal session display follows the Manila calendar date and removal reveals the next session', () => {
  const state = workflow('schedule');
  state.context.localDate = () => '2026-11-18';
  let sessions = [{ScheduleID:'one',SessionName:'First',Date:'2026-11-18'}, {ScheduleID:'two',SessionName:'Next',Date:'2026-11-19'}];
  state.context.store.getTrainingSchedules = () => sessions;
  state.context.store.getUpcomingSchedule = () => sessions[0];
  state.context.store.setItem = (key, value) => { assert.equal(key, 'schedules'); sessions = value; };
  state.elements['schedule-panel-home'] = {innerHTML:''};
  state.module.renderAllPanels();
  assert.match(state.elements['schedule-panel-home'].innerHTML, /TODAY/);
  state.module.deleteSession('one');
  assert.equal(sessions.length, 1);
  assert.match(state.elements['schedule-panel-home'].innerHTML, /TOMORROW/);
});

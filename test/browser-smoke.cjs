'use strict';
// Run with npm run test:browser. Uses a fresh SQLite database and real browser UI.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { createApp } = require('../server');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oneup-browser-'));
  const app = createApp({ dataDir: directory });
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, reducedMotion: 'reduce' });
    await context.addInitScript({ content: require('axe-core').source });
    await fs.mkdir(path.join(__dirname, '..', 'artifacts'), { recursive: true });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      // Session discovery and deliberately rejected credentials are expected 401s.
      if (message.text().includes('401') && /\/api\/auth\/(session|login)/.test(message.location().url)) return;
      errors.push(`Console: ${message.text()}`);
    });
    const accessibilityReports = [];
    const audit = async name => {
      const findings = await page.evaluate(async () => {
        const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return result.violations.filter(item => ['critical', 'serious'].includes(item.impact)).map(item => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
      });
      accessibilityReports.push({ screen: name, findings });
      if (findings.length) console.log(`Accessibility findings on ${name}: ${JSON.stringify(findings)}`);
    };
    const step = label => console.log(`✓ ${label}`);
    const saved = () => page.waitForFunction(() => store.getCurrentUser() && store.changeVersion === store.savedVersion && !store.pendingSave);
    const screen = id => page.locator(`#${id}.active`).waitFor({ state: 'visible' });
    const navigate = async id => { await page.locator(`.nav-item[data-screen="${id}"]:visible`).click(); await screen(id); };
    const close = async id => { await page.locator(`#${id} .modal-close-btn`).click(); await page.locator(`#${id}`).waitFor({ state: 'hidden' }); };

    await page.goto(origin);
    await screen('welcome-screen');
    await audit('welcome');
    await page.screenshot({ path: path.join(__dirname, '..', 'artifacts', 'welcome.png') });
    await page.getByRole('button', { name: 'Create your account' }).click();
    await page.locator('#create-account-form').getByLabel('Username', { exact: false }).fill('browser.athlete');
    await page.getByLabel('Full name', { exact: false }).fill('Browser Athlete');
    await page.getByLabel('Email address').fill('browser@example.test');
    await page.locator('#reg-password').fill('OneUpBrowser12!');
    await page.locator('#reg-confirm-password').fill('OneUpBrowser12!');
    await page.locator('#reg-privacy-consent').check();
    await page.locator('#create-account-form [type="submit"]').click();
    await screen('home-screen');
    assert.equal(await page.locator('#greeting-name').textContent(), 'Browser');
    step('Account registration and personalized overview');
    await audit('overview');

    // Check keyboard containment and returning focus to the opening control.
    const accountButton = page.getByRole('button', { name: 'Account and data', exact: true });
    await accountButton.click();
    await page.locator('#account-modal.active').waitFor();
    await audit('account-dialog');
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => document.getElementById('account-modal').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await page.locator('#account-modal').waitFor({ state: 'hidden' });
    assert(await accountButton.evaluate(element => document.activeElement === element));
    step('Dialog keyboard focus and Escape dismissal');

    await navigate('goals-screen');
    await page.getByRole('button', { name: 'Add Goal', exact: true }).click();
    await page.locator('#goal-desc-input').fill('Build a consistent squat');
    await page.locator('#goal-metric-input').fill('kg');
    await page.locator('#goal-start-input').fill('50');
    await page.locator('#goal-target-input').fill('70');
    await page.locator('#save-goal-form [type="submit"]').click();
    await page.getByRole('heading', { name: 'Build a consistent squat' }).waitFor();
    await page.locator('[data-goal-progress] input').fill('60');
    await page.locator('[data-goal-progress] button[type="submit"]').click();
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '50');
    await saved();
    step('Create a measurable goal and update to 50% progress');
    await audit('goal-progress');

    await page.locator('#progress-subtab-weight').click();
    await page.locator('#progress-weight-view button').click();
    await page.locator('#weight-kg-input').fill('68');
    const date = await page.locator('#weight-date-input').inputValue();
    await page.locator('#save-weight-form [type="submit"]').click();
    await saved();
    await page.locator('#progress-weight-view button').click();
    await page.locator('#weight-kg-input').fill('69');
    assert.equal(await page.locator('#weight-date-input').inputValue(), date);
    await page.locator('#save-weight-form [type="submit"]').click();
    await saved();
    assert.equal(await page.locator('#weight-history-list .list-item').count(), 1);
    assert((await page.locator('#weight-history-list').innerText()).includes('69 kg'));
    step('Weight logging updates an existing date without duplicate entries');

    await navigate('gym-screen');
    await page.locator('[data-exercise-index="0"]').click();
    await audit('active-workout');
    await page.locator('#active-reps-input').fill('8');
    await page.locator('#active-weight-input').fill('45');
    await page.locator('#active-workout-modal').getByRole('button', { name: 'LOG SET 1' }).click();
    // Ending after one completed set should retain it for final workout submission.
    await page.keyboard.press('Escape');
    await page.locator('#active-workout-modal').waitFor({ state: 'hidden' });
    await page.locator('#gym-exercise-list').getByRole('button', { name: /SUBMIT PUSH WORKOUT \(1 exercise\)/ }).click();
    await saved();
    assert.equal(await page.evaluate(() => store.getWorkoutLogs().filter(log => log.Program === 'Push').length), 1);
    step('Log one exercise set, end the exercise and submit the workout');

    await page.locator('#training-subtab-drills').click();
    await page.locator('#regular-drills-list input[type="checkbox"]').first().check();
    await page.locator('#regular-drills-list').getByRole('button', { name: /SUBMIT REGULAR DRILLS \(1\)/ }).click();
    await saved();
    assert.equal(await page.evaluate(() => store.getWorkoutLogs().filter(log => log.Program === 'Regular Drill').length), 1);
    step('Complete and submit a drill checklist');
    await audit('drill-checklist');

    await navigate('home-screen');
    await page.locator('#schedule-panel-home').getByRole('button', { name: 'Plan a session' }).click();
    await page.locator('#sched-session-name').fill('Tomorrow’s dance practice');
    await page.locator('#sched-call-time').fill('16:30');
    await page.locator('#sched-venue').fill('Practice room');
    await page.locator('#schedule-training-form [type="submit"]').click();
    await page.locator('#schedule-panel-home .schedule-panel-name').waitFor();
    assert.equal(await page.locator('#schedule-panel-home .schedule-panel-name').textContent(), 'Tomorrow’s dance practice');
    await saved();
    step('Plan a personal session and see it on the overview');

    await page.reload();
    await screen('home-screen');
    assert.deepEqual(await page.evaluate(() => ({ goals: store.getGoals().length, weight: store.getWeightLogs().length, workouts: store.getWorkoutLogs().length, plans: store.getTrainingSchedules().length })), { goals: 1, weight: 1, workouts: 2, plans: 1 });
    await navigate('goals-screen');
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '50');
    step('Session and all training records survive a full page reload');

    await accountButton.click();
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export all my data' }).click();
    const exported = await jsonDownload;
    const data = JSON.parse(await fs.readFile(await exported.path(), 'utf8'));
    assert.equal(data.member.Username, 'browser.athlete');
    assert.equal(data.state.iydv_workout_logs.length, 2);
    assert(!JSON.stringify(data).includes('OneUpBrowser12!'));
    await close('account-modal');
    await navigate('home-screen');
    await page.getByRole('button', { name: 'Progress report', exact: true }).click();
    const csvDownload = page.waitForEvent('download');
    await page.locator('#progress-report-modal').getByRole('button', { name: /EXPORT CSV/ }).click();
    const csv = await fs.readFile(await (await csvDownload).path(), 'utf8');
    assert(csv.includes('Bench Press') && csv.includes('Diamond Push Ups'));
    await close('progress-report-modal');
    step('Download usable JSON account backup and CSV workout report');

    await fs.mkdir(path.join(__dirname, '..', 'artifacts'), { recursive: true });
    await page.locator('.toast').last().waitFor({ state: 'hidden' });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1, content: document.querySelector('.app-content').scrollWidth > document.querySelector('.app-content').clientWidth + 1 }));
      assert(!overflow.page && !overflow.content, `Horizontal overflow at ${width}px: ${JSON.stringify(overflow)}`);
      await page.screenshot({ path: path.join(__dirname, '..', 'artifacts', `overview-${width}.png`), fullPage: true });
    }
    step('Responsive layout fits 390px, 768px and 1440px viewports');

    await page.getByRole('button', { name: 'Sign out', exact: true }).filter({ visible: true }).click();
    await screen('welcome-screen');
    await page.getByRole('button', { name: 'Sign in to OneUp' }).click();
    await page.locator('#login-username').fill('browser.athlete');
    await page.locator('#login-password').fill('incorrect-password');
    await page.locator('#login-form [type="submit"]').click();
    await page.locator('#login-form .form-feedback:not([hidden])').waitFor();
    assert((await page.locator('#login-form .form-feedback').innerText()).includes('incorrect'));
    await page.locator('#login-password').fill('OneUpBrowser12!');
    await page.locator('#login-form [type="submit"]').click();
    await screen('home-screen');
    step('Safe logout, inline rejected-login feedback and valid sign-in');
    await fs.writeFile(path.join(__dirname, '..', 'artifacts', 'accessibility.json'), JSON.stringify(accessibilityReports, null, 2));
    assert.deepEqual(errors, [], 'No unexpected browser errors');
    const inaccessible = accessibilityReports.filter(report => report.findings.length);
    assert.deepEqual(inaccessible, [], 'No critical or serious WCAG accessibility violations');
    console.log('Browser smoke passed: 11 real user flows; six WCAG audits; no unexpected console errors.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    app.locals.db.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

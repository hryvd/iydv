/* Navigation, accessible dialogs, and the daily training overview. */
class App {
  constructor() {
    this.currentScreen = 'welcome-screen';
    this.activeTrainingSubtab = 'gym';
    this.activeProgressSubtab = 'goals';
    this.modalTriggers = new Map();
    window.addEventListener('DOMContentLoaded', () => this.init());
  }

  async init() {
    this.bindNavigation();
    this.bindModals();
    this.labelControls();
    this.refreshIcons();
    document.getElementById('header-date').textContent = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
    window.addEventListener('beforeunload', event => {
      const draft = gymModule.activeSetLogs.length || Object.keys(gymModule.completedExercises).length || Object.values(drillsModule.completedDrills).some(items => Object.keys(items).length) || joggingModule.isRunning;
      if (draft) { event.preventDefault(); event.returnValue = ''; }
    });
    window.addEventListener('store-change', () => this.renderOverview());
    window.addEventListener('store-status', ({ detail }) => {
      const status = document.getElementById('save-status');
      status.classList.toggle('error', detail.state === 'error');
      status.replaceChildren(document.createElement('span'), document.createTextNode(detail.state === 'error' ? 'Not saved · retry' : detail.message));
      status.title = detail.message;
      if (detail.state === 'error') this.notify(detail.message, 'error');
    });
    window.addEventListener('session-lost', () => this.notify('Your session expired or changed. Export unsaved data before signing in again.', 'error'));
    window.addEventListener('hashchange', () => this.navigateHash());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && store.getCurrentUser()) {
        this.renderOverview();
        authModule.renderUserProfileCard();
        scheduleModule.renderAllPanels();
      }
    });
    try {
      const user = await store.restoreSession();
      if (user) this.navigateHash();
      else this.switchScreen(['login-screen', 'create-account-screen'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'welcome-screen');
    } catch (error) {
      this.switchScreen('welcome-screen');
      this.notify(error.message, 'error');
    }
  }

  navigateHash() {
    const target = location.hash.slice(1);
    if (target === 'main-content') return;
    this.switchScreen(document.getElementById(target)?.classList.contains('screen') ? target : 'home-screen');
  }

  bindNavigation() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-screen]');
      if (!button) return;
      this.switchScreen(button.dataset.screen);
      if (button.dataset.subtab && button.dataset.screen === 'gym-screen') this.switchTrainingSubtab(button.dataset.subtab);
      if (button.dataset.subtab && button.dataset.screen === 'goals-screen') this.switchProgressSubtab(button.dataset.subtab);
    });
    document.getElementById('previous-workouts-container').addEventListener('click', event => {
      const button = event.target.closest('[data-workout-date]');
      if (button) this.viewWorkoutDetails(button.dataset.workoutDate);
    });
    const saveStatus = document.getElementById('save-status');
    saveStatus.setAttribute('role', 'button');
    saveStatus.tabIndex = 0;
    const retry = () => store.flush().catch(error => this.notify(error.message, 'error'));
    saveStatus.addEventListener('click', retry);
    saveStatus.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); retry(); } });
  }

  switchScreen(screenId) {
    const publicScreens = ['welcome-screen', 'login-screen', 'create-account-screen'];
    if (!store.getCurrentUser() && !publicScreens.includes(screenId)) screenId = 'welcome-screen';
    const target = document.getElementById(screenId);
    if (!target?.classList.contains('screen')) return;
    const previous = this.currentScreen;
    document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen === target));
    document.body.classList.toggle('public-shell', publicScreens.includes(screenId));
    this.currentScreen = screenId;
    const names = { 'home-screen': 'Overview', 'gym-screen': 'Training', 'goals-screen': 'My progress', 'jogging-screen': 'Interval timer', 'dashboard-screen': 'Activity log' };
    document.getElementById('page-title').textContent = names[screenId] || 'Welcome';
    document.title = `${names[screenId] || 'Welcome'} · OneUp | IYDV`;
    document.querySelectorAll('.nav-item').forEach(item => {
      const active = item.dataset.screen === screenId;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
    if (publicScreens.includes(screenId) && !store.getCurrentUser()) this.clearPrivateViews();
    if (location.hash !== `#${screenId}`) history.replaceState(null, '', `#${screenId}`);
    if (!publicScreens.includes(screenId)) {
      authModule.renderUserProfileCard();
      if (screenId === 'home-screen') this.renderOverview();
      if (screenId === 'gym-screen') this.switchTrainingSubtab(this.activeTrainingSubtab);
      if (screenId === 'goals-screen') this.switchProgressSubtab(this.activeProgressSubtab);
      if (screenId === 'dashboard-screen') dashboardModule.renderTeamDashboard();
      scheduleModule.renderAllPanels();
    }
    if (previous !== screenId) {
      document.querySelector('.app-content').scrollTop = 0;
      const heading = target.querySelector('h1, h2, input');
      if (heading) { if (heading.tagName !== 'INPUT') heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    this.refreshIcons();
  }

  switchTrainingSubtab(subtab) {
    this.activeTrainingSubtab = subtab === 'drills' ? 'drills' : 'gym';
    for (const name of ['gym', 'drills']) {
      const active = this.activeTrainingSubtab === name;
      const button = document.getElementById(`training-subtab-${name}`);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      document.getElementById(`training-${name}-view`).style.display = active ? 'block' : 'none';
    }
    if (this.activeTrainingSubtab === 'gym') gymModule.renderExerciseList(); else drillsModule.renderDrills();
    this.refreshIcons();
  }

  switchProgressSubtab(subtab) {
    this.activeProgressSubtab = ['goals', 'skills', 'weight'].includes(subtab) ? subtab : 'goals';
    for (const name of ['goals', 'skills', 'weight']) {
      const active = this.activeProgressSubtab === name;
      const button = document.getElementById(`progress-subtab-${name}`);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      document.getElementById(`progress-${name}-view`).style.display = active ? 'block' : 'none';
    }
    if (this.activeProgressSubtab === 'goals') goalsModule.renderGoals();
    if (this.activeProgressSubtab === 'skills') skillsModule.renderSkills();
    if (this.activeProgressSubtab === 'weight') { weightModule.renderWeightLogsHistory(); requestAnimationFrame(() => weightModule.renderWeightChart()); }
    this.refreshIcons();
  }

  labelControls(root = document) {
    root.querySelectorAll('.form-label:not([for])').forEach(label => {
      const input = label.parentElement.querySelector('input[id],select[id],textarea[id]');
      if (input) label.htmlFor = input.id;
    });
    root.querySelectorAll('button[title]:not([aria-label])').forEach(button => button.setAttribute('aria-label', button.title));
    root.querySelectorAll('button.toggle-password-btn').forEach(button => button.setAttribute('aria-label', 'Show or hide password'));
  }

  bindModals() {
    document.addEventListener('click', event => {
      if (event.target.classList.contains('modal-overlay')) this.dismissModal(event.target.id);
      const close = event.target.closest('.modal-close-btn');
      if (close) this.dismissModal(close.closest('.modal-overlay').id);
    });
    document.addEventListener('keydown', event => {
      const active = [...document.querySelectorAll('.modal-overlay.active')].pop();
      if (!active) return;
      if (event.key === 'Escape') { event.preventDefault(); this.dismissModal(active.id); }
      if (event.key === 'Tab') {
        const focusable = [...active.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(element => !element.disabled && element.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    this.modalTriggers.set(modalId, document.activeElement);
    modal.classList.add('active');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', modal.querySelector('.modal-title')?.textContent || 'Training dialog');
    document.querySelector('.app-viewport-wrapper').inert = true;
    this.labelControls(modal);
    this.refreshIcons();
    requestAnimationFrame(() => modal.querySelector('input:not([type="hidden"]),select,textarea,button')?.focus());
  }

  dismissModal(modalId) {
    if (modalId === 'active-workout-modal' && gymModule.activeExercise) gymModule.endExerciseSession();
    else this.closeModal(modalId);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    if (modalId === 'rest-timer-modal') clearInterval(gymModule.restTimerInterval);
    document.querySelector('.app-viewport-wrapper').inert = !!document.querySelector('.modal-overlay.active');
    const trigger = this.modalTriggers.get(modalId);
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    this.modalTriggers.delete(modalId);
  }

  clearPrivateViews() {
    for (const id of ['user-profile-card', 'previous-workouts-container', 'goals-list-container', 'skills-list-container', 'weight-history-list', 'team-metrics-grid', 'team-roster-list', 'attendance-approvals-list', 'workout-detail-content', 'report-summary-content', 'active-workout-content', 'top-attendance-banner', 'schedule-panel-home', 'schedule-panel-gym', 'schedule-panel-goals', 'schedule-panel-dashboard']) document.getElementById(id)?.replaceChildren();
    document.getElementById('greeting-name').textContent = 'athlete';
    for (const id of ['user-weight-display', 'user-height-display', 'user-bmi-display', 'user-bmi-category']) document.getElementById(id).textContent = '—';
  }

  refreshIcons() { this.labelControls(); if (window.lucide) lucide.createIcons({ attrs: { 'aria-hidden': 'true' } }); }

  notify(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    const content = document.createElement('span'); content.textContent = message;
    const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss notification'); close.onclick = () => toast.remove();
    toast.append(content, close);
    document.getElementById('toast-region').append(toast);
    setTimeout(() => toast.remove(), type === 'error' ? 14000 : 5000);
  }

  renderOverview() {
    const user = store.getCurrentUser();
    if (!user) return;
    this.renderPreviousWorkoutsList();
    const today = localDate();
    const now = new Date(`${today}T12:00:00+08:00`);
    const weekday = (now.getUTCDay() + 6) % 7;
    const dates = Array.from({ length: 7 }, (_, index) => { const day = new Date(now); day.setUTCDate(day.getUTCDate() - weekday + index); return localDate(day); });
    const trainingDays = new Set(store.getWorkoutLogs(user.MemberID).map(log => log.Date));
    const count = dates.filter(date => date <= today && trainingDays.has(date)).length;
    document.getElementById('week-session-count').textContent = count;
    document.getElementById('week-encouragement').textContent = count ? `${count} day${count === 1 ? '' : 's'} of showing up. Keep your momentum.` : 'Your next session is a fresh start.';
    document.getElementById('week-activity').innerHTML = dates.map((date, index) => `<div class="week-day ${date === today ? 'today' : ''} ${trainingDays.has(date) ? 'done' : ''}" aria-label="${date}: ${trainingDays.has(date) ? 'trained' : 'no training logged'}"><span>${['M','T','W','T','F','S','S'][index]}</span><i>${trainingDays.has(date) ? '✓' : Number(date.slice(-2))}</i></div>`).join('');
  }

  renderPreviousWorkoutsList() {
    const user = store.getCurrentUser();
    if (!user) return;
    const container = document.getElementById('previous-workouts-container');
    const grouped = Object.groupBy(store.getWorkoutLogs(user.MemberID), log => log.Date);
    const dates = Object.keys(grouped).sort().reverse().slice(0, 3);
    if (!dates.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon"><i data-lucide="dumbbell"></i></span><h3>Your story starts with a session.</h3><p>Log a workout or complete a drill.<br>Your recent training will appear here.</p><button class="text-button" data-screen="gym-screen">Find your first workout <i data-lucide="arrow-right"></i></button></div>`;
    } else {
      container.innerHTML = dates.map(date => {
        const logs = grouped[date];
        return `<button class="list-item workout-history-item" data-workout-date="${escapeHTML(date)}"><span><span class="list-title">${escapeHTML(date === localDate() ? 'Today' : new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }))} <span class="history-program">${escapeHTML(logs[0].Program || 'Training')}</span></span><span class="list-subtitle">${new Set(logs.map(log => log.Exercise)).size} exercises · ${logs.length} entries</span></span><i data-lucide="arrow-up-right"></i></button>`;
      }).join('');
    }
    this.refreshIcons();
  }

  viewWorkoutDetails(date) {
    const user = store.getCurrentUser();
    if (!user) return;
    const logs = store.getWorkoutLogs(user.MemberID).filter(log => log.Date === date);
    document.getElementById('workout-detail-content').innerHTML = `<p class="muted">${escapeHTML(date)} · ${logs.length} training entries</p>${logs.map(log => `<div class="list-item"><div class="list-title">${escapeHTML(log.Exercise)}</div><div class="list-subtitle">${escapeHTML(log.Program)}${log.Reps ? ` · ${escapeHTML(log.Reps)} reps` : ''}${log.WeightLbs || log['Weight (lbs)'] ? ` · ${escapeHTML(log.WeightLbs || log['Weight (lbs)'])} lbs` : ''}</div>${log.Notes ? `<p class="muted">${escapeHTML(log.Notes)}</p>` : ''}</div>`).join('')}`;
    this.openModal('view-workout-modal');
  }

  exportAccount() {
    if (!store.getCurrentUser()) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `oneup-data-${localDate()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.notify('Your data export has been downloaded. Keep it somewhere private.');
  }

  deleteAccount() { this.openModal('delete-account-modal'); }

  async confirmDeleteAccount(event) {
    event.preventDefault();
    const form = event.target, button = form.querySelector('[type="submit"]'), feedback = form.querySelector('.form-feedback');
    button.disabled = true; feedback.hidden = true;
    try {
      await store.deleteAccount(form.elements.password.value);
      authModule.resetTrainingDrafts();
      form.reset();
      document.querySelectorAll('.modal-overlay.active').forEach(modal => this.closeModal(modal.id));
      this.switchScreen('welcome-screen');
      this.notify('Your account and training records have been permanently deleted.');
    } catch (error) { feedback.textContent = error.message; feedback.hidden = false; }
    finally { button.disabled = false; }
  }
}
const app = new App();

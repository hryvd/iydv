/* Private activity overview. Team administration is intentionally unavailable. */
class DashboardModule {
  constructor() {
    document.getElementById('save-script-url-btn')?.addEventListener('click', () => this.handleSaveScriptUrl());
    document.getElementById('schedule-training-form')?.addEventListener('submit', e => {
      e.preventDefault();
      this.handleSaveTrainingSchedule();
    });
  }

  renderTeamDashboard() {
    const user = store.getCurrentUser();
    if (!user) return;
    const workouts = store.getWorkoutLogs(user.MemberID);
    const goals = store.getGoals(user.MemberID);
    const skills = store.getSkills(user.MemberID);
    const achieved = goals.filter(g => {
      const distance = Number(g.TargetValue) - Number(g.StartValue);
      return distance !== 0 && (Number(g.CurrentValue) - Number(g.StartValue)) / distance >= 1;
    }).length;
    const metrics = document.getElementById('team-metrics-grid');
    if (metrics) {
      metrics.className = 'stats-grid dashboard-grid mb-3';
      metrics.innerHTML = [
        ['Training days', new Set(workouts.map(w => w.Date)).size, 'Days with a logged activity'],
        ['Training entries', workouts.length, 'Your sets and completed activities'],
        ['Goals reached', `${achieved} / ${goals.length}`, 'Based on your recorded progress'],
        ['Skills learned', skills.length, 'Your personal skill journal']
      ].map(([label, value, detail]) => `<div class="stat-box"><div class="label">${label}</div><div class="value">${value}</div><div class="sub-value">${detail}</div></div>`).join('');
    }
    const profile = document.getElementById('team-roster-list');
    if (profile) profile.innerHTML = `
      <div class="list-item"><div><div class="list-title">${escapeHTML(user.FullName)}</div><div class="list-subtitle">${escapeHTML(user.Rank)} · ${escapeHTML(user.ProgramFocus || 'Whole Body')}</div></div><span class="badge badge-success">Your account</span></div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:12px;">Only your own training records appear here. Team rosters and coach approvals are not connected.</p>`;
    this.renderAttendanceApprovals();
  }

  renderAttendanceApprovals() {
    const container = document.getElementById('attendance-approvals-list');
    const user = store.getCurrentUser();
    if (!container || !user) return;
    const attendance = store.getAttendanceLogs().filter(a => a.MemberID === user.MemberID).sort((a, b) => String(b.Date).localeCompare(String(a.Date)));
    container.innerHTML = attendance.length ? attendance.slice(0, 30).map(a => `
      <div class="list-item"><div><div class="list-title">${escapeHTML(a.Date)}</div><div class="list-subtitle">Checked in at ${escapeHTML(a.Time || '—')}</div></div><span class="badge badge-primary">Self-reported</span></div>`).join('') : '<p style="color:var(--text-secondary);padding:12px 0;">No check-ins yet. Use today’s check-in on your overview to start your training habit.</p>';
  }

  approveCheckin() {
    app.notify('Coach approval is not connected. Check-ins are self-reported.', 'error');
  }

  openScheduleModal() {
    if (!store.getCurrentUser()) return;
    const dateInput = document.getElementById('sched-date');
    if (dateInput) {
      dateInput.min = localDate();
      if (!dateInput.value) dateInput.value = localDate();
    }
    app.openModal('schedule-training-modal');
  }

  handleSaveTrainingSchedule() {
    const user = store.getCurrentUser();
    if (!user) return;
    const sessionName = document.getElementById('sched-session-name').value.trim();
    const date = document.getElementById('sched-date').value;
    const callTime = document.getElementById('sched-call-time').value;
    const venue = document.getElementById('sched-venue').value.trim();
    const notes = document.getElementById('sched-notes').value.trim();
    if (!sessionName || sessionName.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < localDate() || venue.length > 200 || notes.length > 1000) {
      app.notify('Enter a session name (up to 120 characters) and a date from today onward.', 'error');
      return;
    }
    store.saveTrainingSchedule({
      ScheduleID: 'SCH' + crypto.randomUUID(), SessionName: sessionName,
      Date: date, CallTime: callTime, Venue: venue, WhoNeeded: ['You'], Notes: notes,
      CreatedBy: user.FullName, CreatedAt: new Date().toISOString()
    });
    app.closeModal('schedule-training-modal');
    document.getElementById('schedule-training-form').reset();
    if (typeof scheduleModule !== 'undefined') scheduleModule.renderAllPanels();
    app.notify('Session added to your personal schedule.', 'success');
  }

  openSheetsConfigModal() {
    app.notify('Your records are saved privately to your account. External Sheets sync is not enabled.', 'error');
  }

  handleSaveScriptUrl() { this.openSheetsConfigModal(); }
  testSheetsConnection() { this.openSheetsConfigModal(); }
}

const dashboardModule = new DashboardModule();

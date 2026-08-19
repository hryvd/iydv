/* ==========================================================================
   IYDV ONEUP - Coach / Officer Team Dashboard & Attendance Approvals
   Role-based: Only coaches (Alumni) and officers (Team Captain) can approve
   ========================================================================== */

class DashboardModule {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    const saveScriptUrlBtn = document.getElementById('save-script-url-btn');
    if (saveScriptUrlBtn) {
      saveScriptUrlBtn.addEventListener('click', () => this.handleSaveScriptUrl());
    }

    const scheduleForm = document.getElementById('schedule-training-form');
    if (scheduleForm) {
      scheduleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveTrainingSchedule();
      });
    }
  }

  renderTeamDashboard() {
    const currentUser = store.getCurrentUser();
    const canManage = isCoachOrOfficer(currentUser);

    const members = store.getMembers();
    const workouts = store.getWorkoutLogs();
    const goals = store.getGoals();

    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.Status === 'Active').length;
    const totalSets = workouts.length;
    const totalGoals = goals.length;
    const goalsAchieved = goals.filter(g => g.Status === 'Achieved' || g.ProgressPct >= 100).length;
    const goalRate = totalGoals > 0 ? Math.round((goalsAchieved / totalGoals) * 100) : 0;

    const avgBmi = members.length > 0
      ? (members.reduce((sum, m) => sum + (m.BMI || 0), 0) / members.length).toFixed(1)
      : '--';

    const metricsContainer = document.getElementById('team-metrics-grid');
    if (metricsContainer) {
      metricsContainer.className = 'stats-grid dashboard-grid mb-3';
      metricsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
      metricsContainer.innerHTML = `
        <div class="stat-box">
          <div class="label">Active Roster</div>
          <div class="value" style="color:var(--crimson);">${activeMembers} / ${totalMembers}</div>
          <div class="sub-value">varsity dancers</div>
        </div>
        <div class="stat-box">
          <div class="label">Total Sets Logged</div>
          <div class="value" style="color:var(--orange);">${totalSets}</div>
          <div class="sub-value">all-time sets</div>
        </div>
        <div class="stat-box">
          <div class="label">Goals Achieved</div>
          <div class="value" style="color:var(--green);">${goalsAchieved} (${goalRate}%)</div>
          <div class="sub-value">${totalGoals} goals set</div>
        </div>
        <div class="stat-box">
          <div class="label">Team Avg BMI</div>
          <div class="value" style="color:var(--orange);">${avgBmi}</div>
          <div class="sub-value">${avgBmi !== '--' ? 'Computed' : 'No data'}</div>
        </div>
      `;
    }

    // Show schedule training button only for coaches/officers
    const scheduleTrainingBtn = document.getElementById('schedule-training-btn');
    if (scheduleTrainingBtn) {
      scheduleTrainingBtn.style.display = canManage ? 'inline-flex' : 'none';
    }

    this.renderAttendanceApprovals();

    const rosterContainer = document.getElementById('team-roster-list');
    if (rosterContainer) {
      if (members.length === 0) {
        rosterContainer.innerHTML = `<div style="font-size:0.75rem; color:var(--text-tertiary); text-align:center; padding:12px;">No members registered yet.</div>`;
      } else {
        rosterContainer.innerHTML = members.map(m => `
          <div class="list-item">
            <div style="flex:1;">
              <div class="list-title">${m.FullName} <small style="color:var(--text-tertiary);">(${m.MemberID})</small></div>
              <div class="list-subtitle">${m.Rank} • ${m.ProgramFocus || 'Whole Body'} • ${m.WeightKg || '--'}kg / ${m.HeightCm || '--'}cm${m.BMI ? ` (BMI ${m.BMI})` : ''}</div>
            </div>
            <div>
              <span class="badge ${m.Status === 'Active' ? 'badge-success' : 'badge-warning'}">${m.Status || 'Active'}</span>
            </div>
          </div>
        `).join('');
      }
    }
  }

  renderAttendanceApprovals() {
    const container = document.getElementById('attendance-approvals-list');
    if (!container) return;

    const currentUser = store.getCurrentUser();
    const canApprove = isCoachOrOfficer(currentUser);

    const attendance = store.getAttendanceLogs();
    if (attendance.length === 0) {
      container.innerHTML = `<div style="font-size:0.75rem; color:var(--text-tertiary); text-align:center; padding:12px;">No attendance check-ins recorded.</div>`;
      return;
    }

    container.innerHTML = attendance.map(att => {
      let actionEl = '';

      if (att.Status === 'Approved') {
        actionEl = `<span class="badge badge-success">APPROVED BY ${this._esc(att.ApprovedBy || 'Admin')}</span>`;
      } else if (canApprove) {
        actionEl = `
          <button class="btn btn-sm btn-primary" style="width:auto; padding:5px 12px; font-size:0.68rem;"
                  onclick="dashboardModule.approveCheckin('${att.LogID}')">
            ✓ APPROVE
          </button>
        `;
      } else {
        actionEl = `<span class="badge badge-warning">PENDING</span>`;
      }

      return `
        <div class="list-item" style="border-left-color: ${att.Status === 'Approved' ? 'var(--green)' : 'var(--color-warning)'};">
          <div style="flex:1;">
            <div class="list-title">${this._esc(att.FullName)} (${att.MemberID})</div>
            <div class="list-subtitle">Date: ${att.Date} &nbsp;•&nbsp; Time: ${att.Time}${att.ApprovedAt ? ` &nbsp;•&nbsp; Approved: ${att.ApprovedAt}` : ''}</div>
          </div>
          <div>${actionEl}</div>
        </div>
      `;
    }).join('');
  }

  approveCheckin(logId) {
    const currentUser = store.getCurrentUser();
    if (!isCoachOrOfficer(currentUser)) {
      alert('⚠️ Only coaches and officers can approve attendance.');
      return;
    }

    const approverName = currentUser.FullName;
    store.approveAttendance(logId, approverName);
    this.renderAttendanceApprovals();
    if (window.authModule) authModule.renderUserProfileCard();

    alert(`✅ Attendance approved!\nRecorded as: Approved by ${approverName}`);
  }

  // ── Training Schedule ─────────────────────────────────────
  openScheduleModal() {
    const currentUser = store.getCurrentUser();
    if (!isCoachOrOfficer(currentUser)) {
      alert('⚠️ Only coaches and officers can schedule training sessions.');
      return;
    }
    app.openModal('schedule-training-modal');
  }

  handleSaveTrainingSchedule() {
    const currentUser = store.getCurrentUser();
    if (!isCoachOrOfficer(currentUser)) return;

    const sessionName = document.getElementById('sched-session-name').value.trim();
    const date = document.getElementById('sched-date').value;
    const callTime = document.getElementById('sched-call-time').value;
    const venue = document.getElementById('sched-venue').value.trim();
    const notes = document.getElementById('sched-notes').value.trim();

    if (!sessionName || !date) {
      alert('Please fill in the session name and date.');
      return;
    }

    // Collect who's needed
    const whoCheckboxes = document.querySelectorAll('.who-needed-chk:checked');
    const whoNeeded = Array.from(whoCheckboxes).map(cb => cb.value);
    if (whoNeeded.length === 0) whoNeeded.push('All Members');

    const schedule = {
      ScheduleID: 'SCH' + String(Date.now()).slice(-6),
      SessionName: sessionName,
      Date: date,
      CallTime: callTime,
      Venue: venue,
      WhoNeeded: whoNeeded,
      Notes: notes,
      CreatedBy: currentUser.FullName,
      CreatedAt: new Date().toISOString()
    };

    store.saveTrainingSchedule(schedule);
    app.closeModal('schedule-training-modal');

    // Reset form
    document.getElementById('schedule-training-form').reset();

    // Refresh all schedule panels
    if (window.scheduleModule) scheduleModule.renderAllPanels();

    alert(`📅 Training scheduled!\n"${sessionName}" on ${date}${callTime ? ' at ' + callTime : ''}${venue ? '\nVenue: ' + venue : ''}`);
  }

  // ── Sheets Config ─────────────────────────────────────────
  openSheetsConfigModal() {
    const currentUrl = store.getAppsScriptUrl();
    const input = document.getElementById('sheets-url-input');
    if (input) input.value = currentUrl;
    app.openModal('sheets-config-modal');
  }

  handleSaveScriptUrl() {
    const url = document.getElementById('sheets-url-input').value.trim();
    if (!url) {
      alert('Please enter a valid Apps Script Web App URL.');
      return;
    }
    store.setAppsScriptUrl(url);
    alert('✅ Google Apps Script Web App URL saved! Live sync is now enabled.');
    app.closeModal('sheets-config-modal');
  }

  async testSheetsConnection() {
    const url = document.getElementById('sheets-url-input').value.trim();
    if (!url) {
      alert('Please enter a Web App URL first.');
      return;
    }

    try {
      const res = await fetch(`${url}?sheet=Members`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          alert(`✅ Connection Successful!\nGoogle Sheets returned ${data.length} member record(s).`);
        } else if (data.error) {
          alert(`⚠️ Sheets API error: ${data.error}`);
        } else {
          alert(`✅ Connection Successful! Response received from Sheets API.`);
        }
      } else {
        alert('⚠️ Endpoint returned non-200. Check deployment permissions.');
      }
    } catch (e) {
      alert(`⚠️ Connection error: ${e.message}\nMake sure Apps Script is deployed as "Anyone" access.`);
    }
  }

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

const dashboardModule = new DashboardModule();

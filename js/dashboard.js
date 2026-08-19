/* ==========================================================================
   IYDV ONEUP - Coach / Team Dashboard & Attendance Approvals
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
  }

  renderTeamDashboard() {
    const members = store.getMembers();
    const workouts = store.getWorkoutLogs();
    const weights = store.getWeightLogs();
    const goals = store.getGoals();
    const skills = store.getSkills();
    const attendance = store.getAttendanceLogs();

    // Compute Metrics matching Sheet Dashboard Tab
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.Status === 'Active').length;
    const totalSets = workouts.length;
    const totalGoals = goals.length;
    const goalsAchieved = goals.filter(g => g.Status === 'Achieved' || g.ProgressPct >= 100).length;
    const goalRate = totalGoals > 0 ? Math.round((goalsAchieved / totalGoals) * 100) : 0;

    const avgBmi = members.length > 0 
      ? (members.reduce((sum, m) => sum + (m.BMI || 22), 0) / members.length).toFixed(1) 
      : 23.0;

    // Render Metrics Boxes
    const metricsContainer = document.getElementById('team-metrics-grid');
    if (metricsContainer) {
      metricsContainer.innerHTML = `
        <div class="stat-box" style="background:#fff; border:1px solid #e5e7eb;">
          <div class="label" style="color:var(--text-muted);">Active Roster</div>
          <div class="value" style="color:var(--primary-crimson);">${activeMembers} / ${totalMembers}</div>
          <div class="sub-value">varsity dancers</div>
        </div>
        <div class="stat-box" style="background:#fff; border:1px solid #e5e7eb;">
          <div class="label" style="color:var(--text-muted);">Total Sets Logged</div>
          <div class="value" style="color:var(--primary-crimson);">${totalSets}</div>
          <div class="sub-value">all-time sets</div>
        </div>
        <div class="stat-box" style="background:#fff; border:1px solid #e5e7eb;">
          <div class="label" style="color:var(--text-muted);">Goals Achieved</div>
          <div class="value" style="color:var(--color-success);">${goalsAchieved} (${goalRate}%)</div>
          <div class="sub-value">${totalGoals} goals set</div>
        </div>
        <div class="stat-box" style="background:#fff; border:1px solid #e5e7eb;">
          <div class="label" style="color:var(--text-muted);">Team Avg BMI</div>
          <div class="value" style="color:var(--accent-orange);">${avgBmi}</div>
          <div class="sub-value">Normal category</div>
        </div>
      `;
    }

    // Render Attendance Approvals Section
    this.renderAttendanceApprovals();

    // Render Member Roster Table
    const rosterContainer = document.getElementById('team-roster-list');
    if (rosterContainer) {
      rosterContainer.innerHTML = members.map(m => `
        <div class="list-item">
          <div>
            <div class="list-title">${m.FullName} <small style="color:var(--text-muted);">(${m.MemberID})</small></div>
            <div class="list-subtitle">${m.Rank} • ${m.ProgramFocus} • ${m.WeightKg}kg / ${m.HeightCm}cm (BMI ${m.BMI})</div>
          </div>
          <div>
            <span class="badge ${m.Status === 'Active' ? 'badge-success' : 'badge-warning'}">${m.Status}</span>
          </div>
        </div>
      `).join('');
    }
  }

  renderAttendanceApprovals() {
    const container = document.getElementById('attendance-approvals-list');
    if (!container) return;

    const attendance = store.getAttendanceLogs();
    if (attendance.length === 0) {
      container.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:8px;">No attendance check-ins recorded.</div>`;
      return;
    }

    container.innerHTML = attendance.map(att => {
      let actionBtn = `<span class="badge badge-success">APPROVED by ${att.ApprovedBy || 'Coach'}</span>`;
      if (att.Status === 'Pending Approval') {
        actionBtn = `
          <button class="btn btn-sm btn-primary" style="width:auto; padding:4px 10px; font-size:0.7rem;" onclick="dashboardModule.approveCheckin('${att.LogID}')">
            APPROVE
          </button>
        `;
      }

      return `
        <div class="list-item" style="border-left-color: ${att.Status === 'Approved' ? 'var(--color-success)' : 'var(--color-warning)'};">
          <div>
            <div class="list-title">${att.FullName} (${att.MemberID})</div>
            <div class="list-subtitle">Date: ${att.Date} • Time: ${att.Time}</div>
          </div>
          <div>${actionBtn}</div>
        </div>
      `;
    }).join('');
  }

  approveCheckin(logId) {
    store.approveAttendance(logId, 'Coach Santos');
    this.renderAttendanceApprovals();
    
    // Refresh user profile if current user
    authModule.renderUserProfileCard();

    alert('✅ Attendance Check-In Approved! Recorded in Sheets.');
  }

  openSheetsConfigModal() {
    const currentUrl = store.getAppsScriptUrl();
    const input = document.getElementById('sheets-url-input');
    if (input) input.value = currentUrl;
    app.openModal('sheets-config-modal');
  }

  handleSaveScriptUrl() {
    const url = document.getElementById('sheets-url-input').value.trim();
    store.setAppsScriptUrl(url);
    alert('Google Apps Script Web App URL updated successfully! Live sync enabled.');
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
        alert('✅ Connection Successful! Google Sheets API is responding cleanly.');
      } else {
        alert('⚠️ Endpoint returned non-200 status. Check deployment permissions.');
      }
    } catch (e) {
      alert(`⚠️ Connection Notice: CORS or endpoint check result. Code: ${e.message}`);
    }
  }
}

const dashboardModule = new DashboardModule();

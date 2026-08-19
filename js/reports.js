/* ==========================================================================
   IYDV ONEUP - Progress Reports Generator & PDF/CSV Export Module
   ========================================================================== */

class ReportsModule {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    const periodSelect = document.getElementById('report-period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', () => this.renderReportData());
    }
  }

  openReportModal() {
    this.renderReportData();
    app.openModal('progress-report-modal');
  }

  renderReportData() {
    const user = store.getCurrentUser();
    const period = document.getElementById('report-period-select') ? document.getElementById('report-period-select').value : '30';
    
    const days = parseInt(period);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const workouts = store.getWorkoutLogs(user.MemberID)
      .filter(w => new Date(w.Date) >= cutoffDate);

    const weightLogs = store.getWeightLogs(user.MemberID)
      .filter(w => new Date(w.Date) >= cutoffDate)
      .sort((a,b) => new Date(a.Date) - new Date(b.Date));

    const goals = store.getGoals(user.MemberID);
    const skills = store.getSkills(user.MemberID)
      .filter(s => new Date(s.DateLearned) >= cutoffDate);

    // Compute Metrics
    const totalWorkouts = new Set(workouts.map(w => w.Date)).size;
    const totalSets = workouts.reduce((sum, w) => sum + (w.SetNum || 1), 0);
    const totalReps = workouts.reduce((sum, w) => sum + (w.Reps || 0), 0);
    const avgReps = workouts.length > 0 ? (totalReps / workouts.length).toFixed(1) : 0;

    let weightChange = 0;
    if (weightLogs.length >= 2) {
      weightChange = (weightLogs[weightLogs.length - 1].WeightKg - weightLogs[0].WeightKg).toFixed(1);
    }

    const goalsAchieved = goals.filter(g => g.Status === 'Achieved' || g.ProgressPct >= 100).length;
    const newSkillsCount = skills.length;
    const attendanceRate = Math.min(100, Math.round((totalWorkouts / (days / 7 * 4)) * 100)) || 85; // Est 4 sessions/week

    // Populate UI Preview
    const summaryContainer = document.getElementById('report-summary-content');
    if (summaryContainer) {
      summaryContainer.innerHTML = `
        <div style="background:linear-gradient(135deg, #580a0a 0%, #3b0505 100%); color:#fff; padding:16px; border-radius:12px; margin-bottom:14px;">
          <div style="display:flex; justify-between; align-items:center;">
            <div>
              <div style="font-family:var(--font-heading); font-weight:800; font-size:1.1rem; text-transform:uppercase;">${user.FullName}</div>
              <div style="font-size:0.75rem; opacity:0.85;">ID: ${user.MemberID} • Rank: ${user.Rank}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.7rem; text-transform:uppercase; color:var(--accent-orange); font-weight:800;">Report Period</div>
              <div style="font-weight:700; font-size:0.85rem;">Last ${days} Days</div>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:14px;">
          <div class="stat-box" style="background:#f8f9fa; border:1px solid #e5e7eb;">
            <div class="label" style="color:var(--text-muted);">Workout Sessions</div>
            <div class="value" style="color:var(--primary-crimson);">${totalWorkouts}</div>
            <div class="sub-value">${totalSets} total sets</div>
          </div>
          <div class="stat-box" style="background:#f8f9fa; border:1px solid #e5e7eb;">
            <div class="label" style="color:var(--text-muted);">Avg Reps / Set</div>
            <div class="value" style="color:var(--primary-crimson);">${avgReps}</div>
            <div class="sub-value">intensity index</div>
          </div>
          <div class="stat-box" style="background:#f8f9fa; border:1px solid #e5e7eb;">
            <div class="label" style="color:var(--text-muted);">Body Weight Delta</div>
            <div class="value" style="color:${weightChange <= 0 ? 'var(--color-success)' : 'var(--accent-orange)'};">${weightChange > 0 ? '+' : ''}${weightChange} kg</div>
            <div class="sub-value">Current: ${user.WeightKg} kg</div>
          </div>
          <div class="stat-box" style="background:#f8f9fa; border:1px solid #e5e7eb;">
            <div class="label" style="color:var(--text-muted);">Goals Achieved</div>
            <div class="value" style="color:var(--primary-crimson);">${goalsAchieved} / ${goals.length}</div>
            <div class="sub-value">${newSkillsCount} new skills learned</div>
          </div>
        </div>

        <div class="card mb-2" style="padding:12px;">
          <div style="font-weight:700; font-size:0.85rem; color:var(--primary-crimson); margin-bottom:4px;">Recent Workouts Logged:</div>
          ${workouts.slice(0, 4).map(w => `
            <div style="font-size:0.75rem; border-bottom:1px solid #f1f3f5; padding:4px 0; display:flex; justify-between;">
              <span>${w.Date} - <strong>${w.Exercise}</strong> (${w.SetNum ? `Set ${w.SetNum}: ` : ''}${w.Reps} reps @ ${w.WeightLbs}lbs)</span>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  downloadPDF() {
    window.print();
  }

  exportCSV() {
    const user = store.getCurrentUser();
    const workouts = store.getWorkoutLogs(user.MemberID);
    
    let csvContent = "data:text/csv;charset=utf-8,LogID,Date,MemberID,Program,Exercise,SetNum,Reps,WeightLbs,RPE,Notes\n";
    
    workouts.forEach(w => {
      csvContent += `${w.LogID},${w.Date},${w.MemberID},"${w.Program}","${w.Exercise}",${w.SetNum || 1},${w.Reps},${w.WeightLbs},${w.RPE || ''},"${(w.Notes||'').replace(/"/g, '""')}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IYDV_Progress_Report_${user.Username}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

const reportsModule = new ReportsModule();

/* Personal progress reports. Every number comes from the selected account. */
class ReportsModule {
  constructor() {
    document.getElementById('report-period-select')?.addEventListener('change', () => this.renderReportData());
  }

  openReportModal() {
    this.renderReportData();
    app.openModal('progress-report-modal');
  }

  getReportData() {
    const user = store.getCurrentUser();
    if (!user) return null;
    const selected = Number(document.getElementById('report-period-select')?.value || 30);
    const days = [7, 30, 90].includes(selected) ? selected : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    const start = localDate(cutoff);
    const end = localDate();
    const inPeriod = date => typeof date === 'string' && date >= start && date <= end;
    return {
      user, days,
      workouts: store.getWorkoutLogs(user.MemberID).filter(w => inPeriod(w.Date)).sort((a, b) => b.Date.localeCompare(a.Date)),
      weights: store.getWeightLogs(user.MemberID).filter(w => inPeriod(w.Date)).sort((a, b) => a.Date.localeCompare(b.Date)),
      goals: store.getGoals(user.MemberID),
      skills: store.getSkills(user.MemberID).filter(s => inPeriod(s.DateLearned))
    };
  }

  renderReportData() {
    const data = this.getReportData();
    const container = document.getElementById('report-summary-content');
    if (!data || !container) return;
    const { user, days, workouts, weights, goals, skills } = data;
    const trainingDays = new Set(workouts.map(w => w.Date)).size;
    const goalsAchieved = goals.filter(g => {
      const distance = Number(g.TargetValue) - Number(g.StartValue);
      return distance !== 0 && (Number(g.CurrentValue) - Number(g.StartValue)) / distance >= 1;
    }).length;
    const change = weights.length >= 2 ? Number(weights.at(-1).WeightKg) - Number(weights[0].WeightKg) : null;
    container.innerHTML = `
      <div class="report-heading mb-3">
        <h3>${escapeHTML(user.FullName)}</h3>
        <p style="color:var(--text-secondary);">Last ${days} days · ${escapeHTML(user.Rank)}</p>
      </div>
      <div class="stats-grid mb-3" style="grid-template-columns:repeat(2,minmax(0,1fr));">
        <div class="stat-box"><div class="label">Training days</div><div class="value">${trainingDays}</div><div class="sub-value">${workouts.length} sets and activities</div></div>
        <div class="stat-box"><div class="label">Weight change</div><div class="value">${change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`}</div><div class="sub-value">${change === null ? 'Needs two entries in this period' : 'First to latest entry in this period'}</div></div>
        <div class="stat-box"><div class="label">Goals reached</div><div class="value">${goalsAchieved} / ${goals.length}</div><div class="sub-value">All current goals</div></div>
        <div class="stat-box"><div class="label">Skills added</div><div class="value">${skills.length}</div><div class="sub-value">In the selected period</div></div>
      </div>
      <div class="card mb-2">
        <div class="card-title mb-2">Recent training</div>
        ${workouts.length ? workouts.slice(0, 6).map(w => {
          const set = Number(w.SetNum ?? w['Set #']) || 1;
          const weight = Number(w.WeightLbs ?? w['Weight (lbs)']) || 0;
          return `<div class="list-item"><div><div class="list-title">${escapeHTML(w.Exercise)}</div><div class="list-subtitle">${escapeHTML(w.Date)} · ${escapeHTML(w.Program)} · Set ${set}${Number(w.Reps) > 0 ? ` · ${Number(w.Reps)} reps` : ''}${weight ? ` · ${weight} lbs` : ''}</div></div></div>`;
        }).join('') : '<p style="color:var(--text-secondary);">No training logged in this period. Your next session will appear here.</p>'}
      </div>`;
  }

  downloadPDF() {
    this.renderReportData();
    window.print();
  }

  csvCell(value) {
    let text = value == null ? '' : String(value);
    // Spreadsheet applications execute formula-looking cells even in quoted CSV.
    if (typeof value !== 'number' && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  }

  exportCSV() {
    const data = this.getReportData();
    if (!data) return;
    if (!data.workouts.length) {
      app.notify('No training entries in this period to export.', 'error');
      return;
    }
    const rows = [['LogID', 'Date', 'MemberID', 'Program', 'Exercise', 'SetNum', 'Reps', 'WeightLbs', 'RPE', 'Notes']];
    data.workouts.forEach(w => rows.push([
      w.LogID, w.Date, w.MemberID, w.Program, w.Exercise,
      Number(w.SetNum ?? w['Set #']) || 1,
      Number(w.Reps) || 0,
      Number(w.WeightLbs ?? w['Weight (lbs)']) || 0,
      Number(w.RPE ?? w['RPE (1-10)']) || '', w.Notes
    ]));
    const csv = '\uFEFF' + rows.map(row => row.map(value => this.csvCell(value)).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ONEUP_Training_${data.days}days_${localDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.notify('Training report exported.', 'success');
  }
}

const reportsModule = new ReportsModule();

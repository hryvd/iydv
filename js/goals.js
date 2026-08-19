/* ==========================================================================
   IYDV ONEUP - Goal Setting & Progress Tracking Module
   ========================================================================== */

class GoalsModule {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    const saveGoalForm = document.getElementById('save-goal-form');
    if (saveGoalForm) {
      saveGoalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveGoal();
      });
    }
  }

  openAddGoalModal() {
    document.getElementById('goal-type-input').value = 'Strength';
    document.getElementById('goal-desc-input').value = '';
    document.getElementById('goal-metric-input').value = 'lbs';
    document.getElementById('goal-start-input').value = '0';
    document.getElementById('goal-target-input').value = '100';
    document.getElementById('goal-date-input').value = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

    app.openModal('add-goal-modal');
  }

  handleSaveGoal() {
    const user = store.getCurrentUser();
    const type = document.getElementById('goal-type-input').value;
    const desc = document.getElementById('goal-desc-input').value.trim();
    const metric = document.getElementById('goal-metric-input').value.trim();
    const startVal = parseFloat(document.getElementById('goal-start-input').value) || 0;
    const targetVal = parseFloat(document.getElementById('goal-target-input').value) || 0;
    const dateStr = document.getElementById('goal-date-input').value;

    if (!desc || isNaN(targetVal)) {
      alert('Please enter a valid goal description and target value.');
      return;
    }

    const newGoal = {
      GoalID: 'G' + String(Date.now()).slice(-6),
      MemberID: user.MemberID,
      GoalType: type,
      Description: desc,
      Metric: metric || 'units',
      StartValue: startVal,
      TargetValue: targetVal,
      CurrentValue: startVal,
      TargetDate: dateStr,
      Status: 'In Progress'
    };

    store.saveGoal(newGoal);
    this.renderGoals();
    app.closeModal('add-goal-modal');
    alert('🎯 Target Goal added successfully!');
  }

  renderGoals() {
    const container = document.getElementById('goals-list-container');
    if (!container) return;

    const user = store.getCurrentUser();
    const goals = store.getGoals(user.MemberID);

    if (goals.length === 0) {
      container.innerHTML = `
        <div class="card text-center" style="padding: 24px;">
          <div style="font-size:2.5rem; margin-bottom:8px;">🎯</div>
          <div style="font-family:var(--font-heading); font-weight:700; color:var(--primary-crimson);">No Active Training Goals</div>
          <p style="font-size:0.78rem; color:var(--text-muted); margin:6px 0 14px;">Set measurable targets for Strength, Weight, Skills, or Endurance to track your varsity growth.</p>
          <button class="btn btn-primary" onclick="goalsModule.openAddGoalModal()">
            <i data-lucide="plus"></i> Create First Goal
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = goals.map(g => {
      // Auto-compute current value live if possible
      let currentVal = g.CurrentValue;
      if (g.GoalType === 'Weight') {
        currentVal = user.WeightKg;
      } else if (g.GoalType === 'Strength') {
        // Read heaviest set from workouts
        const workouts = store.getWorkoutLogs(user.MemberID);
        const maxWeight = workouts.reduce((max, w) => Math.max(max, w.WeightLbs || 0), g.StartValue);
        currentVal = maxWeight;
      }

      // Compute progress %
      let progressPct = 0;
      const totalDist = Math.abs(g.TargetValue - g.StartValue);
      if (totalDist > 0) {
        const achievedDist = Math.abs(currentVal - g.StartValue);
        progressPct = Math.min(100, Math.max(0, Math.round((achievedDist / totalDist) * 100)));
      }

      let statusBadge = `<span class="badge badge-warning">In Progress</span>`;
      if (progressPct >= 100) {
        statusBadge = `<span class="badge badge-success">Achieved 🏆</span>`;
        g.Status = 'Achieved';
      }

      let barColor = 'var(--accent-orange-gradient)';
      if (progressPct < 35) barColor = 'linear-gradient(135deg, #ef4444, #dc2626)';
      else if (progressPct >= 100) barColor = 'linear-gradient(135deg, #10b981, #059669)';

      return `
        <div class="card" style="margin-bottom:12px;">
          <div class="d-flex justify-between align-center mb-2">
            <div>
              <span class="badge badge-primary">${g.GoalType}</span>
              <div style="font-family:var(--font-heading); font-weight:800; font-size:1rem; color:var(--text-main); margin-top:4px;">
                ${g.Description}
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>
          
          <div class="d-flex justify-between align-center" style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">
            <span>Current: <strong>${currentVal} ${g.Metric}</strong></span>
            <span>Target: <strong>${g.TargetValue} ${g.Metric}</strong></span>
          </div>

          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPct}%; background: ${barColor};"></div>
          </div>

          <div class="d-flex justify-between align-center mt-2" style="font-size:0.72rem; color:var(--text-muted);">
            <span>Target Date: ${g.TargetDate || 'Open'}</span>
            <span style="font-weight:700; color:var(--primary-crimson);">${progressPct}% Completed</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }
}

const goalsModule = new GoalsModule();

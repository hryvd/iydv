/* Measurable goals. Progress follows the direction from start to target. */
class GoalsModule {
  constructor() {
    document.getElementById('save-goal-form')?.addEventListener('submit', event => {
      event.preventDefault();
      this.handleSaveGoal();
    });
    document.getElementById('goals-list-container')?.addEventListener('click', event => {
      const button = event.target.closest('[data-delete-goal]');
      if (button) this.deleteGoal(button.dataset.deleteGoal);
    });
    document.getElementById('goals-list-container')?.addEventListener('submit', event => {
      const form = event.target.closest('[data-goal-progress]');
      if (!form) return;
      event.preventDefault();
      const goal = store.getGoals(store.getCurrentUser()?.MemberID).find(item => item.GoalID === form.dataset.goalProgress);
      const value = Number(form.elements.current.value);
      if (!goal || !Number.isFinite(value) || Math.abs(value) > 1000000) return app.notify('Enter a valid measurement.', 'error');
      goal.CurrentValue = value;
      goal.ProgressPct = this.progress(goal);
      goal.Status = goal.ProgressPct >= 100 ? 'Achieved' : 'In Progress';
      store.saveGoal(goal);
      this.renderGoals();
      app.notify('Goal progress updated.', 'success');
    });
  }

  deleteGoal(id) {
    const user = store.getCurrentUser();
    if (!user) return;
    const goal = store.getGoals(user.MemberID).find(item => item.GoalID === id);
    if (!goal || !confirm(`Delete the goal "${goal.Description}" and its progress?`)) return;
    store.setItem(STORAGE_KEYS.GOALS, store.getGoals().filter(item => item.MemberID !== user.MemberID || item.GoalID !== id));
    this.renderGoals();
    app.notify('Goal removed.', 'success');
  }

  progress(goal) {
    const distance = Number(goal.TargetValue) - Number(goal.StartValue);
    if (!distance) return 0;
    return Math.min(100, Math.max(0, Math.round((Number(goal.CurrentValue) - Number(goal.StartValue)) / distance * 100)));
  }

  openAddGoalModal() {
    document.getElementById('save-goal-form').reset();
    document.getElementById('goal-type-input').value = 'Strength';
    document.getElementById('goal-metric-input').value = 'lbs';
    document.getElementById('goal-start-input').value = '0';
    document.getElementById('goal-target-input').value = '100';
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    document.getElementById('goal-date-input').value = localDate(targetDate);
    app.openModal('add-goal-modal');
  }

  handleSaveGoal() {
    const user = store.getCurrentUser();
    if (!user) return;
    const desc = document.getElementById('goal-desc-input').value.trim();
    const metric = document.getElementById('goal-metric-input').value.trim();
    const startVal = Number(document.getElementById('goal-start-input').value);
    const targetVal = Number(document.getElementById('goal-target-input').value);
    const dateStr = document.getElementById('goal-date-input').value;
    if (!desc || desc.length > 200 || metric.length > 20 || !Number.isFinite(startVal) || !Number.isFinite(targetVal) || Math.abs(startVal) > 1000000 || Math.abs(targetVal) > 1000000 || startVal === targetVal) {
      return app.notify('Add a short description and different start and target measurements.', 'error');
    }
    if (dateStr && dateStr < localDate()) return app.notify('Choose today or a future target date.', 'error');
    store.saveGoal({
      GoalID: 'G' + crypto.randomUUID(), MemberID: user.MemberID,
      GoalType: document.getElementById('goal-type-input').value,
      Description: desc, Metric: metric || 'units', StartValue: startVal,
      TargetValue: targetVal, CurrentValue: startVal, TargetDate: dateStr,
      Status: 'In Progress', ProgressPct: 0
    });
    this.renderGoals();
    app.closeModal('add-goal-modal');
    app.notify('Your goal has been added.', 'success');
  }

  renderGoals() {
    const container = document.getElementById('goals-list-container');
    const user = store.getCurrentUser();
    if (!container || !user) return;
    const goals = store.getGoals(user.MemberID);
    if (!goals.length) {
      container.innerHTML = `<div class="card text-center empty-state"><i data-lucide="target"></i><h3>Give your training a direction</h3><p>Set a measurable goal, then update your progress as you train.</p><button class="btn btn-primary" onclick="goalsModule.openAddGoalModal()"><i data-lucide="plus"></i> Set your first goal</button></div>`;
    } else {
      container.innerHTML = goals.map(goal => {
        const pct = this.progress(goal);
        const id = escapeHTML(goal.GoalID);
        return `<article class="card goal-card mb-3">
          <div class="d-flex justify-between align-center mb-2"><span class="badge badge-primary">${escapeHTML(goal.GoalType)}</span><div class="d-flex align-center gap-2"><span class="badge ${pct >= 100 ? 'badge-success' : 'badge-warning'}">${pct >= 100 ? 'Achieved' : 'In progress'}</span><button type="button" class="icon-btn" data-delete-goal="${id}" aria-label="Delete goal: ${escapeHTML(goal.Description)}" title="Delete goal"><i data-lucide="trash-2"></i></button></div></div>
          <h3 class="list-title">${escapeHTML(goal.Description)}</h3>
          <p class="list-subtitle mb-2">${escapeHTML(goal.StartValue)} → ${escapeHTML(goal.TargetValue)} ${escapeHTML(goal.Metric)}</p>
          <div class="progress-bar-bg" role="progressbar" aria-label="${escapeHTML(goal.Description)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar-fill" style="width:${pct}%; background:var(--orange)"></div></div>
          <div class="d-flex justify-between mt-2 list-subtitle"><span>${goal.TargetDate ? 'Target: ' + escapeHTML(goal.TargetDate) : 'No deadline'}</span><strong>${pct}%</strong></div>
          <form data-goal-progress="${id}" class="goal-progress-form mt-3" style="display:flex;gap:8px;align-items:end"><div style="flex:1"><label for="current-${id}" class="form-label">Current measurement (${escapeHTML(goal.Metric)})</label><input id="current-${id}" class="form-control" type="number" step="any" min="-1000000" max="1000000" name="current" value="${escapeHTML(goal.CurrentValue)}" required></div><button class="btn btn-outline" style="width:auto" type="submit">Update</button></form>
        </article>`;
      }).join('');
    }
    if (window.lucide) lucide.createIcons();
  }
}
const goalsModule = new GoalsModule();

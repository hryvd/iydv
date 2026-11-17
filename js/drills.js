/* ==========================================================================
   IYDV ONEUP - Regular & Contemporary Drills Module
   Coach/Officer can add custom drills to the catalog.
   ========================================================================== */

class DrillsModule {
  constructor() {
    this.completedDrills = { 'Regular Drill': Object.create(null), 'Contemporary Drill': Object.create(null) };
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.renderDrills();
        this.bindModalEvents();
      });
    } else {
      this.renderDrills();
      this.bindModalEvents();
    }
  }

  bindModalEvents() {
    document.addEventListener('change', event => {
      const input = event.target.closest('[data-drill-index]');
      if (!input) return;
      const category = input.dataset.category;
      const drill = store.getDrillsReference().filter(item => item.Category === category)[Number(input.dataset.drillIndex)];
      if (!drill) return;
      this.confirmDrillCompletion(category, drill.Name);
      document.getElementById(input.id)?.focus();
    });
    const form = document.getElementById('add-drill-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveDrill();
      });
    }
  }

  renderDrills() {
    this.renderDrillChecklist('regular-drills-list', 'Regular Drill');
    this.renderDrillChecklist('contemporary-drills-list', 'Contemporary Drill');
  }

  renderDrillChecklist(containerId, categoryName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const user = store.getCurrentUser();
    const canManage = Boolean(user);

    const drills = store.getDrillsReference().filter(d => d.Category === categoryName);

    if (drills.length === 0) {
      container.innerHTML = `<div class="text-center" style="color:var(--text-tertiary); padding:16px;">No drills found.</div>`;
      return;
    }

    const completed = this.completedDrills[categoryName] || {};
    const completedCount = Object.keys(completed).length;

    container.innerHTML = `
      ${canManage ? `
        <div class="admin-section-header" style="margin-bottom:10px;">
          <span style="font-size:0.7rem; color:var(--text-tertiary);">Tap to complete</span>
          <button class="admin-add-btn" onclick="drillsModule.openAddDrillModal('${categoryName}')">
            <i data-lucide="plus" style="width:13px;height:13px;"></i> ADD DRILL
          </button>
        </div>
      ` : ''}

      <form id="${categoryName.replace(/\s+/g, '-').toLowerCase()}-form">
        ${drills.map((drill, index) => {
          const inputId = `drill-chk-${categoryName.replace(/\s+/g, '')}-${index}`;
          const isCompleted = completed[drill.Name];

          return `
            <label class="drill-checklist-card ${isCompleted ? 'drill-completed' : ''}" for="${inputId}" style="cursor:pointer;${isCompleted ? 'opacity:0.85;' : ''}">
              <span class="drill-checklist-label">
                <span class="drill-name">${escapeHTML(drill.Name)}${drill.IsCustom ? ' <span style="font-size:0.65rem;opacity:0.8;">Custom</span>' : ''}</span>
                <input type="checkbox" id="${inputId}" class="drill-checkbox" data-drill-index="${index}" data-category="${categoryName}" ${isCompleted ? 'checked' : ''}>
                <span class="custom-checkbox-ui" aria-hidden="true"></span>
              </span>
            </label>
          `;
        }).join('')}

        <div style="margin-top: 16px; text-align: center;">
          <button type="button" class="btn btn-crimson ${completedCount === 0 ? 'btn-disabled' : ''}"
                  onclick="drillsModule.submitDrillBatch('${categoryName}')"
                  ${completedCount === 0 ? 'disabled' : ''}>
            <i data-lucide="check-circle"></i> SUBMIT ${categoryName.toUpperCase()}S (${completedCount})
          </button>
        </div>
      </form>
    `;

    if (window.lucide) lucide.createIcons();
  }

  confirmDrillCompletion(categoryName, drillName) {
    if (!this.completedDrills[categoryName]) {
      this.completedDrills[categoryName] = Object.create(null);
    }
    if (this.completedDrills[categoryName][drillName]) delete this.completedDrills[categoryName][drillName];
    else this.completedDrills[categoryName][drillName] = true;

    const containerId = categoryName === 'Regular Drill' ? 'regular-drills-list' : 'contemporary-drills-list';
    this.renderDrillChecklist(containerId, categoryName);
  }

  submitDrillBatch(categoryName) {
    const user = store.getCurrentUser();
    if (!user) return;

    const completed = this.completedDrills[categoryName] || {};
    const completedNames = Object.keys(completed);

    if (completedNames.length === 0) {
      app.notify('Select at least one completed drill.', 'error');
      return;
    }

    const todayStr = localDate();
    const logBatch = [];

    completedNames.forEach(drillName => {
      logBatch.push({
        LogID: 'L' + crypto.randomUUID(),
        Date: todayStr,
        MemberID: user.MemberID,
        Program: categoryName,
        Exercise: drillName,
        SetNum: 1,
        Reps: 0,
        WeightLbs: 0,
        RPE: 0,
        Notes: `Completed in daily ${categoryName} checklist session`
      });

    });

    store.addWorkoutLogsBatch(logBatch);

    this.completedDrills[categoryName] = Object.create(null);

    const containerId = categoryName === 'Regular Drill' ? 'regular-drills-list' : 'contemporary-drills-list';
    this.renderDrillChecklist(containerId, categoryName);

    app.notify(`${logBatch.length} completed drills logged.`, 'success');

    if (typeof app !== 'undefined') app.renderPreviousWorkoutsList();
  }

  // ── Add Drill (Coach/Officer) ──────────────────────────────
  openAddDrillModal(defaultCategory = 'Regular Drill') {
    const user = store.getCurrentUser();
    if (!user) return;

    const catSelect = document.getElementById('add-drill-category');
    if (catSelect) catSelect.value = defaultCategory;

    app.openModal('add-workout-drill-modal');
  }

  handleSaveDrill() {
    const user = store.getCurrentUser();
    if (!user) return;

    const name = document.getElementById('add-item-name').value.trim();
    const category = document.getElementById('add-drill-category').value;
    const type = document.getElementById('add-drill-type').value.trim() || 'Custom';
    const notes = document.getElementById('add-item-notes').value.trim();

    if (!name || !category || name.length > 160 || type.length > 100 || notes.length > 1000) {
      app.notify('Enter a drill name under 160 characters and shorter notes.', 'error');
      return;
    }

    store.saveCustomDrill({
      Name: name,
      Category: category,
      Type: type,
      Notes: notes,
      AddedBy: user.FullName,
      DateAdded: localDate()
    });

    app.closeModal('add-workout-drill-modal');
    document.getElementById('add-drill-form').reset();
    this.renderDrills();

    if (typeof gymModule !== 'undefined') gymModule.renderExerciseList();
    app.notify(`${name} added to your personal catalog.`, 'success');
  }
}

const drillsModule = new DrillsModule();

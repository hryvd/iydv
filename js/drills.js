/* ==========================================================================
   IYDV ONEUP - Regular & Contemporary Drills Module
   Coach/Officer can add custom drills to the catalog.
   ========================================================================== */

class DrillsModule {
  constructor() {
    this.completedDrills = { 'Regular Drill': {}, 'Contemporary Drill': {} };
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
    const canManage = isCoachOrOfficer(user);

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
            <div class="drill-checklist-card ${isCompleted ? 'drill-completed' : ''}"
                 onclick="${isCompleted ? '' : `drillsModule.confirmDrillCompletion('${categoryName}', '${drill.Name.replace(/'/g, "\\'")}')`}"
                 style="cursor:${isCompleted ? 'default' : 'pointer'}; ${isCompleted ? 'opacity:0.85;' : ''}">
              <div class="drill-checklist-label">
                <span class="drill-name">${drill.Name}${drill.IsCustom ? ' <span style="font-size:0.55rem;opacity:0.8;">★ CUSTOM</span>' : ''}</span>
                <input type="checkbox" id="${inputId}" class="drill-checkbox" data-name="${drill.Name}" data-category="${categoryName}"
                       ${isCompleted ? 'checked' : ''} onclick="event.preventDefault(); event.stopPropagation();" readonly>
                <span class="custom-checkbox-ui">${isCompleted ? '' : ''}</span>
              </div>
            </div>
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
    const confirmed = confirm(`Mark "${drillName}" as completed?`);
    if (!confirmed) return;

    if (!this.completedDrills[categoryName]) {
      this.completedDrills[categoryName] = {};
    }
    this.completedDrills[categoryName][drillName] = true;

    const containerId = categoryName === 'Regular Drill' ? 'regular-drills-list' : 'contemporary-drills-list';
    this.renderDrillChecklist(containerId, categoryName);
  }

  submitDrillBatch(categoryName) {
    const user = store.getCurrentUser();
    if (!user) return;

    const completed = this.completedDrills[categoryName] || {};
    const completedNames = Object.keys(completed);

    if (completedNames.length === 0) {
      alert('Please complete at least one drill before submitting.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const logBatch = [];

    completedNames.forEach(drillName => {
      logBatch.push({
        LogID: 'L' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7),
        Date: todayStr,
        MemberID: user.MemberID,
        Program: categoryName,
        Exercise: drillName,
        'Set #': 1,
        Reps: 15,
        'Weight (lbs)': 0,
        'RPE (1-10)': 8,
        Notes: `Completed in daily ${categoryName} checklist session`
      });

      const existingSkill = store.getSkills(user.MemberID).find(s => s.SkillName === drillName);
      if (!existingSkill) {
        store.saveSkill({
          SkillID: 'S' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7),
          MemberID: user.MemberID,
          SkillName: drillName,
          Category: categoryName,
          DateLearned: todayStr,
          ProficiencyLevel: 'Intermediate',
          Coach: 'Varsity Routine',
          Verified: true,
          Notes: `Learned during varsity ${categoryName} practice`
        });
      }
    });

    store.addWorkoutLogsBatch(logBatch);

    this.completedDrills[categoryName] = {};

    const containerId = categoryName === 'Regular Drill' ? 'regular-drills-list' : 'contemporary-drills-list';
    this.renderDrillChecklist(containerId, categoryName);

    alert(`✅ ${logBatch.length} ${categoryName}(s) submitted and recorded!`);

    if (window.app) app.renderPreviousWorkoutsList();
  }

  // ── Add Drill (Coach/Officer) ──────────────────────────────
  openAddDrillModal(defaultCategory = 'Regular Drill') {
    const user = store.getCurrentUser();
    if (!isCoachOrOfficer(user)) {
      alert('Only coaches and officers can add drills.');
      return;
    }

    const catSelect = document.getElementById('add-drill-category');
    if (catSelect) catSelect.value = defaultCategory;

    app.openModal('add-workout-drill-modal');
  }

  handleSaveDrill() {
    const user = store.getCurrentUser();
    if (!isCoachOrOfficer(user)) return;

    const name = document.getElementById('add-item-name').value.trim();
    const category = document.getElementById('add-drill-category').value;
    const type = document.getElementById('add-drill-type').value.trim() || 'Custom';
    const notes = document.getElementById('add-item-notes').value.trim();

    if (!name || !category) {
      alert('Please fill in the drill name and category.');
      return;
    }

    store.saveCustomDrill({
      Name: name,
      Category: category,
      Type: type,
      Notes: notes,
      AddedBy: user.FullName,
      DateAdded: new Date().toISOString().split('T')[0]
    });

    app.closeModal('add-workout-drill-modal');
    document.getElementById('add-drill-form').reset();
    this.renderDrills();

    alert(`✅ "${name}" added to ${category} catalog!`);
  }
}

const drillsModule = new DrillsModule();

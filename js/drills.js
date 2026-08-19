/* ==========================================================================
   IYDV ONEUP - Regular & Contemporary Drills Module
   Checkbox only fills after confirming completion, then batch submit.
   ========================================================================== */

class DrillsModule {
  constructor() {
    this.completedDrills = { 'Regular Drill': {}, 'Contemporary Drill': {} };
    this.init();
  }

  init() {
    this.renderDrills();
  }

  renderDrills() {
    this.renderDrillChecklist('regular-drills-list', 'Regular Drill');
    this.renderDrillChecklist('contemporary-drills-list', 'Contemporary Drill');
  }

  renderDrillChecklist(containerId, categoryName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const drills = store.getDrillsReference().filter(d => d.Category === categoryName);

    if (drills.length === 0) {
      container.innerHTML = `<div class="text-center" style="color:var(--text-muted); padding:16px;">No drills found.</div>`;
      return;
    }

    const completed = this.completedDrills[categoryName] || {};
    const completedCount = Object.keys(completed).length;

    container.innerHTML = `
      <form id="${categoryName.replace(/\s+/g, '-').toLowerCase()}-form">
        ${drills.map((drill, index) => {
          const inputId = `drill-chk-${categoryName.replace(/\s+/g, '')}-${index}`;
          const isCompleted = completed[drill.Name];

          return `
            <div class="drill-checklist-card ${isCompleted ? 'drill-completed' : ''}"
                 onclick="${isCompleted ? '' : `drillsModule.confirmDrillCompletion('${categoryName}', '${drill.Name.replace(/'/g, "\\'")}')`}"
                 style="cursor:${isCompleted ? 'default' : 'pointer'}; ${isCompleted ? 'opacity:0.85;' : ''}">
              <div class="drill-checklist-label">
                <span class="drill-name">${drill.Name}</span>
                <input type="checkbox" id="${inputId}" class="drill-checkbox" data-name="${drill.Name}" data-category="${categoryName}"
                       ${isCompleted ? 'checked' : ''} onclick="event.preventDefault(); event.stopPropagation();" readonly>
                <span class="custom-checkbox-ui">${isCompleted ? '' : ''}</span>
              </div>
            </div>
          `;
        }).join('')}

        <div style="margin-top: 18px; text-align: center;">
          <button type="button" class="btn btn-secondary ${completedCount === 0 ? 'btn-disabled' : ''}"
                  onclick="drillsModule.submitDrillBatch('${categoryName}')"
                  ${completedCount === 0 ? 'disabled' : ''}
                  style="background: ${completedCount > 0 ? 'var(--primary-crimson)' : '#ccc'}; padding: 14px 20px;">
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

    // Re-render to update checkbox state
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

      // Auto-add to skills if not present
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

    // Reset completed drills for this category
    this.completedDrills[categoryName] = {};

    // Re-render checklist
    const containerId = categoryName === 'Regular Drill' ? 'regular-drills-list' : 'contemporary-drills-list';
    this.renderDrillChecklist(containerId, categoryName);

    alert(`✅ ${logBatch.length} ${categoryName}(s) submitted and recorded in Sheets!`);

    if (window.app) app.renderPreviousWorkoutsList();
  }
}

const drillsModule = new DrillsModule();

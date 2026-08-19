/* ==========================================================================
   IYDV ONEUP - Regular & Contemporary Drills Module (Checklist & Batch Submit)
   ========================================================================== */

class DrillsModule {
  constructor() {
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

    container.innerHTML = `
      <form id="${categoryName.replace(/\s+/g, '-').toLowerCase()}-form">
        ${drills.map((drill, index) => {
          const inputId = `drill-chk-${categoryName.replace(/\s+/g, '')}-${index}`;
          return `
            <div class="drill-checklist-card">
              <label for="${inputId}" class="drill-checklist-label">
                <span class="drill-name">${drill.Name}</span>
                <input type="checkbox" id="${inputId}" class="drill-checkbox" data-name="${drill.Name}" data-category="${categoryName}">
                <span class="custom-checkbox-ui"></span>
              </label>
            </div>
          `;
        }).join('')}

        <div style="margin-top: 18px; text-align: center;">
          <button type="button" class="btn btn-secondary" onclick="drillsModule.submitDrillBatch('${categoryName}')" style="background: var(--primary-crimson); padding: 14px 20px;">
            <i data-lucide="check-circle"></i> SUBMIT ${categoryName.toUpperCase()}S
          </button>
        </div>
      </form>
    `;

    if (window.lucide) lucide.createIcons();
  }

  submitDrillBatch(categoryName) {
    const user = store.getCurrentUser();
    const containerId = categoryName === 'Regular Drill' ? 'regular-drills-list' : 'contemporary-drills-list';
    const checkboxes = document.querySelectorAll(`#${containerId} .drill-checkbox:checked`);

    if (checkboxes.length === 0) {
      alert('Please check at least one drill before submitting.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const logBatch = [];

    checkboxes.forEach(chk => {
      const drillName = chk.dataset.name;
      logBatch.push({
        LogID: 'L' + String(Date.now() + Math.floor(Math.random()*1000)).slice(-7),
        Date: todayStr,
        MemberID: user.MemberID,
        Program: categoryName,
        Exercise: drillName,
        SetNum: 1,
        Reps: 15,
        WeightLbs: 0,
        RPE: 8,
        Notes: `Completed in daily ${categoryName} checklist session`
      });

      // Auto-add to skills if not present
      const existingSkill = store.getSkills(user.MemberID).find(s => s.SkillName === drillName);
      if (!existingSkill) {
        store.saveSkill({
          SkillID: 'S' + String(Date.now() + Math.floor(Math.random()*1000)).slice(-7),
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

    // Uncheck boxes
    checkboxes.forEach(chk => chk.checked = false);

    alert(`✅ ${logBatch.length} ${categoryName}(s) submitted and recorded in Sheets!`);

    // Refresh homepage previous workouts if on home screen
    if (window.app) app.renderPreviousWorkoutsList();
  }
}

const drillsModule = new DrillsModule();

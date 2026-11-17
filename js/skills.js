/* ==========================================================================
   IYDV ONEUP - Skills Learned Tracker & Proficiency Management Module
   ========================================================================== */

class SkillsModule {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('skills-list-container')?.addEventListener('click', event => {
      const button = event.target.closest('[data-delete-skill]');
      if (button) this.deleteSkill(button.dataset.deleteSkill);
    });
    const saveSkillForm = document.getElementById('save-skill-form');
    if (saveSkillForm) {
      saveSkillForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveSkill();
      });
    }
  }

  deleteSkill(id) {
    const user = store.getCurrentUser();
    if (!user) return;
    const skill = store.getSkills(user.MemberID).find(item => item.SkillID === id);
    if (!skill || !confirm(`Delete the skill entry "${skill.SkillName}"?`)) return;
    store.setItem(STORAGE_KEYS.SKILLS, store.getSkills().filter(item => item.MemberID !== user.MemberID || item.SkillID !== id));
    this.renderSkills();
    app.notify('Skill entry removed.', 'success');
  }

  openAddSkillModal() {
    document.getElementById('skill-name-input').value = '';
    document.getElementById('skill-category-input').value = 'Regular Drill';
    document.getElementById('skill-level-input').value = 'Intermediate';
    document.getElementById('skill-coach-input').value = '';
    document.getElementById('skill-notes-input').value = '';

    app.openModal('add-skill-modal');
  }

  handleSaveSkill() {
    const user = store.getCurrentUser();
    const name = document.getElementById('skill-name-input').value.trim();
    const category = document.getElementById('skill-category-input').value;
    const level = document.getElementById('skill-level-input').value;
    const coach = document.getElementById('skill-coach-input').value.trim();
    const notes = document.getElementById('skill-notes-input').value.trim();

    if (!user || !name || name.length > 160 || coach.length > 160 || notes.length > 2000) {
      app.notify('Enter a skill name under 160 characters and shorter notes.', 'error');
      return;
    }

    const newSkill = {
      SkillID: 'S' + crypto.randomUUID(),
      MemberID: user.MemberID,
      SkillName: name,
      Category: category,
      DateLearned: localDate(),
      ProficiencyLevel: level,
      Coach: coach || 'Self-Reported',
      Verified: false,
      Notes: notes
    };

    store.saveSkill(newSkill);
    this.renderSkills();
    app.closeModal('add-skill-modal');
    app.notify(`Skill added: ${name}.`, 'success');
  }

  renderSkills() {
    const container = document.getElementById('skills-list-container');
    if (!container) return;

    const user = store.getCurrentUser();
    if (!user) return;
    const skills = store.getSkills(user.MemberID);

    if (skills.length === 0) {
      container.innerHTML = `
        <div class="card text-center" style="padding: 24px;">
          <div style="font-size:2.5rem; margin-bottom:8px;">🏅</div>
          <div style="font-family:var(--font-heading); font-weight:700; color:var(--primary-crimson);">Your skills start here</div>
          <p style="font-size:0.78rem; color:var(--text-muted); margin:6px 0 14px;">Keep track of techniques you are learning and the skills you have mastered. All levels are self-reported.</p>
          <button class="btn btn-primary" onclick="skillsModule.openAddSkillModal()">
            <i data-lucide="plus"></i> Add Learned Skill
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Group by Category
    const categories = ['Regular Drill', 'Contemporary Drill', 'Gym Program', 'Choreography', 'Conditioning'];
    
    container.innerHTML = categories.map(cat => {
      const catSkills = skills.filter(s => s.Category === cat);
      if (catSkills.length === 0) return '';

      return `
        <div style="margin-bottom: 16px;">
          <div style="font-family:var(--font-heading); font-weight:800; font-size:0.9rem; color:var(--primary-crimson); text-transform:uppercase; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="award" style="width:16px; height:16px;"></i> ${cat}
          </div>
          ${catSkills.map(s => {
            let levelBadge = `<span class="badge badge-warning">${escapeHTML(s.ProficiencyLevel)}</span>`;
            if (s.ProficiencyLevel === 'Mastered') levelBadge = `<span class="badge badge-success">Mastered ⭐</span>`;
            else if (s.ProficiencyLevel === 'Advanced') levelBadge = `<span class="badge badge-orange">Advanced</span>`;

            return `
              <div class="list-item" style="border-left-color: ${s.ProficiencyLevel === 'Mastered' ? 'var(--color-success)' : 'var(--accent-orange)'};">
                <div>
                  <div class="list-title">${escapeHTML(s.SkillName)}</div>
                  <div class="list-subtitle">Learned: ${escapeHTML(s.DateLearned)} • Coach: ${escapeHTML(s.Coach || 'Self-reported')}</div>
                </div>
                <div class="d-flex align-center gap-2">${levelBadge}<button type="button" class="icon-btn" data-delete-skill="${escapeHTML(s.SkillID)}" aria-label="Delete skill: ${escapeHTML(s.SkillName)}" title="Delete skill"><i data-lucide="trash-2"></i></button></div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }
}

const skillsModule = new SkillsModule();

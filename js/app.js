/* ==========================================================================
   IYDV ONEUP - Main Application Router & Event Controller
   Streamlined Apple 3-Tab Architecture
   ========================================================================== */

class App {
  constructor() {
    this.currentScreen = 'welcome-screen';
    this.activeTrainingSubtab = 'gym';
    this.activeProgressSubtab = 'goals';
    this.init();
  }

  init() {
    window.addEventListener('DOMContentLoaded', () => {
      this.bindNavigation();
      this.bindModals();
      this.refreshIcons();

      const user = store.getCurrentUser();
      if (user && user.MemberID) {
        this.switchScreen('home-screen');
        authModule.renderUserProfileCard();
      } else {
        this.switchScreen('welcome-screen');
      }
    });
  }

  bindNavigation() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.nav-item')) {
        const item = e.target.closest('.nav-item');
        const targetScreen = item.dataset.screen;

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        this.switchScreen(targetScreen);
      }

      if (e.target.closest('.action-tile')) {
        const tile = e.target.closest('.action-tile');
        const targetScreen = tile.dataset.screen;
        const subtab = tile.dataset.subtab;
        if (targetScreen) {
          this.switchScreen(targetScreen);
          if (targetScreen === 'gym-screen' && subtab) {
            this.switchTrainingSubtab(subtab);
          } else if (targetScreen === 'goals-screen' && subtab) {
            this.switchProgressSubtab(subtab);
          }
        }
      }
    });
  }

  bindModals() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
      }
      if (e.target.closest('.modal-close-btn')) {
        const overlay = e.target.closest('.modal-overlay');
        if (overlay) overlay.classList.remove('active');
      }
    });
  }

  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      this.currentScreen = screenId;
    }

    // Trigger screen-specific renders
    if (screenId === 'home-screen') {
      authModule.renderUserProfileCard();
      this.renderPreviousWorkoutsList();
    } else if (screenId === 'gym-screen') {
      if (this.activeTrainingSubtab === 'gym') {
        gymModule.renderExerciseList();
      } else {
        drillsModule.renderDrills();
      }
    } else if (screenId === 'goals-screen') {
      if (this.activeProgressSubtab === 'goals') {
        goalsModule.renderGoals();
      } else if (this.activeProgressSubtab === 'skills') {
        skillsModule.renderSkills();
      } else if (this.activeProgressSubtab === 'weight') {
        weightModule.renderWeightLogsHistory();
        weightModule.renderWeightChart();
      }
    } else if (screenId === 'dashboard-screen') {
      dashboardModule.renderTeamDashboard();
    } else if (screenId === 'jogging-screen') {
      // Jogging timer screen
    }

    this.refreshIcons();
    const appContent = document.querySelector('.app-content');
    if (appContent) appContent.scrollTop = 0;
  }

  switchTrainingSubtab(subtab) {
    this.activeTrainingSubtab = subtab;
    const gymBtn = document.getElementById('training-subtab-gym');
    const drillsBtn = document.getElementById('training-subtab-drills');
    const gymView = document.getElementById('training-gym-view');
    const drillsView = document.getElementById('training-drills-view');

    if (subtab === 'gym') {
      if (gymBtn) gymBtn.classList.add('active');
      if (drillsBtn) drillsBtn.classList.remove('active');
      if (gymView) gymView.style.display = 'block';
      if (drillsView) drillsView.style.display = 'none';
      gymModule.renderExerciseList();
    } else {
      if (drillsBtn) drillsBtn.classList.add('active');
      if (gymBtn) gymBtn.classList.remove('active');
      if (drillsView) drillsView.style.display = 'block';
      if (gymView) gymView.style.display = 'none';
      drillsModule.renderDrills();
    }
    this.refreshIcons();
  }

  switchProgressSubtab(subtab) {
    this.activeProgressSubtab = subtab;
    const goalsBtn = document.getElementById('progress-subtab-goals');
    const skillsBtn = document.getElementById('progress-subtab-skills');
    const weightBtn = document.getElementById('progress-subtab-weight');

    const goalsView = document.getElementById('progress-goals-view');
    const skillsView = document.getElementById('progress-skills-view');
    const weightView = document.getElementById('progress-weight-view');

    [goalsBtn, skillsBtn, weightBtn].forEach(btn => btn && btn.classList.remove('active'));
    [goalsView, skillsView, weightView].forEach(view => view && (view.style.display = 'none'));

    if (subtab === 'goals') {
      if (goalsBtn) goalsBtn.classList.add('active');
      if (goalsView) goalsView.style.display = 'block';
      goalsModule.renderGoals();
    } else if (subtab === 'skills') {
      if (skillsBtn) skillsBtn.classList.add('active');
      if (skillsView) skillsView.style.display = 'block';
      skillsModule.renderSkills();
    } else if (subtab === 'weight') {
      if (weightBtn) weightBtn.classList.add('active');
      if (weightView) weightView.style.display = 'block';
      weightModule.renderWeightLogsHistory();
      weightModule.renderWeightChart();
    }
    this.refreshIcons();
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      this.refreshIcons();
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  refreshIcons() {
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  renderPreviousWorkoutsList() {
    const container = document.getElementById('previous-workouts-container');
    if (!container) return;

    const user = store.getCurrentUser();
    if (!user) {
      container.innerHTML = `<div class="text-center" style="font-size:0.75rem; color:var(--text-tertiary); padding:10px;">Sign in to view your workout history.</div>`;
      return;
    }

    const logs = store.getWorkoutLogs(user.MemberID);

    const grouped = {};
    logs.forEach(l => {
      if (!grouped[l.Date]) grouped[l.Date] = [];
      grouped[l.Date].push(l);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).slice(0, 4);

    if (dates.length === 0) {
      container.innerHTML = `<div class="text-center" style="font-size:0.75rem; color:var(--text-tertiary); padding:10px;">No previous workout sessions found.</div>`;
      return;
    }

    container.innerHTML = dates.map(date => {
      const sessionLogs = grouped[date];
      const programName = sessionLogs[0].Program || 'GYM';
      const exercisesCount = new Set(sessionLogs.map(s => s.Exercise)).size;

      return `
        <div class="list-item" onclick="app.viewWorkoutDetails('${date}')" style="cursor:pointer; border-left-color:var(--orange);">
          <div>
            <div class="list-title" style="color:var(--orange); font-weight:800; font-size:0.82rem;">
              ${date === new Date().toISOString().split('T')[0] ? 'TODAY' : date} [ ${programName.toUpperCase()} ]
            </div>
            <div class="list-subtitle">${exercisesCount} exercise(s) logged • ${sessionLogs.length} total set(s)</div>
          </div>
          <i data-lucide="chevron-right" style="width:16px; height:16px; color:var(--text-tertiary);"></i>
        </div>
      `;
    }).join('');

    this.refreshIcons();
  }

  viewWorkoutDetails(dateStr) {
    const user = store.getCurrentUser();
    if (!user) return;

    const logs = store.getWorkoutLogs(user.MemberID).filter(l => l.Date === dateStr);

    const detailContainer = document.getElementById('workout-detail-content');
    if (detailContainer) {
      detailContainer.innerHTML = `
        <div style="font-weight:800; color:var(--orange); margin-bottom:8px;">Session Date: ${dateStr}</div>
        ${logs.map(l => `
          <div style="background:var(--surface); border-left:3px solid var(--orange); padding:8px 12px; border-radius:8px; margin-bottom:6px; font-size:0.78rem;">
            <strong>${l.Exercise}</strong> (Program: ${l.Program})<br>
            ${l['Set #'] ? `Set ${l['Set #']}: ` : ''}${l.Reps} reps @ ${l['Weight (lbs)'] || l.WeightLbs || 0} lbs ${l['RPE (1-10)'] || l.RPE ? `(RPE ${l['RPE (1-10)'] || l.RPE})` : ''}
            ${l.Notes ? `<br><small style="color:var(--text-tertiary);">${l.Notes}</small>` : ''}
          </div>
        `).join('')}
      `;
    }

    this.openModal('view-workout-modal');
  }
}

const app = new App();

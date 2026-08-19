/* ==========================================================================
   IYDV ONEUP - Main Application Router & Event Controller
   ========================================================================== */

class App {
  constructor() {
    this.currentScreen = 'home-screen';
    this.init();
  }

  init() {
    window.addEventListener('DOMContentLoaded', () => {
      this.bindNavigation();
      this.bindModals();
      this.refreshIcons();

      // Check if user is logged in
      const user = store.getCurrentUser();
      if (user) {
        this.switchScreen('home-screen');
        authModule.renderUserProfileCard();
      } else {
        this.switchScreen('welcome-screen');
      }
    });
  }

  bindNavigation() {
    document.addEventListener('click', (e) => {
      // Bottom Nav Items
      if (e.target.closest('.nav-item')) {
        const item = e.target.closest('.nav-item');
        const targetScreen = item.dataset.screen;
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        this.switchScreen(targetScreen);
      }

      // Action Tiles Navigation
      if (e.target.closest('.action-tile')) {
        const tile = e.target.closest('.action-tile');
        const targetScreen = tile.dataset.screen;
        if (targetScreen) {
          this.switchScreen(targetScreen);
        }
      }
    });
  }

  bindModals() {
    // Modal Overlay click to close
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

    // Trigger Screen Specific Renders
    if (screenId === 'home-screen') {
      authModule.renderUserProfileCard();
      this.renderPreviousWorkoutsList();
    } else if (screenId === 'gym-screen') {
      gymModule.renderExerciseList();
    } else if (screenId === 'weight-screen') {
      weightModule.renderWeightLogsHistory();
      weightModule.renderWeightChart();
    } else if (screenId === 'goals-screen') {
      goalsModule.renderGoals();
    } else if (screenId === 'skills-screen') {
      skillsModule.renderSkills();
    } else if (screenId === 'dashboard-screen') {
      dashboardModule.renderTeamDashboard();
    }

    this.refreshIcons();
    const appContent = document.querySelector('.app-content');
    if (appContent) appContent.scrollTop = 0;
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

  // Tappable Previous Workouts List (Audit 2.2 #2 Fix)
  renderPreviousWorkoutsList() {
    const container = document.getElementById('previous-workouts-container');
    if (!container) return;

    const user = store.getCurrentUser();
    const logs = store.getWorkoutLogs(user.MemberID);

    // Group logs by Date
    const grouped = {};
    logs.forEach(l => {
      if (!grouped[l.Date]) grouped[l.Date] = [];
      grouped[l.Date].push(l);
    });

    const dates = Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a)).slice(0, 4);

    if (dates.length === 0) {
      container.innerHTML = `<div class="text-center" style="font-size:0.75rem; color:var(--text-muted); padding:10px;">No previous workout sessions found.</div>`;
      return;
    }

    container.innerHTML = dates.map(date => {
      const sessionLogs = grouped[date];
      const programName = sessionLogs[0].Program || 'GYM';
      const exercisesCount = new Set(sessionLogs.map(s => s.Exercise)).size;

      return `
        <div class="list-item" onclick="app.viewWorkoutDetails('${date}')" style="cursor:pointer; border-left-color:var(--primary-crimson);">
          <div>
            <div class="list-title" style="color:var(--accent-orange-hover); font-weight:800; font-size:0.82rem;">
              ${date === new Date().toISOString().split('T')[0] ? 'TODAY' : date} [ ${programName.toUpperCase()} ]
            </div>
            <div class="list-subtitle">${exercisesCount} exercise(s) logged • ${sessionLogs.length} total set(s)</div>
          </div>
          <i data-lucide="chevron-right" style="width:16px; height:16px; color:var(--text-muted);"></i>
        </div>
      `;
    }).join('');

    this.refreshIcons();
  }

  viewWorkoutDetails(dateStr) {
    const user = store.getCurrentUser();
    const logs = store.getWorkoutLogs(user.MemberID).filter(l => l.Date === dateStr);

    const detailContainer = document.getElementById('workout-detail-content');
    if (detailContainer) {
      detailContainer.innerHTML = `
        <div style="font-weight:800; color:var(--primary-crimson); margin-bottom:8px;">Session Date: ${dateStr}</div>
        ${logs.map(l => `
          <div style="background:#f8f9fa; border-left:3px solid var(--accent-orange); padding:8px; border-radius:6px; margin-bottom:6px; font-size:0.78rem;">
            <strong>${l.Exercise}</strong> (Program: ${l.Program})<br>
            ${l.SetNum ? `Set ${l.SetNum}: ` : ''}${l.Reps} reps @ ${l.WeightLbs} lbs ${l.RPE ? `(RPE ${l.RPE})` : ''}
            ${l.Notes ? `<br><small style="color:var(--text-muted);">${l.Notes}</small>` : ''}
          </div>
        `).join('')}
      `;
    }

    this.openModal('view-workout-modal');
  }
}

const app = new App();

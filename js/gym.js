/* ==========================================================================
   IYDV ONEUP - Gym Workouts Module (Checklist Format & Batch Submit)
   ========================================================================== */

class GymModule {
  constructor() {
    this.currentProgram = 'Push';
    this.restTimerInterval = null;
    this.restTimeRemaining = 60;
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.program-select-btn')) {
        const btn = e.target.closest('.program-select-btn');
        document.querySelectorAll('.program-select-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
        document.querySelectorAll('.program-select-btn').forEach(b => b.classList.add('btn-outline'));
        
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-outline');
        
        this.currentProgram = btn.dataset.program;
        this.renderExerciseList();
      }
    });

    const startTimerBtn = document.getElementById('start-rest-timer-btn');
    if (startTimerBtn) {
      startTimerBtn.addEventListener('click', () => this.startRestTimer(60));
    }
  }

  renderExerciseList() {
    const listContainer = document.getElementById('gym-exercise-list');
    if (!listContainer) return;

    let drills = store.getDrillsReference();
    let filtered = drills.filter(d => d.Category.toLowerCase().includes(this.currentProgram.toLowerCase()));
    
    if (filtered.length === 0) {
      filtered = drills.filter(d => d.Category.includes('Gym'));
    }

    listContainer.innerHTML = `
      <form id="gym-batch-form">
        <div style="font-weight:700; font-size:0.85rem; color:var(--primary-crimson); margin-bottom:10px;">
          Check off completed exercises for <u>${this.currentProgram}</u> routine:
        </div>

        ${filtered.map((item, index) => {
          const chkId = `gym-chk-${index}`;
          return `
            <div class="card mb-2" style="border-left: 4px solid var(--accent-orange);">
              <label for="${chkId}" class="d-flex justify-between align-center" style="cursor:pointer; width:100%;">
                <div>
                  <div style="font-family:var(--font-heading); font-weight:800; font-size:0.98rem; color:var(--text-main);">${item.Name}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${item.Type} • Program: ${this.currentProgram}</div>
                </div>
                <input type="checkbox" id="${chkId}" class="gym-checkbox" data-name="${item.Name}" style="width:20px; height:20px; accent-color:var(--accent-orange); cursor:pointer;">
              </label>

              <div class="mt-2" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Reps</label>
                  <input type="number" id="reps-${index}" class="form-control form-control-sm" placeholder="10" value="10" min="1">
                </div>
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Weight (lbs)</label>
                  <input type="number" id="weight-${index}" class="form-control form-control-sm" placeholder="95" value="95" min="0">
                </div>
              </div>
            </div>
          `;
        }).join('')}

        <div style="margin-top:16px; text-align:center;">
          <button type="button" class="btn btn-secondary" onclick="gymModule.submitGymWorkoutBatch()" style="background:var(--primary-crimson); padding:14px;">
            <i data-lucide="check-circle"></i> SUBMIT ${this.currentProgram.toUpperCase()} WORKOUT
          </button>
        </div>
      </form>
    `;

    if (window.lucide) lucide.createIcons();
  }

  submitGymWorkoutBatch() {
    const user = store.getCurrentUser();
    const checkedItems = document.querySelectorAll('.gym-checkbox:checked');

    if (checkedItems.length === 0) {
      alert('Please check at least one exercise to submit.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const batchLogs = [];

    checkedItems.forEach((chk) => {
      const idx = chk.id.split('-')[2];
      const exerciseName = chk.dataset.name;
      const reps = parseInt(document.getElementById(`reps-${idx}`).value) || 10;
      const weight = parseFloat(document.getElementById(`weight-${idx}`).value) || 0;

      batchLogs.push({
        LogID: 'L' + String(Date.now() + Math.floor(Math.random()*1000)).slice(-7),
        Date: todayStr,
        MemberID: user.MemberID,
        Program: this.currentProgram,
        Exercise: exerciseName,
        SetNum: 1,
        Reps: reps,
        WeightLbs: weight,
        RPE: 8,
        Notes: `Logged via ${this.currentProgram} workout checklist`
      });
    });

    store.addWorkoutLogsBatch(batchLogs);

    alert(`🎉 WORKOUT SUBMITTED! ${batchLogs.length} exercise(s) logged and synced to Google Sheets.`);

    // Trigger Rest Timer
    this.showRestTimerModal(60);

    // Refresh Exercise List
    this.renderExerciseList();
  }

  showRestTimerModal(defaultSeconds = 60) {
    app.openModal('rest-timer-modal');
    this.startRestTimer(defaultSeconds);
  }

  startRestTimer(seconds) {
    clearInterval(this.restTimerInterval);
    this.restTimeRemaining = seconds;
    const timerDisplay = document.getElementById('rest-timer-countdown');
    
    const updateDisplay = () => {
      const mins = Math.floor(this.restTimeRemaining / 60);
      const secs = this.restTimeRemaining % 60;
      if (timerDisplay) {
        timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    };

    updateDisplay();

    this.restTimerInterval = setInterval(() => {
      this.restTimeRemaining--;
      updateDisplay();

      if (this.restTimeRemaining <= 0) {
        clearInterval(this.restTimerInterval);
        this.playBeepSound();
        if (timerDisplay) timerDisplay.textContent = "00:00 - READY!";
      }
    }, 1000);
  }

  stopRestTimer() {
    clearInterval(this.restTimerInterval);
    app.closeModal('rest-timer-modal');
  }

  playBeepSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio playback not supported:', e);
    }
  }
}

const gymModule = new GymModule();

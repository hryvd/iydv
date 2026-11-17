/* ==========================================================================
   IYDV ONEUP - Gym Workouts Module
   Tap Exercise → Log Sets → Rest Timer → Auto-Fill Checkbox → Submit
   ========================================================================== */

class GymModule {
  constructor() {
    this.currentProgram = 'Push';
    this.restTimerInterval = null;
    this.restTimeRemaining = 60;

    // Active workout session state
    this.activeExercise = null;       // { name, index }
    this.activeSetNumber = 1;
    this.activeTotalSets = 3;
    this.activeSetLogs = [];          // [{reps, weight, rpe}]
    this.completedExercises = Object.create(null);     // { exerciseName: [setLogs] }

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      const exerciseButton = e.target.closest('[data-exercise-index]');
      if (exerciseButton) {
        const index = Number(exerciseButton.dataset.exerciseIndex);
        const exercise = this.visibleExercises?.[index];
        if (exercise && !this.completedExercises[exercise.Name]) this.startExerciseSession(exercise.Name, index);
      }
      if (e.target.closest('.program-select-btn')) {
        const btn = e.target.closest('.program-select-btn');
        if (btn.dataset.program === this.currentProgram) return;
        document.querySelectorAll('.program-select-btn').forEach(b => {
          b.classList.remove('active', 'btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-outline');

        if (Object.keys(this.completedExercises).length && !confirm('Discard the unsubmitted exercises and change program?')) {
          document.querySelectorAll('.program-select-btn').forEach(b => { b.classList.toggle('active', b.dataset.program === this.currentProgram); b.classList.toggle('btn-primary', b.dataset.program === this.currentProgram); b.classList.toggle('btn-outline', b.dataset.program !== this.currentProgram); });
          return;
        }
        this.currentProgram = btn.dataset.program;
        this.completedExercises = Object.create(null);
        this.renderExerciseList();
      }
    });
  }

  renderExerciseList() {
    const listContainer = document.getElementById('gym-exercise-list');
    if (!listContainer) return;

    const user = store.getCurrentUser();
    const canManage = Boolean(user);

    let drills = store.getDrillsReference();
    let filtered = drills.filter(d => d.Category.toLowerCase().includes(this.currentProgram.toLowerCase()));
    if (filtered.length === 0) {
      filtered = drills.filter(d => d.Category.includes('Gym'));
    }

    this.visibleExercises = filtered;
    const completedCount = Object.keys(this.completedExercises).length;

    listContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:0.75rem; color:var(--text-tertiary);">Tap exercise to log sets:</span>
        ${canManage ? `
          <button class="admin-add-btn" onclick="gymModule.openAddWorkoutModal()">
            <i data-lucide="plus" style="width:13px;height:13px;"></i> ADD WORKOUT
          </button>
        ` : ''}
      </div>

      ${filtered.map((item, index) => {
        const isCompleted = this.completedExercises[item.Name];
        const setsInfo = isCompleted
          ? isCompleted.map((s, i) => `Set ${i + 1}: ${s.reps} reps @ ${s.weight} lbs`).join(' • ')
          : 'Tap to start';

        return `
          <button type="button" data-exercise-index="${index}" class="card mb-2 gym-exercise-card ${isCompleted ? 'exercise-completed' : ''}" ${isCompleted ? 'disabled' : ''}
               style="width:100%;text-align:left;border-left:4px solid ${isCompleted ? 'var(--green)' : 'var(--orange)'};cursor:${isCompleted ? 'default' : 'pointer'};">
            <div class="d-flex justify-between align-center">
              <div style="flex:1;">
                <div style="font-family:var(--font-display); font-weight:800; font-size:0.95rem; color:${isCompleted ? 'var(--green)' : 'var(--text-primary)'};">                  ${isCompleted ? '✓ ' : ''}${escapeHTML(item.Name)}${item.IsCustom ? ' <span style="font-size:0.55rem;opacity:0.7;">★ CUSTOM</span>' : ''}
                </div>
                <div style="font-size:0.7rem; color:var(--text-tertiary);">
                  ${isCompleted ? setsInfo : `${escapeHTML(item.Type)} • ${escapeHTML(this.currentProgram)}`}
                </div>
              </div>
              <div class="gym-exercise-checkbox ${isCompleted ? 'checked' : 'locked'}">
                ${isCompleted ? '✓' : '+'}
              </div>
            </div>
          </button>
        `;
      }).join('')}

      <div style="margin-top:16px;">
        <button type="button" class="btn btn-crimson ${completedCount === 0 ? 'btn-disabled' : ''}"
                onclick="gymModule.submitGymWorkoutBatch()"
                ${completedCount === 0 ? 'disabled' : ''}>
          <i data-lucide="check-circle"></i> SUBMIT ${this.currentProgram.toUpperCase()} WORKOUT (${completedCount} exercise${completedCount !== 1 ? 's' : ''})
        </button>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  openAddWorkoutModal() {
    const user = store.getCurrentUser();
    if (!user) return;
    // Pre-select gym category
    const catSelect = document.getElementById('add-drill-category');
    if (catSelect) catSelect.value = `Gym - ${this.currentProgram}`;
    app.openModal('add-workout-drill-modal');
  }

  // ── Start Active Workout Session for an Exercise ────────
  startExerciseSession(exerciseName, index) {
    if (!store.getCurrentUser()) return;
    clearInterval(this.restTimerInterval);
    this.activeExercise = { name: exerciseName, index };
    this.activeSetNumber = 1;
    this.activeTotalSets = 3;
    this.activeSetLogs = [];

    this.renderActiveWorkoutView();
    app.openModal('active-workout-modal');
  }

  renderActiveWorkoutView() {
    const container = document.getElementById('active-workout-content');
    if (!container) return;

    const setDots = Array.from({ length: this.activeTotalSets }, (_, i) => {
      if (i < this.activeSetNumber - 1) return `<span class="set-dot completed">✓</span>`;
      if (i === this.activeSetNumber - 1) return `<span class="set-dot active">${i + 1}</span>`;
      return `<span class="set-dot">${i + 1}</span>`;
    }).join('');

    container.innerHTML = `
      <div class="text-center mb-3">
        <div style="font-family:var(--font-display); font-weight:900; font-size:1.3rem; color:var(--crimson); text-transform:uppercase;">
          ${escapeHTML(this.activeExercise.name)}
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">
          ${this.currentProgram} Program
        </div>
      </div>

      <div class="set-dots-row mb-3">
        ${setDots}
      </div>

      <div class="active-set-card">
        <div style="font-family:var(--font-display); font-weight:800; font-size:1.1rem; color:var(--orange); margin-bottom:12px;">
          SET ${this.activeSetNumber} of ${this.activeTotalSets}
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="mb-3">
          <div>
            <label class="form-label">Reps</label>
            <input type="number" id="active-reps-input" class="form-control" placeholder="10" min="1" value="10">
          </div>
          <div>
            <label class="form-label">Weight (lbs)</label>
            <input type="number" id="active-weight-input" class="form-control" placeholder="95" min="0" value="0">
          </div>
        </div>

        <button class="btn btn-primary mb-2" onclick="gymModule.logCurrentSet()">
          <i data-lucide="check"></i> LOG SET ${this.activeSetNumber}
        </button>
      </div>

      ${this.activeSetLogs.length > 0 ? `
        <div class="mb-3" style="margin-top:12px;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Completed Sets:</div>
          ${this.activeSetLogs.map((s, i) => `
            <div style="font-size:0.75rem; background:rgba(48,209,88,0.08); border-left:3px solid var(--green); padding:6px 10px; border-radius:6px; margin-bottom:4px;">
              <strong>Set ${i + 1}:</strong> ${s.reps} reps @ ${s.weight} lbs
            </div>
          `).join('')}
        </div>
      ` : ''}

      <button class="btn btn-outline" onclick="gymModule.endExerciseSession()" style="margin-top:8px;">
        ${this.activeSetNumber > 1 ? '✅ END EXERCISE' : '✕ CANCEL'}
      </button>
    `;

    if (window.lucide) lucide.createIcons();
  }

  logCurrentSet() {
    if (!this.activeExercise) return;
    const reps = Number(document.getElementById('active-reps-input').value);
    const weight = Number(document.getElementById('active-weight-input').value);

    if (!Number.isInteger(reps) || reps < 1 || reps > 1000 || !Number.isFinite(weight) || weight < 0 || weight > 2000) {
      app.notify('Enter 1–1,000 reps and a weight between 0 and 2,000 lbs.', 'error');
      return;
    }

    this.activeSetLogs.push({ reps, weight, rpe: 0 });

    if (this.activeSetNumber >= this.activeTotalSets) {
      // All sets completed — finish exercise
      this.finishExercise();
    } else {
      // More sets — show rest timer
      this.activeSetNumber++;
      this.showRestTimerBetweenSets();
    }
  }

  showRestTimerBetweenSets() {
    // Show the rest timer inline in the active workout modal
    const container = document.getElementById('active-workout-content');
    if (!container) return;

    container.innerHTML = `
      <div class="text-center">
        <div style="font-family:var(--font-display); font-weight:800; font-size:1.1rem; color:var(--crimson); margin-bottom:16px;">
          REST TIME
        </div>
        <div id="inline-rest-countdown" style="font-family:var(--font-display); font-size:3.5rem; font-weight:900; color:var(--orange);">
          01:00
        </div>
        <p style="font-size:0.78rem; color:var(--text-secondary); margin:10px 0 16px;">
          Catch your breath before Set ${this.activeSetNumber}
        </p>

        <div class="d-flex gap-2 justify-between mb-3">
          <button class="btn btn-sm btn-outline" onclick="gymModule.setInlineRestTimer(30)">30s</button>
          <button class="btn btn-sm btn-outline" onclick="gymModule.setInlineRestTimer(60)">60s</button>
          <button class="btn btn-sm btn-outline" onclick="gymModule.setInlineRestTimer(90)">90s</button>
          <button class="btn btn-sm btn-outline" onclick="gymModule.setInlineRestTimer(120)">120s</button>
        </div>

        <button class="btn btn-primary" onclick="gymModule.skipRest()">
          SKIP REST → SET ${this.activeSetNumber}
        </button>
      </div>
    `;

    this.startInlineRestTimer(60);
  }

  startInlineRestTimer(seconds) {
    clearInterval(this.restTimerInterval);
    this.restTimeRemaining = seconds;
    const restEndsAt = Date.now() + seconds * 1000;
    const display = document.getElementById('inline-rest-countdown');

    const update = () => {
      const mins = Math.floor(this.restTimeRemaining / 60);
      const secs = this.restTimeRemaining % 60;
      if (display) display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    update();

    this.restTimerInterval = setInterval(() => {
      this.restTimeRemaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      update();

      if (this.restTimeRemaining <= 0) {
        clearInterval(this.restTimerInterval);
        this.playBeepSound();
        // Auto-advance to next set
        this.renderActiveWorkoutView();
      }
    }, 1000);
  }

  setInlineRestTimer(seconds) {
    this.startInlineRestTimer(seconds);
  }

  skipRest() {
    clearInterval(this.restTimerInterval);
    this.renderActiveWorkoutView();
  }

  finishExercise() {
    clearInterval(this.restTimerInterval);

    // Mark exercise as completed with all set logs
    this.completedExercises[this.activeExercise.name] = [...this.activeSetLogs];

    app.closeModal('active-workout-modal');

    // Refresh the exercise list to show the filled checkbox
    this.renderExerciseList();

    app.notify(`${this.activeExercise.name}: ${this.activeSetLogs.length} sets ready. Submit your workout to save them.`, 'success');

    this.activeExercise = null;
    this.activeSetLogs = [];
  }

  endExerciseSession() {
    clearInterval(this.restTimerInterval);

    if (this.activeSetLogs.length > 0) {
      // Has at least one set — save what's done
      this.completedExercises[this.activeExercise.name] = [...this.activeSetLogs];
    }

    app.closeModal('active-workout-modal');
    this.renderExerciseList();

    this.activeExercise = null;
    this.activeSetLogs = [];
  }

  submitGymWorkoutBatch() {
    const user = store.getCurrentUser();
    if (!user) return;

    const completedNames = Object.keys(this.completedExercises);
    if (completedNames.length === 0) {
      app.notify('Complete at least one exercise before submitting.', 'error');
      return;
    }

    const todayStr = localDate();
    const batchLogs = [];

    completedNames.forEach(exerciseName => {
      const sets = this.completedExercises[exerciseName];
      sets.forEach((s, i) => {
        batchLogs.push({
          LogID: 'L' + crypto.randomUUID(),
          Date: todayStr,
          MemberID: user.MemberID,
          Program: this.currentProgram,
          Exercise: exerciseName,
          SetNum: i + 1,
          Reps: s.reps,
          WeightLbs: s.weight,
          RPE: s.rpe || 0,
          Notes: `Completed in ${this.currentProgram} workout session`
        });
      });
    });

    store.addWorkoutLogsBatch(batchLogs);

    app.notify(`${completedNames.length} exercises and ${batchLogs.length} sets logged.`, 'success');

    this.completedExercises = Object.create(null);
    this.renderExerciseList();

    if (typeof app !== 'undefined') app.renderPreviousWorkoutsList();
  }

  // ── Legacy Rest Timer Modal (for other uses) ────────────
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
    if (!window.AudioContext && !window.webkitAudioContext) return;
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
      osc.onended = () => ctx.close();
    } catch (e) {
      console.log('Audio playback not supported:', e);
    }
  }
}

const gymModule = new GymModule();

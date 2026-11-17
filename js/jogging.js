/* ==========================================================================
   IYDV ONEUP - Jogging Interval Timer (Jog -> Sprint -> Walk Protocol)
   ========================================================================== */

class JoggingModule {
  constructor() {
    this.timerInterval = null;
    this.totalSeconds = 11 * 60; // Default 11 min
    this.elapsedSeconds = 0;
    this.elapsedMilliseconds = 0;
    this.currentPhaseIndex = 0;
    this.phaseTimeRemaining = 0;
    this.isRunning = false;

    this.init();
  }

  init() {
    this.bindEvents();
    this.setDuration(11);
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.preset-duration-btn')) {
        const btn = e.target.closest('.preset-duration-btn');
        if (this.elapsedSeconds > 0 && !confirm('Reset the current interval session and change its duration?')) return;
        document.querySelectorAll('.preset-duration-btn').forEach(b => b.classList.remove('btn-primary'));
        document.querySelectorAll('.preset-duration-btn').forEach(b => b.classList.add('btn-outline'));
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');

        const mins = parseInt(btn.dataset.mins);
        this.setDuration(mins);
      }
    });

    const startBtn = document.getElementById('jog-start-btn');
    const pauseBtn = document.getElementById('jog-pause-btn');
    const resetBtn = document.getElementById('jog-reset-btn');

    if (startBtn) startBtn.addEventListener('click', () => this.startTimer());
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseTimer());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetTimer());
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.isRunning) this.tick(); });
  }

  setDuration(mins) {
    this.resetTimer();
    this.totalSeconds = mins * 60;

    // Requirement:
    // For 10 min: 8:30 Jog -> 0:30 Sprint -> 1:00 Walk (Total 10:00)
    // For 15 min: 13:30 Jog -> 0:30 Sprint -> 1:00 Walk (Total 15:00)
    // For 20 min: 18:30 Jog -> 0:30 Sprint -> 1:00 Walk (Total 20:00)
    const jogSeconds = (mins * 60) - 90; // minus 30s sprint and 60s walk
    
    this.phases = [
      { name: 'JOG', duration: jogSeconds, color: '#ff6b35', bg: 'rgba(255, 107, 53, 0.15)' },
      { name: 'SPRINT', duration: 30, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
      { name: 'COOL WALK', duration: 60, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
    ];

    this.currentPhaseIndex = 0;
    this.phaseTimeRemaining = this.phases[0].duration;
    this.updateDisplay();
  }

  startTimer() {
    if (this.isRunning) return;
    const user = store.getCurrentUser();
    if (!user) return;
    if (this.sessionMemberID && this.sessionMemberID !== user.MemberID) this.resetTimer();
    this.sessionMemberID = user.MemberID;
    this.startedAt = Date.now();
    this.isRunning = true;
    document.getElementById('jog-start-btn').style.display = 'none';
    document.getElementById('jog-pause-btn').style.display = 'inline-flex';
    this.playSoundCue(600, 0.2);
    this.timerInterval = setInterval(() => this.tick(), 250);
  }

  tick() {
    this.elapsedSeconds = Math.min(this.totalSeconds, Math.floor((this.elapsedMilliseconds + Date.now() - this.startedAt) / 1000));
    const previousPhase = this.currentPhaseIndex;
    let remaining = this.elapsedSeconds;
    this.currentPhaseIndex = 0;
    for (let index = 0; index < this.phases.length; index++) {
      this.currentPhaseIndex = index;
      this.phaseTimeRemaining = Math.max(0, this.phases[index].duration - remaining);
      if (remaining < this.phases[index].duration) break;
      remaining -= this.phases[index].duration;
    }
    if (this.elapsedSeconds >= this.totalSeconds) return this.completeSession();
    if (previousPhase !== this.currentPhaseIndex) this.playSoundCue(this.currentPhaseIndex === 1 ? 880 : 523, 0.4);
    this.updateDisplay();
  }

  pauseTimer() {
    if (this.isRunning) this.elapsedMilliseconds = Math.min(this.totalSeconds * 1000, this.elapsedMilliseconds + Date.now() - this.startedAt);
    this.isRunning = false;
    clearInterval(this.timerInterval);
    const startBtn = document.getElementById('jog-start-btn');
    const pauseBtn = document.getElementById('jog-pause-btn');
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (pauseBtn) pauseBtn.style.display = 'none';
  }

  resetTimer() {
    this.pauseTimer();
    this.elapsedSeconds = 0;
    this.elapsedMilliseconds = 0;
    this.sessionMemberID = null;
    this.currentPhaseIndex = 0;
    if (this.phases && this.phases[0]) {
      this.phaseTimeRemaining = this.phases[0].duration;
    }
    this.updateDisplay();
  }

  updateDisplay() {
    if (!this.phases) return;
    const currentPhase = this.phases[this.currentPhaseIndex];
    const phaseLabelEl = document.getElementById('jog-phase-label');
    const phaseTimeEl = document.getElementById('jog-phase-time');
    const totalRemainingEl = document.getElementById('jog-total-remaining');
    const timerCircleEl = document.getElementById('jog-timer-circle');

    if (phaseLabelEl) {
      phaseLabelEl.textContent = currentPhase.name;
      phaseLabelEl.style.color = currentPhase.color;
    }

    if (phaseTimeEl) {
      const pMins = Math.floor(this.phaseTimeRemaining / 60);
      const pSecs = this.phaseTimeRemaining % 60;
      phaseTimeEl.textContent = `${String(pMins).padStart(2, '0')}:${String(pSecs).padStart(2, '0')}`;
    }

    if (timerCircleEl) {
      timerCircleEl.style.borderColor = currentPhase.color;
      timerCircleEl.style.background = `radial-gradient(circle, rgba(20, 20, 22, 0.95) 0%, ${currentPhase.bg} 100%)`;
    }

    if (totalRemainingEl) {
      const remaining = Math.max(0, this.totalSeconds - this.elapsedSeconds);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      totalRemainingEl.textContent = `Total Session Time: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  completeSession() {
    this.pauseTimer();
    this.playSoundCue(1046, 0.8);
    
    const user = store.getCurrentUser();
    if (!user || user.MemberID !== this.sessionMemberID) return this.resetTimer();
    const durationMins = Math.round(this.totalSeconds / 60);

    const log = {
      LogID: 'L' + crypto.randomUUID(),
      Date: localDate(),
      MemberID: user.MemberID,
      Program: 'Jogging',
      Exercise: `Jog (${durationMins-1.5}m) -> Sprint (30s) -> Walk (1m)`,
      SetNum: 1,
      Reps: 1,
      WeightLbs: 0,
      RPE: 0,
      Notes: `Completed full ${durationMins} minute interval jogging session!`
    };

    store.addWorkoutLog(log);

    app.notify(`${durationMins}-minute interval session completed and logged. Great work!`, 'success');
    app.renderPreviousWorkoutsList();
    this.resetTimer();
  }

  playSoundCue(freq, duration = 0.3) {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      osc.onended = () => ctx.close();
    } catch (e) {
      console.log('Sound cue skipped:', e);
    }
  }
}

const joggingModule = new JoggingModule();

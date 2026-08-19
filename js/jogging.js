/* ==========================================================================
   IYDV ONEUP - Jogging Interval Timer (Jog -> Sprint -> Walk Protocol)
   ========================================================================== */

class JoggingModule {
  constructor() {
    this.timerInterval = null;
    this.totalSeconds = 11 * 60; // Default 11 min
    this.elapsedSeconds = 0;
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
    this.isRunning = true;
    
    document.getElementById('jog-start-btn').style.display = 'none';
    document.getElementById('jog-pause-btn').style.display = 'inline-flex';

    this.playSoundCue(600, 0.2);

    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      this.phaseTimeRemaining--;

      if (this.phaseTimeRemaining <= 0) {
        if (this.currentPhaseIndex < this.phases.length - 1) {
          this.currentPhaseIndex++;
          this.phaseTimeRemaining = this.phases[this.currentPhaseIndex].duration;
          
          // Sound cue on transition
          const freq = this.phases[this.currentPhaseIndex].name === 'SPRINT' ? 880 : 523;
          this.playSoundCue(freq, 0.4);
        }
      }

      if (this.elapsedSeconds >= this.totalSeconds) {
        this.completeSession();
      } else {
        this.updateDisplay();
      }
    }, 1000);
  }

  pauseTimer() {
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
    const durationMins = Math.round(this.totalSeconds / 60);

    const log = {
      LogID: 'L' + String(Date.now()).slice(-6),
      Date: new Date().toISOString().split('T')[0],
      MemberID: user.MemberID,
      Program: 'Jogging',
      Exercise: `Jog (${durationMins-1.5}m) -> Sprint (30s) -> Walk (1m)`,
      SetNum: 1,
      Reps: 1,
      WeightLbs: 0,
      RPE: 8.5,
      Notes: `Completed full ${durationMins} minute interval jogging session!`
    };

    store.addWorkoutLog(log);

    alert(`🏆 GREAT JOB! You completed the ${durationMins}-minute Jogging Protocol! Session saved to your workout logs.`);
    this.resetTimer();
  }

  playSoundCue(freq, duration = 0.3) {
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
    } catch (e) {
      console.log('Sound cue skipped:', e);
    }
  }
}

const joggingModule = new JoggingModule();

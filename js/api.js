/* Account-scoped training data; private records stay on the authenticated server. */
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const STORAGE_KEYS = {
  CURRENT_USER: 'iydv_current_user',
  MEMBERS: 'iydv_members',
  WORKOUT_LOGS: 'iydv_workout_logs',
  WEIGHT_LOGS: 'iydv_weight_logs',
  GOALS: 'iydv_goals',
  SKILLS: 'iydv_skills',
  DRILLS_REF: 'iydv_drills_ref',
  CUSTOM_DRILLS: 'iydv_custom_drills',
  ATTENDANCE: 'iydv_attendance',
  TRAINING_SCHEDULES: 'iydv_training_schedules',
  APPS_SCRIPT_URL: 'iydv_apps_script_url'
};

// Reference data only — drill & exercise catalog (not user data)
const DRILLS_REFERENCE = [
  // Regular Drills
  { Category: 'Regular Drill', Name: 'Diamond Push Ups', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Normal Push Ups', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Wide Push Ups', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Plank', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Tricep Dips', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Pistol Squats', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Squats', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Crunches', Type: 'Conditioning' },
  { Category: 'Regular Drill', Name: 'Hollow Body Hold', Type: 'Conditioning' },

  // Contemporary Drills
  { Category: 'Contemporary Drill', Name: 'WALK TIPTOE', Type: 'Dance Conditioning' },
  { Category: 'Contemporary Drill', Name: 'SIDE TIPTOE', Type: 'Dance Conditioning' },
  { Category: 'Contemporary Drill', Name: 'OPEN CLOSE CIRCULAR', Type: 'Dance Conditioning' },
  { Category: 'Contemporary Drill', Name: 'PASS DE BOUREE', Type: 'Dance Technique' },
  { Category: 'Contemporary Drill', Name: 'PEP DRILL', Type: 'Rhythm & Cardio' },
  { Category: 'Contemporary Drill', Name: 'SKIP', Type: 'Elevation & Plyo' },
  { Category: 'Contemporary Drill', Name: 'SIDE THROW SIDE STUCK', Type: 'Dynamic Flexibility' },
  { Category: 'Contemporary Drill', Name: 'UP AND DOWN', Type: 'Level Change Drill' },
  { Category: 'Contemporary Drill', Name: 'WALK STAIRS', Type: 'Leg Elevation' },
  { Category: 'Contemporary Drill', Name: 'WALK DOWN', Type: 'Floorwork Entry' },
  { Category: 'Contemporary Drill', Name: 'WALK UP', Type: 'Floorwork Recovery' },

  // Gym Routines
  { Category: 'Gym - Push', Name: 'Bench Press', Type: 'Strength' },
  { Category: 'Gym - Push', Name: 'Close-Grip BB Incline Press', Type: 'Strength' },
  { Category: 'Gym - Push', Name: 'Diamond Push Up', Type: 'Strength' },
  { Category: 'Gym - Pull', Name: 'Pull Up', Type: 'Strength' },
  { Category: 'Gym - Pull', Name: 'Side Arm DB Row', Type: 'Strength' },
  { Category: 'Gym - Legs', Name: 'Goblet Squat', Type: 'Strength' },
  { Category: 'Gym - Legs', Name: 'Leg Press', Type: 'Strength' },
  { Category: 'Gym - Legs', Name: 'Lunges', Type: 'Strength' },
  { Category: 'Gym - Back', Name: 'Deadlift', Type: 'Strength' },
  { Category: 'Gym - Back', Name: 'Barbell Row', Type: 'Strength' },
  { Category: 'Gym - Back', Name: 'Lat Pulldown', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Bench Press', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Close-Grip BB Incline Press', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Pull Up', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Goblet Squat', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Side Arm DB Row', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Diamond Push Up', Type: 'Strength' }
];

// ── Role Helpers ──────────────────────────────────────────
function isCoachOrOfficer(user) {
  if (!user) return false;
  return user.Rank === 'Team Captain' || user.Rank === 'Alumni';
}

function isCoach(user) {
  if (!user) return false;
  return user.Rank === 'Alumni';
}

function isOfficer(user) {
  if (!user) return false;
  return user.Rank === 'Team Captain';
}

class DataStore {
  constructor() {
    this.currentUser = null;
    this.revision = 0;
    this.changeVersion = 0;
    this.savedVersion = 0;
    this.init();
    window.addEventListener('online', () => this.flush().catch(() => {}));
    window.addEventListener('beforeunload', event => {
      if (this.changeVersion !== this.savedVersion) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }

  init() {
    this.data = Object.fromEntries(Object.values(STORAGE_KEYS).map(key => [key, []]));
    this.data[STORAGE_KEYS.DRILLS_REF] = DRILLS_REFERENCE;
    // Never read legacy localStorage credentials or export them to the new server.
  }

  getItem(key) { return structuredClone(this.data[key] || []); }

  setItem(key, data) {
    this.data[key] = structuredClone(data);
    this.markDirty();
  }

  status(state, message) {
    this.saveState = state;
    window.dispatchEvent(new CustomEvent('store-status', { detail: { state, message } }));
  }

  markDirty() {
    if (!this.currentUser) return;
    this.changeVersion++;
    this.status('saving', 'Saving your changes…');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush().catch(() => {}), 250);
    window.dispatchEvent(new CustomEvent('store-change'));
  }

  async request(route, options = {}) {
    let response;
    try {
      response = await fetch(route, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(15000) });
    } catch (error) {
      throw new Error('Cannot reach OneUp. Your unsaved changes are kept in this tab. Reconnect and retry before closing it.');
    }
    const data = await response.json().catch(() => ({}));
    if (data.code === 'SESSION_EXPIRED') window.dispatchEvent(new CustomEvent('session-lost'));
    if (!response.ok) throw new Error(data.error || 'Unable to complete your request.');
    return data;
  }

  applySession(payload) {
    this.init();
    this.currentUser = payload.member;
    this.data = { ...this.data, ...payload.state };
    this.data[STORAGE_KEYS.MEMBERS] = [payload.member];
    this.revision = payload.revision;
    this.changeVersion = this.savedVersion = 0;
    this.status('saved', 'All changes saved');
    return this.getCurrentUser();
  }

  async registerAccount(fields) {
    return this.applySession(await this.request('/api/auth/register', { method: 'POST', body: JSON.stringify(fields) }));
  }

  async loginAccount(identifier, password) {
    return this.applySession(await this.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }));
  }

  async restoreSession() {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
    if (response.status === 401) { this.clearCurrentUser(); return null; }
    if (!response.ok) throw new Error('Unable to restore your account. Please try again.');
    return this.applySession(await response.json());
  }

  async flush() {
    clearTimeout(this.saveTimer);
    if (this.pendingSave) return this.pendingSave;
    if (!this.currentUser || this.changeVersion === this.savedVersion) return;
    this.pendingSave = (async () => {
      try {
        while (this.currentUser && this.changeVersion !== this.savedVersion) {
          const version = this.changeVersion;
          const state = Object.fromEntries(Object.entries(this.data).filter(([key]) => ![STORAGE_KEYS.MEMBERS, STORAGE_KEYS.DRILLS_REF, STORAGE_KEYS.CURRENT_USER, STORAGE_KEYS.APPS_SCRIPT_URL].includes(key)));
          const response = await this.request('/api/state', { method: 'PUT', body: JSON.stringify({ member: this.currentUser, state, revision: this.revision }) });
          this.revision = response.revision;
          this.savedVersion = version;
          if (this.changeVersion === version) {
            this.currentUser = response.member;
            this.data[STORAGE_KEYS.MEMBERS] = [response.member];
          }
        }
        this.status('saved', 'All changes saved');
      } catch (error) {
        this.status('error', error.message);
        throw error;
      } finally { this.pendingSave = null; }
    })();
    return this.pendingSave;
  }

  async logoutAccount() {
    await this.flush();
    await this.request('/api/auth/logout', { method: 'POST', body: '{}' });
    this.clearCurrentUser();
  }

  async deleteAccount(password) {
    await this.request('/api/account', { method: 'DELETE', body: JSON.stringify({ password, memberId: this.currentUser?.MemberID }) });
    this.clearCurrentUser();
  }

  exportData() {
    return { exportedAt: new Date().toISOString(), member: this.getCurrentUser(), state: structuredClone(this.data), hasUnsavedChanges: this.changeVersion !== this.savedVersion };
  }

  getMembers() { return this.getItem(STORAGE_KEYS.MEMBERS); }
  getMemberById(id) { return this.getMembers().find(member => member.MemberID === id); }

  saveMember(member) {
    if (!this.currentUser || member.MemberID !== this.currentUser.MemberID) return;
    const { Password, password, ...safe } = member;
    this.currentUser = safe;
    this.setItem(STORAGE_KEYS.MEMBERS, [safe]);
  }

  getCurrentUser() { return this.currentUser ? structuredClone(this.currentUser) : null; }
  setCurrentUser(member) { if (this.currentUser?.MemberID === member?.MemberID) this.saveMember(member); }
  clearCurrentUser() {
    clearTimeout(this.saveTimer);
    this.currentUser = null;
    this.init();
    this.changeVersion = this.savedVersion = 0;
  }

  // ── Workouts ─────────────────────────────────────────────
  getWorkoutLogs(memberId = null) {
    const logs = this.getItem(STORAGE_KEYS.WORKOUT_LOGS);
    if (!memberId) return logs;
    return logs.filter(l => l.MemberID === memberId);
  }

  addWorkoutLogsBatch(logArray) {
    const logs = this.getWorkoutLogs();
    logArray.forEach(log => {
      log.LogID = log.LogID || 'L' + crypto.randomUUID();
      logs.unshift(log);
      this.postToSheets('Workout Logs', log);
    });
    this.setItem(STORAGE_KEYS.WORKOUT_LOGS, logs);
    return logArray;
  }

  addWorkoutLog(log) {
    return this.addWorkoutLogsBatch([log])[0];
  }

  deleteWorkoutLog(logId) {
    let logs = this.getWorkoutLogs();
    logs = logs.filter(l => l.LogID !== logId);
    this.setItem(STORAGE_KEYS.WORKOUT_LOGS, logs);
  }

  // ── Weight ───────────────────────────────────────────────
  getWeightLogs(memberId = null) {
    const logs = this.getItem(STORAGE_KEYS.WEIGHT_LOGS);
    if (!memberId) return logs;
    return logs.filter(l => l.MemberID === memberId);
  }

  addWeightLog(memberId, weightKg, dateStr) {
    if (!Number.isFinite(Number(weightKg)) || Number(weightKg) < 20 || Number(weightKg) > 350 || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || dateStr > localDate()) throw new Error('Enter a weight from 20 to 350 kg and a valid date.');
    const logs = this.getWeightLogs();
    const existing = logs.find(row => row.MemberID === memberId && row.Date === dateStr);
    const newLog = existing || { LogID: crypto.randomUUID(), Date: dateStr, MemberID: memberId };
    newLog.WeightKg = Number(weightKg);
    if (!existing) logs.push(newLog);
    const ordered = logs.filter(row => row.MemberID === memberId).sort((a, b) => a.Date.localeCompare(b.Date));
    ordered.forEach((row, index) => { row.ChangeKg = index ? +(row.WeightKg - ordered[index - 1].WeightKg).toFixed(1) : 0; });
    logs.sort((a, b) => b.Date.localeCompare(a.Date));
    this.setItem(STORAGE_KEYS.WEIGHT_LOGS, logs);
    const member = this.getMemberById(memberId);
    if (member) {
      member.WeightKg = ordered[ordered.length - 1].WeightKg;
      this.calculateBMI(member);
      this.saveMember(member);
    }
    return newLog;
  }

  // ── Goals ────────────────────────────────────────────────
  getGoals(memberId = null) {
    const goals = this.getItem(STORAGE_KEYS.GOALS);
    if (!memberId) return goals;
    return goals.filter(g => g.MemberID === memberId);
  }

  saveGoal(goal) {
    const goals = this.getGoals();
    goal.GoalID = goal.GoalID || crypto.randomUUID();
    const idx = goals.findIndex(g => g.GoalID === goal.GoalID);
    if (idx >= 0) goals[idx] = goal;
    else goals.push(goal);
    this.setItem(STORAGE_KEYS.GOALS, goals);
    this.postToSheets('Goals', goal);
    return goal;
  }

  // ── Skills ───────────────────────────────────────────────
  getSkills(memberId = null) {
    const skills = this.getItem(STORAGE_KEYS.SKILLS);
    if (!memberId) return skills;
    return skills.filter(s => s.MemberID === memberId);
  }

  saveSkill(skill) {
    const skills = this.getSkills();
    skill.SkillID = skill.SkillID || crypto.randomUUID();
    const idx = skills.findIndex(s => s.SkillID === skill.SkillID);
    if (idx >= 0) skills[idx] = skill;
    else skills.push(skill);
    this.setItem(STORAGE_KEYS.SKILLS, skills);
    this.postToSheets('Skills Learned', skill);
    return skill;
  }

  // ── Attendance ───────────────────────────────────────────
  getAttendanceLogs() {
    return this.getItem(STORAGE_KEYS.ATTENDANCE);
  }

  addAttendanceLog(memberId) {
    const member = this.getMemberById(memberId);
    if (!member) return null;

    const todayStr = localDate();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logs = this.getAttendanceLogs();

    const existing = logs.find(l => l.MemberID === memberId && l.Date === todayStr);
    if (existing) return existing;

    const newLog = {
      LogID: crypto.randomUUID(),
      Date: todayStr,
      MemberID: memberId,
      FullName: member.FullName,
      Time: timeStr,
      Status: 'Pending Approval',
      ApprovedBy: ''
    };

    logs.unshift(newLog);
    this.setItem(STORAGE_KEYS.ATTENDANCE, logs);
    this.postToSheets('Attendance Logs', newLog);
    return newLog;
  }

  approveAttendance(logId, approverName) {
    const logs = this.getAttendanceLogs();
    const idx = logs.findIndex(l => l.LogID === logId);
    if (idx >= 0) {
      logs[idx].Status = 'Approved';
      logs[idx].ApprovedBy = approverName || 'Admin';
      logs[idx].ApprovedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.setItem(STORAGE_KEYS.ATTENDANCE, logs);
      this.postToSheets('Attendance Logs', logs[idx]);
    }
  }

  // ── Drills Reference (built-in + custom) ─────────────────
  getDrillsReference(category = null) {
    const builtIn = this.getItem(STORAGE_KEYS.DRILLS_REF);
    const custom = this.getItem(STORAGE_KEYS.CUSTOM_DRILLS);
    const all = [...builtIn, ...custom];
    if (!category) return all;
    return all.filter(d => d.Category.toLowerCase().includes(category.toLowerCase()));
  }

  saveCustomDrill(drill) {
    const custom = this.getItem(STORAGE_KEYS.CUSTOM_DRILLS);
    drill.DrillID = drill.DrillID || crypto.randomUUID();
    drill.IsCustom = true;
    custom.push(drill);
    this.setItem(STORAGE_KEYS.CUSTOM_DRILLS, custom);
    this.postToSheets('Drill Catalog', drill);
    return drill;
  }

  // ── Training Schedules ───────────────────────────────────
  getTrainingSchedules() {
    return this.getItem(STORAGE_KEYS.TRAINING_SCHEDULES);
  }

  getUpcomingSchedule() {
    return this.getTrainingSchedules().filter(row => row.Date >= localDate())
      .sort((a, b) => a.Date.localeCompare(b.Date) || (a.CallTime || '').localeCompare(b.CallTime || ''))[0] || null;
  }

  saveTrainingSchedule(schedule) {
    const schedules = this.getTrainingSchedules();
    schedule.ScheduleID = schedule.ScheduleID || crypto.randomUUID();
    schedules.unshift(schedule);
    this.setItem(STORAGE_KEYS.TRAINING_SCHEDULES, schedules);
    this.postToSheets('Training Schedules', schedule);
    return schedule;
  }

  // ── BMI ───────────────────────────────────────────────────
  calculateBMI(member) {
    if (member.WeightKg > 0 && member.HeightCm > 0) {
      const heightM = member.HeightCm / 100;
      const bmi = member.WeightKg / (heightM * heightM);
      member.BMI = parseFloat(bmi.toFixed(1));

      if (member.BMI < 18.5) member.BMICategory = 'Underweight';
      else if (member.BMI < 25.0) member.BMICategory = 'Normal';
      else if (member.BMI < 30.0) member.BMICategory = 'Overweight';
      else member.BMICategory = 'Obese';
    }
  }

  // Legacy public Sheets endpoints are intentionally disabled. Account records never
  // leave the same-origin authenticated API.
  getAppsScriptUrl() { return ''; }
  setAppsScriptUrl() { throw new Error('External sheet sync is unavailable. Use your private account export.'); }
  async postToSheets() { return null; }
  async fetchFromSheets() { return null; }
  async syncMembersFromSheets() { return false; }
  async syncAttendanceFromSheets() { return false; }
  async syncSchedulesFromSheets() { return false; }
}

const store = new DataStore();

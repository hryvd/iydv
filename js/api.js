/* ==========================================================================
   IYDV ONEUP - Data Store & Google Sheets API
   localStorage primary store + Google Sheets bidirectional sync
   ========================================================================== */

const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby27n7FzyFCnaLdDVstuLJBl4grnhn9FFOvny-AAymWKlQVQONgZTHBT3gdtSM6eIDdAQ/exec';

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
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.MEMBERS)) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WORKOUT_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.WORKOUT_LOGS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WEIGHT_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.WEIGHT_LOGS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.GOALS)) {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SKILLS)) {
      localStorage.setItem(STORAGE_KEYS.SKILLS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRAINING_SCHEDULES)) {
      localStorage.setItem(STORAGE_KEYS.TRAINING_SCHEDULES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CUSTOM_DRILLS)) {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_DRILLS, JSON.stringify([]));
    }
    // Always refresh drills reference catalog
    localStorage.setItem(STORAGE_KEYS.DRILLS_REF, JSON.stringify(DRILLS_REFERENCE));
  }

  getItem(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  setItem(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ── Members ──────────────────────────────────────────────
  getMembers() { return this.getItem(STORAGE_KEYS.MEMBERS); }
  getMemberById(id) { return this.getMembers().find(m => m.MemberID === id); }

  saveMember(member) {
    const members = this.getMembers();
    const idx = members.findIndex(m => m.MemberID === member.MemberID);
    if (idx >= 0) members[idx] = member;
    else members.push(member);
    this.setItem(STORAGE_KEYS.MEMBERS, members);

    const curr = this.getCurrentUser();
    if (curr && curr.MemberID === member.MemberID) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(member));
    }
  }

  getCurrentUser() {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!data) return null;
    const user = JSON.parse(data);
    if (!user || !user.MemberID) return null;
    return user;
  }

  setCurrentUser(member) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(member));
  }

  clearCurrentUser() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
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
      log.LogID = log.LogID || 'L' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7);
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
    const logs = this.getWeightLogs();
    const memberLogs = logs.filter(l => l.MemberID === memberId).sort((a, b) => new Date(a.Date) - new Date(b.Date));

    let lastWeight = memberLogs.length > 0 ? memberLogs[memberLogs.length - 1].WeightKg : weightKg;
    let changeKg = parseFloat((weightKg - lastWeight).toFixed(1));

    const newLog = {
      LogID: 'W' + String(Date.now()).slice(-6),
      Date: dateStr,
      MemberID: memberId,
      WeightKg: parseFloat(weightKg),
      ChangeKg: changeKg
    };

    logs.unshift(newLog);
    this.setItem(STORAGE_KEYS.WEIGHT_LOGS, logs);
    this.postToSheets('Weight Logs', newLog);

    const member = this.getMemberById(memberId);
    if (member) {
      member.WeightKg = parseFloat(weightKg);
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
    goal.GoalID = goal.GoalID || 'G' + String(Date.now()).slice(-6);
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
    skill.SkillID = skill.SkillID || 'S' + String(Date.now()).slice(-6);
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

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logs = this.getAttendanceLogs();

    const existing = logs.find(l => l.MemberID === memberId && l.Date === todayStr);
    if (existing) return existing;

    const newLog = {
      LogID: 'A' + String(Date.now()).slice(-6),
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
    drill.DrillID = drill.DrillID || 'DR' + String(Date.now()).slice(-6);
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
    const schedules = this.getTrainingSchedules();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = schedules
      .filter(s => new Date(s.Date) >= today)
      .sort((a, b) => new Date(a.Date) - new Date(b.Date));
    return upcoming[0] || null;
  }

  saveTrainingSchedule(schedule) {
    const schedules = this.getTrainingSchedules();
    schedule.ScheduleID = schedule.ScheduleID || 'SCH' + String(Date.now()).slice(-6);
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

  // ── Google Sign-In ───────────────────────────────────────
  loginWithGoogle(googleUserData) {
    const members = this.getMembers();
    let member = members.find(m => m.Email && m.Email.toLowerCase() === googleUserData.email.toLowerCase());

    if (!member) {
      member = {
        MemberID: 'M' + String(members.length + 1).padStart(3, '0'),
        Username: googleUserData.email.split('@')[0],
        FullName: googleUserData.name || 'Varsity Athlete',
        Rank: 'Rookie',
        ProgramFocus: 'Whole Body',
        Email: googleUserData.email,
        ContactNumber: 'N/A',
        DateJoined: new Date().toISOString().split('T')[0],
        WeightKg: 0,
        HeightCm: 0,
        BMI: 0,
        BMICategory: '--',
        Status: 'Active',
        Notes: 'Signed in via Google Account',
        Avatar: ''
      };
      this.saveMember(member);
      this.postToSheets('Members', member);
    }

    this.setCurrentUser(member);
    return member;
  }

  // ── Google Sheets / Apps Script API ─────────────────────
  getAppsScriptUrl() {
    return localStorage.getItem(STORAGE_KEYS.APPS_SCRIPT_URL) || DEFAULT_APPS_SCRIPT_URL;
  }

  setAppsScriptUrl(url) {
    localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, url.trim());
  }

  async postToSheets(sheetName, record) {
    const url = this.getAppsScriptUrl();
    if (!url) return null;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ sheet: sheetName, record: record })
      });
      const data = await res.json();
      console.log(`[Sheets POST] ${sheetName}:`, data);
      return data;
    } catch (err) {
      console.warn(`[Sheets POST] ${sheetName} sync error:`, err.message);
      return null;
    }
  }

  async fetchFromSheets(sheetName, filters = {}) {
    const url = this.getAppsScriptUrl();
    if (!url) return null;

    try {
      const params = new URLSearchParams({ sheet: sheetName, ...filters });
      const res = await fetch(`${url}?${params.toString()}`);
      const data = await res.json();
      console.log(`[Sheets GET] ${sheetName}:`, data);
      return data;
    } catch (err) {
      console.warn(`[Sheets GET] ${sheetName} fetch error:`, err.message);
      return null;
    }
  }

  /**
   * Pull Members sheet from Sheets and merge into localStorage.
   * Local data is overwritten by Sheets data for matching MemberIDs.
   */
  async syncMembersFromSheets() {
    const data = await this.fetchFromSheets('Members');
    if (!Array.isArray(data) || data.length === 0) return false;

    const localMembers = this.getMembers();
    data.forEach(sheetMember => {
      if (!sheetMember.MemberID) return;
      const idx = localMembers.findIndex(m => m.MemberID === sheetMember.MemberID);
      if (idx >= 0) {
        localMembers[idx] = { ...localMembers[idx], ...sheetMember };
      } else {
        localMembers.push(sheetMember);
      }
    });
    this.setItem(STORAGE_KEYS.MEMBERS, localMembers);

    // Refresh current user if exists
    const curr = this.getCurrentUser();
    if (curr) {
      const updated = localMembers.find(m => m.MemberID === curr.MemberID);
      if (updated) this.setCurrentUser(updated);
    }

    console.log('[Sheets SYNC] Members synced:', data.length, 'records');
    return true;
  }

  /**
   * Pull Attendance Logs from Sheets and merge.
   */
  async syncAttendanceFromSheets() {
    const data = await this.fetchFromSheets('Attendance Logs');
    if (!Array.isArray(data) || data.length === 0) return false;

    const local = this.getAttendanceLogs();
    data.forEach(sheetLog => {
      if (!sheetLog.LogID) return;
      const idx = local.findIndex(l => l.LogID === sheetLog.LogID);
      if (idx >= 0) {
        local[idx] = { ...local[idx], ...sheetLog };
      } else {
        local.unshift(sheetLog);
      }
    });
    this.setItem(STORAGE_KEYS.ATTENDANCE, local);
    console.log('[Sheets SYNC] Attendance synced:', data.length, 'records');
    return true;
  }

  /**
   * Pull Training Schedules from Sheets and merge.
   */
  async syncSchedulesFromSheets() {
    const data = await this.fetchFromSheets('Training Schedules');
    if (!Array.isArray(data) || data.length === 0) return false;

    const local = this.getTrainingSchedules();
    data.forEach(sheetSched => {
      if (!sheetSched.ScheduleID) return;
      const idx = local.findIndex(s => s.ScheduleID === sheetSched.ScheduleID);
      if (idx >= 0) {
        local[idx] = { ...local[idx], ...sheetSched };
      } else {
        local.unshift(sheetSched);
      }
    });
    this.setItem(STORAGE_KEYS.TRAINING_SCHEDULES, local);
    console.log('[Sheets SYNC] Schedules synced:', data.length, 'records');
    return true;
  }
}

const store = new DataStore();

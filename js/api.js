/* ==========================================================================
   IYDV ONEUP - API & Persistence Layer (Data Store & Google Sheets Sync)
   ========================================================================== */

const STORAGE_KEYS = {
  CURRENT_USER: 'iydv_current_user',
  MEMBERS: 'iydv_members',
  WORKOUT_LOGS: 'iydv_workout_logs',
  WEIGHT_LOGS: 'iydv_weight_logs',
  GOALS: 'iydv_goals',
  SKILLS: 'iydv_skills',
  DRILLS_REF: 'iydv_drills_ref',
  ATTENDANCE: 'iydv_attendance',
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

class DataStore {
  constructor() {
    this.init();
  }

  init() {
    // Initialize empty arrays for user data if not present
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
    // Verify the user object has the required fields
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
      // Sync each record individually to Google Sheets
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
      ApprovedBy: 'Pending Coach'
    };

    logs.unshift(newLog);
    this.setItem(STORAGE_KEYS.ATTENDANCE, logs);
    this.postToSheets('Attendance Logs', newLog);
    return newLog;
  }

  approveAttendance(logId, coachName = 'Coach Santos') {
    const logs = this.getAttendanceLogs();
    const idx = logs.findIndex(l => l.LogID === logId);
    if (idx >= 0) {
      logs[idx].Status = 'Approved';
      logs[idx].ApprovedBy = coachName;
      this.setItem(STORAGE_KEYS.ATTENDANCE, logs);
      this.postToSheets('Attendance Logs', logs[idx]);
    }
  }

  getDrillsReference(category = null) {
    const list = this.getItem(STORAGE_KEYS.DRILLS_REF);
    if (!category) return list;
    return list.filter(d => d.Category.toLowerCase().includes(category.toLowerCase()));
  }

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

  // ── Google Sheets API ────────────────────────────────────
  getAppsScriptUrl() {
    return localStorage.getItem(STORAGE_KEYS.APPS_SCRIPT_URL) || '';
  }

  setAppsScriptUrl(url) {
    localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, url.trim());
  }

  /**
   * POST a single record to Google Sheets via Apps Script doPost.
   * Apps Script returns JSON with CORS headers, so we use default mode.
   */
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

  /**
   * GET records from Google Sheets via Apps Script doGet.
   * @param {string} sheetName - e.g. 'Members', 'Workout Logs'
   * @param {Object} filters - e.g. { MemberID: 'M001' }
   */
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
}

const store = new DataStore();

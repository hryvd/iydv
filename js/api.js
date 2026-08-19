/* ==========================================================================
   IYDV ONEUP - API & Persistence Layer (Data Store & Sync Manager)
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

// Complete Master Drills & Exercise Reference (Includes all user Contemporary Drills!)
const INITIAL_DRILLS_REF = [
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

  // Contemporary Drills (Exact list from user original app screens!)
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
  { Category: 'Gym - Whole Body', Name: 'Bench Press', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Close-Grip BB Incline Press', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Pull Up', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Goblet Squat', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Side Arm DB Row', Type: 'Strength' },
  { Category: 'Gym - Whole Body', Name: 'Diamond Push Up', Type: 'Strength' }
];

// Initial Seed Members
const INITIAL_MEMBERS = [
  {
    MemberID: 'M001',
    Username: 'hdimaano',
    FullName: 'Dimaano, Harry V.',
    Rank: 'Rookie',
    ProgramFocus: 'Whole Body',
    Email: 'harry.dimaano@g.batstate-u.edu.ph',
    ContactNumber: '0917 000 0000',
    DateJoined: '2025-06-01',
    WeightKg: 68,
    HeightCm: 172,
    BMI: 23.0,
    BMICategory: 'Normal',
    Status: 'Active',
    Notes: 'Initial varsity athlete record',
    Avatar: ''
  }
];

// Initial Attendance Records
const INITIAL_ATTENDANCE = [
  { LogID: 'A001', Date: '2026-08-19', MemberID: 'M001', FullName: 'Dimaano, Harry V.', Time: '08:30 AM', Status: 'Approved', ApprovedBy: 'Coach Santos' }
];

class DataStore {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.MEMBERS)) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(INITIAL_MEMBERS));
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
    // Always refresh DRILLS_REF to ensure new contemporary drills are available
    localStorage.setItem(STORAGE_KEYS.DRILLS_REF, JSON.stringify(INITIAL_DRILLS_REF));

    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(INITIAL_ATTENDANCE));
    }

    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_MEMBERS[0]));
    }
  }

  getItem(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  setItem(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    this.syncToGoogleSheets(key, data);
  }

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
    return data ? JSON.parse(data) : INITIAL_MEMBERS[0];
  }

  setCurrentUser(member) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(member));
  }

  // Workouts API
  getWorkoutLogs(memberId = null) {
    const logs = this.getItem(STORAGE_KEYS.WORKOUT_LOGS);
    if (!memberId) return logs;
    return logs.filter(l => l.MemberID === memberId);
  }

  addWorkoutLogsBatch(logArray) {
    const logs = this.getWorkoutLogs();
    logArray.forEach(log => {
      log.LogID = log.LogID || 'L' + String(Date.now() + Math.floor(Math.random()*1000)).slice(-7);
      logs.unshift(log);
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

  // Weight API
  getWeightLogs(memberId = null) {
    const logs = this.getItem(STORAGE_KEYS.WEIGHT_LOGS);
    if (!memberId) return logs;
    return logs.filter(l => l.MemberID === memberId);
  }

  addWeightLog(memberId, weightKg, dateStr) {
    const logs = this.getWeightLogs();
    const memberLogs = logs.filter(l => l.MemberID === memberId).sort((a,b) => new Date(a.Date) - new Date(b.Date));
    
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

    const member = this.getMemberById(memberId);
    if (member) {
      member.WeightKg = parseFloat(weightKg);
      this.calculateBMI(member);
      this.saveMember(member);
    }

    return newLog;
  }

  // Goals API
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
    return goal;
  }

  // Skills API
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
    return skill;
  }

  // Attendance API
  getAttendanceLogs() {
    return this.getItem(STORAGE_KEYS.ATTENDANCE);
  }

  addAttendanceLog(memberId) {
    const member = this.getMemberById(memberId);
    if (!member) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logs = this.getAttendanceLogs();

    // Check if already checked in today
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
    return newLog;
  }

  approveAttendance(logId, coachName = 'Coach Santos') {
    const logs = this.getAttendanceLogs();
    const idx = logs.findIndex(l => l.LogID === logId);
    if (idx >= 0) {
      logs[idx].Status = 'Approved';
      logs[idx].ApprovedBy = coachName;
      this.setItem(STORAGE_KEYS.ATTENDANCE, logs);
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

  // Google Sign-In helper
  loginWithGoogle(googleUserData) {
    const members = this.getMembers();
    let member = members.find(m => m.Email.toLowerCase() === googleUserData.email.toLowerCase());

    if (!member) {
      // Auto-register Google user
      member = {
        MemberID: 'M' + String(members.length + 1).padStart(3, '0'),
        Username: googleUserData.email.split('@')[0],
        FullName: googleUserData.name || 'Google Varsity Athlete',
        Rank: 'Rookie',
        ProgramFocus: 'Whole Body',
        Email: googleUserData.email,
        ContactNumber: 'Google Verified',
        DateJoined: new Date().toISOString().split('T')[0],
        WeightKg: 65.0,
        HeightCm: 170,
        BMI: 22.5,
        BMICategory: 'Normal',
        Status: 'Active',
        Notes: 'Signed in via Google Account'
      };
      this.saveMember(member);
    }

    this.setCurrentUser(member);
    return member;
  }

  getAppsScriptUrl() {
    return localStorage.getItem(STORAGE_KEYS.APPS_SCRIPT_URL) || '';
  }

  setAppsScriptUrl(url) {
    localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, url.trim());
  }

  async syncToGoogleSheets(key, data) {
    const url = this.getAppsScriptUrl();
    if (!url) return;

    let sheetName = '';
    if (key === STORAGE_KEYS.WORKOUT_LOGS) sheetName = 'Workout Logs';
    else if (key === STORAGE_KEYS.WEIGHT_LOGS) sheetName = 'Weight Logs';
    else if (key === STORAGE_KEYS.GOALS) sheetName = 'Goals';
    else if (key === STORAGE_KEYS.SKILLS) sheetName = 'Skills Learned';
    else if (key === STORAGE_KEYS.MEMBERS) sheetName = 'Members';
    else if (key === STORAGE_KEYS.ATTENDANCE) sheetName = 'Attendance Logs';

    if (!sheetName) return;

    try {
      const lastItem = Array.isArray(data) ? data[0] : data;
      if (lastItem) {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheet: sheetName, record: lastItem })
        });
      }
    } catch (err) {
      console.warn('Google Sheets sync notice:', err.message);
    }
  }
}

const store = new DataStore();

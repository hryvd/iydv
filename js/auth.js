/* ==========================================================================
   IYDV ONEUP - Auth, Profile & Photo Upload Module
   Sheets sync on login, role-aware rendering
   ========================================================================== */

class AuthModule {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.toggle-password-btn')) {
        const btn = e.target.closest('.toggle-password-btn');
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
          input.setAttribute('type', type);
          btn.innerHTML = type === 'password'
            ? `<i data-lucide="eye"></i>`
            : `<i data-lucide="eye-off"></i>`;
          if (window.lucide) lucide.createIcons();
        }
      }

      if (e.target.closest('.google-signin-btn')) {
        this.handleGoogleSignIn();
      }

      if (e.target.closest('.trigger-avatar-upload')) {
        const fileInput = document.getElementById('profile-photo-input');
        if (fileInput) fileInput.click();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'profile-photo-input') {
        this.handlePhotoUpload(e.target);
      }
    });

    const createAccForm = document.getElementById('create-account-form');
    if (createAccForm) {
      createAccForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRegister();
      });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    const editStatsForm = document.getElementById('edit-stats-form');
    if (editStatsForm) {
      editStatsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveStats();
      });
    }
  }

  renderUserProfileCard() {
    const user = store.getCurrentUser();
    if (!user) return;

    const avatarSrc = user.Avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.Username}`;
    const canManage = isCoachOrOfficer(user);

    // Attendance Status Today
    const todayStr = new Date().toISOString().split('T')[0];
    const attendanceLogs = store.getAttendanceLogs();
    const userAttToday = attendanceLogs.find(a => a.MemberID === user.MemberID && a.Date === todayStr);

    const topAttBanner = document.getElementById('top-attendance-banner');
    if (topAttBanner) {
      if (!userAttToday) {
        topAttBanner.innerHTML = `
          <button class="btn btn-primary top-attendance-btn" onclick="authModule.handleAttendanceCheckin()">
            <i data-lucide="map-pin"></i> MARK ATTENDANCE PRESENT
          </button>
        `;
      } else if (userAttToday.Status === 'Approved') {
        topAttBanner.innerHTML = `
          <div class="top-attendance-status status-approved">
            <i data-lucide="check-circle-2"></i> ATTENDANCE VERIFIED PRESENT TODAY (${userAttToday.Time})
          </div>
        `;
      } else {
        topAttBanner.innerHTML = `
          <div class="top-attendance-status status-pending">
            <i data-lucide="clock"></i> ATTENDANCE SUBMITTED — PENDING APPROVAL
          </div>
        `;
      }
    }

    const profileCardEl = document.getElementById('user-profile-card');
    if (profileCardEl) {
      store.calculateBMI(user);

      const roleLabel = user.Rank === 'Alumni' ? 'COACH' : user.Rank === 'Team Captain' ? 'OFFICER' : null;

      profileCardEl.innerHTML = `
        <div class="profile-card-content">
          <div class="profile-avatar-wrapper trigger-avatar-upload" title="Click to upload profile photo">
            <img src="${avatarSrc}" alt="${user.FullName}" class="profile-avatar" />
            <div class="avatar-camera-badge">
              <i data-lucide="camera" style="width: 12px; height: 12px; stroke-width: 2.5;"></i>
            </div>
            <span class="rank-badge">${user.Rank || 'ROOKIE'}</span>
          </div>

          <div class="profile-details-block">
            <h2 class="profile-name-text">${user.FullName}</h2>
            <div class="profile-sub-text">ID: <strong>${user.MemberID}</strong> &nbsp;•&nbsp; ${user.ProgramFocus || 'Whole Body'}</div>

            ${roleLabel ? `<div class="admin-role-banner"><i data-lucide="shield-check" style="width:10px;height:10px;"></i> ${roleLabel}</div>` : ''}

            <div class="profile-actions-row">
              <button class="edit-stats-pill-btn" onclick="app.openModal('edit-stats-modal')">
                <i data-lucide="pencil" style="width: 11px; height: 11px;"></i> Edit Stats
              </button>
              <button class="trigger-avatar-upload upload-photo-pill-btn">
                <i data-lucide="upload" style="width: 11px; height: 11px;"></i> Photo
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const weightValEl = document.getElementById('user-weight-display');
    const heightValEl = document.getElementById('user-height-display');
    const bmiValEl = document.getElementById('user-bmi-display');
    const bmiCatEl = document.getElementById('user-bmi-category');

    if (weightValEl) weightValEl.textContent = user.WeightKg ? `${user.WeightKg} kg` : '-- kg';
    if (heightValEl) heightValEl.textContent = user.HeightCm ? `${user.HeightCm} cm` : '-- cm';
    if (bmiValEl) bmiValEl.textContent = user.BMI || '--';
    if (bmiCatEl) bmiCatEl.textContent = user.BMICategory || '--';

    if (window.lucide) lucide.createIcons();

    // Show schedule training btn in header for coaches/officers
    const schedBtn = document.getElementById('schedule-training-btn');
    if (schedBtn) {
      schedBtn.style.display = isCoachOrOfficer(user) ? 'inline-flex' : 'none';
    }
  }

  handlePhotoUpload(inputEl) {
    if (!inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo file is too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Image = e.target.result;
      const user = store.getCurrentUser();
      if (user) {
        user.Avatar = base64Image;
        store.saveMember(user);
        this.renderUserProfileCard();
        alert('📷 Profile photo updated!');
      }
    };
    reader.readAsDataURL(file);
  }

  handleAttendanceCheckin() {
    const user = store.getCurrentUser();
    if (!user) return;

    store.addAttendanceLog(user.MemberID);
    this.renderUserProfileCard();

    alert('📍 Attendance Check-In Recorded!\nSent for Coach/Officer approval.');
  }

  handleGoogleSignIn() {
    const name = prompt('Enter your full name (Last, First M.):');
    if (!name || !name.trim()) return;

    const email = prompt('Enter your institutional email:');
    if (!email || !email.trim()) return;

    const member = store.loginWithGoogle({ name: name.trim(), email: email.trim() });
    this.renderUserProfileCard();

    alert(`Google Authentication Successful!\nSigned in as: ${member.FullName}`);
    app.switchScreen('home-screen');
    // Render schedule panel immediately
    setTimeout(() => { if (window.scheduleModule) scheduleModule.renderAllPanels(); }, 80);

    // Background sync
    this._syncFromSheets();
  }

  handleRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const fullName = document.getElementById('reg-fullname').value.trim();
    const rank = document.getElementById('reg-rank').value;
    const email = document.getElementById('reg-email').value.trim();
    const contact = document.getElementById('reg-contact').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const privacyConsent = document.getElementById('reg-privacy-consent').checked;

    if (!username || !fullName || !rank || !password) {
      alert('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    if (!privacyConsent) {
      alert('Please accept the Data Privacy notice.');
      return;
    }

    const members = store.getMembers();
    const existing = members.find(m => m.Username.toLowerCase() === username.toLowerCase());
    if (existing) {
      alert('Username already exists. Please choose another.');
      return;
    }

    const newMember = {
      MemberID: 'M' + String(members.length + 1).padStart(3, '0'),
      Username: username,
      FullName: fullName,
      Rank: rank,
      ProgramFocus: 'Whole Body',
      Email: email || `${username}@batstate-u.edu.ph`,
      ContactNumber: contact || 'N/A',
      DateJoined: new Date().toISOString().split('T')[0],
      WeightKg: 0,
      HeightCm: 0,
      BMI: 0,
      BMICategory: '--',
      Status: 'Active',
      Notes: 'Newly registered athlete',
      Password: password,
      Avatar: ''
    };

    store.saveMember(newMember);
    store.postToSheets('Members', newMember);
    store.setCurrentUser(newMember);
    this.renderUserProfileCard();

    alert(`Account created! Welcome to IYDV ONEUP, ${fullName}.`);
    app.switchScreen('home-screen');
    // Render schedule panel immediately
    setTimeout(() => { if (window.scheduleModule) scheduleModule.renderAllPanels(); }, 80);
  }

  handleLogin() {
    const userOrEmail = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    if (!userOrEmail) {
      alert('Please enter your username or email.');
      return;
    }

    const members = store.getMembers();
    const found = members.find(m =>
      m.Username.toLowerCase() === userOrEmail ||
      (m.Email && m.Email.toLowerCase() === userOrEmail)
    );

    if (!found) {
      alert('Account not found. Check your credentials or create a new account.');
      return;
    }

    if (found.Password && found.Password !== password) {
      alert('Incorrect password. Please try again.');
      return;
    }

    store.setCurrentUser(found);
    this.renderUserProfileCard();

    // Show sync indicator briefly
    const syncNote = document.createElement('div');
    syncNote.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(255,107,53,0.9);color:#fff;padding:6px 16px;border-radius:20px;font-size:0.72rem;font-family:Outfit,sans-serif;font-weight:700;z-index:9999;letter-spacing:0.5px;';
    syncNote.textContent = '⟳ Syncing from Sheets...';
    document.body.appendChild(syncNote);

    app.switchScreen('home-screen');
    // Render schedule panel immediately (don't wait for sync)
    setTimeout(() => { if (window.scheduleModule) scheduleModule.renderAllPanels(); }, 80);

    // Background sync from Sheets after login
    this._syncFromSheets().then(() => {
      syncNote.textContent = '\u2713 Synced with Sheets';
      syncNote.style.background = 'rgba(48,209,88,0.9)';
      setTimeout(() => syncNote.remove(), 1800);
      // Refresh panels again after sync in case schedules updated
      this.renderUserProfileCard();
      if (window.scheduleModule) scheduleModule.renderAllPanels();
    }).catch(() => {
      syncNote.textContent = '\u26a0\ufe0f Offline mode';
      syncNote.style.background = 'rgba(255,149,0,0.9)';
      setTimeout(() => syncNote.remove(), 2000);
    });
  }

  async _syncFromSheets() {
    try {
      await store.syncMembersFromSheets();
      await store.syncAttendanceFromSheets();
      await store.syncSchedulesFromSheets();
    } catch (e) {
      console.warn('[Auth] Sheets sync failed:', e.message);
    }
  }

  handleSaveStats() {
    const user = store.getCurrentUser();
    if (!user) return;

    const newWeight = parseFloat(document.getElementById('edit-weight-input').value);
    const newHeight = parseFloat(document.getElementById('edit-height-input').value);
    const newProgram = document.getElementById('edit-program-input').value;

    if (isNaN(newWeight) || newWeight <= 0) {
      alert('Please enter a valid weight in kg.');
      return;
    }

    if (isNaN(newHeight) || newHeight <= 0) {
      alert('Please enter a valid height in cm.');
      return;
    }

    user.WeightKg = newWeight;
    user.HeightCm = newHeight;
    user.ProgramFocus = newProgram;
    store.calculateBMI(user);

    store.saveMember(user);
    store.addWeightLog(user.MemberID, newWeight, new Date().toISOString().split('T')[0]);

    this.renderUserProfileCard();
    app.closeModal('edit-stats-modal');

    if (window.weightModule) weightModule.renderWeightChart();
  }

  logout() {
    if (confirm('Are you sure you want to sign out?')) {
      store.clearCurrentUser();
      app.switchScreen('welcome-screen');
    }
  }
}

const authModule = new AuthModule();

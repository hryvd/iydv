/* Account forms and athlete profile. Authentication is owned by the server. */
class AuthModule {
  constructor() {
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('.toggle-password-btn');
      if (toggle) {
        const input = document.getElementById(toggle.dataset.target);
        if (input) {
          const visible = input.type === 'password';
          input.type = visible ? 'text' : 'password';
          toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
          toggle.setAttribute('aria-pressed', String(visible));
          toggle.innerHTML = `<i data-lucide="${visible ? 'eye-off' : 'eye'}"></i>`;
          app.refreshIcons();
        }
      }
      if (event.target.closest('.trigger-avatar-upload')) {
        document.getElementById('profile-photo-input')?.click();
      }
    });
    document.getElementById('profile-photo-input')?.addEventListener('change', (event) => {
      this.handlePhotoUpload(event.target);
    });
    for (const [id, method] of [
      ['create-account-form', 'handleRegister'],
      ['login-form', 'handleLogin'],
      ['edit-stats-form', 'handleSaveStats']
    ]) {
      document.getElementById(id)?.addEventListener('submit', (event) => {
        event.preventDefault();
        this[method]();
      });
    }
  }

  showError(form, message) {
    let feedback = form.querySelector('.form-feedback');
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.className = 'form-feedback';
      feedback.setAttribute('role', 'alert');
      feedback.tabIndex = -1;
      form.prepend(feedback);
    }
    feedback.textContent = message;
    feedback.hidden = !message;
    if (message) feedback.focus();
  }

  async submit(formId, label, action) {
    const form = document.getElementById(formId);
    const button = form?.querySelector('button[type="submit"]');
    if (!form || !button || button.disabled) return;
    this.showError(form, '');
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = label;
    button.setAttribute('aria-busy', 'true');
    try {
      await action();
    } catch (error) {
      this.showError(form, error.message || 'Something went wrong. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
      button.removeAttribute('aria-busy');
    }
  }

  resetTrainingDrafts() {
    if (typeof gymModule !== 'undefined') {
      gymModule.completedExercises = Object.create(null);
      gymModule.activeExercise = null;
      gymModule.activeSetLogs = [];
      clearInterval(gymModule.restTimerInterval);
    }
    if (typeof drillsModule !== 'undefined') {
      drillsModule.completedDrills = { 'Regular Drill': Object.create(null), 'Contemporary Drill': Object.create(null) };
    }
    if (typeof joggingModule !== 'undefined') joggingModule.resetTimer();
  }

  enterApp(message) {
    this.resetTrainingDrafts();
    this.renderUserProfileCard();
    app.switchScreen('home-screen');
    if (typeof scheduleModule !== 'undefined') scheduleModule.renderAllPanels();
    if (message) app.notify(message, 'success');
  }

  handleRegister() {
    return this.submit('create-account-form', 'Creating your account…', async () => {
      const value = (id) => document.getElementById(id).value.trim();
      const username = value('reg-username');
      const fullName = value('reg-fullname');
      const password = document.getElementById('reg-password').value;
      const confirmation = document.getElementById('reg-confirm-password').value;
      if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
        throw new Error('Use 3–40 letters, numbers, dots, underscores or hyphens for your username.');
      }
      if (fullName.length < 2 || fullName.length > 100) {
        throw new Error('Enter your full name using 2–100 characters.');
      }
      if (password.length < 12 || password.length > 128) throw new Error('Choose a password with 12–128 characters.');
      if (password !== confirmation) throw new Error('The passwords do not match. Please check them.');
      if (!document.getElementById('reg-privacy-consent').checked) {
        throw new Error('Read and accept the privacy notice to continue.');
      }
      await store.registerAccount({
        username,
        fullName,
        email: value('reg-email'),
        contact: value('reg-contact'),
        password,
        rank: value('reg-rank')
      });
      document.getElementById('create-account-form').reset();
      this.enterApp('Your account is ready. Let’s make progress.');
    });
  }

  handleLogin() {
    return this.submit('login-form', 'Signing in…', async () => {
      const identifier = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      if (!identifier || !password) throw new Error('Enter your username or email and password.');
      await store.loginAccount(identifier, password);
      document.getElementById('login-form').reset();
      this.enterApp('Welcome back. Your training is ready.');
    });
  }

  renderUserProfileCard() {
    const user = store.getCurrentUser();
    if (!user) return;
    const name = String(user.FullName || user.Username || 'Athlete');
    const initials = name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const avatar = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(user.Avatar || '')
      ? `<img src="${user.Avatar}" alt="" class="profile-avatar">`
      : `<span class="profile-avatar profile-avatar-initials" aria-hidden="true">${escapeHTML(initials)}</span>`;
    const greeting = document.getElementById('greeting-name');
    if (greeting) greeting.textContent = name.includes(',') ? name.split(',')[1].trim().split(' ')[0] : name.split(' ')[0];

    const today = store.getAttendanceLogs().find((log) => log.MemberID === user.MemberID && log.Date === localDate());
    const banner = document.getElementById('top-attendance-banner');
    if (banner) {
      banner.innerHTML = today
        ? `<div class="top-attendance-status ${today.Status === 'Approved' ? 'status-approved' : 'status-pending'}"><i data-lucide="check-circle-2"></i><span>Checked in today <span class="attendance-time">${escapeHTML(today.Time || '')}</span></span></div>`
        : `<button class="btn top-attendance-btn" onclick="authModule.handleAttendanceCheckin()"><i data-lucide="calendar-check"></i><span>Ready for today? <strong>Check in</strong></span><i data-lucide="arrow-up-right"></i></button>`;
    }

    store.calculateBMI(user);
    const card = document.getElementById('user-profile-card');
    if (card) {
      card.innerHTML = `
        <div class="profile-card-content">
          <button class="profile-avatar-wrapper profile-avatar-button trigger-avatar-upload" aria-label="Change profile photo">
            ${avatar}<span class="avatar-camera-badge"><i data-lucide="camera"></i></span>
          </button>
          <div class="profile-details-block">
            <p class="profile-eyebrow">YOUR ATHLETE PROFILE</p>
            <h2 class="profile-name-text">${escapeHTML(name)}</h2>
            <p class="profile-sub-text">${escapeHTML(user.Rank || 'Rookie')} <span aria-hidden="true">·</span> ${escapeHTML(user.ProgramFocus || 'Whole Body')}</p>
          </div>
          <div class="profile-actions-row">
            <button class="edit-stats-pill-btn" onclick="authModule.openStatsModal()"><i data-lucide="sliders-horizontal"></i> Edit profile</button>
          </div>
        </div>`;
    }
    for (const [id, value] of [
      ['user-weight-display', user.WeightKg ? `${user.WeightKg} kg` : '—'],
      ['user-height-display', user.HeightCm ? `${user.HeightCm} cm` : '—'],
      ['user-bmi-display', user.BMI || '—'],
      ['user-bmi-category', user.BMI ? user.BMICategory : 'Add your measurements']
    ]) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }
    app.refreshIcons();
  }

  openStatsModal() {
    const user = store.getCurrentUser();
    if (!user) return;
    document.getElementById('edit-weight-input').value = user.WeightKg || '';
    document.getElementById('edit-height-input').value = user.HeightCm || '';
    document.getElementById('edit-program-input').value = user.ProgramFocus || 'Whole Body';
    this.showError(document.getElementById('edit-stats-form'), '');
    app.openModal('edit-stats-modal');
  }

  handleSaveStats() {
    return this.submit('edit-stats-form', 'Saving…', async () => {
      const user = store.getCurrentUser();
      if (!user) throw new Error('Sign in to update your profile.');
      const weight = Number(document.getElementById('edit-weight-input').value);
      const height = Number(document.getElementById('edit-height-input').value);
      if (!Number.isFinite(weight) || weight < 20 || weight > 350) throw new Error('Enter a weight between 20 and 350 kg.');
      if (!Number.isFinite(height) || height < 100 || height > 250) throw new Error('Enter a height between 100 and 250 cm.');
      const oldWeight = Number(user.WeightKg);
      user.WeightKg = Math.round(weight * 10) / 10;
      user.HeightCm = Math.round(height * 10) / 10;
      user.ProgramFocus = document.getElementById('edit-program-input').value;
      store.calculateBMI(user);
      store.saveMember(user);
      if (oldWeight !== user.WeightKg) store.addWeightLog(user.MemberID, user.WeightKg, localDate());
      await store.flush();
      this.renderUserProfileCard();
      app.closeModal('edit-stats-modal');
      if (typeof weightModule !== 'undefined') weightModule.renderWeightChart();
      app.notify('Your profile has been updated.', 'success');
    });
  }

  async handleAttendanceCheckin() {
    const user = store.getCurrentUser();
    if (!user) return;
    const button = document.querySelector('.top-attendance-btn');
    if (button) button.disabled = true;
    try {
      store.addAttendanceLog(user.MemberID);
      await store.flush();
      this.renderUserProfileCard();
      app.notify('You’re checked in for today. Have a great session!', 'success');
    } catch (error) {
      app.notify(error.message || 'Check-in could not be saved. Please try again.', 'error');
      if (button) button.disabled = false;
    }
  }

  async handlePhotoUpload(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      app.notify('Choose a JPG, PNG or WebP image smaller than 5 MB.', 'error');
      return;
    }
    let image;
    try {
      image = await createImageBitmap(file);
      if (!image.width || !image.height) throw new Error('Invalid image');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const size = Math.min(image.width, image.height);
      canvas.getContext('2d').drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
      const avatar = canvas.toDataURL('image/jpeg', 0.82);
      if (avatar.length > 250 * 1024) throw new Error('The image is too large after resizing. Try a different photo.');
      const user = store.getCurrentUser();
      if (!user) return;
      user.Avatar = avatar;
      store.saveMember(user);
      await store.flush();
      this.renderUserProfileCard();
      app.notify('Profile photo updated.', 'success');
    } catch (error) {
      app.notify(error.message || 'This photo could not be saved. Try a different image.', 'error');
    } finally {
      image?.close();
    }
  }

  async logout() {
    try {
      await store.logoutAccount();
      this.resetTrainingDrafts();
      document.querySelectorAll('.modal-overlay.active').forEach(modal => app.closeModal(modal.id));
      app.switchScreen('welcome-screen');
      app.notify('You’ve signed out safely.', 'success');
    } catch (error) {
      app.notify(error.message || 'We could not sign you out. Please try again.', 'error');
    }
  }
}

const authModule = new AuthModule();

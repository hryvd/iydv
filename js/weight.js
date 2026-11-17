/* ==========================================================================
   IYDV ONEUP - Daily Weight Tracker & Canvas Trend Chart
   ========================================================================== */

class WeightModule {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    window.addEventListener('resize', () => {
      if (document.getElementById('progress-weight-view')?.offsetParent) this.renderWeightChart();
    });
  }

  bindEvents() {
    // Weight Form Submit
    const weightForm = document.getElementById('save-weight-form');
    if (weightForm) {
      weightForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveWeight();
      });
    }
  }

  openWeightModal() {
    const todayStr = localDate();
    const user = store.getCurrentUser();
    
    if (!user) return;
    document.getElementById('weight-date-input').value = todayStr;
    document.getElementById('weight-date-input').max = todayStr;
    document.getElementById('weight-kg-input').value = user.WeightKg || '';
    
    app.openModal('weight-update-modal');
  }

  handleSaveWeight() {
    const user = store.getCurrentUser();
    if (!user) return;
    const dateStr = document.getElementById('weight-date-input').value;
    const weightKg = parseFloat(document.getElementById('weight-kg-input').value);

    if (!dateStr || !Number.isFinite(Date.parse(dateStr)) || dateStr > localDate()) {
      app.notify('Choose today or an earlier date.', 'error');
      return;
    }

    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 350) {
      app.notify('Enter a weight between 20 and 350 kg.', 'error');
      return;
    }

    const newLog = store.addWeightLog(user.MemberID, weightKg, dateStr);
    
    // Update Auth Card UI
    authModule.renderUserProfileCard();
    
    // Update Weight Screen UI
    this.renderWeightLogsHistory();
    this.renderWeightChart();

    app.closeModal('weight-update-modal');
    app.notify(`Weight logged: ${weightKg} kg.`, 'success');
  }

  renderWeightLogsHistory() {
    const container = document.getElementById('weight-history-list');
    if (!container) return;

    const user = store.getCurrentUser();
    if (!user) return;
    const logs = store.getWeightLogs(user.MemberID)
      .sort((a,b) => new Date(b.Date) - new Date(a.Date)); // Newest first

    if (logs.length === 0) {
      container.innerHTML = `<div class="text-center" style="color:var(--text-muted); padding:16px;">No weight entries recorded yet.</div>`;
      return;
    }

    container.innerHTML = logs.map(l => {
      let deltaBadge = '';
      if (l.ChangeKg > 0) {
        deltaBadge = `<span class="badge badge-warning">▲ +${escapeHTML(l.ChangeKg)} kg</span>`;
      } else if (l.ChangeKg < 0) {
        deltaBadge = `<span class="badge badge-primary">▼ ${escapeHTML(l.ChangeKg)} kg</span>`;
      } else {
        deltaBadge = `<span class="badge badge-primary">0 kg</span>`;
      }

      return `
        <div class="list-item">
          <div>
            <div class="list-title">${escapeHTML(l.WeightKg)} kg</div>
            <div class="list-subtitle">${escapeHTML(l.Date)}</div>
          </div>
          <div>${deltaBadge}</div>
        </div>
      `;
    }).join('');
  }

  renderWeightChart() {
    const canvas = document.getElementById('weightTrendCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const user = store.getCurrentUser();
    if (!user) return;
    let logs = store.getWeightLogs(user.MemberID)
      .sort((a,b) => new Date(a.Date) - new Date(b.Date)); // Chronological

    // Set high-DPI canvas scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const width = rect.width;
    const height = rect.height;
    const padding = 35;

    ctx.clearRect(0, 0, width, height);
    const theme = getComputedStyle(canvas);
    const labelColor = theme.getPropertyValue('--text-secondary').trim() || '#a8ba9b';
    const gridColor = theme.getPropertyValue('--separator').trim() || '#354332';
    if (!logs.length) {
      ctx.fillStyle = labelColor;
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Log your weight to start your trend.', width / 2, height / 2);
      canvas.setAttribute('aria-label', 'No weight entries yet. Log your weight to start your trend.');
      return;
    }
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Weight trend: ${logs.length} entries, latest ${logs[logs.length - 1].WeightKg} kilograms. Details are listed below.`);

    // Find range
    const weights = logs.map(l => l.WeightKg);
    const minW = Math.floor(Math.min(...weights) - 1);
    const maxW = Math.ceil(Math.max(...weights) + 1);
    const range = maxW - minW || 1;

    // Draw background grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const y = padding + (height - 2 * padding) * (i / 3);
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);

      const val = (maxW - (i / 3) * range).toFixed(1);
      ctx.fillStyle = labelColor;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`${val}kg`, 5, y + 3);
    }
    ctx.stroke();

    // Map points
    const points = logs.map((l, index) => {
      const x = padding + (width - 2 * padding) * (logs.length === 1 ? 0.5 : index / (logs.length - 1));
      const y = height - padding - ((l.WeightKg - minW) / range) * (height - 2 * padding);
      return { x, y, weight: l.WeightKg, date: l.Date };
    });

    // Draw Gradient Area under curve
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, 'rgba(255, 107, 53, 0.35)');
    gradient.addColorStop(1, 'rgba(255, 107, 53, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, height - padding);
    ctx.lineTo(points[0].x, height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Trend Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw Points & Labels
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff6b35';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label value
      ctx.fillStyle = labelColor;
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.weight}`, p.x, p.y - 10);
    });
  }
}

const weightModule = new WeightModule();

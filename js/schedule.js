/* ==========================================================================
   IYDV ONEUP - Training Schedule Module
   Displays the next upcoming training in a compact panel across all views.
   ========================================================================== */

class ScheduleModule {
  constructor() {}

  /**
   * Render the schedule panel into a given container element.
   * @param {string} containerId - ID of the container div
   */
  renderSchedulePanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const next = store.getUpcomingSchedule();

    if (!next) {
      container.innerHTML = `
        <div class="schedule-panel">
          <div class="schedule-panel-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            NEXT TRAINING
          </div>
          <div class="schedule-panel-empty">No upcoming training session scheduled.</div>
        </div>
      `;
      return;
    }

    const dateObj = new Date(next.Date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dateObj - today) / (1000 * 60 * 60 * 24));

    let dayLabel = '';
    if (diffDays === 0) dayLabel = '<span style="color:var(--orange);font-weight:800;">TODAY</span>';
    else if (diffDays === 1) dayLabel = '<span style="color:var(--orange);font-weight:800;">TOMORROW</span>';
    else dayLabel = `<span style="color:var(--text-secondary);">in ${diffDays} day${diffDays !== 1 ? 's' : ''}</span>`;

    const formattedDate = dateObj.toLocaleDateString('en-PH', {
      weekday: 'short', month: 'short', day: 'numeric'
    });

    const whoArr = Array.isArray(next.WhoNeeded) ? next.WhoNeeded : (next.WhoNeeded || 'All').split(',');
    const whoText = whoArr.join(', ');

    container.innerHTML = `
      <div class="schedule-panel">
        <div class="schedule-panel-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          NEXT TRAINING &nbsp;·&nbsp; ${dayLabel}
        </div>
        <div class="schedule-panel-name">${this._esc(next.SessionName)}</div>
        <div class="schedule-panel-meta">
          <span class="schedule-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${formattedDate}
          </span>
          ${next.CallTime ? `
          <span class="schedule-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Call: ${next.CallTime}
          </span>` : ''}
          ${next.Venue ? `
          <span class="schedule-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${this._esc(next.Venue)}
          </span>` : ''}
        </div>
        ${whoText ? `<div class="schedule-panel-who">👥 Required: ${this._esc(whoText)}</div>` : ''}
        ${next.Notes ? `<div style="margin-top:5px; font-size:0.65rem; color:var(--text-tertiary); font-style:italic;">${this._esc(next.Notes)}</div>` : ''}
      </div>
    `;
  }

  renderAllPanels() {
    this.renderSchedulePanel('schedule-panel-home');
    this.renderSchedulePanel('schedule-panel-gym');
    this.renderSchedulePanel('schedule-panel-goals');
    this.renderSchedulePanel('schedule-panel-dashboard');
  }

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

const scheduleModule = new ScheduleModule();

import sys

css_code = """
/* ═══════════════════════════════════════════════════════════════════
   Calendar Premium UI V3
   ═══════════════════════════════════════════════════════════════════ */
.cal-page-premium {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 24px;
  animation: fadeIn 0.4s ease;
}

.cal-header-premium {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cal-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cal-title-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), #8b5cf6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(0, 153, 255, 0.25);
}

.cal-title-wrapper h1 {
  font-family: var(--f-display);
  font-size: 24px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
}

.cal-title-wrapper p {
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
}

.cal-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cal-warn-btn {
  color: #f59e0b !important;
  border-color: rgba(245, 158, 11, 0.3) !important;
}
.cal-warn-btn:hover {
  background: rgba(245, 158, 11, 0.1) !important;
}

.cal-new-btn {
  background: linear-gradient(135deg, var(--accent), #3b82f6) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(0, 153, 255, 0.3) !important;
  color: white !important;
}
.cal-new-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

.cal-filter-bar-premium {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid var(--border-2);
}

.cal-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.cal-filter-pill:hover {
  background: var(--bg-3);
  transform: translateY(-1px);
}

.cal-filter-pill.active {
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--theme-color);
  color: var(--text-1);
  box-shadow: 0 0 0 1px var(--theme-color);
}
[data-theme="light"] .cal-filter-pill.active {
  background: rgba(0, 0, 0, 0.03);
}

.cal-filter-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-4);
  color: var(--bg-1);
  transition: all 0.2s ease;
}

.cal-filter-pill.active .cal-filter-indicator {
  background: var(--theme-color);
  color: #fff;
}

.cal-filter-count-badge {
  font-family: var(--f-mono);
  font-size: 11px;
  background: var(--bg-4);
  padding: 2px 6px;
  border-radius: 10px;
  color: var(--text-3);
}
.cal-filter-pill.active .cal-filter-count-badge {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-1);
}
[data-theme="light"] .cal-filter-pill.active .cal-filter-count-badge {
  background: rgba(0, 0, 0, 0.05);
}

.cal-layout-premium {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  align-items: start;
}
@media (max-width: 1000px) {
  .cal-layout-premium { grid-template-columns: 1fr; }
}

.cal-main-premium {
  position: relative;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.02);
  min-height: 600px;
}

.cal-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 10;
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.cal-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.cal-sidebar-premium {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 120px);
}

.cal-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-2);
}

.cal-sidebar-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
}

.cal-upcoming-count {
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-3);
  padding: 2px 8px;
  border-radius: 12px;
}

.cal-agenda-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
}

.cal-agenda-container::-webkit-scrollbar { width: 4px; }
.cal-agenda-container::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 4px; }

.cal-agenda-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--text-4);
}

.cal-agenda-card {
  position: relative;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.cal-agenda-glow {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  opacity: 0.8;
  transition: width 0.2s ease;
}

.cal-agenda-card:hover {
  background: var(--bg-3);
  transform: translateX(4px);
  border-color: var(--border);
}

.cal-agenda-card:hover .cal-agenda-glow {
  width: 6px;
}

.cal-agenda-card-content {
  display: flex;
  gap: 16px;
  margin-left: 8px;
}

.cal-agenda-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-1);
  border-radius: 8px;
  padding: 8px;
  min-width: 52px;
  border: 1px solid var(--border-2);
}

.cal-agenda-day {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1;
}

.cal-agenda-month {
  font-size: 11px;
  color: var(--text-3);
  text-transform: uppercase;
  margin-top: 4px;
  font-weight: 600;
}

.cal-agenda-details {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.cal-agenda-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cal-agenda-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.cal-agenda-source {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cal-agenda-hour {
  color: var(--text-3);
  font-family: var(--f-mono);
}

/* FullCalendar Theming for Premium UI */
.cal-main-premium .fc {
  --fc-border-color: var(--border-2);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: var(--bg-2);
  --fc-today-bg-color: rgba(0, 153, 255, 0.04);
  --fc-now-indicator-color: var(--accent);
  color: var(--text-1);
}

.cal-main-premium .fc .fc-toolbar.fc-header-toolbar {
  margin-bottom: 24px;
}

.cal-main-premium .fc .fc-toolbar-title {
  font-family: var(--f-display);
  font-size: 20px;
  font-weight: 700;
}

.cal-main-premium .fc .fc-button {
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  color: var(--text-2);
  text-transform: capitalize;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  transition: all 0.2s;
}

.cal-main-premium .fc .fc-button:hover {
  background: var(--bg-3);
  color: var(--text-1);
  transform: translateY(-1px);
}

.cal-main-premium .fc .fc-button-primary:not(:disabled).fc-button-active,
.cal-main-premium .fc .fc-button-primary:not(:disabled):active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 153, 255, 0.2);
}

.cal-main-premium .fc .fc-button-group > .fc-button { border-radius: 0; }
.cal-main-premium .fc .fc-button-group > .fc-button:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
.cal-main-premium .fc .fc-button-group > .fc-button:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }

.cal-main-premium .fc-theme-standard td, 
.cal-main-premium .fc-theme-standard th {
  border-color: var(--border-2);
}

.cal-main-premium .fc-theme-standard .fc-scrollgrid {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.cal-main-premium .fc .fc-col-header-cell-cushion {
  padding: 12px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cal-main-premium .fc .fc-daygrid-day-number {
  font-size: 13px;
  padding: 8px;
  color: var(--text-2);
  font-weight: 500;
}

.cal-main-premium .fc .fc-day-today .fc-daygrid-day-number {
  background: var(--accent);
  color: white;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 4px;
}

.cal-main-premium .fc .fc-daygrid-day.fc-day-other {
  background: rgba(0, 0, 0, 0.1);
}
[data-theme="light"] .cal-main-premium .fc .fc-daygrid-day.fc-day-other {
  background: rgba(0, 0, 0, 0.02);
}

.cal-main-premium .fc .fc-event,
.cal-main-premium .fc .fc-daygrid-event {
  border-radius: 6px;
  border: none;
  padding: 2px;
  margin: 2px 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: transform 0.1s;
}

.cal-main-premium .fc .fc-event:hover {
  transform: scale(1.02);
  filter: brightness(1.1);
}

.cal-ev-premium {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
}

.cal-ev-premium-stripe {
  width: 4px;
  height: 14px;
  border-radius: 4px;
  flex: none;
}

.cal-ev-premium-label {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-1);
}

.cal-ev-premium-time {
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--f-mono);
  margin-left: auto;
  padding-left: 4px;
}

"""

with open('src/styles/global.css', 'a') as f:
    f.write(css_code)

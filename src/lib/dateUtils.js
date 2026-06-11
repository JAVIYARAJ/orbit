// dateUtils.js — Centralized date & time formatting for the Orbit platform.
//
// Single source of truth: change the locale / options here and the format
// propagates everywhere in the app automatically.
//
// Naming convention
// ─────────────────
//  fmtDate        → "Jun 11, 2026"          (short month, day, year)
//  fmtDateLong    → "June 11, 2026"          (long month, day, year)
//  fmtDateShort   → "Jun 11"                 (short month + day only, no year)
//  fmtDateCompact → "Jun 2026"               (month + year only, for chart axes)
//  fmtMonthLong   → "June 2026"              (long month + year, for calendar titles)
//  fmtDateTime    → "Jun 11, 2026, 2:30 PM"  (date + time, 12-hour)
//  fmtDateTimeInt → "Jun 11, 2026 · 14:30"   (date + 24-hour time for integrations)
//  fmtTime        → "14:30"                  (24-hour HH:MM)
//  fmtTime12      → "2:30 PM"                (12-hour with AM/PM)
//  fmtDayNum      → "11"                     (day number only)
//  fmtMonthShort  → "Jun"                    (3-letter month abbreviation)
//  fmtWeekday     → "Wednesday"              (full weekday name)
//  fmtWeekdayShort → "Wed"                   (short weekday)
//  fmtRelative    → "just now" / "2h ago" / "Mon" / "Jun 11, 2026"
//  fmtWelcome     → "Wednesday, June 11"     (home page greeting line)

const LOCALE = 'en-US';

// ─── Guard ───────────────────────────────────────────────────────────
// Accepts an ISO string, Date object, Unix ms, or YYYY-MM-DD.
// Returns a valid Date, or null if the input is falsy / invalid.
const toDate = (value) => {
  if (!value || value === '—') return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

// ─── Date-only formatters ─────────────────────────────────────────

/** "Jun 11, 2026" */
export const fmtDate = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
};

/** "June 11, 2026" */
export const fmtDateLong = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { month: 'long', day: 'numeric', year: 'numeric' });
};

/** "Jun 11"  (no year — compact lists, chart ticks) */
export const fmtDateShort = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
};

/** "Jun 2026"  (month + year only — analytics axis labels) */
export const fmtDateCompact = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });
};

/** "June 2026"  (calendar mini-header, full month name) */
export const fmtMonthLong = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
};

// ─── Date + time formatters ───────────────────────────────────────

/** "Jun 11, 2026, 2:30 PM"  (general purpose datetime) */
export const fmtDateTime = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** "Jun 11, 2026 · 14:30"  (integration connected-at labels) */
export const fmtDateTimeInt = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  const date = d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
};

// ─── Time-only formatters ─────────────────────────────────────────

/** "14:30"  (24-hour, timer event log) */
export const fmtTime = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
};

/** "2:30 PM"  (12-hour, calendar agenda) */
export const fmtTime12 = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
};

// ─── Partial formatters (for calendar grid cells) ────────────────

/** "11"  (day-of-month digit) */
export const fmtDayNum = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString(LOCALE, { day: 'numeric' });
};

/** "Jun"  (3-letter month abbreviation) */
export const fmtMonthShort = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString(LOCALE, { month: 'short' });
};

/** "Wednesday"  (full weekday name) */
export const fmtWeekday = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString(LOCALE, { weekday: 'long' });
};

/** "Wed"  (short weekday name, for timer history group headers) */
export const fmtWeekdayShort = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString(LOCALE, { weekday: 'short' });
};

// ─── Welcome / greeting line ─────────────────────────────────────

/** "Wednesday, June 11"  (Home page header date string) */
export const fmtWelcome = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString(LOCALE, { weekday: 'long', month: 'long', day: 'numeric' });
};

// ─── Relative time ────────────────────────────────────────────────

/**
 * Returns a human-friendly relative string:
 *   < 1 min  → "just now"
 *   < 60 min → "5m ago"
 *   < 24 h   → "3h ago"
 *   < 7 days → day name ("Mon")
 *   else     → fmtDate
 */
export const fmtRelative = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(LOCALE, { weekday: 'short' });
  return fmtDate(d);
};

/**
 * fmtRelativeNotif — slightly tighter variant used in notification panels:
 *   < 2 min  → "just now"
 *   < 60 min → "5m ago"
 *   < 24 h   → "3h ago"
 *   < 30 d   → "12d ago"
 *   else     → fmtDate
 */
export const fmtRelativeNotif = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
};

// ─── Timer group title helper ────────────────────────────────────

/**
 * Given a YYYY-MM-DD string (from time entry grouping),
 * returns "Today", "Yesterday", or a formatted date.
 */
export const fmtTimerGroupTitle = (dateStr) => {
  if (!dateStr || dateStr === 'unknown') return 'Unknown Date';
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const parsed = toDate(dateStr);
  if (!parsed) return dateStr;
  return parsed.toLocaleDateString(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

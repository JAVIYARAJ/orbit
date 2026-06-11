// RRULE helpers for native calendar events. We keep recurrence as a standard
// RRULE string (no DTSTART) so it maps 1:1 to Google's `recurrence` field and to
// FullCalendar's rrule plugin. Only the preset shapes the UI offers are produced.
//
// A rule is composed of two independent parts:
//   • the repeat pattern  (FREQ / INTERVAL / BYDAY) — from the preset or Custom form
//   • the end condition   (UNTIL / COUNT)           — shared "Repeat ends" control

import { fmtDate } from './dateUtils.js';

const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; // JS getDay() order
const DOW_LABEL = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };
const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR'];

const pad = (n) => String(n).padStart(2, '0');
export const weekdayCode = (date) => DOW[new Date(date).getDay()];

const getToken = (rule, key) => (rule ? (new RegExp(`${key}=([^;]+)`).exec(rule)?.[1] ?? null) : null);
const untilStamp = (ymd) => `${ymd.replace(/-/g, '')}T235959Z`;

// ── Repeat pattern (no end) ──────────────────────────────────────────
export function buildPresetRule(preset, startDate) {
  const wd = weekdayCode(startDate);
  switch (preset) {
    case 'DAILY':    return 'FREQ=DAILY';
    case 'WEEKDAYS': return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'WEEKLY':   return `FREQ=WEEKLY;BYDAY=${wd}`;
    case 'BIWEEKLY': return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${wd}`;
    case 'MONTHLY':  return 'FREQ=MONTHLY';
    case 'YEARLY':   return 'FREQ=YEARLY';
    default:         return null;
  }
}

export function buildCustomRule({ freq, interval = 1, byweekday = [] }) {
  const parts = [`FREQ=${freq}`];
  if (Number(interval) > 1) parts.push(`INTERVAL=${Number(interval)}`);
  if (freq === 'WEEKLY' && byweekday.length) parts.push(`BYDAY=${byweekday.join(',')}`);
  return parts.join(';');
}

// ── End condition (shared) ───────────────────────────────────────────
function withEnd(base, end) {
  if (!base || !end) return base;
  if (end.type === 'until' && end.until) return `${base};UNTIL=${untilStamp(end.until)}`;
  if (end.type === 'count' && Number(end.count) > 0) return `${base};COUNT=${Number(end.count)}`;
  return base;
}

// Compose the final rule from the modal's pieces.
export function composeRule(repeat, custom, end, startISO) {
  if (!repeat || repeat === 'NONE') return null;
  const base = repeat === 'CUSTOM' ? buildCustomRule(custom) : buildPresetRule(repeat, startISO);
  return withEnd(base, end);
}

// ── Parse an existing rule back into the modal's pieces ──────────────
export function detectPreset(rule, startDate) {
  if (!rule) return 'NONE';
  const freq = getToken(rule, 'FREQ');
  const interval = Number(getToken(rule, 'INTERVAL') || 1);
  const byday = (getToken(rule, 'BYDAY') || '').split(',').filter(Boolean);
  const wd = weekdayCode(startDate);
  // End (UNTIL/COUNT) is ignored here — presets can still have an end.
  if (freq === 'DAILY' && interval === 1) return 'DAILY';
  if (freq === 'WEEKLY' && interval === 1 && byday.length === 5 && WEEKDAYS.every(d => byday.includes(d))) return 'WEEKDAYS';
  if (freq === 'WEEKLY' && interval === 1 && byday.length === 1 && byday[0] === wd) return 'WEEKLY';
  if (freq === 'WEEKLY' && interval === 2 && byday.length === 1 && byday[0] === wd) return 'BIWEEKLY';
  if (freq === 'MONTHLY' && interval === 1) return 'MONTHLY';
  if (freq === 'YEARLY' && interval === 1) return 'YEARLY';
  return 'CUSTOM';
}

export function parseCustom(rule) {
  return {
    freq: getToken(rule, 'FREQ') || 'WEEKLY',
    interval: Number(getToken(rule, 'INTERVAL') || 1),
    byweekday: (getToken(rule, 'BYDAY') || '').split(',').filter(Boolean),
  };
}

export function parseEnd(rule) {
  const until = getToken(rule, 'UNTIL');
  const count = getToken(rule, 'COUNT');
  return {
    type: until ? 'until' : count ? 'count' : 'never',
    until: until ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` : '',
    count: count || '',
  };
}

// ── Human summary (badge / detail / hint) ────────────────────────────
export function summarizeRule(rule) {
  if (!rule) return '';
  const freq = getToken(rule, 'FREQ');
  const interval = Number(getToken(rule, 'INTERVAL') || 1);
  const byday = (getToken(rule, 'BYDAY') || '').split(',').filter(Boolean);
  const until = getToken(rule, 'UNTIL');
  const count = getToken(rule, 'COUNT');

  let base;
  if (freq === 'WEEKLY' && byday.length === 5 && WEEKDAYS.every(d => byday.includes(d))) {
    base = 'Every weekday';
  } else if (freq === 'DAILY') {
    base = interval > 1 ? `Every ${interval} days` : 'Daily';
  } else if (freq === 'WEEKLY') {
    const days = byday.length ? ' on ' + byday.map(d => DOW_LABEL[d]).join(', ') : '';
    base = (interval > 1 ? `Every ${interval} weeks` : 'Weekly') + days;
  } else if (freq === 'MONTHLY') {
    base = interval > 1 ? `Every ${interval} months` : 'Monthly';
  } else if (freq === 'YEARLY') {
    base = interval > 1 ? `Every ${interval} years` : 'Yearly';
  } else {
    base = 'Repeats';
  }

  if (until) {
    const d = new Date(`${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}T00:00:00`);
    base += ` until ${fmtDate(d)}`;
  } else if (count) {
    base += `, ${count}×`;
  }
  return base;
}

// ── FullCalendar event props for a recurring master ──────────────────
const icsDateTime = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const icsDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

export function rruleEventProps(start, end, allDay, rule) {
  const dt = allDay ? icsDate(start) : icsDateTime(start);
  const ms = Math.max(0, new Date(end || start).getTime() - new Date(start).getTime());
  const duration = allDay
    ? { days: Math.max(1, Math.round(ms / 86400000) || 1) }
    : { minutes: Math.max(15, Math.round(ms / 60000) || 60) };
  return { rrule: `DTSTART:${dt}\nRRULE:${rule}`, duration };
}

export const REPEAT_OPTIONS = [
  { value: 'NONE',     label: 'Does not repeat' },
  { value: 'DAILY',    label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Every weekday (Mon–Fri)' },
  { value: 'WEEKLY',   label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every 2 weeks' },
  { value: 'MONTHLY',  label: 'Monthly' },
  { value: 'YEARLY',   label: 'Yearly' },
  { value: 'CUSTOM',   label: 'Custom…' },
];

export const WEEKDAY_PICKER = [
  { code: 'MO', label: 'M' }, { code: 'TU', label: 'T' }, { code: 'WE', label: 'W' },
  { code: 'TH', label: 'T' }, { code: 'FR', label: 'F' }, { code: 'SA', label: 'S' }, { code: 'SU', label: 'S' },
];

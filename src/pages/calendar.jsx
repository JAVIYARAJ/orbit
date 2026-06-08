import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';
import {
  loadCalendarWindow, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, updateTask,
} from '../lib/db.js';
import { gcalSync } from '../lib/googleCalendar.js';
import { canDo } from '../lib/permissions.js';
import {
  REPEAT_OPTIONS, WEEKDAY_PICKER, composeRule,
  detectPreset, parseCustom, parseEnd, summarizeRule, rruleEventProps,
} from '../lib/recurrence.js';

const blankCustomRecur = () => ({ freq: 'WEEKLY', interval: 1, byweekday: [] });
const blankRecurEnd = () => ({ type: 'never', until: '', count: '' });

// Source colours (aligned with the app's design tokens)
const SOURCE_COLOR = {
  event: '#0099ff', // native Orbit events  (accent)
  task: '#f59e0b', // task due dates        (amber)
  project: '#8b5cf6', // project timelines     (violet)
  google: '#22c55e', // Google Calendar       (green)
};
const SOURCE_LABEL = { event: 'Events', task: 'Tasks', project: 'Projects', google: 'Google' };

const hexToRgba = (hex, a) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
};

// datetime-local <-> ISO helpers (operate in the user's local timezone)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const addDayStr = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const nowRoundedISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  return d.toISOString();
};

const blankDraft = () => ({
  id: null, title: '', description: '', location: '',
  allDay: false, start: '', end: '', projectId: '', color: '', remindMinutes: '',
  repeat: 'NONE', custom: { freq: 'WEEKLY', interval: 1, byweekday: [] }, recurEnd: { type: 'never', until: '', count: '' },
});

const REMINDER_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At start time' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

const relTime = (ts) => {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const dateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

export function CalendarPage({ workstationId, projects = [], priorities = [], tasks = [], setTasks, statuses = [], onNav, onJump, myRole, wsPermissions }) {
  // Whether this member may create/edit/delete native calendar events.
  const canManage = canDo(myRole, 'manage_calendar', wsPermissions);
  // Dragging a task on the calendar reschedules its due date — gated by edit_task.
  const canEditTask = canDo(myRole, 'edit_task', wsPermissions);
  const windowWidth = useWindowWidth();
  const [connected, setConnected] = useState(null);   // null = unknown
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reconnect, setReconnect] = useState(false);
  const [data, setData] = useState({ events: [], google: [], tasks: [], projects: [] });
  const [range, setRange] = useState(null);
  const [enabled, setEnabled] = useState({ event: true, task: true, project: false, google: true });
  const [currentView, setCurrentView] = useState('dayGridMonth');
  // Personal view prefs (per-browser, like the app's other UI prefs).
  const [density, setDensity] = useState(() => localStorage.getItem('orbit:cal:density') || 'comfortable');
  const [showWeekends, setShowWeekends] = useState(() => localStorage.getItem('orbit:cal:weekends') !== 'false');

  const [draft, setDraft] = useState(null);   // create/edit native event modal
  const [detail, setDetail] = useState(null);   // read-only detail modal
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const doneStatusIds = useMemo(
    () => new Set(statuses.filter(s => s.isDone).map(s => s.id)),
    [statuses],
  );

  const calRef = useRef(null);
  const syncedOnce = useRef(false);
  const inFlight = useRef(false);

  const priColor = useMemo(() => {
    const m = {};
    priorities.forEach(p => { m[p.id] = p.color; });
    return m;
  }, [priorities]);

  // ── Connection status (workspace-shared Google Calendar) ───────────
  useEffect(() => {
    if (!workstationId) return;
    setConnected(null);
    supabase.from('workspace_integrations')
      .select('provider')
      .eq('workstation_id', workstationId)
      .eq('provider', 'google_calendar')
      .maybeSingle()
      .then(({ data }) => setConnected(!!data))
      .catch(() => setConnected(false));
  }, [workstationId]);

  const reload = useCallback(async (r = range) => {
    if (!workstationId || !r) return;
    setLoading(true);
    try {
      const d = await loadCalendarWindow(workstationId, r.start, r.end);
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [workstationId, range]);

  const runSync = useCallback(async () => {
    if (!workstationId || inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    setReconnect(false);
    try {
      await gcalSync();
      await reload();
      setLastSyncedAt(Date.now());
    } catch (e) {
      if (String(e.message) === '__RECONNECT__') setReconnect(true);
      else console.error(e);
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [workstationId, reload]);

  useEffect(() => {
    if (!range) return;
    reload(range);
    if (connected && !syncedOnce.current) {
      syncedOnce.current = true;
      runSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, connected]);

  // ── Normalise every source into one list ───────────────────────────
  const items = useMemo(() => {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const e of data.events) {
      out.push({
        key: `event:${e.id}`, source: 'event', title: e.title,
        start: e.start, end: e.end, allDay: e.allDay, recurrenceRule: e.recurrenceRule || null,
        color: e.color || SOURCE_COLOR.event, editable: true, raw: e
      });
    }
    for (const t of data.tasks) {
      const done = doneStatusIds.has(t.status_id);
      const overdue = !done && t.due_date && new Date(t.due_date) < today;
      out.push({
        key: `task:${t.task_id}`, source: 'task', title: t.title,
        start: t.due_date, end: undefined, allDay: true, done, overdue,
        color: priColor[t.priority_id] || SOURCE_COLOR.task, editable: canEditTask, raw: t
      });
    }
    for (const p of data.projects) {
      out.push({
        key: `project:${p.short_id}`, source: 'project', title: p.name,
        start: p.start_date, end: p.end_date ? addDayStr(p.end_date) : undefined, allDay: true,
        color: SOURCE_COLOR.project, editable: false, raw: p
      });
    }
    for (const g of data.google) {
      out.push({
        key: `google:${g.google_event_id}`, source: 'google', title: g.summary || '(no title)',
        start: g.starts_at, end: g.ends_at, allDay: g.all_day,
        color: SOURCE_COLOR.google, editable: false, raw: g
      });
    }
    return out;
  }, [data, priColor, canEditTask, doneStatusIds]);

  // Dates (in the current data window) that have at least one enabled item — for mini-month dots.
  const markedDates = useMemo(() => {
    const s = new Set();
    items.forEach(i => { if (enabled[i.source] && i.start) s.add(dateKey(i.start)); });
    return s;
  }, [items, enabled]);

  const counts = useMemo(() => {
    const c = { event: 0, task: 0, project: 0, google: 0 };
    items.forEach(i => { c[i.source]++; });
    return c;
  }, [items]);

  const fcEvents = useMemo(() => items.filter(i => enabled[i.source]).map(i => {
    const recurring = !!i.recurrenceRule;
    const base = {
      id: i.key, title: i.title, allDay: i.allDay,
      backgroundColor: i.color, borderColor: i.color, textColor: '#ffffff',
      editable: i.editable && !recurring,                 // recurring series: edit via modal, not drag
      durationEditable: i.source === 'event' && !recurring,
      extendedProps: { source: i.source, stripe: i.color, raw: i.raw, overdue: !!i.overdue, done: !!i.done, recurring },
    };
    if (recurring) {
      const { rrule, duration } = rruleEventProps(i.start, i.end, i.allDay, i.recurrenceRule);
      return { ...base, rrule, duration };
    }
    return { ...base, start: i.start, end: i.end };
  }), [items, enabled]);

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return items
      .filter(i => enabled[i.source] && i.start && new Date(i.start) >= today)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 10);
  }, [items, enabled]);

  // Busy overlay: background events from Google meetings in time-grid views only.
  // Background events dim the time cell so users see conflicts before scheduling.
  const isTimeGrid = currentView === 'timeGridWeek' || currentView === 'timeGridDay';
  const busyOverlays = useMemo(() => {
    if (!isTimeGrid || !enabled.google) return [];
    return data.google
      .filter(g => !g.all_day && g.starts_at && g.ends_at)
      .map(g => ({
        id: `busy:${g.google_event_id}`,
        start: g.starts_at,
        end: g.ends_at,
        display: 'background',
        color: SOURCE_COLOR.google,
        classNames: ['cal-busy-overlay'],
      }));
  }, [data.google, enabled.google, isTimeGrid]);

  const allFcEvents = useMemo(() => [...fcEvents, ...busyOverlays], [fcEvents, busyOverlays]);

  // ── Interaction handlers ───────────────────────────────────────────
  const handleDatesSet = (arg) => {
    setRange({ start: arg.start.toISOString(), end: arg.end.toISOString() });
    setCurrentView(arg.view.type);
  };

  const openCreate = (start, end, allDay) => {
    if (!canManage) return;
    setModalErr('');
    if (allDay) {
      setDraft({
        ...blankDraft(), allDay: true,
        start: toDateInput(start), end: toDateInput(end || start)
      });
      return;
    }
    // Timed: default to a 1-hour block when only a single slot/point was given.
    const sd = new Date(start);
    let ed = end ? new Date(end) : new Date(sd.getTime() + 3600000);
    if (ed <= sd) ed = new Date(sd.getTime() + 3600000);
    setDraft({
      ...blankDraft(), allDay: false,
      start: toLocalInput(sd.toISOString()), end: toLocalInput(ed.toISOString())
    });
  };

  const handleSelect = (arg) => openCreate(arg.startStr, arg.endStr, arg.allDay);
  const handleDateClick = (arg) => openCreate(arg.dateStr, arg.dateStr, arg.allDay);

  // Jump the main calendar to a date (mini-month / Today).
  const goToDate = (d) => calRef.current?.getApi().gotoDate(d);

  const openItem = (source, raw) => {
    if (source === 'event' && canManage) {
      setModalErr('');
      setDraft({
        id: raw.id, title: raw.title, description: raw.description || '', location: raw.location || '',
        allDay: raw.allDay,
        start: raw.allDay ? toDateInput(raw.start) : toLocalInput(raw.start),
        end: raw.allDay ? toDateInput(raw.end) : toLocalInput(raw.end),
        projectId: raw.projectId || '', color: raw.color || '',
        remindMinutes: raw.remindMinutes == null ? '' : String(raw.remindMinutes),
        repeat: detectPreset(raw.recurrenceRule, raw.start),
        custom: raw.recurrenceRule ? { ...blankCustomRecur(), ...parseCustom(raw.recurrenceRule) } : blankCustomRecur(),
        recurEnd: raw.recurrenceRule ? parseEnd(raw.recurrenceRule) : blankRecurEnd(),
      });
    } else {
      setDetail({ source, raw });
    }
  };

  const handleEventClick = (arg) => {
    const { source, raw } = arg.event.extendedProps;
    openItem(source, raw);
  };

  const handleEventChange = async (arg) => {
    const { source, raw } = arg.event.extendedProps;
    try {
      if (source === 'event') {
        await updateCalendarEvent(raw.id, {
          ...raw,
          start: arg.event.start?.toISOString(),
          end: (arg.event.end || arg.event.start)?.toISOString(),
          allDay: arg.event.allDay,
        });
      } else if (source === 'task') {
        // Reschedule the task's due date to the day it was dropped on.
        const full = tasks.find(t => t.id === raw.task_id);
        if (!full) { arg.revert(); return; }
        const d = arg.event.start;
        const due = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await updateTask({ ...full, due });
        setTasks?.(prev => prev.map(t => (t.id === full.id ? { ...t, due } : t)));
      } else {
        arg.revert();
        return;
      }
      if (connected) runSync(); else reload();
    } catch (e) {
      console.error(e);
      arg.revert();
    }
  };

  const isoFromDraft = (val, allDay) =>
    allDay ? new Date(val + 'T00:00:00').toISOString() : new Date(val).toISOString();

  const saveDraft = async () => {
    if (!draft.title.trim()) { setModalErr('Title is required'); return; }
    if (!draft.start) { setModalErr('Start is required'); return; }
    setSaving(true);
    setModalErr('');
    try {
      const startISO = isoFromDraft(draft.start, draft.allDay);
      const recurrenceRule = composeRule(draft.repeat, draft.custom, draft.recurEnd, startISO);
      const repeating = !!recurrenceRule;

      // For a repeating event, each occurrence lives on the start's day: the End
      // only defines the occurrence length, so we force it to the same date.
      let endVal = draft.end || draft.start;
      if (repeating) {
        if (draft.allDay) {
          endVal = draft.start;                                   // single all-day occurrence
        } else {
          const date = draft.start.slice(0, 10);
          const endTime = (draft.end && draft.end.slice(11, 16)) || draft.start.slice(11, 16);
          endVal = `${date}T${endTime}`;
          if (new Date(endVal) <= new Date(draft.start)) {        // guard: end after start
            endVal = new Date(new Date(draft.start).getTime() + 3600000).toISOString().slice(0, 16);
          }
        }
      }

      const payload = {
        title: draft.title.trim(), description: draft.description, location: draft.location,
        allDay: draft.allDay,
        start: startISO,
        end: isoFromDraft(endVal, draft.allDay),
        projectId: draft.projectId || null, color: draft.color || null,
        remindMinutes: draft.remindMinutes === '' ? null : Number(draft.remindMinutes),
        recurrenceRule,
      };
      if (draft.id) await updateCalendarEvent(draft.id, payload);
      else await createCalendarEvent(payload, workstationId);
      setDraft(null);
      await reload();
      if (connected) runSync();
    } catch (e) {
      setModalErr(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await deleteCalendarEvent(draft.id);
      setDraft(null);
      await reload();
      if (connected) runSync();
    } catch (e) {
      setModalErr(e.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (s) => setEnabled(e => ({ ...e, [s]: !e[s] }));

  const toggleDensity = () => setDensity(d => {
    const next = d === 'compact' ? 'comfortable' : 'compact';
    localStorage.setItem('orbit:cal:density', next);
    return next;
  });
  const toggleWeekends = () => setShowWeekends(w => {
    const next = !w;
    localStorage.setItem('orbit:cal:weekends', String(next));
    return next;
  });

  return (
    <div className={`cal-page-premium${density === 'compact' ? ' cal-density-compact' : ''}`}>
      <div className="cal-header-premium">
        <div className="cal-header-content">
          <div className="cal-title-wrapper">
            <div className="cal-title-icon">
              <Icon name="calendar" size={24} />
            </div>
            <div>
              <h1>Schedule Overview</h1>
              <p>Unify your tasks, projects, events, and Google Calendar</p>
            </div>
          </div>
          <div className="cal-header-actions">
            {connected === false && (
              <button className="btn outline sm cal-warn-btn" onClick={() => onNav?.('settings')}>
                <Icon name="alert-circle" size={14} /> Connect Google
              </button>
            )}
            {reconnect && (
              <button className="btn danger sm" onClick={() => onNav?.('settings')}>
                <Icon name="alert-circle" size={14} /> Reconnect
              </button>
            )}
            {connected && (
              <div className="cal-sync-wrap">
                {!syncing && lastSyncedAt && <span className="cal-synced-label">Synced {relTime(lastSyncedAt)}</span>}
                <button className="btn outline sm" onClick={runSync} disabled={syncing}>
                  <Icon name="rev" size={14} className={syncing ? 'spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
              </div>
            )}
            {canManage && (
              <button className="btn primary sm cal-new-btn" onClick={() => openCreate(nowRoundedISO(), nowRoundedISO(), false)}>
                <Icon name="plus" size={14} /> New Event
              </button>
            )}
          </div>
        </div>

        <div className="cal-filter-bar-premium">
          {Object.keys(SOURCE_LABEL).map(s => (
            <button
              key={s}
              className={`cal-filter-pill ${enabled[s] ? 'active' : ''}`}
              onClick={() => toggleSource(s)}
              style={{ '--theme-color': SOURCE_COLOR[s] }}
            >
              <div className="cal-filter-indicator">
                {enabled[s] && <Icon name="check" size={12} />}
              </div>
              <span>{SOURCE_LABEL[s]}</span>
              {s === 'google' && isTimeGrid && enabled.google && busyOverlays.length > 0 && (
                <span className="cal-busy-pill-badge" title="Busy blocks visible in time grid">busy</span>
              )}
              <span className="cal-filter-count-badge">{counts[s]}</span>
            </button>
          ))}

          <div className="cal-viewopts">
            <button
              className="cal-viewopt"
              onClick={toggleDensity}
              title={density === 'compact' ? 'Switch to comfortable spacing' : 'Switch to compact spacing'}
            >
              <Icon name={density === 'compact' ? 'layers' : 'list'} size={13} />
              {density === 'compact' ? 'Compact' : 'Comfortable'}
            </button>
            <button
              className={`cal-viewopt ${showWeekends ? 'on' : ''}`}
              onClick={toggleWeekends}
              title={showWeekends ? 'Hide weekends' : 'Show weekends'}
            >
              <Icon name="calendar" size={13} />
              Weekends
            </button>
          </div>
        </div>
      </div>

      <div className="cal-layout-premium">
        <div className="cal-main-premium">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, rrulePlugin]}
            initialView="dayGridMonth"
            headerToolbar={windowWidth < 540 ? {
              left: 'prev,next',
              center: 'title',
              right: 'dayGridMonth,listWeek',
            } : windowWidth < 820 ? {
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,listWeek',
            } : windowWidth < 1560 ? {
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,listWeek',
            } : {
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'Agenda' }}
            height="auto"
            events={allFcEvents}
            eventDisplay="block"
            displayEventTime={false}
            editable={canManage}
            selectable={canManage}
            selectMirror
            weekends={showWeekends}
            dayMaxEvents={density === 'compact' ? 6 : 4}
            nowIndicator
            fixedWeekCount={false}
            datesSet={handleDatesSet}
            select={handleSelect}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventDrop={handleEventChange}
            eventResize={handleEventChange}
            eventContent={(arg) => {
              const { stripe, overdue, done, recurring } = arg.event.extendedProps;
              return (
                <div className={`cal-ev-premium${done ? ' is-done' : ''}`}>
                  <span className="cal-ev-premium-stripe" style={{ background: stripe }} />
                  {overdue && <span className="cal-ev-overdue-dot" title="Overdue" />}
                  <span className="cal-ev-premium-label">{arg.event.title}</span>
                  {recurring && <span className="cal-ev-repeat" title="Repeats"><Icon name="rev" size={10} /></span>}
                  {!arg.event.allDay && arg.timeText && <span className="cal-ev-premium-time">{arg.timeText}</span>}
                </div>
              );
            }}
          />
          {(loading || syncing) && (
            <div className="cal-loading-overlay">
              <div className="cal-spinner"></div>
              <span>{syncing ? 'Syncing...' : 'Loading...'}</span>
            </div>
          )}
        </div>

        <aside className="cal-sidebar-premium">
          <div className="cal-mini-wrapper">
            <MiniMonth marked={markedDates} onPick={goToDate} />
          </div>

          <div className="cal-sidebar-header">
            <h3>Upcoming</h3>
            <span className="cal-upcoming-count">{upcoming.length} events</span>
          </div>

          <div className="cal-agenda-container">
            {upcoming.length === 0 && (
              <div className="cal-agenda-empty">
                <Icon name="calendar" size={32} />
                <p>No upcoming events</p>
              </div>
            )}
            {upcoming.map(i => (
              <div key={i.key} className="cal-agenda-card" onClick={() => openItem(i.source, i.raw)} title={i.title}>
                <div className="cal-agenda-glow" style={{ background: i.color }}></div>
                <div className="cal-agenda-card-content">
                  <div className="cal-agenda-time">
                    <span className="cal-agenda-day">{new Date(i.start).toLocaleDateString('en-US', { day: 'numeric' })}</span>
                    <span className="cal-agenda-month">{new Date(i.start).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                  <div className="cal-agenda-details">
                    <div className="cal-agenda-title" title={i.title}>{i.title}</div>
                    <div className="cal-agenda-meta">
                      <span className="cal-agenda-source" style={{ color: i.color }}>{SOURCE_LABEL[i.source]}</span>
                      {!i.allDay && <span className="cal-agenda-hour">{new Date(i.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {draft && (
        <CalendarEventModal
          draft={draft} setDraft={setDraft} projects={projects}
          onSave={saveDraft} onDelete={removeDraft} onClose={() => setDraft(null)}
          saving={saving} err={modalErr}
        />
      )}
      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} onNav={onNav} onJump={onJump} />}
    </div>
  );
}

// ── Mini-month navigator (left rail) ─────────────────────────────────
function MiniMonth({ marked, onPick }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const todayKey = dateKey(new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const shift = (n) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="cal-mini">
      <div className="cal-mini-head">
        <span className="cal-mini-title">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        <div className="cal-mini-nav">
          <button onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chev" size={12} /></button>
          <button onClick={() => shift(1)} aria-label="Next month"><Icon name="chev" size={12} /></button>
        </div>
      </div>
      <div className="cal-mini-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="cal-mini-dow">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="cal-mini-cell empty" />;
          const k = dateKey(d);
          return (
            <button
              key={i}
              className={`cal-mini-cell${k === todayKey ? ' today' : ''}${marked.has(k) ? ' marked' : ''}`}
              onClick={() => onPick(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom recurrence pattern (frequency only) ───────────────────────
function CustomRecurrence({ custom, setCustom }) {
  const set = (k, v) => setCustom({ ...custom, [k]: v });
  const toggleDay = (code) => set('byweekday',
    custom.byweekday.includes(code) ? custom.byweekday.filter(d => d !== code) : [...custom.byweekday, code]);
  return (
    <div className="cal-recur-custom">
      <div className="cal-recur-row">
        <span>Every</span>
        <input className="cal-input cal-recur-int" type="number" min="1" value={custom.interval}
          onChange={e => set('interval', e.target.value)} />
        <select className="cal-input" value={custom.freq} onChange={e => set('freq', e.target.value)}>
          <option value="DAILY">day(s)</option>
          <option value="WEEKLY">week(s)</option>
          <option value="MONTHLY">month(s)</option>
          <option value="YEARLY">year(s)</option>
        </select>
      </div>
      {custom.freq === 'WEEKLY' && (
        <div className="cal-recur-days">
          {WEEKDAY_PICKER.map(d => (
            <button key={d.code} type="button"
              className={`cal-recur-day ${custom.byweekday.includes(d.code) ? 'on' : ''}`}
              onClick={() => toggleDay(d.code)}>{d.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared "Repeat ends" control (applies to presets + custom) ───────
function RepeatEnds({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="cal-recur-row cal-recur-ends">
      <span>Repeat ends</span>
      <select className="cal-input" value={value.type} onChange={e => set('type', e.target.value)}>
        <option value="never">Never</option>
        <option value="until">On date</option>
        <option value="count">After N times</option>
      </select>
      {value.type === 'until' && (
        <input className="cal-input" type="date" value={value.until} onChange={e => set('until', e.target.value)} />
      )}
      {value.type === 'count' && (
        <input className="cal-input cal-recur-int" type="number" min="1" value={value.count}
          onChange={e => set('count', e.target.value)} placeholder="N" />
      )}
    </div>
  );
}

function CalendarEventModal({ draft, setDraft, projects, onSave, onDelete, onClose, saving, err }) {
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const repeating = draft.repeat !== 'NONE';
  // Keep the End's date glued to the Start's date while repeating + timed.
  const onStartChange = (v) => setDraft(d => {
    const next = { ...d, start: v };
    if (d.repeat !== 'NONE' && !d.allDay && d.end) next.end = `${v.slice(0, 10)}T${d.end.slice(11, 16)}`;
    return next;
  });
  const onEndTimeChange = (t) => setDraft(d => ({ ...d, end: `${(d.start || '').slice(0, 10)}T${t}` }));
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-box" style={{ width: 480, maxWidth: '100%' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-title">{draft.id ? 'Edit event' : 'New event'}</div>
        {err && <div className="modal-err" style={{ marginTop: 10 }}>{err}</div>}

        <label className="cal-field-label">Title</label>
        <input className="cal-input" autoFocus value={draft.title}
          onChange={e => set('title', e.target.value)} placeholder="Event title" />

        <label className="cal-checkbox-row">
          <input type="checkbox" checked={draft.allDay} onChange={e => set('allDay', e.target.checked)} />
          All day
        </label>

        <label className="cal-field-label">Repeat</label>
        <select className="cal-input" value={draft.repeat} onChange={e => set('repeat', e.target.value)}>
          {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {repeating && draft.repeat === 'CUSTOM' && (
          <CustomRecurrence custom={draft.custom} setCustom={c => set('custom', c)} />
        )}
        {repeating && <RepeatEnds value={draft.recurEnd} onChange={v => set('recurEnd', v)} />}

        <div className="cal-field-grid">
          <div>
            <label className="cal-field-label">{repeating ? 'Starts on' : 'Start'}</label>
            <input className="cal-input" type={draft.allDay ? 'date' : 'datetime-local'}
              value={draft.start} onChange={e => onStartChange(e.target.value)} />
          </div>
          <div>
            {repeating && draft.allDay ? (
              <>
                <label className="cal-field-label">End</label>
                <div className="cal-recur-allday-note">All-day, repeats each occurrence</div>
              </>
            ) : repeating ? (
              <>
                <label className="cal-field-label">End time</label>
                <input className="cal-input" type="time"
                  value={(draft.end || '').slice(11, 16)} onChange={e => onEndTimeChange(e.target.value)} />
              </>
            ) : (
              <>
                <label className="cal-field-label">End</label>
                <input className="cal-input" type={draft.allDay ? 'date' : 'datetime-local'}
                  value={draft.end} onChange={e => set('end', e.target.value)} />
              </>
            )}
          </div>
        </div>

        {repeating && (
          <div className="cal-recur-hint">
            <Icon name="alert-circle" size={11} />
            <span><strong>Starts on</strong> is the first occurrence &amp; the time it repeats at. <strong>{draft.allDay ? 'Each occurrence is one day.' : 'End time sets how long each one lasts.'}</strong></span>
          </div>
        )}
        {repeating && draft.id && (
          <div className="cal-recur-hint"><Icon name="rev" size={11} /> Editing changes the whole series.</div>
        )}

        <label className="cal-field-label">Location</label>
        <input className="cal-input" value={draft.location}
          onChange={e => set('location', e.target.value)} placeholder="Optional" />

        <label className="cal-field-label">Project</label>
        <select className="cal-input" value={draft.projectId} onChange={e => set('projectId', e.target.value)}>
          <option value="">None</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label className="cal-field-label">Remind me</label>
        <select className="cal-input" value={draft.remindMinutes} onChange={e => set('remindMinutes', e.target.value)}>
          {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label className="cal-field-label">Description</label>
        <textarea className="cal-input" rows={3} value={draft.description}
          onChange={e => set('description', e.target.value)} placeholder="Optional" />

        {draft.meetLink && (
          <a className="cal-meet-join-banner" href={draft.meetLink} target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" /></svg>
            Join Google Meet
          </a>
        )}

        <div className="modal-footer" style={{ marginTop: 16 }}>
          {draft.id
            ? <button className="btn danger sm" onClick={onDelete} disabled={saving}>Delete</button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn primary sm" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const RSVP_ICON = { accepted: '✓', declined: '✗', tentative: '~', needsAction: '?' };
const RSVP_COLOR = { accepted: '#22c55e', declined: '#ef4444', tentative: '#f59e0b', needsAction: 'var(--text-4)' };

// ── Read-only detail for tasks / projects / Google events ────────────
function DetailModal({ detail, onClose, onNav, onJump }) {
  const { source, raw } = detail;
  const LABEL = { event: 'Event', task: 'Task', project: 'Project', google: 'Google Event' };
  const title = raw.title || raw.name || raw.summary || '(untitled)';
  const start = raw.start || raw.due_date || raw.start_date || raw.starts_at;
  const end = raw.end || raw.end_date || raw.ends_at;

  const iconMap = { task: 'check-circle', project: 'folder', google: 'calendar' };
  const themeColor = SOURCE_COLOR[source] || 'var(--accent)';
  const startDate = start ? new Date(start) : null;

  // Meet link works for both Google-cache events and Orbit events synced back from Google
  const meetLink = raw.meet_link || raw.meetLink || null;
  const attendees = Array.isArray(raw.attendees) ? raw.attendees : [];
  const MAX_VISIBLE = 5;

  return (
    <div className="cal-ultra-modal-overlay" onMouseDown={onClose}>
      <div className="cal-ultra-box" onMouseDown={e => e.stopPropagation()}>
        <div className="cal-ultra-glow" style={{ '--theme': themeColor }}></div>

        <div className="cal-ultra-header">
          <div className="cal-ultra-badge" style={{ color: themeColor, background: `color-mix(in srgb, ${themeColor} 15%, transparent)` }}>
            <Icon name={iconMap[source] || 'calendar'} size={14} />
            <span>{LABEL[source]}</span>
          </div>
          {meetLink && (
            <a className="cal-meet-join-btn" href={meetLink} target="_blank" rel="noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" /></svg>
              Join
            </a>
          )}
          <button className="cal-ultra-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="cal-ultra-content">
          <div className="cal-ultra-date-block">
            {startDate ? (
              <>
                <div className="cal-ultra-month">{startDate.toLocaleString('en-US', { month: 'short' })}</div>
                <div className="cal-ultra-day">{startDate.getDate()}</div>
              </>
            ) : (
              <div className="cal-ultra-icon-block" style={{ color: themeColor }}>
                <Icon name={iconMap[source] || 'calendar'} size={32} />
              </div>
            )}
          </div>

          <div className="cal-ultra-info">
            <h2 className="cal-ultra-title">{title}</h2>
            <div className="cal-ultra-time">
              {start ? startDate.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : 'No time specified'}
              {end && ` — ${new Date(end).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
            </div>
          </div>
        </div>

        <div className="cal-ultra-details">
          {raw.recurrenceRule && (
            <div className="cal-ultra-row">
              <div className="cal-ultra-row-icon"><Icon name="rev" size={16} /></div>
              <div className="cal-ultra-row-text">{summarizeRule(raw.recurrenceRule)}</div>
            </div>
          )}
          {raw.location && (
            <div className="cal-ultra-row">
              <div className="cal-ultra-row-icon"><Icon name="map-pin" size={16} /></div>
              <div className="cal-ultra-row-text">{raw.location}</div>
            </div>
          )}

          {attendees.length > 0 && (
            <div className="cal-ultra-row align-top">
              <div className="cal-ultra-row-icon"><Icon name="users" size={16} /></div>
              <div className="cal-attendees-list">
                {attendees.slice(0, MAX_VISIBLE).map((a, i) => (
                  <div key={i} className="cal-attendee-row">
                    <span
                      className="cal-attendee-status"
                      title={a.responseStatus || 'needsAction'}
                      style={{ color: RSVP_COLOR[a.responseStatus] || RSVP_COLOR.needsAction }}
                    >
                      {RSVP_ICON[a.responseStatus] || '?'}
                    </span>
                    <span className="cal-attendee-name">
                      {a.displayName || a.email || 'Unknown'}
                      {a.organizer && <span className="cal-attendee-organizer">organizer</span>}
                    </span>
                  </div>
                ))}
                {attendees.length > MAX_VISIBLE && (
                  <div className="cal-attendee-more">+{attendees.length - MAX_VISIBLE} more</div>
                )}
              </div>
            </div>
          )}

          {raw.description && (
            <div className="cal-ultra-row align-top">
              <div className="cal-ultra-row-icon"><Icon name="note" size={16} /></div>
              <div className="cal-ultra-row-text cal-ultra-desc">{raw.description}</div>
            </div>
          )}
        </div>

        <div className="cal-ultra-footer">
          {source === 'task' && <button className="cal-ultra-btn secondary" onClick={() => { onJump ? onJump('tasks', raw.id) : onNav?.('tasks'); onClose(); }}>Open Task</button>}
          {source === 'project' && <button className="cal-ultra-btn secondary" onClick={() => { onJump ? onJump('projects', raw.short_id) : onNav?.('projects'); onClose(); }}>Open Project</button>}
          {source === 'google' && raw.html_link &&
            <a className="cal-ultra-btn secondary" href={raw.html_link} target="_blank" rel="noreferrer">Open in Google</a>}
          <div style={{ flex: 1 }}></div>
          <button className="cal-ultra-btn primary" onClick={onClose} style={{ background: themeColor, color: '#fff', borderColor: themeColor, boxShadow: `0 8px 16px color-mix(in srgb, ${themeColor} 30%, transparent)` }}>Done</button>
        </div>
      </div>
    </div>
  );
}

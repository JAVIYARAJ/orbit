// workspace.jsx — Home, Projects, Tasks, Learning, Vault

import { useState as useStateA, useEffect as useEffectA, useRef as useRefA } from 'react';
import { createPortal } from 'react-dom';
import { Icon, SlidePanel } from '../components/shell.jsx';
import {
  createProject, updateProject, softDeleteProject, createTask, updateTask, softDeleteTask, createVaultItem, createLearningItem, createTag,
  linkNoteToTask, unlinkNoteFromTask, getTaskStatusLogs, getHomeStats, getProjectTasks,
} from '../lib/db.js';
import { renderMd } from './tools.jsx';
import { ghGetRepos, ghGetLastCommit, ghCreateBranch, ghGetBranches, ghCreateRepo, ghDeleteRepo, ghDeleteBranch, ghGetTokenScopes } from '../lib/github.js';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────
const getDueClass = (date) => {
  if (!date || date === '—') return '';

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (date <= todayStr) return 'due-attn overdue';

  // For 'soon', we still use date objects
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  const diff = (due - today) / (1000 * 60 * 60 * 24);
  if (diff <= 2) return 'due-attn soon';

  return '';
};

// Extracts a numeric value from a free-text budget string (e.g. "€12,400" → 12400)
const parseBudgetAmount = (str) => {
  if (!str || str === '—') return null;
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  return isNaN(num) || num <= 0 ? null : num;
};

const GH_REPO_RE = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;

// Derive up-to-3-char uppercase prefix from a project name
const getTaskPrefix = (name = '') =>
  (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'TSK';

// Return max(existing sequential numbers for this project) + 1
// Counts ALL tasks (parents + subtasks) so the counter is project-wide
const getNextTaskNum = (allTasks, projId, prefix) => {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const nums = allTasks
    .filter(t => t.proj === projId)
    .map(t => { const m = t.id.match(re); return m ? parseInt(m[1]) : 0; });
  return (nums.length > 0 ? Math.max(...nums) : 0) + 1;
};

// Returns true if making parentDbId the parent of candidateDbId would create a cycle.
// Walks up the ancestor chain of parentDbId looking for candidateDbId.
const wouldCreateCycle = (allTasks, parentDbId, candidateDbId) => {
  if (parentDbId === candidateDbId) return true;
  const byDbId = Object.fromEntries(allTasks.map(t => [t._dbId, t]));
  let cur = byDbId[parentDbId];
  const seen = new Set();
  while (cur?.parentId) {
    if (seen.has(cur.parentId)) break;
    seen.add(cur.parentId);
    if (cur.parentId === candidateDbId) return true;
    cur = byDbId[cur.parentId];
  }
  return false;
};

const formatDate = (str) => {
  if (!str || str === '—') return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const StatusPill = ({ status }) => {
  const map = { planning: 'Planning', progress: 'In Progress', review: 'Review', done: 'Done', hold: 'On Hold' };
  return <span className={'pill ' + status}><span className="d"></span>{map[status]}</span>;
};

const genId = (name) => {
  const base = name.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'PROJ';
  return base + Math.floor(Math.random() * 90 + 10);
};

const fmtHours = (h) => {
  const n = Number(h) || 0;
  if (n < 0.017) return '0m';
  const totalMins = Math.round(n * 60);
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
};

const fmtDate = (d) => (!d || d === '—') ? '—' : d;

// ═══════════════════════════════════════════════════════════════════
//  1. HOME — Command Center
// ═══════════════════════════════════════════════════════════════════
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="wc-tooltip">
      <div className="wc-tooltip-label">{label}</div>
      <div className="wc-tooltip-val">{fmtHours(payload[0].value)}</div>
    </div>
  );
};

const CustomDot = ({ cx, cy, index, todayIdx, payload }) => {
  if (payload.h === 0) return null;
  const isToday = index === todayIdx;
  return (
    <circle
      cx={cx} cy={cy} r={isToday ? 5 : 3.5}
      fill={isToday ? 'var(--accent)' : 'var(--bg-1)'}
      stroke="var(--accent)"
      strokeWidth={isToday ? 0 : 2}
    />
  );
};

const WeekLineChart = ({ data, todayIdx }) => {
  const chartData = data.map((d, i) => ({
    day: DAY_LABELS[i],
    h: i > todayIdx ? null : d.h,
    raw: d,
  }));

  return (
    <div className="wc-recharts">
      <ResponsiveContainer width="100%" height="100%" minHeight={150}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="wcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--f-mono)', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--f-mono)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => fmtHours(v)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 2' }} />
          <Area
            type="monotone"
            dataKey="h"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#wcGrad)"
            connectNulls={false}
            dot={<CustomDot todayIdx={todayIdx} />}
            activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--bg-1)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const HomePage = ({ user, timer, onNav, projects, tasks, notes, emailTemplates, statuses = [], setTasks, workstationId, onTimerPause, onTimerResume, onTimerStop }) => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isoStr = today.toISOString().slice(0, 10);
  const tzOffsetMins = -today.getTimezoneOffset();
  let tzStr = 'UTC';
  if (tzOffsetMins !== 0) {
    const sign = tzOffsetMins > 0 ? '+' : '-';
    const absMins = Math.abs(tzOffsetMins);
    const hrs = Math.floor(absMins / 60);
    const mins = absMins % 60;
    tzStr = `UTC${sign}${hrs}${mins > 0 ? `:${String(mins).padStart(2, '0')}` : ''}`;
  }

  // ISO week number
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((today - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Dev';

  const doneStatusId = statuses.find(s => s.isDone)?.id;
  const todayTasks = tasks.filter(t => t.col !== doneStatusId).slice(0, 6);
  const dueTodayTasks = tasks.filter(t => t.due === isoStr);
  const activeProjects = projects.filter(p => p.status === 'progress' || p.status === 'review');
  const openTasksCount = tasks.filter(t => t.col !== doneStatusId).length;
  const activeProjectsCount = projects.filter(p => p.status === 'progress').length;
  const planningCount = projects.filter(p => p.status === 'planning').length;
  const overdueCount = tasks.filter(t => t.due && t.due !== '—' && t.due < isoStr && t.col !== doneStatusId).length;

  // Priority counts across non-done tasks
  const nonDoneTasks = tasks.filter(t => t.col !== doneStatusId);
  const p1Count = nonDoneTasks.filter(t => t.p === 1).length;
  const p2Count = nonDoneTasks.filter(t => t.p === 2).length;
  const p3Count = nonDoneTasks.filter(t => t.p === 3).length;
  const templatePreview = (emailTemplates || []).slice(0, 3);

  const todayIdx = (today.getDay() + 6) % 7; // 0 = Mon

  // ── Stateful digital clock ─────────────────────────────────────────
  const [time, setTime] = useStateA(new Date());
  useEffectA(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);
  const clockStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ── Remote stats (timer-based) ────────────────────────────────────
  const [stats, setStats] = useStateA(null);
  useEffectA(() => {
    if (!workstationId) return;
    getHomeStats(workstationId).then(setStats).catch(() => { });
  }, [workstationId]);

  // Build full 7-day chart array from RPC sparse result
  const week = DAY_LABELS.map((d, i) => {
    const entry = stats?.weekChart?.find(e => e.dow === i);
    return { d, h: entry ? entry.hours : 0 };
  });
  const maxH = Math.max(...week.map(d => d.h), 1);
  const weekTotal = (stats?.hoursThisWeek ?? 0).toFixed(1);

  const hoursThisWeek = stats?.hoursThisWeek ?? null;
  const hoursLastWeek = stats?.hoursLastWeek ?? null;
  const hoursDelta = hoursThisWeek !== null && hoursLastWeek !== null
    ? (hoursThisWeek - hoursLastWeek).toFixed(1)
    : null;
  const streakCurrent = stats?.streakCurrent ?? null;
  const streakBest = stats?.streakBest ?? null;

  // ── Copy to clipboard confirmation ────────────────────────────────
  const [copiedId, setCopiedId] = useStateA(null);
  const handleCopyTemplate = (item) => {
    navigator.clipboard.writeText(item.body || '');
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Interactive task toggle ───────────────────────────────────────
  const handleToggleTask = async (task) => {
    const isDone = task.col === doneStatusId;
    const defaultStatusId = statuses.find(s => !s.isDone)?.id || 'progress';
    const targetCol = isDone ? defaultStatusId : doneStatusId;
    const updated = { ...task, col: targetCol };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    try {
      await updateTask(updated);
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t)); // rollback
      console.error('Failed to toggle task:', err);
    }
  };

  // ── Local timer toggle ────────────────────────────────────────────
  const handleToggleTimer = () => {
    if (timer.running) {
      onTimerPause?.();
    } else {
      if (timer.activeEntry) {
        onTimerResume?.();
      } else {
        onNav('timer');
      }
    }
  };

  // Radial Timer Calculations
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  // Sum up elapsed session seconds
  const totalDisplaySecs = (timer.activeEntry?.totalSeconds || 0) + (timer.running ? Math.floor((new Date() - new Date(timer.activeEntry?.startedAt || new Date())) / 1000) : 0);
  const currentHourSecs = totalDisplaySecs % 3600;
  const progressPct = timer.activeEntry ? (currentHourSecs / 3600) : 0;
  const strokeDashoffset = circumference - (progressPct * circumference);

  return (
    <div className="page page-wide cc-container">
      {/* 1. FUTURISTIC HEADER */}
      <div className="cc-welcome-panel">
        <div className="cc-welcome-text">
          <div className="cc-status-badge">
            <span className="cc-status-dot"></span>
            System Online
          </div>
          <h1>{greeting}, {firstName}.</h1>
          <div className="sub">{dateStr}{dueTodayTasks.length > 0 ? ` — ${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today.` : ' — No tasks due today.'}</div>
        </div>
        <div className="cc-clock-wrap">
          <div className="cc-clock-val">{clockStr}</div>
          <div className="cc-clock-lbl">Local Time ({tzStr})</div>
        </div>
      </div>

      {/* 2. COMMAND LAUNCHER DOCK */}
      <div className="cc-quick-dock">
        <div className="cc-quick-btn" onClick={() => onNav('timer')}>
          <div className="icon-box">
            <Icon name="timer" size={14} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Time Tracker</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{timer.running ? 'View running session' : 'Start tracking'}</div>
          </div>
          <span className="k">G I</span>
        </div>

        <div className="cc-quick-btn" onClick={() => onNav('tasks')}>
          <div className="icon-box">
            <Icon name="plus" size={14} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Create Task</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Add to sprint backlog</div>
          </div>
          <span className="k">G T</span>
        </div>

        <div className="cc-quick-btn" onClick={() => onNav('notes')}>
          <div className="icon-box">
            <Icon name="note" size={14} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Capture Thought</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Quick text pad note</div>
          </div>
          <span className="k">G N</span>
        </div>
      </div>

      {/* 3. TELEMETRY & STATS HERO */}
      <div className="cc-telemetry-grid">
        {/* TIMER PANEL */}
        <div className={`cc-card cc-timer-panel ${timer.running ? 'running' : ''} ${timer.status === 'paused' ? 'paused' : ''}`}>
          <div className="cc-timer-radial">
            <svg className="cc-timer-circle-svg" viewBox="0 0 100 100">
              <circle className="cc-timer-circle-bg" cx="50" cy="50" r={radius} />
              {timer.activeEntry && (
                <circle
                  className="cc-timer-circle-progress"
                  cx="50"
                  cy="50"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              )}
            </svg>
            <button className="cc-timer-center-btn" onClick={handleToggleTimer} title={timer.running ? 'Pause timer' : 'Resume timer'}>
              <Icon name={timer.running ? 'pause' : 'play'} size={18} />
              <span style={{ fontSize: 8, marginTop: 4, fontWeight: 700, letterSpacing: '0.05em' }}>
                {timer.running ? 'PAUSE' : 'START'}
              </span>
            </button>
          </div>

          <div className="cc-timer-info">
            <div className="cc-timer-lbl">ACTIVE TELEMETRY TRACKER</div>
            <div className="cc-timer-display">{timer.display}</div>
            <div className="cc-timer-desc">
              {timer.running ? <span className="dot-live"></span> : <span className="dot-live" style={{ background: 'var(--st-review)' }}></span>}
              {timer.activeEntry ? timer.label : 'System Idle — Waiting for launch'}
            </div>

            <div className="cc-timer-ctrls">
              {timer.activeEntry && (
                <>
                  <button className="btn" onClick={() => onNav('timer')}>
                    <Icon name="stop" size={10} /> Stop &amp; Save
                  </button>
                  <button className="btn ghost" onClick={() => onNav('timer')}>
                    Manage Tracker <Icon name="chev" size={10} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* STATS PANEL */}
        <div className="cc-stats-panel">
          <div className="cc-stat-pod">
            <div className="header-row">
              <span className="lbl">Hours Logged</span>
              <span className="icon-wrap"><Icon name="timer" size={13} /></span>
            </div>
            <span className="val">{hoursThisWeek !== null ? fmtHours(hoursThisWeek) : '0m'}</span>
            <div className={`footer-desc ${hoursDelta !== null ? (Number(hoursDelta) >= 0 ? 'up' : 'dn') : ''}`}>
              {hoursDelta !== null
                ? (Number(hoursDelta) >= 0 ? `↑ ${fmtHours(Math.abs(Number(hoursDelta)))} vs last week` : `↓ ${fmtHours(Math.abs(Number(hoursDelta)))} vs last week`)
                : 'Telemetry loading…'}
            </div>
          </div>

          <div className="cc-stat-pod">
            <div className="header-row">
              <span className="lbl">Dev Streak</span>
              <span className="icon-wrap" style={{ color: 'var(--st-review)' }}><Icon name="flame" size={13} /></span>
            </div>
            <span className="val">{streakCurrent !== null ? streakCurrent : '0'} d</span>
            <div className="footer-desc">
              {streakBest !== null ? `Personal record: ${streakBest} days` : 'Telemetry loading…'}
            </div>
          </div>

          <div className="cc-stat-pod">
            <div className="header-row">
              <span className="lbl">Active Pods</span>
              <span className="icon-wrap"><Icon name="folder" size={13} /></span>
            </div>
            <span className="val">{activeProjectsCount}</span>
            <div className="footer-desc">
              {planningCount > 0 ? `+${planningCount} projects in preparation` : 'Ready to start projects'}
            </div>
          </div>

          <div className="cc-stat-pod">
            <div className="header-row">
              <span className="lbl">Sprint Backlog</span>
              <span className="icon-wrap"><Icon name="list" size={13} /></span>
            </div>
            <span className="val">{openTasksCount}</span>
            <div className={`footer-desc ${overdueCount > 0 ? 'dn' : ''}`}>
              {overdueCount > 0 ? `${overdueCount} critical overdue items` : 'Zero overdue items'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MAIN TELEMETRY CONTENT GRID */}
      <div className="home-grid">
        <div className="home-side">
          {/* TODAY'S TASKS CARD */}
          <div className="cc-card">
            <div className="cc-card-header">
              <div className="cc-title-wrap">
                <span className="t">Sprint Radar</span>
                <span className="cc-title-badge">{todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {p1Count > 0 && <span className="cc-task-row p-badge p1" style={{ border: 0, padding: '2px 6px' }}>P1 · {p1Count}</span>}
                {p2Count > 0 && <span className="cc-task-row p-badge p2" style={{ border: 0, padding: '2px 6px' }}>P2 · {p2Count}</span>}
                <button className="btn sm" onClick={() => onNav('tasks')} style={{ padding: '4px 10px', fontSize: 10 }}>View All <Icon name="chev" size={8} /></button>
              </div>
            </div>
            <div className="card-body-scroll task-list">
              {todayTasks.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No pending tasks for today</div>
              ) : todayTasks.map(t => {
                const projObj = projects.find(p => p.id === t.proj || p._dbId === t.proj);
                const projName = projObj ? projObj.name : t.proj;

                return (
                  <div key={t.id} className="cc-task-row" onClick={() => handleToggleTask(t)}>
                    <div className={`cc-checkbox ${t.col === doneStatusId ? 'checked' : ''}`}>
                      <Icon name="check" size={10} />
                    </div>
                    <span className={`p-badge p${t.p}`}>{t.p === 1 ? 'P1' : t.p === 2 ? 'P2' : 'P3'}</span>
                    <div className="title">{t.title}</div>
                    <div className="meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.due ? formatDate(t.due) : '—'}</span>
                      <span className="tag accent" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={projName}>
                        {projName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LINE CHART CARD */}
          <div className="cc-card">
            <div className="cc-card-header">
              <div>
                <span className="t">Productivity Waveform</span>
                <div className="wc-subtitle">{fmtHours(stats?.hoursThisWeek ?? 0)} tracked this week</div>
              </div>
              {hoursDelta !== null && (
                <span className={'wc-delta ' + (Number(hoursDelta) >= 0 ? 'up' : 'dn')}>
                  {Number(hoursDelta) >= 0 ? '↑' : '↓'} {fmtHours(Math.abs(Number(hoursDelta)))} vs last week
                </span>
              )}
            </div>
            <div className="cc-card-body">
              <WeekLineChart data={week} todayIdx={todayIdx} />
            </div>
          </div>
        </div>

        <div className="home-side">
          {/* ACTIVE PROJECTS CARD */}
          <div className="cc-card">
            <div className="cc-card-header">
              <span className="t">Active Projects</span>
              <button className="btn sm" onClick={() => onNav('projects')} style={{ padding: '4px 10px', fontSize: 10 }}>All <Icon name="chev" size={8} /></button>
            </div>
            <div className="card-body-scroll">
              {activeProjects.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No active projects</div>
              ) : activeProjects.map(p => {
                const projectTasks = tasks.filter(t => t.proj === p.id);
                const total = projectTasks.length;
                const completed = projectTasks.filter(t => t.col === doneStatusId).length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <div key={p.id} className="cc-proj-row" onClick={() => onNav('projects')}>
                    <div className="cc-proj-title-bar">
                      <div>
                        <div className="cc-proj-name">{p.name}</div>
                        <div className="cc-proj-client">{p.client}</div>
                      </div>
                      <StatusPill status={p.status} />
                    </div>

                    <div className="cc-proj-meta-bar">
                      <div className="cc-proj-metrics">
                        <span>{p.openTasks} open</span>
                        <span>·</span>
                        <span>{fmtHours(p.hoursLogged)} logged</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)', color: 'var(--text-3)' }}>{pct}%</span>
                        <div className="cc-proj-progress">
                          <div className="cc-proj-progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PINNED NOTES CARD */}
          <div className="cc-card">
            <div className="cc-card-header">
              <span className="t">Telemetry Notes</span>
              <button className="btn sm" onClick={() => onNav('notes')} style={{ padding: '4px 10px', fontSize: 10 }}>All <Icon name="chev" size={8} /></button>
            </div>
            <div className="card-body-scroll">
              {notes.filter(n => n.pinned).length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No starred notes</div>
              ) : notes.filter(n => n.pinned).map(n => (
                <div key={n.id} className="home-note-row" onClick={() => onNav('notes')}>
                  <div className="home-note-title">
                    <Icon name="star" size={11} /> {n.title}
                  </div>
                  <div className="stack" style={{ marginTop: 2 }}>
                    {n.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* EMAIL TEMPLATES CARD WITH COPY SHORTCUT */}
          <div className="cc-card">
            <div className="cc-card-header">
              <span className="t">Preconfigured Templates</span>
              <button className="btn sm" onClick={() => onNav('email')} style={{ padding: '4px 10px', fontSize: 10 }}>All <Icon name="chev" size={8} /></button>
            </div>
            <div className="card-body-scroll" style={{ padding: '4px 0' }}>
              {templatePreview.length === 0 ? (
                <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 12, textAlign: 'center' }}>No templates yet</div>
              ) : templatePreview.map((item) => (
                <div key={item.id} className="cc-temp-row">
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.cat}</span>
                  </div>
                  <button
                    className={`cc-temp-copy-btn ${copiedId === item.id ? 'copied' : ''}`}
                    onClick={() => handleCopyTemplate(item)}
                    title="Copy template body to clipboard"
                  >
                    <Icon name={copiedId === item.id ? 'check' : 'copy'} size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── GitHub "not connected" hint ───────────────────────────────────────
const GhConnectHint = ({ label }) => (
  <div className="gh-connect-hint">
    <div className="gh-connect-hint-row">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, marginTop: 1, opacity: 0.4 }}>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
      <span className="gh-connect-hint-label">{label}</span>
    </div>
    <span className="gh-connect-hint-nav">Settings → Integrations</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
//  2. PROJECTS
// ═══════════════════════════════════════════════════════════════════
// Shared form panel — handles both Add and Edit
// ── Repo selector dropdown (shown when GitHub is connected) ─────────
const RepoSelector = ({ repos, loading, value, onChange }) => {
  const [open, setOpen] = useStateA(false);
  const [q, setQ] = useStateA('');
  const [rect, setRect] = useStateA(null);
  const btnRef = useRefA(null);
  const dropRef = useRefA(null);
  const searchRef = useRefA(null);

  const openDropdown = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect(r);
    setOpen(true);
  };

  useEffectA(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handleClick = (e) => {
      if (!btnRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
        setOpen(false);
        setQ('');
      }
    };
    const handleScroll = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const selected = repos.find(r => r.html_url === value);
  const filtered = repos.filter(r => !q || r.full_name.toLowerCase().includes(q.toLowerCase()));

  const dropStyle = rect ? {
    position: 'fixed',
    bottom: window.innerHeight - rect.top + 4,
    left: rect.left,
    width: Math.max(rect.width, 300),
    maxHeight: rect.top - 12,
    zIndex: 99999,
  } : {};

  return (
    <div className="repo-sel">
      <button type="button" className="repo-sel-btn" ref={btnRef} onClick={() => open ? (setOpen(false), setQ('')) : openDropdown()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, color: 'var(--text-3)' }}>
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          {loading ? 'Loading repos…' : selected ? selected.full_name : 'Select a repository…'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && createPortal(
        <div className="repo-sel-drop" ref={dropRef} style={dropStyle}>
          <div className="repo-sel-search">
            <input ref={searchRef} placeholder="Search repos…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="repo-sel-list">
            {value && (
              <button className="repo-sel-item repo-sel-clear" onClick={() => { onChange(''); setOpen(false); setQ(''); }}>
                — No repository
              </button>
            )}
            {filtered.length === 0 && !loading && (
              <div className="repo-sel-empty">No repos match</div>
            )}
            {filtered.map(r => {
              const [owner, repoName] = r.full_name.split('/');
              return (
                <button
                  key={r.id}
                  className={'repo-sel-item' + (r.html_url === value ? ' active' : '')}
                  onClick={() => { onChange(r.html_url); setOpen(false); setQ(''); }}
                >
                  <div className="repo-sel-info">
                    <span className="repo-sel-reponame">{repoName}</span>
                    <span className="repo-sel-owner">{owner}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
                    {r.private && <span className="repo-badge private">private</span>}
                    {r.language && <span className="repo-badge lang">{r.language}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const ProjectFormPanel = ({ open, onClose, initial, onSubmit, projectTypes = [], githubToken = null, projects = [] }) => {
  const isEdit = !!initial;

  const toForm = (p) => p ? {
    name: p.name,
    client: p.client === 'Self' ? '' : (p.client || ''),
    description: p.description || '',
    typeId: p.typeId || projectTypes[0]?.id || '',
    status: p.status || 'planning',
    stack: (p.stack || []).join(', '),
    start: p.start || '',
    end: (!p.end || p.end === '—') ? '' : p.end,
    budget: (!p.budget || p.budget === '—') ? '' : p.budget,
    repo: (!p.repo || p.repo === '—') ? '' : p.repo,
    hoursEst: p.hoursEst || 0,
  } : { name: '', client: '', description: '', typeId: projectTypes[0]?.id || '', status: 'planning', stack: '', start: '', end: '', budget: '', repo: '', hoursEst: 0 };

  const [form, setForm] = useStateA(() => toForm(initial));
  const [err, setErr] = useStateA('');
  const [saving, setSaving] = useStateA(false);
  const [ghRepos, setGhRepos] = useStateA([]);
  const [ghLoading, setGhLoading] = useStateA(false);
  const [repoMode, setRepoMode] = useStateA('existing'); // 'existing' | 'new'
  const [newRepoName, setNewRepoName] = useStateA('');
  const [newRepoPrivate, setNewRepoPrivate] = useStateA(false);

  // Re-initialise form whenever the panel opens with different data
  useEffectA(() => {
    if (!open) return;
    setForm(toForm(initial));
    setErr('');
    setRepoMode('existing');
    setNewRepoName('');
    setNewRepoPrivate(false);
    if (githubToken && ghRepos.length === 0) {
      setGhLoading(true);
      ghGetRepos(githubToken).then(setGhRepos).catch(console.error).finally(() => setGhLoading(false));
    }
  }, [open, initial?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) { setErr('Project name is required.'); return; }

    // Duplicate name check
    const duplicate = projects.find(p =>
      p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== initial?.id
    );
    if (duplicate) { setErr(`A project named "${trimmedName}" already exists.`); return; }

    // Date range validation
    if (form.start && form.end && form.end < form.start) {
      setErr('End date cannot be before start date.'); return;
    }

    // Repo URL validation (only when GitHub not connected and user typed something)
    if (!githubToken && form.repo.trim() && !GH_REPO_RE.test(form.repo.trim())) {
      setErr('Repository must be a valid GitHub URL (e.g. https://github.com/user/repo).'); return;
    }

    if (githubToken && repoMode === 'new' && !newRepoName.trim()) {
      setErr('Repository name is required when creating a new repo.');
      return;
    }
    setSaving(true);
    try {
      let repoUrl = form.repo.trim() || '—';
      if (githubToken && repoMode === 'new' && newRepoName.trim()) {
        const created = await ghCreateRepo(githubToken, newRepoName.trim(), newRepoPrivate, form.description.trim());
        repoUrl = created.html_url;
      }
      const payload = {
        ...(isEdit ? { id: initial.id, _dbId: initial._dbId, tasks: initial.tasks, openTasks: initial.openTasks, hoursLogged: initial.hoursLogged, progress: initial.progress || 0 } : {
          id: genId(trimmedName), tasks: 0, openTasks: 0, hoursLogged: 0, progress: 0,
        }),
        name: trimmedName,
        client: form.client.trim() || 'Self',
        description: form.description.trim(),
        typeId: form.typeId,
        start: form.start || new Date().toISOString().slice(0, 10),
        end: form.end || '—',
        status: form.status,
        stack: form.stack.split(',').map(s => s.trim()).filter(Boolean),
        hoursEst: parseInt(form.hoursEst) || 0,
        repo: repoUrl,
        budget: form.budget.trim() || '—',
      };
      await onSubmit(payload);
      if (!isEdit) setForm(toForm(null));
      setErr('');
      onClose();
    } catch (e) {
      setErr(e.message || (isEdit ? 'Failed to save changes.' : 'Failed to create project.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel open={open} onClose={onClose}
      title={isEdit ? 'Edit Project' : 'New Project'}
      subtitle={isEdit ? 'WORKSPACE / PROJECTS / EDIT' : 'WORKSPACE / PROJECTS / ADD'}>
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="fld">
          <label>Project name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Kombi — Loyalty App" />
        </div>
        <div className="fld">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Brief overview of the project goals and scope…"
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Client / Owner</label>
            <input value={form.client} onChange={e => set('client', e.target.value)} placeholder="e.g. Roastery Co." />
          </div>
          <div className="fld">
            <label>Type</label>
            <select value={form.typeId} onChange={e => set('typeId', e.target.value)}>
              {projectTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}
            </select>
          </div>
        </div>
        <div className="fld">
          <label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            {['planning', 'progress', 'review', 'done', 'hold'].map(s => (
              <option key={s} value={s}>{({ planning: 'Planning', progress: 'In Progress', review: 'Review', done: 'Done', hold: 'On Hold' })[s]}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label>Tech stack</label>
          <input value={form.stack} onChange={e => set('stack', e.target.value)} placeholder="Flutter, Supabase, Stripe (comma-separated)" />
          <span className="fld-hint">Separate technologies with commas</span>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Start date</label>
            <input type="date" value={form.start} onChange={e => set('start', e.target.value)} />
          </div>
          <div className="fld">
            <label>End date</label>
            <input type="date" value={form.end} onChange={e => set('end', e.target.value)} />
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Budget</label>
            <input value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="e.g. €12,400" />
          </div>
          <div className="fld">
            <label>Est. hours</label>
            <input type="number" min="0" value={form.hoursEst} onChange={e => set('hoursEst', e.target.value)} placeholder="0" />
          </div>
        </div>

        {githubToken ? (
          <>
            <div className="fld">
              <label>Repository</label>
              {/* Card: Select existing */}
              <div className="branch-opt" style={{ marginBottom: 6 }}>
                <label className="branch-opt-toggle" onClick={() => setRepoMode('existing')}>
                  <span className={'branch-opt-check' + (repoMode === 'existing' ? ' on' : '')}>
                    {repoMode === 'existing' && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1.5 6 4.5 9 10.5 3" /></svg>}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>Select existing repository</span>
                </label>
                {repoMode === 'existing' && (
                  <div className="branch-opt-name">
                    <label>Choose repository</label>
                    <RepoSelector repos={ghRepos} loading={ghLoading} value={form.repo} onChange={v => set('repo', v)} />
                  </div>
                )}
              </div>
              {/* Card: Create new */}
              <div className="branch-opt">
                <label className="branch-opt-toggle" onClick={() => setRepoMode('new')}>
                  <span className={'branch-opt-check' + (repoMode === 'new' ? ' on' : '')}>
                    {repoMode === 'new' && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1.5 6 4.5 9 10.5 3" /></svg>}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span>Create new repository</span>
                </label>
                {repoMode === 'new' && (
                  <>
                    <div className="branch-opt-name">
                      <label>Repository name</label>
                      <input
                        value={newRepoName}
                        onChange={e => setNewRepoName(e.target.value)}
                        placeholder="e.g. my-project"
                        spellCheck={false}
                        autoFocus
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', borderTop: '1px solid var(--border)', userSelect: 'none' }}>
                      <input type="checkbox" checked={newRepoPrivate} onChange={e => setNewRepoPrivate(e.target.checked)} />
                      Private repository
                    </label>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="fld">
              <label>Repository</label>
              <input value={form.repo} onChange={e => set('repo', e.target.value)} placeholder="https://github.com/user/repo" />
            </div>
            <GhConnectHint label="Connect GitHub to browse repos, create new ones &amp; auto-link branches." />
          </>
        )}
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit} disabled={saving || !form.name.trim()}>
          {isEdit
            ? <><Icon name="check" size={12} /> {saving ? 'Saving…' : 'Save changes'}</>
            : <><Icon name="plus" size={12} /> {saving ? 'Creating…' : 'Create project'}</>
          }
        </button>
      </div>
    </SlidePanel>
  );
};

// ── Project view panel (read-only) ──────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const ProjectViewPanel = ({ open, onClose, project, onEdit, onDelete, projectTypes = [], tasks = [], statuses = [], githubToken = null, timer = null }) => {
  // All hooks unconditionally before any early return
  const [lastCommit, setLastCommit] = useStateA(null);
  const [commitLoading, setCommitLoading] = useStateA(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useStateA(false);
  const [deleting, setDeleting] = useStateA(false);
  const [deleteRepo, setDeleteRepo] = useStateA(false);
  const [repoDeleteErr, setRepoDeleteErr] = useStateA('');
  const [deleteConfirmText, setDeleteConfirmText] = useStateA('');
  const [hasDeleteScope, setHasDeleteScope] = useStateA(true); // assume true until checked

  const doneId = statuses.find(s => s.isDone)?.id ?? 'done';
  const projectTasks = tasks.filter(t => t.proj === project?.id);
  const totalTasks = projectTasks.length;
  const openTasks = projectTasks.filter(t => t.col !== doneId).length;
  const doneTasks = projectTasks.filter(t => t.col === doneId).length;
  const hasOpenTasks = openTasks > 0;
  const hasActiveTimer = !!(timer?.running && timer?.activeEntry?.projectShort === project?.id);

  const repoFullName = project?.repo && project.repo !== '—'
    ? project.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('?')[0]
    : null;

  // useEffect must be before the early return to keep hook order stable
  useEffectA(() => {
    if (!open) { setShowDeleteConfirm(false); setDeleteRepo(false); setRepoDeleteErr(''); setDeleteConfirmText(''); return; }
    if (!githubToken || !repoFullName) { setLastCommit(null); return; }
    setCommitLoading(true);
    setLastCommit(null);
    ghGetLastCommit(githubToken, repoFullName)
      .then(data => setLastCommit(data?.[0] || null))
      .catch(() => setLastCommit(null))
      .finally(() => setCommitLoading(false));
    // Pre-flight: check if token has delete_repo scope
    ghGetTokenScopes(githubToken)
      .then(scopes => setHasDeleteScope(scopes.includes('delete_repo')))
      .catch(() => setHasDeleteScope(true));
  }, [open, project?.id, repoFullName]);

  if (!project) return null;

  const typeName = projectTypes.find(pt => pt.id === project.typeId)?.label || '—';

  const handleDelete = async () => {
    setDeleting(true);
    setRepoDeleteErr('');
    try {
      // Always delete the project first
      await onDelete(project.id);
      // Optionally delete the GitHub repo
      if (deleteRepo && githubToken && repoFullName) {
        try {
          await ghDeleteRepo(githubToken, repoFullName);
        } catch (repoErr) {
          // Project is already deleted — surface repo error without blocking close
          setRepoDeleteErr(repoErr.message || 'Failed to delete repository.');
          setDeleting(false);
          return;
        }
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <SlidePanel open={open} onClose={onClose}
      title={project.name}
      subtitle={`WORKSPACE / PROJECTS / ${project.id}`}>
      <div className="sp-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <StatusPill status={project.status} />
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>{typeName}</span>
        </div>

        {project.description && (
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>DESCRIPTION</label>
            <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {project.description}
            </div>
          </div>
        )}

        <div className="fld-row">
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>CLIENT / OWNER</label>
            <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{project.client || '—'}</div>
          </div>
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>TIME LOGGED</label>
            <div style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'var(--f-mono)' }}>
              {fmtHours(project.hoursLogged)}
            </div>
          </div>
        </div>

        <div className="fld-row">
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>START DATE</label>
            <div style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'var(--f-mono)' }}>{project.start || '—'}</div>
          </div>
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>END DATE</label>
            <div style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'var(--f-mono)' }}>{project.end || '—'}</div>
          </div>
        </div>

        <div className="fld-row">
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>BUDGET</label>
            <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{project.budget || '—'}</div>
          </div>
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>REPOSITORY</label>
            {project.repo && project.repo !== '—' ? (
              <a
                href={project.repo}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
                  fontSize: 12, color: 'var(--text-1)', background: 'var(--bg-2)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '5px 10px', textDecoration: 'none', fontFamily: 'var(--f-mono)',
                  cursor: 'pointer', width: 'fit-content', maxWidth: '100%', overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-2)'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project.repo.replace(/^https?:\/\/github\.com\//, '') || project.repo}
                </span>
              </a>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-1)' }}>—</div>
            )}
          </div>
        </div>

        {repoFullName && githubToken && (
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>LAST COMMIT</label>
            {commitLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--f-mono)', marginTop: 4 }}>Fetching…</div>
            ) : lastCommit ? (
              <a
                href={lastCommit.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="last-commit-card"
              >
                <div className="lc-top">
                  <span className="lc-sha">{lastCommit.sha.slice(0, 7)}</span>
                  <span className="lc-time">{timeAgo(lastCommit.commit.author.date)}</span>
                </div>
                <div className="lc-msg">{lastCommit.commit.message.split('\n')[0]}</div>
                <div className="lc-author">
                  {lastCommit.author?.avatar_url ? (
                    <img src={lastCommit.author.avatar_url} alt="" className="lc-avatar" />
                  ) : (
                    <span className="lc-avatar lc-avatar-mono">
                      {lastCommit.commit.author.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                  {lastCommit.commit.author.name}
                </div>
              </a>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>No commits found</div>
            )}
          </div>
        )}

        {repoFullName && !githubToken && (
          <GhConnectHint label="Connect GitHub to see last commit activity and manage this repo." />
        )}

        {(project.stack || []).length > 0 && (
          <div className="fld">
            <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>TECH STACK</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {project.stack.map(s => <span key={s} className="tag">{s}</span>)}
            </div>
          </div>
        )}

        <div className="fld">
          <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>TASKS</label>
          <div style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'var(--f-mono)' }}>
            {totalTasks} total · {openTasks} open · {doneTasks} done
          </div>
        </div>

        {/* ── Hours ── */}
        {(() => {
          const logged = project.hoursLogged || 0;
          const est    = project.hoursEst    || 0;
          const pct    = est > 0 ? Math.min(100, Math.round((logged / est) * 100)) : null;
          const over   = est > 0 && logged > est;
          const budgetAmt  = parseBudgetAmount(project.budget);
          const hourlyRate = budgetAmt && est > 0 ? (budgetAmt / est) : null;
          const burnAmt    = hourlyRate ? (hourlyRate * logged) : null;
          const burnPct    = budgetAmt && burnAmt ? Math.round((burnAmt / budgetAmt) * 100) : null;
          return (
            <div className="fld">
              <label style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>HOURS</label>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--f-mono)', color: 'var(--text-2)', marginTop: 4 }}>
                <span><span style={{ color: 'var(--text-3)' }}>LOGGED </span>{fmtHours(logged)}</span>
                {est > 0 && <span><span style={{ color: 'var(--text-3)' }}>EST </span>{fmtHours(est)}</span>}
                {pct !== null && <span style={{ color: over ? '#ef4444' : 'var(--accent)' }}>{pct}%</span>}
              </div>
              {est > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-3)', marginTop: 6 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: over ? '#ef4444' : 'var(--accent)',
                    width: `${Math.min(100, pct)}%`, transition: 'width 0.3s',
                  }} />
                </div>
              )}
              {budgetAmt && hourlyRate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-3)', marginTop: 6 }}>
                  <span>Rate {project.budget?.replace(/[0-9,. ]+/, '')||''}{ hourlyRate.toFixed(0)}/h</span>
                  {burnAmt !== null && <span style={{ color: burnPct > 90 ? '#ef4444' : burnPct > 70 ? '#f59e0b' : 'var(--text-3)' }}>
                    Burn {burnPct}%
                  </span>}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Danger card ──────────────────────────────────── */}
        <div className="danger-card">
          <div className="danger-card-title">Delete this project</div>
          <div className="danger-card-desc">
            This project and all its tasks will be soft-deleted and hidden from your workspace. No data is permanently removed.
          </div>

          {/* Warnings — informational only, deletion is always allowed */}
          {(hasOpenTasks || hasActiveTimer || totalTasks > 0) && (
            <div className="danger-block-list" style={{ borderColor: '#f59e0b30', background: '#f59e0b08' }}>
              {hasActiveTimer && (
                <div className="danger-block-item" style={{ color: '#f59e0b' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Timer is currently running on this project — it will continue but the project will be hidden
                </div>
              )}
              {hasOpenTasks && (
                <div className="danger-block-item" style={{ color: '#f59e0b' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {openTasks} open task{openTasks > 1 ? 's' : ''} will be soft-deleted along with this project
                </div>
              )}
              {doneTasks > 0 && (
                <div className="danger-block-item" style={{ color: '#f59e0b' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {doneTasks} completed task{doneTasks > 1 ? 's' : ''} will be soft-deleted along with this project
                </div>
              )}
            </div>
          )}

          {/* Scope pre-flight warning */}
          {repoFullName && githubToken && !hasDeleteScope && (
            <div style={{ fontSize: 11, marginBottom: 8, padding: '8px 12px', background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: 8, lineHeight: 1.6, color: '#f59e0b' }}>
              Your GitHub token is missing the <code style={{ fontFamily: 'var(--f-mono)', background: '#f59e0b20', padding: '1px 4px', borderRadius: 3 }}>delete_repo</code> scope — repo deletion will fail. Go to <strong>Settings → Integrations</strong> and reconnect GitHub to grant it.
            </div>
          )}

          {/* Optional: also delete the linked GitHub repo */}
          {repoFullName && githubToken && (
            <div
              className={'danger-repo-opt' + (deleteRepo ? ' active' : '')}
              onClick={() => { setDeleteRepo(d => !d); setRepoDeleteErr(''); }}
            >
              <div className={'danger-repo-check' + (deleteRepo ? ' on' : '')}>
                {deleteRepo && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="1.5 6 4.5 9 10.5 3" />
                  </svg>
                )}
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <div className="danger-repo-label">
                <div className="danger-repo-name">Also delete GitHub repository</div>
                <div className="danger-repo-slug">{repoFullName}</div>
              </div>
            </div>
          )}

          {repoDeleteErr && (
            <div style={{ fontSize: 11, marginBottom: 10, padding: '10px 12px', background: '#ef444412', border: '1px solid #ef444430', borderRadius: 8, lineHeight: 1.6 }}>
              {repoDeleteErr === '__RECONNECT__' ? (
                <>
                  <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>Repository deletion failed — permission required</div>
                  <div style={{ color: 'var(--text-2)' }}>
                    Your GitHub token doesn't have the <code style={{ fontFamily: 'var(--f-mono)', background: '#ef444420', padding: '1px 4px', borderRadius: 3 }}>delete_repo</code> scope.
                    Go to <strong>Settings → Integrations</strong> and reconnect GitHub to grant it.
                  </div>
                </>
              ) : (
                <div style={{ color: '#ef4444' }}>Project deleted, but repo removal failed: {repoDeleteErr}</div>
              )}
            </div>
          )}

          {!showDeleteConfirm ? (
            <button
              className="btn danger"
              style={{ fontSize: 12, width: '100%' }}
              onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(''); }}
            >
              Delete project{deleteRepo && repoFullName && githubToken ? ' & repository' : ''}
            </button>
          ) : (() => {
            const repoShortName = repoFullName ? repoFullName.split('/')[1] : null;
            const requiredText = deleteRepo && repoShortName ? repoShortName : project.name;
            const isMatch = deleteConfirmText === requiredText;
            const hasTyped = deleteConfirmText.length > 0;
            return (
              <>
                <div className="delete-confirm-box">
                  <div className="delete-confirm-hint">
                    Type <span className="delete-confirm-required">{requiredText}</span> to confirm
                  </div>
                  <div className="delete-confirm-input-wrap">
                    <input
                      className={'delete-confirm-input' + (hasTyped ? (isMatch ? ' match' : ' no-match') : '')}
                      placeholder={requiredText}
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {hasTyped && (
                      <span className={'delete-confirm-icon' + (isMatch ? ' ok' : ' fail')}>
                        {isMatch
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        }
                      </span>
                    )}
                  </div>
                </div>
                <div className="danger-confirm-row">
                  <button className="btn ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} disabled={deleting}>
                    Cancel
                  </button>
                  <button className="btn danger" style={{ flex: 1, fontSize: 12 }} onClick={handleDelete} disabled={deleting || !isMatch}>
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={onEdit}>
          <Icon name="edit" size={12} /> Edit project
        </button>
      </div>
    </SlidePanel>
  );
};

export const ProjectsPage = ({ projects, setProjects, workstationId, projectTypes = [], tasks = [], setTasks, statuses = [], githubToken = null, timer = null }) => {
  const [view, setView] = useStateA('card');
  const [filter, setFilter] = useStateA('all');
  const [search, setSearch] = useStateA('');
  const [showAdd, setShowAdd] = useStateA(false);
  const [viewing, setViewing] = useStateA(null); // project open in view panel
  const [editing, setEditing] = useStateA(null); // project being edited
  const [indStyle, setIndStyle] = useStateA({ left: 0, width: 0 });
  const itemRefs = useRefA({});

  useEffectA(() => {
    const el = itemRefs.current[filter];
    if (el) {
      setIndStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [filter]);

  const q = search.trim().toLowerCase();
  const filtered = projects.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.client?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      (p.stack || []).some(s => s.toLowerCase().includes(q))
    );
  });

  const handleAdd = async (project) => {
    const saved = await createProject(project, workstationId);
    setProjects(prev => [saved, ...prev]);
  };

  const handleEdit = async (project) => {
    const saved = await updateProject(project);
    setProjects(prev => prev.map(p => p.id === saved.id ? saved : p));
  };

  const handleDelete = async (shortId) => {
    await softDeleteProject(shortId);
    setProjects(prev => prev.filter(p => p.id !== shortId));
    setTasks?.(prev => prev.filter(t => t.proj !== shortId));
    setViewing(null);
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE / PROJECTS</div>
          <h1>Projects</h1>
          <div className="sub">{projects.length} total · {projects.filter(p => p.status === 'progress').length} active · {projects.filter(p => p.status === 'planning').length} in planning</div>
        </div>
        <div className="actions">
          <div className="view-toggle">
            <button className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}>CARDS</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>LIST</button>
          </div>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12} /> New project
          </button>
        </div>
      </div>

      <div className="filter-row-premium">
        <div className="filter-bar">
          <div className="sliding-indicator" style={{ left: indStyle.left, width: indStyle.width }} />
          {['all', 'planning', 'progress', 'review', 'done', 'hold'].map(f => (
            <button
              key={f}
              ref={el => itemRefs.current[f] = el}
              className={'chip' + (filter === f ? ' active' : '')}
              onClick={() => setFilter(f)}
            >
              <span className="dot-p" style={{ background: `var(--st-${f === 'all' ? 'planning' : f})` }} />
              {f === 'all' ? 'All' : ({ planning: 'Planning', progress: 'In Progress', review: 'Review', done: 'Done', hold: 'On Hold' })[f]}
            </button>
          ))}
        </div>
        <div className="task-search-wrap">
          <Icon name="search" size={12} />
          <input
            className="task-search-input"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="task-search-clear" onClick={() => setSearch('')}>
              <Icon name="x" size={10} />
            </button>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <Icon name="folder" size={32} />
          <div className="empty-title">No projects yet</div>
          <div className="empty-sub">Create your first project to start tracking work, hours, and progress.</div>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12} /> New project
          </button>
        </div>
      ) : view === 'card' ? (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Icon name="folder" size={28} />
              <div className="empty-title">No projects found</div>
              <div className="empty-sub">{q ? `No results for "${search}".` : 'Try selecting a different status.'}</div>
            </div>
          ) : (
            <div className="proj-grid">
              {filtered.map(p => (
                <div key={p.id} className="proj-card" style={{ cursor: 'pointer' }} onClick={() => setViewing(p)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div className="client">{projectTypes.find(pt => pt.id === p.typeId)?.label || '—'}</div>
                      <div className="name" style={{ marginTop: 4 }}>{p.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StatusPill key={p.status} status={p.status} />
                      <button
                        className="btn sm ghost"
                        style={{ padding: '3px 6px' }}
                        onClick={e => { e.stopPropagation(); setEditing(p); }}
                        title="Edit project"
                      >
                        <Icon name="edit" size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{p.client}</div>
                  {p.description && (
                    <div style={{
                      color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5, marginTop: 6,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {p.description}
                    </div>
                  )}
                  <div className="stack">{(p.stack || []).map(s => <span key={s} className="tag">{s}</span>)}</div>
                  <div className="dates">
                    <span>START {fmtDate(p.start)}</span>
                    <span>END {fmtDate(p.end)}</span>
                  </div>
                  <div className="row-end">
                    <span className="pct">{p.tasks} tasks ({p.openTasks} open)</span>
                    <span className="pct">{fmtHours(p.hoursLogged)} logged</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <table className="tbl">
            <thead><tr>
              <th>Project</th><th>Client</th><th>Status</th><th>Stack</th>
              <th>Tasks</th><th>Hours</th><th>End</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>{q ? `No results for "${search}".` : 'No projects match this filter.'}</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setViewing(p)}>
                  <td><b>{p.name}</b></td>
                  <td>{p.client}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(p.stack || []).slice(0, 2).map(s => <span key={s} className="tag">{s}</span>)}
                      {(p.stack || []).length > 2 && <span className="tag">+{p.stack.length - 2}</span>}
                    </div>
                  </td>
                  <td className="mono">{p.openTasks}/{p.tasks}</td>
                  <td className="mono">{fmtHours(p.hoursLogged)}</td>
                  <td className="mono">{fmtDate(p.end)}</td>
                  <td>
                    <button className="btn sm ghost" onClick={e => { e.stopPropagation(); setEditing(p); }} title="Edit project">
                      <Icon name="edit" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProjectViewPanel
        open={!!viewing && !editing}
        onClose={() => setViewing(null)}
        project={viewing}
        projectTypes={projectTypes}
        tasks={tasks}
        statuses={statuses}
        githubToken={githubToken}
        timer={timer}
        onEdit={() => { setEditing(viewing); setViewing(null); }}
        onDelete={handleDelete}
      />
      <ProjectFormPanel open={showAdd} onClose={() => setShowAdd(false)} onSubmit={handleAdd} projectTypes={projectTypes} githubToken={githubToken} projects={projects} />
      <ProjectFormPanel open={!!editing} onClose={() => setEditing(null)} onSubmit={handleEdit} projectTypes={projectTypes} githubToken={githubToken} initial={editing} projects={projects} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  3. TASKS — Kanban
// ═══════════════════════════════════════════════════════════════════

// Fallback used only before statuses load from DB — id=key so byCol still works
const COL_DEFS = [
  { id: 'backlog', key: 'backlog', label: 'Backlog', color: '#555555' },
  { id: 'todo', key: 'todo', label: 'To Do', color: '#888888' },
  { id: 'progress', key: 'progress', label: 'In Progress', color: '#0099ff' },
  { id: 'review', key: 'review', label: 'Review', color: '#f59e0b' },
  { id: 'done', key: 'done', label: 'Done', color: '#22c55e', isDone: true },
];

// ── Tag colour palette for new tags created inline ─────────────────
const TAG_COLORS = ['#888888', '#ef4444', '#f59e0b', '#22c55e', '#0099ff', '#8b5cf6', '#ec4899', '#06b6d4'];

// ── TagPicker — select existing tags or create new ones inline ──────
const TagPicker = ({ selectedIds = [], onChange, allTags = [], onCreateTag }) => {
  const [input, setInput] = useStateA('');
  const [open, setOpen] = useStateA(false);
  const [creating, setCreating] = useStateA(false);
  const ref = useRefA(null);

  useEffectA(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = allTags.filter(t => selectedIds.includes(t.id));
  const trimmed = input.trim();
  const filtered = allTags.filter(t =>
    !selectedIds.includes(t.id) &&
    t.name.toLowerCase().includes(trimmed.toLowerCase())
  );
  const canCreate = trimmed && !allTags.some(t => t.name.toLowerCase() === trimmed.toLowerCase());

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    setInput('');
  };

  const handleCreate = async () => {
    if (!trimmed || creating) return;
    const color = TAG_COLORS[allTags.length % TAG_COLORS.length];
    setCreating(true);
    try {
      const tag = await onCreateTag(trimmed, color);
      onChange([...selectedIds, tag.id]);
      setInput('');
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate(); }
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Backspace' && !input && selected.length > 0) {
      onChange(selectedIds.slice(0, -1));
    }
  };

  return (
    <div className="tag-picker" ref={ref}>
      <div className="tag-picker-field" onClick={() => { setOpen(true); ref.current?.querySelector('.tag-picker-input')?.focus(); }}>
        {selected.map(t => (
          <span key={t.id} className="tag-chip" style={{ '--chip-color': t.color }}>
            <span className="tag-chip-dot" style={{ background: t.color }} />
            {t.name}
            <button className="tag-chip-x" onMouseDown={e => { e.preventDefault(); toggle(t.id); }}>×</button>
          </span>
        ))}
        <input
          className="tag-picker-input"
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? 'Add tags…' : ''}
        />
      </div>
      {open && (filtered.length > 0 || canCreate) && (
        <div className="tag-picker-dropdown">
          {filtered.map(t => (
            <button key={t.id} className="tag-picker-opt" onMouseDown={e => { e.preventDefault(); toggle(t.id); }}>
              <span className="tag-opt-dot" style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
          {canCreate && (
            <button className="tag-picker-opt create" onMouseDown={e => { e.preventDefault(); handleCreate(); }} disabled={creating}>
              <Icon name="plus" size={11} /> Create &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const TaskCard = ({ t, tasks, projects, allTags = [], doneStatusId, onDragStart, onDragEnd, onClick }) => {
  const proj = projects.find(p => p.id === t.proj);
  const subs = tasks ? tasks.filter(s => s.parentId === t._dbId) : [];
  const subsDone = doneStatusId ? subs.filter(s => s.col === doneStatusId).length : 0;
  const isDone = doneStatusId && t.col === doneStatusId;
  return (
    <div
      className={'tcard' + (isDone ? ' tcard-done' : getDueClass(t.due).includes('overdue') ? ' overdue' : '')}
      draggable
      onDragStart={(e) => onDragStart(e, t)}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="top">
        <span key={t.p} className={'dot-p p' + t.p}></span>
        <span className="id">{t.id}</span>
        {(t.tags || []).slice(0, 2).map(id => {
          const tag = allTags.find(x => x.id === id);
          return tag ? <span key={id} className="tag" style={{ fontSize: 9, borderColor: tag.color, color: tag.color }}>{tag.name}</span> : null;
        })}
        {t.tags && t.tags.length > 2 && (
          <span className="tag-more">+{t.tags.length - 2}</span>
        )}
      </div>
      <div className="title">{t.title}</div>
      <div className="proj">→ {proj?.name || t.proj}</div>
      <div className="foot">
        {subs.length > 0 && (
          <div className="subs"><Icon name="list" size={10} /> {subsDone}/{subs.length}</div>
        )}
      </div>
    </div>
  );
};

// ── Note view overlay (shown on top of task panel) ─────────────────
const NoteViewOverlay = ({ note, onClose }) => {
  useEffectA(() => {
    const h = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);

  return (
    <div className="note-overlay">
      <div className="note-overlay-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="note" size={14} />
          <span className="note-overlay-title">{note.title}</span>
        </div>
        <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
      </div>
      <div className="note-overlay-meta">
        <span>{(note.folder || 'General').toUpperCase()}</span>
        <span>·</span>
        <span>EDITED {(note.edited || '').toUpperCase()}</span>
      </div>
      <div
        className="note-overlay-body note-preview"
        dangerouslySetInnerHTML={{ __html: renderMd(note.body || '') }}
      />
    </div>
  );
};

// ── Description field with link rendering & previews ──────────────
const URL_RE = /https?:\/\/[^\s<>"']+/g;

const extractUrls = (text) => {
  const found = [];
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (!found.includes(m[0])) found.push(m[0]);
  }
  return found;
};

const renderDescription = (text) => {
  if (!text) return null;
  const parts = [];
  let last = 0;
  let match;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    let label;
    try { label = new URL(url).hostname.replace(/^www\./, ''); } catch { label = url; }
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="desc-link"
        onClick={e => e.stopPropagation()}>
        {label}
      </a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

// ── Link preview — instant, no external API ────────────────────────
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i;
const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const GH_RE = /github\.com\/([^/]+\/[^/\s?#]+)/;

const getLinkMeta = (url) => {
  let hostname;
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { hostname = url; }

  const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  // Direct image URL — show the image itself
  if (IMAGE_EXT_RE.test(url)) {
    return { type: 'image', thumb: url, title: url.split('/').pop().split('?')[0], hostname, favicon };
  }

  // YouTube — known thumbnail pattern, zero API call
  const yt = url.match(YT_RE);
  if (yt) {
    return { type: 'youtube', thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`, title: 'YouTube Video', hostname: 'youtube.com', favicon };
  }

  // GitHub repo — social preview image follows a known pattern
  const gh = url.match(GH_RE);
  if (gh) {
    return { type: 'github', thumb: `https://opengraph.githubassets.com/1/${gh[1]}`, title: gh[1], hostname: 'github.com', favicon };
  }

  // Everything else — favicon + hostname only, instant
  return { type: 'link', thumb: null, title: hostname, hostname, favicon };
};

const LinkPreview = ({ url }) => {
  const baseMeta = getLinkMeta(url);
  const [meta, setMeta] = useStateA(baseMeta);
  const [ogLoading, setOgLoading] = useStateA(baseMeta.type === 'link');

  useEffectA(() => {
    if (baseMeta.type !== 'link') return;
    let cancelled = false;
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.status === 'success') {
          const { title, image, logo } = data.data || {};
          setMeta(prev => ({
            ...prev,
            title: title || prev.title,
            thumb: image?.url || prev.thumb,
            favicon: logo?.url || prev.favicon,
          }));
        }
        setOgLoading(false);
      })
      .catch(() => setOgLoading(false));
    return () => { cancelled = true; };
  }, [url]);

  const showThumb = meta.thumb && meta.type !== 'image';
  const showThumbPlaceholder = ogLoading && !showThumb;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={'link-preview-card' + (meta.type === 'image' ? ' link-preview-card-image' : '')}
      onClick={e => e.stopPropagation()}
    >
      {(showThumb || showThumbPlaceholder) && (
        <div className={'link-preview-thumb' + (showThumbPlaceholder ? ' link-preview-thumb-loading' : '')}>
          {showThumb && (
            <img
              src={meta.thumb}
              alt=""
              onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
            />
          )}
        </div>
      )}
      {meta.type === 'image' ? (
        <img
          src={meta.thumb}
          alt={meta.title}
          className="link-preview-full-img"
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="link-preview-body">
          <div className="link-preview-title-row">
            <img src={meta.favicon} alt="" className="link-preview-favicon"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
            <span className="link-preview-title">{meta.title}</span>
          </div>
          <div className="link-preview-url">{meta.hostname}</div>
        </div>
      )}
    </a>
  );
};

const DescriptionField = ({ value, onChange }) => {
  const [editing, setEditing] = useStateA(false);
  const taRef = useRefA(null);
  const urls = editing ? [] : extractUrls(value || '').slice(0, 3);

  useEffectA(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      const len = taRef.current.value.length;
      taRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  if (editing) {
    return (
      <div>
        <div className="tpanel-section">Description</div>
        <textarea
          ref={taRef}
          className="tpanel-desc"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Add a description — scope, context, acceptance criteria…"
          rows={5}
          onBlur={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="tpanel-section">Description</div>
      <div
        className={'tpanel-desc-view' + (!value ? ' tpanel-desc-empty' : '')}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value
          ? renderDescription(value).map((part, i) =>
            typeof part === 'string'
              ? part.split('\n').map((line, j, arr) => (
                <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
              ))
              : part
          )
          : 'Add a description — scope, context, acceptance criteria…'
        }
      </div>
      {urls.length > 0 && (
        <div className="link-previews">
          {urls.map(u => <LinkPreview key={u} url={u} />)}
        </div>
      )}
    </div>
  );
};

// ── Task Detail Panel (Jira-style right drawer) ────────────────────
const P_DOT_COLOR = { 1: '#ef4444', 2: 'var(--accent)', 3: 'var(--text-3)' };

const fmtMin = (min) => {
  if (!min || min < 1) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const TaskDetailModal = ({
  task, projects, statuses = [], subtasks = [], allTasks = [], onClose, onSave, onStatusChange,
  onAddSubtask, onLinkSubtask, onOpenSubtask, parentTask, onBack,
  allTags = [], onCreateTag,
  notes = [], linkedNoteIds = [], onLinkNote, onUnlinkNote,
  onLogTime, githubToken = null, onBranchUpdate, onDelete,
}) => {
  // Keyed by status UUID so lookups work after task.col became a UUID
  const COL_COLOR = Object.fromEntries(statuses.map(s => [s.id, s.color]));
  const COL_LABEL = Object.fromEntries(statuses.map(s => [s.id, s.label]));
  const proj = projects.find(p => p.id === task.proj);

  // 'done' status UUID — used for subtask completion percentage
  const doneStatusId = statuses.find(s => s.isDone)?.id;

  // Only allow moving to the immediately adjacent status in sequence
  const taskColIdx = statuses.findIndex(s => s.id === task.col);
  const isAllowedStatus = (id) => {
    const idx = statuses.findIndex(s => s.id === id);
    return Math.abs(idx - taskColIdx) <= 1;
  };

  const toForm = (t) => ({
    title: t.title,
    description: t.description || '',
    col: t.col,
    p: String(t.p),
    due: (!t.due || t.due === '—') ? '' : t.due,
    tagIds: t.tags || [],
  });

  const [form, setForm] = useStateA(() => toForm(task));
  const [saving, setSaving] = useStateA(false);
  const [err, setErr] = useStateA('');
  const [showSubForm, setShowSubForm] = useStateA(false);

  // Manual time log state
  const [showLogTime, setShowLogTime] = useStateA(false);
  const [logMin, setLogMin] = useStateA('');
  const [logNote, setLogNote] = useStateA('');
  const [logSaving, setLogSaving] = useStateA(false);

  const handleLogTime = async () => {
    const minutes = parseInt(logMin) || 0;
    if (minutes <= 0) return;
    const projDbId = projects.find(p => p.id === task.proj)?._dbId;
    if (!projDbId) return;
    setLogSaving(true);
    try {
      await onLogTime(task._dbId, projDbId, minutes, logNote);
      setShowLogTime(false);
      setLogMin(''); setLogNote('');
    } catch (e) {
      console.error('Failed to log time:', e);
    } finally {
      setLogSaving(false);
    }
  };

  // Status history
  const [statusLogs, setStatusLogs] = useStateA([]);
  const [logsLoading, setLogsLoading] = useStateA(false);
  const [statusSaving, setStatusSaving] = useStateA(false);
  const [logsVisible, setLogsVisible] = useStateA(10);
  const LOG_PAGE = 10;

  useEffectA(() => {
    if (!task._dbId) return;
    setLogsLoading(true);
    getTaskStatusLogs(task._dbId)
      .then(setStatusLogs)
      .catch(() => setStatusLogs([]))
      .finally(() => setLogsLoading(false));
  }, [task._dbId]);

  const reloadStatusLogs = () => {
    if (!task._dbId) return;
    getTaskStatusLogs(task._dbId).then(setStatusLogs).catch(() => { });
  };

  const handleStatusChange = async (newStatusId) => {
    if (!onStatusChange || newStatusId === task.col) return;
    set('col', newStatusId);
    setStatusSaving(true);
    try {
      await onStatusChange({ ...task, col: newStatusId });
      reloadStatusLogs();
    } catch (e) {
      set('col', task.col); // rollback on error
      console.error('Status change failed:', e);
    } finally {
      setStatusSaving(false);
    }
  };

  // Linked notes state
  const [viewingNote, setViewingNote] = useStateA(null);
  const [showNotePicker, setShowNotePicker] = useStateA(false);
  const [noteQ, setNoteQ] = useStateA('');
  const [noteLinking, setNoteLinking] = useStateA(false);
  const notePickerRef = useRefA(null);

  const linkedNotes = linkedNoteIds.map(id => notes.find(n => n.id === id)).filter(Boolean);
  const availableNotes = notes.filter(n => !linkedNoteIds.includes(n.id));
  const filteredAvail = availableNotes.filter(n =>
    !noteQ || n.title.toLowerCase().includes(noteQ.toLowerCase())
  );

  // Close note picker on outside click
  useEffectA(() => {
    if (!showNotePicker) return;
    const h = (e) => {
      if (notePickerRef.current && !notePickerRef.current.contains(e.target))
        setShowNotePicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showNotePicker]);

  const handleAttachNote = async (noteId) => {
    setNoteLinking(true);
    try {
      await onLinkNote(noteId);
      setShowNotePicker(false);
      setNoteQ('');
    } catch (e) {
      console.error('Failed to link note:', e);
    } finally {
      setNoteLinking(false);
    }
  };

  const handleDetachNote = async (noteId) => {
    try { await onUnlinkNote(noteId); }
    catch (e) { console.error('Failed to unlink note:', e); }
  };

  // GitHub branch management
  const taskProjObj = projects.find(p => p.id === task.proj);
  const taskRepoFull = taskProjObj?.repo && taskProjObj.repo !== '—'
    ? taskProjObj.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('?')[0]
    : null;
  const showBranchSection = !!githubToken && !!taskRepoFull;

  const [ghBranch, setGhBranch] = useStateA(task.ghBranch || '');
  const [branches, setBranches] = useStateA([]);
  const [branchesLoading, setBranchesLoading] = useStateA(false);
  const [branchMode, setBranchMode] = useStateA('none'); // 'none' | 'switch' | 'create' — which is checked
  const [branchOpen, setBranchOpen] = useStateA(false);  // whether the form is expanded
  const [newBranchName, setNewBranchName] = useStateA('');
  const [branchSaving, setBranchSaving] = useStateA(false);
  const [branchErr, setBranchErr] = useStateA('');

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useStateA(false);
  const [deleteBranch, setDeleteBranch] = useStateA(false);
  const [deletingTask, setDeletingTask] = useStateA(false);
  const [deleteErr, setDeleteErr] = useStateA('');

  useEffectA(() => {
    if (!showBranchSection || branchMode !== 'switch' || !branchOpen) return;
    setBranchesLoading(true);
    ghGetBranches(githubToken, taskRepoFull)
      .then(data => setBranches(data.map(b => b.name)))
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
  }, [branchMode, branchOpen, showBranchSection]);

  const handleBranchSave = async () => {
    const name = branchMode === 'create' ? newBranchName.trim() : ghBranch;
    if (!name) { setBranchErr('Branch name is required.'); return; }
    setBranchSaving(true);
    setBranchErr('');
    try {
      if (branchMode === 'create') {
        await ghCreateBranch(githubToken, taskRepoFull, name);
      }
      await onBranchUpdate({ ...task, ghBranch: name });
      setGhBranch(name);
      setBranchOpen(false); // collapse form but keep checkmark
    } catch (e) {
      setBranchErr(e.message || 'Failed to update branch.');
    } finally {
      setBranchSaving(false);
    }
  };

  const handleBranchDisconnect = async () => {
    setBranchSaving(true);
    setBranchErr('');
    try {
      await onBranchUpdate({ ...task, ghBranch: '' });
      setGhBranch('');
      setBranchMode('none');
      setBranchOpen(false);
    } catch (e) {
      setBranchErr(e.message || 'Failed to disconnect branch.');
    } finally {
      setBranchSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    setDeletingTask(true);
    setDeleteErr('');
    try {
      if (deleteBranch && githubToken && taskRepoFull && task.ghBranch) {
        await ghDeleteBranch(githubToken, taskRepoFull, task.ghBranch);
      }
      await onDelete(task);
    } catch (e) {
      setDeleteErr(e.message || 'Failed to delete task.');
      setDeletingTask(false);
    }
  };

  useEffectA(() => {
    setForm(toForm(task)); setErr(''); setShowSubForm(false);
    setShowLogTime(false); setLogMin(''); setLogNote('');
    setLogsVisible(10);
    setGhBranch(task.ghBranch || '');
    setBranchMode('none'); setBranchOpen(false); setBranchErr(''); setNewBranchName('');
    setShowDeleteConfirm(false); setDeleteBranch(false); setDeleteErr('');
  }, [task.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffectA(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handleSave = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    setSaving(true);
    try {
      await onSave({
        ...task,
        title: form.title.trim(),
        description: form.description,
        col: form.col,
        p: parseInt(form.p),
        due: form.due || '—',
        tags: form.tagIds,
      });
    } catch (e) {
      setErr(e.message || 'Failed to save.');
      setSaving(false);
    }
  };

  // ── Subtask add form ────────────────────────────────────────────
  // Default subtask status: the first status in sequence (index 0)
  const defaultStatusId = statuses[0]?.id || '';
  const subEmpty = { title: '', description: '', p: '2', col: defaultStatusId, due: '', tagIds: [] };
  const [subForm, setSubForm] = useStateA(subEmpty);
  const [subSaving, setSubSaving] = useStateA(false);
  const [subErr, setSubErr] = useStateA('');
  const setSub = (k, v) => setSubForm(f => ({ ...f, [k]: v }));

  // Link existing task as subtask
  const [showLinkForm, setShowLinkForm] = useStateA(false);
  const [linkQ, setLinkQ] = useStateA('');
  const [linkSaving, setLinkSaving] = useStateA(false);
  const [linkErr, setLinkErr] = useStateA('');

  const subtaskDbIds = new Set(subtasks.map(s => s._dbId));
  const linkableTasks = allTasks.filter(t =>
    t._dbId !== task._dbId &&
    !subtaskDbIds.has(t._dbId) &&
    !t.parentId &&
    !wouldCreateCycle(allTasks, task._dbId, t._dbId)
  );
  const lq = linkQ.trim().toLowerCase();
  const filteredLinkable = lq
    ? linkableTasks.filter(t => t.title.toLowerCase().includes(lq) || t.id.toLowerCase().includes(lq))
    : linkableTasks;

  const handleLinkExisting = async (childTask) => {
    setLinkSaving(true);
    setLinkErr('');
    try {
      await onLinkSubtask(childTask);
      setShowLinkForm(false);
      setLinkQ('');
    } catch (e) {
      setLinkErr(e.message || 'Failed to link task.');
    } finally {
      setLinkSaving(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!subForm.title.trim()) { setSubErr('Title is required.'); return; }
    setSubSaving(true);
    try {
      await onAddSubtask({
        proj: task.proj,
        col: subForm.col,
        p: parseInt(subForm.p),
        title: subForm.title.trim(),
        description: subForm.description,
        due: subForm.due || '—',
        tags: subForm.tagIds,
        parentId: task._dbId,
      });
      setSubForm(subEmpty);
      setSubErr('');
      setShowSubForm(false);
    } catch (e) {
      setSubErr(e.message || 'Failed to add subtask.');
    } finally {
      setSubSaving(false);
    }
  };

  const doneCount = subtasks.filter(s => s.col === doneStatusId).length;
  const subPct = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  const createdStr = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="task-panel-backdrop" onClick={onClose}>
      <div className="task-panel" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>

        {/* ── Header ── */}
        <div className="task-panel-header">
          <div className="task-panel-breadcrumb">
            {parentTask && (
              <button className="subtask-back-btn" onClick={onBack}>
                ← {parentTask.title.length > 30 ? parentTask.title.slice(0, 30) + '…' : parentTask.title}
              </button>
            )}
            <span className="task-id-chip">{task.id}</span>
            {parentTask && <span className="tag" style={{ background: 'var(--bg-3)' }}>subtask</span>}
            <span className="tag" style={{ background: 'var(--bg-3)' }}>{proj?.name || task.proj}</span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {/* ── Two-column layout ── */}
        <div className="task-panel-layout">

          {/* Main (left) */}
          <div className="task-panel-main">
            {err && <div className="sp-error">{err}</div>}

            {/* Title */}
            <div>
              <div className="tpanel-section">Title</div>
              <textarea
                className="tpanel-title"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                rows={2}
                placeholder="Task title…"
              />
            </div>

            {/* Description */}
            <DescriptionField
              value={form.description}
              onChange={v => set('description', v)}
            />

            {/* Subtasks — only on parent tasks */}
            {!parentTask && (
              <div>
                <div className="tpanel-section">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="list" size={12} />
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="subtasks-count">{doneCount}/{subtasks.length}</span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm ghost" style={{ fontSize: 11 }}
                      onClick={() => { setShowLinkForm(s => !s); setLinkQ(''); setLinkErr(''); setShowSubForm(false); }}>
                      {showLinkForm ? 'Cancel' : <><Icon name="link" size={10} /> Link</>}
                    </button>
                    <button className="btn sm ghost" style={{ fontSize: 11 }}
                      onClick={() => { setShowSubForm(s => !s); setSubErr(''); setShowLinkForm(false); }}>
                      {showSubForm ? 'Cancel' : <><Icon name="plus" size={10} /> Add</>}
                    </button>
                  </div>
                </div>

                {subtasks.length > 0 && (
                  <div className="tpanel-subs-progress">
                    <div className="tpanel-subs-bar">
                      <div className="tpanel-subs-fill" style={{ width: subPct + '%' }} />
                    </div>
                    <span className="tpanel-subs-pct">{subPct}%</span>
                  </div>
                )}

                {subtasks.length > 0 && (
                  <div className="subtasks-list">
                    {subtasks.map(sub => (
                      <div key={sub.id} className="subtask-row" onClick={() => onOpenSubtask(sub)}>
                        <span className={'dot-p p' + sub.p} />
                        <span className="subtask-title">{sub.title}</span>
                        <span className="subtask-meta">
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: COL_COLOR[sub.col], textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {COL_LABEL[sub.col]}
                          </span>
                          {sub.due && sub.due !== '—' && (
                            <span className={getDueClass(sub.due)}>
                              {getDueClass(sub.due).includes('overdue') && <Icon name="alert" size={10} />}
                              {formatDate(sub.due)}
                            </span>
                          )}
                        </span>
                        <Icon name="chev" size={10} />
                      </div>
                    ))}
                  </div>
                )}

                {subtasks.length === 0 && !showSubForm && (
                  <div className="subtasks-empty">No subtasks — break this into smaller pieces.</div>
                )}

                {showSubForm && (
                  <div className="subtask-form">
                    {subErr && <div className="sp-error" style={{ marginBottom: 6 }}>{subErr}</div>}
                    <div className="fld">
                      <label>Subtask title *</label>
                      <input value={subForm.title} onChange={e => setSub('title', e.target.value)}
                        placeholder="What needs to be done?" autoFocus />
                    </div>
                    <div className="fld-row">
                      <div className="fld">
                        <label>Status</label>
                        <select value={subForm.col} onChange={e => setSub('col', e.target.value)}>
                          {(statuses.length > 0 ? statuses : COL_DEFS).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="fld">
                        <label>Priority</label>
                        <select value={subForm.p} onChange={e => setSub('p', e.target.value)}>
                          <option value="1">P1 — Critical</option>
                          <option value="2">P2 — Normal</option>
                          <option value="3">P3 — Low</option>
                        </select>
                      </div>
                    </div>
                    <div className="fld">
                      <label>Due date</label>
                      <input type="date" value={subForm.due} onChange={e => setSub('due', e.target.value)} />
                    </div>
                    <div className="fld">
                      <label>Description</label>
                      <textarea value={subForm.description} onChange={e => setSub('description', e.target.value)}
                        placeholder="Optional…" rows={2}
                        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, padding: '6px 8px', fontFamily: 'inherit', resize: 'vertical' }} />
                    </div>
                    <div className="fld">
                      <label>Tags</label>
                      <TagPicker
                        selectedIds={subForm.tagIds}
                        onChange={ids => setSub('tagIds', ids)}
                        allTags={allTags}
                        onCreateTag={onCreateTag}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => { setShowSubForm(false); setSubErr(''); }}>Cancel</button>
                      <button className="btn sm primary" onClick={handleAddSubtask}
                        disabled={subSaving || !subForm.title.trim()}>
                        <Icon name="plus" size={10} /> {subSaving ? 'Adding…' : 'Add subtask'}
                      </button>
                    </div>
                  </div>
                )}

                {showLinkForm && (
                  <div className="subtask-form">
                    {linkErr && <div className="sp-error" style={{ marginBottom: 6 }}>{linkErr}</div>}
                    <div className="fld">
                      <label>Search tasks by name or ID</label>
                      <input
                        value={linkQ}
                        onChange={e => setLinkQ(e.target.value)}
                        placeholder="Type to search…"
                        autoFocus
                      />
                    </div>
                    {filteredLinkable.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0', textAlign: 'center' }}>
                        {linkQ ? 'No matching tasks.' : 'No tasks available to link.'}
                      </div>
                    ) : (
                      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredLinkable.map(t => (
                          <button
                            key={t._dbId}
                            disabled={linkSaving}
                            onClick={() => handleLinkExisting(t)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text)' }}
                          >
                            <span className={'dot-p p' + t.p} />
                            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{t.id}</span>
                            <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button className="btn sm ghost" onClick={() => { setShowLinkForm(false); setLinkQ(''); setLinkErr(''); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Linked Notes ── */}
            <div>
              <div className="tpanel-section">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="note" size={12} />
                  Linked Notes
                  {linkedNotes.length > 0 && <span className="subtasks-count">{linkedNotes.length}</span>}
                </span>
                <div style={{ position: 'relative' }} ref={notePickerRef}>
                  <button className="btn sm ghost" style={{ fontSize: 11 }}
                    onClick={() => { setShowNotePicker(s => !s); setNoteQ(''); }}>
                    <Icon name="plus" size={10} /> Attach
                  </button>
                  {showNotePicker && (
                    <div className="note-picker-dropdown">
                      <input
                        autoFocus
                        value={noteQ}
                        onChange={e => setNoteQ(e.target.value)}
                        placeholder="Search notes…"
                        className="note-picker-search"
                      />
                      <div className="note-picker-list">
                        {filteredAvail.length === 0 ? (
                          <div className="note-picker-empty">No notes to attach</div>
                        ) : filteredAvail.map(n => (
                          <div key={n.id} className="note-picker-item"
                            onClick={() => !noteLinking && handleAttachNote(n.id)}>
                            <div className="note-picker-item-title">{n.title}</div>
                            <div className="note-picker-item-folder">{n.folder}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {linkedNotes.length === 0 ? (
                <div className="subtasks-empty">No notes linked — attach reference notes to this task.</div>
              ) : (
                <div className="linked-notes-list">
                  {linkedNotes.map(n => (
                    <div key={n.id} className="linked-note-row" onClick={() => setViewingNote(n)}>
                      <Icon name="note" size={11} />
                      <span className="linked-note-title">{n.title}</span>
                      <span className="linked-note-folder">{n.folder}</span>
                      <button
                        className="linked-note-remove"
                        onClick={e => { e.stopPropagation(); handleDetachNote(n.id); }}
                        title="Remove link"
                      >
                        <Icon name="x" size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Status History ── */}
            <div>
              <div className="tpanel-section" style={{ marginTop: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="activity" size={12} />
                  Status History
                  {statusLogs.length > 0 && <span className="subtasks-count">{statusLogs.length}</span>}
                </span>
              </div>
              {logsLoading ? (
                <div className="subtasks-empty">Loading…</div>
              ) : statusLogs.length === 0 ? (
                <div className="subtasks-empty">No status changes yet.</div>
              ) : (
                <div style={{ padding: '8px 0 4px 0' }}>
                  {statusLogs.slice(0, logsVisible).map((log, i) => {
                    const isLatest = i === 0;
                    const color = log.toStatusColor || '#888';
                    const d = new Date(log.changedAt);
                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const sliced = statusLogs.slice(0, logsVisible);
                    return (
                      <div key={log.id || i} style={{ display: 'flex', gap: 10 }}>
                        {/* Rail */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 13,
                            background: isLatest ? color : 'var(--bg-3, #333)',
                            border: `1.5px solid ${isLatest ? color : 'var(--border)'}`,
                          }} />
                          {i < sliced.length - 1 && (
                            <div style={{ width: 1, flex: 1, minHeight: 16, marginTop: 4, background: 'var(--border)' }} />
                          )}
                        </div>

                        {/* Row */}
                        <div style={{ flex: 1, paddingBottom: i < sliced.length - 1 ? 14 : 2, paddingTop: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {log.fromStatusLabel || 'Created'}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>→</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>
                                {log.toStatusLabel || '—'}
                              </span>
                            </span>
                            {isLatest && (
                              <span style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.05em', marginLeft: 2 }}>· current</span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--f-mono)', marginTop: 3 }}>
                            {dateStr} · {timeStr}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show more / Show less */}
                  {statusLogs.length > LOG_PAGE && (
                    <div style={{ paddingTop: 6, paddingLeft: 26, display: 'flex', gap: 10, alignItems: 'center' }}>
                      {logsVisible < statusLogs.length && (
                        <button
                          className="btn sm ghost"
                          style={{ fontSize: 11 }}
                          onClick={() => setLogsVisible(v => v + LOG_PAGE)}
                        >
                          Show {Math.min(LOG_PAGE, statusLogs.length - logsVisible)} more
                          <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>· {statusLogs.length - logsVisible} remaining</span>
                        </button>
                      )}
                      {logsVisible > LOG_PAGE && (
                        <button
                          className="btn sm ghost"
                          style={{ fontSize: 11 }}
                          onClick={() => setLogsVisible(LOG_PAGE)}
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar (right) ── */}
          <div className="task-panel-sidebar">

            {/* Status */}
            <div className="tpanel-prop">
              <div className="tpanel-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Status
                {statusSaving && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>saving…</span>}
              </div>
              <select
                className="tpanel-status-sel"
                value={form.col}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={statusSaving}
                style={{ borderLeftColor: COL_COLOR[form.col] || '#888', borderLeftWidth: 3 }}
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.id} disabled={!isAllowedStatus(s.id)}>
                    {s.label}{!isAllowedStatus(s.id) ? ' — locked' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="tpanel-prop">
              <div className="tpanel-prop-label">Priority</div>
              <select className="tpanel-sel" value={form.p} onChange={e => set('p', e.target.value)}
                style={{ borderLeftColor: P_DOT_COLOR[form.p], borderLeftWidth: 3 }}>
                <option value="1">P1 — Critical</option>
                <option value="2">P2 — Normal</option>
                <option value="3">P3 — Low</option>
              </select>
            </div>

            {/* Project */}
            <div className="tpanel-prop">
              <div className="tpanel-prop-label">Project</div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{proj?.name || task.proj}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>{task.proj}</div>
            </div>

            {/* Due date */}
            <div className="tpanel-prop">
              <div className="tpanel-prop-label">Due date</div>
              <input
                type="date"
                value={form.due}
                onChange={e => set('due', e.target.value)}
                className={'tpanel-input' + (getDueClass(form.due).includes('overdue') ? ' overdue-input' : '')}
              />
            </div>

            {/* Tags */}
            <div className="tpanel-prop">
              <div className="tpanel-prop-label">Tags</div>
              <TagPicker
                selectedIds={form.tagIds}
                onChange={ids => set('tagIds', ids)}
                allTags={allTags}
                onCreateTag={onCreateTag}
              />
            </div>

            {/* Time tracking */}
            <div className="tpanel-prop">
              <div className="tpanel-prop-label">Time</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between' }}>
                <span><span style={{ color: 'var(--text-3)' }}>EST </span>{fmtMin(task.estMinutes)}</span>
                <span><span style={{ color: 'var(--text-3)' }}>LOG </span>{fmtMin(task.loggedMinutes)}</span>
              </div>
              {task.estMinutes > 0 && (
                <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-3)', marginTop: 5 }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: task.loggedMinutes > task.estMinutes ? '#ef4444' : 'var(--accent-hi)',
                    width: `${Math.min(100, Math.round((task.loggedMinutes / task.estMinutes) * 100))}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              )}
              <button
                className="btn sm ghost"
                style={{ marginTop: 8, width: '100%', fontSize: 10, letterSpacing: '0.06em' }}
                onClick={() => setShowLogTime(s => !s)}
              >
                <Icon name="plus" size={10} /> Log time
              </button>
              {showLogTime && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>MINUTES</div>
                    <input
                      type="number" min="1" placeholder="e.g. 25" value={logMin}
                      onChange={e => setLogMin(e.target.value)}
                      className="tpanel-input" style={{ width: '100%' }}
                      autoFocus
                    />
                    {(parseInt(logMin) || 0) >= 60 && (
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                        = {Math.floor((parseInt(logMin) || 0) / 60)}h {(parseInt(logMin) || 0) % 60}m
                      </div>
                    )}
                  </div>
                  <input placeholder="Notes (optional)" value={logNote}
                    onChange={e => setLogNote(e.target.value)} className="tpanel-input" />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm ghost" style={{ flex: 1, fontSize: 10 }}
                      onClick={() => { setShowLogTime(false); setLogMin(''); setLogNote(''); }}>
                      Cancel
                    </button>
                    <button
                      className="btn sm primary" style={{ flex: 1, fontSize: 10 }}
                      onClick={handleLogTime}
                      disabled={logSaving || (parseInt(logMin) || 0) <= 0}
                    >
                      {logSaving ? '…' : 'Add time'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Created */}
            {createdStr && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Created</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>{createdStr}</div>
              </div>
            )}

            {/* GitHub Branch */}
            {taskRepoFull && !githubToken && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Branch</div>
                <GhConnectHint label="Connect GitHub to manage branches for this task." />
              </div>
            )}

            {githubToken && !taskRepoFull && taskProjObj && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Branch</div>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
                  fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>
                    No repository linked to this project.{' '}
                    <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={onClose}>Go to Projects</span>{' '}
                    and set a repository to enable branch options.
                  </span>
                </div>
              </div>
            )}

            {showBranchSection && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Branch</div>

                {/* Current branch chip */}
                {ghBranch && branchMode === 'none' && (
                  <a
                    href={`https://github.com/${taskRepoFull}/tree/${ghBranch}`}
                    target="_blank" rel="noreferrer"
                    className="task-branch-chip"
                    style={{ marginBottom: 6 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {ghBranch}
                  </a>
                )}

                {/* Toggle: switch to existing */}
                <div className="branch-opt" style={{ marginTop: 2 }}>
                  <label className="branch-opt-toggle"
                    onClick={() => {
                      if (branchMode === 'switch') {
                        setBranchOpen(o => !o);
                      } else {
                        setBranchMode('switch');
                        setBranchOpen(true);
                        setNewBranchName('');
                      }
                      setBranchErr('');
                    }}>
                    <span className={'branch-opt-check' + (branchMode === 'switch' ? ' on' : '')}>
                      {branchMode === 'switch' && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1.5 6 4.5 9 10.5 3" /></svg>}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                      <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>Switch to existing branch</span>
                      <span className="branch-opt-repo" style={{ marginLeft: 0 }}>{taskRepoFull}</span>
                    </div>
                  </label>
                  {task.ghBranch && branchMode !== 'switch' && (
                    <div style={{
                      padding: '4px 12px 8px',
                      fontSize: 10, fontFamily: 'var(--f-mono)', color: 'var(--accent)',
                      display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                      overflow: 'hidden', wordBreak: 'break-all',
                    }}>
                      {task.ghBranch}
                    </div>
                  )}
                  {branchMode === 'switch' && branchOpen && (
                    <div className="branch-opt-name">
                      <label>Select branch</label>
                      {branchesLoading ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '4px 0' }}>Loading…</div>
                      ) : (
                        <select
                          className="tpanel-sel"
                          value={ghBranch}
                          onChange={e => setGhBranch(e.target.value)}
                          autoFocus
                          style={{ width: '100%', marginTop: 2 }}
                        >
                          <option value="">— select —</option>
                          {branches.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      )}
                      {branchErr && <div className="branch-opt-err">{branchErr}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button className="btn sm ghost" style={{ flex: 1, fontSize: 10 }}
                          onClick={() => { setBranchOpen(false); setBranchErr(''); setGhBranch(task.ghBranch || ''); }}>
                          Cancel
                        </button>
                        <button className="btn sm primary" style={{ flex: 1, fontSize: 10 }}
                          onClick={handleBranchSave} disabled={branchSaving || !ghBranch}>
                          {branchSaving ? '…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle: create new branch */}
                <div className="branch-opt" style={{ marginTop: 4 }}>
                  <label className="branch-opt-toggle"
                    onClick={() => {
                      if (branchMode === 'create') {
                        setBranchOpen(o => !o);
                      } else {
                        setBranchMode('create');
                        setBranchOpen(true);
                        setNewBranchName(toBranchName(task.title));
                      }
                      setBranchErr('');
                    }}>
                    <span className={'branch-opt-check' + (branchMode === 'create' ? ' on' : '')}>
                      {branchMode === 'create' && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1.5 6 4.5 9 10.5 3" /></svg>}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                      <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>Create a new branch</span>
                      <span className="branch-opt-repo" style={{ marginLeft: 0 }}>{taskRepoFull}</span>
                    </div>
                  </label>
                  {branchMode === 'create' && branchOpen && (
                    <div className="branch-opt-name">
                      <label>Branch name</label>
                      <input
                        value={newBranchName}
                        onChange={e => setNewBranchName(e.target.value)}
                        placeholder="feat/branch-name"
                        spellCheck={false}
                        autoFocus
                      />
                      {branchErr && <div className="branch-opt-err">{branchErr}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button className="btn sm ghost" style={{ flex: 1, fontSize: 10 }}
                          onClick={() => { setBranchOpen(false); setBranchErr(''); }}>
                          Cancel
                        </button>
                        <button className="btn sm primary" style={{ flex: 1, fontSize: 10 }}
                          onClick={handleBranchSave} disabled={branchSaving || !newBranchName.trim()}>
                          {branchSaving ? 'Creating…' : 'Create'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Disconnect branch */}
                {task.ghBranch && (
                  <div className="branch-opt" style={{ marginTop: 4 }}>
                    <button
                      className="branch-opt-toggle"
                      style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', textAlign: 'left' }}
                      onClick={handleBranchDisconnect}
                      disabled={branchSaving}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        <line x1="4" y1="4" x2="20" y2="20"/>
                      </svg>
                      <span>{branchSaving ? 'Disconnecting…' : 'Disconnect branch'}</span>
                    </button>
                    {branchErr && <div className="branch-opt-err" style={{ padding: '0 12px 8px' }}>{branchErr}</div>}
                  </div>
                )}
              </div>
            )}

            {/* Delete zone */}
            {onDelete && (
              <div className="tpanel-prop" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {!showDeleteConfirm ? (
                  <button
                    className="btn ghost"
                    style={{ width: '100%', fontSize: 11, color: '#ef4444', borderColor: '#ef444440' }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete task
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>Delete this task?</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                      This action cannot be undone. All subtasks and time logs will also be removed.
                    </div>

                    {/* Branch toggle — only shown when task has a linked branch and GitHub is connected */}
                    {task.ghBranch && showBranchSection && (
                      <div
                        className={'danger-repo-opt' + (deleteBranch ? ' active' : '')}
                        style={{ marginTop: 2 }}
                        onClick={() => setDeleteBranch(v => !v)}
                      >
                        <div className={'danger-repo-check' + (deleteBranch ? ' on' : '')}>
                          {deleteBranch && (
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="1.5 6 4.5 9 10.5 3" />
                            </svg>
                          )}
                        </div>
                        <div className="danger-repo-label">
                          <div className="danger-repo-name">Also delete GitHub branch</div>
                          <div className="danger-repo-slug">{task.ghBranch}</div>
                        </div>
                      </div>
                    )}

                    {deleteErr && (
                      <div style={{ fontSize: 11, color: '#ef4444' }}>{deleteErr}</div>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn ghost" style={{ flex: 1, fontSize: 11 }}
                        onClick={() => { setShowDeleteConfirm(false); setDeleteBranch(false); setDeleteErr(''); }}
                        disabled={deletingTask}>
                        Cancel
                      </button>
                      <button className="btn danger" style={{ flex: 1, fontSize: 11 }}
                        onClick={handleDeleteTask}
                        disabled={deletingTask}>
                        {deletingTask ? 'Deleting…' : 'Confirm delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="task-panel-footer">
          {err && <span style={{ flex: 1, fontSize: 12, color: '#ef4444' }}>{err}</span>}
          <button className="btn ghost" onClick={onClose} disabled={saving}>Close</button>
          <button className="btn primary" onClick={handleSave} disabled={saving || !form.title.trim()}>
            <Icon name="check" size={12} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        {/* ── Note view overlay ── */}
        {viewingNote && (
          <NoteViewOverlay note={viewingNote} onClose={() => setViewingNote(null)} />
        )}
      </div>
    </div>
  );
};

const toBranchName = (title) =>
  'feat/' + title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);

const AddTaskPanel = ({ open, onClose, onAdd, projects, defaultCol = '', statuses = [], allTags = [], onCreateTag, githubToken = null, onBranchCreated }) => {
  const empty = { title: '', proj: projects[0]?.id || '', p: '2', col: defaultCol || statuses[0]?.id || '', tagIds: [], due: '', description: '', estH: '', estM: '' };
  const [form, setForm] = useStateA(empty);

  // Reset col when defaultCol (i.e. which column's + button was clicked) changes
  useEffectA(() => { setForm(f => ({ ...f, col: defaultCol || statuses[0]?.id || '' })); }, [defaultCol]);

  const [err,             setErr]             = useStateA('');
  const [saving,          setSaving]          = useStateA(false);
  const [branchMode,      setBranchMode]      = useStateA('none'); // 'none' | 'create' | 'existing'
  const [branchName,      setBranchName]      = useStateA('');
  const [existingBranch,  setExistingBranch]  = useStateA('');
  const [branches,        setBranches]        = useStateA([]);
  const [branchesLoading, setBranchesLoading] = useStateA(false);
  const [branchErr,       setBranchErr]       = useStateA('');
  const branchEditedRef = useRefA(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedProj = projects.find(p => p.id === form.proj);
  const projRepoFull = selectedProj?.repo && selectedProj.repo !== '—'
    ? selectedProj.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('?')[0]
    : null;
  const showBranchOption = !!githubToken && !!projRepoFull;

  // Auto-generate branch name from title unless user has manually edited it
  const handleTitleChange = (v) => {
    set('title', v);
    if (!branchEditedRef.current) setBranchName(v ? toBranchName(v) : '');
  };

  // Fetch branches when "existing" mode is selected
  useEffectA(() => {
    if (branchMode !== 'existing' || !githubToken || !projRepoFull) return;
    setBranchesLoading(true);
    ghGetBranches(githubToken, projRepoFull)
      .then(data => setBranches(data.map(b => b.name)))
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
  }, [branchMode, projRepoFull]);

  // Reset branch state when panel closes
  useEffectA(() => {
    if (!open) {
      setBranchMode('none'); setBranchName(''); setExistingBranch('');
      setBranches([]); setBranchErr(''); branchEditedRef.current = false;
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr('Task title is required.'); return; }
    if (branchMode === 'create' && !branchName.trim()) { setErr('Branch name is required.'); return; }
    if (branchMode === 'existing' && !existingBranch) { setErr('Please select a branch.'); return; }
    const newTask = {
      proj: form.proj,
      col: form.col,
      p: parseInt(form.p),
      title: form.title.trim(),
      description: form.description,
      due: form.due || '—',
      tags: form.tagIds,
      estMinutes: (parseInt(form.estH) || 0) * 60 + (parseInt(form.estM) || 0),
    };
    setSaving(true);
    setBranchErr('');
    try {
      const savedTask = await onAdd(newTask);
      if (branchMode === 'create' && projRepoFull) {
        try {
          await ghCreateBranch(githubToken, projRepoFull, branchName.trim());
          const branch = branchName.trim();
          const updated = await updateTask({ ...savedTask, ghBranch: branch });
          onBranchCreated?.({ branchName: branch, url: `https://github.com/${projRepoFull}/tree/${branch}`, task: updated });
        } catch (e) {
          setBranchErr(e.message || 'Branch creation failed.');
          setSaving(false);
          return;
        }
      } else if (branchMode === 'existing' && existingBranch) {
        try {
          const updated = await updateTask({ ...savedTask, ghBranch: existingBranch });
          onBranchCreated?.({ branchName: existingBranch, url: `https://github.com/${projRepoFull}/tree/${existingBranch}`, task: updated });
        } catch (e) {
          setBranchErr(e.message || 'Failed to link branch.');
          setSaving(false);
          return;
        }
      }
      setForm(empty);
      setErr('');
      setBranchErr('');
      branchEditedRef.current = false;
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Task" subtitle="WORKSPACE / TASKS / ADD">
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        {projects.length === 0 && (
          <div className="sp-error">You need at least one project before creating tasks.</div>
        )}
        <div className="fld">
          <label>Task title *</label>
          <input value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="What needs to be done?" disabled={projects.length === 0} />
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Project</label>
            <select value={form.proj} onChange={e => set('proj', e.target.value)} disabled={projects.length === 0}>
              {projects.length === 0
                ? <option value="">— No projects —</option>
                : projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Priority</label>
            <select value={form.p} onChange={e => set('p', e.target.value)}>
              <option value="1">P1 — Critical</option>
              <option value="2">P2 — Normal</option>
              <option value="3">P3 — Low</option>
            </select>
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Column</label>
            <select value={form.col} onChange={e => set('col', e.target.value)}>
              {(statuses.length > 0 ? statuses : COL_DEFS).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Due date</label>
            <input type="date" value={form.due} onChange={e => set('due', e.target.value)} />
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Est. hours</label>
            <input type="number" min="0" value={form.estH} onChange={e => set('estH', e.target.value)} placeholder="0" />
          </div>
          <div className="fld">
            <label>Est. minutes</label>
            <input type="number" min="0" max="59" value={form.estM} onChange={e => set('estM', e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="fld">
          <label>Tags</label>
          <TagPicker
            selectedIds={form.tagIds}
            onChange={ids => set('tagIds', ids)}
            allTags={allTags}
            onCreateTag={onCreateTag}
          />
        </div>
        <div className="fld">
          <label>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Optional scope, context, or acceptance criteria…" rows={3}
            style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, padding: '8px 10px', fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        {projRepoFull && !githubToken && (
          <GhConnectHint label="Connect GitHub to auto-create a branch when adding this task." />
        )}

        {githubToken && !projRepoFull && selectedProj && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>
              No repository linked to this project.
              {' '}<span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={onClose}>Go to Projects</span>{' '}
              and set a repository to enable branch options.
            </span>
          </div>
        )}

        {showBranchOption && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Option 1: link existing branch */}
            <div className="branch-opt">
              <label className="branch-opt-toggle" onClick={() => { setBranchMode(m => m === 'existing' ? 'none' : 'existing'); setBranchErr(''); }}>
                <span className={'branch-opt-check' + (branchMode === 'existing' ? ' on' : '')}>
                  {branchMode === 'existing' && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1.5 6 4.5 9 10.5 3" /></svg>}
                </span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                  <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>Link existing branch</span>
                  <span className="branch-opt-repo" style={{ marginLeft: 0 }}>{projRepoFull}</span>
                </div>
              </label>
              {branchMode === 'existing' && (
                <div className="branch-opt-name">
                  <label>Select branch</label>
                  {branchesLoading ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '4px 0' }}>Loading…</div>
                  ) : (
                    <select
                      className="tpanel-sel"
                      value={existingBranch}
                      onChange={e => setExistingBranch(e.target.value)}
                      autoFocus
                      style={{ width: '100%', marginTop: 2 }}
                    >
                      <option value="">— select —</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                  {branchErr && <div className="branch-opt-err">{branchErr}</div>}
                </div>
              )}
            </div>

            {/* Option 2: create new branch */}
            <div className="branch-opt">
              <label className="branch-opt-toggle" onClick={() => { setBranchMode(m => m === 'create' ? 'none' : 'create'); setBranchErr(''); }}>
                <span className={'branch-opt-check' + (branchMode === 'create' ? ' on' : '')}>
                  {branchMode === 'create' && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1.5 6 4.5 9 10.5 3" /></svg>}
                </span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                  <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>Create a new branch</span>
                  <span className="branch-opt-repo" style={{ marginLeft: 0 }}>{projRepoFull}</span>
                </div>
              </label>
              {branchMode === 'create' && (
                <div className="branch-opt-name">
                  <label>Branch name</label>
                  <input
                    value={branchName}
                    onChange={e => { setBranchName(e.target.value); branchEditedRef.current = true; }}
                    placeholder="feat/branch-name"
                    spellCheck={false}
                    autoFocus
                  />
                  {branchErr && <div className="branch-opt-err">{branchErr}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit} disabled={saving || !form.title.trim() || projects.length === 0}>
          <Icon name="plus" size={12} /> {saving ? 'Creating…' : 'Create task'}
        </button>
      </div>
    </SlidePanel>
  );
};

// ── Branch created toast ───────────────────────────────────────────
const BranchToast = ({ info, onDismiss }) => {
  useEffectA(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [info]);

  if (!info) return null;
  return (
    <div className="branch-toast">
      <div className="branch-toast-inner">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#22c55e', flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <div className="branch-toast-text">
          <span>Branch created</span>
          <code>{info.branchName}</code>
        </div>
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="branch-toast-link">
          View on GitHub
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
        </a>
        <button className="branch-toast-x" onClick={onDismiss}>×</button>
      </div>
    </div>
  );
};

export const TasksPage = ({ tasks, setTasks, projects, workstationId, statuses = [], tags = [], setTags, notes = [], taskNoteLinks = {}, setTaskNoteLinks, onLogTime, githubToken = null }) => {
  const cols = statuses.length > 0 ? statuses : COL_DEFS;

  const [view, setView] = useStateA('board');
  const [projFilter, setProjFilter] = useStateA('all');
  const [prioFilter, setPrioFilter] = useStateA('all');
  const [searchQ, setSearchQ] = useStateA('');
  const [subFilter, setSubFilter] = useStateA('none');
  const [subDropOpen, setSubDropOpen] = useStateA(false);
  const subDropRef = useRefA(null);
  const [collapsedParents, setCollapsedParents] = useStateA(new Set());
  const toggleParentCollapse = (pid) => setCollapsedParents(prev => {
    const next = new Set(prev);
    next.has(pid) ? next.delete(pid) : next.add(pid);
    return next;
  });
  const [projDropOpen, setProjDropOpen] = useStateA(false);
  const projDropRef = useRefA(null);

  // Lazy-loaded tasks for a specific project
  const [localTasks, setLocalTasks] = useStateA(null);   // null = use global tasks
  const [localLoading, setLocalLoading] = useStateA(false);
  const [localErr, setLocalErr] = useStateA('');
  const [showAdd, setShowAdd] = useStateA(false);
  const [addCol, setAddCol] = useStateA(cols[0]?.id || '');
  const [branchToast, setBranchToast] = useStateA(null);
  const [dragOver, setDragOver] = useStateA(null);   // col id being hovered
  const [draggingFromKey, setDraggingFromKey] = useStateA(null);  // source col during drag
  const [viewingTask, setViewingTask] = useStateA(null);   // task open in modal
  const [parentTask, setParentTask] = useStateA(null);   // parent when viewing subtask
  const dragTaskRef = useRefA(null);                       // task being dragged
  const [prioInd, setPrioInd] = useStateA({ left: 0, width: 0 });
  const prioRefs = useRefA({});

  useEffectA(() => {
    const el = prioRefs.current[prioFilter];
    if (el) setPrioInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [prioFilter]);

  useEffectA(() => {
    if (!subDropOpen) return;
    const h = (e) => { if (subDropRef.current && !subDropRef.current.contains(e.target)) setSubDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [subDropOpen]);

  useEffectA(() => {
    if (!projDropOpen) return;
    const h = (e) => { if (projDropRef.current && !projDropRef.current.contains(e.target)) setProjDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [projDropOpen]);

  // Lazy-load tasks when a specific project is selected
  useEffectA(() => {
    if (projFilter === 'all') {
      setLocalTasks(null);
      setLocalErr('');
      return;
    }
    setLocalLoading(true);
    setLocalErr('');
    getProjectTasks(workstationId, projFilter)
      .then(fetched => {
        setLocalTasks(fetched);
        // Sync fetched tasks back into global state so other pages stay up-to-date
        setTasks(prev => {
          const otherProj = prev.filter(t => t.proj !== projFilter);
          return [...otherProj, ...fetched];
        });
      })
      .catch(e => setLocalErr(e.message || 'Failed to load tasks'))
      .finally(() => setLocalLoading(false));
  }, [projFilter, workstationId]);

  // Adjacent check — tasks can only move one step at a time (compare by UUID)
  const isAdjacentCol = (fromId, toId) => {
    const fromIdx = cols.findIndex(c => c.id === fromId);
    const toIdx = cols.findIndex(c => c.id === toId);
    return fromIdx !== -1 && toIdx !== -1 && Math.abs(fromIdx - toIdx) === 1;
  };

  // UUID of the final status (key='done') — passed to TaskCard for subtask counts
  const doneStatusId = cols.find(c => c.isDone)?.id;

  // Use lazy-loaded tasks when a project is selected, global otherwise
  const displayTasks = localTasks !== null ? localTasks : tasks;

  const sq = searchQ.trim().toLowerCase();
  const filtered = displayTasks.filter(t =>
    (subFilter === 'subtask' ? !!t.parentId : !t.parentId) &&
    (projFilter === 'all' || t.proj === projFilter) &&
    (prioFilter === 'all' || t.p === parseInt(prioFilter)) &&
    (!sq || t.title.toLowerCase().includes(sq) || t.id.toLowerCase().includes(sq))
  );
  const byCol = (col) => filtered.filter(t => t.col === col);

  const subtaskGroups = subFilter === 'subtask'
    ? Object.entries(
        filtered.reduce((acc, t) => {
          const pid = t.parentId || '__none__';
          (acc[pid] = acc[pid] || []).push(t);
          return acc;
        }, {})
      ).map(([pid, subs]) => ({
        parentId: pid,
        parent: tasks.find(x => x._dbId === pid),
        subtasks: subs,
      }))
    : null;

  const handleAdd = async (taskData) => {
    const proj = projects.find(p => p.id === taskData.proj);
    const prefix = getTaskPrefix(proj?.name);
    const num = getNextTaskNum(tasks, taskData.proj, prefix);
    const task = { ...taskData, id: `${prefix}-${num}` };
    const saved = await createTask(task, workstationId);
    setTasks(prev => [...prev, saved]);
    return saved;
  };

  const handleCreateTag = async (name, color) => {
    const tag = await createTag(workstationId, name, color);
    setTags(prev => [...prev, tag]);
    return tag;
  };

  const handleLinkNote = async (taskDbId, noteId) => {
    await linkNoteToTask(taskDbId, noteId);
    setTaskNoteLinks(prev => ({
      ...prev,
      [taskDbId]: [...(prev[taskDbId] || []), noteId],
    }));
  };

  const handleUnlinkNote = async (taskDbId, noteId) => {
    await unlinkNoteFromTask(taskDbId, noteId);
    setTaskNoteLinks(prev => ({
      ...prev,
      [taskDbId]: (prev[taskDbId] || []).filter(id => id !== noteId),
    }));
  };

  const openAdd = (col = cols[0]?.id || '') => { setAddCol(col); setShowAdd(true); };

  // ── Drag handlers ─────────────────────────────────────────────────
  const handleDragStart = (e, task) => {
    dragTaskRef.current = task;
    setDraggingFromKey(task.col);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
  };

  const handleDragEnd = (e) => {
    // Fires on cancel/escape; on successful drop the node may already be unmounted
    // so this is a safety net rather than the primary cleanup path.
    e.target?.classList?.remove('dragging');
    dragTaskRef.current = null;
    setDragOver(null);
    setDraggingFromKey(null);
  };

  const handleDragOver = (e, colId, dragKey) => {
    const task = dragTaskRef.current;
    if (!task) return;
    if (task.col === colId || isAdjacentCol(task.col, colId)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOver(dragKey ?? colId);
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragLeave = (e, dragKey) => {
    // Only clear when truly leaving the column div (not moving into a child)
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(prev => prev === (dragKey ?? dragKey) ? null : prev);
    }
  };

  const handleDrop = async (e, colId, dragKey) => {
    e.preventDefault();
    setDragOver(null);
    setDraggingFromKey(null);
    const task = dragTaskRef.current;
    dragTaskRef.current = null;
    if (!task || task.col === colId) return;
    if (!isAdjacentCol(task.col, colId)) return;

    const updated = { ...task, col: colId };
    // Optimistic update for both global and lazy-loaded task lists
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    setLocalTasks(prev => prev ? prev.map(t => t.id === task.id ? updated : t) : null);
    try {
      const saved = await updateTask(updated);
      setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
      setLocalTasks(prev => prev ? prev.map(t => t.id === saved.id ? saved : t) : null);
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      setLocalTasks(prev => prev ? prev.map(t => t.id === task.id ? task : t) : null);
      console.error('Failed to move task:', err);
    }
  };

  // ── Modal handlers ────────────────────────────────────────────────
  const handleCloseModal = () => { setViewingTask(null); setParentTask(null); };

  const handleOpenSubtask = (sub) => { setParentTask(viewingTask); setViewingTask(sub); };

  const handleBackToParent = () => { setViewingTask(parentTask); setParentTask(null); };

  const handleTaskSave = async (updated) => {
    const saved = await updateTask(updated);
    setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
    setViewingTask(null);
    setParentTask(null);
  };

  const handleTaskStatusChange = async (updated) => {
    const saved = await updateTask(updated);
    setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
    setViewingTask(saved);
  };

  const handleBranchUpdate = async (updated) => {
    const saved = await updateTask(updated);
    setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
    setViewingTask(saved);
  };

  const handleTaskDelete = async (task) => {
    await softDeleteTask(task.id);
    setTasks(prev => prev.filter(t => t._dbId !== task._dbId));
    setViewingTask(null);
    setParentTask(null);
  };

  const handleAddSubtask = async (subtaskData) => {
    const proj = projects.find(p => p.id === subtaskData.proj);
    const prefix = getTaskPrefix(proj?.name);
    const num = getNextTaskNum(tasks, subtaskData.proj, prefix);
    const subtask = { ...subtaskData, id: `${prefix}-${num}` };
    const saved = await createTask(subtask, workstationId);
    setTasks(prev => [...prev, saved]);
  };

  const handleLinkSubtask = async (childTask) => {
    const updated = await updateTask({ ...childTask, parentId: viewingTask._dbId });
    setTasks(prev => prev.map(t => t._dbId === updated._dbId ? updated : t));
  };

  const handleLogTime = async (taskDbId, projDbId, minutes, notes) => {
    await onLogTime(taskDbId, projDbId, minutes, notes);
    setViewingTask(prev => prev?._dbId === taskDbId
      ? { ...prev, loggedMinutes: (prev.loggedMinutes || 0) + minutes }
      : prev
    );
    setTasks(prev => prev.map(t =>
      t._dbId === taskDbId ? { ...t, loggedMinutes: (t.loggedMinutes || 0) + minutes } : t
    ));
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE / TASKS</div>
          <h1>Tasks</h1>
          <div className="sub">{filtered.length} of {subFilter === 'subtask' ? tasks.filter(t => !!t.parentId).length : tasks.filter(t => !t.parentId).length} · sorted by priority</div>
        </div>
        <div className="actions">
          <div className="view-toggle">
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>BOARD</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>LIST</button>
          </div>
          <button className="btn primary" onClick={() => openAdd()}>
            <Icon name="plus" size={12} /> New task
          </button>
        </div>
      </div>

      <div className="filter-row-premium">
        <div style={{ display: 'flex', gap: 12, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Project dropdown */}
          <div ref={projDropRef} className="task-show-dropdown">
            <button
              onClick={() => setProjDropOpen(s => !s)}
              className={`task-show-trigger${projDropOpen ? ' open' : ''}`}
            >
              {projFilter !== 'all' && (() => {
                const p = projects.find(x => x.id === projFilter);
                return p ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} /> : null;
              })()}
              <span className="label-mono">PROJECT</span>
              <span className="value" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {projFilter === 'all' ? 'All' : projects.find(p => p.id === projFilter)?.name || 'All'}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-3)', transform: projDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {projDropOpen && (
              <div className="task-show-menu" style={{ minWidth: 200, maxHeight: 280, overflowY: 'auto', left: 0, right: 'auto' }}>
                {[{ id: 'all', name: 'All Projects', color: null }, ...projects.filter(p => tasks.some(t => t.proj === p.id))].map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setProjFilter(p.id); setProjDropOpen(false); }}
                    className={`task-show-item${projFilter === p.id ? ' active' : ''}`}
                  >
                    {projFilter === p.id ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <span style={{ width: 10, flexShrink: 0 }} />
                    )}
                    {p.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />}
                    {p.name}
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
                      {p.id !== 'all' && tasks.filter(t => t.proj === p.id && !t.parentId).length}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="filter-bar">
            <div className="sliding-indicator" style={{ left: prioInd.left, width: prioInd.width }} />
            {['all', '1', '2', '3'].map(v => (
              <button
                key={v}
                ref={el => prioRefs.current[v] = el}
                className={'chip' + (prioFilter === v ? ' active' : '')}
                onClick={() => setPrioFilter(v)}
              >
                <span className="dot-p" style={{ background: v === 'all' ? 'var(--text-4)' : `var(--p${v})` }} />
                {v === 'all' ? 'All Priorities' : `P${v}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div ref={subDropRef} className="task-show-dropdown">
            <button
              onClick={() => setSubDropOpen(s => !s)}
              className={`task-show-trigger${subDropOpen ? ' open' : ''}`}
            >
              <span className="label-mono">SHOW</span>
              <span className="value">
                {subFilter === 'subtask' ? 'Subtask' : 'None'}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-3)', transform: subDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {subDropOpen && (
              <div className="task-show-menu">
                {[
                  { val: 'none', label: 'None' },
                  { val: 'subtask', label: 'Subtask' }
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => { setSubFilter(val); setSubDropOpen(false); }}
                    className={`task-show-item${subFilter === val ? ' active' : ''}`}
                  >
                    {subFilter === val ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <span style={{ width: 10, flexShrink: 0 }} />
                    )}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="task-search-wrap">
            <Icon name="search" size={12} />
            <input
              className="task-search-input"
              placeholder="Search by title or ID…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            {searchQ && (
              <button className="task-search-clear" onClick={() => setSearchQ('')}>
                <Icon name="x" size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {localErr && (
        <div style={{ padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, fontSize: 13, color: '#f87171', marginBottom: 12 }}>
          Failed to load tasks: {localErr}
        </div>
      )}

      {tasks.length === 0 && !localLoading ? (
        <div className="empty-state">
          <Icon name="list" size={32} />
          <div className="empty-title">No tasks yet</div>
          <div className="empty-sub">Add your first task to start tracking work across your projects.</div>
          <button className="btn primary" onClick={() => openAdd()}>
            <Icon name="plus" size={12} /> New task
          </button>
        </div>
      ) : localLoading ? (
        view === 'board' ? (
          <div className="kanban">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="kcol">
                <div className="kcol-h" style={{ borderTopColor: 'var(--border-2)' }}>
                  <span className="sk-line" style={{ width: 64, height: 10 }} />
                  <span className="sk-line" style={{ width: 18, height: 18, borderRadius: 6 }} />
                </div>
                <div className="kcol-body">
                  {[1, 2, 3].map(j => (
                    <div key={j} className="tcard sk-card" style={{ animationDelay: `${(i * 3 + j) * 0.07}s` }}>
                      <div className="top">
                        <span className="sk-dot" />
                        <span className="sk-line" style={{ width: 42, height: 10 }} />
                      </div>
                      <span className="sk-line" style={{ width: '90%', height: 13 }} />
                      <span className="sk-line" style={{ width: '60%', height: 13 }} />
                      <span className="sk-line" style={{ width: 80, height: 10, marginTop: 2 }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <table className="tbl">
              <thead><tr>
                <th>ID</th><th>P</th><th>Title</th><th>Project</th><th>Status</th><th>Branch</th><th>Tags</th>
              </tr></thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(j => (
                  <tr key={j} style={{ animationDelay: `${j * 0.05}s` }}>
                    <td><span className="sk-line" style={{ width: 52, height: 11 }} /></td>
                    <td><span className="sk-dot" style={{ width: 10, height: 10 }} /></td>
                    <td><span className="sk-line" style={{ width: `${55 + (j % 3) * 15}%`, height: 12 }} /></td>
                    <td><span className="sk-line" style={{ width: 64, height: 11 }} /></td>
                    <td><span className="sk-line" style={{ width: 56, height: 20, borderRadius: 20 }} /></td>
                    <td><span className="sk-line" style={{ width: 44, height: 11 }} /></td>
                    <td><span className="sk-line" style={{ width: 36, height: 18, borderRadius: 4 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : view === 'board' && subFilter === 'subtask' ? (
        <div className="sg-board">
          <div className="sg-col-strip">
            {cols.map(col => (
              <div key={col.id} className="sg-col-hd" style={{ borderTopColor: col.color }}>
                <span className="t">{col.label.toUpperCase()}</span>
                <span className="c">{filtered.filter(t => t.col === col.id).length}</span>
              </div>
            ))}
          </div>
          {subtaskGroups.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No subtasks match this filter.</div>
          ) : subtaskGroups.map(({ parentId, parent, subtasks }) => {
            const isCollapsed = collapsedParents.has(parentId);
            const parentStatus = cols.find(c => c.id === parent?.col);
            const parentProj = projects.find(p => p.id === parent?.proj);
            return (
              <div key={parentId} className="sg-group">
                <div className="sg-group-hd" onClick={() => toggleParentCollapse(parentId)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ flexShrink: 0, color: 'var(--text-3)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {parent && <span className="dot-p" style={{ background: `var(--p${parent.p})`, width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />}
                  <span className="sg-pid">{parent?.id || '—'}</span>
                  <span className="sg-ptitle">{parent?.title || 'Unknown task'}</span>
                  <span className="sg-pcount">{subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</span>
                  {parentProj && <span className="pill muted" style={{ fontSize: 10 }}>{parentProj.name}</span>}
                  {parentStatus && <span className="pill muted" style={{ textTransform: 'uppercase', fontSize: 10 }}>{parentStatus.label}</span>}
                  <button className="btn ghost" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); setViewingTask(parent); }}>
                    Open
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="sg-col-strip sg-col-strip-body">
                    {cols.map(col => {
                      const items = subtasks.filter(t => t.col === col.id);
                      const isOver = dragOver === `${parentId}::${col.id}`;
                      const isBlocked = draggingFromKey !== null
                        && col.id !== draggingFromKey
                        && !isAdjacentCol(draggingFromKey, col.id);
                      return (
                        <div
                          key={col.id}
                          className={'sg-col-body' + (isOver ? ' sg-col-over' : '') + (isBlocked ? ' sg-col-blocked' : '')}
                          onDragOver={(e) => handleDragOver(e, col.id, `${parentId}::${col.id}`)}
                          onDragLeave={(e) => handleDragLeave(e, `${parentId}::${col.id}`)}
                          onDrop={(e) => handleDrop(e, col.id, `${parentId}::${col.id}`)}
                        >
                          {items.map(t => (
                            <TaskCard key={t.id} t={t} tasks={tasks} projects={projects} allTags={tags}
                              doneStatusId={doneStatusId} onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                              onClick={() => setViewingTask(t)} />
                          ))}
                          {items.length === 0 && <div className="sg-col-empty" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : view === 'board' ? (
        <div className="kanban">
          {cols.map(col => {
            const items = byCol(col.id);
            const isBlocked = draggingFromKey !== null
              && col.id !== draggingFromKey
              && !isAdjacentCol(draggingFromKey, col.id);
            return (
              <div
                key={col.id}
                className={'kcol' + (dragOver === col.id ? ' drag-over' : '') + (isBlocked ? ' drag-blocked' : '')}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={(e) => handleDragLeave(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="kcol-h" style={{ borderTopColor: col.color }}>
                  <span className="t">{col.label.toUpperCase()}</span>
                  <span className="c">{items.length}</span>
                </div>
                <div className="kcol-body">
                  {items.map(t => (
                    <TaskCard
                      key={t.id}
                      t={t}
                      tasks={tasks}
                      projects={projects}
                      allTags={tags}
                      doneStatusId={doneStatusId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => setViewingTask(t)}
                    />
                  ))}
                  <button
                    className="btn ghost"
                    style={{ justifyContent: 'center', color: 'var(--text-3)', fontSize: 11, padding: '6px', borderStyle: 'dashed' }}
                    onClick={() => openAdd(col.id)}>
                    <Icon name="plus" size={10} /> Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <table className="tbl">
            <thead><tr>
              <th>ID</th><th>P</th><th>Title</th><th>Project</th><th>Status</th>
              <th>Branch</th><th>Tags</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No tasks match this filter.</td></tr>
              ) : subFilter === 'subtask' ? (
                subtaskGroups.map(({ parentId, parent, subtasks }) => {
                  const isCollapsed = collapsedParents.has(parentId);
                  const parentStatus = cols.find(c => c.id === parent?.col);
                  return [
                    <tr key={`gh-${parentId}`} className="sg-list-group-hd" onClick={() => toggleParentCollapse(parentId)}>
                      <td colSpan={7}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                            style={{ flexShrink: 0, color: 'var(--text-3)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          {parent && <span className="dot-p" style={{ background: `var(--p${parent.p})`, width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />}
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-3)' }}>{parent?.id || '—'}</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{parent?.title || 'Unknown task'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({subtasks.length})</span>
                          {parentStatus && <span className="pill muted" style={{ textTransform: 'uppercase', fontSize: 10 }}>{parentStatus.label}</span>}
                        </div>
                      </td>
                    </tr>,
                    ...(!isCollapsed ? subtasks.map(t => {
                      const isRowDone = doneStatusId && t.col === doneStatusId;
                      const taskProj = projects.find(p => p.id === t.proj);
                      const branchUrl = t.ghBranch && taskProj?.repo
                        ? `${taskProj.repo.replace(/\/$/, '')}/tree/${t.ghBranch}` : null;
                      return (
                        <tr key={t.id} style={{ cursor: 'pointer', opacity: isRowDone ? 0.6 : 1, background: isRowDone ? 'var(--bg-green, rgba(34,197,94,0.06))' : undefined }} onClick={() => setViewingTask(t)}>
                          <td className="mono" style={{ paddingLeft: 32 }}>{t.id}</td>
                          <td><span className={'dot-p p' + t.p} /></td>
                          <td style={{ textDecoration: isRowDone ? 'line-through' : 'none', color: isRowDone ? 'var(--text-3)' : undefined }}>{t.title}</td>
                          <td className="mono" style={{ color: 'var(--accent-hi)' }}>{t.proj}</td>
                          <td><span className="pill muted" style={{ textTransform: 'uppercase' }}>{cols.find(c => c.id === t.col)?.label || '—'}</span></td>
                          <td onClick={e => e.stopPropagation()}>
                            {t.ghBranch ? (
                              <a href={branchUrl} target="_blank" rel="noopener noreferrer" className="task-branch-chip">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                                {t.ghBranch}
                              </a>
                            ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                          </td>
                          <td>
                            {(t.tags || []).slice(0, 2).map(id => {
                              const tg = tags.find(x => x.id === id);
                              return tg ? <span key={id} className="tag" style={{ marginRight: 4, borderColor: tg.color, color: tg.color }}>{tg.name}</span> : null;
                            })}
                            {t.tags && t.tags.length > 2 && <span className="tag-more">+{t.tags.length - 2}</span>}
                          </td>
                        </tr>
                      );
                    }) : [])
                  ];
                })
              ) : filtered.map(t => {
                const isRowDone = doneStatusId && t.col === doneStatusId;
                const taskProj = projects.find(p => p.id === t.proj);
                const branchUrl = t.ghBranch && taskProj?.repo
                  ? `${taskProj.repo.replace(/\/$/, '')}/tree/${t.ghBranch}`
                  : null;
                return (
                  <tr key={t.id} style={{ cursor: 'pointer', opacity: isRowDone ? 0.6 : 1, background: isRowDone ? 'var(--bg-green, rgba(34,197,94,0.06))' : undefined }} onClick={() => setViewingTask(t)}>
                    <td className="mono">{t.id}</td>
                    <td><span key={t.p} className={'dot-p p' + t.p}></span></td>
                    <td style={{ textDecoration: isRowDone ? 'line-through' : 'none', color: isRowDone ? 'var(--text-3)' : undefined }}>{t.title}</td>
                    <td className="mono" style={{ color: 'var(--accent-hi)' }}>{t.proj}</td>
                    <td><span className="pill muted" style={{ textTransform: 'uppercase' }}>{cols.find(c => c.id === t.col)?.label || '—'}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      {t.ghBranch ? (
                        <a href={branchUrl} target="_blank" rel="noopener noreferrer" className="task-branch-chip">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                          {t.ghBranch}
                        </a>
                      ) : <span style={{ color: 'var(--text-4)' }}>—</span>}
                    </td>
                    <td>
                      {(t.tags || []).slice(0, 2).map(id => {
                        const tg = tags.find(x => x.id === id);
                        return tg ? <span key={id} className="tag" style={{ marginRight: 4, borderColor: tg.color, color: tg.color }}>{tg.name}</span> : null;
                      })}
                      {t.tags && t.tags.length > 2 && (
                        <span className="tag-more">+{t.tags.length - 2}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddTaskPanel
        open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd}
        projects={projects} defaultCol={addCol} statuses={cols}
        allTags={tags} onCreateTag={handleCreateTag} githubToken={githubToken}
        onBranchCreated={({ branchName, url, task }) => {
          // Update local task state with the saved branch
          setTasks(prev => prev.map(t => t.id === task.id ? task : t));
          setBranchToast({ branchName, url });
        }}
      />
      <BranchToast info={branchToast} onDismiss={() => setBranchToast(null)} />

      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          projects={projects}
          statuses={cols}
          subtasks={tasks.filter(t => t.parentId === viewingTask._dbId)}
          allTasks={tasks}
          parentTask={parentTask}
          onClose={handleCloseModal}
          onSave={handleTaskSave}
          onStatusChange={handleTaskStatusChange}
          onAddSubtask={handleAddSubtask}
          onLinkSubtask={handleLinkSubtask}
          onOpenSubtask={handleOpenSubtask}
          onBack={handleBackToParent}
          allTags={tags}
          onCreateTag={handleCreateTag}
          notes={notes}
          linkedNoteIds={taskNoteLinks[viewingTask._dbId] || []}
          onLinkNote={(noteId) => handleLinkNote(viewingTask._dbId, noteId)}
          onUnlinkNote={(noteId) => handleUnlinkNote(viewingTask._dbId, noteId)}
          onLogTime={handleLogTime}
          githubToken={githubToken}
          onBranchUpdate={handleBranchUpdate}
          onDelete={handleTaskDelete}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  4. LEARNING PATH
// ═══════════════════════════════════════════════════════════════════
const LEARN_CATS = ['Flutter', 'Backend', 'AI', 'Web', 'Soft Skills', 'DevOps', 'Other'];

const LearnCard = ({ item, stage }) => (
  <div className="lcard">
    <div className="topic">
      <span>{item.topic}</span>
      {item.rev && <span className="rev" title="Marked for revision"><Icon name="rev" size={12} /></span>}
    </div>
    <div className="meta">
      <span className="tag accent">{item.cat}</span>
      {item.est && <span>{item.est}h est</span>}
      {item.actual !== undefined && <span style={{ color: 'var(--accent-hi)' }}>{item.actual}h logged</span>}
      {stage === 'completed' && <span>last reviewed {item.lastReviewed}</span>}
    </div>
    {stage === 'inProgress' && (
      <div className="prog thin"><div className="fill" style={{ width: item.prog + '%' }}></div></div>
    )}
    {item.note && <div style={{ fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic' }}>"{item.note}"</div>}
    {item.link && item.link !== '—' && <div className="res">→ {item.link}</div>}
  </div>
);

const AddTopicPanel = ({ open, onClose, onAdd }) => {
  const empty = { topic: '', cat: 'Flutter', column: 'toLearn', est: '4', link: '', note: '' };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');
  const [saving, setSaving] = useStateA(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.topic.trim()) { setErr('Topic name is required.'); return; }
    const newItem = {
      topic: form.topic.trim(),
      cat: form.cat,
      est: parseFloat(form.est) || 4,
      link: form.link.trim() || '—',
      note: form.note.trim(),
      rev: false,
    };
    if (form.column === 'inProgress') {
      newItem.actual = 0;
      newItem.prog = 0;
    }
    if (form.column === 'completed') {
      newItem.actual = 0;
      newItem.lastReviewed = new Date().toISOString().slice(0, 10);
    }
    setSaving(true);
    try {
      await onAdd(form.column, newItem);
      setForm(empty);
      setErr('');
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to add topic.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Topic" subtitle="PERSONAL / LEARNING / ADD">
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="fld">
          <label>Topic *</label>
          <input value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Rust → Flutter FFI" />
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Category</label>
            <select value={form.cat} onChange={e => set('cat', e.target.value)}>
              {LEARN_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Add to column</label>
            <select value={form.column} onChange={e => set('column', e.target.value)}>
              <option value="toLearn">To Learn</option>
              <option value="inProgress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Est. hours</label>
            <input type="number" value={form.est} onChange={e => set('est', e.target.value)} placeholder="4" min="0.5" step="0.5" />
          </div>
          <div className="fld">
            <label>Resource link</label>
            <input value={form.link} onChange={e => set('link', e.target.value)} placeholder="docs.flutter.dev/..." />
          </div>
        </div>
        <div className="fld">
          <label>Notes</label>
          <textarea value={form.note} onChange={e => set('note', e.target.value)} placeholder="Why are you learning this?" />
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit} disabled={saving || !form.topic.trim()}>
          <Icon name="plus" size={12} /> {saving ? 'Adding…' : 'Add topic'}
        </button>
      </div>
    </SlidePanel>
  );
};

export const LearningPage = ({ learning, setLearning, workstationId }) => {
  const [showAdd, setShowAdd] = useStateA(false);

  const total = learning.toLearn.length + learning.inProgress.length + learning.completed.length;
  const done = learning.completed.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const today = new Date(2026, 4, 12);
  const dueForRev = learning.completed.filter(c => {
    if (c.rev) return true;
    const d = new Date(c.lastReviewed);
    return (today - d) / (1000 * 60 * 60 * 24) > 60;
  });

  const R = 38;
  const C = 2 * Math.PI * R;
  const off = C - (pct / 100) * C;

  const handleAdd = async (column, item) => {
    const { item: saved } = await createLearningItem(item, column, workstationId);
    setLearning(prev => ({ ...prev, [column]: [...prev[column], saved] }));
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">PERSONAL / LEARNING</div>
          <h1>Learning path</h1>
          <div className="sub">Curate · practice · revisit. {total} topics tracked.</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="rev" size={12} /> Mark revision</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12} /> New topic
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
        <div className="card">
          <div className="ring-wrap">
            <div className="ring">
              <svg viewBox="0 0 100 100" width="100" height="100">
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray={C} strokeDashoffset={off} strokeLinecap="square" />
              </svg>
              <div className="num">{pct}%</div>
            </div>
            <div className="ring-stats">
              <div className="cell"><div className="l">To learn</div><div className="v">{learning.toLearn.length}</div></div>
              <div className="cell"><div className="l">In progress</div><div className="v" style={{ color: 'var(--accent-hi)' }}>{learning.inProgress.length}</div></div>
              <div className="cell"><div className="l">Completed</div><div className="v" style={{ color: '#4ade80' }}>{learning.completed.length}</div></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="rev" size={14} /> Due for revision</div>
            <span className="lbl">{dueForRev.length}</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {dueForRev.map((c, i) => (
              <div key={i} style={{ padding: '10px 16px', borderBottom: i === dueForRev.length - 1 ? 0 : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{c.topic}</div>
                  <div className="label-mono" style={{ marginTop: 2 }}>last touched {c.lastReviewed}</div>
                </div>
                <span className="tag accent">{c.cat}</span>
              </div>
            ))}
            {dueForRev.length === 0 && <div style={{ padding: 16, color: 'var(--text-3)', fontSize: 12 }}>Nothing due — you're caught up.</div>}
          </div>
        </div>
      </div>

      <div className="learn-cols">
        {[
          { key: 'toLearn', t: 'TO LEARN', items: learning.toLearn },
          { key: 'inProgress', t: 'IN PROGRESS', items: learning.inProgress },
          { key: 'completed', t: 'COMPLETED', items: learning.completed },
        ].map(col => (
          <div key={col.key} className="learn-col">
            <div className="learn-h">
              <span className="t">{col.t}</span>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)', padding: '1px 6px', background: 'var(--bg-3)' }}>{col.items.length}</span>
            </div>
            <div className="learn-body">
              {col.items.map((it, i) => <LearnCard key={i} item={it} stage={col.key} />)}
            </div>
          </div>
        ))}
      </div>

      <AddTopicPanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  5. VAULT
// ═══════════════════════════════════════════════════════════════════
const VAULT_CATS = [
  { id: 'all', label: 'All items', icon: 'lock' },
  { id: 'api', label: 'API Keys', icon: 'key' },
  { id: 'pw', label: 'Passwords', icon: 'lock' },
  { id: 'env', label: 'Environment Vars', icon: 'code' },
  { id: 'ssh', label: 'SSH Keys', icon: 'key' },
  { id: 'other', label: 'Other', icon: 'folder' },
];

const catIcon = (c) => ({ api: 'key', pw: 'lock', env: 'code', ssh: 'key', other: 'folder' }[c] || 'lock');

const AddSecretPanel = ({ open, onClose, onAdd }) => {
  const empty = { name: '', cat: 'api', value: '' };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');
  const [show, setShow] = useStateA(false);
  const [saving, setSaving] = useStateA(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('Secret name is required.'); return; }
    if (!form.value.trim()) { setErr('Secret value is required.'); return; }
    setSaving(true);
    try {
      await onAdd({ cat: form.cat, name: form.name.trim(), value: form.value.trim() });
      setForm(empty);
      setErr('');
      setShow(false);
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to save secret.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Secret" subtitle="PERSONAL / VAULT / ADD">
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="vault-notice">
          <Icon name="lock" size={12} />
          <span>Stored locally only — never transmitted. Treat values as sensitive.</span>
        </div>
        <div className="fld">
          <label>Secret name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. OpenAI — Production" />
        </div>
        <div className="fld">
          <label>Category</label>
          <select value={form.cat} onChange={e => set('cat', e.target.value)}>
            <option value="api">API Key</option>
            <option value="pw">Password</option>
            <option value="env">Environment Variable</option>
            <option value="ssh">SSH Key</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="fld">
          <label>Value *</label>
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              value={form.value}
              onChange={e => set('value', e.target.value)}
              placeholder="sk-proj-..."
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>
              <Icon name="eye" size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit} disabled={saving || !form.name.trim() || !form.value.trim()}>
          <Icon name="lock" size={12} /> {saving ? 'Saving…' : 'Save secret'}
        </button>
      </div>
    </SlidePanel>
  );
};

export const VaultPage = ({ vault, setVault, workstationId }) => {
  const [cat, setCat] = useStateA('all');
  const [revealed, setRevealed] = useStateA({});
  const [q, setQ] = useStateA('');
  const [showAdd, setShowAdd] = useStateA(false);

  const items = vault.filter(v =>
    (cat === 'all' || v.cat === cat) &&
    (!q || v.name.toLowerCase().includes(q.toLowerCase()))
  );

  const handleAdd = async (item) => {
    const saved = await createVaultItem(item, workstationId);
    setVault(prev => [...prev, saved]);
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">PERSONAL / VAULT</div>
          <h1>Vault</h1>
          <div className="sub">{vault.length} secrets · AES-256 local · last unlocked 09:42</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={12} /> Export</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12} /> New secret
          </button>
        </div>
      </div>

      <div className="vault-warning">
        <Icon name="lock" size={12} />
        This vault is local-only — not synced to any cloud service. Back up your encrypted export regularly.
      </div>

      <div className="vault-layout">
        <div className="vault-cats">
          <div style={{ padding: '8px 10px 14px' }}>
            <input
              placeholder="Search vault…"
              value={q} onChange={e => setQ(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-2)', padding: '6px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'var(--f-mono)' }}
              autoComplete="off" data-form-type="other"
            />
          </div>
          {VAULT_CATS.map(c => {
            const count = c.id === 'all' ? vault.length : vault.filter(v => v.cat === c.id).length;
            return (
              <div key={c.id} className={'vault-cat' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)}>
                <Icon name={c.icon} size={13} />
                <span>{c.label}</span>
                <span className="c">{count}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 12, padding: '12px 10px', borderTop: '1px solid var(--border)', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em' }}>
            <div>VAULT FINGERPRINT</div>
            <div style={{ color: 'var(--text-2)', marginTop: 4, wordBreak: 'break-all' }}>4a:7f:c2:9d:e1:8b:33:91</div>
            <div style={{ marginTop: 12 }}>ENCRYPTED AT REST</div>
            <div style={{ color: '#4ade80', marginTop: 4 }}>AES-256-GCM</div>
          </div>
        </div>

        <div className="vault-list">
          <div className="vault-row" style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border-2)' }}>
            <span className="label-mono"></span>
            <span className="label-mono">NAME</span>
            <span className="label-mono">VALUE</span>
            <span className="label-mono">UPDATED</span>
            <span></span>
          </div>
          {items.map(v => {
            const isRev = revealed[v.id];
            return (
              <div key={v.id} className="vault-row">
                <span style={{ color: 'var(--text-3)' }}><Icon name={catIcon(v.cat)} size={14} /></span>
                <span className="name">{v.name}</span>
                <span className={'val' + (isRev ? ' revealed' : '')}>{isRev ? v.value : '••••••••••••••••••••••'}</span>
                <span className="date">{v.updated}</span>
                <span className="acts">
                  <button className="iconbtn" onClick={() => setRevealed(r => ({ ...r, [v.id]: !isRev }))} title={isRev ? 'Hide' : 'Reveal'}>
                    <Icon name="eye" size={13} />
                  </button>
                  <button className="iconbtn" title="Copy" onClick={() => navigator.clipboard?.writeText(v.value)}>
                    <Icon name="copy" size={13} />
                  </button>
                  <button className="iconbtn" title="Edit"><Icon name="edit" size={13} /></button>
                </span>
              </div>
            );
          })}
          {items.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No secrets match.</div>}
        </div>
      </div>

      <AddSecretPanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
};

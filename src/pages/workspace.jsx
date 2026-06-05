// workspace.jsx — Home, Projects, Tasks, Learning, Vault

import { useState as useStateA, useEffect as useEffectA, useRef as useRefA } from 'react';
import { createPortal } from 'react-dom';
import { Icon, SlidePanel } from '../components/shell.jsx';
import {
  loadUserData,
  createProject, updateProject, softDeleteProject, createTask, updateTask, softDeleteTask,
  createVaultItem, updateVaultItem, deleteVaultItem, getVaultConfig, saveVaultConfig, resetVault,
  createLearningItem, updateLearningItem, deleteLearningItem,
  createLearningSession, listLearningSessions, deleteLearningSession, getWeeklyLearningHours,
  createTag,
  linkNoteToTask, unlinkNoteFromTask, getTaskStatusLogs, getHomeStats, getProjectTasks,
  getTaskComments, addTaskComment, updateTaskComment, deleteTaskComment,
  loadCalendarWindow,
} from '../lib/db.js';
import {
  deriveKey, generateSalt, encryptValue, decryptValue,
  createVerifier, verifyKey,
  setSessionKey, getSessionKey, getSessionFingerprint, clearSessionKey, isVaultUnlocked,
} from '../lib/vault-crypto.js';
import { VAULT_AUTO_LOCK_MS } from '../lib/constants.js';
import { canDo } from '../lib/permissions.js';
import { renderMd } from './tools.jsx';
import { supabase } from '../lib/supabase.js';
import { ghGetRepos, ghGetLastCommit, ghCreateBranch, ghGetBranches, ghCreateRepo, ghDeleteRepo, ghDeleteBranch, ghGetTokenScopes } from '../lib/github.js';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────
const _avaColors = ['#0099ff', '#7c3aed', '#16a34a', '#d97706', '#ef4444', '#06b6d4', '#ec4899'];
const avaColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return _avaColors[Math.abs(h) % _avaColors.length];
};

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
  const wrapRef = useRefA(null);
  const [chartH, setChartH] = useStateA(150);

  useEffectA(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      if (h > 0) setChartH(h);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const chartData = data.map((d, i) => ({
    day: DAY_LABELS[i],
    h: i > todayIdx ? null : d.h,
    raw: d,
  }));

  return (
    <div className="wc-recharts" ref={wrapRef}>
      <ResponsiveContainer width="100%" height={chartH}>
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

export const HomePage = ({ user, timer, onNav, projects, tasks, notes, emailTemplates, statuses = [], priorities = [], setTasks, workstationId, onTimerPause, onTimerResume, onTimerStop }) => {
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

  // Priority counts across non-done tasks (dynamic, keyed by priority ID)
  const nonDoneTasks = tasks.filter(t => t.col !== doneStatusId);
  const sortedPriorities = [...priorities].sort((a, b) => a.order - b.order);
  const prioCounts = sortedPriorities.map(pr => ({
    ...pr,
    count: nonDoneTasks.filter(t => t.p === pr.id).length,
  })).filter(pr => pr.count > 0);
  const templatePreview = (emailTemplates || []).slice(0, 3);

  const todayIdx = (today.getDay() + 6) % 7; // 0 = Mon

  // ── Stateful digital clock ─────────────────────────────────────────
  const [time, setTime] = useStateA(new Date());
  useEffectA(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);
  const clockStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ── Today's calendar events (for the agenda digest) ───────────────
  const [todayEventCount, setTodayEventCount] = useStateA(0);
  useEffectA(() => {
    if (!workstationId) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    loadCalendarWindow(workstationId, start.toISOString(), end.toISOString())
      .then(d => setTodayEventCount((d.events?.length || 0) + (d.google?.length || 0)))
      .catch(() => setTodayEventCount(0));
  }, [workstationId]);

  const agendaParts = [
    `${dueTodayTasks.length} task${dueTodayTasks.length === 1 ? '' : 's'} due`,
    `${todayEventCount} event${todayEventCount === 1 ? '' : 's'}`,
  ];

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

      {/* 1b. TODAY'S AGENDA DIGEST */}
      <div className="cc-agenda-digest" onClick={() => onNav('calendar')} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onNav('calendar'); }}>
        <div className="cc-agenda-ic"><Icon name="calendar" size={16} /></div>
        <div className="cc-agenda-body">
          <span className="cc-agenda-label">Today</span>
          <span className="cc-agenda-summary">
            {agendaParts.join(' · ')}
            {overdueCount > 0 && <span className="cc-agenda-overdue"> · {overdueCount} overdue</span>}
          </span>
        </div>
        <span className="cc-agenda-cta">View calendar <Icon name="chev" size={13} /></span>
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
            <span className="val">{streakCurrent !== null ? streakCurrent : '0'}d</span>
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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {prioCounts.map(pr => (
                  <span key={pr.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--f-mono)', fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: pr.color + '22', color: pr.color, border: `1px solid ${pr.color}44` }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: pr.color, flexShrink: 0 }} />
                    {pr.label} · {pr.count}
                  </span>
                ))}
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
                    <div className="title">{t.title}</div>
                    {(() => { const pr = priorities.find(p => p.id === t.p); return pr ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'var(--f-mono)', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: pr.color + '22', color: pr.color, border: `1px solid ${pr.color}44`, flexShrink: 0 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: pr.color }} />{pr.label}</span> : null; })()}
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
              ) : notes.filter(n => n.pinned).slice(0, 3).map(n => (
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
const RepoSelector = ({ repos, loading, value, onChange, takenRepos = {} }) => {
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
              const linkedTo = takenRepos[r.html_url];
              const isTaken = !!linkedTo;
              return (
                <button
                  key={r.id}
                  className={'repo-sel-item' + (r.html_url === value ? ' active' : '') + (isTaken ? ' taken' : '')}
                  disabled={isTaken}
                  onClick={isTaken ? undefined : () => { onChange(r.html_url); setOpen(false); setQ(''); }}
                >
                  <div className="repo-sel-info">
                    <span className="repo-sel-reponame">{repoName}</span>
                    <span className="repo-sel-owner">{owner}</span>
                    {isTaken && <span className="repo-sel-linked">linked to {linkedTo}</span>}
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

const ProjectFormPanel = ({ open, onClose, initial, onSubmit, projectTypes = [], isGithubConnected = false, canGithubWrite = false, projects = [] }) => {
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
    if (isGithubConnected && ghRepos.length === 0) {
      setGhLoading(true);
      ghGetRepos().then(setGhRepos).catch(console.error).finally(() => setGhLoading(false));
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
    if (!isGithubConnected && form.repo.trim() && !GH_REPO_RE.test(form.repo.trim())) {
      setErr('Repository must be a valid GitHub URL (e.g. https://github.com/user/repo).'); return;
    }

    if (isGithubConnected && repoMode === 'new' && !newRepoName.trim()) {
      setErr('Repository name is required when creating a new repo.');
      return;
    }
    setSaving(true);
    try {
      let repoUrl = form.repo.trim() || '—';
      if (isGithubConnected && repoMode === 'new' && newRepoName.trim()) {
        const created = await ghCreateRepo(newRepoName.trim(), newRepoPrivate, form.description.trim());
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

        {isGithubConnected ? (
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
                    <RepoSelector
                      repos={ghRepos}
                      loading={ghLoading}
                      value={form.repo}
                      onChange={v => set('repo', v)}
                      takenRepos={Object.fromEntries(
                        projects
                          .filter(p => p !== initial && p.repo && p.repo !== '—')
                          .map(p => [p.repo, p.name])
                      )}
                    />
                  </div>
                )}
              </div>
              {/* Card: Create new — write permission required */}
              {canGithubWrite && <div className="branch-opt">
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
              </div>}
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

const ProjectViewPanel = ({ open, onClose, project, onEdit, onDelete, projectTypes = [], tasks = [], statuses = [], isGithubConnected = false, timer = null, canEdit = true, canDelete = true, canGithubWrite = false }) => {
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
    if (!isGithubConnected || !repoFullName) { setLastCommit(null); return; }
    setCommitLoading(true);
    setLastCommit(null);
    ghGetLastCommit(repoFullName)
      .then(data => setLastCommit(data?.[0] || null))
      .catch(() => setLastCommit(null))
      .finally(() => setCommitLoading(false));
    ghGetTokenScopes()
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
      if (deleteRepo && isGithubConnected && repoFullName) {
        try {
          await ghDeleteRepo(repoFullName);
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

        {repoFullName && isGithubConnected && (
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

        {repoFullName && !isGithubConnected && (
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
          const est = project.hoursEst || 0;
          const pct = est > 0 ? Math.min(100, Math.round((logged / est) * 100)) : null;
          const over = est > 0 && logged > est;
          const budgetAmt = parseBudgetAmount(project.budget);
          const hourlyRate = budgetAmt && est > 0 ? (budgetAmt / est) : null;
          const burnAmt = hourlyRate ? (hourlyRate * logged) : null;
          const burnPct = budgetAmt && burnAmt ? Math.round((burnAmt / budgetAmt) * 100) : null;
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
                  <span>Rate {project.budget?.replace(/[0-9,. ]+/, '') || ''}{hourlyRate.toFixed(0)}/h</span>
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
          {repoFullName && isGithubConnected && canGithubWrite && !hasDeleteScope && (
            <div style={{ fontSize: 11, marginBottom: 8, padding: '8px 12px', background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: 8, lineHeight: 1.6, color: '#f59e0b' }}>
              Your GitHub token is missing the <code style={{ fontFamily: 'var(--f-mono)', background: '#f59e0b20', padding: '1px 4px', borderRadius: 3 }}>delete_repo</code> scope — repo deletion will fail. Go to <strong>Settings → Integrations</strong> and reconnect GitHub to grant it.
            </div>
          )}

          {/* Optional: also delete the linked GitHub repo — write permission required */}
          {repoFullName && isGithubConnected && canGithubWrite && (
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
              className={'btn danger' + (canDelete ? '' : ' perm-denied')}
              style={{ fontSize: 12, width: '100%' }}
              onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(''); }}
              disabled={!canDelete}
              title={canDelete ? '' : "You don't have permission"}
            >
              Delete project{deleteRepo && repoFullName && isGithubConnected ? ' & repository' : ''}
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
        <button className={'btn primary' + (canEdit ? '' : ' perm-denied')} onClick={onEdit} disabled={!canEdit} title={canEdit ? '' : "You don't have permission"}>
          <Icon name="edit" size={12} /> Edit project
        </button>
      </div>
    </SlidePanel>
  );
};

export const ProjectsPage = ({ projects, setProjects, workstationId, projectTypes = [], tasks = [], setTasks, statuses = [], isGithubConnected = false, timer = null, jumpToItem, myRole = 'viewer', wsPermissions = {} }) => {
  const canCreate = canDo(myRole, 'create_project', wsPermissions);
  const canEdit = canDo(myRole, 'edit_project', wsPermissions);
  const canDelete = canDo(myRole, 'delete_project', wsPermissions);
  const canGithubWrite = canDo(myRole, 'github_write', wsPermissions);
  const NO_PERM = "You don't have permission";
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

  // Jump to a project from global search
  useEffectA(() => {
    if (!jumpToItem || jumpToItem.page !== 'projects') return;
    const target = projects.find(p => p.id === jumpToItem.id);
    if (target) setViewing(target);
  }, [jumpToItem?.ts]);

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
          <button className={'btn primary' + (canCreate ? '' : ' perm-denied')} onClick={() => setShowAdd(true)} disabled={!canCreate} title={canCreate ? 'New project' : NO_PERM}>
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
          <button className={'btn primary' + (canCreate ? '' : ' perm-denied')} onClick={() => setShowAdd(true)} disabled={!canCreate} title={canCreate ? 'New project' : NO_PERM}>
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
                <div key={p.id} className={`proj-card st-${p.status}`} onClick={() => setViewing(p)}>
                  <div className="pc-head">
                    <span className="pc-type">{projectTypes.find(pt => pt.id === p.typeId)?.label || '—'}</span>
                    <div className="pc-actions">
                      <StatusPill status={p.status} />
                      <button
                        className={'btn sm ghost pc-edit' + (canEdit ? '' : ' perm-denied')}
                        onClick={e => { e.stopPropagation(); setEditing(p); }}
                        disabled={!canEdit}
                        title={canEdit ? 'Edit project' : NO_PERM}
                      >
                        <Icon name="edit" size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="pc-name">{p.name}</div>
                  {p.client && <div className="pc-client">{p.client}</div>}
                  {p.description && <div className="pc-desc">{p.description}</div>}
                  {(p.stack || []).length > 0 && (
                    <div className="pc-stack">
                      {(p.stack || []).map(s => <span key={s} className="tag">{s}</span>)}
                    </div>
                  )}
                  <div className="pc-footer">
                    <span className="pc-dates">{fmtDate(p.start)} → {fmtDate(p.end)}</span>
                    <div className="pc-stats">
                      <span>{p.openTasks}/{p.tasks} tasks</span>
                      <span>{fmtHours(p.hoursLogged)}</span>
                    </div>
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
                    <button className={'btn sm ghost' + (canEdit ? '' : ' perm-denied')} onClick={e => { e.stopPropagation(); setEditing(p); }} disabled={!canEdit} title={canEdit ? 'Edit project' : NO_PERM}>
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
        isGithubConnected={isGithubConnected}
        timer={timer}
        onEdit={() => { setEditing(viewing); setViewing(null); }}
        onDelete={handleDelete}
        canEdit={canEdit}
        canDelete={canDelete}
        canGithubWrite={canGithubWrite}
      />
      <ProjectFormPanel open={showAdd} onClose={() => setShowAdd(false)} onSubmit={handleAdd} projectTypes={projectTypes} isGithubConnected={isGithubConnected} canGithubWrite={canGithubWrite} projects={projects} />
      <ProjectFormPanel open={!!editing} onClose={() => setEditing(null)} onSubmit={handleEdit} projectTypes={projectTypes} isGithubConnected={isGithubConnected} canGithubWrite={canGithubWrite} initial={editing} projects={projects} />
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

const TaskCard = ({ t, tasks, projects, allTags = [], doneStatusId, priorities = [], members = [], onDragStart, onDragEnd, onClick }) => {
  const proj = projects.find(p => p.id === t.proj);
  const subs = tasks ? tasks.filter(s => s.parentId === t._dbId) : [];
  const subsDone = doneStatusId ? subs.filter(s => s.col === doneStatusId).length : 0;
  const isDone = doneStatusId && t.col === doneStatusId;
  const prioObj = priorities.find(pr => pr.id === t.p);
  const assignee = t.assigneeId ? members.find(m => m.userId === t.assigneeId) : null;


  return (
    <div
      className={'tcard' + (isDone ? ' tcard-done' : getDueClass(t.due).includes('overdue') ? ' overdue' : '')}
      draggable
      onDragStart={(e) => onDragStart(e, t)}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="top">
        {prioObj && <span className="dot-p" style={{ background: prioObj.color }} title={prioObj.label}></span>}
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
        {assignee && (
          <div className="tcard-assignee" title={assignee.name}>
            {assignee.avatarUrl
              ? <img src={assignee.avatarUrl} className="assignee-ava" alt={assignee.name} />
              : <div className="assignee-ava assignee-ava-init" style={{ background: avaColor(assignee.name) }}>{assignee.avatar}</div>
            }
          </div>
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
    supabase.functions.invoke('og-proxy', { body: { url } })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.title || data?.image || data?.favicon) {
          setMeta(prev => ({
            ...prev,
            title: data.title || prev.title,
            thumb: data.image || prev.thumb,
            favicon: data.favicon || prev.favicon,
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

const fmtMin = (min) => {
  if (!min || min < 1) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const TaskDetailModal = ({
  task, projects, statuses = [], priorities = [], subtasks = [], allTasks = [], onClose, onSave, onStatusChange,
  onAddSubtask, onLinkSubtask, onOpenSubtask, parentTask, onBack,
  allTags = [], onCreateTag,
  notes = [], linkedNoteIds = [], onLinkNote, onUnlinkNote,
  onLogTime, isGithubConnected = false, onBranchUpdate, onDelete,
  members = [],
  currentUserId = null,
  myRole = 'viewer',
  canEdit = true, canDelete = true, canAssign = true, canGithubWrite = false,
}) => {
  const NO_PERM = "You don't have permission";
  // Keyed by status UUID so lookups work after task.col became a UUID
  const COL_COLOR = Object.fromEntries(statuses.map(s => [s.id, s.color]));
  const COL_LABEL = Object.fromEntries(statuses.map(s => [s.id, s.label]));
  const PRIO_MAP = Object.fromEntries(priorities.map(p => [p.id, p]));
  const proj = projects.find(p => p.id === task.proj);

  // 'done' status UUID — used for subtask completion percentage
  const doneStatusId = statuses.find(s => s.isDone)?.id;

  // Only allow moving to the immediately adjacent status in sequence
  const taskColIdx = statuses.findIndex(s => s.id === task.col);
  const isAllowedStatus = (id) => {
    const idx = statuses.findIndex(s => s.id === id);
    return Math.abs(idx - taskColIdx) <= 1;
  };

  const toForm = (t) => {
    const totalMin = t.estMinutes || 0;
    return {
      title: t.title,
      description: t.description || '',
      col: t.col,
      p: t.p || null,
      due: (!t.due || t.due === '—') ? '' : t.due,
      tagIds: t.tags || [],
      estH: totalMin > 0 ? String(Math.floor(totalMin / 60)) : '',
      estM: totalMin > 0 ? String(totalMin % 60) : '',
      assigneeId: t.assigneeId || '',
    };
  };

  const [form, setForm] = useStateA(() => toForm(task));
  const [saving, setSaving] = useStateA(false);
  const [err, setErr] = useStateA('');
  const [showSubForm, setShowSubForm] = useStateA(false);

  // Manual time log state
  const [showLogTime, setShowLogTime] = useStateA(false);
  const [logH, setLogH] = useStateA('');
  const [logM, setLogM] = useStateA('');
  const [logNote, setLogNote] = useStateA('');
  const [logSaving, setLogSaving] = useStateA(false);

  const handleLogTime = async () => {
    const minutes = (parseInt(logH) || 0) * 60 + (parseInt(logM) || 0);
    if (minutes <= 0) return;
    const projDbId = projects.find(p => p.id === task.proj)?._dbId;
    if (!projDbId) return;
    setLogSaving(true);
    try {
      await onLogTime(task._dbId, projDbId, minutes, logNote);
      setShowLogTime(false);
      setLogH(''); setLogM(''); setLogNote('');
    } catch (e) {
      console.error('Failed to log time:', e);
    } finally {
      setLogSaving(false);
    }
  };

  const handleQuickLog = async (minutes) => {
    const projDbId = projects.find(p => p.id === task.proj)?._dbId;
    if (!projDbId) return;
    try {
      await onLogTime(task._dbId, projDbId, minutes, 'Quick log');
    } catch (e) {
      console.error('Failed to log quick time:', e);
    }
  };

  // Status history
  const [statusLogs, setStatusLogs] = useStateA([]);
  const [logsLoading, setLogsLoading] = useStateA(false);
  const [statusSaving, setStatusSaving] = useStateA(false);
  const [logsVisible, setLogsVisible] = useStateA(10);
  const LOG_PAGE = 10;
  
  const [activityTab, setActivityTab] = useStateA('comments'); // 'all', 'comments', 'history', 'work log'


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
  const showBranchSection = !!isGithubConnected && !!taskRepoFull;

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

  // ── Comments ──────────────────────────────────────────────────────
  const MAX_COMMENT = 5000;
  const [comments, setComments] = useStateA([]);
  const [commentsLoading, setCommentsLoading] = useStateA(false);
  const COMMENTS_PAGE = 10;
  const [commentTotal, setCommentTotal] = useStateA(0);            // total top-level comments (from server)
  const [commentsLoadingMore, setCommentsLoadingMore] = useStateA(false);
  const loadedParentsRef = useRefA(0);                             // top-level comments currently loaded (for realtime reload)
  const [newCommentBody, setNewCommentBody] = useStateA('');
  const [commentSubmitting, setCommentSubmitting] = useStateA(false);
  const [editingCommentId, setEditingCommentId] = useStateA(null);
  const [editingCommentBody, setEditingCommentBody] = useStateA('');
  const [editSaving, setEditSaving] = useStateA(false);
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useStateA(null);
  const [commentErr, setCommentErr] = useStateA('');

  // ── Mention picker ────────────────────────────────────────────────
  const [mentionQuery, setMentionQuery] = useStateA('');
  const [mentionOpen, setMentionOpen] = useStateA(false);
  const [mentionIndex, setMentionIndex] = useStateA(0);
  const [pendingMentions, setPendingMentions] = useStateA([]);
  const commentTextareaRef = useRefA(null);

  const mentionMembers = members.filter(m =>
    mentionQuery === '' ? true : m.name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 6);

  const handleCommentInput = (e) => {
    const val = e.target.value;
    setNewCommentBody(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionQuery('');
    }
  };

  const handleMentionSelect = (member) => {
    const cursor = commentTextareaRef.current?.selectionStart ?? newCommentBody.length;
    const before = newCommentBody.slice(0, cursor);
    const after  = newCommentBody.slice(cursor);
    const replaced = before.replace(/@(\w*)$/, `@${member.name} `);
    setNewCommentBody(replaced + after);
    setMentionOpen(false);
    setMentionQuery('');
    setPendingMentions(prev =>
      prev.find(m => m.userId === member.userId) ? prev : [...prev, { userId: member.userId, name: member.name }]
    );
    setTimeout(() => commentTextareaRef.current?.focus(), 0);
  };

  const renderCommentBody = (body) => {
    if (!members || members.length === 0) {
      const parts = body.split(/(@\w+)/g);
      return parts.map((part, i) =>
        part.startsWith('@')
          ? <span key={i} className="mention-highlight">{part}</span>
          : part
      );
    }
    const names = members.map(m => m.name).sort((a, b) => b.length - a.length);
    const escapedNames = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(@(?:${escapedNames.join('|')}))`, 'gi');
    const parts = body.split(regex);
    return parts.map((part, i) =>
      part.startsWith('@') && names.some(n => part.toLowerCase() === '@' + n.toLowerCase())
        ? <span key={i} className="mention-highlight">{part}</span>
        : part
    );
  };

  // ── Reply state ───────────────────────────────────────────────────
  const [replyToId, setReplyToId] = useStateA(null);   // comment id being replied to
  const [replyBody, setReplyBody] = useStateA('');
  const [replySubmitting, setReplySubmitting] = useStateA(false);
  const [replyMentions, setReplyMentions] = useStateA([]);
  const [replyMentionQuery, setReplyMentionQuery] = useStateA('');
  const [replyMentionOpen, setReplyMentionOpen] = useStateA(false);
  const [replyMentionIndex, setReplyMentionIndex] = useStateA(0);
  const replyTextareaRef = useRefA(null);

  const replyMentionMembers = members.filter(m =>
    replyMentionQuery === '' ? true : m.name.toLowerCase().includes(replyMentionQuery.toLowerCase())
  ).slice(0, 6);

  const handleReplyInput = (e) => {
    const val = e.target.value;
    setReplyBody(val);
    const cursor = e.target.selectionStart;
    const match = val.slice(0, cursor).match(/@(\w*)$/);
    if (match) { setReplyMentionQuery(match[1]); setReplyMentionOpen(true); setReplyMentionIndex(0); }
    else { setReplyMentionOpen(false); setReplyMentionQuery(''); }
  };

  const handleReplyMentionSelect = (member) => {
    const cursor = replyTextareaRef.current?.selectionStart ?? replyBody.length;
    const replaced = replyBody.slice(0, cursor).replace(/@(\w*)$/, `@${member.name} `) + replyBody.slice(cursor);
    setReplyBody(replaced);
    setReplyMentionOpen(false);
    setReplyMentionQuery('');
    setReplyMentions(prev => prev.find(m => m.userId === member.userId) ? prev : [...prev, { userId: member.userId, name: member.name }]);
    setTimeout(() => replyTextareaRef.current?.focus(), 0);
  };

  const handleSubmitReply = async () => {
    const body = replyBody.trim();
    if (!body || body.length > MAX_COMMENT) return;
    setReplySubmitting(true);
    setCommentErr('');
    try {
      const comment = await addTaskComment(task._dbId, body, replyMentions.map(m => m.userId), replyToId);
      setComments(prev => [...prev, comment]);
      setReplyToId(null);
      setReplyBody('');
      setReplyMentions([]);
    } catch (e) {
      setCommentErr(e.message || 'Failed to post reply.');
    } finally {
      setReplySubmitting(false);
    }
  };

  // Group comments into threads: top-level + their replies.
  // Latest top-level comment first; replies stay chronological within a thread.
  // The server already pages by top-level comment, so we render every loaded thread.
  const commentThreads = comments
    .filter(c => !c.parentId)
    .map(parent => ({
      ...parent,
      replies: comments
        .filter(c => c.parentId === parent.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  loadedParentsRef.current = commentThreads.length;

  useEffectA(() => {
    if (!task._dbId) return;
    setCommentsLoading(true);
    getTaskComments(task._dbId, { limit: COMMENTS_PAGE, offset: 0 })
      .then(({ comments: c, total }) => { setComments(c); setCommentTotal(total); })
      .catch(() => { setComments([]); setCommentTotal(0); })
      .finally(() => setCommentsLoading(false));
  }, [task._dbId]);

  useEffectA(() => {
    if (!task._dbId) return;
    // Reload the window of threads currently on screen (at least one page) so a
    // realtime change doesn't collapse an expanded list.
    const reload = () => {
      const limit = Math.max(loadedParentsRef.current, COMMENTS_PAGE);
      getTaskComments(task._dbId, { limit, offset: 0 })
        .then(({ comments: c, total }) => { setComments(c); setCommentTotal(total); })
        .catch(() => {});
    };
    const ch = supabase
      .channel(`task-comments-${task._dbId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task._dbId}` }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task._dbId}` }, reload)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [task._dbId]);

  const handleShowMoreComments = async () => {
    setCommentsLoadingMore(true);
    try {
      const offset = comments.filter(c => !c.parentId).length;
      const { comments: more } = await getTaskComments(task._dbId, { limit: COMMENTS_PAGE, offset });
      setComments(prev => {
        const seen = new Set(prev.map(c => c.id));
        return [...prev, ...more.filter(c => !seen.has(c.id))];
      });
    } catch (e) {
      setCommentErr(e.message || 'Failed to load more comments.');
    } finally {
      setCommentsLoadingMore(false);
    }
  };

  const handleAddComment = async () => {
    const body = newCommentBody.trim();
    if (!body || body.length > MAX_COMMENT) return;
    setCommentSubmitting(true);
    setCommentErr('');
    try {
      const comment = await addTaskComment(task._dbId, body, pendingMentions.map(m => m.userId));
      setComments(prev => [...prev, comment]);
      setCommentTotal(t => t + 1);
      setNewCommentBody('');
      setPendingMentions([]);
    } catch (e) {
      setCommentErr(e.message || 'Failed to post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleEditComment = async (commentId) => {
    const body = editingCommentBody.trim();
    if (!body || body.length > MAX_COMMENT) return;
    setEditSaving(true);
    setCommentErr('');
    try {
      const updated = await updateTaskComment(commentId, body);
      setComments(prev => prev.map(c => c.id === commentId ? updated : c));
      setEditingCommentId(null);
      setEditingCommentBody('');
    } catch (e) {
      setCommentErr(e.message || 'Failed to update comment.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const wasTopLevel = comments.some(c => c.id === commentId && !c.parentId);
      await deleteTaskComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (wasTopLevel) setCommentTotal(t => Math.max(0, t - 1));
      setDeleteConfirmCommentId(null);
    } catch (e) {
      setCommentErr(e.message || 'Failed to delete comment.');
    }
  };

  useEffectA(() => {
    if (!showBranchSection || branchMode !== 'switch' || !branchOpen) return;
    setBranchesLoading(true);
    ghGetBranches(taskRepoFull)
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
        await ghCreateBranch(taskRepoFull, name);
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
      if (deleteBranch && isGithubConnected && taskRepoFull && task.ghBranch) {
        await ghDeleteBranch(taskRepoFull, task.ghBranch);
      }
      await onDelete(task);
    } catch (e) {
      setDeleteErr(e.message || 'Failed to delete task.');
      setDeletingTask(false);
    }
  };

  useEffectA(() => {
    setForm(toForm(task)); setErr(''); setShowSubForm(false);
    setShowLogTime(false); setLogH(''); setLogM(''); setLogNote('');
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
        p: form.p || null,
        due: form.due || '—',
        tags: form.tagIds,
        estMinutes: (parseInt(form.estH) || 0) * 60 + (parseInt(form.estM) || 0),
        assigneeId: form.assigneeId || null,
      });
    } catch (e) {
      setErr(e.message || 'Failed to save.');
      setSaving(false);
    }
  };

  // ── Subtask add form ────────────────────────────────────────────
  // Default subtask status: the first status in sequence (index 0)
  const defaultStatusId = statuses[0]?.id || '';
  const subEmpty = { title: '', description: '', p: priorities[0]?.id || null, col: defaultStatusId, due: '', tagIds: [] };
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
        p: subForm.p || null,
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
  const subLoggedTotal = subtasks.reduce((sum, s) => sum + (s.loggedMinutes || 0), 0);

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
                    {subLoggedTotal > 0 && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Icon name="timer" size={10} />
                        {fmtMin(subLoggedTotal)} logged
                      </span>
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
                        {(() => { const pr = PRIO_MAP[sub.p]; return <span className="dot-p" style={{ background: pr ? pr.color : 'var(--text-4)' }} />; })()}
                        <span className="subtask-title">{sub.title}</span>
                        <span className="subtask-meta">
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: COL_COLOR[sub.col], textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {COL_LABEL[sub.col]}
                          </span>
                          {sub.loggedMinutes > 0 && (
                            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Icon name="timer" size={9} />{fmtMin(sub.loggedMinutes)}
                            </span>
                          )}
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
                        <select value={subForm.p || ''} onChange={e => setSub('p', e.target.value || null)}>
                          <option value="">— None —</option>
                          {priorities.map(pr => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
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
                            {(() => { const pr = priorities.find(p => p.id === t.p); return pr ? <span className="dot-p" style={{ background: pr.color }} /> : null; })()}
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

            {/* ── Activity Tabs ── */}
            <div style={{ marginTop: 24 }}>
              <div className="tpanel-section" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Activity</span>
              </div>
              
              <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 16 }}>
                {['comments', 'history', 'work log'].map(tab => {
                  const isActive = activityTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActivityTab(tab)}
                      style={{
                        padding: '6px 14px',
                        fontSize: 13,
                        fontWeight: 400,
                        borderRadius: 6,
                        background: isActive ? 'var(--primary-fade, rgba(0, 153, 255, 0.1))' : 'transparent',
                        color: isActive ? 'var(--primary, #0099ff)' : 'var(--text-3)',
                        border: isActive ? '1px solid var(--primary, #0099ff)' : '1px solid transparent',
                        margin: -1,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s ease',
                        position: isActive ? 'relative' : 'static',
                        zIndex: isActive ? 2 : 1
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.target.style.color = 'var(--text)';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.target.style.color = 'var(--text-3)';
                      }}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* ── Content ── */}
              
              {(activityTab === 'all' || activityTab === 'history') && (
                <div>
                  <div className="tpanel-section" style={{ marginTop: 4, display: activityTab === 'all' ? 'flex' : 'none' }}>
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
              )}

              {(activityTab === 'all' || activityTab === 'comments') && (
                <div style={{ marginTop: activityTab === 'all' ? 24 : 0 }}>
                  <div className="tpanel-section" style={{ display: activityTab === 'all' ? 'flex' : 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="message-square" size={12} />
                      Comments
                      {commentTotal > 0 && <span className="subtasks-count">{commentTotal}</span>}
                    </span>
                  </div>

              {/* Composer */}
              <div className="task-comment-composer" style={{ marginBottom: 24, borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    ref={commentTextareaRef}
                    className="task-comment-textarea"
                    placeholder="Write a comment… type @ to mention (Ctrl+Enter to submit)"
                    value={newCommentBody}
                    onChange={handleCommentInput}
                    rows={3}
                    onKeyDown={e => {
                      if (mentionOpen) {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionMembers.length - 1)); return; }
                        if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
                        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (mentionMembers[mentionIndex]) handleMentionSelect(mentionMembers[mentionIndex]); return; }
                        if (e.key === 'Escape')    { setMentionOpen(false); return; }
                      }
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
                    }}
                  />
                  {mentionOpen && mentionMembers.length > 0 && (
                    <div className="mention-dropdown">
                      {mentionMembers.map((m, i) => (
                        <div
                          key={m.userId}
                          className={'mention-item' + (i === mentionIndex ? ' active' : '')}
                          onMouseDown={e => { e.preventDefault(); handleMentionSelect(m); }}
                        >
                          {m.avatarUrl
                            ? <img src={m.avatarUrl} className="assignee-ava" style={{ width: 24, height: 24 }} alt={m.name} />
                            : <div className="assignee-ava assignee-ava-init" style={{ width: 24, height: 24, fontSize: 9, background: avaColor(m.name) }}>{m.avatar}</div>
                          }
                          <div className="mention-item-info">
                            <span className="mention-item-name">{m.name}</span>
                            <span className="mention-item-role">{m.role}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="task-comment-composer-footer">
                  <span className="task-comment-char-count" style={{ color: newCommentBody.length > MAX_COMMENT ? '#ef4444' : undefined }}>
                    {newCommentBody.length}/{MAX_COMMENT}
                  </span>
                  <button className="btn sm primary" onClick={handleAddComment}
                    disabled={commentSubmitting || !newCommentBody.trim() || newCommentBody.length > MAX_COMMENT}>
                    {commentSubmitting ? 'Posting…' : 'Comment'}
                  </button>
                </div>
              </div>

              {commentsLoading ? (
                <div className="subtasks-empty">Loading…</div>
              ) : comments.length === 0 ? (
                <div className="subtasks-empty">No comments yet — start the conversation.</div>
              ) : (
                <div className="task-comments-list">
                  {commentThreads.map(thread => {
                    const renderCommentRow = (c, isReply = false) => {
                      const isOwn = c.userId === currentUserId;
                      const canRemove = isOwn || myRole === 'owner';
                      const isEditing = editingCommentId === c.id;
                      const isConfirming = deleteConfirmCommentId === c.id;
                      return (
                        <div key={c.id} className={'task-comment-row' + (isReply ? ' task-comment-reply' : '')}>
                          <div className="task-comment-avatar">
                            {c.authorAvatarUrl
                              ? <img src={c.authorAvatarUrl} className="assignee-ava" alt={c.authorName} style={{ width: isReply ? 22 : 28, height: isReply ? 22 : 28 }} />
                              : <div className="assignee-ava assignee-ava-init" style={{ width: isReply ? 22 : 28, height: isReply ? 22 : 28, fontSize: isReply ? 9 : 10, background: avaColor(c.authorName) }}>
                                  {c.authorAvatar || c.authorName?.[0]?.toUpperCase() || '?'}
                                </div>
                            }
                          </div>
                          <div className="task-comment-content">
                            <div className="task-comment-header">
                              <span className="task-comment-author">{c.authorName}</span>
                              <span className="task-comment-time">{timeAgo(c.createdAt)}</span>
                              {c.editedAt && <span className="task-comment-edited">Edited</span>}
                            </div>
                            {isEditing ? (
                              <div className="task-comment-edit-form">
                                <textarea className="task-comment-textarea" value={editingCommentBody}
                                  onChange={e => setEditingCommentBody(e.target.value)} rows={2} autoFocus />
                                <div className="task-comment-edit-actions">
                                  <span className="task-comment-char-count" style={{ color: editingCommentBody.length > MAX_COMMENT ? '#ef4444' : undefined }}>
                                    {editingCommentBody.length}/{MAX_COMMENT}
                                  </span>
                                  <button className="btn sm ghost" onClick={() => { setEditingCommentId(null); setEditingCommentBody(''); }}>Cancel</button>
                                  <button className="btn sm primary" onClick={() => handleEditComment(c.id)}
                                    disabled={editSaving || !editingCommentBody.trim() || editingCommentBody.length > MAX_COMMENT}>
                                    {editSaving ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : isConfirming ? (
                              <div className="task-comment-delete-confirm">
                                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Delete this comment?</span>
                                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                  <button className="btn sm ghost" onClick={() => setDeleteConfirmCommentId(null)}>Cancel</button>
                                  <button className="btn sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                    onClick={() => handleDeleteComment(c.id)}>Delete</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="task-comment-body">{renderCommentBody(c.body)}</div>
                                <div className="task-comment-actions">
                                  {!isReply && (
                                    <button className="task-comment-action-btn"
                                      onClick={() => { setReplyToId(c.id); setReplyBody(''); setTimeout(() => replyTextareaRef.current?.focus(), 50); }}>
                                      Reply
                                    </button>
                                  )}
                                  {isOwn && (
                                    <button className="task-comment-action-btn"
                                      onClick={() => { setEditingCommentId(c.id); setEditingCommentBody(c.body); }}>
                                      Edit
                                    </button>
                                  )}
                                  {canRemove && (
                                    <button className="task-comment-action-btn danger"
                                      onClick={() => setDeleteConfirmCommentId(c.id)}>
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div key={thread.id} className="task-comment-thread">
                        {renderCommentRow(thread, false)}

                        {/* Replies */}
                        {thread.replies.length > 0 && (
                          <div className="task-comment-replies">
                            {thread.replies.map(r => renderCommentRow(r, true))}
                          </div>
                        )}

                        {/* Inline reply composer */}
                        {replyToId === thread.id && (
                          <div className="task-comment-reply-composer">
                            <div style={{ position: 'relative' }}>
                              <textarea
                                ref={replyTextareaRef}
                                className="task-comment-textarea"
                                placeholder={`Reply to ${thread.authorName}… (@ to mention)`}
                                value={replyBody}
                                onChange={handleReplyInput}
                                rows={2}
                                onKeyDown={e => {
                                  if (replyMentionOpen) {
                                    if (e.key === 'ArrowDown') { e.preventDefault(); setReplyMentionIndex(i => Math.min(i + 1, replyMentionMembers.length - 1)); return; }
                                    if (e.key === 'ArrowUp')   { e.preventDefault(); setReplyMentionIndex(i => Math.max(i - 1, 0)); return; }
                                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (replyMentionMembers[replyMentionIndex]) handleReplyMentionSelect(replyMentionMembers[replyMentionIndex]); return; }
                                    if (e.key === 'Escape') { setReplyMentionOpen(false); return; }
                                  }
                                  if (e.key === 'Escape') { setReplyToId(null); setReplyBody(''); }
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitReply();
                                }}
                              />
                              {replyMentionOpen && replyMentionMembers.length > 0 && (
                                <div className="mention-dropdown">
                                  {replyMentionMembers.map((m, i) => (
                                    <div key={m.userId} className={'mention-item' + (i === replyMentionIndex ? ' active' : '')}
                                      onMouseDown={e => { e.preventDefault(); handleReplyMentionSelect(m); }}>
                                      {m.avatarUrl
                                        ? <img src={m.avatarUrl} className="assignee-ava" style={{ width: 20, height: 20 }} alt={m.name} />
                                        : <div className="assignee-ava assignee-ava-init" style={{ width: 20, height: 20, fontSize: 9, background: avaColor(m.name) }}>{m.avatar}</div>
                                      }
                                      <div className="mention-item-info">
                                        <span className="mention-item-name">{m.name}</span>
                                        <span className="mention-item-role">{m.role}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="task-comment-composer-footer">
                              <span className="task-comment-char-count" style={{ color: replyBody.length > MAX_COMMENT ? '#ef4444' : undefined }}>
                                {replyBody.length}/{MAX_COMMENT}
                              </span>
                              <button className="btn sm ghost" onClick={() => { setReplyToId(null); setReplyBody(''); }}>Cancel</button>
                              <button className="btn sm primary" onClick={handleSubmitReply}
                                disabled={replySubmitting || !replyBody.trim() || replyBody.length > MAX_COMMENT}>
                                {replySubmitting ? 'Posting…' : 'Reply'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {commentThreads.length < commentTotal && (
                    <button
                      className="btn sm ghost task-comments-more"
                      onClick={handleShowMoreComments}
                      disabled={commentsLoadingMore}
                    >
                      {commentsLoadingMore
                        ? 'Loading…'
                        : `Show more comments (${commentTotal - commentThreads.length})`}
                    </button>
                  )}
                </div>
              )}

              {commentErr && <div style={{ fontSize: 11, color: '#ef4444', margin: '4px 0' }}>{commentErr}</div>}


            </div>
              )}

              {activityTab === 'work log' && (
                <div className="subtasks-empty">No work logs available.</div>
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
              <select className="tpanel-sel" value={form.p || ''} onChange={e => set('p', e.target.value || null)}
                style={{ borderLeftColor: PRIO_MAP[form.p]?.color || 'var(--border)', borderLeftWidth: 3 }}>
                <option value="">— None —</option>
                {priorities.map(pr => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
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

            {/* Assignee */}
            {members.length > 0 && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Assignee</div>
                <select
                  className={'tpanel-sel' + (canAssign ? '' : ' perm-denied')}
                  value={form.assigneeId || ''}
                  onChange={e => set('assigneeId', e.target.value || '')}
                  disabled={!canAssign}
                  title={canAssign ? '' : NO_PERM}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

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
              <div className="tpanel-prop-label">Time & Progress</div>
              <div className="time-tracker-card">
                <div className="tt-header">
                  <div className="tt-label-group">
                    <Icon name="timer" size={12} />
                    <span className="tt-main-title">Tracking Progress</span>
                  </div>
                  {(() => {
                    const est = (parseInt(form.estH) || 0) * 60 + (parseInt(form.estM) || 0);
                    const logged = task.loggedMinutes || 0;
                    const pct = est > 0 ? Math.min(100, Math.round((logged / est) * 100)) : 0;
                    return est > 0 ? (
                      <span className={`tt-badge ${logged > est ? 'overtime' : ''}`}>{pct}%</span>
                    ) : (
                      <span className="tt-badge no-estimate">No Est</span>
                    );
                  })()}
                </div>

                {(() => {
                  const est = (parseInt(form.estH) || 0) * 60 + (parseInt(form.estM) || 0);
                  const logged = task.loggedMinutes || 0;
                  return est > 0 ? (
                    <div className="tt-progress-track">
                      <div className={`tt-progress-bar ${logged > est ? 'overtime' : ''}`} style={{ width: `${Math.min(100, (logged / est) * 100)}%` }} />
                    </div>
                  ) : (
                    <div className="tt-progress-track empty">
                      <div className="tt-progress-bar" style={{ width: '0%' }} />
                    </div>
                  );
                })()}

                <div className="tt-stats-grid">
                  <div className="tt-stat-box">
                    <span className="tt-stat-label">Logged</span>
                    <span className="tt-stat-value">{fmtMin(task.loggedMinutes)}</span>
                  </div>
                  <div className="tt-stat-box">
                    <span className="tt-stat-label">Estimate</span>
                    <div className="tt-est-editor">
                      <input
                        type="number" min="0"
                        value={form.estH}
                        onChange={e => set('estH', e.target.value)}
                        placeholder="0"
                        className="tt-num-input"
                      />
                      <span className="tt-unit">h</span>
                      <input
                        type="number" min="0" max="59"
                        value={form.estM}
                        onChange={e => set('estM', e.target.value)}
                        placeholder="0"
                        className="tt-num-input"
                      />
                      <span className="tt-unit">m</span>
                    </div>
                  </div>
                </div>

                <div className="tt-footer-actions">
                  <button
                    className={`tt-action-btn ${showLogTime ? 'active' : ''}`}
                    onClick={() => setShowLogTime(s => !s)}
                  >
                    <Icon name={showLogTime ? 'x' : 'plus'} size={10} />
                    {showLogTime ? 'Close Log' : 'Log Time'}
                  </button>

                  {!showLogTime && (
                    <div className="tt-presets">
                      <button className="tt-preset-btn" onClick={() => handleQuickLog(15)}>+15m</button>
                      <button className="tt-preset-btn" onClick={() => handleQuickLog(30)}>+30m</button>
                      <button className="tt-preset-btn" onClick={() => handleQuickLog(60)}>+1h</button>
                    </div>
                  )}
                </div>

                {showLogTime && (
                  <div className="tt-log-form animate-slide-down">
                    <div className="tt-log-inputs">
                      <div className="tt-log-field">
                        <label className="tt-log-label">Time to Log</label>
                        <div className="add-task-est-container" style={{ marginTop: 4 }}>
                          <div className="add-task-est-field">
                            <input
                              type="number" min="0"
                              value={logH}
                              onChange={e => setLogH(e.target.value)}
                              placeholder="0"
                              className="add-task-est-input"
                              autoFocus
                            />
                            <span className="add-task-est-unit">hours</span>
                          </div>
                          <div className="add-task-est-field">
                            <input
                              type="number" min="0" max="59"
                              value={logM}
                              onChange={e => setLogM(e.target.value)}
                              placeholder="0"
                              className="add-task-est-input"
                            />
                            <span className="add-task-est-unit">minutes</span>
                          </div>
                        </div>
                      </div>
                      <div className="tt-log-field">
                        <label className="tt-log-label">Notes (optional)</label>
                        <input
                          placeholder="What did you do?"
                          value={logNote}
                          onChange={e => setLogNote(e.target.value)}
                          className="tt-log-notes-input"
                        />
                      </div>
                    </div>
                    <div className="tt-log-buttons">
                      <button
                        className="tt-log-btn cancel"
                        onClick={() => { setShowLogTime(false); setLogH(''); setLogM(''); setLogNote(''); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="tt-log-btn submit"
                        onClick={handleLogTime}
                        disabled={logSaving || ((parseInt(logH) || 0) * 60 + (parseInt(logM) || 0)) <= 0}
                      >
                        {logSaving ? '…' : 'Add time'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Created */}
            {createdStr && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Created</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>{createdStr}</div>
              </div>
            )}

            {/* GitHub Branch */}
            {taskRepoFull && !isGithubConnected && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Branch</div>
                <GhConnectHint label="Connect GitHub to manage branches for this task." />
              </div>
            )}

            {isGithubConnected && !taskRepoFull && taskProjObj && (
              <div className="tpanel-prop">
                <div className="tpanel-prop-label">Branch</div>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
                  fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
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

                {/* Toggle: switch to existing — write permission required */}
                {canGithubWrite && <div className="branch-opt" style={{ marginTop: 2 }}>
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
                </div>}

                {/* Toggle: create new branch — write permission required */}
                {canGithubWrite && <div className="branch-opt" style={{ marginTop: 4 }}>
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
                </div>}

                {/* Disconnect branch — write permission required */}
                {canGithubWrite && task.ghBranch && (
                  <div className="branch-opt" style={{ marginTop: 4 }}>
                    <button
                      className="branch-opt-toggle"
                      style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', textAlign: 'left' }}
                      onClick={handleBranchDisconnect}
                      disabled={branchSaving}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        <line x1="4" y1="4" x2="20" y2="20" />
                      </svg>
                      <span>{branchSaving ? 'Disconnecting…' : 'Disconnect branch'}</span>
                    </button>
                    {branchErr && <div className="branch-opt-err" style={{ padding: '0 12px 8px' }}>{branchErr}</div>}
                  </div>
                )}
              </div>
            )}

            {/* Delete zone */}
            {onDelete && canDelete && (
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
          <button className={'btn primary' + (canEdit ? '' : ' perm-denied')} onClick={handleSave} disabled={saving || !form.title.trim() || !canEdit} title={canEdit ? '' : NO_PERM}>
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

const AddTaskPanel = ({ open, onClose, onAdd, projects, defaultCol = '', defaultParentId = null, statuses = [], priorities = [], allTags = [], onCreateTag, isGithubConnected = false, canGithubWrite = false, onBranchCreated }) => {
  const empty = { title: '', proj: projects[0]?.id || '', p: priorities[0]?.id || null, col: defaultCol || statuses[0]?.id || '', tagIds: [], due: '', description: '', estH: '', estM: '' };
  const [form, setForm] = useStateA(empty);

  // Reset col when defaultCol (i.e. which column's + button was clicked) changes
  useEffectA(() => { setForm(f => ({ ...f, col: defaultCol || statuses[0]?.id || '' })); }, [defaultCol]);

  const [err, setErr] = useStateA('');
  const [saving, setSaving] = useStateA(false);
  const [branchMode, setBranchMode] = useStateA('none'); // 'none' | 'create' | 'existing'
  const [branchName, setBranchName] = useStateA('');
  const [existingBranch, setExistingBranch] = useStateA('');
  const [branches, setBranches] = useStateA([]);
  const [branchesLoading, setBranchesLoading] = useStateA(false);
  const [branchErr, setBranchErr] = useStateA('');
  const branchEditedRef = useRefA(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedProj = projects.find(p => p.id === form.proj);
  const projRepoFull = selectedProj?.repo && selectedProj.repo !== '—'
    ? selectedProj.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('?')[0]
    : null;
  const showBranchOption = !!isGithubConnected && !!projRepoFull && !!canGithubWrite;

  // Auto-generate branch name from title unless user has manually edited it
  const handleTitleChange = (v) => {
    set('title', v);
    if (!branchEditedRef.current) setBranchName(v ? toBranchName(v) : '');
  };

  // Fetch branches when "existing" mode is selected
  useEffectA(() => {
    if (branchMode !== 'existing' || !isGithubConnected || !projRepoFull) return;
    setBranchesLoading(true);
    ghGetBranches(projRepoFull)
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
      p: form.p || null,
      title: form.title.trim(),
      description: form.description,
      due: form.due || '—',
      tags: form.tagIds,
      estMinutes: (parseInt(form.estH) || 0) * 60 + (parseInt(form.estM) || 0),
      ...(defaultParentId ? { parentId: defaultParentId } : {}),
    };
    setSaving(true);
    setBranchErr('');
    try {
      const savedTask = await onAdd(newTask);
      if (branchMode === 'create' && projRepoFull) {
        try {
          await ghCreateBranch(projRepoFull, branchName.trim());
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
            <select value={form.p || ''} onChange={e => set('p', e.target.value || null)}>
              <option value="">— None —</option>
              {priorities.map(pr => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
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
        <div className="fld">
          <label>Estimated Duration</label>
          <div className="add-task-est-container">
            <div className="add-task-est-field">
              <input
                type="number" min="0"
                value={form.estH}
                onChange={e => set('estH', e.target.value)}
                placeholder="0"
                className="add-task-est-input"
              />
              <span className="add-task-est-unit">hours</span>
            </div>
            <div className="add-task-est-field">
              <input
                type="number" min="0" max="59"
                value={form.estM}
                onChange={e => set('estM', e.target.value)}
                placeholder="0"
                className="add-task-est-input"
              />
              <span className="add-task-est-unit">minutes</span>
            </div>
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

        {projRepoFull && !isGithubConnected && (
          <GhConnectHint label="Connect GitHub to auto-create a branch when adding this task." />
        )}

        {isGithubConnected && !projRepoFull && selectedProj && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
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
                  <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
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
                  <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
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

export const TasksPage = ({ tasks, setTasks, projects, workstationId, statuses = [], priorities = [], tags = [], setTags, notes = [], taskNoteLinks = {}, setTaskNoteLinks, onLogTime, isGithubConnected = false, jumpToItem, members = [], myRole = 'viewer', wsPermissions = {}, user = null }) => {
  const canCreateTask = canDo(myRole, 'create_task', wsPermissions);
  const canEditTask = canDo(myRole, 'edit_task', wsPermissions);
  const canGithubWrite = canDo(myRole, 'github_write', wsPermissions);
  const canDeleteTask = canDo(myRole, 'delete_task', wsPermissions);
  const canAssignTask = canDo(myRole, 'assign_task', wsPermissions);
  const NO_PERM = "You don't have permission";
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
  const [addParentId, setAddParentId] = useStateA(null);
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

  // Jump to a task from global search
  useEffectA(() => {
    if (!jumpToItem || jumpToItem.page !== 'tasks') return;
    const source = localTasks || tasks;
    const target = source.find(t => t._dbId === jumpToItem.id);
    if (target) setViewingTask(target);
  }, [jumpToItem?.ts]);

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
    (prioFilter === 'all' || t.p === prioFilter) &&
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

  const openAdd = (col = cols[0]?.id || '', parentId = null) => { setAddCol(col); setAddParentId(parentId); setShowAdd(true); };

  // ── Drag handlers ─────────────────────────────────────────────────
  const handleDragStart = (e, task) => {
    // Moving a card between columns changes its status — that's an edit.
    if (!canEditTask) { e.preventDefault(); return; }
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
          <button className={'btn primary' + (canCreateTask ? '' : ' perm-denied')} onClick={() => openAdd()} disabled={!canCreateTask} title={canCreateTask ? 'New task' : NO_PERM}>
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
            {[{ id: 'all', label: 'All', color: 'var(--text-4)' }, ...priorities].map(v => (
              <button
                key={v.id}
                ref={el => prioRefs.current[v.id] = el}
                className={'chip' + (prioFilter === v.id ? ' active' : '')}
                onClick={() => setPrioFilter(v.id)}
              >
                <span className="dot-p" style={{ background: v.color }} />
                {v.label}
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
          <button className={'btn primary' + (canCreateTask ? '' : ' perm-denied')} onClick={() => openAdd()} disabled={!canCreateTask} title={canCreateTask ? 'New task' : NO_PERM}>
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
                  {parent && (() => { const pr = priorities.find(p => p.id === parent.p); return pr ? <span className="dot-p" style={{ background: pr.color, width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} /> : null; })()}
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
                              doneStatusId={doneStatusId} priorities={priorities} members={members} onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                              onClick={() => setViewingTask(t)} />
                          ))}
                          {items.length === 0 && <div className="sg-col-empty" />}
                          <button
                            className={'btn ghost' + (canCreateTask ? '' : ' perm-denied')}
                            style={{ justifyContent: 'center', color: 'var(--text-3)', fontSize: 11, padding: '6px', borderStyle: 'dashed', margin: '4px 0' }}
                            onClick={() => openAdd(col.id, parentId)}
                            disabled={!canCreateTask} title={canCreateTask ? '' : NO_PERM}>
                            <Icon name="plus" size={10} /> Add task
                          </button>
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
                      priorities={priorities}
                      members={members}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => setViewingTask(t)}
                    />
                  ))}
                  <button
                    className={'btn ghost' + (canCreateTask ? '' : ' perm-denied')}
                    style={{ justifyContent: 'center', color: 'var(--text-3)', fontSize: 11, padding: '6px', borderStyle: 'dashed' }}
                    onClick={() => openAdd(col.id)}
                    disabled={!canCreateTask} title={canCreateTask ? '' : NO_PERM}>
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
                          {parent && (() => { const pr = priorities.find(p => p.id === parent.p); return pr ? <span className="dot-p" style={{ background: pr.color, width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} /> : null; })()}
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-3)' }}>{parent?.id || '—'}</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{parent?.title || 'Unknown task'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({subtasks.length})</span>
                          {parentStatus && <span className="pill muted" style={{ textTransform: 'uppercase', fontSize: 10 }}>{parentStatus.label}</span>}
                        </div>
                      </td>
                    </tr>,
                    ...(!isCollapsed ? [
                      ...subtasks.map(t => {
                        const isRowDone = doneStatusId && t.col === doneStatusId;
                        const taskProj = projects.find(p => p.id === t.proj);
                        const branchUrl = t.ghBranch && taskProj?.repo
                          ? `${taskProj.repo.replace(/\/$/, '')}/tree/${t.ghBranch}` : null;
                        return (
                          <tr key={t.id} style={{ cursor: 'pointer', opacity: isRowDone ? 0.6 : 1, background: isRowDone ? 'var(--bg-green, rgba(34,197,94,0.06))' : undefined }} onClick={() => setViewingTask(t)}>
                            <td className="mono" style={{ paddingLeft: 32 }}>{t.id}</td>
                            <td>{(() => { const pr = priorities.find(p => p.id === t.p); return pr ? <span className="dot-p" style={{ background: pr.color }} title={pr.label} /> : <span className="dot-p" style={{ background: 'var(--text-4)' }} />; })()}</td>
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
                      }),
                      <tr key={`add-${parentId}`}>
                        <td colSpan={7} style={{ paddingLeft: 32, paddingTop: 4, paddingBottom: 4 }}>
                          <button
                            className={'btn ghost' + (canCreateTask ? '' : ' perm-denied')}
                            style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-3)', borderStyle: 'dashed' }}
                            onClick={() => openAdd(cols[0]?.id, parentId)}
                            disabled={!canCreateTask} title={canCreateTask ? '' : NO_PERM}>
                            <Icon name="plus" size={10} /> Add task
                          </button>
                        </td>
                      </tr>,
                    ] : [])
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
                    <td>{(() => { const pr = priorities.find(p => p.id === t.p); return pr ? <span className="dot-p" style={{ background: pr.color }} title={pr.label} /> : <span className="dot-p" style={{ background: 'var(--text-4)' }} />; })()}</td>
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
        open={showAdd} onClose={() => { setShowAdd(false); setAddParentId(null); }} onAdd={handleAdd}
        projects={projects} defaultCol={addCol} defaultParentId={addParentId} statuses={cols} priorities={priorities}
        allTags={tags} onCreateTag={handleCreateTag} isGithubConnected={isGithubConnected} canGithubWrite={canGithubWrite}
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
          priorities={priorities}
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
          isGithubConnected={isGithubConnected}
          canGithubWrite={canGithubWrite}
          onBranchUpdate={handleBranchUpdate}
          onDelete={handleTaskDelete}
          members={members}
          currentUserId={user?.id}
          myRole={myRole}
          canEdit={canEditTask}
          canDelete={canDeleteTask}
          canAssign={canAssignTask}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  4. LEARNING PATH
// ═══════════════════════════════════════════════════════════════════
const LEARN_COLS = [
  { key: 'toLearn', label: 'TO LEARN', dot: 'var(--text-3)' },
  { key: 'inProgress', label: 'IN PROGRESS', dot: 'var(--accent)' },
  { key: 'completed', label: 'COMPLETED', dot: '#4ade80' },
];
const TAG_PALETTE = ['#54C5F8', '#4ade80', '#a855f7', '#f97316', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16', '#ef4444', '#fb923c'];
const getTagColor = (tag) => {
  if (!tag) return '#6b7280';
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
};

// ── Streak & last-active helpers ─────────────────────────────────
const lTodayStr = () => new Date().toISOString().slice(0, 10);
const lReadStreak = () => {
  try { return JSON.parse(localStorage.getItem('orbit:learn:streak') || '{"count":0,"lastDate":""}'); }
  catch { return { count: 0, lastDate: '' }; }
};
const lTouchStreak = () => {
  const today = lTodayStr();
  const s = lReadStreak();
  if (s.lastDate === today) return s;
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const next = { count: s.lastDate === yest ? s.count + 1 : 1, lastDate: today };
  localStorage.setItem('orbit:learn:streak', JSON.stringify(next));
  return next;
};
const lTouchActive = () => localStorage.setItem('orbit:learn:lastActive', lTodayStr());
const lShouldReEngage = () => {
  const last = localStorage.getItem('orbit:learn:lastActive');
  return last ? (Date.now() - new Date(last).getTime()) / 86400000 >= 3 : false;
};

// ── LearnCard ────────────────────────────────────────────────────
const DIFF_COLOR = { easy: '#4ade80', medium: '#f59e0b', hard: '#ef4444' };

const LearnCard = ({ item, stage, onEdit, onDelete, onMove, onToggleRev, onLogHours, onSessions, selectMode, isSelected, onToggleSelect }) => {
  const [menuOpen, setMenuOpen] = useStateA(false);
  const menuRef = useRefA(null);
  const color = getTagColor(item.cat);
  const prog = item.prog || 0;
  const otherCols = LEARN_COLS.filter(c => c.key !== stage);

  useEffectA(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const daysSince = item.lastReviewed
    ? Math.floor((Date.now() - new Date(item.lastReviewed).getTime()) / 86400000)
    : null;

  return (
    <div
      className={`lcard${isSelected ? ' lcard-selected' : ''}`}
      style={{ borderLeftColor: color, cursor: selectMode ? 'pointer' : 'default' }}
      onClick={selectMode ? () => onToggleSelect(item._dbId) : undefined}
    >
      {/* select checkbox */}
      {selectMode && (
        <div className="lcard-cb-wrap">
          <span className={`lcard-cb${isSelected ? ' checked' : ''}`}>
            {isSelected && <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
        </div>
      )}

      {/* row 1: tag + difficulty + actions */}
      <div className="lcard-head">
        <div className="lcard-cat">
          <span className="lcard-cat-dot" style={{ background: color }} />
          <span style={{ color }}>{item.cat}</span>
          {item.rev && <span className="lcard-rev-pill">revision</span>}
          {item.difficulty && (
            <span className="lcard-diff" style={{ color: DIFF_COLOR[item.difficulty], borderColor: DIFF_COLOR[item.difficulty] + '55' }}>
              {item.difficulty}
            </span>
          )}
        </div>
        {!selectMode && <div className="lcard-acts">
          <div ref={menuRef} className="lcard-move-wrap">
            <button className="lcard-act" title="Move to column" onClick={() => setMenuOpen(o => !o)}>
              <Icon name="arrow" size={11} />
            </button>
            {menuOpen && (
              <div className="lcard-move-menu">
                {otherCols.map(c => (
                  <button key={c.key} onClick={() => { onMove(item, c.key); setMenuOpen(false); }}>
                    <span style={{ background: c.dot, width: 6, height: 6, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={`lcard-act${item.rev ? ' lcard-act-on' : ''}`} title={item.rev ? 'Unmark revision' : 'Mark for revision'} onClick={() => onToggleRev(item)}>
            <Icon name="rev" size={11} />
          </button>
          {(stage === 'inProgress' || stage === 'completed') && (
            <button className="lcard-act" title="Session history" onClick={() => onSessions(item)}>
              <Icon name="timer" size={11} />
            </button>
          )}
          <button className="lcard-act" title="Edit" onClick={() => onEdit(item)}>
            <Icon name="edit" size={11} />
          </button>
          <button className="lcard-act lcard-act-del" title="Delete" onClick={() => onDelete(item)}>
            <Icon name="trash" size={11} />
          </button>
        </div>}
      </div>

      {/* row 2: topic title */}
      <div className="lcard-title">{item.topic}</div>

      {/* row 3: progress bar (in-progress only) */}
      {stage === 'inProgress' && (
        <div className="lcard-prog-row">
          <div className="lcard-prog-track">
            <div className="lcard-prog-fill" style={{ width: prog + '%', background: color }} />
          </div>
          <span className="lcard-prog-num" style={{ color }}>{prog}%</span>
        </div>
      )}

      {/* row 4: meta */}
      <div className="lcard-meta">
        {item.est > 0 && (
          <span>
            {stage === 'inProgress'
              ? <><span className="lcard-meta-hi" style={{ color }}>{item.actual || 0}</span>/{item.est}h</>
              : `${item.est}h est`}
          </span>
        )}
        {stage === 'completed' && (
          <span className={daysSince !== null && daysSince > 60 ? 'lcard-meta-warn' : 'lcard-meta-ok'}>
            {daysSince === null ? 'never reviewed' : daysSince === 0 ? 'reviewed today' : `reviewed ${daysSince}d ago`}
          </span>
        )}
      </div>

      {/* note */}
      {item.note && <div className="lcard-note">"{item.note}"</div>}

      {/* resource link — same thumbnail preview as task view */}
      {item.link && item.link !== '—' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <LinkPreview key={item.link} url={item.link} />
        </div>
      )}

      {/* log hours button — in-progress */}
      {stage === 'inProgress' && (
        <button className="lcard-log-btn" onClick={() => onLogHours(item)}>
          <Icon name="timer" size={10} /> log hours
        </button>
      )}
    </div>
  );
};

// ── Tag dropdown ─────────────────────────────────────────────────
const TagDropdown = ({ value, onChange, allTags }) => {
  const [open, setOpen] = useStateA(false);
  const [search, setSearch] = useStateA('');
  const ref = useRefA(null);

  useEffectA(() => {
    if (!open) { setSearch(''); return; }
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = allTags.filter(t => !q || t.toLowerCase().includes(q));
  const isNew = search.trim() && !allTags.some(t => t.toLowerCase() === search.trim().toLowerCase());

  const select = (tag) => { onChange(tag); setOpen(false); };

  return (
    <div ref={ref} className="tag-drop-wrap">
      <button type="button" className={`tag-drop-trigger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {value ? (
          <>
            <span className="tag-dot" style={{ background: getTagColor(value) }} />
            <span className="tag-name">{value}</span>
          </>
        ) : (
          <span className="tag-placeholder">Pick or create a tag…</span>
        )}
        <svg className="tag-chevron" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="tag-drop-menu">
          <div className="tag-drop-search">
            <svg viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or create…"
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim()) select(search.trim());
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>
          <div className="tag-drop-list">
            {filtered.map(t => (
              <button key={t} type="button" className={`tag-drop-item${value === t ? ' active' : ''}`} onClick={() => select(t)}>
                <span className="tag-dot" style={{ background: getTagColor(t) }} />
                <span style={{ flex: 1 }}>{t}</span>
                {value === t && (
                  <svg className="tag-check" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
            {isNew && (
              <button type="button" className="tag-drop-item tag-drop-create" onClick={() => select(search.trim())}>
                <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                <span>Create &ldquo;<strong>{search.trim()}</strong>&rdquo;</span>
              </button>
            )}
            {filtered.length === 0 && !isNew && (
              <div className="tag-drop-empty">No tags yet — type to create one</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Topic form panel (shared Add + Edit) ─────────────────────────
const TopicFormPanel = ({ open, onClose, onSave, initial, mode, allTags }) => {
  const empty = { topic: '', cat: '', column: 'toLearn', est: '4', link: '', note: '', difficulty: null };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');
  const [saving, setSaving] = useStateA(false);

  useEffectA(() => {
    if (!open) return;
    setErr('');
    setForm(initial ? {
      topic: initial.topic || '',
      cat: initial.cat || '',
      column: initial._col || 'toLearn',
      est: String(initial.est || '4'),
      link: (initial.link === '—' ? '' : initial.link) || '',
      note: initial.note || '',
      difficulty: initial.difficulty || null,
    } : empty);
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.topic.trim()) { setErr('Topic name is required.'); return; }
    const item = {
      ...(initial || {}),
      topic: form.topic.trim(),
      cat: form.cat,
      est: parseFloat(form.est) || 4,
      link: form.link.trim() || '—',
      note: form.note.trim(),
      difficulty: form.difficulty || null,
    };
    if (mode === 'add') {
      item.rev = false;
      if (form.column === 'inProgress') { item.actual = 0; item.prog = 0; }
      if (form.column === 'completed') { item.actual = 0; item.lastReviewed = lTodayStr(); }
    }
    setSaving(true);
    try { await onSave(form.column, item); onClose(); }
    catch (e) { setErr(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const isEdit = mode === 'edit';
  return (
    <SlidePanel open={open} onClose={onClose}
      title={isEdit ? 'Edit Topic' : 'New Topic'}
      subtitle={`PERSONAL / LEARNING / ${isEdit ? 'EDIT' : 'ADD'}`}>
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="fld">
          <label>Topic *</label>
          <input value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Rust → Flutter FFI" />
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Tag</label>
            <TagDropdown value={form.cat} onChange={v => set('cat', v)} allTags={allTags} />
          </div>
          <div className="fld">
            <label>{isEdit ? 'Column' : 'Add to'}</label>
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
        <div className="fld">
          <label>Difficulty</label>
          <div className="diff-pills">
            {[null, 'easy', 'medium', 'hard'].map(d => (
              <button
                key={d ?? 'none'}
                type="button"
                className={`diff-pill${form.difficulty === d ? ' active' : ''}`}
                style={form.difficulty === d && d ? { borderColor: DIFF_COLOR[d], color: DIFF_COLOR[d], background: DIFF_COLOR[d] + '18' } : {}}
                onClick={() => set('difficulty', d)}
              >
                {d ?? 'None'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit} disabled={saving || !form.topic.trim()}>
          <Icon name={isEdit ? 'check' : 'plus'} size={12} />
          {saving ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save changes' : 'Add topic')}
        </button>
      </div>
    </SlidePanel>
  );
};

// ── Sessions panel ───────────────────────────────────────────────
const SessionsPanel = ({ item, stage, onClose, onLogHours, onSessionDeleted }) => {
  const [sessions, setSessions] = useStateA(null);
  const [loading, setLoading] = useStateA(false);
  const [deleting, setDeleting] = useStateA(null);

  useEffectA(() => {
    if (!item) return;
    setLoading(true);
    listLearningSessions(item._dbId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [item?._dbId]);

  const handleDelete = async (session) => {
    setDeleting(session.id);
    try {
      const updated = await deleteLearningSession(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      onSessionDeleted(updated);
    } catch (e) { /* ignore */ }
    finally { setDeleting(null); }
  };

  const totalHours = (sessions || []).reduce((s, x) => s + x.hours, 0);

  return (
    <SlidePanel open={!!item} onClose={onClose} title="Session history" subtitle="LEARNING / SESSIONS">
      <div className="sp-body">
        {item && (
          <>
            <div className="sess-topic">{item.topic}</div>
            <div className="sess-meta-row">
              <span>{(sessions || []).length} session{(sessions || []).length !== 1 ? 's' : ''}</span>
              <span>{totalHours}h total logged</span>
              {stage === 'inProgress' && (
                <button className="btn primary" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 12px' }}
                  onClick={() => { onClose(); onLogHours(item); }}>
                  <Icon name="timer" size={11} /> Log session
                </button>
              )}
            </div>
            {loading && <div className="sess-empty">Loading…</div>}
            {!loading && sessions?.length === 0 && <div className="sess-empty">No sessions logged yet.</div>}
            {!loading && sessions?.map(s => (
              <div key={s.id} className="sess-row">
                <div className="sess-row-left">
                  <span className="sess-date">{s.date}</span>
                  <span className="sess-hours">{s.hours}h</span>
                </div>
                <div className="sess-note">{s.note || <span style={{ color: 'var(--text-3)' }}>—</span>}</div>
                <button
                  className="sess-del"
                  title="Delete session"
                  disabled={deleting === s.id}
                  onClick={() => handleDelete(s)}
                >
                  <Icon name="trash" size={11} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </SlidePanel>
  );
};

// ── Log Hours dialog ─────────────────────────────────────────────
const LogHoursDialog = ({ item, onSave, onClose }) => {
  const [hrs, setHrs] = useStateA('1');
  const [note, setNote] = useStateA('');
  const [err, setErr] = useStateA('');
  const [busy, setBusy] = useStateA(false);

  useEffectA(() => { if (item) { setHrs('1'); setNote(''); setErr(''); } }, [item]);
  if (!item) return null;

  const val = parseFloat(hrs);
  const newActual = (item.actual || 0) + (isNaN(val) ? 0 : val);
  const newProg = item.est > 0 ? Math.min(100, Math.round((newActual / item.est) * 100)) : (item.prog || 0);
  const color = getTagColor(item.cat);

  const adjustHrs = (amount) => {
    const current = parseFloat(hrs) || 0;
    const next = Math.max(0.25, current + amount);
    setHrs(String(next));
    setErr('');
  };

  const save = async () => {
    if (isNaN(val) || val <= 0) { setErr('Enter hours > 0.'); return; }
    setBusy(true);
    try { await onSave(item, val, note.trim(), newProg); onClose(); }
    catch (e) { setErr(e.message || 'Failed to log session.'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 380, maxWidth: '100%', borderRadius: 16 }}>
        <div className="modal-title" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Log session</div>
        <div className="modal-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span className="tag-dot" style={{ background: color, width: 6, height: 6, borderRadius: '50%' }} />
          <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{item.topic}</span>
        </div>
        {err && <div className="modal-err" style={{ marginTop: 12 }}>{err}</div>}

        {/* Large custom hrs stepper */}
        <div className="log-stepper-row">
          <button type="button" className="log-step-btn" onClick={() => adjustHrs(-0.5)}>
            <Icon name="minus" size={14} />
          </button>
          <div className="log-hrs-input-wrap">
            <input
              type="number"
              value={hrs}
              min="0.25"
              step="0.25"
              autoFocus
              onChange={e => { setHrs(e.target.value); setErr(''); }}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
              className="log-hrs-val-input"
            />
            <span className="log-hrs-unit">hrs</span>
          </div>
          <button type="button" className="log-step-btn" onClick={() => adjustHrs(0.5)}>
            <Icon name="plus" size={14} />
          </button>
        </div>

        {/* Quick select presets */}
        <div className="log-presets">
          {[0.5, 1, 2, 4].map(preset => (
            <button
              key={preset}
              type="button"
              className="log-preset-btn"
              onClick={() => { setHrs(String(preset)); setErr(''); }}
            >
              +{preset}h
            </button>
          ))}
        </div>

        {/* Dynamic progress bar preview */}
        {item.est > 0 && !isNaN(val) && val > 0 && (
          <div className="log-preview-box">
            <div className="log-preview-labels">
              <span>Progress Preview</span>
              <span className="pct-change">{item.prog || 0}% → {newProg}%</span>
            </div>
            <div className="log-preview-bar">
              <div className="log-bar-current" style={{ width: `${Math.min(100, item.prog || 0)}%` }} />
              <div className="log-bar-added" style={{
                left: `${Math.min(100, item.prog || 0)}%`,
                width: `${Math.min(100 - (item.prog || 0), newProg - (item.prog || 0))}%`,
              }} />
            </div>
            <div className="log-preview-details">
              <span className="log-det-logged">
                <span className="log-det-dot log-det-dot-logged" />
                Logged: {item.actual || 0}h
              </span>
              <span className="log-det-session">
                <span className="log-det-dot log-det-dot-session" />
                +{val}h session
              </span>
              <span className="log-det-goal">Goal: {item.est}h</span>
            </div>
          </div>
        )}

        {/* Notes input */}
        <div className="fld" style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>
            What did you work on? <span className="opt-label">(optional)</span>
          </label>
          <textarea
            className="log-notes-input"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. completed core API integration, reviewed documentation"
            rows={2}
          />
        </div>

        <div className="modal-footer" style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || isNaN(val) || val <= 0}>
            <Icon name="timer" size={12} /> {busy ? 'Saving…' : 'Log session'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Delete confirm ───────────────────────────────────────────────
const LearnDeleteDialog = ({ item, onConfirm, onCancel }) => {
  if (!item) return null;
  return createPortal(
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 320, maxWidth: '100%' }}>
        <div className="modal-title">Delete topic?</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', margin: '8px 0 20px' }}>
          <strong>{item.topic}</strong> will be permanently deleted.
        </div>
        <div className="modal-footer">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Main LearningPage ────────────────────────────────────────────
export const LearningPage = ({ learning, setLearning, workstationId, jumpToItem }) => {
  const [showAdd, setShowAdd] = useStateA(false);
  const [editItem, setEditItem] = useStateA(null);
  const [deleteTarget, setDeleteTarget] = useStateA(null);
  const [logHoursItem, setLogHoursItem] = useStateA(null);
  const [sessionsItem, setSessionsItem] = useStateA(null);
  const [sessionsStage, setSessStage] = useStateA(null);
  const [streak, setStreak] = useStateA(() => lReadStreak());
  const [showReEngage, setShowReEngage] = useStateA(() => lShouldReEngage());
  const [searchQ, setSearchQ] = useStateA('');
  const [sortBy, setSortBy] = useStateA('date');
  const [sortOpen, setSortOpen] = useStateA(false);
  const [selectMode, setSelectMode] = useStateA(false);
  const [selected, setSelected] = useStateA(new Set());
  const [weeklyHours, setWeeklyHours] = useStateA(0);
  const [weeklyGoal, setWeeklyGoal] = useStateA(() => Number(localStorage.getItem('orbit:learn:weeklyGoal')) || 10);
  const [goalEdit, setGoalEdit] = useStateA(false);
  const [goalInput, setGoalInput] = useStateA('');
  const [overviewTab, setOverviewTab] = useStateA('revision');
  const sortRef = useRefA(null);

  useEffectA(() => {
    const close = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffectA(() => {
    getWeeklyLearningHours(workstationId).then(setWeeklyHours).catch(() => { });
  }, [workstationId]);

  // Jump to a learning item from global search
  useEffectA(() => {
    if (!jumpToItem || jumpToItem.page !== 'learning') return;
    const allItems = [...learning.toLearn, ...learning.inProgress, ...learning.completed];
    const target = allItems.find(i => i._dbId === jumpToItem.id);
    if (target) setEditItem(target);
  }, [jumpToItem?.ts]);

  const total = learning.toLearn.length + learning.inProgress.length + learning.completed.length;
  const done = learning.completed.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalEst = [...learning.toLearn, ...learning.inProgress, ...learning.completed]
    .reduce((s, i) => s + (i.est || 0), 0);
  const totalLogged =
    learning.inProgress.reduce((s, i) => s + (i.actual || 0), 0) +
    learning.completed.reduce((s, i) => s + (i.actual || i.est || 0), 0);

  const today = new Date();
  const dueForRev = learning.completed.filter(c => {
    if (c.rev) return true;
    if (!c.lastReviewed) return true;
    return (today - new Date(c.lastReviewed)) / 86400000 > 60;
  });

  const allItems = [...learning.toLearn, ...learning.inProgress, ...learning.completed];
  const allTags = [...new Set(allItems.map(i => i.cat).filter(Boolean))].sort();

  const tagBreakdown = allTags.map(tag => {
    const items = allItems.filter(i => i.cat === tag);
    const hours = items.reduce((s, i) => {
      if (i._col === 'completed' || learning.completed.some(c => c._dbId === i._dbId))
        return s + (i.actual || i.est || 0);
      return s + (i.actual || 0);
    }, 0);
    return { tag, hours };
  }).filter(t => t.hours > 0).sort((a, b) => b.hours - a.hours);
  const tagMaxHours = tagBreakdown[0]?.hours || 1;

  const weekGoalPct = weeklyGoal > 0 ? Math.min(100, Math.round((weeklyHours / weeklyGoal) * 100)) : 0;
  const saveGoal = () => {
    const v = parseFloat(goalInput);
    if (!isNaN(v) && v > 0) { setWeeklyGoal(v); localStorage.setItem('orbit:learn:weeklyGoal', String(v)); }
    setGoalEdit(false);
  };

  const R = 38, CIRC = 2 * Math.PI * R;
  const off = CIRC - (pct / 100) * CIRC;

  const recordActivity = () => { setStreak(lTouchStreak()); lTouchActive(); setShowReEngage(false); };
  const refreshWeeklyHours = () => getWeeklyLearningHours(workstationId).then(setWeeklyHours).catch(() => { });
  const reloadLearning = () => loadUserData(workstationId).then(d => { setLearning(d.learning); refreshWeeklyHours(); }).catch(() => { });

  const SORT_LABELS = { date: 'Date added', est: 'Est. hours', tag: 'Tag', diff: 'Difficulty' };
  const DIFF_ORDER = { hard: 0, medium: 1, easy: 2 };
  const applySearch = (items) => !searchQ.trim() ? items : items.filter(i => i.topic.toLowerCase().includes(searchQ.toLowerCase()));
  const applySort = (items) => {
    const arr = [...items];
    if (sortBy === 'est') return arr.sort((a, b) => (b.est || 0) - (a.est || 0));
    if (sortBy === 'tag') return arr.sort((a, b) => (a.cat || '').localeCompare(b.cat || ''));
    if (sortBy === 'diff') return arr.sort((a, b) => (DIFF_ORDER[a.difficulty] ?? 3) - (DIFF_ORDER[b.difficulty] ?? 3));
    return arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  };
  const processItems = (items) => applySort(applySearch(items));

  const toggleSelect = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const handleBulkMove = async (toCol) => {
    const ids = [...selected];
    const allItems = [...learning.toLearn, ...learning.inProgress, ...learning.completed];
    await Promise.all(ids.map(id => {
      const item = allItems.find(i => i._dbId === id);
      if (!item) return null;
      const toSave = { ...item };
      if (toCol === 'completed') toSave.lastReviewed = lTodayStr();
      return updateLearningItem(toSave, toCol);
    }));
    setLearning(prev => {
      const next = { toLearn: [...prev.toLearn], inProgress: [...prev.inProgress], completed: [...prev.completed] };
      ids.forEach(id => {
        const fromCol = Object.keys(next).find(k => next[k].some(i => i._dbId === id));
        if (!fromCol) return;
        const item = next[fromCol].find(i => i._dbId === id);
        next[fromCol] = next[fromCol].filter(i => i._dbId !== id);
        if (item && !next[toCol].some(i => i._dbId === id)) next[toCol].push({ ...item });
      });
      return next;
    });
    exitSelectMode();
    recordActivity();
    reloadLearning();
  };

  const handleAdd = async (column, item) => {
    const { item: saved } = await createLearningItem(item, column, workstationId);
    setLearning(prev => ({ ...prev, [column]: [...prev[column], saved] }));
    recordActivity();
  };

  const handleEditOpen = (item, column) => setEditItem({ item: { ...item, _col: column }, column });

  const handleEditSave = async (newColumn, updatedItem) => {
    const oldColumn = editItem.column;
    const colChanged = newColumn !== oldColumn;
    const toSave = { ...updatedItem };
    if (colChanged && newColumn === 'completed' && !toSave.lastReviewed) toSave.lastReviewed = lTodayStr();
    const { item: saved } = await updateLearningItem(toSave, colChanged ? newColumn : null);
    setLearning(prev => {
      const next = { ...prev };
      if (colChanged) {
        next[oldColumn] = next[oldColumn].filter(x => x._dbId !== saved._dbId);
        next[newColumn] = [...next[newColumn], saved];
      } else {
        next[oldColumn] = next[oldColumn].map(x => x._dbId === saved._dbId ? saved : x);
      }
      return next;
    });
    setEditItem(null);
    recordActivity();
    reloadLearning();
  };

  const handleMove = async (item, fromCol, toCol) => {
    const toSave = { ...item };
    if (toCol === 'inProgress') { toSave.actual = toSave.actual ?? 0; toSave.prog = toSave.prog ?? 0; }
    if (toCol === 'completed') toSave.lastReviewed = lTodayStr();
    const { item: saved } = await updateLearningItem(toSave, toCol);
    setLearning(prev => {
      const next = { ...prev };
      next[fromCol] = next[fromCol].filter(x => x._dbId !== item._dbId);
      next[toCol] = [...next[toCol], saved];
      return next;
    });
    recordActivity();
    reloadLearning();
  };

  const handleToggleRev = async (item, column) => {
    const { item: saved } = await updateLearningItem({ ...item, rev: !item.rev }, null);
    setLearning(prev => ({ ...prev, [column]: prev[column].map(x => x._dbId === saved._dbId ? saved : x) }));
  };

  const handleDeleteConfirm = async () => {
    const { item, column } = deleteTarget;
    await deleteLearningItem(item._dbId);
    setLearning(prev => ({ ...prev, [column]: prev[column].filter(x => x._dbId !== item._dbId) }));
    setDeleteTarget(null);
  };

  const handleLogHoursSave = async (item, hours, note, newProg) => {
    const { learning: saved } = await createLearningSession(item._dbId, hours, note);
    const withProg = { ...saved, prog: newProg };
    await updateLearningItem(withProg, null);
    setLearning(prev => ({ ...prev, inProgress: prev.inProgress.map(x => x._dbId === saved._dbId ? { ...saved, prog: newProg } : x) }));
    setWeeklyHours(prev => prev + hours);
    recordActivity();
  };

  const handleSessionDeleted = (updatedLearning) => {
    setLearning(prev => {
      const col = Object.keys(prev).find(k => prev[k].some(i => i._dbId === updatedLearning._dbId));
      if (!col) return prev;
      return { ...prev, [col]: prev[col].map(x => x._dbId === updatedLearning._dbId ? { ...x, actual: updatedLearning.actual } : x) };
    });
    refreshWeeklyHours();
  };

  return (
    <div className="page page-wide">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <div className="crumb">PERSONAL / LEARNING</div>
          <h1>Learning path</h1>
          <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {total} topic{total !== 1 ? 's' : ''} tracked
            {streak.count > 1 && (
              <span className="learn-streak">
                <Icon name="rev" size={11} /> {streak.count}-day streak
              </span>
            )}
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12} /> New topic
          </button>
        </div>
      </div>

      {/* ── Re-engagement banner ─────────────────────────────── */}
      {showReEngage && (
        <div className="learn-engage">
          <span>
            <strong>Welcome back.</strong>{' '}
            <span style={{ color: 'var(--text-2)' }}>
              You're {pct}% through your path — {learning.toLearn.length} topic{learning.toLearn.length !== 1 ? 's' : ''} still to start.
            </span>
          </span>
          <button className="btn ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setShowReEngage(false)}>Dismiss</button>
        </div>
      )}

      {/* ── Stats + overview cards ────────────────────────────── */}
      <div className="learn-overview">
        <div className="card learn-overview-main">
          <div className="ring-wrap">
            <div className="ring">
              <svg viewBox="0 0 100 100" width="100" height="100">
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--accent)" strokeWidth="6"
                  strokeDasharray={CIRC} strokeDashoffset={off} strokeLinecap="square" />
              </svg>
              <div className="num">{pct}%</div>
            </div>
            <div className="ring-stats">
              <div className="cell"><div className="l">To learn</div><div className="v">{learning.toLearn.length}</div></div>
              <div className="cell"><div className="l">In progress</div><div className="v" style={{ color: 'var(--accent-hi)' }}>{learning.inProgress.length}</div></div>
              <div className="cell"><div className="l">Completed</div><div className="v" style={{ color: '#4ade80' }}>{learning.completed.length}</div></div>
              <div className="cell"><div className="l">Est. total</div><div className="v" style={{ fontSize: 14 }}>{totalEst}h</div></div>
              <div className="cell"><div className="l">Logged</div><div className="v" style={{ fontSize: 14, color: 'var(--accent-hi)' }}>{totalLogged}h</div></div>
              <div className="cell"><div className="l">Revision due</div><div className="v" style={{ fontSize: 14, color: dueForRev.length > 0 ? '#fbbf24' : 'var(--text-3)' }}>{dueForRev.length}</div></div>
            </div>
          </div>
          {/* Weekly goal row */}
          <div className="learn-goal-row">
            <div className="learn-goal-label">
              <span>This week</span>
              {goalEdit ? (
                <span className="learn-goal-edit-wrap">
                  <input
                    className="learn-goal-input"
                    type="number" min="1" step="1"
                    value={goalInput}
                    autoFocus
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setGoalEdit(false); }}
                    placeholder={String(weeklyGoal)}
                  />
                  <button className="learn-goal-ok" onClick={saveGoal}>✓</button>
                </span>
              ) : (
                <button className="learn-goal-edit-btn" onClick={() => { setGoalInput(String(weeklyGoal)); setGoalEdit(true); }} title="Set weekly goal">
                  {weeklyHours}h / {weeklyGoal}h goal
                  <svg viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2V8L8.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
                </button>
              )}
            </div>
            <div className="learn-goal-track">
              <div className="learn-goal-fill" style={{ width: weekGoalPct + '%', background: weekGoalPct >= 100 ? '#4ade80' : 'var(--accent)' }} />
            </div>
            <span className="learn-goal-pct">{weekGoalPct}%</span>
          </div>
        </div>

        {/* Right card: tabbed (revision / tags) */}
        <div className="card learn-overview-rev">
          <div className="card-h" style={{ paddingBottom: 0, borderBottom: 'none' }}>
            <div className="learn-tabs">
              <button className={`learn-tab${overviewTab === 'revision' ? ' active' : ''}`} onClick={() => setOverviewTab('revision')}>
                Revision due {dueForRev.length > 0 && <span className="learn-tab-badge">{dueForRev.length}</span>}
              </button>
              <button className={`learn-tab${overviewTab === 'tags' ? ' active' : ''}`} onClick={() => setOverviewTab('tags')}>
                Tags
              </button>
            </div>
          </div>

          {overviewTab === 'revision' && (
            <div style={{ overflowY: 'auto', maxHeight: 180 }}>
              {dueForRev.length === 0
                ? <div style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12 }}>Nothing due — you&apos;re caught up.</div>
                : dueForRev.map((c, i) => (
                  <div key={c._dbId || i} className="learn-rev-row">
                    <div>
                      <div className="learn-rev-topic">{c.topic}</div>
                      <div className="learn-rev-sub">{c.lastReviewed ? `last reviewed ${c.lastReviewed}` : 'never reviewed'}</div>
                    </div>
                    <span className="learn-rev-cat" style={{ color: getTagColor(c.cat), borderColor: getTagColor(c.cat) }}>{c.cat}</span>
                  </div>
                ))}
            </div>
          )}

          {overviewTab === 'tags' && (
            <div className="learn-tagbreak" style={{ overflowY: 'auto', maxHeight: 180 }}>
              {tagBreakdown.length === 0
                ? <div style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12 }}>Log sessions to see tag breakdown.</div>
                : tagBreakdown.map(({ tag, hours }) => (
                  <div key={tag} className="learn-tagbreak-row">
                    <span className="learn-tagbreak-name" style={{ color: getTagColor(tag) }}>{tag}</span>
                    <div className="learn-tagbreak-track">
                      <div className="learn-tagbreak-fill" style={{ width: Math.round((hours / tagMaxHours) * 100) + '%', background: getTagColor(tag) }} />
                    </div>
                    <span className="learn-tagbreak-hrs">{hours}h</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly goal achieved banner ──────────────────────── */}
      {weekGoalPct >= 100 && (
        <div className="learn-goal-achieved">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M8 1.5l1.6 3.2 3.5.5-2.55 2.5.6 3.5L8 9.5l-3.15 1.7.6-3.5L3 5.2l3.5-.5z" fill="#4ade80" stroke="#4ade80" strokeWidth="0.8" strokeLinejoin="round" />
          </svg>
          <span><strong>Weekly goal reached!</strong> {weeklyHours}h logged this week — you&apos;re on a roll.</span>
        </div>
      )}

      {/* ── Search / Sort / Select toolbar ──────────────────── */}
      <div className="learn-toolbar">
        <div className="learn-search-wrap">
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            className="learn-search"
            placeholder="Search topics…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          {searchQ && (
            <button className="learn-search-clear" onClick={() => setSearchQ('')}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>

        <div ref={sortRef} className="learn-sort-wrap">
          <button className={`learn-sort-btn${sortOpen ? ' open' : ''}`} onClick={() => setSortOpen(o => !o)}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            {SORT_LABELS[sortBy]}
            <svg viewBox="0 0 16 16" fill="none" className="learn-sort-chev"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {sortOpen && (
            <div className="learn-sort-menu">
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <button key={k} className={`learn-sort-item${sortBy === k ? ' active' : ''}`}
                  onClick={() => { setSortBy(k); setSortOpen(false); }}>
                  {sortBy === k && <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className={`learn-select-btn${selectMode ? ' active' : ''}`}
          onClick={() => { selectMode ? exitSelectMode() : setSelectMode(true); }}
        >
          <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" /></svg>
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* ── Kanban columns ───────────────────────────────────── */}
      <div className="learn-cols">
        {LEARN_COLS.map(col => {
          const items = processItems(learning[col.key] || []);
          const total = (learning[col.key] || []).length;
          return (
            <div key={col.key} className="learn-col">
              <div className="learn-h">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="learn-h-dot" style={{ background: col.dot }} />
                  <span className="t">{col.label}</span>
                </div>
                <span className="learn-h-count">
                  {searchQ && items.length !== total ? `${items.length}/${total}` : total}
                </span>
              </div>
              <div className="learn-body">
                {items.map(it => (
                  <LearnCard
                    key={it._dbId}
                    item={it}
                    stage={col.key}
                    onEdit={(item) => handleEditOpen(item, col.key)}
                    onDelete={(item) => setDeleteTarget({ item, column: col.key })}
                    onMove={(item, toCol) => handleMove(item, col.key, toCol)}
                    onToggleRev={(item) => handleToggleRev(item, col.key)}
                    onLogHours={(item) => setLogHoursItem(item)}
                    onSessions={(item) => { setSessionsItem(item); setSessStage(col.key); }}
                    selectMode={selectMode}
                    isSelected={selected.has(it._dbId)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
                {items.length === 0 && (
                  <div className="learn-empty">{searchQ ? 'No matches' : 'Empty'}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bulk action bar ──────────────────────────────────── */}
      {selectMode && selected.size > 0 && (
        <div className="learn-bulk-bar">
          <span className="learn-bulk-count">{selected.size} selected</span>
          <span className="learn-bulk-sep" />
          <span className="learn-bulk-label">Move to</span>
          {LEARN_COLS.map(c => (
            <button key={c.key} className="learn-bulk-move" onClick={() => handleBulkMove(c.key)}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, display: 'inline-block' }} />
              {c.label}
            </button>
          ))}
          <button className="learn-bulk-cancel" onClick={exitSelectMode}>Cancel</button>
        </div>
      )}

      <TopicFormPanel open={showAdd} onClose={() => setShowAdd(false)} onSave={handleAdd} mode="add" allTags={allTags} />
      <TopicFormPanel open={!!editItem} onClose={() => setEditItem(null)} onSave={handleEditSave} mode="edit" initial={editItem?.item} allTags={allTags} />
      <LogHoursDialog item={logHoursItem} onSave={handleLogHoursSave} onClose={() => setLogHoursItem(null)} />
      <LearnDeleteDialog item={deleteTarget?.item} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
      <SessionsPanel
        item={sessionsItem}
        stage={sessionsStage}
        onClose={() => setSessionsItem(null)}
        onLogHours={(item) => setLogHoursItem(item)}
        onSessionDeleted={handleSessionDeleted}
      />
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

// ── Vault secret form panel (shared by Add + Edit) ────────────────
const SecretFormPanel = ({ open, onClose, onSave, initial, title, subtitle }) => {
  const empty = { name: '', cat: 'api', value: '' };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');
  const [show, setShow] = useStateA(false);
  const [saving, setSaving] = useStateA(false);

  useEffectA(() => {
    if (open) { setForm(initial || empty); setErr(''); setShow(false); }
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('Secret name is required.'); return; }
    if (!form.value.trim()) { setErr('Secret value is required.'); return; }
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim(), value: form.value.trim() });
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to save secret.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="vault-notice">
          <Icon name="lock" size={12} />
          <span>Value encrypted AES-256-GCM before saving — never stored in plain text.</span>
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
          <div className="fld-pw">
            <input
              type={show ? 'text' : 'password'}
              value={form.value}
              onChange={e => set('value', e.target.value)}
              placeholder="sk-proj-…"
            />
            <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)}>
              <Icon name={show ? 'eye-off' : 'eye'} size={14} />
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

// ── Vault locked / setup screens ──────────────────────────────────
const VaultLockScreen = ({ hasConfig, onUnlock, onSetup, onReset }) => {
  const [pw, setPw] = useStateA('');
  const [pw2, setPw2] = useStateA('');
  const [err, setErr] = useStateA('');
  const [busy, setBusy] = useStateA(false);
  const [showPw, setShowPw] = useStateA(false);
  const [showPw2, setShowPw2] = useStateA(false);

  // Reset state
  const [showReset, setShowReset] = useStateA(false);
  const [resetConfirm, setResetConfirm] = useStateA('');
  const [resetErr, setResetErr] = useStateA('');
  const [resetBusy, setResetBusy] = useStateA(false);

  const handleUnlock = async () => {
    if (!pw) { setErr('Enter your master password.'); return; }
    setBusy(true); setErr('');
    try { await onUnlock(pw); }
    catch (e) { setErr(e.message || 'Incorrect password.'); }
    finally { setBusy(false); }
  };

  const handleSetup = async () => {
    if (pw.length < 8) { setErr('Master password must be at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr('');
    try { await onSetup(pw); }
    catch (e) { setErr(e.message || 'Failed to set up vault.'); }
    finally { setBusy(false); }
  };

  const handleReset = async () => {
    if (resetConfirm !== 'DELETE') { setResetErr('Type DELETE (all caps) to confirm.'); return; }
    setResetBusy(true); setResetErr('');
    try { await onReset(); }
    catch (e) { setResetErr(e.message || 'Reset failed.'); }
    finally { setResetBusy(false); }
  };

  const handleKey = (fn) => (e) => { if (e.key === 'Enter') fn(); };

  const isSetup = !hasConfig;

  const getPwStrength = (password) => {
    if (!password) return 0;
    if (password.length < 8) return 1;
    let s = 1;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  };

  const strengthScore = getPwStrength(pw);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">PERSONAL / VAULT</div>
          <h1>Vault</h1>
          <div className="sub">{isSetup ? 'Set up your vault — first time only' : 'Vault is locked'}</div>
        </div>
      </div>
      <div className="vault-lock-container">
        <div className="vault-lock-card">
          <div className="vault-lock-header">
            <div className="vault-lock-badge">
              <Icon name="lock" size={24} />
            </div>
            <h2 className="vault-lock-title">
              {isSetup ? 'Create Master Password' : 'Unlock Vault'}
            </h2>
            <p className="vault-lock-sub">
              {isSetup
                ? 'This password encrypts all your secrets. If you lose it, secrets cannot be recovered.'
                : 'Enter your master password to access secrets.'}
            </p>
          </div>

          {err && (
            <div className="vault-error-banner" role="alert">
              <Icon name="alert-circle" size={14} />
              <span>{err}</span>
            </div>
          )}

          <div className="vault-lock-form">
            <div className="vault-field-group">
              <label>{isSetup ? 'Master password' : 'Password'}</label>
              <div className="vault-input-wrapper">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={e => { setPw(e.target.value); setErr(''); }}
                  onKeyDown={handleKey(isSetup ? handleSetup : handleUnlock)}
                  placeholder={isSetup ? 'Min. 8 characters' : '••••••••'}
                  autoFocus
                  disabled={busy}
                />
                <button
                  type="button"
                  className="vault-pw-toggle"
                  onClick={() => setShowPw(s => !s)}
                  title={showPw ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPw ? 'eye-off' : 'eye'} size={14} />
                </button>
              </div>

              {isSetup && pw.length > 0 && (
                <div className="vault-strength">
                  <div className="vault-strength-bars">
                    {[1, 2, 3, 4].map(idx => (
                      <div
                        key={idx}
                        className="vault-strength-bar"
                        style={{ background: idx <= strengthScore ? strengthColors[strengthScore] : undefined }}
                      />
                    ))}
                  </div>
                  <span className="vault-strength-text" style={{ color: strengthColors[strengthScore] }}>
                    Password strength: {strengthLabels[strengthScore]}
                  </span>
                </div>
              )}
            </div>

            {isSetup && (
              <div className="vault-field-group">
                <label>Confirm password</label>
                <div className="vault-input-wrapper">
                  <input
                    type={showPw2 ? 'text' : 'password'}
                    value={pw2}
                    onChange={e => { setPw2(e.target.value); setErr(''); }}
                    onKeyDown={handleKey(handleSetup)}
                    placeholder="Repeat password"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="vault-pw-toggle"
                    onClick={() => setShowPw2(s => !s)}
                    title={showPw2 ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPw2 ? 'eye-off' : 'eye'} size={14} />
                  </button>
                </div>
              </div>
            )}

            <button
              className="vault-submit-btn"
              onClick={isSetup ? handleSetup : handleUnlock}
              disabled={busy || (isSetup && (!pw || !pw2))}
            >
              <Icon name="lock" size={13} />
              {busy ? (isSetup ? 'Setting up…' : 'Unlocking…') : (isSetup ? 'Create vault' : 'Unlock')}
            </button>

            {/* Forgot password — only on locked state, not setup */}
            {!isSetup && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                {!showReset ? (
                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'var(--f-mono)' }}
                  >
                    Forgot password? Reset vault →
                  </button>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>
                      Reset vault — IRREVERSIBLE
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>
                      This permanently deletes <strong style={{ color: 'var(--text-2)' }}>all encrypted secrets</strong> and your master password. They cannot be recovered. Type <code style={{ color: '#ef4444' }}>DELETE</code> to confirm.
                    </div>
                    {resetErr && (
                      <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{resetErr}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={resetConfirm}
                        onChange={e => { setResetConfirm(e.target.value); setResetErr(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleReset(); }}
                        placeholder="Type DELETE"
                        style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid #ef4444', padding: '6px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'var(--f-mono)' }}
                        disabled={resetBusy}
                      />
                      <button
                        className="btn"
                        style={{ background: '#ef4444', color: '#fff', border: 'none', fontSize: 11 }}
                        onClick={handleReset}
                        disabled={resetBusy || resetConfirm !== 'DELETE'}
                      >
                        {resetBusy ? 'Resetting…' : 'Reset'}
                      </button>
                      <button
                        className="btn ghost"
                        style={{ fontSize: 11 }}
                        onClick={() => { setShowReset(false); setResetConfirm(''); setResetErr(''); }}
                        disabled={resetBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Change password dialog ─────────────────────────────────────────
const ChangePasswordDialog = ({ open, onClose, onSave }) => {
  const [currentPw, setCurrentPw] = useStateA('');
  const [newPw, setNewPw] = useStateA('');
  const [confirmPw, setConfirmPw] = useStateA('');
  const [err, setErr] = useStateA('');
  const [busy, setBusy] = useStateA(false);
  const [showCurrent, setShowCurrent] = useStateA(false);
  const [showNew, setShowNew] = useStateA(false);
  const [showConfirm, setShowConfirm] = useStateA(false);

  useEffectA(() => {
    if (open) { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setErr(''); }
  }, [open]);

  const getPwStrength = (p) => {
    if (!p) return 0;
    if (p.length < 8) return 1;
    let s = 1;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  };
  const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const score = getPwStrength(newPw);

  const handleSave = async () => {
    if (!currentPw) { setErr('Enter your current password.'); return; }
    if (newPw.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setErr('New passwords do not match.'); return; }
    if (newPw === currentPw) { setErr('New password must differ from current password.'); return; }
    setBusy(true); setErr('');
    try { await onSave(currentPw, newPw); onClose(); }
    catch (e) { setErr(e.message || 'Failed to change password.'); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        padding: 28,
        width: 380
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Change Master Password</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
          All secrets will be re-encrypted with the new password.
        </div>
        {err && (
          <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', marginBottom: 14 }}>
            {err}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="fld">
            <label>Current password</label>
            <div className="fld-pw">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setErr(''); }}
                placeholder="••••••••"
                disabled={busy}
                autoFocus
              />
              <button type="button" className="pw-toggle" onClick={() => setShowCurrent(s => !s)}>
                <Icon name={showCurrent ? 'eye-off' : 'eye'} size={13} />
              </button>
            </div>
          </div>
          <div className="fld">
            <label>New password</label>
            <div className="fld-pw">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setErr(''); }}
                placeholder="Min. 8 characters"
                disabled={busy}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowNew(s => !s)}>
                <Icon name={showNew ? 'eye-off' : 'eye'} size={13} />
              </button>
            </div>
            {newPw.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? strengthColors[score] : 'var(--border-2)' }} />
                  ))}
                </div>
                <span style={{ fontSize: 10, color: strengthColors[score], fontFamily: 'var(--f-mono)' }}>
                  {strengthLabels[score]}
                </span>
              </div>
            )}
          </div>
          <div className="fld">
            <label>Confirm new password</label>
            <div className="fld-pw">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setErr(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="Repeat new password"
                disabled={busy}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowConfirm(s => !s)}>
                <Icon name={showConfirm ? 'eye-off' : 'eye'} size={13} />
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={busy || !currentPw || newPw.length < 8 || newPw !== confirmPw}>
            <Icon name="lock" size={12} /> {busy ? 'Re-encrypting…' : 'Change password'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Delete confirmation dialog ────────────────────────────────────
const DeleteConfirmDialog = ({ item, onConfirm, onCancel }) => {
  if (!item) return null;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        padding: 28,
        width: 340
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Delete secret?</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
          <strong>{item.name}</strong> will be permanently deleted. This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const VaultPage = ({ vault, setVault, workstationId, myRole = 'viewer', wsPermissions = {} }) => {
  const canManage = canDo(myRole, 'manage_vault', wsPermissions);
  const NO_PERM = "You don't have permission";
  const [vaultState, setVaultState] = useStateA('loading'); // loading | setup | locked | unlocked
  const [cat, setCat] = useStateA('all');
  const [revealed, setRevealed] = useStateA({});
  const [decrypted, setDecrypted] = useStateA({});
  const [q, setQ] = useStateA('');
  const [showAdd, setShowAdd] = useStateA(false);
  const [editItem, setEditItem] = useStateA(null);
  const [deleteItem, setDeleteItem] = useStateA(null);
  const [fingerprint, setFingerprint] = useStateA(null);
  const [unlockedAt, setUnlockedAt] = useStateA(null);
  const [importErr, setImportErr] = useStateA('');
  const [showChangePw, setShowChangePw] = useStateA(false);
  const importRef = useRefA(null);
  const autoLockTimer = useRefA(null);
  const vaultStateRef = useRefA(null);
  vaultStateRef.current = vaultState;

  // On mount, check if vault already unlocked this session or needs config
  useEffectA(() => {
    if (isVaultUnlocked()) {
      setFingerprint(getSessionFingerprint());
      setVaultState('unlocked');
      return;
    }
    getVaultConfig(workstationId)
      .then(cfg => setVaultState(cfg ? 'locked' : 'setup'))
      .catch(() => setVaultState('setup'));
  }, [workstationId]);

  // Auto-lock on inactivity — only active while unlocked
  useEffectA(() => {
    if (vaultState !== 'unlocked') {
      clearTimeout(autoLockTimer.current);
      return;
    }

    const reset = () => {
      clearTimeout(autoLockTimer.current);
      autoLockTimer.current = setTimeout(() => {
        if (vaultStateRef.current === 'unlocked') {
          clearSessionKey();
          setRevealed({});
          setDecrypted({});
          setFingerprint(null);
          setVaultState('locked');
        }
      }, VAULT_AUTO_LOCK_MS);
    };

    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start the initial timer

    return () => {
      clearTimeout(autoLockTimer.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [vaultState]);

  const handleSetup = async (password) => {
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    const verifier = await createVerifier(key);
    await saveVaultConfig(workstationId, salt, verifier);
    await setSessionKey(key);
    setFingerprint(getSessionFingerprint());
    setUnlockedAt(new Date());
    setVaultState('unlocked');
  };

  const handleUnlock = async (password) => {
    const cfg = await getVaultConfig(workstationId);
    if (!cfg) throw new Error('No vault config found.');
    const key = await deriveKey(password, cfg.salt);
    const ok = await verifyKey(cfg.verifier, key);
    if (!ok) throw new Error('Incorrect password.');
    await setSessionKey(key);
    setFingerprint(getSessionFingerprint());
    setUnlockedAt(new Date());
    setVaultState('unlocked');
  };

  const handleLock = () => {
    clearSessionKey();
    setRevealed({});
    setDecrypted({});
    setFingerprint(null);
    setVaultState('locked');
  };

  const handleReset = async () => {
    await resetVault(workstationId);
    setVault([]);
    clearSessionKey();
    setFingerprint(null);
    setVaultState('setup');
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    const cfg = await getVaultConfig(workstationId);
    if (!cfg) throw new Error('Vault config not found.');
    const oldKey = await deriveKey(currentPassword, cfg.salt);
    const ok = await verifyKey(cfg.verifier, oldKey);
    if (!ok) throw new Error('Current password is incorrect.');

    // Re-encrypt all items with the new key
    const newSalt = generateSalt();
    const newKey = await deriveKey(newPassword, newSalt);
    const newVerifier = await createVerifier(newKey);

    const updated = await Promise.all(vault.map(async (v) => {
      let plain = v.value;
      try { if (v.isEncrypted) plain = await decryptValue(v.value, oldKey); } catch { /* keep as-is */ }
      const encrypted = await encryptValue(plain, newKey);
      return updateVaultItem({ id: v.id, cat: v.cat, name: v.name, value: encrypted, isEncrypted: true });
    }));

    await saveVaultConfig(workstationId, newSalt, newVerifier);
    await setSessionKey(newKey);
    setVault(updated);
    setFingerprint(getSessionFingerprint());
    setRevealed({});
    setDecrypted({});
  };

  const handleReveal = async (item) => {
    const key = getSessionKey();
    if (!key) return;
    if (revealed[item.id]) {
      setRevealed(r => { const n = { ...r }; delete n[item.id]; return n; });
      return;
    }
    try {
      const plain = item.isEncrypted ? await decryptValue(item.value, key) : item.value;
      setDecrypted(d => ({ ...d, [item.id]: plain }));
      setRevealed(r => ({ ...r, [item.id]: true }));
    } catch {
      setRevealed(r => ({ ...r, [item.id]: true }));
    }
  };

  const handleCopy = async (item) => {
    const key = getSessionKey();
    if (!key) return;
    try {
      const plain = item.isEncrypted ? await decryptValue(item.value, key) : item.value;
      await navigator.clipboard?.writeText(plain);
    } catch {
      navigator.clipboard?.writeText(item.value);
    }
  };

  const handleAdd = async (form) => {
    const key = getSessionKey();
    const encrypted = key ? await encryptValue(form.value, key) : form.value;
    const saved = await createVaultItem(
      { cat: form.cat, name: form.name, value: encrypted, isEncrypted: !!key },
      workstationId
    );
    setVault(prev => [saved, ...prev]);
  };

  const handleEdit = async (form) => {
    const key = getSessionKey();
    const encrypted = key ? await encryptValue(form.value, key) : form.value;
    const updated = await updateVaultItem({
      id: editItem.id,
      cat: form.cat,
      name: form.name,
      value: encrypted,
      isEncrypted: !!key,
    });
    setVault(prev => prev.map(v => v.id === updated.id ? updated : v));
    setRevealed(r => { const n = { ...r }; delete n[editItem.id]; return n; });
    setDecrypted(d => { const n = { ...d }; delete n[editItem.id]; return n; });
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteVaultItem(deleteItem.id);
    setVault(prev => prev.filter(v => v.id !== deleteItem.id));
    setDeleteItem(null);
  };

  const handleExport = async () => {
    const key = getSessionKey();
    if (!key) return;
    const items = await Promise.all(vault.map(async v => {
      let plain;
      try { plain = v.isEncrypted ? await decryptValue(v.value, key) : v.value; }
      catch { plain = '[decrypt error]'; }
      return { cat: v.cat, name: v.name, value: plain, updated: v.updated };
    }));
    const json = JSON.stringify({ version: 1, exported: new Date().toISOString(), items }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orbit-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErr('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = parsed.items || (Array.isArray(parsed) ? parsed : null);
      if (!items?.length) { setImportErr('No items found in file.'); return; }
      const key = getSessionKey();
      let added = 0;
      for (const it of items) {
        if (!it.name || !it.value) continue;
        const encrypted = key ? await encryptValue(it.value, key) : it.value;
        const saved = await createVaultItem(
          { cat: it.cat || 'other', name: it.name, value: encrypted, isEncrypted: !!key },
          workstationId
        );
        setVault(prev => [saved, ...prev]);
        added++;
      }
      if (added === 0) setImportErr('No valid items to import.');
    } catch (e) {
      setImportErr('Failed to import: ' + (e.message || 'Invalid file.'));
    } finally {
      e.target.value = '';
    }
  };

  const getEditInitial = async (item) => {
    if (!item) return null;
    const key = getSessionKey();
    let value = item.value;
    try { if (item.isEncrypted && key) value = await decryptValue(item.value, key); }
    catch { /* keep ciphertext */ }
    return { name: item.name, cat: item.cat, value };
  };

  const [editInitial, setEditInitial] = useStateA(null);

  const openEdit = async (item) => {
    const initial = await getEditInitial(item);
    setEditInitial(initial);
    setEditItem(item);
  };

  const items = vault.filter(v =>
    (cat === 'all' || v.cat === cat) &&
    (!q || v.name.toLowerCase().includes(q.toLowerCase()))
  );

  const unlockedTime = unlockedAt
    ? unlockedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (vaultState === 'loading') {
    return <div className="page page-wide"><div style={{ padding: 40, color: 'var(--text-3)', fontSize: 12 }}>Loading vault…</div></div>;
  }

  if (vaultState === 'setup' || vaultState === 'locked') {
    return (
      <VaultLockScreen
        hasConfig={vaultState === 'locked'}
        onUnlock={handleUnlock}
        onSetup={handleSetup}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">PERSONAL / VAULT</div>
          <h1>Vault</h1>
          <div className="sub">
            {vault.length} secrets · AES-256-GCM{unlockedTime ? ` · unlocked ${unlockedTime}` : ''}
          </div>
        </div>
        <div className="actions">
          {importErr && <span style={{ fontSize: 11, color: '#ef4444' }}>{importErr}</span>}
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn" onClick={() => importRef.current?.click()}><Icon name="upload" size={12} /> Import</button>
          <button className="btn" onClick={handleExport}><Icon name="download" size={12} /> Export</button>
          <button className="btn ghost" onClick={() => setShowChangePw(true)}><Icon name="key" size={12} /> Change password</button>
          <button className="btn ghost" onClick={handleLock}><Icon name="lock" size={12} /> Lock</button>
          <button className={'btn primary' + (canManage ? '' : ' perm-denied')} onClick={() => setShowAdd(true)} disabled={!canManage} title={canManage ? 'New secret' : NO_PERM}>
            <Icon name="plus" size={12} /> New secret
          </button>
        </div>
      </div>

      <div className="vault-warning">
        <Icon name="lock" size={12} />
        Values are encrypted AES-256-GCM with your master password before reaching the database.
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
            <div style={{ color: 'var(--text-2)', marginTop: 4, wordBreak: 'break-all' }}>
              {fingerprint || '—'}
            </div>
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
            const plainVal = decrypted[v.id];
            return (
              <div key={v.id} className="vault-row">
                <span style={{ color: 'var(--text-3)' }}><Icon name={catIcon(v.cat)} size={14} /></span>
                <span className="name">{v.name}</span>
                <span className={'val' + (isRev ? ' revealed' : '')}>
                  {isRev ? (plainVal ?? v.value) : '••••••••••••••••••••••'}
                </span>
                <span className="date">{v.updated ? new Date(v.updated).toLocaleDateString() : '—'}</span>
                <span className="acts">
                  <button className="iconbtn" onClick={() => handleReveal(v)} title={isRev ? 'Hide' : 'Reveal'}>
                    <Icon name="eye" size={13} />
                  </button>
                  <button className="iconbtn" title="Copy" onClick={() => handleCopy(v)}>
                    <Icon name="copy" size={13} />
                  </button>
                  {canManage && (
                    <>
                      <button className="iconbtn" title="Edit" onClick={() => openEdit(v)}>
                        <Icon name="edit" size={13} />
                      </button>
                      <button className="iconbtn" title="Delete" onClick={() => setDeleteItem(v)}
                        style={{ color: '#ef4444' }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              No secrets match.
            </div>
          )}
        </div>
      </div>

      <SecretFormPanel
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleAdd}
        title="New Secret"
        subtitle="PERSONAL / VAULT / ADD"
      />
      <SecretFormPanel
        open={!!editItem}
        onClose={() => { setEditItem(null); setEditInitial(null); }}
        onSave={handleEdit}
        initial={editInitial}
        title="Edit Secret"
        subtitle="PERSONAL / VAULT / EDIT"
      />
      <DeleteConfirmDialog
        item={deleteItem}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
      <ChangePasswordDialog
        open={showChangePw}
        onClose={() => setShowChangePw(false)}
        onSave={handleChangePassword}
      />
    </div>
  );
};

// analytics.jsx — Fully functional Analytics Dashboard

import { useState, useMemo } from 'react';
import { Icon } from '../components/shell.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area,
} from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────
const parseBudget = (b) => {
  if (!b || b === '—') return 0;
  return parseInt(b.replace(/[€$£\s,]/g, '')) || 0;
};

const fmtK = (n) => {
  if (!n) return '€0';
  return n >= 1000 ? `€${(n / 1000).toFixed(1)}K` : `€${n}`;
};

const fmtHrs = (h) => {
  const n = Number(h) || 0;
  if (n < 0.017) return '0m';
  const totalMins = Math.round(n * 60);
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
};

const todayStr = () => new Date().toISOString().split('T')[0];

const dateInRange = (dateStr, start, end) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
};

// Build start-of-period Date for given period key
const getPeriodStart = (period) => {
  const now = new Date();
  const s = new Date(now);
  s.setHours(0, 0, 0, 0);
  if (period === 'week') {
    s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Mon
  } else if (period === 'month') {
    s.setDate(1);
  } else if (period === 'quarter') {
    s.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
  } else {
    s.setMonth(0, 1);
  }
  return s;
};

const PROJ_STATUS_COLOR = {
  done: '#25d366', progress: '#0099ff', review: '#ff9500',
  planning: '#6a6a78', hold: '#ff3d3d', active: '#0099ff',
};

// ─── Sparkline ────────────────────────────────────────────────────
const Sparkline = ({ data, color = 'var(--accent)', h = 26 }) => {
  if (!data || data.length < 2) return <div style={{ height: h }} />;
  const vals = data.map(Number);
  const max = Math.max(...vals, 0.001);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const pts = vals.map((v, i) =>
    `${(i / (vals.length - 1)) * 100},${h - 1 - ((v - min) / range) * (h - 2)}`
  ).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 100 ${h}`}
      preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Horizontal segmented bar ─────────────────────────────────────
const SegBar = ({ segments }) => {
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  return (
    <div className="an-seg-bar">
      {segments.map(s => s.count > 0 && (
        <div key={s.label} className="an-seg-piece"
          style={{ background: s.color, width: `${(s.count / total) * 100}%` }}
          title={`${s.label}: ${s.count}`}
        />
      ))}
    </div>
  );
};

// ─── Empty state ─────────────────────────────────────────────────
const EmptyState = ({ icon, title, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', gap: 10, textAlign: 'center' }}>
    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
      <Icon name={icon} size={16} />
    </div>
    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{title}</div>
    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)', lineHeight: 1.6, maxWidth: 220 }}>{desc}</div>
  </div>
);

// ─── Custom X-axis tick with optional week label below ────────────
const CustomXTick = ({ x, y, payload, index, showWeek }) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={9} fontFamily="var(--f-mono)" fill="var(--text-3)">
      {payload.value}
    </text>
    {showWeek && (
      <text x={0} y={0} dy={24} textAnchor="middle" fontSize={8} fontFamily="var(--f-mono)" fill="var(--text-3)" opacity={0.55}>
        W{index + 1}
      </text>
    )}
  </g>
);

// ─── Custom bar tooltip ───────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text)' }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--accent-hi)' }}>{fmtHrs(payload[0].value)}</div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────
export const Analytics = ({
  projects = [],
  tasks = [],
  statuses = [],
  timeEntries = [],
  learningActivity = [],
}) => {
  const [period, setPeriod] = useState('month');

  const now = new Date();
  const today = todayStr();
  const in7 = new Date(now); in7.setDate(now.getDate() + 7);
  const in7s = in7.toISOString().split('T')[0];

  // ── Period window ────────────────────────────────────────────────
  const periodStart = useMemo(() => getPeriodStart(period), [period]);
  const periodEnd = now;

  // ── Filtered entries in the period ────────────────────────────────
  const periodEntries = useMemo(() =>
    timeEntries.filter(e => e.status === 'completed' && dateInRange(e.endedAt, periodStart, periodEnd)),
    [timeEntries, periodStart, periodEnd]
  );

  // ── Statuses lookup ───────────────────────────────────────────────
  const doneStatusId = useMemo(() => statuses.find(s => s.isDone)?.id, [statuses]);
  const parentTasks = useMemo(() => tasks.filter(t => !t.parentId), [tasks]);

  // ── KPI — Task Completion ─────────────────────────────────────────
  const totalPT = parentTasks.length || 1;
  const doneTasks = parentTasks.filter(t => doneStatusId && t.col === doneStatusId).length;
  const donePct = Math.round((doneTasks / totalPT) * 100);

  // ── KPI — Hours in period ─────────────────────────────────────────
  const periodSecs = periodEntries.reduce((s, e) => s + (e.totalSeconds || 0), 0);
  const periodHours = +(periodSecs / 3600).toFixed(2);
  const allHours = projects.reduce((s, p) => s + (p.hoursLogged || 0), 0);

  // ── KPI — Projects ────────────────────────────────────────────────
  const activeProjs = projects.filter(p => p.status === 'progress' || p.status === 'active').length;

  // ── KPI — Budget ─────────────────────────────────────────────────
  const earnedBudget = projects.filter(p => p.status === 'done').reduce((s, p) => s + parseBudget(p.budget), 0);
  const pipelineBudget = projects.filter(p => p.status !== 'done' && p.status !== 'hold').reduce((s, p) => s + parseBudget(p.budget), 0);
  const totalBudget = earnedBudget + pipelineBudget;

  // ── KPI — Overdue / Due soon ─────────────────────────────────────
  const notDone = parentTasks.filter(t => !doneStatusId || t.col !== doneStatusId);
  const overdueCt = notDone.filter(t => t.due && t.due !== '—' && t.due < today).length;
  const dueSoonCt = notDone.filter(t => t.due && t.due !== '—' && t.due >= today && t.due <= in7s).length;

  // ── Sparklines (last 12 weeks of hours) ──────────────────────────
  const weeklySpark = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const wEnd = new Date(now); wEnd.setDate(now.getDate() - (11 - i) * 7); wEnd.setHours(23, 59, 59);
    const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6); wStart.setHours(0, 0, 0);
    return timeEntries
      .filter(e => e.status === 'completed' && dateInRange(e.endedAt, wStart, wEnd))
      .reduce((s, e) => s + (e.totalSeconds || 0), 0) / 3600;
  }), [timeEntries]);

  // ── Activity Chart data ───────────────────────────────────────────
  const activityData = useMemo(() => {
    const entryHoursInRange = (start, end) =>
      timeEntries
        .filter(e => e.status === 'completed' && dateInRange(e.endedAt, start, end))
        .reduce((s, e) => s + (e.totalSeconds || 0), 0) / 3600;

    if (period === 'week') {
      const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      const wkStart = new Date(periodStart);
      return DAYS.map((day, i) => {
        const s = new Date(wkStart); s.setDate(wkStart.getDate() + i); s.setHours(0, 0, 0, 0);
        const e = new Date(s); e.setHours(23, 59, 59, 999);
        return { label: day, hours: +entryHoursInRange(s, e).toFixed(2) };
      });
    }

    if (period === 'month') {
      return Array.from({ length: 4 }, (_, i) => {
        const wEnd = new Date(now); wEnd.setDate(now.getDate() - (3 - i) * 7); wEnd.setHours(23, 59, 59);
        const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6); wStart.setHours(0, 0, 0);
        const label = wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { label, hours: +entryHoursInRange(wStart, wEnd).toFixed(2) };
      });
    }

    if (period === 'quarter') {
      return Array.from({ length: 13 }, (_, i) => {
        const wEnd = new Date(now); wEnd.setDate(now.getDate() - (12 - i) * 7); wEnd.setHours(23, 59, 59);
        const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6); wStart.setHours(0, 0, 0);
        return { label: wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), hours: +entryHoursInRange(wStart, wEnd).toFixed(2) };
      });
    }

    // year — 12 months
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const s = new Date(d.getFullYear(), d.getMonth(), 1); s.setHours(0, 0, 0, 0);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); e.setHours(23, 59, 59);
      return { label: d.toLocaleDateString('en-US', { month: 'short' }), hours: +entryHoursInRange(s, e).toFixed(2) };
    });
  }, [timeEntries, period, periodStart]);

  // ── Learning chart data — mirrors activityData pattern ───────────
  const learningChartData = useMemo(() => {
    const dayHrs = (d) => {
      const iso = new Date(d).toISOString().split('T')[0];
      return Number(learningActivity.find(r => r.date === iso)?.hours) || 0;
    };

    if (period === 'week') {
      const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      return DAYS.map((day, i) => {
        const d = new Date(periodStart); d.setDate(periodStart.getDate() + i);
        return { label: day, hours: +dayHrs(d).toFixed(2) };
      });
    }

    if (period === 'month') {
      return Array.from({ length: 4 }, (_, i) => {
        const wEnd = new Date(now); wEnd.setDate(now.getDate() - (3 - i) * 7); wEnd.setHours(23, 59, 59);
        const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6); wStart.setHours(0, 0, 0);
        const label = wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        let total = 0;
        for (let d = new Date(wStart); d <= wEnd; d.setDate(d.getDate() + 1)) total += dayHrs(d);
        return { label, hours: +total.toFixed(2) };
      });
    }

    if (period === 'quarter') {
      return Array.from({ length: 13 }, (_, i) => {
        const wEnd = new Date(now); wEnd.setDate(now.getDate() - (12 - i) * 7); wEnd.setHours(23, 59, 59);
        const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6); wStart.setHours(0, 0, 0);
        let total = 0;
        for (let d = new Date(wStart); d <= wEnd; d.setDate(d.getDate() + 1)) total += dayHrs(d);
        return { label: wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), hours: +total.toFixed(2) };
      });
    }

    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      let total = 0;
      for (let day = new Date(s); day <= e; day.setDate(day.getDate() + 1)) total += dayHrs(day);
      return { label: d.toLocaleDateString('en-US', { month: 'short' }), hours: +total.toFixed(2) };
    });
  }, [learningActivity, period, periodStart, now]);

  const learnTotal = learningChartData.reduce((s, d) => s + d.hours, 0);
  const hasLearnData = learningChartData.some(d => d.hours > 0);

  // ── Task status distribution ──────────────────────────────────────
  const taskStatusDist = useMemo(() => statuses
    .map(s => ({
      id: s.id, label: s.label,
      color: s.color || (s.isDone ? '#25d366' : 'var(--accent)'),
      count: parentTasks.filter(t => t.col === s.id).length,
    }))
    .filter(s => s.count > 0),
    [statuses, parentTasks]
  );

  // ── Project status distribution ───────────────────────────────────
  const projStatusDist = useMemo(() => {
    const groups = {};
    projects.forEach(p => { groups[p.status] = (groups[p.status] || 0) + 1; });
    return Object.entries(groups)
      .map(([st, count]) => ({ label: st.charAt(0).toUpperCase() + st.slice(1), status: st, color: PROJ_STATUS_COLOR[st] || 'var(--text-3)', count }))
      .sort((a, b) => b.count - a.count);
  }, [projects]);

  // ── Top projects by hours this period ─────────────────────────────
  const topProjects = useMemo(() => {
    const map = {};
    periodEntries.forEach(e => {
      if (!e.projectShort) return;
      map[e.projectShort] = (map[e.projectShort] || 0) + (e.totalSeconds || 0);
    });
    return Object.entries(map)
      .map(([short, secs]) => ({ short, hours: +(secs / 3600).toFixed(2) }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
  }, [periodEntries]);

  // ── Per-project progress (sorted by hours desc) ───────────────────
  const projProgress = useMemo(() => projects
    .filter(p => p.status !== 'hold')
    .map(p => {
      const pt = parentTasks.filter(t => t.proj === p.id);
      const done = pt.filter(t => doneStatusId && t.col === doneStatusId).length;
      const hrPct = p.hoursEst > 0 ? Math.min(120, Math.round((p.hoursLogged / p.hoursEst) * 100)) : null;
      const tPct = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
      return { ...p, hrPct, tPct, taskCount: pt.length, doneCount: done };
    })
    .sort((a, b) => (b.hoursLogged || 0) - (a.hoursLogged || 0)),
    [projects, parentTasks, doneStatusId]
  );

  // ── Revenue pipeline ──────────────────────────────────────────────
  const maxBudget = totalBudget || 1;
  const pipeRows = [
    { label: 'Earned', amount: earnedBudget, fill: 'linear-gradient(90deg,#25d366,#4ade80)' },
    { label: 'In Pipeline', amount: pipelineBudget, fill: 'linear-gradient(90deg,#ff9500,#fbbf24)' },
    { label: 'Total', amount: totalBudget, fill: 'linear-gradient(90deg,var(--accent),var(--accent-hi))' },
  ];

  // ── KPI cards ─────────────────────────────────────────────────────
  const PERIOD_LABEL = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year' };
  const kpis = [
    { label: 'Task Completion', value: `${donePct}%`, unit: `${doneTasks} / ${parentTasks.length} tasks`, color: donePct >= 50 ? '#25d366' : '#ff9500', spark: weeklySpark.map(h => Math.min(100, Math.round((h / 8) * 100))) },
    { label: 'Hours Logged', value: fmtHrs(periodHours), unit: `${fmtHrs(allHours)} all time`, color: 'var(--accent-hi)', spark: weeklySpark },
    { label: 'Active Projects', value: activeProjs, unit: `of ${projects.length} total`, color: '#0099ff', spark: Array(12).fill(activeProjs) },
    { label: 'Budget Earned', value: fmtK(earnedBudget), unit: `${fmtK(totalBudget)} total`, color: '#25d366', spark: Array(12).fill(0).map((_, i) => i < 11 ? earnedBudget * (i / 11) : earnedBudget) },
    { label: 'Overdue Tasks', value: overdueCt, unit: `${dueSoonCt} due in 7d`, color: overdueCt > 0 ? '#ff3d3d' : '#25d366', spark: Array(12).fill(0).map((_, i) => i === 11 ? overdueCt : 0) },
  ];

  const hasEntries = timeEntries.length > 0;
  const hasPeriodData = activityData.some(d => d.hours > 0);

  return (
    <div className="page-wide">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <div className="crumb">INSIGHTS &amp; ANALYTICS</div>
          <h1>Performance</h1>
          <div className="sub">Real metrics from your workspace · {PERIOD_LABEL[period]}</div>
        </div>
        <div className="actions" style={{ alignItems: 'center', gap: 10 }}>
          <select className="period-select" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div className="an-kpi-strip">
        {kpis.map(kpi => (
          <div key={kpi.label} className="an-kpi-cell">
            <div className="an-kpi-label">{kpi.label}</div>
            <div className="an-kpi-val" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="an-kpi-unit">{kpi.unit}</div>
            <div className="an-kpi-spark">
              <Sparkline data={kpi.spark} color={kpi.color} h={24} />
            </div>
          </div>
        ))}
      </div>

      {/* ── 2-col grid ─────────────────────────────────────────── */}
      <div className="an-two-col">

        {/* ── Left column ─────────────────────────────────────── */}
        <div className="an-col">

          {/* Hours tracked bar chart */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Hours Tracked — {PERIOD_LABEL[period]}</div>
                <div className="an-card-sub">Time logged per {period === 'week' ? 'day' : period === 'year' ? 'month' : 'week'}</div>
              </div>
              {hasPeriodData && (
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--accent-hi)', fontWeight: 700 }}>
                  {fmtHrs(periodHours)}
                </span>
              )}
            </div>
            <div className="an-card-body">
              {!hasPeriodData ? (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                  <Icon name="timer" size={13} />
                  <span>{hasEntries ? 'No entries this period — try a wider range.' : 'No time entries yet — start a timer session.'}</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={activityData} margin={{ top: 4, right: 8, left: -20, bottom: (period === 'month' || period === 'quarter') ? 10 : 0 }}>
                    <defs>
                      <linearGradient id="hoursLineFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={<CustomXTick showWeek={period === 'month' || period === 'quarter'} />} tickLine={false} axisLine={false} interval={period === 'quarter' ? 2 : 0} />
                    <YAxis tick={{ fontSize: 9, fontFamily: 'var(--f-mono)', fill: 'var(--text-3)' }} tickLine={false} axisLine={false} tickFormatter={(v) => v === 0 ? '0' : `${v}h`} />
                    <Tooltip content={<BarTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      fill="url(#hoursLineFill)"
                      dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: 'var(--accent-hi)', stroke: 'var(--bg-1)', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Learning hours — this week */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Learning Hours — {PERIOD_LABEL[period]}</div>
                <div className="an-card-sub">Study time per {period === 'week' ? 'day' : period === 'year' ? 'month' : 'week'}</div>
              </div>
              {hasLearnData && (
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: '#4ade80', fontWeight: 700 }}>
                  {fmtHrs(learnTotal)}
                </span>
              )}
            </div>
            <div className="an-card-body">
              {!hasLearnData ? (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                  <Icon name="book" size={13} />
                  <span>No learning sessions this period — head to Learning Path to start tracking.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={learningChartData} margin={{ top: 4, right: 4, left: -20, bottom: (period === 'month' || period === 'quarter') ? 10 : 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={<CustomXTick showWeek={period === 'month' || period === 'quarter'} />} tickLine={false} axisLine={false} interval={period === 'quarter' ? 2 : 0} />
                    <YAxis tick={{ fontSize: 9, fontFamily: 'var(--f-mono)', fill: 'var(--text-3)' }} tickLine={false} axisLine={false} tickFormatter={v => v === 0 ? '0' : `${v}h`} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text)' }}>
                          <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>{label}</div>
                          <div style={{ color: '#4ade80' }}>{fmtHrs(payload[0].value)}</div>
                        </div>
                      );
                    }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="hours" radius={[3, 3, 0, 0]} maxBarSize={28}>
                      {learningChartData.map((d, i) => (
                        <Cell key={i} fill={d.hours > 0 ? '#4ade80' : 'var(--bg-3)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top projects in period */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Top Projects</div>
                <div className="an-card-sub">Most time invested — {PERIOD_LABEL[period].toLowerCase()}</div>
              </div>
            </div>
            <div className="an-card-body" style={topProjects.length === 0 ? { padding: '10px 14px' } : undefined}>
              {topProjects.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                  <Icon name="chart" size={13} />
                  <span>No time logged this period — start tracking projects.</span>
                </div>
              ) : (
                <div className="an-pipe-list">
                  {topProjects.map(row => {
                    const maxH = topProjects[0].hours || 1;
                    const proj = projects.find(p => p.id === row.short);
                    return (
                      <div key={row.short} className="an-pipe-row">
                        <div className="an-pipe-label">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {proj && <span style={{ width: 7, height: 7, borderRadius: '50%', background: proj.color || 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />}
                            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>{row.short}</span>
                            {proj && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{proj.name.split(' — ')[0]}</span>}
                          </span>
                          <span className="an-pipe-amount">{fmtHrs(row.hours)}</span>
                        </div>
                        <div className="an-pipe-track">
                          <div className="an-pipe-fill" style={{ width: `${(row.hours / maxH) * 100}%`, background: 'linear-gradient(90deg,var(--accent),var(--accent-hi))' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Revenue pipeline */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Revenue Pipeline</div>
                <div className="an-card-sub">Earned vs. in-progress billing</div>
              </div>
              {totalBudget > 0 && (
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--accent-hi)', fontWeight: 700 }}>
                  {fmtK(totalBudget)} total
                </span>
              )}
            </div>
            <div className="an-card-body" style={totalBudget === 0 ? { padding: '10px 14px' } : undefined}>
              {totalBudget === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                  <Icon name="note" size={13} />
                  <span>No budget data — add budgets to your projects to track revenue.</span>
                </div>
              ) : (
                <div className="an-pipe-list">
                  {pipeRows.map(row => (
                    <div key={row.label} className="an-pipe-row">
                      <div className="an-pipe-label">
                        <span>{row.label}</span>
                        <span className="an-pipe-amount" style={{ color: row.label === 'Total' ? 'var(--accent-hi)' : row.label === 'Earned' ? '#25d366' : '#ff9500' }}>
                          {fmtK(row.amount)}
                        </span>
                      </div>
                      <div className="an-pipe-track">
                        <div className="an-pipe-fill" style={{ width: `${(row.amount / maxBudget) * 100}%`, background: row.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────── */}
        <div className="an-col">

          {/* Task status distribution */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Task Distribution</div>
                <div className="an-card-sub">{parentTasks.length} tasks across {statuses.length} statuses</div>
              </div>
            </div>
            <div className="an-card-body" style={taskStatusDist.length === 0 ? { padding: '10px 14px' } : undefined}>
              {taskStatusDist.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                  <Icon name="list" size={13} />
                  <span>{parentTasks.length === 0 ? 'No tasks yet — create tasks and assign statuses.' : 'No status data — assign statuses to your tasks.'}</span>
                </div>
              ) : (
                <>
                  <SegBar segments={taskStatusDist} />
                  <div className="an-status-list">
                    {taskStatusDist.map(s => {
                      const pct = Math.round((s.count / (parentTasks.length || 1)) * 100);
                      return (
                        <div key={s.id} className="an-status-row">
                          <div className="an-status-dot" style={{ background: s.color }} />
                          <span style={{ fontSize: 12 }}>{s.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                            <div style={{ width: 60, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 2 }} />
                            </div>
                            <span className="an-status-count">{s.count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Project breakdown */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Project Breakdown</div>
                <div className="an-card-sub">{projects.length} total projects</div>
              </div>
            </div>
            <div className="an-card-body" style={projects.length === 0 ? { padding: '10px 14px' } : undefined}>
              {projects.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                  <Icon name="chart" size={13} />
                  <span>No projects yet — create your first project to see breakdown.</span>
                </div>
              ) : (
                <>
                  <SegBar segments={projStatusDist} />
                  <div className="an-status-list">
                    {projStatusDist.map(s => {
                      const pct = Math.round((s.count / (projects.length || 1)) * 100);
                      return (
                        <div key={s.status} className="an-status-row">
                          <div className="an-status-dot" style={{ background: s.color }} />
                          <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{s.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                            <div style={{ width: 60, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 2 }} />
                            </div>
                            <span className="an-status-count">{s.count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Project progress (hours vs estimate + task completion) */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Project Progress</div>
                <div className="an-card-sub">Hours logged · task completion</div>
              </div>
            </div>
            <div className="an-card-body" style={{ padding: projProgress.length === 0 ? '10px 14px' : '14px 18px' }}>
              {projProgress.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                  <Icon name="chart" size={13} />
                  <span>No active projects — activate or create a project to track progress.</span>
                </div>
              ) : (
                <div className="an-proj-list">
                  {projProgress.map(p => {
                    const col = PROJ_STATUS_COLOR[p.status] || 'var(--text-3)';
                    const barPct = p.hrPct !== null ? p.hrPct : p.tPct;
                    const isOver = p.hrPct !== null && p.hrPct > 100;
                    return (
                      <div key={p.id} className="an-proj-row">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="an-proj-name">
                            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--text-3)', marginRight: 6 }}>{p.id}</span>
                            {p.name.split(' — ')[0]}
                          </div>
                          <div className="an-proj-bar">
                            <div className="an-proj-fill" style={{ width: `${Math.min(100, barPct)}%`, background: isOver ? '#ff3d3d' : col }} />
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 3, fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                            <span>{fmtHrs(p.hoursLogged)} logged</span>
                            {p.hoursEst > 0 && <span style={{ color: isOver ? '#ff3d3d' : 'var(--text-3)' }}>{p.hrPct}% of {fmtHrs(p.hoursEst)}</span>}
                            <span>{p.doneCount}/{p.taskCount} tasks</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <div className="an-proj-pct" style={{ color: isOver ? '#ff3d3d' : col }}>{barPct}%</div>
                          <span className={`pill ${p.status}`} style={{ fontSize: 8, padding: '1px 5px' }}>{p.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

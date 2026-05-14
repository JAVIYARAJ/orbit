// analytics.jsx — Redesigned Analytics Dashboard

import { useState, useMemo } from 'react';
import { Icon } from '../components/shell.jsx';

// ─── Helpers ─────────────────────────────────────────────────────
const parseBudget = (b) => {
  if (!b || b === '—') return 0;
  return parseInt(b.replace(/[€$\s,]/g, '')) || 0;
};

const STATUS_COLOR = {
  done:     '#25d366',
  progress: '#0099ff',
  review:   '#ff9500',
  planning: '#6a6a78',
  hold:     '#ff3d3d',
};

// ─── SVG weekly bar chart ─────────────────────────────────────────
const WeekChart = ({ data }) => {
  const max = Math.max(...data.map(d => Math.max(d.val, d.focus)), 1);
  const W = 300, H = 110, bw = 9, gap = 4;
  const colW = W / data.length;
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 22}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="wg-main" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="100%" stopColor="#0175C2" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="wg-today" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ffcc" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
      </defs>

      {/* Horizontal grid */}
      {[0.33, 0.66, 1].map(t => (
        <line key={t}
          x1={0} x2={W}
          y1={H * (1 - t)} y2={H * (1 - t)}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1"
        />
      ))}

      {data.map((d, i) => {
        const cx  = i * colW + colW / 2;
        const h1  = (d.val   / max) * H;
        const h2  = (d.focus / max) * H;
        const today = i === todayIdx;
        return (
          <g key={i}>
            {today && (
              <rect x={cx - colW / 2} y={0} width={colW} height={H}
                fill="rgba(0,153,255,0.04)" />
            )}
            {/* Focus bar (behind) */}
            <rect
              x={cx - bw - gap / 2} y={H - h2}
              width={bw} height={h2}
              fill="rgba(0,153,255,0.22)" rx="2"
            />
            {/* Productivity bar (front) */}
            <rect
              x={cx + gap / 2} y={H - h1}
              width={bw} height={h1}
              fill={today ? 'url(#wg-today)' : 'url(#wg-main)'} rx="2"
            />
            <text
              x={cx} y={H + 15}
              textAnchor="middle" fill={today ? 'var(--accent-hi)' : '#6a6a78'}
              fontSize="9" fontFamily="monospace" fontWeight="600"
            >{d.day}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Sparkline (mini trend line) ──────────────────────────────────
const Sparkline = ({ data, color = 'var(--accent)', h = 26 }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * 100},${h - ((v - min) / range) * h}`
  ).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 100 ${h}`}
      preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Horizontal segmented bar ─────────────────────────────────────
const SegBar = ({ statuses }) => {
  const total = statuses.reduce((s, x) => s + x.count, 0) || 1;
  return (
    <div className="an-seg-bar">
      {statuses.map(s => s.count > 0 && (
        <div key={s.label} className="an-seg-piece"
          style={{ background: s.color, width: `${(s.count / total) * 100}%` }}
          title={`${s.label}: ${s.count}`}
        />
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────
export const Analytics = ({ projects = [], tasks = [] }) => {
  const [period, setPeriod] = useState('month');

  // ── KPI computations ────────────────────────────────────────────
  const completedTasks  = tasks.filter(t => t.col === 'done').length;
  const activeTasks     = tasks.filter(t => t.col === 'progress').length;
  const totalTasks      = tasks.length || 1;
  const totalHours      = projects.reduce((s, p) => s + (p.hoursLogged || 0), 0);
  const estHours        = projects.reduce((s, p) => s + (p.hoursEst   || 0), 0);

  const productivityScore = Math.min(100, Math.round(
    (completedTasks / totalTasks) * 70 + (activeTasks <= 3 ? 10 : 5) + 15
  ));

  const completedRevenue = projects
    .filter(p => p.status === 'done')
    .reduce((s, p) => s + parseBudget(p.budget), 0);
  const pipelineRevenue = projects
    .filter(p => p.status !== 'hold' && p.status !== 'done')
    .reduce((s, p) => s + parseBudget(p.budget), 0);
  const totalRevenue = completedRevenue + pipelineRevenue;

  // ── Chart data ───────────────────────────────────────────────────
  const weekData = useMemo(() => [
    { day: 'MON', val: 82, focus: 70 },
    { day: 'TUE', val: 91, focus: 84 },
    { day: 'WED', val: 87, focus: 78 },
    { day: 'THU', val: 95, focus: 91 },
    { day: 'FRI', val: 88, focus: 80 },
    { day: 'SAT', val: 65, focus: 52 },
    { day: 'SUN', val: 58, focus: 44 },
  ], []);

  const statuses = useMemo(() => [
    { label: 'Done',     color: STATUS_COLOR.done,     count: projects.filter(p => p.status === 'done').length },
    { label: 'Progress', color: STATUS_COLOR.progress, count: projects.filter(p => p.status === 'progress').length },
    { label: 'Review',   color: STATUS_COLOR.review,   count: projects.filter(p => p.status === 'review').length },
    { label: 'Planning', color: STATUS_COLOR.planning, count: projects.filter(p => p.status === 'planning').length },
    { label: 'On Hold',  color: STATUS_COLOR.hold,     count: projects.filter(p => p.status === 'hold').length },
  ], [projects]);

  const sparkData = useMemo(() => [42, 58, 53, 70, 65, 80, 78, 85, 79, 92, 88, 95], []);

  const fmtK  = (n) => n >= 1000 ? `€${(n / 1000).toFixed(1)}K` : `€${n}`;
  const fmtPct = (n, d) => `${Math.round((n / (d || 1)) * 100)}%`;

  // ── KPI strip items ──────────────────────────────────────────────
  const kpis = [
    {
      label: 'Productivity',
      value: productivityScore,
      unit: '/ 100',
      delta: '+12 pts',
      up: true,
      color: 'var(--accent-hi)',
      spark: sparkData,
    },
    {
      label: 'Revenue Earned',
      value: fmtK(completedRevenue),
      unit: 'completed',
      delta: 'from ' + projects.filter(p => p.status === 'done').length + ' projects',
      up: true,
      color: '#25d366',
      spark: [20, 20, 30, 30, 45, 45, 60, 60, 60, 75, 75, 86],
    },
    {
      label: 'Hours Tracked',
      value: totalHours,
      unit: `of ${estHours}h est.`,
      delta: fmtPct(totalHours, estHours) + ' utilization',
      up: totalHours / estHours >= 0.6,
      color: '#ff9500',
      spark: [10, 22, 35, 48, 60, 72, 80, 88, 90, 95, 98, totalHours],
    },
    {
      label: 'Tasks Done',
      value: completedTasks,
      unit: `of ${totalTasks}`,
      delta: fmtPct(completedTasks, totalTasks) + ' complete',
      up: completedTasks / totalTasks >= 0.3,
      color: 'var(--text)',
      spark: [1, 1, 2, 3, 3, 4, 4, 4, 4, 4, 4, completedTasks],
    },
    {
      label: 'Pipeline',
      value: fmtK(pipelineRevenue),
      unit: 'in progress',
      delta: fmtK(totalRevenue) + ' total',
      up: true,
      color: '#7c3aed',
      spark: [0, 12, 12, 25, 38, 38, 50, 63, 75, 75, 86, 100],
    },
  ];

  // ── Revenue pipeline bars ────────────────────────────────────────
  const pipeRows = [
    { label: 'Earned',      amount: completedRevenue, max: totalRevenue || 1, fill: 'linear-gradient(90deg, #25d366, #4ade80)' },
    { label: 'In Pipeline', amount: pipelineRevenue,  max: totalRevenue || 1, fill: 'linear-gradient(90deg, #ff9500, #fbbf24)' },
    { label: 'Total',       amount: totalRevenue,     max: totalRevenue || 1, fill: 'linear-gradient(90deg, var(--accent), var(--accent-hi))' },
  ];

  return (
    <div className="page-wide">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <div className="crumb">INSIGHTS &amp; ANALYTICS</div>
          <h1>Performance</h1>
          <div className="sub">Productivity metrics and project health</div>
        </div>
        <div className="actions" style={{ alignItems: 'center', gap: 10 }}>
          <select
            className="period-select"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button className="btn sm ghost" style={{ gap: 6 }}>
            <Icon name="download" size={13} /> Export
          </button>
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
            <div className={`an-kpi-delta ${kpi.up ? 'up' : 'dn'}`}>
              <Icon name={kpi.up ? 'chev' : 'chevD'} size={10} />
              {kpi.delta}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-col grid ────────────────────────────────────── */}
      <div className="an-two-col">

        {/* Left column */}
        <div className="an-col">

          {/* Weekly Activity */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Weekly Activity</div>
                <div className="an-card-sub">Productivity vs. focus time</div>
              </div>
              <div className="an-legend">
                <span><span className="an-legend-dot" style={{ background: 'var(--accent-hi)' }} />Productivity</span>
                <span><span className="an-legend-dot" style={{ background: 'rgba(0,153,255,0.3)' }} />Focus</span>
              </div>
            </div>
            <div className="an-card-body">
              <WeekChart data={weekData} />
              <div className="an-week-meta">
                <span>Peak day: <strong>Thu 95</strong></span>
                <span>Avg: <strong>81</strong></span>
                <span>vs last week: <strong style={{ color: '#25d366' }}>+6%</strong></span>
              </div>
            </div>
          </div>

          {/* Revenue Pipeline */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Revenue Pipeline</div>
                <div className="an-card-sub">Earned vs. in-progress billing</div>
              </div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--accent-hi)', fontWeight: 700 }}>
                {fmtK(totalRevenue)} total
              </div>
            </div>
            <div className="an-card-body">
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
                      <div className="an-pipe-fill"
                        style={{
                          width: `${(row.amount / row.max) * 100}%`,
                          background: row.fill,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 24, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                <span>BILLABLE RATE <strong style={{ color: 'var(--text-2)' }}>€85/hr</strong></span>
                <span>INVOICED <strong style={{ color: 'var(--text-2)' }}>3 of 6</strong></span>
                <span>OVERDUE <strong style={{ color: '#ff3d3d' }}>1</strong></span>
              </div>
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="an-col">

          {/* Project Breakdown */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Project Breakdown</div>
                <div className="an-card-sub">{projects.length} total across all clients</div>
              </div>
            </div>
            <div className="an-card-body">
              <SegBar statuses={statuses} />
              <div className="an-status-list">
                {statuses.map(s => {
                  const pct = Math.round((s.count / (projects.length || 1)) * 100);
                  return (
                    <div key={s.label} className="an-status-row">
                      <div className="an-status-dot" style={{ background: s.color }} />
                      <span style={{ fontSize: 12 }}>{s.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 60, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 2 }} />
                        </div>
                        <span className="an-status-count">{s.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Task Distribution</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)' }}>
                  {[
                    { label: 'BACKLOG', count: tasks.filter(t => t.col === 'backlog').length, color: 'var(--text-3)' },
                    { label: 'TODO',    count: tasks.filter(t => t.col === 'todo').length,    color: 'var(--text-2)' },
                    { label: 'ACTIVE',  count: tasks.filter(t => t.col === 'progress').length, color: 'var(--accent-hi)' },
                    { label: 'DONE',    count: tasks.filter(t => t.col === 'done').length,    color: '#25d366' },
                  ].map(cell => (
                    <div key={cell.label} style={{ background: 'var(--bg-2)', padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 20, fontWeight: 700, color: cell.color }}>{cell.count}</div>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 8, letterSpacing: '0.08em', color: 'var(--text-3)', marginTop: 4 }}>{cell.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Projects */}
          <div className="an-card">
            <div className="an-card-h">
              <div>
                <div className="an-card-title">Project Progress</div>
                <div className="an-card-sub">Hours logged vs. estimated</div>
              </div>
            </div>
            <div className="an-card-body" style={{ padding: '14px 18px' }}>
              <div className="an-proj-list">
                {projects.filter(p => p.status !== 'hold').map(p => {
                  const col = STATUS_COLOR[p.status] || 'var(--text-3)';
                  const hrPct = Math.round(((p.hoursLogged || 0) / (p.hoursEst || 1)) * 100);
                  return (
                    <div key={p.id} className="an-proj-row">
                      <div style={{ minWidth: 0 }}>
                        <div className="an-proj-name">
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--text-3)', marginRight: 6 }}>{p.id}</span>
                          {p.name.split(' — ')[0]}
                        </div>
                        <div className="an-proj-bar">
                          <div className="an-proj-fill" style={{ width: `${p.progress}%`, background: col }} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                          <span>{p.hoursLogged}h logged</span>
                          <span style={{ color: hrPct > 100 ? '#ff3d3d' : 'var(--text-3)' }}>{hrPct}% capacity</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="an-proj-pct" style={{ color: col }}>{p.progress}%</div>
                        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
                          <span className={`pill ${p.status}`} style={{ fontSize: 8, padding: '1px 5px' }}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Insights strip ─────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12, fontWeight: 600 }}>
          Smart Insights
        </div>
        <div className="an-insights">
          {[
            {
              type: 'positive',
              icon: 'flame',
              title: 'Peak Hours Identified',
              desc: 'Your most productive windows are 10–11 AM and 2–3 PM. Block these slots for deep work sessions.',
            },
            {
              type: 'warning',
              icon: 'bell',
              title: 'Energy Dip Pattern',
              desc: 'Output drops ~30% after 4 PM. Move client calls and reviews to morning to reclaim your best hours.',
            },
            {
              type: 'info',
              icon: 'chart',
              title: 'On Track to Ship Early',
              desc: 'Current velocity puts all active projects 3 days ahead of schedule. Protect this buffer.',
            },
          ].map(ins => (
            <div key={ins.title} className={`an-insight ${ins.type}`}>
              <div className="an-insight-ic">
                <Icon name={ins.icon} size={18} />
              </div>
              <div>
                <div className="an-insight-ttl">{ins.title}</div>
                <div className="an-insight-desc">{ins.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

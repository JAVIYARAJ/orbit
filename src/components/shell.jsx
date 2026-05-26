// shell.jsx — Sidebar, Topbar, Command Palette, SlidePanel

import { useState, useEffect, useRef } from 'react';

// ─── Icons (inline SVG, 16px viewbox) ─────────────────────────────
export const Icon = ({ name, size = 16 }) => {
  const paths = {
    home: <path d="M2 7L8 2L14 7V14H10V10H6V14H2V7Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />,
    folder: <path d="M2 4H6L7.5 5.5H14V13H2V4Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />,
    list: <g stroke="currentColor" strokeWidth="1.2"><path d="M2 4H14M2 8H14M2 12H10" /></g>,
    book: <path d="M3 3V13H7.5C8 13 8 12.5 8 12V4C8 3.5 8 3 7.5 3H3ZM13 3V13H8.5C8 13 8 12.5 8 12V4C8 3.5 8 3 8.5 3H13Z" stroke="currentColor" strokeWidth="1.2" fill="none" />,
    lock: <g stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="3" y="7" width="10" height="7" /><path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7" /></g>,
    chart: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M2 14H14" /><rect x="3" y="8" width="2" height="5" /><rect x="7" y="5" width="2" height="8" /><rect x="11" y="3" width="2" height="10" /></g>,
    note: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M3 2H10L13 5V14H3V2Z" /><path d="M10 2V5H13" /><path d="M5 8H11M5 11H9" /></g>,
    timer: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="8" cy="9" r="5" /><path d="M8 6V9L10 10.5" strokeLinecap="round" /><path d="M6 2H10" /></g>,
    mail: <g stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="2" y="3" width="12" height="10" /><path d="M2 4L8 9L14 4" /></g>,
    tool: <path d="M11 2L14 5L9.5 9.5L6.5 6.5L11 2ZM7 7L2 12L4 14L9 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />,
    search: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></g>,
    bell: <path d="M4 11V7C4 4.79 5.79 3 8 3C10.21 3 12 4.79 12 7V11L13 12H3L4 11ZM7 13H9C9 13.55 8.55 14 8 14C7.45 14 7 13.55 7 13Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />,
    plus: <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
    minus: <path d="M3 8H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
    play: <path d="M5 3L13 8L5 13V3Z" fill="currentColor" />,
    pause: <g fill="currentColor"><rect x="4" y="3" width="3" height="10" /><rect x="9" y="3" width="3" height="10" /></g>,
    stop: <rect x="3" y="3" width="10" height="10" fill="currentColor" />,
    copy: <g stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="3" y="3" width="8" height="8" /><path d="M5 5V2H13V10H11" /></g>,
    eye: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M1 8C1 8 3 4 8 4S15 8 15 8S13 12 8 12S1 8 1 8Z" /><circle cx="8" cy="8" r="2" /></g>,
    chev: <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    chevD: <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    chevU: <path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    trash: <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3h3"/><path d="M2.5 5.5h11"/><path d="M5 5.5l.8 7.5h4.4l.8-7.5"/></g>,
    git: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="8" r="1.5" /><path d="M4 5.5V10.5M5.5 12H10.5C10.5 9.5 4 11 4 6" /></g>,
    pin: <path d="M8 2L11 5L10 6L11 7L9 9L8 14L7 9L5 7L6 6L5 5L8 2Z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />,
    tag: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M2 7L7 2H13V8L8 13L2 7Z" /><circle cx="10" cy="6" r="0.8" fill="currentColor" /></g>,
    rev: <path d="M4 8C4 5.5 6 3.5 8 3.5C9.5 3.5 10.8 4.4 11.5 5.5M12 8C12 10.5 10 12.5 8 12.5C6.5 12.5 5.2 11.6 4.5 10.5M11.5 3V5.5H9M4.5 13V10.5H7" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    sidebar: <g stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="2" y="3" width="12" height="10" /><path d="M6 3V13" /></g>,
    settings: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="8" cy="8" r="2" /><path d="M8 1V3M8 13V15M15 8H13M3 8H1M12.95 3.05L11.5 4.5M4.5 11.5L3.05 12.95M12.95 12.95L11.5 11.5M4.5 4.5L3.05 3.05" /></g>,
    key: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="5" cy="8" r="3" /><path d="M8 8H14M12 8V11M14 8V10" /></g>,
    code: <path d="M5 4L1 8L5 12M11 4L15 8L11 12" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    palette: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="8" cy="8" r="6" /><circle cx="5" cy="6" r="1" fill="currentColor" /><circle cx="9" cy="4" r="1" fill="currentColor" /><circle cx="12" cy="7" r="1" fill="currentColor" /><circle cx="11" cy="11" r="1" fill="currentColor" /></g>,
    hash: <g stroke="currentColor" strokeWidth="1.2"><path d="M2 5H14M2 8H14M2 11H14" /></g>,
    drag: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="5" cy="5" r="0.5" fill="currentColor" /><circle cx="5" cy="8" r="0.5" fill="currentColor" /><circle cx="5" cy="11" r="0.5" fill="currentColor" /><circle cx="11" cy="5" r="0.5" fill="currentColor" /><circle cx="11" cy="8" r="0.5" fill="currentColor" /><circle cx="11" cy="11" r="0.5" fill="currentColor" /></g>,
    arrow: <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    check: <path d="M3 8L7 12L13 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    x: <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
    edit: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M11 2L14 5L6 13L2 14L3 10L11 2Z" /></g>,
    download: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M8 2V11M4 7L8 11L12 7M2 14H14" strokeLinecap="round" strokeLinejoin="round" /></g>,
    flame: <path d="M8 14C5.24 14 3 11.76 3 9C3 6.5 4.5 5 5 4C5 6 6 7 7 7C7 4 8 2 9 1C9 4 13 6 13 9C13 11.76 10.76 14 8 14Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />,
    cmd: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M4 6V4.5C4 3.67 4.67 3 5.5 3S7 3.67 7 4.5V6H4ZM9 6V4.5C9 3.67 9.67 3 10.5 3S12 3.67 12 4.5V6H9ZM4 10V11.5C4 12.33 4.67 13 5.5 13S7 12.33 7 11.5V10H4ZM9 10V11.5C9 12.33 9.67 13 10.5 13S12 12.33 12 11.5V10H9ZM4 6V10H12V6H4Z" /></g>,
    'check-circle': <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="8" cy="8" r="6" /><path d="M5 8L7 10L11 6" strokeLinecap="round" strokeLinejoin="round" /></g>,
    'message-square': <g stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="2" y="3" width="12" height="9" rx="1" /><path d="M5 14L8 11H14" /></g>,
    'git-merge': <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="5" r="1.5" /><path d="M4 5.5V10.5M5.5 4C8 4 10.5 4 10.5 5C10.5 9.5 4 9 4 10.5" /></g>,
    flag: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M4 3V14M4 3H13L10 7H13L4 13" strokeLinecap="round" strokeLinejoin="round" /></g>,
    'edit-3': <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M11 2L14 5L6 13L2 14L3 10L11 2Z" /><path d="M9 4L12 7" /></g>,
    activity: <path d="M2 8H5L7 4L9 12L11 7L13 8H14" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    star: <path d="M8 2L9.8 6.2L14.5 6.6L11 9.6L12.1 14L8 11.5L3.9 14L5 9.6L1.5 6.6L6.2 6.2L8 2Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />,
    'git-fork': <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" /><circle cx="8" cy="12" r="1.5" /><path d="M5 5.5V8C5 9 6 10 8 10.5M11 5.5V8C11 9 10 10 8 10.5" /></g>,
    users: <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="6" cy="6" r="2.5" /><path d="M1 14C1 11.24 3.24 9 6 9" /><circle cx="11" cy="6" r="2.5" /><path d="M7.5 10.5C8.8 9.58 10.34 9 12 9C13.66 9 15 10 15 14" /></g>,
    layers: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M2 10L8 13L14 10M2 7L8 10L14 7M8 3L14 6L8 9L2 6L8 3Z" strokeLinejoin="round" /></g>,
    github: <g stroke="currentColor" strokeWidth="1.1" fill="none"><path d="M8 2C4.69 2 2 4.69 2 8C2 10.66 3.73 12.93 6.12 13.76C6.42 13.82 6.53 13.63 6.53 13.47V12.33C4.87 12.7 4.51 11.53 4.51 11.53C4.24 10.81 3.84 10.62 3.84 10.62C3.29 10.24 3.88 10.25 3.88 10.25C4.5 10.29 4.82 10.89 4.82 10.89C5.36 11.82 6.24 11.55 6.56 11.39C6.61 11 6.77 10.73 6.95 10.58C5.64 10.43 4.27 9.92 4.27 7.71C4.27 7.04 4.5 6.48 4.89 6.05C4.83 5.9 4.64 5.26 4.94 4.38C4.94 4.38 5.43 4.22 6.52 5.08C7.01 4.94 7.5 4.87 8 4.87C8.5 4.87 8.99 4.94 9.48 5.08C10.57 4.22 11.06 4.38 11.06 4.38C11.36 5.26 11.17 5.9 11.11 6.05C11.5 6.48 11.73 7.04 11.73 7.71C11.73 9.93 10.36 10.43 9.04 10.57C9.26 10.76 9.46 11.12 9.46 11.67V13.47C9.46 13.63 9.57 13.82 9.88 13.76C12.27 12.93 14 10.66 14 8C14 4.69 11.31 2 8 2Z" /></g>,
    'credit-card': <g stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="2" y="4" width="12" height="9" rx="1" /><path d="M2 7H14" /><path d="M5 10.5H7" strokeLinecap="round" /></g>,
    database: <g stroke="currentColor" strokeWidth="1.2" fill="none"><ellipse cx="8" cy="4" rx="5" ry="2" /><path d="M13 8C13 9.1 10.76 10 8 10C5.24 10 3 9.1 3 8M13 12C13 13.1 10.76 14 8 14C5.24 14 3 13.1 3 12M3 4V12M13 4V12" /></g>,
    triangle: <path d="M8 3L14 13H2L8 3Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />,
    link: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M7 9C7.55 9.83 8.48 10.37 9.5 10.37C10.18 10.37 10.79 10.1 11.24 9.66L13.02 7.87C13.87 7.02 13.87 5.64 13.02 4.78C12.17 3.93 10.79 3.93 9.93 4.78L9.01 5.69" strokeLinecap="round" /><path d="M9 7C8.45 6.17 7.52 5.63 6.5 5.63C5.82 5.63 5.21 5.9 4.76 6.34L2.98 8.13C2.13 8.98 2.13 10.36 2.98 11.22C3.83 12.07 5.21 12.07 6.07 11.22L6.99 10.31" strokeLinecap="round" /></g>,
    'eye-off': <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M2 2L14 14M6.5 6.55C5.85 7.07 5.38 7.86 5.14 8.46M9.65 9.6C9.2 10.03 8.62 10.3 8 10.3C6.62 10.3 5.5 9.18 5.5 7.8M1 8C1 8 3 4 8 4C8.83 4 9.61 4.17 10.31 4.47M14.5 8C14.5 8 13.5 10.5 11 11.7" strokeLinecap="round" /></g>,
    'sign-out': <path d="M10 3H13V13H10M6 5L3 8L6 11M3 8H11" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    camera: <g stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="2" y="5" width="12" height="9" rx="1" /><circle cx="8" cy="9.5" r="2.5" /><path d="M5 5L6 3H10L11 5" /></g>,
    'git-branch': <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="4" r="1.5" /><path d="M4 5.5V10.5M5.5 4H10.5M10.5 5.5C10.5 8 7 9 4 10.5" strokeLinecap="round" /></g>,
    'git-commit': <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="8" cy="8" r="2.5" /><path d="M2 8H5.5M10.5 8H14" strokeLinecap="round" /></g>,
    'alert-circle': <g stroke="currentColor" strokeWidth="1.2" fill="none"><circle cx="8" cy="8" r="6" /><path d="M8 5V8.5" strokeLinecap="round" /><circle cx="8" cy="11" r="0.6" fill="currentColor" /></g>,
    'external-link': <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M7 3H3V13H13V9M9 2H14V7M14 2L8 8" strokeLinecap="round" strokeLinejoin="round" /></g>,
    upload: <g stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M8 11V2M4 6L8 2L12 6M2 14H14" strokeLinecap="round" strokeLinejoin="round" /></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block' }}>
      {paths[name] || null}
    </svg>
  );
};

// ─── Nav definition ────────────────────────────────────────────────
export const NAV = [
  {
    section: 'WORKSPACE', items: [
      { id: 'home', label: 'Command Center', icon: 'home', kbd: 'G H' },
      { id: 'projects', label: 'Projects', icon: 'folder', kbd: 'G P' },
      { id: 'tasks', label: 'Tasks', icon: 'list', kbd: 'G T' },
      { id: 'pm', label: 'Project Mgmt', icon: 'chart', kbd: 'G M' },
    ]
  },
  {
    section: 'INSIGHTS', items: [
      { id: 'analytics', label: 'Analytics', icon: 'chart', kbd: 'G A' },
      { id: 'collab', label: 'Team Collab', icon: 'hash', kbd: 'G C' },
    ]
  },
  {
    section: 'TOOLS', items: [
      { id: 'timer', label: 'Time Tracker', icon: 'timer', kbd: 'G I' },
      { id: 'notes', label: 'Notes', icon: 'note', kbd: 'G N' },
      { id: 'email', label: 'Email Hub', icon: 'mail', kbd: 'G E' },
      { id: 'toolkit', label: 'Dev Toolkit', icon: 'tool', kbd: 'G D' },
      { id: 'flutter-init', label: 'Flutter Init', icon: 'flame', kbd: 'G F' },
    ]
  },
  {
    section: 'PLATFORMS', items: [
      { id: 'github', label: 'GitHub Hub', icon: 'github', kbd: 'G G' },
      { id: 'vercel', label: 'Vercel', icon: 'triangle', kbd: 'G K' },
    ]
  },
  {
    section: 'PERSONAL', items: [
      { id: 'learning', label: 'Learning Path', icon: 'book', kbd: 'G L' },
      { id: 'vault', label: 'Vault', icon: 'lock', kbd: 'G V' },
    ]
  },
  {
    section: 'ADMIN', items: [
      { id: 'settings', label: 'Settings', icon: 'settings', kbd: 'G S' },
    ]
  },
];

// Flat list (for cmd palette + lookup)
export const NAV_FLAT = NAV.flatMap(g => g.items.map(it => ({ ...it, section: g.section })));

// ─── WorkstationPanel ──────────────────────────────────────────────
const WorkstationPanel = ({ open, onClose, workstations = [], active, onSwitch, onNew }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ws-panel-back" onClick={onClose}>
      <div className="ws-panel" onClick={e => e.stopPropagation()}>
        <div className="ws-panel-hd">
          <div>
            <div className="ws-panel-title">Workspaces</div>
            <div className="ws-panel-sub">Navigate between your environments</div>
          </div>
          <button className="ws-panel-close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="ws-panel-list">
          {workstations.map(ws => (
            <div
              key={ws.id}
              className={'ws-item' + (ws.id === active?.id ? ' active' : '')}
              onClick={() => { onSwitch(ws); onClose(); }}
            >
              <div className="ws-item-glow" style={{ background: ws.color }} />
              <div className="ws-item-dot" style={{ background: ws.color }} />
              <div className="ws-item-content">
                <div className="ws-item-name">{ws.name}</div>
                <div className="ws-item-meta">{ws.id} · {active?.id === ws.id ? 'Current' : 'Select'}</div>
              </div>
              {ws.id === active?.id && (
                <div className="ws-item-check"><Icon name="check" size={14} /></div>
              )}
            </div>
          ))}

          <button className="ws-panel-add" onClick={() => { onNew(); onClose(); }}>
            <div className="ic"><Icon name="plus" size={14} /></div>
            <span>Create new workspace</span>
          </button>
        </div>

        <div className="ws-panel-foot">
          <div className="label">QUICK SWITCH</div>
          <div className="kbd">⌘ + 1-9</div>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar ───────────────────────────────────────────────────────
export const Sidebar = ({
  current, onNav, collapsed, onToggleCollapsed,
  user, onLogout,
  workstations, activeWorkstation, onWsSwitch, onNewWs,
  enabledModules = {},
}) => {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <aside className="sb">
      <div className="sb-brand">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{flexShrink:0}}>
          <circle cx="9" cy="9" r="3" fill="currentColor"/>
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="9" cy="3" r="1.5" fill="currentColor"/>
        </svg>
        <span className="label">Orbit</span>
        <span className="v">v1.0</span>
      </div>

      <div className="sb-scroll">
        {NAV.map(g => {
          const visibleItems = g.items.filter(it => enabledModules[it.id] !== false);
          if (visibleItems.length === 0) return null;
          return (
            <div key={g.section}>
              <div className="sb-section">{g.section}</div>
              <div className="sb-nav">
                {visibleItems.map(it => (
                  <button key={it.id}
                    className={'sb-item' + (current === it.id ? ' active' : '')}
                    onClick={() => onNav(it.id)}
                    title={it.label}>
                    <span className="ic"><Icon name={it.icon} /></span>
                    <span className="label">{it.label}</span>
                    <span className="kbd">{it.kbd}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sb-foot">
        <div
          className="sb-user"
          onClick={() => setPanelOpen(true)}
          style={{ cursor: 'pointer' }}
          title="Switch workspace"
        >
          <div className="ava-wrap">
            <div className="ava">{user?.avatar || (user?.name?.[0] || 'U').toUpperCase()}</div>
            <div className="ava-dot" style={{ background: activeWorkstation?.color || 'var(--accent)' }} />
          </div>
          <div className="meta">
            <div className="n">{user?.name || 'User'}</div>
            <div className="e">{activeWorkstation?.name || 'Workspace'}</div>
          </div>
        </div>

        <div className="sb-collapse-row">
          <button className="sb-collapse-btn" onClick={onToggleCollapsed}>
            <span className="label">{collapsed ? 'EXPAND' : 'COLLAPSE'}</span>
            <span className="sb-collapse-arrow">
              <Icon name="chev" size={10} />
            </span>
          </button>
          {onLogout && (
            <button className="sb-collapse-btn sb-logout-btn" onClick={onLogout} title="Sign out">
              <Icon name="sign-out" size={10} />
            </button>
          )}
        </div>
      </div>

      <WorkstationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        workstations={workstations}
        active={activeWorkstation}
        onSwitch={onWsSwitch}
        onNew={onNewWs}
      />
    </aside>
  );
};

// ─── Topbar ────────────────────────────────────────────────────────
export const Topbar = ({ onOpenCmdK, timer, onTimerJump, theme = 'dark', onThemeToggle }) => {
  const isLight = theme === 'light';
  return (
    <header className="tb">
      <button className="tb-search" onClick={onOpenCmdK}>
        <Icon name="search" size={13} />
        <span>Search anything…</span>
        <span className="kbd">⌘K</span>
      </button>
      <div className="tb-spacer"></div>
      <button
        className={'tb-timer' + (timer.running ? '' : ' idle')}
        onClick={onTimerJump}
        title="Jump to time tracker">
        <span className="rec"></span>
        <span>{timer.running ? timer.label : 'No active timer'}</span>
        <span className="num" style={{ marginLeft: 4 }}>{timer.display}</span>
      </button>
      <button className="tb-icon-btn" title={isLight ? 'Switch to dark mode' : 'Switch to light mode'} onClick={onThemeToggle}>
        {isLight ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </button>
      <button className="tb-icon-btn" title="Notifications">
        <Icon name="bell" size={14} />
        <span className="badge"></span>
      </button>
    </header>
  );
};

// ─── SlidePanel ────────────────────────────────────────────────────
export const SlidePanel = ({ open, onClose, title, subtitle, children, width = 500 }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sp-bd" onClick={onClose}>
      <div className="sp" style={{ width }} onClick={e => e.stopPropagation()}>
        <div className="sp-hd">
          <div>
            <div className="sp-title">{title}</div>
            {subtitle && <div className="sp-sub">{subtitle}</div>}
          </div>
          <button className="sp-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Cmd+K Palette ────────────────────────────────────────────────
export const CmdPalette = ({ open, onClose, onNav, enabledModules = {} }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const isEnabled = (id) => enabledModules[id] !== false;

  const ACTIONS = [
    { type: 'action', label: 'Start new timer', hint: 'T S', icon: 'play', moduleId: 'timer',    do: () => { onNav('timer'); onClose(); } },
    { type: 'action', label: 'New task',         hint: 'T N', icon: 'plus', moduleId: 'tasks',    do: () => { onNav('tasks'); onClose(); } },
    { type: 'action', label: 'New note',         hint: 'N N', icon: 'plus', moduleId: 'notes',    do: () => { onNav('notes'); onClose(); } },
    { type: 'action', label: 'New project',      hint: 'P N', icon: 'plus', moduleId: 'projects', do: () => { onNav('projects'); onClose(); } },
    { type: 'action', label: 'Reveal vault item', hint: '',   icon: 'eye',  moduleId: 'vault',    do: () => { onNav('vault'); onClose(); } },
  ].filter(a => isEnabled(a.moduleId));
  const NAV_ITEMS = NAV_FLAT
    .filter(n => isEnabled(n.id))
    .map(n => ({ type: 'nav', label: 'Go to ' + n.label, hint: n.kbd, icon: n.icon, do: () => { onNav(n.id); onClose(); } }));

  const all = [...ACTIONS, ...NAV_ITEMS];
  const lq = q.toLowerCase();
  const filtered = q ? all.filter(a => a.label.toLowerCase().includes(lq)) : all;

  useEffect(() => { if (sel >= filtered.length) setSel(0); }, [filtered.length, sel]);

  const onKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.do(); }
  };

  if (!open) return null;
  const actions = filtered.filter(a => a.type === 'action');
  const navs = filtered.filter(a => a.type === 'nav');

  let idx = -1;
  const renderRow = (a) => {
    idx++;
    const i = idx;
    return (
      <div key={a.label} className={'cmdk-row' + (i === sel ? ' sel' : '')}
        onMouseEnter={() => setSel(i)} onClick={a.do}>
        <span className="ic"><Icon name={a.icon} size={14} /></span>
        <span className="t">{a.label}</span>
        {a.hint && <span className="h">{a.hint}</span>}
      </div>
    );
  };

  return (
    <div className="cmdk-back" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <input ref={inputRef} className="cmdk-input"
          placeholder="Search or run a command…"
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} />
        <div className="cmdk-list">
          {actions.length > 0 && <div className="cmdk-sec">Actions</div>}
          {actions.map(renderRow)}
          {navs.length > 0 && <div className="cmdk-sec">Navigate</div>}
          {navs.map(renderRow)}
          {filtered.length === 0 && <div className="cmdk-row" style={{ color: 'var(--text-3)' }}>No matches.</div>}
        </div>
      </div>
    </div>
  );
};

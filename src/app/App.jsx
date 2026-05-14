import { useState as useStateApp, useEffect as useEffectApp } from 'react';
import { Sidebar, Topbar, CmdPalette } from '../components/shell.jsx';
import {
  TweaksPanel, TweakSection, TweakColor, TweakRadio,
  TweakToggle, TweakSelect, TweakButton, useTweaks,
} from '../components/tweaks-panel.jsx';
import { supabase } from '../lib/supabase.js';
import { loadUserData, loadUserWorkstations, setActiveWorkstation as persistActiveWs } from '../lib/db.js';
import { WorkstationSetup } from '../components/workstation-setup.jsx';
import { HomePage, ProjectsPage, TasksPage, LearningPage, VaultPage } from '../pages/workspace.jsx';
import { ProjectMgmtPage, NotesPage, TimerPage, EmailPage, ToolkitPage } from '../pages/tools.jsx';
import { Analytics } from '../pages/analytics.jsx';
import { Collaboration } from '../pages/collaboration.jsx';
import { Settings } from '../pages/settings.jsx';
import { AuthPage } from '../pages/auth.jsx';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#0099ff",
  "density": "regular",
  "sidebarStart": "expanded",
  "monoFont": "IBM Plex Mono",
  "headingFont": "Syne",
  "surface": "true-black",
  "texture": false,
  "scanlines": false
}/*EDITMODE-END*/;

const FORMAT_TIME = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function PageRouter({ current, ...props }) {
  switch (current) {
    case 'projects':  return <ProjectsPage {...props} />;
    case 'tasks':     return <TasksPage {...props} />;
    case 'learning':  return <LearningPage {...props} />;
    case 'vault':     return <VaultPage {...props} />;
    case 'pm':        return <ProjectMgmtPage {...props} />;
    case 'notes':     return <NotesPage {...props} />;
    case 'timer':     return <TimerPage {...props} />;
    case 'email':     return <EmailPage {...props} />;
    case 'toolkit':   return <ToolkitPage {...props} />;
    case 'analytics': return <Analytics {...props} />;
    case 'collab':    return <Collaboration {...props} />;
    case 'settings':  return <Settings {...props} />;
    case 'home':
    default:          return <HomePage {...props} />;
  }
}

const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'var(--bg-0)', color: 'var(--text-3)',
                fontFamily: 'var(--f-mono)', fontSize: 12, letterSpacing: '0.08em' }}>
    LOADING…
  </div>
);

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ── Auth ────────────────────────────────────────────────────────
  const [authUser,    setAuthUser]    = useStateApp(null);
  const [authLoading, setAuthLoading] = useStateApp(true);
  const [dataLoading, setDataLoading] = useStateApp(false);

  // ── Workstations ────────────────────────────────────────────────
  const [workstations,      setWorkstations]      = useStateApp([]);
  const [activeWorkstation, setActiveWorkstation] = useStateApp(null);
  const [wsLoading,         setWsLoading]         = useStateApp(false);
  const [showWsSetup,       setShowWsSetup]       = useStateApp(false);

  // Resolve Supabase session on mount
  useEffectApp(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setAuthUser(buildUser(session.user));
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ? buildUser(session.user) : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const buildUser = (u) => {
    const name = u.user_metadata?.name || u.email.split('@')[0];
    return { id: u.id, name, email: u.email, avatar: name[0].toUpperCase() };
  };

  const handleAuth    = (user) => setAuthUser(user);
  const handleLogout  = async () => { await supabase.auth.signOut(); setAuthUser(null); };

  // ── Load workstations on login ──────────────────────────────────
  useEffectApp(() => {
    if (!authUser?.id) return;
    setWsLoading(true);
    loadUserWorkstations()
      .then(list => {
        setWorkstations(list);
        if (list.length === 0) {
          setShowWsSetup(true);
        } else {
          const savedId = localStorage.getItem('devos:activeWs');
          const found   = list.find(w => w.id === savedId) || list[0];
          setActiveWorkstation(found);
        }
      })
      .catch(console.error)
      .finally(() => setWsLoading(false));
  }, [authUser?.id]);

  // ── Load data when active workstation changes ───────────────────
  useEffectApp(() => {
    if (!activeWorkstation?.id) return;
    localStorage.setItem('devos:activeWs', activeWorkstation.id);
    setDataLoading(true);
    loadUserData(activeWorkstation.id)
      .then(d => {
        setProjects(d.projects);
        setTasks(d.tasks);
        setNotes(d.notes);
        setVault(d.vault);
        setLearning(d.learning);
        setSessions(d.sessions);
        setEmailTemplates(d.emailTemplates);
        setGanttTasks(d.ganttTasks);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [activeWorkstation?.id]);

  // Workstation handlers
  const handleWsCreated = (ws) => {
    setWorkstations(prev => [...prev, ws]);
    setActiveWorkstation(ws);
    setShowWsSetup(false);
  };

  const handleWsSwitch = (ws) => {
    if (ws.id === activeWorkstation?.id) return;
    setActiveWorkstation(ws);
    persistActiveWs(ws.id).catch(console.error); // fire-and-forget RPC
  };

  const handleNewWs = () => setShowWsSetup(true);

  // Navigation
  const [current,   setCurrent]   = useStateApp(() => localStorage.getItem('devos:nav') || 'home');
  const [collapsed, setCollapsed] = useStateApp(t.sidebarStart === 'collapsed');
  const [cmdkOpen,  setCmdkOpen]  = useStateApp(false);

  // Persistent timer
  const [timerSec, setTimerSec] = useStateApp(() => parseInt(localStorage.getItem('devos:timerSec') || '5760', 10));
  const [running,  setRunning]  = useStateApp(() => localStorage.getItem('devos:timerRunning') !== 'false');

  // Application data
  const [projects,       setProjects]       = useStateApp([]);
  const [tasks,          setTasks]          = useStateApp([]);
  const [notes,          setNotes]          = useStateApp([]);
  const [vault,          setVault]          = useStateApp([]);
  const [learning,       setLearning]       = useStateApp({ toLearn: [], inProgress: [], completed: [] });
  const [sessions,       setSessions]       = useStateApp([]);
  const [emailTemplates, setEmailTemplates] = useStateApp([]);
  const [ganttTasks,     setGanttTasks]     = useStateApp([]);

  // Persist nav + timer
  useEffectApp(() => { localStorage.setItem('devos:nav', current); }, [current]);
  useEffectApp(() => { localStorage.setItem('devos:timerSec', String(timerSec)); }, [timerSec]);
  useEffectApp(() => { localStorage.setItem('devos:timerRunning', String(running)); }, [running]);

  // Timer tick
  useEffectApp(() => {
    if (!running) return;
    const id = setInterval(() => setTimerSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Keyboard shortcuts
  useEffectApp(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdkOpen(o => !o); return; }
      if (e.key === 'Escape' && cmdkOpen) { setCmdkOpen(false); return; }
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.key.toLowerCase() === 'g') {
        const handler = (e2) => {
          const map = { h:'home',p:'projects',t:'tasks',l:'learning',v:'vault',m:'pm',n:'notes',i:'timer',e:'email',d:'toolkit' };
          const id = map[e2.key.toLowerCase()];
          if (id) setCurrent(id);
          window.removeEventListener('keydown', handler);
        };
        window.addEventListener('keydown', handler, { once: true });
        setTimeout(() => window.removeEventListener('keydown', handler), 1500);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdkOpen]);

  // Apply tweaks via CSS vars
  useEffectApp(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    const hexToRgba = (hex, alpha) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return '';
      return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${alpha})`;
    };
    root.style.setProperty('--accent-tint',   hexToRgba(t.accent, 0.12));
    root.style.setProperty('--accent-tint-2', hexToRgba(t.accent, 0.22));
    root.style.setProperty('--f-mono',    `'${t.monoFont}', ui-monospace, monospace`);
    root.style.setProperty('--f-display', `'${t.headingFont}', ui-sans-serif, sans-serif`);
    if (t.surface === 'charcoal') {
      root.style.setProperty('--bg-0', '#15151a');
      root.style.setProperty('--bg-1', '#1a1a20');
      root.style.setProperty('--bg-2', '#1f1f26');
      root.style.setProperty('--bg-3', '#252530');
    } else {
      root.style.setProperty('--bg-0', '#0a0a0a');
      root.style.setProperty('--bg-1', '#0e0e0e');
      root.style.setProperty('--bg-2', '#121212');
      root.style.setProperty('--bg-3', '#181818');
    }
    document.body.classList.toggle('texture-grid', !!t.texture);
    document.body.classList.toggle('scanlines', !!t.scanlines);
  }, [t.accent, t.monoFont, t.headingFont, t.surface, t.texture, t.scanlines]);

  // ── Gates ───────────────────────────────────────────────────────
  if (authLoading || wsLoading || dataLoading) return <Loading />;
  if (!authUser)                return <AuthPage onAuth={handleAuth} />;

  if (showWsSetup) return (
    <WorkstationSetup
      isFirst={workstations.length === 0}
      onCreated={handleWsCreated}
      onCancel={workstations.length > 0 ? () => setShowWsSetup(false) : null}
    />
  );

  const timer        = { running, display: FORMAT_TIME(timerSec), label: running ? 'KMBL-17' : 'Idle' };
  const onToggleTimer = () => setRunning(r => !r);
  const onResetTimer  = () => { setTimerSec(0); setRunning(false); };

  return (
    <div className={'app' + (collapsed ? ' collapsed' : '') + (t.density === 'compact' ? ' dense' : '')}>
      <Sidebar
        current={current}
        onNav={setCurrent}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(c => !c)}
        user={authUser}
        onLogout={handleLogout}
        workstations={workstations}
        activeWorkstation={activeWorkstation}
        onWsSwitch={handleWsSwitch}
        onNewWs={handleNewWs}
      />
      <div className="main">
        <Topbar onOpenCmdK={() => setCmdkOpen(true)} timer={timer} onTimerJump={() => setCurrent('timer')} />
        <div className="content" key={current}>
          <PageRouter
            current={current}
            timer={timer}
            onNav={setCurrent}
            onToggle={onToggleTimer}
            workstationId={activeWorkstation?.id}
            projects={projects}       setProjects={setProjects}
            tasks={tasks}             setTasks={setTasks}
            notes={notes}             setNotes={setNotes}
            vault={vault}             setVault={setVault}
            learning={learning}       setLearning={setLearning}
            sessions={sessions}
            emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates}
            ganttTasks={ganttTasks}
          />
        </div>
      </div>
      <CmdPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} onNav={setCurrent} />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent}
          options={['#0099ff','#0175C2','#7C3AED','#16A34A','#D97706','#EF4444']}
          onChange={v => setTweak('accent', v)} />
        <TweakRadio label="Surface" value={t.surface}
          options={[{value:'true-black',label:'True black'},{value:'charcoal',label:'Charcoal'}]}
          onChange={v => setTweak('surface', v)} />
        <TweakToggle label="Grid texture" value={t.texture} onChange={v => setTweak('texture', v)} />
        <TweakToggle label="Scanlines (CRT)" value={t.scanlines} onChange={v => setTweak('scanlines', v)} />

        <TweakSection label="Typography" />
        <TweakSelect label="Heading" value={t.headingFont}
          options={['Syne','Space Grotesk','JetBrains Mono','IBM Plex Sans']}
          onChange={v => setTweak('headingFont', v)} />
        <TweakSelect label="Mono" value={t.monoFont}
          options={['IBM Plex Mono','JetBrains Mono','Geist Mono','Space Mono']}
          onChange={v => setTweak('monoFont', v)} />

        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
          options={[{value:'regular',label:'Regular'},{value:'compact',label:'Compact'}]}
          onChange={v => setTweak('density', v)} />
        <TweakButton label="Reset timer" onClick={onResetTimer} />
      </TweaksPanel>
    </div>
  );
}

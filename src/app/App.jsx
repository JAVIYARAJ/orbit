import { useState as useStateApp, useEffect as useEffectApp } from 'react';
import { Sidebar, Topbar, CmdPalette } from '../components/shell.jsx';
import {
  TweaksPanel, TweakSection, TweakColor, TweakRadio,
  TweakToggle, TweakSelect, TweakButton, useTweaks,
} from '../components/tweaks-panel.jsx';
import { supabase } from '../lib/supabase.js';
import {
  loadUserData, getMyContext, updateMyAvatar,
  setActiveWorkstation as persistActiveWs, loadTaskNoteLinks,
  startTimeEntry, pauseTimeEntry, resumeTimeEntry,
  completeTimeEntry, discardTimeEntry, getTimeEntries, getActiveTimeEntry,
  logManualTime,
} from '../lib/db.js';
import { WorkstationSetup } from '../components/workstation-setup.jsx';
import { HomePage, ProjectsPage, TasksPage, LearningPage, VaultPage } from '../pages/workspace.jsx';
import { ProjectMgmtPage, NotesPage, TimerPage, EmailPage, ToolkitPage } from '../pages/tools.jsx';
import { FlutterInitPage } from '../pages/flutter-init.jsx';
import { GitHubPage } from '../pages/github.jsx';
import { Analytics } from '../pages/analytics.jsx';
import { Collaboration } from '../pages/collaboration.jsx';
import { Settings } from '../pages/settings.jsx';
import { AuthPage, ResetPasswordPage } from '../pages/auth.jsx';

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
    case 'toolkit':      return <ToolkitPage {...props} />;
    case 'flutter-init': return <FlutterInitPage {...props} />;
    case 'github':    return <GitHubPage {...props} />;
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
  const [authUser,         setAuthUser]         = useStateApp(null);
  const [authLoading,      setAuthLoading]      = useStateApp(true);
  const [dataLoading,      setDataLoading]      = useStateApp(false);
  const [showPasswordReset, setShowPasswordReset] = useStateApp(false);

  // ── Workstations ────────────────────────────────────────────────
  const [workstations,      setWorkstations]      = useStateApp([]);
  const [activeWorkstation, setActiveWorkstation] = useStateApp(null);
  const [wsLoading,         setWsLoading]         = useStateApp(false);
  const [showWsSetup,       setShowWsSetup]       = useStateApp(false);

  // Resolve Supabase session on mount.
  // onAuthStateChange fires INITIAL_SESSION synchronously, making getSession() redundant.
  // Handling everything here avoids the race condition between the two.
  useEffectApp(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
        setAuthLoading(false);
        return;
      }

      // GitHub OAuth callback — save provider_token to user_integrations
      if (event === 'SIGNED_IN' && session?.provider_token && localStorage.getItem('devos:gh_link') === '1') {
        const storedUid = localStorage.getItem('devos:pre_gh_uid');
        localStorage.removeItem('devos:gh_link');
        localStorage.removeItem('devos:pre_gh_uid');
        // Use stored UID so we always write to the original user's row
        const targetUid = storedUid || session.user.id;
        try {
          const ghUser = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${session.provider_token}`, Accept: 'application/vnd.github+json' },
          }).then(r => r.json());
          await supabase.from('user_integrations').upsert({
            user_id:      targetUid,
            provider:     'github',
            access_token: session.provider_token,
            username:     ghUser.login,
            display_name: ghUser.name,
            avatar_url:   ghUser.avatar_url,
            email:        ghUser.email,
            scopes:       ['repo', 'read:user', 'user:email'],
            metadata:     { html_url: ghUser.html_url, public_repos: ghUser.public_repos, followers: ghUser.followers, following: ghUser.following },
          }, { onConflict: 'user_id,provider' });
        } catch (e) {
          console.error('GitHub token save failed:', e);
        }
      }

      setAuthUser(session?.user ? buildUser(session.user) : null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const buildUser = (u) => {
    const name = u.user_metadata?.name || u.email.split('@')[0];
    return { id: u.id, name, email: u.email, avatar: name[0].toUpperCase() };
  };

  const handleAuth       = (user) => setAuthUser(user);
  const handleUserUpdate = (updates) => setAuthUser(prev => ({ ...prev, ...updates }));
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT will clear authUser; also reset workstation state
    setWorkstations([]);
    setActiveWorkstation(null);
    setShowWsSetup(false);
    setStatuses([]);
    setProjectTypes([]);
    setTags([]);
  };

  // ── Load GitHub token when user logs in ─────────────────────────
  useEffectApp(() => {
    if (!authUser?.id) { setGithubToken(null); return; }
    supabase.from('user_integrations')
      .select('access_token')
      .eq('user_id', authUser.id)
      .eq('provider', 'github')
      .maybeSingle()
      .then(({ data }) => setGithubToken(data?.access_token || null))
      .catch(() => setGithubToken(null));
  }, [authUser?.id]);

  // ── Load user context on login (profile + workstations + roles in one call) ──
  useEffectApp(() => {
    if (!authUser?.id) return;
    setWsLoading(true);
    getMyContext()
      .then(ctx => {
        // Enrich authUser with real profile data from the DB (not just auth metadata)
        setAuthUser({
          id:        ctx.user.id,
          name:      ctx.user.name      || authUser.name,
          email:     ctx.user.email     || authUser.email,
          avatar:    ctx.user.avatar    || (ctx.user.name?.[0] || 'U').toUpperCase(),
          avatarUrl: ctx.user.avatar_url || null,
          joinedAt:  ctx.user.joined_at,
        });

        const list = ctx.workstations;
        setWorkstations(list);

        if (list.length === 0) {
          setShowWsSetup(true);
        } else {
          // Prefer the workstation Supabase has as active, fall back to localStorage
          const savedId  = localStorage.getItem('devos:activeWs');
          const byServer = list.find(w => w.id === ctx.active_workstation_id);
          const byLocal  = list.find(w => w.id === savedId);
          setActiveWorkstation(byServer || byLocal || list[0]);
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
        setStatuses(d.statuses);
        setProjectTypes(d.projectTypes);
        setTags(d.tags);
        setProjects(d.projects);
        setTasks(d.tasks);
        setNoteFolders(d.noteFolders);
        setNotes(d.notes);
        setVault(d.vault);
        setLearning(d.learning);
        setSessions(d.sessions);
        setEmailTemplates(d.emailTemplates);
        setGanttTasks(d.ganttTasks);
        loadTaskNoteLinks(activeWorkstation.id).then(setTaskNoteLinks).catch(console.error);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));

    // Restore active timer entry (survives page refresh)
    getActiveTimeEntry(activeWorkstation.id).then(entry => {
      if (!entry) return;
      // If it was still marked 'running' in DB, leave it paused in UI
      // (we can't know elapsed since the last page load)
      setActiveEntry({ ...entry, status: 'paused' });
      setTimerSec(0);
      setRunning(false);
    }).catch(console.error);

    // Load completed entry history
    getTimeEntries(activeWorkstation.id).then(setTimeEntries).catch(console.error);
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

  // Navigation — redirect to settings if returning from GitHub OAuth
  const [current,   setCurrent]   = useStateApp(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gh_callback') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      return 'settings';
    }
    return localStorage.getItem('devos:nav') || 'home';
  });
  const [collapsed, setCollapsed] = useStateApp(t.sidebarStart === 'collapsed');
  const [cmdkOpen,  setCmdkOpen]  = useStateApp(false);

  // Time tracking state
  const [activeEntry, setActiveEntry] = useStateApp(null);   // running/paused entry
  const [timeEntries, setTimeEntries] = useStateApp([]);     // completed entries
  const [timerSec,    setTimerSec]    = useStateApp(0);      // elapsed in current segment
  const [running,     setRunning]     = useStateApp(false);  // is tick active

  // Application data
  const [statuses,       setStatuses]       = useStateApp([]);
  const [projectTypes,   setProjectTypes]   = useStateApp([]);
  const [tags,           setTags]           = useStateApp([]);
  const [projects,       setProjects]       = useStateApp([]);
  const [tasks,          setTasks]          = useStateApp([]);
  const [notes,          setNotes]          = useStateApp([]);
  const [noteFolders,    setNoteFolders]    = useStateApp([]);
  const [vault,          setVault]          = useStateApp([]);
  const [learning,       setLearning]       = useStateApp({ toLearn: [], inProgress: [], completed: [] });
  const [sessions,       setSessions]       = useStateApp([]);
  const [emailTemplates, setEmailTemplates] = useStateApp([]);
  const [ganttTasks,     setGanttTasks]     = useStateApp([]);
  const [taskNoteLinks,  setTaskNoteLinks]  = useStateApp({});
  const [githubToken,    setGithubToken]    = useStateApp(null);

  // Persist nav
  useEffectApp(() => { localStorage.setItem('devos:nav', current); }, [current]);

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
          const map = { h:'home',p:'projects',t:'tasks',l:'learning',v:'vault',m:'pm',n:'notes',i:'timer',e:'email',d:'toolkit',f:'flutter-init',g:'github',s:'settings' };
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

  if (showPasswordReset) return (
    <ResetPasswordPage onDone={() => {
      setShowPasswordReset(false);
      setAuthUser(null);
    }} />
  );

  if (!authUser)                return <AuthPage onAuth={handleAuth} />;

  if (showWsSetup) return (
    <WorkstationSetup
      isFirst={workstations.length === 0}
      onCreated={handleWsCreated}
      onCancel={workstations.length > 0 ? () => setShowWsSetup(false) : null}
    />
  );

  // ── Timer handlers ──────────────────────────────────────────────
  const handleTimerStart = async (projectId, taskId) => {
    const entry = await startTimeEntry(activeWorkstation.id, projectId, taskId || null);
    setActiveEntry(entry);
    setTimerSec(0);
    setRunning(true);
  };

  const handleTimerPause = async () => {
    if (!activeEntry) return;
    const updated = await pauseTimeEntry(activeEntry.id, timerSec);
    setActiveEntry(updated);
    setTimerSec(0);
    setRunning(false);
  };

  const handleTimerResume = async () => {
    if (!activeEntry) return;
    const updated = await resumeTimeEntry(activeEntry.id);
    setActiveEntry(updated);
    setTimerSec(0);
    setRunning(true);
  };

  const handleTimerStop = async (notes) => {
    if (!activeEntry) return;
    const completed = await completeTimeEntry(activeEntry.id, timerSec, notes);
    setTimeEntries(prev => [completed, ...prev]);
    setProjects(prev => prev.map(p =>
      p._dbId === completed.projectId
        ? { ...p, hoursLogged: +(p.hoursLogged + completed.totalSeconds / 3600).toFixed(4) }
        : p
    ));
    setActiveEntry(null);
    setTimerSec(0);
    setRunning(false);
  };

  const handleTimerDiscard = async () => {
    if (!activeEntry) return;
    await discardTimeEntry(activeEntry.id);
    setActiveEntry(null);
    setTimerSec(0);
    setRunning(false);
  };

  const handleLogManualTime = async (taskDbId, projDbId, minutes, notes) => {
    const entry = await logManualTime(activeWorkstation.id, projDbId, taskDbId, minutes, notes);
    setTimeEntries(prev => [entry, ...prev]);
    setProjects(prev => prev.map(p =>
      p._dbId === projDbId
        ? { ...p, hoursLogged: +(p.hoursLogged + entry.totalSeconds / 3600).toFixed(4) }
        : p
    ));
    setTasks(prev => prev.map(t =>
      t._dbId === taskDbId
        ? { ...t, loggedMinutes: (t.loggedMinutes || 0) + minutes }
        : t
    ));
  };

  const displaySec = (activeEntry?.totalSeconds || 0) + timerSec;
  const timer = {
    running,
    status:      activeEntry ? activeEntry.status : 'idle',
    display:     FORMAT_TIME(displaySec),
    activeEntry,
    label: activeEntry
      ? activeEntry.projectShort + (activeEntry.taskShort ? ' / ' + activeEntry.taskShort : '')
      : 'Idle',
  };

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
            user={authUser}
            onUserUpdate={handleUserUpdate}
            activeWorkstation={activeWorkstation}
            timer={timer}
            onNav={setCurrent}
            workstationId={activeWorkstation?.id}
            statuses={statuses}           setStatuses={setStatuses}
            projectTypes={projectTypes}   setProjectTypes={setProjectTypes}
            tags={tags}                   setTags={setTags}
            projects={projects}           setProjects={setProjects}
            tasks={tasks}                 setTasks={setTasks}
            notes={notes}                 setNotes={setNotes}
            noteFolders={noteFolders}     setNoteFolders={setNoteFolders}
            taskNoteLinks={taskNoteLinks}  setTaskNoteLinks={setTaskNoteLinks}
            vault={vault}                 setVault={setVault}
            learning={learning}           setLearning={setLearning}
            timeEntries={timeEntries}
            onTimerStart={handleTimerStart}
            onTimerPause={handleTimerPause}
            onTimerResume={handleTimerResume}
            onTimerStop={handleTimerStop}
            onTimerDiscard={handleTimerDiscard}
            onLogTime={handleLogManualTime}
            emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates}
            ganttTasks={ganttTasks}
            githubToken={githubToken}
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
        <TweakButton label="Discard timer" onClick={handleTimerDiscard} />
      </TweaksPanel>
    </div>
  );
}

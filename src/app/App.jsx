import { useState as useStateApp, useEffect as useEffectApp, useRef, useCallback as useCallbackApp } from 'react';
import { Sidebar, Topbar, CmdPalette } from '../components/shell.jsx';
import {
  TweaksPanel, TweakSection, TweakColor, TweakRadio,
  TweakToggle, TweakSelect, TweakButton, useTweaks,
} from '../components/tweaks-panel.jsx';
import { supabase } from '../lib/supabase.js';
import { ghSetWorkstationId, ghClearCache } from '../lib/github.js';
import { vcSetWorkstationId, vcClearCache } from '../lib/vercel.js';
import { gcalSetWorkstationId, gcalClearCache } from '../lib/googleCalendar.js';
import {
  loadUserData, getMyContext, updateMyAvatar,
  setActiveWorkstation as persistActiveWs, loadTaskNoteLinks,
  startTimeEntry, pauseTimeEntry, resumeTimeEntry,
  completeTimeEntry, discardTimeEntry, getTimeEntries, getActiveTimeEntry,
  logManualTime, getLearningActivity,
  listWorkspaceMembers, getPendingInvites, getWorkspacePermissions,
  getNotifications, markNotificationsRead, getUnreadNotificationsCount,
} from '../lib/db.js';
import { WorkstationSetup } from '../components/workstation-setup.jsx';
import { HomePage, ProjectsPage, TasksPage, LearningPage, VaultPage } from '../pages/workspace.jsx';
import { ProjectMgmtPage, NotesPage, TimerPage, EmailPage } from '../pages/tools.jsx';
import { GitHubPage } from '../pages/github.jsx';
import { VercelPage } from '../pages/vercel.jsx';
import { Analytics } from '../pages/analytics.jsx';
import { Collaboration } from '../pages/collaboration.jsx';
import { CalendarPage } from '../pages/calendar.jsx';
import { Settings } from '../pages/settings.jsx';
import { AuthPage, ResetPasswordPage, InviteAcceptPage } from '../pages/auth.jsx';
import { LandingPage } from '../pages/landing.jsx';
import { PrivacyPolicy } from '../pages/privacy.jsx';
import { ContactPage } from '../pages/contact.jsx';
import { AdminApp } from '../admin/AdminApp.jsx';
import { RoleChooser } from '../pages/role-chooser.jsx';

// Client-side admin allowlist (UX gate only — the real check is server-side in
// the `admin` Edge Function, which verifies the JWT + email before using the
// service-role key). Comma-separated VITE_ADMIN_EMAILS overrides the default.
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || 'javiyaraj4@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function AdminForbidden({ email, onHome }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0f0f0f', color: '#e7e7ea', fontFamily: 'system-ui', gap: 14, textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>Admin access required</div>
      <div style={{ color: '#8b8b93', maxWidth: 420 }}>
        You’re signed in as <b>{email}</b>, which isn’t an admin account. This area is restricted.
      </div>
      <button onClick={onHome} style={{ marginTop: 8, padding: '10px 18px', borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 700, border: 0, cursor: 'pointer' }}>
        Back to app
      </button>
    </div>
  );
}
import { useRemoteConfig } from '../lib/useRemoteConfig.js';
import { canAccessModule } from '../lib/permissions.js';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#0099ff",
  "density": "regular",
  "sidebarStart": "expanded",
  "monoFont": "IBM Plex Mono",
  "headingFont": "Syne",
  "surface": "true-black",
  "texture": false,
  "scanlines": false,
  "theme": "dark"
}/*EDITMODE-END*/;

const FORMAT_TIME = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Strip OAuth artifacts left in the URL after a redirect sign-in: the PKCE
// `?code`/`?state` query params and any leftover `#` fragment (from the old
// implicit flow). Only auth-related params are removed — unrelated params
// (e.g. ?invite=) are preserved. Safe to call repeatedly: it's a no-op when
// there's nothing to clean. Run only AFTER the session is established so the
// code is never stripped before Supabase exchanges it.
const cleanOAuthUrl = () => {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  let changed = false;
  for (const p of ['code', 'state', 'error', 'error_code', 'error_description']) {
    if (u.searchParams.has(p)) { u.searchParams.delete(p); changed = true; }
  }
  if (u.hash) { u.hash = ''; changed = true; }
  if (changed) {
    const qs = u.searchParams.toString();
    window.history.replaceState({}, '', u.pathname + (qs ? `?${qs}` : ''));
  }
};

function PageRouter({ current, ...props }) {
  switch (current) {
    case 'projects':  return <ProjectsPage {...props} />;
    case 'tasks':     return <TasksPage {...props} />;
    case 'calendar':  return <CalendarPage {...props} />;
    case 'learning':  return <LearningPage {...props} />;
    case 'vault':     return <VaultPage {...props} />;
    case 'pm':        return <ProjectMgmtPage {...props} />;
    case 'notes':     return <NotesPage {...props} />;
    case 'timer':     return <TimerPage {...props} />;
    case 'email':     return <EmailPage {...props} />;
    case 'github':    return <GitHubPage {...props} />;
    case 'vercel':    return <VercelPage {...props} />;
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
  const enabledModules = useRemoteConfig();

  // ── Auth ────────────────────────────────────────────────────────
  const [authUser,         setAuthUser]         = useStateApp(null);
  const [authLoading,      setAuthLoading]      = useStateApp(true);
  const [dataLoading,      setDataLoading]      = useStateApp(false);
  const [showPasswordReset, setShowPasswordReset] = useStateApp(false);

  // ── URL routing (top-level flow) ────────────────────────────────
  // Real browser-history routes so the address bar matches the view and a
  // refresh / typed-in URL lands on the right page:
  //   /  → landing      /auth → sign-in      /app → dashboard
  const [route, setRoute] = useStateApp(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname || '/'
  );

  // True when the page loaded from an OAuth / email-confirmation redirect
  // (Supabase returns to the origin with ?code or a token hash). Once the
  // session resolves we forward these visits straight to /app.
  const hadAuthCallbackRef = useRef(
    typeof window !== 'undefined' && (() => {
      const u = new URL(window.location.href);
      const hasParam = ['code', 'state', 'error', 'error_code', 'error_description']
        .some((p) => u.searchParams.has(p));
      const hasHashToken = u.hash.includes('access_token') && !u.hash.includes('type=recovery');
      return hasParam || hasHashToken;
    })()
  );

  const navigate = useCallbackApp((to) => {
    if (typeof window !== 'undefined' && window.location.pathname !== to) {
      window.history.pushState({}, '', to);
    }
    setRoute(to);
  }, []);

  // Admin status from the DB flag (UX gate only; the Edge Function enforces it).
  const [isAdminFlag, setIsAdminFlag] = useStateApp(false);

  // For accounts that are BOTH user and admin, a post-login chooser decides
  // which surface to enter. Persisted per browser session; cleared on logout.
  const [roleChoice, setRoleChoice] = useStateApp(() =>
    (typeof window !== 'undefined' && sessionStorage.getItem('orbit:roleChoice')) || null
  );
  const chooseRole = (r) => {
    sessionStorage.setItem('orbit:roleChoice', r);
    setRoleChoice(r);
    navigate(r === 'admin' ? '/admin' : '/app');
  };

  // ── Workstations ────────────────────────────────────────────────
  const [workstations,      setWorkstations]      = useStateApp([]);
  const [activeWorkstation, setActiveWorkstation] = useStateApp(null);
  const [wsLoading,         setWsLoading]         = useStateApp(false);
  const [showWsSetup,       setShowWsSetup]       = useStateApp(false);
  // Tracks whether workstations are loaded for the current user.
  // Used to guard against TOKEN_REFRESHED re-triggering the wsLoading spinner.
  const wsReadyRef = useRef(false);

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

      const hasUser = !!session?.user;
      // Session is now established (PKCE code already exchanged) — safe to strip
      // the leftover ?code / # from the URL without breaking the sign-in.
      if (hasUser) cleanOAuthUrl();
      setAuthUser(hasUser ? buildUser(session.user) : null);
      // Pre-set wsLoading only when workstations aren't loaded yet (new login / page load).
      // Skips TOKEN_REFRESHED and similar events that fire on tab focus — those must NOT
      // set wsLoading=true because the workstation effect won't re-run (same user id),
      // which would leave the spinner stuck permanently.
      if (hasUser && !wsReadyRef.current) setWsLoading(true);
      if (!hasUser) wsReadyRef.current = false;
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Keep route state in sync with browser back/forward.
  useEffectApp(() => {
    const onPop = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Read the signed-in user's profiles.is_admin flag for the /admin UI gate.
  useEffectApp(() => {
    if (!authUser?.id) { setIsAdminFlag(false); return; }
    let alive = true;
    supabase.from('profiles').select('is_admin').eq('id', authUser.id).maybeSingle()
      .then(({ data }) => { if (alive) setIsAdminFlag(!!data?.is_admin); })
      .catch(() => { if (alive) setIsAdminFlag(false); });
    return () => { alive = false; };
  }, [authUser?.id]);

  // Forward OAuth / email-confirmation landings into the app once signed in.
  useEffectApp(() => {
    if (authUser && hadAuthCallbackRef.current) {
      hadAuthCallbackRef.current = false;
      navigate('/app');
    }
  }, [authUser, navigate]);

  // Route guards: keep signed-out users out of protected paths, and keep
  // signed-in users off /auth (and off any unknown path) by sending them to /app.
  useEffectApp(() => {
    if (authLoading) return;
    const isPublic = route === '/' || route === '/auth' || route === '/reset-password' || route === '/privacy' || route === '/contact';
    if (route === '/auth' && authUser) { navigate('/app'); return; }
    if (!isPublic && !authUser) { navigate('/auth'); return; }
    if (!isPublic && authUser && route !== '/app' && !route.startsWith('/admin')) navigate('/app');
  }, [route, authUser, authLoading, navigate]);

  const buildUser = (u) => {
    const name = u.user_metadata?.name || u.email.split('@')[0];
    return { id: u.id, name, email: u.email, avatar: name[0].toUpperCase() };
  };

  const handleAuth       = (user) => { setAuthUser(user); navigate('/app'); };
  const handleUserUpdate = (updates) => setAuthUser(prev => ({ ...prev, ...updates }));
  const handleLogout = async () => {
    wsReadyRef.current = false;
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT will clear authUser; also reset workstation state
    setWorkstations([]);
    setActiveWorkstation(null);
    setShowWsSetup(false);
    setStatuses([]);
    setProjectTypes([]);
    setPriorities([]);
    setTags([]);
    sessionStorage.removeItem('orbit:roleChoice');
    setRoleChoice(null);
    navigate('/');
  };

  // ── Check GitHub + Vercel connection at workspace level ──────────
  // All workspace members see the same connection status — tokens are workspace-scoped.
  useEffectApp(() => {
    if (!authUser?.id || !activeWorkstation?.id) { setIsGithubConnected(false); return; }
    ghSetWorkstationId(activeWorkstation.id);
    vcSetWorkstationId(activeWorkstation.id);
    gcalSetWorkstationId(activeWorkstation.id);
    supabase
      .from('workspace_integrations')
      .select('provider')
      .eq('workstation_id', activeWorkstation.id)
      .then(({ data }) => {
        const providers = (data || []).map(r => r.provider);
        setIsGithubConnected(providers.includes('github'));
      })
      .catch(() => setIsGithubConnected(false));
  }, [authUser?.id, activeWorkstation?.id]);

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

        wsReadyRef.current = true;
        if (list.length === 0) {
          setShowWsSetup(true);
          setWsLoading(false);
        } else {
          // Prefer the workstation Supabase has as active, fall back to localStorage
          const savedId  = localStorage.getItem('orbit:activeWs');
          const byServer = list.find(w => w.id === ctx.active_workstation_id);
          const byLocal  = list.find(w => w.id === savedId);
          // Pre-set dataLoading and clear wsLoading in the same batch as setActiveWorkstation
          // so the gate (wsLoading || dataLoading) stays true with no gap render.
          setDataLoading(true);
          setWsLoading(false);
          setActiveWorkstation(byServer || byLocal || list[0]);
        }
      })
      .catch(e => { console.error(e); setWsLoading(false); });

    // Load notifications on login
    getNotifications().then(setNotifications).catch(() => {});
    getUnreadNotificationsCount().then(setUnreadCount).catch(() => {});
  }, [authUser?.id]);

  // ── Realtime: notification inserts for the current user ─────────
  useEffectApp(() => {
    if (!authUser?.id) return;
    const ch = supabase
      .channel(`notifications-${authUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${authUser.id}`,
      }, () => {
        getNotifications().then(setNotifications).catch(() => {});
        getUnreadNotificationsCount().then(setUnreadCount).catch(() => {});
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [authUser?.id]);

  // ── Load data when active workstation changes ───────────────────
  useEffectApp(() => {
    if (!activeWorkstation?.id) return;
    localStorage.setItem('orbit:activeWs', activeWorkstation.id);
    setDataLoading(true);
    loadUserData(activeWorkstation.id)
      .then(d => {
        setStatuses(d.statuses);
        setProjectTypes(d.projectTypes);
        setPriorities(d.priorities);
        setTags(d.tags);
        setProjects(d.projects);
        setTasks(d.tasks);
        setNoteFolders(d.noteFolders);
        setNotes(d.notes);
        setVault(d.vault);
        setLearning(d.learning);
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

    // Load past year of learning activity for analytics
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    getLearningActivity(activeWorkstation.id, yearAgo.toISOString().split('T')[0])
      .then(setLearningActivity).catch(console.error);

    // Load team collaboration data
    listWorkspaceMembers(activeWorkstation.id).then(setMembers).catch(console.error);
    getPendingInvites(activeWorkstation.id).then(setPendingInvites).catch(console.error);
    getWorkspacePermissions(activeWorkstation.id).then(setWsPermissions).catch(console.error);
  }, [activeWorkstation?.id]);

  // Realtime: update members and pending invites when someone accepts an invite
  useEffectApp(() => {
    if (!activeWorkstation?.id) return;
    const wsId = activeWorkstation.id;

    const channel = supabase
      .channel(`collab-${wsId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'workstation_members',
        filter: `workstation_id=eq.${wsId}`,
      }, () => {
        listWorkspaceMembers(wsId).then(setMembers).catch(() => {});
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspace_invites',
        filter: `workstation_id=eq.${wsId}`,
      }, () => {
        getPendingInvites(wsId).then(setPendingInvites).catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeWorkstation?.id]);

  // Refresh my role + workspace permissions when the tab regains focus. Lets a
  // role change or permission toggle an owner makes while you're active take effect
  // without a full reload (the server is the real gate; this keeps the UI honest).
  useEffectApp(() => {
    if (!authUser?.id || !activeWorkstation?.id) return;
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        getMyContext().then(ctx => setWorkstations(ctx.workstations)).catch(() => {});
        getWorkspacePermissions(activeWorkstation.id).then(setWsPermissions).catch(() => {});
        listWorkspaceMembers(activeWorkstation.id).then(setMembers).catch(() => {});
        getPendingInvites(activeWorkstation.id).then(setPendingInvites).catch(() => {});
      }, 300);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authUser?.id, activeWorkstation?.id]);

  // Workstation handlers
  const handleMarkRead = async (ids) => {
    if (!ids?.length) return;
    await markNotificationsRead(ids).catch(() => {});
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - ids.filter(id => notifications.find(n => n.id === id && !n.readAt)).length));
  };

  const handleWsCreated = (ws) => {
    setWorkstations(prev => [...prev, ws]);
    setActiveWorkstation(ws);
    setShowWsSetup(false);
  };

  const handleWsSwitch = (ws) => {
    if (ws.id === activeWorkstation?.id) return;
    setActiveWorkstation(ws);
    ghSetWorkstationId(ws.id);
    vcSetWorkstationId(ws.id);
    gcalSetWorkstationId(ws.id);
    ghClearCache();
    vcClearCache();
    gcalClearCache();
    persistActiveWs(ws.id).catch(console.error);
  };

  const handleNewWs = () => setShowWsSetup(true);

  // Re-pull roles + permissions + members for the active workstation. Called after
  // actions that change the current user's standing (e.g. ownership transfer) so the
  // UI reflects the new role immediately instead of waiting for the next focus refresh.
  const refreshWorkspaceContext = async () => {
    try {
      const ctx = await getMyContext();
      setWorkstations(ctx.workstations);
    } catch { /* non-fatal */ }
    if (activeWorkstation?.id) {
      getWorkspacePermissions(activeWorkstation.id).then(setWsPermissions).catch(() => {});
      listWorkspaceMembers(activeWorkstation.id).then(setMembers).catch(() => {});
    }
  };

  // Navigation — redirect to settings if returning from GitHub or Vercel OAuth
  const [jumpToItem, setJumpToItem] = useStateApp(null);

  const [current,   setCurrent]   = useStateApp(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gh_callback') === '1' || params.get('vc_callback') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      return 'settings';
    }
    const inviteToken = params.get('invite');
    if (inviteToken) {
      localStorage.setItem('orbit:pendingInvite', inviteToken);
      // Strip only the invite param, preserving any other query params.
      params.delete('invite');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
    return localStorage.getItem('orbit:nav') || 'home';
  });
  const [collapsed, setCollapsed] = useStateApp(t.sidebarStart === 'collapsed');
  const [cmdkOpen,  setCmdkOpen]  = useStateApp(false);
  const [mobileNavOpen, setMobileNavOpen] = useStateApp(false);

  // Mobile drawer: lock body scroll while open; auto-close when the viewport
  // grows back past the mobile breakpoint (768px) so it can't get stuck open.
  useEffectApp(() => {
    if (!mobileNavOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    const onResize = () => { if (window.innerWidth > 768) setMobileNavOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [mobileNavOpen]);

  // Time tracking state
  const [activeEntry, setActiveEntry] = useStateApp(null);   // running/paused entry
  const [timeEntries, setTimeEntries] = useStateApp([]);     // completed entries
  const [timerSec,    setTimerSec]    = useStateApp(0);      // elapsed in current segment
  const [running,     setRunning]     = useStateApp(false);  // is tick active

  // Application data
  const [statuses,       setStatuses]       = useStateApp([]);
  const [projectTypes,   setProjectTypes]   = useStateApp([]);
  const [priorities,     setPriorities]     = useStateApp([]);
  const [tags,           setTags]           = useStateApp([]);
  const [projects,       setProjects]       = useStateApp([]);
  const [tasks,          setTasks]          = useStateApp([]);
  const [notes,          setNotes]          = useStateApp([]);
  const [noteFolders,    setNoteFolders]    = useStateApp([]);
  const [vault,          setVault]          = useStateApp([]);
  const [learning,       setLearning]       = useStateApp({ toLearn: [], inProgress: [], completed: [] });
  const [learningActivity, setLearningActivity] = useStateApp([]);
  const [emailTemplates, setEmailTemplates] = useStateApp([]);
  const [ganttTasks,     setGanttTasks]     = useStateApp([]);
  const [taskNoteLinks,  setTaskNoteLinks]  = useStateApp({});
  const [isGithubConnected, setIsGithubConnected] = useStateApp(false);
  const [notifications,     setNotifications]     = useStateApp([]);
  const [unreadCount,       setUnreadCount]       = useStateApp(0);

  // ── Team collaboration ──────────────────────────────────────────
  const [members,        setMembers]        = useStateApp([]);
  const [pendingInvites, setPendingInvites] = useStateApp([]);
  const [wsPermissions,  setWsPermissions]  = useStateApp({});

  // Derive current user's role in the active workstation (used for permission gating)
  const myRole = activeWorkstation
    ? (workstations.find(w => w.id === activeWorkstation.id)?.role || 'viewer')
    : 'viewer';

  // Invite token from URL (?invite=TOKEN) — stored in localStorage across auth redirects
  const [pendingInviteToken, setPendingInviteToken] = useStateApp(
    () => localStorage.getItem('orbit:pendingInvite') || null
  );

  // Persist nav
  useEffectApp(() => { localStorage.setItem('orbit:nav', current); }, [current]);

  // Redirect to home if the active page is disabled via Remote Config
  // or the current role isn't permitted to access it.
  useEffectApp(() => {
    if (enabledModules[current] === false) { setCurrent('home'); return; }
    if (!canAccessModule(myRole, current, wsPermissions)) setCurrent('home');
  }, [enabledModules, current, myRole, wsPermissions]);

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
          const map = { h:'home',p:'projects',t:'tasks',l:'learning',v:'vault',m:'pm',n:'notes',i:'timer',e:'email',g:'github',k:'vercel',s:'settings' };
          const id = map[e2.key.toLowerCase()];
          if (id && enabledModules[id] !== false && canAccessModule(myRole, id, wsPermissions)) setCurrent(id);
          window.removeEventListener('keydown', handler);
        };
        window.addEventListener('keydown', handler, { once: true });
        setTimeout(() => window.removeEventListener('keydown', handler), 1500);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdkOpen, enabledModules, myRole, wsPermissions]);

  // Apply tweaks via CSS vars
  useEffectApp(() => {
    const root = document.documentElement;
    const isLight = (t.theme || 'dark') === 'light';

    root.setAttribute('data-theme', isLight ? 'light' : 'dark');

    const hexToRgba = (hex, alpha) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return '';
      return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${alpha})`;
    };

    // Accent (same in both themes)
    root.style.setProperty('--accent',       t.accent);
    root.style.setProperty('--accent-tint',  hexToRgba(t.accent, 0.12));
    root.style.setProperty('--accent-tint-2',hexToRgba(t.accent, 0.22));

    // Fonts (same in both themes)
    root.style.setProperty('--f-mono',    `'${t.monoFont}', ui-monospace, monospace`);
    root.style.setProperty('--f-display', `'${t.headingFont}', ui-sans-serif, sans-serif`);

    if (isLight) {
      // ── Light surfaces ──────────────────────────────────────────
      // bg-0 = page canvas (slightly gray so cards lift off it)
      // bg-1 = elevated surface: cards, panels, sidebar (white)
      // bg-2 = secondary surface inside cards: inputs, nested content
      // bg-3 = hover/active tint, tag backgrounds
      // bg-4 = strong divider or active chip background
      root.style.setProperty('--bg-0',  '#f0f0f5');   // page background
      root.style.setProperty('--bg-1',  '#ffffff');   // cards, panels, sidebar
      root.style.setProperty('--bg-2',  '#f5f5f8');   // inner content, inputs
      root.style.setProperty('--bg-3',  '#eaeaef');   // hover, nested bg
      root.style.setProperty('--bg-4',  '#dfdfe8');   // active chip, strong divider
      // Borders — visible but not harsh
      root.style.setProperty('--border',   '#e2e2ec');
      root.style.setProperty('--border-2', '#d0d0dc');
      root.style.setProperty('--border-3', '#bcbccc');
      // Text — proper contrast hierarchy on white
      root.style.setProperty('--text',   '#111118');  // primary — near-black
      root.style.setProperty('--text-2', '#44445a');  // secondary
      root.style.setProperty('--text-3', '#7a7a8e');  // muted labels
      root.style.setProperty('--text-4', '#aaaabb');  // placeholders, disabled
      // Glass — just solid in light mode, no blur effect
      root.style.setProperty('--glass-bg',     '#ffffff');
      root.style.setProperty('--glass-border', '#e2e2ec');
    } else {
      // ── Dark surfaces ───────────────────────────────────────────
      if (t.surface === 'charcoal') {
        root.style.setProperty('--bg-0', '#15151a');
        root.style.setProperty('--bg-1', '#1a1a20');
        root.style.setProperty('--bg-2', '#1f1f26');
        root.style.setProperty('--bg-3', '#252530');
        root.style.setProperty('--bg-4', '#2b2b38');
      } else {
        root.style.setProperty('--bg-0', '#09090b');
        root.style.setProperty('--bg-1', '#0f0f14');
        root.style.setProperty('--bg-2', '#14141b');
        root.style.setProperty('--bg-3', '#1a1a23');
        root.style.setProperty('--bg-4', '#212129');
      }
      root.style.setProperty('--border',   '#242430');
      root.style.setProperty('--border-2', '#2d2d3a');
      root.style.setProperty('--border-3', '#35353f');
      root.style.setProperty('--text',   '#f0f0f2');
      root.style.setProperty('--text-2', '#a0a0a8');
      root.style.setProperty('--text-3', '#6a6a78');
      root.style.setProperty('--text-4', '#45454f');
      root.style.setProperty('--glass-bg',     'rgba(15,15,20,0.75)');
      root.style.setProperty('--glass-border', 'rgba(36,36,48,0.5)');
    }

    document.body.classList.toggle('texture-grid', !!t.texture && !isLight);
    document.body.classList.toggle('scanlines',    !!t.scanlines && !isLight);
  }, [t.accent, t.monoFont, t.headingFont, t.surface, t.texture, t.scanlines, t.theme]);

  // ── Gates ───────────────────────────────────────────────────────
  const isAdmin = !!authUser && (isAdminFlag || ADMIN_EMAILS.includes((authUser.email || '').toLowerCase()));
  if (authLoading) return <Loading />;

  // Password recovery (Supabase recovery link) takes over regardless of path.
  if (showPasswordReset) return (
    <ResetPasswordPage onDone={() => {
      setShowPasswordReset(false);
      setAuthUser(null);
      navigate('/auth');
    }} />
  );

  // /  → marketing landing, shown for everyone (logged in or not).
  if (route === '/') return <LandingPage onEnter={() => navigate('/auth')} onNavigate={navigate} />;

  // /privacy → public legal page.
  if (route === '/privacy') return <PrivacyPolicy onNavigate={navigate} />;

  // /contact → public contact / feedback form.
  if (route === '/contact') return <ContactPage onNavigate={navigate} />;

  // /auth → sign-in. A logged-in visitor is forwarded to /app by the guard
  // effect; render the loader during that brief transition.
  if (route === '/auth') return authUser ? <Loading /> : <AuthPage onAuth={handleAuth} />;

  // /admin → admin panel, separate from the user app. Requires a signed-in
  // admin; rendered before workspace data loads so admins without a workspace
  // aren't pushed into setup. Real authorization is enforced server-side.
  if (route.startsWith('/admin')) {
    if (!authUser) return <Loading />;          // guard effect redirects to /auth
    if (!isAdmin) return <AdminForbidden email={authUser.email} onHome={() => navigate('/app')} />;
    return <AdminApp user={authUser} onExit={() => navigate('/app')} />;
  }

  // Any other path is the authenticated app. The guard effect sends signed-out
  // users to /auth; show the loader until that redirect lands.
  if (!authUser) return <Loading />;

  // Accounts that are both user AND admin pick a surface once per session.
  // Non-admins skip this entirely and go straight to the app.
  if (isAdmin && !roleChoice) {
    return <RoleChooser user={authUser} onUser={() => chooseRole('user')} onAdmin={() => chooseRole('admin')} />;
  }

  // The app needs its workspace data; the admin panel above does not.
  if (wsLoading || dataLoading) return <Loading />;

  // A pending invite takes precedence over first-run workspace setup — otherwise a
  // brand-new user invited to a workspace would be forced to create one of their own
  // (with no way to cancel) before they could accept.
  if (pendingInviteToken) return (
    <InviteAcceptPage
      token={pendingInviteToken}
      user={authUser}
      onAccepted={async (result) => {
        localStorage.removeItem('orbit:pendingInvite');
        setPendingInviteToken(null);
        // Reload workstations so the newly joined one appears
        const ctx = await getMyContext();
        const list = ctx.workstations;
        setWorkstations(list);
        // Activate the workspace we just joined (match by id, don't assume ordering)
        const joinedId = result?.workstation_id || result?.workspace_id;
        const joined = (joinedId && list.find(w => w.id === joinedId)) || list[list.length - 1];
        if (joined) {
          setActiveWorkstation(joined);
          setShowWsSetup(false);
        }
      }}
      onDeclined={() => {
        localStorage.removeItem('orbit:pendingInvite');
        setPendingInviteToken(null);
      }}
    />
  );

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

  const handleSearchSelect = (page, id) => {
    setCurrent(page);
    setJumpToItem({ page, id, ts: Date.now() });
    setCmdkOpen(false);
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
    <div className={'app' + (collapsed ? ' collapsed' : '') + (t.density === 'compact' ? ' dense' : '') + (mobileNavOpen ? ' drawer-open' : '')}>
      <Sidebar
        current={current}
        onNav={(id) => { setCurrent(id); setMobileNavOpen(false); }}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(c => !c)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        user={authUser}
        onLogout={handleLogout}
        workstations={workstations}
        activeWorkstation={activeWorkstation}
        onWsSwitch={handleWsSwitch}
        onNewWs={handleNewWs}
        enabledModules={enabledModules}
        myRole={myRole}
        wsPermissions={wsPermissions}
      />
      <div className="main">
        <Topbar
          onOpenCmdK={() => setCmdkOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          timer={timer}
          onTimerJump={() => setCurrent('timer')}
          theme={t.theme || 'dark'}
          onThemeToggle={() => setTweak('theme', t.theme === 'light' ? 'dark' : 'light')}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkRead={handleMarkRead}
          onNav={setCurrent}
          onSelectTask={(taskDbId) => handleSearchSelect('tasks', taskDbId)}
        />
        <div className="content" key={current}>
          <PageRouter
            current={current}
            user={authUser}
            onUserUpdate={handleUserUpdate}
            activeWorkstation={activeWorkstation}
            timer={timer}
            onNav={setCurrent}
            onJump={handleSearchSelect}
            workstationId={activeWorkstation?.id}
            statuses={statuses}           setStatuses={setStatuses}
            projectTypes={projectTypes}   setProjectTypes={setProjectTypes}
            priorities={priorities}       setPriorities={setPriorities}
            tags={tags}                   setTags={setTags}
            projects={projects}           setProjects={setProjects}
            tasks={tasks}                 setTasks={setTasks}
            notes={notes}                 setNotes={setNotes}
            noteFolders={noteFolders}     setNoteFolders={setNoteFolders}
            taskNoteLinks={taskNoteLinks}  setTaskNoteLinks={setTaskNoteLinks}
            vault={vault}                 setVault={setVault}
            learning={learning}           setLearning={setLearning}
            learningActivity={learningActivity}
            timeEntries={timeEntries}
            onTimerStart={handleTimerStart}
            onTimerPause={handleTimerPause}
            onTimerResume={handleTimerResume}
            onTimerStop={handleTimerStop}
            onTimerDiscard={handleTimerDiscard}
            onLogTime={handleLogManualTime}
            emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates}
            ganttTasks={ganttTasks}        setGanttTasks={setGanttTasks}
            isGithubConnected={isGithubConnected}
            jumpToItem={jumpToItem}
            members={members}             setMembers={setMembers}
            pendingInvites={pendingInvites} setPendingInvites={setPendingInvites}
            wsPermissions={wsPermissions}  setWsPermissions={setWsPermissions}
            myRole={myRole}
            refreshWorkspaceContext={refreshWorkspaceContext}
          />
        </div>
      </div>
      <CmdPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNav={setCurrent}
        enabledModules={enabledModules}
        searchData={{ tasks, projects, notes, noteFolders, emailTemplates, learning }}
        onSearchSelect={handleSearchSelect}
        myRole={myRole}
        wsPermissions={wsPermissions}
      />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme || 'dark'}
          options={[{value:'dark',label:'Dark'},{value:'light',label:'Light'}]}
          onChange={v => setTweak('theme', v)} />
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

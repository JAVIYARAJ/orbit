import { useState } from 'react';
import {
  LayoutDashboard, Users, MonitorSmartphone, FolderKanban, CheckSquare,
  Activity, Mail, Inbox, LogOut, Menu, X, ExternalLink,
} from 'lucide-react';
import { OverviewPage } from './pages/Overview.jsx';
import { UsersPage } from './pages/Users.jsx';
import { WorkstationsPage } from './pages/Workstations.jsx';
import { ProjectsPage } from './pages/Projects.jsx';
import { TasksPage } from './pages/Tasks.jsx';
import { ActivityLogPage } from './pages/ActivityLog.jsx';
import { InvitesAccessPage } from './pages/InvitesAccess.jsx';
import { ContactSubmissionsPage } from './pages/ContactSubmissions.jsx';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, Page: OverviewPage },
  { id: 'users', label: 'Users', icon: Users, Page: UsersPage },
  { id: 'workstations', label: 'Workstations', icon: MonitorSmartphone, Page: WorkstationsPage },
  { id: 'projects', label: 'Projects', icon: FolderKanban, Page: ProjectsPage },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, Page: TasksPage },
  { id: 'activity', label: 'Activity Log', icon: Activity, Page: ActivityLogPage },
  { id: 'invites', label: 'Invites & Access', icon: Mail, Page: InvitesAccessPage },
  { id: 'contact', label: 'Contact Submissions', icon: Inbox, Page: ContactSubmissionsPage },
];

export function AdminApp({ user, onExit }) {
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((n) => n.id === active) || NAV[0];
  const Page = current.Page;

  return (
    <div className="orbit-admin flex bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background min-h-[100dvh]">
      {/* Sidebar */}
      <aside className={`fixed lg:static z-50 h-full w-72 shrink-0 bg-card/40 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-20 px-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 font-heading font-black text-xl">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_15px_rgba(99,102,241,0.5)] text-white">
              <span className="relative z-10 text-sm">O</span>
              <div className="absolute inset-0 rounded-lg border border-white/20"></div>
            </div>
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Orbit</span>
            <span className="text-primary/80 font-bold text-xs uppercase tracking-wider ml-1 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">Admin</span>
          </div>
          <button className="lg:hidden p-1" onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = n.id === active;
            return (
              <button key={n.id} onClick={() => { setActive(n.id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${on ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.02]' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground hover:scale-[1.02]'}`}>
                <Icon className={`w-5 h-5 ${on ? 'text-white' : 'text-primary/70'}`} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5 bg-background/20">
          <button onClick={onExit}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 border border-transparent transition-all duration-300 group">
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to app
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 h-[100dvh] flex flex-col relative">
        <header className="h-20 shrink-0 px-6 flex items-center justify-between border-b border-white/5 bg-background/40 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2.5 rounded-xl hover:bg-white/5 text-primary transition-colors border border-transparent hover:border-white/10" onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5" /></button>
            <h1 className="text-2xl font-heading font-black bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">{current.label}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="hidden sm:flex items-center gap-2 bg-card/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse"></div>
              <span className="truncate max-w-[200px] text-foreground/80">{user?.email}</span>
            </div>
            <a href="/" onClick={(e) => { e.preventDefault(); onExit(); }} title="Open app"
              className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300 border border-primary/20 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] group"><ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" /></a>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
          <Page />
        </main>
      </div>
    </div>
  );
}

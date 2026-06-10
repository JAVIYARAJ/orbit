import { useState } from 'react';
import {
  LayoutDashboard, Users, MonitorSmartphone, FolderKanban, CheckSquare,
  Activity, Mail, Inbox, FileText, Sparkles, MailCheck, LogOut, Menu, X, ExternalLink,
} from 'lucide-react';
import { OverviewPage } from './pages/Overview.jsx';
import { UsersPage } from './pages/Users.jsx';
import { WorkstationsPage } from './pages/Workstations.jsx';
import { ProjectsPage } from './pages/Projects.jsx';
import { TasksPage } from './pages/Tasks.jsx';
import { ActivityLogPage } from './pages/ActivityLog.jsx';
import { InvitesAccessPage } from './pages/InvitesAccess.jsx';
import { ContactSubmissionsPage } from './pages/ContactSubmissions.jsx';
import { ReplyTemplatesPage } from './pages/ReplyTemplates.jsx';
import { WelcomeEmailPage } from './pages/WelcomeEmail.jsx';
import { EmailLogPage } from './pages/EmailLog.jsx';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, Page: OverviewPage },
  { id: 'users', label: 'Users', icon: Users, Page: UsersPage },
  { id: 'workstations', label: 'Workstations', icon: MonitorSmartphone, Page: WorkstationsPage },
  { id: 'projects', label: 'Projects', icon: FolderKanban, Page: ProjectsPage },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, Page: TasksPage },
  { id: 'activity', label: 'Activity Log', icon: Activity, Page: ActivityLogPage },
  { id: 'invites', label: 'Invites & Access', icon: Mail, Page: InvitesAccessPage },
  { id: 'contact', label: 'Contact Submissions', icon: Inbox, Page: ContactSubmissionsPage },
  { id: 'templates', label: 'Reply Templates', icon: FileText, Page: ReplyTemplatesPage },
  { id: 'welcome', label: 'Welcome Email', icon: Sparkles, Page: WelcomeEmailPage },
  { id: 'emaillog', label: 'Email Log', icon: MailCheck, Page: EmailLogPage },
];

export function AdminApp({ user, onExit }) {
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((n) => n.id === active) || NAV[0];
  const Page = current.Page;

  return (
    <div className="orbit-admin flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static z-50 h-full w-64 shrink-0 bg-card border-r border-border flex flex-col transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 px-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2 font-black text-lg">
            <span className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-white text-sm">O</span>
            Orbit <span className="text-muted-foreground font-semibold text-sm">Admin</span>
          </div>
          <button className="lg:hidden p-1" onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = n.id === active;
            return (
              <button key={n.id} onClick={() => { setActive(n.id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${on ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                <Icon className="w-[18px] h-[18px]" />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={onExit}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">
            <LogOut className="w-[18px] h-[18px]" /> Back to app
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 h-[100dvh] flex flex-col">
        <header className="h-16 shrink-0 px-4 sm:px-6 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-muted/50" onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold">{current.label}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline truncate max-w-[200px]">{user?.email}</span>
            <a href="/" onClick={(e) => { e.preventDefault(); onExit(); }} title="Open app"
              className="p-2 rounded-lg hover:bg-muted/50"><ExternalLink className="w-4 h-4" /></a>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Page />
        </main>
      </div>
    </div>
  );
}

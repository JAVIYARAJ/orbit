import { useState } from 'react';
import {
  LayoutDashboard, Users, MonitorSmartphone, FolderKanban, CheckSquare,
  Activity, Mail, Inbox, FileText, Sparkles, MailCheck, Megaphone, LogOut, Menu, X, ExternalLink,
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
import { BroadcastPage } from './pages/Broadcast.jsx';

import { Bell, Search, Settings, Sun, Moon } from 'lucide-react';

const NAV_GROUPS = [
  {
    title: 'Dashboard',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, Page: OverviewPage },
      { id: 'activity', label: 'Activity Log', icon: Activity, Page: ActivityLogPage },
    ]
  },
  {
    title: 'Directory & Assets',
    items: [
      { id: 'users', label: 'Users', icon: Users, Page: UsersPage },
      { id: 'workstations', label: 'Workstations', icon: MonitorSmartphone, Page: WorkstationsPage },
      { id: 'projects', label: 'Projects', icon: FolderKanban, Page: ProjectsPage },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare, Page: TasksPage },
    ]
  },
  {
    title: 'Communication',
    items: [
      { id: 'broadcast', label: 'Broadcast', icon: Megaphone, Page: BroadcastPage },
      { id: 'contact', label: 'Contact Submissions', icon: Inbox, Page: ContactSubmissionsPage },
      { id: 'invites', label: 'Invites & Access', icon: Mail, Page: InvitesAccessPage },
    ]
  },
  {
    title: 'System & Config',
    items: [
      { id: 'templates', label: 'Reply Templates', icon: FileText, Page: ReplyTemplatesPage },
      { id: 'welcome', label: 'Welcome Email', icon: Sparkles, Page: WelcomeEmailPage },
      { id: 'emaillog', label: 'Email Log', icon: MailCheck, Page: EmailLogPage },
    ]
  }
];

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

export function AdminApp({ user, onExit }) {
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  
  const current = ALL_NAV.find((n) => n.id === active) || ALL_NAV[0];
  const Page = current.Page;

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className={`orbit-admin flex ${theme === 'light' ? 'light' : ''}`}>
      {/* Sidebar */}
      <aside className={`fixed lg:static z-50 h-full w-[260px] shrink-0 bg-card/60 backdrop-blur-2xl border-r border-border flex flex-col transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 px-6 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center gap-3 font-black text-lg">
            <svg width="28" height="28" viewBox="0 0 18 18" fill="none" className="text-primary">
              <circle cx="9" cy="9" r="3" fill="currentColor" />
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="9" cy="3" r="1.5" fill="currentColor" />
            </svg>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">Orbit</span> 
            <span className="text-primary/80 font-bold text-xs uppercase tracking-widest mt-1 bg-primary/10 px-1.5 py-0.5 rounded-md">Admin</span>
          </div>
          <button className="lg:hidden p-1 text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3 px-2">{group.title}</h4>
              <div className="space-y-0.5">
                {group.items.map((n) => {
                  const Icon = n.icon;
                  const on = n.id === active;
                  return (
                    <button key={n.id} onClick={() => { setActive(n.id); setMobileOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${on ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                      <Icon className={`w-[18px] h-[18px] transition-colors ${on ? 'text-primary' : 'opacity-70'}`} />
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-border bg-muted/30 shrink-0">
          <button onClick={onExit}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
            <LogOut className="w-[18px] h-[18px]" /> Back to app
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 h-[100dvh] flex flex-col relative z-10">
        <header className="h-16 shrink-0 px-4 sm:px-8 flex items-center justify-between border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground" onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5" /></button>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">{current.label}</h1>
          </div>
          
          <div className="flex items-center gap-5">
            {/* Mock Global Search */}
            <div className="hidden md:flex relative group">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
              <input 
                placeholder="Quick search..." 
                className="w-64 pl-9 pr-4 py-2 rounded-full bg-muted/50 border border-border text-sm focus:outline-none focus:border-primary/50 focus:bg-muted/80 transition-all text-foreground/80 placeholder:text-muted-foreground/70 shadow-inner"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded border border-border">⌘K</kbd>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10 hidden sm:block"></div>

            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors group">
                {theme === 'dark' ? <Sun className="w-4 h-4 group-hover:text-amber-400 transition-colors" /> : <Moon className="w-4 h-4 group-hover:text-indigo-600 transition-colors" />}
              </button>
              
              <button className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground relative transition-colors">
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary border-2 border-background"></span>
              </button>
              
              <div className="flex items-center gap-3 pl-2 cursor-pointer group">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors">{user?.email?.split('@')[0] || 'Admin'}</span>
                  <span className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold">Superadmin</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-[#ffffff] font-bold text-sm shadow-md ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                  {(user?.email || 'A').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Mobile Title */}
          <h1 className="text-2xl font-bold tracking-tight mb-6 sm:hidden">{current.label}</h1>
          <Page />
        </main>
      </div>
    </div>
  );
}

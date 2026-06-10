import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { Users, MonitorSmartphone, FolderKanban, CheckSquare, FileText, Clock, Activity, Inbox } from 'lucide-react';
import { useAdmin, StatCard, Skeleton, Badge } from '../ui.jsx';
import { adminOverview } from '../api.js';

const PIE_COLORS = ['#6366f1', '#22c55e', '#eab308', '#06b6d4', '#ec4899', '#f97316', '#8b5cf6', '#64748b'];

const ChartCard = ({ title, children, loading }) => (
  <div className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border p-5 shadow-lg shadow-foreground/5">
    <h3 className="text-sm font-bold mb-4">{title}</h3>
    {loading ? <Skeleton className="h-56 w-full" /> : <div className="h-56">{children}</div>}
  </div>
);

const tooltipStyle = { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 };

export function OverviewPage() {
  const { data, loading, error, reload } = useAdmin(adminOverview, []);
  const s = data?.stats || {};
  const contact = data?.contactByStatus || {};
  const contactTotal = Object.values(contact).reduce((a, b) => a + b, 0);

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <button onClick={reload} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-[#ffffff] border border-primary/20 shadow-md shadow-primary/20 text-sm font-semibold" style={{ color: "#ffffff" }}>Retry</button>
      </div>
    );
  }

  const toData = (obj) => Object.entries(obj || {}).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={s.totalUsers} icon={Users} loading={loading} />
        <StatCard label="Workstations" value={s.totalWorkstations} icon={MonitorSmartphone} loading={loading} />
        <StatCard label="Active projects" value={s.activeProjects} icon={FolderKanban} loading={loading} />
        <StatCard label="Tasks" value={s.totalTasks} icon={CheckSquare} loading={loading} />
        <StatCard label="Notes" value={s.totalNotes} icon={FileText} loading={loading} />
        <StatCard label="Hours logged" value={s.totalHours != null ? `${s.totalHours}h` : '—'} icon={Clock} loading={loading} />
        <StatCard label="Status changes" value={s.totalStatusLogs} icon={Activity} loading={loading} hint="engagement proxy" />
        <StatCard label="Contact messages" value={contactTotal} icon={Inbox} loading={loading}
          hint={!loading ? `${contact.new || 0} new · ${contact.seen || 0} seen · ${contact.resolved || 0} resolved` : undefined} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Signups — last 30 days" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.signupsDaily || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8b8b93' }} tickFormatter={(d) => d.slice(5)} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8b8b93' }} width={24} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Projects by status" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={toData(data?.projectsByStatus)} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {toData(data?.projectsByStatus).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <Legend items={toData(data?.projectsByStatus)} />
        </ChartCard>

        <ChartCard title="Activity by action" loading={loading}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toData(data?.activityByAction)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#8b8b93' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8b8b93' }} width={70} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="value" fill="#22c55e" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 5 active workstations" loading={loading}>
          <div className="space-y-3">
            {(data?.topWorkstations || []).length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {(data?.topWorkstations || []).map((w, i) => {
              const max = data.topWorkstations[0].count || 1;
              return (
                <div key={w.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm font-medium w-40 truncate">{w.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(w.count / max) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{w.count}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

const Legend = ({ items }) => (
  <div className="flex flex-wrap gap-2 mt-2 justify-center">
    {items.map((it, i) => (
      <span key={it.name} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
        {it.name} ({it.value})
      </span>
    ))}
  </div>
);

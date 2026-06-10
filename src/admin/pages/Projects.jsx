import { useState, useEffect } from 'react';
import { useAdmin, DataTable, Drawer, RelTime, Pagination, SearchInput, FilterSelect, Toggle, Badge, Field, DrawerSection, ProgressBar, statusTone } from '../ui.jsx';
import { adminQuery } from '../api.js';

const PER = 50;
const STATUSES = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];

export function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setOffset(0); }, 350); return () => clearTimeout(t); }, [search]);

  const { data, loading, error, reload } = useAdmin(() => {
    const filters = [{ col: 'deleted_at', op: showDeleted ? 'not_is' : 'is', val: null }];
    if (status) filters.push({ col: 'status', op: 'eq', val: status });
    return adminQuery({
      table: 'projects', select: '*, ws:workstations(name)', order: 'created_at', ascending: false,
      filters, limit: PER, offset, count: true,
      search: debounced ? { columns: ['name', 'client'], term: debounced } : undefined,
    });
  }, [debounced, status, showDeleted, offset]);

  const columns = [
    { key: 'short_id', label: 'ID', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.short_id}</span> },
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'client', label: 'Client', render: (r) => r.client || '—' },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)} dot>{(r.status || '').replace(/_/g, ' ')}</Badge> },
    { key: 'progress', label: 'Progress', render: (r) => <div className="flex items-center gap-2"><ProgressBar value={r.progress || 0} /><span className="text-xs text-muted-foreground">{r.progress || 0}%</span></div> },
    { key: 'stack', label: 'Stack', render: (r) => <div className="flex flex-wrap gap-1 max-w-[160px]">{(r.stack || []).slice(0, 3).map((s, i) => <Badge key={i} tone="grey">{s}</Badge>)}</div> },
    { key: 'hours', label: 'Hours', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{r.hours_logged || 0}/{r.hours_est || 0}h</span> },
    { key: 'ws', label: 'Workstation', render: (r) => r.ws?.name || '—' },
    { key: 'created_at', label: 'Created', render: (r) => <RelTime date={r.created_at} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-card/60 backdrop-blur-xl border border-border shadow-lg shadow-foreground/5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or client…" />
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={STATUSES} allLabel="All statuses" />
        <Toggle checked={showDeleted} onChange={(v) => { setShowDeleted(v); setOffset(0); }} label="Show deleted" />
      </div>
      <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} onRowClick={setSelected} />
      <Pagination offset={offset} limit={PER} count={data?.count} onPage={setOffset} />
      <ProjectDrawer project={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ProjectDrawer({ project, onClose }) {
  const { data, loading } = useAdmin(async () => {
    if (!project) return null;
    const [gantt, time] = await Promise.all([
      adminQuery({ table: 'gantt_tasks', select: 'name, status, start_week, end_week', filters: [{ col: 'project_id', op: 'eq', val: project.id }], limit: 200 }),
      adminQuery({ table: 'time_entries', select: 'total_seconds', filters: [{ col: 'project_id', op: 'eq', val: project.id }], limit: 2000 }),
    ]);
    const seconds = (time.rows || []).reduce((s, r) => s + (r.total_seconds || 0), 0);
    return { gantt: gantt.rows, hours: Math.round(seconds / 360) / 10 };
  }, [project?.id]);

  return (
    <Drawer open={!!project} onClose={onClose} title={project?.name} subtitle={project?.short_id}>
      {project && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge tone={statusTone(project.status)} dot>{(project.status || '').replace(/_/g, ' ')}</Badge>
            {project.deleted_at && <Badge tone="red">deleted</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-5 p-5 rounded-2xl bg-muted/50 border border-border shadow-inner">
            <Field label="Client">{project.client || '—'}</Field>
            <Field label="Progress"><ProgressBar value={project.progress || 0} /></Field>
            <Field label="Hours (logged / est)">{project.hours_logged || 0} / {project.hours_est || 0}h</Field>
            <Field label="Time tracked">{loading ? '…' : `${data?.hours ?? 0}h`}</Field>
            <Field label="Tasks (open / total)">{project.open_tasks ?? 0} / {project.tasks_count ?? 0}</Field>
            <Field label="Dates">{project.start_date || '—'} → {project.end_date || '—'}</Field>
            <Field label="Budget">{project.budget != null ? project.budget : '—'}</Field>
            <Field label="Repo">{project.repo || '—'}</Field>
          </div>
          {project.description && <DrawerSection title="Description"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p></DrawerSection>}
          <DrawerSection title="Stack">
            <div className="flex flex-wrap gap-1.5">{(project.stack || []).map((s, i) => <Badge key={i} tone="indigo">{s}</Badge>)}{!(project.stack || []).length && <span className="text-sm text-muted-foreground">—</span>}</div>
          </DrawerSection>
          <DrawerSection title="Gantt tasks" count={data?.gantt?.length}>
            <div className="space-y-2">
              {(data?.gantt || []).map((g, i) => (
                <div key={i} className="flex items-center justify-between bg-background/50 backdrop-blur-md border border-border rounded-xl px-4 py-3 text-sm shadow-sm transition-colors hover:bg-muted">
                  <span className="truncate font-semibold">{g.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md border border-border">W{g.start_week}–{g.end_week} · {g.status}</span>
                </div>
              ))}
              {!loading && !data?.gantt?.length && <p className="text-sm text-muted-foreground">No gantt tasks</p>}
            </div>
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}

import { useState, useEffect } from 'react';
import { useAdmin, DataTable, Drawer, RelTime, Pagination, SearchInput, FilterSelect, Toggle, Badge, Field, DrawerSection } from '../ui.jsx';
import { adminQuery } from '../api.js';

const PER = 50;
const fmtMin = (m) => m ? `${Math.round((m / 60) * 10) / 10}h` : '0h';

export function TasksPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [statusId, setStatusId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setOffset(0); }, 350); return () => clearTimeout(t); }, [search]);

  const { data, loading, error, reload } = useAdmin(async () => {
    const filters = [{ col: 'deleted_at', op: showDeleted ? 'not_is' : 'is', val: null }];
    if (statusId) filters.push({ col: 'status_id', op: 'eq', val: statusId });
    if (priorityId) filters.push({ col: 'priority_id', op: 'eq', val: priorityId });
    const [tasks, statuses, priorities, profiles] = await Promise.all([
      adminQuery({ table: 'tasks', select: '*', order: 'created_at', ascending: false, filters, limit: PER, offset, count: true, search: debounced ? { columns: ['title'], term: debounced } : undefined }),
      adminQuery({ table: 'task_statuses', select: 'id,label,color', limit: 500 }),
      adminQuery({ table: 'task_priorities', select: 'id,label,color', limit: 200 }),
      adminQuery({ table: 'profiles', select: 'id,name', limit: 2000 }),
    ]);
    return {
      rows: tasks.rows, count: tasks.count,
      statusMap: Object.fromEntries(statuses.rows.map((s) => [s.id, s])),
      priorityMap: Object.fromEntries(priorities.rows.map((p) => [p.id, p])),
      profileMap: Object.fromEntries(profiles.rows.map((p) => [p.id, p])),
      statuses: statuses.rows, priorities: priorities.rows,
    };
  }, [debounced, statusId, priorityId, showDeleted, offset]);

  const colorBadge = (item) => item ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border" style={{ color: item.color || '#8b8b93', borderColor: (item.color || '#8b8b93') + '55', background: (item.color || '#8b8b93') + '18' }}>{item.label}</span> : <span className="text-muted-foreground">—</span>;

  const columns = [
    { key: 'task_id', label: 'ID', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.task_id}</span> },
    { key: 'title', label: 'Title', render: (r) => <span className="font-medium line-clamp-1 max-w-[260px] inline-block align-bottom">{r.title}</span> },
    { key: 'status', label: 'Status', render: (r) => colorBadge(data?.statusMap?.[r.status_id]) },
    { key: 'priority', label: 'Priority', render: (r) => colorBadge(data?.priorityMap?.[r.priority_id]) },
    { key: 'assignee', label: 'Assignee', render: (r) => data?.profileMap?.[r.assignee_id]?.name || '—' },
    { key: 'project', label: 'Project', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.project_short_id || '—'}</span> },
    { key: 'due', label: 'Due', render: (r) => r.due_date || '—' },
    { key: 'time', label: 'Est/Logged', render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtMin(r.est_minutes)}/{fmtMin(r.logged_minutes)}</span> },
    { key: 'subs', label: 'Subtasks', render: (r) => `${r.subs_done || 0}/${r.subs_total || 0}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title…" />
        <FilterSelect value={priorityId} onChange={(v) => { setPriorityId(v); setOffset(0); }} options={(data?.priorities || []).map((p) => ({ value: p.id, label: p.label }))} allLabel="All priorities" />
        <FilterSelect value={statusId} onChange={(v) => { setStatusId(v); setOffset(0); }} options={(data?.statuses || []).map((s) => ({ value: s.id, label: s.label }))} allLabel="All statuses" />
        <Toggle checked={showDeleted} onChange={(v) => { setShowDeleted(v); setOffset(0); }} label="Show deleted" />
      </div>
      <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} onRowClick={setSelected} dense />
      <Pagination offset={offset} limit={PER} count={data?.count} onPage={setOffset} />
      <TaskDrawer task={selected} statusMap={data?.statusMap} profileMap={data?.profileMap} onClose={() => setSelected(null)} />
    </div>
  );
}

function TaskDrawer({ task, statusMap, profileMap, onClose }) {
  const { data, loading } = useAdmin(async () => {
    if (!task) return null;
    const [comments, logs, time, atts] = await Promise.all([
      adminQuery({ table: 'task_comments', select: 'id', filters: [{ col: 'task_id', op: 'eq', val: task.id }, { col: 'deleted_at', op: 'is', val: null }], count: true, limit: 1 }),
      adminQuery({ table: 'task_status_logs', select: 'from_status_id,to_status_id,changed_at,user_id', filters: [{ col: 'task_id', op: 'eq', val: task.id }], order: 'changed_at', ascending: false, limit: 50 }),
      adminQuery({ table: 'time_entries', select: 'total_seconds', filters: [{ col: 'task_id', op: 'eq', val: task.id }], limit: 1000 }),
      adminQuery({ table: 'task_attachments', select: 'id', filters: [{ col: 'task_id', op: 'eq', val: task.id }], count: true, limit: 1 }),
    ]);
    const seconds = (time.rows || []).reduce((s, r) => s + (r.total_seconds || 0), 0);
    return { comments: comments.count, logs: logs.rows, hours: Math.round(seconds / 360) / 10, attachments: atts.count };
  }, [task?.id]);

  const label = (id) => statusMap?.[id]?.label || '—';

  return (
    <Drawer open={!!task} onClose={onClose} title={task?.title} subtitle={task?.task_id}>
      {task && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">{label(task.status_id)}</Field>
            <Field label="Assignee">{profileMap?.[task.assignee_id]?.name || '—'}</Field>
            <Field label="Project">{task.project_short_id || '—'}</Field>
            <Field label="Due">{task.due_date || '—'}</Field>
            <Field label="Estimate">{fmtMin(task.est_minutes)}</Field>
            <Field label="Logged">{fmtMin(task.logged_minutes)}</Field>
            <Field label="Subtasks">{task.subs_done || 0} / {task.subs_total || 0}</Field>
            <Field label="Time tracked">{loading ? '…' : `${data?.hours ?? 0}h`}</Field>
            <Field label="Comments">{loading ? '…' : data?.comments ?? 0}</Field>
            <Field label="Attachments">{loading ? '…' : data?.attachments ?? 0}</Field>
          </div>
          {task.description && <DrawerSection title="Description"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p></DrawerSection>}
          <DrawerSection title="Status history" count={data?.logs?.length}>
            <div className="space-y-1.5">
              {(data?.logs || []).map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge tone="grey">{label(l.from_status_id)}</Badge><span className="text-muted-foreground">→</span><Badge tone="blue">{label(l.to_status_id)}</Badge>
                  <span className="ml-auto"><RelTime date={l.changed_at} /></span>
                </div>
              ))}
              {!loading && !data?.logs?.length && <p className="text-sm text-muted-foreground">No status changes</p>}
            </div>
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}

import { useState } from 'react';
import { useAdmin, DataTable, Drawer, Avatar, RelTime, SearchInput, Badge, Field, DrawerSection, ProgressBar } from '../ui.jsx';
import { adminQuery } from '../api.js';

export function WorkstationsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data, loading, error, reload } = useAdmin(async () => {
    const [ws, members, projects, tasks, profiles] = await Promise.all([
      adminQuery({ table: 'workstations', select: '*', order: 'created_at', ascending: false, limit: 500 }),
      adminQuery({ table: 'workstation_members', select: 'workstation_id,user_id', limit: 2000 }),
      adminQuery({ table: 'projects', select: 'id,workstation_id', filters: [{ col: 'deleted_at', op: 'is', val: null }], limit: 2000 }),
      adminQuery({ table: 'tasks', select: 'id,workstation_id', filters: [{ col: 'deleted_at', op: 'is', val: null }], limit: 5000 }),
      adminQuery({ table: 'profiles', select: 'id,name,email,avatar_url', limit: 2000 }),
    ]);
    const tally = (rows) => rows.reduce((m, r) => (m[r.workstation_id] = (m[r.workstation_id] || 0) + 1, m), {});
    const pmap = Object.fromEntries(profiles.rows.map((p) => [p.id, p]));
    return {
      rows: ws.rows, pmap,
      members: tally(members.rows), projects: tally(projects.rows), tasks: tally(tasks.rows),
    };
  }, []);

  const filtered = (data?.rows || []).filter((w) => !search || w.name.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    {
      key: 'name', label: 'Name', render: (r) => (
        <span className="flex items-center gap-2 font-medium">
          <span className="w-3 h-3 rounded-full border border-border" style={{ background: r.color || '#6366f1' }} />{r.name}
        </span>)
    },
    { key: 'owner', label: 'Owner', render: (r) => data?.pmap?.[r.owner_id]?.name || '—' },
    { key: 'members', label: 'Members', render: (r) => data?.members?.[r.id] || 0 },
    { key: 'projects', label: 'Projects', render: (r) => data?.projects?.[r.id] || 0 },
    { key: 'tasks', label: 'Tasks', render: (r) => data?.tasks?.[r.id] || 0 },
    { key: 'created_at', label: 'Created', render: (r) => <RelTime date={r.created_at} /> },
  ];

  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={setSearch} placeholder="Search workstation…" />
      <DataTable columns={columns} rows={filtered} loading={loading} error={error} onRetry={reload} onRowClick={setSelected} />
      <WorkstationDrawer ws={selected} owner={selected ? data?.pmap?.[selected.owner_id] : null} pmap={data?.pmap} onClose={() => setSelected(null)} />
    </div>
  );
}

function WorkstationDrawer({ ws, owner, pmap, onClose }) {
  const { data, loading } = useAdmin(async () => {
    if (!ws) return null;
    const f = [{ col: 'workstation_id', op: 'eq', val: ws.id }];
    const [members, projects, integrations, invites, tags, statuses, priorities, types] = await Promise.all([
      adminQuery({ table: 'workstation_members', select: 'user_id, role, joined_at', filters: f, limit: 200 }),
      adminQuery({ table: 'projects', select: 'name, status, progress', filters: [...f, { col: 'deleted_at', op: 'is', val: null }], limit: 200 }),
      adminQuery({ table: 'workspace_integrations', select: 'provider, display_name, username', filters: f, limit: 50 }),
      adminQuery({ table: 'workspace_invites', select: 'email, role', filters: [...f, { col: 'status', op: 'eq', val: 'pending' }], limit: 100 }),
      adminQuery({ table: 'tags', select: 'name, color', filters: f, limit: 200 }),
      adminQuery({ table: 'task_statuses', select: 'label, color', filters: f, order: 'sort_order', ascending: true, limit: 100 }),
      adminQuery({ table: 'task_priorities', select: 'label, color', filters: f, limit: 100 }),
      adminQuery({ table: 'project_types', select: 'label', filters: f, limit: 100 }),
    ]);
    return { members: members.rows, projects: projects.rows, integrations: integrations.rows, invites: invites.rows, tags: tags.rows, statuses: statuses.rows, priorities: priorities.rows, types: types.rows };
  }, [ws?.id]);

  return (
    <Drawer open={!!ws} onClose={onClose} title={ws?.name} subtitle={ws ? `Created ${new Date(ws.created_at).toLocaleDateString()}` : ''}>
      {ws && (
        <>
          <DrawerSection title="Owner">
            <div className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
              <Avatar name={owner?.name} url={owner?.avatar_url} size={40} />
              <div><div className="font-medium">{owner?.name || '—'}</div><div className="text-sm text-muted-foreground">{owner?.email}</div></div>
            </div>
          </DrawerSection>
          <DrawerSection title="Members" count={data?.members?.length}>
            <div className="space-y-2">
              {(data?.members || []).map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2 text-sm">
                  <span className="flex items-center gap-2"><Avatar name={pmap?.[m.user_id]?.name} url={pmap?.[m.user_id]?.avatar_url} size={24} />{pmap?.[m.user_id]?.name || '—'}</span>
                  <Badge tone={m.role === 'owner' ? 'indigo' : m.role === 'viewer' ? 'grey' : 'blue'}>{m.role}</Badge>
                </div>
              ))}
            </div>
          </DrawerSection>
          <DrawerSection title="Projects" count={data?.projects?.length}>
            <div className="space-y-2">
              {(data?.projects || []).map((p, i) => (
                <div key={i} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center justify-between mb-1"><span className="font-medium truncate">{p.name}</span><Badge tone="grey">{(p.status || '').replace(/_/g, ' ')}</Badge></div>
                  <ProgressBar value={p.progress || 0} />
                </div>
              ))}
              {!loading && !data?.projects?.length && <p className="text-sm text-muted-foreground">No projects</p>}
            </div>
          </DrawerSection>
          <div className="grid grid-cols-2 gap-4">
            <DrawerSection title="Integrations" count={data?.integrations?.length}>
              <div className="flex flex-wrap gap-2">{(data?.integrations || []).map((it, i) => <Badge key={i} tone="purple">{it.provider}</Badge>)}{!loading && !data?.integrations?.length && <span className="text-sm text-muted-foreground">None</span>}</div>
            </DrawerSection>
            <DrawerSection title="Pending invites" count={data?.invites?.length}>
              <div className="space-y-1 text-sm">{(data?.invites || []).map((iv, i) => <div key={i} className="text-muted-foreground truncate">{iv.email} · {iv.role}</div>)}{!loading && !data?.invites?.length && <span className="text-sm text-muted-foreground">None</span>}</div>
            </DrawerSection>
          </div>
          <DrawerSection title="Tags" count={data?.tags?.length}>
            <div className="flex flex-wrap gap-2">{(data?.tags || []).map((t, i) => <span key={i} className="px-2 py-0.5 rounded-full text-xs border" style={{ borderColor: (t.color || '#6366f1') + '66', color: t.color || '#6366f1' }}>{t.name}</span>)}</div>
          </DrawerSection>
          <div className="grid grid-cols-3 gap-4">
            <ChipList title="Statuses" items={(data?.statuses || []).map((s) => s.label)} />
            <ChipList title="Priorities" items={(data?.priorities || []).map((p) => p.label)} />
            <ChipList title="Project types" items={(data?.types || []).map((t) => t.label)} />
          </div>
        </>
      )}
    </Drawer>
  );
}

const ChipList = ({ title, items }) => (
  <DrawerSection title={title} count={items.length}>
    <div className="flex flex-wrap gap-1.5">{items.map((x, i) => <Badge key={i} tone="grey">{x}</Badge>)}</div>
  </DrawerSection>
);

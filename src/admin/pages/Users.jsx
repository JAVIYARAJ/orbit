import { useState, useEffect } from 'react';
import { useAdmin, DataTable, Drawer, Avatar, RelTime, Pagination, SearchInput, Field, DrawerSection, Badge } from '../ui.jsx';
import { adminQuery, adminAuthUsers } from '../api.js';
import { fmtDate } from '../../lib/dateUtils.js';

const PER = 50;

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setOffset(0); }, 350); return () => clearTimeout(t); }, [search]);

  const { data, loading, error, reload } = useAdmin(async () => {
    const [profiles, auth] = await Promise.all([
      adminQuery({
        table: 'profiles', select: '*, active_ws:workstations(name)',
        order: 'created_at', ascending: false, limit: PER, offset, count: true,
        search: debounced ? { columns: ['name', 'email'], term: debounced } : undefined,
      }),
      adminAuthUsers(),
    ]);
    return { rows: profiles.rows, count: profiles.count, auth: auth.users || {} };
  }, [debounced, offset]);

  const columns = [
    { key: 'avatar', label: '', render: (r) => <Avatar name={r.name} url={r.avatar_url} /> },
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name || '—'}</span> },
    { key: 'email', label: 'Email', render: (r) => <span className="text-muted-foreground">{r.email || data?.auth?.[r.id]?.email || '—'}</span> },
    { key: 'ws', label: 'Active workstation', render: (r) => r.active_ws?.name || '—' },
    { key: 'last', label: 'Last sign-in', render: (r) => <RelTime date={data?.auth?.[r.id]?.last_sign_in_at} /> },
    { key: 'created_at', label: 'Joined', render: (r) => <RelTime date={r.created_at} /> },
  ];

  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
      <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} onRowClick={setSelected} />
      <Pagination offset={offset} limit={PER} count={data?.count} onPage={setOffset} />
      <UserDrawer user={selected} auth={selected ? data?.auth?.[selected.id] : null} onClose={() => setSelected(null)} />
    </div>
  );
}

function UserDrawer({ user, auth, onClose }) {
  const { data, loading } = useAdmin(async () => {
    if (!user) return null;
    const [members, projects, tasks, time, activity] = await Promise.all([
      adminQuery({ table: 'workstation_members', select: 'role, joined_at, ws:workstations(name)', filters: [{ col: 'user_id', op: 'eq', val: user.id }], limit: 100 }),
      adminQuery({ table: 'projects', select: 'id', filters: [{ col: 'user_id', op: 'eq', val: user.id }, { col: 'deleted_at', op: 'is', val: null }], count: true, limit: 1 }),
      adminQuery({ table: 'tasks', select: 'id', filters: [{ col: 'user_id', op: 'eq', val: user.id }, { col: 'deleted_at', op: 'is', val: null }], count: true, limit: 1 }),
      adminQuery({ table: 'time_entries', select: 'total_seconds', filters: [{ col: 'user_id', op: 'eq', val: user.id }], limit: 1000 }),
      adminQuery({ table: 'activity_log', select: 'action, entity_type, entity_label, created_at', filters: [{ col: 'actor_id', op: 'eq', val: user.id }], order: 'created_at', ascending: false, limit: 10 }),
    ]);
    const seconds = (time.rows || []).reduce((s, r) => s + (r.total_seconds || 0), 0);
    return { members: members.rows, projects: projects.count, tasks: tasks.count, hours: Math.round(seconds / 360) / 10, activity: activity.rows };
  }, [user?.id]);

  return (
    <Drawer open={!!user} onClose={onClose} title={user?.name} subtitle={user?.email || auth?.email}>
      {user && (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} url={user.avatar_url} size={56} />
            <div>
              <div className="font-bold">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email || auth?.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Projects" value={loading ? '…' : data?.projects ?? 0} />
            <Stat label="Tasks" value={loading ? '…' : data?.tasks ?? 0} />
            <Stat label="Hours" value={loading ? '…' : `${data?.hours ?? 0}h`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Joined">{fmtDate(user.created_at)}</Field>
            <Field label="Last sign-in"><RelTime date={auth?.last_sign_in_at} /></Field>
          </div>
          <DrawerSection title="Workstations" count={data?.members?.length}>
            <div className="space-y-2">
              {(data?.members || []).map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2 text-sm">
                  <span>{m.ws?.name || '—'}</span><Badge tone="indigo">{m.role}</Badge>
                </div>
              ))}
              {!loading && !data?.members?.length && <p className="text-sm text-muted-foreground">None</p>}
            </div>
          </DrawerSection>
          <DrawerSection title="Recent activity" count={data?.activity?.length}>
            <div className="space-y-1.5">
              {(data?.activity || []).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge tone="grey">{a.action}</Badge>
                  <span className="text-muted-foreground truncate">{a.entity_type} · {a.entity_label || '—'}</span>
                  <span className="ml-auto"><RelTime date={a.created_at} /></span>
                </div>
              ))}
              {!loading && !data?.activity?.length && <p className="text-sm text-muted-foreground">No recent activity</p>}
            </div>
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-lg bg-card border border-border p-3 text-center">
    <div className="text-2xl font-black">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

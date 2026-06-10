import { useState } from 'react';
import { useAdmin, DataTable, RelTime, FilterSelect, Badge, Skeleton } from '../ui.jsx';
import { adminQuery } from '../api.js';

const inviteTone = (s) => ({ pending: 'yellow', accepted: 'green', cancelled: 'grey', expired: 'red' }[s] || 'grey');

export function InvitesAccessPage() {
  const [tab, setTab] = useState('invites');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border">
        {['invites', 'permissions'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'invites' ? 'Invites' : 'Permissions'}
          </button>
        ))}
      </div>
      {tab === 'invites' ? <InvitesTab /> : <PermissionsTab />}
    </div>
  );
}

function InvitesTab() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAdmin(async () => {
    const filters = status ? [{ col: 'status', op: 'eq', val: status }] : [];
    const [invites, workstations] = await Promise.all([
      adminQuery({ table: 'workspace_invites', select: '*', order: 'created_at', ascending: false, filters, limit: 200 }),
      adminQuery({ table: 'workstations', select: 'id,name', limit: 500 }),
    ]);
    const wsMap = Object.fromEntries(workstations.rows.map((w) => [w.id, w.name]));
    return { rows: invites.rows, wsMap };
  }, [status]);

  const columns = [
    { key: 'ws', label: 'Workstation', render: (r) => r.workspace_name || data?.wsMap?.[r.workstation_id] || '—' },
    { key: 'inviter', label: 'Invited by', render: (r) => r.inviter_name || '—' },
    { key: 'email', label: 'Email', render: (r) => <span className="text-muted-foreground">{r.email}</span> },
    { key: 'role', label: 'Role', render: (r) => <Badge tone="indigo">{r.role}</Badge> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={inviteTone(r.status)} dot>{r.status}</Badge> },
    { key: 'created_at', label: 'Created', render: (r) => <RelTime date={r.created_at} /> },
    { key: 'expires_at', label: 'Expires', render: (r) => <RelTime date={r.expires_at} /> },
  ];

  return (
    <div className="space-y-4">
      <FilterSelect value={status} onChange={setStatus} options={['pending', 'accepted', 'cancelled', 'expired']} allLabel="All statuses" />
      <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} emptyText="No invites." />
    </div>
  );
}

function PermissionsTab() {
  const { data, loading, error, reload } = useAdmin(async () => {
    const [perms, workstations] = await Promise.all([
      adminQuery({ table: 'workspace_role_permissions', select: '*', limit: 2000 }),
      adminQuery({ table: 'workstations', select: 'id,name', limit: 500 }),
    ]);
    const wsMap = Object.fromEntries(workstations.rows.map((w) => [w.id, w.name]));
    // group by workstation → { permission_key → { role → allowed } }
    const groups = {};
    const rolesSet = new Set();
    for (const p of perms.rows) {
      rolesSet.add(p.role);
      (groups[p.workstation_id] ??= {});
      (groups[p.workstation_id][p.permission_key] ??= {});
      groups[p.workstation_id][p.permission_key][p.role] = p.allowed;
    }
    const roles = [...rolesSet].sort((a, b) => ['admin', 'member', 'viewer'].indexOf(a) - ['admin', 'member', 'viewer'].indexOf(b));
    return { groups, roles, wsMap };
  }, []);

  if (error) return <div className="rounded-xl border border-border bg-card p-10 text-center"><p className="text-sm text-muted-foreground mb-4">{error}</p><button onClick={reload} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-[#ffffff] border border-primary/20 shadow-md shadow-primary/20 text-sm font-semibold" style={{ color: "#ffffff" }}>Retry</button></div>;
  if (loading) return <Skeleton className="h-64 w-full" />;

  const entries = Object.entries(data?.groups || {});
  if (!entries.length) return <p className="text-sm text-muted-foreground">No custom role permissions configured.</p>;

  return (
    <div className="space-y-6">
      {entries.map(([wsId, matrix]) => (
        <div key={wsId} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold">{data.wsMap[wsId] || 'Unknown workstation'}</div>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead><tr className="border-b border-border text-left">
                <th className="px-4 py-2 font-semibold text-muted-foreground">Permission</th>
                {data.roles.map((r) => <th key={r} className="px-4 py-2 font-semibold text-muted-foreground capitalize text-center">{r}</th>)}
              </tr></thead>
              <tbody>
                {Object.entries(matrix).map(([key, roleMap]) => (
                  <tr key={key} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{key}</td>
                    {data.roles.map((r) => (
                      <td key={r} className="px-4 py-2 text-center">
                        {roleMap[r] ? <span className="text-emerald-400">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

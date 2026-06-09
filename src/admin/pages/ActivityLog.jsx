import { useState, useEffect } from 'react';
import { useAdmin, DataTable, Drawer, RelTime, Pagination, FilterSelect, Badge, Field } from '../ui.jsx';
import { adminQuery } from '../api.js';

const PER = 50;
const actionTone = (a) => ({ created: 'green', updated: 'blue', deleted: 'red', restored: 'indigo' }[a] || 'grey');

export function ActivityLogPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [ws, setWs] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  // Filter option lists (small dataset → fetch once)
  const { data: meta } = useAdmin(async () => {
    const [all, workstations, profiles] = await Promise.all([
      adminQuery({ table: 'activity_log', select: 'entity_type, action', limit: 5000 }),
      adminQuery({ table: 'workstations', select: 'id,name', limit: 500 }),
      adminQuery({ table: 'profiles', select: 'id,name', limit: 2000 }),
    ]);
    return {
      entityTypes: [...new Set(all.rows.map((r) => r.entity_type).filter(Boolean))].sort(),
      actions: [...new Set(all.rows.map((r) => r.action).filter(Boolean))].sort(),
      wsMap: Object.fromEntries(workstations.rows.map((w) => [w.id, w.name])),
      wsList: workstations.rows,
      profileMap: Object.fromEntries(profiles.rows.map((p) => [p.id, p.name])),
    };
  }, []);

  useEffect(() => { setOffset(0); }, [entityType, action, ws, from, to]);

  const { data, loading, error, reload } = useAdmin(() => {
    const filters = [];
    if (entityType) filters.push({ col: 'entity_type', op: 'eq', val: entityType });
    if (action) filters.push({ col: 'action', op: 'eq', val: action });
    if (ws) filters.push({ col: 'workstation_id', op: 'eq', val: ws });
    if (from) filters.push({ col: 'created_at', op: 'gte', val: new Date(from).toISOString() });
    if (to) filters.push({ col: 'created_at', op: 'lte', val: new Date(to + 'T23:59:59').toISOString() });
    return adminQuery({ table: 'activity_log', select: '*', order: 'created_at', ascending: false, filters, limit: PER, offset, count: true });
  }, [entityType, action, ws, from, to, offset]);

  const columns = [
    { key: 'created_at', label: 'When', render: (r) => <RelTime date={r.created_at} /> },
    { key: 'actor', label: 'Actor', render: (r) => meta?.profileMap?.[r.actor_id] || <span className="text-muted-foreground">system</span> },
    { key: 'action', label: 'Action', render: (r) => <Badge tone={actionTone(r.action)}>{r.action}</Badge> },
    { key: 'entity_type', label: 'Entity', render: (r) => <span className="text-muted-foreground">{r.entity_type}</span> },
    { key: 'entity_label', label: 'Label', render: (r) => <span className="line-clamp-1 max-w-[240px] inline-block align-bottom">{r.entity_label || '—'}</span> },
    { key: 'ws', label: 'Workstation', render: (r) => meta?.wsMap?.[r.workstation_id] || '—' },
    { key: 'meta', label: '', render: (r) => r.meta ? <span className="text-xs text-primary">view</span> : null },
  ];

  const dateCls = 'px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:border-primary text-muted-foreground';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect value={entityType} onChange={setEntityType} options={meta?.entityTypes || []} allLabel="All entities" />
        <FilterSelect value={action} onChange={setAction} options={meta?.actions || []} allLabel="All actions" />
        <FilterSelect value={ws} onChange={setWs} options={(meta?.wsList || []).map((w) => ({ value: w.id, label: w.name }))} allLabel="All workstations" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateCls} title="From" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateCls} title="To" />
      </div>
      <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload} onRowClick={setSelected} dense />
      <Pagination offset={offset} limit={PER} count={data?.count} onPage={setOffset} />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Activity detail" subtitle={selected ? new Date(selected.created_at).toLocaleString() : ''}>
        {selected && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Actor">{meta?.profileMap?.[selected.actor_id] || 'system'}</Field>
              <Field label="Action"><Badge tone={actionTone(selected.action)}>{selected.action}</Badge></Field>
              <Field label="Entity type">{selected.entity_type}</Field>
              <Field label="Entity label">{selected.entity_label || '—'}</Field>
              <Field label="Workstation">{meta?.wsMap?.[selected.workstation_id] || '—'}</Field>
              <Field label="Entity ID"><span className="font-mono text-xs break-all">{selected.entity_id || '—'}</span></Field>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Meta</div>
              <pre className="text-xs bg-card border border-border rounded-lg p-4 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(selected.meta ?? {}, null, 2)}</pre>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

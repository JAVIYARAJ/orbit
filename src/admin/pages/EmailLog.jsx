import { useState } from 'react';
import { useAdmin, DataTable, Badge, RelTime, Pagination, FilterSelect } from '../ui.jsx';
import { adminQuery } from '../api.js';

const PER = 50;

// email_log.status → Badge tone.
function emailTone(status) {
  const s = (status || '').toLowerCase();
  if (s === 'delivered') return 'green';
  if (s === 'sent') return 'blue';
  if (s === 'skipped') return 'grey';
  if (s === 'deferred') return 'yellow';
  if (['bounced', 'blocked', 'spam', 'invalid', 'failed'].includes(s)) return 'red';
  return 'grey';
}

const KIND_LABEL = { welcome: 'Welcome', contact_reply: 'Contact reply', invite: 'Workspace invite' };

export function EmailLogPage() {
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [offset, setOffset] = useState(0);

  const filters = [];
  if (status) filters.push({ col: 'status', op: 'eq', val: status });
  if (kind) filters.push({ col: 'kind', op: 'eq', val: kind });

  const { data, loading, error, reload } = useAdmin(
    () => adminQuery({ table: 'email_log', select: '*', order: 'created_at', ascending: false, filters, limit: PER, offset, count: true }),
    [status, kind, offset]
  );

  const columns = [
    { key: 'created_at', label: 'When', render: (r) => <RelTime date={r.created_at} /> },
    { key: 'kind', label: 'Type', render: (r) => <Badge tone="indigo">{KIND_LABEL[r.kind] || r.kind}</Badge> },
    { key: 'to_email', label: 'Recipient', render: (r) => <span className="text-muted-foreground">{r.to_email}</span> },
    { key: 'subject', label: 'Subject', render: (r) => <span className="line-clamp-1 max-w-[260px] inline-block align-bottom">{r.subject || '—'}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={emailTone(r.status)} dot>{r.status}</Badge> },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-muted-foreground">{r.reason || '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect value={kind} onChange={(v) => { setKind(v); setOffset(0); }}
          options={['welcome', 'contact_reply', 'invite']} allLabel="All types" />
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setOffset(0); }}
          options={['sent', 'delivered', 'bounced', 'blocked', 'spam', 'invalid', 'deferred', 'failed', 'skipped']} allLabel="All statuses" />
        <span className="text-sm text-muted-foreground">Delivery status updates from Brevo webhooks.</span>
      </div>

      <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload}
        emptyText="No emails sent yet." />
      <Pagination offset={offset} limit={PER} count={data?.count} onPage={setOffset} />
    </div>
  );
}

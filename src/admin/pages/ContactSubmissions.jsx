import { useState, useEffect, useMemo } from 'react';
import { useAdmin, DataTable, Drawer, Badge, RelTime, Pagination, FilterSelect, Field, DrawerSection, statusTone } from '../ui.jsx';
import { adminQuery, adminUpdateContact, adminSendContactReply, adminListReplyTemplates, applyTemplateVars } from '../api.js';

const PER = 50;
const NEXT = { new: 'seen', seen: 'resolved', resolved: 'new' };
const DEFAULT_SUBJECT = 'Re: your {type} on Orbit';

export function ContactSubmissionsPage() {
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  // Reply compose state — reset whenever a different submission is opened.
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('template'); // 'template' | 'custom'
  const [sending, setSending] = useState(false);
  const [replyMsg, setReplyMsg] = useState(null); // { ok: bool, text: string }

  // Load the editable templates once; index them by contact type.
  const { data: tplData } = useAdmin(() => adminListReplyTemplates(), []);
  const byType = useMemo(() => {
    const m = {};
    for (const t of tplData?.rows ?? []) m[t.type] = t;
    return m;
  }, [tplData]);

  // Fill the subject/message fields for a given mode + submission.
  const applyMode = (nextMode, sub) => {
    if (!sub) return;
    if (nextMode === 'template') {
      const tpl = byType[sub.type];
      setSubject(applyTemplateVars(tpl?.subject || DEFAULT_SUBJECT, sub));
      setMessage(applyTemplateVars(tpl?.body || '', sub));
    } else {
      setSubject(applyTemplateVars(DEFAULT_SUBJECT, sub));
      setMessage('');
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    applyMode(nextMode, selected);
  };

  useEffect(() => {
    if (!selected) return;
    setMode('template');
    applyMode('template', selected);
    setReplyMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, byType]);

  const sendReply = async () => {
    setSending(true);
    setReplyMsg(null);
    try {
      await adminSendContactReply({ id: selected.id, subject, message });
      setMessage('');
      setReplyMsg({ ok: true, text: '✓ Reply sent' });
      setSelected((s) => (s ? { ...s, status: 'resolved' } : s));
      reload();
    } catch (e) {
      setReplyMsg({ ok: false, text: e.message || 'Failed to send reply' });
    } finally {
      setSending(false);
    }
  };

  const filters = status ? [{ col: 'status', op: 'eq', val: status }] : [];
  const { data, loading, error, reload } = useAdmin(
    () => adminQuery({ table: 'contact_submissions', select: '*', order: 'created_at', ascending: false, filters, limit: PER, offset, count: true }),
    [status, offset]
  );

  const cycleStatus = async (row) => {
    const next = NEXT[row.status] || 'seen';
    setSaving(true);
    try {
      await adminUpdateContact(row.id, next);
      setSelected((s) => (s && s.id === row.id ? { ...s, status: next } : s));
      reload();
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'email', label: 'Email', render: (r) => <span className="text-muted-foreground">{r.email}</span> },
    { key: 'role', label: 'Role' },
    { key: 'type', label: 'Type', render: (r) => <Badge tone="indigo">{r.type}</Badge> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)} dot>{r.status}</Badge> },
    { key: 'created_at', label: 'Submitted', render: (r) => <RelTime date={r.created_at} /> },
    { key: 'description', label: 'Message', render: (r) => <span className="text-muted-foreground line-clamp-1 max-w-[260px] inline-block align-bottom">{r.description}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setOffset(0); }} options={['new', 'seen', 'resolved']} allLabel="All statuses" />
        <span className="text-sm text-muted-foreground">Tip: <span className="text-amber-400 font-semibold">new</span> = unread leads</span>
      </div>

      <DataTable columns={columns} rows={data?.rows} loading={loading} error={error} onRetry={reload}
        onRowClick={setSelected} emptyText="No submissions yet." />
      <Pagination offset={offset} limit={PER} count={data?.count} onPage={setOffset} />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name} subtitle={selected?.email}>
        {selected && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge tone={statusTone(selected.status)} dot>{selected.status}</Badge>
              <button disabled={saving} onClick={() => cycleStatus(selected)}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                Mark as “{NEXT[selected.status] || 'seen'}”
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Role">{selected.role}</Field>
              <Field label="Type"><Badge tone="indigo">{selected.type}</Badge></Field>
              <Field label="Email">{selected.email}</Field>
              <Field label="Submitted">{new Date(selected.created_at).toLocaleString()}</Field>
            </div>
            <DrawerSection title="Message">
              <p className="text-sm leading-relaxed whitespace-pre-wrap bg-card border border-border rounded-lg p-4">{selected.description}</p>
            </DrawerSection>
            <DrawerSection title="Reply">
              <div className="space-y-3">
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-card">
                  {[['template', 'Use default template'], ['custom', 'Custom message']].map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === m ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder="Write your reply…"
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary resize-y"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={sendReply}
                    disabled={sending || !subject.trim() || !message.trim()}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send reply'}
                  </button>
                  <a href={`mailto:${selected.email}`} className="text-sm text-muted-foreground hover:text-foreground">
                    Open in mail client →
                  </a>
                  {replyMsg && (
                    <span className={`text-sm font-medium ${replyMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                      {replyMsg.text}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Sends from your verified Brevo sender. The submission is marked resolved on success.</p>
              </div>
            </DrawerSection>
          </>
        )}
      </Drawer>
    </div>
  );
}

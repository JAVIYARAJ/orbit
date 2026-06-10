import { useState } from 'react';
import { useAdmin, Toggle } from '../ui.jsx';
import { adminQuery, adminSendBroadcast } from '../api.js';

export function BroadcastPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [chEmail, setChEmail] = useState(true);
  const [chNotify, setChNotify] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null); // { ok, started, total, notified } | { error }

  // Recipients: 'all' or a hand-picked set.
  const [mode, setMode] = useState('all'); // 'all' | 'specific'
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // id -> { id, name, email }
  const selectedIds = Object.keys(selected);

  // Count of users with an email (the "all" email audience).
  const { data: countData } = useAdmin(
    () => adminQuery({ table: 'profiles', select: 'id', filters: [{ col: 'email', op: 'not_is', val: null }], limit: 1, count: true }),
    []
  );
  const recipientCount = countData?.count ?? null;

  // Searchable user list for "specific" mode.
  const { data: usersData, loading: usersLoading } = useAdmin(
    () => adminQuery({
      table: 'profiles', select: 'id,name,email',
      search: search.trim() ? { term: search.trim(), columns: ['name', 'email'] } : undefined,
      order: 'created_at', ascending: false, limit: 50,
    }),
    [search]
  );
  const users = usersData?.rows ?? [];

  const toggleUser = (u) => setSelected((s) => {
    const next = { ...s };
    if (next[u.id]) delete next[u.id]; else next[u.id] = { id: u.id, name: u.name, email: u.email };
    return next;
  });

  const enoughRecipients = mode === 'all' || selectedIds.length > 0;
  const canSend = subject.trim() && message.trim() && (chEmail || chNotify) && enoughRecipients && !sending;

  const send = async () => {
    setSending(true);
    setResult(null);
    setConfirming(false);
    try {
      const res = await adminSendBroadcast({
        subject, message,
        image_url: imageUrl.trim() || undefined,
        email: chEmail, notify: chNotify,
        user_ids: mode === 'specific' ? selectedIds : undefined,
      });
      setResult(res);
    } catch (e) {
      setResult({ error: e.message || 'Failed to send broadcast' });
    } finally {
      setSending(false);
    }
  };

  const previewBody = message.replace(/\{name\}/gi, 'Amin');
  const audienceLabel = mode === 'specific' ? `${selectedIds.length} selected ${selectedIds.length === 1 ? 'user' : 'users'}` : 'all users';

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg bg-muted/40 border border-border p-4 text-sm text-muted-foreground leading-relaxed">
        Send a one-off message via email and/or an in-app notification — to <span className="text-foreground font-semibold">all users</span> or
        a <span className="text-foreground font-semibold">specific selection</span>. For email, the greeting <span className="text-foreground">“Hi {'{name}'},”</span> and
        Orbit branding are added automatically; use <code className="text-foreground font-mono">{'{name}'}</code> to insert each
        person's name. Image is email-only — paste a public <code className="text-foreground font-mono">https://</code> URL.
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Subject / Title</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A quick update from Orbit"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            placeholder="Write your message…"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary resize-y"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Image URL (optional, email only)</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://res.cloudinary.com/…/banner.png"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Channels</label>
          <div className="flex items-center gap-6 flex-wrap">
            <Toggle checked={chEmail} onChange={setChEmail} label="Email" />
            <Toggle checked={chNotify} onChange={setChNotify} label="In-app notification" />
          </div>
          {!chEmail && !chNotify && <p className="text-xs text-red-500">Pick at least one channel.</p>}
        </div>

        {/* Recipients */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Recipients</label>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
            {[['all', `All users${recipientCount != null ? ` (${recipientCount})` : ''}`], ['specific', 'Specific users']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${mode === m ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'specific' && (
            <div className="space-y-2 pt-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name or email…"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
              />

              {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(selected).map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
                      {u.name || u.email}
                      <button onClick={() => toggleUser(u)} className="hover:text-foreground">×</button>
                    </span>
                  ))}
                  <button onClick={() => setSelected({})} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">Clear all</button>
                </div>
              )}

              <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {usersLoading && <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>}
                {!usersLoading && users.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No users found.</p>}
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                    <input type="checkbox" checked={!!selected[u.id]} onChange={() => toggleUser(u)} className="accent-primary" />
                    <span className="font-medium">{u.name || '—'}</span>
                    <span className="text-muted-foreground text-xs truncate">{u.email || 'no email'}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedIds.length} selected{search.trim() ? ' · showing search matches (max 50)' : ' · showing newest 50 — search to find more'}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Preview</label>
          <div className="rounded-lg border border-border bg-background p-4 text-sm leading-relaxed">
            <p className="font-semibold mb-3">Hi Amin,</p>
            {imageUrl.trim() && (
              <img src={imageUrl.trim()} alt="" className="w-full max-w-md rounded-lg mb-3"
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
            <p className="whitespace-pre-wrap text-muted-foreground">{previewBody || '—'}</p>
          </div>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {mode === 'specific' ? `Send to ${selectedIds.length} selected` : 'Send to all users'}
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <span className="text-sm text-amber-500 font-medium">
              Send to {audienceLabel} via {[chEmail && 'email', chNotify && 'in-app notification'].filter(Boolean).join(' + ')}? This can't be undone.
            </span>
            <button onClick={send} disabled={sending}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {sending ? 'Sending…' : 'Yes, send now'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={sending}
              className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:border-primary">
              Cancel
            </button>
          </div>
        )}

        {result && !result.error && (
          <p className="text-sm font-medium text-emerald-500">
            ✓ Broadcast sent
            {result.total ? <> — email queued for {result.total} {result.total === 1 ? 'user' : 'users'} (track in the <span className="font-semibold">Email Log</span>)</> : null}
            {result.notified ? <>{result.total ? '; ' : ' — '}in-app notification delivered to {result.notified} {result.notified === 1 ? 'user' : 'users'}</> : null}.
          </p>
        )}
        {result?.error && <p className="text-sm font-medium text-red-500">{result.error}</p>}
      </div>
    </div>
  );
}

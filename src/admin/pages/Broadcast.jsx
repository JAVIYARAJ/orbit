import { useState } from 'react';
import { Send, Info, Bell, Image as ImageIcon, Sparkles, AlertCircle, Mail } from 'lucide-react';
import { useAdmin, Toggle } from '../ui.jsx';
import { adminQuery, adminSendBroadcast } from '../api.js';
import { uploadBroadcastImage } from '../../lib/cloudinary.js';

export function BroadcastPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageSource, setImageSource] = useState('url'); // 'url' | 'upload'
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
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
      table: 'profiles', select: 'id,name,email,email_notifications,web_notifications',
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

  // A user who has turned off EITHER channel is treated as opted-out and can't be
  // picked for a broadcast (the backend would skip them on that channel anyway).
  const isOptedOut = (u) => u.email_notifications === false || u.web_notifications === false;

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    setUploadErr('');
    try {
      const url = await uploadBroadcastImage(file);
      setImageUrl(url);
    } catch (err) {
      setUploadErr(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const enoughRecipients = mode === 'all' || selectedIds.length > 0;
  const canSend = subject.trim() && message.trim() && (chEmail || chNotify) && enoughRecipients && !sending && !uploading;

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

  const audienceLabel = mode === 'specific' ? `${selectedIds.length} selected ${selectedIds.length === 1 ? 'user' : 'users'}` : 'all users';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-5 shadow-lg shadow-primary/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        <div className="text-sm text-foreground/80 leading-relaxed relative z-10">
          <p className="font-semibold text-foreground mb-1.5 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            How broadcasts work
          </p>
          Send a one-off message via email and/or an in-app notification — to <span className="text-foreground font-semibold">all users</span> or
          a <span className="text-foreground font-semibold">specific selection</span>. For email, the greeting <span className="text-foreground font-medium">“Hi {'{name}'},”</span> and
          Orbit branding are added automatically; use <code className="text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded-md text-xs">{'{name}'}</code> to insert each
          person's name. An image (upload or direct URL) is <span className="text-foreground font-medium">email-only</span> — it isn't shown in notifications.
        </div>
      </div>

      <div className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border p-6 space-y-6 shadow-lg shadow-foreground/5 group hover:bg-card/80 transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full pointer-events-none" />

        <div className="flex items-center gap-2 border-b border-border pb-4 relative z-10">
          <Send className="w-5 h-5 text-primary/70" />
          <h3 className="font-bold text-lg">Compose Broadcast</h3>
        </div>

        <div className="space-y-1.5 relative z-10">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Subject / Title</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A quick update from Orbit"
            className="w-full px-4 py-2.5 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
          />
        </div>

        <div className="space-y-1.5 relative z-10">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            placeholder="Write your message…"
            className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm resize-y"
          />
        </div>

        <div className="space-y-2 relative z-10">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Image <span className="normal-case font-normal text-[11px] opacity-70">(optional, email only)</span>
          </label>
          <div className="inline-flex rounded-xl border border-border p-1 bg-muted/50 backdrop-blur-md">
            {[['url', 'Image URL'], ['upload', 'Upload']].map(([m, label]) => (
              <button key={m} type="button" onClick={() => setImageSource(m)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${imageSource === m ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                style={imageSource === m ? { color: '#ffffff' } : {}}>
                {label}
              </button>
            ))}
          </div>

          {imageSource === 'url' ? (
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://res.cloudinary.com/…/banner.png"
              className="w-full px-4 py-2.5 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          ) : (
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm font-bold cursor-pointer hover:border-primary hover:bg-background/80 transition-all shadow-sm w-fit group">
                <input type="file" accept="image/*" onChange={onPickFile} className="hidden" disabled={uploading} />
                <ImageIcon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                {uploading ? 'Uploading…' : 'Choose image…'}
              </label>
              {uploadErr && <p className="text-xs text-red-500 font-medium">{uploadErr}</p>}
            </div>
          )}

          {imageUrl.trim() && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate max-w-[360px]">{imageUrl.trim()}</span>
              <button type="button" onClick={() => setImageUrl('')} className="underline hover:text-foreground">Remove</button>
            </div>
          )}
        </div>

        <div className="space-y-2 relative z-10 pt-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Channels</label>
          <div className="flex items-center gap-6 flex-wrap bg-background/30 rounded-xl border border-border p-4 backdrop-blur-sm">
            <Toggle checked={chEmail} onChange={setChEmail} label="Email" />
            <Toggle checked={chNotify} onChange={setChNotify} label="In-app notification" />
          </div>
          {!chEmail && !chNotify && <p className="text-xs text-red-500 font-medium pl-1">Pick at least one channel.</p>}
        </div>

        {/* Recipients */}
        <div className="space-y-3 relative z-10 pt-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Recipients</label>
          <div>
            <div className="inline-flex rounded-xl border border-border p-1 bg-muted/50 backdrop-blur-md">
              {[['all', `All users${recipientCount != null ? ` (${recipientCount})` : ''}`], ['specific', 'Specific users']].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${mode === m ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  style={mode === m ? { color: '#ffffff' } : {}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'specific' && (
            <div className="space-y-3 pt-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name or email…"
                className="w-full px-4 py-2.5 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />

              {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-2 bg-background/20 p-3 rounded-xl border border-border">
                  {Object.values(selected).map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold shadow-sm">
                      {u.name || u.email}
                      <button onClick={() => toggleUser(u)} className="hover:text-[#ffffff] hover:bg-primary/40 rounded-full w-4 h-4 flex items-center justify-center transition-colors">×</button>
                    </span>
                  ))}
                  <button onClick={() => setSelected({})} className="text-xs font-medium text-muted-foreground hover:text-foreground underline ml-1 px-2">Clear all</button>
                </div>
              )}

              <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-muted/50 divide-y divide-white/5 backdrop-blur-sm shadow-inner">
                {usersLoading && <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>}
                {!usersLoading && users.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No users found.</p>}
                {users.map((u) => {
                  const optedOut = isOptedOut(u);
                  return (
                    <label
                      key={u.id}
                      title={optedOut ? 'This user turned off email or in-app notifications and won’t receive broadcasts.' : undefined}
                      className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${optedOut ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted'}`}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected[u.id]}
                        disabled={optedOut}
                        onChange={() => toggleUser(u)}
                        className="accent-primary w-4 h-4 rounded border-border disabled:cursor-not-allowed"
                      />
                      <span className="font-semibold text-sm shrink-0">{u.name || '—'}</span>
                      <span className="text-muted-foreground text-xs truncate flex-1">{u.email || 'no email'}</span>
                      {u.email_notifications === false && (
                        <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">No email</span>
                      )}
                      {u.web_notifications === false && (
                        <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">No in-app</span>
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] font-medium text-muted-foreground pl-1">
                {selectedIds.length} selected{search.trim() ? ' · showing search matches (max 50)' : ' · showing newest 50 — search to find more'}
              </p>
              <p className="text-[11px] text-muted-foreground pl-1">
                Users who turned off email or in-app notifications are tagged, greyed out, and can’t be selected.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 relative z-10 pt-4 border-t border-border mt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Preview</label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chEmail && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 ml-1">
                  <Mail className="w-3 h-3" /> Email
                </p>
                <div className="rounded-xl border border-border bg-muted/50 backdrop-blur-sm p-5 text-sm leading-relaxed shadow-inner">
                  <p className="font-semibold mb-3 text-foreground/90">Hi {'{name}'},</p>
                  {imageUrl.trim() && (
                    <img src={imageUrl.trim()} alt="" className="w-full max-w-md rounded-xl mb-4 border border-border shadow-md"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <p className="whitespace-pre-wrap text-muted-foreground">{message || <span className="italic opacity-50">Email body will appear here...</span>}</p>
                </div>
              </div>
            )}

            {chNotify && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 ml-1">
                  <Bell className="w-3 h-3" /> In-app notification
                </p>
                <div className="rounded-xl border border-border bg-muted/50 backdrop-blur-sm p-4 flex gap-4 items-start shadow-inner">
                  <span className="w-10 h-10 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center shadow-inner border border-primary/20">
                    <Bell className="w-5 h-5 fill-current" />
                  </span>
                  <div className="min-w-0 mt-0.5">
                    <p className="font-bold text-sm text-foreground/90 leading-tight">{subject || 'Notification Title'}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{message || <span className="italic opacity-50">Message preview</span>}</p>
                  </div>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground ml-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Notifications don't show images.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 pt-4 border-t border-border mt-4">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!canSend}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-[#ffffff] border border-primary/20 shadow-md shadow-primary/20 text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 flex items-center gap-2 group" style={{ color: "#ffffff" }}
            >
              {mode === 'specific' ? `Send to ${selectedIds.length} selected` : 'Send to all users'}
              <Send className="w-4 h-4 ml-1 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-inner">
              <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-amber-500 font-medium">
                  Send to <strong className="font-bold">{audienceLabel}</strong> via <strong className="font-bold">{[chEmail && 'email', chNotify && 'in-app notification'].filter(Boolean).join(' + ')}</strong>?<br/>
                  <span className="opacity-80 text-xs">This action cannot be undone.</span>
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={send} disabled={sending}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-[#ffffff] text-sm font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2">
                  {sending ? 'Sending…' : <><Send className="w-4 h-4" /> Yes, send now</>}
                </button>
                <button onClick={() => setConfirming(false)} disabled={sending}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-bold transition-all active:scale-95 text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

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

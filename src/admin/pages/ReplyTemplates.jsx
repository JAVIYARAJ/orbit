import { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, Info } from 'lucide-react';
import { useAdmin } from '../ui.jsx';
import { adminListReplyTemplates, adminUpsertReplyTemplate } from '../api.js';
import { fmtDate } from '../../lib/dateUtils.js';

// Order matches the contact form's type dropdown.
const TYPES = ['General query', 'Bug / Issue', 'Feature request', 'Feedback', 'Partnership', 'Other'];

function TemplateCard({ type, tpl }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Populate fields once the template row loads from the server.
  useEffect(() => {
    setSubject(tpl?.subject ?? '');
    setBody(tpl?.body ?? '');
  }, [tpl?.subject, tpl?.body]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await adminUpsertReplyTemplate({ type, subject, body });
      setMsg({ ok: true, text: '✓ Saved' });
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border p-6 space-y-5 shadow-lg shadow-foreground/5 group hover:bg-card/80 transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full pointer-events-none" />
      <div className="flex items-center justify-between gap-3 relative z-10">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary/70" />
          {type}
        </h3>
        {tpl?.updated_at && (
          <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
            Updated {fmtDate(tpl.updated_at)}
          </span>
        )}
      </div>
      <div className="space-y-1.5 relative z-10">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Re: your {type} on Orbit"
          className="w-full px-4 py-2.5 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
        />
      </div>
      <div className="space-y-1.5 relative z-10">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Message body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Thanks for reaching out…"
          className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm resize-y"
        />
      </div>
      <div className="flex items-center gap-4 relative z-10 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-[#ffffff] border border-primary/20 shadow-md shadow-primary/20 text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 flex items-center gap-2" style={{ color: "#ffffff" }}
        >
          {saving ? 'Saving…' : <><Sparkles className="w-4 h-4" /> Save Template</>}
        </button>
        {msg && (
          <span className={`text-sm font-medium ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}

export function ReplyTemplatesPage() {
  const { data, loading, error, reload } = useAdmin(() => adminListReplyTemplates(), []);
  const byType = {};
  for (const t of data?.rows ?? []) byType[t.type] = t;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-5 shadow-lg shadow-primary/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        <div className="text-sm text-foreground/80 leading-relaxed relative z-10">
          <p className="font-semibold text-foreground mb-1.5 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            How templates work
          </p>
          Edit the default reply used for each contact type. Placeholders{' '}
          <code className="text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded-md text-xs">{'{name}'}</code> and{' '}
          <code className="text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded-md text-xs">{'{type}'}</code> are auto-filled per recipient.
          The greeting <span className="text-foreground font-medium">“Hi {'{name}'},”</span> is added automatically —
          no need to repeat it here.
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading templates…</p>}
      {error && (
        <p className="text-sm text-red-500">
          {error} <button onClick={reload} className="underline">Retry</button>
        </p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {TYPES.map((type) => <TemplateCard key={type} type={type} tpl={byType[type]} />)}
        </div>
      )}
    </div>
  );
}

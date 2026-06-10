import { useState, useEffect } from 'react';
import { useAdmin } from '../ui.jsx';
import { adminListReplyTemplates, adminUpsertReplyTemplate } from '../api.js';

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
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{type}</h3>
        {tpl?.updated_at && (
          <span className="text-xs text-muted-foreground">Updated {new Date(tpl.updated_at).toLocaleDateString()}</span>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Re: your {type} on Orbit"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Message body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Thanks for reaching out…"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary resize-y"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
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
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-border p-4 text-sm text-muted-foreground leading-relaxed">
        Edit the default reply used for each contact type. Placeholders{' '}
        <code className="text-foreground font-mono">{'{name}'}</code> and{' '}
        <code className="text-foreground font-mono">{'{type}'}</code> are auto-filled per recipient.
        The greeting <span className="text-foreground">“Hi {'{name}'},”</span> is added automatically —
        no need to repeat it here.
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

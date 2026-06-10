import { useState, useEffect } from 'react';
import { useAdmin, Toggle } from '../ui.jsx';
import { adminGetAppTemplate, adminUpsertAppTemplate } from '../api.js';

export function WelcomeEmailPage() {
  const { data, loading, error, reload } = useAdmin(() => adminGetAppTemplate('welcome'), []);
  const tpl = data?.template;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setSubject(tpl?.subject ?? '');
    setBody(tpl?.body ?? '');
    setEnabled(tpl?.enabled ?? true);
  }, [tpl?.subject, tpl?.body, tpl?.enabled]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await adminUpsertAppTemplate({ key: 'welcome', subject, body, enabled });
      setMsg({ ok: true, text: '✓ Saved' });
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const previewBody = body.replace(/\{name\}/gi, 'Amin');

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg bg-muted/40 border border-border p-4 text-sm text-muted-foreground leading-relaxed">
        This email is sent automatically when a new user signs up. The placeholder{' '}
        <code className="text-foreground font-mono">{'{name}'}</code> is replaced with the user's name.
        The greeting <span className="text-foreground">“Hi {'{name}'},”</span> and the Orbit branding
        are added automatically — just write the body.
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-red-500">{error} <button onClick={reload} className="underline">Retry</button></p>
      )}

      {!loading && !error && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'Enabled' : 'Disabled'} />
            {tpl?.updated_at && (
              <span className="text-xs text-muted-foreground">Updated {new Date(tpl.updated_at).toLocaleString()}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Welcome to Orbit, {name}!"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Welcome aboard…"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary resize-y"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Preview</label>
            <div className="rounded-lg border border-border bg-background p-4 text-sm leading-relaxed">
              <p className="font-semibold mb-3">Hi Amin,</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{previewBody || '—'}</p>
            </div>
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
      )}
    </div>
  );
}

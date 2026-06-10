import { useState, useEffect } from 'react';
import { Mail, Sparkles, Eye, Info } from 'lucide-react';
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
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-5 shadow-lg shadow-primary/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        <div className="text-sm text-foreground/80 leading-relaxed relative z-10">
          <p className="font-semibold text-foreground mb-1.5 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            How this works
          </p>
          This email is sent automatically when a new user signs up. The placeholder{' '}
          <code className="text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded-md text-xs">{'{name}'}</code> is replaced with the user's name.
          The greeting <span className="text-foreground font-medium">“Hi {'{name}'},”</span> and the Orbit branding
          are added automatically — just write the body.
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-red-500">{error} <button onClick={reload} className="underline">Retry</button></p>
      )}

      {!loading && !error && (
        <div className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border p-6 space-y-6 shadow-lg shadow-foreground/5 group hover:bg-card/80 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full pointer-events-none" />
          
          <div className="flex items-center justify-between gap-3 relative z-10 border-b border-border pb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary/70" />
              Welcome Template
            </h3>
            <div className="flex items-center gap-4">
              {tpl?.updated_at && (
                <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border hidden sm:inline-block">
                  Updated {new Date(tpl.updated_at).toLocaleDateString()}
                </span>
              )}
              <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'Active' : 'Disabled'} />
            </div>
          </div>

          <div className="space-y-1.5 relative z-10">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Welcome to Orbit, {name}!"
              className="w-full px-4 py-2.5 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>

          <div className="space-y-1.5 relative z-10">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Message Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Welcome aboard…"
              className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-md border border-border text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm resize-y"
            />
          </div>

          <div className="space-y-1.5 relative z-10">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Preview
            </label>
            <div className="rounded-xl border border-border bg-muted/50 backdrop-blur-sm p-5 text-sm leading-relaxed shadow-inner">
              <p className="font-semibold mb-3 text-foreground/90">Hi Amin,</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{previewBody || <span className="italic opacity-50">Email body will appear here...</span>}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10 pt-2 border-t border-border mt-6 pt-6">
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
      )}
    </div>
  );
}

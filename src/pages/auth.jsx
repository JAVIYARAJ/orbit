// auth.jsx — Login & Sign-up screens

import { useState } from 'react';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';

const PILLS = ['Projects', 'Kanban', 'Analytics', 'Vault', 'Timer', 'Notes', 'Email Hub', 'Toolkit'];

const HEATMAP = [
  0,1,0,2,1,3,2,1,0,1,2,3,2,1,2,3,4,3,2,1,
  1,2,1,3,2,4,3,2,1,2,3,4,3,2,3,4,3,2,1,2,
  0,1,2,1,3,2,1,2,3,2,1,2,3,4,2,3,2,1,2,3,
];

const PROJECTS_PREVIEW = [
  { id: 'KMBL',  name: 'Kombi — Loyalty App',       pct: 64, status: 'progress', color: '#0099ff' },
  { id: 'PULS',  name: 'Pulse — Habit Tracker',     pct: 78, status: 'progress', color: '#0099ff' },
  { id: 'NORTH', name: 'Northwind Field Service',   pct: 91, status: 'review',   color: '#ff9500' },
];

// Google "G" monogram SVG — inline to avoid external dependency
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.253 17.64 11.945 17.64 9.2z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const Spinner = ({ light }) => (
  <span className={`auth-spinner${light ? ' light' : ''}`} aria-hidden />
);

export const AuthPage = ({ onAuth }) => {
  const [mode,          setMode]         = useState('login');   // 'login' | 'signup' | 'forgot'
  const [name,          setName]         = useState('');
  const [email,         setEmail]        = useState('');
  const [password,      setPassword]     = useState('');
  const [showPw,        setShowPw]       = useState(false);
  const [remember,      setRemember]     = useState(true);
  const [loading,       setLoading]      = useState(false);
  const [googleLoading, setGoogleLoading]= useState(false);
  const [error,         setError]        = useState('');
  const [forgotSent,    setForgotSent]   = useState(false);

  const reset = (m) => { setMode(m); setError(''); setForgotSent(false); };

  const validate = () => {
    if (mode === 'signup' && !name.trim())       return 'Full name is required.';
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'Enter a valid email address.';
    if (mode !== 'forgot' && password.length < 6)   return 'Password must be at least 6 characters.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { setError('Enter a valid email address.'); return; }
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setForgotSent(true);
      return;
    }

    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split('@')[0] } },
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      if (data.user) {
        const displayName = name || email.split('@')[0];
        onAuth({ id: data.user.id, name: displayName, email, avatar: displayName[0].toUpperCase(), method: 'email' });
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError(error.message); return; }
      if (data.user) {
        const displayName = data.user.user_metadata?.name || email.split('@')[0];
        onAuth({ id: data.user.id, name: displayName, email, avatar: displayName[0].toUpperCase(), method: 'email' });
      }
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setGoogleLoading(false);
      setError(error.message);
    }
    // On success: Supabase redirects to Google — loading stays true until redirect
  };

  const busy = loading || googleLoading;

  return (
    <div className="auth-wrap">

      {/* ── Left brand panel ──────────────────────────────────────── */}
      <aside className="auth-panel">
        {/* Ambient glows */}
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-dot" />
          <span>DevOS</span>
          <span className="auth-logo-ver">v1.0</span>
        </div>

        {/* Hero headline */}
        <div className="auth-hero">
          <div className="auth-hero-eyebrow">Developer Dashboard</div>
          <h1 className="auth-hero-title">
            Track projects.<br />
            Ship on time.<br />
            <span className="auth-hero-accent">Stay in flow.</span>
          </h1>
          <p className="auth-hero-sub">
            One workspace for everything an indie builder needs — projects, tasks, analytics, vault, and deep-work sessions.
          </p>
        </div>

        {/* Mini dashboard preview card */}
        <div className="auth-preview">

          {/* Header */}
          <div className="auth-preview-hd">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3d3d' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff9500' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#25d366' }} />
            </div>
            <span className="auth-preview-title">devos — projects</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <div className="auth-preview-dot" />
              <div className="auth-preview-dot" />
              <div className="auth-preview-dot" />
            </div>
          </div>

          {/* Stat row */}
          <div className="auth-preview-stats">
            {[
              { v: '78',   l: 'SCORE',    c: 'var(--accent-hi)' },
              { v: '347h', l: 'TRACKED',  c: '#ff9500' },
              { v: '€46K', l: 'PIPELINE', c: '#25d366' },
              { v: '4/16', l: 'TASKS',    c: 'var(--text)' },
            ].map(s => (
              <div key={s.l} className="auth-preview-stat">
                <div className="auth-preview-stat-v" style={{ color: s.c }}>{s.v}</div>
                <div className="auth-preview-stat-l">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Project bars */}
          <div className="auth-preview-projects">
            {PROJECTS_PREVIEW.map(p => (
              <div key={p.id} className="auth-preview-proj">
                <div className="auth-preview-proj-row">
                  <span className="auth-preview-proj-id">{p.id}</span>
                  <span className="auth-preview-proj-name">{p.name}</span>
                  <span className="auth-preview-proj-pct" style={{ color: p.color }}>{p.pct}%</span>
                </div>
                <div className="auth-preview-bar">
                  <div style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Mini heatmap */}
          <div className="auth-preview-heatmap">
            {HEATMAP.map((l, i) => (
              <div key={i} className={`auth-preview-cell ${l > 0 ? `l${l}` : ''}`} />
            ))}
          </div>
        </div>

        {/* Feature pills */}
        <div className="auth-pills">
          {PILLS.map(p => (
            <span key={p} className="auth-pill">{p}</span>
          ))}
        </div>

        <div className="auth-panel-foot">
          Secure · Local-first · Open source
        </div>
      </aside>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <main className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          {/* Heading */}
          <div className="auth-form-head">
            <h2>
              {mode === 'login'  ? 'Welcome back'    :
               mode === 'signup' ? 'Create account'  :
                                   'Reset password'}
            </h2>
            <p>
              {mode === 'login'  ? 'Sign in to your workspace'         :
               mode === 'signup' ? 'Set up your DevOS workspace'       :
                                   "We'll send a reset link to your email"}
            </p>
          </div>

          {/* ── Forgot-sent confirmation ── */}
          {forgotSent ? (
            <div className="auth-success">
              <Icon name="check-circle" size={16} />
              Reset link sent to <strong>{email}</strong>. Check your inbox.
              <button type="button" className="auth-link" onClick={() => reset('login')}
                style={{ marginTop: 16 }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Google — only on login/signup */}
              {mode !== 'forgot' && (
                <>
                  <button
                    type="button"
                    className="auth-google-btn"
                    onClick={handleGoogle}
                    disabled={busy}
                  >
                    {googleLoading ? <Spinner /> : <GoogleIcon />}
                    {googleLoading ? 'Connecting…' : 'Continue with Google'}
                  </button>
                  <div className="auth-divider"><span>or</span></div>
                </>
              )}

              {/* Error */}
              {error && (
                <div className="auth-error" role="alert">
                  <Icon name="x" size={13} />
                  {error}
                </div>
              )}

              {/* Name — signup only */}
              {mode === 'signup' && (
                <div className="auth-field">
                  <label htmlFor="auth-name">Full name</label>
                  <input
                    id="auth-name" type="text" placeholder="Raunak Raj"
                    value={name} onChange={e => setName(e.target.value)}
                    autoComplete="name" disabled={busy}
                    autoFocus
                  />
                </div>
              )}

              {/* Email */}
              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email" type="email" placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  autoComplete="email" disabled={busy}
                  autoFocus={mode === 'login' || mode === 'forgot'}
                />
              </div>

              {/* Password — not on forgot */}
              {mode !== 'forgot' && (
                <div className="auth-field">
                  <label htmlFor="auth-pw">
                    Password
                    {mode === 'login' && (
                      <button
                        type="button"
                        className="auth-link auth-forgot-link"
                        onClick={() => reset('forgot')}
                        tabIndex={-1}
                      >
                        Forgot password?
                      </button>
                    )}
                  </label>
                  <div className="auth-pw-wrap">
                    <input
                      id="auth-pw"
                      type={showPw ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="auth-pw-toggle"
                      onClick={() => setShowPw(s => !s)}
                      tabIndex={-1}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showPw ? 'eye-off' : 'eye'} size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Remember me — login only */}
              {mode === 'login' && (
                <label className="auth-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                  />
                  <span>Stay signed in for 30 days</span>
                </label>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="auth-submit"
                disabled={busy}
              >
                {loading && <Spinner light />}
                {loading
                  ? (mode === 'forgot' ? 'Sending…' : 'Signing in…')
                  : mode === 'login'  ? 'Sign in'
                  : mode === 'signup' ? 'Create account'
                  :                    'Send reset link'}
              </button>

              {/* Mode switch */}
              <p className="auth-switch">
                {mode === 'login' ? (
                  <>New to DevOS?{' '}
                    <button type="button" className="auth-link" onClick={() => reset('signup')}>
                      Create a free account
                    </button>
                  </>
                ) : mode === 'signup' ? (
                  <>Already have an account?{' '}
                    <button type="button" className="auth-link" onClick={() => reset('login')}>
                      Sign in
                    </button>
                  </>
                ) : (
                  <button type="button" className="auth-link" onClick={() => reset('login')}>
                    Back to sign in
                  </button>
                )}
              </p>
            </>
          )}
        </form>
      </main>
    </div>
  );
};

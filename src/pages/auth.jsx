// auth.jsx — Login, Sign-up, Forgot password, Email confirmation, Reset password

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
  { id: 'KMBL',  name: 'Kombi — Loyalty App',     pct: 64, color: '#0099ff' },
  { id: 'PULS',  name: 'Pulse — Habit Tracker',   pct: 78, color: '#0099ff' },
  { id: 'NORTH', name: 'Northwind Field Service',  pct: 91, color: '#ff9500' },
];

// Friendly messages for common Supabase auth error codes
const friendlyError = (msg = '') => {
  if (msg.includes('Invalid login credentials'))   return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed'))          return 'Please confirm your email before signing in.';
  if (msg.includes('User already registered'))      return 'An account with this email already exists. Sign in instead.';
  if (msg.includes('Password should be at least'))  return 'Password must be at least 6 characters.';
  if (msg.includes('Unable to validate email'))     return 'Enter a valid email address.';
  if (msg.includes('For security purposes'))        return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('signup is disabled'))           return 'New sign-ups are currently disabled.';
  return msg;
};

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
  const [mode,          setMode]          = useState('login');   // login | signup | forgot
  const [name,          setName]          = useState('');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [showPw,        setShowPw]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,         setError]         = useState('');
  const [emailSent,     setEmailSent]     = useState(false); // covers both forgot + signup confirm
  const [emailSentType, setEmailSentType] = useState('');   // 'confirm' | 'reset'

  const reset = (m) => { setMode(m); setError(''); setEmailSent(false); };
  const busy  = loading || googleLoading;

  const validate = () => {
    if (mode === 'signup' && !name.trim())             return 'Full name is required.';
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))   return 'Enter a valid email address.';
    if (mode !== 'forgot' && password.length < 6)      return 'Password must be at least 6 characters.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ── Forgot password ──────────────────────────────────────────
    if (mode === 'forgot') {
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        setError('Enter a valid email address.');
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setLoading(false);
      if (error) { setError(friendlyError(error.message)); return; }
      setEmailSentType('reset');
      setEmailSent(true);
      return;
    }

    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);

    // ── Sign up ──────────────────────────────────────────────────
    if (mode === 'signup') {
      const displayName = name.trim() || email.split('@')[0];
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data:           { name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      setLoading(false);
      if (error) { setError(friendlyError(error.message)); return; }

      if (data.session) {
        // Email confirmation disabled — user is immediately active
        onAuth(buildUser(data.user));
      } else {
        // Supabase sent a confirmation email — show check-inbox screen
        setEmailSentType('confirm');
        setEmailSent(true);
      }
      return;
    }

    // ── Sign in ──────────────────────────────────────────────────
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(friendlyError(error.message)); return; }
    if (data.user) onAuth(buildUser(data.user));
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: window.location.origin },
    });
    if (error) {
      setGoogleLoading(false);
      setError(friendlyError(error.message));
    }
    // Success → Supabase redirects to Google; onAuthStateChange in App picks up the session
  };

  const buildUser = (u) => {
    const n = u.user_metadata?.name || u.email.split('@')[0];
    return { id: u.id, name: n, email: u.email, avatar: n[0].toUpperCase() };
  };

  return (
    <div className="auth-wrap">

      {/* ── Left brand panel ──────────────────────────────────── */}
      <aside className="auth-panel">
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />

        <div className="auth-logo">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
            <circle cx="9" cy="9" r="2.5" fill="currentColor"/>
            <ellipse cx="9" cy="9" rx="8" ry="3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85"/>
            <circle cx="17" cy="9" r="1.5" fill="currentColor"/>
          </svg>
          <span>Orbit</span>
          <span className="auth-logo-ver">v1.0</span>
        </div>

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

        <div className="auth-preview">
          <div className="auth-preview-hd">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3d3d' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff9500' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#25d366' }} />
            </div>
            <span className="auth-preview-title">orbit — projects</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <div className="auth-preview-dot" />
              <div className="auth-preview-dot" />
              <div className="auth-preview-dot" />
            </div>
          </div>

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

          <div className="auth-preview-heatmap">
            {HEATMAP.map((l, i) => (
              <div key={i} className={`auth-preview-cell ${l > 0 ? `l${l}` : ''}`} />
            ))}
          </div>
        </div>

        <div className="auth-pills">
          {PILLS.map(p => <span key={p} className="auth-pill">{p}</span>)}
        </div>

        <div className="auth-panel-foot">Secure · Local-first · Open source</div>
      </aside>

      {/* ── Right form panel ──────────────────────────────────── */}
      <main className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          {/* Heading */}
          <div className="auth-form-head">
            <h2>
              {mode === 'login'  ? 'Welcome back'   :
               mode === 'signup' ? 'Create account' :
                                   'Reset password'}
            </h2>
            <p>
              {mode === 'login'  ? 'Sign in to your workspace'         :
               mode === 'signup' ? 'Set up your Orbit workspace'       :
                                   "We'll send a reset link to your email"}
            </p>
          </div>

          {/* ── Email sent confirmation (signup confirm OR reset) ── */}
          {emailSent ? (
            <div className="auth-email-sent">
              <div className="auth-email-sent-icon">
                <Icon name="mail" size={22} />
              </div>
              <h3>Check your inbox</h3>
              {emailSentType === 'confirm' ? (
                <p>
                  We sent a confirmation link to <strong>{email}</strong>.<br />
                  Click the link to activate your account, then come back here to sign in.
                </p>
              ) : (
                <p>
                  We sent a password reset link to <strong>{email}</strong>.<br />
                  Check your inbox and follow the instructions.
                </p>
              )}
              <button
                type="button"
                className="auth-submit"
                style={{ marginTop: 8 }}
                onClick={() => reset('login')}
              >
                Back to sign in
              </button>
              <button type="button" className="auth-link" style={{ marginTop: 12 }}
                onClick={async () => {
                  setLoading(true);
                  if (emailSentType === 'confirm') {
                    await supabase.auth.resend({ type: 'signup', email });
                  } else {
                    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
                  }
                  setLoading(false);
                }}
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Resend email'}
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
                    id="auth-name" type="text" placeholder="Your name"
                    value={name} onChange={e => setName(e.target.value)}
                    autoComplete="name" disabled={busy} autoFocus
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
                      <button type="button" className="auth-link auth-forgot-link"
                        onClick={() => reset('forgot')} tabIndex={-1}>
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
                    <button type="button" className="auth-pw-toggle"
                      onClick={() => setShowPw(s => !s)} tabIndex={-1}
                      aria-label={showPw ? 'Hide password' : 'Show password'}>
                      <Icon name={showPw ? 'eye-off' : 'eye'} size={14} />
                    </button>
                  </div>
                  {/* Password strength bar — signup only */}
                  {mode === 'signup' && password.length > 0 && (
                    <PasswordStrength password={password} />
                  )}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="auth-submit" disabled={busy}>
                {loading && <Spinner light />}
                {loading
                  ? mode === 'signup' ? 'Creating account…'
                  : mode === 'forgot' ? 'Sending…'
                  :                    'Signing in…'
                  : mode === 'login'  ? 'Sign in'
                  : mode === 'signup' ? 'Create account'
                  :                    'Send reset link'}
              </button>

              {/* Mode switch */}
              <p className="auth-switch">
                {mode === 'login' ? (
                  <>New to Orbit?{' '}
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

// ── Password strength indicator ────────────────────────────────────
const PasswordStrength = ({ password }) => {
  const score = getStrength(password);
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#ef4444', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  return (
    <div className="auth-pw-strength">
      <div className="auth-pw-bars">
        {[0,1,2,3].map(i => (
          <div key={i} className="auth-pw-bar"
            style={{ background: i < score ? colors[score] : 'var(--border-2)' }} />
        ))}
      </div>
      <span style={{ color: colors[score], fontSize: 10 }}>{labels[score]}</span>
    </div>
  );
};

const getStrength = (pw) => {
  if (pw.length < 6) return 0;
  let s = 1;
  if (pw.length >= 8)                      s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw))             s++;
  return Math.min(s, 4);
};

// ── Reset Password Page (shown after clicking email link) ──────────────────
export const ResetPasswordPage = ({ onDone }) => {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6)      { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)     { setError('Passwords do not match.'); return; }

    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateErr) { setError(friendlyError(updateErr.message)); return; }

    setSuccess(true);
    // Sign the user out so they land on the login page with a clean session
    await supabase.auth.signOut();
    setTimeout(() => onDone(), 2200);
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-panel">
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />
        <div className="auth-logo">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
            <circle cx="9" cy="9" r="2.5" fill="currentColor"/>
            <ellipse cx="9" cy="9" rx="8" ry="3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.85"/>
            <circle cx="17" cy="9" r="1.5" fill="currentColor"/>
          </svg>
          <span>Orbit</span>
          <span className="auth-logo-ver">v1.0</span>
        </div>
        <div className="auth-hero">
          <div className="auth-hero-eyebrow">Developer Dashboard</div>
          <h1 className="auth-hero-title">
            Track projects.<br />
            Ship on time.<br />
            <span className="auth-hero-accent">Stay in flow.</span>
          </h1>
        </div>
        <div className="auth-panel-foot">Secure · Local-first · Open source</div>
      </aside>

      <main className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-form-head">
            <h2>Set new password</h2>
            <p>Choose a strong password for your account</p>
          </div>

          {success ? (
            <div className="auth-email-sent">
              <div className="auth-email-sent-icon">
                <Icon name="check" size={22} />
              </div>
              <h3>Password updated!</h3>
              <p>Your password has been changed. Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="auth-error" role="alert">
                  <Icon name="x" size={13} />
                  {error}
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="rp-pw">New password</label>
                <div className="auth-pw-wrap">
                  <input
                    id="rp-pw"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    autoComplete="new-password"
                    disabled={loading}
                    autoFocus
                  />
                  <button type="button" className="auth-pw-toggle"
                    onClick={() => setShowPw(s => !s)} tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    <Icon name={showPw ? 'eye-off' : 'eye'} size={14} />
                  </button>
                </div>
                {password.length > 0 && <PasswordStrength password={password} />}
              </div>

              <div className="auth-field">
                <label htmlFor="rp-confirm">Confirm new password</label>
                <input
                  id="rp-confirm"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(''); }}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading && <Spinner light />}
                {loading ? 'Updating password…' : 'Update password'}
              </button>
            </>
          )}
        </form>
      </main>
    </div>
  );
};

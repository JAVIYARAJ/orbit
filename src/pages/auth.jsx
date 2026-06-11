// auth.jsx — Login, Sign-up, Forgot password, Email confirmation, Reset password

import { useState, useEffect } from 'react';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';
import { acceptInvite, getInviteByToken } from '../lib/db.js';
import { useAuthConfig } from '../lib/useRemoteConfig.js';

// Pills sit on the actual ring edges.
// SVG viewBox=400×400, center=(200,200).
// Ring radii: r1=70, r2=120, r3=165.
// left = 50 + (r/400)*100 * cos(deg)  |  top = 50 + (r/400)*100 * sin(deg)
// Single accent color throughout — rings, dots, and pills all use #0ea5e9.
// Rings are differentiated only by opacity and dash pattern, not color.
const ACCENT = '#0ea5e9';

const MODULE_ORBITALS = [
  // inner ring
  { name: 'Projects', color: ACCENT, left: '67.5%', top: '50%'   },
  { name: 'Timer',    color: ACCENT, left: '32.5%', top: '50%'   },
  // middle ring
  { name: 'Kanban',    color: ACCENT, left: '71.2%', top: '25%'  },
  { name: 'Analytics', color: ACCENT, left: '71.2%', top: '75%'  },
  { name: 'Notes',     color: ACCENT, left: '28.8%', top: '75%'  },
  { name: 'Vault',     color: ACCENT, left: '28.8%', top: '25%'  },
  // outer ring
  { name: 'GitHub',    color: ACCENT, left: '79.6%', top: '20.7%'},
  { name: 'Email Hub', color: ACCENT, left: '79.6%', top: '79.3%'},
  { name: 'Learning',  color: ACCENT, left: '20.4%', top: '79.3%'},
  { name: 'Schedule',  color: ACCENT, left: '20.4%', top: '20.7%'},
];

const STATS_ROW = [
  { value: '14+', label: 'Integrated modules' },
  { value: '100%', label: 'Privacy-first' },
  { value: '∞', label: 'Projects & tasks' },
];

// Friendly messages for common Supabase auth error codes
const friendlyError = (msg = '') => {
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('Email not confirmed')) return 'Please confirm your email before signing in.';
  if (msg.includes('User already registered')) return 'An account with this email already exists. Sign in instead.';
  if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  if (msg.includes('Unable to validate email')) return 'Enter a valid email address.';
  if (msg.includes('For security purposes')) return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('signup is disabled')) return 'New sign-ups are currently disabled.';
  return msg;
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.253 17.64 11.945 17.64 9.2z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
  </svg>
);

const Spinner = ({ light }) => (
  <span className={`auth-spinner${light ? ' light' : ''}`} aria-hidden />
);

export const AuthPage = ({ onAuth }) => {
  const { googleAuthOnly, ready } = useAuthConfig();
  const [mode, setMode] = useState('login');   // login | signup | forgot
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false); // covers both forgot + signup confirm
  const [emailSentType, setEmailSentType] = useState('');   // 'confirm' | 'reset'

  const reset = (m) => { setMode(m); setError(''); setEmailSent(false); };
  const busy = loading || googleLoading;

  const validate = () => {
    if (mode === 'signup' && !name.trim()) return 'Full name is required.';
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'Enter a valid email address.';
    if (mode !== 'forgot' && password.length < 6) return 'Password must be at least 6 characters.';
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
          data: { name: displayName },
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
      options: { redirectTo: window.location.origin },
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
        <div className="auth-glow auth-glow-3" />

        {/* Logo */}
        <div className="auth-logo">
          <svg width="20" height="20" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="9" cy="9" r="3" fill="currentColor" />
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="9" cy="3" r="1.5" fill="currentColor" />
          </svg>
          <span>Orbit</span>
          <span className="auth-logo-ver">v1.0</span>
        </div>

        {/* Hero copy */}
        <div className="auth-hero">
          <div className="auth-hero-eyebrow">Developer OS</div>
          <h1 className="auth-hero-title">
            Your entire workflow,<br />
            <span className="auth-hero-accent">one orbit.</span>
          </h1>
          <p className="auth-hero-sub">
            The all-in-one workspace for indie developers — projects, deep-work sessions, vault, analytics, and more.
          </p>
        </div>

        {/* Orbital — fills remaining space, module pills orbit around it */}
        <div className="auth-orbital-wrap">
          <div className="auth-orbital">
            {/* SVG rings + animated dots */}
            <svg className="auth-orbital-svg" viewBox="0 0 400 400" fill="none">
              {/* Glow halos — single accent, fading outward */}
              <circle cx="200" cy="200" r="72"  stroke="rgba(14,165,233,0.14)" strokeWidth="18" fill="none" />
              <circle cx="200" cy="200" r="122" stroke="rgba(14,165,233,0.09)" strokeWidth="16" fill="none" />
              <circle cx="200" cy="200" r="167" stroke="rgba(14,165,233,0.05)" strokeWidth="14" fill="none" />
              {/* Rings — same color, differentiated by opacity + dash */}
              <circle cx="200" cy="200" r="70"  stroke="rgba(14,165,233,0.55)" strokeWidth="1" />
              <circle cx="200" cy="200" r="120" stroke="rgba(14,165,233,0.35)" strokeWidth="1" strokeDasharray="7 9" />
              <circle cx="200" cy="200" r="165" stroke="rgba(14,165,233,0.20)" strokeWidth="1" strokeDasharray="3 11" />
              {/* Core */}
              <circle cx="200" cy="200" r="32" fill="rgba(14,165,233,0.07)" stroke="rgba(14,165,233,0.40)" strokeWidth="1" />
              <circle cx="200" cy="200" r="18" fill="rgba(14,165,233,0.18)" />
              <circle cx="200" cy="200" r="8"  fill="#0ea5e9" />
              <circle cx="200" cy="200" r="8" fill="#0ea5e9" opacity="0.35">
                <animate attributeName="r" values="8;20;8" dur="2.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur="2.8s" repeatCount="indefinite" />
              </circle>
              {/* Orbiting dots — same accent */}
              <g className="auth-orb-g1">
                <circle cx="270" cy="200" r="5" fill="#0ea5e9" />
                <circle cx="270" cy="200" r="5" fill="#0ea5e9" opacity="0.3">
                  <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
              </g>
              <g className="auth-orb-g2">
                <circle cx="320" cy="200" r="4.5" fill="#0ea5e9" />
                <circle cx="320" cy="200" r="4.5" fill="#0ea5e9" opacity="0.25">
                  <animate attributeName="r" values="4.5;10;4.5" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.25;0;0.25" dur="2.5s" repeatCount="indefinite" />
                </circle>
              </g>
              <g className="auth-orb-g3">
                <circle cx="365" cy="200" r="4" fill="#0ea5e9" />
                <circle cx="365" cy="200" r="4" fill="#0ea5e9" opacity="0.2">
                  <animate attributeName="r" values="4;9;4" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0;0.2" dur="3s" repeatCount="indefinite" />
                </circle>
              </g>
            </svg>

            {/* Module pills — positioned around the 3 rings */}
            {MODULE_ORBITALS.map(m => (
              <div
                key={m.name}
                className="auth-module-pill"
                style={{ left: m.left, top: m.top, '--pill-color': m.color }}
              >
                <span className="auth-module-dot" style={{ background: m.color }} />
                {m.name}
              </div>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <div className="auth-stats-row">
          {STATS_ROW.map(s => (
            <div key={s.label} className="auth-stat-item">
              <span className="auth-stat-val">{s.value}</span>
              <span className="auth-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right form panel ──────────────────────────────────── */}
      <main className="auth-form-wrap">
        {!ready ? (
          <div className="auth-form" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
            <Spinner />
          </div>
        ) : (
          <div className="auth-form-container">
            {/* Unified mobile header */}
            <div className="auth-m-header">
              <div className="auth-m-logo">
                <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="3" fill="currentColor" />
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                  <circle cx="9" cy="3" r="1.5" fill="currentColor" />
                </svg>
                <span>Orbit</span>
              </div>
              <div className="auth-m-subtitle">Developer Workspace</div>
            </div>

            <div className="auth-form-card">
              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Heading */}
                <div className="auth-form-head">
                  <h2>
                    {googleAuthOnly ? 'Welcome to Orbit' :
                      mode === 'login' ? 'Welcomee to Orbit' :
                        mode === 'signup' ? 'Create account' :
                          'Reset password'}
                  </h2>
                  <p>
                    {googleAuthOnly ? 'Sign in with your Google account to continue' :
                      mode === 'login' ? 'Sign in to your workspace' :
                        mode === 'signup' ? 'Set up your Orbit workspace' :
                          "We'll send a reset link to your email"}
                  </p>
                </div>

                {/* ── Google-only mode ── */}
                {googleAuthOnly ? (
                  <>
                    {error && (
                      <div className="auth-error" role="alert">
                        <Icon name="x" size={13} />
                        {error}
                      </div>
                    )}
                    <button
                      type="button"
                      className="auth-google-btn"
                      onClick={handleGoogle}
                      disabled={busy}
                    >
                      {googleLoading ? <Spinner /> : <GoogleIcon />}
                      {googleLoading ? 'Connecting…' : 'Continue with Google'}
                    </button>
                  </>
                ) : emailSent ? (
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
                            : 'Signing in…'
                        : mode === 'login' ? 'Sign in'
                          : mode === 'signup' ? 'Create account'
                            : 'Send reset link'}
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
            </div>
          </div>
        )}
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
        {[0, 1, 2, 3].map(i => (
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
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
};

// ── Reset Password Page (shown after clicking email link) ──────────────────
export const ResetPasswordPage = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

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
        <div className="auth-glow auth-glow-3" />
        <div className="auth-logo">
          <svg width="20" height="20" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="9" cy="9" r="3" fill="currentColor" />
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="9" cy="3" r="1.5" fill="currentColor" />
          </svg>
          <span>Orbit</span>
          <span className="auth-logo-ver">v1.0</span>
        </div>
        <div className="auth-hero">
          <div className="auth-hero-eyebrow">Developer OS</div>
          <h1 className="auth-hero-title">
            Your entire workflow,<br />
            <span className="auth-hero-accent">one orbit.</span>
          </h1>
          <p className="auth-hero-sub">
            The all-in-one workspace for indie developers — projects, deep-work sessions, vault, analytics, and more.
          </p>
        </div>
        <div className="auth-orbital-wrap" style={{ flex: 1, minHeight: 0 }}>
          <div className="auth-orbital">
            <svg className="auth-orbital-svg" viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="130" cy="130" r="50" stroke="rgba(0,153,255,0.15)" strokeWidth="1" />
              <circle cx="130" cy="130" r="80" stroke="rgba(0,153,255,0.10)" strokeWidth="1" strokeDasharray="4 6" />
              <circle cx="130" cy="130" r="112" stroke="rgba(168,85,247,0.10)" strokeWidth="1" strokeDasharray="2 10" />
              <circle cx="130" cy="130" r="26" fill="rgba(0,153,255,0.08)" stroke="rgba(0,153,255,0.35)" strokeWidth="1.5" />
              <circle cx="130" cy="130" r="14" fill="rgba(0,153,255,0.15)" />
              <circle cx="130" cy="130" r="7" fill="#0099ff" />
              <circle className="auth-orb-dot-1" cx="180" cy="130" r="5" fill="#0099ff" />
              <circle className="auth-orb-dot-2" cx="130" cy="50" r="4" fill="#a855f7" />
            </svg>
          </div>
        </div>
        <div className="auth-stats-row">
          {STATS_ROW.map(s => (
            <div key={s.label} className="auth-stat-item">
              <span className="auth-stat-val">{s.value}</span>
              <span className="auth-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="auth-form-wrap">
        <div className="auth-form-container">
          {/* Mobile-only brand header */}
          <div className="auth-m-header">
            <div className="auth-m-logo">
              <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="3" fill="currentColor" />
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="9" cy="3" r="1.5" fill="currentColor" />
              </svg>
              <span>Orbit</span>
            </div>
            <div className="auth-m-subtitle">Developer Workspace</div>
          </div>

          <div className="auth-form-card">
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
          </div>
        </div>
      </main>
    </div>
  );
};

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };

export const InviteAcceptPage = ({ token, user, onAccepted, onDeclined }) => {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getInviteByToken(token)
      .then(data => { setInvite(data); setLoading(false); })
      .catch(() => { setError('Could not load invite details.'); setLoading(false); });
  }, [token]);

  const handleAccept = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await acceptInvite(token);
      if (result?.error === 'email_mismatch') {
        setError(`This invite was sent to ${invite?.email}. You are logged in as ${user?.email}. Please log in with the correct account.`);
      } else if (result?.error === 'invite_not_found') {
        setError('This invite has expired or already been used.');
      } else {
        onAccepted(result);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-loading">Loading invite…</div>
      </div>
    </div>
  );

  if (!invite || invite.status !== 'pending') return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-icon expired"><Icon name="alert-circle" size={32} /></div>
        <h2>Invite not available</h2>
        <p>This invite has expired, been cancelled, or already been accepted.</p>
        <button className="btn primary" onClick={onDeclined}>Go to app</button>
      </div>
    </div>
  );

  const isExpired = new Date(invite.expires_at) < new Date();

  return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-icon">
          <Icon name="users" size={32} />
        </div>
        <div className="invite-from">{invite.inviter_name} invited you to join</div>
        <h2 className="invite-ws-name">{invite.workspace_name}</h2>
        <div className="invite-role-row">
          <span>Your role:</span>
          <span className={'role-badge role-' + invite.role}>{ROLE_LABEL[invite.role] || invite.role}</span>
        </div>
        {isExpired && <div className="invite-warn">This invite has expired.</div>}
        {error && <div className="invite-error">{error}</div>}
        <div className="invite-actions">
          <button
            className="btn primary"
            onClick={handleAccept}
            disabled={busy || isExpired}
          >
            {busy ? 'Accepting…' : 'Accept invitation'}
          </button>
          <button className="btn ghost" onClick={onDeclined}>Dismiss</button>
        </div>
        <div className="invite-meta">Logged in as <strong>{user?.email}</strong></div>
      </div>
    </div>
  );
};

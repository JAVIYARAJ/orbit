import { useState } from 'react';
import { ArrowLeft, Send, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { motion } from 'framer-motion';

const TYPES = ['General query', 'Bug / Issue', 'Feature request', 'Feedback', 'Partnership', 'Other'];

// Common consumer email providers, used to catch typos like "gamil.com".
const COMMON_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com',
  'outlook.com', 'icloud.com', 'proton.me', 'protonmail.com', 'aol.com',
  'live.com', 'msn.com', 'ymail.com', 'rediffmail.com',
];

// Optimal string alignment distance (Levenshtein + adjacent transpositions),
// so "gamil" → "gmail" counts as a single edit.
function osaDistance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Returns a suggested domain when the typed one looks like a typo of a
// common provider (a single edit away), otherwise null.
function suggestEmailDomain(email) {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain || COMMON_EMAIL_DOMAINS.includes(domain)) return null;
  for (const known of COMMON_EMAIL_DOMAINS) {
    if (osaDistance(domain, known) === 1) return known;
  }
  return null;
}

const inputClass =
  'w-full px-4 rounded-xl bg-background/80 backdrop-blur-sm border-2 border-primary/10 focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-foreground/50 transition-all font-medium';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export function ContactPage({ onNavigate }) {
  const go = (path) => onNavigate?.(path);
  const dark = typeof window === 'undefined'
    ? true
    : localStorage.getItem('orbit:landingTheme') !== 'light';

  const [form, setForm] = useState({ name: '', email: '', role: '', type: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (fieldErrors[key]) setFieldErrors((errs) => ({ ...errs, [key]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Custom Validation
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Please enter your name.';
    if (!form.email.trim()) {
      newErrors.email = 'Please enter your email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    } else {
      const suggestion = suggestEmailDomain(form.email.trim());
      if (suggestion) newErrors.email = `Did you mean @${suggestion}? Please double-check your email.`;
    }
    if (!form.role.trim()) newErrors.role = 'Please let us know your role.';
    if (!form.type) newErrors.type = 'Please select a message type.';
    if (!form.description.trim()) newErrors.description = 'Please enter a message.';

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setFieldErrors({});
    setError('');
    setSubmitting(true);
    const { error: insertError } = await supabase.from('contact_submissions').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      type: form.type,
      description: form.description.trim(),
    });
    setSubmitting(false);
    if (insertError) {
      setError('Something went wrong while sending your message. Please try again.');
      return;
    }
    setDone(true);
  };

  return (
    <div className={`orbit-landing bg-background text-foreground selection:bg-primary/30${dark ? ' dark' : ''}`}>
      {/* Abstract Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-primary/10 to-primary/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-secondary/10 via-transparent to-transparent rounded-full blur-[100px] -z-10 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Nav */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed w-full top-0 z-50 bg-background/60 backdrop-blur-3xl border-b border-primary/10 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => go('/')}
            className="font-heading font-black text-2xl bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent flex items-center gap-2"
          >
            <div className="relative flex items-center justify-center w-6 h-6">
              <div className="absolute w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-primary/30 border-t-primary/80"
              />
              <motion.div 
                animate={{ rotate: -360 }} 
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[3px] rounded-full border border-primary/30 border-b-primary/80"
              />
            </div>
            Orbit
          </button>
          
          <div className="flex items-center gap-4">
            <button onClick={() => go('/')} className="hidden sm:block text-sm text-foreground/70 hover:text-primary transition font-semibold">Home</button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => go('/auth')}
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-full font-bold shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all"
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-12 text-center"
      >
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-widest uppercase mb-6 border border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
          Contact
        </span>
        <h1 className="font-heading text-5xl sm:text-6xl font-black mb-6 tracking-tight text-foreground drop-shadow-sm">Get in touch</h1>
        <p className="text-xl text-foreground/70 font-light leading-relaxed">
          Have a question, found a bug, or want to share feedback? Send us a message and we’ll get back to you.
        </p>
      </motion.header>

      {/* Form / success */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {done ? (
          <div className="text-center p-12 rounded-3xl bg-background/50 backdrop-blur-md border border-primary/10 shadow-xl shadow-primary/5">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
            <h2 className="font-heading text-3xl font-black mb-4 text-foreground">Thanks for reaching out!</h2>
            <p className="text-lg text-foreground/70 mb-10 leading-relaxed max-w-md mx-auto">
              Your message has been successfully received. We’ll get back to you at <span className="text-foreground font-semibold">{form.email}</span> very soon.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => go('/')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-lg shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </motion.button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit}
            className="space-y-8 p-8 sm:p-12 rounded-3xl bg-background/50 backdrop-blur-md border border-primary/10 shadow-2xl shadow-primary/5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="c-name" className="block text-sm font-bold mb-3 text-foreground/90">Name</label>
                <input id="c-name" type="text" value={form.name} onChange={set('name')}
                  placeholder="Your name" className={`${inputClass} h-[56px] ${fieldErrors.name ? '!border-red-500 focus:!ring-red-500/20' : ''}`} />
                {fieldErrors.name && <p className="text-red-400 text-sm mt-2 font-medium">{fieldErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="c-email" className="block text-sm font-bold mb-3 text-foreground/90">Email</label>
                <input id="c-email" type="email" value={form.email} onChange={set('email')}
                  placeholder="you@example.com" className={`${inputClass} h-[56px] ${fieldErrors.email ? '!border-red-500 focus:!ring-red-500/20' : ''}`} />
                {fieldErrors.email && <p className="text-red-400 text-sm mt-2 font-medium">{fieldErrors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="c-role" className="block text-sm font-bold mb-3 text-foreground/90">I am a…</label>
                <input id="c-role" type="text" value={form.role} onChange={set('role')}
                  placeholder="E.g. Developer, Designer, Student..." className={`${inputClass} h-[56px] ${fieldErrors.role ? '!border-red-500 focus:!ring-red-500/20' : ''}`} />
                {fieldErrors.role && <p className="text-red-400 text-sm mt-2 font-medium">{fieldErrors.role}</p>}
              </div>
              <div>
                <label htmlFor="c-type" className="block text-sm font-bold mb-3 text-foreground/90">Type</label>
                <select id="c-type" value={form.type} onChange={set('type')} className={`${inputClass} h-[56px] cursor-pointer ${fieldErrors.type ? '!border-red-500 focus:!ring-red-500/20' : ''}`}>
                  <option value="" disabled>Select a type</option>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {fieldErrors.type && <p className="text-red-400 text-sm mt-2 font-medium">{fieldErrors.type}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="c-desc" className="block text-sm font-bold mb-3 text-foreground/90">Message</label>
              <textarea id="c-desc" rows={6} value={form.description} onChange={set('description')}
                placeholder="Tell us what’s on your mind…" className={`${inputClass} py-4 resize-y min-h-[150px] ${fieldErrors.description ? '!border-red-500 focus:!ring-red-500/20' : ''}`} />
              {fieldErrors.description && <p className="text-red-400 text-sm mt-2 font-medium">{fieldErrors.description}</p>}
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <p className="text-sm text-red-400 font-medium">{error}</p>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-black text-lg shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all disabled:opacity-70 disabled:hover:shadow-none disabled:cursor-not-allowed mt-4"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Sending…</>
              ) : (
                <>Send message <Send className="w-5 h-5" /></>
              )}
            </motion.button>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/10 px-4 sm:px-6 lg:px-8 py-12 bg-background relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
            <button onClick={() => go('/')} className="font-heading font-black text-xl bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent flex items-center justify-center sm:justify-start gap-2">
              <div className="relative flex items-center justify-center w-5 h-5">
                <div className="absolute w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-primary/30 border-t-primary/80"
                />
                <motion.div 
                  animate={{ rotate: -360 }} 
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[2px] rounded-full border border-primary/30 border-b-primary/80"
                />
              </div>
              Orbit
            </button>
            <p className="text-sm text-foreground/60 mt-2">One workspace for developers.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full sm:w-auto">
            <button onClick={() => go('/')} className="inline-flex items-center justify-center gap-2 text-sm font-medium text-foreground/70 hover:text-primary transition group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-primary/10 mt-8 pt-8 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-foreground/60 w-full text-center sm:text-left">&copy; {new Date().getFullYear()} Orbit. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

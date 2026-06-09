import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

// Update this whenever the policy text changes.
const LAST_UPDATED = 'June 9, 2026';

// Privacy contact address.
const CONTACT_EMAIL = 'javiyaraj4@gmail.com';

// Data controller. Orbit is run by a solo developer (no registered company),
// so the controller is the individual operator. Swap in your full legal name
// (and address) here if you later register a company or a law requires it.
const COMPANY = 'an independent developer';

const SECTIONS = [
  {
    heading: '1. Introduction',
    paragraphs: [
      `Orbit is a single workspace that brings projects, tasks, calendar, notes, time tracking, analytics, and developer integrations together in one place. The Service is operated by ${COMPANY} ("Orbit", "we", "us", or "the Service"), which acts as the controller of the personal data described in this policy.`,
      'This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices you have. We are committed to protecting your personal data and only collecting what we genuinely need. By using Orbit, you agree to the practices described here.',
    ],
  },
  {
    heading: '2. Information We Collect',
    paragraphs: ['We collect only what we need to run the Service for you and your team:'],
    bullets: [
      'Account information — when you sign in with Google, we receive your name, email address, and profile picture to create and identify your account.',
      'Content you create — projects, tasks, notes, calendar events, time entries, and files you upload are stored so we can provide the Service to you and your workspace.',
      'Integration data — if you connect GitHub, Vercel, or Google Calendar, we store the access tokens needed to show your repositories, deployments, and schedule. These tokens are scoped to your workspace and used only to power those features.',
      'Vault data — items you store in the Vault are encrypted on your device before they reach our servers, so we cannot read their contents.',
      'Usage and technical data — basic information such as browser type and your activity within the app, used to operate, secure, and improve the Service.',
    ],
  },
  {
    heading: '3. How We Use Your Information',
    paragraphs: ['We use the information we collect to:'],
    bullets: [
      'Provide, maintain, and improve the Service.',
      'Authenticate you and keep your account secure.',
      'Power the integrations you choose to connect.',
      'Enable collaboration within your workspace.',
      'Send important updates about the Service.',
    ],
    footnote: 'We do not sell your personal information.',
  },
  {
    heading: '4. Third-Party Services',
    paragraphs: ['We rely on trusted providers to run Orbit. Each processes data only as needed to provide its part of the Service:'],
    bullets: [
      'Supabase — authentication, database, and storage.',
      'Google — sign-in (OAuth) and the Google Calendar integration.',
      'GitHub and Vercel — developer integrations you choose to connect.',
      'Cloudinary — storage and delivery of images and files you upload.',
      'Firebase — remote configuration and feature management.',
    ],
  },
  {
    heading: '5. Data Storage & Security',
    paragraphs: [
      'Your data is stored with our infrastructure providers and protected with encryption in transit. Sensitive Vault data is additionally end-to-end encrypted on your device.',
      'While no system can be guaranteed completely secure, we take reasonable technical and organizational measures to protect your information against unauthorized access, loss, or misuse.',
    ],
  },
  {
    heading: '6. Cookies & Local Storage',
    paragraphs: [
      'Orbit uses your browser’s local storage to keep you signed in and to remember preferences such as your theme. We do not use third-party advertising cookies.',
    ],
  },
  {
    heading: '7. Data Retention',
    paragraphs: [
      'We keep your information for as long as your account is active. You can delete content you create, or request deletion of your account, after which we remove your personal data within a reasonable period — except where retention is required by law.',
    ],
  },
  {
    heading: '8. Your Rights & Choices',
    paragraphs: ['Depending on your location, you may have the right to:'],
    bullets: [
      'Access and update your account information.',
      'Export or delete content you have created.',
      'Disconnect integrations at any time.',
      'Request deletion of your account and associated data.',
    ],
    footnote: 'To exercise any of these rights, contact us using the details below.',
  },
  {
    heading: '9. Children’s Privacy',
    paragraphs: [
      'Orbit is not directed to children under 13 (or the minimum age required in your jurisdiction), and we do not knowingly collect their personal information. If you believe a child has provided us with personal data, please contact us so we can remove it.',
    ],
  },
  {
    heading: '10. Changes to This Policy',
    paragraphs: [
      'We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date above and, where appropriate, notify you within the Service.',
    ],
  },
  {
    heading: '11. Contact Us',
    paragraphs: [
      `If you have questions about this Privacy Policy or how your data is handled, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
];

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

export function PrivacyPolicy({ onNavigate }) {
  const go = (path) => onNavigate?.(path);
  // Match the landing's theme preference (defaults to dark).
  const dark = typeof window === 'undefined'
    ? true
    : localStorage.getItem('orbit:landingTheme') !== 'light';

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
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-16 text-center"
      >
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-widest uppercase mb-6 border border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
          Legal
        </span>
        <h1 className="font-heading text-5xl sm:text-6xl font-black mb-6 tracking-tight text-foreground drop-shadow-sm">Privacy Policy</h1>
        <p className="text-xl text-foreground/60 font-light">Last updated: {LAST_UPDATED}</p>
      </motion.header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 space-y-16">
        {SECTIONS.map((s, i) => (
          <section key={i} className="group">
            <h2 className="font-heading text-2xl font-black mb-6 text-foreground flex items-center gap-3">
              {s.heading}
            </h2>
            <div className="space-y-4">
              {s.paragraphs?.map((p, j) => (
                <p key={j} className="text-foreground/70 text-lg leading-relaxed">{p}</p>
              ))}
              {s.bullets && (
                <ul className="list-disc pl-6 space-y-3 mt-6">
                  {s.bullets.map((b, k) => (
                    <li key={k} className="text-foreground/70 text-lg leading-relaxed pl-2 marker:text-primary/50">{b}</li>
                  ))}
                </ul>
              )}
              {s.footnote && (
                <div className="mt-8 p-4 border-l-2 border-primary/30 bg-primary/5 rounded-r-lg">
                  <p className="text-foreground/80 font-medium italic">{s.footnote}</p>
                </div>
              )}
            </div>
          </section>
        ))}
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

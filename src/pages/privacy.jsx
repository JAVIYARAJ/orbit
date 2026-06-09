import { ArrowLeft } from 'lucide-react';

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

export function PrivacyPolicy({ onNavigate }) {
  const go = (path) => onNavigate?.(path);
  // Match the landing's theme preference (defaults to dark).
  const dark = typeof window === 'undefined'
    ? true
    : localStorage.getItem('orbit:landingTheme') !== 'light';

  return (
    <div className={`orbit-landing min-h-screen bg-background text-foreground${dark ? ' dark' : ''}`}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-primary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => go('/')}
            className="font-heading font-black text-2xl bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent"
          >
            Orbit
          </button>
          <button
            onClick={() => go('/auth')}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-sm hover:shadow-lg hover:shadow-primary/40 transition-all hover:scale-105"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Header */}
      <header className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 text-center">
        <p className="text-primary font-bold text-sm uppercase tracking-widest mb-4">Legal</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black mb-4">Privacy Policy</h1>
        <p className="text-foreground/60">Last updated: {LAST_UPDATED}</p>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-12">
        {SECTIONS.map((s, i) => (
          <section key={i}>
            <h2 className="font-heading text-2xl font-bold mb-4 text-foreground">{s.heading}</h2>
            {s.paragraphs?.map((p, j) => (
              <p key={j} className="text-foreground/70 leading-relaxed mb-4">{p}</p>
            ))}
            {s.bullets && (
              <ul className="list-disc pl-6 space-y-2 text-foreground/70 leading-relaxed">
                {s.bullets.map((b, k) => <li key={k}>{b}</li>)}
              </ul>
            )}
            {s.footnote && <p className="text-foreground/70 leading-relaxed mt-4 font-medium">{s.footnote}</p>}
          </section>
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/10 px-4 sm:px-6 lg:px-8 py-10 bg-background">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center">
          <button onClick={() => go('/')} className="inline-flex items-center gap-2 text-sm font-medium text-foreground/70 hover:text-primary transition">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <p className="text-sm text-foreground/60">&copy; {new Date().getFullYear()} Orbit. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

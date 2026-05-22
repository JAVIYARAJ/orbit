// data.jsx — All mock data for Orbit dashboard
// Realistic flutter freelancer + indie builder workload.

export const PROJECTS = [
  {
    id: 'KMBL', name: 'Kombi — Loyalty App', client: 'Roastery Co.',
    type: 'Client / Freelance', start: '2026-03-04', end: '2026-06-12',
    status: 'progress', stack: ['Flutter', 'Riverpod', 'Supabase', 'Stripe'],
    progress: 64, tasks: 18, openTasks: 7, hoursLogged: 86, hoursEst: 140,
    repo: 'github.com/raunak/kombi-app', budget: '€12,400',
  },
  {
    id: 'PULS', name: 'Pulse — Habit Tracker', client: 'Indie / Self',
    type: 'Indie Product', start: '2025-11-18', end: '—',
    status: 'progress', stack: ['Flutter', 'Drift', 'isar', 'OpenAI'],
    progress: 78, tasks: 42, openTasks: 5, hoursLogged: 210, hoursEst: 260,
    repo: 'github.com/raunak/pulse', budget: '—',
  },
  {
    id: 'NORTH', name: 'Northwind Field Service', client: 'Northwind Logistics',
    type: 'Client / Retainer', start: '2025-09-02', end: '2026-09-02',
    status: 'review', stack: ['Flutter', 'GraphQL', 'Auth0', 'Mapbox'],
    progress: 91, tasks: 64, openTasks: 3, hoursLogged: 380, hoursEst: 420,
    repo: 'gitlab.com/northwind/field', budget: '€38,000',
  },
  {
    id: 'OBSV', name: 'Observe — Crash Analytics', client: 'Indie / Self',
    type: 'Indie Product', start: '2026-04-22', end: '—',
    status: 'planning', stack: ['Dart', 'Firebase', 'Cloud Run'],
    progress: 12, tasks: 9, openTasks: 9, hoursLogged: 6, hoursEst: 80,
    repo: 'github.com/raunak/observe', budget: '—',
  },
  {
    id: 'AKIRA', name: 'Akira — Studio Booking', client: 'Akira Movement Lab',
    type: 'Client / Freelance', start: '2026-01-12', end: '2026-04-30',
    status: 'done', stack: ['Flutter', 'Firebase', 'Stripe'],
    progress: 100, tasks: 24, openTasks: 0, hoursLogged: 132, hoursEst: 120,
    repo: 'github.com/raunak/akira', budget: '€8,600',
  },
  {
    id: 'LEDGR', name: 'Ledger — Freelance Invoicing', client: 'Internal Tool',
    type: 'Tool / Internal', start: '2025-08-01', end: '—',
    status: 'hold', stack: ['Flutter', 'PocketBase'],
    progress: 38, tasks: 16, openTasks: 10, hoursLogged: 22, hoursEst: 60,
    repo: 'github.com/raunak/ledger', budget: '—',
  },
];

export const TASKS = [
  // Backlog
  { id: 'KMBL-23', proj: 'KMBL', col: 'backlog', p: 1, title: 'Stripe webhook retry strategy for failed renewals', due: '2026-05-18', est: 4, actual: 0, tags: ['payments'], subs: [2, 0] },
  { id: 'PULS-71', proj: 'PULS', col: 'backlog', p: 2, title: 'Streak shield mechanic — 1 free skip per week', due: '2026-05-20', est: 6, actual: 0, tags: ['feature'] },
  { id: 'NORTH-104', proj: 'NORTH', col: 'backlog', p: 3, title: 'Refactor MapView to support offline tile cache', due: '—', est: 12, actual: 0, tags: ['refactor', 'maps'] },
  { id: 'OBSV-4', proj: 'OBSV', col: 'backlog', p: 2, title: 'Symbolicate stack traces on Cloud Run worker', due: '2026-05-22', est: 8, actual: 0, tags: ['infra'] },
  // To Do
  { id: 'KMBL-19', proj: 'KMBL', col: 'todo', p: 1, title: 'Build referral code redemption flow', due: '2026-05-14', est: 6, actual: 0, tags: ['feature'], subs: [3, 1] },
  { id: 'PULS-68', proj: 'PULS', col: 'todo', p: 2, title: 'AI-suggested habit difficulty calibration', due: '2026-05-16', est: 5, actual: 0, tags: ['ai'] },
  { id: 'OBSV-2', proj: 'OBSV', col: 'todo', p: 1, title: 'Define crash report ingestion schema (v1)', due: '2026-05-13', est: 3, actual: 0, tags: ['design'] },
  // In Progress
  { id: 'KMBL-17', proj: 'KMBL', col: 'progress', p: 1, title: 'Punch-card animation — confetti on completion', due: '2026-05-13', est: 4, actual: 2.5, tags: ['ui', 'animation'], subs: [4, 3] },
  { id: 'NORTH-101', proj: 'NORTH', col: 'progress', p: 2, title: 'Field tech offline-first sync conflict resolution', due: '2026-05-15', est: 10, actual: 6, tags: ['sync'] },
  { id: 'PULS-66', proj: 'PULS', col: 'progress', p: 3, title: 'Refactor weekly report screen — new chart lib', due: '2026-05-17', est: 5, actual: 1.5, tags: ['ui'] },
  // Review
  { id: 'KMBL-15', proj: 'KMBL', col: 'review', p: 2, title: 'Loyalty tier upgrade animation pass', due: '2026-05-12', est: 3, actual: 3.5, tags: ['ui'] },
  { id: 'NORTH-99', proj: 'NORTH', col: 'review', p: 1, title: 'iOS 17 deep-link regression fix', due: '2026-05-12', est: 4, actual: 5, tags: ['ios', 'bug'] },
  // Done
  { id: 'KMBL-12', proj: 'KMBL', col: 'done', p: 2, title: 'Onboarding screens — 3 step illustration set', due: '2026-05-08', est: 6, actual: 7, tags: ['ui'] },
  { id: 'PULS-62', proj: 'PULS', col: 'done', p: 1, title: 'TestFlight 1.4.2 release — fix crash on iOS 16', due: '2026-05-09', est: 2, actual: 1.5, tags: ['release'] },
  { id: 'NORTH-95', proj: 'NORTH', col: 'done', p: 3, title: 'Setup Sentry release tracking', due: '2026-05-07', est: 2, actual: 2, tags: ['infra'] },
  { id: 'AKIRA-24', proj: 'AKIRA', col: 'done', p: 1, title: 'Final build — submit to App Store', due: '2026-04-29', est: 3, actual: 4, tags: ['release'] },
];

export const LEARNING = {
  toLearn: [
    { topic: 'Rust → Flutter FFI (flutter_rust_bridge)', cat: 'Flutter', est: 12, link: 'github.com/fzyzcjy/flutter_rust_bridge', note: 'For native crypto in Vault module.', rev: false },
    { topic: 'CRDTs for offline-first sync', cat: 'Backend', est: 8, link: 'crdt.tech', note: '', rev: false },
    { topic: 'Negotiation & client scoping', cat: 'Soft Skills', est: 4, link: 'roib.substack.com/scope', note: 'Stop under-quoting.', rev: false },
    { topic: 'Vector embeddings — pgvector basics', cat: 'AI', est: 6, link: 'github.com/pgvector/pgvector', note: '', rev: false },
  ],
  inProgress: [
    { topic: 'Riverpod 3 — code generation patterns', cat: 'Flutter', est: 10, actual: 6.5, link: 'riverpod.dev/docs', note: 'Migrate Pulse next sprint.', rev: false, prog: 65 },
    { topic: 'gRPC + Connect for Dart backends', cat: 'Backend', est: 8, actual: 3, link: 'connectrpc.com/docs', note: '', rev: false, prog: 38 },
    { topic: 'Building agents with LangGraph', cat: 'AI', est: 14, actual: 9, link: 'langchain-ai.github.io/langgraph', note: 'Apply to Observe triage.', rev: false, prog: 64 },
  ],
  completed: [
    { topic: 'Flutter Impeller — perf audit workflow', cat: 'Flutter', actual: 5, link: 'docs.flutter.dev/impeller', note: 'Cut jank in Kombi 40%.', rev: true, lastReviewed: '2026-04-08' },
    { topic: 'Postgres row-level security', cat: 'Backend', actual: 7, link: 'supabase.com/docs/rls', note: '', rev: false, lastReviewed: '2026-05-01' },
    { topic: 'Tailwind for landing pages (rapid)', cat: 'Web', actual: 4, link: 'tailwindcss.com', note: '', rev: false, lastReviewed: '2026-04-22' },
    { topic: 'Pricing creative work', cat: 'Soft Skills', actual: 3, link: '—', note: 'Re-read every quarter.', rev: true, lastReviewed: '2026-02-18' },
  ],
};

export const VAULT = [
  { id: 1, cat: 'api', name: 'OpenAI — Pulse production', value: 'sk-proj-abe93Kk2nK9zX8mE2dQ4F7sLp', updated: '2026-04-29' },
  { id: 2, cat: 'api', name: 'Stripe — Kombi live', value: 'sk_live_51HQpzKLqRn8tYmW4xJ2k3vCB', updated: '2026-05-02' },
  { id: 3, cat: 'api', name: 'Mapbox — Northwind', value: 'pk.eyJ1IjoicmF1bmFrIiwiYSI6ImNsbXh6', updated: '2026-03-14' },
  { id: 4, cat: 'api', name: 'Sentry DSN — Pulse', value: 'https://6f8e9a@sentry.io/4505...', updated: '2026-05-06' },
  { id: 5, cat: 'pw',  name: 'Apple Developer Account', value: 'X9k$mP2vL8nQ4wR7tY1uF3', updated: '2026-04-12' },
  { id: 6, cat: 'pw',  name: 'Google Play Console', value: 'B4j!kN9pX2mC5vF8wT3hL1', updated: '2026-04-12' },
  { id: 7, cat: 'env', name: 'PULS_SUPABASE_URL', value: 'https://nfgxhwbkyqpzlvr.supabase.co', updated: '2026-05-09' },
  { id: 8, cat: 'env', name: 'PULS_SUPABASE_ANON', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', updated: '2026-05-09' },
  { id: 9, cat: 'env', name: 'NORTH_GRAPHQL_ENDPOINT', value: 'https://api.northwind.io/v2/graphql', updated: '2026-04-22' },
  { id: 10, cat: 'ssh', name: 'deploy@kombi-prod', value: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5...', updated: '2026-03-30' },
  { id: 11, cat: 'ssh', name: 'github — personal', value: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQAB...', updated: '2026-01-04' },
  { id: 12, cat: 'other', name: 'Notion API integration token', value: 'secret_aBcD3fGh1JkLmN9pQrSt', updated: '2026-04-18' },
];

export const NOTES = [
  {
    id: 1, title: 'Kombi loyalty tier algorithm', folder: 'Clients',
    tags: ['#kombi', '#client', '#algo'], pinned: true, edited: '2h ago',
    body: `# Kombi — Loyalty tier algorithm

## Requirements (from client call 2026-05-09)
- 4 tiers: **Bean**, **Roast**, **Brew**, **Master**
- Promotion = purchases in last 30 days
- Demotion = 14 days inactive **and** under tier threshold
- Master tier: invite-only, manual flag

## Thresholds
| Tier   | Min purchases / 30d | Perks |
|--------|---------------------|-------|
| Bean   | 0                   | 5% off |
| Roast  | 4                   | 10% off + free pastry |
| Brew   | 10                  | 15% off + early access |
| Master | invite              | 20% off + monthly box |

## Open questions
- Do we count online orders separately from in-store?
- Refunds: revert tier credit immediately, or end of month?

> Client prefers immediate revert. Confirm with Owen on next call.

\`\`\`dart
TierResult evaluateTier(User u, List<Purchase> last30d) {
  if (u.manualMasterFlag) return TierResult.master;
  final count = last30d.length;
  if (count >= 10) return TierResult.brew;
  if (count >= 4)  return TierResult.roast;
  return TierResult.bean;
}
\`\`\`
`,
  },
  {
    id: 2, title: 'Pulse v2 — north star metric',
    folder: 'Pulse', tags: ['#idea', '#pulse', '#strategy'], pinned: true,
    edited: 'Yesterday',
    body: `# Pulse v2 — North star metric

## Current: DAU
Too loose. Reveals nothing about whether the habit is *forming*.

## Proposal: **7-day habit completion rate**
Of users with an active habit ≥7 days old, what % completed it ≥5 of the last 7 days?

This:
- Filters out new-user noise
- Rewards consistency, not just opens
- Becomes the single number on the team dashboard

## Reach goal: 42% by Q3 (from 27% today)`,
  },
  {
    id: 3, title: 'Meeting — Northwind Q2 review', folder: 'Clients',
    tags: ['#meeting', '#northwind', '#client'], pinned: false, edited: 'Mon',
    body: `# Northwind — Q2 review (2026-05-06)

**Present:** Owen, Priya, me

## Wins
- Field tech adoption jumped from 64% → 89% after offline mode shipped
- Crash-free sessions: 99.4%

## Asks for Q3
1. Voice notes on work orders
2. Tablet layout for dispatchers
3. SAML SSO

## Decisions
- Voice notes: yes, scoped for July sprint
- Tablet: October, pending iOS budget
- SSO: end of Q3
`,
  },
  {
    id: 4, title: 'Idea — App Size Estimator API', folder: 'Ideas',
    tags: ['#idea', '#flutter'], pinned: false, edited: '4d ago',
    body: `# App Size Estimator service

Drop a \`flutter analyze --size\` JSON, get back a flame-graph of what's bloating the bundle.

Could be a tiny SaaS. $9/mo for teams.`,
  },
  {
    id: 5, title: 'Daily — 2026-05-12', folder: 'Daily', tags: ['#daily'], pinned: false, edited: 'Today',
    body: `# Today — Tue 2026-05-12

- [x] Stand-up
- [x] Push Kombi punch-card branch
- [ ] Review Northwind PR #221
- [ ] Call Owen re: Q3 contract
- [ ] Pulse — fix streak shield bug

## Notes
Energy great until ~3pm. Try blocking deep work 9-1.`,
  },
  {
    id: 6, title: 'Refactor — Drift schema migration plan', folder: 'Pulse',
    tags: ['#pulse', '#refactor'], pinned: false, edited: '6d ago',
    body: `# Drift v2 migration

## Why
- isar deprecated; Drift has better web support
- Existing data must migrate without loss

## Steps
1. Snapshot user DB on app open
2. Dual-write for 1 release
3. Backfill in background
4. Cut over on next launch after verification`,
  },
];

export const EMAIL_TEMPLATES = [
  {
    id: 'proposal-fixed', cat: 'Proposals', name: 'Fixed-scope proposal',
    body: `Hi {{client_name}},

Thanks for the call yesterday about {{project_name}}. As discussed, here's a scoped proposal for the work.

**Scope**
{{scope_summary}}

**Timeline:** {{duration}} weeks, starting {{start_date}}
**Investment:** {{rate}} ({{payment_terms}})

This includes:
- Design + build of the agreed feature set
- Two rounds of revisions per milestone
- Deployment to your environment
- 14 days post-launch support

What's not included: ongoing maintenance, third-party integrations beyond what's listed, and content/copy.

If this works, I'll send the contract today and we can kick off {{start_date}}.

Best,
Raunak`,
  },
  {
    id: 'proposal-disc', cat: 'Proposals', name: 'Discovery sprint proposal',
    body: `Hi {{client_name}},\n\nBefore committing to a full build, I usually recommend a 1-week paid discovery sprint...`,
  },
  {
    id: 'free-followup', cat: 'Freelance', name: 'Mid-project status update',
    body: `Hi {{client_name}},\n\nQuick weekly update on {{project_name}}...`,
  },
  {
    id: 'free-invoice', cat: 'Freelance', name: 'Milestone invoice cover',
    body: `Hi {{client_name}},\n\nInvoice #{{invoice_no}} is attached for the {{milestone}} milestone...`,
  },
  {
    id: 'job-app-1', cat: 'Job Applications', name: 'Senior Flutter — generalist',
    body: `Hi {{recruiter_name}},

Saw {{company}} is hiring a senior mobile engineer. I've been building production Flutter apps for {{years}} years, most recently shipping {{project_name}} to {{user_count}}+ users.

A few highlights:
- {{highlight_1}}
- {{highlight_2}}
- {{highlight_3}}

Portfolio: raunak.dev — happy to walk through any of the work.

Best,
Raunak`,
  },
  {
    id: 'follow-1', cat: 'Follow-ups', name: 'Gentle 7-day nudge',
    body: `Hi {{client_name}},\n\nJust floating this back up...`,
  },
  {
    id: 'follow-2', cat: 'Follow-ups', name: 'Lost-the-thread re-engagement',
    body: `Hi {{client_name}},\n\nIt's been a few weeks since we talked about {{project_name}}...`,
  },
  {
    id: 'client-weekly', cat: 'Client Updates', name: 'Weekly progress digest',
    body: `Hi {{client_name}},\n\nWeek of {{week_of}} update on {{project_name}}.\n\n**Shipped this week:**\n- {{shipped_1}}\n- {{shipped_2}}\n\n**In progress:**\n- {{wip_1}}\n\n**Next week:**\n- {{next_1}}\n\n**Blockers / decisions needed:**\n{{blockers}}\n\nBest,\nRaunak`,
  },
  {
    id: 'cold-1', cat: 'Cold Outreach', name: 'Cold — referral-style',
    body: `Hi {{recipient}},\n\n{{mutual}} mentioned you're working on {{their_project}}...`,
  },
];

// Time tracker — today's sessions
export const SESSIONS = [
  { proj: 'Kombi — Loyalty App', task: 'Punch-card animation', start: '08:42', end: '10:18', dur: '1:36' },
  { proj: 'Pulse — Habit Tracker', task: 'Weekly report refactor', start: '10:30', end: '11:45', dur: '1:15' },
  { proj: 'Northwind Field Service', task: 'Offline sync conflicts', start: '12:30', end: '14:08', dur: '1:38' },
  { proj: 'Kombi — Loyalty App', task: 'Punch-card animation', start: '14:20', end: '—', dur: 'live' },
];

// PM module — gantt tasks for Kombi (12-week timeline, week 1 = early March)
export const GANTT_TASKS = [
  { name: 'Discovery & spec', sub: 'KMBL-1 → KMBL-4', start: 1, end: 2, status: 'done' },
  { name: 'Design system & screens', sub: 'KMBL-5 → KMBL-9', start: 2, end: 4, status: 'done' },
  { name: 'Auth + Profile flow', sub: 'KMBL-10', start: 3, end: 5, status: 'done' },
  { name: 'Loyalty tier engine', sub: 'KMBL-12, 15', start: 5, end: 7, status: 'review' },
  { name: 'Punch-card UI', sub: 'KMBL-17', start: 6, end: 8, status: 'progress' },
  { name: 'Stripe + redemption', sub: 'KMBL-19, 23', start: 7, end: 9, status: 'progress' },
  { name: 'Notifications + push', sub: 'KMBL-25', start: 8, end: 10, status: 'planning' },
  { name: 'QA + beta cohort', sub: 'KMBL-30 → 36', start: 9, end: 11, status: 'planning' },
  { name: 'Launch ☆', sub: 'milestone', start: 11.6, end: 12, status: 'milestone' },
];

// Data is imported directly by App.jsx and passed as React state — no window globals needed.

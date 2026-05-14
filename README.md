<div align="center">

# ⚡ DevOS — Personal Command Center

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![ESLint](https://img.shields.io/badge/ESLint-9-4B32C3?style=flat-square&logo=eslint&logoColor=white)](https://eslint.org)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](./LICENSE)

*One dashboard. Every tool. Zero context switching.*

</div>

---

## What is DevOS?

DevOS is a private, self-hosted operating system for developers — built to replace the 6+ tools a typical developer juggles daily. Projects, tasks, notes, secrets, time tracking, email templates, and developer utilities — all in one fast, keyboard-first interface.

This is not a SaaS product. It's a personal tool. Built for one developer. Opinionated by design.

> Built with React 19 + Vite + Supabase. Deployed privately on Vercel. Data lives in your own Supabase project (Mumbai region — `ap-south-1`).

---

## Modules

| Module | Description |
|---|---|
| 🗂 **Projects** | Track every project — client, status, health, timeline, milestones, tech stack |
| ✅ **Tasks** | Kanban board with priority, effort, due dates — linked to projects or standalone |
| 🧠 **Learning Path** | What to learn next, what's in progress, what needs revision + streak tracking |
| 🔐 **Vault** | API keys, tokens, passwords — client-side AES-256 encrypted before storage |
| 📋 **Project Hub** | Full project management — scope, deliverables, payments, invoices, contracts |
| 📝 **Notes** | Markdown-first notes organized by project or tag, pinnable, timestamped |
| ⏱ **Time Tracker** | One-click timer tied to project + task, daily timeline, weekly breakdown |
| ✉️ **Email Templates** | Proposal, freelance, invoice, follow-up — fill variables, copy, send |
| 🛠 **Dev Tools** | JSON formatter, Base64, UUID, regex tester, timestamp converter and more |
| 📊 **Analytics** | Work pattern insights, project health overview, time distribution |

---

## Tech Stack

```
Frontend    →   React 19 + Vite + Plain CSS Design System
Database    →   Supabase (PostgreSQL) — ap-south-1 (Mumbai)
Auth        →   Supabase Auth (Email/Password + Google OAuth)
Secrets     →   Client-side AES-256 encryption (never stored raw)
Deployment  →   Vercel (private, auth-protected)
```

---

## Project Structure

```
devos-dashboard/
├── src/
│   ├── app/
│   │   └── App.jsx                 # Main state, auth gate, routing, timer, themes
│   ├── components/
│   │   ├── shell.jsx               # Sidebar, topbar, command palette, nav config
│   │   ├── tweaks-panel.jsx        # Runtime appearance controls
│   │   └── workstation-setup.jsx   # First-run and workstation setup flow
│   ├── data/
│   │   └── dashboard-data.jsx      # Static fallback/demo data
│   ├── lib/
│   │   ├── db.js                   # Supabase RPC access and shape converters
│   │   └── supabase.js             # Supabase client from env vars
│   ├── pages/
│   │   ├── workspace.jsx           # Projects, tasks, learning, vault
│   │   ├── tools.jsx               # Notes, timer, email templates, dev toolkit
│   │   ├── analytics.jsx           # Analytics view
│   │   ├── collaboration.jsx       # Collaboration view
│   │   ├── settings.jsx            # Settings
│   │   └── auth.jsx                # Login, sign-up, OAuth UI
│   └── styles/
│       └── global.css              # Global layout, theme tokens, responsive
├── .env.local                      # Supabase credentials (never commit)
├── .gitignore
├── vite.config.js
└── package.json
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/javiyaraj/devos-dashboard.git
cd devos-dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create `.env.local` in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set up Supabase

- Create a project in [Supabase](https://supabase.com) — select **Asia Pacific (Mumbai) `ap-south-1`** region
- Enable **Email/Password** auth
- Enable **Google OAuth** if needed
- Add redirect URL: `http://localhost:5173`
- Provision the RPC functions (see [Database Setup](#database-setup) below)

### 5. Run locally

```bash
npm run dev
```

App runs at `http://localhost:5173`

---

## Available Scripts

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

---

## Database Setup

All data access goes through Supabase PostgreSQL RPC functions — the client never queries tables directly. You must provision the following functions in your Supabase project:

**Workstation**
```
get_my_workstations
create_my_workstation
switch_active_workstation
load_workstation_data          ← returns full JSON payload on login
```

**Projects**
```
create_project
update_project
delete_project
```

**Tasks**
```
create_task
update_task
delete_task
```

**Notes**
```
create_note
update_note
delete_note
```

**Vault**
```
create_vault_item              ← stores AES-256 encrypted blob only
update_vault_item
delete_vault_item
```

**Email Templates**
```
create_email_template
update_email_template
delete_email_template
```

**Learning**
```
create_learning_item
```

> `load_workstation_data` returns a single JSON payload containing projects, tasks, notes, vault items, learning items, email templates, Gantt tasks, and timer sessions. The UI converts this into app-ready objects before rendering.

> ⚠️ Database migrations are not included in this repository. Schema and RPC functions must be provisioned separately in your Supabase dashboard or via the Supabase CLI.

---

## Local Persistence

DevOS uses `localStorage` for lightweight UI state — nothing sensitive:

| Key | Purpose |
|---|---|
| `devos:activeWs` | Selected workstation |
| `devos:nav` | Last active page |
| `devos:timerSec` | Active timer seconds |
| `devos:timerRunning` | Timer running state |
| `devos:tweaks` | Theme and layout preferences |

All primary application data is loaded from Supabase after auth and workstation selection.

---

## Security

The **Vault** module handles secrets (API keys, tokens, passwords) with a non-negotiable rule:

- Encryption happens **client-side** before any data leaves the browser
- Supabase stores **only the encrypted blob** — never plaintext
- Decryption happens **client-side** after fetching
- The encryption key (master password) never touches the server

> Never store raw secrets in any cloud database. If the Supabase project is ever compromised, vault data remains unreadable without the master password.

---

## Theme & Appearance

DevOS supports runtime theme tweaks without a page reload:

- **Accent color** — switch between cyan, amber, green, and more
- **Density** — compact, default, or comfortable spacing
- **Typography** — font family and size preferences
- **Surface** — background and card opacity
- **Texture** — subtle grain, scanlines, or clean
- **Scanlines** — optional CRT-style overlay

Tweaks are saved to `localStorage` and persist across sessions.

---

## Roadmap

- [ ] Supabase schema migrations (CLI-ready)
- [ ] Vault master password setup flow
- [ ] Mobile responsive layout
- [ ] Offline support for notes and tasks
- [ ] Export projects/tasks to PDF
- [ ] Calendar integration
- [ ] GitHub integration — link commits to tasks

---

## Why DevOS?

Most developers run their day across Notion, Jira, 1Password, Toggl, and a folder of half-finished email templates. DevOS collapses all of it into one fast, keyboard-first dashboard — built specifically for how a developer actually works, not how a project manager thinks a developer works.

---

<div align="center">

Built by [Javiya Raj](https://github.com/javiyaraj) — Flutter developer, product builder.

*Ship less tools. Do more work.*

</div>
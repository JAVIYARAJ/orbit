<div align="center">

# 🪐 Orbit — Developer Team Platform

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Firebase](https://img.shields.io/badge/Firebase-Remote_Config-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://orbit-sand-alpha.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

*One platform. Every tool. Zero context switching.*

**[Live Demo](https://orbit-sand-alpha.vercel.app)**

</div>

---

## What is Orbit?

Orbit is a web-based productivity and project management platform built for developers and small teams. It replaces the entire stack of tools a dev team typically juggles — GitHub, Vercel, Google Calendar, task manager, notes, time tracker, and learning tracker — in a single fast, keyboard-first interface.

---

## Modules

| Module | Description |
|---|---|
| 🏠 **Home** | Agenda digest — today's tasks, meetings, and activity at a glance |
| 🗂 **Projects** | Track every project — status, health, milestones, tech stack, linked repo |
| ✅ **Tasks** | Kanban board with assignment, priority, subtasks, comments, and file attachments |
| 📅 **Calendar** | Two-way Google Calendar sync, recurring events, Google Meet integration |
| 👥 **Collaboration** | Team invites, role-based permissions, member management |
| 🔔 **Notifications** | Real-time notification center covering all platform event types |
| 🐙 **GitHub Hub** | Connect repos, view commits, create branches per task |
| 🚀 **Vercel** | Track deployments, build status, and project health |
| 🧠 **Learning Path** | Sessions, goals, dynamic tags, weekly targets, analytics charts |
| 📝 **Notes** | Markdown-first notes with folders, focus mode, and inter-note linking |
| ⏱ **Timer** | One-click time tracker tied to project and task |
| 📋 **Project Hub** | Scope, deliverables, payments, invoices, contracts |
| ✉️ **Email Templates** | Proposal, invoice, follow-up — fill variables and copy |
| 🔐 **Vault** | API keys and secrets — AES-256 encrypted client-side before storage |
| 📊 **Analytics** | Work patterns, project health, time distribution |
| 🔍 **Global Search** | Search across tasks, projects, notes, learning, and email templates |

---

## Tech Stack

```
Frontend      →   React 19 + Vite + Plain CSS Design System
Database      →   Supabase (PostgreSQL) — ap-south-1 (Mumbai)
Auth          →   Supabase Auth (Email/Password + Google OAuth)
Realtime      →   Supabase Realtime (Postgres change subscriptions)
Feature Flags →   Firebase Remote Config (16 modules, no redeploy needed)
Calendar      →   FullCalendar + rrule + Google Calendar API
Charts        →   Recharts
File Storage  →   Cloudinary
Integrations  →   GitHub REST API · Vercel API
Secrets       →   Client-side AES-256 encryption (never stored raw)
Deployment    →   Vercel
```

---

## Project Structure

```
orbit/
├── src/
│   ├── app/
│   │   └── App.jsx                 # Main state, auth gate, routing, timer, themes
│   ├── components/
│   │   ├── shell.jsx               # Sidebar, topbar, command palette, nav config
│   │   ├── tweaks-panel.jsx        # Runtime appearance controls
│   │   └── workstation-setup.jsx   # First-run and workstation setup flow
│   ├── lib/
│   │   ├── db.js                   # Supabase RPC access and shape converters
│   │   ├── supabase.js             # Supabase client
│   │   ├── github.js               # GitHub API integration
│   │   ├── vercel.js               # Vercel API integration
│   │   ├── googleCalendar.js       # Google Calendar two-way sync
│   │   ├── recurrence.js           # RRULE helpers
│   │   ├── permissions.js          # Role-based permission matrix
│   │   └── useRemoteConfig.js      # Firebase Remote Config hook
│   ├── pages/
│   │   ├── workspace.jsx           # Projects, tasks, learning, vault
│   │   ├── tools.jsx               # Notes, timer, email templates
│   │   ├── github.jsx              # GitHub Hub
│   │   ├── vercel.jsx              # Vercel deployments
│   │   ├── calendar.jsx            # Calendar with Google sync
│   │   ├── collaboration.jsx       # Team management
│   │   ├── analytics.jsx           # Analytics
│   │   ├── settings.jsx            # Settings
│   │   └── auth.jsx                # Login, sign-up, invite accept
│   └── styles/
│       └── global.css              # Global layout, theme tokens, responsive
├── screenshots/                    # Demo videos and screenshots
├── .env                            # Environment variables (never commit secrets)
├── vite.config.js
└── package.json
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/JAVIYARAJ/orbit.git
cd orbit
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create `.env` in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id

VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Set up Supabase

- Create a project at [supabase.com](https://supabase.com)
- Enable **Email/Password** auth and **Google OAuth**
- Add redirect URL: `http://localhost:5173`
- Provision the RPC functions (see Database Setup below)

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

All data access goes through Supabase PostgreSQL RPC functions — the client never queries tables directly.

Key RPC functions include workstation management, projects, tasks, notes, vault, learning, calendar events, task comments, task attachments, notifications, workspace invites, and role permissions.

> ⚠️ Database migrations are not included in this repository. Schema and RPC functions must be provisioned separately via the Supabase dashboard or Supabase CLI.

---

## Security

The **Vault** module handles secrets with a strict rule:

- Encryption happens **client-side** before any data leaves the browser
- Supabase stores **only the encrypted blob** — never plaintext
- The master password never touches the server

---

## Permissions

Orbit uses a four-tier role system with a fully configurable permission matrix:

| Role | Level |
|---|---|
| **Owner** | Full access to everything, including vault and role management |
| **Admin** | Broad access, configurable per workspace |
| **Member** | Standard access — create, edit, assign tasks |
| **Viewer** | Read-only access |

Owners can customize 20+ permission keys per role directly from the Collaboration settings page — no code change required.

---

## Theme & Appearance

Orbit supports runtime appearance tweaks without a page reload:

- **Accent color** — cyan, amber, green, and more
- **Density** — compact or comfortable spacing
- **Typography** — font family preferences
- **Surface** — background and card style
- **Dark / Light** theme

All tweaks are saved to `localStorage` and persist across sessions.

---

<div align="center">

Built by [Javiya Raj](https://github.com/JAVIYARAJ)

*Ship less tools. Do more work.*

</div>

# DevOS Dashboard

A personal developer operating system dashboard built with Vite, React 19, and Supabase. DevOS brings project tracking, task boards, notes, learning plans, a vault, time tracking, email templates, analytics, and workspace switching into one authenticated web app.

## Features

- Supabase email/password and Google OAuth authentication
- Multi-workstation setup and switching
- Command center with project, task, note, and timer summaries
- Project and task CRUD backed by Supabase RPC functions
- Notes, learning path, vault, and email template management
- Time tracker with local timer persistence
- Analytics, collaboration, project management, and developer toolkit pages
- Command palette and keyboard navigation
- Runtime theme tweaks for accent color, density, typography, surface, texture, and scanlines

## Tech Stack

- React 19
- Vite
- Supabase JS v2
- ESLint 9
- Plain CSS design system in `src/styles/global.css`

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env.local` file with your Supabase project values:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the development server:

```bash
npm run dev
```

The app runs at `http://localhost:5173/` by default.

## Available Scripts

```bash
npm run dev      # Start the Vite dev server
npm run build    # Create a production build
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
```

## Project Structure

```text
src/
  app/
    App.jsx                 Main app state, auth gate, routing, timer, theme tweaks
  components/
    shell.jsx               Sidebar, topbar, command palette, navigation config
    tweaks-panel.jsx        Runtime appearance controls and tweak persistence
    workstation-setup.jsx   First-run and new-workstation setup flow
  data/
    dashboard-data.jsx      Static fallback/demo data used by some UI sections
  lib/
    db.js                   Supabase RPC data access and shape converters
    supabase.js             Supabase client setup from Vite env vars
  pages/
    workspace.jsx           Home, projects, tasks, learning, and vault pages
    tools.jsx               Project management, notes, timer, email, toolkit pages
    analytics.jsx           Analytics view
    collaboration.jsx       Team collaboration view
    settings.jsx            Settings view
    auth.jsx                Login, sign-up, forgot password, and OAuth UI
  styles/
    global.css              Global layout, theme tokens, responsive styling
```

## Data Model

All database access is centralized in `src/lib/db.js`. The client calls Supabase PostgreSQL RPC functions instead of querying tables directly.

Expected RPC functions include:

- `get_my_workstations`
- `create_my_workstation`
- `switch_active_workstation`
- `load_workstation_data`
- `create_project`, `update_project`, `delete_project`
- `create_task`, `update_task`, `delete_task`
- `create_note`, `update_note`, `delete_note`
- `create_vault_item`, `update_vault_item`, `delete_vault_item`
- `create_email_template`, `update_email_template`, `delete_email_template`
- `create_learning_item`

`load_workstation_data` is expected to return a JSON payload with projects, tasks, notes, vault items, learning items, email templates, Gantt tasks, and timer sessions. The UI converts that database shape into app-friendly objects before rendering.

## Local Persistence

DevOS stores a few UI preferences in `localStorage`:

- `devos:activeWs` for the selected workstation
- `devos:nav` for the last active page
- `devos:timerSec` and `devos:timerRunning` for the timer
- tweak panel values for theme and layout preferences

Primary application data is loaded from Supabase after authentication and workstation selection.

## Supabase Notes

Configure the Supabase project with:

- Email/password auth enabled
- Google OAuth enabled if you want the Google sign-in button to work
- Redirect URLs that include the local dev origin, usually `http://localhost:5173`
- RPC functions matching the names and payload contracts used in `src/lib/db.js`

Database migrations are not included in this repository, so the Supabase schema and RPC functions must be provisioned separately.

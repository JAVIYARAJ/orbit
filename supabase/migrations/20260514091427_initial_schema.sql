-- ─── Profiles ─────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  avatar     text,
  created_at timestamptz default now() not null
);

-- ─── Projects ─────────────────────────────────────────────────────
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  short_id     text not null,
  name         text not null,
  client       text,
  type         text,
  start_date   date,
  end_date     date,
  status       text default 'planning' not null,
  stack        text[] default '{}',
  progress     int default 0,
  tasks_count  int default 0,
  open_tasks   int default 0,
  hours_logged numeric default 0,
  hours_est    numeric default 0,
  repo         text,
  budget       text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

-- ─── Tasks ────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  task_id          text not null,
  project_short_id text not null,
  col              text default 'todo' not null,
  priority         int default 2,
  title            text not null,
  due_date         date,
  est_hours        numeric default 0,
  actual_hours     numeric default 0,
  tags             text[] default '{}',
  subs_total       int default 0,
  subs_done        int default 0,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

-- ─── Notes ────────────────────────────────────────────────────────
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  title      text not null,
  folder     text default 'General',
  tags       text[] default '{}',
  pinned     boolean default false,
  body       text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ─── Vault ────────────────────────────────────────────────────────
create table if not exists public.vault (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  cat        text default 'other',
  name       text not null,
  value      text not null,
  updated_at date default current_date not null
);

-- ─── Learning ─────────────────────────────────────────────────────
create table if not exists public.learning (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  status        text default 'to_learn' not null,
  topic         text not null,
  cat           text,
  est_hours     numeric,
  actual_hours  numeric,
  link          text,
  note          text,
  needs_review  boolean default false,
  progress      int default 0,
  last_reviewed date,
  created_at    timestamptz default now() not null
);

-- ─── Email Templates ──────────────────────────────────────────────
create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  template_id text not null,
  cat         text,
  name        text not null,
  body        text not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- ─── Timer Sessions ───────────────────────────────────────────────
create table if not exists public.timer_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  project_name text,
  task_name    text,
  start_time   text,
  end_time     text,
  duration     text,
  is_live      boolean default false,
  session_date date default current_date,
  created_at   timestamptz default now() not null
);

-- ─── Gantt Tasks ──────────────────────────────────────────────────
create table if not exists public.gantt_tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  sub        text,
  start_week numeric,
  end_week   numeric,
  status     text default 'planning',
  sort_order int default 0,
  created_at timestamptz default now() not null
);

-- ─── Auto-updated_at trigger ──────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_projects_upd  before update on public.projects        for each row execute function public.handle_updated_at();
create trigger trg_tasks_upd     before update on public.tasks           for each row execute function public.handle_updated_at();
create trigger trg_notes_upd     before update on public.notes           for each row execute function public.handle_updated_at();
create trigger trg_templates_upd before update on public.email_templates for each row execute function public.handle_updated_at();

-- ─── Auto-create profile on signup ───────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    upper(left(coalesce(new.raw_user_meta_data->>'name', new.email), 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ───────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.tasks           enable row level security;
alter table public.notes           enable row level security;
alter table public.vault           enable row level security;
alter table public.learning        enable row level security;
alter table public.email_templates enable row level security;
alter table public.timer_sessions  enable row level security;
alter table public.gantt_tasks     enable row level security;

create policy "own_profiles"        on public.profiles        for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own_projects"        on public.projects        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_tasks"           on public.tasks           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_notes"           on public.notes           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_vault"           on public.vault           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_learning"        on public.learning        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_email_templates" on public.email_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_timer_sessions"  on public.timer_sessions  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_gantt_tasks"     on public.gantt_tasks     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

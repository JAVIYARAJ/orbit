// db.js — All database access goes through Supabase RPC (PostgreSQL functions).
// No raw table queries from the client.

import { supabase } from './supabase.js'

// ─── Relative time helper ─────────────────────────────────────────
const relTime = (ts) => {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(ts).getDay()]
  return new Date(ts).toLocaleDateString()
}

// ─── DB → App shape converters ────────────────────────────────────

const fromDbProject = (r) => ({
  id:          r.short_id,
  _dbId:       r.id,
  name:        r.name,
  client:      r.client,
  type:        r.type,
  start:       r.start_date  || '',
  end:         r.end_date    || '—',
  status:      r.status,
  stack:       r.stack       || [],
  progress:    r.progress,
  tasks:       r.tasks_count,
  openTasks:   r.open_tasks,
  hoursLogged: Number(r.hours_logged) || 0,
  hoursEst:    Number(r.hours_est)    || 0,
  repo:        r.repo,
  budget:      r.budget,
})

const fromDbTask = (r) => ({
  id:     r.task_id,
  _dbId:  r.id,
  proj:   r.project_short_id,
  col:    r.col,
  p:      r.priority,
  title:  r.title,
  due:    r.due_date || '—',
  est:    Number(r.est_hours)    || 0,
  actual: Number(r.actual_hours) || 0,
  tags:   r.tags || [],
  ...(r.subs_total > 0 ? { subs: [r.subs_total, r.subs_done] } : {}),
})

const fromDbNote = (r) => ({
  id:     r.id,
  title:  r.title,
  folder: r.folder,
  tags:   r.tags   || [],
  pinned: r.pinned,
  edited: relTime(r.updated_at),
  body:   r.body,
})

const fromDbLearning = (r) => ({
  _dbId:        r.id,
  topic:        r.topic,
  cat:          r.cat,
  est:          Number(r.est_hours)    || 0,
  actual:       Number(r.actual_hours) || 0,
  link:         r.link,
  note:         r.note,
  rev:          r.needs_review,
  prog:         r.progress,
  lastReviewed: r.last_reviewed,
})

const fromDbVault = (r) => ({
  id:      r.id,
  cat:     r.cat,
  name:    r.name,
  value:   r.value,
  updated: r.updated_at,
})

// ─── App → RPC payload builders ───────────────────────────────────
// These produce the jsonb-compatible objects expected by each RPC.

const projectPayload = (p) => ({
  short_id:     p.id,
  name:         p.name,
  client:       p.client       || '',
  type:         p.type         || '',
  start_date:   p.start        || null,
  end_date:     (!p.end || p.end === '—') ? null : p.end,
  status:       p.status,
  stack:        p.stack        || [],
  progress:     p.progress     || 0,
  tasks_count:  p.tasks        || 0,
  open_tasks:   p.openTasks    || 0,
  hours_logged: p.hoursLogged  || 0,
  hours_est:    p.hoursEst     || 0,
  repo:         p.repo         || '',
  budget:       p.budget       || '',
})

const taskPayload = (t) => ({
  task_id:          t.id,
  project_short_id: t.proj,
  col:              t.col,
  priority:         t.p,
  title:            t.title,
  due_date:         (!t.due || t.due === '—') ? null : t.due,
  est_hours:        t.est    || 0,
  actual_hours:     t.actual || 0,
  tags:             t.tags   || [],
  subs_total:       t.subs?.[0] || 0,
  subs_done:        t.subs?.[1] || 0,
})

const learningPayload = (i) => ({
  topic:        i.topic,
  cat:          i.cat         || '',
  est_hours:    i.est         ?? null,
  actual_hours: i.actual      ?? null,
  link:         i.link        || '',
  note:         i.note        || '',
  needs_review: i.rev         || false,
  progress:     i.prog        || 0,
  last_reviewed:i.lastReviewed || null,
})

// ─── Transform the jsonb blob from load_workstation_data ──────────
const transformData = (raw) => ({
  projects: (raw.projects || []).map(fromDbProject),
  tasks:    (raw.tasks    || []).map(fromDbTask),
  notes:    (raw.notes    || []).map(fromDbNote),
  vault:    (raw.vault    || []).map(fromDbVault),
  learning: {
    toLearn:    (raw.learning || []).filter(r => r.status === 'to_learn').map(fromDbLearning),
    inProgress: (raw.learning || []).filter(r => r.status === 'in_progress').map(fromDbLearning),
    completed:  (raw.learning || []).filter(r => r.status === 'completed').map(fromDbLearning),
  },
  emailTemplates: (raw.email_templates || []).map(r => ({
    id: r.template_id, cat: r.cat, name: r.name, body: r.body,
  })),
  ganttTasks: (raw.gantt_tasks || []).map(r => ({
    name: r.name, sub: r.sub, start: r.start_week, end: r.end_week, status: r.status,
  })),
  sessions: (raw.timer_sessions || []).map(r => ({
    proj: r.project_name, task: r.task_name,
    start: r.start_time, end: r.end_time, dur: r.duration,
  })),
})

// ═══════════════════════════════════════════════════════════════════
// WORKSTATIONS
// ═══════════════════════════════════════════════════════════════════

export const loadUserWorkstations = async () => {
  const { data, error } = await supabase.rpc('get_my_workstations')
  if (error) throw error
  return data || []
}

export const createWorkstation = async (name, color = '#0099ff') => {
  const { data, error } = await supabase.rpc('create_my_workstation', {
    p_name: name, p_color: color,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export const setActiveWorkstation = async (workstationId) => {
  const { error } = await supabase.rpc('switch_active_workstation', {
    p_workstation_id: workstationId,
  })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// DATA LOADING  (single round-trip)
// ═══════════════════════════════════════════════════════════════════

export const loadUserData = async (workstationId) => {
  const { data, error } = await supabase.rpc('load_workstation_data', {
    p_workstation_id: workstationId,
  })
  if (error) throw error
  return transformData(data)
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Projects
// ═══════════════════════════════════════════════════════════════════

export const createProject = async (p, workstationId) => {
  const { data, error } = await supabase.rpc('create_project', {
    p_workstation_id: workstationId,
    p_data:           projectPayload(p),
  })
  if (error) throw error
  return fromDbProject(data)
}

export const updateProject = async (p) => {
  const { data, error } = await supabase.rpc('update_project', {
    p_short_id: p.id,
    p_data:     projectPayload(p),
  })
  if (error) throw error
  return fromDbProject(data)
}

export const deleteProject = async (shortId) => {
  const { error } = await supabase.rpc('delete_project', { p_short_id: shortId })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Tasks
// ═══════════════════════════════════════════════════════════════════

export const createTask = async (t, workstationId) => {
  const { data, error } = await supabase.rpc('create_task', {
    p_workstation_id: workstationId,
    p_data:           taskPayload(t),
  })
  if (error) throw error
  return fromDbTask(data)
}

export const updateTask = async (t) => {
  const { data, error } = await supabase.rpc('update_task', {
    p_task_id: t.id,
    p_data:    taskPayload(t),
  })
  if (error) throw error
  return fromDbTask(data)
}

export const deleteTask = async (taskId) => {
  const { error } = await supabase.rpc('delete_task', { p_task_id: taskId })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Notes
// ═══════════════════════════════════════════════════════════════════

export const createNote = async (n, workstationId) => {
  const { data, error } = await supabase.rpc('create_note', {
    p_workstation_id: workstationId,
    p_data: {
      title:  n.title,
      folder: n.folder || 'General',
      tags:   n.tags   || [],
      pinned: n.pinned || false,
      body:   n.body   || '',
    },
  })
  if (error) throw error
  return fromDbNote(data)
}

export const updateNote = async (n) => {
  const { data, error } = await supabase.rpc('update_note', {
    p_note_id: n.id,
    p_data: { title: n.title, folder: n.folder, tags: n.tags, pinned: n.pinned, body: n.body },
  })
  if (error) throw error
  return fromDbNote(data)
}

export const deleteNote = async (noteId) => {
  const { error } = await supabase.rpc('delete_note', { p_note_id: noteId })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Vault
// ═══════════════════════════════════════════════════════════════════

export const createVaultItem = async (item, workstationId) => {
  const { data, error } = await supabase.rpc('create_vault_item', {
    p_workstation_id: workstationId,
    p_data: { cat: item.cat, name: item.name, value: item.value },
  })
  if (error) throw error
  return fromDbVault(data)
}

export const updateVaultItem = async (item) => {
  const { data, error } = await supabase.rpc('update_vault_item', {
    p_item_id: item.id,
    p_data: { cat: item.cat, name: item.name, value: item.value },
  })
  if (error) throw error
  return fromDbVault(data)
}

export const deleteVaultItem = async (id) => {
  const { error } = await supabase.rpc('delete_vault_item', { p_item_id: id })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Email Templates
// ═══════════════════════════════════════════════════════════════════

export const createEmailTemplate = async (t, workstationId) => {
  const { data, error } = await supabase.rpc('create_email_template', {
    p_workstation_id: workstationId,
    p_data: {
      template_id: t.id || `tpl-${Date.now()}`,
      cat: t.cat, name: t.name, body: t.body,
    },
  })
  if (error) throw error
  return { id: data.template_id, cat: data.cat, name: data.name, body: data.body }
}

export const updateEmailTemplate = async (t) => {
  const { error } = await supabase.rpc('update_email_template', {
    p_template_id: t.id,
    p_data: { cat: t.cat, name: t.name, body: t.body },
  })
  if (error) throw error
}

export const deleteEmailTemplate = async (templateId) => {
  const { error } = await supabase.rpc('delete_email_template', { p_template_id: templateId })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Learning
// ═══════════════════════════════════════════════════════════════════

const STATUS_MAP = { toLearn: 'to_learn', inProgress: 'in_progress', completed: 'completed' }

export const createLearningItem = async (item, column, workstationId) => {
  const { data, error } = await supabase.rpc('create_learning_item', {
    p_workstation_id: workstationId,
    p_data: { status: STATUS_MAP[column] || 'to_learn', ...learningPayload(item) },
  })
  if (error) throw error
  return { column, item: fromDbLearning(data) }
}

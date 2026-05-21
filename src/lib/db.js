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
  description: r.description || '',
  typeId:      r.project_type_id || null,
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
  deletedAt:   r.deleted_at  || null,
})

const fromDbTask = (r) => ({
  id:            r.task_id,
  _dbId:         r.id,
  proj:          r.project_short_id,
  col:           r.status_id,
  p:             r.priority,
  title:         r.title,
  description:   r.description || '',
  due:           r.due_date || '—',
  tags:          r.tag_ids || [],
  parentId:      r.parent_task_id || null,
  createdAt:     r.created_at || null,
  estMinutes:    r.est_minutes    || 0,
  loggedMinutes: r.logged_minutes || 0,
  ghBranch:      r.gh_branch      || '',
  deletedAt:     r.deleted_at     || null,
})

const fromDbNote = (r) => ({
  id:         r.id,
  title:      r.title,
  folderId:   r.folder_id   || null,
  folderName: r.folder_name || 'Other',
  tags:       r.tags        || [],
  pinned:     r.pinned,
  edited:     relTime(r.updated_at),
  updatedAt:  r.updated_at  || null,
  body:       r.body,
})

const fromDbNoteFolder = (r) => ({
  id:        r.id,
  name:      r.name,
  sortOrder: r.sort_order ?? 0,
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
  client:          p.client      || '',
  description:     p.description || '',
  project_type_id: p.typeId      || null,
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
  status_id:        t.col,
  priority:         t.p,
  title:            t.title,
  description:      t.description || '',
  due_date:         (!t.due || t.due === '—') ? null : t.due,
  tag_ids:          t.tags        || [],
  parent_task_id:   t.parentId    || null,
  est_minutes:      t.estMinutes  || 0,
  gh_branch:        t.ghBranch    || null,
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

// ─── DB → App shape converters ────────────────────────────────────
const fromDbTag = (r) => ({
  id:    r.id,
  name:  r.name,
  color: r.color || '#888888',
})

const fromDbProjectType = (r) => ({
  id:    r.id,
  label: r.label,
  order: r.sort_order,
})

const fromDbStatus = (r) => ({
  id:     r.id,
  key:    r.key,
  label:  r.label,
  color:  r.color,
  order:  r.sort_order,
  isDone: r.is_done ?? false,
})

// ─── Transform the jsonb blob from load_workstation_data ──────────
const transformData = (raw) => ({
  statuses:     (raw.statuses      || []).map(fromDbStatus),
  projectTypes: (raw.project_types || []).map(fromDbProjectType),
  tags:         (raw.tags          || []).map(fromDbTag),
  projects: (raw.projects || []).map(fromDbProject).filter(p => !p.deletedAt),
  tasks:    (raw.tasks    || []).map(fromDbTask).filter(t => !t.deletedAt),
  noteFolders: (raw.note_folders || []).map(fromDbNoteFolder),
  notes:       (raw.notes        || []).map(fromDbNote),
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
// USER CONTEXT  (single round-trip: profile + workstations + roles)
// ═══════════════════════════════════════════════════════════════════

// Returns { user, workstations, active_workstation_id }
// workstations[].role = 'owner' | 'admin' | 'member' | 'viewer'
export const getMyContext = async () => {
  const { data, error } = await supabase.rpc('get_my_context')
  if (error) throw error
  return data
}

// Persist a new avatar URL to profiles.avatar_url
export const updateMyAvatar = async (url) => {
  const { error } = await supabase.rpc('update_my_avatar', { p_url: url })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// WORKSTATIONS
// ═══════════════════════════════════════════════════════════════════

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

export const softDeleteProject = async (shortId) => {
  const { error } = await supabase.rpc('soft_delete_project', { p_short_id: shortId })
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
      title:     n.title,
      folder_id: n.folderId || null,
      tags:      n.tags     || [],
      pinned:    n.pinned   || false,
      body:      n.body     || '',
    },
  })
  if (error) throw error
  return fromDbNote(data)
}

export const updateNote = async (n) => {
  const { data, error } = await supabase.rpc('update_note', {
    p_note_id: n.id,
    p_data: {
      title:     n.title,
      folder_id: n.folderId ?? null,
      tags:      n.tags,
      pinned:    n.pinned,
      body:      n.body,
    },
  })
  if (error) throw error
  return fromDbNote(data)
}

export const deleteNote = async (noteId) => {
  const { error } = await supabase.rpc('delete_note', { p_note_id: noteId })
  if (error) throw error
}

export const restoreNote = async (noteId) => {
  const { data, error } = await supabase.rpc('restore_note', { p_note_id: noteId })
  if (error) throw error
  return fromDbNote(data)
}

export const purgeNote = async (noteId) => {
  const { error } = await supabase.rpc('purge_note', { p_note_id: noteId })
  if (error) throw error
}

export const getDeletedNotes = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_deleted_notes', { p_workstation_id: workstationId })
  if (error) throw error
  return (data || []).map(fromDbNote)
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Note Folders
// ═══════════════════════════════════════════════════════════════════

export const createNoteFolder = async (workstationId, name) => {
  const { data, error } = await supabase.rpc('create_note_folder', {
    p_workstation_id: workstationId,
    p_name: name,
  })
  if (error) throw error
  return fromDbNoteFolder(data)
}

export const renameNoteFolder = async (folderId, name) => {
  const { data, error } = await supabase.rpc('rename_note_folder', {
    p_folder_id: folderId,
    p_name: name,
  })
  if (error) throw error
  return fromDbNoteFolder(data)
}

export const deleteNoteFolder = async (folderId, workstationId) => {
  const { error } = await supabase.rpc('delete_note_folder', {
    p_folder_id: folderId,
    p_workstation_id: workstationId,
  })
  if (error) throw error
}

export const reorderNoteFolders = async (workstationId, folderIds) => {
  const { error } = await supabase.rpc('reorder_note_folders', {
    p_workstation_id: workstationId,
    p_folder_ids: folderIds,
  })
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

// ═══════════════════════════════════════════════════════════════════
// CRUD — Task Statuses
// ═══════════════════════════════════════════════════════════════════

export const createTaskStatus = async (workstationId, data) => {
  const { data: result, error } = await supabase.rpc('create_task_status', {
    p_workstation_id: workstationId,
    p_data:           data,
  })
  if (error) throw error
  return fromDbStatus(result)
}

export const updateTaskStatus = async (statusId, data) => {
  const { data: result, error } = await supabase.rpc('update_task_status', {
    p_status_id: statusId,
    p_data:      data,
  })
  if (error) throw error
  return fromDbStatus(result)
}

export const deleteTaskStatus = async (statusId) => {
  const { error } = await supabase.rpc('delete_task_status', { p_status_id: statusId })
  if (error) throw error
}

export const reorderTaskStatuses = async (workstationId, orderedIds) => {
  const { error } = await supabase.rpc('reorder_task_statuses', {
    p_workstation_id: workstationId,
    p_ordered_ids:    orderedIds,
  })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Learning
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// CRUD — Project Types
// ═══════════════════════════════════════════════════════════════════

export const createProjectType = async (workstationId, label) => {
  const { data, error } = await supabase.rpc('create_project_type', {
    p_workstation_id: workstationId,
    p_data: { label, sort_order: 999 },
  })
  if (error) throw error
  return fromDbProjectType(data)
}

export const updateProjectType = async (id, label) => {
  const { data, error } = await supabase.rpc('update_project_type', {
    p_type_id: id,
    p_data:    { label },
  })
  if (error) throw error
  return fromDbProjectType(data)
}

export const deleteProjectType = async (id) => {
  const { error } = await supabase.rpc('delete_project_type', { p_type_id: id })
  if (error) throw error
}

export const reorderProjectTypes = async (workstationId, orderedIds) => {
  const { error } = await supabase.rpc('reorder_project_types', {
    p_workstation_id: workstationId,
    p_ordered_ids:    orderedIds,
  })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// TASK ↔ NOTE LINKS
// ═══════════════════════════════════════════════════════════════════

export const linkNoteToTask = async (taskDbId, noteId) => {
  const { error } = await supabase.rpc('link_note_to_task', {
    p_task_id: taskDbId,
    p_note_id: noteId,
  })
  if (error) throw error
}

export const unlinkNoteFromTask = async (taskDbId, noteId) => {
  const { error } = await supabase.rpc('unlink_note_from_task', {
    p_task_id: taskDbId,
    p_note_id: noteId,
  })
  if (error) throw error
}

export const loadTaskNoteLinks = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_task_note_links', {
    p_workstation_id: workstationId,
  })
  if (error) throw error
  const map = {}
  for (const row of (data || [])) {
    if (!map[row.task_id]) map[row.task_id] = []
    map[row.task_id].push(row.note_id)
  }
  return map
}

// ─── Tags ─────────────────────────────────────────────────────────
export const createTag = async (workstationId, name, color = '#888888') => {
  const { data, error } = await supabase.rpc('create_tag', {
    p_workstation_id: workstationId,
    p_data: { name, color },
  })
  if (error) throw error
  return fromDbTag(data)
}

export const updateTag = async (id, name, color) => {
  const { data, error } = await supabase.rpc('update_tag', {
    p_tag_id: id,
    p_data:   { name, color },
  })
  if (error) throw error
  return fromDbTag(data)
}

export const deleteTag = async (id) => {
  const { error } = await supabase.rpc('delete_tag', { p_tag_id: id })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// TIME TRACKING
// ═══════════════════════════════════════════════════════════════════

const fromTimeEntry = (r) => ({
  id:           r.id,
  projectId:    r.projectId,
  projectName:  r.projectName,
  projectShort: r.projectShort,
  taskId:       r.taskId    || null,
  taskTitle:    r.taskTitle  || null,
  taskShort:    r.taskShort  || null,
  status:       r.status,
  totalSeconds: r.totalSeconds || 0,
  notes:        r.notes        || '',
  startedAt:    r.startedAt,
  endedAt:      r.endedAt     || null,
  events:       (r.events || []).map(ev => ({
    id:      ev.id,
    event:   ev.event,
    at:      ev.at,
    elapsed: ev.elapsed || 0,
  })),
})

export const startTimeEntry = async (workstationId, projectId, taskId = null) => {
  const { data, error } = await supabase.rpc('start_time_entry', {
    p_workstation_id: workstationId,
    p_project_id:     projectId,
    p_task_id:        taskId,
  })
  if (error) throw error
  return fromTimeEntry(data)
}

export const pauseTimeEntry = async (entryId, elapsedSeconds) => {
  const { data, error } = await supabase.rpc('pause_time_entry', {
    p_entry_id:        entryId,
    p_elapsed_seconds: elapsedSeconds,
  })
  if (error) throw error
  return fromTimeEntry(data)
}

export const resumeTimeEntry = async (entryId) => {
  const { data, error } = await supabase.rpc('resume_time_entry', {
    p_entry_id: entryId,
  })
  if (error) throw error
  return fromTimeEntry(data)
}

export const completeTimeEntry = async (entryId, elapsedSeconds, notes = '') => {
  const { data, error } = await supabase.rpc('complete_time_entry', {
    p_entry_id:        entryId,
    p_elapsed_seconds: elapsedSeconds,
    p_notes:           notes,
  })
  if (error) throw error
  return fromTimeEntry(data)
}

export const discardTimeEntry = async (entryId) => {
  const { error } = await supabase.rpc('discard_time_entry', {
    p_entry_id: entryId,
  })
  if (error) throw error
}

export const getTimeEntries = async (workstationId, limit = 100) => {
  const { data, error } = await supabase.rpc('get_time_entries', {
    p_workstation_id: workstationId,
    p_limit:          limit,
  })
  if (error) throw error
  return (data || []).map(fromTimeEntry)
}

export const logManualTime = async (workstationId, projectId, taskId, minutes, notes = '') => {
  const { data, error } = await supabase.rpc('log_manual_time', {
    p_workstation_id: workstationId,
    p_project_id:     projectId,
    p_task_id:        taskId,
    p_minutes:        minutes,
    p_notes:          notes,
  })
  if (error) throw error
  return fromTimeEntry(data)
}

export const getActiveTimeEntry = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_active_time_entry', {
    p_workstation_id: workstationId,
  })
  if (error) throw error
  return data ? fromTimeEntry(data) : null
}

export const getHomeStats = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_home_stats', {
    p_workstation_id: workstationId,
  })
  if (error) throw error
  return {
    hoursThisWeek: Number(data.hours_this_week) || 0,
    hoursLastWeek: Number(data.hours_last_week) || 0,
    weekChart:     (data.week_chart || []).map(d => ({ dow: d.dow, hours: Number(d.hours) || 0 })),
    streakCurrent: Number(data.streak_current) || 0,
    streakBest:    Number(data.streak_best)    || 0,
  }
}

export const getTaskStatusLogs = async (taskDbId) => {
  const { data, error } = await supabase.rpc('get_task_status_logs', {
    p_task_id: taskDbId,
  })
  if (error) throw error
  return (data || []).map(r => ({
    id:              r.id,
    fromStatusLabel: r.fromStatusLabel || null,
    fromStatusColor: r.fromStatusColor || null,
    toStatusLabel:   r.toStatusLabel   || null,
    toStatusColor:   r.toStatusColor   || null,
    changedAt:       r.changedAt,
  }))
}

export const createLearningItem = async (item, column, workstationId) => {
  const { data, error } = await supabase.rpc('create_learning_item', {
    p_workstation_id: workstationId,
    p_data: { status: STATUS_MAP[column] || 'to_learn', ...learningPayload(item) },
  })
  if (error) throw error
  return { column, item: fromDbLearning(data) }
}

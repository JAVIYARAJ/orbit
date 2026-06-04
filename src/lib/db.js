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

// Audit attribution carried on every content record (created_by/updated_by/deleted_by).
// Resolve to a display name client-side via the workspace `members` list.
const auditFields = (r) => ({
  createdBy: r.created_by || null,
  updatedBy: r.updated_by || null,
  deletedBy: r.deleted_by || null,
})

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
  ...auditFields(r),
})

const fromDbTask = (r) => ({
  id:            r.task_id,
  _dbId:         r.id,
  proj:          r.project_short_id,
  col:           r.status_id,
  p:             r.priority_id || null,
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
  assigneeId:    r.assignee_id    || null,
  ...auditFields(r),
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
  ...auditFields(r),
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
  difficulty:   r.difficulty  || null,
  createdAt:    r.created_at  || null,
  ...auditFields(r),
})

const fromDbVault = (r) => ({
  id:          r.id,
  cat:         r.cat,
  name:        r.name,
  value:       r.value,
  isEncrypted: r.is_encrypted ?? false,
  updated:     r.updated_at,
  ...auditFields(r),
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
  priority_id:      t.p || null,
  title:            t.title,
  description:      t.description || '',
  due_date:         (!t.due || t.due === '—') ? null : t.due,
  tag_ids:          t.tags        || [],
  parent_task_id:   t.parentId    || null,
  est_minutes:      t.estMinutes  || 0,
  gh_branch:        t.ghBranch    || null,
  assignee_id:      t.assigneeId  || null,
})

const learningPayload = (i) => ({
  topic:         i.topic,
  cat:           i.cat          || '',
  est_hours:     i.est          ?? null,
  actual_hours:  i.actual       ?? null,
  link:          i.link         || '',
  note:          i.note         || '',
  needs_review:  i.rev          || false,
  progress:      i.prog         || 0,
  last_reviewed: i.lastReviewed || null,
  difficulty:   i.difficulty  || null,
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

const fromDbPriority = (r) => ({
  id:    r.id,
  label: r.label,
  color: r.color || '#888888',
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
  priorities:   (raw.task_priorities || []).map(fromDbPriority),
  statuses:     (raw.statuses        || []).map(fromDbStatus),
  projectTypes: (raw.project_types   || []).map(fromDbProjectType),
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
    ...auditFields(r),
  })),
  ganttTasks: (raw.gantt_tasks || []).map(r => ({
    id: r.id, projectId: r.project_id,
    name: r.name, sub: r.sub, start: r.start_week, end: r.end_week, status: r.status,
    ...auditFields(r),
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

export const softDeleteTask = async (taskId) => {
  const { error } = await supabase.rpc('soft_delete_task', { p_task_id: taskId })
  if (error) throw error
}

export const getProjectTasks = async (workstationId, projectShortId) => {
  const { data, error } = await supabase.rpc('get_project_tasks', {
    p_workstation_id:   workstationId,
    p_project_short_id: projectShortId,
  })
  if (error) throw error
  return (data || []).map(fromDbTask)
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Calendar events (native Orbit events)
// ═══════════════════════════════════════════════════════════════════

const fromDbCalendarEvent = (r) => ({
  id:        r.id,
  title:     r.title,
  description: r.description || '',
  location:  r.location || '',
  start:     r.starts_at,
  end:       r.ends_at,
  allDay:    r.all_day ?? false,
  color:     r.color || null,
  projectId: r.project_short_id || null,
  remindMinutes: r.remind_minutes ?? null,
  ...auditFields(r),
})

const calendarEventPayload = (e) => ({
  title:            e.title,
  description:      e.description || '',
  location:         e.location || null,
  starts_at:        e.start,
  ends_at:          e.end,
  all_day:          e.allDay ?? false,
  color:            e.color || null,
  project_short_id: e.projectId || null,
  remind_minutes:   (e.remindMinutes === '' || e.remindMinutes == null) ? null : Number(e.remindMinutes),
})

export const createCalendarEvent = async (e, workstationId) => {
  const { data, error } = await supabase.rpc('create_calendar_event', {
    p_workstation_id: workstationId,
    p_data:           calendarEventPayload(e),
  })
  if (error) throw error
  return fromDbCalendarEvent(data)
}

export const updateCalendarEvent = async (id, e) => {
  const { data, error } = await supabase.rpc('update_calendar_event', {
    p_id:   id,
    p_data: calendarEventPayload(e),
  })
  if (error) throw error
  return fromDbCalendarEvent(data)
}

export const deleteCalendarEvent = async (id) => {
  const { error } = await supabase.rpc('delete_calendar_event', { p_id: id })
  if (error) throw error
}

// Single round-trip read for the calendar page: native events + cached Google
// events + tasks-with-due_date + projects-with-dates within [from, to].
export const loadCalendarWindow = async (workstationId, from, to) => {
  const { data, error } = await supabase.rpc('list_calendar_window', {
    p_workstation_id: workstationId,
    p_from:           from,
    p_to:             to,
  })
  if (error) throw error
  return {
    events:   (data?.events   || []).map(fromDbCalendarEvent),
    google:   data?.google    || [],
    tasks:    data?.tasks     || [],
    projects: data?.projects  || [],
  }
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
    p_data: { cat: item.cat, name: item.name, value: item.value, is_encrypted: item.isEncrypted ?? false },
  })
  if (error) throw error
  return fromDbVault(data)
}

export const updateVaultItem = async (item) => {
  const { data, error } = await supabase.rpc('update_vault_item', {
    p_item_id: item.id,
    p_data: { cat: item.cat, name: item.name, value: item.value, is_encrypted: item.isEncrypted ?? false },
  })
  if (error) throw error
  return fromDbVault(data)
}

export const deleteVaultItem = async (id) => {
  const { error } = await supabase.rpc('delete_vault_item', { p_item_id: id })
  if (error) throw error
}

export const getVaultConfig = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_vault_config', { p_workstation_id: workstationId })
  if (error) throw error
  return data ? { salt: data.salt, verifier: data.verifier } : null
}

export const saveVaultConfig = async (workstationId, salt, verifier) => {
  const { error } = await supabase.rpc('upsert_vault_config', {
    p_workstation_id: workstationId,
    p_salt: salt,
    p_verifier: verifier,
  })
  if (error) throw error
}

export const resetVault = async (workstationId) => {
  const { error } = await supabase.rpc('reset_vault', { p_workstation_id: workstationId })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// CRUD — Gantt Tasks
// ═══════════════════════════════════════════════════════════════════

const fromDbGantt = (r) => ({
  id: r.id, projectId: r.project_id,
  name: r.name, sub: r.sub || '', start: r.start_week, end: r.end_week, status: r.status,
  ...auditFields(r),
})

export const createGanttTask = async (workstationId, projectDbId, name, sub, startWeek, endWeek, status) => {
  const { data, error } = await supabase.rpc('create_gantt_task', {
    p_workstation_id: workstationId, p_project_id: projectDbId,
    p_name: name, p_sub: sub, p_start_week: startWeek, p_end_week: endWeek, p_status: status,
  })
  if (error) throw error
  return fromDbGantt(data)
}

export const updateGanttTask = async (id, name, sub, startWeek, endWeek, status) => {
  const { data, error } = await supabase.rpc('update_gantt_task', {
    p_id: id, p_name: name, p_sub: sub, p_start_week: startWeek, p_end_week: endWeek, p_status: status,
  })
  if (error) throw error
  return fromDbGantt(data)
}

export const deleteGanttTask = async (id) => {
  const { error } = await supabase.rpc('delete_gantt_task', { p_id: id })
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
// CRUD — Task Priorities
// ═══════════════════════════════════════════════════════════════════

export const createTaskPriority = async (workstationId, label, color = '#888888') => {
  const { data, error } = await supabase.rpc('create_task_priority', {
    p_workstation_id: workstationId,
    p_data: { label, color, sort_order: 999 },
  })
  if (error) throw error
  return fromDbPriority(data)
}

export const updateTaskPriority = async (id, label, color) => {
  const { data, error } = await supabase.rpc('update_task_priority', {
    p_priority_id: id,
    p_data:        { label, color },
  })
  if (error) throw error
  return fromDbPriority(data)
}

export const deleteTaskPriority = async (id) => {
  const { error } = await supabase.rpc('delete_task_priority', { p_priority_id: id })
  if (error) throw error
}

export const reorderTaskPriorities = async (workstationId, orderedIds) => {
  const { error } = await supabase.rpc('reorder_task_priorities', {
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
  isManual:     r.isManual    || false,
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

// ═══════════════════════════════════════════════════════════════════
// TASK COMMENTS
// ═══════════════════════════════════════════════════════════════════

const fromDbComment = (r) => ({
  id:             r.id,
  parentId:       r.parentId       || null,
  userId:         r.userId,
  authorName:     r.authorName     || 'Unknown',
  authorAvatar:   r.authorAvatar   || null,
  authorAvatarUrl:r.authorAvatarUrl|| null,
  body:           r.body,
  createdAt:      r.createdAt,
  editedAt:       r.editedAt       || null,
})

// Paginated by top-level comment (newest first). Returns { comments, total } where
// `total` is the count of top-level comments (for the "show more" affordance).
export const getTaskComments = async (taskDbId, { limit = 10, offset = 0 } = {}) => {
  const { data, error } = await supabase.rpc('get_task_comments', {
    p_task_id: taskDbId,
    p_limit:   limit,
    p_offset:  offset,
  })
  if (error) throw error
  return {
    comments: (data?.comments || []).map(fromDbComment),
    total:    data?.total ?? 0,
  }
}

export const addTaskComment = async (taskDbId, body, mentionedUserIds = [], parentId = null) => {
  const { data, error } = await supabase.rpc('add_task_comment', {
    p_task_id:   taskDbId,
    p_body:      body,
    p_mentions:  mentionedUserIds,
    p_parent_id: parentId,
  })
  if (error) throw error
  return fromDbComment(data)
}

export const updateTaskComment = async (commentId, body) => {
  const { data, error } = await supabase.rpc('update_task_comment', { p_comment_id: commentId, p_body: body })
  if (error) throw error
  return fromDbComment(data)
}

export const deleteTaskComment = async (commentId) => {
  const { error } = await supabase.rpc('delete_task_comment', { p_comment_id: commentId })
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

const fromDbNotification = (r) => ({
  id:             r.id,
  type:           r.type,
  readAt:         r.readAt         || null,
  createdAt:      r.createdAt,
  actorName:      r.actorName      || 'Unknown',
  actorAvatarUrl: r.actorAvatarUrl || null,
  taskTitle:      r.taskTitle      || '',
  taskDbId:       r.taskDbId       || null,
  commentId:      r.commentId      || null,
  preview:        r.preview        || '',
})

export const getNotifications = async (limit = 30) => {
  const { data, error } = await supabase.rpc('get_notifications', { p_limit: limit })
  if (error) throw error
  return (data || []).map(fromDbNotification)
}

export const markNotificationsRead = async (ids) => {
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
  if (error) throw error
}

export const getUnreadNotificationsCount = async () => {
  const { data, error } = await supabase.rpc('get_unread_notifications_count')
  if (error) return 0
  return data || 0
}

export const createLearningItem = async (item, column, workstationId) => {
  const { data, error } = await supabase.rpc('create_learning_item', {
    p_workstation_id: workstationId,
    p_data: { status: STATUS_MAP[column] || 'to_learn', ...learningPayload(item) },
  })
  if (error) throw error
  return { column, item: fromDbLearning(data) }
}

const STATUS_MAP_REV = { to_learn: 'toLearn', in_progress: 'inProgress', completed: 'completed' }

export const updateLearningItem = async (item, newColumn) => {
  const payload = { ...learningPayload(item) }
  if (newColumn) payload.status = STATUS_MAP[newColumn] || newColumn
  const { data, error } = await supabase.rpc('update_learning_item', {
    p_item_id: item._dbId,
    p_data:    payload,
  })
  if (error) throw error
  return { column: newColumn || STATUS_MAP_REV[data.status] || 'toLearn', item: fromDbLearning(data) }
}

export const deleteLearningItem = async (id) => {
  const { error } = await supabase.rpc('delete_learning_item', { p_item_id: id })
  if (error) throw error
}

const fromDbSession = (r) => ({
  id:        r.id,
  learningId:r.learning_id,
  date:      r.date,
  hours:     Number(r.hours) || 0,
  note:      r.note || '',
  createdAt: r.created_at,
})

export const createLearningSession = async (learningId, hours, note = '', date = null) => {
  const params = { p_learning_id: learningId, p_hours: hours, p_note: note || '' }
  if (date) params.p_date = date
  const { data, error } = await supabase.rpc('create_learning_session', params)
  if (error) throw error
  return { session: fromDbSession(data.session), learning: fromDbLearning(data.learning) }
}

export const listLearningSessions = async (learningId) => {
  const { data, error } = await supabase.rpc('list_learning_sessions', { p_learning_id: learningId })
  if (error) throw error
  return (data || []).map(fromDbSession)
}

export const deleteLearningSession = async (sessionId) => {
  const { data, error } = await supabase.rpc('delete_learning_session', { p_session_id: sessionId })
  if (error) throw error
  return fromDbLearning(data)
}

export const getWeeklyLearningHours = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_weekly_learning_hours', { p_workstation_id: workstationId })
  if (error) throw error
  return Number(data) || 0
}

export const getLearningActivity = async (workstationId, startDate = null, endDate = null) => {
  const params = { p_workstation_id: workstationId }
  if (startDate) params.p_start_date = startDate
  if (endDate)   params.p_end_date   = endDate
  const { data, error } = await supabase.rpc('get_learning_activity', params)
  if (error) throw error
  return (data || []).map(r => ({ date: r.activity_date, hours: Number(r.total_hours) || 0 }))
}

// ─── Team / Members ───────────────────────────────────────────────

const fromDbMember = (r) => ({
  userId:    r.user_id,
  role:      r.role,
  name:      r.name || r.email?.split('@')[0] || 'Unknown',
  email:     r.email,
  avatar:    r.avatar || (r.name?.[0] || '?').toUpperCase(),
  avatarUrl: r.avatar_url || null,
  joinedAt:  r.joined_at,
})

const fromDbInvite = (r) => ({
  id:        r.id,
  email:     r.email,
  role:      r.role,
  token:     r.token,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
})

export const listWorkspaceMembers = async (workstationId) => {
  const { data, error } = await supabase.rpc('list_workspace_members', { p_workstation_id: workstationId })
  if (error) throw error
  return (data || []).map(fromDbMember)
}

export const inviteMember = async (workstationId, email, role, workspaceName, inviterName) => {
  const { data, error } = await supabase.rpc('invite_member', {
    p_workstation_id: workstationId,
    p_email:          email,
    p_role:           role,
    p_workspace_name: workspaceName,
    p_inviter_name:   inviterName,
  })
  if (error) throw error
  return data
}

export const acceptInvite = async (token) => {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
  if (error) throw error
  return data
}

export const cancelInvite = async (inviteId) => {
  const { error } = await supabase.rpc('cancel_invite', { p_invite_id: inviteId })
  if (error) throw error
}

export const getPendingInvites = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_pending_invites', { p_workstation_id: workstationId })
  if (error) throw error
  return (data || []).map(fromDbInvite)
}

export const getInviteByToken = async (token) => {
  const { data, error } = await supabase.rpc('get_invite_by_token', { p_token: token })
  if (error) throw error
  return data
}

export const updateMemberRole = async (workstationId, userId, role) => {
  const { error } = await supabase.rpc('update_member_role', {
    p_workstation_id: workstationId,
    p_user_id:        userId,
    p_role:           role,
  })
  if (error) throw error
}

export const removeMember = async (workstationId, userId) => {
  const { error } = await supabase.rpc('remove_member', {
    p_workstation_id: workstationId,
    p_user_id:        userId,
  })
  if (error) throw error
}

export const transferOwnership = async (workstationId, newOwnerId) => {
  const { error } = await supabase.rpc('transfer_ownership', {
    p_workstation_id: workstationId,
    p_new_owner_id:   newOwnerId,
  })
  if (error) throw error
}

// ─── Workspace Permissions ────────────────────────────────────────

export const getWorkspacePermissions = async (workstationId) => {
  const { data, error } = await supabase.rpc('get_workspace_permissions', { p_workstation_id: workstationId })
  if (error) throw error
  return data || {}
}

export const upsertPermission = async (workstationId, role, key, allowed) => {
  const { error } = await supabase.rpc('upsert_permission', {
    p_workstation_id: workstationId,
    p_role:           role,
    p_key:            key,
    p_allowed:        allowed,
  })
  if (error) throw error
}

// ─── Activity log (audit trail) ───────────────────────────────────
// Who did what across the workspace. entityType/action are enum-backed strings.

const fromDbActivity = (r) => ({
  id:            r.id,
  action:        r.action,        // created | updated | deleted | restored
  entityType:    r.entityType,    // project | task | note | … | member | invite | permission | workspace
  entityId:      r.entityId       || null,
  entityLabel:   r.entityLabel    || '',
  meta:          r.meta           || {},
  createdAt:     r.createdAt,
  actorId:       r.actorId        || null,
  actorName:     r.actorName      || 'Unknown',
  actorAvatar:   r.actorAvatar    || null,
  actorAvatarUrl:r.actorAvatarUrl || null,
})

// opts: { limit?, entityType?, entityId? } — entityType/entityId scope to one record's history
export const getActivity = async (workstationId, opts = {}) => {
  const { data, error } = await supabase.rpc('get_activity', {
    p_workstation_id: workstationId,
    p_limit:          opts.limit      ?? 50,
    p_entity_type:    opts.entityType ?? null,
    p_entity_id:      opts.entityId   ?? null,
  })
  if (error) throw error
  return (data || []).map(fromDbActivity)
}


import { supabase } from './supabase.js'

// ── In-memory cache with TTL (mirrors github.js) ───────────────────
const _cache = new Map()
function cached(key, ttlMs, fetcher) {
  const hit = _cache.get(key)
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data)
  return fetcher().then(data => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}
export function gcalClearCache() { _cache.clear() }

// Active workspace ID — set by App so every proxy call uses the workspace's
// shared Google Calendar connection.
let _workstationId = null
export function gcalSetWorkstationId(id) { _workstationId = id }

// All Google Calendar calls go through the google-calendar-proxy Edge Function.
// Tokens are decrypted/refreshed server-side and never reach the browser.
async function gcalProxy(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('google-calendar-proxy', {
    body: { action, workstation_id: _workstationId, ...payload },
  })
  if (error) throw new Error(error.message || 'Google Calendar proxy error')
  if (data?.status === 403) throw new Error('__RECONNECT__')
  if (data?.status && data.status >= 400) {
    throw new Error(data?.error || `Google Calendar ${data.status}`)
  }
  return data?.data ?? data
}

export const gcalListEvents = (timeMin, timeMax, calendarId = 'primary') =>
  cached(`gcal:list:${calendarId}:${timeMin}:${timeMax}`, 60_000, () =>
    gcalProxy('list', { calendarId, timeMin, timeMax }))

export const gcalCreateEvent = (event, calendarId = 'primary') =>
  gcalProxy('insert', { event, calendarId })

export const gcalUpdateEvent = (eventId, event, calendarId = 'primary') =>
  gcalProxy('update', { eventId, event, calendarId })

export const gcalDeleteEvent = (eventId, calendarId = 'primary') =>
  gcalProxy('delete', { eventId, calendarId })

// Runs the two-way sync engine server-side, then clears the list cache.
export const gcalSync = () => {
  gcalClearCache()
  return gcalProxy('sync')
}

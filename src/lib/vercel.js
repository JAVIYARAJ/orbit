import { supabase } from './supabase.js'

// ── In-memory cache with TTL ───────────────────────────────────────
const TTL    = 2 * 60 * 1000  // 2 min
const _cache = new Map()

function cached(key, ttlMs, fetcher) {
  const hit = _cache.get(key)
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data)
  return fetcher().then(data => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}

export function vcClearCache() { _cache.clear() }

// All Vercel API calls go through the vercel-proxy Edge Function.
// The raw token never reaches the browser — it is decrypted server-side.
async function vcProxy(path, params = {}, method = 'GET', body = null) {
  const { data, error } = await supabase.functions.invoke('vercel-proxy', {
    body: { path, params, method, body },
  })
  if (error) throw new Error(error.message || 'Vercel proxy error')
  if (data?.status && data.status >= 400) {
    throw new Error(`Vercel ${data.status}: ${JSON.stringify(data?.data)}`)
  }
  return data?.data ?? data
}

export const vcGetUser = () =>
  cached('vc:user', TTL, () =>
    vcProxy('/v2/user').then(d => d.user ?? d))

export const vcGetProjects = () =>
  cached('vc:projects', TTL, () =>
    vcProxy('/v9/projects', { limit: 100 }).then(d => d.projects || []))

export const vcGetDeployments = (until = null) => {
  const key    = `vc:deployments:${until ?? 'first'}`
  const params = { limit: 20 }
  if (until) params.until = until
  return cached(key, TTL, () =>
    vcProxy('/v6/deployments', params).then(d => ({
      deployments: d.deployments || [],
      next:        d.pagination?.next ?? null,
    }))
  )
}

export const vcGetDomains = () =>
  cached('vc:domains', TTL, () =>
    vcProxy('/v5/domains', { limit: 100 }).then(d => d.domains || []))

export const vcPromoteDeployment = (deploymentId, alias) =>
  vcProxy(`/v13/deployments/${deploymentId}/aliases`, {}, 'POST', { alias })

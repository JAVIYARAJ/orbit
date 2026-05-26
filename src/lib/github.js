import { supabase } from './supabase.js'
import { GITHUB_CACHE_TTL, GITHUB_API } from './githubConfig.js'

// ── In-memory cache with TTL ───────────────────────────────────────
const _cache = new Map()

function cached(key, ttlMs, fetcher) {
  const hit = _cache.get(key)
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data)
  return fetcher().then(data => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  })
}

export function ghClearCache() { _cache.clear() }

// All GitHub API calls go through the github-proxy Edge Function.
// The raw token never reaches the browser — it is decrypted server-side.
async function ghProxy(path, params = {}, method = 'GET', body = null) {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: { path, params, method, body },
  })
  if (error) throw new Error(error.message || 'GitHub proxy error')
  if (data?.status === 403) throw new Error('__RECONNECT__')
  if (data?.status && data.status >= 400) {
    throw new Error(data?.data?.message || `GitHub ${data.status}`)
  }
  return data?.data ?? data
}

// Returns the full proxy response (includes scopes header)
async function ghProxyRaw(path, params = {}) {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: { path, params },
  })
  if (error) throw new Error(error.message || 'GitHub proxy error')
  return data
}

export const ghGetUser = () =>
  cached('gh:user', GITHUB_CACHE_TTL.USER, () => ghProxy('/user'))

export async function ghGetTokenScopes() {
  const raw = await ghProxyRaw('/user')
  const str = raw?.scopes ?? ''
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

export const ghGetRepos = (page = 1) =>
  cached(`gh:repos:${page}`, GITHUB_CACHE_TTL.REPOS, () =>
    ghProxy('/user/repos', {
      sort: 'updated', direction: 'desc',
      per_page: GITHUB_API.PER_PAGE_REPOS, page,
      affiliation: 'owner,collaborator,organization_member',
    }))

export const ghGetPRs = (page = 1) =>
  cached(`gh:prs:${page}`, GITHUB_CACHE_TTL.PRS, () =>
    ghProxy('/search/issues', {
      q: 'is:pr is:open author:@me',
      per_page: GITHUB_API.PER_PAGE_PRS, page, sort: 'updated',
    }))

export const ghGetIssues = (page = 1) =>
  cached(`gh:issues:${page}`, GITHUB_CACHE_TTL.ISSUES, () =>
    ghProxy('/issues', {
      state: 'open', per_page: GITHUB_API.PER_PAGE_ISSUES,
      page, sort: 'updated', filter: 'assigned',
    }))

export const ghGetActivity = (username, page = 1) =>
  cached(`gh:activity:${username}:${page}`, GITHUB_CACHE_TTL.ACTIVITY, () =>
    ghProxy(`/users/${username}/events`, { per_page: GITHUB_API.PER_PAGE_ACTIVITY, page }))

export const ghGetActivityAll = (username) =>
  cached(`gh:activity-all:${username}`, GITHUB_CACHE_TTL.ACTIVITY, async () => {
    const pages = await Promise.all(
      [1, 2, 3].map(p =>
        ghProxy(`/users/${username}/events`, { per_page: 100, page: p }).catch(() => [])
      )
    )
    return pages.flat()
  })

export const ghGetOrgs = () =>
  cached('gh:orgs', GITHUB_CACHE_TTL.ORGS, () =>
    ghProxy('/user/orgs', { per_page: GITHUB_API.PER_PAGE_REPOS }))

export const ghGetStarred = (page = 1) =>
  cached(`gh:starred:${page}`, GITHUB_CACHE_TTL.STARRED, () =>
    ghProxy('/user/starred', { per_page: GITHUB_API.PER_PAGE_STARRED, page, sort: 'updated' }))

export const ghGetNotifications = () =>
  cached('gh:notifs', GITHUB_CACHE_TTL.NOTIFICATIONS, () =>
    ghProxy('/notifications', { per_page: GITHUB_API.PER_PAGE_NOTIFICATIONS, all: false }))

export const ghGetLastCommit = (fullName) =>
  cached(`gh:commit:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghProxy(`/repos/${fullName}/commits`, { per_page: 1 }))

export const ghGetBranches = (fullName) =>
  cached(`gh:branches:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghProxy(`/repos/${fullName}/branches`, { per_page: 100 }))

export const ghGetRepoCommits = (fullName) =>
  cached(`gh:repocommits:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghProxy(`/repos/${fullName}/commits`, { per_page: 15 }))

export const ghGetRepoLanguages = (fullName) =>
  cached(`gh:langs:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghProxy(`/repos/${fullName}/languages`))

export const ghGetRepoContributors = (fullName) =>
  cached(`gh:contributors:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghProxy(`/repos/${fullName}/contributors`, { per_page: 5 }))

export async function ghCreateBranch(fullName, branchName) {
  let sha
  try {
    const ref = await ghProxy(`/repos/${fullName}/git/ref/heads/main`)
    sha = ref.object.sha
  } catch {
    const ref = await ghProxy(`/repos/${fullName}/git/ref/heads/master`)
    sha = ref.object.sha
  }
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: { path: `/repos/${fullName}/git/refs`, params: {}, method: 'POST', body: { ref: `refs/heads/${branchName}`, sha } },
  })
  if (error) throw new Error(error.message)
  if (data?.status === 422) throw new Error(`Branch "${branchName}" already exists in ${fullName}.`)
  if (data?.status && data.status >= 400) throw new Error(data?.data?.message || `GitHub ${data.status}`)
  return data?.data
}

export async function ghDeleteBranch(fullName, branchName) {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: { path: `/repos/${fullName}/git/refs/heads/${encodeURIComponent(branchName)}`, params: {}, method: 'DELETE' },
  })
  if (error) throw new Error(error.message)
  if (data?.status === 204) return
  if (data?.status === 404) throw new Error(`Branch "${branchName}" not found or already deleted.`)
  throw new Error(data?.data?.message || `GitHub ${data?.status}`)
}

export async function ghCreateRepo(name, isPrivate = false, description = '') {
  return ghProxy('/user/repos', {}, 'POST', { name, description, private: isPrivate, auto_init: true })
}

export async function ghDeleteRepo(fullName) {
  const { data, error } = await supabase.functions.invoke('github-proxy', {
    body: { path: `/repos/${fullName}`, params: {}, method: 'DELETE' },
  })
  if (error) throw new Error(error.message)
  if (data?.status === 204) return
  if (data?.status === 404) throw new Error(`Repository "${fullName}" not found or already deleted.`)
  if (data?.status === 403) throw new Error('__RECONNECT__')
  throw new Error(data?.data?.message || `GitHub ${data?.status}`)
}

import { GITHUB_CACHE_TTL, GITHUB_API } from './githubConfig.js';

const BASE = 'https://api.github.com';

// ── In-memory cache with TTL ───────────────────────────────────────
const _cache = new Map();

function cached(key, ttlMs, fetcher) {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data);
  return fetcher().then(data => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

// Call this when the user disconnects GitHub so stale data is gone
export function ghClearCache() { _cache.clear(); }

const GH_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

async function ghFetch(token, path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: GH_HEADERS(token) });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`GitHub ${res.status}: ${msg}`);
  }
  return res.json();
}

async function ghPost(token, path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { ...GH_HEADERS(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`GitHub ${res.status}: ${msg}`);
  }
  return res.json();
}

// Creates a branch from the repo's default branch HEAD.
// Tries `main` first, falls back to `master`.
export async function ghCreateBranch(token, fullName, branchName) {
  let sha;
  try {
    const ref = await ghFetch(token, `/repos/${fullName}/git/ref/heads/main`);
    sha = ref.object.sha;
  } catch {
    const ref = await ghFetch(token, `/repos/${fullName}/git/ref/heads/master`);
    sha = ref.object.sha;
  }

  const res = await fetch(`${BASE}/repos/${fullName}/git/refs`, {
    method: 'POST',
    headers: { ...GH_HEADERS(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  if (res.status === 422) {
    throw new Error(`Branch "${branchName}" already exists in ${fullName}.`);
  }
  throw new Error(body.message || `GitHub ${res.status}`);
}

export const ghGetUser     = (token) =>
  cached(`user:${token}`, GITHUB_CACHE_TTL.USER, () => ghFetch(token, '/user'));

export async function ghGetTokenScopes(token) {
  const res = await fetch(`${BASE}/user`, { headers: GH_HEADERS(token) });
  if (!res.ok) return [];
  const raw = res.headers.get('X-OAuth-Scopes') || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export const ghGetRepos    = (token, page = 1) =>
  cached(`repos:${token}:${page}`, GITHUB_CACHE_TTL.REPOS, () =>
    ghFetch(token, '/user/repos', { sort: 'updated', direction: 'desc', per_page: GITHUB_API.PER_PAGE_REPOS, page, affiliation: 'owner,collaborator,organization_member' }));

export const ghGetPRs      = (token, page = 1) =>
  cached(`prs:${token}:${page}`, GITHUB_CACHE_TTL.PRS, () =>
    ghFetch(token, '/search/issues', { q: 'is:pr is:open author:@me', per_page: GITHUB_API.PER_PAGE_PRS, page, sort: 'updated' }));

export const ghGetIssues   = (token, page = 1) =>
  cached(`issues:${token}:${page}`, GITHUB_CACHE_TTL.ISSUES, () =>
    ghFetch(token, '/issues', { state: 'open', per_page: GITHUB_API.PER_PAGE_ISSUES, page, sort: 'updated', filter: 'assigned' }));

export const ghGetActivity = (token, username, page = 1) =>
  cached(`activity:${token}:${username}:${page}`, GITHUB_CACHE_TTL.ACTIVITY, () =>
    ghFetch(token, `/users/${username}/events`, { per_page: GITHUB_API.PER_PAGE_ACTIVITY, page }));

export const ghGetActivityAll = (token, username) =>
  cached(`activity-all:${token}:${username}`, GITHUB_CACHE_TTL.ACTIVITY, async () => {
    const pages = await Promise.all(
      [1, 2, 3].map(p =>
        ghFetch(token, `/users/${username}/events`, { per_page: 100, page: p }).catch(() => [])
      )
    );
    return pages.flat();
  });

export const ghGetOrgs     = (token) =>
  cached(`orgs:${token}`, GITHUB_CACHE_TTL.ORGS, () =>
    ghFetch(token, '/user/orgs', { per_page: GITHUB_API.PER_PAGE_REPOS }));

export const ghGetStarred  = (token, page = 1) =>
  cached(`starred:${token}:${page}`, GITHUB_CACHE_TTL.STARRED, () =>
    ghFetch(token, '/user/starred', { per_page: GITHUB_API.PER_PAGE_STARRED, page, sort: 'updated' }));

export const ghGetNotifications = (token) =>
  cached(`notifs:${token}`, GITHUB_CACHE_TTL.NOTIFICATIONS, () =>
    ghFetch(token, '/notifications', { per_page: GITHUB_API.PER_PAGE_NOTIFICATIONS, all: false }));

export const ghGetLastCommit = (token, fullName) =>
  cached(`commit:${token}:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghFetch(token, `/repos/${fullName}/commits`, { per_page: 1 }));

export const ghGetBranches = (token, fullName) =>
  cached(`branches:${token}:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghFetch(token, `/repos/${fullName}/branches`, { per_page: 100 }));

export const ghGetRepoCommits = (token, fullName) =>
  cached(`commits15:${token}:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghFetch(token, `/repos/${fullName}/commits`, { per_page: 15 }));

export const ghGetRepoLanguages = (token, fullName) =>
  cached(`langs:${token}:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghFetch(token, `/repos/${fullName}/languages`));

export const ghGetRepoContributors = (token, fullName) =>
  cached(`contributors:${token}:${fullName}`, GITHUB_CACHE_TTL.COMMIT, () =>
    ghFetch(token, `/repos/${fullName}/contributors`, { per_page: 5 }));

export async function ghCreateRepo(token, name, isPrivate = false, description = '') {
  return ghPost(token, '/user/repos', {
    name,
    description,
    private: isPrivate,
    auto_init: true,
  });
}

export async function ghDeleteBranch(token, fullName, branchName) {
  const res = await fetch(`${BASE}/repos/${fullName}/git/refs/heads/${encodeURIComponent(branchName)}`, {
    method: 'DELETE',
    headers: GH_HEADERS(token),
  });
  if (res.status === 204) return;
  if (res.status === 404) throw new Error(`Branch "${branchName}" not found or already deleted.`);
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message || `GitHub ${res.status}`);
}

export async function ghDeleteRepo(token, fullName) {
  const res = await fetch(`${BASE}/repos/${fullName}`, {
    method: 'DELETE',
    headers: GH_HEADERS(token),
  });
  if (res.status === 204) return; // success — no body
  if (res.status === 404) {
    throw new Error(`Repository "${fullName}" not found or already deleted.`);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 403) {
    throw new Error('__RECONNECT__');
  }
  throw new Error(body.message || `GitHub ${res.status}`);
}

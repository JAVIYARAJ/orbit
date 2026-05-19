const BASE = 'https://api.github.com';

async function ghFetch(token, path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`GitHub ${res.status}: ${msg}`);
  }
  return res.json();
}

export const ghGetUser        = (token)                => ghFetch(token, '/user');
export const ghGetRepos       = (token, page = 1)      => ghFetch(token, '/user/repos',   { sort: 'updated', direction: 'desc', per_page: 100, page, affiliation: 'owner,collaborator,organization_member' });
export const ghGetPRs         = (token, page = 1)      => ghFetch(token, '/search/issues',{ q: 'is:pr is:open author:@me', per_page: 30, page, sort: 'updated' });
export const ghGetIssues      = (token, page = 1)      => ghFetch(token, '/issues',        { state: 'open', per_page: 30, page, sort: 'updated', filter: 'assigned' });
export const ghGetActivity    = (token, username, page = 1) => ghFetch(token, `/users/${username}/events`, { per_page: 30, page });
export const ghGetOrgs        = (token)                => ghFetch(token, '/user/orgs',     { per_page: 100 });
export const ghGetStarred     = (token, page = 1)      => ghFetch(token, '/user/starred',  { per_page: 30, page, sort: 'updated' });
export const ghGetNotifications = (token)              => ghFetch(token, '/notifications', { per_page: 30, all: false });

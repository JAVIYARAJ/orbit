// ─────────────────────────────────────────────────────────────────
//  GitHub API — tuneable config
//  All durations are in milliseconds. Formula: minutes * 60 * 1000
// ─────────────────────────────────────────────────────────────────

const MIN = 60 * 1000;

export const GITHUB_CACHE_TTL = {
  USER:         10 * MIN,   // profile info — very stable
  REPOS:         5 * MIN,   // repo list — rarely changes mid-session
  COMMIT:        2 * MIN,   // last commit — can change often
  PRS:           2 * MIN,
  ISSUES:        2 * MIN,
  ACTIVITY:      2 * MIN,
  ORGS:         10 * MIN,
  STARRED:       5 * MIN,
  NOTIFICATIONS: 1 * MIN,   // keep fresh so unread count stays accurate
};

export const GITHUB_API = {
  PER_PAGE_REPOS:         100,
  PER_PAGE_PRS:           30,
  PER_PAGE_ISSUES:        30,
  PER_PAGE_ACTIVITY:      30,
  PER_PAGE_STARRED:       30,
  PER_PAGE_NOTIFICATIONS: 30,
};

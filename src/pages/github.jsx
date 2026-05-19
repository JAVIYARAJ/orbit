import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';
import { ghGetUser, ghGetRepos, ghGetPRs, ghGetIssues, ghGetActivity } from '../lib/github.js';

const LANG_COLORS = {
  JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5', Dart:'#00B4AB',
  Go:'#00ADD8', Rust:'#dea584', Swift:'#F05138', Kotlin:'#A97BFF', Java:'#b07219',
  'C++':'#f34b7d', C:'#555555', Ruby:'#701516', PHP:'#4F5D95', CSS:'#563d7c',
  HTML:'#e34c26', Shell:'#89e051', Vue:'#41b883', Svelte:'#ff3e00',
};

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Not connected ─────────────────────────────────────────────────────
function NotConnected({ onGoSettings }) {
  return (
    <div className="gh-empty-full">
      <div className="gh-empty-ic"><Icon name="github" size={44} /></div>
      <div className="gh-empty-title">GitHub not connected</div>
      <div className="gh-empty-body">Connect your GitHub account to view repos, pull requests, issues and activity.</div>
      <button className="btn primary" onClick={() => onGoSettings?.('settings')}>
        Go to Integrations
      </button>
    </div>
  );
}

// ── Repos tab ─────────────────────────────────────────────────────────
function ReposTab({ token }) {
  const [repos,     setRepos]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [langFlt,   setLangFlt]   = useState('all');
  const [typeFlt,   setTypeFlt]   = useState('all');

  useEffect(() => {
    ghGetRepos(token).then(setRepos).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  const langs = useMemo(() => ['all', ...new Set(repos.map(r => r.language).filter(Boolean))], [repos]);

  const filtered = useMemo(() => repos.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !(r.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (langFlt !== 'all' && r.language !== langFlt) return false;
    if (typeFlt === 'owned' && r.fork) return false;
    if (typeFlt === 'fork' && !r.fork) return false;
    if (typeFlt === 'private' && !r.private) return false;
    return true;
  }), [repos, search, langFlt, typeFlt]);

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;

  return (
    <div className="gh-repos-wrap">
      <div className="gh-toolbar">
        <div className="gh-search-row">
          <Icon name="search" size={13} />
          <input className="gh-search" placeholder="Search repositories…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="gh-filter-row">
          <select className="gh-sel" value={langFlt} onChange={e => setLangFlt(e.target.value)}>
            {langs.map(l => <option key={l} value={l}>{l === 'all' ? 'All languages' : l}</option>)}
          </select>
          <select className="gh-sel" value={typeFlt} onChange={e => setTypeFlt(e.target.value)}>
            <option value="all">All types</option>
            <option value="owned">Owned</option>
            <option value="fork">Forked</option>
            <option value="private">Private</option>
          </select>
        </div>
        <span className="gh-count-badge">{filtered.length} repo{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="gh-repo-grid">
        {filtered.map(repo => (
          <a key={repo.id} className="gh-repo-card" href={repo.html_url} target="_blank" rel="noreferrer">
            <div className="gh-repo-hd">
              <div className="gh-repo-name">
                <Icon name="folder" size={13} />
                <span className="gh-repo-owner">{repo.owner.login}/</span>
                <span className="gh-repo-title">{repo.name}</span>
              </div>
              <div className="gh-repo-badges">
                {repo.private  && <span className="gh-pill private">private</span>}
                {repo.fork     && <span className="gh-pill fork">fork</span>}
                {repo.archived && <span className="gh-pill archived">archived</span>}
              </div>
            </div>
            {repo.description && <p className="gh-repo-desc">{repo.description}</p>}
            <div className="gh-repo-ft">
              {repo.language && (
                <span className="gh-lang-tag">
                  <span className="gh-lang-dot" style={{ background: LANG_COLORS[repo.language] || '#888' }} />
                  {repo.language}
                </span>
              )}
              <span className="gh-repo-stat"><Icon name="star" size={11} />{repo.stargazers_count}</span>
              <span className="gh-repo-stat"><Icon name="git-fork" size={11} />{repo.forks_count}</span>
              <span className="gh-repo-updated">{timeAgo(repo.updated_at)}</span>
            </div>
          </a>
        ))}
        {filtered.length === 0 && <div className="gh-empty-msg">No repositories match your filters.</div>}
      </div>
    </div>
  );
}

// ── Pull Requests tab ─────────────────────────────────────────────────
function PRsTab({ token }) {
  const [prs,     setPrs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    ghGetPRs(token)
      .then(d => setPrs(d.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="gh-list">
      {prs.length === 0 && <div className="gh-empty-msg">No open pull requests — you're all clear!</div>}
      {prs.map(pr => {
        const repo = pr.repository_url.replace('https://api.github.com/repos/', '');
        return (
          <a key={pr.id} className="gh-list-row" href={pr.html_url} target="_blank" rel="noreferrer">
            <div className="gh-list-ic gh-ic-pr"><Icon name="git-merge" size={13} /></div>
            <div className="gh-list-body">
              <div className="gh-list-title">{pr.title}</div>
              <div className="gh-list-meta">
                <span className="gh-list-repo">{repo}</span>
                <span className="gh-list-num">#{pr.number}</span>
                <span>{timeAgo(pr.updated_at)}</span>
                {pr.labels.slice(0, 3).map(l => (
                  <span key={l.id} className="gh-label-chip"
                    style={{ background: `#${l.color}22`, color: `#${l.color}`, borderColor: `#${l.color}44` }}>
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
            {pr.comments > 0 && (
              <div className="gh-list-cmt"><Icon name="message-square" size={12} />{pr.comments}</div>
            )}
          </a>
        );
      })}
    </div>
  );
}

// ── Issues tab ────────────────────────────────────────────────────────
function IssuesTab({ token }) {
  const [issues,  setIssues]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    ghGetIssues(token)
      .then(d => setIssues(d.filter(i => !i.pull_request)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="gh-list">
      {issues.length === 0 && <div className="gh-empty-msg">No open issues assigned to you.</div>}
      {issues.map(issue => {
        const repo = issue.repository_url.replace('https://api.github.com/repos/', '');
        return (
          <a key={issue.id} className="gh-list-row" href={issue.html_url} target="_blank" rel="noreferrer">
            <div className="gh-list-ic gh-ic-issue"><Icon name="flag" size={13} /></div>
            <div className="gh-list-body">
              <div className="gh-list-title">{issue.title}</div>
              <div className="gh-list-meta">
                <span className="gh-list-repo">{repo}</span>
                <span className="gh-list-num">#{issue.number}</span>
                <span>{timeAgo(issue.updated_at)}</span>
                {issue.labels.slice(0, 3).map(l => (
                  <span key={l.id} className="gh-label-chip"
                    style={{ background: `#${l.color}22`, color: `#${l.color}`, borderColor: `#${l.color}44` }}>
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
            {issue.comments > 0 && (
              <div className="gh-list-cmt"><Icon name="message-square" size={12} />{issue.comments}</div>
            )}
          </a>
        );
      })}
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────
const EV_ICON = { PushEvent:'arrow', CreateEvent:'plus', DeleteEvent:'trash', PullRequestEvent:'git-merge', IssuesEvent:'flag', WatchEvent:'eye', ForkEvent:'git', ReleaseEvent:'download', IssueCommentEvent:'message-square', PullRequestReviewEvent:'check' };

function evDesc(ev) {
  const repo = ev.repo.name;
  switch (ev.type) {
    case 'PushEvent': {
      const n = ev.payload.size ?? ev.payload.distinct_size ?? ev.payload.commits?.length ?? 0;
      return { main: `Pushed to ${repo}`, sub: `${n} commit${n !== 1 ? 's' : ''}`, commits: ev.payload.commits?.slice(0, 2) };
    }
    case 'PullRequestEvent':      return { main: `${ev.payload.action} PR in ${repo}`, sub: ev.payload.pull_request?.title };
    case 'IssuesEvent':           return { main: `${ev.payload.action} issue in ${repo}`, sub: ev.payload.issue?.title };
    case 'WatchEvent':            return { main: `Starred ${repo}`, sub: null };
    case 'ForkEvent':             return { main: `Forked ${repo}`, sub: ev.payload.forkee?.full_name };
    case 'CreateEvent':           return { main: `Created ${ev.payload.ref_type} in ${repo}`, sub: ev.payload.ref };
    case 'IssueCommentEvent':     return { main: `Commented on issue in ${repo}`, sub: ev.payload.issue?.title };
    case 'PullRequestReviewEvent':return { main: `Reviewed PR in ${repo}`, sub: ev.payload.pull_request?.title };
    case 'ReleaseEvent':          return { main: `Released ${ev.payload.release?.tag_name} in ${repo}`, sub: null };
    default:                      return { main: `${ev.type.replace('Event','')} in ${repo}`, sub: null };
  }
}

function ActivityTab({ token, username }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!username) return;
    ghGetActivity(token, username)
      .then(setEvents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, username]);

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="gh-activity">
      {events.length === 0 && <div className="gh-empty-msg">No recent activity.</div>}
      {events.map((ev, i) => {
        const d = evDesc(ev);
        return (
          <div key={ev.id || i} className="gh-ev-row">
            <div className="gh-ev-ic"><Icon name={EV_ICON[ev.type] || 'activity'} size={13} /></div>
            <div className="gh-ev-body">
              <div className="gh-ev-main">{d.main}</div>
              {d.sub && <div className="gh-ev-sub">{d.sub}</div>}
              {d.commits?.map(c => (
                <div key={c.sha} className="gh-ev-commit">
                  <span className="gh-ev-sha">{c.sha.slice(0, 7)}</span>
                  {c.message.split('\n')[0].slice(0, 80)}
                </div>
              ))}
            </div>
            <div className="gh-ev-time">{timeAgo(ev.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'repos',    label: 'Repositories', icon: 'folder'    },
  { id: 'prs',      label: 'Pull Requests', icon: 'git-merge' },
  { id: 'issues',   label: 'Issues',        icon: 'flag'      },
  { id: 'activity', label: 'Activity',      icon: 'activity'  },
];

export function GitHubPage({ onNav }) {
  const [integ,   setInteg]   = useState(null);
  const [ghUser,  setGhUser]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('repos');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'github')
        .maybeSingle();
      if (data) {
        setInteg(data);
        ghGetUser(data.access_token).then(setGhUser).catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="gh-page"><div className="gh-spin-wrap full"><div className="gh-spin" /></div></div>;
  if (!integ)  return <div className="gh-page"><NotConnected onGoSettings={onNav} /></div>;

  const token    = integ.access_token;
  const username = ghUser?.login || integ.username;
  const avatar   = ghUser?.avatar_url || integ.avatar_url;

  return (
    <div className="gh-page">
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{ margin: 0, lineHeight: 1 }}>GitHub</h1>
          {username && (
            <div className="gh-user-pill">
              {avatar && <img src={avatar} className="gh-pill-av" alt="" />}
              <span>@{username}</span>
            </div>
          )}
        </div>
        {ghUser && (
          <div className="gh-hd-stats">
            <div className="gh-hd-stat">
              <span className="gh-hd-stat-n">{ghUser.public_repos + (ghUser.total_private_repos || 0)}</span>
              <span className="gh-hd-stat-l">Repos</span>
            </div>
            <div className="gh-hd-stat">
              <span className="gh-hd-stat-n">{ghUser.followers}</span>
              <span className="gh-hd-stat-l">Followers</span>
            </div>
            <div className="gh-hd-stat">
              <span className="gh-hd-stat-n">{ghUser.following}</span>
              <span className="gh-hd-stat-l">Following</span>
            </div>
            <a className="gh-profile-link btn ghost sm" href={ghUser.html_url} target="_blank" rel="noreferrer">
              <Icon name="github" size={13} /> Profile
            </a>
          </div>
        )}
      </div>

      <div className="gh-body">
        <div className="gh-tab-bar">
          {TABS.map(t => (
            <button key={t.id} className={`gh-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={13} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="gh-tab-content">
          {tab === 'repos'    && <ReposTab    token={token} />}
          {tab === 'prs'      && <PRsTab      token={token} />}
          {tab === 'issues'   && <IssuesTab   token={token} />}
          {tab === 'activity' && <ActivityTab token={token} username={username} />}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';
import { renderMd } from './tools.jsx';
import { ghGetUser, ghGetRepos, ghGetPRs, ghGetIssues, ghGetActivity, ghGetActivityAll, ghGetBranches, ghGetRepoCommits, ghGetRepoLanguages, ghGetRepoContributors } from '../lib/github.js';

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

// ── Repo detail panel ─────────────────────────────────────────────────
function RepoDetailPanel({ repo, onClose }) {
  const [branches,     setBranches]     = useState([]);
  const [commits,      setCommits]      = useState([]);
  const [langs,        setLangs]        = useState({});
  const [contributors, setContributors] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!repo) return;
    setLoading(true);
    setBranches([]); setCommits([]); setLangs({}); setContributors([]);
    Promise.all([
      ghGetBranches(repo.full_name).catch(() => []),
      ghGetRepoCommits(repo.full_name).catch(() => []),
      ghGetRepoLanguages(repo.full_name).catch(() => ({})),
      ghGetRepoContributors(repo.full_name).catch(() => []),
    ]).then(([b, c, l, co]) => {
      setBranches(b); setCommits(c); setLangs(l); setContributors(co);
    }).finally(() => setLoading(false));
  }, [repo?.full_name]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!repo) return null;

  const totalBytes = Object.values(langs).reduce((s, v) => s + v, 0);
  const langList = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({ name, pct: Math.round((bytes / totalBytes) * 100) }));

  return (
    <>
      <div className="rd-backdrop" onClick={onClose} />
      <div className="rd-panel">

        {/* Header */}
        <div className="rd-header">
          <div className="rd-title">
            <Icon name="folder" size={14} />
            <span className="rd-owner">{repo.owner.login}/</span>
            <span className="rd-name">{repo.name}</span>
          </div>
          <div className="rd-header-actions">
            <a href={repo.html_url} target="_blank" rel="noreferrer" className="btn ghost xs">
              <Icon name="external-link" size={12} />Open
            </a>
            <button className="btn ghost xs icon-btn" onClick={onClose} title="Close (Esc)">
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="gh-spin-wrap"><div className="gh-spin" /></div>
        ) : (
          <div className="rd-body">

            {/* Description */}
            {repo.description && <p className="rd-desc">{repo.description}</p>}

            {/* Badges */}
            <div className="rd-badges">
              {repo.private  && <span className="gh-pill private">private</span>}
              {repo.fork     && <span className="gh-pill fork">fork</span>}
              {repo.archived && <span className="gh-pill archived">archived</span>}
              {repo.language && (
                <span className="gh-lang-tag">
                  <span className="gh-lang-dot" style={{ background: LANG_COLORS[repo.language] || '#888' }} />
                  {repo.language}
                </span>
              )}
            </div>

            {/* Quick stats */}
            <div className="rd-stats-row">
              <div className="rd-stat"><Icon name="star" size={12} />{repo.stargazers_count} stars</div>
              <div className="rd-stat"><Icon name="git-fork" size={12} />{repo.forks_count} forks</div>
              <div className="rd-stat"><Icon name="eye" size={12} />{repo.watchers_count} watching</div>
              <div className="rd-stat"><Icon name="alert-circle" size={12} />{repo.open_issues_count} issues</div>
            </div>

            {/* Meta info */}
            <div className="rd-meta-grid">
              <div className="rd-meta-item">
                <span className="rd-meta-label">Default branch</span>
                <span className="rd-meta-val"><Icon name="git-branch" size={11} />{repo.default_branch}</span>
              </div>
              <div className="rd-meta-item">
                <span className="rd-meta-label">Size</span>
                <span className="rd-meta-val">{repo.size >= 1024 ? `${(repo.size / 1024).toFixed(1)} MB` : `${repo.size} KB`}</span>
              </div>
              <div className="rd-meta-item">
                <span className="rd-meta-label">Created</span>
                <span className="rd-meta-val">{new Date(repo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="rd-meta-item">
                <span className="rd-meta-label">Last push</span>
                <span className="rd-meta-val">{timeAgo(repo.pushed_at)}</span>
              </div>
            </div>

            {/* Topics */}
            {repo.topics?.length > 0 && (
              <div className="rd-section">
                <div className="rd-section-label">Topics</div>
                <div className="rd-topics">
                  {repo.topics.map(t => <span key={t} className="rd-topic">{t}</span>)}
                </div>
              </div>
            )}

            {/* Language bar */}
            {langList.length > 0 && (
              <div className="rd-section">
                <div className="rd-section-label"><Icon name="code" size={12} />Languages</div>
                <div className="rd-lang-bar">
                  {langList.map(l => (
                    <div key={l.name} className="rd-lang-seg" title={`${l.name} ${l.pct}%`}
                      style={{ width: `${l.pct}%`, background: LANG_COLORS[l.name] || '#888' }} />
                  ))}
                </div>
                <div className="rd-lang-list">
                  {langList.map(l => (
                    <div key={l.name} className="rd-lang-row">
                      <span className="rd-lang-dot" style={{ background: LANG_COLORS[l.name] || '#888' }} />
                      <span className="rd-lang-name">{l.name}</span>
                      <span className="rd-lang-pct">{l.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Branches */}
            <div className="rd-section">
              <div className="rd-section-label">
                <Icon name="git-branch" size={12} />Branches
                <span className="rd-count-badge">{branches.length}</span>
              </div>
              <div className="rd-branch-list">
                {branches.slice(0, 10).map(b => (
                  <div key={b.name} className={`rd-branch-row${b.name === repo.default_branch ? ' rd-branch-default' : ''}`}>
                    <Icon name="git-branch" size={11} />
                    <span className="rd-branch-name">{b.name}</span>
                    {b.name === repo.default_branch && <span className="rd-default-tag">default</span>}
                  </div>
                ))}
                {branches.length > 10 && <div className="rd-more">+{branches.length - 10} more branches</div>}
                {branches.length === 0 && <div className="rd-empty">No branches found.</div>}
              </div>
            </div>

            {/* Recent commits */}
            <div className="rd-section">
              <div className="rd-section-label"><Icon name="git-commit" size={12} />Recent Commits</div>
              <div className="rd-commit-list">
                {commits.slice(0, 10).map(c => (
                  <a key={c.sha} href={c.html_url} target="_blank" rel="noreferrer" className="rd-commit-row">
                    <div className="rd-commit-msg">{c.commit.message.split('\n')[0]}</div>
                    <div className="rd-commit-meta">
                      <span className="rd-commit-author">{c.commit.author.name}</span>
                      <span className="rd-commit-dot">·</span>
                      <span>{timeAgo(c.commit.author.date)}</span>
                      <span className="rd-sha">{c.sha.slice(0, 7)}</span>
                    </div>
                  </a>
                ))}
                {commits.length === 0 && <div className="rd-empty">No commits found.</div>}
              </div>
            </div>

            {/* Contributors */}
            {contributors.length > 0 && (
              <div className="rd-section">
                <div className="rd-section-label"><Icon name="users" size={12} />Top Contributors</div>
                <div className="rd-contrib-list">
                  {contributors.map(c => (
                    <a key={c.id} href={c.html_url} target="_blank" rel="noreferrer" className="rd-contrib-row">
                      <img src={c.avatar_url} alt={c.login} className="rd-contrib-avatar" />
                      <span className="rd-contrib-login">{c.login}</span>
                      <span className="rd-contrib-count">{c.contributions} commits</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}

// ── Repos tab ─────────────────────────────────────────────────────────
function ReposTab() {
  const [repos,       setRepos]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [langFlt,     setLangFlt]     = useState('all');
  const [typeFlt,     setTypeFlt]     = useState('all');
  const [selectedRepo, setSelectedRepo] = useState(null);

  useEffect(() => {
    ghGetRepos().then(setRepos).catch(console.error).finally(() => setLoading(false));
  }, []);

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
          <div
            key={repo.id}
            className={`gh-repo-card${selectedRepo?.id === repo.id ? ' gh-repo-card-active' : ''}`}
            onClick={() => setSelectedRepo(r => r?.id === repo.id ? null : repo)}
          >
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
          </div>
        ))}
        {filtered.length === 0 && <div className="gh-empty-msg">No repositories match your filters.</div>}
      </div>

      <RepoDetailPanel repo={selectedRepo} onClose={() => setSelectedRepo(null)} />
    </div>
  );
}

// ── Pull Requests tab ─────────────────────────────────────────────────
function PRsTab() {
  const [prs,     setPrs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    ghGetPRs()
      .then(d => setPrs(d.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

// ── Issue detail panel ────────────────────────────────────────────────
function IssueDetailPanel({ issue, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!issue) return null;

  const repo = issue.repository_url.replace('https://api.github.com/repos/', '');
  const isOpen = issue.state === 'open';

  return (
    <>
      <div className="rd-backdrop" onClick={onClose} />
      <div className="rd-panel">

        {/* Header */}
        <div className="rd-header">
          <div className="rd-title">
            <Icon name="flag" size={14} />
            <span className="rd-owner">{repo}</span>
            <span className="rd-name">#{issue.number}</span>
          </div>
          <div className="rd-header-actions">
            <a href={issue.html_url} target="_blank" rel="noreferrer" className="btn ghost xs">
              <Icon name="external-link" size={12} />Open on GitHub
            </a>
            <button className="btn ghost xs icon-btn" onClick={onClose} title="Close (Esc)">
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        <div className="rd-body">

          {/* Title + state */}
          <div className="issue-dp-title">{issue.title}</div>
          <div className="issue-dp-meta-row">
            <span className={`issue-dp-state ${isOpen ? 'issue-dp-open' : 'issue-dp-closed'}`}>
              <Icon name={isOpen ? 'alert-circle' : 'check-circle'} size={11} />
              {isOpen ? 'Open' : 'Closed'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              opened {timeAgo(issue.created_at)} by <strong style={{ color: 'var(--text-2)' }}>{issue.user?.login}</strong>
            </span>
          </div>

          {/* Labels */}
          {issue.labels?.length > 0 && (
            <div className="rd-section">
              <div className="rd-section-label">Labels</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {issue.labels.map(l => (
                  <span key={l.id} className="gh-label-chip"
                    style={{ background: `#${l.color}22`, color: `#${l.color}`, borderColor: `#${l.color}44` }}>
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Assignees */}
          {issue.assignees?.length > 0 && (
            <div className="rd-section">
              <div className="rd-section-label"><Icon name="user" size={12} />Assignees</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {issue.assignees.map(a => (
                  <div key={a.id} className="rd-contrib-row">
                    <img src={a.avatar_url} alt={a.login} className="rd-contrib-avatar" />
                    <span className="rd-contrib-login">{a.login}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestone */}
          {issue.milestone && (
            <div className="rd-section">
              <div className="rd-meta-item">
                <span className="rd-meta-label">Milestone</span>
                <span className="rd-meta-val">{issue.milestone.title}</span>
              </div>
            </div>
          )}

          {/* Summary / Body */}
          <div className="rd-section">
            <div className="rd-section-label"><Icon name="file-text" size={12} />Summary</div>
            {issue.body?.trim() ? (
              <div
                className="issue-dp-body note-preview"
                dangerouslySetInnerHTML={{ __html: renderMd(issue.body.trim()) }}
              />
            ) : (
              <div className="rd-empty">No description provided.</div>
            )}
          </div>

          {/* Comments footer */}
          {issue.comments > 0 && (
            <div className="issue-dp-comments">
              <Icon name="message-square" size={13} />
              <span>{issue.comments} comment{issue.comments !== 1 ? 's' : ''}</span>
              <a href={issue.html_url} target="_blank" rel="noreferrer" className="btn ghost xs" style={{ marginLeft: 'auto' }}>
                View comments on GitHub
              </a>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ── Issues tab ────────────────────────────────────────────────────────
function IssuesTab() {
  const [issues,        setIssues]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => {
    ghGetIssues()
      .then(d => setIssues(d.filter(i => !i.pull_request)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="gh-list">
      {issues.length === 0 && <div className="gh-empty-msg">No open issues assigned to you.</div>}
      {issues.map(issue => {
        const repo = issue.repository_url.replace('https://api.github.com/repos/', '');
        const isActive = selectedIssue?.id === issue.id;
        return (
          <div
            key={issue.id}
            className={`gh-list-row${isActive ? ' gh-repo-card-active' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedIssue(i => i?.id === issue.id ? null : issue)}
          >
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
          </div>
        );
      })}

      <IssueDetailPanel issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────

const CELL = 12;   // cell size px
const GAP  = 4;    // gap between cells px
const WEEK = CELL + GAP; // 16px per week column
const WD_W = 32;   // weekday label column width

const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Local-time YYYY-MM-DD string — avoids UTC offset shifting the date
function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Contribution heatmap — full current year (Jan 1 → Dec 31)
function ContribGraph({ events }) {
  const year  = new Date().getFullYear();
  const today = new Date();
  const todayKey = localDateKey(today);

  const countMap = useMemo(() => {
    const m = {};
    events.forEach(ev => {
      if (ev.type !== 'PushEvent') return;
      // GitHub timestamps are UTC; convert to local date so the day matches the user's clock
      const d = new Date(ev.created_at);
      const date = localDateKey(d);
      const n = ev.payload.size ?? ev.payload.distinct_size ?? ev.payload.commits?.length ?? 1;
      m[date] = (m[date] || 0) + n;
    });
    return m;
  }, [events]);

  const { weeks, monthLabels, total, stats } = useMemo(() => {
    const jan1Dow = new Date(year, 0, 1).getDay();
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const allDays = [];
    let dayIndex = 0;
    for (let mo = 0; mo < 12; mo++) {
      for (let d = 1; d <= daysInMonth[mo]; d++) {
        const key = `${year}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        allDays.push({
          key, mo,
          count:    countMap[key] || 0,
          dow:      (jan1Dow + dayIndex) % 7,
          isFuture: key > todayKey,
        });
        dayIndex++;
      }
    }

    const ws = [];
    let week = new Array(allDays[0].dow).fill(null);
    allDays.forEach((day, i) => {
      week.push(day);
      if (day.dow === 6 || i === allDays.length - 1) {
        while (week.length < 7) week.push(null);
        ws.push([...week]);
        week = [];
      }
    });

    const labels = [];
    ws.forEach((w, wi) => {
      const first = w.find(Boolean);
      if (!first) return;
      const prevFirst = wi > 0 ? ws[wi - 1].find(Boolean) : null;
      if (first.mo !== (prevFirst?.mo ?? -1)) {
        labels.push({ left: wi * WEEK, label: MO_SHORT[first.mo] });
      }
    });

    const pastDays = allDays.filter(d => !d.isFuture);
    const total = pastDays.reduce((s, d) => s + d.count, 0);

    // Streaks
    let currentStreak = 0, longestStreak = 0, streak = 0;
    for (let i = pastDays.length - 1; i >= 0; i--) {
      if (pastDays[i].count > 0) currentStreak++;
      else break;
    }
    pastDays.forEach(d => {
      if (d.count > 0) { streak++; longestStreak = Math.max(longestStreak, streak); }
      else streak = 0;
    });

    // Best single day
    const bestDay = pastDays.reduce((b, d) => d.count > (b?.count || 0) ? d : b, null);

    // Peak day of week
    const dowTotals = [0,0,0,0,0,0,0];
    pastDays.forEach(d => { dowTotals[d.dow] += d.count; });
    const peakDow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dowTotals.indexOf(Math.max(...dowTotals))];

    return {
      weeks: ws, monthLabels: labels, total,
      stats: {
        activeDays: pastDays.filter(d => d.count > 0).length,
        currentStreak, longestStreak, bestDay, peakDow,
      },
    };
  }, [countMap, year, todayKey]);

  const topRepos = useMemo(() => {
    const rc = {};
    events.forEach(ev => {
      if (ev.type !== 'PushEvent') return;
      const short = (ev.repo?.name || '').split('/')[1] || ev.repo?.name || '';
      const n = ev.payload.size ?? ev.payload.distinct_size ?? ev.payload.commits?.length ?? 1;
      if (short) rc[short] = (rc[short] || 0) + n;
    });
    const sorted = Object.entries(rc).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const max = sorted[0]?.[1] || 1;
    return sorted.map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }));
  }, [events]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(countMap)), [countMap]);

  const cellBg = (day) => {
    if (day.isFuture) return 'var(--contrib-future)';
    if (!day.count)   return 'var(--contrib-0)';
    const pct = day.count / maxCount;
    if (pct <= 0.25) return 'var(--contrib-1)';
    if (pct <= 0.5)  return 'var(--contrib-2)';
    if (pct <= 0.75) return 'var(--contrib-3)';
    return 'var(--contrib-4)';
  };

  const graphW = weeks.length * WEEK - GAP;

  return (
    <div className="contrib-wrap">
      <div className="contrib-body">

        {/* ── Left: heatmap ── */}
        <div className="contrib-left">
          <div className="contrib-total"><strong>{total}</strong> commits in {year}</div>
          <div className="contrib-sub">Based on push events · private activity may be excluded</div>

          <div className="contrib-scroll">
            <div style={{ position: 'relative', height: 18, marginLeft: WD_W, width: graphW }}>
              {monthLabels.map(({ left, label }) => (
                <span key={left} style={{
                  position: 'absolute', left,
                  fontSize: 11, color: 'var(--text-3)',
                  fontFamily: 'var(--f-mono)', whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: GAP, marginTop: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: WD_W, flexShrink: 0 }}>
                {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                  <div key={i} style={{
                    height: CELL, lineHeight: `${CELL}px`,
                    fontSize: 9, color: 'var(--text-4)',
                    fontFamily: 'var(--f-mono)', textAlign: 'right', paddingRight: 6,
                  }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: GAP }}>
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                    {week.map((day, di) => (
                      <div
                        key={di}
                        className="contrib-cell"
                        style={{
                          width: CELL, height: CELL, borderRadius: 3,
                          background: day ? cellBg(day) : 'transparent',
                        }}
                        title={day ? (() => {
                          const [,, dd] = day.key.split('-').map(Number);
                          const ds = `${MO_SHORT[day.mo]} ${dd}`;
                          return day.isFuture ? ds
                            : `${day.count || 'No'} commit${day.count !== 1 ? 's' : ''} · ${ds}`;
                        })() : ''}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="contrib-legend">
            <span>Less</span>
            {[0,1,2,3,4].map(l => (
              <div key={l} className="contrib-cell-leg" style={{ background: `var(--contrib-${l})` }} />
            ))}
            <span>More</span>
          </div>

          {topRepos.length > 0 && (
            <div className="csp-repos">
              <div className="csp-repos-title">Top repositories</div>
              <div className="csp-repos-grid-horiz">
                {topRepos.map(r => (
                  <div key={r.name} className="csp-repo-row">
                    <div className="csp-repo-header">
                      <span className="csp-repo-name">{r.name}</span>
                      <span className="csp-repo-count">{r.count}</span>
                    </div>
                    <div className="csp-repo-track">
                      <div className="csp-repo-fill" style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: stats panel ── */}
        <div className="contrib-right">
          <div className="csp-grid">
            <div className="csp-stat">
              <div className="csp-stat-value">{stats.activeDays}</div>
              <div className="csp-stat-label">Active days</div>
            </div>
            <div className="csp-stat">
              <div className="csp-stat-value">{stats.currentStreak}</div>
              <div className="csp-stat-label">Current streak</div>
            </div>
            <div className="csp-stat">
              <div className="csp-stat-value">{stats.longestStreak}</div>
              <div className="csp-stat-label">Longest streak</div>
            </div>
            <div className="csp-stat">
              <div className="csp-stat-value">{stats.peakDow}</div>
              <div className="csp-stat-label">Peak day</div>
            </div>
          </div>

          {stats.bestDay && (
            <div className="csp-best-day">
              <span className="csp-bd-label">Best day</span>
              <span className="csp-bd-val">
                {stats.bestDay.count} commit{stats.bestDay.count !== 1 ? 's' : ''}
                {' · '}
                {MO_SHORT[stats.bestDay.mo]} {Number(stats.bestDay.key.split('-')[2])}
              </span>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

// Parse events into monthly activity groups
function buildMonths(events, repoLangMap) {
  const months = {};
  events.forEach(ev => {
    const d = new Date(ev.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!months[key]) months[key] = { label, pushes: {}, created: [], prs: {} };
    const m = months[key];
    if (ev.type === 'PushEvent') {
      const n = ev.payload.size ?? ev.payload.distinct_size ?? ev.payload.commits?.length ?? 1;
      m.pushes[ev.repo.name] = (m.pushes[ev.repo.name] || 0) + n;
    }
    if (ev.type === 'CreateEvent' && ev.payload.ref_type === 'repository') {
      m.created.push({ name: ev.repo.name, date: ev.created_at, lang: repoLangMap[ev.repo.name], isPrivate: false });
    }
    if (ev.type === 'PullRequestEvent' && ev.payload.action === 'opened') {
      if (!m.prs[ev.repo.name]) m.prs[ev.repo.name] = { opened: 0, merged: 0 };
      m.prs[ev.repo.name].opened++;
      if (ev.payload.pull_request?.merged_at) m.prs[ev.repo.name].merged++;
    }
  });

  return Object.entries(months)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, m]) => {
      const pushRepos = Object.entries(m.pushes).sort((a, b) => b[1] - a[1]);
      const maxCommits = pushRepos[0]?.[1] || 1;
      const totalCommits = pushRepos.reduce((s, [, n]) => s + n, 0);
      const prRepos = Object.entries(m.prs);
      const totalPRs = prRepos.reduce((s, [, v]) => s + v.opened, 0);
      return {
        label: m.label,
        commits: pushRepos.length ? { repos: pushRepos, total: totalCommits, max: maxCommits } : null,
        created: m.created,
        prs: prRepos.length ? { repos: prRepos, total: totalPRs } : null,
      };
    })
    .filter(m => m.commits || m.created.length || m.prs);
}

const MONTHS_PER_PAGE = 2;

function ActivityTab({ username }) {
  const [events,    setEvents]    = useState([]);
  const [repos,     setRepos]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [visible,   setVisible]   = useState(MONTHS_PER_PAGE);

  useEffect(() => {
    if (!username) return;
    Promise.all([
      ghGetActivityAll(username),
      ghGetRepos().catch(() => []),
    ])
      .then(([evs, rps]) => { setEvents(evs); setRepos(rps); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [username]);

  const repoLangMap = useMemo(() => {
    const m = {};
    repos.forEach(r => { m[r.full_name] = r.language; });
    return m;
  }, [repos]);

  const months = useMemo(() => buildMonths(events, repoLangMap), [events, repoLangMap]);
  const visibleMonths = months.slice(0, visible);
  const hasMore = visible < months.length;

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="act-page">
      {/* Contribution heatmap */}
      <ContribGraph events={events} />

      {/* Monthly timeline */}
      <div className="act-section-label">Contribution activity</div>
      {months.length === 0 && <div className="gh-empty-msg">No contribution activity found.</div>}
      <div className="act-timeline">
        {visibleMonths.map((m, mi) => (
          <div key={mi} className="act-month">
            <div className="act-month-label">{m.label}</div>

            {/* Commits */}
            {m.commits && (
              <div className="act-group">
                <div className="act-group-line" />
                <div className="act-group-icon act-ic-commit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>
                  </svg>
                </div>
                <div className="act-group-content">
                  <div className="act-group-title">
                    Created <strong>{m.commits.total}</strong> commit{m.commits.total !== 1 ? 's' : ''} in <strong>{m.commits.repos.length}</strong> repositor{m.commits.repos.length !== 1 ? 'ies' : 'y'}
                  </div>
                  <div className="act-card">
                    {m.commits.repos.map(([repo, count]) => (
                      <a key={repo} className="act-commit-row" href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">
                        <span className="act-commit-repo">{repo}</span>
                        <span className="act-commit-count">{count} commit{count !== 1 ? 's' : ''}</span>
                        <div className="act-bar-track">
                          <div className="act-bar-fill" style={{ width: `${Math.round((count / m.commits.max) * 100)}%` }} />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Created repos */}
            {m.created.length > 0 && (
              <div className="act-group">
                <div className="act-group-line" />
                <div className="act-group-icon act-ic-repo">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><circle cx="17.5" cy="17.5" r="3.5"/>
                  </svg>
                </div>
                <div className="act-group-content">
                  <div className="act-group-title">
                    Created <strong>{m.created.length}</strong> repositor{m.created.length !== 1 ? 'ies' : 'y'}
                  </div>
                  <div className="act-card">
                    {m.created.map((r, i) => (
                      <a key={i} className="act-repo-row" href={`https://github.com/${r.name}`} target="_blank" rel="noreferrer">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text-3)' }}>
                          <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><circle cx="17.5" cy="17.5" r="3.5"/>
                        </svg>
                        <span className="act-repo-name">{r.name}</span>
                        {r.lang && (
                          <span className="act-lang-row">
                            <span className="act-lang-dot" style={{ background: LANG_COLORS[r.lang] || '#888' }} />
                            <span className="act-lang-name">{r.lang}</span>
                          </span>
                        )}
                        <span className="act-repo-date">
                          {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PRs */}
            {m.prs && (
              <div className="act-group">
                <div className="act-group-line" />
                <div className="act-group-icon act-ic-pr">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
                  </svg>
                </div>
                <div className="act-group-content">
                  <div className="act-group-title">
                    Opened <strong>{m.prs.total}</strong> pull request{m.prs.total !== 1 ? 's' : ''} in <strong>{m.prs.repos.length}</strong> repositor{m.prs.repos.length !== 1 ? 'ies' : 'y'}
                  </div>
                  <div className="act-card">
                    {m.prs.repos.map(([repo, v]) => (
                      <a key={repo} className="act-pr-row" href={`https://github.com/${repo}/pulls`} target="_blank" rel="noreferrer">
                        <span className="act-pr-repo">{repo}</span>
                        {v.merged > 0 && (
                          <span className="act-merged-badge">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            {v.merged} merged
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer: show more + API note */}
      <div className="act-load-more-wrap">
        {months.length > MONTHS_PER_PAGE && (
          hasMore ? (
            <>
              <button className="btn ghost sm act-load-btn" onClick={() => setVisible(v => v + MONTHS_PER_PAGE)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                Show more
              </button>
              <button className="btn ghost sm act-load-btn" onClick={() => setVisible(months.length)}>
                Show all {months.length} months
              </button>
            </>
          ) : (
            <button className="btn ghost sm act-load-btn" onClick={() => setVisible(MONTHS_PER_PAGE)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              Collapse
            </button>
          )
        )}
        <span className="act-load-count">
          {months.length > 0
            ? `Showing ${visibleMonths.length} of ${months.length} month${months.length !== 1 ? 's' : ''}`
            : ''}
        </span>
        <span className="act-api-note">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          GitHub API limited to ~300 recent events
        </span>
      </div>
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

export function GitHubPage({ onNav, activeWorkstation }) {
  const [integ,   setInteg]   = useState(null);
  const [ghUser,  setGhUser]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('repos');

  useEffect(() => {
    if (!activeWorkstation?.id) { setLoading(false); return; }
    supabase
      .from('workspace_integrations')
      .select('username, display_name, avatar_url, email, metadata, connected_at')
      .eq('workstation_id', activeWorkstation.id)
      .eq('provider', 'github')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInteg(data);
          ghGetUser().then(setGhUser).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [activeWorkstation?.id]);

  if (loading) return <div className="gh-page"><div className="gh-spin-wrap full"><div className="gh-spin" /></div></div>;
  if (!integ)  return <div className="gh-page"><NotConnected onGoSettings={onNav} /></div>;

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
          {tab === 'repos'    && <ReposTab    />}
          {tab === 'prs'      && <PRsTab      />}
          {tab === 'issues'   && <IssuesTab   />}
          {tab === 'activity' && <ActivityTab username={username} />}
        </div>
      </div>
    </div>
  );
}

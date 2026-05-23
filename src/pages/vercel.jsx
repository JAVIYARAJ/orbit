// vercel.jsx — Vercel integration page

import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';
import { vcGetUser, vcGetProjects, vcGetDeployments, vcGetDomains, vcPromoteDeployment, vcClearCache } from '../lib/vercel.js';

const FRAMEWORK_LABELS = {
  nextjs: 'Next.js', nuxtjs: 'Nuxt.js', gatsby: 'Gatsby', remix: 'Remix',
  sveltekit: 'SvelteKit', vite: 'Vite', 'create-react-app': 'CRA',
  angular: 'Angular', vue: 'Vue', astro: 'Astro', hugo: 'Hugo',
  jekyll: 'Jekyll', blitzjs: 'Blitz.js', nestjs: 'NestJS', hydrogen: 'Hydrogen',
};

const STATE_META = {
  READY:    { label: 'Ready',    color: '#22c55e' },
  BUILDING: { label: 'Building', color: '#f97316' },
  ERROR:    { label: 'Error',    color: '#ef4444' },
  CANCELED: { label: 'Canceled', color: '#6b7280' },
  QUEUED:   { label: 'Queued',   color: '#a855f7' },
};

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)     return 'just now';
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Not connected ──────────────────────────────────────────────────
function NotConnected({ onGoSettings }) {
  return (
    <div className="gh-empty-full">
      <div className="gh-empty-ic">
        <Icon name="triangle" size={44} />
      </div>
      <div className="gh-empty-title">Vercel not connected</div>
      <div className="gh-empty-body">
        Connect your Vercel account to view projects, deployments, and domains.
      </div>
      <button className="btn primary" onClick={() => onGoSettings?.('settings')}>
        Go to Integrations
      </button>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────
function StateBadge({ state }) {
  const meta = STATE_META[state] || { label: state, color: '#888' };
  return (
    <span className="vc-state-badge" style={{ color: meta.color, borderColor: `${meta.color}44`, background: `${meta.color}18` }}>
      <span className="vc-state-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

// ── Projects tab ───────────────────────────────────────────────────
function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    vcGetProjects()
      .then(setProjects)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    projects.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    ), [projects, search]);

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="vc-projects-wrap">
      <div className="gh-toolbar">
        <div className="gh-search-row">
          <Icon name="search" size={13} />
          <input
            className="gh-search"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="gh-count-badge">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="vc-project-grid">
        {filtered.map(proj => {
          const latest = proj.latestDeployments?.[0];
          const prodTarget = proj.targets?.production;
          const url = prodTarget?.alias?.[0] || latest?.url;
          const framework = FRAMEWORK_LABELS[proj.framework] || proj.framework || '—';

          return (
            <div key={proj.id} className="vc-project-card">
              <div className="vc-project-hd">
                <div className="vc-project-name">
                  <Icon name="triangle" size={13} />
                  <span>{proj.name}</span>
                </div>
                {latest && <StateBadge state={latest.readyState || latest.state} />}
              </div>

              <div className="vc-project-meta">
                <span className="vc-fw-tag">{framework}</span>
                {proj.link?.repoId && (
                  <span className="vc-meta-item">
                    <Icon name="github" size={11} />
                    {proj.link.org || proj.link.repo}
                  </span>
                )}
              </div>

              {url && (
                <div className="vc-project-url">
                  <Icon name="external-link" size={11} />
                  <a href={`https://${url}`} target="_blank" rel="noreferrer">{url}</a>
                </div>
              )}

              <div className="vc-project-ft">
                {latest && (
                  <span className="vc-project-time">
                    {timeAgo(latest.createdAt)}
                  </span>
                )}
                <a
                  href={`https://vercel.com/${proj.name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn ghost xs"
                >
                  <Icon name="external-link" size={11} /> Open
                </a>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="gh-empty-msg">No projects match your search.</div>
        )}
      </div>
    </div>
  );
}

// ── Deployments tab ────────────────────────────────────────────────
function DeploymentsTab() {
  const [deployments,  setDeployments]  = useState([]);
  const [prodUids,     setProdUids]     = useState(new Set());
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [nextCursor,   setNextCursor]   = useState(null);
  const [error,        setError]        = useState(null);
  const [envFilter,    setEnvFilter]    = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [promoting,    setPromoting]    = useState(new Set());
  const [promoteErr,   setPromoteErr]   = useState('');

  useEffect(() => {
    Promise.all([vcGetDeployments(), vcGetProjects()])
      .then(([{ deployments, next }, projects]) => {
        setDeployments(deployments);
        setNextCursor(next);
        // targets.production.id is the authoritative current-production UID per project
        const uids = new Set(
          projects.map(p => p.targets?.production?.id).filter(Boolean)
        );
        console.log('[Vercel] prodUids built from targets.production.id:', [...uids]);
        console.log('[Vercel] deployment uids in list:', deployments.slice(0, 5).map(d => d.uid));
        setProdUids(uids);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const { deployments: more, next } = await vcGetDeployments(nextCursor);
      setDeployments(prev => [...prev, ...more]);
      setNextCursor(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const branches = useMemo(() => {
    const set = new Set();
    deployments.forEach(d => {
      const b = d.meta?.githubCommitRef || d.meta?.gitlabCommitRef || d.meta?.branch;
      if (b) set.add(b);
    });
    return [...set].sort();
  }, [deployments]);

  const filtered = useMemo(() =>
    deployments.filter(d => {
      const state = d.readyState || d.state;
      const branch = d.meta?.githubCommitRef || d.meta?.gitlabCommitRef || d.meta?.branch || '';
      const isProd = d.target === 'production' || prodUids.has(d.uid);
      if (envFilter === 'production' && !isProd) return false;
      if (envFilter === 'preview'    &&  isProd) return false;
      if (statusFilter !== 'all'     && state !== statusFilter) return false;
      if (branchFilter !== 'all'     && branch !== branchFilter) return false;
      return true;
    }), [deployments, prodUids, envFilter, statusFilter, branchFilter]);

  const handlePromote = async (e, dep) => {
    e.preventDefault();
    e.stopPropagation();
    setPromoteErr('');
    setPromoting(prev => new Set([...prev, dep.uid]));
    try {
      const projects = await vcGetProjects();
      const proj = projects.find(p => p.name === dep.name);
      const alias =
        proj?.alias?.find(a => a.target === 'PRODUCTION')?.domain ||
        proj?.targets?.production?.alias?.[0] ||
        `${dep.name}.vercel.app`;
      try {
        await vcPromoteDeployment(dep.uid, alias);
      } catch (err) {
        // 409 not_modified = alias already points here, deployment is already production
        if (!err.message.includes('not_modified')) throw err;
      }
      vcClearCache();
      setProdUids(prev => new Set([...prev, dep.uid]));
    } catch (err) {
      setPromoteErr(err.message);
    } finally {
      setPromoting(prev => { const s = new Set(prev); s.delete(dep.uid); return s; });
    }
  };

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="vc-deployments-wrap">

      {/* Filter bar */}
      <div className="vc-filter-bar">
        <select className="period-select" value={envFilter} onChange={e => setEnvFilter(e.target.value)}>
          <option value="all">All Environments</option>
          <option value="production">Production</option>
          <option value="preview">Preview</option>
        </select>

        <select className="period-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="READY">Ready</option>
          <option value="ERROR">Error</option>
          <option value="BUILDING">Building</option>
          <option value="CANCELED">Canceled</option>
        </select>

        <select className="period-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="all">All Branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <span className="gh-count-badge" style={{ marginLeft: 'auto' }}>{filtered.length}</span>
      </div>

      {promoteErr && (
        <div className="gh-error" style={{ margin: '4px 0 8px' }}>
          <Icon name="alert-circle" size={12} /> {promoteErr}
        </div>
      )}

      <div className="gh-list">
        {filtered.length === 0 && (
          <div className="gh-empty-msg">No deployments match your filters.</div>
        )}
        {filtered.map(dep => {
          const state      = dep.readyState || dep.state;
          const commitMsg  = dep.meta?.githubCommitMessage || dep.meta?.gitlabCommitMessage || '';
          const branch     = dep.meta?.githubCommitRef    || dep.meta?.gitlabCommitRef    || dep.meta?.branch || '';
          const sha        = (dep.meta?.githubCommitSha   || dep.meta?.gitlabCommitSha    || '').slice(0, 7);
          const buildTime  = dep.ready && dep.buildingAt
            ? `${Math.round((dep.ready - dep.buildingAt) / 1000)}s`
            : null;
          const isCurrent  = dep.target === 'production' || prodUids.has(dep.uid);
          const canPromote = !isCurrent && state === 'READY';

          return (
            <div key={dep.uid} className="gh-list-row" style={{ cursor: 'default' }}>
              <div className="gh-list-ic" style={{ color: STATE_META[state]?.color || '#888' }}>
                <Icon name="triangle" size={13} />
              </div>
              <div className="gh-list-body">
                <div className="gh-list-title">
                  <span className="vc-dep-name">{dep.uid.slice(0, 9)}</span>
                  {isCurrent
                    ? <span className="vc-prod-badge">Production</span>
                    : <span className="vc-preview-badge">Preview</span>}
                  {isCurrent && prodUids.has(dep.uid) && <span className="vc-current-badge">Current</span>}
                  {buildTime && <span className="vc-build-time"><Icon name="clock" size={10} />{buildTime}</span>}
                </div>
                <div className="gh-list-meta">
                  <StateBadge state={state} />
                  {branch && <span className="vc-branch"><Icon name="git-branch" size={10} />{branch}</span>}
                  {sha    && <span className="rd-sha">{sha}</span>}
                  {commitMsg && (
                    <span className="vc-commit-msg">{commitMsg.split('\n')[0].slice(0, 72)}</span>
                  )}
                  <span style={{ marginLeft: 'auto' }}>{timeAgo(dep.createdAt)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {canPromote && (
                  <button
                    className="btn primary xs"
                    onClick={e => handlePromote(e, dep)}
                    disabled={promoting.has(dep.uid)}
                    title="Promote to production"
                  >
                    {promoting.has(dep.uid) ? '…' : '→ Prod'}
                  </button>
                )}
                <a
                  href={`https://${dep.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn ghost xs"
                  onClick={e => e.stopPropagation()}
                  title="Open deployment"
                >
                  <Icon name="external-link" size={11} />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
        {nextCursor ? (
          <button className="btn ghost sm" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore
              ? <><div className="gh-spin" style={{ width: 12, height: 12, marginRight: 6 }} />Loading…</>
              : `Load more · ${deployments.length} loaded`}
          </button>
        ) : (
          deployments.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--f-mono)' }}>
              All {deployments.length} deployment{deployments.length !== 1 ? 's' : ''} loaded
            </span>
          )
        )}
      </div>
    </div>
  );
}

// ── Domains tab ────────────────────────────────────────────────────
function DomainsTab() {
  const [domains,  setDomains]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    vcGetDomains()
      .then(setDomains)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="gh-spin-wrap"><div className="gh-spin" /></div>;
  if (error)   return <div className="gh-error">{error}</div>;

  return (
    <div className="gh-list">
      {domains.length === 0 && (
        <div className="gh-empty-msg">No custom domains configured.</div>
      )}
      {domains.map(domain => (
        <div key={domain.name} className="gh-list-row" style={{ cursor: 'default' }}>
          <div className="gh-list-ic gh-ic-pr">
            <Icon name="link" size={13} />
          </div>
          <div className="gh-list-body">
            <div className="gh-list-title">{domain.name}</div>
            <div className="gh-list-meta">
              {domain.verified ? (
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="check-circle" size={11} /> Verified
                </span>
              ) : (
                <span style={{ color: '#f97316' }}>
                  <Icon name="alert-circle" size={11} /> Pending verification
                </span>
              )}
              {domain.projectId && (
                <span className="gh-list-repo">{domain.projectId}</span>
              )}
              {domain.createdAt && (
                <span>{timeAgo(domain.createdAt)}</span>
              )}
            </div>
          </div>
          <a
            href={`https://${domain.name}`}
            target="_blank"
            rel="noreferrer"
            className="btn ghost xs"
          >
            <Icon name="external-link" size={11} />
          </a>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
const TABS = [
  { id: 'projects',    label: 'Projects',    icon: 'folder'   },
  { id: 'deployments', label: 'Deployments', icon: 'triangle' },
  { id: 'domains',     label: 'Domains',     icon: 'link'     },
];

export function VercelPage({ onNav }) {
  const [integ,   setInteg]   = useState(null);
  const [vcUser,  setVcUser]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('projects');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_integrations')
        .select('username, display_name, email, metadata, connected_at')
        .eq('user_id', user.id)
        .eq('provider', 'vercel')
        .maybeSingle();
      if (data) {
        setInteg(data);
        vcGetUser().then(setVcUser).catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="gh-page"><div className="gh-spin-wrap full"><div className="gh-spin" /></div></div>;
  if (!integ)  return <div className="gh-page"><NotConnected onGoSettings={onNav} /></div>;

  const username = vcUser?.username || integ.username || '—';

  return (
    <div className="gh-page">
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{ margin: 0, lineHeight: 1 }}>Vercel</h1>
          {username && (
            <div className="gh-user-pill">
              <Icon name="triangle" size={12} />
              <span>{username}</span>
            </div>
          )}
        </div>
        {vcUser && (
          <div className="gh-hd-stats">
            {vcUser.name && (
              <div className="gh-hd-stat">
                <span className="gh-hd-stat-n">{vcUser.name}</span>
                <span className="gh-hd-stat-l">Name</span>
              </div>
            )}
            {vcUser.email && (
              <div className="gh-hd-stat">
                <span className="gh-hd-stat-n" style={{ fontSize: 11 }}>{vcUser.email}</span>
                <span className="gh-hd-stat-l">Email</span>
              </div>
            )}
            <a
              className="gh-profile-link btn ghost sm"
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="triangle" size={13} /> Dashboard
            </a>
          </div>
        )}
      </div>

      <div className="gh-body">
        <div className="gh-tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`gh-tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={13} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="gh-tab-content">
          {tab === 'projects'    && <ProjectsTab    />}
          {tab === 'deployments' && <DeploymentsTab />}
          {tab === 'domains'     && <DomainsTab     />}
        </div>
      </div>
    </div>
  );
}

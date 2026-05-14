// workspace.jsx — Home, Projects, Tasks, Learning, Vault

import { useState as useStateA } from 'react';
import { Icon, SlidePanel } from '../components/shell.jsx';

// ─── Helpers ──────────────────────────────────────────────────────
export const StatusPill = ({ status }) => {
  const map = { planning: 'Planning', progress: 'In Progress', review: 'Review', done: 'Done', hold: 'On Hold' };
  return <span className={'pill ' + status}><span className="d"></span>{map[status]}</span>;
};

const genId = (name) => {
  const base = name.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'PROJ';
  return base + Math.floor(Math.random() * 90 + 10);
};

// ═══════════════════════════════════════════════════════════════════
//  1. HOME — Command Center
// ═══════════════════════════════════════════════════════════════════
export const HomePage = ({ timer, onNav, projects, tasks, notes, onToggle }) => {
  const today = new Date(2026, 4, 12);
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isoStr = '2026-05-12';

  const todayTasks = tasks.filter(t => ['progress', 'todo', 'review'].includes(t.col)).slice(0, 6);
  const activeProjects = projects.filter(p => p.status === 'progress' || p.status === 'review');
  const openTasksCount = tasks.filter(t => t.col !== 'done').length;
  const activeProjectsCount = projects.filter(p => p.status === 'progress').length;

  const week = [
    { d: 'M', h: 6.4 }, { d: 'T', h: 7.8 }, { d: 'W', h: 5.2 },
    { d: 'T', h: 8.1 }, { d: 'F', h: 6.9 }, { d: 'S', h: 2.1 }, { d: 'S', h: 0 },
  ];
  const todayIdx = 1;
  const maxH = 9;
  const weekTotal = week.reduce((a, b) => a + b.h, 0).toFixed(1);

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">2026.W19 · {isoStr}</div>
          <h1>Good morning, Raunak.</h1>
          <div className="sub">{dateStr} — 3 tasks due today, 1 timer paused.</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => onNav('tasks')}><Icon name="plus" size={12} /> Task</button>
          <button className="btn" onClick={() => onNav('notes')}><Icon name="plus" size={12} /> Note</button>
          <button className="btn primary" onClick={() => onNav('timer')}><Icon name="play" size={12} /> Start timer</button>
        </div>
      </div>

      <div className="qbar" style={{ marginBottom: 16 }}>
        <button className="qbtn" onClick={() => { onNav('timer'); }}>
          <Icon name="play" size={12} /> Resume Kombi punch-card timer <span className="k">G I</span>
        </button>
        <button className="qbtn" onClick={() => onNav('tasks')}>
          <Icon name="plus" size={12} /> Quick task <span className="k">G T</span>
        </button>
        <button className="qbtn" onClick={() => onNav('notes')}>
          <Icon name="plus" size={12} /> Capture thought <span className="k">G N</span>
        </button>
      </div>

      <div className="home-hero" style={{ marginBottom: 16 }}>
        <div className="card timer-hero">
          <div className="top">
            <div>
              <div className="label-mono" style={{ marginBottom: 4 }}>ACTIVE TIMER · KMBL-17</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>Punch-card animation — confetti on completion</div>
              <div className="meta" style={{ marginTop: 6 }}>
                <span><b>Kombi</b> — Loyalty App</span>
                <span style={{ color: 'var(--text-3)' }}>·</span>
                <span>Started <b>14:20</b></span>
              </div>
            </div>
            <span className={'pill ' + (timer.running ? 'progress' : 'hold')}>
              <span className="d"></span>{timer.running ? 'Running' : 'Paused'}
            </span>
          </div>
          <div className="timer-num">{timer.display}</div>
          <div className="timer-actions">
            <button className="btn" onClick={onToggle}>
              <Icon name={timer.running ? 'pause' : 'play'} size={10}/>
              {timer.running ? 'Pause' : 'Resume'}
            </button>
            <button className="btn" onClick={() => { onNav('timer'); }}>
              <Icon name="stop" size={10}/> Stop
            </button>
            <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => onNav('timer')}>
              Open tracker <Icon name="chev" size={10}/>
            </button>
          </div>
        </div>

        <div className="stat-grid">
          <div className="cell">
            <div className="l">Hours this week</div>
            <div className="v">36.5</div>
            <div className="d up">↑ 4.2 vs last week</div>
          </div>
          <div className="cell">
            <div className="l">Day streak</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="flame" size={20} /> 47
            </div>
            <div className="d">Personal best: 64</div>
          </div>
          <div className="cell">
            <div className="l">Active projects</div>
            <div className="v">{activeProjectsCount}</div>
            <div className="d">+1 in planning</div>
          </div>
          <div className="cell">
            <div className="l">Open tasks</div>
            <div className="v">{openTasksCount}</div>
            <div className="d dn">3 overdue</div>
          </div>
        </div>
      </div>

      <div className="home-grid">
        <div className="home-side">
          <div className="card">
            <div className="card-h">
              <div className="t">Today · {todayTasks.length} tasks</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="lbl">P1 · 2</span>
                <span className="lbl">P2 · 3</span>
                <span className="lbl">P3 · 1</span>
                <button className="btn sm" onClick={() => onNav('tasks')}>All <Icon name="chev" size={10}/></button>
              </div>
            </div>
            <div className="card-body-scroll task-list">
              {todayTasks.map(t => (
                <div key={t.id} className="task-row">
                  <div className="check"></div>
                  <span className={'dot-p p' + t.p}></span>
                  <div className="title">{t.title}</div>
                  <div className="meta">
                    <span className="tag accent">{t.proj}</span>
                    <span>{t.est}h est</span>
                    <span>{t.due}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">This week</div>
              <div className="lbl">{weekTotal}h LOGGED · TARGET 40h</div>
            </div>
            <div className="week-chart">
              {week.map((d, i) => (
                <div key={i} className="day">
                  <div className="v">{d.h ? d.h.toFixed(1) : '·'}</div>
                  <div className={'bar ' + (i === todayIdx ? 'today' : (d.h === 0 ? 'dim' : ''))}
                       style={{ height: `${(d.h / maxH) * 100}%` }}></div>
                  <div className="lbl">{d.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="home-side">
          <div className="card">
            <div className="card-h">
              <div className="t">Active projects</div>
              <div className="lbl">{activeProjects.length}</div>
            </div>
            <div className="card-body-scroll">
              {activeProjects.map(p => (
                <div key={p.id} className="home-proj-row" onClick={() => onNav('projects')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="home-proj-name">{p.name}</div>
                      <div className="home-proj-client">{p.client}</div>
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                  <div className="prog" style={{ marginTop: 12 }}><div className="fill" style={{ width: p.progress + '%' }}></div></div>
                  <div className="home-proj-meta">
                    <span>{p.progress}% · {p.openTasks} open</span>
                    <span>{p.hoursLogged}/{p.hoursEst}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Pinned notes</div>
              <button className="btn sm" onClick={() => onNav('notes')}>All <Icon name="chev" size={10}/></button>
            </div>
            <div className="card-body-scroll">
              {notes.filter(n => n.pinned).map(n => (
                <div key={n.id} className="home-note-row" onClick={() => onNav('notes')}>
                  <div className="home-note-title">
                    <Icon name="pin" size={11} /> {n.title}
                  </div>
                  <div className="stack" style={{ marginTop: 2 }}>
                    {n.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Templates · drafts ready</div>
              <button className="btn sm" onClick={() => onNav('email')}>All <Icon name="chev" size={10}/></button>
            </div>
            <div className="card-body-scroll" style={{ padding: '4px 0' }}>
              {[
                { name: 'Northwind — Q3 contract follow-up', tag: 'Client Updates' },
                { name: 'Discovery sprint — Acme Robotics', tag: 'Proposals' },
                { name: 'Senior Flutter — Linear application', tag: 'Job Apps' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderBottom: i === 2 ? 0 : '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{item.name}</span>
                  <span className="tag" style={{ flex: 'none' }}>{item.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  2. PROJECTS
// ═══════════════════════════════════════════════════════════════════
const PROJ_TYPES = ['Client / Freelance', 'Indie Product', 'Client / Retainer', 'Tool / Internal'];

const AddProjectPanel = ({ open, onClose, onAdd }) => {
  const empty = { name: '', client: '', type: 'Client / Freelance', status: 'planning', stack: '', start: '', end: '', budget: '', repo: '', hoursEst: '80' };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) { setErr('Project name is required.'); return; }
    const newProject = {
      id: genId(form.name),
      name: form.name.trim(),
      client: form.client.trim() || 'Self',
      type: form.type,
      start: form.start || new Date().toISOString().slice(0, 10),
      end: form.end || '—',
      status: form.status,
      stack: form.stack.split(',').map(s => s.trim()).filter(Boolean),
      progress: 0,
      tasks: 0,
      openTasks: 0,
      hoursLogged: 0,
      hoursEst: parseInt(form.hoursEst) || 80,
      repo: form.repo.trim() || '—',
      budget: form.budget.trim() || '—',
    };
    onAdd(newProject);
    setForm(empty);
    setErr('');
    onClose();
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Project" subtitle="WORKSPACE / PROJECTS / ADD">
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="fld">
          <label>Project name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Kombi — Loyalty App" />
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Client / Owner</label>
            <input value={form.client} onChange={e => set('client', e.target.value)} placeholder="e.g. Roastery Co." />
          </div>
          <div className="fld">
            <label>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {PROJ_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              {['planning','progress','review','done','hold'].map(s => (
                <option key={s} value={s}>{({planning:'Planning',progress:'In Progress',review:'Review',done:'Done',hold:'On Hold'})[s]}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Est. hours</label>
            <input type="number" value={form.hoursEst} onChange={e => set('hoursEst', e.target.value)} placeholder="80" min="1" />
          </div>
        </div>
        <div className="fld">
          <label>Tech stack</label>
          <input value={form.stack} onChange={e => set('stack', e.target.value)} placeholder="Flutter, Supabase, Stripe (comma-separated)" />
          <span className="fld-hint">Separate technologies with commas</span>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Start date</label>
            <input type="date" value={form.start} onChange={e => set('start', e.target.value)} />
          </div>
          <div className="fld">
            <label>End date</label>
            <input type="date" value={form.end} onChange={e => set('end', e.target.value)} />
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Budget</label>
            <input value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="e.g. €12,400" />
          </div>
          <div className="fld">
            <label>Repository</label>
            <input value={form.repo} onChange={e => set('repo', e.target.value)} placeholder="github.com/user/repo" />
          </div>
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit}>
          <Icon name="plus" size={12} /> Create project
        </button>
      </div>
    </SlidePanel>
  );
};

export const ProjectsPage = ({ projects, setProjects }) => {
  const [view, setView] = useStateA('card');
  const [filter, setFilter] = useStateA('all');
  const [showAdd, setShowAdd] = useStateA(false);

  const filtered = projects.filter(p => filter === 'all' || p.status === filter);

  const handleAdd = (project) => setProjects(prev => [project, ...prev]);

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE / PROJECTS</div>
          <h1>Projects</h1>
          <div className="sub">{projects.length} total · {projects.filter(p=>p.status==='progress').length} active · {projects.filter(p=>p.status==='planning').length} in planning</div>
        </div>
        <div className="actions">
          <div className="view-toggle">
            <button className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}>CARDS</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>LIST</button>
          </div>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12} /> New project
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <span className="label-mono">FILTER</span>
        {['all','planning','progress','review','done','hold'].map(f => (
          <span key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'ALL' : ({planning:'PLANNING',progress:'IN PROGRESS',review:'REVIEW',done:'DONE',hold:'ON HOLD'})[f]}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)' }}>SORT BY: UPDATED ↓</span>
      </div>

      {view === 'card' ? (
        <div className="proj-grid">
          {filtered.map(p => (
            <div key={p.id} className="proj-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div className="client">{p.id} · {p.type}</div>
                  <div className="name" style={{ marginTop: 4 }}>{p.name}</div>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: 12 }}>{p.client}</div>
              <div className="stack">{p.stack.map(s => <span key={s} className="tag">{s}</span>)}</div>
              <div className="dates">
                <span>START {p.start}</span>
                <span>END {p.end}</span>
              </div>
              <div className="prog"><div className="fill" style={{ width: p.progress + '%' }}></div></div>
              <div className="row-end">
                <span className="pct">{p.progress}% · {p.tasks} tasks ({p.openTasks} open)</span>
                <span className="pct">{p.hoursLogged}/{p.hoursEst}h</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <table className="tbl">
            <thead><tr>
              <th>Project</th><th>Client</th><th>Status</th><th>Stack</th>
              <th>Progress</th><th>Tasks</th><th>Hours</th><th>End</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><span className="num" style={{color:'var(--text-3)'}}>{p.id}</span> <b style={{marginLeft:6}}>{p.name}</b></td>
                  <td>{p.client}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {p.stack.slice(0,2).map(s=><span key={s} className="tag">{s}</span>)}
                      {p.stack.length>2 && <span className="tag">+{p.stack.length-2}</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div className="prog" style={{width:80}}><div className="fill" style={{width:p.progress+'%'}}></div></div>
                      <span className="num" style={{fontSize:11,color:'var(--text-2)'}}>{p.progress}%</span>
                    </div>
                  </td>
                  <td className="mono">{p.openTasks}/{p.tasks}</td>
                  <td className="mono">{p.hoursLogged}/{p.hoursEst}h</td>
                  <td className="mono">{p.end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddProjectPanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  3. TASKS — Kanban
// ═══════════════════════════════════════════════════════════════════
const COL_DEFS = [
  { id: 'backlog',  label: 'BACKLOG' },
  { id: 'todo',     label: 'TO DO' },
  { id: 'progress', label: 'IN PROGRESS' },
  { id: 'review',   label: 'REVIEW' },
  { id: 'done',     label: 'DONE' },
];

const TaskCard = ({ t, projects }) => {
  const proj = projects.find(p => p.id === t.proj);
  return (
    <div className="tcard">
      <div className="top">
        <span className={'dot-p p' + t.p}></span>
        <span className="id">{t.id}</span>
        {t.tags && t.tags.slice(0, 2).map(tg => <span key={tg} className="tag" style={{ fontSize: 9 }}>{tg}</span>)}
      </div>
      <div className="title">{t.title}</div>
      <div className="proj">→ {proj?.name || t.proj}</div>
      <div className="foot">
        <div className="hrs">
          {t.actual > 0 && <span style={{ color: 'var(--accent-hi)' }}>{t.actual}h</span>}
          {t.actual > 0 && <span>/</span>}
          <span>{t.est}h</span>
        </div>
        {t.subs && <div className="subs"><Icon name="list" size={10}/> {t.subs[1]}/{t.subs[0]}</div>}
        <span>{t.due === '—' ? '—' : t.due.slice(5)}</span>
      </div>
    </div>
  );
};

const AddTaskPanel = ({ open, onClose, onAdd, projects, defaultCol = 'backlog' }) => {
  const empty = { title: '', proj: projects[0]?.id || '', p: '2', col: defaultCol, tags: '', est: '2', due: '' };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.title.trim()) { setErr('Task title is required.'); return; }
    const newTask = {
      id: `${form.proj}-${Date.now().toString().slice(-4)}`,
      proj: form.proj,
      col: form.col,
      p: parseInt(form.p),
      title: form.title.trim(),
      due: form.due || '—',
      est: parseFloat(form.est) || 2,
      actual: 0,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
    };
    onAdd(newTask);
    setForm(empty);
    setErr('');
    onClose();
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Task" subtitle="WORKSPACE / TASKS / ADD">
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="fld">
          <label>Task title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" />
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Project</label>
            <select value={form.proj} onChange={e => set('proj', e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Priority</label>
            <select value={form.p} onChange={e => set('p', e.target.value)}>
              <option value="1">P1 — Critical</option>
              <option value="2">P2 — Normal</option>
              <option value="3">P3 — Low</option>
            </select>
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Column</label>
            <select value={form.col} onChange={e => set('col', e.target.value)}>
              {COL_DEFS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Est. hours</label>
            <input type="number" value={form.est} onChange={e => set('est', e.target.value)} placeholder="2" min="0.5" step="0.5" />
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Due date</label>
            <input type="date" value={form.due} onChange={e => set('due', e.target.value)} />
          </div>
          <div className="fld">
            <label>Tags</label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="ui, bug, feature" />
          </div>
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit}>
          <Icon name="plus" size={12} /> Create task
        </button>
      </div>
    </SlidePanel>
  );
};

export const TasksPage = ({ tasks, setTasks, projects }) => {
  const [view, setView] = useStateA('board');
  const [projFilter, setProjFilter] = useStateA('all');
  const [prioFilter, setPrioFilter] = useStateA('all');
  const [showAdd, setShowAdd] = useStateA(false);
  const [addCol, setAddCol] = useStateA('backlog');

  const filtered = tasks.filter(t =>
    (projFilter === 'all' || t.proj === projFilter) &&
    (prioFilter === 'all' || t.p === parseInt(prioFilter))
  );
  const byCol = (col) => filtered.filter(t => t.col === col);

  const handleAdd = (task) => setTasks(prev => [...prev, task]);

  const openAdd = (col = 'backlog') => { setAddCol(col); setShowAdd(true); };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE / TASKS</div>
          <h1>Tasks</h1>
          <div className="sub">{filtered.length} of {tasks.length} · sorted by priority</div>
        </div>
        <div className="actions">
          <div className="view-toggle">
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>BOARD</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>LIST</button>
          </div>
          <button className="btn primary" onClick={() => openAdd()}>
            <Icon name="plus" size={12} /> New task
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <span className="label-mono">PROJECT</span>
        <span className={'chip' + (projFilter==='all' ? ' active' : '')} onClick={() => setProjFilter('all')}>ALL</span>
        {projects.filter(p => tasks.some(t => t.proj === p.id)).map(p => (
          <span key={p.id} className={'chip' + (projFilter===p.id ? ' active' : '')} onClick={() => setProjFilter(p.id)}>{p.id}</span>
        ))}
        <span className="label-mono" style={{ marginLeft: 16 }}>PRIORITY</span>
        {['all','1','2','3'].map(v => (
          <span key={v} className={'chip' + (prioFilter===v ? ' active' : '')} onClick={() => setPrioFilter(v)}>
            {v === 'all' ? 'ALL' : 'P' + v}
          </span>
        ))}
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {COL_DEFS.map(col => {
            const items = byCol(col.id);
            return (
              <div key={col.id} className="kcol">
                <div className={'kcol-h t-' + col.id}>
                  <span className="t">{col.label}</span>
                  <span className="c">{items.length}</span>
                </div>
                <div className="kcol-body">
                  {items.map(t => <TaskCard key={t.id} t={t} projects={projects} />)}
                  <button
                    className="btn ghost"
                    style={{ justifyContent: 'center', color: 'var(--text-3)', fontSize: 11, padding: '6px', borderStyle: 'dashed' }}
                    onClick={() => openAdd(col.id)}>
                    <Icon name="plus" size={10}/> Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <table className="tbl">
            <thead><tr>
              <th>ID</th><th>P</th><th>Title</th><th>Project</th><th>Status</th>
              <th>Tags</th><th>Est</th><th>Actual</th><th>Due</th>
            </tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td className="mono">{t.id}</td>
                  <td><span className={'dot-p p'+t.p}></span></td>
                  <td>{t.title}</td>
                  <td className="mono" style={{ color: 'var(--accent-hi)' }}>{t.proj}</td>
                  <td><span className="pill muted" style={{textTransform:'uppercase'}}>{t.col}</span></td>
                  <td>{t.tags && t.tags.map(tg=><span key={tg} className="tag" style={{marginRight:4}}>{tg}</span>)}</td>
                  <td className="mono">{t.est}h</td>
                  <td className="mono" style={{ color: t.actual ? 'var(--accent-hi)' : 'var(--text-3)' }}>{t.actual || '—'}{t.actual ? 'h' : ''}</td>
                  <td className="mono">{t.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddTaskPanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} projects={projects} defaultCol={addCol} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  4. LEARNING PATH
// ═══════════════════════════════════════════════════════════════════
const LEARN_CATS = ['Flutter', 'Backend', 'AI', 'Web', 'Soft Skills', 'DevOps', 'Other'];

const LearnCard = ({ item, stage }) => (
  <div className="lcard">
    <div className="topic">
      <span>{item.topic}</span>
      {item.rev && <span className="rev" title="Marked for revision"><Icon name="rev" size={12}/></span>}
    </div>
    <div className="meta">
      <span className="tag accent">{item.cat}</span>
      {item.est && <span>{item.est}h est</span>}
      {item.actual !== undefined && <span style={{ color: 'var(--accent-hi)' }}>{item.actual}h logged</span>}
      {stage === 'completed' && <span>last reviewed {item.lastReviewed}</span>}
    </div>
    {stage === 'inProgress' && (
      <div className="prog thin"><div className="fill" style={{ width: item.prog + '%' }}></div></div>
    )}
    {item.note && <div style={{ fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic' }}>"{item.note}"</div>}
    {item.link && item.link !== '—' && <div className="res">→ {item.link}</div>}
  </div>
);

const AddTopicPanel = ({ open, onClose, onAdd }) => {
  const empty = { topic: '', cat: 'Flutter', column: 'toLearn', est: '4', link: '', note: '' };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.topic.trim()) { setErr('Topic name is required.'); return; }
    const newItem = {
      topic: form.topic.trim(),
      cat: form.cat,
      est: parseFloat(form.est) || 4,
      link: form.link.trim() || '—',
      note: form.note.trim(),
      rev: false,
    };
    if (form.column === 'inProgress') {
      newItem.actual = 0;
      newItem.prog = 0;
    }
    if (form.column === 'completed') {
      newItem.actual = 0;
      newItem.lastReviewed = new Date().toISOString().slice(0, 10);
    }
    onAdd(form.column, newItem);
    setForm(empty);
    setErr('');
    onClose();
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Topic" subtitle="PERSONAL / LEARNING / ADD">
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="fld">
          <label>Topic *</label>
          <input value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Rust → Flutter FFI" />
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Category</label>
            <select value={form.cat} onChange={e => set('cat', e.target.value)}>
              {LEARN_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Add to column</label>
            <select value={form.column} onChange={e => set('column', e.target.value)}>
              <option value="toLearn">To Learn</option>
              <option value="inProgress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div className="fld-row">
          <div className="fld">
            <label>Est. hours</label>
            <input type="number" value={form.est} onChange={e => set('est', e.target.value)} placeholder="4" min="0.5" step="0.5" />
          </div>
          <div className="fld">
            <label>Resource link</label>
            <input value={form.link} onChange={e => set('link', e.target.value)} placeholder="docs.flutter.dev/..." />
          </div>
        </div>
        <div className="fld">
          <label>Notes</label>
          <textarea value={form.note} onChange={e => set('note', e.target.value)} placeholder="Why are you learning this?" />
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit}>
          <Icon name="plus" size={12} /> Add topic
        </button>
      </div>
    </SlidePanel>
  );
};

export const LearningPage = ({ learning, setLearning }) => {
  const [showAdd, setShowAdd] = useStateA(false);

  const total = learning.toLearn.length + learning.inProgress.length + learning.completed.length;
  const done = learning.completed.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const today = new Date(2026, 4, 12);
  const dueForRev = learning.completed.filter(c => {
    if (c.rev) return true;
    const d = new Date(c.lastReviewed);
    return (today - d) / (1000*60*60*24) > 60;
  });

  const R = 38;
  const C = 2 * Math.PI * R;
  const off = C - (pct / 100) * C;

  const handleAdd = (column, item) => {
    setLearning(prev => ({ ...prev, [column]: [...prev[column], item] }));
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">PERSONAL / LEARNING</div>
          <h1>Learning path</h1>
          <div className="sub">Curate · practice · revisit. {total} topics tracked.</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="rev" size={12}/> Mark revision</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12}/> New topic
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
        <div className="card">
          <div className="ring-wrap">
            <div className="ring">
              <svg viewBox="0 0 100 100" width="100" height="100">
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-3)" strokeWidth="6"/>
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray={C} strokeDashoffset={off} strokeLinecap="square"/>
              </svg>
              <div className="num">{pct}%</div>
            </div>
            <div className="ring-stats">
              <div className="cell"><div className="l">To learn</div><div className="v">{learning.toLearn.length}</div></div>
              <div className="cell"><div className="l">In progress</div><div className="v" style={{color:'var(--accent-hi)'}}>{learning.inProgress.length}</div></div>
              <div className="cell"><div className="l">Completed</div><div className="v" style={{color:'#4ade80'}}>{learning.completed.length}</div></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <div className="t" style={{display:'flex',alignItems:'center',gap:8}}><Icon name="rev" size={14}/> Due for revision</div>
            <span className="lbl">{dueForRev.length}</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {dueForRev.map((c, i) => (
              <div key={i} style={{ padding: '10px 16px', borderBottom: i === dueForRev.length-1 ? 0 : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{c.topic}</div>
                  <div className="label-mono" style={{ marginTop: 2 }}>last touched {c.lastReviewed}</div>
                </div>
                <span className="tag accent">{c.cat}</span>
              </div>
            ))}
            {dueForRev.length === 0 && <div style={{padding:16,color:'var(--text-3)',fontSize:12}}>Nothing due — you're caught up.</div>}
          </div>
        </div>
      </div>

      <div className="learn-cols">
        {[
          { key: 'toLearn', t: 'TO LEARN', items: learning.toLearn },
          { key: 'inProgress', t: 'IN PROGRESS', items: learning.inProgress },
          { key: 'completed', t: 'COMPLETED', items: learning.completed },
        ].map(col => (
          <div key={col.key} className="learn-col">
            <div className="learn-h">
              <span className="t">{col.t}</span>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)', padding: '1px 6px', background: 'var(--bg-3)' }}>{col.items.length}</span>
            </div>
            <div className="learn-body">
              {col.items.map((it, i) => <LearnCard key={i} item={it} stage={col.key}/>)}
            </div>
          </div>
        ))}
      </div>

      <AddTopicPanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  5. VAULT
// ═══════════════════════════════════════════════════════════════════
const VAULT_CATS = [
  { id: 'all',   label: 'All items',        icon: 'lock' },
  { id: 'api',   label: 'API Keys',         icon: 'key' },
  { id: 'pw',    label: 'Passwords',        icon: 'lock' },
  { id: 'env',   label: 'Environment Vars', icon: 'code' },
  { id: 'ssh',   label: 'SSH Keys',         icon: 'key' },
  { id: 'other', label: 'Other',            icon: 'folder' },
];

const catIcon = (c) => ({ api: 'key', pw: 'lock', env: 'code', ssh: 'key', other: 'folder' }[c] || 'lock');

const AddSecretPanel = ({ open, onClose, onAdd }) => {
  const empty = { name: '', cat: 'api', value: '' };
  const [form, setForm] = useStateA(empty);
  const [err, setErr] = useStateA('');
  const [show, setShow] = useStateA(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) { setErr('Secret name is required.'); return; }
    if (!form.value.trim()) { setErr('Secret value is required.'); return; }
    onAdd({
      id: Date.now(),
      cat: form.cat,
      name: form.name.trim(),
      value: form.value.trim(),
      updated: new Date().toISOString().slice(0, 10),
    });
    setForm(empty);
    setErr('');
    setShow(false);
    onClose();
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Secret" subtitle="PERSONAL / VAULT / ADD">
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="vault-notice">
          <Icon name="lock" size={12} />
          <span>Stored locally only — never transmitted. Treat values as sensitive.</span>
        </div>
        <div className="fld">
          <label>Secret name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. OpenAI — Production" />
        </div>
        <div className="fld">
          <label>Category</label>
          <select value={form.cat} onChange={e => set('cat', e.target.value)}>
            <option value="api">API Key</option>
            <option value="pw">Password</option>
            <option value="env">Environment Variable</option>
            <option value="ssh">SSH Key</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="fld">
          <label>Value *</label>
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              value={form.value}
              onChange={e => set('value', e.target.value)}
              placeholder="sk-proj-..."
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>
              <Icon name="eye" size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit}>
          <Icon name="lock" size={12} /> Save secret
        </button>
      </div>
    </SlidePanel>
  );
};

export const VaultPage = ({ vault, setVault }) => {
  const [cat, setCat] = useStateA('all');
  const [revealed, setRevealed] = useStateA({});
  const [q, setQ] = useStateA('');
  const [showAdd, setShowAdd] = useStateA(false);

  const items = vault.filter(v =>
    (cat === 'all' || v.cat === cat) &&
    (!q || v.name.toLowerCase().includes(q.toLowerCase()))
  );

  const handleAdd = (item) => setVault(prev => [...prev, item]);

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">PERSONAL / VAULT</div>
          <h1>Vault</h1>
          <div className="sub">{vault.length} secrets · AES-256 local · last unlocked 09:42</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={12}/> Export</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12}/> New secret
          </button>
        </div>
      </div>

      <div className="vault-warning">
        <Icon name="lock" size={12} />
        This vault is local-only — not synced to any cloud service. Back up your encrypted export regularly.
      </div>

      <div className="vault-layout">
        <div className="vault-cats">
          <div style={{ padding: '8px 10px 14px' }}>
            <input
              placeholder="Search vault…"
              value={q} onChange={e => setQ(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-2)', padding: '6px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'var(--f-mono)' }}
              autoComplete="off" data-form-type="other"
            />
          </div>
          {VAULT_CATS.map(c => {
            const count = c.id === 'all' ? vault.length : vault.filter(v => v.cat === c.id).length;
            return (
              <div key={c.id} className={'vault-cat' + (cat===c.id ? ' active' : '')} onClick={() => setCat(c.id)}>
                <Icon name={c.icon} size={13} />
                <span>{c.label}</span>
                <span className="c">{count}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 12, padding: '12px 10px', borderTop: '1px solid var(--border)', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em' }}>
            <div>VAULT FINGERPRINT</div>
            <div style={{ color: 'var(--text-2)', marginTop: 4, wordBreak: 'break-all' }}>4a:7f:c2:9d:e1:8b:33:91</div>
            <div style={{ marginTop: 12 }}>ENCRYPTED AT REST</div>
            <div style={{ color: '#4ade80', marginTop: 4 }}>AES-256-GCM</div>
          </div>
        </div>

        <div className="vault-list">
          <div className="vault-row" style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border-2)' }}>
            <span className="label-mono"></span>
            <span className="label-mono">NAME</span>
            <span className="label-mono">VALUE</span>
            <span className="label-mono">UPDATED</span>
            <span></span>
          </div>
          {items.map(v => {
            const isRev = revealed[v.id];
            return (
              <div key={v.id} className="vault-row">
                <span style={{ color: 'var(--text-3)' }}><Icon name={catIcon(v.cat)} size={14}/></span>
                <span className="name">{v.name}</span>
                <span className={'val' + (isRev ? ' revealed' : '')}>{isRev ? v.value : '••••••••••••••••••••••'}</span>
                <span className="date">{v.updated}</span>
                <span className="acts">
                  <button className="iconbtn" onClick={() => setRevealed(r => ({...r, [v.id]: !isRev}))} title={isRev ? 'Hide' : 'Reveal'}>
                    <Icon name="eye" size={13}/>
                  </button>
                  <button className="iconbtn" title="Copy" onClick={() => navigator.clipboard?.writeText(v.value)}>
                    <Icon name="copy" size={13}/>
                  </button>
                  <button className="iconbtn" title="Edit"><Icon name="edit" size={13}/></button>
                </span>
              </div>
            );
          })}
          {items.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No secrets match.</div>}
        </div>
      </div>

      <AddSecretPanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
};

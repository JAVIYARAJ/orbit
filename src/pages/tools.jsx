// tools.jsx — Project Management, Notes, Time Tracker, Email Hub, Dev Toolkit

import React, { useMemo } from 'react';
import { useState as useStateB, useEffect as useEffectB } from 'react';
import { Icon, SlidePanel } from '../components/shell.jsx';

// ═══════════════════════════════════════════════════════════════════
//  6. PROJECT MANAGEMENT — Gantt + Health
// ═══════════════════════════════════════════════════════════════════
export const ProjectMgmtPage = ({ projects, ganttTasks }) => {
  const proj = projects.find(p => p.id === 'KMBL') || projects[0];
  const WEEKS = ['W10','W11','W12','W13','W14','W15','W16','W17','W18','W19','W20','W21'];

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE / PROJECT MGMT / {proj.id}</div>
          <h1 style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            {proj.name}
            <span className="num" style={{ fontSize: 14, color: 'var(--text-3)' }}>{proj.id}</span>
          </h1>
          <div className="sub">{proj.client} · {proj.type} · {proj.start} → {proj.end}</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="git" size={12}/> Repo</button>
          <button className="btn"><Icon name="download" size={12}/> Export PDF</button>
          <button className="btn primary"><Icon name="plus" size={12}/> Add milestone</button>
        </div>
      </div>

      <div className="pm-layout">
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-h">
              <div className="t">Timeline · 12 weeks</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="lbl">SHOW</span>
                <div className="view-toggle">
                  <button className="active">WEEKS</button>
                  <button>DAYS</button>
                  <button>MONTHS</button>
                </div>
                <span className="lbl" style={{ display:'flex', gap: 8 }}>
                  <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{width:8,height:8,background:'var(--accent)'}}></span>ACTIVE</span>
                  <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{width:8,height:8,background:'rgba(22,163,74,0.6)'}}></span>DONE</span>
                  <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{width:8,height:8,background:'rgba(217,119,6,0.6)'}}></span>REVIEW</span>
                </span>
              </div>
            </div>
            <div className="gantt">
              <div className="gantt-h">
                <div className="cell">TASK</div>
                {WEEKS.map((w, i) => (
                  <div key={w} className="cell" style={i === 8 ? { color: 'var(--accent-hi)', background: 'rgba(1,117,194,0.05)' } : {}}>{w}</div>
                ))}
              </div>
              {ganttTasks.map((t, idx) => {
                const startPct = ((t.start - 1) / 12) * 100;
                const widthPct = ((t.end - t.start) / 12) * 100;
                if (t.status === 'milestone') {
                  return (
                    <div key={idx} className="gantt-row">
                      <div className="name">
                        <div style={{fontWeight:600,color:'var(--accent-hi)'}}>◆ {t.name}</div>
                        <div className="sub">{t.sub}</div>
                      </div>
                      {WEEKS.map(w => <div key={w} className="week"></div>)}
                      <div className="gantt-bar milestone" style={{ left: `calc(200px + ${startPct}% * (100% - 200px) / 100% - 11px)` }} title={t.name}>
                        <Icon name="flame" size={12} />
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="gantt-row">
                    <div className="name">
                      <div>{t.name}</div>
                      <div className="sub">{t.sub}</div>
                    </div>
                    {WEEKS.map(w => <div key={w} className="week"></div>)}
                    <div className={'gantt-bar ' + t.status}
                      style={{
                        left: `calc(200px + ${startPct} * (100% - 200px) / 100)`,
                        width: `calc(${widthPct} * (100% - 200px) / 100)`,
                      }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ position: 'absolute', top: 0, left: 'calc(200px + 8.6 * (100% - 200px) / 12)', height: '100%', borderLeft: '1px dashed var(--accent-hi)', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: 4, left: 4, fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--accent-hi)', background: 'var(--bg-1)', padding: '0 4px' }}>TODAY</div>
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-h"><div className="t">Recent activity</div><span className="lbl">LAST 48H</span></div>
              <div style={{ padding: '6px 0' }}>
                {[
                  { who: 'Me', what: 'pushed feat/punch-card-confetti', when: '12m ago' },
                  { who: 'Me', what: 'moved KMBL-15 to Review', when: '2h ago' },
                  { who: 'Owen K.', what: 'commented on KMBL-12', when: 'Yesterday' },
                  { who: 'Me', what: 'logged 1.5h on KMBL-17', when: 'Yesterday' },
                  { who: 'CI', what: 'green build on main · #4421', when: 'Yesterday' },
                ].map((a, i) => (
                  <div key={i} style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12 }}><b>{a.who}</b> <span style={{ color: 'var(--text-2)' }}>{a.what}</span></div>
                    <span className="label-mono" style={{ fontSize: 9 }}>{a.when}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-h"><div className="t">Dependencies & blockers</div><span className="lbl">2 OPEN</span></div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: 'x', color: '#f87171', text: 'Stripe webhook IP allow-list — waiting on client IT', sub: 'BLOCKS KMBL-19 · 4 DAYS OVERDUE' },
                  { icon: 'rev', color: '#fbbf24', text: 'Design approval — punch-card visual variants', sub: 'BLOCKS KMBL-17 · DUE TOMORROW' },
                  { icon: 'check', color: '#4ade80', text: 'Apple Developer renewal — auto-renewed', sub: 'UNBLOCKED · 2026-04-29' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: item.color }}><Icon name={item.icon} size={12}/></span>
                    <div>
                      <div style={{ fontSize: 12 }}>{item.text}</div>
                      <div className="label-mono" style={{ marginTop: 2 }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pm-side">
          <div className="card">
            <div className="card-h"><div className="t">Health</div><span className="pill progress"><span className="d"></span>ON TRACK</span></div>
            <div className="health-grid">
              <div className="cell"><div className="l">On-track %</div><div className="v ok">82%</div></div>
              <div className="cell"><div className="l">Overdue</div><div className="v warn">2</div></div>
              <div className="cell"><div className="l">Burned</div><div className="v">{proj.hoursLogged}h</div></div>
              <div className="cell"><div className="l">Remaining</div><div className="v">{proj.hoursEst - proj.hoursLogged}h</div></div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div className="label-mono" style={{ marginBottom: 6 }}>BUDGET — {proj.budget}</div>
              <div className="prog" style={{ height: 8 }}><div className="fill" style={{ width: '54%' }}></div></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                <span>€6,720 burned</span><span>54%</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="t">Client</div></div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6b4423, #d97706)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-mono)', fontSize: 14, color: 'white' }}>R</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Roastery Co.</div>
                  <div className="label-mono">B2C · Bay Area</div>
                </div>
              </div>
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                {[['Primary','Owen Kim'],['Email','owen@roastery.co'],['Slack','#kombi-build'],['TZ','UTC-8 / PST']].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{color:'var(--text-3)'}}>{l}</span>
                    <span className="num" style={{color: l === 'Email' ? 'var(--accent-hi)' : 'inherit'}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="t">Tech</div></div>
            <div style={{ padding: '12px 16px' }}>
              <div className="label-mono" style={{ marginBottom: 6 }}>STACK</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {proj.stack.map(s => <span key={s} className="tag">{s}</span>)}
              </div>
              <div className="label-mono" style={{ marginBottom: 6 }}>REPO</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--accent-hi)', wordBreak: 'break-all' }}>↗ {proj.repo}</div>
              <div className="label-mono" style={{ marginBottom: 6, marginTop: 10 }}>LAST DEPLOY</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-2)' }}>1.3.0-rc.4 · 2026-05-09 14:22</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  7. NOTES
// ═══════════════════════════════════════════════════════════════════
const renderMd = (src) => {
  if (!src) return '';
  let s = src;
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<pre><code>${escaped}</code></pre>`;
  });
  s = s.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  s = s.replace(/((?:^\|.*\|\s*$\n?)+)/gm, (m) => {
    const lines = m.trim().split(/\n/);
    if (lines.length < 2) return m;
    const cells = (l) => l.split('|').slice(1,-1).map(c=>c.trim());
    const head = cells(lines[0]);
    const rows = lines.slice(2).map(cells);
    let h = '<table style="border-collapse:collapse;margin:0 0 12px;font-size:12px;"><thead><tr>';
    head.forEach(c => h += `<th style="text-align:left;padding:6px 12px;border-bottom:1px solid var(--border-2);font-family:var(--f-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3);">${c}</th>`);
    h += '</tr></thead><tbody>';
    rows.forEach(r => { h += '<tr>'; r.forEach(c => h += `<td style="padding:6px 12px;border-bottom:1px solid var(--border);">${c}</td>`); h += '</tr>'; });
    h += '</tbody></table>';
    return h;
  });
  s = s.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  s = s.replace(/^- \[ \] (.*)$/gm, '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;"><span style="width:13px;height:13px;border:1px solid var(--border-3);display:inline-block;"></span><span>$1</span></div>');
  s = s.replace(/^- \[x\] (.*)$/gm, '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;"><span style="width:13px;height:13px;background:var(--accent);display:inline-block;display:grid;place-items:center;color:white;font-size:9px;">✓</span><span style="color:var(--text-3);text-decoration:line-through;">$1</span></div>');
  s = s.replace(/((?:^\d+\. .*\n?)+)/gm, (m) => {
    const items = m.trim().split(/\n/).map(l=>l.replace(/^\d+\. /,''));
    return '<ol>' + items.map(i=>`<li>${i}</li>`).join('') + '</ol>';
  });
  s = s.replace(/((?:^- .*\n?)+)/gm, (m) => {
    const items = m.trim().split(/\n/).map(l=>l.replace(/^- /,''));
    return '<ul>' + items.map(i=>`<li>${i}</li>`).join('') + '</ul>';
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  s = s.split(/\n\n+/).map(block => {
    if (block.match(/^<(h\d|ul|ol|pre|blockquote|table|div)/)) return block;
    if (!block.trim()) return '';
    return '<p>' + block.replace(/\n/g, '<br/>') + '</p>';
  }).join('\n');
  return s;
};

const FOLDERS = ['Clients', 'Pulse', 'Ideas', 'Daily'];

export const NotesPage = ({ notes, setNotes }) => {
  const [activeId, setActiveId] = useStateB(notes[0]?.id);
  const [tab, setTab] = useStateB('edit');
  const [q, setQ] = useStateB('');
  const [quickText, setQuickText] = useStateB('');

  const note = notes.find(n => n.id === activeId) || notes[0];
  const [body, setBody] = useStateB(note?.body || '');
  const [title, setTitle] = useStateB(note?.title || '');
  const [saved, setSaved] = useStateB(true);

  useEffectB(() => {
    if (!note) return;
    setBody(note.body);
    setTitle(note.title);
    setSaved(true);
  }, [activeId]);

  const handleBodyChange = (val) => { setBody(val); setSaved(false); };
  const handleTitleChange = (val) => { setTitle(val); setSaved(false); };

  const saveNote = () => {
    setNotes(prev => prev.map(n => n.id === activeId ? { ...n, title, body, edited: 'Just now' } : n));
    setSaved(true);
  };

  const createNote = () => {
    const id = Date.now();
    const newNote = { id, title: 'Untitled note', folder: 'Ideas', tags: [], pinned: false, edited: 'Just now', body: '' };
    setNotes(prev => [newNote, ...prev]);
    setActiveId(id);
  };

  const saveQuick = (e) => {
    if (e.key === 'Enter' && quickText.trim()) {
      const id = Date.now();
      const newNote = { id, title: quickText.trim(), folder: 'Daily', tags: ['#quick'], pinned: false, edited: 'Just now', body: quickText.trim() };
      setNotes(prev => [newNote, ...prev]);
      setQuickText('');
      setActiveId(id);
    }
  };

  const pinned = notes.filter(n => n.pinned && (!q || n.title.toLowerCase().includes(q.toLowerCase())));
  const others = notes.filter(n => !n.pinned && (!q || n.title.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / NOTES</div>
          <h1>Notes</h1>
          <div className="sub">{notes.length} notes · 4 folders · last synced 2 min ago</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="folder" size={12}/> Folders</button>
          <button className="btn primary" onClick={createNote}><Icon name="plus" size={12}/> New note</button>
        </div>
      </div>

      <div className="notes-layout">
        <div className="notes-list">
          <div className="notes-quick">
            <div className="lbl">QUICK CAPTURE</div>
            <input
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              onKeyDown={saveQuick}
              placeholder="press enter to save…"
            />
          </div>
          <div className="notes-search">
            <input placeholder="Search notes…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="notes-scroll">
            {pinned.length > 0 && (
              <>
                <div className="notes-sec"><Icon name="pin" size={9}/> &nbsp;PINNED</div>
                {pinned.map(n => (
                  <div key={n.id} className={'note-item' + (n.id === activeId ? ' active' : '')} onClick={() => setActiveId(n.id)}>
                    <div className="t">{n.title}</div>
                    <div className="p">{n.body.replace(/[#*`>]/g, '').slice(0, 60)}</div>
                    <div className="m">
                      {n.tags.slice(0, 2).map(t => <span key={t}>{t}</span>)}
                      <span style={{ marginLeft: 'auto' }}>{n.edited}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
            {FOLDERS.map(f => {
              const inFolder = others.filter(n => n.folder === f);
              if (inFolder.length === 0) return null;
              return (
                <React.Fragment key={f}>
                  <div className="notes-sec">{f.toUpperCase()}</div>
                  {inFolder.map(n => (
                    <div key={n.id} className={'note-item' + (n.id === activeId ? ' active' : '')} onClick={() => setActiveId(n.id)}>
                      <div className="t">{n.title}</div>
                      <div className="p">{n.body.replace(/[#*`>]/g, '').slice(0, 60)}</div>
                      <div className="m">
                        {n.tags.slice(0, 2).map(t => <span key={t}>{t}</span>)}
                        <span style={{ marginLeft: 'auto' }}>{n.edited}</span>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {note && (
          <div className="note-editor">
            <div className="note-eh">
              <input className="title" value={title} onChange={e => handleTitleChange(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!saved && (
                  <button className="btn sm primary" onClick={saveNote}>
                    <Icon name="check" size={10}/> Save
                  </button>
                )}
                <div className="note-tabs">
                  <button className={tab==='edit' ? 'active' : ''} onClick={() => setTab('edit')}>EDIT</button>
                  <button className={tab==='preview' ? 'active' : ''} onClick={() => setTab('preview')}>PREVIEW</button>
                  <button className={tab==='split' ? 'active' : ''} onClick={() => setTab('split')}>SPLIT</button>
                </div>
              </div>
            </div>
            <div className="note-meta">
              <span>{note.folder.toUpperCase()}</span><span>·</span>
              <span>EDITED {note.edited.toUpperCase()}</span><span>·</span>
              <span>{body.length} chars · {body.split(/\s+/).filter(Boolean).length} words</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {note.tags.map(t => <span key={t} className="tag" style={{ color: 'var(--accent-hi)', borderColor: 'var(--accent-tint-2)' }}>{t}</span>)}
                {note.pinned && <span className="tag" style={{ color: '#fbbf24' }}><Icon name="pin" size={9}/> PINNED</span>}
              </span>
            </div>
            {tab === 'split' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0 }}>
                <div className="note-body" style={{ borderRight: '1px solid var(--border)' }}>
                  <textarea value={body} onChange={e => handleBodyChange(e.target.value)} />
                </div>
                <div className="note-body note-preview" dangerouslySetInnerHTML={{ __html: renderMd(body) }} />
              </div>
            ) : tab === 'edit' ? (
              <div className="note-body">
                <textarea value={body} onChange={e => handleBodyChange(e.target.value)} />
              </div>
            ) : (
              <div className="note-body note-preview" dangerouslySetInnerHTML={{ __html: renderMd(body) }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  8. TIME TRACKER
// ═══════════════════════════════════════════════════════════════════
export const TimerPage = ({ timer, onToggle, projects, tasks, sessions }) => {
  const [selProj, setSelProj] = useStateB('KMBL');
  const [selTask, setSelTask] = useStateB('KMBL-17');

  const todayTotal = 6.0;
  const breakdown = [
    { name: 'Kombi — Loyalty App', hrs: 3.4, pct: 56 },
    { name: 'Northwind Field Service', hrs: 1.6, pct: 27 },
    { name: 'Pulse — Habit Tracker', hrs: 1.0, pct: 17 },
  ];
  const week = [6.4, 7.8, 5.2, 8.1, 6.9, 2.1, 0];
  const maxH = 9;

  // Stable heatmap (won't regenerate on re-render)
  const heatmap = useMemo(() => {
    const seed = [0,0,1,2,1,3,0,2,3,4,1,2,0,3,2,1,4,3,2,1,0,2,3,1,2,1,0,3,4,2];
    return seed;
  }, []);

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / TIME TRACKER</div>
          <h1>Time tracker</h1>
          <div className="sub">{todayTotal.toFixed(1)}h today · 36.5h this week · streak 47</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={12}/> Export CSV</button>
          <button className="btn"><Icon name="settings" size={12}/> Rates</button>
        </div>
      </div>

      <div className="timer-page">
        <div className={'timer-big' + (timer.running ? ' running' : '')}>
          <div className="ctx">
            <div className="label-mono" style={{ letterSpacing: '0.12em' }}>{timer.running ? 'RUNNING' : 'IDLE'}</div>
            <div className="lnk">
              <span>PROJECT</span>
              <select value={selProj} onChange={e => setSelProj(e.target.value)}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select>
              <span>TASK</span>
              <select value={selTask} onChange={e => setSelTask(e.target.value)}>
                {tasks.filter(t => t.proj === selProj).map(t => (
                  <option key={t.id} value={t.id}>{t.id} — {t.title.slice(0, 30)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="display">{timer.display}</div>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.1em' }}>
            STARTED 14:20 · {timer.running ? 'LIVE' : 'PAUSED'}
          </div>
          <div className="ctrls">
            <button className="btn" onClick={onToggle}>
              <Icon name={timer.running ? 'pause' : 'play'} size={11}/>
              {timer.running ? 'PAUSE' : 'RESUME'}
            </button>
            <button className="btn primary"><Icon name="stop" size={11}/> STOP & LOG</button>
            <button className="btn"><Icon name="x" size={11}/> DISCARD</button>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div className="t">Today · breakdown by project</div>
            <span className="num" style={{ color: 'var(--accent-hi)' }}>{todayTotal.toFixed(1)}h</span>
          </div>
          <div className="hbar-chart">
            {breakdown.map(b => (
              <div key={b.name} className="hbar">
                <div className="name">{b.name}</div>
                <div className="bar"><div className="fill" style={{ width: b.pct + '%' }}></div></div>
                <div className="v">{b.hrs.toFixed(1)}h</div>
              </div>
            ))}
          </div>
          <div className="card-h" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            <div className="t">EOD summary</div>
            <span className="label-mono">vs DAILY TARGET 7H</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)' }}>
            <div style={{ background: 'var(--bg-2)', padding: 10 }}><div className="label-mono">BILLABLE</div><div className="num" style={{ fontSize: 18, marginTop: 4, color: '#4ade80' }}>5.0h</div></div>
            <div style={{ background: 'var(--bg-2)', padding: 10 }}><div className="label-mono">INTERNAL</div><div className="num" style={{ fontSize: 18, marginTop: 4 }}>1.0h</div></div>
            <div style={{ background: 'var(--bg-2)', padding: 10 }}><div className="label-mono">DEEP WORK</div><div className="num" style={{ fontSize: 18, marginTop: 4, color: 'var(--accent-hi)' }}>4.2h</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h"><div className="t">Today · sessions</div><span className="lbl">{sessions.length}</span></div>
          <div className="session-log">
            {sessions.map((s, i) => (
              <div key={i} className="session-row">
                <div className="name">
                  {s.task}
                  <div className="sub">{s.proj}</div>
                </div>
                <span className="time">{s.start} → {s.end}</span>
                <span className="dur">
                  {s.dur === 'live'
                    ? <span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:5,height:5,background:'#ef4444',borderRadius:'50%',animation:'pulse 1.4s infinite'}}></span>{timer.display}</span>
                    : s.dur}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="t">This week</div><span className="num" style={{ color: 'var(--accent-hi)' }}>36.5h</span></div>
          <div className="week-chart" style={{ height: 180 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className="day">
                <div className="v">{week[i] ? week[i].toFixed(1) : '·'}</div>
                <div className={'bar ' + (i === 1 ? 'today' : (week[i] === 0 ? 'dim' : ''))} style={{ height: `${(week[i] / maxH) * 100}%` }}></div>
                <div className="lbl">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><div className="t">Last 30 days · activity heatmap</div><span className="label-mono">147H · 24 ACTIVE DAYS</span></div>
        <div className="heatmap">
          <div className="heatmap-grid">
            {heatmap.map((lvl, i) => (
              <div key={i} className={'heatmap-cell ' + (lvl ? `l${lvl}` : '')} title={`Day -${29-i}: ${lvl ? lvl * 2 + 'h' : 'no activity'}`}></div>
            ))}
          </div>
          <div className="heatmap-legend">
            <span>LESS</span>
            <div className="heatmap-cell cell"></div>
            <div className="heatmap-cell l1 cell"></div>
            <div className="heatmap-cell l2 cell"></div>
            <div className="heatmap-cell l3 cell"></div>
            <div className="heatmap-cell l4 cell"></div>
            <span>MORE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  9. EMAIL TEMPLATE HUB
// ═══════════════════════════════════════════════════════════════════
const EMAIL_CATS = ['Proposals', 'Freelance', 'Job Applications', 'Follow-ups', 'Client Updates', 'Cold Outreach'];

const extractPlaceholders = (body) => {
  const set = new Set();
  const re = /\{\{(\w+)\}\}/g; let m;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return Array.from(set);
};

const AddTemplatePanel = ({ open, onClose, onAdd }) => {
  const empty = { name: '', cat: 'Proposals', body: '' };
  const [form, setForm] = useStateB(empty);
  const [err, setErr] = useStateB('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) { setErr('Template name is required.'); return; }
    if (!form.body.trim()) { setErr('Template body is required.'); return; }
    const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString().slice(-4);
    onAdd({ id, cat: form.cat, name: form.name.trim(), body: form.body.trim() });
    setForm(empty);
    setErr('');
    onClose();
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="New Template" subtitle="TOOLS / EMAIL HUB / ADD" width={560}>
      <div className="sp-body">
        {err && <div className="sp-error">{err}</div>}
        <div className="fld-row">
          <div className="fld">
            <label>Template name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Project kick-off" />
          </div>
          <div className="fld">
            <label>Category</label>
            <select value={form.cat} onChange={e => set('cat', e.target.value)}>
              {EMAIL_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="fld">
          <label>Body *</label>
          <textarea
            value={form.body}
            onChange={e => set('body', e.target.value)}
            placeholder={"Hi {{client_name}},\n\n..."}
            style={{ minHeight: 240 }}
          />
          <span className="fld-hint">Use {'{{variable_name}}'} syntax for placeholders</span>
        </div>
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit}>
          <Icon name="plus" size={12} /> Create template
        </button>
      </div>
    </SlidePanel>
  );
};

export const EmailPage = ({ emailTemplates, setEmailTemplates }) => {
  const [activeId, setActiveId] = useStateB(emailTemplates[0]?.id);
  const [mode, setMode] = useStateB('fill');
  const [showAdd, setShowAdd] = useStateB(false);
  const [vals, setVals] = useStateB({
    client_name: 'Owen',
    project_name: 'Kombi loyalty platform',
    scope_summary: 'Customer-facing mobile app + admin web dashboard, plus Stripe payments integration.',
    duration: '12',
    start_date: 'May 27',
    rate: '€12,400 fixed',
    payment_terms: '40% upfront, 30% mid, 30% on delivery',
  });

  const tpl = emailTemplates.find(t => t.id === activeId) || emailTemplates[0];
  const placeholders = tpl ? extractPlaceholders(tpl.body) : [];

  const renderBody = (body) => {
    const parts = [];
    let last = 0;
    const re = /\{\{(\w+)\}\}/g; let m;
    while ((m = re.exec(body)) !== null) {
      if (m.index > last) parts.push(body.slice(last, m.index));
      const key = m[1]; const v = vals[key];
      parts.push({ key, v });
      last = m.index + m[0].length;
    }
    if (last < body.length) parts.push(body.slice(last));
    return parts.map((p, i) => {
      if (typeof p === 'string') return <span key={i}>{p}</span>;
      if (p.v) return <span key={i} className="ph filled">{p.v}</span>;
      return <span key={i} className="ph">{`{{${p.key}}}`}</span>;
    });
  };

  const finalCopy = () => {
    if (!tpl) return;
    let b = tpl.body;
    Object.entries(vals).forEach(([k, v]) => { b = b.replaceAll(`{{${k}}}`, v); });
    navigator.clipboard?.writeText(b);
  };

  const handleAdd = (tpl) => {
    setEmailTemplates(prev => [...prev, tpl]);
    setActiveId(tpl.id);
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / EMAIL HUB</div>
          <h1>Email templates</h1>
          <div className="sub">{emailTemplates.length} templates · 6 categories · last used 3h ago</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="copy" size={12}/> Variables</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12}/> New template
          </button>
        </div>
      </div>

      <div className="email-layout">
        <div className="email-list">
          {EMAIL_CATS.map(cat => {
            const items = emailTemplates.filter(t => t.cat === cat);
            if (items.length === 0) return null;
            return (
              <React.Fragment key={cat}>
                <div className="email-cat">{cat} · {items.length}</div>
                {items.map(t => (
                  <div key={t.id} className={'email-tpl' + (t.id === activeId ? ' active' : '')} onClick={() => setActiveId(t.id)}>
                    <div className="t">{t.name}</div>
                    <div className="p">{t.body.split('\n').find(l => l.trim()) || ''}</div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>

        {tpl && (
          <div className="email-editor">
            <div className="email-edh">
              <div>
                <div className="t">{tpl.name}</div>
                <div className="label-mono" style={{ marginTop: 4 }}>{tpl.cat} · {placeholders.length} placeholders</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="view-toggle">
                  <button className={mode==='fill'?'active':''} onClick={() => setMode('fill')}>FILL</button>
                  <button className={mode==='edit'?'active':''} onClick={() => setMode('edit')}>EDIT</button>
                  <button className={mode==='preview'?'active':''} onClick={() => setMode('preview')}>PREVIEW</button>
                </div>
                <button className="btn primary" onClick={finalCopy}><Icon name="copy" size={12}/> COPY EMAIL</button>
              </div>
            </div>
            <div className="email-content">
              <div className="email-body">
                {mode === 'edit' ? (
                  <textarea value={tpl.body} readOnly style={{ width: '100%', minHeight: '100%', background: 'transparent', border: 0, color: 'var(--text)', fontFamily: 'var(--f-mono)', fontSize: 12, resize: 'none', lineHeight: 1.8 }} />
                ) : (
                  renderBody(tpl.body)
                )}
              </div>
              <div className="email-fill">
                <div className="label-mono">FILL PLACEHOLDERS</div>
                {placeholders.map(p => (
                  <div key={p} className="grp">
                    <div className="lbl">{p.replace(/_/g, ' ')}</div>
                    <input
                      placeholder={`{{${p}}}`}
                      value={vals[p] || ''}
                      onChange={e => setVals(v => ({ ...v, [p]: e.target.value }))}
                    />
                  </div>
                ))}
                {placeholders.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 11 }}>No placeholders — this template is ready to copy.</div>}
                <div style={{ marginTop: 'auto', padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
                  <div className="label-mono">SHORTCUTS</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.8, fontFamily: 'var(--f-mono)' }}>
                    ⌘↵ &nbsp;copy email<br/>
                    ⌘⇧V &nbsp;paste from clipboard<br/>
                    ⌘D &nbsp;duplicate template
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddTemplatePanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  10. DEV TOOLKIT
// ═══════════════════════════════════════════════════════════════════
export const ToolkitPage = () => {
  const [expanded, setExpanded] = useStateB(null);
  const [color, setColor] = useStateB('#0175C2');
  const [jsonIn, setJsonIn] = useStateB('{\n  "user": "raunak",\n  "active": true,\n  "tags": ["flutter","indie"]\n}');
  const [b64In, setB64In] = useStateB('Hello, DevOS');
  const [b64Mode, setB64Mode] = useStateB('encode');
  const [tsIn, setTsIn] = useStateB('1747044000');
  const [regexPat, setRegexPat] = useStateB('\\b\\w+@\\w+\\.\\w+\\b');
  const [regexTest, setRegexTest] = useStateB('Contact me at raunak@dev.os or alt@example.com');
  const [pkgQuery, setPkgQuery] = useStateB('flutter_riverpod');
  const [md, setMd] = useStateB('# Hello\n\nThis is **markdown**.\n\n- list item\n- another');
  const [uuids, setUuids] = useStateB(() => Array.from({ length: 5 }, () => crypto.randomUUID()));

  const formatJson = () => { try { return JSON.stringify(JSON.parse(jsonIn), null, 2); } catch (e) { return '✗ ' + e.message; } };
  const formatJsonOk = () => { try { JSON.parse(jsonIn); return true; } catch { return false; } };

  const b64Out = () => {
    try { return b64Mode === 'encode' ? btoa(b64In) : atob(b64In); }
    catch { return '✗ Invalid input'; }
  };

  const tsOut = () => {
    const n = parseInt(tsIn);
    if (isNaN(n)) return '✗ Invalid';
    return new Date(n * 1000).toUTCString();
  };

  const regexMatches = () => {
    try {
      const r = new RegExp(regexPat, 'g');
      const found = [...regexTest.matchAll(r)];
      return found.length ? found.map(m => m[0]).join(', ') : '(no matches)';
    } catch (e) { return '✗ ' + e.message; }
  };

  const hexToRgb = (h) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return m ? `rgb(${parseInt(m[1],16)}, ${parseInt(m[2],16)}, ${parseInt(m[3],16)})` : '—';
  };

  const TOOLS = [
    {
      id: 'color', icon: 'palette', name: 'Color picker', desc: 'Hex / RGB / HSL converter',
      render: () => (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, background: color, border: '1px solid var(--border-3)', borderRadius: 4 }}></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={color} onChange={e => setColor(e.target.value)} />
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ height: 28, padding: 0 }} />
            </div>
          </div>
          <div className="out">RGB &nbsp;{hexToRgb(color)}<br/>HEX &nbsp;{color.toUpperCase()}</div>
        </>
      )
    },
    {
      id: 'json', icon: 'code', name: 'JSON formatter', desc: 'Validate, format, minify',
      render: () => (
        <>
          <textarea value={jsonIn} onChange={e => setJsonIn(e.target.value)} rows={6} />
          <div style={{ display: 'flex', gap: 6 }}>
            <span className={formatJsonOk() ? 'pill done' : 'pill hold'} style={{ flex: 1, justifyContent: 'center' }}>
              <span className="d"></span>{formatJsonOk() ? 'VALID JSON' : 'INVALID'}
            </span>
          </div>
          <pre className="out" style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', margin: 0 }}>{formatJson()}</pre>
        </>
      )
    },
    {
      id: 'b64', icon: 'code', name: 'Base64', desc: 'Encode / decode',
      render: () => (
        <>
          <div className="view-toggle">
            <button className={b64Mode==='encode'?'active':''} onClick={() => setB64Mode('encode')}>ENCODE</button>
            <button className={b64Mode==='decode'?'active':''} onClick={() => setB64Mode('decode')}>DECODE</button>
          </div>
          <textarea value={b64In} onChange={e => setB64In(e.target.value)} rows={3} />
          <div className="out">{b64Out()}</div>
        </>
      )
    },
    {
      id: 'uuid', icon: 'hash', name: 'UUID generator', desc: 'v4 random',
      render: () => (
        <>
          {uuids.map(id => <div key={id} className="out" style={{ fontSize: 11 }}>{id}</div>)}
          <button className="btn sm" onClick={() => setUuids(Array.from({ length: 5 }, () => crypto.randomUUID()))}>
            <Icon name="rev" size={11}/> Regenerate
          </button>
        </>
      )
    },
    {
      id: 'ts', icon: 'timer', name: 'Timestamp', desc: 'Unix ↔ human',
      render: () => (
        <>
          <input value={tsIn} onChange={e => setTsIn(e.target.value)} placeholder="Unix seconds" />
          <div className="out">{tsOut()}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>
            NOW: {Math.floor(Date.now()/1000)}
          </div>
        </>
      )
    },
    {
      id: 'regex', icon: 'code', name: 'Regex tester', desc: 'Live match preview',
      render: () => (
        <>
          <div className="grp" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>PATTERN</span>
            <input value={regexPat} onChange={e => setRegexPat(e.target.value)} />
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>TEST STRING</span>
            <textarea value={regexTest} onChange={e => setRegexTest(e.target.value)} rows={3} />
          </div>
          <div className="out">{regexMatches()}</div>
        </>
      )
    },
    {
      id: 'md', icon: 'note', name: 'Markdown previewer', desc: 'Live render',
      render: () => (
        <>
          <textarea value={md} onChange={e => setMd(e.target.value)} rows={5} />
          <div className="out note-preview" style={{ color: 'var(--text)', fontFamily: 'var(--f-body)' }} dangerouslySetInnerHTML={{ __html: renderMd(md) }} />
        </>
      )
    },
    {
      id: 'pkg', icon: 'folder', name: 'Pub.dev lookup', desc: 'Quick version check',
      render: () => (
        <>
          <input value={pkgQuery} onChange={e => setPkgQuery(e.target.value)} placeholder="package name" />
          <div className="out" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>↗ pub.dev/packages/{pkgQuery}</div>
            <div style={{ color: 'var(--text-2)' }}>Latest: <span style={{ color: 'var(--accent-hi)' }}>3.0.2</span></div>
            <div style={{ color: 'var(--text-2)' }}>Updated: 12 days ago</div>
            <div style={{ color: 'var(--text-2)' }}>Likes: 4,217 · Pub Points: 150</div>
          </div>
        </>
      )
    },
    {
      id: 'diff', icon: 'code', name: 'API response diff', desc: 'Compare 2 JSON payloads',
      render: () => (
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>Paste two JSON bodies to diff…</div>
      )
    },
    {
      id: 'size', icon: 'chart', name: 'App size estimator', desc: 'Bundle size projection',
      render: () => (
        <div className="out" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['Base Flutter','5.2 MB'],['+ image assets','+2.1 MB'],['+ font subsets','+0.4 MB'],['+ native libs','+1.8 MB']].map(([k,v])=>(
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{k}</span><span style={{ color: 'var(--accent-hi)' }}>{v}</span></div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Estimated APK</span><strong style={{ color: 'var(--accent-hi)' }}>9.5 MB</strong>
          </div>
        </div>
      )
    },
  ];

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / DEV TOOLKIT</div>
          <h1>Dev toolkit</h1>
          <div className="sub">{TOOLS.length} tools · all local · zero network calls</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="settings" size={12}/> Manage</button>
        </div>
      </div>

      <div className="toolkit-grid">
        {TOOLS.map(tool => (
          <div key={tool.id}
            className={'tool-card' + (expanded === tool.id ? ' expanded' : '')}
            onClick={() => expanded !== tool.id && setExpanded(tool.id)}>
            <div className="head">
              <span className="ic"><Icon name={tool.icon} size={15}/></span>
              <div>
                <div className="name">{tool.name}</div>
                <div className="desc">{tool.desc}</div>
              </div>
              {expanded === tool.id && (
                <button className="ic-close" onClick={e => { e.stopPropagation(); setExpanded(null); }}>
                  <Icon name="x" size={12}/>
                </button>
              )}
            </div>
            {expanded === tool.id && (
              <div className="body" onClick={e => e.stopPropagation()}>
                {tool.render()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

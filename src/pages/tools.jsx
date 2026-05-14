// tools.jsx — Project Management, Notes, Time Tracker, Email Hub, Dev Toolkit

import React from 'react';
import { useState as useStateB, useEffect as useEffectB, useRef as useRefB } from 'react';
import { Icon, SlidePanel } from '../components/shell.jsx';
import {
  createNote as dbCreateNote, updateNote as dbUpdateNote,
  createEmailTemplate,
} from '../lib/db.js';

// ═══════════════════════════════════════════════════════════════════
//  6. PROJECT MANAGEMENT — Gantt + Health
// ═══════════════════════════════════════════════════════════════════
export const ProjectMgmtPage = ({ projects, ganttTasks, onNav }) => {
  const [selId, setSelId] = useStateB(projects[0]?.id || '');
  const proj = projects.find(p => p.id === selId) || projects[0] || null;
  const WEEKS = ['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12'];

  if (!proj) {
    return (
      <div className="page page-wide">
        <div className="page-head">
          <div>
            <div className="crumb">WORKSPACE / PROJECT MGMT</div>
            <h1>Project management</h1>
          </div>
        </div>
        <div className="empty-state">
          <Icon name="chart" size={32} />
          <div className="empty-title">No projects yet</div>
          <div className="empty-sub">Create a project first to view its timeline and health.</div>
          <button className="btn primary" onClick={() => onNav('projects')}>
            <Icon name="plus" size={12} /> New project
          </button>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, proj.hoursEst - proj.hoursLogged);
  const burnPct   = proj.hoursEst > 0 ? Math.round((proj.hoursLogged / proj.hoursEst) * 100) : 0;

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE / PROJECT MGMT / {proj.id}</div>
          <h1 style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            {proj.name}
            <span className="num" style={{ fontSize: 14, color: 'var(--text-3)' }}>{proj.id}</span>
          </h1>
          <div className="sub">{proj.client} · {proj.type} · {proj.start || '—'} → {proj.end || '—'}</div>
        </div>
        <div className="actions">
          {projects.length > 1 && (
            <select value={selId} onChange={e => setSelId(e.target.value)} style={{ fontFamily: 'var(--f-mono)', fontSize: 11, background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '6px 10px' }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select>
          )}
          <button className="btn"><Icon name="download" size={12}/> Export PDF</button>
        </div>
      </div>

      <div className="pm-layout">
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-h">
              <div className="t">Timeline · {WEEKS.length} weeks</div>
              <span className="lbl" style={{ display:'flex', gap: 8 }}>
                <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{width:8,height:8,background:'var(--accent)'}}></span>ACTIVE</span>
                <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{width:8,height:8,background:'rgba(22,163,74,0.6)'}}></span>DONE</span>
                <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{width:8,height:8,background:'rgba(217,119,6,0.6)'}}></span>REVIEW</span>
              </span>
            </div>
            <div className="gantt">
              <div className="gantt-h">
                <div className="cell">TASK</div>
                {WEEKS.map(w => <div key={w} className="cell">{w}</div>)}
              </div>
              {ganttTasks.length === 0 ? (
                <div style={{ padding: '24px 16px', color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--f-mono)' }}>
                  No timeline tasks yet.
                </div>
              ) : ganttTasks.map((t, idx) => {
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
            </div>
          </div>
        </div>

        <div className="pm-side">
          <div className="card">
            <div className="card-h">
              <div className="t">Health</div>
              <span className={'pill ' + proj.status}><span className="d"></span>{proj.status.toUpperCase()}</span>
            </div>
            <div className="health-grid">
              <div className="cell"><div className="l">Progress</div><div className="v ok">{proj.progress}%</div></div>
              <div className="cell"><div className="l">Open tasks</div><div className="v">{proj.openTasks}</div></div>
              <div className="cell"><div className="l">Burned</div><div className="v">{proj.hoursLogged}h</div></div>
              <div className="cell"><div className="l">Remaining</div><div className="v">{remaining}h</div></div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div className="label-mono" style={{ marginBottom: 6 }}>HOURS — {proj.hoursLogged}/{proj.hoursEst}h</div>
              <div className="prog" style={{ height: 8 }}><div className="fill" style={{ width: burnPct + '%' }}></div></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                <span>{proj.hoursLogged}h burned</span><span>{burnPct}%</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="t">Details</div></div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              {[
                ['Client',  proj.client || '—'],
                ['Type',    proj.type   || '—'],
                ['Start',   proj.start  || '—'],
                ['End',     proj.end    || '—'],
                ['Budget',  proj.budget || '—'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{l}</span>
                  <span className="num" style={{ textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {(proj.stack?.length > 0 || proj.repo) && (
            <div className="card">
              <div className="card-h"><div className="t">Tech</div></div>
              <div style={{ padding: '12px 16px' }}>
                {proj.stack?.length > 0 && (
                  <>
                    <div className="label-mono" style={{ marginBottom: 6 }}>STACK</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      {proj.stack.map(s => <span key={s} className="tag">{s}</span>)}
                    </div>
                  </>
                )}
                {proj.repo && proj.repo !== '—' && (
                  <>
                    <div className="label-mono" style={{ marginBottom: 6 }}>REPO</div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--accent-hi)', wordBreak: 'break-all' }}>↗ {proj.repo}</div>
                  </>
                )}
              </div>
            </div>
          )}
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

export const NotesPage = ({ notes, setNotes, workstationId }) => {
  const [activeId, setActiveId] = useStateB(notes[0]?.id);
  const [tab, setTab] = useStateB('edit');
  const [q, setQ] = useStateB('');
  const [quickText, setQuickText] = useStateB('');
  const [autoScrolling, setAutoScrolling] = useStateB(false);
  const previewRef = useRefB(null);
  const splitPreviewRef = useRefB(null);
  const scrollFrameRef = useRefB(null);
  const scrollDelayRef = useRefB(null);

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
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const readMs = Math.min(90000, Math.max(8000, Math.round((wordCount / 220) * 60000)));
  const readLabel = readMs >= 60000 ? `${Math.round(readMs / 60000)}m` : `${Math.round(readMs / 1000)}s`;

  const stopAutoScroll = () => {
    if (scrollDelayRef.current) window.clearTimeout(scrollDelayRef.current);
    if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollDelayRef.current = null;
    scrollFrameRef.current = null;
    setAutoScrolling(false);
  };

  const startAutoScroll = () => {
    const target = tab === 'split' ? splitPreviewRef.current : previewRef.current;
    if (!target) return;

    stopAutoScroll();
    setAutoScrolling(true);

    scrollDelayRef.current = window.setTimeout(() => {
      const start = target.scrollTop;
      const end = Math.max(0, target.scrollHeight - target.clientHeight);
      const distance = end - start;
      const startedAt = performance.now();

      if (distance <= 0) {
        setAutoScrolling(false);
        return;
      }

      const tick = (now) => {
        const progress = Math.min(1, (now - startedAt) / readMs);
        target.scrollTop = start + distance * progress;
        if (progress < 1) {
          scrollFrameRef.current = window.requestAnimationFrame(tick);
        } else {
          setAutoScrolling(false);
          scrollFrameRef.current = null;
        }
      };

      scrollFrameRef.current = window.requestAnimationFrame(tick);
    }, 700);
  };

  useEffectB(() => stopAutoScroll, [activeId, tab, body]);

  const saveNote = async () => {
    // Optimistic update for instant feedback
    setNotes(prev => prev.map(n => n.id === activeId ? { ...n, title, body, edited: 'Just now' } : n));
    setSaved(true);
    try {
      const saved = await dbUpdateNote({
        id: activeId, title, body,
        folder: note.folder, tags: note.tags, pinned: note.pinned,
      });
      setNotes(prev => prev.map(n => n.id === activeId ? saved : n));
    } catch (err) {
      console.error('Failed to save note:', err);
      setSaved(false);
    }
  };

  const createNote = async () => {
    try {
      const saved = await dbCreateNote(
        { title: 'Untitled note', folder: 'Ideas', tags: [], pinned: false, body: '' },
        workstationId,
      );
      setNotes(prev => [saved, ...prev]);
      setActiveId(saved.id);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const saveQuick = async (e) => {
    if (e.key === 'Enter' && quickText.trim()) {
      const text = quickText.trim();
      setQuickText('');
      try {
        const saved = await dbCreateNote(
          { title: text, folder: 'Daily', tags: ['#quick'], pinned: false, body: text },
          workstationId,
        );
        setNotes(prev => [saved, ...prev]);
        setActiveId(saved.id);
      } catch (err) {
        console.error('Failed to quick-save note:', err);
      }
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
                <div className="note-reader-actions">
                  {(tab === 'preview' || tab === 'split') && (
                    <button
                      className={'btn sm' + (autoScrolling ? ' primary' : '')}
                      onClick={autoScrolling ? stopAutoScroll : startAutoScroll}
                      title={`Auto-scroll over about ${readLabel}`}>
                      <Icon name={autoScrolling ? 'pause' : 'arrow'} size={10}/>
                      {autoScrolling ? 'Stop' : `Auto scroll · ${readLabel}`}
                    </button>
                  )}
                  <div className="note-tabs">
                    <button className={tab==='edit' ? 'active' : ''} onClick={() => setTab('edit')}>EDIT</button>
                    <button className={tab==='preview' ? 'active' : ''} onClick={() => setTab('preview')}>PREVIEW</button>
                    <button className={tab==='split' ? 'active' : ''} onClick={() => setTab('split')}>SPLIT</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="note-meta">
              <span>{(note.folder || 'General').toUpperCase()}</span><span>·</span>
              <span>EDITED {(note.edited || '').toUpperCase()}</span><span>·</span>
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
                <div ref={splitPreviewRef} className="note-body note-preview" dangerouslySetInnerHTML={{ __html: renderMd(body) }} />
              </div>
            ) : tab === 'edit' ? (
              <div className="note-body">
                <textarea value={body} onChange={e => handleBodyChange(e.target.value)} />
              </div>
            ) : (
              <div ref={previewRef} className="note-body note-preview" dangerouslySetInnerHTML={{ __html: renderMd(body) }} />
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
  const [selProj, setSelProj] = useStateB(projects[0]?.id || '');
  const [selTask, setSelTask] = useStateB('');

  const projTasks = tasks.filter(t => t.proj === selProj);

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / TIME TRACKER</div>
          <h1>Time tracker</h1>
          <div className="sub">{sessions.length} sessions logged</div>
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
              <select
                value={selProj}
                onChange={e => { setSelProj(e.target.value); setSelTask(''); }}
                disabled={projects.length === 0}
              >
                {projects.length === 0
                  ? <option value="">— No projects —</option>
                  : projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select>
              <span>TASK</span>
              <select value={selTask} onChange={e => setSelTask(e.target.value)} disabled={projTasks.length === 0}>
                {projTasks.length === 0
                  ? <option value="">— No tasks —</option>
                  : projTasks.map(t => <option key={t.id} value={t.id}>{t.id} — {t.title.slice(0, 30)}</option>)}
              </select>
            </div>
          </div>
          <div className="display">{timer.display}</div>
          <div className="ctrls">
            <button className="btn" onClick={onToggle}>
              <Icon name={timer.running ? 'pause' : 'play'} size={11}/>
              {timer.running ? 'PAUSE' : 'RESUME'}
            </button>
            <button className="btn primary" disabled={!selTask}><Icon name="stop" size={11}/> STOP & LOG</button>
            <button className="btn"><Icon name="x" size={11}/> DISCARD</button>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="t">Sessions</div><span className="lbl">{sessions.length} TOTAL</span></div>
          <div className="session-log">
            {sessions.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--f-mono)' }}>
                No sessions yet. Start the timer to log time.
              </div>
            ) : sessions.map((s, i) => (
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
  const [saving, setSaving] = useStateB(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('Template name is required.'); return; }
    if (!form.body.trim()) { setErr('Template body is required.'); return; }
    const id = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString().slice(-4);
    setSaving(true);
    try {
      await onAdd({ id, cat: form.cat, name: form.name.trim(), body: form.body.trim() });
      setForm(empty);
      setErr('');
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to create template.');
    } finally {
      setSaving(false);
    }
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
        <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn primary" onClick={handleSubmit} disabled={saving || !form.name.trim() || !form.body.trim()}>
          <Icon name="plus" size={12} /> {saving ? 'Creating…' : 'Create template'}
        </button>
      </div>
    </SlidePanel>
  );
};

export const EmailPage = ({ emailTemplates, setEmailTemplates, workstationId }) => {
  const [activeId, setActiveId] = useStateB(emailTemplates[0]?.id);
  const [mode, setMode] = useStateB('fill');
  const [showAdd, setShowAdd] = useStateB(false);
  const [vals, setVals] = useStateB({});

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

  const handleAdd = async (tpl) => {
    const saved = await createEmailTemplate(tpl, workstationId);
    setEmailTemplates(prev => [...prev, saved]);
    setActiveId(saved.id);
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / EMAIL HUB</div>
          <h1>Email templates</h1>
          <div className="sub">{emailTemplates.length} template{emailTemplates.length !== 1 ? 's' : ''}</div>
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
          {emailTemplates.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 16px' }}>
              <Icon name="mail" size={28} />
              <div className="empty-title">No templates yet</div>
              <div className="empty-sub">Create reusable email templates with fill-in placeholders.</div>
              <button className="btn primary" onClick={() => setShowAdd(true)}>
                <Icon name="plus" size={12} /> New template
              </button>
            </div>
          ) : EMAIL_CATS.map(cat => {
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

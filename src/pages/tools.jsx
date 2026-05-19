// tools.jsx — Project Management, Notes, Time Tracker, Email Hub, Dev Toolkit

import React from 'react';
import { useState as useStateB, useEffect as useEffectB, useRef as useRefB } from 'react';
import { createPortal } from 'react-dom';
import { Icon, SlidePanel } from '../components/shell.jsx';
import {
  createNote as dbCreateNote, updateNote as dbUpdateNote, deleteNote as dbDeleteNote,
  restoreNote as dbRestoreNote, purgeNote as dbPurgeNote, getDeletedNotes as dbGetDeletedNotes,
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
const renderMdCore = (s) => {
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

export const renderMd = (src) => {
  if (!src) return '';
  return renderMdCore(src);
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
  const readMs = Math.max(8000, Math.round((wordCount / 220) * 60000));
  const readLabel = readMs >= 60000 ? `${Math.round(readMs / 60000)}m` : `${Math.round(readMs / 1000)}s`;
  const readMsRef = useRefB(readMs);
  readMsRef.current = readMs;

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
        const progress = Math.min(1, (now - startedAt) / readMsRef.current);
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

  // ── Focus read mode ─────────────────────────────────────────────
  const [focusMode, setFocusMode] = useStateB(false);
  const [focusFontSize, setFocusFontSize] = useStateB(15);
  const [focusProgress, setFocusProgress] = useStateB(0);
  const [focusAutoScrolling, setFocusAutoScrolling] = useStateB(false);
  const focusScrollRef = useRefB(null);
  const focusScrollFrameRef = useRefB(null);
  const focusScrollDelayRef = useRefB(null);

  const stopFocusScroll = () => {
    if (focusScrollDelayRef.current) window.clearTimeout(focusScrollDelayRef.current);
    if (focusScrollFrameRef.current) window.cancelAnimationFrame(focusScrollFrameRef.current);
    focusScrollDelayRef.current = null;
    focusScrollFrameRef.current = null;
    setFocusAutoScrolling(false);
  };

  const startFocusScroll = () => {
    const target = focusScrollRef.current;
    if (!target) return;
    stopFocusScroll();
    setFocusAutoScrolling(true);
    focusScrollDelayRef.current = window.setTimeout(() => {
      const start = target.scrollTop;
      const end = Math.max(0, target.scrollHeight - target.clientHeight);
      const distance = end - start;
      const startedAt = performance.now();
      if (distance <= 0) { setFocusAutoScrolling(false); return; }
      const tick = (now) => {
        const progress = Math.min(1, (now - startedAt) / readMsRef.current);
        target.scrollTop = start + distance * progress;
        if (progress < 1) focusScrollFrameRef.current = window.requestAnimationFrame(tick);
        else { setFocusAutoScrolling(false); focusScrollFrameRef.current = null; }
      };
      focusScrollFrameRef.current = window.requestAnimationFrame(tick);
    }, 700);
  };

  const handleFocusScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setFocusProgress(max > 0 ? Math.round((el.scrollTop / max) * 100) : 0);
  };

  useEffectB(() => {
    if (!focusMode) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [focusMode]);

  useEffectB(() => stopFocusScroll, [activeId, body, focusMode]);

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

  const [confirmDelete, setConfirmDelete] = useStateB(false);

  const deleteNote = async () => {
    if (!note) return;
    const deletingId = activeId;
    const deletedNote = notes.find(n => n.id === deletingId);
    const remaining = notes.filter(n => n.id !== deletingId);
    setNotes(remaining);
    setActiveId(remaining[0]?.id || null);
    setConfirmDelete(false);
    if (deletedNote) setTrashNotes(prev => [deletedNote, ...prev]);
    try {
      await dbDeleteNote(deletingId);
    } catch (err) {
      console.error('Failed to delete note:', err);
      setNotes(prev => [deletedNote, ...prev]);
      setTrashNotes(prev => prev.filter(n => n.id !== deletingId));
    }
  };

  // ── Trash ─────────────────────────────────────────────────────────
  const [trashOpen, setTrashOpen] = useStateB(false);
  const [trashNotes, setTrashNotes] = useStateB([]);
  const [trashLoaded, setTrashLoaded] = useStateB(false);
  const [trashLoading, setTrashLoading] = useStateB(false);

  const openTrash = async () => {
    setTrashOpen(true);
    if (trashLoaded) return;
    setTrashLoading(true);
    try {
      const deleted = await dbGetDeletedNotes(workstationId);
      setTrashNotes(deleted);
      setTrashLoaded(true);
    } catch (err) {
      console.error('Failed to load trash:', err);
    } finally {
      setTrashLoading(false);
    }
  };

  const handleRestore = async (noteId) => {
    try {
      const restored = await dbRestoreNote(noteId);
      setTrashNotes(prev => prev.filter(n => n.id !== noteId));
      setNotes(prev => [restored, ...prev]);
      setActiveId(restored.id);
    } catch (err) {
      console.error('Failed to restore note:', err);
    }
  };

  const handlePurge = async (noteId) => {
    setTrashNotes(prev => prev.filter(n => n.id !== noteId));
    try {
      await dbPurgeNote(noteId);
    } catch (err) {
      console.error('Failed to purge note:', err);
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

          {/* ── Trash ── */}
          <div className="notes-trash-section">
            <button
              className="notes-trash-toggle"
              onClick={trashOpen ? () => setTrashOpen(false) : openTrash}
            >
              <Icon name="trash" size={9}/> &nbsp;TRASH
              {trashNotes.length > 0 && <span className="notes-trash-count">{trashNotes.length}</span>}
              <Icon name="chev" size={9} style={{ marginLeft: 'auto', transform: trashOpen ? 'rotate(180deg)' : 'none' }}/>
            </button>
            {trashOpen && (
              <div className="notes-trash-list">
                {trashLoading && <div className="notes-trash-empty">Loading…</div>}
                {!trashLoading && trashNotes.length === 0 && (
                  <div className="notes-trash-empty">Trash is empty</div>
                )}
                {!trashLoading && trashNotes.map(n => (
                  <div key={n.id} className="notes-trash-item">
                    <div className="notes-trash-title">{n.title}</div>
                    <div className="notes-trash-actions">
                      <button className="btn sm" onClick={() => handleRestore(n.id)} title="Restore note">
                        <Icon name="rev" size={9}/> Restore
                      </button>
                      <button
                        className="btn sm"
                        style={{ color: '#ff3d3d', borderColor: '#ff3d3d33' }}
                        onClick={() => handlePurge(n.id)}
                        title="Delete permanently"
                      >
                        <Icon name="x" size={9}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {focusMode && note && createPortal(
          <div className="nfm-overlay">
            <div className="nfm-progress-bar">
              <div className="nfm-progress-fill" style={{ width: `${focusProgress}%` }} />
            </div>
            <div className="nfm-scroll" ref={focusScrollRef} onScroll={handleFocusScroll}>
              <div className="nfm-inner" style={{ fontSize: focusFontSize }}>
                <div className="nfm-header">
                  <h1 className="nfm-title">{title}</h1>
                  <div className="nfm-meta">
                    <span>{(note.folder || 'General').toUpperCase()}</span>
                    <span>·</span>
                    <span>{wordCount} WORDS</span>
                    <span>·</span>
                    <span>{readLabel} READ</span>
                    {note.tags.length > 0 && (
                      <>{note.tags.map(t => <span key={t} className="tag" style={{ color: 'var(--accent-hi)', borderColor: 'var(--accent-tint-2)' }}>{t}</span>)}</>
                    )}
                    {note.pinned && <span className="tag" style={{ color: '#fbbf24' }}><Icon name="pin" size={9}/> PINNED</span>}
                  </div>
                </div>
                <div className="note-preview nfm-body" dangerouslySetInnerHTML={{ __html: renderMd(body) }} />
              </div>
            </div>
            <div className="nfm-bar">
              <div className="nfm-bar-l">
                <button
                  className={'btn sm' + (focusAutoScrolling ? ' primary' : '')}
                  onClick={focusAutoScrolling ? stopFocusScroll : startFocusScroll}
                  title={`Auto-scroll over about ${readLabel}`}
                >
                  <Icon name={focusAutoScrolling ? 'pause' : 'arrow'} size={10}/>
                  {focusAutoScrolling ? 'Pause' : `Auto scroll · ${readLabel}`}
                </button>
                <button className="btn sm" onClick={() => setFocusFontSize(s => Math.max(12, s - 1))} title="Decrease font size">A−</button>
                <button className="btn sm" onClick={() => setFocusFontSize(s => Math.min(22, s + 1))} title="Increase font size">A+</button>
              </div>
              <div className="nfm-bar-c">
                <span>{focusProgress}%</span>
                <span>·</span>
                <span>{wordCount} words</span>
                <span>·</span>
                <span>{readLabel} read</span>
              </div>
              <div className="nfm-bar-r">
                <button className="btn sm" onClick={() => setFocusMode(false)} title="Exit focus mode (Esc)">
                  <Icon name="x" size={10}/> Exit Focus
                </button>
              </div>
            </div>
          </div>
        , document.body)}

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
                {confirmDelete ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)' }}>Delete?</span>
                    <button className="btn sm" style={{ color: '#ff3d3d', borderColor: '#ff3d3d33' }} onClick={deleteNote}>
                      <Icon name="check" size={10}/> Yes
                    </button>
                    <button className="btn sm" onClick={() => setConfirmDelete(false)}>
                      <Icon name="x" size={10}/> No
                    </button>
                  </div>
                ) : (
                  <button className="btn sm" style={{ color: 'var(--text-3)' }} onClick={() => setConfirmDelete(true)} title="Delete note">
                    <Icon name="trash" size={10}/>
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
                  <button className="btn sm" onClick={() => { setTab('preview'); setFocusMode(true); setFocusProgress(0); }} title="Focus read mode — distraction-free (Esc to exit)">
                    <Icon name="eye" size={10}/> Focus
                  </button>
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
// ── Time formatting helpers ──────────────────────────────────────
const fmtDur = (sec) => {
  if (!sec || sec < 1) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtClock = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const fmtTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const fmtDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const EVENT_META = {
  start:    { icon: 'play',         color: '#22c55e', label: 'Started'   },
  pause:    { icon: 'pause',        color: '#f59e0b', label: 'Paused'    },
  resume:   { icon: 'rev',          color: '#0099ff', label: 'Resumed'   },
  complete: { icon: 'check-circle', color: '#22c55e', label: 'Completed' },
  discard:  { icon: 'trash',        color: '#ef4444', label: 'Discarded' },
};

export const TimerPage = ({
  timer, projects, tasks, statuses = [], timeEntries = [],
  onTimerStart, onTimerPause, onTimerResume, onTimerStop, onTimerDiscard,
}) => {
  const { status, activeEntry } = timer;

  // Selectors (only meaningful when idle)
  const [selProjDbId,    setSelProjDbId]    = useStateB('');
  const [selTaskDbId,    setSelTaskDbId]    = useStateB('');
  const [notes,          setNotes]          = useStateB('');
  const [busy,           setBusy]           = useStateB(false);
  const [err,            setErr]            = useStateB('');
  const [expandedEntry,  setExpandedEntry]  = useStateB(null);

  // Seed selector with first project on mount
  useEffectB(() => {
    if (projects.length > 0 && !selProjDbId) setSelProjDbId(projects[0]._dbId || '');
  }, [projects]);

  // Only tasks with "In Progress" status are trackable
  const inProgressStatusId = statuses.find(s => s.key === 'progress')?.id;
  const selProj       = projects.find(p => p._dbId === selProjDbId);
  const projTasks     = tasks.filter(t => selProj && t.proj === selProj.id && !t.parentId);
  const trackableTasks = projTasks.filter(t => t.col === inProgressStatusId);

  // ── Stats ──────────────────────────────────────────────────────
  const today       = todayIso();
  const todayEntries = timeEntries.filter(e =>
    e.status === 'completed' && (e.startedAt || '').slice(0, 10) === today
  );
  const todaySec = todayEntries.reduce((a, e) => a + e.totalSeconds, 0);

  // Per-project totals (completed, today)
  const projMap = {};
  todayEntries.forEach(e => {
    projMap[e.projectShort] = (projMap[e.projectShort] || 0) + e.totalSeconds;
  });
  const projStats = Object.entries(projMap)
    .sort((a, b) => b[1] - a[1])
    .map(([short, sec]) => ({ short, sec }));
  const maxProjSec = projStats[0]?.sec || 1;

  // All-time total
  const allTimeSec = timeEntries
    .filter(e => e.status === 'completed')
    .reduce((a, e) => a + e.totalSeconds, 0);

  // ── Handlers ───────────────────────────────────────────────────
  const wrap = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); }
    catch (e) { setErr(e.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  const handleStart = () => wrap(async () => {
    if (!selProjDbId) throw new Error('Select a project first.');
    await onTimerStart(selProjDbId, selTaskDbId || null);
  });

  const handlePause   = () => wrap(() => onTimerPause());
  const handleResume  = () => wrap(() => onTimerResume());
  const handleStop    = () => wrap(async () => { await onTimerStop(notes); setNotes(''); });
  const handleDiscard = () => wrap(async () => {
    if (!window.confirm('Discard this session? All time will be lost.')) return;
    await onTimerDiscard();
    setNotes('');
  });

  // ── CSV export ─────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [['ID','Project','Task','Status','Started','Ended','Duration (s)','Notes']];
    timeEntries.forEach(e => rows.push([
      e.id, e.projectShort, e.taskShort || '', e.status,
      e.startedAt || '', e.endedAt || '', e.totalSeconds, e.notes,
    ]));
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'time-entries.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────
  const isIdle    = status === 'idle';
  const isRunning = status === 'running';
  const isPaused  = status === 'paused';
  const hasActive = !isIdle;

  const displaySec = (activeEntry?.totalSeconds || 0) + (isRunning ? 0 : 0); // ticked in App
  // timer.display already has the formatted time from App.jsx

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / TIME TRACKER</div>
          <h1>Time Tracker</h1>
          <div className="sub">
            {timeEntries.filter(e => e.status === 'completed').length} entries ·{' '}
            {fmtDur(allTimeSec)} total · {fmtDur(todaySec)} today
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={handleExport}>
            <Icon name="download" size={12}/> Export CSV
          </button>
        </div>
      </div>

      <div className="timer-page">

        {/* ── LEFT: Timer card ───────────────────────────────── */}
        <div className="timer-main-col">

          {/* Big timer */}
          <div className={'timer-big' + (isRunning ? ' running' : isPaused ? ' paused' : '')}>
            <div className="ctx">
              <div className="label-mono" style={{ letterSpacing: '0.12em', color: isRunning ? 'var(--accent-hi)' : isPaused ? '#f59e0b' : 'var(--text-3)' }}>
                {isRunning ? '● RUNNING' : isPaused ? '⏸ PAUSED' : 'IDLE'}
              </div>

              {/* Context label when active */}
              {hasActive && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--f-mono)' }}>
                  {activeEntry.projectShort}
                  {activeEntry.taskShort && <span style={{ color: 'var(--text-3)' }}> / {activeEntry.taskShort}</span>}
                  {activeEntry.taskTitle && <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>— {activeEntry.taskTitle.slice(0, 40)}</span>}
                </div>
              )}

              {/* Selectors — only shown when idle */}
              {isIdle && (
                <div className="lnk" style={{ marginTop: 12 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)' }}>PROJECT</span>
                  <select
                    value={selProjDbId}
                    onChange={e => { setSelProjDbId(e.target.value); setSelTaskDbId(''); }}
                    disabled={projects.length === 0}
                    style={{ marginBottom: 8 }}
                  >
                    {projects.length === 0
                      ? <option value="">— No projects —</option>
                      : projects.map(p => <option key={p._dbId} value={p._dbId}>{p.id} — {p.name}</option>)
                    }
                  </select>
                  <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)' }}>
                    TASK <span style={{ fontWeight: 400 }}>(In Progress only)</span>
                  </span>
                  <select
                    value={selTaskDbId}
                    onChange={e => setSelTaskDbId(e.target.value)}
                    disabled={trackableTasks.length === 0}
                  >
                    {trackableTasks.length === 0
                      ? <option value="">— Move a task to In Progress first —</option>
                      : <><option value="">— No task (project-level) —</option>
                         {trackableTasks.map(t => <option key={t._dbId} value={t._dbId}>{t.id} — {t.title.slice(0, 36)}</option>)}</>
                    }
                  </select>
                  {selProj && projTasks.length > 0 && trackableTasks.length === 0 && (
                    <div style={{ fontSize: 10, color: '#f59e0b', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
                      No In Progress tasks for this project — set a task status to "In Progress" in the Tasks board first.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Big clock display */}
            <div className="display">{timer.display}</div>

            {/* Notes field when active */}
            {hasActive && (
              <div style={{ padding: '0 24px', width: '100%', boxSizing: 'border-box' }}>
                <input
                  className="tpanel-input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Session notes (optional)…"
                  style={{ width: '100%', fontSize: 12 }}
                />
              </div>
            )}

            {err && (
              <div style={{ padding: '0 24px', fontSize: 12, color: '#ef4444', fontFamily: 'var(--f-mono)' }}>{err}</div>
            )}

            {/* Controls */}
            <div className="ctrls">
              {isIdle && (
                <button className="btn primary" onClick={handleStart} disabled={busy || !selProjDbId}>
                  <Icon name="play" size={12}/> START
                </button>
              )}
              {isRunning && (
                <button className="btn" onClick={handlePause} disabled={busy}>
                  <Icon name="pause" size={12}/> PAUSE
                </button>
              )}
              {isPaused && (
                <button className="btn primary" onClick={handleResume} disabled={busy}>
                  <Icon name="play" size={12}/> RESUME
                </button>
              )}
              {hasActive && (<>
                <button className="btn" style={{ borderColor: '#22c55e', color: '#22c55e' }} onClick={handleStop} disabled={busy}>
                  <Icon name="check-circle" size={12}/> STOP & LOG
                </button>
                <button className="btn ghost" onClick={handleDiscard} disabled={busy} style={{ color: '#ef4444' }}>
                  <Icon name="trash" size={12}/> DISCARD
                </button>
              </>)}
            </div>
          </div>

          {/* Event log for active entry */}
          {hasActive && activeEntry.events.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="t">Event Log</div>
                <span className="lbl">CURRENT SESSION</span>
              </div>
              <div className="card-pad">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activeEntry.events.map((ev, i) => {
                    const meta = EVENT_META[ev.event] || { icon: 'activity', color: 'var(--text-3)', label: ev.event };
                    return (
                      <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < activeEntry.events.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: meta.color + '18', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <Icon name={meta.icon} size={13} style={{ color: meta.color }}/>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500 }}>{meta.label}</div>
                          {ev.elapsed > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>
                              +{fmtDur(ev.elapsed)}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)', flexShrink: 0 }}>
                          {fmtTime(ev.at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Stats + Project breakdown ───────────────── */}
        <div className="timer-side-col">

          {/* Today summary */}
          <div className="card">
            <div className="card-h">
              <div className="t">Today</div>
              <span className="lbl">{fmtDur(todaySec)}</span>
            </div>
            <div className="card-pad">
              {projStats.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--f-mono)', textAlign: 'center', padding: '12px 0' }}>
                  No sessions today
                </div>
              ) : projStats.map(({ short, sec }) => (
                <div key={short} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-2)' }}>{short}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-3)' }}>{fmtDur(sec)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent-hi)', borderRadius: 2, width: `${Math.round(sec / maxProjSec * 100)}%`, transition: 'width 0.4s' }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="card">
            <div className="card-h"><div className="t">All-time</div></div>
            <div className="card-pad">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Total logged', value: fmtDur(allTimeSec) },
                  { label: 'Entries',      value: timeEntries.filter(e => e.status === 'completed').length },
                  { label: 'Projects',     value: new Set(timeEntries.map(e => e.projectShort)).size },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--f-mono)', color: 'var(--text-1)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Entries table ──────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <div className="t">Entry History</div>
          <span className="lbl">{timeEntries.filter(e => e.status === 'completed').length} COMPLETED</span>
        </div>
        <div className="session-log">
          {timeEntries.filter(e => e.status === 'completed').length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--f-mono)' }}>
              No entries yet — start the timer to log time.
            </div>
          ) : timeEntries.filter(e => e.status === 'completed').map(e => {
            const isOpen = expandedEntry === e.id;
            return (
              <div key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Main row — click to toggle events */}
                <div
                  className="session-row"
                  style={{ gap: 12, cursor: 'pointer', borderBottom: 'none' }}
                  onClick={() => setExpandedEntry(isOpen ? null : e.id)}
                >
                  {/* Chevron + event count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, width: 36 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: 'var(--text-3)', transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                      <polyline points="3,2 7,5 3,8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)', color: 'var(--text-3)' }}>
                      {e.events.length}
                    </span>
                  </div>

                  <div className="name" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.taskTitle || <span style={{ color: 'var(--text-3)' }}>No task</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
                      {e.projectShort}{e.taskShort ? ' / ' + e.taskShort : ''}
                    </div>
                    {e.notes && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.notes}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-2)' }}>
                      {fmtTime(e.startedAt)} → {fmtTime(e.endedAt)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{fmtDate(e.startedAt)}</div>
                  </div>

                  <span className="dur" style={{ flexShrink: 0, minWidth: 48, textAlign: 'right', fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--accent-hi)' }}>
                    {fmtDur(e.totalSeconds)}
                  </span>
                </div>

                {/* Expandable events */}
                {isOpen && (
                  <div style={{ padding: '0 16px 12px 52px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {e.events.slice().reverse().map((ev, i) => {
                      const meta = EVENT_META[ev.event] || { color: 'var(--text-3)', label: ev.event };
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 70 }}>{meta.label}</span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-3)' }}>{fmtTime(ev.at)}</span>
                          {ev.elapsed > 0 && (
                            <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--accent-hi)', marginLeft: 'auto' }}>
                              +{fmtDur(ev.elapsed)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
export const ToolkitPage = ({ onNav }) => {
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

      {onNav && (
        <div className="toolkit-featured" onClick={() => onNav('flutter-init')}>
          <div className="toolkit-featured-ic"><Icon name="flame" size={18}/></div>
          <div className="toolkit-featured-body">
            <div className="toolkit-featured-name">Flutter Project Generator</div>
            <div className="toolkit-featured-desc">Scaffold a full Flutter project — pick your packages, architecture, and platforms. Generates a ready-to-use ZIP.</div>
          </div>
          <div className="toolkit-featured-cta">
            Open wizard <Icon name="arrow" size={13}/>
          </div>
        </div>
      )}

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

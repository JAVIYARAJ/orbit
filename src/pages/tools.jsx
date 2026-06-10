// tools.jsx — Project Management, Notes, Time Tracker, Email Hub

import React from 'react';
import { useState as useStateB, useEffect as useEffectB, useRef as useRefB } from 'react';
import DOMPurify from 'dompurify';
import { createPortal } from 'react-dom';
import { Icon, SlidePanel } from '../components/shell.jsx';
import {
  createNote as dbCreateNote, updateNote as dbUpdateNote, deleteNote as dbDeleteNote,
  restoreNote as dbRestoreNote, purgeNote as dbPurgeNote, getDeletedNotes as dbGetDeletedNotes,
  createNoteFolder as dbCreateNoteFolder, renameNoteFolder as dbRenameNoteFolder,
  deleteNoteFolder as dbDeleteNoteFolder, reorderNoteFolders as dbReorderNoteFolders,
  createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  createGanttTask, updateGanttTask, deleteGanttTask,
} from '../lib/db.js';

// ═══════════════════════════════════════════════════════════════════
//  6. PROJECT MANAGEMENT — Gantt + Health + Tasks
// ═══════════════════════════════════════════════════════════════════

const GANTT_STATUSES = ['planning', 'active', 'review', 'done', 'milestone'];
const fmtHrsPm = (h) => {
  const n = Number(h) || 0;
  if (n < 0.017) return '0m';
  const totalMins = Math.round(n * 60);
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
};

const GanttModal = ({ task, onClose, onSave, saving, err }) => {
  const [form, setForm] = useStateB(task);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)', width: 460, maxWidth: 'calc(100% - 32px)', borderRadius: 4, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 600, fontSize: 14, userSelect: 'none' }}>{task.id ? 'Edit timeline task' : 'Add timeline task'}</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', padding: '4px', borderRadius: 4, display: 'flex', alignItems: 'center',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}>
            <Icon name="x" size={14}/>
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="fld">
            <label>Task name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Backend API" autoFocus />
          </div>
          <div className="fld">
            <label>Subtitle <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>optional</span></label>
            <input value={form.sub} onChange={e => set('sub', e.target.value)} placeholder="e.g. REST endpoints" />
          </div>
          <div className="fld-row">
            <div className="fld">
              <label>Start week</label>
              <input type="number" min={1} max={12} value={form.startWeek}
                onChange={e => set('startWeek', Math.max(1, Math.min(12, +e.target.value)))} />
            </div>
            <div className="fld">
              <label>End week</label>
              <input type="number" min={1} max={12} value={form.endWeek}
                onChange={e => set('endWeek', Math.max(1, Math.min(12, +e.target.value)))} />
            </div>
          </div>
          <div className="fld">
            <label>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              {GANTT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          {err && <div style={{ color: '#ef4444', fontSize: 12 }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProjectMgmtPage = ({ projects, ganttTasks, setGanttTasks, tasks, statuses, priorities = [], onNav, workstationId }) => {
  const [selId,      setSelId]      = useStateB(projects[0]?.id || '');
  const [editGantt,  setEditGantt]  = useStateB(null);
  const [confirmDel, setConfirmDel] = useStateB(null);
  const [saving,     setSaving]     = useStateB(false);
  const [err,        setErr]        = useStateB('');
  const [taskFilter, setTaskFilter] = useStateB('open');

  const proj       = projects.find(p => p.id === selId) || projects[0] || null;
  const statusMap  = Object.fromEntries((statuses || []).map(s => [s.id, s]));
  const projGantt  = (ganttTasks || []).filter(t => t.projectId === proj?._dbId);
  const allTasks   = (tasks || []).filter(t => t.proj === proj?.id);
  const shownTasks = taskFilter === 'all'  ? allTasks
                   : taskFilter === 'open' ? allTasks.filter(t => !statusMap[t.col]?.isDone)
                   : allTasks.filter(t => statusMap[t.col]?.isDone);

  const openCount  = allTasks.filter(t => !statusMap[t.col]?.isDone).length;
  const burnPct    = proj?.hoursEst > 0 ? Math.round((proj.hoursLogged / proj.hoursEst) * 100) : 0;
  const remaining  = Math.max(0, (proj?.hoursEst || 0) - (proj?.hoursLogged || 0));
  const WEEKS      = Array.from({ length: 12 }, (_, i) => i + 1);

  // ── Gantt drag-to-resize / move ──────────────────────────────────
  const ganttRef       = useRefB(null);
  const dragStateRef   = useRefB(null);   // { taskId, type, startX, origStart, origEnd, task }
  const dragPreviewRef = useRefB(null);   // { taskId, start, end }
  const [dragPreview,  setDragPreview]  = useStateB(null);

  const startGanttDrag = (e, task, type) => {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current   = { taskId: task.id, type, startX: e.clientX, origStart: task.start, origEnd: task.end, task };
    dragPreviewRef.current = { taskId: task.id, start: task.start, end: task.end };
    setDragPreview({ taskId: task.id, start: task.start, end: task.end });
    document.body.style.userSelect = 'none';
    document.body.style.cursor     = type === 'move' ? 'grabbing' : 'ew-resize';
  };

  useEffectB(() => {
    const onMove = (e) => {
      if (!dragStateRef.current || !ganttRef.current) return;
      const { taskId, type, startX, origStart, origEnd } = dragStateRef.current;
      const totalWidth = ganttRef.current.offsetWidth;
      const colWidth   = (totalWidth - 200) / 12;
      const delta      = Math.round((e.clientX - startX) / colWidth);
      const duration   = origEnd - origStart;
      let newStart = origStart, newEnd = origEnd;
      if (type === 'move') {
        newStart = Math.max(1, Math.min(12 - duration, origStart + delta));
        newEnd   = newStart + duration;
      } else if (type === 'left') {
        newStart = Math.max(1, Math.min(origEnd, origStart + delta));
      } else {
        newEnd = Math.max(origStart, Math.min(12, origEnd + delta));
      }
      const preview = { taskId, start: newStart, end: newEnd };
      dragPreviewRef.current = preview;
      setDragPreview(preview);
    };

    const onUp = async () => {
      if (!dragStateRef.current) return;
      const { task }   = dragStateRef.current;
      const preview    = dragPreviewRef.current;
      dragStateRef.current   = null;
      dragPreviewRef.current = null;
      setDragPreview(null);
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
      if (preview && (preview.start !== task.start || preview.end !== task.end)) {
        try {
          const updated = await updateGanttTask(task.id, task.name, task.sub || '', preview.start, preview.end, task.status);
          setGanttTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        } catch (e) { console.error('Gantt drag save failed:', e); }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, []);

  const handleSave = async (form) => {
    if (!form.name?.trim()) { setErr('Task name is required'); return; }
    if (form.startWeek > form.endWeek) { setErr('Start week must be ≤ end week'); return; }
    setSaving(true); setErr('');
    try {
      if (form.id) {
        const updated = await updateGanttTask(form.id, form.name, form.sub || '', form.startWeek, form.endWeek, form.status);
        setGanttTasks(prev => prev.map(t => t.id === form.id ? updated : t));
      } else {
        const created = await createGanttTask(workstationId, proj._dbId, form.name, form.sub || '', form.startWeek, form.endWeek, form.status);
        setGanttTasks(prev => [...prev, created]);
      }
      setEditGantt(null);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteGanttTask(confirmDel);
      setGanttTasks(prev => prev.filter(t => t.id !== confirmDel));
      setConfirmDel(null);
    } catch (e) { console.error(e); }
  };

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

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE / PROJECT MGMT / {proj.id}</div>
          <h1 style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            {proj.name}
            <span className="num" style={{ fontSize: 14, color: 'var(--text-3)' }}>{proj.id}</span>
          </h1>
          <div className="sub">{[proj.client, proj.type, proj.start && `${proj.start} → ${proj.end || '—'}`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="actions">
          {projects.length > 1 && (
            <select className="pm-proj-select" value={selId} onChange={e => setSelId(e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="pm-layout">
        <div style={{ minWidth: 0 }}>
          {/* ── Timeline / Gantt ── */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-h">
              <div className="t">Timeline · 12 weeks</div>
              <div className="pm-gantt-legend">
                {[['var(--accent)','ACTIVE'],['rgba(22,163,74,0.6)','DONE'],['rgba(217,119,6,0.6)','REVIEW']].map(([c,l]) => (
                  <span key={l} className="pm-gantt-legend-item">
                    <span className="pm-gantt-legend-dot" style={{ background: c }}></span>{l}
                  </span>
                ))}
                <button className="btn" style={{ fontSize: 11 }}
                  onClick={() => { setErr(''); setEditGantt({ name: '', sub: '', startWeek: 1, endWeek: 4, status: 'planning' }); }}>
                  <Icon name="plus" size={11}/> Add task
                </button>
              </div>
            </div>
            <div className="gantt" ref={ganttRef}>
              <div className="gantt-h">
                <div className="cell">TASK</div>
                {WEEKS.map(w => <div key={w} className="cell">W{w}</div>)}
              </div>
              {projGantt.length === 0 ? (
                <div className="pm-empty">No timeline tasks yet — click "Add task" to create one.</div>
              ) : projGantt.map((t, idx) => {
                const startPct = ((t.start - 1) / 12) * 100;
                const widthPct = ((t.end - t.start + 1) / 12) * 100;
                const btnBase = {
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '3px 4px', borderRadius: 3, display: 'flex', alignItems: 'center',
                  color: 'var(--text-3)', opacity: 0.5, transition: 'opacity 0.15s, color 0.15s',
                };
                const actions = (
                  <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                    <button title="Edit" style={btnBase}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-3)'; }}
                      onClick={() => { setErr(''); setEditGantt({ id: t.id, name: t.name, sub: t.sub || '', startWeek: t.start, endWeek: t.end, status: t.status }); }}>
                      <Icon name="edit" size={11}/>
                    </button>
                    <button title="Delete" style={btnBase}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-3)'; }}
                      onClick={() => setConfirmDel(t.id)}>
                      <Icon name="trash" size={11}/>
                    </button>
                  </div>
                );
                const clamp2 = {
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', wordBreak: 'break-word',
                };
                if (t.status === 'milestone') return (
                  <div key={t.id || idx} className="gantt-row">
                    <div className="name" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent-hi)', ...clamp2 }}>◆ {t.name}</div>
                        {t.sub && <div className="sub">{t.sub}</div>}
                      </div>
                      {actions}
                    </div>
                    {WEEKS.map(w => <div key={w} className="week"></div>)}
                    <div className="gantt-bar milestone"
                      style={{ left: `calc(200px + ${startPct} * (100% - 200px) / 100 - 11px)` }} title={t.name}>
                      <Icon name="flame" size={12} />
                    </div>
                  </div>
                );
                const isDragging = dragPreview?.taskId === t.id;
                const effStart   = isDragging ? dragPreview.start : t.start;
                const effEnd     = isDragging ? dragPreview.end   : t.end;
                const barLeft    = ((effStart - 1) / 12) * 100;
                const barWidth   = ((effEnd - effStart + 1) / 12) * 100;
                const handle = (type) => (
                  <div
                    onMouseDown={(e) => startGanttDrag(e, t, type)}
                    style={{ width: 8, height: '100%', cursor: 'ew-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <div style={{ width: 2, height: 10, background: 'rgba(255,255,255,0.35)', borderRadius: 1 }} />
                  </div>
                );
                return (
                  <div key={t.id || idx} className="gantt-row">
                    <div className="name" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={clamp2}>{t.name}</div>
                        {t.sub && <div className="sub">{t.sub}</div>}
                      </div>
                      {actions}
                    </div>
                    {WEEKS.map(w => <div key={w} className="week"></div>)}
                    <div className={'gantt-bar ' + t.status} style={{
                      left:    `calc(200px + ${barLeft} * (100% - 200px) / 100)`,
                      width:   `calc(${barWidth} * (100% - 200px) / 100)`,
                      overflow: 'hidden',
                      padding:  0,
                      display:  'flex',
                      opacity:  isDragging ? 0.8 : 1,
                      boxShadow: isDragging ? '0 0 0 2px var(--accent-hi)' : undefined,
                    }} title={t.name}>
                      {handle('left')}
                      <div
                        onMouseDown={(e) => startGanttDrag(e, t, 'move')}
                        style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', cursor: isDragging ? 'grabbing' : 'grab', minWidth: 0, padding: '0 4px' }}
                      >
                        <span style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{t.name}</span>
                      </div>
                      {handle('right')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Project Tasks ── */}
          <div className="card">
            <div className="card-h">
              <div className="t">
                Tasks
                <span className="num" style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 6 }}>{allTasks.length}</span>
              </div>
              <div className="pm-task-actions">
                <div className="pm-task-filters">
                  {['all','open','done'].map(f => (
                    <button key={f} className={'btn' + (taskFilter === f ? ' primary' : '')}
                      style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setTaskFilter(f)}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button className="btn" style={{ fontSize: 11 }} onClick={() => onNav('tasks')}>
                  <Icon name="plus" size={11}/> New task
                </button>
              </div>
            </div>
            {shownTasks.length === 0 ? (
              <div className="pm-empty">
                {allTasks.length === 0 ? 'No tasks in this project yet.' : `No ${taskFilter} tasks.`}
              </div>
            ) : shownTasks.map(t => {
              const st = statusMap[t.col];
              return (
                <div key={t._dbId} className="pm-task-row" onClick={() => onNav('tasks')}>
                  {(() => { const pr = priorities.find(p => p.id === t.p); return <span className="pm-task-dot" style={{ background: pr ? pr.color : 'var(--text-4)' }} />; })()}
                  <span className="pm-task-title">{t.title}</span>
                  <span className="pm-task-id">{t.id}</span>
                  {st && (
                    <span className="pm-task-status" style={{ background: st.color + '22', color: st.color, border: `1px solid ${st.color}44` }}>
                      {st.label}
                    </span>
                  )}
                  {t.due && t.due !== '—' && (
                    <span className="pm-task-due">{t.due}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pm-side">
          {/* ── Health ── */}
          <div className="card">
            <div className="card-h">
              <div className="t">Health</div>
              <span className={'pill ' + proj.status}><span className="d"></span>{proj.status.toUpperCase()}</span>
            </div>
            <div className="health-grid">
              <div className="cell"><div className="l">Progress</div><div className="v ok">{proj.progress}%</div></div>
              <div className="cell"><div className="l">Open tasks</div><div className="v">{openCount}</div></div>
              <div className="cell"><div className="l">Burned</div><div className="v">{fmtHrsPm(proj.hoursLogged)}</div></div>
              <div className="cell"><div className="l">Remaining</div><div className="v">{fmtHrsPm(remaining)}</div></div>
            </div>
            {proj.hoursEst > 0 && (
              <div className="pm-hours">
                <div className="pm-hours-label">
                  HOURS — {fmtHrsPm(proj.hoursLogged)} / {fmtHrsPm(proj.hoursEst)}
                </div>
                <div className="prog" style={{ height: 8 }}>
                  <div className="fill" style={{
                    width: Math.min(100, burnPct) + '%',
                    background: burnPct > 90 ? '#ef4444' : burnPct > 70 ? '#d97706' : 'var(--accent)',
                  }}></div>
                </div>
                <div className="pm-hours-meta">
                  <span>{fmtHrsPm(proj.hoursLogged)} burned</span>
                  <span style={{ color: burnPct > 90 ? '#ef4444' : burnPct > 70 ? '#d97706' : 'var(--text-2)' }}>{burnPct}%</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Details ── */}
          <div className="card">
            <div className="card-h"><div className="t">Details</div></div>
            <div className="pm-detail-body">
              {[
                ['Client', proj.client || '—'],
                ['Type',   proj.type   || '—'],
                ['Start',  proj.start  || '—'],
                ['End',    proj.end    || '—'],
                ['Budget', proj.budget || '—'],
              ].map(([l, v]) => (
                <div key={l} className="pm-detail-row">
                  <span className="pm-detail-label">{l}</span>
                  <span className="pm-detail-value">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tech ── */}
          {(proj.stack?.length > 0 || (proj.repo && proj.repo !== '—')) && (
            <div className="card">
              <div className="card-h"><div className="t">Tech</div></div>
              <div className="pm-detail-body">
                {proj.stack?.length > 0 && (
                  <div className="pm-detail-row" style={{ alignItems: 'flex-start' }}>
                    <span className="pm-detail-label">Stack</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {proj.stack.map(s => <span key={s} className="tag">{s}</span>)}
                    </div>
                  </div>
                )}
                {proj.repo && proj.repo !== '—' && (
                  <div className="pm-detail-row">
                    <span className="pm-detail-label">Repo</span>
                    <a href={`https://github.com/${proj.repo}`} target="_blank" rel="noreferrer"
                      style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--accent-hi)', wordBreak: 'break-all', textDecoration: 'none', textAlign: 'right' }}>
                      ↗ {proj.repo}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit modal ── */}
      {editGantt && (
        <GanttModal
          task={editGantt}
          onClose={() => setEditGantt(null)}
          onSave={handleSave}
          saving={saving}
          err={err}
        />
      )}

      {/* ── Delete confirm ── */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setConfirmDel(null)}>
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)', width: 360, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', borderRadius: 4 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>Delete timeline task?</div>
            <div style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-2)' }}>This will permanently remove the task from the timeline.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
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
  return DOMPurify.sanitize(renderMdCore(src), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  });
};

const NoteLinkMenu = ({ items, index, onSelect }) => (
  <div className="note-link-menu">
    <div className="note-link-hint">↑↓ navigate · Enter select · Esc cancel</div>
    {items.map((n, i) => (
      <button
        key={n.id}
        className={'note-link-item' + (i === index ? ' active' : '')}
        onMouseDown={e => { e.preventDefault(); onSelect(n); }}
      >
        <Icon name="note" size={11}/>
        <span className="note-link-title">{n.title}</span>
        <span className="note-link-folder">{n.folderName}</span>
      </button>
    ))}
  </div>
);

export const NotesPage = ({ notes, setNotes, noteFolders, setNoteFolders, workstationId, jumpToItem }) => {
  const [activeId, setActiveId] = useStateB(notes[0]?.id);
  const [tab, setTab] = useStateB('edit');
  const [q, setQ] = useStateB('');
  const [quickText, setQuickText] = useStateB('');
  // Mobile drill-down: which single pane is shown at ≤768px. Ignored on desktop
  // (all three panes always render there). 'folders' | 'list' | 'editor'.
  const [mobileView, setMobileView] = useStateB('folders');

  // ── Folder state ────────────────────────────────────────────────
  // activeFolderId: null = All Notes, string uuid = specific folder
  const [activeFolderId, setActiveFolderId] = useStateB(null);
  const [newFolderName, setNewFolderName] = useStateB('');
  const [showNewFolder, setShowNewFolder] = useStateB(false);
  const [movingFolder, setMovingFolder] = useStateB(false);
  // Rename state: { id, name } of folder being renamed (double-click to activate)
  const [renamingFolder, setRenamingFolder] = useStateB(null);
  const [renameValue, setRenameValue] = useStateB('');
  // Folder reorder — pointer-event drag
  const foldersContainerRef = useRefB(null);
  const folderDragRef       = useRefB(null);
  const [folderDrag,     setFolderDragState] = useStateB(null);
  // { id, fromIndex, toIndex, ghostY, rects, containerRect }
  const setFolderDrag = (v) => { folderDragRef.current = v; setFolderDragState(v); };
  // Note→folder drop highlight (HTML5 drag-and-drop)
  const [noteDragOverId, setNoteDragOverId] = useStateB(null);
  const [autoScrolling, setAutoScrolling] = useStateB(false);
  const previewRef = useRefB(null);
  const splitPreviewRef = useRefB(null);
  const scrollFrameRef = useRefB(null);
  const scrollDelayRef = useRefB(null);

  // ── Auto-save / keyboard shortcuts / export ──────────────────────
  const [sortBy, setSortBy] = useStateB('newest');
  const [copied, setCopied] = useStateB(false);
  const autoSaveRef    = useRefB(null);
  const pendingSaveRef = useRefB(null);
  const titleRef       = useRefB('');
  const bodyRef        = useRefB('');
  const searchRef      = useRefB(null);
  const textareaRef    = useRefB(null);

  // ── Note linking [[ ──────────────────────────────────────────────
  const [linkMenu,  setLinkMenu]  = useStateB(null); // null | { query }
  const [linkIndex, setLinkIndex] = useStateB(0);
  const [editorDragOver, setEditorDragOver] = useStateB(false);

  const note = notes.find(n => n.id === activeId) || notes[0];
  const [body, setBody] = useStateB(note?.body || '');
  const [title, setTitle] = useStateB(note?.title || '');
  const [saved, setSaved] = useStateB(true);

  useEffectB(() => {
    // Flush any pending auto-save for the note we're leaving
    const snap = pendingSaveRef.current;
    if (snap) {
      if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null; }
      pendingSaveRef.current = null;
      setNotes(prev => {
        const n = prev.find(x => x.id === snap.id);
        if (!n) return prev;
        dbUpdateNote({ id: snap.id, title: snap.title, body: snap.body, folderId: n.folderId, tags: n.tags, pinned: n.pinned })
          .then(updated => setNotes(p => p.map(x => x.id === snap.id ? updated : x)))
          .catch(console.error);
        return prev.map(x => x.id === snap.id ? { ...x, title: snap.title, body: snap.body, edited: 'Just now' } : x);
      });
    }
    if (!note) return;
    setBody(note.body);
    setTitle(note.title);
    bodyRef.current  = note.body;
    titleRef.current = note.title;
    setSaved(true);
  }, [activeId]);

  // Jump to a note from global search
  useEffectB(() => {
    if (!jumpToItem || jumpToItem.page !== 'notes') return;
    const target = notes.find(n => n.id === jumpToItem.id);
    if (target) {
      setActiveFolderId(target.folderId || null);
      setActiveId(target.id);
      setMobileView('editor');
    }
  }, [jumpToItem?.ts]);

  // Split (side-by-side) view doesn't fit phones — force it to plain edit at
  // ≤768px and keep it coerced if the viewport is resized down.
  useEffectB(() => {
    const sync = () => { if (window.innerWidth <= 768) setTab(t => (t === 'split' ? 'edit' : t)); };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const handleBodyChange = (val, cursor) => {
    setBody(val); bodyRef.current = val; setSaved(false);
    pendingSaveRef.current = { id: activeId, title: titleRef.current, body: val };
    triggerAutoSave();
    if (cursor !== undefined) {
      const match = val.slice(0, cursor).match(/\[\[([^\][\n]*)$/);
      setLinkMenu(match ? { query: match[1] } : null);
      if (!match) setLinkIndex(0);
    }
  };
  const handleTitleChange = (val) => {
    setTitle(val); titleRef.current = val; setSaved(false);
    pendingSaveRef.current = { id: activeId, title: val, body: bodyRef.current };
    triggerAutoSave();
  };
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


  const triggerAutoSave = () => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      const snap = pendingSaveRef.current;
      if (!snap) return;
      autoSaveRef.current = null;
      pendingSaveRef.current = null;
      setSaved(true);
      setNotes(prev => {
        const n = prev.find(x => x.id === snap.id);
        if (!n) return prev;
        dbUpdateNote({ id: snap.id, title: snap.title, body: snap.body, folderId: n.folderId, tags: n.tags, pinned: n.pinned })
          .then(updated => setNotes(p => p.map(x => x.id === snap.id ? updated : x)))
          .catch(() => setSaved(false));
        return prev.map(x => x.id === snap.id ? { ...x, title: snap.title, body: snap.body, edited: 'Just now' } : x);
      });
    }, 1500);
  };

  const saveNote = async () => {
    if (!note) return;
    if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null; }
    pendingSaveRef.current = null;
    const id = activeId, t = titleRef.current || title, b = bodyRef.current || body;
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title: t, body: b, edited: 'Just now' } : n));
    setSaved(true);
    try {
      const updated = await dbUpdateNote({ id, title: t, body: b, folderId: note.folderId, tags: note.tags, pinned: note.pinned });
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
    } catch (err) {
      console.error('Failed to save note:', err);
      setSaved(false);
    }
  };

  const exportNote = () => {
    if (!note) return;
    const t = titleRef.current || title, b = bodyRef.current || body;
    const blob = new Blob([`# ${t}\n\n${b}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyNote = async () => {
    if (!note) return;
    const t = titleRef.current || title, b = bodyRef.current || body;
    await navigator.clipboard.writeText(`# ${t}\n\n${b}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createNote = async () => {
    const folderId = activeFolderId || noteFolders.find(f => f.name === 'Other')?.id || null;
    try {
      const saved = await dbCreateNote(
        { title: 'Untitled note', folderId, tags: [], pinned: false, body: '' },
        workstationId,
      );
      setNotes(prev => [saved, ...prev]);
      setActiveId(saved.id);
      setMobileView('editor');
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const saveQuick = async (e) => {
    if (e.key === 'Enter' && quickText.trim()) {
      const text = quickText.trim();
      setQuickText('');
      const folderId = activeFolderId || noteFolders.find(f => f.name === 'Other')?.id || null;
      try {
        const saved = await dbCreateNote(
          { title: text, folderId, tags: ['#quick'], pinned: false, body: text },
          workstationId,
        );
        setNotes(prev => [saved, ...prev]);
        setActiveId(saved.id);
        setMobileView('editor');
      } catch (err) {
        console.error('Failed to quick-save note:', err);
      }
    }
  };

  const moveNoteFolder = async (targetFolder) => {
    setMovingFolder(false);
    const prev = note.folderId;
    setNotes(ns => ns.map(n => n.id === activeId
      ? { ...n, folderId: targetFolder.id, folderName: targetFolder.name } : n));
    try {
      await dbUpdateNote({ id: activeId, title, body, folderId: targetFolder.id, tags: note.tags, pinned: note.pinned });
    } catch (err) {
      console.error('Failed to move note:', err);
      setNotes(ns => ns.map(n => n.id === activeId
        ? { ...n, folderId: prev, folderName: note.folderName } : n));
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || noteFolders.some(f => f.name === name)) return;
    setNewFolderName('');
    setShowNewFolder(false);
    try {
      const folder = await dbCreateNoteFolder(workstationId, name);
      setNoteFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveFolderId(folder.id);
      setMobileView('list');
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const startRename = (folder) => {
    setRenamingFolder(folder);
    setRenameValue(folder.name);
  };

  const commitRename = async () => {
    const name = renameValue.trim();
    const folder = renamingFolder;
    setRenamingFolder(null);
    if (!name || name === folder.name) return;
    setNoteFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name } : f).sort((a, b) => a.name.localeCompare(b.name)));
    setNotes(prev => prev.map(n => n.folderId === folder.id ? { ...n, folderName: name } : n));
    try {
      await dbRenameNoteFolder(folder.id, name);
    } catch (err) {
      console.error('Failed to rename folder:', err);
      setNoteFolders(prev => prev.map(f => f.id === folder.id ? folder : f));
      setNotes(prev => prev.map(n => n.folderId === folder.id ? { ...n, folderName: folder.name } : n));
    }
  };

  const [deleteFolderConfirm, setDeleteFolderConfirm] = useStateB(null); // folder object pending delete

  const handleDeleteFolder = (folder) => {
    setDeleteFolderConfirm(folder);
  };

  const confirmDeleteFolder = async () => {
    const folder = deleteFolderConfirm;
    setDeleteFolderConfirm(null);
    if (!folder) return;
    setNoteFolders(prev => prev.filter(f => f.id !== folder.id));
    const otherId = noteFolders.find(f => f.name === 'Other')?.id;
    setNotes(prev => prev.map(n => n.folderId === folder.id ? { ...n, folderId: otherId, folderName: 'Other' } : n));
    if (activeFolderId === folder.id) setActiveFolderId(null);
    // Drilled into the deleted folder's list → go back to the folder list
    setMobileView('folders');
    try {
      await dbDeleteNoteFolder(folder.id, workstationId);
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  const togglePin = async (n) => {
    const newPinned = !n.pinned;
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: newPinned } : x));
    try {
      await dbUpdateNote({ id: n.id, title: n.title, body: n.body, folderId: n.folderId, tags: n.tags, pinned: newPinned });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: n.pinned } : x));
    }
  };

  // ── Note linking helpers ─────────────────────────────────────────
  const linkMenuItems = React.useMemo(() => {
    if (!linkMenu) return [];
    const lq = linkMenu.query.toLowerCase();
    return notes.filter(n => n.id !== activeId && n.title.toLowerCase().includes(lq)).slice(0, 6);
  }, [linkMenu, notes, activeId]);

  useEffectB(() => setLinkIndex(0), [linkMenu?.query]);

  const insertLink = (n) => {
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? body.length;
    const before = body.slice(0, cursor);
    const match = before.match(/\[\[([^\][\n]*)$/);
    if (!match) { setLinkMenu(null); return; }
    const start = cursor - match[0].length;
    const newVal = body.slice(0, start) + `[[${n.title}]]` + body.slice(cursor);
    bodyRef.current = newVal;
    setBody(newVal);
    setSaved(false);
    pendingSaveRef.current = { id: activeId, title: titleRef.current, body: newVal };
    triggerAutoSave();
    setLinkMenu(null);
    setLinkIndex(0);
    setTimeout(() => {
      if (ta) {
        const pos = start + n.title.length + 4;
        ta.setSelectionRange(pos, pos);
        ta.focus();
      }
    }, 0);
  };

  const applyFormat = (type) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = body.slice(start, end);
    let newVal, newSel;

    if (type === 'bold' || type === 'italic' || type === 'code') {
      const m = { bold: '**', italic: '*', code: '`' }[type];
      const ph = { bold: 'bold', italic: 'italic', code: 'code' }[type];
      if (sel) {
        if (sel.startsWith(m) && sel.endsWith(m) && sel.length > m.length * 2) {
          const inner = sel.slice(m.length, -m.length);
          newVal = body.slice(0, start) + inner + body.slice(end);
          newSel = [start, start + inner.length];
        } else {
          newVal = body.slice(0, start) + m + sel + m + body.slice(end);
          newSel = [start, start + m.length + sel.length + m.length];
        }
      } else {
        newVal = body.slice(0, start) + m + ph + m + body.slice(start);
        newSel = [start + m.length, start + m.length + ph.length];
      }
    } else {
      const prefix = type === 'heading' ? '# ' : '- ';
      const lineStart = body.lastIndexOf('\n', start - 1) + 1;
      if (body.slice(lineStart).startsWith(prefix)) {
        newVal = body.slice(0, lineStart) + body.slice(lineStart + prefix.length);
        newSel = [Math.max(lineStart, start - prefix.length), Math.max(lineStart, end - prefix.length)];
      } else {
        newVal = body.slice(0, lineStart) + prefix + body.slice(lineStart);
        newSel = [start + prefix.length, end + prefix.length];
      }
    }

    bodyRef.current = newVal;
    setBody(newVal);
    setSaved(false);
    pendingSaveRef.current = { id: activeId, title: titleRef.current, body: newVal };
    triggerAutoSave();
    setTimeout(() => { ta.setSelectionRange(...newSel); ta.focus(); }, 0);
  };

  const dropNoteLink = (e) => {
    e.preventDefault();
    setEditorDragOver(false);
    const id = e.dataTransfer.getData('application/note-id');
    if (!id || id === activeId) return;
    const n = notes.find(x => x.id === id);
    if (!n) return;
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? body.length;
    const link = `[[${n.title}]]`;
    const newVal = body.slice(0, cursor) + link + body.slice(cursor);
    bodyRef.current = newVal;
    setBody(newVal);
    setSaved(false);
    pendingSaveRef.current = { id: activeId, title: titleRef.current, body: newVal };
    triggerAutoSave();
    setTimeout(() => {
      if (ta) { const pos = cursor + link.length; ta.setSelectionRange(pos, pos); ta.focus(); }
    }, 0);
  };

  const handleTextareaKeyDown = (e) => {
    if (!linkMenu || linkMenuItems.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setLinkIndex(i => Math.min(i + 1, linkMenuItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setLinkIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); insertLink(linkMenuItems[linkIndex]); }
    else if (e.key === 'Escape') { setLinkMenu(null); }
  };

  const renderBody = (text) => {
    let html = renderMd(text);
    html = html.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
      const found = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
      if (found) return `<a class="note-wikilink" data-note-id="${found.id}">${title}</a>`;
      return `<span class="note-wikilink note-wikilink-missing">[[${title}]]</span>`;
    });
    return html;
  };

  const handlePreviewClick = (e) => {
    const id = e.target.closest('[data-note-id]')?.dataset.noteId;
    if (id) setActiveId(id);
  };

  const handleDropOnFolder = (noteId, targetFolder) => {
    setNoteDragOverId(null);
    const draggedNote = notes.find(n => n.id === noteId);
    if (!draggedNote || draggedNote.folderId === targetFolder.id) return;
    const { folderId: prevId, folderName: prevName } = draggedNote;
    setNotes(prev => prev.map(n => n.id === noteId
      ? { ...n, folderId: targetFolder.id, folderName: targetFolder.name } : n));
    dbUpdateNote({ id: noteId, title: draggedNote.title, body: draggedNote.body,
      folderId: targetFolder.id, tags: draggedNote.tags, pinned: draggedNote.pinned })
      .catch(() => setNotes(prev => prev.map(n => n.id === noteId
        ? { ...n, folderId: prevId, folderName: prevName } : n)));
  };

  const startFolderDrag = (e, folder, idx) => {
    e.preventDefault();
    const rows = Array.from(foldersContainerRef.current?.querySelectorAll('[data-folder-row]') || []);
    const rects = rows.map(el => el.getBoundingClientRect());
    const containerRect = foldersContainerRef.current?.getBoundingClientRect() ?? { top: 0, left: 0, width: 160 };
    const drag = { id: folder.id, fromIndex: idx, toIndex: idx, ghostY: e.clientY, rects, containerRect };
    setFolderDrag(drag);

    const onMove = (ev) => {
      const cur = folderDragRef.current;
      if (!cur) return;
      let toIndex = cur.rects.length;
      for (let i = 0; i < cur.rects.length; i++) {
        if (ev.clientY < cur.rects[i].top + cur.rects[i].height / 2) { toIndex = i; break; }
      }
      setFolderDrag({ ...cur, toIndex, ghostY: ev.clientY });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const cur = folderDragRef.current;
      setFolderDrag(null);
      if (!cur) return;
      const { fromIndex, toIndex } = cur;
      const to = toIndex > fromIndex ? toIndex - 1 : toIndex;
      if (fromIndex === to) return;
      setNoteFolders(prev => {
        const arr = [...prev];
        const [moved] = arr.splice(fromIndex, 1);
        arr.splice(to, 0, moved);
        dbReorderNoteFolders(workstationId, arr.map(f => f.id)).catch(() => setNoteFolders(prev));
        return arr;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
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

  const visibleNotes = React.useMemo(() => {
    const base = activeFolderId ? notes.filter(n => n.folderId === activeFolderId) : notes;
    const filtered = q
      ? base.filter(n => {
          const lq = q.toLowerCase();
          return n.title.toLowerCase().includes(lq) || n.body.toLowerCase().includes(lq);
        })
      : base;
    if (sortBy === 'newest') return filtered;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0);
      if (sortBy === 'alpha')  return a.title.localeCompare(b.title);
      return 0;
    });
  }, [notes, activeFolderId, q, sortBy]);

  const pinned = visibleNotes.filter(n => n.pinned);
  const unpinned = visibleNotes.filter(n => !n.pinned);

  const hlText = (text, maxLen = text.length) => {
    const sub = text.slice(0, maxLen);
    if (!q) return sub;
    const lq = q.toLowerCase();
    const idx = sub.toLowerCase().indexOf(lq);
    if (idx === -1) return sub;
    return <>{sub.slice(0, idx)}<mark className="note-hl">{sub.slice(idx, idx + q.length)}</mark>{sub.slice(idx + q.length)}</>;
  };

  const bodySnippet = (text) => {
    const clean = text.replace(/[#*`>]/g, '');
    if (!q) return clean.slice(0, 80);
    const lq = q.toLowerCase();
    const idx = clean.toLowerCase().indexOf(lq);
    if (idx === -1) return clean.slice(0, 80);
    const start = Math.max(0, idx - 20);
    const snippet = clean.slice(start, start + 80);
    const qi = snippet.toLowerCase().indexOf(lq);
    if (qi === -1) return snippet;
    return <>{start > 0 && '…'}{snippet.slice(0, qi)}<mark className="note-hl">{snippet.slice(qi, qi + q.length)}</mark>{snippet.slice(qi + q.length)}</>;
  };

  const NoteCard = ({ n }) => (
    <div
      className={'note-item' + (n.id === activeId ? ' active' : '')}
      onClick={() => { setActiveId(n.id); setMobileView('editor'); }}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', n.id);
        e.dataTransfer.setData('application/note-id', n.id);
        e.dataTransfer.effectAllowed = 'all';
      }}
      onDragEnd={() => setNoteDragOverId(null)}
    >
      <div className="note-item-row">
        <div className="t">{hlText(n.title, 60)}</div>
        <button
          className={'note-pin-btn' + (n.pinned ? ' pinned' : '')}
          onClick={e => { e.stopPropagation(); togglePin(n); }}
          title={n.pinned ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Icon name="star" size={10}/>
        </button>
      </div>
      <div className="p">{bodySnippet(n.body)}</div>
      <div className="m">
        {(n.tags || []).slice(0, 2).map(t => <span key={t}>{t}</span>)}
        <span style={{ marginLeft: 'auto' }}>{n.edited}</span>
      </div>
    </div>
  );

  return (
    <div className={`page page-wide notes-page notes-page-${mobileView}`}>
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / NOTES</div>
          <h1>Notes</h1>
          <div className="sub">{notes.length} notes · {noteFolders.length} folders</div>
        </div>
        <div className="actions">
          <button className="btn primary btn-new-folder" onClick={() => { setNewFolderName(''); setShowNewFolder(true); }}><Icon name="plus" size={12}/> New folder</button>
        </div>
      </div>

      <div className={`notes-layout notes-mob-${mobileView}`}>

        {/* ── Folder sidebar ── */}
        <div className="notes-folders">
          {/* Fixed top — never scrolls */}
          <div
            className={'nf-item' + (activeFolderId === null ? ' nf-active' : '')}
          >
            <Icon name="list" size={12}/>
            <span>All Notes</span>
            <span className="nf-count">{notes.length}</span>
          </div>



          <div className="nf-divider" />

          {/* Scrollable folder list */}
          <div className="nf-folders-scroll" ref={foldersContainerRef}>
          {noteFolders.map((f, idx) => {
            // Shift items to make room for dragged folder
            let translateY = 0;
            if (folderDrag && folderDrag.rects[idx]) {
              const { fromIndex, toIndex } = folderDrag;
              const h = folderDrag.rects[fromIndex]?.height ?? 30;
              if (idx !== fromIndex) {
                if (fromIndex < toIndex && idx > fromIndex && idx < toIndex) translateY = -h;
                else if (fromIndex > toIndex && idx >= toIndex && idx < fromIndex) translateY = h;
              }
            }
            return (
              <div
                key={f.id}
                data-folder-row
                className={
                  'nf-row' +
                  (activeFolderId === f.id ? ' nf-active' : '') +
                  (noteDragOverId === f.id ? ' nf-drag-over' : '') +
                  (folderDrag?.id === f.id ? ' nf-dragging' : '')
                }
                style={{
                  transform: `translateY(${translateY}px)`,
                  transition: folderDrag ? 'transform 0.15s ease' : 'none',
                }}
                onClick={() => { if (renamingFolder?.id !== f.id) { setActiveFolderId(f.id); setMobileView('list'); } }}
                onDoubleClick={() => f.name !== 'Other' && startRename(f)}
                onDragOver={e => { e.preventDefault(); setNoteDragOverId(f.id); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setNoteDragOverId(null); }}
                onDrop={e => {
                  e.preventDefault();
                  setNoteDragOverId(null);
                  const noteId = e.dataTransfer.getData('text/plain');
                  if (noteId) handleDropOnFolder(noteId, f);
                }}
              >
                {/* Grip — pointer-down starts folder reorder */}
                <div
                  className="nf-grip"
                  onPointerDown={e => startFolderDrag(e, f, idx)}
                  onClick={e => e.stopPropagation()}
                >
                  <Icon name="drag" size={11}/>
                </div>

                {renamingFolder?.id === f.id ? (
                  <input
                    autoFocus
                    className="nf-rename-input"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingFolder(null); }}
                    onBlur={commitRename}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <Icon name="folder" size={12} style={{ flexShrink: 0, color: 'var(--text-3)' }}/>
                    <span className="nf-label">{f.name}</span>
                    <span className="nf-count">{notes.filter(n => n.folderId === f.id).length}</span>
                  </>
                )}
              </div>
            );
          })}

          {noteFolders.length === 0 && (
            <div className="nf-empty">
              <Icon name="folder" size={22}/>
              <div className="nf-empty-title">No folders yet</div>
              <div className="nf-empty-sub">Create a folder to organize your notes into groups.</div>
              <button className="btn primary sm" onClick={() => { setNewFolderName(''); setShowNewFolder(true); }}>
                <Icon name="plus" size={11}/> New folder
              </button>
            </div>
          )}

          {/* Absolute insertion line — positioned from captured rects */}
          {folderDrag && (() => {
            const { toIndex, rects, containerRect } = folderDrag;
            const lineTop = toIndex < rects.length
              ? rects[toIndex].top - containerRect.top
              : rects[rects.length - 1]
                ? rects[rects.length - 1].bottom - containerRect.top
                : 0;
            return <div className="nf-insert-line-abs" style={{ top: lineTop }} />;
          })()}
          </div>{/* end nf-folders-scroll */}
        </div>

        {/* ── Note list ── */}
        <div className="notes-list">
          <div className="nm-list-header">
            <button className="notes-mobile-back" onClick={() => setMobileView('folders')}>
              <Icon name="arrow" size={12}/> Folders
            </button>
          </div>
          <div className="notes-quick">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="lbl" style={{ margin: 0 }}>QUICK CAPTURE</div>
              <button className="btn sm" onClick={createNote} style={{ padding: '2px 6px', height: 22 }}><Icon name="plus" size={9}/> New Note</button>
            </div>
            <input
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              onKeyDown={saveQuick}
              placeholder="press enter to save…"
            />
          </div>
          <div className="notes-search">
            <input ref={searchRef} placeholder="Search notes…" value={q} onChange={e => setQ(e.target.value)} />
          </div>

          <div className="note-sort-bar">
            {[['newest','Newest'],['oldest','Oldest'],['alpha','A–Z']].map(([k,l]) => (
              <button key={k} className={'note-sort-btn' + (sortBy === k ? ' active' : '')} onClick={() => setSortBy(k)}>{l}</button>
            ))}
          </div>

          {activeFolderId && (
            <div className="notes-list-header">
              <span className="lbl">FOLDER: {noteFolders.find(f => f.id === activeFolderId)?.name.toUpperCase()}</span>
              {noteFolders.find(f => f.id === activeFolderId)?.name !== 'Other' && (
                <button
                  className="btn-delete-folder"
                  title="Delete Folder"
                  onClick={() => handleDeleteFolder(noteFolders.find(f => f.id === activeFolderId))}
                >
                  <Icon name="trash" size={10}/> Delete
                </button>
              )}
            </div>
          )}

          <div className="notes-scroll">
            {/* Favourites */}
            {pinned.length > 0 && (
              <>
                <div className="notes-sec"><Icon name="star" size={9}/>FAVOURITES</div>
                {pinned.map(n => <NoteCard key={n.id} n={n} />)}
              </>
            )}

            {/* When viewing All Notes: group by folder */}
            {activeFolderId === null
              ? noteFolders.map(f => {
                  const inFolder = unpinned.filter(n => n.folderId === f.id);
                  if (inFolder.length === 0) return null;
                  return (
                    <React.Fragment key={f.id}>
                      <div className="notes-sec">{f.name.toUpperCase()}</div>
                      {inFolder.map(n => <NoteCard key={n.id} n={n} />)}
                    </React.Fragment>
                  );
                })
              : unpinned.map(n => <NoteCard key={n.id} n={n} />)
            }

            {visibleNotes.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-4)' }}>
                {activeFolderId
                  ? `No notes in "${noteFolders.find(f => f.id === activeFolderId)?.name}"`
                  : 'No notes found'}
              </div>
            )}
          </div>

        </div>

        {/* ── Delete folder confirmation dialog ── */}
        {showNewFolder && createPortal(
          <div className="nf-dialog-backdrop" onClick={() => setShowNewFolder(false)}>
            <div className="nf-dialog" onClick={e => e.stopPropagation()}>
              <div className="nf-dialog-icon" style={{ color: 'var(--accent)', background: 'var(--accent-tint)', borderColor: 'var(--accent)' }}>
                <Icon name="folder" size={20}/>
              </div>
              <div className="nf-dialog-title">Create Folder</div>
              <div className="nf-dialog-body">
                <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 16 }}>
                  Organize your notes by grouping them into a new folder.
                </div>
                <input
                  className="nf-dialog-input"
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                  placeholder="Folder name…"
                />
              </div>
              <div className="nf-dialog-actions">
                <button className="btn" onClick={() => setShowNewFolder(false)}>
                  Cancel
                </button>
                <button className="btn primary" onClick={createFolder} disabled={!newFolderName.trim()}>
                  <Icon name="plus" size={11}/> Create folder
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {deleteFolderConfirm && createPortal(
          <div className="nf-dialog-backdrop" onClick={() => setDeleteFolderConfirm(null)}>
            <div className="nf-dialog" onClick={e => e.stopPropagation()}>
              <div className="nf-dialog-icon">
                <Icon name="trash" size={20}/>
              </div>
              <div className="nf-dialog-title">Delete folder?</div>
              <div className="nf-dialog-body">
                <span className="nf-dialog-folder-name">"{deleteFolderConfirm.name}"</span> will be deleted.
                All <strong>{notes.filter(n => n.folderId === deleteFolderConfirm.id).length} notes</strong> inside
                will be moved to <strong>Other</strong>.
              </div>
              <div className="nf-dialog-actions">
                <button className="btn" onClick={() => setDeleteFolderConfirm(null)}>
                  Cancel
                </button>
                <button className="btn nf-dialog-confirm" onClick={confirmDeleteFolder}>
                  <Icon name="trash" size={11}/> Delete folder
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Folder drag ghost */}
        {folderDrag && createPortal(
          <div className="nf-ghost" style={{
            top: folderDrag.ghostY - 14,
            left: folderDrag.containerRect.left,
            width: folderDrag.containerRect.width,
          }}>
            <Icon name="folder" size={12}/>
            <span>{noteFolders.find(f => f.id === folderDrag.id)?.name}</span>
            <span className="nf-count" style={{ marginLeft: 'auto' }}>
              {notes.filter(n => n.folderId === folderDrag.id).length}
            </span>
          </div>,
          document.body
        )}

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
                    <span>{(note.folderName || 'Other').toUpperCase()}</span>
                    <span>·</span>
                    <span>{wordCount} WORDS</span>
                    <span>·</span>
                    <span>{readLabel} READ</span>
                    {note.tags.length > 0 && (
                      <>{note.tags.map(t => <span key={t} className="tag" style={{ color: 'var(--accent-hi)', borderColor: 'var(--accent-tint-2)' }}>{t}</span>)}</>
                    )}
                    {note.pinned && <span className="tag" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="star" size={9}/>FAVOURITE</span>}
                  </div>
                </div>
                <div className="note-preview nfm-body" onClick={handlePreviewClick} dangerouslySetInnerHTML={{ __html: renderBody(body) }} />
              </div>
            </div>
            <div className="nfm-bar">
              <div className="nfm-bar-l">
                <button
                  className={'btn sm' + (focusAutoScrolling ? ' primary' : '')}
                  onClick={focusAutoScrolling ? stopFocusScroll : startFocusScroll}
                  title={`Auto-scroll over about ${readLabel}`}
                >
                  <Icon name={focusAutoScrolling ? 'pause' : 'arrow'} size={10} />
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

        {!note ? (
          <div className="note-empty-state">
            <button className="notes-mobile-back" onClick={() => setMobileView('list')}>
              <Icon name="arrow" size={12}/> Notes
            </button>
            <Icon name="note" size={28}/>
            <span>Select a note to start editing</span>
          </div>
        ) : (
          <div className="note-editor">
            <button className="notes-mobile-back" onClick={() => setMobileView('list')}>
              <Icon name="arrow" size={12}/> Notes
            </button>
            <div className="note-breadcrumb">
              <Icon name="folder" size={11}/>
              <span className="nb-folder">{noteFolders.find(f => f.id === note.folderId)?.name || note.folderName || 'Other'}</span>
              <Icon name="chev" size={9}/>
              <span className="nb-note">{title || 'Untitled note'}</span>
            </div>
            <div className="note-eh">
              <input className="title" value={title} onChange={e => handleTitleChange(e.target.value)} />
              <div className="note-eh-actions">
                {!saved && <span className="note-unsaved-dot" title="Auto-saving…">●</span>}
                {confirmDelete ? (
                  <>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)' }}>Delete?</span>
                    <button className="btn sm btn-danger" onClick={deleteNote}><Icon name="check" size={10}/> Yes</button>
                    <button className="btn sm" onClick={() => setConfirmDelete(false)}><Icon name="x" size={10}/> No</button>
                  </>
                ) : (
                  <button className="btn sm btn-danger-ghost" onClick={() => setConfirmDelete(true)} title="Delete note">
                    <Icon name="trash" size={10}/>
                  </button>
                )}
                <div className="note-reader-actions">
                  <button className="btn sm" onClick={exportNote} title="Download as .md file"><Icon name="download" size={10}/> .md</button>
                  <button className="btn sm" onClick={copyNote} title="Copy markdown">
                    {copied ? <><Icon name="check" size={10}/> Copied!</> : <><Icon name="copy" size={10}/> Copy</>}
                  </button>
                  {(tab === 'preview' || tab === 'split') && (
                    <button className={'btn sm' + (autoScrolling ? ' primary' : '')} onClick={autoScrolling ? stopAutoScroll : startAutoScroll}>
                      <Icon name={autoScrolling ? 'pause' : 'arrow'} size={10}/>
                      {autoScrolling ? 'Stop' : `Scroll · ${readLabel}`}
                    </button>
                  )}
                  <button className="btn sm" onClick={() => { setTab('preview'); setFocusMode(true); setFocusProgress(0); }} title="Focus mode">
                    <Icon name="eye" size={10}/> Focus
                  </button>
                </div>
              </div>
            </div>
            <div className="note-meta">
              <div style={{ position: 'relative' }}>
                <button
                  className="nf-item"
                  style={{ padding: '2px 6px', fontSize: 10, gap: 4 }}
                  onClick={() => setMovingFolder(v => !v)}
                  title="Move to folder"
                >
                  <Icon name="folder" size={10}/>
                  <span>{(note.folderName || 'Other').toUpperCase()}</span>
                  <Icon name="chev" size={9}/>
                </button>
                {movingFolder && (
                  <div className="nf-move-menu">
                    {noteFolders.filter(f => f.id !== note.folderId).map(f => (
                      <button key={f.id} className="nf-move-item" onClick={() => moveNoteFolder(f)}>
                        <Icon name="folder" size={10}/> {f.name}
                      </button>
                    ))}
                    {noteFolders.filter(f => f.id !== note.folderId).length === 0 && (
                      <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-3)' }}>No other folders</div>
                    )}
                  </div>
                )}
              </div>
              <span>·</span>
              <span>EDITED {(note.edited || '').toUpperCase()}</span><span>·</span>
              <span>{body.length} chars · {body.split(/\s+/).filter(Boolean).length} words</span>
              <div className="note-meta-right">
                {note.tags.map(t => <span key={t} className="tag" style={{ color: 'var(--accent-hi)', borderColor: 'var(--accent-tint-2)' }}>{t}</span>)}
                <button
                  className={'note-pin-toggle' + (note.pinned ? ' active' : '')}
                  onClick={() => togglePin(note)}
                  title={note.pinned ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <Icon name="star" size={9}/>
                  {note.pinned ? 'Favourited' : 'Favourite'}
                </button>
                <div className="note-tabs">
                  <button className={tab==='edit' ? 'active' : ''} onClick={() => setTab('edit')}>EDIT</button>
                  <button className={tab==='preview' ? 'active' : ''} onClick={() => setTab('preview')}>PREV</button>
                  <button className={tab==='split' ? 'active' : ''} onClick={() => setTab('split')}>SPLIT</button>
                </div>
              </div>
            </div>
            {tab !== 'preview' && (
              <div className="md-toolbar">
                {[
                  { type: 'bold',    label: 'B',  title: 'Bold',        style: { fontWeight: 700 } },
                  { type: 'italic',  label: 'I',  title: 'Italic',      style: { fontStyle: 'italic' } },
                  { type: 'code',    label: '</>',title: 'Inline code',  style: {} },
                  null,
                  { type: 'heading', label: 'H1', title: 'Heading',      style: {} },
                  { type: 'bullet',  label: '• —', title: 'Bullet list', style: {} },
                ].map((item, i) =>
                  item === null
                    ? <div key={i} className="md-toolbar-sep" />
                    : <button key={item.type} className="md-toolbar-btn" style={item.style}
                        title={item.title}
                        onMouseDown={e => { e.preventDefault(); applyFormat(item.type); }}>
                        {item.label}
                      </button>
                )}
              </div>
            )}
            {tab === 'split' ? (
              <div className="note-split">
                <div
                  className={'note-body' + (editorDragOver ? ' note-body-drop' : '')}
                  style={{ borderRight: '1px solid var(--border)', position: 'relative' }}
                  onDragOver={e => { if (e.dataTransfer.types.includes('application/note-id')) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setEditorDragOver(true); } }}
                  onDragLeave={() => setEditorDragOver(false)}
                  onDrop={dropNoteLink}
                >
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={e => handleBodyChange(e.target.value, e.target.selectionStart)}
                    onKeyDown={handleTextareaKeyDown}
                  />
                  {linkMenu && linkMenuItems.length > 0 && <NoteLinkMenu items={linkMenuItems} index={linkIndex} onSelect={insertLink} />}
                </div>
                <div ref={splitPreviewRef} className="note-body note-preview" onClick={handlePreviewClick} dangerouslySetInnerHTML={{ __html: renderBody(body) }} />
              </div>
            ) : tab === 'edit' ? (
              <div
                className={'note-body' + (editorDragOver ? ' note-body-drop' : '')}
                style={{ position: 'relative' }}
                onDragOver={e => { if (e.dataTransfer.types.includes('application/note-id')) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setEditorDragOver(true); } }}
                onDragLeave={() => setEditorDragOver(false)}
                onDrop={dropNoteLink}
              >
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => handleBodyChange(e.target.value, e.target.selectionStart)}
                  onKeyDown={handleTextareaKeyDown}
                />
                {linkMenu && linkMenuItems.length > 0 && <NoteLinkMenu items={linkMenuItems} index={linkIndex} onSelect={insertLink} />}
              </div>
            ) : (
              <div ref={previewRef} className="note-body note-preview" onClick={handlePreviewClick} dangerouslySetInnerHTML={{ __html: renderBody(body) }} />
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
  const [confirmDiscard, setConfirmDiscard] = useStateB(false);

  // Group entries by date
  const groupedEntries = React.useMemo(() => {
    const completed = timeEntries.filter(e => e.status === 'completed');
    const groups = {};
    completed.forEach(e => {
      const dateStr = e.startedAt ? e.startedAt.slice(0, 10) : 'unknown';
      if (!groups[dateStr]) {
        groups[dateStr] = {
          dateStr,
          entries: [],
          totalSeconds: 0
        };
      }
      groups[dateStr].entries.push(e);
      groups[dateStr].totalSeconds += e.totalSeconds;
    });
    return Object.values(groups).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [timeEntries]);

  const getGroupTitle = (dateStr) => {
    if (dateStr === 'unknown') return 'Unknown Date';
    const todayStr = todayIso();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterdayStr = d.toISOString().slice(0, 10);
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };


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
  
  const handleDiscardClick = () => {
    setConfirmDiscard(true);
  };

  const confirmDiscardAction = () => wrap(async () => {
    await onTimerDiscard();
    setNotes('');
    setConfirmDiscard(false);
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
                <button className="btn ghost" onClick={handleDiscardClick} disabled={busy} style={{ color: '#ef4444' }}>
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
          {groupedEntries.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--f-mono)' }}>
              No entries yet — start the timer to log time.
            </div>
          ) : groupedEntries.map(group => (
            <div key={group.dateStr} className="session-group">
              <div className="session-group-header">
                <div className="date-title">{getGroupTitle(group.dateStr)}</div>
                <div className="total-pill">{fmtDur(group.totalSeconds)}</div>
              </div>
              <div>
                {group.entries.map(e => {
                  const isOpen = expandedEntry === e.id;
                  const projInfo = projects.find(p => p.id === e.projectShort);
                  const badgeColor = projInfo?.color || 'var(--text-3)';
                  return (
                    <div key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {/* Refined main row */}
                      <div
                        className={`session-row-refined${isOpen ? ' open' : ''}`}
                        onClick={() => setExpandedEntry(isOpen ? null : e.id)}
                      >
                        {/* Project Badge */}
                        <div
                          className="session-proj-badge"
                          style={{
                            border: `1px solid ${badgeColor}33`,
                            background: `${badgeColor}10`,
                            color: badgeColor
                          }}
                        >
                          {e.projectShort}
                        </div>

                        {/* Task & Notes Details */}
                        <div className="session-info">
                          <div className="session-title-row">
                            <span className="session-task-title">
                              {e.taskTitle || <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontWeight: 400 }}>General Project Work</span>}
                            </span>
                            {e.taskShort && (
                              <span className="session-task-badge">
                                <Icon name="tag" size={10} style={{ color: 'var(--text-3)' }} />
                                {e.taskShort}
                              </span>
                            )}
                            {e.isManual && (
                              <span style={{ fontSize: 9, fontFamily: 'var(--f-mono)', fontWeight: 600, letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,149,0,0.12)', color: '#ff9500', border: '1px solid rgba(255,149,0,0.25)', lineHeight: 1, flexShrink: 0 }}>
                                MANUAL
                              </span>
                            )}
                          </div>
                          {e.notes && (
                            <div className="session-notes">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-4)' }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              {e.notes}
                            </div>
                          )}
                        </div>

                        {/* Started/Ended time range */}
                        <div className="session-time-range">
                          {fmtTime(e.startedAt)} — {fmtTime(e.endedAt)}
                        </div>

                        {/* Duration logged */}
                        <div className="session-dur-col">
                          {fmtDur(e.totalSeconds)}
                        </div>

                        {/* Chevron expansion trigger */}
                        <div className="exp-chev">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>

                      {/* Expandable events timeline */}
                      {isOpen && (
                        <div className="session-events-timeline">
                          {e.events.slice().reverse().map((ev, i) => {
                            const meta = EVENT_META[ev.event] || { color: 'var(--text-3)', label: ev.event };
                            return (
                              <div key={i} className="timeline-event-item">
                                <div className="timeline-event-dot" style={{ background: meta.color }} />
                                <span className="timeline-event-label">{meta.label}</span>
                                <span className="timeline-event-time">{fmtTime(ev.at)}</span>
                                {ev.elapsed > 0 && (
                                  <span className="timeline-event-elapsed">
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
          ))}
        </div>
      </div>

      {/* ── Discard Confirmation Dialog ── */}
      {confirmDiscard && createPortal(
        <div className="nf-dialog-backdrop" onClick={() => setConfirmDiscard(false)}>
          <div className="nf-dialog" onClick={e => e.stopPropagation()}>
            <div className="nf-dialog-icon" style={{ color: '#ef4444', background: '#ef444415' }}>
              <Icon name="trash" size={20}/>
            </div>
            <div className="nf-dialog-title">Discard session?</div>
            <div className="nf-dialog-body">
              This session will be discarded. All tracked time and notes will be permanently lost.
            </div>
            <div className="nf-dialog-actions">
              <button className="btn" onClick={() => setConfirmDiscard(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn nf-dialog-confirm" style={{ background: '#ef4444', color: '#fff', borderColor: '#dc2626' }} onClick={confirmDiscardAction} disabled={busy}>
                {busy ? 'Discarding...' : <><Icon name="trash" size={11}/> Discard</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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

const emailSubjectStore = {
  get: (id) => { try { return JSON.parse(localStorage.getItem('orbit_email_subjects') || '{}')[id] || ''; } catch { return ''; } },
  save: (id, val) => { try { const s = JSON.parse(localStorage.getItem('orbit_email_subjects') || '{}'); s[id] = val; localStorage.setItem('orbit_email_subjects', JSON.stringify(s)); } catch {} },
};

const emailVarsStore = {
  get: () => { try { return JSON.parse(localStorage.getItem('orbit_email_globals') || '{}'); } catch { return {}; } },
  save: (vars) => { try { localStorage.setItem('orbit_email_globals', JSON.stringify(vars)); } catch {} },
};

const emailStarStore = {
  get: () => { try { return new Set(JSON.parse(localStorage.getItem('orbit_email_starred') || '[]')); } catch { return new Set(); } },
  toggle: (id) => {
    try {
      const s = emailStarStore.get();
      s.has(id) ? s.delete(id) : s.add(id);
      localStorage.setItem('orbit_email_starred', JSON.stringify([...s]));
      return s;
    } catch { return new Set(); }
  },
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
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Project kick-off" autoFocus />
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

const VariablesPanel = ({ open, onClose, templates }) => {
  const [globals, setGlobals] = useStateB(() => emailVarsStore.get());

  useEffectB(() => { if (open) setGlobals(emailVarsStore.get()); }, [open]);

  const allPlaceholders = React.useMemo(() => {
    const map = {};
    templates.forEach(t => {
      extractPlaceholders(t.body).forEach(p => { map[p] = (map[p] || 0) + 1; });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [templates]);

  const save = () => { emailVarsStore.save(globals); onClose(); };

  return (
    <SlidePanel open={open} onClose={onClose} title="Global Variables" subtitle="TOOLS / EMAIL HUB / VARIABLES" width={480}>
      <div className="sp-body">
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
          Set default values for common placeholders. These pre-fill automatically when you select any template.
        </div>
        {allPlaceholders.length === 0 ? (
          <div style={{ color: 'var(--text-4)', fontSize: 12, textAlign: 'center', padding: '32px 0' }}>
            No placeholders found across your templates yet.
          </div>
        ) : allPlaceholders.map(([p, count]) => (
          <div key={p} className="fld" style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{p.replace(/_/g, ' ')}</span>
              <span style={{ color: 'var(--text-4)', fontSize: 10, fontWeight: 400 }}>
                used in {count} template{count !== 1 ? 's' : ''}
              </span>
            </label>
            <input
              value={globals[p] || ''}
              onChange={e => setGlobals(v => ({ ...v, [p]: e.target.value }))}
              placeholder={`{{${p}}}`}
            />
          </div>
        ))}
      </div>
      <div className="sp-footer">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save defaults</button>
      </div>
    </SlidePanel>
  );
};

const EmailTplItem = ({ t, activeId, starred, onSelect, onStar, onDelete }) => (
  <div
    className={'email-tpl' + (t.id === activeId ? ' active' : '')}
    onClick={onSelect}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      <div className="t" style={{ flex: 1 }}>{t.name}</div>
      <button
        className={'email-tpl-star' + (starred.has(t.id) ? ' starred' : '')}
        onClick={e => onStar(e, t.id)}
        title={starred.has(t.id) ? 'Remove from favourites' : 'Add to favourites'}
      >
        <Icon name="star" size={10}/>
      </button>
      <button
        className="email-tpl-del"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Delete"
      >
        <Icon name="trash" size={10}/>
      </button>
    </div>
    <div className="p">{t.body.split('\n').find(l => l.trim()) || ''}</div>
  </div>
);

export const EmailPage = ({ emailTemplates, setEmailTemplates, workstationId, jumpToItem }) => {
  const [activeId, setActiveId] = useStateB(emailTemplates[0]?.id);
  const [mode, setMode] = useStateB('fill');
  const [showAdd, setShowAdd] = useStateB(false);
  const [showVars, setShowVars] = useStateB(false);
  const [search, setSearch] = useStateB('');
  const [vals, setVals] = useStateB({});
  const [subject, setSubject] = useStateB('');
  const [editBody, setEditBody] = useStateB('');
  const [editName, setEditName] = useStateB('');
  const [editCat, setEditCat] = useStateB('Proposals');
  const [editSubject, setEditSubject] = useStateB('');
  const [saving, setSaving] = useStateB(false);
  const [copied, setCopied] = useStateB(false);
  const [confirmDel, setConfirmDel] = useStateB(null);
  const [starred, setStarred] = useStateB(() => emailStarStore.get());
  const [loadingStarters, setLoadingStarters] = useStateB(false);

  // Jump to an email template from global search
  useEffectB(() => {
    if (!jumpToItem || jumpToItem.page !== 'email') return;
    const target = emailTemplates.find(e => e.id === jumpToItem.id);
    if (target) setActiveId(target.id);
  }, [jumpToItem?.ts]);

  const toggleStar = (e, id) => {
    e.stopPropagation();
    setStarred(emailStarStore.toggle(id));
  };

  const handleLoadStarters = async () => {
    setLoadingStarters(true);
    const starters = [
      {
        id: 'client-proposal-' + Date.now().toString().slice(-4),
        cat: 'Proposals',
        name: 'Client Project Proposal',
        body: 'Hi {{client_name}},\n\nThank you for taking the time to discuss your project needs yesterday. I\'ve put together a comprehensive proposal outlining our approach, timeline, and deliverables for {{project_name}}.\n\nBased on our conversation, we will focus on:\n1. {{key_requirement_1}}\n2. {{key_requirement_2}}\n\nYou can view the full proposal document here: {{proposal_link}}\n\nPlease let me know if you have any questions or if you\'re ready to proceed with the next steps!\n\nBest regards,\n{{your_name}}'
      },
      {
        id: 'freelance-contract-' + Date.now().toString().slice(-4),
        cat: 'Freelance',
        name: 'Freelance Contract & Deposit',
        body: 'Hi {{client_name}},\n\nIt\'s a pleasure working with you on {{project_name}}!\n\nI have prepared the freelance service agreement for your review and signature. Please find it attached to this email.\n\nTo kick off the project, a {{deposit_percentage}}% deposit of {{deposit_amount}} is required. You can settle this invoice via the payment link below:\n{{payment_link}}\n\nOnce the agreement is signed and the deposit is received, I will begin the development phase immediately.\n\nThanks,\n{{your_name}}'
      },
      {
        id: 'meeting-followup-' + Date.now().toString().slice(-4),
        cat: 'Follow-ups',
        name: 'Post-Meeting Actions',
        body: 'Hi {{recipient_name}},\n\nGreat speaking with you today regarding {{topic}}. Here is a quick summary of what we discussed and our next action items:\n\nAction Items:\n- {{our_task}} (Assigned to: Us)\n- {{their_task}} (Assigned to: {{recipient_name}})\n\nWe are scheduled to check in next on {{next_meeting_date}}.\n\nBest,\n{{your_name}}'
      },
      {
        id: 'weekly-update-' + Date.now().toString().slice(-4),
        cat: 'Client Updates',
        name: 'Weekly Progress Update',
        body: 'Hi {{client_name}},\n\nHere is your weekly progress report for {{project_name}}:\n\nWhat we accomplished this week:\n- {{accomplishment_1}}\n- {{accomplishment_2}}\n\nPlan for next week:\n- {{next_step_1}}\n\nCurrent Status: On track for delivery by {{target_date}}.\n\nLet me know if you have any feedback or questions!\n\nBest,\n{{your_name}}'
      }
    ];

    try {
      const savedTemplates = [];
      for (const tplItem of starters) {
        const saved = await createEmailTemplate(tplItem, workstationId);
        savedTemplates.push(saved);
      }
      setEmailTemplates(prev => [...prev, ...savedTemplates]);
      if (savedTemplates.length > 0) {
        setActiveId(savedTemplates[0].id);
      }
    } catch (e) {
      console.error('Failed to load starter templates:', e);
    } finally {
      setLoadingStarters(false);
    }
  };

  const tpl = emailTemplates.find(t => t.id === activeId) || emailTemplates[0];
  const placeholders = tpl ? extractPlaceholders(tpl.body) : [];

  useEffectB(() => {
    if (!tpl) return;
    const subj = emailSubjectStore.get(tpl.id);
    setSubject(subj);
    const globals = emailVarsStore.get();
    const prefilled = {};
    extractPlaceholders(tpl.body).forEach(p => { if (globals[p]) prefilled[p] = globals[p]; });
    setVals(prefilled);
  }, [activeId]);

  const handleModeSwitch = (m) => {
    if (m === 'edit' && tpl) {
      setEditBody(tpl.body);
      setEditName(tpl.name);
      setEditCat(tpl.cat);
      setEditSubject(emailSubjectStore.get(tpl.id));
    }
    setMode(m);
  };

  const renderFill = (body) => {
    const parts = [];
    let last = 0;
    const re = /\{\{(\w+)\}\}/g; let m;
    while ((m = re.exec(body)) !== null) {
      if (m.index > last) parts.push(body.slice(last, m.index));
      const key = m[1];
      parts.push({ key, v: vals[key] });
      last = m.index + m[0].length;
    }
    if (last < body.length) parts.push(body.slice(last));
    return parts.map((p, i) => {
      if (typeof p === 'string') return <span key={i}>{p}</span>;
      if (p.v) return <span key={i} className="ph filled">{p.v}</span>;
      return <span key={i} className="ph">{`{{${p.key}}}`}</span>;
    });
  };

  const renderPreview = (text) => {
    let out = text;
    Object.entries(vals).forEach(([k, v]) => { if (v) out = out.replaceAll(`{{${k}}}`, v); });
    return out;
  };

  const buildCopyText = () => {
    if (!tpl) return '';
    let b = tpl.body;
    Object.entries(vals).forEach(([k, v]) => { if (v) b = b.replaceAll(`{{${k}}}`, v); });
    return subject ? `Subject: ${subject}\n\n${b}` : b;
  };

  const finalCopy = () => {
    navigator.clipboard?.writeText(buildCopyText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = async (t) => {
    const saved = await createEmailTemplate(t, workstationId);
    setEmailTemplates(prev => [...prev, saved]);
    setActiveId(saved.id);
  };

  const handleSaveEdit = async () => {
    if (!tpl || !editName.trim() || !editBody.trim()) return;
    setSaving(true);
    try {
      await updateEmailTemplate({ id: tpl.id, cat: editCat, name: editName.trim(), body: editBody.trim() });
      setEmailTemplates(prev => prev.map(t => t.id === tpl.id
        ? { ...t, cat: editCat, name: editName.trim(), body: editBody.trim() } : t));
      emailSubjectStore.save(tpl.id, editSubject);
      setSubject(editSubject);
      setMode('fill');
    } catch (e) {
      console.error('Failed to save template:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = confirmDel;
    setConfirmDel(null);
    const prev = emailTemplates;
    const remaining = emailTemplates.filter(t => t.id !== id);
    setEmailTemplates(remaining);
    setActiveId(remaining[0]?.id || null);
    try {
      await deleteEmailTemplate(id);
    } catch (e) {
      console.error('Failed to delete:', e);
      setEmailTemplates(prev);
    }
  };

  const handleDuplicate = async () => {
    if (!tpl) return;
    const newId = `${tpl.id}-copy-${Date.now().toString().slice(-4)}`;
    try {
      const saved = await createEmailTemplate(
        { id: newId, cat: tpl.cat, name: `${tpl.name} (Copy)`, body: tpl.body },
        workstationId,
      );
      setEmailTemplates(prev => [...prev, saved]);
      setActiveId(saved.id);
    } catch (e) {
      console.error('Failed to duplicate:', e);
    }
  };

  const filteredTemplates = React.useMemo(() => {
    if (!search.trim()) return emailTemplates;
    const lq = search.toLowerCase();
    return emailTemplates.filter(t => t.name.toLowerCase().includes(lq) || t.body.toLowerCase().includes(lq));
  }, [emailTemplates, search]);

  const starredTemplates   = filteredTemplates.filter(t => starred.has(t.id));
  const unstarredTemplates = filteredTemplates.filter(t => !starred.has(t.id));

  const editPlaceholders = mode === 'edit' ? extractPlaceholders(editBody) : [];

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / EMAIL HUB</div>
          <h1>Email templates</h1>
          <div className="sub">{emailTemplates.length} template{emailTemplates.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setShowVars(true)}><Icon name="hash" size={12}/> Variables</button>
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={12}/> New template
          </button>
        </div>
      </div>

      {emailTemplates.length === 0 ? (
        <div className="email-empty-hub">
          <div className="email-empty-card">
            <div className="email-empty-content">
              <div className="email-empty-icon-wrap">
                <Icon name="mail" size={32} />
              </div>
              <h2 className="email-empty-title">Simplify your communication</h2>
              <p className="email-empty-desc">
                Stop typing the same messages repeatedly. Create placeholder-driven email templates for client proposals, freelance follow-ups, and developer updates.
              </p>
              
              {loadingStarters ? (
                <div className="email-empty-loader">
                  <div className="email-empty-loader-dot"></div>
                  <div className="email-empty-loader-dot"></div>
                  <div className="email-empty-loader-dot"></div>
                  <span>Generating starter templates...</span>
                </div>
              ) : (
                <div className="email-empty-actions">
                  <button className="btn primary" onClick={() => setShowAdd(true)}>
                    <Icon name="plus" size={12} /> Create custom template
                  </button>
                  <button className="btn" onClick={handleLoadStarters}>
                    <Icon name="rev" size={12} /> Load starter templates
                  </button>
                </div>
              )}

              <div className="email-empty-features">
                <div className="email-empty-feature-item">
                  <div className="email-empty-feature-icon">
                    <Icon name="tag" size={16} />
                  </div>
                  <div className="email-empty-feature-title">{"{{placeholders}}"}</div>
                  <div className="email-empty-feature-desc">Define custom variables to pre-fill dynamic values instantly.</div>
                </div>
                <div className="email-empty-feature-item">
                  <div className="email-empty-feature-icon">
                    <Icon name="hash" size={16} />
                  </div>
                  <div className="email-empty-feature-title">Global defaults</div>
                  <div className="email-empty-feature-desc">Set default values for common placeholders globally.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="email-layout">
          {/* ── Template list ── */}
          <div className="email-list">
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search templates…"
                style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-2)', padding: '5px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              />
            </div>

            {filteredTemplates.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-4)' }}>
                No templates match "{search}"
              </div>
            ) : (
              <>
                {/* ── Favourites ── */}
                {starredTemplates.length > 0 && (
                  <>
                    <div className="email-cat" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="star" size={9} style={{ color: '#f59e0b' }}/> FAVOURITES · {starredTemplates.length}
                    </div>
                    {starredTemplates.map(t => <EmailTplItem key={t.id} t={t} activeId={activeId} starred={starred} onSelect={() => { setActiveId(t.id); setMode('fill'); }} onStar={toggleStar} onDelete={() => setConfirmDel(t.id)} />)}
                  </>
                )}

                {/* ── By category ── */}
                {EMAIL_CATS.map(cat => {
                  const items = unstarredTemplates.filter(t => t.cat === cat);
                  if (items.length === 0) return null;
                  return (
                    <React.Fragment key={cat}>
                      <div className="email-cat">{cat} · {items.length}</div>
                      {items.map(t => <EmailTplItem key={t.id} t={t} activeId={activeId} starred={starred} onSelect={() => { setActiveId(t.id); setMode('fill'); }} onStar={toggleStar} onDelete={() => setConfirmDel(t.id)} />)}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>

          {/* ── Editor ── */}
          {tpl ? (
            <div className="email-editor">
              {/* Header */}
              <div className="email-edh">
                <div style={{ flex: 1, minWidth: 0 }}>
                  {mode === 'edit' ? (
                    <>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Template name"
                        style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--f-display)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-2)', color: 'var(--text)', width: '100%', padding: '2px 0 4px', outline: 'none' }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <select
                          value={editCat}
                          onChange={e => setEditCat(e.target.value)}
                          style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)', fontSize: 11, fontFamily: 'var(--f-mono)', padding: '3px 8px', cursor: 'pointer' }}
                        >
                          {EMAIL_CATS.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="t">{tpl.name}</div>
                      <div className="label-mono" style={{ marginTop: 4 }}>
                        {tpl.cat} · {placeholders.length} placeholder{placeholders.length !== 1 ? 's' : ''}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <div className="view-toggle">
                    <button className={mode === 'fill' ? 'active' : ''} onClick={() => handleModeSwitch('fill')}>FILL</button>
                    <button className={mode === 'edit' ? 'active' : ''} onClick={() => handleModeSwitch('edit')}>EDIT</button>
                    <button className={mode === 'preview' ? 'active' : ''} onClick={() => handleModeSwitch('preview')}>PREVIEW</button>
                  </div>
                  {mode === 'edit' ? (
                    <button className="btn primary" onClick={handleSaveEdit} disabled={saving || !editName.trim() || !editBody.trim()}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  ) : (
                    <button className="btn primary" onClick={finalCopy}>
                      <Icon name="copy" size={12}/> {copied ? 'COPIED!' : 'COPY EMAIL'}
                    </button>
                  )}
                </div>
              </div>

              {/* Subject line */}
              <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.08em', color: 'var(--text-3)', flexShrink: 0, textTransform: 'uppercase' }}>Subject</span>
                <input
                  value={mode === 'edit' ? editSubject : subject}
                  onChange={e => {
                    if (mode === 'edit') { setEditSubject(e.target.value); }
                    else { setSubject(e.target.value); emailSubjectStore.save(tpl.id, e.target.value); }
                  }}
                  placeholder="Email subject line (supports {{placeholders}})…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', padding: '2px 0' }}
                />
              </div>

              {/* Content area */}
              <div className="email-content" style={mode === 'preview' ? { gridTemplateColumns: '1fr' } : {}}>
                <div className="email-body">
                  {mode === 'edit' ? (
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      style={{ width: '100%', height: '100%', background: 'transparent', border: 0, color: 'var(--text)', fontFamily: 'var(--f-mono)', fontSize: 12, resize: 'none', lineHeight: 1.8, outline: 'none', display: 'block' }}
                      autoFocus
                    />
                  ) : mode === 'preview' ? (
                    <div style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                      {subject && (
                        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', marginRight: 8 }}>SUBJECT</span>
                          <span style={{ color: 'var(--text-2)' }}>{renderPreview(subject)}</span>
                        </div>
                      )}
                      {renderPreview(tpl.body)}
                    </div>
                  ) : (
                    renderFill(tpl.body)
                  )}
                </div>

                {mode !== 'preview' && (
                  <div className="email-fill">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="label-mono">{mode === 'edit' ? 'DETECTED PLACEHOLDERS' : 'FILL PLACEHOLDERS'}</div>
                      {mode === 'fill' && placeholders.length > 0 && (
                        <button className="btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setVals({})}>
                          Reset
                        </button>
                      )}
                    </div>

                    {mode === 'fill' && (
                      <>
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
                        {placeholders.length === 0 && (
                          <div style={{ color: 'var(--text-3)', fontSize: 11 }}>No placeholders — this template is ready to copy.</div>
                        )}
                      </>
                    )}

                    {mode === 'edit' && (
                      <>
                        {editPlaceholders.length === 0 ? (
                          <div style={{ color: 'var(--text-3)', fontSize: 11 }}>No placeholders detected yet.</div>
                        ) : editPlaceholders.map(p => (
                          <div key={p} style={{ padding: '3px 0' }}>
                            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--accent-hi)', background: 'rgba(1,117,194,0.1)', padding: '2px 7px', display: 'inline-block' }}>
                              {`{{${p}}}`}
                            </span>
                          </div>
                        ))}
                      </>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }} onClick={handleDuplicate}>
                          <Icon name="copy" size={11}/> Duplicate
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                          onClick={() => setConfirmDel(tpl.id)}
                          title="Delete template"
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                        >
                          <Icon name="trash" size={11}/>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="email-editor-empty">
              <Icon name="mail" size={24} />
              <div className="title">No template selected</div>
              <div className="desc">Choose a template from the sidebar or clear your search to start editing.</div>
            </div>
          )}
        </div>
      )}

      <AddTemplatePanel open={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      <VariablesPanel open={showVars} onClose={() => setShowVars(false)} templates={emailTemplates} />

      {/* Delete confirmation */}
      {confirmDel && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setConfirmDel(null)}
        >
          <div
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)', width: 360, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', borderRadius: 4 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
              Delete template?
            </div>
            <div style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-2)' }}>
              "{emailTemplates.find(t => t.id === confirmDel)?.name}" will be permanently deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

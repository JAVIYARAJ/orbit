// automation.jsx — Owner-only Automation module: rule-based task triggers.
// v1.1: "when a task moves to status X [only if …conditions] → notify someone"
// (optionally with a logged-time summary). Foundation for future trigger types.

import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../components/shell.jsx';
import {
  listAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule,
} from '../lib/db.js';

const ACTION_META = {
  notify:              { icon: 'bell',  label: 'Notify' },
  notify_time_summary: { icon: 'timer', label: 'Notify with time summary' },
};
const TARGET_LABEL = { assignee: 'the assignee', reporter: 'the reporter' };

const blankRule = {
  name: '', triggerStatusId: '', actionType: 'notify', target: 'assignee', message: '',
  conditionMatch: 'all', conditions: [],
};

// ─── Condition helpers ───────────────────────────────────────────────
const FIELD_OPTIONS = [
  { value: 'project',  label: 'Project' },
  { value: 'priority', label: 'Priority' },
  { value: 'tag',      label: 'Tag' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'due',      label: 'Due date' },
];
const NEW_CONDITION = {
  project:  () => ({ field: 'project',  op: 'in',      values: [] }),
  priority: () => ({ field: 'priority', op: 'in',      values: [] }),
  tag:      () => ({ field: 'tag',      op: 'has_any', values: [] }),
  assignee: () => ({ field: 'assignee', op: 'is_set' }),
  due:      () => ({ field: 'due',      op: 'overdue' }),
};
const ASSIGNEE_OPS = [['is_set', 'is assigned'], ['is_unset', 'is unassigned']];
const DUE_OPS = [['overdue', 'is overdue'], ['within_days', 'is within N days'], ['none', 'has no due date']];

// Options for the multi-select fields, normalized to { id, label, color }.
const optionList = (field, lk) => {
  if (field === 'project')  return (lk.projects || []).map(p => ({ id: p.id, label: p.name }));
  if (field === 'priority') return (lk.priorities || []).map(p => ({ id: p.id, label: p.label, color: p.color }));
  if (field === 'tag')      return (lk.tags || []).map(t => ({ id: t.id, label: t.name, color: t.color }));
  return [];
};

const describeCondition = (c, lk) => {
  const names = (ids) => {
    const opts = optionList(c.field, lk);
    const out = (ids || []).map(id => opts.find(o => o.id === id)?.label || '…');
    return out.length ? out.join(' / ') : 'any';
  };
  switch (c.field) {
    case 'project':  return `project ${names(c.values)}`;
    case 'priority': return `priority ${names(c.values)}`;
    case 'tag':      return `tag ${names(c.values)}`;
    case 'assignee': return c.op === 'is_unset' ? 'unassigned' : 'assigned';
    case 'due':
      if (c.op === 'none') return 'no due date';
      if (c.op === 'within_days') return `due within ${c.value || 0}d`;
      return 'overdue';
    default: return c.field;
  }
};

// ─── Small shared bits ───────────────────────────────────────────────
function StatusChip({ status, label }) {
  const color = status?.color || 'var(--text-3)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
      borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'var(--text)',
      background: 'var(--bg-3)', border: '1px solid var(--border-2)', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label || status?.label || '—'}
    </span>
  );
}

function FlowBlock({ kind, icon, color, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 0,
    }}>
      <span style={{
        display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 7,
        background: color.bg, color: color.fg, flexShrink: 0,
      }}>
        <Icon name={icon} size={14} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, fontFamily: 'var(--f-mono)', letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 3 }}>
          {kind}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
          color: 'var(--text)', fontWeight: 500 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const FlowArrow = () => (
  <span style={{ color: 'var(--text-4)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
    <Icon name="arrow" size={16} />
  </span>
);

const TRIGGER_COLOR = { bg: 'var(--accent-tint)', fg: 'var(--accent-hi)' };
const ACTION_COLOR  = { bg: 'rgba(37, 211, 102, 0.1)', fg: '#25d366' };
const COND_COLOR    = { bg: 'rgba(255, 149, 0, 0.1)', fg: '#ff9500' };

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8,
  display: 'block', letterSpacing: '0.02em' };

// ─── Condition row inside the builder ────────────────────────────────
function ConditionRow({ cond, lk, onChange, onRemove }) {
  const opts = optionList(cond.field, lk);
  const isMulti = cond.field === 'project' || cond.field === 'priority' || cond.field === 'tag';

  const toggleValue = (id) => {
    const set = new Set(cond.values || []);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange({ ...cond, values: [...set] });
  };

  const chip = (on) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7,
    fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    background: on ? 'var(--accent-tint)' : 'var(--bg-3)',
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`,
    color: on ? 'var(--accent-hi)' : 'var(--text-2)',
  });

  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: isMulti || cond.field === 'assignee' || cond.field === 'due' ? 10 : 0 }}>
        <select className="input-premium" style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
          value={cond.field}
          onChange={e => onChange(NEW_CONDITION[e.target.value]())}>
          {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {(cond.field === 'assignee' || cond.field === 'due') && (
          <select className="input-premium" style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
            value={cond.op}
            onChange={e => onChange({ ...cond, op: e.target.value })}>
            {(cond.field === 'assignee' ? ASSIGNEE_OPS : DUE_OPS).map(([v, l]) =>
              <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        {cond.field === 'due' && cond.op === 'within_days' && (
          <input type="number" min={0} className="input-premium"
            style={{ width: 70, padding: '7px 10px', fontSize: 13 }}
            value={cond.value ?? 3}
            onChange={e => onChange({ ...cond, value: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
        )}
        <button type="button" className="iconbtn" title="Remove condition" onClick={onRemove}>
          <Icon name="x" size={14} />
        </button>
      </div>

      {isMulti && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {opts.length === 0
            ? <span style={{ fontSize: 11, color: 'var(--text-4)' }}>No options available.</span>
            : opts.map(o => {
                const on = (cond.values || []).includes(o.id);
                return (
                  <button type="button" key={o.id} onClick={() => toggleValue(o.id)} style={chip(on)}>
                    {o.color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: o.color }} />}
                    {o.label}
                  </button>
                );
              })}
        </div>
      )}
    </div>
  );
}

function RuleBuilder({ initial, statuses, lk, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    ...blankRule,
    ...initial,
    conditions: Array.isArray(initial?.conditions) ? initial.conditions : [],
    triggerStatusId: initial?.triggerStatusId || statuses[0]?.id || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const status = statuses.find(s => s.id === form.triggerStatusId);
  const action = ACTION_META[form.actionType];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const setCond = (i, next) => set('conditions', form.conditions.map((c, idx) => idx === i ? next : c));
  const addCond = () => set('conditions', [...form.conditions, NEW_CONDITION.project()]);
  const removeCond = (i) => set('conditions', form.conditions.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Give the rule a name.'); return; }
    if (!form.triggerStatusId) { setError('Pick a trigger status.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ ...form, name: form.name.trim(), message: form.message.trim() });
    } catch (err) {
      setError(err?.message || 'Could not save the rule.');
      setSaving(false);
    }
  };

  const sectionTag = (icon, color, text, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7,
        background: color.bg, color: color.fg }}><Icon name={icon} size={13} /></span>
      <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, flex: 1 }}>{text}</span>
      {right}
    </div>
  );

  const segBtn = (on) => ({
    padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
    border: '1px solid ' + (on ? 'var(--accent)' : 'transparent'),
    background: on ? 'var(--accent-tint)' : 'transparent',
    color: on ? 'var(--accent-hi)' : 'var(--text-3)',
  });

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <span className="modal-title">{initial?.id ? 'Edit rule' : 'New automation rule'}</span>
          <button className="iconbtn" onClick={onCancel}><Icon name="x" size={16} /></button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="modal-body" style={{ overflowY: 'auto', display: 'grid', gap: 18 }}>
            <div>
              <label style={fieldLabel}>Rule name</label>
              <input className="input-premium" style={{ width: '100%' }} value={form.name} autoFocus
                placeholder="e.g. Ping reviewer on hand-off" onChange={e => set('name', e.target.value)} />
            </div>

            {/* Trigger */}
            <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {sectionTag('flag', TRIGGER_COLOR, 'When this happens')}
              <label style={fieldLabel}>A task moves to status</label>
              <select className="input-premium" style={{ width: '100%' }} value={form.triggerStatusId}
                onChange={e => set('triggerStatusId', e.target.value)}>
                {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {/* Conditions */}
            <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {sectionTag('search', COND_COLOR, 'Only if (optional)',
                form.conditions.length > 1 && (
                  <div style={{ display: 'flex', gap: 2, background: 'var(--bg-0)', borderRadius: 8, padding: 2 }}>
                    <button type="button" style={segBtn(form.conditionMatch !== 'any')}
                      onClick={() => set('conditionMatch', 'all')}>Match all</button>
                    <button type="button" style={segBtn(form.conditionMatch === 'any')}
                      onClick={() => set('conditionMatch', 'any')}>Match any</button>
                  </div>
                ))}
              {form.conditions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>
                  No conditions — the rule fires for every task that hits this status.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {form.conditions.map((c, i) => (
                    <ConditionRow key={i} cond={c} lk={lk}
                      onChange={next => setCond(i, next)} onRemove={() => removeCond(i)} />
                  ))}
                </div>
              )}
              <button type="button" className="btn sm" onClick={addCond}>
                <span className="ic"><Icon name="plus" size={13} /></span> Add condition
              </button>
            </div>

            {/* Action */}
            <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 12, display: 'grid', gap: 16 }}>
              {sectionTag('zap', ACTION_COLOR, 'Do this')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={fieldLabel}>Action</label>
                  <select className="input-premium" style={{ width: '100%' }} value={form.actionType}
                    onChange={e => set('actionType', e.target.value)}>
                    <option value="notify">Notify</option>
                    <option value="notify_time_summary">Notify with time summary</option>
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Recipient</label>
                  <select className="input-premium" style={{ width: '100%' }} value={form.target}
                    onChange={e => set('target', e.target.value)}>
                    <option value="assignee">Task assignee</option>
                    <option value="reporter">Task reporter</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Custom message <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(optional)</span></label>
                <input className="input-premium" style={{ width: '100%' }} value={form.message}
                  placeholder={form.actionType === 'notify_time_summary'
                    ? 'Defaults to the logged-time summary'
                    : 'Defaults to the task title'}
                  onChange={e => set('message', e.target.value)} />
              </div>
            </div>

            {/* Live preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '12px 14px', background: 'var(--bg-0)', border: '1px dashed var(--border-2)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Preview</span>
              <StatusChip status={status} />
              {form.conditions.length > 0 && (
                <span style={{ fontSize: 11, color: '#ff9500', fontWeight: 600 }}>
                  only if {form.conditions.length} {form.conditions.length === 1 ? 'condition' : 'conditions'}
                </span>
              )}
              <FlowArrow />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
                <Icon name={action.icon} size={13} /> Notify {TARGET_LABEL[form.target]}
                {form.actionType === 'notify_time_summary' ? ' with time summary' : ''}
              </span>
            </div>

            {error && <div style={{ color: '#ff3d3d', fontSize: 12, fontWeight: 500 }}>{error}</div>}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : (initial?.id ? 'Save changes' : 'Create rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RuleCard({ rule, status, lk, onToggle, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const action = ACTION_META[rule.actionType] || ACTION_META.notify;
  const wrap = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const conds = rule.conditions || [];

  return (
    <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16,
      opacity: rule.enabled ? 1 : 0.55, transition: 'opacity 0.2s' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{rule.name}</span>
          {!rule.enabled && (
            <span style={{ fontSize: 9, fontFamily: 'var(--f-mono)', letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-3)', border: '1px solid var(--border-2)',
              borderRadius: 5, padding: '2px 6px', fontWeight: 600 }}>Paused</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <FlowBlock kind="When" icon="flag" color={TRIGGER_COLOR}>
            moves to <StatusChip status={status} label={rule.triggerStatusLabel} />
          </FlowBlock>
          <FlowArrow />
          <FlowBlock kind="Then" icon={action.icon} color={ACTION_COLOR}>
            Notify {TARGET_LABEL[rule.target] || 'the assignee'}
            {rule.actionType === 'notify_time_summary'
              ? <span style={{ color: 'var(--text-3)' }}>· with time summary</span> : null}
          </FlowBlock>
        </div>
        {conds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10,
              fontFamily: 'var(--f-mono)', textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#ff9500', fontWeight: 600 }}>
              <Icon name="search" size={11} /> Only if
            </span>
            {conds.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
                color: 'var(--text-2)' }}>
                {i > 0 && <span style={{ color: 'var(--text-4)', fontWeight: 600, marginRight: 3 }}>
                  {rule.conditionMatch === 'any' ? 'or' : 'and'}</span>}
                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-3)',
                  border: '1px solid var(--border-2)' }}>{describeCondition(c, lk)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div className="toggle-switch" data-active={rule.enabled} role="switch" aria-checked={rule.enabled}
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          onClick={() => !busy && wrap(() => onToggle(rule))}
          style={{ opacity: busy ? 0.6 : 1, marginRight: 4 }}>
          <div className="toggle-thumb" />
        </div>
        <button className="iconbtn" title="Edit" onClick={() => onEdit(rule)}><Icon name="edit" size={14} /></button>
        <button className="iconbtn" title="Delete" disabled={busy}
          onClick={() => wrap(() => onDelete(rule))}
          style={{ color: '#ff3d3d' }}><Icon name="trash" size={14} /></button>
      </div>
    </div>
  );
}

export default function AutomationPage({
  workstationId, statuses = [], projects = [], priorities = [], tags = [], myRole,
}) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // rule object, {} for new, or null when closed
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const lk = { projects, priorities, tags };
  const statusById = (id) => statuses.find(s => s.id === id);

  const load = useCallback(async () => {
    if (!workstationId) return;
    setLoading(true); setError('');
    try {
      const data = await listAutomationRules(workstationId);
      if (mounted.current) setRules(data);
    } catch (err) {
      if (mounted.current) setError(err?.message || 'Could not load automation rules.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [workstationId]);

  useEffect(() => { load(); }, [load]);

  // Belt-and-suspenders: the sidebar + route guard already keep non-owners out.
  if (myRole && myRole !== 'owner') {
    return (
      <div className="page">
        <div className="empty-state">
          <Icon name="lock" size={40} />
          <div className="empty-title">Owners only</div>
          <div className="empty-sub">Automation is available to workspace owners.</div>
        </div>
      </div>
    );
  }

  const handleSave = async (form) => {
    if (editing?.id) await updateAutomationRule(editing.id, form);
    else await createAutomationRule(workstationId, form);
    setEditing(null);
    await load();
  };
  const handleToggle = async (rule) => {
    await updateAutomationRule(rule.id, { enabled: !rule.enabled });
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
  };
  const handleDelete = async (rule) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete rule "${rule.name}"?`)) return;
    await deleteAutomationRule(rule.id);
    setRules(rs => rs.filter(r => r.id !== rule.id));
  };

  const activeCount = rules.filter(r => r.enabled).length;

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">Workspace · Owner</div>
          <h1>Automation</h1>
          <div className="sub">
            Run actions automatically when a task changes status — no manual nudges.
            {rules.length > 0 && (
              <> · <strong style={{ color: 'var(--text-2)' }}>{activeCount} active</strong> of {rules.length} {rules.length === 1 ? 'rule' : 'rules'}</>
            )}
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setEditing({})}>
            <span className="ic"><Icon name="plus" size={15} /></span> New rule
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, color: '#ff3d3d',
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="alert-circle" size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="empty-sub">Loading rules…</div></div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <Icon name="zap" size={44} />
          <div className="empty-title">No automation rules yet</div>
          <div className="empty-sub">
            Create a rule to notify the assignee when a task hits <em>In Review</em>, or send the
            reporter a logged-time summary when it's marked <em>Done</em>.
          </div>
          <button className="btn primary" onClick={() => setEditing({})}>
            <span className="ic"><Icon name="plus" size={15} /></span> Create your first rule
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule} status={statusById(rule.triggerStatusId)} lk={lk}
              onToggle={handleToggle} onEdit={setEditing} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {editing && (
        <RuleBuilder
          initial={editing.id ? editing : null}
          statuses={statuses}
          lk={lk}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

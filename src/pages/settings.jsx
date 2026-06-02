// settings.jsx — User settings, profile, and integrations

import { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';
import { updateMyAvatar, createTaskStatus, updateTaskStatus, deleteTaskStatus, reorderTaskStatuses, createProjectType, updateProjectType, deleteProjectType, reorderProjectTypes, createTag, updateTag, deleteTag, createTaskPriority, updateTaskPriority, deleteTaskPriority, reorderTaskPriorities, updateMemberRole, removeMember, cancelInvite, upsertPermission } from '../lib/db.js';
import { canDo, canModifyMember, assignableRoles, DEFAULT_PERMISSIONS, PERMISSION_LABELS, PERMISSION_GROUPS } from '../lib/permissions.js';
import { vcClearCache } from '../lib/vercel.js';

const INTEGRATION_ICON = {
  GitHub: 'github',
  Stripe: 'credit-card',
  Supabase: 'database',
  Slack: 'message-square',
  Linear: 'layers',
  Vercel: 'triangle',
};

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };

const formatJoined = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ── Tag settings row — color + inline name editing ───────────────
const TagSettingsRow = ({ tag, onUpdate, onDelete, totalCount }) => {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(tag.name); setColor(tag.color); }, [tag.id, tag.name, tag.color]);

  const handleNameBlur = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) { setName(tag.name); return; }
    setSaving(true);
    try { await onUpdate(tag.id, trimmed, color); }
    finally { setSaving(false); }
  };

  const handleColorChange = async (newColor) => {
    setColor(newColor);
    setSaving(true);
    try { await onUpdate(tag.id, name, newColor); }
    finally { setSaving(false); }
  };

  return (
    <div className="status-row">
      <div className="status-color-swatch" style={{ background: color }}>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          onBlur={e => handleColorChange(e.target.value)}
          className="status-color-input"
          title="Change colour"
        />
      </div>
      <input
        className="status-label-input"
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={handleNameBlur}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        disabled={saving}
        style={{ flex: 1 }}
      />
      <div className="status-row-actions">
        <button className="iconbtn danger" onClick={() => onDelete(tag.id)} title="Delete tag">
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Project type row — inline label editing ───────────────────────
const ProjectTypeRow = ({ type, index, total, onUpdate, onDelete, onMoveUp, onMoveDown, onDragStart, onDragOver, onDragEnd, isDragging }) => {
  const [label, setLabel] = useState(type.label);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabel(type.label); }, [type.id, type.label]);

  const handleLabelBlur = async () => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === type.label) { setLabel(type.label); return; }
    setSaving(true);
    try { await onUpdate(type.id, trimmed); }
    finally { setSaving(false); }
  };

  return (
    <div
      className={`status-row${isDragging ? ' dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
    >
      <div className="status-drag-handle" title="Drag to reorder">
        <Icon name="drag" size={14} />
      </div>
      <input
        className="status-label-input"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={handleLabelBlur}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        disabled={saving}
        style={{ flex: 1 }}
      />
      <div className="status-row-actions">
        <button className="iconbtn" onClick={onMoveUp} disabled={index === 0} title="Move up">
          <Icon name="chevU" size={12} />
        </button>
        <button className="iconbtn" onClick={onMoveDown} disabled={index === total - 1} title="Move down">
          <Icon name="chevD" size={12} />
        </button>
        <button className="iconbtn danger" onClick={() => onDelete(type.id)} disabled={total <= 1} title="Delete type">
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Priority row — inline label + color editing, drag to reorder ──
const PriorityRow = ({ priority, index, total, onUpdate, onDelete, onMoveUp, onMoveDown, onDragStart, onDragOver, onDragEnd, isDragging }) => {
  const [label, setLabel] = useState(priority.label);
  const [color, setColor] = useState(priority.color);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabel(priority.label); setColor(priority.color); }, [priority.id, priority.label, priority.color]);

  const handleLabelBlur = async () => {
    const trimmed = label.trim();
    if (!trimmed || (trimmed === priority.label && color === priority.color)) { setLabel(priority.label); return; }
    setSaving(true);
    try { await onUpdate(priority.id, trimmed, color); }
    finally { setSaving(false); }
  };

  const handleColorChange = async (newColor) => {
    setColor(newColor);
    setSaving(true);
    try { await onUpdate(priority.id, label, newColor); }
    finally { setSaving(false); }
  };

  return (
    <div
      className={`status-row${isDragging ? ' dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
    >
      <div className="status-drag-handle" title="Drag to reorder">
        <Icon name="drag" size={14} />
      </div>
      <div className="status-color-swatch" style={{ background: color }}>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          onBlur={e => handleColorChange(e.target.value)}
          className="status-color-input"
          title="Change color"
        />
      </div>
      <input
        className="status-label-input"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={handleLabelBlur}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        disabled={saving}
        style={{ flex: 1 }}
      />
      <div className="status-row-actions">
        <button className="iconbtn" onClick={onMoveUp} disabled={index === 0} title="Move up">
          <Icon name="chevU" size={12} />
        </button>
        <button className="iconbtn" onClick={onMoveDown} disabled={index === total - 1} title="Move down">
          <Icon name="chevD" size={12} />
        </button>
        <button className="iconbtn danger" onClick={() => onDelete(priority.id)} disabled={total <= 1} title="Delete priority">
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Status row — inline label/color editing ────────────────────────
const StatusRow = ({ status, index, total, onUpdate, onDelete, onMoveUp, onMoveDown, onDragStart, onDragOver, onDragEnd, isDragging }) => {
  const [label, setLabel] = useState(status.label);
  const [color, setColor] = useState(status.color);
  const [saving, setSaving] = useState(false);

  // Sync if parent status changes (e.g. after reorder)
  useEffect(() => {
    setLabel(status.label);
    setColor(status.color);
  }, [status.id, status.label, status.color]);

  const handleLabelBlur = async () => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === status.label) { setLabel(status.label); return; }
    setSaving(true);
    try {
      await onUpdate(status.id, { key: status.key, label: trimmed, color, sort_order: status.order, is_done: status.isDone });
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = async (newColor) => {
    setColor(newColor);
    setSaving(true);
    try {
      await onUpdate(status.id, { key: status.key, label, color: newColor, sort_order: status.order, is_done: status.isDone });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async () => {
    if (status.isDone) return; // already the done status, can't unset without picking another
    setSaving(true);
    try {
      await onUpdate(status.id, { key: status.key, label, color, sort_order: status.order, is_done: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`status-row${isDragging ? ' dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
    >
      <div className="status-drag-handle" title="Drag to reorder">
        <Icon name="drag" size={14} />
      </div>
      <div className="status-color-swatch" style={{ background: color }}>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          onBlur={e => handleColorChange(e.target.value)}
          className="status-color-input"
          title="Change color"
        />
      </div>
      <input
        className="status-label-input"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={handleLabelBlur}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        disabled={saving}
      />
      <span className="status-key-badge">{status.key}</span>
      <button
        className={`iconbtn${status.isDone ? ' active' : ''}`}
        onClick={handleToggleDone}
        disabled={saving || status.isDone}
        title={status.isDone ? 'This is the completion status' : 'Mark as completion status'}
        style={{ color: status.isDone ? '#22c55e' : undefined, fontSize: 14, fontWeight: 700, padding: '0 4px' }}
      >✓</button>
      <div className="status-row-actions">
        <button className="iconbtn" onClick={onMoveUp} disabled={index === 0} title="Move up">
          <Icon name="chevU" size={12} />
        </button>
        <button className="iconbtn" onClick={onMoveDown} disabled={index === total - 1} title="Move down">
          <Icon name="chevD" size={12} />
        </button>
        <button className="iconbtn danger" onClick={() => onDelete(status.id)} disabled={total <= 1} title="Delete status">
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  );
};

const genKey = (label) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'status';

// ── Members Section ────────────────────────────────────────────────
const avatarColor = (str = '') => {
  const colors = ['#0099ff', '#7c3aed', '#16a34a', '#d97706', '#ef4444', '#06b6d4', '#ec4899'];
  let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const MembersSection = ({ activeWorkstation, members, setMembers, pendingInvites, setPendingInvites, myRole, wsPermissions = {}, currentUserId, setTasks }) => {
  const [busy, setBusy] = useState({});
  const [removeConfirm, setRemoveConfirm] = useState(null);
  // Respect custom workspace permission overrides (previously passed {} here, which
  // silently ignored them and disagreed with the Collaboration page).
  const canChange = canDo(myRole, 'change_role', wsPermissions);
  const canRemove = canDo(myRole, 'remove_member', wsPermissions);

  const handleRoleChange = async (member, newRole) => {
    setBusy(b => ({ ...b, [member.userId]: true }));
    try {
      await updateMemberRole(activeWorkstation.id, member.userId, newRole);
      setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, role: newRole } : m));
    } finally {
      setBusy(b => ({ ...b, [member.userId]: false }));
    }
  };

  const handleRemove = async (member) => {
    setRemoveConfirm(member);
  };

  const confirmRemove = async () => {
    const member = removeConfirm;
    if (!member) return;
    setRemoveConfirm(null);
    setBusy(b => ({ ...b, [member.userId]: true }));
    try {
      await removeMember(activeWorkstation.id, member.userId);
      setMembers(prev => prev.filter(m => m.userId !== member.userId));
      // Mirror the server-side assignment clear so the UI doesn't keep a removed assignee.
      setTasks?.(prev => prev.map(t => t.assigneeId === member.userId ? { ...t, assigneeId: null } : t));
    } finally {
      setBusy(b => ({ ...b, [member.userId]: false }));
    }
  };

  const handleCancelInvite = async (invite) => {
    setBusy(b => ({ ...b, [invite.id]: true }));
    try {
      await cancelInvite(invite.id);
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    } finally {
      setBusy(b => ({ ...b, [invite.id]: false }));
    }
  };

  return (
    <div className="settings-section-inner slide-in-up">
      <div className="section-group">
        <div className="section-group-h">
          <span>Team Members</span>
          <p>People with access to this workspace.</p>
        </div>
        <div className="card" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
          <div className="card-pad" style={{ padding: 0 }}>
            {members.length === 0 ? (
              <div className="empty-state">No members yet. Use the Collaboration page to invite someone.</div>
            ) : (
              <div className="collab-members-grid">
                {members.map(member => (
                  <div key={member.userId} className="collab-member-card">
                    <div className="collab-member-top">
                      <div className="collab-member-avatar-container">
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: member.avatarUrl ? 'var(--bg-3)' : avatarColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                          {member.avatarUrl
                            ? <img src={member.avatarUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : member.avatar
                          }
                        </div>
                        <div className={`collab-member-status-dot ${member.userId !== currentUserId && Math.random() > 0.5 ? 'offline' : ''}`} />
                      </div>

                      <div className="collab-member-info">
                        <div className="collab-member-name">
                          {member.name}
                          {member.userId === currentUserId && <span className="collab-member-you-badge">You</span>}
                        </div>
                        <div className="collab-member-email">{member.email}</div>
                      </div>
                    </div>

                    <div className="collab-member-bottom">
                      {canChange && canModifyMember(myRole, member, currentUserId) ? (
                        <select
                          className="collab-role-select"
                          value={member.role}
                          onChange={e => handleRoleChange(member, e.target.value)}
                          disabled={busy[member.userId]}
                        >
                          {assignableRoles(myRole, wsPermissions).map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`collab-role-pill role-${member.role}`}>
                          {ROLE_LABEL[member.role]}
                        </span>
                      )}

                      <div className="collab-member-actions">
                        {canRemove && canModifyMember(myRole, member, currentUserId) && (
                          <button
                            className="collab-action-icon danger"
                            onClick={() => handleRemove(member)}
                            disabled={busy[member.userId]}
                            title="Remove member"
                          >
                            <Icon name="user-minus" size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingInvites.length > 0 && (
        <div className="section-group">
          <div className="section-group-h">
            <span>Pending Invites</span>
            <p>These users haven't accepted yet.</p>
          </div>
          <div className="card" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <div className="card-pad" style={{ padding: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingInvites.map(invite => {
                  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${invite.token}`;
                  return (
                    <div key={invite.id} className="collab-invite-card">
                      <div className="collab-invite-header">
                        <div className="collab-invite-icon">
                          <Icon name="mail" size={16} />
                        </div>
                        <div className="collab-invite-info">
                          <div className="collab-invite-email">{invite.email}</div>
                          <div className="collab-invite-meta">
                            <span style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-2)' }}>{ROLE_LABEL[invite.role]}</span>
                            <span style={{ opacity: 0.5 }}>•</span>
                            <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="collab-invite-actions">
                        <button onClick={() => navigator.clipboard.writeText(inviteUrl)} title="Copy link">
                          <Icon name="copy" size={14} /> Copy Link
                        </button>
                        <button className="cancel-btn" onClick={() => handleCancelInvite(invite)} disabled={busy[invite.id]} title="Cancel invite">
                          <Icon name="x" size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Remove Confirmation Modal */}
      {removeConfirm && (
        <div className="modal-overlay" onClick={() => setRemoveConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Remove Team Member</h3>
              <button className="modal-close" onClick={() => setRemoveConfirm(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove <strong className="highlight">{removeConfirm.name}</strong> from this workspace? They will instantly lose access to all projects and tasks.</p>
            </div>
            <div className="modal-ft">
              <button className="btn ghost" onClick={() => setRemoveConfirm(null)}>Cancel</button>
              <button className="btn primary danger" onClick={confirmRemove}>Remove Member</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Permissions Section ────────────────────────────────────────────
const PermissionsSection = ({ activeWorkstation, wsPermissions, setWsPermissions }) => {
  const roles = ['admin', 'member', 'viewer'];

  const getValue = (role, key) => {
    const override = `${role}:${key}`;
    if (override in wsPermissions) return wsPermissions[override] === true || wsPermissions[override] === 'true';
    return DEFAULT_PERMISSIONS[role]?.[key] ?? false;
  };

  const handleToggle = async (role, key, newVal) => {
    const flatKey = `${role}:${key}`;
    setWsPermissions(prev => ({ ...prev, [flatKey]: newVal }));
    try {
      await upsertPermission(activeWorkstation.id, role, key, newVal);
    } catch {
      setWsPermissions(prev => ({ ...prev, [flatKey]: !newVal }));
    }
  };

  return (
    <div className="settings-section-inner slide-in-up">
      <div className="section-group">
        <div className="section-group-h">
          <span>Role Permissions</span>
          <p>Control what each role can do in this workspace. Owner always has full access.</p>
        </div>
        <div className="card">
          <div className="card-pad">
            <div className="perm-grid">
              <div className="perm-row perm-header">
                <div className="perm-action-col">Action</div>
                {roles.map(r => (
                  <div key={r} className="perm-role-col">{ROLE_LABEL[r]}</div>
                ))}
                <div className="perm-role-col" style={{ color: 'var(--text-3)' }}>Owner</div>
              </div>
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label} className="perm-group">
                  <div className="perm-row perm-group-head">
                    <div className="perm-action-col">{group.label}</div>
                    {roles.map(r => <div key={r} className="perm-role-col" />)}
                    <div className="perm-role-col" />
                  </div>
                  {group.keys.map(key => (
                    <div key={key} className="perm-row">
                      <div className="perm-action-col">{PERMISSION_LABELS[key]}</div>
                      {roles.map(role => {
                        const val = getValue(role, key);
                        return (
                          <div key={role} className="perm-role-col">
                            <button
                              className={'perm-toggle' + (val ? ' on' : '')}
                              onClick={() => handleToggle(role, key, !val)}
                              title={val ? 'Allowed — click to revoke' : 'Not allowed — click to grant'}
                            >
                              {val ? <Icon name="check" size={12} /> : <Icon name="minus" size={12} />}
                            </button>
                          </div>
                        );
                      })}
                      <div className="perm-role-col">
                        <div className="perm-toggle on disabled" title="Owner always has access">
                          <Icon name="check" size={12} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Settings = ({ user, activeWorkstation, onUserUpdate, statuses = [], setStatuses, projectTypes = [], setProjectTypes, tags = [], setTags, priorities = [], setPriorities, members = [], setMembers, pendingInvites = [], setPendingInvites, wsPermissions = {}, setWsPermissions, myRole = 'viewer', setTasks }) => {
  const fileRef = useRef(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarClick = () => {
    setAvatarError('');
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('Only JPEG, PNG, WebP, or GIF files are allowed.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image must be under 2 MB.');
      return;
    }

    setAvatarLoading(true);
    setAvatarError('');
    try {
      const path = `${user.id}/avatar`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${publicUrl}?v=${Date.now()}`;

      await updateMyAvatar(url);
      onUserUpdate?.({ avatarUrl: url });
    } catch (err) {
      console.error(err);
      setAvatarError('Upload failed. Please try again.');
    } finally {
      setAvatarLoading(false);
    }
  };

  // ── GitHub integration ──────────────────────────────────────────────
  const [githubInteg, setGithubInteg] = useState(null);
  const [ghLoading, setGhLoading] = useState(true);
  const [ghError, setGhError] = useState('');
  const [ghDisconnecting, setGhDisconnecting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    supabase.from('user_integrations').select('username, display_name, avatar_url, email, scopes, connected_at').eq('user_id', user.id).eq('provider', 'github').maybeSingle()
      .then(({ data }) => setGithubInteg(data || null))
      .catch(() => setGithubInteg(null))
      .finally(() => setGhLoading(false));
  }, [user?.id]);

  const connectGitHub = () => {
    setGhError('');
    const EDGE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oauth`;
    const params = new URLSearchParams({
      client_id: 'Ov23li4xj01qD2wkGOPk',
      scope: 'repo delete_repo read:user user:email',
      state: user.id,
      redirect_uri: EDGE_FN,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };

  const disconnectGitHub = async () => {
    setGhDisconnecting(true);
    try {
      await supabase.from('user_integrations').delete().eq('user_id', user.id).eq('provider', 'github');
      setGithubInteg(null);
    } catch (e) {
      setGhError(e.message);
    } finally {
      setGhDisconnecting(false);
    }
  };

  // ── Vercel integration ──────────────────────────────────────────────
  const [vercelInteg, setVercelInteg] = useState(null);
  const [vcLoading, setVcLoading] = useState(true);
  const [vcDisconnecting, setVcDisconnecting] = useState(false);
  const [vcError, setVcError] = useState('');
  const [vcPATOpen, setVcPATOpen] = useState(false);
  const [vcToken, setVcToken] = useState('');
  const [vcSaving, setVcSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_integrations').select('username, display_name, email, connected_at').eq('user_id', user.id).eq('provider', 'vercel').maybeSingle()
      .then(({ data }) => setVercelInteg(data || null))
      .catch(() => setVercelInteg(null))
      .finally(() => setVcLoading(false));
  }, [user?.id]);

  const connectVercel = () => {
    setVcError('');
    setVcToken('');
    setVcPATOpen(true);
  };

  const saveVercelToken = async () => {
    const token = vcToken.trim();
    if (!token) { setVcError('Paste your Vercel token first.'); return; }
    setVcSaving(true);
    setVcError('');
    try {
      const { data, error } = await supabase.functions.invoke('save-vercel-token', {
        body: { token },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || 'Failed to connect Vercel.');
      vcClearCache();
      setVercelInteg({ username: data.username, display_name: data.display_name, connected_at: data.connected_at });
      setVcPATOpen(false);
      setVcToken('');
    } catch (e) {
      setVcError(e.message || 'Failed to connect Vercel.');
    } finally {
      setVcSaving(false);
    }
  };

  const disconnectVercel = async () => {
    setVcDisconnecting(true);
    try {
      await supabase.from('user_integrations').delete().eq('user_id', user.id).eq('provider', 'vercel');
      vcClearCache();
      setVercelInteg(null);
    } catch (e) {
      setVcError(e.message);
    } finally {
      setVcDisconnecting(false);
    }
  };

  const [prefs, setPrefs] = useState([
    { label: 'Email Notifications', value: true },
    { label: 'Daily Summary', value: true },
    { label: 'Weekly Reports', value: true },
    { label: 'Productivity Insights', value: true },
  ]);

  const togglePref = (idx) =>
    setPrefs(prev => prev.map((p, i) => i === idx ? { ...p, value: !p.value } : p));

  // ── Task Status management ────────────────────────────────────────
  const sorted = [...statuses].sort((a, b) => a.order - b.order);

  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#888888');
  const [addErr, setAddErr] = useState('');
  const [addSaving, setAddSaving] = useState('');

  const handleUpdateStatus = async (id, data) => {
    const updated = await updateTaskStatus(id, data);
    setStatuses(prev => prev.map(s => {
      if (s.id === id) return updated;
      if (data.is_done) return { ...s, isDone: false }; // DB cleared all others
      return s;
    }));
  };

  const handleDeleteStatus = async (id) => {
    if (statuses.length <= 1) return;
    await deleteTaskStatus(id);
    setStatuses(prev => prev.filter(s => s.id !== id));
  };

  const handleMove = async (index, dir) => {
    const list = [...sorted];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const orderedIds = list.map(s => s.id);
    // Optimistic update
    setStatuses(prev => {
      const newStatuses = prev.map(s => {
        const pos = orderedIds.indexOf(s.id);
        return pos !== -1 ? { ...s, order: pos } : s;
      });
      return newStatuses;
    });
    try {
      await reorderTaskStatuses(activeWorkstation.id, orderedIds);
    } catch (err) {
      console.error('Reorder failed', err);
    }
  };

  const handleAddStatus = async () => {
    const label = newLabel.trim();
    if (!label) { setAddErr('Label is required.'); return; }
    const key = genKey(label);
    if (statuses.some(s => s.key === key)) {
      setAddErr(`Key "${key}" already exists. Use a different label.`);
      return;
    }
    setAddErr('');
    setAddSaving(true);
    try {
      const created = await createTaskStatus(activeWorkstation.id, {
        key,
        label,
        color: newColor,
        sort_order: statuses.length,
      });
      setStatuses(prev => [...prev, created]);
      setNewLabel('');
      setNewColor('#888888');
    } catch (e) {
      setAddErr(e.message || 'Failed to create status.');
    } finally {
      setAddSaving(false);
    }
  };

  // ── Project Type management ───────────────────────────────────────
  const sortedTypes = [...projectTypes].sort((a, b) => a.order - b.order);

  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [typeAddErr, setTypeAddErr] = useState('');
  const [typeAddSaving, setTypeAddSaving] = useState(false);
  const [typeDragIdx, setTypeDragIdx] = useState(null);
  const [typeDeleteConfirm, setTypeDeleteConfirm] = useState({ isOpen: false, id: null, label: '' });

  const handleUpdateProjectType = async (id, label) => {
    const updated = await updateProjectType(id, label);
    setProjectTypes(prev => prev.map(pt => pt.id === id ? updated : pt));
  };

  const handleDeleteTypeClick = (id) => {
    const pt = projectTypes.find(p => p.id === id);
    setTypeDeleteConfirm({ isOpen: true, id, label: pt?.label || 'type' });
  };

  const handleConfirmDeleteType = async () => {
    const { id } = typeDeleteConfirm;
    setTypeDeleteConfirm({ isOpen: false, id: null, label: '' });
    try {
      await deleteProjectType(id);
      setProjectTypes(prev => prev.filter(pt => pt.id !== id));
    } catch (err) {
      console.error('Delete type failed', err);
    }
  };

  const handleTypeMove = async (index, dir) => {
    const list = [...sortedTypes];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const orderedIds = list.map(pt => pt.id);
    setProjectTypes(prev => {
      return prev.map(pt => {
        const pos = orderedIds.indexOf(pt.id);
        return pos !== -1 ? { ...pt, order: pos } : pt;
      });
    });
    try {
      await reorderProjectTypes(activeWorkstation.id, orderedIds);
    } catch (err) {
      console.error('Reorder types failed', err);
    }
  };

  const handleAddProjectType = async () => {
    const label = newTypeLabel.trim();
    if (!label) { setTypeAddErr('Label is required.'); return; }
    setTypeAddErr('');
    setTypeAddSaving(true);
    try {
      const created = await createProjectType(activeWorkstation.id, label);
      setProjectTypes(prev => [...prev, created]);
      setNewTypeLabel('');
    } catch (e) {
      setTypeAddErr(e.message || 'Failed to create type.');
    } finally {
      setTypeAddSaving(false);
    }
  };

  const handleTypeDragStart = (e, index) => {
    setTypeDragIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTypeDragOver = (e, index) => {
    e.preventDefault();
    if (typeDragIdx === null || typeDragIdx === index) return;
    const list = [...sortedTypes];
    const draggedItem = list[typeDragIdx];
    list.splice(typeDragIdx, 1);
    list.splice(index, 0, draggedItem);
    const orderedIds = list.map(pt => pt.id);
    setProjectTypes(prev => prev.map(pt => {
      const pos = orderedIds.indexOf(pt.id);
      return pos !== -1 ? { ...pt, order: pos } : pt;
    }));
    setTypeDragIdx(index);
  };

  const handleTypeDragEnd = async () => {
    setTypeDragIdx(null);
    const orderedIds = sortedTypes.map(pt => pt.id);
    try {
      await reorderProjectTypes(activeWorkstation.id, orderedIds);
    } catch (err) {
      console.error('Reorder types failed', err);
    }
  };

  // ── Tag management ────────────────────────────────────────────────
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0099ff');
  const [tagAddErr, setTagAddErr] = useState('');
  const [tagAddSaving, setTagAddSaving] = useState(false);
  const [tagDeleteConfirm, setTagDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });

  const handleUpdateTag = async (id, name, color) => {
    const updated = await updateTag(id, name, color);
    setTags(prev => prev.map(t => t.id === id ? updated : t));
  };

  const handleDeleteTagClick = (id) => {
    const t = tags.find(t => t.id === id);
    setTagDeleteConfirm({ isOpen: true, id, name: t?.name || 'tag' });
  };

  const handleConfirmDeleteTag = async () => {
    const { id } = tagDeleteConfirm;
    setTagDeleteConfirm({ isOpen: false, id: null, name: '' });
    try {
      await deleteTag(id);
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Delete tag failed', err);
    }
  };

  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) { setTagAddErr('Name is required.'); return; }
    if (tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      setTagAddErr('A tag with this name already exists.');
      return;
    }
    setTagAddErr('');
    setTagAddSaving(true);
    try {
      const created = await createTag(activeWorkstation.id, name, newTagColor);
      setTags(prev => [...prev, created]);
      setNewTagName('');
      setNewTagColor('#0099ff');
    } catch (e) {
      setTagAddErr(e.message || 'Failed to create tag.');
    } finally {
      setTagAddSaving(false);
    }
  };

  // ── Priority management ───────────────────────────────────────────
  const sortedPriorities = [...priorities].sort((a, b) => a.order - b.order);

  const [newPriorityLabel, setNewPriorityLabel] = useState('');
  const [newPriorityColor, setNewPriorityColor] = useState('#888888');
  const [priorityAddErr, setPriorityAddErr] = useState('');
  const [priorityAddSaving, setPriorityAddSaving] = useState(false);
  const [priorityDragIdx, setPriorityDragIdx] = useState(null);
  const [priorityDeleteConfirm, setPriorityDeleteConfirm] = useState({ isOpen: false, id: null, label: '' });

  const handleUpdatePriority = async (id, label, color) => {
    const updated = await updateTaskPriority(id, label, color);
    setPriorities(prev => prev.map(p => p.id === id ? updated : p));
  };

  const handleDeletePriorityClick = (id) => {
    const p = priorities.find(p => p.id === id);
    setPriorityDeleteConfirm({ isOpen: true, id, label: p?.label || 'priority' });
  };

  const handleConfirmDeletePriority = async () => {
    const { id } = priorityDeleteConfirm;
    setPriorityDeleteConfirm({ isOpen: false, id: null, label: '' });
    try {
      await deleteTaskPriority(id);
      setPriorities(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Delete priority failed', err);
    }
  };

  const handlePriorityMove = async (index, dir) => {
    const list = [...sortedPriorities];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const orderedIds = list.map(p => p.id);
    setPriorities(prev => prev.map(p => {
      const pos = orderedIds.indexOf(p.id);
      return pos !== -1 ? { ...p, order: pos } : p;
    }));
    try { await reorderTaskPriorities(activeWorkstation.id, orderedIds); }
    catch (err) { console.error('Reorder priorities failed', err); }
  };

  const handleAddPriority = async () => {
    const label = newPriorityLabel.trim();
    if (!label) { setPriorityAddErr('Label is required.'); return; }
    setPriorityAddErr('');
    setPriorityAddSaving(true);
    try {
      const created = await createTaskPriority(activeWorkstation.id, label, newPriorityColor);
      setPriorities(prev => [...prev, created]);
      setNewPriorityLabel('');
      setNewPriorityColor('#888888');
    } catch (e) {
      setPriorityAddErr(e.message || 'Failed to create priority.');
    } finally {
      setPriorityAddSaving(false);
    }
  };

  const handlePriorityDragStart = (e, index) => {
    setPriorityDragIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePriorityDragOver = (e, index) => {
    e.preventDefault();
    if (priorityDragIdx === null || priorityDragIdx === index) return;
    const list = [...sortedPriorities];
    const dragged = list[priorityDragIdx];
    list.splice(priorityDragIdx, 1);
    list.splice(index, 0, dragged);
    const orderedIds = list.map(p => p.id);
    setPriorities(prev => prev.map(p => {
      const pos = orderedIds.indexOf(p.id);
      return pos !== -1 ? { ...p, order: pos } : p;
    }));
    setPriorityDragIdx(index);
  };

  const handlePriorityDragEnd = async () => {
    setPriorityDragIdx(null);
    const orderedIds = sortedPriorities.map(p => p.id);
    try { await reorderTaskPriorities(activeWorkstation.id, orderedIds); }
    catch (err) { console.error('Reorder priorities failed', err); }
  };

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('gh_callback') === '1' || params.get('vc_callback') === '1')
      ? 'integrations'
      : 'profile';
  });
  const [activeSubTab, setActiveSubTab] = useState('kanban-cols'); // for nested navigation
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, label: '' });

  const handleDeleteClick = (id) => {
    const s = statuses.find(st => st.id === id);
    setDeleteConfirm({ isOpen: true, id, label: s?.label || 'status' });
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, id: null, label: '' });
    try {
      await deleteTaskStatus(id);
      setStatuses(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const navItems = [
    { id: 'profile', label: 'Profile & General', icon: 'users' },
    { id: 'workspace', label: 'Workspace', icon: 'layers' },
    {
      id: 'kanban',
      label: 'Task Kanban',
      icon: 'list',
      children: [
        { id: 'kanban-cols', label: 'Column Management' },
        { id: 'kanban-types', label: 'Project Types' },
        { id: 'kanban-tags', label: 'Task Tags' },
        { id: 'kanban-priorities', label: 'Priority Types' },
      ]
    },
    { id: 'members', label: 'Members', icon: 'users' },
    ...(myRole === 'owner' ? [{ id: 'permissions', label: 'Permissions', icon: 'shield' }] : []),
    { id: 'integrations', label: 'Integrations', icon: 'link' },
  ];

  const [dragIdx, setDragIdx] = useState(null);

  const handleDragStart = (e, index) => {
    setDragIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === index) return;

    const list = [...sorted];
    const draggedItem = list[dragIdx];
    list.splice(dragIdx, 1);
    list.splice(index, 0, draggedItem);

    // Update local state optimistically
    const orderedIds = list.map(s => s.id);
    setStatuses(prev => {
      const newStatuses = prev.map(s => {
        const pos = orderedIds.indexOf(s.id);
        return pos !== -1 ? { ...s, order: pos } : s;
      });
      return newStatuses;
    });
    setDragIdx(index);
  };

  const handleDragEnd = async () => {
    setDragIdx(null);
    const orderedIds = sorted.map(s => s.id);
    try {
      await reorderTaskStatuses(activeWorkstation.id, orderedIds);
    } catch (err) {
      console.error('Reorder failed', err);
    }
  };

  return (
    <div className="page-wide">
      <div className="settings-layout-premium">
        {/* Sidebar Navigation */}
        <aside className="settings-sidebar-premium">
          <div className="settings-sb-head">
            <div className="crumb">SYSTEM</div>
            <h2>Settings</h2>
            <p className="sb-desc">Configure your personal experience and workspace defaults.</p>
          </div>
          <nav className="settings-sb-nav">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <div key={item.id} className="settings-nav-group">
                  <button
                    className={`settings-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (item.children) setActiveSubTab(item.children[0].id);
                    }}
                  >
                    <div className="icon-box"><Icon name={item.icon} size={16} /></div>
                    <span>{item.label}</span>
                    {isActive && !item.children && <div className="active-indicator" />}
                  </button>

                  {isActive && item.children && (
                    <div className="settings-nav-sub">
                      {item.children.map(child => (
                        <button
                          key={child.id}
                          className={`settings-nav-sub-item ${activeSubTab === child.id ? 'active' : ''}`}
                          onClick={() => setActiveSubTab(child.id)}
                        >
                          {child.label}
                          {activeSubTab === child.id && <div className="dot-indicator" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="settings-main-premium">
          <div className="settings-section-view">
            {activeTab === 'profile' && (
              <div className="settings-section-inner slide-in-up">
                {/* Profile Section */}
                <div className="section-group">
                  <div className="section-group-h">
                    <span>Public Profile</span>
                    <p>Manage your presence and account details.</p>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                      />
                      <div className="profile-section-premium">
                        <div
                          className={`profile-avatar-upload${avatarLoading ? ' uploading' : ''}`}
                          onClick={handleAvatarClick}
                          title="Change avatar"
                        >
                          {user?.avatarUrl
                            ? <img src={user.avatarUrl} alt={user?.name} className="profile-avatar-img" />
                            : <div className="profile-avatar-large">{user?.avatar || (user?.name?.[0] || 'U').toUpperCase()}</div>
                          }
                          <div className="profile-avatar-overlay">
                            {avatarLoading
                              ? <div className="avatar-spinner" />
                              : <><Icon name="camera" size={18} /><span>Change</span></>
                            }
                          </div>
                        </div>
                        <div className="profile-info-premium">
                          <div className="profile-name-premium">{user?.name || '—'}</div>
                          <div className="profile-email-premium">{user?.email || '—'}</div>
                          <div className="profile-meta-premium">Joined {formatJoined(user?.joinedAt)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                <div className="section-group">
                  <div className="section-group-h">
                    <span>Notifications & Alerts</span>
                    <p>Stay updated on workspace activity and task changes.</p>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <div className="preferences-list-premium">
                        {prefs.map((pref, idx) => (
                          <div key={idx} className="preference-item-premium">
                            <div className="pref-info">
                              <div className="pref-label">{pref.label}</div>
                              <div className="pref-sub">Receive updates about your workspace activity.</div>
                            </div>
                            <div
                              className="toggle-switch-premium"
                              data-active={String(pref.value)}
                              onClick={() => togglePref(idx)}
                              role="switch"
                              aria-checked={pref.value}
                              tabIndex={0}
                            >
                              <div className="toggle-thumb" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'workspace' && (
              <div className="settings-section-inner slide-in-up">
                <div className="section-group">
                  <div className="section-group-h">
                    <span>General Configuration</span>
                    <p>Adjust settings for the entire workspace.</p>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <div className="settings-form-premium">
                        <div className="settings-field-premium">
                          <label>Workspace Name</label>
                          <input type="text" defaultValue={activeWorkstation?.name || ''} className="input-premium" />
                        </div>
                        <div className="settings-field-premium">
                          <label>Organization / Team</label>
                          <input type="text" defaultValue="Solo Freelancer" className="input-premium" />
                        </div>
                        <div className="settings-field-premium">
                          <label>Access Role</label>
                          <div className="role-badge-premium">{ROLE_LABEL[activeWorkstation?.role] || 'Member'}</div>
                        </div>
                        <div className="settings-form-actions">
                          <button className="btn primary">Update Workspace</button>
                          <button className="btn ghost">Reset</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'kanban' && activeSubTab === 'kanban-cols' && (
              <div className="settings-section-inner slide-in-up">
                <div className="section-group">
                  <div className="section-group-h">
                    <span>Column Management</span>
                    <p>Define the lifecycle of your tasks and projects.</p>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <div className="status-hero-premium">
                        <div className="hero-icon"><Icon name="list" size={20} /></div>
                        <div className="hero-content">
                          <h3>Kanban Board Layout</h3>
                          <p>Define the stages of your workflow. These columns are shared across all projects in this workspace.</p>
                        </div>
                      </div>

                      <div className="status-list-premium">
                        {sorted.map((s, i) => (
                          <StatusRow
                            key={s.id}
                            status={s}
                            index={i}
                            total={sorted.length}
                            onUpdate={handleUpdateStatus}
                            onDelete={handleDeleteClick}
                            onMoveUp={() => handleMove(i, -1)}
                            onMoveDown={() => handleMove(i, 1)}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            isDragging={dragIdx === i}
                          />
                        ))}
                      </div>

                      <div className="status-add-refined">
                        <div className="add-title">Add New Stage</div>
                        <div className="add-row-refined">
                          <div className="color-btn-premium" style={{ background: newColor }}>
                            <input
                              type="color"
                              value={newColor}
                              onChange={e => setNewColor(e.target.value)}
                              className="color-input-abs"
                            />
                          </div>
                          <input
                            className="label-input-refined"
                            value={newLabel}
                            onChange={e => { setNewLabel(e.target.value); setAddErr(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleAddStatus()}
                            placeholder="Enter status name..."
                          />
                          <button className="btn primary sm" onClick={handleAddStatus} disabled={addSaving || !newLabel.trim()}>
                            <Icon name="plus" size={12} /> Add
                          </button>
                        </div>
                        {newLabel.trim() && (
                          <div className="key-hint">Internal Key: <code>{genKey(newLabel.trim())}</code></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'kanban' && activeSubTab === 'kanban-types' && (
              <div className="settings-section-inner slide-in-up">
                {/* Project Types */}
                <div className="section-group">
                  <div className="section-group-h">
                    <span>Project Types</span>
                    <p>Define categories for your projects to organize your workspace.</p>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <div className="status-hero-premium">
                        <div className="hero-icon"><Icon name="layers" size={20} /></div>
                        <div className="hero-content">
                          <h3>Project Categories</h3>
                          <p>These types appear in the project creation form. Drag to reorder or rename inline.</p>
                        </div>
                      </div>

                      <div className="status-list-premium">
                        {sortedTypes.map((pt, i) => (
                          <ProjectTypeRow
                            key={pt.id}
                            type={pt}
                            index={i}
                            total={sortedTypes.length}
                            onUpdate={handleUpdateProjectType}
                            onDelete={handleDeleteTypeClick}
                            onMoveUp={() => handleTypeMove(i, -1)}
                            onMoveDown={() => handleTypeMove(i, 1)}
                            onDragStart={handleTypeDragStart}
                            onDragOver={handleTypeDragOver}
                            onDragEnd={handleTypeDragEnd}
                            isDragging={typeDragIdx === i}
                          />
                        ))}
                      </div>

                      <div className="status-add-refined">
                        <div className="add-title">Add New Type</div>
                        <div className="add-row-refined">
                          <input
                            className="label-input-refined"
                            value={newTypeLabel}
                            onChange={e => { setNewTypeLabel(e.target.value); setTypeAddErr(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleAddProjectType()}
                            placeholder="e.g. Client / Freelance..."
                          />
                          <button className="btn primary sm" onClick={handleAddProjectType} disabled={typeAddSaving || !newTypeLabel.trim()}>
                            <Icon name="plus" size={12} /> Add
                          </button>
                        </div>
                        {typeAddErr && <div className="key-hint" style={{ color: 'var(--danger)' }}>{typeAddErr}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'kanban' && activeSubTab === 'kanban-tags' && (
              <div className="settings-section-inner slide-in-up">
                <div className="section-group">
                  <div className="section-group-h">
                    <span>Task Tags</span>
                    <p>Create and manage workspace tags. Assign them to tasks to filter and organise your work.</p>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <div className="status-hero-premium">
                        <div className="hero-icon"><Icon name="tag" size={20} /></div>
                        <div className="hero-content">
                          <h3>Workspace Tags</h3>
                          <p>Tags are shared across all projects. Click the colour swatch to change a tag's colour; rename inline by editing the label.</p>
                        </div>
                      </div>

                      <div className="status-list-premium">
                        {[...tags].sort((a, b) => a.name.localeCompare(b.name)).map(tag => (
                          <TagSettingsRow
                            key={tag.id}
                            tag={tag}
                            onUpdate={handleUpdateTag}
                            onDelete={handleDeleteTagClick}
                            totalCount={tags.length}
                          />
                        ))}
                        {tags.length === 0 && (
                          <div style={{ color: 'var(--text-4)', fontSize: 12, padding: '12px 0', fontFamily: 'var(--f-mono)' }}>
                            No tags yet. Add one below.
                          </div>
                        )}
                      </div>

                      <div className="status-add-refined">
                        <div className="add-title">Add New Tag</div>
                        <div className="add-row-refined">
                          <div className="color-btn-premium" style={{ background: newTagColor }}>
                            <input
                              type="color"
                              value={newTagColor}
                              onChange={e => setNewTagColor(e.target.value)}
                              className="color-input-abs"
                            />
                          </div>
                          <input
                            className="label-input-refined"
                            value={newTagName}
                            onChange={e => { setNewTagName(e.target.value); setTagAddErr(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                            placeholder="e.g. bug, feature, ui…"
                          />
                          <button className="btn primary sm" onClick={handleAddTag} disabled={tagAddSaving || !newTagName.trim()}>
                            <Icon name="plus" size={12} /> Add
                          </button>
                        </div>
                        {tagAddErr && <div className="key-hint" style={{ color: 'var(--danger)' }}>{tagAddErr}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'kanban' && activeSubTab === 'kanban-priorities' && (
              <div className="settings-section-inner slide-in-up">
                <div className="section-group">
                  <div className="section-group-h">
                    <span>Priority Types</span>
                    <p>Define priority levels for tasks. Drag to reorder, click the color swatch to change color, rename inline.</p>
                  </div>
                  <div className="card">
                    <div className="card-pad">
                      <div className="status-hero-premium">
                        <div className="hero-icon"><Icon name="flag" size={20} /></div>
                        <div className="hero-content">
                          <h3>Task Priorities</h3>
                          <p>These priorities appear in task forms and filters. At least one priority must exist.</p>
                        </div>
                      </div>

                      <div className="status-list-premium">
                        {sortedPriorities.map((pr, i) => (
                          <PriorityRow
                            key={pr.id}
                            priority={pr}
                            index={i}
                            total={sortedPriorities.length}
                            onUpdate={handleUpdatePriority}
                            onDelete={handleDeletePriorityClick}
                            onMoveUp={() => handlePriorityMove(i, -1)}
                            onMoveDown={() => handlePriorityMove(i, 1)}
                            onDragStart={handlePriorityDragStart}
                            onDragOver={handlePriorityDragOver}
                            onDragEnd={handlePriorityDragEnd}
                            isDragging={priorityDragIdx === i}
                          />
                        ))}
                        {sortedPriorities.length === 0 && (
                          <div style={{ color: 'var(--text-4)', fontSize: 12, padding: '12px 0', fontFamily: 'var(--f-mono)' }}>
                            No priorities defined yet.
                          </div>
                        )}
                      </div>

                      <div className="status-add-refined">
                        <div className="add-title">Add New Priority</div>
                        <div className="add-row-refined">
                          <div className="color-btn-premium" style={{ background: newPriorityColor }}>
                            <input
                              type="color"
                              value={newPriorityColor}
                              onChange={e => setNewPriorityColor(e.target.value)}
                              className="color-input-abs"
                            />
                          </div>
                          <input
                            className="label-input-refined"
                            value={newPriorityLabel}
                            onChange={e => { setNewPriorityLabel(e.target.value); setPriorityAddErr(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleAddPriority()}
                            placeholder="e.g. Urgent, Blocker…"
                          />
                          <button className="btn primary sm" onClick={handleAddPriority} disabled={priorityAddSaving || !newPriorityLabel.trim()}>
                            <Icon name="plus" size={12} /> Add
                          </button>
                        </div>
                        {priorityAddErr && <div className="key-hint" style={{ color: 'var(--danger)' }}>{priorityAddErr}</div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delete confirmation */}
                {priorityDeleteConfirm.isOpen && (
                  <div className="modal-overlay" onClick={() => setPriorityDeleteConfirm({ isOpen: false, id: null, label: '' })}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                      <div className="modal-title">Delete Priority</div>
                      <p className="modal-body">Delete <strong>{priorityDeleteConfirm.label}</strong>? Tasks using this priority will have it cleared.</p>
                      <div className="modal-actions">
                        <button className="btn" onClick={() => setPriorityDeleteConfirm({ isOpen: false, id: null, label: '' })}>Cancel</button>
                        <button className="btn danger" onClick={handleConfirmDeletePriority}>Delete</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'members' && (
              <MembersSection
                activeWorkstation={activeWorkstation}
                members={members}
                setMembers={setMembers}
                pendingInvites={pendingInvites}
                setPendingInvites={setPendingInvites}
                myRole={myRole}
                wsPermissions={wsPermissions}
                currentUserId={user?.id}
                setTasks={setTasks}
              />
            )}

            {activeTab === 'permissions' && myRole === 'owner' && (
              <PermissionsSection
                activeWorkstation={activeWorkstation}
                wsPermissions={wsPermissions}
                setWsPermissions={setWsPermissions}
              />
            )}

            {activeTab === 'integrations' && (
              <div className="settings-section-inner slide-in-up">
                <div className="section-group">
                  <div className="section-group-h">
                    <span>Connected Platforms</span>
                    <p>Sync your external developer accounts. Your tokens are stored securely per user.</p>
                  </div>

                  {ghError && (
                    <div className="form-error" style={{ marginBottom: 12 }}>{ghError}</div>
                  )}

                  {/* GitHub card */}
                  <div className={`intg-real-card ${githubInteg ? 'connected' : ''}`}>
                    <div className="intg-real-left">
                      <div className="intg-real-icon">
                        <Icon name="github" size={22} />
                      </div>
                      <div className="intg-real-info">
                        <div className="intg-real-name">GitHub</div>
                        {ghLoading ? (
                          <div className="intg-real-sub">Checking…</div>
                        ) : githubInteg ? (
                          <div className="intg-real-sub connected">
                            {githubInteg.avatar_url && <img src={githubInteg.avatar_url} className="intg-gh-av" alt="" />}
                            @{githubInteg.username}
                            <span className="intg-connected-dot" />
                            Connected
                            {githubInteg.connected_at && (
                              <span className="intg-connected-time" style={{ marginLeft: 4 }}>
                                · {new Date(githubInteg.connected_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="intg-real-sub">Access repos, PRs, issues and activity</div>
                        )}
                      </div>
                    </div>
                    <div className="intg-real-right">
                      {githubInteg ? (
                        <button className="intg-btn-disconnect" onClick={disconnectGitHub} disabled={ghDisconnecting}>
                          <Icon name="x" size={13} /> {ghDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      ) : (
                        <button className="intg-btn-connect" onClick={connectGitHub} disabled={ghLoading}>
                          <Icon name="github" size={13} /> Connect GitHub
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vercel card */}
                  <div className={`intg-real-card ${vercelInteg ? 'connected' : ''}`}>
                    <div className="intg-real-left">
                      <div className="intg-real-icon">
                        <Icon name="triangle" size={22} />
                      </div>
                      <div className="intg-real-info">
                        <div className="intg-real-name">Vercel</div>
                        {vcLoading ? (
                          <div className="intg-real-sub">Checking…</div>
                        ) : vercelInteg ? (
                          <div className="intg-real-sub connected">
                            <span>@{vercelInteg.username}</span>
                            <span className="intg-connected-dot" />
                            Connected
                            {vercelInteg.connected_at && (
                              <span className="intg-connected-time" style={{ marginLeft: 4 }}>
                                · {new Date(vercelInteg.connected_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="intg-real-sub">View projects, deployments and domains</div>
                        )}
                      </div>
                    </div>
                    <div className="intg-real-right">
                      {vercelInteg ? (
                        <button className="intg-btn-disconnect" onClick={disconnectVercel} disabled={vcDisconnecting}>
                          <Icon name="x" size={13} /> {vcDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      ) : (
                        <button className="intg-btn-connect" onClick={connectVercel} disabled={vcLoading}>
                          <Icon name="triangle" size={13} /> Connect Vercel
                        </button>
                      )}
                    </div>
                  </div>

                  {vcError && (
                    <div className="form-error" style={{ marginBottom: 4 }}>
                      <Icon name="alert-circle" size={12} /> {vcError}
                    </div>
                  )}

                  <div className="intg-coming-soon-grid">
                    {[
                      { name: 'Slack', icon: 'message-square', color: '#4A154B' },
                      { name: 'Linear', icon: 'layers', color: '#5E6AD2' },
                      { name: 'Stripe', icon: 'credit-card', color: '#0070BA' },
                    ].map(p => (
                      <div key={p.name} className="intg-soon-card">
                        <div className="intg-soon-icon" style={{ color: p.color }}>
                          <Icon name={p.icon} size={16} />
                        </div>
                        <span className="intg-soon-name">{p.name}</span>
                        <span className="intg-soon-badge">Soon</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      {/* Delete Status Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm({ isOpen: false, id: null, label: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Delete Status?</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm({ isOpen: false, id: null, label: '' })}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the <span className="highlight">{deleteConfirm.label}</span> status? This action cannot be undone and may affect tasks currently in this column.</p>
            </div>
            <div className="modal-ft">
              <button className="btn ghost" onClick={() => setDeleteConfirm({ isOpen: false, id: null, label: '' })}>Cancel</button>
              <button className="btn primary danger" onClick={handleConfirmDelete}>Delete Status</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tag Confirmation Modal */}
      {tagDeleteConfirm.isOpen && (
        <div className="modal-overlay" onClick={() => setTagDeleteConfirm({ isOpen: false, id: null, name: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Delete Tag?</h3>
              <button className="modal-close" onClick={() => setTagDeleteConfirm({ isOpen: false, id: null, name: '' })}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p>Delete <span className="highlight">{tagDeleteConfirm.name}</span>? It will be removed from all tasks that use it.</p>
            </div>
            <div className="modal-ft">
              <button className="btn ghost" onClick={() => setTagDeleteConfirm({ isOpen: false, id: null, name: '' })}>Cancel</button>
              <button className="btn primary danger" onClick={handleConfirmDeleteTag}>Delete Tag</button>
            </div>
          </div>
        </div>
      )}

      {/* Vercel PAT Modal */}
      {vcPATOpen && (
        <div className="modal-overlay" onClick={() => { setVcPATOpen(false); setVcError(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Connect Vercel</h3>
              <button className="modal-close" onClick={() => { setVcPATOpen(false); setVcError(''); }}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, color: 'var(--text-3)', fontSize: 13 }}>
                Generate a token at{' '}
                <a href="https://vercel.com/account/tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                  vercel.com/account/tokens
                </a>
                , then paste it below.
              </p>
              <input
                type="password"
                className="input-premium"
                placeholder="Paste your Vercel token…"
                value={vcToken}
                onChange={e => { setVcToken(e.target.value); setVcError(''); }}
                onKeyDown={e => e.key === 'Enter' && saveVercelToken()}
                autoFocus
              />
              {vcError && (
                <div className="form-error" style={{ marginTop: 8 }}>
                  <Icon name="alert-circle" size={12} /> {vcError}
                </div>
              )}
            </div>
            <div className="modal-ft">
              <button className="btn ghost" onClick={() => { setVcPATOpen(false); setVcError(''); }}>Cancel</button>
              <button className="btn primary" onClick={saveVercelToken} disabled={vcSaving || !vcToken.trim()}>
                {vcSaving ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Type Confirmation Modal */}
      {typeDeleteConfirm.isOpen && (
        <div className="modal-overlay" onClick={() => setTypeDeleteConfirm({ isOpen: false, id: null, label: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Delete Project Type?</h3>
              <button className="modal-close" onClick={() => setTypeDeleteConfirm({ isOpen: false, id: null, label: '' })}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the <span className="highlight">{typeDeleteConfirm.label}</span> project type? Existing projects with this type will retain the label but it won't appear in new project forms.</p>
            </div>
            <div className="modal-ft">
              <button className="btn ghost" onClick={() => setTypeDeleteConfirm({ isOpen: false, id: null, label: '' })}>Cancel</button>
              <button className="btn primary danger" onClick={handleConfirmDeleteType}>Delete Type</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

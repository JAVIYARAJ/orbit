// collaboration.jsx — Team collaboration: member list, invites, activity

import { useState, useRef, useEffect } from 'react';
import { Icon } from '../components/shell.jsx';
import { supabase } from '../lib/supabase.js';
import {
  inviteMember, cancelInvite, updateMemberRole, removeMember, transferOwnership,
} from '../lib/db.js';
import { canDo, assignableRoles, canModifyMember } from '../lib/permissions.js';
import { fmtDate } from '../lib/dateUtils.js';

const ROLE_OPTION_LABEL = {
  admin: 'Admin — can invite & manage',
  member: 'Member — create & edit tasks/projects',
  viewer: 'Viewer — read only',
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // fallback expiry when server doesn't echo one

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };

const avatarColor = (str = '') => {
  const colors = ['#0099ff', '#7c3aed', '#16a34a', '#d97706', '#ef4444', '#06b6d4', '#ec4899'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const MemberAvatar = ({ member, size = 36 }) => (
  <div
    className="member-ava"
    style={{
      width: size, height: size, borderRadius: '50%',
      background: member.avatarUrl ? 'var(--bg-3)' : avatarColor(member.name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600, color: '#fff',
      overflow: 'hidden', flexShrink: 0,
    }}
  >
    {member.avatarUrl
      ? <img src={member.avatarUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : member.avatar
    }
  </div>
);

const InviteModal = ({ workstation, user, members = [], myRole, wsPermissions = {}, onClose, onInvited }) => {
  // Roles this inviter is actually allowed to grant (prevents privilege escalation —
  // e.g. an admin without change_role can't mint new admins).
  const roles = assignableRoles(myRole, wsPermissions);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roles.includes('member') ? 'member' : roles[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [emailFailed, setEmailFailed] = useState(false);

  // Guard against setState after unmount (modal can be closed mid-request).
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    // Don't allow self-invites or re-inviting an existing member.
    if (normalized === user?.email?.toLowerCase()) {
      setError("You can't invite yourself.");
      return;
    }
    if (members.some(m => m.email?.toLowerCase() === normalized)) {
      setError('That person is already a member of this workspace.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await inviteMember(
        workstation.id,
        normalized,
        role,
        workstation.name,
        user.name,
      );
      if (!result) throw new Error('No result returned');

      const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${result.token}`;
      // Surface (rather than swallow) email-delivery failures so the UI can tell the
      // user to share the link manually.
      supabase.functions.invoke('send-invite-email', {
        body: { to: normalized, workspace_name: workstation.name, inviter_name: user.name, role, invite_url: inviteUrl },
      })
        .then(({ error: emailErr }) => { if (emailErr && mounted.current) setEmailFailed(true); })
        .catch(() => { if (mounted.current) setEmailFailed(true); });

      if (!mounted.current) return;
      setDone({ token: result.token, email: normalized });
      onInvited(result);
    } catch (err) {
      if (mounted.current) setError(err.message || 'Failed to send invite.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const inviteUrl = done
    ? `${window.location.origin}${window.location.pathname}?invite=${done.token}`
    : '';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card invite-modal">
        <div className="modal-head">
          <span className="modal-title">Invite team member</span>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {!done ? (
          <form onSubmit={handleSubmit} className="invite-form">
            <div className="modal-body">
              <div className="invite-field">
                <label className="invite-label">Email address</label>
                <input
                  className="input-premium"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="invite-field">
                <label className="invite-label">Role</label>
                <select className="input-premium" value={role} onChange={e => setRole(e.target.value)}>
                  {roles.map(r => (
                    <option key={r} value={r}>{ROLE_OPTION_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              {error && <div className="form-error">{error}</div>}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn primary" disabled={loading}>
                {loading ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="modal-body" style={{ paddingTop: 32 }}>
              <div className="invite-sent">
                <div className="invite-sent-icon"><Icon name="check-circle" size={32} /></div>
                <div className="invite-sent-text">Invite created for <strong>{done.email}</strong></div>
                <div className="invite-sent-note">
                  {emailFailed
                    ? "We couldn't send the email automatically. Share this link directly:"
                    : "If they don't receive the email, share this link directly:"}
                </div>
                <div className="invite-link-box">
                  <input className="input-premium" readOnly value={inviteUrl} style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }} />
                  <button className="iconbtn" onClick={() => navigator.clipboard.writeText(inviteUrl)} title="Copy link">
                    <Icon name="copy" size={15} />
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const Collaboration = ({
  user,
  activeWorkstation,
  projects = [],
  members = [], setMembers,
  pendingInvites = [], setPendingInvites,
  myRole = 'viewer',
  wsPermissions = {},
  setTasks,
  refreshWorkspaceContext,
}) => {
  const [showInvite, setShowInvite] = useState(false);
  const [roleEditing, setRoleEditing] = useState(null);
  const [busy, setBusy] = useState({});
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [transferConfirm, setTransferConfirm] = useState(null);

  const canInvite = canDo(myRole, 'invite_member', wsPermissions);
  const canRemove = canDo(myRole, 'remove_member', wsPermissions);
  const canChange = canDo(myRole, 'change_role', wsPermissions);
  const isOwner = myRole === 'owner';

  const activeProjects = projects.filter(p => p.status === 'progress').length;

  const handleInvited = (result) => {
    setPendingInvites(prev => [
      {
        id: result.id,
        email: result.email,
        role: result.role,
        token: result.token,
        createdAt: result.created_at || new Date().toISOString(),
        // Server may not echo expires_at on insert — fall back so the row doesn't
        // render "Expires Invalid Date".
        expiresAt: result.expires_at || new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      },
      ...prev.filter(i => i.email !== result.email),
    ]);
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

  const handleResendInvite = async (invite) => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${invite.token}`;
    setBusy(b => ({ ...b, [invite.id]: true }));
    try {
      await supabase.functions.invoke('send-invite-email', {
        body: {
          to: invite.email, workspace_name: activeWorkstation.name,
          inviter_name: user.name, role: invite.role, invite_url: inviteUrl,
        },
      });
    } finally {
      setBusy(b => ({ ...b, [invite.id]: false }));
    }
  };

  const handleRoleChange = async (member, newRole) => {
    setRoleEditing(null);
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
      // The server clears this member's task assignments; mirror that locally so
      // the board doesn't show a now-removed assignee until the next reload.
      setTasks?.(prev => prev.map(t => t.assigneeId === member.userId ? { ...t, assigneeId: null } : t));
    } finally {
      setBusy(b => ({ ...b, [member.userId]: false }));
    }
  };

  const confirmTransfer = async () => {
    const member = transferConfirm;
    if (!member) return;
    setTransferConfirm(null);
    setBusy(b => ({ ...b, [member.userId]: true }));
    try {
      await transferOwnership(activeWorkstation.id, member.userId);
      // New owner gets 'owner', the previous owner (me) is demoted to 'admin'.
      setMembers(prev => prev.map(m =>
        m.userId === member.userId ? { ...m, role: 'owner' }
          : m.userId === user?.id ? { ...m, role: 'admin' }
            : m
      ));
      await refreshWorkspaceContext?.();
    } finally {
      setBusy(b => ({ ...b, [member.userId]: false }));
    }
  };

  return (
    <div className="page-wide">
      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <div className="crumb">WORKSPACE</div>
          <h1>Team Collaboration</h1>
          <div className="sub">Manage members, invites, and workspace access levels</div>
        </div>
        {canInvite && (
          <button className="btn primary collab-invite-btn" onClick={() => setShowInvite(true)}>
            <Icon name="user-plus" size={16} /> <span style={{ position: 'relative', top: 1 }}>Invite Member</span>
          </button>
        )}
      </div>

      {/* Hero Stats */}
      <div className="collab-hero slide-in-bottom">
        {[
          { label: 'Total Members', value: members.length, icon: 'users', color: '#0099ff' },
          { label: 'Active Projects', value: activeProjects, icon: 'layers', color: '#8b5cf6' },
          { label: 'Pending Invites', value: pendingInvites.length, icon: 'mail', color: '#f59e0b' },
          { label: 'Admins', value: members.filter(m => m.role === 'admin' || m.role === 'owner').length, icon: 'shield', color: '#10b981' },
        ].map(stat => (
          <div key={stat.label} className="collab-stat-card">
            <div className="collab-stat-header">
              <div className="collab-stat-icon-wrapper" style={{
                background: `linear-gradient(135deg, ${stat.color}33, ${stat.color}11)`,
                color: stat.color,
                border: `1px solid ${stat.color}33`,
              }}>
                <Icon name={stat.icon} size={20} />
              </div>
            </div>
            <div className="collab-stat-content">
              <div className="collab-stat-value">{stat.value}</div>
              <div className="collab-stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="collab-main-layout slide-in-bottom" style={{ animationDelay: '0.1s' }}>

        {/* Left Column: Members */}
        <div className="collab-panel">
          <div className="collab-panel-header">
            <div className="collab-panel-title">
              <h2>Active Members</h2>
              <span className="collab-panel-badge">{members.length}</span>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="collab-empty">No members yet. Invite someone to get started.</div>
          ) : (
            <div className="collab-members-grid">
              {members.map(member => (
                <div key={member.userId} className="collab-member-card">
                  <div className="collab-member-top">
                    <div className="collab-member-avatar-container">
                      <MemberAvatar member={member} size={48} />
                      <div className={`collab-member-status-dot ${member.userId !== user?.id && Math.random() > 0.5 ? 'offline' : ''}`} />
                    </div>

                    <div className="collab-member-info">
                      <div className="collab-member-name">
                        {member.name}
                        {member.userId === user?.id && <span className="collab-member-you-badge">You</span>}
                      </div>
                      <div className="collab-member-email">{member.email}</div>
                    </div>
                  </div>

                  <div className="collab-member-bottom">
                    {canChange && canModifyMember(myRole, member, user?.id) ? (
                      roleEditing === member.userId ? (
                        <select
                          className="collab-role-select"
                          value={member.role}
                          autoFocus
                          onChange={e => handleRoleChange(member, e.target.value)}
                          onBlur={() => setRoleEditing(null)}
                        >
                          {assignableRoles(myRole, wsPermissions).map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          className={`collab-role-pill role-${member.role}`}
                          onClick={() => setRoleEditing(member.userId)}
                          title="Click to change role"
                          disabled={busy[member.userId]}
                        >
                          {ROLE_LABEL[member.role]} <Icon name="chevron-down" size={12} style={{ opacity: 0.5 }} />
                        </button>
                      )
                    ) : (
                      <span className={`collab-role-pill role-${member.role}`}>
                        {ROLE_LABEL[member.role]}
                      </span>
                    )}

                    <div className="collab-member-actions">
                      {isOwner && member.role !== 'owner' && member.userId !== user?.id && (
                        <button
                          className="collab-action-icon"
                          onClick={() => setTransferConfirm(member)}
                          disabled={busy[member.userId]}
                          title="Transfer ownership"
                        >
                          <Icon name="shield" size={16} />
                        </button>
                      )}

                      {canRemove && canModifyMember(myRole, member, user?.id) && (
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

        {/* Right Column: Invites */}
        {canInvite && (
          <div className="collab-panel">
            <div className="collab-panel-header">
              <div className="collab-panel-title">
                <h2>Pending Invites</h2>
                {pendingInvites.length > 0 && <span className="collab-panel-badge">{pendingInvites.length}</span>}
              </div>
            </div>

            <div className="card-pad" style={{ padding: 0 }}>
              {pendingInvites.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
                  <div style={{ width: 64, height: 64, margin: '0 auto 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>
                    <Icon name="mail" size={24} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginBottom: 8 }}>No pending invites</div>
                  <div style={{ fontSize: 12 }}>Invited members will appear here until they join.</div>
                </div>
              ) : (
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
                              <span>
                                {invite.expiresAt && !isNaN(new Date(invite.expiresAt))
                                  ? `Expires ${fmtDate(invite.expiresAt)}`
                                  : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="collab-invite-actions">
                          <button onClick={() => handleResendInvite(invite)} disabled={busy[invite.id]} title="Resend email">
                            <Icon name="send" size={14} /> Resend
                          </button>
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
              )}
            </div>
          </div>
        )}
      </div>

      {showInvite && (
        <InviteModal
          workstation={activeWorkstation}
          user={user}
          members={members}
          myRole={myRole}
          wsPermissions={wsPermissions}
          onClose={() => setShowInvite(false)}
          onInvited={handleInvited}
        />
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

      {/* Transfer Ownership Confirmation Modal */}
      {transferConfirm && (
        <div className="modal-overlay" onClick={() => setTransferConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Transfer Ownership</h3>
              <button className="modal-close" onClick={() => setTransferConfirm(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p>Make <strong className="highlight">{transferConfirm.name}</strong> the owner of this workspace? You will be demoted to <strong>Admin</strong> and lose owner-only abilities such as managing permissions. This can only be undone by the new owner.</p>
            </div>
            <div className="modal-ft">
              <button className="btn ghost" onClick={() => setTransferConfirm(null)}>Cancel</button>
              <button className="btn primary" onClick={confirmTransfer}>Transfer Ownership</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

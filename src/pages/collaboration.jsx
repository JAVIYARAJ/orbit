// collaboration.jsx — Team collaboration and activity features

import { useState } from 'react';
import { Icon } from '../components/shell.jsx';

const ACTION_ICON = {
  completed:        'check-circle',
  'commented on':   'message-square',
  'merged PR':      'git-merge',
  'created milestone': 'flag',
  updated:          'edit-3',
};

export const Collaboration = () => {
  const [members] = useState([
    { id: 1, name: 'You',         role: 'Founder',   avatar: 'Y', status: 'active',  projects: 6 },
    { id: 2, name: 'Alex Chen',   role: 'Designer',  avatar: 'A', status: 'active',  projects: 3 },
    { id: 3, name: 'Jordan Lee',  role: 'Developer', avatar: 'J', status: 'idle',    projects: 4 },
    { id: 4, name: 'Sam Park',    role: 'PM',        avatar: 'S', status: 'offline', projects: 5 },
  ]);

  const [activityFeed] = useState([
    { id: 1, user: 'You',        action: 'completed',          target: 'Punch-card animation task', time: '2m ago' },
    { id: 2, user: 'Alex Chen',  action: 'commented on',       target: 'Loyalty tier design',       time: '14m ago' },
    { id: 3, user: 'Jordan Lee', action: 'merged PR',          target: '#237 - Offline sync fix',   time: '1h ago' },
    { id: 4, user: 'Sam Park',   action: 'created milestone',  target: 'v2.0 Release Sprint',       time: '3h ago' },
    { id: 5, user: 'You',        action: 'updated',            target: 'Project timeline',          time: '5h ago' },
  ]);

  const STATUS_COLOR = { active: '#25d366', idle: '#ff9500', offline: '#6a6a78' };

  return (
    <div className="page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE</div>
          <h1>Collaboration</h1>
          <div className="sub">Team activity and member overview</div>
        </div>
      </div>

      <div className="collaboration-grid">
        {/* Team Members */}
        <div className="card slide-in-left">
          <div className="card-h">
            <div className="t">Team Members</div>
            <div className="lbl">{members.filter(m => m.status === 'active').length} active</div>
          </div>
          <div className="card-pad">
            <div className="members-list">
              {members.map(member => (
                <div key={member.id} className="member-item">
                  <div className="member-avatar" style={{ background: STATUS_COLOR[member.status] }}>
                    {member.avatar}
                    <div className="status-dot" style={{ background: STATUS_COLOR[member.status] }} />
                  </div>
                  <div className="member-info">
                    <div className="member-name">{member.name}</div>
                    <div className="member-role">{member.role}</div>
                  </div>
                  <div className="member-projects">
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-3)' }}>PROJ </span>
                    {member.projects}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card slide-in-left">
          <div className="card-h">
            <div className="t">Recent Activity</div>
            <div className="lbl">Team Updates</div>
          </div>
          <div className="card-pad">
            <div className="activity-feed">
              {activityFeed.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon" style={{ color: 'var(--accent-hi)', display: 'grid', placeItems: 'center' }}>
                    <Icon name={ACTION_ICON[activity.action] || 'activity'} size={15} />
                  </div>
                  <div className="activity-content">
                    <div className="activity-text">
                      <strong>{activity.user}</strong> {activity.action} <em>{activity.target}</em>
                    </div>
                    <div className="activity-time">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Stats */}
        <div className="card slide-in-left">
          <div className="card-h">
            <div className="t">Team Stats</div>
          </div>
          <div className="card-pad">
            <div className="stats-grid">
              {[
                { label: 'Total Members',   value: members.length,           icon: 'users' },
                { label: 'Active Projects', value: 6,                        icon: 'layers' },
                { label: 'Team Updates',    value: activityFeed.length,      icon: 'message-square' },
              ].map(stat => (
                <div key={stat.label} className="stat-item">
                  <div className="stat-icon" style={{ color: 'var(--accent-hi)', display: 'grid', placeItems: 'center', fontSize: 0 }}>
                    <Icon name={stat.icon} size={22} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">{stat.label}</div>
                    <div className="stat-value">{stat.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

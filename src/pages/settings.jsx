// settings.jsx — User settings, profile, and integrations

import { useState } from 'react';
import { Icon } from '../components/shell.jsx';

const INTEGRATION_ICON = {
  GitHub:   'github',
  Stripe:   'credit-card',
  Supabase: 'database',
  Slack:    'message-square',
  Linear:   'layers',
  Vercel:   'triangle',
};

export const Settings = () => {
  const [user] = useState({
    name:      'Raunak Raj',
    email:     'raunak@example.com',
    role:      'Founder & Developer',
    avatar:    'R',
    timezone:  'UTC+5:30 (IST)',
    workspace: 'Personal Workspace',
    joinedDate: '2025-08-15',
  });

  const [integrations] = useState([
    { id: 1, name: 'GitHub',   status: 'connected',    color: '#333' },
    { id: 2, name: 'Stripe',   status: 'connected',    color: '#0070BA' },
    { id: 3, name: 'Supabase', status: 'connected',    color: '#3FCF8E' },
    { id: 4, name: 'Slack',    status: 'pending',      color: '#4A154B' },
    { id: 5, name: 'Linear',   status: 'disconnected', color: '#5E6AD2' },
    { id: 6, name: 'Vercel',   status: 'connected',    color: '#888' },
  ]);

  const [prefs, setPrefs] = useState([
    { label: 'Email Notifications',  value: true },
    { label: 'Daily Summary',        value: true },
    { label: 'Weekly Reports',       value: true },
    { label: 'Productivity Insights',value: true },
  ]);

  const togglePref = (idx) =>
    setPrefs(prev => prev.map((p, i) => i === idx ? { ...p, value: !p.value } : p));

  return (
    <div className="page-wide">
      <div className="page-head">
        <div>
          <div className="crumb">WORKSPACE</div>
          <h1>Settings</h1>
          <div className="sub">Profile, integrations, and preferences</div>
        </div>
      </div>

      <div className="settings-grid">
        {/* Profile Card */}
        <div className="card slide-in-up">
          <div className="card-h">
            <div className="t">Profile Settings</div>
          </div>
          <div className="card-pad">
            <div className="profile-section">
              <div className="profile-avatar-large">{user.avatar}</div>
              <div className="profile-info">
                <div className="profile-name">{user.name}</div>
                <div className="profile-email">{user.email}</div>
              </div>
              <button className="btn sm">Edit Profile</button>
            </div>
            <div className="profile-details">
              {[
                { label: 'Role',         value: user.role },
                { label: 'Timezone',     value: user.timezone },
                { label: 'Workspace',    value: user.workspace },
                { label: 'Member Since', value: 'August 15, 2025' },
              ].map(item => (
                <div key={item.label} className="detail-item">
                  <span className="detail-label">{item.label}</span>
                  <span className="detail-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="card slide-in-up">
          <div className="card-h">
            <div className="t">Connected Services</div>
            <div className="lbl">{integrations.filter(i => i.status === 'connected').length} connected</div>
          </div>
          <div className="card-pad">
            <div className="integrations-list">
              {integrations.map(intg => (
                <div key={intg.id} className={`integration-item ${intg.status}`}>
                  <div className="integration-icon" style={{ color: intg.color }}>
                    <Icon name={INTEGRATION_ICON[intg.name] || 'link'} size={18} />
                  </div>
                  <div className="integration-info">
                    <div className="integration-name">{intg.name}</div>
                    <div className="integration-status">{intg.status}</div>
                  </div>
                  <button className={`btn sm ${intg.status === 'connected' ? 'ghost' : 'primary'}`}>
                    {intg.status === 'connected' ? 'Connected' : intg.status === 'pending' ? 'Authorize' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="card slide-in-up">
          <div className="card-h">
            <div className="t">Notification Preferences</div>
          </div>
          <div className="card-pad">
            <div className="preferences-list">
              {prefs.map((pref, idx) => (
                <div key={idx} className="preference-item">
                  <div className="preference-label">{pref.label}</div>
                  <div
                    className="toggle-switch"
                    data-active={String(pref.value)}
                    onClick={() => togglePref(idx)}
                    role="switch"
                    aria-checked={pref.value}
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && togglePref(idx)}
                  >
                    <div className="toggle-thumb" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workspace Settings */}
        <div className="card slide-in-up">
          <div className="card-h">
            <div className="t">Workspace Settings</div>
          </div>
          <div className="card-pad">
            <div className="settings-section">
              <div className="settings-item">
                <label>Workspace Name</label>
                <input type="text" defaultValue="Personal Workspace" className="settings-input" />
              </div>
              <div className="settings-item">
                <label>Organization</label>
                <input type="text" defaultValue="Solo Freelancer" className="settings-input" />
              </div>
              <div className="settings-buttons">
                <button className="btn sm primary">Save Changes</button>
                <button className="btn sm ghost">Reset</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// workstation-setup.jsx — First-run modal to create/name a workstation

import { useState } from 'react';
import { createWorkstation } from '../lib/db.js';

const COLORS = ['#0099ff','#7C3AED','#16A34A','#D97706','#EF4444','#EC4899'];

export const WorkstationSetup = ({ onCreated, onCancel, isFirst }) => {
  const [name,    setName]    = useState('');
  const [color,   setColor]   = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Workspace name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const ws = await createWorkstation(name.trim(), color);
      onCreated(ws);
    } catch (err) {
      setError(err.message || 'Failed to create workspace.');
      setLoading(false);
    }
  };

  return (
    <div className="ws-setup-overlay">
      <div className="ws-setup-card">

        {/* Logo */}
        <div className="ws-setup-logo">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{flexShrink:0}}>
            <circle cx="9" cy="9" r="3" fill="currentColor"/>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" fill="none"/>
            <circle cx="9" cy="3" r="1.5" fill="currentColor"/>
          </svg>
          <span>Orbit</span>
        </div>

        {/* Heading */}
        <div className="ws-setup-head">
          <h2>{isFirst ? 'Create your workspace' : 'New workspace'}</h2>
          <p>
            {isFirst
              ? 'Give your workspace a name to get started. You can create more later.'
              : 'Each workspace has its own projects, tasks, and data.'}
          </p>
        </div>

        <form onSubmit={handleCreate} noValidate>
          {/* Name */}
          <div className="ws-setup-field">
            <label htmlFor="ws-name">Workspace name</label>
            <input
              id="ws-name"
              type="text"
              placeholder="My Projects, Work, Side hustles…"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              autoFocus
              disabled={loading}
            />
          </div>

          {/* Color */}
          <div className="ws-setup-field">
            <label>Color</label>
            <div className="ws-setup-colors">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={'ws-color-swatch' + (color === c ? ' selected' : '')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="ws-setup-preview">
            <span className="ws-setup-preview-dot" style={{ background: color }} />
            <span className="ws-setup-preview-name">{name || 'Workspace name'}</span>
          </div>

          {/* Error */}
          {error && <div className="ws-setup-error">{error}</div>}

          {/* Actions */}
          <div className="ws-setup-actions">
            <button type="submit" className="ws-setup-submit" disabled={loading || !name.trim()}>
              {loading ? 'Creating…' : 'Create workspace'}
            </button>
            {!isFirst && onCancel && (
              <button type="button" className="ws-setup-cancel" onClick={onCancel} disabled={loading}>
                Cancel
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
};

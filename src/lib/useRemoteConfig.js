import { useEffect, useState } from 'react';
import { getRemoteConfig, fetchAndActivate, getString } from 'firebase/remote-config';
import { firebaseApp } from './firebase.js';

// All navigable module IDs — must stay in sync with NAV in shell.jsx
export const ALL_MODULE_IDS = [
  'home', 'projects', 'tasks', 'pm',
  'analytics', 'collab',
  'timer', 'notes', 'email',
  'github', 'vercel',
  'learning', 'vault',
  'settings',
];

// All modules enabled by default — Remote Config overrides specific entries
const DEFAULT_MODULES = Object.fromEntries(ALL_MODULE_IDS.map(id => [id, true]));

let _rc = null;
function getRC() {
  if (_rc) return _rc;
  _rc = getRemoteConfig(firebaseApp);
  // Shorter interval in dev so changes in the Firebase console reflect quickly
  _rc.settings = { minimumFetchIntervalMillis: import.meta.env.DEV ? 60_000 : 300_000 };
  _rc.defaultConfig = {
    enabled_modules: JSON.stringify(DEFAULT_MODULES),
  };
  return _rc;
}

function parseModules() {
  try {
    return { ...DEFAULT_MODULES, ...JSON.parse(getString(getRC(), 'enabled_modules')) };
  } catch {
    return DEFAULT_MODULES;
  }
}

/**
 * Returns a map of { [moduleId]: boolean } driven by Firebase Remote Config.
 * Falls back to all-enabled defaults while the fetch is in flight or on error.
 *
 * Remote Config key: enabled_modules
 * Value format (JSON string): {"analytics":false,"collab":false,...}
 */
export function useRemoteConfig() {
  const [modules, setModules] = useState(parseModules);

  useEffect(() => {
    fetchAndActivate(getRC())
      .then(() => setModules(parseModules()))
      .catch(console.error);
  }, []);

  return modules;
}

// Build type. Local builds always allow email/password login regardless of the
// Firebase Remote Config google_auth_only flag. Set VITE_BUILD_TYPE=local in the
// local .env. Unset (or any other value) = release behaviour (respect the flag).
const IS_LOCAL_BUILD = import.meta.env.VITE_BUILD_TYPE === 'local';

function parseAuthConfig() {
  // Local builds ignore the remote flag so email/password login is always on.
  if (IS_LOCAL_BUILD) return { googleAuthOnly: false };
  try {
    const parsed = JSON.parse(getString(getRC(), 'enabled_modules'));
    return { googleAuthOnly: parsed.google_auth_only === true };
  } catch {
    return { googleAuthOnly: false };
  }
}

/**
 * Returns auth feature flags from Firebase Remote Config.
 *
 * Remote Config key: google_auth_only
 * Value: 'true' | 'false'  (string — Remote Config has no native boolean)
 */
export function useAuthConfig() {
  const [config, setConfig] = useState(parseAuthConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchAndActivate(getRC())
      .then(() => setConfig(parseAuthConfig()))
      .catch(console.error)
      .finally(() => setReady(true));
  }, []);

  return { ...config, ready };
}

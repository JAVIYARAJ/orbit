import { useEffect, useState } from 'react';
import { getRemoteConfig, fetchAndActivate, getString } from 'firebase/remote-config';
import { firebaseApp } from './firebase.js';

// All navigable module IDs — must stay in sync with NAV in shell.jsx
export const ALL_MODULE_IDS = [
  'home', 'projects', 'tasks', 'pm',
  'analytics', 'collab',
  'timer', 'notes', 'email', 'toolkit', 'flutter-init',
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
  _rc.defaultConfig = { enabled_modules: JSON.stringify(DEFAULT_MODULES) };
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

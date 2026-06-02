// Default permissions per role. Owner always has full access (checked first in canDo).
//
// Two kinds of keys:
//   • view_*  — module access (controls sidebar + routing for that module)
//   • action  — functionality inside a module (create/edit/delete/assign/manage)
//
// home and settings have no key and are always accessible.
export const DEFAULT_PERMISSIONS = {
  admin: {
    // module access
    view_projects:  true,
    view_tasks:     true,
    view_pm:        true,
    view_analytics: true,
    view_collab:    true,
    view_timer:     true,
    view_notes:     true,
    view_email:     true,
    view_toolkit:   true,
    view_flutter:   true,
    view_github:    true,
    view_vercel:    true,
    view_learning:  true,
    view_vault:     false,
    // actions
    github_write:   true,
    invite_member:  true,
    remove_member:  true,
    change_role:    false,
    create_project: true,
    edit_project:   true,
    delete_project: false,
    create_task:    true,
    edit_task:      true,
    delete_task:    true,
    assign_task:    true,
    manage_vault:   false,
  },
  member: {
    view_projects:  true,
    view_tasks:     true,
    view_pm:        true,
    view_analytics: true,
    view_collab:    true,
    view_timer:     true,
    view_notes:     true,
    view_email:     true,
    view_toolkit:   true,
    view_flutter:   true,
    view_github:    true,
    view_vercel:    true,
    view_learning:  true,
    view_vault:     false,
    github_write:   false,
    invite_member:  false,
    remove_member:  false,
    change_role:    false,
    create_project: false,
    edit_project:   false,
    delete_project: false,
    create_task:    true,
    edit_task:      true,
    delete_task:    false,
    assign_task:    true,
    manage_vault:   false,
  },
  viewer: {
    view_projects:  true,
    view_tasks:     true,
    view_pm:        false,
    view_analytics: true,
    view_collab:    true,
    view_timer:     false,
    view_notes:     true,
    view_email:     false,
    view_toolkit:   false,
    view_flutter:   false,
    view_github:    false,
    view_vercel:    false,
    view_learning:  true,
    view_vault:     false,
    github_write:   false,
    invite_member:  false,
    remove_member:  false,
    change_role:    false,
    create_project: false,
    edit_project:   false,
    delete_project: false,
    create_task:    false,
    edit_task:      false,
    delete_task:    false,
    assign_task:    false,
    manage_vault:   false,
  },
};

export const PERMISSION_LABELS = {
  // module access
  view_projects:  'Projects',
  view_tasks:     'Tasks',
  view_pm:        'Project Mgmt',
  view_analytics: 'Analytics',
  view_collab:    'Team Collab',
  view_timer:     'Time Tracker',
  view_notes:     'Notes',
  view_email:     'Email Hub',
  view_toolkit:   'Dev Toolkit',
  view_flutter:   'Flutter Init',
  view_github:    'GitHub Hub',
  view_vercel:    'Vercel',
  github_write:   'GitHub write (create/delete branches & repos)',
  view_learning:  'Learning Path',
  view_vault:     'Vault',
  // actions
  invite_member:  'Invite members',
  remove_member:  'Remove members',
  change_role:    'Change member roles',
  create_project: 'Create projects',
  edit_project:   'Edit projects',
  delete_project: 'Delete projects',
  create_task:    'Create tasks',
  edit_task:      'Edit tasks',
  delete_task:    'Delete tasks',
  assign_task:    'Assign tasks',
  manage_vault:   'Manage vault',
};

// Maps a navigation/module id → the permission key that gates access to it.
// Ids absent here (home, settings) are always accessible.
export const MODULE_PERMISSION = {
  projects:       'view_projects',
  tasks:          'view_tasks',
  pm:             'view_pm',
  analytics:      'view_analytics',
  collab:         'view_collab',
  timer:          'view_timer',
  notes:          'view_notes',
  email:          'view_email',
  toolkit:        'view_toolkit',
  'flutter-init': 'view_flutter',
  github:         'view_github',
  vercel:         'view_vercel',
  learning:       'view_learning',
  vault:          'view_vault',
};

// Grouped layout for the Permissions matrix UI.
export const PERMISSION_GROUPS = [
  {
    label: 'Module access',
    keys: [
      'view_projects', 'view_tasks', 'view_pm', 'view_analytics', 'view_collab',
      'view_timer', 'view_notes', 'view_email', 'view_toolkit', 'view_flutter',
      'view_github', 'view_vercel', 'view_learning', 'view_vault',
    ],
  },
  { label: 'Projects', keys: ['create_project', 'edit_project', 'delete_project'] },
  { label: 'Tasks',    keys: ['create_task', 'edit_task', 'delete_task', 'assign_task'] },
  { label: 'Vault',    keys: ['manage_vault'] },
  { label: 'GitHub',   keys: ['github_write'] },
  { label: 'Team',     keys: ['invite_member', 'remove_member', 'change_role'] },
];

export const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

// Short description + optional danger flag shown in the permissions matrix.
// danger: true → requires a confirmation dialog before enabling.
export const PERMISSION_WARNINGS = {
  // Module access
  view_projects:  { text: 'Can view and open all projects in this workspace.' },
  view_tasks:     { text: 'Can see the task board and all task details.' },
  view_pm:        { text: 'Can access the Project Management board and Gantt chart.' },
  view_analytics: { text: 'Can see workspace-wide metrics, charts, and time reports.' },
  view_collab:    { text: 'Can view team members and pending invites.' },
  view_timer:     { text: 'Can use the time tracker and log hours.' },
  view_notes:     { text: 'Can read and write notes in the workspace.' },
  view_email:     { text: 'Can access and manage email templates.' },
  view_toolkit:   { text: 'Can access the developer toolkit.' },
  view_flutter:   { text: 'Can use the Flutter project initialiser.' },
  view_github:    { text: 'Can browse repos, PRs, issues, and activity in the GitHub Hub.' },
  view_vercel:    { text: 'Can view Vercel deployments and project status.' },
  view_learning:  { text: 'Can view and update the learning path.' },
  view_vault:     { text: 'Can open and read stored credentials and secrets.', danger: true },
  // Projects
  create_project: { text: 'Can create new projects and link GitHub repos.' },
  edit_project:   { text: 'Can rename, recolor, and reconfigure any project.' },
  delete_project: { text: 'Permanently deletes a project and all its tasks. This cannot be undone.', danger: true },
  // Tasks
  create_task:    { text: 'Can add new tasks to any project column.' },
  edit_task:      { text: 'Can edit task titles, descriptions, status, priority, and due dates.' },
  delete_task:    { text: 'Permanently removes tasks from the board. This cannot be undone.', danger: true },
  assign_task:    { text: 'Can assign or reassign tasks to any workspace member.' },
  // Vault
  manage_vault:   { text: 'Full read and write access to credentials and secrets. Only grant to fully trusted members.', danger: true },
  // GitHub
  github_write:   { text: 'Can create and delete branches and repositories directly on GitHub.', danger: true },
  // Team
  invite_member:  { text: 'Can send invites to bring new people into this workspace.' },
  remove_member:  { text: 'Can permanently remove members, instantly revoking their access.', danger: true },
  change_role:    { text: 'Can promote members up to Admin. Admins inherit all admin-level permissions.', danger: true },
};

// wsPermissions is the flat object from get_workspace_permissions RPC:
// { 'admin:invite_member': true, 'member:create_project': false, ... }
export const canDo = (myRole, action, wsPermissions = {}) => {
  if (myRole === 'owner') return true;
  if (!myRole) return false;
  const key = `${myRole}:${action}`;
  // Coerce to a real boolean: a stored override could arrive as a string.
  if (key in wsPermissions) return wsPermissions[key] === true || wsPermissions[key] === 'true';
  return DEFAULT_PERMISSIONS[myRole]?.[action] ?? false;
};

// Whether a role can open/see a given module (sidebar item / route).
// home, settings and any unmapped id are always accessible.
export const canAccessModule = (myRole, moduleId, wsPermissions = {}) => {
  if (myRole === 'owner') return true;
  const key = MODULE_PERMISSION[moduleId];
  if (!key) return true;
  return canDo(myRole, key, wsPermissions);
};

// Roles a user is allowed to grant when inviting or changing a member's role.
// Only owners — or admins explicitly granted change_role — may create admins.
export const assignableRoles = (myRole, wsPermissions = {}) => {
  if (myRole === 'owner' || canDo(myRole, 'change_role', wsPermissions)) {
    return ['admin', 'member', 'viewer'];
  }
  return ['member', 'viewer'];
};

// Whether `myRole` may modify (change role / remove) the given target member.
// Owners are untouchable; you can't act on yourself; only owners may act on admins.
export const canModifyMember = (myRole, member, currentUserId) => {
  if (!member || member.role === 'owner') return false;
  if (member.userId === currentUserId) return false;
  if (member.role === 'admin' && myRole !== 'owner') return false;
  return true;
};

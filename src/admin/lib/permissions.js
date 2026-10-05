export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  EVENT_MANAGER: 'event_manager',
  MEDIA_MANAGER: 'media_manager',
  PROJECT_MANAGER: 'project_manager',
  TREASURER: 'treasurer',
}

export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'admin_users.manage',
    'events.manage',
    'events.registrations.manage',
    'membership.manage',
    'projects.manage',
    'gallery.manage',
    'messages.view',
    'announcements.manage',
    'links.manage',
    'email.send',
    'ai_knowledge.manage',
    'activity.view',
    'settings.manage',
    'inventory.manage',
    'tasks.manage',
    'finance.manage',
    'applications.review',
  ],
  [ROLES.EVENT_MANAGER]: [
    'events.manage',
    'events.registrations.manage',
    'membership.manage',
    'announcements.manage',
    'links.manage',
    'email.send',
    'messages.view',
    'inventory.manage',
    'tasks.manage',
    'applications.review',
  ],
  [ROLES.MEDIA_MANAGER]: [
    'gallery.manage',
    'announcements.manage',
    'links.manage',
    'email.send',
    'messages.view',
    'applications.review',
  ],
  [ROLES.PROJECT_MANAGER]: [
    'projects.manage',
    'announcements.manage',
    'email.send',
    'messages.view',
    'tasks.manage',
    'applications.review',
  ],
  [ROLES.TREASURER]: [
    'finance.manage',
    'messages.view',
    'applications.review',
  ],
}

export function hasPermission(userRole, permission) {
  if (!userRole) return false
  if (userRole === ROLES.SUPER_ADMIN) return true
  return (PERMISSIONS[userRole] || []).includes(permission)
}

/**
 * Single source of truth for console navigation. The sidebar, the command
 * palette, the breadcrumb and the route guards all read this — they used to
 * each keep their own copy and drift apart.
 *
 * `group` sorts the rail into bands by what the work is about, so a long
 * list reads as a handful of short ones. Overview sits above them all.
 */
export const NAV_ITEMS = [
  { label: 'Overview', path: '/admin', icon: 'Gauge', group: 'home', end: true, permission: null },

  { label: 'Events', path: '/admin/events', icon: 'Calendar', group: 'events', permission: 'events.manage' },
  { label: 'Registrations', path: '/admin/registrations', icon: 'ClipboardCheck', group: 'events', permission: 'events.registrations.manage' },

  { label: 'Review queue', path: '/admin/review', icon: 'Inbox', group: 'people', permission: 'applications.review' },
  { label: 'Applications', path: '/admin/applications', icon: 'UserCheck', group: 'people', permission: 'membership.manage' },
  { label: 'Members', path: '/admin/members', icon: 'IdCard', group: 'people', permission: 'membership.manage' },
  { label: 'Review teams', path: '/admin/teams', icon: 'Network', group: 'people', permission: 'membership.manage' },

  { label: 'Messages', path: '/admin/messages', icon: 'Mail', group: 'work', permission: 'messages.view' },
  { label: 'Tasks', path: '/admin/tasks', icon: 'ListChecks', group: 'work', permission: 'tasks.manage' },

  { label: 'Inventory', path: '/admin/inventory', icon: 'Boxes', group: 'resources', permission: 'inventory.manage' },
  { label: 'Borrowing', path: '/admin/borrowing', icon: 'ArrowLeftRight', group: 'resources', permission: 'inventory.manage' },
  { label: 'Finance', path: '/admin/finance', icon: 'Wallet', group: 'resources', permission: 'finance.manage' },

  { label: 'Projects', path: '/admin/projects', icon: 'CircuitBoard', group: 'publish', permission: 'projects.manage' },
  { label: 'Gallery', path: '/admin/gallery', icon: 'Images', group: 'publish', permission: 'gallery.manage' },
  { label: 'Announcements', path: '/admin/announcements', icon: 'Megaphone', group: 'publish', permission: 'announcements.manage' },
  { label: 'Links page', path: '/admin/links', icon: 'Link2', group: 'publish', permission: 'links.manage' },
  { label: 'Email', path: '/admin/email', icon: 'Send', group: 'publish', permission: 'email.send' },

  { label: 'Admins', path: '/admin/admins', icon: 'Shield', group: 'console', permission: 'admin_users.manage' },
  { label: 'AI knowledge', path: '/admin/ai-knowledge', icon: 'Brain', group: 'console', permission: 'ai_knowledge.manage' },
  { label: 'Activity', path: '/admin/activity', icon: 'ScrollText', group: 'console', permission: 'activity.view' },
  { label: 'Settings', path: '/admin/settings', icon: 'SlidersHorizontal', group: 'console', permission: 'settings.manage' },
]

/** `label: null` renders the band without a heading and keeps it always open. */
export const NAV_GROUPS = [
  { id: 'home', label: null },
  { id: 'events', label: 'Events' },
  { id: 'people', label: 'People' },
  { id: 'work', label: 'Inbox & tasks' },
  { id: 'resources', label: 'Resources' },
  { id: 'publish', label: 'Publish' },
  { id: 'console', label: 'Console' },
]

export function navItemsFor(role) {
  return NAV_ITEMS.filter(item => !item.permission || hasPermission(role, item.permission))
}

/** Longest matching nav path wins, so /admin never shadows /admin/events. */
export function navItemForPath(pathname) {
  return NAV_ITEMS.filter(item => (item.end ? pathname === item.path : pathname.startsWith(item.path)))
    .sort((a, b) => b.path.length - a.path.length)[0] || null
}

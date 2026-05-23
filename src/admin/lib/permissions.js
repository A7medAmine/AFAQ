export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  EVENT_MANAGER: 'event_manager',
  MEDIA_MANAGER: 'media_manager',
  PROJECT_MANAGER: 'project_manager',
}

export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'admin_users.manage',
    'events.manage',
    'events.registrations.manage',
    'projects.manage',
    'gallery.manage',
    'messages.view',
    'announcements.manage',
    'settings.manage',
  ],
  [ROLES.EVENT_MANAGER]: [
    'events.manage',
    'events.registrations.manage',
    'announcements.manage',
    'messages.view',
  ],
  [ROLES.MEDIA_MANAGER]: [
    'gallery.manage',
    'announcements.manage',
    'messages.view',
  ],
  [ROLES.PROJECT_MANAGER]: [
    'projects.manage',
    'announcements.manage',
    'messages.view',
  ],
}

export function hasPermission(userRole, permission) {
  if (!userRole || !PERMISSIONS[userRole]) return false
  return PERMISSIONS[userRole].includes(permission)
}

export const NAV_ITEMS = [
  { label: 'Overview', path: '/admin', icon: 'LayoutDashboard', roles: null },
  { label: 'Events', path: '/admin/events', icon: 'Calendar', roles: [ROLES.SUPER_ADMIN, ROLES.EVENT_MANAGER] },
  { label: 'Registrations', path: '/admin/registrations', icon: 'ClipboardCheck', roles: [ROLES.SUPER_ADMIN, ROLES.EVENT_MANAGER] },
  { label: 'Projects', path: '/admin/projects', icon: 'FolderGit2', roles: [ROLES.SUPER_ADMIN, ROLES.PROJECT_MANAGER] },
  { label: 'Gallery', path: '/admin/gallery', icon: 'Image', roles: [ROLES.SUPER_ADMIN, ROLES.MEDIA_MANAGER] },
  { label: 'Messages', path: '/admin/messages', icon: 'Mail', roles: null },
  { label: 'Announcements', path: '/admin/announcements', icon: 'Megaphone', roles: null },
  { label: 'Admins', path: '/admin/admins', icon: 'Shield', roles: [ROLES.SUPER_ADMIN] },
  { label: 'Settings', path: '/admin/settings', icon: 'Settings', roles: [ROLES.SUPER_ADMIN] },
]

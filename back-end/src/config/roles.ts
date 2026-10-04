export const ROLES = ['super_admin', 'branch_manager', 'consultant', 'editor', 'instructor'] as const;
export type Role = (typeof ROLES)[number];

const STAFF_COMMON = ['branch.read', 'setting.read', 'course.read', 'media.read'] as const;

export const PERMISSIONS: Record<Role, readonly string[]> = {
  super_admin: ['*'],
  branch_manager: [
    ...STAFF_COMMON,
    'user.manage',
    'media.upload',
    'pricing.manage',
    'category.manage',
    'post.manage',
    'lead.*',
    'appointment.*',
    'student.*',
    'class.*',
    'instructor.*',
    'vehicle.*',
    'exam.*',
    'tuition.*',
    'dashboard.read',
  ],
  consultant: [
    ...STAFF_COMMON,
    'lead.read',
    'lead.create',
    'lead.update',
    'appointment.*',
    'student.read',
    'student.create',
    'tuition.read',
    'dashboard.read',
  ],
  editor: [...STAFF_COMMON, 'media.upload', 'category.manage', 'post.manage'],
  instructor: [...STAFF_COMMON, 'class.read', 'student.read', 'exam.read'],
};

export function hasPermission(role: Role, permission: string): boolean {
  const [resource] = permission.split('.');
  return PERMISSIONS[role].some((granted) => granted === '*' || granted === permission || granted === `${resource}.*`);
}

export function permissionsFor(role: Role): string[] {
  return [...PERMISSIONS[role]];
}

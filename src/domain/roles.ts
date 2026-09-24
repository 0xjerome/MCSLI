import type { UserRole } from './types';

const rank: Record<UserRole, number> = { STUDENT: 0, TRAINER: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export function isStaff(role: UserRole | null | undefined): boolean {
  return role === 'TRAINER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function hasAtLeast(role: UserRole | null | undefined, required: UserRole): boolean {
  if (!role) return false;
  return rank[role] >= rank[required];
}

/** Where a user lands after login. */
export function homeRouteFor(role: UserRole | null | undefined): string {
  switch (role) {
    case 'TRAINER':
      return '/trainer';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin';
    default:
      return '/app';
  }
}

/** Who may change whose role. Only SUPER_ADMIN may grant ADMIN/SUPER_ADMIN. */
export function canAssignRole(actor: UserRole, target: UserRole): boolean {
  if (actor === 'SUPER_ADMIN') return true;
  if (actor === 'ADMIN') return target === 'STUDENT' || target === 'TRAINER';
  return false;
}

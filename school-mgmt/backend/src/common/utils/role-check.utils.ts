import { Role } from '../interfaces/role.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Shared role checking utilities for consistent authorization patterns
 */

/**
 * Check if user has full access (DIRECTOR or OPS)
 */
export function hasFullAccess(user: JwtPayload | { role: Role }): boolean {
  return [Role.DIRECTOR, Role.OPS].includes(user.role);
}

/**
 * Check if user is DIRECTOR
 */
export function isDirector(user: JwtPayload | { role: Role }): boolean {
  return user.role === Role.DIRECTOR;
}

/**
 * Check if user is TEACHER
 */
export function isTeacher(user: JwtPayload | { role: Role }): boolean {
  return user.role === Role.TEACHER;
}

/**
 * Check if user is PARENT
 */
export function isParent(user: JwtPayload | { role: Role }): boolean {
  return user.role === Role.PARENT;
}

/**
 * Check if user is SALE
 */
export function isSale(user: JwtPayload | { role: Role }): boolean {
  return user.role === Role.SALE;
}

/**
 * Check if user is ACCOUNTING
 */
export function isAccounting(user: JwtPayload | { role: Role }): boolean {
  return user.role === Role.ACCOUNTING;
}

/**
 * Check if user is SHAREHOLDER
 */
export function isShareholder(user: JwtPayload | { role: Role }): boolean {
  return user.role === Role.SHAREHOLDER;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: JwtPayload | { role: Role }, roles: Role[]): boolean {
  return roles.includes(user.role);
}

/**
 * Get user ID from JWT payload (handles both sub and _id fields)
 */
export function getUserId(user: JwtPayload): string {
  return user?.sub ?? user?._id;
}

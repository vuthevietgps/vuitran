// Role enum matching backend
export enum Role {
  // Core roles
  DIRECTOR = 'DIRECTOR',
  ACCOUNTING = 'ACCOUNTING',
  OPS = 'OPS',
  TEACHER = 'TEACHER',
  EXPERIENCE_TEACHER = 'EXPERIENCE_TEACHER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT',
  SALE = 'SALE',
  ADSMANAGER = 'ADSMANAGER',
  SHAREHOLDER = 'SHAREHOLDER',

  // Legacy roles (deprecated)
  MANAGER = 'MANAGER',
  HCNS = 'HCNS',
  PARTIME = 'PARTIME',
  STAFF = 'STAFF',
}

export const ROLE_LABELS: Record<string, string> = {
  [Role.DIRECTOR]: 'Giám đốc',
  [Role.ACCOUNTING]: 'Kế toán',
  [Role.OPS]: 'Vận hành',
  [Role.TEACHER]: 'Giáo viên',
  [Role.EXPERIENCE_TEACHER]: 'Giao vien trai nghiem',
  [Role.PARENT]: 'Phụ huynh',
  [Role.STUDENT]: 'Hoc sinh',
  [Role.SALE]: 'Sale',
  [Role.ADSMANAGER]: 'Ads manager',
  [Role.SHAREHOLDER]: 'Cổ đông',
  // Legacy
  [Role.MANAGER]: 'Quản lý',
  [Role.HCNS]: 'Hành chính',
  [Role.PARTIME]: 'Partime',
  [Role.STAFF]: 'Nhân viên',
};

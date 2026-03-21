// Role enum matching backend
export enum Role {
  // Core roles
  DIRECTOR = 'DIRECTOR',
  ACCOUNTING = 'ACCOUNTING',
  OPS = 'OPS',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
  SALE = 'SALE',
  ADSMANAGER = 'ADSMANAGER',
  
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
  [Role.PARENT]: 'Phụ huynh',
  [Role.SALE]: 'Sale',
  [Role.ADSMANAGER]: 'Ads manager',
  // Legacy
  [Role.MANAGER]: 'Quản lý',
  [Role.HCNS]: 'Hành chính',
  [Role.PARTIME]: 'Partime',
  [Role.STAFF]: 'Nhân viên',
};

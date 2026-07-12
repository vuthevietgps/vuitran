export enum Role {
  // Core roles for tutoring platform
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

  // Legacy roles (deprecated, keep for backward compatibility during migration)
  /** @deprecated Use OPS instead */
  MANAGER = 'MANAGER',
  /** @deprecated Use ACCOUNTING or OPS instead */
  HCNS = 'HCNS',
  /** @deprecated Remove or migrate to OPS */
  PARTIME = 'PARTIME',
  /** @deprecated Remove or migrate to OPS */
  STAFF = 'STAFF',
}

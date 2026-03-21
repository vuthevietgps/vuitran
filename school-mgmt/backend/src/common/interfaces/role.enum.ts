export enum Role {
  // Core roles for tutoring platform
  DIRECTOR = 'DIRECTOR',     // Giám đốc - quản lý tổng thể, phê duyệt
  ACCOUNTING = 'ACCOUNTING', // Kế toán - thu/chi/đối soát/payroll
  OPS = 'OPS',               // Vận hành - tuyển GV, ghép lớp, xử lý khiếu nại
  TEACHER = 'TEACHER',       // Giáo viên
  PARENT = 'PARENT',         // Phụ huynh - đăng nhập xem lịch/ví/thanh toán
  SALE = 'SALE',             // Sale - tư vấn, tuyển HS, hoa hồng
  ADSMANAGER = 'ADSMANAGER', // Ads manager - ads, analytics, chatbot settings

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

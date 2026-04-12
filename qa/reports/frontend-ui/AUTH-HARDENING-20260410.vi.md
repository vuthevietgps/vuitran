# AUTH HARDENING FRONTEND (2026-04-10)

## Muc dich

- Ghi nhan same-day authoritative evidence cho auth bundle frontend sau dot hardening mo rong.
- Tach ro phan `B01` va phan cross-cutting `B31/Nhom 12` de tranh chen sai scope vao cac wave summary.

## Scope

- Workspace: `school-mgmt/frontend`
- Ngay cap nhat: `2026-04-11`
- Mui gio: `UTC+7`
- Rerun authoritative:
  - `e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts`
  - `e2e/orchestrator/b01-auth-appshell.spec.ts`
  - `e2e/b01-change-password-browser-ui.spec.ts`
  - `e2e/orchestrator/auth-security-lockout.spec.ts`
- Tai lieu tham chieu:
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_Auth_Session_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_rbac_sidebar_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_route_guard_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_shareholder_redirect_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_unknown_route_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B01_change_password_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B31_Auth_Security_Lockout_20260410.md`

## Bang trang thai nhanh

| Batch | Slice authoritative moi | Status | Ghi chu |
| --- | --- | --- | --- |
| B01 | Auth session restore, lockout/loading state, sidebar RBAC, route guard, shareholder redirect, unknown-route fallback, change-password success + validation | PASS | Auth bundle da co same-day evidence o `Auth_Session`, `auth-appshell`, role/dashboard spec, wildcard route fallback, va change-password modal browser flow |
| B31 | Login brute-force lockout block + friendly lockout wording | PASS | Spec `auth-security-lockout.spec.ts` xanh `1/1` |

## Ket qua chinh cua dot 2026-04-10

- `e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts`: `3/3 PASS`
- `e2e/orchestrator/b01-auth-appshell.spec.ts`: `4/4 PASS`
- `e2e/b01-change-password-browser-ui.spec.ts`: `2/2 PASS`
- `e2e/orchestrator/auth-security-lockout.spec.ts`: `1/1 PASS`

## B01 auth bundle

- Da xanh o cac slice sau:
  - login loading state va disabled state trong luc submit
  - session `401` restore redirect ve `/login`
  - change-password modal submit exact payload va logout ve `/login` sau khi doi thanh cong
  - change-password validation block `weak + mismatch`, va wrong current password hien loi tai cho thay vi logout toan cuc
  - sidebar RBAC director vs parent
  - parent route guard tren `/app/financial-control` va `/app/payroll`
  - shareholder redirect sang `/app/investor-dashboard`
  - unknown top-level route fallback ve `/login`
  - unknown nested `/app/*` route fallback ve `/login` theo current wildcard contract
  - role-aware dashboard/sidebar rendering qua role matrix current contract
- Ket luan:
  - `B01` co them same-day hardening evidence, khong chi dua vao Wave 1 historical summary, va hai line change-password khong con la product gap candidate

## B31 / Nhom 12 auth hardening

- Da xanh o cac slice sau:
  - tao user lockout rieng de test brute-force
  - sau 5 lan sai, lan thu 6 dung mat khau that van bi chan
  - UI/backend tra lockout wording than thien thay vi dang nhap thanh cong sai
- Oracle authoritative hien tai:
  - status chan tren lan thu 6 co the la `401` hoac `429`
  - wording lockout hien tai nghieng ve `Tai khoan da bi khoa... thu lai sau 30 phut`
- Ket luan:
  - `B31` co the ghi `PASS` cho spec hardening hien tai

## Residual note

- Log `LOG_B01_auth_appshell_route_guard_20260410.md` co mot `Evidence Artifact Note` ve trace file trong luc finalize context.
- Test van `PASS`, screenshot/video van du, nen xem day la artifact cleanup drift cua helper evidence, khong phai fail nghiep vu auth.

## Buoc tiep theo hop ly

1. Quay lai mot spec co leverage cao cho `B11` hoac `Nhom 12` ngoai auth.
2. Chi doi chieu `remaining-cases.vi.md` trong mot dot reconcile rieng, tranh double-count cac closure auth vua them.

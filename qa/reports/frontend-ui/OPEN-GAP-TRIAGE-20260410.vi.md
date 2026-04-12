# Triage Cac Open Gap Frontend UI (2026-04-10)

## Muc tieu

- Tach ro `coverage gap` va `product/checklist gap` sau cac rerun authoritative ngay `2026-04-10` va `2026-04-11`.
- Giu backlog trung thuc: khong dong line nao neu surface that chua ton tai hoac contract checklist khong con khop product hien tai.

## Ket luan nhanh

- `B09 AI suggest preview-only`: da resolve same-day `2026-04-11`
- `B01 change-password UI`: da resolve same-day `2026-04-11`
- `B08 financial-control edit bank/fund`: da resolve same-day `2026-04-11`
- `B05 sale-side session change CTA/form/history`: da resolve same-day `2026-04-11`
- `B05 substitute-teacher attendance RBAC`: da resolve same-day `2026-04-11`
- `B06 general-feedback full fields`: da resolve same-day `2026-04-11`
- `B06 low-rating visibility cho OPS`: da resolve same-day `2026-04-11`
- `Nhom 11 shareholder export/download masking`: da resolve same-day `2026-04-11`
- `B05 per-student ABSENT/LATE attendance`: da resolve same-day `2026-04-11`
- `B05 calendar overview teacher/class filters`: da resolve same-day `2026-04-11`
## Chi tiet theo line

### 1. B09 bulk notifications - da resolve same-day 2026-04-11

- Checklist line da sync: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L292)
- Authoritative evidence:
  - [LOG_B09_bulk_notifications_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B09_bulk_notifications_browser_20260411.md)
  - [b09-bulk-notifications-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b09-bulk-notifications-browser-ui.spec.ts)
- Surface da duoc bo sung:
  - [notifications.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/notifications.component.ts)
  - [notifications.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/notifications.service.ts)
  - [notifications.controller.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/notifications/notifications.controller.ts)
  - [notifications.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/notifications/notifications.service.ts)
- Ket luan:
  - Khong con la open gap. Browser evidence authoritative da prove `chon nhom nhan + preview + confirm gui + partial success/failure row` theo contract hien tai.

### 2. B09 AI suggest preview-only - da resolve same-day 2026-04-11

- Checklist line da sync: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L316)
- Authoritative evidence:
  - [LOG_B09_ai_suggest_preview_only_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B09_ai_suggest_preview_only_browser_20260411.md)
  - [b09-ai-suggest-preview-only-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b09-ai-suggest-preview-only-browser-ui.spec.ts)
- Surface da duoc bo sung:
  - [messages.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/messages.component.ts)
  - [message.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/message.service.ts)
  - [messages.controller.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/messages/messages.controller.ts)
  - [messages.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/messages/messages.service.ts)
- Root cause da sua:
  - Bo nhanh `auto-save` AI reply trong backend `messages` de khong tu dong day cau tra loi AI vao hoi thoai.
  - Them contract `POST /messages/conversations/:id/ai-suggest` tra ve ban nhap preview-only cho agent.
  - Messages UI them nut `Goi y AI`, panel preview, va chi append vao luong chat sau khi agent explicit `Chen vao o nhap` + `Gui`.
- Ket luan:
  - Khong con la product gap. Browser evidence authoritative da prove dung contract `preview-only` cho agent-side support queue.

### 2b. B01 change-password UI - da resolve same-day 2026-04-11

- Checklist lines da sync:
  - [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L69)
  - [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L70)
- Authoritative evidence:
  - [LOG_B01_change_password_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B01_change_password_browser_20260411.md)
  - [b01-change-password-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b01-change-password-browser-ui.spec.ts)
- Surface da duoc bo sung:
  - [change-password-modal.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/change-password-modal.component.ts)
  - [app-shell.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/app-shell.component.ts)
  - [auth.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/auth.service.ts)
  - [error.interceptor.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/interceptors/error.interceptor.ts)
- Root cause da sua:
  - Frontend truoc do khong co bat ky surface/change-password form nao cho user dang dang nhap.
  - `AuthService` chua co call `POST /auth/change-password`.
  - Global `401` interceptor logout moi request, nen nhap sai mat khau cu bi da ve `/login` thay vi hien thi loi tai cho.
- Ket luan:
  - Khong con la product gap. Browser evidence authoritative da prove `success + strong-password/mismatch validation + wrong-current-password error alert` ma khong noi oracle.

### 3. B06 general-feedback full fields - da resolve same-day 2026-04-11

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L223)
- Remaining backlog line: [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L240)
- Authoritative evidence:
  - [LOG_B06_general_feedback_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B06_general_feedback_browser_20260411.md)
  - [b06-general-feedback-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b06-general-feedback-browser-ui.spec.ts)
- Root cause da sua:
  - Backend persistence da bo sung `facilityRating` vao session feedback surface.
  - Frontend da co modal `general-feedback` rieng, submit exact payload, va reload persisted state.
- File da sua:
  - [session.schema.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/sessions/schemas/session.schema.ts)
  - [session-query.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/sessions/session-query.service.ts)
  - [session.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/session.service.ts)
  - [sessions.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/sessions.component.ts)
  - [sessions.component.html](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/sessions.component.html)
- Ket luan:
  - Khong con la open gap. Browser evidence authoritative da prove `overall + teachingQuality + communication + facility + comment` render va persist dung ma khong noi oracle.

### 3b. B08 financial-control edit bank/fund - da resolve same-day 2026-04-11

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L279)
- Remaining backlog line: [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L346)
- Authoritative evidence:
  - [LOG_B08_financial_control_edit_bank_fund_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B08_financial_control_edit_bank_fund_browser_20260411.md)
  - [b08-financial-control-edit-bank-fund-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b08-financial-control-edit-bank-fund-browser-ui.spec.ts)
- Surface da duoc bo sung:
  - [financial-control.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/financial-control.component.ts)
  - [financial-control.component.html](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/financial-control.component.html)
  - [financial-control.component.css](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/financial-control.component.css)
- Root cause da sua:
  - UI `financial-control` truoc do chi mo surface tao moi va record transaction, chua expose icon/form sua cho bank account hoac fund du backend PATCH contract da co san.
  - Modal sua moi preload dung current values, chi gui exact PATCH fields duoc backend whitelist, giu `openingBalance/currentBalance/type` o mode read-only dung voi contract hien tai, va reload lai dung card sau `200 OK`.
- Ket luan:
  - Khong con la open gap. Browser evidence authoritative da prove `edit icon + prefilled modal + loading state + exact PATCH body + list reload` ma khong noi oracle.

### 4. B06 low-rating visibility cho OPS - da resolve same-day 2026-04-11

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L224)
- Wave 4 authoritative row: [WAVE4-PROGRESS-20260410.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/WAVE4-PROGRESS-20260410.vi.md#L100)
- Authoritative evidence:
  - [LOG_B06_low_rating_ops_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B06_low_rating_ops_browser_20260411.md)
  - [b06-low-rating-ops-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b06-low-rating-ops-browser-ui.spec.ts)
- Thuc te da duoc prove:
  - OPS da thay duoc low-rating `1-2 sao` tren sessions row/detail theo browser proof authoritative.
  - WAVE4 da sync spec `1/1 PASS` va `remaining-cases.vi.md` da ve snapshot canonical `0`.
- Ket luan:
  - Khong con la product gap. Muc nay chi con la stale triage note lich su va khong duoc xem la open line hien tai.

### 5. Nhom 11 shareholder export/download masking - da resolve same-day 2026-04-11

- Checklist line da sync: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L356)
- Remaining backlog line da sync: [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L367)
- Authoritative evidence:
  - [LOG_B11_shareholder_masked_export_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B11_shareholder_masked_export_browser_20260411.md)
  - [b11-shareholder-masked-export-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b11-shareholder-masked-export-browser-ui.spec.ts)
- Surface da duoc bo sung:
  - [investor-dashboard.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/dashboards/investor-dashboard.component.ts)
  - [investor-dashboard.component.html](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/dashboards/investor-dashboard.component.html)
  - [investor-dashboard.component.css](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/dashboards/investor-dashboard.component.css)
  - [export.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/export.service.ts)
  - [export.controller.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/export/export.controller.ts)
  - [export.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/export/export.service.ts)
- Root cause da sua:
  - Truoc do `SHAREHOLDER` khong co route `/export/*` hop le, nen checklist line nay dung la gap san pham/contract.
  - Backend da mo `GET /export/investor-summary` cho `SHAREHOLDER`, dung lai `FinancialControlService.getInvestorMetrics()` va `getAgingReport(user)` de CSV thua huong anonymization semantics `PH #n / An danh / HS #n`.
  - Frontend `investor-dashboard` da co nut `Xuat Bao Cao (CSV)`, loading state rieng, va toast loi khi export timeout/fail.
- Ket luan:
  - Khong con la product gap. Browser evidence authoritative da prove `month filter -> export query`, `loading den khi tai xong`, `masked file content`, va `timeout toast` ma khong noi oracle.

### 6. Nhom 12 accounting classes/students reconciliation read-only

- Trang thai:
  - Da duoc resolve ngay `2026-04-10`, khong con la open gap.
- Evidence:
  - [LOG_NHOM12_ACCOUNTING_CLASSES_STUDENTS_READONLY_BROWSER_20260410.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_ACCOUNTING_CLASSES_STUDENTS_READONLY_BROWSER_20260410.md)
  - [LOG_B03_STUDENTS_PERMISSION_BROWSER_20260410.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-10/logs/LOG_B03_STUDENTS_PERMISSION_BROWSER_20260410.md)
- Ghi chu:
  - `/app/classes` da duoc mo cho `ACCOUNTING` o mode read-only, va line checklist ket hop `classes + students` da dong bang same-day browser proof.

### 7. B05 teacher swap conflict validation

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L170)
- Remaining backlog line: [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L254)
- Same-day propagation proof:
  - [LOG_B05_TEACHER_SWAP_MARGIN_WARNING_BROWSER_20260410.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-10/logs/LOG_B05_TEACHER_SWAP_MARGIN_WARNING_BROWSER_20260410.md)
  - [LOG_B05_SESSION_CHANGE_APPROVAL_BROWSER_20260410.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-10/logs/LOG_B05_SESSION_CHANGE_APPROVAL_BROWSER_20260410.md)
  - [LOG_B05_TEACHER_SWAP_PROPAGATION_BROWSER_20260410.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-10/logs/LOG_B05_TEACHER_SWAP_PROPAGATION_BROWSER_20260410.md)
- Frontend surface hien tai:
  - [classes.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/classes.component.ts)
  - [pending-approvals.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/pending-approvals.component.ts)
  - [sessions.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/sessions.component.ts)
  - [session.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/session.service.ts)
- Thuc te:
  - Same-day browser evidence da dong duoc subpart `old/new teacher visible + approval propagation`.
  - Frontend hien khong co call/surface song cho `checkConflicts` truoc khi approve teacher swap hoac truoc khi gui yeu cau teacher swap.
  - Tim kiem theo `checkConflicts`, `/conflicts`, va `conflict` tren frontend khong cho ra mot UI flow teacher-swap song de proof browser-level validation.
- Ket luan:
  - Da duoc resolve bang same-day authoritative browser proof ngay `2026-04-11` qua lane `session-change approval conflict-validation`.
  - Line checklist rong hon nay da duoc dong theo to hop evidence: propagation proof `2026-04-10` + conflict-validation proof `2026-04-11`.

### 8. B05 per-student ABSENT/LATE attendance - da resolve same-day 2026-04-11

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L186)
- Remaining backlog line: [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L259)
- Frontend surface da sua:
  - [attendance.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/attendance.component.ts)
  - [attendance.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/attendance.service.ts)
- Authoritative evidence:
  - [LOG_B05_attendance_present_absent_late_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B05_attendance_present_absent_late_browser_20260411.md)
  - [b05-attendance-present-absent-late-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b05-attendance-present-absent-late-browser-ui.spec.ts)
- Root cause da sua:
  - UI truoc do chi surfacing `Co mat` va `Chua diem danh`.
  - Component normalize moi trang thai khac `PRESENT` ve `null`, nen `ABSENT/LATE` bi mat sau reload du backend da tra dung.
  - Summary khong tach rieng `Vang mat` va `Di muon`, nen khong co browser-level oracle trung thuc cho mixed statuses.
- Ket luan:
  - Line nay da duoc resolve bang same-day authoritative browser proof ngay `2026-04-11`.

### 9. B05 sale-side session change request CTA/form/history - da resolve same-day 2026-04-11

- Checklist lines:
  - [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L199)
  - [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L200)
  - [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L201)
- Remaining backlog lines:
  - [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L260)
  - [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L261)
  - [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L262)
- Frontend surface hien tai:
  - [sessions.component.html](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/sessions.component.html)
  - [sessions.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/sessions.component.ts)
  - [session.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/session.service.ts)
  - [pending-approvals.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/pending-approvals.component.ts)
- Authoritative evidence:
  - [LOG_B05_sale_session_change_request_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B05_sale_session_change_request_browser_20260411.md)
  - [b05-session-change-request-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b05-session-change-request-browser-ui.spec.ts)
- Root cause da sua:
  - `/app/sessions` detail modal truoc do chua co live CTA sale-side, chua co form gui request, va chua render request-history.
  - Change-request contract duoc mo rong de luu schedule snapshot + proposed date/time, trong khi frontend form tinh dung `requestedDurationMinutes` tu khung gio de xuat de khong drift voi approval flow hien co.
  - Session detail nay da render request-history cho moi role co quyen xem session, nhung chi `SALE` moi thay CTA/form submit tren session `SCHEDULED`.
- Ket luan:
  - Khong con la open gap. Browser evidence authoritative da prove `SALE-only CTA + exact create payload + loading state + request-history reload`, va non-SALE chi xem history ma khong thay CTA.

### 10. B05 Calendar Overview teacher/class filters

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L203)
- Remaining backlog line: [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L309)
- Authoritative evidence:
  - [LOG_B05_calendar_overview_filters_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B05_calendar_overview_filters_browser_20260411.md)
  - [b05-calendar-overview-filters-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b05-calendar-overview-filters-browser-ui.spec.ts)
- Surface da duoc bo sung:
  - [calendar-overview.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/calendar-overview.component.ts)
  - [dashboard.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/dashboard.service.ts)
  - [dashboard.controller.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/dashboard/dashboard.controller.ts)
  - [dashboard.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/dashboard/dashboard.service.ts)
  - [dashboard-analytics.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/dashboard/dashboard-analytics.service.ts)
- Thuc te:
  - Calendar Overview da co toolbar filter teacher/class va hydrate state tu query params.
  - Load path da gui dung `month/year/teacherId/classId` va reload dataset theo filter moi.
  - Backend calendar contract da filter sessions, payrolls, va tickets theo teacher/class context.
- Ket luan:
  - Khong con la open gap. Browser evidence authoritative da prove Calendar Overview filter theo Giao vien/Lop hoc theo current contract hien tai.

## De xuat thu tu xu ly

1. Chot voi product owner xem co giu nguyen checklist hay rewrite theo surface that.
2. Neu giu nguyen checklist:
   - uu tien `B09 bulk notifications`
   - tiep den `B06 general-feedback + facility persistence`
3. Neu uu tien test completion nhanh:
   - tach cac line tren thanh `product gap`
   - khong dem la browser coverage gap nua
   - tiep tuc dong cac line con lai co surface that.

### 11. B07 work sessions early-leave visibility (resolved 2026-04-11)

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L264)
- Remaining backlog line: [remaining-cases.vi.md](C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md#L322)
- Same-day proof:
  - [LOG_B07_work_sessions_filter_summary_edit_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_work_sessions_filter_summary_edit_browser_20260411.md)
  - [LOG_B07_work_sessions_auto_closed_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_work_sessions_auto_closed_browser_20260411.md)
  - [LOG_B07_work_sessions_late_early_leave_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_work_sessions_late_early_leave_browser_20260411.md)
- Surface da duoc cap nhat:
  - [work-sessions.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/work-sessions.component.ts)
  - [work-session.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/work-session.service.ts)
  - [work-sessions.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/work-sessions/work-sessions.service.ts)
  - [work-session.schema.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/work-sessions/schemas/work-session.schema.ts)
  - [salary-config.schema.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/salary-config/schemas/salary-config.schema.ts)
- Root cause da sua:
  - Work-session contract nay luu snapshot `scheduledStartTime` + `scheduledEndTime`, va recompute `isLate/lateMinutes/isEarlyLeave/earlyLeaveMinutes` tren login, logout, va manual edit.
  - Salary config bo sung `scheduledEndTime`; login flow giu fallback cho config cu chua co field moi de tranh drift do du lieu cu.
  - Monthly summary backend bo sung `totalLateMinutes` de khop contract hien tai cua summary UI.
  - List UI render tach bach `+Np` late badge, `Ve som Np` badge, va `Ca start-end` hint cho tung dong.
- Ket luan:
  - Khong con la open gap.
  - Authoritative same-day closure: `e2e/b07-work-sessions-late-early-leave-browser-ui.spec.ts` `1/1 PASS`.

### 12. B07 payroll late-penalty amount visibility (resolved 2026-04-11)

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L251)
- Same-day proof:
  - [LOG_B07_payroll_late_penalty_amount_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_payroll_late_penalty_amount_browser_20260411.md)
  - [b07-payroll-late-penalty-amount-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b07-payroll-late-penalty-amount-browser-ui.spec.ts)
- Surface da duoc cap nhat:
  - [payroll.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/payroll.component.ts)
  - [payroll.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/payroll.service.ts)
  - [payroll-preview.helper.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/payroll/payroll-preview.helper.ts)
- Root cause da sua:
  - Preview row co surfacing `Trễ` qua `teachingReport.isLateSubmission`.
  - `teacher-preview` nay join `PayrollTransaction` theo session thay vi chi surfacing `HELD`, nen preview session co `penaltyAmount`, `finalPayout`, `isLateReport`, va `lateHours`.
  - UI preview payroll render breakdown exact `teacherPayout / penalty / final payout` ngay trong row, giu lai badge `Tre` va khong gom penalty mo ho vao tong luong goc.

### 13. B07 payroll offline min-payout guarantee visibility (resolved 2026-04-11)

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L252)
- Same-day proof:
  - [LOG_B07_payroll_offline_min_payout_guarantee_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_payroll_offline_min_payout_guarantee_browser_20260411.md)
  - [b07-payroll-offline-min-payout-guarantee-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b07-payroll-offline-min-payout-guarantee-browser-ui.spec.ts)
- Surface da duoc cap nhat:
  - [payroll.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/payroll.component.ts)
  - [payroll.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/payroll.service.ts)
  - [payroll-preview.helper.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/payroll/payroll-preview.helper.ts)
- Root cause da sua:
  - Preview contract nay surfacing `offlineBasePayout`, `offlineMinGuaranteeAmount`, `offlineMinGuaranteeFloor`, va `offlineMinGuaranteeApplied` thay vi chi day `teacherPayout` cuoi.
  - UI preview payroll render exact luong day thuc te, phan bao chung toi thieu, final payout, va ly do `OFFLINE_MIN_GUARANTEE` ngay trong cung row.

### 14. B07 payroll HELD reason labels (resolved 2026-04-11)

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L253)
- Same-day proof:
  - [LOG_B07_payroll_held_reason_labels_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_payroll_held_reason_labels_browser_20260411.md)
  - [b07-payroll-held-reason-labels-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b07-payroll-held-reason-labels-browser-ui.spec.ts)
- Surface da duoc cap nhat:
  - [payroll.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/payroll.component.ts)
  - [payroll.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/payroll.service.ts)
  - [payroll-preview.helper.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/payroll/payroll-preview.helper.ts)
- Root cause da sua:
  - `teacher-preview` nay join `PayrollTransaction` theo session thay vi chi suy luan tu session status, nen HELD rows surface dung `holdReason` va `holdDescription`.
  - UI preview payroll render them `HELD` summary/filter badge, token noi bat `PARENT_REJECTED`, va held detail exact thay vi gom vao bucket waiting chung.
- Ket luan:
  - Khong con la open gap.
  - Authoritative same-day closure: `e2e/b07-payroll-held-reason-labels-browser-ui.spec.ts` `1/1 PASS`.

### 15. B07 staff payroll full lifecycle edit/update surface (resolved 2026-04-11)

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L250)
- Same-day proof:
  - [LOG_B07_staff_payroll_lifecycle_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_staff_payroll_lifecycle_browser_20260411.md)
  - [b07-staff-payroll-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b07-staff-payroll-browser-ui.spec.ts)
- Surface da duoc cap nhat:
  - [payroll.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/payroll.component.ts)
  - [payroll.service.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/services/payroll.service.ts)
- Root cause da sua:
  - `/app/payroll` da co DRAFT edit modal cho payroll-level `bonus/deduction/notes`, ben canh cac thao tac `generate/submit/approve/reject/reopen/mark paid/delete`.
  - Browser proof same-day da cover tron full lifecycle thay vi chi cac thao tac review/pay action roi rac.
- Ket luan:
  - Khong con la open gap.

### 16. B07 bulk payroll partial-success error list (resolved 2026-04-11)

- Checklist line: [testfrontendui.md](C:/Users/PC/Documents/code/vuitran/qa/checklists/frontend-ui/testfrontendui.md#L257)
- Same-day proof:
  - [LOG_B07_bulk_payroll_partial_success_browser_20260411.md](C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_B07_bulk_payroll_partial_success_browser_20260411.md)
  - [b07-bulk-payroll-partial-success-browser-ui.spec.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/b07-bulk-payroll-partial-success-browser-ui.spec.ts)
- Surface da duoc cap nhat:
  - [payroll.component.ts](C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/src/app/components/payroll.component.ts)
- Root cause da sua:
  - Bulk payroll success path da surfacing exact thong diep kieu `Thanh cong 49, Loi 1`.
  - UI dong thoi liet ke tung user loi va nguyen nhan theo thu tu, khong con gom vao mot notification chung chung.
- Ket luan:
  - Khong con la open gap.

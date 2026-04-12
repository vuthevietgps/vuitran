# WAVE 1 FRONTEND SUMMARY (2026-04-10)

## Muc dich

- Cap nhat trang thai authoritative cua frontend Wave 1 sau dot triage `B04/B05`
- Tach ro nhung gi da dong duoc va nhung gi con lai chi la execution gap

## Scope

- Workspace: `school-mgmt/frontend`
- Ngay cap nhat: `2026-04-11`
- Mui gio: `UTC+7`
- Tai lieu tham chieu:
  - `qa/reports/frontend-ui/WAVE1-SUMMARY-20260409.vi.md`
  - `frontend-ui-evidence/2026-04-09/logs/LOG_B04_B05_WAVE1_20260410.md`
  - `frontend-ui-evidence/2026-04-09/logs/LOG_B09_CHATBOT_ORDER_20260410.md`
  - `frontend-ui-evidence/2026-04-09/logs/LOG_B05_WAVE1_20260409.md`
  - `frontend-ui-evidence/2026-04-09/logs/LOG_B07_WAVE1_20260409.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_CLASS_EDIT_RELOAD_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_classes_delete_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_PENDING_CLASS_UPDATES_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_TEACHER_SWAP_MARGIN_WARNING_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_SESSION_CHANGE_APPROVAL_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_ATTENDANCE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_ATTENDANCE_REPORT_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_PARENT_ATTENDANCE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_SESSION_DETAIL_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_SESSION_COMPLETE_MODAL_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_AUTO_CONFIRM_SOURCE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_SESSION_CANCEL_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_DEBT_LIMIT_WARNING_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_STUDENT_CONFIG_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_STUDENT_CONFIG_MULTI_SLOT_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B05_TEACHER_SWAP_PROPAGATION_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_sale_session_change_request_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_calendar_overview_filters_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_substitute_attendance_rbac_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_attendance_present_absent_late_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_offline_co_teaching_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_lead_lost_pool_stale_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_lead_reassign_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_lead_convert_order_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_trial_teacher_paid_only_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_Auth_Session_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_rbac_sidebar_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_route_guard_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_shareholder_redirect_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B01_auth_appshell_unknown_route_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B31_Auth_Security_Lockout_20260410.md`

## Bang trang thai nhanh theo batch

| Batch | Muc dich chinh | Status | Ghi chu |
| --- | --- | --- | --- |
| B01 | Login, auth, app shell, RBAC, route gating | PASS | Auth-appshell rerun `4/4 PASS`; B01 bundle same-day van xanh |
| B04 | Leads, orders, trials | PASS | Orders, leads, orchestration `fromLead`, trial UI, teacher-paid-only decision note, va lead lost/pool/stale + reassign + convert-to-order browser proofs da xanh; chatbot conversation-order da remap sang B09 |
| B05 | Class, session, attendance | PASS | Orchestration `4/4 PASS`; debt-limit warning, class-edit reload, class-delete, sale-side session-change request CTA/form/history, calendar-overview teacher/class filters, substitute-attendance RBAC, per-student attendance present-absent-late, va offline co-teaching browser proofs deu xanh |
| B07 | Invoices, wallets, payroll | PARTIAL_PASS | Slice da chay van xanh, nhung chua du de dong full batch |

## Update quan trong trong ngay 2026-04-10

- Full rerun `e2e/orchestrator/b04-b05-sales-ops.spec.ts`: `4/4 PASS`
- Focused rerun `e2e/b05-classes-edit-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-classes-delete-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-pending-class-updates-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/orchestrator/b04-b05-sales-ops.spec.ts --grep "B05 sale teacher swap shows margin shrinking warning before save and appears in pending approvals"`: `1/1 PASS`
- Focused rerun `e2e/b05-session-change-approval-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/b05-attendance-browser-ui.spec.ts`: `3/3 PASS`
- Focused rerun `e2e/b05-attendance-report-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/b05-parent-attendance-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/b05-session-detail-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-session-change-request-browser-ui.spec.ts`: `4/4 PASS`
- Focused rerun `e2e/b05-calendar-overview-filters-browser-ui.spec.ts`: `3/3 PASS`
- Focused rerun `e2e/b05-substitute-attendance-rbac-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/b05-attendance-present-absent-late-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-offline-co-teaching-browser-ui.spec.ts`: `3/3 PASS`
- Focused rerun `e2e/b04-trial-teacher-paid-only-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/b04-lead-attribution-merge-timeline-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-session-complete-modal-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-session-auto-confirm-source-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-session-cancel-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-session-debt-limit-warning-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-student-config-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-student-config-multi-slot-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b05-teacher-swap-propagation-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b04-lead-lifecycle-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b04-lead-reassign-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b04-lead-convert-order-browser-ui.spec.ts`: `1/1 PASS`
- Drift da duoc dong:
  - teacher-swap fixture drift
  - attendance actor + camera mock drift
  - sessions list visibility drift
  - finalize precondition drift
  - debt-limit dialog assumption drift
  - trial upload fixture drift
  - chatbot conversation-order oracle drift
- Nghia cua update nay:
  - B04 da du evidence de dong trong Wave 1
  - B05 co them evidence xanh cho teacher-swap margin warning, session-change approval, teacher-swap conflict validation, debt-limit warning tren `/app/sessions`, attendance link-only, substitute-attendance RBAC, per-student attendance present-absent-late, offline co-teaching config/attendance/report rights, attendance-report filter/pagination/preview, parent-attendance scoped render, ops finalize, session detail modal, sale-side session-change CTA/form/history, calendar-overview teacher/class filters, complete-session required-form flow, auto-confirm source clarity, va cancel-session metadata
  - B05 co them proof browser rieng cho `pending-approvals -> classes row/history -> sessions row/detail` sau khi approve teacher swap cap lop, va same-day conflict-validation proof tren manager review surface de dong line checklist rong hon
  - conversation -> order proof da duoc chot lai duoi B09 voi contract hien tai

## Batch notes

### B01

- Giu nguyen ket luan truoc do:
  - `PASS`
  - auth-appshell same-day rerun `4/4 PASS`
- Same-day hardening bo sung:
  - `e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts` da xanh `3/3`, trong do `B01 Auth_Session` xac nhan lai lockout/loading state va `401 -> /login`
  - `e2e/orchestrator/b01-auth-appshell.spec.ts` da xanh `4/4` cho sidebar RBAC, route guard, shareholder redirect, va unknown-route fallback
  - `auth-security-lockout.spec.ts` da xanh `1/1` cho lockout hardening; chi tiet tach rieng o `AUTH-HARDENING-20260410.vi.md`

### B04

- Da xanh o cac slice sau:
  - orders-heavy authoritative spec
  - leads CRUD / pipeline / stats / follow-up slice
  - lead edit / contact update / sale assignment browser lifecycle
  - lead reassign modal/confirm/history browser lifecycle
  - lead convert -> orders handoff with exact order-form prefill browser lifecycle
  - lead lost / return-to-pool / stale-pool browser lifecycle
  - legacy orders pair sau khi on dinh spec
  - lead-to-order orchestration trong `b04-b05-sales-ops.spec.ts`
  - explicit trial UI trong `ui-automation-video-pilots.spec.ts`
  - dedicated `trial/teacher-paid-only` browser proof tren trial-enrollments, giu note rieng `Van tra luong GV, khong charge PH`
- Ket luan:
  - `B04` co the chot `PASS` cho Wave 1
  - reassign lead khong con la execution gap: modal chon nguoi nhan, confirm, row/detail owner, va assignment history da co same-day browser proof
  - convert lead khong con la execution gap: browser proof da dong `confirm -> /leads/:id/convert -> /app/orders?fromLead=... -> order form prefill`
  - attribution merge timeline khong con la execution gap: lead detail da fetch detail endpoint rieng va render du 2 touchpoint `Facebook/Chatbot -> Google/Landing Page`
  - trial teacher-paid-only khong con la execution gap: UI chi surfacing action o `WAITING_DECISION`, post exact endpoint, va reload row voi note phan biet ro voi reject no-pay
  - `chatbot-order-source` khong con duoc xem la execution gap cua `B04`; proof nay da duoc chay va ghi ve `B09`

### B05

- Authoritative Wave 1 hien tai bao gom:
  - `e2e/specs/scenarios-deep-sessions-2-1-to-3-4.spec.ts`
  - `e2e/specs/attendance-link-only-teacher.spec.ts`
  - `e2e/orchestrator/b04-b05-sales-ops.spec.ts`
  - `e2e/b05-classes-edit-browser-ui.spec.ts`
  - `e2e/b05-classes-delete-browser-ui.spec.ts`
  - `e2e/b05-pending-class-updates-browser-ui.spec.ts`
  - `e2e/b05-attendance-browser-ui.spec.ts`
  - `e2e/b05-attendance-report-browser-ui.spec.ts`
  - `e2e/b05-parent-attendance-browser-ui.spec.ts`
  - `e2e/b05-session-detail-browser-ui.spec.ts`
  - `e2e/b05-session-change-request-browser-ui.spec.ts`
  - `e2e/b05-session-reschedule-browser-ui.spec.ts`
  - `e2e/b05-substitute-attendance-rbac-browser-ui.spec.ts`
  - `e2e/b05-attendance-present-absent-late-browser-ui.spec.ts`
  - `e2e/b05-offline-co-teaching-browser-ui.spec.ts`
  - `e2e/b05-calendar-overview-filters-browser-ui.spec.ts`
  - `e2e/b05-session-complete-modal-browser-ui.spec.ts`
  - `e2e/b05-session-auto-confirm-source-browser-ui.spec.ts`
  - `e2e/b05-session-cancel-browser-ui.spec.ts`
  - `e2e/b05-session-debt-limit-warning-browser-ui.spec.ts`
  - `e2e/b05-student-config-browser-ui.spec.ts`
  - `e2e/b05-student-config-multi-slot-browser-ui.spec.ts`
  - `e2e/b05-teacher-swap-propagation-browser-ui.spec.ts`
- Ket qua:
  - baseline B05 truoc do: `13/13 PASS`
  - orchestration extension 2026-04-10: `4/4 PASS`
  - class edit reload browser proof 2026-04-10: `1/1 PASS`
  - class delete browser proof 2026-04-10: `1/1 PASS`
  - pending class approve/reject browser proof 2026-04-10: `2/2 PASS`
  - teacher-swap margin-warning rerun 2026-04-10: `1/1 PASS`
  - session-change approval browser proof 2026-04-10: `2/2 PASS`
  - teacher-swap conflict-validation extension on session-change approval browser proof 2026-04-11: `3/3 PASS`
  - sale-side session-change request browser proof 2026-04-11: `4/4 PASS`
  - session reschedule browser proof 2026-04-11: `2/2 PASS`
  - calendar-overview teacher/class filters browser proof 2026-04-11: `3/3 PASS`
  - attendance browser proof 2026-04-10: `3/3 PASS`
  - attendance-report browser proof 2026-04-10: `2/2 PASS`
  - parent-attendance browser proof 2026-04-10: `2/2 PASS`
  - session detail browser proof 2026-04-10: `1/1 PASS`
  - teacher complete modal browser proof 2026-04-10: `1/1 PASS`
  - auto-confirm source browser proof 2026-04-10: `1/1 PASS`
  - cancel session browser proof 2026-04-10: `1/1 PASS`
  - debt-limit warning browser proof 2026-04-10: `1/1 PASS`
  - student-config browser proof 2026-04-10: `1/1 PASS`
  - student-config multi-slot browser proof 2026-04-10: `1/1 PASS`
  - teacher-swap propagation browser proof 2026-04-10: `1/1 PASS`
  - offline co-teaching browser proof 2026-04-11: `3/3 PASS`
- Danh gia:
  - B05 co the giu `PASS` cho Wave 1
  - same-day co-teaching line da co authoritative browser proof; backlog B05 ve `0`
  - teacher-swap line rong hon trong checklist da dong bang to hop evidence: propagation browser proof 2026-04-10 + conflict-validation browser proof 2026-04-11

### B07

- Khong co thay doi moi trong dot nay
- Giu `PARTIAL_PASS` cho cac slice da chay

## Ket luan Wave 1 frontend hien tai

- `B01`: co the dong
- `B05`: co the dong
- `B04`: co the dong
- `B07`: giu `PARTIAL_PASS` cho den khi mo them coverage

## De xuat tiep theo

1. Mo `Wave 2` frontend
2. Khong carry `B04` sang dot sau nua
3. Giu `B09` conversation-to-order evidence o log rieng cua `B09`
4. Chon nhanh giua `B07` expansion va `Wave 2` domain coverage

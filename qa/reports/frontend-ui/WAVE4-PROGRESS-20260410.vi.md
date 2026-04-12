# WAVE 4 FRONTEND PROGRESS (2026-04-10)

## Muc dich

- Ghi nhan evidence authoritative cho cac slice frontend thuoc Wave 4.
- Tach ro gi da xanh trong current orchestrator suite va gi van la backlog mo.

## Scope

- Workspace: `school-mgmt/frontend`
- Ngay cap nhat: `2026-04-11`
- Mui gio: `UTC+7`
- Rerun authoritative:
- `e2e/b03-parent-ads-attribution-browser-ui.spec.ts`
- `e2e/b03-parent-owner-transfer-browser-ui.spec.ts`
- `e2e/b03-users-over-permission-browser-ui.spec.ts`
- `e2e/b03-agent-tier-matrix-browser-ui.spec.ts`
- `e2e/b03-teacher-onboarding-salary-config-browser-ui.spec.ts`
- `e2e/b03-students-permission-browser-ui.spec.ts`
- `e2e/b03-student-multi-parent-browser-ui.spec.ts`
  - `e2e/b03-student-face-upload-browser-ui.spec.ts`
  - `e2e/b06-teacher-profiles-permission-browser-ui.spec.ts`
  - `e2e/b06-teacher-profiles-bankinfo-validation-browser-ui.spec.ts`
  - `e2e/b06-teacher-profiles-save-browser-ui.spec.ts`
  - `e2e/b06-teacher-self-profile-bankinfo-browser-ui.spec.ts`
  - `e2e/b06-sessions-parent-confirm-browser-ui.spec.ts`
  - `e2e/b06-low-rating-ops-browser-ui.spec.ts`
  - `e2e/b06-teacher-kpi-browser-ui.spec.ts`
  - `e2e/b06-teacher-kpi-penalty-visibility-browser-ui.spec.ts`
  - `e2e/b06-payroll-preview-groups-browser-ui.spec.ts`
  - `e2e/b06-teaching-report-dynamic-fields-browser-ui.spec.ts`
  - `e2e/b06-student-progress-browser-ui.spec.ts`
  - `e2e/b06-teaching-materials-dragdrop-browser-ui.spec.ts`
  - `e2e/b06-teaching-materials-list-browser-ui.spec.ts`
  - `e2e/specs/b06-b11-followup-ui.spec.ts`
  - `e2e/orders-report-metrics-ui.spec.ts --grep "keeps orders, comprehensive-report and attendance-report metrics aligned after approval"`
  - `e2e/materials-export-students-ui.spec.ts --grep "27.3 Export Attendance CSV (Large Export)"`
  - `e2e/materials-export-students-ui.spec.ts --grep "27.1 Export Payroll CSV|27.2 Export Invoices CSV|27.3 Export Attendance CSV"`
  - `e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts`
  - `e2e/orchestrator/b03-users-products-agents.spec.ts`
  - `e2e/specs/b06-b11-followup-ui.spec.ts --grep "B11 teaching report submit-edit theo thang, teacher code lookup va role guard chan parent-sale"`
  - `e2e/b11-employee-performance-browser-ui.spec.ts`
  - `e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts --grep "OPS dashboard overdue tickets highlighted red|export CSV with UTF-8 BOM and export RBAC"`
  - `e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts --grep "B11 comprehensive report masks shareholder data and employee performance blocks direct URL"`
  - `e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts --grep "B11 export-reports breadth validates filters, downloads, and accounting surface"`
  - `e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts --grep "B11 export-reports keeps domain filenames and ads parameter split"`
  - `e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts --grep "B11 ads realized cohort export preserves zero refund rate in query|B11 export-reports breadth validates filters, downloads, and accounting surface"`
- Tai lieu tham chieu:
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_PARENT_ADS_ATTRIBUTION_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B03_parent_owner_transfer_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B03_users_over_permission_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B03_users_self_edit_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B03_agent_tier_matrix_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B03_teacher_onboarding_salary_config_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_STUDENTS_PERMISSION_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B03_students_multi_parent_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_STUDENT_FACE_UPLOAD_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHER_PROFILES_PERMISSION_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHER_PROFILES_BANKINFO_VALIDATION_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHER_PROFILES_SAVE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHER_SELF_PROFILE_BANKINFO_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHER_SELF_PROFILE_QUALIFICATIONS_AVAILABILITY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_SESSIONS_PARENT_CONFIRM_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B06_low_rating_ops_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHER_KPI_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B06_teacher_kpi_penalty_visibility_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B06_teacher_payroll_preview_five_groups_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B06_teaching_report_dynamic_fields_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B06_bulk_teaching_report_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B06_general_feedback_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_STUDENT_PROGRESS_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHING_MATERIALS_DRAGDROP_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_TEACHING_MATERIALS_LIST_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_Users_Products_Parents_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_users_products_agents_products_deactivation_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_users_products_agents_sale_order_guard_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_users_products_agents_agent_create_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B03_teacher_deactivation_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B06_teacher_report_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_TEACHING_REPORT_INLINE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_EMPLOYEE_PERFORMANCE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_FOLLOWUP_UI_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_ops_dashboard_overdue_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_exports_reports_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_comprehensive_masking_employee_rbac_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_REPORT_BREADTH_LARGE_EXPORT_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_EXPORT_REPORTS_BREADTH_RERUN_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_EXPORT_REPORTS_DOMAIN_FILENAMES_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_ADS_EXPORT_BODY_SEMANTICS_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_ADS_COHORT_ZERO_REFUND_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_EXPORT_API_SEMANTICS_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B11_STREAMING_SCALE_ORACLE_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B11_shareholder_masked_export_browser_20260411.md`

## Bang trang thai nhanh theo batch

| Batch | Slice authoritative moi | Status | Ghi chu |
| --- | --- | --- | --- |
| B03 | Product create/deactivate, sale dropdown guard, agent create GOLD 15%, agent tier matrix exact commission browser flow, teacher onboarding + salary config browser flow, pending approvals va parent persistence, student face upload success/error browser flow, parent ads attribution create/update/delete browser flow, parent owner transfer confirm + sale-scoped views, teacher deactivation strict confirm/status/action-hiding browser flow, users-management over-permission browser contrast, users self-edit safe-flow browser proof, students permission matrix browser flow, students multi-parent render/save-preserve browser flow | PASS | Face upload browser spec `2/2 PASS`, students multi-parent browser spec `2/2 PASS`, parent ads attribution browser spec `2/2 PASS`, parent owner transfer browser spec `1/1 PASS`, teacher deactivation browser spec `1/1 PASS`, users over-permission browser spec `1/1 PASS`, users self-edit browser spec `1/1 PASS`, agent tier matrix browser spec `1/1 PASS`, teacher onboarding + salary config browser spec `1/1 PASS`, students permission browser spec `1/1 PASS`, va cross-cutting `Users_Products_Parents` `1/1 PASS`; multi-parent khong con la gap, B03 checklist surface da du authoritative browser proof |
| B06 | Parent invoices scope, student-progress parent learning page, parent confirm rating control + success feedback + submitted state, parent general-feedback surface + persistence, low-rating visibility for OPS on sessions row/detail, teacher profiles permission + finance masking matrix, teacher-profile bankInfo validation failure semantics, teacher-profile save payload matrix, teacher self-profile bankInfo validation + trimmed save semantics, teacher self-profile qualification/availability save semantics, teaching-report template prefill/draft semantics, teaching-report dynamic-field rendering + validation + persisted snapshot semantics, teacher KPI filter/sort/detail + date-filter refresh semantics, teacher KPI penalty visibility, teacher payroll preview 5 groups with exact summary cards + session filters including cancelled, offline bulk teaching report for same-class same-day multi-student submission, teaching materials drag-drop upload browser flow, teaching materials load-more no-duplicate semantics, teaching materials empty/error browser states | PASS | Follow-up spec `7/7 PASS` co `1` case `B06` va `6` case `B11`; teacher profiles permission browser spec `3/3 PASS`; teacher profiles bankInfo validation browser spec `2/2 PASS`; teacher profiles save browser spec `3/3 PASS`; teacher self-profile browser spec `3/3 PASS`; sessions parent-confirm browser spec `1/1 PASS`; general-feedback browser spec `1/1 PASS`; low-rating OPS browser spec `1/1 PASS`; teaching-report template browser spec `2/2 PASS`; teaching-report dynamic-fields browser spec `1/1 PASS`; teacher KPI browser spec `2/2 PASS`; teacher KPI penalty browser spec `1/1 PASS`; teacher payroll preview browser spec `1/1 PASS`; bulk teaching report browser spec `1/1 PASS`; student-progress browser spec `2/2 PASS`; teaching materials drag-drop browser spec `2/2 PASS`; teaching materials list browser spec `3/3 PASS`; current B06 checklist surface da duoc dong authoritative |
| B11 | Teaching report submit/edit/inline update + month filter + teacher code lookup + parent/sale guard, audit log stats/filter/paging/read-only, export CSV BOM/RBAC, comprehensive masking, employee performance RBAC + dashboard load/filter/detail, comprehensive sale filter, student-report preview image, report breadth, attendance large export, export-reports breadth, export domain filename semantics, ads export CSV body semantics + zero-refund edge, payroll-invoices-financial API semantics, browser-level streaming-scale oracle, shareholder masked export/download | PASS | Follow-up spec `7/7 PASS`, employee-performance browser rerun `2/2 PASS`, dedicated teaching-report inline rerun `1/1 PASS`, isolated rerun `2/2 PASS`, comprehensive/RBAC rerun `1/1 PASS`, orders-report breadth `1/1 PASS`, large export attendance `4/4 PASS`, export-reports breadth `1/1 PASS`, export filename semantics `1/1 PASS`, ads export semantics bundle `2/2 PASS`, export API semantics bundle `16/16 PASS`, streaming-scale oracle `1/1 PASS`, shareholder masked export browser rerun `2/2 PASS`; true chunked transport simulation van ngoai scope |

## Ket qua chinh cua dot 2026-04-10 va 2026-04-11

- Full rerun `e2e/b03-parent-ads-attribution-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b03-parent-owner-transfer-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b03-teacher-deactivation-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b03-users-over-permission-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b03-users-self-edit-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b03-agent-tier-matrix-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b03-teacher-onboarding-salary-config-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b03-students-permission-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b03-student-multi-parent-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b03-student-face-upload-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b06-teacher-profiles-permission-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b06-teacher-profiles-bankinfo-validation-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b06-teacher-profiles-save-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b06-teacher-self-profile-bankinfo-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b06-sessions-parent-confirm-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b06-low-rating-ops-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b06-teacher-kpi-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b06-teacher-kpi-penalty-visibility-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b06-payroll-preview-groups-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b06-teaching-report-dynamic-fields-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b06-bulk-teaching-report-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b06-general-feedback-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b06-student-progress-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b06-teaching-materials-dragdrop-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b06-teaching-materials-list-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/specs/b06-b11-followup-ui.spec.ts`: `7/7 PASS`
- Isolated rerun `e2e/orders-report-metrics-ui.spec.ts` authoritative alignment flow: `1/1 PASS`
- Isolated rerun `e2e/materials-export-students-ui.spec.ts` `27.3 Export Attendance CSV (Large Export)`: `4/4 PASS`
- Export API semantics rerun `e2e/materials-export-students-ui.spec.ts --grep "27.1 Export Payroll CSV|27.2 Export Invoices CSV|27.3 Export Attendance CSV"`: `16/16 PASS`
- Full rerun `e2e/orchestrator/b03-users-products-agents.spec.ts`: `3/3 PASS`
- Full rerun `e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts`: `3/3 PASS`, trong do B03 cross-cutting slice xanh `1/1`
- Isolated rerun `B11 teaching report submit-edit theo thang, teacher code lookup va role guard chan parent-sale`: `1/1 PASS`
- Full rerun `e2e/b11-employee-performance-browser-ui.spec.ts`: `2/2 PASS`
- Isolated rerun `B11 OPS dashboard overdue tickets highlighted red|export CSV with UTF-8 BOM and export RBAC`: `2/2 PASS`
- Isolated rerun `B11 comprehensive report masks shareholder data and employee performance blocks direct URL`: `1/1 PASS`
- Isolated rerun `B11 export-reports breadth validates filters, downloads, and accounting surface`: `1/1 PASS`
- Isolated rerun `B11 export-reports keeps domain filenames and ads parameter split`: `1/1 PASS`
- Focused bundle rerun `B11 ads realized cohort export preserves zero refund rate in query|B11 export-reports breadth validates filters, downloads, and accounting surface`: `2/2 PASS`
- Focused bundle rerun `B11 export-reports keeps domain filenames and ads parameter split|B11 ads realized cohort export preserves zero refund rate in query`: `2/2 PASS`
- Focused rerun `B11 large streaming export keeps loading state safe until financial CSV download completes`: `1/1 PASS`

## Batch notes

### B03

- Da xanh o cac slice sau:
  - tao product qua UI
  - deactivate product va doi badge/list state
  - sale order form khong con hien product inactive
  - tao agent tier `GOLD` voi commission `15%`
  - tao parent moi giu strict `/users` payload va persist attribution ads qua endpoint rieng
  - chuyen sale owner cua parent giu dung confirm, row/detail reload, va scope parent/student theo `SALE` cu/moi
  - cap nhat attribution ads cua parent qua detail pane voi loading/save state dung
  - bo gan attribution ads tra row/detail ve trang thai `Chua gan nhom ads`
  - users-management browser contrast chan delete/self-mutation vuot quyen: `DIRECTOR` chi duoc edit-delete row hop le, self row van giu delete an va role selector bi khoa trong self-edit modal
  - self-edit current account flow mo duoc modal sua cua chinh minh, chi luu basic fields, khong bao gio gui role mutation, va reload dung `DIRECTOR` + `ACTIVE`
  - agents page giu dung create payload, row/detail render, va tier filter cho bo `SILVER 5% / GOLD 15% / PLATINUM 25%` ma khong tron lan tier hoac commission
  - teacher onboarding create flow nay gui dung nested `salaryConfig` trong `POST /users`, chan submit khi thieu `baseSalary`, va surfacing dung config vua tao tren man `/app/salary-config`
  - `SALE` bi khoa o parent-only scope, khong bao gio hit all-users endpoint, khong thay parent ngoai ownership, va khong thay delete/director-only surfaces
- `ACCOUNTING` bi redirect som sang `/not-authorized` truoc khi data account-management load
- ma tran quyen tren `/app/students`: `ACCOUNTING` vao duoc nhung read-only, `OPS` duoc them/sua nhung khong xoa, `DIRECTOR` co full create/edit/delete
- students multi-parent browser flow giu owner parent o line chinh, render tach bach `PH phu`, va submit exact `parentUserId + parentUserIds` ma khong leak UI-only field vao `PATCH /students/:id`
- upload anh khuon mat hoc sinh giu dung loading, preview, persisted `faceImage`, va create-row render sau reload
- upload that bai hien dung `Tai anh that bai`, khong de stale preview, va submit bi chan o validation `Vui long tai anh nhan dien`
- pending approvals class approve + badge/tab sync
- products empty state sau filter
- parent reassignment va detail persistence tren student editor
- parent list view + RBAC contrast cho sensitive controls
- teacher deactivation tren teacher-profiles giu strict confirm, doi status `ACTIVE -> SUSPENDED` tren detail/list, va an action khong con hop le trong khi hien `Kich hoat lai`
- `B03` da du de ghi `PASS`; multi-parent khong con la backlog coverage mo trong current checklist canonical.

### B06

- Da xanh o cac slice sau:
  - parent invoices chi hien thi dung pham vi parent hien tai
  - teacher profiles list va detail tai duoc dung voi teacher `PENDING`
  - `DIRECTOR` thay `Duyet`, finance cards, bank info, va director-only controls trong edit modal
  - `ACCOUNTING` giu duoc finance surfaces nhung khong thay `Duyet`, `Mat khau moi`, hoac `Sale quan ly`
  - `SALE` vao duoc detail route va edit modal nhung bi mask toan bo finance surfaces
  - partial bank info cho `DIRECTOR` va `ACCOUNTING` nay bi chan truoc save voi exact validation text, zero `PATCH` calls, va persisted bank card giu nguyen du lieu cu
  - `DIRECTOR` save flow gui dung payload chung + `user.password` + `bankInfo` + `managedSales`
  - `ACCOUNTING` save flow giu `bankInfo` nhung khong gui `user.password` hoac `managedSales`
  - `SALE` save flow chi gui payload chung, khong bao gio gui `bankInfo` hoac `managedSales`
  - sau save, detail reload dung du lieu moi theo tung role
  - self-profile teacher route nay chan branch-only bank info voi exact validation text, zero `PATCH` calls, va giu edit mode mo de sua loi
  - self-profile teacher route nay trim `bankInfo` truoc save va reload dung bank card voi account mask `99****6655`
  - teacher KPI page giu dung default descending KPI order, status filter, sort theo `name/sessions`, card-view carry-over, va detail modal values cho giao vien duoc chon
  - teacher KPI date filters gui dung `fromDate/toDate` query params va refresh dung summary + teacher list theo payload moi
  - teacher KPI nay surfacing `tong tien phat` thanh metric doc lap tren row, card, va detail financial card thay vi de chim trong payout totals
  - teacher payroll preview giu ro 5 nhom checklist `Da thanh toan / Cho PH / Cho OPS / Thieu bao cao / Huy` bang exact summary cards, va session-filter tabs nay da cover du ca `CANCELLED`
  - parent route `/app/student-progress` tai dung metrics, homework rows, va teacher comments theo tung hoc sinh; chuyen tab giu dung rebind sang child dang chon
  - student-progress error state hien exact backend message va khong giu stale tabs, score cards, homework, hoac teacher comments sau load fail
  - teaching materials upload bang drag-drop gui dung file payload, hien dung loading/success state, va refresh dung row moi sau upload
  - teaching materials load-more gui dung `page=2`, append dung batch tiep theo, va khong duplicate row khi page sau tra ve cung `_id`
  - teaching materials empty state va error state hien dung CTA khoi tao, exact error alert, va khong giu stale rows sau reset-load fail
  - teacher hub vao trang teaching report
  - submit teaching report
  - inline edit teacher comment
  - shareholder read-only guard tren teaching report
  - teaching-report pending form render tach rieng own/global report templates, apply template vao `lessonContent`, autosave/restore draft theo `teaching-report-draft-${sessionId}`, va clear draft sau submit thanh cong
  - teaching-report dynamic template render dung cac field theo schema class-bound, chot validation required theo tung field dong, va completed view doc lai dung snapshot `Tu vung / Ngu phap / Phat am / Bai tap ve nha`
- Follow-up spec authoritative hien la `7/7 PASS`, nhung chi co `1` slice `B06`; `6` case con lai thuoc `B11`. Ngoai ra da co dedicated `B06` template browser spec `2/2 PASS`, teacher KPI browser spec `2/2 PASS`, teacher KPI penalty browser spec `1/1 PASS`, bulk teaching report browser spec `1/1 PASS`, va general-feedback browser spec `1/1 PASS`.
- `B06` da du same-day authoritative browser proof cho dynamic-field rendering theo Report Template schema; backlog `Nhom 6` hien ve `0`.

### B11

- Da xanh o cac slice sau:
  - overdue highlight tren OPS dashboard
  - export CSV co UTF-8 BOM
  - export RBAC guard
  - export filename theo domain `bang-luong / hoa-don / tai-chinh / ads-parent-profit / ads-realized-cohort`
  - payroll export header/body semantics va `status=APPROVED` filter semantics
  - invoices export header/body semantics va `status=APPROVED` filter semantics
  - financial export ledger header/body semantics voi domain event types `TOP_UP / SESSION_DEDUCT / ADJUSTMENT`
  - comprehensive report masking cho `SHAREHOLDER`
  - comprehensive report an nut export/search va che thong tin nhay cam tren bang
  - comprehensive report class filter, search flow, mismatch `dataStatus` no-data, va restore flow
  - comprehensive report sale filter tach row dung theo `Sale Alpha` / `Sale Bravo` va cap nhat summary total rows
  - student report class filter, search, summary alignment, va no-data state
  - student report preview image modal mo dung tu avatar row
  - teaching report pending/completed, month filter, teacher code lookup, submit/edit
  - audit log thong ke, module filter, pagination va read-only
  - employee performance chi mo cho `DIRECTOR` va chan direct URL voi `SHAREHOLDER`
  - employee performance dashboard load dung 3 tab `teachers / sales / ops`, filter theo `name/email`, va detail modal giu dung metrics theo tung bo phan
  - attendance large export role matrix (`DIRECTOR`, `OPS`, `SALE`, `ACCOUNTING`)
  - export-reports breadth cho `payroll`, `invoices`, `financial`, `attendance`, `ads parent profit`, `ads realized cohort`
  - export-reports tach dung semantics `ads parent profit` khong mang cohort params, trong khi `ads realized cohort` giu `maturityDays` va `refundRatePercentX`
  - ads parent-profit CSV body semantics da duoc assert o header shape va key row fields `Report start / Platform / Revenue / Net profit`
  - ads realized-cohort CSV body semantics da duoc assert o header shape va key row fields `Maturity days / Refund rate X / Projected net profit / Projection basis`
  - export ads realized cohort giu duoc `refundRatePercentX=0` trong query sau khi sua frontend truthy-filter bug
  - shareholder export tren `investor-dashboard` da co CTA rieng, loading/toast flow, va file CSV masked `PH #n / An danh / HS #n`
  - accounting surface cua `export-reports` an dung card `attendance` nhung van giu `payroll/invoices/financial/students/ads`
  - browser-level streaming-scale oracle sau download da duoc dong voi evidence `download event + BOM + 50,001 rows + tail row intact`, nhung true chunked/backpressure transport van chua duoc simulate trong current Playwright harness.

## Ket luan Wave 4 frontend hien tai

- `B03`: current orchestrator + student-face-upload + parent-ads-attribution + parent-owner-transfer + teacher-deactivation + users-over-permission + users-self-edit + agent-tier-matrix + teacher-onboarding-salary-config + students-permission + students multi-parent browser slices da xanh; batch `B03` hien co the ghi `PASS`
- `B06`: teacher-profiles permission/bankInfo validation/save matrix + teacher self-profile bankInfo semantics + teacher KPI penalty visibility + teaching report dynamic-field slice da xanh; batch `B06` hien co the ghi `PASS`
- `B11`: dashboard/export slice da xanh day du, bao gom same-day shareholder masked export browser proof, nen current batch co the ghi `PASS`

## Buoc tiep theo hop ly

1. Wave 4 hien da co the xem la `PASS` tren current authoritative scope `B03/B06/B11`.
2. Buoc hop ly tiep theo la giam no ky thuat suite-level: quarantine `skip/fixme` cu, don report canonical, va doi chieu full regression gate.

# NHOM 12 FRONTEND PROGRESS (2026-04-10)

## Muc dich

- Ghi nhan authoritative progress cho cac line cross-surface thuoc `Nhom 12`.
- Tach rieng cac line cross-cutting khoi `Wave 2/3/4` de tranh nhat ky sai scope.

## Scope

- Workspace: `school-mgmt/frontend`
- Rerun authoritative:
  - `e2e/app-shell-handbook-browser-ui.spec.ts --grep "login 429 hien thi"`
  - `e2e/b09-conversations-browser-ui.spec.ts`
  - `e2e/b09-notifications-browser-ui.spec.ts`
  - `e2e/nhom12-shareholder-readonly-browser-ui.spec.ts`
  - `e2e/change-requests-capital-ui.spec.ts --grep "ACCOUNTING xem Loans"`
  - `e2e/change-requests-capital-ui.spec.ts --grep "TEACHER khong thay nut Chot buoi hoc"`
  - `e2e/nhom12-hidden-rbac-actions-browser-ui.spec.ts`
  - `e2e/nhom12-modal-dirty-state-browser-ui.spec.ts`
  - `e2e/nhom12-double-click-guard-browser-ui.spec.ts`
  - `e2e/nhom12-refresh-state-browser-ui.spec.ts`
  - `e2e/nhom12-loading-state-browser-ui.spec.ts`
  - `e2e/nhom12-dashboard-empty-state-browser-ui.spec.ts`
  - `e2e/nhom12-flow-guide-browser-ui.spec.ts`
  - `e2e/nhom12-vi-vn-format-browser-ui.spec.ts`
  - `e2e/director-dashboard-browser-ui.spec.ts --grep "dashboard khong vo layout o man hinh hep"`
  - `e2e/nhom12-responsive-layout-browser-ui.spec.ts`
  - `e2e/nhom12-scroll-layout-browser-ui.spec.ts`
  - `e2e/nhom12-multi-tab-browser-ui.spec.ts`
  - `e2e/nhom12-accessibility-browser-ui.spec.ts`
  - `e2e/nhom12-accounting-classes-readonly-browser-ui.spec.ts`
- Tai lieu tham chieu:
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_RATE_LIMIT_FRIENDLY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_DUPLICATE_GUARD_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_SHAREHOLDER_READONLY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_ACCOUNTING_LOANS_READONLY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_TEACHER_NO_FINALIZE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_invoice_delete_hidden_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_wallet_transfer_hidden_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_modal_dirty_state_teaching_materials_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_modal_dirty_state_chatbot_fanpage_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_DOUBLE_CLICK_GUARD_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_REFRESH_STATE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_LOADING_STATE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_DASHBOARD_EMPTY_STATE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_FLOW_GUIDE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_VI_VN_FORMAT_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_RESPONSIVE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_SCROLL_LAYOUT_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_MULTI_TAB_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_ACCESSIBILITY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_ACCOUNTING_CLASSES_STUDENTS_READONLY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_accounting_classes_readonly_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_refresh_state_pending_approvals_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_refresh_state_ticket_detail_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_refresh_state_public_landing_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_loading_state_chatbot_fanpage_save_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_loading_state_ticket_create_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_loading_state_public_landing_submit_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_dashboard_empty_state_sale_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_dashboard_empty_state_parent_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_flow_guide_dashboard_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_flow_guide_chatbot_settings_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_vi_vn_format_wallets_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_vi_vn_format_chatbot_settings_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_responsive_chatbot_settings_tablet_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_responsive_public_landing_narrow_desktop_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_scroll_layout_load_more_materials_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_scroll_layout_wide_table_ads_analytics_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_multi_tab_notifications_state_sync_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_multi_tab_pending_state_sync_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_accessibility_login_form_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_accessibility_internal_handbook_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_CONVERSATIONS_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B03_STUDENTS_PERMISSION_BROWSER_20260410.md`

## Ket qua chinh cua dot 2026-04-10

- Focused rerun `e2e/app-shell-handbook-browser-ui.spec.ts --grep "login 429 hien thi"`: `1/1 PASS`
- Cross-surface duplicate guard qua `conversations realtime` + `notifications polling`: `PASS`
- Full rerun `e2e/nhom12-shareholder-readonly-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/change-requests-capital-ui.spec.ts --grep "ACCOUNTING xem Loans"`: `1/1 PASS`
- Focused rerun `e2e/change-requests-capital-ui.spec.ts --grep "TEACHER khong thay nut Chot buoi hoc"`: `1/1 PASS`
- Full rerun `e2e/nhom12-hidden-rbac-actions-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-modal-dirty-state-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-double-click-guard-browser-ui.spec.ts`: `4/4 PASS`
- Full rerun `e2e/nhom12-refresh-state-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/nhom12-loading-state-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/nhom12-dashboard-empty-state-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-flow-guide-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-vi-vn-format-browser-ui.spec.ts`: `2/2 PASS`
- Focused rerun `e2e/director-dashboard-browser-ui.spec.ts --grep "dashboard khong vo layout o man hinh hep"`: `1/1 PASS`
- Full rerun `e2e/nhom12-responsive-layout-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-scroll-layout-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-multi-tab-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-accessibility-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/nhom12-accounting-classes-readonly-browser-ui.spec.ts`: `1/1 PASS`

## Line da dong same-day

- `Khi backend tra 429 Too Many Requests, UI hien thi thong bao than thien kieu "Ban thao tac qua nhanh" hoac tuong duong, khong quang loi server chung chung kho hieu`
- `Realtime hoac polling khong tao duplicate item tren UI`
- `Man financial-control, aging-report, investor-dashboard o mode SHAREHOLDER hien thi read-only, khong lo nut Sua/Xoa/Approve`
- `Nut "Tao khoan vay" bi an doi voi ACCOUNTING, chi role phu hop moi thay CTA tao moi`
- `Nut/chuc nang "Finalize" o Session bi an doi voi TEACHER, khong de lo action sai quyen tren UI`
- `Cot Actions o Invoices khong hien thi nut Xoa cho ACCOUNTING, SALE, OPS neu khong co quyen xoa`
- `Role OPS khong duoc thay nut Chuyen vi hoac action transfer wallet o moi man vi lien quan`
- `Role ACCOUNTING duoc xem man Lop/Hoc sinh de doi soat nhung UI an toan bo nut Sua/Xoa hoac action thay doi du lieu tren cac man nay`
- `Cac modal mo/dong nhieu lan khong giu state ban ngoai y muon`
- `Double click khong tao du lieu trung hoac chuyen trang thai hai lan`
- `Refresh trang o man hinh dang xem khong lam loi state co ban`
- `Loading state hien thi ro va khong cho thao tac gay submit lap`
- `Dashboard cua user moi tinh nhu Sale chua co so lieu hoac Phu huynh chua co con hien thi empty state than thien va CTA phu hop`
- `Widget Flow Guide / Mo ta luong mo dong dung tren cac man co nhung, render dung tieu de, mo ta, checklist va khong lam vo layout khi thu gon/mo rong`
- `Du lieu format ngay gio, tien te theo vi-VN hien thi nhat quan`
- `Responsive tren desktop hep, tablet va mobile khong vo bo cuc quan trong`
- `Scroll dai, bang lon, load them du lieu khong bi nhay layout bat thuong`
- `Kiem tra behavior khi mo nhieu tab cung luc va trang thai thay doi o tab khac`
- `Kiem tra accessibility co ban: focus, keyboard navigation, label form, contrast o man hinh chinh`
- `Deep-link bang URL/query param mo dung man hinh va dung trang thai`
- `Upload file fail hien thi dung error surface`
- `Preview image/file modal khong vo UI`
- `Form validation dung tren required/missing data va validation text`

## Ghi chu bao thu

- Report nay chi ghi nhan cac line `Nhom 12` da co same-day browser evidence authoritative.
- Login `429` closure trong dot nay di kem product fix o `login.component.ts`; do do report nay gom ca proof regression va proof UI wording sau fix.
- Line `deep-link/query param` duoc sync bao thu tu same-day browser evidence da co san o `B09 notifications link routing`, `B09 ticketId deep-link`, va `B10 public landing slug routing`; khong co rerun moi rieng trong dot `NHOM12`.
- Line `upload error` duoc sync bao thu tu same-day browser evidence o `B03 student face upload failure`.
- Line `preview/file preview` duoc sync bao thu tu same-day browser evidence o `B03 student face upload success` va `B11 student-report preview modal`.
- Line `form validation` duoc sync bao thu tu same-day browser evidence o `B03 student face upload`, `B06 teacher-profile bankInfo validation`, `B09 chatbot-settings validation`, va `B09 ticket lifecycle create validation`.
- Line `modal dirty state` duoc dong bang rerun focused cross-surface tren `teaching-materials upload modal` va `chatbot-settings fanpage create modal`, deu chung minh dirty draft bi xoa sach sau khi dong va mo lai modal.
- Line `double click guard` duoc dong bang rerun focused cross-surface tren `landing management create`, `chatbot fanpage create`, `public landing submit`, va `ticket workflow action`; moi surface deu giu request count va side effect dung o muc `1 lan`.
- Line `refresh state` duoc dong bang rerun focused cross-surface tren `pending-approvals?tab=classes`, `tickets?tab=assigned&ticketId=...`, va public landing theo `slug`; moi surface deu giu route/state co ban sau `page.reload()`.
- Line `loading state` duoc dong bang rerun focused cross-surface tren `chatbot fanpage save`, `ticket create`, va `public landing submit`; moi surface deu hien pending label ro rang va giu request count dung o muc `1` trong suot thoi gian request con in-flight.
- Line `dashboard empty state` duoc dong bang rerun focused cross-surface tren `SALE dashboard` va `PARENT dashboard`; `SALE` duoc chuyen sang onboarding state thay vi KPI zero, con `PARENT` duoc chuyen sang guidance state khi chua lien ket hoc sinh.
- Line `Flow Guide / Mo ta luong` duoc dong bang rerun focused cross-surface tren `dashboard` va `chatbot-settings`; shared component da duoc bo sung render `title` va spec khoa dung `title + summary + steps + layout stability` thay vi chi check `.flow-content` visible.
- Line `vi-VN format` duoc dong bang rerun focused cross-surface tren `wallets` va `chatbot-settings`; oracle tien te/thoi gian van giu exact strings, con mismatch `REFUND` dau tien duoc sua theo business contract da xac minh (`REFUND` la credit), khong phai no expect.
- Line `responsive` duoc dong bang `3` proof same-day: `director dashboard` mobile tu suite browser san co, `chatbot-settings` tablet, va `public landing` narrow desktop tu spec NHOM12 moi. Closure nay giu chuan dai dien `mobile + tablet + desktop hep`, khong doi scope sang `responsive toan he thong`.
- Line `scroll/layout` duoc dong bang `2` proof NHOM12 moi (`teaching-materials load-more`, `ads-analytics wide table`) cong voi same-day `B09 conversations` long-thread proof. Root cause do `teaching-materials` co real layout jump khi dong status row bi co lai o last page; da fix bang product CSS, khong phai no oracle.
- Line `multi-tab` duoc dong bang `2` rerun focused tren app-shell count sync: tab `notifications` mark-read lam giam unread badge, va tab `pending-approvals` approve class update lam giam pending badge. Tab chinh chi duoc refresh count sau khi quay lai foreground qua `visibilitychange`, dung contract hien tai cua `app-shell`.
- Line `accessibility` duoc dong bang `2` rerun focused tren `login` va `internal-handbook`. Login giu exact label binding + tab order + contrast >= 4.5. Internal handbook giu keyboard navigation theo focusable-link order thuc te va contrast >= 4.5 tren text surface chinh cua screen.
- Line `ACCOUNTING classes/students read-only` duoc dong bang same-day proof ket hop: rerun moi tren `/app/classes` cho `ACCOUNTING` read-only + same-day `B03` evidence read-only tren `/app/students`. Product fix mo route `/app/classes` cho `ACCOUNTING` o mode read-only, them nav visibility, readonly note, va khoa chat CTA tao/sua/xoa bang browser oracle exact.
- Sau closure nay, `Nhom 12` khong con line mo trong checklist/backlog authoritative ngay `2026-04-10`.

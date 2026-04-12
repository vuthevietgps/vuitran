# Ke hoach 5 phien tiep theo cho frontend UI

Cap nhat: `2026-04-08`

Nguon doi soat:

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
- Backlog con lai: `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\remaining-cases.vi.md`
- Tong hop moi nhat: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\EXECUTION-RESULTS-ALL.vi.md`

## Muc tieu va gioi han

- Snapshot hien tai: `71 PASS / 183 open`.
- Gioi han moi: chi chay them `5 phien`.
- Muc tieu thuc te cua 5 phien nay khong phai ve `0 open`.
- Muc tieu thuc te:
  - dong nhung cum con nhieu quick win browser-first nhat,
  - dua cac case con lai ve 2 nhom ro:
    - `co the dong tiep bang test`
    - `gap UI/spec/feature, khong nen dot thoi gian test mo`
- Ky vong hop ly sau 5 phien:
  - dong them khoang `45-70` case,
  - con lai khoang `113-138` case mo,
  - nhung case con lai se "sach" hon va de quyet dinh fix/spec hon.

## Nguyen tac thuc thi

1. Moi phien phai co `1 main agent` va `2-3 sub-agent`.
2. Sub-agent chi chay test, triage, map checklist, khong sua file doi soat.
3. Main agent moi duoc:
   - quyet dinh `[ ] -> [x]`
   - sua `testfrontendui.md`
   - sua `qa/reports/frontend-ui/remaining-cases.vi.md`
   - sua evidence tong hop
4. Case nao co side effect phai co `before -> action -> after -> man lien doi`.
5. Case nao lo ra `feature gap` hoac `spec drift` thi dung ngay, khong dau tu ca phien vao no.

## Session 1 - B01 + B03 + Nhom 12 quick wins

Muc tieu:

- Dong not `B01` neu co duong UI that su.
- Dong cac case `B03` co the test nhanh bang browser-first/RBAC.
- Dong cac case `Nhom 12` co the chung minh bang cac man da co hook test.

Ky vong dong them:

- `10-16` case

Checklist uu tien:

- `B01`
  - doi mat khau submit thanh cong
  - doi mat khau validation
  - route khong ton tai -> redirect dung
- `B03`
  - khong cho sua/xoa vuot quyen
  - tu sua tai khoan khong loi quyen
  - multi-parent display/save
  - transfer owner
  - deactivate product / deactivate teacher
  - agent tier create
- `Nhom 12`
  - loading / empty / error
  - disable submit / double click
  - refresh khong vo state
  - read-only theo role
  - deep-link / responsive / upload error

Sub-agent split:

- `Sub-agent S1-A: Auth/App shell`
  - Scope: `B01`
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\auth-dashboard-shell-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\app-shell-handbook-browser-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\rbac-route-guard-ui.spec.ts`
  - Nhiem vu:
    - xac nhan co/khong co man `change-password`
    - neu co thi viet browser-first test
    - neu khong co thi dong nhan `gap feature/spec`
    - test wildcard route `**`
  - Lenh goi y:
    - `npx playwright test e2e/auth-dashboard-shell-ui.spec.ts e2e/app-shell-handbook-browser-ui.spec.ts e2e/rbac-route-guard-ui.spec.ts`

- `Sub-agent S1-B: Common states`
  - Scope: `Nhom 12`
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\release-gate-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\director-dashboard-browser-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\dashboard-pending-approvals-browser-ui.spec.ts`
  - Nhiem vu:
    - loading / empty / error
    - submit disable / double click
    - refresh / deep-link / responsive
    - read-only role tren invoices, sessions, financial-control, investor-dashboard
  - Lenh goi y:
    - `npx playwright test e2e/release-gate-ui.spec.ts e2e/director-dashboard-browser-ui.spec.ts e2e/dashboard-pending-approvals-browser-ui.spec.ts`

- `Sub-agent S1-C: Users/Students/Agents`
  - Scope: `B03`
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\materials-export-students-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\bulk-agents-class-config-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-users-students-finance-29-to-37.spec.ts`
  - Nhiem vu:
    - RBAC user/student/product/agent
    - self-edit
    - multi-parent display
    - agent tier create
  - Lenh goi y:
    - `npx playwright test e2e/materials-export-students-ui.spec.ts e2e/bulk-agents-class-config-ui.spec.ts e2e/specs/scenarios-deep-users-students-finance-29-to-37.spec.ts`

Dieu kien stop som:

- Neu khong tim thay route/component `change-password`, khong tiep tuc doan mo.
- Neu `B03` bi blocker du lieu seed, uu tien case UI RBAC truoc, bo qua flow chuyen owner phuc tap.

## Session 2 - B04 Orders/Leads

Muc tieu:

- Dong nhieu case `B04` nhat co the bang luong browser-first va side-effect proof.

Ky vong dong them:

- `8-12` case

Checklist uu tien:

- lead edit/contact/assign/reassign
- convert lead -> order
- mark lost / return to pool / stale
- chon package/lop/hinh thuc hoc + pricing
- installment / deferred revenue / partial payment
- trial `0d`
- reject / request more info / cancel order
- order side effects:
  - order detail
  - invoices
  - students

Sub-agent split:

- `Sub-agent S2-A: Leads pipeline`
  - Scope:
    - edit lead
    - reassign
    - lost / pool / stale
    - attribution merge neu co UI that su
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\notifications-leads-landing-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-orders-1-1-to-2-4.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/notifications-leads-landing-ui.spec.ts e2e/specs/scenarios-deep-orders-1-1-to-2-4.spec.ts`

- `Sub-agent S2-B: Order pricing`
  - Scope:
    - package/class/mode pricing
    - installment
    - partial payment
    - trial `0d`
    - teacher-paid-only neu co UI
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\orders-flow-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\order-auto-calculation-demo-ui.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/orders-flow-ui.spec.ts e2e/order-auto-calculation-demo-ui.spec.ts`

- `Sub-agent S2-C: Order side effects`
  - Scope:
    - approve/reject/request-more-info/cancel
    - verify invoice/student/order-detail side effects
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\order-approval-linked-views-video.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\order-approval-blocked-no-counter-receipt-video.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-orders-1-1-to-2-4.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/order-approval-linked-views-video.spec.ts e2e/order-approval-blocked-no-counter-receipt-video.spec.ts e2e/specs/scenarios-deep-orders-1-1-to-2-4.spec.ts`

Side effects bat buoc chung minh:

- order detail co status moi
- invoices co record phat sinh hoac thay doi dung
- students duoc provision/lien ket dung
- badge/menu/pipeline cap nhat dung

Dieu kien stop som:

- Attribution merge timeline neu UI hien tai khong co block rieng -> danh dau `gap UI/spec`.
- `teacher-paid-only` neu khong co control/label ro tren UI -> khong ket luan bang API.

## Session 3 - B05 Classes / Sessions / Attendance

Muc tieu:

- Danh vao cum backlog nang nhat co nhieu case P0 va co spec/co component san.

Ky vong dong them:

- `10-15` case

Checklist uu tien:

- edit/delete class
- student config / co-teaching / teacher swap
- pending class update
- session detail / finalize / cancel / reschedule
- substitute teacher restrictions
- attendance present/absent/late / mark all / save only if changed
- copy attendance link
- request change / request history / approve request
- parent attendance / attendance report / calendar overview

Sub-agent split:

- `Sub-agent S3-A: Classes`
  - Scope:
    - edit/delete class
    - student config
    - co-teaching
    - teacher swap
    - pending class update
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\change-requests-capital-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-classes-payroll-msgs-7-24-28.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/change-requests-capital-ui.spec.ts e2e/specs/scenarios-deep-classes-payroll-msgs-7-24-28.spec.ts`

- `Sub-agent S3-B: Sessions`
  - Scope:
    - view detail
    - complete/finalize UX
    - auto-confirm source
    - debt-limit warning
    - cancel/reschedule
    - sale request change / history / approve
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-sessions-2-1-to-3-4.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\session-revenue-first-10.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/specs/scenarios-deep-sessions-2-1-to-3-4.spec.ts e2e/specs/session-revenue-first-10.spec.ts`

- `Sub-agent S3-C: Attendance`
  - Scope:
    - mark individual / mark all / save-if-changed
    - copy link
    - attendance report
    - parent attendance
    - calendar overview
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\attendance-link-only-teacher.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-classes-payroll-msgs-7-24-28.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/specs/attendance-link-only-teacher.spec.ts e2e/specs/scenarios-deep-classes-payroll-msgs-7-24-28.spec.ts`

Side effects bat buoc chung minh:

- classes list + class detail + sessions list
- session detail + history/request history
- attendance list + parent view/report

Dieu kien stop som:

- co-teaching / substitute restrictions neu UI chua co control ro -> danh dau `gap UI`.
- debt-limit warning neu can seed tai chinh qua phuc tap -> chuyen ve cuoi phien.

## Session 4 - B07 + B08 Finance heavy

Muc tieu:

- Dong phan `finance core` va `finance advanced` co value release cao nhat.

Ky vong dong them:

- `9-14` case

Checklist uu tien:

- invoices create/edit/reject/delete/filter
- top-up reject / transfer / parent top-up / ledger
- teacher payroll / staff payroll / bulk payroll / held / exclude
- expenses / supplier / loans / financial alerts / PnL basis
- bank reconciliation / matched-unmatched / reject reconciliation

Sub-agent split:

- `Sub-agent S4-A: Invoices + Wallets`
  - Scope:
    - invoice create/edit/reject/delete/filter
    - top-up reject / transfer / parent top-up / ledger / adjust wallet
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\b07-invoices-wallets-payroll-video.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\wallets-refunds-flow-ui.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/b07-invoices-wallets-payroll-video.spec.ts e2e/wallets-refunds-flow-ui.spec.ts`

- `Sub-agent S4-B: Payroll`
  - Scope:
    - teacher payroll lifecycle
    - staff payroll lifecycle
    - held/exclude reasons
    - bulk generate / partial success
    - work sessions late/early/auto-closed
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\change-requests-capital-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\crisis-opex-flow-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\bulk-agents-class-config-ui.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/change-requests-capital-ui.spec.ts e2e/crisis-opex-flow-ui.spec.ts e2e/bulk-agents-class-config-ui.spec.ts`

- `Sub-agent S4-C: Finance advanced`
  - Scope:
    - expenses / supplier / loans
    - financial control alerts / PnL basis
    - bank reconciliation
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\expenses-rbac-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\crisis-opex-flow-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-finance-4-1-to-6-2.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-deep-reject-reschedule-payroll-loans-12.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/expenses-rbac-ui.spec.ts e2e/crisis-opex-flow-ui.spec.ts e2e/specs/scenarios-deep-finance-4-1-to-6-2.spec.ts e2e/specs/scenarios-deep-reject-reschedule-payroll-loans-12.spec.ts`

Dieu kien stop som:

- `supplier quote create -> 400` neu van tai hien thi tach thanh bug card, khong nuot ca phien.
- rollback/huy invoice da duyet neu dong vao workflow backend nhay cam thi chi test read-only warning, khong co gang cover het trong 1 phien.

## Session 5 - B06 + B09 + B10 + B11 + Nhom 12 con lai

Muc tieu:

- Chot nhung cum UI thuan frontend va report/public flow con nhieu quick win.

Ky vong dong them:

- `8-13` case

Checklist uu tien:

- `B06`
  - teacher profile edit
  - KPI + penalty
  - teaching report dynamic fields
  - parent feedback / student progress
  - materials drag-drop / load more / empty state
- `B09`
  - click notification -> mark read + redirect
  - internal messages basic
  - chatbot conversation basic
  - tickets tabs / deep-link
  - token expired banner / auto-reply UI
- `B10`
  - ads management tabs / sync / backfill / loading toast
  - public landing invalid slug / submit error / clipboard fallback / pixel cleanup
- `B11`
  - student report / comprehensive report / employee performance
  - UTF-8 BOM / long export progress / masked export
- `Nhom 12`
  - polling/realtime duplicate
  - vi-VN format
  - multi-tab
  - accessibility co ban

Sub-agent split:

- `Sub-agent S5-A: Teacher/Parent/Materials`
  - Scope:
    - `B06`
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\materials-export-students-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\b06-b11-followup-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-18-1-to-23-3.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/materials-export-students-ui.spec.ts e2e/specs/b06-b11-followup-ui.spec.ts e2e/specs/scenarios-18-1-to-23-3.spec.ts`

- `Sub-agent S5-B: Notifications/Chatbot/Tickets`
  - Scope:
    - `B09`
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\webhooks-chatbot-tickets-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\notifications-leads-landing-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-batch-15-cron-chatbot.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/webhooks-chatbot-tickets-ui.spec.ts e2e/notifications-leads-landing-ui.spec.ts e2e/specs/scenarios-batch-15-cron-chatbot.spec.ts`

- `Sub-agent S5-C: Ads/Public/Reports/Common tail`
  - Scope:
    - `B10`
    - `B11`
    - `Nhom 12` con lai
  - Dung lai:
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\landing-messages-products-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\scenarios-batch-16-ads-platforms.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\specs\b06-b11-followup-ui.spec.ts`
    - `C:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\e2e\release-gate-ui.spec.ts`
  - Lenh goi y:
    - `npx playwright test e2e/landing-messages-products-ui.spec.ts e2e/specs/scenarios-batch-16-ads-platforms.spec.ts e2e/specs/b06-b11-followup-ui.spec.ts e2e/release-gate-ui.spec.ts`

Dieu kien stop som:

- realtime websocket, multi-tab, accessibility la nhom `manual/hybrid` neu automation loi ich thap.
- long export `50k+` neu can data volume nhieu thi chi xep `manual/hybrid`, khong dot phien cuoi vao seed lon.

## Thu tu sync sau moi phien

1. Main agent tong hop tu 3 sub-agent:
   - commands
   - results
   - case co the dong ngay
   - case test roi nhung chua du bang chung
   - blocked/flaky/gap UI
2. Main agent quyet dinh item nao du dieu kien tick.
3. Main agent sync:
   - `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
   - `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\remaining-cases.vi.md`
   - `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\EXECUTION-RESULTS-ALL.vi.md`
   - log rieng cho phien do

## Cac rui ro da biet can tranh dot thoi gian

- `B01` change-password co kha nang la feature gap, khong phai chi thieu test.
- `B04` attribution merge timeline va `teacher-paid-only` co kha nang la gap UI/spec.
- `B05` co-teaching, debt-limit warning, auto-confirm source co kha nang can hook UI moi.
- `B07/B08` supplier quote `400` va concurrency approve de gay mat thoi gian neu khong tach rieng.
- `B09` realtime websocket, token-expired banner, ticket deep-link can hybrid/mock, khong nen ky vong dong het trong 1 phien.
- `B11` export BOM / 50k rows / masked shareholder export co mot phan la file-level verification, khong thuoc browser-only hoan toan.
- `Nhom 12` multi-tab va accessibility chi nen lam o cuoi, neu con suc.

## Ket luan

- 5 phien nua la du de day coverage frontend UI them mot doan lon, nhung khong du de "xong het" `183 open`.
- Cach chia o tren uu tien:
  - dong nhieu case co the tick that su,
  - boc tach som cac feature gap/spec gap,
  - tranh sa lay vao nhung line wording dep nhung UI hien tai chua ton tai.





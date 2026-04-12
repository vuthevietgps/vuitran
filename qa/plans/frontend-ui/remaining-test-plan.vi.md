# Ke Hoach Test Frontend UI Cho Backlog Con Lai

## Nguon Su That

- Danh sach con lai: `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\remaining-cases.vi.md`
- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
- Coverage moi nhat: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\EXECUTION-RESULTS-ALL.vi.md`
- Regression bo sung: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_Deep_Regression_20260408.md`

## Muc Tieu

- Dong het `211` case con lai hoac chuyen sang `BLOCKED` co bang chung ro rang.
- Tach ro case da `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.
- Chi sync nguoc vao `testfrontendui.md` khi moi case da co mapping `case -> artifact/log -> ket qua`.
- Moi batch moi deu phai co video `MP4`, log ket qua va bang doi soat side effect sau submit.
- Song song, theo huong `showcase-ready`, duoc phep tach rieng danh gia "du demo voi nha dau tu" khoi backlog coverage nghiem ngat.

## Snapshot Hien Tai

- `B01`: `10` case con lai
- `B02`: `13` case con lai
- `B03`: `10` case con lai
- `B04`: `17` case con lai
- `B05`: `26` case con lai
- `B06`: `14` case con lai
- `B07`: `28` case con lai
- `B08`: `15` case con lai
- `B09`: `30` case con lai
- `B10`: `14` case con lai
- `B11`: `7` case con lai
- `Nhom 12`: `27` case con lai

## Ghi Chu Showcase Ready

- `211` case mo la backlog coverage nghiem ngat, khong dong nghia `211` blocker cho showcase.
- Trang thai showcase-ready hien tai: `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\showcase-ready.vi.md`
- Log showcase-ready: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_SHOWCASE_READY_20260408.vi.md`

## Nguyen Tac Bat Buoc

- Khong dung video showcase tong quan de tick `PASS` neu wording checklist chi tiet hon evidence.
- Moi case co `submit`, `approve`, `reject`, `convert`, `cancel`, `mark paid`, `sync`, `reconcile`, `top-up`, `transfer`, `upload`, `create`, `edit`, `delete` deu phai quay du:
  1. Trang thai before.
  2. Form hoac modal dang submit.
  3. Ket qua tren man nguon.
  4. It nhat `1` man lien doi sau submit.
  5. Rieng flow tai chinh hoac duyet phai mo toi thieu `2` man lien doi.
- Case RBAC chi duoc tick `PASS` khi video thay truc tiep role dung va role sai.
- Case co badge, pending count, queue, realtime, unread count phai thay ro `before -> action -> after`.
- Case upload hoac export phai thay file xuat hien o man dich hoac download event thanh cong.

## Blocker Can Xu Ly Truoc

### Blocker 1. Attendance Link Expiry

- Nguon: `LOG_Deep_Regression_20260408.md`
- Anh huong:
  - `B05` finalize/session revenue
  - `B06` cac flow day thay hoac parent pages phu thuoc attendance linked state
  - `B11` cac report sau attendance public
- Hanh dong:
  1. Rerun ngan gon luong `public attendance -> session state`.
  2. Neu van fail, tach cac case lien quan thanh `BLOCKED`.
  3. Neu da fix, quay lai full batch `B05/B06/B11`.

### Blocker 2. Chatbot Settings Create Moi

- Nguon: `EXECUTION-RESULTS-ALL.vi.md`
- Loi hien tai: backend bao `property status should not exist`
- Anh huong:
  - Nhanh tao moi OpenAI token
  - Nhanh tao moi AI profile
- Hanh dong:
  1. Tach ro case `create moi` va case `edit/save/reload/RBAC`.
  2. Chi tick `PASS` cho edit/reload neu da co seed data.
  3. Neu create moi van loi, danh dau `BLOCKED` co screenshot/video va response message.

## Thu Tu Test De Dong Backlog Nhanh Nhat

### Dot 0. Dong Bo Coverage va Go Blocker

- Muc tieu:
  - Xac nhan file `qa/reports/frontend-ui/remaining-cases.vi.md` la backlog chinh thuc.
  - Recheck `attendance link expiry`.
  - Recheck loi `chatbot-settings` create moi.
- Dau ra bat buoc:
  - `1` log doi soat `22` case da loai khoi backlog
  - ket luan `PASS` hoac `BLOCKED` cho 2 blocker
- Dieu kien qua cong:
  - khong con mo ho ve danh sach con lai
  - da chot ro batch nao duoc chay tiep ngay, batch nao phai tam dung

### Ket Qua Dot 0 - 2026-04-08

- Da sync nguoc `22` case `PASS` vao `testfrontendui.md`; checklist goc con `232` case mo.
- Da tao log doi soat: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_DOT0_EXECUTION_20260408.vi.md`.
- Blocker `attendance link expiry`:
  - `PASS` lai bang `node scripts/test-attendance-workflow.js` (`24 PASS`, `0 FAIL`, `0 SKIP`).
  - Rerun Playwright `session-revenue-first-10.spec.ts` cho thay loi khong con dung o `/public/attendance/submit`; sau khi chinh host va test data, batch nay hien dang vach ra blocker automation tiep theo o buoc teaching report form.
- Blocker `chatbot-settings` create moi:
  - `PASS` lai bang `node scripts/test-chatbot-settings-workflow.js` (`12 PASS`, `0 FAIL`).
  - `PASS` lai o lop frontend e2e bang `npx playwright test -c playwright.config.ts e2e/webhooks-chatbot-tickets-ui.spec.ts -g "18.3|18.5"` (`8 PASS`) sau khi sync spec voi contract API hien tai.
- Batch co the chay tiep ngay:
  - `B05`, `B06`, `B11` ve nghiep vu khong con bi chan boi attendance expiry.
  - `B09` ve create moi token/profile khong con bi chan boi loi `property status should not exist`.
- Batch can tam dung neu tiep tuc dung bo Playwright cu:
  - `session-revenue-first-10.spec.ts` cho toi khi cap nhat selector/flow teaching report phu hop UI hien tai.


### Dot 1. Dong Het P0 Nghiep Vu Doanh Thu va Day Hoc

- Batch:
  - `B04`
  - `B05`
  - `B07`
- Thu tu uu tien:
  1. `B04` order side effects
  2. `B05` classes/sessions/attendance
  3. `B07` invoices/wallets/payroll
- Ly do:
  - Day la cum anh huong truc tiep den revenue recognition, session lifecycle, wallet va payroll.
  - `B04` va `B07` co nhieu side effect lien module.
  - `B05` la cum rui ro van hanh lon nhat.
- Case phai dong truoc:
  - `B04`: pricing, installment, partial payment, reject/request more info/cancel, invoice/student side effects
  - `B05`: class CRUD, teacher swap, pending class update, create/finalize/cancel/reschedule session, bulk attendance, request history
  - `B07`: invoice reject/delete/filter, top-up reject, transfer wallet, payroll HELD/exclude/bulk payroll, salary config, work sessions
- Dieu kien qua cong:
  - khong con case `P0` mo o `B04`, `B05`, `B07` ngoai `BLOCKED`
  - moi case state-changing deu co doi soat sau submit

### Ket Qua Trien Khai Them - B05/B06/B11 - 2026-04-08

- `session-revenue-first-10.spec.ts`: da duoc sua lai automation va rerun thanh cong `2 PASS`, `2 SKIP`.
- `B05`:
  - `test-class-attendance-pricing-workflow.js`: `11 PASS`
  - `test-sessions-workflow.js`: `12 PASS`
  - `attendance-link-only-teacher.spec.ts`: `1 PASS`
  - `scenarios-deep-sessions-2-1-to-3-4.spec.ts`: `12 PASS`
- `B06`:
  - `test-teacher-profiles-workflow.js`: `5 PASS`
  - `test-teaching-report-workflow.js`: `16 PASS`
  - `test-teaching-materials-workflow.js`: `8 PASS`
  - `test-teacher-kpi-workflow.js`: `8 PASS`
- `B11`:
  - `test-attendance-report-workflow.js`: `3 PASS`
  - `test-student-report-workflow.js`: `5 PASS`
  - `test-comprehensive-report-workflow.js`: `5 PASS`
  - `test-export-reports-workflow.js`: `6 PASS`
  - `test-employee-performance-workflow.js`: `3 PASS`
  - `test-audit-log-workflow.js`: `4 PASS`
- False fail da sua trong luc chay:
  - `session-revenue-first-10.spec.ts`: selector teaching report, host `localhost`, test data `scheduledDate`, expectation workflow parent confirm / debt limit.
  - `test-attendance-report-workflow.js`: chon dung lop co student.
  - `test-student-report-workflow.js`, `test-comprehensive-report-workflow.js`: dung role co quyen de mark attendance.
- Log ket qua chi tiet: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_B05_B06_B11_EXECUTION_20260408.vi.md`

### Ket Qua Tiep Theo - Sync Checklist va Calendar - 2026-04-08

- Da sync them `17` case `PASS` vao `testfrontendui.md`; checklist goc con `215` case mo.
- Da loai tiep `17` case khoi `qa/reports/frontend-ui/remaining-cases.vi.md`:
  - `B05`: `8` case
  - `B06`: `7` case
  - `B11`: `2` case
- Da pass them UI thuc te cho:
  - `teacher-calendar`: chuyen thang va mo chi tiet buoi hoc trong ngay
  - `parent-calendar`: chuyen thang va mo chi tiet buoi hoc trong ngay
- Thu them `e2e/materials-export-students-ui.spec.ts` de mo rong coverage `B06/B11`:
  - `31 PASS`, `14 FAIL`
  - Cum fail nay hien chu yeu la spec cu lech contract hien tai, chua du can cu de ket luan loi san pham:
    - upload materials dung header CSRF cu
    - mot so assertion RBAC/export khong con khop backend hien tai
    - mot so flow student CRUD ky vong `201` nhung request hien bi `400`
- Log ket qua tiep theo tiep tuc duoc ghi chung vao:
  - `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_B05_B06_B11_EXECUTION_20260408.vi.md`

### Ket Qua Follow-Up UI - Parent Invoices, Teaching Report, Audit - 2026-04-08

- Da chay spec moi:
  - `npx playwright test e2e/specs/b06-b11-followup-ui.spec.ts`
- Ket qua:
  - `3 PASS`
  - `0 FAIL`
- Da sync them `4` case `PASS` vao checklist:
  - `B06`: `Parent invoices chi hien thi invoice dung pham vi`
  - `B11`: `Teaching report pending/completed, filter thang, teacher code lookup, submit/edit dung`
  - `B11`: `Audit log filter, pagination, thong ke hien thi dung`
  - `B11`: `Audit log chi doc, khong co hanh vi sua du lieu`
- Sau dong bo:
  - checklist goc con `211` case mo
  - backlog sach con `211` case mo
  - `B06`: con `14` case
  - `B11`: con `7` case
- Ghi chu:
  - Chua sync case `Teaching Report ho tro inline update ... tren o bang ...` du spec da xac nhan teacher sua report o completed card va role `PARENT` / `SALE` bi chan truy cap.
  - Ly do: wording checklist hien tai mo ta chat hon evidence UI thuc te; man hien tai dung card mo rong thay vi bang inline theo o.


### Dot 2. Dong Het P0 Nen Tang va Cross-Module

- Batch:
  - `B01`
  - `B02`
  - `B03`
  - `B08`
  - `B09`
  - `B10`
- Thu tu uu tien:
  1. `B01` va `B02` de khoa auth/RBAC/menu/badge/loading/error
  2. `B03` de khoa owner transfer, multi-parent, deactivate product/teacher
  3. `B08` de khoa financial control va reconciliation
  4. `B09` de khoa notifications/chatbot/tickets
  5. `B10` de khoa ads/public submit flow
- Case phai dong truoc:
  - `B01`: rate-limit, restore session, doi mat khau, `401` forced logout, menu va badge theo role
  - `B02`: skeleton/error, overdue tickets, critical anomalies, pending approval realtime, quick links, gallery
  - `B03`: multiple parents, owner transfer, deactivate product exclusion, deactivate teacher, onboarding teacher
  - `B08`: expense/supplier/loan lifecycle, alert severity, `CASH/ACCRUAL`, reject reconciliation, matched/unmatched
  - `B09`: click notification, bulk notification, chatbot conversation realtime, masked token, parent chat, refund warning
  - `B10`: ads CRUD, sync/backfill, copy URL fallback, public error state, UTM, pixel cleanup
- Dieu kien qua cong:
  - khong con case `P0` mo o `B01`, `B02`, `B03`, `B08`, `B09`, `B10` ngoai `BLOCKED`

### Dot 3. Dong P1 Co Phu Thuoc Cheo

- Batch:
  - `B06`
  - `B11`
  - phan `P1` con lai cua `B04`, `B05`, `B07`, `B09`, `B10`
- Trong tam:
  - teaching report field dong
  - teacher KPI, penalty, parent feedback
  - materials upload/drag-drop/download/reprocess
  - attendance/student/comprehensive report filter
  - export UTF-8 BOM, streaming export, masked export cho `SHAREHOLDER`
  - audit log readonly
- Dieu kien qua cong:
  - khong con case `P1` mo ngoai `BLOCKED`

### Dot 4. Chot Nhom 12 va P2

- Pham vi:
  - `Nhom 12`
  - `P2` multi-tab va accessibility co ban
- Cach chay:
  - gan vao chinh batch sinh ra tinh huong neu co the
  - tach clip ngan rieng neu can cho:
    - multi-tab state drift
    - keyboard/focus
    - responsive
    - duplicate item do polling/realtime
- Dieu kien qua cong:
  - moi dong `Nhom 12` da map vao it nhat `1` video co moc time
  - `P2` co bang chung ro rang hoac `BLOCKED`

## Phan Cong Goi Y

- Tester 1:
  - `B04`
  - `B05`
- Tester 2:
  - `B07`
  - `B08`
- Tester 3:
  - `B09`
  - `B10`
- Tester 4:
  - `B01`
  - `B02`
  - `B03`
- Tester 5:
  - `B06`
  - `B11`
  - `Nhom 12`

## Mau Dau Ra Moi Batch

- `1` video `MP4` hoac nhieu phan neu batch dai
- `1` file log ket qua
- `1` bang doi soat `case -> video -> moc time -> ket qua`
- neu co `FAIL` hoac `BLOCKED`, bat buoc ghi:
  - dieu kien gay loi
  - ket qua thuc te
  - ky vong dung
  - response/toast/route lien quan

## Dieu Kien Ket Thuc Toan Dot

- File `qa/reports/frontend-ui/remaining-cases.vi.md` khong con dong `[ ]` nao ngoai cac case da doi sang `BLOCKED`.
- Moi case `PASS` deu co moc video hoac artifact ro rang.
- `testfrontendui.md` chi duoc sync nguoc sau khi da chot xong mapping.





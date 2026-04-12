# Ke hoach test phan con lai frontend UI

Cap nhat sau khi review:

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
- Evidence hien co: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-07` va `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08`
- Tong hop thuc thi moi nhat: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\EXECUTION-RESULTS-ALL.vi.md`

## 1. Trang thai backlog thuc te

Theo `testfrontendui.md`, hien van con `254` dong `[ ]`:

- `P0`: `149`
- `P1`: `103`
- `P2`: `2`

Theo execution pack ngay `2026-04-08`, trong `254` case mo da co them `22` case co evidence `PASS`, `232` case van `NOT RUN`.

Luu y quan trong:

- `testfrontendui.md` chua sync nguoc day du cac case `PASS` moi nhat tu dot quay `2026-04-08`.
- Vi log batch hien tai van la mau checklist rong, nguon su that de dieu hanh dot test tiep theo phai la:
  - `EXECUTION-RESULTS-ALL.vi.md`
  - `LOG_Deep_Regression_20260408.md`
  - cac file video `MP4` trong `frontend-ui-evidence/2026-04-08/videos`
- Khong doi `[ ]` thanh `[x]` trong checklist goc cho den khi map duoc ro tung case voi moc video.

## 2. Nhom con nhieu gap nhat

Thong ke tu `testfrontendui.md`:

- `B09` Notifications, Chatbot, Tickets: `35` case mo
- `B05` Classes, Sessions, Attendance: `34` case mo
- `B07` Invoices, Wallets, Payroll: `32` case mo
- `Nhom 12` trang thai chung: `27` case mo
- `B06` Teacher Hub, Parent Pages, Teaching Materials: `25` case mo
- `B04` Leads, Orders, Trials: `18` case mo
- `B02` Dashboard, Handbook, Pending Approvals: `16` case mo
- `B10` Ads, Landing Pages, Public Flows: `16` case mo
- `B08` Finance nang cao, Financial Control, Reconciliation: `15` case mo
- `B11` Reports, Export, Audit: `13` case mo
- `B01` Auth, App Shell, Routing: `12` case mo
- `B03` Users, Students, Products, Agents: `11` case mo

## 3. Review lai cac tinh huong chua test

### 3.1. Cac cum P0 can dong truoc release

1. Session, attendance, finalize, class change request
   - Tap trung o `B05`
   - Con thieu nhieu case tao/sua/xoa lop, teacher swap, pending class update, create session, finalize, cancel, reschedule, attendance bulk, request history
   - Day la cum rui ro nghiep vu cao vi anh huong day hoc, doanh thu, teaching report, parent confirmation

2. Invoice, wallet, payroll va side effect tai chinh
   - Tap trung o `B07`
   - Con thieu approve/reject/delete invoice, top-up approve/reject, wallet transfer, payroll full lifecycle, held reason, exclude payroll, bulk payroll, rollback canh bao
   - Day la cum rui ro release cao nhat sau `B05` vi lien quan tien va state machine

3. Finance nang cao va reconciliation
   - Tap trung o `B08`
   - Hien gan nhu chua chot duoc case nao du wording video chua du sat checklist
   - Con thieu expenses, supplier quotes/payments, loans, financial alerts, PnL cash/accrual, reconcile/reject reconciliation, matched/unmatched

4. Notifications, chatbot, ticket handoff va refund warning
   - Tap trung o `B09`
   - Con thieu notifications unread flow, chatbot conversations, realtime websocket, chatbot-settings, parent support chat, ticket lifecycle, refund request warning
   - Day la cum co nhieu case nhat va nhieu diem giao nhau voi lead/order/ticket/finance

5. Order side effects sau approve/reject/cancel
   - Tap trung o `B04`
   - Phan form tao order da co cover mot phan, nhung van thieu pricing/class/package, installment, deferred revenue, partial payment, approve/reject/request more info/cancel va side effect invoice/student

6. Nen tang auth, dashboard, RBAC, common states
   - Tap trung o `B01`, `B02`, `B03`, `Nhom 12`
   - Day la nhom de lot ra bug "UI co action sai role", "loading/disable khong dung", "empty/error state vo nghia", "badge/count/menu sai sau reload"

### 3.2. Cac cum P1 nen dong sau khi P0 on dinh

1. Teacher/parent/materials
   - `B06` con `25` case, gan nhu chua duoc chot
   - Nen uu tien teaching report field dong, bankInfo, substitute request, feedback low-rating, materials upload/drag-drop/download/reprocess

2. Reports/export/audit
   - `B11` con `13` case
   - Can chot filter, pagination, export UTF-8 BOM, large streaming export, masking cho `SHAREHOLDER`, audit log readonly

3. Ads/public flows
   - `B10` con `16` case
   - Can chot sync/backfill, clipboard fallback, pixel injection, custom head/body cleanup, public error/success state

### 3.3. Blocker va luu y da lo ra tu evidence

1. Blocker that su o flow attendance public
   - `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_Deep_Regression_20260408.md` ghi nhan `attendance link` vua tao da bi backend danh gia het han som
   - Bug nay dang chan cac flow dai phu thuoc `public attendance -> session finalize`
   - Truoc khi quay tiep batch dai cua `B05/B06/B11`, can xac minh lai seed data va co the can fix backend

2. Chatbot settings co van de validate backend
   - `EXECUTION-RESULTS-ALL.vi.md` ghi ro `B09A` gap loi create token/profile bang UI voi thong bao backend `property status should not exist`
   - Ke hoach test `B09` phai tach:
     - phan create moi: de `BLOCKED` neu loi van con
     - phan edit/save/reload/RBAC: van test duoc tren du lieu seed san

3. B05 va B08 da co video nhung chua du de check PASS an toan
   - `EXECUTION-RESULTS-ALL.vi.md` ghi ro wording checklist hien chi tiet hon artifact
   - Nghia la can quay manual sat tung checkbox, khong the dua vao video showcase tong quan

## 4. Thu tu test de dong backlog nhanh nhat

### Dot 0. Dong bo coverage va go blocker

Muc tieu:

- Map lai `22` case `PASS` trong execution pack vao checklist goc hoac log batch chi tiet
- Xac nhan bug `attendance link expiry`
- Xac nhan trang thai backend cua loi `property status should not exist` o `chatbot-settings`

Cong viec:

1. Review cac video/bao cao da co va lap bang doi soat `case -> video -> moc time`
2. Chot case nao da du bang chung thi danh dau `PASS` trong log batch truoc, sau do moi sync vao `testfrontendui.md`
3. Mo lai regression `attendance public` ngan gon truoc khi tiep tuc `B05/B06/B11`

Dieu kien qua cong:

- Co bang map cho `22` case `PASS`
- Co ket luan ro: `attendance public` dang `PASS` hay `BLOCKED`
- Co ket luan ro: `chatbot-settings create token/profile` dang `PASS` hay `BLOCKED`

### Dot 1. Dong het P0 nghiep vu doanh thu va day hoc

Batch:

- `B04`
- `B05`
- `B07`

Thu tu:

1. `B04` order side effects
2. `B05` classes/sessions/attendance
3. `B07` invoices/wallets/payroll

Ly do:

- Ba batch nay lien quan truc tiep den revenue recognition, session lifecycle, wallet/payroll
- `B04` va `B07` can mo it nhat `2` man doi soat sau submit
- `B05` dang la cum P0 lon nhat trong nghiep vu van hanh

Case can chot truoc trong Dot 1:

- `B04`: pricing, installment, partial payment, approve/reject, request more info, cancel, invoice/student side effects
- `B05`: create/edit/delete class, teacher swap, approve/reject class update, create session, finalize, cancel, reschedule, bulk attendance, change request lifecycle
- `B07`: approve/reject/delete invoice, top-up approve/reject, transfer wallet, payroll state machine, held reason, exclude payroll, bulk payroll

Dieu kien qua cong:

- Khong con case `P0` mo o `B04`, `B05`, `B07` ngoai truong hop `BLOCKED` co bang chung
- Moi case state-changing deu co video mo lai man nguon va man lien doi

### Dot 2. Dong het P0 nen tang, finance control va cross-module messaging

Batch:

- `B01`
- `B02`
- `B03`
- `B08`
- `B09`
- `B10`

Thu tu:

1. `B01` va `B02` de khoa auth/RBAC/menu/badge/loading/error state
2. `B03` de khoa owner transfer, multiple parents, deactivate product/teacher
3. `B08` de khoa financial alerts, PnL toggle, reconciliation
4. `B09` de khoa notifications/chatbot/tickets
5. `B10` de khoa ads/public flows

Case can chot truoc trong Dot 2:

- `B01`: login rate-limit, show/hide password, restore session, change password, forced logout `401`, menu role, badge/count, loading bar
- `B02`: dashboard skeleton/error state, overdue tickets, critical anomalies, pending approval count, handbook theo role, quick links, widget dung role
- `B03`: multiple parents, owner transfer, deactivate product exclusion trong order form, deactivate teacher, face upload loi, agent tier
- `B08`: expense/supplier/loan lifecycle, financial alerts severity, cash/accrual toggle, reconcile/reject reconciliation, matched/unmatched
- `B09`: unread count, mark read, bulk notification, conversation takeover/release, websocket realtime, create lead/order from chatbot, token masking, refund warning
- `B10`: ads CRUD, sync/backfill, public landing page submit success/error, UTM payload, clipboard fail fallback, pixel cleanup

Dieu kien qua cong:

- Khong con case `P0` mo o `B01`, `B02`, `B03`, `B08`, `B09`, `B10` ngoai `BLOCKED`
- Cac case RBAC co bang chung so role truc tiep, khong ket luan bang suy doan

### Dot 3. Dong P1 co phu thuoc cheo

Batch:

- `B06`
- `B11`
- phan `P1` con lai cua `B04`, `B05`, `B07`, `B09`, `B10`

Tap trung:

- Dynamic teaching report fields
- Bank info, KPI, penalty, low-rating, general feedback
- Teaching materials upload/drag-drop/download/reprocess/load more
- Attendance report pagination va image preview
- Comprehensive report filters
- Export UTF-8 BOM, large export progress, masked export cho `SHAREHOLDER`
- Audit log readonly, employee performance RBAC

Dieu kien qua cong:

- Khong con case `P1` mo o cac batch da chay, ngoai `BLOCKED`

### Dot 4. Chot Nhom 12 va P2

Pham vi:

- `Nhom 12` phai duoc danh dau tren chinh cac batch da sinh ra tinh huong
- `P2`: multi-tab va accessibility co ban

Cach chay:

- Manual la chinh
- Quay clip ngan rieng neu can cho:
  - multi-tab state drift
  - keyboard/focus
  - responsive
  - duplicate item do realtime/polling

Dieu kien qua cong:

- Moi dong `Nhom 12` duoc quy ve it nhat `1` batch da co video
- `P2` co bang chung ro rang hoac `BLOCKED` co ly do

## 5. Giao batch cho tester

De tranh mot video qua dai va de de rerun:

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

Neu chi co 2 nguoi:

- Nguoi 1: `B04`, `B05`, `B07`, `B08`
- Nguoi 2: `B01`, `B02`, `B03`, `B06`, `B09`, `B10`, `B11`, `Nhom 12`

## 6. Chuan bi du lieu truoc khi quay

Bat buoc phai co:

- `1` order installment
- `1` order partial payment
- `1` order cho duyet, `1` order bi reject, `1` order bi request more info
- `1` class offline co `co-teaching`
- `1` session `SCHEDULED`, `1` session co change request, `1` session auto-confirm
- `1` parent wallet balance thap, `1` wallet co ledger hoan tien
- `1` payroll `HELD`, `1` payroll `PAID`, `1` teacher bi penalty, `1` offline payroll co `Min Payout Guarantee`
- `1` reconciliation co ca `Matched` va `Unmatched`
- `1` chatbot conversation dang `HUMAN_HANDLING`
- `1` ticket `REFUND_REQUEST`
- `1` export lon `50,000+` dong neu muon chot case streaming export

## 7. Quy tac chot PASS/FAIL/BLOCKED

- `PASS`:
  - co video
  - thay du before/action/after
  - thay ro man doi soat lien quan
- `FAIL`:
  - UI sai, route sai, status sai, RBAC sai, count sai, data stale, duplicate
- `BLOCKED`:
  - bi loi that tu backend hoac thieu du lieu seed ma tester khong tu giai quyet duoc
  - phai ghi ro endpoint/loi/man hinh/moc video
- `NOT RUN`:
  - chua bat dau hoac video/du lieu chua du de ket luan

## 8. Muc tieu ket thuc

Dat trang thai "co the dung lam release regression" khi:

1. Tat ca `P0` da duoc chot `PASS` hoac `BLOCKED` co ly do ro
2. `Nhom 12` da duoc gan vao cac batch chinh, khong con treo doc lap
3. `attendance public` va `chatbot-settings create token/profile` da co ket luan ro
4. `testfrontendui.md`, log batch, va thu muc evidence khop nhau ve trang thai


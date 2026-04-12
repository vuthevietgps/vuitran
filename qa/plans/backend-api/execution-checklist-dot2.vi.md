# Checklist thuc thi backend API - Dot 2

Cap nhat: `2026-04-09`

Giai doan dot tiep theo chay theo thu tu:

- `BA02`
- `BA03`

Nguon doi soat:

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\backend-api\test.md`
- Rulebook tong: `C:\Users\PC\Documents\code\vuitran\qa\plans\backend-api\master-test-plan.vi.md`
- SOP mapping: `C:\Users\PC\Documents\code\vuitran\qa\playbooks\backend-api-sop-mapping.vi.md`
- Runbook batch:
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA02-Opex-Wallets-Refunds-Offline.vi.md`
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA03-Change-Reconciliation-Capital-Concurrency.vi.md`

## 1. Muc tieu va nguyen tac

- Muc tieu cua dot nay: chay `BA02 -> BA03` thanh 1 lan chay co the lay `go/no-go` ro rang.
- `BA02` la gate cho `BA03` vi `BA03` co nhieu case lien quan den concurrency, capital, reconciliation va RBAC.
- Moi case write phai co:
  - `before -> action -> after`
  - it nhat 2 layer side effect cho luong tai chinh/duyet/reconciliation
- Moi case RBAC/guard phai co:
  - `positive role`
  - `negative role`
  - `forbidden/blocked` khi co endpoint
- Log ky thuat o:
  - `C:\Users\PC\Documents\code\vuitran\runtime-logs\backend-api\<YYYY-MM-DD>\`
- Summary dot o:
  - `C:\Users\PC\Documents\code\vuitran\qa\reports\backend-api\`

## 2. Session 0 - Preflight cho dot 2

### Muc tieu

- Kich hoat moi truong da du dieu kien cho `BA02` va `BA03`.
- Dam bao khong co seed drift moi tao false positive.

### Checklist preflight

- [ ] `npm ci` trong `school-mgmt/backend`
- [ ] Xac nhan `.env` da dung va ket noi DB duoc
- [ ] Chay:
  - `node scripts/seed-all.js`
  - `node scripts/ensure-commercial-admin.js`
- [ ] Xac nhan vai tro ton tai:
  - `DIRECTOR`
  - `ACCOUNTING`
  - `OPS`
  - `SALE`
  - `PARENT`
  - `TEACHER`
  - `SHAREHOLDER`
- [ ] Chuan bi du lieu cho `BA02`:
  - it nhat 1 expense da duoc duyet
  - 1 top-up pending
  - 1 invoice da duoc approve de test rollback/refund
  - 1 offline class co attendance payroll data
- [ ] Chuan bi du lieu cho `BA03`:
  - 1 change request pending update
  - du lieu bank/fund/reconciliation co the theo doi
  - 1 admin/accounting co quyen tao/duyet/cap nhat state
- [ ] Tao thu muc log dot:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/`
- [ ] Chay smoke toi thieu:
  - `npx jest --config test/jest-e2e.json test/group4-opex-marketing.e2e-spec.ts --runInBand`
  - `npx jest --config test/jest-e2e.json test/security-rbac.e2e-spec.ts --runInBand`

### Dieu kien vao BA02

- Backend chay on dinh, seed thanh cong.
- Nhom tai khoan test dang nhap duoc.
- Smoke E2E co the chay ma khong bi loi infra hoac data drift tong the.

## 3. Batch A - BA02 OPEX, Wallets, Refunds, Offline Economics

### Pham vi

- `Nhom 4`
- `Nhom 5`
- `Nhom 6`
- `Nhom 7`

### Muc tieu

- Kiem soat chi phi va van hanh marketing.
- Kiem soat dieu chinh wallet, top-up, transfer, rollback.
- Kiem soat refund va impact nguon fund.
- Kiem soat offline economics: attendance, giao vien, payroll.

### Checklist uu tien

- Expense approve/reject workflow
- Wallet top-up, transfer, adjustment
- Invoice rollback/refund end-to-end
- Offline class attendance payroll exclusion/guarantee/penalty interaction
- Cron/auto workflow co anh huong balance, ledger, financial control

### Lenh uu tien de chay

- BA02 E2E:
  - `npx jest --config test/jest-e2e.json test/group4-opex-marketing.e2e-spec.ts test/group5-wallets-adjustments.e2e-spec.ts test/group6-refunds-offline.e2e-spec.ts test/group7-change-requests-reconciliation.e2e-spec.ts --runInBand`
  - `npx jest --config test/jest-e2e.json test/payroll.e2e-spec.ts test/scenario4-payroll-fund-fluctuation.e2e-spec.ts --runInBand`
- BA02 workflow scripts:
  - `node scripts/test-expenses-workflow.js`
  - `node scripts/test-wallet-topup-workflow.js`
  - `node scripts/test-staff-payroll-workflow.js`
  - `node scripts/test-teacher-payroll-ops-scenarios.js`

### Doi soat bat buoc

- `Expense -> Ledger/Fund -> Financial Control`
- `Top-up/Transfer -> Wallet Balance -> Ledger -> Audit`
- `Refund/Rollback -> Invoice -> Wallet -> Ledger -> Related ticket/order`
- `Offline session -> Attendance -> Session payroll preview -> Payroll hold`
- `Script runner` va `API` phai cho ra ket qua trung khop ve tai khoan va tai chinh

### Ket qua mong muon

- Co bang ro cac item `BA02` da test:
  - `CAN_CLOSE_NOW` neu co pass va evidence
  - `HOLD` neu can xac minh bang log tren test env
  - `BLOCKED` neu thieu seed, SOP, hoac endpoint
- Nhan dien:
  - bug do seed
  - bug do quy trinh cong
  - bug do logic wallet hoac ledger

### Dieu kien stop som

- `BA02` fail `P0/P1` o wallet, ledger, reconcile, hoac rollback
- Seed `BA02` khong du dieu kien sau khi da thu lai 1 lan
- Security/RBAC break trong cash movement

### Dieu kien go to BA03

- Expense, wallet, refund va offline economics co the mo lap voi side effect.
- Khong co duplicate hoac thieu audit trong luong tai chinh.
- Offline payroll can bang trong bai checklist `BA02`.

## 4. Batch B - BA03 Change Requests, Reconciliation, Capital, Concurrency

### Pham vi

- `Nhom 8`
- `Nhom 9`
- `Nhom 10`
- `Nhom 11`
- `Nhom 12`

### Muc tieu

- Kiem tra quy trinh change request duoi 2 state: `pending`, `approved`, `rejected`.
- Kiem tra reconciliation va auto-heal/retry.
- Kiem tra concurrency trong thao tac cap nhat state, approval, reconcile.
- Kiem tra RBAC va role separation khi thao tac nang cao.

### Checklist uu tien

- Submit, approve, reject change request
- Reconciliation idempotency: run twice, chi thay doi 1 lan
- Capital/backoffice flow impact
- Marketing webhook trigger/consume khi state da duoc thay doi
- RBAC guard tren endpoint chinh: role dung, role sai

### Lenh uu tien de chay

- BA03 E2E:
  - `npx jest --config test/jest-e2e.json test/group8-capital-backoffice.e2e-spec.ts test/group9-expenses-concurrency.e2e-spec.ts test/group10-rbac-security.e2e-spec.ts test/group11-state-machine.e2e-spec.ts test/group12-marketing-webhooks.e2e-spec.ts --runInBand`
  - `npx jest --config test/jest-e2e.json test/security-rbac.e2e-spec.ts test/data-isolation-rbac.e2e-spec.ts --runInBand`
- BA03 workflow scripts:
  - `node scripts/test-rbac-finance-guards.js`
  - `node scripts/test-financial-control-costs.ts`
  - `node scripts/test-ads-financial-control-recalculation.ts`

### Doi soat bat buoc

- `Change request -> resource detail -> approval queue -> audit log`
- `Reconciliation -> matched/unmatched -> backoffice summary`
- `Concurrency test -> 1 success -> khong duplicate ledger/state`
- `RBAC -> accepted/forbidden -> action log`
- `Webhook/changing state -> financial/campaign impact` co du lieu dong bo

### Ket qua mong muon

- Co bang ro item `BA03` da du dieu kien dong ngay:
  - idempotent behavior kiem chung
  - lock/concurrency khong sinh nhan du lieu trung
  - audit log co ghi du duyet va nguoi thuc hien
- Danh dau nhung item can doc them khi RBAC hoac SOP chua ro rang.

### Dieu kien stop som

- Race condition tao duplicate approve/reject hoac duplicate reconcile
- Reconciliation thay doi summary/report theo cach bat thuong
- Endpoint security cho role khong ro rang
- Bai `BA02` chua pass nhung `BA03` phu thuoc luong tai chinh chung

### Dieu kien qua BA03

- `BA03` co ket qua on dinh, khong co `P0/P1` fail.
- Concurrency/idempotency duoc chay hai lan va ket qua bang nhau.
- Audit trail va state transitions ro rang.

## 5. Thu tu chay khuyen nghi dot 2

1. `Session 0 - Preflight`
2. `BA02 - OPEX, Wallets, Refunds, Offline Economics`
3. Chot `go/no-go` sau `BA02`
4. Neu `GO`, mo `BA03 - Change Requests, Reconciliation, Capital, Concurrency`
5. Chot summary dot 2

## 6. Dung ket qua va stop condition

- Dung ngay bat ky dot hoac batch neu:
  - co fail `P0/P1` tai luong cash, wallet, reconciliation, concurrency
  - co doc drift that su can sua checklist truoc khi ket luan
  - seed/role env khong the dung de tao du lieu phep test tiep

## 7. Dau ra bat buoc cua dot 2

- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA02_Opex_Wallets_Refunds_Offline_<YYYYMMDD>.md`
- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA03_Change_Reconciliation_Capital_Concurrency_<YYYYMMDD>.md`
- `qa/reports/backend-api/summary-<YYYYMMDD>.vi.md`

Neu `BA02 -> BA03` dat va du dieu kien chot:

- `qa/reports/backend-api/final-verification-<YYYYMMDD>.vi.md`

## 8. Mau bao cao bat buoc

Moi batch phai co:

1. `Commands run`
2. `Seed and roles`
3. `Results`
4. `Checklist items can close now`
5. `Tested but not enough to close`
6. `Blocked / env issues`
7. `Doc drift or automation drift`
8. `Go/No-Go for next batch`

Mau ngan:

```md
Batch:
Commands:
- ...

Seed and roles:
- ...

Results:
- spec-a: PASS
- script-b: FAIL

Can close now:
- ...

Tested but not enough:
- ...

Blocked/env:
- ...

Doc drift / automation drift:
- ...

Go/No-Go:
- GO BA03
```

## 9. Ghi chu

- Chi main agent xac nhan item du dieu kien dong trong `qa/checklists/backend-api/test.md`.
- Neu `BA02` fail o luong wallet, ledger, reconcile, hoac rollback, stop tai `BA02`.
- Neu `BA03` co fail `DOC DRIFT` nhung luong co the mo hoac test tiep bang dieu kien moi, co the tiep tuc `BA03` voi dieu kien ghi ro.

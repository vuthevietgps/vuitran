# Template summary backend test dot BA02 -> BA03

## Thong tin chung

- Ngay chay: `YYYY-MM-DD`
- Dot: `BA02 -> BA03`
- Truong du an: `school-mgmt/backend`
- Duong dan dot log ky thuat: `runtime-logs/backend-api/<YYYY-MM-DD>/`
- Nguoi thuc hien: ``
- Nguoi kiem soat (neu co): ``
- Tong thoi gian chay: `HH:MM`
- Muc tieu dot: `BA02 pass -> BA03`

## Nguon tham chieu

- Checklist goc: `qa/checklists/backend-api/test.md`
- Master test plan: `qa/plans/backend-api/master-test-plan.vi.md`
- Execution checklist dot 2: `qa/plans/backend-api/execution-checklist-dot2.vi.md`
- Rulebook batch: `qa/playbooks/backend-api-sop-mapping.vi.md`
- Runbook:
  - `qa/runbooks/backend-api/BA02-Opex-Wallets-Refunds-Offline.vi.md`
  - `qa/runbooks/backend-api/BA03-Change-Reconciliation-Capital-Concurrency.vi.md`
- Runtime log:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA02_Opex_Wallets_Refunds_Offline_<YYYYMMDD>.md`
  - `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA03_Change_Reconciliation_Capital_Concurrency_<YYYYMMDD>.md`
- Du lieu automation/test output:
  - `school-mgmt/test-results/`
  - `school-mgmt/test/jest-e2e.json`
  - `school-mgmt/test/jest-unit.json`

## Go / No-Go tong the

- Quyet dinh: `GO / NO-GO`
- Ly do cho quyet dinh:
- Tinh trang dieu kien de mo BA03:
  - `Dat` / `Khong`
- Tinh trang dieu kien chot dot:
  - `Dat` / `Khong`

## Batch BA02 - OPEX, Wallets, Refunds, Offline Economics

### Muc tieu

- Kiem soat chi phi va van hanh marketing.
- Kiem soat wallet, top-up, transfer, rollback va refund.
- Kiem soat offline economics: attendance, teacher payroll, min guarantee.
- Dam bao BA02 khong con fail P0/P1 lien quan cash movement, ledger, rollback, hoac audit.

### Commands da chay

- ``
- ``
- ``

### Seed / vai tro da dung

- ``
- ``

### Ket qua thuc te

- Thoi gian bat dau: ``
- Thoi gian ket thuc: ``
- Tong hop ket qua:
  - `PASS: x`
  - `FAIL: x`
  - `SKIP: x`
  - `BLOCK: x`
- Chi tiet fail/skip quan trong:

### Items that can close now (chuan dong ngay)

- [ ] item code: mo ta
- [ ] item code: mo ta
- [ ] item code: mo ta

### Tested but not enough (chua du dieu kien dong)

- [ ] item code: tai sao test chua du
- [ ] item code: tai sao can mo rong

### Blocked / Environments

- [ ] ENV issue: ``
- [ ] Data/seed issue: ``
- [ ] API dependency issue: ``
- [ ] Test infra issue: ``

### Doc drift / automation drift

- `DOC DRIFT`: ``
- `AUTOMATION DRIFT`: ``
- `SPEC DRIFT`: ``
- `SCRIPT DRIFT`: ``

### Quyet dinh sau BA02

- Go/No-Go BA03: `GO / NO-GO`
- Dieu kien bat buoc de tiep tuc BA03:
  - ``
  - ``

## Batch BA03 - Change Requests, Reconciliation, Capital, Concurrency

### Muc tieu

- Kiem tra change request, approval queue, reconciliation, capital impact va concurrency.
- Kiem tra idempotency va RBAC guard tren thao tac cap nhat state.
- Dam bao BA03 khong con fail P0/P1 lien quan duplicate state, duplicate ledger, hoac audit sai.

### Commands da chay

- ``
- ``
- ``

### Seed / vai tro da dung

- ``
- ``

### Ket qua thuc te

- Thoi gian bat dau: ``
- Thoi gian ket thuc: ``
- Tong hop ket qua:
  - `PASS: x`
  - `FAIL: x`
  - `SKIP: x`
  - `BLOCK: x`
- Chi tiet fail/skip quan trong:

### Items that can close now (chuan dong ngay)

- [ ] item code: mo ta
- [ ] item code: mo ta

### Tested but not enough (chua du dieu kien dong)

- [ ] item code: tai sao test chua du
- [ ] item code: tai sao can mo rong

### Blocked / Environments

- [ ] ENV issue: ``
- [ ] Data/seed issue: ``
- [ ] API dependency issue: ``
- [ ] Test infra issue: ``

### Doc drift / automation drift

- `DOC DRIFT`: ``
- `AUTOMATION DRIFT`: ``
- `SPEC DRIFT`: ``
- `SCRIPT DRIFT`: ``

### Quyet dinh cuoi dot

- BA02 -> BA03 dat dieu kien chot: `Dat / Khong`
- Vi tri can luu y:
- Kiem tra lai tren:
  - ``
  - ``

## Tong hop dong

- Can close trong test.md ngay bay gio:
  - ``
- Canh bao can lam sau:
  - ``
- P0/P1 con de trong dot nay:
  - ``

## Final sign-off

- Status tong: `PASS / FAIL / BLOCKED`
- Dot co du dieu kien bao cao cho review tiep theo: `Yes / No`
- Nhan xet ngan (1-3 dong):
- Nguoi ghi:
- Nguoi duyet:
- Thoi gian duyet: ``

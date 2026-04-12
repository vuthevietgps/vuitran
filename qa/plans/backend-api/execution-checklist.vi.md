# Checklist thuc thi backend API - Dot 1

Cap nhat: `2026-04-09`

Gia dinh dot dau tien chay theo thu tu:

- `BA07`
- `BA01`

Nguon doi soat:

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\backend-api\test.md`
- Rulebook tong: `C:\Users\PC\Documents\code\vuitran\qa\plans\backend-api\master-test-plan.vi.md`
- SOP mapping: `C:\Users\PC\Documents\code\vuitran\qa\playbooks\backend-api-sop-mapping.vi.md`
- Runbook batch:
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA07-Auth-Trials-Attendance.vi.md`
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA01-Cashflow-Revenue-Crisis.vi.md`

## Snapshot va muc tieu

- Muc tieu cua file nay: bien `BA07 -> BA01` thanh 1 dot chay that su co:
  - preflight ro rang
  - lenh uu tien de chay
  - tieu chi stop/go giua 2 batch
  - mau bao cao de tong hop nhanh
- Nguyen tac:
  - `BA07` la gate cho `BA01`
  - neu `BA07` con vo auth, trial propagation, hoac attendance billing thi khong mo `BA01`

## 1. Quy tac chung

1. Khong ket luan `PASS` chi vi HTTP `200`.
2. Moi case write phai co `before -> action -> after`.
3. Moi case tai chinh/duyet phai co toi thieu `2` man doi soat side effect.
4. Moi case RBAC phai co ca `positive role` va `negative role`.
5. Neu checklist, SOP va automation anchor mau thuan:
   - uu tien ghi nhan:
     - `PRODUCT BUG`
     - `DOC DRIFT`
     - `AUTOMATION DRIFT`
     - `ENV/SEED ISSUE`
   - khong tu tick `PASS` theo suy doan.
6. Log ky thuat dat o:
   - `C:\Users\PC\Documents\code\vuitran\runtime-logs\backend-api\<YYYY-MM-DD>\`
7. Summary dot dat o:
   - `C:\Users\PC\Documents\code\vuitran\qa\reports\backend-api\`

## 2. Session 0 - Preflight bat buoc

### Muc tieu

- Dam bao moi truong backend du dieu kien de chay `BA07`
- Khoa seed va runner truoc khi vao test nghiep vu

### Checklist preflight

- [ ] `npm ci` trong `school-mgmt/backend`
- [ ] Xac nhan `.env` hop le va backend ket noi MongoDB duoc
- [ ] Chay:
  - `node scripts/seed-all.js`
  - `node scripts/ensure-commercial-admin.js`
- [ ] Xac nhan co cac tai khoan role can dung:
  - `DIRECTOR`
  - `SALE`
  - `OPS`
  - `TEACHER`
  - `PARENT`
  - `ACCOUNTING`
- [ ] Tao thu muc log dot:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/`
- [ ] Chay smoke toi thieu:
  - `npm run test:unit -- --runInBand src/orders/order-workflow.service.spec.ts src/attendance/attendance-link.service.spec.ts src/users/users.service.spec.ts`
- [ ] Chay smoke E2E gate:
  - `npx jest --config test/jest-e2e.json test/security-rbac.e2e-spec.ts --runInBand`

### Dieu kien vao BA07

- Backend boot on dinh
- Seed khong loi
- Tai khoan test dang nhap duoc
- Smoke unit/E2E khong do vo nen

## 3. Batch A - BA07 Auth, Trials, Attendance

### Pham vi

- `Nhom 31`
- `Nhom 32`
- `Nhom 33`

### Muc tieu

- Khoa auth baseline
- Khoa trial -> enrollment -> order propagation
- Khoa attendance va tinh tien truoc khi mo dong tien vao

### Checklist uu tien

- Login success/fail
- Rate limit hoac lockout
- Session/guard behavior sau login
- Trial enrollment tao du lieu dung
- Trial convert khong mat propagation
- Attendance token hop le / het han / loi
- Attendance cap nhat `amountCharged` dung theo config
- Parent/teacher isolation khong lo du lieu sai nguoi

### Lenh uu tien de chay

- Auth va isolation:
  - `npx jest --config test/jest-e2e.json test/security-rbac.e2e-spec.ts test/data-isolation-rbac.e2e-spec.ts --runInBand`
- Trials:
  - `npx jest --config test/jest-e2e.json test/trial-enrollment-conversion.e2e-spec.ts test/trial-order-propagation.e2e-spec.ts --runInBand`
- Attendance:
  - `npx jest --config test/jest-e2e.json test/attendance.e2e-spec.ts --runInBand`
- Workflow scripts:
  - `node scripts/test-attendance-workflow.js`
  - `node scripts/test-attendance-report-workflow.js`
  - `node scripts/test-class-attendance-pricing-workflow.js`

### Doi soat bat buoc

- Auth:
  - `login response`
  - `guard/protected endpoint`
  - `audit/work session` neu co
- Trial:
  - `trial enrollment`
  - `student`
  - `order/enrollment/session` phat sinh
- Attendance:
  - `attendance record`
  - `session detail`
  - `amountCharged`
  - `revenue/payroll condition` neu case co anh huong

### Ket qua mong muon

- Co bang map ro item nao cua `Nhom 31-33`:
  - `co the dong ngay`
  - `da test nhung chua du bang chung`
  - `blocked`
  - `need doc clarification`

### Dieu kien stop som

- Lockout/rate-limit khong bat duoc do env khong bat feature
- Seed trial khong tao du du lieu nen
- Attendance token/link khong tao duoc hoac route public dang drift lon

### Dieu kien qua BA01

- Khong con fail `P0` mo trong auth/trial/attendance do nen he thong
- Trial propagation du tin cay de order/session side effect co y nghia
- Attendance billing snapshot khong co dau hieu sai he thong

## 4. Batch B - BA01 Cashflow, Revenue, Crisis

### Pham vi

- `Nhom 1`
- `Nhom 2`
- `Nhom 3`

### Muc tieu

- Khoa luong tien vao
- Khoa revenue/COGS khi finalize session
- Khoa penalty/crisis side effect len payroll va tai chinh

### Checklist uu tien

- Approve order chuan
- Approve order transfer co receipt
- Cash order khong can receipt
- Discount va `finalAmount`
- Installment chi tac dong tung ky
- Trial/zero amount khong lam sai cashflow
- Finalize session cap nhat revenue/COGS
- Crisis/penalty khong lam sai payroll hoac summary

### Lenh uu tien de chay

- Core grouped specs:
  - `npx jest --config test/jest-e2e.json test/group1-cash-inflow.e2e-spec.ts test/group2-revenue-cogs.e2e-spec.ts test/group3-crisis-penalties.e2e-spec.ts --runInBand`
- Deep scenarios:
  - `npx jest --config test/jest-e2e.json test/order-enrollment-scenarios.e2e-spec.ts test/orders-deep-review.e2e-spec.ts test/scenario2-revenue-payroll.e2e-spec.ts test/scenario3-crisis-management.e2e-spec.ts --runInBand`
- Workflow scripts:
  - `node scripts/test-invoices-workflow.js`
  - `node scripts/test-sessions-workflow.js`

### Doi soat bat buoc

- Order approve:
  - `order`
  - `invoice`
  - `wallet`
  - `ledger`
  - `financial-control`
- Session finalize:
  - `session detail`
  - `revenue/P&L`
  - `parent/teacher side effect` neu co
- Crisis/penalty:
  - `payroll`
  - `financial summary`
  - `audit log`

### Ket qua mong muon

- Co ket luan ro item nao cua `Nhom 1-3` co the dong ngay
- Co danh sach item da pass script/spec nhung chua du evidence de sign-off
- Co danh sach fail that su lien quan den money flow

### Dieu kien stop som

- BA07 chua xanh nhung BA01 dang fail o luong order/session phu thuoc trial/attendance
- Seed order/invoice/session nen khong tao duoc data doi soat
- Ledger/wallet drift qua lon khien ket qua khong con phan biet duoc bug hay env

## 5. Thu tu chay khuyen nghi trong dot 1

1. `Session 0 - Preflight`
2. `BA07 - Auth/Trials/Attendance`
3. Chot quick summary `go/no-go`
4. Neu `go`, mo `BA01 - Cashflow/Revenue/Crisis`
5. Chot summary dot 1

## 6. Dau ra bat buoc cua dot 1

- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA07_Auth_Trials_Attendance_<YYYYMMDD>.md`
- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA01_Cashflow_Revenue_Crisis_<YYYYMMDD>.md`
- `qa/reports/backend-api/summary-<YYYYMMDD>.vi.md`

Neu BA01 chay xong va du dieu kien chot:

- `qa/reports/backend-api/final-verification-<YYYYMMDD>.vi.md`

## 7. Mau bao cao bat buoc

Moi batch phai tra ve:

1. `Commands run`
2. `Seed and roles used`
3. `Results`
4. `Checklist items that can be closed now`
5. `Checklist items tested but not enough to close`
6. `Blocked or env issues`
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
- GO BA01
```

## 8. Luu y cho main agent

- Chi main agent moi duoc ket luan item nao du dieu kien dong trong `test.md`
- Neu BA07 lo ra fail P0 that su, dung dot 1 tai BA07
- Neu BA07 chi lo `DOC DRIFT` hoac `AUTOMATION DRIFT`, van co the mo BA01 neu luong auth/attendance khong vo nen

# Checklist thuc thi backend API - Dot 4

Cap nhat: `2026-04-09`

Giai doan dot tiep theo chay theo thu tu:

- `BA06`
- `BA08`

Nguon doi soat:

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\backend-api\test.md`
- Rulebook tong: `C:\Users\PC\Documents\code\vuitran\qa\plans\backend-api\master-test-plan.vi.md`
- SOP mapping: `C:\Users\PC\Documents\code\vuitran\qa\playbooks\backend-api-sop-mapping.vi.md`
- Runbook batch:
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA06-Products-Teaching-Teachers-Reports.vi.md`
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA08-WorkSessions-Financial-Dashboards.vi.md`

## 1. Muc tieu va nguyen tac

- Muc tieu cua dot nay: chay `BA06 -> BA08` thanh 1 lan chay co the lay `go/no-go` ro rang.
- `BA06` la gate cho `BA08` vi `BA08` co nhieu luong dashboard/finance/payroll phu thuoc report, teacher va work session state.
- Moi case write phai co:
  - `before -> action -> after`
  - it nhat 2 layer side effect cho luong report, export, dashboard, hoac financial control
- Moi case RBAC/guard phai co:
  - `positive role`
  - `negative role`
  - `forbidden/blocked` khi co endpoint
- Log ky thuat o:
  - `C:\Users\PC\Documents\code\vuitran\runtime-logs\backend-api\<YYYY-MM-DD>\`
- Summary dot o:
  - `C:\Users\PC\Documents\code\vuitran\qa\reports\backend-api\`

## 2. Session 0 - Preflight cho dot 4

### Muc tieu

- Kich hoat moi truong da du dieu kien cho `BA06` va `BA08`.
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
  - `TEACHER`
  - `PARENT`
  - `SHAREHOLDER`
- [ ] Chuan bi du lieu cho `BA06`:
  - product active/inactive co target
  - teaching report/material co seed
  - teacher/student profile co san
  - export/report co the sinh file
- [ ] Chuan bi du lieu cho `BA08`:
  - work session open/close co the quan sat
  - financial control snapshot co du lieu
  - dashboard theo role co san
  - pending approvals/users co target
- [ ] Tao thu muc log dot:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/`
- [ ] Chay smoke toi thieu:
  - `npx jest --config test/jest-e2e.json test/group20-products-reports.e2e-spec.ts --runInBand`
  - `npx jest --config test/jest-e2e.json test/payroll.e2e-spec.ts --runInBand`

### Dieu kien vao BA06

- Backend chay on dinh, seed thanh cong.
- Nhom tai khoan test dang nhap duoc.
- Smoke E2E co the chay ma khong bi loi infra hoac data drift tong the.

## 3. Batch A - BA06 Products, Teaching, Teachers, Reports

### Pham vi

- `Nhom 25`
- `Nhom 26`
- `Nhom 27`
- `Nhom 28`
- `Nhom 29`
- `Nhom 30`
- Primary BA06 runner bundle: `group20`, `group21`, `group22`
- Overlap rerun anchors trong executed campaign: `group23`, `group24` tu BA05 cron/backfill slice

### Muc tieu

- Kiem tra product lifecycle, teaching report, materials, teacher management va student/report side effect.
- Dam bao BA06 khong con fail P0/P1 lien quan report export, teacher data, cron reliability, hoac visibility.

### Checklist uu tien

- Product create/update/deactivate
- Teaching report submit
- Materials upload/update
- Teacher profile/update
- Student/report visibility va export
- Cron reliability duoc overlap rerun qua `group23/group24` de xac nhan stability sau BA06, nhung BA05 van la primary owner

### Lenh uu tien de chay

- BA06 E2E:
  - `npx jest --config test/jest-e2e.json test/group20-products-reports.e2e-spec.ts test/group21-materials-export.e2e-spec.ts test/group22-students.e2e-spec.ts test/group23-cron-notifications-sessions.e2e-spec.ts test/group24-cron-retry-backfill.e2e-spec.ts --runInBand`
- Workflow scripts:
  - `node scripts/test-teaching-report-workflow.js`
  - `node scripts/test-teaching-materials-workflow.js`
  - `node scripts/test-teacher-profiles-workflow.js`
  - `node scripts/test-teacher-kpi-workflow.js`
  - `node scripts/test-employee-performance-workflow.js`
  - `node scripts/test-student-report-workflow.js`
  - `node scripts/test-export-reports-workflow.js`

### Doi soat bat buoc

- `Product -> order/report side effect`
- `Teaching report/material -> payroll/KPI/teacher view`
- `Export/report -> file output/masking`
- `Teacher/student update -> list/detail consistency`
- `Cron reliability -> overlap rerun group23/group24, doi chieu voi BA05 evidence va xac nhan khong phat sinh instability moi`

### Ket qua mong muon

- Co bang ro item nao cua `Nhom 25-30`:
  - `co the dong ngay`
  - `da test nhung chua du bang chung`
  - `blocked`
  - `need doc clarification`

### Dieu kien stop som

- Deactivate product nhung downstream van create duoc
- Teaching report luu duoc nhung payroll/KPI khong doi
- Export dung du lieu nhung sai masking hoac encoding
- Teacher/student update khong lan dung sang views lien quan

### Dieu kien qua BA08

- BA06 khong con fail P0/P1 o report, export, teacher; overlap rerun `group23/group24` khong cho thay drift moi cua cron/backfill.
- Visibility va role-based output da doi chieu duoc.
- Side effect cua product/report/teacher khop nhau.

## 4. Batch B - BA08 Work Sessions, Financial Control, Dashboards

### Pham vi

- `Nhom 34`
- `Nhom 35`
- `Nhom 36`
- `Nhom 37`

### Muc tieu

- Kiem tra work sessions, financial control, dashboards theo role, pending approvals va users.
- Dam bao BA08 khong con fail P0/P1 lien quan payroll, dashboard isolation, approval flow, hoac RBAC view.

### Checklist uu tien

- Work session open/close
- Late detection / auto-close
- Financial control overview, P&L, balance, aging, tax
- Dashboard theo role va read-only enforcement
- Pending approvals va user ownership/sync

### Lenh uu tien de chay

- BA08 E2E:
  - `npx jest --config test/jest-e2e.json test/payroll.e2e-spec.ts test/attendance.e2e-spec.ts test/scenario2-revenue-payroll.e2e-spec.ts test/scenario4-payroll-fund-fluctuation.e2e-spec.ts --runInBand`
- Workflow scripts:
  - `npm run test:work-sessions-workflow`
  - `npm run test:financial-control-workflow`
  - `npm run test:financial-control-payroll`
  - `npm run test:financial-control-payroll-recalculation`
  - `npm run test:financial-control-loans`
  - `npm run test:attendance-payroll-financial-control`
  - `npm run test:audit-log-workflow`

Luu y:

- `group8..12` la carry-over cua `BA03`, khong phai BA08 core bundle.

### Doi soat bat buoc

- `Work session -> timekeeping detail -> payroll/report side effect`
- `Financial control -> P&L/balance/aging/tax -> dashboard summaries`
- `Pending approvals -> queue count -> target resource status -> audit log`
- `Users -> user detail/list -> RBAC visibility`

### Ket qua mong muon

- Co bang ro item nao cua `Nhom 34-37`:
  - `co the dong ngay`
  - `da test nhung chua du bang chung`
  - `blocked`
  - `need doc clarification`

### Dieu kien stop som

- Work session tu dong dong nhung khong gan trang thai phu hop
- Financial report tra so nhung khong khop dashboard lien quan
- Dashboard role read-only bi lo action write
- Pending approvals doi trang thai resource nhung count hub khong cap nhat

### Dung ket qua va stop condition

- Dung ngay bat ky dot hoac batch neu:
  - co fail `P0/P1` tai luong payroll, finance, dashboard, approvals, users
  - co doc drift that su can sua checklist truoc khi ket luan
  - seed/role/env khong the dung de tao du lieu phep test tiep

## 5. Thu tu chay khuyen nghi trong dot 4

1. `Session 0 - Preflight`
2. `BA06 - Products/Teaching/Teachers/Reports`
3. Chot `go/no-go` sau `BA06`
4. Neu `GO`, mo `BA08 - Work Sessions/Financial Control/Dashboards`
5. Chot summary dot 4

## 6. Dau ra bat buoc cua dot 4

- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA06_Products_Teaching_Teachers_Reports_<YYYYMMDD>.md`
- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA08_WorkSessions_Financial_Dashboards_<YYYYMMDD>.md`
- `qa/reports/backend-api/summary-<YYYYMMDD>.vi.md`

Neu `BA06 -> BA08` dat va du dieu kien chot:

- `qa/reports/backend-api/final-verification-<YYYYMMDD>.vi.md`

## 7. Mau bao cao bat buoc

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
- GO BA08
```

## 8. Luu y cho main agent

- Chi main agent moi duoc ket luan item nao du dieu kien dong trong `test.md`
- Neu BA06 lo ra fail P0 that su, dung dot 4 tai BA06
- Neu BA06 chi lo `DOC DRIFT` hoac `AUTOMATION DRIFT`, van co the mo BA08 neu luong report/finance khong vo nen

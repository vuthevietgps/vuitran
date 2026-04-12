# Ke hoach Test Backend API

## 1. Muc tieu

- Bam checklist goc tai `qa/checklists/backend-api/test.md`.
- Chia `37` nhom checklist thanh cac batch du nho de chay thuc te.
- Gan moi batch voi:
  - SOP/playbook bat buoc
  - seed va tien dieu kien
  - kich ban chay thuc te
  - automation anchor de doi chieu
- Chuan hoa evidence de co the chay backend theo quy trinh co dinh.

## 2. Source of truth

- Checklist goc: `qa/checklists/backend-api/test.md`
- Jest E2E/perf: `school-mgmt/backend/test/`
- Workflow scripts: `school-mgmt/backend/scripts/test-*.js`, `test-*.ts`
- Seed scripts:
  - `school-mgmt/backend/scripts/seed-all.js`
  - `school-mgmt/backend/scripts/seed-users.js`
  - `school-mgmt/backend/scripts/ensure-commercial-admin.js`
- SOP/playbook nghiep vu:
  - `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
  - `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`
  - `school-mgmt/docs/teacher/KichBanKiemThu_GiaoVien.md`
  - `school-mgmt/docs/adsmanager/HuongDanAdsManager_ChiTiet.md`
  - `school-mgmt/docs/guidelines/landing-page-rules.md`
  - `school-mgmt/docs/project/mota.md`
  - `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`
  - `school-mgmt/frontend/src/app/components/internal-handbook.configs.ts`
- Bao cao tong hop QA:
  - `qa/reports/backend-api/`
  - `school-mgmt/test-results/`
  - `runtime-logs/backend-api/`

## 3. Dau ra bat buoc cua moi batch

- `LOG_<BatchID>_<TenNganGon>_<YYYYMMDD>.md`
- Capture command hoac transcript cua lenh da chay
- Ghi nhan `PASS`, `FAIL`, `BLOCKED`, `NOT RUN` theo tung case hoac tieu muc
- Voi case co ghi du lieu:
  - request dau vao
  - response nhan duoc
  - it nhat `2` buoc doi soat side effect neu la luong tai chinh, duyet, rollback, backfill, cron
- Neu co doi chieu automation:
  - ten file spec/script
  - cau lenh da dung
  - output hoac JUnit path

## 4. Quy uoc evidence

- Log ad hoc theo dot: `runtime-logs/backend-api/<YYYY-MM-DD>/`
- Summary/sign-off theo dot: `qa/reports/backend-api/`
- Output automation chinh thuc:
  - `school-mgmt/test-results/unit/`
  - `school-mgmt/test-results/e2e/`
  - `school-mgmt/test-results/perf/`

## 5. Luat thuc thi bat buoc

- Khong ket luan `PASS` chi vi HTTP `200`.
- Moi action `approve`, `reject`, `cancel`, `reconcile`, `mark paid`, `finalize`, `bulk`, `backfill`, `sync`, `lockout`, `webhook`, `close ticket`, `create lead/order` phai co doi soat side effect.
- Voi luong tai chinh:
  - doi soat it nhat `2` lop du lieu trong so `wallet`, `ledger`, `invoice`, `order`, `session`, `financial-control`, `dashboard`, `audit log`
- Voi RBAC:
  - phai co it nhat `1` role duoc phep va `1` role bi chan
- Voi concurrency/idempotency:
  - phai thu it nhat `2` request hoac `2` lan chay lien tiep de xac nhan khong nhan ban side effect
- Voi cron/backfill:
  - phai ghi ro `before`, thao tac trigger, va trang thai `after`
- Neu SOP chua du chi tiet:
  - doc `qa/playbooks/backend-api-sop-mapping.vi.md`
  - mo automation anchor tuong ung
  - neu van mo ho, danh dau `BLOCKED-DOC` thay vi tu doan expected behavior

## 6. Chuan bi moi truong toi thieu

1. Tu `school-mgmt/backend`, cai dependency bang `npm ci`
2. Kiem tra `.env` va kha nang ket noi MongoDB
3. Chuan hoa data nen:
   - `node scripts/seed-all.js`
   - `node scripts/ensure-commercial-admin.js`
   - neu can bo sung user nen, dung `node scripts/seed-users.js`
4. Chay smoke xac nhan runner:
   - `npm run test:unit`
   - `npm run test:e2e`
5. Khi batch co rui ro cao ve concurrency hoac performance:
   - can nhac chay lai spec tuong ung trong `school-mgmt/backend/test/`
   - hoac workflow script domain tuong ung trong `school-mgmt/backend/scripts/`
6. Khi can xac minh Redis/BullMQ queue path that su:
   - dung backend chay voi `REDIS_ENABLED=true`
   - uu tien launch one-shot `node dist/main.js`, khong dung watch mode cho sign-off
   - dat `TEST_API_BASE` tro vao backend do
   - chay `npm run test:redis-webhook-queue-probe`
   - probe phai xac nhan `3/3 webhook users persisted`
   - coi day la infra-only hardening anchor, khong thay the full BA04/BA05 workflow

## 7. Ma tran batch chinh

Luu y:

- ID batch bam theo checklist groups trong `test.md`.
- Ten file automation backend lich su khong phai luc nao cung trung so nhom checklist.
- `group23` va `group24` hien la shared cron anchors duoc tai su dung boi `BA05` va `BA06`.
- Voi `BA08`, authoritative core dung runbook BA08; khong coi `group8..12` la primary anchors.
- Executed campaign boundary:
  - `BA05` runner bundle = `group18`, `group19`, `group23`, `group24`
  - `BA06` runner bundle = `group20`, `group21`, `group22` + overlap rerun `group23`, `group24`
- Khi so nhom va ten file khong trung, uu tien doc:
  1. runbook batch
  2. SOP mapping
  3. noi dung thuc te cua spec/script

| Batch | Nhom checklist | Trong tam | Runbook |
| --- | --- | --- | --- |
| `BA01` | `1-3` | Cash inflow, revenue, crisis | `qa/runbooks/backend-api/BA01-Cashflow-Revenue-Crisis.vi.md` |
| `BA02` | `4-7` | OPEX, wallets, refunds, offline economics | `qa/runbooks/backend-api/BA02-Opex-Wallets-Refunds-Offline.vi.md` |
| `BA03` | `8-12` | Change requests, reconciliation, capital, concurrency, RBAC/state/marketing webhook | `qa/runbooks/backend-api/BA03-Change-Reconciliation-Capital-Concurrency.vi.md` |
| `BA04` | `13-17` | State machine mo rong, limits, agents, class config, chatbot webhooks, tickets, notifications | `qa/runbooks/backend-api/BA04-State-Limits-Agents-Class-Chatbot.vi.md` |
| `BA05` | `18-24` | CRM, landing, messages; executed runner bundle = `group18`, `group19`, `group23`, `group24`, where `group23/24` act as legacy cron/backfill anchors owned primarily by BA05 | `qa/runbooks/backend-api/BA05-CRM-Landing-Messages-Cron.vi.md` |
| `BA06` | `25-30` | Products, teaching reports/materials, exports, teacher management, students/progress; executed runner bundle = `group20`, `group21`, `group22` plus overlap rerun `group23`, `group24` for cron stability only | `qa/runbooks/backend-api/BA06-Products-Teaching-Teachers-Reports.vi.md` |
| `BA07` | `31-33` | Auth, trial enrollments, attendance and per-minute billing | `qa/runbooks/backend-api/BA07-Auth-Trials-Attendance.vi.md` |
| `BA08` | `34-37` | Work sessions, financial control, dashboards, pending approvals, users; authoritative core uses `payroll`, `attendance`, `scenario2`, `scenario4` plus finance/work-session scripts | `qa/runbooks/backend-api/BA08-WorkSessions-Financial-Dashboards.vi.md` |

## 8. Thu tu chay khuyen nghi

1. `BA07`
2. `BA01`
3. `BA02`
4. `BA03`
5. `BA04`
6. `BA05`
7. `BA06`
8. `BA08`

## 9. Cach dung runbook batch

1. Mo `qa/playbooks/backend-api-sop-mapping.vi.md`
2. Chon batch tuong ung
3. Doc runbook batch
4. Chuan bi seed/precondition dung theo runbook
5. Chay manual/API scenario
6. Chay hoac doi chieu automation anchor
7. Ghi summary vao `qa/reports/backend-api/`

## 10. Tieu chi sign-off cua mot batch

- Tat ca case trong pham vi batch da co trang thai ro rang
- Moi `FAIL` deu co:
  - request
  - response
  - expected behavior
  - side effect bi sai o dau
- Moi `BLOCKED` deu ghi ro:
  - thieu seed
  - thieu SOP
  - thieu endpoint
  - moi truong loi
- Co it nhat `1` lenh automation anchor duoc chay hoac duoc doi chieu truc tiep
- Khong con mau thuan chua xu ly giua checklist, SOP va hanh vi thuc te

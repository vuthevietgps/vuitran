# Ke hoach test hop nhat Backend API + Frontend UI

Cap nhat: `2026-04-09`

## 1. Ket luan review

- Backend planning da gan nhu san sang thuc thi:
  - co `master plan`
  - co `traceability matrix`
  - co runbook `BA01..BA08`
  - co execution checklist cho 4 dot
  - co summary/log template cho 4 dot
- Frontend planning da hoat dong duoc, nhung con drift so lieu:
  - `master-test-plan.vi.md` noi `291` case va con `254`
  - `remaining-cases.vi.md` noi con `183`
  - heading `67 Case Da Loai` va noi dung `71 synced PASS` chua reconcile sach
- Neu van giu thu tu `frontend truoc, backend sau`, campaign se ton thoi gian va de phat sinh false fail UI.
- Cach nhanh va it nhieu nhat la chay theo `business wave`, ghep backend va frontend theo cung domain.

## 2. Nguyen tac campaign

- Mot wave chi mo khi:
  - env on dinh
  - seed dung
  - smoke pass
  - role matrix co the dang nhap duoc
- Khong mark `PASS` chi vi:
  - HTTP `200`
  - toast thanh cong
  - form dong lai
- Moi flow co side effect phai co:
  - `before -> action -> after`
- Moi flow RBAC phai co:
  - `positive role`
  - `negative role`
- UI co side effect phai tro nguoc ve artifact backend de chung minh phan data.

## 3. Mo hinh 5 sub-agent

### SA1 - Gatekeeper

- So huu `Wave 0`
- Chot env, seed, account matrix, artifact path, smoke gate
- Khong cho mo wave neu role, seed, queue, token, cron chua dung

### SA2 - Backend Core

- So huu:
  - `BA07 -> BA01`
  - `BA02 -> BA03`
- Tap trung:
  - auth
  - trials
  - attendance billing
  - orders
  - invoices
  - wallets
  - refunds
  - reconciliation
  - concurrency

### SA3 - Backend Integrations

- So huu:
  - `BA04 -> BA05`
  - `BA06 -> BA08`
- Tap trung:
  - chatbot
  - CRM
  - landing
  - cron
  - products
  - reports
  - work sessions
  - dashboards
  - approvals
  - users

### SA4 - Frontend Core

- So huu:
  - `B01`
  - `B04`
  - `B05`
  - `B07`
  - `B08`
- Day la cum UI co side effect nang nhat va phu thuoc backend nhieu nhat

### SA5 - Frontend Integrations + Triage

- So huu:
  - `B02`
  - `B03`
  - `B06`
  - `B09`
  - `B10`
  - `B11`
  - `Nhom 12`
- Tap trung:
  - dashboard
  - handbook
  - users/products/agents
  - teacher hub
  - notifications/messages/chatbot
  - ads/public flows
  - reports/export/audit
  - cross-batch shared UI states

## 4. Wave 0 - Shared preflight

### Muc tieu

- Dong bo 1 env, 1 bo seed, 1 bo account, 1 bo artifact path cho ca UI va API.

### Bat buoc

- Freeze build/backend/frontend version cua ngay test
- Tu `school-mgmt/backend`:
  - `npm ci`
  - xac nhan `.env`
  - xac nhan MongoDB
  - xac nhan Redis/BullMQ neu wave co chatbot/cron
- Chay:
  - `node scripts/seed-all.js`
  - `node scripts/ensure-commercial-admin.js`
- Xac nhan login duoc voi:
  - `DIRECTOR`
  - `ACCOUNTING`
  - `OPS`
  - `SALE`
  - `TEACHER`
  - `PARENT`
  - `ADSMANAGER`
  - `SHAREHOLDER`
- Tao du lieu seed chung:
  - 1 parent moi chua co hoc sinh
  - 1 sale moi it du lieu
  - 1 teacher payroll binh thuong
  - 1 teacher payroll `HELD`
  - 1 offline class
  - 1 substitute-teacher session
  - 1 installment order
  - 1 partial-payment order
  - 1 trial student
  - 1 auto-confirm session
  - 1 `AUTO_CLOSED` work session
  - 1 refund ticket chain
  - 1 landing lead chain
- Tao thu muc artifact:
  - `frontend-ui-evidence/<YYYY-MM-DD>/`
  - `runtime-logs/backend-api/<YYYY-MM-DD>/`
  - `qa/reports/backend-api/`
  - `qa/reports/frontend-ui/`
- Smoke gate:
  - backend unit/e2e smoke
  - frontend login/app shell/dashboard smoke

## 5. Thu tu wave de nghi

### Wave 1

- Backend:
  - `BA07 -> BA01`
- Frontend:
  - `B01`
  - `B04`
  - `B05`
  - `B07`

### Muc tieu Wave 1

- Khoa:
  - auth
  - trial
  - attendance billing
  - orders
  - sessions
  - invoices
  - wallets
  - payroll core

### Ly do

- `B01` phu thuoc `BA07`
- `B04` phu thuoc `BA07` va `BA01`
- `B05` phu thuoc `BA04`, `BA07`, `BA01`, nhung phan co side effect nang nhat phai chot auth, attendance, session money truoc
- `B07` phu thuoc `BA01`, `BA02`, `BA08`; trong wave 1 chi mo phan invoice/wallet/payroll core da du dieu kien

### Wave 2

- Backend:
  - `BA02 -> BA03`
- Frontend:
  - `B08`
  - tail finance cua `B05`
  - tail payroll/wallet cua `B07`

### Muc tieu Wave 2

- Khoa:
  - refunds
  - offline economics
  - supplier/expense side effect
  - reconciliation
  - concurrency
  - finance advanced UI

### Wave 3

- Backend:
  - `BA04 -> BA05`
- Frontend:
  - `B09`
  - `B10`
  - phan approval-heavy cua `B02`

### Muc tieu Wave 3

- Khoa:
  - state machine
  - limits
  - agents
  - chatbot
  - tickets
  - CRM
  - landing
  - messages
  - cron/backfill

### Wave 4

- Backend:
  - `BA06 -> BA08`
- Frontend:
  - `B06`
  - `B11`
  - `B03`
  - phan dashboard/role con lai cua `B02`

### Muc tieu Wave 4

- Khoa:
  - products
  - teaching reports
  - exports
  - teacher hub
  - work sessions
  - dashboards
  - approvals
  - users

### Final Wave

- Frontend only:
  - `Nhom 12`
  - responsive
  - multi-tab
  - accessibility
- Backend rerun:
  - cron
  - webhook
  - concurrency
  - dashboard isolation

## 6. Mapping batch UI -> batch API

| Frontend | Backend phu thuoc chinh | Ghi chu |
| --- | --- | --- |
| `B01` | `BA07`, `BA08` | auth, session, menu role |
| `B02` | `BA04`, `BA08` | dashboard, alerts, approvals, role isolation |
| `B03` | `BA04`, `BA06`, `BA08` | users, products, agents, ownership |
| `B04` | `BA07`, `BA01`, `BA05` | trials, orders, invoices, chatbot-origin order |
| `B05` | `BA04`, `BA07`, `BA01` | class config, attendance, finalize/revenue |
| `B06` | `BA06`, `BA08` | teacher hub, KPI, payroll spillover |
| `B07` | `BA01`, `BA02`, `BA08` | invoice, wallet, payroll, work session |
| `B08` | `BA02`, `BA03`, `BA08` | finance advanced, reconciliation, dashboard |
| `B09` | `BA04`, `BA05` | notifications, chatbot, tickets, messages |
| `B10` | `BA05`, `BA03` | ads, landing, public flows, webhook tails |
| `B11` | `BA06`, `BA08` | reports, export, audit, shareholder masking |

## 7. Rule artifact theo wave

- Backend:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BAxx...md`
  - `qa/reports/backend-api/summary-<YYYYMMDD>.vi.md`
- Frontend:
  - `frontend-ui-evidence/<YYYY-MM-DD>/videos/UI_Bxx...mp4`
  - `frontend-ui-evidence/<YYYY-MM-DD>/logs/LOG_Bxx...md`
  - `qa/reports/frontend-ui/...`
- Shared:
  - moi wave co 1 bang tong hop:
    - what opened
    - what closed
    - what blocked
    - drift/doc issues

## 8. Case uu tien cao nhat can mo som

### Backend

- `BA07`:
  - lockout
  - JWT expiry/refresh
  - trial convert to order
  - per-minute billing
- `BA01`:
  - partial payment
  - zero balance deduction
  - parent dissatisfaction
  - payroll exclusion
- `BA03`:
  - reconciliation idempotency
  - concurrency duplicate state
  - immutable audit
- `BA04 -> BA05`:
  - webhook/chatbot/token
  - cron/backfill rerun safety
- `BA08`:
  - dashboard isolation
  - financial-control correctness
  - pending approvals/users

### Frontend

- Cum side effect nang:
  - `B04`
  - `B05`
  - `B07`
  - `B08`
  - `B09`
  - `B10`
- Cum role/dashboard/report:
  - `B02`
  - `B03`
  - `B06`
  - `B11`
- Shared state con lai:
  - `Nhom 12`

## 9. Blocker can xu ly truoc khi chay

- Reconcile lai so lieu frontend:
  - tong case
  - da xong
  - con lai
  - con lai theo batch
- Khong giu sequencing `frontend first -> backend later`
- Chot 1 seed snapshot canonical cho tung wave
- Chot 1 account sheet canonical cho ca UI va API
- Frontend README/report docs dang co drift ma hoa/so lieu, can xem la issue documentation chu khong phai product bug

## 10. Tieu chi go/no-go moi wave

- `GO` khi:
  - smoke green
  - seed dung
  - role login duoc
  - token/queue/cron san sang neu wave can
  - artifact folder da tao
- `NO-GO` khi:
  - wallet/ledger/dashboard seed bi dirty
  - chatbot token/OpenAI/queue chua san sang
  - export/report dataset chua tao du
  - so lieu count/checklist chua chot lam QA khong the estimate

## 11. Read path de thi hanh

1. `qa/QA-QUICKSTART.vi.md`
2. Checklist:
   - `qa/checklists/backend-api/test.md`
   - `qa/checklists/frontend-ui/testfrontendui.md`
3. Backend:
   - `qa/checklists/backend-api/traceability-matrix.vi.md`
   - `qa/plans/backend-api/README.vi.md`
4. Frontend:
   - `qa/plans/frontend-ui/master-test-plan.vi.md`
   - `qa/runbooks/frontend-ui/`
5. Shared Wave 0 matrix:
   - `qa/plans/shared-account-seed-matrix.vi.md`
6. SOP/playbook:
   - `qa/playbooks/backend-api-sop-mapping.vi.md`
   - `qa/playbooks/README.vi.md`
7. Evidence/report canonical

## 12. Khuyen nghi chot

- Chay theo `wave-based domain pairing`
- Dung 5 sub-agent theo ownership o muc 3
- Khong mo wave sau neu wave truoc chua chot du artifact
- Uu tien backend gate truoc cum UI co side effect nang
- Dung backend automation anchor de loc nhanh truoc khi quay UI MP4 ton thoi gian

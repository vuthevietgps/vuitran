# Shared Account and Seed Matrix

Cap nhat: `2026-04-09`

## Muc dich

- Tao 1 bo tai khoan va seed canonical dung chung cho backend `test.md` va frontend `testfrontendui.md`.
- Giam drift giua UI va API bang cach dung cung 1 tap role, 1 tap entity seed, 1 quy tac reset va 1 quy tac artifact.
- Phuc vu Wave 0 va cac wave tiep theo trong [fullstack-test-campaign.vi.md](C:/Users/PC/Documents/code/vuitran/qa/plans/fullstack-test-campaign.vi.md).

## Canonical role matrix

- `DIRECTOR`: duyet, xem tong hop, dashboard, financial control, approval.
- `ACCOUNTING`: invoice, wallet, payroll, report, finance read/write theo quyen.
- `OPS`: session, class, attendance, reconciliation, back-office ops.
- `SALE`: lead, order, trial, parent ownership, pipeline.
- `TEACHER`: attendance, teaching report, work session, materials.
- `PARENT`: invoice, attendance, support, notifications, dashboard phu huynh.
- `ADSMANAGER`: ads, landing, chatbot settings, public flow.
- `SHAREHOLDER`: read-only, masked data, investor/dashboard/report visibility.

## Login ownership va cach kiem tra

- Moi role phai co 1 tai khoan canonical va 1 cach dang nhap co the lap lai.
- Dung cung 1 account sheet cho ca UI va API; khong tao tai khoan moi theo tung batch.
- Kiem tra login theo thu tu:
  1. Dang nhap thanh cong
  2. Xac nhan menu/route theo role
  3. Xac nhan API protected endpoint neu batch co side effect
  4. Xac nhan logout/refresh neu case lien quan session
- Neu role bi chan, phai co case doi chieu role khac de chung minh RBAC dung.

## Shared seeded entities

- Parent moi chua co hoc sinh.
- Sale moi chua co du lieu ban hang dang ke.
- Teacher co payroll binh thuong.
- Teacher co payroll `HELD`.
- Offline class co attendance data.
- Lop co substitute teacher.
- Order tra gop.
- Order partial payment.
- Trial student co the convert.
- Session auto-confirm.
- Work session `AUTO_CLOSED`.
- Invoice da approve.
- Top-up pending.
- Refund or complaint ticket chain.
- Lead/landing chain co attribution.
- Chatbot conversation co the tao lead/order.

## Wave-specific extra data

### Wave 1

- Backend:
  - auth baseline
  - trial propagation
  - attendance billing
  - order/invoice/wallet core
- Frontend:
  - app shell
  - auth
  - orders
  - classes/sessions
  - invoices/wallets/payroll core

### Wave 2

- Backend:
  - refunds
  - offline economics
  - reconciliation
  - concurrency
- Frontend:
  - finance advanced
  - dashboards
  - payroll/wallet tails

### Wave 3

- Backend:
  - chatbot tokens
  - CRM
  - landing
  - messages
  - cron/backfill
- Frontend:
  - notifications
  - chatbot
  - tickets
  - ads/public flows

### Wave 4

- Backend:
  - products
  - reports
  - teacher hub
  - work sessions
  - financial control
  - approvals
  - users
- Frontend:
  - teacher hub
  - reports/export/audit
  - users/products/agents
  - dashboard read-only roles

## Reset rules between waves

- Sau moi wave, reset hoac re-seed neu batch co thay doi:
  - wallet
  - ledger
  - invoice
  - order
  - session
  - payroll
  - approval queue
  - conversation/ticket
  - dashboard snapshots
- Khong tiep tuc wave sau neu wave truoc chua chot evidence.
- Neu UI va API dung chung entity, chi co 1 nguon seed canonical cho wave do.
- Neu batch co concurrency hoac idempotency, phai rerun voi cung data baseline, khong dung data da bi mutate sang trang thai khac.

## Artifact folders per day

- Frontend evidence:
  - `frontend-ui-evidence/<YYYY-MM-DD>/`
- Backend runtime logs:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/`
- Backend reports:
  - `qa/reports/backend-api/`
- Frontend reports:
  - `qa/reports/frontend-ui/`
- Workspace logs:
  - `runtime-logs/`
- App test results:
  - `school-mgmt/test-results/`
- App videos/traces:
  - `school-mgmt/test-videos/`

## Go / No-Go checklist

- `GO` neu:
  - login matrix co the dang nhap
  - backend seed xong va smoke pass
  - frontend login/app shell smoke pass
  - artifact folders da tao
  - wave trc khong con blocker P0/P1
- `NO-GO` neu:
  - seed chua on dinh
  - role khong dang nhap duoc
  - backend/env/queue/cron chua san sang
  - frontend backlog count chua duoc chot canonical
  - artifact path chua san sang

## Tester note

- Dung [QA Quickstart](C:/Users/PC/Documents/code/vuitran/qa/QA-QUICKSTART.vi.md) lam entry-point.
- Dung [fullstack campaign plan](C:/Users/PC/Documents/code/vuitran/qa/plans/fullstack-test-campaign.vi.md) de chot wave va thu tu chay.
- Dung file nay nhu 1 source nhan nhanh cho Wave 0, khong thay the checklist goc.

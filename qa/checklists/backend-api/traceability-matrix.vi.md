# Traceability Matrix - Backend API

Ma tran nay map `qa/checklists/backend-api/test.md` sang batch, SOP/playbook, automation anchor va evidence can co khi chay manual/API backend.

## Cach dung

- Doc checklist goc truoc.
- Chon batch theo so nhom trong `test.md`.
- Doc runbook batch, roi doc SOP/playbook lien quan.
- Chay automation anchor tuong ung neu co.
- Luu evidence vao dung thu muc quy dinh.

## Ghi chu ve drift

- So nhom trong `test.md` co the khong trung hoan toan voi ten file automation co lich su.
- Neu group-number drift voi legacy automation filename, uu tien:
  1. runbook batch
  2. SOP mapping
  3. noi dung spec/script thuc te
  4. ten file legacy chi la tham chieu phu
- `group23` va `group24` la legacy runner names duoc tai su dung trong executed campaign:
  - `BA05` la primary owner cua cron/backfill slice nay
  - `BA06` chi overlap rerun de kiem stability sau products/reports
- `BA08` khong dung `group8..12` lam primary anchors; authoritative bundle la `payroll`, `attendance`, `scenario2`, `scenario4` va cac workflow scripts tai chinh/work-session.

## Traceability by batch

| Batch | Checklist scope | Primary domains | Mandatory SOP / playbook | Likely automation anchors | Expected evidence |
| --- | --- | --- | --- | --- | --- |
| BA01 | Groups 1-3 | Cash inflow, orders, invoices, sessions revenue baseline | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`, `school-mgmt/docs/project/mota.md` | `school-mgmt/backend/test/jest-e2e.json` specs around orders, invoices, sessions, financial control; workflow scripts for order/invoice approval and session finalize | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA01_*.md`, `qa/reports/backend-api/summary-*.vi.md`, JUnit or console transcript, snapshot of ledger/wallet/invoice side effects |
| BA02 | Groups 4-7 | OPEX, wallets, refunds, offline economics, payroll impact | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`, `school-mgmt/docs/teacher/KichBanKiemThu_GiaoVien.md` | Jest E2E around opex, wallets, refunds, payroll, attendance; scripts like `test-expenses-workflow`, `test-wallet-topup-workflow`, `test-staff-payroll-workflow`, `test-teacher-payroll-ops-scenarios` | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA02_*.md`, summary report, before/after wallet and ledger trace, payroll preview or refund evidence |
| BA03 | Groups 8-12 | Change requests, reconciliation, capital, concurrency, RBAC, webhooks | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`, `school-mgmt/docs/adsmanager/HuongDanAdsManager_ChiTiet.md` | Jest E2E for change-request, reconciliation, RBAC, state-machine, webhook flows; scripts like `test-rbac-finance-guards`, `test-financial-control-costs`, `test-ads-financial-control-recalculation` | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA03_*.md`, summary report, idempotency proof, concurrency retry log, audit trail |
| BA04 | Groups 13-17 | State machine, limits, agents, class config, chatbot, tickets, notifications | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`, `school-mgmt/docs/adsmanager/HuongDanAdsManager_ChiTiet.md` | Jest E2E for tickets, notifications, chatbot settings, agent flows, class state transitions; scripts around messaging or alerts if present; infra-only `test-redis-webhook-queue-probe.js` for Redis/BullMQ path with `3/3 webhook users persisted` | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA04_*.md`, summary report, state transition snapshots, role-based access evidence |
| BA05 | Groups 18-24 | CRM, landing, messages, cron, backfill, ad-to-revenue funnel | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/guidelines/landing-page-rules.md`, `school-mgmt/docs/project/mota.md` | Executed runner bundle `group18`, `group19`, primary cron/backfill anchors `group23`, `group24`, plus lead/order/message workflow scripts and infra-only `test-redis-webhook-queue-probe.js` with `3/3 webhook users persisted` | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA05_*.md`, summary report, cron run transcript, create/update evidence, message or attribution side effects |
| BA06 | Groups 25-30 | Products, teaching reports, materials, exports, teacher management, students/progress | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`, `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts` | Executed runner bundle `group20`, `group21`, `group22`, overlap rerun `group23`, `group24`, plus teaching/export/teacher workflow scripts | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA06_*.md`, summary report, exported file or JUnit evidence, report payload snapshots |
| BA07 | Groups 31-33 | Auth, trial enrollments, attendance, per-minute billing | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`, `school-mgmt/docs/teacher/KichBanKiemThu_GiaoVien.md` | Jest E2E for auth, login, trial conversion, attendance, billing; scripts around auth guards or trial/session flows | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA07_*.md`, summary report, login/session evidence, trial conversion evidence, attendance pricing trace |
| BA08 | Groups 34-37 | Work sessions, financial control, dashboards, approvals, users | `qa/playbooks/backend-api-sop-mapping.vi.md`, `school-mgmt/docs/project/mota.md`, `school-mgmt/frontend/src/app/components/internal-handbook.configs.ts` | `payroll.e2e`, `attendance.e2e`, `scenario2`, `scenario4`, plus work-session / financial-control / audit workflow scripts | `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA08_*.md`, summary report, dashboard snapshot, approval queue evidence, ownership guard evidence |

## Checklist to evidence mapping

### BA01

- Checklist focus: order approval, invoice approval, trial/zero amount cases, revenue baseline.
- Evidence must show cash inflow, invoice state, wallet or ledger delta, and no premature revenue recognition.

### BA02

- Checklist focus: expense approval, wallet movements, refunds, offline payroll economics.
- Evidence must show before/after balance, refund reversal, audit trail, and payroll side effect or hold.

### BA03

- Checklist focus: change request lifecycle, reconciliation, concurrency, RBAC, webhook impact.
- Evidence must show idempotent behavior, forbidden role checks, audit log, and no duplicate ledger or state entries.

### BA04

- Checklist focus: state transitions, class limits, agents, chatbot, tickets, notifications.
- Evidence must show role-appropriate actions, blocked actions, and notification or ticket creation when expected.

### BA05

- Checklist focus: CRM, landing, message flows, cron jobs, backfill, ad-to-revenue funnel.
- Evidence must show scheduled execution or triggered actions, plus side effects in records or queues.

### BA06

- Checklist focus: products, teaching reports, materials, exports, teacher workflows, students/progress.
- Evidence must show content creation or export output, report payloads, teacher/student propagation, and overlap cron stability only when BA06 reruns `group23/group24`.

### BA07

- Checklist focus: auth, trials, attendance, per-minute billing.
- Evidence must show login/session status, role guard outcomes, trial conversion, and exact billing calculation.

### BA08

- Checklist focus: work sessions, financial control, dashboards, approvals, users.
- Evidence must show time/session state, dashboard aggregates, approval flow, and ownership or isolation checks.

## Recommended evidence paths

- Ad hoc logs: `runtime-logs/backend-api/<YYYY-MM-DD>/`
- Summary reports: `qa/reports/backend-api/`
- Automation outputs: `school-mgmt/test-results/`
- Runtime traces: `school-mgmt/runtime-logs/`

## Sign-off rule

- A batch is not complete unless the runbook, SOP/playbook, automation anchor, and evidence all agree on the same behavior.
- If checklist, runbook, and automation disagree, use the runbook plus SOP mapping to resolve the intended behavior before closing the item.

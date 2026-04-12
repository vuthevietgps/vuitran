# WAVE 1 FRONTEND SUMMARY (2026-04-09)

## Muc dich

- Tong hop ket qua authoritative cho `B01`, `B04`, `B05`, `B07`
- Tach ro run discovery/drift va run dung de chot batch
- Chot batch nao co the gate sang Wave 2, batch nao can triage them

## Scope

- Workspace: `school-mgmt/frontend`
- Ngay: `2026-04-09`
- Mui gio: `UTC+7`

## Bang trang thai nhanh theo batch

| Batch | Muc dich chinh | Status | Ghi chu |
| --- | --- | --- | --- |
| B01 | Login, auth, app shell, RBAC, route gating | PASS | Authoritative `5/5 PASS` sau khi sua fixture shareholder |
| B04 | Leads, orders, trials | PARTIAL_PASS | Orders core + leads core xanh; con blocker `lead -> order orchestration` va trial/chatbot UI chua rerun |
| B05 | Class, session, attendance | PASS | Authoritative `13/13 PASS` |
| B07 | Invoices, wallets, payroll | PARTIAL_PASS | `3/3 PASS` cho slice da chay; nhieu flow finance khac chua run |

## Link den log chi tiet

- `frontend-ui-evidence/2026-04-09/logs/LOG_B01_B04_WAVE1_20260409.md`
- `frontend-ui-evidence/2026-04-09/logs/LOG_B05_WAVE1_20260409.md`
- `frontend-ui-evidence/2026-04-09/logs/LOG_B07_WAVE1_20260409.md`

## Ghi chu batch

### B01

- Run `127.0.0.1` chi dung de discovery, khong dung lam status chinh thuc
- Rerun authoritative tren `http://localhost:4200` + targeted triage dat `5/5 PASS`
- Root cause cua fail duy nhat:
  - shareholder fixture thieu `ownershipPercentage`
- Danh gia:
  - resolved fixture drift
  - khong phai UI regression

### B04

- Orders-heavy authoritative spec:
  - `e2e/specs/scenarios-deep-orders-1-1-to-2-4.spec.ts`
  - Result: `12/12 PASS`
- Leads slice rerun:
  - `e2e/notifications-leads-landing-ui.spec.ts -g "22\."`
  - Result: `14/14 PASS`
- Legacy orders pair after stabilization:
  - `e2e/orders-flow-ui.spec.ts`
  - `e2e/order-auto-calculation-demo-ui.spec.ts`
  - Result: `10/10 PASS`
- Legacy spec drift da duoc giai quyet theo flow UI hien tai:
  - on dinh hoa fixture product
  - bo phu thuoc vao cach chon product ngau nhien
  - doi modal dong han sau submit
- Chua the dong full B04 vi con:
  - `e2e/orchestrator/b04-b05-sales-ops.spec.ts -g "B04 sale order validation, submit, director approval, and invoice creation"` dang fail do `order-item-teacher-0` khong co option khi mo form tu `fromLead`
  - explicit trial-enrollment UI chua rerun
  - chatbot-order-source UI chua rerun

### B05

- Authoritative runs:
  - `e2e/specs/scenarios-deep-sessions-2-1-to-3-4.spec.ts`
  - `e2e/specs/attendance-link-only-teacher.spec.ts`
- Result: `13/13 PASS`
- Danh gia:
  - healthy cho session lifecycle, finalize/refund/RBAC, dissatisfaction, attendance fraud prevention, wallet/payroll cross-check

### B07

- Authoritative run:
  - `e2e/orchestrator/b07-finance-invoices-wallets-payroll.spec.ts`
- Result: `3/3 PASS`
- Coverage da co:
  - approve wallet top-up + ledger delta
  - over-balance transfer block
  - payroll exclude late-report teacher + teacher view `EXCLUDED`
- Chua du coverage de dong full B07 batch

## Drift va risk can theo doi

- Authoritative frontend runs nen dung `http://localhost:4200`; `127.0.0.1` da tao false fail auth/session
- Legacy `orders-flow-ui` fail truoc day la spec drift, khong phai app regression
- B04 blocker hien tai la seeded-state / orchestration drift o flow `fromLead`, khong con la selector drift don thuan

## Ket luan Wave 1 frontend

- `B01` co the dong batch
- `B05` xanh cho slice da chay
- `B07` xanh cho slice da chay, nhung chua du de dong full batch
- `B04` da co evidence xanh rat manh o orders core, leads core, va legacy orders pair, nhung van giu `PARTIAL_PASS` cho den khi chot xong orchestration + trial/chatbot UI

## De xuat tiep theo

1. Triage `b04-b05-sales-ops.spec.ts` tai buoc `order-item-teacher-0` khong co option khi mo form tu `fromLead`
2. Rerun explicit trial UI slice cua `B04`
3. Rerun chatbot-order-source UI slice cua `B04`
4. Neu chua mo Wave 2 frontend ngay, giu `localhost` lam base URL authoritative mac dinh

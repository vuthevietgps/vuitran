# Xac minh cuoi frontend UI 2026-04-08

## Tai lieu nen doc theo thu tu

1. [qa/reports/frontend-ui/error-summary-20260408.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/error-summary-20260408.vi.md)
- Tong hop loi va nguyen nhan truoc khi fix.

2. [qa/reports/frontend-ui/fix-plan-20260408.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/fix-plan-20260408.vi.md)
- Ke hoach fix theo thu tu `helper/harness -> spec drift -> seed -> nghi van san pham`.

3. File nay
- Ket qua xac minh cuoi cung tren workspace chinh sau khi da fix.

## Cac fix da thuc hien

### Frontend e2e / harness

- [api.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/support/api.ts)
  - Cho phep public options object khong co `session`.

- [auth.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/support/auth.ts)
  - Chuan hoa loi `applySessionCookies` tren closed context.

- [scenario-helpers.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/support/scenario-helpers.ts)
  - Dong context tuan tu de giam race artifact.
  - Tang do ben khi seed session trong DB ban.

- [playwright.config.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/playwright.config.ts)
  - Mac dinh `workers=1` de uu tien do tin cay cho batch frontend UI.

### Frontend e2e specs

- [release-gate-ui.spec.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/release-gate-ui.spec.ts)
- [landing-messages-products-ui.spec.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/landing-messages-products-ui.spec.ts)
- [expenses-rbac-ui.spec.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/expenses-rbac-ui.spec.ts)
- [bulk-agents-class-config-ui.spec.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/bulk-agents-class-config-ui.spec.ts)
- [crisis-opex-flow-ui.spec.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/crisis-opex-flow-ui.spec.ts)
- [state-machine-webhooks-ui.spec.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/state-machine-webhooks-ui.spec.ts)
- [b06-b11-followup-ui.spec.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/frontend/e2e/specs/b06-b11-followup-ui.spec.ts)

### Backend fix duoc xac nhan tu frontend UI

- [invoices.service.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/invoices/invoices.service.ts)
- [invoices-approval.service.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/invoices/invoices-approval.service.ts)

Noi dung fix:
- Loai bo pattern `abortTransaction()` hai lan trong flow approve/cancel invoice.
- Loi that duoc frontend UI bat ra:
  - `POST /invoices/:id/cancel` tra `500`
  - Nguyen nhan: `MongoTransactionError: Cannot call abortTransaction twice`

## Ket qua xac minh cuoi cung

Batch da duoc rerun tren workspace chinh:

- `e2e/release-gate-ui.spec.ts`: `5/5 PASS`
- `e2e/landing-messages-products-ui.spec.ts`: `31/31 PASS`
- `e2e/expenses-rbac-ui.spec.ts`: `31/31 PASS`
- `e2e/bulk-agents-class-config-ui.spec.ts`: `32/32 PASS`
- `e2e/crisis-opex-flow-ui.spec.ts`: `15/15 PASS`
- `e2e/state-machine-webhooks-ui.spec.ts`: `36/36 PASS`
- `e2e/specs/b06-b11-followup-ui.spec.ts`: `3/3 PASS`

Tong batch da xac minh truc tiep:
- `153/153 PASS`

## Ket luan

- Nhieu loi ban dau la `helper drift`, `spec drift`, `route/payload/query drift`, va `seed instability`.
- Co `1` loi backend that da duoc frontend UI bat ra va da fix:
  - `invoices cancel` double-abort transaction.
- Sau khi fix, batch triage tren workspace chinh da xanh `153/153`.

## Dong bo tai lieu

- Da sync lai [testfrontendui.md](/C:/Users/PC/Documents/code/vuitran/testfrontendui.md) theo batch xac minh cuoi.
- Da sync lai [qa/reports/frontend-ui/remaining-cases.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/remaining-cases.vi.md) va [EXECUTION-RESULTS-ALL.vi.md](/C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-08/EXECUTION-RESULTS-ALL.vi.md).
- Snapshot sau dong bo: `52 PASS / 202 open`.


# Frontend UI Orchestrator

Thu muc nay chua cac spec Playwright duoc chia theo 4 AI agents cho chien dich UI regression co ghi hinh.

## Nguyen tac

- Moi spec phai bat video o cap file hoac context.
- Moi test flow quan trong phai dung `createBatchEvidenceContext` de sinh:
  - `frontend-ui-evidence/<date>/videos/UI_<BatchID>_..._<YYYYMMDD>.mp4`
  - `frontend-ui-evidence/<date>/logs/LOG_<BatchID>_..._<YYYYMMDD>.md`
- Data seeding uu tien dat trong `beforeAll` / `beforeEach` va tai dung `seedUiOrchestratorFixtures`.
- Can co bang chung cho:
  - loading
  - empty state
  - submit disabled while pending
  - double-click protection
  - RBAC contrast giua 2 roles

## Du kien file

- `b01-b03-system-auth-dashboard.spec.ts`
- `b04-b05-sales-ops.spec.ts`
- `b06-b09-b10-b11-comms-ads-reports.spec.ts`
- `b07-b08-finance-wallets.spec.ts`

## Chay rieng

```powershell
npx playwright test -c playwright.config.ts e2e/orchestrator
```

# Frontend UI Orchestrator - 2026-04-08

## Muc tieu

Tai lieu nay chot prompt, ownership va nguyen tac thuc thi cho 4 AI agents xu ly cac batch UI con lai trong du an `school-mgmt`.

## Core Directives Chung

Tat ca agent phai tuan thu cac quy tac sau khi viet Playwright automation:

1. Moi flow co side-effect phai co 4 bang chung:
   - truoc thao tac
   - trong luc loading / submit
   - sau khi man hinh goc thay doi
   - sau khi di sang it nhat 1 man hinh lien doi de xac nhan data da chay den dich
2. Trong moi flow phai long ghep kiem tra Nhom 12:
   - loading state
   - empty state
   - submit button bi disabled khi dang xu ly
   - chong double-click / double-submit
3. Moi nut nhay cam phai co RBAC contrast:
   - role duoc phep nhin thay va thao tac
   - role khong duoc phep bi an hoac bi khoa
4. Moi batch phai sinh artifact theo mau:
   - `frontend-ui-evidence/<date>/videos/UI_<BatchID>_..._<YYYYMMDD>.mp4`
   - `frontend-ui-evidence/<date>/logs/LOG_<BatchID>_..._<YYYYMMDD>.md`
5. Data seeding uu tien dat trong `beforeAll` hoac `beforeEach`, tai su dung `seedUiOrchestratorFixtures`.

## Agent Ownership

### Agent 1 - Finance and Wallets

- File so huu: `frontend/e2e/orchestrator/b07-b08-finance-wallets.spec.ts`
- Batch: `B07`, `B08`
- Roles: `ACCOUNTING`, `DIRECTOR`, `SHAREHOLDER`
- Trong tam:
  - top-up -> ledger
  - payroll held / exclude / min payout guarantee
  - invoice approved khong duoc xoa
  - reconciliation matched / unmatched + reject reason validation
  - shareholder read-only tren financial control

### Agent 2 - Sales and Ops Core

- File so huu: `frontend/e2e/orchestrator/b04-b05-sales-ops.spec.ts`
- Batch: `B04`, `B05`
- Roles: `SALE`, `OPS`, `TEACHER`, `PARENT`
- Trong tam:
  - discount > total block save
  - lead -> order -> approve -> invoice + student linkage
  - teacher swap margin shrinking warning
  - teacher attendance chi duoc tao link, khong save truc tiep
  - debt limit breach khi finalize session

### Agent 3 - System, Auth, Dashboard

- File so huu: `frontend/e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts`
- Batch: `B01`, `B02`, `B03`
- Roles: tat ca roles, uu tien chuyen role
- Trong tam:
  - brute-force lockout + 401 redirect ve `/login`
  - dashboard / handbook / sidebar theo 8 roles
  - pending approvals badge giam dong bo
  - deactivate product -> sale order dropdown khong con item
  - multiple parents linked to one student sau reload van dung

### Agent 4 - Comms, Ads, Reports

- File so huu: `frontend/e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts`
- Batch: `B06`, `B09`, `B10`, `B11`
- Roles: `ADSMANAGER`, `DIRECTOR`, `TEACHER`, `OPS`
- Trong tam:
  - chatbot token masking + sourceConversationId
  - ads analytics cohort profit vs parent profit + trigger sync toast
  - teacher hub submit report + inline edit khong mat field khac
  - export CSV kiem tra UTF-8 BOM
  - overdue ticket hien highlight do tren dashboard OPS

## Shared Seeding Contract

Tat ca agent duoc phep mo rong seeding, nhung toi thieu phai co:

- 1 parent moi chua co hoc sinh
- 1 parent da het tien vi
- 1 order tra gop
- 1 order partial / installment de test split payment
- 1 teacher co session dung cho flow payroll blocked
- 1 lop co teacher chinh va teacher substitute

## Shared Support

Tat ca agent nen uu tien dung helper trong `frontend/e2e/support`:

- `createBatchEvidenceContext`
- `seedUiOrchestratorFixtures`
- `expectUiStateEnvelope`
- `expectEmptyStateOrTable`
- `expectRoleContrast`
- `generateAttendanceLinkAndSubmit`
- `openRolePage`

## Integration Notes

- Moi agent chi sua file duoc giao.
- Khong revert thay doi cua nguoi khac.
- Neu gap UI branch khong ton tai, duoc phep de assertion phong thu va comment ngan giai thich.
- Muc tieu cua orchestration la co spec compile-friendly, co video/log naming chuan va de tiep tuc mo rong batch sau.

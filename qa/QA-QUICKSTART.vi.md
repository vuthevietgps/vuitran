# QA Quickstart

Day la diem vao nhanh cho luong QA trong workspace nay.
Muc tieu la chon dung quick path, dung dung thu tu doc, va khong ket luan PASS khi chua doi soat side effect.

Neu chay chien dich ca `test.md` va `testfrontendui.md`, doc them:

- `qa/plans/fullstack-test-campaign.vi.md`
- `qa/plans/shared-account-seed-matrix.vi.md`
- `qa/plans/shared-account-sheet.vi.md`

## Bat dau o dau

### Neu test Frontend UI

1. Doc checklist goc: `qa/checklists/frontend-ui/testfrontendui.md`
2. Doc plan tong: `qa/plans/frontend-ui/master-test-plan.vi.md`
3. Doc canonical backlog cho Wave 0: `qa/reports/frontend-ui/backlog-canonical.vi.md`
4. Doc account sheet chung: `qa/plans/shared-account-sheet.vi.md`
5. Chon batch trong: `qa/runbooks/frontend-ui/`
6. Doi chieu evidence va execution pack: `frontend-ui-evidence/<YYYY-MM-DD>/`
7. Neu can hieu nghiep vu truoc khi ket luan, doc: `qa/playbooks/README.vi.md`

### Neu test Backend API

1. Doc checklist goc: `qa/checklists/backend-api/test.md`
2. Doc traceability matrix: `qa/checklists/backend-api/traceability-matrix.vi.md`
3. Doc rulebook tong: `qa/plans/backend-api/master-test-plan.vi.md`
4. Doc account sheet chung: `qa/plans/shared-account-sheet.vi.md`
5. Doc execution checklist theo dot trong: `qa/plans/backend-api/`
6. Doc SOP mapping: `qa/playbooks/backend-api-sop-mapping.vi.md`
7. Chon batch trong: `qa/runbooks/backend-api/`
8. Doi chieu automation anchor: `school-mgmt/backend/test/` va `school-mgmt/backend/scripts/`
9. Neu can prove Redis/BullMQ queue path tren backend Redis-on:
   - dat `TEST_API_BASE` tro vao backend dang chay voi `REDIS_ENABLED=true`
   - uu tien backend one-shot `node dist/main.js` thay vi watch mode
   - chay `npm run test:redis-webhook-queue-probe`
   - probe hien phai prove `3/3 webhook users persisted`, khong chi queue liveness

## Thu tu doc bat buoc

1. `qa/README.vi.md`
2. Checklist goc cua luong can chay
3. Plan tong cua luong do
4. Runbook batch tuong ung
5. SOP / playbook neu co nghiep vu tai chinh, payroll, ads, RBAC, reconciliation
6. Evidence / log / report canonical

## Canonical paths

### Frontend UI

- Manual evidence: `frontend-ui-evidence/`
- Runtime logs: `runtime-logs/frontend-ui/`
- Reports: `qa/reports/frontend-ui/`
- Execution packs: `frontend-ui-evidence/<YYYY-MM-DD>/EXECUTION-PACK.vi.md`
- Playwright output: `school-mgmt/test-results/` va `school-mgmt/test-videos/`

### Backend API

- Ad hoc logs: `runtime-logs/backend-api/`
- Summary reports: `qa/reports/backend-api/`
- Plans and checkpoints: `qa/plans/backend-api/`
- Runbooks: `qa/runbooks/backend-api/`
- Automation output: `school-mgmt/test-results/`

## Truoc khi mark PASS

- Co precondition ro rang va dung seed / role / env.
- Co command da chay va output co the trac lai.
- Co doi soat before / action / after cho flow co side effect.
- Co it nhat 1 evidence ro rang: log, screenshot, video, JUnit, hoac report.
- Co role guard doi chieu neu case lien quan RBAC.
- Khong co doc drift, automation drift, hoac env blocker chua ghi nhan.
- Neu chi co HTTP 200 ma chua doi soat data, khong mark PASS.

## Nho nhanh

- `What to test`: checklist
- `How to test`: plan, runbook, evidence
- `Why it behaves that way`: playbook / SOP
- `What proves it passed`: report, log, artifact

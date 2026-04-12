# QA Hub

Thu muc `qa/` la diem vao chinh cho tai lieu kiem thu trong workspace nay.

## Bat dau nhanh

- Entry-point 1 trang: `qa/QA-QUICKSTART.vi.md`
- So do tong quan: `qa/qa-flow-map.vi.md`
- Campaign hop nhat UI + API: `qa/plans/fullstack-test-campaign.vi.md`
- Wave 0 account/seed matrix: `qa/plans/shared-account-seed-matrix.vi.md`
- Wave 0 account sheet: `qa/plans/shared-account-sheet.vi.md`
- Frontend backlog canonical: `qa/reports/frontend-ui/backlog-canonical.vi.md`

## Neu test Frontend UI

1. Doc checklist goc: `qa/checklists/frontend-ui/testfrontendui.md`
2. Doc plan tong: `qa/plans/frontend-ui/master-test-plan.vi.md`
3. Chon batch trong `qa/runbooks/frontend-ui/`
4. Ghi evidence vao `frontend-ui-evidence/<YYYY-MM-DD>/`
5. Neu can hieu nghiep vu truoc khi ket luan, doc `qa/playbooks/README.vi.md`

## Neu test Backend API

1. Doc checklist goc: `qa/checklists/backend-api/test.md`
2. Doc traceability matrix: `qa/checklists/backend-api/traceability-matrix.vi.md`
3. Doc rulebook tong: `qa/plans/backend-api/master-test-plan.vi.md`
4. Doc execution checklist theo dot trong `qa/plans/backend-api/`
5. Doc SOP mapping: `qa/playbooks/backend-api-sop-mapping.vi.md`
6. Chon batch trong `qa/runbooks/backend-api/`
7. Doi chieu automation anchor trong `school-mgmt/backend/test/` va `school-mgmt/backend/scripts/`

## Cac lop tai lieu

- `checklists/`: what to test
- `plans/`: how to test
- `runbooks/`: batch chay thuc te
- `playbooks/`: SOP va nghiep vu de tranh false positive
- `reports/`: summary, triage, sign-off
- `artifacts/`: quy uoc artifact canonical

## Canonical paths

- Frontend UI evidence: `frontend-ui-evidence/`
- Backend API ad hoc logs: `runtime-logs/backend-api/`
- Backend API summary reports: `qa/reports/backend-api/`
- Workspace runtime logs: `runtime-logs/`
- Automation results cua app: `school-mgmt/test-results/`
- Automation videos/traces cua app: `school-mgmt/test-videos/`
- App runtime logs: `school-mgmt/runtime-logs/`

## Luat sign-off

- Khong mark `PASS` chi vi HTTP `200` hoac toast thanh cong.
- Flow co side effect phai co `before -> action -> after`.
- Case lien quan RBAC phai co role duoc phep va role bi chan.
- Luong tai chinh, payroll, ads, reconciliation phai doc playbook/SOP truoc khi ket luan bug.
- Moi ket luan `FAIL` hoac `BLOCKED` phai chi ro du lieu, env, hoac doc drift.

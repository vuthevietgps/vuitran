# Backend API SOP Mapping

## Muc tieu

File nay map tung batch backend voi:

- checklist groups
- SOP/playbook bat buoc phai doc
- nguon doi chieu phu
- role trong tam
- automation anchor chinh

Neu expected behavior chua ro trong checklist, dung file nay de biet phai doc tai lieu nao truoc khi ket luan bug.

## Nguon SOP chuan

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`
- `school-mgmt/docs/teacher/KichBanKiemThu_GiaoVien.md`
- `school-mgmt/docs/adsmanager/HuongDanAdsManager_ChiTiet.md`
- `school-mgmt/docs/guidelines/landing-page-rules.md`
- `school-mgmt/docs/project/mota.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`
- `school-mgmt/frontend/src/app/components/internal-handbook.configs.ts`

## Ghi chu drift quan trong

- Checklist groups luon bam theo `qa/checklists/backend-api/test.md`.
- Automation anchors bam theo file runner hien co trong `school-mgmt/backend/test/` va `school-mgmt/backend/scripts/`.
- Tu vung `25-37`, mot so anchors lich su khong trung so nhom checklist. Khi co xung dot, uu tien:
  1. runbook batch
  2. SOP mapping nay
  3. noi dung spec/script thuc te
- `group23` va `group24` hien la shared cron anchors duoc tai su dung boi `BA05` va `BA06`.
- Trong executed campaign hien tai:
  - `BA05` la primary owner cua slice `group23/group24`
  - `BA06` chi overlap rerun `group23/group24` de xac nhan cron/backfill stability sau products/reports
- Voi `BA08`, uu tien bundle trong runbook `BA08`; khong coi `group8..12` la primary anchors cho checklist `34-37`.

## Mapping theo batch

| Batch | Checklist groups | SOP/playbook bat buoc | Nguon doi chieu phu | Role trong tam | Automation anchor chinh |
| --- | --- | --- | --- | --- | --- |
| `BA01` | `1-3` | `operations`, `project/mota`, `internal-handbook.*` | `school-mgmt/README.md` | `DIRECTOR`, `ACCOUNTING`, `SALE`, `OPS`, `PARENT` | `group1..3`, `orders-deep-review`, `order-enrollment-scenarios`, `scenario2`, `scenario3`, `test-invoices-workflow.js`, `test-sessions-workflow.js` |
| `BA02` | `4-7` | `operations`, `teacher guide`, `internal-handbook.playbooks.ts` | `project/mota` | `ACCOUNTING`, `DIRECTOR`, `OPS`, `PARENT`, `TEACHER` | `group4..7`, `payroll.e2e`, `scenario4`, `test-expenses-workflow.js`, `test-wallet-topup-workflow.js`, `test-staff-payroll-workflow.js` |
| `BA03` | `8-12` | `operations`, `project/mota`, `internal-handbook.*` | `school-mgmt/README.md` | `DIRECTOR`, `ACCOUNTING`, `OPS`, `SALE`, `SHAREHOLDER` | `group8..12`, `security-rbac.e2e`, `data-isolation-rbac.e2e`, `test-rbac-finance-guards.js`, `test-financial-control-costs.ts` |
| `BA04` | `13-17` | `operations`, `adsmanager`, `teacher guide`, `internal-handbook.playbooks.ts` | `project/mota` | `DIRECTOR`, `OPS`, `SALE`, `ACCOUNTING`, `ADSMANAGER`, `PARENT` | `group13..17`, `supplier-agents.e2e`, `test-chatbot-settings-workflow.js`, `test-tickets-workflow.js`, infra-only `test-redis-webhook-queue-probe.js` with `3/3 webhook users persisted` on Redis-on backend |
| `BA05` | `18-24` | `operations`, `adsmanager`, `landing-page-rules`, `internal-handbook.playbooks.ts` | `project/mota` | `DIRECTOR`, `OPS`, `SALE`, `ADSMANAGER`, `PARENT` | `group18`, `group19`, primary cron/backfill anchors `group23`, `group24`, `test-e2e-ad-to-revenue.js`, `test-messages-workflow.js`, `test-conversations-workflow.js`, `test-tickets-workflow.js`, infra-only `test-redis-webhook-queue-probe.js` with `3/3 webhook users persisted` on Redis-on backend |
| `BA06` | `25-30` | `teacher guide`, `teacher test scenarios`, `operations`, `internal-handbook.playbooks.ts` | `project/mota` | `DIRECTOR`, `OPS`, `ACCOUNTING`, `SALE`, `TEACHER`, `PARENT` | `group20`, `group21`, `group22`, overlap rerun anchors `group23`, `group24`, `test-teaching-report-workflow.js`, `test-teaching-materials-workflow.js`, `test-teacher-profiles-workflow.js`, `test-teacher-kpi-workflow.js`, `test-employee-performance-workflow.js`, `test-student-report-workflow.js`, `test-export-reports-workflow.js` |
| `BA07` | `31-33` | `operations`, `teacher guide`, `teacher test scenarios`, `internal-handbook.playbooks.ts` | `school-mgmt/README.md` | `DIRECTOR`, `SALE`, `OPS`, `TEACHER`, `PARENT` | `security-rbac.e2e`, `data-isolation-rbac.e2e`, `trial-enrollment-conversion.e2e`, `trial-order-propagation.e2e`, `attendance.e2e`, `test-attendance-workflow.js` |
| `BA08` | `34-37` | `operations`, `project/mota`, `internal-handbook.*` | `school-mgmt/README.md` | `DIRECTOR`, `ACCOUNTING`, `OPS`, `SALE`, `TEACHER`, `PARENT`, `SHAREHOLDER` | `payroll.e2e`, `attendance.e2e`, `scenario2`, `scenario4`, `test-work-sessions-workflow.js`, `test-financial-control-workflow.js`, `test-financial-control-payroll.ts`, `test-financial-control-payroll-recalculation.ts`, `test-financial-control-loans.ts`, `test-attendance-payroll-financial-control.ts`, `test-audit-log-workflow.js` |

## Quy tac xu ly khi SOP chua du

1. Mo checklist group tuong ung trong `test.md`.
2. Mo runbook batch lien quan.
3. Mo automation anchor gan nhat.
4. Doc source code hoac contract o module backend lien quan.
5. Neu van mo ho, ghi `BLOCKED-DOC` trong log batch.

## Khoang trong tai lieu hien tai

- Chua co handbook backend rieng cho:
  - work sessions
  - financial control chi tiet theo tung tab
  - pending approvals/users o goc nhin backend-only
- Voi cac nhom nay, tam thoi dung:
  - `test.md`
  - workflow scripts
  - `internal-handbook.*`
  - `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`

## Khuyen nghi khi mo bug

- Luon ghi ro batch va group checklist.
- Luon dinh kem `SOP source` da dung de suy ra expected behavior.
- Neu bug mau thuan voi SOP cu nhung phu hop automation moi, mo issue dang `DOC DRIFT` thay vi `PRODUCT BUG`.

# Template summary backend test dot BA04 -> BA05

## Thong tin chung

- Ngay chay: `YYYY-MM-DD`
- Dot: `BA04 -> BA05`
- Truong du an: `school-mgmt/backend`
- Duong dan dot log ky thuat: `runtime-logs/backend-api/<YYYY-MM-DD>/`
- Nguoi thuc hien: ``
- Nguoi kiem soat (neu co): ``
- Tong thoi gian chay: `HH:MM`
- Muc tieu dot: `BA04 pass -> BA05`

## Nguon tham chieu

- Checklist goc: `qa/checklists/backend-api/test.md`
- Master test plan: `qa/plans/backend-api/master-test-plan.vi.md`
- Execution checklist lien quan: `qa/plans/backend-api/`
- Rulebook batch: `qa/playbooks/backend-api-sop-mapping.vi.md`
- Runbook:
  - `qa/runbooks/backend-api/BA04-State-Limits-Agents-Class-Chatbot.vi.md`
  - `qa/runbooks/backend-api/BA05-CRM-Landing-Messages-Cron.vi.md`
- Runtime log:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA04_State_Limits_Agents_Class_Chatbot_<YYYYMMDD>.md`
  - `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA05_CRM_Landing_Messages_Cron_<YYYYMMDD>.md`
- Du lieu automation/test output:
  - `school-mgmt/test-results/`
  - `school-mgmt/test/jest-e2e.json`
  - `school-mgmt/test/jest-unit.json`

## Go / No-Go tong the

- Quyet dinh: `GO / NO-GO`
- Ly do cho quyet dinh:
- Tinh trang dieu kien de mo BA05:
  - `Dat` / `Khong`
- Tinh trang dieu kien chot dot:
  - `Dat` / `Khong`

## Batch BA04 - State, Limits, Agents, Class Config, Chatbot

### Muc tieu

- Kiem tra state machine, gioi han bulk/limit, agent flow, class config, chatbot webhook, ticket va notification.
- Dam bao BA04 khong con fail P0/P1 lien quan state reversal, bulk side effect, hoac webhook mutation sai.

### Commands da chay

- ``
- ``
- ``

### Seed / vai tro da dung

- ``
- ``

### Ket qua thuc te

- Thoi gian bat dau: ``
- Thoi gian ket thuc: ``
- Tong hop ket qua:
  - `PASS: x`
  - `FAIL: x`
  - `SKIP: x`
  - `BLOCK: x`
- Chi tiet fail/skip quan trong:

### Items that can close now (chuan dong ngay)

- [ ] item code: mo ta
- [ ] item code: mo ta
- [ ] item code: mo ta

### Tested but not enough (chua du dieu kien dong)

- [ ] item code: tai sao test chua du
- [ ] item code: tai sao can mo rong

### Blocked / Environments

- [ ] ENV issue: ``
- [ ] Data/seed issue: ``
- [ ] API dependency issue: ``
- [ ] Test infra issue: ``

### Doc drift / automation drift

- `DOC DRIFT`: ``
- `AUTOMATION DRIFT`: ``
- `SPEC DRIFT`: ``
- `SCRIPT DRIFT`: ``

### Quyet dinh sau BA04

- Go/No-Go BA05: `GO / NO-GO`
- Dieu kien bat buoc de tiep tuc BA05:
  - ``
  - ``

## Batch BA05 - CRM, Landing, Messages, Cron

### Muc tieu

- Kiem tra CRM pipeline, landing submit, messages, notifications, cron va backfill.
- Dam bao BA05 khong con fail P0/P1 lien quan source tracking, duplicate cron, hoac message side effect sai.

### Commands da chay

- ``
- ``
- ``

### Seed / vai tro da dung

- ``
- ``

### Ket qua thuc te

- Thoi gian bat dau: ``
- Thoi gian ket thuc: ``
- Tong hop ket qua:
  - `PASS: x`
  - `FAIL: x`
  - `SKIP: x`
  - `BLOCK: x`
- Chi tiet fail/skip quan trong:

### Items that can close now (chuan dong ngay)

- [ ] item code: mo ta
- [ ] item code: mo ta

### Tested but not enough (chua du dieu kien dong)

- [ ] item code: tai sao test chua du
- [ ] item code: tai sao can mo rong

### Blocked / Environments

- [ ] ENV issue: ``
- [ ] Data/seed issue: ``
- [ ] API dependency issue: ``
- [ ] Test infra issue: ``

### Doc drift / automation drift

- `DOC DRIFT`: ``
- `AUTOMATION DRIFT`: ``
- `SPEC DRIFT`: ``
- `SCRIPT DRIFT`: ``

### Quyet dinh cuoi dot

- BA04 -> BA05 dat dieu kien chot: `Dat / Khong`
- Vi tri can luu y:
- Kiem tra lai tren:
  - ``
  - ``

## Tong hop dong

- Can close trong test.md ngay bay gio:
  - ``
- Canh bao can lam sau:
  - ``
- P0/P1 con de trong dot nay:
  - ``

## Final sign-off

- Status tong: `PASS / FAIL / BLOCKED`
- Dot co du dieu kien bao cao cho review tiep theo: `Yes / No`
- Nhan xet ngan (1-3 dong):
- Nguoi ghi:
- Nguoi duyet:
- Thoi gian duyet: ``

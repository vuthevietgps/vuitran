# Checklist thuc thi backend API - Dot 3

Cap nhat: `2026-04-09`

Giai doan dot tiep theo chay theo thu tu:

- `BA04`
- `BA05`

Nguon doi soat:

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\backend-api\test.md`
- Rulebook tong: `C:\Users\PC\Documents\code\vuitran\qa\plans\backend-api\master-test-plan.vi.md`
- SOP mapping: `C:\Users\PC\Documents\code\vuitran\qa\playbooks\backend-api-sop-mapping.vi.md`
- Runbook batch:
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA04-State-Limits-Agents-Class-Chatbot.vi.md`
  - `C:\Users\PC\Documents\code\vuitran\qa\runbooks\backend-api\BA05-CRM-Landing-Messages-Cron.vi.md`

## 1. Muc tieu va nguyen tac

- Muc tieu cua dot nay: chay `BA04 -> BA05` thanh 1 lan chay co the lay `go/no-go` ro rang.
- `BA04` la gate cho `BA05` vi `BA05` phu thuoc vao state, limit, agent, class config, chatbot, ticket va notification snapshot.
- Moi case write phai co:
  - `before -> action -> after`
  - it nhat 2 layer side effect cho luong state/CRM/cron
- Moi case RBAC/guard phai co:
  - `positive role`
  - `negative role`
  - `forbidden/blocked` khi co endpoint
- Log ky thuat o:
  - `C:\Users\PC\Documents\code\vuitran\runtime-logs\backend-api\<YYYY-MM-DD>\`
- Summary dot o:
  - `C:\Users\PC\Documents\code\vuitran\qa\reports\backend-api\`

## 2. Session 0 - Preflight cho dot 3

### Muc tieu

- Kich hoat moi truong da du dieu kien cho `BA04` va `BA05`.
- Dam bao khong co seed drift moi tao false positive.

### Checklist preflight

- [ ] `npm ci` trong `school-mgmt/backend`
- [ ] Xac nhan `.env` da dung va ket noi DB duoc
- [ ] Chay:
  - `node scripts/seed-all.js`
  - `node scripts/ensure-commercial-admin.js`
- [ ] Xac nhan vai tro ton tai:
  - `DIRECTOR`
  - `ACCOUNTING`
  - `OPS`
  - `SALE`
  - `PARENT`
  - `TEACHER`
  - `ADSMANAGER`
- [ ] Chuan bi du lieu cho `BA04`:
  - 1 state machine sample
  - 1 limit/quota sample
  - 1 agent/class config sample
  - 1 chatbot/token/webhook sample
- [ ] Chuan bi du lieu cho `BA05`:
  - 1 CRM/lead sample
  - 1 landing form/source sample
  - 1 message/conversation sample
  - 1 cron/backfill sample
- [ ] Tao thu muc log dot:
  - `runtime-logs/backend-api/<YYYY-MM-DD>/`
- [ ] Chay smoke toi thieu:
  - `npx jest --config test/jest-e2e.json test/group13-bulk-agents.e2e-spec.ts --runInBand`
  - `npx jest --config test/jest-e2e.json test/security-rbac.e2e-spec.ts --runInBand`

### Dieu kien vao BA04

- Backend chay on dinh, seed thanh cong.
- Nhom tai khoan test dang nhap duoc.
- Smoke E2E co the chay ma khong bi loi infra hoac data drift tong the.

## 3. Batch A - BA04 State, Limits, Agents, Class Config, Chatbot

### Pham vi

- `Nhom 13`
- `Nhom 14`
- `Nhom 15`
- `Nhom 16`
- `Nhom 17`

### Muc tieu

- Kiem tra state machine, gioi han bulk/limit, agent flow, class config, chatbot webhook, ticket va notification.
- Dam bao BA04 khong con fail P0/P1 lien quan state reversal, bulk side effect, hoac webhook mutation sai.

### Checklist uu tien

- State transition valid/invalid
- Bulk/limit/rate behavior
- Agent/supplier/class config
- Chatbot settings/token/webhook
- Tickets/notifications side effect

### Lenh uu tien de chay

- BA04 E2E:
  - `npx jest --config test/jest-e2e.json test/group13-bulk-agents.e2e-spec.ts test/group14-class-config.e2e-spec.ts test/group15-webhooks-chatbot.e2e-spec.ts test/group16-tickets-maintenance.e2e-spec.ts test/group17-notifications.e2e-spec.ts --runInBand`
- BA04 workflow scripts:
  - `node scripts/test-chatbot-settings-workflow.js`
  - `node scripts/test-tickets-workflow.js`
  - `node scripts/test-commission-report-workflow.js`

### Doi soat bat buoc

- `State transition -> audit log`
- `Bulk action -> target list -> audit log -> pending/notification neu co`
- `Webhook/chatbot -> conversation/ticket/lead/order side effect`
- `Agent/supplier/class config -> detail -> list -> financial/report neu co`
- `Expired/rate-limited token -> clear error code -> no dirty side effect`

### Ket qua mong muon

- Co bang ro item nao cua `Nhom 13-17`:
  - `co the dong ngay`
  - `da test nhung chua du bang chung`
  - `blocked`
  - `need doc clarification`

### Dieu kien stop som

- State reversal bi whitelist lot
- Bulk action bao thanh cong nhung thieu mot phan side effect
- Webhook ack `200` nhung van gay mutation sai
- Agent/class config doi xong nhung khong lan sang resource lien quan

### Dieu kien qua BA05

- Khong con fail P0/P1 mo trong state/limit/agent/chatbot flow do nen he thong.
- CRM/landing/messages/cron co the doc tu BA04 ma khong vo nen.

## 4. Batch B - BA05 CRM, Landing, Messages, Cron

### Pham vi

- Primary checklist ownership: `Nhom 18-24`
- Authoritative BA05 runner bundle: `group18`, `group19`, `group23`, `group24`
- Luu y:
  - `group23/group24` la legacy runner filenames.
  - Checklist `Nhom 20-22` van thuoc BA05 planning ownership, nhung khong co suite ten-trung trong executed bundle va phai doi chieu qua runbook, SOP, va workflow scripts.

### Muc tieu

- Kiem tra CRM pipeline, landing submit, messages, notifications, cron va backfill.
- Dam bao BA05 khong con fail P0/P1 lien quan source tracking, duplicate cron, hoac message side effect sai.
- Bao toan boundary: BA05 la primary owner cua cron/backfill slice duoc dai dien boi `group23/group24` trong legacy automation naming.

### Checklist uu tien

- Conversation -> lead/order/ticket
- Landing submit -> source tracking
- Message list/history/unread
- Cron/backfill idempotency
- Queue/realtime notification side effect

### Lenh uu tien de chay

- BA05 E2E:
  - `npx jest --config test/jest-e2e.json test/group18-leads-crm.e2e-spec.ts test/group19-landing-messages.e2e-spec.ts test/group23-cron-notifications-sessions.e2e-spec.ts test/group24-cron-retry-backfill.e2e-spec.ts --runInBand`
- BA05 workflow scripts:
  - `node scripts/test-e2e-ad-to-revenue.js`
  - `node scripts/test-messages-workflow.js`
  - `node scripts/test-conversations-workflow.js`
  - `node scripts/test-tickets-workflow.js`

Luu y executed bundle:

- `group23/group24` la shared cron carry-over anchors do BA05 so huu chinh trong planning layer.
- Checklist items `Nhom 20-22` khong doi ten-thang sang suite E2E, va phai dong qua runbook, SOP, workflow scripts, cung side-effect evidence cua cung dot.

### Doi soat bat buoc

- `Conversation -> Lead/Order/Ticket`
- `Landing submit -> Lead -> Attribution/source`
- `Cron/backfill -> list -> summary -> idempotent rerun`
- `Notification/message -> unread count/list/history`

### Ket qua mong muon

- Co bang ro item nao cua `Nhom 18-24`:
  - `co the dong ngay`
  - `da test nhung chua du bang chung`
  - `blocked`
  - `need doc clarification`

### Dieu kien stop som

- Lead/order duoc tao nhung mat source tracking
- Queue/websocket tra `200` nhung khong cap nhat conversation list
- Cron chay lan dau dung nhung rerun tao duplicate
- Ticket closed-loop khong keo theo side effect dung

### Dieu kien qua BA05

- `BA05` co ket qua on dinh, khong co P0/P1 fail.
- Audit trail, source tracking va cron idempotency ro rang.

## 5. Thu tu chay khuyen nghi trong dot 3

1. `Session 0 - Preflight`
2. `BA04 - State/Limits/Agents/Class Config/Chatbot`
3. Chot `go/no-go` sau `BA04`
4. Neu `GO`, mo `BA05 - CRM/Landing/Messages/Cron`
5. Chot summary dot 3

## 6. Dung ket qua va stop condition

- Dung ngay bat ky dot hoac batch neu:
  - co fail P0/P1 tai luong state, CRM, webhook, notification, hoac cron
  - co doc drift that su can sua checklist truoc khi ket luan
  - seed/role env khong the dung de tao du lieu phep test tiep

## 7. Dau ra bat buoc cua dot 3

- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA04_State_Limits_Agents_Class_Chatbot_<YYYYMMDD>.md`
- `runtime-logs/backend-api/<YYYY-MM-DD>/LOG_BA05_CRM_Landing_Messages_Cron_<YYYYMMDD>.md`
- `qa/reports/backend-api/summary-<YYYYMMDD>.vi.md`

Neu `BA04 -> BA05` dat va du dieu kien chot:

- `qa/reports/backend-api/final-verification-<YYYYMMDD>.vi.md`

## 8. Mau bao cao bat buoc

Moi batch phai co:

1. `Commands run`
2. `Seed and roles`
3. `Results`
4. `Checklist items can close now`
5. `Tested but not enough to close`
6. `Blocked / env issues`
7. `Doc drift or automation drift`
8. `Go/No-Go for next batch`

Mau ngan:

```md
Batch:
Commands:
- ...

Seed and roles:
- ...

Results:
- spec-a: PASS
- script-b: FAIL

Can close now:
- ...

Tested but not enough:
- ...

Blocked/env:
- ...

Doc drift / automation drift:
- ...

Go/No-Go:
- GO BA05
```

## 9. Ghi chu

- Chi main agent xac nhan item du dieu kien dong trong `qa/checklists/backend-api/test.md`.
- Neu `BA04` fail o state/limit/webhook/chatbot, stop tai `BA04`.
- Neu `BA05` co fail `DOC DRIFT` nhung luong co the mo hoac test tiep bang dieu kien moi, co the tiep tuc `BA05` voi dieu kien ghi ro.

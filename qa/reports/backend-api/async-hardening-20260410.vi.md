# Async Hardening 20260410

## Verdict

`GO`

Redis/BullMQ webhook queue path da duoc chung minh tren backend Redis-on sau khi sua [webhook.controller.ts](/C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/src/chatbot/webhook.controller.ts).

## Canonical evidence

- Runtime log: [LOG_ASYNC_REDIS_BULLMQ_HARDENING_20260410.md](/C:/Users/PC/Documents/code/vuitran/runtime-logs/backend-api/2026-04-10/LOG_ASYNC_REDIS_BULLMQ_HARDENING_20260410.md)
- Infra probe: [test-redis-webhook-queue-probe.js](/C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/scripts/test-redis-webhook-queue-probe.js)

## What was proven

- Redis container thuc su chay va reachable tren `127.0.0.1:6379`
- Backend Redis-on tren `http://localhost:3003` xu ly webhook qua BullMQ thay vi sync fallback
- Queue evidence co `added -> waiting -> active -> completed`
- Sau queue processing:
  - `conversation` duoc tao
  - `customer message` duoc persist
- Sau patch, `test-conversations-workflow.js` cung xanh tren cung Redis-on runtime

## Authoritative probe result

- Command:

```powershell
$env:TEST_API_BASE='http://localhost:3003'
$env:REDIS_ENABLED='true'
$env:REDIS_HOST='127.0.0.1'
$env:REDIS_PORT='6379'
node scripts/test-redis-webhook-queue-probe.js
```

- Result:
  - `before id=12 events=52`
  - `after id=14 events=60`
  - `Persisted 3/3 webhook users`
  - `fb-queue-probe-msg-* -> conversationId=69d8460afeb441f4ad53d1c9`
  - `fb-queue-probe-lead-* -> conversationId=69d8460a43bdd22c02b033ec`
  - `fb-queue-probe-order-* -> conversationId=69d8460a43bdd22c02b033f8`

## Authoritative business follow-up

- Command:

```powershell
$env:TEST_API_BASE='http://localhost:3003'
node scripts/test-conversations-workflow.js
```

- Result:
  - `PASS | STEP 1 | Webhook creates three conversations with ad attribution`
  - `PASS | STEP 8 | Creating lead from conversation links lead to conversation and selected sale`
  - `PASS | STEP 9 | Creating draft order from conversation inherits linked lead sale owner`
  - `PASS | STEP 10 | Order can also be created directly from another conversation using selected sale`
  - summary: `PASS 14 | FAIL 0`

## Chatbot settings follow-up

- Command:

```powershell
$env:TEST_API_BASE='http://localhost:3003'
node scripts/test-chatbot-settings-workflow.js
```

- Result:
  - `PASS | STEP 5 | Director creates fanpage and ops can search/detail it`
  - `PASS | STEP 8 | Facebook verify webhook and fanpage attribution propagate into conversation`
  - `PASS | STEP 9 | Director can delete chatbot settings records and lists no longer return them`
  - summary: `PASS 12 | FAIL 0`

## Planning impact

- Infra-only anchor moi da co:
  - [package.json](/C:/Users/PC/Documents/code/vuitran/school-mgmt/backend/package.json)
  - [master-test-plan.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/plans/backend-api/master-test-plan.vi.md)
  - [backend-api-sop-mapping.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/playbooks/backend-api-sop-mapping.vi.md)
  - [traceability-matrix.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/checklists/backend-api/traceability-matrix.vi.md)
  - [QA-QUICKSTART.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/QA-QUICKSTART.vi.md)

## Residual risk

- `test-chatbot-settings-workflow.js` van khong phai infra sign-off anchor on dinh cho queue path.
- Historical audit-log enum warning cua chatbot khong con tai hien tren build/runtime hien tai.
- Async proof hien tap trung vao webhook queue path cua chatbot; neu can queue sign-off cho subsystem khac, phai prove bang anchor rieng.

## Next best step

- Neu can hardening tiep:
  - doi probe moi vao Wave 0 / async gate cua backend
  - chi khi probe fail moi mo full chatbot/conversations workflow de triage business path
  - neu mo lai nghi van audit-log chatbot, prove bang rerun moi truoc khi tao bug moi

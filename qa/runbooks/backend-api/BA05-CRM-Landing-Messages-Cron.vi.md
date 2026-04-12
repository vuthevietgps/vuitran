# Runbook BA05 - CRM, Landing, Messages, Cron

## Muc tieu batch

Khoa lop marketing/sale/support gom CRM pipeline, landing attribution, message flow, cron, backfill va closed-loop side effects.

## Pham vi checklist

- `Nhom 18`: CRM/leads va closed-loop flows
- `Nhom 19`: Landing, messages, attribution, conversation-side effects
- `Nhom 23`: Shared cron/session-maintenance anchor do `BA05` so huu chinh
- `Nhom 24`: Shared retry/backfill anchor do `BA05` so huu chinh

Luu y drift:

- `group23` va `group24` o day la legacy runner filenames.
- Chung khong dong nghia voi checklist `Nhom 23` va `Nhom 24` theo ten chu de trong `test.md`.
- Checklist `Nhom 20-22` van thuoc BA05 planning ownership, nhung khong co suite ten-trung trong executed bundle va phai doi chieu qua SOP, runbook, va workflow scripts.

## SOP/playbook bat buoc

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/adsmanager/HuongDanAdsManager_ChiTiet.md`
- `school-mgmt/docs/guidelines/landing-page-rules.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`

## Vai tro can dung

- `DIRECTOR`
- `OPS`
- `SALE`
- `ADSMANAGER`
- `PARENT`

## Tien dieu kien va seed

- Co fanpage, conversation, hoac ticket nen
- Co lead pool, lead assigned, va landing page slug test
- Co cron hoac backfill endpoint san de trigger
- Co data messages/realtime du de nhin side effect

## Automation anchor bat buoc

`BA05` la primary owner cua shared cron anchors `group23` va `group24`; `BA06` chi duoc overlap rerun khi co dau hieu instability hoac BA05 evidence khong con dang tin.

- `test/group18-leads-crm.e2e-spec.ts`
- `test/group19-landing-messages.e2e-spec.ts`
- `test/group23-cron-notifications-sessions.e2e-spec.ts`
- `test/group24-cron-retry-backfill.e2e-spec.ts`
- `scripts/test-e2e-ad-to-revenue.js`
- `scripts/test-messages-workflow.js`
- `scripts/test-conversations-workflow.js`
- `scripts/test-tickets-workflow.js`

## Kich ban chay thuc te

1. Tu conversation tao lead hoac order.
2. Chay landing submit va doi chieu lead, source, attribution.
3. Chay ticket closed-loop hoac refund request backend side effect.
4. Trigger cron/backfill va kiem `before -> after`.
5. Test messages/realtime hoac queue AI o muc API contract.

## Chuoi doi soat bat buoc

- `Conversation -> Lead/Order/Ticket`
- `Landing submit -> Lead -> Attribution/ads source`
- `Cron/backfill -> list -> summary -> idempotent rerun`
- `Notification/message -> unread count/list/history`

## Log va evidence

- Log file: `LOG_BA05_CRM_Landing_Messages_Cron_YYYYMMDD.md`
- Voi cron/backfill phai ghi thoi gian trigger va thoi gian quan sat ket qua

## Dau hieu FAIL pho bien

- Lead/order duoc tao nhung mat source tracking
- Queue/websocket tra `200` nhung khong cap nhat conversation list
- Cron chay lan dau dung nhung rerun tao duplicate
- Ticket closed-loop khong keo theo side effect tai chinh hoac CRM nhu mong doi

# Tong hop test bang sub-agent - Frontend UI

Ngay tong hop: `2026-04-08`

## Same-day update 2026-04-11

- File nay giu nguyen gia tri lich su cho batch sub-agent `2026-04-08`, khong phai trang thai regression gate hien tai.
- Legacy skip/fail trong `e2e/webhooks-chatbot-tickets-ui.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Legacy skip/fail trong `e2e/specs/scenarios-deep-reject-reschedule-payroll-loans-12.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Legacy skip/fail trong `e2e/specs/scenarios-10-3-to-12-4.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Legacy skip/fail trong `e2e/specs/scenarios-deep-orders-1-1-to-2-4.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Legacy skip/fail trong `e2e/specs/scenarios-15-2-to-17-4.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Legacy skip/fail trong `e2e/specs/scenarios-12-5-to-13-4.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Legacy skip/fail trong `e2e/specs/session-revenue-first-10.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Legacy skip/fail trong `e2e/specs/cash-inflow-first-10.spec.ts` da duoc rescue same-day ngay `2026-04-11`.
- Supplier compile-hygiene warning trong `supplier-payments.component.ts` va `supplier-quotes.component.ts` da duoc cleanup same-day ngay `2026-04-11`, kem rerun authoritative B08.
- `release-gate-ui.spec.ts` da duoc rerun authoritative same-day ngay `2026-04-11` va khong con tai hien failure gate lich su.
- `orders-report-metrics-ui.spec.ts` da duoc rerun authoritative same-day ngay `2026-04-11`; bang chung `automation-only` cu ngay `2026-04-07` da duoc refresh tren current tree.
- Bundle `b04-order-approval-linked-views-browser-ui.spec.ts` + `orders-report-metrics-ui.spec.ts` + `b05-attendance-report-browser-ui.spec.ts` da duoc rerun authoritative same-day ngay `2026-04-11`; note lich su `orders -> approve -> comprehensive report -> attendance report` da duoc dong drift bang browser proof rong hon.
- `orders-flow-ui.spec.ts` da duoc rerun authoritative same-day ngay `2026-04-11`; legacy order pipeline `1.1 -> 2.4` xac nhan full tren current tree sau batch suite hygiene.
- Smoke bundle `release-gate-ui.spec.ts` + `orders-flow-ui.spec.ts` + `orders-report-metrics-ui.spec.ts` da duoc rerun authoritative same-day ngay `2026-04-11`; current tree giu on dinh cho auth/access + order pipeline + report alignment trong mot gate rong hon.
- Lane-C regression bundle `webhooks-chatbot-tickets-ui.spec.ts` + `notifications-leads-landing-ui.spec.ts` + `specs/b06-b11-followup-ui.spec.ts` da duoc rerun authoritative same-day ngay `2026-04-11`; current tree giu on dinh cho `B06/B09/B10/B11` trong mot gate rong hon.
- Authoritative rerun moi nhat:
  - `npx playwright test e2e/webhooks-chatbot-tickets-ui.spec.ts --project=chromium`
  - Ket qua: `38/38 PASS`
  - `npx playwright test e2e/specs/scenarios-deep-reject-reschedule-payroll-loans-12.spec.ts --project=chromium`
  - Ket qua: `22/22 PASS`
  - `npx playwright test e2e/specs/scenarios-10-3-to-12-4.spec.ts --project=chromium`
  - Ket qua: `13/13 PASS`
  - `npx playwright test e2e/specs/scenarios-deep-orders-1-1-to-2-4.spec.ts --project=chromium`
  - Ket qua: `12/12 PASS`
  - `npx playwright test e2e/specs/scenarios-15-2-to-17-4.spec.ts --project=chromium`
  - Ket qua: `11/11 PASS`
  - `npx playwright test e2e/specs/scenarios-12-5-to-13-4.spec.ts --project=chromium`
  - Ket qua: `12/12 PASS`
  - `npx playwright test e2e/specs/session-revenue-first-10.spec.ts --project=chromium`
  - Ket qua: `4/4 PASS`
  - `npx playwright test e2e/specs/cash-inflow-first-10.spec.ts --project=chromium`
  - Ket qua: `6/6 PASS`
  - `npx playwright test e2e/b08-supplier-payments-browser-ui.spec.ts e2e/b08-supplier-quotes-browser-ui.spec.ts --project=chromium`
  - Ket qua: `2/2 PASS`
  - `npx playwright test e2e/release-gate-ui.spec.ts --project=chromium`
  - Ket qua: `5/5 PASS`
  - `npx playwright test e2e/orders-report-metrics-ui.spec.ts --project=chromium`
  - Ket qua: `2/2 PASS`
  - `npm run e2e:ui -- e2e/b04-order-approval-linked-views-browser-ui.spec.ts e2e/orders-report-metrics-ui.spec.ts e2e/b05-attendance-report-browser-ui.spec.ts`
  - Ket qua: `5/5 PASS`
  - `npx playwright test e2e/orders-flow-ui.spec.ts --project=chromium`
  - Ket qua: `9/9 PASS`
  - `npm run e2e:ui -- e2e/release-gate-ui.spec.ts e2e/orders-flow-ui.spec.ts e2e/orders-report-metrics-ui.spec.ts`
  - Ket qua: `16/16 PASS`
  - `npm run e2e:ui -- e2e/webhooks-chatbot-tickets-ui.spec.ts e2e/notifications-leads-landing-ui.spec.ts e2e/specs/b06-b11-followup-ui.spec.ts`
  - Ket qua: `78/78 PASS`
- Root cause cu cua `18.5 AI Assistant Profile Tuning` la spec gia dinh shared env con `assistantType` trong; fix moi da doi sang stale-cleanup + deterministic slot reserve/restore, khong noi long oracle.
- Root cause cu cua `3.4 Payroll State Machine` la spec dua vao `teacher limit=1` + date range ambient, de va vao `400` duplicate/no-qualified-sessions va `429` attendance-link rate limit; fix moi da doi sang deterministic finalized-session seed va khong noi long oracle.
- Root cause cu cua `11.3 Double-submit Teaching Report` va nhanh `SHAREHOLDER` privilege escalation la spec dua vao ambient actor identity: `11.3` dang login bang demo teacher khong so huu session, con nhanh `SHAREHOLDER` gia dinh demo account co san; fix moi da doi sang deterministic account creation va login dung fixture actor, khong noi long oracle.
- Root cause cu cua `6.1 Invoice Cancel -> Wallet Rollback`, `5.2 Wallet Operations`, va 3 UI tests trong `1.1-2.4` la spec vua skip runtime frontend availability, vua dua vao wallet ambient va payload `/wallets/adjust` cu thieu `reason`; fix moi da doi sang poll deterministic cho invoice, seed parent-wallet rieng, va bo cac `test.skip` khong con phu hop voi harness hien tai.
- Root cause cu cua `17.1 Per-Student Config` trong `15.2-17.4` la spec scan live `/classes` tren shared env de tim lop co hoc sinh, dan toi 2 nhanh `skip`; fix moi da doi sang `createEnrollmentFixture()` va dung thang seeded `classroom/student`, khong noi long oracle.
- Root cause cu cua `13.4 Payroll Lifecycle` trong `12.5-15.1` la spec dua vao ambient `DRAFT payroll` va teacher bat ky tren shared env, dan toi 2 nhanh `skip`; fix moi da doi sang deterministic `createLearningFixture()` + finalize session + tao payroll theo dung seeded period, khong noi long oracle.
- Root cause cu cua `2.2 Đổi thời lượng buổi học` va `2.3 Lớp Offline vắng nhiều học sinh` la file con `test.fixme` theo note gap UI/backend cu; rerun hien tai da xac nhan ca hai nhanh nay xanh tren current tree bang deterministic API seed va live payroll preview, khong noi long oracle.
- Root cause cu cua `1.4 approve a zero-amount trial order without a matching approval document` va `1.6 partial payment order` la file vua con `test.fixme`, vua lech contract hien tai: `1.4` bi ket invoice `PENDING_APPROVAL` do zero-amount offline trial invoice chua duoc mien proof o `approveInvoice()`, con `1.6` van gia dinh `INSTALLMENT_2` se auto-top-up ngay thay vi giu `2` invoice rounds `PENDING_APPROVAL`; fix moi da sua dung guard backend + seed class-placement cho `1.4`, dong bo lai legacy spec theo deferred-revenue contract cho `1.6`, khong noi long oracle.
- Root cause cu cua warning build `supplier-*` la template dung optional chaining thua (`stats()!.byStatus?.[...]?.count`, `detailItem()!.items?.length`) nen Angular compiler phat `NG8107` tren moi Playwright webserver build; fix moi da doi sang helper/template access an toan, rerun B08 supplier payments + supplier quotes van xanh va khong doi oracle.
- Root cause cu cua ghi chu `release-gate-ui.spec.ts dang flaky` trong batch lich su la timeout/harness issue o thoi diem `2026-04-08`; rerun same-day `2026-04-11` tren current tree da `5/5 PASS`, nen ghi chu do chi con gia tri lich su, khong con phan anh regression gate hien tai.
- Root cause cu cua ghi chu `orders-report-metrics` `chua du dieu kien doi checklist` la bang chung `automation-only` ngay `2026-04-07`, khong phai fail san pham; rerun same-day `2026-04-11` da `2/2 PASS` bang browser authoritative tren current tree, nen note cu nay chi con gia tri lich su.
- Root cause cu cua note `pipeline/order-report/attendance-report chua cover du` la bang chung `2026-04-07` moi dung o muc automation mot spec; bundle rerun same-day `2026-04-11` da bo sung linked views va attendance-report pagination/preview, nen note cu nay da duoc supersede boi browser proof rong hon.
- `orders-flow-ui.spec.ts` khong tai hien drift nao tren current tree; rerun same-day `2026-04-11` xanh `9/9`, nen bundle legacy `1.1 -> 2.4` hien dang o trang thai regression-proof thay vi chi la smoke lich su.
- Smoke bundle `release-gate + orders-flow + orders-report-metrics` khong mo them drift moi; rerun same-day `2026-04-11` xanh `16/16`, nen co the dung nhu gate rong tren current tree truoc khi can full-suite rerun.
- Lane-C regression bundle khong mo them drift moi; rerun same-day `2026-04-11` xanh `78/78`, nen co the dung nhu gate rong cho `B06/B09/B10/B11` truoc khi can lane-level full-suite rerun.

Checklist thuc thi tham chieu:

- `C:\Users\PC\Documents\code\vuitran\qa\plans\frontend-ui\execution-checklist.vi.md`

## Ket luan nhanh

- Lane A (`B01/B02/Nhom 12`): khong mo them case co the tick ngay. Phan con lai cua lane nay dang thieu browser-first UI evidence that su.
- Lane B (`B04/B05/B07`): khong thay blocker tai hien; phan mo con lai chu yeu la thieu UI proof, khong phai thieu workflow xanh.
- Lane C (`B09/B10/B11/B06`): `B09` tiep tuc la lane co nhieu quick win nhat, nhung cac rerun cua lane nay dang bi xen harness flake/timeout nen chua nen sync them hang loat.
- Lane D (`B03/B08`): chua co case mo nao dong duoc ngay; gap lon nhat la thieu UI coverage va mot vai failure co kha nang la contract/concurrency issue.

## Tong hop theo lane

### Lane A

Commands:

- `npx playwright test e2e/rbac-route-guard-ui.spec.ts`
- `npx playwright test e2e/specs/scenarios-deep-auth-trials-dash-31-to-36.spec.ts`
- `npx playwright test e2e/release-gate-ui.spec.ts`

Ket qua:

- `1/1 PASS`
- `20/20 PASS`
- `2 PASS, 3 FAIL`

Nhan dinh:

- Xac nhan auth/guard/dashboard API dang on.
- Khong du can cu de dong them `B01/B02/Nhom 12`.
- `release-gate-ui.spec.ts` tung flaky do timeout va artifact cleanup trong batch lich su `2026-04-08`; rerun authoritative same-day `2026-04-11` da `5/5 PASS`.

### Lane B

Commands:

- `npx playwright test e2e/specs/scenarios-deep-orders-1-1-to-2-4.spec.ts`
- `npx playwright test e2e/specs/scenarios-deep-sessions-2-1-to-3-4.spec.ts`
- `npx playwright test e2e/specs/scenarios-deep-classes-payroll-msgs-7-24-28.spec.ts`
- `npx playwright test e2e/b07-invoices-wallets-payroll-video.spec.ts`

Ket qua:

- Orders spec co failure thoang qua trong batch, rerun rieng thi pass
- Sessions spec xanh
- Classes/payroll spec co timeout thoang qua, rerun rieng thi pass
- B07 video spec xanh

Nhan dinh:

- Khong thay blocker san pham lap lai.
- Phan con mo cua `B04/B05/B07` can browser-first evidence moi dong duoc checklist.

### Lane C

Commands:

- `npx playwright test e2e/notifications-leads-landing-ui.spec.ts`
- `npx playwright test e2e/webhooks-chatbot-tickets-ui.spec.ts`
- `npx playwright test e2e/materials-export-students-ui.spec.ts`
- `npx playwright test e2e/specs/b06-b11-followup-ui.spec.ts`

Ket qua:

- `31 passed, 2 failed`
- `35 passed, 3 failed`
- `41 passed, 4 failed`
- `1 passed, 1 failed, 1 did not run`

Nhan dinh:

- `B09` co nhieu flow dang on nhat.
- `B10` ads/platforms van la khoang trong lon.
- `B06/B11` bi lan voi harness flake nen phai rerun tach case timeout.

### Lane D

Commands:

- `npx playwright test e2e/bulk-agents-class-config-ui.spec.ts`
- `npx playwright test e2e/crisis-opex-flow-ui.spec.ts`
- `npx playwright test e2e/expenses-rbac-ui.spec.ts`
- `npx playwright test e2e/specs/scenarios-deep-finance-4-1-to-6-2.spec.ts`
- `npx playwright test e2e/specs/scenarios-deep-users-students-finance-29-to-37.spec.ts`
- `npx playwright test e2e/specs/scenarios-10-3-to-12-4.spec.ts`

Ket qua:

- `23 passed, 9 failed`
- `12 passed, 3 failed`
- `24 passed, 7 failed`
- `17 passed, 2 failed`
- `12 passed`
- `11 passed, 1 failed, 1 skipped`

Nhan dinh:

- Chua co item `B03/B08` mo nao du bang chung de dong ngay.
- Hai diem can dieu tra them:
  - supplier quote create tra `400`
  - concurrent order approve co dau hieu race/flaky concurrency

## Mau phan loai cho vong tiep theo

1. `Can browser-first spec moi`
   - `B01`
   - `B02`
   - `Nhom 12`
   - phan mo cua `B04/B05/B07`

2. `Can rerun serial vi harness flake`
   - `B06`
   - `B10`
   - `B11`
   - mot phan `B09`

3. `Can dieu tra contract/concurrency`
   - supplier quotes
   - concurrent order approve

## De xuat thu tu vong tiep theo

1. On dinh harness Playwright
   - trace/artifact path
   - context-close sau timeout
   - stale helper signatures
2. Viet/chay browser-first spec rieng cho `B01/B02/Nhom 12`
3. Chay UI-first cho cac dong `B04/B05/B07` con mo
4. Chay serial lane `B10/B06/B11`
5. Dieu tra rieng `supplier quote 400` va `concurrent order approve`




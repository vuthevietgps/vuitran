# Checklist thuc thi frontend UI con lai

Cap nhat: `2026-04-08`

Nguon doi soat:

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
- Backlog con lai: `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\remaining-cases.vi.md`
- Tong hop moi nhat: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\EXECUTION-RESULTS-ALL.vi.md`

Snapshot hien tai:

- `50 PASS`
- `204` case con mo
- Muc tieu cua file nay: chia lane test ro rang, chi ra bang chung can co, lenh uu tien de chay, va mau tong hop ket qua cho moi lane

## 1. Quy tac chung

1. Backend baseline da xanh; tu nay moi fail frontend duoc phan loai thanh:
   - `UI bug`
   - `frontend test drift`
   - `integration/contract issue`
   - `backend bug that su`
2. Khong doi checklist goc tu `[ ]` sang `[x]` chi vi API pass.
3. Chi tick `PASS` neu co du UI evidence cho dung wording checklist.
4. Moi case co side effect phai co `before -> action -> after -> man lien doi`.
5. Moi lane phai tra ve ket qua theo 4 nhom:
   - `case co the dong ngay`
   - `case da chay nhung chua du bang chung`
   - `case blocked`
   - `case chua co spec/khong thay duong test nhanh`

## 2. Lane va muc tieu

### Lane A - Auth, Dashboard, Common States

Pham vi:

- `B01`
- `B02`
- `Nhom 12`

Muc tieu:

- Khoa cac case frontend thuần UI ma backend xanh khong giup dong checklist:
  - restore session
  - change-password UI
  - forced `401 -> login`
  - menu/badge/loading bar
  - dashboard skeleton/error state
  - overdue tickets widget
  - quick links, gallery, pending approvals count
  - empty/error/loading/disable/double click state

Spec uu tien de dung/ra soat:

- `school-mgmt/frontend/e2e/specs/scenarios-deep-auth-trials-dash-31-to-36.spec.ts`
- `school-mgmt/frontend/e2e/rbac-route-guard-ui.spec.ts`
- `school-mgmt/frontend/e2e/rbac-route-guard-demo-ui.spec.ts`
- `school-mgmt/frontend/e2e/investor-demo-5min-video.spec.ts`
- `school-mgmt/frontend/e2e/release-gate-ui.spec.ts`

Ket qua mong muon:

- Co bang map ro item nao cua `B01/B02/Nhom 12` da co du UI evidence
- Neu spec hien tai chi moi cover API, ghi ro phan nao can browser-first/manual

### Lane B - Orders, Classes, Sessions, Finance Core

Pham vi:

- `B04`
- `B05`
- `B07`

Muc tieu:

- Dong cac flow UI co side effect doanh thu va van hanh:
  - lead edit/contact/reassign
  - pricing/installment/partial payment
  - reject/request-more-info/cancel order
  - invoice/student side effects sau approve
  - edit/delete class, teacher swap, reschedule/cancel/finalize session
  - attendance thao tac tung hoc sinh, mark all, request history
  - reject/delete invoice, top-up reject, wallet transfer
  - payroll lifecycle, held/exclude/bulk payroll

Spec uu tien de dung/ra soat:

- `school-mgmt/frontend/e2e/specs/scenarios-deep-orders-1-1-to-2-4.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-deep-sessions-2-1-to-3-4.spec.ts`
- `school-mgmt/frontend/e2e/specs/session-revenue-first-10.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-deep-classes-payroll-msgs-7-24-28.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-batch-14-tickets-payroll.spec.ts`
- `school-mgmt/frontend/e2e/b07-invoices-wallets-payroll-video.spec.ts`
- `school-mgmt/frontend/e2e/orders-flow-ui.spec.ts`
- `school-mgmt/frontend/e2e/wallets-refunds-flow-ui.spec.ts`
- `school-mgmt/frontend/e2e/change-requests-capital-ui.spec.ts`

Ket qua mong muon:

- Co danh sach case `B04/B05/B07` co the dong ngay
- Co danh sach case dang bi thieu UI proof du da co backend xanh
- Co danh sach case can viet them spec

### Lane C - Messages, Ads, Reports, Teacher/Parent UI

Pham vi:

- `B09`
- `B10`
- `B11`
- `B06`

Muc tieu:

- Dong cac flow chat/notification/ticket con lai:
  - click notification read + redirect
  - internal messages
  - conversation load/takeover/release
  - realtime websocket
  - ticket tabs/deeplink/refund warning
  - toggle auto-reply, token expired banner
- Dong cac flow ads/public/report/materials con mo:
  - ads management loading/toast
  - sync/backfill UI
  - landing error state, clipboard fallback, tracking payload
  - report filter/preview/export edge cases
  - teacher profile edit/KPI/feedback
  - materials drag-drop/load more/empty state

Spec uu tien de dung/ra soat:

- `school-mgmt/frontend/e2e/notifications-leads-landing-ui.spec.ts`
- `school-mgmt/frontend/e2e/webhooks-chatbot-tickets-ui.spec.ts`
- `school-mgmt/frontend/e2e/materials-export-students-ui.spec.ts`
- `school-mgmt/frontend/e2e/specs/b06-b11-followup-ui.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-18-1-to-23-3.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-batch-15-cron-chatbot.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-batch-16-ads-platforms.spec.ts`
- `school-mgmt/frontend/e2e/landing-messages-products-ui.spec.ts`

Ket qua mong muon:

- Co ket luan ro `B09` con phan nao chi manual/hybrid moi dong duoc
- Co danh sach case `B06/B10/B11` co quick win va case nao khong nen test bang API nua

### Lane D - Users and Finance Advanced

Pham vi:

- `B03`
- `B08`

Muc tieu:

- Dong cac phan UI owner transfer, multi-parent, deactivate, agent tier
- Dong expenses/supplier/loan/financial control/reconciliation UI

Spec uu tien de dung/ra soat:

- `school-mgmt/frontend/e2e/specs/scenarios-deep-users-students-finance-29-to-37.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-deep-finance-4-1-to-6-2.spec.ts`
- `school-mgmt/frontend/e2e/expenses-rbac-ui.spec.ts`
- `school-mgmt/frontend/e2e/crisis-opex-flow-ui.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-10-3-to-12-4.spec.ts`
- `school-mgmt/frontend/e2e/specs/scenarios-deep-reject-reschedule-payroll-loans-12.spec.ts`

Ket qua mong muon:

- Co bang `B03/B08` item nao co test duoc ngay bang spec co san
- Co danh sach gap lon can viet them test browser-first

## 3. Thu tu chay de co ket qua nhanh

1. Chay lai lane bang spec co san truoc.
2. Gom ket qua theo checklist item.
3. Chi de xuat tick `PASS` cho item co UI evidence sat wording.
4. Item nao chi co API evidence thi danh dau `partial/khong du tick`.
5. Item nao chua co spec thi danh dau `manual-first` hoac `need new spec`.

## 4. Mau bao cao bat buoc cho moi lane

Moi lane phai tra ve:

1. `Commands run`
2. `Results`
3. `Checklist items that can be closed now`
4. `Checklist items tested but not enough to close`
5. `Blocked or flaky items`
6. `Highest-value next tests`

Mau ngan:

```md
Lane:
Commands:
- ...

Results:
- spec-a: 12/12 PASS
- spec-b: 2 PASS, 1 FAIL

Can close now:
- `Bxx-...`

Tested but not enough:
- ...

Blocked/flaky:
- ...

Next:
- ...
```

## 5. Quy uoc cap nhat sau khi sub-agent tra ve

- Main agent tong hop va quyet dinh item nao du dieu kien sync.
- Chi main agent moi sua `testfrontendui.md`, `qa/reports/frontend-ui/remaining-cases.vi.md`, va evidence tong hop.
- Sub-agent uu tien khong sua file, chi tra ve ket qua va mapping.





# Bộ Runbook Test Frontend UI

## Mục đích

- Dùng để thực thi test thủ công Frontend UI theo batch
- Dùng khi quay video bằng chứng `MP4`
- Dùng chung với:
  - `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
  - `C:\Users\PC\Documents\code\vuitran\qa\plans\frontend-ui\master-test-plan.vi.md`

## Quy tắc chung

- Mọi bước test, kỳ vọng, kết quả ghi bằng tiếng Việt
- Video bằng chứng phải thấy rõ dấu chuột
- File bàn giao cuối cùng là `MP4`
- Không dừng video ngay sau toast `success` hoặc sau khi form đóng
- Với case có `submit`, `approve`, `reject`, `convert`, `cancel`, `mark paid`, `sync`, `reconcile`, `top-up`, `transfer`, `upload`, `create`, `edit`, `delete`, phải quay đủ:
  1. Trạng thái trước thao tác
  2. Form hoặc modal đang submit
  3. Kết quả ở chính màn nguồn
  4. Ít nhất 1 màn liên đới để đối soát side effect
- Với luồng tài chính hoặc duyệt, phải mở tối thiểu `2` màn liên đới sau submit
- Mỗi batch nên có:
  - `1` file video hoặc nhiều phần video
  - `1` file log kết quả

## Thứ tự khuyến nghị

1. B04. Leads, Orders, Trials
2. B05. Classes, Sessions, Attendance
3. B07. Invoices, Wallets, Payroll
4. B08. Finance Alerts, Reconciliation
5. B09. Notifications, Chatbot, Tickets
6. B10. Ads, Landing Pages, Public Flows
7. B01. Auth, App Shell, Routing
8. B02. Dashboard, Handbook, Empty State
9. B03. Users, Students, Products
10. B06. Teacher Hub, Parent Pages
11. B11. Reports, Export, Audit

## Danh sách runbook

- [B01-Auth-AppShell.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B01-Auth-AppShell.vi.md)
- [B02-Dashboard-Handbook.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B02-Dashboard-Handbook.vi.md)
- [B03-Users-Students-Products.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B03-Users-Students-Products.vi.md)
- [B04-Orders-Trials.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B04-Orders-Trials.vi.md)
- [B05-Classes-Sessions-Attendance.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B05-Classes-Sessions-Attendance.vi.md)
- [B06-TeacherHub-ParentPages.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B06-TeacherHub-ParentPages.vi.md)
- [B07-Invoices-Wallets-Payroll.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B07-Invoices-Wallets-Payroll.vi.md)
- [B08-Finance-Alerts-Reconciliation.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B08-Finance-Alerts-Reconciliation.vi.md)
- [B09-Notifications-Chatbot-Tickets.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B09-Notifications-Chatbot-Tickets.vi.md)
- [B10-Ads-PublicFlows.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B10-Ads-PublicFlows.vi.md)
- [B11-Reports-Export-Audit.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\B11-Reports-Export-Audit.vi.md)
- [LOG-TEMPLATE-frontend-ui.vi.md](C:\Users\PC\Documents\code\vuitran\qa\runbooks\frontend-ui\LOG-TEMPLATE-frontend-ui.vi.md)

## Quy ước file bằng chứng

- Video:
  - `UI_<BatchID>_<TenNganGon>_<YYYYMMDD>.mp4`
- Log:
  - `LOG_<BatchID>_<TenNganGon>_<YYYYMMDD>.md`

Ví dụ:

- `UI_B05_Classes_Sessions_20260407.mp4`
- `LOG_B05_Classes_Sessions_20260407.md`

## Tạo gói thực thi theo ngày

- Dùng script:
  - `C:\Users\PC\Documents\code\vuitran\qa\scripts\frontend-ui\new-frontend-ui-execution-pack.ps1`
- Ví dụ chạy cho ngày `2026-04-08`:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\PC\Documents\code\vuitran\qa\scripts\frontend-ui\new-frontend-ui-execution-pack.ps1 -RunDate 2026-04-08
```

- Script sẽ:
  - Tạo manifest execution trong thư mục evidence theo ngày
  - Tạo log skeleton cho các batch chưa có log
  - Kéo toàn bộ case `[ ]` từ `testfrontendui.md` vào đúng batch
  - Gắn thêm checklist `Nhóm 12` áp dụng cho từng batch

## Trạng thái test

- `PASS`
- `FAIL`
- `BLOCKED`
- `NOT RUN`


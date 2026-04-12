# Runbook B07 - Invoices, Wallets, Payroll Core

## Mục tiêu batch

Kiểm tra các luồng hóa đơn, ví và bảng lương lõi trong [testfrontendui.md](/C:/Users/PC/Documents/code/vuitran/testfrontendui.md), đồng thời quay bằng video MP4 có hiển thị rõ con trỏ chuột.

## Vai trò cần dùng

- `ACCOUNTING`
- `DIRECTOR`
- `TEACHER`
- `PARENT`

## Tiền điều kiện

- Có sẵn ít nhất 1 invoice ở trạng thái `APPROVED`
- Có sẵn 1 wallet có top-up pending và 1 wallet số dư thấp
- Có sẵn 1 payroll trạng thái `HELD`
- Có sẵn 1 payroll offline có penalty
- Có sẵn dữ liệu để test bulk payroll partial success

## Case trọng tâm

- Invoice create/edit/approve/reject/delete
- Chặn xóa invoice đã `APPROVED`
- Top-up request, approve, reject, ledger
- Transfer ví và kiểm tra quyền
- Payroll preview/generate/submit/approve/reject/reopen/mark paid
- Payroll `HELD` hiển thị rõ lý do
- Min Payout Guarantee cho lớp Offline
- Bulk payroll partial success
- Không cho lùi trạng thái payroll từ `PAID` về `DRAFT`

## Chuỗi đối soát bắt buộc sau submit

- Invoice create/edit/approve/reject/delete:
  - Mở lại `invoice list`
  - Mở `invoice detail`
  - Mở `parent invoices` hoặc màn tài chính liên quan
- Approve hoặc reject top-up, transfer ví:
  - Mở lại `wallet balance`
  - Mở `wallet ledger`
  - Mở pending count hoặc history liên quan
- Payroll generate/submit/approve/reject/reopen/mark paid/delete:
  - Mở lại `payroll list`
  - Mở `payroll detail/preview`
  - Mở màn giáo viên xem lương hoặc `Pending Approvals`
  - Mở thêm 1 màn tài chính tổng hợp nếu case có tác động số dư
- Case `HELD`, `Penalty`, `Min Payout Guarantee`, `Exclude Payroll`:
  - Quay rõ badge hoặc label ở preview
  - Quay lại cùng trạng thái ở detail hoặc màn người dùng liên quan

## Checklist bước test mẫu

1. Đăng nhập bằng role phù hợp.
2. Mở màn hóa đơn hoặc ví theo case đang test.
3. Thực hiện tạo, sửa, duyệt hoặc từ chối theo checklist.
4. Quan sát badge, trạng thái, số tiền và thông báo hiển thị.
5. Mở các màn đối soát sau submit theo đúng chuỗi ở trên.
6. Với payroll, kiểm tra từng nhóm trạng thái và lý do `HELD`.
7. Ghi lại kết quả thực tế ngay sau mỗi case.

## Quy ước video và log

- File video: `UI_B07_Invoices_Wallets_Payroll_YYYYMMDD.mp4`
- File log: `LOG_B07_Invoices_Wallets_Payroll_YYYYMMDD.md`
- Video phải quay toàn màn hình, thấy rõ chuột
- Mỗi case cần có mốc thời gian trong log
- Khuyến nghị tách 2 phần:
  - `UI_B07A_Invoices_Wallets_YYYYMMDD.mp4`
  - `UI_B07B_Payroll_Core_SideEffects_YYYYMMDD.mp4`

## Tiêu chí PASS/FAIL

- PASS nếu UI hiển thị đúng trạng thái, đúng quyền và đúng số tiền
- FAIL nếu sai badge, sai role, sai validation, sai dữ liệu ledger hoặc sai luồng payroll
- BLOCKED nếu thiếu data seed hoặc backend không phản hồi

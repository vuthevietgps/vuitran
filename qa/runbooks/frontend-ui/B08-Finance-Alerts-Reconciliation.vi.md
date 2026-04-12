# Runbook B08 - Finance Alerts, Financial Control, Reconciliation

## Mục tiêu batch

Kiểm tra các màn tài chính nâng cao, cảnh báo tài chính đa cấp độ, P&L và đối soát ngân hàng theo checklist frontend UI.

## Vai trò cần dùng

- `DIRECTOR`
- `ACCOUNTING`
- `SHAREHOLDER`

## Tiền điều kiện

- Có dữ liệu dashboard tài chính với ít nhất 1 cảnh báo `CRITICAL` và 1 cảnh báo `WARNING`
- Có dữ liệu P&L để đổi giữa `CASH` và `ACCRUAL`
- Có dữ liệu bank reconciliation với nhóm `Matched` và `Unmatched`
- Có dữ liệu expense breakdown theo danh mục

## Case trọng tâm

- Financial Alerts hiển thị màu đúng theo severity
- Action trong cảnh báo chạy đúng điều hướng
- Director Dashboard hiển thị `Expense Breakdown`
- Investor Dashboard partial failure không làm sập toàn trang
- Toggling P&L giữa `CASH` và `ACCRUAL`
- Bank reconciliation tách `Matched` và `Unmatched`
- Reject reconciliation hiển thị đúng lý do và trạng thái

## Checklist bước test mẫu

1. Đăng nhập bằng `DIRECTOR` hoặc `ACCOUNTING`.
2. Mở dashboard tài chính và kiểm tra các khối cảnh báo.
3. Bấm từng action trong cảnh báo như `Nạp quỹ` hoặc `Xem chi tiết`.
4. Chuyển sang tab P&L và đổi basis `CASH`/`ACCRUAL`.
5. Mở bank reconciliation và kiểm tra list khớp, lệch.
6. Ghi lại kết quả thực tế kèm mốc thời gian trong log.

## Quy ước video và log

- File video: `UI_B08_Finance_Alerts_Reconciliation_YYYYMMDD.mp4`
- File log: `LOG_B08_Finance_Alerts_Reconciliation_YYYYMMDD.md`
- Nếu một widget lỗi riêng lẻ nhưng trang không sập, phải ghi rõ là partial failure
- Log cần ghi bằng tiếng Việt, có trạng thái PASS/FAIL/BLOCKED cho từng case

## Tiêu chí PASS/FAIL

- PASS nếu màu sắc, severity, điều hướng và list reconciliation đều đúng
- FAIL nếu cảnh báo sai màu, action sai màn, hoặc trang tài chính bị vỡ state
- BLOCKED nếu không có dữ liệu seed đối chiếu


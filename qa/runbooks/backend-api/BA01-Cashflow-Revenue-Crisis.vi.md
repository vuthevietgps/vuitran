# Runbook BA01 - Cashflow, Revenue, Crisis

## Mục tiêu batch

Khóa các luồng nền tảng liên quan đến order, invoice, cash inflow, ghi nhận doanh thu/giá vốn và chế tài khủng hoảng trước khi mở rộng sang các module phụ.

## Phạm vi checklist

- `Nhóm 1`: Dòng tiền vào — Orders & Invoices
- `Nhóm 2`: Ghi nhận doanh thu & giá vốn — Sessions
- `Nhóm 3`: Chế tài & khủng hoảng — Penalties & Crisis

## SOP/playbook bắt buộc

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/project/mota.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`
- `school-mgmt/frontend/src/app/components/internal-handbook.configs.ts`

## Vai trò cần dùng

- `DIRECTOR`
- `ACCOUNTING`
- `SALE`
- `OPS`
- `PARENT`
- `TEACHER`

## Tiền điều kiện và seed

- Chạy `node scripts/seed-all.js`
- Đảm bảo có:
  - ít nhất `1` order chờ duyệt
  - `1` order chuyển khoản có receipt
  - `1` order trial hoặc amount `0`
  - `1` phụ huynh ví `0đ`
  - `1` session đủ điều kiện finalize
  - `1` case crisis/penalty có dữ liệu để đối soát

## Automation anchor bắt buộc

- `test/group1-cash-inflow.e2e-spec.ts`
- `test/group2-revenue-cogs.e2e-spec.ts`
- `test/group3-crisis-penalties.e2e-spec.ts`
- `test/order-enrollment-scenarios.e2e-spec.ts`
- `test/orders-deep-review.e2e-spec.ts`
- `test/scenario2-revenue-payroll.e2e-spec.ts`
- `test/scenario3-crisis-management.e2e-spec.ts`
- `scripts/test-invoices-workflow.js`
- `scripts/test-sessions-workflow.js`

## Kịch bản chạy thực tế

1. Duyệt order chuẩn và order có discount.
2. Duyệt order trial hoặc zero amount.
3. Duyệt invoice trả góp và xác nhận chỉ kỳ hiện tại ảnh hưởng ví.
4. Finalize session và đối chiếu doanh thu/COGS.
5. Chạy case crisis hoặc penalty để xác nhận hệ thống không ghi sai dòng tiền.

## Chuỗi đối soát bắt buộc

- `Order -> Invoice -> Wallet -> Ledger -> Financial Control`
- `Session finalize -> Session detail -> Revenue/P&L -> Parent/Teacher side effect`
- `Penalty/Crisis -> Payroll hoặc financial summary -> Audit trail`

## Log và evidence

- Log file: `LOG_BA01_Cashflow_Revenue_Crisis_YYYYMMDD.md`
- Nếu có command đáng chú ý, ghi thêm phần `Lệnh đã chạy`
- Mọi case write phải ghi `before -> action -> after`

## Dấu hiệu FAIL phổ biến

- Approve order/invoice trả `200` nhưng không sinh side effect ví/ledger
- Finalize session đổi trạng thái nhưng không đổi revenue/COGS
- Discount, installment, trial làm sai `finalAmount`
- Crisis hoặc penalty chạm sai module tài chính khác

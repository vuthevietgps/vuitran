# Runbook BA08 - Work Sessions, Financial Control, Dashboards

## Mục tiêu batch

Đóng vòng các luồng nền sâu nhất: chấm công giáo viên, báo cáo tài chính chi tiết, dashboard theo role và hub pending approvals/users.

## Phạm vi checklist

- `Nhóm 34`: Chấm công giáo viên
- `Nhóm 35`: Báo cáo tài chính chi tiết
- `Nhóm 36`: Dashboard theo role
- `Nhóm 37`: Pending approvals & users

## SOP/playbook bắt buộc

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/project/mota.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`
- `school-mgmt/frontend/src/app/components/internal-handbook.configs.ts`

## Vai trò cần dùng

- `DIRECTOR`
- `ACCOUNTING`
- `OPS`
- `SALE`
- `TEACHER`
- `PARENT`
- `SHAREHOLDER`

## Tiền điều kiện và seed

- Có work session open/close hoặc dữ liệu timekeeping nền
- Có dữ liệu financial control đủ để đọc P&L/balance/tax/aging
- Có pending approvals và user records nền
- Có dữ liệu dashboard cho nhiều role, gồm cả trạng thái read-only

## Automation anchor bắt buộc

- `test/payroll.e2e-spec.ts`
- `test/attendance.e2e-spec.ts`
- `test/scenario2-revenue-payroll.e2e-spec.ts`
- `test/scenario4-payroll-fund-fluctuation.e2e-spec.ts`
- `scripts/test-work-sessions-workflow.js`
- `scripts/test-financial-control-workflow.js`
- `scripts/test-financial-control-payroll.ts`
- `scripts/test-financial-control-payroll-recalculation.ts`
- `scripts/test-financial-control-loans.ts`
- `scripts/test-attendance-payroll-financial-control.ts`
- `scripts/test-audit-log-workflow.js`

## Kịch bản chạy thực tế

1. Test work session open/close, auto-close hoặc bất thường giờ công.
2. Đọc financial control theo tab và đối chiếu số liệu nền.
3. Kiểm dashboard theo role và read-only behavior.
4. Xử lý pending approvals hoặc user management flow và kiểm hub count.

## Chuỗi đối soát bắt buộc

- `Work session -> timekeeping detail -> payroll/report side effect`
- `Financial control -> P&L/balance/aging/tax -> dashboard summaries`
- `Pending approvals -> queue count -> target resource status -> audit log`
- `Users -> user detail/list -> RBAC visibility ở dashboard/hub`

## Log và evidence

- Log file: `LOG_BA08_WorkSessions_Financial_Dashboards_YYYYMMDD.md`
- Với số liệu tài chính phải ghi rõ kỳ dữ liệu, filter và endpoint đã dùng

## Dấu hiệu FAIL phổ biến

- Work session tự động đóng nhưng không gắn trạng thái phù hợp
- Financial report trả số nhưng không khớp summary/dashboard liên quan
- Dashboard role read-only bị lộ action write
- Pending approvals đổi trạng thái resource nhưng count hub không cập nhật

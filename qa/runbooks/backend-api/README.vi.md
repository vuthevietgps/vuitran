# Backend API Runbooks

Thư mục này batch hóa checklist `qa/checklists/backend-api/test.md` thành các luồng chạy thực tế.

## Cách dùng

1. Đọc `qa/plans/backend-api/master-test-plan.vi.md`
2. Đọc `qa/playbooks/backend-api-sop-mapping.vi.md`
3. Mở runbook batch tương ứng
4. Chuẩn bị seed, role và command anchor
5. Chạy manual/API scenario rồi ghi summary

## Danh sách batch

- `BA01-Cashflow-Revenue-Crisis.vi.md`
- `BA02-Opex-Wallets-Refunds-Offline.vi.md`
- `BA03-Change-Reconciliation-Capital-Concurrency.vi.md`
- `BA04-State-Limits-Agents-Class-Chatbot.vi.md`
- `BA05-CRM-Landing-Messages-Cron.vi.md`
- `BA06-Products-Teaching-Teachers-Reports.vi.md`
- `BA07-Auth-Trials-Attendance.vi.md`
- `BA08-WorkSessions-Financial-Dashboards.vi.md`

## Lưu ý

- Runbook là `how to run`.
- Checklist là `what to test`.
- SOP mapping là `why expected behavior phải như vậy`.

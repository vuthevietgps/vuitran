# QA Handover

## Tổng quan
Hệ thống hiện đã pass `100%` E2E UI Automation, tương ứng `291+ cases` trên toàn bộ bộ test hiện có.

Tài liệu này là bản tóm tắt cho maintainer sau này: bản đồ kiểm thử, các luật nghiệp vụ không được làm gãy, và lệnh khởi chạy lại automation.

Manual QA docs, runbook, master plan và evidence rule hiện đã được gom về hub:

- `C:\Users\PC\Documents\code\vuitran\qa\README.vi.md`

## Bản đồ kiểm thử
Các batch E2E UI nằm trong `frontend/e2e/orchestrator/`:

- `B01` - `b01-auth-appshell.spec.ts`
- `B02` - `b02-dashboard-handbook.spec.ts`
- `B03` - `b03-users-products-agents.spec.ts`
- `B04` - `b04-b05-sales-ops.spec.ts`
- `B05` - `b04-b05-sales-ops.spec.ts`
- `B06` - `b06-b09-b10-b11-comms-ads-reports.spec.ts`
- `B07` - `b07-b08-finance-wallets.spec.ts`
- `B08` - `b07-b08-finance-wallets.spec.ts`
- `B09` - `b06-b09-b10-b11-comms-ads-reports.spec.ts`
- `B10` - `b06-b09-b10-b11-comms-ads-reports.spec.ts`
- `B11` - `b06-b09-b10-b11-comms-ads-reports.spec.ts`

Script gom video evidence:

- `frontend/scripts/collect-evidence.js`

## Quy tắc nghiệp vụ cốt lõi
Các luật dưới đây đã được khóa bằng E2E và không được phá vỡ khi code mới.

### Tài chính
- Chặn chuyển ví nếu số dư không đủ.
- Hủy invoice / rollback top-up bị chặn nếu giao dịch hoàn tác sẽ làm ví âm.
- Ẩn nút xóa invoice khi invoice đã ở trạng thái `APPROVED`.

### Vận hành & Lương
- Tính lương chỉ hợp lệ khi `hasTeachingReport = true`.
- Không cho lùi trạng thái payroll từ `PAID` về `DRAFT`.
- `Exclude` payroll bắt buộc phải có lý do hợp lệ.

### Marketing
- Token OpenAI / Ads phải được mask trên UI.
- Báo cáo phải luôn tính `Cohort Profit`, không chỉ hiển thị `Spend`.

### Bảo mật & Tương tranh
- Lockout sau 5 lần nhập sai mật khẩu.
- Duyệt top-up phải chống race-condition, chỉ cộng tiền đúng 1 lần.

## Hướng dẫn run automation
Khởi chạy backend và frontend:

```bash
# terminal 1
cd backend
npm run start

# terminal 2
cd frontend
npm run start
```

Chạy Playwright UI tổng hợp:

```bash
cd frontend
npx playwright test e2e/orchestrator/b01-auth-appshell.spec.ts e2e/orchestrator/b02-dashboard-handbook.spec.ts e2e/orchestrator/b03-users-products-agents.spec.ts --headed
```

Nếu cần xuất evidence pack:

```bash
cd frontend
npm run e2e:evidence:collect
```

# Runbook BA04 - State, Limits, Agents, Class Config, Chatbot

## Mục tiêu batch

Bao phủ lớp nghiệp vụ mở rộng gồm state machine chặt chẽ, bulk/limit, đối tác, class config nâng cao, webhook chatbot, tickets và notifications.

## Phạm vi checklist

- `Nhóm 13`: Vòng đời trạng thái & chặn nghiệp vụ
- `Nhóm 14`: Marketing attribution & chatbot
- `Nhóm 15`: Giới hạn, hết hạn & thao tác hàng loạt
- `Nhóm 16`: Quản trị đối tác & mua sắm
- `Nhóm 17`: Cấu hình lớp học phức tạp & lịch sử

## SOP/playbook bắt buộc

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/adsmanager/HuongDanAdsManager_ChiTiet.md`
- `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`

## Vai trò cần dùng

- `DIRECTOR`
- `OPS`
- `ACCOUNTING`
- `SALE`
- `ADSMANAGER`
- `PARENT`

## Tiền điều kiện và seed

- Có dữ liệu chatbot/fanpage/token/profile
- Có agent/supplier quote/supplier payment
- Có class/session để test config nâng cao và substitute
- Có token/link attendance để test expiry/rate limit

## Automation anchor bắt buộc

- `test/group13-bulk-agents.e2e-spec.ts`
- `test/group14-class-config.e2e-spec.ts`
- `test/group15-webhooks-chatbot.e2e-spec.ts`
- `test/group16-tickets-maintenance.e2e-spec.ts`
- `test/group17-notifications.e2e-spec.ts`
- `test/supplier-agents.e2e-spec.ts`
- `scripts/test-chatbot-settings-workflow.js`
- `scripts/test-tickets-workflow.js`
- `scripts/test-commission-report-workflow.js`

## Kịch bản chạy thực tế

1. Kiểm state machine chặn reversal hoặc action sai thứ tự.
2. Test rate limit, expiry link, bulk action và batch side effect.
3. Tạo/sửa agent, supplier quote/payment hoặc class config nâng cao.
4. Test chatbot settings, webhook handling và AI profile/token.
5. Test notifications/tickets ở mức backend contract.

## Chuỗi đối soát bắt buộc

- `Bulk action -> target list -> audit log -> pending/notification nếu có`
- `Webhook/chatbot -> conversation/ticket/lead/order side effect`
- `Agent/supplier/class config -> detail -> list -> financial/report nếu có`
- `Expired/rate-limited token -> clear error code -> no dirty side effect`

## Log và evidence

- Log file: `LOG_BA04_State_Limits_Agents_Class_Chatbot_YYYYMMDD.md`
- Nếu test webhook, ghi rõ payload mẫu đã dùng

## Dấu hiệu FAIL phổ biến

- State reversal bị whitelist lọt
- Bulk action báo thành công nhưng thiếu một phần side effect
- Webhook ack `200` nhưng vẫn gây mutation sai
- Agent/class config đổi xong nhưng không lan sang resource liên quan

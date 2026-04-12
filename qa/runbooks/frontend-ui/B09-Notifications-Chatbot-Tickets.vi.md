# Runbook B09 - Notifications, Chatbot, Tickets

## Mục tiêu batch

Kiểm tra các luồng thông báo, chatbot, ticket và UI warning liên quan tới support flow.

## Vai trò cần dùng

- `OPS`
- `DIRECTOR`
- `ADSMANAGER`
- `PARENT`

## Tiền điều kiện

- Có danh sách notification chưa đọc
- Có chatbot settings với fanpage token và OpenAI token
- Có ticket `REFUND_REQUEST`
- Có dữ liệu conversation chatbot và support chat

## Case trọng tâm

- Notifications load, mark read, mark all as read
- Bulk notification cho Admin/OPS
- `chatbot-settings` load đủ Fanpages, OpenAI Tokens, AI Assistant Profiles
- Fanpage token hiển thị masked
- Form AI config có `System Prompt`, `Temperature`, `Max Tokens`
- Banner đỏ khi OpenAI token hết hạn
- UI chỉ cho gợi ý AI, không auto-send
- Ticket đóng `REFUND_REQUEST` phải cảnh báo nếu thiếu `LedgerEntry`

## Chuỗi đối soát bắt buộc sau submit

- Gửi bulk notification:
  - Mở lại unread count ở account gửi
  - Đăng nhập account nhận để mở `notification list`
  - Click notification để xác nhận redirect
- Tạo lead hoặc order từ conversation chatbot:
  - Mở lại `conversation detail`
  - Mở `lead detail` hoặc `order detail`
  - Đối chiếu source/attribution liên quan
- Lưu `chatbot-settings`, token, assistant profile hoặc auto-reply:
  - Reload màn hiện tại
  - Mở lại detail vừa sửa
  - Nếu có RBAC hoặc masked token, mở thêm bằng role khác để đối chiếu
- Ticket handoff, resolve, reopen, cancel hoặc `REFUND_REQUEST`:
  - Mở lại `ticket detail`
  - Mở `parent support chat`
  - Nếu có cảnh báo tài chính, mở thêm `wallet/ledger` hoặc màn warning liên quan

## Checklist bước test mẫu

1. Đăng nhập bằng role phù hợp.
2. Mở Notifications, Chatbot Settings và Tickets theo thứ tự batch.
3. Kiểm tra state ban đầu: unread count, token masked, banner cảnh báo.
4. Thực hiện thao tác gửi hàng loạt hoặc tạo ticket theo checklist.
5. Quan sát toast, badge, redirect và các cảnh báo UI.
6. Mở các màn đối soát sau submit theo đúng chuỗi ở trên.
7. Ghi lại kết quả bằng tiếng Việt và mốc thời gian video.

## Quy ước video và log

- File video: `UI_B09_Notifications_Chatbot_Tickets_YYYYMMDD.mp4`
- File log: `LOG_B09_Notifications_Chatbot_Tickets_YYYYMMDD.md`
- Khi quay phải thấy rõ action click và phản hồi UI
- Nếu có modal/drawer, phải quay đủ lúc mở và lúc đóng
- Khuyến nghị tách 2 phần:
  - `UI_B09A_Notifications_ChatbotSettings_YYYYMMDD.mp4`
  - `UI_B09B_Chatbot_Tickets_SideEffects_YYYYMMDD.mp4`

## Tiêu chí PASS/FAIL

- PASS nếu notification, chatbot và ticket đều phản hồi đúng
- FAIL nếu token lộ sai, AI auto-send sai, hoặc ticket thiếu warning cần có
- BLOCKED nếu thiếu dữ liệu ticket hoặc token seed

# Sổ Tay Công Việc Ads Manager

## 1. Mục tiêu vai trò

Ads Manager là nhân sự phụ trách:

- Theo dõi tài khoản quảng cáo, nhóm quảng cáo và chi phí chạy ads.
- Đọc hiệu quả theo lợi nhuận thực tế, không chỉ theo số lead hay số tiền đã chi.
- Phối hợp phần chatbot/fanpage để giữ cho nguồn hội thoại, attribution và tracking chạy ổn định.

Role `ADSMANAGER` được cấp quyền làm việc trên 3 màn hình:

- `http://localhost:4200/app/ads-management`
- `http://localhost:4200/app/ads-analytics`
- `http://localhost:4200/app/chatbot-settings`

## 2. Phạm vi quyền

Ads Manager được làm:

- Xem danh sách tài khoản quảng cáo.
- Xem và chỉnh sửa nhóm quảng cáo.
- Xem chi phí ads.
- Xem phân tích ads theo cohort, parent profit, ROI, actionable tasks.
- Xem fanpage, xem token OpenAI đang được gán, chỉnh sửa fanpage/chatbot settings trong phạm vi cho phép.

Ads Manager không được làm:

- Tạo/xóa tài khoản quảng cáo.
- Quản lý thư viện API token ads.
- Nhập/xóa chi phí thủ công.
- Chạy sync hệ thống, backfill dữ liệu cũ.
- Quản lý user, tài chính, audit log và các module ngoài phạm vi ads/chatbot.

## 3. Quy trình làm việc hằng ngày

## 3.1. Đầu ngày

Mục tiêu: biết hôm nay cần xử lý nhóm quảng cáo nào trước.

Thao tác:

1. Vào `ads-management`.
2. Kiểm tra:
   - Tài khoản quảng cáo nào đang hoạt động.
   - Nhóm quảng cáo nào đang chạy, tạm dừng, hoặc có dấu hiệu bất thường.
   - Tab "Việc cần làm" để xem nhóm nào cần xử lý ngay.
3. Ghi lại danh sách nhóm cần theo dõi trong ngày.

Checklist đầu ngày:

- Có nhóm nào chi phí tăng bất thường không?
- Có nhóm nào cần sửa trạng thái hoặc budget không?
- Tracking keys có còn đúng với chiến dịch đang chạy không?
- Fanpage nào đang gắn với ad account nào?

## 3.2. Giữa ngày

Mục tiêu: xác thực hiệu quả dựa trên lợi nhuận.

Thao tác:

1. Vào `ads-analytics`.
2. Lọc theo:
   - Khoảng ngày.
   - Nền tảng.
   - Nhóm quảng cáo.
3. Đọc 3 lớp dữ liệu:
   - Cohort profit.
   - Parent profit.
   - ROI / lợi nhuận theo nhóm.

Nguyên tắc phân tích:

- Không chỉ nhìn `ad spend`.
- Không chỉ nhìn `lead count`.
- Phải đối chiếu thêm:
  - Phụ huynh mới.
  - Doanh thu đã thu.
  - Lợi nhuận thuần.
  - Parent profit nếu cần truy ngược chất lượng nguồn.

## 3.3. Cuối ngày

Mục tiêu: cập nhật hệ thống đúng chỗ, không làm lệch attribution.

Thao tác:

1. Nếu cần chỉnh campaign/group:
   - Quay lại `ads-management`.
   - Cập nhật đúng group cần sửa.
2. Nếu cần chỉnh fanpage/chatbot:
   - Vào `chatbot-settings`.
   - Kiểm tra fanpage, token gán, trạng thái auto-reply.
3. Sau khi chỉnh:
   - Rà lại tracking keys.
   - Rà lại liên kết giữa fanpage và ad account.
   - Ghi chú nội bộ nếu thay đổi có ảnh hưởng đến đo lường.

## 4. Hướng dẫn theo từng màn hình

## 4.1. Ads Management

Mục đích:

- Quản lý danh mục account/group.
- Theo dõi chi phí.
- Xem danh sách việc cần làm.

Những việc Ads Manager nên làm tại đây:

- Rà soát trạng thái nhóm quảng cáo.
- Sửa thông tin nhóm quảng cáo khi cần.
- Kiểm tra chi phí theo khoảng thời gian.
- Ưu tiên xử lý tab "Việc cần làm" trước các thay đổi lớn.

Lưu ý:

- Không sửa group nếu chưa hiểu rõ tracking đang dùng.
- Nếu thay đổi tracking keys, phải đảm bảo phần landing/chatbot đang dùng cùng logic.

## 4.2. Ads Analytics

Mục đích:

- Đọc hiệu quả thực tế theo lợi nhuận.
- Phân biệt nhóm đang lãi, hòa vốn hoặc lỗ.

Những câu hỏi cần trả lời trước khi ra quyết định:

- Nhóm này đang tạo lead rẻ hay đang tạo profit thật?
- Doanh thu đã thu có bù được chi phí quảng cáo và chi phí liên quan chưa?
- Parent profit có cho thấy nguồn này thực sự chất lượng không?

Lưu ý:

- Không ra quyết định tăng giảm budget nếu chưa đọc cohort profit.
- Nếu số liệu chưa đủ chín, ghi chú là "cần theo dõi thêm", không kết luận vội.

## 4.3. Chatbot Settings

Mục đích:

- Kiểm tra fanpage đang dùng.
- Kiểm tra token OpenAI đang được gán cho fanpage.
- Điều chỉnh cấu hình chatbot trong phạm vi được phép.

Những việc Ads Manager nên làm:

- Kiểm tra đúng fanpage đang gắn với đúng ad account.
- Kiểm tra fanpage nào đang bật AI auto reply.
- Cập nhật mô tả hoặc cấu hình fanpage khi có thay đổi vận hành.

Lưu ý:

- Ads Manager chỉ dùng token đã có sẵn, không quản lý thư viện token gốc.
- Sau khi đổi fanpage hoặc gán lại token, cần kiểm tra lại tracking/attribution.

## 5. Checklist theo chu kỳ

## 5.1. Hằng ngày

- Kiểm tra nhóm quảng cáo cần ưu tiên.
- Kiểm tra cohort profit của các nhóm chính.
- Kiểm tra parent profit nếu có dấu hiệu lệch chất lượng.
- Kiểm tra fanpage/chatbot nào vừa thay đổi cấu hình.

## 5.2. Hằng tuần

- Tổng hợp nhóm lãi, nhóm hòa vốn, nhóm lỗ.
- Đối chiếu nhóm chạy tốt với tracking keys và nguồn chatbot đang dùng.
- Ghi lại các thay đổi đã thực hiện trong tuần.

## 5.3. Hằng tháng

- Rà lại toàn bộ group đang active.
- Xác nhận các fanpage còn dùng đúng token và đúng ad account.
- Đánh giá lại nhóm nào nên giữ, dừng hoặc tách nhánh theo dữ liệu lợi nhuận.

## 6. Các lỗi thường gặp

### Lỗi 1: Chỉ nhìn chi phí mà không nhìn lợi nhuận

Hậu quả:

- Dễ cắt nhầm nhóm còn tiềm năng.
- Dễ giữ nhóm tạo lead nhiều nhưng không tạo doanh thu thật.

Cách tránh:

- Luôn đọc `ads-analytics` trước khi đề xuất thay đổi lớn.

### Lỗi 2: Sửa group nhưng quên tracking keys

Hậu quả:

- Attribution sai.
- Chatbot, leads, parent profit bị lệch nguồn.

Cách tránh:

- Mỗi lần sửa group, kiểm tra lại tracking key đang gắn.

### Lỗi 3: Đổi fanpage/chatbot nhưng không đối chiếu ad account

Hậu quả:

- Nguồn hội thoại và nguồn ads không khớp nhau.

Cách tránh:

- Sau mỗi thay đổi trong `chatbot-settings`, quay lại kiểm tra `ads-management`.

## 7. Nguyên tắc phối hợp

- Nếu cần token mới hoặc thay đổi nhạy cảm ở thư viện token: báo Director.
- Nếu dữ liệu lợi nhuận chưa rõ: ghi chú "cần theo dõi thêm", không kết luận cảm tính.
- Nếu thay đổi có thể ảnh hưởng đo lường: phải rà lại tracking trước khi chốt.

## 8. Kết quả đầu ra mong đợi của Ads Manager

Một Ads Manager làm tốt cần đạt:

- Biết nhóm nào cần xử lý trước mỗi ngày.
- Giải thích được quyết định bằng dữ liệu profit, không chỉ bằng cảm giác.
- Giữ cho tracking, fanpage và chatbot không bị lệch nhau.
- Hạn chế tối đa các thay đổi làm hỏng attribution.

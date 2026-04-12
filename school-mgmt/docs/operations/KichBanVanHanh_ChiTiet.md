# Kịch Bản Vận Hành Chi Tiết

## Mục tiêu

Tài liệu này gom toàn bộ các tình huống và luồng thao tác cốt lõi của nhân viên vận hành trong hệ thống. Mục tiêu là:

- dùng cho onboarding OPS mới;
- dùng để quay demo hoặc nghiệm thu UI role vận hành;
- dùng làm checklist rà soát luồng khi test regression.

## Vai trò của nhân viên vận hành

Nhân viên vận hành là người giữ cho lớp học chạy đúng lịch, đúng người, đúng trạng thái. OPS không chỉ theo dõi dashboard mà còn là điểm nối giữa lớp học, sessions, attendance, ticket và xử lý điều phối giáo viên.

## Nhóm luồng chính

### 1. Đọc ưu tiên trong ngày trên Dashboard

Mục tiêu:

- biết lớp nào đang hoạt động;
- biết ticket hoặc đầu việc nào quá hạn;
- biết các request đang chờ duyệt hoặc cần phối hợp.

Các bước:

1. Đăng nhập bằng tài khoản OPS.
2. Mở Dashboard.
3. Đọc các thẻ cảnh báo nổi bật:
   - thẻ màu cam: việc cần xử lý sớm;
   - thẻ màu xanh: lớp đang vận hành;
   - menu pending approvals: request chờ xử lý.
4. Xác định thứ tự ưu tiên cho ca làm việc.

Lưu ý:

- Dashboard là màn định hướng, không phải màn xử lý cuối.
- Nếu thấy ticket quá hạn thì cần vào ticket hoặc lớp liên quan ngay.

### 2. Kiểm tra lớp và roster trên Classes

Mục tiêu:

- xác nhận lớp đang có đúng học sinh;
- xác nhận giáo viên phụ trách đúng;
- chỉnh dữ liệu gốc ngay tại lớp để các màn sau dùng chung dữ liệu chuẩn.

Tình huống thường gặp:

- học sinh mới được xếp vào lớp nhưng chưa có trong roster;
- lớp đang gắn sai giáo viên;
- cần rà lại sĩ số trước khi tạo lịch hoặc điểm danh.

Các bước:

1. Mở màn Classes.
2. Tìm đúng lớp cần xử lý.
3. Mở form chỉnh sửa lớp.
4. Thêm hoặc bỏ học sinh đúng theo roster thực tế.
5. Kiểm tra giáo viên phụ trách.
6. Lưu thay đổi.
7. Kiểm tra lại hàng dữ liệu trên bảng lớp.

Lưu ý:

- Chỉ sửa roster ở màn lớp nguồn.
- Không bỏ qua bước kiểm tra sau khi lưu vì downstream như session và attendance phụ thuộc dữ liệu này.

### 3. Tạo lịch học hàng loạt trên Sessions

Mục tiêu:

- đảm bảo lớp có đủ buổi sắp tới;
- tránh thiếu lịch khi giáo viên vào ca;
- tạo đồng loạt theo ngày và khung giờ chuẩn.

Tình huống thường gặp:

- lớp mới mở cần sinh lịch cả tuần;
- lớp đã có roster nhưng chưa có session tương lai;
- cần bổ sung lịch bù hoặc lịch mới theo tuần tiếp theo.

Các bước:

1. Mở màn Sessions.
2. Chọn tạo session mới.
3. Chuyển sang chế độ bulk create.
4. Chọn lớp.
5. Chọn ngày.
6. Nhập giờ bắt đầu và giờ kết thúc.
7. Xác nhận tạo.
8. Kiểm tra danh sách session tăng thêm sau khi lưu.

Lưu ý:

- Phải chọn đúng lớp trước khi tạo hàng loạt.
- Sau khi tạo cần rà lại bảng session để chắc chắn lịch mới đã phát sinh.

### 4. Chốt buổi học đã hoàn thành

Mục tiêu:

- khóa trạng thái vận hành của buổi học;
- chuyển dữ liệu sang trạng thái sẵn sàng cho payroll và đối soát;
- tránh để session treo ở trạng thái chờ xử lý.

Tình huống thường gặp:

- giáo viên đã dạy xong và đã có báo cáo;
- attendance đã đủ nhưng chưa finalize;
- cần khép buổi học trước cuối ngày.

Các bước:

1. Mở màn Sessions.
2. Lọc theo trạng thái `TEACHER_COMPLETED`.
3. Mở đúng session cần chốt.
4. Kiểm tra lại buổi học đã đủ điều kiện chốt.
5. Bấm chốt buổi từ màn chi tiết.
6. Xác nhận cảnh báo hệ thống.
7. Đổi bộ lọc sang `FINALIZED`.
8. Kiểm tra session đã chuyển trạng thái thành công.

Lưu ý:

- Chỉ chốt khi attendance và báo cáo dạy học đã sẵn sàng.
- Đây là bước có tác động downstream nên không thao tác vội.

### 5. Điểm danh trên Attendance

Mục tiêu:

- ghi nhận chính xác trạng thái có mặt, vắng, đi muộn;
- đảm bảo dữ liệu attendance chốt đúng ngày;
- hỗ trợ các báo cáo cuối ngày.

Tình huống thường gặp:

- điểm danh cả lớp cho buổi hiện tại;
- rà roster thực tế xem có thiếu học sinh;
- chỉnh lại trạng thái sau khi nhận cập nhật từ giáo viên.

Các bước:

1. Mở màn Attendance.
2. Chọn lớp.
3. Chọn ngày cần điểm danh.
4. Bấm tải dữ liệu attendance.
5. Kiểm tra danh sách học sinh hiển thị đúng.
6. Chọn thao tác `mark all present` hoặc chỉnh từng học viên.
7. Bấm lưu attendance.
8. Kiểm tra summary hiển thị lại số lượng trạng thái sau khi save.

Lưu ý:

- Nếu summary không đổi sau khi save thì cần kiểm tra lại response hoặc dữ liệu reload.
- OPS nên rà đúng lớp và đúng ngày trước khi thao tác.

### 6. Tiếp nhận và ghi dấu vết phối hợp trên Ticket

Mục tiêu:

- nhận diện sự cố hoặc yêu cầu phát sinh;
- tập trung lịch sử trao đổi vào một nơi;
- để lại comment điều phối rõ ràng cho các bên liên quan.

Tình huống thường gặp:

- giáo viên xin nghỉ đột xuất;
- phụ huynh báo đổi giờ hoặc phản ánh lớp;
- lớp cần phối hợp liên phòng ban.

Các bước:

1. Mở màn Tickets.
2. Chuyển sang tab danh sách tổng.
3. Chọn đúng ticket cần xử lý.
4. Đọc nội dung gốc và trạng thái hiện tại.
5. Ghi comment điều phối, ví dụ đã tiếp nhận và đang xử lý thay giáo viên.
6. Gửi comment.
7. Kiểm tra comment đã xuất hiện trong lịch sử.

Lưu ý:

- Comment cần ngắn, rõ, thể hiện đã nhận việc và đang xử lý gì.
- Ticket là nơi lưu dấu vết phối hợp, không nên xử lý ngoài luồng rồi bỏ trống lịch sử.

### 7. Điều phối thay giáo viên trên Classes

Mục tiêu:

- cập nhật giáo viên thay thế ở đúng nguồn dữ liệu lớp;
- bảo đảm các session tiếp theo dùng đúng giáo viên;
- khép vòng xử lý phát sinh từ ticket.

Tình huống thường gặp:

- giáo viên xin nghỉ đột xuất;
- lớp cần điều chuyển giáo viên phụ trách;
- cần cập nhật người dạy thay ngay trong ngày.

Các bước:

1. Quay lại màn Classes.
2. Mở lớp đang phát sinh.
3. Chọn giáo viên thay thế trong form chỉnh sửa.
4. Lưu thay đổi.
5. Kiểm tra bảng lớp đã phản ánh giáo viên mới.

Lưu ý:

- Điều phối giáo viên phải thực hiện ở màn lớp nguồn.
- Không chỉ comment trong ticket mà quên cập nhật lớp.

### 8. Đóng ticket sau khi xử lý xong

Mục tiêu:

- đưa ticket về trạng thái resolved;
- lưu tóm tắt kết quả cuối cùng;
- hoàn tất vòng tiếp nhận, điều phối và xác nhận.

Tình huống thường gặp:

- đã đổi được giáo viên dạy thay;
- yêu cầu đã được phản hồi đầy đủ;
- sự cố đã có hướng xử lý cuối cùng.

Các bước:

1. Mở lại ticket vừa điều phối.
2. Chọn thao tác giải quyết ticket.
3. Nhập tóm tắt xử lý cuối cùng.
4. Xác nhận đóng ticket.
5. Kiểm tra header hoặc trạng thái ticket đã chuyển sang `resolved`.

Lưu ý:

- Chỉ đóng ticket sau khi có kết quả thực tế.
- Phần tóm tắt phải đủ rõ để người khác đọc lại vẫn hiểu kết quả.

### 9. Đăng xuất và kết thúc ca

Mục tiêu:

- kết thúc phiên làm việc an toàn;
- tránh nhầm role khi chuyển sang account khác;
- đóng vòng thao tác của video demo hoặc phiên kiểm thử.

Các bước:

1. Bấm đăng xuất ở sidebar.
2. Kiểm tra quay lại màn login.
3. Kết thúc ca làm việc hoặc chuyển sang user khác nếu cần test tiếp.

## Checklist quay video vận hành

- Có title card mở đầu nêu rõ phạm vi luồng.
- Có chú thích tiếng Việt từng bước.
- Có callout đỏ vào vùng thao tác chính.
- Có narration tiếng Việt đồng bộ với mỗi chặng.
- Có title card kết thúc tóm tắt các nhóm luồng.
- Có artifact narration và manifest để render lại.

## Checklist nghiệm thu

- Dashboard hiển thị đúng các thẻ ưu tiên.
- Classes lưu roster và giáo viên đúng sau chỉnh sửa.
- Sessions tạo hàng loạt xong có dữ liệu mới trên bảng.
- Session finalize chuyển trạng thái đúng.
- Attendance lưu xong reload lại đúng summary.
- Ticket có comment điều phối.
- Ticket resolve xong hiển thị trạng thái đã giải quyết.
- Video export ra `.mp4` và có audio narration tiếng Việt.

# Kịch Bản Giáo Viên Chi Tiết

## Mục tiêu

Tài liệu này gom toàn bộ các luồng nghiệp vụ cốt lõi của giáo viên trong hệ thống để dùng cho:

- onboarding giáo viên mới;
- quay demo role giáo viên;
- rà soát regression khi nghiệm thu UI;
- làm checklist thao tác hằng ngày trước, trong và sau buổi dạy.

## Vai trò của giáo viên trong hệ thống

Giáo viên là người trực tiếp chuẩn bị buổi học, điểm danh, hoàn thành session, nộp teaching report và theo dõi phần thu nhập của chính mình. Ngoài luồng dạy học, giáo viên còn phải phối hợp với OPS khi có phát sinh xin nghỉ, đổi ca hoặc cần giáo viên thay thế.

## Nhóm luồng chính

### 1. Đăng nhập và đọc dashboard đầu ngày

Mục tiêu:

- vào đúng workspace của giáo viên;
- đọc nhanh các ưu tiên trong ngày;
- biết còn buổi nào sắp dạy, ticket nào đang mở và thu nhập đang ở trạng thái nào.

Các bước:

1. Đăng nhập bằng tài khoản giáo viên.
2. Mở `Dashboard`.
3. Đọc khối cẩm nang nội bộ để vào nhanh hướng dẫn và checklist.
4. Kiểm tra các thẻ tổng quan:
   - buổi học sắp tới;
   - tổng thu nhập;
   - lớp đang dạy;
   - ticket đang mở.
5. Kiểm tra bảng `Lịch dạy sắp tới` để biết ca gần nhất.

Lưu ý:

- Dashboard là điểm định hướng đầu ngày, không phải nơi xử lý chi tiết cuối cùng.
- Nếu dashboard hiển thị có lớp sắp dạy nhưng chưa chuẩn bị giáo án hoặc attendance, giáo viên phải xử lý ngay trước giờ vào lớp.

### 2. Mở lịch dạy và rà đúng buổi học

Mục tiêu:

- xác nhận đúng khung giờ, lớp, học sinh và trạng thái của buổi dạy;
- tránh nhầm ca hoặc bỏ sót session đang chờ báo cáo.

Các bước:

1. Vào `Lịch dạy`.
2. Kiểm tra tuần hiện tại.
3. Mở một thẻ session bất kỳ.
4. Đọc phần chi tiết mở rộng để xác nhận:
   - lớp;
   - học sinh;
   - thời gian;
   - trạng thái session;
   - trạng thái báo cáo nếu đã có.

Lưu ý:

- Luồng này nên thực hiện trước giờ dạy để chắc chắn buổi cần xử lý là đúng.
- Nếu lịch trống bất thường, cần kiểm tra lại bộ lọc tuần hoặc báo OPS.

### 3. Tìm tài liệu giảng dạy

Mục tiêu:

- lấy đúng giáo án hoặc học liệu trước buổi dạy;
- tránh mở nhầm tài liệu khi cùng chủ đề nhưng khác bài.

Các bước:

1. Vào `Tài liệu GD`.
2. Gõ từ khóa bài học vào ô tìm kiếm.
3. Kiểm tra kết quả đã lọc.
4. Mở đúng material card tương ứng với buổi sắp dạy.

Lưu ý:

- Nên tìm theo tên bài, chủ đề hoặc mã buổi nếu đội ngũ đã chuẩn hóa.
- Nếu không tìm thấy tài liệu, giáo viên cần báo lại sớm thay vì chờ sát giờ lên lớp.

### 4. Tạo link điểm danh cho học sinh

Mục tiêu:

- chuẩn bị attendance link đúng lớp, đúng ngày;
- gửi nhanh cho học sinh trước hoặc đầu buổi học.

Các bước:

1. Vào `Điểm danh`.
2. Chọn đúng lớp.
3. Chọn đúng ngày học.
4. Bấm tải danh sách attendance.
5. Kiểm tra roster học sinh hiển thị đúng.
6. Bấm tạo link điểm danh cho học sinh cần gửi.
7. Xác nhận hệ thống đã copy link vào clipboard.

Lưu ý:

- Attendance link gắn trực tiếp với lớp và ngày đã chọn, nên không được thao tác khi filter sai.
- Nếu roster thiếu học sinh, cần dừng để kiểm tra lại dữ liệu lớp trước khi gửi link.

### 5. Hoàn thành buổi học trên sessions

Mục tiêu:

- chốt việc giáo viên đã dạy xong buổi đó;
- ghi lại nội dung đã dạy, bài tập về nhà và ghi chú;
- chuẩn bị dữ liệu cho teaching report và payroll.

Các bước:

1. Vào `Buổi học`.
2. Tìm session ở trạng thái `SCHEDULED`.
3. Mở chi tiết buổi học để rà lại lớp và học sinh.
4. Đóng modal chi tiết sau khi xác nhận đúng session.
5. Bấm `Hoàn thành`.
6. Điền:
   - nội dung đã dạy;
   - bài tập về nhà;
   - ghi chú giáo viên.
7. Gửi form hoàn thành session.
8. Kiểm tra session đã đổi sang trạng thái giáo viên hoàn thành.

Lưu ý:

- Không nên bỏ trống nội dung buổi học vì dữ liệu này là nền cho báo cáo và đối soát.
- Nếu hoàn thành nhầm session, OPS và payroll sẽ bị ảnh hưởng downstream.

### 6. Nộp teaching report

Mục tiêu:

- nộp báo cáo chính thức sau buổi dạy;
- chuyển session sang nhóm đã có report;
- tránh bị giữ lại ở payroll do thiếu báo cáo.

Các bước:

1. Vào `BC Giảng dạy`.
2. Chuyển sang tab `Chưa có báo cáo`.
3. Mở rộng đúng session cần nộp.
4. Chọn đúng template báo cáo.
5. Điền các trường động, ví dụ:
   - rating;
   - nhận xét buổi học.
6. Gửi báo cáo.
7. Kiểm tra thông báo nộp thành công.
8. Chuyển sang tab `Đã có báo cáo`.
9. Mở lại session vừa nộp để xác nhận nội dung đã lưu đúng.

Lưu ý:

- Teaching report là điều kiện quan trọng để session đủ điều kiện tính lương.
- Nhận xét nên đủ rõ để phụ huynh, OPS hoặc người duyệt đọc lại vẫn hiểu chất lượng buổi học.

### 7. Xem payroll preview

Mục tiêu:

- kiểm tra phần thu nhập của giáo viên theo kỳ;
- biết session nào đã thanh toán, đang chờ OPS xác nhận hoặc bị thiếu điều kiện.

Các bước:

1. Vào `Lương GV`.
2. Chọn `Từ ngày` và `Đến ngày` của kỳ cần xem.
3. Bấm xem preview.
4. Đọc khối tổng hợp:
   - đã thanh toán;
   - chờ OPS xác nhận;
   - thiếu báo cáo.
5. Rà bảng session bên dưới nếu cần đối chiếu từng buổi.

Lưu ý:

- Nếu khối tổng hợp có `thiếu báo cáo`, giáo viên phải quay lại teaching report để xử lý.
- Preview chỉ là màn hình đối soát, không phải màn chốt lương.

### 8. Tạo yêu cầu giáo viên dạy thay hoặc xin nghỉ

Mục tiêu:

- báo phát sinh sớm cho OPS;
- để lại dấu vết xử lý chính thức thay vì báo miệng;
- giúp điều phối thay giáo viên đúng lớp và đúng ngày.

Các bước:

1. Vào `Xin nghỉ/Thay thế`.
2. Bấm `Tạo yêu cầu`.
3. Chọn lớp.
4. Nhập từ ngày và đến ngày.
5. Ghi lý do phát sinh rõ ràng.
6. Gửi yêu cầu.
7. Kiểm tra thông báo thành công.
8. Kiểm tra request mới đã xuất hiện trên danh sách.

Lưu ý:

- Ngày và lý do phải rõ để OPS có thể điều phối ngay.
- Không nên chỉ nhắn riêng cho OPS mà bỏ qua form chính thức vì sẽ mất dấu vết xử lý.

### 9. Đăng xuất

Mục tiêu:

- kết thúc phiên làm việc an toàn;
- tránh lẫn phiên khi chuyển sang tài khoản khác để kiểm tra hoặc demo.

Các bước:

1. Bấm `Đăng xuất` ở sidebar.
2. Xác nhận hệ thống quay về màn `Login`.

## Tình huống phụ và ngoại lệ nên cover ở bản extended

### A. Tình huống đăng nhập lỗi

- Sai email hoặc sai mật khẩu.
- Tài khoản bị khóa hoặc hết phiên.
- Refresh trang nhưng session vẫn phải được khôi phục đúng.

### B. Tình huống attendance thiếu dữ liệu

- Chưa chọn lớp hoặc chưa chọn ngày mà đã bấm tải dữ liệu.
- Chọn sai ngày nên roster không khớp.
- Tạo link cho học sinh nhưng clipboard không ghi được, cần có thông báo rõ.

### C. Tình huống session chưa đủ điều kiện

- Session chưa được giáo viên hoàn thành nhưng đã vào teaching report.
- Session đã hoàn thành nhưng chưa nộp report nên payroll đánh dấu thiếu điều kiện.
- Session mở sai lớp hoặc sai học sinh nên phải dừng trước khi chốt.

### D. Tình huống request thay giáo viên không hợp lệ

- Đến ngày nhỏ hơn từ ngày.
- Thiếu lý do phát sinh.
- Chọn nhầm lớp không phải lớp mình đang phụ trách.

### E. Luồng phụ ngoài video chính

- cập nhật hồ sơ cá nhân và thông tin ngân hàng;
- xem chấm công/work sessions;
- xem lớp mình đang phụ trách;
- tạo ticket hỗ trợ;
- nhắn tin nội bộ;
- xem báo cáo điểm danh.

## Checklist quay video giáo viên

- Có title card mở đầu nêu rõ phạm vi video.
- Có caption tiếng Việt theo từng chặng.
- Có callout đỏ vào đúng vùng thao tác quan trọng.
- Có narration tiếng Việt đồng bộ với các bước chính.
- Có title card kết thúc để tóm tắt lại toàn bộ workflow.
- Có `narration-cues.json`, `narration-script.md` và `render-manifest.json` để render lại.

## Checklist nghiệm thu

- Đăng nhập xong vào đúng dashboard giáo viên.
- Dashboard hiển thị đúng handbook card, thẻ thu nhập và lịch dạy sắp tới.
- Calendar mở được chi tiết session.
- Materials lọc đúng theo từ khóa.
- Attendance tải đúng roster và tạo được link.
- Session đổi trạng thái sau khi giáo viên hoàn thành.
- Teaching report nộp xong chuyển sang tab đã có báo cáo.
- Payroll preview hiển thị đúng các nhóm tổng hợp.
- Yêu cầu dạy thay tạo xong xuất hiện ở danh sách.
- Video xuất được `.mp4` có audio narration tiếng Việt.

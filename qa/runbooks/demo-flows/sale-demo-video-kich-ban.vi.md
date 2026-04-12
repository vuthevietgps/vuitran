# Kịch bản Video Sale Theo Công Việc Hằng Ngày

## Mục tiêu

- Làm rõ một ngày làm việc thực tế của Sale: nhận lead, theo dõi khách, tạo order cho học sinh mới và học sinh cũ, gửi duyệt, rồi kiểm tra các dữ liệu phát sinh sau duyệt.
- Chỉ dùng các flow đủ ổn để quay showcase, không cố nhồi tất cả edge case.
- Giữ góc nhìn chính là `SALE`, chỉ chuyển sang `DIRECTOR` rất ngắn ở đoạn duyệt order.

## Thời lượng đề xuất

- `7 đến 8 phút`

## Màn hình nên dùng

- `SALE`: `/app/leads`
- `SALE`: `/app/orders`
- `SALE`: `/app/students`
- `SALE`: `/app/invoices`
- `DIRECTOR`: `/app/orders` hoặc `/app/pending-approvals`

## Chuẩn bị trước khi quay

- Đăng nhập sẵn 2 tab:
  - `SALE`
  - `DIRECTOR`
- Chuẩn bị sẵn 1 gói học và dữ liệu lớp có thể chọn trong form order.
- Chuẩn bị sẵn 1 phụ huynh và 1 học sinh đã tồn tại để quay tình huống học sinh cũ.
- Nếu muốn giảm rủi ro, chuẩn bị sẵn 1 order đã ở trạng thái `SUBMITTED` để đoạn duyệt không phụ thuộc thao tác vừa tạo.

## Cấu trúc video

| Mốc thời gian | Màn hình | Thao tác chính | Lời thoại gợi ý |
|---|---|---|---|
| `00:00 - 00:30` | `SALE /app/leads` | Mở danh sách lead, nhìn nhanh pipeline và danh sách cần follow-up. | “Đây là góc làm việc hằng ngày của đội Sale. Mọi đầu việc bắt đầu từ danh sách lead, trạng thái chăm sóc và các khách đang cần xử lý tiếp.” |
| `00:30 - 01:10` | `SALE /app/leads` | Mở 1 lead có sẵn, xem thông tin phụ huynh, nguồn lead, ghi chú hoặc lịch sử contact nếu có. | “Sale không làm việc rời rạc qua chat. Mỗi lead có nguồn vào, người phụ trách và lịch sử chăm sóc để không mất ngữ cảnh.” |
| `01:10 - 02:50` | `SALE /app/orders` | Tạo order cho tình huống `phụ huynh mới, học sinh mới`: nhập số điện thoại mới, nhập tên phụ huynh và học sinh, chọn gói học, số buổi, giảm giá hợp lệ, upload chứng từ, rồi submit order. | “Tình huống đầu tiên là khách hoàn toàn mới. Sale có thể tạo order trực tiếp, hệ thống tự xử lý luồng parent và student thay vì phải tạo tay ở nhiều màn.” |
| `02:50 - 04:10` | `SALE /app/orders` | Tạo order cho tình huống `phụ huynh cũ, học sinh cũ`: chọn dữ liệu đã có sẵn, chọn lại gói học hoặc gói tiếp theo, kiểm tra giá tiền và submit. | “Tình huống thứ hai là khách cũ quay lại hoặc mua tiếp. Sale chỉ cần chọn đúng phụ huynh và học sinh đã có, không phải nhập lại toàn bộ dữ liệu và không bị trùng hồ sơ.” |
| `04:10 - 04:40` | `SALE /app/orders` | Quay lại list orders, cho thấy các trạng thái như `DRAFT`, `SUBMITTED`, `APPROVED`; dùng search hoặc filter nhanh nếu có dữ liệu phù hợp. | “Sau khi submit, Sale theo dõi được ngay đơn nào đang nháp, đơn nào đã gửi duyệt và đơn nào đã xong.” |
| `04:40 - 05:20` | `DIRECTOR /app/orders` hoặc `/app/pending-approvals` | Mở tab Director, duyệt 1 order vừa submit hoặc order đã chuẩn bị sẵn. | “Khi cần phê duyệt, quy trình chuyển sang người có thẩm quyền. Order không được duyệt qua tin nhắn hay gọi điện, mà đi đúng workflow trong hệ thống.” |
| `05:20 - 06:10` | `SALE /app/invoices` | Quay lại tab Sale, mở màn hình invoices và tìm invoice vừa phát sinh từ order đã duyệt. | “Sau khi order được duyệt, Sale thấy ngay dữ liệu liên đới phát sinh. Hóa đơn được tạo ra trong luồng chuẩn, giúp đội bán hàng bám sát được tiến độ chốt và thanh toán.” |
| `06:10 - 06:50` | `SALE /app/students` | Mở danh sách học sinh, tìm học sinh vừa được provision hoặc liên kết từ order. | “Với học sinh mới, hồ sơ được đưa sang danh sách học sinh đúng luồng. Với học sinh cũ, hệ thống giữ liên kết đúng và tránh tạo trùng.” |
| `06:50 - 07:30` | `SALE /app/leads` hoặc `/app/orders` | Kết bằng màn hình tổng hợp công việc trong ngày: lead đang theo, order đang chờ duyệt, order đã duyệt. | “Một vòng làm việc của Sale được nối từ lead đến order và sang các bước sau duyệt. Nhờ vậy đội Sale nhìn được toàn bộ pipeline, không chỉ dừng ở khâu nhập thông tin.” |

## Các tình huống đã được bao quát trong video này

- Lead đang theo dõi hằng ngày.
- Khách hoàn toàn mới tạo order trực tiếp từ số điện thoại mới.
- Khách cũ hoặc học sinh cũ mua tiếp bằng dữ liệu đã có sẵn.
- Kiểm tra validation giá trị order trước khi submit.
- Upload chứng từ kèm order.
- Submit order vào luồng duyệt.
- Director duyệt order.
- Invoice phát sinh sau duyệt.
- Học sinh được tạo mới hoặc liên kết đúng sau duyệt.
- Sale theo dõi lại pipeline công việc trong ngày.

## Bản quay an toàn nhất

- Không tạo lead live nếu dữ liệu demo chưa sạch; chỉ mở lead đã có sẵn để nói về follow-up.
- Tạo live 1 order cho `khách mới`.
- Mở sẵn 1 order của `khách cũ` đã tạo trước đó để rút ngắn thời gian.
- Dùng 1 order `SUBMITTED` có sẵn cho đoạn Director duyệt nếu muốn giảm rủi ro.
- Sau duyệt chỉ kiểm tra `Invoices` và `Students`, không mở thêm các flow finance sâu.

## Những đoạn có thể chèn thêm nếu muốn video dài hơn

- Trial enrollment rồi convert sang order.
- Chuyển lead về pool hoặc mark lost để nói về quản lý đầu mối.
- Mở `commission report` hoặc dashboard sale nếu bạn muốn nhấn mạnh hiệu suất đội bán hàng.

## Những đoạn không nên quay ở phiên bản showcase nhanh

- `partial payment`
- `trial 0đ` offline
- reject order rồi quay lại giải thích `rejection reason`
- các nhánh tài chính sâu như payroll, supplier, reconciliation

## Script đọc ngắn

- “Đội Sale bắt đầu ngày làm việc từ danh sách lead và các khách cần follow-up.”
- “Với khách mới, Sale có thể tạo order trực tiếp từ số điện thoại mới mà không cần tạo tay nhiều lần.”
- “Với khách cũ, hệ thống cho phép chọn lại phụ huynh và học sinh đã có để lên đơn nhanh và không trùng dữ liệu.”
- “Sau khi submit, order đi vào luồng duyệt rõ ràng thay vì xử lý ngoài hệ thống.”
- “Khi order được duyệt, hóa đơn và dữ liệu học sinh liên quan được sinh ra đúng flow.”
- “Điểm quan trọng là Sale nhìn được cả đầu vào, trạng thái đơn và kết quả sau duyệt trong cùng một hệ thống.”

## Gợi ý bước tiếp theo

- Nếu bạn muốn, tôi có thể dựng tiếp một file `spec` auto quay riêng cho video Sale dựa đúng kịch bản này.

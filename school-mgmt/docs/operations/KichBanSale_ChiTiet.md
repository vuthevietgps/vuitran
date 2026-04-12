# Kịch Bản Sale Chi Tiết

Tài liệu này tổng hợp toàn bộ kịch bản Sale đang có trong codebase tại thời điểm rà soát ngày 2026-04-12.
Phạm vi được gom theo những màn hình và quyền thực sự đang mở cho `SALE`, cộng với các bước bàn giao mà Sale phải theo dõi dù thao tác cuối thuộc `DIRECTOR` hoặc `OPS`.

## 1. Phạm vi vai trò Sale hiện tại

- Đọc `Dashboard Sale`, `Leads`, `Orders`, `Trial Enrollments`, `Students`, `Classes`, `Sessions`, `Invoices`, `Commission Report`, `Conversations`, `Landing Pages`, `Messages`, `Teacher Profiles`, `Internal Handbook`, `Sale Hub`.
- Tạo và sửa `Parent account` trong `Users Management` khi ở chế độ phụ huynh.
- Tạo và sửa `Student`.
- Tạo lead, ghi contact history, convert lead sang order, theo dõi follow-up.
- Tạo order mới, order cho khách cũ, gửi duyệt, theo dõi invoice và student sau duyệt.
- Tạo trial offline và theo dõi quyết định học thử.
- Gửi yêu cầu đổi buổi hoặc đổi giáo viên cho session đang `SCHEDULED`.

## 2. Quy ước quay video

- `Caption`: câu mô tả ngắn xuất hiện ở cạnh dưới video.
- `Khoanh đỏ`: callout đỏ vào vùng chính cần người xem nhìn ngay.
- `Ghi chú`: câu giải thích ngắn cho người mới onboarding.
- `Actor`: vai trò trực tiếp thao tác trong cảnh.
- `Phối hợp`: vai trò liên đới cần nhắc đến trong lời dẫn.

## 3. Danh sách kịch bản Sale

| Mã | Nhóm | Actor | Màn hình | Tình huống | Kết quả mong đợi |
| --- | --- | --- | --- | --- | --- |
| S01 | Daily start | Sale | `/app/dashboard` | Đọc funnel, follow-up, doanh thu, hoa hồng chờ duyệt | Sale biết việc cần ưu tiên trong ngày |
| S02 | Onboarding | Sale | `/app/sale-hub` | Xem đúng 5 bước chuẩn: parent -> student -> invoice/order -> gate tài chính -> class | Sale mới nắm đúng thứ tự thao tác |
| S03 | CRM lead | Sale | `/app/leads` | Tạo lead mới từ nguồn Facebook/Google/TikTok/Zalo/Referral/Walk-in | Lead có mã, nguồn, giá trị ước tính, notes |
| S04 | CRM lead | Sale | `/app/leads` | Tìm lead theo keyword, source, status; xem tab pool, stale, follow-up | Sale lọc được đúng tập khách cần xử lý |
| S05 | CRM lead | Sale | `/app/leads` | Mở lead detail, xem timeline contact, attribution merge, assignment history | Sale có đủ bối cảnh trước khi tư vấn |
| S06 | CRM lead | Sale | `/app/leads` | Ghi nhận cuộc gọi/Zalo/email và hẹn follow-up | Lịch sử chăm sóc được cập nhật, lead có `nextFollowUp` |
| S07 | CRM lead | Sale | `/app/leads` | Đánh dấu lead mất với reason chuẩn | Lead ra khỏi pipeline active |
| S08 | CRM lead | Director/OPS | `/app/leads` | Phân bổ, đổi sale, trả lead về pool, xử lý stale lead > 7 ngày | Ownership lead rõ ràng, tránh lead rơi |
| S09 | CRM lead | Sale | `/app/leads` -> `/app/orders` | Convert lead ở trạng thái `INTERESTED` sang order | Order form nhận sẵn dữ liệu lead |
| S10 | Chatbot | Sale | `/app/conversations` | Tiếp quản hội thoại AI đang xử lý | Hội thoại chuyển sang `HUMAN_HANDLING` |
| S11 | Chatbot | Sale | `/app/conversations` | Tạo lead hoặc order trực tiếp từ hội thoại | Không mất dữ liệu từ kênh chatbot sang CRM |
| S12 | Master data | Sale | `/app/users?role=PARENT` | Tạo/sửa parent account trong phạm vi sale phụ trách | Parent có owner rõ ràng, không tạo sai người |
| S13 | Master data | Director | `/app/users?role=PARENT` | Chuyển owner parent sang sale khác | Dữ liệu parent đổi đúng người phụ trách |
| S14 | Master data | Sale | `/app/students` | Tạo học sinh mới, gắn đúng parent chính và parent phụ, upload ảnh | Student record đầy đủ để lên order/lớp |
| S15 | Orders | Sale | `/app/orders` | Tạo order cho khách hoàn toàn mới | Có order nháp với phụ huynh và học sinh mới |
| S16 | Orders | Sale | `/app/orders` | Tạo order cho khách cũ bằng cách chọn lại parent và student cũ | Không tạo trùng hồ sơ |
| S17 | Orders | Sale | `/app/orders` | Chọn product, sessions, invoice sessions, lớp hiện có hoặc để xếp lớp sau | Order phản ánh đúng gói bán |
| S18 | Orders | Sale | `/app/orders` | Kiểm tra discount, installment, receipt upload, consultation notes | Order hợp lệ trước khi gửi duyệt |
| S19 | Orders | Sale | `/app/orders` | Gửi duyệt order ở trạng thái `DRAFT` hoặc `NEEDS_INFO` | Order chuyển `SUBMITTED` |
| S20 | Orders | Director/OPS | `/app/orders` | Duyệt order, yêu cầu bổ sung, từ chối, hủy | Sale hiểu vì sao đơn được duyệt hoặc bị trả |
| S21 | Downstream | Sale | `/app/invoices`, `/app/students` | Kiểm tra invoice và student phát sinh sau duyệt | Bàn giao vận hành không bị sót |
| S22 | Trial offline | Sale | `/app/trial-enrollments` | Tạo học thử offline, chọn lớp và gói offline | Có trial record riêng trước hóa đơn |
| S23 | Trial offline | Director/OPS | `/app/trial-enrollments` | Chuyển waiting decision, convert, reject, teacher-paid-only | Trial được chốt đúng logic tài chính |
| S24 | Scheduling | Sale | `/app/sessions` | Gửi yêu cầu đổi lịch/đổi giáo viên cho session `SCHEDULED` | Có change request chờ duyệt và lưu impact |
| S25 | Báo cáo | Sale | `/app/commission-report` | Đối chiếu doanh thu, hoa hồng, đơn chờ duyệt | Sale theo dõi hiệu quả chốt đơn |
| S26 | Phối hợp | Sale | `/app/landing-pages`, `/app/notifications`, `/app/messages` | Theo dõi nguồn lead, thông báo, tin nhắn nội bộ khi cần phối hợp | Sale không bỏ sót đầu vào và việc liên phòng ban |

## 4. Kịch bản chi tiết để quay

### S01. Đọc Dashboard Sale đầu ngày

- Mục tiêu: xác định lead nào nóng, follow-up nào đến hạn, doanh thu tháng và hoa hồng chờ duyệt.
- Actor: Sale.
- Các bước:
  1. Đăng nhập tài khoản sale.
  2. Mở `Dashboard Sale`.
  3. Đọc 6 ô KPI: conversion rate, doanh thu tháng, tổng doanh thu, hoa hồng đã nhận, leads đang xử lý, hoa hồng chờ duyệt.
  4. Cuộn xuống xem `Phễu chuyển đổi Lead`, `Follow-up hôm nay`, `Đơn hàng gần đây`, `Pipeline đơn hàng`.
- Caption: "Sale bắt đầu từ dashboard để biết việc cần làm trước."
- Khoanh đỏ:
  - `sale-dashboard-kpi-grid`
  - khối `Follow-up hôm nay`
  - bảng `Đơn hàng gần đây`
- Ghi chú: nếu dashboard trống, giải thích đây là trạng thái onboarding an toàn chứ không phải lỗi dữ liệu.

### S02. Mở Sale Hub để onboarding đúng 5 bước

- Mục tiêu: đào tạo sale mới theo thứ tự chuẩn.
- Actor: Sale.
- Các bước:
  1. Mở `Sale Hub`.
  2. Giải thích 5 bước: parent -> student -> invoice/order -> gate tài chính -> class.
  3. Chỉ rõ rule "không tạo lớp khi chưa duyệt hóa đơn hoặc phụ huynh chưa có số dư".
- Caption: "Sale Hub là bản tóm tắt luồng chuẩn cho sale mới."
- Khoanh đỏ:
  - hero card
  - 5 workflow cards
  - gate tài chính

### S03. Tạo lead mới

- Mục tiêu: đưa khách tiềm năng mới vào CRM.
- Actor: Sale.
- Các bước:
  1. Mở `Leads`.
  2. Nhấn `+ Thêm Lead`.
  3. Nhập parent, phone, email, student, grade, source, estimated value, notes.
  4. Nếu nguồn là ad platform, chọn ad group tương ứng.
  5. Lưu lead.
- Caption: "Lead là điểm bắt đầu của toàn bộ pipeline sale."
- Khoanh đỏ:
  - nút `+ Thêm Lead`
  - form `source`
  - field `estimatedValue`

### S04. Lọc lead theo tab và bộ lọc

- Mục tiêu: tìm đúng nhóm lead cần xử lý ngay.
- Actor: Sale hoặc Director/OPS khi điều phối.
- Các bước:
  1. Tìm theo keyword.
  2. Lọc theo status và source.
  3. Chuyển qua tab `Follow-up`.
  4. Với vai trò staff, mở thêm `Pool` và `Stale`.
- Caption: "Không phải lead nào cũng xử lý giống nhau; tab nào cũng là một ưu tiên khác nhau."
- Khoanh đỏ:
  - thanh filter
  - tab `Follow-up`
  - badge số lượng

### S05. Mở lead detail và đọc bối cảnh

- Mục tiêu: tư vấn có ngữ cảnh, không gọi khách như khách mới khi hệ thống đã có lịch sử.
- Actor: Sale.
- Các bước:
  1. Bấm vào một dòng lead.
  2. Đọc thông tin phụ huynh, học sinh, nguồn, sale phụ trách, estimated value.
  3. Xem `Lịch sử liên hệ`.
  4. Nếu có dữ liệu marketing, xem `Attribution Merge`.
- Caption: "Lead detail là chỗ đọc lại toàn bộ bối cảnh trước khi chốt bước tiếp."
- Khoanh đỏ:
  - tiêu đề lead
  - timeline liên hệ
  - attribution summary

### S06. Ghi nhận contact và hẹn follow-up

- Mục tiêu: chuẩn hóa hoạt động chăm sóc.
- Actor: Sale.
- Các bước:
  1. Nhấn nút gọi/liên hệ trên dòng lead.
  2. Chọn method: call, Zalo, email, meet, SMS.
  3. Ghi notes.
  4. Chọn ngày follow-up tiếp theo.
  5. Lưu.
- Caption: "Mỗi lần gọi hoặc nhắn đều cần để lại dấu vết trên hệ thống."
- Khoanh đỏ:
  - modal `Ghi nhận liên hệ`
  - field `Hẹn follow-up`

### S07. Đánh dấu lead mất

- Mục tiêu: làm sạch pipeline, tránh conversion rate ảo.
- Actor: Sale.
- Các bước:
  1. Bấm nút mất lead.
  2. Chọn reason: giá cao, chọn nơi khác, không còn nhu cầu, không liên lạc được, lịch không phù hợp.
  3. Bổ sung notes nếu cần.
  4. Xác nhận.
- Caption: "Lead mất cũng là dữ liệu; phải chốt reason thay vì để treo."
- Khoanh đỏ:
  - dropdown reason
  - nút xác nhận mất

### S08. Phân bổ, đổi sale, trả pool

- Mục tiêu: giữ ownership rõ ràng.
- Actor: Director hoặc OPS.
- Phối hợp: Sale.
- Các bước:
  1. Mở lead chưa phân bổ.
  2. Chọn sale phụ trách.
  3. Khi cần, đổi sale hoặc trả về pool.
  4. Kiểm tra assignment history.
- Caption: "Nhánh này dành cho điều phối lead, không phải cho sale tự chuyển owner."
- Khoanh đỏ:
  - nút `Phân bổ`
  - `Lịch sử phân bổ`

### S09. Convert lead sang order

- Mục tiêu: chuyển lead đủ điều kiện thành hồ sơ đăng ký.
- Actor: Sale.
- Các bước:
  1. Đảm bảo lead đang ở trạng thái `INTERESTED`.
  2. Nhấn `Chuyển đổi`.
  3. Hệ thống mở `Orders` với dữ liệu lead được điền sẵn.
- Caption: "Lead chỉ convert khi đã đủ điều kiện tư vấn."
- Khoanh đỏ:
  - nút `Chuyển đổi -> Đơn ĐK`
  - query `fromLead` trên `Orders`

### S10. Tiếp quản hội thoại chatbot

- Mục tiêu: nối kênh marketing/chatbot với sale mà không làm mất ngữ cảnh.
- Actor: Sale.
- Các bước:
  1. Mở `Conversations`.
  2. Chọn hội thoại AI đang xử lý.
  3. Nhấn `Tiếp quản`.
  4. Đọc sidebar thông tin khách hàng và fanpage.
- Caption: "Hội thoại cần được sale tiếp quản đúng lúc, không bỏ rơi khách đang nhắn."
- Khoanh đỏ:
  - trạng thái `AI_HANDLING`
  - nút `Tiếp quản`
  - sidebar customer info

### S11. Tạo lead hoặc order từ hội thoại

- Mục tiêu: chuyển kênh chat thành lead hoặc order mà không nhập lại thủ công.
- Actor: Sale.
- Các bước:
  1. Trong sidebar, mở `Tạo Lead` hoặc `Tạo Đơn`.
  2. Điền parent, phone, student, notes.
  3. Lưu.
  4. Kiểm tra tag `Lead đã tạo` hoặc `Đơn đã tạo`.
- Caption: "Chatbot không chỉ để chat; nó là đầu vào trực tiếp cho CRM và order."
- Khoanh đỏ:
  - form inline trong sidebar
  - tag linked entity

### S12. Tạo hoặc sửa parent account

- Mục tiêu: chuẩn hóa master data phụ huynh trước khi lên order.
- Actor: Sale.
- Các bước:
  1. Mở `Users Management` ở mode phụ huynh.
  2. Tạo parent mới hoặc sửa parent hiện có.
  3. Nhập userCode, email, phone, fullName, address, Facebook link.
  4. Lưu.
- Caption: "Sale được tạo và sửa parent trong phạm vi phụ trách, nhưng không được xóa."
- Khoanh đỏ:
  - chế độ parent
  - form parent
- Ghi chú: chuyển owner parent là việc của Director.

### S13. Gắn student vào parent

- Mục tiêu: đảm bảo student đi đúng owner và đúng liên hệ phụ huynh.
- Actor: Sale.
- Các bước:
  1. Mở `Students`.
  2. Tạo học sinh mới.
  3. Chọn parent chính, parent phụ nếu có.
  4. Upload ảnh nhận diện.
  5. Lưu student.
- Caption: "Student phải bám parent đúng ngay từ đầu để tránh sai dây downstream."
- Khoanh đỏ:
  - select `Ma phu huynh`
  - ảnh nhận diện
  - parent phụ nếu dùng

### S14. Tạo order cho khách mới

- Mục tiêu: lên order cho khách chưa có parent/student.
- Actor: Sale.
- Các bước:
  1. Mở `Orders`.
  2. Nhấn `+ Tạo order`.
  3. Nhập parent mới, student mới.
  4. Chọn product.
  5. Chọn sessions, invoice sessions.
  6. Chưa xếp lớp ngay nếu chưa cần.
  7. Upload receipt.
  8. Lưu nháp.
- Caption: "Khách mới có thể lên order ngay, không bắt buộc chờ tạo lớp."
- Khoanh đỏ:
  - nút tạo order
  - product select
  - upload receipt
  - option để xếp lớp sau

### S15. Tạo order cho khách cũ

- Mục tiêu: tái sử dụng dữ liệu đã có.
- Actor: Sale.
- Các bước:
  1. Tạo order mới.
  2. Tìm lại parent cũ bằng phone.
  3. Chọn student cũ.
  4. Chọn product mới hoặc gói tiếp theo.
  5. Nếu phù hợp, gắn luôn lớp hiện có.
  6. Lưu nháp.
- Caption: "Tình huống khách cũ giúp tránh trùng parent hoặc student."
- Khoanh đỏ:
  - `parent lookup`
  - `student lookup`
  - class selection

### S16. Kiểm tra validation order

- Mục tiêu: tránh đơn sai trước khi submit.
- Actor: Sale.
- Các bước:
  1. Kiểm tra discount không vượt total.
  2. Với trả góp, kiểm tra invoice amount và payment plan.
  3. Với order cần chứng từ, upload receipt.
  4. Bổ sung consultation notes.
- Caption: "Validation order là chốt chặn để OPS không phải trả đơn vì lỗi cơ bản."
- Khoanh đỏ:
  - total/final amount
  - discount
  - payment plan
  - receipt proof

### S17. Gửi duyệt order

- Mục tiêu: bàn giao order sang bước phê duyệt chính thức.
- Actor: Sale.
- Các bước:
  1. Lọc order vừa tạo.
  2. Rà lại dòng order.
  3. Bấm `Gửi duyệt`.
  4. Xác nhận dialog.
  5. Kiểm tra status đổi sang `SUBMITTED`.
- Caption: "Từ đây order rời tay sale và đi vào flow phê duyệt."
- Khoanh đỏ:
  - nút `Gửi duyệt`
  - badge trạng thái `SUBMITTED`

### S18. Nhánh NEEDS_INFO, reject, cancel

- Mục tiêu: cho sale biết cách xử lý đơn bị trả hoặc bị từ chối.
- Actor: Director/OPS cho action, Sale cho xử lý lại.
- Các bước:
  1. Người duyệt có thể `Cần bổ sung`, `Từ chối`, hoặc `Hủy`.
  2. Sale mở lại order ở trạng thái `NEEDS_INFO`.
  3. Bổ sung dữ liệu thiếu và gửi duyệt lại.
- Caption: "Không phải đơn nào cũng duyệt một lần; hệ thống hỗ trợ trả đơn có lý do rõ ràng."
- Khoanh đỏ:
  - reason prompt
  - trạng thái `NEEDS_INFO`
  - nút submit lại

### S19. Duyệt order và side effect downstream

- Mục tiêu: làm rõ các bước sau khi sale gửi duyệt.
- Actor: Director hoặc OPS.
- Phối hợp: Sale.
- Các bước:
  1. Mở order chờ duyệt.
  2. Upload hóa đơn đối ứng nếu cần.
  3. Xác nhận duyệt.
  4. Theo dõi order đổi `APPROVED` hoặc `COMPLETED`.
  5. Kiểm tra invoice/student được sinh.
- Caption: "Phê duyệt order không chỉ đổi trạng thái; nó còn sinh dữ liệu downstream."
- Khoanh đỏ:
  - modal duyệt
  - field hóa đơn đối ứng
  - thông báo enrollment/invoice

### S20. Kiểm tra invoice và student sau duyệt

- Mục tiêu: xác nhận bàn giao cho vận hành đã đủ dữ liệu.
- Actor: Sale.
- Các bước:
  1. Mở `Invoices`, tìm invoice vừa sinh.
  2. Mở `Students`, tìm student vừa tạo.
  3. Xác nhận thông tin parent/student đúng.
- Caption: "Sale phải chốt một vòng kiểm tra sau duyệt trước khi bàn giao."
- Khoanh đỏ:
  - dòng invoice
  - dòng student

### S21. Tạo trial offline

- Mục tiêu: quản lý học thử trước hóa đơn.
- Actor: Sale.
- Các bước:
  1. Mở `Trial Enrollments`.
  2. Tạo học thử mới.
  3. Chọn lớp offline và gói offline.
  4. Ghi số buổi học thử, sale phụ trách, notes.
  5. Lưu.
- Caption: "Học thử offline là flow riêng, không đi thẳng vào roster chính."
- Khoanh đỏ:
  - nút `+ Tạo học thử`
  - chọn lớp offline
  - chọn gói offline

### S22. Chốt trial offline

- Mục tiêu: quyết định học thử có convert hay dừng.
- Actor: Director hoặc OPS.
- Phối hợp: Sale.
- Các bước:
  1. Chuyển trial sang `WAITING_DECISION`.
  2. Chọn `Chuyển đổi`, `Từ chối`, hoặc `Trả lương GV`.
  3. Kiểm tra badge trạng thái và note teacher-paid-only nếu có.
- Caption: "Trial phải được chốt rõ outcome để không lệch tài chính hoặc lương giáo viên."
- Khoanh đỏ:
  - nút `Chờ chốt`
  - nút `Chuyển đổi`
  - note `Vẫn trả lương GV, không charge PH`

### S23. Gửi session change request

- Mục tiêu: cho sale yêu cầu đổi buổi hoặc đổi giáo viên khi session chưa diễn ra.
- Actor: Sale.
- Các bước:
  1. Mở `Sessions`.
  2. Chọn session `SCHEDULED`.
  3. Mở card change request.
  4. Đề xuất giáo viên mới hoặc lịch mới.
  5. Nhập reason.
  6. Gửi yêu cầu.
  7. Kiểm tra history có trạng thái `PENDING`.
- Caption: "Sale không sửa session trực tiếp; Sale gửi request để hệ thống lưu dấu vết và impact."
- Khoanh đỏ:
  - nút mở form change request
  - field teacher/date/time
  - history status

### S24. Đối chiếu hoa hồng

- Mục tiêu: đo hiệu quả chốt đơn.
- Actor: Sale.
- Các bước:
  1. Mở `Commission Report`.
  2. Chọn khoảng ngày.
  3. Đọc summary: doanh thu, tổng hoa hồng, hoa hồng chờ duyệt, tổng số đơn.
  4. Xem breakdown theo tháng và bảng chi tiết order.
- Caption: "Báo cáo hoa hồng là nơi sale nhìn lại chất lượng chốt đơn, không chỉ số lượng lead."
- Khoanh đỏ:
  - 4 summary cards
  - bảng chi tiết đơn hàng

### S25. Theo dõi phối hợp đầu vào và thông báo

- Mục tiêu: tránh bỏ sót lead đến từ marketing hoặc việc điều phối nội bộ.
- Actor: Sale.
- Các bước:
  1. Mở `Landing Pages` để đối chiếu form submit nếu cần.
  2. Mở `Notifications` để xem nhắc việc.
  3. Mở `Messages` khi cần phối hợp nội bộ.
- Caption: "Sale không làm việc một mình; cần theo dõi cả nguồn vào và việc liên phòng ban."
- Khoanh đỏ:
  - list landing submit
  - notification unread
  - message thread nội bộ

## 5. Gói video nên xuất

- Video master:
  - Cover S01, S05, S14, S15, S17, S19, S20.
- Video edge-case bổ sung:
  - Lead lifecycle: S03, S04, S06, S07, S09.
  - Conversation to lead/order: S10, S11.
  - Trial offline: S21, S22.
  - Session change request: S23.
  - Commission review: S24.

## 6. Kết luận rà soát hệ thống

- Hệ thống sale hiện không chỉ dừng ở CRM lead, mà đã đi xuyên suốt từ nguồn marketing/chatbot đến order, invoice, student và class handoff.
- Điểm mạnh nhất để demo bán hàng là chuỗi dữ liệu liền mạch:
  - `Lead -> Order -> Duyệt -> Invoice -> Student`.
- Điểm cần nói rõ khi demo:
  - Sale tạo và sửa parent được, nhưng không tự chuyển owner parent.
  - Sale có thể lên order cho khách mới hoặc khách cũ.
  - Trial offline là luồng riêng trước hóa đơn.
  - Session change request có audit trail, không sửa tay.
  - Các quyết định tài chính cuối vẫn nằm ở Director/OPS/Accounting, nhưng Sale theo dõi toàn bộ đường đi của dữ liệu.

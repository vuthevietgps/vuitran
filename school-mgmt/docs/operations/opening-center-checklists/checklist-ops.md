# Checklist OPS / Vận hành

## Điều hướng nhanh

- [Tổng hợp link mở trung tâm](../tong-hop-link-mo-trung-tam.md)
- [Checklist master mở trung tâm](../checklist-opening-center-detailed.md)
- [Hub checklist theo đối tượng](./README.md)
- [Sổ tay OPS / Vận hành](../opening-center-handbooks/so-tay-ops.md)

## 1. Quy tắc vai trò

- [ ] OPS là chủ luồng `Classes`, `Sessions`, `Attendance`, `Tickets`, `Pending Approvals`, điều phối giáo viên và bàn giao liên phòng ban.
- [ ] Không finalize buổi học khi thiếu `attendance` hoặc `teaching report`.
- [ ] Mọi thay đổi giáo viên, roster, lịch học đều phải cập nhật ở dữ liệu nguồn, không chỉ comment trong ticket.
- [ ] Không điều phối giáo viên chỉ bằng chat; luôn để lại dấu vết trên ticket hoặc session source.

## 2. Chuẩn bị trước khai trương

- [ ] Tạo danh sách lớp 4 đến 8 tuần đầu theo mô hình Lumira: lớp online `1 giáo viên - nhiều học sinh`, kiểm tra roster, sale owner và trạng thái lớp chưa đủ sĩ số.
- [ ] Tạo trước lịch học hàng loạt trong `Sessions` cho tuần đầu hoặc tháng đầu; lịch chuẩn là `1 buổi/tuần`, `2 giờ 15 phút/buổi`.
- [ ] Chuẩn bị danh sách giáo viên thay thế cho các ca cao điểm, cuối tuần và sau 17h.
- [ ] Chạy thử `Dashboard`, `Pending Approvals`, `Classes`, `Sessions`, đổi roster, thay giáo viên, change request và ticket điều phối.
- [ ] Chạy thử finalize `TEACHER_COMPLETED` để xác nhận luồng chốt buổi trước payroll.

## 3. Checklist ngày trước khai trương và 3 ngày đầu

- [ ] Trước ngày khai trương, chốt danh sách lớp, roster, giáo viên thay thế và mọi session của 7 ngày đầu.
- [ ] Rà các ticket mở còn tồn, đặc biệt là đổi lịch, thay giáo viên, phản hồi phụ huynh và `test trải nghiệm/xếp lớp`.
- [ ] Trước giờ mở cửa, mở `Classes`, `Sessions`, `Pending Approvals`, `Tickets` để rà các lớp bắt đầu trong 2 giờ đầu.
- [ ] Trong giờ hoạt động, nếu danh sách thực tế khác roster thì sửa ngay ở `Classes`; nếu có thay đổi lịch hoặc giáo viên thì tạo ticket hoặc comment điều phối; nghỉ có phép không mất tiền, nghỉ không phép mất tiền phải được để lại dấu vết đúng case.
- [ ] Cuối ngày lọc `Sessions` để xử lý các buổi `TEACHER_COMPLETED` đủ điều kiện finalize và ghi chú rõ các buổi còn treo.

## 4. Vận hành hằng ngày

- [ ] Mỗi sáng rà `Classes` và `Sessions` để bảo đảm lớp nào cũng có đúng giáo viên, đúng roster, đúng khung giờ.
- [ ] Mỗi chiều rà `Attendance`, `Teaching Report`, `Tickets`, `Pending Approvals` để đóng vòng vận hành trong ngày.
- [ ] Buổi nào có nguy cơ thiếu giáo viên, thiếu phòng, thiếu học viên hoặc roster sai phải được xử lý trước giờ học tối thiểu 2 giờ.
- [ ] Cuối ngày phải có danh sách buổi treo, ticket mở, request đổi lịch chưa xong và người chịu trách nhiệm tiếp tục xử lý.

## 5. KPI và cảnh báo

- [ ] Theo dõi KPI: session tạo đúng hạn, session finalized trong ngày, ticket quá SLA, lỗi roster, ca đổi giáo viên xử lý kịp thời.
- [ ] Review hằng tuần số buổi đã dạy, số buổi chưa finalize, số buổi thiếu attendance hoặc teaching report, nhóm ticket quá hạn và điểm nghẽn liên phòng ban.
- [ ] Xử lý ngay 3 cảnh báo OPS: session treo cuối ngày, roster sai hoặc đổi liên tục, ticket bị mở lại nhiều lần.
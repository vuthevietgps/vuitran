# Danh Sách Tình Huống Test Frontend UI

## Mục đích

Tài liệu này lưu các tình huống cần test frontend UI để phục vụ:

- Lập kế hoạch test thủ công.
- Chọn bộ smoke test và regression test.
- Xây dựng test automation sau này.
- Rà soát rủi ro khi thay đổi UI, API hoặc phân quyền.

## Phạm vi

- Workspace: `school-mgmt/frontend`
- Framework: Angular
- Trọng tâm: UI, routing, trạng thái màn hình, phân quyền, form, upload, realtime, side effects giữa các module.

## Mức ưu tiên

- `P0`: Bắt buộc phải test trước release hoặc sau thay đổi lớn.
- `P1`: Quan trọng, nên nằm trong regression chính.
- `P2`: Mở rộng, test khi có thay đổi liên quan hoặc khi tăng độ phủ.

## Nhóm 1. Auth, Session, Routing, App Shell

- [ ] `P0` Đăng nhập thành công với tài khoản hợp lệ.
- [ ] `P0` Đăng nhập sai email hoặc mật khẩu hiển thị lỗi đúng.
- [ ] `P0` Đăng nhập bị giới hạn thử quá nhiều lần hiển thị thông báo phù hợp.
- [ ] `P0` Nút hiện/ẩn mật khẩu hoạt động đúng.
- [ ] `P0` Trạng thái loading khi submit login khóa nút và tránh submit lặp.
- [ ] `P0` Refresh trang khi đã đăng nhập vẫn restore session từ cookie.
- [ ] `P0` Chưa đăng nhập mà vào route nội bộ thì bị chuyển về `login`.
- [ ] `P0` Đang ở màn hình nội bộ nhưng API trả `401` thì bị logout và về `login`.
- [ ] `P0` Người dùng không có quyền vào route thì bị chuyển sang `not-authorized`.
- [ ] `P0` Role `SHAREHOLDER` vào app phải được điều hướng về `investor-dashboard`.
- [ ] `P0` Menu trái hiển thị đúng theo role.
- [ ] `P0` Badge thông báo và chờ duyệt hiển thị đúng, cập nhật đúng.
- [ ] `P0` Thu gọn/mở rộng sidebar hoạt động đúng và giữ state sau reload.
- [ ] `P0` Loading bar khi chuyển route hiển thị và biến mất đúng thời điểm.
- [ ] `P1` Link active trong sidebar đúng theo route và query param.
- [ ] `P1` Route không tồn tại bị chuyển đúng về trang mặc định.
- [ ] `P1` Đổi mật khẩu thành công và hiển thị lỗi đúng khi nhập sai mật khẩu hiện tại.
- [ ] `P0` Bảo vệ chống brute-force: Nhập sai mật khẩu 5 lần bị khóa tài khoản (Lockout) và hiển thị thông báo thời gian chờ.

## Nhóm 2. Dashboard, Hub Duyệt & Cẩm Nang Theo Role

- [ ] `P0` Load đúng dashboard cho từng role: `DIRECTOR`, `ACCOUNTING`, `OPS`, `TEACHER`, `PARENT`, `SALE`, `ADSMANAGER`, `SHAREHOLDER`.
- [ ] `P0` Dashboard có skeleton/loading state trong lúc tải.
- [ ] `P0` Dashboard có error state và nút tải lại khi API lỗi.
- [ ] `P1` Banner handbook hiển thị đúng theo role.
- [ ] `P1` Widget, card, số liệu và CTA không lộ dữ liệu sai role.
- [ ] `P1` Dashboard không vỡ layout ở màn hình hẹp.
- [ ] `P0` Render danh sách Cảnh báo Tài chính (Financial Alerts: Runway, Dòng tiền âm...) với màu sắc theo mức độ (CRITICAL, WARNING) và các nút hành động (Navigate/Deposit) hoạt động đúng.
- [ ] `P1` Danh sách "Ticket quá hạn" (Overdue Tickets) hiển thị highlight đỏ trên Dashboard.
- [ ] `P1` Trang "Cẩm nang nội bộ" (Internal Handbook) hiển thị đúng nội dung cấu hình theo Role đang đăng nhập (Director, Accounting, OPS...).
- [ ] `P1` Click vào các Quick Links trong Cẩm nang điều hướng chính xác.
- [ ] `P1` Các Video và Ảnh minh họa (Gallery) tải và hiển thị đúng mà không vỡ UI.
- [ ] `P0` Cổ đông (Shareholder) truy cập Dashboard chỉ thấy chế độ Read-only, KHÔNG có bất kỳ nút tạo/sửa/xóa nào.
- [ ] `P0` Màn hình Hub Duyệt (Pending Approvals) tải đúng các tab: Bảng lương, Hóa đơn, Nạp ví, Giáo viên mới, Sửa lớp, Đổi buổi học.
- [ ] `P0` Chuyển qua lại giữa các tab trong Pending Approvals không bị vỡ layout, hiển thị đúng list dữ liệu.
- [ ] `P0` Badge số lượng (Count) hiển thị ở từng tab và trên Menu Sidebar phải khớp nhau.
- [ ] `P0` Phê duyệt (Approve) và Từ chối (Reject) ngay tại Hub cập nhật trạng thái UI và giảm số lượng đếm realtime.
- [ ] `P1` UI Preview (xem trước) thay đổi thời lượng học sinh ở tab "Sửa lớp" render chính xác trước/sau thay đổi.

## Nhóm 3. Quản Lý Người Dùng, Học Sinh, Sản Phẩm, Đại Lý

- [ ] `P1` Tạo user mới với role hợp lệ.
- [ ] `P1` Sửa user hiện có, đổi role, đổi thông tin cơ bản.
- [ ] `P1` Không cho xóa hoặc sửa vượt quyền.
- [ ] `P1` Tự sửa tài khoản của chính mình không gây lỗi quyền hoặc trạng thái bất thường.
- [ ] `P1` Quản lý gán/hủy Nhóm quảng cáo (Ads Attribution) cho Phụ huynh hoạt động đúng (Dành cho Director).
- [ ] `P1` Quản lý gán/đổi Sale phụ trách cho Phụ huynh hoạt động đúng và cập nhật real-time.
- [ ] `P1` Quản lý parent owner assignment hoạt động đúng.
- [ ] `P1` Parent ads attribution lưu, cập nhật, xóa đúng.
- [ ] `P1` Tạo/sửa/xóa học sinh hoạt động đúng.
- [ ] `P1` Chọn parent cho học sinh hoạt động đúng.
- [ ] `P1` Upload ảnh khuôn mặt học sinh thành công và xử lý lỗi upload đúng.
- [ ] `P1` Tạo/sửa/xóa sản phẩm hoạt động đúng.
- [ ] `P1` Ngưng bán (Deactivate) Product thành công và hiển thị rõ trạng thái INACTIVE (Sale bị chặn chọn khi tạo Order).
- [ ] `P1` Chuyển giao (Reassign) Lead hoặc Học sinh từ Sale này sang Sale khác cập nhật đúng UI.
- [ ] `P0` Danh sách Đại lý (Agents) hiển thị đúng theo role (Director, Accounting, OPS, Sale).
- [ ] `P0` Tạo mới Đại lý với các hạng (Tier) GOLD, SILVER, PLATINUM và mức hoa hồng tương ứng.
- [ ] `P1` Edit thông tin Đại lý.
- [ ] `P1` Thay đổi trạng thái Đại lý (Suspend / Activate) có hiển thị dialog confirm và cập nhật đúng UI.
- [ ] `P1` Sale không có quyền truy cập hoặc không thấy nút "Tạo đại lý".
- [ ] `P1` Cấu hình nhiều phụ huynh cho một học sinh (Multiple parents) hiển thị đúng thông tin trên UI.
- [ ] `P1` Trạng thái Vô hiệu hóa (Inactive) của Giáo viên/Sale hiển thị badge rõ ràng và bị chặn khi gán vào lớp/đơn mới.
- [ ] `P0` Tạo Giáo viên mới đi kèm flow thiết lập Cấu hình lương (Salary Config) hoạt động đúng.
- [ ] `P1` Hiển thị đúng phần trăm cổ phần (Ownership Percentage) cho role SHAREHOLDER.

## Nhóm 4. Sales Funnel: Leads, Orders, Trial Enrollments

- [ ] `P0` Tạo lead mới với dữ liệu tối thiểu.
- [ ] `P0` Sửa lead, cập nhật contact, gán sale.
- [ ] `P1` Đánh dấu Lead thất bại (LOST) bắt buộc nhập lý do.
- [ ] `P1` Trả Lead về kho (Return to pool) và danh sách Follow-up hiển thị highlight đỏ nếu quá hạn.
- [ ] `P0` Convert lead sang order đúng dữ liệu.
- [ ] `P0` Mark lead lost, return to pool, xem stale/pool đúng.
- [ ] `P0` Tạo order từ dữ liệu parent/student mới.
- [ ] `P0` Tạo order từ parent/student đã tồn tại.
- [ ] `P0` Chọn package, lớp, hình thức học và tính giá đúng.
- [ ] `P0` Discount làm thay đổi `finalAmount` đúng trên UI.
- [ ] `P0` Installment hiển thị đúng số kỳ và số tiền liên quan.
- [ ] `P0` Trial `0đ` hiển thị đúng badge và không hiển thị sai amount.
- [ ] `P0` Upload receipt/chứng từ cho order hoạt động đúng.
- [ ] `P0` Submit order vào luồng duyệt hoạt động đúng.
- [ ] `P0` Chống click-đúp (Idempotency): Click nhiều lần vào nút "Gửi duyệt" hoặc "Duyệt đơn" không sinh ra nhiều hóa đơn.
- [ ] `P0` Approve Order thanh toán Chuyển khoản (Transfer) bắt buộc phải có Biên lai (Receipt Image), hiển thị lỗi nếu thiếu.
- [ ] `P0` Approve order cập nhật đúng badge, pipeline và dữ liệu liên quan.
- [ ] `P0` Reject order hiển thị đúng trạng thái và lý do từ chối.
- [ ] `P0` Request more info hoạt động đúng và phản ánh trên UI.
- [ ] `P0` Cancel order cập nhật đúng toàn bộ màn liên quan.
- [ ] `P1` Tạo order từ conversation chatbot giữ đúng dữ liệu nguồn.
- [ ] `P1` Trial enrollment create/edit/approve/reject/convert hoạt động đúng.
- [ ] `P1` Trial enrollment trạng thái `waiting decision` hiển thị đúng.
- [ ] `P1` Order thanh toán một phần (Partial Payment) hiển thị đúng số tiền đã thu và số công nợ còn lại.
- [ ] `P1` Chi tiết Lead hiển thị dạng Timeline Lịch sử nguồn (Attribution history) khi khách hàng tương tác qua nhiều kênh.

## Nhóm 5. Classes, Sessions, Attendance

- [ ] `P0` Tạo lớp mới với dữ liệu tối thiểu.
- [ ] `P0` Sửa lớp hiện có và reload dữ liệu đúng.
- [ ] `P0` Xóa lớp hiển thị confirm và xử lý trạng thái đúng.
- [ ] `P0` Gán học sinh vào lớp hoạt động đúng.
- [ ] `P0` Đổi Giáo viên cho lớp học (Teacher Swap) hiển thị confirm và cập nhật đúng danh sách.
- [ ] `P1` Xin dạy thay (Substitute Teacher) cập nhật đúng giáo viên cho buổi học cụ thể mà không làm ảnh hưởng buổi sau.
- [ ] `P1` Đổi Giáo viên có lương cao hơn cho lớp (Teacher Swap) hiển thị đúng cảnh báo "Biên lợi nhuận thu hẹp" (Margin Shrinking) trên UI.
- [ ] `P0` Cấu hình riêng cho học sinh trong lớp hoạt động đúng.
- [ ] `P0` Quản lý Student Configs (Gán học sinh học nhiều slot/giáo viên khác nhau trong 1 lớp) tải và lưu đúng dữ liệu.
- [ ] `P0` Luồng pending class update approve/reject hoạt động đúng.
- [ ] `P0` Tạo session đơn và bulk create session hoạt động đúng.
- [ ] `P0` View detail session hiển thị đủ thông tin.
- [ ] `P0` Teacher complete session hoạt động đúng.
- [ ] `P0` Parent confirm session hoạt động đúng.
- [ ] `P0` Finalize session cập nhật trạng thái đúng.
- [ ] `P1` Sửa giá Lớp học (Price change) không làm thay đổi hiển thị số tiền `amountCharged` của các Buổi học đã qua (Bất biến theo Pricing Snapshot).
- [ ] `P0` Cảnh báo "Vượt ngưỡng nợ" (Debt Limit) hiển thị rõ ràng khi OPS Finalize session cho Phụ huynh đã hết tiền và chạm giới hạn nợ.
- [ ] `P0` Cancel session cập nhật đúng badge, lịch sử và số liệu liên quan.
- [ ] `P0` Remove session hoạt động đúng nếu role cho phép.
- [ ] `P0` Attendance theo lớp/ngày load đúng danh sách.
- [ ] `P0` Phân quyền cấp độ Element: Giáo viên KHÔNG thấy nút "Lưu điểm danh" và các tùy chọn trạng thái, CHỈ thấy nút "Tạo link".
- [ ] `P0` Mark từng học sinh present/absent/late hoạt động đúng (Dành cho OPS/Director).
- [ ] `P0` Mark all present hoạt động đúng (Dành cho OPS/Director).
- [ ] `P0` Chỉ cho save attendance khi có thay đổi cần lưu.
- [ ] `P0` Link điểm danh theo học sinh được tạo đúng.
- [ ] `P0` Trang `student-attendance/:token` với token hợp lệ tải đúng thông tin.
- [ ] `P0` Trang `student-attendance/:token` với token sai/hết hạn hiển thị lỗi đúng.
- [ ] `P0` Luồng camera được cấp quyền và chụp ảnh thành công.
- [ ] `P0` Luồng camera bị từ chối quyền hiển thị lỗi hoặc hướng dẫn phù hợp.
- [ ] `P0` Submit attendance từ camera tránh double submit.
- [ ] `P1` Attendance report có filter, phân trang, preview ảnh đúng.
- [ ] `P1` Parent attendance hiển thị đúng dữ liệu của phụ huynh hiện tại.
- [ ] `P0` Ở chi tiết Session (trạng thái SCHEDULED), hiển thị nút "Yêu cầu thay đổi" dành cho Sale.
- [ ] `P0` Sale submit yêu cầu thay đổi (đổi GV, đổi thời lượng) thành công.
- [ ] `P0` Lịch sử yêu cầu thay đổi (Request History) hiển thị đúng trong modal Session Detail.
- [ ] `P1` Director/OPS duyệt yêu cầu đổi buổi học → UI cập nhật thông tin session.
- [ ] `P1` Màn hình "Calendar Overview" (Lịch tổng quan) filter đúng theo Giáo viên hoặc Lớp học.
- [ ] `P1` Yêu cầu thay đổi Lớp học/Buổi học giữ lại vết lịch sử thay đổi (Audit trail) trên modal Chi tiết.
- [ ] `P0` Tính năng Reschedule (Dời ngày/giờ học) hoạt động thành công và cảnh báo nếu trùng lịch Giáo viên.
- [ ] `P1` Bulk Attendance (Điểm danh hàng loạt) cho lớp Offline lưu trạng thái đúng và tự động gán Absent cho học sinh không được chọn.
- [ ] `P1` Phân công nhiều Giáo viên (Co-teaching) cho lớp Offline hiển thị đúng và cho phép cả hai cùng thao tác.
- [ ] `P1` Giáo viên chính bị ẩn nút/chặn quyền điểm danh đối với buổi học đã được phân công Giáo viên dạy thay (Substitute Teacher).

## Nhóm 6. Teacher Hub, Parent Pages, Teaching Materials

- [ ] `P1` Teacher profile tải hồ sơ hiện tại đúng.
- [ ] `P1` Sửa teacher profile, thêm/xóa qualification, availability hoạt động đúng.
- [ ] `P1` Teacher profiles list và profile detail hoạt động đúng.
- [ ] `P1` Approve teacher profile hoạt động đúng với role phù hợp.
- [ ] `P1` Teacher calendar chuyển tháng, xem session theo ngày đúng.
- [ ] `P1` Parent calendar chuyển tháng, xem session theo ngày đúng.
- [ ] `P1` Teacher substitute request tạo yêu cầu mới đúng.
- [ ] `P1` Teacher KPI filter/sort/detail hoạt động đúng.
- [ ] `P1` Báo cáo Teacher KPI hiển thị rõ số lần nộp trễ báo cáo và tổng tiền phạt (Penalty) trong khoảng thời gian lọc.
- [ ] `P1` Student progress của phụ huynh hiển thị đúng dữ liệu.
- [ ] `P1` Parent invoices chỉ hiển thị invoice đúng phạm vi.
- [ ] `P1` Teaching materials filter theo từ khóa, subject, grade, class, type, extraction status hoạt động đúng.
- [ ] `P1` Teaching materials upload file bằng chọn file hoạt động đúng.
- [ ] `P1` Teaching materials upload file bằng drag-drop hoạt động đúng.
- [ ] `P1` Teaching materials download, reprocess, delete hoạt động đúng.
- [ ] `P1` Teaching materials load more không duplicate dữ liệu.
- [ ] `P1` Sửa nhanh (Inline update) Báo cáo giảng dạy hoạt động đúng, không lưu đè làm mất dữ liệu của field khác.
- [ ] `P1` Empty state và error state của kho tài liệu hiển thị đúng.
- [ ] `P1` Form Báo cáo giảng dạy (Teaching Report) render động các trường (dynamic fields) đúng theo Cấu hình Template (VD: Từ vựng, Ngữ pháp).
- [ ] `P1` Phụ huynh đánh giá buổi học (Rating/Feedback 1-5 sao) cập nhật trạng thái đúng và hiện cảnh báo trên màn OPS nếu đánh giá thấp.
- [ ] `P1` Màn hình Chấm công (Work sessions) của Giáo viên có badge/màu sắc nổi bật báo hiệu ca Đi muộn (Late) hoặc Về sớm (Early leave).

## Nhóm 7. Invoices, Wallets, Payroll, Finance Core

- [ ] `P0` Tạo invoice mới với dữ liệu hợp lệ.
- [ ] `P0` Sửa invoice và phản ánh đúng trên bảng/list.
- [ ] `P0` Approve invoice với ảnh chứng từ hoạt động đúng.
- [ ] `P0` Chống click-đúp (Idempotency): Click nhiều lần vào nút "Duyệt hóa đơn" ví chỉ được cộng tiền một lần.
- [ ] `P0` Reject invoice hoạt động đúng.
- [ ] `P0` Xóa invoice khi role cho phép.
- [ ] `P0` Nút Xóa Invoice bị ẩn hoặc hiển thị lỗi rõ ràng nếu cố xóa Invoice đã ở trạng thái APPROVED.
- [ ] `P0` Filter invoice theo keyword, parent, sale, class type, status, date range hoạt động đúng.
- [ ] `P0` Infinite scroll hoặc load batch trong invoice table không bị trùng hoặc mất dòng.
- [ ] `P0` Top-up request ở wallets hiển thị đúng pending count.
- [ ] `P0` Approve top-up cập nhật ví và ledger đúng.
- [ ] `P0` Chuyển tiền giữa các ví (Wallet Transfer) hoạt động đúng, cấm chuyển vượt số dư và tự chuyển cho mình.
- [ ] `P0` Reject top-up cập nhật trạng thái đúng.
- [ ] `P0` Transfer ví hoạt động đúng và validate đủ dữ liệu.
- [ ] `P0` Parent top-up với upload receipt hoạt động đúng.
- [ ] `P0` Ví có số dư thấp hiển thị cảnh báo đúng.
- [ ] `P0` Ledger của ví hiển thị đúng loại giao dịch và số tiền.
- [ ] `P0` Payroll giáo viên preview/generate/update/submit/approve/reject/reopen/mark paid/delete hoạt động đúng.
- [ ] `P0` Staff payroll generate/edit/submit/approve/reject/reopen/mark paid/delete hoạt động đúng.
- [ ] `P0` Bulk generate payroll hoạt động đúng và tránh submit lặp.
- [ ] `P0` Bulk generate payroll hoạt động đúng, tránh submit lặp và hiển thị rõ trạng thái thành công một phần (Partial success) nếu có lỗi.
- [ ] `P1` Salary config create/update/delete hoạt động đúng.
- [ ] `P1` Work sessions filter, summary, edit hoạt động đúng.
- [ ] `P1` Commission report hiển thị đúng theo role và dữ liệu.
- [ ] `P1` Aging report filter và bucket label hiển thị đúng.
- [ ] `P0` Kế toán Adjust ví (Cộng/Trừ tiền thủ công) bắt buộc phải nhập lý do (Form validation error nếu trống).
- [ ] `P1` Adjust ví âm (SUBTRACT) cập nhật số dư chính xác.
- [ ] `P0` Nút Exclude Payroll (Loại trừ lương giáo viên do vi phạm) hoạt động đúng, bắt buộc nhập lý do và hiển thị trạng thái EXCLUDED.
- [ ] `P1` Bảng lương (Payroll preview) hiển thị rõ các khoản phạt (Penalty) do nộp trễ báo cáo giảng dạy.
- [ ] `P0` Validation không cho phép lùi trạng thái Payroll đã PAID về DRAFT hoặc EXCLUDED.
- [ ] `P1` Bảng lương (Payroll preview) lớp Offline tính toán và hiển thị đúng mức lương tối thiểu bảo chứng (Min Payout Guarantee) khi học sinh vắng nhiều.
- [ ] `P0` Validation không cho phép lùi trạng thái Payroll đã PAID về DRAFT hoặc EXCLUDED.
- [ ] `P1` Hủy hóa đơn đã duyệt (Rollback Top-up) thành công và hiển thị cảnh báo nếu ví phụ huynh bị đưa về số âm.
- [ ] `P1` Kế toán Từ chối đối soát (Reject Reconciliation) trên Hóa đơn bắt buộc nhập lý do và cập nhật ví đúng.

## Nhóm 8. Finance Nâng Cao: Expenses, Supplier, Loans, Financial Control, Bank Reconciliation

- [ ] `P0` Expenses create/edit/approve/reject/mark paid hoạt động đúng.
- [ ] `P0` Expenses phân quyền đúng giữa người tạo, người duyệt và người thanh toán.
- [ ] `P0` Supplier quotes create/edit/send/accept/reject/delete hoạt động đúng.
- [ ] `P0` Supplier payments create/edit/approve/reject/mark paid/delete hoạt động đúng.
- [ ] `P0` Loans create/activate/record payment/update overdue hoạt động đúng.
- [ ] `P0` Financial control theo tab ngân hàng/quỹ/cashflow/PnL/provisional gross profit hoạt động đúng.
- [ ] `P0` Tạo/sửa bank account, fund, bank transaction, fund transaction hoạt động đúng.
- [ ] `P0` Reconcile transaction cập nhật đúng trạng thái và báo cáo.
- [ ] `P0` Bank reconciliation chạy được và phản ánh đúng kết quả.
- [ ] `P1` Nút Rà soát số dư ví (Verify Balances) và Chạy đối soát thủ công (Run Reconciliation) hiển thị số liệu quét được.
- [ ] `P1` Màn hình Đối soát Ngân hàng (Bank Reconciliation) phân tách rõ ràng giao dịch Khớp (Matched) và Lệch (Unmatched).
- [ ] `P0` Báo cáo P&L (Lãi/Lỗ) cập nhật số liệu chính xác khi chuyển đổi giữa chế độ `CASH` (Dòng tiền thực tế) và `ACCRUAL` (Kế toán dự thu).
- [ ] `P0` Màn hình Investor/Shareholder hiển thị chính xác các chỉ số tài chính vĩ mô: LTV, Burn Rate, Runway, Retention, MRR.
- [ ] `P1` Chuyển tab tài chính không làm stale dữ liệu hoặc vỡ state form.
- [ ] `P1` Các side effect tài chính giữa invoice, wallet, payroll, expense, supplier payment được phản ánh đúng trên UI.

## Nhóm 9. Notifications, Messages, Chatbot, Tickets

- [ ] `P0` Notifications load đúng danh sách và unread count.
- [ ] `P1` Cài đặt tùy chọn nhận thông báo (Notification Preferences: Email/Zalo/SMS) hoạt động đúng và lưu trạng thái.
- [ ] `P0` Click notification chưa đọc sẽ mark read và điều hướng đúng link.
- [ ] `P0` Mark all notifications as read hoạt động đúng.
- [ ] `P1` Filter all/unread và phân trang notifications hoạt động đúng.
- [ ] `P1` Polling unread count không làm lệch badge hoặc nhân bản dữ liệu.
- [ ] `P1` Internal messages load conversation đúng.
- [ ] `P1` Chọn conversation, load message, mark read hoạt động đúng.
- [ ] `P1` Tạo conversation mới và gửi tin nhắn trực tiếp hoạt động đúng.
- [ ] `P0` Conversations chatbot filter theo keyword, status, fanpage hoạt động đúng.
- [ ] `P0` Chọn conversation load message đúng và auto scroll đúng.
- [ ] `P0` Takeover, release, close conversation hoạt động đúng.
- [ ] `P0` Chỉ cho gửi tin khi conversation ở `HUMAN_HANDLING`.
- [ ] `P0` Realtime nhận message mới qua websocket hoạt động đúng.
- [ ] `P0` Realtime update conversation list khi có event mới hoạt động đúng.
- [ ] `P0` Tạo lead từ conversation chatbot hoạt động đúng.
- [ ] `P0` Tạo order từ conversation chatbot hoạt động đúng.
- [ ] `P1` Lead/Order tạo từ Chatbot tự động liên kết nguồn (sourceConversationId) để tính ROI.
- [ ] `P0` Parent support chat chọn học sinh/người hỗ trợ và tạo ngữ cảnh đúng.
- [ ] `P1` Màn hình Chat hỗ trợ hiển thị Gợi ý câu trả lời AI (Auto-suggest) theo context học sinh, yêu cầu thao tác click để gửi (không tự động gửi).
- [ ] `P0` Parent support chat gửi tin, quick actions, start fresh hoạt động đúng.
- [ ] `P0` Ticket handoff banner và link sang ticket hiển thị đúng trong parent support chat.
- [ ] `P0` Tickets create/view detail/comment/resolve/reopen/cancel hoạt động đúng.
- [ ] `P0` Tickets phân tab `my`, `assigned`, `all` theo role đúng.
- [ ] `P0` Deep-link ticket qua query param mở đúng ticket.
- [ ] `P1` Cảnh báo Ticket quá hạn (Overdue Escalation): Ticket đổi màu hoặc ưu tiên khi quá hạn SLA.
- [ ] `P1` Open source conversation từ ticket hoạt động đúng nếu có liên kết.
- [ ] `P1` Đóng Ticket Hoàn tiền (REFUND_REQUEST) hiển thị cảnh báo nếu chưa được liên kết với giao dịch ví (LedgerEntry).
- [ ] `P1` Update priority ticket hoạt động đúng.
- [ ] `P0` Quản lý Fanpage (CRUD) trong Chatbot Settings hiển thị Token dạng ẩn (Masked: ••••••) an toàn.
- [ ] `P1` Cấu hình Chatbot AI (System Prompt, Temperature, Max Tokens) lưu thành công và không bị vỡ layout form.
- [ ] `P0` Tính năng Gửi thông báo hàng loạt (Bulk Notification) từ Admin/OPS gửi thành công và hiển thị tiến trình.
- [ ] `P0` Banner cảnh báo hiển thị rõ ràng trên Chatbot/Dashboard khi API Token của OpenAI bị hết hạn (Exhaustion).

## Nhóm 10. Ads, Landing Pages, Public Flows

- [ ] `P0` Ads management theo tab account/group/token/cost hoạt động đúng.
- [ ] `P0` CRUD account, group, token, cost hoạt động đúng.
- [ ] `P1` API Token Quảng cáo bị ẩn (Masked) dạng `••••••` và chỉ hiển thị trên màn hình Giám đốc.
- [ ] `P0` Sync token, trigger sync, backfill chức năng hoạt động đúng và có thông báo kết quả.
- [ ] `P1` Ads analytics load số liệu, đổi tab, sort, filter đúng.
- [ ] `P0` Bảng phân tích Ads (Ads Analytics) hiển thị và phân tách rõ ràng dữ liệu Lợi nhuận thuần (Cohort Profit) và Lợi nhuận theo phụ huynh (Parent Profit).
- [ ] `P1` Quyền xem suggestion/actions required đúng theo role.
- [ ] `P1` Chạy Backfill dữ liệu (Backfill Attribution / AdGroups) hoạt động thành công và hiển thị kết quả.
- [ ] `P0` Landing pages management create/edit/delete trang hoạt động đúng.
- [ ] `P0` Copy public URL hoạt động đúng, có fallback khi clipboard fail.
- [ ] `P0` Public landing page load đúng theo slug.
- [ ] `P0` Public landing page với slug sai hiển thị lỗi đúng.
- [ ] `P0` Submit form public landing page thành công và hiển thị success state.
- [ ] `P0` Submit form public landing page lỗi hiển thị đúng submit error.
- [ ] `P0` UTM/tracking payload được thu thập đúng trước khi submit.
- [ ] `P0` Giới hạn Rate Limit Landing Page: Bấm gửi liên tục hiển thị lỗi chặn Spam (Too Many Requests).
- [ ] `P0` Inject Meta Pixel / Google Tag / TikTok Pixel không bị lặp khi vào ra trang.
- [ ] `P1` Bấm "Trigger Sync" hoặc "Backfill" ở màn Ads Management hiển thị trạng thái loading và toast success/error rõ ràng.
- [ ] `P1` Custom head/body HTML được inject đúng và được dọn khi destroy component.

## Nhóm 11. Reports, Export, Audit

- [ ] `P1` Attendance report filter theo lớp/ngày và phân trang đúng.
- [ ] `P1` Student report filter và preview ảnh đúng.
- [ ] `P1` Comprehensive report filter theo class, sale, data status, search đúng.
- [ ] `P1` Teaching report pending/completed, filter tháng, teacher code lookup, submit/edit đúng.
- [ ] `P1` Export file CSV tải thành công, đúng dữ liệu và đúng chuẩn encoding UTF-8 BOM (không lỗi font tiếng Việt trên Excel).
- [ ] `P1` Export reports tải file đúng loại báo cáo.
- [ ] `P1` Audit log filter, pagination, thống kê hiển thị đúng.
- [ ] `P1` File CSV xuất ra chứa lượng data lớn (Large export) không gây timeout/crash UI.
- [ ] `P1` Audit log chỉ đọc, không có hành vi sửa dữ liệu.
- [ ] `P0` Bảo vệ tính toàn vẹn (Immutability): Audit Log KHÔNG có nút Xóa.

## Nhóm 12. Trạng Thái Chung Cần Test Ở Mọi Màn Hình

- [ ] `P0` Loading state hiển thị rõ và không cho thao tác gây submit lặp.
- [ ] `P0` Empty state hiển thị đúng khi không có dữ liệu.
- [ ] `P0` Error state hiển thị rõ khi API lỗi.
- [ ] `P0` Các modal mở/đóng nhiều lần không giữ state bẩn ngoài ý muốn.
- [ ] `P0` Form validation cho field bắt buộc, sai format, thiếu dữ liệu.
- [ ] `P0` Nút submit bị disable trong lúc đang xử lý.
- [ ] `P0` Double click không tạo dữ liệu trùng hoặc chuyển trạng thái hai lần.
- [ ] `P0` Refresh trang ở màn hình đang xem không làm lỗi state cơ bản.
- [ ] `P1` Search/filter/sort/pagination reset state đúng khi đổi điều kiện lọc.
- [ ] `P1` Scroll dài, bảng lớn, load thêm dữ liệu không bị nhảy layout bất thường.
- [ ] `P1` Upload file sai loại hoặc lỗi mạng hiển thị thông báo đúng.
- [ ] `P1` Ảnh preview/file preview không bị vỡ UI.
- [ ] `P1` Realtime hoặc polling không tạo duplicate item trên UI.
- [ ] `P1` Dữ liệu format ngày giờ, tiền tệ theo `vi-VN` hiển thị nhất quán.
- [ ] `P1` Responsive trên desktop hẹp, tablet và mobile không vỡ bố cục quan trọng.
- [ ] `P1` Deep-link bằng URL/query param mở đúng màn hình và đúng trạng thái.
- [ ] `P2` Kiểm tra behavior khi mở nhiều tab cùng lúc và trạng thái thay đổi ở tab khác.
- [ ] `P2` Kiểm tra accessibility cơ bản: focus, keyboard navigation, label form, contrast ở màn hình chính.
- [ ] `P0` Phân quyền cấp độ Element (UI Element-level RBAC): Nút "Tạo khoản vay" bị ẩn với Kế toán (chỉ Director mới thấy).
- [ ] `P0` Phân quyền cấp độ Element (UI Element-level RBAC): Nút "Chốt buổi học" (Finalize) bị ẩn với Giáo viên (chỉ OPS/Director thấy).
- [ ] `P0` Phân quyền cấp độ Element (UI Element-level RBAC): Bảng Hóa đơn (Invoices) ẩn nút "Xóa" đối với Kế toán/Sale/OPS (chỉ Director thấy).
- [ ] `P0` Phân quyền cấp độ Element (UI Element-level RBAC): Chế độ xem "Chỉ đọc" của màn Financial Control/Investor Dashboard dành cho role Shareholder không hiển thị bất kỳ nút Sửa/Xóa nào.
## Gợi Ý Dùng Tài Liệu Này

- Dùng toàn bộ `P0` làm smoke test trước release.
- Dùng `P0 + P1` làm regression chính theo sprint hoặc trước merge thay đổi lớn.
- Khi sửa một module, lọc lại các case thuộc nhóm tương ứng và các case ở `Nhóm 12`.
- Khi viết automation, ưu tiên các case có side effect nhiều module hoặc có phân quyền phức tạp.

## Gợi Ý Bộ Smoke Test Ban Đầu

- Auth + route guard + app shell theo role.
- Dashboard theo role.
- Order create -> submit -> approve/reject.
- Class/session/attendance flow.
- Invoice + wallet top-up/approve.
- Payroll/staff payroll approve flow.
- Chatbot conversations + ticket flow.
- Public landing page submit.

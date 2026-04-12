# Kế Hoạch Test Frontend UI Và Ghi Hình MP4

## 1. Mục tiêu

- Bám theo checklist tại `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
- Thực hiện test thủ công Frontend UI có ghi hình đầy đủ
- Video đầu ra bắt buộc là `MP4`
- Video phải thấy rõ dấu chuột và hướng di chuyển chuột
- Bước test, kỳ vọng, kết quả thực tế phải viết hoàn toàn bằng tiếng Việt

## 2. Đầu ra bắt buộc

- Video bằng chứng: `.mp4`
- Nhật ký test: `.md` hoặc `.xlsx`, nội dung tiếng Việt
- Trạng thái từng case: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`
- Nếu lỗi, phải ghi rõ:
  - Điều kiện gây lỗi
  - Kết quả thực tế
  - Kỳ vọng đúng
  - Mốc thời gian trong video

## 3. Cách ghi hình đề xuất

### Công cụ khuyến nghị

- Dùng `OBS Studio` trên Windows

### Cấu hình tối thiểu

- Nguồn ghi hình: `Display Capture`
- Bật `Capture Cursor`
- Độ phân giải: `1920x1080`
- FPS: `30`
- Ghi không crop mất thanh địa chỉ hoặc thanh điều hướng nếu cần đối soát route
- Nếu muốn an toàn dữ liệu khi quay dài:
  - Ghi tạm `MKV`
  - Sau khi kết thúc, `Remux` sang `MP4`
- File bàn giao cuối cùng phải là `MP4`

### Quy ước ghi hình

- Mỗi batch test tương ứng ít nhất `1` file MP4
- Nếu một batch dài hơn `30-40` phút, tách thành nhiều phần:
  - `UI_B05_Sessions_P1_20260407.mp4`
  - `UI_B05_Sessions_P2_20260407.mp4`
- Chuột phải luôn hiển thị trong video
- Nên thao tác chậm, rõ ràng, tránh rê chuột quá nhanh làm khó review

## 4. Quy ước thư mục đầu ra

Khuyến nghị tổ chức:

```text
frontend-ui-evidence/
  2026-04-07/
    videos/
    logs/
    screenshots/
```

Quy ước tên file video:

```text
UI_<BatchID>_<TenNganGon>_<YYYYMMDD>.mp4
```

Ví dụ:

```text
UI_B01_Auth_AppShell_20260407.mp4
UI_B04_Orders_Trials_20260407.mp4
UI_B07_Payroll_Wallets_20260407.mp4
```

Quy ước tên file log:

```text
LOG_<BatchID>_<TenNganGon>_<YYYYMMDD>.md
```

## 5. Nguyên tắc ghi chép bằng tiếng Việt

Mỗi test case phải có đủ 6 phần:

1. Mã case
2. Màn hình hoặc route
3. Tiền điều kiện
4. Các bước test
5. Kỳ vọng
6. Kết quả thực tế

Mẫu chuẩn:

```md
### Case: B04-ORDER-003

- Màn hình: `/app/orders`
- Vai trò: `SALE`
- Tiền điều kiện:
  - Đã đăng nhập bằng tài khoản Sale
  - Có sẵn lớp học và gói học đang hoạt động

- Các bước test:
  1. Mở màn hình Đơn hàng.
  2. Chọn tạo đơn mới.
  3. Nhập thông tin phụ huynh, học sinh, gói học.
  4. Nhập Discount lớn hơn Total.
  5. Bấm Lưu.

- Kỳ vọng:
  1. Hệ thống hiển thị validation bằng tiếng Việt.
  2. Không cho submit khi Discount lớn hơn Total.
  3. Không tạo đơn sai dữ liệu.

- Kết quả thực tế:
  1. Form hiển thị thông báo "Discount không được lớn hơn tổng tiền".
  2. Nút lưu bị khóa.

- Trạng thái: PASS
- File video: `videos/UI_B04_Orders_Trials_20260407.mp4`
- Mốc thời gian video: `00:06:10 - 00:07:25`
```

## 6. Chiến lược chạy test

Checklist gốc hiện tại có `291` case. Sau `8` video pilot đã hoàn tất `37` case, còn `254` case cần chạy tiếp (`149` case `P0`, `103` case `P1`, `2` case `P2`). Không nên quay một video duy nhất. Nên chia theo batch nghiệp vụ và role để:

- Video ngắn, dễ review
- Dễ rerun khi fail
- Dễ giao cho nhiều tester
- Dễ map lại với checklist gốc

Nguyên tắc:

- `Nhóm 12` không chạy riêng một lần độc lập
- Các case của `Nhóm 12` được gắn vào từng batch tương ứng
- Ưu tiên chạy toàn bộ `P0` trước, sau đó mới đến `P1`
- Với case có side effect mạnh, nên reset data hoặc dùng data seed riêng

Phân bổ phần còn lại để ước lượng nguồn lực:

- `B09`: `35` case
- `B05`: `34` case
- `B07`: `32` case
- `Nhóm 12` gắn kèm theo batch: `27` case
- `B06`: `25` case
- `B04`: `18` case
- `B02`: `16` case
- `B10`: `16` case
- `B08`: `15` case
- `B11`: `13` case
- `B01`: `12` case
- `B03`: `11` case

### Quy tắc bắt buộc cho video có side effect

- Không kết thúc video ngay sau toast `success` hoặc sau khi form đóng lại.
- Với mọi case có hành vi `submit`, `approve`, `reject`, `convert`, `cancel`, `mark paid`, `sync`, `reconcile`, `top-up`, `transfer`, `upload`, `create`, `edit`, `delete`, video phải quay đủ chuỗi:
  1. Màn nguồn trước khi thao tác, thấy rõ role, route, trạng thái hoặc count `before`.
  2. Form/modal đang nhập dữ liệu và thao tác bấm submit.
  3. Loading, disable submit, toast hoặc status đổi thành công/thất bại.
  4. Mở lại list/detail của chính module để xác nhận dữ liệu đã đổi.
  5. Mở ít nhất `1` màn khác có liên đới để xác nhận side effect; với luồng tài chính hoặc duyệt phải mở tối thiểu `2` màn liên đới.
- Nếu case có badge, count, pending queue hoặc realtime, phải quay rõ `before -> action -> after`.
- Nếu case có RBAC sau khi submit, phải quay thêm bước đổi role hoặc mở bằng role khác để chứng minh action/nút đã ẩn hoặc chỉ hiện đúng người có quyền.
- Nếu case có upload hoặc export, phải quay rõ file/attachment xuất hiện ở detail, preview, download list hoặc màn đích liên quan.
- Log test bắt buộc ghi thêm `Màn submit` và `Màn đối soát sau submit`.
- Case side effect chỉ được đánh dấu `PASS` khi reviewer nhìn video là thấy rõ thay đổi ở các màn liên quan, không cần suy đoán.

## 7. Ma trận tài khoản cần chuẩn bị

- `DIRECTOR`
- `ACCOUNTING`
- `OPS`
- `SALE`
- `TEACHER`
- `PARENT`
- `ADSMANAGER`
- `SHAREHOLDER`

Khuyến nghị chuẩn bị thêm:

- 1 phụ huynh mới tinh, chưa có học sinh
- 1 sale mới tinh, chưa có số liệu
- 1 giáo viên có payroll bình thường
- 1 giáo viên có payroll `HELD`
- 1 lớp Offline
- 1 lớp có substitute teacher
- 1 order trả góp
- 1 order partial payment
- 1 session auto-confirm
- 1 work session `AUTO_CLOSED`

## 8. Kế hoạch batch quay MP4

### Batch B01. Auth, App Shell, Routing

- Phạm vi:
  - Nhóm 1
  - Nhóm 12 phần chung về loading, error, validation, submit, deep-link
- Vai trò chính:
  - `DIRECTOR`, `SALE`, `SHAREHOLDER`
- Màn đối soát sau submit:
  - Đổi mật khẩu xong phải logout, login lại bằng mật khẩu mới và refresh để chứng minh session mới hoạt động đúng.
  - Case `401` hoặc logout cưỡng bức phải quay rõ route bị đẩy về `login` và menu nội bộ biến mất.
  - Case menu/badge theo role phải mở ít nhất `2` role để so trực tiếp trước và sau reload.
- Video:
  - `UI_B01_Auth_AppShell_YYYYMMDD.mp4`
- Log:
  - `LOG_B01_Auth_AppShell_YYYYMMDD.md`
- Thời lượng ước tính:
  - `25-35 phút`

### Batch B02. Dashboard, Handbook, Empty State, Alerts

- Phạm vi:
  - Nhóm 2
  - Các case empty state dashboard trong Nhóm 12
- Vai trò chính:
  - `DIRECTOR`, `OPS`, `SALE`, `PARENT`, `SHAREHOLDER`
- Trọng tâm:
  - `Critical Anomalies`
  - `Overdue Tickets`
  - `Expense Breakdown`
  - Investor Dashboard partial failure
  - `Flow Guide`
- Màn đối soát sau submit hoặc sau action:
  - Approve/reject ở `Pending Approvals` phải quay tiếp tab count, sidebar badge và detail record liên quan.
  - Click từ `Overdue Tickets`, `Quick Links`, `Action` trên dashboard phải mở đúng list đích và giữ đúng filter/ngữ cảnh.
  - Case handbook theo role phải đổi role và mở lại đúng nội dung cấu hình, không chỉ xem một màn tĩnh.
- Video:
  - `UI_B02_Dashboard_Handbook_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `35-45 phút`

### Batch B03. Users, Students, Products, Agents

- Phạm vi:
  - Nhóm 3
  - RBAC readonly của `ACCOUNTING` trên Lớp/Học sinh
- Vai trò chính:
  - `DIRECTOR`, `OPS`, `ACCOUNTING`, `SALE`
- Trọng tâm:
  - Multiple parents
  - Deactivate teacher
  - Deactivate product
  - Reassign student owner
- Màn đối soát sau submit:
  - Liên kết nhiều phụ huynh hoặc đổi owner phải mở lại `list -> detail -> filter` để thấy owner, parent list và dữ liệu không bị ghi đè.
  - `Deactivate Product` phải quay tiếp form tạo order của `SALE` để chứng minh package đã bị loại khỏi lựa chọn.
  - `Deactivate/Lock Teacher` hoặc onboarding giáo viên mới phải mở tiếp `teacher detail` và `salary config/payroll preview` nếu có dữ liệu phát sinh.
  - Tạo hoặc sửa `Agent` phải quay lại list, filter theo tier và trạng thái để xác nhận cập nhật.
- Video:
  - `UI_B03_Users_Students_Products_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `30-40 phút`

### Batch B04. Leads, Orders, Trials

- Phạm vi:
  - Nhóm 4
- Vai trò chính:
  - `SALE`, `DIRECTOR`
- Trọng tâm:
  - Auto-provision parent từ SĐT mới
  - Discount không vượt Total
  - Installment + Deferred Revenue
  - Partial payment
  - Attribution Merge timeline
  - `trial/teacher-paid-only`
- Khuyến nghị tách:
  - `UI_B04A_Leads_OrderForm_YYYYMMDD.mp4`
  - `UI_B04B_OrderApproval_SideEffects_YYYYMMDD.mp4`
- Màn đối soát sau submit:
  - Tạo lead hoặc convert lead phải mở `lead detail`, `lead list`, `order draft/detail` và nguồn attribution liên quan.
  - Submit order phải quay tiếp `order detail`, `Pending Approvals`, badge sidebar và pipeline/list tương ứng.
  - Approve/reject/request more info/cancel order phải mở tiếp `order detail`, `invoice list/detail`, `student detail/list`, các card tài chính liên quan và menu theo role.
  - Case trả góp, partial payment, trial `0đ`, `teacher-paid-only` phải mở thêm màn tài chính như `Deferred Revenue`, `Aging`, invoice hoặc payroll để thấy tác động chéo.
- Video:
  - `UI_B04_Orders_Trials_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `40-50 phút`

### Batch B05. Classes, Sessions, Attendance

- Phạm vi:
  - Nhóm 5
- Vai trò chính:
  - `OPS`, `TEACHER`, `PARENT`, `SALE`
- Trọng tâm:
  - Teacher swap
  - Co-teaching
  - Debt limit breach
  - Session auto-confirm bởi hệ thống
  - Copy link điểm danh
  - Substitute teacher RBAC
  - Pricing snapshot
- Khuyến nghị tách:
  - `UI_B05A_Class_Session_Changes_YYYYMMDD.mp4`
  - `UI_B05B_Attendance_Finalize_SideEffects_YYYYMMDD.mp4`
- Màn đối soát sau submit:
  - Tạo/sửa/xóa lớp hoặc submit class update phải mở tiếp `class detail`, `schedule/session list` và `Pending Approvals` nếu có luồng duyệt.
  - `Teacher Swap`, `Reschedule`, `Cancel`, `Remove`, `Finalize` phải mở tiếp `session detail`, lịch giáo viên, lịch phụ huynh hoặc lịch lớp để thấy rõ thay đổi.
  - Attendance submit phải quay thêm `session detail`, `attendance by class/day`, `attendance report` hoặc màn có count liên quan.
  - Case `Debt Limit Breach`, auto-confirm hệ thống, substitute teacher RBAC phải quay cả `before` và `after` ở màn teacher/parent để chứng minh UI đổi đúng ngữ cảnh.
- Video:
  - `UI_B05_Sessions_Attendance_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `45-60 phút`

### Batch B06. Teacher Hub, Parent Pages, Teaching Reports

- Phạm vi:
  - Nhóm 6
- Vai trò chính:
  - `TEACHER`, `PARENT`, `OPS`
- Trọng tâm:
  - Teacher profile và `bankInfo`
  - Form xin nghỉ/thay thế
  - Popup hoàn thành buổi học
  - Lương giáo viên chia 5 nhóm
  - `Bulk Teaching Report`
  - `general-feedback`
  - Rating 1-5 sao
- Màn đối soát sau submit:
  - Sửa `teacher profile` hoặc `bankInfo` phải mở lại `profile detail`, danh sách profile và màn duyệt profile nếu có.
  - Tạo yêu cầu nghỉ/thay thế phải mở tiếp `teacher calendar`, danh sách request và `Pending Approvals` hoặc màn OPS theo dõi.
  - Submit teaching report phải mở tiếp `pending/completed`, `session detail` và các màn lương/KPI nếu case có side effect.
  - Rating thấp hoặc `general-feedback` phải mở màn OPS/cảnh báo liên quan để xác nhận tín hiệu theo dõi đã xuất hiện.
  - Upload tài liệu phải mở lại list, filter, preview hoặc download để xác nhận file thật sự khả dụng.
- Video:
  - `UI_B06_TeacherHub_ParentPages_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `40-55 phút`

### Batch B07. Invoices, Wallets, Payroll Core

- Phạm vi:
  - Nhóm 7
- Vai trò chính:
  - `ACCOUNTING`, `DIRECTOR`, `TEACHER`, `PARENT`
- Trọng tâm:
  - Invoice approve/reject/delete
  - Wallet top-up, transfer, ledger
  - `HELD` badge reasons
  - Min payout guarantee
  - Bulk payroll partial success
  - Payroll rollback blocked
- Khuyến nghị tách:
  - `UI_B07A_Invoices_Wallets_YYYYMMDD.mp4`
  - `UI_B07B_Payroll_Core_SideEffects_YYYYMMDD.mp4`
- Màn đối soát sau submit:
  - Tạo/sửa/approve/reject invoice phải mở tiếp `invoice list/detail`, `parent invoices`, `wallet/ledger` và `aging` hoặc `financial-control` nếu có ảnh hưởng số dư.
  - Approve/reject top-up hoặc transfer ví phải quay thêm `wallet balance`, `ledger`, pending count và notification hoặc history liên quan.
  - Generate/submit/approve/reject/reopen/mark paid payroll phải mở tiếp `payroll list/detail`, màn giáo viên xem lương, `Pending Approvals` và một màn tài chính tổng hợp.
  - Case `HELD`, `Penalty`, `Min Payout Guarantee`, `Exclude Payroll`, rollback blocked phải quay rõ label trên preview/detail và màn người dùng liên quan nhìn thấy cùng trạng thái đó.
- Video:
  - `UI_B07_Payroll_Wallets_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `45-55 phút`

### Batch B08. Finance Advanced, Financial Alerts, Reconciliation

- Phạm vi:
  - Nhóm 8
- Vai trò chính:
  - `DIRECTOR`, `ACCOUNTING`, `SHAREHOLDER`
- Trọng tâm:
  - Financial Alerts severity và action
  - P&L `CASH/ACCRUAL`
  - Bank reconciliation matched/unmatched
  - Reject reconciliation
- Màn đối soát sau submit:
  - Expense, supplier payment, loan hoặc giao dịch quỹ/ngân hàng sau khi lưu phải mở lại `list -> detail -> financial-control` để thấy số liệu đổi.
  - `Reconcile` hoặc `Reject Reconciliation` phải quay tiếp summary, danh sách `Matched/Unmatched` và transaction detail liên quan.
  - `Financial Alerts` phải mở từ alert sang màn xử lý đích rồi quay lại xác nhận alert đã đổi trạng thái nếu case yêu cầu.
- Video:
  - `UI_B08_Finance_Alerts_Reconciliation_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `30-40 phút`

### Batch B09. Notifications, Messages, Chatbot, Tickets

- Phạm vi:
  - Nhóm 9
- Vai trò chính:
  - `OPS`, `PARENT`, `DIRECTOR`, `ADSMANAGER`
- Trọng tâm:
  - Bulk notification
  - Chatbot settings
  - Masked token
  - AI config
  - AI suggest only
  - Ticket refund warning
- Khuyến nghị tách:
  - `UI_B09A_Notifications_ChatbotSettings_YYYYMMDD.mp4`
  - `UI_B09B_Chatbot_Tickets_SideEffects_YYYYMMDD.mp4`
- Màn đối soát sau submit:
  - Gửi bulk notification phải quay tiếp bằng account nhận để thấy unread count, list notification và điều hướng khi click.
  - Tạo lead hoặc order từ conversation chatbot phải mở tiếp `lead/order detail`, nguồn dữ liệu và conversation source.
  - Lưu `chatbot-settings`, token, assistant profile hoặc auto-reply phải reload màn, mở lại detail và đổi role nếu cần để xác nhận masked/RBAC đúng.
  - Ticket handoff, resolve/reopen/cancel hoặc case `REFUND_REQUEST` phải mở tiếp `parent support chat`, `ticket detail` và `ledger/wallet warning` liên quan.
- Video:
  - `UI_B09_Notifications_Chatbot_Tickets_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `40-50 phút`

### Batch B10. Ads, Landing Pages, Public Flows

- Phạm vi:
  - Nhóm 10
- Vai trò chính:
  - `ADSMANAGER`, `DIRECTOR`, `SHAREHOLDER`
- Trọng tâm:
  - Tab `Việc cần làm`
  - Token sync/backfill
  - Public lead capture
  - UTM/tracking
  - Actionable tasks
- Màn đối soát sau submit:
  - CRUD Ads entity hoặc `Trigger Sync`/`Backfill` phải quay tiếp trạng thái đồng bộ, toast, log/status cuối và tab số liệu liên quan.
  - Tạo/sửa landing page phải mở `management list`, copy `public URL`, truy cập slug công khai rồi submit thực tế.
  - Submit form công khai phải mở tiếp `lead/conversation/order` hoặc nơi lưu dữ liệu nguồn để xác nhận `UTM/tracking` và record mới xuất hiện.
  - Case pixel hoặc custom `head/body` phải quay thao tác vào/ra trang hoặc reload để chứng minh không inject lặp và được dọn đúng.
- Video:
  - `UI_B10_Ads_PublicFlows_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `30-40 phút`

### Batch B11. Reports, Export, Audit

- Phạm vi:
  - Nhóm 11
- Vai trò chính:
  - `DIRECTOR`, `ACCOUNTING`, `OPS`, `SHAREHOLDER`
- Trọng tâm:
  - Inline update RBAC của Teaching Report
  - Export UTF-8 BOM
  - Streaming export 50,000+ dòng
  - Shareholder masked export
  - Audit log read-only
- Màn đối soát sau submit hoặc sau export:
  - Teaching report submit/edit hoặc inline update phải mở tiếp `pending/completed`, `session detail`, `teacher KPI` hoặc `payroll preview` nếu có tác động.
  - Export phải quay rõ file tải về, mở file để kiểm tra `UTF-8 BOM`, dữ liệu mask và đúng loại báo cáo.
  - Audit log không test đơn lẻ; phải thực hiện một thay đổi ở module khác rồi mở `audit log` để thấy bản ghi mới xuất hiện đúng filter.
  - Case RBAC của `Employee performance` hoặc `Teaching Report` phải mở lại bằng role không hợp lệ để chứng minh không lộ action.
- Video:
  - `UI_B11_Reports_Export_Audit_YYYYMMDD.mp4`
- Thời lượng ước tính:
  - `30-40 phút`

## 9. Cách dùng Nhóm 12 trong lúc test

Không quay riêng `Nhóm 12` thành một video độc lập. Thay vào đó:

- Trong mỗi batch, sau khi kiểm tra nghiệp vụ chính, kiểm tra luôn:
  - Loading state
  - Empty state
  - Error state
  - Submit disabled
  - Double click
  - RBAC ẩn/hiện nút
  - Responsive cơ bản
  - Realtime/polling nếu có

Ví dụ:

- Batch Orders kiểm thêm validation, double submit, error state
- Batch Wallets kiểm thêm RBAC transfer
- Batch Dashboard kiểm thêm empty state user mới

## 10. Tiêu chí PASS/FAIL

### PASS

- UI hiển thị đúng theo checklist
- Không sai role
- Không sai text nghiệp vụ
- Không sai side effect
- Video ghi lại rõ toàn bộ thao tác

### FAIL

- Sai text
- Sai điều hướng
- Sai phân quyền
- Không hiện cảnh báo cần có
- Không hiện badge hoặc status đúng
- Crash, treo, duplicate submit
- Xuất file sai định dạng hoặc sai dữ liệu

### BLOCKED

- Thiếu data seed
- Backend không phản hồi
- Môi trường lỗi ngoài phạm vi UI

## 11. Thứ tự ưu tiên chạy

Nếu cần chạy nhanh trước:

1. Đợt 1: chạy `P0` có side effect mạnh nhất ở `B04`, `B05`, `B07`, `B08`, `B09`, `B10`
2. Đợt 2: chạy `P0` nền tảng và RBAC ở `B01`, `B02`, `B03`
3. Đợt 3: chạy toàn bộ `P1` có phụ thuộc chéo ở `B06`, `B11` và các case `P1` còn lại trong `B03`-`B10`
4. Đợt 4: rà `Nhóm 12` theo từng batch còn thiếu và chốt `P2` như multi-tab, accessibility
5. Với `B04`, `B05`, `B07`, `B09`, ưu tiên tách sẵn video `A/B` để clip không quá dài và mỗi clip vẫn nhìn rõ chuỗi side effect

## 12. Mẫu checklist bàn giao cuối ngày

```md
## Báo cáo test ngày 2026-04-07

- Batch đã chạy:
  - B01: PASS
  - B02: FAIL
  - B04: PASS

- Tổng case đã chạy: 62
- PASS: 54
- FAIL: 6
- BLOCKED: 2

- Lỗi nổi bật:
  1. Dashboard Director không hiện Critical Anomaly.
  2. Form Order vẫn cho lưu khi Discount > Total.
  3. Wallet Transfer vẫn lộ nút với role OPS.

- Video:
  - `UI_B01_Auth_AppShell_20260407.mp4`
  - `UI_B02_Dashboard_Handbook_20260407.mp4`
  - `UI_B04_Orders_Trials_20260407.mp4`
```

## 13. Kết luận

Đây là kế hoạch thực thi test UI thủ công có ghi hình, phù hợp với checklist hiện tại `291` case. Cách làm phù hợp nhất là:

- Chia theo batch nghiệp vụ
- Ghi hình từng batch ra `MP4`
- Ghi log test bằng tiếng Việt
- Map mỗi lỗi với mốc thời gian video và case cụ thể
- Chỉ chốt `PASS` cho case còn lại khi video chứng minh được thay đổi ở màn nguồn và các màn liên đới sau submit


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

## Cập nhật pilot 2026-04-07

- Đã có `8` video pilot pass theo kế hoạch; batch mới nhất chạy lúc `2026-04-07 21:30:47 +07:00`.
- Các batch đã có evidence: `B01`, `B02-P1`, `B02-P2`, `B03`, `B04-P1`, `B04-P2`, `B05-P1`, `B05-P2`.
- Quy ước đánh dấu hiện tại:
  - `[x]`: đã có video + automation pass trên môi trường hiện tại.
  - `[ ]`: chưa test hoặc mới chỉ cover một phần, chưa đủ điều kiện đánh dấu hoàn tất.
- Các line partial coverage cũ đã được sync xong trong checklist authoritative; follow-up hiện tại chuyển sang suite hygiene cho legacy omnibus/spec cũ.

## Cập nhật kế hoạch 2026-04-08

- Phần còn lại phải bám theo kế hoạch chi tiết tại `C:\Users\PC\Documents\code\vuitran\qa\plans\frontend-ui\master-test-plan.vi.md`.
- Với mọi case có `submit`, `approve`, `reject`, `convert`, `cancel`, `mark paid`, `sync`, `reconcile`, `top-up`, `transfer`, `upload`, `create`, `edit`, `delete`, video test không được dừng ở toast thành công.
- Video bắt buộc phải mở lại `list/detail` của chính chức năng vừa thao tác và mở thêm ít nhất `1` màn liên đới để thấy rõ side effect; riêng luồng tài chính hoặc duyệt phải mở ít nhất `2` màn liên đới.
- Chỉ đổi từ `[ ]` sang `[x]` khi có đủ video chứng minh thay đổi ở màn nguồn và các màn bị ảnh hưởng sau submit.

## Đồng bộ evidence 2026-04-08

- Đã sync ngược `71` case `PASS` từ `qa/reports/frontend-ui/remaining-cases.vi.md` vào checklist gốc.
- Nguồn đối soát chính: `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\remaining-cases.vi.md`, `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\EXECUTION-RESULTS-ALL.vi.md` và `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\final-verification-20260408.vi.md`.
- Follow-up automation đã sync thêm từ `notifications-leads-landing-ui.spec.ts` (`33/33 PASS`) và `webhooks-chatbot-tickets-ui.spec.ts` (`38/38 PASS`).
- Batch xác minh cuối trên workspace chính: `153/153 PASS`; trong batch này chỉ sync thêm `2` dòng checklist mới đủ UI proof.
- Batch browser-first mới: `app-shell-handbook-browser-ui.spec.ts` = `7/7 PASS`, sync thêm `7` dòng checklist cho `B01/B02`.
- Batch browser-first tiếp theo: `dashboard-pending-approvals-browser-ui.spec.ts` = `4/4 PASS`, sync thêm `4` dòng checklist cho `B02`.
- Batch browser-first follow-up: `app-shell-handbook-browser-ui.spec.ts` = `8/8 PASS`, `dashboard-pending-approvals-browser-ui.spec.ts` = `5/5 PASS`, sync thêm `2` dòng checklist cho `B01/B02`.
- Batch browser-first investor: `investor-dashboard-browser-ui.spec.ts` = `1/1 PASS`, sync thêm `1` dòng checklist cho `B02`.
- Batch browser-first preview: `dashboard-pending-approvals-browser-ui.spec.ts` = `6/6 PASS`, sync thêm `1` dòng checklist cho `B02`.
- Review dashboard màn hẹp và 3 line `Overdue Tickets` / `Critical Anomalies` / `Expense Breakdown`: đã chốt fix và sync checklist bằng batch browser-first director dashboard.
- Số case còn mở sau đồng bộ: `183`.

## Cập nhật dashboard browser-first 2026-04-08

- Batch browser-first director dashboard: `director-dashboard-browser-ui.spec.ts` = `3/3 PASS`.
- Rerun liên quan: `app-shell-handbook-browser-ui.spec.ts` + `dashboard-pending-approvals-browser-ui.spec.ts` = `14/14 PASS`.
- Sync thêm `4` dòng checklist cho `B02`.
- Snapshot mới sau đồng bộ: `71 PASS / 183 open`.

## Đồng bộ suite hygiene 2026-04-11

- [x] `P1` Rescue `webhooks-chatbot-tickets-ui.spec.ts` để batch `18.1` đến `20.1` chạy full `38/38 PASS`; `18.5 AI Assistant Profile Tuning` không còn `skip` do `assistantType` exhaustion trên shared env. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rerun legacy omnibus `scenarios-12-5-to-13-4.spec.ts` xác nhận full `12/12 PASS`; nhánh `13.4 payroll lifecycle` đã chuyển sang fixture deterministic và file không còn `test.skip/fixme` trên current tree. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rescue legacy omnibus `scenarios-deep-reject-reschedule-payroll-loans-12.spec.ts` xác nhận full `22/22 PASS`; nhánh `3.4 payroll state machine` không còn `skip` do ambient teacher/period drift hoặc `429` từ public attendance seed. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rescue legacy omnibus `scenarios-10-3-to-12-4.spec.ts` xác nhận full `13/13 PASS`; các nhánh `10.3-12.4` không còn fail/skip do ambient `SHAREHOLDER` account drift hoặc teacher-ownership login mismatch ở `11.3`. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rescue legacy omnibus `scenarios-deep-orders-1-1-to-2-4.spec.ts` xác nhận full `12/12 PASS`; file không còn `test.skip/fixme`, invoice rollback và wallet ops đã chạy deterministic theo current contract. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rescue legacy omnibus `scenarios-15-2-to-17-4.spec.ts` xác nhận full `11/11 PASS`; `17.1` không còn phụ thuộc scan-live `/classes` và file không còn `test.skip/fixme` trên current tree. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rescue legacy omnibus `session-revenue-first-10.spec.ts` xác nhận full `4/4 PASS`; các nhánh `2.2-2.3` không còn `test.fixme` và file đã chạy deterministic trên current tree. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rescue legacy omnibus `cash-inflow-first-10.spec.ts` xác nhận full `6/6 PASS`; các nhánh `1.4` và `1.6` không còn `test.fixme`, file đã được rebase theo current contract (`trial 0đ` invoice auto-approve exempt proof, `INSTALLMENT_2` partial-payment giữ `2` invoice rounds `PENDING_APPROVAL`), và `frontend/e2e` hiện còn `0` occurrences `test.skip/fixme`. `(sync authoritative 2026-04-11 suite hygiene browser)`
- [x] `P1` Rerun `b08-supplier-payments-browser-ui.spec.ts` và `b08-supplier-quotes-browser-ui.spec.ts` sau cleanup compile-hygiene; `2/2 PASS`, webserver build không còn warning `NG8107` ở `supplier-payments.component.ts` / `supplier-quotes.component.ts`, và oracle browser B08 vẫn giữ nguyên. `(sync authoritative 2026-04-11 suite hygiene browser)`
- Note 2026-04-12: `crisis-opex-components.component.spec.ts` authoritative rerun hẹp đã PASS `82/82`; xem log [LOG_B08_supplier_payments_unit_20260412.md](/C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-12/logs/LOG_B08_supplier_payments_unit_20260412.md).
- [x] `P1` Rerun `release-gate-ui.spec.ts` xác nhận full `5/5 PASS`; regression gate cross-surface cho route guard, order submit, invoice-proof guard, teacher attendance/report, và auto-logout `401` đã xanh trên current tree sau cleanup suite hygiene. `(sync authoritative 2026-04-11 regression gate browser)`
- [x] `P1` Rerun bundle `b04-order-approval-linked-views-browser-ui.spec.ts` + `orders-report-metrics-ui.spec.ts` + `b05-attendance-report-browser-ui.spec.ts` xác nhận full `5/5 PASS`; note lịch sử `orders -> approve -> comprehensive report -> attendance report` nay đã được refresh bằng browser proof same-day cho linked views, report metrics, pagination và preview ảnh. `(sync authoritative 2026-04-11 regression browser)`
- [x] `P1` Rerun `orders-flow-ui.spec.ts` xác nhận full `9/9 PASS`; legacy order pipeline `1.1 -> 2.4` vẫn xanh trên current tree, bao gom pipeline counts, RBAC sale/director, session `FINALIZED`, `LOW_BALANCE`, Financial Control `P&L`, va sessions filter theo ngay hom nay. `(sync authoritative 2026-04-11 regression browser)`
- [x] `P1` Rerun smoke bundle `release-gate-ui.spec.ts` + `orders-flow-ui.spec.ts` + `orders-report-metrics-ui.spec.ts` xác nhận full `16/16 PASS`; current tree giu on dinh cho route/access gate, order submit/approve/reject pipeline, report-alignment sau approve, teacher attendance/report handoff, wallet `LOW_BALANCE`, va Financial Control `P&L`. `(sync authoritative 2026-04-11 smoke bundle browser)`
- [x] `P1` Rerun lane-C regression bundle `webhooks-chatbot-tickets-ui.spec.ts` + `notifications-leads-landing-ui.spec.ts` + `specs/b06-b11-followup-ui.spec.ts` xác nhận full `78/78 PASS`; current tree giu on dinh cho `B06/B09/B10/B11` across notifications/leads/landing, chatbot/tickets/backfill, va follow-up reporting/RBAC surfaces. `(sync authoritative 2026-04-11 lane-c regression browser)`

## Đồng bộ unit drift 2026-04-12

- Ghi nhận rerun authoritative cho `wallets-refunds-components.component.spec.ts`, `payroll-transaction.service.spec.ts`, và `webhook.controller.spec.ts`; toàn bộ target hiện đã PASS sau khi sync API `isCreditEntry()`, `findOneAndUpdate()` upsert, và fallback Redis readiness path. `(LOG_B07_wallets_refunds_unit_20260412, LOG_B07_payroll_webhook_unit_20260412)`
- Ghi nhận rerun authoritative cho `notifications-leads-components.component.spec.ts` và `cron-jobs-components.component.spec.ts`; toàn bộ target hiện đã PASS sau khi sync `AuthService` provider chain, `HttpClientTestingModule`, và đổi spec sang `formatChangeRequestStatus()` / `canRequestSessionChange()`. `(LOG_B09_notifications_leads_unit_20260412, LOG_B12_cronjobs_sessions_unit_20260412)`
- Ghi nhận rerun authoritative cho `state-machine-components.component.spec.ts`; target `InvoicesComponent` hiện đã PASS sau khi sync stub `UserService.listSales()` theo contract hiện tại, không đổi oracle. `(LOG_B13_state_machine_invoices_unit_20260412)`
- Ghi nhận rerun authoritative cho `change-requests-capital-components.component.spec.ts`; omnibus spec hiện đã PASS sau khi sync toàn bộ expectation tiếng Việt sang contract hiện tại của `LoansComponent`, `StaffPayrollComponent`, `AgentsComponent`, và `SessionsComponent`. `(LOG_B14_change_requests_capital_unit_20260412)`

## Nhóm 1. Auth, Session, Routing, App Shell

- [x] `P0` Đăng nhập thành công với tài khoản hợp lệ. `(B01 pilot)`
- [x] `P0` Đăng nhập sai email hoặc mật khẩu hiển thị lỗi đúng. `(B01 pilot)`
- [x] `P0` Đăng nhập bị giới hạn thử quá nhiều lần hiển thị thông báo phù hợp. `(sync browser-first 2026-04-08)`
- [x] `P0` Nút hiện/ẩn mật khẩu hoạt động đúng. `(sync evidence 2026-04-08)`
- [x] `P0` Trạng thái loading khi submit login khóa nút và tránh submit lặp. `(sync evidence 2026-04-08)`
- [x] `P0` Refresh trang khi đã đăng nhập vẫn restore session từ cookie. `(sync browser-first 2026-04-08)`
- [x] `P0` Màn hình đổi mật khẩu submit thành công với mật khẩu cũ đúng và hiển thị thông báo hoàn tất rõ ràng. `(sync authoritative 2026-04-11 B01 change-password browser)`
- [x] `P0` Màn hình đổi mật khẩu hiển thị validation đúng khi mật khẩu cũ sai, mật khẩu mới yếu hoặc confirm không khớp. `(sync authoritative 2026-04-11 B01 change-password browser)`
- [x] `P0` Chưa đăng nhập mà vào route nội bộ thì bị chuyển về `login`. `(B01 pilot)`
- [x] `P0` Đang ở màn hình nội bộ nhưng API trả `401` thì bị logout và về `login`. `(sync verification 2026-04-08 final)`
- [x] `P0` Người dùng không có quyền vào route thì bị chuyển sang `not-authorized`. `(B01 pilot)`
- [x] `P0` Role `SHAREHOLDER` vào app phải được điều hướng về `investor-dashboard`. `(B02-P2 pilot)`
- [x] `P0` Menu trái hiển thị đúng theo role. `(sync browser-first 2026-04-08)`
- [x] `P0` Badge thông báo và chờ duyệt hiển thị đúng, cập nhật đúng. `(sync browser-first 2026-04-08)`
- [x] `P0` Thu gọn/mở rộng sidebar hoạt động đúng và giữ state sau reload. `(B02-P2 pilot)`
- [x] `P0` Loading bar khi chuyển route hiển thị và biến mất đúng thời điểm. `(sync browser-first 2026-04-08 follow-up)`
- [x] `P1` Link active trong sidebar đúng theo route và query param. `(sync browser-first 2026-04-08)`
- [x] `P1` Route không tồn tại bị chuyển đúng về trang mặc định. `(sync authoritative 2026-04-10 B01 unknown-route browser)`

## Nhóm 2. Dashboard, Hub Duyệt & Cẩm Nang Theo Role

- [x] `P0` Load đúng dashboard cho từng role: `DIRECTOR`, `ACCOUNTING`, `OPS`, `TEACHER`, `PARENT`, `SALE`, `ADSMANAGER`, `SHAREHOLDER`. `(B02-P1 + B02-P2 pilot)`
- [x] `P0` Dashboard có skeleton/loading state trong lúc tải. `(sync browser-first 2026-04-08)`
- [x] `P0` Dashboard có error state và nút tải lại khi API lỗi. `(sync browser-first 2026-04-08)`
- [x] `P0` Dashboard nổi bật khu vực `Overdue Tickets` với màu đỏ/badge cảnh báo rõ khi có vé quá hạn và click vào phải điều hướng đúng sang danh sách ticket quá hạn. `(sync browser-first 2026-04-08 director dashboard)`
- [x] `P0` Director Dashboard hiển thị nổi bật các `Critical Anomalies` hoặc cảnh báo dữ liệu nghiêm trọng như "Lương đã chi nhưng không có báo cáo giảng dạy", với màu/khối cảnh báo đủ nổi để không bị bỏ sót. `(sync browser-first 2026-04-08 director dashboard)`
- [x] `P1` Director Dashboard render đúng biểu đồ `Expense Breakdown` theo từng danh mục chi phí như `RENT`, `EQUIPMENT`, không gộp sai nhóm và legend/màu sắc đọc được rõ ràng. `(sync browser-first 2026-04-08 director dashboard)`
- [x] `P1` Investor Dashboard vẫn render được phần còn sống khi một widget/biểu đồ lỗi riêng lẻ, không làm sập toàn trang; các filter thời gian `3/6/12 tháng` đổi đúng dữ liệu theo từng khối. `(sync browser-first 2026-04-08 investor)`
- [x] `P1` Banner handbook hiển thị đúng theo role. `(sync evidence 2026-04-08)`
- [x] `P1` Widget, card, số liệu và CTA không lộ dữ liệu sai role. `(sync evidence 2026-04-08)`
- [x] `P1` Dashboard không vỡ layout ở màn hình hẹp. `(sync browser-first 2026-04-08 director dashboard)`
- [x] `P1` Trang "Cẩm nang nội bộ" (Internal Handbook) hiển thị đúng nội dung cấu hình theo Role đang đăng nhập (Director, Accounting, OPS...). `(sync evidence 2026-04-08)`
- [x] `P1` Click vào các Quick Links trong Cẩm nang điều hướng chính xác. `(sync browser-first 2026-04-08)`
- [x] `P1` Các Video và Ảnh minh họa (Gallery) tải và hiển thị đúng mà không vỡ UI. `(sync browser-first 2026-04-08)`
- [x] `P1` Trang `teacher-hub` tải đúng landing content, CTA và tài liệu dành cho Giáo viên. `(B02-P1 pilot)`
- [x] `P1` Trang `sale-hub` tải đúng landing content, CTA và checklist dành cho Sale/Director. `(B02-P1 pilot)`
- [x] `P1` Vào trực tiếp `teacher-hub` hoặc `sale-hub` bằng URL vẫn áp dụng đúng RBAC và redirect. `(B02-P1 pilot)`
- [x] `P0` Màn hình Hub Duyệt (Pending Approvals) tải đúng các tab: Bảng lương, Hóa đơn, Nạp ví, Giáo viên mới, Sửa lớp, Đổi buổi học. `(B02-P1 pilot)`
- [x] `P0` Chuyển qua lại giữa các tab trong Pending Approvals không bị vỡ layout, hiển thị đúng list dữ liệu. `(sync browser-first 2026-04-08)`
- [x] `P0` Badge số lượng (Count) hiển thị ở từng tab và trên Menu Sidebar phải khớp nhau. `(sync browser-first 2026-04-08)`
- [x] `P0` Phê duyệt (Approve) và Từ chối (Reject) ngay tại Hub cập nhật trạng thái UI và giảm số lượng đếm realtime. `(sync browser-first 2026-04-08 follow-up)`
- [x] `P1` UI Preview (xem trước) thay đổi thời lượng học sinh ở tab "Sửa lớp" render chính xác trước/sau thay đổi. `(sync browser-first 2026-04-08 preview)`

## Nhóm 3. Quản Lý Người Dùng, Học Sinh, Sản Phẩm, Đại Lý

- [x] `P1` Tạo user mới với role hợp lệ. `(B03 pilot)`
- [x] `P1` Sửa user hiện có, đổi role, đổi thông tin cơ bản. `(B03 pilot)`
- [x] `P1` Không cho xóa hoặc sửa vượt quyền. `(sync authoritative 2026-04-11 B03 users-over-permission browser)`
- [x] `P1` Tự sửa tài khoản của chính mình không gây lỗi quyền hoặc trạng thái bất thường. `(sync authoritative 2026-04-11 B03 users-self-edit browser)`
- [x] `P1` Quản lý parent owner assignment hoạt động đúng. `(B03 pilot)`
- [x] `P1` Parent ads attribution lưu, cập nhật, xóa đúng. `(sync authoritative 2026-04-10 Wave 4)`
- [x] `P1` Tạo/sửa/xóa học sinh hoạt động đúng. `(B03 pilot)`
- [x] `P1` Chọn parent cho học sinh hoạt động đúng. `(B03 pilot)`
- [x] `P1` UI liên kết một học sinh với nhiều phụ huynh hiển thị đúng danh sách parent và không ghi đè nhầm owner hiện tại. `(sync authoritative 2026-04-11 B03 students multi-parent browser)`
- [x] `P1` Học sinh có nhiều phụ huynh vẫn hiển thị đúng thông tin ở form/detail/list và thao tác lưu không mất liên kết phụ. `(sync authoritative 2026-04-11 B03 students multi-parent browser)`
- [x] `P1` Chuyển giao học sinh/parent owner từ Sale này sang Sale khác hiển thị rõ Sale cũ/Sale mới, có confirm và cập nhật đúng owner ở list, detail và bộ lọc liên quan. `(sync authoritative 2026-04-11 B03 parent-owner-transfer browser)`
- [x] `P1` Upload ảnh khuôn mặt học sinh thành công và xử lý lỗi upload đúng. `(sync evidence 2026-04-08)`
- [x] `P1` Tạo/sửa/xóa sản phẩm hoạt động đúng. `(B03 pilot)`
- [x] `P1` Vô hiệu hóa gói học (Deactivate Product) làm sản phẩm hiển thị đúng trạng thái ngừng bán và Sale không thể chọn gói đó khi tạo đơn mới. `(sync evidence 2026-04-10 B03 browser authoritative)`
- [x] `P1` Vô hiệu hóa Giáo viên (Deactivate/Lock) có confirm rõ ràng, đổi trạng thái đúng trên list/detail và ẩn các action không còn hợp lệ. `(sync authoritative 2026-04-11 B03 teacher-deactivation browser)`
- [x] `P1` Onboarding Giáo viên mới cho phép thiết lập luôn Salary Config mặc định, validate đủ trường bắt buộc và phản ánh đúng cấu hình lương ngay sau khi tạo. `(sync authoritative 2026-04-11 B03 teacher-onboarding-salary-config browser)`
- [x] `P0` Danh sách Đại lý (Agents) hiển thị đúng theo role (Director, Accounting, OPS, Sale). `(B03 pilot)`
- [x] `P0` Tạo mới Đại lý với các hạng (Tier) GOLD, SILVER, PLATINUM và mức hoa hồng tương ứng. `(sync authoritative 2026-04-11 B03 agent-tier-matrix browser)`
- [x] `P1` Edit thông tin Đại lý. `(B03 pilot)`
- [x] `P1` Thay đổi trạng thái Đại lý (Suspend / Activate) có hiển thị dialog confirm và cập nhật đúng UI. `(B03 pilot)`
- [x] `P1` Sale không có quyền truy cập hoặc không thấy nút "Tạo đại lý". `(B03 pilot)`

## Nhóm 4. Sales Funnel: Leads, Orders, Trial Enrollments

- [x] `P0` Tạo lead mới với dữ liệu tối thiểu. `(sync evidence 2026-04-08 B04/B09 follow-up)`
- [x] `P0` Sửa lead, cập nhật contact, gán sale. `(sync authoritative 2026-04-11 B04 lead edit-contact-assign browser)`
- [x] `P0` Reassign lead từ Sale này sang Sale khác hiển thị đúng modal chọn người nhận, có confirm và cập nhật đúng owner ở list, detail và lịch sử thay đổi. `(sync authoritative 2026-04-11 B04 lead-reassign browser)`
- [x] `P1` Lead detail hiển thị Attribution Merge theo dạng timeline touchpoints khi cùng một SĐT có nhiều nguồn marketing như Facebook và Google, thay vì chỉ giữ một nguồn cuối cùng. `(sync authoritative 2026-04-11 B04 lead-attribution-merge-timeline browser)`
- [x] `P0` Convert lead sang order đúng dữ liệu. `(sync authoritative 2026-04-11 B04 lead-convert-order browser)`
- [x] `P0` Mark lead lost, return to pool, xem stale/pool đúng. `(sync authoritative 2026-04-11 B04 lead lifecycle browser)`
- [x] `P0` Tạo order từ dữ liệu parent/student mới. `(B04-P1 pilot)`
- [x] `P0` Sale nhập số điện thoại phụ huynh hoàn toàn mới trong form Order vẫn submit thành công và UI xử lý đúng luồng auto-provision parent/user mà không bắt buộc tạo trước ở màn Users. `(B04-P1 pilot)`
- [x] `P0` Tạo order từ parent/student đã tồn tại. `(B04-P2 pilot)`
- [x] `P0` Chọn package, lớp, hình thức học và tính giá đúng. `(sync authoritative 2026-04-11 B04 package-class-mode-pricing browser)`
- [x] `P0` Discount làm thay đổi `finalAmount` đúng trên UI. `(B04-P1 pilot)`
- [x] `P0` Form Order không cho phép nhập Discount lớn hơn Total, hiển thị validation rõ và khóa submit cho tới khi số tiền hợp lệ. `(B04-P2 pilot)`
- [x] `P0` Installment hiển thị đúng số kỳ và số tiền liên quan. `(sync authoritative 2026-04-11 B04 installment-payment-plan browser)`
- [x] `P0` Đơn hàng trả góp hiển thị rõ lịch thanh toán từng kỳ và phản ánh đúng tác động lên thẻ `Deferred Revenue` hoặc `Doanh thu chờ thu` trên các màn tài chính liên quan. `(sync authoritative 2026-04-11 B04 installment-deferred-revenue browser)`
- [x] `P0` Partial Payment hiển thị rõ số đã thanh toán, số còn thiếu và badge/trạng thái chưa thanh toán đủ. `(sync authoritative 2026-04-11 B04 partial-payment browser)`
- [x] `P0` Trial `0đ` hiển thị đúng badge và không hiển thị sai amount. `(sync authoritative 2026-04-11 B04 trial-zero-amount browser)`
- [x] `P1` Luồng `trial/teacher-paid-only` cho phép chốt học thử không tiếp tục nhưng vẫn giữ khoản lương cho Giáo viên, đồng thời UI không charge nhầm Phụ huynh. `(sync authoritative 2026-04-11 B04 trial teacher-paid-only browser)`
- [x] `P0` Upload receipt/chứng từ cho order hoạt động đúng. `(B04-P1 pilot)`
- [x] `P0` Submit order vào luồng duyệt hoạt động đúng. `(B04-P1 pilot)`
- [x] `P0` Approve order cập nhật đúng badge, pipeline và dữ liệu liên quan. `(sync evidence 2026-04-08)`
- [x] `P0` Sau khi duyệt order, các màn liên đới hiển thị đúng dữ liệu phát sinh: chi tiết order có `Invoice` phát sinh, màn `Quản lý hóa đơn` thấy invoice mới, màn `Quản lý học sinh` thấy học sinh được provision/liên kết đúng, và menu theo role vẫn chỉ hiện đúng các mục được phép truy cập. `(sync authoritative 2026-04-11 B04 order-approval-linked-views browser)`
- [x] `P0` Reject order hiển thị đúng trạng thái và lý do từ chối. `(sync authoritative 2026-04-11 B04 order-review-actions browser)`
- [x] `P0` Request more info hoạt động đúng và phản ánh trên UI. `(sync authoritative 2026-04-11 B04 order-review-actions browser)`
- [x] `P0` Cancel order cập nhật đúng toàn bộ màn liên quan. `(sync authoritative 2026-04-11 B04 order-cancel-linked-views browser)`
- Note 2026-04-12: `orders.component.spec.ts` authoritative rerun hẹp đã PASS `61/61`; xem log [LOG_B13_orders_component_unit_20260412.md](/C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-12/logs/LOG_B13_orders_component_unit_20260412.md).
- [x] `P1` Tạo order từ conversation chatbot giữ đúng dữ liệu nguồn. `(sync authoritative 2026-04-10 Wave 3)`
- [x] `P1` Trial enrollment create/edit/approve/reject/convert hoạt động đúng. `(B04-P2 pilot)`
- [x] `P1` Trial enrollment trạng thái `waiting decision` hiển thị đúng. `(B04-P2 pilot)`

## Nhóm 5. Classes, Sessions, Attendance

- [x] `P0` Tạo lớp mới với dữ liệu tối thiểu. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P0` Sửa lớp hiện có và reload dữ liệu đúng. `(sync authoritative 2026-04-10 B05 browser)`
- [x] `P0` Khi sửa giá lớp hoặc đơn giá cấu hình, UI vẫn giữ nguyên `amountCharged` của các session lịch sử; phần lịch sử/phát sinh cũ không bị thay đổi theo giá mới. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P0` Xóa lớp hiển thị confirm và xử lý trạng thái đúng. `(sync authoritative 2026-04-10 B05 browser)`
- [x] `P0` Gán học sinh vào lớp hoạt động đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P0` Cấu hình riêng cho học sinh trong lớp hoạt động đúng. `(sync authoritative 2026-04-10 B05 student-config browser)`
- [x] `P0` Student Configs cho phép gán một học sinh nhiều slot hoặc nhiều giáo viên khác nhau trong cùng một lớp, hiển thị đúng ở form, detail lớp và lịch sau khi lưu. `(sync authoritative 2026-04-10 B05 multi-slot browser)`
- Note 2026-04-12: backend e2e authoritative rerun `group14-class-config.e2e-spec.ts` da PASS `14/14` sau khi cleanup root mongo bootstrap va module teardown; xem log [LOG_BA04_group14_class_config_20260412.md](/C:/Users/PC/Documents/code/vuitran/runtime-logs/backend-api/2026-04-12/LOG_BA04_group14_class_config_20260412.md).
- [x] `P0` Lớp Offline hỗ trợ co-teaching cho phép chọn nhiều giáo viên (GV chính, GV phụ), hiển thị đúng vai trò từng giáo viên và cả hai đều có quyền thao tác điểm danh/báo cáo theo cấu hình. `(sync authoritative 2026-04-11 B05 offline co-teaching browser)`
- [x] `P0` Teacher Swap của lớp hoặc session hiển thị rõ giáo viên cũ/mới, validate xung đột lịch hợp lý và cập nhật đúng lịch, session detail và các màn liên quan sau khi đổi. `(sync authoritative 2026-04-11 B05 teacher-swap conflict-validation browser; combined with 2026-04-10 propagation proof)`
- [x] `P1` Khi OPS đổi sang giáo viên có mức lương cao hơn, UI hiển thị cảnh báo vàng "Biên lợi nhuận thu hẹp" ở modal/detail/dashboard liên quan trước khi xác nhận đổi giáo viên. `(sync authoritative 2026-04-10 B05 teacher-swap margin-warning browser)`
- [x] `P0` Luồng pending class update approve/reject hoạt động đúng. `(sync authoritative 2026-04-10 B05 cross-batch browser)`
- [x] `P0` Tạo session đơn và bulk create session hoạt động đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P0` View detail session hiển thị đủ thông tin. `(sync authoritative 2026-04-10 B05 session-detail browser)`
- [x] `P0` Teacher complete session hoạt động đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P0` Nút "Hoàn thành buổi học" mở popup/form bắt buộc nhập đầy đủ `Nội dung`, `Bài tập`, `Ghi chú` theo đúng trải nghiệm dành cho giáo viên trước khi hoàn tất session. `(sync authoritative 2026-04-10 B05 complete-session modal browser)`
- [x] `P0` Parent confirm session hoạt động đúng. `(B05-P1 pilot)`
- [x] `P0` Với session được auto-confirm sau 48h, UI ở chi tiết buổi học hiển thị rõ nguồn gốc là "Xác nhận tự động bởi Hệ thống", không gắn nhầm tên Phụ huynh là người xác nhận. `(sync authoritative 2026-04-10 B05 auto-confirm source browser)`
- [x] `P0` Finalize session cập nhật trạng thái đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P0` Khi OPS cố chốt buổi học cho phụ huynh đã chạm giới hạn nợ, UI hiển thị cảnh báo Debt Limit Breach rõ ràng và không cho finalize im lặng. `(sync authoritative 2026-04-10 B05 debt-limit warning browser; current contract surfaces post-finalize walletDeductError instead of hard-stop precheck)`
- [x] `P0` Cancel session cập nhật đúng badge, lịch sử và số liệu liên quan. `(sync authoritative 2026-04-10 B05 cancel-session browser)`
- [x] `P0` Reschedule session hiển thị form đổi ngày/giờ đúng, validate xung đột lịch hợp lý và cập nhật lại lịch sử/session detail sau khi lưu. `(sync authoritative 2026-04-11 B05 session-reschedule browser)`
- [x] `P0` Remove session hoạt động đúng nếu role cho phép. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Khi session đã gán `Substitute Teacher`, UI ẩn hoặc chặn nút điểm danh của Giáo viên chính, chỉ cho giáo viên dạy thay thao tác các action được phép. `(sync authoritative 2026-04-11 B05 substitute-attendance RBAC browser)`
- Note 2026-04-12: backend class-config/pricing-snapshot/substitute suite `group14-class-config.e2e-spec.ts` da PASS authoritative `14/14`; log [LOG_BA04_group14_class_config_20260412.md](/C:/Users/PC/Documents/code/vuitran/runtime-logs/backend-api/2026-04-12/LOG_BA04_group14_class_config_20260412.md).
- [x] `P0` Attendance theo lớp/ngày load đúng danh sách. `(B05-P1 pilot)`
- [x] `P0` Mark từng học sinh present/absent/late hoạt động đúng. `(sync authoritative 2026-04-11 B05 attendance present-absent-late browser)`
- [x] `P0` Mark all present hoạt động đúng. `(sync authoritative 2026-04-10 B05 attendance browser)`
- [x] `P0` Bulk Attendance cho lớp Offline hiển thị đúng toàn bộ học sinh trong lớp và lưu hàng loạt không sai mapping học sinh-trạng thái. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P0` Chỉ cho save attendance khi có thay đổi cần lưu. `(sync authoritative 2026-04-10 B05 attendance browser)`
- [x] `P0` Link điểm danh theo học sinh được tạo đúng. `(B05-P1 pilot)`
- [x] `P1` Nút copy link điểm danh tự động hoạt động mượt mà, copy đúng URL, có phản hồi thành công/thất bại rõ ràng và không tạo nhiều toast lỗi lặp. `(sync authoritative 2026-04-10 B05 attendance browser; current contract uses single alert/fallback feedback)`
- [x] `P0` Trang `student-attendance/:token` với token hợp lệ tải đúng thông tin. `(B05-P2 pilot)`
- [x] `P0` Trang `student-attendance/:token` với token sai/hết hạn hiển thị lỗi đúng. `(B05-P2 pilot)`
- [x] `P0` Luồng camera được cấp quyền và chụp ảnh thành công. `(B05-P2 pilot)`
- [x] `P0` Luồng camera bị từ chối quyền hiển thị lỗi hoặc hướng dẫn phù hợp. `(B05-P2 pilot)`
- [x] `P0` Submit attendance từ camera tránh double submit. `(B05-P2 pilot)`
- [x] `P1` Attendance report có filter, phân trang, preview ảnh đúng. `(sync authoritative 2026-04-10 B05 attendance-report browser)`
- [x] `P1` Parent attendance hiển thị đúng dữ liệu của phụ huynh hiện tại. `(sync authoritative 2026-04-10 B05 parent-attendance browser)`
- [x] `P0` Ở chi tiết Session (trạng thái SCHEDULED), hiển thị nút "Yêu cầu thay đổi" dành cho Sale. `(sync authoritative 2026-04-11 B05 sale-side session-change request browser)`
- [x] `P0` Sale submit yêu cầu thay đổi (đổi giờ học, đổi GV) thành công. `(sync authoritative 2026-04-11 B05 sale-side session-change request browser)`
- [x] `P0` Lịch sử yêu cầu thay đổi (Request History) hiển thị đúng trong modal Session Detail. `(sync authoritative 2026-04-11 B05 sale-side session-change request browser)`
- [x] `P1` Director/OPS duyệt yêu cầu đổi buổi học → UI cập nhật thông tin session. `(sync authoritative 2026-04-10 B05 session-change approval browser)`
- [x] `P1` Màn hình "Calendar Overview" (Lịch tổng quan) filter đúng theo Giáo viên hoặc Lớp học. `(sync authoritative 2026-04-11 B05 calendar-overview teacher-class filters browser)`

## Nhóm 6. Teacher Hub, Parent Pages, Teaching Materials

- [x] `P1` Teacher profile tải hồ sơ hiện tại đúng. `(sync authoritative 2026-04-10 Wave 4)`
- [x] `P1` Sửa teacher profile, thêm/xóa qualification, availability hoạt động đúng. `(sync evidence 2026-04-10 B06 browser authoritative)`
- [x] `P1` Teacher profile lưu đúng `bankInfo` với validation đầy đủ cho tên ngân hàng, số tài khoản, chủ tài khoản để tránh làm hỏng dữ liệu payroll. `(sync evidence 2026-04-08)`
- [x] `P1` Teacher profiles list và profile detail hoạt động đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Approve teacher profile hoạt động đúng với role phù hợp. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teacher calendar chuyển tháng, xem session theo ngày đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Parent calendar chuyển tháng, xem session theo ngày đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teacher substitute request tạo yêu cầu mới đúng. `(sync evidence 2026-04-08)`
- [x] `P1` Form xin nghỉ hoặc thay thế của giáo viên bắt buộc `Đến ngày >= Từ ngày`, hiển thị validation rõ và không cho submit nếu khoảng ngày không hợp lệ. `(sync evidence 2026-04-08)`
- [x] `P1` Teacher KPI filter/sort/detail hoạt động đúng. `(sync evidence 2026-04-10 B06 browser authoritative)`
- [x] `P1` Màn Teacher KPI hiển thị rõ tổng số tiền phạt (Penalty) nếu có, không để chìm trong số liệu phụ hoặc chỉ xuất hiện ở API/detail ẩn. `(sync authoritative 2026-04-11 B06 teacher-kpi penalty visibility browser)`
- [x] `P1` Bảng xem trước lương của giáo viên chia rõ thành 5 nhóm `Đã thanh toán`, `Chờ PH`, `Chờ OPS`, `Thiếu báo cáo`, `Hủy` để giáo viên tự tracking từng buổi và từng khoản. `(sync authoritative 2026-04-11 B06 payroll preview browser)`
- [x] `P1` Form Báo cáo giảng dạy render động đúng các trường theo Report Template đang áp dụng, ví dụ Từ vựng, Ngữ pháp, và lưu/validate đúng từng field động. `(sync authoritative 2026-04-11 B06 teaching-report dynamic fields browser)`
- [x] `P1` Lớp Offline có form `Bulk Teaching Report` để giáo viên điền/nộp hàng loạt cho nhiều học sinh hoặc nhiều dòng báo cáo mà không phải submit tay từng người. `(sync authoritative 2026-04-11 B06 bulk teaching report browser)`
- [x] `P1` Student progress của phụ huynh hiển thị đúng dữ liệu. `(sync evidence 2026-04-10 B06 browser authoritative)`
- [x] `P1` Phụ huynh đánh giá buổi học theo thang 1-5 sao hiển thị đúng control, trạng thái đã gửi và thông báo kết quả. `(sync evidence 2026-04-10 B06 browser authoritative)`
- [x] `P1` Form `general-feedback` hiển thị đầy đủ các trường `teachingQuality`, `communication`, `facility` và lưu đúng đánh giá tổng quát của phụ huynh/học sinh. `(sync authoritative 2026-04-11 B06 general-feedback browser)`
- [x] `P1` Rating thấp (1-2 sao) phản ánh rõ trên UI OPS hoặc các màn theo dõi/cảnh báo liên quan để người vận hành nhìn thấy ngay. `(sync authoritative 2026-04-11 B06 low-rating OPS browser)`
- [x] `P1` Parent invoices chỉ hiển thị invoice đúng phạm vi. `(sync automation 2026-04-08 follow-up UI)`
- [x] `P1` Teaching materials filter theo từ khóa, subject, grade, class, type, extraction status hoạt động đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teaching materials upload file bằng chọn file hoạt động đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teaching materials upload file bằng drag-drop hoạt động đúng. `(sync evidence 2026-04-10 B06 browser authoritative)`
- [x] `P1` Teaching materials download, reprocess, delete hoạt động đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teaching materials load more không duplicate dữ liệu. `(sync evidence 2026-04-10 B06 browser authoritative)`
- [x] `P1` Empty state và error state của kho tài liệu hiển thị đúng. `(sync evidence 2026-04-10 B06 browser authoritative)`

## Nhóm 7. Invoices, Wallets, Payroll, Finance Core

- [x] `P0` Tạo invoice mới với dữ liệu hợp lệ. `(sync authoritative 2026-04-11 B07 invoice create browser)`
- [x] `P0` Sửa invoice và phản ánh đúng trên bảng/list. `(sync authoritative 2026-04-11 B07 invoice edit browser)`
- [x] `P0` Approve invoice với ảnh chứng từ hoạt động đúng. `(sync evidence 2026-04-08)`
- [x] `P0` Reject invoice hoạt động đúng. `(sync authoritative 2026-04-11 B07 invoice-reject browser)`
- [x] `P0` Xóa invoice khi role cho phép. `(sync authoritative 2026-04-11 B07 invoice delete browser)`
- [x] `P0` Bảng hóa đơn chặn xóa invoice đã `APPROVED`; nút xóa bị ẩn/disable đúng hoặc hiển thị cảnh báo rõ nếu người dùng cố thao tác. `(sync evidence 2026-04-08)`
- Note 2026-04-12: backend e2e authoritative rerun `group11-state-machine.e2e-spec.ts` da PASS `17/17` sau khi harden bootstrap env va login setup; xem log [LOG_BA04_group11_state_machine_20260412.md](/C:/Users/PC/Documents/code/vuitran/runtime-logs/backend-api/2026-04-12/LOG_BA04_group11_state_machine_20260412.md).
- [x] `P0` Filter invoice theo keyword, parent, sale, class type, status, date range hoạt động đúng. `(sync authoritative 2026-04-11 B07 invoice-filters browser)`
- [x] `P0` Infinite scroll hoặc load batch trong invoice table không bị trùng hoặc mất dòng. `(sync authoritative 2026-04-11 B07 invoice-infinite-scroll browser)`
- [x] `P0` Top-up request ở wallets hiển thị đúng pending count. `(sync authoritative 2026-04-10 B07 wallet reject browser)`
- [x] `P0` Approve top-up cập nhật ví và ledger đúng. `(sync evidence 2026-04-08)`
- [x] `P0` Reject top-up cập nhật trạng thái đúng. `(sync authoritative 2026-04-10 B07 wallet reject browser)`
- [x] `P0` Transfer ví hoạt động đúng và validate đủ dữ liệu. `(sync authoritative 2026-04-11 B07 wallet transfer browser)`
- [x] `P0` Parent top-up với upload receipt hoạt động đúng. `(sync authoritative 2026-04-11 B07 parent top-up receipt browser)`
- [x] `P0` Ví có số dư thấp hiển thị cảnh báo đúng. `(sync verification 2026-04-08 final)`
- [x] `P0` Ledger của ví hiển thị đúng loại giao dịch và số tiền. `(sync authoritative 2026-04-11 B07 wallet ledger browser)`
- [x] `P0` Payroll giáo viên preview/generate/update/submit/approve/reject/reopen/mark paid/delete hoạt động đúng. `(sync authoritative 2026-04-11 B07 teacher-payroll browser)`
- [x] `P0` Payroll preview hiển thị rõ khoản phạt (Penalty) do nộp trễ báo cáo, không gộp mơ hồ vào tổng lương. `(sync authoritative 2026-04-11 B07 payroll-late-penalty browser)`
- [x] `P0` Payroll preview cho lớp Offline hiển thị rõ Min Payout Guarantee khi học sinh vắng nhiều, tách bạch với phần lương dạy thực tế và giải thích được lý do bảo chứng. `(sync authoritative 2026-04-11 B07 payroll-offline-min-payout-guarantee browser)`
- [x] `P0` Payroll trạng thái `HELD` hiển thị rõ lý do bằng badge hoặc label nổi bật như `PARENT_REJECTED`, `LATE_REPORT` thay vì chỉ hiện một trạng thái chung chung. `(sync authoritative 2026-04-11 B07 payroll-held-reason-labels browser)`
- [x] `P0` Exclude Payroll bắt buộc nhập lý do, hiển thị validation rõ nếu bỏ trống và phản ánh đúng trạng thái sau khi loại trừ. `(sync authoritative 2026-04-11 B07 exclude-payroll browser)`
 - [x] `P0` Staff payroll generate/edit/submit/approve/reject/reopen/mark paid/delete hoạt động đúng. `(sync authoritative 2026-04-11 B07 staff-payroll browser)`
- [x] `P0` Bulk generate payroll hoạt động đúng và tránh submit lặp. `(sync authoritative 2026-04-11 B07 bulk-payroll browser)`
- [x] `P0` Bulk Payroll partial success hiển thị rõ kết quả kiểu "Thành công 49, Lỗi 1" kèm danh sách người lỗi và nguyên nhân, thay vì chỉ báo lỗi chung chung cho toàn batch. `(sync authoritative 2026-04-11 B07 bulk-payroll partial-success browser)`
- Note 2026-04-12: backend e2e authoritative rerun `group13-bulk-agents.e2e-spec.ts` da PASS `18/18` sau khi co lap `MONGODB_URI` va cleanup root mongo bootstrap; xem log [LOG_BA04_group13_bulk_agents_20260412.md](/C:/Users/PC/Documents/code/vuitran/runtime-logs/backend-api/2026-04-12/LOG_BA04_group13_bulk_agents_20260412.md).
- [x] `P1` Salary config create/update/delete hoạt động đúng. `(sync authoritative 2026-04-11 B07 salary-config CRUD browser)`
- [x] `P0` UI không cho phép lùi trạng thái Payroll từ trạng thái cuối như `PAID` về `DRAFT`; action bị ẩn/disable đúng hoặc hiển thị lỗi rõ nếu cố thao tác sai luồng. `(sync evidence 2026-04-08)`
- Note 2026-04-12: backend state-machine rerun cho payroll reversal guardrails da PASS authoritative `17/17`; log [LOG_BA04_group11_state_machine_20260412.md](/C:/Users/PC/Documents/code/vuitran/runtime-logs/backend-api/2026-04-12/LOG_BA04_group11_state_machine_20260412.md).
- [x] `P1` Adjust Wallet bắt buộc nhập lý do, hiển thị validation rõ nếu bỏ trống và ghi nhận đúng lý do trên UI/ledger preview. `(sync authoritative 2026-04-11 B07 adjust-wallet required-reason browser)`
- [x] `P1` Rollback hoặc hủy hóa đơn đã duyệt hiển thị cảnh báo rõ khi thao tác có thể làm ví phụ huynh âm hoặc phát sinh chênh lệch số dư. `(sync authoritative 2026-04-11 B07 finance rollback constraints browser)`
- [x] `P1` Work sessions filter, summary, edit hoạt động đúng. `(sync authoritative 2026-04-11 B07 work-sessions browser)`
- [x] `P1` Màn Work Sessions hiển thị rõ trạng thái `AUTO_CLOSED` khi hệ thống tự đóng ca do giáo viên quên check-out, kèm badge hoặc ghi chú để giáo viên nhận biết vi phạm. `(sync authoritative 2026-04-11 B07 work-sessions AUTO_CLOSED browser)`
- [x] `P1` Work Sessions hiển thị badge/màu đỏ nổi bật khi giáo viên đi muộn (Late) hoặc về sớm (Early leave) so với `scheduledStartTime` và giờ kết thúc dự kiến. `(sync authoritative 2026-04-11 B07 work-sessions late/early leave browser)`
- [x] `P1` Commission report hiển thị đúng theo role và dữ liệu. `(sync authoritative 2026-04-11 B07 commission-report browser)`
- [x] `P1` Aging report filter và bucket label hiển thị đúng. `(sync evidence 2026-04-10 B08 browser authoritative)`

## Nhóm 8. Finance Nâng Cao: Expenses, Supplier, Loans, Financial Control, Bank Reconciliation

- [x] `P0` Expenses create/edit/approve/reject/mark paid hoạt động đúng. `(sync authoritative 2026-04-11 B08 expenses browser)`
- [x] `P0` Expenses phân quyền đúng giữa người tạo, người duyệt và người thanh toán. `(sync authoritative 2026-04-11 B08 expenses browser)`
- [x] `P0` Supplier quotes create/edit/send/accept/reject/delete hoạt động đúng. `(sync authoritative 2026-04-11 B08 supplier-quotes browser)`
- [x] `P0` Supplier payments create/edit/approve/reject/mark paid/delete hoạt động đúng. `(sync authoritative 2026-04-11 B08 supplier-payments browser)`
- Note 2026-04-12: backend regression slice cho agent tiers va supplier procurement trong `group13-bulk-agents.e2e-spec.ts` da PASS authoritative `18/18`; log [LOG_BA04_group13_bulk_agents_20260412.md](/C:/Users/PC/Documents/code/vuitran/runtime-logs/backend-api/2026-04-12/LOG_BA04_group13_bulk_agents_20260412.md).
- [x] `P0` Loans create/activate/record payment/update overdue hoạt động đúng. `(sync authoritative 2026-04-11 B08 loans browser)`
- [x] `P0` Financial control theo tab ngân hàng/quỹ/cashflow/PnL/provisional gross profit hoạt động đúng. `(sync authoritative 2026-04-11 B08 financial-control tabs browser)`
- [x] `P0` Financial Alerts hiển thị đúng severity theo màu: `CRITICAL` màu đỏ, `WARNING` màu cam, và các action đính kèm như `Nạp quỹ`, `Xem chi tiết` điều hướng đúng màn hoặc mở đúng ngữ cảnh xử lý. `(sync authoritative 2026-04-11 B08 financial-alerts browser)`
- [x] `P0` Tab P&L cho phép toggle giữa 2 basis `CASH` và `ACCRUAL`, số liệu và label thay đổi đúng theo chuẩn kế toán được chọn. `(sync authoritative 2026-04-10 B08 PnL-basis orchestrator)`
- [x] `P0` Tạo bank account, fund, bank transaction, fund transaction hoạt động đúng. `(sync authoritative 2026-04-11 B08 financial-control create browser)`
- [x] `P0` Surface sửa `bank account` / `fund` và update flow tương ứng được proof trên UI `financial-control` hiện tại. `(sync authoritative 2026-04-11 B08 financial-control edit bank/fund browser)`
- [x] `P0` Reconcile transaction cập nhật đúng trạng thái và báo cáo. `(sync authoritative 2026-04-11 B08 financial-control reconcile browser)`
- [x] `P0` Bank reconciliation chạy được và phản ánh đúng kết quả. `(sync authoritative 2026-04-11 B08 reconciliation-filters orchestrator)`
- [x] `P0` Màn Bank Reconciliation bóc tách rõ danh sách giao dịch `Matched` và `Unmatched`, hiển thị đúng count/amount và không trộn lẫn hai nhóm. `(sync authoritative 2026-04-11 B08 reconciliation-filters orchestrator)`
- [x] `P0` Kế toán từ chối đối soát (Reject Reconciliation) cập nhật đúng trạng thái, lý do từ chối và danh sách giao dịch/chênh lệch còn cần xử lý. `(sync authoritative 2026-04-11 B08 reconciliation-reject browser)`
- [x] `P1` Chuyển tab tài chính không làm stale dữ liệu hoặc vỡ state form. `(sync authoritative 2026-04-11 B08 financial-control tab-switch browser)`
- [x] `P1` Các side effect tài chính giữa invoice, wallet, payroll, expense, supplier payment được phản ánh đúng trên UI. `(sync aggregate authoritative 2026-04-11 B07/B08 browser bundle)`

## Nhóm 9. Notifications, Messages, Chatbot, Tickets

- [x] `P0` Notifications load đúng danh sách và unread count. `(sync evidence 2026-04-08)`
- [x] `P0` Click notification chưa đọc sẽ mark read và điều hướng đúng link. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Mark all notifications as read hoạt động đúng. `(sync evidence 2026-04-08)`
- [x] `P0` Admin/OPS gửi thông báo hàng loạt hoạt động đúng, có chọn đúng nhóm nhận, preview nội dung, confirm gửi và phản ánh đúng kết quả thành công/thất bại. `(sync authoritative 2026-04-11 B09 bulk notifications browser)`
- [x] `P1` Filter all/unread và phân trang notifications hoạt động đúng. `(sync evidence 2026-04-08 B09 follow-up)`
- [x] `P1` Polling unread count không làm lệch badge hoặc nhân bản dữ liệu. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P1` Internal messages load conversation đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P1` Chọn conversation, load message, mark read hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P1` Tạo conversation mới và gửi tin nhắn trực tiếp hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Conversations chatbot filter theo keyword, status, fanpage hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Chọn conversation load message đúng và auto scroll đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Takeover, release, close conversation hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Chỉ cho gửi tin khi conversation ở `HUMAN_HANDLING`. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Realtime nhận message mới qua websocket hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Realtime update conversation list khi có event mới hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Tạo lead từ conversation chatbot hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Tạo order từ conversation chatbot hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Màn `chatbot-settings` tải đúng các section Fanpages, OpenAI Tokens, AI Assistant Profiles theo role phù hợp. `(sync evidence 2026-04-08)`
- [x] `P0` CRUD fanpage trong `chatbot-settings` hoạt động đúng, có loading và thông báo lỗi/thành công rõ ràng. `(sync evidence 2026-04-08 B09 follow-up)`
- [x] `P0` API/Page token của Fanpage trong `chatbot-settings` hiển thị dạng masked (`••••••`) ở list/detail, không lộ full token nếu chưa có action xem rõ được cấp quyền. `(sync evidence 2026-04-08 B09 follow-up)`
- [x] `P0` CRUD OpenAI token trong `chatbot-settings` hoạt động đúng, token nhạy cảm không bị lộ sai trên UI. `(sync evidence 2026-04-08 B09 follow-up)`
- [x] `P0` Form cấu hình AI trong `chatbot-settings` lưu và validate đúng các field `System Prompt`, `Temperature`, `Max Tokens`, phản ánh lại đúng giá trị sau reload. `(sync evidence 2026-04-08)`
- [x] `P1` CRUD AI assistant profile trong `chatbot-settings` hoạt động đúng và phản ánh đúng loại assistant đang chọn. `(sync evidence 2026-04-08 B09 follow-up)`
- [x] `P1` Toggle auto-reply / trạng thái AI trong `chatbot-settings` cập nhật đúng badge, disabled state và thông báo lỗi. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Khi OpenAI token hết hạn, UI hiển thị banner cảnh báo đỏ hoặc trạng thái lỗi rõ ràng ở `chatbot-settings` hoặc dashboard liên quan. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Parent support chat chọn học sinh/người hỗ trợ và tạo ngữ cảnh đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Parent support chat gửi tin, quick actions, start fresh hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Màn chat hỗ trợ chỉ hiển thị nút "Gợi ý AI" hoặc Auto-suggest cho agent xem trước nội dung, không tự động gửi thẳng câu trả lời AI ra hội thoại. `(sync authoritative 2026-04-11 B09 AI suggest preview-only browser)`
- [x] `P0` Ticket handoff banner và link sang ticket hiển thị đúng trong parent support chat. `(sync evidence 2026-04-08)`
- [x] `P0` Tickets create/view detail/comment/resolve/reopen/cancel hoạt động đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Tickets phân tab `my`, `assigned`, `all` theo role đúng. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Deep-link ticket qua query param mở đúng ticket. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P0` Khi đóng ticket `REFUND_REQUEST`, UI cảnh báo rõ nếu Kế toán chưa tạo LedgerEntry giao dịch ví để liên kết với ticket hoàn tiền đó. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P1` Open source conversation từ ticket hoạt động đúng nếu có liên kết. `(sync evidence 2026-04-10 B09 browser authoritative)`
- [x] `P1` Update priority ticket hoạt động đúng. `(sync evidence 2026-04-08 B09 follow-up)`

## Nhóm 10. Ads, Landing Pages, Public Flows

- [x] `P0` Ads management theo tab account/group/token/cost hoạt động đúng. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P1` Tab `Việc cần làm` hoặc `Actionable tasks` trong Ads Management tải đúng danh sách ưu tiên hành động, severity/badge và link điều hướng liên quan. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` CRUD account, group, token, cost hoạt động đúng. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` Sync token, trigger sync, backfill chức năng hoạt động đúng và có thông báo kết quả. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P1` Ads analytics load số liệu, đổi tab, sort, filter đúng. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P1` Quyền xem suggestion/actions required đúng theo role. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` Landing pages management create/edit/delete trang hoạt động đúng. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` Copy public URL hoạt động đúng, có fallback khi clipboard fail. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` Public landing page load đúng theo slug. `(sync evidence 2026-04-08)`
- [x] `P0` Public landing page với slug sai hiển thị lỗi đúng. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` Submit form public landing page thành công và hiển thị success state. `(sync evidence 2026-04-08)`
- [x] `P0` Submit form public landing page lỗi hiển thị đúng submit error. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` UTM/tracking payload được thu thập đúng trước khi submit. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P0` Inject Meta Pixel / Google Tag / TikTok Pixel không bị lặp khi vào ra trang. `(sync evidence 2026-04-10 B10 browser authoritative)`
- [x] `P1` Bấm "Trigger Sync" hoặc "Backfill" ở màn Ads Management hiển thị trạng thái loading và feedback kết quả success/error rõ ràng theo contract hiện tại (`result modal` hoặc `alert`). `(sync reconcile 2026-04-10 tu B10 same-day browser evidence)`
- [x] `P1` Custom head/body HTML được inject đúng và được dọn khi destroy component. `(sync evidence 2026-04-10 B10 browser authoritative)`

## Nhóm 11. Reports, Export, Audit

- [x] `P1` Attendance report filter theo lớp/ngày và phân trang đúng. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Student report filter và preview ảnh đúng. `(sync authoritative 2026-04-10 Wave 4)`
- [x] `P1` Comprehensive report filter theo class, sale, data status, search đúng. `(sync authoritative 2026-04-10 Wave 4)`
- [x] `P1` Teaching report pending/completed, filter tháng, teacher code lookup, submit/edit đúng. `(sync automation 2026-04-08 follow-up UI)`
- [x] `P1` Teaching Report hỗ trợ inline update mượt mà ngay trên ô bảng và chặn chặt quyền sửa nhanh đối với `PARENT` và `SALE`. `(sync evidence 2026-04-10 B11 browser authoritative)`
- [x] `P1` Employee performance load dashboard, filter và xem chi tiết hiệu suất đúng. `(sync evidence 2026-04-10 B11 browser authoritative)`
- [x] `P1` Employee performance không lộ dữ liệu hoặc action sai role khi truy cập trực tiếp bằng URL. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Export reports tải file đúng loại báo cáo. `(sync evidence 2026-04-08)`
- [x] `P1` File CSV export dùng chuẩn encoding UTF-8 BOM để mở bằng Excel không bị lỗi font tiếng Việt hoặc vỡ dấu. `(sync authoritative 2026-04-10 Wave 4)`
- [x] `P1` Với streaming export cỡ lớn 50,000+ dòng, UI giữ loading/progress an toàn tới khi tải xong, không rơi vào lỗi 504 giả trên frontend và không làm treo trình duyệt. `(sync authoritative 2026-04-10 Wave 4)`
- [x] `P1` Khi role `SHAREHOLDER` tải export/report, dữ liệu nhạy cảm như SĐT phụ huynh phải được masked hoặc ẩn danh đúng trên file tải về. `(sync authoritative 2026-04-11 B11 shareholder-masked export browser)`
- [x] `P1` Audit log filter, pagination, thống kê hiển thị đúng. `(sync automation 2026-04-08 follow-up UI)`
- [x] `P1` Audit log chỉ đọc, không có hành vi sửa dữ liệu. `(sync automation 2026-04-08 follow-up UI)`

## Nhóm 12. Trạng Thái Chung Cần Test Ở Mọi Màn Hình

- [x] `P0` Loading state hiển thị rõ và không cho thao tác gây submit lặp. `(sync authoritative 2026-04-10 NHOM12 loading-state browser)`
- [x] `P0` Empty state hiển thị đúng khi không có dữ liệu. `(sync evidence 2026-04-10 cross-surface authoritative)`
- [x] `P0` Dashboard của user mới tinh như Sale chưa có số liệu hoặc Phụ huynh chưa có con hiển thị empty state thân thiện, có hướng dẫn/CTA phù hợp thay vì dashboard lỗi, toàn số `0đ` hoặc biểu đồ trống gây hiểu nhầm. `(sync authoritative 2026-04-10 NHOM12 dashboard-empty-state browser)`
- [x] `P0` Error state hiển thị rõ khi API lỗi. `(sync evidence 2026-04-10 cross-surface authoritative)`
- [x] `P0` Các modal mở/đóng nhiều lần không giữ state bẩn ngoài ý muốn. `(sync authoritative 2026-04-10 NHOM12 modal dirty-state browser)`
- [x] `P0` Form validation cho field bắt buộc, sai format, thiếu dữ liệu. `(sync reconcile 2026-04-10 tu B03 face-upload + B06 bankInfo + B09 chatbot/ticket same-day browser evidence)`
- [x] `P1` Widget `Flow Guide` hoặc `Mô tả luồng` mở/đóng đúng trên các màn có nhúng, render đúng tiêu đề, mô tả, checklist và không làm vỡ layout khi thu gọn/mở rộng. `(sync authoritative 2026-04-10 NHOM12 flow-guide browser)`
- [x] `P1` Khi backend trả `429 Too Many Requests`, UI hiển thị thông báo thân thiện kiểu "Bạn thao tác quá nhanh" hoặc tương đương, không quăng lỗi server chung chung khó hiểu. `(sync evidence 2026-04-10 Nhom12 browser authoritative)`
- [x] `P0` Nút submit bị disable trong lúc đang xử lý. `(sync evidence 2026-04-10 cross-surface authoritative)`
- [x] `P0` Double click không tạo dữ liệu trùng hoặc chuyển trạng thái hai lần. `(sync authoritative 2026-04-10 NHOM12 double-click guard browser)`
- [x] `P0` Refresh trang ở màn hình đang xem không làm lỗi state cơ bản. `(sync authoritative 2026-04-10 NHOM12 refresh-state browser)`
- [x] `P0` Nút "Tạo khoản vay" bị ẩn đối với `ACCOUNTING`, chỉ role phù hợp mới thấy CTA tạo mới. `(sync evidence 2026-04-10 Nhom12 browser authoritative)`
- [x] `P0` Role `OPS` không được thấy nút `Chuyển ví` hoặc action transfer wallet ở mọi màn ví liên quan; UI phải ẩn hoàn toàn thay vì chỉ chặn khi bấm. `(sync evidence 2026-04-10 Nhom12 browser authoritative)`
- [x] `P0` Nút/chức năng "Finalize" ở Session bị ẩn đối với `TEACHER`, không để lộ action sai quyền trên UI. `(sync evidence 2026-04-10 Nhom12 browser authoritative)`
- [x] `P0` Cột Actions ở Invoices không hiển thị nút "Xóa" cho `ACCOUNTING`, `SALE`, `OPS` nếu không có quyền xóa. `(sync evidence 2026-04-10 Nhom12 browser authoritative)`
- [x] `P0` Role `ACCOUNTING` được xem màn Lớp/Học sinh để đối soát nhưng UI phải ẩn toàn bộ nút `Sửa`/`Xóa` hoặc action thay đổi dữ liệu trên các màn này. `(sync authoritative 2026-04-10 NHOM12 accounting classes+students readonly browser)`
- [x] `P0` Màn `financial-control`, `aging-report`, `investor-dashboard` ở mode `SHAREHOLDER` hiển thị read-only, không lộ nút Sửa/Xóa/Approve. `(sync evidence 2026-04-10 Nhom12 browser authoritative)`
- [x] `P1` Search/filter/sort/pagination reset state đúng khi đổi điều kiện lọc. `(sync evidence 2026-04-10 cross-surface authoritative)`
- [x] `P1` Scroll dài, bảng lớn, load thêm dữ liệu không bị nhảy layout bất thường. `(sync authoritative 2026-04-10 NHOM12 scroll-layout browser)`
- [x] `P1` Upload file sai loại hoặc lỗi mạng hiển thị thông báo đúng. `(sync reconcile 2026-04-10 tu B03 face-upload failure same-day browser evidence)`
- [x] `P1` Ảnh preview/file preview không bị vỡ UI. `(sync reconcile 2026-04-10 tu B03 face-upload preview + B11 student-report preview modal same-day browser evidence)`
- [x] `P1` Realtime hoặc polling không tạo duplicate item trên UI. `(sync evidence 2026-04-10 cross-cutting browser authoritative)`
- [x] `P1` Dữ liệu format ngày giờ, tiền tệ theo `vi-VN` hiển thị nhất quán. `(sync authoritative 2026-04-10 NHOM12 vi-VN-format browser)`
- [x] `P1` Responsive trên desktop hẹp, tablet và mobile không vỡ bố cục quan trọng. `(sync authoritative 2026-04-10 NHOM12 responsive browser)`
- [x] `P1` Deep-link bằng URL/query param mở đúng màn hình và đúng trạng thái. `(sync reconcile 2026-04-10 tu B09 notifications/tickets + B10 public landing same-day browser evidence)`
- [x] `P2` Kiểm tra behavior khi mở nhiều tab cùng lúc và trạng thái thay đổi ở tab khác. `(sync authoritative 2026-04-10 NHOM12 multi-tab browser)`
- [x] `P2` Kiểm tra accessibility cơ bản: focus, keyboard navigation, label form, contrast ở màn hình chính. `(sync authoritative 2026-04-10 NHOM12 accessibility browser)`
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

## Ghi Chú Regression 2026-04-07

- Automation regression lịch sử ngày `2026-04-07` đã pass cho luồng `orders -> approve -> comprehensive report -> attendance report`; xem log [LOG_Orders_Report_Metrics_Automation_20260407.md](/C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-07/logs/LOG_Orders_Report_Metrics_Automation_20260407.md).
- Authoritative rerun same-day ngày `2026-04-11` đã refresh luồng này bằng browser proof trên current tree; xem log [LOG_ORDER_REPORT_ATTENDANCE_REGRESSION_BROWSER_20260411.md](/C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_ORDER_REPORT_ATTENDANCE_REGRESSION_BROWSER_20260411.md) va log chi tiet [LOG_ORDERS_REPORT_METRICS_UI_BROWSER_20260411.md](/C:/Users/PC/Documents/code/vuitran/frontend-ui-evidence/2026-04-11/logs/LOG_ORDERS_REPORT_METRICS_UI_BROWSER_20260411.md).
- Coverage đã xác nhận được:
  - Order tính đúng `Giá tiền khóa học`, `Số tiền hóa đơn`, `Số buổi KH`, `Số buổi HĐ`, `bonus`, `trial`, `discount`.
  - Pipeline tong cua order sau approve da duoc browser-proof lai qua linked views, comprehensive report va attendance report tren current tree.
  - Comprehensive report hiển thị đúng `invoiceNumber`, `totalSessions`, `sessionsCompleted`, `attendedCount`, `absentCount`, và các cột buổi đầu tiên.
  - Attendance report lọc đúng theo lớp/ngày, chỉ tính các trạng thái được counted (`PRESENT`, `LATE`), giữ đúng cột `totalPurchasedSessions`, va da duoc rerun lai ca pagination + preview anh.
- Các phần trước đây từng ghi là `chưa đủ để đánh dấu hoàn tất` đã có browser proof riêng trong checklist hiện tại; block này chỉ còn mang giá trị lịch sử cho batch automation `2026-04-07`.

## Đồng bộ unit drift 2026-04-12

- Ghi nhận rerun authoritative cho `bulk-agent-class-components.component.spec.ts`; target hiện đã PASS sau khi sync oracle drift tiếng Việt/mojibake và format currency `₫` theo contract hiện tại. `(LOG_B14_bulk_agent_class_unit_20260412)`

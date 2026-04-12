# TÀI LIỆU KỊCH BẢN KIỂM THỬ HỆ THỐNG QUẢN LÝ TRUNG TÂM GIÁO DỤC
**Phiên bản:** 2.0 — Cập nhật 03/04/2026
**Mục đích:** Tài liệu này dành cho Coder (viết automated test) và Tester (thực hiện manual test) triển khai kiểm thử toàn diện hệ thống.
**Quy ước đọc:**
- **Preconditions**: Dữ liệu bắt buộc phải có TRƯỚC khi chạy test.
- **Steps**: Thao tác cụ thể (API call hoặc UI action) theo thứ tự.
- **Assertions**: Điều kiện PHẢI ĐÚNG sau khi chạy. Nếu sai = BUG.
- **Edge Cases**: Các biến thể cần test thêm trong cùng kịch bản.

---

# PHẦN I: DÒNG TIỀN VÀ TÀI CHÍNH CỐT LÕI (NHÓM 1–10)

________________________________________
## NHÓM 1: DÒNG TIỀN VÀO (CASH INFLOW) — ORDERS & INVOICES
Nhóm này kiểm thử việc ghi nhận "Tiền mặt thực thu" (Cash) nhưng CHƯA ghi nhận "Doanh thu kế toán" (Accrual Revenue) vì học sinh chưa học.

### 1.1. Duyệt Đơn hàng chuẩn (Standard Order Approval)
- **Preconditions:** PH Nguyễn Văn A có Wallet balance = 0đ. Sale tạo Order gói 10 buổi x 200k = 2,000,000đ. Phương thức: Chuyển khoản. Sale đã upload receiptImage.
- **Steps:**
  1. Sale POST /orders với totalAmount=2000000, paymentMethod=TRANSFER, receiptImage=base64png.
  2. Director GET /orders?status=PENDING → thấy đơn.
  3. Director PATCH /orders/:id/approve.
- **Assertions:**
  - HTTP 200. Order.status = APPROVED.
  - Wallet: LedgerEntry type=TOP_UP, amount=2000000. Balance ví PH = 2,000,000đ.
  - Invoice tự động sinh ra với status=APPROVED, amount=2000000.
  - Financial Control: GET /financial-control/overview → totalInflow tăng 2tr.
  - P&L: sessionRevenue KHÔNG tăng (chưa học).
  - Dashboard Cổ đông: Tiền mặt tồn quỹ tăng 2tr.
- **Edge Cases:**
  - Order không có receiptImage nhưng paymentMethod=TRANSFER → API trả 400 "Cần có chứng từ".
  - Order paymentMethod=CASH → không cần receiptImage, vẫn approve được.
  - finalAmount khác totalAmount khi có discount → ví chỉ cộng finalAmount.

### 1.2. Đơn trả góp (Installment Order)
- **Preconditions:** Order 3,000,000đ chia 3 kỳ (Invoice 1: 1tr, Invoice 2: 1tr, Invoice 3: 1tr). Order đã APPROVED.
- **Steps:**
  1. Kế toán PATCH /invoices/:invoice1Id/approve (kèm receiptImage).
  2. Kiểm tra ví PH.
  3. Kế toán CHƯA duyệt Invoice 2, 3.
- **Assertions:**
  - Wallet: Balance tăng đúng 1,000,000đ (chỉ Invoice 1).
  - Invoice 2, 3 vẫn ở status=PENDING.
  - Financial Control: totalInflow = 1tr (không phải 3tr).
  - Dashboard: Deferred Revenue hiển thị 2tr còn lại chưa thu.
- **Edge Cases:**
  - Duyệt Invoice 2 trước Invoice 1 → hệ thống cho phép (không bắt buộc thứ tự).
  - Cancel Invoice 2 sau khi Invoice 1 đã APPROVED → không ảnh hưởng ví.

### 1.3. Áp dụng Discount
- **Preconditions:** Sale tạo Order totalAmount=2,000,000đ, discountAmount=200,000đ → finalAmount=1,800,000đ.
- **Steps:**
  1. Director approve Order.
- **Assertions:**
  - Wallet: TOP_UP amount = 1,800,000đ (không phải 2tr).
  - Financial Control: Inflow ghi nhận 1,800,000đ.
  - Order record: discountAmount=200000, finalAmount=1800000.
- **Edge Cases:**
  - discountAmount > totalAmount → API trả 400.
  - discountAmount = totalAmount (100% discount) → xử lý như Zero Amount (1.4).
  - discountAmount = 0 → finalAmount = totalAmount.

### 1.4. Đơn học thử miễn phí (Zero Amount / Trial)
- **Preconditions:** Sale tạo Order type=TRIAL, totalAmount=0.
- **Steps:**
  1. Director approve (không cần receiptImage vì amount=0).
- **Assertions:**
  - Wallet: Balance không đổi (TOP_UP amount=0 hoặc không sinh TOP_UP).
  - Financial Control: Inflow không tăng.
  - Dashboard: Chỉ số Trial count tăng 1, Revenue = 0.
  - Enrollment: HS được tạo, Class được gán, Sessions trial được sinh.

### 1.5. ĐƠN BỊ TỪ CHỐI (Order Rejected) ← MỚI
- **Preconditions:** Sale tạo Order 2,000,000đ. Director thấy chứng từ không hợp lệ.
- **Steps:**
  1. Director PATCH /orders/:id/reject với reason="Biên lai giả".
- **Assertions:**
  - Order.status = REJECTED.
  - Wallet: Balance = 0đ. KHÔNG có LedgerEntry TOP_UP.
  - Invoice: KHÔNG được tạo.
  - Financial Control: Inflow KHÔNG tăng.
  - AuditLog có ghi nhận: who=Director, action=REJECT, reason="Biên lai giả".

### 1.6. ĐƠN THANH TOÁN MỘT PHẦN (Partial Payment) ← MỚI
- **Preconditions:** Order 2,000,000đ. PH chỉ chuyển 1,500,000đ.
- **Steps:**
  1. Sale tạo Order với totalAmount=2000000.
  2. Director approve nhưng Invoice ghi nhận paidAmount=1500000.
- **Assertions:**
  - Wallet: TOP_UP = 1,500,000đ.
  - Order: Trạng thái PARTIALLY_PAID hoặc có ghi nhận outstandingBalance=500000.
  - Dashboard: Accounts Receivable tăng 500k.

________________________________________
## NHÓM 2: GHI NHẬN DOANH THU & GIÁ VỐN (REVENUE & COGS) — SESSIONS
Nhóm này cực kỳ quan trọng vì nó chuyển tiền từ "Ví" sang "Doanh thu thực tế" (Accrual) và phát sinh "Công nợ lương giáo viên" (COGS).

### 2.1. Chốt buổi học chuẩn (Standard Session Finalization)
- **Preconditions:** HS Trần Văn B đã enroll lớp 1-1 Online, giá 200k/60p. Wallet balance = 2,000,000đ. GV Lê Thị C dạy, lương 120k/buổi. Session ngày hôm qua status=SCHEDULED.
- **Steps:**
  1. GV đánh dấu HS = PRESENT (POST /attendance).
  2. GV nộp Teaching Report (POST /teaching-reports) trong vòng 24h.
  3. OPS chốt buổi học (PATCH /sessions/:id/finalize).
- **Assertions:**
  - Session.status = FINALIZED.
  - Wallet: LedgerEntry type=SESSION_DEDUCT, amount=200000. Balance = 1,800,000đ.
  - PayrollTransaction: Sinh ra 1 bản ghi, teacherPay=120000, status=PENDING.
  - Financial Control: sessionRevenue += 200k, teacherCost += 120k.
  - Dashboard: Gross Margin = (200k - 120k) / 200k = 40%. Net Profit tăng 80k.
- **Edge Cases:**
  - GV nộp report trước khi OPS finalize → vẫn hợp lệ.
  - OPS finalize trước khi GV nộp report → hệ thống cho phép nhưng GV bị ghi nhận "chưa nộp".

### 2.2. Đổi thời lượng buổi học (Duration Change)
- **Preconditions:** Lớp cấu hình 60p, giá 200k/60p. PH yêu cầu đổi buổi mai lên 90p.
- **Steps:**
  1. OPS PATCH /sessions/:id duration=90.
  2. GV điểm danh + nộp report. OPS finalize.
- **Assertions:**
  - Wallet: amountCharged = 200000 / 60 * 90 = 300,000đ.
  - PayrollTransaction: teacherPay tính pro-rated theo 90p.
  - P&L: Doanh thu buổi = 300k (không phải 200k). Chi phí GV tăng tương ứng.
- **Edge Cases:**
  - Đổi từ 90p xuống 60p → amountCharged giảm, HS "lời" buổi.
  - Đổi thời lượng sau khi đã finalize → API trả 400 (không cho sửa).

### 2.3. Lớp Offline vắng nhiều học sinh (Offline Low Attendance)
- **Preconditions:** Lớp Offline 5 HS, giá 150k/HS/buổi. GV lương min guarantee = 200k/buổi. Chỉ 1 HS đi học.
- **Steps:**
  1. GV điểm danh: 1 PRESENT, 4 ABSENT.
  2. GV nộp report. OPS finalize.
- **Assertions:**
  - Wallet: Chỉ HS đi học bị trừ 150k. 4 HS vắng: balance không đổi.
  - PayrollTransaction: teacherPay = MAX(150k * 1, 200k) = 200k (min guarantee).
  - P&L: Revenue = 150k, COGS = 200k → Loss = -50k.
  - Dashboard: Unit Economics đỏ. Lớp này báo lỗ.
- **Edge Cases:**
  - 0 HS đi học → Revenue = 0, teacherPay = 200k (min), Loss = -200k.
  - 5 HS đi học → Revenue = 750k, teacherPay = MAX(750k total, 200k) phụ thuộc cấu hình.

### 2.4. Khách hàng hết tiền trong ví (Zero Balance Deduction)
- **Preconditions:** HS đã enroll, Wallet balance = 0đ. Session được finalize.
- **Steps:**
  1. OPS finalize session bình thường.
- **Assertions:**
  - Session: isPaid = false, walletDeductError ghi nhận lý do.
  - Wallet: Balance = 0đ (KHÔNG bị âm).
  - PayrollTransaction: Vẫn sinh lương GV (GV vẫn dạy).
  - Notification: LOW_BALANCE_ALERT gửi cho Sale phụ trách + OPS.
  - Dashboard: Bad Debt tăng, cảnh báo cho Cổ đông.
- **Edge Cases:**
  - Wallet balance = 50k nhưng amountCharged = 200k → trừ 50k hay 0? → Kiểm tra cơ chế debt tolerance.
  - Sau khi PH nạp thêm tiền → hệ thống tự động settle buổi isPaid=false.

### 2.5. AUTO-CONFIRM SESSION CŨ (Cron tự chốt) ← MỚI
- **Preconditions:** Session đã TAUGHT 48h trước. GV đã nộp report. PH không phản hồi.
- **Steps:**
  1. Cron chạy mỗi 1h quét sessions quá hạn.
- **Assertions:**
  - Session tự chuyển PARENT_CONFIRMED → cho phép Finalize.
  - PH không cần thao tác gì.
  - Wallet bị trừ tiền khi OPS finalize sau đó.

### 2.6. GV NỘP BÁO CÁO SAI SESSION ← MỚI
- **Preconditions:** GV có 2 sessions cùng ngày: Session A (HS X) và Session B (HS Y).
- **Steps:**
  1. GV POST /teaching-reports với sessionId = Session A nhưng nội dung dành cho HS Y.
- **Assertions:**
  - Hệ thống KHÔNG chặn nội dung (nội dung do GV tự quyết). Nhưng:
  - Report gắn đúng sessionId = A, studentId = X.
  - Nếu GV gửi report cho Session B sau đó → cho phép (mỗi session 1 report).
________________________________________
## NHÓM 3: CHẾ TÀI & KHỦNG HOẢNG (PENALTIES & CRISIS)
Kiểm thử cơ chế bảo vệ dòng tiền tự động của hệ thống khi có sự cố chất lượng.

### 3.1. Phụ huynh đánh giá 1 sao (Parent Dissatisfaction)
- **Preconditions:** Session đã TAUGHT. GV đã nộp report. PH mở app đánh giá.
- **Steps:**
  1. PH PATCH /sessions/:id/feedback với isSatisfied=false, rating=1.
- **Assertions:**
  - Session: parentSatisfied = false.
  - Wallet: KHÔNG trừ tiền (chặn SESSION_DEDUCT). Balance PH giữ nguyên.
  - PayrollTransaction: Status chuyển sang HELD (lương bị giam).
  - Notification: Tự động tạo Ticket loại COMPLAINT cho OPS.
  - Dashboard: Tỷ lệ khách hàng không hài lòng tăng.
- **Edge Cases:**
  - PH đổi ý từ 1 sao lên 5 sao → hệ thống release HELD? Kiểm tra flow.
  - PH đánh giá 3 sao (trung bình) → KHÔNG trigger chặn tiền (chỉ 1-2 sao mới chặn).

### 3.2. GV nộp báo cáo trễ (Late Report Penalty)
- **Preconditions:** Session kết thúc lúc 15:00 ngày 01/04. GV phải nộp report trước 15:00 ngày 02/04 (24h).
- **Steps:**
  1. GV nộp report lúc 18:00 ngày 02/04 (trễ 3h).
  2. OPS finalize session.
- **Assertions:**
  - PayrollTransaction: lateHours = 3. penaltyAmount > 0 (tính theo công thức).
  - teacherPay = basePay - penaltyAmount.
  - Wallet PH: Vẫn bị trừ bình thường (chất lượng buổi học không đổi với PH).
  - P&L: teacherCost giảm → Net Margin tăng.
- **Edge Cases:**
  - Trễ 1h vs 24h vs 48h → penaltyAmount tăng dần theo bậc (kiểm tra công thức cụ thể).
  - GV nộp trễ 5 phút → có bị penalty không? Xác nhận grace period.
  - GV khiếu nại penalty sai → OPS có quyền override lateHours? Kiểm tra API.

### 3.3. OPS Hủy buổi học (Cancel Session)
- **Preconditions:** Session status = SCHEDULED hoặc TAUGHT. GV vắng hoặc sự cố.
- **Steps:**
  1. OPS PATCH /sessions/:id/cancel với reason="GV bận đột xuất".
- **Assertions:**
  - Session.status = CANCELLED.
  - Wallet: Nếu chưa trừ tiền → Balance không đổi. Nếu đã trừ (isPaid=true) → tạo REFUND, balance cộng lại.
  - PayrollTransaction: Không sinh hoặc status = CANCELLED. teacherPay = 0.
  - P&L: Revenue = 0, COGS = 0 cho buổi này.
  - Dashboard: Lost Revenue tăng (cơ hội doanh thu mất).
- **Edge Cases:**
  - Cancel session đã FINALIZED → có cho phép không? Expect: chỉ cho phép nếu kèm REFUND flow.
  - Cancel hàng loạt (GV nghỉ 1 tuần) → batch cancel + thông báo PH.

### 3.4. Kế toán loại trừ lương (Exclude Payroll)
- **Preconditions:** Sau khiếu nại (3.1), Kế toán điều tra xong.
- **Steps:**
  1. Kế toán PATCH /payroll-transactions/:id/exclude với reason="GV dạy không đạt chất lượng".
- **Assertions:**
  - PayrollTransaction.status = EXCLUDED. teacherPay hiệu lực = 0.
  - P&L: teacherCost giảm → Gross Margin tăng.
  - AuditLog: Ghi reason, who, timestamp.
  - Wallet PH: Không đổi (tiền PH đã được bảo toàn từ 3.1).
- **Edge Cases:**
  - Exclude PayrollTx đã ở status=PAID (đã chuyển khoản cho GV) → API trả 400 "Không thể exclude lương đã chi".
  - Exclude rồi muốn include lại → có API reverse không?

### 3.5. GV BỊ PHẠT NHIỀU BUỔI LIÊN TIẾP ← MỚI
- **Preconditions:** GV X nộp trễ 3 buổi liên tiếp trong tuần.
- **Steps:**
  1. Finalize 3 sessions, mỗi session GV đều nộp trễ.
- **Assertions:**
  - 3 PayrollTransactions đều có penaltyAmount > 0.
  - Tổng penalty trong tuần hiển thị trên Teacher KPI report.
  - Notification/Alert cho OPS Manager: "GV X nộp trễ 3 buổi liên tiếp".

________________________________________
## NHÓM 4: CHI PHÍ VẬN HÀNH & MARKETING (OPEX & ADS)
Nhóm này tác động trực tiếp vào Lợi nhuận ròng (Net Profit) trên Dashboard Cổ đông.

### 4.1. Đồng bộ chi phí Ads Facebook (Ad Cost Sync)
- **Preconditions:** Fanpage đã kết nối. AdAccount có chiến dịch đang chạy, spend = 5,000,000đ. Cron chạy lúc 06:00 AM.
- **Steps:**
  1. Cron trigger sync (hoặc manual trigger POST /ads/sync).
  2. Facebook API trả về spend = 5,000,000đ cho AdGroup "Tuyển sinh T4/2026".
- **Assertions:**
  - AdCost record: amount = 5,000,000đ, source = FACEBOOK, adGroupName = "Tuyển sinh T4/2026".
  - Financial Control: P&L marketingCost += 5tr. Net Profit -= 5tr.
  - Dashboard: CAC (Cost Per Acquisition) tự cập nhật = 5tr / số Lead mới.
- **Edge Cases:**
  - Facebook API trả lỗi 401 (token expired) → hệ thống retry 3 lần, nếu vẫn fail → đổi token status = EXPIRED, gửi alert cho Director.
  - Facebook API trả lỗi 429 (rate limit) → backoff retry, không crash cron.
  - Sync 2 lần trong ngày → không duplicate cost (idempotent theo date + adGroupId).
  - Sync Google Ads + TikTok Ads cùng lúc → tổng marketingCost = sum tất cả platforms.

### 4.2. Thanh toán hóa đơn Supplier (Supplier Payment)
- **Preconditions:** Kế toán tạo Supplier Payment "Mua bàn ghế" = 10,000,000đ.
- **Steps:**
  1. POST /supplier-payments (amount=10000000, supplierId, category=FURNITURE).
  2. Director PATCH /supplier-payments/:id/approve.
  3. Kế toán PATCH /supplier-payments/:id/mark-paid (kèm biên lai).
- **Assertions:**
  - Payment lifecycle: DRAFT → APPROVED → PAID.
  - Financial Control: Cashflow outflow += 10tr. P&L opexCost += 10tr. Net Profit -= 10tr.
  - Dashboard: Dòng tiền ra tăng 10tr ở biểu đồ chi phí.
- **Edge Cases:**
  - OPS cố approve → bị chặn RolesGuard (chỉ Director/Accounting).
  - Mark PAID rồi muốn hủy → có flow reverse không?

### 4.3. Chốt bảng lương nhân viên (Staff Payroll)
- **Preconditions:** Tháng 03/2026. Sale Nguyễn có lương cứng 8tr + hoa hồng 5% trên doanh thu thực thu. Doanh thu thực thu tháng 03 = 40tr.
- **Steps:**
  1. Kế toán POST /staff-payroll/generate (month=2026-03).
  2. Hệ thống tính: 8tr + 5% * 40tr = 8tr + 2tr = 10tr.
  3. Kế toán PATCH /staff-payroll/:id/mark-paid.
- **Assertions:**
  - Staff Payroll: baseSalary=8000000, commission=2000000, totalPay=10000000.
  - Financial Control: staffCost += 10tr. Cashflow outflow += 10tr. Net Profit -= 10tr.
- **Edge Cases:**
  - Hoa hồng lũy tiến: 5% cho 0-30tr, 8% cho 30tr-50tr → tính từng bậc.
  - Doanh thu = 0 → commission = 0, tổng lương = lương cứng.

### 4.4. ĐỒNG BỘ ADS ĐA NỀN TẢNG ← MỚI
- **Preconditions:** Cấu hình 3 nền tảng: Facebook, Google Ads, TikTok.
- **Steps:**
  1. Cron 06:00 AM trigger sync tất cả nền tảng.
- **Assertions:**
  - Mỗi platform có AdCost record riêng.
  - Financial Control: marketingCost = SUM(facebook + google + tiktok).
  - Dashboard: CAC tính tổng hợp tất cả nguồn.
  - Report: Báo cáo ROI theo từng nền tảng (ROAS = revenue / spend).
- **Edge Cases:**
  - 1 platform fail (Google API lỗi), 2 platform OK → 2 synced, 1 error logged, không rollback cả batch.
  - API key bị mã hóa AES-256-GCM → giải mã thành công trước khi gọi API.

________________________________________
## NHÓM 5: CHUYỂN TIỀN, ĐIỀU CHỈNH THỦ CÔNG & ĐỐI SOÁT

### 5.1. Phụ huynh chuyển tiền cho nhau (Wallet Transfer)
- **Preconditions:** PH_A balance = 500,000đ. PH_B balance = 200,000đ. PH_A chuyển 300k cho PH_B (anh/em).
- **Steps:**
  1. POST /wallets/transfer (fromParentId=A, toParentId=B, amount=300000, reason="Chuyển cho em").
- **Assertions:**
  - PH_A: LedgerEntry type=TRANSFER_OUT, amount=-300000. Balance = 200,000đ.
  - PH_B: LedgerEntry type=TRANSFER_IN, amount=+300000. Balance = 500,000đ.
  - Financial Control: totalInflow/outflow KHÔNG đổi (tiền nội bộ, không ra/vào công ty).
  - AuditLog: Ghi nhận who, from, to, amount, reason.
- **Edge Cases:**
  - Chuyển vượt số dư (amount > balance) → API trả 400 "Insufficient balance".
  - Chuyển cho chính mình (fromParentId = toParentId) → API trả 400.
  - Chuyển 0đ → API trả 400.
  - Concurrent transfer A→B và B→A cùng lúc: Kiểm tra không deadlock, dùng consistent lock ordering.

### 5.2. Kế toán điều chỉnh số dư ví (Manual Adjustment)
- **Preconditions:** PH balance = 500k. Kế toán cần cộng 200k đền bù lỗi hệ thống.
- **Steps:**
  1. POST /wallets/:id/adjust (amount=200000, reason="Đền bù lỗi trừ sai buổi 01/04").
- **Assertions:**
  - LedgerEntry type=ADJUSTMENT, amount=200000.
  - Balance = 700,000đ.
  - AuditLog: Ghi reason BẮT BUỘC. Nếu reason trống → API trả 400.
  - P&L: Ghi nhận vào chi phí Promotion/Compensation.
- **Edge Cases:**
  - Adjustment âm -500k (thu hồi tiền PH) → Balance giảm. Có thể về 0 hoặc âm (kiểm tra policy).
  - Adjustment âm lớn hơn balance → ví có bị âm không? Kiểm tra debt tolerance.
  - Chỉ ACCOUNTING và DIRECTOR được gọi API này (RBAC).

### 5.3. Đối soát ngân hàng lệch (Bank Reconciliation Mismatch)
- **Preconditions:** Invoice 2,000,000đ đã APPROVED. Tiền đã vào ví. Nhưng Kế toán đối chiếu Bank Statement: không thấy 2tr.
- **Steps:**
  1. Kế toán PATCH /invoices/:id/reject-reconciliation (reason="Bank statement không khớp").
- **Assertions:**
  - Invoice chuyển status phù hợp (REJECTED/REVERSED).
  - Wallet: Tạo ADJUSTMENT âm -2,000,000đ. Balance giảm 2tr.
  - Financial Control: Inflow giảm 2tr. Dashboard cập nhật.
  - AuditLog: Ghi nhận đầy đủ action + reason.
- **Edge Cases:**
  - PH đã dùng 1tr để học (1tr còn trong ví) → rollback 2tr khiến ví âm -1tr. Hệ thống xử lý thế nào?
  - Kế toán reject nhầm → có flow un-reject không?

________________________________________
## NHÓM 6: HOÀN TIỀN & ROLLBACK (REFUNDS & REVERSALS)
Luồng này kiểm tra việc hệ thống thu hồi dòng tiền khi có sai sót từ nhân viên hoặc khiếu nại nghiêm trọng.

### 6.1. Hủy hóa đơn đã duyệt & nạp tiền (Rollback Top-up)
- **Preconditions:** Invoice 2,000,000đ đã APPROVED. Wallet đã TOP_UP 2tr. PH đã học 3 buổi (trừ 600k). Balance = 1,400,000đ.
- **Steps:**
  1. Kế toán PATCH /invoices/:id/cancel (reason="Biên lai lỗi").
- **Assertions:**
  - Invoice.status = CANCELLED.
  - Wallet: ADJUSTMENT -2,000,000đ. Balance = 1,400,000 - 2,000,000 = -600,000đ (ví âm).
  - Financial Control: Inflow giảm 2tr.
  - Dashboard: Dòng tiền thu tháng giảm.
  - AuditLog: Ghi lý do cancel, who, timestamp.
- **Edge Cases:**
  - PH chưa học gì (balance = 2tr) → rollback → balance = 0 (không âm).
  - PH đã học hết (balance = 0) → rollback → balance = -2tr. Hệ thống xử lý debt thế nào?
  - Cancel invoice đang ở PENDING (chưa approve) → chỉ đổi status, không tạo ADJUSTMENT.

### 6.2. Hoàn tiền khi hủy buổi học (Session Refund)
- **Preconditions:** Session đã FINALIZED, isPaid=true, amountCharged=200,000đ. PH balance sau trừ = 1,800,000đ.
- **Steps:**
  1. OPS PATCH /sessions/:id/cancel (sau khi phát hiện sai sót).
  2. Hệ thống tự tạo REFUND.
- **Assertions:**
  - Session.status = CANCELLED.
  - Wallet: LedgerEntry type=REFUND, amount=200,000đ. Balance = 2,000,000đ.
  - PayrollTransaction: Status = CANCELLED, teacherPay hiệu lực = 0.
  - P&L: sessionRevenue -= 200k, teacherCost -= teacherPay. Lợi nhuận gộp ngày sụt.
- **Edge Cases:**
  - Cancel session mà isPaid=false (chưa trừ ví) → không cần REFUND.
  - Cancel session mà PayrollTx đã PAID (đã chuyển lương GV) → hệ thống trả 400 hoặc tạo clawback?

### 6.3. HOÀN TOÀN BỘ KHI PH RÚT HỌC ← MỚI
- **Preconditions:** PH mua gói 20 buổi, đã học 5 buổi (trừ 1tr), balance còn 3tr.
- **Steps:**
  1. OPS tạo Ticket loại FULL_REFUND.
  2. Kế toán thực hiện Adjust -3,000,000đ (hoàn toàn bộ số dư còn lại).
  3. Kế toán chuyển khoản thực tế cho PH.
- **Assertions:**
  - Wallet: Balance = 0đ. ADJUSTMENT -3tr.
  - Ticket: Liên kết với LedgerEntryId. Status = CLOSED.
  - Financial Control: Outflow += 3tr (tiền ra ngân hàng).
  - Dashboard: Churn rate tăng. Revenue tháng này giảm quỹ chờ.

________________________________________
## NHÓM 7: NGHIỆP VỤ LỚP OFFLINE PHỨC TẠP (OFFLINE ECONOMICS)
Lớp Offline có cơ chế "Lương tối thiểu bảo chứng" (Minimum Payout Guarantee) cho giáo viên, đòi hỏi hệ thống phải phân bổ chi phí linh hoạt.

### 7.1. Bù trừ lương Offline (Recompute Offline Payout)
- **Preconditions:** Lớp Offline 5 HS, giá 80k/HS. GV lương min = 200k. Đã điểm danh 3 HS PRESENT.
- **Steps:**
  1. OPS finalize → teacherPay = MAX(80k*3, 200k) = MAX(240k, 200k) = 240k.
  2. OPS sửa 1 HS thành ABSENT (chỉ còn 2 PRESENT).
  3. Hệ thống tự tính lại.
- **Assertions:**
  - REFUND cho HS bị đổi thành ABSENT (nếu đã trừ ví).
  - PayrollTransaction: Recompute teacherPay = MAX(80k*2, 200k) = MAX(160k, 200k) = 200k (min).
  - P&L: Revenue = 160k, COGS = 200k → Loss = -40k (từ lãi 40k thành lỗ 40k).
  - Dashboard: Lợi nhuận lớp Offline biến động real-time.
- **Edge Cases:**
  - Sửa tất cả HS thành ABSENT → Revenue = 0, teacherPay = 200k (min), Loss = -200k.
  - Thêm 1 HS mới (6 HS PRESENT) → teacherPay = MAX(480k, 200k) = 480k? Kiểm tra ceiling.

### 7.2. Điểm danh bulk cho lớp Offline (Bulk Attendance)
- **Preconditions:** Lớp Offline 10 HS. GV chỉ điểm danh 5 HS.
- **Steps:**
  1. GV POST /attendance/bulk (sessionId, studentIds=[5 HS], status=PRESENT).
- **Assertions:**
  - 5 HS → PRESENT, bị trừ ví.
  - 5 HS còn lại → tự động gán ABSENT, KHÔNG bị trừ ví.
  - P&L: Revenue chỉ từ 5 HS. teacherPay theo formula.
- **Edge Cases:**
  - GV điểm danh 0 HS (submit rỗng) → tất cả ABSENT, Revenue = 0.
  - GV điểm danh trùng studentId → ignore duplicate.

### 7.3. LỚP OFFLINE NHIỀU GV ← MỚI
- **Preconditions:** Lớp Offline có GV chính (lương 200k) + GV phụ (lương 100k). 5 HS, giá 120k/HS.
- **Steps:**
  1. Cả 2 GV điểm danh. OPS finalize.
- **Assertions:**
  - 2 PayrollTransactions: GV chính 200k, GV phụ 100k.
  - P&L: Revenue = 600k, COGS = 300k, Gross Margin = 50%.
  - Dashboard: Chi phí GV tách rõ GV chính vs GV phụ.

________________________________________
## NHÓM 8: THAY ĐỔI CẤU HÌNH & VẬN HÀNH (CHANGE REQUESTS)
Các tình huống "thay đổi giữa chừng" (Mid-flight changes) do Sale hoặc Phụ huynh yêu cầu.

### 8.1. Đổi thời lượng buổi học đơn lẻ (Session Duration Change)
- **Preconditions:** Lớp 1-1, giá 200k/60p. Session ngày mai status=SCHEDULED.
- **Steps:**
  1. OPS PATCH /sessions/:id với duration=90.
- **Assertions:**
  - Session.duration = 90. amountCharged sẽ = 200k/60*90 = 300k khi finalize.
  - Remaining Sessions (quy đổi) của HS giảm vì buổi này tốn nhiều tiền hơn.
  - Dashboard dự phóng: Projected Revenue tăng, Remaining Sessions giảm.
- **Edge Cases:**
  - Đổi duration session đã FINALIZED → API trả 400.
  - Đổi duration = 0 hoặc = -30 → API trả 400 validation.

### 8.2. Đổi giáo viên có mức lương cao hơn (Teacher Swap)
- **Preconditions:** Lớp 1-1 HS X. GV cũ lương 120k/buổi. Sale xin đổi GV mới lương 180k/buổi.
- **Steps:**
  1. OPS PATCH /classes/:id/teacher (teacherId=newTeacher).
  2. Finalize session tiếp theo.
- **Assertions:**
  - Wallet PH: Vẫn trừ 200k (học phí không đổi).
  - PayrollTransaction: teacherPay = 180k (GV mới).
  - P&L: COGS tăng 60k/buổi. Gross Margin giảm từ 40% → 10%.
  - Dashboard: Cảnh báo vàng "Biên lợi nhuận thu hẹp".
- **Edge Cases:**
  - Đổi GV giữa buổi (session đang TAUGHT) → có cho phép không?
  - Đổi GV về lại GV cũ → sessions mới lại dùng lương cũ.

### 8.3. Bổ sung cấu hình HS (Student Config — Multi-teacher)
- **Preconditions:** HS X học với GV_1 slot Thứ 2 (60p, 200k), thêm GV_2 slot Thứ 4 (90p, 300k).
- **Steps:**
  1. OPS POST /student-configs (studentId, teacherId=GV_2, duration=90, pricePerSession=300000, dayOfWeek=4).
- **Assertions:**
  - 2 student-config records cho HS X.
  - Sessions sinh ra: Thứ 2 = GV_1/60p/200k, Thứ 4 = GV_2/90p/300k.
  - Payroll: Tách riêng PayrollTx cho GV_1 vs GV_2.
  - P&L: COGS tính riêng từng Slot, không cào bằng.

### 8.4. RESCHEDULE BUỔI HỌC ← MỚI
- **Preconditions:** Session Thứ 2 ngày 07/04 lúc 14:00. PH xin đổi sang Thứ 4 ngày 09/04 lúc 16:00.
- **Steps:**
  1. OPS PATCH /sessions/:id/reschedule (newDate=2026-04-09, newTime=16:00).
- **Assertions:**
  - Session cũ: status = RESCHEDULED hoặc CANCELLED.
  - Session mới sinh ra: date = 09/04, time = 16:00, cùng class/teacher/student.
  - Notification: PH nhận thông báo "Buổi học đã đổi lịch". GV nhận thông báo tương tự.
  - Wallet: Không bị trừ tiền (chưa học).
- **Edge Cases:**
  - Reschedule sang ngày GV đã bận (conflict) → API trả 400 hoặc cảnh báo.
  - Reschedule session đã FINALIZED → API trả 400.

________________________________________
## NHÓM 9: ĐỐI SOÁT & TỰ ĐỘNG SỬA LỖI (RECONCILIATION & AUTO-HEAL)
Các kịch bản bảo vệ tính toàn vẹn dữ liệu (Data Integrity) khi hệ thống quét vào lúc 2:00 AM mỗi ngày.

### 9.1. Quét thấy Session có báo cáo nhưng mất PayrollTx (Missing PayrollTx Auto-heal)
- **Preconditions:** Session status=FINALIZED, GV đã nộp report, nhưng PayrollTransaction không tồn tại (bị mất do bug).
- **Steps:**
  1. Cron 02:00 AM chạy reconciliation.
- **Assertions:**
  - Auto-heal: Tạo mới PayrollTransaction cho session đó với đúng teacherPay theo cấu hình.
  - Reconciliation report: ghi nhận "1 missing PayrollTx auto-healed".
  - Financial Control: teacherCost tăng bù đúng số tiền.
  - Dashboard: Net Profit điều chỉnh chính xác.
- **Edge Cases:**
  - Session FINALIZED nhưng GV cũng không nộp report → vẫn sinh PayrollTx? Kiểm tra policy.
  - 50 sessions thiếu PayrollTx → auto-heal tất cả, report: "50 auto-healed".

### 9.2. Lệch cờ nộp trễ (Late-flag Discrepancy)
- **Preconditions:** GV nộp report trễ 5h. Nhưng PayrollTransaction.lateHours = 0 (không ghi nhận phạt do bug).
- **Steps:**
  1. Cron 02:00 AM quét discrepancy.
- **Assertions:**
  - Auto-fix: Cập nhật lateHours = 5, tính lại penaltyAmount.
  - teacherPay giảm. P&L: teacherCost giảm → Net Profit tăng nhẹ.
  - Reconciliation report: "1 late-flag discrepancy auto-fixed".

### 9.3. Cảnh báo "Lương đã chi nhưng không có báo cáo" (Critical Anomaly)
- **Preconditions:** PayrollTx status=PAID. Nhưng Session không có TeachingReport (GV xóa hoặc bug).
- **Steps:**
  1. Cron 02:00 AM quét anomaly.
- **Assertions:**
  - KHÔNG auto-heal (quá nguy hiểm — đây là dấu hiệu gian lận).
  - Tạo Critical Alert gửi Director/Cổ đông: "Lương đã chi nhưng không có báo cáo giảng dạy".
  - Reconciliation report: "1 CRITICAL anomaly — manual review required".
  - AuditLog: Flag session + payrollTx cho manual review.

### 9.4. ĐỐI SOÁT SỐ DƯ VÍ VỚI LỊCH SỬ GIAO DỊCH ← MỚI
- **Preconditions:** Wallet PH A balance = 500k. Nhưng SUM(LedgerEntries) = 480k (lệch 20k do bug atomic).
- **Steps:**
  1. Cron 02:00 AM chạy wallet reconciliation.
- **Assertions:**
  - Phát hiện lệch: expectedBalance=480k, actualBalance=500k, diff=+20k.
  - Alert cho Kế toán: "Wallet PH A lệch 20k".
  - KHÔNG tự fix (tiền phải review thủ công). Chỉ ghi report.

________________________________________
## NHÓM 10: DÒNG VỐN & CHI PHÍ BACK-OFFICE (CAPITAL & BACK-OFFICE)

### 10.1. Cổ đông rót vốn / Vay vốn (Loans & Capital)
- **Preconditions:** Kế toán chuẩn bị ghi nhận khoản vay 1,000,000,000đ.
- **Steps:**
  1. POST /loans (amount=1000000000, type=LOAN, interestRate=12, termMonths=12).
  2. Kế toán PATCH /loans/:id/activate.
- **Assertions:**
  - Loan.status = ACTIVE. amount = 1 Tỷ.
  - Financial Control: Cashflow inflow += 1 Tỷ (tiền vào ngân hàng).
  - P&L: Net Profit KHÔNG tăng (Loan là Liability, không phải Revenue).
  - Balance Sheet: Debt/Liability tăng 1 Tỷ.
  - Dashboard: Investor view thấy debtPosition tăng.
- **Edge Cases:**
  - Loan vs Capital Contribution → hạch toán khác nhau (Liability vs Equity). Kiểm tra type field.
  - Partial payment: Trả 200tr → balance giảm. interestExpense tính trên số dư còn lại.
  - Overdue installment → gửi alert cho Director/Cổ đông.

### 10.2. Chốt lương nhân viên + Hoa hồng Lũy tiến (Staff Payroll with Tiered Commission)
- **Preconditions:** Sale A có doanh thu thực thu tháng = 60,000,000đ. Cấu hình hoa hồng: 0-30tr = 5%, 30tr-50tr = 8%, >50tr = 10%. Lương cứng = 8tr.
- **Steps:**
  1. Kế toán POST /staff-payroll/generate (month=2026-03, staffId=SaleA).
- **Assertions:**
  - Commission = 30tr*5% + 20tr*8% + 10tr*10% = 1.5tr + 1.6tr + 1tr = 4,100,000đ.
  - Total = 8tr + 4.1tr = 12,100,000đ.
  - Financial Control: staffCost += 12.1tr ở cuối tháng. Net Profit giảm mạnh.
- **Edge Cases:**
  - Doanh thu = 0 → commission = 0.
  - Doanh thu = 30,000,000đ (đúng ngưỡng) → commission = 30tr * 5% = 1.5tr.
  - 2 Sale cùng chốt → tổng staffCost là tổng 2 payroll.

### 10.3. Hoa hồng cho Đại lý (Agent Commission)
- **Preconditions:** Đại lý A (Tier: GOLD, rate: 15%). KH từ Đại lý A mua gói 2,000,000đ.
- **Steps:**
  1. Sale tạo Order với agentId=A.
  2. Director approve Order.
- **Assertions:**
  - agentCommission = 2,000,000 * 15% = 300,000đ.
  - P&L: CAC (Cost of Acquisition) += 300k.
  - Dashboard: ROI = (Revenue - CAC) / CAC cho Đại lý A.
- **Edge Cases:**
  - Đại lý bị SUSPENDED → commission = 0 (xem 16.2).
  - KH refund → commission clawback (thu hồi hoa hồng).
  - Đại lý SILVER (10%) vs GOLD (15%) → tính đúng tier.

### 10.4. QUẢN LÝ CHI PHÍ VÀ NGÂN SÁCH (Expenses & Budget) ← MỚI
- **Preconditions:** Kế toán tạo Expense "Thuê văn phòng tháng 04" = 15,000,000đ.
- **Steps:**
  1. POST /expenses (category=RENT, amount=15000000, description="VP tháng 04").
  2. Kế toán PATCH /expenses/:id/mark-paid.
- **Assertions:**
  - Financial Control: opexCost += 15tr. Cashflow outflow += 15tr. Net Profit -= 15tr.
  - Dashboard: Biểu đồ chi phí theo category hiển thị RENT = 15tr.
- **Edge Cases:**
  - Expense cùng lúc đổi status PAID và update amount → race condition test.
  - Expense recurring (hàng tháng) → có auto-generate không?
________________________________________

# PHẦN II: BẢO MẬT, TƯƠNG TRANH & VẬN HÀNH NÂNG CAO (NHÓM 11–20)

________________________________________
## NHÓM 11: TƯƠNG TRANH & CẠNH TRANH DỮ LIỆU (RACE CONDITIONS & CONCURRENCY)
Đây là nhóm lỗi đáng sợ nhất trong hệ thống tài chính, xảy ra khi nhiều thao tác diễn ra cùng một phần nghìn giây.

### 11.1. Double-click Duyệt Hóa đơn (Idempotent Approve)
- **Preconditions:** Invoice 2,000,000đ status=PENDING. Wallet PH balance = 0đ.
- **Steps:**
  1. Dùng script bắn đồng thời 10 request PATCH /invoices/:id/approve (simulate double-click).
- **Assertions:**
  - Chỉ 1 request thành công (HTTP 200). 9 request còn lại trả 400 hoặc 409 Conflict.
  - Wallet: Balance = 2,000,000đ (KHÔNG phải 20,000,000đ).
  - LedgerEntry: Chỉ có 1 bản ghi TOP_UP.
  - Invoice.status = APPROVED (không bị ghi đè nhiều lần).
- **Edge Cases:**
  - Double-click approve Order (10 request cùng lúc) → chỉ 1 approve thành công.
  - Double-click markPaid trên PayrollTransaction → chỉ 1 lần PAID.

### 11.2. Trừ tiền và Nạp tiền cùng lúc (Concurrent Wallet Operations)
- **Preconditions:** Wallet PH balance = 500,000đ. Invoice nạp 1,000,000đ đang chờ. Session 200k đang chờ finalize.
- **Steps:**
  1. Thread A: PATCH /invoices/:id/approve (nạp 1tr).
  2. Thread B: POST /sessions/:id/finalize (trừ 200k).
  3. Chạy đồng thời.
- **Assertions:**
  - Balance cuối = 500k + 1tr - 200k = 1,300,000đ (bất kể thứ tự xử lý).
  - Dùng atomic $inc trong MongoDB → KHÔNG xảy ra stale balance overwrite.
  - 2 LedgerEntries: TOP_UP +1tr, SESSION_DEDUCT -200k. SUM = +800k. Khớp với balance delta.
- **Edge Cases:**
  - 3 operations cùng lúc (nạp 1tr, trừ 200k, adjust -100k) → balance vẫn phải đúng.
  - Kiểm tra bằng script: SUM(LedgerEntries) phải luôn = Balance hiện tại.

### 11.3. Double-submit Báo cáo GV (Duplicate Teaching Report)
- **Preconditions:** GV dạy xong session. Mở 2 tab trình duyệt, điền report trên cả 2.
- **Steps:**
  1. Tab 1: POST /teaching-reports (sessionId, content).
  2. Tab 2: POST /teaching-reports (sessionId, content) — cùng lúc.
- **Assertions:**
  - Chỉ 1 TeachingReport được tạo. Tab thứ 2 trả 409 Conflict (Unique Index trên sessionId+teacherId).
  - Chỉ 1 PayrollTransaction được sinh ra.
  - Kiểm tra: COUNT(payroll_transactions WHERE sessionId=X) = 1.
- **Edge Cases:**
  - GV submit report rồi delete rồi submit lại → có được phép không? Kiểm tra policy.
  - 2 GV khác nhau submit report cho cùng sessionId (không hợp lệ trừ lớp offline) → unique constraint.

### 11.4. CONCURRENT ORDER APPROVE ← MỚI
- **Preconditions:** 2 Director cùng mở trang pending orders. Cùng thấy Order X status=PENDING.
- **Steps:**
  1. Director A: PATCH /orders/:id/approve.
  2. Director B: PATCH /orders/:id/approve — cùng lúc.
- **Assertions:**
  - Chỉ 1 approve thành công. Wallet PH chỉ TOP_UP 1 lần.
  - Invoice chỉ sinh 1 bản.
  - AuditLog ghi rõ ai approve (Director A hoặc B), không ghi cả 2.

________________________________________
## NHÓM 12: PHÂN QUYỀN, BẢO MẬT & TRUY VẾT (RBAC, ISOLATION & AUDIT)
Cổ đông sẽ rất quan tâm đến việc dữ liệu khách hàng có bị rò rỉ giữa các nhân viên Sale hay không.

### 12.1. Cách ly dữ liệu Sale (Data Isolation)
- **Preconditions:** Sale A có 10 Orders. Sale B có 8 Orders. Cả 2 đều role=SALE.
- **Steps:**
  1. Login Sale A → GET /orders → chỉ thấy 10 orders của mình.
  2. Sale A gọi GET /orders/:orderId (orderId thuộc Sale B).
- **Assertions:**
  - GET /orders: Trả về 10 orders (không phải 18).
  - GET /orders/:id (của Sale B): 403 Forbidden hoặc 404 Not Found.
  - GET /leads: Sale A chỉ thấy leads mình tạo.
  - GET /dashboard/sales-performance: Chỉ hiện doanh số cá nhân Sale A.
- **Edge Cases:**
  - Sale A đổi URL param `saleId=B` → backend phải ignore param, dùng token.
  - Sale A đổi sang role OPS (modify JWT payload) → JWT verification fail, 401.

### 12.2. Vượt quyền duyệt chi (Privilege Escalation)
- **Preconditions:** User role=OPS. Payroll GV tháng 03 status=DRAFT.
- **Steps:**
  1. OPS dùng Postman gọi PATCH /staff-payroll/:id (status=APPROVED).
  2. OPS gọi POST /wallets/:id/adjust (amount=-500000).
- **Assertions:**
  - Cả 2 request trả 403 Forbidden. RolesGuard chặn.
  - Chỉ DIRECTOR hoặc ACCOUNTING mới được approve payroll.
  - Chỉ ACCOUNTING mới được adjust wallet.
  - AuditLog: Ghi nhận attempted access violation.
- **Edge Cases:**
  - SHAREHOLDER gọi POST/PATCH/DELETE trên bất kỳ finance API → 403.
  - PARENT gọi bất kỳ admin API → 403.

### 12.3. Dấu vết Audit Log (Immutable Audit Trail)
- **Preconditions:** Kế toán thực hiện AdjustBalance âm 500k cho PH A.
- **Steps:**
  1. PATCH /wallets/:id/adjust (amount=-500000, reason="Thu hồi nạp sai").
  2. GET /audit-logs?entityType=WALLET&entityId=:walletId.
- **Assertions:**
  - AuditLog entry: action=ADJUST, performedBy=Kế toán, reason="Thu hồi nạp sai".
  - Chứa: previousBalance, newBalance, diff=-500000.
  - Timestamp chính xác (UTC). IP address ghi nhận.
  - DELETE /audit-logs/:id → 403 hoặc 405 (không ai được xóa log).
- **Edge Cases:**
  - Audit log cho cancel invoice, approve order, exclude payroll → tất cả đều phải có.
  - Bulk operations (50 payroll approve) → 50 audit log entries.

### 12.4. Phụ huynh tò mò (Parent Data Boundary)
- **Preconditions:** Parent A có Student X. Parent B có Student Y.
- **Steps:**
  1. Login Parent A → GET /students/:studentY/attendance.
  2. Login Parent A → GET /teaching-reports?studentId=:studentY.
  3. Login Parent A → GET /wallets/:walletOfParentB.
- **Assertions:**
  - Tất cả trả 403 hoặc 404 (ownership guard).
  - Parent A chỉ thấy attendance/report/wallet của Student X.
- **Edge Cases:**
  - Parent có 2 con (Student X, Z) → xem được cả 2, không thấy Student Y.
  - Link điểm danh public (token-based) → chỉ hoạt động cho đúng sessionId trong token.

### 12.5. BẢO MẬT API TOKEN QUẢNG CÁO ← MỚI
- **Preconditions:** Ads Manager cấu hình FB/Google/TikTok API tokens (mã hóa AES-256-GCM).
- **Steps:**
  1. GET /ads/settings → response chứa tokens.
  2. Kiểm tra response body.
- **Assertions:**
  - Token KHÔNG trả về dạng plaintext. Hiện "••••••" hoặc masked.
  - Database: Token lưu dạng encrypted (iv:authTag:ciphertext).
  - Chỉ role DIRECTOR/ADS_MANAGER mới GET được settings.
  - Log: Không ghi token plaintext vào server logs.
- **Edge Cases:**
  - Token bị expired → API trả lỗi rõ ràng, không expose secret.
  - Rotate token → token cũ bị invalidate ngay.

________________________________________
## NHÓM 13: VÒNG ĐỜI TRẠNG THÁI & CHẶN NGHIỆP VỤ (STATE MACHINE STRICTNESS)
Đảm bảo các thực thể không di chuyển lùi hoặc nhảy cóc các trạng thái một cách phi logic.

### 13.1. Hủy hóa đơn đã thanh toán (Prevent Hard Delete)
- **Preconditions:** Invoice 2tr, status=APPROVED. Wallet đã TOP_UP 2tr.
- **Steps:**
  1. Kế toán DELETE /invoices/:id (cố xóa cứng).
- **Assertions:**
  - HTTP 400 hoặc 405 "Không được xóa invoice đã APPROVED. Sử dụng API Cancel."
  - Invoice vẫn tồn tại, status không đổi.
  - Wallet balance không thay đổi.
- **Edge Cases:**
  - DELETE invoice PENDING → cho phép? Hoặc bắt buộc cancel?
  - Kế toán gọi PATCH /invoices/:id (status=PENDING) → chặn (không cho lùi trạng thái).

### 13.2. Sửa lớp sau khi đã lên lịch (PricingSnapshot Immutability)
- **Preconditions:** Class giá 150k/buổi. Đã sinh 10 sessions (5 đã FINALIZED, 5 SCHEDULED).
- **Steps:**
  1. Director PATCH /classes/:id (pricePerSession=200000).
  2. Kiểm tra 5 sessions đã FINALIZED và 5 sessions SCHEDULED.
- **Assertions:**
  - 5 sessions FINALIZED: amountCharged vẫn = 150k (lịch sử bất biến).
  - 5 sessions SCHEDULED: amountCharged sẽ = 200k khi finalize (áp giá mới qua PricingSnapshot).
  - New sessions sinh sau thay đổi: giá 200k.
- **Edge Cases:**
  - Đổi giá 3 lần liên tiếp (150k → 200k → 180k) → mỗi session áp đúng giá tại thời điểm snapshot.
  - Đổi giá rồi đổi lại 150k → sessions mới vẫn dùng snapshot mới (150k), không revert snapshot cũ.

### 13.3. Duyệt Đơn hàng thiếu chứng từ (Receipt Validation)
- **Preconditions:** Order 2tr, paymentMethod=TRANSFER. Sale chưa upload receiptImage.
- **Steps:**
  1. Director PATCH /orders/:id/approve.
- **Assertions:**
  - HTTP 400 "Cần có chứng từ cho thanh toán chuyển khoản".
  - Order.status vẫn = PENDING.
  - Wallet: Không có TOP_UP.
- **Edge Cases:**
  - paymentMethod=CASH → approve không cần receiptImage.
  - receiptImage = empty string "" → coi như không có, trả 400.
  - Upload ảnh rồi approve → thành công.

### 13.4. CHẶN LÙI TRẠNG THÁI PAYROLL ← MỚI
- **Preconditions:** PayrollTransaction status=PAID (đã chuyển lương GV).
- **Steps:**
  1. Kế toán PATCH /payroll-transactions/:id (status=DRAFT).
  2. Kế toán PATCH /payroll-transactions/:id (status=EXCLUDED).
- **Assertions:**
  - Cả 2 request trả 400 "Không thể thay đổi trạng thái sau khi đã PAID".
  - Status vẫn = PAID.
  - AuditLog: Ghi nhận attempted state reversal.
- **Edge Cases:**
  - HELD → APPROVED → OK. HELD → PAID → skip APPROVED? Kiểm tra state machine.
  - EXCLUDED → APPROVED → có cho phép "khôi phục"?

________________________________________
## NHÓM 14: MARKETING ATTRIBUTION & CHATBOT (AI & TRACKING)
Đo lường độ chính xác của cỗ máy thu hút khách hàng (CAC) và sự ổn định của AI.

### 14.1. Gộp nguồn Marketing (Attribution Merge)
- **Preconditions:** 
  - KH Nguyễn Thị B, SĐT 0901234567.
  - Lần 1: Click quảng cáo FB → Chatbot → Lead được tạo (source=FACEBOOK).
  - Lần 2: Điền form Landing Page Google Ads cùng SĐT (source=GOOGLE).
- **Steps:**
  1. POST /leads (phone=0901234567, source=GOOGLE, landingPageId=LP1).
  2. GET /leads?phone=0901234567.
- **Assertions:**
  - Chỉ 1 Lead / 1 Parent record (deduplicate theo SĐT).
  - Attribution history: [{source:FACEBOOK, touchpoint:CHATBOT}, {source:GOOGLE, touchpoint:LANDING_PAGE}].
  - FIRST_TOUCH model: source gốc = FACEBOOK.
  - Khi Sale tạo Order từ Lead → Order.source = FACEBOOK (first-touch).
- **Edge Cases:**
  - 3 nguồn khác nhau (FB, Google, TikTok) cùng SĐT → 1 Lead, 3 touchpoints.
  - SĐT khác nhau nhưng cùng tên → KHÔNG merge (key là SĐT, không phải tên).

### 14.2. Chatbot OpenAI Token hết hạn (AI Failure Graceful)
- **Preconditions:** Chatbot đang auto-reply. OpenAI API Token sắp hết tiền.
- **Steps:**
  1. OpenAI trả 429 (Rate Limit) hoặc 401 (Unauthorized) cho request tiếp theo.
- **Assertions:**
  - Hệ thống catch lỗi, KHÔNG crash loop.
  - ChatbotSettings.autoReplyEnabled → false (tự vô hiệu).
  - Tin nhắn KH vẫn được lưu vào Conversations (không mất tin).
  - Dashboard: Alert đỏ "OpenAI Token expired — cần thay key".
  - Khi director update key mới → autoReply enable lại.
- **Edge Cases:**
  - OpenAI trả 500 (server error tạm) → retry 3 lần rồi mới disable.
  - OpenAI trả 200 nhưng response rỗng → handle gracefully, không reply rỗng.

### 14.3. Quá tải Webhook (Webhook Flood — BullMQ)
- **Preconditions:** Facebook Webhook đã cấu hình. BullMQ + Redis đang hoạt động.
- **Steps:**
  1. Dùng script bắn đồng thời 100 POST /webhooks/facebook/:pageId.
- **Assertions:**
  - Tất cả 100 request trả 200 OK ngay lập tức (Facebook không bị timeout → không khóa webhook).
  - Messages được đưa vào BullMQ Queue, xử lý tuần tự.
  - Sau xử lý: 100 tin nhắn đều được lưu vào DB.
  - Server RAM/CPU không spike vượt ngưỡng (không OOM).
- **Edge Cases:**
  - Redis down → fallback xử lý synchronous (chậm nhưng không mất tin).
  - Duplicate messageId từ Facebook (Facebook retry) → idempotent, không lưu trùng.

### 14.4. WEBHOOK SIGNATURE VALIDATION ← MỚI
- **Preconditions:** Facebook Webhook secret đã cấu hình trong hệ thống.
- **Steps:**
  1. POST /webhooks/facebook/:pageId với X-Hub-Signature header sai (payload giả mạo).
  2. POST /webhooks/facebook/:pageId với signature đúng.
- **Assertions:**
  - Request 1: 403 Forbidden. Không đẩy vào Queue. Log: "Invalid webhook signature".
  - Request 2: 200 OK. Đẩy vào Queue xử lý bình thường.
- **Edge Cases:**
  - Không có header signature → 403.
  - Signature đúng nhưng payload bị sửa (tampered) → 403.

________________________________________
## NHÓM 15: GIỚI HẠN, HẾT HẠN & THAO TÁC HÀNG LOẠT (LIMITS, EXPIRY & BULK)

### 15.1. Điểm danh qua link hết hạn (Attendance Link Expiry)
- **Preconditions:** OPS tạo link tự điểm danh cho session ngày 01/04. Link hết hạn sau 24h.
- **Steps:**
  1. Ngày 02/04 (sau 24h): HS click link → POST /public/attendance/token/:token.
- **Assertions:**
  - HTTP 410 Gone hoặc 400 "Link hết hạn".
  - Ảnh selfie KHÔNG được upload lên storage.
  - Attendance record KHÔNG được tạo.
- **Edge Cases:**
  - Click link đúng lúc hết hạn (borderline) → kiểm tra buffer (±1 phút)?
  - Link đã sử dụng 1 lần → click lần 2 → "Link đã sử dụng".
  - Token không hợp lệ (random string) → 404 hoặc 400.

### 15.2. Chạm ngưỡng nợ (Debt Limit Breach)
- **Preconditions:** Cấu hình: maxDebtSessions = 2. PH A balance = 0đ. Đã nợ 2 buổi (walletDeductError 2 lần).
- **Steps:**
  1. OPS finalize session thứ 3 cho PH A.
- **Assertions:**
  - Wallet: walletDeductError lần 3. Balance = -600,000đ (nếu cho phép trừ).
  - HOẶC: API chặn finalize, trả lỗi "Vượt ngưỡng nợ cho phép".
  - Notification: LOW_BALANCE_ALERT gửi cho Sale assigned.
  - Dashboard: Danh sách "PH nợ quá hạn" hiển thị PH A.
- **Edge Cases:**
  - maxDebtSessions = 0 → không cho nợ bất kỳ buổi nào.
  - PH nạp tiền trả nợ → balance dương → reset debt counter.
  - PH nợ đúng 2 buổi (= ngưỡng) → buổi thứ 3 mới bị chặn.

### 15.3. Tạo lương hàng loạt bị lỗi giữa chừng (Bulk Payroll — Partial Failure)
- **Preconditions:** 50 GV cần generate payroll tháng 03. GV #25 thiếu salaryConfig.
- **Steps:**
  1. POST /staff-payroll/bulk-generate (month=2026-03, staffIds=[50 GV]).
- **Assertions:**
  - 49 PayrollRecords tạo thành công (GV #1-24, #26-50).
  - GV #25: Ghi nhận lỗi "Missing salary config", KHÔNG crash toàn bộ job.
  - API response: { success: 49, failed: 1, errors: [{staffId: 25, reason: "Missing salary config"}] }.
  - Financial Control: staffCost chỉ cộng 49 GV, không cộng GV #25.
- **Edge Cases:**
  - 50/50 GV đều lỗi → success: 0, failed: 50. Job vẫn hoàn thành (không crash).
  - 1/50 GV lỗi nhưng lỗi nghiêm trọng (DB connection lost) → rollback tất cả? Hay partial commit?
  - Bulk generate 2 lần cùng tháng → lần 2 skip GV đã có payroll (idempotent).

### 15.4. RATE LIMITING API PUBLIC ← MỚI
- **Preconditions:** ThrottlerGuard cấu hình 5 req/phút cho /public/*.
- **Steps:**
  1. Bắn 10 request/giây vào POST /public/attendance/token/:token từ cùng IP.
- **Assertions:**
  - 5 request đầu: 200 OK (hoặc 410 nếu token hết hạn).
  - Request thứ 6+: 429 Too Many Requests.
  - Server RAM/CPU ổn định, không bị DDoS chiếm resource.
- **Edge Cases:**
  - Đổi IP (dùng proxy) → mỗi IP có rate limit riêng.
  - API internal (/sessions, /orders) → rate limit cao hơn hoặc không limit.
________________________________________
## NHÓM 16: QUẢN TRỊ ĐỐI TÁC & MUA SẮM (AGENTS & PROCUREMENT)

### 16.1. Trả hoa hồng theo Hạng Đại lý (Agent Tiers)
- **Preconditions:** Đại lý A: Tier=GOLD, rate=15%. Đại lý B: Tier=SILVER, rate=10%. KH mua gói 2,000,000đ qua link Đại lý A.
- **Steps:**
  1. Sale POST /orders (totalAmount=2000000, agentId=A).
  2. Director approve order.
  3. GET /agents/:A/commissions.
- **Assertions:**
  - agentCommission = 2tr * 15% = 300,000đ.
  - Nếu cùng đơn đó qua Đại lý B → commission = 2tr * 10% = 200,000đ.
  - P&L: CAC (Cost of Acquisition) += commission tương ứng.
  - Dashboard: ROI per Agent hiển thị đúng.
- **Edge Cases:**
  - Agent không có tier config → commission = 0 (default) hoặc API trả lỗi.
  - Agent tự tạo order cho chính mình → policy check?

### 16.2. Chặn hoa hồng khi Đại lý bị Suspended
- **Preconditions:** Đại lý C status=SUSPENDED (vi phạm chính sách).
- **Steps:**
  1. Sale POST /orders (agentId=C, totalAmount=2000000).
- **Assertions:**
  - HTTP 400 "Agent is suspended" HOẶC order tạo thành công nhưng agentCommission = 0.
  - Financial Control: Không ghi nhận commission cho Agent C.
  - Dashboard: Agent C không xuất hiện trong commission report.
- **Edge Cases:**
  - Suspend agent SAU khi order đã approve → commission đã ghi nhận có bị clawback?
  - Reactivate agent → orders mới mới được tính commission, orders cũ giữ nguyên.

### 16.3. Luồng duyệt mua sắm (Supplier Procurement Flow)
- **Preconditions:** Nhân sự cần mua 10 bộ bàn ghế giá 50,000,000đ từ NCC ABC.
- **Steps:**
  1. POST /supplier-quotes (supplierId=ABC, items=[...], totalAmount=50000000). Status=DRAFT.
  2. Kế toán PATCH /supplier-quotes/:id/send. Status=SENT.
  3. NCC xác nhận → Kế toán PATCH /supplier-quotes/:id/accept. Status=ACCEPTED.
  4. POST /supplier-payments (quoteId=:id, amount=50000000). Status=DRAFT.
  5. Kế toán PATCH /supplier-payments/:id/approve. Status=APPROVED.
  6. Kế toán PATCH /supplier-payments/:id/mark-paid. Status=PAID.
- **Assertions:**
  - Trạng thái Quote: DRAFT → SENT → ACCEPTED. Không cho skip (DRAFT → ACCEPTED bị chặn).
  - Trạng thái Payment: DRAFT → APPROVED → PAID. Bắt buộc 2 lớp duyệt.
  - Financial Control: Cashflow outflow += 50tr CHỈ KHI payment = PAID.
  - P&L: opexCost += 50tr. Net Profit -= 50tr.
- **Edge Cases:**
  - Quote bị REJECTED → không tạo được Payment.
  - Payment amount > Quote amount → API chặn hoặc cảnh báo.
  - Partial payment (25tr / 50tr) → tracking remaining.
  - Xóa Quote đang SENT → chặn (bắt buộc REJECT trước).
  - 2 Payments cho 1 Quote (chia đợt thanh toán) → tổng không vượt quote amount.

### 16.4. Thu hồi hoa hồng khi KH refund (Commission Clawback)
- **Preconditions:** KH mua gói 2tr qua Đại lý A (GOLD 15%). Commission 300k đã ghi nhận. KH refund toàn bộ.
- **Steps:**
  1. Kế toán thực hiện full refund cho KH (Nhóm 6.3).
  2. GET /agents/:A/commissions.
- **Assertions:**
  - Commission clawback: -300k. Net commission Đại lý A giảm.
  - P&L: CAC giảm 300k (thu hồi chi phí thu hút).
  - Dashboard: Agent ROI cập nhật.
- **Edge Cases:**
  - Partial refund (1tr / 2tr) → commission clawback proportional: 150k?
  - Commission đã PAID cho Đại lý (chuyển khoản thực tế) → tạo khoản phải thu từ Đại lý.

________________________________________
## NHÓM 17: CẤU HÌNH LỚP HỌC PHỨC TẠP & LỊCH SỬ (ADVANCED CLASS CONFIG)

### 17.1. Cấu hình GV & Thời lượng riêng lẻ (Per-Student Configs)
- **Preconditions:** Lớp Nhóm 3 HS. HS_A: GV_1, 60p, 200k. HS_B: GV_2, 90p, 300k. HS_C: GV_1, 60p, 200k.
- **Steps:**
  1. OPS tạo 3 student-configs.
  2. Hệ thống sinh sessions.
  3. Finalize session.
- **Assertions:**
  - Session HS_A: amountCharged=200k, teacherPay theo GV_1 config.
  - Session HS_B: amountCharged=300k, teacherPay theo GV_2 config.
  - 2 PayrollTransactions tách riêng: GV_1 (cho HS_A + HS_C), GV_2 (cho HS_B).
  - P&L: COGS tính đúng từng GV, KHÔNG cào bằng cả lớp.
- **Edge Cases:**
  - HS_B vắng → chỉ tính payroll GV_1 (HS_A + HS_C). GV_2 payroll = 0 hoặc min?
  - Xóa student-config HS_B → sessions tương lai không sinh cho HS_B.

### 17.2. Pricing Snapshot (Đổi giá giữa chừng)
- **Preconditions:** Class giá 150k. Đã có 5 sessions FINALIZED (giá 150k). 5 sessions SCHEDULED.
- **Steps:**
  1. Ngày 10/03: Director PATCH /classes/:id (pricePerSession=200000).
  2. OPS finalize session ngày 11/03.
- **Assertions:**
  - 5 sessions FINALIZED trước ngày 10/03: amountCharged = 150k (bất biến).
  - Session 11/03: amountCharged = 200k (PricingSnapshot mới).
  - Dự phóng: Remaining sessions * 200k = projected revenue.
- **Edge Cases:**
  - Đổi giá 150k → 200k → 180k → mỗi session giữ đúng snapshot tại thời điểm.
  - Đổi giá lớp nhưng student-config có priceOverride → priceOverride ưu tiên.

### 17.3. Xin dạy thay khẩn cấp (Substitute Teacher)
- **Preconditions:** GV_1 dạy lớp X, bận ngày 15/03. GV_2 được giao dạy thay.
- **Steps:**
  1. OPS PATCH /sessions/:sessionId15Mar (teacherId=GV_2, isSubstitute=true).
  2. GV_2 điểm danh & nộp report ngày 15/03.
  3. OPS kiểm tra session ngày 16/03.
- **Assertions:**
  - Session 15/03: teacherId = GV_2. PayrollTransaction.teacherId = GV_2.
  - Session 16/03 trở đi: teacherId = GV_1 (tự động revert về GV gốc).
  - GV_1 KHÔNG có quyền điểm danh ngày 15/03 (bị chặn).
  - Payroll: GV_2 nhận lương session 15/03. GV_1 không nhận.
- **Edge Cases:**
  - GV_2 dạy thay 3 ngày liên tiếp → revert sau ngày cuối cùng.
  - GV_1 quay lại sớm (ngày 15/03 chiều) → đã giao GV_2 rồi, không cho thay lại trong ngày.

### 17.4. TẠO SESSION TỰ ĐỘNG THEO LỊCH (Auto Schedule) ← MỚI
- **Preconditions:** Class config: dayOfWeek=[2,4,6], time=14:00, duration=60, startDate=01/04, endDate=30/04.
- **Steps:**
  1. Hệ thống auto-generate sessions cho tháng 04.
- **Assertions:**
  - Sinh đúng số sessions: tất cả T2, T4, T6 trong tháng 04.
  - Mỗi session: date đúng, time=14:00, duration=60, status=SCHEDULED.
  - Không sinh session cho ngày lễ (nếu có holiday config).
- **Edge Cases:**
  - startDate là T3 → session đầu tiên = T4 gần nhất.
  - endDate giữa tuần → chỉ sinh đến endDate, không sinh thêm.

________________________________________
## NHÓM 18: TÍCH HỢP CHATBOT & HÀNG ĐỢI AI (WEBHOOKS & AI QUEUES)

### 18.1. Webhook Signature Mismatch (Tấn công giả mạo)
- **Preconditions:** Facebook Webhook secret = "abc123". Webhook endpoint hoạt động.
- **Steps:**
  1. POST /webhooks/facebook/:pageId với payload và X-Hub-Signature = "sha256=WRONG".
- **Assertions:**
  - HTTP 403 Forbidden.
  - Request KHÔNG được đẩy vào BullMQ Queue.
  - Log: "Invalid webhook signature from IP x.x.x.x".
  - DB: Không có message/conversation mới.
- **Edge Cases:**
  - Signature header missing → 403.
  - Payload rỗng + signature đúng → 200 nhưng không xử lý (empty body guard).
  - Correct signature → xử lý bình thường.

### 18.2. Rớt mạng Redis / BullMQ lỗi (Queue Fallback)
- **Preconditions:** Redis Server đang chạy. Chatbot đang hoạt động.
- **Steps:**
  1. Tắt Redis Server.
  2. Facebook gửi tin nhắn mới về Webhook.
- **Assertions:**
  - Hệ thống catch Redis connection error.
  - Chuyển sang Synchronous Fallback: xử lý tin nhắn trực tiếp (chậm nhưng không mất).
  - Tin nhắn được lưu vào DB (Conversations + Messages).
  - Khi Redis khôi phục → tự động chuyển lại Queue mode.
- **Edge Cases:**
  - Redis down + 100 tin nhắn cùng lúc → synchronous mode chậm, có bị timeout Facebook?
  - Redis down + OpenAI cũng down → lưu tin nhắn nhưng không auto-reply.

### 18.3. OpenAI Token Exhaustion (Auto-disable)
- **Preconditions:** OpenAI API key đang hoạt động. autoReplyEnabled = true.
- **Steps:**
  1. OpenAI trả 401 Unauthorized (key bị revoke).
- **Assertions:**
  - ChatbotSettings.autoReplyEnabled = false (tự vô hiệu).
  - Tin nhắn KH vẫn được lưu (không mất Lead).
  - Alert đỏ trên Dashboard: "OpenAI API key expired".
  - Không có crash loop (không retry liên tục gây 429).
- **Edge Cases:**
  - OpenAI 429 (rate limit) → retry 3 lần với backoff → vẫn 429 → disable.
  - Director update key mới → autoReply enable lại → test auto-reply hoạt động.

### 18.4. Quản lý Fanpage (Fanpage CRUD & Token Encryption)
- **Preconditions:** Director/Ads Manager thêm Fanpage mới.
- **Steps:**
  1. POST /chatbot/fanpages (pageId="123456", pageName="Trung tâm ABC", accessToken="EAA...xyz").
  2. GET /chatbot/fanpages.
- **Assertions:**
  - Fanpage tạo thành công. accessToken LƯU DẠNG MÃ HÓA AES-256-GCM trong DB.
  - GET response: accessToken = "••••••" (masked, KHÔNG trả plaintext).
  - Webhook tự đăng ký cho pageId "123456".
- **Edge Cases:**
  - accessToken hết hạn → status = EXPIRED, auto-reply dừng cho fanpage này.
  - Xóa Fanpage → unsubscribe webhook. Messages cũ giữ nguyên (soft reference).
  - 2 Fanpages cùng pageId → API trả 409 Conflict.

### 18.5. Cấu hình AI Assistant (AI Profile Tuning)
- **Preconditions:** Ads Manager muốn chỉnh AI chatbot.
- **Steps:**
  1. PATCH /chatbot/settings (systemPrompt="Bạn là tư vấn viên trung tâm ABC...", temperature=0.7, maxTokens=500).
  2. KH nhắn tin → AI reply.
- **Assertions:**
  - AI reply dựa trên systemPrompt mới (giới thiệu "trung tâm ABC").
  - Reply length ≤ maxTokens (500 tokens).
  - temperature=0.7 → câu trả lời có biến thể tự nhiên.
- **Edge Cases:**
  - temperature=0 → reply deterministic (cùng câu hỏi → cùng câu trả lời).
  - maxTokens=10 → reply bị cắt giữa câu? Hay AI tự dừng?
  - systemPrompt rỗng → AI dùng default prompt.

### 18.6. Conversation Ownership Resolution (Sale Assignment)
- **Preconditions:** KH nhắn tin qua Fanpage. KH này đã là Lead của Sale A.
- **Steps:**
  1. Webhook nhận tin nhắn → hệ thống findOrCreate Conversation.
  2. GET /conversations/:id.
- **Assertions:**
  - Conversation.assignedSaleId = Sale A (auto-resolve từ Lead/Parent ownership).
  - Sale A thấy conversation trong inbox. Sale B KHÔNG thấy.
- **Edge Cases:**
  - KH mới chưa là Lead → conversation unassigned hoặc assign theo round-robin.
  - KH là Lead của Sale A nhưng Order thuộc Sale B → dùng Lead owner hay Order owner?

________________________________________
## NHÓM 19: HỖ TRỢ KHÁCH HÀNG & ĐÓNG VÒNG (CLOSED-LOOP TICKETS)

### 19.1. Luồng xử lý Hoàn tiền qua Ticket (Refund Ticket Flow)
- **Preconditions:** PH A khiếu nại chất lượng. OPS tạo Ticket loại REFUND_REQUEST.
- **Steps:**
  1. POST /tickets (type=REFUND_REQUEST, parentId=A, description="PH phàn nàn chất lượng GV").
  2. Ticket chuyển sang Kế toán (assignTo=ACCOUNTING).
  3. Kế toán PATCH /wallets/:walletId/adjust (amount=+200000, reason="Hoàn 1 buổi", ticketId=:ticketId).
  4. Kế toán PATCH /tickets/:id/close.
- **Assertions:**
  - Ticket.status = CLOSED. Có reference trực tiếp: ticket.ledgerEntryId = LedgerEntry._id.
  - Wallet: ADJUSTMENT +200k. Balance tăng.
  - AuditLog: Ghi nhận refund + ticketId → truy vết được.
  - Financial Control: Outflow += 200k (tiền hoàn).
- **Edge Cases:**
  - Đóng ticket mà CHƯA thực hiện refund → status = CLOSED nhưng không có ledgerEntryId → cảnh báo.
  - Ticket REFUND nhưng adjust âm (nhầm) → audit log phải bắt.

### 19.2. Tạo Lead & Đơn từ Chatbot (CRM Auto-link)
- **Preconditions:** KH nhắn tin qua Fanpage. Chatbot tạo Conversation. Sale mở cửa sổ chat.
- **Steps:**
  1. Sale click "Tạo đơn hàng" từ Conversation view.
  2. Hệ thống tự điền SĐT + Tên KH từ conversation.
  3. Sale submit Order.
- **Assertions:**
  - Order.sourceConversationId = Conversation._id.
  - Order.source = "CHATBOT" hoặc kế thừa Platform attribution (FB/TikTok).
  - Lead: Nếu chưa tồn tại → tự tạo Lead mới gắn với Conversation.
  - Dashboard: ROI Marketing = Revenue từ Order / Ad cost liên quan.
- **Edge Cases:**
  - KH nhắn tin nhưng không để lại SĐT → Sale phải nhập tay, hệ thống không crash.
  - Conversation từ TikTok → Order.source = "TIKTOK".

### 19.3. TICKET OVERDUE ESCALATION ← MỚI
- **Preconditions:** Ticket đã OPEN > 48h. Cron quét mỗi 1h.
- **Steps:**
  1. Cron chạy: quét tickets WHERE status=OPEN AND createdAt < 48h ago.
- **Assertions:**
  - Ticket.priority tự động tăng (NORMAL → HIGH).
  - Notification gửi cho Manager/Director: "Ticket #123 overdue — cần xử lý gấp".
  - Dashboard: Danh sách "Overdue Tickets" highlight đỏ.
- **Edge Cases:**
  - Ticket vừa tạo (1h) → không bị escalate.
  - Ticket đã CLOSED → không bị quét lại.

________________________________________
## NHÓM 20: TẢI TRỌNG & BẢO TRÌ DỮ LIỆU CŨ (LOAD & BACKFILL)

### 20.1. Chạy Backfill Data (Bảo trì dữ liệu lớn)
- **Preconditions:** 50,000 Parents chưa có attribution source (dữ liệu cũ trước khi tích hợp marketing).
- **Steps:**
  1. POST /admin/backfill-parent-attribution (batchSize=1000).
- **Assertions:**
  - Job chạy nền (BullMQ), KHÔNG gây API timeout (504).
  - Xử lý 50 batch * 1000 = 50,000 records.
  - Response: { jobId: "...", status: "queued" }.
  - Sau khi hoàn thành: 50,000 parents có attributionSource populated.
  - Dashboard Marketing: Chỉ số lịch sử cập nhật (historical ROI).
- **Edge Cases:**
  - Chạy backfill 2 lần → lần 2 skip records đã có attribution (idempotent).
  - Backfill bị interrupt (server restart) → resume từ batch cuối?

### 20.2. Chống DDoS Public API (Rate Limiting Stress)
- **Preconditions:** ThrottlerGuard cấu hình: 5 req/phút cho /public/*, 100 req/phút cho /api/*.
- **Steps:**
  1. Dùng K6/JMeter bắn 100 req/giây vào /public/attendance/token/:token.
- **Assertions:**
  - Sau 5 request: ThrottlerGuard trả 429 Too Many Requests.
  - Server RAM < 512MB, CPU < 80% (không OOM).
  - Các API internal (/api/*) vẫn hoạt động bình thường (không bị ảnh hưởng bởi public traffic).
- **Edge Cases:**
  - 1000 req/giây → server vẫn sống, chỉ trả 429.
  - DDoS từ nhiều IP → per-IP throttling hoạt động.

### 20.3. Đối soát hàng đêm quy mô lớn (Nightly Reconciliation at Scale)
- **Preconditions:** 10,000 Sessions trong tháng. 10,000 PayrollTransactions tương ứng. 5 sessions bị missing payroll, 3 sessions có late-flag lệch.
- **Steps:**
  1. Cron 02:00 AM chạy reconciliation.
- **Assertions:**
  - Quét 10,000 sessions trong < 5 phút (performance).
  - Auto-heal 5 missing PayrollTx.
  - Auto-fix 3 late-flag discrepancies.
  - Report: { scanned: 10000, autoHealed: 5, autoFixed: 3, criticalAnomalies: 0 }.
  - Sáng hôm sau: P&L đã chính xác 100%.
- **Edge Cases:**
  - 100,000 sessions → job vẫn hoàn thành (có thể chậm hơn nhưng không crash).
  - Reconciliation phát hiện critical anomaly → KHÔNG auto-heal, chỉ alert.

### 20.4. DATABASE INDEX PERFORMANCE ← MỚI
- **Preconditions:** DB có 100,000 sessions, 50,000 ledger entries, 30,000 payroll transactions.
- **Steps:**
  1. GET /sessions?dateRange=2026-01-01..2026-03-31&status=FINALIZED.
  2. GET /financial-control/overview?month=2026-03.
  3. GET /wallets/:id/ledger?page=1&limit=50.
- **Assertions:**
  - Mỗi query response < 500ms (có index).
  - Explain plan: Sử dụng index, không COLLSCAN.
  - Dashboard load < 2 giây cho investor view.

________________________________________

# PHẦN III: NGHIỆP VỤ MỞ RỘNG & TÍCH HỢP (NHÓM 21–30)

________________________________________
## NHÓM 21: THÔNG BÁO ĐA KÊNH (MULTI-CHANNEL NOTIFICATIONS)
Module notifications chạy cron mỗi 2 phút, gửi Email/SMS/Zalo cho PH, GV, Sale.

### 21.1. Gửi thông báo khi duyệt hóa đơn (Invoice Notification)
- **Preconditions:** PH Nguyễn Văn A có SĐT 0901234567. Invoice 2tr vừa được APPROVED.
- **Steps:**
  1. Kế toán PATCH /invoices/:id/approve.
  2. Cron notification chạy (mỗi 2 phút).
- **Assertions:**
  - Notification record tạo: type=INVOICE_APPROVED, recipientId=PH_A.
  - PH nhận SMS/Zalo: "Học phí 2,000,000đ đã được ghi nhận. Số dư ví: 2,000,000đ."
  - Notification.status = SENT.
- **Edge Cases:**
  - SĐT sai format (09012345) → Notification.status = FAILED, reason="Invalid phone".
  - Zalo API lỗi 500 → retry 3 lần (cron tiếp theo). Không mất thông báo.

### 21.2. Thông báo nhắc học tự động (Session Reminder)
- **Preconditions:** Session ngày mai 14:00. PH A có con trong lớp.
- **Steps:**
  1. Cron notification quét sessions sắp diễn ra trong 24h.
- **Assertions:**
  - Notification: "Con bạn có lịch học ngày mai lúc 14:00 với GV Trần Văn B".
  - GV cũng nhận notification: "Bạn có lớp học ngày mai lúc 14:00".
- **Edge Cases:**
  - Session bị cancel trước khi cron chạy → KHÔNG gửi notification.
  - PH đã tắt nhận thông báo (optOut) → skip.

### 21.3. Gửi thông báo hàng loạt (Bulk Notification)
- **Preconditions:** Admin muốn gửi thông báo "Nghỉ Tết 01/01-05/01" cho 500 PH.
- **Steps:**
  1. POST /notifications/bulk (recipientIds=[500 PH], message="Nghỉ Tết...").
- **Assertions:**
  - 500 Notification records tạo ra, đẩy vào queue.
  - Cron xử lý hết trong ~5 phút (batch processing, không gửi cùng lúc 500).
  - Report: { sent: 495, failed: 5, errors: [...] }.
  - Server RAM ổn định, không OOM.
- **Edge Cases:**
  - 5,000 PH → processing time tăng nhưng không crash.
  - Duplicate bulk gửi 2 lần → PH có nhận 2 lần không? Cần dedup?

### 21.4. Phân quyền thông báo (Notification Isolation)
- **Preconditions:** PH A có Student X. PH B có Student Y.
- **Steps:**
  1. GET /notifications (login PH A).
- **Assertions:**
  - Chỉ thấy thông báo liên quan Student X. Không thấy thông báo Student Y.
  - Notification của Sale/OPS không hiển thị cho PH.

________________________________________
## NHÓM 22: QUẢN LÝ LEADS & CRM PIPELINE

### 22.1. Tạo Lead từ nhiều nguồn (Multi-source Lead Creation)
- **Preconditions:** Chưa có Lead nào với SĐT 0909876543.
- **Steps:**
  1. POST /leads (phone=0909876543, source=FACEBOOK, name="Nguyễn Thị C").
  2. GET /leads?phone=0909876543.
- **Assertions:**
  - Lead.status = NEW. source = FACEBOOK.
  - Lead.assignedSaleId = Sale theo cấu hình auto-assign (vùng/sản phẩm).
- **Edge Cases:**
  - Tạo Lead trùng SĐT từ Google → merge vào Lead cũ, thêm touchpoint.
  - SĐT rỗng hoặc invalid → API trả 400.

### 22.2. Lead hết hạn tự động (Auto-expire)
- **Preconditions:** Lead status=NEW, createdAt = 30 ngày trước. Cấu hình: expiryDays=30.
- **Steps:**
  1. Cron 01:00 AM chạy lead expiry.
- **Assertions:**
  - Lead.status = LOST (tự chuyển).
  - Notification cho Sale: "Lead Nguyễn Thị C đã hết hạn".
  - Dashboard: Pipeline count giảm 1.
- **Edge Cases:**
  - Lead status=CONTACTED (đã liên hệ) → KHÔNG expire (chỉ expire NEW).
  - Lead 29 ngày → chưa expire. Lead 31 ngày → expire.

### 22.3. Reassign Lead cho Sale khác
- **Preconditions:** Lead X assigned cho Sale A. Director muốn chuyển cho Sale B.
- **Steps:**
  1. PATCH /leads/:id (assignedSaleId=SaleB).
- **Assertions:**
  - Lead.assignedSaleId = SaleB.
  - Lịch sử follow-up vẫn giữ nguyên (không xóa notes cũ của Sale A).
  - Sale A không còn thấy Lead X khi GET /leads.
  - Sale B thấy Lead X.
- **Edge Cases:**
  - Reassign Lead đang CONVERTED → cho phép? Hay chặn?

### 22.4. Chuyển Lead thành Order (Conversion)
- **Preconditions:** Lead Z status=QUALIFIED. Sale tạo Order từ Lead.
- **Steps:**
  1. POST /orders (leadId=Z, totalAmount=2000000).
  2. GET /leads/:Z.
- **Assertions:**
  - Lead.status = CONVERTED. Lead.orderId = newly created Order._id.
  - Order.source = Lead.source (kế thừa attribution).
  - Dashboard: Conversion rate = CONVERTED / total leads.
- **Edge Cases:**
  - Tạo Order từ Lead đã LOST → API cho phép? Hay phải reopen Lead trước?
  - Tạo 2 Orders từ cùng 1 Lead → cho phép? Hay 1 Lead = 1 Order?

### 22.5. Nhắc nhở follow-up tự động (Follow-up Reminder Cron)
- **Preconditions:** Lead có lastContactedAt > 3 ngày trước. Cron chạy 08:00 AM weekdays.
- **Steps:**
  1. Cron 08:00 AM chạy.
- **Assertions:**
  - Sale nhận notification: "Lead Nguyễn Thị C chưa được liên hệ 3 ngày".
  - Chỉ gửi vào ngày làm việc (T2-T6), không gửi T7/CN.
- **Edge Cases:**
  - Sale có 50 leads quá hạn → nhận 50 notifications hay 1 summary?
  - Lead đã CONVERTED/LOST → KHÔNG nhắc.

________________________________________
## NHÓM 23: LANDING PAGE & FORM SUBMISSION

### 23.1. Submit form Landing Page → tạo Lead
- **Preconditions:** Landing Page LP1 đang active. UTM: source=google, medium=cpc, campaign=summer2026.
- **Steps:**
  1. POST /public/landing-pages/:LP1/submit (name="Trần Văn D", phone="0907654321", utm_source="google", utm_medium="cpc", utm_campaign="summer2026").
- **Assertions:**
  - Lead tạo mới: source=GOOGLE, phone=0907654321, name="Trần Văn D".
  - Lead.attribution = { source: "google", medium: "cpc", campaign: "summer2026" }.
  - Lead auto-assigned cho Sale (theo vùng/sản phẩm config).
  - HTTP 200 (public API, không cần auth).
- **Edge Cases:**
  - Landing Page INACTIVE → 404 hoặc 400.
  - Missing required fields (phone) → 400 validation error.

### 23.2. Submit trùng SĐT (Deduplication)
- **Preconditions:** PH "Nguyễn Thị B" SĐT 0901234567 đã tồn tại trong hệ thống (từ Chatbot Facebook).
- **Steps:**
  1. POST /public/landing-pages/:LP1/submit (phone="0901234567", utm_source="google").
- **Assertions:**
  - KHÔNG tạo Parent mới. Merge vào Parent cũ.
  - Lead: Thêm touchpoint mới {source: GOOGLE, channel: LANDING_PAGE}.
  - Attribution history giữ nguyên FIRST_TOUCH = FACEBOOK.
- **Edge Cases:**
  - SĐT khác nhưng cùng tên → tạo mới (key = SĐT, không phải tên).
  - SĐT cũ nhưng tên khác → update tên? Hay giữ tên cũ?

### 23.3. Chống spam form (Rate Limiting)
- **Preconditions:** /public/* có ThrottlerGuard 5 req/phút.
- **Steps:**
  1. Bot bắn 20 POST /public/landing-pages/:LP1/submit liên tục.
- **Assertions:**
  - 5 submissions đầu: 200 OK (tạo Lead thành công).
  - Submit thứ 6+: 429 Too Many Requests.
  - DB: Chỉ có 5 leads mới (không bị spam 20).
- **Edge Cases:**
  - Mỗi IP có rate limit riêng → 2 IP khác nhau, mỗi IP submit 5 = 10 leads.

________________________________________
## NHÓM 24: TIN NHẮN REAL-TIME & AI HỖ TRỢ (MESSAGES & WEBSOCKET)

### 24.1. PH gửi tin nhắn real-time (WebSocket Messaging)
- **Preconditions:** PH A login. Sale/OPS đang online (WebSocket connected).
- **Steps:**
  1. PH A gửi message: "Con tôi nghỉ học ngày mai".
- **Assertions:**
  - Message lưu vào DB: senderId=PH_A, content="Con tôi nghỉ học ngày mai".
  - Sale/OPS nhận tin nhắn real-time qua WebSocket (< 1 giây).
  - Conversation.lastMessageAt cập nhật.
- **Edge Cases:**
  - WebSocket disconnect → message vẫn lưu DB, Sale thấy khi reconnect.
  - Message rỗng → API trả 400.

### 24.2. AI Auto-suggest trả lời (AI Context from Student Data)
- **Preconditions:** PH A có con Student X. Student X đã học 15/20 buổi, balance 1,000,000đ.
- **Steps:**
  1. PH A hỏi: "Con tôi còn bao nhiêu buổi học?"
  2. Hệ thống gợi ý câu trả lời cho Sale/OPS.
- **Assertions:**
  - AI suggestion chứa context: "Student X còn 5 buổi, số dư 1,000,000đ".
  - Suggestion là suggestion (Sale chọn gửi hoặc sửa), KHÔNG auto-send cho PH.
  - Student data chỉ từ Student X, không mix data Student Y.
- **Edge Cases:**
  - Student data stale (snapshot > 1h) → auto-refresh trước khi suggest.
  - AI API lỗi → trả "Không có gợi ý" thay vì crash.

### 24.3. Data Isolation tin nhắn (Message Privacy)
- **Preconditions:** PH A có conversation C1. PH B có conversation C2.
- **Steps:**
  1. Login PH A → GET /conversations.
  2. PH A gọi GET /conversations/:C2 (conversation của PH B).
- **Assertions:**
  - GET /conversations: Chỉ thấy C1.
  - GET /conversations/:C2: 403 hoặc 404.
- **Edge Cases:**
  - Sale thấy conversations của TẤT CẢ PH mình quản lý.
  - OPS thấy TẤT CẢ conversations.

________________________________________
## NHÓM 25: QUẢN LÝ SẢN PHẨM & GÓI HỌC (PRODUCTS)

### 25.1. Tạo Product/Package (Product CRUD)
- **Preconditions:** Director tạo gói "Khóa Hè 20 buổi" giá 4,000,000đ.
- **Steps:**
  1. POST /products (name="Khóa Hè 20 buổi", price=4000000, sessions=20, status=ACTIVE).
- **Assertions:**
  - Product tạo thành công. status=ACTIVE.
  - Sale tạo Order chọn productId → totalAmount = 4,000,000đ.
- **Edge Cases:**
  - Price = 0 → cho phép (trial/free)? Hay chặn?
  - sessions = 0 → validation error.

### 25.2. Cập nhật giá Product (Price Change Isolation)
- **Preconditions:** Product "Khóa Hè" giá 4tr. Đã có 5 Orders sử dụng Product này (giá 4tr).
- **Steps:**
  1. PATCH /products/:id (price=5000000).
  2. Tạo Order mới từ Product.
- **Assertions:**
  - 5 Orders cũ: totalAmount = 4,000,000đ (giá cũ, bất biến).
  - Order mới: totalAmount = 5,000,000đ.
  - Product.price = 5,000,000đ.
- **Edge Cases:**
  - Giảm giá 4tr → 3tr → Orders cũ vẫn giữ 4tr (không refund tự động).

### 25.3. Ngưng bán Product (Deactivation)
- **Preconditions:** Product X status=ACTIVE. Có 3 HS đang học gói này.
- **Steps:**
  1. PATCH /products/:id (status=INACTIVE).
  2. Sale tạo Order mới với productId=X.
- **Assertions:**
  - API trả 400 "Product is inactive".
  - 3 HS đang học: KHÔNG bị ảnh hưởng (sessions đã sinh vẫn tiếp tục).
- **Edge Cases:**
  - Reactivate product → Sale lại tạo Order được.

________________________________________
## NHÓM 26: BÁO CÁO GIẢNG DẠY & TÀI LIỆU (TEACHING REPORTS & MATERIALS)

### 26.1. GV nộp báo cáo giảng dạy (Teaching Report Submission)
- **Preconditions:** Session đã FINALIZED. GV chưa nộp report.
- **Steps:**
  1. POST /teaching-reports (sessionId, studentProgress="Tốt", homework="Bài 5", notes="Cần ôn lại ngữ pháp").
- **Assertions:**
  - TeachingReport tạo: sessionId, teacherId, content.
  - PH nhận notification: "Báo cáo giảng dạy buổi 15/03 đã sẵn sàng".
  - PayrollTransaction: reportSubmitted = true.
- **Edge Cases:**
  - Nộp report cho session chưa FINALIZED → 400.
  - Nộp report 2 lần → 409 Conflict (unique constraint).
  - Nộp report sau 48h → lateHours ghi nhận, penalty áp dụng.

### 26.2. Sử dụng Report Template (Template Auto-fill)
- **Preconditions:** ReportTemplate "English 1-1" có fields: vocabulary, grammar, speaking, homework.
- **Steps:**
  1. GV POST /teaching-reports (sessionId, templateId=T1, vocabulary="Good", grammar="Needs work", ...).
- **Assertions:**
  - Report lưu theo structure template.
  - PH xem report: hiển thị đúng format template.
- **Edge Cases:**
  - Template bị xóa sau khi report đã tạo → report vẫn hiển thị (snapshot).
  - Template có field bắt buộc mà GV bỏ trống → 400 validation.

### 26.3. Upload tài liệu giảng dạy (Teaching Material + LLM Chunking)
- **Preconditions:** GV upload file PDF tài liệu 5MB.
- **Steps:**
  1. POST /teaching-materials (file=PDF, classId, title="Ngữ pháp Unit 5").
- **Assertions:**
  - File uploaded lên storage.
  - LLM Chunking: Chia nội dung thành chunks 900 ký tự, overlap 120 ký tự.
  - AI phân tích: Tạo summary + keywords cho tìm kiếm.
- **Edge Cases:**
  - File > 50MB → 400 "File quá lớn".
  - File không phải PDF/DOC → 400 "Định dạng không hỗ trợ".
  - LLM API lỗi → file vẫn lưu, chunking retry sau.

________________________________________
## NHÓM 27: XUẤT DỮ LIỆU & BÁO CÁO (EXPORT & REPORTS)

### 27.1. Export bảng lương CSV (Payroll Export)
- **Preconditions:** Tháng 03 có 50 GV với PayrollTransactions.
- **Steps:**
  1. GET /export/payroll?month=2026-03&format=csv.
- **Assertions:**
  - Response: CSV file download.
  - 50 rows + header. Columns: GV name, sessions, totalPay, latePenalty, netPay.
  - SUM(netPay) trong CSV = SUM trong DB (khớp 100%).
  - File encoding: UTF-8 BOM (hỗ trợ tiếng Việt trong Excel).
- **Edge Cases:**
  - Tháng chưa có payroll → CSV rỗng (chỉ header).
  - Filter thêm status=PAID → chỉ export GV đã nhận lương.

### 27.2. Export hóa đơn (Invoice Export)
- **Preconditions:** 200 invoices trong tháng 03. Filter: status=APPROVED.
- **Steps:**
  1. GET /export/invoices?month=2026-03&status=APPROVED&format=csv.
- **Assertions:**
  - CSV chứa các invoices APPROVED trong tháng 03.
  - Columns: PH name, amount, approvedAt, approvedBy, paymentMethod.
  - SUM(amount) khớp với Financial Control.totalInflow.
- **Edge Cases:**
  - Filter saleId → chỉ export invoices của Sale đó.
  - SHAREHOLDER role → export ẩn số ĐT PH (anonymization).

### 27.3. Export dữ liệu lớn (Large Export Streaming)
- **Preconditions:** 50,000 attendance records.
- **Steps:**
  1. GET /export/attendance?year=2026&format=csv.
- **Assertions:**
  - Response: Streaming download (Transfer-Encoding: chunked).
  - KHÔNG timeout (504). KHÔNG OOM server.
  - File hoàn chỉnh, 50,000 rows.
- **Edge Cases:**
  - Client disconnect giữa chừng → server cleanup, không leak memory.
  - Export 100,000 records → vẫn hoàn thành.

________________________________________
## NHÓM 28: QUẢN LÝ GIÁO VIÊN (TEACHER MANAGEMENT)

### 28.1. Thêm GV mới & Cấu hình lương (Teacher Onboarding)
- **Preconditions:** Director thêm GV mới "Trần Văn E".
- **Steps:**
  1. POST /teachers (name="Trần Văn E", phone="0908765432").
  2. POST /salary-config (teacherId=E, basePayPerSession=150000, latePenaltyRate=5000/hr).
- **Assertions:**
  - Teacher tạo: status=ACTIVE.
  - SalaryConfig tạo: áp dụng ngay cho các sessions sau.
  - GV chưa có lớp → không có payroll.
- **Edge Cases:**
  - Tạo GV không có salary config → có gán lớp được không? Kiểm tra validation.
  - Trùng SĐT với GV khác → cho phép hay chặn?

### 28.2. Thay đổi mức lương GV (Salary Config Update)
- **Preconditions:** GV E lương 150k/buổi. Đã có 5 sessions FINALIZED tháng 03.
- **Steps:**
  1. PATCH /salary-config/:id (basePayPerSession=180000, effectiveDate=2026-04-01).
- **Assertions:**
  - Sessions FINALIZED tháng 03: teacherPay = 150k (giữ nguyên).
  - Sessions từ 01/04: teacherPay = 180k.
  - Dashboard: Projected COGS tháng 04 tăng.
- **Edge Cases:**
  - effectiveDate trong quá khứ → áp dụng retroactive? Hay chặn?
  - Xóa salary config → GV bị block khỏi sessions?

### 28.3. GV nghỉ dài hạn (Teacher Deactivation)
- **Preconditions:** GV F status=ACTIVE. Đang dạy 3 lớp.
- **Steps:**
  1. PATCH /teachers/:F (status=INACTIVE, reason="Nghỉ thai sản").
- **Assertions:**
  - GV F KHÔNG thể điểm danh (API chặn).
  - Các lớp đang dạy: Cần reassign GV mới (OPS làm tay hoặc hệ thống cảnh báo).
  - Sessions tương lai: teacherId vẫn = GV_F (cần OPS cập nhật).
  - Notification OPS: "GV F đã INACTIVE — 3 lớp cần reassign".
- **Edge Cases:**
  - GV INACTIVE nhưng có payroll chưa PAID → vẫn PAID bình thường.
  - Reactivate GV → gán lại lớp cũ? Hay phải gán mới?

________________________________________
## NHÓM 29: QUẢN LÝ HỌC SINH & THEO DÕI TIẾN ĐỘ (STUDENT MANAGEMENT)

### 29.1. Đăng ký HS mới (Student Registration)
- **Preconditions:** PH Nguyễn Văn A đã có tài khoản. Thêm con "Nguyễn Bé X".
- **Steps:**
  1. POST /students (name="Nguyễn Bé X", parentId=A, grade="Lớp 3").
- **Assertions:**
  - Student tạo: parentId = A.
  - Wallet: PH A đã có wallet (dùng chung cho các con).
  - PH A login → GET /students → thấy "Nguyễn Bé X".
- **Edge Cases:**
  - PH có 3 con → 3 students, cùng walletId.
  - Student không có parentId → orphan student? Validation?

### 29.2. Chuyển HS từ Sale A sang Sale B (Student Reassignment)
- **Preconditions:** Student X managed by Sale A. Director muốn chuyển cho Sale B.
- **Steps:**
  1. PATCH /students/:X (managedBySaleId=SaleB).
- **Assertions:**
  - Sale A: GET /students → không thấy Student X.
  - Sale B: GET /students → thấy Student X.
  - Lịch sử follow-up, orders, invoices giữ nguyên.
- **Edge Cases:**
  - Chuyển student nhưng orders cũ vẫn thuộc Sale A (commission không đổi).

### 29.3. Báo cáo tiến độ học sinh (Student Progress Report)
- **Preconditions:** Student X đã học 15 buổi. Có 10 TeachingReports.
- **Steps:**
  1. GET /students/:X/progress-report.
- **Assertions:**
  - Report chứa: tổng buổi học, attendance rate, GV feedback summary.
  - PH A (parent of X) xem được. PH B KHÔNG xem được (403).
- **Edge Cases:**
  - Student chưa học buổi nào → report rỗng nhưng không crash.

### 29.4. HS CÓ NHIỀU PHỤ HUYNH ← MỚI
- **Preconditions:** Student Z có 2 PH: Bố (PH_1) và Mẹ (PH_2) — ly hôn, cả 2 muốn theo dõi.
- **Steps:**
  1. POST /students/:Z/parents (parentId=PH_2).
  2. Login PH_1 → GET /students.
  3. Login PH_2 → GET /students.
- **Assertions:**
  - Cả PH_1 và PH_2 đều thấy Student Z.
  - Cả 2 đều xem được attendance, reports, progress.
  - Wallet: Dùng wallet nào? PH_1 hay PH_2? Kiểm tra policy.
- **Edge Cases:**
  - PH_1 nạp tiền, PH_2 cũng nạp tiền → vào chung 1 wallet?
  - Xóa quyền PH_2 → PH_2 không còn thấy Student Z.

________________________________________
## NHÓM 30: CRON JOBS & ĐỘ TIN CẬY HỆ THỐNG (SCHEDULED TASKS & RELIABILITY)
Hệ thống có **12 cron jobs** chạy ở các lịch khác nhau. Đây là nhóm test đảm bảo tất cả đều hoạt động đúng.

### 30.1. Cron Notifications (Mỗi 2 phút)
- **Preconditions:** 10 notifications PENDING trong queue.
- **Steps:**
  1. Cron chạy.
- **Assertions:**
  - 10 notifications xử lý hết. Status = SENT hoặc FAILED (có reason).
  - Không bỏ sót notification nào.
  - Performance: Xử lý 10 trong < 30 giây.
- **Edge Cases:**
  - 1000 notifications pending → xử lý theo batch, không OOM.
  - Notification API (Zalo/SMS) down → status = FAILED, retry lần sau.

### 30.2. Cron Auto-confirm Sessions (Mỗi 1 giờ)
- **Preconditions:** Session đã TAUGHT > 24h. PH chưa confirm. Cấu hình: autoConfirmAfterHours=24.
- **Steps:**
  1. Cron chạy.
- **Assertions:**
  - Session.status = PARENT_CONFIRMED (auto).
  - confirmedBy = "SYSTEM" (không phải PH).
  - Wallet trừ tiền bình thường.
- **Edge Cases:**
  - Session TAUGHT 23h → chưa auto-confirm (chưa đủ 24h).
  - Session đã CANCELLED → skip.
  - PH đã confirm manually → skip (đã PARENT_CONFIRMED rồi).

### 30.3. Cron Leads Expiry (01:00 AM)
- **Preconditions:** 5 Leads status=NEW, createdAt > 30 ngày trước.
- **Steps:**
  1. Cron 01:00 AM chạy.
- **Assertions:**
  - 5 Leads → status = LOST.
  - Notification cho 5 Sales tương ứng.
  - Leads CONTACTED/QUALIFIED → KHÔNG bị expire.
- **Edge Cases:**
  - Lead vừa tròn 30 ngày (borderline) → kiểm tra >= hay >.

### 30.4. Cron Ads Sync (06:00 AM)
- **Preconditions:** FB/Google/TikTok API keys active. Có campaigns đang chạy.
- **Steps:**
  1. Cron 06:00 AM chạy sync.
- **Assertions:**
  - Ad spend synced: Facebook spend, Google spend, TikTok spend cập nhật đúng.
  - Financial Control: adCost = SUM(synced spend).
  - Dashboard: CAC, ROAS metrics refresh.
- **Edge Cases:**
  - FB API lỗi 401 (token expired) → sync skip FB, vẫn sync Google/TikTok. Alert "FB token expired".
  - Tất cả API lỗi → adCost giữ giá trị cũ, alert "All ad APIs failed".

### 30.5. Cron Wallet Reconciliation (02:00 AM)
- **Preconditions:** 1000 wallets. 2 wallets bị lệch (balance ≠ SUM(ledgerEntries)).
- **Steps:**
  1. Cron 02:00 AM chạy.
- **Assertions:**
  - Report: { scanned: 1000, discrepancies: 2, details: [{walletId, expected, actual, diff}] }.
  - KHÔNG auto-fix (wallet = tiền → manual review bắt buộc).
  - Alert gửi Kế toán: "2 wallets lệch số dư".
- **Edge Cases:**
  - 0 discrepancies → report vẫn gửi: "All wallets balanced".
  - 100 wallets lệch → performance: quét 1000 wallets < 2 phút.

### 30.6. Cron Tickets Overdue (Mỗi 1 giờ)
- **Preconditions:** Ticket #123 OPEN > 48h. Ticket #124 OPEN 2h.
- **Steps:**
  1. Cron chạy.
- **Assertions:**
  - Ticket #123: priority escalated (NORMAL → HIGH). Notification cho Manager.
  - Ticket #124: Không bị escalate (chưa quá hạn).
- **Edge Cases:**
  - Ticket đã CLOSED → skip.
  - Ticket HIGH > 72h → escalate CRITICAL?

### 30.7. Cron Retry Unpaid Sessions (Mỗi 2 giờ)
- **Preconditions:** 3 sessions FINALIZED nhưng isPaid=false (wallet deduction thất bại vì balance=0 lúc finalize). PH đã nạp tiền sau đó.
- **Steps:**
  1. Cron chạy mỗi 2h.
- **Assertions:**
  - Quét sessions WHERE status=FINALIZED AND isPaid=false.
  - PH đã nạp tiền → retry wallet deduction thành công → isPaid=true.
  - PH chưa nạp → vẫn isPaid=false → retry lần sau.
  - LedgerEntry: SESSION_DEDUCT mới tạo cho sessions thành công.
- **Edge Cases:**
  - Session 7 ngày tuổi vẫn isPaid=false → có giới hạn retry? Alert cho Sale đòi tiền?
  - Retry cùng lúc cron auto-confirm → không conflict.

### 30.8. Cron Backfill Invoice Consumption (Mỗi 6 giờ)
- **Preconditions:** Invoice gói 20 buổi, sessionsRemaining chưa cập nhật do bug cũ.
- **Steps:**
  1. Cron chạy mỗi 6h.
- **Assertions:**
  - Quét invoices → đếm sessions đã FINALIZED → cập nhật sessionsRemaining.
  - Invoice 20 buổi, đã học 8 → sessionsRemaining = 12.
  - Không tạo duplicate records.
- **Edge Cases:**
  - Invoice trả góp (3 invoices cho 1 gói) → sessionsRemaining tính trên tổng 3 invoices.
  - Tất cả invoices đã đúng → cron skip (idempotent).

### 30.9. Cron Auto-decide Orphan Trial Sessions (Mỗi 12 giờ)
- **Preconditions:** Trial session diễn ra 5 ngày trước, PH chưa thanh toán, chưa có quyết định convert/reject.
- **Steps:**
  1. Cron chạy mỗi 12h.
- **Assertions:**
  - Trial sessions quá hạn (> N ngày) → auto-reject: trialRejectedNoPay = true.
  - Session.status = CANCELLED hoặc đánh dấu unpaid.
  - Student vẫn ở TRIAL status (chưa promote).
  - Notification cho Sale: "Trial session #X auto-rejected — PH chưa thanh toán".
- **Edge Cases:**
  - Trial session 4 ngày (chưa quá hạn) → skip.
  - PH thanh toán ngay trước cron chạy → cron skip session đó.

### 30.10. Cron Late Teaching Report Reminder (Mỗi 1 giờ)
- **Preconditions:** Session FINALIZED > 24h trước. GV chưa nộp teaching report.
- **Steps:**
  1. Cron chạy mỗi 1h.
- **Assertions:**
  - Notification gửi GV: "Bạn chưa nộp báo cáo giảng dạy cho buổi ngày 01/04. Hãy nộp trước khi bị tính phạt trễ."
  - Cron không gửi lại nếu đã gửi notification cho session này (dedup).
- **Edge Cases:**
  - GV đã nộp report → skip (không gửi nhầm).
  - Session > 48h → lateHours đã ghi nhận, notification cảnh báo mức phạt.
  - GV có 5 sessions chưa nộp report → 5 notifications riêng biệt.

### 30.11. Nhiều Cron chạy đồng thời (Concurrency Safety)
- **Preconditions:** 02:00 AM: Reconciliation + Wallet Reconciliation chạy cùng lúc.
- **Steps:**
  1. Trigger cả 2 cron jobs đồng thời.
- **Assertions:**
  - Không deadlock. Không conflict trên cùng document.
  - Cả 2 reports hoàn thành chính xác.
  - MongoDB: Không có write conflict error.
- **Edge Cases:**
  - 3 cron cùng lúc (reconciliation + wallet reconciliation + session status fix) → tất cả pass.
  - Cron bị interrupt (server restart giữa chừng) → cron tiếp theo chạy lại clean.

________________________________________

# PHẦN IV: NGHIỆP VỤ NỀN TẢNG & BÁO CÁO TÀI CHÍNH (NHÓM 31–37)

________________________________________
## NHÓM 31: ĐĂNG NHẬP, BẢO MẬT & PHIÊN LÀM VIỆC (AUTH & LOGIN SECURITY)
Module `auth` là cổng bảo mật duy nhất của toàn hệ thống. Mọi lỗ hổng ở đây = mất toàn bộ dữ liệu.

### 31.1. Đăng nhập thành công (Standard Login)
- **Preconditions:** User "sale01" đã tạo, password đúng, status=ACTIVE.
- **Steps:**
  1. POST /auth/login (username="sale01", password="Abc@1234").
- **Assertions:**
  - HTTP 200. Response chứa JWT access token.
  - Cookie httpOnly được set (nếu dùng cookie-based auth).
  - XSRF token trả về trong header.
  - WorkSession: Ghi nhận login event (timestamp, IP, userAgent).
  - User.failedLoginAttempts reset = 0.
- **Edge Cases:**
  - Login từ 2 device cùng lúc → cả 2 đều có JWT riêng, cùng hoạt động.
  - Login với username viết HOA "SALE01" → hệ thống match case-insensitive?

### 31.2. Brute-force Lockout (Khóa tài khoản khi sai mật khẩu)
- **Preconditions:** User "sale01" status=ACTIVE. failedLoginAttempts = 0.
- **Steps:**
  1. POST /auth/login (password="SAI_1") → 401.
  2. POST /auth/login (password="SAI_2") → 401.
  3. POST /auth/login (password="SAI_3") → 401.
  4. POST /auth/login (password="SAI_4") → 401.
  5. POST /auth/login (password="SAI_5") → 401.
  6. POST /auth/login (password="Abc@1234" — mật khẩu ĐÚNG).
- **Assertions:**
  - Lần 1-5: HTTP 401 "Invalid credentials". failedLoginAttempts tăng dần 1→5.
  - Lần 5: User.status = LOCKED. lockedUntil = now + 30 phút.
  - Lần 6 (mật khẩu đúng): Vẫn 401 "Account locked. Try again after 30 minutes." (không cho vào).
  - AuditLog: 5 failed attempts + 1 locked event + 1 denied-while-locked event.
- **Edge Cases:**
  - 4 lần sai → lần 5 đúng → reset counter, cho vào (chưa đủ 5 lần sai liên tiếp).
  - Auto-unlock sau 30 phút → login lại thành công. failedLoginAttempts reset.
  - Admin unlock tay trước 30 phút → User.status = ACTIVE, cho login ngay.

### 31.3. Đổi mật khẩu (Change Password)
- **Preconditions:** User "sale01" đang login, mật khẩu hiện tại = "Abc@1234".
- **Steps:**
  1. POST /auth/change-password (currentPassword="Abc@1234", newPassword="NewP@ss789").
- **Assertions:**
  - HTTP 200. Password hash cập nhật trong DB.
  - Login với "Abc@1234" → 401. Login với "NewP@ss789" → 200.
  - AuditLog: "Password changed" + userId + timestamp.
- **Edge Cases:**
  - currentPassword sai → 400 "Current password incorrect".
  - newPassword = currentPassword → cho phép? Hay chặn "Password must be different"?
  - newPassword yếu ("123") → 400 validation (nếu có password policy).
  - Đổi password → JWT cũ vẫn hoạt động? Hay bị invalidate?

### 31.4. JWT Expiry & Refresh
- **Preconditions:** User login thành công, nhận JWT access token (expire 1h) + refresh token (expire 7d).
- **Steps:**
  1. Đợi JWT hết hạn (hoặc mock expired token).
  2. Gọi API bất kỳ với expired JWT → 401.
  3. POST /auth/refresh (refreshToken=...).
- **Assertions:**
  - Step 2: 401 "Token expired".
  - Step 3: 200 + JWT mới. API hoạt động lại.
  - Refresh token cũ bị invalidate sau khi dùng (one-time use).
- **Edge Cases:**
  - Refresh token cũng expired → 401 "Please login again".
  - Dùng refresh token 2 lần → lần 2 bị chặn (replay attack prevention).

________________________________________
## NHÓM 32: HỌC THỬ & CHUYỂN ĐỔI (TRIAL ENROLLMENTS)
Trial enrollment là đầu vào doanh thu — KH dùng thử trước khi mua gói. Module này quản lý vòng đời: Tạo → Ghi buổi thử → Convert thành Order/Invoice HOẶC Reject.

### 32.1. Tạo học thử (Create Trial Enrollment)
- **Preconditions:** PH muốn cho con thử 1 buổi. Sale tạo trial enrollment.
- **Steps:**
  1. POST /trial-enrollments (parentPhone="0901234567", studentName="Bé An", teacherId=GV_1, trialDate="2026-04-05", duration=60).
- **Assertions:**
  - TrialEnrollment tạo: status=PENDING.
  - Student auto-created: status=TRIAL (chưa phải OFFICIAL).
  - Parent findOrCreate: nếu SĐT đã tồn tại → gắn vào PH cũ, KHÔNG tạo mới.
  - Session trial được SCHEDULED cho ngày 05/04.
- **Edge Cases:**
  - PH đã có tài khoản (SĐT trùng) → gắn vào PH cũ + Student mới.
  - GV không available ngày 05/04 → 400 "Teacher not available" hoặc cảnh báo conflict.

### 32.2. Ghi nhận buổi học thử (Record Trial Session)
- **Preconditions:** Trial enrollment PENDING. Buổi thử ngày 05/04 đã diễn ra.
- **Steps:**
  1. GV điểm danh trial session.
  2. GV nộp teaching report cho trial session.
- **Assertions:**
  - TrialEnrollment.status = TRIAL_COMPLETED.
  - Session: status=FINALIZED nhưng isPaid=false (chưa thanh toán, là buổi thử).
  - Wallet PH: KHÔNG bị trừ tiền (buổi thử miễn phí).
  - PayrollTransaction: GV vẫn nhận lương (dạy thử vẫn trả lương GV).
- **Edge Cases:**
  - Buổi thử mà PH không đến → GV đánh ABSENT. TrialEnrollment.status = NO_SHOW.
  - GV quên điểm danh → cron auto-decide (30.9) xử lý sau N ngày.

### 32.3. Chuyển đổi thành học chính thức (Convert Trial → Order)
- **Preconditions:** TrialEnrollment.status = TRIAL_COMPLETED. PH đồng ý mua gói 10 buổi x 200k = 2tr.
- **Steps:**
  1. Sale POST /trial-enrollments/:id/convert (packageSessions=10, pricePerSession=200000).
- **Assertions:**
  - Order tự tạo: totalAmount=2,000,000đ. sourceType=TRIAL.
  - Invoice tự tạo: amount=2,000,000đ, status=PENDING (chờ PH thanh toán).
  - Student.status: TRIAL → OFFICIAL (auto-promote — maybePromoteStudentToOfficial).
  - TrialEnrollment.status = CONVERTED.
  - Class: Student được enroll vào class chính thức.
  - Dashboard: Conversion rate = CONVERTED / total trials.
- **Edge Cases:**
  - Convert trial mà PH đã OFFICIAL (đã có con học trước đó) → Student vẫn OFFICIAL.
  - Convert 2 lần → lần 2 trả 400 "Already converted".
  - Convert nhưng Director chưa approve Order → Wallet chưa nạp.

### 32.4. Từ chối học thử (Reject Trial)
- **Preconditions:** TrialEnrollment.status = TRIAL_COMPLETED. PH không muốn tiếp tục.
- **Steps:**
  1. Sale PATCH /trial-enrollments/:id/reject (reason="PH thấy đắt").
- **Assertions:**
  - TrialEnrollment.status = REJECTED.
  - Student.status vẫn = TRIAL (KHÔNG promote).
  - Lead: Ghi nhận lý do reject cho follow-up sau.
  - Không tạo Order/Invoice.
- **Edge Cases:**
  - Reject rồi muốn convert lại → có được không? Hay phải tạo trial mới?
  - Quản lý listing "students TRIAL chưa convert" → dashboard cho Sale.

________________________________________
## NHÓM 33: ĐIỂM DANH CHI TIẾT & TÍNH TIỀN THEO PHÚT (ATTENDANCE & PER-MINUTE BILLING)
Module attendance có logic tính tiền phức tạp: `resolveAmountCharged()` lấy giá từ invoice pricingSnapshot và tính pro-rata theo phút thực tế.

### 33.1. Tính tiền theo phút (Per-minute Rate Calculation)
- **Preconditions:** Invoice gói 10 buổi x 60p x 200k. PricingSnapshot: pricePerMinute = 200k/60 ≈ 3,333đ/phút.
  Session hôm nay: duration thực tế = 45 phút (GV dạy thiếu 15 phút).
- **Steps:**
  1. OPS finalize session (actualDuration=45).
- **Assertions:**
  - amountCharged = 45 * 3,333 ≈ 150,000đ (thay vì 200k full).
  - Wallet PH trừ 150k.
  - Invoice.sessionsRemaining: Quy đổi theo tiền, không theo số buổi cứng.
- **Edge Cases:**
  - Duration 60p → amountCharged = 200k (full price, trường hợp chuẩn).
  - Duration 90p (dạy thêm) → amountCharged = 300k? Hay cap ở 200k?
  - Duration 0p → amountCharged = 0 (GV không dạy, PH không trả).

### 33.2. Tính tiền từ Invoice PricingSnapshot (Snapshot Isolation)
- **Preconditions:** 
  - Invoice A (cũ): pricingSnapshot pricePerSession=150k (mua tháng 01).
  - Invoice B (mới): pricingSnapshot pricePerSession=200k (mua tháng 04 sau khi tăng giá).
  - PH có cả 2 invoices. Invoice A còn 3 buổi.
- **Steps:**
  1. Finalize session: hệ thống resolveAmountCharged.
- **Assertions:**
  - amountCharged = 150k (lấy từ Invoice A's pricingSnapshot vì Invoice A chưa hết buổi).
  - Sau khi hết Invoice A → session tiếp theo: amountCharged = 200k (từ Invoice B).
  - FIFO: Trừ Invoice cũ trước khi trừ Invoice mới.
- **Edge Cases:**
  - PH có invoice PENDING (chưa thanh toán) → không dùng invoice này để tính giá.
  - Tất cả invoices hết buổi → walletDeductError.

### 33.3. Recompute Offline Teacher Payout (Tính lại lương GV Offline)
- **Preconditions:** Lớp Offline: 5 HS đăng ký, giá 80k/HS. GV minPayout = 200k. 3 HS PRESENT.
- **Steps:**
  1. OPS submitAttendance → 3 PRESENT, 2 ABSENT.
  2. Hệ thống gọi recomputeOfflineTeacherPayoutForDay().
- **Assertions:**
  - Revenue = 3 * 80k = 240k.
  - teacherPay = MAX(240k, 200k) = 240k.
  - P&L: Gross Margin = 240k - 240k = 0đ (break-even).
- **Edge Cases:**
  - 1 HS PRESENT → Revenue = 80k, teacherPay = MAX(80k, 200k) = 200k → Loss = -120k.
  - Sửa HS từ PRESENT → ABSENT sau finalize → recompute lại → refund HS + adjustPay GV.

### 33.4. Link điểm danh tự chụp ảnh (Self-attendance Public Flow)
- **Preconditions:** OPS tạo link điểm danh cho session: POST /attendance/generate-link.
- **Steps:**
  1. HS nhận link → mở trên điện thoại.
  2. GET /public/attendance/token/:token → hiện form selfie.
  3. POST /public/attendance/submit (token, photo=base64, location=GPS).
- **Assertions:**
  - Attendance record tạo: status=PRESENT, selfieUrl=uploaded, location=GPS.
  - Token single-use: click lần 2 → 400 "Already submitted".
  - Photo upload lên storage (S3/local).
- **Edge Cases:**
  - Token expired (>24h) → 410 Gone.
  - GPS quá xa trung tâm (>5km) → cảnh báo cho OPS (possible fraud).
  - Không có camera → có cho submit không photo?

________________________________________
## NHÓM 34: CHẤM CÔNG GIÁO VIÊN (WORK SESSIONS — TEACHER TIMEKEEPING)
Module work-sessions ghi nhận giờ làm việc của GV: login/logout, phát hiện đi trễ, auto-close session quên logout.

### 34.1. GV Login chấm công (Record Login)
- **Preconditions:** GV E có salaryConfig.scheduledStartTime = 08:00. Hiện tại 08:00 AM.
- **Steps:**
  1. POST /work-sessions/login (hoặc tự động ghi khi GV login ứng dụng).
- **Assertions:**
  - WorkSession tạo: loginTime = 08:00, status = ACTIVE.
  - isLate = false (đúng giờ).
  - Dashboard OPS: GV E hiện "Đang hoạt động".
- **Edge Cases:**
  - GV login lúc 08:15 → isLate = true, lateMinutes = 15.
  - GV login lúc 07:45 (sớm 15p) → isLate = false. earlyMinutes = 15.
  - GV login 2 lần liên tiếp (quên logout lần trước) → lần 2 auto-close lần 1?

### 34.2. GV Logout chấm công (End Work Session)
- **Preconditions:** WorkSession ACTIVE, loginTime = 08:00.
- **Steps:**
  1. POST /work-sessions/logout lúc 17:00.
- **Assertions:**
  - WorkSession: logoutTime = 17:00, totalHours = 9h, status = COMPLETED.
  - Monthly summary: totalWorkHours += 9h.
- **Edge Cases:**
  - Logout trước giờ quy định (15:00) → earlyLeave = true, earlyMinutes = 120.
  - Logout lúc 23:00 (12h liên tục) → có cap maxHours?

### 34.3. Auto-close Stale Sessions (Quên logout)
- **Preconditions:** GV F login lúc 08:00. Đến 23:59 vẫn ACTIVE (quên logout).
- **Steps:**
  1. Hệ thống check mỗi ngày lúc 00:00 (hoặc batch).
- **Assertions:**
  - WorkSession auto-closed: logoutTime = 18:00 (giờ kết thúc mặc định), status = AUTO_CLOSED.
  - totalHours = 10h (08:00 → 18:00, không tính 08:00 → 23:59).
  - Alert cho OPS: "GV F quên logout — work session auto-closed".
- **Edge Cases:**
  - GV dạy ca tối (18:00 → 21:00) → auto-close lúc nào? Config theo ca.
  - Auto-close 2 ngày liên tiếp → pattern: GV hay quên → cảnh báo Director.

### 34.4. Monthly Summary cho Payroll
- **Preconditions:** GV E có 22 work sessions trong tháng 03.
- **Steps:**
  1. GET /work-sessions/monthly-summary?teacherId=E&month=2026-03.
- **Assertions:**
  - totalWorkDays = 22. totalWorkHours = 180h. lateDays = 3. lateMinutes total = 45p.
  - Tích hợp vào Payroll: salary deduction cho late nếu có policy.
  - Dashboard: KPI giáo viên hiển thị attendance rate.
- **Edge Cases:**
  - GV không login ngày nào → totalWorkDays = 0.
  - Weekends (T7/CN) → nếu GV login vẫn tính? Tùy policy.

________________________________________
## NHÓM 35: BÁO CÁO TÀI CHÍNH CHI TIẾT (FINANCIAL CONTROL — P&L, BALANCE SHEET, TAX)
Module financial-control là trái tim tài chính: ~40 endpoints, phục vụ Director/Cổ đông/Kế toán. Nhóm 1-10 đã test tác động lên Financial Control gián tiếp qua assertions, nhóm này test trực tiếp các API báo cáo.

### 35.1. Báo cáo Lãi/Lỗ (P&L — Cash vs Accrual)
- **Preconditions:** Tháng 03:
  - Cash inflow: 10 invoices APPROVED = 20,000,000đ.
  - Sessions FINALIZED: 80 sessions = 16,000,000đ revenue (accrual).
  - COGS: teacher cost = 8,000,000đ.
  - OPEX: staff payroll 5tr + ads 3tr + expenses 2tr = 10,000,000đ.
- **Steps:**
  1. GET /financial-control/pnl?month=2026-03&basis=CASH.
  2. GET /financial-control/pnl?month=2026-03&basis=ACCRUAL.
- **Assertions:**
  - CASH basis: Revenue = 20tr (tiền thực thu). COGS = 8tr. OPEX = 10tr. Net Profit = 2tr.
  - ACCRUAL basis: Revenue = 16tr (doanh thu ghi nhận từ sessions). COGS = 8tr. OPEX = 10tr. Net Profit = -2tr (lỗ!).
  - Chênh lệch CASH vs ACCRUAL = 4tr (tiền đã thu nhưng chưa ghi nhận doanh thu).
- **Edge Cases:**
  - Tháng không có session → ACCRUAL Revenue = 0 nhưng CASH Revenue có thể > 0.
  - Cross-month: Invoice thu tháng 02, sessions học tháng 03 → ghi nhận đúng tháng.

### 35.2. Bảng cân đối kế toán (Balance Sheet)
- **Preconditions:** Tháng 03: Total wallets balance = 5,000,000đ (dư ví PH chưa học). Loan outstanding = 100,000,000đ. Bank cash = 50,000,000đ.
- **Steps:**
  1. GET /financial-control/balance-sheet?date=2026-03-31.
- **Assertions:**
  - Assets: Bank cash 50tr + Receivables (if any).
  - Liabilities: Wallet obligations 5tr (nợ PH) + Loan 100tr.
  - Equity = Assets - Liabilities.
  - Balance Sheet phải cân: Assets = Liabilities + Equity.
- **Edge Cases:**
  - Wallet obligations = SUM(all wallet balances) → phải khớp.
  - Loan partial payment → Liabilities giảm tương ứng.

### 35.3. Báo cáo thuế (Tax Report)
- **Preconditions:** Năm 2025: Tổng doanh thu accrual = 2,000,000,000đ. Tổng chi phí = 1,500,000,000đ. Thuế suất = 20%.
- **Steps:**
  1. GET /financial-control/tax-report?year=2025.
- **Assertions:**
  - Taxable income = 2 tỷ - 1.5 tỷ = 500,000,000đ.
  - Tax payable = 500tr * 20% = 100,000,000đ.
  - After-tax profit = 400,000,000đ.
- **Edge Cases:**
  - Doanh thu < chi phí (lỗ) → tax = 0, carry forward loss.
  - Chi phí không hợp lệ (non-deductible) → loại khỏi taxable income.

### 35.4. Investor Metrics (LTV, Burn Rate, Retention)
- **Preconditions:** Company hoạt động 12 tháng. 500 students. Churn rate 10%/tháng. Monthly burn = 50tr.
- **Steps:**
  1. GET /financial-control/investor-metrics?months=12.
- **Assertions:**
  - LTV (Lifetime Value) = Average Revenue per Student / Churn Rate.
  - Burn Rate = 50tr/tháng.
  - Runway = Cash on hand / Burn Rate = N tháng.
  - Retention Rate = 90% (100% - 10% churn).
  - MRR (Monthly Recurring Revenue) = total monthly tuition collected.
- **Edge Cases:**
  - Churn rate = 0% → LTV = infinity. UI hiên "∞" hoặc cap.
  - Mới hoạt động 1 tháng → metrics không đủ data → hiển thị "N/A" hoặc projected.

### 35.5. Aging Report (Công nợ PH theo tuổi)
- **Preconditions:** 
  - PH A: nợ 500k, quá hạn 15 ngày (bucket: 1-30 ngày).
  - PH B: nợ 2tr, quá hạn 45 ngày (bucket: 31-60 ngày).
  - PH C: nợ 300k, quá hạn 100 ngày (bucket: 90+ ngày).
- **Steps:**
  1. GET /financial-control/aging-report.
- **Assertions:**
  - Bucket 1-30 ngày: 1 PH, total 500k.
  - Bucket 31-60 ngày: 1 PH, total 2tr.
  - Bucket 90+ ngày: 1 PH, total 300k.
  - Total outstanding = 2,800,000đ.
  - Dashboard: Highlight PH C là "Critical — cần xử lý gấp".
- **Edge Cases:**
  - PH nạp tiền trả nợ → xuất khỏi aging report.
  - PH D balance = -50k (nợ nhẹ) nhưng chưa quá hạn → chưa vào report.

### 35.6. Đối soát ngân hàng (Bank Transaction Reconciliation)
- **Preconditions:** Bank statement tháng 03: 15 giao dịch. Hệ thống ghi nhận 14 invoices APPROVED.
- **Steps:**
  1. POST /financial-control/reconcile-bank (bankTransactions=[15 items]).
- **Assertions:**
  - Matched: 14 transactions (khớp invoice).
  - Unmatched: 1 transaction (tiền vào bank nhưng không có invoice tương ứng).
  - Report: { matched: 14, unmatched: 1, unmatchedDetails: [{amount, date, description}] }.
  - Alert: "1 giao dịch ngân hàng chưa khớp — cần kiểm tra".
- **Edge Cases:**
  - Số tiền bank ≠ invoice amount (chênh 10đ do bank fee) → fuzzy match?
  - 2 invoices cùng amount, cùng ngày → match invoice nào?

________________________________________
## NHÓM 36: DASHBOARD THEO ROLE (ROLE-SPECIFIC DASHBOARDS)
Hệ thống có 8 dashboards khác nhau. Mỗi role chỉ thấy dữ liệu phù hợp.

### 36.1. Director Dashboard
- **Preconditions:** User role=DIRECTOR.
- **Steps:**
  1. GET /dashboard/director.
- **Assertions:**
  - Hiển thị: P&L tháng, Cash flow, Student count, Teacher count, Top performing Sales.
  - Có alerts: Low balance wallets, Overdue tickets, Critical anomalies.
  - Revenue trend: 3/6/12 tháng.
  - Có thể drill-down vào từng metric.
- **Edge Cases:**
  - Tháng đầu tiên (no data) → hiện 0s, không crash.
  - Nhiều cơ sở (nếu multi-branch) → filter theo branch.

### 36.2. Sale Dashboard
- **Preconditions:** Sale A có 20 leads, 15 orders, 10 students.
- **Steps:**
  1. Login Sale A → GET /dashboard/sale.
- **Assertions:**
  - Chỉ thấy dữ liệu CỦA MÌNH: 20 leads, 15 orders, 10 students.
  - KHÔNG thấy data của Sale B.
  - KPIs: conversion rate, commission earned, pipeline value.
  - Daily tasks: Follow-up reminders, pending orders.
- **Edge Cases:**
  - Sale mới (0 data) → dashboard vẫn render, hiện "Chưa có dữ liệu".
  - Sale bị INACTIVE → vẫn xem được dashboard? Hay bị chặn login?

### 36.3. Parent Dashboard
- **Preconditions:** PH A có 2 con (Student X, Y). Wallet balance = 1,500,000đ.
- **Steps:**
  1. Login PH A → GET /dashboard/parent.
- **Assertions:**
  - Thấy: 2 students, wallet balance, upcoming sessions, recent teaching reports.
  - Chỉ thấy data Student X và Y. KHÔNG thấy Student Z (con PH B).
  - Không thấy financial control, P&L, staff payroll (không liên quan).
- **Edge Cases:**
  - PH có 0 students (mới tạo tài khoản) → "Chưa có học sinh đăng ký".

### 36.4. Teacher Dashboard
- **Preconditions:** GV E dạy 3 lớp, 15 students.
- **Steps:**
  1. Login GV E → GET /dashboard/teacher.
- **Assertions:**
  - Thấy: Lịch dạy hôm nay, danh sách lớp, pending reports, payroll summary.
  - KHÔNG thấy: Wallet PH, revenue, P&L, staff payroll.
  - Pending reports: Danh sách sessions chưa nộp báo cáo.
- **Edge Cases:**
  - GV có 0 lớp (mới tạo) → "Chưa được gán lớp".

### 36.5. Accounting Dashboard
- **Preconditions:** Kế toán, tháng 03.
- **Steps:**
  1. Login Kế toán → GET /dashboard/accounting.
- **Assertions:**
  - Thấy: Pending invoices, payroll for approval, expenses, supplier payments, bank reconciliation.
  - Daily tasks: "5 invoices chờ duyệt", "3 payrolls chờ approve".
  - Không thấy: Sales pipeline, leads (không phải việc kế toán).

### 36.6. Investor/Shareholder Dashboard
- **Preconditions:** User role=SHAREHOLDER.
- **Steps:**
  1. Login Shareholder → GET /dashboard/investor.
- **Assertions:**
  - READ-ONLY: Không có nút POST/PATCH/DELETE nào.
  - Hiển thị: P&L summary, Cash position, Debt position, Revenue trend, Burn rate.
  - Data anonymization: Ẩn SĐT PH, ẩn mật khẩu, ẩn chi tiết cá nhân.
  - API: Mọi POST/PATCH/DELETE → 403 Forbidden.
- **Edge Cases:**
  - Shareholder cố gọi PATCH /orders/:id/approve → 403.
  - monthCount=3 vs 6 vs 12 → trend data chính xác.

________________________________________
## NHÓM 37: PENDING APPROVALS & USERS (HUB DUYỆT & QUẢN TRỊ NGƯỜI DÙNG)

### 37.1. Hub duyệt tổng hợp (Pending Approvals Dashboard)
- **Preconditions:** 3 invoices chờ duyệt, 2 payrolls chờ approve, 1 teacher profile chờ review, 1 session change request.
- **Steps:**
  1. Login Director → GET /pending-approvals.
- **Assertions:**
  - Response tổng hợp: { invoices: 3, payrolls: 2, teachers: 1, sessionChanges: 1, total: 7 }.
  - Mỗi category có link drill-down.
  - Badge trên navigation: "7" pending.
- **Edge Cases:**
  - 0 pending → hiện "Không có gì cần duyệt".
  - OPS login → chỉ thấy pending approvals thuộc quyền OPS (không thấy payroll/invoice).

### 37.2. Tạo User mới & phân quyền (User CRUD)
- **Preconditions:** Director tạo user mới role=SALE.
- **Steps:**
  1. POST /users (name="Nguyễn Sale C", phone="0907777888", role=SALE, password="temp@123").
- **Assertions:**
  - User tạo: status=ACTIVE, role=SALE.
  - Login với credentials → thành công, chỉ thấy data theo role SALE.
  - AuditLog: "User created" + createdBy=Director.
- **Edge Cases:**
  - Tạo user trùng phone → 409 Conflict.
  - Tạo user role=DIRECTOR → chỉ DIRECTOR hiện tại mới được? Hay ADMIN?
  - Tạo user không có phone → validation error.

### 37.3. Parent auto-creation từ Order (Auto User Provisioning)
- **Preconditions:** Sale tạo Order cho PH mới (chưa có tài khoản). Nhập SĐT 0901111222.
- **Steps:**
  1. POST /orders (parentPhone="0901111222", parentName="Lê Văn F", ...).
- **Assertions:**
  - User tạo tự động: role=PARENT, phone="0901111222", status=ACTIVE.
  - Wallet tạo tự động: balance = 0.
  - Password: auto-generated (gửi qua SMS) hoặc set default.
  - Login PH F → thấy dashboard parent, thấy order.
- **Edge Cases:**
  - SĐT đã tồn tại (PH cũ) → gắn order vào PH cũ, KHÔNG tạo user mới.
  - SĐT đã tồn tại nhưng role=SALE (nhân viên) → conflict xử lý thế nào?

### 37.4. Cập nhật quyền sở hữu Sale-Parent (Sale Ownership Sync)
- **Preconditions:** PH A thuộc Sale X. Director chuyển PH A sang Sale Y.
- **Steps:**
  1. PATCH /users/:PH_A (managedBySaleId=SaleY).
- **Assertions:**
  - Sale X: GET /users?role=PARENT → không thấy PH A.
  - Sale Y: GET /users?role=PARENT → thấy PH A.
  - Orders cũ: saleId vẫn = Sale X (lịch sử commission không đổi).
  - Orders mới: saleId = Sale Y.
- **Edge Cases:**
  - Chuyển PH có 3 students → tất cả students cũng sang Sale Y.
  - Sale X vẫn thấy orders cũ của PH A trong commission report.

________________________________________

# PHỤ LỤC A: TEST THEO MODULE (MODULE CHECKLIST)
Mục tiêu của phụ lục này là bổ sung góc nhìn theo module để đội dev/QA biết:
- Module nào đã có regression xanh.
- Module nào có test nhưng đang lệ thuộc fixture demo.
- Module nào chưa có suite riêng và cần ưu tiên bổ sung.

Ký hiệu:
- GREEN: Có regression hoặc workflow test đã chạy pass ổn định.
- FIXTURE: Có test nhưng đang phụ thuộc dữ liệu demo hoặc dễ fail giả.
- MISSING: Chưa có suite riêng hoặc chưa chứng minh được E2E đầy đủ.

1. AUTH / USERS / RBAC / AUDIT
- Regression hiện có: test:rbac-finance-guards, test:audit-log-workflow, test:financial-control-workflow.
- GREEN:
  - Login cookie + XSRF hoạt động.
  - Guard chặn OPS/SALE/PARENT ở các API tài chính nhạy cảm.
  - Audit log cơ bản cho workflow tài chính đã có coverage.
- Bổ sung bắt buộc:
  - SHAREHOLDER chỉ được GET, không được POST/PATCH/DELETE trên toàn bộ finance surface.
  - Sale A không xem được đơn/lead/doanh thu của Sale B.
  - Parent A không xem được attendance/report/student của Parent B.
  - Audit log immutable cho wallet adjust âm, rollback invoice, payroll approve/exclude.
- Trạng thái: GREEN phần guard cơ bản, MISSING phần isolation sâu và immutable audit.

2. ORDERS
- Regression hiện có: test:commission-report-workflow, một phần trong test:e2e-ad-to-revenue.
- GREEN:
  - Tạo order, báo cáo commission, kiểm tra finalAmount / saleCommission.
- Bổ sung bắt buộc:
  - Approve order có receipt bắt buộc với chuyển khoản.
  - DiscountAmount và finalAmount không lệch totalAmount.
  - Order installment sinh đúng các payment frame.
  - Order zero-amount / trial không phát sinh cash inflow giả.
- Trạng thái: GREEN phần commission report, MISSING phần approve-order to invoice theo flow hiện tại.

3. INVOICES
- Regression hiện có: test:invoices-workflow.
- GREEN:
  - Approve invoice -> wallet top-up.
  - Pending list, delete guard, amount/finalAmount đi đúng vào wallet.
- Bổ sung bắt buộc:
  - Installment: duyệt invoice 1 không ảnh hưởng invoice 2.
  - Cancel/rollback invoice đã APPROVED.
  - Double-approve idempotency.
  - Invoice zero-amount không sinh top-up ảo.
- Trạng thái: GREEN phần approve cơ bản, MISSING rollback/cancel.

4. WALLETS
- Regression hiện có: test:wallet-topup-workflow, một phần trong test:sessions-workflow.
- GREEN:
  - Top-up request -> approve/reject.
  - Ledger TOP_UP / SESSION_DEDUCT hoạt động.
  - Adjust có coverage gián tiếp trong sessions workflow.
- Bổ sung bắt buộc:
  - Transfer A -> B với TRANSFER_OUT / TRANSFER_IN.
  - Adjust âm và audit reason bắt buộc.
  - Debt-limit boundary: vừa chạm ngưỡng, vượt ngưỡng 1 đồng.
  - Rollback top-up khi cancel invoice.
- Trạng thái: GREEN phần top-up, MISSING transfer và rollback chuyên biệt.

5. SESSIONS
- Regression hiện có: test:sessions-workflow, test:attendance-payroll-financial-control.
- GREEN:
  - FINALIZED -> SESSION_DEDUCT.
  - Wallet giảm đúng amountCharged.
  - Teacher cost và revenue lan xuống financial-control.
- Bổ sung bắt buộc:
  - Paid session cancel -> REFUND -> revenue reversal.
  - WalletDeductError -> top-up recovery -> retry settle.
  - Parent dissatisfaction -> HELD salary -> release approve/exclude.
  - Double submit / double finalize idempotency.
- Trạng thái: GREEN phần finalize cơ bản, MISSING refund/recovery/complaint E2E.

6. ATTENDANCE
- Regression hiện có: test:attendance-workflow, test:class-attendance-pricing-workflow, test:attendance-report-workflow.
- FIXTURE:
  - Các suite attendance hiện có nhưng local demo data dễ cạn "buổi còn lại".
- Bổ sung bắt buộc:
  - Bulk attendance cho lớp offline.
  - Auto-assign ABSENT cho học sinh không được tick.
  - Late/excused/absent không bị trừ ví sai.
  - Attendance public link expiry và rate limit.
- Trạng thái: FIXTURE.

7. CLASSES
- Regression hiện có: test:class-attendance-pricing-workflow, test:financial-control-costs.
- FIXTURE:
  - Pricing theo duration và pricing snapshot đã có test nhưng chưa bền.
- Bổ sung bắt buộc:
  - PricingSnapshot không hồi tố session cũ.
  - Đổi teacher có payout cao hơn chỉ ảnh hưởng COGS, không đổi tuition.
  - Session Change 60p -> 90p chỉ áp dụng từ thời điểm duyệt thay đổi.
  - Offline minimum payout guarantee.
- Trạng thái: FIXTURE.

8. STUDENTS
- Regression hiện có: test:student-report-workflow, test:comprehensive-report-workflow.
- GREEN:
  - Báo cáo học sinh và comprehensive report có workflow riêng.
- Bổ sung bắt buộc:
  - Parent-child ownership guard.
  - Student config nhiều teacher / nhiều slot.
  - Trial to paid conversion và consume ví đúng cách.
- Trạng thái: GREEN phần report, MISSING phần student-config economics.

9. PAYROLL (TEACHER PAYROLL TRANSACTION)
- Regression hiện có: test:attendance-payroll-financial-control, test:teacher-payroll-ops-scenarios, unit spec payroll-transaction.
- GREEN:
  - Late penalty formula ở mức unit/spec.
  - Payroll impact sang financial-control đã pass.
- Bổ sung bắt buộc:
  - HELD -> APPROVED / EXCLUDED E2E.
  - Exclude đã trả tiền thì phải bị chặn.
  - Missing PayrollTx auto-heal từ Session.
  - Late-flag discrepancy auto-fix.
- Trạng thái: GREEN phần aggregate, FIXTURE phần ops scenario, MISSING auto-heal E2E.

10. STAFF PAYROLL / SALARY CONFIG
- Regression hiện có: test:staff-payroll-workflow, test:salary-config-workflow, test:financial-control-payroll-recalculation.
- GREEN:
  - Salary config, commission tier, payroll generate/update/markPaid.
  - PayrollCost lan sang cash-flow và P&L.
- Bổ sung bắt buộc:
  - Bulk generate payroll partial success 49/50.
  - Sales payroll theo realized revenue cuối tháng.
  - Hoa hồng lũy tiến nhiều tier.
- Trạng thái: GREEN.

11. FINANCIAL-CONTROL
- Regression hiện có: test:financial-control-workflow, test:financial-control-costs, test:expenses-financial-control-recalculation, test:ads-financial-control-recalculation, test:financial-control-payroll-recalculation, test:financial-control-loans.
- GREEN:
  - Dashboard, overview, alerts, P&L, cash-flow, obligations, debtPosition.
  - Expense / ad / payroll / loan recalculation đều có coverage xanh.
- Bổ sung bắt buộc:
  - Investor metrics sau mỗi source event.
  - Bank reconciliation mismatch.
  - Basis cash vs accrual đối chiếu cùng kỳ.
- Trạng thái: GREEN.

12. DASHBOARD / INVESTOR DASHBOARD
- Regression hiện có: test:financial-control-workflow, test:aging-report-workflow, test:uncovered-subsystems.
- GREEN:
  - Director dashboard và financial-control endpoints sống.
  - Aging report workflow đã có.
- Bổ sung bắt buộc:
  - Browser E2E cho investor-dashboard.
  - Partial data error handling 401/403/500/timeout.
  - monthCount 3/6/12 và trend render đúng.
- Trạng thái: GREEN tầng API, MISSING tầng browser/UI.

13. REPORTS / EXPORT / TEACHING REPORT
- Regression hiện có: test:teaching-report-workflow, test:export-reports-workflow, test:comprehensive-report-workflow, test:student-report-workflow, test:teacher-kpi-workflow, test:employee-performance-workflow.
- GREEN:
  - Teaching report, export report, KPI và employee performance đã có workflow riêng.
- Bổ sung bắt buộc:
  - SHAREHOLDER anonymization đầy đủ ở teaching/comprehensive.
  - Export idempotency và cleanup test data.
  - Report permission matrix theo role.
- Trạng thái: GREEN.

14. EXPENSES
- Regression hiện có: test:expenses-workflow, test:expenses-financial-control-recalculation.
- GREEN:
  - CRUD expense cơ bản.
  - MarkPaid/update amount lan sang dashboard/P&L/cash-flow.
- Bổ sung bắt buộc:
  - Expense race condition khi đổi status PAID đồng thời update amount.
  - Expense -> investor metrics / alerts.
- Trạng thái: GREEN.

15. SUPPLIER-QUOTES / SUPPLIER-PAYMENTS
- Regression hiện có: chưa thấy suite dedicated trong backend/scripts.
- Bổ sung bắt buộc:
  - Quote lifecycle: DRAFT -> SENT -> ACCEPTED / REJECTED.
  - Payment lifecycle: DRAFT -> APPROVED -> PAID.
  - Supplier payment PAID -> cash outflow -> P&L / dashboard / investor dashboard.
  - Hai lớp duyệt Quote -> Payment.
- Trạng thái: MISSING.

16. LOANS
- Regression hiện có: test:financial-control-loans, test:loans-workflow, test:loans-activate, test:loans-payment.
- GREEN:
  - Activate status, partial payment, debtPosition, interestExpense, balance-sheet.
- Bổ sung bắt buộc:
  - Loan vs capital contribution tách biệt hạch toán.
  - Overdue installment alert lên dashboard/investor.
- Trạng thái: GREEN.

17. ADS / MARKETING-ATTRIBUTION / LEADS
- Regression hiện có: test:ads-financial-control-recalculation, một phần test:e2e-ad-to-revenue.
- GREEN:
  - Ad cost lan sang P&L / dashboard.
- Bổ sung bắt buộc:
  - Attribution merge cùng số điện thoại từ nhiều nguồn.
  - Agent commission / CAC từ đại lý.
  - E2E ad -> lead -> order -> invoice -> wallet theo flow hiện tại của repo.
- Trạng thái: GREEN phần cost, MISSING phần full funnel chính xác.

18. CHATBOT / CONVERSATIONS / MESSAGES
- Regression hiện có: test:conversations-workflow, test:messages-workflow, test:chatbot-settings-workflow.
- GREEN:
  - Chatbot settings, conversation, messages có workflow riêng.
- Bổ sung bắt buộc:
  - OpenAI token 401/429 -> disable auto reply.
  - Webhook overload -> queue/fallback.
  - Webhook signature mismatch.
- Trạng thái: GREEN phần workflow cơ bản, MISSING phần failure-mode/load.

19. TICKETS / NOTIFICATIONS
- Regression hiện có: test:tickets-workflow.
- GREEN:
  - Ticket lifecycle cơ bản.
- Bổ sung bắt buộc:
  - Complaint ticket link trực tiếp tới payroll hold/refund ledger.
  - Critical anomaly notification cho Director/Shareholder.
  - LOW_BALANCE_ALERT cho Sales khi wallet chạm debt limit.
- Trạng thái: GREEN phần ticket cơ bản, MISSING phần finance linkage.

20. TEACHERS / TEACHING-MATERIALS / REPORT-TEMPLATES / WORK-SESSIONS
- Regression hiện có: test:teacher-profiles-workflow, test:teaching-materials-workflow, test:work-sessions-workflow, test:teaching-report-workflow.
- GREEN:
  - Teacher profile, teaching materials, work sessions, template workflow.
- Bổ sung bắt buộc:
  - Substitute teacher 1 ngày rồi revert quyền.
  - Teacher submit report trên 2 thiết bị cùng lúc.
  - Work-session anomaly khi login/logout lệch.
- Trạng thái: GREEN.

21. AGENTS / COMMISSION
- Regression hiện có: test:commission-report-workflow.
- GREEN:
  - Commission report cơ bản.
- Bổ sung bắt buộc:
  - Tier GOLD/SILVER cho agent.
  - Suspended agent không được hưởng commission.
  - Agent commission đi vào CAC / acquisition cost theo policy hạch toán.
- Trạng thái: GREEN phần report, MISSING phần lifecycle.

22. TASKS / RECONCILIATION / NIGHTLY CRON
- Regression hiện có: chưa có suite E2E dedicated; một phần logic nằm trong tasks/reconciliation.service.ts và các spec/service khác.
- Bổ sung bắt buộc:
  - Missing PayrollTx auto-heal.
  - Late-flag discrepancy auto-fix.
  - Lương đã chi nhưng mất report -> critical anomaly.
  - Nightly reconciliation 10,000 sessions chạy nền và trả summary đúng.
- Trạng thái: MISSING.

23. PUBLIC / LOAD / SECURITY
- Regression hiện có: test:api-load.
- GREEN:
  - Có script load test API cơ bản.
- Bổ sung bắt buộc:
  - Public attendance token expiry.
  - Rate limit 429 ở public endpoints.
  - Webhook DDoS / backfill background job không timeout.
- Trạng thái: GREEN phần load cơ bản, MISSING phần public endpoint cụ thể.

24. AUTH / LOGIN / SECURITY
- Regression hiện có: test:rbac-finance-guards (chỉ test guard, chưa test login flow).
- Bổ sung bắt buộc (Nhóm 31):
  - Login thành công + JWT payload.
  - Brute-force lockout 5 lần → auto-lock 30 phút → auto-unlock.
  - Change password E2E.
  - JWT expiry + refresh token.
  - XSRF protection.
- Trạng thái: MISSING.

25. TRIAL ENROLLMENTS
- Regression hiện có: chưa có suite dedicated.
- Bổ sung bắt buộc (Nhóm 32):
  - Create → Record Trial Session → Convert (auto-create Order/Invoice/Wallet) HOẶC Reject.
  - Student TRIAL → OFFICIAL promotion.
  - Orphan trial auto-decide cron.
- Trạng thái: MISSING.

26. ATTENDANCE (chi tiết billing)
- Regression hiện có: test:attendance-workflow, test:class-attendance-pricing-workflow.
- FIXTURE phần attendance cơ bản.
- Bổ sung bắt buộc (Nhóm 33):
  - resolveAmountCharged() per-minute tính từ invoice pricingSnapshot.
  - recomputeOfflineTeacherPayoutForDay() với min threshold.
  - Self-attendance public link flow (generate-link → token → submit).
  - Invoice consumption FIFO.
- Trạng thái: FIXTURE attendance cơ bản, MISSING per-minute billing E2E.

27. WORK SESSIONS (chấm công GV)
- Regression hiện có: test:work-sessions-workflow.
- GREEN phần CRUD cơ bản.
- Bổ sung bắt buộc (Nhóm 34):
  - Login late detection vs scheduledStartTime.
  - Auto-close stale sessions (quên logout).
  - Monthly summary aggregation cho payroll integration.
- Trạng thái: GREEN phần CRUD, MISSING phần late detection & auto-close.

28. FINANCIAL CONTROL (chi tiết P&L, Balance Sheet, Tax)
- Regression hiện có: test:financial-control-workflow, test:financial-control-costs, nhiều recalculation tests.
- GREEN phần overview, alerts, P&L cơ bản.
- Bổ sung bắt buộc (Nhóm 35):
  - P&L Cash vs Accrual basis so sánh.
  - Balance Sheet cân đối Assets = Liabilities + Equity.
  - Tax Report annual calculation.
  - Investor Metrics (LTV, Burn rate, Retention, MRR).
  - Aging Report theo bucket tuổi nợ.
  - Bank transaction reconciliation.
- Trạng thái: GREEN phần aggregate, MISSING phần báo cáo chi tiết cho investor/tax.

29. DASHBOARD (per-role)
- Regression hiện có: test:financial-control-workflow (API level).
- Bổ sung bắt buộc (Nhóm 36):
  - Director dashboard metrics đúng.
  - Sale dashboard data isolation.
  - Parent dashboard ownership guard.
  - Teacher dashboard limited view.
  - Accounting dashboard pending items.
  - Shareholder/Investor dashboard READ-ONLY enforcement.
- Trạng thái: GREEN phần API, MISSING phần per-role data correctness.

30. PENDING APPROVALS / USERS
- Regression hiện có: một phần trong test:rbac-finance-guards.
- Bổ sung bắt buộc (Nhóm 37):
  - Hub duyệt tổng hợp cross-module.
  - User CRUD + auto-creation từ Order.
  - Sale-Parent ownership sync.
  - Ownership percentage validation.
- Trạng thái: MISSING.

________________________________________

ĐỀ XUẤT THỨ TỰ ƯU TIÊN VIẾT TEST MỚI
**Ưu tiên CRITICAL (tuần 1-2):**
1. Auth login lockout & JWT (Nhóm 31) — lỗ hổng bảo mật.
2. Trial → Convert → Order/Invoice/Wallet lifecycle (Nhóm 32) — pipeline doanh thu.
3. Attendance per-minute billing & invoice pricingSnapshot (Nhóm 33) — độ chính xác billing.
4. Invoice rollback / cancel approved invoice → reverse wallet (Nhóm 6).
5. Nightly reconciliation / auto-heal (Nhóm 9).

**Ưu tiên HIGH (tuần 3-4):**
6. Work sessions late detection & auto-close (Nhóm 34) — ảnh hưởng payroll.
7. Financial Control P&L Cash vs Accrual, Aging Report (Nhóm 35) — báo cáo investor.
8. Paid session cancel → refund → revenue reversal (Nhóm 6.2).
9. Wallet transfer A → B (Nhóm 5.2).
10. Parent dissatisfaction → payroll held → approve/exclude (Nhóm 3.3).

**Ưu tiên MEDIUM (tuần 5-6):**
11. Dashboard per-role data isolation (Nhóm 36).
12. Pending Approvals hub + User auto-creation (Nhóm 37).
13. Supplier Payments lifecycle (Nhóm 16.3).
14. Chatbot Fanpage/AI management (Nhóm 18.4-18.6).
15. Browser E2E cho Investor Dashboard.
16. 12 Cron jobs đầy đủ (Nhóm 30).

# Checklist mở và vận hành trung tâm tiếng Anh bằng hệ thống hiện tại

Cập nhật: 2026-04-24

Tài liệu này dùng để triển khai trung tâm tiếng Anh trên đúng luồng dữ liệu mà hệ thống hiện tại đã có: `Lead -> Parent -> Student -> Order -> Invoice -> Class -> Session -> Attendance -> Teaching Report -> Payroll -> Financial Control -> Audit`.

## Điều hướng nhanh

- [Tổng hợp link mở trung tâm](./tong-hop-link-mo-trung-tam.md)
- [Hub checklist theo đối tượng](./opening-center-checklists/README.md)
- [Hub sổ tay theo vị trí](./opening-center-handbooks/README.md)
- [PDF checklist đã export](../../../checklist-updated.pdf)

Mục tiêu của checklist là:

- [ ] Giúp anh/chị mở trung tâm bằng một quy trình thống nhất, không phải vá bằng Excel và chat rời rạc.
- [ ] Chỉ rõ việc nào phải khóa trước khai trương, việc nào phải chạy trong tuần đầu, việc nào phải giám sát mỗi ngày.
- [ ] Gắn từng đầu việc với module hệ thống hiện tại để đội ngũ làm đúng chỗ, đúng dữ liệu, đúng người phụ trách.

## Hồ sơ triển khai Lumira English

- [ ] Thương hiệu vận hành là `lumiraEnglish.com` và toàn bộ tài liệu bán hàng, SOP, handbook nội bộ phải dùng đúng tên này.
- [ ] Sản phẩm trọng tâm là lớp `online`, mô hình `1 giáo viên - nhiều học sinh`, học `1 buổi/tuần`, mỗi buổi `2 giờ 15 phút`.
- [ ] Cấu trúc một buổi chuẩn là `60 phút ngữ pháp + 60 phút giao tiếp + 15 phút game`.
- [ ] Học phí niêm yết là `160.000đ / học sinh / buổi`.
- [ ] Gói học chuẩn cần khai báo trong `Products` là `20`, `40`, `60`, `100` buổi.
- [ ] Với gói nhiều buổi, trung tâm chỉ áp dụng ưu đãi cố định `100.000đ / gói` theo bảng giá đã chốt; Sale không được tự giảm giá.
- [ ] Không dùng luồng học thử; học sinh làm `test trải nghiệm` xong thì chốt đề xuất và xếp lớp.
- [ ] Chính sách nghỉ học phải khóa rõ: nghỉ có phép không mất tiền, nghỉ không phép mất tiền.
- [ ] Giữ nguyên quyền chuyển lớp và hoàn tiền theo số buổi còn lại.
- [ ] Payroll nhân sự được chốt cho tháng trước và chi trả cố định vào ngày `10` hằng tháng.
- [ ] Lương Sale là `8.000.000đ / tháng + 3% hoa hồng doanh thu`.
- [ ] Lương giáo viên trải nghiệm là `7.000.000đ / tháng + 0,5% doanh thu của giáo viên đó + 5.000đ / ca test trải nghiệm`.
- [ ] Lương giáo viên giảng dạy là `250.000đ / ca 2 giờ 15 phút`, không có lương cứng.
- [ ] Cam kết bán hàng cần ghi thống nhất là `giao tiếp trôi chảy`.

## Bản tách theo đối tượng

Nếu cần dùng checklist gọn theo từng nhóm phụ trách, mở bộ file tách tại [docs/operations/opening-center-checklists/](./opening-center-checklists/README.md):

- [Checklist chung](./opening-center-checklists/checklist-chung.md)
- [Checklist Director](./opening-center-checklists/checklist-director.md)
- [Checklist Sale](./opening-center-checklists/checklist-sale.md)
- [Checklist OPS](./opening-center-checklists/checklist-ops.md)
- [Checklist Accounting](./opening-center-checklists/checklist-accounting.md)
- [Checklist Teacher](./opening-center-checklists/checklist-teacher.md)
- [Checklist Shareholder](./opening-center-checklists/checklist-shareholder.md)
- [Checklist Ads / Marketing](./opening-center-checklists/checklist-ads-marketing.md)
- [Checklist HCNS / Admin](./opening-center-checklists/checklist-hr-admin.md)

Bản hiện tại vẫn là checklist master đầy đủ, dùng khi cần rà soát liên phòng ban hoặc kiểm tra chéo end-to-end.

## Sổ tay theo đối tượng

Nếu cần tài liệu onboarding, bàn giao hoặc SOP chi tiết theo từng vị trí, mở bộ sổ tay tại [docs/operations/opening-center-handbooks/](./opening-center-handbooks/README.md):

- [Sổ tay Director](./opening-center-handbooks/so-tay-director.md)
- [Sổ tay Sale](./opening-center-handbooks/so-tay-sale.md)
- [Sổ tay OPS](./opening-center-handbooks/so-tay-ops.md)
- [Sổ tay Accounting](./opening-center-handbooks/so-tay-accounting.md)
- [Sổ tay Teacher](./opening-center-handbooks/so-tay-teacher.md)
- [Sổ tay Shareholder](./opening-center-handbooks/so-tay-shareholder.md)
- [Sổ tay Ads / Marketing](./opening-center-handbooks/so-tay-ads-marketing.md)
- [Sổ tay HCNS / Admin](./opening-center-handbooks/so-tay-hr-admin.md)

## 1. Nguyên tắc triển khai bắt buộc

- [ ] Chỉ đánh dấu hoàn thành khi đầu việc đã được xử lý ngay trên hệ thống hoặc đã có bằng chứng rõ ràng; không đánh dấu nếu mới thống nhất miệng.
- [ ] Mỗi đầu việc phải có đúng một người chịu trách nhiệm chính; các vai trò còn lại là phối hợp, không cùng sở hữu để tránh bỏ sót.
- [ ] Dữ liệu gốc phải được nhập một lần ở nguồn đúng của nó: parent ở `Users`, student ở `Students`, lớp ở `Classes`, buổi học ở `Sessions`, hóa đơn ở `Invoices`.
- [ ] Không cho đội sale, kế toán, vận hành tự tạo luồng làm việc ngoài hệ thống nếu hệ thống đã có màn hình tương ứng.
- [ ] Mọi tình huống phát sinh như đổi lịch, đổi giáo viên, phụ huynh khiếu nại, hoàn tiền, chờ duyệt phải để lại dấu vết trong `Tickets`, `Notifications`, `Messages` hoặc `Audit Log`.
- [ ] Ngay từ tuần đầu phải có nhịp review cuối ngày và review cuối tuần; không chờ đến cuối tháng mới xem lại số liệu.

## 2. Checklist quyết định vận hành cần khóa trước khi nhập dữ liệu

### 2.1. Mô hình kinh doanh và chính sách

- [ ] Chốt mô hình lớp Lumira trong 90 ngày đầu là `online`, `1 giáo viên - nhiều học sinh`, `1 buổi/tuần`, `2 giờ 15 phút/buổi`; điều này phải khớp ở `Products`, `Classes`, `Sessions` và handbook giảng dạy.
- [ ] Chốt quy tắc mở lớp: sĩ số tối thiểu, sĩ số tối đa, điều kiện đổi giáo viên, điều kiện gộp lớp, điều kiện tách lớp; nếu không khóa sớm thì vận hành và sale sẽ bán không cùng một logic.
- [ ] Chốt chính sách `test trải nghiệm` thay cho học thử: không mở gói học thử, không dùng luồng `Trial Enrollments` cho Lumira; test xong thì chốt đề xuất lớp và xếp lớp.
- [ ] Chốt chính sách giá và ưu đãi: giá niêm yết `160.000đ / học sinh / buổi`, chỉ có ưu đãi cố định `100.000đ / gói` cho gói nhiều buổi theo bảng giá đã duyệt; Sale không được tự giảm giá.
- [ ] Chốt chính sách công nợ: có cho đóng nhiều đợt không, được giữ chỗ khi chưa thanh toán bao nhiêu phần trăm, điều kiện xếp lớp khi hóa đơn chưa duyệt.
- [ ] Chốt chính sách nghỉ học, chuyển lớp và hoàn tiền: nghỉ có phép không mất tiền, nghỉ không phép mất tiền, giữ nguyên quyền chuyển lớp và hoàn tiền số buổi còn lại.

### 2.2. Phân quyền và cơ chế phê duyệt

- [ ] Chỉ định ai là `DIRECTOR` thật sự trên hệ thống và ai được cấp quyền dự phòng để xử lý khi người duyệt chính vắng mặt.
- [ ] Chốt vai trò nào được thao tác ở `Users`, `Students`, `Classes`, `Sessions`, `Orders`, `Invoices`, `Wallets`, `Payroll`, `Expenses`, `Financial Control`.
- [ ] Chốt tuyến duyệt cho từng nghiệp vụ: `Order`, `Invoice`, top-up ví, payroll giáo viên, payroll nhân sự, phiếu chi, yêu cầu đổi buổi, yêu cầu thay giáo viên.
- [ ] Ghi rõ SLA phê duyệt cho từng loại việc: ví dụ order trong 4 giờ làm việc, invoice trong ngày, top-up trong 2 giờ, đổi buổi trong ngày.
- [ ] Thống nhất nguyên tắc không cấp quyền rộng cho người không chịu trách nhiệm kết quả đầu ra; ví dụ sale không tự duyệt invoice, giáo viên không tự tạo hàng loạt session.

### 2.3. Quy ước dữ liệu và mã hóa

- [ ] Chốt quy tắc đặt mã lớp, mã đơn hàng, mã gói học, mã học viên, mã phiếu chi, mã chiến dịch; mục tiêu là khi nhìn mã có thể biết ngay loại nghiệp vụ và thời gian tạo.
- [ ] Chốt chuẩn đặt tên lớp theo cấp độ, độ tuổi, hình thức học và ca học để đội vận hành không tạo các lớp gần giống nhau nhưng tên không thống nhất.
- [ ] Chốt quy tắc nhập tên phụ huynh, tên học viên, số điện thoại, email, trường học, khối lớp để giảm bản ghi trùng.
- [ ] Chốt danh mục nguồn lead chuẩn: Facebook, Google, TikTok, Zalo, referral, walk-in, landing page, chatbot; không cho tự gõ nguồn tự do nếu đã có danh mục.
- [ ] Chốt danh mục lý do mất lead, lý do đổi lịch, lý do nghỉ học, lý do hủy đơn, lý do trả lại phiếu duyệt để việc tổng hợp cuối tuần có ý nghĩa.

## 3. Checklist hạ tầng và sẵn sàng hệ thống

- [ ] Kiểm tra môi trường chạy thật của backend, frontend, database, uploads và backup; không dùng dữ liệu demo lẫn với dữ liệu vận hành thật.
- [ ] Kiểm tra biến môi trường, tài khoản admin, secret, đường dẫn upload, log runtime và quy trình khởi động lại dịch vụ.
- [ ] Kiểm tra chức năng đăng nhập, đổi mật khẩu, lock/unlock user và cơ chế ghi nhận `work session` khi login/logout.
- [ ] Xác nhận mọi vai trò nhìn đúng menu và không thấy menu ngoài quyền tại `Dashboard`, `App Shell`, `Pending Approvals`, `Notifications`.
- [ ] Kiểm tra cơ chế gửi và đọc thông báo nội bộ để bảo đảm các cảnh báo vận hành không bị bỏ lỡ.
- [ ] Kiểm tra `Audit Log` có ghi nhận các thao tác nhạy cảm như duyệt đơn, sửa lớp, duyệt hóa đơn, chấm công, điều chỉnh tài chính.
- [ ] Kiểm tra quyền export báo cáo, quyền xem công nợ, quyền xem đối soát ngân hàng, quyền xem dữ liệu ẩn danh cho cổ đông nếu có sử dụng.
- [ ] Tạo một file tổng hợp tài khoản, vai trò, người sở hữu thật và ngày kích hoạt để sau này đối chiếu khi nhân sự thay đổi.

## 4. Checklist riêng cho cổ đông, cổ phần góp vốn và tài khoản nhận tiền

### 4.1. Phải phân biệt rõ 3 loại dòng tiền

- [ ] Chốt bằng văn bản và truyền đạt cho cả Director, Kế toán, cổ đông rằng hệ thống phải phân biệt ba loại tiền: `doanh thu vận hành`, `vốn góp cổ phần`, `tiền cho vay/ứng vốn`.
- [ ] Không nhập chung tiền cổ đông góp vốn với học phí hoặc doanh thu vận hành rồi cuối tháng mới tách tay; đây là lỗi làm sai báo cáo và sai cả câu chuyện với cổ đông.
- [ ] Với mỗi khoản tiền vào, phải xác định ngay bản chất: tiền mua khóa học của phụ huynh, tiền cổ đông góp thêm vốn chủ sở hữu, hay tiền cổ đông/đối tác cho trung tâm vay.
- [ ] Nếu là khoản vay của cổ đông hoặc bên liên quan thì đi theo `Loans`; nếu là góp vốn chủ sở hữu thật sự thì phải ghi nhận theo quy trình vốn góp riêng, không gắn nhầm vào khoản vay.

### 4.2. Cổ đông và tỷ lệ sở hữu hiện tại hệ thống hỗ trợ được gì

- [ ] Tạo user vai trò `SHAREHOLDER` cho từng cổ đông thật trên hệ thống; mỗi tài khoản cổ đông phải có `ownershipPercentage` rõ ràng.
- [ ] Rà tổng tỷ lệ sở hữu của toàn bộ cổ đông trên hệ thống; mục tiêu là tổng phải khớp với cơ cấu sở hữu mà công ty đang công nhận.
- [ ] Kiểm tra lại tên pháp lý, email, điện thoại và tư cách cổ đông của từng tài khoản để tránh nhập tài khoản demo hoặc tài khoản cá nhân phụ trợ thành cổ đông chính thức.
- [ ] Xác nhận cổ đông chỉ dùng để `xem` dữ liệu ở `Investor Dashboard`, `Financial Control`, `Aging Report`, một phần báo cáo tổng hợp; không dùng role cổ đông để xử lý nghiệp vụ hằng ngày.
- [ ] Ghi rõ trong SOP rằng trường `ownershipPercentage` hiện mới là dữ liệu tỷ lệ sở hữu ở mức hồ sơ user; nó chưa phải cap table hoàn chỉnh có lịch sử tăng giảm, phát hành mới, chuyển nhượng hay pha loãng.

### 4.3. Những gì hệ thống hiện tại chưa thay thế hoàn toàn cho quản trị cổ phần

- [ ] Ghi chú rõ rằng hệ thống hiện tại chưa phải phần mềm quản trị cap table đầy đủ: chưa có sổ cổ đông theo kỳ, chưa có lịch sử chuyển nhượng cổ phần, chưa có phát hành ESOP, chưa có classes of shares, chưa có tính cổ tức.
- [ ] Nếu trung tâm có nhiều vòng góp vốn, thay đổi tỷ lệ sở hữu, chuyển nhượng nội bộ, mua lại cổ phần hoặc phát hành thêm, phải duy trì thêm một `sổ cổ đông/cap table master` ngoài hệ thống làm nguồn pháp lý chính thức.
- [ ] Mọi quyết định thay đổi tỷ lệ sở hữu phải đi kèm biên bản, quyết định, hợp đồng, chứng từ chuyển tiền và người được phép cập nhật lại `ownershipPercentage` trên hệ thống.
- [ ] Không dùng `ownershipPercentage` như căn cứ pháp lý duy nhất để chia cổ tức hoặc xử lý tranh chấp cổ phần; đây hiện là trường quản trị nội bộ, không phải bộ hồ sơ pháp lý hoàn chỉnh.

### 4.4. Checklist tài khoản nhận tiền

- [ ] Tạo toàn bộ tài khoản ngân hàng nhận tiền trong `Financial Control -> Bank Accounts`, bao gồm ngân hàng, số tài khoản, chủ tài khoản, chi nhánh, mô tả mục đích sử dụng.
- [ ] Chỉ định một `tài khoản chính` bằng `isPrimary` để đội sale và phụ huynh biết tài khoản mặc định dùng nhận học phí.
- [ ] Nếu có nhiều dòng tiền khác nhau, nên tách ít nhất thành các nhóm tài khoản: tài khoản nhận học phí, tài khoản nhận vốn góp/tiền đầu tư, tài khoản vận hành hoặc chi hộ.
- [ ] Không dùng chung một tài khoản nhận học phí với tài khoản nhận góp vốn nếu trung tâm muốn báo cáo dòng tiền sạch và giải trình nhanh với cổ đông/kế toán thuế.
- [ ] Với mỗi tài khoản, quy định rõ ai được quyền công bố cho khách hàng, ai được sửa, ai được xem và ai có trách nhiệm đối soát cuối ngày.
- [ ] Director là người tạo/sửa tài khoản ngân hàng; Accounting là người ghi nhận giao dịch và đối soát; Shareholder chỉ xem.
- [ ] Với mỗi tài khoản nhận tiền, phải có quy ước đặt mô tả ngắn: `Học phí`, `Góp vốn`, `Vốn vay`, `Chi hộ`, để kế toán ghi giao dịch nhất quán.

### 4.5. Checklist nhận tiền góp vốn từ cổ đông

- [ ] Chốt rõ đây là `góp vốn chủ sở hữu` hay `cho công ty vay`; nếu không chốt trước, kế toán sẽ rất dễ ghi sai bản chất khoản tiền.
- [ ] Nếu là `góp vốn chủ sở hữu`, lập đầy đủ bộ chứng từ nội bộ hoặc pháp lý trước khi nhận tiền: quyết định góp vốn, lịch góp vốn, người góp, số tiền, ngày góp, phương thức chuyển khoản, tài khoản nhận tiền.
- [ ] Yêu cầu cổ đông chuyển khoản với nội dung thống nhất, ví dụ `GOP VON - TEN CO DONG - DOT 1`, để dễ đối soát.
- [ ] Khi tiền vào tài khoản, Accounting phải ghi nhận `Bank Transaction` ngay trong ngày, đính kèm `reference`, mô tả, ngày giao dịch và người ghi nhận.
- [ ] Vì hệ thống hiện tại chưa có category riêng cho `EQUITY CONTRIBUTION`, phải thống nhất tạm thời dùng mô tả chuẩn và reference chuẩn để lọc riêng các khoản góp vốn khi lên báo cáo.
- [ ] Sau khi ghi nhận giao dịch ngân hàng, nếu trung tâm có hạch toán quỹ nội bộ, tạo thêm giao dịch quỹ phù hợp để phản ánh mục đích sử dụng nguồn vốn.
- [ ] Sau mỗi đợt góp vốn, Director hoặc người được ủy quyền phải rà lại tỷ lệ sở hữu hiển thị ở tài khoản cổ đông và cập nhật nếu có thay đổi thực sự về cơ cấu vốn.

### 4.6. Checklist nếu cổ đông cho trung tâm vay tiền

- [ ] Nếu khoản tiền vào mang bản chất `cho vay`, không ghi như góp vốn; phải tạo khoản vay trong `Loans`.
- [ ] Tạo đúng `lenderName`, loại chủ nợ, loại vay, gốc, lãi suất, kỳ hạn, ngày bắt đầu, tần suất trả và tài khoản ngân hàng nhận giải ngân.
- [ ] Chỉ kích hoạt khoản vay sau khi kiểm tra đủ điều kiện và chắc rằng dòng tiền vào đúng tài khoản nhận tiền.
- [ ] Khi kích hoạt khoản vay, kiểm tra downstream trong `Financial Control` để chắc giao dịch `LOAN_DISBURSEMENT` được ghi nhận đúng.
- [ ] Mỗi kỳ trả nợ phải ghi nhận tại `Loans -> Record Payment` để tạo lịch sử, giảm dư nợ và đẩy bút toán `LOAN_REPAYMENT` vào financial control.
- [ ] Không xử lý khoản vay cổ đông bằng Excel riêng nếu đã quyết định đưa vào `Loans`; nếu tách ngoài hệ thống thì dashboard nợ vay và runway sẽ bị sai.

### 4.7. Checklist giám sát và minh bạch với cổ đông

- [ ] Tạo riêng tài khoản `SHAREHOLDER` cho từng người cần xem báo cáo; không dùng chung tài khoản Director để xem dữ liệu đầu tư.
- [ ] Xác nhận cổ đông xem được `Investor Dashboard`, `Financial Control`, `Aging Report` ở chế độ phù hợp và dữ liệu cá nhân nhạy cảm được ẩn danh ở các báo cáo cần thiết.
- [ ] Định nghĩa nhịp gửi báo cáo cho cổ đông: hàng tuần, hàng tháng hoặc theo kỳ họp; hệ thống hiện tại phù hợp nhất cho chế độ xem snapshot và xuất báo cáo.
- [ ] Chốt danh sách chỉ số cổ đông cần xem định kỳ: tiền mặt, burn rate, runway, doanh thu tháng, lợi nhuận gộp, công nợ phải thu, nợ vay, giao dịch chưa đối soát.
- [ ] Rà lại quyền thực tế của cổ đông trên các màn tài chính và vốn vay trước khi go-live; mục tiêu là cổ đông chỉ xem, không vô tình có quyền ghi nhận giao dịch.

### 4.8. Điểm cần đặc biệt lưu ý khi đưa vào vận hành thật

- [ ] Role cổ đông hiện đang mạnh ở lớp xem báo cáo, nhưng không nên coi đây là module quản trị cổ phần doanh nghiệp đầy đủ.
- [ ] Với phần `tỷ lệ sở hữu`, hệ thống đang tốt cho quản trị nội bộ và dashboard, nhưng chưa đủ cho quản trị pháp lý nhiều vòng vốn.
- [ ] Với phần `tài khoản nhận tiền`, hệ thống đang dùng được thật: tạo nhiều tài khoản, chọn tài khoản chính, ghi giao dịch, đối soát, xem dòng tiền.
- [ ] Với phần `góp vốn`, nếu trung tâm muốn dùng ngay thì nên vận hành theo mô hình `ngân hàng + reference chuẩn + báo cáo riêng + cập nhật ownershipPercentage`; nếu cần quản trị cap table sâu hơn thì nên bổ sung module riêng sau.

## 5. Checklist cơ chế và chính sách cho các vị trí

### 5.1. Khung chung áp dụng cho toàn bộ nhân sự

- [ ] Mỗi vị trí phải có đủ 6 thành phần được chốt bằng văn bản: `mục tiêu`, `KPI`, `quyền hệ thống`, `quyền phê duyệt`, `cơ chế lương thưởng`, `SLA xử lý công việc`.
- [ ] Tất cả nhân sự phải dùng đúng tài khoản cá nhân của mình; cấm dùng chung tài khoản hoặc thao tác hộ mà không có ủy quyền rõ ràng.
- [ ] Mọi dữ liệu dùng để tính lương, thưởng, hoa hồng hoặc đánh giá KPI phải lấy từ hệ thống, không lấy từ báo cáo miệng hoặc file Excel cá nhân.
- [ ] Mọi đầu việc có liên quan tới tiền, lớp học, học viên, lead, order, invoice, ticket hoặc payroll đều phải có dấu vết trên hệ thống.
- [ ] Chốt cut-off dữ liệu lương, thưởng và hoa hồng vào cuối tháng; ngày chi trả cố định của Lumira là ngày `10` hằng tháng cho dữ liệu tháng trước.
- [ ] Chốt nguyên tắc xử lý ngoại lệ: mọi ngoại lệ vượt chính sách đều phải có người duyệt, lý do, bằng chứng và thời điểm duyệt.
- [ ] Chốt cơ chế bàn giao đầu ca và cuối ca; việc nào chưa xong phải được chuyển trên `Tickets`, `Messages` hoặc ghi chú trong luồng liên quan.
- [ ] Chốt cơ chế chế tài cho các lỗi lặp lại: nhập sai dữ liệu, bỏ sót follow-up, không điểm danh, không nộp report, duyệt sai chứng từ, không đối soát đúng hạn.

### 5.2. Chính sách cho Director / Giám đốc

- [ ] Chốt mục tiêu của Director theo 4 trục: tăng trưởng doanh thu, tỷ lệ lấp đầy lớp, kiểm soát dòng tiền và chất lượng vận hành.
- [ ] Chốt Director là người có quyền cao nhất trên `Dashboard`, `Users`, `Orders`, `Invoices`, `Classes`, `Sessions`, `Financial Control`, `Audit Log`, `Payroll`, `Bank Accounts`, `Funds`, `Loans`.
- [ ] Chốt Director là người duyệt cuối cho các nghiệp vụ ngoại lệ về giá ngoài bảng giá Lumira, hoàn tiền, chuyển lớp ngoài chính sách, invoice tranh chấp, khoản vay, tài khoản nhận tiền, quỹ, chi phí lớn.
- [ ] Chốt Director phải review `Pending Approvals` ít nhất hai lần mỗi ngày làm việc.
- [ ] Chốt Director phải review `Financial Control` hằng ngày trong giai đoạn 30 đến 60 ngày đầu vận hành.
- [ ] Chốt KPI Director gồm: doanh thu thực thu, lợi nhuận gộp, công nợ quá hạn, burn rate, runway, tỷ lệ session treo, số ticket quá SLA, tỷ lệ chuyển đổi tuyển sinh.
- [ ] Chốt cơ chế lương/thưởng của Director phải gắn với kết quả thực tế đã ghi nhận trên hệ thống, không thưởng theo doanh thu chưa thu hoặc doanh số chưa duyệt.
- [ ] Chốt trách nhiệm của Director là không để các phê duyệt quan trọng treo quá SLA đã công bố.

### 5.3. Chính sách cho Sale / Tư vấn tuyển sinh

- [ ] Chốt sale phải đi đúng luồng `Lead -> Parent -> Student -> Order -> Invoice -> bàn giao xếp lớp`; không được bỏ qua CRM rồi nhập thẳng order khi chưa có lý do chính đáng.
- [ ] Chốt sale chỉ được dùng các module đã cấp quyền như `Leads`, `Orders`, `Students`, `Conversations`, `Commission Report`, `Sale Hub`; với Lumira không dùng `Trial Enrollments`.
- [ ] Chốt sale không có quyền tự duyệt `Invoices`, không có quyền tự tạo hàng loạt `Sessions`, không có quyền tự thêm `Bank Account`, không có quyền tự xử lý `Financial Control`.
- [ ] Chốt mọi cuộc gọi, chat, gặp trực tiếp đều phải có contact log và ngày follow-up tiếp theo trên hệ thống.
- [ ] Chốt lead quá hạn follow-up bao nhiêu giờ hoặc bao nhiêu ngày thì bị chuyển trạng thái cảnh báo, trả pool hoặc điều phối lại owner.
- [ ] Chốt rõ sale không được tự giảm giá; nếu có ưu đãi `100.000đ / gói` cho gói nhiều buổi thì chỉ được dùng đúng bảng giá Lumira đã khóa sẵn.
- [ ] Chốt sale không được tạo trùng parent hoặc student nếu trên hệ thống đã có hồ sơ cũ; luôn phải tìm kiếm trước khi tạo mới.
- [ ] Chốt sale chỉ được gửi cho phụ huynh tài khoản nhận tiền chính thức của công ty; tuyệt đối không gửi tài khoản cá nhân.
- [ ] Chốt hoa hồng sale chỉ được tính khi order đã được duyệt và đạt điều kiện tài chính theo chính sách trung tâm.
- [ ] Chốt lương Sale Lumira là `8.000.000đ / tháng + 3% hoa hồng doanh thu`.
- [ ] Chốt cơ chế clawback hoặc điều chỉnh hoa hồng nếu đơn bị hủy, hoàn tiền hoặc phát hiện dữ liệu đầu vào sai.
- [ ] Chốt KPI sale gồm: số lead hợp lệ, tỷ lệ follow-up đúng hạn, tỷ lệ lead sang `test trải nghiệm`, tỷ lệ `test trải nghiệm -> xếp lớp/order approved`, doanh thu thực thu, tỷ lệ lead stale.
- [ ] Chốt chế tài cho sale nếu bỏ sót follow-up nóng, ghi sai cam kết học phí hoặc tạo trùng dữ liệu nhiều lần.

### 5.4. Chính sách cho OPS / Vận hành

- [ ] Chốt OPS là chủ luồng `Classes`, `Sessions`, `Attendance`, `Tickets`, `Pending Approvals`, điều phối giáo viên và bàn giao liên phòng ban.
- [ ] Chốt OPS chịu trách nhiệm lớp phải chạy đúng lịch, đúng giáo viên, đúng roster, đúng trạng thái session.
- [ ] Chốt OPS không được finalize buổi học khi thiếu `attendance` hoặc `teaching report`.
- [ ] Chốt OPS là đầu mối xử lý ticket liên quan đến đổi lịch, đổi giáo viên, phát sinh roster, khiếu nại lớp học và các vấn đề điều phối trong ngày.
- [ ] Chốt mọi thay đổi giáo viên, roster, lịch học đều phải cập nhật tại dữ liệu nguồn, không chỉ comment trong ticket.
- [ ] Chốt lịch rà soát của OPS: đầu ngày rà `Classes` và `Sessions`; cuối ngày rà `Attendance`, `Teaching Report`, `Tickets`, `Pending Approvals`.
- [ ] Chốt KPI OPS gồm: số session được tạo đúng hạn, số session finalized trong ngày, số ticket quá SLA, số lỗi roster, số ca đổi giáo viên xử lý kịp thời.
- [ ] Chốt cơ chế bàn giao ca cho OPS, trong đó mọi việc dở dang phải có người nhận tiếp và thời hạn xử lý tiếp theo.
- [ ] Chốt chế tài với các lỗi lặp lại như tạo thiếu session, finalize sai, để ticket quá hạn hoặc không cập nhật lớp nguồn.

### 5.5. Chính sách cho Accounting / Kế toán

- [ ] Chốt kế toán là chủ luồng `Invoices`, `Wallets`, `Financial Control`, `Bank Reconciliation`, `Expenses`, `Payroll`, `Aging Report`.
- [ ] Chốt kế toán là người ghi nhận giao dịch, duyệt chứng từ theo quyền, đối soát và lên báo cáo tài chính vận hành.
- [ ] Chốt kế toán không tự ý đổi bản chất dòng tiền khi chưa có phê duyệt; đặc biệt phải phân biệt rõ doanh thu, góp vốn và khoản vay.
- [ ] Chốt kế toán chỉ duyệt hóa đơn hoặc top-up khi có chứng từ hợp lệ, số tiền khớp, ngày giao dịch rõ và nguồn tiền xác định được.
- [ ] Chốt kế toán là người chịu trách nhiệm ghi nhận giao dịch ngân hàng trong ngày và đánh dấu reconcile sau khi đối chiếu đủ bằng chứng.
- [ ] Chốt kế toán phải review `Invoices`, `Wallets`, `Financial Control` ít nhất hai lần mỗi ngày trong giai đoạn đầu vận hành.
- [ ] Chốt KPI kế toán gồm: thời gian duyệt invoice, số giao dịch chưa đối soát, số sai lệch chứng từ, công nợ quá hạn, độ đúng của payroll, độ sạch của số dư quỹ/ngân hàng.
- [ ] Chốt cơ chế lương/thưởng kế toán gắn với chất lượng kiểm soát và độ đúng số liệu, không gắn với tốc độ duyệt đơn thuần.
- [ ] Chốt chế tài nếu ghi nhận sai dòng tiền, duyệt thiếu chứng từ, để tồn giao dịch unreconciled quá lâu hoặc làm sai cutoff lương.

### 5.6. Chính sách cho Teacher

- [ ] Chốt giáo viên là người chịu trách nhiệm trực tiếp cho `Attendance`, `Teaching Report`, chất lượng buổi dạy và đúng giờ lên lớp.
- [ ] Chốt giáo viên được dùng `Sessions`, `Attendance`, `Teaching Report`, `Teacher Calendar`, `Teaching Materials`, `Tickets`, `Messages`, `Payroll`, `Work Sessions`.
- [ ] Chốt giáo viên không được tự mở lớp, tự bulk tạo session, tự sửa học phí hoặc tự duyệt tài chính.
- [ ] Chốt mỗi ca dạy Lumira là `2 giờ 15 phút online`, gồm `60 phút ngữ pháp + 60 phút giao tiếp + 15 phút game`; buổi dạy chỉ đủ điều kiện trả lương khi đã có attendance và teaching report hợp lệ.
- [ ] Chốt giáo viên phải điểm danh đúng ngày, đúng lớp và nộp teaching report trong ngày; không cho phép dồn report nhiều ngày nếu không có lý do được duyệt.
- [ ] Chốt SLA báo xin nghỉ, nhờ dạy thay hoặc đổi ca; ví dụ tối thiểu 24 giờ trước ca nếu không phải tình huống khẩn cấp.
- [ ] Chốt KPI giáo viên gồm: tỷ lệ đúng giờ, tỷ lệ report đúng hạn, tỷ lệ session hoàn thành, điểm phản hồi phụ huynh, tỷ lệ buổi đủ điều kiện payroll.
- [ ] Chốt cơ chế lương giáo viên Lumira: giáo viên trải nghiệm nhận `7.000.000đ / tháng + 0,5% doanh thu của giáo viên đó + 5.000đ / ca test trải nghiệm`; giáo viên giảng dạy nhận `250.000đ / ca 2 giờ 15 phút`, không có lương cứng.
- [ ] Chốt chế tài nếu bỏ ca, báo nghỉ sát giờ, không điểm danh, không nộp report hoặc để phát sinh khiếu nại lặp lại mà không cải thiện.

### 5.7. Chính sách cho Ads / Marketing

- [ ] Chốt bộ phận Ads/Marketing chịu trách nhiệm chất lượng lead đầu vào, chi phí lead, tracking nguồn và hiệu quả landing page/chatbot.
- [ ] Chốt Ads/Marketing được dùng `Ads Management`, `Ads Analytics`, `Landing Pages`, `Chatbot Settings` theo đúng role thực tế.
- [ ] Chốt mọi thay đổi ngân sách vượt ngưỡng, thay đổi tracking lớn hoặc thay đổi route landing page phải có người duyệt.
- [ ] Chốt KPI ads gồm: CPL, lead hợp lệ, cost per order, tỷ lệ lead rác, hiệu suất từng nguồn, mức khớp attribution.
- [ ] Chốt team ads phải bàn giao rõ campaign, ad group, nguồn và note cho sale khi có đợt lead tăng đột biến.
- [ ] Chốt cơ chế thưởng không chỉ theo số lead thô mà theo chất lượng lead đã được sale xác nhận trên hệ thống.

### 5.8. Chính sách cho HCNS / Admin

- [ ] Chốt HCNS/Admin là đầu mối quản lý vòng đời nhân sự: onboard, cấp tài khoản, thu hồi quyền, hồ sơ cơ bản, lịch làm việc và đối soát hiện diện.
- [ ] Chốt HCNS/Admin phải phối hợp với Director để cấp đúng role và khóa đúng tài khoản khi nhân sự nghỉ việc hoặc chuyển vị trí.
- [ ] Chốt HCNS/Admin theo dõi `Work Sessions` và các trạng thái nhân sự bất thường để phối hợp xử lý.
- [ ] Chốt KPI HCNS/Admin gồm: thời gian onboard, thời gian khóa quyền khi offboard, độ đầy đủ hồ sơ, tỷ lệ sai phân quyền, số lỗi chấm công lặp lại.
- [ ] Chốt mọi thay đổi role, trạng thái nhân sự và thông tin nhân sự quan trọng phải có log hoặc bằng chứng phê duyệt.

### 5.9. Chính sách cho Shareholder / Cổ đông

- [ ] Chốt role `SHAREHOLDER` là role xem báo cáo đầu tư và snapshot tài chính; không phải role điều hành hằng ngày.
- [ ] Chốt cổ đông chỉ xem `Investor Dashboard`, `Financial Control`, `Aging Report`, các báo cáo ẩn danh phù hợp và phần vốn vay theo phạm vi được mở thật sự.
- [ ] Chốt cổ đông không có quyền ghi giao dịch, tạo tài khoản ngân hàng, đối soát, duyệt invoice, chỉnh payroll hoặc thay đổi quỹ.
- [ ] Chốt lịch gửi báo cáo cổ đông theo tuần hoặc tháng, và chỉ số nào phải có trong mỗi kỳ báo cáo.
- [ ] Chốt việc cập nhật `ownershipPercentage` chỉ do người được ủy quyền thực hiện sau khi đã có đủ hồ sơ pháp lý hoặc quyết định nội bộ.

### 5.10. Chính sách tài khoản nhận tiền, ký duyệt và cutoff dữ liệu

- [ ] Chốt chỉ các tài khoản trong `Financial Control -> Bank Accounts` mới là tài khoản công ty được phép dùng để nhận tiền.
- [ ] Chốt ít nhất một tài khoản `primary` để sale và phụ huynh dùng mặc định cho học phí.
- [ ] Chốt riêng tài khoản nhận học phí và tài khoản nhận góp vốn/đầu tư nếu trung tâm có cả hai loại dòng tiền.
- [ ] Chốt Director là người tạo và sửa tài khoản ngân hàng; Accounting là người ghi giao dịch và đối soát; Sale chỉ được dùng để gửi thông tin cho khách theo mẫu chuẩn.
- [ ] Chốt nội dung chuyển khoản chuẩn cho từng loại tiền: học phí, top-up, góp vốn, trả nợ, hoàn tiền.
- [ ] Chốt cutoff cuối ngày cho các nghiệp vụ tài chính: invoice chờ duyệt, top-up chờ duyệt, giao dịch ngân hàng chưa reconcile, phiếu chi chưa xử lý, session đủ điều kiện payroll nhưng chưa chốt.
- [ ] Chốt cutoff cuối tháng cho payroll, commission, đối soát công nợ, báo cáo cổ đông, báo cáo quản trị.

## 6. Checklist T-30 đến T-21: chuẩn bị dữ liệu gốc

### 6.1. Người dùng và nhân sự

- [ ] Tạo đầy đủ tài khoản thật cho ban giám đốc, vận hành, sale, kế toán, giáo viên, phụ huynh mẫu và người quản lý hỗ trợ.
- [ ] Kiểm tra hồ sơ từng giáo viên trong `Teacher Profiles`: chuyên môn, cấp dạy, môn dạy, lịch rảnh, kinh nghiệm, thông tin ngân hàng.
- [ ] Chuẩn hóa danh sách sale phụ trách theo khu vực, sản phẩm, nhóm khách hàng hoặc nguồn lead để tránh xung đột owner.
- [ ] Thiết lập người duyệt thay thế cho các tình huống vắng mặt để luồng `Pending Approvals` không bị kẹt.
- [ ] Tập huấn nhân sự cách đăng nhập, đổi mật khẩu, đăng xuất đúng quy trình để `Work Sessions` và bảo mật không bị sai từ đầu.

### 6.2. Gói học và chính sách bán hàng

- [ ] Khai báo các gói Lumira trong `Products`: `20`, `40`, `60`, `100` buổi; tất cả đều là lớp online, `1 giáo viên - nhiều học sinh`, học phí niêm yết `160.000đ / học sinh / buổi`.
- [ ] Không tạo gói học thử; nếu cần onboarding đầu vào thì dùng `test trải nghiệm` rồi xếp lớp trực tiếp.
- [ ] Xác nhận số buổi, giá trị hóa đơn, logic tăng buổi, giảm buổi và installment của từng gói khớp với tài liệu bán hàng ngoài thực tế.
- [ ] Chạy thử bảng giá Lumira để chắc rằng ưu đãi cố định `100.000đ / gói` cho gói nhiều buổi hiển thị đúng trong `Orders` và `Invoices`, đồng thời Sale không thể tự ý giảm giá ngoài bảng giá.

### 6.3. Dữ liệu phụ huynh và học viên

- [ ] Chuẩn hóa form thu thập thông tin đầu vào để sale luôn có đủ họ tên phụ huynh, số điện thoại, email, tên học viên, năm sinh, khối lớp, nhu cầu học.
- [ ] Quy định rõ khi nào tạo mới parent ở `Users` và khi nào phải tìm kiếm parent cũ để tránh tạo trùng hồ sơ.
- [ ] Quy định rõ khi nào tạo mới student ở `Students` và khi nào phải gắn vào parent cũ hoặc sale owner cũ.
- [ ] Chuẩn hóa ảnh chân dung, file hồ sơ, ghi chú sức khỏe hoặc lưu ý đặc biệt nếu mô hình lớp có yêu cầu theo dõi riêng.
- [ ] Tạo trước một số hồ sơ parent và student mẫu đại diện cho các ca phổ biến: khách mới, khách cũ mua lại, hai con chung parent, test trải nghiệm trước khi xếp lớp thật.

### 6.4. Lớp học và lịch học

- [ ] Tạo danh sách lớp dự kiến trong 4 đến 8 tuần đầu tại `Classes`, bao gồm mã lớp, tên lớp, cấp độ, giáo viên, sale phụ trách và nhóm học viên mục tiêu; lịch chuẩn của Lumira là `1 buổi/tuần`, `2 giờ 15 phút/buổi`.
- [ ] Kiểm tra lại roster của từng lớp để bảo đảm downstream ở `Sessions`, `Attendance` và `Student Report` dùng chung một dữ liệu đúng.
- [ ] Tạo trước lịch học hàng loạt cho toàn bộ tuần đầu hoặc tháng đầu trong `Sessions`, tránh để tới ngày khai trương mới sinh session.
- [ ] Chuẩn bị sẵn phương án lớp dự phòng và giáo viên thay thế cho các ca cao điểm, ca cuối tuần, ca sau 17h.
- [ ] Xác nhận những lớp chưa đủ sĩ số được gắn trạng thái hoặc ghi chú rõ để sale không bán nhầm vào lớp chưa thực sự mở.

### 6.5. Tài chính nền tảng

- [ ] Chốt tài khoản ngân hàng, quỹ tiền mặt, ví phụ huynh, danh mục chi phí, nhóm chi phí, nguồn vay và hạn mức quỹ nếu có dùng trong `Financial Control`.
- [ ] Kiểm tra mẫu invoice, phương thức thanh toán, yêu cầu upload chứng từ và người có quyền duyệt chứng từ.
- [ ] Chuẩn hóa quy tắc ghi chú thanh toán: mã giao dịch, ngân hàng, người nộp, ảnh biên lai, ngày hạch toán.
- [ ] Thiết lập cấu hình lương Sale, giáo viên trải nghiệm, giáo viên giảng dạy và payroll nhân sự nội bộ; khóa lịch chi trả ngày `10` hằng tháng cho dữ liệu tháng trước.
- [ ] Chốt logic đối soát cuối ngày: ai kiểm tra hóa đơn chờ duyệt, ai đối chiếu top-up ví, ai review bút toán chưa reconcile.

## 7. Checklist T-20 đến T-14: chạy thử luồng sale và tuyển sinh

### 7.1. Luồng lead và CRM

- [ ] Đào tạo sale dùng `Sale Hub` đúng 5 bước chuẩn: parent, student, order/invoice, gate tài chính, xếp lớp.
- [ ] Tạo lead mẫu từ tất cả nguồn chính trong `Leads` để test đủ các case nguồn và owner.
- [ ] Kiểm tra bộ lọc lead, tab follow-up, tab stale, tab pool và khả năng tìm lại lead theo phone, parent, student, source.
- [ ] Yêu cầu sale ghi ít nhất một lịch sử contact và một lịch follow-up cho mỗi lead mẫu để tạo thói quen để lại dấu vết.
- [ ] Chạy thử case đổi sale owner, trả lead về pool, lead mất và review assignment history để chắc rằng logic ownership rõ ràng.

### 7.2. Luồng hội thoại và chatbot

- [ ] Nếu trung tâm dùng chatbot, chạy thử `Conversations` với case AI xử lý, sale tiếp quản, rồi tạo lead trực tiếp từ hội thoại.
- [ ] Kiểm tra việc gắn fanpage, nguồn chiến dịch, thông tin liên hệ và tag chuyển đổi từ hội thoại sang CRM.
- [ ] Xác nhận quy tắc phản hồi khách ngoài giờ và ai chịu trách nhiệm nhận hội thoại trong khung giờ cao điểm.

### 7.3. Luồng tạo đơn và chuyển đổi

- [ ] Chạy thử tạo order cho khách hoàn toàn mới trong `Orders` và kiểm tra parent, student được tạo đúng.
- [ ] Chạy thử tạo order cho khách cũ để chắc rằng hệ thống chọn lại parent và student cũ thay vì nhân đôi dữ liệu.
- [ ] Chạy thử convert lead ở trạng thái phù hợp sang order để sale quen luồng chuẩn, không bỏ qua CRM.
- [ ] Test đủ các trường hợp installment, receipt upload, consultation notes và gửi duyệt; xác nhận Sale không thể tự giảm giá ngoài bảng giá Lumira đã khóa.
- [ ] Test nhánh `NEEDS_INFO`, reject, cancel và approved để đội sale hiểu luồng phản hồi và không hỏi ngược mỗi lần đơn bị trả lại.
- [ ] Sau khi order được duyệt, kiểm tra downstream tại `Invoices`, `Students`, `Classes` hoặc bước bàn giao cho OPS để xác nhận side effect đúng như kỳ vọng.

### 7.4. Luồng test trải nghiệm và xếp lớp

- [ ] Chạy thử ít nhất 3 case `test trải nghiệm`: test xong xếp lớp ngay, test xong cần đổi đề xuất lớp, test xong phụ huynh chưa chốt ngay.
- [ ] Chốt người có quyền khóa kết quả test trải nghiệm và thời hạn phải chốt xếp lớp sau buổi test.
- [ ] Gắn rõ test trải nghiệm với giáo viên, khung giờ và đề xuất lớp để báo cáo và chi phí giáo viên không bị trôi.

## 8. Checklist T-13 đến T-7: chạy thử vận hành học vụ và giảng dạy

### 8.1. Dashboard vận hành và điều phối

- [ ] Yêu cầu OPS mở `Dashboard` mỗi sáng và xác định được ngay lớp nào đang chạy, ticket nào quá hạn, request nào chờ duyệt.
- [ ] Kiểm tra `Pending Approvals` để bảo đảm OPS và Director hiểu rõ thứ tự xử lý ưu tiên theo thời gian và mức ảnh hưởng.
- [ ] Chốt cách bàn giao việc giữa ca sáng và ca chiều: việc gì phải để lại ở `Tickets`, việc gì phải có thông báo nội bộ, việc gì phải nhắn trực tiếp.

### 8.2. Classes, Sessions và điều phối giáo viên

- [ ] Chạy thử case sửa roster ở `Classes`, thay giáo viên phụ trách, thêm và bỏ học sinh khỏi lớp.
- [ ] Chạy thử bulk create session ở `Sessions` cho cả một lớp hoặc cả một cụm lịch để xác nhận không bị thiếu buổi.
- [ ] Chạy thử case `TEACHER_COMPLETED` rồi finalize buổi học để kiểm tra bước chốt session trước payroll.
- [ ] Chạy thử case đổi lịch, đổi giáo viên, tạo change request, xử lý ticket và cập nhật ngược lại vào lớp nguồn.
- [ ] Chuẩn bị sẵn danh sách giáo viên thay thế theo môn và ca dạy để OPS có thể xử lý trong ngày mà không chờ họp.

### 8.3. Attendance và teaching report

- [ ] Yêu cầu giáo viên chạy thử `Attendance` với case mark all present, chỉnh từng học viên, tạo link điểm danh cho học sinh.
- [ ] Kiểm tra summary sau khi lưu attendance để chắc dữ liệu reload đúng, không chỉ hiển thị thành công giả.
- [ ] Yêu cầu giáo viên nộp `Teaching Report` cho các buổi mẫu và xác minh logic thiếu báo cáo sẽ ảnh hưởng tới payroll.
- [ ] Chạy thử `Attendance Report`, `Student Report`, `Comprehensive Report` để chắc trung tâm có báo cáo tổng hợp ngay từ tuần đầu.
- [ ] Xác nhận nguyên tắc: buổi nào chưa điểm danh hoặc chưa có teaching report thì chưa đủ điều kiện chốt cuối ngày.

### 8.4. Tickets, thông báo và phối hợp

- [ ] Tạo các ticket mẫu cho các tình huống phổ biến: giáo viên xin nghỉ, phụ huynh xin đổi ca, học viên phản ánh chất lượng, phụ huynh cần hóa đơn.
- [ ] Kiểm tra việc comment, đổi trạng thái, đóng ticket và lưu đầy đủ lịch sử xử lý.
- [ ] Chạy thử `Messages` và `Notifications` để xem đội ngũ có nhận cảnh báo kịp hay không.
- [ ] Quy định mọi phát sinh có ảnh hưởng đến lớp, tiền hoặc lịch phải để lại dấu vết trên hệ thống; không giải quyết xong rồi quên cập nhật.

## 9. Checklist T-6 đến T-1: khóa tài chính, kiểm soát và nghiệm thu

### 9.1. Ví, hóa đơn và công nợ

- [ ] Chạy thử nạp ví tại `Wallets`, duyệt top-up, mở ledger và kiểm tra số dư trước sau đúng.
- [ ] Chạy thử case chứng từ thiếu hoặc số tiền sai để xác minh validation chặn thao tác sai.
- [ ] Chạy thử `Invoices` với hóa đơn chờ duyệt, hóa đơn có chứng từ, hóa đơn cần trả lại.
- [ ] Kiểm tra `Aging Report` để chắc cách nhìn công nợ theo tuổi nợ sẵn sàng cho tuần đầu khai trương.
- [ ] Chốt quy trình cuối ngày: danh sách hóa đơn chờ duyệt, top-up chờ duyệt, đơn đã approved nhưng chưa đối soát tiền thực nhận.

### 9.2. Payroll và chấm công

- [ ] Chạy thử `Payroll` giáo viên để xem preview, xác định buổi nào đủ điều kiện và buổi nào còn bị chặn bởi attendance hoặc report.
- [ ] Chạy thử `Work Sessions` với login đúng giờ, đi muộn, logout, auto-close để hiểu báo cáo chấm công sẽ hiển thị như thế nào.
- [ ] Nếu dùng `Staff Payroll`, chạy thử một kỳ lương nội bộ từ xem chi tiết tới đánh dấu đã thanh toán.
- [ ] Chốt quy định payroll Lumira: chốt dữ liệu tháng trước và chi trả ngày `10` hằng tháng; Sale nhận `8.000.000đ + 3% doanh thu`, giáo viên trải nghiệm nhận `7.000.000đ + 0,5% doanh thu + 5.000đ / ca test trải nghiệm`, giáo viên giảng dạy nhận `250.000đ / ca 2 giờ 15 phút`.

### 9.3. Financial Control và đối soát

- [ ] Mở `Financial Control` và review đủ các tab tổng quan, cảnh báo, ngân hàng, quỹ, dòng tiền, P&L, đối soát.
- [ ] Tạo thử một giao dịch ngân hàng, thực hiện đối soát và xác nhận trạng thái thay đổi đúng.
- [ ] Tạo thử một phiếu chi ở `Expenses`, duyệt phiếu và đánh dấu đã chi để kiểm tra trọn vòng đời.
- [ ] Nếu có dùng `Loans`, chạy thử update overdue, mở repayment schedule và ghi nhận một kỳ đã thanh toán.
- [ ] Chạy thử `Export Reports` để xác nhận khả năng xuất file CSV cho payroll, tài chính và báo cáo đối soát.

### 9.4. Audit và nghiệm thu nội bộ

- [ ] Mở `Audit Log` và rà các thao tác quan trọng trong tuần dry-run: tạo lead, duyệt order, duyệt invoice, chỉnh lớp, đổi giáo viên, điều chỉnh chấm công.
- [ ] Ghi nhận danh sách lỗi quyền truy cập, lỗi logic, lỗi dữ liệu, lỗi hiển thị và chốt ai phải sửa trước khai trương.
- [ ] Tổ chức một buổi nghiệm thu nội bộ với Director, OPS, Sale, Accounting, Teacher lead để chạy lại luồng end-to-end lần cuối.

## 10. Checklist T-1: ngày trước khai trương

- [ ] Chốt danh sách lớp, roster, giáo viên, trợ giảng, giáo viên thay thế và ca học của toàn bộ 7 ngày đầu.
- [ ] Kiểm tra mọi session của tuần đầu đã được sinh ở `Sessions`, không còn lớp đã mở mà chưa có buổi.
- [ ] Kiểm tra học viên nào đã có order nhưng chưa có invoice, đã có invoice nhưng chưa duyệt, đã duyệt nhưng chưa gắn lớp.
- [ ] Kiểm tra các ticket mở còn tồn, nhất là nhóm đổi lịch, thay giáo viên, phụ huynh cần phản hồi, yêu cầu `test trải nghiệm/xếp lớp`.
- [ ] Kiểm tra `Pending Approvals` và xử lý dứt điểm hoặc tạo danh sách việc chuyển ca rõ ràng.
- [ ] Kiểm tra giáo viên nào còn thiếu tài liệu giảng dạy, thiếu lịch dạy hoặc chưa nắm quy trình attendance và report.
- [ ] Kiểm tra sale nào còn lead nóng chưa follow-up, khách hẹn đến trung tâm ngày khai trương nhưng chưa có owner rõ ràng.
- [ ] Kiểm tra kế toán đã chốt quy trình nhận tiền trong ngày đầu: ai nhận, ai nhập, ai duyệt, ai kiểm tra cuối ngày.
- [ ] Gửi bản phân công vận hành ngày đầu cho toàn bộ đội ngũ và yêu cầu xác nhận đã đọc.

## 11. Checklist ngày khai trương và 3 ngày đầu vận hành

### 11.1. Trước giờ mở cửa

- [ ] Director mở `Dashboard` và xác nhận 5 đầu việc ưu tiên trong ngày: tuyển sinh, lớp bắt đầu, việc chờ duyệt, ticket quan trọng, thu tiền.
- [ ] OPS mở `Classes`, `Sessions`, `Pending Approvals`, `Tickets` để rà các lớp bắt đầu trong 2 giờ đầu.
- [ ] Sale mở `Leads`, `Orders`, `Conversations`, `Notifications` để kiểm tra khách hẹn, lead nóng, tin nhắn chờ tiếp quản.
- [ ] Giáo viên mở `Teacher Calendar`, `Sessions`, `Attendance`, `Teaching Materials` để chuẩn bị tài liệu và link điểm danh.
- [ ] Kế toán mở `Invoices`, `Wallets`, `Financial Control` để sẵn sàng duyệt và ghi nhận phát sinh ngay trong ngày.

### 11.2. Trong giờ hoạt động

- [ ] Mọi khách mới phát sinh phải đi qua `Leads` trước, không bỏ qua CRM rồi nhập thẳng order nếu chưa có lý do chính đáng.
- [ ] Mọi học viên vào lớp phải có roster đúng trong `Classes`; nếu danh sách thực tế khác roster, OPS phải sửa ngay ở lớp nguồn.
- [ ] Mọi buổi dạy phải có attendance cùng ngày; giáo viên không để dồn attendance sang ngày hôm sau.
- [ ] Sau buổi dạy, giáo viên nộp teaching report trong ngày; OPS rà cuối ca và nhắc ngay các buổi còn thiếu.
- [ ] Mọi thay đổi liên quan đến lớp, giáo viên, lịch dạy, phản ánh phụ huynh phải có ticket hoặc comment điều phối.
- [ ] Mọi khoản tiền nhận trong ngày phải có dấu vết chứng từ, trạng thái hóa đơn hoặc top-up ví; không giữ ở tin nhắn riêng.

### 11.3. Cuối ngày

- [ ] Director họp chốt ngày 15 đến 20 phút và review số lead mới, số order tạo, số order duyệt, số lớp chạy, sự cố phát sinh, doanh thu ghi nhận.
- [ ] OPS lọc `Sessions` để xử lý các buổi `TEACHER_COMPLETED` đủ điều kiện finalize và ghi chú rõ các buổi còn treo.
- [ ] Giáo viên kiểm tra còn buổi `SCHEDULED` nào đáng lẽ đã dạy nhưng chưa cập nhật trạng thái, còn report nào chưa nộp, còn ticket nào chưa phản hồi.
- [ ] Kế toán review hóa đơn chờ duyệt, top-up chờ duyệt, khoản chưa reconcile và lập danh sách việc tài chính chuyển sang ngày sau.
- [ ] Sale review lead follow-up sang ngày mai, khách chưa chốt, khách cần gửi proposal hoặc nhắc lịch `test trải nghiệm`.
- [ ] Tất cả vai trò kiểm tra `Notifications` trước khi đăng xuất để không bỏ sót việc.

## 12. Checklist vận hành hằng ngày sau khai trương

### 12.1. Director

- [ ] Xem `Dashboard` đầu ngày và cuối ngày; mục tiêu là biết trạng thái kinh doanh, vận hành, tài chính trong 5 phút đầu.
- [ ] Review `Pending Approvals` ít nhất 2 lần/ngày để không kẹt order, invoice, payroll, request đổi lịch.
- [ ] Review `Financial Control` và `Aging Report` hằng ngày trong 2 tuần đầu để phát hiện lệch quy trình ngay khi hệ thống còn mới.
- [ ] Review `Audit Log` tối thiểu 3 lần/tuần trong tháng đầu để phát hiện việc sửa dữ liệu nhạy cảm không đúng người.
- [ ] Review `Teacher KPI`, `Employee Performance`, `Commission Report` theo chu kỳ tuần để điều chỉnh người phụ trách và thưởng phạt kịp thời.

### 12.2. Sale

- [ ] Mở `Dashboard Sale` đầu ngày và ghi ra 3 nhóm việc: follow-up hôm nay, lead nóng, order đang chờ thông tin.
- [ ] Mọi cuộc gọi, chat, gặp trực tiếp phải để lại contact log và ngày hẹn tiếp theo trong `Leads`.
- [ ] Không tạo order cho khách cũ nếu chưa tìm lại parent và student cũ trên hệ thống.
- [ ] Sau khi gửi duyệt order, phải theo dõi cho đến khi biết rõ approved, needs info, reject hay cancel; không dừng ở trạng thái submitted.
- [ ] Cuối ngày, mỗi sale phải có danh sách lead chuyển sang ngày sau và các lead quá hạn phải giải trình lý do.

### 12.3. OPS

- [ ] Mỗi sáng rà `Classes` và `Sessions` để bảo đảm lớp nào cũng có đúng giáo viên, đúng roster, đúng khung giờ.
- [ ] Mỗi chiều rà `Attendance`, `Teaching Report`, `Tickets`, `Pending Approvals` để đóng vòng vận hành trong ngày.
- [ ] Buổi nào có nguy cơ thiếu giáo viên, thiếu phòng, thiếu học viên hoặc roster sai phải được xử lý trước giờ học tối thiểu 2 giờ.
- [ ] Không điều phối giáo viên chỉ bằng chat; phải cập nhật lớp nguồn hoặc session source, đồng thời để lại dấu vết trên ticket.
- [ ] Cuối ngày phải có danh sách buổi treo, ticket mở, request đổi lịch chưa xong và người chịu trách nhiệm tiếp tục xử lý.

### 12.4. Teacher

- [ ] Kiểm tra lịch dạy, tài liệu, danh sách lớp trước giờ dạy.
- [ ] Điểm danh đúng ngày, đúng lớp và theo dõi học viên chưa submit nếu dùng link check-in.
- [ ] Nộp teaching report trong ngày và kiểm tra lại các buổi đã đủ điều kiện tính lương.
- [ ] Tạo request xin nghỉ hoặc thay thế càng sớm càng tốt nếu có phát sinh; không báo miệng sát giờ.
- [ ] Đăng xuất đúng quy trình để `Work Sessions` ghi nhận đầy đủ, tránh phát sinh auto-close không cần thiết.

### 12.5. Accounting

- [ ] Rà `Invoices`, `Wallets`, `Financial Control` ít nhất 2 lần/ngày trong tháng đầu.
- [ ] Duyệt chứng từ dựa trên tiền thực nhận và ảnh biên lai, không chỉ theo mô tả trong chat.
- [ ] Đối soát các giao dịch mới trong ngày và lập danh sách giao dịch treo cuối ngày nếu chưa reconcile được.
- [ ] Theo dõi các buổi payroll bị chặn để nhắc OPS hoặc giáo viên bổ sung attendance/report kịp kỳ lương.
- [ ] Cuối ngày phải biết rõ doanh thu ghi nhận, số tiền chờ duyệt, số tiền đã vào ví, số mục chưa đối soát.

## 13. Checklist review hằng tuần

- [ ] Review số lead mới theo nguồn, conversion lead sang order, tỷ lệ lead stale và tỷ lệ follow-up đúng hạn.
- [ ] Review số `test trải nghiệm` đã tổ chức, tỷ lệ `test trải nghiệm -> xếp lớp`, và lý do khách chưa chốt sau test.
- [ ] Review tỷ lệ lấp đầy lớp, lớp dưới sĩ số tối thiểu, lớp vượt sĩ số tối đa, lớp cần gộp hoặc tách.
- [ ] Review số buổi đã dạy, số buổi chưa finalize, số buổi thiếu attendance, số buổi thiếu teaching report.
- [ ] Review ticket quá hạn, nhóm lỗi lặp lại nhiều nhất và bộ phận gây tắc nghẽn nhiều nhất.
- [ ] Review hóa đơn chờ duyệt, công nợ quá hạn, giao dịch chưa đối soát, top-up treo, phiếu chi chờ xử lý.
- [ ] Review `Work Sessions` để phát hiện nhân sự thường xuyên đi muộn, auto-close nhiều, check-in/check-out bất thường.
- [ ] Review phản hồi phụ huynh, yêu cầu đổi ca, yêu cầu chuyển lớp, khiếu nại chất lượng để ưu tiên xử lý sớm.

## 14. Checklist review hằng tháng

- [ ] Chốt doanh thu theo sản phẩm, theo nguồn lead, theo sale, theo lớp và so sánh với kế hoạch tháng.
- [ ] Chốt P&L tháng tại `Financial Control`, xác nhận doanh thu, chi phí, lợi nhuận gộp, lợi nhuận ròng và runway.
- [ ] Chốt lương giáo viên, lương nhân sự, hoa hồng sale, các khoản thưởng phạt và đối chiếu với dữ liệu attendance/report/work session.
- [ ] Review `Teacher KPI` và `Employee Performance` để quyết định đào tạo lại, tăng ca, giảm ca hoặc điều chuyển.
- [ ] Review tỷ lệ nghỉ học, bảo lưu, chuyển lớp, hoàn tiền và nhóm nguyên nhân chính khiến học viên rời đi.
- [ ] Review hiệu quả marketing nếu có dùng `Ads Management`, `Ads Analytics`, `Landing Pages`, `Conversations`.
- [ ] Review `Audit Log` theo tháng cho các thao tác nhạy cảm và lập danh sách vấn đề kiểm soát nội bộ cần siết lại.

## 15. Bộ chỉ số giám sát nên treo và cảnh báo mỗi ngày

- [ ] Lead quá hạn follow-up: nếu tăng liên tục 2 ngày, Director phải xử lý lại phân bổ và kỷ luật quy trình.
- [ ] Order chờ duyệt quá SLA: nếu có đơn treo quá 24 giờ làm việc, phải xác định tắc ở sale, OPS hay Director.
- [ ] Invoice chờ duyệt quá 1 ngày: phải xem lại quy trình nộp chứng từ hoặc năng lực xử lý của kế toán.
- [ ] Session đã dạy nhưng chưa finalize cuối ngày: phải xem OPS có đang bỏ sót chốt buổi hay không.
- [ ] Buổi có attendance nhưng thiếu teaching report: phải nhắc giáo viên trong ngày, không để dồn sang kỳ lương.
- [ ] Ticket quá hạn hoặc bị mở lại nhiều lần: đây là dấu hiệu SOP chưa rõ hoặc phối hợp liên phòng ban đang yếu.
- [ ] Lớp có roster sai hoặc thay đổi liên tục: cần kiểm tra lại luồng sale bàn giao sang OPS.
- [ ] `Work Sessions` auto-close nhiều: có thể nhân sự chưa tuân thủ chấm công hoặc có vấn đề về thói quen đăng xuất.
- [ ] Giao dịch ngân hàng chưa đối soát và bút toán hệ thống chưa khớp: phải xử lý trước khi chốt tuần.
- [ ] Công nợ tăng nhưng attendance vẫn diễn ra: phải siết lại rule xếp lớp khi hóa đơn chưa đạt điều kiện tài chính.

## 16. Checklist phản ứng nhanh cho sự cố phổ biến

- [ ] Giáo viên xin nghỉ đột xuất: tạo ticket ngay, điều phối giáo viên thay ở `Classes` hoặc session liên quan, cập nhật phụ huynh, kiểm tra lại lịch và teaching material của người dạy thay.
- [ ] Phụ huynh báo đã chuyển tiền nhưng hệ thống chưa có chứng từ hợp lệ: yêu cầu biên lai, tạo hoặc cập nhật invoice, để kế toán đối chiếu tại `Invoices` hoặc `Wallets`, không xác nhận miệng.
- [ ] Học viên đến học nhưng không có trên roster: OPS sửa roster ở `Classes` trước, sau đó mới điểm danh.
- [ ] Buổi học đã diễn ra nhưng thiếu attendance hoặc report: yêu cầu giáo viên bổ sung trong ngày, OPS kiểm tra lại rồi mới finalize session.
- [ ] Sale tạo nhầm parent hoặc student trùng: rà dữ liệu ở `Users` và `Students`, khóa quy trình tìm kiếm trước khi tạo mới, ghi rõ owner thật.
- [ ] Đơn đã được duyệt nhưng học viên chưa xếp lớp: tạo ticket bàn giao và chỉ định thời hạn xử lý ngay trong ngày.
- [ ] Phụ huynh khiếu nại chất lượng lớp: mở ticket, gắn lớp, giáo viên, session liên quan, ghi rõ mức độ ưu tiên và thời hạn phản hồi.
- [ ] Kế toán phát hiện giao dịch chưa đối soát: ghi nhận trong `Financial Control` hoặc `Bank Reconciliation`, không tự sửa số dư bằng tay nếu chưa rõ nguyên nhân.

## 17. Danh sách 10 bài test end-to-end nên chạy lại mỗi khi có thay đổi lớn

- [ ] Test 1: tạo lead mới, follow-up, convert sang order, gửi duyệt, approved, phát sinh invoice.
- [ ] Test 2: tạo parent cũ có 2 học viên, bán thêm gói mới cho một học viên cũ, không nhân đôi dữ liệu.
- [ ] Test 3: tạo lớp mới, gắn roster, bulk create session, điểm danh, nộp teaching report, finalize buổi.
- [ ] Test 4: tạo `test trải nghiệm`, chốt kết quả xếp lớp hoặc chưa chốt, kiểm tra lịch sử assessment và đề xuất lớp.
- [ ] Test 5: nạp ví phụ huynh, duyệt top-up, kiểm tra ledger và số dư.
- [ ] Test 6: duyệt invoice có chứng từ, xem aging và dòng tiền downstream.
- [ ] Test 7: login/logout work session, xem case đi muộn, auto-close và báo cáo tổng hợp.
- [ ] Test 8: tạo ticket điều phối giáo viên, cập nhật lớp, đóng ticket sau khi xử lý xong.
- [ ] Test 9: chốt payroll giáo viên với case đủ dữ liệu và case thiếu teaching report.
- [ ] Test 10: rà audit log sau các thao tác nhạy cảm để bảo đảm hệ thống vẫn truy vết được.

## 18. Kết quả mong muốn sau 30 ngày vận hành

- [ ] 100 phần trăm lead mới được tạo trên hệ thống và có owner rõ ràng.
- [ ] 100 phần trăm order mới đi qua luồng duyệt chuẩn, không có đơn miệng ngoài hệ thống.
- [ ] 100 phần trăm học viên đang học có parent, student, lớp và trạng thái tài chính truy vết được.
- [ ] 100 phần trăm buổi học đã diễn ra có attendance và teaching report trong ngày hoặc có ticket giải trình.
- [ ] 100 phần trăm tiền thu trong ngày có dấu vết invoice, top-up, biên lai hoặc bút toán đối soát.
- [ ] Director có thể nhìn dashboard và báo cáo để biết ngay vấn đề lớn trong ngày mà không cần hỏi từng bộ phận bằng tay.

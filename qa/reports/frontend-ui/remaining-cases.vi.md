# Danh Sach Sach Cac Tinh Huong Frontend UI Con Lai

## Nguon Doi Soat

- Checklist goc: `C:\Users\PC\Documents\code\vuitran\qa\checklists\frontend-ui\testfrontendui.md`
- Coverage moi nhat: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\EXECUTION-RESULTS-ALL.vi.md`
- Regression bo sung: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_Deep_Regression_20260408.md`
- Quy uoc cua file nay: chi giu cac tinh huong con lai sau khi da loai `126` case `PASS` da sync nguoc vao checklist goc.

## Snapshot

- Tong case con lai thuc te: `0`
- Case con lai trong `B01` den `B11`: `0`
- Case con lai trong `Nhom 12`: `0`
- Luu y: day la backlog coverage nghiem ngat, khong phai so blocker showcase. Trang thai showcase-ready duoc tach rieng tai `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\showcase-ready.vi.md`.
- `B05`, `B06`, `B11`: blocker `attendance link expiry` da duoc recheck `PASS` trong Dot 0; khong con xem la blocker nghiep vu. Luu y batch UI `session-revenue-first-10` hien con vach ra van de automation tiep theo o buoc teaching report.
- `B09`: blocker backend `property status should not exist` cho nhanh tao moi token/profile trong `chatbot-settings` da duoc recheck `PASS` trong Dot 0.
- Log doi soat Dot 0: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_DOT0_EXECUTION_20260408.vi.md`

## Case Da Sync Them Tu Reconcile 2026-04-10 va 2026-04-11

- `B01`: `3` case
  - `Unknown route fallback theo current wildcard contract`
  - `Change-password success browser flow`
  - `Change-password validation + wrong-current-password browser flow`

- `B03`: `8` case
  - `Parent ads attribution`
  - `Parent owner transfer with confirm + sale-scoped views`
  - `Users-management over-permission browser contrast`
  - `Users self-edit safe flow`
  - `Agent tier matrix browser flow`
  - `Teacher onboarding + salary config browser flow`
  - `Product deactivation + sale-order guard`
  - `Teacher deactivation browser flow`
- `B04`: `14` case
  - `Lead edit/contact/assign browser lifecycle`
  - `Lead reassign browser lifecycle`
  - `Lead attribution merge timeline browser lifecycle`
  - `Lead convert-to-order browser handoff`
  - `Order reject browser lifecycle`
  - `Order request-more-info browser lifecycle`
  - `Order approval linked-views browser lifecycle`
  - `Installment payment-plan browser lifecycle`
  - `Installment deferred-revenue browser lifecycle`
  - `Package-class-mode pricing browser lifecycle`
  - `Partial payment browser lifecycle`
  - `Order cancel linked-views browser lifecycle`
  - `Trial zero-amount browser lifecycle`
  - `Trial teacher-paid-only browser lifecycle`
- `B04/B09 cross-cutting`: `1` case
  - `Tao order tu conversation chatbot giu dung du lieu nguon`
- `B05`: `21` case
  - `Sua lop hien co va reload du lieu dung`
  - `Xoa lop hien thi confirm va xu ly trang thai dung`
  - `Cau hinh rieng cho hoc sinh trong lop hoat dong dung`
  - `Student Configs cho phep gan mot hoc sinh nhieu slot hoac nhieu giao vien khac nhau trong cung mot lop, hien thi dung o form, detail lop va lich sau khi luu`
  - `Luong pending class update approve/reject hoat dong dung`
  - `Teacher swap margin warning truoc khi gui duyet`
  - `Session-change approval cap nhat pending hub va sessions`
  - `Sale-side session-change request CTA/form/history browser flow`
  - `Teacher swap conflict-validation browser flow`
  - `Session reschedule browser flow`
  - `Calendar Overview teacher/class filters browser flow`
  - `View detail session hien thi du thong tin`
  - `Teacher complete modal bat buoc du Noi dung, Bai tap, Ghi chu`
  - `Auto-confirm source hien thi ro la He thong`
  - `Cancel session cap nhat badge, so lieu, va metadata huy`
  - `Debt-limit warning surfaced on sessions finalize without silent close`
  - `Mark all present hoat dong dung`
  - `Save attendance chi enable khi dirty va khoa lai sau reload`
  - `Copy link diem danh copy/fallback ro rang theo current single-dialog contract`
  - `Attendance report filter, pagination, va preview anh`
  - `Parent attendance scoped data for current parent`
- `B06`: `12` case
  - `Teacher profile tai ho so hien tai dung`
  - `Teacher profile them/xoa qualification + availability`
  - `Parent confirm 1-5 sao + success feedback`
  - `Low-rating visibility for OPS on sessions row/detail`
  - `Teacher payroll preview 5 groups`
  - `Teacher KPI filter/sort/detail`
  - `Teacher KPI penalty visibility`
  - `Bulk teaching report offline`
  - `General-feedback surface + persistence`
  - `Teaching materials drag-drop`
  - `Teaching materials load more`
  - `Teaching materials empty/error state`
- `B09`: `23` case
  - notifications click-to-read + polling
  - bulk notifications group-select/preview/confirm/partial-failure result
  - internal messages
  - chatbot conversation core + realtime
  - create lead/order tu conversation
  - chatbot auto-reply toggle
  - expired OpenAI token visible state
  - parent support context/send
  - ticket tabs/deep-link/open-source-conversation
  - refund ticket close warning when refund ledger is missing
- `B10`: `14` case
  - ads management tabs/actionable-tasks/CRUD/sync
  - ads analytics breadth + role visibility
  - landing management/copy-link
  - public invalid slug/submit error/tracking/custom head-body cleanup
  - trigger-sync/backfill loading + clear result feedback on current modal/alert contract
- `B11`: `6` case
  - `Teaching report inline update + parent/sale guard`
  - `Student report filter + preview image`
  - `Comprehensive report filter`
  - `Export UTF-8 BOM`
  - `Streaming export 50,000+ rows`
  - `Employee performance dashboard load/filter/detail`
- `B07/B08`: `18` case
  - `Aging report filter + bucket label`
  - `Wallet pending count tren /app/wallets`
  - `Reject top-up cap nhat REJECTED + khong doi balance`
  - `Parent top-up with uploaded receipt stays pending, preserves receipt proof, and appears in accounting pending approvals`
  - `Supplier quotes create/edit/send/accept/reject/delete lifecycle`
  - `Supplier payments create/edit/approve/reject/mark-paid/delete lifecycle`
  - `Loans create -> activate -> record payment -> update overdue lifecycle`
  - `Cross-surface finance side effects reflected across invoice, wallet, payroll, expense, and supplier-payment UIs`
  - `Financial-control create bank account / bank transaction / fund / fund transaction`
  - `Financial-control edit bank account / fund update flow`
  - `Financial-control tabs render provisional gross profit / bank / funds / cashflow / P&L seeded data`
  - `Financial-control tab switching clears stale bank/fund selection state and reopens transaction forms with clean defaults`
  - `Financial Alerts render severity colors and attached actions open the correct handling context`
  - `Financial-control reconcile transaction toggles row state and recomputes unreconciled report counter`
  - `Bank reconciliation report runs and reflects current matched-unmatched result`
  - `Bank Reconciliation splits Matched and Unmatched rows, count, and amount without mixing groups`
  - `Work-sessions late + early-leave red badge visibility`
  - `Bulk staff-payroll partial success counts + ordered error list`
  - `Teacher payroll preview/generate/update/submit/approve/reject/reopen/mark-paid/delete lifecycle`
- `Nhom 12`: `26` case
  - `Empty state cross-surface`
  - `Error state cross-surface`
  - `Loading state + single-submit guard cross-surface`
  - `Dashboard friendly empty-state + CTA for fresh SALE and parent-without-child`
  - `Flow Guide / Mo ta luong cross-surface`
  - `vi-VN date-time + currency consistency cross-surface`
  - `Responsive stability across mobile / tablet / narrow desktop representative surfaces`
  - `Scroll/load-more/layout stability across cards, wide tables, and long thread pinning`
  - `Multi-tab badge/state sync when another tab mutates notifications or pending approvals`
  - `Basic accessibility on login and internal main screen: labels, keyboard flow, contrast`
  - `Submit disabled while pending`
  - `Modal dirty-state reset cross-surface`
  - `Double click guard cross-surface`
  - `Refresh-state cross-surface`
  - `Search/filter/sort/pagination reset`
  - `Shareholder read-only on investor-dashboard, aging-report, financial-control`
  - `Accounting khong thay CTA Tao khoan vay tren /app/loans`
  - `Rate-limit 429 hien thong bao than thien tren login`
  - `Teacher khong thay nut Chot buoi hoc tren /app/sessions`
  - `Invoice delete action hidden cho ACCOUNTING/SALE/OPS tren /app/invoices`
  - `OPS khong thay CTA Chuyen tien tren /app/wallets`
  - `Accounting read-only across classes and students reconciliation surfaces`
  - `Deep-link/query param mo dung screen/state`
  - `Upload error surface dung khi face upload fail`
  - `Preview image/modal khong vo UI`
  - `Cross-surface form validation dung tren required/missing data`
- Nguon authoritative:
  - `qa/reports/frontend-ui/WAVE3-PROGRESS-20260410.vi.md`
  - `qa/reports/frontend-ui/WAVE4-PROGRESS-20260410.vi.md`
  - `qa/checklists/frontend-ui/testfrontendui.md`

## 72 Case Da Loai Khoi Backlog Tu Dot 2026-04-08

### B01 - 9 case

- `P0` Dang nhap bi gioi han thu qua nhieu lan hien thi thong bao phu hop.
- `P0` Nut hien/an mat khau hoat dong dung.
- `P0` Trang thai loading khi submit login khoa nut va tranh submit lap.
- `P0` Refresh trang khi da dang nhap van restore session tu cookie.
- `P0` Dang o man hinh noi bo nhung API tra `401` thi bi logout va ve `login`.
- `P0` Menu trai hien thi dung theo role.
- `P0` Badge thong bao va cho duyet hien thi dung, cap nhat dung.
- `P0` Loading bar khi chuyen route hien thi va bien mat dung thoi diem.
- `P1` Link active trong sidebar dung theo route va query param.

### B02 - 16 case

- `P0` Dashboard co skeleton/loading state trong luc tai.
- `P0` Dashboard co error state va nut tai lai khi API loi.
- `P1` Banner handbook hien thi dung theo role.
- `P1` Widget, card, so lieu va CTA khong lo du lieu sai role.
- `P1` Trang "Cam nang noi bo" hien thi dung noi dung cau hinh theo Role dang dang nhap.
- `P0` Chuyen qua lai giua cac tab trong Pending Approvals khong bi vo layout, hien thi dung list du lieu.
- `P0` Badge so luong (Count) hien thi o tung tab va tren Menu Sidebar phai khop nhau.
- `P0` Phe duyet (Approve) va Tu choi (Reject) ngay tai Hub cap nhat trang thai UI va giam so luong dem realtime.
- `P1` Investor Dashboard van render duoc phan con song khi mot widget/bieu do loi rieng le, khong lam sap toan trang; cac filter thoi gian `3/6/12 thang` doi dung du lieu theo tung khoi.
- `P1` UI Preview (xem truoc) thay doi thoi luong hoc sinh o tab `Sua lop` render chinh xac truoc/sau thay doi.
- `P1` Click vao cac Quick Links trong Cam nang dieu huong chinh xac.
- `P1` Cac Video va Anh minh hoa (Gallery) tai va hien thi dung ma khong vo UI.

### B03 - 5 case

- `P1` Upload anh khuon mat hoc sinh thanh cong va xu ly loi upload dung.
- `P1` Vo hieu hoa Giao vien (Deactivate/Lock) co confirm ro rang, doi trang thai dung tren list/detail va an cac action khong con hop le.
- `P1` Tu sua tai khoan cua chinh minh mo duoc self-edit modal an toan, khoa role selector, giu delete an, va luu dung thong tin co ban ma khong dot bien role.
- `P0` Tao moi dai ly giu dung exact tier + commission pairing cho SILVER, GOLD, PLATINUM tren payload, row/detail, va tier filter.
- `P1` Onboarding Giao vien moi tao cung luc salary config mac dinh, validate du truong bat buoc, va phan anh dung tren man Cau hinh luong ngay sau khi tao.

### B04 - 2 case

- `P0` Approve order cap nhat dung badge, pipeline va du lieu lien quan.
- `P0` Convert lead sang order dung du lieu.

### B06 - 4 case

- `P1` Teacher profile luu dung `bankInfo` voi validation day du cho ten ngan hang, so tai khoan, chu tai khoan.
- `P1` Teacher substitute request tao yeu cau moi dung.
- `P1` Form xin nghi hoac thay the cua giao vien bat buoc `Den ngay >= Tu ngay`, hien thi validation ro va khong cho submit neu khoang ngay khong hop le.
- `P1` Form `general-feedback` hien thi day du cac truong `teachingQuality`, `communication`, `facility` va luu dung danh gia tong quat cua phu huynh/hoc sinh.

### B07 - 0 case

- Khong con case mo.

### B09 - 12 case

- `P0` Notifications load dung danh sach va unread count.
- `P0` Mark all notifications as read hoat dong dung.
- `P1` Filter all/unread va phan trang notifications hoat dong dung.
- `P0` Man `chatbot-settings` tai dung cac section Fanpages, OpenAI Tokens, AI Assistant Profiles theo role phu hop.
- `P0` CRUD fanpage trong `chatbot-settings` hoat dong dung, co loading va thong bao loi/thanh cong ro rang.
- `P0` API/Page token cua Fanpage trong `chatbot-settings` hien thi dang masked (`••••••`) o list/detail, khong lo full token neu chua co action xem ro duoc cap quyen.
- `P0` CRUD OpenAI token trong `chatbot-settings` hoat dong dung, token nhay cam khong bi lo sai tren UI.
- `P0` Form cau hinh AI trong `chatbot-settings` luu va validate dung cac field `System Prompt`, `Temperature`, `Max Tokens`, phan anh lai dung gia tri sau reload.
- `P1` CRUD AI assistant profile trong `chatbot-settings` hoat dong dung va phan anh dung loai assistant dang chon.
- `P0` Ticket handoff banner va link sang ticket hien thi dung trong parent support chat.
- `P0` AI suggest preview-only on agent support queue
- `P1` Update priority ticket hoat dong dung.

### B10 - 0 case

- [x] `P0` Public landing page load dung theo slug. `(sync evidence 2026-04-08)`
- [x] `P0` Submit form public landing page thanh cong va hien thi success state. `(sync evidence 2026-04-08)`

### B11 - 0 case

- [x] `P1` Export reports tai file dung loai bao cao. `(sync evidence 2026-04-08)`

### B05 - 7 case

- `P0` Tao lop moi voi du lieu toi thieu.
- `P0` Khi sua gia lop hoac don gia cau hinh, UI van giu nguyen `amountCharged` cua cac session lich su; phan lich su/phat sinh cu khong bi thay doi theo gia moi.
- `P0` Gan hoc sinh vao lop hoat dong dung.
- `P0` Tao session don va bulk create session hoat dong dung.
- `P0` Teacher complete session hoat dong dung.
- `P0` Finalize session cap nhat trang thai dung.
- `P0` Remove session hoat dong dung neu role cho phep.
- `P0` Bulk Attendance cho lop Offline hien thi dung toan bo hoc sinh trong lop va luu hang loat khong sai mapping hoc sinh-trang thai.

### B06 - 0 case

- [x] `P1` Teacher profiles list va profile detail hoat dong dung. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Approve teacher profile hoat dong dung voi role phu hop. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teacher calendar chuyen thang, xem session theo ngay dung. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Parent calendar chuyen thang, xem session theo ngay dung. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Parent invoices chi hien thi invoice dung pham vi. `(sync automation 2026-04-08 follow-up UI)`
- [x] `P1` Teaching materials filter theo tu khoa, subject, grade, class, type, extraction status hoat dong dung. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teaching materials upload file bang chon file hoat dong dung. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teaching materials download, reprocess, delete hoat dong dung. `(sync automation 2026-04-08 B05/B06/B11)`

### B11 - 0 case

- [x] `P1` Attendance report filter theo lop/ngay va phan trang dung. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Employee performance khong lo du lieu hoac action sai role khi truy cap truc tiep bang URL. `(sync automation 2026-04-08 B05/B06/B11)`
- [x] `P1` Teaching report pending/completed, filter thang, teacher code lookup, submit/edit dung. `(sync automation 2026-04-08 follow-up UI)`
- [x] `P1` Audit log filter, pagination, thong ke hien thi dung. `(sync automation 2026-04-08 follow-up UI)`
- [x] `P1` Audit log chi doc, khong co hanh vi sua du lieu. `(sync automation 2026-04-08 follow-up UI)`

## Nhom 1. Auth, Session, Routing, App Shell - 0 case con lai

- [x] `P0` Man hinh doi mat khau submit thanh cong voi mat khau cu dung va hien thi thong bao hoan tat ro rang. `(sync authoritative 2026-04-11 B01 change-password browser)`
- [x] `P0` Man hinh doi mat khau hien thi validation dung khi mat khau cu sai, mat khau moi yeu hoac confirm khong khop. `(sync authoritative 2026-04-11 B01 change-password browser)`

## Nhom 3. Quan Ly Nguoi Dung, Hoc Sinh, San Pham, Dai Ly - 0 case con lai

- [x] `P1` Khong cho xoa hoac sua vuot quyen. `(sync authoritative 2026-04-11 B03 users-over-permission browser)`
- [x] `P1` Tu sua tai khoan cua chinh minh khong gay loi quyen hoac trang thai bat thuong. `(sync authoritative 2026-04-11 B03 users-self-edit browser)`
- [x] `P1` UI lien ket mot hoc sinh voi nhieu phu huynh hien thi dung danh sach parent va khong ghi de nham owner hien tai. `(sync authoritative 2026-04-11 B03 students multi-parent browser)`
- [x] `P1` Hoc sinh co nhieu phu huynh van hien thi dung thong tin o form/detail/list va thao tac luu khong mat lien ket phu. `(sync authoritative 2026-04-11 B03 students multi-parent browser)`
- Khong con case mo.
- [x] `P1` Chuyen giao hoc sinh/parent owner tu Sale nay sang Sale khac hien thi ro Sale cu/Sale moi, co confirm va cap nhat dung owner o list, detail va bo loc lien quan. `(sync authoritative 2026-04-11 B03 parent-owner-transfer browser)`
- [x] `P1` Vo hieu hoa Giao vien (Deactivate/Lock) co confirm ro rang, doi trang thai dung tren list/detail va an cac action khong con hop le. `(sync authoritative 2026-04-11 B03 teacher-deactivation browser)`
- [x] `P0` Tao moi Dai ly voi cac hang (Tier) GOLD, SILVER, PLATINUM va muc hoa hong tuong ung. `(sync authoritative 2026-04-11 B03 agent-tier-matrix browser)`
- [x] `P1` Onboarding Giao vien moi cho phep thiet lap luon Salary Config mac dinh, validate du truong bat buoc va phan anh dung cau hinh luong ngay sau khi tao. `(sync authoritative 2026-04-11 B03 teacher-onboarding-salary-config browser)`

## Nhom 4. Sales Funnel: Leads, Orders, Trial Enrollments - 0 case con lai

- [x] `P0` Sua lead, cap nhat contact, gan sale. `(sync authoritative 2026-04-11 B04 lead edit-contact-assign browser)`
- [x] `P0` Reassign lead tu Sale nay sang Sale khac hien thi dung modal chon nguoi nhan, co confirm va cap nhat dung owner o list, detail va lich su thay doi. `(sync authoritative 2026-04-11 B04 lead-reassign browser)`
- [x] `P1` Lead detail hien thi Attribution Merge theo dang timeline touchpoints khi cung mot SDT co nhieu nguon marketing nhu Facebook va Google, thay vi chi giu mot nguon cuoi cung. `(sync authoritative 2026-04-11 B04 lead-attribution-merge-timeline browser)`
- [x] `P0` Convert lead sang order dung du lieu. `(sync authoritative 2026-04-11 B04 lead-convert-order browser)`
- [x] `P0` Mark lead lost, return to pool, xem stale/pool dung. `(sync authoritative 2026-04-11 B04 lead lifecycle browser)`
- [x] `P0` Chon package, lop, hinh thuc hoc va tinh gia dung. `(sync authoritative 2026-04-11 B04 package-class-mode-pricing browser)`
- [x] `P0` Installment hien thi dung so ky va so tien lien quan. `(sync authoritative 2026-04-11 B04 installment-payment-plan browser)`
- [x] `P0` Don hang tra gop hien thi ro lich thanh toan tung ky va phan anh dung tac dong len the `Deferred Revenue` hoac `Doanh thu cho thu` tren cac man tai chinh lien quan. `(sync authoritative 2026-04-11 B04 installment-deferred-revenue browser)`
- [x] `P0` Partial Payment hien thi ro so da thanh toan, so con thieu va badge/trang thai chua thanh toan du. `(sync authoritative 2026-04-11 B04 partial-payment browser)`
- [x] `P0` Trial `0d` hien thi dung badge va khong hien thi sai amount. `(sync authoritative 2026-04-11 B04 trial-zero-amount browser)`
- [x] `P1` Luong `trial/teacher-paid-only` cho phep chot hoc thu khong tiep tuc nhung van giu khoan luong cho Giao vien, dong thoi UI khong charge nham Phu huynh. `(sync authoritative 2026-04-11 B04 trial teacher-paid-only browser)`
- [x] `P0` Sau khi duyet order, cac man lien doi hien thi dung du lieu phat sinh: chi tiet order co `Invoice` phat sinh, man `Quan ly hoa don` thay invoice moi, man `Quan ly hoc sinh` thay hoc sinh duoc provision/lien ket dung, va menu theo role van chi hien dung cac muc duoc phep truy cap. `(sync authoritative 2026-04-11 B04 order-approval-linked-views browser)`
- [x] `P0` Reject order hien thi dung trang thai va ly do tu choi. `(sync authoritative 2026-04-11 B04 order-review-actions browser)`
- [x] `P0` Request more info hoat dong dung va phan anh tren UI. `(sync authoritative 2026-04-11 B04 order-review-actions browser)`
- [x] `P0` Cancel order cap nhat dung toan bo man lien quan. `(sync authoritative 2026-04-11 B04 order-cancel-linked-views browser)`
## Nhom 5. Classes, Sessions, Attendance - 0 case con lai

- [x] `P0` Lop Offline ho tro co-teaching cho phep chon nhieu giao vien (GV chinh, GV phu), hien thi dung vai tro tung giao vien va ca hai deu co quyen thao tac diem danh/bao cao theo cau hinh. `(sync authoritative 2026-04-11 B05 offline co-teaching browser)`
- [x] `P0` Teacher Swap cua lop hoac session hien thi ro giao vien cu/moi, validate xung dot lich hop ly va cap nhat dung lich, session detail va cac man lien quan sau khi doi. `(sync authoritative 2026-04-11 B05 teacher-swap conflict-validation browser; combined with 2026-04-10 propagation proof)`
- [x] `P0` Reschedule session hien thi form doi ngay/gio dung, validate xung dot lich hop ly va cap nhat lai lich su/session detail sau khi luu. `(sync authoritative 2026-04-11 B05 session-reschedule browser)`
- [x] `P1` Khi session da gan `Substitute Teacher`, UI an hoac chan nut diem danh cua Giao vien chinh, chi cho giao vien day thay thao tac cac action duoc phep. `(sync authoritative 2026-04-11 B05 substitute-attendance RBAC browser)`
- [x] `P0` Mark tung hoc sinh present/absent/late hoat dong dung. `(sync authoritative 2026-04-11 B05 attendance present-absent-late browser)`
- [x] `P0` O chi tiet Session (trang thai SCHEDULED), hien thi nut "Yeu cau thay doi" danh cho Sale. `(sync authoritative 2026-04-11 B05 sale-side session-change request browser)`
- [x] `P0` Sale submit yeu cau thay doi (doi gio hoc, doi GV) thanh cong. `(sync authoritative 2026-04-11 B05 sale-side session-change request browser)`
- [x] `P0` Lich su yeu cau thay doi (Request History) hien thi dung trong modal Session Detail. `(sync authoritative 2026-04-11 B05 sale-side session-change request browser)`
- [x] `P1` Man hinh "Calendar Overview" (Lich tong quan) filter dung theo Giao vien hoac Lop hoc. `(sync authoritative 2026-04-11 B05 calendar-overview teacher-class filters browser)`

## Nhom 6. Teacher Hub, Parent Pages, Teaching Materials - 0 case con lai

- [x] `P1` Man Teacher KPI hien thi ro tong so tien phat (Penalty) neu co, khong de chim trong so lieu phu hoac chi xuat hien o API/detail an. `(sync authoritative 2026-04-11 B06 teacher-kpi penalty visibility browser)`
- [x] `P1` Bang xem truoc luong cua giao vien chia ro thanh 5 nhom `Da thanh toan`, `Cho PH`, `Cho OPS`, `Thieu bao cao`, `Huy` de giao vien tu tracking tung buoi va tung khoan. `(sync authoritative 2026-04-11 B06 payroll preview browser)`
- [x] `P1` Form Bao cao giang day render dong dung cac truong theo Report Template dang ap dung, vi du Tu vung, Ngu phap, va luu/validate dung tung field dong. `(sync authoritative 2026-04-11 B06 teaching-report dynamic fields browser)`
- [x] `P1` Lop Offline co form `Bulk Teaching Report` de giao vien dien/nop hang loat cho nhieu hoc sinh hoac nhieu dong bao cao ma khong phai submit tay tung nguoi. `(sync authoritative 2026-04-11 B06 bulk teaching report browser)`
- [x] `P1` Form `general-feedback` hien thi day du cac truong `teachingQuality`, `communication`, `facility` va luu dung danh gia tong quat cua phu huynh/hoc sinh. `(sync authoritative 2026-04-11 B06 general-feedback browser)`
- [x] `P1` Rating thap (1-2 sao) phan anh ro tren UI OPS hoac cac man theo doi/canh bao lien quan de nguoi van hanh nhin thay ngay. `(sync authoritative 2026-04-11 B06 low-rating OPS browser)`

## Nhom 7. Invoices, Wallets, Payroll, Finance Core - 0 case con lai

- [x] `P0` Transfer vi hoat dong dung va validate du du lieu. `(sync authoritative 2026-04-11 B07 wallet transfer browser)`
- [x] `P0` Parent top-up voi upload receipt hoat dong dung. `(sync authoritative 2026-04-11 B07 parent top-up receipt browser)`
- [x] `P0` Payroll giao vien preview/generate/update/submit/approve/reject/reopen/mark paid/delete hoat dong dung. `(sync authoritative 2026-04-11 B07 teacher-payroll browser)`
- [x] `P0` Payroll preview hien thi ro khoan phat (Penalty) do nop tre bao cao, khong gop mo ho vao tong luong. `(sync authoritative 2026-04-11 B07 payroll-late-penalty browser)`
- [x] `P0` Payroll preview cho lop Offline hien thi ro Min Payout Guarantee khi hoc sinh vang nhieu, tach bach voi phan luong day thuc te va giai thich duoc ly do bao chung. `(sync authoritative 2026-04-11 B07 payroll-offline-min-payout-guarantee browser)`
- [x] `P0` Exclude Payroll bat buoc nhap ly do, hien thi validation ro neu bo trong va phan anh dung trang thai sau khi loai tru. `(sync authoritative 2026-04-11 B07 exclude-payroll browser)`
 - [x] `P0` Staff payroll generate/edit/submit/approve/reject/reopen/mark paid/delete hoat dong dung. `(sync authoritative 2026-04-11 B07 staff-payroll browser)`
- [x] `P0` Bulk generate payroll hoat dong dung va tranh submit lap. `(sync authoritative 2026-04-11 B07 bulk-payroll browser)`
- [x] `P0` Bulk Payroll partial success hien thi ro ket qua kieu "Thanh cong 49, Loi 1" kem danh sach nguoi loi va nguyen nhan, thay vi chi bao loi chung chung cho toan batch. `(sync authoritative 2026-04-11 B07 bulk-payroll partial-success browser)`
- [x] `P1` Adjust Wallet bat buoc nhap ly do, hien thi validation ro neu bo trong va ghi nhan dung ly do tren UI/ledger preview. `(sync authoritative 2026-04-11 B07 adjust-wallet required-reason browser)`
- [x] `P1` Rollback hoac huy hoa don da duyet hien thi canh bao ro khi thao tac co the lam vi phu huynh am hoac phat sinh chenh lech so du. `(sync authoritative 2026-04-11 B07 finance rollback constraints browser)`
- [x] `P1` Work sessions filter, summary, edit hoat dong dung. `(sync authoritative 2026-04-11 B07 work-sessions browser)`
- [x] `P1` Man Work Sessions hien thi ro trang thai `AUTO_CLOSED` khi he thong tu dong dong ca do giao vien quen check-out, kem badge hoac ghi chu de giao vien nhan biet vi pham. `(sync authoritative 2026-04-11 B07 work-sessions AUTO_CLOSED browser)`
- [x] `P1` Work Sessions hien thi badge/mau do noi bat khi giao vien di muon (Late) hoac ve som (Early leave) so voi `scheduledStartTime` va gio ket thuc du kien. `(sync authoritative 2026-04-11 B07 work-sessions late/early leave browser)`

## Nhom 8. Finance Nang Cao: Expenses, Supplier, Loans, Financial Control, Bank Reconciliation - 0 case con lai

- [x] `P0` Expenses create/edit/approve/reject/mark paid hoat dong dung. `(sync authoritative 2026-04-11 B08 expenses browser)`
- [x] `P0` Expenses phan quyen dung giua nguoi tao, nguoi duyet va nguoi thanh toan. `(sync authoritative 2026-04-11 B08 expenses browser)`
- [x] `P0` Supplier quotes create/edit/send/accept/reject/delete hoat dong dung. `(sync authoritative 2026-04-11 B08 supplier-quotes browser)`
- [x] `P0` Supplier payments create/edit/approve/reject/mark paid/delete hoat dong dung. `(sync authoritative 2026-04-11 B08 supplier-payments browser)`
- [x] `P0` Loans create/activate/record payment/update overdue hoat dong dung. `(sync authoritative 2026-04-11 B08 loans browser)`
- [x] `P0` Financial control theo tab ngan hang/quy/cashflow/PnL/provisional gross profit hoat dong dung. `(sync authoritative 2026-04-11 B08 financial-control tabs browser)`
- [x] `P0` Financial Alerts hien thi dung severity theo mau: `CRITICAL` mau do, `WARNING` mau cam, va cac action dinh kem nhu `Nap quy`, `Xem chi tiet` dieu huong dung man hoac mo dung ngu canh xu ly. `(sync authoritative 2026-04-11 B08 financial-alerts browser)`
- [x] `P0` Tab P&L cho phep toggle giua 2 basis `CASH` va `ACCRUAL`, so lieu va label thay doi dung theo chuan ke toan duoc chon. `(sync authoritative 2026-04-10 B08 PnL-basis orchestrator)`
- [x] `P0` Surface sua `bank account` / `fund` va update flow tuong ung duoc proof tren UI `financial-control` hien tai. `(sync authoritative 2026-04-11 B08 financial-control edit bank/fund browser)`
- [x] `P0` Reconcile transaction cap nhat dung trang thai va bao cao. `(sync authoritative 2026-04-11 B08 financial-control reconcile browser)`
- [x] `P0` Bank reconciliation chay duoc va phan anh dung ket qua. `(sync authoritative 2026-04-11 B08 reconciliation-filters orchestrator)`
- [x] `P0` Man Bank Reconciliation boc tach ro danh sach giao dich `Matched` va `Unmatched`, hien thi dung count/amount va khong tron lan hai nhom. `(sync authoritative 2026-04-11 B08 reconciliation-filters orchestrator)`
- [x] `P0` Ke toan tu choi doi soat (Reject Reconciliation) cap nhat dung trang thai, ly do tu choi va danh sach giao dich/chenh lech con can xu ly. `(sync authoritative 2026-04-11 B08 reconciliation-reject browser)`
- [x] `P1` Chuyen tab tai chinh khong lam stale du lieu hoac vo state form. `(sync authoritative 2026-04-11 B08 financial-control tab-switch browser)`
- [x] `P1` Cac side effect tai chinh giua invoice, wallet, payroll, expense, supplier payment duoc phan anh dung tren UI. `(sync aggregate authoritative 2026-04-11 B07/B08 browser bundle)`

## Nhom 9. Notifications, Messages, Chatbot, Tickets - 0 case con lai

- [x] `P0` Admin/OPS gui thong bao hang loat hoat dong dung, co chon dung nhom nhan, preview noi dung, confirm gui va phan anh dung ket qua thanh cong/that bai. `(sync authoritative 2026-04-11 B09 bulk notifications browser)`
- [x] `P0` Man chat ho tro chi hien thi nut "Goi y AI" hoac Auto-suggest cho agent xem truoc noi dung, khong tu dong gui thang cau tra loi AI ra hoi thoai. `(sync authoritative 2026-04-11 B09 AI suggest preview-only browser)`

## Nhom 10. Ads, Landing Pages, Public Flows - 0 case con lai

- [x] `P1` Bam `Trigger Sync` hoac `Backfill` o man Ads Management hien thi trang thai loading va feedback ket qua success/error ro rang theo contract hien tai (`result modal` hoac `alert`). `(sync reconcile 2026-04-10 tu B10 same-day browser evidence)`

## Nhom 11. Reports, Export, Audit - 0 case con lai

- [x] `P1` Khi role `SHAREHOLDER` tai export/report, du lieu nhay cam nhu SDT phu huynh phai duoc masked hoac an danh dung tren file tai ve. `(sync authoritative 2026-04-11 B11 shareholder-masked export browser)`

## Nhom 12. Trang Thai Chung Can Test O Moi Man Hinh - 0 case con lai

- [x] `P0` Loading state hien thi ro va khong cho thao tac gay submit lap. `(sync authoritative 2026-04-10 NHOM12 loading-state browser)`
- [x] `P0` Dashboard cua user moi tinh nhu Sale chua co so lieu hoac Phu huynh chua co con hien thi empty state than thien, co huong dan/CTA phu hop thay vi dashboard loi, toan so `0d` hoac bieu do trong gay hieu nham. `(sync authoritative 2026-04-10 NHOM12 dashboard-empty-state browser)`
- [x] `P1` Widget `Flow Guide` hoac `Mo ta luong` mo/dong dung tren cac man co nhung, render dung tieu de, mo ta, checklist va khong lam vo layout khi thu gon/mo rong. `(sync authoritative 2026-04-10 NHOM12 flow-guide browser)`
- [x] `P0` Role `ACCOUNTING` duoc xem man Lop/Hoc sinh de doi soat nhung UI phai an toan bo nut `Sua`/`Xoa` hoac action thay doi du lieu tren cac man nay. `(sync authoritative 2026-04-10 NHOM12 accounting classes+students readonly browser)`
- [x] `P1` Scroll dai, bang lon, load them du lieu khong bi nhay layout bat thuong. `(sync authoritative 2026-04-10 NHOM12 scroll-layout browser)`
- [x] `P1` Du lieu format ngay gio, tien te theo `vi-VN` hien thi nhat quan. `(sync authoritative 2026-04-10 NHOM12 vi-VN-format browser)`
- [x] `P1` Responsive tren desktop hep, tablet va mobile khong vo bo cuc quan trong. `(sync authoritative 2026-04-10 NHOM12 responsive browser)`
- [x] `P2` Kiem tra behavior khi mo nhieu tab cung luc va trang thai thay doi o tab khac. `(sync authoritative 2026-04-10 NHOM12 multi-tab browser)`
- [x] `P2` Kiem tra accessibility co ban: focus, keyboard navigation, label form, contrast o man hinh chinh. `(sync authoritative 2026-04-10 NHOM12 accessibility browser)`





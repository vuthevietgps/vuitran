# Kich Ban Video 5 Phut Cho Nha Dau Tu

## Muc tieu

- Trong 5 phut, cho thay he thong da van hanh duoc o 4 lop:
  - dieu hanh
  - doanh thu
  - van hanh giang day
  - goc nhin nha dau tu
- Khong co gang show het tinh nang.
- Chi show nhung luong da co bang chung `PASS` hoac on dinh de demo.

## Tong thoi luong

- `00:00 - 00:30`: Mo dau
- `00:30 - 01:40`: Revenue flow
- `01:40 - 02:35`: Invoice / Wallet / Finance side effect
- `02:35 - 03:30`: Teaching operation
- `03:30 - 04:30`: Investor dashboard
- `04:30 - 05:00`: Chot thong diep

## Chuan bi truoc khi quay

- Mo san frontend: [http://localhost:4200](http://localhost:4200)
- Tai khoan can dung:
  - `director.demo@school.local`
  - `accounting.demo@school.local`
  - `teacher.demo@school.local`
- Mo san 3 tab hoac 3 profile:
  - `DIRECTOR`
  - `ACCOUNTING`
  - `TEACHER`
- Neu muon quay nhanh hon, login truoc va de san o cac trang:
  - `/app/orders`
  - `/app/invoices`
  - `/app/teaching-report`
  - `/app/investor-dashboard` hoac man `financial-control`

## Timeline quay

### 00:00 - 00:30

- Man hinh: dashboard hoac menu trai sau khi vao app.
- Loi noi:
  - "Day la nen tang van hanh trung tam hoc tap, ket noi tu khau ban hang, thu tien, van hanh lop hoc den dashboard cho nha dau tu."
  - "Toi se di qua 4 luong trong 5 phut: phe duyet don, doi soat doanh thu, van hanh giang day va goc nhin investor."

### 00:30 - 01:40

- Role: `DIRECTOR`
- Man hinh: `/app/orders`
- Thao tac:
  - mo danh sach orders
  - click 1 order da co san
  - mo chi tiet
  - nhan manh cac truong: hoc sinh, phu huynh, gia tien, so tien hoa don, invoice number
  - neu co order o trang thai co the duyet an toan, thuc hien approve
  - neu khong muon thao tac live, chi can mo order da approved san
- Loi noi:
  - "Moi don hang gom day du thong tin hoc sinh, phu huynh, goi hoc, so buoi, gia tri hoa don."
  - "Khi duyet don, he thong sinh side effect xuong cac module lien quan thay vi xu ly tay."
  - "Day la diem quan trong: doanh thu duoc van hanh theo workflow, khong phai bang file roi rac."

### 01:40 - 02:35

- Role: `ACCOUNTING`
- Man hinh: `/app/invoices`
- Thao tac:
  - loc hoac mo invoice lien quan
  - cho thay trang thai invoice `PENDING_APPROVAL` hoac invoice da `APPROVED`
  - mo proof image neu can
  - chuyen qua top-up / wallet / ledger neu dang co du lieu phu hop
- Loi noi:
  - "Phia ke toan co the phe duyet hoa don kem chung tu, va he thong ghi nhan side effect tai chinh ngay trong workflow."
  - "Sau khi approve invoice, so du va ledger duoc cap nhat dung thay vi doi batch doi soat thu cong."
  - "No giup leadership nhin duoc dong tien, khong chi trang thai hoc vien."

### 02:35 - 03:30

- Role: `TEACHER` hoac `DIRECTOR`
- Man hinh: `/app/teaching-report`
- Thao tac:
  - mo teaching report
  - cho thay pending / completed
  - mo 1 report da nop
  - neu co du lieu san, cho thay calendar hoac report vua submit
- Loi noi:
  - "He thong khong dung o ban hang. Sau khi lop hoc van hanh, giao vien nop bao cao giang day va leadership theo doi duoc ngay."
  - "Day la cau noi giua doanh thu va chat luong van hanh."

### 03:30 - 04:30

- Role: `DIRECTOR` hoac `SHAREHOLDER` mode
- Man hinh: `investor-dashboard` hoac `/financial-control`
- Thao tac:
  - mo investor metrics
  - nhan manh `snapshot`, `profitability`, `trend`
  - neu co filter `3/6/12 thang`, doi nhanh 1 lan
- Loi noi:
  - "O lop investor, chung toi tong hop du lieu van hanh thanh cac chi so co the doc duoc ngay."
  - "Nha dau tu nhin thay khong chi doanh thu, ma con thay xu huong, loi nhuan va nghia vu tai chinh."
  - "Tuc la du lieu o day di len tu nghiep vu that, khong phai dashboard lap rieng de trinh bay."

### 04:30 - 05:00

- Man hinh: quay lai menu tong quan hoac dashboard investor
- Loi noi:
  - "Tom lai, he thong da lien thong duoc tu order, invoice, van hanh giang day den dashboard nha dau tu."
  - "Sau demo nay, phan tiep theo cua chung toi la tiep tuc lam day edge case va mo rong bao cao, nhung khung van hanh cot loi da san sang."

## Phien ban quay an toan nhat

- Neu muon rui ro thap nhat, quay theo thu tu nay:
  1. order da approved san
  2. invoice da approved san
  3. teaching report da completed san
  4. investor metrics da load san
- Cach nay giam toi da rui ro thao tac live bi lech du lieu.

## Nhung gi KHONG nen quay

- `trial 0 dong`
- `partial payment`
- reject order ma can show lai `rejection reason` tren UI detail
- cac man export lon, mask shareholder, resilience/error/loading states
- cac flow payroll sau, supplier, reconciliation reject

## Script doc nhanh

- "Nen tang nay giup trung tam di tu ban hang den van hanh va tai chinh trong mot luong lien thong."
- "Order duoc phe duyet co kiem soat, invoice va so du duoc cap nhat theo workflow."
- "Giao vien va bo phan dieu hanh nop bao cao day hoc truc tiep trong he thong."
- "O tang quan tri va investor, du lieu duoc tong hop thanh dashboard de ra quyet dinh nhanh."
- "Chung toi uu tien he thong van hanh duoc thuc te truoc, sau do tiep tuc lam day edge case va bao cao sau."

## Ghi chu cuoi

- File tham chieu trang thai demo: `C:\Users\PC\Documents\code\vuitran\qa\reports\frontend-ui\showcase-ready.vi.md`
- Log tham chieu: `C:\Users\PC\Documents\code\vuitran\frontend-ui-evidence\2026-04-08\logs\LOG_SHOWCASE_READY_20260408.vi.md`




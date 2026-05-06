# Kich Ban Video Ads Manager Thuyet Trinh

## 1. Muc tieu video

Video nay dung de onboarding va ban giao cho vai tro `ADSMANAGER`.
Format phai giong cac video role moi:

- Mo dau bang intro card
- Co roadmap tong the
- Moi chang co scene briefing rieng
- Sau briefing la thao tac that tren UI
- Co caption, callout va long tieng tieng Viet dong bo

## 2. Luong tong the

1. Dang nhap vao he thong bang tai khoan Ads Manager
2. Doc dashboard role de xac dinh 3 module chinh
3. Vao ads-management de xem account, group, chi phi va pham vi quyen
4. Mo tab Viec can lam de doc action card uu tien
5. Vao ads-analytics de doc cohort, parent profit va ROI
6. Vao chatbot-settings de sua fanpage va kiem tra AI profile
7. Dang xuat ket thuc phien

## 3. Noi dung tung chang

### Chang 1. Dang nhap va doc dashboard role

Muc tieu:

- Cho thay role Ads Manager vao he thong nhu the nao
- Giai thich dashboard nay la workspace dinh huong cong viec

Can quay:

- Trang login
- Dang nhap thanh cong
- Dashboard Ads Manager
- Hero card va checklist

Loi thuyet minh:

- Day la role chi lam viec tren Ads Management, Ads Analytics va Chatbot Settings
- Dashboard dung de dinh huong cong viec dau ngay, khong phai bao cao tong hop nhu Director

### Chang 2. Lam viec tren Ads Management

Muc tieu:

- Cho thay ro nhung tab role nay duoc thay
- Giai thich cho nao chi doc va cho nao duoc sua

Can quay:

- Tab Tai khoan QC
- Tab Nhom QC
- Mo modal Sua cua mot group
- Luu group sau khi doi budget, tracking key hoac trang thai
- Tab Chi phi Ads o che do read only

Loi thuyet minh:

- Ads Manager duoc xem account de doi chieu nguon du lieu
- Tac nghiep chinh nam o tab Nhom QC
- Role nay khong duoc vao API Token, khong duoc sync va khong duoc nhap chi phi thu cong

### Chang 3. Doc tab Viec can lam

Muc tieu:

- Cho thay Ads Manager ra quyet dinh dua tren du lieu

Can quay:

- Chuyen sang tab Viec can lam
- Summary dashboard
- Mot action card critical hoac high

Loi thuyet minh:

- Summary cho thay tong nhom active, nhom co lai, nhom dang lo
- Action card giai thich tai sao can tam dung hoac dieu chinh group
- Sau khi doc xong, Ads Manager quay lai group de sua dung nhom can xu ly

### Chang 4. Doc Ads Analytics

Muc tieu:

- Cho thay Ads Manager khong chi nhin spend
- Giai thich phai doc cohort va parent profit truoc khi de xuat thay doi

Can quay:

- Bang overview funnel
- Sap xep theo ROI
- Doi bo loc ngay, nen tang, group
- Bam Phan tich
- Chuyen sang tab Profit theo PH
- Chuyen sang tab Chi phi quang cao toi uu theo X de hien note gioi han quyen

Loi thuyet minh:

- Overview de biet nhom nao dang lai, hoa von, lo
- Parent profit de doi chieu ads voi doanh thu va loi nhuan thuc
- Optimize X la tab Director dung de tinh budget, Ads Manager chi nhan biet gioi han quyen

### Chang 5. Ra soat Chatbot Settings

Muc tieu:

- Cho thay Ads Manager khoa dung luong fanpage va AI auto reply

Can quay:

- Trang Chatbot Settings
- Helper note ve quyen
- Dong fanpage dang hoat dong
- Mo modal Sua fanpage
- Doi mo ta, token dang gan, webhook, AI auto reply, trang thai
- Luu
- Chuyen sang tab AI Profiles

Loi thuyet minh:

- Ads Manager duoc sua fanpage dang co
- Duoc gan token OpenAI da tao san
- Khong duoc tao token moi hoac sua token library
- AI Profiles duoc xem de doi chieu, nhung khong sua xoa

### Chang 6. Dang xuat

Muc tieu:

- Dong phien an toan sau khi da kiem tra ads va chatbot

Can quay:

- Quay ve dashboard
- Bam dang xuat
- He thong tro ve login

## 4. Luu y san xuat

- Long tieng phai viet xong truoc khi quay
- Timeline can bam theo thoi luong voice, khong bam theo toc do click
- Neu doi loi doc thi quay lai `.webm`, khong chi render lai `.mp4`
- Bat buoc khoanh do hoac callout vao vung dang giai thich
- Phan quyen phai noi dung nhu code thuc te, khong noi qua quyen

## 5. Output mong doi

- `UI_AdsManager_Full_Workflow_VI_<date>.webm`
- `UI_AdsManager_Full_Workflow_VI_<date>.mp4`
- `voiceover-script.md`
- `render-manifest.json`

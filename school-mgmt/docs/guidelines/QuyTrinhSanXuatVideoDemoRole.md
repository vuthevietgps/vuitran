# Quy Trinh San Xuat Video Demo Theo Role

Tai lieu nay ghi lai cach chuan bi kich ban, quay va render video demo role-based sau khi da chot format cho video giao vien. Muc tieu la dung lai duoc cho sale, ke toan, van hanh va cac role khac ma khong lap lai loi cu.

## Muc Tieu

- Video phai giai thich duoc nghiep vu truoc khi nguoi xem thay thao tac.
- Tieng long tieng va hinh phai khop nhau, khong de hinh chay nhanh hon loi noi.
- Moi canh phai chi ro khu vuc thao tac chinh bang caption, callout va khoanh do neu can.
- Toan bo luong chinh phai di theo mot kich ban viet san, khong quay ung tac.

## Dau Ra Chuan

- `KichBanVideo_<Role>_ThuyetTrinh.md`: kich ban nghiep vu va loi thuyet minh tong.
- `<role>-video-copy.ts`: copy cho title card, scene card, label, callout va narration.
- `<role>-master-workflow.spec.ts`: luong Playwright quay video.
- `narration-cues.json`: moc cue thuc te cua video.
- `voiceover-script.md`: kich ban long tieng da xep lai theo timeline render.
- `.webm`: video goc sau khi quay Playwright.
- `.mp4`: video xuat cuoi cung.

## Nguyen Tac Kich Ban

- Viet kich ban truoc khi quay.
- Tach ro `intro -> roadmap -> scene briefing -> thao tac that tren UI -> outro`.
- Moi cue narration chi nen bao phu mot man hinh hoac mot cum thao tac lien quan.
- Neu chuyen man hinh hoac chuyen y nghiep vu, tao cue moi.
- Loi thuyet minh viet theo van noi, cau ngan, ro chu ngu va dong tu thao tac.
- Khong nhom qua nhieu thao tac vao mot cau dai.
- Scene card dung de giai thich "sap lam gi" truoc khi mo UI that.
- Label tren video phai noi dung cung y voi cau narration cua canh do.

## Nguyen Tac Dong Bo Tieng Va Hinh

- Lay thoi luong long tieng lam chuan, khong lay toc do thao tac tren UI lam chuan.
- Sau khi bat dau mot cue, chi duoc sang canh moi khi da het cua so thoi gian cua cue do.
- Neu doi engine TTS hoac sua cau narration dai hon, phai quay lai `.webm`, khong chi render lai `.mp4`.
- Khong de hai cue noi de len nhau.
- Moi cue nen co them mot khoang dem ngan de tranh cat dut am cuoi cau.

## Kinh Nghiem Da Chot

- `gtts:vi` dang on dinh hon `edge-tts` tren may hien tai.
- `edge-tts` co luc fail khong on dinh ke ca voi cau ngan, vi vay khong nen xem no la engine chinh.
- Ban chi render de thay audio vao video cu se rat de lech nhip. Cach dung la quay lai video voi timeline moi.
- Cac canh `intro`, `roadmap` va `scene card` thuong thieu thoi gian neu chi dat timeout co dinh.
- Phan UI that nen chia nho thanh tung doan: callout 1, pause, callout 2, pause, thao tac, pause.
- Khi canh ket thuc qua som, nguoi xem se nghe tieng nhung hinh da chuyen man hinh khac, day la loi can tranh dau tien.

## Quy Trinh De Xuat

1. Chot danh sach luong nghiep vu cua role.
2. Viet handbook nghiep vu chi tiet de khong bo sot tinh huong.
3. Viet kich ban video thuyet trinh rieng, theo format scene card va thao tac.
4. Chuyen noi dung sang file copy cho E2E: `intro`, `roadmap`, `scene narration`, `UI narration`, `label`, `callout`, `outro`.
5. Dung spec Playwright de quay theo dung thu tu do.
6. Gan cue narration ngay trong luc quay.
7. Tinh cua so thoi gian cho moi cue va buoc spec phai doi du thoi gian truoc khi chuyen canh.
8. Quay ra `.webm` moi.
9. Render `.mp4` voi TTS tieng Viet.
10. Review toan bo video, neu lech nhip thi sua spec truoc, khong sua de o buoc render.

## Cau Truc Chuan Cho Mot Video Role Moi

1. Intro: giai thich muc tieu video va cach xem.
2. Roadmap: ve flow tong the cua role.
3. Scene briefing: giai thich y nghia cua chang sap thao tac.
4. UI thao tac that: mo man hinh, highlight khu vuc chinh, thao tac tung buoc.
5. Outro: tong ket flow va muc dich cua video.

## Quy Tac Viet Narration

- Moi cau nen tra loi mot trong ba cau hoi: `dang o dau`, `dang lam gi`, `ket qua mong doi la gi`.
- Han che viet cau co qua nhieu ve sau dau phay.
- Uu tien dong tu ro nghia: `mo`, `chon`, `kiem tra`, `tai`, `tao link`, `nop`, `xac nhan`, `dang xuat`.
- Neu mot thao tac co hai y khac nhau, tach thanh hai cue hoac hai cau.
- Noi du nghiep vu, khong chi doc lai ten button.

## Quy Tac Cho Scene Card

- Scene card phai co `ten chang`, `muc tieu`, `3 bullet toi da`.
- Scene card chi dung de dat boi canh, khong thay the man hinh thao tac that.
- Roadmap card dung mot lan dau video. Scene card dung truoc moi chang lon.

## Quy Tac Cho Man Hinh That

- Moi man hinh chi highlight 1 khu vuc chinh tai mot thoi diem.
- Khoanh do khi can nguoi xem tap trung vao mot panel, form, button hay bang du lieu cu the.
- Neu can click, di chuyen chuot ro rang, cham nhip va co pause ngan sau click.
- Sau khi hien ket qua thao tac, dung lai mot nhip de nguoi xem kip doc.

## Checklist Truoc Khi Render

- Kich ban nghiep vu da viet xong.
- Copy narration, label va callout da du.
- Mock data on dinh, khong phu thuoc du lieu random.
- Cue narration da duoc gan cho tat ca canh chinh.
- Spec da doi du thoi gian cho moi cue.
- Khong con luong nao bi lap hay bo sot.

## Checklist Sau Khi Render

- Nghe va xem tu dau den cuoi.
- Kiem tra xem moi cau noi co dung man hinh tuong ung khong.
- Kiem tra cue nao bi chong len nhau.
- Kiem tra callout co trung dung vung thao tac khong.
- Kiem tra label co khop voi thao tac va narration khong.
- Kiem tra video ket thuc sau outro, khong cat dut som.

## Cach Xu Ly Khi Bi Lech Nhip

- Neu audio dai hon hinh: sua spec, tang thoi gian canh, quay lai `.webm`.
- Neu audio ngan hon hinh: rut bot pause khong can thiet hoac viet lai narration gon hon.
- Neu chong tieng: kiem tra cue schedule va cue nao dang bat dau qua som.
- Neu doi voice: coi nhu doi timeline, can review lai do dai toan bo canh.

## File Lien Quan Trong Codebase

- Shared render helper: `frontend/scripts/lib/render-narrated-demo.mjs`
- Teacher video spec: `frontend/e2e/teacher-master-workflow.spec.ts`
- Teacher copy: `frontend/e2e/teacher-video-copy.ts`
- Vi du kich ban thuyet trinh: `docs/teacher/KichBanVideo_GiaoVien_ThuyetTrinh.md`

## Mau Ap Dung Cho Role Moi

- `Buoc 1`: liet ke flow role.
- `Buoc 2`: viet handbook nghiep vu day du.
- `Buoc 3`: viet kich ban video.
- `Buoc 4`: tach copy ra intro, roadmap, scene, ui, outro.
- `Buoc 5`: quay theo spec da co narration window.
- `Buoc 6`: render TTS tieng Viet.
- `Buoc 7`: review sync truoc khi ban giao.

Neu phai uu tien mot nguyen tac duy nhat, thi do la:

`Kich ban viet truoc, timeline theo long tieng, roi moi quay video.`

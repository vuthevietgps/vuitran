# Runbook Test UI - Batch B10: Ads, Landing Pages, Public Flows

## Mục tiêu

Batch này kiểm tra toàn bộ màn Ads Management, Landing Pages và các public flow có tác động trực tiếp tới lead/order. Mục tiêu là xác nhận UI render đúng, thao tác đúng, phân quyền đúng và không làm rối các trạng thái sync/public form.

## Vai trò cần dùng

- `ADSMANAGER`
- `DIRECTOR`
- `OPS`
- `SHAREHOLDER`

## Dữ liệu cần chuẩn bị

- 1 tài khoản Ads Manager có quyền quản lý token
- 1 ad account, 1 group, 1 cost item đã seed
- 1 token đã sync sẵn để test refresh/sync trạng thái
- 1 landing page public slug hợp lệ
- 1 public form có tracking/UTM
- 1 case slug sai để test lỗi
- 1 case clipboard fail nếu muốn test fallback copy URL

## Case trọng tâm

- Tab `Việc cần làm` hoặc `Actionable tasks` trong Ads Management
- CRUD account, group, token, cost
- Sync token, trigger sync, backfill
- Ads analytics load đúng dữ liệu và quyền xem suggestion/actions
- Landing pages create/edit/delete
- Copy public URL
- Public landing page load đúng theo slug
- Public landing page slug sai
- Submit form public landing page thành công và lỗi
- UTM/tracking payload
- Inject Meta Pixel / Google Tag / TikTok Pixel
- Custom head/body HTML

## Checklist thực thi mẫu

1. Đăng nhập bằng `ADSMANAGER`.
2. Mở màn `Ads Management`.
3. Chuyển lần lượt qua các tab account, group, token, cost và `Việc cần làm`.
4. Tạo mới hoặc sửa thử một token/cost nếu data cho phép.
5. Bấm `Trigger Sync` hoặc `Backfill`.
6. Quan sát loading, toast và trạng thái sau sync.
7. Mở `Ads Analytics` nếu cần kiểm tra quyền suggestion/actions.
8. Mở `Landing Pages`, tạo hoặc sửa một landing page.
9. Copy public URL và kiểm tra URL được tạo đúng.
10. Mở public landing page bằng slug hợp lệ và slug sai.
11. Submit form public landing page với dữ liệu hợp lệ và dữ liệu lỗi.
12. Kiểm tra UTM, pixel và custom head/body HTML nếu màn hình cho phép.

## Quy ước ghi hình

- 1 video MP4 cho toàn batch nếu thời lượng dưới 40 phút
- Nếu dài hơn, tách thành nhiều phần
- Tên file gợi ý: `UI_B10_Ads_PublicFlows_YYYYMMDD.mp4`
- Bật hiển thị con trỏ chuột
- Ghi rõ route trên màn hình hoặc giữ thanh địa chỉ nếu cần đối soát

## Quy ước log

- Mỗi case ghi 1 dòng log riêng
- Bắt buộc có: mã case, màn hình, bước đã làm, kỳ vọng, kết quả thực tế, thời gian trong video, trạng thái
- Nếu fail, chụp thêm 1 ảnh màn hình tại thời điểm lỗi

## Tiêu chí PASS

- Tất cả tab và action hoạt động đúng role
- Copy URL, public form, tracking và pixel hoạt động đúng
- Loading/toast/error state hiển thị rõ ràng
- Không có lỗi quyền hoặc lỗi điều hướng

## Tiêu chí FAIL

- Sai tab
- Sai quyền
- Sync không phản hồi hoặc phản hồi sai
- Public form submit lỗi nhưng thông báo không rõ
- Pixel hoặc tracking bị inject sai
- Copy URL không hoạt động hoặc copy sai

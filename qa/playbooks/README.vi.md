# Playbooks Và SOP

Đây là lớp tài liệu giúp QA hiểu nghiệp vụ trước khi kết luận `FAIL`.

## Mapping backend mới

- Batch backend API sau này phải đọc thêm:
  - `qa/playbooks/backend-api-sop-mapping.vi.md`
  - `qa/plans/backend-api/master-test-plan.vi.md`
  - `qa/runbooks/backend-api/`

## Nguồn playbook chính

- Handbook theo role trên UI: `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`
- Cấu hình handbook: `school-mgmt/frontend/src/app/components/internal-handbook.configs.ts`
- Handbook type definitions: `school-mgmt/frontend/src/app/components/internal-handbook.types.ts`
- SOP giáo viên chi tiết: `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`
- Kịch bản kiểm thử giáo viên: `school-mgmt/docs/teacher/KichBanKiemThu_GiaoVien.md`
- SOP Ads Manager: `school-mgmt/docs/adsmanager/HuongDanAdsManager_ChiTiet.md`

## Khi nào bắt buộc đọc playbook

- Test luồng lương, teaching report, attendance, finalize session
- Test tài chính, wallet, invoice, reconciliation, alerts
- Test luồng ads, lead attribution, chatbot-to-lead, public landing
- Test RBAC giữa Director, Accounting, OPS, Teacher, Parent, Shareholder

## Pitfall cần tránh

- Nhầm giữa `không có quyền` và `không có dữ liệu`
- Bỏ qua bước tiền đề nghiệp vụ rồi báo `màn trống`
- Chỉ nhìn số cuối cùng mà không truy ngược nguồn sinh dữ liệu
- Dùng sai role rồi kết luận frontend render sai

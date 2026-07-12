# Tài Liệu Dự Án

## Điều hướng nhanh cho bộ mở trung tâm

- [Tổng hợp link mở trung tâm](./operations/tong-hop-link-mo-trung-tam.md)
- [Checklist master mở trung tâm](./operations/checklist-opening-center-detailed.md)
- [Hub checklist theo đối tượng](./operations/opening-center-checklists/README.md)
- [Hub sổ tay theo vị trí](./operations/opening-center-handbooks/README.md)

## `docs/` là nguồn gốc chính
Thư mục `docs/` là source of truth cho toàn bộ tài liệu của dự án.
Nơi này chứa bản nháp, ADR, hướng dẫn cho Developer, tài liệu QA và các nội dung cần rà soát trước khi publish.

Riêng tài liệu điều hành kiểm thử ở cấp workspace như checklist manual UI, runbook, execution plan và QA hub điều hướng đang được gom tại:

- `C:\Users\PC\Documents\code\vuitran\qa\README.vi.md`

Các tài liệu vận hành cấp project hiện được nhóm lại theo cụm:

- [docs/adsmanager/](./adsmanager/README.md): tài liệu nghiệp vụ và cải tiến cho Ads
- [docs/ai/](./ai/README.md): thiet ke AI chatbot, permission matrix va AI Assistant Core
- [docs/guidelines/](./guidelines/README.md): rule, convention, nguyên tắc UI/content
- [docs/operations/](./operations/README.md): hướng dẫn vận hành và kịch bản sử dụng
- [docs/planning/](./planning/README.md): execution plan, backlog, điều phối agent
- [docs/project/](./project/README.md): mô tả tổng quan và tài liệu nền của dự án
- [docs/teacher/](./teacher/README.md): handbook và asset cho luồng giáo viên

## `frontend/src/assets/` là bản đã publish
Thư mục `frontend/src/assets/` dùng để chứa tài liệu đã được xuất bản cho Angular đọc trực tiếp và render trên UI.
Các tài liệu như Teacher Hub hoặc Internal Handbook nên được sync sang đây khi cần hiển thị cho người dùng cuối.

## Quy trình cập nhật
1. Sửa nội dung trước trong `docs/`.
2. Nếu tài liệu đó cần xuất hiện trên UI, copy hoặc sync sang `frontend/src/assets/`.
3. Giữ nội dung trong `assets/` là bản publish, còn `docs/` là nơi soạn và bảo trì nguồn gốc.

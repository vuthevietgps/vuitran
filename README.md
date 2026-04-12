# Workspace Layout

Workspace này được tách thành các khối có vai trò rõ ràng:

- `qa/`: hub tài liệu kiểm thử, checklist, runbook, plan, script hỗ trợ QA.
- `frontend-ui-evidence/`: evidence manual UI theo ngày, dùng cho sign-off.
- `runtime-logs/`: log ad hoc ở cấp workspace, chủ yếu cho smoke run hoặc automation tạm.
- `test-results/`: test output ad hoc ở cấp workspace.
- `school-mgmt/`: mã nguồn ứng dụng chính, runtime logs chính thức của app và kết quả test chính thức của app.

Quy tắc nhanh:

- Cần test theo quy trình: bắt đầu từ `qa/README.vi.md`.
- Cần evidence QA: dùng `frontend-ui-evidence/`.
- Cần output từ runner chính của app: xem `school-mgmt/test-results/`, `school-mgmt/test-videos/`, `school-mgmt/runtime-logs/`.
- Scratch và legacy one-off files đã được dọn khỏi workspace chính để giảm nhiễu.

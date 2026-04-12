# Artifact Locations

## Manual UI

- Video, log, screenshot manual UI: `frontend-ui-evidence/<YYYY-MM-DD>/`

## Manual Backend API

- Log batch ad hoc: `runtime-logs/backend-api/<YYYY-MM-DD>/`
- Summary/sign-off: `qa/reports/backend-api/`

## Workspace ad hoc

- Runtime logs ad hoc: `runtime-logs/`
- Test results ad hoc ở root: `test-results/`

## App automation

- Report chính thức: `school-mgmt/test-results/`
- Video/trace runner: `school-mgmt/test-videos/`
- Runtime logs app: `school-mgmt/runtime-logs/`

## Quy tắc

- Không chỉnh sửa artifact thô sau khi runner/manual session đã tạo xong.
- Nếu cần tóm tắt kết quả, tạo file báo cáo ở `qa/reports/`, không rewrite artifact gốc.
- Nhánh duplicate `school-mgmt/frontend-ui-evidence/` đã được loại bỏ; manual UI evidence chỉ còn dùng nhánh root `frontend-ui-evidence/`.

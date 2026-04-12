# Sơ Đồ Sử Dụng QA

Tài liệu này là bản đồ 1 trang để QA biết cần mở thư mục nào theo đúng mục tiêu.

## Sơ đồ tổng quan

```mermaid
flowchart TD
    A["Bắt đầu từ qa/README.vi.md"] --> B{"Bạn đang cần làm gì?"}

    B --> C["Test Frontend UI thủ công"]
    C --> C1["Checklist UI<br/>qa/checklists/frontend-ui/testfrontendui.md"]
    C1 --> C2["Master plan<br/>qa/plans/frontend-ui/master-test-plan.vi.md"]
    C2 --> C3["Batch runbook<br/>qa/runbooks/frontend-ui/"]
    C3 --> C4["Evidence theo ngày<br/>frontend-ui-evidence/YYYY-MM-DD/"]

    B --> D["Test Backend API"]
    D --> D1["Checklist API<br/>qa/checklists/backend-api/test.md"]
    D1 --> D2["Jest E2E / Unit<br/>school-mgmt/backend/test/"]
    D2 --> D3["Workflow scripts<br/>school-mgmt/backend/scripts/"]

    B --> E["Hiểu nghiệp vụ trước khi kết luận bug"]
    E --> E1["Playbook index<br/>qa/playbooks/README.vi.md"]
    E1 --> E2["Teacher / Ads / handbook nội bộ<br/>school-mgmt/docs/ và frontend handbook"]

    B --> F["Rerun automation hoặc đọc kết quả máy chạy"]
    F --> F1["Automation map<br/>qa/automation/README.vi.md"]
    F1 --> F2["Runner outputs<br/>school-mgmt/test-results/"]
    F2 --> F3["Videos / traces<br/>school-mgmt/test-videos/"]
    F3 --> F4["Runtime logs<br/>school-mgmt/runtime-logs/"]

    B --> G["Quay demo / showcase"]
    G --> G1["Demo flows<br/>qa/runbooks/demo-flows/"]
    G1 --> G2["Showcase artifacts<br/>school-mgmt/showcase-artifacts/"]

    B --> H["Xem triage hoặc kết quả đợt test trước"]
    H --> H1["QA reports<br/>qa/reports/frontend-ui/"]
    H --> H2["Deep references<br/>qa/references/"]
```

## Đi nhanh theo nhu cầu

- Muốn biết phải test cái gì ở UI: mở `qa/checklists/frontend-ui/testfrontendui.md`
- Muốn biết test theo luật nào: mở `qa/plans/frontend-ui/master-test-plan.vi.md`
- Muốn chạy theo batch và quay bằng chứng: mở `qa/runbooks/frontend-ui/`
- Muốn hiểu vì sao màn hình đang trống hay bị chặn: mở `qa/playbooks/README.vi.md`
- Muốn test API/backend: mở `qa/checklists/backend-api/test.md`, rồi đối chiếu `school-mgmt/backend/test/` và `school-mgmt/backend/scripts/`
- Muốn xem kết quả máy chạy chính thức: mở `school-mgmt/test-results/`, `school-mgmt/test-videos/`, `school-mgmt/runtime-logs/`
- Muốn quay demo cho stakeholder: mở `qa/runbooks/demo-flows/`
- Muốn xem bằng chứng manual UI đã chốt: mở `frontend-ui-evidence/<YYYY-MM-DD>/`

## Không dùng nhầm

- `qa/runbooks/demo-flows/` là để kể câu chuyện demo, không thay cho sign-off checklist.
- `school-mgmt/test-results/` và `school-mgmt/test-videos/` là output automation, không thay cho evidence manual UI.
- `runtime-logs/` và `school-mgmt/runtime-logs/` là log kỹ thuật, không phải bằng chứng PASS.
- `school-mgmt/docs/` là source of truth cho tài liệu sản phẩm và SOP; `qa/` mới là hub điều hành kiểm thử.

## Canonical paths

- QA hub: `qa/README.vi.md`
- Manual UI evidence: `frontend-ui-evidence/`
- Automation results: `school-mgmt/test-results/`
- Automation videos/traces: `school-mgmt/test-videos/`
- App runtime logs: `school-mgmt/runtime-logs/`

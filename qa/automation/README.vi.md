# Automation Map

## Mục tiêu

Thư mục này không chứa test runner; nó là bản đồ điều hướng cho automation chính thức.

## Frontend UI automation

- Orchestrator specs: `school-mgmt/frontend/e2e/orchestrator/`
- Playwright config: `school-mgmt/frontend/playwright.config.ts`
- Package scripts: `school-mgmt/frontend/package.json`
- Handover tổng hợp: `qa/automation/QA_HANDOVER.md`

## Backend automation

- Jest E2E/unit: `school-mgmt/backend/test/`
- Workflow scripts theo module: `school-mgmt/backend/scripts/`
- Package scripts: `school-mgmt/backend/package.json`

## Artifact runner chính thức

- JUnit/HTML reports: `school-mgmt/test-results/`
- Video/trace output: `school-mgmt/test-videos/`
- Runtime logs: `school-mgmt/runtime-logs/`

## Lưu ý an toàn

- `school-mgmt/frontend/scripts/collect-evidence.js` đã bị quarantine.
- `school-mgmt/frontend/scripts/mark-logs-pass.js` đã bị quarantine.
- Không dùng script mutate evidence để suy ra `PASS`.
- Chỉ tin raw runner output, JUnit, HTML report, trace, video và log gốc.

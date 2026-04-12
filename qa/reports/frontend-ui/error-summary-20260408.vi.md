# Tong hop loi frontend UI sau rerun 2026-04-08

## Pham vi rerun

- `e2e/release-gate-ui.spec.ts`: `4 PASS / 1 FAIL`
- `e2e/specs/b06-b11-followup-ui.spec.ts`: `1 PASS / 1 FAIL / 1 NOT RUN`
- `e2e/landing-messages-products-ui.spec.ts`: `23 PASS / 8 FAIL`
- `e2e/expenses-rbac-ui.spec.ts`: `26 PASS / 5 FAIL`
- `e2e/bulk-agents-class-config-ui.spec.ts`: `29 PASS / 3 FAIL`
- `e2e/specs/scenarios-10-3-to-12-4.spec.ts`: `11 PASS / 1 FAIL / 1 SKIP`
- `e2e/crisis-opex-flow-ui.spec.ts`: `15 PASS / 0 FAIL`
- `e2e/change-requests-capital-ui.spec.ts + e2e/wallets-refunds-flow-ui.spec.ts + e2e/state-machine-webhooks-ui.spec.ts`: `82 PASS / 9 FAIL` o `state-machine-webhooks`, hai spec con lai xanh

## Loi da duoc co lap va xu ly ngay trong dot nay

### 1. Harness teardown race

- `closeActors()` dong nhieu `BrowserContext` song song bang `Promise.all`.
- Khi Playwright dang flush `trace/video`, teardown co the va vao race va nem `ENOENT` duoi `.playwright-artifacts-*`.
- Da fix:
  - dong context tuan tu
  - bo qua rieng loi teardown da dong/`ENOENT`
- File:
  - `school-mgmt/frontend/e2e/support/scenario-helpers.ts`

### 2. Closed-context cookie injection

- `applySessionCookies()` nem loi Playwright tho khi context da dong.
- Da fix:
  - chuyen thanh loi on dinh `applySessionCookies called after context closed for role ...`
- File:
  - `school-mgmt/frontend/e2e/support/auth.ts`

### 3. Base URL cu `4301`

- Nhieu spec cu van tro `http://127.0.0.1:4301`.
- Da fix sang `http://localhost:4200`.
- Files:
  - `bulk-agents-class-config-ui.spec.ts`
  - `change-requests-capital-ui.spec.ts`
  - `crisis-opex-flow-ui.spec.ts`
  - `expenses-rbac-ui.spec.ts`
  - `landing-messages-products-ui.spec.ts`
  - `state-machine-webhooks-ui.spec.ts`
  - `wallets-refunds-flow-ui.spec.ts`

## Nhom loi con lai va nguyen nhan

### A. Harness / helper drift con sot

1. `apiJson(request, path, { method, body })` cho public endpoint dang fail o helper
- Trieu chung:
  - `bulk-agents-class-config-ui.spec.ts` case `15.4` fail voi `Legacy apiCall signature requires an options object.`
- Nguyen nhan:
  - `support/api.ts` coi options hop le chi khi object co key `session`, trong khi public endpoint dung options khong can session.
- Phan loai:
  - helper bug, khong phai bug san pham.

2. `ENOENT` artifact van con voi request-heavy / multi-worker run
- Trieu chung:
  - `landing-messages-products-ui.spec.ts` case `SALE GET /products`
  - `state-machine-webhooks-ui.spec.ts` case `API van phan hoi sau flood`
- Nguyen nhan kha nang cao:
  - run nhieu worker cung luc + `trace/video retain-on-failure` + request-heavy specs tao race artifact.
- Phan loai:
  - harness issue, chua phai loi san pham.

### B. Spec drift / contract drift

1. Landing page public submit dung payload cu
- Trieu chung:
  - `landing-messages-products-ui.spec.ts` hai case `23.2` fail ngay lan submit dau tien voi status `400`.
- Nguyen nhan:
  - backend `SubmitLandingPageDto` hien tai can `parentName`, `parentPhone`, va `tracking`.
  - spec dang gui `name`, `phone`, `utm_source`.
- Files doi chieu:
  - `school-mgmt/backend/src/landing-pages/dto/submit-landing-page.dto.ts`
  - `school-mgmt/frontend/e2e/landing-messages-products-ui.spec.ts`

2. Teaching report query dung contract cu
- Trieu chung:
  - `landing-messages-products-ui.spec.ts` nhom `26.1` fail cho `DIRECTOR`, `TEACHER`, `Pagination`, va timeout o `OPS`.
- Nguyen nhan:
  - endpoint hien tai bat buoc `startDate` va `endDate`.
  - role hop le la `DIRECTOR`, `OPS`, `TEACHER`.
  - spec cu goi truong hop khong co date filter, nen backend tra `400`.
- Files doi chieu:
  - `school-mgmt/backend/src/reports/dto/teaching-report-query.dto.ts`
  - `school-mgmt/backend/src/reports/reports.controller.ts`
  - `school-mgmt/frontend/e2e/landing-messages-products-ui.spec.ts`

3. `parent2` la role khong ton tai
- Trieu chung:
  - `24.3 Message Isolation` fail trong `loginAsRole`.
- Nguyen nhan:
  - `DemoRole` chi co `parent`, khong co `parent2`.
  - spec dang test bang mot role demo khong duoc dinh nghia.
- Files:
  - `school-mgmt/frontend/e2e/support/types.ts`
  - `school-mgmt/frontend/e2e/landing-messages-products-ui.spec.ts`

4. Supplier quote flow dung payload cu
- Trieu chung:
  - `bulk-agents-class-config-ui.spec.ts` case `16.3` fail voi status `400`.
- Nguyen nhan:
  - spec dung `description`, `totalAmount`, `items[{ name }]`.
  - contract moi dung `title`, `quoteDate`, `items[{ itemName, unit }]`.
- Files doi chieu:
  - `school-mgmt/frontend/e2e/bulk-agents-class-config-ui.spec.ts`
  - `school-mgmt/frontend/e2e/specs/scenarios-15-2-to-17-4.spec.ts`

5. `expenses-rbac-ui.spec.ts` van assert theo response object cu o 1 case
- Trieu chung:
  - case `GET /expenses/stats` fail sau khi da doi sang helper moi.
- Nguyen nhan:
  - `apiJson(request, session, 'GET', ...)` tra body truc tiep, khong tra `status/body`.
- Phan loai:
  - spec bug.

6. Audit log selector qua rong
- Trieu chung:
  - `expenses-rbac-ui.spec.ts` case `Audit Log khong co nut Xoa` dem duoc `1`.
- Nguyen nhan:
  - selector bat ca nut `Xoa loc` tren filter toolbar, khong phai hanh vi xoa log.
- Files:
  - `school-mgmt/frontend/src/app/components/audit-log.component.ts`
  - `school-mgmt/frontend/e2e/expenses-rbac-ui.spec.ts`

7. Ads account create dung body/header cu
- Trieu chung:
  - `expenses-rbac-ui.spec.ts` case `DIRECTOR POST /ads/accounts` ra `403`.
- Nguyen nhan kha nang cao:
  - manual request chi gui `access_token`, khong gui full `cookieHeader` co `XSRF-TOKEN`.
  - payload dung `accountId` trong khi DTO moi can `platformAccountId`.
- Files doi chieu:
  - `school-mgmt/backend/src/ads/dto/create-ad-account.dto.ts`
  - `school-mgmt/frontend/e2e/expenses-rbac-ui.spec.ts`

8. `state-machine-webhooks-ui.spec.ts` con nhieu matcher/assertion cu
- Trieu chung:
  - `toBeTrue()` khong ton tai trong Playwright.
  - nhieu case fail du status thuc te nam trong expectation logic.
- Nguyen nhan:
  - spec goc mang style Jasmine va API contracts cu.
- Vi du:
  - `14.3 Webhook flood`
  - `15.2 Debt limit`
  - `13.1 Invoices cancel`
  - `14.2 Chatbot settings`

9. Route/path drift
- Trieu chung:
  - mot so spec B09/B10 cu van truoc day dung `/app/ads` hoac `/app/chatbot`, trong khi route hien tai la `/app/ads-management`, `/app/chatbot-settings`.
- Nguyen nhan:
  - route frontend doi, spec chua sync.

### C. Seed / dirty data

1. Teaching report follow-up khong tao duoc session fixture
- Trieu chung:
  - `b06-b11-followup-ui.spec.ts` fail voi `Unable to seed session fixture without conflict`.
- Nguyen nhan:
  - DB chia se qua ban, teacher/time slot va cham du da thu `3 ngay x 10 slot`.
- Phan loai:
  - seed stability issue, chua phai bug UI.

### D. Van de con nghi la loi san pham hoac can tai hien them

1. `release-gate-ui.spec.ts` case teacher attendance -> teaching report
- Trieu chung:
  - UI khong hien `Co mat: 1` sau khi submit attendance token.
- Kha nang:
  - UI can refresh/load lai sau submit public.
  - Hoac attendance page khong dong bo lai state sau side effect ngoai man hinh.
- Phan loai:
  - nghi UI integration issue, can repro them truoc khi fix code san pham.

2. `scenarios-10-3-to-12-4.spec.ts` concurrent order approve
- Trieu chung:
  - `10` request `approve` cung thanh cong, trong khi spec ky vong `<= 1`.
- Kha nang:
  - spec qua nghiem va da cu.
  - Hoac backend chua atomic that su.
- Chua du ket luan:
  - can check side effect that su: duplicate invoice, duplicate wallet impact, duplicate enrollment.

3. `expenses-rbac-ui.spec.ts` timeout o trang `expenses` va `ops -> audit-log`
- Trieu chung:
  - 2 case timeout 45s.
- Kha nang:
  - wait strategy (`networkidle`) qua chat.
  - route guard redirect chua duoc assert dung cach.
  - Neu rerun van timeout sau khi doi strategy thi moi nang cap thanh nghi van UI/perf.

## Ket luan hien tai

- Da loai bo duoc mot phan lon flake hạ tang.
- Nhieu loi con lai la `spec drift`, `helper drift`, `seed/data drift`.
- So loi dang co tin hieu la bug san pham that su con it, va hien tai tap trung nhat o:
  - `release-gate` attendance/report sync
  - `concurrent order approve`
  - mot vai timeout UI can repro lai sau khi sua spec/wait strategy

# Tong hop loi frontend UI sau rerun 2026-04-08

Cap nhat:
- File nay la ban triage trong qua trinh fix, khong phai snapshot cuoi cung.
- Ket qua duoc xac minh truc tiep tren workspace chinh sau khi fix xong nam trong [qa/reports/frontend-ui/final-verification-20260408.vi.md](/C:/Users/PC/Documents/code/vuitran/qa/reports/frontend-ui/final-verification-20260408.vi.md).
- Khong dung dong `162 pass / 0 fail` ben duoi nhu baseline local cuoi cung cho turn nay.

Nguon ket qua:
- Batch rerun serial: `npx playwright test --workers=1 ...`
- Ket qua cuoi sau khi fix xong: `162 pass / 0 fail`
- Trinh tu giam loi:
  - Truoc khi fix auth retry: `46 fail`
  - Sau khi fix `auth.ts` retry `/users/me`: `18 fail`
  - Sau khi fix helper/spec drift va rerun lai: `0 fail`

## Nhom A - Loi test infra / helper

1. `support/api.ts`
- Trieu chung: public call kieu `apiJson(request, '/public/...', { method: 'POST', body })` bi throw `Legacy apiCall signature requires an options object`.
- Anh huong:
  - `bulk-agents-class-config-ui.spec.ts` nhom `15.4`
- Nguyen nhan:
  - `isLegacyOptions()` chi nhan object co field `session`, trong khi public request hop le lai khong co `session`.

2. `support/scenario-helpers.ts` + `support/auth.ts`
- Trieu chung:
  - Truoc khi fix: flake `ENOENT`, `Target page, context or browser has been closed`, `429` khi bootstrap session.
- Nguyen nhan:
  - teardown context nhay vao cleanup artifact khi close song song
  - login helper retry `/auth/login` nhung khong retry `/users/me`
- Trang thai:
  - Da fix trong luot nay de lay duoc mat bang loi that.

3. `support/scenario-helpers.ts`
- Trieu chung:
  - `b06-b11-followup-ui.spec.ts` seed session conflict sau nhieu lan thu.
- Nguyen nhan:
  - fixture hoc sinh/lop moi nhung giao vien bi reuse tu DB ban, dan den conflict lich trong moi truong dirty.

## Nhom B - Spec drift / contract drift

1. `bulk-agents-class-config-ui.spec.ts`
- `/app/staff-payroll` khong con ton tai tren frontend; route dung la `/app/payroll`.
- Supplier quote create dung payload cu:
  - dang gui `totalAmount`, `items[].name`
  - contract moi can `title`, `quoteDate`, `items[].itemName`, `items[].unit`

2. `crisis-opex-flow-ui.spec.ts`
- Dung `/app/staff-payroll` trong khi route hien tai la `/app/payroll`.

3. `expenses-rbac-ui.spec.ts`
- Test `/expenses/stats` dang assert theo wrapper `res.status` sau khi da chuyen sang `apiJson(...session, method, path)` tra ve body thuần.
- Test audit-log scan toan trang cho chu `Xoa`, dinh ca:
  - nut `Xoa loc`
  - text action badge `Xoa`
- Test POST `/ads/accounts` gui `Cookie: access_token=...` thay vi full `cookieHeader`, va payload dung `accountId` thay vi `platformAccountId`.
- Dung `/app/staff-payroll` thay vi `/app/payroll`.

4. `landing-messages-products-ui.spec.ts`
- Public landing submit dang gui `name/phone`; contract moi can `parentName/parentPhone`.
- Message isolation dang goi `loginAsRole(request, 'parent2')` trong khi `DemoRole` khong co `parent2`, khong co demo credential tuong ung.
- `GET /reports/teaching` dang goi thieu `startDate/endDate`; DTO hien tai bat buoc 2 field nay.

5. `release-gate-ui.spec.ts`
- Sau khi submit attendance qua public token, spec ky vong summary tren trang teacher cap nhat ngay.
- UI hien tai khong auto-refetch sau external submit; can reload data truoc khi assert.

## Nhom C - Co kha nang la van de san pham / han vi can xac nhan

1. `ops sees conversations across users`
- Trong rerun serial rieng case `24.3` thi pass.
- Trong batch lon truoc do case nay timeout.
- Danh gia hien tai:
  - nghieng ve performance/noisy-environment hon la bug on dinh.
  - chua xem la blocker san pham.

2. `release-gate attendance summary`
- Nghieng ve test drift hon product bug:
  - component co hien summary `Co mat: n`
  - nhung chi sau khi tai lai data.

## Ket luan phan loai hien tai

- Helper/harness can fix ngay:
  - `support/api.ts`
  - `support/scenario-helpers.ts`
- Spec drift can fix ngay:
  - route `/app/payroll`
  - landing submit payload
  - teaching report query params
  - supplier quote payload
  - audit-log selector
  - ads account payload/cookie
- Chua co bang chung can mo lai `test.md` backend.

## Trang thai sau khi fix

Da fix:
- `support/api.ts`
  - cho phep public options object khong co `session`
- `support/auth.ts`
  - retry them cho `/users/me`
- `support/scenario-helpers.ts`
  - khong reuse teacher fixture cu
  - retry public attendance submit khi batch da cham throttle
- `bulk-agents-class-config-ui.spec.ts`
  - route payroll
  - payload public attendance
  - payload supplier quote
- `crisis-opex-flow-ui.spec.ts`
  - bo phu thuoc `networkidle` cho case parent ticket de tranh batch flake
- `expenses-rbac-ui.spec.ts`
  - assert `/expenses/stats`
  - selector audit log
  - cookie/payload `POST /ads/accounts`
  - route payroll
  - wait strategy va guard assertion on dinh hon
- `landing-messages-products-ui.spec.ts`
  - payload create/submit landing page
  - leads query
  - tao parent thu hai bang fixture that
  - them `startDate/endDate` cho teaching report
- `release-gate-ui.spec.ts`
  - reload attendance data truoc khi assert
- `b06-b11-followup-ui.spec.ts`
  - dung teacher fixture that thay vi demo teacher mac dinh

Batch triage da xanh:
- `e2e/release-gate-ui.spec.ts`
- `e2e/landing-messages-products-ui.spec.ts`
- `e2e/expenses-rbac-ui.spec.ts`
- `e2e/bulk-agents-class-config-ui.spec.ts`
- `e2e/crisis-opex-flow-ui.spec.ts`
- `e2e/materials-export-students-ui.spec.ts`
- `e2e/specs/b06-b11-followup-ui.spec.ts`

Luu y van hanh:
- Batch nay da duoc chot o `--workers=1`.
- Chua sync lai `testfrontendui.md`/evidence trong dot nay.


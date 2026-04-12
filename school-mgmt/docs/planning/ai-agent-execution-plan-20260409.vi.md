# Tai lieu ky thuat va phan cong AI agents 2026-04-09

## 1. Muc tieu

Tai lieu nay thay the bo prompt cu bang phien ban bam dung trang thai repo hien tai cua `school-mgmt`.

Muc tieu khong phai "viet lai tu dau", ma la:

- khoa lai nen test dang vo;
- tranh giao agent vao cac file cu sau refactor;
- chi fix cac bug con ton tai that su;
- bo sung test bao ve cho cac luong vua sua;
- giu momentum release ma khong lam hong kien truc moi.

## 2. Thuc trang repo can biet truoc khi chia viec

### 2.1 Blocker hien tai

- Backend unit suite dang do. `npm run test:unit -- --runInBand` fail tren workspace hien tai.
- Nhieu spec backend dang stale sau refactor tach service.
- Frontend evidence pipeline chua dang tin cay:
  - `frontend/scripts/mark-logs-pass.js` co the ghi de trang thai `PASS`.
  - `frontend/scripts/collect-evidence.js` co the nhat media cu/failed run vao evidence chinh thuc.
- Tai lieu handover va execution/result dang mau thuan ve so case `PASS`, `NOT RUN`, `100%`.

### 2.2 Nhung muc trong prompt cu da duoc lam roi

Khong giao lai cac viec sau nhu bug moi:

- `SubmitTeachingReportDto` da co `@MinLength(20)`, `@MaxLength(2000)`, `@IsUrl()`:
  - `backend/src/sessions/dto/submit-teaching-report.dto.ts`
- Form Order da chan `discount > total`:
  - `frontend/src/app/components/orders.component.ts`
- Nut chuyen vi da chi cho `DIRECTOR` va `ACCOUNTING`:
  - `frontend/src/app/components/wallets.component.ts`
- Teaching report da co phan trang va co debounce cho teacher-code filter:
  - `frontend/src/app/components/teaching-report.component.ts`

### 2.3 Nhung cho prompt cu dang nham file

- Logic payout/teaching-report khong nen sua truc tiep trong `attendance.service.ts` va `sessions.service.ts` neu khong can.
- Layer hop ly hon hien tai:
  - `backend/src/sessions/session-payroll.service.ts`
  - `backend/src/sessions/session-query.service.ts`
  - `backend/src/sessions/session-workflow.service.ts`
  - `backend/src/attendance/attendance-session-bridge.service.ts`
- Ads module da tach layer:
  - `backend/src/ads/ads-analytics.service.ts`
  - `backend/src/ads/ads-analytics-actions.service.ts`
  - `backend/src/ads/ads-analytics-suggestions.service.ts`
  - `backend/src/ads/dto/query-actions-required.dto.ts`

## 3. Thu tu trien khai bat buoc

1. Agent 0 khoa lai nen test va evidence.
2. Agent 1 sua backend payroll + teaching report integrity neu van con gap nghiep vu.
3. Agent 2 xac minh va toi uu frontend cho teaching report va cac bug UI con ton tai that su.
4. Agent 3 sua Ads analytics tren kien truc moi.
5. Agent 4 bo sung Playwright regression cho cac luong da chot.

Khong bo qua Agent 0. Neu bo qua, moi agent sau se lam viec tren nen test do, evidence do, va bao cao sai.

## 4. Phan cong 5 AI agents

### Agent 0: Test Stabilization & Evidence Integrity

**Muc tieu**

- Dua backend unit suite ve xanh.
- Khoa lai quy trinh evidence de khong the danh dau `PASS` bang script ma khong co ket qua that.
- Chot nguon su that cho test/evidence docs.

**Ownership**

- `backend/src/**/*.spec.ts`
- `backend/test/**/*.e2e-spec.ts`
- `frontend/scripts/mark-logs-pass.js`
- `frontend/scripts/collect-evidence.js`
- `qa/automation/QA_HANDOVER.md`
- tai lieu execution/result co claim tong hop neu can cap nhat

**Done when**

- `npm run test:unit -- --runInBand` pass.
- Cac spec stale duoc cap nhat theo constructor/service moi.
- Script evidence fail neu thieu artifact/JUnit hop le.
- Khong con claim `100%` neu JUnit/artifact khong chung minh duoc.

**Prompt de paste**

```text
Ban la mot Senior Test Infrastructure Engineer cho repo school-mgmt. Nhiem vu cua ban la on dinh nen test va evidence truoc khi bat ky feature team nao tiep tuc sua code.

Context quan trong:
- Backend unit suite hien dang do.
- Nhieu spec backend stale sau refactor tach service.
- Frontend evidence pipeline hien cho phep danh dau PASS va copy media ma khong rang buoc voi ket qua test that.
- Khong duoc viet them claim "100% pass" neu repo khong co machine evidence khop.

Ownership cua ban:
- backend/src/**/*.spec.ts
- backend/test/**/*.e2e-spec.ts neu assertion dang yeu hoac auto-pass
- frontend/scripts/mark-logs-pass.js
- frontend/scripts/collect-evidence.js
- qa/automation/QA_HANDOVER.md va cac doc tong hop neu can sua claim sai

Yeu cau thuc thi:
1. Sua cac backend unit spec dang stale de khop constructor/service moi. Uu tien:
   - orders.service.spec.ts
   - invoices.service.spec.ts
   - ads-analytics.service.spec.ts
   - attendance.service.spec.ts
   - classes.service.spec.ts
   - messages.service.spec.ts
   - sessions.service.spec.ts
2. Tim va loai cac assertion gia xanh:
   - `expect(true).toBe(true)` khi thieu seed/model
   - assertion kieu `<= finalAmount * 2`
   - expectation qua rong chi de tranh `405/500`
3. Khoa script evidence:
   - `mark-logs-pass.js` khong duoc sua log/execution pack neu khong co artifact hop le
   - `collect-evidence.js` phai rang buoc voi ket qua JUnit va fail neu khong tim thay evidence cho spec duoc yeu cau
4. Cap nhat handover/doc neu claim tong hop hien tai sai voi JUnit va backlog docs.
5. Chay xac minh toi thieu:
   - npm run test:unit -- --runInBand
   - cac test muc tieu ma ban vua sua

Rang buoc:
- Khong revert thay doi cua nguoi khac.
- Khong them framework moi.
- Uu tien fix dung test va script truoc khi sua docs.
- Tra ket qua kem danh sach file da sua va lenh da chay.
```

### Agent 1: Backend Payroll & Teaching Report Integrity

**Muc tieu**

- Xac minh va khoa nghiep vu: buoi hoc khong co teaching report hop le thi khong duoc tinh payout.
- Dong bo trang thai `hasTeachingReport` va du lieu lien quan giua `Sessions`, `Attendance`, va luong.

**Ownership**

- `backend/src/sessions/session-payroll.service.ts`
- `backend/src/sessions/session-query.service.ts`
- `backend/src/sessions/session-workflow.service.ts`
- `backend/src/sessions/sessions.service.ts` chi neu can orchestration
- `backend/src/attendance/attendance-session-bridge.service.ts`
- `backend/src/payroll/payroll-transaction.service.ts` neu can dong bo side effect
- unit/e2e tests lien quan

**Done when**

- Co mot nguon logic ro rang de xac dinh "qualified teaching report".
- Payout fallback/preview/finalization deu ton trong dieu kien nay.
- Event/bridge cap nhat `Attendance` sau submit report khong bi lech state.
- Test bao ve cac path co va khong co report.

**Prompt de paste**

```text
Ban la mot Senior Backend Architect cho repo school-mgmt. Nhiem vu cua ban la khoa nghiep vu teaching report -> payroll tren codebase hien tai sau refactor, khong duoc gia dinh rang logic van nam o attendance.service.ts hay sessions.service.ts.

Context quan trong:
- `SubmitTeachingReportDto` da co MinLength/MaxLength/IsUrl, khong lap lai viec nay.
- Code hien tai da tach nhieu logic sang:
  - backend/src/sessions/session-payroll.service.ts
  - backend/src/sessions/session-query.service.ts
  - backend/src/sessions/session-workflow.service.ts
  - backend/src/attendance/attendance-session-bridge.service.ts
- Muc tieu la khoa lai nghiep vu, khong pha kien truc moi.

Ownership cua ban:
- backend/src/sessions/session-payroll.service.ts
- backend/src/sessions/session-query.service.ts
- backend/src/sessions/session-workflow.service.ts
- backend/src/attendance/attendance-session-bridge.service.ts
- cac test lien quan den sessions, attendance, payroll

Yeu cau thuc thi:
1. Kiem tra toan bo cac noi tinh payout/fallback/finalization/preview.
2. Dam bao rule sau duoc ap dung nhat quan:
   - neu `hasTeachingReport !== true` hoac `teachingReport.lessonContent` rong/khong hop le thi payout = 0
   - neu co report hop le thi moi duoc tinh payout theo pricing snapshot hien hanh
3. Neu state `Sessions` va `Attendance` co the lech nhau, them hoac sua bridge/event de dong bo ngay sau khi giao vien submit report.
4. Them warning log co ngu canh khi payout bi ep ve 0 do thieu teaching report.
5. Viet test bao ve cho:
   - co report hop le -> payout > 0 theo config
   - khong co report -> payout = 0
   - submit report -> state session/attendance dong bo
   - fallback path khong lam phat sinh payout sai

Rang buoc:
- Uu tien sua layer service con thay vi nhồi vao facade.
- Khong duplicate business rule o 2-3 noi neu co the trich helper chung.
- Phai chay lai test lien quan sau khi sua.
- Tra ket qua kem file da sua, test da chay, va nghiep vu da khoa.
```

### Agent 2: Frontend UI & Performance Verification

**Muc tieu**

- Khong sua lai cac bug Order/Wallet neu code hien tai da dat rule.
- Xac minh bug nao con tai hien that su.
- Neu teaching report van bi spam API khi inline edit, sua dung path inline save va them loading state theo item dang save.

**Ownership**

- `frontend/src/app/components/orders.component.ts` chi neu bug con tai hien
- `frontend/src/app/components/wallets.component.ts` chi neu bug con tai hien
- `frontend/src/app/components/teaching-report.component.ts`
- `frontend/src/app/components/shared/teaching-report-form.component.ts`
- `frontend/src/app/components/shared/teaching-report-pending.component.ts`
- `frontend/src/app/components/shared/teaching-report-completed.component.ts`
- frontend unit spec neu can

**Done when**

- Co bang chung ro rang bug `discount > total` va RBAC wallet con hay da het.
- Neu con bug teaching report, inline edit duoc debounce dung chinh luong save.
- Co loading state nho theo item dang save, khong phai spinner toan man.
- Khong lam hong phan trang teaching report hien co.

**Prompt de paste**

```text
Ban la mot Senior Angular Engineer cho repo school-mgmt. Nhiem vu cua ban la xac minh va toi uu frontend theo codebase hien tai, khong duoc gia dinh rang bug cu van chua sua.

Context quan trong:
- Orders da co check `discount > total` trong orders.component.ts.
- Wallets da co `canTransfer()` chi cho DIRECTOR va ACCOUNTING.
- Teaching report da co phan trang va debounce cho teacher-code filter, nhung can kiem tra xem inline save co con spam API hay khong.

Ownership cua ban:
- frontend/src/app/components/orders.component.ts
- frontend/src/app/components/wallets.component.ts
- frontend/src/app/components/teaching-report.component.ts
- frontend/src/app/components/shared/teaching-report-*.component.ts

Yeu cau thuc thi:
1. Doc code hien tai va xac dinh:
   - bug Order da duoc khoa chua
   - bug Wallet RBAC da duoc khoa chua
   - teaching report inline edit/save hien dang di theo luong nao
2. Chi sua code neu bug van con ton tai that su.
3. Neu inline edit teaching report van spam API:
   - dua luong save qua Subject/RxJS hop ly
   - dung `debounceTime` + `distinctUntilChanged` tren luong edit/save phu hop
   - them `isSaving` theo tung item/field dang save
4. Giu standalone component patterns hien co.
5. Khong pha pagination va role-specific behavior.

Rang buoc:
- Khong "fix" lai nhung cho da dung.
- Neu mot bug da duoc khoa, chi bo sung test/ghi chu nho neu can.
- Phai chay test hoac it nhat prove bang targeted verification cho phan vua sua.
- Tra ket qua kem file da sua va bug nao da xac nhan con ton tai / da khong con.
```

### Agent 3: Ads Analytics on Current Architecture

**Muc tieu**

- Sua va hoan thien `getActionsRequired` tren kien truc Ads moi.
- Khong gop lai monolith cu.
- Dong bo type, dto, action builder, va tests.

**Ownership**

- `backend/src/ads/ads.types.ts`
- `backend/src/ads/dto/query-actions-required.dto.ts`
- `backend/src/ads/ads-analytics.service.ts`
- `backend/src/ads/ads-analytics-actions.service.ts`
- `backend/src/ads/ads-analytics-suggestions.service.ts` neu can
- `backend/src/ads/ads-analytics.service.spec.ts`

**Done when**

- Type/DTO/response khop thiet ke hien tai.
- `getActionsRequired` chay dung tren layer actions service va facade.
- Unit test khop implementation moi, khong mock method da bi xoa.

**Prompt de paste**

```text
Ban la mot Senior Data Engineer + Backend Developer cho repo school-mgmt. Nhiem vu cua ban la hoan thien Ads actionable analytics tren kien truc hien tai, khong duoc viet lai thanh monolith cu.

Context quan trong:
- `QueryActionsRequiredDto` da ton tai.
- Ads module da tach thanh:
  - ads-analytics.service.ts
  - ads-analytics-actions.service.ts
  - ads-analytics-suggestions.service.ts
  - cac utility/type files lien quan
- Unit test hien dang stale va khong khop facade moi.

Ownership cua ban:
- backend/src/ads/ads.types.ts
- backend/src/ads/dto/query-actions-required.dto.ts
- backend/src/ads/ads-analytics.service.ts
- backend/src/ads/ads-analytics-actions.service.ts
- backend/src/ads/ads-analytics.service.spec.ts

Yeu cau thuc thi:
1. Ra soat xem type `ActionableSuggestion` da du thong tin chua:
   - `subType`
   - `reasons[]`
   - `priority` co `CRITICAL`
   - `estimatedImpact`
2. Hoan thien luong `getActionsRequired()` theo architecture hien tai:
   - lay du lieu can thiet song song bang `Promise.all`
   - xu ly 3 nhom action:
     - `PAUSE_GROUP`
     - `ADJUST_BUDGET`
     - `CREATE_GROUP`
   - co summary `{ actions, summary }`
3. Xu ly edge cases:
   - mang rong
   - chia cho 0
   - khong co nhom dang lai
   - budget du/am
4. Sua unit tests de bam facade/service moi, khong mock cac method da bi tach bo.

Rang buoc:
- Khong collapse lai cac service con vao 1 file.
- Uu tien su dung helper/type co san.
- Phai chay lai unit tests cho ads module.
- Tra ket qua kem file da sua va assumptions nghiep vu neu co.
```

### Agent 4: QA Automation with Existing Playwright Stack

**Muc tieu**

- Bo sung regression tests cho cac fix da chot.
- Su dung Playwright hien co, khong them Cypress.
- Rang buoc voi evidence/JUnit that sau khi Agent 0 da khoa pipeline.

**Ownership**

- `frontend/e2e/`
- uu tien cac file:
  - `frontend/e2e/orders-flow-ui.spec.ts`
  - `frontend/e2e/wallets-refunds-flow-ui.spec.ts`
  - `frontend/e2e/specs/b06-b11-followup-ui.spec.ts`
  - hoac tao file moi neu thuc su can

**Done when**

- Co test cho B04 order invalid discount.
- Co test RBAC B07 transfer button.
- Co test teaching report debounce/save behavior bang Playwright intercept/spy hop ly.

**Prompt de paste**

```text
Ban la mot Senior QA Automation Engineer cho repo school-mgmt. Nhiem vu cua ban la bo sung Playwright regression tests cho cac luong da duoc chot, tren nen suite hien co. Khong su dung Cypress.

Context quan trong:
- Repo da co Playwright stack va nhieu spec san.
- Agent 0 se khoa evidence pipeline; test cua ban phai dua tren execution that.
- Bug Order discount va Wallet transfer co the da duoc fix trong code; test cua ban co muc tieu bao ve de tranh hoi quy.

Ownership cua ban:
- frontend/e2e/
- uu tien mo rong cac spec san co truoc khi tao file moi

Yeu cau thuc thi:
1. Viet hoac mo rong test B04:
   - login role SALE
   - mo Orders
   - nhap discount > total
   - assert warning hien thi
   - assert submit bi disable
2. Viet hoac mo rong test B07:
   - login role OPS -> vao `/app/wallets` -> khong thay nut transfer
   - login role ACCOUNTING -> thay nut transfer
3. Viet test teaching report:
   - mock hoac intercept API PATCH/save
   - gay luong go lien tuc vao path inline editing/saving thuc te
   - assert so lan goi API dung voi debounce behavior da chot
4. Neu code hien tai khong co inline-save debounce o path nay, phan hoi ro de Agent 2 tiep tuc fix.

Rang buoc:
- Khong viet test dua tren behavior cu da bi thay doi.
- Khong chap nhan assertion qua rong kieu "khong 405" hay "khong crash" neu co the assert nghiep vu cu the hon.
- Chay targeted Playwright tests sau khi viet.
- Tra ket qua kem file da sua va lenh da chay.
```

## 5. Rule phoi hop giua agents

- Agent 0 phai xong hoac it nhat dat mốc "unit suite pass + evidence scripts da khoa" truoc khi doc PASS/FAIL cua agent khac.
- Agent 1, 2, 3 khong duoc sua cung mot file neu khong that can thiet.
- Agent 4 khong duoc hop thuc hoa log tay hay script "mark pass"; chi nhan ket qua tu test that.
- Neu Agent 2 xac nhan bug Order/Wallet da het, khong duoc mo lai implementation chi de "giong prompt cu".
- Neu Agent 3 can doi type ads, phai cap nhat test cung luc.

## 6. Danh sach giao viec ngan gon cho PM / operator

- Giao Agent 0 truoc.
- Sau khi Agent 0 bao unit xanh, giao Agent 1, 2, 3 song song.
- Khi 3 agent tren xong, giao Agent 4 viet regression va rerun targeted suite.
- Cap nhat docs handover chi sau khi co machine evidence khop.

## 7. Ket luan

Ban prompt cu dung ve huong nghiep vu, nhung khong con bam dung repo hien tai. Ban nay duoc viet lai de:

- tranh sua trung viec da lam;
- tranh sua nham file sau refactor;
- buoc test/evidence ve lai dung vai tro gate truoc release.


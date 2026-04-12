# Integrated Backlog 2026-04-09

## 1. Muc tieu

Tai lieu nay la master backlog cho dot chan release cua repo `school-mgmt`.

Muc tieu:

- tong hop cac van de ton dong da duoc review tu test plans, test files, execution, results, va QA evidence;
- phan biet ro van de nao da duoc xac nhan boi code/test runner, van de nao moi la rui ro can verify;
- khoa thu tu xu ly, owner/workstream, va exit criteria truoc khi huy dong sua code hang loat;
- thay the cach bao cao dua tren markdown tong hop bang machine evidence va CI gates.

Scope backlog nay uu tien:

- backend test reliability;
- QA evidence integrity;
- security va privacy;
- data integrity va business logic;
- performance va infrastructure;
- frontend coverage va CI governance.

## 2. Snapshot hien trang da duoc xac nhan

Snapshot nay duoc xac nhan tren ngay `2026-04-09`.

1. Backend unit suite dang do.
   - Da chay `npm run test:unit -- --runInBand`.
   - Ket qua: `8` suite fail, `17` suite pass, `35` test fail.

2. Frontend Playwright inventory dang bi tron nhieu loai test vao cung mot so tong.
   - Da chay `npm run e2e:ui -- --list`.
   - Ket qua: `720` tests trong `66` files.
   - Trong do co ca:
     - browser UI specs;
     - request/API-only specs;
     - recorder/video/evidence specs.

3. CI hien tai chi co backend workflow.
   - Workflow dang hien dien: `.github/workflows/backend-tests.yml`.
   - Chua co workflow frontend gate build/test/e2e phu hop.

4. Backend E2E da timeout nhieu lan o muc runner.
   - Day la su kien da xay ra that.
   - Root cause chua duoc khoanh lai day du.

## 3. Nguon su that va cac quyet dinh khoa ngay

### 3.1 Nguon su that tam thoi

Cho den khi evidence pipeline duoc sua xong, release readiness chi duoc doc tu:

- output truc tiep cua test runner:
  - Jest stdout/stderr;
  - JUnit XML;
  - Playwright HTML report;
- artifact do runner sinh truc tiep:
  - trace;
  - video;
  - screenshot;
- workflow logs trong CI.

Tat ca file markdown tong hop chi la secondary docs, khong phai source of truth.

### 3.2 Cac quyet dinh khoa ngay

1. `qa/automation/QA_HANDOVER.md` khong duoc coi la release evidence.
2. Cac file claim `100% pass` ma khong doi chieu duoc voi machine evidence deu phai bi gan nhan `obsolete` hoac `deprecated`.
3. `school-mgmt/frontend/scripts/mark-logs-pass.js` va `school-mgmt/frontend/scripts/collect-evidence.js` khong duoc phep tiep tuc tao narrative PASS.
4. UI Browser Coverage, API Integration Coverage, va Evidence Recorder Coverage phai la `3` metric tach biet.
5. Khong merge release blocker work neu backend unit suite van do hoac QA evidence van co the bi fake.

## 4. Nguon thong tin da tong hop

Backlog nay tong hop tu:

- review truc tiep tren repo;
- ket qua test runner da chay tren ngay `2026-04-09`;
- docs va evidence dang ton tai:
  - `qa/automation/QA_HANDOVER.md`
  - `frontend-ui-evidence/2026-04-08/EXECUTION-RESULTS-ALL.vi.md`
  - `qa/reports/frontend-ui/remaining-cases.vi.md`
  - `qa/reports/frontend-ui/final-verification-20260408.vi.md`
  - `qa/plans/frontend-ui/master-test-plan.vi.md`
  - `school-mgmt/docs/ai-agent-execution-plan-20260409.vi.md`
- review code tren:
  - `school-mgmt/backend/src`
  - `school-mgmt/backend/test`
  - `school-mgmt/frontend/e2e`
  - `school-mgmt/frontend/scripts`
  - `.github/workflows`

## 5. Danh sach van de ton dong tich hop

Quy uoc:

- `[CONFIRMED]`: da xac nhan bang code, config, hoac test runner.
- `[VERIFY]`: chua co bang chung day du, nhung rui ro du lon de phai dua vao backlog.
- `[PARTIAL]`: da co mot phan giam thieu, nhung chua dat muc release-safe.

### 5.1 Critical - Test reliability, evidence integrity, release safety

1. `[CONFIRMED]` Backend unit suite dang do va mat luoi bao ve cap unit.
   - Fail groups da xac nhan:
     - `backend/src/orders/orders.service.spec.ts`
     - `backend/src/invoices/invoices.service.spec.ts`
     - `backend/src/ads/ads-analytics.service.spec.ts`
     - `backend/src/attendance/attendance.service.spec.ts`
     - `backend/src/classes/classes.service.spec.ts`
     - `backend/src/messages/messages.service.spec.ts`
     - `backend/src/sessions/sessions.service.spec.ts`
     - `backend/src/users/users.service.spec.ts`
   - Ban chat cua loi hien tai la drift sau refactor: constructor drift, method/mock drift, va assertion stale.

2. `[CONFIRMED]` Evidence pipeline co kha nang fake PASS.
   - `school-mgmt/frontend/scripts/mark-logs-pass.js` co the doi status/log/checklist sang PASS.
   - `school-mgmt/frontend/scripts/collect-evidence.js` co the copy media theo alias/mtime ma khong doi chieu chat voi JUnit/result.
   - `school-mgmt/frontend/package.json` van expose entrypoints cho workflow nay:
     - `e2e:evidence:collect`
     - `evidence:mark-pass`

3. `[CONFIRMED]` QA docs dang xung dot nhau va khong the dung lam release evidence.
   - `qa/automation/QA_HANDOVER.md` claim `100%` / `291+ cases`.
   - `frontend-ui-evidence/2026-04-08/EXECUTION-RESULTS-ALL.vi.md` ghi `71 PASS / 183 NOT RUN`.
   - `qa/reports/frontend-ui/remaining-cases.vi.md` va `qa/reports/frontend-ui/final-verification-20260408.vi.md` tiep tuc tao narrative mau thuan.

4. `[CONFIRMED]` Reporter/artifact plumbing chua du de khoa nguon su that bang may.
   - Frontend `playwright.config.ts` chua xuat HTML report dung nghia source of truth.
   - Backend unit config `backend/test/jest-unit.json` chua co JUnit reporter cho unit suite.
   - Neu khong bo sung reporting, "machine truth" van khong du de doi chieu docs.

5. `[CONFIRMED]` Backend E2E bi timeout o muc runner, nen release signal cap integration dang khong dang tin.
   - Rui ro goc gom:
     - unclosed DB/Redis handles;
     - cron/background tasks khong tat trong test;
     - async leaks;
     - setup/teardown khong sach.
   - Static inspection chua tim thay smoking gun ro rang, nen van can isolate them bang targeted runs.

6. `[CONFIRMED]` Media nhay cam lien quan attendance va teaching reports dang co privacy exposure.
   - Selfie diem danh hoc sinh duoc luu thanh file duoi `uploads/attendance`.
   - Ung dung dang expose cay `uploads` qua static public path `/uploads/...`.
   - `recordingUrl` trong teaching report dang duoc validate nhu URL thong thuong, luu raw, va tra ve qua reporting flow, chua co lop access-control ro rang hoac signed URL flow.

7. `[CONFIRMED]` Frontend hien chua co CI gate phu hop cho build/test/e2e.
   - Release readiness frontend dang phu thuoc docs va local runs.

### 5.2 High - QA quality, coverage inflation, business/test correctness

8. `[CONFIRMED]` Coverage UI dang bi thoi phong do gom nhieu loai spec vao mot metric.
   - Dang bi dem chung:
     - browser UI specs;
     - request/API-only specs;
     - recorder/video specs.
   - Vi du request/API-only:
     - `school-mgmt/frontend/e2e/api/cron-jobs-execution.spec.ts`
     - `school-mgmt/frontend/e2e/api/race-conditions-idempotency.spec.ts`
   - Vi du recorder/video:
     - `school-mgmt/frontend/e2e/ui-automation-video-pilots.spec.ts`
     - `school-mgmt/frontend/e2e/ui-automation-video-remaining.spec.ts`
     - `school-mgmt/frontend/e2e/b07-invoices-wallets-payroll-video.spec.ts`

9. `[CONFIRMED]` CI bo sot nhieu regression scripts backend dang ton tai trong `package.json`.
   - Workflow hien tai chua map day du cac `test:*` quan trong.
   - `school-mgmt/backend/scripts/test-all.js` con phu thuoc backend da chay san, khong phu hop lam CI gate truc tiep.

10. `[CONFIRMED]` Backend va frontend van ton tai false positives va assertions qua yeu.
   - Backend:
     - `school-mgmt/backend/test/group10-rbac-security.e2e-spec.ts` co `expect(true).toBe(true)`.
     - `school-mgmt/backend/test/group9-expenses-concurrency.e2e-spec.ts` co `expect(true).toBe(true)`.
     - `school-mgmt/backend/test/trial-order-propagation.e2e-spec.ts` con `it.todo`.
   - Frontend:
     - con `test.skip`, `test.fixme`, va assertions qua rong trong nhieu spec thuoc `school-mgmt/frontend/e2e/specs`.

11. `[VERIFY]` Timezone trap trong logic han nop teaching report va phat luong chua duoc bao ve bang test bien.
   - Deadline dang duoc tinh bang server-side `Date` math.
   - Rui ro dac biet cao khi server va nguoi dung khac mui gio.
   - Can bo sung boundary tests cho UTC va UTC+7.

12. `[VERIFY]` Financial rollback/clawback sau khi da `PAID` hoac `RECONCILED` chua duoc xac nhan an toan.
   - He thong hien co xu huong hard-block mot so loai chinh sua khi da chot.
   - Nhung chua thay duoc mot thiet ke end-to-end ro rang cho "tao but toan dieu chinh/clawback thay vi sua lich su".

13. `[VERIFY]` Race condition cap database va duplicate ledger entries chua duoc khoa bang invariants manh tren moi flow.
   - Test double-click cap API la chua du.
   - Da co mot so transaction/idempotency protections o mot so flow top-up.
   - Van can kiem tra them:
     - idempotency keys;
     - unique constraints;
     - transactional boundary;
     - duplicate LedgerEntry prevention cho cac flow `sessionId`-scoped.

14. `[VERIFY]` Man hinh teaching report co rui ro tran RAM va treo trinh duyet khi tai tap du lieu lon.
   - Docs phan tich truoc do da canh bao rui ro nay.
   - Can co test perf/coarse profiling voi dataset lon.

15. `[VERIFY]` Cronjobs ban dem va query scans can duoc audit lai theo index thuc te va connection-pool pressure.
   - Rui ro la co that, nhung khong duoc phep claim "missing indexes" mot cach tong quat neu chua doi chieu query plans.

16. `[VERIFY]` Row-level security can duoc audit rong hon cho toan bo cac endpoint lien quan teaching reports/teacher data.
   - Main path hien da co bao ve mot phan.
   - Backlog can yeu cau sweep toan bo endpoints gan domain nay.

### 5.3 Security & privacy

17. `[PARTIAL]` Public attendance submit da co mot so lop giam thieu, nhung chua dat muc release-safe ve privacy.
   - Da co:
     - `ThrottlerGuard`;
     - `@Throttle(...)` tren public attendance routes;
     - validate base64 image, size, mime-type, va magic bytes.
   - Chua du:
     - signed URL/co che truy cap co han;
     - policy retention cho selfie/video;
     - review exposure cua media lien quan hoc sinh va bai giang.

18. `[CONFIRMED]` Storage/access pattern cua media hoc sinh va giao vien can duoc dua vao release blocker list.
   - Selfie diem danh va recording URLs la du lieu nhay cam.
   - Neu van phat qua public static URLs hoac raw public links, day la privacy blocker.

19. `[VERIFY]` Can review toan bo endpoint public/list de dam bao:
   - endpoint public co throttling/rate limiting phu hop;
   - endpoint list doi voi role khong phai admin co row-level filter ep tu token;
   - khong co path nao cho teacher hoac hoc sinh xem du lieu cua nguoi khac.

### 5.4 Data integrity & business logic

20. `[VERIFY]` Teaching report salary penalty can duoc test lai o day bien `24h`, cuoi ngay, va chuyen mui gio.

21. `[VERIFY]` Attendance/session retroactive changes can duoc test voi cac trang thai tai chinh:
   - unpaid;
   - paid;
   - reconciled;
   - da xuat ledger.

22. `[VERIFY]` Financial invariants can duoc viet thanh assertions bat buoc trong E2E:
   - so du cuoi cung = tong ledger hop le;
   - khong co double-credit;
   - khong co silent rewrite but toan da chot so.

### 5.5 Performance & infrastructure

23. `[CONFIRMED]` Backend E2E timeout la mot tin hieu ha tang/test harness co van de nghiem trong.

24. `[VERIFY]` Teaching report list/load strategy can duoc review voi dataset lon.
   - Muc tieu la tranh load ca nam attendance vao client neu khong co pagination/chunking/hard limits.

25. `[PARTIAL]` Cron/index risk can duoc dua vao backlog duoi dang "index review va query-plan audit", khong phai duoi dang "xac nhan missing indexes hang loat".
   - Session domain da co mot so indexes.
   - Van can audit cac cron khac ngoai session domain va cac query scan thuc te.

## 6. Cac diem da duoc xac nhan la co giam thieu mot phan

Muc nay duoc giu rieng de backlog khong claim sai.

1. Public attendance submit khong phai mot file upload mo hoan toan.
   - Da co throttling tren public attendance controller.
   - Da co image validation tren base64 path.
   - Van con privacy risk do static public serving.

2. Teaching report row-level security khong phai "trang trang".
   - Main reporting path da co logic ep `teacherId` theo actor role `TEACHER`.
   - Teacher inline edits da co ownership check.
   - Van can sweep cac endpoint lien quan de dam bao khong co path ngoai le.

3. Cron jobs khong phai "khong co index gi".
   - Session domain da co mot so indexes.
   - Van can audit query-plan thuc te tren cron-heavy flows khac.

4. Mot so financial flows da co transaction/idempotency mot phan.
   - Vi du top-up approval va invoice-driven top-up.
   - Van chua du de ket luan tat ca session/deduct/refund flows deu safe.

## 7. Pre-test checklist bat buoc truoc khi retest quy mo lon

Khong chay lai hang loat frontend cases hoac full backend retest neu chua xong checklist nay.

1. Feature freeze.
   - Dung them feature moi.
   - Chi sua release blockers va test harness.

2. Khoa evidence pipeline sai.
   - Quarantine `mark-logs-pass.js`.
   - Quarantine `collect-evidence.js`.
   - Go hoac rename npm entrypoints quang ba workflow nay neu can.

3. Cau hinh lai reporter/artifact.
   - Frontend:
     - Playwright HTML report;
     - JUnit XML;
     - trace/video/screenshot policy ro rang.
   - Backend:
     - unit JUnit reporter;
     - e2e JUnit output on dinh.

4. Chot lai test data strategy.
   - Tao `seed-e2e.ts` hoac mot reset harness tuong duong.
   - Khong chay E2E tren DB dev dung chung.
   - Moi batch B04/B05/B07 lien quan tien phai co data reset sach.

5. Review lai guards/decorators va row-level filters.
   - Public endpoints phai co throttling hop ly.
   - GET list phai ep filter theo token doi voi role khong phai admin.

6. Dung cleanup harness cho backend tests.
   - dong app;
   - dong DB connection;
   - dong Redis connection;
   - tat background jobs/cron;
   - xoa test data.

7. Chot lai metric coverage.
   - Tach `browser-ui`, `api-integration`, `evidence-recorder`.

8. Chuan bi targeted debug runs cho E2E timeout.
   - uu tien `--detectOpenHandles` hoac suite isolation;
   - khong rerun full suite mu quang khi chua khoanh root cause.

## 8. Ke hoach xu ly theo phase

### Phase 0 - Freeze claims, khoa evidence, lap lai machine truth

Muc tieu:

- cham dut fake PASS;
- dat nen reporting/artifacts dung de phuc hoi source of truth.

Cong viec:

1. Quarantine `school-mgmt/frontend/scripts/mark-logs-pass.js`.
2. Quarantine `school-mgmt/frontend/scripts/collect-evidence.js`.
3. Go, doi ten, hoac canh bao ro cac npm scripts lien quan trong `school-mgmt/frontend/package.json`.
4. Bo sung Playwright HTML report.
5. Bo sung backend unit JUnit reporter.
6. Gan nhan `obsolete`/`deprecated` cho:
   - `qa/automation/QA_HANDOVER.md`
   - `qa/reports/frontend-ui/final-verification-20260408.vi.md`
   - cac summary docs khong doi chieu duoc voi runner outputs
7. Ghi ro source of truth moi trong docs.

Exit criteria:

- Khong con duong nao tao PASS narrative ma khong co runner evidence.
- Frontend va backend deu xuat du reporter/artifacts de CI va docs co the doi chieu.

### Phase 1 - Dua backend unit suite ve xanh

Muc tieu:

- sua drift sau refactor;
- phuc hoi luoi bao ve cap unit nhanh nhat.

Cong viec:

1. Fix constructor drift:
   - `backend/src/orders/orders.service.spec.ts`
   - `backend/src/invoices/invoices.service.spec.ts`
2. Fix method/mock drift:
   - `backend/src/ads/ads-analytics.service.spec.ts`
   - `backend/src/attendance/attendance.service.spec.ts`
   - `backend/src/classes/classes.service.spec.ts`
   - `backend/src/messages/messages.service.spec.ts`
   - `backend/src/sessions/sessions.service.spec.ts`
3. Fix logic/assertion drift:
   - `backend/src/users/users.service.spec.ts`
4. Chay lai:
   - `npm run test:unit -- --runInBand`

Exit criteria:

- Unit suite xanh, hoac fail con lai da duoc thu hep thanh root-cause cu the khong con lien quan den drift hang loat.

### Phase 2 - Sua backend E2E false positives va timeout

Muc tieu:

- loai false green;
- khoanh lai root cause timeout;
- khoa lai invariants tai chinh.

Cong viec:

1. Xoa `expect(true).toBe(true)` va fallback assertions tuong tu.
2. Xoa `it.todo`, `skip`, `fixme` o cac flow release-critical neu khong con ly do giu lai.
3. Tighten financial assertions:
   - final balance;
   - ledger count;
   - idempotency;
   - no double-credit.
4. Audit setup/teardown:
   - app close;
   - DB close;
   - Redis close;
   - cron/background jobs;
   - fake timers/unawaited promises.
5. Bo sung test cases:
   - timezone boundary cho han nop teaching report;
   - rollback/clawback sau `PAID`/`RECONCILED`;
   - concurrent duplicate ledger entry.
6. Chay targeted E2E suites truoc khi full rerun.

Exit criteria:

- Root cause timeout duoc xac dinh va co fix hoac mitigation cu the.
- Cac suite tai chinh va security trong pham vi muc tieu khong con false positives.

### Phase 3 - Security, privacy, va governance fixes

Muc tieu:

- ha rui ro privacy va access control xuong muc chap nhan duoc;
- chot scope security blockers truoc release.

Cong viec:

1. Review upload/media path lien quan attendance va recordings.
2. Chuyen media nhay cam khoi co che public static neu can.
3. Danh gia signed URL, access-controlled delivery, retention policy, va cleanup policy.
4. Sweep row-level security tren teaching reports va cac endpoint teacher/student data lien quan.
5. Audit throttling/rate limit tren cac public endpoints.

Exit criteria:

- Khong con media nhay cam bi expose theo kieu public URL khong kiem soat.
- Access rules quan trong duoc test va document hoa.

### Phase 4 - Chinh lai frontend coverage va test inventory

Muc tieu:

- cat bo ao giac coverage;
- chuan hoa test inventory theo dung loai.

Cong viec:

1. Phan loai Playwright specs thanh:
   - `browser-ui`
   - `api-integration`
   - `evidence-recorder`
2. Cap nhat docs/execution checklists theo metric moi.
3. Ra soat teaching-report perf risks va xac dinh can pagination/hard-limit/perf tests nao.
4. Chot danh sach frontend cases can rerun that su.

Exit criteria:

- Khong con dem request-only hoac recorder specs vao UI Browser Coverage.
- Co inventory frontend tests ro rang va co the rerun co kiem soat.

### Phase 5 - Mo rong CI/CD va regression gates

Muc tieu:

- dua nhung signal vua phuc hoi vao CI;
- tranh tai dien "docs xanh, he thong do".

Cong viec:

1. Map `backend/package.json` sang `.github/workflows/backend-tests.yml`.
2. Tao frontend workflow toi thieu cho:
   - build;
   - test/unit neu co;
   - selected Playwright smoke/classified suites.
3. Dam bao CI thu artifact dung:
   - JUnit;
   - Playwright HTML;
   - trace/video/screenshot khi can.
4. Danh gia lai `school-mgmt/backend/scripts/test-all.js`.
   - Hoac sua de CI-friendly.
   - Hoac giam scope va thay bang workflow ro rang hon.

Exit criteria:

- Backend va frontend deu co CI gates toi thieu.
- CI artifacts du de doi chieu docs va release status.

## 9. To chuc workstreams va AI agents

### Agent A - Backend Unit Recovery

Pham vi:

- constructor drift;
- method/mock drift;
- stale assertions o unit suite.

Deliverables:

- danh sach spec da sua;
- ket qua `npm run test:unit -- --runInBand`;
- fail con lai neu co.

### Agent B - Backend E2E Reliability

Pham vi:

- timeout investigation;
- async leaks;
- false positives;
- financial invariants.

Deliverables:

- root-cause shortlist;
- patch cho setup/teardown/assertions;
- ket qua targeted E2E reruns.

### Agent C - Security & Privacy

Pham vi:

- public attendance submit;
- media exposure;
- signed URL/access policy;
- row-level security sweep;
- throttling audit.

Deliverables:

- danh sach gaps da xac nhan;
- de xuat fix policy/code/test;
- danh sach endpoint/media paths can chan release neu chua fix.

### Agent D - Frontend Coverage & Performance

Pham vi:

- phan loai Playwright inventory;
- teaching-report perf risk;
- UI/API/recorder metrics.

Deliverables:

- mapping file -> category;
- danh sach specs can move/rename/relabel;
- danh sach perf checks can them.

### Agent E - QA Evidence & CI Governance

Pham vi:

- evidence scripts;
- package entrypoints;
- reporters;
- docs deprecation;
- CI artifact policy.

Deliverables:

- de xuat quarantine/remove;
- de xuat workflow/reporters;
- danh sach docs can obsolete.

### Agent F - Test Data & Seed Harness

Pham vi:

- `seed-e2e.ts` hoac reset harness tuong duong;
- isolated test DB strategy;
- cleanup policy sau test.

Deliverables:

- de xuat seed/reset design;
- danh sach suites phai chuyen sang isolated data;
- checklist de rerun an toan.

## 10. Nguyen tac thuc thi

1. Khong ep xanh test.
2. Khong mo rong scope sang feature moi.
3. Moi thay doi docs phai bam machine output.
4. Moi thay doi test phai kem lenh da chay va ket qua that.
5. Khong claim security/privacy issue la "da xong" neu chua co test hoac policy ro rang.
6. Khong rerun batch lon tren data ban dev dung chung.

## 11. Thu tu xu ly chan release

Thu tu mac dinh:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5

Ly do:

- Phase 0 khoa su that.
- Phase 1 phuc hoi luoi bao ve nhanh nhat.
- Phase 2 moi duoc doc ket qua integration.
- Phase 3 giam rui ro security/privacy truoc release.
- Phase 4 moi duoc noi ve coverage that.
- Phase 5 moi dua ket qua da sua vao CI gates.

## 12. Definition of Done cho dot backlog nay

Dot xu ly nay chi duoc xem la dat muc release-ready toi thieu khi:

1. backend unit suite xanh hoac con lai chi la fail da duoc khoanh root cause ro rang va duoc phe duyet;
2. khong con evidence scripts co the fake PASS;
3. docs claim pass/fail chi mirror machine evidence;
4. backend E2E timeout da co root cause va regression-targeted suites da on dinh;
5. UI Browser Coverage, API Integration Coverage, Evidence Recorder Coverage duoc tach biet;
6. privacy risk cua media nhay cam da co huong xu ly ro rang va khong con bi xem nhe;
7. backend va frontend deu co CI gates toi thieu cho release signal.


# Shared Account Sheet - Wave 0

Muc dich: day la sheet van hanh cho Wave 0, dung chung cho UI/API smoke va batch test dau tien.

## Nguon goc thong tin

- `school-mgmt/backend/.env`
- `school-mgmt/backend/scripts/seed-all.js`
- `school-mgmt/backend/scripts/seed-users.js`
- `school-mgmt/backend/scripts/ensure-commercial-admin.js`

## Tai khoan canonic

| Role | Canonical email | Password source | Password value | Login purpose | Notes |
|---|---|---|---|---|---|
| DIRECTOR | `admin@local` | `.env` -> `ADMIN_PASSWORD` | `ChangeMe123!` | Admin cap nhat, duyet, xem tong quan | Safest master account cho UI va API wave co can quyen cao |
| DIRECTOR | `director.demo@school.local` | `seed-all.js` -> `DEMO_PASSWORD` | `Demo123456!` | Demo director trong du lieu seed | An toan cho smoke, it rui ro hon admin chinh |
| ACCOUNTING | `accounting.demo@school.local` | `seed-all.js` -> `DEMO_PASSWORD` | `Demo123456!` | Kiem tra finance, invoice, wallet, payroll | Safest cho wave tai chinh va API finance |
| OPS | `ops.demo@school.local` | `seed-all.js` -> `DEMO_PASSWORD` | `Demo123456!` | Kiem tra ops, student intake, approval flows | Safest cho UI ops va API CRUD nghiep vu |
| TEACHER | `teacher.demo@school.local` | `seed-all.js` -> `DEMO_PASSWORD` | `Demo123456!` | Smoke giao vien, lop hoc, session, attendance | Tot cho UI role-based visibility |
| PARENT | `parent.demo@school.local` | `seed-all.js` -> `DEMO_PASSWORD` | `Demo123456!` | Smoke phu huynh, payment, schedule, ticket | Dung cho UI parent-facing journeys |
| ADSMANAGER | `ads.demo@school.local` | `seed-all.js` -> `DEMO_PASSWORD` | `Demo123456!` | Smoke ads, landing, chatbot-settings, public flow | Canonical role cho B09/B10 va Wave 3 frontend |
| SHAREHOLDER | `shareholder.demo@school.local` | `seed-all.js` -> `DEMO_PASSWORD` | `Demo123456!` | Smoke investor dashboard, read-only finance, masked export/report | Canonical read-only role cho B02/B08/B11 |
| SALE | `sale1@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke sales flow, lead/account create | Dung khi can role sale co san tu seed-users |
| SALE | `sale2@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke sales flow, lead/account create | Dung cho batch thu khac neu can |
| SALE | `sale3@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke sales flow, lead/account create | Dung cho batch thu khac neu can |
| TEACHER | `teacher1@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Role smoke theo user code canonic | Dung neu can tai khoan teacher he thong |
| TEACHER | `teacher2@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Role smoke theo user code canonic | Dung neu can tai khoan teacher he thong |
| TEACHER | `teacher3@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Role smoke theo user code canonic | Dung neu can tai khoan teacher he thong |
| TEACHER | `teacher4@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Role smoke theo user code canonic | Dung neu can tai khoan teacher he thong |
| MANAGER | `manager1@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke quan ly, xem dashboard, approve | Dung cho UI role manager |
| MANAGER | `manager2@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke quan ly, xem dashboard, approve | Dung cho UI role manager |
| HCNS | `hcns1@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke HCNS / HR flow | It uu tien hon account demo |
| HCNS | `hcns2@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke HCNS / HR flow | It uu tien hon account demo |
| PARTIME | `partime1@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke part-time access | Chi dung khi batch can role nay |
| PARTIME | `partime2@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke part-time access | Chi dung khi batch can role nay |
| PARTIME | `partime3@example.com` | `seed-users.js` -> `SEED_DEFAULT_PASSWORD` | `123456789` | Smoke part-time access | Chi dung khi batch can role nay |
| DIRECTOR | `admin@tungtran.online` | `ensure-commercial-admin.js` -> `ADMIN_PASSWORD` | `ChangeMe123!` | Commercial admin fallback neu env sync can | Chi dung khi can account production-like |

## Wave 0 goi y su dung

- UI smoke an toan nhat: `director.demo@school.local`, `accounting.demo@school.local`, `ops.demo@school.local`, `teacher.demo@school.local`, `parent.demo@school.local`, `ads.demo@school.local`, `shareholder.demo@school.local`
- API smoke an toan nhat: `admin@local`, `director.demo@school.local`, `accounting.demo@school.local`, `ops.demo@school.local`
- Wave finance: `accounting.demo@school.local`
- Wave role-based UI: `ops.demo@school.local`, `teacher.demo@school.local`, `parent.demo@school.local`
- Wave fallback he thong: `admin@tungtran.online`

## Luu y van hanh

- `seed-all.js` dung mot mat khau chung cho demo users: `DEMO_PASSWORD=Demo123456!`
- `seed-users.js` dung mat khau chung rieng: `SEED_DEFAULT_PASSWORD=123456789`
- `ensure-commercial-admin.js` lay mat khau tu `ADMIN_PASSWORD=ChangeMe123!`
- Neu da seed san, uu tien account demo truoc account fallback de giam rui ro lockout
- Khong can doi mat khau trong wave smoke; chi dung dung account da seed

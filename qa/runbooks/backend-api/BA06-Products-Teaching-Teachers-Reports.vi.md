# Runbook BA06 - Products, Teaching, Teachers, Reports

## Muc tieu batch

Xac nhan cac mien du lieu dai han gom products, teaching reports, materials, exports, teacher management, va student management o lop backend.

## Pham vi checklist

- `Nhom 25`: Quan ly san pham & goi hoc
- `Nhom 26`: Bao cao giang day & tai lieu
- `Nhom 27`: Xuat du lieu & bao cao
- `Nhom 28`: Quan ly giao vien
- `Nhom 29`: Quan ly hoc sinh & theo doi tien do
- `Nhom 30`: Cron/reliability duoc doi soat bang authoritative evidence tu `BA05`; chi mo overlap rerun trong `BA06` neu co dau hieu instability moi

## Boundary thuc thi

- Primary BA06 runner bundle: `group20`, `group21`, `group22`
- Overlap rerun anchors trong executed campaign: `group23`, `group24`
- Luu y:
  - `group23` va `group24` van thuoc BA05 ownership trong planning layer.
  - BA06 chi rerun overlap slice nay de xac nhan cron/backfill stability sau khi chay products, reports, va student flows.

## SOP/playbook bat buoc

- `school-mgmt/docs/teacher/HuongDanGiaoVien_ChiTiet.md`
- `school-mgmt/docs/teacher/KichBanKiemThu_GiaoVien.md`
- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`

## Vai tro can dung

- `DIRECTOR`
- `OPS`
- `ACCOUNTING`
- `SALE`
- `TEACHER`
- `PARENT`

## Tien dieu kien va seed

- Co product active/inactive
- Co teaching report, materials, teacher profile, student profile nen
- Co file hoac dataset xuat bao cao
- Cron/backfill evidence authoritative da co tu `BA05` neu khong co dau hieu instability moi

## Automation anchor bat buoc

`group23` va `group24` khong thuoc BA06 primary bundle; BA06 chi rerun overlap khi can xac minh lai cron/backfill sau khi BA05 da chot evidence.

- `test/group20-products-reports.e2e-spec.ts`
- `test/group21-materials-export.e2e-spec.ts`
- `test/group22-students.e2e-spec.ts`
- `test/group23-cron-notifications-sessions.e2e-spec.ts`
- `test/group24-cron-retry-backfill.e2e-spec.ts`
- `scripts/test-teaching-report-workflow.js`
- `scripts/test-teaching-materials-workflow.js`
- `scripts/test-teacher-profiles-workflow.js`
- `scripts/test-teacher-kpi-workflow.js`
- `scripts/test-employee-performance-workflow.js`
- `scripts/test-student-report-workflow.js`
- `scripts/test-export-reports-workflow.js`

## Kich ban chay thuc te

1. Tao/sua/deactivate product va kiem propagation.
2. Nop teaching report, thao tac materials va kiem anh huong payroll/KPI neu co.
3. Chay export/report va kiem encoding, range, role masking neu co.
4. Cap nhat teacher profile hoac teacher management flow.
5. Chay student/progress flow, sau do overlap rerun `group23/group24` de xac nhan cron/backfill van on dinh sau executed BA06 slice.

## Chuoi doi soat bat buoc

- `Product -> Order/commission/report side effect`
- `Teaching report/material -> Payroll/KPI/teacher view`
- `Export/report -> file output -> role visibility -> data masking`
- `Teacher/student update -> detail -> list -> related report`
- `Cron reliability -> BA05 la primary owner, BA06 chi overlap rerun de xac nhan khong phat sinh instability moi`

## Log va evidence

- Log file: `LOG_BA06_Products_Teaching_Teachers_Reports_YYYYMMDD.md`
- Neu co export, ghi duong dan file dau ra hoac checksum ngan

## Dau hieu FAIL pho bien

- Deactivate product khong chan downstream create
- Teaching report luu duoc nhung payroll/KPI khong doi
- Export dung du lieu nhung sai encoding/masking
- Teacher/student update khong lan dung sang views lien quan

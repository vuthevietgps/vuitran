# Runbook BA03 - Change Requests, Reconciliation, Capital, Concurrency

## Mục tiêu batch

Siết các luồng thay đổi cấu hình, đối soát, vốn/back-office, tương tranh, RBAC, state machine và webhook marketing ở lớp backend.

## Phạm vi checklist

- `Nhóm 8`: Thay đổi cấu hình & vận hành
- `Nhóm 9`: Đối soát & tự động sửa lỗi
- `Nhóm 10`: Dòng vốn & chi phí back-office
- `Nhóm 11`: Tương tranh & cạnh tranh dữ liệu
- `Nhóm 12`: Phân quyền, bảo mật & truy vết

## SOP/playbook bắt buộc

- `school-mgmt/docs/operations/HuongDanSuDung_KichBanVanHanh.md`
- `school-mgmt/docs/project/mota.md`
- `school-mgmt/frontend/src/app/components/internal-handbook.playbooks.ts`

## Vai trò cần dùng

- `DIRECTOR`
- `ACCOUNTING`
- `OPS`
- `SALE`
- `SHAREHOLDER`

## Tiền điều kiện và seed

- Có sẵn dữ liệu bank/fund/reconciliation
- Có ít nhất `1` change request hoặc pending update
- Có user/role để test RBAC dương và âm
- Có dữ liệu đủ để chạy request đồng thời hoặc lặp lại

## Automation anchor bắt buộc

- `test/group8-capital-backoffice.e2e-spec.ts`
- `test/group9-expenses-concurrency.e2e-spec.ts`
- `test/group10-rbac-security.e2e-spec.ts`
- `test/group11-state-machine.e2e-spec.ts`
- `test/group12-marketing-webhooks.e2e-spec.ts`
- `test/security-rbac.e2e-spec.ts`
- `test/data-isolation-rbac.e2e-spec.ts`
- `scripts/test-rbac-finance-guards.js`
- `scripts/test-financial-control-costs.ts`
- `scripts/test-ads-financial-control-recalculation.ts`

## Kịch bản chạy thực tế

1. Submit/approve/reject change request và đối soát pending queue.
2. Chạy reconciliation hoặc auto-heal có lặp lần hai để kiểm idempotency.
3. Chạy flow vốn/back-office và kiểm các side effect tài chính.
4. Gửi request đồng thời trên cùng một bản ghi để xác nhận concurrency guard.
5. Kiểm role bị chặn ở endpoint nhạy cảm và state reversal bị chặn.

## Chuỗi đối soát bắt buộc

- `Change request -> resource detail -> pending approval -> audit log`
- `Reconciliation -> matched/unmatched -> summary -> financial report`
- `Concurrency -> exactly one success -> no duplicate ledger/state`
- `RBAC/State machine -> positive role -> negative role -> audit trail`

## Log và evidence

- Log file: `LOG_BA03_Change_Reconciliation_Capital_Concurrency_YYYYMMDD.md`
- Với case concurrency phải ghi rõ số request song song và kết quả từng request

## Dấu hiệu FAIL phổ biến

- Race condition tạo duplicate ledger hoặc duplicate approve
- Endpoint chặn state ở UI nhưng backend vẫn cho đổi trạng thái
- Role bị chặn ở UI nhưng gọi API trực tiếp vẫn thành công
- Reconciliation đổi số liệu nhưng không cập nhật summary/report liên quan

# Management Situation Upgrade

Tai lieu nay chuan hoa cach mo rong so luong va chat luong tinh huong quan tri cho AI Assistant Core ma van tiet kiem token.

## Nguyen tac thiet ke

- Phan lon nghiep vu quan tri la lap lai: dau ngay, cuoi ngay, chot thang, doi soat, SLA, pipeline, budget, board update.
- Moi routine lap lai nen thanh mot `situation` rieng va uu tien packet/summary/queue da tinh san o backend.
- AI khong nhan full database, full handbook, raw ledger, raw chat hay file lon. Context chi gom tool duoc policy cho phep.
- Neu context thieu bang chung, AI phai noi ro thieu tool/detail/filter nao thay vi tu suy dien.
- Moi thao tac tien, duyet, lich hoc, payroll, message, budget, token/prompt/user phai co preview, confirm va audit.

## Runtime handling

1. Backend biet user la ai va quyen gi tu JWT/role.
2. AI chi ho tro hieu cau hoi thanh intent/situation; khong tu quyet dinh quyen.
3. Backend chon workflow/API/tool duoc phep bang situation router va policy engine.
4. ERP service lay du lieu that tu database/API noi bo theo scope da duoc phep.
5. Context builder chi nap toi da 5 tool, compact list va redact token/secret/password.
6. AI dien giai ket qua da co theo khuon:
   - Ket luan.
   - Bang chung/so lieu/source route.
   - Rui ro/SLA/tien.
   - Viec tiep theo hoac drill-down can goi.
7. Neu user muon ghi du lieu, action planner tao draft; chi execute sau khi user confirm.

Contract quan trong: AI khong goi database truc tiep, khong tu mo quyen, khong tu chon API ngoai catalog, khong thay ERP service tinh toan nghiep vu. AI chi dien giai context that ma backend da chon va da scope.

## New repeatable packets

| Situation key | Role | Muc dich |
| --- | --- | --- |
| `director_daily_control_packet` | Director | Brief dieu hanh dau/cuoi ngay, top risk, queue duyet, finance alert, audit stats. |
| `director_approval_risk_triage` | Director | Sap xep hang cho duyet theo rui ro tien, SLA va audit. |
| `director_admin_security_governance` | Director | Quan tri AI token/profile/prompt, phan quyen va audit ma khong nap secret. |
| `accounting_collections_aging_packet` | Accounting | Cong no, hoa don tre, thu tien va ticket/chung tu can bo sung. |
| `accounting_month_end_close_packet` | Accounting | Chot so cuoi thang, P&L, cashflow, aging va sai lech can doi soat. |
| `accounting_payroll_payout_packet` | Accounting | Payroll cycle, payout, cashflow tra luong va tranh chap luong. |
| `ops_daily_sla_packet` | OPS | Session/ticket/SLA dau ngay va pending approval van hanh. |
| `ops_pending_approval_detail` | OPS | Queue cho duyet chi tiet: invoice, top-up, giao vien, lop va doi lich. |
| `ops_attendance_reconciliation` | OPS | Doi soat diem danh, lop chua diem danh va sai lech attendance/session. |
| `ops_trial_test_control` | OPS | Hoc thu/test, slot giao vien trai nghiem va waiting decision. |
| `ops_work_sessions_control` | OPS | Work sessions, active/late/early leave va tong hop gio lam. |
| `ops_student_teacher_onboarding` | OPS | Hoc sinh pending, giao vien pending, teacher status va onboarding queue. |
| `ops_capacity_teacher_risk_packet` | OPS | Rui ro thieu giao vien, lop qua tai, dieu phoi lop/session. |
| `teacher_daily_teaching_packet` | Teacher | Lich day, buoi sap toi, pending report va viec can chuan bi. |
| `experience_teacher_quality_packet` | Experience Teacher | Queue cham bai/review va rui ro chat luong feedback. |
| `parent_weekly_child_success_packet` | Parent | Lich hoc, tien do, invoice, ticket va viec can ho tro cho con. |
| `student_weekly_execution_packet` | Student | Lich, homework, quiz, hoc lieu va viec can lam trong tuan. |
| `sale_pipeline_recovery_packet` | Sale | Lead den han, lead stale, order ton va trial can chot. |
| `sale_revenue_commitment_packet` | Sale | Doanh thu committed, order cho duyet, hoa hong va rui ro target. |
| `ads_optimization_packet` | Ads Manager | Spend, CPL/CPO, ROI, ad group can can thiep va budget guardrail. |
| `shareholder_board_packet` | Shareholder | Board/investor update aggregate, runway, retention va finance khong PII. |

## Quality rubric

Mot cau tra loi dat yeu cau khi:

- Dung scope role, khong lo PII/secret ngoai quyen.
- Neu so lieu co trong context thi neu source/tool; neu khong co thi noi ro thieu data.
- Khong noi da thuc hien action khi moi la read/preview.
- Sap uu tien theo tac dong: tien, SLA, khach hang/hoc vien, audit/security.
- Dua ra next action cu the: drill-down entity, tao draft, mo man hinh, hay can them filter.

## Backlog tiep theo

- Tao packet service that cho cac routine lon: director executive, accounting reconciliation, ops SLA, teacher today, sale recovery, ads optimization, shareholder board.
- Mo rong action draft cho invoice/wallet/payroll/session/attendance/message/ads budget.
- Them eval chat runtime: question -> expected situation -> expected tools -> safety/answer rubric.

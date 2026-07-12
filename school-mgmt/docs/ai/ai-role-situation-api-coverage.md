# AI Role Situation API Coverage

Tai lieu nay la ma tran tinh huong theo tung user type/assistant type, map voi ERP API/tool hien co va danh gia API da du hay chua.

Legend:

- `OK`: AI core da co situation/tool/API du cho read flow chinh.
- `PARTIAL`: ERP API co, nhung AI tool, situation, action draft hoac drill-down chua du.
- `MISSING`: thieu ERP API/tool ro rang de AI xu ly an toan.

## Sub-agent ownership

Moi nhom user nen co sub-agent rieng khi nang cap:

| User type | Assistant type | Sub-agent ownership |
| --- | --- | --- |
| Director | `DIRECTOR_OPERATIONS` | Executive, approval, finance summary, audit, growth, ads risk |
| Accounting | `ACCOUNTING_OPERATIONS` | Invoice, wallet, payroll, expense, loan, bank/fund reconciliation |
| OPS | `OPS_OPERATIONS` | Classes, sessions, attendance, tickets, trial/test, teacher/student ops |
| Teacher | `TEACHER_SUPPORT` | Schedule, teaching report, attendance link, materials, payroll self-view, tickets/messages |
| Experience Teacher | `EXPERIENCE_TEACHER_SUPPORT` | Homework grading, quiz/material review, rubric, quality feedback |
| Parent | `PARENT_SUPPORT` | Child schedule/progress, invoices, wallet, support tickets |
| Student | `STUDENT_SUPPORT` | Learning snapshot, homework, quiz, materials, next study plan |
| Sale | `SALE_OPERATIONS` | Lead follow-up, lead/order pipeline, trial/test, commission, conversations |
| Ads Manager | `ADS_OPERATIONS` | Ads analytics, actions required, ad group detail, sync/token/budget guardrails |
| Shareholder | `SHAREHOLDER_INSIGHTS` | Investor metrics, aggregate finance, retention, runway, read-only reporting |

## Director

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Daily operating brief | `daily_tasks`, `GET /dashboard/daily-tasks` | OK | Chua co action truc tiep tu task, hien chi dieu huong/de xuat. |
| Executive overview | `director_dashboard`, `pending_approvals_summary`, `financial_alerts`, `audit_stats` | OK | Co the them packet `GET /dashboard/director/comprehensive` lam one-call brief. |
| Approval/audit control | `pending_approvals_summary`, `pending_approval_*`, `audit_stats` | PARTIAL | Da co detail tools doc queue chinh; action approve/reject co preview van chua mo rong. |
| Finance risk | `financial_overview`, `financial_alerts`, `profit_and_loss`, `cash_flow`, `aging_report` | PARTIAL | Chua expose bank/fund/reconciliation/balance-sheet/tax cho AI core Director. |
| Ops bottleneck | `ops_dashboard`, `ops_sessions`, `ops_classes`, `ops_open_tickets`, detail tools | PARTIAL | Generic AI core co tool; Director AI rieng chua tu drill-down read-only theo entity. |
| Sales/growth/retention | `sales_dashboard`, `retention`, `forecast` | PARTIAL | Chua co lead/order/trial drill-down list rieng cho Director. |
| Ads risk | `ads_analytics_overview`, `ads_actions_required`, `ad_group_detail` | PARTIAL | Chua co action draft doi budget/status/sync; chi read/de xuat. |
| Entity drill-down | `invoice_detail`, `order_detail`, `lead_detail`, `class_detail`, `session_detail`, `ticket_detail`, `ad_group_detail` | PARTIAL | AI core co detail tools, Director AI dedicated flow chua dung day du. |

## Accounting

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Accounting guide | `accounting_guide`, `system_guide` | OK | Da khai bao tool guide de policy/router co the chon. |
| Daily accounting queue | `daily_tasks`, `accounting_dashboard` | PARTIAL | Daily tasks chua gom expense pending, loan due/overdue, bank reconciliation. |
| Finance risk summary | `financial_overview`, `financial_alerts`, `profit_and_loss`, `cash_flow`, `aging_report` | OK | Read summary du; drill-down chi tiet can them tools rieng. |
| Invoice/wallet reconciliation | `accounting_dashboard`, `accounting_pending_invoices`, `accounting_invoices`, `invoice_detail` | PARTIAL | Thieu tools top-up pending, wallet detail, ledger filter, invoice management filter. |
| Invoice approval/payment | ERP: `POST /invoices/:id/approve`, `/cancel`, `/payments/.../confirm`, receipt upload | PARTIAL | Chua co AI action approve/reject/cancel/confirm invoice co preview va ly do. |
| Wallet top-up/adjust/transfer | ERP: `/wallets/top-up/*`, `/adjust`, `/transfer`, `/verify-balances` | PARTIAL | Can high-risk action preview amount, before/after balance, reason, ledger ref. |
| Payroll teacher cycle | ERP: `/payroll`, `/summary`, `/teacher-preview`, `/:id/items`, submit/mark-paid | PARTIAL | Thieu AI payroll list/detail/preview tools va action generate/submit/mark-paid. |
| Payroll transaction disputes | `PayrollTransactionService` co held/release/exclude, chua co controller | MISSING | Can expose API/tool read held/pending va action xu ly hold. |
| Expense/OPEX control | ERP: `/expenses`, stats, approve/reject/mark-paid/process recurring | PARTIAL | Chua co AI tool `accounting_expenses` va action expense workflow. |
| Loans/debt control | ERP: `/loans`, `/summary`, payments list/record/update-overdue | PARTIAL | Can loan summary/payment due tools va action record payment. |
| Bank/fund reconciliation | ERP: `/financial-control/bank-*`, `/fund-*`, `/bank-reconciliation`, `/reconciliation` | PARTIAL | Can AI tools bank/fund transaction/reconciliation va action reconcile. |
| Tax/balance reporting | ERP: `/balance-sheet`, `/tax-report`, `/provisional-gross-profit` | PARTIAL | Can read tools va response guidance ve basis/source. |

## OPS

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| OPS daily queue | `daily_tasks`, `ops_dashboard`, `ops_guide` | OK | Chua auto drill-down theo tung task. |
| Class/session bottleneck | `ops_dashboard`, `ops_classes`, `ops_sessions`, `class_detail`, `session_detail` | PARTIAL | Read du kha, write action doi/huy/finalize/no-show chua co draft executor. |
| Ticket SLA triage | `ops_open_tickets`, `ops_assigned_tickets`, `ticket_detail` | PARTIAL | Thieu action start/request-info/resolve/close/reopen/refund/substitute. |
| Teacher matching | `ops_teacher_suggestions`, `ops_teachers`, `ops_teacher_stats`, ERP `GET /classes/suggest-teachers`, `GET /teachers` | OK | Read flow du cho goi y/list/stats; assign/doi giao vien van can action draft. |
| Attendance reconcile | `ops_attendance_report`, `ops_attendance_classes`, ERP `/attendance/report`, `/report/classes` | OK | Read flow du cho report/list lop; mark/update/generate-link van can action draft. |
| Student intake | `ops_pending_students`, `student_detail`, ERP `/students/pending` | OK | Read queue/detail du; approve/reject action chua co preview executor rieng. |
| Teacher onboarding | `pending_approval_teachers`, `ops_teachers`, `ops_teacher_stats`, ERP `/teachers`, `/teachers/stats` | OK | Read queue/list/stats du; approve/activate/suspend action chua co preview executor. |
| Trial/test ops | `ops_trial_summary`, `ops_trial_enrollments`, `ops_trial_available_slots`, ERP `/trial-enrollments`, summary, slots | OK | Read flow du cho dieu phoi; schedule/convert/reject/teacher-paid-only van can action draft. |
| Pending approvals detail | `pending_approval_invoices`, `pending_approval_topups`, `pending_approval_teachers`, `pending_approval_classes`, `pending_approval_session_changes` | OK | Session changes hien goi service noi bo `AI_INTERNAL`; neu frontend can route rieng nen them controller endpoint. |
| Work sessions | `ops_work_sessions_summary`, `ops_work_sessions`, ERP `/work-sessions`, `/summary` | OK | Read summary/list du; patch notes/timesheet chua co AI action draft. |

## Teacher

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Daily brief | `daily_tasks`, `teacher_dashboard` | OK | Nen them unread messages va attendance exceptions. |
| Schedule/sessions | `teacher_upcoming_sessions`, `teacher_my_sessions`, `session_detail` | OK | Them change-request history khi hoi doi lich. |
| Pending report queue | `teacher_pending_reports`, `teacher_dashboard` | OK | Nen auto add `session_detail` khi user chi ro buoi. |
| Report history | `teacher_completed_reports`, ERP `/reports/teaching` | OK | Neu can noi dung day du, them tool report detail. |
| Session workflow | ERP complete/cancel/no-show | PARTIAL | Can action `COMPLETE_SESSION`, `CANCEL_SESSION`, `MARK_NO_SHOW`. |
| Attendance support | ERP attendance teacher/classes/class/student/stats/report | PARTIAL | Can read tools attendance by teacher/class/stat. |
| Attendance link | ERP `POST /attendance/generate-link` | PARTIAL | Can action generate link co preview/confirm. |
| Teaching report draft submit | ERP teaching-report/bulk/inline update | PARTIAL | Can action submit/update report co preview diff. |
| Materials search | ERP `/teaching-materials`, stats, detail, download | PARTIAL | Can tools material search/detail/download context. |
| Material content QA | Teaching material chunks/schema co san | MISSING | Can API/tool search chunks theo material/query. |
| Homework assign | Report DTO co homework material/quiz ids | PARTIAL | Can ket noi material search vao draft report. |
| Payroll self audit | ERP `/payroll/my-payroll`, teacher-preview, items | PARTIAL | Can own-record payroll tools. |
| Ticket/message support | ERP tickets/messages | PARTIAL | Can teacher tickets/conversations/unread tools va send-message action. |

## Experience Teacher

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Daily review packet | `experience_teacher_daily_review_packet` | OK | Nap daily tasks, homework queue, quiz queue va material metadata. |
| Homework grading queue | `homework_grading_queue`, `quiz_grading_queue`, `teacher_guide` | OK | Read queue du cho brief, khong nap file lon. |
| Grade/review homework | `GRADE_HOMEWORK` action draft + ERP homework-grade | OK | Bat buoc preview, feedback va confirm truoc khi ghi diem. |
| Quiz/material review | `quiz_grading_queue`, `quiz_attempt_detail`, `teaching_materials_search`, `teaching_material_detail` | OK | Quiz attempt/material detail co scope theo role. |
| Content QA/rubric | `teaching_material_chunks_search` | OK | Chunk search gioi han theo hoc lieu scoped; neu chua READY thi AI phai noi thieu context. |

## Parent

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Parent guide | `parent_guide`, `system_guide` | OK | Da khai bao tool guide. |
| Child learning/finance summary | `parent_success_packet`, `parent_dashboard`, `student_learning_snapshot`, `parent_wallet_summary` | OK | Packet gom lich, tien do, bai tap, diem danh, hoa don, vi va ticket. |
| Parent weekly action packet | `parent_success_packet`, `student_learning_snapshot`, `parent_wallet_ledger`, `parent_my_tickets` | OK | Co priorityActions deterministic cho homework, finance, attendance, support va confirmation. |
| Parent ticket support | `parent_my_tickets`, `parent_success_packet`, `parent_my_sessions`, `parent_wallet_ledger`, `ticket_detail` | OK | Create/comment ticket di qua action draft/confirm; context co session/wallet/ticket scoped. |
| Wallet detail | `parent_wallet_summary`, `parent_wallet_ledger`, `parent_invoices` | OK | Parent chi own wallet/ledger; khong nap receipt/proof/file vao prompt. |
| Attendance risk | `parent_attendance_summary`, `parent_success_packet`, `parent_my_sessions` | OK | Co stats vang/muon/co mat va recent records theo con. |
| Homework/material visibility | `student_learning_snapshot`, `parent_success_packet`, `parent_children_progress` | OK | Snapshot co pending homework, comments, curriculum progress va teaching materials compact. |

## Student

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Student guide | `student_guide`, `system_guide` | OK | Da khai bao tool guide. |
| Learning snapshot/next plan | `student_learning_snapshot` | OK | Du cho summary neu student profile linked. |
| Homework/quiz/material detail | ERP quiz/material/session APIs | PARTIAL | Can tools student assignments, quiz attempts, material detail. |
| Submit quiz/homework | ERP submit routes exist in modules | PARTIAL | Can action submit with confirmation and attempt validation. |

## Sale / Lead Care

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Sale guide | `sale_guide`, `system_guide` | OK | Da co. |
| Sale next best actions | `sale_next_best_actions`, `sale_conversations`, `sale_followups_due`, `sale_trial_summary`, `sale_commission_report` | OK | Da co scoring/rank/evidence cho lead, stale, order, trial, conversation; can tiep tuc tinh xac suat chot neu ERP co feature/probability. |
| Daily follow-ups | `sale_followups_due`, `sale_lead_pipeline`, `sales_dashboard` | OK | Read queue du; write follow-up needs action. |
| Lead pipeline review | `sale_lead_pipeline`, `sale_my_leads`, `lead_detail` | OK | Can better stale/priority scoring from ERP packet. |
| Order pipeline review | `sale_order_pipeline`, `sale_my_orders`, `order_detail` | OK | Write order submit/approve remains outside Sale unless policy allows. |
| Trial/test follow-up | `sale_trial_summary`, `sale_trial_enrollments` | OK | Schedule/convert/reject needs action draft. |
| Commission personal | `sale_commission_report`, `sales_dashboard` | OK | Dispute should create ticket, not adjust directly. |
| Conversation reply | `sale_conversations`, ERP chatbot/messages/conversations | PARTIAL | AI core da doc conversation assigned cho sale; can them message detail tool va send-message action with preview. |

## Ads Manager

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Ads guide | `ads_guide`, `system_guide` | OK | Da khai bao tool guide. |
| Ads performance review | `ads_analytics_overview`, `ads_actions_required`, `ad_group_detail` | OK | Read flow du cho summary/actions. |
| Suggestions/detail | ERP `/ads/suggestions`, groups/accounts/costs/profit/cohort | PARTIAL | Can more tools: ads suggestions, costs, account/group list, profit/cohort. |
| Sync/token/budget actions | ERP token/sync/cost/group write APIs | PARTIAL | High-risk actions need preview/approval; never expose decrypted token. |

## Shareholder

| Situation | AI tools / ERP API | Coverage | Gap |
| --- | --- | --- | --- |
| Shareholder guide | `shareholder_guide`, `system_guide` | OK | Da khai bao tool guide. |
| Investor brief | `shareholder_investor_metrics`, `financial_overview`, `profit_and_loss`, `retention` | OK | Read aggregate du. |
| Ads/investor marketing metrics | `ad_group_detail`, ads aggregate APIs | PARTIAL | Need shareholder-safe ads aggregate tools without PII/detail. |
| Export/report pack | ERP export APIs | PARTIAL | Need export preview for investor pack; shareholder read-only. |

## Management packet upgrade

Cac packet sau da duoc bo sung vao `backend/src/ai-core/catalogs/situation.catalog.ts` de tang do phu cac routine quan tri lap lai ma khong tang context qua lon. Moi packet chi dung tool da whitelist va duoc `context-builder` cat gon truoc khi dua vao prompt.

| Packet | Role | AI handling | Token policy |
| --- | --- | --- | --- |
| `director_daily_control_packet` | Director | Brief dau/cuoi ngay, top risk, queue duyet, finance alert, audit stats | 5 tool aggregate/summary, khong raw list |
| `director_approval_risk_triage` | Director | Sap approval theo tien/SLA/audit truoc khi duyet | Summary + alert; detail record can drill-down |
| `director_admin_security_governance` | Director | Quan tri AI token/profile/prompt, role va audit | Khong nap secret/prompt raw |
| `accounting_collections_aging_packet` | Accounting | Cong no, hoa don tre, thu tien, chung tu/ticket | Aging + limited invoice/ticket list |
| `accounting_month_end_close_packet` | Accounting | Chot so cuoi thang, P&L, cashflow, aging | Aggregate theo ky, no raw ledger |
| `accounting_payroll_payout_packet` | Accounting | Payroll/payout/cashflow/tranh chap luong | Summary payroll tu dashboard; payroll detail la gap |
| `ops_daily_sla_packet` | OPS | Session/ticket/SLA dau ngay | Queue limited, detail theo entity khi can |
| `ops_pending_approval_detail` | OPS | Hang cho duyet lien quan invoice/top-up/giao vien/lop/doi lich | 5 queue detail da limit, khong execute approve/reject |
| `ops_attendance_reconciliation` | OPS | Doi soat diem danh, lop chua diem danh, sai lech attendance/session | Mac dinh hom nay, report/list lop limited |
| `ops_trial_test_control` | OPS | Hoc thu/test, slot giao vien trai nghiem, waiting decision | Summary truoc, list/slot limited |
| `ops_work_sessions_control` | OPS | Phien lam viec, active/di muon/ve som, tong hop gio lam | Summary/list limited, khong chot payroll |
| `ops_student_teacher_onboarding` | OPS | Hoc sinh pending, giao vien pending, teacher status | Queue/status/list compact |
| `ops_capacity_teacher_risk_packet` | OPS | Rui ro giao vien/lop/session qua tai | Class/session list limit, teacher suggestion/stats da co |
| `teacher_daily_teaching_packet` | Teacher | Lich day, pending report, viec can chuan bi | Own records only |
| `experience_teacher_quality_packet` | Experience Teacher | Queue cham bai/review, chat luong feedback | Khong nap attachment/file lon |
| `parent_weekly_child_success_packet` | Parent | Lich/tien do/invoice/ticket cua con | Own children only |
| `student_weekly_execution_packet` | Student | Lich/homework/quiz/hoc lieu trong tuan | Learning-only, khong finance |
| `sale_next_best_actions_packet` | Sale | Viec sale can lam tiep theo theo score/rank: follow-up, stale lead, order ton, trial waiting decision, conversation assigned | Summary + rank/evidence, no write execute |
| `sale_pipeline_recovery_packet` | Sale | Lead due/stale, order ton, trial can chot | Summary truoc, lead list limited |
| `sale_revenue_commitment_packet` | Sale | Revenue committed, order/commission/target | Khong sua amount/commission |
| `ads_optimization_packet` | Ads Manager | CPL/CPO/ROI, ad group can can thiep, budget guardrail | Khong nap token/raw cost import |
| `shareholder_board_packet` | Shareholder | Board/investor update aggregate | No PII, no audit/user/chat detail |

Quality rule chung: AI tra loi theo `ket luan -> bang chung/source -> rui ro/SLA/tien -> viec tiep theo`. Neu packet thieu data, AI phai noi ro can tool/detail/filter nao thay vi tu suy dien.

## Cross-role gaps to prioritize

1. Write action draft is too narrow: currently covers student/class/lead/ticket basics; missing finance, approvals, sessions, attendance, payroll, ads, messages.
2. Read tools exist for many dashboards, but some deterministic queues should be one-call ERP packets:
   - Director daily executive packet.
   - Accounting reconciliation packet.
   - OPS SLA/session packet.
   - Teacher today packet.
   - Parent child snapshot packet.
   - Ads optimization packet.
   - Shareholder investor packet.
3. Static guides should stay role-scoped. Do not send all docs/handbooks to AI API.
4. Any list tool must have date range, status/search filters and limit.
5. Any money/approval/schedule/message/budget write action must require preview, explicit confirm and audit.

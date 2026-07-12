# Director AI ERP API Catalog

Tai lieu nay mo ta cac ERP API/tool duoc chatbot giam doc phep doc de tra loi va ho tro dieu hanh. Nguyen tac chinh: AI khong doc database tho, khong nap toan bo database, va khong tu thuc hien thao tac ghi khi chua co xac nhan/approval rieng.

## Runtime tools dang bat

| Tool | ERP API | Y nghia nghiep vu | Pham vi | Risk | Ghi chu context |
| --- | --- | --- | --- | --- | --- |
| `daily_tasks` | `GET /dashboard/daily-tasks?role=DIRECTOR` | Viec can xu ly trong ngay | Theo JWT/director | LOW | Luon nap truoc, service tu gioi han danh sach |
| `pending_approvals_summary` | `GET /pending-approvals/summary` | Tong backlog phe duyet | Toan he thong, summary | LOW | Chi lay count, khong lay danh sach chi tiet |
| `director_dashboard` | `GET /dashboard/director` | Suc khoe tong quan doanh nghiep | Aggregate theo ngay | LOW | Mac dinh thang hien tai |
| `accounting_dashboard` | `GET /dashboard/accounting` | Vi, ledger, payroll, top-up | Aggregate va recent list | MEDIUM | Dung cho tai chinh/ke toan |
| `ops_dashboard` | `GET /dashboard/ops` | Lop, session, ticket, giao vien | Aggregate van hanh | LOW | Dung cho diem nghen OPS |
| `financial_overview` | `GET /financial-control/overview` | Tong quan tai chinh | Aggregate | MEDIUM | Mac dinh thang hien tai |
| `financial_alerts` | `GET /financial-control/alerts` | Canh bao tai chinh | Alert da tinh san | MEDIUM | Uu tien khi hoi rui ro |
| `profit_and_loss` | `GET /financial-control/profit-and-loss` | Lai lo | Aggregate theo ngay | MEDIUM | Khong ket luan nguyen nhan neu thieu bang chung |
| `revenue_report` | `GET /dashboard/director/revenue` | Doanh thu theo ky | Aggregate | LOW | Dung cho xu huong doanh thu |
| `sales_dashboard` | `GET /dashboard/sales` | Lead, order, pipeline | Aggregate sales | LOW | Khong lay raw lead/order neu chua drill-down |
| `aging_report` | `GET /financial-control/aging-report` | Cong no, tuoi no | Aggregate/limited list | MEDIUM | Dung khi hoi cong no/phai thu/phai tra |
| `cash_flow` | `GET /financial-control/cash-flow` | Tien vao/tien ra | Group theo tuan | MEDIUM | Group by week de giam context |
| `ads_actions_required` | `GET /ads/actions-required` | Quang cao can can thiep | Suggestion da tinh san | MEDIUM | Moi thay doi ngan sach phai xac nhan |
| `audit_stats` | `GET /audit-log/stats` | Ky luat thao tac he thong | Stats hom nay/7 ngay | LOW | Chi stats, khong lay log chi tiet |
| `teacher_kpi` | `GET /dashboard/director/teacher-kpi` | KPI giao vien | Aggregate | LOW | Can than khi ket luan ca nhan |
| `employee_performance` | `GET /dashboard/director/employee-performance` | Hieu suat nhan su | Aggregate | LOW | Dung cho coaching/quan tri nhan su |
| `retention` | `GET /dashboard/director/retention` | Duy tri hoc vien/churn | Aggregate | LOW | Nen ket hop OPS/Sales khi can |
| `forecast` | `GET /dashboard/director/forecast` | Du bao doanh thu | Forecast | LOW | Phai noi ro la du bao |
| `director_guide` | Static backend context | Huong dan su dung he thong | Khong doc DB | LOW | Dung khi hoi "vao dau", "cach dung" |

## Candidate API cho giai doan drill-down

Nhung API duoi day chua duoc chatbot tu goi tu do. Khi can mo sau nay, nen them vao catalog voi limit, date range, role check, audit va confirmation.

| Module | API | Y nghia | Quyen de xuat |
| --- | --- | --- | --- |
| Leads | `GET /leads`, `GET /leads/pipeline`, `GET /leads/stats`, `GET /leads/follow-ups` | Doc pipeline, lead ton, follow-up | READ drill-down, limit 20-50 |
| Orders | `GET /orders`, `GET /orders/pipeline`, `GET /orders/stats`, `GET /orders/commission-report` | Doc don hang, pipeline, hoa hong | READ drill-down |
| Orders | `POST /orders/:id/approve`, `POST /orders/:id/reject`, `POST /orders/:id/request-info` | Duyet/tu choi/yeu cau bo sung order | WRITE, bat buoc confirm + audit |
| Sessions | `GET /sessions`, `GET /sessions/stats`, `GET /sessions/pending-report` | Doc buoi hoc, backlog bao cao | READ drill-down |
| Sessions | `POST /sessions/:id/finalize`, `POST /sessions/:id/cancel`, `POST /sessions/:id/reschedule` | Chot/huy/doi lich buoi hoc | WRITE, bat buoc confirm + audit |
| Tickets | `GET /tickets`, `GET /tickets/stats`, `GET /tickets/sla-metrics` | Doc su co, SLA, ticket qua han | READ drill-down |
| Tickets | `POST /tickets/:id/resolve`, `POST /tickets/:id/close`, `POST /tickets/:id/reopen` | Xu ly vong doi ticket | WRITE, bat buoc confirm + audit |
| Invoices | `GET /invoices`, `GET /invoices/management`, `GET /invoices/pending` | Doc hoa don, cong no, pending | READ drill-down |
| Invoices | `POST /invoices/:id/approve`, `POST /invoices/:id/cancel` | Duyet/huy hoa don | WRITE, bat buoc confirm + audit |
| Wallets | `GET /wallets/stats/financial`, `GET /wallets/ledger`, `GET /wallets/top-up/pending` | Vi, ledger, top-up | READ drill-down |
| Wallets | `POST /wallets/top-up/:id/approve`, `POST /wallets/top-up/:id/reject`, `POST /wallets/adjust`, `POST /wallets/transfer` | Duyet nap tien, dieu chinh, chuyen tien | WRITE, bat buoc confirm + audit |
| Reports | `GET /reports/teaching` | Bao cao day hoc | READ drill-down |
| Audit | `GET /audit-log` | Truy vet thao tac chi tiet | READ sensitive, bat buoc filter |
| Notifications | `POST /notifications/bulk-preview`, `POST /notifications/bulk-send` | Gui thong bao | WRITE, bat buoc preview + confirm |

## Quy tac chon context

1. Luon nap `daily_tasks` truoc de biet viec uu tien cua giam doc.
2. Neu nguoi dung khong chi dinh ngay, dung tu dau thang hien tai den hom nay.
3. Chi nap toi da 4 data contexts moi luot chat, ngoai tru `daily_tasks` va `director_guide`.
4. Chon context bang mode va keyword trong catalog. Vi du:
   - "cong no", "qua han", "phai thu" -> `aging_report`
   - "dong tien", "cashflow", "tien vao/tien ra" -> `cash_flow`
   - "quang cao", "ngan sach", "campaign" -> `ads_actions_required`
   - "audit", "nhat ky", "ai lam" -> `audit_stats`
5. Khi context bi cat gon, AI phai noi ro can goi drill-down nao neu cau hoi can chi tiet tung ban ghi.
6. Khong bao gio dua raw database hoac danh sach khong limit vao prompt.

## Quy tac lenh dieu hanh

Trong giai doan hien tai chatbot chi co READ tools. Moi lenh ghi chi duoc tra loi theo dang:

1. Tom tat du lieu dang co.
2. De xuat hanh dong.
3. Neu thieu du lieu, noi ro can mo API/tool nao.
4. Yeu cau giam doc xac nhan truoc khi tao lenh ghi.
5. Sau khi co chuc nang write-action rieng, moi lenh ghi phai co audit log, idempotency key va trang thai pending/confirmed.

## Huong dan mo rong catalog

Khi them tool moi cho Director AI:

1. Them key vao `DirectorAiToolKey`.
2. Them metadata day du trong `DIRECTOR_AI_TOOL_CATALOG`.
3. Neu tool duoc goi runtime, them case vao `DirectorAiService.runContextTool`.
4. Them keyword ro rang, khong qua rong.
5. Dinh nghia risk level va `requiresConfirmation`.
6. Neu API co danh sach, phai co limit va date range.
7. Build backend/frontend sau khi sua.

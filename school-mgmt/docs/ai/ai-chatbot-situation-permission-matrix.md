# AI Chatbot Situation And Permission Matrix

Tai lieu nay la ban chuan de thiet ke cac chatbot AI API trong ERP. Muc tieu la liet ke tinh huong nguoi dung co the hoi/ra lenh, cach AI chon ERP API, va chatbot nao duoc phep doc/ghi du lieu.

Backend da co catalog may doc duoc tai:

- Source: `school-mgmt/backend/src/chatbot/ai-assistant-permission-catalog.ts`
- API quan tri: `GET /chatbot/ai-permission-catalog` (chi `DIRECTOR`)

## Nguyen tac bat buoc

1. AI API khong goi database truc tiep.
2. AI API chi goi ERP API/tool co trong catalog.
3. Moi chat chi nap context can thiet: summary truoc, drill-down sau.
4. Mac dinh list API phai co date range, status filter, search hoac limit.
5. Chatbot theo role nao thi chi duoc goi API trong role/scope do.
6. Moi thao tac ghi tien, duyet, tu choi, xoa, gui thong bao hang loat, doi lich, chot luong, chot hoa don phai co preview + xac nhan + audit.
7. AI phai noi ro "thieu du lieu" neu context chua du de ket luan.

## Cac chatbot can cau hinh

| Chatbot | Assistant type | Role chinh | Pham vi du lieu |
| --- | --- | --- | --- |
| Giam doc | `DIRECTOR_OPERATIONS` | `DIRECTOR` | Toan he thong, uu tien aggregate va drill-down co gioi han |
| Ke toan | `ACCOUNTING_OPERATIONS` | `ACCOUNTING` | Hoa don, vi, ledger, payroll, cong no, P&L, export tai chinh |
| Van hanh | `OPS_OPERATIONS` | `OPS` | Lop, session, hoc sinh, giao vien, ticket, pending operations |
| Giao vien | `TEACHER_SUPPORT` | `TEACHER` | Lich day, lop, bao cao, bai tap, ticket cua giao vien dang nhap |
| Giao vien review | `EXPERIENCE_TEACHER_SUPPORT` | `EXPERIENCE_TEACHER` | Bai tap, quiz, hoc lieu, queue review duoc giao |
| Phu huynh | `PARENT_SUPPORT` | `PARENT` | Con cua minh, lich hoc, hoa don, vi, ticket cua minh |
| Hoc sinh | `STUDENT_SUPPORT` | `STUDENT` | Lich hoc, bai tap, quiz, hoc lieu cua hoc sinh dang nhap |
| Sales | `SALE_OPERATIONS` | `SALE` | Lead/order/conversation/session trong scope sale |
| Ads | `ADS_OPERATIONS` | `ADSMANAGER` | Ads account, ad group, cost, analytics, suggestions |
| Co dong | `SHAREHOLDER_INSIGHTS` | `SHAREHOLDER` | Bao cao aggregate, khong PII chi tiet neu khong can |
| Ho tro noi bo | `INTERNAL_SUPPORT` | Internal roles | Huong dan va tra cuu theo role dang dang nhap |
| Cham soc lead | `LEAD_CARE` | `SALE/OPS/DIRECTOR` | Conversation, lead, product/order trong pipeline cham soc |

## Ma tran tinh huong

| Tinh huong | ERP API/tool | Chatbot duoc dung | Scope | Ghi/duyet |
| --- | --- | --- | --- | --- |
| Hoi viec can lam hom nay | `GET /dashboard/daily-tasks` | Tat ca chatbot noi bo, giao vien, phu huynh, sales, ads | Theo role/user | Khong ghi |
| Tong quan doanh nghiep | `GET /dashboard/director`, `GET /pending-approvals/summary`, `GET /financial-control/alerts` | Giam doc | Global aggregate | Khong ghi |
| Rui ro tai chinh | `GET /financial-control/overview`, `/alerts`, `/profit-and-loss`, `/cash-flow`, `/aging-report` | Giam doc, Ke toan, Co dong aggregate | Theo role; co dong chi aggregate | Khong ghi |
| Hoa don/cong no | `GET /invoices`, `/management`, `/pending`, `/my-children`, `/invoices/:id` | Giam doc, Ke toan, OPS, Sales, Phu huynh | Parent chi con minh | Khong ghi |
| Duyet/huy hoa don | `POST /invoices/:id/approve`, `/cancel`, payment confirm | Giam doc, Ke toan | Theo role | Bat buoc preview + confirm + audit |
| Vi/ledger/top-up | `GET /wallets`, `/wallets/me`, `/ledger`, `/top-up/pending`, `/stats/financial` | Giam doc, Ke toan, OPS, Phu huynh | Parent chi vi minh | Khong ghi |
| Duyet nap tien/chuyen tien/dieu chinh vi | `POST /wallets/top-up/:id/approve`, `/reject`, `/adjust`, `/transfer`, `/freeze` | Giam doc, Ke toan | Theo role | Critical: confirm 2 buoc + audit |
| Payroll/luong | `GET /payroll`, payroll workflow, `GET/PATCH /salary-config` | Giam doc, Ke toan, OPS, Giao vien view own | Teacher chi cua minh | Ghi/duyet luong can confirm + audit |
| Lich hoc/session | `GET /sessions`, `/stats`, `/my-sessions`, `/my-children`, `/homework-grading`, `/:id` | Giam doc, Ke toan, OPS, Giao vien, Review, Phu huynh, Sales, Co dong aggregate | Theo role/owner | Khong ghi |
| Tao/chot/huy/doi lich/no-show session | `POST /sessions`, `/bulk`, `/:id/complete`, `/:id/confirm`, `/:id/finalize`, `/:id/cancel`, `/:id/reschedule`, `/:id/no-show` | Theo role ERP: Giam doc, Ke toan, OPS, Giao vien, Phu huynh | Theo role/owner | Confirm + ly do + audit |
| Bao cao day va bai tap | `PATCH /sessions/:id/teaching-report`, `/bulk-teaching-report`, `/homework-submit`, `/homework-grade`, `/homework-review`, `GET /reports/teaching` | Giam doc, OPS, Giao vien, Review, Phu huynh | Theo role/owner | AI chi soan/nhap, nguoi dung xac nhan nop/cham |
| Diem danh | `GET/POST/PATCH /attendance/*` | Giam doc, OPS, Giao vien, Phu huynh view own children | Theo role/owner | Sua diem danh can confirm/audit |
| Lop/hoc sinh/giao vien | `GET/POST/PATCH /classes`, `/students`, `/teachers`, `/teacher-registrations` | Giam doc, OPS, Ke toan, Sales, Giao vien, Phu huynh theo scope | Theo role/owner | Tao/sua/phe duyet can confirm |
| Lead pipeline | `GET /leads`, `/pipeline`, `/stats`, `/follow-ups`, `/pool/list`, chatbot conversations | Giam doc, OPS, Sales, Lead care | Sales theo scope | Khong ghi |
| Lead/order action | `POST/PATCH /leads`, `/contact`, `/convert`, `/lost`, `/assign`, `POST /orders`, order approve/reject | Giam doc, OPS, Sales, Lead care | Theo role | Confirm payload + audit |
| Hoc thu/san pham | `GET/POST/PATCH /trial-enrollments`, `GET/POST/PATCH /products` | Giam doc, OPS, Sales, Review teacher, Lead care | Theo role | Thay doi gia/goi hoc can confirm |
| Ticket/support | `GET/POST/PATCH /tickets`, comments, start/request-info/resolve/close/reopen | Giam doc, OPS, Ke toan, Giao vien, Phu huynh, Internal | Parent/teacher chi ticket cua minh | Resolve/refund/close can confirm |
| Ads analytics | `GET /ads/analytics`, `/actions-required`, `/suggestions`, account/ad-group read | Giam doc, Ads, OPS, Sales, Co dong aggregate | Theo role | Khong ghi |
| Ads config/sync | Ads account/token/sync/cost write APIs | Giam doc, Ads | Theo role | Token/sync/budget can confirm + audit |
| Hoi thoai/chatbot lead | `GET /chatbot/conversations`, messages, takeover/release, send, create lead/order | Giam doc, OPS, Sales, Ads, Lead care, Phu huynh message | Theo role/conversation | Gui tin/tao lead/order can preview + confirm |
| Hoc lieu/quiz | `GET/POST/PATCH /teaching-materials`, `GET/POST /quizzes`, attempts/grade | Giam doc, OPS, Giao vien, Review, Phu huynh, Hoc sinh | Theo role/visibility | Publish/cham diem can confirm |
| Thong bao/export | `GET /notifications`, `/bulk-preview`, `/bulk-send`, `GET /export/*` | Giam doc, Ke toan, OPS, Sales, Phu huynh, Giao vien, Co dong | Theo role | Bulk send/export can preview + confirm |
| AI API/chatbot management | `GET/POST/PATCH /chatbot/openai-tokens`, `/ai-assistant-profiles`, `/ai-permission-catalog` | Giam doc | Global | Critical: khong dua secret vao prompt |
| Audit/user/security | `GET /audit-log`, `/stats`, `GET/POST/PATCH/DELETE /users` | Giam doc | Global | Quan tri user can confirm + audit |
| Vay/NCC/chi phi | `GET/POST /loans`, `/supplier-quotes`, `/supplier-payments`, `/expenses` | Giam doc, Ke toan, OPS, Co dong aggregate | Theo role | Thanh toan/vay/chi phi can confirm + audit |
| Huong dan su dung he thong | Static guide context | Tat ca chatbot | Khong DB | Khong ghi |

## Cach AI chon ERP API theo chat

1. Phan loai y dinh:
   - "hom nay", "can lam gi" -> daily work queue.
   - "rui ro", "canh bao", "tong quan" -> dashboard/alerts.
   - "hoa don", "cong no", "nap tien", "vi" -> finance/invoice/wallet.
   - "lich hoc", "session", "doi lich", "bao cao day" -> sessions/teaching.
   - "lead", "order", "follow-up", "chuyen doi" -> sales.
   - "quang cao", "campaign", "ngan sach" -> ads.
   - "ticket", "su co", "khieu nai" -> tickets.
   - "cach dung", "vao dau" -> guide, khong doc DB.
2. Kiem tra assistant type co trong `allowedAssistantTypes`.
3. Kiem tra role that cua user co trong `allowedRoles`.
4. Ap dung scope:
   - `OWN_RECORDS`: chi record cua user.
   - `OWN_CHILDREN`: chi du lieu con cua phu huynh.
   - `ASSIGNED_RECORDS`: chi lead/ticket/session duoc giao.
   - `ROLE_SCOPE`: theo service ERP hien co.
   - `GLOBAL`: chi director hoac aggregate duoc phep.
5. Chon context nho:
   - summary truoc;
   - drill-down khi user hoi chi tiet;
   - moi list phai limit;
   - khong dua secret/token/raw prompt vao context.
6. Neu la write action:
   - Tao ban preview payload.
   - Noi ro API se goi.
   - Yeu cau xac nhan.
   - Sau khi co xac nhan, goi ERP API bang user JWT va ghi audit.

## Muc uu tien trien khai

1. Giam doc: da co chatbot rieng, tiep tuc bo sung write-action co confirm.
2. Giao vien: tao chatbot doc lich, nhac pending report, soan bao cao day, nop sau khi xac nhan.
3. Ke toan: invoice/top-up/payroll/cashflow, uu tien summary va queue can duyet.
4. OPS: session/class/ticket/pending approvals, thao tac huy/doi lich/finalize co confirm.
5. Sales/Lead care: lead follow-up, conversation, tao lead/order co preview.
6. Phu huynh: hoi lich hoc, hoa don, vi, ticket, homework.
7. Ads: analytics/actions-required, khong tu doi ngan sach.
8. Co dong: chi aggregate/report/export, khong thao tac ghi.

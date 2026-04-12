# WAVE 3 FRONTEND PROGRESS (2026-04-10)

## Muc dich

- Ghi nhan evidence authoritative cho cac slice frontend thuoc Wave 3.
- Khong overclaim full batch closure neu backlog checklist van con muc chua rerun.

## Scope

- Workspace: `school-mgmt/frontend`
- Ngay cap nhat: `2026-04-11`
- Mui gio: `UTC+7`
- Rerun authoritative:
  - `e2e/orchestrator/b02-dashboard-handbook.spec.ts`
  - `e2e/b02-handbook-browser-ui.spec.ts`
  - `e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts`
  - `e2e/dashboard-pending-approvals-browser-ui.spec.ts`
  - `e2e/investor-dashboard-browser-ui.spec.ts`
  - `e2e/nhom12-shareholder-readonly-browser-ui.spec.ts`
  - `e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts --grep "B09 chatbot settings masks token and links conversation to order"`
  - `e2e/b09-chatbot-settings-browser-ui.spec.ts`
  - `e2e/b09-chatbot-settings-library-browser-ui.spec.ts`
  - `e2e/b09-conversations-browser-ui.spec.ts`
  - `e2e/b09-conversation-lead-order-browser-ui.spec.ts`
  - `e2e/b09-internal-messages-browser-ui.spec.ts`
  - `e2e/b09-ai-suggest-preview-only-browser-ui.spec.ts`
  - `e2e/b09-notifications-browser-ui.spec.ts`
  - `e2e/b09-bulk-notifications-browser-ui.spec.ts`
  - `e2e/b09-parent-support-browser-ui.spec.ts`
  - `e2e/orchestrator/b06-b09-b10-b11-comms-ads-reports.spec.ts --grep "B10 ads analytics, sync loading and success"`
  - `e2e/b10-ads-analytics-browser-ui.spec.ts`
  - `e2e/b10-landing-public-browser-ui.spec.ts`
  - `e2e/b10-landing-management-browser-ui.spec.ts`
  - `e2e/b10-ads-management-browser-ui.spec.ts`
  - Tai lieu tham chieu:
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B02_dashboard_widgets_accounting_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B02_internal_handbook_director_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B02_HANDBOOK_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B02_shareholder_read_only_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_SHAREHOLDER_READONLY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B02_Dashboard_RBAC_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_chatbot_settings_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_CHATBOT_SETTINGS_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_CHATBOT_SETTINGS_LIBRARY_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_EXPIRED_OPENAI_TOKEN_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_CONVERSATIONS_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_CONVERSATION_LEAD_ORDER_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_CONVERSATIONS_REALTIME_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_INTERNAL_MESSAGES_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B09_ai_suggest_preview_only_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B09_bulk_notifications_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_PARENT_SUPPORT_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_REFUND_LEDGER_WARNING_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B09_TICKET_LIFECYCLE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B10_ads_analytics_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B10_ADS_ANALYTICS_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B10_LANDING_PUBLIC_FORM_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B10_PIXEL_DEDUPE_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B10_LANDING_PAGES_MANAGEMENT_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B10_ADS_MANAGEMENT_BROWSER_20260410.md`

## Bang trang thai nhanh theo batch

| Batch | Slice authoritative moi | Status | Ghi chu |
| --- | --- | --- | --- |
| B02 | Dashboard widget accounting, handbook, handbook quick links/media browser breadth, shareholder redirect/read-only, cross-role dashboard RBAC, pending approvals browser flows, investor dashboard resilience, Nhom12 shareholder read-only surfaces on investor-dashboard/aging-report/financial-control | PARTIAL_PASS | Dedicated spec `3/3 PASS`, handbook browser spec `2/2 PASS`, role matrix `1/1 PASS`, browser dashboard suite `7/7 PASS`, Nhom12 shareholder read-only browser rerun `2/2 PASS`; pending-approvals approve/reject focused rerun van `1/1 PASS` va duoc remap lam B05 class-update evidence, nhung batch van giu conservative cho toi khi doi chieu backlog tong the |
| B09 | Chatbot token masking, fanpage browser create/delete, fanpage browser edit + `aiAutoReplyEnabled` toggle, OpenAI token browser create/edit/delete, expired OpenAI token visible-state, AI profile browser create/edit/delete, conversation-to-order, conversation filters/select/autoscroll/send guard/takeover/release/close, conversation realtime newMessage append-once and conversationUpdated reorder/reload, conversation create-lead/create-order flows with exact payload and linked-state refresh, internal messages select/load/mark-read/new-direct-send, messages support-queue AI suggest preview-only draft, parent-support context/quick-actions/start-fresh/send, notifications click-to-read, notification-link routing, unread filter, pagination, mark-all-read reset, unread polling stability, bulk notifications group-select/preview/confirm/partial-failure result, ticket tabs, ticketId deep-link, open source conversation to support chat, ticket lifecycle create/detail/comment/resolve/close/reopen/cancel, refund-ticket close warning when no linked refund ledger exists | PASS | Isolated rerun `1/1 PASS`, chatbot-settings browser rerun `2/2 PASS`, chatbot-settings library browser rerun `3/3 PASS`, conversations browser rerun `4/4 PASS`, conversation lead/order browser rerun `2/2 PASS`, internal-messages browser rerun `2/2 PASS`, AI-suggest preview-only browser rerun `1/1 PASS`, parent-support browser rerun `2/2 PASS`, notifications browser rerun `3/3 PASS`, bulk-notifications browser rerun `1/1 PASS`, tickets/messages browser rerun `4/4 PASS`; B09 da du same-day authoritative browser proof cho line `AI suggest preview-only`, nen co the dong full batch theo contract hien tai |
| B10 | Ads analytics, analytics browser sort/filter breadth, optimize-x parameter semantics, sync loading/success, sync/backfill error-path breadth, ads-management tabs/actionable tasks/role visibility, token sync, maintenance backfills, account/group/token CRUD, manual ad-cost create/delete, public invalid slug, public submit error/tracking, public tracking assets no-duplicate across leave/revisit, custom injected markup cleanup, landing-pages management CRUD, copy public URL with clipboard fallback | PARTIAL_PASS | Isolated rerun `1/1 PASS`, analytics browser rerun `2/2 PASS`, landing/public browser rerun `3/3 PASS`, management browser rerun `2/2 PASS`, ads-management browser rerun `9/9 PASS`; Wave 3 scope da du evidence same-day, nhung chua overclaim close full backlog |

## Ket qua chinh cua dot 2026-04-10 va 2026-04-11

- Full rerun `e2e/orchestrator/b02-dashboard-handbook.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b02-handbook-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/orchestrator/b01-b03-system-auth-dashboard.spec.ts`: `3/3 PASS`, trong do B02 role-rendering slice xanh `1/1`
- Full rerun `e2e/dashboard-pending-approvals-browser-ui.spec.ts`: `6/6 PASS`
- Full rerun `e2e/investor-dashboard-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/nhom12-shareholder-readonly-browser-ui.spec.ts`: `2/2 PASS`
- Isolated rerun `B09 chatbot settings masks token and links conversation to order`: `1/1 PASS`
- Full rerun `e2e/b09-chatbot-settings-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b09-chatbot-settings-library-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b09-conversations-browser-ui.spec.ts`: `4/4 PASS`
- Full rerun `e2e/b09-conversation-lead-order-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b09-internal-messages-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b09-ai-suggest-preview-only-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b09-parent-support-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b09-notifications-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b09-bulk-notifications-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b09-tickets-messages-browser-ui.spec.ts`: `4/4 PASS`
- Isolated rerun `B10 ads analytics, sync loading and success`: `1/1 PASS`
- Full rerun `e2e/b10-ads-analytics-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b10-landing-public-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b10-landing-management-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b10-ads-management-browser-ui.spec.ts`: `9/9 PASS`

## Batch notes

### B02

- Da xanh o cac slice sau:
  - accounting dashboard widget route sang `/app/wallets`
  - director handbook link va noi dung keyword chinh
  - director handbook quick links giu exact labels, notes, routes va click-through dung sang 4 target modules
  - accounting handbook gallery/video giu exact captions, image sources, route links, video source/poster, va metric `4 anh va 1 video`
  - shareholder redirect sang `/app/investor-dashboard` va read-only guard
  - Nhom12 shareholder read-only tren `investor-dashboard`, `aging-report`, va `financial-control` khong lo nut `Sua/Xoa/Approve`, dong thoi `aging-report` giu masking `PH #n` / `An danh`
  - dashboard loader, handbook banner, sidebar role matrix tren 8 role
  - investor dashboard nav/routing cho `DIRECTOR` va `SHAREHOLDER` theo contract hien tai
  - dashboard skeleton/loading state
  - dashboard error state va retry path
  - pending approvals tabs/list rendering
  - pending badge counts khop summary/sidebar
  - approve/reject realtime lam giam count va cap nhat UI
  - duration preview trong pending class update
  - investor dashboard giu phan con song khi mot widget loi
  - investor dashboard filter `3/6/12 thang` doi dung metric/trend
- Handbook quick links + gallery/video da co same-day browser evidence authoritative.
- `B02` van de `PARTIAL_PASS` o report nay de tranh overclaim cho den khi dot doi chieu backlog tong the cap nhat cac bang tong hop lien quan.

### B09

- Da xanh o cac slice sau:
  - token masking trong `chatbot-settings`
  - `DIRECTOR` tao/xoa manual fanpage trong `chatbot-settings` giu dung validation, payload create, token label va badge `Bat`
  - `OPS` sua fanpage trong `chatbot-settings`, toggle `aiAutoReplyEnabled`, doi token, va van bi chan khoi create/delete director-only
  - `DIRECTOR` tao/sua/xoa OpenAI token trong `chatbot-settings`, giu exact payload, mask API key tren row, va doi dung model/temperature/maxTokens/trang thai sau reload
  - OpenAI token het han trong `chatbot-settings` hien exact badge `Het han` mau do va edit modal giu dung state `EXPIRED`
  - `DIRECTOR` tao/sua/xoa AI profile trong `chatbot-settings`, giu exact payload, reflect dung token label/fallback va trang thai sau reload
  - conversation tu webhook duoc link thanh order
  - filter hoi thoai theo `keyword`, `status`, `fanpage` giu dung browser list state
  - chon hoi thoai tai dung message history, auto-scroll xuong message moi nhat, va doi send-area theo `HUMAN_HANDLING`, `AI_HANDLING`, `CLOSED`
  - `takeover -> send human message -> release -> close` cap nhat dung browser state va action controls
  - realtime `newMessage` append dung 1 lan, bo qua duplicate id, va giu thread dang mo o vi tri moi nhat
  - realtime `conversationUpdated` dua hoi thoai duoc cap nhat len dau list, va voi hoi thoai moi thi reload lai page 1 de render thread moi o top
  - tao `Lead` tu hoi thoai giu dung prefill customer/sale owner, post exact payload, va refresh sidebar sang linked-lead state
  - tao `Don hang` tu hoi thoai giu dung source data, post exact payload kem `items: []`, va refresh sidebar sang linked-order state
  - internal/direct messages filter theo tab `Noi bo` va keyword giu dung list state
  - chon direct conversation tai dung message history va clear unread badge qua mark-read endpoint
  - tao fresh direct conversation va gui tin nhan dau tien reload lai list dung, roi auto-select thread moi
  - parent support chat chon dung hoc sinh va nguoi ho tro, context cards/header chips doi theo dung thread
  - `start fresh` clear dung active thread ma khong lam vo selected context
  - quick actions seed dung draft, va send dau tien tao/auto-select dung parent-support thread moi
  - `messages` support queue chi hien `Goi y AI` preview-only cho agent; click suggest khong append message va khong fire send call cho den khi agent explicit `Chen vao o nhap` + `Gui`
  - click notification chua doc se mark read va dieu huong dung link
  - unread-only filter va pagination cua notifications giu state dung
  - button mark-all-read reset dung unread state
  - polling unread-count cap nhat dung header badge ma khong duplicate, shuffle, hoac refetch list hien tai
  - `DIRECTOR/OPS` bulk notifications giu dung nhom nhan, preview dung payload compose, va chi gui sau khi confirm voi ket qua `thanh cong/loi` hien ro tung dong
  - OPS tabs `assigned`, `all`, `my` tren tickets hoat dong dung
  - `ticketId` query param mo dung ticket detail
  - `Mo hoi thoai goc` tren ticket di dung vao support conversation va mark read
  - ticket lifecycle browser flow giu dung create validation, create payload, detail load, internal comment payload, resolve summary/refund, va chuoi trang thai `OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED -> OPEN -> CANCELLED`
  - refund ticket khong duoc close neu chua lien ket `refundLedgerEntryId`, UI hien canh bao ro rang va khong gui close request sai nghiep vu
- `B09` da du same-day authoritative browser proof va khong con line mo trong `Nhom 9`; row batch co the chot `PASS` theo contract hien tai ngay `2026-04-11`.
- Line cross-cutting `Nhom 12` ve duplicate guard da du same-day evidence qua `conversations realtime` va `notifications polling`.

### B10

- Da xanh o cac slice sau:
  - ads analytics table/profit rendering
  - shared ads analytics filters fan out dung sang `analytics`, `parents-profit`, va `realized-cohort`
  - overview funnel table sort toggle `ROI %` theo dung contract `desc -> asc`
  - filtered dataset duoc giu dung khi chuyen sang `Profit theo PH`
  - director `optimize-x` giu dung request params `totalBudget + maturityDays + refundRatePercentX`
  - `OPS` van thay duoc overview analytics, nhung `optimize-x` van la director-only
  - sync loading state va success state
  - ads-management tabs account/group/token/cost render dung trong cung browser flow
  - actionable tasks tai dung loading, summary cards, severity badge, reasons list va link dieu huong
  - director backfill parent attribution mo dung result modal va cap nhat maintenance history
  - director Facebook BM token sync mo dung sync result modal, count summary va CTA fanpage
  - director adGroup backfill mo dung result modal va cap nhat maintenance history
  - director CRUD account/group qua modal cap nhat dung table management
  - director CRUD token qua modal va manual cost create/delete cap nhat dung list va status labels
  - global sync hard failure dung browser-level `alert(...)`, khong de lai stale success modal
  - token sync partial-warning render warning list trong `Ket qua dong bo` va khong leak sang `alert(...)`
  - parent-attribution va adGroup backfill hard failure giu nguyen maintenance history va phuc hoi control sau alert
  - OPS thay duoc actionable tasks nhung khong thay director-only token/sync/backfill surfaces
  - SALE bi route guard chan vao `/app/ads-management` va bi day sang `/not-authorized`
  - public landing invalid slug tai loading truoc, sau do vao error shell dung
  - public landing submit error giu form, render submit-error va khong flip sang success
  - tracking payload duoc thu thap truoc submit voi `utm*`, `fbclid`, `gclid`, `ttclid`, `landingPageSlug`, `platform`, `adRefParam`
  - Meta Pixel / Google Tag / TikTok Pixel giu single-instance contract khi vao, roi, va vao lai public landing; khong lap node/script cho cung pixel/tag id trong moi visit authoritative
  - custom head/body markup duoc inject tren public page va duoc don khi route destroy
  - landing pages management create/edit/delete hoat dong dung
  - save button `Luu` bi disable trong luc request dang pending
  - copy public URL hoat dong dung, co fallback khi clipboard fail
- Chua du de dong full `B10` vi:
  - backlog `Nhom 10` trong `remaining-cases.vi.md` van chua duoc doi chieu authoritative theo cung ngay

## Ket luan Wave 3 frontend hien tai

- `B02`: xanh o dashboard/handbook/shareholder/browser slices, nhung chi nen ghi `PARTIAL_PASS` cho toi khi doi chieu backlog tong the
- `B09`: xanh o chatbot-settings/library/conversation/token/conversion/realtime/browser support/bulk notifications/ticket-refund-guard slices, nhung chua dong full batch
- `B10`: xanh o analytics, analytics browser breadth, ads-management browser breadth, va landing flows, nhung chua dong full batch
- `Nhom 12`: line shareholder read-only tren `financial-control`, `aging-report`, `investor-dashboard` da du same-day browser evidence authoritative

## Buoc tiep theo hop ly

1. Ghi Wave 4 progress rieng cho `B03/B06/B11`.
2. Tiep tuc dong cac line con lai co surface that sau khi backlog Nhom12 da duoc reconcile.
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_DUPLICATE_GUARD_BROWSER_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_NHOM12_SHAREHOLDER_READONLY_BROWSER_20260410.md`

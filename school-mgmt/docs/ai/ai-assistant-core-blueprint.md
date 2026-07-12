# AI Assistant Core Blueprint

Tai lieu nay dinh hinh cach mo ta ERP API, tinh huong van hanh va cau truc AI Assistant Core dung chung cho toan bo ERP. Muc tieu la khong tao moi chatbot API rieng cho tung role, ma tao mot core co policy, tool registry va workflow dung chung; moi chatbot nghiep vu chi la mot assistant profile voi quyen va scope rieng.

## Ket luan kien truc

Huong nen chon:

```text
User
-> Assistant Resolver
-> Situation Router
-> Policy Engine
-> Tool Registry
-> Workflow Selector
-> Context Builder
-> AI Reasoner / Response Composer
-> Response Guard
-> Preview / Confirm / Execute
-> Audit Log
```

Khong nen de AI tu do planner truoc policy. AI chi duoc lap luan tren cac tool va context da duoc policy cho phep.

## Nen tang san co trong repo

Repo hien da co cac mieng nen tot:

- `backend/src/chatbot/ai-assistant-permission-catalog.ts`: catalog assistant type, situation, role, scope, risk va write policy.
- `backend/src/director-ai/director-ai-tool-catalog.ts`: tool catalog cho chatbot giam doc.
- `backend/src/director-ai/director-ai.service.ts`: pattern runtime hien tai: chon context, goi ERP service, compact context, goi AI API, luu message, audit.
- `docs/ai/ai-chatbot-situation-permission-matrix.md`: ma tran tinh huong va quyen.
- `docs/ai/director-ai-erp-api-catalog.md`: tool runtime dang bat cho director.

Khoang trong can lap:

- Chua co `ai-core` trung lap.
- `director-ai` con hardcode `DIRECTOR`, `DIRECTOR_AI_TOOL_CATALOG` va switch `runContextTool`.
- Policy con nam rai rac giua guard, catalog metadata, prompt va service ERP.
- Chua co workflow registry cho read/drill-down/write-preview/execute.
- Chua co response guard de chan AI noi da ghi du lieu khi chua execute.

## Cach mo ta ERP API thanh tool

Moi ERP API duoc dua vao AI khong nen chi ghi route. Can mo ta theo nghiep vu, risk va context policy.

```ts
export interface AiToolDefinition {
  key: string;
  capability: AiBusinessCapability;
  businessName: string;
  businessMeaning: string;
  route: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'STATIC';
  serviceMethod: string;
  operation: AiOperation;
  allowedRoles: Role[];
  allowedAssistantTypes: AiAssistantType[];
  dataScope: AiDataScope;
  inputSchemaSummary: string;
  outputSchemaSummary: string;
  defaultFilters: {
    dateRange?: 'none' | 'current_day' | 'current_month' | 'service_default';
    limit?: number;
    status?: string[];
  };
  contextPolicy: string;
  writePolicy: string;
  riskLevel: AiRiskLevel;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  requiresAudit: boolean;
  enabled: boolean;
}
```

Nguyen tac:

- AI khong goi database truc tiep.
- Tool doc danh sach phai co limit/filter/date range.
- Tool ghi phai co preview, confirm, audit va idempotency key.
- Tool co secret/token chi duoc tra metadata, khong bao gio dua secret vao prompt.
- Tool nhay cam ca nhan phai khai bao data scope ro rang.

## Business capabilities can phu

Thay vi chia theo chatbot, nen chia theo capability. Assistant profile se duoc phep dung mot tap capability phu hop.

| Capability | Y nghia | API nhom chinh | Risk mac dinh |
| --- | --- | --- | --- |
| `DAILY_WORK` | Viec can lam, viec qua han, hang cho xu ly | `dashboard/daily-tasks`, `pending-approvals/*` | LOW |
| `EXECUTIVE_OVERVIEW` | Suc khoe doanh nghiep cap tong quan | `dashboard/director`, `dashboard/*`, `audit-log/stats` | MEDIUM |
| `FINANCE_CONTROL` | P&L, cashflow, aging, fund, bank, reconciliation | `financial-control/*` | MEDIUM/CRITICAL |
| `INVOICE_WALLET` | Hoa don, thanh toan, vi, ledger, top-up | `invoices/*`, `wallets/*` | MEDIUM/CRITICAL |
| `PAYROLL_COMPENSATION` | Luong giao vien, staff payroll, salary config | `payroll/*`, `staff-payroll/*`, `salary-config/*` | HIGH/CRITICAL |
| `SALES_CRM` | Lead, order, trial, conversation, conversion | `leads/*`, `orders/*`, `trial-enrollments/*`, `chatbot/conversations/*` | MEDIUM/HIGH |
| `LEARNING_OPERATIONS` | Lop, session, attendance, teaching report | `classes/*`, `sessions/*`, `attendance/*` | MEDIUM/HIGH |
| `SUPPORT_TICKETS` | Ticket, SLA, comment, resolve/close/reopen | `tickets/*` | MEDIUM/HIGH |
| `ADS_MARKETING` | Ads account, ad group, cost, analytics, action suggestions | `ads/*`, landing pages | MEDIUM/CRITICAL |
| `HR_TEACHERS` | Giao vien, nhan su, KPI, work sessions | `teachers/*`, `teacher-registrations/*`, `work-sessions/*` | MEDIUM/HIGH |
| `LEARNING_CONTENT` | Hoc lieu, quiz, homework, grading | `teaching-materials/*`, `quizzes/*`, session homework | MEDIUM |
| `COMMUNICATION_EXPORT` | Thong bao, export bao cao | `notifications/*`, `export/*` | HIGH |
| `ADMIN_SECURITY` | User, audit, AI token, assistant profile | `users/*`, `audit-log/*`, `chatbot/openai-tokens/*` | CRITICAL |
| `PROCUREMENT_OPEX` | Chi phi, NCC, bao gia, thanh toan, vay | `expenses/*`, `supplier-*`, `loans/*` | HIGH/CRITICAL |
| `SYSTEM_GUIDE` | Huong dan dung he thong | static guide/docs | LOW |

## Assistant profiles

Moi chatbot nghiep vu la mot profile tren core chung.

| Assistant | Role chinh | Capability mac dinh | Gioi han bat buoc |
| --- | --- | --- | --- |
| `DIRECTOR_OPERATIONS` | `DIRECTOR` | Tat ca capability, uu tien aggregate va risk | Khong execute critical write neu chua confirm |
| `ACCOUNTING_OPERATIONS` | `ACCOUNTING` | Finance, invoice, wallet, payroll, export, opex | Khong quan tri AI token/user, khong xem ngoai scope tai chinh |
| `OPS_OPERATIONS` | `OPS` | Learning ops, tickets, classes, sessions, pending ops | Khong doi so du vi, khong chot chi tien/luong neu khong duoc phep |
| `TEACHER_SUPPORT` | `TEACHER` | My sessions, teaching report, attendance, materials, own ticket | Chi du lieu cua giao vien dang dang nhap |
| `EXPERIENCE_TEACHER_SUPPORT` | `EXPERIENCE_TEACHER` | Homework grading, quiz/material review | Chi queue duoc giao, khong tai chinh |
| `PARENT_SUPPORT` | `PARENT` | Con cua minh, lich hoc, hoa don, vi, ticket | `OWN_CHILDREN`, khong xem phu huynh/hoc sinh khac |
| `STUDENT_SUPPORT` | `STUDENT` | Bai tap, quiz, lich hoc, hoc lieu | Chi ho so hoc tap cua hoc sinh dang dang nhap |
| `SALE_OPERATIONS` | `SALE` | Lead, order, conversation, trial, products | Chi lead/order/conversation trong sale scope |
| `ADS_OPERATIONS` | `ADSMANAGER` | Ads analytics, cost, ad groups, landing performance | Khong tu doi token/sync/budget neu chua confirm |
| `SHAREHOLDER_INSIGHTS` | `SHAREHOLDER` | Aggregate finance, retention, ads profit, export investor | Khong PII chi tiet, khong thao tac ghi |
| `INTERNAL_SUPPORT` | internal roles | Guide va tra cuu theo role | Khong vuot role cua user |
| `LEAD_CARE` | `SALE/OPS/DIRECTOR` | Conversation, lead, product/order tu van | Gui tin/tao lead/order phai preview + confirm |

## Situation definition

Situation la cau noi/lenh cua nguoi dung o muc nghiep vu. Tool la API cu the. Workflow la cach xu ly situation.

```ts
export interface AiSituationDefinition {
  key: string;
  capability: AiBusinessCapability;
  userIntent: string;
  examples: string[];
  triggerKeywords: string[];
  allowedAssistantTypes: AiAssistantType[];
  allowedRoles: Role[];
  operation: AiOperation;
  dataScope: AiDataScope;
  defaultWorkflow: string;
  candidateTools: string[];
  requiredEntities: string[];
  contextPolicy: string;
  missingDataPolicy: string;
  writePolicy: string;
  riskLevel: AiRiskLevel;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  requiresAudit: boolean;
}
```

## Situation groups ban dau

Nen khoi tao catalog situation theo cac nhom sau.

| Situation group | Cau hoi/lenh mau | Workflow |
| --- | --- | --- |
| Daily brief | "Hom nay toi can xu ly gi?", "Viec nao qua han?" | read summary |
| Executive risk | "Diem nao nguy hiem nhat?", "Tinh hinh he thong?" | read multi-summary |
| Finance risk | "Dong tien co on khong?", "Loi nhuan giam vi sao?" | finance summary + optional drill-down |
| Debt and invoices | "Cong no nao qua han?", "Hoa don nao cho duyet?" | invoice/wallet read, write preview neu duyet |
| Payment control | "Duyet top-up nay", "Dieu chinh vi" | read detail -> preview -> confirm -> execute |
| Payroll control | "Luong nao cho duyet?", "Chot bang luong nay" | payroll detail -> preview -> confirm |
| Sales pipeline | "Lead nao can cham soc?", "Order nao dang nghen?" | sales summary -> drill-down |
| Order action | "Duyet/tuchoi order", "Tao order tu hoi thoai" | detail -> payload preview -> confirm |
| Learning operations | "Buoi hoc nao chua chot?", "Lop nao co rui ro?" | ops summary -> session/class drill-down |
| Teaching report | "GV nao chua nop bao cao?", "Soan bao cao buoi nay" | read queue -> draft/preview -> confirm submit |
| Attendance | "Diem danh lop nay", "Sua diem danh" | detail -> preview -> confirm |
| Tickets and SLA | "Ticket nao qua han?", "Dong ticket nay" | ticket summary/detail -> confirm action |
| Ads actions | "Campaign nao can dung?", "Co nen tang ngan sach?" | analytics summary, no direct budget write |
| HR performance | "Nhan su nao can coaching?", "GV nao rui ro?" | KPI summary, cautious people judgement |
| Content and quiz | "Tim hoc lieu", "Tao quiz", "Cham bai" | read/search/draft -> confirm publish/grade |
| Notifications | "Gui thong bao cho nhom nay" | preview recipients/content -> confirm send |
| Reports/export | "Xuat bao cao tai chinh", "Bao cao co dong" | filter -> preview export -> confirm |
| Audit/security | "Ai thao tac bat thuong?", "Khoa user nay" | read audit; user action critical confirm |
| AI administration | "Cau hinh token/model", "Sua prompt chatbot" | config critical confirm, never expose secret |
| Guide | "Muon xem cong no vao dau?", "Quy trinh dau ngay?" | static guide only |

## Workflow classes

```text
READ_SUMMARY
  Lay aggregate/summary da gioi han -> AI tom tat -> audit usage.

READ_DETAIL
  Xac dinh entity/filter -> policy check -> goi detail/list limit -> AI phan tich.

DRAFT_ONLY
  AI soan noi dung, payload hoac bao cao nhap -> khong ghi.

WRITE_PREVIEW
  Lay current state -> tao payload de xuat -> validate -> tra preview cho user.

WRITE_EXECUTE
  Chi chay khi co confirmation token, idempotency key, policy pass va audit.

EXPORT_PREVIEW
  Kiem tra filter/scope -> preview metadata -> confirm -> tao export.
```

## Context policy de tranh qua tai AI

Mac dinh moi luot chat:

- 1 context nen tang: daily tasks hoac static guide tuy situation.
- Toi da 3-5 data contexts tuy risk/task.
- Neu list thi limit 10-30 item; neu can hon thi bat user drill-down.
- Neu date range trong cau hoi khong ro, dung current month cho finance/sales/dashboard, current day cho daily ops.
- Khong nap raw messages/logs/ledger dai neu khong co filter.
- Khong nap file/export lon vao prompt; chi nap metadata va summary.
- Neu context bi cat, AI phai noi ro can drill-down nao.

Context budget goi y:

| Task | Summary tools | Detail tools | Max chars |
| --- | --- | --- | --- |
| Daily brief | 2-4 | 0-1 | 12000 |
| Finance risk | 3-5 | 1 | 24000 |
| Invoice/wallet action | 1-2 | 2-3 | 20000 |
| Sales pipeline | 2-4 | 1 | 18000 |
| Learning ops | 2-4 | 1-2 | 18000 |
| Ticket SLA | 2 | 1-2 | 16000 |
| Guide | static only | 0 | 8000 |

## Policy engine rules

Policy phai quyet dinh truoc khi context duoc nap va truoc khi AI viet cau tra loi.

Inputs:

- user role, user id, org/center scope neu co
- assistant type
- situation
- requested operation
- requested entity ids
- tool risk level
- data scope

Outputs:

- allow/deny
- allowed tools
- filtered scope
- required confirmation
- required approval
- audit level
- redaction rules

Rules quan trong:

- `DIRECTOR` co global capability nhung critical write van can confirm.
- `PARENT` chi `OWN_CHILDREN`.
- `TEACHER` chi own sessions/classes/reports/payroll view cua minh.
- `SALE` chi assigned records/trong scope sale.
- `SHAREHOLDER` chi aggregate, khong PII chi tiet mac dinh.
- Token, secret, webhook secret, raw prompt noi bo khong bao gio vao AI context.

## Tool registry runtime

Can thay switch hardcode bang registry co executor.

```ts
export interface AiToolExecutor {
  key: string;
  execute(input: AiToolInput, auth: AiAuthContext): Promise<AiToolResult>;
}

export interface AiToolInput {
  filters?: Record<string, unknown>;
  entityId?: string;
  payload?: Record<string, unknown>;
  dryRun?: boolean;
}

export interface AiToolResult {
  key: string;
  sourceRoute: string;
  data: unknown;
  metadata: {
    truncated: boolean;
    totalItems?: number;
    warnings?: string[];
  };
}
```

## Core module de xuat

```text
backend/src/ai-core/
  ai-core.module.ts
  ai-chat.controller.ts
  ai-chat.service.ts
  assistant-resolver.service.ts
  situation-router.service.ts
  policy-engine.service.ts
  tool-registry.service.ts
  workflow-selector.service.ts
  context-builder.service.ts
  ai-provider.service.ts
  response-guard.service.ts
  confirmation.service.ts
  schemas/
    ai-session.schema.ts
    ai-message.schema.ts
    ai-confirmation.schema.ts
  catalogs/
    assistant-profile.catalog.ts
    situation.catalog.ts
    tool.catalog.ts
    workflow.catalog.ts
```

Endpoint chung:

```text
POST /ai/chat
GET  /ai/sessions
GET  /ai/messages
GET  /ai/tools
POST /ai/confirmations/:id/execute
```

Payload chat:

```ts
interface AiChatDto {
  assistantType?: AiAssistantType;
  message: string;
  sessionId?: string;
  contextMode?: string;
  fromDate?: string;
  toDate?: string;
  activeRoute?: string;
  entityContext?: {
    type: string;
    id: string;
  };
}
```

## Migration tu Director AI hien tai

Giai doan 1: giu `director-ai`, tao core catalog doc

- Chuyen metadata trong `DIRECTOR_AI_TOOL_CATALOG` sang `ai-core/catalogs/tool.catalog.ts`.
- Chuyen `AI_ERP_SITUATION_CATALOG` sang catalog core, bo sung capability va workflow.
- Tao adapter de `director-ai` dung `ToolRegistry` thay vi switch `runContextTool`.

Giai doan 2: endpoint core read-only

- Tao `POST /ai/chat`.
- `DIRECTOR_OPERATIONS` chay qua core, output giong chatbot hien tai.
- Them `ACCOUNTING_OPERATIONS`, `OPS_OPERATIONS`, `TEACHER_SUPPORT`, `PARENT_SUPPORT` o muc READ_SUMMARY/READ_DETAIL.

Giai doan 3: write preview

- Them `AiConfirmation` schema.
- Moi action ghi chi tao preview, khong execute.
- Response guard chan cau "da thuc hien" neu status chua execute.

Giai doan 4: execute co confirm

- Confirmation token song ngan.
- Idempotency key cho money/workflow action.
- Audit truoc/sau execute.
- Rollback/compensation policy neu service co ho tro.

Giai doan 5: role chatbot UI

- Dung chung widget chat.
- Moi dashboard role truyen `assistantType`, `activeRoute`, va entity context neu dang o man hinh chi tiet.

## Director chatbot ban dau nen lam gi

Chatbot giam doc la assistant rong nhat nhung van nen bat dau bang read + preview:

- daily brief
- pending approvals summary
- executive risk
- finance risk
- cashflow/debt
- sales pipeline
- operations bottleneck
- ticket SLA
- ads actions required
- teacher/employee KPI
- audit anomaly
- system guide
- write preview cho invoice/top-up/payroll/session/ticket/order, chua auto execute

## Definition of done cho AI Assistant Core

- Mot endpoint chat dung chung cho nhieu assistant type.
- Policy engine deny duoc request sai role truoc khi tool chay.
- Tool registry khai bao duoc route, scope, risk, context policy va executor.
- Context builder co limit/date/filter va compact output nhat quan.
- AI provider khong biet database va khong nhan secret.
- Response guard chan output vuot quyen hoac claim da execute sai.
- Confirmation flow tach preview va execute.
- Audit ghi duoc: user, assistant type, situation, tools, source AI/fallback, confirmation/execution id.
- Test co cac case: role deny, parent own children, teacher own sessions, director critical write requires confirm, token secret not exposed.

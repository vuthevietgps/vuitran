# AI ERP Assistant Code Organization Review

Muc tieu cua viec nhung AI vao ERP khong phai de AI thay database hay thay business service. AI nen la lop dieu phoi va tong hop tren cac ERP API co cau truc.

## Hieu dung y do thiet ke

Y tuong can chot:

- Tinh huong nao lap lai, co quy trinh ro, co so lieu ro thi tao ERP API/tool rieng de lay san du lieu dung cau truc.
- AI chi nhan packet nho, da scope theo role, da tinh summary/queue/risk o backend.
- Tinh huong nao long hon nhu coaching, giai thich, soan tin nhan, de xuat buoc tiep theo thi AI moi dung nhieu hon ve reasoning/prompt.
- Khi goi AI API, backend chon context theo `user.role`, `assistantType`, `situationKey`, `knowledgeType`, `toolKeys`, khong nap full docs/full database.

## To chuc code hien tai

### Lop `director-ai`

`backend/src/director-ai/` la chatbot giam doc rieng.

Dang co:

- Controller rieng.
- Service rieng.
- Session/message schema rieng.
- Tool catalog rieng.
- Static `director_guide`.
- Context selector theo mode/keyword.

Nhan xet:

- Tot de chay nhanh cho Director.
- Nhung da bat dau trung voi `ai-core`.
- Drill-down/action policy chua manh bang AI core.
- Nen tien toi dung `ai-core` lam runtime chung, `director-ai` chi la compatibility/widget wrapper hoac migrate dan.

### Lop `ai-core`

`backend/src/ai-core/` la kien truc dung chung cho nhieu assistant.

Dang co:

- `assistant-resolver.service.ts`: resolve assistant theo role.
- `situation-router.service.ts`: route cau hoi vao situation.
- `policy-engine.service.ts`: loc tool theo role/assistant/policy.
- `context-builder.service.ts`: chay tools va compact context.
- `tool-registry.service.ts`: executor goi ERP services.
- `ai-provider.service.ts`: goi AI API.
- `response-guard.service.ts`: chan reply noi da ghi khi chi read-only.
- `action-draft.service.ts`, `action-planner.service.ts`: preview/confirm action.
- Catalogs: assistant profile, situation, tool.

Nhan xet:

- Day la huong dung.
- Nhung `tool-registry.service.ts` dang gom switch-case lon, sau nay nen tach executor theo capability/module.
- Action draft con thieu nhieu action high-risk.
- Static guide dang nam trong code; sau nay nen dua ve role-scoped knowledge pack co version/sourcePath.

### Lop `chatbot`

`backend/src/chatbot/` dang giu:

- OpenAI tokens.
- AI assistant profiles.
- Permission catalog cu.
- Messaging/lead care lien quan chatbot.

Nhan xet:

- Token/profile management nen giu o `chatbot` hoac tach `ai-admin`.
- Permission catalog cu nen dong bo/migrate vao `ai-core/catalogs` de tranh split-brain.

### Lop `ai-feedback`

`backend/src/ai-feedback/` luu feedback cau tra loi chua thoa dang.

Nhan xet:

- Nen dung lam backlog nang cap situation/tool/eval.
- Khong nen nap vao prompt mac dinh.

## Phan loai tinh huong de tiet kiem token

### 1. Tinh huong cung/lap lai

Day la cac tinh huong nen tao ERP API/tool lay san packet.

Vi du:

- Finance daily risk.
- Accounting reconciliation.
- Pending approvals.
- Payroll cycle.
- Wallet/top-up queue.
- OPS session/ticket SLA.
- Teacher today schedule/report queue.
- Sale follow-up queue.
- Ads actions required.
- Shareholder investor metrics.

Backend nen tra JSON co cau truc:

```json
{
  "summary": {},
  "priorityItems": [],
  "risks": [],
  "evidence": [],
  "nextActions": [],
  "missingData": [],
  "sourceRoutes": [],
  "scope": {}
}
```

AI prompt chi can packet nay, khong can raw list dai.

### 2. Tinh huong ban-cau-truc

Day la cau hoi co entity/filter:

- "Hoa don INV-001 ra sao?"
- "Lop A dang co van de gi?"
- "Lead nay lan cuoi cham soc khi nao?"
- "Ticket nay ai dang xu ly?"

Dung entity resolver + detail tool:

- `invoice_detail`
- `class_detail`
- `lead_detail`
- `ticket_detail`
- `session_detail`
- `ad_group_detail`

AI chi tong hop/chuyen ngu canh, khong tu suy dien ngoai data.

### 3. Tinh huong long/mem

Day la cac cau hoi can AI reasoning:

- Coaching nhan su.
- Soan tin nhan cham soc.
- Giai thich rui ro cho giam doc.
- De xuat thu tu uu tien.
- Tom tat hoc lieu.
- Viet nhan xet giao vien/hoc sinh.

Van phai nap context nho, nhung AI duoc dung static role guide + evidence packet de dien giai.

## De xuat cau truc module tiep theo

Nen tien toi cau truc:

```text
ai-core/
  catalogs/
    assistant-profile.catalog.ts
    situation.catalog.ts
    tool.catalog.ts
    knowledge-pack.catalog.ts
  routers/
    situation-router.service.ts
    knowledge-router.service.ts
  policies/
    policy-engine.service.ts
    action-policy.service.ts
  context/
    context-builder.service.ts
    context-budget.service.ts
    redaction.service.ts
  tools/
    tool-registry.service.ts
    executors/
      finance-tools.executor.ts
      ops-tools.executor.ts
      sales-tools.executor.ts
      teacher-tools.executor.ts
      parent-student-tools.executor.ts
      ads-tools.executor.ts
      shareholder-tools.executor.ts
  packets/
    director-executive-packet.service.ts
    accounting-reconciliation-packet.service.ts
    ops-sla-packet.service.ts
    teacher-today-packet.service.ts
    sale-followup-packet.service.ts
    ads-optimization-packet.service.ts
    shareholder-investor-packet.service.ts
  actions/
    action-draft.service.ts
    action-executor.service.ts
    executors/
      finance-action.executor.ts
      session-action.executor.ts
      ticket-action.executor.ts
      ads-action.executor.ts
      message-action.executor.ts
```

## API packet nen tao truoc

| Packet API/tool | Dung cho | Ly do |
| --- | --- | --- |
| `director_executive_packet` | Director | Gom daily tasks, approvals, finance risks, ops bottleneck, audit stats trong 1 packet da compact. |
| `accounting_reconciliation_packet` | Accounting | Gom invoice pending, top-up pending, cashflow risk, aging, payroll status, bank/fund reconciliation. |
| `ops_sla_packet` | OPS | Gom sessions can finalize/no-show, tickets SLA, classes needing attention, trial/test queue. |
| `teacher_today_packet` | Teacher | Gom lich day, pending reports, materials, tickets/messages unread, payroll note. |
| `sale_followup_packet` | Sale | Gom leads due, stale leads, order pipeline, trial decisions, commission snapshot. |
| `ads_optimization_packet` | Ads/Director | Gom spend, CPL/CPO, ROI, actions required, sync warnings, budget guardrails. |
| `parent_child_packet` | Parent | Gom children, sessions, invoices, wallet, progress, homework/tickets. |
| `student_learning_packet` | Student | Gom schedule, homework, quiz, materials, next study suggestions. |
| `shareholder_investor_packet` | Shareholder | Gom investor metrics, aggregate finance, retention, runway, no PII. |

## Nguyen tac runtime de giam token

1. Route situation truoc khi lay context.
2. Chon assistant theo role that trong JWT, khong theo user prompt.
3. Neu situation co packet API thi uu tien packet API.
4. Neu packet khong du, moi them detail tool theo entity/filter.
5. Gioi han so tool moi chat, hien tai 5 la hop ly.
6. Moi list API phai limit va co filter.
7. Static knowledge phai role-scoped, khong nap all-handbook.
8. Redact token/secret/password/api key.
9. Prompt AI chi gom: system policy, role guide nho, packet/detail context, cau hoi user.
10. Audit lai `situationKey`, `toolKeys`, `knowledgeKeys`, source AI/fallback/action.

## Ket luan

Huong dung la: ERP API tinh truoc cac packet lap lai, AI chi tong hop va ra de xuat co bang chung. Cac mien nhu finance va ads nen uu tien packet API vi cong thuc/risk/queue lap lai cao, neu dua raw context vao prompt se ton token va rui ro sai so lieu. Cac mien long nhu coaching, soan tin, giai thich va huong dan co the cho AI linh hoat hon, nhung van phai bi role scope va tool scope khong che.

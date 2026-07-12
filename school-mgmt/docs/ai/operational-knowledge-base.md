# Operational Knowledge Base

Tai lieu nay tong hop Knowledge Base van hanh hien co va huong tach sau nay theo tung loai user/assistant de tiet kiem prompt, token va tang bao mat.

## Muc tieu truoc mat

Truoc mat, gom day du tri thuc van hanh vao mot ban tong hop de doi dev, Codex va cac sub-agent co cung mot nguon doi chieu khi nang cap AI.

Ban tong hop phai tra loi duoc:

- Tri thuc tinh nam o dau.
- Noi dung gom nhung nhom nao.
- Phan nao dang duoc AI runtime dung truc tiep.
- Phan nao moi la tai lieu cho con nguoi/onboarding.
- Sau nay nen tach theo role va theo loai tri thuc nhu the nao.

## Nguon tri thuc hien co

### 1. `docs/` la source of truth tai lieu

`school-mgmt/docs/` la nguon goc chinh cua tai lieu du an. Day la noi bao tri noi dung nghiep vu, SOP, checklist, handbook, ke hoach va tai lieu AI.

Nhom quan trong:

- `docs/operations/`
  - Quy trinh van hanh.
  - Kich ban Sale, Ke toan, Van hanh, Director.
  - Checklist master mo trung tam.
  - Tong hop link mo trung tam.
- `docs/operations/opening-center-handbooks/`
  - So tay Director.
  - So tay Sale.
  - So tay OPS.
  - So tay Accounting.
  - So tay Teacher.
  - So tay Shareholder.
  - So tay Ads/Marketing.
  - So tay HR/Admin.
- `docs/operations/opening-center-checklists/`
  - Checklist chung.
  - Checklist theo tung role.
- `docs/teacher/`
  - Huong dan giao vien.
  - Kich ban giao vien.
  - Kich ban kiem thu giao vien.
  - Asset minh hoa luong giao vien.
- `docs/adsmanager/`
  - Huong dan Ads Manager.
  - Kich ban video Ads.
  - Cai tien action tasks Ads.
- `docs/shareholder/`
  - Tai lieu co dong.
  - Investment memo.
  - Dieu le co dong.
- `docs/ai/`
  - AI Assistant Core Blueprint.
  - Situation and Permission Matrix.
  - Director AI ERP API Catalog.
  - Teacher AI Situations Guide.
  - Sale AI Situations Guide.
  - AI Feedback Improvement Loop.

### 2. Backend AI catalogs la tri thuc runtime

Day la lop AI runtime dang doc truc tiep de chon assistant, situation, tool, policy va context.

File chinh:

- `backend/src/ai-core/catalogs/assistant-profile.catalog.ts`
  - Dinh nghia tung assistant type.
  - Label, role chinh, data boundary, default context policy, dieu cam.
- `backend/src/ai-core/catalogs/situation.catalog.ts`
  - Dinh nghia cac tinh huong nguoi dung hoi/ra lenh.
  - Vi du cau hoi, trigger keywords, assistant duoc phep, role duoc phep, workflow, candidate tools, context policy, write policy, risk.
- `backend/src/ai-core/catalogs/tool.catalog.ts`
  - Dinh nghia cac ERP tool/API AI co the dung.
  - Route, method, service method, role, assistant type, data scope, input/output schema summary, default filters, context policy, write policy, risk, confirmation, approval, audit.
- `backend/src/director-ai/director-ai-tool-catalog.ts`
  - Catalog rieng cua Director AI hien tai.
  - Gom daily tasks, approvals, dashboard, finance, sales, ops, ads, audit, guide.
- `backend/src/director-ai/director-ai.service.ts`
  - Dang co static `director_guide` hard-code trong `getDirectorGuideContext()`.
  - Noi dung gom mission, daily routine, key screens, forbidden.

### 3. Frontend handbook va flow guide la tri thuc publish tren UI

Day la noi user doc truc tiep tren UI, khong phai runtime KB chinh cua AI.

File/chum file chinh:

- `frontend/src/app/components/internal-handbook.configs.ts`
  - Cau hinh handbook theo role.
  - Gom title, summary, guardrails, scenarios, quick links, gallery, videos.
- `frontend/src/app/components/shared/flow-guide.component.ts`
  - Huong dan thao tac theo tung feature/screen.
  - Gom title, summary, cac step thao tac.
- `frontend/src/assets/internal-handbook/`
  - Anh/video publish cho internal handbook.
- `frontend/src/assets/teacher-docs/`
  - Tai lieu va asset publish cho giao vien.

### 4. Teaching materials la knowledge dong theo hoc lieu

`backend/src/teaching-materials/` co xu ly tri thuc tu hoc lieu:

- `manualSummary`
- `aiSummary`
- `extractedTextPreview`
- `chunkCount`
- extraction status

Day khong phai KB van hanh tinh. No la tri thuc hoc lieu/dynamic, nen can tach khoi operational KB.

### 5. `ai_feedback` la backlog nang cap, khong phai KB tinh

`backend/src/ai-feedback/` va collection `ai_feedback` luu cac cau hoi/cau tra loi AI chua thoa dang.

No dung de:

- Triage loi AI.
- Bo sung situation/tool/policy/eval.
- Uu tien nang cap theo feedback that cua user.

No khong nen duoc nap vao prompt mac dinh nhu knowledge base.

## Noi dung Knowledge Base van hanh nen bao gom

### Nhom A: Quy trinh va SOP

- Quy trinh dau ngay/cuoi ngay theo tung role.
- Luong xu ly chinh: lead, order, invoice, wallet, class, session, teaching report, payroll, ticket, ads.
- Quy trinh approve/reject.
- Quy trinh audit va truy vet.
- Quy trinh mo trung tam.

### Nhom B: Role handbook

- Director: dieu hanh, phe duyet, tai chinh, audit, rui ro.
- Sale: lead, order, trial/test, follow-up, commission.
- OPS: lop, session, giao vien, ticket, lich hoc, van hanh hang ngay.
- Accounting: invoice, wallet, top-up, payroll, doi soat, bao cao tai chinh.
- Teacher: lich day, attendance, report, hoc lieu, ticket, payroll ca nhan.
- Experience Teacher: review bai tap, quiz, hoc lieu, chat luong giao vien.
- Parent: lich hoc con, invoice, wallet, progress, ticket.
- Student: lich hoc, homework, quiz, hoc lieu.
- Ads Manager: ads analytics, actions required, token/sync, landing pages.
- Shareholder: bao cao aggregate, retention, finance high-level.

### Nhom C: Man hinh va navigation

- Man hinh nao dung cho viec nao.
- Route UI.
- Link nhanh theo role.
- Dieu kien hien thi theo permission.
- Cac thao tac can xac nhan.

### Nhom D: AI situation knowledge

- Cau hoi mau.
- Trigger keywords.
- Situation routing.
- Candidate tools.
- Missing data policy.
- Response guidance.
- Risk level.
- Read/write policy.

### Nhom E: API/tool metadata

- Route API.
- Service method.
- Input schema summary.
- Output schema summary.
- Data scope.
- Default date range/filter/limit.
- Context policy.
- Audit/confirmation/approval requirement.

### Nhom F: Guardrails va bao mat

- Role nao duoc doc gi.
- Role nao khong duoc doc gi.
- Khi nao chi duoc aggregate.
- Khi nao can drill-down.
- Khi nao can preview/confirm.
- Khong dua token, secret, prompt noi bo, raw database dump vao AI context.

## Hien trang runtime

Hien tai AI runtime chua doc toan bo markdown trong `docs/` nhu mot RAG knowledge base.

Runtime dang dua vao:

- Backend catalogs.
- Static guide hard-code.
- Context lay tu ERP service/tool.
- Prompt he thong trong service.

Dieu nay tot cho bao mat va tinh on dinh, nhung co han che:

- Handbook/checklist trong docs chua tu dong di vao AI.
- Co nguy co noi dung docs va backend catalog lech nhau.
- Neu dua full docs vao prompt thu cong se ton token va co rui ro lo thong tin ngoai scope role.

## Huong tach sau nay

Sau nay nen tach Knowledge Base theo 2 chieu:

1. Theo role/assistant.
2. Theo loai tri thuc can doc.

Cho phep lap lai noi dung neu can. Lap lai co kiem soat giup moi role co goi knowledge rieng, tranh phai nap mot tai lieu tong rat dai.

### Tach theo role/assistant

Moi role nen co knowledge pack rieng:

- `director_operations`
- `sale_operations`
- `ops_operations`
- `accounting_operations`
- `teacher_support`
- `experience_teacher_support`
- `parent_support`
- `student_support`
- `ads_operations`
- `shareholder_insights`
- `internal_support`
- `lead_care`

Moi pack co the chua:

- `guide`
- `sop`
- `screens`
- `situations`
- `tools`
- `policies`
- `examples`
- `forbidden`

### Tach theo loai tri thuc

Nen gan `knowledgeType` cho moi chunk/document:

- `SYSTEM_GUIDE`: cach dung he thong, vao man hinh nao.
- `ROLE_HANDBOOK`: so tay theo role.
- `SOP`: quy trinh thao tac.
- `CHECKLIST`: viec can lam, onboarding, mo trung tam.
- `SCREEN_GUIDE`: huong dan man hinh/route.
- `API_TOOL`: metadata API/tool.
- `SITUATION`: routing va tinh huong AI.
- `POLICY`: quyen, bao mat, write policy.
- `FAQ`: cau hoi dap nhanh.
- `EVAL_CASE`: cau hoi regression tu feedback.

## Nguyen tac chon knowledge gui len AI API

Khi user hoi AI, backend nen chon knowledge theo pipeline:

1. Xac dinh `user.role`.
2. Resolve `assistantType`.
3. Route `situation`.
4. Xac dinh `knowledgeTypes` can nap.
5. Loc theo role/assistant/data boundary.
6. Lay top chunks co lien quan.
7. Cat gon, redact sensitive fields.
8. Gui len AI API chi voi context can thiet.

Vi du:

- Sale hoi "Lead nao can cham soc hom nay?"
  - Assistant: `SALE_OPERATIONS`
  - Situation: `sale_daily_followups`
  - Knowledge types: `SOP`, `SCREEN_GUIDE`, `API_TOOL`, `POLICY`
  - Khong nap Director finance handbook.

- Director hoi "Hom nay can xu ly gi?"
  - Assistant: `DIRECTOR_OPERATIONS`
  - Situation: `daily_work_queue`
  - Knowledge types: `ROLE_HANDBOOK`, `CHECKLIST`, `API_TOOL`
  - Nap daily tasks, approvals summary, director guide.

- Parent hoi "Toi xem hoc phi cua con o dau?"
  - Assistant: `PARENT_SUPPORT`
  - Situation: `system_guide`
  - Knowledge types: `SCREEN_GUIDE`, `FAQ`, `POLICY`
  - Khong doc DB neu chi hoi cach dung.

## De xuat cau truc metadata tuong lai

Moi knowledge chunk nen co metadata:

```json
{
  "key": "sale.followup.daily.sop",
  "title": "Sale daily follow-up SOP",
  "roleScopes": ["SALE"],
  "assistantTypes": ["SALE_OPERATIONS", "LEAD_CARE"],
  "knowledgeType": "SOP",
  "situations": ["sale_daily_followups"],
  "routes": ["/app/leads", "/app/conversations"],
  "toolKeys": ["sale_followups_due", "sale_lead_pipeline"],
  "riskLevel": "LOW",
  "dataPolicy": "Guide only, no DB data",
  "version": "2026-06-09",
  "sourcePath": "docs/operations/opening-center-handbooks/so-tay-sale.md"
}
```

## Loi ich

- Giam token vi khong gui full handbook cho moi cau hoi.
- Bao mat tot hon vi role nao chi thay tri thuc role do.
- De test hon vi moi situation co knowledge pack ro.
- De nang cap hon vi feedback AI co the map ve situation/tool/knowledge chunk cu the.
- Cho phep lap lai co chu dich giua cac role ma khong pha scope bao mat.

## Ke hoach trien khai de xuat

### Phase 1: Tong hop day du

- Giu `docs/` la source of truth.
- Duy tri backend AI catalogs la runtime source.
- Tao ban tong hop KB van hanh nay de doi chieu.

### Phase 2: Lap inventory theo role

- Tao bang role -> docs -> screens -> tools -> situations.
- Danh dau noi dung nao dang bi trung/lap giua role.
- Chap nhan lap lai neu giup prompt nho va scope ro.

### Phase 3: Chuan hoa metadata

- Them frontmatter hoac sidecar JSON cho handbook/checklist.
- Gan roleScopes, assistantTypes, knowledgeType, situations, toolKeys, routes.

### Phase 4: Ingest/sync

- Sync markdown thanh knowledge chunks.
- Luu version/sourcePath/hash de truy vet.
- Co co che rebuild khi docs thay doi.

### Phase 5: Runtime retrieval

- AI core chon knowledge theo user role + assistant type + situation + knowledge type.
- Gioi han top chunks.
- Redact sensitive content.
- Audit knowledge keys da gui len AI API.

### Phase 6: Feedback loop

- Feedback chua thoa dang map ve `knowledgeKey`, `situationKey`, `toolKeys`.
- Sub-agent dung feedback de sua docs/catalog/eval.
- Sau khi fix, cap feedback status thanh `RESOLVED`.

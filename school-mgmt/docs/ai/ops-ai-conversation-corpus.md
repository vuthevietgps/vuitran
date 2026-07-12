# OPS AI Conversation Corpus

Tai lieu nay mo ta cach to chuc hoi thoai AI thanh nguon hoc noi bo de nang cap tro ly van hanh.

## Muc tieu

- Luu lai hoi thoai that theo `AiSession` va `AiMessage`.
- Moi luot chat co metadata: assistant type, situation, tool keys, active route, source, risk level va entity resolution status.
- Director/OPS co endpoint doc corpus de triage va chuyen thanh backlog/eval.
- Corpus khong duoc nap vao prompt mac dinh. No la nguon review offline de nang cap catalog, tool, packet va test.

## Endpoint

`GET /ai/conversation-corpus`

Chi `DIRECTOR` va `OPS` duoc doc.

Query:

```json
{
  "assistantType": "OPS_OPERATIONS",
  "situationKey": "ops_daily_sla_packet",
  "source": "AI_API",
  "activeRoute": "/app/ops-dashboard",
  "fromDate": "2026-06-01",
  "toDate": "2026-06-30",
  "search": "SLA",
  "page": 1,
  "limit": 30
}
```

Mac dinh endpoint tap trung vao `OPS_OPERATIONS`.

Response gom:

- Cap `userMessage` va `assistantAnswer` da cat ngan.
- `assistantType`, `situationKey`, `toolKeys`, `source`, `activeRoute`.
- `facets.situations` va `facets.sources` de biet nhom nao dang phat sinh nhieu hoi thoai.
- `improvementUse` de reviewer biet nen sua router, tool, eval hay tao feedback.

## Luu tru metadata

`AiSession` luu:

- `assistantType`
- `lastSituationKey`
- `lastToolKeys`
- `lastActiveRoute`
- `lastSource`
- `messageCount`

`AiMessage` luu:

- `situationKey`
- `toolKeys`
- `metadata.assistantType`
- `metadata.activeRoute`
- `metadata.contextMode`
- `metadata.source`
- `metadata.situationCapability`
- `metadata.situationRiskLevel`
- `metadata.entityResolutionStatus`

## Quy trinh nang cap tu hoi thoai

1. Loc `assistantType=OPS_OPERATIONS` va situation can review.
2. Doc 20-50 cap hoi-dap gan nhat, uu tien `FALLBACK`, `TOO_GENERIC`, `MISSING_CONTEXT`.
3. Phan loai loi:
   - Router sai intent: them trigger keyword/example vao situation.
   - Thieu context: them packet/tool read-only co limit.
   - Tra loi dai/chung chung: sua prompt rubric hoac response guidance.
   - Hanh dong nguy hiem: sua action policy/response guard.
4. Tao `ai_feedback` cho hoi thoai chua tot neu can tracking trang thai.
5. Tao eval regression tu cau hoi that.
6. Sau khi sua, chay test/build va danh dau feedback `RESOLVED`.

## Nguyen tac bao mat

- Khong luu token, secret, prompt noi bo vao message metadata.
- Corpus chi dung de review noi bo, khong dua raw hoi thoai vao AI prompt mac dinh.
- Neu can dua vao knowledge pack, phai bien hoi thoai thanh rule/guide/eval da redact.
- Parent/student/teacher data chi duoc doc theo role scope khi chat; endpoint corpus chi mo cho Director/OPS de review chat noi bo.

# Sale AI Situations Guide

Tai lieu nay mo ta cac tinh huong moi cho `SALE_OPERATIONS` va phan cham soc lead cua `LEAD_CARE` trong AI Assistant Core.

## Muc tieu

- Sale hoi lead nao den han follow-up va viec uu tien trong ngay.
- Sale xem pipeline lead, ty le chuyen doi va diem nghen cham soc.
- Sale theo doi order cua minh: draft, cho duyet, can bo sung, da duyet.
- Sale theo doi hoc thu/test: pending trial, waiting decision va chot sau test.
- Sale doi chieu doanh thu va hoa hong ca nhan.
- Sale hoi cach dung ERP va quy trinh thao tac.
- Sale hoi "viec nao nen lam truoc" va nhan packet co scoring/rank theo lead, order, trial, conversation va doanh thu.

## Endpoint su dung

Dung endpoint core chung:

```text
POST /ai/chat
```

Payload mau cho sale:

```json
{
  "assistantType": "SALE_OPERATIONS",
  "message": "Lead nao can follow-up hom nay?",
  "contextMode": "SALES",
  "fromDate": "2026-06-08",
  "toDate": "2026-06-08"
}
```

Neu khong truyen `assistantType`, backend tu suy luan theo role JWT. Role `SALE` se dung `SALE_OPERATIONS`.

## Tinh huong da them

| Situation | Assistant | Cau hoi mau | Tool chinh |
| --- | --- | --- | --- |
| `sale_next_best_actions_packet` | `SALE_OPERATIONS` | "Hom nay toi can lam gi de chot doanh thu?", "Pipeline cua toi dang nghen o dau?", "Top viec sale uu tien trong ngay" | `sale_next_best_actions`, `sale_conversations`, `sale_followups_due`, `sale_trial_summary`, `sale_commission_report` |
| `sale_daily_followups` | `SALE_OPERATIONS`, `LEAD_CARE` | "Lead nao can follow-up hom nay?", "Danh sach phu huynh can cham soc" | `daily_tasks`, `sale_followups_due`, `sale_lead_pipeline`, `sales_dashboard` |
| `sale_lead_pipeline_review` | `SALE_OPERATIONS`, `LEAD_CARE` | "Pipeline lead cua toi the nao?", "Ty le chuyen doi cua toi?" | `sales_dashboard`, `sale_lead_pipeline`, `sale_followups_due`, `sale_my_leads` |
| `sale_order_pipeline_review` | `SALE_OPERATIONS` | "Don nao cua toi can bo sung?", "Order nao dang cho duyet?" | `sale_order_pipeline`, `sale_my_orders`, `sales_dashboard` |
| `sale_trial_followup` | `SALE_OPERATIONS`, `LEAD_CARE` | "Hoc thu nao dang cho quyet dinh?", "Buoi test cua toi hom nay?" | `sale_trial_summary`, `sale_trial_enrollments`, `sales_dashboard` |
| `sale_commission_personal` | `SALE_OPERATIONS` | "Hoa hong cua toi thang nay?", "Commission theo order nao?" | `sale_commission_report`, `sales_dashboard` |
| `system_guide` | `SALE_OPERATIONS`, `LEAD_CARE` | "Huong dan quy trinh dau ngay cho sale", "Vao dau de xem hoc thu?" | `system_guide`, `sale_guide` |

## Huong dan su dung cho sale

1. Hoi follow-up: "Lead nao can follow-up hom nay?", "Uu tien cham soc lead nao truoc?"
2. Hoi uu tien tong hop: "Hom nay toi can lam gi de chot doanh thu?", "Pipeline cua toi dang nghen o dau?", "Top 5 viec sale uu tien".
3. Hoi pipeline lead: "Pipeline lead cua toi the nao?", "Lead nao dang consulting/interested?"
4. Hoi order: "Don nao can bo sung?", "Order nao dang cho duyet trong thang nay?"
5. Hoi hoc thu/test: "Hoc thu nao dang waiting decision?", "Trial nao can chot sau test?"
6. Hoi conversation: "Conversation nao dang can toi phan hoi?"
7. Hoi hoa hong: "Hoa hong cua toi thang nay?", "Doanh thu ca nhan theo order nao?"
8. Hoi cach dung: "Huong dan quy trinh sale dau ngay", "Vao dau de xem lich test?"

## Nang cap 9+

- `sale_next_best_actions` gom du lieu tu dashboard sales, follow-up due, stale lead, order pipeline/list, trial summary/list, commission report va conversation assigned cho sale.
- Packet tra `nextBestActions` co `rank`, `score`, `priority`, `type`, `reason`, `evidence`, `route`, `suggestedNextStep` va co co `requiresConfirmationForWrite`.
- AI phai dung rank/evidence trong packet lam cau tra loi chinh khi tool nay duoc nap; khong tu sap xep lai neu khong co bang chung tot hon trong context.
- `sale_conversations` chi lay hoi thoai co `assignedAgentId` bang JWT sale, khong doc hoi thoai chua assigned.
- Da co `sale-ai-question-bank` cho eval rieng: daily priority, follow-up, pipeline, order, trial, commission, conversation, guide va action draft.

Quy tac an toan:

- AI sale chi doc lead, order, hoc thu/test va conversation trong scope sale dang dang nhap.
- Tool sale khong nhan `saleId` tu cau hoi; `saleId` phai lay tu JWT.
- AI co the soan noi dung cham soc, ghi chu lien he, checklist bo sung order, nhung cap nhat lead/order/trial hoac gui tin nhan phai co preview va xac nhan.
- AI khong duoc cam ket hoc phi, uu dai, lich hoc, hoa hong hoac thay doi doanh thu neu context khong co du lieu xac nhan.

## Definition of done

- Role `SALE` dung duoc cac situation follow-up, lead pipeline, order pipeline, hoc thu/test, hoa hong va guide.
- `LEAD_CARE` dung duoc cac situation cham soc lead va hoc thu/test, nhung khong dung order/hoa hong ca nhan.
- Parent/student/teacher khong dung duoc tool sale-only.
- Context danh sach bi gioi han, khong truyen `saleId` tu input user, token/secret/password bi redact.

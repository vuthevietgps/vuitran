# Teacher AI Situations Guide

Tai lieu nay mo ta cac tinh huong moi cho `TEACHER_SUPPORT` va `EXPERIENCE_TEACHER_SUPPORT` trong AI Assistant Core.

## Muc tieu

- Giao vien hoi lich day, buoi sap toi, lop/hoc sinh dang phu trach.
- Giao vien hoi buoi nao con thieu bao cao day.
- Giao vien xem lai bao cao day da nop.
- Giao vien hoi thu nhap/pending payout cua chinh minh.
- Giao vien hoi cach dung ERP va quy trinh thao tac.
- Giao vien review hoi queue bai tap can cham/review.

## Endpoint su dung

Dung endpoint core chung:

```text
POST /ai/chat
```

Payload mau cho giao vien:

```json
{
  "assistantType": "TEACHER_SUPPORT",
  "message": "Hom nay toi day lop nao?",
  "contextMode": "OPERATIONS",
  "fromDate": "2026-06-08",
  "toDate": "2026-06-08"
}
```

Neu khong truyen `assistantType`, backend tu suy luan theo role JWT. Role `TEACHER` se dung `TEACHER_SUPPORT`.

## Tinh huong da them

| Situation | Assistant | Cau hoi mau | Tool chinh |
| --- | --- | --- | --- |
| `teacher_schedule_sessions` | `TEACHER_SUPPORT` | "Hom nay toi day lop nao?", "Lich day sap toi cua toi?" | `teacher_dashboard`, `teacher_upcoming_sessions`, `teacher_my_sessions` |
| `teacher_report_queue` | `TEACHER_SUPPORT` | "Buoi nao toi chua nop bao cao?", "Soan bao cao cho buoi nay" | `teacher_pending_reports`, `teacher_dashboard` |
| `teacher_report_history` | `TEACHER_SUPPORT` | "Bao cao toi da nop trong thang nay?", "Xem lai bao cao gan nhat" | `teacher_completed_reports` |
| `teacher_personal_payroll` | `TEACHER_SUPPORT` | "Luong cua toi thang nay?", "Con bao nhieu pending payout?" | `teacher_dashboard` |
| `experience_teacher_homework_review` | `EXPERIENCE_TEACHER_SUPPORT` | "Bai nao can cham?", "Huong dan cham bai tap" | `homework_grading_queue`, `teacher_guide` |
| `system_guide` | `TEACHER_SUPPORT`, `EXPERIENCE_TEACHER_SUPPORT` | "Huong dan nop bao cao day", "Toi vao dau de xem lich day?" | `system_guide`, `teacher_guide` |

## Huong dan su dung cho giao vien

1. Hoi lich day: "Hom nay toi day lop nao?", "Tuan nay toi co nhung buoi nao?"
2. Hoi bao cao con thieu: "Buoi nao chua nop bao cao?", "Can nop bao cao day nao truoc?"
3. Soan nhap bao cao: "Soan bao cao cho buoi [ma buoi] voi noi dung..."
4. Xem lai bao cao: "Bao cao da nop gan nhat cua toi?"
5. Hoi thu nhap: "Pending payout cua toi la bao nhieu?"
6. Hoi cach dung: "Huong dan nop bao cao day", "Vao dau de tao ticket su co?"

Quy tac an toan:

- AI chi doc du lieu trong scope giao vien dang dang nhap.
- AI co the soan nhap bao cao/ticket, nhung nop bao cao, tao ticket, huy buoi, no-show phai co xac nhan.
- Giao vien khong xem luong nguoi khac, hoc phi, vi, hoa don hoac du lieu ngoai lop/buoi duoc phan cong.

## Huong dan su dung cho giao vien review

1. Hoi queue: "Bai nao can cham?"
2. Hoi chi tiet: "Mo bai cua hoc sinh [ten/ma] trong queue."
3. Soan nhan xet: "Soan feedback ngan gon cho bai nay."
4. Cham/review: chi thuc hien sau khi xem preview va xac nhan.

## Definition of done

- Role `TEACHER` dung duoc cac situation lich day, bao cao day, lich su bao cao, thu nhap va guide.
- Role `EXPERIENCE_TEACHER` dung duoc queue cham bai va guide review.
- Parent/student/sale khong dung duoc tool teacher-only.
- Context danh sach bi gioi han, khong nap file lon, token/secret/password bi redact.

# Ket qua test teaching report va tai lieu hoc tap - 2026-05-22

Pham vi kiem thu:
- Bao cao buoi hoc: giao vien nop bao cao, cap nhat bao cao, luu danh gia tien do bai hoc vao `session.evaluation`.
- Rang buoc linh hoat giao vien: neu bai hoc chua hoan thanh hoac `% hoan thanh < 100`, bat buoc ghi ly do dieu chinh.
- Tai lieu hoc tap/BTVN: chi Director duoc upload/cap nhat/xoa/reprocess; giao vien xem va su dung tai lieu duoc chia se.
- Quiz co cau truc: Director/OPS tao cau hoi va quiz da duyet; giao vien chon quiz trong teaching report de giao bai; phu huynh/hoc sinh lam quiz tren he thong.

Ket qua lenh da chay:

| Lenh | Ket qua | Ghi chu |
| --- | --- | --- |
| `npm test -- session-workflow.service.co-teacher.spec.ts` | PASS, 3/3 tests | Unit test co-teacher submit report va bulk report luu evaluation moi. |
| `npm test -- session-workflow.service.spec.ts` | PASS, 2/2 tests | Unit test cancel/reschedule van pass sau khi them dependency quiz vao workflow service. |
| `npm test -- quizzes.service.spec.ts` | PASS, 6/6 tests | Unit test quiz: parent/student chi thay quiz APPROVED, an dap an dung, luu video dau bai, auto-grade cau hoi choice, essay vao hang can cham tay, va manager chot diem thu cong. |
| `npm run test:teaching-report-workflow` | PASS, 17/17 tests | API workflow kiem tra pending/completed report, payroll preview, parent confirm, director finalize, va validate ly do khi tien do chua hoan thanh. |
| `npm run test:teaching-materials-workflow` | PASS, 9/9 tests | API workflow kiem tra Director-only manage materials va staff read-only usage. |
| `npm run build` trong `backend` | PASS | Nest build thanh cong. |
| `npm run build` trong `frontend` | PASS | Angular build thanh cong; con warning CSS budget cu o `ads-guide-landing.component.ts` vuot 434 bytes. |

Cap nhat test:
- `backend/src/sessions/session-workflow.service.co-teacher.spec.ts`
  - Cap nhat mock constructor theo dependency `TeachingMaterialModel`.
  - Cap nhat mock constructor theo dependency `QuizModel`.
  - Them assert `lessonProgressStatus`, `progressPercent`, `studentPerformance`, `studentEngagement`, `comprehensionLevel`, `deviationReason`, `nextSessionPlan`, `overallComment` duoc luu vao `evaluation`.
  - Them assert bulk report set cac truong evaluation moi.
- `backend/src/sessions/session-workflow.service.spec.ts`
  - Cap nhat mock constructor theo dependency `TeachingMaterialModel` va `QuizModel`.
- `backend/src/quizzes/quizzes.service.spec.ts`
  - Them test rang buoc danh sach quiz cho role PARENT/STUDENT luon bi ep ve `APPROVED`.
  - Them test chi tiet quiz cho hoc sinh khong expose `correctOptionIds`, `acceptedTextAnswers`, `explanation`.
  - Them test tao quiz co `introVideoUrl`/`introVideoTitle`.
  - Them test phu huynh nop quiz cho dung hoc sinh duoc lien ket va he thong tu cham diem cau hoi trac nghiem.
  - Them test quiz co cau tu luan duoc danh dau `NEEDS_GRADING`.
  - Them test giao vien trai nghiem/manager chot diem va nhan xet thu cong cho quiz can cham.
- `backend/scripts/test-teaching-report-workflow.js`
  - Them case fail hop le: giao vien chon `PARTIAL` va `progressPercent < 100` nhung khong ghi `deviationReason` thi API tra 400.
  - Them case submit hop le voi `deviationReason`, kiem tra completed list expose `evaluation.lessonProgressStatus`.
  - Them case update report ve `COMPLETED` va `progressPercent = 100`.
  - Cap nhat `wallets/adjust` payload them `reason` theo contract hien tai.

Ket luan:
- Logic moi cho phep giao vien linh hoat chua hoan thanh bai trong 1 buoi, nhung bat buoc ghi ly do va ke hoach buoi sau.
- Du lieu danh gia buoi hoc da co trong `session.evaluation`, san sang dung cho bao cao hoc tap va theo doi chat luong giang day.
- Quiz co cau truc da co lop backend va UI toi thieu de tao/cau hinh/giao/lam/nop bai. Cau trac nghiem co diem ngay; quiz co tu luan vao hang can cham trong man `Cham bai tap`.
- Danh sach cham bai upload/anh chi lay bai da nop de giao vien cham tay, tranh tron cac quiz da tu cham vao hang viec thu cong.
- Quiz da ho tro video dau bai (`introVideoUrl`) de hoc sinh nghe/xem video truoc, sau do tra loi cau hoi ben duoi.
- Bai tap ve nha da ho tro hoc sinh/phu huynh nop link video bai lam (`homeworkSubmissionVideoUrl`) thay vi upload file video nang vao he thong.

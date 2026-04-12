# WAVE 1 FRONTEND PROGRESS (2026-04-11)

## Muc dich

- Reopen hep Wave 1 de sync authoritative cho cac line B04 con mo trong checklist va backlog, dong thoi ghi nhan same-day B05 reschedule + teacher-swap conflict-validation + substitute-attendance RBAC + per-student present-absent-late closure + offline co-teaching closure, chot them line `trial/teacher-paid-only`, dong luon `lead attribution merge timeline`, va dong them `B03 multi-parent`.
- Giu `WAVE1-SUMMARY-20260410.vi.md` lam summary tong; file nay chi ghi nhan current rerun same-day.

## Scope

- Workspace: `school-mgmt/frontend`
- Ngay cap nhat: `2026-04-11`
- Mui gio: `UTC+7`
- Rerun authoritative:
  - `e2e/b04-order-review-actions-browser-ui.spec.ts`
  - `e2e/b04-order-approval-linked-views-browser-ui.spec.ts`
  - `e2e/b04-installment-payment-plan-browser-ui.spec.ts`
  - `e2e/b04-installment-deferred-revenue-browser-ui.spec.ts`
  - `e2e/b04-package-class-mode-pricing-browser-ui.spec.ts`
  - `e2e/b04-partial-payment-browser-ui.spec.ts`
  - `e2e/b04-order-cancel-linked-views-browser-ui.spec.ts`
  - `e2e/b04-trial-zero-amount-browser-ui.spec.ts`
  - `e2e/b04-trial-teacher-paid-only-browser-ui.spec.ts`
  - `e2e/b04-lead-attribution-merge-timeline-browser-ui.spec.ts`
  - `e2e/b05-session-reschedule-browser-ui.spec.ts`
  - `e2e/b05-session-change-approval-browser-ui.spec.ts`
  - `e2e/b05-substitute-attendance-rbac-browser-ui.spec.ts`
  - `e2e/b05-attendance-present-absent-late-browser-ui.spec.ts`
  - `e2e/b05-offline-co-teaching-browser-ui.spec.ts`
  - `e2e/b03-students-multi-parent-browser-ui.spec.ts`
- Tai lieu tham chieu:
  - `qa/reports/frontend-ui/WAVE1-SUMMARY-20260410.vi.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_order_request_info_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_order_reject_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_order_approval_linked_views_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_installment_payment_plan_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_installment_deferred_revenue_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_package_class_mode_pricing_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_partial_payment_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_order_cancel_linked_views_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_trial_zero_amount_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_trial_teacher_paid_only_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B04_lead_attribution_merge_timeline_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_session_reschedule_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_teacher_swap_conflict_validation_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_substitute_attendance_rbac_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_attendance_present_absent_late_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B05_offline_co_teaching_browser_20260411.md`

## Bang trang thai nhanh theo batch

| Batch | Slice authoritative moi | Status | Ghi chu |
| --- | --- | --- | --- |
| B04 | Order review actions + approval linked views + installment payment plan + installment deferred revenue + package/class/mode pricing + partial payment + cancel linked views + trial zero amount + trial teacher-paid-only + lead attribution merge timeline | PASS | Full rerun `12/12 PASS`; da sync checklist/backlog cho toan bo line B04 con mo |
| B05 | Session reschedule detail-modal flow + teacher-swap conflict validation + substitute-attendance RBAC + per-student present-absent-late attendance + offline co-teaching | PASS | Rerun `2/2 PASS` cho reschedule, `3/3 PASS` cho session-change approval conflict extension, `2/2 PASS` cho substitute-attendance RBAC, `1/1 PASS` cho attendance present-absent-late, va `3/3 PASS` cho offline co-teaching; da sync checklist/backlog cho line `teacher swap` + `reschedule session` + `substitute attendance RBAC` + `per-student attendance statuses` + `co-teaching` |

## Ket qua chinh cua dot

- Full rerun `e2e/b04-order-review-actions-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b04-order-approval-linked-views-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b04-installment-payment-plan-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b04-installment-deferred-revenue-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b04-package-class-mode-pricing-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b04-partial-payment-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b04-order-cancel-linked-views-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b04-trial-zero-amount-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b04-trial-teacher-paid-only-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b04-lead-attribution-merge-timeline-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b05-session-reschedule-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b05-session-change-approval-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b05-substitute-attendance-rbac-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b05-attendance-present-absent-late-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b05-offline-co-teaching-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b03-students-multi-parent-browser-ui.spec.ts`: `1/1 PASS`

## Batch notes

### B04

- Da xanh o cac slice sau:
  - `request-more-info` giu exact prompt va body ly do bo sung
  - row badge doi sang `NEEDS_INFO`
  - detail surface giu dung ly do va van cho `submit/edit`
  - `reject` giu exact prompt va body ly do tu choi
  - row badge doi sang `REJECTED`
  - detail surface giu dung ly do tu choi va an `submit/approve/reject`
  - `approve -> linked views` giu dung role menu `SALE` vs `DIRECTOR`
  - order detail render dung badge `APPROVED` va `Invoice: 1`
  - invoices list thay invoice moi voi student va trang thai `APPROVED`
  - students list thay hoc sinh duoc provision va giu dung parent link
  - installment bundle tren invoices UI render dung 3 dot `1/2/3`
  - moi dot giu exact amount `1.000.000d`
  - approve dot 1 khong lam dot 2/3 doi trang thai
  - wallet parent chi tang dung `1.000.000d` sau khi approve dot 1
  - approve order tra gop tao exact `3` invoice ky `1/2/3`, moi ky `1.000.000d`, va khong auto-approve toan bo bundle
  - approve rieng ky `1` giu ky `2/3` o `PENDING_APPROVAL` va dong bo `paymentFrames = [PAID, PENDING, PENDING]`
  - `Financial Control` tang exact `wallet = +1.000.000d`, `pendingInvoiceAmount = +2.000.000d`, `pendingInvoiceCount = +2`
  - `Investor Dashboard` giu `deferred revenue = 2.000.000d` sau khi chi approve ky `1`
  - package `ONLINE` auto giu dung `teachingMode`, `sessions`, `invoiceSessions`, `duration`, `pricePerSession`, va `totalAmount`
  - doi sang package `OFFLINE` loc lai class options dung theo `product + mode`, an class khong khop, va recalc exact `1.600.000d`
  - chon lop offline backfill exact `teacher`, `subject`, `baseDuration = 60`, `sessionDuration = 90`, `teacherPayPerStudent = 70.000d`, `maxStudents = 6`
  - draft order reopen van giu dung `selectedClassId`, `teachingMode = OFFLINE`, `2.400.000d` invoice amount, va detail render dung lop/teacher duoc chon
  - partial-payment order sau approve render ro `Da thanh toan = 1.200.000d`
  - cung surface do render ro `Con thieu = 600.000d`
  - row va detail deu giu badge `Chua thanh toan du`
  - backend invoice va wallet parent chi reflect dung so da thanh toan `1.200.000d`
  - DIRECTOR co the huy order da duyet ngay tren detail modal
  - order row va detail doi dung sang `CANCELLED`
  - detail reopen an cac action `submit/approve/cancel`
  - invoice sinh ra doi dung sang `CANCELLED`
  - wallet parent rollback exact ve `0d`
  - student da provision van giu hien thi dung tren Students
  - `trial 0d` khong leak `suggestedPrice` cua product len row/detail
  - row va detail deu giu `Gia tien khoa hoc = 0d` va `So tien hoa don = 0d`
  - approval modal xac nhan dung luong `offline trial 0d` khong bat buoc upload hoa don sale / doi ung
  - order sau approve giu badge `APPROVED` trong khi generated invoice va wallet side effect van exact `0d`
  - chi row `WAITING_DECISION` moi hien action `Tra luong GV`
  - action `trial/teacher-paid-only` post exact `POST /trial-enrollments/:id/teacher-paid-only`
  - row reload dung ve `Khong tiep tuc` kem note rieng `Van tra luong GV, khong charge PH`
  - backend `SessionTrialService.markTrialTeacherPaidOnly()` khong con alias sai sang `rejected-no-pay`, giu `trialTeacherPaidOnly = true`, `trialRejectedNoPay = false`, `isTeacherPaid = true`
  - lead detail modal goi rieng `GET /leads/:id` thay vi chi reuse list row snapshot
  - attribution summary giu dung `Facebook + Chatbot + First touch locked`
  - timeline render dung 2 touchpoint co thu tu thoi gian: `Facebook / Chatbot` truoc, `Google / Landing Page` sau
  - touchpoint context giu dung campaign/landing/utm va khong lam mat first touch da khoa
  - students multi-parent list/edit/save giu dung primary va secondary parent links
- Da sync ngay vao doi soat:
  - `Cancel order cap nhat dung toan bo man lien quan`
  - `Don hang tra gop hien thi ro lich thanh toan tung ky va phan anh dung tac dong len the Deferred Revenue / Doanh thu cho thu`
  - `Installment hien thi dung so ky va so tien lien quan`
  - `Chon package, lop, hinh thuc hoc va tinh gia dung`
  - `Partial Payment hien thi ro so da thanh toan, so con thieu va badge/trang thai chua thanh toan du`
  - `Sau khi duyet order, cac man lien doi hien thi dung du lieu phat sinh`
  - `Reject order hien thi dung trang thai va ly do tu choi`
  - `Request more info hoat dong dung va phan anh tren UI`
  - `Trial 0d hien thi dung badge va khong hien thi sai amount`
  - `trial/teacher-paid-only`
  - `Lead detail hien thi Attribution Merge theo dang timeline touchpoints khi cung mot SDT co nhieu nguon marketing`

## Ket luan Wave 1 frontend hien tai

- `WAVE1-SUMMARY-20260410.vi.md` van dung lam summary tong cho Wave 1.
- Dot reopen hep nay dong them 10 line B04 previously unsynced va dong not line B05 co-teaching ma khong thay doi ket luan tong the cua Wave 1.

## Buoc tiep theo hop ly

1. Wave 1 khong con line B04/B05 nao mo trong checklist/backlog canonical.
2. Backlog canonical da ve `0`; khong con line `B03 multi-parent` nao mo sau khi sync authoritative browser proof.

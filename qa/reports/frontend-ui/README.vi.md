# Frontend UI Reports

Thu muc nay chua cac bao cao theo dot cua frontend UI.

## File chinh

- `AUTH-HARDENING-20260410.vi.md`: same-day auth bundle va lockout hardening (`B01` + `B31/Nhom 12`), da sync them B01 change-password browser evidence ngay `2026-04-11`
- `backlog-canonical.vi.md`: snapshot lich su de mo Wave 0, khong con la nguon canonical hien tai
- `NHOM12-PROGRESS-20260410.vi.md`: progress authoritative cho cac line cross-surface thuoc `Nhom 12`
- `WAVE4-PROGRESS-20260410.vi.md`: progress authoritative cho current Wave 4 slices (`B03/B06/B11`), da sync them B03 teacher deactivation + users self-edit + agent tier matrix + teacher onboarding salary config + students multi-parent, B06 low-rating OPS + teacher-KPI penalty visibility + bulk teaching report + general-feedback + teaching-report dynamic-fields, va B11 shareholder masked export same-day browser evidence ngay `2026-04-11`
- `WAVE3-PROGRESS-20260410.vi.md`: progress authoritative cho current Wave 3 slices (`B02/B09/B10`) ma chua overclaim full batch closure, da sync them B09 bulk notifications + AI suggest preview-only same-day browser evidence ngay `2026-04-11`
- `WAVE2-SUMMARY-20260410.vi.md`: summary authoritative moi nhat cho frontend Wave 2 (`B07/B08`) voi same-day evidence, bao gom B07 browser reruns ngay `2026-04-11`, work-sessions late/early leave + adjust-wallet required-reason + payroll HELD reason-labels + payroll late-penalty + payroll offline min-payout guarantee browser proof, wallet-ledger + invoice-reject + invoice-filter/infinite-scroll browser proof, va B08 financial-control edit bank/fund browser proof
- `WAVE1-PROGRESS-20260411.vi.md`: progress reopen hep cho Wave 1 de sync same-day B04 browser slices tu order-review actions den package/class/mode pricing, trial teacher-paid-only, lead attribution merge timeline, va ghi nhan them B05 session-reschedule + teacher-swap conflict-validation + substitute-attendance RBAC + attendance present-absent-late + offline co-teaching browser proof ngay `2026-04-11`
- `WAVE1-SUMMARY-20260410.vi.md`: trang thai Wave 1 moi nhat sau triage `B04/B05`, da sync them B05 sale-side session-change request CTA/form/history + session reschedule + teacher-swap conflict-validation + substitute-attendance RBAC + attendance present-absent-late + offline co-teaching + calendar overview teacher/class filters + B04 lead attribution merge timeline browser evidence ngay `2026-04-11`
- `WAVE1-SUMMARY-20260409.vi.md`: snapshot Wave 1 truoc dot triage mo rong
- `remaining-cases.vi.md`: snapshot canonical hien tai cho remaining backlog; da sync ve `0`
- `parallel-subagent-results-20260408.vi.md`: tong hop lich su batch sub-agent `2026-04-08`, da duoc gan same-day update cho suite hygiene rescue `webhooks-chatbot-tickets-ui.spec.ts` ngay `2026-04-11`
- `frontend-ui-evidence/2026-04-11/logs/LOG_SCENARIOS_15_2_TO_17_4_BROWSER_20260411.md`: authoritative rerun same-day cho legacy omnibus `15.2-17.4`, xac nhan full `11/11 PASS`
- `frontend-ui-evidence/2026-04-11/logs/LOG_SCENARIOS_DEEP_ORDERS_1_1_TO_2_4_BROWSER_20260411.md`: authoritative rerun same-day cho legacy omnibus orders/sessions `1.1-2.4`, xac nhan full `12/12 PASS`
- `frontend-ui-evidence/2026-04-11/logs/LOG_SCENARIOS_10_3_TO_12_4_BROWSER_20260411.md`: authoritative rerun same-day cho legacy omnibus `10.3-12.4`, xac nhan full `13/13 PASS`
- `frontend-ui-evidence/2026-04-11/logs/LOG_SCENARIOS_12_5_TO_13_4_BROWSER_20260411.md`: authoritative rerun same-day cho legacy omnibus `12.5-15.1`, xac nhan full `12/12 PASS` va ghi ro fix fixture deterministic cho `13.4 payroll lifecycle`
- `frontend-ui-evidence/2026-04-11/logs/LOG_SCENARIOS_DEEP_REJECT_RESCHEDULE_PAYROLL_LOANS_12_BROWSER_20260411.md`: authoritative rerun same-day cho legacy omnibus `1.5/3.3/8.4/3.4/10.1/9.1`, xac nhan full `22/22 PASS`
- `frontend-ui-evidence/2026-04-11/logs/LOG_SESSION_REVENUE_FIRST_10_BROWSER_20260411.md`: authoritative rerun same-day cho legacy revenue/session slice `2.1-2.4`, xac nhan full `4/4 PASS` va file khong con `test.fixme`
- `frontend-ui-evidence/2026-04-11/logs/LOG_CASH_INFLOW_FIRST_10_BROWSER_20260411.md`: authoritative rerun same-day cho legacy cash-inflow slice `1.1-1.6`, xac nhan full `6/6 PASS`, rescue `1.4/1.6` theo current contract, va danh dau `frontend/e2e` da ve `0` occurrences `test.skip/fixme`
- `frontend-ui-evidence/2026-04-11/logs/LOG_B08_supplier_payments_lifecycle_browser_20260411.md`: browser proof authoritative cho supplier-payments lifecycle, da duoc rerun same-day sau cleanup `NG8107` compile warning o `supplier-payments.component.ts`
- `frontend-ui-evidence/2026-04-11/logs/LOG_B08_supplier_quotes_lifecycle_browser_20260411.md`: browser proof authoritative cho supplier-quotes lifecycle, da duoc rerun same-day sau cleanup `NG8107` compile warning o `supplier-quotes.component.ts`
- `frontend-ui-evidence/2026-04-11/logs/LOG_RELEASE_GATE_UI_BROWSER_20260411.md`: authoritative rerun same-day cho regression gate cross-surface `release-gate-ui.spec.ts`, xac nhan full `5/5 PASS` sau khi suite da sach `skip/fixme` va warning `supplier-*`
- `frontend-ui-evidence/2026-04-11/logs/LOG_ORDERS_REPORT_METRICS_UI_BROWSER_20260411.md`: authoritative rerun same-day cho cross-surface `orders -> approve -> comprehensive report -> attendance report`, xac nhan full `2/2 PASS` va refresh bang chung automation-only cu ngay `2026-04-07`
- `frontend-ui-evidence/2026-04-11/logs/LOG_ORDER_REPORT_ATTENDANCE_REGRESSION_BROWSER_20260411.md`: bundle regression authoritative same-day gom linked views + order/report metrics + attendance-report pagination/preview, xac nhan full `5/5 PASS` va dong drift cho note lich su `2026-04-07`
- `frontend-ui-evidence/2026-04-11/logs/LOG_ORDERS_FLOW_UI_BROWSER_20260411.md`: authoritative rerun same-day cho legacy order pipeline `1.1 -> 2.4`, xac nhan full `9/9 PASS` tren current tree va bo sung gate rong hon cho orders/sessions/wallets/financial-control
- `frontend-ui-evidence/2026-04-11/logs/LOG_RELEASE_GATE_ORDER_SMOKE_BROWSER_20260411.md`: smoke bundle authoritative same-day gom `release-gate + orders-flow + orders-report-metrics`, xac nhan full `16/16 PASS` tren current tree cho auth/access + order pipeline + report alignment + attendance/report handoff
- `frontend-ui-evidence/2026-04-11/logs/LOG_LANE_C_REGRESSION_BROWSER_20260411.md`: lane-C regression bundle authoritative same-day gom `webhooks/chatbot/tickets + notifications/leads/landing + B06-B11 follow-up`, xac nhan full `78/78 PASS` tren current tree
- `OPEN-GAP-TRIAGE-20260410.vi.md`: ghi chu triage lich su cho cac product/checklist gap da tung mo; khong con la nguon canonical cho open backlog hien tai
- `error-summary-*.vi.md`: nhom loi da quan sat
- `failure-triage-*.vi.md`: phan loai fail va nguyen nhan
- `final-verification-*.vi.md`: doi chieu chot evidence
- `fix-plan-*.vi.md`: ke hoach sua theo batch
- `showcase-ready.vi.md`: trang thai du dieu kien demo/showcase

## Cach dung

- Dung `AUTH-HARDENING-20260410.vi.md` de xem auth bundle same-day evidence va lockout hardening, bao gom B01 change-password browser proof ngay `2026-04-11`, thay vi chen no vao cac wave summary sai scope.
- Dung `remaining-cases.vi.md` de chot con so remaining hien tai; `backlog-canonical.vi.md` chi de tham chieu lich su Wave 0.
- Dung `NHOM12-PROGRESS-20260410.vi.md` de xem cac line cross-cutting `Nhom 12` da du same-day browser evidence, thay vi chen chung vao mot wave khong lien quan.
- Dung `WAVE4-PROGRESS-20260410.vi.md` de xem current authoritative progress cua `B03/B06/B11`, bao gom same-day B03 teacher deactivation + users self-edit + agent tier matrix + teacher onboarding salary config + students multi-parent, B06 teacher-KPI penalty visibility + bulk teaching report + general-feedback + teaching-report dynamic-fields, va B11 shareholder masked export browser proof ngay `2026-04-11`.
- Dung `WAVE3-PROGRESS-20260410.vi.md` de xem current authoritative progress cua `B02/B09/B10` ma khong dong full batch qua som, bao gom same-day B09 bulk notifications + AI suggest preview-only browser proof ngay `2026-04-11`.
- Dung `WAVE2-SUMMARY-20260410.vi.md` lam summary authoritative moi nhat cho frontend Wave 2, bao gom current B07 browser reruns ngay `2026-04-11`, work-sessions late/early leave + adjust-wallet required-reason + payroll HELD reason-labels + payroll late-penalty + payroll offline min-payout guarantee browser proof, wallet-ledger + invoice-reject + invoice-filter/infinite-scroll browser proof, va B08 current suite bao gom financial-control edit bank/fund browser proof.
- Dung `WAVE1-PROGRESS-20260411.vi.md` de xem current authoritative progress cua Wave 1 khi reopen hep cac slice B04 same-day de sync checklist/backlog, kem B04 trial teacher-paid-only + lead attribution merge timeline va B05 session-reschedule + teacher-swap conflict-validation + substitute-attendance RBAC + attendance present-absent-late + offline co-teaching browser proof ngay `2026-04-11`.
- Dung `WAVE1-SUMMARY-20260410.vi.md` lam summary authoritative moi nhat cho frontend Wave 1, bao gom same-day B05 sale-side session-change request CTA/form/history + session reschedule + teacher-swap conflict-validation + substitute-attendance RBAC + attendance present-absent-late + offline co-teaching + calendar overview teacher/class filters + B04 lead attribution merge timeline browser proof ngay `2026-04-11`.
- Dung `remaining-cases.vi.md` de xem chi tiet case con lai theo nhom va snapshot canonical `0`.
- Dung `parallel-subagent-results-20260408.vi.md` chi khi can xem batch triage lich su; trang thai suite hygiene webhooks moi nhat da duoc cap nhat same-day trong chinh file nay.
- Dung `LOG_SCENARIOS_15_2_TO_17_4_BROWSER_20260411.md` khi can doi chieu nhanh legacy suite `15.2-17.4`; file nay ghi ro fix deterministic cho `17.1 per-student config` va viec bo 2 dead skip.
- Dung `LOG_SCENARIOS_DEEP_ORDERS_1_1_TO_2_4_BROWSER_20260411.md` khi can doi chieu nhanh legacy suite `1.1-2.4`; file nay ghi ro fixture deterministic cho invoice rollback + wallet ops va viec bo runtime skip UI.
- Dung `LOG_SCENARIOS_10_3_TO_12_4_BROWSER_20260411.md` khi can doi chieu nhanh legacy suite `10.3-12.4`; file nay chi xac nhan rerun authoritative tren current tree, khong thay the wave summary.
- Dung `LOG_SCENARIOS_12_5_TO_13_4_BROWSER_20260411.md` khi can doi chieu nhanh legacy suite `12.5-15.1`; file nay ghi ro cach loai bo ambient `DRAFT payroll` drift o `13.4`, khong thay the wave summary.
- Dung `LOG_SCENARIOS_DEEP_REJECT_RESCHEDULE_PAYROLL_LOANS_12_BROWSER_20260411.md` khi can doi chieu nhanh legacy suite `1.5/3.3/8.4/3.4/10.1/9.1`; file nay ghi ro fix fixture deterministic cho payroll state machine, khong thay the wave summary.
- Dung `LOG_SESSION_REVENUE_FIRST_10_BROWSER_20260411.md` khi can doi chieu nhanh legacy revenue/session slice `2.1-2.4`; file nay ghi ro cach bo 2 `test.fixme` o `2.2-2.3`, khong thay the wave summary.
- Dung `LOG_CASH_INFLOW_FIRST_10_BROWSER_20260411.md` khi can doi chieu nhanh legacy cash-inflow slice `1.1-1.6`; file nay ghi ro cach rescue `1.4` va `1.6` theo current contract va moc snapshot `frontend/e2e = 0 test.skip/fixme`.
- Dung `LOG_B08_supplier_payments_lifecycle_browser_20260411.md` va `LOG_B08_supplier_quotes_lifecycle_browser_20260411.md` khi can doi chieu nhanh rerun same-day cho build hygiene `supplier-*`; hai file nay ghi ro cleanup warning `NG8107` va xac nhan oracle browser B08 van xanh.
- Dung `LOG_RELEASE_GATE_UI_BROWSER_20260411.md` khi can doi chieu nhanh regression gate cross-surface tren current tree; file nay gom route guard, order submit, invoice-proof guard, attendance/report flow va auto-logout `401`.
- Dung `LOG_ORDERS_REPORT_METRICS_UI_BROWSER_20260411.md` khi can doi chieu nhanh regression cross-surface `orders -> approve -> comprehensive report -> attendance report`; file nay la authoritative refresh cho log automation-only `2026-04-07`.
- Dung `LOG_ORDER_REPORT_ATTENDANCE_REGRESSION_BROWSER_20260411.md` khi can doi chieu nhanh bundle browser rong hon cho linked views + report metrics + attendance-report pagination/preview; file nay la moc authoritative de dong note lich su `2026-04-07`.
- Dung `LOG_ORDERS_FLOW_UI_BROWSER_20260411.md` khi can doi chieu nhanh gate legacy `orders-flow-ui.spec.ts`; file nay prove lai bundle `1.1 -> 2.4` tren current tree sau khi suite hygiene va regression docs da duoc lam sach.
- Dung `LOG_RELEASE_GATE_ORDER_SMOKE_BROWSER_20260411.md` khi can doi chieu nhanh smoke gate rong hon tren current tree; file nay gom `release-gate + orders-flow + orders-report-metrics` va phu hop de check nhanh auth/access/order/report sau moi dot fix lon.
- Dung `LOG_LANE_C_REGRESSION_BROWSER_20260411.md` khi can doi chieu nhanh gate rong hon cho `B06/B09/B10/B11`; file nay gom notifications/leads/landing, chatbot/tickets/backfill, va B06-B11 follow-up reporting surfaces.
- Dung `OPEN-GAP-TRIAGE-20260410.vi.md` nhu triage note lich su; truoc khi coi mot line la van con mo, doi chieu lai voi `remaining-cases.vi.md` va cac wave progress authoritative.
- Khong dung cac file nay thay cho checklist goc hoac frontend master test plan.

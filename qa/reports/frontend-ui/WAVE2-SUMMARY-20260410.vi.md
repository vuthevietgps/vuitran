# WAVE 2 FRONTEND SUMMARY (2026-04-10)

## Muc dich

- Cap nhat trang thai authoritative cho Wave 2 frontend sau khi dong file orchestrator `B07/B08`.
- Tach ro cac slice da duoc rerun same-day trong ngay `2026-04-10`.

## Scope

- Workspace: `school-mgmt/frontend`
- Rerun authoritative moi:
  - `e2e/orchestrator/b07-b08-finance-wallets.spec.ts`
  - `e2e/b08-financial-control-browser-ui.spec.ts`
  - `e2e/b07-wallet-topup-reject-browser-ui.spec.ts`
- `e2e/b07-wallet-transfer-browser-ui.spec.ts`
  - `e2e/b07-parent-topup-receipt-browser-ui.spec.ts`
  - `e2e/b07-wallet-ledger-browser-ui.spec.ts`
  - `e2e/b07-invoice-create-edit-browser-ui.spec.ts`
  - `e2e/b07-invoice-delete-browser-ui.spec.ts`
  - `e2e/b07-invoice-reject-browser-ui.spec.ts`
  - `e2e/b07-invoice-filters-browser-ui.spec.ts`
  - `e2e/b07-commission-report-browser-ui.spec.ts`
  - `e2e/b07-salary-config-crud-browser-ui.spec.ts`
  - `e2e/b07-work-sessions-browser-ui.spec.ts`
  - `e2e/b07-work-sessions-auto-closed-browser-ui.spec.ts`
  - `e2e/b07-payroll-exclude-browser-ui.spec.ts`
  - `e2e/b07-adjust-wallet-required-reason-browser-ui.spec.ts`
  - `e2e/b07-bulk-payroll-generate-browser-ui.spec.ts`
  - `e2e/b07-bulk-payroll-partial-success-browser-ui.spec.ts`
  - `e2e/b07-teacher-payroll-browser-ui.spec.ts`
  - `e2e/b07-payroll-held-reason-labels-browser-ui.spec.ts`
  - `e2e/b07-payroll-late-penalty-amount-browser-ui.spec.ts`
  - `e2e/b08-expenses-browser-ui.spec.ts`
  - `e2e/b08-loans-browser-ui.spec.ts`
  - `e2e/b08-supplier-quotes-browser-ui.spec.ts`
  - `e2e/b08-supplier-payments-browser-ui.spec.ts`
  - `e2e/b08-financial-control-create-browser-ui.spec.ts`
  - `e2e/b08-financial-control-edit-bank-fund-browser-ui.spec.ts`
  - `e2e/orchestrator/finance-rollback-constraints.spec.ts`
  - `e2e/orchestrator/b08-finance-alerts-reconciliation.spec.ts`
  - `e2e/b08-aging-report-browser-ui.spec.ts`
- Tai lieu tham chieu:
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B07_B08_WAVE2_20260410.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B07_wallet_topup_reject_pending_count_browser_20260410.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_wallet_transfer_success_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_wallet_transfer_self_blocked_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_wallet_transfer_over_balance_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_parent_topup_receipt_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_parent_topup_receipt_required_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_wallet_ledger_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_invoice_create_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_invoice_edit_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_invoice_delete_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_invoice_reject_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_invoice_filters_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_invoice_infinite_scroll_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_commission_report_director_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_commission_report_sale_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_salary_config_crud_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_work_sessions_filter_summary_edit_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_work_sessions_auto_closed_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_work_sessions_late_early_leave_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_payroll_exclude_required_reason_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_adjust_wallet_required_reason_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_bulk_payroll_generate_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_bulk_payroll_partial_success_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_staff_payroll_lifecycle_browser_20260411.md`
- `frontend-ui-evidence/2026-04-11/logs/LOG_B07_teacher_payroll_lifecycle_browser_20260411.md`
- `frontend-ui-evidence/2026-04-11/logs/LOG_B07_payroll_held_reason_labels_browser_20260411.md`
- `frontend-ui-evidence/2026-04-11/logs/LOG_B07_payroll_late_penalty_amount_browser_20260411.md`
- `frontend-ui-evidence/2026-04-11/logs/LOG_B07_payroll_offline_min_payout_guarantee_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_expenses_lifecycle_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_expenses_rbac_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_loans_lifecycle_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_finance_side_effects_cross_surface_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_supplier_quotes_lifecycle_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_supplier_payments_lifecycle_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_financial_control_create_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_financial_control_edit_bank_fund_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_financial_control_tab_switch_state_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_financial_alerts_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_financial_control_tabs_browser_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B08_accounting_reconciliation_import_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_finance_topup_cancel_rollback_20260411.md`
  - `frontend-ui-evidence/2026-04-11/logs/LOG_B07_finance_topup_cancel_overdraft_guard_20260411.md`
  - `frontend-ui-evidence/2026-04-10/logs/LOG_B08_AGING_REPORT_BROWSER_20260410.md`

## Bang trang thai nhanh theo batch

| Batch | Scope authoritative moi | Status | Ghi chu |
| --- | --- | --- | --- |
| B07 | Wallet transfer success + validation, parent top-up receipt flow, wallet ledger display, adjust-wallet required-reason validation + preview/ledger exact reason reflection, invoice create/edit/delete/reject/filter flows, approved-invoice rollback guardrails, commission-report role/data rendering, salary-config CRUD, work-sessions filter/summary/edit + AUTO_CLOSED + late/early-leave red badge visibility, exclude-payroll required-reason validation + EXCLUDED reflection, bulk payroll generate duplicate-submit guard + clean reload, bulk staff-payroll partial-success counts + ordered error list, staff payroll lifecycle, teacher payroll preview/generate/update/submit/approve/reject/reopen/mark-paid/delete lifecycle, payroll HELD reason badge/label visibility, payroll late-penalty amount visibility, payroll offline min-payout guarantee visibility, wallet top-up approval + reject, invoice infinite-scroll/load-batch, invoices approve guardrails, payroll preview/generation guardrails | PASS | `b07-b08-finance-wallets.spec.ts` xanh `4/4`, `b07-wallet-topup-reject-browser-ui.spec.ts` xanh `1/1`, `b07-wallet-transfer-browser-ui.spec.ts` xanh `3/3`, `b07-parent-topup-receipt-browser-ui.spec.ts` xanh `2/2`, `b07-wallet-ledger-browser-ui.spec.ts` xanh `1/1`, `b07-adjust-wallet-required-reason-browser-ui.spec.ts` xanh `1/1`, `b07-invoice-create-edit-browser-ui.spec.ts` xanh `2/2`, `b07-invoice-delete-browser-ui.spec.ts` xanh `1/1`, `b07-invoice-reject-browser-ui.spec.ts` xanh `1/1`, `b07-invoice-filters-browser-ui.spec.ts` xanh `2/2`, `b07-commission-report-browser-ui.spec.ts` xanh `2/2`, `b07-salary-config-crud-browser-ui.spec.ts` xanh `1/1`, `b07-work-sessions-browser-ui.spec.ts` xanh `1/1`, `b07-work-sessions-auto-closed-browser-ui.spec.ts` xanh `1/1`, `b07-work-sessions-late-early-leave-browser-ui.spec.ts` xanh `1/1`, `b07-payroll-exclude-browser-ui.spec.ts` xanh `1/1`, `b07-bulk-payroll-generate-browser-ui.spec.ts` xanh `1/1`, `b07-bulk-payroll-partial-success-browser-ui.spec.ts` xanh `1/1`, `b07-staff-payroll-browser-ui.spec.ts` xanh `1/1`, `b07-teacher-payroll-browser-ui.spec.ts` xanh `1/1`, `b07-payroll-held-reason-labels-browser-ui.spec.ts` xanh `1/1`, `b07-payroll-late-penalty-amount-browser-ui.spec.ts` xanh `1/1`, `b07-payroll-offline-min-payout-guarantee-browser-ui.spec.ts` xanh `1/1`, va `finance-rollback-constraints.spec.ts` xanh `2/2` |
| B08 | Expenses lifecycle + RBAC browser coverage, loans lifecycle browser coverage, supplier-quotes lifecycle browser coverage, supplier-payments lifecycle browser coverage, aggregate cross-surface finance side-effects closure, financial-control create/edit/record + cross-tab coverage + tab-switch stale-data/form-state guard, financial alerts severity/action browser proof, reconciliation visibility, shareholder read-only, aging-report filter/bucket-label browser coverage, P&L basis switch, accounting import/reject guardrail | PASS | `b08-expenses-browser-ui.spec.ts` xanh `2/2`; `b08-loans-browser-ui.spec.ts` xanh `1/1`; `b08-supplier-quotes-browser-ui.spec.ts` xanh `1/1`; `b08-supplier-payments-browser-ui.spec.ts` xanh `1/1`; aggregate log `LOG_B08_finance_side_effects_cross_surface_browser_20260411.md` closes the umbrella line from same-day browser bundle; `b08-financial-control-create-browser-ui.spec.ts` xanh `1/1`; `b08-financial-control-edit-bank-fund-browser-ui.spec.ts` xanh `1/1`; focused rerun `financial-control-tabs` xanh `1/1`; focused rerun `financial-control-tab-switch-state` xanh `1/1`; focused rerun `financial-alerts-browser` xanh `1/1`; focused rerun `accounting-reconciliation-import` xanh `1/1`; `b08-finance-alerts-reconciliation.spec.ts` + `b08-aging-report-browser-ui.spec.ts` giu current B08 suite xanh |

## Ket qua chinh cua dot 2026-04-10

- Full rerun `e2e/orchestrator/b07-b08-finance-wallets.spec.ts`: `4/4 PASS`
- Full rerun `e2e/b07-wallet-topup-reject-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-wallet-transfer-browser-ui.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b07-parent-topup-receipt-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b07-wallet-ledger-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-invoice-create-edit-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b07-invoice-delete-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-invoice-reject-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-invoice-filters-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b07-commission-report-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b07-salary-config-crud-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-work-sessions-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-work-sessions-auto-closed-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-work-sessions-late-early-leave-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-payroll-exclude-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-adjust-wallet-required-reason-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-bulk-payroll-generate-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-bulk-payroll-partial-success-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-staff-payroll-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-teacher-payroll-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-payroll-held-reason-labels-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-payroll-late-penalty-amount-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b07-payroll-offline-min-payout-guarantee-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b08-expenses-browser-ui.spec.ts`: `2/2 PASS`
- Full rerun `e2e/b08-loans-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b08-supplier-quotes-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b08-supplier-payments-browser-ui.spec.ts`: `1/1 PASS`
- Aggregate same-day authoritative browser bundle closed umbrella line `B08 finance side effects across invoice, wallet, payroll, expense, supplier payment` via canonical memo `LOG_B08_finance_side_effects_cross_surface_browser_20260411.md`
- Full rerun `e2e/b08-financial-control-create-browser-ui.spec.ts`: `1/1 PASS`
- Full rerun `e2e/b08-financial-control-edit-bank-fund-browser-ui.spec.ts`: `1/1 PASS`
- Focused rerun `e2e/b08-financial-control-browser-ui.spec.ts --grep "B08 financial-control tabs render provisional, bank, funds, cashflow, and pnl seeded data without crossing tab contracts"`: `1/1 PASS`
- Focused rerun `e2e/b08-financial-control-browser-ui.spec.ts --grep "B08 financial-control tab switching clears stale bank and fund selection state before reopening transaction forms"`: `1/1 PASS`
- Focused rerun `e2e/b08-financial-control-browser-ui.spec.ts --grep "B08 financial alerts render severity colors and attached actions open the correct handling context"`: `1/1 PASS`
- Focused rerun `e2e/b08-financial-control-browser-ui.spec.ts --grep "B08 financial-control reconciles bank transaction and updates unreconciled report counters"`: `1/1 PASS`
- Focused rerun `e2e/orchestrator/b07-b08-finance-wallets.spec.ts --grep "B08 reconciliation report and matched or unmatched flows are visible"`: `1/1 PASS`
- Focused rerun `e2e/orchestrator/b08-finance-alerts-reconciliation.spec.ts --grep "ACCOUNTING classifies mock CSV rows and rejects an unmatched import with a reason"`: `1/1 PASS`
- Full rerun `e2e/orchestrator/finance-rollback-constraints.spec.ts`: `2/2 PASS`
- Full rerun `e2e/orchestrator/b08-finance-alerts-reconciliation.spec.ts`: `3/3 PASS`
- Full rerun `e2e/b08-aging-report-browser-ui.spec.ts`: `2/2 PASS`
- B07 da duoc on dinh theo contract hien tai:
  - wallet transfer success -> source/target balance delta -> reciprocal TRANSFER_OUT / TRANSFER_IN ledger
  - self-transfer blocked ngay tren UI, khong phat sinh POST /wallets/transfer
  - over-balance transfer surfacing exact backend error va khong tao side effect
  - parent top-up voi uploaded receipt surfacing real preview, exact POST payload, pending accounting visibility, va wallet balance unchanged khi ledger con `PENDING`
  - bank-transfer parent top-up bi chan ngay tren UI neu thieu receipt, khong phat sinh POST /wallets/top-up
  - wallet ledger list render dung type label, signed amount, va balance delta cho `TOP_UP`, `TRANSFER_OUT`, `TRANSFER_IN`, va `ADJUSTMENT`
  - adjust-wallet modal chan submit neu thieu ly do truoc khi phat sinh POST `/wallets/adjust`, giu exact preview `before / delta / after`, va ledger row surfacing dung `adjustmentReason` ben canh description da duoc normalize
  - invoice create modal auto-picks linked class, syncs class type, sends exact POST payload, va re-renders pending row sau GET /invoices reload
  - invoice edit modal preload dung gia tri hien tai, sends exact PATCH payload, va re-renders row voi invoice number, class type, sale, amount, va payment round moi
  - invoice delete confirm uses exact invoice number, sends exact DELETE /invoices/:id, va second GET /invoices reload removes dung row muc tieu
  - invoice reject prompt persists exact `rejectedReason`, moves the row to `REJECTED`, removes it from pending filters, and leaves parent wallet balance unchanged
  - invoice filters narrow exactly by keyword, parent, sale, class type, status, and date range
  - invoice lazy table grows 40 -> 80 -> 85 tren scroll va giu danh sach row unique, khong mat dong
  - commission report route stays accessible for director and sale, forwards exact `fromDate/toDate`, and renders role-scoped summary/detail data without leaking other sales rows
  - exclude-payroll modal now proves blank-reason validation before any PATCH, sends the exact `status=EXCLUDED` payload after a valid reason, and reflects `EXCLUDED` + saved reason in both detail modal and payroll list after reload
  - bulk payroll generate now proves one exact `POST /payroll/bulk-generate` request for the selected period, disables the submit button while pending, blocks duplicate submit, closes the inline form after success, and reloads the payroll list with the new rows
  - salary-config manager flow creates, updates, and deletes a config with exact POST/PUT/DELETE payloads and clean list reloads
  - work-sessions list filter now recomputes correctly for admin keyword input, monthly summary sends local-date `periodStart/periodEnd`, and edit modal reloads the updated session without stale notes or times
  - work-sessions AUTO_CLOSED rows now surface an explicit `Tá»± Ä‘Ã³ng do quÃªn check-out` badge so directors can recognize the forgotten checkout violation directly on the table
  - approved invoice cancel now proves both safe rollback and overdraft guard: wallet balance is clawed back exactly when possible, and cancel is blocked with a clear warning before the parent wallet can go negative
  - invoice approve modal
  - unique seeds cho invoice / bank account / shareholder
  - payroll preview state mapping
  - payroll preview HELD rows now join real `PayrollTransaction` state, surface exact `PARENT_REJECTED` token + hold detail, and no longer collapse parent-rejected sessions into a generic waiting label
  - payroll preview late-report rows now surface exact `penaltyAmount` + `finalPayout` beside the gross teacher payout, so the late penalty is no longer hidden inside one ambiguous amount
  - wallet pending modal va ledger oracle
  - reject top-up cap nhat ngay pending count va trang thai `REJECTED` ma khong lam doi so du vi
- B08 da duoc on dinh theo contract hien tai:
  - expenses create/edit/approve/reject/mark-paid flow giu dung POST/PATCH body, reject reason, paid payload, va reload lai row/detail theo dung trang thai sau moi buoc
  - RBAC tren /app/expenses tach dung creator/approver/payer: OPS khong thay approve/pay, ACCOUNTING va DIRECTOR thay approve/reject/pay theo status
  - loans lifecycle browser proof giu dung `create -> activate -> record payment -> update overdue`: POST /loans exact payload tao row `DRAFT`, activate sinh dung 2 installment `SCHEDULED`, record payment cap nhat lich tra no + lich su thanh toan, va overdue updater chi doi qua han cho ky seed da qua ngay
  - broad finance side-effects line da duoc dong bang same-day browser bundle: invoice rollback/overdraft-guard, wallet top-up + ledger, payroll generate/exclude, expenses lifecycle, va supplier-payments lifecycle deu co UI proof rieng va canonic memo tong hop
  - supplier-quotes lifecycle browser proof giu dung create/edit/delete cho DRAFT row, `send` chi cho `DRAFT -> SENT`, `accept` chi cho `DRAFT|SENT -> ACCEPTED`, `reject` luu exact prompt reason, va detail modal surfacing dung `approvedByName/approvedAt` hoac `rejectionReason` sau reload
  - supplier-payments lifecycle browser proof giu dung create/edit/delete cho pending row, approve -> mark-paid tren row seeded, reject reason qua prompt contract, va recompute dung stat cards `Tong / Cho duyet / Da duyet / Da thanh toan`
  - `/app/financial-control` da co same-day browser proof cho create bank account, edit bank account, record bank transaction, create fund, edit fund, va record fund transaction; modal sua preload dung du lieu hien tai, chi gui exact PATCH fields duoc backend whitelist, va reload lai dung card sau `200 OK`
  - focused rerun `financial-control tabs` xac nhan 5 tab song `provisional gross profit / bank / funds / cashflow / P&L` deu render dung seeded data va giu dung query contract rieng cua tung tab
  - focused rerun `financial-control tab-switch state` xac nhan doi tab khong giu selected bank/fund stale, khong bleed transaction rows cu, va mo lai bank/fund transaction modal voi default hop le + form draft rong theo data moi
  - focused rerun `financial-alerts-browser` xac nhan badge severity render dung mau do/cam/xanh theo CSS contract va hai action song `Xem chi tiet` / `Nap quy` mo dung reconciliation context va fund-transaction modal prefill
  - focused rerun `financial-control reconcile` xac nhan nut `Doi soat` mo confirm dung wording, POST dung `/bank-transactions/:id/reconcile`, row doi tu button sang badge `reconciled`, va the `Chua doi soat` tren report giam tu `1` xuong `0`
  - focused rerun `reconciliation-filters` xac nhan man `Bank Reconciliation` chay duoc va phan tach ro `Matched` / `Unmatched` theo current UI surface
  - focused rerun `accounting-reconciliation-import` van giu dung proof unmatched-row reject: bat buoc ly do, xoa dung row khoi unmatched list, va giu matched/unmatched split dung theo CSV import
  - reconciliation card assertions khong con mo ho
  - shareholder read-only khong con phu thuoc helper login stale
  - aging-report filter bucket `current / 31-60 / 90+` giu dung exact row counts va badge labels
  - director / shareholder deu duoc doi chieu tren dung tab `Ngan hang`
  - P&L basis switch duoc rerun trong current orchestrator suite
  - accounting import/reject guardrail duoc rerun trong current orchestrator suite

## Danh gia theo batch

### B07

- Dot rerun nay da cover va xanh:
  - wallet transfer success -> balance delta -> reciprocal ledger
  - wallet transfer self-blocked -> no POST request -> no ledger side effect
  - wallet transfer over-balance -> exact backend error -> balance va ledger unchanged
  - parent top-up upload-receipt success -> preview -> exact payload -> accounting pending approvals -> ledger pending without balance credit
  - parent bank-transfer top-up without receipt -> blocked on UI -> no POST request
  - wallet ledger display -> exact type label + signed amount + balance-before/after cho top-up, transfer, va adjustment
  - invoice create -> student-linked class auto-pick -> exact POST payload -> second GET reload -> pending row visible with expected student, parent, amount, sale, and status
  - invoice edit -> current values preload -> exact PATCH payload -> second GET reload -> row reflects updated invoice number, class type, sale, amount, and payment round
  - invoice delete -> exact confirm string -> DELETE /invoices/:id -> second GET reload -> target row removed while surviving row remains visible
  - invoice reject -> exact prompt reason -> `REJECTED` row/filter state -> wallet unchanged
  - invoice filters -> exact keyword, parent, sale, class-type, status, and date-range narrowing
  - invoice infinite scroll -> 40 row initial batch, 80 on first scroll, 85 on second scroll, no duplicate invoice numbers
  - commission report -> director summary/monthly/detail render + sale-scoped detail view with no leaked foreign order row
  - salary config -> empty-state to create -> exact POST/PUT/DELETE -> row reloads and disappears cleanly after delete
  - `/app/payroll` teacher-payroll browser proof now covers preview -> generate -> edit -> submit -> reject -> reopen -> approve -> mark-paid -> delete with exact payloads, persisted reject reason/payment reference, and a real DRAFT edit modal for payroll-level bonus/deduction/notes
  - `/app/payroll` now also has same-day browser proof that an offline low-attendance preview row renders exact teaching pay `60.000d`, separate min-guarantee top-up `140.000d`, final payout `200.000d`, and an explicit `OFFLINE_MIN_GUARANTEE` reason instead of collapsing everything into one payout number
  - `/app/payroll` now also has same-day browser proof that HELD preview rows render a dedicated `HELD` badge, exact hold token `PARENT_REJECTED`, and exact hold description instead of a generic waiting bucket
  - `/app/payroll` now also has same-day browser proof that a late-report preview row renders exact gross `120.000đ`, separate penalty `36.000đ`, and final payout `84.000đ` instead of hiding the penalty in one total
  - work sessions -> exact `fromDate/toDate` list reload, exact `periodStart/periodEnd` summary query, and edit modal PATCH reload with updated times + notes
  - work sessions AUTO_CLOSED -> explicit forgotten-checkout badge visibility on the admin list
  - work sessions late/early leave -> red `+Np` late badge, red `Ve som Np` badge, and explicit `Ca start-end` schedule hint on the admin list
  - adjust wallet -> blank reason blocked before POST `/wallets/adjust`, modal preview keeps exact before/delta/after + typed reason, and ADJUSTMENT ledger row reflects exact persisted `adjustmentReason`
  - invoice cancel rollback -> approved top-up invoice can be cancelled with exact wallet clawback, and overdraft rollback is blocked with a clear negative-balance warning
  - wallet top-up approval -> balance delta -> ledger
  - wallet top-up reject -> pending count decrement -> ledger status `REJECTED` -> wallet balance unchanged
  - invoice approval -> immutability -> payroll preview/generation guardrails
- Ket luan:
  - `B07` co the danh dau `PASS` cho Wave 2 scope hien tai

### B08

- Dot rerun nay da cover va xanh:
  - expenses create/edit/approve/reject/mark-paid with exact payloads, persisted rejection reason, va paid-info reload trong detail
  - expenses RBAC separation giua creator (`OPS`) va finance approver/payer (`ACCOUNTING`, `DIRECTOR`)
  - reconciliation overview / matched-unmatched visibility
  - shareholder read-only financial control
  - aging-report filter va bucket label browser coverage cho `DIRECTOR` va `SHAREHOLDER`
  - P&L basis switch
  - accounting import va unmatched reject reason
- Ket luan:
  - `B08` co the danh dau `PASS` voi same-day authoritative evidence cho current B08 suite ngay `2026-04-10`

## Ket luan Wave 2 frontend hien tai

- `B07`: PASS
- `B08`: PASS voi same-day authoritative evidence cho current suite

## Buoc tiep theo hop ly

1. Chuyen sang backend `BA03` de dong cap `Wave 2` theo campaign chung.
2. Chi quay lai `B08` neu sau nay xac dinh them mot alert-only slice rieng ngoai current orchestrator suite.

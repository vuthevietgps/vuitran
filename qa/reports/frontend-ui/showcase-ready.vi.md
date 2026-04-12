# Trang Thai Showcase Frontend UI

## Muc tieu

- File nay dung de tra loi cau hoi: "co the dem di showcase voi nha dau tu chua?"
- Khac voi checklist coverage day du, file nay uu tien `happy path` va cac man hinh co gia tri trinh dien.
- `211` case mo trong backlog hien tai la backlog coverage nghiem ngat, khong phai `211` blocker cho showcase.

## Da Du Showcase

- Dang nhap va dieu huong dashboard theo role co bang chung pass, bao gom `SHAREHOLDER -> investor-dashboard`.
- Cum doanh thu chinh da pass o muc smoke:
  - approve order tu UI
  - approve installment invoice dau tien
  - approve discounted order va top-up dung `finalAmount`
  - reject order va khong tao invoice / khong top-up vi sai
- Cum tai chinh va doi soat da co bang chung pass:
  - approve invoice voi anh chung tu
  - approve top-up cap nhat vi va ledger dung
  - parent invoices chi hien thi dung pham vi
- Cum day hoc va bao cao da co bang chung pass:
  - teacher calendar
  - parent calendar
  - teaching report pending/completed, filter thang, teacher code lookup, submit/edit
  - audit log stats/filter/pagination/read-only
- Cum investor-facing da pass:
  - investor metrics tra du `snapshot`, `profitability`, `unitEconomics`, `liabilities`, `trend`
  - director truy cap duoc `investor-metrics`
  - shareholder mode bi chan mutate o lop API/RBAC
  - `financial-control` P&L va balance sheet truy cap duoc

## Co The De Sau Showcase

- `trial 0 dong` OFFLINE: order duyet duoc nhung invoice sinh ra van o `PENDING_APPROVAL`.
- `partial payment order`: chua co state machine/on-screen contract on dinh de smoke an toan.
- `reject order`: workflow reject pass, nhung UI chi tiet chua show ro `rejection reason` sau khi tu choi.
- Empty/error/loading/responsive/accessibility va cac tinh huong resilience theo widget.
- Export sau:
  - `UTF-8 BOM`
  - large streaming export
  - masked export cho `SHAREHOLDER`
- Cac nhanh finance sau khong can cho buoi showcase co the de dot sau:
  - payroll full state machine
  - supplier flows
  - reconciliation reject
  - expense edge cases

## Khuyen Nghi Demo

- Luong 1:
  - login `DIRECTOR`
  - vao orders
  - approve 1 order
  - mo invoice lien quan
- Luong 2:
  - login `ACCOUNTING`
  - approve invoice / top-up
  - mo wallets hoac ledger de cho thay side effect
- Luong 3:
  - login `TEACHER` hoac `DIRECTOR`
  - mo teaching report / calendar
  - cho thay van hanh hoc tap
- Luong 4:
  - vao investor metrics / financial-control
  - trinh dien snapshot, trend, profitability

## Ket luan

- O muc `showcase-ready`, frontend hien da du co so de demo voi nha dau tu.
- O muc `coverage-ready`, backlog van con `211` case mo va khong nen nham 2 muc nay voi nhau.

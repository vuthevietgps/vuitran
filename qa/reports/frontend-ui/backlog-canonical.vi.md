# Frontend UI Backlog Canonical - Wave 0

Ngay snapshot: `2026-04-09`

## Muc dich

- Day la snapshot canonical cho Wave 0 cua frontend UI.
- File nay dung de chot backlog con lai truoc khi chia cong theo batch.
- Nguon soat chinh: `qa/reports/frontend-ui/remaining-cases.vi.md`
- So sanh tham chieu: `qa/plans/frontend-ui/master-test-plan.vi.md`

## Tong so canonical

- Tong case con lai: `183`
- `P0`: `109`
- `P1`: `72`
- `P2`: `2`

## Phan bo theo batch

- `Nhom 1`: `3`
- `Nhom 3`: `10`
- `Nhom 4`: `16`
- `Nhom 5`: `26`
- `Nhom 6`: `14`
- `Nhom 7`: `27`
- `Nhom 8`: `15`
- `Nhom 9`: `24`
- `Nhom 10`: `14`
- `Nhom 11`: `7`
- `Nhom 12`: `27`

## Cach reconcile so lieu

- `remaining-cases.vi.md` la nguon canonical cho so con lai.
- `master-test-plan.vi.md` chua dung de mo wave va dinh huong batch, nhung mot phan so lieu trong do la historical only.
- So 183 con lai duoc phep dung de lap ke hoach Wave 0.
- So `291` trong master plan, cung voi cac so trung gian `254`, la so lieu lich su cua dot lap ke hoach truoc day va khong dung de tinh current remaining.
- Heading `67 Case Da Loai Khoi Backlog` trong `remaining-cases.vi.md` la so case da loai va khong tinh vao backlog con lai.

## Vi sao file nay la canonical cho Wave 0

- File nay gom du so con lai theo mot snapshot duy nhat.
- File nay khong pha tron trang thai da hoan tat voi trang thai con lai.
- File nay bo qua cac con so lich su de tranh staff va ETA bi lech.
- File nay phu hop de lock preflight, seed, va phan cong batch cho Wave 0.

## Uu tien chay truoc

1. `B01` - Auth, App Shell, Routing
2. `B04` - Leads, Orders, Trials
3. `B05` - Classes, Sessions, Attendance
4. `B07` - Invoices, Wallets, Payroll Core
5. `B02` - Dashboard, Handbook, Empty State, Alerts
6. `B08` - Finance Advanced, Financial Alerts, Reconciliation

## Ghi chu sign-off

- `P0` phai di truoc `P1`.
- `Nhom 12` khong chay rieng, ma phai gan vao tung batch.
- Moi batch chi duoc chot khi co seed, role, artifact, va evidence ro rang.
- Neu so lieu trong file khac lech voi file nay, uu tien `remaining-cases.vi.md` va ghi nhan la `doc drift`.

## Tinh trang su dung

- Wave 0 ready: `Yes`
- Can cap nhat tiep: `Yes`, khi backlog thay doi sau dot chay moi

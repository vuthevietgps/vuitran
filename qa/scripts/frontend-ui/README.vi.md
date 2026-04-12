# Frontend UI Scripts

## Danh sách script

- `new-frontend-ui-execution-pack.ps1`: tạo execution pack theo ngày, log skeleton và manifest batch.
- `manual-recording.ps1`: bật/tắt ghi hình manual ra `MP4`.
- `record-video-pilots.ps1`: chạy batch pilot cũ để tạo video pilot.
- `run-auto-videos.ps1`: chạy các suite auto video và convert `webm -> mp4`.

## Mặc định đường dẫn

- Các script tự resolve workspace root từ vị trí file script.
- Evidence manual vẫn ghi vào `frontend-ui-evidence/<YYYY-MM-DD>/`.
- Frontend app runner vẫn lấy code từ `school-mgmt/frontend/`.

## Gợi ý dùng

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\PC\Documents\code\vuitran\qa\scripts\frontend-ui\new-frontend-ui-execution-pack.ps1 -RunDate 2026-04-09
```

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\PC\Documents\code\vuitran\qa\scripts\frontend-ui\manual-recording.ps1 -Action start -RunDate 2026-04-09 -BatchId B07 -ShortName wallet_top_up_ledger
```

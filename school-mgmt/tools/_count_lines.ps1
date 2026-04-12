$files = @(Get-ChildItem -Path "c:\Users\PC\Documents\code\vuitran\school-mgmt" -Recurse -Filter "*.ts" |

















}  }    Write-Host "NOT FOUND: $f"  } else {    Write-Host "$n $f"    $n = (Get-Content $f).Count  if (Test-Path $f) {foreach ($f in $files) {)  "c:\Users\PC\Documents\code\vuitran\school-mgmt\backend\src\tickets\tickets.service.ts"  "c:\Users\PC\Documents\code\vuitran\school-mgmt\backend\src\payroll\payroll.service.ts",  "c:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\src\app\components\tickets.component.ts",  "c:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\src\app\components\dashboards\investor-dashboard.component.ts",  "c:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\src\app\components\orders.component.ts",  "c:\Users\PC\Documents\code\vuitran\school-mgmt\backend\src\messages\messages.service.ts",  "c:\Users\PC\Documents\code\vuitran\school-mgmt\frontend\src\app\components\users-management.component.ts",  Where-Object { $_.FullName -notmatch 'node_modules|dist|\.angular' -and -not $_.PSIsContainer } |
  ForEach-Object {
    $n = (Get-Content $_.FullName).Count
    if ($n -gt 999) {
      Write-Host "$n $($_.FullName)"
    }
  }

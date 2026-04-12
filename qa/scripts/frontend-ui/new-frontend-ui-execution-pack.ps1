param(
  [string]$RunDate = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Root = '',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}

$qaDir = Join-Path $Root 'qa'
$checklistPath = Join-Path $qaDir 'checklists\frontend-ui\testfrontendui.md'
$masterPlanPath = Join-Path $qaDir 'plans\frontend-ui\master-test-plan.vi.md'
$runbooksDir = Join-Path $qaDir 'runbooks\frontend-ui'

function New-DirectoryIfMissing {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Add-Line {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Text = ''
  )
  $Lines.Add($Text) | Out-Null
}

function Get-ChecklistGroups {
  param([string]$ChecklistPath)

  $groups = @{}
  $current = $null

  foreach ($line in Get-Content -Encoding utf8 $ChecklistPath) {
    if ($line -match '^## .+?(\d+)\.\s') {
      $current = $Matches[1]
      if (-not $groups.ContainsKey($current)) {
        $groups[$current] = New-Object System.Collections.Generic.List[string]
      }
      continue
    }

    if ($current -and $line -match '^- \[ \] (.+)$') {
      $groups[$current].Add($Matches[1].Trim()) | Out-Null
    }
  }

  return $groups
}

function Get-BatchCommonChecks {
  param([string]$BatchId)

  switch ($BatchId) {
    'B01' { return @('Loading state, submit disabled, double click', 'Refresh giu session hoac day dung ve login', 'Deep-link, route guard, RBAC menu/badge') }
    'B02' { return @('Loading, empty state, error state cua dashboard', 'Responsive co ban o man hinh hep', 'Badge, count, redirect tu widget hoac quick link') }
    'B03' { return @('RBAC an/hien nut sua, xoa, tao', 'Form validation va upload loi neu co', 'Reload khong lam mat state vua luu') }
    'B04' { return @('Validation tien, submit disabled, double click', 'Error state va request bi chan', 'Deep-link hoac dieu huong sang approval/invoice/student') }
    'B05' { return @('Loading, submit disabled, double click', 'Deep-link va refresh o session detail', 'Realtime hoac count attendance khong bi duplicate') }
    'B06' { return @('Form validation theo field dong', 'Upload sai loai hoac preview file', 'Empty state va error state cua kho tai lieu') }
    'B07' { return @('Submit disabled, double click, validation ly do', 'RBAC an/hien action vi hoac payroll', 'So du, ledger, status giu dung sau reload') }
    'B08' { return @('Loading, error state, stale state khi doi tab', 'Shareholder chi doc, khong lo action chinh sua', 'Matched/Unmatched va summary khong lech sau reload') }
    'B09' { return @('Unread count, polling, realtime khong duplicate', 'Deep-link vao ticket hoac conversation', 'Masking token va RBAC settings theo role') }
    'B10' { return @('Loading/toast khi sync hoac backfill', 'Error state cua public form va slug sai', 'Pixel/tracking khong inject lap sau reload') }
    'B11' { return @('Loading/progress khi export lon', 'RBAC inline edit va report detail theo role', 'Deep-link, filter, pagination giu dung state') }
    default { return @('Loading state', 'Error state', 'Submit disabled') }
  }
}

function New-LogContent {
  param(
    [hashtable]$Batch,
    [string]$RunDate,
    [string[]]$Cases,
    [string[]]$CommonChecks
  )

  $lines = New-Object System.Collections.Generic.List[string]
  Add-Line $lines ('# Log ' + $Batch.Id + ' - ' + $Batch.Title)
  Add-Line $lines
  Add-Line $lines '## Thong tin chung'
  Add-Line $lines
  Add-Line $lines ('- Ngay test: ' + $RunDate)
  Add-Line $lines '- Nguoi test:'
  Add-Line $lines ('- Batch: ' + $Batch.Id + ' - ' + $Batch.Title)
  Add-Line $lines '- Video MP4 du kien:'
  foreach ($video in $Batch.VideoNames) {
    Add-Line $lines ('  - `' + $video + '`')
  }
  Add-Line $lines ('- Vai tro: ' + ($Batch.Roles -join ', '))
  Add-Line $lines '- Moi truong:'
  Add-Line $lines ('- Runbook: `' + (Join-Path $runbooksDir $Batch.Runbook) + '`')
  Add-Line $lines
  Add-Line $lines '## Chuoi quay bat buoc'
  Add-Line $lines
  Add-Line $lines '- Man truoc thao tac: phai thay ro route, role va trang thai before.'
  Add-Line $lines '- Man submit: quay du form hoac modal va trang thai loading/disable.'
  Add-Line $lines '- Man nguon sau submit: mo lai list/detail cua chinh module.'
  Add-Line $lines '- Man doi soat lien doi:'
  foreach ($check in $Batch.LinkedChecks) {
    Add-Line $lines ('  - ' + $check)
  }
  Add-Line $lines
  Add-Line $lines '## Case con lai tu checklist goc'
  Add-Line $lines
  foreach ($case in $Cases) {
    Add-Line $lines ('- [ ] ' + $case)
  }
  Add-Line $lines
  Add-Line $lines '## Nhom 12 bat buoc gan kem'
  Add-Line $lines
  foreach ($commonCheck in $CommonChecks) {
    Add-Line $lines ('- [ ] ' + $commonCheck)
  }
  Add-Line $lines
  Add-Line $lines '## Nhat ky ket qua'
  Add-Line $lines
  Add-Line $lines '| STT | Ma case | Case checklist | Man submit | Man doi soat sau submit | Ky vong chinh | Ket qua thuc te | Trang thai | Moc video |'
  Add-Line $lines '|---|---|---|---|---|---|---|---|---|'
  for ($i = 0; $i -lt $Cases.Count; $i++) {
    $seq = '{0:D2}' -f ($i + 1)
    $caseId = '{0}-{1}' -f $Batch.Id, ('{0:D3}' -f ($i + 1))
    Add-Line $lines ('| ' + $seq + ' | ' + $caseId + ' | ' + $Cases[$i] + ' | | | | | PASS / FAIL / BLOCKED / NOT RUN | |')
  }
  Add-Line $lines
  Add-Line $lines '## Tong ket ngay'
  Add-Line $lines
  Add-Line $lines ('- Tong case batch: ' + $Cases.Count)
  Add-Line $lines '- PASS:'
  Add-Line $lines '- FAIL:'
  Add-Line $lines '- BLOCKED:'
  Add-Line $lines '- NOT RUN:'
  Add-Line $lines '- Ghi chu chinh:'

  return $lines
}

$evidenceDir = Join-Path $Root ('frontend-ui-evidence\' + $RunDate)
$logsDir = Join-Path $evidenceDir 'logs'
$videosDir = Join-Path $evidenceDir 'videos'
$screenshotsDir = Join-Path $evidenceDir 'screenshots'
$dateStamp = $RunDate.Replace('-', '')

foreach ($dir in @($evidenceDir, $logsDir, $videosDir, $screenshotsDir)) {
  New-DirectoryIfMissing -Path $dir
}

$groups = Get-ChecklistGroups -ChecklistPath $checklistPath

$batches = @(
  [ordered]@{
    Id = 'B04'; Title = 'Leads, Orders, Trials'; GroupKey = '4'; Runbook = 'B04-Orders-Trials.vi.md'; Wave = 'Dot 1';
    Roles = @('SALE', 'DIRECTOR');
    VideoNames = @("UI_B04A_Leads_OrderForm_${dateStamp}.mp4", "UI_B04B_OrderApproval_SideEffects_${dateStamp}.mp4");
    LogName = 'LOG_B04_Orders_Trials_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Lead detail, lead list va lich su owner sau create/edit/reassign.',
      'Order detail, Pending Approvals, pipeline hoac badge sidebar sau submit.',
      'Invoice list/detail, student list/detail va card tai chinh sau approve/reject/cancel.',
      'Deferred Revenue, Aging, invoice hoac payroll sau case installment, partial payment hoac trial dac biet.'
    )
  },
  [ordered]@{
    Id = 'B05'; Title = 'Classes, Sessions, Attendance'; GroupKey = '5'; Runbook = 'B05-Classes-Sessions-Attendance.vi.md'; Wave = 'Dot 1';
    Roles = @('OPS', 'TEACHER', 'PARENT', 'SALE');
    VideoNames = @("UI_B05A_Class_Session_Changes_${dateStamp}.mp4", "UI_B05B_Attendance_Finalize_SideEffects_${dateStamp}.mp4");
    LogName = 'LOG_B05_Classes_Sessions_Attendance_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Class list, class detail va Pending Approvals sau class update.',
      'Session detail, lich lop, lich giao vien hoac lich phu huynh sau swap/reschedule/cancel/finalize.',
      'Attendance by class/day va attendance report sau diem danh.',
      'Man TEACHER va PARENT/OPS cung nhin mot session sau auto-confirm hoac substitute teacher.'
    )
  },
  [ordered]@{
    Id = 'B07'; Title = 'Invoices, Wallets, Payroll'; GroupKey = '7'; Runbook = 'B07-Invoices-Wallets-Payroll.vi.md'; Wave = 'Dot 1';
    Roles = @('ACCOUNTING', 'DIRECTOR', 'TEACHER', 'PARENT');
    VideoNames = @("UI_B07A_Invoices_Wallets_${dateStamp}.mp4", "UI_B07B_Payroll_Core_SideEffects_${dateStamp}.mp4");
    LogName = 'LOG_B07_Invoices_Wallets_Payroll_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Invoice list/detail, parent invoices va wallet/ledger sau invoice change.',
      'Wallet balance, wallet ledger, pending count hoac history sau top-up/transfer.',
      'Payroll list/detail, man giao vien xem luong, Pending Approvals va man tai chinh tong hop sau payroll action.',
      'Badge HELD, Penalty, Min Payout Guarantee hoac Exclude Payroll phai thay o nhieu man lien quan.'
    )
  },
  [ordered]@{
    Id = 'B08'; Title = 'Finance Alerts, Financial Control, Reconciliation'; GroupKey = '8'; Runbook = 'B08-Finance-Alerts-Reconciliation.vi.md'; Wave = 'Dot 1';
    Roles = @('DIRECTOR', 'ACCOUNTING', 'SHAREHOLDER');
    VideoNames = @('UI_B08_Finance_Alerts_Reconciliation_' + $dateStamp + '.mp4');
    LogName = 'LOG_B08_Finance_Alerts_Reconciliation_' + $dateStamp + '.md';
    LinkedChecks = @(
      'List, detail va financial-control sau expense, supplier payment, loan hoac transaction.',
      'Summary, Matched/Unmatched va transaction detail sau reconcile hoac reject reconciliation.',
      'Man xu ly dich mo tu Financial Alert va trang thai alert khi quay lai.'
    )
  },
  [ordered]@{
    Id = 'B09'; Title = 'Notifications, Chatbot, Tickets'; GroupKey = '9'; Runbook = 'B09-Notifications-Chatbot-Tickets.vi.md'; Wave = 'Dot 1';
    Roles = @('OPS', 'DIRECTOR', 'ADSMANAGER', 'PARENT');
    VideoNames = @("UI_B09A_Notifications_ChatbotSettings_${dateStamp}.mp4", "UI_B09B_Chatbot_Tickets_SideEffects_${dateStamp}.mp4");
    LogName = 'LOG_B09_Notifications_Chatbot_Tickets_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Unread count va notification list cua account nhan sau bulk notification.',
      'Conversation detail, lead detail hoac order detail sau create from chatbot.',
      'Reload settings, masked token va RBAC theo role sau save chatbot-settings.',
      'Ticket detail, parent support chat va wallet/ledger warning sau ticket action hoac REFUND_REQUEST.'
    )
  },
  [ordered]@{
    Id = 'B10'; Title = 'Ads, Landing Pages, Public Flows'; GroupKey = '10'; Runbook = 'B10-Ads-PublicFlows.vi.md'; Wave = 'Dot 1';
    Roles = @('ADSMANAGER', 'DIRECTOR', 'SHAREHOLDER');
    VideoNames = @('UI_B10_Ads_PublicFlows_' + $dateStamp + '.mp4');
    LogName = 'LOG_B10_Ads_PublicFlows_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Trang thai sync/backfill, toast va so lieu/tab lien quan sau action.',
      'Management list, public URL va public slug sau create/edit landing page.',
      'Lead, conversation, order hoac noi luu source sau submit form cong khai.',
      'Vao/ra trang hoac reload de chung minh pixel va custom head/body khong inject lap.'
    )
  },
  [ordered]@{
    Id = 'B01'; Title = 'Auth, App Shell, Routing'; GroupKey = '1'; Runbook = 'B01-Auth-AppShell.vi.md'; Wave = 'Dot 2';
    Roles = @('DIRECTOR', 'SALE', 'SHAREHOLDER');
    VideoNames = @('UI_B01_Auth_AppShell_' + $dateStamp + '.mp4');
    LogName = 'LOG_B01_Auth_AppShell_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Logout, login lai bang mat khau moi va refresh sau doi mat khau.',
      'Route ve login va menu noi bo bien mat sau case 401 hoac logout cuong buc.',
      'So truc tiep menu, badge va route landing cua it nhat 2 role.'
    )
  },
  [ordered]@{
    Id = 'B02'; Title = 'Dashboard, Handbook, Pending Approvals'; GroupKey = '2'; Runbook = 'B02-Dashboard-Handbook.vi.md'; Wave = 'Dot 2';
    Roles = @('DIRECTOR', 'OPS', 'SALE', 'PARENT', 'SHAREHOLDER');
    VideoNames = @('UI_B02_Dashboard_Handbook_' + $dateStamp + '.mp4');
    LogName = 'LOG_B02_Dashboard_Handbook_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Tab count, sidebar badge va detail record lien quan sau approve/reject o hub.',
      'List dich va filter/ngu canh sau click Overdue Tickets, Quick Links hoac Action.',
      'Noi dung handbook cua nhieu role de doi chieu cau hinh.'
    )
  },
  [ordered]@{
    Id = 'B03'; Title = 'Users, Students, Products, Agents'; GroupKey = '3'; Runbook = 'B03-Users-Students-Products.vi.md'; Wave = 'Dot 2';
    Roles = @('DIRECTOR', 'OPS', 'ACCOUNTING', 'SALE');
    VideoNames = @('UI_B03_Users_Students_Products_' + $dateStamp + '.mp4');
    LogName = 'LOG_B03_Users_Students_Products_' + $dateStamp + '.md';
    LinkedChecks = @(
      'List, detail va filter owner sau multiple parents hoac reassign owner.',
      'Form tao order cua SALE sau deactivate product.',
      'Teacher detail va salary config/payroll preview sau deactivate teacher hoac onboarding.',
      'List va filter theo tier/trang thai sau create/edit agent.'
    )
  },
  [ordered]@{
    Id = 'B06'; Title = 'Teacher Hub, Parent Pages, Teaching Reports'; GroupKey = '6'; Runbook = 'B06-TeacherHub-ParentPages.vi.md'; Wave = 'Dot 3';
    Roles = @('TEACHER', 'PARENT', 'OPS');
    VideoNames = @('UI_B06_TeacherHub_ParentPages_' + $dateStamp + '.mp4');
    LogName = 'LOG_B06_TeacherHub_ParentPages_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Profile detail va list sau update teacher profile hoac bankInfo.',
      'Teacher calendar, request list va Pending Approvals hoac man OPS sau request nghi/thay the.',
      'Pending/completed, session detail, KPI hoac payroll preview sau submit teaching report.',
      'Man OPS hoac canh bao lien quan sau low rating hoac general-feedback.'
    )
  },
  [ordered]@{
    Id = 'B11'; Title = 'Reports, Export, Audit'; GroupKey = '11'; Runbook = 'B11-Reports-Export-Audit.vi.md'; Wave = 'Dot 3';
    Roles = @('DIRECTOR', 'ACCOUNTING', 'OPS', 'SHAREHOLDER');
    VideoNames = @('UI_B11_Reports_Export_Audit_' + $dateStamp + '.mp4');
    LogName = 'LOG_B11_Reports_Export_Audit_' + $dateStamp + '.md';
    LinkedChecks = @(
      'Pending/completed, session detail, teacher KPI hoac payroll preview sau teaching report submit/edit.',
      'File export tai ve, mo truc tiep file de kiem tra UTF-8 BOM va du lieu masked.',
      'Audit log sau khi thuc hien thay doi o module khac.',
      'Role khong hop le mo lai cung report de xac nhan khong lo action.'
    )
  }
)

$manifestPath = Join-Path $evidenceDir 'EXECUTION-PACK.vi.md'
$manifestLines = New-Object System.Collections.Generic.List[string]
Add-Line $manifestLines ('# Goi Thuc Thi Frontend UI ' + $RunDate)
Add-Line $manifestLines
Add-Line $manifestLines '## Tong quan'
Add-Line $manifestLines
Add-Line $manifestLines ('- Checklist goc: `' + $checklistPath + '`')
Add-Line $manifestLines ('- Ke hoach tong: `' + $masterPlanPath + '`')
Add-Line $manifestLines ('- Runbooks: `' + $runbooksDir + '`')
Add-Line $manifestLines '- Quy tac evidence: video phai the hien duoc man nguon va cac man lien doi sau submit.'
Add-Line $manifestLines
Add-Line $manifestLines '## Nhom 12 ap dung cho moi batch'
Add-Line $manifestLines
if ($groups.ContainsKey('12')) {
  foreach ($item in $groups['12']) {
    Add-Line $manifestLines ('- [ ] ' + $item)
  }
}
Add-Line $manifestLines
Add-Line $manifestLines '## Batch con lai theo thu tu chay'
Add-Line $manifestLines

foreach ($batch in $batches) {
  $cases = @()
  if ($groups.ContainsKey($batch.GroupKey)) {
    $cases = @($groups[$batch.GroupKey].ToArray())
  }

  Add-Line $manifestLines ('### ' + $batch.Id + ' - ' + $batch.Title)
  Add-Line $manifestLines
  Add-Line $manifestLines ('- Dot uu tien: ' + $batch.Wave)
  Add-Line $manifestLines ('- So case con lai tu checklist: ' + $cases.Count)
  Add-Line $manifestLines ('- Vai tro: ' + ($batch.Roles -join ', '))
  Add-Line $manifestLines ('- Runbook: `' + (Join-Path $runbooksDir $batch.Runbook) + '`')
  Add-Line $manifestLines '- Video du kien:'
  foreach ($video in $batch.VideoNames) {
    Add-Line $manifestLines ('  - `' + $video + '`')
  }
  Add-Line $manifestLines ('- Log du kien: `' + $batch.LogName + '`')
  Add-Line $manifestLines '- Man doi soat sau submit:'
  foreach ($check in $batch.LinkedChecks) {
    Add-Line $manifestLines ('  - ' + $check)
  }
  Add-Line $manifestLines

  $logPath = Join-Path $logsDir $batch.LogName
  if ((-not (Test-Path -LiteralPath $logPath)) -or $Force) {
    $logContent = New-LogContent -Batch $batch -RunDate $RunDate -Cases $cases -CommonChecks (Get-BatchCommonChecks -BatchId $batch.Id)
    $logContent | Set-Content -Encoding utf8 $logPath
  }
}

$manifestLines | Set-Content -Encoding utf8 $manifestPath

Write-Host ('Da tao execution pack: ' + $manifestPath)
Write-Host 'Log skeleton da co san:'
Get-ChildItem -LiteralPath $logsDir -Filter ('LOG_B*_' + $dateStamp + '.md') |
  Sort-Object Name |
  ForEach-Object { Write-Host ('- ' + $_.FullName) }

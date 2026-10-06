# Nightly full database + photos backup.
# Run from Task Scheduler (or manually) to guarantee you always have a
# recoverable copy of the live RTDB (students, photos, attendance, exams, ...).
#
# Logs to:  scripts/../backups/backup.log
# Data in:  scripts/../backups/rtdb-<timestamp>.json
#           scripts/../backups/student-photos/  (re-exported photos)
#
# Register in Task Scheduler (run once):
#   powershell -ExecutionPolicy Bypass -File scripts\auto-backup.ps1 -Register
# Or run manually:
#   powershell -ExecutionPolicy Bypass -File scripts\auto-backup.ps1

param(
  [switch]$Register,
  [switch]$Unregister
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

if ($Register) {
  $taskName = 'AnsarAttendanceBackup'
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\auto-backup.ps1`""
  $trigger = New-ScheduledTaskTrigger -Daily -At 2am
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 4)
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Nightly Ansar Madresah Firebase backup' -Force
  Write-Output "Registered nightly backup task: $taskName (runs 02:00 daily)"
  exit 0
}
if ($Unregister) {
  Unregister-ScheduledTask -TaskName 'AnsarAttendanceBackup' -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output 'Removed nightly backup task.'
  exit 0
}

Write-Output ("[" + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + "] Running backup..")
Push-Location $root
try {
  npm run backup:db 2>&1 | ForEach-Object { Write-Output $_ }
  npm run export:photos 2>&1 | ForEach-Object { Write-Output $_ }
} finally {
  Pop-Location
}
Write-Output ("[" + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + "] Done.")
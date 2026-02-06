# Stazeni aktualni verze firemnich pravidel z GitHubu do .cursor/rules/
# Pouziti: z korene projektu nemovitosti:
#   .\scripts\pull-cursor-rules-from-github.ps1
#
# 1. Pokud mas lokalni zmeny v .cursor/rules/, udela zalohu do .cursor/rules-backup-YYYYMMDD-HHMM
# 2. V docs/cursor-rules-firemni: git fetch, checkout main, pull
# 3. Zkopiruje docs/cursor-rules-firemni/rules/*.mdc do .cursor/rules/
# Rozpory firemni vs tvoje: skript nepropoji automaticky – viz docs/CURSOR-RULES-SYNC-WORKFLOW.md

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$targetDir = Join-Path $projectRoot "docs\cursor-rules-firemni"
$targetRules = Join-Path $targetDir "rules"
$destRules = Join-Path $projectRoot ".cursor\rules"

if (-not (Test-Path $targetDir)) {
    Write-Error "Slozka docs/cursor-rules-firemni nenalezena: $targetDir"
}
if (-not (Test-Path $destRules)) {
    New-Item -ItemType Directory -Path $destRules -Force | Out-Null
}

# Zaloha .cursor/rules/ pred prepisem (kdyz tam neco je)
if (Test-Path $destRules) {
    $backupName = "rules-backup-" + (Get-Date -Format "yyyyMMdd-HHmm")
    $backupDir = Join-Path $projectRoot ".cursor\$backupName"
    $mdcCount = (Get-ChildItem -Path (Join-Path $destRules "*.mdc") -ErrorAction SilentlyContinue).Count
    if ($mdcCount -gt 0) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Copy-Item -Path (Join-Path $destRules "*.mdc") -Destination $backupDir -Force
        Write-Host "Zaloha: .cursor/$backupName/"
    }
}

Write-Host "Stahuji zmeny z GitHubu (main)..."
Push-Location $targetDir
try {
    git fetch origin main
    git checkout main
    git pull origin main
} finally {
    Pop-Location
}

Write-Host "Kopiruji docs/cursor-rules-firemni/rules/*.mdc -> .cursor/rules/"
Copy-Item -Path (Join-Path $targetRules "*.mdc") -Destination $destRules -Force
Write-Host "Hotovo. Aktualni firemni pravidla jsou v .cursor/rules/"

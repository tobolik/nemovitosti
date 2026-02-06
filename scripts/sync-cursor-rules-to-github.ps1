# Synchronizace pravidel z .cursor/rules/ do repozitare cursor-rules na GitHubu
# Vychozi: push na vetev sync-from-nemovitosti, pak na GitHubu otevřete Pull request.
# Priamo na main: .\scripts\sync-cursor-rules-to-github.ps1 -PushBranch "main"
#
# 1. Zkopiruje .cursor/rules/*.mdc do docs/cursor-rules-firemni/rules/
# 2. V cursor-rules-firemni commit a push na vetev (nebo main)

param(
    [string]$PushBranch = "sync-from-nemovitosti"   # vychozi = vetev pro PR; "main" = primo na main
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceRules = Join-Path $projectRoot ".cursor\rules"
$targetDir = Join-Path $projectRoot "docs\cursor-rules-firemni"
$targetRules = Join-Path $targetDir "rules"

if (-not (Test-Path $sourceRules)) {
    Write-Error "Slozka .cursor/rules nenalezena: $sourceRules"
}
if (-not (Test-Path $targetDir)) {
    Write-Error "Slozka docs/cursor-rules-firemni nenalezena: $targetDir"
}

Write-Host "Kopiruji .cursor/rules/*.mdc -> docs/cursor-rules-firemni/rules/"
Copy-Item -Path (Join-Path $sourceRules "*.mdc") -Destination $targetRules -Force

Push-Location $targetDir
try {
    $status = git status --short
    if (-not $status) {
        Write-Host "Zadne zmeny oproti poslednimu commitu."
        exit 0
    }
    Write-Host $status
    git add rules/
    git commit -m "Sync: pravidla z projektu nemovitosti"
    if ($PushBranch -eq "main") {
        git push origin main
        Write-Host "Push na main dokoncen."
    } else {
        git checkout -b $PushBranch 2>$null
        if ($LASTEXITCODE -ne 0) { git checkout $PushBranch }
        git push -u origin $PushBranch
        Write-Host ""
        Write-Host "Push na branch '$PushBranch' dokoncen. Na GitHubu otevřete Pull request do main:"
        Write-Host "  https://github.com/tobolik/cursor-rules/compare/main...$PushBranch"
    }
} finally {
    Pop-Location
}

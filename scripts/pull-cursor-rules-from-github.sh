#!/bin/sh
# Stažení aktuální verze firemních pravidel z GitHubu do .cursor/rules/
# Použití: z kořene projektu: ./scripts/pull-cursor-rules-from-github.sh
#
# 1. Pokud máš lokální změny v .cursor/rules/, udělá zálohu do .cursor/rules-backup-YYYYMMDD-HHMM
# 2. V docs/cursor-rules-firemni: git fetch, checkout main, pull
# 3. Zkopíruje rules/*.mdc do .cursor/rules/
# Rozpory firemní vs tvoje: skript nepropojí automaticky – viz docs/CURSOR-RULES-SYNC-WORKFLOW.md

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="$PROJECT_ROOT/docs/cursor-rules-firemni"
TARGET_RULES="$TARGET_DIR/rules"
DEST_RULES="$PROJECT_ROOT/.cursor/rules"

[ -d "$TARGET_DIR" ] || { echo "Chyba: docs/cursor-rules-firemni nenalezena"; exit 1; }
mkdir -p "$DEST_RULES"

# Záloha .cursor/rules/ před přepsáním
if [ -d "$DEST_RULES" ] && ls "$DEST_RULES"/*.mdc 1>/dev/null 2>&1; then
  BACKUP_NAME="rules-backup-$(date +%Y%m%d-%H%M)"
  BACKUP_DIR="$PROJECT_ROOT/.cursor/$BACKUP_NAME"
  mkdir -p "$BACKUP_DIR"
  cp -f "$DEST_RULES"/*.mdc "$BACKUP_DIR/"
  echo "Zaloha: .cursor/$BACKUP_NAME/"
fi

echo "Stahuji zmeny z GitHubu (main)..."
cd "$TARGET_DIR"
git fetch origin main
git checkout main
git pull origin main
cd "$PROJECT_ROOT"

echo "Kopiruji docs/cursor-rules-firemni/rules/*.mdc -> .cursor/rules/"
cp -f "$TARGET_RULES"/*.mdc "$DEST_RULES/"
echo "Hotovo. Aktualni firemni pravidla jsou v .cursor/rules/"

#!/bin/sh
# Synchronizace pravidel z .cursor/rules/ do repozitáře cursor-rules na GitHubu
# Výchozí: push na větev (sync-from-nemovitosti), pak na GitHubu otevřete Pull request.
# Přímo na main: ./scripts/sync-cursor-rules-to-github.sh main
#
# 1. Zkopíruje .cursor/rules/*.mdc do docs/cursor-rules-firemni/rules/
# 2. V cursor-rules-firemni commit a push na větev (nebo main)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_RULES="$PROJECT_ROOT/.cursor/rules"
TARGET_DIR="$PROJECT_ROOT/docs/cursor-rules-firemni"
TARGET_RULES="$TARGET_DIR/rules"
PUSH_BRANCH="${1:-sync-from-nemovitosti}"

[ -d "$SOURCE_RULES" ] || { echo "Chyba: .cursor/rules nenalezena"; exit 1; }
[ -d "$TARGET_DIR" ] || { echo "Chyba: docs/cursor-rules-firemni nenalezena"; exit 1; }

echo "Kopíruji .cursor/rules/*.mdc -> docs/cursor-rules-firemni/rules/"
cp -f "$SOURCE_RULES"/*.mdc "$TARGET_RULES/"

cd "$TARGET_DIR"
if [ -z "$(git status --short)" ]; then
  echo "Žádné změny oproti poslednímu commitu."
  exit 0
fi
git add rules/
git commit -m "Sync: pravidla z projektu nemovitosti"
if [ "$PUSH_BRANCH" = "main" ]; then
  git push origin main
  echo "Push na main dokončen."
else
  git checkout -b "$PUSH_BRANCH" 2>/dev/null || git checkout "$PUSH_BRANCH"
  git push -u origin "$PUSH_BRANCH"
  echo ""
  echo "Push na branch '$PUSH_BRANCH' dokončen. Na GitHubu otevřete Pull request do main:"
  echo "  https://github.com/tobolik/cursor-rules/compare/main...$PUSH_BRANCH"
fi

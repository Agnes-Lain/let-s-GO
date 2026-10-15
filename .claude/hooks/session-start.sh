#!/bin/bash
# Installs dependencies at the start of Claude Code cloud sessions.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
elif [ -f package.json ]; then
  npm install --no-audit --no-fund
fi
